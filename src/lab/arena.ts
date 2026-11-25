/**
 * The Arena: a small hand-designed world that contains every visual feature
 * a variant must handle. Every variant in every tournament renders exactly
 * this world from exactly the same cameras, so comparisons are fair.
 *
 * Layout (64 x 46 tiles):
 *   - meadow with trees on the left, rocky hill on the right, sky above
 *   - a shaft dug from the surface into a torch-lit tunnel and workshop room
 *   - coal seam, copper and iron deposits next to the tunnels
 *   - a natural granite cave with stalactites and a pool of water
 *   - a fungal cavern with glowing mushrooms, crystals and gold
 *   - a lava pocket rimmed with magma rock and obsidian
 *   - an unexplored region (hidden cave + crystals must NOT show)
 *   - bedrock floor
 */
import { CONFIG } from '../config';
import { Noise2D } from '../core/noise';
import { Rng } from '../core/rng';
import { M, SOLID } from '../world/materials';
import { CAV, FLUID, PROP, TF, World, type Prop } from '../world/world';

export const ARENA_W = 64;
export const ARENA_H = 46;

export interface ArenaInfo {
  world: World;
  /** Named points of interest (tile coordinates) used by scenarios. */
  poi: Record<string, { x: number; y: number }>;
  unexplored: { x0: number; y0: number; x1: number; y1: number };
}

export function buildArena(seed = 777): ArenaInfo {
  const W = ARENA_W;
  const H = ARENA_H;
  const world = new World(W, H, seed);
  const rng = new Rng(seed);
  const nz = new Noise2D(seed);
  const { mat, bg, cav, depth, fluid, fluidKind, flags, surface } = world;
  const I = (x: number, y: number) => y * W + x;

  // ------------------------------------------------------------ surface
  for (let x = 0; x < W; x++) {
    const t = (x - 52) / 8.5;
    const hill = x > 38 ? 6.2 * Math.exp(-t * t) : 0;
    surface[x] = Math.round(10 - hill);
  }

  // --------------------------------------------------------- host rock
  const wav = (x: number, k: number, a = 1) => Math.round(nz.noise1(x * 0.09 + k * 13.7, 2) * a);
  const host = (x: number, y: number): number => {
    const s = surface[x]!;
    if (y >= H - 3 + wav(x, 9)) return M.BEDROCK;
    const soilDepth = x > 40 ? 1 + wav(x, 1) : 4 + wav(x, 2);
    if (y < s + Math.max(1, soilDepth)) {
      const cx = (x - 27) / 4.5;
      const cy = (y - 12.5) / 1.6;
      return cx * cx + cy * cy < 1 ? M.CLAY : M.SOIL;
    }
    if (y < 22 + wav(x, 3)) {
      if (y >= 15 + wav(x, 4) && y <= 16 + wav(x, 4)) return M.SANDSTONE;
      return M.LIMESTONE;
    }
    if (y < 26 + wav(x, 5)) return M.SHALE;
    if (y < 34 + wav(x, 6)) return M.GRANITE;
    return y < 38 + wav(x, 7) ? M.SLATE : M.BASALT;
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = I(x, y);
      if (y < surface[x]!) {
        mat[i] = bg[i] = M.AIR;
        cav[i] = CAV.SKY;
        depth[i] = 255;
      } else {
        mat[i] = bg[i] = host(x, y);
        cav[i] = CAV.SOLID;
      }
    }

  // --------------------------------------------------------------- ores
  const blob = (cx: number, cy: number, rx: number, ry: number, m: number, fill = 1, keep = (_m: number) => true) => {
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++)
      for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        const d = dx * dx + dy * dy + nz.simplex(x * 0.7 + m, y * 0.7) * 0.35;
        const i = I(x, y);
        if (d < 1 && rng.chance(fill) && SOLID[mat[i]!] && mat[i] !== M.BEDROCK && keep(mat[i]!)) mat[i] = m;
      }
  };
  // coal seam following the strata
  for (let x = 4; x < 32; x++) {
    const y = 23 + wav(x, 11);
    mat[I(x, y)] = M.COAL;
    if (x % 3 !== 0) mat[I(x, y + 1)] = M.COAL;
  }
  blob(38, 18, 2.2, 1.6, M.COPPER, 0.9);
  blob(8, 16, 1.6, 1.2, M.COPPER, 0.85);
  blob(44, 25.5, 2.0, 1.3, M.IRON, 0.9);
  blob(58, 31, 1.7, 1.5, M.IRON, 0.85);
  blob(34, 31, 1.5, 1.2, M.SILVER, 0.85);
  blob(12, 35, 1.6, 1.3, M.GOLD, 0.8);

  // ------------------------------------------------- dug shaft & tunnels
  const dug = (x: number, y: number) => {
    const i = I(x, y);
    if (!SOLID[mat[i]!] || mat[i] === M.BEDROCK) return;
    bg[i] = host(x, y);
    mat[i] = M.AIR;
    cav[i] = CAV.DUG;
    depth[i] = 32;
  };
  for (let y = surface[16]!; y <= 19; y++) dug(16, y); // shaft
  for (let y = surface[17]!; y <= 19; y++) dug(17, y);
  for (let x = 10; x <= 34; x++) {
    dug(x, 18);
    dug(x, 19);
  }
  for (let x = 29; x <= 35; x++) for (let y = 15; y <= 17; y++) dug(x, y); // workshop room
  for (let x = 22; x <= 23; x++) dug(x, 20); // a started down-dig

  // ------------------------------------------------- natural cavities
  const cave = (cx: number, cy: number, rx: number, ry: number, d0: number, d1: number) => {
    for (let y = Math.floor(cy - ry - 2); y <= cy + ry + 2; y++)
      for (let x = Math.floor(cx - rx - 2); x <= cx + rx + 2; x++) {
        if (x < 1 || y < 1 || x >= W - 1 || y >= H - 3) continue;
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        const d = dx * dx + dy * dy + nz.fbm(x * 0.25, y * 0.25, 2) * 0.55;
        if (d >= 1) continue;
        const i = I(x, y);
        if (mat[i] === M.BEDROCK) continue;
        bg[i] = host(x, y);
        mat[i] = M.AIR;
        cav[i] = CAV.NATURAL;
        const n01 = 0.5 + 0.5 * nz.fbm(x * 0.15 + 40, y * 0.15, 2);
        depth[i] = Math.round((d0 + (d1 - d0) * n01) * 32);
      }
  };
  cave(48, 29.5, 10, 3.3, 1.4, 2.8); // granite cave
  cave(24, 37.5, 11, 3.1, 2.0, 3.8); // fungal cavern
  cave(52, 39.5, 7.5, 2.4, 1.6, 2.6); // lava pocket
  cave(5, 31, 3.5, 4, 1.4, 2.4); // hidden cave (unexplored)

  // water pool: lowest rows of the granite cave
  for (let y = 32; y < H; y++)
    for (let x = 36; x < 60; x++) {
      const i = I(x, y);
      if (cav[i] === CAV.NATURAL && y >= 32) {
        fluid[i] = 255;
        fluidKind[i] = FLUID.WATER;
      }
    }
  // lava: lowest rows of the lava pocket, magma rim, obsidian crust
  for (let y = 40; y < H; y++)
    for (let x = 42; x < 62; x++) {
      const i = I(x, y);
      if (cav[i] === CAV.NATURAL && !SOLID[mat[i]!]) {
        fluid[i] = 255;
        fluidKind[i] = FLUID.LAVA;
      }
    }
  for (let y = 35; y < H - 2; y++)
    for (let x = 41; x < 63; x++) {
      const i = I(x, y);
      if (!SOLID[mat[i]!] || mat[i] === M.BEDROCK) continue;
      let nearLava = false;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const j = I(Math.min(W - 1, Math.max(0, x + dx)), Math.min(H - 1, Math.max(0, y + dy)));
          if (fluidKind[j] === FLUID.LAVA) nearLava = true;
        }
      if (nearLava) mat[i] = bg[i] = rng.chance(0.3) ? M.OBSIDIAN : M.MAGMA_ROCK;
    }
  blob(60, 38, 1.2, 1.4, M.EMBERITE, 0.8, (m) => m === M.MAGMA_ROCK || m === M.BASALT);
  // fungal cavern: mycelium floor, crystals in the walls, gold nearby
  for (let y = 33; y < 43; y++)
    for (let x = 11; x < 38; x++) {
      const i = I(x, y);
      if (!SOLID[mat[i]!] || mat[i] === M.BEDROCK) continue;
      const above = I(x, y - 1);
      const side = mat[I(x - 1, y)] === M.AIR || mat[I(x + 1, y)] === M.AIR;
      if (cav[above] === CAV.NATURAL && !SOLID[mat[above]!]) mat[i] = M.MYCELIUM;
      else if (side && rng.chance(0.45)) mat[i] = rng.chance(0.6) ? M.CRYSTAL : M.AMETHYST;
    }
  blob(34, 40, 1.4, 1.0, M.GOLD, 0.8);
  // crystals inside the hidden cave walls (must stay hidden)
  for (let y = 26; y < 36; y++)
    for (let x = 1; x < 10; x++) {
      const i = I(x, y);
      if (SOLID[mat[i]!] && (mat[I(x + 1, y)] === M.AIR || mat[I(x - 1, y)] === M.AIR)) mat[i] = M.CRYSTAL;
    }

  // ---------------------------------------------------------- explored
  const unexplored = { x0: 0, y0: 23, x1: 10, y1: 41 };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const hidden = x >= unexplored.x0 && x <= unexplored.x1 && y >= unexplored.y0 && y <= unexplored.y1;
      if (!hidden) flags[I(x, y)] = TF.EXPLORED;
    }

  // --------------------------------------------------------------- props
  const props: Prop[] = [];
  const G = CONFIG.groundDepth;
  const add = (p: Omit<Prop, 'seed'>) => props.push({ ...p, seed: rng.nextU32() });
  for (const [x, type, sc] of [
    [3.4, PROP.PINE, 1.25],
    [7.6, PROP.PINE, 1.0],
    [11.2, PROP.BIRCH, 1.1],
    [27.3, PROP.PINE, 1.35],
    [31.8, PROP.BIRCH, 0.95],
    [35.2, PROP.PINE, 1.1],
  ] as const) {
    const tx = Math.floor(x);
    add({ type, x, y: -surface[tx]!, z: -rng.range(1.0, G - 0.6), scale: sc, rot: rng.range(0, 6.28), attach: 'ground', anchor: I(tx, surface[tx]!) });
  }
  for (let x = 0; x < W; x++) {
    const s = surface[x]!;
    const anchor = I(x, s);
    const soil = mat[anchor] === M.SOIL || mat[anchor] === M.CLAY;
    if (x === 16 || x === 17) continue; // shaft mouth
    if (soil) {
      for (let k = 0; k < 4; k++)
        add({ type: PROP.GRASS, x: x + rng.next(), y: -s, z: -rng.range(0.1, G - 0.2), scale: rng.range(0.6, 1.2), rot: rng.range(0, 6.28), attach: 'ground', anchor });
      if (rng.chance(0.35))
        add({ type: PROP.FLOWER, x: x + rng.next(), y: -s, z: -rng.range(0.2, G - 0.4), scale: rng.range(0.7, 1.1), rot: rng.range(0, 6.28), attach: 'ground', anchor });
      if (rng.chance(0.15))
        add({ type: PROP.BUSH, x: x + rng.next(), y: -s, z: -rng.range(0.6, G - 0.6), scale: rng.range(0.7, 1.2), rot: rng.range(0, 6.28), attach: 'ground', anchor });
    } else if (rng.chance(0.35)) {
      add({ type: PROP.BOULDER, x: x + rng.next(), y: -s, z: -rng.range(0.4, G - 0.5), scale: rng.range(0.5, 1.1), rot: rng.range(0, 6.28), attach: 'ground', anchor });
    }
  }
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const i = I(x, y);
      if (cav[i] !== CAV.NATURAL || SOLID[mat[i]!] || fluid[i]) continue;
      const d = depth[i]! / 32;
      const z = () => -rng.range(0.3, Math.max(0.35, d - 0.3));
      const up = I(x, y - 1);
      const dn = I(x, y + 1);
      const fungal = y > 33;
      const lava = x > 41 && y > 35;
      if (SOLID[mat[up]!] && rng.chance(fungal ? 0.25 : 0.5))
        add({ type: PROP.STALACTITE, x: x + rng.range(0.2, 0.8), y: -y, z: z(), scale: rng.range(0.6, 1.3), rot: rng.range(0, 6.28), attach: 'ceiling', anchor: up });
      if (SOLID[mat[dn]!] && !fluid[dn]) {
        const fy = -(y + 1);
        if (fungal && !lava) {
          if (x === 20) add({ type: PROP.GIANT_SHROOM, x: x + 0.5, y: fy, z: -1.6, scale: 1.1, rot: 0.4, attach: 'floor', anchor: dn });
          else if (rng.chance(0.55)) add({ type: PROP.GLOW_SHROOM, x: x + rng.range(0.15, 0.85), y: fy, z: z(), scale: rng.range(0.6, 1.1), rot: rng.range(0, 6.28), attach: 'floor', anchor: dn });
          if (rng.chance(0.2)) add({ type: PROP.CRYSTAL_CLUSTER, x: x + rng.range(0.2, 0.8), y: fy, z: z(), scale: rng.range(0.5, 0.9), rot: rng.range(0, 6.28), attach: 'floor', anchor: dn });
        } else if (!lava && rng.chance(0.45)) {
          add({ type: PROP.STALAGMITE, x: x + rng.range(0.2, 0.8), y: fy, z: z(), scale: rng.range(0.5, 1.0), rot: rng.range(0, 6.28), attach: 'floor', anchor: dn });
        }
      }
    }
  // roots hanging into the shaft and tunnel near the surface
  for (const [x, y] of [[16, 12], [17, 13], [12, 18], [19, 18]] as const)
    add({ type: PROP.ROOTS, x: x + 0.5, y: -y, z: -0.5, scale: 0.9, rot: rng.range(0, 6.28), attach: 'ceiling', anchor: I(x, y - 1) });
  add({ type: PROP.BONES, x: 56.5, y: -33, z: -1.0, scale: 1, rot: 0.7, attach: 'floor', anchor: I(56, 33) });
  // torches on tunnel back walls
  for (const [x, y] of [[12, 18], [25, 18], [32, 15]] as const)
    add({ type: PROP.TORCH, x: x + 0.5, y: -y - 0.3, z: -0.92, scale: 1, rot: 0, attach: 'wall', anchor: I(x, y) });
  world.props = props;

  // ---------------------------------------------------------- mannequins
  /** World Y of the first floor below (tile x, row y) — feet rest there. */
  const floorY = (x: number, y: number): number => {
    let yy = y;
    while (yy < H - 1 && !SOLID[mat[I(Math.floor(x), yy)]!]) yy++;
    return -yy;
  };
  world.mannequins = [
    { x: 21.5, y: floorY(21.5, 5), facing: 1, pose: 'walk' },
    { x: 33.4, y: floorY(33.4, 18), facing: 1, pose: 'dig' },
    { x: 30.5, y: floorY(30.5, 16), facing: -1, pose: 'stand' },
    { x: 26.5, y: floorY(26.5, 37), facing: -1, pose: 'stand' },
  ];

  return {
    world,
    unexplored,
    poi: {
      center: { x: 32, y: 23 },
      meadow: { x: 18, y: 8 },
      tunnel: { x: 24, y: 17.5 },
      cave: { x: 48, y: 30 },
      fungal: { x: 24, y: 38 },
      lava: { x: 51, y: 39.5 },
      hill: { x: 50, y: 7 },
      fog: { x: 11, y: 31 },
    },
  };
}
