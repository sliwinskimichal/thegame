/**
 * Model inspection without a GPU (owner: W1): an orthographic software rasteriser of DwarfMesh
 * geometry (rest pose or posed with model-space bone matrices), used by the model tests (accent share
 * of the side silhouette, silhouette IoU between roles, triangle budgets) and for quick preview
 * sheets in Node. Not used by the game; tree-shaken out of the bundle.
 */
import * as THREE from 'three';
import { BONE_COUNT } from '../../anim/types';
import { SLOT, type DwarfMesh, type DwarfModel, type DwarfPalette } from '../types';
import { linearToSrgb } from './color';
import { linearRgb } from './part';

export interface RasterOpts {
  width: number;
  height: number;
  /** Pixels per model unit. */
  ppu: number;
  /** View yaw toward the camera (deg); 0 = pure side view. Facing mirror: -1. */
  yawDeg: number;
  facing?: 1 | -1;
  /** Model point at the image centre (default: centre of the reference height). */
  cx?: number;
  cy?: number;
  /** Optional posed bones (BONE_COUNT * 16 model-space matrices) + rest joints. */
  bones?: Float32Array | null;
  rest?: Float32Array | null;
  palette?: DwarfPalette | null;
  /** Ink outline width in px (0 = none). */
  outlinePx?: number;
  /** Background sRGB 0..255. */
  bg?: readonly [number, number, number];
}

export interface Raster {
  width: number;
  height: number;
  /** sRGB 8-bit RGBA. */
  rgba: Uint8ClampedArray;
  /** Slot id per pixel (-1 = background). */
  slot: Int8Array;
  /** Coverage mask (1 = figure). */
  mask: Uint8Array;
}

const _m = new THREE.Matrix4();
const _r = new THREE.Matrix4();
const _t = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _n = new THREE.Vector3();
const _n3 = new THREE.Matrix3();

function slotColor(slot: number, pal: DwarfPalette | null | undefined, vc: [number, number, number]): [number, number, number] {
  if (slot === SLOT.FIXED || !pal) return vc;
  const hex = [0, pal.tunic, pal.tunic2, pal.beard, pal.skin, pal.cloth, pal.accent][slot] ?? 0x808080;
  return linearRgb(hex);
}

/** Rasterise one mesh (welded or parts) of a model. */
export function rasterize(mesh: DwarfMesh, model: DwarfModel | null, o: RasterOpts): Raster {
  const W = o.width;
  const H = o.height;
  const rgba = new Uint8ClampedArray(W * H * 4);
  const slotBuf = new Int8Array(W * H).fill(-1);
  const depth = new Float32Array(W * H).fill(-Infinity);
  const lin = new Float32Array(W * H * 3);
  const yaw = (o.yawDeg * Math.PI) / 180;
  const view = new THREE.Matrix4().makeRotationY(-yaw).multiply(new THREE.Matrix4().makeScale(o.facing ?? 1, 1, 1));
  const cx = o.cx ?? 0;
  const cy = o.cy ?? 0.65;
  const light = new THREE.Vector3(0.45, 0.75, 0.5).normalize();
  const geoms: { g: THREE.BufferGeometry; bone: number | null }[] = [];
  if (mesh.mode === 'welded' && mesh.geometry) geoms.push({ g: mesh.geometry, bone: null });
  else if (mesh.parts) for (const p of mesh.parts) geoms.push({ g: p.geometry, bone: p.bone });
  const rest = o.rest ?? model?.rig.rest ?? null;
  // skin matrices: bones[b] * T(-rest[b]) (or identity in the rest pose)
  const skin: THREE.Matrix4[] = [];
  for (let b = 0; b < BONE_COUNT; b++) {
    const m = new THREE.Matrix4();
    if (o.bones && rest) {
      m.fromArray(o.bones, b * 16);
      m.multiply(_t.makeTranslation(-rest[b * 3]!, -rest[b * 3 + 1]!, -rest[b * 3 + 2]!));
    }
    skin.push(m);
  }
  for (const { g, bone } of geoms) {
    const pos = g.getAttribute('position') as THREE.BufferAttribute;
    const nrm = g.getAttribute('normal') as THREE.BufferAttribute;
    const col = g.getAttribute('color') as THREE.BufferAttribute;
    const sl = g.getAttribute('aSlot') as THREE.BufferAttribute;
    const bo = g.getAttribute('aBones') as THREE.BufferAttribute;
    const we = g.getAttribute('aWeight') as THREE.BufferAttribute;
    const em = g.getAttribute('aEmissive') as THREE.BufferAttribute;
    const idx = g.getIndex()!;
    const n = pos.count;
    const sx = new Float32Array(n);
    const sy = new Float32Array(n);
    const sz = new Float32Array(n);
    const sh = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      _v.fromBufferAttribute(pos, i);
      _n.fromBufferAttribute(nrm, i);
      if (bone !== null && rest) {
        // parts mode: geometry is bone-local (rest offset removed)
        _v.x += rest[bone * 3]!;
        _v.y += rest[bone * 3 + 1]!;
        _v.z += rest[bone * 3 + 2]!;
      }
      const b0 = bone ?? bo.getX(i);
      const b1 = bone ?? bo.getY(i);
      const w = bone !== null ? 1 : we.getX(i);
      _m.copy(skin[b0]!);
      if (w < 1) {
        const e = _m.elements;
        const f = skin[b1]!.elements;
        for (let k = 0; k < 16; k++) e[k] = e[k]! * w + f[k]! * (1 - w);
      }
      _r.multiplyMatrices(view, _m);
      _v.applyMatrix4(_r);
      _n3.getNormalMatrix(_r);
      _n.applyMatrix3(_n3).normalize();
      sx[i] = W / 2 + (_v.x - cx) * o.ppu;
      sy[i] = H / 2 - (_v.y - cy) * o.ppu;
      sz[i] = _v.z;
      const l = Math.max(0, _n.dot(light));
      sh[i] = em.getX(i) > 0 ? 1.6 : 0.35 + 0.75 * l;
    }
    for (let t = 0; t < idx.count; t += 3) {
      const a = idx.getX(t), b = idx.getX(t + 1), c = idx.getX(t + 2);
      const area = (sx[b]! - sx[a]!) * (sy[c]! - sy[a]!) - (sy[b]! - sy[a]!) * (sx[c]! - sx[a]!);
      if (area === 0) continue;
      const x0 = Math.max(0, Math.floor(Math.min(sx[a]!, sx[b]!, sx[c]!)));
      const x1 = Math.min(W - 1, Math.ceil(Math.max(sx[a]!, sx[b]!, sx[c]!)));
      const y0 = Math.max(0, Math.floor(Math.min(sy[a]!, sy[b]!, sy[c]!)));
      const y1 = Math.min(H - 1, Math.ceil(Math.max(sy[a]!, sy[b]!, sy[c]!)));
      const s = sl.getX(a);
      const base = slotColor(s, o.palette, [col.getX(a), col.getY(a), col.getZ(a)]);
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const px = x + 0.5, py = y + 0.5;
          const w0 = ((sx[b]! - px) * (sy[c]! - py) - (sy[b]! - py) * (sx[c]! - px)) / area;
          const w1 = ((sx[c]! - px) * (sy[a]! - py) - (sy[c]! - py) * (sx[a]! - px)) / area;
          const w2 = 1 - w0 - w1;
          if (w0 < 0 || w1 < 0 || w2 < 0) continue;
          const z = w0 * sz[a]! + w1 * sz[b]! + w2 * sz[c]!;
          const k = y * W + x;
          if (z <= depth[k]!) continue;
          depth[k] = z;
          slotBuf[k] = s;
          const shade = w0 * sh[a]! + w1 * sh[b]! + w2 * sh[c]!;
          lin[k * 3] = base[0] * shade;
          lin[k * 3 + 1] = base[1] * shade;
          lin[k * 3 + 2] = base[2] * shade;
        }
    }
  }
  const mask = new Uint8Array(W * H);
  for (let k = 0; k < W * H; k++) mask[k] = slotBuf[k]! >= 0 ? 1 : 0;
  const bg = o.bg ?? [236, 230, 218];
  const ow = o.outlinePx ?? 0;
  for (let k = 0; k < W * H; k++) {
    let r = bg[0], g = bg[1], b = bg[2];
    if (mask[k]) {
      r = linearToSrgb(Math.min(1, lin[k * 3]!)) * 255;
      g = linearToSrgb(Math.min(1, lin[k * 3 + 1]!)) * 255;
      b = linearToSrgb(Math.min(1, lin[k * 3 + 2]!)) * 255;
    } else if (ow > 0) {
      const x = k % W, y = (k / W) | 0;
      let hit = false;
      for (let dy = -ow; dy <= ow && !hit; dy++)
        for (let dx = -ow; dx <= ow && !hit; dx++) {
          if (dx * dx + dy * dy > ow * ow) continue;
          const xx = x + dx, yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < W && yy < H && mask[yy * W + xx]) hit = true;
        }
      if (hit) (r = 32), (g = 24), (b = 18);
    }
    rgba[k * 4] = r;
    rgba[k * 4 + 1] = g;
    rgba[k * 4 + 2] = b;
    rgba[k * 4 + 3] = 255;
  }
  return { width: W, height: H, rgba, slot: slotBuf, mask };
}

/** Share of silhouette pixels that show the accent slot. */
export function accentShare(r: Raster): number {
  let fig = 0;
  let acc = 0;
  for (let k = 0; k < r.slot.length; k++) {
    if (r.slot[k]! < 0) continue;
    fig++;
    if (r.slot[k] === SLOT.ACCENT) acc++;
  }
  return fig ? acc / fig : 0;
}

/** Intersection over union of two masks after aligning their centroids (integer shift). */
export function iouAligned(a: Raster, b: Raster): number {
  const cen = (r: Raster) => {
    let sx = 0, sy = 0, n = 0;
    for (let k = 0; k < r.mask.length; k++)
      if (r.mask[k]) {
        sx += k % r.width;
        sy += (k / r.width) | 0;
        n++;
      }
    return [sx / (n || 1), sy / (n || 1)] as const;
  };
  const ca = cen(a);
  const cb = cen(b);
  const dx = Math.round(cb[0] - ca[0]);
  const dy = Math.round(cb[1] - ca[1]);
  let inter = 0, uni = 0;
  for (let y = 0; y < a.height; y++)
    for (let x = 0; x < a.width; x++) {
      const va = a.mask[y * a.width + x]!;
      const xb = x + dx, yb = y + dy;
      const vb = xb >= 0 && yb >= 0 && xb < b.width && yb < b.height ? b.mask[yb * b.width + xb]! : 0;
      if (va || vb) uni++;
      if (va && vb) inter++;
    }
  // pixels of b that fall outside a's frame after the shift
  let nb = 0;
  for (let k = 0; k < b.mask.length; k++) nb += b.mask[k]!;
  let na = 0;
  for (let k = 0; k < a.mask.length; k++) na += a.mask[k]!;
  uni = Math.max(uni, na + nb - inter);
  return uni ? inter / uni : 1;
}

/** Highest point of the rest-pose geometry (model units). */
export function meshTop(mesh: DwarfMesh): number {
  let top = -Infinity;
  const scan = (g: THREE.BufferGeometry, oy: number) => {
    const p = g.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) top = Math.max(top, p.getY(i) + oy);
  };
  if (mesh.geometry) scan(mesh.geometry, 0);
  return top;
}
