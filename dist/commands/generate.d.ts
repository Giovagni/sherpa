interface GenerateOptions {
    cwd: string;
    full?: boolean;
    allSymbols?: boolean;
}
export declare function generateCommand(opts: GenerateOptions): Promise<void>;
export {};
