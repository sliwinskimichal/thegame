/**
 * Stand-in dwarf of the renderer (owner: W3 "Technical artist", dwarf team) — `dwarves.html?variant=fixture`
 * (welded) and `?variant=fixture-parts` (instanced parts). NOT a tournament entry: it only lets the crowd
 * renderer, materials, shots and metrics run before the model team's variants land (brief §4.10).
 * Rigid primitives on the bones of referenceJoints(preset A), dimensions from the concept card table,
 * the four role identities (headgear + tool + back element), deterministic palettes from the seed.
 */
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { BONE, HOLD, type BoneId, type RigInput, type ToolInfo } from '../../anim/types';
import { BEARD_COLORS, FIXED_COLORS, PROPORTIONS_A, referenceJoints, ROLE_DIRECTION, SKIN_BASE, SOCIAL_ACCENT } from '../direction';
import {
  LOD_TRIANGLE_BUDGET,
  ROLE,
  SLOT,
  type DwarfMesh,
  type DwarfModel,
  type DwarfPalette,
  type DwarfSpec,
  type DwarfVariant,
  type LodLevel,
  type PartDef,
  type PartMesh,
  type PartShape,
  type Proportions,
  type RoleId,
  type SocialId,
} from '../types';
import { Rng } from '../../../core/rng';

// ------------------------------------------------------------------------------------------------ colour helpers
const _c = new THREE.Color();
/** CIE L* of an sRGB hex colour. */
export function lStarHex(hex: number): number {
  _c.setHex(hex); // THREE.Color holds linear values (colour management on)
  const y = 0.2126 * _c.r + 0.7152 * _c.g + 0.0722 * _c.b;
  return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y;
}

/** Scale the lightness of an sRGB hex colour by dL in L* (approximately, through linear luminance). */
function shiftHexL(hex: number, dL: number): number {
  _c.setHex(hex);
  const y = Math.max(0.2126 * _c.r + 0.7152 * _c.g + 0.0722 * _c.b, 1e-6);
  const l = (y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y) + dL;
  const y2 = l > 8 ? ((l + 16) / 116) ** 3 : Math.max(l, 0) / 903.3;
  _c.multiplyScalar(y2 / y);
  return _c.getHex();
}

/** Fixture spec factory: role palette, a beard >= 15 L* away from the tunic, skin ±8 L*, the social accent. */
export function fixtureSpec(seed: number, role: RoleId, social: SocialId, proportions: Proportions = PROPORTIONS_A): DwarfSpec {
  const rng = new Rng(seed ^ 0x5d3f);
  const dir = ROLE_DIRECTION[role]!;
  const tunic = dir.tunic;
  let beard = rng.pick(BEARD_COLORS);
  for (let k = 0; k < 8 && Math.abs(lStarHex(beard) - lStarHex(tunic)) < 15; k++) beard = rng.pick(BEARD_COLORS);
  if (Math.abs(lStarHex(beard) - lStarHex(tunic)) < 15) beard = BEARD_COLORS.reduce((a, b) => (Math.abs(lStarHex(b) - lStarHex(tunic)) > Math.abs(lStarHex(a) - lStarHex(tunic)) ? b : a));
  const palette: DwarfPalette = {
    tunic,
    tunic2: dir.tunic2,
    beard,
    skin: shiftHexL(SKIN_BASE, rng.range(-8, 8)),
    cloth: dir.cloth,
    accent: SOCIAL_ACCENT[social],
    leather: FIXED_COLORS.leather,
    boot: FIXED_COLORS.boot,
    iron: FIXED_COLORS.iron,
    wood: FIXED_COLORS.wood,
    lamp: FIXED_COLORS.lampFlame,
  };
  return { seed, role, social, proportions, palette, braids: dir.braids, beardShape: rng.next() };
}

// ------------------------------------------------------------------------------------------------ parts (data)
type V3 = readonly [number, number, number];
const P = (name: string, bone: BoneId, shape: PartShape, t: V3, slot: number, extra: Partial<PartDef> = {}): PartDef => ({ name, bone, shape, t, slot, ...extra });

/** The fixture dwarf as parts (rest model space, +X forward, +Z right side). */
export function fixtureParts(role: RoleId, p: Proportions, rest: Float32Array): PartDef[] {
  const J = (b: number): [number, number, number] => [rest[b * 3]!, rest[b * 3 + 1]!, rest[b * 3 + 2]!];
  const crown = p.heads * p.headH;
  const chin = crown - p.headH;
  const head = J(BONE.HEAD);
  const hc = chin + p.headH * 0.5;
  const hr = p.headH * 0.5;
  const shoulderY = J(BONE.ARM_R)[1];
  const beltY = J(BONE.SPINE)[1];
  const hipY = p.legH;
  const out: PartDef[] = [];
  const F = SLOT.FIXED;
  // --- body
  out.push(P('skirt', BONE.PELVIS, { k: 'frustum', r0: p.bellyR + 0.05, r1: p.bellyR + 0.01, h: beltY - hipY + 0.04 }, [0, (beltY + hipY) / 2 - 0.02, 0], SLOT.TUNIC));
  out.push(P('belt', BONE.SPINE, { k: 'frustum', r0: p.bellyR + 0.025, r1: p.bellyR + 0.025, h: 0.06 }, [0, beltY, 0], F, { color: FIXED_COLORS.leatherDark }));
  out.push(P('buckle', BONE.SPINE, { k: 'box', w: 0.07, h: 0.06, d: 0.03 }, [p.bellyR + 0.03, beltY, 0], F, { color: 0x8a6a3a, minLod: 1 }));
  out.push(
    P('torso', BONE.SPINE, { k: 'lathe', profile: [[0.01, beltY - 0.01], [p.bellyR, beltY], [p.bellyR + 0.02, beltY + 0.1], [p.chestR, beltY + 0.22], [p.chestR - 0.02, shoulderY - 0.02], [0.12, shoulderY + 0.03], [0.01, shoulderY + 0.035]] }, [0, 0, 0], SLOT.TUNIC, { s: [0.92, 1, 1.05] }),
  );
  out.push(P('shoulders', BONE.CHEST, { k: 'ellipsoid', rx: 0.17, ry: 0.11, rz: p.shoulderW / 2 }, [0, shoulderY - 0.02, 0], SLOT.TUNIC));
  out.push(P('head', BONE.HEAD, { k: 'ellipsoid', rx: hr * 0.9, ry: hr, rz: hr * 0.86 }, [head[0], hc, 0], SLOT.SKIN));
  out.push(P('nose', BONE.HEAD, { k: 'ellipsoid', rx: 0.055, ry: 0.055, rz: 0.05 }, [head[0] + hr * 0.92, hc - 0.02, 0], SLOT.SKIN, { minLod: 1 }));
  out.push(P('brow', BONE.HEAD, { k: 'box', w: 0.2, h: 0.05, d: 0.08 }, [head[0] + hr * 0.7, hc + 0.045, 0], SLOT.BEARD, { minLod: 1 }));
  for (const s of [1, -1]) out.push(P(`eye.${s > 0 ? 'r' : 'l'}`, BONE.HEAD, { k: 'box', w: 0.025, h: 0.025, d: 0.02 }, [head[0] + hr * 0.86, hc + 0.015, s * 0.05], F, { color: FIXED_COLORS.ink, minLod: 0 }));
  out.push(P('moustache', BONE.HEAD, { k: 'ellipsoid', rx: 0.05, ry: 0.032, rz: 0.11 }, [head[0] + hr * 0.82, hc - 0.07, 0], SLOT.BEARD, { minLod: 1 }));
  const bj = J(BONE.BEARD);
  out.push(P('beard.top', BONE.BEARD, { k: 'wedge', w0: 0.26, w1: (0.26 + p.beardW) / 2, h: p.beardLen * 0.55, d: 0.12 }, [bj[0], chin + 0.04, 0], SLOT.BEARD, { r: [0, 0, 0.14] }));
  const b2 = J(BONE.BEARD2);
  out.push(P('beard.bot', BONE.BEARD2, { k: 'wedge', w0: (0.26 + p.beardW) / 2, w1: p.beardW, h: p.beardLen * 0.5, d: 0.11 }, [b2[0] + 0.01, chin + 0.04 - p.beardLen * 0.5, 0], SLOT.BEARD, { r: [0, 0, 0.14] }));
  const braids = ROLE_DIRECTION[role]!.braids;
  for (let k = 0; k < braids; k++) {
    const z = braids === 1 ? 0 : (k ? -1 : 1) * 0.08;
    out.push(P(`braid.${k}`, BONE.BEARD2, { k: 'capsule', r: 0.02, len: 0.08 }, [b2[0] + 0.06, chin + 0.02 - p.beardLen - 0.03, z], SLOT.BEARD, { minLod: 1 }));
    out.push(P(`bead.${k}`, BONE.BEARD2, { k: 'ellipsoid', rx: 0.024, ry: 0.024, rz: 0.024 }, [b2[0] + 0.06, chin + 0.02 - p.beardLen - 0.1, z], F, { color: 0x8a6a3a, minLod: 0 }));
  }
  for (const [arm, fore, hand, s] of [
    [BONE.ARM_R, BONE.FORE_R, BONE.HAND_R, 1],
    [BONE.ARM_L, BONE.FORE_L, BONE.HAND_L, -1],
  ] as const) {
    const a = J(arm);
    const f = J(fore);
    const h = J(hand);
    const side = s > 0 ? 'r' : 'l';
    out.push(P(`arm.${side}`, arm, { k: 'capsule', r: 0.068, len: Math.max(0.01, a[1] - f[1]) }, [0, (a[1] + f[1]) / 2, a[2]], SLOT.TUNIC2));
    out.push(P(`fore.${side}`, fore, { k: 'capsule', r: 0.062, len: Math.max(0.01, f[1] - h[1]) }, [0, (f[1] + h[1]) / 2, f[2]], SLOT.TUNIC2));
    out.push(P(`hand.${side}`, hand, { k: 'ellipsoid', rx: p.handS * 0.5, ry: p.handS * 0.52, rz: p.handS * 0.45 }, [0.01, h[1] - p.handS * 0.4, h[2]], SLOT.SKIN));
  }
  for (const [th, sh, ft, s] of [
    [BONE.THIGH_R, BONE.SHIN_R, BONE.FOOT_R, 1],
    [BONE.THIGH_L, BONE.SHIN_L, BONE.FOOT_L, -1],
  ] as const) {
    const a = J(th);
    const k = J(sh);
    const f = J(ft);
    const side = s > 0 ? 'r' : 'l';
    out.push(P(`thigh.${side}`, th, { k: 'capsule', r: 0.085, len: Math.max(0.01, a[1] - k[1]) }, [0, (a[1] + k[1]) / 2, a[2]], SLOT.TUNIC2));
    out.push(P(`shin.${side}`, sh, { k: 'capsule', r: 0.078, len: Math.max(0.01, k[1] - f[1]) }, [0, (k[1] + f[1]) / 2 + 0.01, k[2]], SLOT.TUNIC2));
    out.push(P(`boot.${side}`, ft, { k: 'box', w: 0.14, h: 0.1, d: 0.22 }, [0.03, 0.05, f[2]], F, { color: FIXED_COLORS.boot }));
    out.push(P(`toe.${side}`, ft, { k: 'ellipsoid', rx: 0.07, ry: 0.05, rz: 0.075 }, [0.14, 0.045, f[2]], F, { color: FIXED_COLORS.boot, minLod: 1 }));
  }
  // --- role identity
  const hand = J(BONE.TOOL_R);
  const handL = J(BONE.TOOL_L);
  const id = (ident: PartDef['ident']): Partial<PartDef> => ({ identity: true, ident });
  const lantern = () => {
    const l = J(BONE.LANTERN);
    out.push(P('lantern', BONE.LANTERN, { k: 'box', w: 0.06, h: 0.09, d: 0.06 }, [l[0], l[1] - 0.06, l[2]], F, { color: FIXED_COLORS.lampFlame, emissive: 2.2, minLod: 1, ...id('lamp') }));
    out.push(P('lantern.cap', BONE.LANTERN, { k: 'box', w: 0.075, h: 0.025, d: 0.075 }, [l[0], l[1] - 0.005, l[2]], F, { color: FIXED_COLORS.iron, minLod: 1 }));
  };
  if (role === ROLE.MINER) {
    out.push(P('helmet', BONE.HEAD, { k: 'dome', r: hr * 1.06, ry: p.hatH + hr * 0.45 }, [head[0] - 0.01, hc + hr * 0.5, 0], SLOT.CLOTH, id('headgear')));
    out.push(P('helmet.band', BONE.HEAD, { k: 'frustum', r0: hr * 1.08, r1: hr * 1.08, h: 0.035 }, [head[0] - 0.01, hc + hr * 0.52, 0], F, { color: FIXED_COLORS.iron, ...id('headgear') }));
    out.push(P('helmet.brim', BONE.HEAD, { k: 'box', w: 0.26, h: 0.025, d: 0.11 }, [head[0] + hr * 0.95, hc + hr * 0.5, 0], SLOT.CLOTH, { r: [0, 0, -0.15], ...id('headgear') }));
    out.push(P('lamp.plate', BONE.HEAD, { k: 'box', w: 0.07, h: 0.09, d: 0.02 }, [head[0] + hr * 1.05, hc + hr * 0.78, 0], F, { color: FIXED_COLORS.iron, ...id('lamp') }));
    out.push(P('lamp', BONE.HEAD, { k: 'box', w: 0.07, h: 0.07, d: 0.07 }, [head[0] + hr * 1.05 + 0.045, hc + hr * 0.78, 0], F, { color: FIXED_COLORS.lampFlame, emissive: 2.5, ...id('lamp') }));
    out.push(P('plume', BONE.HEAD, { k: 'capsule', r: 0.035, len: 0.11 }, [head[0] - hr * 0.95, crown + 0.02, 0], SLOT.ACCENT, { r: [0, 0, 0.9], ...id('headgear') }));
    // pick: handle along +Y from the fist, T-head at 0.62 with two blades, bright edge at the points
    out.push(P('pick.handle', BONE.TOOL_R, { k: 'capsule', r: 0.022, len: 0.75 }, [hand[0], hand[1] + 0.275, hand[2]], F, { color: FIXED_COLORS.wood, ...id('tool') }));
    out.push(P('pick.head', BONE.TOOL_R, { k: 'box', w: 0.05, h: 0.05, d: 0.3 }, [hand[0], hand[1] + 0.62, hand[2]], F, { color: FIXED_COLORS.iron, ...id('tool') }));
    for (const s of [1, -1]) out.push(P(`pick.tip${s}`, BONE.TOOL_R, { k: 'box', w: 0.035, h: 0.035, d: 0.07 }, [hand[0] + s * 0.17, hand[1] + 0.61 - 0.015, hand[2]], F, { color: FIXED_COLORS.ironEdge, minLod: 1, ...id('tool') }));
    out.push(P('tylnik', BONE.APRON_B, { k: 'wedge', w0: 0.26, w1: 0.32, h: 0.34, d: 0.03 }, [-p.bellyR - 0.03, beltY + 0.01, 0], F, { color: FIXED_COLORS.leather, ...id('back') }));
  } else if (role === ROLE.CARPENTER) {
    out.push(P('hood', BONE.HEAD, { k: 'ellipsoid', rx: hr * 0.98, ry: hr * 1.02, rz: hr * 0.98 }, [head[0] - 0.035, hc + 0.03, 0], SLOT.CLOTH, id('headgear')));
    out.push(P('hood.tip', BONE.HEAD, { k: 'frustum', r0: 0.08, r1: 0.012, h: 0.26 }, [head[0] - hr * 1.1, crown - 0.01, 0], SLOT.CLOTH, { r: [0, 0, 1.15], ...id('headgear') }));
    out.push(P('tassel', BONE.HEAD, { k: 'ellipsoid', rx: 0.04, ry: 0.04, rz: 0.04 }, [head[0] - hr * 1.1 - 0.23, crown + 0.07, 0], SLOT.ACCENT, id('headgear')));
    out.push(P('axe.handle', BONE.TOOL_R, { k: 'capsule', r: 0.02, len: 0.55 }, [hand[0], hand[1] + 0.2, hand[2]], F, { color: FIXED_COLORS.wood, ...id('tool') }));
    out.push(P('axe.blade', BONE.TOOL_R, { k: 'box', w: 0.03, h: 0.17, d: 0.16 }, [hand[0] + 0.08, hand[1] + 0.42, hand[2]], F, { color: FIXED_COLORS.iron, ...id('tool') }));
    out.push(P('axe.edge', BONE.TOOL_R, { k: 'box', w: 0.034, h: 0.19, d: 0.025 }, [hand[0] + 0.165, hand[1] + 0.42, hand[2]], F, { color: FIXED_COLORS.ironEdge, minLod: 1, ...id('tool') }));
    const back = J(BONE.BACK);
    out.push(P('beam', BONE.BACK, { k: 'box', w: 0.11, h: 1.0, d: 0.11 }, [back[0] + 0.1, shoulderY + 0.08, -0.2], F, { color: FIXED_COLORS.wood, r: [0, 0, 1.2], ...id('back') }));
    lantern();
  } else if (role === ROLE.PORTER) {
    out.push(P('hair', BONE.HEAD, { k: 'dome', r: hr * 0.98, ry: hr * 0.75 }, [head[0] - 0.02, hc + 0.02, 0], SLOT.BEARD, { minLod: 2 }));
    out.push(P('band', BONE.HEAD, { k: 'frustum', r0: hr * 1.02, r1: hr * 1.0, h: 0.045 }, [head[0] - 0.01, hc + hr * 0.42, 0], SLOT.CLOTH, id('headgear')));
    for (const s of [1, -1])
      out.push(P(`band.end${s}`, BONE.HEAD, { k: 'capsule', r: 0.018, len: 0.1 }, [head[0] - hr * 1.0 - 0.03, hc + hr * 0.3, s * 0.03], SLOT.ACCENT, { r: [s * 0.3, 0, -0.5], ...id('headgear') }));
    const back = J(BONE.BACK);
    for (const s of [1, -1]) out.push(P(`frame.post${s}`, BONE.BACK, { k: 'box', w: 0.045, h: 0.72, d: 0.045 }, [back[0] - 0.12, shoulderY + 0.02, s * 0.2], F, { color: FIXED_COLORS.wood, ...id('back') }));
    out.push(P('frame.bar', BONE.BACK, { k: 'box', w: 0.45, h: 0.045, d: 0.045 }, [back[0] - 0.12, shoulderY + 0.33, 0], F, { color: FIXED_COLORS.wood, ...id('back') }));
    out.push(P('basket', BONE.BACK, { k: 'frustum', r0: 0.15, r1: 0.19, h: 0.32 }, [back[0] - 0.24, shoulderY - 0.05, 0], F, { color: FIXED_COLORS.basket, s: [0.8, 1, 1], ...id('back') }));
    out.push(P('ore', BONE.LOAD, { k: 'ellipsoid', rx: 0.13, ry: 0.08, rz: 0.15 }, [back[0] - 0.24, shoulderY + 0.13, 0], F, { color: FIXED_COLORS.ore, ...id('load') }));
    for (const s of [1, -1]) out.push(P(`strap${s}`, BONE.CHEST, { k: 'box', w: 0.05, h: 0.3, d: 0.03 }, [p.chestR - 0.03, shoulderY - 0.13, s * 0.15], F, { color: FIXED_COLORS.leather, minLod: 1 }));
    lantern();
  } else {
    out.push(P('cap', BONE.HEAD, { k: 'dome', r: hr * 1.04, ry: p.hatH + hr * 0.4 }, [head[0] - 0.01, hc + hr * 0.45, 0], SLOT.CLOTH, id('headgear')));
    out.push(P('neckguard', BONE.HEAD, { k: 'box', w: hr * 1.6, h: 0.17, d: 0.035 }, [head[0] - hr * 0.98, hc - 0.02, 0], SLOT.CLOTH, { r: [0, 0, -0.18], ...id('headgear') }));
    out.push(P('goggle', BONE.HEAD, { k: 'box', w: 0.17, h: 0.055, d: 0.035 }, [head[0] + hr * 0.85, hc + hr * 0.58, 0], F, { color: FIXED_COLORS.mica, ...id('headgear') }));
    out.push(P('feather', BONE.HEAD, { k: 'capsule', r: 0.025, len: 0.13 }, [head[0] - 0.02, crown + 0.04, hr * 0.85], SLOT.ACCENT, { r: [0.4, 0, 0.5], ...id('headgear') }));
    out.push(P('hammer.handle', BONE.TOOL_R, { k: 'capsule', r: 0.022, len: 0.42 }, [hand[0], hand[1] + 0.14, hand[2]], F, { color: FIXED_COLORS.wood, ...id('tool') }));
    out.push(P('hammer.head', BONE.TOOL_R, { k: 'box', w: 0.1, h: 0.1, d: 0.18 }, [hand[0] + 0.02, hand[1] + 0.34, hand[2]], F, { color: FIXED_COLORS.iron, ...id('tool') }));
    for (const s of [1, -1]) out.push(P(`tongs${s}`, BONE.TOOL_L, { k: 'box', w: 0.02, h: 0.42, d: 0.025 }, [handL[0] + s * 0.015, handL[1] + 0.12, handL[2]], F, { color: FIXED_COLORS.iron, ...id('tool') }));
    out.push(P('apron.top', BONE.SPINE, { k: 'box', w: 0.34, h: 0.26, d: 0.03 }, [p.chestR + 0.005, beltY + 0.14, 0], F, { color: FIXED_COLORS.leather, minLod: 1, ...id('apron') }));
    out.push(P('apron', BONE.APRON_F, { k: 'wedge', w0: 0.36, w1: 0.4, h: 0.34, d: 0.03 }, [p.bellyR + 0.06, beltY + 0.01, 0], F, { color: FIXED_COLORS.leather, ...id('apron') }));
    lantern();
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ geometry
/** Segment counts per LOD (round shapes). */
const SEG: readonly [number, number, number] = [14, 7, 4];

function shapeGeometry(s: PartShape, lod: LodLevel): THREE.BufferGeometry {
  const n = SEG[lod]!;
  switch (s.k) {
    case 'ellipsoid':
      return new THREE.SphereGeometry(1, n, Math.max(3, Math.round(n * 0.7))).scale(s.rx, s.ry, s.rz);
    case 'capsule':
      return new THREE.CapsuleGeometry(s.r, s.len, Math.max(1, n >> 2), n);
    case 'box':
      return new THREE.BoxGeometry(s.d, s.h, s.w);
    case 'frustum':
      return new THREE.CylinderGeometry(s.r1, s.r0, s.h, n);
    case 'lathe':
      return new THREE.LatheGeometry(s.profile.map(([r, y]) => new THREE.Vector2(r, y)), n);
    case 'dome':
      return new THREE.SphereGeometry(s.r, n, Math.max(2, Math.round(n * 0.4)), 0, Math.PI * 2, 0, Math.PI / 2).scale(1, s.ry / s.r, 1);
    case 'wedge': {
      // trapezoid prism: top at y = 0 (width w0), bottom at y = -h (width w1), depth d along X
      const g = new THREE.BoxGeometry(s.d, s.h, 1);
      const p = g.attributes.position!;
      for (let i = 0; i < p.count; i++) {
        const top = p.getY(i) > 0;
        p.setY(i, top ? 0 : -s.h);
        p.setZ(i, p.getZ(i) * (top ? s.w0 : s.w1));
      }
      g.computeVertexNormals();
      return g;
    }
    case 'outline': {
      const shape = new THREE.Shape(s.pts.map(([x, y]) => new THREE.Vector2(x, y)));
      return new THREE.ExtrudeGeometry(shape, { depth: s.d, bevelEnabled: false }).translate(0, 0, -s.d / 2);
    }
  }
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

/** Rest-model-space geometry of one part (position + normal only, non-indexed). */
export function partGeometry(part: PartDef, lod: LodLevel): THREE.BufferGeometry {
  let g = shapeGeometry(part.shape, lod);
  const r = part.r ?? [0, 0, 0];
  _e.set(r[0], r[1], r[2], 'ZYX');
  _q.setFromEuler(_e);
  const sc = part.s ?? [1, 1, 1];
  _m.compose(_p.set(part.t[0], part.t[1], part.t[2]), _q, _s.set(sc[0], sc[1], sc[2]));
  g.applyMatrix4(_m);
  if (g.index) g = g.toNonIndexed();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  return g;
}

/** Parts drawn at a LOD (contract: fromLod <= lod <= minLod; the fixture keeps identity parts everywhere). */
export function partsForLod(parts: readonly PartDef[], lod: LodLevel): PartDef[] {
  return parts.filter((p) => (p.fromLod ?? 0) <= lod && (p.identity || lod <= (p.minLod ?? 2)));
}

interface Attr {
  pos: number[];
  nrm: number[];
  col: number[];
  slot: number[];
  bones: number[];
  w: number[];
  emi: number[];
  layer: number[];
}

function emptyAttr(): Attr {
  return { pos: [], nrm: [], col: [], slot: [], bones: [], w: [], emi: [], layer: [] };
}

function pushPart(a: Attr, g: THREE.BufferGeometry, part: PartDef): void {
  const p = g.attributes.position!;
  const n = g.attributes.normal!;
  const c = new THREE.Color(part.slot === SLOT.FIXED ? (part.color ?? 0xffffff) : 0xffffff);
  for (let i = 0; i < p.count; i++) {
    a.pos.push(p.getX(i), p.getY(i), p.getZ(i));
    a.nrm.push(n.getX(i), n.getY(i), n.getZ(i));
    a.col.push(c.r, c.g, c.b);
    a.slot.push(part.slot);
    a.bones.push(part.bone, part.bone);
    a.w.push(1);
    a.emi.push(part.emissive ?? 0);
    a.layer.push(part.layer ?? 0);
  }
}

function toGeometry(a: Attr, indexed: THREE.BufferAttribute | null = null): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(a.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(a.nrm, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(a.col, 3));
  g.setAttribute('aSlot', new THREE.Float32BufferAttribute(a.slot, 1));
  g.setAttribute('aBones', new THREE.Float32BufferAttribute(a.bones, 2));
  g.setAttribute('aWeight', new THREE.Float32BufferAttribute(a.w, 1));
  g.setAttribute('aEmissive', new THREE.Float32BufferAttribute(a.emi, 1));
  g.setAttribute('aLayer', new THREE.Float32BufferAttribute(a.layer, 1));
  if (indexed) g.setIndex(indexed);
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

/** Smooth-normal, welded copy of one part for the ink hull (weld by position within the part = one bone). */
function hullOf(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const h = new THREE.BufferGeometry();
  h.setAttribute('position', g.attributes.position!.clone());
  const w = mergeVertices(h, 1e-4);
  w.computeVertexNormals();
  return w;
}

/** Parts that get no ink hull (tiny details would turn into ink blobs). */
const NO_HULL = /^(eye|bead|braid)/;

function triCount(g: THREE.BufferGeometry): number {
  return (g.index ? g.index.count : g.attributes.position!.count) / 3;
}

function weldedLod(parts: readonly PartDef[], lod: LodLevel): DwarfMesh {
  const fill = emptyAttr();
  const hull = emptyAttr();
  const hullIdx: number[] = [];
  for (const part of partsForLod(parts, lod)) {
    const g = partGeometry(part, lod);
    pushPart(fill, g, part);
    if (NO_HULL.test(part.name)) continue;
    const h = hullOf(g);
    const base = hull.pos.length / 3;
    pushPart(hull, h, part);
    const idx = h.index!;
    for (let i = 0; i < idx.count; i++) hullIdx.push(base + idx.getX(i));
  }
  const geometry = toGeometry(fill);
  const hullGeo = toGeometry(hull, new THREE.Uint32BufferAttribute(hullIdx, 1));
  return { lod, mode: 'welded', geometry, hull: hullGeo, parts: null, triangles: triCount(geometry) };
}

function partsLod(parts: readonly PartDef[], lod: LodLevel, rest: Float32Array): DwarfMesh {
  const out: PartMesh[] = [];
  let tris = 0;
  for (const part of partsForLod(parts, lod)) {
    const g = partGeometry(part, lod);
    const b = part.bone;
    g.translate(-rest[b * 3]!, -rest[b * 3 + 1]!, -rest[b * 3 + 2]!); // bone-local: rest offset removed
    const a = emptyAttr();
    pushPart(a, g, part);
    const geometry = toGeometry(a);
    let hull: THREE.BufferGeometry | null = null;
    if (!NO_HULL.test(part.name)) {
      const h = hullOf(g);
      const ha = emptyAttr();
      pushPart(ha, h, part);
      hull = toGeometry(ha, h.index as THREE.BufferAttribute);
    }
    tris += triCount(geometry);
    out.push({ name: part.name, bone: b, geometry, slot: part.slot, hull });
  }
  return { lod, mode: 'parts', geometry: null, hull: null, parts: out, triangles: tris };
}

function toolInfo(role: RoleId): ToolInfo | null {
  if (role === ROLE.MINER) return { kind: 'pick', length: 0.75, gripL: 0.42, head: 0.62, strike: [0.2, 0.6, 0] };
  if (role === ROLE.CARPENTER) return { kind: 'axe', length: 0.55, gripL: 0.3, head: 0.42, strike: [0.18, 0.42, 0] };
  if (role === ROLE.SMITH) return { kind: 'hammer', length: 0.42, gripL: 0, head: 0.34, strike: [0.11, 0.34, 0] };
  return null;
}

/** Rest joints of the fixture: reference joints, porter's LOAD socket moved into the basket. */
function fixtureRest(role: RoleId, p: Proportions): Float32Array {
  const rest = referenceJoints(p);
  if (role === ROLE.PORTER) {
    const back = rest[BONE.BACK * 3]!;
    rest[BONE.LOAD * 3] = back - 0.24;
    rest[BONE.LOAD * 3 + 1] = rest[BONE.ARM_R * 3 + 1]! + 0.05;
    rest[BONE.LOAD * 3 + 2] = 0;
  }
  return rest;
}

export function buildFixture(variantId: string, spec: DwarfSpec, mode: 'welded' | 'parts'): DwarfModel {
  const p = spec.proportions;
  const rest = fixtureRest(spec.role, p);
  const parts = fixtureParts(spec.role, p, rest);
  const head = BONE.HEAD;
  const lampPart = parts.find((x) => x.name === 'lamp' || x.name === 'lantern')!;
  const miner = spec.role === ROLE.MINER;
  const rig: RigInput = {
    rest,
    toolR: toolInfo(spec.role),
    toolL: spec.role === ROLE.SMITH ? { kind: 'tongs', length: 0.42, gripL: 0, head: 0.3, strike: [0.02, 0.33, 0] } : null,
    hold: [HOLD.TOOL_SHOULDER, HOLD.BEAM_SHOULDER, HOLD.FRAME_STRAPS, HOLD.TWO_TOOLS][spec.role]!,
    back: miner ? 'apron' : spec.role === ROLE.CARPENTER ? 'beam' : spec.role === ROLE.PORTER ? 'frame' : 'none',
    front: spec.role === ROLE.SMITH ? 'apron' : 'none',
    lamp: {
      bone: miner ? head : BONE.LANTERN,
      offset: [lampPart.t[0] + (miner ? 0.02 : 0), lampPart.t[1], lampPart.t[2]],
      color: miner ? [1.5, 1.08, 0.62] : [1.2, 0.86, 0.5],
      radius: miner ? 2.0 : 1.8,
    },
    seed: spec.seed,
  };
  const lods = ([0, 1, 2] as const).map((l) => (mode === 'welded' ? weldedLod(parts, l) : partsLod(parts, l, rest))) as unknown as [DwarfMesh, DwarfMesh, DwarfMesh];
  return { variantId, spec, rig, lods, viewYawDeg: 40, parts };
}

export const FIXTURE_VARIANTS: readonly DwarfVariant[] = (['welded', 'parts'] as const).map((mode) => ({
  id: mode === 'welded' ? 'fixture' : 'fixture-parts',
  namePl: mode === 'welded' ? 'Zastępczy (W3)' : 'Zastępczy, części (W3)',
  descPl: 'Model zastępczy stanowiska: prymitywy na kościach referenceJoints(A), wyłącznie do testów renderera — nie startuje w turnieju.',
  technique: mode === 'welded' ? 'primitives' : 'parts',
  proportions: PROPORTIONS_A,
  viewYawDeg: 40,
  build: (spec: DwarfSpec) => buildFixture(mode === 'welded' ? 'fixture' : 'fixture-parts', spec, mode),
}));

/** Budget check helper (fixture is not bound by the budgets; tests report them). */
export function overBudget(m: DwarfModel): boolean[] {
  return m.lods.map((l, i) => l.triangles > LOD_TRIANGLE_BUDGET[i]!);
}

