/**
 * Mesh assembly (owner: W1): raw part meshes -> one welded skinned BufferGeometry with the contract
 * attributes (MESH_ATTRIBUTES), the inverted-hull outline copy (smooth normals welded by position
 * within the same bone), and the per-part assembly for the instanced-parts mode.
 */
import * as THREE from 'three';
import type { BoneId } from '../../anim/types';
import { SLOT, type PartMesh } from '../types';
import type { Raw } from './shapes';

export interface VertexAttrs {
  slot: number;
  /** Linear RGB (white for variable slots). */
  color: readonly [number, number, number];
  bone: number;
  bone2: number;
  /** Weight of `bone` (rigid parts: 1). */
  weight: number;
  emissive: number;
  layer: number;
}

const _n3 = new THREE.Matrix3();
const _v = new THREE.Vector3();

/** Growable welded mesh with the contract attributes. */
export class MeshBuilder {
  readonly p: number[] = [];
  readonly n: number[] = [];
  readonly c: number[] = [];
  readonly slot: number[] = [];
  readonly bones: number[] = [];
  readonly weight: number[] = [];
  readonly emissive: number[] = [];
  readonly layer: number[] = [];
  readonly index: number[] = [];

  get vertexCount(): number {
    return this.p.length / 3;
  }

  get triangles(): number {
    return this.index.length / 3;
  }

  /** Append a raw mesh transformed by `m` (shape frame -> model space; null = already in model space). */
  add(raw: Raw, m: THREE.Matrix4 | null, a: VertexAttrs, offset?: readonly [number, number, number]): void {
    const base = this.vertexCount;
    let flip = false;
    if (m) {
      _n3.getNormalMatrix(m);
      flip = m.determinant() < 0;
    }
    const ox = offset ? offset[0] : 0;
    const oy = offset ? offset[1] : 0;
    const oz = offset ? offset[2] : 0;
    const col = a.slot === SLOT.FIXED ? a.color : ([1, 1, 1] as const);
    for (let k = 0; k < raw.p.length; k += 3) {
      _v.set(raw.p[k]!, raw.p[k + 1]!, raw.p[k + 2]!);
      if (m) _v.applyMatrix4(m);
      this.p.push(_v.x - ox, _v.y - oy, _v.z - oz);
      _v.set(raw.n[k]!, raw.n[k + 1]!, raw.n[k + 2]!);
      if (m) _v.applyMatrix3(_n3);
      _v.normalize();
      this.n.push(_v.x, _v.y, _v.z);
      this.c.push(col[0], col[1], col[2]);
      this.slot.push(a.slot);
      this.bones.push(a.bone, a.bone2);
      this.weight.push(a.weight);
      this.emissive.push(a.emissive);
      this.layer.push(a.layer);
    }
    for (let t = 0; t < raw.i.length; t += 3) {
      const i0 = raw.i[t]! + base, i1 = raw.i[t + 1]! + base, i2 = raw.i[t + 2]! + base;
      if (flip) this.index.push(i0, i2, i1);
      else this.index.push(i0, i1, i2);
    }
  }

  /** Append one skinned vertex (SDF skin); returns its index. */
  addVertex(x: number, y: number, z: number, nx: number, ny: number, nz: number, a: VertexAttrs): number {
    this.p.push(x, y, z);
    this.n.push(nx, ny, nz);
    const col = a.slot === SLOT.FIXED ? a.color : ([1, 1, 1] as const);
    this.c.push(col[0], col[1], col[2]);
    this.slot.push(a.slot);
    this.bones.push(a.bone, a.bone2);
    this.weight.push(a.weight);
    this.emissive.push(a.emissive);
    this.layer.push(a.layer);
    return this.vertexCount - 1;
  }

  toGeometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('aSlot', new THREE.Float32BufferAttribute(this.slot, 1));
    g.setAttribute('aBones', new THREE.Float32BufferAttribute(this.bones, 2));
    g.setAttribute('aWeight', new THREE.Float32BufferAttribute(this.weight, 1));
    g.setAttribute('aEmissive', new THREE.Float32BufferAttribute(this.emissive, 1));
    g.setAttribute('aLayer', new THREE.Float32BufferAttribute(this.layer, 1));
    const idx = this.vertexCount > 65535 ? new Uint32Array(this.index) : new Uint16Array(this.index);
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
}

/**
 * Inverted-hull outline geometry: the same buffers with normals averaged over every vertex that shares
 * the (quantised) position and the primary bone — flat-shaded corners get one outward direction, so
 * the shell pushed along the normal stays closed.
 */
export function makeHull(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const h = g.clone();
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const nrm = g.getAttribute('normal') as THREE.BufferAttribute;
  const bones = g.getAttribute('aBones') as THREE.BufferAttribute;
  const n = pos.count;
  const keyOf = (i: number) =>
    `${bones.getX(i)}|${Math.round(pos.getX(i) * 1e4)}|${Math.round(pos.getY(i) * 1e4)}|${Math.round(pos.getZ(i) * 1e4)}`;
  const sum = new Map<string, [number, number, number]>();
  const keys: string[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const k = keyOf(i);
    keys[i] = k;
    const s = sum.get(k);
    if (s) {
      s[0] += nrm.getX(i);
      s[1] += nrm.getY(i);
      s[2] += nrm.getZ(i);
    } else sum.set(k, [nrm.getX(i), nrm.getY(i), nrm.getZ(i)]);
  }
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const s = sum.get(keys[i]!)!;
    const l = Math.hypot(s[0], s[1], s[2]);
    if (l < 1e-6) {
      out[i * 3] = nrm.getX(i);
      out[i * 3 + 1] = nrm.getY(i);
      out[i * 3 + 2] = nrm.getZ(i);
    } else {
      out[i * 3] = s[0] / l;
      out[i * 3 + 1] = s[1] / l;
      out[i * 3 + 2] = s[2] / l;
    }
  }
  h.setAttribute('normal', new THREE.BufferAttribute(out, 3));
  return h;
}

/** One rigid part as its own geometry in bone-local space (instanced-parts mode). */
export function partMesh(name: string, bone: BoneId, slot: number, b: MeshBuilder, outline: boolean): PartMesh {
  const geometry = b.toGeometry();
  return { name, bone, geometry, slot, hull: outline ? makeHull(geometry) : null };
}
