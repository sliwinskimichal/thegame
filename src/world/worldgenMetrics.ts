/**
 * Acceptance metrics of the world generator 2.0 (F2-2 -> M2). Each function reads a generated `World`, the
 * generator's biome map and layout record, and the spec (`src/content/worldgen.ts`); nothing is mutated.
 * Used by the generator's guarantee pass, the 10-seed tournament (docs/variants/) and QA; thresholds live
 * in `ACCEPTANCE`. Rationale: docs/design/levels/WORLDGEN.md §5.
 *
 * Connectivity is measured with the game's own navigation (`NavGrid` + `HpaStar`, dwarf profile), so the
 * generator and the game agree on what "reachable" means (gravity, step 1, safe drop CONFIG.maxSafeDrop,
 * ladders and stairs of the generator's infrastructure layer). The roof check is the formula of
 * `StructureSystem` (src/sim/structure.ts) without supports: what it flags would start collapsing at once.
 */
import { BIOMES } from '../content/biomes';
import { DEPOSITS, ROCK_PICK_TIER } from '../content/sources';
import { ROCK_STRENGTH, STRUCTURE } from '../content/structure';
import type { BiomeId, HazardId } from '../content/types';
import {
  ACCEPTANCE, BANDS, DEPOSIT_RULES, HARD_GATES, HUB_SAFE_RADIUS, LAIRS, LANDMARKS, MOTHER_LODE, RISK, START,
  WORLD_FRAME, type Side,
} from '../content/worldgen';
import { DWARF, HpaStar, MV, NAV, NavGrid, Path } from '../sim/nav';
import { MATERIALS, SOLID } from './materials';
import { CAV, FLUID, type World } from './world';
import { bandCore, BIOME_INDEX, depthOfRow, rowOfDepth } from './worldgenRules';

// =====================================================================================================
// Generator output contract
// =====================================================================================================

/** Biome map value of tiles that belong to no biome (sky, the Gorge shaft and walls, the bedrock floor). */
export const NO_BIOME = 255;

/** Inclusive tile rectangle. */
export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Where the generator put things (what the metrics, the gameplay and the tutorial script need). */
export interface WorldgenLayout {
  /** Feet cell of the wagon (standable on the pad). */
  wagon: { x: number; y: number };
  /** A standable floor cell inside each hub landmark. */
  hubs: readonly { biome: BiomeId; landmark: string; x: number; y: number }[];
  /** Tiles of each window plug (or sung lock) in the Gorge wall. */
  windows: readonly { biome: BiomeId; side: Side; plug: Rect }[];
  seals: readonly { id: string; rect: Rect }[];
  landmarks: readonly { id: string; rect: Rect }[];
  hazardCores: readonly { hazard: HazardId; biome: BiomeId; x: number; y: number; r: number }[];
  motherLodes: readonly { deposit: string; biome: BiomeId; x: number; y: number; tiles: number }[];
  lairs: readonly { creature: string; x: number; y: number }[];
  spawns: readonly { creature: string; x: number; y: number }[];
  /** Harvestable content objects (OBJECTS ids). */
  objects: readonly { id: string; x: number; y: number }[];
  /** Areas exempt from the start rules (the old shaft of the tutorial). */
  scripted: readonly Rect[];
}

export interface WorldgenResult {
  world: World;
  /** Biome index (BIOMES order) of every tile, NO_BIOME where none. */
  biome: Uint8Array;
  layout: WorldgenLayout;
  /** Generator infrastructure for navigation (`INFRA` codes per tile: ruined stairs, ladders, platforms). */
  infra: Uint8Array;
}

const inRect = (r: Rect, x: number, y: number): boolean => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
const dist = (ax: number, ay: number, bx: number, by: number): number => Math.hypot(ax - bx, ay - by);
const NB = BIOMES.length;

// =====================================================================================================
// 1. Deposits: census, coverage, densities
// =====================================================================================================

export interface DepositCensus {
  /** Solid tiles per biome index. */
  solid: Int32Array;
  /** Deposit tiles per deposit id and biome index. */
  tiles: Map<string, Int32Array>;
  /** Veins (4-connected bodies of one deposit inside one biome) of at least ACCEPTANCE.minVein tiles. */
  veins: Map<string, Int32Array>;
  /** Largest vein per deposit and biome. */
  largest: Map<string, Int32Array>;
}

/** Count solid and deposit tiles per biome and the veins of every deposit (one pass + flood fills). */
export function depositCensus(world: World, biome: Uint8Array, minVein: number = ACCEPTANCE.minVein): DepositCensus {
  const { w, h, mat } = world;
  const n = w * h;
  const solid = new Int32Array(NB);
  const tiles = new Map<string, Int32Array>();
  const veins = new Map<string, Int32Array>();
  const largest = new Map<string, Int32Array>();
  for (const d of DEPOSITS) {
    tiles.set(d.id, new Int32Array(NB));
    veins.set(d.id, new Int32Array(NB));
    largest.set(d.id, new Int32Array(NB));
  }
  const depOf: (string | undefined)[] = MATERIALS.map((m) => m.deposit);
  const seen = new Uint8Array(n);
  const stack = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const b = biome[i]!;
    const m = mat[i]!;
    if (b >= NB || !SOLID[m]) continue;
    solid[b]++;
    const dep = depOf[m];
    if (!dep) continue;
    tiles.get(dep)![b]++;
    if (seen[i]) continue;
    // flood the vein: same material, same biome, 4-neighbourhood
    let top = 0;
    let size = 0;
    stack[top++] = i;
    seen[i] = 1;
    while (top > 0) {
      const c = stack[--top]!;
      size++;
      const x = c % w;
      for (let s4 = 0; s4 < 4; s4++) {
        const q = s4 === 0 ? (x > 0 ? c - 1 : -1) : s4 === 1 ? (x < w - 1 ? c + 1 : -1) : s4 === 2 ? c - w : c + w;
        if (q < 0 || q >= n || seen[q] || mat[q] !== m || biome[q] !== b) continue;
        seen[q] = 1;
        stack[top++] = q;
      }
    }
    if (size >= minVein) veins.get(dep)![b]++;
    const L = largest.get(dep)!;
    if (size > L[b]!) L[b] = size;
  }
  return { solid, tiles, veins, largest };
}

/** Deposit-biome pairs of the spec without a single vein (target: none, on every seed). */
export function depositCoverage(c: DepositCensus): { ratio: number; missing: string[] } {
  const missing: string[] = [];
  let total = 0;
  for (const band of BANDS)
    for (const r of DEPOSIT_RULES[band.biome]) {
      total++;
      if (!c.veins.get(r.deposit)![BIOME_INDEX.get(band.biome)!]) missing.push(`${r.deposit}@${band.biome}`);
    }
  return { ratio: total ? (total - missing.length) / total : 1, missing };
}

export interface DensityRow {
  biome: BiomeId;
  deposit: string;
  target: number;
  actual: number;
  ok: boolean;
}

/** Density per biome and deposit (per mille of the biome's solid tiles) against DEPOSIT_RULES +- tolerance. */
export function depositDensities(c: DepositCensus, tol: number = ACCEPTANCE.densityTolerance): DensityRow[] {
  const out: DensityRow[] = [];
  for (const band of BANDS) {
    const k = BIOME_INDEX.get(band.biome)!;
    for (const r of DEPOSIT_RULES[band.biome]) {
      const actual = c.solid[k]! > 0 ? (1000 * c.tiles.get(r.deposit)![k]!) / c.solid[k]! : 0;
      out.push({ biome: band.biome, deposit: r.deposit, target: r.density, actual, ok: Math.abs(actual - r.density) <= tol * r.density });
    }
  }
  return out;
}

// =====================================================================================================
// 2. Voids, roofs, fluids
// =====================================================================================================

export interface VoidRow {
  biome: BiomeId;
  share: number;
  range: readonly [number, number];
  ok: boolean;
}

/** Share of open tiles (fluids included, sky excluded) per biome, against BANDS[].caves.voidShare. */
export function voidShares(world: World, biome: Uint8Array): VoidRow[] {
  const open = new Int32Array(NB);
  const all = new Int32Array(NB);
  for (let i = 0; i < world.size; i++) {
    const b = biome[i]!;
    if (b >= NB) continue;
    all[b]++;
    if (!SOLID[world.mat[i]!] && world.cav[i] !== CAV.SKY) open[b]++;
  }
  return BANDS.map((band, k) => {
    const share = all[k]! ? open[k]! / all[k]! : 0;
    return { biome: band.biome, share, range: band.caves.voidShare, ok: share >= band.caves.voidShare[0] && share <= band.caves.voidShare[1] };
  });
}

const HALF_SPAN = new Float64Array(256);
for (const m of MATERIALS) if (m.solid) HALF_SPAN[m.id] = (ROCK_STRENGTH[m.key]?.maxSpan ?? Infinity) / 2;

export interface RoofReport {
  failures: number;
  /** First failing roof tiles (x, y, load, capacity), at most 32. */
  first: { x: number; y: number; d: number; cap: number }[];
}

/**
 * Roof tiles that the structure model would start to collapse at the first tick: for every open row r, each
 * run of open tiles bounded by solid tiles (or the border); a solid tile above the run carries d = distance
 * to the nearest end of the run and holds while d <= floor(maxSpan/2 x 2.5 (natural or sky) x 2 (open
 * height <= 2)). No supports exist at generation time.
 */
export function roofCheck(world: World): RoofReport {
  const { w, h, mat, cav } = world;
  const lim = STRUCTURE.lowRoof.maxHeight;
  const first: RoofReport['first'] = [];
  let failures = 0;
  for (let r = 1; r < h; r++) {
    const row = r * w;
    const above = row - w;
    let x = 0;
    while (x < w) {
      if (SOLID[mat[row + x]!]) {
        x++;
        continue;
      }
      const a = x;
      while (x < w && !SOLID[mat[row + x]!]) x++;
      const b = x - 1;
      for (let k = a; k <= b; k++) {
        const ci = above + k;
        const m = mat[ci]!;
        if (!SOLID[m]) continue;
        const half = HALF_SPAN[m]!;
        if (half === Infinity) continue;
        const oi = row + k;
        let mul = 1;
        const cv = cav[oi]!;
        if (cv === CAV.NATURAL || cv === CAV.SKY) mul *= STRUCTURE.naturalSpanMul;
        let hgt = 0;
        for (let j = oi; hgt <= lim && j < world.size && !SOLID[mat[j]!]; j += w) hgt++;
        if (hgt <= lim) mul *= STRUCTURE.lowRoof.spanMul;
        const cap = Math.max(1, Math.floor(half * mul));
        const d = Math.min(k - a + 1, b - k + 1);
        if (d > cap) {
          failures++;
          if (first.length < 32) first.push({ x: k, y: r - 1, d, cap });
        }
      }
    }
  }
  return { failures, first };
}

export interface FluidReport {
  /** Fluid stored in a solid tile. */
  inSolid: number;
  /** Fluid resting on an open tile that is not full of the same fluid (it would fall at once). */
  floating: number;
  /** Lava touching water (they would turn into obsidian on the first tick). */
  lavaWater: number;
}

/** Static fluid sanity of a fresh world (QUALITY E3: no floating fluid tiles). */
export function fluidCheck(world: World): FluidReport {
  const { w, h, mat, fluid, fluidKind } = world;
  let inSolid = 0;
  let floating = 0;
  let lavaWater = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!fluid[i]) continue;
      if (SOLID[mat[i]!]) {
        inSolid++;
        continue;
      }
      const k = fluidKind[i]!;
      if (y + 1 < h) {
        const j = i + w;
        if (!SOLID[mat[j]!] && !(fluid[j] === 255 && fluidKind[j] === k)) floating++;
      }
      if (k === FLUID.LAVA)
        for (let s4 = 0; s4 < 4; s4++) {
          const q = s4 === 0 ? (x > 0 ? i - 1 : -1) : s4 === 1 ? (x < w - 1 ? i + 1 : -1) : s4 === 2 ? (y > 0 ? i - w : -1) : y + 1 < h ? i + w : -1;
          if (q >= 0 && fluid[q]! > 0 && fluidKind[q] === FLUID.WATER) lavaWater++;
        }
    }
  return { inSolid, floating, lavaWater };
}

// =====================================================================================================
// 3. Start and tutorial
// =====================================================================================================

/** Start rules of START (pad, safe camp zone, first resources within reach, tutorial hall). Empty = pass. */
export function startCheck(res: WorldgenResult): string[] {
  const { world, layout } = res;
  const out: string[] = [];
  const plain = WORLD_FRAME.plainRow;
  const [p0, p1] = START.pad.x;
  for (let x = p0; x <= p1; x++) if (world.surface[x] !== plain) out.push(`pad: column ${x} surface row ${world.surface[x]} != ${plain}`);
  const { x: wx, y: wy } = layout.wagon;
  if (wx < p0 || wx > p1 || wy !== plain - 1) out.push(`wagon (${wx}, ${wy}) is not standing on the pad`);
  // no open tile under the camp zone down to noCavesDepth (scripted areas excepted)
  const [c0, c1] = START.campZone.x;
  const bottom = rowOfDepth(START.campZone.noCavesDepth);
  for (let x = c0; x <= c1; x++)
    for (let y = Math.max(0, world.surface[x]!); y <= bottom; y++) {
      const i = world.idx(x, y);
      if (!SOLID[world.mat[i]!] && world.cav[i] !== CAV.SKY && !layout.scripted.some((r) => inRect(r, x, y))) {
        out.push(`camp zone: open tile (${x}, ${y})`);
        break;
      }
    }
  // first resources within reach of the wagon
  const matOf = new Map(MATERIALS.filter((m) => m.deposit).map((m) => [m.deposit!, m.id]));
  for (const r of START.reach) {
    let n = 0;
    if (r.kind === 'object') {
      for (const o of layout.objects) if (o.id === r.what && dist(o.x, o.y, wx, wy) <= r.maxDist) n++;
    } else {
      const id = matOf.get(r.what)!;
      const R = r.maxDist;
      for (let y = Math.max(0, wy - R); y <= Math.min(world.h - 1, wy + R); y++)
        for (let x = Math.max(0, wx - R); x <= Math.min(world.w - 1, wx + R); x++)
          if (world.mat[world.idx(x, y)] === id && dist(x, y, wx, wy) <= R) n++;
    }
    if (n < r.minCount) out.push(`reach: ${r.what} ${n} < ${r.minCount} within ${r.maxDist}`);
  }
  // the tutorial copper vein shows in the slope: close under the local surface
  const cu = matOf.get('copper_vein')!;
  let outcrop = 0;
  for (let x = 0; x < world.w; x++)
    for (let y = world.surface[x]!; y >= 0 && y < world.surface[x]! + START.copperOutcrop.maxDepthUnderSurface && y < world.h; y++)
      if (world.mat[world.idx(x, y)] === cu) outcrop++;
  if (outcrop < START.copperOutcrop.minTiles) out.push(`copper outcrop: ${outcrop} < ${START.copperOutcrop.minTiles} tiles near the surface`);
  // the cave-in hall: size, floor depth, settled natural cavity
  const hall = layout.landmarks.find((l) => l.id === START.tutorialHall.landmark);
  if (!hall) out.push('tutorial hall missing');
  else {
    const [hw, hh] = START.tutorialHall.size;
    if (hall.rect.x1 - hall.rect.x0 + 1 !== hw || hall.rect.y1 - hall.rect.y0 + 1 !== hh) out.push('tutorial hall: wrong size');
    if (depthOfRow(hall.rect.y1) !== START.tutorialHall.floorDepth - 1) out.push('tutorial hall: wrong floor depth');
    for (let y = hall.rect.y0; y <= hall.rect.y1; y++)
      for (let x = hall.rect.x0; x <= hall.rect.x1; x++) {
        const i = world.idx(x, y);
        if (SOLID[world.mat[i]!] || world.cav[i] !== CAV.NATURAL) {
          out.push(`tutorial hall: tile (${x}, ${y}) is not a settled natural void`);
          y = hall.rect.y1 + 1;
          break;
        }
      }
  }
  return out;
}

// =====================================================================================================
// 4. Navigation: hub -> Gorge with the game's NavGrid + HPA*
// =====================================================================================================

export interface GorgeAccessRow {
  biome: BiomeId;
  /** NAV status of hub -> window (FOUND required). */
  status: number;
  /** Travel time of the path, ms (dwarf profile). */
  cost: number;
  nodes: number;
  /** Drops of 2+ rows on the path: one-way edges (the way back needs a ladder). */
  oneWayDrops: number;
  /** Is there a way back (window -> hub) without new infrastructure? */
  back: boolean;
}

/** Standable cells right outside the biome-side face of a window plug (goals of the hub -> Gorge query). */
export function windowGoals(grid: NavGrid, plug: Rect, side: Side): number[] {
  const x = side === 'W' ? plug.x0 - 1 : plug.x1 + 1;
  const out: number[] = [];
  if (x < 0 || x >= grid.w) return out;
  for (let y = plug.y0; y <= Math.min(grid.h - 1, plug.y1 + 1); y++) if (grid.standable(0, grid.idx(x, y))) out.push(grid.idx(x, y));
  return out;
}

/**
 * For every biome with a hub (but the surface camp): can a dwarf walk from the hub to the inner face of
 * the hub-side window, in the world as generated plus the generator's infrastructure? Uses NavGrid and
 * HPA* 16x16 exactly as the game does.
 */
export function gorgeAccess(res: WorldgenResult): GorgeAccessRow[] {
  const grid = new NavGrid(res.world, { profiles: [DWARF], infra: res.infra });
  const finder = new HpaStar(grid, 0, { cluster: 16 });
  const path = new Path();
  const out: GorgeAccessRow[] = [];
  for (const hub of res.layout.hubs) {
    if (hub.biome === 'foothills') continue;
    const side = LANDMARKS.find((l) => l.id === hub.landmark)?.side;
    const win = res.layout.windows.find((wd) => wd.biome === hub.biome && wd.side === side) ?? res.layout.windows.find((wd) => wd.biome === hub.biome);
    const row: GorgeAccessRow = { biome: hub.biome, status: NAV.INVALID_GOAL, cost: 0, nodes: 0, oneWayDrops: 0, back: false };
    out.push(row);
    if (!win) continue;
    const goals = windowGoals(grid, win.plug, win.side);
    if (!goals.length) continue;
    const start = grid.idx(hub.x, hub.y);
    row.status = finder.find(start, goals, path);
    if (row.status !== NAV.FOUND) continue;
    row.cost = path.cost;
    row.nodes = path.length;
    for (let k = 1; k < path.length; k++) {
      const mv = path.moves[k]!;
      if (mv !== MV.DROP_L && mv !== MV.DROP_R && mv !== MV.FALL) continue;
      const dy = Math.floor(path.cells[k]! / grid.w) - Math.floor(path.cells[k - 1]! / grid.w);
      if (dy >= 2) row.oneWayDrops++;
    }
    row.back = finder.find(path.last(), [start], path) === NAV.FOUND;
  }
  finder.dispose();
  return out;
}

export interface NavStats {
  /** Standable cells for the dwarf profile (graph nodes; ai-programmer's benchmark: 10.4 k in a dense town). */
  nodes: number;
  /** Tiles with generator infrastructure (ladders, stairs, platforms). */
  infraTiles: number;
}

/** Size of the navigation graph of a fresh world (ACCEPTANCE.navNodes). */
export function navStats(res: WorldgenResult): NavStats {
  const grid = new NavGrid(res.world, { profiles: [DWARF], infra: res.infra });
  let nodes = 0;
  for (let i = 0; i < grid.n; i++) if (grid.standable(0, i)) nodes++;
  let infraTiles = 0;
  for (let i = 0; i < res.infra.length; i++) if (res.infra[i]) infraTiles++;
  return { nodes, infraTiles };
}

// =====================================================================================================
// 5. Hard gates and risk-reward placement
// =====================================================================================================

export interface GateRow {
  biome: BiomeId;
  /** Pick tier of the biome's rock. */
  tier: number;
  /** Core tiles of the biome reached from the wagon digging only rock below that tier (target 0). */
  leaked: number;
}

/**
 * Pick-tier gates hold: from the wagon, through open tiles (no lava) and solid tiles of a lower pick tier,
 * no tile of the biome's core is reachable (flood fill: digging makes gravity irrelevant).
 */
export function gateIntegrity(res: WorldgenResult): GateRow[] {
  const { world, biome, layout } = res;
  const { w, h, mat, fluid, fluidKind } = world;
  const n = w * h;
  const tierOf = new Uint8Array(256);
  for (const m of MATERIALS) tierOf[m.id] = Math.min(255, m.tier);
  const seen = new Uint8Array(n);
  const stack = new Int32Array(n);
  const out: GateRow[] = [];
  for (const g of HARD_GATES) {
    if (g.kind !== 'pickTier') continue;
    const k = BIOME_INDEX.get(g.biome)!;
    const T = ROCK_PICK_TIER[g.biome]!;
    const coreRow = rowOfDepth(bandCore(k)[0]);
    seen.fill(0);
    let top = 0;
    let leaked = 0;
    const s = layout.wagon.y * w + layout.wagon.x;
    stack[top++] = s;
    seen[s] = 1;
    while (top > 0) {
      const c = stack[--top]!;
      if (biome[c] === k && Math.floor(c / w) >= coreRow) leaked++;
      const x = c % w;
      for (let s4 = 0; s4 < 4; s4++) {
        const q = s4 === 0 ? (x > 0 ? c - 1 : -1) : s4 === 1 ? (x < w - 1 ? c + 1 : -1) : s4 === 2 ? c - w : c + w;
        if (q < 0 || q >= n || seen[q]) continue;
        const m = mat[q]!;
        const pass = SOLID[m] ? tierOf[m]! < T : !(fluidKind[q] === FLUID.LAVA && fluid[q]! > 0);
        if (!pass) continue;
        seen[q] = 1;
        stack[top++] = q;
      }
    }
    out.push({ biome: g.biome, tier: T, leaked });
  }
  return out;
}

/** R1, R3-like distance rules around hubs, hazard cores, lairs and spawns. Empty = pass. */
export function placementCheck(res: WorldgenResult): string[] {
  const { world, biome, layout } = res;
  const out: string[] = [];
  const hubOf = new Map(layout.hubs.map((hb) => [hb.biome, hb]));
  // strategic deposits keep their distance from the hub of their biome
  const strategic = BANDS.map(() => new Uint8Array(256)); // [biome][material] = 1 for strategic deposits
  for (const band of BANDS)
    for (const r of DEPOSIT_RULES[band.biome])
      if (r.cls === 'strategic') strategic[BIOME_INDEX.get(band.biome)!]![MATERIALS.find((x) => x.deposit === r.deposit)!.id] = 1;
  for (const hub of layout.hubs) {
    const k = BIOME_INDEX.get(hub.biome)!;
    const R = RISK.strategicMinFromHub;
    for (let y = Math.max(0, hub.y - R); y <= Math.min(world.h - 1, hub.y + R); y++)
      for (let x = Math.max(0, hub.x - R); x <= Math.min(world.w - 1, hub.x + R); x++) {
        const i = world.idx(x, y);
        if (biome[i] === k && strategic[k]![world.mat[i]!] && dist(x, y, hub.x, hub.y) < R && hub.biome !== 'foothills') {
          out.push(`strategic ${MATERIALS[world.mat[i]!]!.key} ${dist(x, y, hub.x, hub.y).toFixed(1)} from the ${hub.biome} hub`);
          y = world.h;
          break;
        }
      }
  }
  // R1: mother lodes inside hazard zones, away from the hub
  for (const ml of layout.motherLodes) {
    const near = layout.hazardCores.filter((c) => c.biome === ml.biome).some((c) => dist(c.x, c.y, ml.x, ml.y) <= MOTHER_LODE.maxFromHazard);
    if (!near) out.push(`mother lode ${ml.deposit}@${ml.biome} outside every hazard zone`);
    const hub = hubOf.get(ml.biome);
    if (hub && dist(hub.x, hub.y, ml.x, ml.y) < MOTHER_LODE.minFromHub) out.push(`mother lode ${ml.deposit}@${ml.biome} too close to the hub`);
  }
  // lairs away from hubs, spawns outside the safe radius and the camp zone
  for (const l of layout.lairs) {
    const spec = LAIRS.find((x) => x.creature === l.creature);
    const hub = spec && hubOf.get(spec.biome);
    if (spec && hub && dist(hub.x, hub.y, l.x, l.y) < spec.minFromHub) out.push(`lair ${l.creature} ${dist(hub.x, hub.y, l.x, l.y).toFixed(0)} < ${spec.minFromHub} from the hub`);
  }
  for (const s of layout.spawns) {
    for (const hub of layout.hubs)
      if (dist(hub.x, hub.y, s.x, s.y) < HUB_SAFE_RADIUS) out.push(`spawn ${s.creature} inside the safe radius of the ${hub.biome} hub`);
    if (s.x >= START.campZone.x[0] && s.x <= START.campZone.x[1] && s.y < rowOfDepth(START.campZone.noCavesDepth)) out.push(`spawn ${s.creature} in the camp zone`);
  }
  // the Gorge keeps its seals solid and unbreakable
  for (const s of layout.seals)
    for (let y = s.rect.y0; y <= s.rect.y1; y++)
      for (let x = s.rect.x0; x <= s.rect.x1; x++) {
        const m = MATERIALS[world.mat[world.idx(x, y)]!]!;
        if (m.tier < 9) {
          out.push(`seal ${s.id}: breakable tile (${x}, ${y})`);
          y = s.rect.y1 + 1;
          break;
        }
      }
  return out;
}

// =====================================================================================================
// 6. Determinism and the full report
// =====================================================================================================

/** FNV-1a over material, cavity and fluid layers (two seeds differ, one seed twice is equal). */
export function worldHash(world: World): number {
  let hsh = 0x811c9dc5;
  const mix = (a: Uint8Array): void => {
    for (let i = 0; i < a.length; i++) hsh = Math.imul(hsh ^ a[i]!, 0x01000193);
  };
  mix(world.mat);
  mix(world.cav);
  mix(world.fluid);
  mix(world.fluidKind);
  return hsh >>> 0;
}

export interface WorldgenReport {
  pass: boolean;
  coverage: { ratio: number; missing: string[] };
  densities: DensityRow[];
  voids: VoidRow[];
  roofs: RoofReport;
  fluids: FluidReport;
  start: string[];
  gorge: GorgeAccessRow[];
  gates: GateRow[];
  placement: string[];
  nav: NavStats;
  hash: number;
}

/** Every acceptance metric of a generated world against ACCEPTANCE (one seed of the tournament). */
export function evaluateWorld(res: WorldgenResult): WorldgenReport {
  const census = depositCensus(res.world, res.biome);
  const coverage = depositCoverage(census);
  const densities = depositDensities(census);
  const voids = voidShares(res.world, res.biome);
  const roofs = roofCheck(res.world);
  const fluids = fluidCheck(res.world);
  const start = startCheck(res);
  const gorge = gorgeAccess(res);
  const gates = gateIntegrity(res);
  const placement = placementCheck(res);
  const nav = navStats(res);
  const pass =
    coverage.ratio >= ACCEPTANCE.coverage &&
    densities.every((d) => d.ok) &&
    voids.every((v) => v.ok) &&
    roofs.failures <= ACCEPTANCE.roofFailures &&
    fluids.inSolid + fluids.floating + fluids.lavaWater <= ACCEPTANCE.fluidErrors &&
    start.length === 0 &&
    gorge.every((g) => g.status === NAV.FOUND) &&
    gates.every((g) => g.leaked === 0) &&
    placement.length === 0 &&
    nav.nodes >= ACCEPTANCE.navNodes[0] &&
    nav.nodes <= ACCEPTANCE.navNodes[1];
  return { pass, coverage, densities, voids, roofs, fluids, start, gorge, gates, placement, nav, hash: worldHash(res.world) };
}
