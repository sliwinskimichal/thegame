// Dwarf team contract guard (owner: team lead). Workers' tests live in tests/anim/{model,rig,render}/.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BONE, BONE_COUNT, BONE_NAMES, BONE_PARENT, CLIP_IDS, PoseFrame } from '../../src/render/anim/types';
import { lodForPxPerTile, PROPORTION_PRESETS, referenceJoints, ROLE_DIRECTION, BEARD_COLORS, totalHeight, ZOOMS } from '../../src/render/characters/direction';
import { cameraDistance, LOD_TRIANGLE_BUDGET, ROLE, ROLE_IDS, SHOT_IDS } from '../../src/render/characters/types';

const L = (hex: number) => {
  // CIE L* of an sRGB colour
  const c = new THREE.Color(hex);
  const y = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b; // THREE.Color stores linear values
  return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y;
};

describe('dwarf contract: skeleton', () => {
  it('has one parent per bone, in topological order (one-pass FK)', () => {
    expect(BONE_PARENT.length).toBe(BONE_COUNT);
    expect(BONE_NAMES.length).toBe(BONE_COUNT);
    expect(Object.keys(BONE).length).toBe(BONE_COUNT);
    BONE_PARENT.forEach((p, b) => expect(p).toBeLessThan(b));
    expect(BONE_PARENT[BONE.ROOT]).toBe(-1);
    expect(BONE_PARENT[BONE.TOOL_R]).toBe(BONE.HAND_R);
    expect(BONE_PARENT[BONE.TOOL_L]).toBe(BONE.HAND_L);
  });

  it('PoseFrame blends linearly and resets to the rest pose', () => {
    const a = new PoseFrame();
    const b = new PoseFrame();
    b.rot[3] = 1;
    b.scale[BONE.LOAD] = 0;
    const o = new PoseFrame().lerp(a, b, 0.25);
    expect(o.rot[3]).toBeCloseTo(0.25);
    expect(o.scale[BONE.LOAD]).toBeCloseTo(0.75);
    o.reset();
    expect(o.scale.every((s) => s === 1)).toBe(true);
    expect(CLIP_IDS).toContain('dig');
  });
});

describe('dwarf contract: art direction data', () => {
  for (const [name, p] of Object.entries(PROPORTION_PRESETS)) {
    it(`preset ${name}: joints are ordered like a dwarf`, () => {
      const j = referenceJoints(p);
      const y = (b: number) => j[b * 3 + 1]!;
      const z = (b: number) => j[b * 3 + 2]!;
      expect(y(BONE.FOOT_R)).toBeLessThan(y(BONE.SHIN_R));
      expect(y(BONE.SHIN_R)).toBeLessThan(y(BONE.THIGH_R));
      expect(y(BONE.THIGH_R)).toBeCloseTo(p.legH);
      expect(y(BONE.PELVIS)).toBeLessThan(y(BONE.SPINE));
      expect(y(BONE.SPINE)).toBeLessThan(y(BONE.CHEST));
      expect(y(BONE.CHEST)).toBeLessThan(y(BONE.HEAD));
      expect(y(BONE.HAND_R)).toBeLessThan(y(BONE.FORE_R));
      expect(y(BONE.FORE_R)).toBeLessThan(y(BONE.ARM_R));
      // right side is +Z, left mirrors it
      expect(z(BONE.ARM_R)).toBeGreaterThan(0);
      expect(z(BONE.ARM_L)).toBeCloseTo(-z(BONE.ARM_R));
      expect(z(BONE.THIGH_L)).toBeCloseTo(-z(BONE.THIGH_R));
      // 3.0–3.6 heads, legs ~23% of the height, 1.2–1.4 tiles tall
      expect(p.heads).toBeGreaterThanOrEqual(3);
      expect(p.heads).toBeLessThanOrEqual(3.6);
      expect(totalHeight(p)).toBeGreaterThan(1.2);
      expect(totalHeight(p)).toBeLessThan(1.42);
      expect(p.legH / totalHeight(p)).toBeGreaterThan(0.2);
      expect(p.legH / totalHeight(p)).toBeLessThan(0.26);
    });
  }

  it('preset A matches the concept card (1.30 tall, 3.4 heads, chin at 0.87)', () => {
    const p = PROPORTION_PRESETS.A;
    expect(totalHeight(p)).toBeCloseTo(1.3, 1);
    const j = referenceJoints(p);
    expect(j[BONE.HEAD * 3 + 1]).toBeCloseTo(0.864, 2);
  });

  it('every role has a direction entry, garments in the value band, a beard that can contrast', () => {
    expect(ROLE_DIRECTION.length).toBe(ROLE_IDS.length);
    ROLE_DIRECTION.forEach((r, i) => {
      expect(r.role).toBe(i);
      const lt = L(r.tunic);
      expect(lt).toBeGreaterThanOrEqual(30);
      expect(lt).toBeLessThanOrEqual(48);
      // at least one beard colour is >= 15 L* away from the tunic
      expect(Math.max(...BEARD_COLORS.map((b) => Math.abs(L(b) - lt)))).toBeGreaterThanOrEqual(15);
    });
    expect(ROLE_DIRECTION[ROLE.MINER]!.lamp).toBe('helmet');
  });
});

describe('dwarf contract: lab', () => {
  it('zooms give ~220 / ~75 / ~24 px dwarves and the matching LOD', () => {
    const h = totalHeight(PROPORTION_PRESETS.A);
    expect(ZOOMS.izba.pxPerTile * h).toBeGreaterThan(200);
    expect(ZOOMS.grod.pxPerTile * h).toBeCloseTo(75, -1);
    expect(ZOOMS.okolica.pxPerTile * h).toBeCloseTo(24, -0.5);
    for (const z of Object.values(ZOOMS)) expect(lodForPxPerTile(z.pxPerTile)).toBe(z.lod);
    // 960x540 crop at the Gród density: d ~ 17.5 (a 1080p screen at d ~ 35)
    expect(cameraDistance(ZOOMS.grod.pxPerTile, 540)).toBeCloseTo(17.46, 1);
    expect(LOD_TRIANGLE_BUDGET[1]).toBe(400);
    expect(new Set(SHOT_IDS).size).toBe(SHOT_IDS.length);
  });
});
