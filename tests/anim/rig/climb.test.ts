// W2: ladder climbing on the rung lattice — hands and feet on rungs in every phase, no sliding on the
// rungs, RUNG_GRAB per hand landing, back to the camera, tools slung, at several character scales.
import { describe, expect, it } from 'vitest';
import { BEAT, LIMBS, MOVE } from '../../../src/render/anim/clips/climb';
import { Animator } from '../../../src/render/anim/machine';
import { baseInput } from '../../../src/render/anim/metrics';
import { AS, BONE, MV, NOTIFY, SIM, type AnimNotify, type AnimWorldProbe } from '../../../src/render/anim/types';
import { makeRig } from './fixture';

const SP = 0.25;
const OFF = 0.05;
const probe: AnimWorldProbe = { floorAt: () => Number.NaN, ladder: { rungSpacing: SP, rungOffset: OFF, z: -0.85 }, playZ: () => -0.45 };

/** Moving flag of a limb at a phase (the clip's schedule). */
const moving = (start: number, phase: number) => (((phase - start) / BEAT) % 1 + 1) % 1 * BEAT < MOVE;

/** World points: fist centres and the arch of the boots (where the rung is held). */
function limbs(a: Animator): { hand: [number, number, number][]; foot: [number, number, number][] } {
  const d = a.d;
  const t = new Float64Array(3);
  const w = (b: number, x: number, y: number, z: number): [number, number, number] => {
    a.rig.point(b, x, y, z, t, 0);
    a.toWorld(t[0]!, t[1]!, t[2]!, t, 0);
    return [t[0]!, t[1]!, t[2]!];
  };
  const off = (b: number, k: number) => d.rest[b * 3 + k]! - d.rest[(b === BONE.TOOL_R ? BONE.HAND_R : BONE.HAND_L) * 3 + k]!;
  return {
    hand: [w(BONE.HAND_R, off(BONE.TOOL_R, 0), off(BONE.TOOL_R, 1), off(BONE.TOOL_R, 2)), w(BONE.HAND_L, off(BONE.TOOL_L, 0), off(BONE.TOOL_L, 1), off(BONE.TOOL_L, 2))],
    foot: [w(BONE.FOOT_R, 0, 0, 0), w(BONE.FOOT_L, 0, 0, 0)],
  };
}

/** Distance of a height to the nearest rung of the lattice. */
const offRung = (y: number) => {
  const q = (y - OFF) / SP;
  return Math.abs(q - Math.round(q)) * SP;
};

describe('climb: hands and feet on the rungs in every phase', () => {
  for (const k of [1, 1.2, 1.4]) {
    it(`worldPerModel ${k}: planted fists and boots sit on world rungs (lab poses, 32 phases)`, () => {
      const a = new Animator(makeRig('hajer'), { viewYawDeg: 40, worldPerModel: k, probe });
      const d = a.d;
      for (let i = 0; i < 32; i++) {
        const ph = i / 32;
        a.pose('climb', ph, baseInput(0.5, -6));
        expect(a.state).toBe(AS.CLIMB);
        const L = limbs(a);
        for (const limb of LIMBS) {
          if (moving(limb.start, ph)) continue;
          const s = limb.side > 0 ? 0 : 1;
          if (limb.hand) expect(offRung(L.hand[s]![1] - 0.012 * d.unit * k), `hand ${s} @${ph}`).toBeLessThan(1e-3);
          else expect(offRung(L.foot[s]![1] - (d.ankleY + 0.012 * d.legUnit) * k), `foot ${s} @${ph}`).toBeLessThan(1e-3);
        }
        for (let e = 0; e < 4; e++) expect(a.rig.ikError[e]).toBeLessThan(1e-3);
        // on the ladder plane (depth)
        for (const p of [...L.hand]) expect(Math.abs(p[2] - probe.ladder.z)).toBeLessThan(0.08 * k);
      }
    });
  }

  it('back to the camera with a 30° turn to the right side; tools slung on the back', () => {
    const a = new Animator(makeRig('hajer'), { viewYawDeg: 40, probe });
    a.pose('climb', 0.2, baseInput(0.5, -6));
    const m = a.placement;
    // model +X (forward) goes into the wall, model +Z (right side) partly toward the camera
    expect(m[2]).toBeLessThan(-0.5);
    expect(m[10]).toBeGreaterThan(0.3);
    expect(m[10]).toBeLessThan(0.7);
    // the pick is on the back: nearer the camera than the chest
    const t = new Float64Array(3);
    const c = new Float64Array(3);
    a.rig.point(BONE.TOOL_R, 0, 0, 0, t, 0);
    a.toWorld(t[0]!, t[1]!, t[2]!, t, 0);
    a.rig.point(BONE.CHEST, 0, 0, 0, c, 0);
    a.toWorld(c[0]!, c[1]!, c[2]!, c, 0);
    expect(t[2]).toBeGreaterThan(c[2]!);
  });
});

describe('climb in the state machine', () => {
  for (const [name, move, ms] of [
    ['up (900 ms/row)', MV.UP, 900],
    ['down (600 ms/row)', MV.DOWN, 600],
  ] as const) {
    it(`${name}: planted limbs do not slide on the rungs; RUNG_GRAB twice per hand per cycle`, () => {
      const a = new Animator(makeRig('ciesla'), { viewYawDeg: 40, probe });
      const inp = baseInput(0.5, -8);
      inp.sim = SIM.GOTO;
      const dir = move === MV.UP ? 1 : -1;
      const e = { move, fromX: 0.5, fromY: -8, toX: 0.5, toY: -8 + dir, t: 0, durationMs: ms, rows: 0 };
      inp.edge = e;
      const dt = 1 / 120;
      const notes: AnimNotify[] = [];
      let grabs = 0;
      let maxSlide = 0;
      const prev: (number[] | null)[] = [null, null, null, null];
      const rows = 4;
      const frames = Math.round((rows * ms) / 1000 / dt);
      for (let f = 0; f < frames; f++) {
        const ms0 = f * dt * 1000;
        const row = Math.floor(ms0 / ms);
        e.fromY = -8 + dir * row;
        e.toY = e.fromY + dir;
        e.t = (ms0 - row * ms) / ms;
        a.update(inp, dt);
        const n = a.drainNotifies(notes);
        if (f < 60) continue; // blend into the climb
        expect(a.state).toBe(AS.CLIMB);
        grabs += notes.slice(0, n).filter((x) => x.kind === NOTIFY.RUNG_GRAB).length;
        const L = limbs(a);
        LIMBS.forEach((limb, i) => {
          const pts = limb.hand ? L.hand : L.foot;
          const p = pts[limb.side > 0 ? 0 : 1]!;
          if (moving(limb.start, a.phase)) {
            prev[i] = null;
            return;
          }
          if (prev[i]) maxSlide = Math.max(maxSlide, Math.hypot(p[0] - prev[i]![0]!, p[1] - prev[i]![1]!));
          prev[i] = [...p];
        });
      }
      const speed = 1000 / ms;
      // a planted limb moves less than 2% of the climbing speed per frame
      expect(maxSlide / dt / speed).toBeLessThan(0.02);
      // cycle = 2 rungs = 0.5 tile: 4 grabs per cycle (2 per hand)
      const cycles = ((frames - 60) * dt * speed) / (2 * SP);
      expect(Math.abs(grabs - 4 * cycles)).toBeLessThanOrEqual(2);
    });
  }
});
