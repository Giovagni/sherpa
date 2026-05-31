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
exports.generateCommand = generateCommand;
exports.runGenerate = runGenerate;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const analyzer_1 = require("../core/analyzer");
const manifest_1 = require("../core/manifest");
const config_1 = require("../core/config");
const tokens_1 = require("../core/tokens");
async function generateCommand(opts) {
    const cwd = path.resolve(opts.cwd);
    await runGenerate(cwd, { full: opts.full, allSymbols: opts.allSymbols });
}
// Shared by generateCommand and watchCommand.
async function runGenerate(cwd, opts = {}) {
    const start = Date.now();
    const config = (0, config_1.loadConfig)(cwd);
    let result;
    if (opts.full) {
        console.log(`sherpa: full analysis of ${cwd}…`);
        result = (0, analyzer_1.analyze)(cwd);
    }
    else {
        const { result: r, changed, cached } = (0, analyzer_1.analyzeIncremental)(cwd);
        result = r;
        const mode = changed === 0
            ? `incremental (${cached} files cached, 0 changed)`
            : `incremental (${cached} cached, ${changed} re-analyzed)`;
        console.log(`sherpa: ${mode}`);
    }
    const manifest = (0, manifest_1.generateManifest)(result, new Date(), {
        allSymbols: opts.allSymbols,
        aliases: config.aliases,
    });
    const outDir = path.join(cwd, '.claude');
    const outPath = path.join(outDir, 'manifest.md');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(outPath, manifest, 'utf8');
    const elapsed = Date.now() - start;
    const tokens = (0, tokens_1.estimateTokens)(manifest);
    console.log(`sherpa: wrote ${outPath}`);
    console.log(`  files: ${result.files} | symbols: ${result.symbols.length} | ~${tokens} tokens | ${elapsed}ms`);
    if (tokens > tokens_1.TOKEN_WARN_THRESHOLD) {
        console.warn(`  warning: manifest exceeds ${tokens_1.TOKEN_WARN_THRESHOLD} tokens — consider adding filters`);
    }
}
//# sourceMappingURL=generate.js.map