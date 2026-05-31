import { Command } from 'commander';
import { generateCommand } from './commands/generate';
import { initCommand } from './commands/init';
import { statusCommand } from './commands/status';
import { statsCommand } from './commands/stats';
import { watchCommand } from './commands/watch';

const program = new Command();

program
  .name('sherpa')
  .description('Pre-computed codebase index for AI coding tools')
  .version('0.2.0');

program
  .command('generate')
  .description('Generate .claude/manifest.md from source analysis')
  .option('--cwd <path>', 'Project root directory', process.cwd())
  .option('--full', 'Force full re-analysis (skip incremental cache)')
  .option('--all-symbols', 'Include string-literal constants and barrel re-exports (default: filtered out)')
  .action(generateCommand);

program
  .command('init')
  .description('Generate manifest + install git post-commit hook')
  .option('--cwd <path>', 'Project root directory', process.cwd())
  .action(initCommand);

program
  .command('status')
  .description('Exit 1 if manifest is stale (useful in CI)')
  .option('--cwd <path>', 'Project root directory', process.cwd())
  .action(statusCommand);

program
  .command('stats')
  .description('Show token count and size of generated manifest')
  .option('--cwd <path>', 'Project root directory', process.cwd())
  .action(statsCommand);

program
  .command('watch')
  .description('Watch for file changes and regenerate manifest automatically')
  .option('--cwd <path>', 'Project root directory', process.cwd())
  .action(watchCommand);

program.parse();
