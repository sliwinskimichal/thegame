/**
 * Command-line front end of the content validator. All I/O is injected, so the
 * tests run it in-process; scripts/content-check.mjs supplies the real I/O and
 * a TypeScript module loader. The data is loaded lazily through `loadModule`,
 * so a broken data file becomes a readable message instead of a stack trace.
 *
 * Exit codes: 0 = no errors (warnings allowed unless --strict), 1 = errors in
 * the data, 2 = the data could not be loaded or the arguments are wrong.
 */
import type { Analysis } from '../content/analysis';
import { checkContent, explainLoadError, formatReport, locateLine, RULES, suggest, summarize, type CheckResult, type ContentBundle, type Issue } from './contentCheck';

export interface CliIO {
  /** Imports a module by repository-relative (or absolute) path. */
  loadModule(path: string): Promise<Record<string, unknown>>;
  /** Reads a repository-relative text file; undefined when missing. */
  readFile(path: string): string | undefined;
  out(text: string): void;
  err(text: string): void;
  color: boolean;
  now(): number;
}

export const USAGE = `Walidator treści Underhearth — sprawdza src/content/*.ts i src/world/materials.ts.

Użycie: node scripts/content-check.mjs [opcje]
  --strict           ostrzeżenia też kończą się kodem 1 (dla CI)
  --quiet, -q        pokaż tylko błędy (ostrzeżenia są liczone w podsumowaniu)
  --verbose, -v      wypisz celowe wyjątki (np. paczki badań, finałowe trofeum)
  --only=<reguły>    tylko wybrane reguły lub grupy, np. --only=ref,boss.trophyTech
  --json             wynik maszynowy (issues z numerami linii, skipped, counts)
  --bundle <plik.ts> sprawdź inny zestaw treści (eksport \`bundle\` [+ \`analysis\`])
  --no-color         bez kolorów (domyślnie kolory tylko w terminalu)
  --help, -h         ta pomoc

Kody wyjścia: 0 = brak błędów, 1 = błędy w danych, 2 = dane się nie wczytały / złe opcje.
Reguły i przykłady napraw: docs/tools/TOOLS.md.`;

export interface CliArgs {
  json: boolean;
  strict: boolean;
  quiet: boolean;
  verbose: boolean;
  help: boolean;
  only: string[];
  bundle?: string;
}

export function parseArgs(argv: readonly string[]): CliArgs | { error: string } {
  const a: CliArgs = { json: false, strict: false, quiet: false, verbose: false, help: false, only: [] };
  for (let i = 0; i < argv.length; i++) {
    const x = argv[i]!;
    const [flag, inline] = x.startsWith('--') && x.includes('=') ? [x.slice(0, x.indexOf('=')), x.slice(x.indexOf('=') + 1)] : [x, undefined];
    const value = () => inline ?? argv[++i];
    switch (flag) {
      case '--json': a.json = true; break;
      case '--strict': a.strict = true; break;
      case '--quiet': case '-q': a.quiet = true; break;
      case '--verbose': case '-v': a.verbose = true; break;
      case '--help': case '-h': a.help = true; break;
      case '--no-color': break; // handled by the bootstrap (colour decision)
      case '--only': {
        const v = value();
        if (!v) return { error: 'Opcja --only wymaga listy reguł, np. --only=ref,boss.' };
        a.only.push(...v.split(',').map((s) => s.trim()).filter(Boolean));
        break;
      }
      case '--bundle': {
        const v = value();
        if (!v) return { error: 'Opcja --bundle wymaga ścieżki do modułu .ts.' };
        a.bundle = v;
        break;
      }
      default:
        return { error: `Nieznana opcja „${x}”.` };
    }
  }
  const groups = new Set(Object.keys(RULES).map((r) => r.split('.')[0]!));
  for (const p of a.only)
    if (!(p in RULES) && !groups.has(p)) {
      const s = suggest(p, [...Object.keys(RULES), ...groups]);
      return { error: `Nieznana reguła lub grupa „${p}”.${s.length ? ` Czy chodziło o ${s.map((x) => `„${x}”`).join(' albo ')}?` : ''}` };
    }
  return a;
}

const matches = (rule: string, only: readonly string[]) => !only.length || only.some((p) => rule === p || rule.startsWith(`${p}.`));

export async function runContentCheck(argv: readonly string[], io: CliIO): Promise<number> {
  const a = parseArgs(argv);
  if ('error' in a) {
    io.err(`${a.error}\n\n${USAGE}`);
    return 2;
  }
  if (a.help) {
    io.out(USAGE);
    return 0;
  }
  const t0 = io.now();
  let bundle: ContentBundle;
  let analysis: Analysis | undefined;
  const notes: string[] = [];
  try {
    if (a.bundle) {
      const m = await io.loadModule(a.bundle);
      const b = m.bundle ?? m.default;
      bundle = (typeof b === 'function' ? (b as () => ContentBundle)() : b) as ContentBundle;
      if (!bundle || typeof bundle !== 'object') throw new Error(`moduł ${a.bundle} nie eksportuje „bundle” (ContentBundle)`);
      analysis = m.analysis as Analysis | undefined;
      if (!analysis) notes.push('Reguły prog.* pominięte: moduł z --bundle nie eksportuje „analysis”.');
    } else {
      const mb = await io.loadModule('src/tools/contentBundle.ts');
      bundle = (mb.realBundle as () => ContentBundle)();
      const ma = await io.loadModule('src/content/analysis.ts');
      analysis = (ma.analyze as () => Analysis)();
    }
  } catch (e) {
    const x = explainLoadError(e);
    if (a.json) io.out(JSON.stringify({ ok: false, loadError: x }, null, 2));
    else io.err(`BŁĄD WCZYTYWANIA DANYCH\n    ${x.message}\n    Jak naprawić: ${x.fix}`);
    return 2;
  }

  const full = checkContent(bundle, { analysis });
  const result: CheckResult = { ...full, issues: full.issues.filter((i) => matches(i.rule, a.only)), skipped: full.skipped.filter((s) => matches(s.rule, a.only)) };
  const ms = Math.round(io.now() - t0);
  const files = new Map<string, string | undefined>();
  const line = (i: Issue) => {
    if (!files.has(i.file)) files.set(i.file, io.readFile(i.file));
    const src = files.get(i.file);
    return src ? locateLine(src, i.id) : undefined;
  };
  const s = summarize(result);

  if (a.json) {
    io.out(
      JSON.stringify(
        { ok: s.errors === 0 && !(a.strict && s.warnings > 0), errors: s.errors, warnings: s.warnings, issues: result.issues.map((i) => ({ ...i, line: line(i) ?? null })), skipped: result.skipped, counts: result.counts, notes, ms },
        null,
        2,
      ),
    );
  } else {
    const scope = a.only.length ? ` · tylko: ${a.only.join(', ')}` : '';
    io.out(`Walidator treści Underhearth · src/content/*.ts + src/world/materials.ts${scope}\n`);
    io.out(
      formatReport(result, {
        color: io.color,
        line,
        verbose: a.verbose,
        hideWarnings: a.quiet,
        footer: [...notes, `Czas: ${ms} ms${a.quiet && s.warnings ? ` · ukryto ostrzeżenia: ${s.warnings} (bez -q zobaczysz je)` : ''}${a.strict ? ' · tryb --strict' : ''}`].join('\n'),
      }),
    );
  }
  return s.errors > 0 || (a.strict && s.warnings > 0) ? 1 : 0;
}
