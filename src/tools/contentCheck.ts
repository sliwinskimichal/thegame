/**
 * Content validator — pure checks over a ContentBundle (no I/O, no imports of
 * the data itself, only types), so the same rules run in the CLI
 * (scripts/content-check.mjs), in the data browser (tools.html) and in tests on
 * deliberately broken copies of the data.
 *
 * Every issue states WHAT is wrong, WHERE (source file + content id; the CLI
 * adds the line) and HOW to fix it. Messages are in Polish: designers read them.
 * Rule groups run independently: a crash inside one group (e.g. a field of the
 * wrong type) is reported as an `internal` error and the other groups still run.
 */
import type { Analysis } from '../content/analysis';
import type { GreatWork } from '../content/greatworks';
import type { Biome, Building, Creature, Deposit, DropEntry, Hazard, Infrastructure, Recipe, Resource, Stack, TechNode, WorldObject } from '../content/types';
import type { MaterialInfo } from '../world/materials';

export type Severity = 'error' | 'warning';

export type Collection =
  | 'biomes'
  | 'hazards'
  | 'resources'
  | 'deposits'
  | 'objects'
  | 'creatures'
  | 'buildings'
  | 'infrastructure'
  | 'recipes'
  | 'tech'
  | 'greatWorks'
  | 'materials';

/** Everything the validator looks at. Built from the real data by src/tools/contentBundle.ts. */
export interface ContentBundle {
  biomes: readonly Biome[];
  hazards: readonly Hazard[];
  resources: readonly Resource[];
  deposits: readonly Deposit[];
  objects: readonly WorldObject[];
  creatures: readonly Creature[];
  buildings: readonly Building[];
  infrastructure: readonly Infrastructure[];
  recipes: readonly Recipe[];
  tech: readonly TechNode[];
  greatWorks: readonly GreatWork[];
  /** World materials (src/world/materials.ts). */
  materials: readonly MaterialInfo[];
  startBuildings: readonly (readonly [string, number])[];
  startRecipes: readonly string[];
  startInfra: readonly string[];
  startDiscovered: readonly string[];
  researchPacks: readonly string[];
  rockPickTier: Readonly<Record<string, number>>;
  /** Resource that ordinary rock of every biome yields (needs no deposit). */
  rockYield: string;
}

export interface Issue {
  severity: Severity;
  /** Rule id, e.g. `ref.resource` (see RULES). */
  rule: string;
  /** Repository-relative file where the fix goes. */
  file: string;
  /** Content id where the fix goes (`<building>:<level>` for a building level). */
  id: string;
  /** What is wrong (Polish). */
  message: string;
  /** How to fix it (Polish). */
  fix: string;
}

/** A deliberate exception: the rule would fire, but the design says it is fine. */
export interface Skip {
  rule: string;
  id: string;
  reason: string;
}

export interface CheckOptions {
  /** Progression analysis of the same content (src/content/analysis.ts); enables the `prog.*` rules. */
  analysis?: Analysis;
}

export interface CheckResult {
  issues: Issue[];
  skipped: Skip[];
  /** How many entries of each collection were checked. */
  counts: Record<string, number>;
}

/** Where each collection lives. Update when data moves to another file. */
export const CONTENT_FILES: Readonly<Record<Collection, string>> = {
  biomes: 'src/content/biomes.ts',
  hazards: 'src/content/biomes.ts',
  resources: 'src/content/resources.ts',
  deposits: 'src/content/sources.ts',
  objects: 'src/content/sources.ts',
  creatures: 'src/content/sources.ts',
  buildings: 'src/content/buildings.ts',
  infrastructure: 'src/content/buildings.ts',
  recipes: 'src/content/recipes.ts',
  tech: 'src/content/tech.ts',
  greatWorks: 'src/content/greatworks.ts',
  materials: 'src/world/materials.ts',
};

const COLL_PL: Record<Collection, string> = {
  biomes: 'biomach (BIOMES)',
  hazards: 'zagrożeniach (HAZARDS)',
  resources: 'surowcach i przedmiotach (RESOURCES)',
  deposits: 'złożach (DEPOSITS)',
  objects: 'obiektach (OBJECTS)',
  creatures: 'stworzeniach (CREATURES)',
  buildings: 'budowlach (BUILDINGS)',
  infrastructure: 'infrastrukturze (INFRASTRUCTURE)',
  recipes: 'recepturach (RECIPES)',
  tech: 'węzłach badań (TECH)',
  greatWorks: 'Wielkich Dziełach (GREAT_WORKS)',
  materials: 'materiałach świata (MATERIALS)',
};

/** Rule registry: id -> what it guards. Every emitted issue uses one of these ids. */
export const RULES: Readonly<Record<string, string>> = {
  'id.missing': 'element bez id',
  'id.format': 'id poza formatem snake_case (materiały: camelCase)',
  'id.duplicate': 'zduplikowane id w kolekcji lub na liście startowej',
  'id.collision': 'to samo id surowca, budowli i infrastruktury',
  'ref.resource': 'odwołanie do nieistniejącego surowca/przedmiotu',
  'ref.building': 'odwołanie do nieistniejącej budowli lub poziomu',
  'ref.recipe': 'odwołanie do nieistniejącej receptury',
  'ref.tech': 'odwołanie do nieistniejącego węzła badań',
  'ref.infra': 'odwołanie do nieistniejącej infrastruktury',
  'ref.biome': 'odwołanie do nieistniejącego biomu',
  'ref.hazard': 'odwołanie do nieistniejącego zagrożenia',
  'ref.kind': 'odwołanie do elementu złego rodzaju (np. złoże daje materiał)',
  'ref.tool': 'obiekt wymaga narzędzia, którego nie ma żaden przedmiot',
  'world.depositMaterial': 'złoże bez materiału świata (albo z kilkoma)',
  'world.materialDeposit': 'materiał świata wskazuje nieistniejące złoże',
  'world.mismatch': 'twardość/kilof materiału ≠ złoża',
  'world.biomeRock': 'skała biomu bez materiału świata',
  'world.rockTier': 'kilof skały biomu ≠ ROCK_PICK_TIER',
  'world.denseIds': 'numery materiałów nie są kolejne od 0',
  'world.oreWithoutDeposit': 'materiał-ruda bez złoża',
  'world.unusedMaterial': 'skała, której nie używa żaden biom ani złoże',
  'range.hardness': 'twardość ≤ 0',
  'range.pickTier': 'poziom kilofa poza 0–5 (materiały: 0–5 lub 9)',
  'range.cost': 'koszt/ilość nie jest liczbą całkowitą > 0',
  'range.levels': 'budowla bez dokładnie 3 poziomów (Wielkie Dzieło: 3 etapy)',
  'range.value': 'liczba poza dozwolonym zakresem',
  'range.drop': 'błędny łup (min/max/szansa)',
  'range.name': 'brak nazwy lub opisu',
  'range.zeroStat': 'statystyka przedmiotu równa 0',
  'range.levelOrder': 'wyższy poziom budowli buduje się krócej',
  'unlock.missing': 'nic nie odblokowuje receptury/poziomu/infrastruktury',
  'unlock.duplicate': 'odblokowywane więcej niż raz',
  'unlock.nothing': 'węzeł badań niczego nie odblokowuje',
  'tech.order': 'wymaganie z późniejszej warstwy albo samego siebie',
  'tech.cycle': 'cykl w wymaganiach badań',
  'source.missing': 'surowiec/przedmiot bez źródła',
  'orphan.unused': 'wytwarzane lub zbierane, ale nigdzie nieużywane',
  'boss.missing': 'biom bez bossa',
  'boss.noTrophy': 'boss bez trofeum',
  'boss.trophySource': 'trofeum, które nie wypada z bossa',
  'boss.trophyTech': 'trofeum bossa nie otwiera żadnego węzła badań',
  'boss.trophyTier': 'węzeł wymaga trofeum z głębszej warstwy',
  'prog.never': 'nieosiągalne w żadnej warstwie',
  'prog.resource': 'dostępne później, niż zadeklarowano',
  'prog.resourceEarly': 'dostępne wcześniej, niż zadeklarowano',
  'prog.tech': 'węzeł do zbadania dopiero w późniejszej warstwie',
  'prog.building': 'poziom budowli niedostępny lub dostępny później niż badanie',
  'prog.infra': 'infrastruktura dostępna później, niż zadeklarowano',
  'prog.recipeLate': 'receptura dostępna później niż odblokowujące ją badanie',
  'prog.reveal': 'węzeł odsłaniany za późno (albo nigdy)',
  'prog.pack': 'paczka badań dostępna nie w swojej warstwie',
  'prog.hazard': 'zagrożenie biomu bez dostępnej ochrony',
  'prog.start': 'surowiec znany od startu, ale niedostępny w T0',
  'consistency.power': 'moc receptury nie pasuje do budowli',
  'consistency.recipeId': 'id receptury to id innego surowca niż jej wynik',
  'consistency.selfLoop': 'receptura zużywa to, co wytwarza',
  'consistency.dupStack': 'ten sam składnik dwa razy na jednej liście',
  internal: 'reguła przerwała działanie (zły typ pola w danych?)',
};

// ------------------------------------------------------------------ helpers

const SNAKE = /^[a-z][a-z0-9_]*$/;
const CAMEL = /^[a-z][a-zA-Z0-9]*$/;
const RES_KINDS = new Set(['raw', 'drop', 'material', 'item']);
const SLOTS = new Set(['pick', 'tool', 'weapon', 'offhand', 'ammo', 'head', 'body', 'feet', 'hands', 'back', 'gear', 'trinket', 'consumable']);
const CATEGORIES = new Set(['core', 'living', 'food', 'production', 'research', 'logistics', 'power', 'defense']);
const BEHAVIORS = new Set(['passive', 'skittish', 'territorial', 'hunter', 'swarm', 'raider', 'ambusher', 'boss']);
const RARITIES = new Set(['common', 'uncommon', 'rare', 'legendary']);
const TOOLS = new Set(['axe', 'pick', 'rod', 'hands']);
const RESISTANCES = new Set(['coldRes', 'heatRes', 'gasRes', 'waterRes', 'dreadRes']);
const MAX_PICK = 5;
const NEVER_TIER = 9;

const arr = <T>(x: readonly T[] | undefined | null): readonly T[] => (Array.isArray(x) ? x : []);
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isInt = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x);
const str = (x: unknown): string => (typeof x === 'string' ? x : String(x));
const msgOf = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** Polish plural: 1 błąd, 2 błędy, 5 błędów. */
export function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const d = n % 10;
  const h = n % 100;
  return d >= 2 && d <= 4 && (h < 12 || h > 14) ? few : many;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  let prev = new Array<number>(n + 1);
  let cur = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      const c = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + c);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[n]!;
}

/** Closest existing ids to a mistyped one (edit distance, then containment). */
export function suggest(id: string, pool: Iterable<string>, max = 2): string[] {
  const q = String(id ?? '').toLowerCase();
  if (!q) return [];
  const scored: [number, string][] = [];
  for (const c of pool) {
    const d = levenshtein(q, c.toLowerCase());
    const limit = Math.max(2, Math.floor(Math.max(q.length, c.length) / 3));
    if (d <= limit) scored.push([d, c]);
    else if (q.length >= 4 && (c.includes(q) || q.includes(c))) scored.push([limit + 1, c]);
  }
  scored.sort((x, y) => x[0] - y[0] || x[1].localeCompare(y[1]));
  return scored.slice(0, max).map((s) => s[1]);
}

function didYouMean(id: string, pool: Iterable<string>): string {
  const s = suggest(id, pool);
  return s.length ? ` Czy chodziło o ${s.map((x) => `„${x}”`).join(' albo ')}?` : '';
}

function snakeOf(id: string): string {
  return (
    String(id)
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'nowe_id'
  );
}

const tierLabel = (t: number) => (Number.isFinite(t) ? `T${t}` : 'nigdy');

// ------------------------------------------------------------------ the check

export function checkContent(bundle: ContentBundle, opts: CheckOptions = {}): CheckResult {
  const issues: Issue[] = [];
  const skipped: Skip[] = [];
  const F = CONTENT_FILES;
  const push = (severity: Severity, rule: string, file: string, id: string, message: string, fix: string) =>
    issues.push({ severity, rule, file, id: str(id), message, fix });
  const err = (rule: string, file: string, id: string, message: string, fix: string) => push('error', rule, file, id, message, fix);
  const warn = (rule: string, file: string, id: string, message: string, fix: string) => push('warning', rule, file, id, message, fix);

  // Entries that are not objects are reported once and dropped, so the rules below can trust shapes.
  const objects = <T>(coll: Collection, list: readonly T[] | undefined): T[] => {
    if (list !== undefined && !Array.isArray(list)) {
      err('internal', F[coll], coll, `Kolekcja w ${COLL_PL[coll]} nie jest listą.`, 'Przywróć eksport tablicy (np. `export const X: readonly T[] = [...]`).');
      return [];
    }
    const out: T[] = [];
    arr(list).forEach((x, i) => {
      if (isObj(x)) out.push(x);
      else err('internal', F[coll], `#${i + 1}`, `Pozycja nr ${i + 1} w ${COLL_PL[coll]} nie jest obiektem (${String(x)}).`, 'Usuń zbędny przecinek lub wartość z listy.');
    });
    return out;
  };

  const biomes = objects('biomes', bundle.biomes);
  const hazards = objects('hazards', bundle.hazards);
  const resources = objects('resources', bundle.resources);
  const deposits = objects('deposits', bundle.deposits);
  const wobjects = objects('objects', bundle.objects);
  const creatures = objects('creatures', bundle.creatures);
  const buildings = objects('buildings', bundle.buildings);
  const infra = objects('infrastructure', bundle.infrastructure);
  const recipes = objects('recipes', bundle.recipes);
  const tech = objects('tech', bundle.tech);
  const greatWorks = objects('greatWorks', bundle.greatWorks);
  const materials = objects('materials', bundle.materials);
  const startBuildings = arr(bundle.startBuildings);
  const startRecipes = arr(bundle.startRecipes);
  const startInfra = arr(bundle.startInfra);
  const startDiscovered = arr(bundle.startDiscovered);
  const researchPacks = arr(bundle.researchPacks);
  const rockPickTier: Readonly<Record<string, number>> = isObj(bundle.rockPickTier) ? bundle.rockPickTier : {};
  const rockYield = bundle.rockYield;

  // lookups (first occurrence wins; duplicates are reported by the id rules)
  const first = <T extends { id: string }>(list: readonly T[]) => {
    const m = new Map<string, T>();
    for (const x of list) if (!m.has(x.id)) m.set(x.id, x);
    return m;
  };
  const RES = first(resources);
  const BLD = first(buildings);
  const INF = first(infra);
  const REC = first(recipes);
  const TEC = first(tech);
  const BIO = first(biomes);
  const HAZ = first(hazards);
  const DEP = first(deposits);
  const MAT = new Map<string, MaterialInfo>();
  for (const m of materials) if (!MAT.has(m.key)) MAT.set(m.key, m);
  const maxBiomeTier = biomes.reduce((m, b) => (isInt(b.tier) ? Math.max(m, b.tier) : m), 0);
  const biomeTier = (id: string) => BIO.get(id)?.tier ?? Infinity;
  const biomeName = (t: number) => biomes.find((b) => b.tier === t)?.namePl ?? '';
  const tierName = (t: number) => (Number.isFinite(t) ? `T${t}${biomeName(t) ? ` (${biomeName(t)})` : ''}` : 'nigdy');

  /** `„id” (Nazwa)` or, with extra facts, `„id” (Nazwa; facts)`. */
  const resName = (id: string, extra?: string) => {
    const r = RES.get(id);
    const inner = [r?.namePl, extra].filter(Boolean).join('; ');
    return inner ? `„${id}” (${inner})` : `„${id}”`;
  };
  const bldName = (id: string, level?: number) => {
    const b = BLD.get(id);
    const lv = level ? arr(b?.levels)[level - 1] : arr(b?.levels)[0];
    return lv?.namePl ? `„${id}${level ? `:${level}` : ''}” (${lv.namePl})` : `„${id}${level ? `:${level}` : ''}”`;
  };
  const techName = (id: string) => {
    const t = TEC.get(id);
    return t?.namePl ? `„${id}” (${t.namePl})` : `„${id}”`;
  };
  const kindPl = (r: Resource) =>
    ({ raw: 'Surowiec kopalny', drop: 'Surowiec', material: 'Materiał', item: 'Przedmiot' })[r.kind] ?? 'Surowiec';

  /** Checks a list of stacks: existing resources, positive integer amounts, no repeats. */
  const stacks = (file: string, id: string, where: string, list: readonly Stack[] | undefined, allowEmpty = true) => {
    const seen = new Set<string>();
    if (!Array.isArray(list)) {
      err('range.cost', file, id, `${where}: brak listy składników.`, 'Podaj listę w postaci [s(\'id\', n), …] (może być pusta tylko tam, gdzie to dozwolone).');
      return;
    }
    if (!list.length && !allowEmpty) err('range.cost', file, id, `${where}: pusta lista.`, 'Podaj co najmniej jeden składnik.');
    for (const s of list) {
      if (!isObj(s)) {
        err('range.cost', file, id, `${where}: składnik ${String(s)} nie jest parą { id, n }.`, "Użyj helpera s('id', n).");
        continue;
      }
      if (!RES.has(s.id))
        err('ref.resource', file, id, `${where}: surowiec „${s.id}” nie istnieje.`, `Popraw id.${didYouMean(s.id, RES.keys())} Nowy surowiec dodaje się w ${F.resources}.`);
      if (!isInt(s.n) || s.n <= 0)
        err('range.cost', file, id, `${where}: ilość ${String(s.n)} × „${s.id}” — musi być liczbą całkowitą > 0.`, 'Wpisz dodatnią liczbę całkowitą (np. 2); zero i ułamki nie mają sensu w koszcie.');
      if (seen.has(s.id))
        warn('consistency.dupStack', file, id, `${where}: „${s.id}” występuje dwa razy.`, 'Połącz w jedną pozycję z sumaryczną ilością — gra może policzyć tylko jedną.');
      seen.add(s.id);
    }
  };

  const groups: [string, () => void][] = [];
  const group = (name: string, fn: () => void) => groups.push([name, fn]);

  // ================================================================ ids
  group('id', () => {
    const lists: [Collection, readonly { id: string }[]][] = [
      ['biomes', biomes], ['hazards', hazards], ['resources', resources], ['deposits', deposits], ['objects', wobjects],
      ['creatures', creatures], ['buildings', buildings], ['infrastructure', infra], ['recipes', recipes], ['tech', tech],
      ['greatWorks', greatWorks],
    ];
    for (const [coll, list] of lists) {
      const pos = new Map<string, number[]>();
      list.forEach((x, i) => {
        if (typeof x.id !== 'string' || !x.id) {
          err('id.missing', F[coll], `#${i + 1}`, `Pozycja nr ${i + 1} w ${COLL_PL[coll]} nie ma id.`, 'Dodaj unikalne id w formacie snake_case (np. „iron_bar”).');
          return;
        }
        if (!SNAKE.test(x.id))
          err('id.format', F[coll], x.id, `Id „${x.id}” nie jest w formacie snake_case (małe litery, cyfry i „_”, na początku litera). Id trafiają do zapisów gry.`,
            `Zmień na „${snakeOf(x.id)}” i popraw wszystkie odwołania (wyszukaj '${x.id}' w src/content/).`);
        pos.set(x.id, [...(pos.get(x.id) ?? []), i + 1]);
      });
      for (const [id, p] of pos)
        if (p.length > 1)
          err('id.duplicate', F[coll], id, `Id „${id}” występuje ${p.length}× w ${COLL_PL[coll]} (pozycje ${p.join(', ')}). Gra zachowa tylko jedną z nich.`,
            'Nadaj kopii nowe, unikalne id albo usuń duplikat.');
    }
    // resources, buildings and infrastructure share a namespace (hazard counters refer to any of them)
    const owner = new Map<string, string[]>();
    const add = (id: string, k: string) => owner.set(id, [...(owner.get(id) ?? []), k]);
    for (const id of RES.keys()) add(id, 'surowiec');
    for (const id of BLD.keys()) add(id, 'budowla');
    for (const id of INF.keys()) add(id, 'infrastruktura');
    for (const [id, ks] of owner)
      if (ks.length > 1)
        err('id.collision', BLD.has(id) ? F.buildings : F.resources, id, `Id „${id}” należy jednocześnie do: ${ks.join(', ')}. Odwołania bez rodzaju (np. HAZARDS.counters) będą niejednoznaczne.`,
          `Zmień id jednego z elementów (np. „${id}_${ks[1] === 'budowla' ? 'hall' : 'piece'}”) i popraw odwołania.`);
    // world materials: camelCase keys, dense numeric ids
    const keys = new Map<string, number>();
    materials.forEach((m, i) => {
      if (typeof m.key !== 'string' || !CAMEL.test(m.key))
        err('id.format', F.materials, str(m.key), `Klucz materiału „${str(m.key)}” nie jest w formacie camelCase (np. „magmaRock”).`, 'Zmień klucz i popraw odwołania w Biome.rocks.');
      if (keys.has(m.key))
        err('id.duplicate', F.materials, str(m.key), `Klucz materiału „${m.key}” występuje dwa razy (pozycje ${keys.get(m.key)! + 1} i ${i + 1}).`, 'Nadaj unikalny klucz.');
      else keys.set(m.key, i);
      if (m.id !== i)
        err('world.denseIds', F.materials, str(m.key), `Materiał „${m.key}” ma numer ${String(m.id)}, a stoi na pozycji ${i} listy MATERIALS. Tablice świata indeksują materiały numerem — luka albo przestawienie psuje mapę.`,
          `Numery muszą być kolejne od 0: ustaw ${i} (stała w M) albo przestaw wpis na właściwą pozycję.`);
    });
    // start lists
    const dupList = (file: string, name: string, list: readonly string[]) => {
      const seen = new Set<string>();
      for (const x of list) {
        if (seen.has(x)) warn('id.duplicate', file, name, `${name}: „${x}” występuje dwa razy.`, 'Usuń powtórzenie.');
        seen.add(x);
      }
    };
    dupList(F.recipes, 'START_RECIPES', startRecipes);
    dupList(F.buildings, 'START_INFRA', startInfra);
    dupList(F.resources, 'START_DISCOVERED', startDiscovered);
    dupList(F.buildings, 'START_BUILDINGS', startBuildings.map((x) => `${x[0]}:${x[1]}`));
  });

  // ================================================================ references
  group('ref', () => {
    const resPool = () => RES.keys();
    for (const r of recipes) {
      stacks(F.recipes, r.id, 'Wejście receptury', r.inputs);
      stacks(F.recipes, r.id, 'Wynik receptury', r.outputs, false);
      if (!BLD.has(r.at))
        err('ref.building', F.recipes, r.id, `Receptura wskazuje budowlę „${str(r.at)}”, której nie ma.`, `Popraw pole „at”.${didYouMean(r.at, BLD.keys())} Budowle: ${F.buildings}.`);
    }
    for (const b of buildings) arr(b.levels).forEach((lv, k) => isObj(lv) && stacks(F.buildings, `${b.id}:${k + 1}`, `Koszt poziomu ${k + 1} budowli ${bldName(b.id, k + 1)}`, lv.cost));
    for (const i of infra) stacks(F.buildings, i.id, `Koszt infrastruktury „${i.id}”`, i.cost, false);
    for (const g of greatWorks) arr(g.stages).forEach((st, k) => isObj(st) && stacks(F.greatWorks, g.id, `Koszt etapu ${k + 1} („${st.namePl}”)`, st.cost, false));
    for (const t of tech) {
      stacks(F.tech, t.id, 'Koszt badania', t.cost, false);
      for (const q of arr(t.requires))
        if (!TEC.has(q)) err('ref.tech', F.tech, t.id, `Wymaganie „${q}” nie jest węzłem badań.`, `Popraw id w requires.${didYouMean(q, TEC.keys())}`);
      for (const q of arr(t.revealBy))
        if (!RES.has(q)) err('ref.resource', F.tech, t.id, `revealBy: surowiec „${q}” nie istnieje — węzeł nigdy się nie odsłoni.`, `Popraw id.${didYouMean(q, resPool())}`);
      const u = isObj(t.unlocks) ? t.unlocks : {};
      for (const q of arr(u.recipes))
        if (!REC.has(q)) err('ref.recipe', F.tech, t.id, `unlocks.recipes: receptura „${q}” nie istnieje.`, `Popraw id.${didYouMean(q, REC.keys())} Receptury: ${F.recipes}.`);
      for (const q of arr(u.infra))
        if (!INF.has(q)) err('ref.infra', F.tech, t.id, `unlocks.infra: infrastruktura „${q}” nie istnieje.`, `Popraw id.${didYouMean(q, INF.keys())}`);
      for (const pair of arr(u.buildings)) {
        const [bid, lvl] = Array.isArray(pair) ? pair : [pair, undefined];
        if (!BLD.has(bid)) err('ref.building', F.tech, t.id, `unlocks.buildings: budowla „${str(bid)}” nie istnieje.`, `Popraw id.${didYouMean(str(bid), BLD.keys())}`);
        else if (!(isInt(lvl) && lvl >= 1 && lvl <= 3))
          err('ref.building', F.tech, t.id, `unlocks.buildings: poziom ${String(lvl)} budowli „${bid}” — budowle mają poziomy 1, 2, 3.`, "Użyj B('id', 1|2|3).");
      }
    }
    for (const d of deposits) {
      const y = RES.get(d.yields);
      if (!y) err('ref.resource', F.deposits, d.id, `Złoże daje „${str(d.yields)}”, którego nie ma wśród surowców.`, `Popraw „yields”.${didYouMean(d.yields, resPool())}`);
      else if (y.kind !== 'raw')
        err('ref.kind', F.deposits, d.id, `Złoże daje ${resName(d.yields)} rodzaju „${y.kind}”, a złoża dają tylko surowce kopalne (kind: raw).`, `Zmień kind surowca na raw w ${F.resources} albo wskaż inny surowiec.`);
      if (!arr(d.biomes).length) err('ref.biome', F.deposits, d.id, 'Złoże nie występuje w żadnym biomie (biomes: []).', 'Dodaj co najmniej jeden biom.');
      for (const b of arr(d.biomes))
        if (!BIO.has(b)) err('ref.biome', F.deposits, d.id, `Biom „${b}” nie istnieje.`, `Popraw id biomu.${didYouMean(b, BIO.keys())}`);
    }
    const drops = (file: string, id: string, list: readonly DropEntry[] | undefined) => {
      for (const dr of arr(list)) {
        if (!isObj(dr)) continue;
        if (!RES.has(dr.id)) err('ref.resource', file, id, `Łup „${dr.id}” nie istnieje wśród surowców.`, `Popraw id.${didYouMean(dr.id, resPool())}`);
      }
    };
    const hasAxe = resources.some((r) => arr(r.tags).includes('axe'));
    const hasRod = resources.some((r) => arr(r.tags).includes('fishing'));
    const hasPick = resources.some((r) => r.slot === 'pick');
    for (const o of wobjects) {
      drops(F.objects, o.id, o.drops);
      for (const b of arr(o.biomes)) if (!BIO.has(b)) err('ref.biome', F.objects, o.id, `Biom „${b}” nie istnieje.`, `Popraw id biomu.${didYouMean(b, BIO.keys())}`);
      if (o.tool !== undefined && !TOOLS.has(o.tool))
        err('ref.tool', F.objects, o.id, `Narzędzie „${str(o.tool)}” nie jest znane (dozwolone: axe, pick, rod, hands).`, 'Popraw pole tool.');
      else if ((o.tool === 'axe' && !hasAxe) || (o.tool === 'rod' && !hasRod) || (o.tool === 'pick' && !hasPick))
        err('ref.tool', F.objects, o.id, `Obiekt wymaga narzędzia „${o.tool}”, ale żaden przedmiot go nie zapewnia (${o.tool === 'axe' ? "tag 'axe'" : o.tool === 'rod' ? "tag 'fishing'" : "slot 'pick'"}).`,
          'Dodaj taki przedmiot w src/content/resources.ts albo zmień narzędzie obiektu.');
    }
    for (const c of creatures) {
      drops(F.creatures, c.id, c.drops);
      if (!BIO.has(c.biome)) err('ref.biome', F.creatures, c.id, `Biom „${str(c.biome)}” nie istnieje.`, `Popraw id biomu.${didYouMean(c.biome, BIO.keys())}`);
    }
    for (const h of hazards)
      for (const c of arr(h.counters))
        if (!RES.has(c) && !BLD.has(c) && !INF.has(c))
          err('ref.resource', F.hazards, h.id, `Ochrona „${c}” nie jest ani przedmiotem, ani budowlą, ani infrastrukturą.`, `Popraw id.${didYouMean(c, [...RES.keys(), ...BLD.keys(), ...INF.keys()])}`);
    for (const b of biomes)
      for (const h of arr(b.hazards))
        if (!HAZ.has(h)) err('ref.hazard', F.biomes, b.id, `Zagrożenie „${h}” nie istnieje.`, `Popraw id.${didYouMean(h, HAZ.keys())} Zagrożenia: HAZARDS w ${F.hazards}.`);
    // start lists and constants
    for (const sb of startBuildings) {
      const [bid, lvl] = sb;
      if (!BLD.has(bid)) err('ref.building', F.buildings, 'START_BUILDINGS', `START_BUILDINGS: budowla „${bid}” nie istnieje.`, `Popraw id.${didYouMean(bid, BLD.keys())}`);
      else if (!(isInt(lvl) && lvl >= 1 && lvl <= 3)) err('ref.building', F.buildings, 'START_BUILDINGS', `START_BUILDINGS: poziom ${String(lvl)} budowli „${bid}”.`, 'Poziomy to 1, 2, 3.');
    }
    for (const x of startRecipes)
      if (!REC.has(x)) err('ref.recipe', F.recipes, 'START_RECIPES', `START_RECIPES: receptura „${x}” nie istnieje.`, `Popraw id.${didYouMean(x, REC.keys())}`);
    for (const x of startInfra)
      if (!INF.has(x)) err('ref.infra', F.buildings, 'START_INFRA', `START_INFRA: infrastruktura „${x}” nie istnieje.`, `Popraw id.${didYouMean(x, INF.keys())}`);
    for (const x of startDiscovered)
      if (!RES.has(x)) err('ref.resource', F.resources, 'START_DISCOVERED', `START_DISCOVERED: surowiec „${x}” nie istnieje.`, `Popraw id.${didYouMean(x, resPool())}`);
    for (const x of researchPacks)
      if (!RES.has(x)) err('ref.resource', F.tech, 'RESEARCH_PACKS', `RESEARCH_PACKS: paczka „${x}” nie istnieje wśród surowców.`, `Popraw id.${didYouMean(x, resPool())}`);
    for (const k of Object.keys(rockPickTier))
      if (!BIO.has(k)) err('ref.biome', F.deposits, 'ROCK_PICK_TIER', `ROCK_PICK_TIER: biom „${k}” nie istnieje.`, `Popraw klucz.${didYouMean(k, BIO.keys())}`);
    for (const b of biomes)
      if (!(b.id in rockPickTier))
        err('ref.biome', F.deposits, 'ROCK_PICK_TIER', `ROCK_PICK_TIER nie ma wpisu dla biomu „${b.id}” — nie wiadomo, jakim kilofem kopać jego skałę.`, `Dodaj ${b.id}: <poziom 0–5>.`);
    if (!RES.has(rockYield))
      err('ref.resource', F.resources, str(rockYield), `Zwykła skała ma dawać „${str(rockYield)}”, a takiego surowca nie ma.`, 'Przywróć surowiec (zwykle „stone”) albo popraw rockYield w src/tools/contentBundle.ts.');
  });

  // ================================================================ world materials
  group('world', () => {
    const byDeposit = new Map<string, MaterialInfo[]>();
    for (const m of materials) if (m.deposit) byDeposit.set(m.deposit, [...(byDeposit.get(m.deposit) ?? []), m]);
    for (const d of deposits) {
      const ms = byDeposit.get(d.id) ?? [];
      if (!ms.length)
        err('world.depositMaterial', F.materials, d.id, `Złoże „${d.id}” (${d.namePl}) nie ma materiału świata — generator nie umieści go w skale, a gracz go nie wykopie.`,
          `Dodaj w ${F.materials} wpis D(M.NOWY, 'kluczCamelCase', '${d.id}', 'nazwa', 'name', 'ore') i wygląd w src/render/palette.ts.`);
      else if (ms.length > 1)
        err('world.depositMaterial', F.materials, d.id, `Złoże „${d.id}” ma ${ms.length} materiały świata (${ms.map((m) => m.key).join(', ')}).`,
          'Zostaw jeden materiał na złoże; pozostałe zamień w skałę (helper T) albo przypisz innym złożom.');
      for (const m of ms)
        if (m.hardness !== d.hardness || m.tier !== d.pickTier)
          err('world.mismatch', F.materials, m.key, `Materiał „${m.key}”: twardość ${m.hardness} / kilof ${m.tier}, a złoże „${d.id}”: ${d.hardness} / ${d.pickTier}. Świat i model balansu się rozjeżdżają.`,
            'Materiały złóż biorą te liczby ze złoża (helper D w materials.ts) — nie nadpisuj ich; zmieniaj je w src/content/sources.ts.');
    }
    for (const m of materials) {
      if (m.deposit && !DEP.has(m.deposit))
        err('world.materialDeposit', F.materials, m.key, `Materiał „${m.key}” wskazuje złoże „${m.deposit}”, którego nie ma w ${F.deposits}.`,
          `Popraw id złoża.${didYouMean(m.deposit, DEP.keys())} (W tym stanie materials.ts rzuca wyjątek przy starcie gry.)`);
      if (!m.deposit && (m.cls === 'ore' || m.cls === 'gem'))
        warn('world.oreWithoutDeposit', F.materials, m.key, `Materiał „${m.key}” ma klasę „${m.cls}”, ale nie jest złożem — wygląda jak ruda, a nic z niego nie wypada.`,
          'Przypisz mu złoże (helper D) albo zmień klasę na rock/special.');
    }
    const usedAsRock = new Set<string>();
    for (const b of biomes) {
      const rocks = arr(b.rocks);
      if (!rocks.length) err('world.biomeRock', F.biomes, b.id, `Biom „${b.id}” nie ma żadnej skały gospodarza (rocks: []).`, 'Dodaj co najmniej jedną skałę (najczęstsza na początku listy).');
      const seen = new Set<string>();
      for (const k of rocks) {
        if (seen.has(k)) warn('consistency.dupStack', F.biomes, b.id, `Biom „${b.id}”: skała „${k}” występuje dwa razy w rocks.`, 'Usuń powtórzenie.');
        seen.add(k);
        usedAsRock.add(k);
        const m = MAT.get(k);
        if (!m) {
          err('world.biomeRock', F.biomes, b.id, `Biom „${b.id}”: skała „${k}” nie ma materiału świata.`,
            `Popraw klucz.${didYouMean(k, MAT.keys())} Klucze materiałów (camelCase): ${F.materials}.`);
          continue;
        }
        if (!m.solid) err('world.biomeRock', F.biomes, b.id, `Biom „${b.id}”: „${k}” nie jest materiałem litym (${m.cls}).`, 'Skałą biomu może być tylko lity materiał.');
        const rt = rockPickTier[b.id];
        if (m.tier !== NEVER_TIER && isInt(rt) && m.tier !== rt)
          warn('world.rockTier', F.deposits, 'ROCK_PICK_TIER', `Biom „${b.id}”: skała „${k}” wymaga kilofa ${m.tier}, a ROCK_PICK_TIER.${b.id} = ${rt}. Analiza progresji i świat różnie oceniają, czym kopać ten biom.`,
            `Ujednolij: popraw ROCK_PICK_TIER w ${F.deposits} albo poziom skały w ${F.materials}.`);
      }
    }
    for (const m of materials)
      if ((m.cls === 'rock' || m.cls === 'soil') && !m.deposit && !usedAsRock.has(m.key))
        warn('world.unusedMaterial', F.materials, m.key, `Materiał „${m.key}” (${m.cls}) nie jest skałą żadnego biomu ani złożem — generator nigdy go nie użyje.`,
          `Dodaj go do Biome.rocks w ${F.biomes} albo usuń.`);
  });

  // ================================================================ value ranges
  group('range', () => {
    const maxPick = resources.reduce((m, r) => (r.slot === 'pick' && isNum(r.stats?.pickTier) ? Math.max(m, r.stats!.pickTier!) : m), 0);
    for (const r of resources) {
      if (!RES_KINDS.has(r.kind)) err('range.value', F.resources, r.id, `Rodzaj „${str(r.kind)}” nie istnieje (raw, drop, material, item).`, 'Użyj helpera raw/drop/mat/item.');
      if (!r.namePl || !r.nameEn) err('range.name', F.resources, r.id, `${kindPl(r)} „${r.id}” nie ma nazwy ${!r.namePl ? 'polskiej' : 'angielskiej'}.`, 'Uzupełnij namePl i nameEn (nazwy własne: tylko nasze, zob. docs/narrative/).');
      if (!(isInt(r.tier) && r.tier >= 0 && r.tier <= maxBiomeTier))
        err('range.value', F.resources, r.id, `Warstwa (tier) ${String(r.tier)} — dozwolone liczby całkowite 0–${maxBiomeTier}.`, 'Tier = biom, w którym surowiec pierwszy raz da się zdobyć.');
      if (!(isNum(r.value) && r.value >= 0)) err('range.value', F.resources, r.id, `Wartość ${String(r.value)} — musi być liczbą ≥ 0.`, 'Ustaw wartość handlową (np. 4).');
      if (!(isInt(r.stack) && r.stack >= 1)) err('range.value', F.resources, r.id, `Stos ${String(r.stack)} — musi być liczbą całkowitą ≥ 1.`, 'Helpery ustawiają go same (50 / 20 / 1) — nie nadpisuj.');
      if (r.kind === 'item' && !SLOTS.has(r.slot as string))
        err('range.value', F.resources, r.id, `Przedmiot bez poprawnego slotu (${String(r.slot)}).`, `Podaj slot: ${[...SLOTS].join(', ')}.`);
      if (r.kind !== 'item' && r.slot !== undefined)
        warn('range.value', F.resources, r.id, `${kindPl(r)} „${r.id}” ma slot „${r.slot}”, choć nie jest przedmiotem.`, 'Usuń slot albo zmień rodzaj na item.');
      const st = isObj(r.stats) ? (r.stats as Record<string, unknown>) : {};
      for (const [k, v] of Object.entries(st)) {
        if (!isNum(v)) {
          err('range.value', F.resources, r.id, `Statystyka ${k} = ${String(v)} nie jest liczbą.`, 'Wpisz liczbę.');
          continue;
        }
        if (v === 0) warn('range.zeroStat', F.resources, r.id, `Przedmiot ${resName(r.id)}: statystyka ${k} = 0 nic nie zmienia.`, `Usuń pole ${k} albo nadaj mu wartość.`);
        if (RESISTANCES.has(k) && (v < 0 || v > 1))
          err('range.value', F.resources, r.id, `Odporność ${k} = ${v} — odporności to ułamki 0–1 (1 = pełna ochrona).`, 'Np. 0.5 = połowa obrażeń od żywiołu.');
        if ((k === 'workSpeed' || k === 'durability') && v <= 0) err('range.value', F.resources, r.id, `${k} = ${v} — musi być > 0.`, `Ustaw dodatni ${k}.`);
      }
      if (r.slot === 'pick') {
        const p = st.pickTier;
        if (!(isInt(p) && p >= 1 && p <= MAX_PICK))
          err('range.pickTier', F.resources, r.id, `Kilof ${resName(r.id)} ma pickTier ${String(p)} — dozwolone 1–${MAX_PICK}.`, 'Kilof kopie materiały o poziomie ≤ pickTier (0 = gołe ręce).');
      } else if (st.pickTier !== undefined)
        warn('range.pickTier', F.resources, r.id, `${resName(r.id)} ma pickTier, choć nie jest kilofem (slot ${String(r.slot)}).`, "Usuń pickTier albo ustaw slot 'pick'.");
    }
    for (const d of deposits) {
      if (!d.namePl || !d.nameEn) err('range.name', F.deposits, d.id, `Złoże „${d.id}” nie ma nazwy polskiej lub angielskiej.`, 'Uzupełnij namePl i nameEn.');
      if (!(isNum(d.hardness) && d.hardness > 0))
        err('range.hardness', F.deposits, d.id, `Twardość ${String(d.hardness)} — musi być liczbą > 0 (jednostki pracy na kafel).`, 'Skala w grze: glina 1.3 … adamantyt 8.');
      if (!(isInt(d.pickTier) && d.pickTier >= 0 && d.pickTier <= MAX_PICK))
        err('range.pickTier', F.deposits, d.id, `Poziom kilofa ${String(d.pickTier)} poza zakresem 0–${MAX_PICK} (0 = ręce/krzemień … 5 = adamant).`, 'Wpisz liczbę całkowitą 0–5.');
      else if (d.pickTier > maxPick)
        err('range.pickTier', F.deposits, d.id, `Złoże wymaga kilofa ${d.pickTier}, a najlepszy kilof w grze ma ${maxPick} — nie da się go wydobyć.`, `Obniż pickTier albo dodaj kilof z pickTier ≥ ${d.pickTier}.`);
      if (!(isNum(d.amount) && d.amount > 0)) err('range.value', F.deposits, d.id, `Wydobycie (amount) ${String(d.amount)} — musi być > 0 na kafel.`, 'Typowo 1–3.');
      if (!RARITIES.has(d.rarity)) err('range.value', F.deposits, d.id, `Rzadkość „${str(d.rarity)}” nie istnieje.`, `Dozwolone: ${[...RARITIES].join(', ')}.`);
    }
    for (const [k, v] of Object.entries(rockPickTier))
      if (!(isInt(v) && v >= 0 && v <= MAX_PICK))
        err('range.pickTier', F.deposits, 'ROCK_PICK_TIER', `ROCK_PICK_TIER.${k} = ${String(v)} — dozwolone 0–${MAX_PICK}.`, 'Poziom kilofa potrzebnego na zwykłą skałę biomu.');
      else if (v > maxPick) err('range.pickTier', F.deposits, 'ROCK_PICK_TIER', `ROCK_PICK_TIER.${k} = ${v}, a najlepszy kilof ma ${maxPick}.`, 'Obniż poziom albo dodaj kilof.');
    for (const m of materials) {
      if (!(isInt(m.tier) && ((m.tier >= 0 && m.tier <= MAX_PICK) || m.tier === NEVER_TIER)))
        err('range.pickTier', F.materials, m.key, `Materiał „${m.key}”: poziom kilofa ${String(m.tier)} — dozwolone 0–${MAX_PICK} albo ${NEVER_TIER} (nie do wykopania).`, 'Popraw tier.');
      if (m.solid && !(m.hardness > 0 && (Number.isFinite(m.hardness) || m.tier === NEVER_TIER)))
        err('range.hardness', F.materials, m.key, `Materiał „${m.key}”: twardość ${String(m.hardness)} — lite materiały mają twardość > 0 (nieskończoność tylko przy poziomie ${NEVER_TIER}).`, 'Popraw hardness.');
    }
    for (const b of buildings) {
      const lv = arr(b.levels);
      if (lv.length !== 3)
        err('range.levels', F.buildings, b.id, `Budowla „${b.id}” ma ${lv.length} ${plural(lv.length, 'poziom', 'poziomy', 'poziomów')} — każda budowla musi mieć dokładnie 3 (wymóg właściciela).`,
          'Uzupełnij levels do trzech poziomów L(…) albo usuń nadmiarowe.');
      if (!CATEGORIES.has(b.category)) err('range.value', F.buildings, b.id, `Kategoria „${str(b.category)}” nie istnieje.`, `Dozwolone: ${[...CATEGORIES].join(', ')}.`);
      if (!b.descPl) warn('range.name', F.buildings, b.id, `Budowla „${b.id}” nie ma opisu (descPl).`, 'Dopisz jedno-dwa zdania: do czego służy.');
      lv.forEach((l, k) => {
        const id = `${b.id}:${k + 1}`;
        if (!isObj(l)) return;
        if (!l.namePl || !l.nameEn) err('range.name', F.buildings, id, `Poziom ${k + 1} budowli „${b.id}” nie ma nazwy polskiej lub angielskiej.`, 'Uzupełnij pierwsze dwa argumenty L(…).');
        if (!(isNum(l.work) && l.work > 0)) err('range.value', F.buildings, id, `Praca budowy ${String(l.work)} — musi być > 0.`, 'Jednostki pracy krasnoluda (np. 40).');
        const sz = arr(l.size);
        if (!(sz.length === 2 && sz.every((x) => isInt(x) && x >= 1)))
          err('range.value', F.buildings, id, `Rozmiar ${JSON.stringify(l.size)} — oczekiwano [szerokość, wysokość] w kaflach (liczby całkowite ≥ 1).`, 'Np. [3, 2].');
        if (!(isInt(l.workers) && l.workers >= 0)) err('range.value', F.buildings, id, `Liczba pracowników ${String(l.workers)} — liczba całkowita ≥ 0.`, 'Popraw workers.');
        if (l.power !== undefined && !isNum(l.power)) err('range.value', F.buildings, id, `Moc ${String(l.power)} nie jest liczbą.`, 'Dodatnia = pobór, ujemna = produkcja energii.');
        for (const [ek, ev] of Object.entries(isObj(l.effects) ? l.effects : {}))
          if (!isNum(ev)) err('range.value', F.buildings, id, `Efekt ${ek} = ${String(ev)} nie jest liczbą.`, 'Efekty to liczby (pojemność, prędkość…).');
        const prev = k > 0 ? lv[k - 1] : undefined;
        if (prev && isObj(prev) && isNum(prev.work) && isNum(l.work) && l.work < prev.work)
          warn('range.levelOrder', F.buildings, id, `Poziom ${k + 1} budowli „${b.id}” buduje się krócej (${l.work}) niż poziom ${k} (${prev.work}).`, 'Sprawdź, czy to celowe — zwykle praca rośnie z poziomem.');
      });
    }
    for (const i of infra) {
      if (!i.namePl || !i.nameEn) err('range.name', F.infrastructure, i.id, `Infrastruktura „${i.id}” nie ma nazwy polskiej lub angielskiej.`, 'Uzupełnij nazwy.');
      if (!(isNum(i.work) && i.work > 0)) err('range.value', F.infrastructure, i.id, `Praca ${String(i.work)} — musi być > 0.`, 'Popraw work.');
      if (!(isInt(i.tier) && i.tier >= 0 && i.tier <= maxBiomeTier)) err('range.value', F.infrastructure, i.id, `Warstwa ${String(i.tier)} — dozwolone 0–${maxBiomeTier}.`, 'Popraw tier.');
    }
    for (const r of recipes) {
      if (!(r.level === 1 || r.level === 2 || r.level === 3))
        err('range.value', F.recipes, r.id, `Poziom budowli ${String(r.level)} — receptury wymagają poziomu 1, 2 albo 3.`, 'Popraw level.');
      if (!(isNum(r.time) && r.time > 0)) err('range.value', F.recipes, r.id, `Czas ${String(r.time)} — musi być > 0 (sekundy pracy).`, 'Popraw time.');
      if (r.power !== undefined && !(isNum(r.power) && r.power > 0))
        err('range.value', F.recipes, r.id, `Moc receptury ${String(r.power)} — gdy jest podana, musi być > 0 (receptury nie produkują energii).`, 'Usuń pole power albo wpisz pobór > 0.');
    }
    for (const t of tech) {
      if (!t.namePl || !t.nameEn) err('range.name', F.tech, t.id, `Węzeł „${t.id}” nie ma nazwy polskiej lub angielskiej.`, 'Uzupełnij nazwy.');
      if (!(isInt(t.tier) && t.tier >= 0 && t.tier <= maxBiomeTier)) err('range.value', F.tech, t.id, `Warstwa ${String(t.tier)} — dozwolone 0–${maxBiomeTier}.`, 'Popraw tier.');
      if (!(isNum(t.size) && t.size >= 1 && t.size <= 3)) err('range.value', F.tech, t.id, `Rozmiar ${String(t.size)} — dozwolone 1 (mały) … 3 (kluczowy).`, 'Rozmiar steruje kosztem paczek (packCost).');
    }
    for (const b of biomes) {
      if (!b.namePl) err('range.name', F.biomes, b.id, `Biom „${b.id}” nie ma nazwy polskiej.`, 'Uzupełnij namePl.');
      const dp = arr(b.depth);
      if (!(dp.length === 2 && isNum(dp[0]) && isNum(dp[1]) && dp[0] < dp[1]))
        err('range.value', F.biomes, b.id, `Głębokość ${JSON.stringify(b.depth)} — oczekiwano [od, do] z od < do.`, 'Np. [100, 190].');
    }
    const tiers = biomes.map((b) => b.tier).sort((a, c) => a - c);
    tiers.forEach((t, i) => {
      if (t !== i)
        err('range.value', F.biomes, biomes.find((b) => b.tier === t)?.id ?? 'BIOMES', `Warstwy biomów nie idą kolejno od 0 (oczekiwano ${i}, jest ${t}).`, 'Każdy biom ma unikalny tier 0, 1, 2, …');
    });
    const byTier = [...biomes].sort((a, c) => a.tier - c.tier);
    for (let i = 1; i < byTier.length; i++) {
      const a = arr(byTier[i - 1]!.depth);
      const c = arr(byTier[i]!.depth);
      if (isNum(a[1]) && isNum(c[0]) && a[1] !== c[0])
        warn('range.value', F.biomes, byTier[i]!.id, `Biom „${byTier[i]!.id}” zaczyna się na ${c[0]}, a poprzedni kończy na ${a[1]} — ${c[0] > a[1] ? 'luka' : 'nakładanie'} pasów głębokości.`, 'Ustaw depth tak, żeby pasy się stykały.');
    }
    const dropRange = (file: string, id: string, list: readonly DropEntry[] | undefined) => {
      for (const d of arr(list)) {
        if (!isObj(d)) {
          err('range.drop', file, id, `Łup ${String(d)} nie jest wpisem d(id, min, max, szansa).`, 'Użyj helpera d(…).');
          continue;
        }
        if (!(isInt(d.min) && isInt(d.max) && d.min >= 0 && d.min <= d.max && d.max >= 1 && isNum(d.chance) && d.chance > 0 && d.chance <= 1))
          err('range.drop', file, id, `Łup „${d.id}”: min ${String(d.min)}, max ${String(d.max)}, szansa ${String(d.chance)} — wymagane 0 ≤ min ≤ max, max ≥ 1, 0 < szansa ≤ 1.`,
            'Np. d(\'bone\', 1, 3, 0.5) = 1–3 sztuki z szansą 50%.');
      }
    };
    for (const o of wobjects) {
      dropRange(F.objects, o.id, o.drops);
      if (!(isNum(o.work) && o.work > 0)) err('range.value', F.objects, o.id, `Praca zbioru ${String(o.work)} — musi być > 0.`, 'Popraw work.');
      if (!arr(o.biomes).length) err('ref.biome', F.objects, o.id, 'Obiekt nie występuje w żadnym biomie.', 'Dodaj biomes.');
    }
    for (const c of creatures) {
      dropRange(F.creatures, c.id, c.drops);
      if (!BEHAVIORS.has(c.behavior)) err('range.value', F.creatures, c.id, `Zachowanie „${str(c.behavior)}” nie istnieje.`, `Dozwolone: ${[...BEHAVIORS].join(', ')}.`);
      if (!(isNum(c.hp) && c.hp > 0)) err('range.value', F.creatures, c.id, `HP ${String(c.hp)} — musi być > 0.`, 'Popraw hp.');
      if (!(isNum(c.speed) && c.speed > 0)) err('range.value', F.creatures, c.id, `Prędkość ${String(c.speed)} — musi być > 0 (kafle/s).`, 'Popraw speed.');
      if (!(isNum(c.damage) && c.damage >= 0) || !(isNum(c.armor) && c.armor >= 0))
        err('range.value', F.creatures, c.id, `Obrażenia ${String(c.damage)} / pancerz ${String(c.armor)} — muszą być ≥ 0.`, 'Popraw damage/armor.');
      if (!!c.boss !== (c.behavior === 'boss'))
        warn('range.value', F.creatures, c.id, `Flaga boss (${String(c.boss)}) nie zgadza się z zachowaniem „${c.behavior}”.`, "Boss = behavior 'boss' (helper c(…) ustawia flagę sam).");
    }
    for (const g of greatWorks) {
      const st = arr(g.stages);
      if (st.length !== 3) err('range.levels', F.greatWorks, g.id, `Wielkie Dzieło „${g.id}” ma ${st.length} etapów — wymagane 3.`, 'Uzupełnij stages.');
      st.forEach((s, k) => {
        if (isObj(s) && !(isNum(s.work) && s.work > 0)) err('range.value', F.greatWorks, g.id, `Etap ${k + 1}: praca ${String(s.work)} — musi być > 0.`, 'Popraw work.');
      });
      if (!(isInt(g.tier) && g.tier >= 0 && g.tier <= maxBiomeTier)) err('range.value', F.greatWorks, g.id, `Warstwa ${String(g.tier)} — dozwolone 0–${maxBiomeTier}.`, 'Popraw tier.');
    }
  });

  // ================================================================ unlock coverage + tech graph
  const unlockers = new Map<string, string[]>(); // `recipe:x` / `building:x:l` / `infra:x` -> tech ids
  for (const t of tech) {
    const u = isObj(t.unlocks) ? t.unlocks : {};
    const add = (k: string) => unlockers.set(k, [...(unlockers.get(k) ?? []), t.id]);
    for (const r of arr(u.recipes)) add(`recipe:${r}`);
    for (const p of arr(u.buildings)) if (Array.isArray(p)) add(`building:${p[0]}:${p[1]}`);
    for (const i of arr(u.infra)) add(`infra:${i}`);
  }
  const startB = new Set(startBuildings.map(([b, l]) => `${b}:${l}`));
  const startR = new Set(startRecipes);
  const startI = new Set(startInfra);
  group('unlock', () => {
    const cover = (file: string, id: string, what: string, key: string, isStart: boolean, startName: string, field: string) => {
      const by = unlockers.get(key) ?? [];
      const n = by.length + (isStart ? 1 : 0);
      if (n === 0)
        err('unlock.missing', file, id, `${what} nie jest odblokowywana przez żaden węzeł badań ani dostępna od startu — gracz nigdy jej nie zobaczy.`,
          `Dodaj ją do unlocks.${field} właściwego węzła w ${F.tech} (albo do ${startName}).`);
      else if (n > 1)
        err('unlock.duplicate', file, id, `${what} jest odblokowywana ${n}×: ${[...(isStart ? [startName] : []), ...by.map(techName)].join(', ')}. Analiza progresji uwzględnia tylko jedno.`,
          'Zostaw jedno odblokowanie.');
    };
    for (const r of recipes) cover(F.recipes, r.id, `Receptura „${r.id}”`, `recipe:${r.id}`, startR.has(r.id), 'START_RECIPES', 'recipes');
    for (const b of buildings)
      arr(b.levels).forEach((_, k) =>
        cover(F.buildings, `${b.id}:${k + 1}`, `Poziom ${k + 1} budowli ${bldName(b.id, k + 1)}`, `building:${b.id}:${k + 1}`, startB.has(`${b.id}:${k + 1}`), 'START_BUILDINGS', 'buildings'),
      );
    for (const i of infra) cover(F.infrastructure, i.id, `Infrastruktura „${i.id}”`, `infra:${i.id}`, startI.has(i.id), 'START_INFRA', 'infra');
    for (const t of tech) {
      const u = isObj(t.unlocks) ? t.unlocks : {};
      if (!arr(u.recipes).length && !arr(u.buildings).length && !arr(u.infra).length)
        warn('unlock.nothing', F.tech, t.id, `Węzeł ${techName(t.id)} niczego nie odblokowuje — gracz zapłaci paczkami bez nagrody.`, 'Dodaj unlocks (receptury, poziomy budowli, infrastrukturę) albo usuń węzeł.');
    }
  });
  group('tech', () => {
    for (const t of tech) {
      const seen = new Set<string>();
      for (const q of arr(t.requires)) {
        if (q === t.id) err('tech.order', F.tech, t.id, `Węzeł ${techName(t.id)} wymaga samego siebie.`, 'Usuń go z requires.');
        if (seen.has(q)) warn('tech.order', F.tech, t.id, `Wymaganie „${q}” jest wpisane dwa razy.`, 'Usuń powtórzenie.');
        seen.add(q);
        const p = TEC.get(q);
        if (p && isInt(p.tier) && isInt(t.tier) && p.tier > t.tier)
          err('tech.order', F.tech, t.id, `Węzeł ${techName(t.id)} (T${t.tier}) wymaga ${techName(q)} z późniejszej warstwy T${p.tier}.`,
            `Przenieś węzeł do T${p.tier} albo zmień wymaganie na węzeł z T≤${t.tier}.`);
      }
    }
    // cycles (iterative DFS, report each cycle once by its smallest id)
    const state = new Map<string, number>(); // 1 = on stack, 2 = done
    const reported = new Set<string>();
    for (const start of TEC.keys()) {
      if (state.get(start) === 2) continue;
      const stack: [string, number][] = [[start, 0]];
      const path: string[] = [];
      while (stack.length) {
        const top = stack[stack.length - 1]!;
        const [id, i] = top;
        if (i === 0) {
          state.set(id, 1);
          path.push(id);
        }
        const reqs = arr(TEC.get(id)?.requires).filter((q) => TEC.has(q) && q !== id);
        if (i < reqs.length) {
          top[1] = i + 1;
          const q = reqs[i]!;
          const s = state.get(q);
          if (s === 1) {
            const cyc = path.slice(path.indexOf(q));
            const key = [...cyc].sort().join('>');
            if (!reported.has(key)) {
              reported.add(key);
              err('tech.cycle', F.tech, [...cyc].sort()[0]!, `Cykl w wymaganiach badań: ${[...cyc, q].join(' → ')}. Żadnego z tych węzłów nie da się zbadać.`,
                'Usuń jedno z wymagań w tym cyklu.');
            }
          } else if (s === undefined) stack.push([q, 0]);
        } else {
          state.set(id, 2);
          path.pop();
          stack.pop();
        }
      }
    }
  });

  // ================================================================ sources + orphans
  const produced = new Map<string, string[]>(); // resource -> recipe ids
  for (const r of recipes) for (const o of arr(r.outputs)) if (isObj(o)) produced.set(o.id, [...(produced.get(o.id) ?? []), r.id]);
  const fromDeposit = new Set(deposits.map((d) => d.yields));
  const dropSources = new Map<string, string[]>();
  for (const o of wobjects) for (const d of arr(o.drops)) if (isObj(d)) dropSources.set(d.id, [...(dropSources.get(d.id) ?? []), o.id]);
  for (const c of creatures) for (const d of arr(c.drops)) if (isObj(d)) dropSources.set(d.id, [...(dropSources.get(d.id) ?? []), c.id]);
  const usedBy = new Map<string, string[]>(); // resource -> "where" labels
  const use = (id: string, where: string) => usedBy.set(id, [...(usedBy.get(id) ?? []), where]);
  for (const r of recipes) for (const s of arr(r.inputs)) if (isObj(s)) use(s.id, `receptura ${r.id}`);
  for (const b of buildings) arr(b.levels).forEach((lv, k) => isObj(lv) && arr(lv.cost).forEach((s) => isObj(s) && use(s.id, `budowla ${b.id}:${k + 1}`)));
  for (const i of infra) for (const s of arr(i.cost)) if (isObj(s)) use(s.id, `infrastruktura ${i.id}`);
  for (const t of tech) for (const s of arr(t.cost)) if (isObj(s)) use(s.id, `badanie ${t.id}`);
  for (const g of greatWorks) arr(g.stages).forEach((st, k) => isObj(st) && arr(st.cost).forEach((s) => isObj(s) && use(s.id, `Wielkie Dzieło ${g.id}:${k + 1}`)));
  const isTrophy = (r: Resource | undefined) => !!r && arr(r.tags).includes('trophy');

  group('source', () => {
    for (const r of resources) {
      if ((r.kind === 'material' || r.kind === 'item') && !produced.has(r.id))
        err('source.missing', F.resources, r.id, `${kindPl(r)} ${resName(r.id)} nie ma receptury — nie da się go wytworzyć.`,
          `Dodaj recepturę w ${F.recipes} (np. make('${r.id}', 1, '<budowla>', 1, [s('…', 2)], 10)) albo zmień kind (drop, jeśli wypada ze stworzeń).`);
      if (r.kind === 'raw' && !fromDeposit.has(r.id) && r.id !== rockYield)
        err('source.missing', F.resources, r.id, `Surowiec kopalny ${resName(r.id)} nie wypada z żadnego złoża.`, `Dodaj złoże z yields: '${r.id}' w ${F.deposits} albo zmień kind.`);
      if (r.kind === 'drop' && !dropSources.has(r.id))
        err('source.missing', F.resources, r.id, `Surowiec ${resName(r.id)} (drop) nie wypada z żadnego obiektu ani stworzenia.`, `Dodaj go do drops obiektu lub stworzenia w ${F.objects}.`);
    }
  });
  group('orphan', () => {
    for (const r of resources) {
      if (r.kind === 'item' || usedBy.has(r.id)) continue;
      if (arr(r.tags).includes('quest')) {
        skipped.push({ rule: 'orphan.unused', id: r.id, reason: 'przedmiot fabularny (tag quest) — zużywa go wydarzenie, nie receptura' });
        continue;
      }
      if (isTrophy(r)) continue; // reported more precisely by boss.trophyTech
      const how = r.kind === 'material' ? `jest wytwarzany (${(produced.get(r.id) ?? []).join(', ') || 'brak receptury'})` : r.kind === 'raw' ? 'jest wydobywany' : 'jest zbierany/łupiony';
      warn('orphan.unused', F.resources, r.id, `${kindPl(r)} ${resName(r.id)} ${how}, ale nic go nie zużywa (receptury, koszty budowli, infrastruktury, badań, Wielkich Dzieł) — ślepa uliczka.`,
        'Użyj go w koszcie lub recepturze albo usuń razem z jego źródłem.');
    }
  });

  // ================================================================ bosses and trophies
  group('boss', () => {
    const bosses = creatures.filter((c) => c.boss || c.behavior === 'boss');
    for (const b of biomes)
      if (!bosses.some((c) => c.biome === b.id))
        warn('boss.missing', F.creatures, b.id, `Biom „${b.id}” (${b.namePl}) nie ma bossa.`, "Każdy biom ma strażnika: dodaj stworzenie z behavior 'boss' i trofeum (tag trophy).");
    const trophyBoss = new Map<string, Creature>();
    for (const c of bosses) {
      const tr = arr(c.drops).filter((d) => isObj(d) && isTrophy(RES.get(d.id)));
      if (!tr.length)
        warn('boss.noTrophy', F.creatures, c.id, `Boss „${c.id}” (${c.namePl}) nie zostawia trofeum (łupu z tagiem trophy).`, `Dodaj trofeum w ${F.resources} (tag 'trophy') i do drops bossa.`);
      for (const d of tr) trophyBoss.set(d.id, c);
    }
    for (const r of resources) {
      if (!isTrophy(r)) continue;
      const boss = trophyBoss.get(r.id);
      if (!boss) {
        warn('boss.trophySource', F.resources, r.id, `Trofeum ${resName(r.id)} nie wypada z żadnego bossa.`, `Dodaj je do drops bossa w ${F.creatures} albo usuń tag trophy.`);
        continue;
      }
      const bt = biomeTier(boss.biome);
      const nodes = tech.filter((t) => arr(t.cost).some((s) => isObj(s) && s.id === r.id));
      if (bt === maxBiomeTier && !nodes.length) {
        skipped.push({ rule: 'boss.trophyTech', id: r.id, reason: `trofeum ostatniego bossa (${boss.namePl}) — po nim gra się kończy` });
        continue;
      }
      for (const t of nodes)
        if (isInt(t.tier) && t.tier < bt)
          err('boss.trophyTier', F.tech, t.id, `Węzeł ${techName(t.id)} (T${t.tier}) wymaga trofeum ${resName(r.id)} z bossa warstwy T${bt} — da się go zbadać dopiero w T${bt}.`,
            `Przenieś węzeł do T${bt + 1} albo wymagaj trofeum z T≤${t.tier}.`);
      if (nodes.length) continue;
      const other = usedBy.get(r.id) ?? [];
      const reveals = tech.filter((t) => arr(t.revealBy).includes(r.id)).map((t) => t.id);
      const revealNote = reveals.length ? ` Odsłania węzeł ${reveals.map(techName).join(', ')}, ale go nie zużywa.` : '';
      if (!other.length)
        err('boss.trophyTech', F.tech, r.id, `Trofeum ${resName(r.id, `boss ${boss.namePl}, T${bt}`)} nie jest kosztem żadnego węzła badań i niczemu nie służy — nagroda bez znaczenia.${revealNote}`,
          `Dodaj { id: '${r.id}', n: 1 } do kosztu (argument extra) kluczowego węzła T${bt + 1} w ${F.tech}.`);
      else
        warn('boss.trophyTech', F.tech, r.id, `Trofeum ${resName(r.id, `boss ${boss.namePl}, T${bt}`)} nie otwiera żadnego węzła badań — zużywa je tylko: ${other.join(', ')}.${revealNote} Zasada drzewka: trofeum bossa otwiera kluczowy węzeł.`,
          `Jeśli to celowe (np. trofeum idzie na finałowy klucz), zostaw; inaczej dodaj { id: '${r.id}', n: 1 } do kosztu węzła${reveals.length ? ` „${reveals[0]}”` : ''} w ${F.tech}.`);
    }
  });

  // ================================================================ consistency
  group('consistency', () => {
    for (const r of recipes) {
      const b = BLD.get(r.at);
      const lv = b && (r.level === 1 || r.level === 2 || r.level === 3) ? arr(b.levels)[r.level - 1] : undefined;
      if (lv && isNum(r.power) && r.power > 0) {
        const bp = isNum(lv.power) ? lv.power : 0;
        if (bp <= 0)
          warn('consistency.power', F.recipes, r.id, `Receptura pobiera moc ${r.power}, a ${bldName(r.at, r.level)} nie jest maszyną (brak poboru mocy).`,
            `Usuń power z receptury albo przenieś ją na poziom budowli z zasilaniem; zdecyduje systems-designer.`);
        else if (r.power > bp)
          warn('consistency.power', F.recipes, r.id, `Receptura wymaga mocy ${r.power}, a ${bldName(r.at, r.level)} pobiera ${bp}. Model balansu (src/balance/model.ts) liczy tylko moc budowli, więc różnica nie istnieje w bilansie energii.`,
            `Ujednolij: obniż power receptury do ${bp} albo podnieś pobór poziomu budowli (decyzja: systems-designer).`);
      }
      const outs = arr(r.outputs).filter(isObj).map((o) => o.id);
      if (RES.has(r.id) && !outs.includes(r.id))
        warn('consistency.recipeId', F.recipes, r.id, `Id receptury „${r.id}” to id surowca ${resName(r.id)}, a receptura wytwarza ${outs.map(resName).join(', ')}.`,
          'Zwykle to pomyłka przy kopiowaniu: id receptury = id wyniku, a wariant ma przyrostek (np. „glass_quartz”).');
      for (const i of arr(r.inputs))
        if (isObj(i) && outs.includes(i.id))
          warn('consistency.selfLoop', F.recipes, r.id, `Receptura zużywa ${resName(i.id)}, który sama wytwarza.`, 'Sprawdź wejścia i wyniki — pętla zjada własny produkt.');
    }
  });

  // ================================================================ progression (needs the analysis)
  const A = opts.analysis;
  if (A) {
    group('prog', () => {
      const at = (id: string) => A.res.get(id) ?? Infinity;
      const techTier = (id: string) => A.tech.get(id) ?? Infinity;
      const unlockTier = (key: string, isStart: boolean) => {
        if (isStart) return 0;
        const by = unlockers.get(key) ?? [];
        return by.length ? Math.min(...by.map((t) => TEC.get(t)?.tier ?? Infinity)) : Infinity;
      };
      const pickAt = (p: number) => {
        if (p <= 0) return 0;
        let best = Infinity;
        for (const r of resources) if (r.slot === 'pick' && (r.stats?.pickTier ?? 0) >= p) best = Math.min(best, at(r.id));
        return best;
      };
      /** Cheapest known way to obtain a resource, for messages. */
      const routes = (id: string): { tier: number; label: string }[] => {
        const out: { tier: number; label: string }[] = [];
        for (const d of deposits)
          if (d.yields === id) {
            const bt = Math.min(...arr(d.biomes).map(biomeTier));
            out.push({ tier: Math.max(bt, pickAt(d.pickTier)), label: `złoże ${d.id} (biom ${tierLabel(bt)}, kilof ${d.pickTier} od ${tierLabel(pickAt(d.pickTier))})` });
          }
        for (const rid of produced.get(id) ?? []) {
          const r = REC.get(rid)!;
          out.push({ tier: A.recipe.get(rid) ?? Infinity, label: `receptura ${rid} w ${bldName(r.at, r.level)}` });
        }
        for (const sid of dropSources.get(id) ?? []) {
          const o = wobjects.find((x) => x.id === sid);
          const c = creatures.find((x) => x.id === sid);
          const t = o ? Math.min(...arr(o.biomes).map(biomeTier)) : c ? biomeTier(c.biome) : Infinity;
          out.push({ tier: t, label: `${o ? 'obiekt' : 'stworzenie'} ${sid}` });
        }
        return out.sort((a, b) => a.tier - b.tier);
      };
      const routeText = (id: string) => {
        const r = routes(id);
        return r.length ? `najwcześniej: ${r[0]!.label}, ${tierLabel(r[0]!.tier)}` : 'brak źródła';
      };
      for (const r of resources) {
        const a = at(r.id);
        if (!Number.isFinite(a)) {
          err('prog.never', F.resources, r.id, `${kindPl(r)} ${resName(r.id)} nie jest osiągalny w żadnej warstwie (${routes(r.id).map((x) => `${x.label}: ${tierLabel(x.tier)}`).join('; ') || 'brak źródła'}).`,
            `Sprawdź łańcuch zależności w przeglądarce treści (tools.html#resource:${r.id}): receptury, poziomy budowli i węzły badań, od których zależy.`);
          continue;
        }
        if (!isInt(r.tier)) continue;
        if (a > r.tier)
          err('prog.resource', F.resources, r.id, `${kindPl(r)} ${resName(r.id)} zadeklarowany w T${r.tier}, ale dostępny dopiero od ${tierName(a)} — ${routeText(r.id)}.`,
            `Ustaw tier: ${a} albo udostępnij wcześniej to, czego brakuje w łańcuchu.`);
        else if (a < r.tier)
          warn('prog.resourceEarly', F.resources, r.id, `${kindPl(r)} ${resName(r.id)} zadeklarowany w T${r.tier}, a dostępny już od ${tierName(a)} — ${routeText(r.id)}.`,
            `Ustaw tier: ${a} w ${F.resources} albo zaostrz wymagania, jeśli ma przyjść później.`);
      }
      for (const t of tech) {
        const a = techTier(t.id);
        if (a === t.tier) continue;
        const why = [
          ...arr(t.cost).filter((s) => isObj(s) && at(s.id) > t.tier).map((s) => `koszt ${s.id} od ${tierLabel(at(s.id))}`),
          ...arr(t.requires).filter((q) => techTier(q) > t.tier).map((q) => `wymaga ${q} od ${tierLabel(techTier(q))}`),
        ];
        err('prog.tech', F.tech, t.id, `Węzeł ${techName(t.id)} (T${t.tier}) da się zbadać dopiero ${Number.isFinite(a) ? `w T${a}` : 'nigdy'}: ${why.join('; ') || 'nieznana przyczyna'}.`,
          Number.isFinite(a) ? `Obniż koszt lub wymagania albo przenieś węzeł do T${a}.` : 'Usuń nieosiągalny składnik kosztu lub wymaganie.');
      }
      for (const b of buildings)
        arr(b.levels).forEach((lv, k) => {
          const key = `${b.id}:${k + 1}`;
          const a = A.building.get(key) ?? Infinity;
          const ut = unlockTier(`building:${key}`, startB.has(key));
          if (!Number.isFinite(a)) {
            const why = isObj(lv) ? arr(lv.cost).filter((s) => isObj(s) && !Number.isFinite(at(s.id))).map((s) => s.id) : [];
            err('prog.building', F.buildings, key, `Poziom ${k + 1} budowli ${bldName(b.id, k + 1)} nigdy nie da się zbudować${why.length ? ` (nieosiągalne: ${why.join(', ')})` : ''}.`,
              'Sprawdź koszt, odblokowanie i poprzedni poziom.');
          } else if (Number.isFinite(ut) && a > ut) {
            const why = isObj(lv) ? arr(lv.cost).filter((s) => isObj(s) && at(s.id) > ut).map((s) => `${s.id} od ${tierLabel(at(s.id))}`) : [];
            warn('prog.building', F.buildings, key, `Poziom ${k + 1} budowli ${bldName(b.id, k + 1)} jest odblokowany w T${ut}, ale zbudować go można dopiero od T${a}${why.length ? ` (${why.join(', ')})` : ' (poprzedni poziom)'} — gracz zbada coś, czego nie postawi.`,
              'Przenieś odblokowanie do późniejszego węzła albo zmień koszt na surowce z warstwy odblokowania.');
          }
        });
      for (const i of infra) {
        const a = A.infra.get(i.id) ?? Infinity;
        if (isInt(i.tier) && a > i.tier)
          err('prog.infra', F.infrastructure, i.id, `Infrastruktura „${i.id}” zadeklarowana w T${i.tier}, ale dostępna dopiero ${Number.isFinite(a) ? `od T${a}` : 'nigdy'}.`,
            Number.isFinite(a) ? `Ustaw tier: ${a} albo obniż koszt/odblokowanie.` : 'Sprawdź koszt i odblokowanie.');
      }
      const packOut = (r: Recipe) => arr(r.outputs).some((o) => isObj(o) && researchPacks.includes(o.id));
      for (const r of recipes) {
        const a = A.recipe.get(r.id) ?? Infinity;
        const ut = unlockTier(`recipe:${r.id}`, startR.has(r.id));
        if (!Number.isFinite(ut) || !(a > ut)) continue;
        if (packOut(r) && a === ut + 1) {
          skipped.push({ rule: 'prog.recipeLate', id: r.id, reason: 'paczka badań: z założenia wymaga próbek z następnego biomu' });
          continue;
        }
        const why = [
          ...arr(r.inputs).filter((s) => isObj(s) && at(s.id) > ut).map((s) => `${s.id} od ${tierLabel(at(s.id))}`),
          ...((A.building.get(`${r.at}:${r.level}`) ?? Infinity) > ut ? [`budowla ${r.at}:${r.level} od ${tierLabel(A.building.get(`${r.at}:${r.level}`) ?? Infinity)}`] : []),
        ];
        warn('prog.recipeLate', F.recipes, r.id, `Receptura „${r.id}” jest odblokowana w T${ut}, ale wykonać ją można dopiero ${Number.isFinite(a) ? `od T${a}` : 'nigdy'} (${why.join(', ') || 'zależności'}).`,
          'Przenieś odblokowanie do węzła z warstwy, w której są wejścia, albo zmień wejścia.');
      }
      const unlocksPack = (t: TechNode) => arr(isObj(t.unlocks) ? t.unlocks.recipes : []).some((rid) => {
        const r = REC.get(rid);
        return !!r && packOut(r);
      });
      for (const t of tech) {
        const rev = arr(t.revealBy);
        if (!rev.length || !isInt(t.tier)) continue;
        const rt = Math.min(...rev.map(at));
        if (!Number.isFinite(rt))
          err('prog.reveal', F.tech, t.id, `Węzeł ${techName(t.id)} nigdy się nie odsłoni — żadnego z revealBy (${rev.join(', ')}) nie da się zdobyć.`, 'Wskaż w revealBy surowiec osiągalny w warstwie węzła.');
        else if (rt > t.tier) {
          if (unlocksPack(t) && rt === t.tier + 1) {
            skipped.push({ rule: 'prog.reveal', id: t.id, reason: 'węzeł paczki badań odsłaniają próbki następnego biomu (z założenia)' });
            continue;
          }
          warn('prog.reveal', F.tech, t.id, `Węzeł ${techName(t.id)} z T${t.tier} odsłania się dopiero dzięki surowcom z ${tierName(rt)}: ${rev.map((x) => `${x} od ${tierLabel(at(x))}`).join(', ')} — gracz zobaczy go dopiero tam, choć zbadać mógłby już w T${t.tier}.`,
            `Jeśli to celowe (najpierw zagrożenie, potem ochrona), zostaw; inaczej dodaj do revealBy surowiec dostępny w T${t.tier}.`);
        }
      }
      researchPacks.forEach((p, i) => {
        if (RES.has(p) && at(p) !== i)
          err('prog.pack', F.tech, 'RESEARCH_PACKS', `Paczka badań warstwy T${i} ${resName(p)} jest dostępna ${Number.isFinite(at(p)) ? `w T${at(p)}` : 'nigdy'} — każda paczka musi powstać dokładnie w swojej warstwie.`,
            'Popraw recepturę paczki (wejścia z warstwy T' + i + ') albo kolejność RESEARCH_PACKS.');
      });
      for (const b of biomes)
        for (const h of arr(b.hazards)) {
          const hz = HAZ.get(h);
          if (!hz) continue;
          const best = Math.min(...arr(hz.counters).map((c) => (RES.has(c) ? at(c) : INF.has(c) ? (A.infra.get(c) ?? Infinity) : (A.building.get(`${c}:1`) ?? Infinity))), Infinity);
          if (best > b.tier)
            err('prog.hazard', F.hazards, h, `Biom „${b.id}” (T${b.tier}) niesie zagrożenie „${h}”, a pierwsza ochrona (${arr(hz.counters).join(', ')}) jest dostępna ${Number.isFinite(best) ? `od T${best}` : 'nigdy'}.`,
              `Udostępnij ochronę najpóźniej w T${b.tier} albo dodaj do counters coś z tej warstwy.`);
        }
      for (const x of startDiscovered)
        if (RES.has(x) && at(x) > 0)
          warn('prog.start', F.resources, 'START_DISCOVERED', `START_DISCOVERED: ${resName(x)} jest znany od startu, ale zdobyć go można dopiero od ${tierName(at(x))}.`, 'Usuń go z listy albo udostępnij w T0.');
    });
  }

  for (const [name, fn] of groups) {
    try {
      fn();
    } catch (e) {
      err('internal', 'src/tools/contentCheck.ts', name, `Reguły „${name}.*” przerwały działanie: ${msgOf(e)}. Pozostałe grupy sprawdzono.`,
        'Najpewniej w danych brakuje pola albo ma zły typ (np. tekst zamiast liczby). Popraw dane; jeśli nie wiesz które — przekaż ten komunikat tools-programmerowi.');
    }
  }

  const sev = (s: Severity) => (s === 'error' ? 0 : 1);
  issues.sort((a, b) => sev(a.severity) - sev(b.severity) || a.file.localeCompare(b.file) || a.rule.localeCompare(b.rule) || a.id.localeCompare(b.id));
  return {
    issues,
    skipped,
    counts: {
      resources: resources.length, deposits: deposits.length, objects: wobjects.length, creatures: creatures.length,
      buildings: buildings.length, buildingLevels: buildings.reduce((n, b) => n + arr(b.levels).length, 0), infrastructure: infra.length,
      recipes: recipes.length, tech: tech.length, biomes: biomes.length, hazards: hazards.length, greatWorks: greatWorks.length, materials: materials.length,
    },
  };
}

// ------------------------------------------------------------------ reporting

/**
 * Line of the definition of `id` in a source file (1-based), or undefined.
 * Prefers `id: 'x'`, then a definition helper call `make('x'`/`node('x'`/…,
 * then a material `M.X, 'x'`, then any quoted occurrence. Building levels
 * (`hearth:2`) resolve to the n-th `L(` line after the building.
 */
export function locateLine(source: string, id: string): number | undefined {
  const lines = source.split('\n');
  const [base, lvl] = id.split(':');
  const q = (base ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!q) return undefined;
  const patterns = [
    new RegExp(`\\bid:\\s*'${q}'`),
    new RegExp(`\\b(?!(?:s|d|B)\\()\\w+\\(\\s*'${q}'`),
    new RegExp(`M\\.\\w+,\\s*'${q}'`),
    new RegExp(`\\b${q}\\b\\s*[:=]`),
    new RegExp(`'${q}'`),
  ];
  for (const re of patterns) {
    const i = lines.findIndex((l) => re.test(l));
    if (i < 0) continue;
    const level = Number(lvl);
    if (Number.isInteger(level) && level >= 1) {
      let seen = 0;
      for (let j = i; j < lines.length; j++) if (/\bL\(/.test(lines[j]!) && ++seen === level) return j + 1;
    }
    return i + 1;
  }
  return undefined;
}

export interface FormatOptions {
  color?: boolean;
  /** Resolves a 1-based line for an issue (the CLI reads the file). */
  line?: (issue: Issue) => number | undefined;
  verbose?: boolean;
  skipped?: Skip[];
  /** Footer extras, e.g. timing. */
  footer?: string;
}

const C = { red: '\x1b[31m', yellow: '\x1b[33m', dim: '\x1b[2m', bold: '\x1b[1m', reset: '\x1b[0m' };

export function formatIssue(i: Issue, o: FormatOptions = {}): string {
  const paint = (code: string, s: string) => (o.color ? `${code}${s}${C.reset}` : s);
  const tag = i.severity === 'error' ? paint(C.red + C.bold, 'BŁĄD       ') : paint(C.yellow + C.bold, 'OSTRZEŻENIE');
  const ln = o.line?.(i);
  const where = `${i.file}${ln ? `:${ln}` : ''}`;
  return `${tag}  ${where}  ${paint(C.bold, i.id)}  ${paint(C.dim, `[${i.rule}]`)}\n    ${i.message}\n    ${paint(C.dim, 'Jak naprawić:')} ${i.fix}`;
}

export function summarize(r: CheckResult): { errors: number; warnings: number; line: string } {
  const errors = r.issues.filter((i) => i.severity === 'error').length;
  const warnings = r.issues.length - errors;
  const line = `${errors} ${plural(errors, 'błąd', 'błędy', 'błędów')}, ${warnings} ${plural(warnings, 'ostrzeżenie', 'ostrzeżenia', 'ostrzeżeń')}`;
  return { errors, warnings, line };
}

export function formatReport(r: CheckResult, o: FormatOptions = {}): string {
  const out: string[] = [];
  for (const i of r.issues) out.push(formatIssue(i, o), '');
  const s = summarize(r);
  const c = r.counts;
  const n = (k: string, one: string, few: string, many: string) => `${c[k] ?? 0} ${plural(c[k] ?? 0, one, few, many)}`;
  out.push(
    `Podsumowanie: ${s.line}.`,
    `Sprawdzono: ${n('resources', 'surowiec/przedmiot', 'surowce i przedmioty', 'surowców i przedmiotów')}, ${n('deposits', 'złoże', 'złoża', 'złóż')}, ` +
      `${n('buildings', 'budowlę', 'budowle', 'budowli')} (${n('buildingLevels', 'poziom', 'poziomy', 'poziomów')}), ${n('infrastructure', 'element', 'elementy', 'elementów')} infrastruktury, ` +
      `${n('recipes', 'recepturę', 'receptury', 'receptur')}, ${n('tech', 'węzeł', 'węzły', 'węzłów')} badań, ${n('biomes', 'biom', 'biomy', 'biomów')}, ` +
      `${n('creatures', 'stworzenie', 'stworzenia', 'stworzeń')}, ${n('objects', 'obiekt', 'obiekty', 'obiektów')}, ${n('greatWorks', 'Wielkie Dzieło', 'Wielkie Dzieła', 'Wielkich Dzieł')}, ` +
      `${n('materials', 'materiał', 'materiały', 'materiałów')} świata.`,
  );
  const sk = o.skipped ?? r.skipped;
  if (sk.length) {
    if (o.verbose) {
      out.push(`Celowe wyjątki (${sk.length}):`);
      for (const x of sk) out.push(`  - ${x.id} [${x.rule}]: ${x.reason}`);
    } else out.push(`Celowe wyjątki: ${sk.length} (lista: --verbose).`);
  }
  if (o.footer) out.push(o.footer);
  return out.join('\n');
}

/** Turns a crash while loading the data into a designer-readable explanation. */
export function explainLoadError(e: unknown): { message: string; fix: string } {
  const m = msgOf(e);
  let x = /material (\w+): unknown deposit (\w+)/.exec(m);
  if (x)
    return {
      message: `Materiał świata „${x[1]}” (src/world/materials.ts) wskazuje złoże „${x[2]}”, którego nie ma w src/content/sources.ts — dane nie wczytały się.`,
      fix: `Popraw id złoża w materials.ts albo przywróć złoże „${x[2]}” w sources.ts (zmiana id złoża wymaga zmiany w obu plikach).`,
    };
  x = /biome (\w+): unknown rock (\w+)/.exec(m);
  if (x) return { message: `Biom „${x[1]}” wskazuje skałę „${x[2]}”, której nie ma wśród materiałów świata.`, fix: 'Popraw Biome.rocks w src/content/biomes.ts albo dodaj materiał w src/world/materials.ts.' };
  const stack = e instanceof Error ? (e.stack ?? '') : '';
  const loc = /((?:src|tests)\/[\w/.-]+\.tsx?):(\d+)/.exec(stack) ?? /((?:src|tests)\/[\w/.-]+\.tsx?)/.exec(m);
  const where = loc ? ` (${loc[1]}${loc[2] ? `:${loc[2]}` : ''})` : '';
  if (e instanceof SyntaxError || /SyntaxError|Unexpected token|Expected/.test(m))
    return { message: `Błąd składni w danych${where}: ${m}`, fix: 'Sprawdź przecinki, nawiasy i cudzysłowy w okolicy wskazanej linii; `npm run build` pokaże dokładne miejsce.' };
  if (/Cannot find module|ERR_MODULE_NOT_FOUND|Failed to load url/.test(m))
    return { message: `Nie znaleziono modułu${where}: ${m}`, fix: 'Sprawdź ścieżki importów (zmieniona nazwa pliku?).' };
  return { message: `Nie udało się wczytać treści${where}: ${m}`, fix: 'Uruchom `npm run build`, żeby zobaczyć błąd typów lub składni; jeśli to nie pomoże — przekaż komunikat tools-programmerowi.' };
}
