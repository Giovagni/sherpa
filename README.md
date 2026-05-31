# sherpa

Pre-computed codebase index for AI coding tools. Generates `.claude/manifest.md` — exports, import graph, and symbol signatures — loaded once per session so AI assistants can answer structural questions without exploratory grep/file calls.

```
Without sherpa: grep → cat → cat  (~3 calls, ~2,900 tokens)
With sherpa:    manifest already in context  (~69 tokens)
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

`init` generates `.claude/manifest.md`, adds it to `.gitignore`, installs a git post-commit hook, and prints the snippet to add to `CLAUDE.md`:

```markdown
## Codebase Index

See @.claude/manifest.md for symbol definitions, exports, and dependency graph.
Run `sherpa init` once to generate it locally (gitignored — each developer generates their own).
```

The `@` prefix tells Claude Code to load the manifest as context at session start.

## Commands

| Command | Description |
| --- | --- |
| `sherpa generate` | Incremental — only re-parses changed files |
| `sherpa generate --full` | Force full re-analysis |
| `sherpa generate --all-symbols` | Include filtered constants and default-only exports |
| `sherpa watch` | Watch for file changes and regenerate automatically |
| `sherpa init` | Generate manifest + install git post-commit hook |
| `sherpa status` | Exit 1 if manifest is stale (useful in CI) |
| `sherpa stats` | Show token count and size |

`--cwd <path>` available on all commands.

## Manifest format

**Exports** — what each file exposes publicly:
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

Long path prefixes are compressed with aliases declared in the manifest header:
```
<!-- aliases: $lib/=src/components/library/ -->
```

## Configuring aliases

Create `sherpa.config.json` at the project root:

```json
{
  "aliases": {
    "$lib/": "src/components/library/",
    "$api/": "src/services/api/"
  }
}
```

Without a config file, sherpa defaults to `$lib/` → `src/components/library/`. When the file is present, it replaces the default entirely — include `$lib/` explicitly if you still want it.

## Excluding files

Create `.sherpaignore` at the project root:

```
src/easteregg/
*.test.ts
*.spec.tsx
src/**/fixtures/**
```

Then run `sherpa generate --full`. If `sherpa stats` shows the manifest exceeds 8,000 tokens, this is the first thing to reach for.

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
