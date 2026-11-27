/**
 * Test fixtures for navigation: ASCII worlds, path validation, finder sets.
 *
 * Legend: '#' rock, '.' air, 'H' ladder, '=' platform, '/' stairs rising to
 * the right, '\' stairs rising to the left, '~' deep water, 'L' lava,
 * 'D' wooden door, 'I' iron door, 'X' locked door; any letter a-z or 'S'/'G'
 * marks an open cell and is returned in `marks`.
 */
import { buildArena } from '../../src/lab/arena';
import { M, SOLID } from '../../src/world/materials';
import { CAV, FLUID, World } from '../../src/world/world';
import { AStar, type PathFinder } from '../../src/sim/nav/astar';
import type { NavGrid } from '../../src/sim/nav/grid';
import { HpaStar } from '../../src/sim/nav/hpa';
import type { Path } from '../../src/sim/nav/search';
import { INFRA, INFRA_LOCKED, INFRA_RISE_RIGHT, MOVE_NONE } from '../../src/sim/nav/types';
import type { NavScenario } from '../../src/sim/nav/testmaps';

export interface AsciiWorld {
  world: World;
  infra: Uint8Array;
  marks: Record<string, number>;
}

export function ascii(rows: readonly string[]): AsciiWorld {
  const h = rows.length;
  const w = rows[0].length;
  const world = new World(w, h, 1);
  const infra = new Uint8Array(w * h);
  const marks: Record<string, number> = {};
  for (let y = 0; y < h; y++) {
    if (rows[y].length !== w) throw new Error(`row ${y} has length ${rows[y].length}, expected ${w}`);
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      const i = y * w + x;
      world.mat[i] = ch === '#' ? M.GRANITE : M.AIR;
      world.cav[i] = ch === '#' ? CAV.SOLID : CAV.DUG;
      if (ch === 'H') infra[i] = INFRA.LADDER;
      else if (ch === '=') infra[i] = INFRA.PLATFORM;
      else if (ch === '/') infra[i] = INFRA.STAIRS | INFRA_RISE_RIGHT;
      else if (ch === '\\') infra[i] = INFRA.STAIRS;
      else if (ch === 'D') infra[i] = INFRA.DOOR_WOOD;
      else if (ch === 'I') infra[i] = INFRA.DOOR_IRON;
      else if (ch === 'X') infra[i] = INFRA.DOOR_WOOD | INFRA_LOCKED;
      else if (ch === '~' || ch === 'L') {
        world.fluid[i] = 255;
        world.fluidKind[i] = ch === '~' ? FLUID.WATER : FLUID.LAVA;
      } else if (/[a-zA-Z]/.test(ch)) marks[ch] = i;
    }
  }
  return { world, infra, marks };
}

/** Every edge exists in the grid and the edge costs add up to the reported cost. */
export function pathProblems(grid: NavGrid, p: number, path: Path, start: number, goals: readonly number[]): string[] {
  const errs: string[] = [];
  const { cells, moves, links } = path;
  if (path.length === 0) return ['empty path'];
  if (cells[0] !== start) errs.push(`starts at ${cells[0]}, expected ${start}`);
  if (moves[0] !== MOVE_NONE) errs.push('first node has a move');
  if (!goals.includes(path.last())) errs.push(`ends at ${path.last()}, not a goal`);
  let cost = 0;
  for (let k = 1; k < path.length; k++) {
    if (!grid.hasEdge(p, cells[k - 1], cells[k], moves[k], links[k])) {
      errs.push(`missing edge ${cells[k - 1]} -> ${cells[k]} (move ${moves[k]}) at step ${k}`);
      break;
    }
    cost += grid.edgeCost(p, cells[k - 1], cells[k], moves[k], links[k]);
  }
  if (errs.length === 0 && cost !== path.cost) errs.push(`edge costs sum to ${cost}, path says ${path.cost}`);
  return errs;
}

/** The algorithms under test; cluster sizes scaled to the map. */
export function finderSet(grid: NavGrid, p = 0, clusters: readonly number[] = [4, 8]): PathFinder[] {
  return [
    new AStar(grid, p),
    new AStar(grid, p, { jumps: true }),
    ...clusters.map((c) => new HpaStar(grid, p, { cluster: c })),
  ];
}

/**
 * The lab arena made navigable: a ladder down the dug shaft, a gallery and a
 * ladder shaft from the tunnel into the granite cave, a ladder shaft from the
 * tunnel down into the fungal cavern.
 */
export function arenaScenario(): NavScenario {
  const { world } = buildArena();
  const W = world.w;
  const infra = new Uint8Array(world.size);
  const I = (x: number, y: number) => y * W + x;
  const digTo = (x: number, y: number) => {
    if (SOLID[world.mat[I(x, y)]] && world.mat[I(x, y)] !== M.BEDROCK) world.dig(x, y);
  };
  for (let y = 10; y <= 19; y++) infra[I(16, y)] = INFRA.LADDER;
  // gallery east from the tunnel, then down into the granite cave
  for (let x = 35; x <= 40; x++) {
    digTo(x, 18);
    digTo(x, 19);
  }
  let y = 20;
  while (y < world.h - 4 && SOLID[world.mat[I(40, y)]]) digTo(40, y++);
  while (y < world.h - 4 && !SOLID[world.mat[I(40, y + 1)]]) y++;
  for (let yy = 20; yy <= y; yy++) infra[I(40, yy)] = INFRA.LADDER;
  // ladder shaft from the tunnel floor down into the fungal cavern
  y = 20;
  while (y < world.h - 4 && SOLID[world.mat[I(26, y)]]) digTo(26, y++);
  while (y < world.h - 4 && !SOLID[world.mat[I(26, y + 1)]]) y++;
  for (let yy = 20; yy <= y; yy++) infra[I(26, yy)] = INFRA.LADDER;
  return {
    name: 'arena 64×46',
    world,
    infra,
    lifts: [],
    rails: [],
    ropes: [],
    bridges: [],
    poi: { meadow: I(8, 9), tunnel: I(24, 19), workshop: I(31, 19), cave: I(48, 31), fungal: I(20, 41) },
  };
}
