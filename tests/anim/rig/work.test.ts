// W2: dig / build swings — timing, the hit frame and its world position, cancel windows, events.
import { describe, expect, it } from 'vitest';
import { MOTION } from '../../../src/render/characters/direction';
import { digClip, buildClip, swingPlan, SWING } from '../../../src/render/anim/clips/swing';
import { Animator } from '../../../src/render/anim/machine';
import { baseInput } from '../../../src/render/anim/metrics';
import { AnimPose } from '../../../src/render/anim/pose';
import { Rig } from '../../../src/render/anim/rig';
import { AS, BONE, NOTIFY, SIM, WORK, type AnimNotify } from '../../../src/render/anim/types';
import { makeRig, ROLES } from './fixture';

const ctxFor = (rig: ReturnType<typeof makeRig>, aimX = 1, aimY = 0.5) => ({ rig, speed: 0, carry: 0, aimX, aimY, probe: null, viewYaw: 0.7, danger: 0, time: 0 });

describe('dig: timing from the concept card', () => {
  it('windup 0.35 -> hold 0.08 -> strike 0.15 -> recovery 0.32 s', () => {
    expect(SWING.seconds).toBeCloseTo(MOTION.digWindup + MOTION.digHold + MOTION.digStrike + MOTION.digRecover, 9);
    expect(SWING.windupEnd * SWING.seconds).toBeCloseTo(0.35, 6);
    expect((SWING.holdEnd - SWING.windupEnd) * SWING.seconds).toBeCloseTo(0.08, 6);
    expect((SWING.hit - SWING.holdEnd) * SWING.seconds).toBeCloseTo(0.15, 6);
    expect(digClip.notifies.filter((n) => n.kind === NOTIFY.DIG_HIT).map((n) => n.phase)).toEqual([SWING.hit]);
  });

  for (const role of ['hajer', 'ciesla', 'kowal'] as const) {
    it(`${role}: at the hit phase the tool's strike point touches the face of the tile in front`, () => {
      const rig = makeRig(role);
      const ctx = ctxFor(rig);
      const pose = new AnimPose();
      digClip.sample(ctx, SWING.hit, pose);
      const r = new Rig(rig);
      r.solve(pose);
      const s = rig.toolR!.strike;
      const p = new Float64Array(3);
      r.point(BONE.TOOL_R, s[0], s[1], s[2], p, 0);
      const want = new Float64Array(3);
      digClip.strike(ctx, want);
      expect(Math.hypot(p[0]! - want[0]!, p[1]! - want[1]!, p[2]! - want[2]!)).toBeLessThan(2e-3);
      // the face of the tile in front: x = aimX - 0.5 tile in the root space before the stance shift
      const plan = swingPlan(ctx, 'dig');
      expect(want[0]! + plan.dx).toBeCloseTo(0.5, 6);
      // anticipation: at the windup apex the tool head is behind the head (x < 0) and up
      pose.reset();
      digClip.sample(ctx, SWING.windupEnd, pose);
      r.solve(pose);
      r.point(BONE.TOOL_R, 0, rig.toolR!.head, 0, p, 0);
      expect(p[0]! - plan.dx * 0).toBeLessThan(r.W[BONE.HEAD * 16 + 12]!);
    });
  }

  it('two-handed tools: the left fist stays on the handle (within 5 cm) at the hit', () => {
    for (const role of ['hajer', 'ciesla'] as const) {
      const plan = swingPlan(ctxFor(makeRig(role)), 'dig');
      expect(plan.two).toBe(true);
      expect(plan.leftShort).toBeLessThan(0.05);
    }
  });
});

describe('dig in the state machine', () => {
  const run = (role: (typeof ROLES)[number], seconds: number, work = WORK.DIG) => {
    const a = new Animator(makeRig(role), { viewYawDeg: 40 });
    const inp = baseInput(0.5, -1);
    inp.sim = SIM.WORK;
    inp.work = work;
    inp.workX = 1.5;
    inp.workY = -0.5;
    const notes: AnimNotify[] = [];
    const got: AnimNotify[] = [];
    const frames: number[] = [];
    let f = 0;
    for (let t = 0; t < seconds; t += 1 / 60, f++) {
      a.update(inp, 1 / 60, f === 0 ? [{ type: 'digStart', x: 1, y: 0 }] : undefined);
      const n = a.drainNotifies(notes);
      for (let i = 0; i < n; i++) {
        got.push({ ...notes[i]! });
        frames.push(f);
      }
    }
    return { a, got, frames, inp };
  };

  it('exactly one DIG_HIT per cycle, at the world strike point on the rock face; one windup and one swoosh', () => {
    const cycles = 4;
    const { got } = run('hajer', SWING.seconds * cycles + 0.01);
    const hits = got.filter((n) => n.kind === NOTIFY.DIG_HIT);
    expect(hits.length).toBe(cycles);
    expect(got.filter((n) => n.kind === NOTIFY.TOOL_SWOOSH).length).toBe(cycles);
    expect(got.filter((n) => n.kind === NOTIFY.DIG_WINDUP).length).toBeGreaterThanOrEqual(cycles - 1);
    for (const h of hits) {
      // the face of the tile at x = 1 (feet at 0.5, facing +x); the strike height inside the tile row
      expect(h.x).toBeCloseTo(1, 3);
      expect(h.y).toBeGreaterThan(-1);
      expect(h.y).toBeLessThan(0);
    }
  });

  it('the hit fires in the frame that crosses the end of the strike', () => {
    const a = new Animator(makeRig('hajer'), { viewYawDeg: 40 });
    const inp = baseInput();
    inp.sim = SIM.WORK;
    inp.work = WORK.DIG;
    const notes: AnimNotify[] = [];
    for (let f = 0; f < 200; f++) {
      const before = a.phase;
      a.update(inp, 1 / 60);
      const n = a.drainNotifies(notes);
      const hit = notes.slice(0, n).some((x) => x.kind === NOTIFY.DIG_HIT);
      const crossed = a.state === AS.DIG && before < SWING.hit && a.phase >= SWING.hit;
      expect(hit).toBe(crossed);
    }
  });

  it('cancel windows: from the hit to 20% of the next windup', () => {
    const a = new Animator(makeRig('hajer'), { viewYawDeg: 40 });
    const inp = baseInput();
    inp.sim = SIM.WORK;
    inp.work = WORK.DIG;
    for (let f = 0; f < 120; f++) {
      a.update(inp, 1 / 60);
      const p = a.phase;
      const expectOpen = p >= SWING.hit || p < 0.2 * SWING.windupEnd;
      expect(a.canCancel()).toBe(expectOpen);
    }
  });

  it('digDone finishes the last strike and the recovery, then idles; digStart begins with the windup', () => {
    const a = new Animator(makeRig('ciesla'), { viewYawDeg: 40 });
    const inp = baseInput();
    inp.sim = SIM.WORK;
    inp.work = WORK.DIG;
    for (let f = 0; f < 20; f++) a.update(inp, 1 / 60);
    expect(a.state).toBe(AS.DIG);
    // carpenter puts the beam down while working
    expect(a.out.scale[BONE.BACK]).toBe(0);
    const notes: AnimNotify[] = [];
    a.drainNotifies(notes);
    a.update(inp, 1 / 60, [{ type: 'digDone' }]);
    inp.sim = SIM.IDLE;
    inp.work = WORK.NONE;
    let hits = 0;
    let frames = 0;
    while (a.state === AS.DIG && frames < 200) {
      a.update(inp, 1 / 60);
      const n = a.drainNotifies(notes);
      hits += notes.slice(0, n).filter((x) => x.kind === NOTIFY.DIG_HIT).length;
      frames++;
    }
    expect(hits).toBe(1);
    expect(frames).toBeLessThan(Math.ceil(SWING.seconds * 60) + 2);
    a.update(inp, 1 / 60);
    expect(a.state).toBe(AS.IDLE);
    inp.sim = SIM.WORK;
    inp.work = WORK.DIG;
    a.update(inp, 1 / 60, [{ type: 'digStart', x: 1, y: 0 }]);
    expect(a.state).toBe(AS.DIG);
    expect(a.phase).toBeLessThan(0.05);
  });

  it('build: one hit per cycle with the role tool (smith: hammer, one hand)', () => {
    const { got, a } = run('kowal', SWING.seconds * 3 + 0.01, WORK.BUILD);
    expect(a.state).toBe(AS.BUILD);
    expect(got.filter((n) => n.kind === NOTIFY.DIG_HIT).length).toBe(3);
    expect(swingPlan(ctxFor(makeRig('kowal')), 'build').two).toBe(false);
    expect(buildClip.id).toBe('build');
  });
});
