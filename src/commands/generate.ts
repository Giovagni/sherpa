import * as fs from 'fs';
import * as path from 'path';
import { analyze, analyzeIncremental, AnalysisResult } from '../core/analyzer';
import { generateManifest } from '../core/manifest';
import { loadConfig } from '../core/config';
import { estimateTokens, TOKEN_WARN_THRESHOLD } from '../core/tokens';

interface GenerateOptions {
  cwd: string;
  full?: boolean;
  allSymbols?: boolean;
}

export async function generateCommand(opts: GenerateOptions): Promise<void> {
  const cwd = path.resolve(opts.cwd);
  await runGenerate(cwd, { full: opts.full, allSymbols: opts.allSymbols });
}

// Shared by generateCommand and watchCommand.
export async function runGenerate(
  cwd: string,
  opts: { full?: boolean; allSymbols?: boolean } = {}
): Promise<void> {
  const start = Date.now();
  const config = loadConfig(cwd);

  let result: AnalysisResult;

  if (opts.full) {
    console.log(`astmap: full analysis of ${cwd}…`);
    result = analyze(cwd);
  } else {
    const { result: r, changed, cached } = analyzeIncremental(cwd);
    result = r;
    const mode = changed === 0
      ? `incremental (${cached} files cached, 0 changed)`
      : `incremental (${cached} cached, ${changed} re-analyzed)`;
    console.log(`astmap: ${mode}`);
  }

  const manifest = generateManifest(result, new Date(), {
    allSymbols: opts.allSymbols,
    aliases: config.aliases,
  });

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
