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
exports.installPostCommitHook = installPostCommitHook;
exports.isManifestStale = isManifestStale;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const files_1 = require("./files");
const HOOK_SCRIPT = `#!/bin/sh
# sherpa post-commit hook — regenerate manifest on every commit
sherpa generate --cwd "$(git rev-parse --show-toplevel)"
`;
function installPostCommitHook(cwd) {
    const hooksDir = path.join(cwd, ".git", "hooks");
    const hookPath = path.join(hooksDir, "post-commit");
    if (!fs.existsSync(hooksDir)) {
        return {
            installed: false,
            message: "No .git/hooks directory found — is this a git repo?",
        };
    }
    if (fs.existsSync(hookPath)) {
        const existing = fs.readFileSync(hookPath, "utf8");
        if (existing.includes("sherpa generate")) {
            return {
                installed: false,
                message: "post-commit hook already contains sherpa — skipping.",
            };
        }
        fs.appendFileSync(hookPath, "\n" + HOOK_SCRIPT);
        fs.chmodSync(hookPath, 0o755);
        return {
            installed: true,
            message: "Appended sherpa to existing post-commit hook.",
        };
    }
    fs.writeFileSync(hookPath, HOOK_SCRIPT, { mode: 0o755 });
    return {
        installed: true,
        message: "Installed post-commit hook at .git/hooks/post-commit",
    };
}
function isManifestStale(cwd, manifestPath) {
    if (!fs.existsSync(manifestPath))
        return true;
    const manifestMtime = fs.statSync(manifestPath).mtimeMs;
    for (const file of (0, files_1.findSourceFiles)(cwd)) {
        try {
            if (fs.statSync(file).mtimeMs > manifestMtime)
                return true;
        }
        catch {
            // ignore
        }
    }
    return false;
}
//# sourceMappingURL=git.js.map