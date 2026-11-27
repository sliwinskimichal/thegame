/**
 * Movement profiles: how a kind of body moves through the tile grid.
 *
 * These are tuning data (proposed home: `src/content/navProfiles.ts`, owned by
 * the systems designer). Costs are milliseconds of travel at the profile's
 * base speed; an agent's own speed factor scales time but never path choice.
 * Multipliers must be >= 1 so the A* heuristic stays consistent.
 */
import { CONFIG } from '../../config';
import { LINK, LINK_ALL, MV } from './types';

export type MoveKind = 'walker' | 'climber' | 'flyer';

export interface MoveCosts {
  walk: number;
  /** Step up a one-tile ledge (diagonal). */
  stepUp: number;
  /** Drop / fall: fixed part (step off + landing) ... */
  dropBase: number;
  /** ... plus this per row fallen. */
  dropPerRow: number;
  climbUp: number;
  climbDown: number;
  /** One stair (one column and one row). */
  stairUp: number;
  stairDown: number;
}

export interface MoveProfile {
  id: string;
  kind: MoveKind;
  /** Tiles of headroom needed to move upright (dwarf: 1.3 tiles tall -> 2). */
  height: number;
  /** May squeeze through lower gaps on all fours (cost x crawlMul). */
  crawl: boolean;
  /** Highest drop taken without harm, in rows (<= 15). */
  maxDrop: number;
  ladders: boolean;
  stairs: boolean;
  swim: boolean;
  lavaOk: boolean;
  /** Bit mask over `LINK` kinds the profile may ride. */
  links: number;
  /** Water level (0-255) from which a cell counts as deep (head under / afloat). */
  deepLevel: number;
  /** Water level from which wading slows the body. */
  wadeLevel: number;
  cost: MoveCosts;
  crawlMul: number;
  wadeMul: number;
  swimMul: number;
  /** Cost multiplier for walking through [wooden door, iron door, bulkhead]; 0 = impassable. */
  doorMul: readonly [number, number, number];
}

const DWARF_COST: MoveCosts = {
  walk: 400, // 2.5 tiles/s, as in the balance model (src/balance/model.ts WALK)
  stepUp: 700,
  dropBase: 300,
  dropPerRow: 250,
  climbUp: 900,
  climbDown: 600,
  stairUp: 600,
  stairDown: 500,
};

/** Walk cost (ms per tile) for a creature speed in tiles per second. */
const msPerTile = (speed: number) => Math.round(1000 / speed);

function scaled(c: MoveCosts, k: number): MoveCosts {
  return {
    walk: Math.round(c.walk * k), stepUp: Math.round(c.stepUp * k), dropBase: Math.round(c.dropBase * k),
    dropPerRow: Math.round(c.dropPerRow * k), climbUp: Math.round(c.climbUp * k), climbDown: Math.round(c.climbDown * k),
    stairUp: Math.round(c.stairUp * k), stairDown: Math.round(c.stairDown * k),
  };
}

export const DWARF: MoveProfile = {
  id: 'dwarf', kind: 'walker', height: 2, crawl: true, maxDrop: CONFIG.maxSafeDrop,
  ladders: true, stairs: true, swim: false, lavaOk: false, links: LINK_ALL,
  deepLevel: 128, wadeLevel: 48, cost: DWARF_COST,
  crawlMul: 2.5, wadeMul: 1.6, swimMul: 2.2, doorMul: [1.5, 1.5, 2],
};

/** Dwarf wearing a diving helmet (Sunken Deep). Breath limits are checked by the agent. */
export const DWARF_DIVER: MoveProfile = { ...DWARF, id: 'dwarf_diver', swim: true };

/** Small, light-shy raider: squeezes through 1-tile gaps, bashes wooden doors, no lifts. */
export const GOBLIN: MoveProfile = {
  id: 'goblin', kind: 'walker', height: 1, crawl: false, maxDrop: 4,
  ladders: true, stairs: true, swim: false, lavaOk: false, links: 1 << LINK.ROPE,
  deepLevel: 128, wadeLevel: 48, cost: scaled(DWARF_COST, msPerTile(2.8) / DWARF_COST.walk),
  crawlMul: 1, wadeMul: 1.6, swimMul: 2.2, doorMul: [8, 0, 0],
};

/** Heavy brute: no ladders or ropes, smashes doors, never crawls. */
export const TROLL: MoveProfile = {
  id: 'troll', kind: 'walker', height: 2, crawl: false, maxDrop: 2,
  ladders: false, stairs: true, swim: false, lavaOk: false, links: 0,
  deepLevel: 160, wadeLevel: 64, cost: scaled(DWARF_COST, msPerTile(2.4) / DWARF_COST.walk),
  crawlMul: 1, wadeMul: 1.3, swimMul: 2, doorMul: [4, 12, 0],
};

/** Four-legged hunter: walks and jumps down, cannot climb. */
export const WOLF: MoveProfile = {
  id: 'wolf', kind: 'walker', height: 1, crawl: false, maxDrop: 3,
  ladders: false, stairs: true, swim: false, lavaOk: false, links: 0,
  deepLevel: 128, wadeLevel: 48, cost: scaled(DWARF_COST, msPerTile(3.2) / DWARF_COST.walk),
  crawlMul: 1, wadeMul: 1.6, swimMul: 2.2, doorMul: [0, 0, 0],
};

/** Wall and ceiling crawler (spiders, crawlers): clings to any rock face. */
export const SPIDER: MoveProfile = {
  id: 'spider', kind: 'climber', height: 1, crawl: false, maxDrop: 6,
  ladders: true, stairs: true, swim: false, lavaOk: false, links: 0,
  deepLevel: 128, wadeLevel: 48,
  cost: { walk: msPerTile(3.4), stepUp: 420, dropBase: 200, dropPerRow: 150, climbUp: 420, climbDown: 360, stairUp: 420, stairDown: 360 },
  crawlMul: 1, wadeMul: 1.6, swimMul: 2.2, doorMul: [6, 0, 0],
};

/** Flyer (bats, moths, imps): any open cell, eight directions, no corner cutting. */
export const BAT: MoveProfile = {
  id: 'bat', kind: 'flyer', height: 1, crawl: false, maxDrop: 15,
  ladders: false, stairs: false, swim: false, lavaOk: false, links: 0,
  deepLevel: 1, wadeLevel: 255,
  cost: { walk: msPerTile(5), stepUp: 283, dropBase: 0, dropPerRow: 200, climbUp: 200, climbDown: 200, stairUp: 283, stairDown: 283 },
  crawlMul: 1, wadeMul: 1, swimMul: 1, doorMul: [0, 0, 0],
};

export const PROFILES = { DWARF, DWARF_DIVER, GOBLIN, TROLL, WOLF, SPIDER, BAT } as const;

/** Base cost of every move slot (drops and falls: the fixed part). */
export function moveBaseCosts(p: MoveProfile): Int32Array {
  const c = p.cost;
  const b = new Int32Array(14);
  b[MV.WALK_L] = b[MV.WALK_R] = c.walk;
  b[MV.STEP_UL] = b[MV.STEP_UR] = c.stepUp;
  b[MV.DROP_L] = b[MV.DROP_R] = b[MV.FALL] = c.dropBase;
  b[MV.UP] = c.climbUp;
  b[MV.DOWN] = c.climbDown;
  b[MV.STAIR_UL] = b[MV.STAIR_UR] = c.stairUp;
  b[MV.STAIR_DL] = b[MV.STAIR_DR] = c.stairDown;
  return b;
}

/**
 * Coefficients of the admissible, consistent heuristic
 *   h = a * |dx| + up * rowsUp + down * rowsDown
 * derived from the profile's cheapest moves (every move must cost at least h
 * of its own displacement). Links are folded in later by the grid.
 */
export function heuristicCoefficients(p: MoveProfile): { a: number; up: number; down: number } {
  const c = p.cost;
  // [dx, rowsUp, rowsDown, cost] of every move the profile can make (multipliers >= 1 only add cost)
  const moves: [number, number, number, number][] = [[1, 0, 0, c.walk]];
  if (p.kind === 'flyer') {
    moves.push([0, 1, 0, c.climbUp], [0, 0, 1, c.climbDown], [1, 1, 0, c.stepUp], [1, 0, 1, c.stairDown]);
  } else {
    moves.push([1, 1, 0, c.stepUp]);
    for (let k = 1; k <= p.maxDrop; k++) moves.push([1, 0, k, c.dropBase + k * c.dropPerRow]);
    if (p.ladders || p.kind === 'climber') {
      moves.push([0, 1, 0, c.climbUp], [0, 0, 1, c.climbDown]);
      for (let k = 2; k <= p.maxDrop; k++) moves.push([0, 0, k, c.dropBase + k * c.dropPerRow]);
    }
    if (p.stairs) moves.push([1, 1, 0, c.stairUp], [1, 0, 1, c.stairDown]);
    if (p.swim) moves.push([0, 1, 0, c.climbUp], [0, 0, 1, c.climbDown]);
  }
  let a = Math.floor(0.75 * c.walk);
  for (const [dx, , , cost] of moves) if (dx > 0) a = Math.min(a, Math.floor(cost / dx));
  let up = Infinity;
  let down = Infinity;
  for (const [dx, u, d, cost] of moves) {
    if (u > 0) up = Math.min(up, Math.floor((cost - a * dx) / u));
    if (d > 0) down = Math.min(down, Math.floor((cost - a * dx) / d));
  }
  // A direction the profile cannot move in on its own (links only): any bound is admissible
  // for grid moves; the link pass in the grid caps it.
  if (!Number.isFinite(up)) up = a;
  if (!Number.isFinite(down)) down = a;
  return { a: Math.max(0, a), up: Math.max(0, up), down: Math.max(0, down) };
}
