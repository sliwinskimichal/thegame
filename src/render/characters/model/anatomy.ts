/**
 * Dwarf anatomy as parts (owner: W1) — concept card docs/art/concepts/dwarf.md §2, brief §2.
 * One list of parts for every technique: body joints come from referenceJoints(proportions) exactly;
 * geometry is authored around them in REST MODEL SPACE (model units, contract v2).
 *
 * LOD policy: detailed parts draw at LOD0–1 (minLod 1), small details only at LOD0 (minLod 0, "Izba
 * without saving": ears, cuffs, collar, pouch, beard locks, thumbs, soles, patches), and LOD2 uses a
 * token of a few convex bodies (fromLod 2) with exact segment counts (<= 60 triangles per dwarf).
 */
import { BONE } from '../../anim/types';
import { FIXED_COLORS } from '../direction';
import { SLOT, type DwarfSpec, type Proportions, type RoleId } from '../types';
import { CAP_BOTTOM, type ModelPart } from './part';

/** Extra fixed colours of the model (muted, C* < 26: they must not compete with the social accent). */
export const MODEL_COLORS = {
  brass: 0x8c7650,
  sole: 0x2a1e16,
  burlap: 0x7a6a4e,
  rope: 0x8a7a5a,
} as const;

/** Torso depth (X) relative to its width (Z): a dwarf's chest is wider than deep, the beard sits in front of it. */
export const TORSO_DEPTH = 0.74;

export interface Frame {
  spec: DwarfSpec;
  p: Proportions;
  role: RoleId;
  /** Rest joints (BONE_COUNT * 3); body joints = referenceJoints, sockets may be moved by the gear. */
  j: Float32Array;
  /** Head scale relative to the card head (0.36). */
  k: number;
  /** Head ellipsoid centre and radii. */
  hx: number;
  hy: number;
  hrx: number;
  hry: number;
  hrz: number;
  chinY: number;
  crownY: number;
  shoulderY: number;
  beltY: number;
  hipY: number;
}

export const J = (f: Frame, b: number): [number, number, number] => [f.j[b * 3]!, f.j[b * 3 + 1]!, f.j[b * 3 + 2]!];

export function makeFrame(spec: DwarfSpec, joints: Float32Array): Frame {
  const p = spec.proportions;
  const k = p.headH / 0.36;
  const chinY = joints[BONE.HEAD * 3 + 1]!;
  const crownY = chinY + p.headH;
  return {
    spec,
    p,
    role: spec.role,
    j: joints,
    k,
    hx: joints[BONE.HEAD * 3]! + 0.04 * k,
    hy: chinY + p.headH / 2,
    hrx: 0.43 * p.headH,
    hry: 0.5 * p.headH,
    hrz: 0.445 * p.headH,
    chinY,
    crownY,
    shoulderY: joints[BONE.ARM_R * 3 + 1]!,
    beltY: joints[BONE.SPINE * 3 + 1]!,
    hipY: joints[BONE.PELVIS * 3 + 1]!,
  };
}

const DEG = Math.PI / 180;

/** Midpoint and distance of two joints. */
function span(f: Frame, a: number, b: number): { m: [number, number, number]; len: number } {
  const A = J(f, a);
  const B = J(f, b);
  return {
    m: [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2],
    len: Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]),
  };
}

/** Beard geometry shared with the token (front-of-face anchor and tilt). */
export function beardFrame(f: Frame) {
  const p = f.p;
  const tilt = 8 * DEG;
  const faceX = f.hx + f.hrx;
  const topY = f.chinY + 0.06 * f.k;
  const topX = faceX - 0.06;
  const midY = f.chinY - p.beardLen * 0.5;
  const botY = f.chinY - p.beardLen;
  const xAt = (y: number) => topX + (topY - y) * Math.tan(tilt);
  return { tilt, faceX, topY, topX, midY, botY, xAt };
}

export function bodyParts(f: Frame): ModelPart[] {
  const { p, k, spec } = f;
  const out: ModelPart[] = [];
  const add = (q: ModelPart) => out.push(q);
  const shape = spec.beardShape;
  const smith = f.role === 3;

  // ---------------------------------------------------------------- head and face
  add({ name: 'head', bone: BONE.HEAD, shape: { k: 'ellipsoid', rx: f.hrx, ry: f.hry, rz: f.hrz }, t: [f.hx, f.hy, 0], slot: SLOT.SKIN, minLod: 1, skin: true, lod1: { seg: 6, rings: 3 } });
  const noseS = 1 + (shape - 0.5) * 0.12;
  add({
    name: 'nose',
    bone: BONE.HEAD,
    shape: { k: 'ellipsoid', rx: 0.052 * k * noseS, ry: 0.06 * k * noseS, rz: 0.048 * k * noseS },
    t: [f.hx + f.hrx * 0.94, f.chinY + 0.42 * p.headH, 0],
    r: [0, 0, -0.25],
    slot: SLOT.SKIN,
    minLod: 1,
    lod1: { seg: 4, rings: 2 },
  });
  add({
    name: 'brow',
    bone: BONE.HEAD,
    shape: { k: 'box', w: 0.21 * k, h: 0.045 * k, d: 0.07 * k },
    t: [f.hx + f.hrx * 0.8, f.chinY + 0.6 * p.headH, 0],
    r: [0, 0, -0.14],
    slot: SLOT.BEARD,
    minLod: 1,
    round: 0.6,
  });
  for (const s of [1, -1]) {
    const side = s > 0 ? 'R' : 'L';
    add({
      name: `eye.${side}`,
      bone: BONE.HEAD,
      shape: { k: 'ellipsoid', rx: 0.016 * k, ry: 0.022 * k, rz: 0.016 * k },
      t: [f.hx + f.hrx * 0.86, f.chinY + 0.5 * p.headH, s * 0.06 * k],
      slot: SLOT.FIXED,
      color: FIXED_COLORS.ink,
      minLod: 0,
      seg: 6,
      rings: 3,
    });
    add({
      name: `ear.${side}`,
      bone: BONE.HEAD,
      shape: { k: 'ellipsoid', rx: 0.034 * k, ry: 0.055 * k, rz: 0.022 * k },
      t: [f.hx - 0.02 * k, f.chinY + 0.44 * p.headH, s * (f.hrz + 0.004)],
      slot: SLOT.SKIN,
      minLod: 0,
    });
    add({
      name: `mous.${side}`,
      bone: BONE.HEAD,
      shape: { k: 'ellipsoid', rx: 0.05 * k, ry: 0.03 * k, rz: 0.075 * k },
      t: [f.hx + f.hrx * 0.9, f.chinY + 0.31 * p.headH, s * 0.045 * k],
      r: [s * -0.35, 0, -0.1],
      slot: SLOT.BEARD,
      minLod: 0,
    });
  }
  add({
    name: 'hair.nape',
    bone: BONE.HEAD,
    shape: { k: 'ellipsoid', rx: 0.1 * k, ry: 0.1 * k, rz: 0.14 * k },
    t: [f.hx - 0.09 * k, f.chinY + 0.24 * p.headH, 0],
    slot: SLOT.BEARD,
    minLod: 0,
    seg: 10,
    rings: 5,
  });

  // ---------------------------------------------------------------- beard: jaw mass, wedge (2 bones), locks, braids
  const bf = beardFrame(f);
  add({
    name: 'beard.jaw',
    bone: BONE.BEARD,
    shape: { k: 'ellipsoid', rx: 0.12 * k, ry: 0.085 * k, rz: 0.15 * k },
    t: [f.hx + 0.045 * k, f.chinY + 0.055 * k, 0],
    slot: SLOT.BEARD,
    minLod: 1,
    skin: true,
    seg: 12,
    rings: 6,
    lod1: { seg: 5, rings: 2 },
  });
  const wMid = (0.26 + p.beardW) / 2;
  add({
    name: 'beard.top',
    bone: BONE.BEARD,
    shape: { k: 'wedge', w0: 0.26 * k, w1: wMid, h: bf.topY - bf.midY, d: 0.12 },
    t: [bf.topX, bf.topY, 0],
    r: [0, 0, bf.tilt],
    slot: SLOT.BEARD,
    minLod: 1,
    skin: true,
    round: 0.8,
  });
  const wBot = p.beardW * (0.82 + 0.3 * shape);
  add({
    name: 'beard.bot',
    bone: BONE.BEARD2,
    shape: { k: 'wedge', w0: wMid, w1: wBot, h: bf.midY - bf.botY + 0.02, d: 0.095 },
    t: [bf.xAt(bf.midY) + 0.004, bf.midY + 0.02, 0],
    r: [0, 0, bf.tilt + 3 * DEG],
    slot: SLOT.BEARD,
    minLod: 1,
    skin: true,
    round: 0.8,
  });
  // locks break the straight cut (pointed centre for high beardShape)
  for (const [i, z] of [-1, 0, 1].entries()) {
    const zz = (z * wBot) / 3;
    const ly = 0.045 + (z === 0 ? 0.02 * shape : 0);
    add({
      name: `beard.lock${i}`,
      bone: BONE.BEARD2,
      shape: { k: 'ellipsoid', rx: 0.05, ry: ly, rz: wBot / 6 + 0.012 },
      t: [bf.xAt(bf.botY) + 0.012, bf.botY - 0.005, zz],
      slot: SLOT.BEARD,
      minLod: 0,
    });
  }
  const braidZ = spec.braids <= 1 ? [0] : [-0.075, 0.075];
  braidZ.forEach((z, i) => {
    const x = bf.xAt(bf.botY) + 0.04;
    add({
      name: `braid${i}`,
      bone: BONE.BEARD2,
      shape: { k: 'capsule', r: 0.018, len: 0.16 },
      t: [x, bf.botY - 0.045, z * k],
      r: [0, 0, 0.12],
      slot: SLOT.BEARD,
      minLod: 1,
      lod1: { shape: { k: 'frustum', r0: 0, r1: 0.022, h: 0.16 }, seg: 3 },
    });
    add({
      name: `bead${i}`,
      bone: BONE.BEARD2,
      shape: { k: 'ellipsoid', rx: 0.022, ry: 0.026, rz: 0.022 },
      t: [x - 0.012, bf.botY - 0.13, z * k],
      slot: SLOT.FIXED,
      color: MODEL_COLORS.brass,
      minLod: 0,
    });
  });

  // ---------------------------------------------------------------- torso
  const sY = f.shoulderY;
  const bY = f.beltY;
  add({
    name: 'shoulders',
    bone: BONE.CHEST,
    shape: { k: 'ellipsoid', rx: 0.17, ry: 0.105, rz: p.shoulderW / 2 },
    t: [-0.01, sY - 0.025, 0],
    slot: SLOT.TUNIC,
    minLod: 1,
    skin: true,
    seg: 14,
    rings: 6,
    lod1: { seg: 6, rings: 3 },
  });
  add({
    name: 'torso',
    bone: BONE.SPINE,
    shape: {
      k: 'lathe',
      profile: [
        [p.bellyR, bY - 0.03],
        [p.bellyR + 0.012, bY + 0.07],
        [(p.bellyR + p.chestR) / 2 + 0.012, bY + 0.17],
        [p.chestR, sY - 0.09],
        [p.chestR - 0.025, sY - 0.035],
        [p.chestR - 0.08, sY + 0.01],
        [0.13, sY + 0.03],
      ],
    },
    t: [0, 0, 0],
    s: [TORSO_DEPTH, 1, 1],
    slot: SLOT.TUNIC,
    minLod: 1,
    skin: true,
    lod1: { cap: 0, seg: 6 },
  });
  add({
    name: 'collar',
    bone: BONE.CHEST,
    shape: { k: 'frustum', r0: 0.16, r1: 0.125, h: 0.05 },
    t: [0, sY + 0.03, 0],
    s: [0.85, 1, 1],
    slot: SLOT.TUNIC2,
    minLod: 0,
  });
  const hY = f.hipY;
  add({
    name: 'skirt',
    bone: BONE.PELVIS,
    shape: {
      k: 'lathe',
      profile: [
        [p.bellyR + 0.045, hY - 0.005],
        [p.bellyR + 0.026, hY + 0.07],
        [p.bellyR + 0.004, bY - 0.01],
      ],
    },
    t: [0, 0, 0],
    s: [TORSO_DEPTH + 0.05, 1, 1],
    slot: SLOT.TUNIC,
    minLod: 1,
    skin: true,
    lod1: {
      shape: { k: 'frustum', r0: p.bellyR + 0.045, r1: p.bellyR + 0.004, h: bY - hY - 0.005 },
      t: [0, (bY + hY - 0.015) / 2, 0],
      seg: 6,
      cap: CAP_BOTTOM,
    },
  });
  add({
    name: 'hem',
    bone: BONE.PELVIS,
    shape: { k: 'frustum', r0: p.bellyR + 0.05, r1: p.bellyR + 0.043, h: 0.028 },
    t: [0, hY + 0.009, 0],
    s: [TORSO_DEPTH + 0.05, 1, 1],
    slot: SLOT.TUNIC2,
    minLod: 0,
    cap: CAP_BOTTOM,
  });
  const beltR = p.bellyR + 0.02;
  const beltSx = TORSO_DEPTH + 0.03;
  add({
    name: 'belt',
    bone: BONE.PELVIS,
    shape: { k: 'frustum', r0: beltR, r1: beltR, h: 0.06 },
    t: [0, bY, 0],
    s: [beltSx, 1, 1],
    slot: SLOT.FIXED,
    color: FIXED_COLORS.leather,
    minLod: 1,
    cap: 0,
    lod1: { seg: 6 },
  });
  add({
    name: 'buckle',
    bone: BONE.PELVIS,
    shape: { k: 'box', w: 0.075, h: 0.068, d: 0.025 },
    t: [beltR * beltSx + 0.008, bY, 0],
    slot: SLOT.FIXED,
    color: MODEL_COLORS.brass,
    minLod: 0,
    round: 0.3,
  });
  add({
    name: 'pouch',
    bone: BONE.PELVIS,
    shape: { k: 'box', w: 0.06, h: 0.09, d: 0.085 },
    t: [-0.075, bY - 0.07, beltR * 0.96],
    slot: SLOT.FIXED,
    color: FIXED_COLORS.leatherDark,
    minLod: 0,
    round: 0.6,
  });
  add({
    name: 'pouch.flap',
    bone: BONE.PELVIS,
    shape: { k: 'box', w: 0.066, h: 0.035, d: 0.09 },
    t: [-0.075, bY - 0.035, beltR * 0.96 + 0.004],
    slot: SLOT.FIXED,
    color: FIXED_COLORS.leather,
    minLod: 0,
    round: 0.4,
  });

  // ---------------------------------------------------------------- arms
  const arms = [
    [BONE.ARM_R, BONE.FORE_R, BONE.HAND_R, BONE.TOOL_R, 1, 'R'],
    [BONE.ARM_L, BONE.FORE_L, BONE.HAND_L, BONE.TOOL_L, -1, 'L'],
  ] as const;
  for (const [arm, fore, hand, tool, s, side] of arms) {
    const up = span(f, arm, fore);
    add({ name: `arm.${side}`, bone: arm, shape: { k: 'capsule', r: 0.068, len: up.len + 0.1 }, t: up.m, slot: smith ? SLOT.TUNIC2 : SLOT.TUNIC, minLod: 1, skin: true, lod1: { shape: { k: 'frustum', r0: 0.066, r1: 0.068, h: up.len + 0.04 }, seg: 4, cap: 0, phase: Math.PI / 4 } });
    const lo = span(f, fore, hand);
    add({ name: `fore.${side}`, bone: fore, shape: { k: 'capsule', r: 0.061, len: lo.len + 0.075 }, t: lo.m, slot: SLOT.TUNIC2, minLod: 1, skin: true, lod1: { shape: { k: 'frustum', r0: 0.058, r1: 0.062, h: lo.len + 0.05 }, seg: 4, cap: 0, phase: Math.PI / 4 } });
    const W = J(f, hand);
    add({
      name: `cuff.${side}`,
      bone: fore,
      shape: { k: 'frustum', r0: 0.067, r1: 0.07, h: 0.045 },
      t: [W[0], W[1] + 0.03, W[2]],
      slot: smith ? SLOT.FIXED : SLOT.TUNIC,
      color: smith ? FIXED_COLORS.leatherDark : undefined,
      minLod: 0,
      cap: 0,
    });
    const F = J(f, tool);
    const hs = p.handS;
    add({
      name: `hand.${side}`,
      bone: hand,
      shape: { k: 'ellipsoid', rx: 0.46 * hs, ry: 0.53 * hs, rz: 0.45 * hs },
      t: [F[0], F[1], F[2]],
      slot: SLOT.SKIN,
      minLod: 1,
      skin: true,
      lod1: { seg: 5, rings: 2 },
    });
    add({
      name: `thumb.${side}`,
      bone: hand,
      shape: { k: 'ellipsoid', rx: 0.2 * hs, ry: 0.24 * hs, rz: 0.18 * hs },
      t: [F[0] + 0.36 * hs, F[1] + 0.22 * hs, F[2] - s * 0.24 * hs],
      r: [0, 0, -0.5],
      slot: SLOT.SKIN,
      minLod: 0,
    });
  }

  // ---------------------------------------------------------------- legs and boots
  const legs = [
    [BONE.THIGH_R, BONE.SHIN_R, BONE.FOOT_R, 1, 'R'],
    [BONE.THIGH_L, BONE.SHIN_L, BONE.FOOT_L, -1, 'L'],
  ] as const;
  for (const [th, sh, ft, , side] of legs) {
    const a = span(f, th, sh);
    add({ name: `thigh.${side}`, bone: th, shape: { k: 'frustum', r0: 0.07, r1: 0.084, h: a.len + 0.06 }, t: a.m, slot: SLOT.TUNIC2, minLod: 1, skin: true, lod1: { seg: 4, cap: 0, phase: Math.PI / 4 } });
    const b = span(f, sh, ft);
    add({ name: `shin.${side}`, bone: sh, shape: { k: 'frustum', r0: 0.061, r1: 0.071, h: b.len + 0.04 }, t: b.m, slot: SLOT.TUNIC2, minLod: 1, skin: true, lod1: { seg: 4, cap: 0, phase: Math.PI / 4 } });
    const K = J(f, sh);
    add({
      name: `knee.${side}`,
      bone: sh,
      shape: { k: 'ellipsoid', rx: 0.03, ry: 0.045, rz: 0.05 },
      t: [K[0] + 0.058, K[1] - 0.012, K[2]],
      slot: SLOT.FIXED,
      color: FIXED_COLORS.leather,
      minLod: 0,
    });
    const A = J(f, ft);
    add({
      name: `boot.${side}`,
      bone: ft,
      shape: { k: 'box', w: 0.14, h: 0.1, d: 0.17 },
      t: [A[0] + 0.02, 0.05, A[2]],
      slot: SLOT.FIXED,
      color: FIXED_COLORS.boot,
      minLod: 1,
      skin: true,
      round: 0.7,
      lod1: { shape: { k: 'box', w: 0.14, h: 0.1, d: 0.23 }, t: [A[0] + 0.045, 0.05, A[2]] },
    });
    add({
      name: `toe.${side}`,
      bone: ft,
      shape: { k: 'ellipsoid', rx: 0.068, ry: 0.056, rz: 0.072 },
      t: [A[0] + 0.105, 0.054, A[2]],
      slot: SLOT.FIXED,
      color: FIXED_COLORS.boot,
      minLod: 0,
      skin: true,
    });
    add({
      name: `shaft.${side}`,
      bone: ft,
      shape: { k: 'frustum', r0: 0.07, r1: 0.076, h: 0.1 },
      t: [A[0] - 0.005, 0.12, A[2]],
      slot: SLOT.FIXED,
      color: FIXED_COLORS.boot,
      minLod: 0,
      skin: true,
    });
    add({
      name: `sole.${side}`,
      bone: ft,
      shape: { k: 'box', w: 0.15, h: 0.022, d: 0.25 },
      t: [A[0] + 0.05, 0.011, A[2]],
      slot: SLOT.FIXED,
      color: MODEL_COLORS.sole,
      minLod: 0,
      round: 0.3,
    });
  }

  // ---------------------------------------------------------------- LOD2 token (30 triangles of body)
  for (const [th, , , s, side] of legs) {
    add({
      name: `tok.leg.${side}`,
      bone: th,
      shape: { k: 'frustum', r0: 0.115, r1: 0, h: f.hipY + 0.02 },
      t: [0.035, (f.hipY + 0.02) / 2, s * J(f, th)[2] * 1.15],
      s: [1.3, 1, 0.85],
      slot: SLOT.TUNIC2,
      fromLod: 2,
      minLod: 2,
      seg: 3,
    });
  }
  const c45 = Math.SQRT1_2;
  const tb = f.hipY - 0.04;
  const tt = sY + 0.03;
  add({
    name: 'tok.torso',
    bone: BONE.SPINE,
    shape: { k: 'frustum', r0: (p.bellyR - 0.005) / c45, r1: p.shoulderW / 2 / c45, h: tt - tb },
    t: [0, (tb + tt) / 2, 0],
    s: [0.58, 1, 1],
    slot: SLOT.TUNIC,
    fromLod: 2,
    minLod: 2,
    seg: 4,
    phase: Math.PI / 4,
  });
  add({
    name: 'tok.head',
    bone: BONE.HEAD,
    shape: { k: 'ellipsoid', rx: f.hrx * 1.2, ry: f.hry * 1.05, rz: f.hrz * 1.15 },
    t: [f.hx, f.hy, 0],
    slot: SLOT.SKIN,
    fromLod: 2,
    minLod: 2,
    seg: 3,
    rings: 2,
  });
  const tokBeardH = p.beardLen + 0.06;
  add({
    name: 'tok.beard',
    bone: BONE.BEARD,
    shape: { k: 'frustum', r0: (p.beardW / 2) * 1.15, r1: 0, h: tokBeardH },
    t: [bf.xAt(f.chinY - p.beardLen / 2) + 0.01, f.chinY - p.beardLen / 2 + 0.03, 0],
    r: [0, 0, bf.tilt],
    s: [0.5, 1, 1],
    slot: SLOT.BEARD,
    fromLod: 2,
    minLod: 2,
    seg: 3,
  });
  return out;
}
