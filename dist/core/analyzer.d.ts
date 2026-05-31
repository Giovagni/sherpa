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
export declare function analyze(cwd: string): AnalysisResult;
export declare function analyzeIncremental(cwd: string): {
    result: AnalysisResult;
    changed: number;
    cached: number;
};
