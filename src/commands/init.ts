import * as fs from 'fs';
import * as path from 'path';
import { generateCommand } from './generate';
import { installPostCommitHook } from '../core/git';

interface InitOptions {
  cwd: string;
}

const CLAUDE_MD_SNIPPET = `
## Codebase Index

See @.claude/manifest.md for symbol definitions, exports, and dependency graph.
`;

export async function initCommand(opts: InitOptions): Promise<void> {
  const cwd = path.resolve(opts.cwd);

  // 1. Generate manifest
  await generateCommand(opts);

  // 2. Install git hook
  const hookResult = installPostCommitHook(cwd);
  console.log(`astmap: ${hookResult.message}`);

  // 3. Suggest CLAUDE.md update
  const claudeMdPath = path.join(cwd, 'CLAUDE.md');
  if (fs.existsSync(claudeMdPath)) {
    const content = fs.readFileSync(claudeMdPath, 'utf8');
    if (!content.includes('manifest.md')) {
      console.log('\nastmap: add this to your CLAUDE.md to activate the index:');
      console.log(CLAUDE_MD_SNIPPET);
    }
  } else {
    console.log('\nastmap: no CLAUDE.md found. Add this snippet to get started:');
    console.log(CLAUDE_MD_SNIPPET);
  }
}
