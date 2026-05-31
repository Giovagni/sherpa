import * as path from 'path';
import { isManifestStale } from '../core/git';

interface StatusOptions {
  cwd: string;
}

export function statusCommand(opts: StatusOptions): void {
  const cwd = path.resolve(opts.cwd);
  const manifestPath = path.join(cwd, '.claude', 'manifest.md');
  const stale = isManifestStale(cwd, manifestPath);

  if (stale) {
    console.log('astmap: manifest is STALE — run `astmap generate` to update');
    process.exit(1);
  } else {
    console.log('astmap: manifest is up to date');
    process.exit(0);
  }
}
