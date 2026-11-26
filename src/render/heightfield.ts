/**
 * Z-heightfield mesher ("diorama" geometry): solid rock is the cut plane at
 * z = 0, open cavities are recessed to their depth with a smooth back wall
 * (corner depths averaged over neighbouring cavity tiles), outdoor tiles are
 * open to the sky and the ground strip extends to -groundDepth. Walls are
 * emitted only between open space and rock. Vertices are jittered by a pure
 * function of their position so shared corners stay watertight.
 */
import * as THREE from 'three';
import { CONFIG } from '../config';
import { hash3f } from '../core/rng';
import { M, SOLID } from '../world/materials';
import { CAV, TF, type World } from '../world/world';

export const FACE = { INTERIOR: 1, GRASSY: 2, NATURAL: 4, UNEXPLORED: 8, OUTDOOR: 16, TOP: 32 } as const;

export interface HeightfieldOptions {
  /** XY jitter of corners next to natural caves / elsewhere. */
  jitterNatural?: number;
  jitterDug?: number;
  /** Z jitter of the front plane and of deep vertices. */
  jitterFront?: number;
  jitterDeep?: number;
  groundDepth?: number;
  /** Ground strip subdivisions along Z. */
  groundSegs?: number;
}

const KIND_SOLID = 0;
const KIND_CAVITY = 1;
const KIND_OUTDOOR = 2;

export function buildHeightfield(world: World, x0: number, y0: number, x1: number, y1: number, opt: HeightfieldOptions = {}): THREE.BufferGeometry {
  const jN = opt.jitterNatural ?? 0.16;
  const jD = opt.jitterDug ?? 0.07;
  const jF = opt.jitterFront ?? 0.02;
  const jZ = opt.jitterDeep ?? 0.12;
  const G = opt.groundDepth ?? CONFIG.groundDepth;
  const segsG = opt.groundSegs ?? Math.max(1, Math.round(G));
  const { w, h, mat, bg, flags, depth, cav } = world;
  const RW = x1 - x0 + 2;
  const RH = y1 - y0 + 2;
  const zA = new Float32Array(RW * RH);
  const mA = new Uint8Array(RW * RH);
  const kA = new Uint8Array(RW * RH);
  const fA = new Uint8Array(RW * RH); // 1 natural, 2 unexplored, 4 grassy
  for (let ry = 0; ry < RH; ry++)
    for (let rx = 0; rx < RW; rx++) {
      const x = Math.min(w - 1, Math.max(0, x0 + rx - 1));
      const y = y0 + ry - 1;
      const r = ry * RW + rx;
      if (y < 0) {
        kA[r] = KIND_OUTDOOR;
        zA[r] = -G;
        continue;
      }
      if (y >= h) {
        kA[r] = KIND_SOLID;
        mA[r] = M.BEDROCK;
        continue;
      }
      const i = y * w + x;
      if (cav[i] === CAV.SKY) {
        kA[r] = KIND_OUTDOOR;
        zA[r] = -G;
      } else if (!(flags[i]! & TF.EXPLORED)) {
        kA[r] = KIND_SOLID;
        mA[r] = bg[i] || M.LIMESTONE;
        fA[r] = 2;
      } else if (SOLID[mat[i]!]) {
        kA[r] = KIND_SOLID;
        mA[r] = mat[i]!;
      } else {
        kA[r] = KIND_CAVITY;
        zA[r] = -depth[i]! / 32;
        mA[r] = bg[i]!;
        if (cav[i] === CAV.NATURAL) fA[r] = 1;
      }
    }
  for (let ry = 1; ry < RH; ry++)
    for (let rx = 0; rx < RW; rx++) {
      const r = ry * RW + rx;
      if (kA[r] === KIND_SOLID && (mA[r] === M.SOIL || mA[r] === M.CLAY) && kA[r - RW] === KIND_OUTDOOR) fA[r]! |= 4;
    }
  const at = (x: number, y: number) => (y - y0 + 1) * RW + (x - x0 + 1);
  const seed = world.seed;
  const nat = (X: number, Y: number) => {
    let n = 0;
    for (let dy = -1; dy <= 0; dy++) for (let dx = -1; dx <= 0; dx++) if (fA[at(X + dx, Y + dy)]! & 1) n++;
    return n;
  };
  const J = [0, 0, 0];
  const jitter = (X: number, Y: number, Z: number) => {
    const zk = Math.round(Z * 32);
    const n = nat(X, Y);
    const axy = n > 0 ? jN : jD;
    const az = zk === 0 ? jF : n > 0 ? jZ : jZ * 0.4;
    J[0] = X + (hash3f(X, Y, zk, seed) - 0.5) * 2 * axy;
    J[1] = -Y + (hash3f(X, Y, zk, seed ^ 0x55) - 0.5) * 2 * axy;
    J[2] = Z + (hash3f(X, Y, zk, seed ^ 0xaa) - 0.5) * 2 * az;
  };
  // corner depth of cavities (smooth back walls)
  const CW = x1 - x0 + 1;
  const cz = new Float32Array(CW * (y1 - y0 + 1));
  const cs = new Uint8Array(CW * (y1 - y0 + 1));
  for (let Y = y0; Y <= y1; Y++)
    for (let X = x0; X <= x1; X++) {
      let sum = 0;
      let n = 0;
      let solid = 0;
      for (let dy = -1; dy <= 0; dy++)
        for (let dx = -1; dx <= 0; dx++) {
          const r = at(X + dx, Y + dy);
          if (kA[r] === KIND_CAVITY) {
            sum += zA[r]!;
            n++;
          } else if (kA[r] === KIND_SOLID) solid++;
        }
      const c = (Y - y0) * CW + (X - x0);
      cz[c] = n ? sum / n : 0;
      cs[c] = solid;
    }
  const capZ = (X: number, Y: number) => cz[(Y - y0) * CW + (X - x0)]!;
  const capAO = (X: number, Y: number) => {
    const c = (Y - y0) * CW + (X - x0);
    return Math.max(0.32, 1 - 0.2 * cs[c]! * Math.min(1.2, -cz[c]!));
  };

  const pos: number[] = [];
  const nrm: number[] = [];
  const mf: number[] = [];
  const ao: number[] = [];
  const idx: number[] = [];
  // aEdge (illustrated styles): caps -> (u, v, boundary mask, 1) with u, v the tile-local
  // coordinates (0..1, v grows downwards) and the mask of the 8 neighbours that differ in
  // solidity (L 1, R 2, T 4, B 8, TL 16, TR 32, BL 64, BR 128); walls -> (t, span, lip, 0)
  // with t = 0 at the back and 1 at the front edge, span = depth extent (world units),
  // lip = 1 when the front edge lies in the cut plane.
  const edg: number[] = [];
  const E = [0, 0, 0, 0];
  let nv = 0;
  const vert = (nx: number, ny: number, nz: number, m: number, a: number) => {
    pos.push(J[0]!, J[1]!, J[2]!);
    nrm.push(nx, ny, nz);
    mf.push(m);
    ao.push(a);
    edg.push(E[0]!, E[1]!, E[2]!, E[3]!);
    return nv++;
  };
  const quad = (a: number, b: number, c: number, d: number) => idx.push(a, b, c, a, c, d);

  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const r = at(x, y);
      const kind = kA[r]!;
      const ft = fA[r]!;
      if (kind !== KIND_OUTDOOR) {
        let ff = 0;
        if (kind === KIND_CAVITY) ff |= FACE.INTERIOR;
        if (ft & 1) ff |= FACE.NATURAL;
        if (ft & 2) ff |= FACE.UNEXPLORED;
        if (ft & 4) ff |= FACE.GRASSY;
        const m = mA[r]! + ff * 256;
        const cavity = kind === KIND_CAVITY;
        const solidHere = kind === KIND_SOLID;
        const differs = (rr: number) => ((kA[rr] === KIND_SOLID) !== solidHere ? 1 : 0);
        const bmask =
          differs(r - 1) | (differs(r + 1) << 1) | (differs(r - RW) << 2) | (differs(r + RW) << 3) |
          (differs(r - RW - 1) << 4) | (differs(r - RW + 1) << 5) | (differs(r + RW - 1) << 6) | (differs(r + RW + 1) << 7);
        const corner = (X: number, Y: number) => {
          jitter(X, Y, cavity ? capZ(X, Y) : 0);
          E[0] = X - x;
          E[1] = Y - y;
          E[2] = bmask;
          E[3] = 1;
          return vert(0, 0, 1, m, cavity ? capAO(X, Y) : 1);
        };
        quad(corner(x, y + 1), corner(x + 1, y + 1), corner(x + 1, y), corner(x, y));
      }
      if (kind === KIND_SOLID) continue;
      for (let dir = 0; dir < 4; dir++) {
        const dx = dir === 0 ? -1 : dir === 1 ? 1 : 0;
        const dy = dir === 2 ? -1 : dir === 3 ? 1 : 0;
        const rn = r + dx + dy * RW;
        const kn = kA[rn]!;
        if (kind === KIND_CAVITY && kn !== KIND_SOLID) continue;
        if (kind === KIND_OUTDOOR && kn === KIND_OUTDOOR) continue;
        const fn = fA[rn]!;
        const outdoor = kind === KIND_OUTDOOR;
        let ff = FACE.INTERIOR;
        if (outdoor) ff |= FACE.OUTDOOR;
        if (ft & 1 || fn & 1) ff |= FACE.NATURAL;
        if (fn & 2) ff |= FACE.UNEXPLORED;
        if (dy === 1) ff |= FACE.TOP;
        if (dy === 1 && fn & 4) ff |= FACE.GRASSY;
        const m = mA[rn]! + ff * 256;
        let ax: number, ay: number, bx: number, by: number;
        if (dx === -1) [ax, ay, bx, by] = [x, y + 1, x, y];
        else if (dx === 1) [ax, ay, bx, by] = [x + 1, y, x + 1, y + 1];
        else if (dy === -1) [ax, ay, bx, by] = [x, y, x + 1, y];
        else [ax, ay, bx, by] = [x + 1, y + 1, x, y + 1];
        const dA = outdoor ? -G : capZ(ax, ay);
        const dB = outdoor ? -G : capZ(bx, by);
        const fAz = kn === KIND_CAVITY ? capZ(ax, ay) : 0;
        const fBz = kn === KIND_CAVITY ? capZ(bx, by) : 0;
        const segs = outdoor ? segsG : 1;
        let pa = -1;
        let pb = -1;
        E[2] = kn === KIND_SOLID ? 1 : 0;
        E[3] = 0;
        for (let sI = 0; sI <= segs; sI++) {
          const t = sI / segs;
          let a = outdoor ? 1 : 0.55 + 0.45 * t;
          if (!outdoor && dy !== 0) a *= 0.92;
          E[0] = t;
          E[1] = Math.abs(fAz - dA);
          jitter(ax, ay, dA + (fAz - dA) * t);
          const va = vert(-dx, dy, 0, m, a);
          E[1] = Math.abs(fBz - dB);
          jitter(bx, by, dB + (fBz - dB) * t);
          const vb = vert(-dx, dy, 0, m, a);
          if (sI > 0) quad(pa, pb, vb, va);
          pa = va;
          pb = vb;
        }
      }
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('aMatFlags', new THREE.Float32BufferAttribute(mf, 1));
  geo.setAttribute('aAo', new THREE.Float32BufferAttribute(ao, 1));
  geo.setAttribute('aEdge', new THREE.Float32BufferAttribute(edg, 4));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  return geo;
}
