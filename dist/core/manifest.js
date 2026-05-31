"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateManifest = generateManifest;
// Path prefixes to alias — ordered longest-first to avoid partial replacements.
const PATH_ALIASES = [
    ['src/components/library/', '$lib/'],
];
function generateManifest(result, generatedAt = new Date(), opts = {}) {
    const lines = [];
    lines.push(`# astmap — Codebase Index`);
    lines.push(`<!-- ${generatedAt.toISOString()} | ${result.files} files | ${result.symbols.length} symbols -->`);
    // Declare path aliases so the reader can resolve them back to real paths.
    const activeAliases = PATH_ALIASES.filter(([prefix]) => result.exports.some(e => e.file.startsWith(prefix)) ||
        result.symbols.some(s => s.file.startsWith(prefix)));
    if (activeAliases.length > 0) {
        lines.push(`<!-- aliases: ${activeAliases.map(([p, a]) => `${a}=${p}`).join(', ')} -->`);
    }
    lines.push('');
    // Layer 1: Exports — one line per file
    // Files that export only `default` are skipped: the Symbol Index already has them
    // with a readable name (e.g. Calculator, App). --all-symbols restores them.
    lines.push('## Exports');
    const sortedExports = [...result.exports].sort((a, b) => a.file.localeCompare(b.file));
    for (const { file, names } of sortedExports) {
        if (!opts.allSymbols && isDefaultOnly(names))
            continue;
        lines.push(`${alias(file)}: ${names.join(' ')}`);
    }
    lines.push('');
    // Layer 2: Import Graph — only → (importedBy) lines.
    // ← (imports) are omitted: they carry the same information as → from the other side.
    lines.push('## Import Graph');
    const allFiles = new Set();
    result.imports.forEach(i => { allFiles.add(i.file); i.importsFrom.forEach(f => allFiles.add(f)); });
    result.importedBy.forEach((_, k) => allFiles.add(k));
    for (const file of [...allFiles].sort()) {
        const importedBy = result.importedBy.get(file) ?? [];
        if (importedBy.length > 0)
            lines.push(`${alias(file)} → ${importedBy.map(alias).join(' ')}`);
    }
    lines.push('');
    // Layer 3: Symbol Index — one line per symbol
    // String-literal constants (e.g. action type strings "CLOSE_APP") are skipped by default.
    lines.push('## Symbols');
    const sortedSymbols = [...result.symbols].sort((a, b) => a.name.localeCompare(b.name));
    for (const sym of sortedSymbols) {
        if (!opts.allSymbols && isStringLiteralConst(sym))
            continue;
        const sigPart = sym.signature ? `  ${sym.signature}` : '';
        lines.push(`${sym.name}  ${alias(sym.file)}:${sym.line}  ${sym.kind}${sigPart}`);
    }
    return lines.join('\n');
}
function alias(p) {
    for (const [prefix, short] of PATH_ALIASES) {
        if (p.startsWith(prefix))
            return short + p.slice(prefix.length);
    }
    return p;
}
function isDefaultOnly(names) {
    return names.length === 1 && names[0] === 'default';
}
function isStringLiteralConst(sym) {
    return sym.kind === 'const' && /^"[^"]*"$/.test(sym.signature ?? '');
}
//# sourceMappingURL=manifest.js.map