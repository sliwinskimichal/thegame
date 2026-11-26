/**
 * Searchable index of the game content for the data browser (tools.html).
 *
 * One entry per resource, building, recipe, research node, biome, deposit,
 * creature, harvestable object, hazard, infrastructure piece, Great Work and
 * world material. For each entry `detail()` answers the designer's questions:
 * where does it come from, what is it used for, in which biome, at which tier
 * and through which research node. Pure (bundle + analysis in, plain data out):
 * the Preact view only renders it, and tests check it in node.
 */
import type { Analysis } from '../content/analysis';
import type { Biome, Building, Hazard, Recipe, Resource, Stack } from '../content/types';
import type { ContentBundle, Issue } from './contentCheck';

export type EntryKind = 'resource' | 'building' | 'recipe' | 'tech' | 'biome' | 'deposit' | 'creature' | 'object' | 'hazard' | 'infra' | 'greatwork' | 'material';
export type Group = 'resources' | 'items' | 'buildings' | 'recipes' | 'tech' | 'biomes' | 'other';

export const GROUPS: readonly { id: Group; label: string }[] = [
  { id: 'resources', label: 'Surowce i materiały' },
  { id: 'items', label: 'Przedmioty' },
  { id: 'buildings', label: 'Budowle' },
  { id: 'recipes', label: 'Receptury' },
  { id: 'tech', label: 'Badania' },
  { id: 'biomes', label: 'Biomy' },
  { id: 'other', label: 'Złoża, stworzenia, inne' },
];

/** A row that can link to another entry. */
export interface Link {
  key?: string;
  label: string;
  detail?: string;
  tier?: number | null;
}
export interface Section {
  title: string;
  links: Link[];
  /** Shown when `links` is empty; `warn` marks it as a likely problem. */
  empty?: string;
  warn?: boolean;
}
export interface Fact {
  label: string;
  value: string;
  warn?: boolean;
}
export interface LevelCard {
  level: number;
  name: string;
  nameEn: string;
  tier: number | null;
  unlock: Link;
  facts: Fact[];
  cost: Link[];
  recipes: Link[];
}

export interface Entry {
  key: string;
  kind: EntryKind;
  id: string;
  group: Group;
  name: string;
  nameEn: string;
  sub: string;
  /** Earliest tier at which it is obtainable/buildable/researchable (analysis); null = never or not applicable. */
  tier: number | null;
  /** Tier written in the data, when the data declares one. */
  declaredTier?: number;
  /** Biomes where it is found (sources) or, for crafted things, the biome of its tier. */
  biomes: string[];
  slot?: string;
  hay: string;
}

export interface Detail {
  entry: Entry;
  title: string;
  desc?: string;
  facts: Fact[];
  /** Research: what unlocks it / what reveals it. */
  research: Link[];
  sections: Section[];
  levels?: LevelCard[];
}

export interface ContentIndex {
  entries: Entry[];
  byKey: Map<string, Entry>;
  detail(key: string): Detail | undefined;
  biomes: { id: string; name: string; tier: number }[];
  slots: { id: string; label: string }[];
  tierName(t: number | null | undefined): string;
}

// ------------------------------------------------------------------ labels (PL)
export const SLOT_PL: Readonly<Record<string, string>> = {
  pick: 'kilof', tool: 'narzędzie', weapon: 'broń', offhand: 'tarcza', ammo: 'amunicja', head: 'głowa', body: 'tułów',
  feet: 'stopy', hands: 'dłonie', back: 'plecy', gear: 'sprzęt', trinket: 'amulet / pierścień', consumable: 'do zużycia',
};
const CAT_PL: Readonly<Record<string, string>> = {
  core: 'serce grodu', living: 'mieszkalna', food: 'żywność', production: 'produkcja', research: 'badania', logistics: 'logistyka', power: 'energia', defense: 'obrona',
};
const BEHAVIOR_PL: Readonly<Record<string, string>> = {
  passive: 'bierne', skittish: 'płochliwe', territorial: 'terytorialne', hunter: 'łowca', swarm: 'rój', raider: 'najeźdźca', ambusher: 'atakuje z zasadzki', boss: 'boss',
};
const RARITY_PL: Readonly<Record<string, string>> = { common: 'pospolite', uncommon: 'niepospolite', rare: 'rzadkie', legendary: 'legendarne' };
const TOOL_PL: Readonly<Record<string, string>> = { axe: 'siekiera', pick: 'kilof', rod: 'wędka', hands: 'gołe ręce' };
const KIND_PL: Readonly<Record<string, string>> = { raw: 'Surowiec kopalny', drop: 'Surowiec z obiektów i stworzeń', material: 'Materiał wytwarzany', item: 'Przedmiot' };
const STAT_PL: Readonly<Record<string, string>> = {
  pickTier: 'Poziom kilofa', workSpeed: 'Szybkość pracy ×', damage: 'Obrażenia', armor: 'Pancerz', light: 'Światło (kafle)', carry: 'Udźwig +',
  coldRes: 'Odporność na mróz', heatRes: 'Odporność na żar', gasRes: 'Odporność na gazy', waterRes: 'Odporność na wodę', dreadRes: 'Odporność na grozę',
  food: 'Sytość', drink: 'Napój', heal: 'Leczenie', mood: 'Nastrój', duration: 'Czas działania (s)', durability: 'Trwałość',
};
const EFFECT_PL: Readonly<Record<string, string>> = {
  popCap: 'limit mieszkańców', morale: 'morale', radius: 'promień', storage: 'magazyn', capacity: 'pojemność', autosort: 'auto-sortowanie', beds: 'łóżka',
  rest: 'odpoczynek ×', mood: 'nastrój', speed: 'szybkość ×', plots: 'poletka', surfaceOnly: 'tylko na powierzchni', yield: 'plon ×', research: 'badania ×',
  packTier: 'paczki do warstwy', guards: 'strażnicy', training: 'trening ×', damage: 'obrażenia', range: 'zasięg', rate: 'strzały/s', vsConstructs: 'vs konstrukty ×',
  flow: 'przepływ', lava: 'pompuje lawę', needsWater: 'wymaga strumienia', fuelPerMin: 'paliwo/min', needsLava: 'wymaga lawy', cargo: 'ładunek', carts: 'wagoniki',
  autoload: 'auto-załadunek', routes: 'trasy', heal: 'leczenie', cure: 'leczy wszystko', migrants: 'przybysze ×', tilesPerMin: 'kafle/min',
};
const RES_STATS = new Set(['coldRes', 'heatRes', 'gasRes', 'waterRes', 'dreadRes']);

/** Lower case, no diacritics (ł too), so "miedz" finds "miedź". */
export function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/ł/g, 'l');
}

const fin = (t: number | undefined): number | null => (t !== undefined && Number.isFinite(t) ? t : null);
const num = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

// ------------------------------------------------------------------ build

export function buildIndex(b: ContentBundle, A: Analysis): ContentIndex {
  const RES = new Map(b.resources.map((r) => [r.id, r]));
  const BLD = new Map(b.buildings.map((x) => [x.id, x]));
  const REC = new Map(b.recipes.map((x) => [x.id, x]));
  const TEC = new Map(b.tech.map((x) => [x.id, x]));
  const BIO = new Map<string, Biome>(b.biomes.map((x) => [x.id, x]));
  const INF = new Map(b.infrastructure.map((x) => [x.id, x]));
  const HAZ = new Map<string, Hazard>(b.hazards.map((x) => [x.id, x]));
  const biomeOfTier = new Map(b.biomes.map((x) => [x.tier, x]));
  const tierName = (t: number | null | undefined) =>
    t === null || t === undefined || !Number.isFinite(t) ? 'nigdy' : `T${t}${biomeOfTier.get(t) ? ` · ${biomeOfTier.get(t)!.namePl}` : ''}`;
  const biomeIdOfTier = (t: number | null) => (t === null ? [] : biomeOfTier.get(t) ? [biomeOfTier.get(t)!.id] : []);
  const minBiomeTier = (ids: readonly string[]) => fin(Math.min(...ids.map((x) => BIO.get(x)?.tier ?? Infinity)));
  const resTier = (id: string) => fin(A.res.get(id));

  // unlocks: key -> tech ids
  const unlockers = new Map<string, string[]>();
  for (const t of b.tech) {
    const add = (k: string) => unlockers.set(k, [...(unlockers.get(k) ?? []), t.id]);
    for (const r of t.unlocks.recipes ?? []) add(`recipe:${r}`);
    for (const [bid, l] of t.unlocks.buildings ?? []) add(`building:${bid}:${l}`);
    for (const i of t.unlocks.infra ?? []) add(`infra:${i}`);
  }
  const startB = new Set(b.startBuildings.map(([x, l]) => `${x}:${l}`));
  const startR = new Set(b.startRecipes);
  const startI = new Set(b.startInfra);
  const unlockLink = (k: string, isStart: boolean): Link => {
    if (isStart) return { label: 'dostępne od startu', tier: 0 };
    const by = unlockers.get(k) ?? [];
    if (!by.length) return { label: 'nic tego nie odblokowuje!', detail: 'zob. walidator: unlock.missing' };
    const t = TEC.get(by[0]!)!;
    return { key: `tech:${t.id}`, label: t.namePl, detail: `badanie T${t.tier}${by.length > 1 ? ` (+${by.length - 1} inne)` : ''}`, tier: t.tier };
  };

  // names
  const resLabel = (id: string) => RES.get(id)?.namePl ?? id;
  const lvlName = (bid: string, l: number) => BLD.get(bid)?.levels[l - 1]?.namePl ?? `${bid}:${l}`;
  const recipeName = (r: Recipe) => r.outputs.map((o) => `${resLabel(o.id)}${o.n > 1 ? ` ×${o.n}` : ''}`).join(' + ');
  const stacksText = (ss: readonly Stack[]) => ss.map((s) => `${s.n}× ${resLabel(s.id)}`).join(', ') || '—';
  const stackLinks = (ss: readonly Stack[]): Link[] => ss.map((s) => ({ key: `resource:${s.id}`, label: resLabel(s.id), detail: `${s.n}×`, tier: resTier(s.id) }));

  // relations
  const producedBy = new Map<string, Recipe[]>();
  const consumedBy = new Map<string, Recipe[]>();
  for (const r of b.recipes) {
    for (const o of r.outputs) producedBy.set(o.id, [...(producedBy.get(o.id) ?? []), r]);
    for (const i of r.inputs) consumedBy.set(i.id, [...(consumedBy.get(i.id) ?? []), r]);
  }
  const recipeLink = (r: Recipe, detail?: string): Link => ({
    key: `recipe:${r.id}`,
    label: recipeName(r),
    detail: detail ?? `${lvlName(r.at, r.level)} · ${stacksText(r.inputs)} · ${r.time} s`,
    tier: fin(A.recipe.get(r.id)),
  });
  const counters = new Map<string, string[]>(); // thing -> hazards
  for (const h of b.hazards) for (const c of h.counters) counters.set(c, [...(counters.get(c) ?? []), h.id]);
  const counterSection = (id: string): Section => ({
    title: 'Chroni przed',
    links: (counters.get(id) ?? []).map((h) => ({ key: `hazard:${h}`, label: HAZ.get(h)!.namePl, detail: HAZ.get(h)!.descPl })),
  });
  const bossOf = new Map<string, string>();
  for (const c of b.creatures) if (c.boss) for (const d of c.drops) if (RES.get(d.id)?.tags?.includes('trophy')) bossOf.set(d.id, c.id);

  const entries: Entry[] = [];
  const details = new Map<string, () => Detail>();
  const add = (e: Omit<Entry, 'hay'>, extraHay: string[], detail: (entry: Entry) => Omit<Detail, 'entry'>) => {
    const entry: Entry = { ...e, hay: normalize([e.name, e.nameEn, e.id, e.sub, ...extraHay].join(' ')) };
    entries.push(entry);
    details.set(entry.key, () => ({ entry, ...detail(entry) }));
  };

  // ---------------------------------------------------------------- resources
  for (const r of b.resources) {
    const trophy = r.tags?.includes('trophy');
    const pack = b.researchPacks.indexOf(r.id);
    const sub =
      r.kind === 'item'
        ? `Przedmiot · ${SLOT_PL[r.slot ?? ''] ?? r.slot ?? '?'}`
        : trophy
          ? 'Trofeum bossa'
          : pack >= 0
            ? `Paczka badań T${pack}`
            : (KIND_PL[r.kind] ?? r.kind);
    const deps = b.deposits.filter((d) => d.yields === r.id);
    const objs = b.objects.filter((o) => o.drops.some((d) => d.id === r.id));
    const crs = b.creatures.filter((c) => c.drops.some((d) => d.id === r.id));
    const tier = resTier(r.id);
    const found = [...new Set([...deps.flatMap((d) => d.biomes), ...objs.flatMap((o) => o.biomes), ...crs.map((c) => c.biome)])];
    const biomes = r.id === b.rockYield ? b.biomes.map((x) => x.id) : found.length ? found : biomeIdOfTier(tier);
    add({ key: `resource:${r.id}`, kind: 'resource', id: r.id, group: r.kind === 'item' ? 'items' : 'resources', name: r.namePl, nameEn: r.nameEn, sub, tier, declaredTier: r.tier, biomes, slot: r.slot }, r.tags ? [...r.tags] : [], () => {
      const facts: Fact[] = [
        { label: 'Rodzaj', value: `${KIND_PL[r.kind] ?? r.kind}${r.slot ? ` · slot: ${SLOT_PL[r.slot] ?? r.slot}` : ''}` },
        { label: 'Warstwa w danych', value: tierName(r.tier), warn: tier !== r.tier },
        { label: 'Dostępny od (analiza)', value: tierName(tier), warn: tier !== r.tier },
        { label: 'Wartość / stos', value: `${r.value} / ${r.stack}` },
      ];
      if (r.tags?.length) facts.push({ label: 'Tagi', value: r.tags.join(', ') });
      for (const [k, v] of Object.entries(r.stats ?? {}))
        facts.push({ label: STAT_PL[k] ?? k, value: RES_STATS.has(k) ? `${Math.round(v * 100)}%` : num(v), warn: v === 0 });
      const research: Link[] = [];
      for (const rc of producedBy.get(r.id) ?? []) {
        const u = unlockLink(`recipe:${rc.id}`, startR.has(rc.id));
        research.push({ ...u, label: `${u.label}`, detail: `${u.detail ? `${u.detail} · ` : ''}receptura ${rc.id}` });
      }
      if (b.startDiscovered.includes(r.id)) research.push({ label: 'znany od startu (START_DISCOVERED)', tier: 0 });
      const sources: Link[] = [
        ...deps.map((d) => ({
          key: `deposit:${d.id}`, label: d.namePl,
          detail: `złoże · ${d.biomes.map((x) => BIO.get(x)?.namePl ?? x).join(', ')} · kilof ≥ ${d.pickTier} · twardość ${d.hardness} · ${d.amount}/kafel · ${RARITY_PL[d.rarity] ?? d.rarity}`,
          tier: minBiomeTier(d.biomes),
        })),
        ...(r.id === b.rockYield ? [{ label: 'Zwykła skała każdego biomu', detail: 'kilof wg ROCK_PICK_TIER', tier: 0 }] : []),
        ...objs.map((o) => {
          const d = o.drops.find((x) => x.id === r.id)!;
          return { key: `object:${o.id}`, label: o.namePl, detail: `obiekt · ${d.min}–${d.max} szt.${d.chance < 1 ? ` · ${Math.round(d.chance * 100)}%` : ''} · ${TOOL_PL[o.tool ?? 'hands']} · ${o.biomes.map((x) => BIO.get(x)?.namePl ?? x).join(', ')}`, tier: minBiomeTier(o.biomes) };
        }),
        ...crs.map((c) => {
          const d = c.drops.find((x) => x.id === r.id)!;
          return { key: `creature:${c.id}`, label: `${c.namePl}${c.boss ? ' (boss)' : ''}`, detail: `łup · ${d.min}–${d.max} szt.${d.chance < 1 ? ` · ${Math.round(d.chance * 100)}%` : ''} · ${BIO.get(c.biome)?.namePl ?? c.biome}`, tier: fin(BIO.get(c.biome)?.tier) };
        }),
        ...(producedBy.get(r.id) ?? []).map((rc) => recipeLink(rc)),
      ];
      const uses: Link[] = [
        ...(consumedBy.get(r.id) ?? []).map((rc) => recipeLink(rc, `${rc.inputs.find((i) => i.id === r.id)!.n}× · ${lvlName(rc.at, rc.level)}`)),
        ...b.buildings.flatMap((x) =>
          x.levels.flatMap((lv, k) => {
            const s = lv.cost.find((c) => c.id === r.id);
            return s ? [{ key: `building:${x.id}`, label: `${lv.namePl} (poziom ${k + 1})`, detail: `${s.n}× · koszt budowy`, tier: fin(A.building.get(`${x.id}:${k + 1}`)) }] : [];
          }),
        ),
        ...b.infrastructure.flatMap((i) => {
          const s = i.cost.find((c) => c.id === r.id);
          return s ? [{ key: `infra:${i.id}`, label: i.namePl, detail: `${s.n}× · infrastruktura`, tier: fin(A.infra.get(i.id)) }] : [];
        }),
        ...b.tech.flatMap((t) => {
          const s = t.cost.find((c) => c.id === r.id);
          return s ? [{ key: `tech:${t.id}`, label: t.namePl, detail: `${s.n}× · koszt badania T${t.tier}`, tier: t.tier }] : [];
        }),
        ...b.greatWorks.flatMap((g) =>
          g.stages.flatMap((st, k) => {
            const s = st.cost.find((c) => c.id === r.id);
            return s ? [{ key: `greatwork:${g.id}`, label: g.namePl, detail: `${s.n}× · etap ${k + 1} „${st.namePl}”`, tier: g.tier }] : [];
          }),
        ),
      ];
      const reveals = b.tech.filter((t) => t.revealBy.includes(r.id)).map((t) => ({ key: `tech:${t.id}`, label: t.namePl, detail: `badanie T${t.tier}`, tier: t.tier }));
      const sections: Section[] = [
        { title: 'Skąd się bierze', links: sources, empty: 'Brak źródła — tego nie da się zdobyć!', warn: true },
        { title: 'Do czego służy', links: uses, empty: r.kind === 'item' ? 'Nie jest składnikiem — używa go krasnolud (ekwipunek).' : 'Nic tego nie zużywa (ślepa uliczka).', warn: r.kind !== 'item' },
      ];
      if (reveals.length) sections.push({ title: 'Odsłania węzły badań', links: reveals });
      if (counters.has(r.id)) sections.push(counterSection(r.id));
      if (trophy && bossOf.has(r.id)) {
        const c = b.creatures.find((x) => x.id === bossOf.get(r.id))!;
        facts.push({ label: 'Boss', value: `${c.namePl} (${BIO.get(c.biome)?.namePl ?? c.biome})` });
      }
      return { title: r.namePl, desc: r.descPl, facts, research, sections };
    });
  }

  // ---------------------------------------------------------------- buildings
  const levelTier = (x: Building, k: number) => fin(A.building.get(`${x.id}:${k + 1}`));
  for (const x of b.buildings) {
    const t1 = levelTier(x, 0);
    add(
      { key: `building:${x.id}`, kind: 'building', id: x.id, group: 'buildings', name: x.levels[0].namePl, nameEn: x.levels[0].nameEn, sub: `Budowla · ${CAT_PL[x.category] ?? x.category}`, tier: t1, biomes: biomeIdOfTier(t1) },
      x.levels.flatMap((l) => [l.namePl, l.nameEn]),
      () => ({
        title: x.levels.map((l) => l.namePl).join(' → '),
        desc: x.descPl,
        facts: [{ label: 'Kategoria', value: CAT_PL[x.category] ?? x.category }],
        research: x.levels.map((_, k) => {
          const u = unlockLink(`building:${x.id}:${k + 1}`, startB.has(`${x.id}:${k + 1}`));
          return { ...u, detail: `poziom ${k + 1}${u.detail ? ` · ${u.detail}` : ''}` };
        }),
        levels: x.levels.map((l, k) => ({
          level: k + 1,
          name: l.namePl,
          nameEn: l.nameEn,
          tier: levelTier(x, k),
          unlock: unlockLink(`building:${x.id}:${k + 1}`, startB.has(`${x.id}:${k + 1}`)),
          facts: [
            { label: 'Praca budowy', value: num(l.work) },
            { label: 'Rozmiar', value: `${l.size[0]} × ${l.size[1]} kafli` },
            { label: 'Pracownicy', value: String(l.workers) },
            ...(l.power ? [{ label: l.power > 0 ? 'Pobór mocy' : 'Produkcja mocy', value: num(Math.abs(l.power)) }] : []),
            ...Object.entries(l.effects).map(([ek, ev]) => ({ label: EFFECT_PL[ek] ?? ek, value: num(ev) })),
          ],
          cost: stackLinks(l.cost),
          recipes: b.recipes.filter((r) => r.at === x.id && r.level === k + 1).map((r) => recipeLink(r, `${stacksText(r.inputs)} · ${r.time} s${r.power ? ` · moc ${r.power}` : ''}`)),
        })),
        sections: counters.has(x.id) ? [counterSection(x.id)] : [],
      }),
    );
  }

  // ---------------------------------------------------------------- recipes
  for (const r of b.recipes) {
    const tier = fin(A.recipe.get(r.id));
    const variant = r.outputs.some((o) => o.id === r.id) ? '' : ` · wariant ${r.id}`;
    add(
      { key: `recipe:${r.id}`, kind: 'recipe', id: r.id, group: 'recipes', name: `${recipeName(r)}${variant}`, nameEn: r.outputs.map((o) => RES.get(o.id)?.nameEn ?? o.id).join(' + '), sub: `Receptura · ${lvlName(r.at, r.level)}`, tier, biomes: biomeIdOfTier(tier) },
      [...r.inputs, ...r.outputs].map((s) => resLabel(s.id)),
      () => {
        const alt = [...new Set(r.outputs.flatMap((o) => producedBy.get(o.id) ?? []))].filter((x) => x.id !== r.id);
        return {
          title: `${recipeName(r)}${variant}`,
          facts: [
            { label: 'Budowla', value: `${lvlName(r.at, r.level)} (${r.at}, poziom ${r.level}+)` },
            { label: 'Czas', value: `${r.time} s pracy` },
            ...(r.power ? [{ label: 'Moc', value: num(r.power) }] : []),
            { label: 'Dostępna od (analiza)', value: tierName(tier), warn: tier === null },
          ],
          research: [unlockLink(`recipe:${r.id}`, startR.has(r.id))],
          sections: [
            { title: 'Wejścia', links: stackLinks(r.inputs), empty: 'Bez wejść (uprawa / zbiór).' },
            { title: 'Wyniki', links: stackLinks(r.outputs) },
            { title: 'Budowla', links: [{ key: `building:${r.at}`, label: lvlName(r.at, r.level), detail: `poziom ${r.level} lub wyższy`, tier: fin(A.building.get(`${r.at}:${r.level}`)) }] },
            ...(alt.length ? [{ title: 'Te same wyniki inną recepturą', links: alt.map((x) => recipeLink(x)) }] : []),
          ],
        };
      },
    );
  }

  // ---------------------------------------------------------------- research
  const requiredBy = new Map<string, string[]>();
  for (const t of b.tech) for (const q of t.requires) requiredBy.set(q, [...(requiredBy.get(q) ?? []), t.id]);
  const techLink = (id: string): Link => {
    const t = TEC.get(id);
    return t ? { key: `tech:${id}`, label: t.namePl, detail: `T${t.tier}`, tier: t.tier } : { label: id, detail: 'nie istnieje!' };
  };
  for (const t of b.tech) {
    const tier = fin(A.tech.get(t.id));
    const revealTier = t.revealBy.length ? fin(Math.min(...t.revealBy.map((x) => A.res.get(x) ?? Infinity))) : 0;
    add(
      { key: `tech:${t.id}`, kind: 'tech', id: t.id, group: 'tech', name: t.namePl, nameEn: t.nameEn, sub: `Badanie T${t.tier} · ${['', 'mały', 'średni', 'kluczowy'][t.size] ?? `rozmiar ${t.size}`}`, tier, declaredTier: t.tier, biomes: biomeIdOfTier(t.tier) },
      [t.descPl],
      () => ({
        title: t.namePl,
        desc: t.descPl,
        facts: [
          { label: 'Warstwa', value: tierName(t.tier) },
          { label: 'Do zbadania od (analiza)', value: tierName(tier), warn: tier !== t.tier },
          { label: 'Odsłania się', value: t.revealBy.length ? `od ${tierName(revealTier)}` : 'widoczny od startu', warn: revealTier !== null && revealTier > t.tier },
          { label: 'Rozmiar', value: `${t.size} (${['', 'mały', 'średni', 'kluczowy'][t.size] ?? '?'})` },
        ],
        research: [], // prerequisites are listed in the 'Wymaga' section
        sections: [
          { title: 'Koszt', links: stackLinks(t.cost) },
          { title: 'Wymaga', links: t.requires.map(techLink), empty: 'Bez wymagań.' },
          { title: 'Wymagany przez', links: (requiredBy.get(t.id) ?? []).map(techLink), empty: 'Nic dalej nie wymaga tego węzła.' },
          {
            title: 'Odblokowuje',
            links: [
              ...(t.unlocks.recipes ?? []).map((id) => (REC.has(id) ? recipeLink(REC.get(id)!) : { label: id, detail: 'receptura nie istnieje!' })),
              ...(t.unlocks.buildings ?? []).map(([bid, l]) => ({ key: `building:${bid}`, label: lvlName(bid, l), detail: `budowla, poziom ${l}`, tier: fin(A.building.get(`${bid}:${l}`)) })),
              ...(t.unlocks.infra ?? []).map((id) => ({ key: `infra:${id}`, label: INF.get(id)?.namePl ?? id, detail: 'infrastruktura', tier: fin(A.infra.get(id)) })),
            ],
            empty: 'Niczego nie odblokowuje!',
            warn: true,
          },
          { title: 'Odsłaniają go surowce', links: t.revealBy.map((id) => ({ key: `resource:${id}`, label: resLabel(id), detail: `dostępny od ${tierName(resTier(id))}`, tier: resTier(id) })), empty: 'Widoczny od startu.' },
        ],
      }),
    );
  }

  // ---------------------------------------------------------------- biomes
  const MAT = new Map(b.materials.map((m) => [m.key, m]));
  const DEPMAT = new Map(b.materials.filter((m) => m.deposit).map((m) => [m.deposit!, m]));
  for (const x of b.biomes) {
    add(
      { key: `biome:${x.id}`, kind: 'biome', id: x.id, group: 'biomes', name: x.namePl, nameEn: x.nameEn, sub: `Biom T${x.tier} · ${x.depth[0]}–${x.depth[1]} kafli w głąb`, tier: x.tier, declaredTier: x.tier, biomes: [x.id] },
      [x.descPl, x.approachPl],
      () => {
        const atTier = (r: Resource) => resTier(r.id) === x.tier;
        return {
          title: x.namePl,
          desc: x.descPl,
          facts: [
            { label: 'Warstwa', value: `T${x.tier}` },
            { label: 'Głębokość', value: `${x.depth[0]}–${x.depth[1]} kafli` },
            { label: 'Wyzwanie', value: x.approachPl },
            { label: 'Kilof na zwykłą skałę', value: String(b.rockPickTier[x.id] ?? '?') },
          ],
          research: [],
          sections: [
            { title: 'Zagrożenia', links: x.hazards.map((h) => ({ key: `hazard:${h}`, label: HAZ.get(h)?.namePl ?? h, detail: `ochrona: ${(HAZ.get(h)?.counters ?? []).map((c) => RES.get(c)?.namePl ?? INF.get(c)?.namePl ?? BLD.get(c)?.levels[0].namePl ?? c).join(', ')}` })) },
            { title: 'Skały', links: x.rocks.map((k) => ({ key: `material:${k}`, label: MAT.get(k)?.namePl ?? k, detail: MAT.get(k) ? `twardość ${num(MAT.get(k)!.hardness)} · kilof ${MAT.get(k)!.tier === 9 ? 'nie do wykopania' : MAT.get(k)!.tier}` : 'brak materiału!' })) },
            { title: 'Złoża', links: b.deposits.filter((d) => d.biomes.includes(x.id)).map((d) => ({ key: `deposit:${d.id}`, label: d.namePl, detail: `${resLabel(d.yields)} · kilof ≥ ${d.pickTier} · ${RARITY_PL[d.rarity] ?? d.rarity}`, tier: minBiomeTier(d.biomes) })), empty: 'Brak złóż.' },
            { title: 'Obiekty do zebrania', links: b.objects.filter((o) => o.biomes.includes(x.id)).map((o) => ({ key: `object:${o.id}`, label: o.namePl, detail: o.drops.map((d) => resLabel(d.id)).join(', ') })), empty: 'Brak.' },
            { title: 'Stworzenia', links: b.creatures.filter((c) => c.biome === x.id).map((c) => ({ key: `creature:${c.id}`, label: `${c.namePl}${c.boss ? ' (boss)' : ''}`, detail: `${BEHAVIOR_PL[c.behavior] ?? c.behavior} · HP ${c.hp} · łup: ${c.drops.map((d) => resLabel(d.id)).join(', ')}` })), empty: 'Brak.' },
            { title: 'Nowe surowce i materiały od tej warstwy', links: b.resources.filter((r) => r.kind !== 'item' && atTier(r)).map((r) => ({ key: `resource:${r.id}`, label: r.namePl, detail: KIND_PL[r.kind], tier: x.tier })), empty: 'Brak.' },
            { title: 'Nowe przedmioty od tej warstwy', links: b.resources.filter((r) => r.kind === 'item' && atTier(r)).map((r) => ({ key: `resource:${r.id}`, label: r.namePl, detail: SLOT_PL[r.slot ?? ''] ?? r.slot, tier: x.tier })), empty: 'Brak.' },
            { title: 'Badania tej warstwy', links: b.tech.filter((t) => t.tier === x.tier).map((t) => techLink(t.id)), empty: 'Brak.' },
            {
              title: 'Poziomy budowli dostępne od tej warstwy',
              links: b.buildings.flatMap((y) => y.levels.flatMap((l, k) => (levelTier(y, k) === x.tier ? [{ key: `building:${y.id}`, label: l.namePl, detail: `poziom ${k + 1}`, tier: x.tier }] : []))),
              empty: 'Brak.',
            },
          ],
        };
      },
    );
  }

  // ---------------------------------------------------------------- other kinds
  for (const d of b.deposits) {
    const tier = minBiomeTier(d.biomes);
    add(
      { key: `deposit:${d.id}`, kind: 'deposit', id: d.id, group: 'other', name: d.namePl, nameEn: d.nameEn, sub: `Złoże · ${RARITY_PL[d.rarity] ?? d.rarity}`, tier, biomes: [...d.biomes] },
      [resLabel(d.yields)],
      () => ({
        title: d.namePl,
        facts: [
          { label: 'Ilość na kafel', value: num(d.amount) },
          { label: 'Twardość', value: num(d.hardness) },
          { label: 'Kilof (poziom)', value: String(d.pickTier) },
          { label: 'Rzadkość', value: RARITY_PL[d.rarity] ?? d.rarity },
          { label: 'Materiał świata', value: DEPMAT.get(d.id)?.key ?? 'BRAK', warn: !DEPMAT.has(d.id) },
        ],
        research: [],
        sections: [
          { title: 'Daje', links: [{ key: `resource:${d.yields}`, label: resLabel(d.yields), detail: `${d.amount}/kafel`, tier: resTier(d.yields) }] },
          { title: 'Biomy', links: d.biomes.map((x) => ({ key: `biome:${x}`, label: BIO.get(x)?.namePl ?? x, tier: fin(BIO.get(x)?.tier) })) },
          { title: 'Kilofy, które je wydobędą', links: b.resources.filter((r) => r.slot === 'pick' && (r.stats?.pickTier ?? 0) >= d.pickTier).map((r) => ({ key: `resource:${r.id}`, label: r.namePl, detail: `poziom ${r.stats?.pickTier}`, tier: resTier(r.id) })) },
          ...(DEPMAT.has(d.id) ? [{ title: 'Materiał świata', links: [{ key: `material:${DEPMAT.get(d.id)!.key}`, label: DEPMAT.get(d.id)!.namePl, detail: DEPMAT.get(d.id)!.key }] }] : []),
        ],
      }),
    );
  }
  for (const c of b.creatures) {
    const tier = fin(BIO.get(c.biome)?.tier);
    add(
      { key: `creature:${c.id}`, kind: 'creature', id: c.id, group: 'other', name: c.namePl, nameEn: c.nameEn, sub: `${c.boss ? 'Boss' : 'Stworzenie'} · ${BEHAVIOR_PL[c.behavior] ?? c.behavior}`, tier, biomes: [c.biome] },
      [],
      () => ({
        title: `${c.namePl}${c.boss ? ' (boss)' : ''}`,
        desc: c.descPl,
        facts: [
          { label: 'Zachowanie', value: BEHAVIOR_PL[c.behavior] ?? c.behavior },
          { label: 'HP / obrażenia / pancerz', value: `${c.hp} / ${c.damage} / ${c.armor}` },
          { label: 'Prędkość', value: `${num(c.speed)} kafla/s` },
        ],
        research: [],
        sections: [
          { title: 'Łup', links: c.drops.map((d) => ({ key: `resource:${d.id}`, label: resLabel(d.id), detail: `${d.min}–${d.max} szt.${d.chance < 1 ? ` · ${Math.round(d.chance * 100)}%` : ''}`, tier: resTier(d.id) })) },
          { title: 'Biom', links: [{ key: `biome:${c.biome}`, label: BIO.get(c.biome)?.namePl ?? c.biome, tier }] },
        ],
      }),
    );
  }
  for (const o of b.objects) {
    const tier = minBiomeTier(o.biomes);
    add(
      { key: `object:${o.id}`, kind: 'object', id: o.id, group: 'other', name: o.namePl, nameEn: o.nameEn, sub: `Obiekt · ${TOOL_PL[o.tool ?? 'hands']}`, tier, biomes: [...o.biomes] },
      [],
      () => ({
        title: o.namePl,
        facts: [
          { label: 'Praca zbioru', value: num(o.work) },
          { label: 'Narzędzie', value: TOOL_PL[o.tool ?? 'hands'] ?? String(o.tool) },
          { label: 'Odrasta', value: o.regrows ? 'tak' : 'nie' },
        ],
        research: [],
        sections: [
          { title: 'Łup', links: o.drops.map((d) => ({ key: `resource:${d.id}`, label: resLabel(d.id), detail: `${d.min}–${d.max} szt.${d.chance < 1 ? ` · ${Math.round(d.chance * 100)}%` : ''}`, tier: resTier(d.id) })) },
          { title: 'Biomy', links: o.biomes.map((x) => ({ key: `biome:${x}`, label: BIO.get(x)?.namePl ?? x, tier: fin(BIO.get(x)?.tier) })) },
        ],
      }),
    );
  }
  for (const h of b.hazards) {
    const where = b.biomes.filter((x) => x.hazards.includes(h.id));
    const tier = where.length ? Math.min(...where.map((x) => x.tier)) : null;
    const counterLink = (c: string): Link =>
      RES.has(c)
        ? { key: `resource:${c}`, label: RES.get(c)!.namePl, detail: 'przedmiot', tier: resTier(c) }
        : INF.has(c)
          ? { key: `infra:${c}`, label: INF.get(c)!.namePl, detail: 'infrastruktura', tier: fin(A.infra.get(c)) }
          : BLD.has(c)
            ? { key: `building:${c}`, label: BLD.get(c)!.levels[0].namePl, detail: 'budowla', tier: fin(A.building.get(`${c}:1`)) }
            : { label: c, detail: 'nie istnieje!' };
    add(
      { key: `hazard:${h.id}`, kind: 'hazard', id: h.id, group: 'other', name: h.namePl, nameEn: h.id, sub: 'Zagrożenie środowiskowe', tier, biomes: where.map((x) => x.id) },
      [h.descPl],
      () => ({
        title: h.namePl,
        desc: h.descPl,
        facts: [],
        research: [],
        sections: [
          { title: 'Występuje w', links: where.map((x) => ({ key: `biome:${x.id}`, label: x.namePl, tier: x.tier })), empty: 'Żaden biom go nie ma.' },
          { title: 'Ochrona', links: h.counters.map(counterLink), empty: 'Brak ochrony!', warn: true },
        ],
      }),
    );
  }
  for (const i of b.infrastructure) {
    const tier = fin(A.infra.get(i.id));
    add(
      { key: `infra:${i.id}`, kind: 'infra', id: i.id, group: 'other', name: i.namePl, nameEn: i.nameEn, sub: 'Infrastruktura', tier, declaredTier: i.tier, biomes: biomeIdOfTier(tier) },
      [i.descPl],
      () => ({
        title: i.namePl,
        desc: i.descPl,
        facts: [
          { label: 'Praca', value: num(i.work) },
          { label: 'Warstwa w danych', value: tierName(i.tier), warn: tier !== i.tier },
          { label: 'Dostępna od (analiza)', value: tierName(tier), warn: tier !== i.tier },
        ],
        research: [unlockLink(`infra:${i.id}`, startI.has(i.id))],
        sections: [{ title: 'Koszt', links: stackLinks(i.cost) }, ...(counters.has(i.id) ? [counterSection(i.id)] : [])],
      }),
    );
  }
  for (const g of b.greatWorks) {
    add(
      { key: `greatwork:${g.id}`, kind: 'greatwork', id: g.id, group: 'other', name: g.namePl, nameEn: g.nameEn, sub: `Wielkie Dzieło · od T${g.tier}`, tier: g.tier, declaredTier: g.tier, biomes: biomeIdOfTier(g.tier) },
      [g.descPl],
      () => ({
        title: g.namePl,
        desc: g.descPl,
        facts: [{ label: 'Od warstwy', value: tierName(g.tier) }],
        research: [],
        sections: g.stages.map((st, k) => ({
          title: `Etap ${k + 1}: ${st.namePl} · praca ${st.work} · ${Object.entries(st.bonus).map(([bk, bv]) => `${bk} +${bv}`).join(', ')}`,
          links: stackLinks(st.cost),
        })),
      }),
    );
  }
  for (const m of b.materials) {
    if (!m.solid) continue;
    const inBiomes = b.biomes.filter((x) => x.rocks.includes(m.key));
    const dep = m.deposit ? b.deposits.find((d) => d.id === m.deposit) : undefined;
    const biomes = [...new Set([...inBiomes.map((x) => x.id), ...(dep?.biomes ?? [])])];
    add(
      { key: `material:${m.key}`, kind: 'material', id: m.key, group: 'other', name: m.namePl, nameEn: m.nameEn, sub: `Materiał świata · ${m.cls}`, tier: biomes.length ? minBiomeTier(biomes) : null, biomes },
      [],
      () => ({
        title: m.namePl,
        facts: [
          { label: 'Klucz / numer', value: `${m.key} / ${m.id}` },
          { label: 'Klasa', value: m.cls },
          { label: 'Twardość', value: Number.isFinite(m.hardness) ? num(m.hardness) : '∞' },
          { label: 'Kilof', value: m.tier === 9 ? 'nie do wykopania (9)' : String(m.tier) },
          ...(m.glow ? [{ label: 'Świeci (RGB)', value: m.glow.map((v) => num(v)).join(', ') }] : []),
        ],
        research: [],
        sections: [
          { title: 'Skała biomów', links: inBiomes.map((x) => ({ key: `biome:${x.id}`, label: x.namePl, tier: x.tier })), empty: m.deposit ? 'Nie jest skałą gospodarza (to złoże).' : 'Żaden biom jej nie używa.' },
          ...(dep ? [{ title: 'Złoże', links: [{ key: `deposit:${dep.id}`, label: dep.namePl, detail: `daje: ${resLabel(dep.yields)}`, tier: minBiomeTier(dep.biomes) }] }] : []),
        ],
      }),
    );
  }

  const byKey = new Map(entries.map((e) => [e.key, e]));
  const slots = [...new Set(b.resources.filter((r) => r.slot).map((r) => r.slot!))].map((id) => ({ id, label: SLOT_PL[id] ?? id }));
  return {
    entries,
    byKey,
    detail: (key) => details.get(key)?.(),
    biomes: [...b.biomes].sort((p, q) => p.tier - q.tier).map((x) => ({ id: x.id, name: x.namePl, tier: x.tier })),
    slots,
    tierName,
  };
}

// ------------------------------------------------------------------ search & filters

export interface Filter {
  q?: string;
  groups?: readonly Group[];
  biome?: string;
  tierMin?: number;
  tierMax?: number;
  slot?: string;
  /** Restrict to these keys (e.g. entries with validator issues). */
  keys?: ReadonlySet<string>;
}

const GROUP_ORDER = new Map(GROUPS.map((g, i) => [g.id, i]));

export function filterEntries(ix: ContentIndex, f: Filter): Entry[] {
  const tokens = normalize(f.q ?? '').split(/\s+/).filter(Boolean);
  const out: { e: Entry; score: number }[] = [];
  for (const e of ix.entries) {
    if (f.groups?.length && !f.groups.includes(e.group)) continue;
    if (f.biome && !e.biomes.includes(f.biome)) continue;
    if (f.tierMin !== undefined && (e.tier === null || e.tier < f.tierMin)) continue;
    if (f.tierMax !== undefined && (e.tier === null || e.tier > f.tierMax)) continue;
    if (f.slot && e.slot !== f.slot) continue;
    if (f.keys && !f.keys.has(e.key)) continue;
    if (tokens.length && !tokens.every((t) => e.hay.includes(t))) continue;
    let score = 3;
    if (tokens.length) {
      const name = normalize(e.name);
      const q = tokens.join(' ');
      if (e.id === q || name === q) score = 0;
      else if (name.startsWith(q) || e.id.startsWith(q)) score = 1;
      else if (tokens.every((t) => name.split(/[\s(),·-]+/).some((w) => w.startsWith(t)))) score = 2;
    }
    out.push({ e, score });
  }
  out.sort(
    (a, b) =>
      a.score - b.score ||
      GROUP_ORDER.get(a.e.group)! - GROUP_ORDER.get(b.e.group)! ||
      (a.e.tier ?? 99) - (b.e.tier ?? 99) ||
      a.e.name.localeCompare(b.e.name, 'pl'),
  );
  return out.map((x) => x.e);
}

/** Maps validator issues to browser entries (by file and id). */
export function issuesByKey(ix: ContentIndex, issues: readonly Issue[]): Map<string, Issue[]> {
  const kindsByFile: Record<string, EntryKind[]> = {
    'src/content/resources.ts': ['resource'],
    'src/content/recipes.ts': ['recipe'],
    'src/content/tech.ts': ['tech', 'resource'],
    'src/content/buildings.ts': ['building', 'infra'],
    'src/content/sources.ts': ['deposit', 'creature', 'object', 'biome'],
    'src/content/biomes.ts': ['biome', 'hazard'],
    'src/content/greatworks.ts': ['greatwork'],
    'src/world/materials.ts': ['material', 'deposit'],
  };
  const out = new Map<string, Issue[]>();
  for (const i of issues) {
    const base = i.id.split(':')[0]!;
    const kind = (kindsByFile[i.file] ?? []).find((k) => ix.byKey.has(`${k}:${base}`));
    const key = kind ? `${kind}:${base}` : '';
    if (key) out.set(key, [...(out.get(key) ?? []), i]);
  }
  return out;
}
