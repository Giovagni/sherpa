export interface AstmapConfig {
    aliases: Array<[prefix: string, alias: string]>;
}
export declare function loadConfig(cwd: string): AstmapConfig;
