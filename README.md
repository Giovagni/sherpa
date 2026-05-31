<div align="center">
  <img src=".github/logo.svg" width="88" height="88" alt="sherpa logo" />
  <h1>sherpa</h1>
  <p>Pre-computed codebase index for AI coding tools</p>

  ![version](https://img.shields.io/badge/version-0.2.0-3b82f6?style=flat-square)
  ![node](https://img.shields.io/badge/node-%E2%89%A518-22c55e?style=flat-square)
  ![license](https://img.shields.io/badge/license-MIT-f59e0b?style=flat-square)
</div>

---

Every AI session on an unfamiliar codebase starts the same way: grep for a symbol, read a file, follow an import, read another file — three to five tool calls before a single line of code changes.

Sherpa pre-computes the answers. It runs static analysis on your TypeScript/JavaScript project and writes `.claude/manifest.md` — a compact index of exports, the import graph, and every symbol's type signature. Load it once per session via `CLAUDE.md`. From that point on, structural questions cost a manifest lookup instead of a file crawl.

```
without sherpa   grep → cat → cat   3 calls · ~2,900 tokens
with sherpa      manifest in context            0 calls ·    ~69 tokens   −97%
```

## Install

```bash
pnpm add -g github:Giovagni/sherpa
```

Requires Node.js ≥ 18. To update, run the same command again.

## Getting started

```bash
cd /your/project
sherpa init
```

`init` generates `.claude/manifest.md`, adds it to `.gitignore`, installs a git post-commit hook, and prints the snippet for `CLAUDE.md`:

```markdown
## Codebase Index

See @.claude/manifest.md for symbol definitions, exports, and dependency graph.
Run `sherpa init` once to generate it locally (gitignored — each developer generates their own).
```

The `@` prefix tells Claude Code to load the manifest as context at session start. Commit `CLAUDE.md` — teammates get the reference for free on pull, and run `sherpa init` once on their machine to generate their own local copy.

## Commands

| Command | Description |
| --- | --- |
| `sherpa generate` | Incremental — only re-parses changed files (~20ms if nothing changed) |
| `sherpa generate --full` | Force full re-analysis |
| `sherpa generate --all-symbols` | Include filtered constants and default-only exports |
| `sherpa watch` | Watch for file changes and regenerate automatically |
| `sherpa init` | Generate manifest + install git post-commit hook |
| `sherpa status` | Exit 1 if manifest is stale (useful in CI) |
| `sherpa stats` | Show token count and size |

`--cwd <path>` available on all commands.

## Manifest format

Three sections, each targeting a different query type.

**Exports** — what each file exposes:
```
src/types/index.ts: Task DisplayState VolumeState ContextMenuOption Position
src/reducers/index.ts: RootState default
```

**Import Graph** — who imports each file (`→` = imported by):
```
src/types/index.ts → src/actions/tasks.ts src/reducers/TasksReducer.ts $lib/Common/ContextMenu/ContextMenu.tsx
```

**Symbols** — one line per exported symbol:
```
Task      src/types/index.ts:1      interface
closeApp  src/actions/tasks.ts:102  function  (data: { _id: string }) => CloseAppAction
RootState src/reducers/index.ts:13  type
```

Long path prefixes are compressed with aliases declared in the manifest header — configurable per project.

## Configuration

Create `sherpa.config.json` at the project root to define path aliases:

```json
{
  "aliases": {
    "$lib/": "src/components/library/",
    "$api/": "src/services/api/"
  }
}
```

Without a config file, sherpa defaults to `$lib/` → `src/components/library/`. When the file is present it replaces the default entirely — include `$lib/` explicitly if you still want it.

## Excluding files

Create `.sherpaignore` to keep the manifest focused:

```
src/easteregg/
*.test.ts
*.spec.tsx
src/**/fixtures/**
```

Then run `sherpa generate --full`. If `sherpa stats` reports more than 8,000 tokens, this is the first thing to reach for.

## Performance

| Scenario | Time |
| --- | --- |
| No files changed | ~15–30ms (no TypeScript compiler) |
| N files changed | ~1–3s (incremental, changed files + direct imports) |
| Full analysis (111 files) | ~7–10s |

## Known limitations

- TypeScript/JS only — `.js`/`.jsx` works but signatures degrade to inferred types
- Local imports only — third-party packages not indexed
- `sherpa watch` uses `fs.watch({ recursive: true })` — reliable on macOS and Windows, limited on Linux
- Incremental re-analysis costs ~1–3s due to TypeScript compiler startup; the 0-change case is instant

## Development

`dist/` is committed so users get a working binary without a build step. After modifying source:

```bash
pnpm run build
git add dist/ src/
git commit -m "..."
```
