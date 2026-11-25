/**
 * Progression / pacing model.
 *
 * Estimates how many real hours a player needs to complete each biome tier,
 * from the content graph and a handful of behavioural parameters:
 *   1. W_k(res): dwarf-seconds to obtain one unit of a resource at tier k
 *      (cheapest route: mining with the best pick, harvesting, hunting,
 *      crafting with the best building level, + hauling, by logistics tier).
 *   2. Demands per tier: research of the needed nodes (pack costs follow a
 *      tunable curve), building levels, hazard gear for an expedition,
 *      militia kit, picks for everybody, exploration tunnelling.
 *   3. Labour supply: population (capped by the Hearth level, grown by
 *      migrants) x efficiency x game speed, plus boss and pause overheads.
 * Monte Carlo over the behavioural parameters gives P10/P50/P90 times.
 * The model is a design tool: it does not replace playtesting.
 */
import { analyze, type Analysis } from '../content/analysis';
import { BIOMES, HAZARDS } from '../content/biomes';
import { BUILDINGS, INFRASTRUCTURE } from '../content/buildings';
import { GREAT_WORKS } from '../content/greatworks';
import { RECIPES } from '../content/recipes';
import { RES, RESOURCES } from '../content/resources';
import { CREATURES, DEPOSITS, OBJECTS } from '../content/sources';
import { PACK_CURVE, packCost, TECH, TECH_BY_ID, type PackCurve } from '../content/tech';
import type { Recipe, Stack } from '../content/types';
import { Rng } from '../core/rng';

export const TIERS = 9;

/** Target real hours spent in each tier for a first completion (sum ~40 h). */
export const TARGET_HOURS = [2, 4, 6, 5, 6, 6, 5, 5, 1];
export const TARGET_COMPLETION = 40;
export const TARGET_MAX = 120;

export interface Behaviour {
  efficiency: number; // share of dwarf time spent on productive work
  gameSpeed: number; // average speed multiplier used by the player
  migrantsPerHour: number; // arrivals per real hour while under the cap
  tunnelScale: number; // how much exploratory digging the player does
  bossHours: number; // preparation + fight per boss (tier 0), grows with tier
  pause: number; // extra real time spent paused / planning (fraction)
  idle: number; // real time spent on non-progress play: exploring, decorating, learning (fraction)
}

export const DEFAULT_BEHAVIOUR: Behaviour = {
  efficiency: 0.4,
  gameSpeed: 1.6,
  migrantsPerHour: 6,
  tunnelScale: 1,
  bossHours: 0.35,
  pause: 0.15,
  idle: 0.25,
};

/** Game time: one day lasts this many real seconds at 1x. Each dwarf eats and drinks once a day. */
export const DAY_SECONDS = 600;

/** Exploration tunnelling per tier (tiles) and host rock hardness. */
const TUNNELS = [250, 800, 1000, 1000, 1100, 1100, 1100, 1100, 300];
const ROCK_HARDNESS = [1.2, 2.2, 3.5, 2.6, 3.0, 4.0, 5.0, 6.0, 6.5];
/** Typical haul distance (tiles) between the work front and the workshops, per tier. */
const DISTANCE = [25, 45, 60, 70, 80, 80, 85, 90, 90];
/** Logistics speed-up: rails and geared lifts (T2), steam lift/railway (T4), drills & conveyors (T6). */
const LOGISTICS = [1, 1, 0.8, 0.8, 0.55, 0.55, 0.45, 0.45, 0.45];
const WALK = 2.5; // tiles per second
function haulAt(k: number, carry: number): number {
  return ((2 * DISTANCE[k]!) / WALK / carry) * LOGISTICS[k]!;
}
const EXPEDITION = 8; // dwarves equipped against a new hazard
export const ABYSS_CIRCLES = 10;
/** Players who max out spend more time designing and beautifying (fraction of real time). */
export const MAX_IDLE = 0.45;
const MILITIA = 6;
/** Typical amount of each infrastructure piece placed per tier by a growing colony. */
const COLONY_INFRA: readonly (readonly [string, number])[] = [
  ['ladder', 30], ['platform', 40], ['torch', 30], ['wooden_door', 4], ['stairs', 20], ['wooden_prop', 30],
  ['stone_pillar', 15], ['stone_wall', 40], ['brazier', 8], ['chute', 6], ['banner', 6], ['statue', 3],
  ['rail_track', 60], ['pipeline', 40], ['oil_lamp_post', 20], ['iron_truss', 12], ['bulkhead', 4],
  ['vent_shaft', 8], ['heater', 10], ['chain_conveyor', 30], ['crystal_lamp_post', 25], ['cooler', 10],
  ['obsidian_wall', 20], ['ward_stone', 12], ['glimmer_beacon', 10], ['spore_lamp', 25], ['rope_bridge', 8],
  ['obsidian_pillar', 15], ['lava_channel', 25], ['lava_gate', 4], ['cooling_pipe', 30], ['fire_trap', 8], ['ember_lamp', 20],
];

export interface TierReport {
  tier: number;
  workHours: number; // dwarf-hours of labour
  realHours: number;
  pop: number;
  breakdown: Record<string, number>; // dwarf-hours by category
}

export interface RunReport {
  tiers: TierReport[];
  total: number;
}

const BIOME_TIER = new Map(BIOMES.map((b) => [b.id, b.tier]));

export class PacingModel {
  readonly A: Analysis;
  private wCache = new Map<string, number>();
  private curve: PackCurve;
  /** Scale applied to Great Work stage costs (for tuning the max-out length). */
  gwScale = 1;

  constructor(curve: PackCurve = PACK_CURVE) {
    this.A = analyze();
    this.curve = curve;
  }

  // ------------------------------------------------------------ capability
  private bestStat(k: number, pred: (id: string) => boolean, stat: 'workSpeed' | 'damage' | 'armor'): number {
    let best = 0;
    for (const r of RESOURCES) {
      if (r.kind !== 'item' || !pred(r.id)) continue;
      if ((this.A.res.get(r.id) ?? Infinity) > k) continue;
      best = Math.max(best, r.stats?.[stat] ?? 0);
    }
    return best;
  }
  pickSpeed(k: number): number {
    return Math.max(0.6, this.bestStat(k, (id) => RES.get(id)!.slot === 'pick', 'workSpeed'));
  }
  axeSpeed(k: number): number {
    return Math.max(0.6, this.bestStat(k, (id) => RES.get(id)!.tags?.includes('axe') ?? false, 'workSpeed'));
  }
  carry(k: number): number {
    let best = 1;
    for (const r of RESOURCES)
      if (r.slot === 'back' && (this.A.res.get(r.id) ?? Infinity) <= k) best = Math.max(best, 1 + (r.stats?.carry ?? 0));
    return best;
  }
  weapon(k: number): number {
    return Math.max(4, this.bestStat(k, (id) => RES.get(id)!.slot === 'weapon', 'damage'));
  }
  buildingSpeed(id: string, k: number): number {
    const b = BUILDINGS.find((x) => x.id === id)!;
    let s = 1;
    b.levels.forEach((lv, i) => {
      if ((this.A.building.get(`${id}:${i + 1}`) ?? Infinity) <= k) s = Math.max(s, lv.effects.speed ?? 1);
    });
    return s;
  }

  // --------------------------------------------------------- unit work W_k
  /** Dwarf-seconds to obtain one unit of `id` at tier k (cheapest route). */
  unitWork(id: string, k: number, depth = 0): number {
    const key = `${id}@${k}`;
    const hit = this.wCache.get(key);
    if (hit !== undefined) return hit;
    if (depth > 40) return Infinity;
    this.wCache.set(key, Infinity); // cycle guard
    let best = Infinity;
    const haul = haulAt(k, this.carry(k));
    const avail = (t: number) => t <= k;
    // mining
    if (id === 'stone') best = Math.min(best, ROCK_HARDNESS[Math.min(k, 2)]! / this.pickSpeed(k) + haul);
    for (const d of DEPOSITS) {
      if (d.yields !== id) continue;
      const bt = Math.min(...d.biomes.map((b) => BIOME_TIER.get(b)!));
      if (!avail(bt) || !avail(this.A.res.get(id) ?? Infinity)) continue;
      best = Math.min(best, d.hardness / this.pickSpeed(k) / d.amount + haul);
    }
    // harvesting objects
    for (const o of OBJECTS) {
      const dr = o.drops.find((x) => x.id === id);
      if (!dr) continue;
      const bt = Math.min(...o.biomes.map((b) => BIOME_TIER.get(b)!));
      if (!avail(bt)) continue;
      const total = o.drops.reduce((s, x) => s + x.chance * ((x.min + x.max) / 2) * (RES.get(x.id)?.value ?? 1), 0);
      const mine = dr.chance * ((dr.min + dr.max) / 2);
      const share = (mine * (RES.get(id)?.value ?? 1)) / Math.max(1e-6, total);
      const speed = o.tool === 'axe' ? this.axeSpeed(k) : 1;
      best = Math.min(best, ((o.work / speed + 10) * share) / Math.max(1e-6, mine) + haul);
    }
    // hunting creatures (bosses are handled as overhead)
    for (const c of CREATURES) {
      if (c.boss) continue;
      const dr = c.drops.find((x) => x.id === id);
      if (!dr) continue;
      if (!avail(BIOME_TIER.get(c.biome)!)) continue;
      const dps = Math.max(1, this.weapon(k) - c.armor * 0.5) * 0.8;
      const kill = c.hp / dps + 20 + c.damage * 0.6; // + recovery time
      const total = c.drops.reduce((s, x) => s + x.chance * ((x.min + x.max) / 2) * (RES.get(x.id)?.value ?? 1), 0);
      const mine = dr.chance * ((dr.min + dr.max) / 2);
      const share = (mine * (RES.get(id)?.value ?? 1)) / Math.max(1e-6, total);
      best = Math.min(best, (kill * share) / Math.max(1e-6, mine) + haul);
    }
    // crafting
    for (const r of RECIPES) {
      const out = r.outputs.find((o) => o.id === id);
      if (!out || (this.A.recipe.get(r.id) ?? Infinity) > k) continue;
      best = Math.min(best, this.recipeWork(r, k, depth) * this.outputShare(r, id) / out.n);
    }
    // trophies come from bosses: labour cost 0 (time is booked as boss overhead)
    if (RES.get(id)?.tags?.includes('trophy') && (this.A.res.get(id) ?? Infinity) <= k) best = Math.min(best, 0);
    this.wCache.set(key, best);
    return best;
  }

  private outputShare(r: Recipe, id: string): number {
    if (r.outputs.length === 1) return 1;
    const tot = r.outputs.reduce((s, o) => s + o.n * (RES.get(o.id)?.value ?? 1), 0);
    const o = r.outputs.find((x) => x.id === id)!;
    return (o.n * (RES.get(id)?.value ?? 1)) / tot;
  }

  recipeWork(r: Recipe, k: number, depth = 0): number {
    let w = r.time / this.buildingSpeed(r.at, k) + haulAt(k, this.carry(k));
    for (const s of r.inputs) w += s.n * this.unitWork(s.id, k, depth + 1);
    return w;
  }

  stackWork(ss: readonly Stack[], k: number): number {
    let w = 0;
    for (const s of ss) w += s.n * this.unitWork(s.id, k);
    return w;
  }

  // ------------------------------------------------------------- demands
  /** Pack cost of a node under this model's curve (+ its special items). */
  nodeCost(id: string): Stack[] {
    const t = TECH_BY_ID.get(id)!;
    const packs = packCost(t.tier, t.size, this.curve);
    const extra = t.cost.filter((s) => !s.id.match(/notes|charts|plans|codex|treatise|tablet|tome/));
    return [...packs, ...extra];
  }

  /** Nodes needed to finish the game (closure of the final goal). */
  completionNodes(): Set<string> {
    const need = new Set<string>();
    const queue: string[] = [];
    const addNode = (id: string) => {
      if (!id || need.has(id)) return;
      need.add(id);
      queue.push(id);
    };
    const addRecipe = (rid: string) => {
      const n = this.A.unlockedBy.get(`recipe:${rid}`);
      if (n) addNode(n);
    };
    const addBuilding = (b: string, l: number) => {
      for (let i = 1; i <= l; i++) {
        const n = this.A.unlockedBy.get(`building:${b}:${i}`);
        if (n) addNode(n);
      }
    };
    const resSeen = new Set<string>();
    const addRes = (id: string) => {
      if (resSeen.has(id)) return;
      resSeen.add(id);
      const t = this.A.res.get(id) ?? Infinity;
      const rc = RECIPES.filter((r) => r.outputs.some((o) => o.id === id) && (this.A.recipe.get(r.id) ?? Infinity) <= t);
      if (rc.length === 0) return; // raw / drop
      const r = rc.reduce((a, b) => ((this.A.recipe.get(a.id) ?? 9) <= (this.A.recipe.get(b.id) ?? 9) ? a : b));
      addRecipe(r.id);
      addBuilding(r.at, r.level);
      for (const s of r.inputs) addRes(s.id);
    };
    addNode('heart_key_t');
    addRes('heart_key');
    // essential infrastructure of a deep colony
    for (const [b, l] of [['lift', 3], ['pump_station', 3], ['storehouse', 2], ['quarters', 2], ['kitchen', 2], ['farm', 2], ['barracks', 2], ['defense_tower', 2], ['infirmary', 1], ['tavern', 1], ['lore_hall', 3], ['hearth', 3]] as const)
      addBuilding(b, l);
    // one counter per hazard: the earliest available
    for (const h of HAZARDS) {
      const best = h.counters
        .map((c) => ({ c, t: this.A.res.get(c) ?? this.A.infra.get(c) ?? this.A.building.get(`${c}:1`) ?? Infinity }))
        .sort((a, b) => a.t - b.t)[0];
      if (!best) continue;
      if (RES.has(best.c)) addRes(best.c);
      else if (this.A.unlockedBy.has(`infra:${best.c}`)) addNode(this.A.unlockedBy.get(`infra:${best.c}`)!);
      else addBuilding(best.c, 1);
    }
    // picks able to mine every biome
    for (const p of ['bronze_pick', 'steel_pick', 'cobalt_pick', 'adamant_pick']) addRes(p);
    // close over prerequisites and costs
    while (queue.length) {
      const id = queue.shift()!;
      const t = TECH_BY_ID.get(id)!;
      for (const q of t.requires) addNode(q);
      for (const s of this.nodeCost(id)) addRes(s.id);
      for (const [b, l] of t.unlocks.buildings ?? []) addBuilding(b, l);
    }
    return need;
  }

  /** Dwarf-hours of work demanded in tier k for a completion (or a max-out). */
  demand(k: number, mode: 'complete' | 'max', nodes: Set<string>, scale: number): Record<string, number> {
    const out: Record<string, number> = {};
    const add = (cat: string, sec: number) => (out[cat] = (out[cat] ?? 0) + sec / 3600);
    // research
    for (const t of TECH) {
      if (t.tier !== k || (mode === 'complete' && !nodes.has(t.id))) continue;
      add('research', this.stackWork(this.nodeCost(t.id), k));
    }
    // buildings (each level built once; production buildings twice when maxing)
    for (const b of BUILDINGS)
      b.levels.forEach((lv, i) => {
        if ((this.A.building.get(`${b.id}:${i + 1}`) ?? Infinity) !== k) return;
        const n = this.A.unlockedBy.get(`building:${b.id}:${i + 1}`);
        if (mode === 'complete' && n && !nodes.has(n)) return;
        const copies = mode === 'max' && b.category === 'production' ? 2 : 1;
        add('buildings', copies * (lv.work + this.stackWork(lv.cost, k)));
      });
    // hazard gear for the expedition into this biome
    const biome = BIOMES[k];
    if (biome)
      for (const h of biome.hazards) {
        const hz = HAZARDS.find((x) => x.id === h)!;
        const items = hz.counters.filter((c) => RES.get(c)?.kind === 'item' && (this.A.res.get(c) ?? Infinity) <= k);
        const infra = hz.counters.filter((c) => INFRASTRUCTURE.some((i) => i.id === c) && (this.A.infra.get(c) ?? Infinity) <= k);
        if (items.length) add('gear', EXPEDITION * Math.min(...items.map((c) => this.unitWork(c, k))));
        if (infra.length) {
          const inf = INFRASTRUCTURE.find((i) => i.id === infra[0])!;
          add('gear', 25 * (inf.work + this.stackWork(inf.cost, k)));
        }
      }
    // militia kit and picks
    const bestOf = (slot: string) => {
      let best: string | null = null;
      for (const r of RESOURCES)
        if (r.slot === slot && (this.A.res.get(r.id) ?? Infinity) <= k)
          if (!best || (r.stats?.damage ?? r.stats?.armor ?? r.stats?.workSpeed ?? 0) > (RES.get(best)!.stats?.damage ?? RES.get(best)!.stats?.armor ?? RES.get(best)!.stats?.workSpeed ?? 0)) best = r.id;
      return best;
    };
    for (const slot of ['weapon', 'body', 'head']) {
      const b = bestOf(slot);
      if (b) add('militia', MILITIA * this.unitWork(b, k) * 0.5);
    }
    const pick = bestOf('pick');
    if (pick) add('tools', 10 * this.unitWork(pick, k) * 0.6);
    // every item once (max-out only)
    if (mode === 'max')
      for (const r of RESOURCES) if (r.kind === 'item' && this.A.res.get(r.id) === k) add('collection', this.unitWork(r.id, k));
    // colony infrastructure built while settling the tier (ladders, floors, lights, supports, walls...)
    const per = mode === 'max' ? 1.8 : 1;
    for (const [id, n] of COLONY_INFRA) {
      const inf = INFRASTRUCTURE.find((i) => i.id === id)!;
      if ((this.A.infra.get(id) ?? Infinity) > k) continue;
      // the newest piece of each family replaces the older one
      add('colony', n * per * (inf.work + this.stackWork(inf.cost, k)) * (k >= (this.A.infra.get(id) ?? 0) ? 1 : 0));
    }
    // power: enough plants of the best available level for every machine built so far
    const plant = BUILDINGS.find((b) => b.id === 'power_plant')!;
    const powerAt = (t: number) => {
      let need = 0;
      for (const b of BUILDINGS)
        b.levels.forEach((lv, i) => {
          const at = this.A.building.get(`${b.id}:${i + 1}`) ?? Infinity;
          const n = this.A.unlockedBy.get(`building:${b.id}:${i + 1}`);
          if (at <= t && (lv.power ?? 0) > 0 && (mode === 'max' || !n || nodes.has(n))) need += lv.power!;
        });
      let lvl = -1;
      plant.levels.forEach((_, i) => {
        if ((this.A.building.get(`power_plant:${i + 1}`) ?? Infinity) <= t) lvl = i;
      });
      return { need, lvl };
    };
    const now = powerAt(k);
    const before = k > 0 ? powerAt(k - 1) : { need: 0, lvl: -1 };
    if (now.lvl >= 0 && now.need > 0) {
      const out = -(plant.levels[now.lvl]!.power ?? -1);
      const copies = Math.ceil(now.need / out);
      const prev = before.lvl === now.lvl ? Math.ceil(before.need / out) : 0;
      const lv = plant.levels[now.lvl]!;
      add('power', Math.max(0, copies - prev) * (lv.work + this.stackWork(lv.cost, k)));
    }
    // throughput: production buildings are built in several copies once a colony grows
    for (const b of BUILDINGS) {
      if (b.category !== 'production' && b.category !== 'food') continue;
      b.levels.forEach((lv, i) => {
        if ((this.A.building.get(`${b.id}:${i + 1}`) ?? Infinity) !== k) return;
        const copies = mode === 'max' ? 2 : 1;
        add('production', copies * (lv.work + this.stackWork(lv.cost, k)));
      });
    }
    if (mode === 'max') add('decor', 20 * (k + 1) * this.unitWork('stone_block', k) * 6);
    // exploration tunnelling
    const tunnels = TUNNELS[k]! * scale * (mode === 'max' ? 2.2 : 1);
    add('tunnels', tunnels * (ROCK_HARDNESS[k]! / this.pickSpeed(k) + 1.5));
    return out;
  }

  /** Post-game sinks done with the full economy (T8 capabilities): Great Works,
   *  legendary kits for everyone, the bestiary. Dwarf-hours by category. */
  postGame(): Record<string, number> {
    const k = 8;
    const out: Record<string, number> = {};
    const add = (cat: string, sec: number) => (out[cat] = (out[cat] ?? 0) + sec / 3600);
    for (const gw of GREAT_WORKS) for (const st of gw.stages) add('greatworks', this.gwScale * (st.work + this.stackWork(st.cost, k)));
    for (const id of ['glimmer_pick', 'adamant_axe', 'adamant_armor', 'adamant_helm', 'rune_shield', 'glimmer_amulet', 'rune_cloak', 'glimmer_lamp'])
      add('legendary', 50 * this.unitWork(id, k));
    for (const c of CREATURES) {
      if (c.boss) continue;
      const dps = Math.max(1, this.weapon(k) - c.armor * 0.5) * 0.8;
      add('bestiary', 10 * (c.hp / dps + 90));
    }
    // Circles of the Abyss (post-game): 10 procedural levels below the Heart, mixing every
    // hazard, with elite monsters. Each circle: tunnelling, fortification, gear upkeep, elites.
    // Design intent per circle (scaled up 20% per circle): a level of ~9000 dug tiles, a forward
    // base of ~300 fortification/light/logistics pieces, ~100 elite fights (waves), gear repairs.
    const wall = INFRASTRUCTURE.find((i) => i.id === 'obsidian_wall')!;
    const lamp = INFRASTRUCTURE.find((i) => i.id === 'glimmer_beacon')!;
    for (let c = 1; c <= ABYSS_CIRCLES; c++) {
      const scale = 1 + 0.2 * (c - 1);
      add('abyss', scale * 9000 * (ROCK_HARDNESS[8]! / this.pickSpeed(8) + 2));
      add('abyss', scale * 240 * (wall.work + this.stackWork(wall.cost, 8)));
      add('abyss', scale * 60 * (lamp.work + this.stackWork(lamp.cost, 8)));
      add('abyss', scale * 12 * this.unitWork('adamant_armor', 8) * 0.5);
      add('abyss', scale * 100 * (5000 / (this.weapon(8) * 0.8) + 120));
    }
    return out;
  }

  /** Population cap in tier k (Hearth level reached). */
  popCap(k: number): number {
    if ((this.A.building.get('hearth:3') ?? Infinity) <= k) return 50;
    if ((this.A.building.get('hearth:2') ?? Infinity) <= k) return 24;
    return 10;
  }

  run(mode: 'complete' | 'max', bh: Behaviour = DEFAULT_BEHAVIOUR): RunReport {
    const nodes = this.completionNodes();
    let pop = 7;
    const tiers: TierReport[] = [];
    let total = 0;
    for (let k = 0; k < TIERS; k++) {
      const breakdown = this.demand(k, mode, nodes, bh.tunnelScale);
      const workHours = Object.values(breakdown).reduce((a, b) => a + b, 0);
      const cap = this.popCap(k);
      // integrate labour in 6-minute steps
      let done = 0;
      let hours = 0;
      const eff = bh.efficiency * (1 + 0.025 * k); // comfort & skills improve
      // food and drink: one meal and one ale per dwarf per game day
      const meal = Math.min(this.unitWork('bread', k), this.unitWork('roast', k), this.unitWork('mushroom_stew', k));
      const drink = this.unitWork('ale', k);
      const sustain = (meal + drink) / DAY_SECONDS; // dwarf-seconds of labour per dwarf-second of game time
      while (done < workHours && hours < 500) {
        const dt = 0.1;
        done += pop * Math.max(0.05, eff - sustain) * bh.gameSpeed * dt;
        pop = Math.min(cap, pop + bh.migrantsPerHour * dt);
        hours += dt;
      }
      const real = hours * (1 + bh.pause + bh.idle) + bh.bossHours * (1 + 0.2 * k);
      total += real;
      tiers.push({ tier: k, workHours, realHours: real, pop: Math.round(pop), breakdown });
    }
    if (mode === 'max') {
      const breakdown = this.postGame();
      const workHours = Object.values(breakdown).reduce((a, b) => a + b, 0);
      const eff = bh.efficiency * (1 + 0.025 * 8);
      const sustain = (Math.min(this.unitWork('bread', 8), this.unitWork('roast', 8)) + this.unitWork('ale', 8)) / DAY_SECONDS;
      const hours = workHours / (pop * Math.max(0.05, eff - sustain) * bh.gameSpeed);
      const real = hours * (1 + bh.pause + Math.max(bh.idle, MAX_IDLE));
      total += real;
      tiers.push({ tier: 9, workHours, realHours: real, pop: Math.round(pop), breakdown });
    }
    return { tiers, total };
  }

  /** Monte Carlo over behaviours: returns sorted totals and mean per-tier hours. */
  monteCarlo(mode: 'complete' | 'max', n: number, seed = 1): { totals: number[]; perTier: number[] } {
    const rng = new Rng(seed);
    const totals: number[] = [];
    const perTier = new Array(TIERS).fill(0);
    for (let i = 0; i < n; i++) {
      const bh: Behaviour = {
        efficiency: Math.max(0.22, 0.4 + rng.gaussian() * 0.06),
        gameSpeed: rng.range(1.2, 2.1),
        migrantsPerHour: rng.range(4, 9),
        tunnelScale: rng.range(0.8, 1.3),
        bossHours: rng.range(0.25, 0.5),
        pause: rng.range(0.08, 0.25),
        idle: rng.range(0.1, 0.45),
      };
      const r = this.run(mode, bh);
      totals.push(r.total);
      r.tiers.forEach((t, k) => (perTier[k] = (perTier[k] ?? 0) + t.realHours / n));
    }
    totals.sort((a, b) => a - b);
    return { totals, perTier };
  }
}

export function percentile(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]!;
}
