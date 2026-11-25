/**
 * Procedural world generation.
 *
 * Pipeline: surface heightmap -> wavy layer boundaries -> host rock (strata)
 * -> cave mask (noise blobs, cellular smoothing, worm tunnels) -> ores and
 * geodes -> fluids pooled in cave basins -> special structures (ruins, the
 * Heart chamber) -> decor -> initial exploration.
 *
 * Everything is driven by the seed; the same seed always yields the same world.
 */
import { CONFIG } from '../config';
import { Noise2D, clamp, lerp } from '../core/noise';
import { Rng } from '../core/rng';
import { DECOR } from './decor';
import { BEDROCK_ROWS, LAYERS, LAYER_IDX } from './layers';
import { M } from './materials';
import { FL, TF, World, type DecorInstance } from './world';

export interface GenOptions {
  seed: number;
  w?: number;
  h?: number;
}

export interface GenResult {
  world: World;
  /** Locations where monster nests may awaken (cavern interiors). */
  nests: { x: number; y: number; layer: number }[];
  heart: { x: number; y: number };
  ms: number;
}

export function generateWorld(opts: GenOptions): GenResult {
  const t0 = performance.now();
  const W = opts.w ?? CONFIG.worldW;
  const H = opts.h ?? CONFIG.worldH;
  const seed = opts.seed >>> 0;
  const world = new World(W, H, seed);
  const rng = new Rng(seed);
  const nSurf = new Noise2D(seed ^ 0x1001);
  const nRock = new Noise2D(seed ^ 0x2002);
  const nCave = new Noise2D(seed ^ 0x3003);
  const nOre = new Noise2D(seed ^ 0x4004);
  const nMisc = new Noise2D(seed ^ 0x5005);
  const idx = (x: number, y: number) => y * W + x;
  const hScale = H / 480; // keep layer proportions if the world is resized

  // ---------------------------------------------------------------- surface
  const spawnX = Math.floor(W * 0.3);
  const mountainX = W * 0.74;
  const rawSurf = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    let s = 44 * hScale + 7 * nSurf.noise1(x * 0.012, 3) + 2 * nSurf.noise1(x * 0.07 + 100, 2);
    const dm = (x - mountainX) / 24;
    s -= 25 * Math.exp(-dm * dm) * (0.85 + 0.15 * nSurf.noise1(x * 0.05 + 50, 2));
    // a second, smaller crag
    const dm2 = (x - W * 0.9) / 10;
    s -= 9 * Math.exp(-dm2 * dm2);
    rawSurf[x] = s;
  }
  const spawnSurf = rawSurf[spawnX]!;
  const surface = world.surface;
  for (let x = 0; x < W; x++) {
    const ds = (x - spawnX) / 11;
    const flat = Math.exp(-ds * ds);
    surface[x] = Math.round(clamp(lerp(rawSurf[x]!, spawnSurf, flat * 0.9), 12, 70));
  }
  const mountainness = (x: number) => clamp((spawnSurf - surface[x]!) / 18, 0, 1);

  // ---------------------------------------------------------------- layers
  const L = LAYERS.length;
  const tops: Int16Array[] = [];
  for (let k = 0; k < L; k++) {
    const t = new Int16Array(W);
    for (let x = 0; x < W; x++) {
      if (k === 0) t[x] = surface[x]!;
      else {
        const base = LAYERS[k]!.base * hScale;
        t[x] = Math.round(base + 5 * nRock.noise1(x * 0.02 + k * 37.7, 2));
      }
    }
    tops.push(t);
  }
  for (let x = 0; x < W; x++) tops[1]![x] = Math.max(tops[1]![x]!, surface[x]! + 8);
  const layerAt = (x: number, y: number): number => {
    for (let k = L - 1; k > 0; k--) if (y >= tops[k]![x]!) return k;
    return 0;
  };
  for (let y = 0; y < H; y++) {
    let k = 0;
    for (let j = L - 1; j >= 0; j--)
      if (y >= LAYERS[j]!.base * hScale) {
        k = j;
        break;
      }
    world.layerOfRow[y] = k;
  }
  const bedrockTop = new Int16Array(W);
  for (let x = 0; x < W; x++)
    bedrockTop[x] = Math.round(H - BEDROCK_ROWS + 3 * nRock.noise1(x * 0.05 + 999, 2));
  const isBorder = (x: number, y: number): boolean => {
    if (y >= bedrockTop[x]!) return true;
    if (y < surface[x]! + 3) return false;
    const t = 2 + Math.round(1.5 * (1 + nRock.noise1(y * 0.06 + (x < W / 2 ? 0 : 77), 2)));
    return x < t || x >= W - t;
  };

  // ------------------------------------------------------------ host rock
  const soilDepth = new Float32Array(W);
  for (let x = 0; x < W; x++)
    soilDepth[x] = lerp(7, 1.5, mountainness(x)) + 2 * nRock.noise1(x * 0.05 + 300, 2);

  const baseRock = (x: number, y: number, layer: number): number => {
    const d = y - surface[x]!;
    switch (layer) {
      case LAYER_IDX.FOOTHILLS: {
        if (d < soilDepth[x]!) {
          if (nRock.fbm(x * 0.08 + 5, y * 0.12, 2) > 0.42) return M.CLAY;
          if (d < 2 && nRock.fbm(x * 0.04 + 70, 3.3, 2) > 0.55) return M.SAND;
          return M.SOIL;
        }
        const v = nRock.fbm(x * 0.03 + 11, y * 0.08, 2);
        if (v > 0.35) return M.SOIL;
        if (v < -0.35) return M.SANDSTONE;
        return M.LIMESTONE;
      }
      case LAYER_IDX.LIMESTONE: {
        const v = nRock.fbm(x * 0.006, y * 0.05, 3) + 0.35 * nRock.fbm(x * 0.03 + 9, y * 0.1, 2);
        if (v > 0.28) return M.SANDSTONE;
        if (v < -0.32) return M.SHALE;
        return M.LIMESTONE;
      }
      case LAYER_IDX.GRANITE: {
        const v = nRock.fbm(x * 0.01 + 40, y * 0.03, 3);
        if (v > 0.34) return M.SLATE;
        if (v < -0.5) return M.LIMESTONE;
        return M.GRANITE;
      }
      case LAYER_IDX.FUNGAL: {
        const v = nRock.fbm(x * 0.008 + 80, y * 0.04, 3);
        if (v > 0.22) return M.SHALE;
        if (v < -0.3) return M.SLATE;
        return M.LIMESTONE;
      }
      case LAYER_IDX.CRYSTAL: {
        const v = nRock.fbm(x * 0.012 + 120, y * 0.035, 3);
        if (v > 0.25) return M.BASALT;
        if (v < -0.42) return M.GRANITE;
        return M.SLATE;
      }
      case LAYER_IDX.MAGMA: {
        const r = nRock.ridged(x * 0.012 + 160, y * 0.045, 2);
        if (r > 0.9) return M.OBSIDIAN;
        return M.BASALT;
      }
      default: {
        const v = nRock.fbm(x * 0.015 + 200, y * 0.03, 3);
        return v > 0.1 ? M.BASALT : M.SLATE;
      }
    }
  };

  // ------------------------------------------------------------- cave mask
  const cave = new Uint8Array(W * H);
  const spawnSafe = (x: number, y: number) =>
    Math.abs(x - spawnX) < 16 && y < surface[spawnX]! + 30;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = y - surface[x]!;
      if (d < 5 || isBorder(x, y) || spawnSafe(x, y)) continue;
      const layer = layerAt(x, y);
      let c = false;
      switch (layer) {
        case LAYER_IDX.FOOTHILLS:
          c = d > 10 && nCave.fbm(x * 0.05, y * 0.08, 3) > 0.48;
          break;
        case LAYER_IDX.LIMESTONE:
          c = nCave.fbm(x * 0.045, y * 0.07, 3) > 0.36;
          break;
        case LAYER_IDX.GRANITE:
          c = nCave.fbm(x * 0.04 + 50, y * 0.055, 3) > 0.33;
          break;
        case LAYER_IDX.FUNGAL: {
          // Large caverns, thinning near the layer's top and bottom edges.
          const top = tops[LAYER_IDX.FUNGAL]![x]!;
          const bot = tops[LAYER_IDX.CRYSTAL]![x]!;
          const edge = Math.min(y - top, bot - y);
          const fall = clamp(1 - edge / 10, 0, 1);
          const big = nCave.fbm(x * 0.011 + 300, y * 0.022, 4);
          c = big > 0.11 + 0.35 * fall || nCave.fbm(x * 0.05, y * 0.06, 2) > 0.47;
          break;
        }
        case LAYER_IDX.CRYSTAL:
          c = nCave.fbm(x * 0.032 + 700, y * 0.042, 3) > 0.31;
          break;
        case LAYER_IDX.MAGMA: {
          const big = nCave.fbm(x * 0.016 + 500, y * 0.028, 3);
          c = big > 0.18 || nCave.fbm(x * 0.05 + 7, y * 0.06, 2) > 0.42;
          break;
        }
        default:
          c = nCave.fbm(x * 0.035 + 900, y * 0.05, 3) > 0.33;
      }
      if (c) cave[idx(x, y)] = 1;
    }
  }
  // Cellular smoothing: rounds blobs, removes speckle.
  const tmp = new Uint8Array(W * H);
  for (let it = 0; it < 2; it++) {
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = idx(x, y);
        let n = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && cave[i + dy * W + dx]) n++;
        tmp[i] = n >= 5 || (cave[i] === 1 && n >= 4) ? 1 : 0;
        if (y - surface[x]! < 5 || isBorder(x, y) || spawnSafe(x, y)) tmp[i] = 0;
      }
    }
    cave.set(tmp);
  }
  // Worm tunnels: winding passages that connect cave pockets.
  const worms = Math.round((W * H) / 7000);
  for (let k = 0; k < worms; k++) {
    let x = rng.range(8, W - 8);
    const minY = LAYERS[1]!.base * hScale + 4;
    let y = rng.range(minY, H - BEDROCK_ROWS - 10);
    let a = rng.range(0, Math.PI * 2);
    const len = rng.int(30, 110);
    const r0 = rng.range(0.7, 1.5);
    for (let s = 0; s < len; s++) {
      a += rng.range(-0.35, 0.35);
      // bias towards horizontal travel
      x += Math.cos(a) * 0.9;
      y += Math.sin(a) * 0.45;
      const r = r0 + 0.4 * Math.sin(s * 0.3);
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          if (dx * dx + dy * dy > r * r + 0.5) continue;
          const tx = Math.round(x + dx);
          const ty = Math.round(y + dy);
          if (tx < 1 || ty < 1 || tx >= W - 1 || ty >= H - 1) continue;
          if (ty - surface[tx]! < 8 || isBorder(tx, ty) || spawnSafe(tx, ty)) continue;
          cave[idx(tx, ty)] = 1;
        }
    }
  }

  // ------------------------------------------------------------ compose
  const { mat, bg, flags, depth } = world;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      if (y < surface[x]!) {
        mat[i] = M.AIR;
        bg[i] = M.AIR;
        flags[i] = TF.OUTDOOR;
        depth[i] = 255;
        continue;
      }
      if (isBorder(x, y)) {
        mat[i] = bg[i] = M.BEDROCK;
        continue;
      }
      const layer = layerAt(x, y);
      const rock = baseRock(x, y, layer);
      bg[i] = rock;
      mat[i] = cave[i] ? M.AIR : rock;
      if (cave[i]) flags[i] = TF.NATURAL;
    }
  }

  // Remove tiny cave fragments (fill back) and label caves for fluids.
  const label = new Int32Array(W * H).fill(-1);
  const comps: { tiles: number[]; minY: number; maxY: number; layer: number }[] = [];
  const stack: number[] = [];
  for (let i = 0; i < W * H; i++) {
    if (mat[i] !== M.AIR || !(flags[i]! & TF.NATURAL) || label[i] !== -1) continue;
    const id = comps.length;
    const tiles: number[] = [];
    let minY = H,
      maxY = 0;
    stack.push(i);
    label[i] = id;
    while (stack.length) {
      const j = stack.pop()!;
      tiles.push(j);
      const jy = (j / W) | 0;
      const jx = j - jy * W;
      if (jy < minY) minY = jy;
      if (jy > maxY) maxY = jy;
      const nb = [jx > 0 ? j - 1 : -1, jx < W - 1 ? j + 1 : -1, jy > 0 ? j - W : -1, jy < H - 1 ? j + W : -1];
      for (const k of nb) {
        if (k < 0 || label[k] !== -1 || mat[k] !== M.AIR || !(flags[k]! & TF.NATURAL)) continue;
        label[k] = id;
        stack.push(k);
      }
    }
    const by = maxY;
    const bx = tiles[0]! % W;
    comps.push({ tiles, minY, maxY, layer: layerAt(bx, by) });
  }
  for (const c of comps) {
    if (c.tiles.length < 6) {
      for (const j of c.tiles) {
        mat[j] = bg[j]!;
        flags[j] = 0;
      }
      c.tiles.length = 0;
    }
  }

  // ---------------------------------------------------------------- ores
  // Ore deposits: single-octave simplex blobs (chunky, 3-12 tiles) with a
  // little domain warp so they do not look like circles.
  const blob = (x: number, y: number, f: number, off: number, thr: number): boolean => {
    const wx = x + 2.5 * nMisc.simplex(x * 0.15 + off, y * 0.15);
    const wy = y + 2.5 * nMisc.simplex(x * 0.15, y * 0.15 + off);
    return nOre.simplex(wx * f + off, wy * f * 1.25 - off) > thr;
  };
  const oreAt = (x: number, y: number, layer: number): number => {
    switch (layer) {
      case LAYER_IDX.FOOTHILLS:
        if (y - surface[x]! > 6 && blob(x, y, 0.062, 11, 0.716)) return M.COPPER;
        return 0;
      case LAYER_IDX.LIMESTONE:
        if (nOre.ridged(x * 0.018, y * 0.09 + 3, 2) > 0.925) return M.COAL;
        if (blob(x, y, 0.056, 11, 0.644)) return M.COPPER;
        if (y > tops[1]![x]! + 30 && blob(x, y, 0.062, 200, 0.74)) return M.IRON;
        return 0;
      case LAYER_IDX.GRANITE:
        if (blob(x, y, 0.05, 200, 0.62)) return M.IRON;
        if (blob(x, y, 0.074, 400, 0.788)) return M.SILVER;
        if (blob(x, y, 0.056, 11, 0.764)) return M.COPPER;
        if (nOre.ridged(x * 0.02 + 50, y * 0.1, 2) > 0.94) return M.COAL;
        return 0;
      case LAYER_IDX.FUNGAL:
        if (blob(x, y, 0.074, 400, 0.74)) return M.SILVER;
        if (blob(x, y, 0.05, 200, 0.716)) return M.IRON;
        if (blob(x, y, 0.081, 600, 0.836)) return M.GOLD;
        if (nOre.ridged(x * 0.02 + 90, y * 0.1, 2) > 0.95) return M.COAL;
        return 0;
      case LAYER_IDX.CRYSTAL:
        if (blob(x, y, 0.068, 800, 0.788)) return M.CRYSTAL;
        if (blob(x, y, 0.068, 850, 0.824)) return M.AMETHYST;
        if (blob(x, y, 0.081, 600, 0.764)) return M.GOLD;
        return 0;
      case LAYER_IDX.MAGMA:
        if (blob(x, y, 0.062, 1000, 0.764)) return M.EMBERITE;
        if (blob(x, y, 0.081, 600, 0.812)) return M.GOLD;
        return 0;
      default:
        if (blob(x, y, 0.062, 1200, 0.8)) return M.GLIMMERITE;
        if (blob(x, y, 0.068, 850, 0.848)) return M.AMETHYST;
        if (blob(x, y, 0.081, 600, 0.788)) return M.GOLD;
        return 0;
    }
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      const m = mat[i]!;
      if (m === M.AIR || m === M.BEDROCK) continue;
      const o = oreAt(x, y, layerAt(x, y));
      if (o) mat[i] = o;
    }
  }
  // Crystal geodes: line cave walls in the crystal layer.
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = idx(x, y);
      if (mat[i] === M.AIR || mat[i] === M.BEDROCK) continue;
      if (layerAt(x, y) !== LAYER_IDX.CRYSTAL) continue;
      const nearCave =
        mat[i - 1] === M.AIR || mat[i + 1] === M.AIR || mat[i - W] === M.AIR || mat[i + W] === M.AIR;
      if (nearCave && rng.chance(0.3)) {
        mat[i] = nOre.simplex(x * 0.05 + 3, y * 0.05) > 0.1 ? M.AMETHYST : M.CRYSTAL;
      }
    }
  }

  // -------------------------------------------------------------- fluids
  const nests: GenResult['nests'] = [];
  for (const c of comps) {
    if (c.tiles.length < 14) continue;
    let chance = 0;
    let type: number = FL.WATER;
    switch (c.layer) {
      case LAYER_IDX.LIMESTONE: chance = 0.28; break;
      case LAYER_IDX.GRANITE: chance = 0.3; break;
      case LAYER_IDX.FUNGAL: chance = 0.5; break;
      case LAYER_IDX.CRYSTAL: chance = 0.25; break;
      case LAYER_IDX.MAGMA: chance = 0.8; type = FL.LAVA; break;
      case LAYER_IDX.ANCIENT: chance = 0.2; break;
    }
    if (c.layer >= LAYER_IDX.GRANITE && c.tiles.length > 50) {
      const pick = c.tiles[Math.floor(rng.next() * c.tiles.length)]!;
      nests.push({ x: pick % W, y: (pick / W) | 0, layer: c.layer });
    }
    if (!rng.chance(chance)) continue;
    const hgt = c.maxY - c.minY + 1;
    const frac = type === FL.LAVA ? rng.range(0.3, 0.55) : rng.range(0.2, 0.42);
    const level = c.maxY - Math.max(1, Math.round(hgt * frac)) + 1;
    for (const j of c.tiles) {
      const jy = (j / W) | 0;
      if (jy >= level) {
        world.fluid[j] = 255;
        world.fluidType[j] = type;
      }
    }
  }
  // Lava bakes surrounding rock into magma rock and obsidian.
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = idx(x, y);
      if (world.fluidType[i] !== FL.LAVA) continue;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const j = i + dy * W + dx;
          const m = mat[j]!;
          if (m === M.AIR || m === M.BEDROCK || m === M.EMBERITE || m === M.GOLD) continue;
          if (rng.chance(0.65)) mat[j] = bg[j] = rng.chance(0.25) ? M.OBSIDIAN : M.MAGMA_ROCK;
        }
    }
  }
  // Mycelium carpets the floors of the fungal grottos.
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = idx(x, y);
      if (mat[i] === M.AIR || mat[i] === M.BEDROCK) continue;
      if (layerAt(x, y) !== LAYER_IDX.FUNGAL) continue;
      const above = i - W;
      const floor = mat[above] === M.AIR && flags[above]! & TF.NATURAL && !world.fluid[above];
      const side = (mat[i - 1] === M.AIR || mat[i + 1] === M.AIR) && rng.chance(0.3);
      if (floor || side) mat[i] = M.MYCELIUM;
    }
  }

  // ------------------------------------------------------ special places
  // Ancient ruins: rectangular halls of carved brick in the deepest layer.
  const ruinCount = Math.max(3, Math.round(W / 45));
  const ancientTop = LAYERS[LAYER_IDX.ANCIENT]!.base * hScale;
  for (let r = 0; r < ruinCount; r++) {
    const rw = rng.int(9, 17);
    const rh = rng.int(5, 7);
    const rx = rng.int(6, W - rw - 6);
    const ry = rng.int(Math.round(ancientTop + 6), H - BEDROCK_ROWS - rh - 14);
    for (let y = ry; y < ry + rh; y++)
      for (let x = rx; x < rx + rw; x++) {
        const i = idx(x, y);
        const wall = y === ry || y === ry + rh - 1 || x === rx || x === rx + rw - 1;
        world.fluid[i] = 0;
        if (wall) {
          // weathered walls with gaps
          if (rng.chance(0.82)) mat[i] = bg[i] = M.ANCIENT_BRICK;
          else {
            mat[i] = M.AIR;
            flags[i] = TF.NATURAL;
            bg[i] = M.ANCIENT_BRICK;
          }
        } else {
          mat[i] = M.AIR;
          bg[i] = M.ANCIENT_BRICK;
          flags[i] = TF.NATURAL;
        }
      }
  }
  // The Heart of the Mountain: a sealed chamber above the bedrock.
  const hx = Math.floor(W / 2);
  const hy = H - BEDROCK_ROWS - 9;
  for (let y = hy - 5; y <= hy + 4; y++)
    for (let x = hx - 9; x <= hx + 9; x++) {
      const i = idx(x, y);
      const wall = y <= hy - 4 || y >= hy + 3 || x <= hx - 8 || x >= hx + 8;
      world.fluid[i] = 0;
      if (wall) mat[i] = bg[i] = M.ANCIENT_BRICK;
      else {
        mat[i] = M.AIR;
        bg[i] = M.ANCIENT_BRICK;
        flags[i] = TF.NATURAL;
      }
    }

  // ------------------------------------------------------- cavity depth
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      if (mat[i] !== M.AIR || flags[i]! & TF.OUTDOOR) continue;
      const layer = layerAt(x, y);
      const n01 = 0.5 + 0.5 * nMisc.fbm(x * 0.09, y * 0.09, 2);
      let d: number;
      if (layer === LAYER_IDX.FUNGAL) d = 1.8 + 2.4 * n01;
      else if (layer === LAYER_IDX.MAGMA) d = 1.6 + 1.8 * n01;
      else if (bg[i] === M.ANCIENT_BRICK) d = 2.6;
      else d = 1.25 + 1.2 * n01;
      depth[i] = Math.min(250, Math.round(d * 32));
    }
  }

  // ---------------------------------------------------------------- decor
  const decor: DecorInstance[] = [];
  const slab = CONFIG.slabDepth;
  const add = (type: number, x: number, y: number, z: number, scale: number, anchor: number, rot = rng.range(0, Math.PI * 2)) =>
    decor.push({ type, x, y, z, scale, rot, anchor, seed: rng.nextU32() });
  for (let x = 2; x < W - 2; x++) {
    const sy = surface[x]!;
    const ground = idx(x, sy);
    const gm = mat[ground]!;
    if (gm === M.AIR) continue;
    const soil = gm === M.SOIL || gm === M.CLAY;
    const mtn = mountainness(x);
    const forest = nMisc.fbm(x * 0.03 + 900, 0.5, 2) > -0.15 && mtn < 0.65;
    const nearSpawn = Math.abs(x - spawnX) < 7;
    if (forest && !nearSpawn && soil) {
      const n = rng.chance(0.55) ? (rng.chance(0.35) ? 2 : 1) : 0;
      for (let t = 0; t < n; t++) {
        const type = rng.chance(0.72) ? DECOR.PINE : DECOR.BIRCH;
        add(type, x + rng.range(0.1, 0.9), -sy, -rng.range(1.2, slab - 0.6), rng.range(0.75, 1.35), ground);
      }
    }
    if (soil) {
      const g = rng.int(2, 5);
      for (let t = 0; t < g; t++)
        add(DECOR.GRASS, x + rng.next(), -sy, -rng.range(0.15, slab - 0.3), rng.range(0.6, 1.2), ground);
      if (rng.chance(0.35))
        add(DECOR.FLOWER, x + rng.next(), -sy, -rng.range(0.2, slab - 0.5), rng.range(0.7, 1.1), ground);
      if (rng.chance(0.2))
        add(DECOR.BUSH, x + rng.next(), -sy, -rng.range(0.6, slab - 0.8), rng.range(0.7, 1.3), ground);
    }
    if (rng.chance(0.06 + mtn * 0.25))
      add(DECOR.BOULDER, x + rng.next(), -sy, -rng.range(0.4, slab - 0.6), rng.range(0.5, 1.4), ground);
  }
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = idx(x, y);
      if (mat[i] !== M.AIR || !(flags[i]! & TF.NATURAL) || world.fluid[i]) continue;
      const layer = layerAt(x, y);
      const d = depth[i]! / 32;
      const z = () => -rng.range(0.25, Math.max(0.3, d - 0.25));
      const ceil = i - W;
      const floor = i + W;
      if (mat[ceil] !== M.AIR) {
        if (layer <= LAYER_IDX.LIMESTONE && y - surface[x]! < 26 && rng.chance(0.22))
          add(DECOR.ROOTS, x + rng.range(0.2, 0.8), -y, z(), rng.range(0.6, 1.1), ceil);
        else {
          const p = [0.18, 0.25, 0.3, 0.2, 0.25, 0.12, 0.3][layer]!;
          if (rng.chance(p)) add(DECOR.STALACTITE, x + rng.range(0.2, 0.8), -y, z(), rng.range(0.5, 1.2), ceil);
        }
        if (layer === LAYER_IDX.CRYSTAL && rng.chance(0.12))
          add(DECOR.CRYSTAL_CLUSTER, x + rng.range(0.2, 0.8), -y, z(), rng.range(0.4, 0.8), ceil, Math.PI);
      }
      if (mat[floor] !== M.AIR && !world.fluid[floor]) {
        const fy = -(y + 1);
        const head = mat[i - W] === M.AIR && mat[i - 2 * W] === M.AIR && mat[i - 3 * W] === M.AIR;
        switch (layer) {
          case LAYER_IDX.FUNGAL:
            if (head && rng.chance(0.08)) add(DECOR.GIANT_SHROOM, x + 0.5, fy, -rng.range(0.6, Math.max(0.7, d - 0.5)), rng.range(0.8, 1.4), floor);
            else if (rng.chance(0.38)) add(DECOR.GLOW_SHROOM, x + rng.range(0.15, 0.85), fy, z(), rng.range(0.5, 1.1), floor);
            break;
          case LAYER_IDX.CRYSTAL:
            if (rng.chance(0.25)) add(DECOR.CRYSTAL_CLUSTER, x + rng.range(0.2, 0.8), fy, z(), rng.range(0.5, 1.1), floor, 0);
            else if (rng.chance(0.08)) add(DECOR.STALAGMITE, x + rng.range(0.2, 0.8), fy, z(), rng.range(0.5, 1), floor);
            break;
          case LAYER_IDX.MAGMA:
            if (rng.chance(0.06)) add(DECOR.EMBER_VENT, x + 0.5, fy, z(), rng.range(0.7, 1.1), floor);
            else if (rng.chance(0.05)) add(DECOR.STALAGMITE, x + rng.range(0.2, 0.8), fy, z(), rng.range(0.5, 1), floor);
            break;
          case LAYER_IDX.ANCIENT:
            if (rng.chance(0.06)) add(DECOR.BONES, x + rng.range(0.2, 0.8), fy, z(), rng.range(0.7, 1.1), floor);
            else if (head && bg[i] === M.ANCIENT_BRICK && rng.chance(0.08)) add(DECOR.PILLAR, x + 0.5, fy, -d + 0.45, 1, floor, 0);
            else if (rng.chance(0.08)) add(DECOR.STALAGMITE, x + rng.range(0.2, 0.8), fy, z(), rng.range(0.5, 1), floor);
            break;
          default:
            if (rng.chance(0.12)) add(DECOR.STALAGMITE, x + rng.range(0.2, 0.8), fy, z(), rng.range(0.4, 1), floor);
        }
      }
    }
  }
  world.decor = decor;

  // ---------------------------------------------------------- exploration
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = idx(x, y);
      if (flags[i]! & TF.OUTDOOR) {
        flags[i] = flags[i]! | TF.EXPLORED;
        continue;
      }
      // the crust right under the sky is known
      for (let dy = -2; dy <= 0; dy++) {
        const yy = y + dy;
        if (yy >= 0 && flags[idx(x, yy)]! & TF.OUTDOOR) {
          flags[i] = flags[i]! | TF.EXPLORED;
          break;
        }
      }
    }
  }

  world.spawnX = spawnX;
  world.spawnY = surface[spawnX]! - 1;
  world.markAllDirty();
  return { world, nests, heart: { x: hx, y: hy }, ms: performance.now() - t0 };
}
