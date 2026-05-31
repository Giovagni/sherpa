# astmap — Codebase Index
<!-- Generated: 2026-05-31T13:43:12.240Z | Files: 11 | Symbols: 25 -->

---

## Export Map

### src/commands/generate.ts
`generateCommand`

### src/commands/init.ts
`initCommand`

### src/commands/stats.ts
`statsCommand`

### src/commands/status.ts
`statusCommand`

### src/core/analyzer.ts
`analyze` `analyzeIncremental` `FileExports` `FileImports` `SymbolEntry` `AnalysisResult`

### src/core/cache.ts
`loadCache` `saveCache` `reconstructFromCache` `buildFileCache` `getCacheFile` `FileCache` `ManifestCache`

### src/core/files.ts
`findSourceFiles` `resolveImportPath` `extractRawImports`

### src/core/git.ts
`installPostCommitHook` `isManifestStale`

### src/core/manifest.ts
`generateManifest`

### src/core/tokens.ts
`estimateTokens` `TOKEN_WARN_THRESHOLD`

---

## Import Graph

### src/cli.ts
**imports:** `src/commands/generate.ts` `src/commands/init.ts` `src/commands/status.ts` `src/commands/stats.ts`
**imported by:** *(entry point or unused)*

### src/commands/generate.ts
**imports:** `src/core/analyzer.ts` `src/core/manifest.ts` `src/core/tokens.ts`
**imported by:** `src/cli.ts` `src/commands/init.ts`

### src/commands/init.ts
**imports:** `src/commands/generate.ts` `src/core/git.ts`
**imported by:** `src/cli.ts`

### src/commands/stats.ts
**imports:** `src/core/tokens.ts`
**imported by:** `src/cli.ts`

### src/commands/status.ts
**imports:** `src/core/git.ts`
**imported by:** `src/cli.ts`

### src/core/analyzer.ts
**imports:** `src/core/files.ts` `src/core/cache.ts`
**imported by:** `src/commands/generate.ts` `src/core/cache.ts` `src/core/manifest.ts`

### src/core/cache.ts
**imports:** `src/core/analyzer.ts`
**imported by:** `src/core/analyzer.ts`

### src/core/files.ts
**imported by:** `src/core/analyzer.ts` `src/core/git.ts`

### src/core/git.ts
**imports:** `src/core/files.ts`
**imported by:** `src/commands/init.ts` `src/commands/status.ts`

### src/core/manifest.ts
**imports:** `src/core/analyzer.ts`
**imported by:** `src/commands/generate.ts`

### src/core/tokens.ts
**imported by:** `src/commands/generate.ts` `src/commands/stats.ts`

---

## Symbol Index

### `AnalysisResult`
- **file:** src/core/analyzer.ts:31
- **kind:** interface

### `analyze`
- **file:** src/core/analyzer.ts:40
- **kind:** function
- **signature:** `(cwd: string) => AnalysisResult`

### `analyzeIncremental`
- **file:** src/core/analyzer.ts:67
- **kind:** function
- **signature:** `(cwd: string) => { result: AnalysisResult; changed: number; cached: number }`

### `buildFileCache`
- **file:** src/core/cache.ts:65
- **kind:** function
- **signature:** `(rel: string, mtime: number, exports: string[], importsFrom: string[], symbols: SymbolEntry[]) => FileCache`

### `estimateTokens`
- **file:** src/core/tokens.ts:4
- **kind:** function
- **signature:** `(text: string) => number`

### `extractRawImports`
- **file:** src/core/files.ts:93
- **kind:** function
- **signature:** `(absPath: string) => string[]`

### `FileCache`
- **file:** src/core/cache.ts:5
- **kind:** interface

### `FileExports`
- **file:** src/core/analyzer.ts:13
- **kind:** interface

### `FileImports`
- **file:** src/core/analyzer.ts:18
- **kind:** interface

### `findSourceFiles`
- **file:** src/core/files.ts:7
- **kind:** function
- **signature:** `(cwd: string) => string[]`

### `generateCommand`
- **file:** src/commands/generate.ts:12
- **kind:** function
- **signature:** `(opts: GenerateOptions) => Promise<void>`

### `generateManifest`
- **file:** src/core/manifest.ts:3
- **kind:** function
- **signature:** `(result: AnalysisResult, generatedAt: Date = new Date()) => string`

### `getCacheFile`
- **file:** src/core/cache.ts:75
- **kind:** function
- **signature:** `(cwd: string) => string`

### `initCommand`
- **file:** src/commands/init.ts:16
- **kind:** function
- **signature:** `(opts: InitOptions) => Promise<void>`

### `installPostCommitHook`
- **file:** src/core/git.ts:10
- **kind:** function
- **signature:** `(cwd: string) => { installed: boolean; message: string }`

### `isManifestStale`
- **file:** src/core/git.ts:31
- **kind:** function
- **signature:** `(cwd: string, manifestPath: string) => boolean`

### `loadCache`
- **file:** src/core/cache.ts:20
- **kind:** function
- **signature:** `(cwd: string) => ManifestCache`

### `ManifestCache`
- **file:** src/core/cache.ts:12
- **kind:** interface

### `reconstructFromCache`
- **file:** src/core/cache.ts:37
- **kind:** function
- **signature:** `(cache: ManifestCache) => AnalysisResult`

### `resolveImportPath`
- **file:** src/core/files.ts:72
- **kind:** function
- **signature:** `(fromFile: string, spec: string) => string | null`

### `saveCache`
- **file:** src/core/cache.ts:31
- **kind:** function
- **signature:** `(cwd: string, cache: ManifestCache) => void`

### `statsCommand`
- **file:** src/commands/stats.ts:9
- **kind:** function
- **signature:** `(opts: StatsOptions) => void`

### `statusCommand`
- **file:** src/commands/status.ts:8
- **kind:** function
- **signature:** `(opts: StatusOptions) => void`

### `SymbolEntry`
- **file:** src/core/analyzer.ts:23
- **kind:** interface

### `TOKEN_WARN_THRESHOLD`
- **file:** src/core/tokens.ts:8
- **kind:** const
- **signature:** `8000`
