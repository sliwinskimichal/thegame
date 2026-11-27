/**
 * Derived rules of the world generator 2.0 (F2-2): quantities computed from the spec
 * (`src/content/worldgen.ts`) and the content bible, shared by the generator (M2), its acceptance
 * metrics (`worldgenMetrics.ts`) and the data tests. Nothing here holds a tuning number of its own.
 */
import { BIOMES } from '../content/biomes';
import { DEPOSITS } from '../content/sources';
import { ROCK_STRENGTH, STRUCTURE } from '../content/structure';
import type { BiomeId } from '../content/types';
import {
  BANDS, DEPOSIT_RULES, GORGE, SURFACE, WORLD_FRAME,
  type BiomeBand, type CaveForm, type DepositRule, type Range,
} from '../content/worldgen';
import type { Rng } from '../core/rng';

// ------------------------------------------------------------------ frame

/** World row of a depth below the plain. */
export const rowOfDepth = (d: number): number => WORLD_FRAME.plainRow + d;
/** Depth below the plain of a world row. */
export const depthOfRow = (y: number): number => y - WORLD_FRAME.plainRow;

export const BIOME_INDEX: ReadonlyMap<BiomeId, number> = new Map(BIOMES.map((b, k) => [b.id, k]));
export const bandOf = (biome: BiomeId): BiomeBand => BANDS[BIOME_INDEX.get(biome)!]!;

// ------------------------------------------------------------------ roofs (structure model)

/**
 * Roof capacity of a rock (largest load distance d that holds), the formula of
 * `StructureSystem.capacity` without supports: floor(maxSpan/2 x naturalSpanMul (natural) x lowRoof.spanMul (low)).
 */
export function roofCapacity(rockKey: string, natural: boolean, low: boolean): number {
  const rs = ROCK_STRENGTH[rockKey];
  if (!rs) throw new Error(`no ROCK_STRENGTH for ${rockKey}`);
  const half = rs.maxSpan / 2;
  if (half === Infinity) return Infinity;
  let mul = 1;
  if (natural) mul *= STRUCTURE.naturalSpanMul;
  if (low) mul *= STRUCTURE.lowRoof.spanMul;
  return Math.max(1, Math.floor(half * mul));
}

/** Widest open run under a flat roof that holds (the centre tile carries d = run / 2). */
export const maxFlatRun = (rockKey: string, natural: boolean, low: boolean): number => 2 * roofCapacity(rockKey, natural, low);

/** Load distance under the crown of a half-ellipse vault w wide and h tall (one row below the crown). */
export const vaultCrownLoad = (w: number, h: number): number => (w / 2) * Math.sqrt(2 / h);

export interface FormRoofCheck {
  ok: boolean;
  /** Load distance the widest instance of the form puts on its roof. */
  load: number;
  /** Capacity of its roof rock (natural cavity). */
  cap: number;
}

/** Does the largest instance of a natural cave form hold under the structure model at generation time? */
export function formRoof(band: BiomeBand, form: CaveForm): FormRoofCheck {
  const rock = form.roofRock ?? band.roofRock;
  const w = form.vaultW ? form.vaultW[1] : form.w[1];
  const hMin = form.h[0];
  const low = form.h[1] <= STRUCTURE.lowRoof.maxHeight;
  if (form.roof === 'vault') {
    const cap = roofCapacity(rock, true, false);
    const load = vaultCrownLoad(w, hMin);
    return { ok: load <= cap, load, cap };
  }
  const cap = roofCapacity(rock, true, low);
  // squeezed passages: rows break at alternating pinches and bumps, `squeezeEvery` apart
  const load = form.squeezeEvery ? form.squeezeEvery : Math.ceil(w / 2);
  return { ok: load <= cap, load, cap };
}

// ------------------------------------------------------------------ band boundaries

/** Worst-case shift (tiles) of the top boundary of biome k: undulation, half the dip range, half the transition. */
export function topShift(k: number): number {
  const b = BANDS[k];
  if (!b || k === 0) return 0;
  return b.undulation.amp + b.dipMax / 2 + b.transition / 2;
}

/** Nominal depth band of biome k (from the content bible). */
export const nominal = (k: number): Range => BIOMES[k]!.depth;

/** Thinnest the band of biome k can get on any column (both boundaries at their worst). */
export function minThickness(k: number): number {
  const [d0, d1] = nominal(k);
  return d1 - d0 - topShift(k) - topShift(k + 1);
}

/**
 * Depth range that belongs to biome k on every column of every seed (below the top boundary's worst
 * case and the cave-free cap, above the next boundary's worst case): windows, hubs and lairs go here.
 */
export function bandCore(k: number): Range {
  const [d0, d1] = nominal(k);
  return [d0 + topShift(k), d1 - topShift(k + 1)];
}

// ------------------------------------------------------------------ the Gorge

export interface GorgeSegment {
  /** Depth range of the open shaft between two seals (or the crater plug / the Heart). */
  from: number;
  to: number;
  /** Seal at the bottom of the segment ('' for the last one). */
  sealBelow: string;
}

/** Shaft segments between seals, top to bottom. */
export function gorgeSegments(): GorgeSegment[] {
  const out: GorgeSegment[] = [];
  let top = GORGE.depth[0];
  for (const s of GORGE.seals) {
    out.push({ from: top, to: s.depth, sealBelow: s.id });
    top = s.depth + s.thickness;
  }
  out.push({ from: top, to: GORGE.depth[1], sealBelow: '' });
  return out;
}

/** Index of the shaft segment that contains depth d (-1 inside a seal or outside the shaft). */
export function segmentOf(d: number): number {
  const segs = gorgeSegments();
  return segs.findIndex((s) => d >= s.from && d < s.to);
}

// ------------------------------------------------------------------ deposits

/** Weighted pick that tolerates an empty table (the Heart has no deposits): null instead of a throw. */
export function weightedOrNull<T>(rng: Rng, entries: readonly (readonly [T, number])[]): T | null {
  let total = 0;
  for (const e of entries) total += e[1];
  return entries.length === 0 || !(total > 0) ? null : rng.weighted(entries);
}

/** Weighted table of the deposit rules of a biome (weight = density); empty for NO_DEPOSIT_BIOMES. */
export const depositTable = (biome: BiomeId): (readonly [DepositRule, number])[] =>
  DEPOSIT_RULES[biome].map((r) => [r, r.density] as const);

// ------------------------------------------------------------------ area and supply estimates

/** Open width of a biome row outside the Gorge (shaft at its widest and both walls). */
const rowWidthOutsideGorge = (): number => WORLD_FRAME.w - GORGE.width[1] - 2 * GORGE.wall.thickness;

/**
 * Tiles of a biome band, estimated from the frame: nominal depth span x row width outside the Gorge, plus
 * the mountain for the Limestone Ledges (uplifted strata under the soil skin) and the skin for the Foothills.
 */
export function bandArea(biome: BiomeId): number {
  const k = BIOME_INDEX.get(biome)!;
  const [d0, d1] = nominal(k);
  const W = rowWidthOutsideGorge();
  const m = SURFACE.mountain;
  const base = m.baseX[1] - m.baseX[0];
  const cone = 0.5 * base * m.rimHeight;
  if (biome === 'foothills') return (m.baseX[0] - 0) * (d1 - d0) + base * m.skin.flank;
  if (biome === 'limestone') return W * (d1 - d0) + cone - base * m.skin.flank;
  return W * (d1 - d0);
}

/** Solid tiles of a biome band (area minus the mean void share). */
export function solidEstimate(biome: BiomeId): number {
  const v = bandOf(biome).caves.voidShare;
  return bandArea(biome) * (1 - (v[0] + v[1]) / 2);
}

/** Raw units of every resource in the world at the target densities (tiles x yield per tile). */
export function supplyEstimate(): Map<string, number> {
  const out = new Map<string, number>();
  for (const d of DEPOSITS) {
    let tiles = 0;
    for (const b of d.biomes) {
      const r = DEPOSIT_RULES[b].find((x) => x.deposit === d.id);
      if (r) tiles += (r.density / 1000) * solidEstimate(b);
    }
    out.set(d.yields, (out.get(d.yields) ?? 0) + tiles * d.amount);
  }
  return out;
}
