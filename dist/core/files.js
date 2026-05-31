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
exports.isNodeModules = isNodeModules;
exports.findSourceFiles = findSourceFiles;
exports.loadIgnorePatterns = loadIgnorePatterns;
exports.matchesIgnore = matchesIgnore;
exports.resolveImportPath = resolveImportPath;
exports.extractRawImports = extractRawImports;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const IGNORE_DIRS = new Set(['node_modules', 'dist', '.git', '.next', 'build', 'out', 'coverage', '.turbo']);
function isNodeModules(p) {
    return p.includes('/node_modules/');
}
function findSourceFiles(cwd) {
    const roots = getRootsFromTsconfig(cwd);
    const ignorePatterns = loadIgnorePatterns(cwd);
    const results = [];
    for (const root of roots) {
        walk(root, cwd, ignorePatterns, results);
    }
    return results;
}
function loadIgnorePatterns(cwd) {
    try {
        const raw = fs.readFileSync(path.join(cwd, '.sherpaignore'), 'utf8');
        return raw
            .split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 0 && !l.startsWith('#'));
    }
    catch {
        return [];
    }
}
function matchesIgnore(relPath, patterns) {
    for (const p of patterns) {
        if (p.endsWith('/')) {
            if (relPath.startsWith(p))
                return true;
        }
        else if (p.startsWith('*.')) {
            if (relPath.endsWith(p.slice(1)))
                return true;
        }
        else if (p.includes('*')) {
            const regex = new RegExp('^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$');
            if (regex.test(relPath))
                return true;
        }
        else {
            if (relPath === p || relPath.startsWith(p + '/'))
                return true;
        }
    }
    return false;
}
function getRootsFromTsconfig(cwd) {
    const tsconfigPath = path.join(cwd, 'tsconfig.json');
    try {
        const raw = fs.readFileSync(tsconfigPath, 'utf8');
        const stripped = raw.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
        const tsconfig = JSON.parse(stripped);
        const co = tsconfig?.compilerOptions ?? {};
        if (co.rootDir) {
            const rootDir = path.resolve(cwd, co.rootDir);
            if (fs.existsSync(rootDir))
                return [rootDir];
        }
        const include = tsconfig?.include ?? [];
        const includeDirs = include
            .map((pattern) => {
            const parts = pattern.replace(/\\/g, '/').split('/').filter(p => p !== '' && p !== '.');
            return parts.length > 0 ? path.resolve(cwd, parts[0]) : cwd;
        })
            .filter((d) => fs.existsSync(d));
        if (includeDirs.length > 0)
            return [...new Set(includeDirs)];
    }
    catch {
        // no tsconfig or parse error
    }
    return [cwd];
}
function walk(dir, cwd, ignorePatterns, results) {
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    }
    catch {
        return;
    }
    for (const entry of entries) {
        if (IGNORE_DIRS.has(entry.name))
            continue;
        const full = path.join(dir, entry.name);
        const rel = path.relative(cwd, full).replace(/\\/g, '/');
        if (entry.isDirectory()) {
            // Check at directory level to avoid recursing into ignored paths
            if (!matchesIgnore(rel + '/', ignorePatterns)) {
                walk(full, cwd, ignorePatterns, results);
            }
        }
        else if (entry.isFile() &&
            SOURCE_EXTENSIONS.has(path.extname(entry.name)) &&
            !entry.name.endsWith('.d.ts') &&
            !matchesIgnore(rel, ignorePatterns)) {
            results.push(full);
        }
    }
}
function resolveImportPath(fromFile, spec) {
    const dir = path.dirname(fromFile);
    const base = path.resolve(dir, spec);
    const candidates = [
        base,
        base + '.ts', base + '.tsx', base + '.js', base + '.jsx',
        path.join(base, 'index.ts'), path.join(base, 'index.tsx'),
        path.join(base, 'index.js'), path.join(base, 'index.jsx'),
    ];
    for (const c of candidates) {
        try {
            if (fs.statSync(c).isFile())
                return c;
        }
        catch {
            // not found
        }
    }
    return null;
}
function extractRawImports(absPath) {
    try {
        const content = fs.readFileSync(absPath, 'utf8');
        const re = /(?:from\s+|require\s*\(\s*)['"](\.[^'"]+)['"]/g;
        return [...content.matchAll(re)].map(m => m[1]);
    }
    catch {
        return [];
    }
}
//# sourceMappingURL=files.js.map