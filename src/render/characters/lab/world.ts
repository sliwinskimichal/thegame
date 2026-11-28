/**
 * The dwarf tournament's stand world (owner: W3 "Technical artist", dwarf team). Own World + set dressing;
 * nothing in src/lab is changed. Every variant renders exactly this world (contract v2: the world and the
 * cameras follow CHARACTER_SCALE and the REFERENCE dwarf height, never the variant's own height).
 *
 * Areas, left to right (all sizes scale with u = reference height / 1.294 and are rounded to tiles):
 *  A  izba (a densely dressed hall: table, bench, barrels, shelves, tool rack, hanging lantern) opening into
 *     a drift with a face of iron ore, and a shaft with a ladder above the drift           (izba, grod)
 *  B  two strip corridors lit evenly by a row of torches                          (walk8, dig8, carry8)
 *  C  a wall with 8 ladders built from 1-tile segments (rungs every 0.25)                       (climb8)
 *  D  a long dark tunnel with one torch                                                        (swiatlo)
 *  E  a network of halls, tunnels and shafts with ladders, faces with ore            (okolica, bench)
 * Depths (contract): tunnels z = -0.45, ladders z = -0.85, torches z = -0.92.
 */
import { Rng } from '../../../core/rng';
import { M, SOLID } from '../../../world/materials';
import { CAV, PROP, TF, World, type Prop } from '../../../world/world';
import type { DressItem } from '../../../lab/arena';
import type { AnimWorldProbe } from '../../anim/types';
import { refHeightTiles } from '../direction';

export const TUNNEL_Z = -0.45;
export const LADDER_Z = -0.85;
export const TORCH_Z = -0.92;
/** The hall is deeper than the drifts (back wall at z = -2): its furniture stands fully behind the dwarves, so
 *  nothing intersects a figure and cuts its inverted-hull outline. */
export const HALL_DEPTH = 2;
/** Timbering and other drift dressing stands against the back wall, behind the figures (dwarf back ~ -0.75). */
export const BACK_DRESS_Z = -0.88;
/** Rungs of a 1-tile ladder segment (propsGeo 'ladder'): 0.12, 0.37, 0.62, 0.87 above the segment base. */
export const RUNG_OFFSET = 0.12;
export const RUNG_SPACING = 0.25;

export interface Span {
  /** Feet Y (top of the floor tile, world) and the x range of the walkable floor. */
  floorY: number;
  x0: number;
  x1: number;
}

export interface Shaft {
  x: number; // ladder centre (world)
  yBottom: number; // feet Y at the bottom landing
  yTop: number; // feet Y at the top landing
}

export interface StandLayout {
  /** Reference dwarf height (tiles) and the layout unit u = refH / 1.294. */
  refH: number;
  u: number;
  izba: { floorY: number; x0: number; x1: number; centerX: number; torchX: number; ceilY: number };
  grod: { floorY: number; faceX: number; torchX: number; shaft: Shaft; hallEndX: number; centerX: number };
  strips: { floors: [number, number]; centerX: number; xs: number[] };
  climb: { ladders: number[]; floorY: number; topY: number; centerX: number };
  swiatlo: { floorY: number; torchX: number; core: number[]; edge: number[]; centerX: number };
  net: { tunnels: Span[]; shafts: Shaft[]; faces: { x: number; floorY: number; dir: 1 | -1 }[]; halls: Span[]; centerX: number; centerY: number; x0: number; x1: number };
}

export interface StandWorld {
  world: World;
  dressing: DressItem[];
  layout: StandLayout;
  probe: AnimWorldProbe;
}

const REF_A = 1.294;

export function buildStandWorld(seed = 7): StandWorld {
  const refH = refHeightTiles();
  const u = refH / REF_A;
  const S = (v: number) => Math.max(1, Math.round(v * u));
  const tH = Math.max(2, Math.ceil(1.5 * refH)); // tunnel rows (2 at the reference scale)
  const hallH = Math.max(3, Math.ceil(2.3 * refH)); // hall rows (3)
  const rock = 1; // rock rows between stacked corridors
  const top = 6; // first interior row

  // ---- horizontal plan
  const xA0 = 3;
  const hallW = S(15);
  const tunW = S(12);
  const faceW = 3;
  const xB0 = xA0 + hallW + tunW + faceW + S(5);
  const stripW = S(18) + 2;
  const xC0 = xB0 + stripW + S(3);
  const climbW = S(17) + 2;
  const xD0 = xC0 + climbW + S(3);
  const darkW = S(32);
  const xE0 = xD0 + darkW + S(4);
  const netW = S(46);
  const W = xE0 + netW + 4;

  // ---- vertical plan (rows: floor rows are solid tiles, feet Y = -row)
  const floorA = top + hallH + S(8); // shaft above the drift needs headroom
  const floorB2 = floorA;
  const floorB1 = floorB2 - tH - rock;
  const climbRows = S(10);
  const floorC = floorA;
  const floorD = floorA;
  const netRows = [S(12), S(12) + tH + S(6), S(12) + 2 * (tH + S(6)), S(12) + 3 * (tH + S(6))].map((r) => r + top);
  const H = Math.max(floorA + 12, netRows[3]! + 8);

  const world = new World(W, H, seed);
  const rng = new Rng(seed ^ 0xd3a7);
  const { mat, bg, cav, depth, flags, surface } = world;
  const I = (x: number, y: number) => y * W + x;
  const SURF = 2;
  const host = (_x: number, y: number): number => {
    if (y >= H - 2) return M.BEDROCK;
    if (y < SURF + 3) return M.SOIL;
    if (y < Math.round(H * 0.32)) {
      const band = Math.round(H * 0.2);
      return y >= band && y <= band + 1 ? M.SANDSTONE : M.LIMESTONE;
    }
    if (y < Math.round(H * 0.5)) return M.SHALE;
    if (y < Math.round(H * 0.78)) return M.GRANITE;
    return M.SLATE;
  };
  for (let x = 0; x < W; x++) surface[x] = SURF;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = I(x, y);
      if (y < SURF) {
        mat[i] = bg[i] = M.AIR;
        cav[i] = CAV.SKY;
        depth[i] = 255;
      } else {
        mat[i] = bg[i] = host(x, y);
        cav[i] = CAV.SOLID;
      }
      flags[i] = TF.EXPLORED;
    }
  const dug = (x: number, y: number, back = host(x, y), dep = 32) => {
    if (x < 1 || y < 1 || x >= W - 1 || y >= H - 2) return;
    const i = I(x, y);
    bg[i] = back;
    mat[i] = M.AIR;
    cav[i] = CAV.DUG;
    depth[i] = dep;
  };
  const room = (x0: number, x1: number, r0: number, r1: number, back?: number, dep = 32) => {
    for (let y = r0; y <= r1; y++) for (let x = x0; x <= x1; x++) dug(x, y, back ?? host(x, y), dep);
  };
  const props: Prop[] = [];
  const torch = (x: number, row: number, z = TORCH_Z) =>
    props.push({ type: PROP.TORCH, x: x + 0.5, y: -row - 0.3, z, scale: 1, rot: 0, attach: 'wall', anchor: I(x, row), seed: rng.nextU32() });
  const d: DressItem[] = [];
  const planks = (x0: number, x1: number, floorRow: number) => {
    for (let x = x0; x <= x1; x++) d.push({ kind: 'planks', x: x + 0.5, y: -floorRow, z: 0 });
  };
  const ladder = (x: number, rowTop: number, rowBottom: number) => {
    for (let r = rowTop; r <= rowBottom; r++) d.push({ kind: 'ladder', x, y: -(r + 1), z: LADDER_Z });
  };

  // ------------------------------------------------------------------ A: izba + drift + face + shaft
  const hallX0 = xA0 + 1;
  const hallX1 = hallX0 + hallW - 1;
  for (let y = floorA - hallH - 1; y < floorA; y++) for (const x of [hallX0 - 1]) mat[I(x, y)] = bg[I(x, y)] = M.STONE_BRICK; // dressed wall
  room(hallX0, hallX1, floorA - hallH, floorA - 1, undefined, HALL_DEPTH * 32);
  for (let x = hallX0; x <= hallX0 + S(5); x++) for (let y = floorA - hallH; y < floorA; y++) bg[I(x, y)] = M.STONE_BRICK; // built back wall in part
  const tunX0 = hallX1 + 1;
  const tunX1 = tunX0 + tunW - 1;
  room(tunX0, tunX1, floorA - tH, floorA - 1);
  const faceX = tunX1 + 1;
  for (let y = floorA - tH - 1; y <= floorA - 1; y++)
    for (let x = faceX; x < faceX + faceW; x++) {
      const dx = (x - faceX - 0.6) / 1.8;
      const dy = (y - (floorA - tH / 2 - 0.5)) / 1.7;
      if (dx * dx + dy * dy < 1 && SOLID[mat[I(x, y)]!]) mat[I(x, y)] = M.IRON;
    }
  const shaftX = tunX0 + S(4);
  const shaftTop = floorA - tH - S(6);
  room(shaftX, shaftX + 1, shaftTop, floorA - tH - 1);
  room(shaftX - S(3), shaftX + 1, shaftTop - tH + 1, shaftTop - 1); // upper landing
  ladder(shaftX + 0.5, shaftTop - 1, floorA - 1);
  const izbaCenter = hallX0 + Math.round(hallW * 0.42);
  const izbaTorch = izbaCenter;
  const hallTorchZ = -HALL_DEPTH + 0.08;
  // three sources ~6–7 tiles apart (as the engine's tone scenes): over the line-up, at the forge, at the far end
  torch(izbaTorch, floorA - hallH, hallTorchZ);
  torch(hallX0 + 1, floorA - hallH + 1, hallTorchZ);
  torch(hallX1 - 1, floorA - hallH, hallTorchZ);
  const drTorch = shaftX - 2;
  torch(drTorch, floorA - tH);
  torch(shaftX - S(2), shaftTop - tH + 1);
  planks(hallX0, hallX1, floorA);
  const fy = -floorA;
  const zj = (a: number) => rng.range(-a, a);
  // dense evening hall: every piece of furniture stands fully behind the figures (dwarf back at z ~ -0.75)
  const B = -HALL_DEPTH; // back wall
  d.push({ kind: 'forge', x: hallX0 + 1.2, y: fy, z: B + 0.5, sx: 0.8, sy: 0.8, sz: 0.8 });
  d.push({ kind: 'anvil', x: hallX0 + 2.6, y: fy, z: -1.1 });
  d.push({ kind: 'table', x: izbaCenter - 0.4 + zj(0.1), y: fy, z: -1.3 });
  d.push({ kind: 'bench', x: izbaCenter - 0.4, y: fy, z: -1.82, sx: 0.9 });
  d.push({ kind: 'barrel', x: izbaCenter - 2.4, y: fy, z: -1.15, ry: rng.range(0, 6) });
  d.push({ kind: 'barrel', x: izbaCenter - 1.85, y: fy, z: -1.55, ry: rng.range(0, 6) });
  d.push({ kind: 'shelf', x: izbaCenter + 1.9, y: fy, z: B + 0.2 });
  d.push({ kind: 'toolrack', x: izbaCenter + 0.6, y: fy + 0.55, z: B + 0.07 });
  d.push({ kind: 'crate', x: izbaCenter + 3.0, y: fy, z: -1.3, ry: 0.25 });
  d.push({ kind: 'crate', x: izbaCenter + 3.05, y: fy + 0.45, z: -1.32, ry: -0.2 });
  d.push({ kind: 'sack', x: izbaCenter + 3.7, y: fy, z: -1.05 });
  d.push({ kind: 'chest', x: izbaCenter - 3.3, y: fy, z: -1.6 });
  d.push({ kind: 'bench', x: hallX0 + 0.9, y: fy, z: -0.18, sx: 0.7 }); // foreground, clear of the line-up
  d.push({ kind: 'barrel', x: hallX1 - 0.6, y: fy, z: -0.3, ry: 1.1 }); // foreground, right edge
  d.push({ kind: 'lantern', x: izbaCenter - 1.4, y: -(floorA - hallH), z: -1.2 });
  d.push({ kind: 'lantern', x: izbaCenter + 1.6, y: -(floorA - hallH), z: -1.45 });
  for (let x = hallX0 + 1; x <= hallX1; x += 3) d.push({ kind: 'beam', x: x + 0.5, y: -(floorA - hallH), z: 0, sz: HALL_DEPTH });
  for (let x = hallX0; x <= hallX1; x++) d.push({ kind: 'pipe', x: x + 0.5, y: -(floorA - hallH) - 0.3, z: B + 0.12 });
  d.push({ kind: 'shelf', x: hallX1 - 2.2, y: fy, z: B + 0.18 });
  d.push({ kind: 'grindstone', x: hallX1 - 3.6, y: fy, z: -1.3 });
  // drift: timbering against the back wall
  for (let x = tunX0 + 1; x <= tunX1 - 1; x += 3) d.push({ kind: 'support', x: x + 0.5, y: fy, z: BACK_DRESS_Z, sy: tH * 0.98 });
  d.push({ kind: 'debris', x: faceX - 0.9, y: fy, z: -0.82, sx: 0.6, sy: 0.6, sz: 0.6 });

  // ------------------------------------------------------------------ B: strip corridors
  const sx0 = xB0;
  const sx1 = xB0 + stripW - 1;
  room(sx0, sx1, floorB1 - tH, floorB1 - 1);
  room(sx0, sx1, floorB2 - tH, floorB2 - 1);
  // identical light for every dwarf of a strip: integer tile spacing, dwarves on tile centres, one torch per
  // dwarf at the same offset (period = spacing; the light field is per tile)
  const stripStep = Math.max(2, Math.round(2 * u));
  const stripX0 = Math.floor((sx0 + sx1 + 1) / 2 - 3.5 * stripStep);
  const stripXs = Array.from({ length: 8 }, (_, k) => stripX0 + k * stripStep + 0.5);
  const stripCenter = (stripXs[0]! + stripXs[7]!) / 2;
  for (const f of [floorB1, floorB2]) {
    for (const x of stripXs) torch(Math.floor(x) - 1, f - tH);
    planks(sx0, sx1, f);
  }

  // ------------------------------------------------------------------ C: wall of ladders
  const cx0 = xC0;
  const cx1 = xC0 + climbW - 1;
  const climbTop = floorC - climbRows;
  room(cx0, cx1, climbTop, floorC - 1);
  const ladX0 = Math.floor((cx0 + cx1 + 1) / 2 - 3.5 * stripStep);
  const ladders = Array.from({ length: 8 }, (_, k) => ladX0 + k * stripStep + 0.5);
  const climbCenter = (ladders[0]! + ladders[7]!) / 2;
  for (const lx of ladders) {
    ladder(lx, climbTop, floorC - 1);
    // the same two torches beside every ladder: identical light on every climber
    torch(Math.floor(lx) - 1, climbTop + Math.round(climbRows * 0.3));
    torch(Math.floor(lx) - 1, climbTop + Math.round(climbRows * 0.72));
  }
  planks(cx0, cx1, floorC);

  // ------------------------------------------------------------------ D: long dark tunnel, one torch
  const dx0 = xD0;
  const dx1 = xD0 + darkW - 1;
  room(dx0, dx1, floorD - tH, floorD - 1);
  const dTorch = dx0 + S(9);
  torch(dTorch, floorD - tH);
  const dc = dTorch + 0.5;
  const core = [-1.8, -0.6, 0.6, 1.8].map((o) => dc + o * u);
  const edge = [6.4, 7.6, 8.8, 10.0].map((o) => dc + o * u);
  for (let x = dx0 + 2; x <= dx1 - 2; x += 4) d.push({ kind: 'support', x: x + 0.5, y: -floorD, z: BACK_DRESS_Z, sy: tH * 0.98 });

  // ------------------------------------------------------------------ E: network
  const ex0 = xE0;
  const ex1 = xE0 + netW - 1;
  const tunnels: Span[] = [];
  const faces: StandLayout['net']['faces'] = [];
  const halls: Span[] = [];
  const shafts: Shaft[] = [];
  const spans = [
    [0.05, 0.95],
    [0.0, 0.8],
    [0.12, 1.0],
    [0.02, 0.9],
  ] as const;
  netRows.forEach((f, k) => {
    const a = ex0 + Math.round(spans[k]![0] * (netW - 1));
    const b = ex0 + Math.round(spans[k]![1] * (netW - 1));
    room(a, b, f - tH, f - 1);
    tunnels.push({ floorY: -f, x0: a + 0.5, x1: b + 0.5 });
    planks(a, b, f);
    for (let x = a + 3; x <= b - 3; x += 7) torch(x, f - tH);
    for (let x = a + 5; x <= b - 4; x += 6) d.push({ kind: 'support', x: x + 0.5, y: -f, z: BACK_DRESS_Z, sy: tH * 0.98 });
    // a face of ore at one or both ends
    const ores = [M.COPPER, M.IRON, M.COAL, M.SILVER];
    for (const [fx, dir] of [
      [b + 1, 1],
      [a - 1, -1],
    ] as const) {
      if (fx <= ex0 || fx >= ex1) continue;
      for (let y = f - tH - 1; y <= f; y++) for (let xx = fx; xx !== fx + dir * 3; xx += dir) if (SOLID[mat[I(xx, y)]!] && rng.chance(0.7)) mat[I(xx, y)] = ores[k]!;
      faces.push({ x: fx + 0.5, floorY: -f, dir });
    }
    // a hall on the level
    const hx = a + Math.round((b - a) * (0.25 + 0.4 * (k % 2)));
    const hw = S(9);
    room(hx, hx + hw - 1, f - hallH, f - 1, undefined, HALL_DEPTH * 32);
    halls.push({ floorY: -f, x0: hx + 0.5, x1: hx + hw - 0.5 });
    torch(hx + 2, f - hallH, -HALL_DEPTH + 0.08);
    torch(hx + hw - 3, f - hallH, -HALL_DEPTH + 0.08);
    d.push({ kind: 'table', x: hx + hw * 0.5, y: -f, z: -1.3 });
    d.push({ kind: 'barrel', x: hx + 1.2, y: -f, z: -1.2 });
    d.push({ kind: 'shelf', x: hx + hw - 1.5, y: -f, z: -1.8 });
  });
  // shafts with ladders between consecutive levels
  for (let k = 0; k < 3; k++) {
    const t = tunnels[k]!;
    const bt = tunnels[k + 1]!;
    const lo = Math.max(t.x0, bt.x0) + 2;
    const hi = Math.min(t.x1, bt.x1) - 2;
    for (const frac of k % 2 ? [0.2, 0.75] : [0.45]) {
      const x = Math.floor(lo + (hi - lo) * frac);
      const r0 = -t.floorY;
      const r1 = -bt.floorY - 1;
      room(x, x, r0, r1);
      ladder(x + 0.5, r0 - tH, r1);
      shafts.push({ x: x + 0.5, yBottom: bt.floorY, yTop: t.floorY });
    }
  }
  world.props = props;
  world.mannequins = [];

  const layout: StandLayout = {
    refH,
    u,
    izba: { floorY: fy, x0: hallX0, x1: hallX1 + 1, centerX: izbaCenter + 0.5, torchX: izbaTorch + 0.5, ceilY: -(floorA - hallH) },
    grod: { floorY: fy, faceX, torchX: drTorch + 0.5, shaft: { x: shaftX + 0.5, yBottom: fy, yTop: -shaftTop + 1 }, hallEndX: hallX1 + 1, centerX: (hallX1 + faceX) / 2 + 0.5 },
    strips: { floors: [-floorB1, -floorB2], centerX: stripCenter, xs: stripXs },
    climb: { ladders, floorY: -floorC, topY: -climbTop, centerX: climbCenter },
    swiatlo: { floorY: -floorD, torchX: dc, core, edge, centerX: (core[0]! + edge[3]!) / 2 },
    net: { tunnels, shafts, faces, halls, centerX: (ex0 + ex1 + 1) / 2, centerY: -(netRows[0]! + netRows[3]!) / 2 + refH * 0.5, x0: ex0, x1: ex1 + 1 },
  };
  return { world, dressing: d, layout, probe: standProbe(world) };
}

/** Read-only world probe for the animator (feet IK on floors, rungs of the 1-tile ladder segments). */
export function standProbe(world: World): AnimWorldProbe {
  const solid = (x: number, r: number) => world.isSolid(x, r);
  return {
    floorAt(x: number, y: number): number {
      const cx = Math.floor(x);
      const r = Math.round(-y);
      for (const dr of [0, 1, -1]) {
        const rr = r + dr;
        if (solid(cx, rr) && !solid(cx, rr - 1)) return -rr;
      }
      return Number.NaN;
    },
    ladder: { rungSpacing: RUNG_SPACING, rungOffset: RUNG_OFFSET, z: LADDER_Z },
    playZ: () => TUNNEL_Z,
  };
}

/** Feet Y of the rung nearest to y (ladders of 1-tile segments). */
export function rungY(y: number): number {
  return Math.round((y - RUNG_OFFSET) / RUNG_SPACING) * RUNG_SPACING + RUNG_OFFSET;
}
