/**
 * Content integrity: counts demanded by the owner, referential integrity,
 * full unlock coverage, "every thing has a source and a use", and tier
 * progression (nothing needs a resource from a deeper biome than intended).
 */
import { describe, expect, it } from 'vitest';
import { analyze, usages } from '../src/content/analysis';
import { BIOMES, HAZARDS } from '../src/content/biomes';
import { BUILDINGS, INFRASTRUCTURE, START_BUILDINGS, START_INFRA } from '../src/content/buildings';
import { RECIPES, START_RECIPES } from '../src/content/recipes';
import { RES, RESOURCES } from '../src/content/resources';
import { CREATURES, DEPOSITS, OBJECTS } from '../src/content/sources';
import { RESEARCH_PACKS, TECH, TECH_BY_ID } from '../src/content/tech';
import type { Stack } from '../src/content/types';

const kinds = (k: string) => RESOURCES.filter((r) => r.kind === k);
const report = (problems: string[]) => expect(problems, problems.join('\n')).toEqual([]);

describe('content: owner minimums', () => {
  it('has >= 15 building types, each with 3 levels', () => {
    expect(BUILDINGS.length).toBeGreaterThanOrEqual(15);
    for (const b of BUILDINGS) expect(b.levels.length).toBe(3);
  });
  it('has ~80 usable items', () => {
    const n = kinds('item').length;
    expect(n).toBeGreaterThanOrEqual(78);
    expect(n).toBeLessThanOrEqual(95);
  });
  it('has >= 20 deposit types', () => expect(DEPOSITS.length).toBeGreaterThanOrEqual(20));
  it('has >= 30 drop materials', () => expect(kinds('drop').length).toBeGreaterThanOrEqual(30));
  it('has 60-80+ crafted materials', () => {
    const n = kinds('material').length;
    expect(n).toBeGreaterThanOrEqual(60);
    expect(n).toBeLessThanOrEqual(85);
  });
  it('has a large research tree', () => {
    expect(TECH.length).toBeGreaterThanOrEqual(100);
    expect(TECH.length).toBeLessThanOrEqual(140);
  });
  it('has no tameable or working creatures', () => {
    for (const c of CREATURES) expect(JSON.stringify(c)).not.toMatch(/tame|worker|pet/i);
  });
});

describe('content: referential integrity', () => {
  it('has unique ids', () => {
    const all = [...RESOURCES.map((r) => r.id), ...BUILDINGS.map((b) => b.id), ...INFRASTRUCTURE.map((i) => i.id)];
    expect(new Set(all).size).toBe(all.length);
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(RECIPES.length);
    expect(new Set(TECH.map((t) => t.id)).size).toBe(TECH.length);
  });

  it('references only existing things', () => {
    const p: string[] = [];
    const chk = (where: string, ss: readonly Stack[]) => {
      for (const s of ss) if (!RES.has(s.id)) p.push(`${where}: unknown resource ${s.id}`);
    };
    const bIds = new Set(BUILDINGS.map((b) => b.id));
    for (const r of RECIPES) {
      chk(`recipe ${r.id}`, r.inputs);
      chk(`recipe ${r.id}`, r.outputs);
      if (!bIds.has(r.at)) p.push(`recipe ${r.id}: unknown building ${r.at}`);
    }
    for (const b of BUILDINGS) b.levels.forEach((l, k) => chk(`building ${b.id}:${k + 1}`, l.cost));
    for (const i of INFRASTRUCTURE) chk(`infra ${i.id}`, i.cost);
    const rIds = new Set(RECIPES.map((r) => r.id));
    const iIds = new Set(INFRASTRUCTURE.map((i) => i.id));
    for (const t of TECH) {
      chk(`tech ${t.id}`, t.cost);
      for (const q of t.requires) if (!TECH_BY_ID.has(q)) p.push(`tech ${t.id}: unknown prerequisite ${q}`);
      for (const q of t.requires) if ((TECH_BY_ID.get(q)?.tier ?? 0) > t.tier) p.push(`tech ${t.id}: prerequisite ${q} is in a later tier`);
      for (const q of t.revealBy) if (!RES.has(q)) p.push(`tech ${t.id}: unknown reveal resource ${q}`);
      for (const q of t.unlocks.recipes ?? []) if (!rIds.has(q)) p.push(`tech ${t.id}: unknown recipe ${q}`);
      for (const [b] of t.unlocks.buildings ?? []) if (!bIds.has(b)) p.push(`tech ${t.id}: unknown building ${b}`);
      for (const q of t.unlocks.infra ?? []) if (!iIds.has(q)) p.push(`tech ${t.id}: unknown infra ${q}`);
    }
    for (const d of DEPOSITS) if (RES.get(d.yields)?.kind !== 'raw') p.push(`deposit ${d.id}: yields non-raw ${d.yields}`);
    for (const o of OBJECTS) for (const d of o.drops) if (!RES.has(d.id)) p.push(`object ${o.id}: unknown drop ${d.id}`);
    for (const c of CREATURES) for (const d of c.drops) if (!RES.has(d.id)) p.push(`creature ${c.id}: unknown drop ${d.id}`);
    for (const h of HAZARDS)
      for (const c of h.counters) if (!RES.has(c) && !bIds.has(c) && !iIds.has(c)) p.push(`hazard ${h.id}: unknown counter ${c}`);
    for (const b of BIOMES) for (const h of b.hazards) if (!HAZARDS.some((x) => x.id === h)) p.push(`biome ${b.id}: unknown hazard ${h}`);
    report(p);
  });
});

describe('content: coverage', () => {
  it('unlocks every recipe, building level and infra piece exactly once', () => {
    const p: string[] = [];
    const count = new Map<string, number>();
    for (const t of TECH) {
      for (const r of t.unlocks.recipes ?? []) count.set(`recipe:${r}`, (count.get(`recipe:${r}`) ?? 0) + 1);
      for (const [b, l] of t.unlocks.buildings ?? []) count.set(`building:${b}:${l}`, (count.get(`building:${b}:${l}`) ?? 0) + 1);
      for (const i of t.unlocks.infra ?? []) count.set(`infra:${i}`, (count.get(`infra:${i}`) ?? 0) + 1);
    }
    const sB = new Set(START_BUILDINGS.map(([b, l]) => `${b}:${l}`));
    for (const r of RECIPES) {
      const c = count.get(`recipe:${r.id}`) ?? 0;
      const want = START_RECIPES.includes(r.id) ? 0 : 1;
      if (c !== want) p.push(`recipe ${r.id}: unlocked ${c}x (want ${want})`);
    }
    for (const b of BUILDINGS)
      for (let l = 1; l <= 3; l++) {
        const c = count.get(`building:${b.id}:${l}`) ?? 0;
        const want = sB.has(`${b.id}:${l}`) ? 0 : 1;
        if (c !== want) p.push(`building ${b.id}:${l}: unlocked ${c}x (want ${want})`);
      }
    for (const i of INFRASTRUCTURE) {
      const c = count.get(`infra:${i.id}`) ?? 0;
      const want = START_INFRA.includes(i.id) ? 0 : 1;
      if (c !== want) p.push(`infra ${i.id}: unlocked ${c}x (want ${want})`);
    }
    report(p);
  });

  it('gives every material and item a recipe, every raw a deposit, every drop a source', () => {
    const p: string[] = [];
    const produced = new Set(RECIPES.flatMap((r) => r.outputs.map((o) => o.id)));
    const fromDeposit = new Set(DEPOSITS.map((d) => d.yields).concat(['stone']));
    const fromSource = new Set([...OBJECTS.flatMap((o) => o.drops.map((d) => d.id)), ...CREATURES.flatMap((c) => c.drops.map((d) => d.id))]);
    for (const r of RESOURCES) {
      if ((r.kind === 'material' || r.kind === 'item') && !produced.has(r.id)) p.push(`${r.kind} ${r.id}: no recipe`);
      if (r.kind === 'raw' && !fromDeposit.has(r.id)) p.push(`raw ${r.id}: no deposit`);
      if (r.kind === 'drop' && !fromSource.has(r.id)) p.push(`drop ${r.id}: no source`);
    }
    report(p);
  });

  it('uses every raw, drop and material somewhere (no dead ends)', () => {
    const u = usages();
    const exempt = new Set(['heart_key', 'eater_shard']);
    const p = RESOURCES.filter((r) => r.kind !== 'item' && !exempt.has(r.id) && !(u.get(r.id)?.length)).map((r) => `${r.kind} ${r.id}: never used`);
    report(p);
  });
});

describe('content: progression', () => {
  const A = analyze();

  it('can research every node within its own tier', () => {
    const p = TECH.filter((t) => (A.tech.get(t.id) ?? Infinity) !== t.tier).map(
      (t) => `tech ${t.id} (T${t.tier}) researchable only at ${A.tech.get(t.id)}: cost ${t.cost.map((s) => `${s.id}@${A.res.get(s.id)}`).join(', ')}`,
    );
    report(p);
  });

  it('makes every resource obtainable no later than its declared tier', () => {
    const p = RESOURCES.filter((r) => !((A.res.get(r.id) ?? Infinity) <= r.tier)).map(
      (r) => `${r.kind} ${r.id}: declared T${r.tier}, obtainable at ${A.res.get(r.id)}`,
    );
    report(p);
  });

  it('can build every building level and infra piece', () => {
    const p: string[] = [];
    for (const b of BUILDINGS) for (let l = 1; l <= 3; l++) if (!Number.isFinite(A.building.get(`${b.id}:${l}`))) p.push(`building ${b.id}:${l} never buildable`);
    for (const i of INFRASTRUCTURE) {
      const t = A.infra.get(i.id) ?? Infinity;
      if (t > i.tier) p.push(`infra ${i.id}: declared T${i.tier}, buildable at ${t}`);
    }
    report(p);
  });

  it('lets each biome be mined with picks available by then', () => {
    const p: string[] = [];
    for (const d of DEPOSITS) {
      const bt = Math.min(...d.biomes.map((b) => BIOMES.find((x) => x.id === b)!.tier));
      const t = A.res.get(d.yields) ?? Infinity;
      if (t > bt + 1) p.push(`deposit ${d.id} (biome T${bt}) minable only at ${t}`);
    }
    report(p);
  });

  it('offers a counter for every hazard by the time its biome is reached', () => {
    const p: string[] = [];
    for (const b of BIOMES)
      for (const h of b.hazards) {
        const hz = HAZARDS.find((x) => x.id === h)!;
        const best = Math.min(
          ...hz.counters.map((c) => A.res.get(c) ?? A.infra.get(c) ?? Math.min(A.building.get(`${c}:1`) ?? Infinity)),
        );
        if (best > b.tier) p.push(`biome ${b.id} T${b.tier}: hazard ${h} first countered at ${best}`);
      }
    report(p);
  });

  it('makes every research pack obtainable exactly in its tier', () => {
    const p = RESEARCH_PACKS.map((id, t) => [id, t] as const)
      .filter(([id, t]) => A.res.get(id) !== t)
      .map(([id, t]) => `pack ${id}: tier ${t}, obtainable at ${A.res.get(id)}`);
    report(p);
  });
});
