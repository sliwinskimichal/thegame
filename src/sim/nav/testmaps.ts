/**
 * Deterministic synthetic mine for navigation tests and benchmarks
 * (224 x 720 by default, the target world size of docs/narrative/05).
 *
 * Layout: sky and a mountain over a plain; the Gorge (an 8-wide chasm with
 * four rock seals) at x 146-153; ~40 galleries 2-3 tiles tall with uneven
 * floors, low crawl sections and pits (some bridged by platforms, some with
 * ladders, some one-way traps); shafts between galleries with ladders,
 * broken ladders, ropes or staircases; natural caves (some flooded); lifts in
 * the Gorge between seals, rope bridges across it and rail lines along long
 * galleries. Infrastructure and links are returned as data so the same map
 * can be loaded into any NavGrid.
 */
import { Noise2D } from '../../core/noise';
import { Rng } from '../../core/rng';
import { M, SOLID } from '../../world/materials';
import { CAV, FLUID, TF, World } from '../../world/world';
import type { NavGrid } from './grid';
import { INFRA, INFRA_RISE_RIGHT } from './types';

export interface NavScenario {
  name: string;
  world: World;
  infra: Uint8Array;
  lifts: number[][];
  rails: number[][];
  ropes: [number, number][];
  bridges: [number, number][];
  /** Named cells of interest. */
  poi: Record<string, number>;
}

/** Add the scenario's links to a grid built from its world and infra. */
export function applyLinks(grid: NavGrid, sc: NavScenario): void {
  for (const stops of sc.lifts) grid.addLift(stops, { speed: 2.5, wait: 4000, capacity: 10 });
  for (const st of sc.rails) grid.addRail(st, { speed: 5, board: 3000, capacity: 4 });
  for (const [top, bottom] of sc.ropes) grid.addRope(top, bottom);
  for (const [a, b] of sc.bridges) grid.addBridge(a, b);
}

interface Gallery {
  xa: number;
  xb: number;
  /** Floor row (first solid row) per column; -1 outside the gallery. */
  floor: Int16Array;
  height: number;
  side: 'W' | 'E' | 'X';
}

export const GORGE_X0 = 146;
export const GORGE_X1 = 153;
export const SEALS = [150, 300, 470, 640] as const;

const BAND_ROCK = [M.LIMESTONE, M.LIMESTONE, M.GRANITE, M.SPORE_SHALE, M.MUDSTONE, M.SCHIST, M.BASALT, M.DEEPSTONE, M.HEARTSTONE];

export function buildSyntheticMine(seed = 1, W = 224, H = 720): NavScenario {
  const world = new World(W, H, seed);
  const rng = new Rng(seed * 7919 + 17);
  const nz = new Noise2D(seed + 101);
  const { mat, bg, cav, depth, fluid, fluidKind, flags, surface } = world;
  const infra = new Uint8Array(W * H);
  const I = (x: number, y: number) => y * W + x;
  const bottom = H - 4;
  const inGorge = (x: number) => x >= GORGE_X0 && x <= GORGE_X1;
  const sealAt = (y: number) => SEALS.some((s) => y >= s && y <= s + 2);

  // ------------------------------------------------------------ rock and sky
  for (let x = 0; x < W; x++) surface[x] = x < 100 ? 40 : Math.round(40 - 32 * Math.max(0, 1 - Math.abs(x - 150) / 75));
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = I(x, y);
      flags[i] = TF.EXPLORED;
      if (y < surface[x]) {
        mat[i] = bg[i] = M.AIR;
        cav[i] = CAV.SKY;
        depth[i] = 255;
      } else {
        const band = Math.min(8, Math.max(0, Math.floor((y - 40) / 76)));
        mat[i] = bg[i] = y >= bottom ? M.BEDROCK : y < surface[x] + 4 ? M.SOIL : BAND_ROCK[band];
        cav[i] = CAV.SOLID;
      }
    }
  const dig = (x: number, y: number, natural = false) => {
    if (x < 1 || x >= W - 1 || y < 0 || y >= bottom) return;
    const i = I(x, y);
    if (!SOLID[mat[i]]) return;
    bg[i] = mat[i];
    mat[i] = M.AIR;
    cav[i] = natural ? CAV.NATURAL : CAV.DUG;
    depth[i] = 32;
  };
  const refill = (x: number, y: number) => {
    const i = I(x, y);
    mat[i] = bg[i] || M.GRANITE;
    cav[i] = CAV.SOLID;
    depth[i] = 0;
    infra[i] = 0;
  };

  // ------------------------------------------------------------ the Gorge
  for (let y = 0; y < 680; y++) for (let x = GORGE_X0; x <= GORGE_X1; x++) if (y >= surface[x] && !sealAt(y)) dig(x, y, true);

  // ------------------------------------------------------------ galleries
  const galleries: Gallery[] = [];
  for (let base = 58; base < 690; base += rng.int(15, 20)) {
    while (SEALS.some((s) => s + 2 >= base - 6 && s <= base + 3)) base += 4;
    if (base >= 690) break;
    const r = rng.next();
    const side: Gallery['side'] = r < 0.34 ? 'W' : r < 0.58 ? 'E' : 'X';
    let xa: number;
    let xb: number;
    if (side === 'W') {
      xa = rng.int(2, 30);
      xb = rng.chance(0.7) ? GORGE_X0 - 1 : rng.int(90, GORGE_X0 - 4);
    } else if (side === 'E') {
      xa = rng.chance(0.7) ? GORGE_X1 + 1 : rng.int(GORGE_X1 + 4, 170);
      xb = rng.int(190, W - 3);
    } else {
      xa = rng.int(2, 30);
      xb = rng.int(190, W - 3);
    }
    const height = rng.chance(0.6) ? 2 : 3;
    const floor = new Int16Array(W).fill(-1);
    let off = 0;
    for (let x = xa; x <= xb; x++) {
      if (inGorge(x)) continue;
      if (rng.chance(0.07)) off = Math.max(-2, Math.min(2, off + rng.sign()));
      const f = base + off;
      floor[x] = f;
      for (let y = f - height; y < f; y++) dig(x, y);
    }
    const g: Gallery = { xa, xb, floor, height, side };
    galleries.push(g);
    const pick = () => {
      for (let t = 0; t < 20; t++) {
        const x = rng.int(xa + 3, xb - 5);
        let ok = true;
        for (let k = -2; k <= 4; k++) if (floor[x + k] < 0 || inGorge(x + k)) ok = false;
        if (ok) return x;
      }
      return -1;
    };
    // low ceiling: crawl section
    if (height === 2 && rng.chance(0.25)) {
      const x = pick();
      if (x >= 0) for (let k = 0; k < 3; k++) refill(x + k, floor[x + k] - 2);
    }
    // pits across the floor: 1 deep = drop in and step out; deeper ones get a ladder or a
    // platform deck, and a few stay traps (drop in, no way out)
    if (rng.chance(0.4)) {
      const x = pick();
      if (x >= 0) {
        const wdt = rng.int(2, 3);
        const dep = rng.int(1, 5);
        for (let k = 0; k < wdt; k++) for (let y = floor[x + k]; y < floor[x + k] + dep; y++) dig(x + k, y);
        const kind = rng.next();
        if (dep >= 4 && kind < 0.7) for (let k = 0; k < wdt; k++) infra[I(x + k, floor[x + k])] = INFRA.PLATFORM;
        else if (dep >= 2 && kind < 0.85) for (let y = floor[x]; y < floor[x] + dep; y++) infra[I(x, y)] = INFRA.LADDER;
      }
    }
  }

  // ------------------------------------------------------------ shafts between galleries
  const ropes: [number, number][] = [];
  for (let k = 0; k + 1 < galleries.length; k++) {
    const up = galleries[k];
    const lo = galleries[k + 1];
    const xs: number[] = [];
    for (let x = 3; x < W - 3; x++) {
      let ok = true;
      for (let d = -2; d <= 2; d++) if (up.floor[x + d] < 0 || lo.floor[x + d] < 0 || inGorge(x + d) || inGorge(x + d + 3)) ok = false;
      if (ok && lo.floor[x] - up.floor[x] > 4) xs.push(x);
    }
    if (xs.length === 0) continue;
    const count = Math.min(xs.length, rng.int(1, 3));
    for (let s = 0; s < count; s++) {
      const x = xs[Math.floor(rng.next() * xs.length)];
      const top = up.floor[x];
      const bot = lo.floor[x] - 1; // lower gallery standing row
      const r = s === 0 ? 0 : rng.next(); // the first shaft is always a full ladder
      if (r < 0.6) {
        for (let y = top; y <= bot; y++) {
          dig(x, y);
          infra[I(x, y)] = INFRA.LADDER;
        }
      } else if (r < 0.75) {
        // broken ladder: a gap of two rungs in the middle (one way down)
        const gap = Math.floor((top + bot) / 2);
        for (let y = top; y <= bot; y++) {
          dig(x, y);
          infra[I(x, y)] = y === gap || y === gap + 1 ? 0 : INFRA.LADDER;
        }
      } else {
        // rope shaft, covered at the top by a platform so the upper gallery stays walkable
        for (let y = top; y <= bot; y++) dig(x, y);
        infra[I(x, top)] = INFRA.PLATFORM;
        ropes.push([I(x - 1, up.floor[x - 1] - 1), I(x, bot)]);
      }
    }
  }

  // ------------------------------------------------------------ staircases from gallery ends
  for (let k = 0; k + 1 < galleries.length; k++) {
    const up = galleries[k];
    const lo = galleries[k + 1];
    if (!rng.chance(0.6)) continue;
    for (const dir of [1, -1]) {
      const x0 = dir === 1 ? up.xb : up.xa;
      if (up.floor[x0] < 0) continue;
      const cells: [number, number][] = [];
      let cx = x0;
      let cy = up.floor[x0] - 1;
      let ok = false;
      while (cells.length < 40) {
        cx += dir;
        cy++;
        if (cx < 2 || cx > W - 3 || inGorge(cx) || inGorge(cx + dir) || cy >= bottom - 2) break;
        cells.push([cx, cy]);
        const lx = cx + dir;
        if (lo.floor[lx] >= 0 && lo.floor[lx] - 1 === cy) {
          ok = true;
          break;
        }
      }
      if (!ok) continue;
      for (const [sx, sy] of cells) {
        dig(sx, sy);
        dig(sx, sy - 1);
        // descending toward +x means the ramp rises toward -x
        infra[I(sx, sy)] = INFRA.STAIRS | (dir === 1 ? 0 : INFRA_RISE_RIGHT);
      }
      break;
    }
  }

  // ------------------------------------------------------------ caves
  for (let band = 0; band < 9; band++)
    for (let c = 0; c < 3; c++) {
      const cx = rng.chance(0.5) ? rng.int(12, GORGE_X0 - 16) : rng.int(GORGE_X1 + 16, W - 12);
      const cy = 60 + band * 72 + rng.int(0, 60);
      if (cy > bottom - 10) continue;
      const rx = rng.range(6, 14);
      const ry = rng.range(3, 6);
      const flood = rng.chance(0.3);
      for (let y = Math.floor(cy - ry - 2); y <= cy + ry + 2; y++)
        for (let x = Math.floor(cx - rx - 2); x <= cx + rx + 2; x++) {
          const dx = (x - cx) / rx;
          const dy = (y - cy) / ry;
          if (dx * dx + dy * dy + nz.fbm(x * 0.2, y * 0.2, 2) * 0.5 < 1) dig(x, y, true);
        }
      if (flood) {
        for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
          let y = Math.floor(cy + ry + 2);
          while (y > cy - ry && (y >= bottom || SOLID[mat[I(x, y)]])) y--;
          for (let k = 0; k < 2 && y > 0 && !SOLID[mat[I(x, y)]]; k++, y--) {
            fluid[I(x, y)] = 255;
            fluidKind[I(x, y)] = FLUID.WATER;
          }
        }
      }
    }

  // ------------------------------------------------------------ surface access
  const g0 = galleries.find((g) => g.floor[30] >= 0);
  if (g0) for (let y = surface[30]; y < g0.floor[30]; y++) {
    dig(30, y);
    infra[I(30, y)] = INFRA.LADDER;
  }

  // ------------------------------------------------------------ links: lifts, bridges, rails
  const lifts: number[][] = [];
  const segs = [0, ...SEALS.map((s) => s + 3), 680];
  for (let k = 0; k + 1 < segs.length; k++) {
    const stops: number[] = [];
    for (const g of galleries) {
      const fW = g.floor[GORGE_X0 - 1];
      const fE = g.floor[GORGE_X1 + 1];
      if (fW > segs[k] && fW < segs[k + 1]) stops.push(I(GORGE_X0 - 1, fW - 1));
      if (fE > segs[k] && fE < segs[k + 1]) stops.push(I(GORGE_X1 + 1, fE - 1));
    }
    if (stops.length >= 2) lifts.push(stops);
  }
  const bridges: [number, number][] = [];
  for (const g of galleries) {
    const fW = g.floor[GORGE_X0 - 1];
    const fE = g.floor[GORGE_X1 + 1];
    if (g.side === 'X' && fW > 0 && fE > 0) bridges.push([I(GORGE_X0 - 1, fW - 1), I(GORGE_X1 + 1, fE - 1)]);
  }
  const rails: number[][] = [];
  for (const g of galleries) {
    const xa = g.xa;
    const xb = g.side === 'X' ? GORGE_X0 - 1 : g.xb;
    if (xb - xa < 90) continue;
    const st = [xa + 1, Math.floor((xa + xb) / 2), xb - 1].filter((x) => g.floor[x] > 0).map((x) => I(x, g.floor[x] - 1));
    if (st.length >= 2) rails.push(st);
  }

  const top = galleries[0];
  const last = galleries[galleries.length - 1];
  return {
    name: `kopalnia ${W}×${H} (seed ${seed})`,
    world,
    infra,
    lifts,
    rails,
    ropes,
    bridges,
    poi: {
      meadow: I(20, surface[20] - 1),
      firstGallery: top ? I(top.xa + 2, top.floor[top.xa + 2] - 1) : 0,
      deepGallery: last ? I(last.xb - 2, last.floor[last.xb - 2] - 1) : 0,
    },
  };
}
