/**
 * Tone scenes (F2-12, CHARTER §4): three static stagings every visual tournament is judged in.
 *  - izba  (evening hall): a colony hall packed floor to roof — tables, benches, barrels, shelves,
 *          anvil, forge, grindstone, a gear drive, tool racks, two pipe runs with valves, ceiling
 *          timbers, hanging lanterns, chests, 12 dwarves, warm torches; a dressed-stone wall meets natural rock
 *          directly and part of the back wall is masonry (built vs natural must read apart).
 *  - przodek (working face in the dark): a dwarf with a lantern at the end of a timbered drift,
 *          the unknown ahead, an ore vein half exposed in the face.
 *  - zawal (cave-in): a cracked roof, a breakout above the drift, broken props, rubble, dust and
 *          debris frozen in one frame, ink cracks growing from the props.
 * No simulation: tiles, props and dressing are written directly. The layout is fixed; the seed
 * changes rock boundaries, the ore body and the prop jitter (the gates ask for two seeds).
 */
import { Noise2D } from '../core/noise';
import { Rng } from '../core/rng';
import { M, SOLID } from '../world/materials';
import { CAV, PROP, TF, World, type Prop } from '../world/world';
import type { ArenaInfo, DressItem } from './arena';

export const TONE_W = 76;
export const TONE_H = 34;
const SURFACE = 3;

export function buildToneScenes(seed = 1): ArenaInfo & { dressing: DressItem[] } {
  const W = TONE_W;
  const H = TONE_H;
  const world = new World(W, H, seed);
  const rng = new Rng(seed ^ 0x70e);
  const nz = new Noise2D(seed);
  const { mat, bg, cav, depth, flags, surface } = world;
  const I = (x: number, y: number) => y * W + x;
  const wav = (x: number, k: number, a = 1) => Math.round(nz.noise1(x * 0.11 + k * 13.7, 2) * a);

  const host = (x: number, y: number): number => {
    if (y >= H - 2 + wav(x, 9)) return M.BEDROCK;
    if (y < SURFACE + 3 + wav(x, 1)) return M.SOIL;
    if (y < 19 + wav(x, 3)) {
      const band = 11 + wav(x, 4);
      return y >= band && y <= band + 1 ? M.SANDSTONE : M.LIMESTONE;
    }
    if (y < 24 + wav(x, 5)) return M.SHALE;
    return M.GRANITE;
  };
  for (let x = 0; x < W; x++) surface[x] = SURFACE;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = I(x, y);
      if (y < SURFACE) {
        mat[i] = bg[i] = M.AIR;
        cav[i] = CAV.SKY;
        depth[i] = 255;
      } else {
        mat[i] = bg[i] = host(x, y);
        cav[i] = CAV.SOLID;
      }
    }
  const dug = (x: number, y: number, back = host(x, y)) => {
    const i = I(x, y);
    bg[i] = back;
    mat[i] = M.AIR;
    cav[i] = CAV.DUG;
    depth[i] = 32;
  };
  const solid = (x: number, y: number, m: number) => {
    const i = I(x, y);
    mat[i] = bg[i] = m;
    cav[i] = CAV.SOLID;
    depth[i] = 0;
  };

  // ------------------------------------------------------------------ izba
  for (let y = 12; y <= 19; y++) for (let x = 3; x <= 4; x++) solid(x, y, M.STONE_BRICK); // dressed wall meets raw rock
  for (let x = 5; x <= 12; x++) solid(x, 12, M.STONE_BRICK); // built lintel under the natural roof
  for (let y = 13; y <= 18; y++) for (let x = 5; x <= 29; x++) dug(x, y, x <= 12 ? M.STONE_BRICK : host(x, y));
  for (let y = 8; y <= 10; y++) for (let x = 8; x <= 14; x++) dug(x, y);
  for (let y = 11; y <= 12; y++) dug(9, y);

  // --------------------------------------------------------------- przodek
  for (let y = 15; y <= 16; y++) for (let x = 34; x <= 46; x++) dug(x, y);
  // an iron vein crossing the face: its first column is seen, the rest lies in the unknown
  for (let y = 11; y <= 19; y++)
    for (let x = 46; x <= 52; x++) {
      const dx = (x - 48.2) / 2.1;
      const dy = (y - 15.2) / 1.6;
      if (dx * dx + dy * dy + nz.simplex(x * 0.7, y * 0.7) * 0.3 < 1 && SOLID[mat[I(x, y)]!]) mat[I(x, y)] = M.IRON;
    }

  // ----------------------------------------------------------------- zawal
  for (let y = 15; y <= 16; y++) for (let x = 56; x <= 73; x++) dug(x, y);
  for (const [x, y] of [[63, 14], [64, 14], [65, 14], [66, 14], [64, 13], [65, 13]] as const) dug(x, y); // roof breakout
  for (const [x, y] of [[63, 16], [64, 16], [65, 16], [64, 15]] as const) solid(x, y, host(x, y)); // rubble mound

  // ---------------------------------------------------------- fog of war
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const unknown = x >= 47 && x <= 54 && y >= 8 && y <= 24;
      if (!unknown) flags[I(x, y)] = TF.EXPLORED;
    }

  // ---------------------------------------------------------- lights (torch props)
  const props: Prop[] = [];
  const torch = (x: number, y: number) =>
    props.push({ type: PROP.TORCH, x: x + 0.5, y: -y - 0.3, z: -0.92, scale: 1, rot: 0, attach: 'wall', anchor: I(x, y), seed: rng.nextU32() });
  torch(6, 17); // forge glow
  for (const x of [11, 17, 23, 28]) torch(x, 15);
  torch(11, 9);
  torch(35, 15); // far end of the drift: the face itself stays dark
  torch(58, 15);
  torch(71, 15);
  world.props = props;

  // ------------------------------------------------------------ set dressing
  const d: DressItem[] = [];
  const j = (a: number) => rng.range(-a, a);
  const hallFloor = -19;
  for (let x = 5; x <= 29; x++) d.push({ kind: 'planks', x: x + 0.5, y: hallFloor, z: 0 });
  for (let x = 8; x <= 14; x++) d.push({ kind: 'planks', x: x + 0.5, y: -11, z: 0 });
  d.push({ kind: 'forge', x: 7.4, y: hallFloor, z: -0.55, sx: 0.9, sy: 0.9, sz: 0.9 });
  d.push({ kind: 'anvil', x: 10.2 + j(0.1), y: hallFloor, z: -0.4 });
  d.push({ kind: 'ladder', x: 9.5, y: hallFloor, z: -0.85, sy: 8 });
  d.push({ kind: 'table', x: 15.2 + j(0.15), y: hallFloor, z: -0.62 });
  d.push({ kind: 'bench', x: 15.2, y: hallFloor, z: -0.15 });
  d.push({ kind: 'table', x: 20.4 + j(0.15), y: hallFloor, z: -0.6 });
  d.push({ kind: 'bench', x: 20.4, y: hallFloor, z: -0.14 });
  for (const [x, z] of [[23.9, -0.55], [24.5, -0.28], [25.1, -0.6]] as const) d.push({ kind: 'barrel', x: x + j(0.05), y: hallFloor, z, ry: rng.range(0, 6) });
  d.push({ kind: 'crate', x: 22.6, y: hallFloor, z: -0.35, ry: 0.3 });
  d.push({ kind: 'crate', x: 22.7, y: hallFloor + 0.45, z: -0.38, ry: -0.2 });
  d.push({ kind: 'sack', x: 26.3, y: hallFloor, z: -0.2 });
  d.push({ kind: 'sack', x: 26.7, y: hallFloor, z: -0.45 });
  d.push({ kind: 'shelf', x: 28.2, y: hallFloor, z: -0.78 });
  d.push({ kind: 'shelf', x: 12.4, y: -11, z: -0.78 });
  d.push({ kind: 'barrel', x: 10.8, y: -11, z: -0.5 });
  for (let x = 5; x <= 29; x++) d.push({ kind: 'pipe', x: x + 0.5, y: -13.3, z: -0.86 });
  // dense evening hall: timbers, a second pipe run, tools and machines on the walls, lamps, stores
  for (let x = 6; x <= 28; x += 3) d.push({ kind: 'beam', x: x + 0.5, y: -13, z: 0 });
  for (let x = 13; x <= 22; x++) d.push({ kind: 'pipe', x: x + 0.5, y: -13.75, z: -0.7 });
  d.push({ kind: 'pipe', x: 13.5, y: -16.2, z: -0.7, sx: 4.9, rz: Math.PI / 2 });
  d.push({ kind: 'valve', x: 13.5, y: -16.6, z: -0.62 });
  d.push({ kind: 'valve', x: 18.5, y: -16.2, z: -0.78 });
  d.push({ kind: 'toolrack', x: 12.9, y: hallFloor + 0.5, z: -0.9 });
  d.push({ kind: 'toolrack', x: 24.6, y: hallFloor + 0.6, z: -0.9 });
  d.push({ kind: 'gearwheel', x: 17.7, y: hallFloor, z: -0.72 });
  d.push({ kind: 'grindstone', x: 11.9, y: hallFloor, z: -0.25 });
  d.push({ kind: 'cauldron', x: 6.3, y: hallFloor, z: -0.2, sx: 0.8, sy: 0.8, sz: 0.8 });
  for (const x of [8.5, 14.5, 20.5, 26.5]) d.push({ kind: 'lantern', x: x + j(0.1), y: -13.25, z: -0.45 });
  d.push({ kind: 'chest', x: 21.8, y: hallFloor, z: -0.75 });
  d.push({ kind: 'crate', x: 23.0, y: hallFloor + 0.9, z: -0.4, ry: 0.1 });
  d.push({ kind: 'shelf', x: 26.6, y: hallFloor, z: -0.86 });
  d.push({ kind: 'shelf', x: 9.9, y: -11, z: -0.85 });
  d.push({ kind: 'sack', x: 27.6, y: hallFloor, z: -0.25 });
  d.push({ kind: 'barrel', x: 28.9, y: hallFloor, z: -0.35 });
  d.push({ kind: 'chest', x: 13.6, y: -11, z: -0.5 });
  d.push({ kind: 'pipe', x: 18.5, y: -14.6, z: -0.86, sx: 2.6, rz: Math.PI / 2 });
  for (const x of [36.5, 39.5, 42.5, 45.3]) d.push({ kind: 'support', x: x + j(0.1), y: -17, z: -0.5, sy: 2 });
  for (const x of [58.5, 60.6, 69.6, 71.5]) d.push({ kind: 'support', x: x + j(0.1), y: -17, z: -0.5, sy: 2 });
  d.push({ kind: 'brokenSupport', x: 62.4, y: -17, z: -0.45, sy: 1.6 });
  d.push({ kind: 'brokenSupport', x: 67.3, y: -17, z: -0.5, sy: 1.5, ry: Math.PI });
  for (const [x, y, s] of [[62.6, -17, 1.2], [66.6, -17, 1.0], [64.5, -15, 0.9], [65.6, -16, 0.8], [63.4, -16, 0.7]] as const) d.push({ kind: 'debris', x, y, z: -0.45 + j(0.15), sx: s, sy: s, sz: s });
  for (const [x, y] of [[63.6, -15.6], [65.2, -14.8], [64.4, -14.2], [66.2, -15.8]] as const) d.push({ kind: 'dust', x, y, z: -0.5 });
  for (const [x, y, s, rz] of [[60.6, -13.0, 1.8, 0.2], [62.4, -12.4, 2.4, -0.15], [67.4, -12.6, 2.2, 0.25], [69.6, -13.1, 1.6, -0.3], [64.0, -12.2, 1.4, 0.05]] as const)
    d.push({ kind: 'crack', x, y, z: 0, sx: s, sy: s, rz });

  // --------------------------------------------------------------- dwarves
  world.mannequins = [
    { x: 8.6, y: hallFloor, facing: -1, pose: 'dig' },
    { x: 11.2, y: hallFloor, facing: -1, pose: 'stand' },
    { x: 14.3, y: hallFloor, facing: 1, pose: 'stand' },
    { x: 17.4, y: hallFloor, facing: 1, pose: 'walk' },
    { x: 21.6, y: hallFloor, facing: -1, pose: 'stand' },
    { x: 25.8, y: hallFloor, facing: -1, pose: 'walk' },
    { x: 27.3, y: hallFloor, facing: 1, pose: 'stand' },
    { x: 12.0, y: -11, facing: -1, pose: 'stand' },
    { x: 12.4, y: hallFloor, facing: 1, pose: 'dig' },
    { x: 18.6, y: hallFloor, facing: -1, pose: 'dig' },
    { x: 23.6, y: hallFloor, facing: 1, pose: 'stand' },
    { x: 20.0, y: hallFloor, facing: 1, pose: 'stand' },
    { x: 45.9, y: -17, facing: 1, pose: 'dig' },
    { x: 60.2, y: -17, facing: -1, pose: 'walk' },
    { x: 70.4, y: -17, facing: -1, pose: 'stand' },
  ];
  return { world, poi: {}, unexplored: { x0: 47, y0: 8, x1: 54, y1: 24 }, dressing: d };
}
