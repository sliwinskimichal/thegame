/**
 * Stockpile zones (F2-3 stage 2): rectangles of tiles where hauled items are stored. A tile holds
 * STOCKPILE_RULES.perTile units; a haul reserves room on its destination tile before the dwarf sets
 * off (`incoming`), so a full zone is never over-booked. Only open tiles with a floor store items.
 * Stored units are not duplicated here: they are the piles lying on zone tiles (ItemPiles).
 */
import { STOCKPILE_RULES } from '../content/dwarves';
import type { World } from '../world/world';
import type { ItemPiles } from './items';
import { rleDecode, rleEncode } from './world/snapshot';

export interface Zone {
  id: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface StockpileSave {
  v: 1;
  zones: Zone[];
  zoneOf: number[];
  incoming: number[];
  nextId: number;
}

export class Stockpiles {
  /** Zone id of each tile (-1 = none). */
  readonly zoneOf: Int16Array;
  /** Units on their way to each tile (reserved by hauls). */
  readonly incoming: Uint16Array;
  readonly zones: Zone[] = [];
  private nextId = 0;
  /** Bumped on every zone change (jobs re-check hauling). */
  version = 0;

  constructor(
    readonly world: World,
    readonly items: ItemPiles,
    readonly perTile = STOCKPILE_RULES.perTile,
  ) {
    this.zoneOf = new Int16Array(world.size).fill(-1);
    this.incoming = new Uint16Array(world.size);
  }

  /** Add a zone over [x0, x1] x [y0, y1] (clamped; tiles of other zones stay theirs). Returns its id or -1. */
  add(x0: number, y0: number, x1: number, y1: number): number {
    const w = this.world;
    const z: Zone = { id: this.nextId, x0: Math.max(0, Math.min(x0, x1)), y0: Math.max(0, Math.min(y0, y1)), x1: Math.min(w.w - 1, Math.max(x0, x1)), y1: Math.min(w.h - 1, Math.max(y0, y1)) };
    if (z.x0 > z.x1 || z.y0 > z.y1 || this.zones.length >= 32000) return -1;
    this.nextId++;
    for (let y = z.y0; y <= z.y1; y++) for (let x = z.x0; x <= z.x1; x++) if (this.zoneOf[y * w.w + x]! < 0) this.zoneOf[y * w.w + x] = z.id;
    this.zones.push(z);
    this.version++;
    return z.id;
  }

  /** Remove a zone; its piles stay where they are and become loose (to be hauled elsewhere). */
  remove(id: number): boolean {
    const k = this.zones.findIndex((z) => z.id === id);
    if (k < 0) return false;
    const z = this.zones[k]!;
    const W = this.world.w;
    for (let y = z.y0; y <= z.y1; y++) for (let x = z.x0; x <= z.x1; x++) if (this.zoneOf[y * W + x] === id) this.zoneOf[y * W + x] = -1;
    this.zones.splice(k, 1);
    this.version++;
    return true;
  }

  isStorage(i: number): boolean {
    return this.zoneOf[i]! >= 0;
  }

  /** Room left on tile i for new hauls (0 for non-storage tiles, solid tiles and tiles without a floor). */
  room(i: number): number {
    if (this.zoneOf[i]! < 0) return 0;
    const w = this.world;
    if (w.isSolid(i % w.w, Math.floor(i / w.w))) return 0;
    if (!w.isSolid(i % w.w, Math.floor(i / w.w) + 1)) return 0;
    return Math.max(0, this.perTile - this.items.unitsAt(i) - this.incoming[i]!);
  }

  /** Total room left in all zones. */
  get totalRoom(): number {
    let n = 0;
    for (const z of this.zones) for (let y = z.y0; y <= z.y1; y++) for (let x = z.x0; x <= z.x1; x++) n += this.room(y * this.world.w + x);
    return n;
  }

  /** Storage tile with room nearest to `cell` (Manhattan; ties: lower index), or -1. */
  nearest(cell: number): number {
    const W = this.world.w;
    const cx = cell % W;
    const cy = Math.floor(cell / W);
    let best = -1;
    let bestD = Infinity;
    for (const z of this.zones)
      for (let y = z.y0; y <= z.y1; y++)
        for (let x = z.x0; x <= z.x1; x++) {
          const i = y * W + x;
          if (this.zoneOf[i] !== z.id || this.room(i) <= 0) continue;
          const d = Math.abs(x - cx) + Math.abs(y - cy);
          if (d < bestD || (d === bestD && i < best)) {
            bestD = d;
            best = i;
          }
        }
    return best;
  }

  book(i: number, n: number): void {
    this.incoming[i] = this.incoming[i]! + n;
  }

  unbook(i: number, n: number): void {
    this.incoming[i] = Math.max(0, this.incoming[i]! - n);
  }

  save(): StockpileSave {
    return { v: 1, zones: this.zones.map((z) => ({ ...z })), zoneOf: rleEncode(this.zoneOf), incoming: rleEncode(this.incoming), nextId: this.nextId };
  }

  load(s: StockpileSave): void {
    if (s.v !== 1) throw new Error(`stockpile save v${s.v}: unsupported`);
    this.zones.length = 0;
    for (const z of s.zones) this.zones.push({ ...z });
    rleDecode(s.zoneOf, this.zoneOf);
    rleDecode(s.incoming, this.incoming);
    this.nextId = s.nextId;
    this.version++;
  }
}
