// W2: the animation state machine — move/sim/event mapping, transition times, load visibility,
// lab poses for every clip id, stairs, lamp position.
import { describe, expect, it } from 'vitest';
import { MOTION } from '../../../src/render/characters/direction';
import { Animator, TRANSITION_IN } from '../../../src/render/anim/machine';
import { baseInput, footPoints, pinnedIsToe } from '../../../src/render/anim/metrics';
import { AS, BONE, CARRY, CLIP_IDS, MV, NOTIFY, SIM, WORK, type AnimEdge, type AnimEvent, type AnimInput, type AnimNotify } from '../../../src/render/anim/types';
import { makeRig, ROLES } from './fixture';

const edge = (move: number, fromX: number, fromY: number, toX: number, toY: number, durationMs: number, rows = 0): AnimEdge => ({ move, fromX, fromY, toX, toY, t: 0, durationMs, rows });

function step(a: Animator, inp: AnimInput, seconds: number, events?: AnimEvent[], notes?: AnimNotify[]): AnimNotify[] {
  const out: AnimNotify[] = [];
  const buf: AnimNotify[] = notes ?? [];
  const n = Math.max(1, Math.round(seconds * 60));
  for (let i = 0; i < n; i++) {
    if (inp.edge) inp.edge.t = Math.min(1, inp.edge.t + 1000 / 60 / inp.edge.durationMs);
    a.update(inp, 1 / 60, i === 0 ? events : undefined);
    const k = a.drainNotifies(buf);
    for (let j = 0; j < k; j++) out.push({ ...buf[j]! });
  }
  return out;
}

describe('state machine: nav moves -> states', () => {
  const table: [string, AnimEdge, number][] = [
    ['WALK_R', edge(MV.WALK_R, 0.5, -1, 1.5, -1, 900), AS.WALK],
    ['WALK_L', edge(MV.WALK_L, 1.5, -1, 0.5, -1, 900), AS.WALK],
    ['STEP_UR', edge(MV.STEP_UR, 0.5, -2, 1.5, -1, 700), AS.LEDGE],
    ['STEP_UL', edge(MV.STEP_UL, 1.5, -2, 0.5, -1, 700), AS.LEDGE],
    ['DROP_R', edge(MV.DROP_R, 0.5, -1, 1.5, -3, 800, 2), AS.DROP],
    ['FALL', edge(MV.FALL, 0.5, -1, 0.5, -4, 1050, 3), AS.DROP],
    ['UP', edge(MV.UP, 0.5, -3, 0.5, -2, 900), AS.CLIMB],
    ['DOWN', edge(MV.DOWN, 0.5, -2, 0.5, -3, 600), AS.CLIMB],
    ['STAIR_UR', edge(MV.STAIR_UR, 0.5, -2, 1.5, -1, 600), AS.STAIRS],
    ['STAIR_DL', edge(MV.STAIR_DL, 1.5, -1, 0.5, -2, 500), AS.STAIRS],
    ['LINK', edge(MV.LINK, 0.5, -5, 0.5, -1, 2000), AS.RIDE],
  ];
  for (const [name, e, want] of table) {
    it(`${name} -> ${Object.entries(AS).find(([, v]) => v === want)![0]}`, () => {
      const a = new Animator(makeRig('hajer'), { viewYawDeg: 40 });
      const inp = baseInput();
      inp.sim = SIM.GOTO;
      inp.edge = e;
      a.update(inp, 1 / 60);
      expect(a.state).toBe(want);
    });
  }

  it('a drop ends in LAND (strength from the fall height), then idles', () => {
    const a = new Animator(makeRig('tragarz'), { viewYawDeg: 40 });
    const inp = baseInput();
    inp.sim = SIM.GOTO;
    inp.edge = edge(MV.DROP_R, 0.5, -1, 1.5, -4, 300 + 250 * 3, 3);
    const notes = step(a, inp, 1.05);
    expect(a.state).toBe(AS.DROP);
    inp.edge = null;
    inp.x = 1.5;
    inp.y = -4;
    const more = step(a, inp, 1 / 60);
    expect(a.state).toBe(AS.LAND);
    const land = [...notes, ...more].filter((n) => n.kind === NOTIFY.LAND);
    expect(land.length).toBe(1);
    expect(land[0]!.strength).toBeCloseTo(0.75, 5);
    step(a, inp, 0.8);
    expect(a.state).toBe(AS.IDLE);
  });

  it('the root follows the move curves: ledge rises before it advances, a drop falls ballistically', () => {
    const a = new Animator(makeRig('hajer'), { viewYawDeg: 0 });
    const inp = baseInput();
    inp.sim = SIM.GOTO;
    const e = edge(MV.STEP_UR, 0.5, -2, 1.5, -1, 700);
    inp.edge = e;
    e.t = 0.4;
    a.update(inp, 1 / 60);
    const ledgeX = a.placement[12]!;
    const ledgeY = a.placement[13]!;
    expect(ledgeY + 2).toBeGreaterThan(0.6); // risen most of the way
    expect(ledgeX - 0.5).toBeLessThan(0.4); // still near the start in x
    const b = new Animator(makeRig('hajer'), { viewYawDeg: 0 });
    const d = edge(MV.DROP_R, 0.5, -1, 1.5, -3, 800, 2);
    inp.edge = d;
    const ys: number[] = [];
    for (const t of [0.5, 0.6, 0.7, 0.8, 0.9, 1]) {
      d.t = t;
      b.update(inp, 1 / 60);
      ys.push(b.placement[13]!);
    }
    // accelerating fall: growing steps
    for (let i = 2; i < ys.length; i++) expect(ys[i - 1]! - ys[i]!).toBeGreaterThan(ys[i - 2]! - ys[i - 1]! - 1e-9);
    expect(ys[ys.length - 1]).toBeCloseTo(-3, 6);
  });
});

describe('state machine: sim states and events', () => {
  it('WORK+DIG -> DIG, WORK+BUILD / CRAFT -> BUILD, FLEE -> FLEE (cower on the spot), STUNNED, BURIED/DEAD -> HIDDEN', () => {
    const cases: [number, number, number][] = [
      [SIM.WORK, WORK.DIG, AS.DIG],
      [SIM.WORK, WORK.BUILD, AS.BUILD],
      [SIM.WORK, WORK.CRAFT, AS.BUILD],
      [SIM.WORK, WORK.HAUL, AS.IDLE],
      [SIM.FLEE, WORK.NONE, AS.FLEE],
      [SIM.STUNNED, WORK.NONE, AS.STUNNED],
      [SIM.BURIED, WORK.NONE, AS.HIDDEN],
      [SIM.DEAD, WORK.NONE, AS.HIDDEN],
      [SIM.IDLE, WORK.NONE, AS.IDLE],
    ];
    for (const [sim, work, want] of cases) {
      const a = new Animator(makeRig('kowal'), { viewYawDeg: 40 });
      const inp = baseInput();
      inp.sim = sim;
      inp.work = work;
      step(a, inp, 0.2);
      expect(a.state, `sim ${sim} work ${work}`).toBe(want);
      if (want === AS.FLEE) expect(a.clipId).toBe('cower');
    }
    // fleeing along a walk edge runs (flee clip) with the danger shield
    const a = new Animator(makeRig('tragarz'), { viewYawDeg: 40 });
    const inp = baseInput();
    inp.sim = SIM.FLEE;
    inp.danger = 1;
    inp.edge = edge(MV.WALK_R, 0.5, -1, 1.5, -1, 400);
    step(a, inp, 0.1);
    expect(a.state).toBe(AS.FLEE);
    expect(a.clipId).toBe('flee');
  });

  it('buried hides the dwarf (no lamp) until rescued; rescued -> stunned for a while -> idle', () => {
    const a = new Animator(makeRig('hajer'), { viewYawDeg: 40 });
    const inp = baseInput();
    step(a, inp, 0.1, [{ type: 'buried' }]);
    expect(a.state).toBe(AS.HIDDEN);
    const out = new Float32Array(3);
    expect(a.lampWorld(out, 0)).toBe(false);
    expect(Math.hypot(a.bones[BONE.HEAD * 16]!, a.bones[BONE.HEAD * 16 + 1]!)).toBe(0);
    step(a, inp, 0.1, [{ type: 'rescued' }]);
    expect(a.state).toBe(AS.STUNNED);
    step(a, inp, 1.6);
    expect(a.state).toBe(AS.IDLE);
    expect(a.lampWorld(out, 0)).toBe(true);
  });

  it('fell -> LAND with a notify; caveInWarning -> the head tilts up; pickUp / putDown notifies', () => {
    const a = new Animator(makeRig('ciesla'), { viewYawDeg: 40 });
    const inp = baseInput();
    step(a, inp, 0.3);
    const head0 = a.out.rot[BONE.HEAD * 3 + 2]!;
    step(a, inp, 0.35, [{ type: 'caveInWarning', x: 0, y: 0, seconds: 3 }]);
    expect(a.out.rot[BONE.HEAD * 3 + 2]! - head0).toBeGreaterThan(0.2);
    const n1 = step(a, inp, 0.5, [{ type: 'pickUp' }]);
    expect(n1.filter((n) => n.kind === NOTIFY.PICK_UP).length).toBe(1);
    const n2 = step(a, inp, 0.5, [{ type: 'putDown' }]);
    expect(n2.filter((n) => n.kind === NOTIFY.PUT_DOWN).length).toBe(1);
    const n3 = step(a, inp, 0.2, [{ type: 'fell', rows: 2, damage: 0 }]);
    expect(a.state).toBe(AS.LAND);
    expect(n3.filter((n) => n.kind === NOTIFY.LAND).length).toBe(1);
  });

  it('transition table: ~0.15–0.22 s by default, flee 0.08 s, hidden instant', () => {
    expect(TRANSITION_IN[AS.FLEE]).toBe(0.08);
    expect(TRANSITION_IN[AS.HIDDEN]).toBe(0);
    for (const s of [AS.IDLE, AS.WALK, AS.CLIMB, AS.STAIRS, AS.DIG, AS.BUILD]) {
      expect(TRANSITION_IN[s]).toBeGreaterThanOrEqual(0.15);
      expect(TRANSITION_IN[s]).toBeLessThanOrEqual(0.22);
    }
  });
});

describe('gear: the load is shown only while carried', () => {
  for (const role of ROLES) {
    it(`${role}: LOAD scale 0 in idle and walk without a load, 1 with one`, () => {
      const a = new Animator(makeRig(role), { viewYawDeg: 40 });
      const inp = baseInput();
      for (const c of ['idle', 'walk', 'jog', 'dig', 'climb']) {
        a.pose(c, 0.3, inp);
        expect(a.out.scale[BONE.LOAD], c).toBe(0);
      }
      a.pose('carry', 0.3, inp);
      expect(a.out.scale[BONE.LOAD]).toBe(1);
      inp.carry = CARRY.HANDS;
      step(a, inp, 0.3);
      expect(a.out.scale[BONE.LOAD]).toBe(1);
      inp.carry = CARRY.NONE;
      step(a, inp, 0.3);
      expect(a.out.scale[BONE.LOAD]).toBe(0);
    });
  }
});

describe('lab poses and lamps', () => {
  it('every contract clip id poses every role (finite matrices)', () => {
    for (const role of ROLES) {
      const a = new Animator(makeRig(role), { viewYawDeg: 40 });
      for (const c of CLIP_IDS) {
        for (const ph of [0, 0.25, 0.5, 0.75]) {
          a.pose(c, ph, baseInput(2.5, -3));
          expect(a.bones.every(Number.isFinite), `${role} ${c} ${ph}`).toBe(true);
          expect(a.placement.every(Number.isFinite)).toBe(true);
        }
      }
    }
  });

  it("lamp: the miner's kaganek above the face, belt lanterns at the belt", () => {
    const out = new Float32Array(3);
    const miner = new Animator(makeRig('hajer'), { viewYawDeg: 40 });
    miner.pose('idle', 0, baseInput(0.5, -1));
    expect(miner.lampWorld(out, 0)).toBe(true);
    expect(out[1]! + 1).toBeGreaterThan(1.1);
    const smith = new Animator(makeRig('kowal'), { viewYawDeg: 40 });
    smith.pose('idle', 0, baseInput(0.5, -1));
    smith.lampWorld(out, 0);
    expect(out[1]! + 1).toBeGreaterThan(0.25);
    expect(out[1]! + 1).toBeLessThan(0.6);
  });
});

describe('stairs', () => {
  it('walking up a staircase: planted feet stay on the stair line and do not slide', () => {
    const a = new Animator(makeRig('hajer'), { viewYawDeg: 40 });
    const inp = baseInput();
    inp.sim = SIM.GOTO;
    const ms = 600;
    const e = edge(MV.STAIR_UR, 0.5, -10, 1.5, -9, ms);
    inp.edge = e;
    const heel = new Float64Array(3);
    const toe = new Float64Array(3);
    let maxSlide = 0;
    let maxOff = 0;
    const prev: (number[] | null)[] = [null, null];
    const dt = 1 / 120;
    for (let f = 0; f < 600; f++) {
      const t0 = f * dt * 1000;
      const k = Math.floor(t0 / ms);
      e.fromX = 0.5 + k;
      e.toX = 1.5 + k;
      e.fromY = -10 + k;
      e.toY = -9 + k;
      e.t = (t0 - k * ms) / ms;
      a.update(inp, dt);
      if (f < 60) continue;
      for (let s = 0; s < 2; s++) {
        if (a.out.contact[s] !== 1) {
          prev[s] = null;
          continue;
        }
        footPoints(a, s, heel, toe);
        // ramp line through the edge's feet points: y = -10 + (x - 0.5)
        maxOff = Math.max(maxOff, Math.min(Math.abs(heel[1]! - (-10 + heel[0]! - 0.5)), Math.abs(toe[1]! - (-10 + toe[0]! - 0.5))));
        // the pinned point (heel, then the toe during the toe roll) must not move
        const toeNow = pinnedIsToe(a, s);
        const p = toeNow ? toe[0]! : heel[0]!;
        if (prev[s] !== null) maxSlide = Math.max(maxSlide, Math.abs(p - (toeNow ? prev[s]![1]! : prev[s]![0]!)));
        prev[s] = [heel[0]!, toe[0]!];
      }
    }
    const speed = Math.SQRT2 * (1000 / ms);
    expect(maxSlide / dt / speed).toBeLessThan(0.05);
    expect(maxOff).toBeLessThan(0.03);
    void MOTION;
  });
});

describe('animation LOD (setDetail)', () => {
  it('3 = culled: bones stay, the placement and the state still follow; 2 = solved every 2nd frame', () => {
    const a = new Animator(makeRig('hajer', 4), { viewYawDeg: 40 });
    const inp = baseInput();
    inp.sim = SIM.GOTO;
    inp.edge = edge(MV.WALK_R, 0.5, -1, 1.5, -1, 900);
    step(a, inp, 0.3);
    a.setDetail(3);
    const frozen = Array.from(a.bones);
    const x0 = a.placement[12]!;
    step(a, inp, 0.2);
    expect(Array.from(a.bones)).toEqual(frozen);
    expect(a.placement[12]).toBeGreaterThan(x0);
    expect(a.state).toBe(AS.WALK);
    a.setDetail(2);
    let changes = 0;
    let prev = Array.from(a.bones);
    for (let i = 0; i < 10; i++) {
      step(a, inp, 1 / 60);
      const now = Array.from(a.bones);
      if (now.some((v, j) => v !== prev[j])) changes++;
      prev = now;
    }
    expect(changes).toBe(5);
    a.setDetail(0);
    step(a, inp, 1 / 60);
    expect(a.bones.every(Number.isFinite)).toBe(true);
  });
});
