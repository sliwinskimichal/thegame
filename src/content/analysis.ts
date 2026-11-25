/**
 * Static progression analysis of the content graph.
 *
 * Computes, by fixpoint iteration, the earliest biome tier at which every
 * resource can be obtained, every recipe crafted, every building level built
 * and every tech node researched — taking into account deposits and the
 * pick tier needed to mine them, tools needed to harvest objects, research
 * prerequisites and pack availability. Used by tests (content must be
 * obtainable in the tier it is designed for) and by the balance simulator.
 */
import { BIOMES } from './biomes';
import { BUILDINGS, INFRASTRUCTURE, START_BUILDINGS, START_INFRA } from './buildings';
import { RECIPES, START_RECIPES } from './recipes';
import { RES, RESOURCES } from './resources';
import { CREATURES, DEPOSITS, OBJECTS, ROCK_PICK_TIER } from './sources';
import { TECH } from './tech';
import type { Stack } from './types';

export interface Analysis {
  res: Map<string, number>;
  recipe: Map<string, number>;
  building: Map<string, number>; // key `${id}:${level}`
  infra: Map<string, number>;
  tech: Map<string, number>;
  /** Which node unlocks each recipe / building level / infra piece. */
  unlockedBy: Map<string, string>;
}

const BIOME_TIER = new Map(BIOMES.map((b) => [b.id, b.tier]));
const INF = Number.POSITIVE_INFINITY;

export function analyze(): Analysis {
  const res = new Map<string, number>();
  for (const r of RESOURCES) res.set(r.id, INF);
  const recipe = new Map<string, number>();
  const building = new Map<string, number>();
  const infra = new Map<string, number>();
  const tech = new Map<string, number>();
  const unlockedBy = new Map<string, string>();

  for (const t of TECH) {
    for (const r of t.unlocks.recipes ?? []) unlockedBy.set(`recipe:${r}`, t.id);
    for (const [b, l] of t.unlocks.buildings ?? []) unlockedBy.set(`building:${b}:${l}`, t.id);
    for (const i of t.unlocks.infra ?? []) unlockedBy.set(`infra:${i}`, t.id);
  }
  const startB = new Set(START_BUILDINGS.map(([b, l]) => `${b}:${l}`));
  const startR = new Set(START_RECIPES);
  const startI = new Set(START_INFRA);

  const av = (id: string) => res.get(id) ?? INF;
  const costTier = (cost: readonly Stack[]) => cost.reduce((m, s) => Math.max(m, av(s.id)), 0);
  const unlockTier = (key: string, isStart: boolean) => {
    if (isStart) return 0;
    const n = unlockedBy.get(key);
    return n ? (tech.get(n) ?? INF) : INF;
  };
  const pickAvail = (p: number) => {
    if (p <= 0) return 0;
    let best = INF;
    for (const r of RESOURCES) if (r.slot === 'pick' && (r.stats?.pickTier ?? 0) >= p) best = Math.min(best, av(r.id));
    return best;
  };
  const toolAvail = (tool?: string) => {
    if (!tool || tool === 'hands') return 0;
    if (tool === 'pick') return pickAvail(1);
    let best = INF;
    for (const r of RESOURCES) if (r.tags?.includes(tool === 'axe' ? 'axe' : 'fishing')) best = Math.min(best, av(r.id));
    return best;
  };
  const lower = (id: string, t: number): boolean => {
    if (t < av(id)) {
      res.set(id, t);
      return true;
    }
    return false;
  };

  for (let iter = 0; iter < 200; iter++) {
    let changed = false;
    // raw: deposits (+ ordinary rock gives stone)
    for (const d of DEPOSITS) {
      const bt = Math.min(...d.biomes.map((b) => BIOME_TIER.get(b)!));
      changed = lower(d.yields, Math.max(bt, pickAvail(d.pickTier))) || changed;
    }
    changed = lower('stone', Math.max(0, pickAvail(ROCK_PICK_TIER.foothills!))) || changed;
    // drops: objects and creatures
    for (const o of OBJECTS) {
      const t = Math.max(Math.min(...o.biomes.map((b) => BIOME_TIER.get(b)!)), toolAvail(o.tool));
      for (const dr of o.drops) changed = lower(dr.id, t) || changed;
    }
    for (const c of CREATURES) for (const dr of c.drops) changed = lower(dr.id, BIOME_TIER.get(c.biome)!) || changed;
    // tech nodes
    for (const t of TECH) {
      let v = Math.max(t.tier, costTier(t.cost));
      for (const p of t.requires) v = Math.max(v, tech.get(p) ?? INF);
      if (v < (tech.get(t.id) ?? INF)) {
        tech.set(t.id, v);
        changed = true;
      }
    }
    // building levels (level L needs level L-1 first)
    for (const b of BUILDINGS)
      b.levels.forEach((lv, k) => {
        const key = `${b.id}:${k + 1}`;
        let v = Math.max(unlockTier(`building:${key}`, startB.has(key)), costTier(lv.cost));
        if (k > 0) v = Math.max(v, building.get(`${b.id}:${k}`) ?? INF);
        if (v < (building.get(key) ?? INF)) {
          building.set(key, v);
          changed = true;
        }
      });
    for (const i of INFRASTRUCTURE) {
      const v = Math.max(unlockTier(`infra:${i.id}`, startI.has(i.id)), costTier(i.cost));
      if (v < (infra.get(i.id) ?? INF)) {
        infra.set(i.id, v);
        changed = true;
      }
    }
    // recipes
    for (const r of RECIPES) {
      const v = Math.max(
        unlockTier(`recipe:${r.id}`, startR.has(r.id)),
        building.get(`${r.at}:${r.level}`) ?? INF,
        costTier(r.inputs),
      );
      if (v < (recipe.get(r.id) ?? INF)) {
        recipe.set(r.id, v);
        changed = true;
      }
      if (v < INF) for (const o of r.outputs) changed = lower(o.id, v) || changed;
    }
    if (!changed) break;
  }
  return { res, recipe, building, infra, tech, unlockedBy };
}

/** Where each resource is used (recipe inputs, costs). */
export function usages(): Map<string, string[]> {
  const u = new Map<string, string[]>();
  const add = (id: string, where: string) => {
    const l = u.get(id) ?? [];
    l.push(where);
    u.set(id, l);
  };
  for (const r of RECIPES) for (const s of r.inputs) add(s.id, `recipe:${r.id}`);
  for (const b of BUILDINGS) b.levels.forEach((lv, k) => lv.cost.forEach((s) => add(s.id, `building:${b.id}:${k + 1}`)));
  for (const i of INFRASTRUCTURE) for (const s of i.cost) add(s.id, `infra:${i.id}`);
  for (const t of TECH) for (const s of t.cost) add(s.id, `tech:${t.id}`);
  return u;
}

export function resName(id: string): string {
  return RES.get(id)?.namePl ?? id;
}
