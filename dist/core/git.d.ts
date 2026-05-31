export declare function installPostCommitHook(cwd: string): {
    installed: boolean;
    message: string;
};
export declare function isManifestStale(cwd: string, manifestPath: string): boolean;
