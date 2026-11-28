/**
 * Bone texture of the dwarf crowd (owner: W3 "Technical artist", dwarf team).
 *
 * One RGBA32F row per dwarf, three texels per bone: the three rows of the affine skin matrix
 *   S_b = placement * bones[b] * T(-rest[b])
 * (contract: src/render/anim/types.ts — geometry is authored in rest model space, so rigid parts need
 * no inverse bind data). Row k of S_b is texel (3b + k, dwarf). The vertex shader rebuilds the 3x4
 * matrix with three texelFetch calls and blends two bones (aBones / aWeight).
 *
 * Everything here is allocation-free per frame; the texture grows by powers of two and is uploaded
 * with one texSubImage2D (row-sized update ranges would cost one GL call per dwarf).
 */
import * as THREE from 'three';
import { BONE_COUNT } from '../../anim/types';

/** Texels per bone (rows of the 3x4 skin matrix). */
export const TEXELS_PER_BONE = 3;
/** Texture width in texels: one dwarf per row. */
export const BONE_TEX_WIDTH = BONE_COUNT * TEXELS_PER_BONE;
/** Floats per dwarf row. */
export const FLOATS_PER_ROW = BONE_TEX_WIDTH * 4;

/**
 * Write the skin matrices of one dwarf into `out` at float offset `o` (FLOATS_PER_ROW floats):
 * S_b = placement * bones[b] * T(-rest[b]), stored as three row texels (m0j, m1j, m2j for j = 0..3).
 * `placement` is 16 floats, `bones` BONE_COUNT * 16 (column-major, three.js layout), `rest` BONE_COUNT * 3.
 */
export function writeSkinRow(placement: ArrayLike<number>, bones: ArrayLike<number>, rest: ArrayLike<number>, out: Float32Array, o: number): void {
  const p0 = placement[0]!, p1 = placement[1]!, p2 = placement[2]!;
  const p4 = placement[4]!, p5 = placement[5]!, p6 = placement[6]!;
  const p8 = placement[8]!, p9 = placement[9]!, p10 = placement[10]!;
  const p12 = placement[12]!, p13 = placement[13]!, p14 = placement[14]!;
  for (let b = 0; b < BONE_COUNT; b++) {
    const s = b * 16;
    // M = P * B (affine; the bottom rows are 0 0 0 1)
    const b0 = bones[s]!, b1 = bones[s + 1]!, b2 = bones[s + 2]!;
    const b4 = bones[s + 4]!, b5 = bones[s + 5]!, b6 = bones[s + 6]!;
    const b8 = bones[s + 8]!, b9 = bones[s + 9]!, b10 = bones[s + 10]!;
    const b12 = bones[s + 12]!, b13 = bones[s + 13]!, b14 = bones[s + 14]!;
    const m00 = p0 * b0 + p4 * b1 + p8 * b2;
    const m10 = p1 * b0 + p5 * b1 + p9 * b2;
    const m20 = p2 * b0 + p6 * b1 + p10 * b2;
    const m01 = p0 * b4 + p4 * b5 + p8 * b6;
    const m11 = p1 * b4 + p5 * b5 + p9 * b6;
    const m21 = p2 * b4 + p6 * b5 + p10 * b6;
    const m02 = p0 * b8 + p4 * b9 + p8 * b10;
    const m12 = p1 * b8 + p5 * b9 + p9 * b10;
    const m22 = p2 * b8 + p6 * b9 + p10 * b10;
    let t0 = p0 * b12 + p4 * b13 + p8 * b14 + p12;
    let t1 = p1 * b12 + p5 * b13 + p9 * b14 + p13;
    let t2 = p2 * b12 + p6 * b13 + p10 * b14 + p14;
    // * T(-rest): translation picks up -M3x3 * rest
    const rx = rest[b * 3]!, ry = rest[b * 3 + 1]!, rz = rest[b * 3 + 2]!;
    t0 -= m00 * rx + m01 * ry + m02 * rz;
    t1 -= m10 * rx + m11 * ry + m12 * rz;
    t2 -= m20 * rx + m21 * ry + m22 * rz;
    const k = o + b * 12;
    out[k] = m00; out[k + 1] = m01; out[k + 2] = m02; out[k + 3] = t0;
    out[k + 4] = m10; out[k + 5] = m11; out[k + 6] = m12; out[k + 7] = t1;
    out[k + 8] = m20; out[k + 9] = m21; out[k + 10] = m22; out[k + 11] = t2;
  }
}

/** Read back skin matrix b of a row as a THREE.Matrix4 (tests, debugging, CPU skinning for boxes). */
export function readSkinMatrix(data: Float32Array, o: number, b: number, out = new THREE.Matrix4()): THREE.Matrix4 {
  const k = o + b * 12;
  return out.set(
    data[k]!, data[k + 1]!, data[k + 2]!, data[k + 3]!,
    data[k + 4]!, data[k + 5]!, data[k + 6]!, data[k + 7]!,
    data[k + 8]!, data[k + 9]!, data[k + 10]!, data[k + 11]!,
    0, 0, 0, 1,
  );
}

/** Growable RGBA32F data texture, one dwarf per row. */
export class BoneTexture {
  texture: THREE.DataTexture;
  data: Float32Array;
  capacity: number;

  constructor(initialRows = 64) {
    this.capacity = 1;
    while (this.capacity < initialRows) this.capacity *= 2;
    this.data = new Float32Array(FLOATS_PER_ROW * this.capacity);
    this.texture = this.make();
  }

  private make(): THREE.DataTexture {
    const t = new THREE.DataTexture(this.data, BONE_TEX_WIDTH, this.capacity, THREE.RGBAFormat, THREE.FloatType);
    t.magFilter = t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.needsUpdate = true;
    return t;
  }

  /** Make room for `rows` dwarves; returns true when the texture object was replaced (rebind uniforms). */
  ensure(rows: number): boolean {
    if (rows <= this.capacity) return false;
    while (this.capacity < rows) this.capacity *= 2;
    const old = this.data;
    this.data = new Float32Array(FLOATS_PER_ROW * this.capacity);
    this.data.set(old);
    this.texture.dispose();
    this.texture = this.make();
    return true;
  }

  rowOffset(row: number): number {
    return row * FLOATS_PER_ROW;
  }

  upload(): void {
    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.texture.dispose();
  }
}
