import * as fs from 'fs';
import * as path from 'path';
import { analyze, analyzeIncremental, AnalysisResult } from '../core/analyzer';
import { generateManifest } from '../core/manifest';
import { estimateTokens, TOKEN_WARN_THRESHOLD } from '../core/tokens';

interface GenerateOptions {
  cwd: string;
  full?: boolean;
  allSymbols?: boolean;
}

export async function generateCommand(opts: GenerateOptions): Promise<void> {
  const cwd = path.resolve(opts.cwd);
  const start = Date.now();

  let result: AnalysisResult;
  let mode: string;

  if (opts.full) {
    console.log(`astmap: full analysis of ${cwd}…`);
    result = analyze(cwd);
    mode = 'full';
  } else {
    const { result: r, changed, cached } = analyzeIncremental(cwd);
    result = r;
    if (changed === 0) {
      mode = `incremental (${cached} files cached, 0 changed)`;
    } else {
      mode = `incremental (${cached} cached, ${changed} re-analyzed)`;
    }
    console.log(`astmap: ${mode}`);
  }

  const manifest = generateManifest(result, new Date(), { allSymbols: opts.allSymbols });
  const outDir = path.join(cwd, '.claude');
  const outPath = path.join(outDir, 'manifest.md');

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, manifest, 'utf8');

  const elapsed = Date.now() - start;
  const tokens = estimateTokens(manifest);

  console.log(`astmap: wrote ${outPath}`);
  console.log(`  files: ${result.files} | symbols: ${result.symbols.length} | ~${tokens} tokens | ${elapsed}ms`);

  if (tokens > TOKEN_WARN_THRESHOLD) {
    console.warn(`  warning: manifest exceeds ${TOKEN_WARN_THRESHOLD} tokens — consider adding filters`);
  }
}
