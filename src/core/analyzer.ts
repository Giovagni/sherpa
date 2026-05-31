import {
  Project,
  Node,
  SourceFile,
  ExportedDeclarations,
  ProjectOptions,
} from 'ts-morph';
import * as path from 'path';
import * as fs from 'fs';
import { findSourceFiles, resolveImportPath, extractRawImports, loadIgnorePatterns, matchesIgnore } from './files';
import { loadCache, saveCache, reconstructFromCache, ManifestCache } from './cache';

export interface FileExports {
  file: string;
  names: string[];
}

export interface FileImports {
  file: string;
  importsFrom: string[];
}

export interface SymbolEntry {
  name: string;
  file: string;
  line: number;
  kind: string;
  signature?: string;
}

export interface AnalysisResult {
  files: number;
  exports: FileExports[];
  imports: FileImports[];
  importedBy: Map<string, string[]>;
  symbols: SymbolEntry[];
}

// Full analysis — loads all source files via ts-morph for accurate types.
export function analyze(cwd: string): AnalysisResult {
  const project = buildProject(cwd);
  const ignorePatterns = loadIgnorePatterns(cwd);
  const sourceFiles = project.getSourceFiles().filter(sf => {
    const fp = sf.getFilePath();
    if (fp.includes('/node_modules/') || fp.includes('/dist/')) return false;
    if (ignorePatterns.length === 0) return true;
    return !matchesIgnore(toRel(cwd, fp), ignorePatterns);
  });

  const exportsMap: FileExports[] = [];
  const importsMap: FileImports[] = [];
  const importedBy = new Map<string, string[]>();
  const symbolsSeen = new Set<string>();
  const symbols: SymbolEntry[] = [];

  for (const sf of sourceFiles) {
    const rel = toRel(cwd, sf.getFilePath());
    processExports(sf, rel, cwd, exportsMap, symbols, symbolsSeen);
    processImports(sf, rel, cwd, importsMap, importedBy);
  }

  // Write cache after full analysis
  const cache = buildCacheFromResult(cwd, sourceFiles, exportsMap, importsMap, symbols);
  saveCache(cwd, cache);

  return { files: sourceFiles.length, exports: exportsMap, imports: importsMap, importedBy, symbols };
}

// Incremental analysis — only re-parses changed files, uses cache for the rest.
// Falls back to full analysis if no cache exists.
export function analyzeIncremental(cwd: string): { result: AnalysisResult; changed: number; cached: number } {
  const cache = loadCache(cwd);
  const allFiles = findSourceFiles(cwd);

  const changedPaths: string[] = [];
  const currentRels = new Set<string>();

  for (const abs of allFiles) {
    const rel = toRel(cwd, abs);
    currentRels.add(rel);
    try {
      const mtime = fs.statSync(abs).mtimeMs;
      if (!cache.files[rel] || cache.files[rel].mtime !== mtime) {
        changedPaths.push(abs);
      }
    } catch {
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
      saveCache(cwd, cache);
    }
    return { result: reconstructFromCache(cache), changed: 0, cached: Object.keys(cache.files).length };
  }

  // Some files changed — build a mini project with changed files + their local imports
  const contextPaths = collectContext(changedPaths, cwd, cache);
  const project = buildProjectForFiles(cwd, [...contextPaths]);

  reanalyzeFiles(changedPaths, project, cwd, cache);

  cache.generatedAt = new Date().toISOString();
  saveCache(cwd, cache);

  return {
    result: reconstructFromCache(cache),
    changed: changedPaths.length,
    cached: Object.keys(cache.files).length - changedPaths.length,
  };
}

// ── helpers ──────────────────────────────────────────────────────────────────

function buildProject(cwd: string): Project {
  const tsconfigPath = path.join(cwd, 'tsconfig.json');
  const hasTsconfig = fs.existsSync(tsconfigPath);

  const opts: ProjectOptions = hasTsconfig
    ? { tsConfigFilePath: tsconfigPath, skipAddingFilesFromTsConfig: false }
    : { compilerOptions: { allowJs: true, strict: false }, skipAddingFilesFromTsConfig: true };

  const project = new Project(opts);

  if (!hasTsconfig) {
    project.addSourceFilesAtPaths(findSourceFiles(cwd));
  }

  return project;
}

function buildProjectForFiles(cwd: string, absPaths: string[]): Project {
  const tsconfigPath = path.join(cwd, 'tsconfig.json');
  const hasTsconfig = fs.existsSync(tsconfigPath);

  const opts: ProjectOptions = hasTsconfig
    ? { tsConfigFilePath: tsconfigPath, skipAddingFilesFromTsConfig: true }
    : { compilerOptions: { allowJs: true, strict: false, skipLibCheck: true }, skipAddingFilesFromTsConfig: true };

  const project = new Project(opts);
  project.addSourceFilesAtPaths(absPaths);
  return project;
}

// Collect the changed files + their direct imports (for type resolution context).
function collectContext(changedPaths: string[], cwd: string, cache: ManifestCache): Set<string> {
  const context = new Set<string>(changedPaths);

  for (const abs of changedPaths) {
    // Try cached import list first (fast)
    const rel = toRel(cwd, abs);
    const cached = cache.files[rel];
    if (cached) {
      for (const dep of cached.importsFrom) {
        const depAbs = path.join(cwd, dep);
        if (fs.existsSync(depAbs)) context.add(depAbs);
      }
    }
    // Also scan the file directly (it may have new imports not in cache)
    for (const spec of extractRawImports(abs)) {
      const resolved = resolveImportPath(abs, spec);
      if (resolved) context.add(resolved);
    }
  }

  return context;
}

function reanalyzeFiles(changedPaths: string[], project: Project, cwd: string, cache: ManifestCache): void {
  for (const abs of changedPaths) {
    const rel = toRel(cwd, abs);
    const sf = project.getSourceFile(abs);
    if (!sf) continue;

    let mtime = 0;
    try { mtime = fs.statSync(abs).mtimeMs; } catch { /* ignore */ }

    const exportNames: string[] = [];
    const symbols: SymbolEntry[] = [];
    const symbolsSeen = new Set<string>();

    for (const [name, decls] of sf.getExportedDeclarations()) {
      const decl = decls[0];
      if (!decl) continue;
      const defFile = decl.getSourceFile().getFilePath();
      if (defFile.includes('node_modules')) continue;

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

    const importsFrom: string[] = [];
    for (const imp of sf.getImportDeclarations()) {
      const spec = imp.getModuleSpecifierValue();
      if (!spec.startsWith('.')) continue;
      const resolved =
        imp.getModuleSpecifierSourceFile()?.getFilePath() ??
        resolveImportPath(abs, spec) ??
        null;
      if (resolved && !resolved.includes('node_modules')) {
        importsFrom.push(toRel(cwd, resolved));
      }
    }

    cache.files[rel] = { mtime, exports: exportNames, importsFrom, symbols };
  }
}

function processExports(
  sf: SourceFile,
  relPath: string,
  cwd: string,
  exportsMap: FileExports[],
  symbols: SymbolEntry[],
  symbolsSeen: Set<string>
) {
  const exported = sf.getExportedDeclarations();
  const names: string[] = [];

  for (const [name, decls] of exported) {
    names.push(name);
    const decl = decls[0];
    if (!decl) continue;

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

  if (names.length > 0) exportsMap.push({ file: relPath, names });
}

function processImports(
  sf: SourceFile,
  relPath: string,
  cwd: string,
  importsMap: FileImports[],
  importedBy: Map<string, string[]>
) {
  const importedFiles: string[] = [];

  for (const imp of sf.getImportDeclarations()) {
    const spec = imp.getModuleSpecifierValue();
    if (!spec.startsWith('.')) continue;

    const resolved = imp.getModuleSpecifierSourceFile();
    if (!resolved) continue;

    const resolvedRel = toRel(cwd, resolved.getFilePath());
    if (resolvedRel.includes('node_modules')) continue;

    importedFiles.push(resolvedRel);
    const list = importedBy.get(resolvedRel) ?? [];
    list.push(relPath);
    importedBy.set(resolvedRel, list);
  }

  if (importedFiles.length > 0) importsMap.push({ file: relPath, importsFrom: importedFiles });
}

function buildCacheFromResult(
  cwd: string,
  sourceFiles: SourceFile[],
  exportsMap: FileExports[],
  importsMap: FileImports[],
  symbols: SymbolEntry[]
): ManifestCache {
  const exportsByFile = new Map(exportsMap.map(e => [e.file, e.names]));
  const importsByFile = new Map(importsMap.map(i => [i.file, i.importsFrom]));
  const symbolsByFile = new Map<string, SymbolEntry[]>();

  for (const sym of symbols) {
    const list = symbolsByFile.get(sym.file) ?? [];
    list.push(sym);
    symbolsByFile.set(sym.file, list);
  }

  const files: ManifestCache['files'] = {};

  for (const sf of sourceFiles) {
    const rel = toRel(cwd, sf.getFilePath());
    let mtime = 0;
    try { mtime = fs.statSync(sf.getFilePath()).mtimeMs; } catch { /* ignore */ }

    files[rel] = {
      mtime,
      exports: exportsByFile.get(rel) ?? [],
      importsFrom: importsByFile.get(rel) ?? [],
      symbols: symbolsByFile.get(rel) ?? [],
    };
  }

  return { version: 1, generatedAt: new Date().toISOString(), files };
}

function getKind(decl: ExportedDeclarations): string {
  if (Node.isFunctionDeclaration(decl) || Node.isFunctionExpression(decl)) return 'function';
  if (Node.isArrowFunction(decl)) return 'function';
  if (Node.isClassDeclaration(decl)) return 'class';
  if (Node.isInterfaceDeclaration(decl)) return 'interface';
  if (Node.isTypeAliasDeclaration(decl)) return 'type';
  if (Node.isEnumDeclaration(decl)) return 'enum';
  if (Node.isVariableDeclaration(decl)) {
    const init = decl.getInitializer();
    if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) return 'function';
    return 'const';
  }
  return 'value';
}

function getSignature(decl: ExportedDeclarations): string | undefined {
  const MAX = 120;

  if (Node.isFunctionDeclaration(decl) || Node.isFunctionExpression(decl) || Node.isArrowFunction(decl)) {
    const params = decl.getParameters().map(p => p.getText()).join(', ');
    const ret = decl.getReturnTypeNode()?.getText() ?? simplifyReturnType(decl.getReturnType().getText());
    const sig = `(${params}) => ${ret}`;
    return sig.length > MAX ? sig.slice(0, MAX) + '…' : sig;
  }

  if (Node.isVariableDeclaration(decl)) {
    const init = decl.getInitializer();
    if (init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init))) {
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
function getDisplayName(exportName: string, defRelPath: string): string {
  if (exportName !== 'default') return exportName;
  const base = path.basename(defRelPath, path.extname(defRelPath));
  // Per i barrel file (index.ts), usa il nome della directory padre
  if (base === 'index') return path.basename(path.dirname(defRelPath));
  return base;
}

// Fix 2: il TypeScript compiler risolve i return type JSX in path assoluti verso
// node_modules. Li sostituiamo con JSX.Element che è leggibile e non locale.
function simplifyReturnType(text: string): string {
  if (text.includes('node_modules') && (text.includes('@types/react') || text.includes('/react'))) {
    return 'JSX.Element';
  }
  if (text.startsWith('{') && text.length > 60) return '{…}';
  return text;
}

function toRel(cwd: string, absPath: string): string {
  return path.relative(cwd, absPath).replace(/\\/g, '/');
}
