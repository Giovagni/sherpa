import { SymbolEntry, AnalysisResult } from './analyzer';
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
export declare function loadCache(cwd: string): ManifestCache;
export declare function saveCache(cwd: string, cache: ManifestCache): void;
export declare function reconstructFromCache(cache: ManifestCache): AnalysisResult;
export declare function getCacheFile(cwd: string): string;
