// W2: locomotion without foot sliding at every speed and scale, notifies, seams, determinism, steps.
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MOTION, PROPORTION_PRESETS } from '../../../src/render/characters/direction';
import { CLIPS } from '../../../src/render/anim/clips/index';
import { conceptSpeed } from '../../../src/render/anim/gait';
import { Animator } from '../../../src/render/anim/machine';
import { baseInput, measureSlip, seamJump } from '../../../src/render/anim/metrics';
import { AnimPose } from '../../../src/render/anim/pose';
import { Rig } from '../../../src/render/anim/rig';
import { rigData } from '../../../src/render/anim/rigdata';
import { AS, BONE, BONE_COUNT, CARRY, IK, MV, NOTIFY, SIM, type AnimNotify, type AnimWorldProbe } from '../../../src/render/anim/types';
import { createAnimator } from '../../../src/render/anim/index';
import { makeRig, ROLES, scaled } from './fixture';

const require = createRequire(import.meta.url);

const SPEEDS = (rigC: number) => [
  ['koncepcyjny', rigC],
  ['symulacja 1,1', MOTION.walkTilesPerSecond],
  ['ucieczka 2,5', MOTION.fleeTilesPerSecond],
] as const;

describe('walk / jog: the planted foot stays put (slip < 2% of the speed)', () => {
  for (const role of ROLES) {
    const rig = makeRig(role, 3);
    const vc = conceptSpeed(rigData(rig));
    for (const [name, v] of SPEEDS(vc)) {
      it(`${role}: ${name} (${v.toFixed(2)} kafla/s)`, () => {
        const r = measureSlip(rig, v, { seconds: 4 });
        expect(r.slip).toBeLessThan(0.02);
        // two heel strikes per cycle (stride = two steps)
        expect(Math.abs(r.footDowns - 2 * r.cycles)).toBeLessThanOrEqual(1.01);
      });
    }
  }

  it('the concept walk keeps the card cadence: 2 steps / 0.9 s at ~0.6–0.8 tiles/s (preset A)', () => {
    const rig = makeRig('hajer');
    const vc = conceptSpeed(rigData(rig));
    expect(vc).toBeGreaterThan(0.55);
    expect(vc).toBeLessThan(0.85);
    const r = measureSlip(rig, vc, { seconds: 4 });
    expect(r.stepsPerSecond).toBeCloseTo(2 / 0.9, 1);
  });

  it('carry and flee flavours do not slide either', () => {
    const rig = makeRig('tragarz');
    expect(measureSlip(rig, MOTION.walkTilesPerSecond, { carry: CARRY.BACK, seconds: 3 }).slip).toBeLessThan(0.02);
    expect(measureSlip(makeRig('hajer'), MOTION.walkTilesPerSecond, { carry: CARRY.HANDS, seconds: 3 }).slip).toBeLessThan(0.02);
    expect(measureSlip(rig, MOTION.fleeTilesPerSecond, { sim: SIM.FLEE, seconds: 3 }).slip).toBeLessThan(0.02);
  });

  for (const k of [1.2, 1.4]) {
    it(`character scale worldPerModel = ${k}: no slip, the stride grows with the scale`, () => {
      const rig = makeRig('hajer');
      const base = measureSlip(rig, MOTION.walkTilesPerSecond, { seconds: 3 });
      const r = measureSlip(rig, MOTION.walkTilesPerSecond, { worldPerModel: k, seconds: 3 });
      expect(r.slip).toBeLessThan(0.02);
      expect(r.stride).toBeGreaterThan(base.stride);
      expect(measureSlip(rig, MOTION.fleeTilesPerSecond, { worldPerModel: k, seconds: 3 }).slip).toBeLessThan(0.02);
    });
  }

  it('other proportion presets (B, C, A+, 3.0) walk without sliding', () => {
    for (const p of [PROPORTION_PRESETS.B, PROPORTION_PRESETS.C, PROPORTION_PRESETS.A_PLUS, PROPORTION_PRESETS.H3_0, scaled(PROPORTION_PRESETS.A, 1.3)]) {
      const rig = makeRig('ciesla', 5, p);
      expect(measureSlip(rig, MOTION.walkTilesPerSecond, { seconds: 3 }).slip).toBeLessThan(0.02);
    }
  });
});

describe('cycles: seams and determinism', () => {
  const rig = makeRig('hajer');
  it('pose(0) = pose(1) for every looping clip (rig output, no springs) and seamJump <= 0.01', () => {
    const r = new Rig(rig);
    const a = new AnimPose();
    const p0 = new Float64Array(BONE_COUNT * 16);
    const ctx = { rig, speed: 0, carry: 0, aimX: 1, aimY: 0.5, probe: null, viewYaw: 0.7, danger: 0, time: 0 };
    for (const [id, clip] of Object.entries(CLIPS)) {
      if (!clip.loop) continue;
      a.reset();
      clip.sample(ctx, 0, a);
      r.solve(a);
      p0.set(r.W);
      a.reset();
      clip.sample(ctx, 1, a);
      r.solve(a);
      let m = 0;
      for (let b = 0; b < BONE_COUNT; b++) for (let c = 12; c < 15; c++) m = Math.max(m, Math.abs(r.W[b * 16 + c]! - p0[b * 16 + c]!));
      expect(m, id).toBeLessThan(0.01);
    }
    expect(seamJump(rig).max).toBeLessThan(0.01);
  });

  it('same inputs -> bitwise identical bones and placement', () => {
    const run = () => {
      const an = new Animator(rig, { viewYawDeg: 40 });
      const inp = baseInput();
      inp.sim = SIM.GOTO;
      const e = { move: MV.WALK_R, fromX: 0.5, fromY: -1, toX: 1.5, toY: -1, t: 0, durationMs: 900, rows: 0 };
      inp.edge = e;
      for (let i = 0; i < 200; i++) {
        e.t = (i % 54) / 54;
        if (i % 54 === 0) {
          e.fromX += 1;
          e.toX += 1;
        }
        an.update(inp, 1 / 60);
      }
      return [Array.from(an.bones), Array.from(an.placement)];
    };
    expect(run()).toEqual(run());
  });

  it('pose() is deterministic and rejects unknown clips', () => {
    const a = createAnimator(rig, { viewYawDeg: 40 });
    const b = createAnimator(rig, { viewYawDeg: 40 });
    a.pose('walk', 0.375, baseInput());
    b.pose('walk', 0.375, baseInput());
    expect(Array.from(a.bones)).toEqual(Array.from(b.bones));
    expect(() => a.pose('nope', 0, baseInput())).toThrow();
  });
});

describe('placement, scale, facing, beard', () => {
  it('placement = position, worldPerModel scale, mirror; beard scale ±10% from the seed', () => {
    const rig = makeRig('kowal', 11);
    const a = new Animator(rig, { viewYawDeg: 0, worldPerModel: 1.4 });
    const inp = baseInput(3.5, -5);
    a.pose('idle', 0.2, inp);
    expect(a.placement[12]).toBeCloseTo(3.5, 6);
    expect(a.placement[13]).toBeCloseTo(-5, 6);
    expect(Math.hypot(a.placement[4]!, a.placement[5]!, a.placement[6]!)).toBeCloseTo(1.4, 6);
    expect(a.placement[0]).toBeGreaterThan(0);
    inp.facing = -1;
    a.pose('idle', 0.2, inp);
    expect(a.placement[0]).toBeLessThan(0);
    const s = Math.hypot(a.bones[BONE.BEARD * 16]!, a.bones[BONE.BEARD * 16 + 1]!, a.bones[BONE.BEARD * 16 + 2]!);
    expect(s).toBeGreaterThanOrEqual(0.9);
    expect(s).toBeLessThanOrEqual(1.1);
    // different seeds give different beards (crowd variety)
    const scales = new Set([1, 2, 3, 4, 5, 6].map((sd) => new Animator(makeRig('kowal', sd), { viewYawDeg: 0 }).beardScale.toFixed(3)));
    expect(scales.size).toBeGreaterThan(3);
  });

  it('a facing change turns through a short mirror tween (no single-frame flip)', () => {
    const a = new Animator(makeRig('hajer'), { viewYawDeg: 40 });
    const inp = baseInput();
    for (let i = 0; i < 10; i++) a.update(inp, 1 / 60);
    inp.facing = -1;
    const xs: number[] = [];
    for (let i = 0; i < 20; i++) {
      a.update(inp, 1 / 60);
      xs.push(a.placement[0]!);
    }
    expect(xs[0]!).toBeGreaterThan(0);
    expect(xs[xs.length - 1]!).toBeLessThan(0);
    for (let i = 1; i < xs.length; i++) expect(Math.abs(xs[i]! - xs[i - 1]!)).toBeLessThan(0.45);
  });
});

describe('feet on the floor probe', () => {
  it('one foot on a step 0.25 higher, the other on the floor (IK reaches both)', () => {
    const rig = makeRig('hajer');
    const d = rigData(rig);
    const rootX = 0.5;
    const floorY = -1;
    const probe: AnimWorldProbe = {
      // step edge between the feet: the idle stance has the right foot ~0.065 ahead of the left
      floorAt: (x) => (x > rootX + 0.05 ? floorY + 0.25 : floorY),
      ladder: { rungSpacing: 0.25, rungOffset: 0, z: -0.85 },
      playZ: () => -0.45,
    };
    const a = new Animator(rig, { viewYawDeg: 0, probe });
    a.pose('idle', 0.1, baseInput(rootX, floorY));
    // idle stance: the right foot is a little ahead -> on the step
    const sole = (b: number) => a.bones[b * 16 + 13]! - d.ankleY + floorY;
    expect(sole(BONE.FOOT_R)).toBeCloseTo(floorY + 0.25, 3);
    expect(sole(BONE.FOOT_L)).toBeCloseTo(floorY, 3);
    expect(a.rig.ikError[IK.FOOT_R]).toBeLessThan(1e-4);
    expect(a.rig.ikError[IK.FOOT_L]).toBeLessThan(1e-4);
  });
});

describe('state machine basics', () => {
  it('walk edges -> WALK with FOOT_DOWN notifies at world heel positions; no edge -> IDLE', () => {
    const a = new Animator(makeRig('tragarz'), { viewYawDeg: 40 });
    const inp = baseInput();
    inp.sim = SIM.GOTO;
    const e = { move: MV.WALK_R, fromX: 0.5, fromY: -1, toX: 1.5, toY: -1, t: 0, durationMs: 1000 / MOTION.walkTilesPerSecond, rows: 0 };
    inp.edge = e;
    const notes: AnimNotify[] = [];
    let downs = 0;
    for (let i = 0; i < 120; i++) {
      e.t = Math.min(1, (i / 60) * MOTION.walkTilesPerSecond - (e.fromX - 0.5));
      if (e.t >= 1) {
        e.fromX += 1;
        e.toX += 1;
        e.t -= 1;
      }
      a.update(inp, 1 / 60);
      const n = a.drainNotifies(notes);
      for (let j = 0; j < n; j++) {
        if (notes[j]!.kind !== NOTIFY.FOOT_DOWN) continue;
        downs++;
        expect(notes[j]!.y).toBeCloseTo(-1, 2);
      }
    }
    expect(a.state).toBe(AS.WALK);
    expect(downs).toBeGreaterThanOrEqual(4);
    inp.edge = null;
    inp.sim = SIM.IDLE;
    a.update(inp, 1 / 60);
    expect(a.state).toBe(AS.IDLE);
  });
});

describe('benchmark', () => {
  it('update + IK + FK of 200 dwarves <= 1.5 ms per frame (Node, production bundle)', () => {
    // bundle the benchmark entry like the game build does and run it in a clean Node process
    const dir = mkdtempSync(join(tmpdir(), 'w2-bench-'));
    const out = join(dir, 'bench.mjs');
    const entry = fileURLToPath(new URL('./bench.entry.ts', import.meta.url));
    execFileSync(process.execPath, [join(dirname(require.resolve('rolldown/package.json')), 'bin', 'cli.mjs'), entry, '--file', out, '--format', 'esm', '--platform', 'node'], { stdio: 'pipe' });
    const res = JSON.parse(execFileSync(process.execPath, [out], { encoding: 'utf8' }).trim().split('\n').pop()!) as { median: number; runs: number[] };
    console.log(`[bench] 200 dwarves (bundled, Node ${process.version}): median ${res.median.toFixed(3)} ms; runs ${res.runs.map((r) => r.toFixed(3)).join(' / ')}`);
    expect(res.median).toBeLessThan(1.5);
  }, 60000);
});
