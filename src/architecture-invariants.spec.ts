/**
 * Architecture-invariant spec — a regression guard for the layering rules
 * documented in ARCHITECTURE.md. These are static (source-scanning) tests, not
 * runtime tests: they read the .ts source files under `src/` (via Vite's
 * `import.meta.glob` raw import, resolved at build time) and fail if a
 * forbidden dependency has crept in.
 *
 * The four invariants enforced here:
 *
 *  1. `domain/` is FRAMEWORK-FREE — no `@angular` substring anywhere (runtime,
 *     type-only, or comment) and no imports from `data/`, `ui/`, or `app/`.
 *     `domain` may depend on `core/result` only.
 *  2. `data/` never imports from `ui/` or `app/` (dependencies point inward).
 *  3. Views (`app/views/**`) consume data ONLY through the DI seam — never a
 *     concrete repository impl / PostApiService / HttpClient / DTO / DAO. The
 *     documented exceptions are:
 *       - `database_handling/demo-cache-wiring.ts` (teaching wiring file), and
 *       - `state_management/rxjs_server_state/**` (a self-contained HttpClient
 *         / RxJS / caching teaching module that deliberately demonstrates
 *         `HttpClient` + builds a component-scoped client; it never touches the
 *         app's real data pipeline).
 *     (`getWiring` from `data/providers` is a pure metadata helper and remains
 *     allowed anywhere.)
 *  4. No `enum` declarations — the project uses const-object + literal unions
 *     (erasable-only TypeScript).
 *
 * Real ES `import` statements always start at column 0 in this codebase. To
 * avoid false-positives on the teaching screens' embedded code samples (which
 * also place `import` at column 0 inside template literals), we strip template
 * literals + comments before matching.
 */
import { describe, it, expect } from 'vitest';

// Eager raw-text import of every .ts file under src/. Keys are root-absolute
// paths beginning with `/src/...` (Vite convention). The `glob`/`import.meta`
// types come from Vite at bundle time, so suppress the TS checker here.
const ALL_TS: Record<string, string> = (
  // @ts-expect-error — import.meta.glob is provided by the Vite bundler.
  import.meta.glob('/src/**/*.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  })
) as Record<string, string>;

/** All .ts source files (specs included) keyed by their root-absolute path. */
const FILES = Object.entries(ALL_TS);

/** Filter to source files under a given top-level layer dir (e.g. /src/domain). */
function under(prefix: string): Array<[string, string]> {
  return FILES.filter(([path]) => path.startsWith(prefix));
}

/** True if a `from` specifier (relative) references a layer dir. */
function specReferencesLayer(spec: string, layer: string): boolean {
  if (!spec.startsWith('.')) return false; // framework/external import
  // `../../data/foo` or `./data/bar` → matches `/<layer>/` after normalization.
  return new RegExp(`(^|/)${layer}/`).test(spec);
}

/**
 * Replace template-literal and comment contents with spaces (preserving
 * newlines so line numbers/structure are intact), so a column-0-anchored import
 * regex only matches REAL ES imports. Handles nested `${...}` interpolation,
 * escaped quotes/backticks, and `//` + `/* *​/` comments.
 */
function stripStringsAndComments(src: string): string {
  let out = '';
  let i = 0;
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let braceDepth = 0; // ${...} nesting inside a backtick
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];

    // Inside a backtick template literal.
    if (inBacktick) {
      if (c === '\\') {
        // Escaped char — blank both, keep newline shape.
        out += src[i] === '\n' ? '\n' : ' ';
        out += next === '\n' ? '\n' : ' ';
        i += 2;
        continue;
      }
      if (c === '$' && next === '{') {
        braceDepth++;
        out += '  ';
        i += 2;
        continue;
      }
      if (braceDepth > 0) {
        if (c === '{') braceDepth++;
        else if (c === '}') braceDepth--;
        out += c === '\n' ? '\n' : ' ';
        i++;
        continue;
      }
      if (c === '`') {
        inBacktick = false;
        out += ' ';
        i++;
        continue;
      }
      out += c === '\n' ? '\n' : ' ';
      i++;
      continue;
    }

    // Inside a single-quoted string.
    if (inSingle) {
      if (c === '\\') {
        out += ' '.repeat(2);
        i += 2;
        continue;
      }
      if (c === "'") inSingle = false;
      out += c === '\n' ? '\n' : c;
      i++;
      continue;
    }

    // Inside a double-quoted string.
    if (inDouble) {
      if (c === '\\') {
        out += ' '.repeat(2);
        i += 2;
        continue;
      }
      if (c === '"') inDouble = false;
      out += c === '\n' ? '\n' : c;
      i++;
      continue;
    }

    // Top-level: detect comment / string openings.
    if (c === '/' && next === '/') {
      while (i < src.length && src[i] !== '\n') {
        out += ' ';
        i++;
      }
      continue;
    }
    if (c === '/' && next === '*') {
      out += '  ';
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
        out += src[i] === '\n' ? '\n' : ' ';
        i++;
      }
      if (i < src.length) {
        out += '  ';
        i += 2;
      }
      continue;
    }
    if (c === "'") {
      inSingle = true;
      out += c;
      i++;
      continue;
    }
    if (c === '"') {
      inDouble = true;
      out += c;
      i++;
      continue;
    }
    if (c === '`') {
      inBacktick = true;
      out += ' ';
      i++;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/**
 * Extract real ES-module import specifiers from a source string. Matches lines
 * that start at column 0 with `import` (optional `type`) and end with a
 * `from '…'`/`from "…"` specifier, spanning multiple lines if needed. Template
 * literals and comments are stripped first so embedded code samples are
 * excluded.
 */
function realImportSpecifiers(source: string): string[] {
  const clean = stripStringsAndComments(source);
  const re = /^import\b(?:[^;]*?)\bfrom\s+['"]([^'"]+)['"]/gms;
  const specs: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(clean)) !== null) specs.push(m[1]);
  return specs;
}

describe('architecture invariants', () => {
  describe('1. domain/ is framework-free', () => {
    const domain = under('/src/domain/');

    it('domain/ has .ts files (sanity)', () => {
      expect(domain.length).toBeGreaterThan(0);
    });

    it('domain/ contains no @angular reference at all', () => {
      const offenders = domain
        .filter(([, src]) => src.includes('@angular'))
        .map(([path]) => path);
      expect(offenders).toEqual([]);
    });

    it('domain/ imports only core/result (never data/ui/app)', () => {
      const offenders: string[] = [];
      for (const [path, src] of domain) {
        for (const spec of realImportSpecifiers(src)) {
          if (!spec.startsWith('.')) continue; // framework/external — covered above
          if (specReferencesLayer(spec, 'data')) offenders.push(`${path} -> ${spec}`);
          if (specReferencesLayer(spec, 'ui')) offenders.push(`${path} -> ${spec}`);
          if (specReferencesLayer(spec, 'app')) offenders.push(`${path} -> ${spec}`);
          if (
            specReferencesLayer(spec, 'core') &&
            !/(^|\/)core\/result\b/.test(spec)
          ) {
            offenders.push(`${path} -> ${spec} (only core/result allowed)`);
          }
        }
      }
      expect(offenders).toEqual([]);
    });
  });

  describe('2. data/ never imports from ui/ or app/', () => {
    it('data/ has no ui/app imports', () => {
      const offenders: string[] = [];
      for (const [path, src] of under('/src/data/')) {
        for (const spec of realImportSpecifiers(src)) {
          if (specReferencesLayer(spec, 'ui')) offenders.push(`${path} -> ${spec}`);
          if (specReferencesLayer(spec, 'app')) offenders.push(`${path} -> ${spec}`);
        }
      }
      expect(offenders).toEqual([]);
    });
  });

  describe('3. views consume data only via the DI seam', () => {
    const VIEWS_PREFIX = '/src/app/views/';
    const EXCEPTION_FILES = new Set<string>([
      // Documented teaching wiring file.
      VIEWS_PREFIX + 'database_handling/demo-cache-wiring.ts',
    ]);
    // Documented self-contained HttpClient/RxJS teaching module — every file
    // under this directory is part of the demo and may import HttpClient etc.
    const EXCEPTION_DIRS = [VIEWS_PREFIX + 'state_management/rxjs_server_state/'];
    const isException = (path: string): boolean =>
      EXCEPTION_FILES.has(path) ||
      EXCEPTION_DIRS.some((d) => path.startsWith(d));

    // Concrete symbols views must never import directly.
    const BANNED_SYMBOL_RES = [
      /\bPostRepositoryImpl\b/,
      /\bPostApiService\b/,
      /\bAppDatabaseImpl\b/,
      /\bPostDAO\b/,
      /\bHttpClient\b/,
    ];

    it('view files exist (sanity)', () => {
      expect(under(VIEWS_PREFIX).length).toBeGreaterThan(0);
    });

    it('no view imports a banned concrete data symbol (except documented zones)', () => {
      const offenders: string[] = [];
      for (const [path, src] of under(VIEWS_PREFIX)) {
        if (isException(path)) continue;
        const importBlock = stripStringsAndComments(src).match(
          /^import\b[^;]*?from\s+['"][^'"]+['"]/gms,
        );
        if (!importBlock) continue;
        const joined = importBlock.join('\n');
        for (const re of BANNED_SYMBOL_RES) {
          if (re.test(joined)) offenders.push(`${path} matches ${re}`);
        }
      }
      expect(offenders).toEqual([]);
    });

    it('only documented zones + the getWiring metadata helper import from data/', () => {
      const offenders: string[] = [];
      for (const [path, src] of under(VIEWS_PREFIX)) {
        if (isException(path)) continue;
        const dataSpecs = realImportSpecifiers(src).filter((s) =>
          specReferencesLayer(s, 'data'),
        );
        for (const spec of dataSpecs) {
          // The single allowed non-zone data import is the metadata helper
          // `getWiring` from data/providers.
          if (!/(^|\/)data\/providers\b/.test(spec)) {
            offenders.push(`${path} -> ${spec}`);
          }
        }
      }
      expect(offenders).toEqual([]);
    });
  });

  describe('4. no enum declarations (erasable-only TS)', () => {
    it('no .ts file under src/ declares an enum', () => {
      const offenders: string[] = [];
      for (const [path, src] of FILES) {
        if (/\benum\s+[A-Za-z_$][\w$]*\s*[{(]/.test(src)) offenders.push(path);
      }
      expect(offenders).toEqual([]);
    });
  });
});
