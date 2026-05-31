export declare function findSourceFiles(cwd: string): string[];
export declare function loadIgnorePatterns(cwd: string): string[];
export declare function matchesIgnore(relPath: string, patterns: string[]): boolean;
export declare function resolveImportPath(fromFile: string, spec: string): string | null;
export declare function extractRawImports(absPath: string): string[];
