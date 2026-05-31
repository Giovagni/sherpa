import * as fs from 'fs';
import * as path from 'path';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const IGNORE_DIRS = new Set(['node_modules', 'dist', '.git', '.next', 'build', 'out', 'coverage', '.turbo']);

export function findSourceFiles(cwd: string): string[] {
  const roots = getRootsFromTsconfig(cwd);
  const ignorePatterns = loadIgnorePatterns(cwd);
  const results: string[] = [];
  for (const root of roots) {
    walk(root, cwd, ignorePatterns, results);
  }
  return results;
}

export function loadIgnorePatterns(cwd: string): string[] {
  try {
    const raw = fs.readFileSync(path.join(cwd, '.astmapignore'), 'utf8');
    return raw
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0 && !l.startsWith('#'));
  } catch {
    return [];
  }
}

export function matchesIgnore(relPath: string, patterns: string[]): boolean {
  for (const p of patterns) {
    if (p.endsWith('/')) {
      // Directory prefix: "src/easteregg/" → qualsiasi file dentro
      if (relPath.startsWith(p)) return true;
    } else if (p.startsWith('*.')) {
      // Extension glob: "*.test.ts" → qualsiasi file con quella estensione
      if (relPath.endsWith(p.slice(1))) return true;
    } else if (p.includes('*')) {
      // Glob generico: converti in regex (es. "src/**/index.ts")
      const regex = new RegExp(
        '^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$'
      );
      if (regex.test(relPath)) return true;
    } else {
      // Path esatto o prefisso di directory (senza trailing slash)
      if (relPath === p || relPath.startsWith(p + '/')) return true;
    }
  }
  return false;
}

function getRootsFromTsconfig(cwd: string): string[] {
  const tsconfigPath = path.join(cwd, 'tsconfig.json');
  try {
    const raw = fs.readFileSync(tsconfigPath, 'utf8');
    const stripped = raw.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    const tsconfig = JSON.parse(stripped);
    const co = tsconfig?.compilerOptions ?? {};

    if (co.rootDir) {
      const rootDir = path.resolve(cwd, co.rootDir);
      if (fs.existsSync(rootDir)) return [rootDir];
    }

    const include: string[] = tsconfig?.include ?? [];
    const includeDirs = include
      .map((pattern: string) => {
        const parts = pattern.replace(/\\/g, '/').split('/').filter(p => p !== '' && p !== '.');
        return parts.length > 0 ? path.resolve(cwd, parts[0]) : cwd;
      })
      .filter((d: string) => fs.existsSync(d));

    if (includeDirs.length > 0) return [...new Set(includeDirs)];
  } catch {
    // no tsconfig or parse error
  }
  return [cwd];
}

function walk(dir: string, cwd: string, ignorePatterns: string[], results: string[]) {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const rel = path.relative(cwd, full).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      // Controlla a livello di directory per non ricorrere dentro path ignorati
      if (!matchesIgnore(rel + '/', ignorePatterns)) {
        walk(full, cwd, ignorePatterns, results);
      }
    } else if (
      entry.isFile() &&
      SOURCE_EXTENSIONS.has(path.extname(entry.name)) &&
      !entry.name.endsWith('.d.ts') &&
      !matchesIgnore(rel, ignorePatterns)
    ) {
      results.push(full);
    }
  }
}

export function resolveImportPath(fromFile: string, spec: string): string | null {
  const dir = path.dirname(fromFile);
  const base = path.resolve(dir, spec);

  const candidates = [
    base,
    base + '.ts', base + '.tsx', base + '.js', base + '.jsx',
    path.join(base, 'index.ts'), path.join(base, 'index.tsx'),
    path.join(base, 'index.js'), path.join(base, 'index.jsx'),
  ];

  for (const c of candidates) {
    try {
      if (fs.statSync(c).isFile()) return c;
    } catch {
      // not found
    }
  }
  return null;
}

export function extractRawImports(absPath: string): string[] {
  try {
    const content = fs.readFileSync(absPath, 'utf8');
    const imports: string[] = [];
    const re = /(?:from\s+|require\s*\(\s*)['"](\.[^'"]+)['"]/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      imports.push(m[1]);
    }
    return imports;
  } catch {
    return [];
  }
}
