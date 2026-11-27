/**
 * F2-3 stage 3: roof load and cave-ins. Limestone (maxSpan 6, warn 30 s = 600 ticks) unless noted:
 * a flat hall of width <= 6 holds, wider warns and falls in the middle; supports, rock pillars, drifts,
 * natural caves, trusses, stepped roofs, map edges, fluid burial, scripted holds, save/load mid-countdown
 * and determinism of scripted runs.
 */
import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/core/rng';
import { asciiWorld } from '../../src/sim/debug';
import { HANDS, pickTool } from '../../src/sim/dig';
import { CAUSE } from '../../src/sim/events';
import { SUPPORT_FAIL } from '../../src/sim/structure';
import { TAG } from '../../src/sim/world/mutate';
import { WorldSim } from '../../src/sim/worldsim';
import { M, SOLID } from '../../src/world/materials';
import { CAV, FLUID, type World } from '../../src/world/world';
import { carve, record, slab } from './helpers';

const WARN = 30 * 20;

function sim(w: World) {
  const s = new WorldSim(w);
  const rec = record(s.bus, ['caveInWarning', 'caveInAverted', 'caveIn', 'buried', 'supportPlaced', 'supportRemoved']);
  const steps = (n: number) => {
    for (let k = 0; k < n; k++) s.step();
  };
  /** Steps until the next cave-in (including the step it happens in). */
  const untilCaveIn = (max = 5000) => {
    const n0 = rec.of('caveIn').length;
    let n = 0;
    while (rec.of('caveIn').length === n0 && n < max) {
      s.step();
      n++;
    }
    return n;
  };
  return { s, rec, steps, untilCaveIn, w };
}

/** Open a hall [x0, x1] x [y0, y1] through the mutator (as digging would). */
function dig(s: WorldSim, x0: number, y0: number, x1: number, y1: number) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) s.mut.dig(x, y, CAUSE.DIG);
}

const roofRow = (w: World, tiles: number[]) => tiles.map((i) => i % w.w).sort((a, b) => a - b);

describe('span limit, warning and collapse', () => {
  it('a hall as wide as maxSpan holds at 100% stress; two tiles wider warns and the middle falls after warnSec', () => {
    const { s, rec, steps, untilCaveIn, w } = sim(carve(slab(30, 12), 5, 4, 10, 6));
    s.step();
    expect(s.structure.failing).toBe(0);
    expect([5, 6, 7, 8, 9, 10].map((x) => s.structure.stressAt(x, 3))).toEqual([33, 67, 100, 100, 67, 33]);
    dig(s, 11, 4, 12, 6);
    s.step();
    const [warn] = rec.of('caveInWarning');
    expect(warn).toMatchObject({ row: 3, x0: 5, x1: 12, ticksLeft: WARN });
    expect(roofRow(w, warn!.tiles)).toEqual([8, 9]);
    expect(s.structure.stressAt(8, 3)).toBe(133);
    expect(untilCaveIn()).toBe(WARN - 1); // the warning step counts as the first of 600
    const [cave] = rec.of('caveIn');
    expect(roofRow(w, cave!.roof)).toEqual([8, 9]);
    expect(cave!.filled.length).toBe(6);
    for (const i of cave!.filled) {
      expect(w.mat[i]).toBe(M.LIMESTONE);
      expect(s.mut.tag[i]! & TAG.RUBBLE).toBe(TAG.RUBBLE);
    }
    expect(rec.of('buried')[0]).toMatchObject({ id: cave!.id, tiles: cave!.filled, water: 0, lava: 0 });
    // the rubble columns split the hall into two halls of 3: nothing else falls
    steps(2000);
    expect(rec.of('caveIn').length).toBe(1);
    expect(rec.of('caveInWarning').length).toBe(1);
    expect(asciiWorld(s, 4, 3, 13, 7)).toBe(['#363##363#', '#...rr...#', '#...rr...#', '#...rr...#', '##########'].join('\n'));
  });

  it('a hall taller than rubbleMaxRows (8) falls in warned steps until the failed columns are full', () => {
    const { s, rec, untilCaveIn, w } = sim(carve(slab(30, 16), 5, 2, 12, 12)); // 11 tall
    expect(untilCaveIn()).toBe(WARN);
    expect(rec.of('caveIn')[0]!.filled.length).toBe(2 * 8);
    expect(untilCaveIn()).toBe(WARN); // the roof still spans 8: a second, warned fall fills the rest
    expect(rec.of('caveIn')[1]!.filled.length).toBe(2 * 3);
    expect(rec.of('caveInWarning').length).toBe(2);
    expect([8, 9].every((x) => [2, 6, 12].every((y) => w.isSolid(x, y)))).toBe(true);
    expect(untilCaveIn(3000)).toBe(3000); // and then it holds
  });

  it('a support placed during the countdown averts the collapse; removing it starts a fresh countdown', () => {
    const { s, rec, steps, untilCaveIn, w } = sim(carve(slab(30, 12), 5, 4, 12, 6));
    s.step();
    steps(100);
    expect(s.structure.placeSupport(8, 6, 'wooden_prop')).toBe(SUPPORT_FAIL.OK);
    s.step();
    expect(rec.of('caveInAverted').flatMap((a) => roofRow(w, a.tiles)).sort()).toEqual([8, 9]);
    expect(s.structure.failing).toBe(0);
    steps(1000);
    expect(rec.of('caveIn').length).toBe(0);
    expect(s.structure.removeSupport(8, 6)).toBe(true);
    expect(rec.of('supportRemoved')[0]).toMatchObject({ x: 8, y: 6, id: 'wooden_prop', reason: 'removed' });
    s.step();
    expect(rec.of('caveInWarning').length).toBe(2);
    expect(rec.of('caveInWarning')[1]!.ticksLeft).toBe(WARN);
    expect(untilCaveIn()).toBe(WARN - 1);
  });

  it('removing a support mid-countdown merges the spans: no new warning, the whole span falls at the original time', () => {
    const { s, rec, steps, untilCaveIn, w } = sim(carve(slab(30, 12), 2, 4, 17, 6));
    expect(s.structure.placeSupport(12, 6, 'stone_pillar')).toBe(SUPPORT_FAIL.OK);
    s.step();
    expect(rec.of('caveInWarning').map((e) => roofRow(w, e.tiles))).toEqual([[5, 6, 7, 8]]);
    steps(299);
    s.structure.removeSupport(12, 6);
    expect(untilCaveIn()).toBe(WARN - 300);
    expect(rec.of('caveInWarning').length).toBe(1);
    expect(roofRow(w, rec.of('caveIn')[0]!.roof)).toEqual([5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
  });
});

describe('supports and rock shapes', () => {
  it('a timber prop is too short for a 5-tall hall; a stone pillar braces it', () => {
    const { s } = sim(carve(slab(20, 10), 3, 2, 10, 6));
    expect(s.structure.placeSupport(6, 6, 'wooden_prop')).toBe(SUPPORT_FAIL.OK);
    expect(s.structure.supportStatus(6, 6)).toBe('tooTall');
    s.step();
    expect(s.structure.failing).toBeGreaterThan(0);
    expect(s.structure.placeSupport(7, 6, 'stone_pillar')).toBe(SUPPORT_FAIL.OK);
    expect(s.structure.supportStatus(7, 6)).toBe('ok');
    s.step();
    expect(s.structure.failing).toBe(0);
  });

  it('rejects bad placements and drops a support whose floor is dug away', () => {
    const { s, rec } = sim(carve(slab(20, 10), 3, 4, 8, 6));
    expect(s.structure.placeSupport(5, 5, 'wooden_prop')).toBe(SUPPORT_FAIL.NO_FLOOR);
    expect(s.structure.placeSupport(5, 7, 'wooden_prop')).toBe(SUPPORT_FAIL.NOT_OPEN);
    expect(s.structure.placeSupport(5, 6, 'ladder')).toBe(SUPPORT_FAIL.UNKNOWN);
    expect(s.structure.placeSupport(-1, 6, 'wooden_prop')).toBe(SUPPORT_FAIL.OUT_OF_BOUNDS);
    expect(s.structure.placeSupport(5, 6, 'wooden_prop')).toBe(SUPPORT_FAIL.OK);
    expect(s.structure.placeSupport(5, 6, 'stone_pillar')).toBe(SUPPORT_FAIL.OCCUPIED);
    s.mut.dig(5, 7);
    expect(rec.of('supportRemoved')[0]).toMatchObject({ x: 5, y: 6, reason: 'floorLost' });
    expect(s.structure.supportAt(5, 6)).toBeNull();
  });

  it('a rock pillar left standing splits a 13-wide hall into two that hold (room and pillar)', () => {
    const a = sim(carve(carve(slab(20, 10), 2, 4, 7, 6), 9, 4, 14, 6));
    a.s.step();
    expect(a.s.structure.failing).toBe(0);
    const b = sim(carve(slab(20, 10), 2, 4, 14, 6));
    b.s.step();
    expect(b.s.structure.failing).toBeGreaterThan(0);
  });

  it('low drifts (<= 2 tall) carry twice the span; natural caves 2.5x', () => {
    const at = (w: World) => {
      const { s } = sim(w);
      s.step();
      return s.structure.failing;
    };
    expect(at(carve(slab(40, 10), 2, 3, 13, 4))).toBe(0); // drift 12 long holds
    expect(at(carve(slab(40, 10), 2, 3, 15, 4))).toBeGreaterThan(0); // 14 does not
    expect(at(carve(slab(40, 10), 2, 3, 13, 5))).toBeGreaterThan(0); // a 3-tall hall of 12 does not
    expect(at(carve(slab(40, 10), 2, 3, 15, 5, CAV.NATURAL))).toBe(0); // natural cave of 14 holds
    expect(at(carve(slab(40, 10), 2, 3, 15, 5))).toBeGreaterThan(0); // the same shape dug does not
  });

  it('an iron truss (reach 1) holds a 15-wide hall where a stone pillar does not', () => {
    const at = (id: string) => {
      const { s } = sim(carve(slab(30, 10), 1, 3, 15, 5));
      s.structure.placeSupport(8, 5, id);
      s.step();
      return s.structure.failing;
    };
    expect(at('iron_truss')).toBe(0);
    expect(at('stone_pillar')).toBeGreaterThan(0);
  });

  it('a stepped roof does not hide the span: the hanging low part fails over the full hall width', () => {
    const w = carve(carve(slab(30, 10), 2, 4, 7, 6), 8, 5, 17, 6);
    const { s, rec } = sim(w);
    s.step();
    expect(rec.of('caveInWarning').map((e) => [e.row, ...roofRow(w, e.tiles)])).toEqual([[4, 8, 9, 10, 11]]);
  });
});

describe('edges: map border, fluids, scripted holds, determinism, save/load', () => {
  it('collapses cleanly in the bottom-left corner of the map', () => {
    const w = carve(slab(12, 6), 0, 3, 9, 5);
    const { rec, untilCaveIn } = sim(w);
    expect(untilCaveIn()).toBe(WARN);
    const [cave] = rec.of('caveIn');
    expect(roofRow(w, cave!.roof)).toEqual([3, 4, 5, 6]);
    expect(cave!.filled.length).toBe(12);
    expect(cave!.filled.every((i) => i >= 0 && i < w.size && SOLID[w.mat[i]!])).toBe(true);
  });

  it('a cave-in burying water destroys and reports it; no fluid remains in rubble', () => {
    const w = carve(slab(20, 8), 4, 3, 11, 5);
    for (let x = 4; x <= 11; x++) w.setFluid(x, 5, FLUID.WATER, 200);
    const { rec, untilCaveIn } = sim(w);
    untilCaveIn();
    const [b] = rec.of('buried');
    expect(b!.water).toBe(400);
    for (const i of b!.tiles) expect([w.fluid[i], w.fluidKind[i]]).toEqual([0, FLUID.NONE]);
    expect(w.fluid[w.idx(4, 5)]).toBe(200);
  });

  it('a support too short for its column is buried by the rubble and reported', () => {
    const { s, rec, untilCaveIn } = sim(carve(slab(30, 12), 5, 3, 12, 6));
    expect(s.structure.placeSupport(8, 6, 'wooden_prop')).toBe(SUPPORT_FAIL.OK);
    expect(s.structure.supportStatus(8, 6)).toBe('tooTall');
    untilCaveIn();
    expect(rec.of('supportRemoved')).toEqual([{ i: s.world.idx(8, 6), x: 8, y: 6, id: 'wooden_prop', reason: 'buried' }]);
    expect(rec.of('buried')[0]!.supports).toBe(1);
  });

  it('the scripted Lullaby holds the failing roof 8 s longer', () => {
    const { s, rec, untilCaveIn } = sim(carve(slab(30, 12), 5, 4, 12, 6));
    s.step();
    expect(s.structure.extendTimers(0, 0, 29, 11, 8 * 20)).toBe(2);
    expect(untilCaveIn()).toBe(WARN - 1 + 160);
    expect(rec.of('caveIn').length).toBe(1);
  });

  /** A scripted colony: digging (jobs and blasts), supports placed and removed, from one seed. */
  function scripted(seed: number) {
    const rng = new Rng(seed);
    const w = slab(64, 40, M.LIMESTONE, 4);
    carve(w, 4, 4, 5, 20); // a shaft from the surface
    carve(w, 6, 19, 17, 20); // a 12-long drift off its foot (holds until blasts make it taller)
    carve(w, 20, 24, 31, 26); // a 12-wide hall: warns at once
    const cmds: { at: number; kind: number; x: number; y: number; k: number }[] = [];
    for (let t = 0; t < 2400; t += 1 + rng.int(0, 6)) cmds.push({ at: t, kind: rng.int(0, 3), x: rng.int(0, 63), y: rng.int(5, 38), k: rng.int(0, 3) });
    const picks = [HANDS, pickTool('copper_pick')!, pickTool('bronze_pick')!, pickTool('iron_pick')!];
    const ids = ['wooden_prop', 'stone_pillar', 'iron_truss', 'obsidian_pillar'];
    const apply = (s: WorldSim, c: (typeof cmds)[number]) => {
      if (c.kind === 0) s.dig.start(c.x, c.y, c.k, picks[c.k]!);
      else if (c.kind === 1) {
        // blast a 3x2 room into the rock right of the first open tile at or after (x, y)
        for (let i = c.y * 64 + c.x; i < s.world.size - 1; i++)
          if (!SOLID[s.world.mat[i]!] && SOLID[s.world.mat[i + 1]!] && i % 64 < 61) {
            const x = (i % 64) + 1;
            const y = Math.floor(i / 64);
            if (y > 4 && y < 38) dig(s, x, y, x + 2, y + 1);
            break;
          }
      } else if (c.kind === 2) s.structure.placeSupport(c.x, c.y, ids[c.k]!);
      else {
        for (let i = 0; i < w.size; i++) if (s.structure.support[i] && i % 7 === c.k) s.structure.removeSupport(i % s.world.w, Math.floor(i / s.world.w));
      }
    };
    return { w, cmds, apply };
  }

  function play(seed: number, saveAt = -1) {
    const { w, cmds, apply } = scripted(seed);
    let s = new WorldSim(w);
    let log: string[] = [];
    const listen = (x: WorldSim) =>
      (['caveInWarning', 'caveIn', 'buried', 'digLoot', 'supportRemoved'] as const).forEach((t) => x.bus.on(t, (e) => log.push(`${x.tick}:${t}:${JSON.stringify(e)}`)));
    listen(s);
    let c = 0;
    let failingAtSave = 0;
    for (let t = 0; t < 2400; t++) {
      if (t === saveAt) {
        failingAtSave = s.structure.failing;
        s = WorldSim.load(JSON.parse(JSON.stringify(s.save())));
        log = [];
        listen(s);
      }
      while (c < cmds.length && cmds[c]!.at === t) apply(s, cmds[c++]!);
      s.step();
    }
    return { hash: s.hash(), log, s, failingAtSave };
  }

  it('two runs of the same scripted colony are identical; a save/load through JSON mid-countdown continues identically', () => {
    const a = play(11);
    const b = play(11);
    expect(b.hash).toBe(a.hash);
    expect(b.log).toEqual(a.log);
    expect(a.log.some((l) => l.includes(':caveIn:'))).toBe(true); // the script really collapses something
    expect(a.s.structure.stats.collapses).toBeGreaterThan(0);
    const saveAt = 1300;
    const c = play(11, saveAt);
    expect(c.failingAtSave).toBeGreaterThan(0); // saved in the middle of a countdown
    expect(c.hash).toBe(a.hash);
    expect(c.log).toEqual(a.log.filter((l) => Number(l.split(':')[0]) >= saveAt));
    expect(play(12).hash).not.toBe(a.hash);
  });

  it('every tile stays consistent through a scripted colony (no fluid in rock, no solid cavity)', () => {
    const { s } = play(5);
    const w = s.world;
    let bad = 0;
    for (let i = 0; i < w.size; i++) {
      const solid = SOLID[w.mat[i]!] === 1;
      if (solid !== (w.cav[i] === CAV.SOLID) || (solid && w.fluid[i]) || (s.structure.timer[i] && !solid)) bad++;
    }
    expect(bad).toBe(0);
  });
});
