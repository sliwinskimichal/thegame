/**
 * Rock mechanics as data (F2-3): how far a roof spans without supports, how long it warns before it
 * falls, what supports do, and the digging rules the dig system needs beyond `Deposit` and
 * `MaterialInfo` (bare hands, loot of plain rock, rubble). Read by `src/sim/structure.ts` and
 * `src/sim/dig.ts`; the rules are explained in `docs/design/sim/WORLD-MUTATION.md`.
 *
 * Keys of ROCK_STRENGTH are world material keys (`MaterialInfo.key`). Proposed values: the
 * systems-designer owns the numbers (balance), checked by tests/sim/structure-data.test.ts.
 */
import type { Stack } from './types';

export interface RockStrength {
  /**
   * Widest roof (tiles, measured along the open row under it) that holds without supports. Even
   * numbers only: the model compares the distance to the nearest wall or support with maxSpan / 2,
   * so 7 behaves like 6. Infinity = never fails.
   */
  maxSpan: number;
  /** Seconds between the warning (cracks, creaking) and the collapse. */
  warnSec: number;
}

/**
 * Proposed span limits. Soft and layered rock (soil, sand, coal, shale, saltpeter, sulfur) is the
 * weakest; the Limestone Ledges (hazard `cave_ins`) teach supports at 6 tiles; granite and deeper host
 * rock carry wide halls, but factory halls of 10-20 tiles still need pillars and trusses there.
 */
export const ROCK_STRENGTH: Readonly<Record<string, RockStrength>> = {
  // T0 Foothills: a shelter in the slope up to 4 tiles wide; loose sand runs at once
  soil: { maxSpan: 4, warnSec: 15 },
  clay: { maxSpan: 4, warnSec: 20 },
  sand: { maxSpan: 2, warnSec: 8 },
  // T1 Limestone Ledges: halls wider than 6 need props (drifts up to 2 tiles high: 12, see lowRoof)
  limestone: { maxSpan: 6, warnSec: 30 },
  sandstone: { maxSpan: 6, warnSec: 30 },
  shale: { maxSpan: 4, warnSec: 25 },
  shellLimestone: { maxSpan: 6, warnSec: 30 },
  coal: { maxSpan: 4, warnSec: 20 },
  copper: { maxSpan: 8, warnSec: 30 },
  tin: { maxSpan: 8, warnSec: 30 },
  saltpeter: { maxSpan: 4, warnSec: 15 },
  // T2 Granite Roots: hard rock carries wide rooms
  granite: { maxSpan: 14, warnSec: 60 },
  slate: { maxSpan: 10, warnSec: 45 },
  iron: { maxSpan: 10, warnSec: 40 },
  galena: { maxSpan: 8, warnSec: 30 },
  sphalerite: { maxSpan: 8, warnSec: 30 },
  quartz: { maxSpan: 12, warnSec: 45 },
  // T3 Fungal Grottos
  sporeShale: { maxSpan: 6, warnSec: 30 },
  mycelium: { maxSpan: 4, warnSec: 20 },
  silver: { maxSpan: 10, warnSec: 40 },
  sulfur: { maxSpan: 4, warnSec: 15 },
  // T4 Sunken Deep: wet mudstone is weak again (wide pump halls need trusses)
  mudstone: { maxSpan: 6, warnSec: 25 },
  salt: { maxSpan: 8, warnSec: 40 },
  nickel: { maxSpan: 10, warnSec: 40 },
  gold: { maxSpan: 8, warnSec: 30 },
  // T5 Crystal Depths
  schist: { maxSpan: 10, warnSec: 45 },
  cobalt: { maxSpan: 12, warnSec: 45 },
  amethyst: { maxSpan: 10, warnSec: 40 },
  sapphire: { maxSpan: 12, warnSec: 45 },
  frostCrystal: { maxSpan: 10, warnSec: 40 },
  // T6 Magma Belt (obsidian is brittle glass)
  basalt: { maxSpan: 16, warnSec: 60 },
  magmaRock: { maxSpan: 12, warnSec: 40 },
  obsidian: { maxSpan: 10, warnSec: 30 },
  ruby: { maxSpan: 12, warnSec: 45 },
  emberite: { maxSpan: 10, warnSec: 30 },
  // T7-T8 Ancient Deep and the Heart
  deepstone: { maxSpan: 18, warnSec: 60 },
  ancientBrick: { maxSpan: 16, warnSec: 60 },
  adamantite: { maxSpan: 20, warnSec: 60 },
  runestone: { maxSpan: 16, warnSec: 60 },
  glimmerite: { maxSpan: 16, warnSec: 60 },
  heartstone: { maxSpan: 20, warnSec: 60 },
  bedrock: { maxSpan: Infinity, warnSec: 60 },
  // built masonry (a wall filled into an opening carries like weak rock)
  stoneBrick: { maxSpan: 8, warnSec: 40 },
};

/** A support placed on the floor of a column; it braces the roof of that column. */
export interface SupportSpec {
  /** Infrastructure id (`INFRASTRUCTURE` in buildings.ts). */
  id: string;
  /** Tallest column (open tiles from floor to roof) it can brace; taller = no effect. */
  maxHeight: number;
  /** Extra columns on each side it carries as if they were supported too (a truss is a beam). */
  reach: number;
  /** Keeps its strength near lava (for the heat system, not used by the roof model yet). */
  heatProof?: boolean;
}

export const SUPPORTS: readonly SupportSpec[] = [
  { id: 'wooden_prop', maxHeight: 3, reach: 0 },
  { id: 'stone_pillar', maxHeight: 6, reach: 0 },
  { id: 'iron_truss', maxHeight: 10, reach: 1 },
  { id: 'obsidian_pillar', maxHeight: 8, reach: 0, heatProof: true },
];

export const STRUCTURE = {
  /** Roofs over natural caves (and outdoor overhangs) are settled arches: span limit times this. */
  naturalSpanMul: 2.5,
  /** Low drifts carry longer roofs than halls: open height <= maxHeight multiplies the span limit. */
  lowRoof: { maxHeight: 2, spanMul: 2 },
  /** A collapse fills at most this many tiles of each failed column, from the floor up. */
  rubbleMaxRows: 8,
  /** Rubble digs this much faster than the rock it came from... */
  rubbleHardnessMul: 0.5,
  /** ...needs only this pick tier (0 = bare hands, so a rescue never waits for tools)... */
  rubbleTier: 0,
  /** ...and yields nothing (otherwise a collapse would duplicate stone). */
  rubbleLoot: null as Stack | null,
} as const;

export interface DigToolSpec {
  pickTier: number;
  workSpeed: number;
}

export const EXCAVATION = {
  /** Digging without a pick: soil, clay and sand only (the balance model's floor speed is 0.6 too). */
  hands: { pickTier: 0, workSpeed: 0.6 } as DigToolSpec,
  /** Loot of every solid material that is not a content deposit (ordinary rock yields stone). */
  plainLoot: { id: 'stone', n: 1 } as Stack,
  /** Exceptions by material key (null = no loot). A built wall gives back one of its two blocks. */
  lootByMaterial: { stoneBrick: { id: 'stone_block', n: 1 } } as Readonly<Record<string, Stack | null>>,
  /** Fraction of the work kept on a tile when its digger stops (1 = all of it, 0 = start over). */
  progressKept: 1,
  /** Progress fractions that emit a crack event (sound and cracks in the rock). */
  crackStages: [0.25, 0.5, 0.75] as readonly number[],
};
