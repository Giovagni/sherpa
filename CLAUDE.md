# astmap — Project Context for Claude

## What this is

A CLI tool that generates `.claude/manifest.md`: a compact static-analysis index (exports, import graph, symbol signatures) for TypeScript/JS codebases. The goal is to replace exploratory AI tool calls (grep + file reads) with a single pre-loaded manifest file, reducing token cost by ~60-90% per structural question.

## Architecture

```
src/
  cli.ts                  Commander entry point — defines all commands
  commands/
    generate.ts           astmap generate — incremental by default; exports runGenerate() for watch
    init.ts               generate + git hook + CLAUDE.md snippet suggestion
    stats.ts              token count / size of current manifest
    status.ts             exit 1 if manifest stale (for CI)
    watch.ts              astmap watch — fs.watch + debounce, calls runGenerate() on changes
  core/
    analyzer.ts           ts-morph analysis — full + incremental entry points
    cache.ts              ManifestCache schema + load/save/reconstruct
    config.ts             loadConfig() — reads astmap.config.json, falls back to built-in $lib/ alias
    files.ts              file discovery, .astmapignore, import resolution
    git.ts                post-commit hook install, isManifestStale
    manifest.ts           generateManifest() — formats AnalysisResult → markdown
    tokens.ts             estimateTokens(), TOKEN_WARN_THRESHOLD (8000)
bin/
  astmap.js               CLI shebang entry (requires dist/cli.js)
```

## Key design decisions

### ts-morph for analysis

Uses `ts-morph` (TypeScript Compiler API wrapper) instead of regex parsing. This gives accurate type signatures, real import resolution, and correct handling of re-exports. The cost is startup time (~1-3s per changed-file analysis run).

### Incremental analysis with mtime cache

`.claude/manifest.cache.json` stores per-file: `{ mtime, exports[], importsFrom[], symbols[] }`.

- 0 changed files → reconstruct from cache, no ts-morph at all (~15-30ms)
- N changed files → build a mini ts-morph project with only changed files + their direct imports
- Cache is invalidated by version bump (`CACHE_VERSION` constant in `cache.ts`)

### findSourceFiles is tsconfig-aware

`files.ts` reads `tsconfig.json` to find `rootDir` or `include` patterns before walking. This ensures the file set matches what ts-morph loads, avoiding phantom files (e.g. `bin/astmap.js`).

### Default export renaming

`getDisplayName()` in `analyzer.ts` renames `default` exports to the filename stem (`Calculator.tsx` → `Calculator`) or parent directory name for barrel files (`index.ts` → `Calculator`). This makes the Symbol Index searchable by component name instead of 40× `default`.

### JSX return type simplification

`simplifyReturnType()` replaces absolute node_modules paths (e.g. `import("/abs/.../node_modules/@types/react...").ReactElement`) with `JSX.Element`. Without this, React component signatures are unreadable and waste ~500 tokens.

### Path aliases

`PATH_ALIASES` in `manifest.ts` maps long prefixes to short aliases declared in the manifest header. Currently: `src/components/library/` → `$lib/`. The alias list is checked against actual files before emitting the header comment. Add new aliases here for other long prefixes.

## Manifest optimizations (history)

Five rounds of optimization on `web-os-portfolio` (111 files):

| Round | Change | Tokens | Δ |
| --- | --- | --- | --- |
| 0 | Original markdown format | 8,783 | — |
| 1 | Compact format (1 line/entry, no bold/backtick overhead) | 6,781 | −23% |
| 2 | Filter barrel `index.ts` from Exports + string-literal consts from Symbols | 6,015 | −11% |
| 3 | Drop `←` lines (redundant with `→`) + `$lib/` alias (276 occurrences) | 3,914 | −35% |
| 4 | Filter all default-only files from Exports + fix local abs path in signatures | **~3,400** | −13% |

Total reduction: **~−61%** from baseline.

## Known limitations and edge cases

- **`←` lines are dropped**: The Import Graph only shows `→` (importedBy). If you need "what does file X import?", reconstruct from `→` lines (if A → B C, then A imports B and C). A future `--full-graph` flag could restore `←` lines.

- **Barrel files and Symbol Index**: ts-morph follows re-exports to their source file, so `Calculator/index.ts` and `Calculator/Calculator.tsx` map to the same symbol entry — no duplicates. The dedup key is `${displayName}@${defRelPath}`.

- **TypeScript compiler startup**: Incremental analysis for changed files still invokes ts-morph, which loads the TypeScript compiler. This costs ~1-3s per run regardless of how many files changed. The 0-change case is instant.

- **Watch mode limitation on Linux**: `astmap watch` uses `fs.watch({ recursive: true })`, which works reliably on macOS and Windows but has known issues on Linux (requires inotify, limited to non-NFS filesystems).

- **JS projects**: Supported (`allowJs: true` when no tsconfig), but without type information — signatures degrade to inferred types which may be verbose or wrong.

## Future optimization opportunities

### Performance

- **Daemon mode**: Keep a ts-morph `Project` alive in a background process (Unix socket IPC). CLI sends file paths, daemon responds with analysis. Eliminates the 1-3s TypeScript startup cost for incremental runs. Would bring changed-file analysis to <100ms.
- **Worker threads**: Parallelize per-file export/symbol extraction. Low priority — the bottleneck is TypeScript compiler init, not per-file work.

### Manifest size

- **`--no-exports` flag**: Omit the Exports section entirely for projects where only the Symbol Index and Import Graph are needed. Saves ~975 tokens on web-os-portfolio.
- **Signature truncation tuning**: Currently 120 chars max. Could expose as `--max-sig-length` flag.
- **Prune leaf nodes from Import Graph**: Files that appear only as sources (never in `→`) are leaf components with no dependents. For large repos, omitting them could reduce graph size significantly.

### Features

- **`--full-graph` flag**: Restore `←` (imports) lines in the Import Graph for when you need the dependency direction, not just the importedBy direction.
- **`astmap query <symbol>`**: Print the manifest lines relevant to a single symbol — useful for scripting.
- **Monorepo support**: Auto-detect workspaces and generate per-package manifests, then merge into a root manifest with package-prefixed aliases (`$core/`, `$ui/`).
- **CLAUDE.md auto-patch**: `astmap init` could write the `@.claude/manifest.md` reference directly into CLAUDE.md instead of just printing the snippet.

## Transparency — manifest is gitignored

`astmap init` automatically patches the host project's `.gitignore` to exclude both `.claude/manifest.md` and `.claude/manifest.cache.json`. The manifest is local-only: each developer generates their own copy. The only thing that enters the host repo is the `CLAUDE.md` reference (two lines).

The `patchGitignore(cwd)` function in `src/commands/init.ts` appends the lines only if not already present, and handles both missing and existing `.gitignore` files.

## Running locally

```bash
pnpm run build        # tsc → dist/
pnpm run dev          # ts-node src/cli.ts (no build needed)

# Test on this repo
node bin/astmap.js generate --full

# Test on another project
node bin/astmap.js generate --cwd /path/to/project --full
```

## Token threshold

`TOKEN_WARN_THRESHOLD = 8000` in `tokens.ts`. This is a soft warning, not a hard limit. The estimate uses `Math.ceil(length / 4)` which is accurate for code/markdown but underestimates token count for non-ASCII content.
