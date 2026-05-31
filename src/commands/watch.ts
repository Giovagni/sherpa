import * as fs from 'fs';
import * as path from 'path';
import { runGenerate } from './generate';

interface WatchOptions {
  cwd: string;
}

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const DEBOUNCE_MS = 200;

export async function watchCommand(opts: WatchOptions): Promise<void> {
  const cwd = path.resolve(opts.cwd);

  console.log('astmap: watch mode — running initial analysis…');
  await runGenerate(cwd);
  console.log('astmap: watching for changes (Ctrl+C to stop)…');

  let timer: ReturnType<typeof setTimeout> | null = null;

  const watcher = fs.watch(cwd, { recursive: true }, (_event, filename) => {
    if (!filename) return;
    if (!SOURCE_EXTENSIONS.has(path.extname(filename))) return;
    // Ignore generated/non-source paths
    if (
      filename.includes('node_modules') ||
      filename.startsWith('.claude/') ||
      filename.startsWith('dist/')
    ) return;

    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      const rel = path.relative(cwd, path.join(cwd, filename));
      console.log(`\nastmap: change detected in ${rel}`);
      await runGenerate(cwd);
    }, DEBOUNCE_MS);
  });

  watcher.on('error', (err) => {
    console.error('astmap: watcher error —', err.message);
  });

  process.on('SIGINT', () => {
    watcher.close();
    console.log('\nastmap: watch stopped.');
    process.exit(0);
  });

  // Keep process alive
  await new Promise(() => { /* runs until SIGINT */ });
}
