import * as fs from 'fs';
import * as path from 'path';
import { generateCommand } from './generate';
import { installPostCommitHook } from '../core/git';

interface InitOptions {
  cwd: string;
}

const GITIGNORE_LINES = [
  '# astmap — local manifest (generated, not committed)',
  '.claude/manifest.md',
  '.claude/manifest.cache.json',
];

const CLAUDE_MD_SNIPPET = `
## Codebase Index

See @.claude/manifest.md for symbol definitions, exports, and dependency graph.
Run \`astmap init\` once to generate it locally (the file is gitignored — each developer generates their own).
`;

export async function initCommand(opts: InitOptions): Promise<void> {
  const cwd = path.resolve(opts.cwd);

  // 1. Generate manifest
  await generateCommand(opts);

  // 2. Auto-patch .gitignore so the manifest is never committed
  patchGitignore(cwd);

  // 3. Install git hook
  const hookResult = installPostCommitHook(cwd);
  console.log(`astmap: ${hookResult.message}`);

  // 4. Suggest CLAUDE.md update
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

function patchGitignore(cwd: string): void {
  const gitignorePath = path.join(cwd, '.gitignore');
  const existing = fs.existsSync(gitignorePath)
    ? fs.readFileSync(gitignorePath, 'utf8')
    : '';

  const toAdd = GITIGNORE_LINES.filter(line =>
    line.startsWith('#') || !existing.includes(line)
  );

  if (toAdd.length === 0) {
    console.log('astmap: .gitignore already contains manifest entries — skipping.');
    return;
  }

  const separator = existing.endsWith('\n') || existing === '' ? '' : '\n';
  fs.writeFileSync(gitignorePath, existing + separator + toAdd.join('\n') + '\n', 'utf8');
  console.log('astmap: added manifest entries to .gitignore (manifest will not be committed).');
}
