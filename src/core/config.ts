import * as fs from 'fs';
import * as path from 'path';

export interface AstmapConfig {
  // [realPathPrefix, shortAlias] — same tuple shape used by manifest.ts
  aliases: Array<[prefix: string, alias: string]>;
}

// Kept as fallback so existing projects without astmap.config.json
// still get the $lib/ alias for src/components/library/.
const DEFAULT_ALIASES: Array<[prefix: string, alias: string]> = [
  ['src/components/library/', '$lib/'],
];

export function loadConfig(cwd: string): AstmapConfig {
  const configPath = path.join(cwd, 'astmap.config.json');
  try {
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (raw.aliases && typeof raw.aliases === 'object' && !Array.isArray(raw.aliases)) {
      // Config format: { "aliases": { "$lib/": "src/components/library/" } }
      // Key = short alias, value = real path prefix.
      const aliases: Array<[string, string]> = Object.entries(raw.aliases)
        .map(([alias, prefix]) => [prefix as string, alias]);
      return { aliases };
    }
  } catch {
    // No config file or parse error — use defaults.
  }
  return { aliases: DEFAULT_ALIASES };
}
