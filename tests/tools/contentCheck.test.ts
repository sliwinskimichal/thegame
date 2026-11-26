/**
 * Content validator: zero errors on the real data, and on deliberately broken
 * copies the right rule fires with a message that says what, where and how to fix.
 * Also the CLI (in-process with injected I/O, and end-to-end through node).
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analyze } from '../../src/content/analysis';
import { realBundle } from '../../src/tools/contentBundle';
import {
  checkContent,
  explainLoadError,
  formatIssue,
  formatReport,
  locateLine,
  plural,
  RULES,
  suggest,
  type CheckResult,
  type ContentBundle,
  type Issue,
} from '../../src/tools/contentCheck';
import { parseArgs, runContentCheck, type CliIO } from '../../src/tools/contentCheckCli';

const ROOT = resolve(__dirname, '../..');
const A = analyze();

type Draft<T> = { -readonly [K in keyof T]: Draft<T[K]> };
const draft = (): Draft<ContentBundle> => structuredClone(realBundle()) as Draft<ContentBundle>;

function run(b: Draft<ContentBundle> | ContentBundle, withAnalysis = false): CheckResult {
  const r = checkContent(b as ContentBundle, withAnalysis ? { analysis: A } : {});
  for (const i of r.issues) {
    expect(RULES, `rule ${i.rule} is registered`).toHaveProperty([i.rule]);
    expect(i.message.length, `${i.rule} ${i.id} has a message`).toBeGreaterThan(10);
    expect(i.fix.length, `${i.rule} ${i.id} says how to fix`).toBeGreaterThan(5);
    expect(i.file).toMatch(/^src\//);
  }
  return r;
}
const pick = (r: CheckResult, rule: string, id?: string): Issue[] => r.issues.filter((i) => i.rule === rule && (id === undefined || i.id === id));
function one(r: CheckResult, rule: string, id: string): Issue {
  const hits = pick(r, rule, id);
  expect(hits, `${rule} for ${id}; got:\n${r.issues.map((i) => `${i.rule} ${i.id}`).join('\n')}`).toHaveLength(1);
  return hits[0]!;
}
const errorsOf = (r: CheckResult) => r.issues.filter((i) => i.severity === 'error');

describe('content check: the real data', () => {
  const r = run(realBundle(), true);

  it('has no errors', () => {
    const e = errorsOf(r);
    expect(e, e.map((i) => formatIssue(i)).join('\n')).toEqual([]);
  });

  it('checks every collection', () => {
    expect(r.counts.resources).toBeGreaterThan(200);
    expect(r.counts.buildingLevels).toBe(r.counts.buildings! * 3);
    expect(r.counts.materials).toBeGreaterThan(40);
  });

  it('lists the deliberate exceptions instead of hiding them', () => {
    expect(r.skipped).toContainEqual(expect.objectContaining({ rule: 'boss.trophyTech', id: 'eater_shard' }));
    expect(r.skipped).toContainEqual(expect.objectContaining({ rule: 'orphan.unused', id: 'heart_key' }));
    expect(r.skipped.filter((s) => s.rule === 'prog.recipeLate').length).toBeGreaterThanOrEqual(7);
  });

  it('is fast enough to run on every save', () => {
    const t0 = performance.now();
    checkContent(realBundle(), { analysis: A });
    expect(performance.now() - t0).toBeLessThan(500);
  });
});

describe('content check: ids', () => {
  it('reports a duplicated id with both positions', () => {
    const b = draft();
    b.resources.push({ ...b.resources.find((x) => x.id === 'copper_bar')! });
    const i = one(run(b), 'id.duplicate', 'copper_bar');
    expect(i.severity).toBe('error');
    expect(i.file).toBe('src/content/resources.ts');
    expect(i.message).toMatch(/„copper_bar” występuje 2×/);
    expect(i.fix).toMatch(/unikalne id|usuń duplikat/);
  });

  it('rejects ids outside snake_case and proposes one', () => {
    const b = draft();
    b.resources.push({ ...b.resources.find((x) => x.id === 'copper_bar')!, id: 'Copper-Bar' });
    const i = one(run(b), 'id.format', 'Copper-Bar');
    expect(i.fix).toContain('„copper_bar”');
  });

  it('rejects one id shared by a resource and a building', () => {
    const b = draft();
    b.infrastructure.push({ ...b.infrastructure[0]!, id: 'hearth' });
    expect(one(run(b), 'id.collision', 'hearth').message).toMatch(/budowla, infrastruktura/);
  });
});

describe('content check: references', () => {
  it('names the missing resource and suggests the closest id', () => {
    const b = draft();
    b.recipes.find((x) => x.id === 'bronze_bar')!.inputs[0]!.id = 'copper_barr';
    const i = one(run(b), 'ref.resource', 'bronze_bar');
    expect(i.severity).toBe('error');
    expect(i.file).toBe('src/content/recipes.ts');
    expect(i.message).toContain('Wejście receptury: surowiec „copper_barr” nie istnieje');
    expect(i.fix).toContain('Czy chodziło o „copper_bar”');
  });

  it('catches a recipe at a building that does not exist', () => {
    const b = draft();
    b.recipes.find((x) => x.id === 'iron_bar')!.at = 'smeltery';
    expect(one(run(b), 'ref.building', 'iron_bar').fix).toContain('„smelter”');
  });

  it('checks research prerequisites, unlocked recipes and building levels', () => {
    const b = draft();
    const t = b.tech.find((x) => x.id === 'lanterns')!;
    t.requires = ['smithingg'];
    t.unlocks.recipes = ['hand_lanternn'];
    t.unlocks.buildings = [['forge', 4 as 3]];
    const r = run(b);
    expect(one(r, 'ref.tech', 'lanterns').fix).toContain('„smithing”');
    expect(one(r, 'ref.recipe', 'lanterns').fix).toContain('„hand_lantern”');
    expect(one(r, 'ref.building', 'lanterns').message).toContain('poziom 4');
  });

  it('checks deposit biomes and yields', () => {
    const b = draft();
    const d = b.deposits.find((x) => x.id === 'iron_vein')!;
    d.biomes = ['granit', 'fungal'] as never;
    const r = run(b);
    expect(one(r, 'ref.biome', 'iron_vein').fix).toContain('„granite”');
    const b2 = draft();
    b2.deposits.find((x) => x.id === 'iron_vein')!.yields = 'iron_bar';
    expect(one(run(b2), 'ref.kind', 'iron_vein').message).toMatch(/rodzaju „material”/);
  });

  it('checks hazard counters and creature drops', () => {
    const b = draft();
    b.hazards.find((x) => x.id === 'spores')!.counters = ['filter_maskk'];
    b.creatures.find((x) => x.id === 'wolf')!.drops[0]!.id = 'raw_meet';
    const r = run(b);
    expect(one(r, 'ref.resource', 'spores').fix).toContain('„filter_mask”');
    expect(one(r, 'ref.resource', 'wolf').fix).toContain('„raw_meat”');
  });
});

describe('content check: world materials', () => {
  it('finds a deposit without a world material', () => {
    const b = draft();
    b.materials = b.materials.filter((m) => m.deposit !== 'tin_vein');
    const i = one(run(b), 'world.depositMaterial', 'tin_vein');
    expect(i.severity).toBe('error');
    expect(i.file).toBe('src/world/materials.ts');
    expect(i.message).toContain('generator nie umieści go w skale');
    expect(i.fix).toContain("D(M.NOWY, 'kluczCamelCase', 'tin_vein'");
  });

  it('finds a material that points to a missing deposit (and the deposit left without one)', () => {
    const b = draft();
    b.materials.find((m) => m.key === 'tin')!.deposit = 'tin_vien';
    const r = run(b);
    expect(one(r, 'world.materialDeposit', 'tin').fix).toContain('„tin_vein”');
    one(r, 'world.depositMaterial', 'tin_vein');
  });

  it('finds a biome rock without a material and a hardness mismatch', () => {
    const b = draft();
    b.biomes.find((x) => x.id === 'granite')!.rocks = ['granit', 'slate'];
    b.materials.find((m) => m.key === 'copper')!.hardness = 9;
    const r = run(b);
    const i = one(r, 'world.biomeRock', 'granite');
    expect(i.message).toContain('„granit”');
    expect(i.fix).toContain('„granite”');
    expect(one(r, 'world.mismatch', 'copper').message).toMatch(/twardość 9 .* 2\.8/);
  });

  it('keeps material ids dense', () => {
    const b = draft();
    b.materials[5]!.id = 50;
    expect(one(run(b), 'world.denseIds', b.materials[5]!.key).message).toContain('pozycji 5');
  });
});

describe('content check: value ranges', () => {
  it('rejects non-positive hardness and pick tiers outside 0–5 (materials: 0–5 or 9)', () => {
    const b = draft();
    b.deposits.find((x) => x.id === 'coal_seam')!.hardness = 0;
    b.deposits.find((x) => x.id === 'tin_vein')!.pickTier = 7;
    b.materials.find((m) => m.key === 'granite')!.tier = 7;
    const r = run(b);
    expect(one(r, 'range.hardness', 'coal_seam').message).toContain('musi być liczbą > 0');
    expect(one(r, 'range.pickTier', 'tin_vein').message).toContain('0–5');
    expect(one(r, 'range.pickTier', 'granite').message).toContain('albo 9');
    expect(pick(r, 'range.pickTier', 'bedrock')).toEqual([]); // tier 9 = never minable, allowed
  });

  it('demands exactly three building levels', () => {
    const b = draft();
    b.buildings.find((x) => x.id === 'storehouse')!.levels.pop();
    const i = one(run(b), 'range.levels', 'storehouse');
    expect(i.message).toContain('ma 2 poziomy');
    expect(i.message).toContain('dokładnie 3');
  });

  it('demands positive integer costs', () => {
    const b = draft();
    b.buildings.find((x) => x.id === 'kiln')!.levels[1]!.cost[0]!.n = 0;
    b.infrastructure.find((x) => x.id === 'ladder')!.cost[0]!.n = 1.5;
    b.tech.find((x) => x.id === 'campcraft')!.cost[0]!.n = -3;
    const r = run(b);
    expect(one(r, 'range.cost', 'kiln:2').message).toMatch(/ilość 0 × „brick”/);
    one(r, 'range.cost', 'ladder');
    one(r, 'range.cost', 'campcraft');
  });

  it('checks drops, resistances, pick stats and zero stats', () => {
    const b = draft();
    b.creatures.find((x) => x.id === 'wolf')!.drops.find((d) => d.id === 'fang')!.chance = 1.5;
    b.resources.find((x) => x.id === 'filter_mask')!.stats!.gasRes = 1.2;
    b.resources.find((x) => x.id === 'steel_pick')!.stats!.pickTier = 6;
    b.resources.find((x) => x.id === 'bronze_helm')!.stats!.armor = 0;
    const r = run(b);
    expect(one(r, 'range.drop', 'wolf').message).toContain('szansa 1.5');
    expect(one(r, 'range.value', 'filter_mask').message).toContain('0–1');
    expect(one(r, 'range.pickTier', 'steel_pick').message).toContain('1–5');
    const z = one(r, 'range.zeroStat', 'bronze_helm');
    expect(z.severity).toBe('warning');
    expect(z.fix).toContain('Usuń pole armor');
  });
});

describe('content check: coverage, orphans, trophies', () => {
  it('finds a recipe that nothing unlocks, and one unlocked twice', () => {
    const b = draft();
    const ts = b.tech.find((x) => x.id === 'tin_smelting')!;
    ts.unlocks.recipes = [];
    const r = run(b);
    const i = one(r, 'unlock.missing', 'tin_bar');
    expect(i.message).toContain('gracz nigdy jej nie zobaczy');
    expect(i.fix).toContain('unlocks.recipes');
    const b2 = draft();
    b2.tech.find((x) => x.id === 'coal_working')!.unlocks.recipes!.push('tin_bar');
    expect(one(run(b2), 'unlock.duplicate', 'tin_bar').message).toMatch(/2×.*tin_smelting.*coal_working|2×.*coal_working.*tin_smelting/);
  });

  it('finds cycles and later-tier prerequisites in the research tree', () => {
    const b = draft();
    b.tech.find((x) => x.id === 'campcraft')!.requires = ['hunting'];
    const r = run(b);
    const c = one(r, 'tech.cycle', 'campcraft');
    expect(c.message).toMatch(/campcraft → hunting → campcraft|hunting → campcraft → hunting/);
    const b2 = draft();
    b2.tech.find((x) => x.id === 'campcraft')!.requires = ['blast_furnace'];
    expect(one(run(b2), 'tech.order', 'campcraft').message).toContain('z późniejszej warstwy T2');
  });

  it('finds an item without a recipe', () => {
    const b = draft();
    b.resources.push({ ...b.resources.find((x) => x.id === 'bronze_helm')!, id: 'mithril_crown' });
    expect(one(run(b), 'source.missing', 'mithril_crown').fix).toContain("make('mithril_crown'");
  });

  it('warns about crafted materials nobody uses', () => {
    const b = draft();
    b.resources.push({ ...b.resources.find((x) => x.id === 'tin_bar')!, id: 'slag', namePl: 'Żużel', nameEn: 'Slag' });
    b.recipes.push({ id: 'slag', at: 'smelter', level: 1, inputs: [{ id: 'stone', n: 2 }], outputs: [{ id: 'slag', n: 1 }], time: 10 });
    b.startRecipes.push('slag');
    const i = one(run(b), 'orphan.unused', 'slag');
    expect(i.severity).toBe('warning');
    expect(i.message).toContain('jest wytwarzany (slag)');
    expect(i.message).toContain('ślepa uliczka');
  });

  it('flags a boss trophy that opens no research node', () => {
    const b = draft();
    const n = b.tech.find((x) => x.id === 'stone_hearth')!;
    n.cost = n.cost.filter((s) => s.id !== 'alpha_pelt');
    const i = one(run(b), 'boss.trophyTech', 'alpha_pelt');
    expect(i.severity).toBe('error'); // used nowhere else either
    expect(i.message).toContain('boss Wilczy Herszt, T0');
    expect(i.fix).toContain("{ id: 'alpha_pelt', n: 1 }");
    // used by a recipe only: a warning that names the recipe
    b.recipes.find((x) => x.id === 'wooden_shield')!.inputs.push({ id: 'alpha_pelt', n: 1 });
    const w = one(run(b), 'boss.trophyTech', 'alpha_pelt');
    expect(w.severity).toBe('warning');
    expect(w.message).toContain('receptura wooden_shield');
  });

  it('flags a node that needs a trophy from a deeper biome', () => {
    const b = draft();
    b.tech.find((x) => x.id === 'smithy')!.cost.push({ id: 'colossus_core', n: 1 });
    expect(one(run(b), 'boss.trophyTier', 'smithy').message).toContain('dopiero w T5');
  });

  it('warns about a biome without a boss', () => {
    const b = draft();
    b.creatures = b.creatures.filter((c) => c.id !== 'web_queen');
    expect(one(run(b), 'boss.missing', 'fungal').fix).toContain("behavior 'boss'");
  });

  it('warns when a recipe id is another resource’s id', () => {
    const b = draft();
    b.recipes.find((x) => x.id === 'gear_iron')!.id = 'bone';
    expect(one(run(b), 'consistency.recipeId', 'bone').message).toContain('wytwarza „gear”');
  });
});

describe('content check: progression (with the analysis)', () => {
  it('reports a resource declared earlier than it can be obtained', () => {
    const b = draft();
    b.resources.find((x) => x.id === 'iron_bar')!.tier = 1;
    const i = one(run(b, true), 'prog.resource', 'iron_bar');
    expect(i.severity).toBe('error');
    expect(i.message).toMatch(/zadeklarowany w T1, ale dostępny dopiero od T2/);
    expect(i.message).toContain('receptura iron_bar');
  });

  it('warns about a resource declared later than it can be obtained', () => {
    const b = draft();
    b.resources.find((x) => x.id === 'copper_bar')!.tier = 3;
    const i = one(run(b, true), 'prog.resourceEarly', 'copper_bar');
    expect(i.severity).toBe('warning');
    expect(i.fix).toContain('Ustaw tier: 0');
  });

  it('reports a node researchable only in a later tier, with the culprit', () => {
    const b = draft();
    b.tech.find((x) => x.id === 'smithy')!.tier = 1;
    const i = one(run(b, true), 'prog.tech', 'smithy');
    expect(i.message).toMatch(/\(T1\) da się zbadać dopiero w T2/);
  });

  it('skips the progression rules without an analysis', () => {
    const b = draft();
    b.resources.find((x) => x.id === 'iron_bar')!.tier = 1;
    expect(pick(run(b), 'prog.resource')).toEqual([]);
  });
});

describe('content check: robustness', () => {
  it('survives garbage entries and a rule that crashes, and still runs the other rules', () => {
    const b = draft();
    (b.resources as unknown[]).push(null);
    Object.defineProperty(b.resources.find((x) => x && x.id === 'flint_pick')!, 'kind', {
      get() {
        throw new Error('boom');
      },
    });
    b.recipes.find((x) => x.id === 'bronze_bar')!.inputs[0]!.id = 'copper_barr';
    let r: CheckResult | undefined;
    expect(() => (r = run(b))).not.toThrow();
    expect(pick(r!, 'internal').some((i) => i.message.includes('nie jest obiektem'))).toBe(true);
    expect(pick(r!, 'internal').some((i) => /Reguły „\w+\.\*” przerwały działanie: boom/.test(i.message))).toBe(true);
    one(r!, 'ref.resource', 'bronze_bar');
  });

  it('suggests close ids and pluralizes in Polish', () => {
    expect(suggest('copper_barr', ['copper_bar', 'tin_bar', 'copper_ore'])[0]).toBe('copper_bar');
    expect(suggest('zzzz', ['copper_bar'])).toEqual([]);
    expect([1, 2, 5, 12, 22, 25].map((n) => plural(n, 'błąd', 'błędy', 'błędów'))).toEqual(['błąd', 'błędy', 'błędów', 'błędów', 'błędy', 'błędów']);
  });
});

describe('content check: reporting', () => {
  const src = (p: string) => readFileSync(resolve(ROOT, p), 'utf8');

  it('locates definitions in the data files', () => {
    const at = (p: string, id: string) => src(p).split('\n')[locateLine(src(p), id)! - 1]!;
    expect(at('src/content/recipes.ts', 'bronze_bar')).toContain("make('bronze_bar'");
    expect(at('src/content/recipes.ts', 'START_RECIPES')).toContain('export const START_RECIPES');
    expect(at('src/content/buildings.ts', 'hearth:2')).toContain('Kamienne Palenisko');
    expect(at('src/content/tech.ts', 'gas_masks')).toContain("node('gas_masks'");
    expect(at('src/content/sources.ts', 'iron_vein')).toContain("id: 'iron_vein'");
    expect(at('src/world/materials.ts', 'shellLimestone')).toContain("'shellLimestone'");
    expect(locateLine(src('src/content/recipes.ts'), 'no_such_id')).toBeUndefined();
  });

  it('formats issues with level, file:line, id, rule and the fix', () => {
    const b = draft();
    b.recipes.find((x) => x.id === 'bronze_bar')!.inputs[0]!.id = 'copper_barr';
    const r = run(b);
    const txt = formatReport(r, { line: () => 54 });
    expect(txt).toMatch(/BŁĄD\s+src\/content\/recipes\.ts:54\s+bronze_bar\s+\[ref\.resource\]/);
    expect(txt).toContain('Jak naprawić: Popraw id. Czy chodziło o „copper_bar”?');
    expect(txt).toMatch(/Podsumowanie: 1 błąd, \d+ ostrzeż/);
    expect(formatIssue(r.issues[0]!, { color: true })).toContain('\x1b[31m');
  });

  it('explains load crashes in designer language', () => {
    const m = explainLoadError(new Error('material tin: unknown deposit tin_vien'));
    expect(m.message).toContain('„tin”');
    expect(m.message).toContain('„tin_vien”');
    expect(m.fix).toContain('sources.ts');
    expect(explainLoadError(new SyntaxError("Expected ',' got 'x'")).message).toContain('Błąd składni');
  });
});

// ------------------------------------------------------------------ CLI
function fakeIO(modules: Record<string, Record<string, unknown>> = {}, fail?: unknown) {
  const out: string[] = [];
  const err: string[] = [];
  const io: CliIO = {
    loadModule: async (p) => {
      if (fail) throw fail;
      if (modules[p]) return modules[p]!;
      return (await import(/* @vite-ignore */ resolve(ROOT, p))) as Record<string, unknown>;
    },
    readFile: (p) => {
      try {
        return readFileSync(resolve(ROOT, p), 'utf8');
      } catch {
        return undefined;
      }
    },
    out: (s) => out.push(s),
    err: (s) => err.push(s),
    color: false,
    now: () => 0,
  };
  return { io, out: () => out.join('\n'), err: () => err.join('\n') };
}

describe('content check: CLI', () => {
  it('passes on the real data (exit 0)', async () => {
    const f = fakeIO();
    expect(await runContentCheck([], f.io)).toBe(0);
    expect(f.out()).toContain('Podsumowanie: 0 błędów');
  });

  it('fails with exit 1 and line numbers on broken data', async () => {
    const f = fakeIO();
    expect(await runContentCheck(['--bundle', 'tests/tools/fixtures/brokenBundle.ts'], f.io)).toBe(1);
    expect(f.out()).toMatch(/BŁĄD\s+src\/content\/recipes\.ts:\d+\s+bronze_bar\s+\[ref\.resource\]/);
  });

  it('treats warnings as failures only with --strict, and hides them with -q', async () => {
    const b = draft();
    b.resources.find((x) => x.id === 'bronze_helm')!.stats!.armor = 0;
    const mods = { 'warn.ts': { bundle: b } };
    expect(await runContentCheck(['--bundle', 'warn.ts'], fakeIO(mods).io)).toBe(0);
    const f = fakeIO(mods);
    expect(await runContentCheck(['--bundle', 'warn.ts', '--strict', '-q'], f.io)).toBe(1);
    expect(f.out()).not.toContain('OSTRZEŻENIE');
    expect(f.out()).toMatch(/Podsumowanie: 0 błędów, [1-9]\d* ostrzeż/);
  });

  it('filters rules with --only and writes JSON with --json', async () => {
    const f = fakeIO();
    expect(await runContentCheck(['--only=boss', '--json'], f.io)).toBe(0);
    const j = JSON.parse(f.out());
    expect(j.errors).toBe(0);
    expect(j.issues.every((i: Issue) => i.rule.startsWith('boss.'))).toBe(true);
    for (const i of j.issues) expect(typeof i.line === 'number' || i.line === null).toBe(true);
  });

  it('rejects bad options with exit 2 and a hint', async () => {
    const f = fakeIO();
    expect(await runContentCheck(['--frobnicate'], f.io)).toBe(2);
    expect(f.err()).toContain('Nieznana opcja „--frobnicate”');
    expect(parseArgs(['--only=refs'])).toEqual({ error: expect.stringContaining('Czy chodziło o „ref”') });
  });

  it('turns a crash while loading the data into exit 2 with an explanation', async () => {
    const f = fakeIO({}, new Error('material tin: unknown deposit tin_vien'));
    expect(await runContentCheck([], f.io)).toBe(2);
    expect(f.err()).toContain('BŁĄD WCZYTYWANIA DANYCH');
    expect(f.err()).toContain('przywróć złoże „tin_vien”');
  });

  it('runs end-to-end through node (exit codes 0 and 1)', () => {
    const ok = spawnSync(process.execPath, ['scripts/content-check.mjs', '--no-color', '-q'], { cwd: ROOT, encoding: 'utf8' });
    expect(ok.status, ok.stderr).toBe(0);
    expect(ok.stdout).toContain('Podsumowanie: 0 błędów');
    const bad = spawnSync(process.execPath, ['scripts/content-check.mjs', '--no-color', '--bundle', 'tests/tools/fixtures/brokenBundle.ts'], { cwd: ROOT, encoding: 'utf8' });
    expect(bad.status, bad.stderr).toBe(1);
    expect(bad.stdout).toContain('surowiec „copper_barr” nie istnieje');
  }, 30000);
});
