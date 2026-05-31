"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyze = analyze;
exports.analyzeIncremental = analyzeIncremental;
const ts_morph_1 = require("ts-morph");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const files_1 = require("./files");
const cache_1 = require("./cache");
// Full analysis — loads all source files via ts-morph for accurate types.
function analyze(cwd) {
    const project = buildProject(cwd);
    const ignorePatterns = (0, files_1.loadIgnorePatterns)(cwd);
    const sourceFiles = project.getSourceFiles().filter(sf => {
        const fp = sf.getFilePath();
        if (fp.includes('/node_modules/') || fp.includes('/dist/'))
            return false;
        if (ignorePatterns.length === 0)
            return true;
        return !(0, files_1.matchesIgnore)(toRel(cwd, fp), ignorePatterns);
    });
    const exportsMap = [];
    const importsMap = [];
    const importedBy = new Map();
    const symbolsSeen = new Set();
    const symbols = [];
    for (const sf of sourceFiles) {
        const rel = toRel(cwd, sf.getFilePath());
        processExports(sf, rel, cwd, exportsMap, symbols, symbolsSeen);
        processImports(sf, rel, cwd, importsMap, importedBy);
    }
    // Write cache after full analysis
    const cache = buildCacheFromResult(cwd, sourceFiles, exportsMap, importsMap, symbols);
    (0, cache_1.saveCache)(cwd, cache);
    return { files: sourceFiles.length, exports: exportsMap, imports: importsMap, importedBy, symbols };
}
// Incremental analysis — only re-parses changed files, uses cache for the rest.
// Falls back to full analysis if no cache exists.
function analyzeIncremental(cwd) {
    const cache = (0, cache_1.loadCache)(cwd);
    const allFiles = (0, files_1.findSourceFiles)(cwd);
    const changedPaths = [];
    const currentRels = new Set();
    for (const abs of allFiles) {
        const rel = toRel(cwd, abs);
        currentRels.add(rel);
        try {
            const mtime = fs.statSync(abs).mtimeMs;
            if (!cache.files[rel] || cache.files[rel].mtime !== mtime) {
                changedPaths.push(abs);
            }
        }
        catch {
            changedPaths.push(abs);
        }
    }
    // Remove deleted files from cache
    let deletedCount = 0;
    for (const rel of Object.keys(cache.files)) {
        if (!currentRels.has(rel)) {
            delete cache.files[rel];
            deletedCount++;
        }
    }
    // Nothing changed — reconstruct directly from cache (no ts-morph at all)
    if (changedPaths.length === 0) {
        // Persist the cache if we removed deleted files, so we don't repeat the work next run.
        if (deletedCount > 0) {
            cache.generatedAt = new Date().toISOString();
            (0, cache_1.saveCache)(cwd, cache);
        }
        return { result: (0, cache_1.reconstructFromCache)(cache), changed: 0, cached: Object.keys(cache.files).length };
    }
    // Some files changed — build a mini project with changed files + their local imports
    const contextPaths = collectContext(changedPaths, cwd, cache);
    const project = buildProjectForFiles(cwd, [...contextPaths]);
    reanalyzeFiles(changedPaths, project, cwd, cache);
    cache.generatedAt = new Date().toISOString();
    (0, cache_1.saveCache)(cwd, cache);
    return {
        result: (0, cache_1.reconstructFromCache)(cache),
        changed: changedPaths.length,
        cached: Object.keys(cache.files).length - changedPaths.length,
    };
}
// ── helpers ──────────────────────────────────────────────────────────────────
function buildProject(cwd) {
    const tsconfigPath = path.join(cwd, 'tsconfig.json');
    const hasTsconfig = fs.existsSync(tsconfigPath);
    const opts = hasTsconfig
        ? { tsConfigFilePath: tsconfigPath, skipAddingFilesFromTsConfig: false }
        : { compilerOptions: { allowJs: true, strict: false }, skipAddingFilesFromTsConfig: true };
    const project = new ts_morph_1.Project(opts);
    if (!hasTsconfig) {
        project.addSourceFilesAtPaths((0, files_1.findSourceFiles)(cwd));
    }
    return project;
}
function buildProjectForFiles(cwd, absPaths) {
    const tsconfigPath = path.join(cwd, 'tsconfig.json');
    const hasTsconfig = fs.existsSync(tsconfigPath);
    const opts = hasTsconfig
        ? { tsConfigFilePath: tsconfigPath, skipAddingFilesFromTsConfig: true }
        : { compilerOptions: { allowJs: true, strict: false, skipLibCheck: true }, skipAddingFilesFromTsConfig: true };
    const project = new ts_morph_1.Project(opts);
    project.addSourceFilesAtPaths(absPaths);
    return project;
}
// Collect the changed files + their direct imports (for type resolution context).
function collectContext(changedPaths, cwd, cache) {
    const context = new Set(changedPaths);
    for (const abs of changedPaths) {
        // Try cached import list first (fast)
        const rel = toRel(cwd, abs);
        const cached = cache.files[rel];
        if (cached) {
            for (const dep of cached.importsFrom) {
                const depAbs = path.join(cwd, dep);
                if (fs.existsSync(depAbs))
                    context.add(depAbs);
            }
        }
        // Also scan the file directly (it may have new imports not in cache)
        for (const spec of (0, files_1.extractRawImports)(abs)) {
            const resolved = (0, files_1.resolveImportPath)(abs, spec);
            if (resolved)
                context.add(resolved);
        }
    }
    return context;
}
function reanalyzeFiles(changedPaths, project, cwd, cache) {
    for (const abs of changedPaths) {
        const rel = toRel(cwd, abs);
        const sf = project.getSourceFile(abs);
        if (!sf)
            continue;
        let mtime = 0;
        try {
            mtime = fs.statSync(abs).mtimeMs;
        }
        catch { /* ignore */ }
        const exportNames = [];
        const symbols = [];
        const symbolsSeen = new Set();
        for (const [name, decls] of sf.getExportedDeclarations()) {
            const decl = decls[0];
            if (!decl)
                continue;
            const defFile = decl.getSourceFile().getFilePath();
            if (defFile.includes('node_modules'))
                continue;
            exportNames.push(name);
            const defRel = toRel(cwd, defFile);
            const displayName = getDisplayName(name, defRel);
            const key = `${displayName}@${defRel}`;
            if (!symbolsSeen.has(key)) {
                symbolsSeen.add(key);
                symbols.push({
                    name: displayName,
                    file: defRel,
                    line: decl.getStartLineNumber(),
                    kind: getKind(decl),
                    signature: getSignature(decl),
                });
            }
        }
        const importsFrom = [];
        for (const imp of sf.getImportDeclarations()) {
            const spec = imp.getModuleSpecifierValue();
            if (!spec.startsWith('.'))
                continue;
            const resolved = imp.getModuleSpecifierSourceFile()?.getFilePath() ??
                (0, files_1.resolveImportPath)(abs, spec) ??
                null;
            if (resolved && !resolved.includes('node_modules')) {
                importsFrom.push(toRel(cwd, resolved));
            }
        }
        cache.files[rel] = { mtime, exports: exportNames, importsFrom, symbols };
    }
}
function processExports(sf, relPath, cwd, exportsMap, symbols, symbolsSeen) {
    const exported = sf.getExportedDeclarations();
    const names = [];
    for (const [name, decls] of exported) {
        names.push(name);
        const decl = decls[0];
        if (!decl)
            continue;
        const defFile = toRel(cwd, decl.getSourceFile().getFilePath());
        const displayName = getDisplayName(name, defFile);
        const key = `${displayName}@${defFile}`;
        if (!symbolsSeen.has(key) && !defFile.includes('node_modules')) {
            symbolsSeen.add(key);
            symbols.push({
                name: displayName,
                file: defFile,
                line: decl.getStartLineNumber(),
                kind: getKind(decl),
                signature: getSignature(decl),
            });
        }
    }
    if (names.length > 0)
        exportsMap.push({ file: relPath, names });
}
function processImports(sf, relPath, cwd, importsMap, importedBy) {
    const importedFiles = [];
    for (const imp of sf.getImportDeclarations()) {
        const spec = imp.getModuleSpecifierValue();
        if (!spec.startsWith('.'))
            continue;
        const resolved = imp.getModuleSpecifierSourceFile();
        if (!resolved)
            continue;
        const resolvedRel = toRel(cwd, resolved.getFilePath());
        if (resolvedRel.includes('node_modules'))
            continue;
        importedFiles.push(resolvedRel);
        const list = importedBy.get(resolvedRel) ?? [];
        list.push(relPath);
        importedBy.set(resolvedRel, list);
    }
    if (importedFiles.length > 0)
        importsMap.push({ file: relPath, importsFrom: importedFiles });
}
function buildCacheFromResult(cwd, sourceFiles, exportsMap, importsMap, symbols) {
    const exportsByFile = new Map(exportsMap.map(e => [e.file, e.names]));
    const importsByFile = new Map(importsMap.map(i => [i.file, i.importsFrom]));
    const symbolsByFile = new Map();
    for (const sym of symbols) {
        const list = symbolsByFile.get(sym.file) ?? [];
        list.push(sym);
        symbolsByFile.set(sym.file, list);
    }
    const files = {};
    for (const sf of sourceFiles) {
        const rel = toRel(cwd, sf.getFilePath());
        let mtime = 0;
        try {
            mtime = fs.statSync(sf.getFilePath()).mtimeMs;
        }
        catch { /* ignore */ }
        files[rel] = {
            mtime,
            exports: exportsByFile.get(rel) ?? [],
            importsFrom: importsByFile.get(rel) ?? [],
            symbols: symbolsByFile.get(rel) ?? [],
        };
    }
    return { version: 1, generatedAt: new Date().toISOString(), files };
}
function getKind(decl) {
    if (ts_morph_1.Node.isFunctionDeclaration(decl) || ts_morph_1.Node.isFunctionExpression(decl))
        return 'function';
    if (ts_morph_1.Node.isArrowFunction(decl))
        return 'function';
    if (ts_morph_1.Node.isClassDeclaration(decl))
        return 'class';
    if (ts_morph_1.Node.isInterfaceDeclaration(decl))
        return 'interface';
    if (ts_morph_1.Node.isTypeAliasDeclaration(decl))
        return 'type';
    if (ts_morph_1.Node.isEnumDeclaration(decl))
        return 'enum';
    if (ts_morph_1.Node.isVariableDeclaration(decl)) {
        const init = decl.getInitializer();
        if (init && (ts_morph_1.Node.isArrowFunction(init) || ts_morph_1.Node.isFunctionExpression(init)))
            return 'function';
        return 'const';
    }
    return 'value';
}
function getSignature(decl) {
    const MAX = 120;
    if (ts_morph_1.Node.isFunctionDeclaration(decl) || ts_morph_1.Node.isFunctionExpression(decl) || ts_morph_1.Node.isArrowFunction(decl)) {
        const params = decl.getParameters().map(p => p.getText()).join(', ');
        const ret = decl.getReturnTypeNode()?.getText() ?? simplifyReturnType(decl.getReturnType().getText());
        const sig = `(${params}) => ${ret}`;
        return sig.length > MAX ? sig.slice(0, MAX) + '…' : sig;
    }
    if (ts_morph_1.Node.isVariableDeclaration(decl)) {
        const init = decl.getInitializer();
        if (init && (ts_morph_1.Node.isArrowFunction(init) || ts_morph_1.Node.isFunctionExpression(init))) {
            const params = init.getParameters().map(p => p.getText()).join(', ');
            const ret = init.getReturnTypeNode()?.getText() ?? simplifyReturnType(init.getReturnType().getText());
            const sig = `(${params}) => ${ret}`;
            return sig.length > MAX ? sig.slice(0, MAX) + '…' : sig;
        }
        const t = simplifyReturnType(decl.getType().getText());
        return t.length > MAX ? t.slice(0, MAX) + '…' : t;
    }
    return undefined;
}
// Fix 1: per i default export usa il basename del file come nome nel symbol index.
// Così i componenti React sono cercabili per nome ("Calculator") invece di "default".
function getDisplayName(exportName, defRelPath) {
    if (exportName !== 'default')
        return exportName;
    const base = path.basename(defRelPath, path.extname(defRelPath));
    // Per i barrel file (index.ts), usa il nome della directory padre
    if (base === 'index')
        return path.basename(path.dirname(defRelPath));
    return base;
}
// Fix 2: il TypeScript compiler risolve i return type JSX in path assoluti verso
// node_modules. Li sostituiamo con JSX.Element che è leggibile e non locale.
function simplifyReturnType(text) {
    if (text.includes('node_modules') && (text.includes('@types/react') || text.includes('/react'))) {
        return 'JSX.Element';
    }
    if (text.startsWith('{') && text.length > 60)
        return '{…}';
    return text;
}
function toRel(cwd, absPath) {
    return path.relative(cwd, absPath).replace(/\\/g, '/');
}
//# sourceMappingURL=analyzer.js.map