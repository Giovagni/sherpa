import { AnalysisResult } from './analyzer';
export interface ManifestOptions {
    allSymbols?: boolean;
    aliases?: Array<[prefix: string, alias: string]>;
}
export declare function generateManifest(result: AnalysisResult, generatedAt?: Date, opts?: ManifestOptions): string;
