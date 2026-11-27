/**
 * Dirty regions per consumer channel at chunk granularity (CONFIG.chunk tiles). Every world mutation
 * marks the channels it invalidates; each consumer (terrain mesher, light field, fog texture, navigation,
 * fluid mesh) takes its own list. Lists keep insertion order (deterministic) and never allocate.
 */
import { CONFIG } from '../../config';

export const DIRTY = { MESH: 1, LIGHT: 2, FOG: 4, NAV: 8, FLUID: 16 } as const;
export const DIRTY_ALL = 31;
const CHANNELS = 5;

export class DirtyMap {
  readonly cw: number;
  readonly ch: number;
  readonly chunk: number;
  /** How far (tiles) a change can alter the light field. */
  readonly lightRadius: number;
  private readonly flags: Uint8Array;
  private readonly lists: Int32Array[] = [];
  private readonly counts = new Int32Array(CHANNELS);

  constructor(
    readonly w: number,
    readonly h: number,
    opts: { chunk?: number; lightRadius?: number } = {},
  ) {
    this.chunk = opts.chunk ?? CONFIG.chunk;
    this.lightRadius = opts.lightRadius ?? 16;
    this.cw = Math.ceil(w / this.chunk);
    this.ch = Math.ceil(h / this.chunk);
    this.flags = new Uint8Array(this.cw * this.ch);
    // twice the chunk count: a take() may re-mark every chunk it already visited
    for (let c = 0; c < CHANNELS; c++) this.lists.push(new Int32Array(2 * this.cw * this.ch));
  }

  /** Mark tile (x, y): MESH/FOG/NAV/FLUID with its 3x3 neighbourhood, LIGHT within lightRadius. */
  markTile(x: number, y: number, mask: number): void {
    const near = mask & ~DIRTY.LIGHT;
    if (near) this.markRect(x - 1, y - 1, x + 1, y + 1, near);
    if (mask & DIRTY.LIGHT) {
      const r = this.lightRadius;
      this.markRect(x - r, y - r, x + r, y + r, DIRTY.LIGHT);
    }
  }

  /** Mark every chunk overlapping the tile rectangle [x0, x1] x [y0, y1] (clamped to the world). */
  markRect(x0: number, y0: number, x1: number, y1: number, mask: number): void {
    const ax = Math.max(0, x0);
    const ay = Math.max(0, y0);
    const bx = Math.min(this.w - 1, x1);
    const by = Math.min(this.h - 1, y1);
    if (ax > bx || ay > by) return;
    const c0 = Math.floor(ax / this.chunk);
    const c1 = Math.floor(bx / this.chunk);
    const r0 = Math.floor(ay / this.chunk);
    const r1 = Math.floor(by / this.chunk);
    for (let cy = r0; cy <= r1; cy++)
      for (let cx = c0; cx <= c1; cx++) {
        const k = cy * this.cw + cx;
        const f = this.flags[k]!;
        for (let c = 0; c < CHANNELS; c++) {
          const bit = 1 << c;
          if (mask & bit && !(f & bit)) {
            this.lists[c]![this.counts[c]!++] = k;
            this.flags[k] = this.flags[k]! | bit;
          }
        }
      }
  }

  markAll(mask: number = DIRTY_ALL): void {
    this.markRect(0, 0, this.w - 1, this.h - 1, mask);
  }

  /** Number of dirty chunks of one channel (a DIRTY bit). */
  count(channel: number): number {
    return this.counts[bitIndex(channel)]!;
  }

  isDirty(channel: number, cx: number, cy: number): boolean {
    return (this.flags[cy * this.cw + cx]! & channel) !== 0;
  }

  /**
   * Visit and clear the dirty chunks of one channel in marking order. Returns how many there were.
   * A chunk marked again from inside `fn` stays dirty for the next take.
   */
  take(channel: number, fn: (cx: number, cy: number) => void): number {
    const c = bitIndex(channel);
    const list = this.lists[c]!;
    const n = this.counts[c]!;
    for (let j = 0; j < n; j++) {
      const k = list[j]!;
      this.flags[k] = this.flags[k]! & ~channel;
      fn(k % this.cw, Math.floor(k / this.cw));
    }
    const extra = this.counts[c]! - n;
    if (extra > 0) list.copyWithin(0, n, n + extra);
    this.counts[c] = extra;
    return n;
  }
}

function bitIndex(channel: number): number {
  const c = 31 - Math.clz32(channel);
  if (channel !== 1 << c || c >= CHANNELS) throw new Error(`DirtyMap: not a single channel bit: ${channel}`);
  return c;
}
