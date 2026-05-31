import { AnalysisResult } from './analyzer';
export interface ManifestOptions {
    allSymbols?: boolean;
}
export declare function generateManifest(result: AnalysisResult, generatedAt?: Date, opts?: ManifestOptions): string;
