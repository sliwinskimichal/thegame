/**
 * Work spots: cells from which a body can work on a tile (dig, build, repair).
 * A body standing at (sx, sy) with height h reaches tiles with |tx - sx| <= 1
 * and ty in [sy - h, sy + 1] (one above the head to one below the feet),
 * except its own body cells. Feed the result to a multi-goal path query.
 */
import type { NavGrid } from './grid';

/** Writes standable work spots for tile (tx, ty) into `out` (capacity >= 3 * (h + 2)); returns the count. */
export function workSpots(grid: NavGrid, p: number, tx: number, ty: number, out: Int32Array): number {
  const h = grid.profiles[p].height;
  let n = 0;
  for (let dx = -1; dx <= 1; dx++) {
    const sx = tx + dx;
    if (sx < 0 || sx >= grid.w) continue;
    for (let sy = ty - 1; sy <= ty + h; sy++) {
      if (sy < 0 || sy >= grid.h) continue;
      if (dx === 0 && sy >= ty && sy <= ty + h - 1) continue; // the tile would be inside the body
      const c = sy * grid.w + sx;
      if (grid.standable(p, c)) out[n++] = c;
    }
  }
  return n;
}
