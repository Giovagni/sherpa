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
exports.watchCommand = watchCommand;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const generate_1 = require("./generate");
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const DEBOUNCE_MS = 200;
async function watchCommand(opts) {
    const cwd = path.resolve(opts.cwd);
    console.log('sherpa: watch mode — running initial analysis…');
    await (0, generate_1.runGenerate)(cwd);
    console.log('sherpa: watching for changes (Ctrl+C to stop)…');
    let timer = null;
    const watcher = fs.watch(cwd, { recursive: true }, (_event, filename) => {
        if (!filename)
            return;
        if (!SOURCE_EXTENSIONS.has(path.extname(filename)))
            return;
        // Ignore generated/non-source paths
        if (filename.includes('node_modules') ||
            filename.startsWith('.claude/') ||
            filename.startsWith('dist/'))
            return;
        if (timer)
            clearTimeout(timer);
        timer = setTimeout(async () => {
            const rel = path.relative(cwd, path.join(cwd, filename));
            console.log(`\nsherpa: change detected in ${rel}`);
            await (0, generate_1.runGenerate)(cwd);
        }, DEBOUNCE_MS);
    });
    watcher.on('error', (err) => {
        console.error('sherpa: watcher error —', err.message);
    });
    process.on('SIGINT', () => {
        watcher.close();
        console.log('\nsherpa: watch stopped.');
        process.exit(0);
    });
    // Keep process alive
    await new Promise(() => { });
}
//# sourceMappingURL=watch.js.map