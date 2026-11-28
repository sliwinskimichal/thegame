/**
 * dig / build (owner: W2): a tool swing timed by the concept card (MOTION):
 *
 *   phase 0 ........ 0.389 ..... 0.478 ....... 0.644 ...... 0.711 ............... 1
 *         windup 0.35 s  | hold 0.08 | strike 0.15 s | recoil 0.06 | recovery 0.26 s
 *         easeInOut5     | easeOut   | strikeIn (t³) | easeOut     | easeInOut
 *   notifies: DIG_WINDUP (0.001), TOOL_SWOOSH (0.505), DIG_HIT (0.644, world strike point)
 *   cancel windows: [0.644, 1) and [0, 0.078) = from the hit to 20% of the next windup
 *
 * The tool is one rigid body: the right fist (TOOL_R origin) and, for two-handed tools, the left fist
 * at `g` along the handle (`gripL`, sliding down toward the butt at the windup apex) are IK targets
 * with the tool's pitch as the fists' root-space pitch. Anticipation: the tool goes back over the
 * head, the torso leans back and turns, the weight sits on the back leg; the strike accelerates
 * (cubic), the torso whips forward and the knees give; the tool bounces off the rock and recovers.
 *
 * Aim: ctx.aimX / aimY (the worked tile centre relative to the root, model units) -> the strike point
 * on the near face of the tile (front wall, floor below, ceiling above) and the face normal. A small
 * search (once per aim change, cached on the rig) picks the handle angle at impact and a stance shift
 * of the whole dwarf (root offset) so that the blade meets the face square while both fists stay in
 * reach of the (twisted) shoulders and in front of the barrel torso.
 */
import { MOTION } from '../../characters/direction';
import { bump, easeInOut, easeInOut5, easeOut, seg, strikeIn } from '../curves';
import { AnimPose, setIK } from '../pose';
import type { RigData } from '../rigdata';
import { BONE, IK, NOTIFY, type AnimClip, type ClipContext, type PoseFrame, type ToolInfo } from '../types';
import { gear, plantFoot, rdOf, tileSize } from './common';
import type { StrikeClip } from './index';

const T_ALL = MOTION.digWindup + MOTION.digHold + MOTION.digStrike + MOTION.digRecover;
export const SWING = {
  seconds: T_ALL,
  windupEnd: MOTION.digWindup / T_ALL,
  holdEnd: (MOTION.digWindup + MOTION.digHold) / T_ALL,
  hit: (MOTION.digWindup + MOTION.digHold + MOTION.digStrike) / T_ALL,
  recoilEnd: (MOTION.digWindup + MOTION.digHold + MOTION.digStrike + 0.06) / T_ALL,
} as const;

interface Key {
  fx: number;
  fy: number;
  th: number;
  g: number;
  yaw: number;
  lean: number;
  px: number;
  py: number;
}
const key = (): Key => ({ fx: 0, fy: 0, th: 0, g: 0, yaw: 0, lean: 0, px: 0, py: 0 });

interface Plan {
  aimX: number;
  aimY: number;
  tile: number;
  two: boolean;
  zt: number;
  dx: number;
  sx: number;
  sy: number;
  ready: Key;
  apex: Key;
  hold: Key;
  hit: Key;
  recoil: Key;
  /** shortfall of the left fist at the hit (0 = on the handle) — reported by tests */
  leftShort: number;
}
const newPlan = (): Plan => ({ aimX: Number.NaN, aimY: Number.NaN, tile: 0, two: false, zt: 0, dx: 0, sx: 0, sy: 0, ready: key(), apex: key(), hold: key(), hit: key(), recoil: key(), leftShort: 0 });

const MODE = { DIG: 0, BUILD: 1 } as const;
/** a stand-in "tool" for empty hands: the fists themselves strike */
const HANDS: ToolInfo = { kind: 'none', length: 0.05, gripL: 0, head: 0.04, strike: [0.03, 0.03, 0] };

function toolOf(d: RigData): ToolInfo {
  return d.toolR ?? HANDS;
}

function planFor(d: RigData, ctx: ClipContext, mode: number): Plan {
  const c = d.cache as { swing?: Plan[] };
  if (!c.swing) c.swing = [newPlan(), newPlan()];
  const p = c.swing[mode]!;
  const tile = tileSize(ctx);
  let ax = ctx.aimX;
  let ay = ctx.aimY;
  if (Number.isNaN(ax) || Number.isNaN(ay)) {
    ax = tile;
    ay = 0.5 * tile;
  }
  if (p.aimX !== ax || p.aimY !== ay || p.tile !== tile) solvePlan(d, mode, Math.abs(ax), ay, tile, p);
  return p;
}

/** Shoulder (side ±1) for a torso yaw/lean and pelvis offset, approximated about the spine joint. */
function shoulder(d: RigData, side: number, yaw: number, lean: number, px: number, py: number, o: Float64Array): void {
  const r = d.rest;
  const h = d.shoulderY - r[BONE.SPINE * 3 + 1]!;
  const z = side * d.shoulderZ;
  const x1 = h * Math.sin(lean);
  const y1 = h * Math.cos(lean);
  o[0] = px + x1 * Math.cos(yaw) + z * Math.sin(yaw);
  o[1] = py + r[BONE.SPINE * 3 + 1]! + y1;
  o[2] = -x1 * Math.sin(yaw) + z * Math.cos(yaw);
}

const sh = new Float64Array(3);

/**
 * Swing grip: the handle crosses the fist (perpendicular to the forearm), so the tool sits in the
 * hand turned by -90° and the fist's pitch is the handle angle + 90°: the forearm reaches the fist
 * from above-behind like in a real swing (a handle along the forearm would need a 90° wrist bend).
 */
export const GRIP_TOOL = -Math.PI / 2;

/** How far a fist at (x, y, z) holding the handle at angle th is beyond the arm's reach (0 = ok). */
function overreach(d: RigData, side: number, k: Key, x: number, y: number, z: number, th: number): number {
  shoulder(d, side, k.yaw, k.lean, k.px, k.py, sh);
  // wrist = fist - Rz(th + 90°)·(0, -fist) = fist - fist·(cos th, sin th)
  const wx = x - d.fist * Math.cos(th);
  const wy = y - d.fist * Math.sin(th);
  const dist = Math.hypot(wx - sh[0]!, wy - sh[1]!, z - sh[2]!);
  return Math.max(0, dist - 0.97 * (d.upper + d.fore));
}

/** Best left grip distance along the handle (largest that reaches), and the shortfall. */
function leftGrip(d: RigData, t: ToolInfo, k: Key, zt: number, gmin: number): [number, number] {
  let best = 0;
  let bestOver = Infinity;
  for (let i = 0; i <= 6; i++) {
    const g = t.gripL * (1 - (i / 6) * (1 - gmin));
    const o = overreach(d, -1, k, k.fx - g * Math.sin(k.th), k.fy + g * Math.cos(k.th), zt, k.th);
    if (o < bestOver - 1e-6) {
      bestOver = o;
      best = g;
    }
    if (o === 0) break;
  }
  return [best, bestOver];
}

function solvePlan(d: RigData, mode: number, ax: number, ay: number, tile: number, p: Plan): void {
  const u = d.unit;
  const t = toolOf(d);
  const two = t.gripL > 0;
  const half = tile * 0.5;
  // strike point on the near face and the face normal
  let sx: number;
  let sy: number;
  let nx = -1;
  let ny = 0;
  const below = ay + half <= 0.05 * tile;
  const above = ay - half >= d.crownY * 0.85;
  if (below) {
    sx = Math.min(Math.max(0.6 * u, ax - half + 0.04 * tile), ax + half - 0.04 * tile);
    sy = ay + half;
    nx = 0;
    ny = 1;
  } else if (above) {
    sx = Math.min(Math.max(0.25 * u, ax - half + 0.04 * tile), ax + half - 0.04 * tile);
    sy = ay - half;
    nx = 0;
    ny = -1;
  } else {
    const pref = mode === MODE.DIG ? 0.72 * u : 0.6 * u;
    sx = ax - half;
    sy = Math.min(Math.max(pref, ay - half + 0.05 * tile), ay + half - 0.05 * tile);
  }
  p.two = two;
  const hit = p.hit;
  hit.yaw = two ? -0.45 : 0.15;
  hit.lean = mode === MODE.DIG ? 0.32 : 0.22;
  hit.px = 0.02 * u;
  hit.py = -0.04 * d.legUnit;
  const sxl = t.strike[0];
  const syl = t.strike[1];
  const torsoLo = d.rest[BONE.SPINE * 3 + 1]! - 0.08 * u;
  const torsoHi = d.shoulderY;
  // penetration of a fist into the barrel torso (vertical cylinder r = chestR around the spine)
  // (a few cm of tolerance: the fist touching the belly is invisible at 75 px)
  const inside = (x: number, y: number, z: number) => (y > torsoLo && y < torsoHi + 0.08 * u ? Math.max(0, d.chestR * 0.95 - 0.05 * u - Math.hypot(x - hit.px, z)) : 0);
  const chestY = d.shoulderY - (mode === MODE.DIG ? 0.12 : 0.2) * u;
  const zs = two ? [0.02, 0.08, 0.14, 0.2] : [d.shoulderZ * 0.8 / u];
  let best = Infinity;
  let bestTh = 0;
  for (const zu of zs) {
    const zt = zu * u;
    for (let i = 0; i <= 64; i++) {
      const th = -2.6 + i * 0.05;
      const c = Math.cos(th);
      const s2 = Math.sin(th);
      const rx = sxl * c - syl * s2;
      const ry = sxl * s2 + syl * c;
      const align = 1 + (c * nx + s2 * ny);
      for (let j = 0; j <= 20; j++) {
        const dx = (-0.6 + j * 0.04) * u;
        hit.fx = sx - dx - rx;
        hit.fy = sy - ry;
        hit.th = th;
        const oR = overreach(d, 1, hit, hit.fx, hit.fy, zt, th);
        let oL = 0;
        let inL = 0;
        if (two) {
          const [g, o] = leftGrip(d, t, hit, zt, 0.5);
          oL = o;
          inL = inside(hit.fx - g * s2, hit.fy + g * c, zt);
        }
        const pen = inside(hit.fx, hit.fy, zt) + inL + Math.max(0, d.hipY - hit.fy);
        const cost = 1.2 * align + (30 * oR + 12 * oL + 30 * pen + 1.5 * Math.abs(hit.fy - chestY)) / u + 0.4 * Math.abs(dx / u);
        if (cost < best) {
          best = cost;
          p.dx = dx;
          p.zt = zt;
          bestTh = th;
        }
      }
    }
  }
  p.sx = sx;
  p.sy = sy;
  hit.th = bestTh;
  hit.fx = sx - p.dx - (sxl * Math.cos(bestTh) - syl * Math.sin(bestTh));
  hit.fy = sy - (sxl * Math.sin(bestTh) + syl * Math.cos(bestTh));
  if (two) {
    const [g, o] = leftGrip(d, t, hit, p.zt, 0.5);
    hit.g = g;
    p.leftShort = o;
  } else {
    hit.g = 0;
    p.leftShort = 0;
  }
  // apex: the tool back over the head, torso leaning back and turned less, weight on the back leg
  const apex = p.apex;
  apex.yaw = two ? -0.22 : -0.35;
  apex.lean = mode === MODE.DIG ? -0.16 : -0.08;
  apex.px = -0.03 * u;
  apex.py = -0.012 * d.legUnit;
  shoulder(d, 1, apex.yaw, apex.lean, apex.px, apex.py, sh);
  const sy0 = sh[1]!;
  apex.fx = sh[0]! * 0.5 - (mode === MODE.DIG ? 0.03 : -0.04) * u;
  apex.fy = sy0 + (mode === MODE.DIG ? 0.2 : 0.12) * u;
  apex.th = mode === MODE.DIG ? Math.min(2.7, Math.max(2.0, bestTh + 3.3)) : Math.min(2.3, Math.max(1.4, bestTh + 2.2));
  // keep the right fist reachable (pull it toward the shoulder)
  for (let i = 0; i < 8 && overreach(d, 1, apex, apex.fx, apex.fy, p.zt, apex.th) > 0; i++) {
    apex.fy -= 0.02 * u;
    apex.fx += 0.01 * u;
  }
  apex.g = two ? leftGrip(d, t, apex, p.zt, 0.3)[0] : 0;
  const hold = p.hold;
  Object.assign(hold, apex);
  hold.th = apex.th + 0.06;
  hold.fy = apex.fy + 0.008 * u;
  hold.lean = apex.lean - 0.02;
  // ready (cycle seam): pulled back from the hit, tool raised a little
  const ready = p.ready;
  Object.assign(ready, hit);
  ready.fx = hit.fx - 0.05 * u;
  ready.fy = hit.fy + 0.1 * u;
  ready.th = hit.th + 0.5;
  ready.yaw = hit.yaw * 0.6;
  ready.lean = 0.06;
  ready.px = 0;
  ready.py = -0.015 * d.legUnit;
  if (two) ready.g = leftGrip(d, t, ready, p.zt, 0.5)[0];
  // recoil: the tool bounces off the rock
  const recoil = p.recoil;
  Object.assign(recoil, hit);
  recoil.th = hit.th + 0.14;
  recoil.fx = hit.fx - 0.012 * u;
  recoil.fy = hit.fy + 0.025 * u;
  recoil.lean = hit.lean - 0.05;
  p.aimX = ax;
  p.aimY = ay;
  p.tile = tile;
}

const cur = key();
function mixKey(a: Key, b: Key, t: number, o: Key): void {
  o.fx = a.fx + (b.fx - a.fx) * t;
  o.fy = a.fy + (b.fy - a.fy) * t;
  o.th = a.th + (b.th - a.th) * t;
  o.g = a.g + (b.g - a.g) * t;
  o.yaw = a.yaw + (b.yaw - a.yaw) * t;
  o.lean = a.lean + (b.lean - a.lean) * t;
  o.px = a.px + (b.px - a.px) * t;
  o.py = a.py + (b.py - a.py) * t;
}
/** Same, with the fist on a quadratic arc bulging by (bx, by) at the middle. */
function arcKey(a: Key, b: Key, t: number, bx: number, by: number, o: Key): void {
  mixKey(a, b, t, o);
  const w = 4 * t * (1 - t);
  o.fx += bx * w;
  o.fy += by * w;
}

/** Key of the swing at a phase (exposed for tests: the hit key is exact at SWING.hit). */
function sampleKey(p: Plan, ph: number, u: number, o: Key): number {
  let hitness = 0;
  if (ph < SWING.windupEnd) {
    arcKey(p.ready, p.apex, easeInOut5(ph / SWING.windupEnd), -0.04 * u, 0.03 * u, o);
  } else if (ph < SWING.holdEnd) {
    mixKey(p.apex, p.hold, easeOut(seg(ph, SWING.windupEnd, SWING.holdEnd)), o);
  } else if (ph < SWING.hit) {
    const t = strikeIn(seg(ph, SWING.holdEnd, SWING.hit));
    arcKey(p.hold, p.hit, t, 0.07 * u, 0.05 * u, o);
    hitness = t;
  } else if (ph < SWING.recoilEnd) {
    mixKey(p.hit, p.recoil, easeOut(seg(ph, SWING.hit, SWING.recoilEnd)), o);
    hitness = 1;
  } else {
    const t = easeInOut(seg(ph, SWING.recoilEnd, 1));
    mixKey(p.recoil, p.ready, t, o);
    hitness = 1 - t;
  }
  return hitness;
}

function sampleSwing(ctx: ClipContext, phase: number, out: PoseFrame, mode: number): void {
  const d = rdOf(ctx);
  const u = d.unit;
  const lu = d.legUnit;
  const p = planFor(d, ctx, mode);
  const ph = phase < 0 || phase > 1 ? phase - Math.floor(phase) : phase;
  const k = cur;
  const hitness = sampleKey(p, ph, u, k);
  const r = out.rot;
  // stance shift of the whole dwarf (feet planted in the shifted root space)
  out.root[0] = p.dx;
  out.pos[BONE.PELVIS * 3] = k.px;
  out.pos[BONE.PELVIS * 3 + 1] = k.py;
  r[BONE.PELVIS * 3 + 1] = k.yaw * 0.3;
  r[BONE.SPINE * 3 + 1] = k.yaw * 0.35;
  r[BONE.SPINE * 3 + 2] = -k.lean * 0.5;
  r[BONE.CHEST * 3 + 1] = k.yaw * 0.35;
  r[BONE.CHEST * 3 + 2] = -k.lean * 0.5;
  r[BONE.HEAD * 3 + 1] = -k.yaw * 0.6;
  r[BONE.HEAD * 3 + 2] = k.lean * 0.6 - 0.14 * hitness;
  // staggered stance: left foot forward, back foot turned out; weight follows the pelvis
  const z = d.hipZ + 0.05 * lu;
  plantFoot(d, out, 1, -0.1 * lu, 0, z + 0.02 * lu, -0.45);
  plantFoot(d, out, -1, 0.11 * lu, 0, -z, -0.12);
  // the tool as a rigid body in the fists
  const grip = p.two || d.toolR ? -GRIP_TOOL : 0;
  setIK(out, IK.HAND_R, k.fx, k.fy, p.zt, k.th + grip, 1);
  r[BONE.HAND_R * 3] = 0;
  r[BONE.HAND_R * 3 + 1] = 0;
  r[BONE.TOOL_R * 3] = 0;
  r[BONE.TOOL_R * 3 + 1] = 0;
  r[BONE.TOOL_R * 3 + 2] = grip ? GRIP_TOOL : 0;
  if (p.two) {
    setIK(out, IK.HAND_L, k.fx - k.g * Math.sin(k.th), k.fy + k.g * Math.cos(k.th), p.zt, k.th + grip, 1);
    r[BONE.HAND_L * 3] = 0;
    r[BONE.HAND_L * 3 + 1] = 0;
  } else {
    // the left hand steadies the work (tongs forward toward it, or the bare hand), within reach
    shoulder(d, -1, k.yaw, k.lean, k.px, k.py, sh);
    const tx = p.sx - p.dx - 0.08 * u;
    const ty = p.sy - 0.1 * u;
    const tz = -0.05 * u;
    let vx = tx - sh[0]!;
    let vy = ty - sh[1]!;
    let vz = tz - sh[2]!;
    const len = Math.hypot(vx, vy, vz);
    const lim = 0.85 * d.armReach;
    if (len > lim) {
      vx *= lim / len;
      vy *= lim / len;
      vz *= lim / len;
    }
    const pitch = d.toolL ? Math.atan2(-(tx - sh[0]! - vx), ty - sh[1]! - vy) + Math.PI / 2 : 1.2;
    setIK(out, IK.HAND_L, sh[0]! + vx, sh[1]! + vy, sh[2]! + vz, d.toolL ? pitch : 1.2, 1);
    r[BONE.TOOL_L * 3 + 2] = d.toolL ? GRIP_TOOL : 0;
  }
  // the carpenter's beam is put down for work; nothing carried
  gear(out, 0, ctx.rig.back === 'beam' ? 0 : 1);
  if (out instanceof AnimPose) out.attach[0] = out.attach[1] = 0;
  void bump;
}

function makeSwing(id: string, mode: number): StrikeClip {
  return {
    id,
    drive: 'time',
    loop: true,
    length: () => SWING.seconds,
    notifies: [
      { phase: 0.001, kind: NOTIFY.DIG_WINDUP, side: 0 },
      { phase: SWING.holdEnd + 0.3 * (SWING.hit - SWING.holdEnd), kind: NOTIFY.TOOL_SWOOSH, side: 0 },
      { phase: SWING.hit, kind: NOTIFY.DIG_HIT, side: 0 },
    ],
    cancel: [
      [SWING.hit, 1.0000001],
      [0, 0.2 * SWING.windupEnd],
    ],
    sample(ctx, phase, out) {
      sampleSwing(ctx, phase, out, mode);
    },
    strike(ctx, out) {
      const p = planFor(rdOf(ctx), ctx, mode);
      out[0] = p.sx - p.dx;
      out[1] = p.sy;
      out[2] = p.zt + toolOf(rdOf(ctx)).strike[2];
    },
  };
}

export const digClip: StrikeClip = makeSwing('dig', MODE.DIG);
export const buildClip: StrikeClip = makeSwing('build', MODE.BUILD);

/** Plan inspection for tests and the report. */
export function swingPlan(ctx: ClipContext, mode: 'dig' | 'build'): Readonly<Plan> {
  return planFor(rdOf(ctx), ctx, mode === 'dig' ? MODE.DIG : MODE.BUILD);
}

export type { AnimClip };
