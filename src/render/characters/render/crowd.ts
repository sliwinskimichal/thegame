/**
 * Crowd renderer of the dwarves (owner: W3 "Technical artist", dwarf team) — DwarfCrowdRenderer.
 *
 * Welded meshes ('welded', every technique but d07): one RGBA32F bone texture (row = dwarf, 3 texels
 * per bone, skin = placement * bones * T(-rest)), buckets keyed by the shared mesh of (variant, role,
 * LOD) — and by facing in the MIRROR_SPLIT twin — each drawn with ONE instanced fill call and ONE
 * instanced hull call. Instance data (one interleaved buffer, 22 floats): bone-texture row, mirror
 * sign, lamp on, seed, six variable palette slots in linear RGB.
 * Instanced parts ('parts', d07): one InstancedMesh per part and bucket, instance matrix =
 * placement * bones[part.bone] uploaded every frame — the cost twin of the welded path.
 *
 * LOD comes from the on-screen height of the REFERENCE dwarf at the member's view depth
 * (lodForDwarfPx, contract v2) with hysteresis. Up to MAX_DYN_LIGHTS lamps nearest to the frame centre
 * feed the style's dynamic lights (uDynPos / uDynCol, flicker ±2%). Belt lanterns at LOD2 are drawn
 * as one point-sprite call (contract v2 §9). Per-frame work is allocation-free.
 */
import * as THREE from 'three';
import { BONE, type DwarfAnimator } from '../../anim/types';
import { refHeightTiles, ZOOMS } from '../direction';
import { VAR_SLOTS, type CrowdMember, type DwarfCrowdRenderer, type DwarfMesh, type DwarfPalette, type LodLevel } from '../types';
import { BoneTexture, writeSkinRow } from './boneTexture';
import { lodWithHysteresis, refDwarfPxAtDepth, viewDepth } from './lod';
import { dwarfFillMaterial, dwarfHullMaterial, dwarfUniforms, MODE, type CrowdMode, type DwarfUniforms, type ToneParams, type Uniforms } from './materials';

/** Floats per instance of the welded path: aInst (4) + 6 palette slots (18). */
export const INSTANCE_STRIDE = 22;
const ZOOM_BY_LOD = [ZOOMS.izba, ZOOMS.grod, ZOOMS.okolica] as const;

export interface CrowdLights {
  pos: THREE.Vector4[];
  col: THREE.Vector4[];
  count: THREE.IUniform<number>;
}

export interface CrowdOptions {
  /** Style uniforms shared with the world (light field, fog, dynamic lights, ink, ambient...). */
  style: Uniforms;
  tone?: ToneParams;
  /** 'discard': one draw per bucket, culling in the shader; 'split': buckets per facing, hardware culling. */
  mirror?: 'discard' | 'split';
  /** Multiplier of ZOOMS.hullPx (1 in 1:1 crops of 1080p; H/1080 on a real screen). */
  hullScale?: number;
  /** Dynamic lights to fill with the lamps (null: lamps only emit). */
  lights?: CrowdLights | null;
  maxLights?: number;
  /** Per-instance frustum culling on the CPU (off for cost benchmarks that must draw everyone). */
  cull?: boolean;
  /** Force one LOD for everybody (null = by distance). */
  forceLod?: LodLevel | null;
  /** three.js layer of the crowd meshes (the lab renders masks with the crowd layer only). */
  layer?: number;
  /** Lamp sprite size (px) of belt lanterns at LOD2. */
  spritePx?: number;
}

/** Optional extras a member may carry (lab): lamp state. */
export type CrowdMemberEx = CrowdMember & { lampOn?: boolean };

// ------------------------------------------------------------------------------------------------ helpers
const paletteCache = new WeakMap<DwarfPalette, Float32Array>();
const _col = new THREE.Color();
/** Linear RGB of the 6 variable slots (cached per palette object). */
export function paletteLinear(p: DwarfPalette): Float32Array {
  let a = paletteCache.get(p);
  if (a) return a;
  a = new Float32Array(18);
  const hex = [p.tunic, p.tunic2, p.beard, p.skin, p.cloth, p.accent];
  for (let i = 0; i < 6; i++) {
    _col.setHex(hex[i]!); // linear working space
    a[i * 3] = _col.r;
    a[i * 3 + 1] = _col.g;
    a[i * 3 + 2] = _col.b;
  }
  paletteCache.set(p, a);
  return a;
}

/** Sign of the determinant of the 3x3 part of a column-major 4x4 (−1 = mirrored placement). */
export function mirrorSign(m: ArrayLike<number>): 1 | -1 {
  const det =
    m[0]! * (m[5]! * m[10]! - m[9]! * m[6]!) -
    m[4]! * (m[1]! * m[10]! - m[9]! * m[2]!) +
    m[8]! * (m[1]! * m[6]! - m[5]! * m[2]!);
  return det < 0 ? -1 : 1;
}

function seed01(seed: number): number {
  return (Math.imul(seed | 0, 0x9e3779b1) >>> 0) / 4294967296;
}

/** Colour of a part's slot for the instanced-parts path (white for FIXED: vertex colour as baked). */
function slotTint(slot: number, pal: Float32Array, out: Float32Array, o: number): void {
  const k = VAR_SLOTS.indexOf(slot as (typeof VAR_SLOTS)[number]);
  if (k < 0) {
    out[o] = out[o + 1] = out[o + 2] = 1;
    return;
  }
  out[o] = pal[k * 3]!;
  out[o + 1] = pal[k * 3 + 1]!;
  out[o + 2] = pal[k * 3 + 2]!;
}

function ensureColor(src: THREE.BufferGeometry, dst: THREE.BufferGeometry): void {
  if (!src.getAttribute('color')) {
    const n = src.getAttribute('position')!.count;
    dst.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  }
}

function triangles(g: THREE.BufferGeometry): number {
  return (g.index ? g.index.count : g.getAttribute('position')!.count) / 3;
}

// ------------------------------------------------------------------------------------------------ buckets
interface PartDraw {
  fill: THREE.InstancedMesh;
  hull: THREE.InstancedMesh | null;
  inst: THREE.InstancedBufferAttribute;
  tint: THREE.InstancedBufferAttribute;
  bone: number;
  slot: number;
  fillTris: number;
  hullTris: number;
}

class Bucket {
  count = 0;
  cap = 0;
  /** welded */
  fill: THREE.Mesh | null = null;
  hull: THREE.Mesh | null = null;
  fillGeo: THREE.InstancedBufferGeometry | null = null;
  hullGeo: THREE.InstancedBufferGeometry | null = null;
  buffer: THREE.InstancedInterleavedBuffer | null = null;
  fillTris = 0;
  hullTris = 0;
  /** parts */
  parts: PartDraw[] = [];

  constructor(
    readonly mesh: DwarfMesh,
    readonly facing: 0 | 1 | -1,
  ) {}
}

// ------------------------------------------------------------------------------------------------ renderer
export class CrowdRenderer implements DwarfCrowdRenderer {
  readonly group = new THREE.Group();
  readonly stats = { drawCalls: 0, triangles: 0, instances: 0, uploadMs: 0 };
  readonly uniforms: DwarfUniforms;
  readonly bones = new BoneTexture(64);
  private readonly opts: Required<Omit<CrowdOptions, 'tone' | 'lights' | 'forceLod'>> & { lights: CrowdLights | null; forceLod: LodLevel | null };
  private readonly buckets = new Map<DwarfMesh, Bucket[]>();
  private readonly order: Bucket[] = [];
  private readonly prevLod = new WeakMap<DwarfAnimator, number>();
  private fillMats: THREE.ShaderMaterial[] = [];
  private hullMats: THREE.ShaderMaterial[][] = [];
  private partsFill: THREE.ShaderMaterial[] = [];
  private partsHull: THREE.ShaderMaterial[][] = [];
  private mode: CrowdMode = 'color';
  private time = 0;
  /** Largest member count seen: buckets are sized for it, so they never grow in the middle of a sync. */
  private maxMembers = 0;
  // lamps
  private readonly lampTmp = new Float32Array(3);
  private lampX = new Float32Array(64);
  private lampY = new Float32Array(64);
  private lampZ = new Float32Array(64);
  private lampD = new Float32Array(64);
  private lampI = new Int32Array(64);
  private lampM: CrowdMemberEx[] = [];
  // LOD2 belt-lantern sprites
  private sprites: THREE.Points;
  private spritePos: THREE.BufferAttribute;
  private spriteCol: THREE.BufferAttribute;
  private readonly frustum = new THREE.Frustum();
  private readonly projView = new THREE.Matrix4();
  private readonly sphere = new THREE.Sphere();
  private readonly camDir = new THREE.Vector3();

  constructor(options: CrowdOptions) {
    this.opts = {
      style: options.style,
      mirror: options.mirror ?? 'discard',
      hullScale: options.hullScale ?? 1,
      lights: options.lights ?? null,
      maxLights: options.maxLights ?? 12,
      cull: options.cull ?? true,
      forceLod: options.forceLod ?? null,
      layer: options.layer ?? 0,
      spritePx: options.spritePx ?? 3.5,
    };
    this.uniforms = dwarfUniforms(options.style, options.tone);
    this.uniforms.uBoneTex.value = this.bones.texture;
    const split = this.opts.mirror === 'split';
    const style = options.style;
    // [0] facing +1 (or both), [1] facing -1 (split only)
    const sidesFill = split ? [THREE.FrontSide, THREE.BackSide] : [THREE.DoubleSide];
    const sidesHull = split ? [THREE.BackSide, THREE.FrontSide] : [THREE.DoubleSide];
    for (const parts of [false, true]) {
      const fills = sidesFill.map((side) => dwarfFillMaterial(style, this.uniforms, { parts, split, side }));
      const hulls = sidesHull.map((side) => ZOOM_BY_LOD.map((z) => dwarfHullMaterial(style, this.uniforms, z.hullPx * this.opts.hullScale, { parts, split, side })));
      if (parts) {
        this.partsFill = fills;
        this.partsHull = hulls;
      } else {
        this.fillMats = fills;
        this.hullMats = hulls;
      }
    }
    // sprites
    const sg = new THREE.BufferGeometry();
    this.spritePos = new THREE.BufferAttribute(new Float32Array(256 * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.spriteCol = new THREE.BufferAttribute(new Float32Array(256 * 3), 3).setUsage(THREE.DynamicDrawUsage);
    sg.setAttribute('position', this.spritePos);
    sg.setAttribute('color', this.spriteCol);
    sg.setDrawRange(0, 0);
    this.sprites = new THREE.Points(
      sg,
      new THREE.ShaderMaterial({
        uniforms: { uSize: { value: this.opts.spritePx }, uMode: this.uniforms.uMode, uGlow: { value: 2.2 } },
        vertexShader: /* glsl */ `attribute vec3 color; varying vec3 vC; uniform float uSize;
          void main() { vC = color; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); gl_PointSize = uSize; }`,
        fragmentShader: /* glsl */ `varying vec3 vC; uniform int uMode; uniform float uGlow;
          void main() {
            vec2 q = gl_PointCoord - 0.5;
            if (dot(q, q) > 0.25) discard;
            if (uMode == 2) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
            if (uMode == 1) { gl_FragColor = vec4(1.0); return; }
            gl_FragColor = vec4(vC * uGlow, 1.0);
          }`,
      }),
    );
    this.sprites.frustumCulled = false;
    this.sprites.layers.set(this.opts.layer);
    this.group.add(this.sprites);
  }

  /** Deterministic clock for lamp flicker (lab shots use a fixed time). */
  setTime(t: number): void {
    this.time = t;
  }

  setMode(mode: 'color' | 'mask' | 'sil'): void {
    this.mode = mode;
    this.uniforms.uMode.value = MODE[mode];
    for (const b of this.order) {
      if (b.hull) b.hull.visible = mode !== 'sil' && b.count > 0;
      for (const p of b.parts) if (p.hull) p.hull.visible = mode !== 'sil' && b.count > 0;
    }
  }

  setForceLod(lod: LodLevel | null): void {
    this.opts.forceLod = lod;
  }

  setCull(on: boolean): void {
    this.opts.cull = on;
  }

  // ------------------------------------------------------------------------------------------------ buckets
  private bucketFor(mesh: DwarfMesh, facing: 1 | -1): Bucket {
    let list = this.buckets.get(mesh);
    if (!list) {
      list = [];
      this.buckets.set(mesh, list);
    }
    const f: 0 | 1 | -1 = this.opts.mirror === 'split' ? facing : 0;
    let b = list.find((x) => x.facing === f);
    if (!b) {
      b = new Bucket(mesh, f);
      list.push(b);
      this.order.push(b);
    }
    return b;
  }

  private sideIndex(b: Bucket): number {
    return b.facing === -1 ? 1 : 0;
  }

  /** (Re)build the GPU objects of a bucket for `cap` instances. */
  private allocate(b: Bucket, cap: number): void {
    let c = Math.max(4, b.cap);
    while (c < cap) c *= 2;
    if (c === b.cap) return;
    b.cap = c;
    const m = b.mesh;
    const side = this.sideIndex(b);
    if (m.mode === 'welded' && m.geometry) {
      b.buffer = new THREE.InstancedInterleavedBuffer(new Float32Array(c * INSTANCE_STRIDE), INSTANCE_STRIDE, 1).setUsage(THREE.DynamicDrawUsage);
      const attach = (g: THREE.InstancedBufferGeometry, src: THREE.BufferGeometry) => {
        for (const [name, a] of Object.entries(src.attributes)) g.setAttribute(name, a);
        ensureColor(src, g);
        g.setIndex(src.index);
        g.setAttribute('aInst', new THREE.InterleavedBufferAttribute(b.buffer!, 4, 0));
        for (let k = 0; k < 6; k++) g.setAttribute(`aPal${k + 1}`, new THREE.InterleavedBufferAttribute(b.buffer!, 3, 4 + k * 3));
        g.instanceCount = 0;
      };
      if (b.fill) {
        this.group.remove(b.fill);
        b.fillGeo!.dispose();
      }
      b.fillGeo = new THREE.InstancedBufferGeometry();
      attach(b.fillGeo, m.geometry);
      b.fill = new THREE.Mesh(b.fillGeo, this.fillMats[side]!);
      b.fill.frustumCulled = false;
      b.fill.layers.set(this.opts.layer);
      this.group.add(b.fill);
      b.fillTris = triangles(m.geometry);
      if (m.hull) {
        if (b.hull) {
          this.group.remove(b.hull);
          b.hullGeo!.dispose();
        }
        b.hullGeo = new THREE.InstancedBufferGeometry();
        attach(b.hullGeo, m.hull);
        b.hull = new THREE.Mesh(b.hullGeo, this.hullMats[side]![m.lod]!);
        b.hull.frustumCulled = false;
        b.hull.layers.set(this.opts.layer);
        this.group.add(b.hull);
        b.hullTris = triangles(m.hull);
      }
    } else if (m.mode === 'parts' && m.parts) {
      for (const p of b.parts) {
        this.group.remove(p.fill);
        p.fill.dispose();
        if (p.hull) {
          this.group.remove(p.hull);
          p.hull.dispose();
        }
      }
      b.parts = m.parts.map((pm) => {
        const inst = new THREE.InstancedBufferAttribute(new Float32Array(c * 4), 4).setUsage(THREE.DynamicDrawUsage);
        const tint = new THREE.InstancedBufferAttribute(new Float32Array(c * 3), 3).setUsage(THREE.DynamicDrawUsage);
        const mk = (src: THREE.BufferGeometry) => {
          const g = new THREE.BufferGeometry();
          for (const [name, a] of Object.entries(src.attributes)) g.setAttribute(name, a);
          ensureColor(src, g);
          g.setIndex(src.index);
          g.setAttribute('aInst', inst);
          g.setAttribute('aTint', tint);
          return g;
        };
        const fill = new THREE.InstancedMesh(mk(pm.geometry), this.partsFill[side]!, c);
        fill.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        fill.frustumCulled = false;
        fill.count = 0;
        fill.layers.set(this.opts.layer);
        this.group.add(fill);
        let hull: THREE.InstancedMesh | null = null;
        if (pm.hull) {
          hull = new THREE.InstancedMesh(mk(pm.hull), this.partsHull[side]![m.lod]!, c);
          hull.instanceMatrix = fill.instanceMatrix; // same matrices, one upload
          hull.frustumCulled = false;
          hull.count = 0;
          hull.layers.set(this.opts.layer);
          this.group.add(hull);
        }
        return { fill, hull, inst, tint, bone: pm.bone, slot: pm.slot, fillTris: triangles(pm.geometry), hullTris: pm.hull ? triangles(pm.hull) : 0 };
      });
    }
  }

  // ------------------------------------------------------------------------------------------------ sync
  sync(members: readonly CrowdMember[], camera: THREE.PerspectiveCamera, viewportH: number): void {
    const t0 = performance.now();
    camera.updateMatrixWorld();
    if (this.opts.cull) {
      this.projView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      this.frustum.setFromProjectionMatrix(this.projView);
    }
    for (const b of this.order) b.count = 0;
    const n = members.length;
    if (n > this.maxMembers) {
      this.maxMembers = n;
      for (const b of this.order) this.allocate(b, n);
    }
    if (this.bones.ensure(n)) this.uniforms.uBoneTex.value = this.bones.texture;
    if (this.lampX.length < n) this.growLamps(n);
    const refH = refHeightTiles();
    const cullR = refH * 1.6;
    let row = 0;
    let lamps = 0;
    let spriteN = 0;
    let welded = false;
    const spritePos = this.spritePos.array as Float32Array;
    const spriteCol = this.spriteCol.array as Float32Array;
    for (let i = 0; i < n; i++) {
      const mem = members[i] as CrowdMemberEx;
      if (!mem.visible) continue;
      const pl = mem.anim.placement;
      const x = pl[12]!, y = pl[13]!, z = pl[14]!;
      if (this.opts.cull) {
        this.sphere.center.set(x, y + refH * 0.5, z);
        this.sphere.radius = cullR;
        if (!this.frustum.intersectsSphere(this.sphere)) continue;
      }
      let lod: LodLevel;
      if (this.opts.forceLod !== null) lod = this.opts.forceLod;
      else {
        const px = refDwarfPxAtDepth(camera.fov, viewportH, viewDepth(camera, x, y + refH * 0.5, z));
        lod = lodWithHysteresis(px, this.prevLod.get(mem.anim) ?? -1);
        this.prevLod.set(mem.anim, lod);
      }
      const model = mem.model;
      const mesh = model.lods[lod];
      const facing = mirrorSign(pl);
      const b = this.bucketFor(mesh, facing);
      if (b.cap === 0) this.allocate(b, this.maxMembers);
      const pal = paletteLinear(model.spec.palette);
      const lampOn = mem.lampOn !== false;
      const sd = seed01(model.spec.seed);
      if (mesh.mode === 'welded') {
        welded = true;
        writeSkinRow(pl, mem.anim.bones, model.rig.rest, this.bones.data, this.bones.rowOffset(row));
        const a = b.buffer!.array as Float32Array;
        const o = b.count * INSTANCE_STRIDE;
        a[o] = row;
        a[o + 1] = facing;
        a[o + 2] = lampOn ? 1 : 0;
        a[o + 3] = sd;
        a.set(pal, o + 4);
        row++;
      } else {
        const bones = mem.anim.bones;
        const k = b.count;
        for (const pd of b.parts) {
          const m = pd.fill.instanceMatrix.array as Float32Array;
          mulAffine(pl, bones, pd.bone * 16, m, k * 16);
          const ia = pd.inst.array as Float32Array;
          ia[k * 4] = 0;
          ia[k * 4 + 1] = facing;
          ia[k * 4 + 2] = lampOn ? 1 : 0;
          ia[k * 4 + 3] = sd;
          slotTint(pd.slot, pal, pd.tint.array as Float32Array, k * 3);
        }
      }
      b.count++;
      // lamps: dynamic lights and, for belt lanterns at LOD2, a sprite
      if (lampOn && mem.anim.lampWorld(this.lampTmp, 0)) {
        this.lampX[lamps] = this.lampTmp[0]!;
        this.lampY[lamps] = this.lampTmp[1]!;
        this.lampZ[lamps] = this.lampTmp[2]!;
        this.lampM[lamps] = mem;
        lamps++;
        if (lod === 2 && model.rig.lamp.bone !== BONE.HEAD && spriteN < 256) {
          spritePos[spriteN * 3] = this.lampTmp[0]!;
          spritePos[spriteN * 3 + 1] = this.lampTmp[1]!;
          spritePos[spriteN * 3 + 2] = this.lampTmp[2]! + 0.05;
          const c = model.rig.lamp.color;
          spriteCol[spriteN * 3] = c[0];
          spriteCol[spriteN * 3 + 1] = c[1];
          spriteCol[spriteN * 3 + 2] = c[2];
          spriteN++;
        }
      }
    }
    // upload and stats
    let draws = 0;
    let tris = 0;
    let inst = 0;
    const hullOn = this.mode !== 'sil';
    for (const b of this.order) {
      const c = b.count;
      inst += c;
      if (b.fillGeo) {
        b.fillGeo.instanceCount = c;
        b.fill!.visible = c > 0;
        if (b.hullGeo) {
          b.hullGeo.instanceCount = c;
          b.hull!.visible = c > 0 && hullOn;
        }
        if (c > 0) {
          b.buffer!.clearUpdateRanges();
          b.buffer!.addUpdateRange(0, c * INSTANCE_STRIDE);
          b.buffer!.needsUpdate = true;
          draws += 1 + (b.hull && hullOn ? 1 : 0);
          tris += c * (b.fillTris + (b.hull && hullOn ? b.hullTris : 0));
        }
      }
      for (const pd of b.parts) {
        pd.fill.count = c;
        pd.fill.visible = c > 0;
        if (pd.hull) {
          pd.hull.count = c;
          pd.hull.visible = c > 0 && hullOn;
        }
        if (c > 0) {
          pd.fill.instanceMatrix.clearUpdateRanges();
          pd.fill.instanceMatrix.addUpdateRange(0, c * 16);
          pd.fill.instanceMatrix.needsUpdate = true;
          pd.inst.clearUpdateRanges();
          pd.inst.addUpdateRange(0, c * 4);
          pd.inst.needsUpdate = true;
          pd.tint.clearUpdateRanges();
          pd.tint.addUpdateRange(0, c * 3);
          pd.tint.needsUpdate = true;
          draws += 1 + (pd.hull && hullOn ? 1 : 0);
          tris += c * (pd.fillTris + (pd.hull && hullOn ? pd.hullTris : 0));
        }
      }
    }
    if (welded) this.bones.upload();
    this.sprites.geometry.setDrawRange(0, spriteN);
    this.sprites.visible = spriteN > 0;
    if (spriteN > 0) {
      this.spritePos.clearUpdateRanges();
      this.spritePos.addUpdateRange(0, spriteN * 3);
      this.spritePos.needsUpdate = true;
      this.spriteCol.clearUpdateRanges();
      this.spriteCol.addUpdateRange(0, spriteN * 3);
      this.spriteCol.needsUpdate = true;
      draws++;
    }
    this.pickLights(lamps, camera);
    this.stats.drawCalls = draws;
    this.stats.triangles = tris;
    this.stats.instances = inst;
    this.stats.uploadMs = performance.now() - t0;
  }

  private growLamps(n: number): void {
    let c = this.lampX.length;
    while (c < n) c *= 2;
    this.lampX = new Float32Array(c);
    this.lampY = new Float32Array(c);
    this.lampZ = new Float32Array(c);
    this.lampD = new Float32Array(c);
    this.lampI = new Int32Array(c);
  }

  /** The lamps nearest to the frame centre become the style's dynamic lights (partial selection sort). */
  private pickLights(n: number, camera: THREE.PerspectiveCamera): void {
    const L = this.opts.lights;
    if (!L) return;
    camera.getWorldDirection(this.camDir);
    const zPlane = -0.45;
    const t = Math.abs(this.camDir.z) > 1e-4 ? (zPlane - camera.position.z) / this.camDir.z : 0;
    const cx = camera.position.x + this.camDir.x * t;
    const cy = camera.position.y + this.camDir.y * t;
    for (let i = 0; i < n; i++) {
      const dx = this.lampX[i]! - cx;
      const dy = this.lampY[i]! - cy;
      this.lampD[i] = dx * dx + dy * dy;
      this.lampI[i] = i;
    }
    const k = Math.min(n, this.opts.maxLights, L.pos.length);
    for (let a = 0; a < k; a++) {
      let best = a;
      for (let j = a + 1; j < n; j++) if (this.lampD[this.lampI[j]!]! < this.lampD[this.lampI[best]!]!) best = j;
      const tmp = this.lampI[a]!;
      this.lampI[a] = this.lampI[best]!;
      this.lampI[best] = tmp;
      const i = this.lampI[a]!;
      const lamp = this.lampM[i]!.model.rig.lamp;
      const sd = seed01(this.lampM[i]!.model.spec.seed);
      const fl = 1 + this.uniforms.uFlicker.value * Math.sin(this.time * 11 + sd * 40);
      L.pos[a]!.set(this.lampX[i]!, this.lampY[i]!, this.lampZ[i]!, lamp.radius);
      L.col[a]!.set(lamp.color[0] * fl, lamp.color[1] * fl, lamp.color[2] * fl, 0);
    }
    L.count.value = k;
  }

  dispose(): void {
    for (const b of this.order) {
      b.fillGeo?.dispose();
      b.hullGeo?.dispose();
      for (const p of b.parts) {
        p.fill.dispose();
        p.hull?.dispose();
      }
    }
    for (const m of [...this.fillMats, ...this.partsFill, ...this.hullMats.flat(), ...this.partsHull.flat()]) m.dispose();
    this.sprites.geometry.dispose();
    (this.sprites.material as THREE.Material).dispose();
    this.bones.dispose();
    this.group.clear();
    this.buckets.clear();
    this.order.length = 0;
  }

  /** Number of buckets in use (tests). */
  get bucketCount(): number {
    let k = 0;
    for (const b of this.order) if (b.count > 0) k++;
    return k;
  }
}

/** out[o..o+15] = a (16 floats) * b[bo..bo+15], affine column-major matrices (no allocation). */
export function mulAffine(a: ArrayLike<number>, b: ArrayLike<number>, bo: number, out: Float32Array, o: number): void {
  for (let c = 0; c < 4; c++) {
    const b0 = b[bo + c * 4]!, b1 = b[bo + c * 4 + 1]!, b2 = b[bo + c * 4 + 2]!, b3 = b[bo + c * 4 + 3]!;
    out[o + c * 4] = a[0]! * b0 + a[4]! * b1 + a[8]! * b2 + a[12]! * b3;
    out[o + c * 4 + 1] = a[1]! * b0 + a[5]! * b1 + a[9]! * b2 + a[13]! * b3;
    out[o + c * 4 + 2] = a[2]! * b0 + a[6]! * b1 + a[10]! * b2 + a[14]! * b3;
    out[o + c * 4 + 3] = a[3]! * b0 + a[7]! * b1 + a[11]! * b2 + a[15]! * b3;
  }
}

