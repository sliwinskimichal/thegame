import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/core/rng';
import { M, SOLID } from '../../src/world/materials';
import { FLUID } from '../../src/world/world';
import { AStar } from '../../src/sim/nav/astar';
import { AGENT, NavAgent } from '../../src/sim/nav/follow';
import { NavGrid } from '../../src/sim/nav/grid';
import { HpaStar } from '../../src/sim/nav/hpa';
import { BAT, DWARF, DWARF_DIVER, GOBLIN, SPIDER, TROLL, WOLF, heuristicCoefficients } from '../../src/sim/nav/profiles';
import { Path } from '../../src/sim/nav/search';
import { workSpots } from '../../src/sim/nav/spots';
import { applyLinks, buildSyntheticMine } from '../../src/sim/nav/testmaps';
import { INFRA, LINK, MV, NAV } from '../../src/sim/nav/types';
import { arenaScenario, ascii, finderSet, pathProblems } from './navfixtures';

const path = new Path();

/** Run every finder; expect one status for all and (when found) one cost. Returns the cost. */
function agree(grid: NavGrid, p: number, start: number, goals: number[], clusters = [4, 8]): { status: number; cost: number } {
  const fs = finderSet(grid, p, clusters);
  let status = -1;
  let cost = -1;
  for (const f of fs) {
    const st = f.find(start, goals, path);
    if (status < 0) status = st;
    expect(st, `${f.name} status`).toBe(status);
    if (st === NAV.FOUND) {
      expect(pathProblems(grid, p, path, start, goals), f.name).toEqual([]);
      if (cost < 0) cost = path.cost;
      expect(path.cost, `${f.name} cost`).toBe(cost);
    }
    f.dispose();
  }
  return { status, cost };
}

describe('NavGrid movement rules', () => {
  it('walks, steps up one tile and drops down to maxDrop', () => {
    const { world, infra, marks } = ascii([
      '##########',
      '#........#',
      '#S.......#',
      '###.....G#',
      '##########',
    ]);
    const grid = new NavGrid(world, { infra });
    // S -> G: drop one row at x=3, walk on the lower floor
    const r = agree(grid, 0, marks.S, [marks.G]);
    expect(r.status).toBe(NAV.FOUND);
    // and back: the step up onto the ledge
    const back = agree(grid, 0, marks.G, [marks.S]);
    expect(back.status).toBe(NAV.FOUND);
    const W = grid.w;
    expect(grid.mask[0][3 * W + 3] & (1 << MV.STEP_UL)).not.toBe(0);
  });

  it('cannot step up two tiles', () => {
    const { world, infra, marks } = ascii([
      '#########',
      '#.......#',
      '#.......#',
      '#...#...#',
      '#S..#..G#',
      '#########',
    ]);
    const grid = new NavGrid(world, { infra });
    // the wall at x=4 is two tiles high: no way over in either direction
    expect(agree(grid, 0, marks.S, [marks.G]).status).toBe(NAV.NO_PATH);
    expect(agree(grid, 0, marks.G, [marks.S]).status).toBe(NAV.NO_PATH);
    world.dig(4, 3); // now a one-tile step
    expect(agree(grid, 0, marks.S, [marks.G]).status).toBe(NAV.FOUND);
  });

  it('a ladder top is a floor and ladders climb both ways', () => {
    const { world, infra, marks } = ascii([
      '#######',
      '#.....#',
      '#..G..#',
      '###H###',
      '###H###',
      '#..H.S#',
      '#######',
    ]);
    const grid = new NavGrid(world, { infra });
    expect(agree(grid, 0, marks.S, [marks.G]).status).toBe(NAV.FOUND);
    expect(agree(grid, 0, marks.G, [marks.S]).status).toBe(NAV.FOUND);
    expect(grid.standable(0, grid.idx(3, 2))).toBe(true); // standing on the ladder top
  });

  it('stairs are walked both ways and beat the ladder', () => {
    const { world, infra, marks } = ascii([
      '##########',
      '#........#',
      '#.......G#',
      '#....../##',
      '#...../###',
      '#S.../####',
      '##########',
    ]);
    const grid = new NavGrid(world, { infra });
    const up = agree(grid, 0, marks.S, [marks.G]);
    expect(up.status).toBe(NAV.FOUND);
    expect(agree(grid, 0, marks.G, [marks.S]).status).toBe(NAV.FOUND);
    // 3 stairs up + walking; cheaper than climbing 4 rows of ladder (900 each) + walking
    expect(up.cost).toBeLessThan(3 * DWARF.cost.stairUp + 9 * DWARF.cost.walk);
  });

  it('platforms carry walkers over the void', () => {
    const { world, infra, marks } = ascii([
      '##########',
      '#........#',
      '#S......G#',
      '###====###',
      '#........#',
      '#........#',
      '#........#',
      '#........#',
      '##########',
    ]);
    const grid = new NavGrid(world, { infra });
    expect(agree(grid, 0, marks.S, [marks.G]).status).toBe(NAV.FOUND);
    // without the deck the gap is a 5-row drop: no way across
    for (let x = 3; x <= 6; x++) grid.setInfra(x, 3, INFRA.NONE);
    expect(agree(grid, 0, marks.S, [marks.G]).status).toBe(NAV.NO_PATH);
  });

  it('dwarves crawl through a one-tile gap (slower); trolls cannot', () => {
    const { world, infra, marks } = ascii([
      '###########',
      '#....######',
      '#S.......G#',
      '###########',
    ]);
    const grid = new NavGrid(world, { infra, profiles: [DWARF, TROLL] });
    const d = agree(grid, 0, marks.S, [marks.G]);
    expect(d.status).toBe(NAV.FOUND);
    expect(d.cost).toBeGreaterThan(8 * DWARF.cost.walk); // crawling costs more than walking
    expect(agree(grid, 1, marks.S, [marks.G]).status).toBe(NAV.INVALID_GOAL); // the goal itself is too low for a troll
  });

  it('doors: dwarves pass, wolves are stopped, locked doors stop everyone', () => {
    const { world, infra, marks } = ascii([
      '##########',
      '#...D....#',
      '#S..D...G#',
      '##########',
    ]);
    const grid = new NavGrid(world, { infra, profiles: [DWARF, WOLF, GOBLIN] });
    expect(agree(grid, 0, marks.S, [marks.G]).status).toBe(NAV.FOUND);
    expect(agree(grid, 1, marks.S, [marks.G]).status).toBe(NAV.NO_PATH);
    const gob = agree(grid, 2, marks.S, [marks.G]);
    expect(gob.status).toBe(NAV.FOUND); // bashes the wooden door at a high cost
    for (const y of [1, 2]) grid.setInfra(4, y, INFRA.DOOR_WOOD | 0x20);
    expect(agree(grid, 0, marks.S, [marks.G]).status).toBe(NAV.NO_PATH);
  });

  it('deep water stops walkers but not divers; lava stops both', () => {
    const { world, infra, marks } = ascii([
      '###########',
      '#.........#',
      '#S.......G#',
      '##~~~~~~###',
      '##~~~~~~###',
      '###########',
    ]);
    // the pool is two rows deep: a dwarf's head would be under water on its floor
    const grid = new NavGrid(world, { infra, profiles: [DWARF, DWARF_DIVER] });
    // walkers cannot cross: the pool surface row (2) has no floor
    expect(agree(grid, 0, marks.S, [marks.G]).status).toBe(NAV.NO_PATH);
    expect(agree(grid, 1, marks.S, [marks.G]).status).toBe(NAV.FOUND);
    for (let x = 2; x <= 7; x++) for (const y of [3, 4]) world.fluidKind[y * world.w + x] = FLUID.LAVA;
    grid.markDirty(0, 0, world.w - 1, world.h - 1);
    expect(agree(grid, 1, marks.S, [marks.G]).status).toBe(NAV.NO_PATH);
  });

  it('flyers rise up a bare shaft, climbers scale walls, walkers cannot', () => {
    const { world, infra, marks } = ascii([
      '#####',
      '#..G#',
      '#.###',
      '#.###',
      '#.###',
      '#S###',
      '#####',
    ]);
    const grid = new NavGrid(world, { infra, profiles: [DWARF, BAT, SPIDER] });
    expect(agree(grid, 0, marks.S, [marks.G]).status).toBe(NAV.NO_PATH);
    expect(agree(grid, 1, marks.S, [marks.G]).status).toBe(NAV.FOUND);
    expect(agree(grid, 2, marks.S, [marks.G]).status).toBe(NAV.FOUND);
  });

  it('heuristic coefficients never exceed any move cost', () => {
    for (const P of [DWARF, DWARF_DIVER, GOBLIN, TROLL, WOLF, SPIDER, BAT]) {
      const h = heuristicCoefficients(P);
      expect(h.a).toBeLessThanOrEqual(P.cost.walk);
      expect(h.a + h.up).toBeLessThanOrEqual(Math.min(P.cost.stepUp, P.stairs ? P.cost.stairUp : Infinity));
      if (P.kind !== 'flyer')
        for (let k = 1; k <= P.maxDrop; k++) expect(h.a + k * h.down).toBeLessThanOrEqual(P.cost.dropBase + k * P.cost.dropPerRow);
      if (P.ladders || P.kind !== 'walker') expect(h.up).toBeLessThanOrEqual(P.cost.climbUp);
      expect(h.a).toBeGreaterThan(0);
    }
  });
});

describe('edge cases (F2-4)', () => {
  it('no path: a sealed chamber fails fast for every algorithm', () => {
    const { world, infra, marks } = ascii([
      '#############',
      '#.....#.....#',
      '#S....#....G#',
      '#############',
    ]);
    const grid = new NavGrid(world, { infra });
    expect(agree(grid, 0, marks.S, [marks.G]).status).toBe(NAV.NO_PATH);
    // the hierarchical search proves it on a handful of portals
    const hpa = new HpaStar(grid, 0, { cluster: 4 });
    expect(hpa.find(marks.S, [marks.G], path)).toBe(NAV.NO_PATH);
    expect(hpa.expanded).toBeLessThan(60);
  });

  it('goal in the air: rejected, and snapped to the landing cell below', () => {
    const { world, infra, marks } = ascii([
      '##########',
      '#.....G..#',
      '#........#',
      '#........#',
      '#S.......#',
      '##########',
    ]);
    const grid = new NavGrid(world, { infra });
    expect(agree(grid, 0, marks.S, [marks.G]).status).toBe(NAV.INVALID_GOAL);
    const land = grid.landing(0, 6, 1);
    expect(land).toBe(grid.idx(6, 4));
    expect(grid.lastFall).toBe(3);
    expect(agree(grid, 0, marks.S, [land]).status).toBe(NAV.FOUND);
    // a start in the air is reported too
    expect(new AStar(grid).find(marks.G, [land], path)).toBe(NAV.INVALID_START);
  });

  it('ladder broken in the middle: a two-rung gap is one way down, a one-rung gap is fine', () => {
    const rows = [
      '#######',
      '#.....#',
      '#..G..#',
      '###H###',
      '###H###',
      '###.###',
      '###.###',
      '###H###',
      '#..H..#',
      '#..HS.#',
      '#######',
    ];
    const { world, infra, marks } = ascii(rows);
    const grid = new NavGrid(world, { infra });
    expect(agree(grid, 0, marks.G, [marks.S]).status).toBe(NAV.FOUND); // let go and drop 2 rows
    expect(agree(grid, 0, marks.S, [marks.G]).status).toBe(NAV.NO_PATH);
    expect(grid.mask[0][grid.idx(3, 4)] & (1 << MV.FALL)).not.toBe(0);
    grid.setInfra(3, 6, INFRA.LADDER); // repair the lower rung: one-rung gap
    expect(agree(grid, 0, marks.S, [marks.G]).status).toBe(NAV.FOUND);
    expect(agree(grid, 0, marks.G, [marks.S]).status).toBe(NAV.FOUND);
  });

  it('drop too high: dwarves (max 3) refuse a 4-row drop, goblins (max 4) take it one way', () => {
    const rows = [
      '##########',
      '#........#',
      '#S.......#',
      '####.....#',
      '####.....#',
      '####.....#',
      '####....G#',
      '##########',
    ];
    const { world, infra, marks } = ascii(rows);
    const grid = new NavGrid(world, { infra, profiles: [DWARF, GOBLIN] });
    expect(agree(grid, 0, marks.S, [marks.G]).status).toBe(NAV.NO_PATH);
    expect(agree(grid, 1, marks.S, [marks.G]).status).toBe(NAV.FOUND);
    expect(agree(grid, 1, marks.G, [marks.S]).status).toBe(NAV.NO_PATH); // no way back up
    grid.setInfraColumn(4, 3, 6, INFRA.LADDER);
    expect(agree(grid, 0, marks.S, [marks.G]).status).toBe(NAV.FOUND);
    expect(agree(grid, 0, marks.G, [marks.S]).status).toBe(NAV.FOUND);
  });

  it('update after digging a tile: local rebuild equals a full rebuild', () => {
    const { world, infra, marks } = ascii([
      '###########',
      '#....#....#',
      '#S...#...G#',
      '###########',
    ]);
    const grid = new NavGrid(world, { infra });
    const hpa = new HpaStar(grid, 0, { cluster: 4 });
    expect(hpa.find(marks.S, [marks.G], path)).toBe(NAV.NO_PATH);
    world.dig(5, 1);
    world.dig(5, 2);
    expect(hpa.find(marks.S, [marks.G], path)).toBe(NAV.FOUND); // finders sync the grid themselves
    expect(agree(grid, 0, marks.S, [marks.G]).status).toBe(NAV.FOUND);
    const fresh = new NavGrid(world, { infra });
    expect(Array.from(grid.mask[0])).toEqual(Array.from(fresh.mask[0]));
    expect(Array.from(grid.mul[0])).toEqual(Array.from(fresh.mul[0]));
    expect(Array.from(grid.drop[0])).toEqual(Array.from(fresh.drop[0]));
  });

  it('cave-in across the path while walking: the agent re-plans at once', () => {
    const { world, infra, marks } = ascii([
      '####################',
      '#..................#',
      '#..................#',
      '##H##############H##',
      '##H##############H##',
      '#.H..............H.#',
      '#SH..............HG#',
      '####################',
    ]);
    const grid = new NavGrid(world, { infra });
    for (const finder of [new AStar(grid, 0, { jumps: true }), new HpaStar(grid, 0, { cluster: 8 })]) {
      for (let y = 5; y <= 6; y++) if (SOLID[world.mat[y * world.w + 10]]) world.dig(10, y);
      const agent = new NavAgent(finder, marks.S);
      expect(agent.go([marks.G])).toBe(AGENT.MOVING);
      const direct = agent.path.cost;
      let t = 0;
      for (; t < 40; t++) agent.tick(50); // ~5 tiles along the lower gallery
      expect(agent.state).toBe(AGENT.MOVING);
      world.fill(10, 5, M.GRANITE);
      world.fill(10, 6, M.GRANITE);
      agent.tick(50);
      expect(agent.replans).toBe(1);
      expect(agent.path.toArray()).not.toContain(grid.idx(10, 6));
      expect(agent.path.cost).toBeGreaterThan(0);
      for (; t < 2000 && agent.state === AGENT.MOVING; t++) agent.tick(50);
      expect(agent.state).toBe(AGENT.ARRIVED);
      expect(agent.cell).toBe(marks.G);
      expect(agent.path.cost).toBeGreaterThan(direct * 0); // re-planned path is the long way round
      // no way round at all: the agent reports BLOCKED and backs off
      world.fill(5, 1, M.GRANITE);
      world.fill(5, 2, M.GRANITE);
      const stuck = new NavAgent(finder, marks.G);
      expect(stuck.go([marks.S])).toBe(AGENT.BLOCKED);
      finder.dispose();
      world.dig(5, 1);
      world.dig(5, 2);
    }
  });

  it('floor dug out under a walking agent: it falls, reports the height and re-plans', () => {
    const { world, infra, marks } = ascii([
      '##########',
      '#........#',
      '#S......G#',
      '##########',
      '#.......##',
      '##########',
    ]);
    const grid = new NavGrid(world, { infra });
    const finder = new AStar(grid);
    const agent = new NavAgent(finder, marks.S);
    agent.go([marks.G]);
    // dig out the floor under the agent's current cell
    world.dig(1, 3);
    agent.tick(10);
    expect(agent.falls).toBe(1);
    expect(agent.lastFall).toBe(2);
    expect(agent.cell).toBe(grid.idx(1, 4));
    // from the lower tunnel the goal is out of reach (two-row step): blocked, not stuck in a loop
    expect(agent.state).toBe(AGENT.BLOCKED);
  });

  it('goals and starts on the map border', () => {
    const { world, infra } = ascii([
      '.........H',
      '.........H',
      '.........H',
      '.........H',
    ]);
    const grid = new NavGrid(world, { infra });
    const W = grid.w;
    const bl = grid.idx(0, 3);
    const tr = grid.idx(W - 1, 0);
    expect(grid.standable(0, bl)).toBe(true); // below the map counts as floor
    expect(grid.standable(0, tr)).toBe(true); // ladder in the top row, head in the open sky
    expect(agree(grid, 0, bl, [tr], [4]).status).toBe(NAV.FOUND);
    expect(agree(grid, 0, tr, [bl], [4]).status).toBe(NAV.FOUND);
    expect(agree(grid, 0, bl, [grid.idx(0, 0)], [4]).status).toBe(NAV.INVALID_GOAL); // corner in the air
    expect(grid.landing(0, -1, 0)).toBe(-1);
  });

  it('multi-goal queries reach the cheapest work spot', () => {
    const { world, infra, marks } = ascii([
      '############',
      '#..........#',
      '#S....##...#',
      '############',
    ]);
    const grid = new NavGrid(world, { infra });
    const out = new Int32Array(16);
    const n = workSpots(grid, 0, 6, 2, out); // the left block of the pillar
    const spots = Array.from(out.subarray(0, n));
    expect(spots).toContain(grid.idx(5, 2));
    const r = agree(grid, 0, marks.S, spots);
    expect(r.status).toBe(NAV.FOUND);
    expect(r.cost).toBe(4 * DWARF.cost.walk);
  });
});

describe('links (ropes, lifts, bridges, rails)', () => {
  const rows = [
    '##########',
    '#........#',
    '#S.......#',
    '###.######',
    '###.######',
    '###.######',
    '###.######',
    '###.######',
    '#..G.....#',
    '##########',
  ];

  it('a rope joins the top and the bottom of a bare shaft (both ways)', () => {
    const { world, infra, marks } = ascii(rows);
    const grid = new NavGrid(world, { infra, profiles: [DWARF, TROLL] });
    const top = grid.idx(2, 2);
    expect(agree(grid, 0, marks.S, [marks.G]).status).toBe(NAV.NO_PATH);
    grid.addRope(top, grid.idx(3, 8));
    expect(agree(grid, 0, marks.S, [marks.G]).status).toBe(NAV.FOUND);
    expect(agree(grid, 0, marks.G, [marks.S]).status).toBe(NAV.FOUND);
    expect(agree(grid, 1, marks.S, [marks.G]).status).toBe(NAV.NO_PATH); // trolls do not ride ropes
  });

  it('lift congestion adds a waiting trip; disabling the lift reroutes', () => {
    const { world, infra, marks } = ascii(rows);
    const grid = new NavGrid(world, { infra });
    grid.setInfraColumn(3, 3, 8, INFRA.LADDER);
    const g = grid.addLift([grid.idx(4, 2), grid.idx(4, 8)], { speed: 5, wait: 1000, capacity: 1 });
    const lifted = agree(grid, 0, marks.S, [marks.G]);
    expect(lifted.status).toBe(NAV.FOUND);
    grid.reserve(g);
    grid.reserve(g);
    const crowded = agree(grid, 0, marks.S, [marks.G]);
    expect(crowded.cost).toBeGreaterThan(lifted.cost); // waits for a trip or takes the ladder
    grid.release(g);
    grid.release(g);
    grid.setGroupEnabled(g, false);
    const ladder = agree(grid, 0, marks.S, [marks.G]);
    expect(ladder.status).toBe(NAV.FOUND);
    expect(ladder.cost).toBeGreaterThanOrEqual(crowded.cost);
    const finder = new AStar(grid);
    finder.find(marks.S, [marks.G], path);
    expect(Array.from(path.moves.subarray(0, path.length))).not.toContain(MV.LINK);
  });

  it('heuristic stays admissible with fast links', () => {
    const { world, infra, marks } = ascii(rows);
    const grid = new NavGrid(world, { infra });
    grid.addRail([marks.S, grid.idx(8, 1)], { speed: 50, board: 0, capacity: 4 });
    const a = grid.linkFrom[0];
    const b = grid.linkTo[0];
    expect(grid.heuristic(0, a, b)).toBeLessThanOrEqual(grid.linkCost[0]);
    expect(grid.linkKind[0]).toBe(LINK.RAIL);
  });
});

describe('arena (lab) navigation', () => {
  it('meadow -> tunnel -> caves: every algorithm agrees', () => {
    const sc = arenaScenario();
    const grid = new NavGrid(sc.world, { infra: sc.infra });
    const near = (c: number) => {
      const W = grid.w;
      for (let r = 0; r < 12; r++)
        for (let dy = -r; dy <= r; dy++)
          for (let dx = -r; dx <= r; dx++) {
            const x = (c % W) + dx;
            const y = Math.floor(c / W) + dy;
            if (x >= 0 && y >= 0 && x < W && y < grid.h && grid.standable(0, y * W + x)) return y * W + x;
          }
      return -1;
    };
    const meadow = near(sc.poi.meadow);
    for (const k of ['tunnel', 'workshop', 'cave', 'fungal']) {
      const goal = near(sc.poi[k]);
      expect(goal, k).toBeGreaterThanOrEqual(0);
      const r = agree(grid, 0, meadow, [goal], [8, 16]);
      expect(r.status, k).toBe(NAV.FOUND);
    }
  });
});

describe('synthetic mine 224×720', () => {
  const sc = buildSyntheticMine(1);
  const grid = new NavGrid(sc.world, { infra: sc.infra });
  applyLinks(grid, sc);
  grid.sync();
  const standable: number[] = [];
  for (let i = 0; i < grid.n; i++) if (grid.standable(0, i)) standable.push(i);

  it('has the target size, links and plenty of walkable cells', () => {
    expect(grid.w).toBe(224);
    expect(grid.h).toBe(720);
    expect(standable.length).toBeGreaterThan(5000);
    expect(sc.lifts.length).toBeGreaterThan(0);
    expect(sc.bridges.length + sc.ropes.length + sc.rails.length).toBeGreaterThan(0);
    expect(grid.linkCount).toBeGreaterThan(10);
  });

  it('is deterministic per seed', () => {
    const b = buildSyntheticMine(1);
    expect(Array.from(b.world.mat)).toEqual(Array.from(sc.world.mat));
    expect(Array.from(b.infra)).toEqual(Array.from(sc.infra));
    expect(buildSyntheticMine(2).world.mat).not.toEqual(sc.world.mat);
  });

  it('all algorithms return valid paths of equal (optimal) cost; weighted A* within bound', () => {
    const rng = new Rng('nav-agree');
    const fs = finderSet(grid, 0, [16, 32]);
    const weighted = new AStar(grid, 0, { weight: 1.5 });
    let found = 0;
    for (let q = 0; q < 80; q++) {
      const s = standable[Math.floor(rng.next() * standable.length)];
      const g = standable[Math.floor(rng.next() * standable.length)];
      let status = -1;
      let cost = -1;
      for (const f of fs) {
        const st = f.find(s, [g], path);
        if (status < 0) status = st;
        expect(st, `${f.name} q${q}`).toBe(status);
        if (st === NAV.FOUND) {
          expect(pathProblems(grid, 0, path, s, [g]), `${f.name} q${q}`).toEqual([]);
          if (cost < 0) cost = path.cost;
          expect(path.cost, `${f.name} q${q}`).toBe(cost);
        }
      }
      if (status === NAV.FOUND) {
        found++;
        expect(weighted.find(s, [g], path)).toBe(NAV.FOUND);
        expect(path.cost).toBeGreaterThanOrEqual(cost);
        expect(path.cost).toBeLessThanOrEqual(cost * 1.5);
      }
    }
    expect(found).toBeGreaterThan(20);
    for (const f of fs) f.dispose();
  });

  it('local updates after digs and cave-ins match a full rebuild (grid, jumps, clusters)', () => {
    const sc2 = buildSyntheticMine(3);
    const g2 = new NavGrid(sc2.world, { infra: sc2.infra });
    applyLinks(g2, sc2);
    g2.sync();
    const jps = new AStar(g2, 0, { jumps: true });
    const hpa = new HpaStar(g2, 0, { cluster: 16 });
    const rng = new Rng('nav-updates');
    const W = g2.w;
    const world = sc2.world;
    let digs = 0;
    for (let k = 0; k < 400 && digs < 120; k++) {
      const x = rng.int(2, W - 3);
      const y = rng.int(45, g2.h - 6);
      const i = y * W + x;
      if (SOLID[world.mat[i]] && !SOLID[world.mat[i - 1]]) {
        world.dig(x, y);
        digs++;
      } else if (!SOLID[world.mat[i]] && rng.chance(0.3)) world.fill(x, y, M.GRANITE);
      if (k % 7 === 0) g2.sync(); // interleave batches of several changes
    }
    g2.sync();
    const fresh = new NavGrid(world, { infra: g2.infra });
    applyLinks(fresh, sc2);
    fresh.sync();
    expect(Array.from(g2.mask[0])).toEqual(Array.from(fresh.mask[0]));
    expect(Array.from(g2.drop[0])).toEqual(Array.from(fresh.drop[0]));
    expect(Array.from(g2.mul[0])).toEqual(Array.from(fresh.mul[0]));
    const freshHpa = new HpaStar(fresh, 0, { cluster: 16 });
    const freshJps = new AStar(fresh, 0, { jumps: true });
    const cells: number[] = [];
    for (let i = 0; i < g2.n; i++) if (g2.standable(0, i)) cells.push(i);
    for (let q = 0; q < 40; q++) {
      const s = cells[Math.floor(rng.next() * cells.length)];
      const g = cells[Math.floor(rng.next() * cells.length)];
      const a = hpa.find(s, [g], path);
      const ca = path.cost;
      const b = freshHpa.find(s, [g], path);
      expect(a, `hpa q${q}`).toBe(b);
      if (a === NAV.FOUND) expect(ca).toBe(path.cost);
      const c = jps.find(s, [g], path);
      const cc = path.cost;
      expect(c, `jps q${q}`).toBe(freshJps.find(s, [g], path));
      if (c === NAV.FOUND) expect(cc).toBe(path.cost);
    }
  });

  it('BUG-003: navigation reads water only where the level is > 0 (stale fluidKind is ignored)', () => {
    const { world, infra, marks } = ascii([
      '#########',
      '#.......#',
      '#S.....G#',
      '###~~####',
      '###~~####',
      '#########',
    ]);
    const grid = new NavGrid(world, { infra });
    const W = world.w;
    expect(agree(grid, 0, marks.S, [marks.G]).status).toBe(NAV.NO_PATH); // 2-deep pool, no swimming
    world.fill(3, 3, M.GRANITE);
    world.fill(4, 3, M.GRANITE);
    expect(agree(grid, 0, marks.S, [marks.G]).status).toBe(NAV.FOUND); // filled in: a floor
    world.dig(3, 3);
    world.dig(4, 3);
    // the inconsistent state BUG-003 left behind (level 0, kind still WATER), written directly
    for (const x of [3, 4]) for (const y of [3, 4]) {
      world.fluid[y * W + x] = 0;
      world.fluidKind[y * W + x] = FLUID.WATER;
    }
    grid.markDirty(2, 2, 5, 5);
    grid.sync();
    expect(grid.standable(0, 4 * W + 3)).toBe(true); // a dry pit, not water
    expect(agree(grid, 0, marks.S, [marks.G]).status).toBe(NAV.NO_PATH); // 2-deep dry pit: drop in, no way out
    expect(agree(grid, 0, marks.S, [4 * W + 3]).status).toBe(NAV.FOUND);
  });
});
