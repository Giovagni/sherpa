import * as fs from "fs";
import * as path from "path";
import { findSourceFiles } from "./files";

const HOOK_SCRIPT = `#!/bin/sh
# astmap post-commit hook — regenerate manifest on every commit
astmap generate --cwd "$(git rev-parse --show-toplevel)"
`;

export function installPostCommitHook(cwd: string): {
  installed: boolean;
  message: string;
} {
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
    if (existing.includes("astmap generate")) {
      return {
        installed: false,
        message: "post-commit hook already contains astmap — skipping.",
      };
    }
    fs.appendFileSync(hookPath, "\n" + HOOK_SCRIPT);
    fs.chmodSync(hookPath, 0o755);
    return {
      installed: true,
      message: "Appended astmap to existing post-commit hook.",
    };
  }

  fs.writeFileSync(hookPath, HOOK_SCRIPT, { mode: 0o755 });
  return {
    installed: true,
    message: "Installed post-commit hook at .git/hooks/post-commit",
  };
}

export function isManifestStale(cwd: string, manifestPath: string): boolean {
  if (!fs.existsSync(manifestPath)) return true;

  const manifestMtime = fs.statSync(manifestPath).mtimeMs;

  for (const file of findSourceFiles(cwd)) {
    try {
      if (fs.statSync(file).mtimeMs > manifestMtime) return true;
    } catch {
      // ignore
    }
  }

  return false;
}
