interface GenerateOptions {
    cwd: string;
    full?: boolean;
    allSymbols?: boolean;
}
export declare function generateCommand(opts: GenerateOptions): Promise<void>;
export declare function runGenerate(cwd: string, opts?: {
    full?: boolean;
    allSymbols?: boolean;
}): Promise<void>;
export {};
