import * as fs from 'fs';
import * as path from 'path';
import { estimateTokens, TOKEN_WARN_THRESHOLD } from '../core/tokens';

interface StatsOptions {
  cwd: string;
}

export function statsCommand(opts: StatsOptions): void {
  const cwd = path.resolve(opts.cwd);
  const manifestPath = path.join(cwd, '.claude', 'manifest.md');

  if (!fs.existsSync(manifestPath)) {
    console.error('astmap: no manifest found — run `astmap generate` first');
    process.exit(1);
  }

  const content = fs.readFileSync(manifestPath, 'utf8');
  const tokens = estimateTokens(content);
  const bytes = Buffer.byteLength(content, 'utf8');
  const lines = content.split('\n').length;

  console.log(`astmap stats:`);
  console.log(`  path:   ${manifestPath}`);
  console.log(`  size:   ${(bytes / 1024).toFixed(1)} KB`);
  console.log(`  lines:  ${lines}`);
  console.log(`  tokens: ~${tokens.toLocaleString()}`);

  if (tokens > TOKEN_WARN_THRESHOLD) {
    console.warn(`  warning: exceeds recommended ${TOKEN_WARN_THRESHOLD.toLocaleString()} token budget`);
  }
}
