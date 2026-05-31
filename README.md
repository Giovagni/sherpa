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
# npm
npm install -g github:Giovagni/astmap

# pnpm
pnpm install -g github:Giovagni/astmap

# yarn
yarn global add github:Giovagni/astmap
```

Requires Node.js ≥ 18. No build step — the compiled binary is included in the repo.

To update to the latest version, run the same install command again.

### 2. Run init in your project

```bash
cd /your/project
astmap init
```

This does three things:
- Generates `.claude/manifest.md` (first full analysis, ~5–15s depending on project size)
- Installs a git post-commit hook so the manifest auto-updates on every commit
- Prints the snippet to add to your `CLAUDE.md`

### 3. Add the manifest reference to CLAUDE.md

Create or open `CLAUDE.md` at your project root and add:

```markdown
## Codebase Index

See @.claude/manifest.md for symbol definitions, exports, and dependency graph.
```

The `@` prefix tells Claude Code to load the file as context at session start. From this point, Claude reads the manifest once and uses it for the rest of the session instead of exploring the codebase file by file.

### 4. Commit both files

```bash
git add .claude/manifest.md CLAUDE.md
git commit -m "add astmap manifest"
```

Done. Future commits will keep the manifest fresh automatically.

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
- Long path prefixes are compressed with aliases (`src/components/library/` → `$lib/`)

Use `--all-symbols` to include everything if you need the unfiltered output.

---

## Commands

| Command | Description |
| --- | --- |
| `astmap generate` | Incremental analysis — only re-parses changed files |
| `astmap generate --full` | Force full re-analysis, ignoring cache |
| `astmap generate --all-symbols` | Include string-literal constants and barrel re-exports |
| `astmap init` | Generate manifest + install git post-commit hook |
| `astmap status` | Exit 1 if manifest is stale (useful in CI) |
| `astmap stats` | Show token count and size of current manifest |

`--cwd <path>` is available on all commands to target a different project root.

---

## Manifest format

Three sections, each built for a different query type.

### Exports

One line per file — what each file exposes publicly.

```
src/actions/tasks.ts: closeApp closeAllApps launchApp TaskActionTypes ...
src/reducers/index.ts: RootState default
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

## Known limitations

- **TypeScript/JS only** — `.js`/`.jsx` supported but without type information
- **Local imports only** — third-party packages are not indexed
- **No watch mode** — the git hook covers post-commit; between commits, run `astmap generate` manually
- **Path aliases are hardcoded** in `src/core/manifest.ts` — may need adjustment for projects with different directory structures
- **Incremental is ~1–3s on changes** due to TypeScript compiler startup; the 0-change case is instant

---

## Files generated

| File | Description |
| --- | --- |
| `.claude/manifest.md` | The index — **commit this** to your repo |
| `.claude/manifest.cache.json` | Incremental cache — add to `.gitignore` |
| `.git/hooks/post-commit` | Git hook installed by `astmap init` |
