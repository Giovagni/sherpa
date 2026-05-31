"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.initCommand = initCommand;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const generate_1 = require("./generate");
const git_1 = require("../core/git");
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
async function initCommand(opts) {
    const cwd = path.resolve(opts.cwd);
    // 1. Generate manifest
    await (0, generate_1.generateCommand)(opts);
    // 2. Auto-patch .gitignore so the manifest is never committed
    patchGitignore(cwd);
    // 3. Install git hook
    const hookResult = (0, git_1.installPostCommitHook)(cwd);
    console.log(`astmap: ${hookResult.message}`);
    // 4. Suggest CLAUDE.md update
    const claudeMdPath = path.join(cwd, 'CLAUDE.md');
    if (fs.existsSync(claudeMdPath)) {
        const content = fs.readFileSync(claudeMdPath, 'utf8');
        if (!content.includes('manifest.md')) {
            console.log('\nastmap: add this to your CLAUDE.md to activate the index:');
            console.log(CLAUDE_MD_SNIPPET);
        }
    }
    else {
        console.log('\nastmap: no CLAUDE.md found. Add this snippet to get started:');
        console.log(CLAUDE_MD_SNIPPET);
    }
}
function patchGitignore(cwd) {
    const gitignorePath = path.join(cwd, '.gitignore');
    const existing = fs.existsSync(gitignorePath)
        ? fs.readFileSync(gitignorePath, 'utf8')
        : '';
    const toAdd = GITIGNORE_LINES.filter(line => line.startsWith('#') || !existing.includes(line));
    if (toAdd.length === 0) {
        console.log('astmap: .gitignore already contains manifest entries — skipping.');
        return;
    }
    const separator = existing.endsWith('\n') || existing === '' ? '' : '\n';
    fs.writeFileSync(gitignorePath, existing + separator + toAdd.join('\n') + '\n', 'utf8');
    console.log('astmap: added manifest entries to .gitignore (manifest will not be committed).');
}
//# sourceMappingURL=init.js.map