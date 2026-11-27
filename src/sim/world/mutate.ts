/**
 * The single mutation path of the world grid for the simulation (QUALITY E1). Every tile change goes
 * through `dig` / `place` / `setFluid` (and `reveal` for scripted fog changes): it applies the raw
 * `World` primitive, keeps sim tile tags, marks dirty chunks for each consumer channel and emits the
 * matching events. No other sim code writes `World` arrays.
 */
import { MATERIALS, M, SOLID } from '../../world/materials';
import { FLUID, type World } from '../../world/world';
import { CAUSE, type Cause, type SimBus } from '../events';
import { DIRTY, DirtyMap } from './dirty';

/** Sim-only tile tags (World stays render-agnostic data). */
export const TAG = { RUBBLE: 1, BUILT: 2 } as const;

/** Pick tier that means "never" (bedrock, Prakowali stone). Only SCRIPT may dig it. */
export const TIER_NEVER = 9;

const DIG_DIRTY = DIRTY.MESH | DIRTY.LIGHT | DIRTY.FOG | DIRTY.NAV | DIRTY.FLUID;
const PLACE_DIRTY = DIRTY.MESH | DIRTY.LIGHT | DIRTY.NAV | DIRTY.FLUID;
const FLUID_DIRTY = DIRTY.FLUID | DIRTY.LIGHT | DIRTY.NAV;

export class WorldMutator {
  /** Per-tile sim tags (TAG bits), cleared when a tile is dug. */
  readonly tag: Uint8Array;
  readonly dirty: DirtyMap;
  /** Debug counters. */
  readonly stats = { dug: 0, placed: 0, fluid: 0, refused: 0 };

  constructor(
    readonly world: World,
    readonly bus: SimBus,
    opts: { lightRadius?: number; chunk?: number } = {},
  ) {
    this.tag = new Uint8Array(world.size);
    this.dirty = new DirtyMap(world.w, world.h, opts);
  }

  /**
   * Remove a solid tile. Refuses open tiles, tiles outside the grid and unbreakable material (tier 9)
   * unless `cause` is SCRIPT. Returns the removed material, or AIR when nothing changed.
   */
  dig(x: number, y: number, cause: Cause = CAUSE.DIG): number {
    const w = this.world;
    if (!w.inBounds(x, y)) return this.refuse();
    const i = y * w.w + x;
    const before = w.mat[i]!;
    if (!SOLID[before]) return this.refuse();
    if (MATERIALS[before]!.tier >= TIER_NEVER && cause !== CAUSE.SCRIPT) return this.refuse();
    // which of the 3x3 neighbours were already explored (bit per cell, out of bounds = explored)
    let seen = 0;
    for (let dy = -1, b = 0; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++, b++) if (!w.inBounds(x + dx, y + dy) || w.isExplored(x + dx, y + dy)) seen |= 1 << b;
    const props = w.props.length;
    w.dig(x, y);
    this.tag[i] = 0;
    this.stats.dug++;
    this.dirty.markTile(x, y, DIG_DIRTY);
    this.bus.emit('tileChanged', { i, x, y, before, after: M.AIR, cause });
    if (seen !== 511)
      for (let dy = -1, b = 0; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++, b++) {
          if (seen & (1 << b)) continue;
          const j = i + dy * w.w + dx;
          this.bus.emit('tileRevealed', { i: j, x: x + dx, y: y + dy });
        }
    if (w.props.length !== props) this.bus.emit('propsRemoved', { i, count: props - w.props.length });
    return before;
  }

  /**
   * Fill an open tile with solid material `m` (construction, rubble). Refuses solid tiles, non-solid
   * materials and tiles outside the grid. Any fluid in the tile is destroyed and reported.
   */
  place(x: number, y: number, m: number, cause: Cause = CAUSE.BUILD): boolean {
    const w = this.world;
    if (!w.inBounds(x, y) || SOLID[m] !== 1) return this.no();
    const i = y * w.w + x;
    if (SOLID[w.mat[i]!]) return this.no();
    const fk = w.fluidKind[i]!;
    const fa = w.fluid[i]!;
    const props = w.props.length;
    if (!w.fill(x, y, m)) return this.no();
    this.tag[i] = cause === CAUSE.COLLAPSE ? TAG.RUBBLE : cause === CAUSE.BUILD ? TAG.BUILT : 0;
    this.stats.placed++;
    this.dirty.markTile(x, y, PLACE_DIRTY);
    this.bus.emit('tileChanged', { i, x, y, before: M.AIR, after: m, cause });
    if (fa > 0 && fk !== FLUID.NONE) this.bus.emit('fluidDisplaced', { i, x, y, kind: fk, amount: fa, cause });
    if (w.props.length !== props) this.bus.emit('propsRemoved', { i, count: props - w.props.length });
    return true;
  }

  /** Set the fluid of an open tile (amount 0..255; kind NONE or amount 0 empties it). */
  setFluid(x: number, y: number, kind: number, amount: number, cause: Cause = CAUSE.FLUID): boolean {
    const w = this.world;
    if (!w.inBounds(x, y)) return false;
    const i = y * w.w + x;
    const prevKind = w.fluidKind[i]!;
    const prevAmount = w.fluid[i]!;
    if (!w.setFluid(x, y, kind, amount)) return false;
    this.stats.fluid++;
    this.dirty.markTile(x, y, FLUID_DIRTY);
    this.bus.emit('fluidChanged', { i, x, y, kind: w.fluidKind[i]!, amount: w.fluid[i]!, prevKind, prevAmount, cause });
    return true;
  }

  /** Reveal a tile (scripted fog change). Returns whether it was newly revealed. */
  reveal(x: number, y: number): boolean {
    const w = this.world;
    if (!w.reveal(x, y)) return false;
    this.dirty.markTile(x, y, DIRTY.FOG | DIRTY.MESH);
    this.bus.emit('tileRevealed', { i: y * w.w + x, x, y });
    return true;
  }

  private refuse(): number {
    this.stats.refused++;
    return M.AIR;
  }

  private no(): false {
    this.stats.refused++;
    return false;
  }
}
