/**
 * Raw (deposit) demand of a game completion, in units, per tier: the bill of materials behind the work
 * that `src/balance/model.ts` books for a completion, expanded through the model's cheapest recipe at each
 * tier down to deposit yields. Test helper for the world-supply check (tests/content/worldgen.test.ts).
 *
 * Mirrors the model's private constants (EXPEDITION, MILITIA, COLONY_INFRA) and the Weksel baskets of
 * docs/design/systems/ECONOMY.md §2.4; systems-designer: exporting them from the model removes the copy.
 */
import { PacingModel } from '../../src/balance/model';
import { BIOMES, HAZARDS } from '../../src/content/biomes';
import { BUILDINGS, INFRASTRUCTURE } from '../../src/content/buildings';
import { RECIPES } from '../../src/content/recipes';
import { RES, RESOURCES } from '../../src/content/resources';
import { DEPOSITS } from '../../src/content/sources';
import { TECH } from '../../src/content/tech';
import type { Recipe, Stack } from '../../src/content/types';

const EXPEDITION = 8;
const MILITIA = 6;
const COLONY_INFRA: readonly (readonly [string, number])[] = [
  ['ladder', 30], ['platform', 40], ['torch', 30], ['wooden_door', 4], ['stairs', 20], ['wooden_prop', 30],
  ['stone_pillar', 15], ['stone_wall', 40], ['brazier', 8], ['chute', 6], ['banner', 6], ['statue', 3],
  ['rail_track', 60], ['pipeline', 40], ['oil_lamp_post', 20], ['iron_truss', 12], ['bulkhead', 4],
  ['vent_shaft', 8], ['heater', 10], ['chain_conveyor', 30], ['crystal_lamp_post', 25], ['cooler', 10],
  ['obsidian_wall', 20], ['ward_stone', 12], ['glimmer_beacon', 10], ['spore_lamp', 25], ['rope_bridge', 8],
  ['obsidian_pillar', 15], ['lava_channel', 25], ['lava_gate', 4], ['cooling_pipe', 30], ['fire_trap', 8], ['ember_lamp', 20],
];
/** Weksel instalments (ECONOMY §2.4): [stack id, amount, tier of the instalment]. */
const WEKSEL: readonly (readonly [string, number, number])[] = [
  ['copper_bar', 50, 1], ['bronze_bar', 20, 1], ['iron_bar', 60, 2], ['steel_bar', 25, 2], ['nickel_steel', 30, 4],
  ['gold_bar', 15, 4], ['pearl', 10, 4], ['cobalt_steel', 30, 5], ['sapphire', 12, 5], ['amethyst', 10, 5],
  ['adamant_bar', 30, 7], ['emberbronze_bar', 30, 7], ['ruby', 10, 7],
];

export interface RawDemand {
  total: number;
  byTier: number[];
  /** Units by demand category (research, buildings, gear, militia, tools, colony, weksel). */
  byCat: Record<string, number>;
}

/** Deposit-yield demand of a completion per raw resource id. */
export function completionRawDemand(): Map<string, RawDemand> {
  const m = new PacingModel();
  // the model keeps these as plain (non-exported) members; read them as data
  const model = m as unknown as {
    A: { recipe: Map<string, number>; res: Map<string, number>; building: Map<string, number>; infra: Map<string, number>; unlockedBy: Map<string, string> };
    completionNodes(): Set<string>;
    nodeCost(id: string): Stack[];
    recipeWork(r: Recipe, k: number): number;
    unitWork(id: string, k: number): number;
  };
  const A = model.A;
  const nodes = model.completionNodes();
  const raw = new Set(DEPOSITS.map((d) => d.yields));
  const out = new Map<string, RawDemand>();
  const bestRecipe = new Map<string, Recipe | null>();
  let cat = '';

  const cheapest = (id: string, k: number): Recipe | null => {
    const key = `${id}@${k}`;
    if (bestRecipe.has(key)) return bestRecipe.get(key)!;
    let best: Recipe | null = null;
    let bw = Infinity;
    for (const r of RECIPES) {
      const o = r.outputs.find((x) => x.id === id);
      if (!o || (A.recipe.get(r.id) ?? Infinity) > k) continue;
      const w = model.recipeWork(r, k) / o.n;
      if (w < bw) {
        bw = w;
        best = r;
      }
    }
    bestRecipe.set(key, best);
    return best;
  };

  const add = (id: string, n: number, k: number, depth = 0): void => {
    if (depth > 30 || !(n > 0)) return;
    if (raw.has(id)) {
      let d = out.get(id);
      if (!d) out.set(id, (d = { total: 0, byTier: Array(BIOMES.length).fill(0), byCat: {} }));
      d.total += n;
      d.byTier[k]! += n;
      d.byCat[cat] = (d.byCat[cat] ?? 0) + n;
      return;
    }
    const r = cheapest(id, k);
    if (!r) return; // drops, objects, trophies
    const o = r.outputs.find((x) => x.id === id)!;
    for (const s of r.inputs) add(s.id, (s.n * n) / o.n, k, depth + 1);
  };
  const addStacks = (ss: readonly Stack[], k: number, mul = 1): void => {
    for (const s of ss) add(s.id, s.n * mul, k);
  };

  for (let k = 0; k < BIOMES.length; k++) {
    cat = 'research';
    for (const t of TECH) if (t.tier === k && nodes.has(t.id)) addStacks(model.nodeCost(t.id), k);
    cat = 'buildings';
    for (const b of BUILDINGS)
      b.levels.forEach((lv, i) => {
        if ((A.building.get(`${b.id}:${i + 1}`) ?? Infinity) !== k) return;
        const n = A.unlockedBy.get(`building:${b.id}:${i + 1}`);
        if (n && !nodes.has(n)) return;
        addStacks(lv.cost, k, b.category === 'production' || b.category === 'food' ? 2 : 1);
      });
    cat = 'gear';
    for (const h of BIOMES[k]!.hazards) {
      const hz = HAZARDS.find((x) => x.id === h)!;
      const items = hz.counters.filter((c) => RES.get(c)?.kind === 'item' && (A.res.get(c) ?? Infinity) <= k);
      if (items.length) add(items.sort((a, b) => model.unitWork(a, k) - model.unitWork(b, k))[0]!, EXPEDITION, k);
      const infra = hz.counters.filter((c) => INFRASTRUCTURE.some((i) => i.id === c) && (A.infra.get(c) ?? Infinity) <= k);
      if (infra.length) addStacks(INFRASTRUCTURE.find((i) => i.id === infra[0])!.cost, k, 25);
    }
    const bestOf = (slot: string): string | null => {
      let best: string | null = null;
      let bv = -Infinity;
      for (const r of RESOURCES) {
        if (r.slot !== slot || (A.res.get(r.id) ?? Infinity) > k) continue;
        const v = r.stats?.damage ?? r.stats?.armor ?? r.stats?.workSpeed ?? 0;
        if (v > bv) {
          bv = v;
          best = r.id;
        }
      }
      return best;
    };
    cat = 'militia';
    for (const slot of ['weapon', 'body', 'head']) {
      const b = bestOf(slot);
      if (b) add(b, MILITIA * 0.5, k);
    }
    cat = 'tools';
    const pick = bestOf('pick');
    if (pick) add(pick, 10 * 0.6, k);
    cat = 'colony';
    for (const [id, n] of COLONY_INFRA) {
      const t = A.infra.get(id) ?? Infinity;
      if (t <= k) addStacks(INFRASTRUCTURE.find((i) => i.id === id)!.cost, k, n);
    }
  }
  cat = 'weksel';
  for (const [id, n, k] of WEKSEL) add(id, n, k);
  return out;
}
