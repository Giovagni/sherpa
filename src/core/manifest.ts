import { AnalysisResult } from './analyzer';

export interface ManifestOptions {
  allSymbols?: boolean;
  aliases?: Array<[prefix: string, alias: string]>;
}

export function generateManifest(
  result: AnalysisResult,
  generatedAt: Date = new Date(),
  opts: ManifestOptions = {}
): string {
  const aliases = opts.aliases ?? [];
  const aliasPath = (p: string) => applyAlias(p, aliases);
  const lines: string[] = [];

  lines.push(`# sherpa — Codebase Index`);
  lines.push(`<!-- ${generatedAt.toISOString()} | ${result.files} files | ${result.symbols.length} symbols -->`);

  // Declare path aliases so the reader can resolve them back to real paths.
  const activeAliases = aliases.filter(([prefix]) =>
    result.exports.some(e => e.file.startsWith(prefix)) ||
    result.symbols.some(s => s.file.startsWith(prefix))
  );
  if (activeAliases.length > 0) {
    lines.push(`<!-- aliases: ${activeAliases.map(([p, a]) => `${a}=${p}`).join(', ')} -->`);
  }
  lines.push('');

  lines.push('## Exports');
  const sortedExports = [...result.exports].sort((a, b) => a.file.localeCompare(b.file));
  for (const { file, names } of sortedExports) {
    if (!opts.allSymbols && isDefaultOnly(names)) continue;
    lines.push(`${aliasPath(file)}: ${names.join(' ')}`);
  }
  lines.push('');

  lines.push('## Import Graph');
  const allFiles = new Set<string>();
  result.imports.forEach(i => { allFiles.add(i.file); i.importsFrom.forEach(f => allFiles.add(f)); });
  result.importedBy.forEach((_, k) => allFiles.add(k));

  for (const file of [...allFiles].sort()) {
    const importedBy = result.importedBy.get(file) ?? [];
    // ← lines are omitted: they carry the same information as → from the other side.
    if (importedBy.length > 0) lines.push(`${aliasPath(file)} → ${importedBy.map(aliasPath).join(' ')}`);
  }
  lines.push('');

  lines.push('## Symbols');
  const sortedSymbols = [...result.symbols].sort((a, b) => a.name.localeCompare(b.name));
  for (const sym of sortedSymbols) {
    if (!opts.allSymbols && isStringLiteralConst(sym)) continue;
    const sigPart = sym.signature ? `  ${sym.signature}` : '';
    lines.push(`${sym.name}  ${aliasPath(sym.file)}:${sym.line}  ${sym.kind}${sigPart}`);
  }

  return lines.join('\n');
}

function applyAlias(p: string, aliases: Array<[prefix: string, alias: string]>): string {
  for (const [prefix, short] of aliases) {
    if (p.startsWith(prefix)) return short + p.slice(prefix.length);
  }
  return p;
}

function isDefaultOnly(names: string[]): boolean {
  return names.length === 1 && names[0] === 'default';
}

function isStringLiteralConst(sym: { kind: string; signature?: string }): boolean {
  return sym.kind === 'const' && /^"[^"]*"$/.test(sym.signature ?? '');
}
