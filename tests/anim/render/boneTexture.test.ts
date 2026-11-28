// Bone texture packing (owner: W3): skin matrix = placement * bone * T(-rest), three row texels per bone.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BONE_COUNT } from '../../../src/render/anim/types';
import { BONE_TEX_WIDTH, BoneTexture, FLOATS_PER_ROW, readSkinMatrix, writeSkinRow } from '../../../src/render/characters/render/boneTexture';
import { mirrorSign, mulAffine, paletteLinear } from '../../../src/render/characters/render/crowd';
import { Rng } from '../../../src/core/rng';

function randomAffine(rng: Rng, mirror = false): THREE.Matrix4 {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rng.range(-3, 3), rng.range(-3, 3), rng.range(-3, 3), 'ZYX'));
  const s = rng.range(0.5, 1.5);
  return new THREE.Matrix4().compose(new THREE.Vector3(rng.range(-50, 50), rng.range(-50, 50), rng.range(-2, 2)), q, new THREE.Vector3(mirror ? -s : s, s, s));
}

describe('bone texture', () => {
  it('stores placement * bone * T(-rest) for every bone, as three row texels', () => {
    const rng = new Rng(7);
    for (const mirror of [false, true]) {
      const placement = randomAffine(rng, mirror);
      const bones = new Float32Array(BONE_COUNT * 16);
      const rest = new Float32Array(BONE_COUNT * 3);
      const mats: THREE.Matrix4[] = [];
      for (let b = 0; b < BONE_COUNT; b++) {
        const m = randomAffine(rng);
        m.toArray(bones, b * 16);
        mats.push(m);
        rest.set([rng.range(-1, 1), rng.range(0, 1.4), rng.range(-0.4, 0.4)], b * 3);
      }
      const out = new Float32Array(FLOATS_PER_ROW * 2);
      writeSkinRow(placement.elements, bones, rest, out, FLOATS_PER_ROW);
      for (let b = 0; b < BONE_COUNT; b++) {
        const expected = placement.clone().multiply(mats[b]!).multiply(new THREE.Matrix4().makeTranslation(-rest[b * 3]!, -rest[b * 3 + 1]!, -rest[b * 3 + 2]!));
        const got = readSkinMatrix(out, FLOATS_PER_ROW, b);
        for (let i = 0; i < 16; i++) expect(got.elements[i]).toBeCloseTo(expected.elements[i]!, 3);
        // a rest-space vertex lands where the bone carries it
        const v = new THREE.Vector3(rng.range(-1, 1), rng.range(0, 1.4), 0.1);
        expect(v.clone().applyMatrix4(got).distanceTo(v.clone().applyMatrix4(expected))).toBeLessThan(1e-3);
      }
      expect(mirrorSign(placement.elements)).toBe(mirror ? -1 : 1);
      // the instanced-parts path multiplies the same matrices
      const m = new Float32Array(16);
      mulAffine(placement.elements, bones, 3 * 16, m, 0);
      const ref = placement.clone().multiply(mats[3]!);
      for (let i = 0; i < 16; i++) expect(m[i]).toBeCloseTo(ref.elements[i]!, 3);
    }
  });

  it('rest pose with identity placement gives identity skin matrices (geometry stays in bind space)', () => {
    const rest = new Float32Array(BONE_COUNT * 3).map((_, i) => (i % 3) * 0.1 + i * 0.01);
    const bones = new Float32Array(BONE_COUNT * 16);
    for (let b = 0; b < BONE_COUNT; b++) new THREE.Matrix4().makeTranslation(rest[b * 3]!, rest[b * 3 + 1]!, rest[b * 3 + 2]!).toArray(bones, b * 16);
    const out = new Float32Array(FLOATS_PER_ROW);
    writeSkinRow(new THREE.Matrix4().elements, bones, rest, out, 0);
    for (let b = 0; b < BONE_COUNT; b++) expect(readSkinMatrix(out, 0, b).equals(new THREE.Matrix4())).toBe(true);
  });

  it('grows by powers of two and keeps the rows', () => {
    const t = new BoneTexture(3);
    expect(t.capacity).toBe(4);
    expect(t.texture.image.width).toBe(BONE_TEX_WIDTH);
    t.data[t.rowOffset(2)] = 42;
    expect(t.ensure(4)).toBe(false);
    expect(t.ensure(200)).toBe(true);
    expect(t.capacity).toBe(256);
    expect(t.data[t.rowOffset(2)]).toBe(42);
    expect(t.texture.image.height).toBe(256);
    expect(t.texture.type).toBe(THREE.FloatType);
  });

  it('converts palettes to linear RGB once per palette object', () => {
    const p = { tunic: 0xffffff, tunic2: 0x000000, beard: 0x808080, skin: 0xc89474, cloth: 0x4a3626, accent: 0xa8303a, leather: 0, boot: 0, iron: 0, wood: 0, lamp: 0 };
    const a = paletteLinear(p);
    expect(a[0]).toBeCloseTo(1, 5);
    expect(a[3]).toBeCloseTo(0, 5);
    expect(a[6]).toBeCloseTo(0.2158, 3); // sRGB 128 -> linear
    expect(paletteLinear(p)).toBe(a);
  });
});
