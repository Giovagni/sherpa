import * as fs from 'fs';
import * as path from 'path';
import { SymbolEntry, FileExports, FileImports, AnalysisResult } from './analyzer';

export interface FileCache {
  mtime: number;
  exports: string[];
  importsFrom: string[];
  symbols: SymbolEntry[];
}

export interface ManifestCache {
  version: number;
  generatedAt: string;
  files: Record<string, FileCache>;
}

const CACHE_VERSION = 1;

export function loadCache(cwd: string): ManifestCache {
  try {
    const raw = fs.readFileSync(getCacheFile(cwd), 'utf8');
    const parsed = JSON.parse(raw) as ManifestCache;
    if (parsed.version !== CACHE_VERSION) return emptyCache();
    return parsed;
  } catch {
    return emptyCache();
  }
}

export function saveCache(cwd: string, cache: ManifestCache): void {
  const file = getCacheFile(cwd);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(cache, null, 2), 'utf8');
}

export function reconstructFromCache(cache: ManifestCache): AnalysisResult {
  const exportsMap: FileExports[] = [];
  const importsMap: FileImports[] = [];
  const importedBy = new Map<string, string[]>();
  const symbols: SymbolEntry[] = [];

  for (const [rel, fc] of Object.entries(cache.files)) {
    if (fc.exports.length > 0) exportsMap.push({ file: rel, names: fc.exports });
    if (fc.importsFrom.length > 0) {
      importsMap.push({ file: rel, importsFrom: fc.importsFrom });
      for (const dep of fc.importsFrom) {
        const list = importedBy.get(dep) ?? [];
        list.push(rel);
        importedBy.set(dep, list);
      }
    }
    symbols.push(...fc.symbols);
  }

  return {
    files: Object.keys(cache.files).length,
    exports: exportsMap,
    imports: importsMap,
    importedBy,
    symbols,
  };
}

export function getCacheFile(cwd: string): string {
  return path.join(cwd, '.claude', 'manifest.cache.json');
}

function emptyCache(): ManifestCache {
  return { version: CACHE_VERSION, generatedAt: new Date().toISOString(), files: {} };
}
