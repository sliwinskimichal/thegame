/**
 * Data browser for designers (tools.html): search and filter the whole game
 * content; for the selected entry see where it comes from, what it is used for,
 * its biomes, tier and research node, plus the validator's remarks about it.
 * Read-only: it never writes data. Selection lives in the URL hash
 * (`#resource:copper_bar`), so links can be shared and Back works.
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { analyze } from '../../content/analysis';
import { realBundle } from '../contentBundle';
import { checkContent, locateLine, summarize, type Issue } from '../contentCheck';
import { buildIndex, filterEntries, GROUPS, issuesByKey, type Entry, type Group } from '../contentIndex';
import { DetailView, Overview, Tier, type IssueView } from './Detail';

// Raw data sources, only to put line numbers on validator remarks.
const RAW = {
  ...import.meta.glob<string>('../../content/*.ts', { query: '?raw', import: 'default', eager: true }),
  ...import.meta.glob<string>('../../world/materials.ts', { query: '?raw', import: 'default', eager: true }),
};
const SOURCES = new Map(Object.entries(RAW).map(([p, src]) => [p.replace('../../', 'src/'), src]));

const bundle = realBundle();
const analysis = analyze();
const IX = buildIndex(bundle, analysis);
const CHECK = checkContent(bundle, { analysis });
const SUM = summarize(CHECK);
const ISSUES: IssueView[] = CHECK.issues.map((i) => {
  const src = SOURCES.get(i.file);
  return { ...i, line: src ? locateLine(src, i.id) : undefined };
});
const BY_KEY = issuesByKey(IX, ISSUES);
const KEY_OF_ISSUE = new Map<Issue, string>();
for (const [k, list] of BY_KEY) for (const i of list) KEY_OF_ISSUE.set(i, k);
const WITH_ISSUES = new Set(BY_KEY.keys());
const COUNTS: [string, number][] = [
  ['Surowce kopalne', bundle.resources.filter((r) => r.kind === 'raw').length],
  ['Surowce z obiektów i stworzeń', bundle.resources.filter((r) => r.kind === 'drop').length],
  ['Materiały wytwarzane', bundle.resources.filter((r) => r.kind === 'material').length],
  ['Przedmioty', bundle.resources.filter((r) => r.kind === 'item').length],
  ['Budowle (poziomy)', bundle.buildings.length],
  ['Receptury', bundle.recipes.length],
  ['Węzły badań', bundle.tech.length],
  ['Biomy', bundle.biomes.length],
  ['Złoża', bundle.deposits.length],
  ['Stworzenia (bossowie)', bundle.creatures.length],
  ['Infrastruktura', bundle.infrastructure.length],
  ['Wielkie Dzieła', bundle.greatWorks.length],
  ['Materiały świata', bundle.materials.length],
];

declare global {
  interface Window {
    __tools?: { ready: boolean; entries: number; errors: number; warnings: number; selected: () => string };
  }
}

const keyFromHash = () => decodeURIComponent(location.hash.slice(1));
const go = (key: string) => {
  location.hash = key;
};

export function App() {
  const [q, setQ] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [biome, setBiome] = useState('');
  const [tierMin, setTierMin] = useState<number | undefined>(undefined);
  const [tierMax, setTierMax] = useState<number | undefined>(undefined);
  const [slot, setSlot] = useState('');
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [sel, setSel] = useState(keyFromHash());
  const search = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = () => setSel(keyFromHash());
    addEventListener('hashchange', h);
    window.__tools = { ready: true, entries: IX.entries.length, errors: SUM.errors, warnings: SUM.warnings, selected: () => keyFromHash() };
    return () => removeEventListener('hashchange', h);
  }, []);

  const base = { q, biome: biome || undefined, tierMin, tierMax, slot: slot || undefined, keys: onlyIssues ? WITH_ISSUES : undefined };
  const results = useMemo(() => filterEntries(IX, { ...base, groups }), [q, groups, biome, tierMin, tierMax, slot, onlyIssues]);
  const groupCounts = useMemo(() => {
    const m = new Map<Group, number>();
    for (const e of filterEntries(IX, base)) m.set(e.group, (m.get(e.group) ?? 0) + 1);
    return m;
  }, [q, biome, tierMin, tierMax, slot, onlyIssues]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const typing = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
      if (e.key === '/' && !typing) {
        e.preventDefault();
        search.current?.focus();
        search.current?.select();
      } else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && tag !== 'SELECT' && results.length) {
        e.preventDefault();
        const i = results.findIndex((r) => r.key === sel);
        const next = results[Math.max(0, Math.min(results.length - 1, i < 0 ? 0 : i + (e.key === 'ArrowDown' ? 1 : -1)))]!;
        history.replaceState(null, '', `#${next.key}`);
        setSel(next.key);
      } else if (e.key === 'Escape') {
        setQ('');
        search.current?.blur();
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [results, sel]);

  useEffect(() => {
    document.querySelector(`.list [data-key="${CSS.escape(sel)}"]`)?.scrollIntoView({ block: 'nearest' });
    const e = IX.byKey.get(sel);
    document.title = e ? `${e.name} — przeglądarka treści` : 'Underhearth — przeglądarka treści';
  }, [sel]);

  const toggleGroup = (g: Group) => setGroups((gs) => (gs.includes(g) ? gs.filter((x) => x !== g) : [...gs, g]));
  const reset = () => {
    setQ('');
    setGroups([]);
    setBiome('');
    setTierMin(undefined);
    setTierMax(undefined);
    setSlot('');
    setOnlyIssues(false);
  };
  const detail = sel ? IX.detail(sel) : undefined;
  const tierOpt = (v: number | undefined, set: (x: number | undefined) => void, label: string) => (
    <select value={v === undefined ? '' : String(v)} onChange={(e) => set(e.currentTarget.value === '' ? undefined : Number(e.currentTarget.value))} aria-label={label}>
      <option value="">{label}</option>
      {IX.biomes.map((b) => (
        <option key={b.tier} value={String(b.tier)}>
          T{b.tier} {b.name}
        </option>
      ))}
    </select>
  );

  return (
    <div class="app">
      <header class="top">
        <a class="brand" href="#" onClick={() => setSel('')}>
          Underhearth · <span>przeglądarka treści</span>
        </a>
        <button class={`badge ${SUM.errors ? 'bad' : SUM.warnings ? 'meh' : 'ok'} ${onlyIssues ? 'on' : ''}`} onClick={() => setOnlyIssues((v) => !v)} title="Pokaż tylko elementy z uwagami walidatora">
          walidator: {SUM.errors} błędów · {SUM.warnings} ostrzeżeń
        </button>
        <span class="hint">
          <kbd>/</kbd> szukaj · <kbd>↑↓</kbd> wyniki
        </span>
      </header>
      <aside class="side">
        <input
          ref={search}
          class="search"
          type="search"
          placeholder="Szukaj: nazwa PL/EN albo id (np. miedz, brass, iron_ore)…"
          value={q}
          onInput={(e) => setQ(e.currentTarget.value)}
          autofocus
        />
        <div class="chips">
          {GROUPS.map((g) => (
            <button key={g.id} class={`chip ${groups.includes(g.id) ? 'on' : ''}`} onClick={() => toggleGroup(g.id)}>
              {g.label} <span>{groupCounts.get(g.id) ?? 0}</span>
            </button>
          ))}
        </div>
        <div class="filters">
          <select value={biome} onChange={(e) => setBiome(e.currentTarget.value)} aria-label="Biom">
            <option value="">Wszystkie biomy</option>
            {IX.biomes.map((b) => (
              <option key={b.id} value={b.id}>
                T{b.tier} {b.name}
              </option>
            ))}
          </select>
          {tierOpt(tierMin, setTierMin, 'Warstwa od')}
          {tierOpt(tierMax, setTierMax, 'Warstwa do')}
          <select value={slot} onChange={(e) => setSlot(e.currentTarget.value)} aria-label="Slot przedmiotu">
            <option value="">Każdy slot</option>
            {IX.slots.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <label class="check">
            <input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.currentTarget.checked)} /> tylko z uwagami
          </label>
          <button class="reset" onClick={reset}>
            wyczyść filtry
          </button>
        </div>
        <p class="meta">
          {results.length} z {IX.entries.length}
        </p>
        <ul class="list">
          {results.map((e: Entry) => (
            <li key={e.key} data-key={e.key} class={e.key === sel ? 'sel' : ''}>
              <a href={`#${e.key}`} onClick={() => go(e.key)}>
                <span class="name">
                  {e.name}
                  {BY_KEY.has(e.key) ? <i class={`dot ${BY_KEY.get(e.key)!.some((i) => i.severity === 'error') ? 'error' : 'warning'}`} title="uwagi walidatora" /> : null}
                </span>
                <span class="sub">{e.sub}</span>
                <Tier t={e.tier} ix={IX} />
              </a>
            </li>
          ))}
        </ul>
      </aside>
      <main class="main">
        {detail ? (
          <DetailView d={detail} ix={IX} issues={BY_KEY.get(sel) ?? []} />
        ) : (
          <Overview ix={IX} issues={ISSUES} keyOf={(i) => KEY_OF_ISSUE.get(i)} counts={COUNTS} />
        )}
      </main>
    </div>
  );
}
