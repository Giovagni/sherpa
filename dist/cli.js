"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const generate_1 = require("./commands/generate");
const init_1 = require("./commands/init");
const status_1 = require("./commands/status");
const stats_1 = require("./commands/stats");
const program = new commander_1.Command();
program
    .name('astmap')
    .description('Static analysis index for AI coding tools')
    .version('0.1.0');
program
    .command('generate')
    .description('Generate .claude/manifest.md from source analysis')
    .option('--cwd <path>', 'Project root directory', process.cwd())
    .option('--full', 'Force full re-analysis (skip incremental cache)')
    .option('--all-symbols', 'Include string-literal constants and barrel re-exports (default: filtered out)')
    .action(generate_1.generateCommand);
program
    .command('init')
    .description('Generate manifest + install git post-commit hook')
    .option('--cwd <path>', 'Project root directory', process.cwd())
    .action(init_1.initCommand);
program
    .command('status')
    .description('Exit 1 if manifest is stale (useful in CI)')
    .option('--cwd <path>', 'Project root directory', process.cwd())
    .action(status_1.statusCommand);
program
    .command('stats')
    .description('Show token count and size of generated manifest')
    .option('--cwd <path>', 'Project root directory', process.cwd())
    .action(stats_1.statsCommand);
program.parse();
//# sourceMappingURL=cli.js.map