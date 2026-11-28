/**
 * Role gear (owner: W1) — concept card §2 / ROLE_DIRECTION: the role reads from the black silhouette
 * as HEADGEAR + TOOL + BACK ELEMENT. Every role part carries `identity` and an `ident` group that
 * survives every LOD (LOD2 tokens with exact segment counts keep the dwarf <= 60 triangles).
 * Tools are authored in the contract's tool frame (origin = centre of the fist = TOOL_* joint, handle
 * along +Y, working edge toward +X) and placed at the socket in rest model space.
 */
import { BONE, HOLD, type LampInfo, type ToolInfo } from '../../anim/types';
import { FIXED_COLORS } from '../direction';
import { ROLE, SLOT } from '../types';
import { J, MODEL_COLORS, TORSO_DEPTH, type Frame } from './anatomy';
import { CAP_BOTTOM, linearRgb, type IdentGroup, type ModelPart } from './part';
import { decimate } from './shapes';

export interface RoleGear {
  parts: ModelPart[];
  toolR: ToolInfo | null;
  toolL: ToolInfo | null;
  hold: number;
  back: 'none' | 'apron' | 'beam' | 'frame';
  front: 'none' | 'apron';
  lamp: LampInfo;
  /** Socket joints moved by the gear: [bone, x, y, z]. */
  sockets: [number, number, number, number][];
}

type V3 = [number, number, number];
const add3 = (a: readonly number[], b: readonly number[]): V3 => [a[0]! + b[0]!, a[1]! + b[1]!, a[2]! + b[2]!];
const HALF_PI = Math.PI / 2;

/** Shorthand for an identity part. */
function idp(ident: IdentGroup, q: ModelPart): ModelPart {
  return { ...q, identity: true, ident };
}

function tok(ident: IdentGroup | null, q: ModelPart): ModelPart {
  return { ...q, fromLod: 2, minLod: 2, ...(ident ? { identity: true, ident } : {}) };
}

function lampColor(intensity: number): [number, number, number] {
  const c = linearRgb(FIXED_COLORS.lampFlame);
  return [c[0] * intensity, c[1] * intensity, c[2] * intensity];
}

/** Belt lantern on LANTERN (carpenter, porter, smith): LOD0–1 geometry, LOD2 = renderer sprite. */
function beltLantern(f: Frame, parts: ModelPart[], sockets: RoleGear['sockets']): LampInfo {
  const beltR = f.p.bellyR + 0.02;
  const hinge: V3 = [0.13, f.beltY - 0.03, beltR * 0.85];
  sockets.push([BONE.LANTERN, ...hinge]);
  const c: V3 = [hinge[0] + 0.01, f.beltY - 0.118, hinge[2] + 0.012];
  parts.push(
    { name: 'lantern', bone: BONE.LANTERN, shape: { k: 'box', w: 0.056, h: 0.075, d: 0.056 }, t: c, slot: SLOT.FIXED, color: FIXED_COLORS.lampFlame, emissive: 2.2, minLod: 1 },
    {
      name: 'lantern.cap',
      bone: BONE.LANTERN,
      shape: { k: 'frustum', r0: 0.044, r1: 0.012, h: 0.032 },
      t: [c[0], c[1] + 0.053, c[2]],
      slot: SLOT.FIXED,
      color: FIXED_COLORS.iron,
      seg: 4,
      phase: Math.PI / 4,
      minLod: 0,
    },
    { name: 'lantern.base', bone: BONE.LANTERN, shape: { k: 'box', w: 0.064, h: 0.014, d: 0.064 }, t: [c[0], c[1] - 0.042, c[2]], slot: SLOT.FIXED, color: FIXED_COLORS.iron, minLod: 0 },
    { name: 'lantern.hook', bone: BONE.LANTERN, shape: { k: 'box', w: 0.008, h: 0.05, d: 0.008 }, t: [c[0], hinge[1] - 0.02, c[2]], slot: SLOT.FIXED, color: FIXED_COLORS.iron, minLod: 0 },
    { name: 'lantern.bar0', bone: BONE.LANTERN, shape: { k: 'box', w: 0.008, h: 0.075, d: 0.008 }, t: [c[0] + 0.012, c[1], c[2] + 0.03], slot: SLOT.FIXED, color: FIXED_COLORS.iron, minLod: 0 },
    { name: 'lantern.bar1', bone: BONE.LANTERN, shape: { k: 'box', w: 0.008, h: 0.075, d: 0.008 }, t: [c[0] - 0.014, c[1], c[2] + 0.03], slot: SLOT.FIXED, color: FIXED_COLORS.iron, minLod: 0 },
  );
  return { bone: BONE.LANTERN, offset: c, color: lampColor(0.85), radius: 2 };
}

/** Sack of spoil on LOAD (carried in the hands; the animator shows it only while carrying). */
function sack(f: Frame, parts: ModelPart[]): void {
  const L = J(f, BONE.LOAD);
  parts.push(
    idp('load', { name: 'sack', bone: BONE.LOAD, shape: { k: 'ellipsoid', rx: 0.13, ry: 0.14, rz: 0.17 }, t: L, slot: SLOT.FIXED, color: MODEL_COLORS.burlap, minLod: 1, seg: 12, rings: 6, lod1: { seg: 4, rings: 2 } }),
    { name: 'sack.tie', bone: BONE.LOAD, shape: { k: 'frustum', r0: 0.05, r1: 0.035, h: 0.06 }, t: [L[0], L[1] + 0.15, L[2]], slot: SLOT.FIXED, color: MODEL_COLORS.rope, minLod: 0 },
    tok('load', { name: 'tok.sack', bone: BONE.LOAD, shape: { k: 'frustum', r0: 0.15, r1: 0, h: 0.27 }, t: L, slot: SLOT.FIXED, color: MODEL_COLORS.burlap, seg: 3 }),
  );
}

// ------------------------------------------------------------------------------------------------ hajer (miner)
function miner(f: Frame): RoleGear {
  const { k, hx } = f;
  const parts: ModelPart[] = [];
  const sockets: RoleGear['sockets'] = [];
  const top = f.crownY + f.p.hatH;
  const base = f.hy + 0.035 * k;
  const hr = 0.178 * k;
  const hc: V3 = [hx - 0.005, base, 0];
  parts.push(
    idp('headgear', { name: 'helmet', bone: BONE.HEAD, shape: { k: 'dome', r: hr, ry: top - base }, t: hc, s: [1, 1, 1.03], slot: SLOT.CLOTH, minLod: 1, lod1: { seg: 6, rings: 2 } }),
    idp('headgear', {
      name: 'helmet.band',
      bone: BONE.HEAD,
      shape: { k: 'frustum', r0: hr + 0.004, r1: hr + 0.003, h: 0.036 * k },
      t: [hc[0], base + 0.016 * k, 0],
      s: [1, 1, 1.03],
      slot: SLOT.FIXED,
      color: FIXED_COLORS.iron,
      minLod: 1,
      cap: 0,
      lod1: { seg: 6 },
    }),
    idp('headgear', {
      name: 'helmet.visor',
      bone: BONE.HEAD,
      shape: { k: 'ellipsoid', rx: 0.095 * k, ry: 0.016 * k, rz: 0.155 * k },
      t: [hx + 0.145 * k, base + 0.002, 0],
      r: [0, 0, -0.28],
      slot: SLOT.CLOTH,
      minLod: 1,
      seg: 12,
      rings: 4,
      lod1: { seg: 4, rings: 2 },
    }),
    idp('headgear', {
      name: 'helmet.rib',
      bone: BONE.HEAD,
      shape: { k: 'dome', r: hr + 0.006, ry: top - base + 0.006 },
      t: hc,
      s: [1, 1, 0.09],
      slot: SLOT.FIXED,
      color: FIXED_COLORS.iron,
      minLod: 0,
      seg: 8,
      rings: 6,
    }),
  );
  for (const [i, a] of [0.9, 1.45, 2.0].entries()) {
    parts.push({
      name: `helmet.rivet${i}`,
      bone: BONE.HEAD,
      shape: { k: 'ellipsoid', rx: 0.012, ry: 0.012, rz: 0.012 },
      t: [hc[0] + Math.cos(a) * (hr + 0.006), base + 0.016 * k, Math.sin(a) * (hr + 0.006) * 1.03],
      slot: SLOT.FIXED,
      color: FIXED_COLORS.ironEdge,
      minLod: 0,
      seg: 5,
      rings: 3,
    });
  }
  // kaganek: a small oil-lamp pot on a plate at the front with a ROUND flame (no spike: lead, E1 review)
  const lampC: V3 = [hx + 0.212 * k, base + 0.075 * k, 0];
  const flameC: V3 = [lampC[0] + 0.006, lampC[1] + 0.05, 0];
  parts.push(
    idp('lamp', { name: 'lamp.plate', bone: BONE.HEAD, shape: { k: 'box', w: 0.075 * k, h: 0.09 * k, d: 0.018 }, t: [hx + 0.176 * k, base + 0.06 * k, 0], r: [0, 0, -0.42], slot: SLOT.FIXED, color: FIXED_COLORS.iron, minLod: 0 }),
    idp('lamp', {
      name: 'lamp',
      bone: BONE.HEAD,
      shape: { k: 'frustum', r0: 0.03, r1: 0.038, h: 0.045 },
      t: lampC,
      slot: SLOT.FIXED,
      color: MODEL_COLORS.brass,
      minLod: 1,
      seg: 10,
      lod1: { seg: 4, phase: Math.PI / 4 },
    }),
    idp('lamp', {
      name: 'lamp.flame',
      bone: BONE.HEAD,
      shape: { k: 'ellipsoid', rx: 0.03, ry: 0.036, rz: 0.03 },
      t: flameC,
      slot: SLOT.FIXED,
      color: FIXED_COLORS.lampFlame,
      emissive: 3,
      minLod: 1,
      seg: 8,
      rings: 5,
      lod1: { seg: 4, rings: 2 },
    }),
    { name: 'lamp.spout', bone: BONE.HEAD, shape: { k: 'capsule', r: 0.011, len: 0.05 }, t: [lampC[0] + 0.035, lampC[1] + 0.012, 0], r: [0, 0, -1.2], slot: SLOT.FIXED, color: MODEL_COLORS.brass, minLod: 0 },
    // kitka: a short fluffy brush at the back of the crown, leaning back, rounded (never a horn)
    {
      name: 'plume',
      bone: BONE.HEAD,
      shape: { k: 'ellipsoid', rx: 0.048, ry: 0.072, rz: 0.048 },
      t: [hx - 0.125 * k, f.crownY + 0.045, 0],
      r: [0, 0, 0.35],
      slot: SLOT.ACCENT,
      minLod: 1,
      lod1: { seg: 5, rings: 2 },
    },
    { name: 'plume.tuft0', bone: BONE.HEAD, shape: { k: 'ellipsoid', rx: 0.034, ry: 0.05, rz: 0.034 }, t: [hx - 0.15 * k, f.crownY + 0.05, 0.028], r: [-0.3, 0, 0.5], slot: SLOT.ACCENT, minLod: 0 },
    { name: 'plume.tuft1', bone: BONE.HEAD, shape: { k: 'ellipsoid', rx: 0.034, ry: 0.05, rz: 0.034 }, t: [hx - 0.15 * k, f.crownY + 0.05, -0.028], r: [0.3, 0, 0.5], slot: SLOT.ACCENT, minLod: 0 },
    {
      name: 'plume.holder',
      bone: BONE.HEAD,
      shape: { k: 'frustum', r0: 0.022, r1: 0.017, h: 0.035 },
      t: [hx - 0.11 * k, f.crownY + 0.01, 0],
      r: [0, 0, 0.35],
      slot: SLOT.FIXED,
      color: FIXED_COLORS.iron,
      minLod: 0,
    },
  );
  // pick: handle 0.75, two-pointed head 0.36 (T), bright edge on the working point
  const F = J(f, BONE.TOOL_R);
  const hy = 0.655;
  parts.push(
    idp('tool', { name: 'pick.handle', bone: BONE.TOOL_R, shape: { k: 'frustum', r0: 0.023, r1: 0.019, h: 0.75 }, t: add3(F, [0, 0.325, 0]), slot: SLOT.FIXED, color: FIXED_COLORS.wood, minLod: 1, lod1: { seg: 3 } }),
    idp('tool', { name: 'pick.eye', bone: BONE.TOOL_R, shape: { k: 'box', w: 0.055, h: 0.07, d: 0.06 }, t: add3(F, [0, hy, 0]), slot: SLOT.FIXED, color: FIXED_COLORS.iron, minLod: 0, round: 0.4 }),
    idp('tool', {
      name: 'pick.front',
      bone: BONE.TOOL_R,
      shape: { k: 'frustum', r0: 0.03, r1: 0.007, h: 0.155 },
      t: add3(F, [0.1, hy - 0.006, 0]),
      r: [0, 0, -HALF_PI - 0.1],
      slot: SLOT.FIXED,
      color: FIXED_COLORS.iron,
      minLod: 1,
      seg: 4,
      phase: Math.PI / 4,
    }),
    idp('tool', {
      name: 'pick.back',
      bone: BONE.TOOL_R,
      shape: { k: 'frustum', r0: 0.03, r1: 0.007, h: 0.155 },
      t: add3(F, [-0.1, hy - 0.006, 0]),
      r: [0, 0, HALF_PI + 0.1],
      slot: SLOT.FIXED,
      color: FIXED_COLORS.iron,
      minLod: 1,
      seg: 4,
      phase: Math.PI / 4,
    }),
    {
      name: 'pick.edge',
      bone: BONE.TOOL_R,
      shape: { k: 'frustum', r0: 0.0135, r1: 0.004, h: 0.05 },
      t: add3(F, [0.158, hy - 0.013, 0]),
      r: [0, 0, -HALF_PI - 0.1],
      slot: SLOT.FIXED,
      color: FIXED_COLORS.ironEdge,
      minLod: 0,
      seg: 4,
      phase: Math.PI / 4,
    },
    { name: 'pick.wedge', bone: BONE.TOOL_R, shape: { k: 'box', w: 0.02, h: 0.02, d: 0.03 }, t: add3(F, [0, hy + 0.04, 0]), slot: SLOT.FIXED, color: FIXED_COLORS.woodWorn, minLod: 0 },
    { name: 'pick.grip', bone: BONE.TOOL_R, shape: { k: 'frustum', r0: 0.026, r1: 0.026, h: 0.05 }, t: add3(F, [0, -0.025, 0]), slot: SLOT.FIXED, color: FIXED_COLORS.woodWorn, minLod: 0, cap: 1 },
  );
  // tylnik: leather apron worn at the back on the belt (APRON_B)
  const beltR = f.p.bellyR + 0.02;
  const bx = -(beltR * (TORSO_DEPTH + 0.03)) - 0.018;
  const by = f.beltY + 0.03;
  sockets.push([BONE.APRON_B, bx, by, 0]);
  parts.push(
    idp('back', { name: 'tylnik', bone: BONE.APRON_B, shape: { k: 'wedge', w0: 0.3, w1: 0.34, h: 0.34, d: 0.03 }, t: [bx, by, 0], r: [0, 0, -0.14], slot: SLOT.FIXED, color: FIXED_COLORS.leather, minLod: 1, round: 0.5 }),
    {
      name: 'tylnik.hem',
      bone: BONE.APRON_B,
      shape: { k: 'box', w: 0.342, h: 0.028, d: 0.034 },
      t: [bx - 0.336 * Math.sin(0.14), by - 0.33, 0],
      r: [0, 0, -0.14],
      slot: SLOT.FIXED,
      color: FIXED_COLORS.leatherDark,
      minLod: 0,
      round: 0.4,
    },
  );
  sack(f, parts);
  // LOD2 token: helmet, lamp, pick, tylnik (+ sack): 30 triangles
  parts.push(
    tok('headgear', { name: 'tok.helmet', bone: BONE.HEAD, shape: { k: 'dome', r: hr * 1.08, ry: top - base + 0.012 }, t: [hc[0], base - 0.012, 0], slot: SLOT.CLOTH, seg: 5, rings: 1 }),
    tok('lamp', { name: 'tok.lamp', bone: BONE.HEAD, shape: { k: 'frustum', r0: 0, r1: 0.075, h: 0.1 }, t: [flameC[0] + 0.01, flameC[1] - 0.01, 0], slot: SLOT.FIXED, color: FIXED_COLORS.lampFlame, emissive: 2.5, seg: 3 }),
    tok('tool', { name: 'tok.pick.handle', bone: BONE.TOOL_R, shape: { k: 'frustum', r0: 0, r1: 0.065, h: 0.72 }, t: add3(F, [0, 0.325, 0]), slot: SLOT.FIXED, color: FIXED_COLORS.wood, seg: 3 }),
    tok('tool', { name: 'tok.pick.head', bone: BONE.TOOL_R, shape: { k: 'ellipsoid', rx: 0.036, ry: 0.18, rz: 0.03 }, t: add3(F, [0, hy, 0]), r: [0, 0, -HALF_PI], slot: SLOT.FIXED, color: FIXED_COLORS.iron, seg: 3, rings: 2 }),
    tok('back', { name: 'tok.tylnik', bone: BONE.APRON_B, shape: { k: 'frustum', r0: 0.18, r1: 0, h: 0.34 }, t: [bx - 0.02, by - 0.17, 0], r: [0, 0, -0.14], s: [0.14, 1, 1], slot: SLOT.FIXED, color: FIXED_COLORS.leather, seg: 3 }),
  );
  const toolR: ToolInfo = { kind: 'pick', length: 0.75, gripL: 0.32, head: hy, strike: [0.18, hy - 0.025, 0] };
  return {
    parts,
    toolR,
    toolL: null,
    hold: HOLD.TOOL_SHOULDER,
    back: 'apron',
    front: 'none',
    lamp: { bone: BONE.HEAD, offset: flameC, color: lampColor(1), radius: 2 },
    sockets,
  };
}

// ------------------------------------------------------------------------------------------------ cieśla (carpenter)
function carpenter(f: Frame): RoleGear {
  const { k, hx } = f;
  const parts: ModelPart[] = [];
  const sockets: RoleGear['sockets'] = [];
  const hood: V3 = [hx - 0.045 * k, f.hy + 0.03 * k, 0];
  const hrx = 0.178 * k;
  const hry = 0.2 * k;
  parts.push(
    idp('headgear', { name: 'hood', bone: BONE.HEAD, shape: { k: 'ellipsoid', rx: hrx, ry: hry, rz: 0.182 * k }, t: hood, slot: SLOT.CLOTH, minLod: 1, lod1: { seg: 6, rings: 3 } }),
    idp('headgear', {
      name: 'hood.rim',
      bone: BONE.HEAD,
      shape: { k: 'frustum', r0: 0.155 * k, r1: 0.14 * k, h: 0.035 },
      t: [hx + 0.098 * k, f.hy - 0.005, 0],
      r: [0, 0, -HALF_PI],
      s: [1, 1.12, 1],
      slot: SLOT.CLOTH,
      minLod: 0,
      cap: 0,
    }),
    idp('headgear', { name: 'hood.cape', bone: BONE.CHEST, shape: { k: 'frustum', r0: 0.29, r1: 0.15, h: 0.11 }, t: [-0.01, f.shoulderY + 0.035, 0], s: [0.78, 1, 1], slot: SLOT.CLOTH, minLod: 1, lod1: { seg: 6, cap: 0 } }),
  );
  // spike thrown back: two tapering segments beyond the head outline, tassel (accent) at the tip
  const b1: V3 = [hx - 0.15 * k, f.hy + 0.12 * k, 0];
  const a1 = 1.67;
  const d1: [number, number] = [-Math.sin(a1), Math.cos(a1)];
  const l1 = 0.2 * k;
  const b2: V3 = [b1[0] + d1[0] * l1, b1[1] + d1[1] * l1, 0];
  const a2 = 2.36;
  const d2: [number, number] = [-Math.sin(a2), Math.cos(a2)];
  const l2 = 0.17 * k;
  const tip: V3 = [b2[0] + d2[0] * l2, b2[1] + d2[1] * l2, 0];
  parts.push(
    idp('headgear', { name: 'hood.spike1', bone: BONE.HEAD, shape: { k: 'frustum', r0: 0.07 * k, r1: 0.042 * k, h: l1 + 0.02 }, t: [b1[0] + (d1[0] * l1) / 2, b1[1] + (d1[1] * l1) / 2, 0], r: [0, 0, a1], s: [1, 1, 0.9], slot: SLOT.CLOTH, minLod: 1, lod1: { seg: 4, cap: CAP_BOTTOM } }),
    idp('headgear', { name: 'hood.spike2', bone: BONE.HEAD, shape: { k: 'frustum', r0: 0.044 * k, r1: 0.01, h: l2 + 0.015 }, t: [b2[0] + (d2[0] * l2) / 2, b2[1] + (d2[1] * l2) / 2, 0], r: [0, 0, a2], s: [1, 1, 0.9], slot: SLOT.CLOTH, minLod: 1, lod1: { seg: 4, cap: 0 } }),
    { name: 'tassel', bone: BONE.HEAD, shape: { k: 'ellipsoid', rx: 0.042, ry: 0.06, rz: 0.042 }, t: [tip[0] - 0.01, tip[1] - 0.03, 0], slot: SLOT.ACCENT, minLod: 1, lod1: { seg: 3, rings: 2 } },
  );
  // carpenter's broad axe: handle 0.55, wide bearded blade, bright edge
  const F = J(f, BONE.TOOL_R);
  const blade: [number, number][] = [
    [0.03, 0.475],
    [0.1, 0.452],
    [0.163, 0.405],
    [0.186, 0.445],
    [0.196, 0.5],
    [0.19, 0.55],
    [0.174, 0.586],
    [0.11, 0.562],
    [0.03, 0.545],
  ];
  const edge: [number, number][] = [
    [0.158, 0.41],
    [0.17, 0.403],
    [0.193, 0.443],
    [0.205, 0.5],
    [0.198, 0.555],
    [0.18, 0.592],
    [0.168, 0.582],
    [0.183, 0.549],
    [0.188, 0.5],
    [0.179, 0.448],
  ];
  parts.push(
    idp('tool', { name: 'axe.handle', bone: BONE.TOOL_R, shape: { k: 'frustum', r0: 0.021, r1: 0.018, h: 0.59 }, t: add3(F, [0, 0.255, 0]), slot: SLOT.FIXED, color: FIXED_COLORS.wood, minLod: 1, lod1: { seg: 3 } }),
    idp('tool', { name: 'axe.blade', bone: BONE.TOOL_R, shape: { k: 'outline', pts: blade, d: 0.024 }, t: F, slot: SLOT.FIXED, color: FIXED_COLORS.iron, minLod: 1, round: 0.2, lod1: { shape: { k: 'outline', pts: decimate(blade, 5), d: 0.024 } } }),
    idp('tool', { name: 'axe.eye', bone: BONE.TOOL_R, shape: { k: 'box', w: 0.045, h: 0.075, d: 0.05 }, t: add3(F, [0.005, 0.505, 0]), slot: SLOT.FIXED, color: FIXED_COLORS.iron, minLod: 0, round: 0.4 }),
    { name: 'axe.edge', bone: BONE.TOOL_R, shape: { k: 'outline', pts: edge, d: 0.028 }, t: F, slot: SLOT.FIXED, color: FIXED_COLORS.ironEdge, minLod: 0, round: 0.1 },
    { name: 'axe.poll', bone: BONE.TOOL_R, shape: { k: 'box', w: 0.04, h: 0.045, d: 0.04 }, t: add3(F, [-0.035, 0.505, 0]), slot: SLOT.FIXED, color: FIXED_COLORS.iron, minLod: 0 },
  );
  // beam (stempel) on the LEFT shoulder, diagonal, front end up
  const C: V3 = [-0.01, f.shoulderY + 0.1, -0.225];
  const ba = -1.13;
  sockets.push([BONE.BACK, ...C]);
  const ux = -Math.sin(ba);
  const uy = Math.cos(ba);
  parts.push(
    idp('back', { name: 'beam', bone: BONE.BACK, shape: { k: 'box', w: 0.11, h: 1.0, d: 0.11 }, t: C, r: [0, 0, ba], slot: SLOT.FIXED, color: FIXED_COLORS.wood, minLod: 1, round: 0.5 }),
    { name: 'beam.endF', bone: BONE.BACK, shape: { k: 'box', w: 0.104, h: 0.012, d: 0.104 }, t: [C[0] + ux * 0.5, C[1] + uy * 0.5, C[2]], r: [0, 0, ba], slot: SLOT.FIXED, color: FIXED_COLORS.woodWorn, minLod: 0 },
    { name: 'beam.endB', bone: BONE.BACK, shape: { k: 'box', w: 0.104, h: 0.012, d: 0.104 }, t: [C[0] - ux * 0.5, C[1] - uy * 0.5, C[2]], r: [0, 0, ba], slot: SLOT.FIXED, color: FIXED_COLORS.woodWorn, minLod: 0 },
    { name: 'beam.rope', bone: BONE.BACK, shape: { k: 'frustum', r0: 0.082, r1: 0.082, h: 0.03 }, t: [C[0] + ux * 0.3, C[1] + uy * 0.3, C[2]], r: [0, 0, ba], slot: SLOT.FIXED, color: MODEL_COLORS.rope, minLod: 0, cap: 0, seg: 6, phase: Math.PI / 4 },
  );
  const lamp = beltLantern(f, parts, sockets);
  sack(f, parts);
  parts.push(
    tok('headgear', { name: 'tok.hood', bone: BONE.HEAD, shape: { k: 'dome', r: 0.205 * k, ry: 0.26 * k }, t: [hx - 0.03 * k, f.hy - 0.02, 0], slot: SLOT.CLOTH, seg: 4, rings: 1, phase: Math.PI / 4 }),
    tok('headgear', { name: 'tok.spike', bone: BONE.HEAD, shape: { k: 'frustum', r0: 0.065 * k, r1: 0, h: 0.36 * k }, t: [(b1[0] + tip[0]) / 2, (b1[1] + tip[1]) / 2 + 0.02, 0], r: [0, 0, 1.95], slot: SLOT.CLOTH, seg: 3 }),
    tok('tool', { name: 'tok.axe.handle', bone: BONE.TOOL_R, shape: { k: 'frustum', r0: 0, r1: 0.06, h: 0.56 }, t: add3(F, [0, 0.255, 0]), slot: SLOT.FIXED, color: FIXED_COLORS.wood, seg: 3 }),
    tok('tool', { name: 'tok.axe.blade', bone: BONE.TOOL_R, shape: { k: 'frustum', r0: 0, r1: 0.1, h: 0.17 }, t: add3(F, [0.11, 0.5, 0]), r: [0, 0, -HALF_PI], s: [1, 1, 0.25], slot: SLOT.FIXED, color: FIXED_COLORS.iron, seg: 3 }),
    tok('back', { name: 'tok.beam', bone: BONE.BACK, shape: { k: 'frustum', r0: 0.075, r1: 0.075, h: 1.0 }, t: C, r: [0, 0, ba], slot: SLOT.FIXED, color: FIXED_COLORS.wood, seg: 3 }),
  );
  const toolR: ToolInfo = { kind: 'axe', length: 0.59, gripL: 0.22, head: 0.5, strike: [0.2, 0.5, 0] };
  return { parts, toolR, toolL: null, hold: HOLD.BEAM_SHOULDER, back: 'beam', front: 'none', lamp, sockets };
}

// ------------------------------------------------------------------------------------------------ tragarz (porter)
function porter(f: Frame): RoleGear {
  const { k, hx } = f;
  const parts: ModelPart[] = [];
  const sockets: RoleGear['sockets'] = [];
  // bare head: hair + headband, knot with two ends (accent) at the back — the lowest head of the group
  parts.push(
    idp('headgear', { name: 'hair.top', bone: BONE.HEAD, shape: { k: 'dome', r: 0.17 * k, ry: 0.16 * k }, t: [hx - 0.02 * k, f.hy + 0.05 * k, 0], s: [1, 1, 1.02], slot: SLOT.BEARD, minLod: 1, lod1: { seg: 6, rings: 2 } }),
    idp('headgear', { name: 'hair.back', bone: BONE.HEAD, shape: { k: 'ellipsoid', rx: 0.12 * k, ry: 0.13 * k, rz: 0.15 * k }, t: [hx - 0.085 * k, f.hy - 0.03 * k, 0], slot: SLOT.BEARD, minLod: 0 }),
    idp('headgear', {
      name: 'band',
      bone: BONE.HEAD,
      shape: { k: 'frustum', r0: 0.172 * k, r1: 0.17 * k, h: 0.042 * k },
      t: [hx - 0.012 * k, f.hy + 0.065 * k, 0],
      r: [0, 0, -0.12],
      s: [1, 1, 1.02],
      slot: SLOT.CLOTH,
      minLod: 1,
      cap: 0,
      lod1: { seg: 6 },
    }),
    { name: 'knot', bone: BONE.HEAD, shape: { k: 'ellipsoid', rx: 0.04, ry: 0.036, rz: 0.042 }, t: [hx - 0.15 * k, f.hy + 0.08 * k, 0.1 * k], slot: SLOT.ACCENT, minLod: 1, lod1: { seg: 4, rings: 2 } },
  );
  for (const [i, z] of [0.08, 0.125].entries()) {
    parts.push({ name: `knot.end${i}`, bone: BONE.HEAD, shape: { k: 'capsule', r: 0.015, len: 0.12 }, t: [hx - 0.18 * k, f.hy + 0.02 * k, z * k], r: [0, 0, 0.45 + i * 0.3], slot: SLOT.ACCENT, minLod: i === 0 ? 1 : 0, lod1: { shape: { k: 'frustum', r0: 0, r1: 0.02, h: 0.12 }, seg: 3 } });
  }
  // pack frame (nosidło) 0.5 × 0.7 reaching above the shoulders, basket, straps
  const fx = -0.275;
  const fy = f.shoulderY - 0.13; // frame centre: 0.74 tall, its top 0.24 above the shoulders
  sockets.push([BONE.BACK, fx - 0.03, fy, 0]);
  const tilt = 0.07;
  for (const [i, z] of [0.2, -0.2].entries()) {
    parts.push(idp('back', { name: `frame.rail${i}`, bone: BONE.BACK, shape: { k: 'box', w: 0.04, h: 0.74, d: 0.045 }, t: [fx, fy, z], r: [0, 0, tilt], slot: SLOT.FIXED, color: FIXED_COLORS.wood, minLod: 1, round: 0.5 }));
  }
  for (const [i, dy] of [-0.29, 0.03, 0.33].entries()) {
    parts.push({
      ...(i === 2 ? { identity: true, ident: 'back' as const } : {}),
      name: `frame.bar${i}`,
      bone: BONE.BACK,
      shape: { k: 'box', w: 0.44, h: 0.035, d: 0.035 },
      t: [fx - Math.sin(tilt) * dy, fy + dy, 0],
      r: [0, 0, tilt],
      slot: SLOT.FIXED,
      color: FIXED_COLORS.woodWorn,
      minLod: i === 2 ? 1 : 0,
      round: 0.5,
    });
  }
  const bk: V3 = [-0.44, fy - 0.03, 0];
  parts.push(
    idp('back', {
      name: 'basket',
      bone: BONE.BACK,
      shape: {
        k: 'lathe',
        profile: [
          [0.13, -0.17],
          [0.17, 0.08],
          [0.19, 0.18],
        ],
      },
      t: bk,
      s: [0.78, 1, 1.05],
      slot: SLOT.FIXED,
      color: FIXED_COLORS.basket,
      minLod: 1,
      cap: 1,
      lod1: { shape: { k: 'frustum', r0: 0.13, r1: 0.19, h: 0.35 }, t: [bk[0], bk[1] + 0.005, 0], seg: 6 },
    }),
    { name: 'basket.rim', bone: BONE.BACK, shape: { k: 'frustum', r0: 0.196, r1: 0.196, h: 0.03 }, t: [bk[0], bk[1] + 0.175, 0], s: [0.78, 1, 1.05], slot: SLOT.FIXED, color: FIXED_COLORS.wood, minLod: 0, cap: 0 },
    { name: 'basket.weave0', bone: BONE.BACK, shape: { k: 'frustum', r0: 0.163, r1: 0.168, h: 0.022 }, t: [bk[0], bk[1] + 0.02, 0], s: [0.78, 1, 1.05], slot: SLOT.FIXED, color: MODEL_COLORS.rope, minLod: 0, cap: 0 },
    { name: 'basket.weave1', bone: BONE.BACK, shape: { k: 'frustum', r0: 0.146, r1: 0.151, h: 0.022 }, t: [bk[0], bk[1] - 0.09, 0], s: [0.78, 1, 1.05], slot: SLOT.FIXED, color: MODEL_COLORS.rope, minLod: 0, cap: 0 },
  );
  for (const [i, z] of [0.165, -0.165].entries()) {
    parts.push(
      idp('back', { name: `strap.top${i}`, bone: BONE.CHEST, shape: { k: 'box', w: 0.05, h: 0.03, d: 0.42 }, t: [-0.05, f.shoulderY + 0.07, z], r: [0, 0, -0.1], slot: SLOT.FIXED, color: FIXED_COLORS.leather, minLod: 0 }),
      { name: `strap.front${i}`, bone: BONE.CHEST, shape: { k: 'box', w: 0.05, h: 0.24, d: 0.03 }, t: [0.205, f.shoulderY - 0.1, z], r: [0, 0, 0.12], slot: SLOT.FIXED, color: FIXED_COLORS.leather, minLod: 0 },
    );
  }
  // load: spoil in the basket on LOAD (hidden with scale 0 when nothing is carried)
  const L: V3 = [bk[0], bk[1] + 0.16, 0];
  sockets.push([BONE.LOAD, ...L]);
  parts.push(
    idp('load', { name: 'ore0', bone: BONE.LOAD, shape: { k: 'ellipsoid', rx: 0.1, ry: 0.075, rz: 0.09 }, t: [L[0] - 0.02, L[1] + 0.02, -0.05], r: [0.3, 0.4, 0.2], slot: SLOT.FIXED, color: FIXED_COLORS.ore, minLod: 1, seg: 6, rings: 3, lod1: { seg: 4, rings: 2 } }),
    { name: 'ore1', bone: BONE.LOAD, shape: { k: 'ellipsoid', rx: 0.075, ry: 0.06, rz: 0.07 }, t: [L[0] + 0.05, L[1] + 0.035, 0.06], r: [0.5, 0.1, -0.3], slot: SLOT.FIXED, color: FIXED_COLORS.ore, minLod: 0, seg: 6, rings: 3 },
    { name: 'ore2', bone: BONE.LOAD, shape: { k: 'ellipsoid', rx: 0.07, ry: 0.055, rz: 0.065 }, t: [L[0] - 0.07, L[1] + 0.01, 0.08], r: [-0.2, 0.6, 0.4], slot: SLOT.FIXED, color: FIXED_COLORS.ore, minLod: 0, seg: 6, rings: 3 },
  );
  const lamp = beltLantern(f, parts, sockets);
  parts.push(
    tok('headgear', { name: 'tok.hair', bone: BONE.HEAD, shape: { k: 'dome', r: 0.19 * k, ry: 0.2 * k }, t: [hx - 0.02 * k, f.hy + 0.01, 0], slot: SLOT.BEARD, seg: 5, rings: 1 }),
    tok('back', { name: 'tok.frame', bone: BONE.BACK, shape: { k: 'frustum', r0: 0.21, r1: 0.21, h: 0.74 }, t: [fx, fy, 0], r: [0, 0, tilt], s: [0.25, 1, 1], slot: SLOT.FIXED, color: FIXED_COLORS.wood, seg: 3 }),
    tok('back', { name: 'tok.basket', bone: BONE.BACK, shape: { k: 'frustum', r0: 0.15, r1: 0.2, h: 0.36 }, t: bk, s: [0.8, 1, 1], slot: SLOT.FIXED, color: FIXED_COLORS.basket, seg: 3 }),
    tok('load', { name: 'tok.ore', bone: BONE.LOAD, shape: { k: 'frustum', r0: 0.11, r1: 0, h: 0.13 }, t: [L[0], L[1] + 0.04, 0], slot: SLOT.FIXED, color: FIXED_COLORS.ore, seg: 3 }),
  );
  return { parts, toolR: null, toolL: null, hold: HOLD.FRAME_STRAPS, back: 'frame', front: 'none', lamp, sockets };
}

// ------------------------------------------------------------------------------------------------ kowal (smith)
function smith(f: Frame): RoleGear {
  const { k, hx } = f;
  const parts: ModelPart[] = [];
  const sockets: RoleGear['sockets'] = [];
  const base = f.hy + 0.06 * k;
  const top = f.crownY + f.p.hatH - 0.01;
  const cr = 0.174 * k;
  const cc: V3 = [hx - 0.012, base, 0];
  parts.push(
    idp('headgear', { name: 'cap', bone: BONE.HEAD, shape: { k: 'dome', r: cr, ry: top - base }, t: cc, s: [1.02, 1, 1.04], slot: SLOT.CLOTH, minLod: 1, lod1: { seg: 6, rings: 2 } }),
    idp('headgear', {
      name: 'cap.band',
      bone: BONE.HEAD,
      shape: { k: 'frustum', r0: cr + 0.005, r1: cr + 0.004, h: 0.03 * k },
      t: [cc[0], base + 0.012, 0],
      s: [1.02, 1, 1.04],
      slot: SLOT.FIXED,
      color: FIXED_COLORS.leatherDark,
      minLod: 0,
      cap: 0,
    }),
    idp('headgear', { name: 'cap.flap', bone: BONE.HEAD, shape: { k: 'wedge', w0: 0.3 * k, w1: 0.34 * k, h: 0.17, d: 0.03 }, t: [hx - 0.165 * k, base + 0.02, 0], r: [0, 0, -0.2], slot: SLOT.CLOTH, minLod: 1, round: 0.6 }),
  );
  for (const [i, s] of [1, -1].entries()) {
    const g: V3 = [hx + 0.162 * k, base + 0.03 * k, s * 0.056 * k];
    parts.push(
      idp('headgear', { name: `goggle${i}`, bone: BONE.HEAD, shape: { k: 'frustum', r0: 0.036 * k, r1: 0.033 * k, h: 0.028 }, t: g, r: [0, 0, -HALF_PI + 0.25], slot: SLOT.FIXED, color: FIXED_COLORS.mica, minLod: i === 0 ? 1 : 0, seg: 8, lod1: { seg: 4 } }),
      { name: `goggle.rim${i}`, bone: BONE.HEAD, shape: { k: 'frustum', r0: 0.042 * k, r1: 0.04 * k, h: 0.02 }, t: [g[0] - 0.004, g[1], g[2]], r: [0, 0, -HALF_PI + 0.25], slot: SLOT.FIXED, color: FIXED_COLORS.iron, minLod: 0, cap: 0, seg: 8 },
    );
  }
  parts.push(
    { name: 'goggle.bridge', bone: BONE.HEAD, shape: { k: 'box', w: 0.04 * k, h: 0.014, d: 0.016 }, t: [hx + 0.168 * k, base + 0.03 * k, 0], slot: SLOT.FIXED, color: FIXED_COLORS.iron, minLod: 0 },
    { name: 'feather', bone: BONE.HEAD, shape: { k: 'ellipsoid', rx: 0.052, ry: 0.014, rz: 0.009 }, t: [hx - 0.17 * k, base + 0.1 * k, 0.14 * k], r: [-0.15, 0, -0.38], slot: SLOT.ACCENT, minLod: 1, lod1: { seg: 3, rings: 2 } },
  );
  // hammer (right) and tongs (left)
  const F = J(f, BONE.TOOL_R);
  const FL = J(f, BONE.TOOL_L);
  parts.push(
    idp('tool', { name: 'hammer.handle', bone: BONE.TOOL_R, shape: { k: 'frustum', r0: 0.021, r1: 0.018, h: 0.44 }, t: add3(F, [0, 0.18, 0]), slot: SLOT.FIXED, color: FIXED_COLORS.wood, minLod: 1, lod1: { seg: 3 } }),
    idp('tool', { name: 'hammer.head', bone: BONE.TOOL_R, shape: { k: 'box', w: 0.12, h: 0.12, d: 0.2 }, t: add3(F, [0, 0.37, 0]), slot: SLOT.FIXED, color: FIXED_COLORS.iron, minLod: 1, round: 0.4 }),
    { name: 'hammer.face', bone: BONE.TOOL_R, shape: { k: 'box', w: 0.124, h: 0.124, d: 0.022 }, t: add3(F, [0.104, 0.37, 0]), slot: SLOT.FIXED, color: FIXED_COLORS.ironEdge, minLod: 0, round: 0.3 },
    { name: 'hammer.wedge', bone: BONE.TOOL_R, shape: { k: 'box', w: 0.02, h: 0.018, d: 0.03 }, t: add3(F, [0, 0.435, 0]), slot: SLOT.FIXED, color: FIXED_COLORS.woodWorn, minLod: 0 },
  );
  for (const [i, s] of [1, -1].entries()) {
    parts.push(
      idp('tool', { name: `tongs.arm${i}`, bone: BONE.TOOL_L, shape: { k: 'box', w: 0.02, h: 0.46, d: 0.026 }, t: add3(FL, [s * 0.014, 0.18, 0]), r: [0, 0, -s * 0.03], slot: SLOT.FIXED, color: FIXED_COLORS.iron, minLod: i === 0 ? 1 : 0 }),
      idp('tool', { name: `tongs.jaw${i}`, bone: BONE.TOOL_L, shape: { k: 'box', w: 0.024, h: 0.085, d: 0.03 }, t: add3(FL, [s * 0.026, 0.445, 0]), r: [0, 0, s * 0.3], slot: SLOT.FIXED, color: FIXED_COLORS.iron, minLod: i === 0 ? 1 : 0 }),
    );
  }
  parts.push({ name: 'tongs.bar', bone: BONE.TOOL_L, shape: { k: 'box', w: 0.04, h: 0.04, d: 0.16 }, t: add3(FL, [0.03, 0.49, 0]), r: [0, 0, 0.1], slot: SLOT.FIXED, color: FIXED_COLORS.iron, minLod: 0 });
  parts.push({ name: 'tongs.pivot', bone: BONE.TOOL_L, shape: { k: 'ellipsoid', rx: 0.02, ry: 0.02, rz: 0.02 }, t: add3(FL, [0, 0.39, 0]), slot: SLOT.FIXED, color: FIXED_COLORS.ironEdge, minLod: 0, seg: 6, rings: 3 });
  // long leather apron at the front down to the knees: bib on the torso, skirt on APRON_F
  const beltR = f.p.bellyR + 0.02;
  const ax = beltR * (TORSO_DEPTH + 0.03) + 0.012;
  const ay = f.beltY + 0.005;
  sockets.push([BONE.APRON_F, ax, ay, 0]);
  const bibTop = f.shoulderY - 0.065;
  parts.push(
    idp('apron', { name: 'apron.bib', bone: BONE.SPINE, shape: { k: 'wedge', w0: 0.24, w1: 0.32, h: bibTop - ay + 0.02, d: 0.022 }, t: [p2x(f, bibTop), bibTop, 0], r: [0, 0, -0.07], slot: SLOT.FIXED, color: FIXED_COLORS.leather, minLod: 0, round: 0.4 }),
    idp('apron', { name: 'apron.skirt', bone: BONE.APRON_F, shape: { k: 'wedge', w0: 0.34, w1: 0.4, h: ay - f.hipY * 0.55, d: 0.022 }, t: [ax, ay, 0], r: [0, 0, 0.05], slot: SLOT.FIXED, color: FIXED_COLORS.leather, minLod: 1, round: 0.4 }),
    { name: 'apron.pocket', bone: BONE.APRON_F, shape: { k: 'box', w: 0.11, h: 0.075, d: 0.012 }, t: [ax + 0.018, ay - 0.12, 0.06], r: [0, 0, 0.05], slot: SLOT.FIXED, color: FIXED_COLORS.leatherDark, minLod: 0 },
    { name: 'apron.hem', bone: BONE.APRON_F, shape: { k: 'box', w: 0.402, h: 0.024, d: 0.026 }, t: [ax + 0.05 * (ay - f.hipY * 0.55), f.hipY * 0.55 + 0.012, 0], r: [0, 0, 0.05], slot: SLOT.FIXED, color: FIXED_COLORS.leatherDark, minLod: 0 },
  );
  const lamp = beltLantern(f, parts, sockets);
  sack(f, parts);
  parts.push(
    tok('headgear', { name: 'tok.cap', bone: BONE.HEAD, shape: { k: 'dome', r: 0.19 * k, ry: top - base + 0.03 }, t: [hx - 0.03, base - 0.03, 0], s: [1.1, 1, 1], slot: SLOT.CLOTH, seg: 5, rings: 1 }),
    tok('tool', { name: 'tok.hammer.handle', bone: BONE.TOOL_R, shape: { k: 'frustum', r0: 0, r1: 0.06, h: 0.42 }, t: add3(F, [0, 0.18, 0]), slot: SLOT.FIXED, color: FIXED_COLORS.wood, seg: 3 }),
    tok('tool', { name: 'tok.hammer.head', bone: BONE.TOOL_R, shape: { k: 'ellipsoid', rx: 0.075, ry: 0.12, rz: 0.07 }, t: add3(F, [0, 0.37, 0]), r: [0, 0, -HALF_PI], slot: SLOT.FIXED, color: FIXED_COLORS.iron, seg: 3, rings: 2 }),
    tok('tool', { name: 'tok.tongs', bone: BONE.TOOL_L, shape: { k: 'frustum', r0: 0.04, r1: 0, h: 0.48 }, t: add3(FL, [0, 0.22, 0]), slot: SLOT.FIXED, color: FIXED_COLORS.iron, seg: 3 }),
    tok('apron', { name: 'tok.apron', bone: BONE.APRON_F, shape: { k: 'frustum', r0: 0.22, r1: 0, h: 0.5 }, t: [ax + 0.005, ay - 0.13, 0], s: [0.12, 1, 1], slot: SLOT.FIXED, color: FIXED_COLORS.leather, seg: 3 }),
  );
  const toolR: ToolInfo = { kind: 'hammer', length: 0.44, gripL: 0, head: 0.37, strike: [0.115, 0.37, 0] };
  const toolL: ToolInfo = { kind: 'tongs', length: 0.48, gripL: 0, head: 0.445, strike: [0.03, 0.49, 0] };
  return { parts, toolR, toolL, hold: HOLD.TWO_TOOLS, back: 'none', front: 'apron', lamp, sockets };
}

/** Front of the elliptic barrel torso at height y (for parts lying on the chest). */
function p2x(f: Frame, y: number): number {
  const p = f.p;
  const t = Math.max(0, Math.min(1, (y - f.beltY) / Math.max(0.01, f.shoulderY - 0.09 - f.beltY)));
  return (p.bellyR + (p.chestR - p.bellyR) * t) * TORSO_DEPTH + 0.012;
}

export function roleGear(f: Frame): RoleGear {
  switch (f.role) {
    case ROLE.MINER:
      return miner(f);
    case ROLE.CARPENTER:
      return carpenter(f);
    case ROLE.PORTER:
      return porter(f);
    default:
      return smith(f);
  }
}
