/**
 * Events of the world-change core (F2-3): every tile mutation, digging, supports and cave-ins.
 * Delivered synchronously through `EventBus`; payloads are fresh objects, subscribers may keep them.
 * Subscribers only record and mark state - they never mutate the world inside a handler (systems
 * act in their own tick, so the order of effects stays deterministic).
 */
import type { EventBus } from '../core/events';

/** Why a tile changed. Consumers filter on it (greed counts DIG, audio plays a rumble for COLLAPSE). */
export const CAUSE = { DIG: 1, BUILD: 2, COLLAPSE: 3, FLUID: 4, SCRIPT: 5 } as const;
export type Cause = (typeof CAUSE)[keyof typeof CAUSE];

/** A tile turned solid or open (`before`/`after` are material ids; AIR = 0 means open). */
export type TileChanged = { i: number; x: number; y: number; before: number; after: number; cause: Cause };

export type SimEvents = {
  tileChanged: TileChanged;
  /** A tile became explored (fog of war); research reveals deposits from this. */
  tileRevealed: { i: number; x: number; y: number };
  /** Props (decorations) anchored to or standing in tile i were removed. */
  propsRemoved: { i: number; count: number };
  fluidChanged: { i: number; x: number; y: number; kind: number; amount: number; prevKind: number; prevAmount: number; cause: Cause };
  /** A solid fill destroyed the fluid of a tile (the fluid sim may decide to push it elsewhere). */
  fluidDisplaced: { i: number; x: number; y: number; kind: number; amount: number; cause: Cause };

  digStarted: { job: number; worker: number; x: number; y: number; mat: number };
  /** Progress crossed a crack stage (1..n of EXCAVATION.crackStages). */
  digCrack: { job: number; worker: number; x: number; y: number; stage: number };
  /** The job makes no progress; `reason` is a DIG_FAIL code, `need` the required pick tier for TIER_TOO_LOW. */
  digBlocked: { job: number; worker: number; x: number; y: number; reason: number; need: number };
  /** A blocked job can progress again (a better pick, a neighbour opened). */
  digResumed: { job: number; worker: number; x: number; y: number };
  digDone: { job: number; worker: number; x: number; y: number; mat: number };
  /** Loot of a dug tile (no item system yet: resource id and amount from content data). */
  digLoot: { x: number; y: number; mat: number; deposit: string | null; resource: string; n: number; worker: number };

  supportPlaced: { i: number; x: number; y: number; id: string };
  supportRemoved: { i: number; x: number; y: number; id: string; reason: 'removed' | 'floorLost' | 'buried' };
  /** A roof span started to fail: it falls in `ticksLeft` ticks unless supported. */
  caveInWarning: { id: number; row: number; x0: number; x1: number; tiles: number[]; ticksLeft: number };
  /** Roof tiles that were failing hold again (support placed, opening filled). */
  caveInAverted: { row: number; tiles: number[] };
  /** The roof fell: `roof` are the failed roof tiles, `filled` the tiles that became rubble. */
  caveIn: { id: number; row: number; x0: number; x1: number; roof: number[]; filled: number[] };
  /** What the rubble of cave-in `id` buried: tiles (entities in them are buried), fluid destroyed, supports and props lost. */
  buried: { id: number; tiles: number[]; water: number; lava: number; supports: number; props: number };
};

export type SimBus = EventBus<SimEvents>;
