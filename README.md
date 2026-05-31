# astmap

Static analysis index for AI coding tools. Generates `.claude/manifest.md` — a compact, pre-built lookup of your codebase's exports, import graph, and symbol signatures — so an AI assistant can answer structural questions without exploratory `grep`/`cat` calls.

## Why

When an AI needs to answer "where is `closeApp` defined, and who calls it?", the naive approach costs 3 tool calls and ~2,000 tokens of grep output. With a pre-loaded manifest, the same question costs 1 read and ~220 tokens.

```
Without astmap: grep → cat actions/tasks.ts → cat reducers/TasksReducer.ts  (~2,056 tokens, 3 calls)
With astmap:    read .claude/manifest.md once per session                    (~220 tokens, 1 call)
```

## How it works

1. You run `astmap init` once in your project root
2. astmap analyzes all `.ts`/`.tsx`/`.js`/`.jsx` files with the TypeScript compiler and writes `.claude/manifest.md`
3. A git post-commit hook is installed — from now on, the manifest updates automatically after every commit
4. You add one line to your `CLAUDE.md` pointing at the manifest file
5. From that point on, Claude Code reads the manifest at the start of each session and can answer "where is X?", "who uses X?", "what does file Y export?" directly — without grepping or reading files

The manifest is committed to your repo. Teammates get it for free on pull.

## Getting started

### 1. Install

```bash
pnpm add -g github:Giovagni/astmap
```

Requires Node.js ≥ 18 and pnpm ≥ 8. No build step — the compiled binary is included in the repo.

> **npm alternative:** `npm install -g github:Giovagni/astmap`

To update to the latest version, run the same install command again.

### 2. Run init in your project

```bash
cd /your/project
astmap init
```

This does four things:
- Generates `.claude/manifest.md` (first full analysis, ~5–15s depending on project size)
- Adds `.claude/manifest.md` and `.claude/manifest.cache.json` to the project's `.gitignore` — the manifest is **never committed**, it lives only on your machine
- Installs a git post-commit hook so the manifest auto-updates on every commit
- Prints the snippet to add to your `CLAUDE.md`

### 3. Add the manifest reference to CLAUDE.md

Create or open `CLAUDE.md` at your project root and add:

```markdown
## Codebase Index

See @.claude/manifest.md for symbol definitions, exports, and dependency graph.
Run `astmap init` once to generate it locally (the file is gitignored — each developer generates their own).
```

The `@` prefix tells Claude Code to load the file as context at session start. The manifest is gitignored, so each developer who wants AI-assisted navigation runs `astmap init` once on their machine.

### 4. Commit CLAUDE.md

```bash
git add CLAUDE.md
git commit -m "add astmap context reference"
```

Done. Future commits will keep your local manifest fresh automatically.

---

## If the manifest gets stale

Between commits, if you want a fresh manifest:

```bash
astmap generate          # incremental — only re-parses changed files (~1–3s)
astmap generate --full   # full re-analysis from scratch
```

Check whether it's stale (useful in CI):

```bash
astmap status   # exits 1 if stale, 0 if up to date
```

---

## Reducing manifest size

If `astmap stats` shows the manifest is too large (> 8,000 tokens), create `.astmapignore` at your project root:

```
# Exclude directories
src/easteregg/
src/pages/

# Exclude test files
*.test.ts
*.spec.tsx

# Glob patterns
src/**/fixtures/**

# Exact file
src/generated/schema.ts
```

Then regenerate:

```bash
astmap generate --full
```

astmap also applies automatic size reductions out of the box:
- Barrel `index.ts` files that only re-export `default` are omitted from the Exports section
- String-literal action type constants (e.g. `"CLOSE_APP"`) are omitted from the Symbol Index
- Long path prefixes are compressed with aliases (configurable — see below)

Use `--all-symbols` to include everything if you need the unfiltered output.

### Configuring path aliases

By default, astmap compresses `src/components/library/` to `$lib/`. To define your own aliases, create `astmap.config.json` at the project root:

```json
{
  "aliases": {
    "$lib/": "src/components/library/",
    "$ui/": "src/ui/",
    "$api/": "src/services/api/"
  }
}
```

Key = short alias, value = real path prefix. Aliases are only emitted in the manifest header if files matching the prefix actually exist. When `astmap.config.json` is present, the built-in `$lib/` default is replaced entirely by the config — include it explicitly if you still want it.

---

## Commands

| Command | Description |
| --- | --- |
| `astmap generate` | Incremental analysis — only re-parses changed files |
| `astmap generate --full` | Force full re-analysis, ignoring cache |
| `astmap generate --all-symbols` | Include string-literal constants and barrel re-exports |
| `astmap init` | Generate manifest + install git post-commit hook |
| `astmap watch` | Watch for file changes and regenerate manifest automatically |
| `astmap status` | Exit 1 if manifest is stale (useful in CI) |
| `astmap stats` | Show token count and size of current manifest |

`--cwd <path>` is available on all commands to target a different project root.

---

## Manifest format

Three sections, each built for a different query type.

### Exports

One line per file — what each file exposes publicly. Files that export only `default` are omitted (already covered by the Symbol Index with a readable name).

```
src/actions/tasks.ts: closeApp closeAllApps launchApp TaskActionTypes ...
src/reducers/index.ts: RootState default
src/types/index.ts: Task DisplayState VolumeState ContextMenuOption Position
```

### Import Graph

Who imports each file (`→` = imported by). Use this to find blast radius: which files need updating when X changes.

```
src/actions/tasks.ts → src/App.tsx src/reducers/TasksReducer.ts src/components/...
src/reducers/TasksReducer.ts → src/reducers/index.ts
```

### Symbols

One line per exported symbol: `name  file:line  kind  signature`.

```
closeApp    src/actions/tasks.ts:102   fn    (data: { _id: string }) => CloseAppAction
AppConfig   src/config/apps.ts:5       interface
RootState   src/reducers/index.ts:13   type
```

### Path aliases

Long path prefixes are compressed automatically. The alias mapping is declared in the manifest header:

```
<!-- aliases: $lib/=src/components/library/ -->
```

So `$lib/Calculator/Calculator.tsx` resolves to `src/components/library/Calculator/Calculator.tsx`.

---

## Performance

| Scenario | Time |
| --- | --- |
| No files changed | ~15–30ms (no TypeScript compiler) |
| N files changed | ~1–3s (mini ts-morph project, changed files + direct imports) |
| Full analysis (111 files) | ~7–10s |

The cache (`.claude/manifest.cache.json`) is local and gitignored — each developer has their own.

---

## Updating astmap itself

Since `dist/` is committed to the repo, after modifying the source you must rebuild before committing:

```bash
pnpm run build
git add dist/ src/
git commit -m "..."
```

Users who installed via `pnpm add -g github:Giovagni/astmap` update by re-running the same command:

```bash
pnpm add -g github:Giovagni/astmap
```

---

## Known limitations

- **TypeScript/JS only** — `.js`/`.jsx` supported but without type information
- **Local imports only** — third-party packages are not indexed
- **`astmap watch` on Linux** — uses `fs.watch({ recursive: true })`, which has known limitations on Linux (inotify, no NFS); works reliably on macOS and Windows
- **Incremental is ~1–3s on changes** due to TypeScript compiler startup; the 0-change case is instant

---

## Files generated

| File | Description |
| --- | --- |
| `.claude/manifest.md` | Local only — gitignored by `astmap init`, never committed |
| `.claude/manifest.cache.json` | Incremental cache — gitignored by `astmap init` |
| `.git/hooks/post-commit` | Git hook installed by `astmap init` |
