/** Detail panel and overview of the data browser (pure rendering of contentIndex data). */
import type { Issue } from '../contentCheck';
import type { ContentIndex, Detail, Fact, LevelCard, Link, Section } from '../contentIndex';

export interface IssueView extends Issue {
  line?: number;
}

const DEV = import.meta.env.DEV;

export function Tier({ t, ix }: { t: number | null | undefined; ix: ContentIndex }) {
  if (t === undefined) return null;
  return (
    <span class={`tier ${t === null ? 'tnever' : `t${t}`}`} title={ix.tierName(t)}>
      {t === null ? '—' : `T${t}`}
    </span>
  );
}

function LinkRow({ l, ix }: { l: Link; ix: ContentIndex }) {
  return (
    <li>
      {l.key && ix.byKey.has(l.key) ? <a href={`#${l.key}`}>{l.label}</a> : <span class={l.key ? 'broken' : 'plain'}>{l.label}</span>}
      {l.detail ? <span class="det"> · {l.detail}</span> : null}
      <Tier t={l.tier} ix={ix} />
    </li>
  );
}

function SectionView({ s, ix }: { s: Section; ix: ContentIndex }) {
  return (
    <section class="sec">
      <h3>
        {s.title} <span class="count">{s.links.length || ''}</span>
      </h3>
      {s.links.length ? (
        <ul class="links">
          {s.links.map((l, i) => (
            <LinkRow key={i} l={l} ix={ix} />
          ))}
        </ul>
      ) : (
        <p class={s.warn ? 'empty warn' : 'empty'}>{s.empty ?? '—'}</p>
      )}
    </section>
  );
}

function Facts({ facts }: { facts: Fact[] }) {
  if (!facts.length) return null;
  return (
    <table class="facts">
      <tbody>
        {facts.map((f, i) => (
          <tr key={i} class={f.warn ? 'warn' : ''}>
            <th>{f.label}</th>
            <td>{f.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Level({ c, ix }: { c: LevelCard; ix: ContentIndex }) {
  return (
    <div class="level">
      <h3>
        <span class="lvl">Poziom {c.level}</span> {c.name} <Tier t={c.tier} ix={ix} />
      </h3>
      <p class="en">{c.nameEn}</p>
      <ul class="links unlock">
        <LinkRow l={{ ...c.unlock, label: `Odblokowanie: ${c.unlock.label}` }} ix={ix} />
      </ul>
      <Facts facts={c.facts} />
      <h4>Koszt</h4>
      <ul class="links">
        {c.cost.map((l, i) => (
          <LinkRow key={i} l={l} ix={ix} />
        ))}
      </ul>
      <h4>Receptury od tego poziomu ({c.recipes.length})</h4>
      {c.recipes.length ? (
        <ul class="links">
          {c.recipes.map((l, i) => (
            <LinkRow key={i} l={l} ix={ix} />
          ))}
        </ul>
      ) : (
        <p class="empty">—</p>
      )}
    </div>
  );
}

export function IssueList({ issues, ix, keyOf }: { issues: IssueView[]; ix: ContentIndex; keyOf?: (i: Issue) => string | undefined }) {
  return (
    <ul class="issues">
      {issues.map((i, n) => {
        const where = `${i.file}${i.line ? `:${i.line}` : ''}`;
        const k = keyOf?.(i);
        return (
          <li key={n} class={i.severity}>
            <div class="ihead">
              <b>{i.severity === 'error' ? 'BŁĄD' : 'OSTRZEŻENIE'}</b>{' '}
              {k && ix.byKey.has(k) ? <a href={`#${k}`}>{i.id}</a> : <span>{i.id}</span>} <code>{i.rule}</code>{' '}
              {DEV ? (
                <a class="file" href={`/__open-in-editor?file=${encodeURIComponent(where)}`} target="_blank" rel="noreferrer" title="Otwórz w edytorze (serwer Vite)">
                  {where}
                </a>
              ) : (
                <span class="file">{where}</span>
              )}
            </div>
            <p>{i.message}</p>
            <p class="fix">
              <b>Jak naprawić:</b> {i.fix}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

export function DetailView({ d, ix, issues }: { d: Detail; ix: ContentIndex; issues: IssueView[] }) {
  const e = d.entry;
  const copy = () => void navigator.clipboard?.writeText(e.id).catch(() => undefined);
  const declared = e.declaredTier !== undefined && e.declaredTier !== e.tier;
  return (
    <article class="detail" data-key={e.key}>
      <header>
        <p class="kind">{e.sub}</p>
        <h2>
          {d.title} <Tier t={e.tier} ix={ix} />
          {declared ? (
            <span class="tier tdecl" title="warstwa zapisana w danych różni się od analizy">
              w danych T{e.declaredTier}
            </span>
          ) : null}
        </h2>
        <p class="en">
          {e.nameEn} ·{' '}
          <button class="id" onClick={copy} title="Kopiuj id">
            {e.id}
          </button>
        </p>
        {e.biomes.length && e.kind !== 'biome' ? (
          <p class="biomes">
            {e.biomes.map((b) => (
              <a key={b} class="chip" href={`#biome:${b}`}>
                {ix.biomes.find((x) => x.id === b)?.name ?? b}
              </a>
            ))}
          </p>
        ) : null}
        {d.desc ? <p class="desc">{d.desc}</p> : null}
      </header>
      {issues.length ? <IssueList issues={issues} ix={ix} /> : null}
      <div class="cols">
        <div>
          <Facts facts={d.facts} />
          {d.research.length ? (
            <section class="sec">
              <h3>Badania</h3>
              <ul class="links">
                {d.research.map((l, i) => (
                  <LinkRow key={i} l={l} ix={ix} />
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
      {d.levels ? (
        <div class="levels">
          {d.levels.map((c) => (
            <Level key={c.level} c={c} ix={ix} />
          ))}
        </div>
      ) : null}
      <div class="sections">
        {d.sections.map((s, i) => (
          <SectionView key={i} s={s} ix={ix} />
        ))}
      </div>
    </article>
  );
}

export function Overview({ ix, issues, keyOf, counts }: { ix: ContentIndex; issues: IssueView[]; keyOf: (i: Issue) => string | undefined; counts: [string, number][] }) {
  const errors = issues.filter((i) => i.severity === 'error').length;
  return (
    <article class="detail overview">
      <header>
        <p class="kind">Przegląd</p>
        <h2>Przeglądarka treści Underhearth</h2>
        <p class="desc">
          Wszystko z <code>src/content/</code> w jednym miejscu: wyszukaj element, a zobaczysz, skąd się bierze, do czego służy, w którym biomie
          występuje i które badanie go odblokowuje. Zmiana w danych odświeża stronę sama (serwer Vite). Strona tylko czyta dane — niczego nie zapisuje.
        </p>
        <p class="desc">
          Skróty: <kbd>/</kbd> szukaj · <kbd>↑</kbd> <kbd>↓</kbd> poprzedni/następny wynik · <kbd>Esc</kbd> wyczyść wyszukiwanie · link do elementu
          (adres z <code>#</code>) można wkleić koledze.
        </p>
      </header>
      <table class="facts">
        <tbody>
          {counts.map(([k, v]) => (
            <tr key={k}>
              <th>{k}</th>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <section class="sec">
        <h3>
          Walidator treści: {errors} błędów, {issues.length - errors} ostrzeżeń
        </h3>
        <p class="empty">
          Te same reguły co <code>node scripts/content-check.mjs</code> (opis reguł: <code>docs/tools/TOOLS.md</code>).
        </p>
        {issues.length ? <IssueList issues={issues} ix={ix} keyOf={keyOf} /> : <p class="empty">Brak uwag.</p>}
      </section>
    </article>
  );
}
