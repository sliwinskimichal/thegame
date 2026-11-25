/**
 * Terrain chunk mesher.
 *
 * The world is rendered as a Z-heightfield seen from the front: every tile
 * has a front depth zf (solid rock = 0 = the cut plane, a dug tunnel = -1,
 * a natural cave = -1.2..-4, open sky = -slabDepth). Each tile gets a cap
 * quad at its zf, and wherever a neighbour sits further forward, a wall quad
 * spans the step between them, facing into the deeper tile. Tunnels thus
 * read as carved hollows in a diorama-like cross-section.
 *
 * Vertices are jittered by a pure function of their position so shared
 * corners stay watertight, giving natural caves an organic outline while
 * dwarf-dug tunnels stay crisp.
 */
import { CONFIG } from '../config';
import { hash3f } from '../core/rng';
import { M, SOLID } from '../world/materials';
import { TF, type World } from '../world/world';

export const FACE = {
  INTERIOR: 1,
  GRASSY: 2,
  NATURAL: 4,
  UNEXPLORED: 8,
  OUTDOOR: 16,
  TOP: 32, // face normal points up (floor / ground)
} as const;

const KIND_SOLID = 0;
const KIND_CAVITY = 1;
const KIND_OUTDOOR = 2;

export interface ChunkMeshData {
  position: Float32Array;
  normal: Float32Array;
  matFlags: Float32Array;
  ao: Float32Array;
  index: Uint32Array;
}

/** Reusable scratch buffers (the mesher runs on the main thread). */
class Builder {
  pos = new Float32Array(1 << 17);
  nrm = new Float32Array(1 << 17);
  mf = new Float32Array(1 << 16);
  ao = new Float32Array(1 << 16);
  idx = new Uint32Array(1 << 17);
  nv = 0;
  ni = 0;

  reset(): void {
    this.nv = 0;
    this.ni = 0;
  }

  private grow(): void {
    const g = <T extends Float32Array | Uint32Array>(a: T): T => {
      const b = new (a.constructor as { new (n: number): T })(a.length * 2);
      b.set(a);
      return b;
    };
    this.pos = g(this.pos);
    this.nrm = g(this.nrm);
    this.mf = g(this.mf);
    this.ao = g(this.ao);
    this.idx = g(this.idx);
  }

  vertex(x: number, y: number, z: number, nx: number, ny: number, nz: number, mf: number, ao: number): number {
    if ((this.nv + 1) * 3 >= this.pos.length || this.ni + 6 >= this.idx.length) this.grow();
    const v = this.nv++;
    const o = v * 3;
    this.pos[o] = x;
    this.pos[o + 1] = y;
    this.pos[o + 2] = z;
    this.nrm[o] = nx;
    this.nrm[o + 1] = ny;
    this.nrm[o + 2] = nz;
    this.mf[v] = mf;
    this.ao[v] = ao;
    return v;
  }

  quad(a: number, b: number, c: number, d: number): void {
    const I = this.idx;
    const o = this.ni;
    I[o] = a;
    I[o + 1] = b;
    I[o + 2] = c;
    I[o + 3] = a;
    I[o + 4] = c;
    I[o + 5] = d;
    this.ni += 6;
  }

  take(): ChunkMeshData {
    return {
      position: this.pos.slice(0, this.nv * 3),
      normal: this.nrm.slice(0, this.nv * 3),
      matFlags: this.mf.slice(0, this.nv),
      ao: this.ao.slice(0, this.nv),
      index: this.idx.slice(0, this.ni),
    };
  }
}

const B = new Builder();

export function buildTerrainChunk(world: World, cx: number, cy: number): ChunkMeshData {
  const CS = CONFIG.chunk;
  const SLAB = CONFIG.slabDepth;
  const x0 = cx * CS;
  const y0 = cy * CS;
  const x1 = Math.min(world.w, x0 + CS);
  const y1 = Math.min(world.h, y0 + CS);
  // Region with a 1-tile border.
  const RW = x1 - x0 + 2;
  const RH = y1 - y0 + 2;
  const zA = new Float32Array(RW * RH);
  const mA = new Uint8Array(RW * RH);
  const kA = new Uint8Array(RW * RH);
  const fA = new Uint8Array(RW * RH); // 1 natural, 2 unexplored, 4 grassy-top
  const { w, h, mat, bg, flags, depth } = world;

  for (let ry = 0; ry < RH; ry++) {
    for (let rx = 0; rx < RW; rx++) {
      const x = Math.min(w - 1, Math.max(0, x0 + rx - 1));
      const y = y0 + ry - 1;
      const r = ry * RW + rx;
      if (y < 0) {
        kA[r] = KIND_OUTDOOR;
        zA[r] = -SLAB;
        continue;
      }
      if (y >= h) {
        kA[r] = KIND_SOLID;
        zA[r] = 0;
        mA[r] = M.BEDROCK;
        continue;
      }
      const i = y * w + x;
      const f = flags[i]!;
      if (f & TF.OUTDOOR) {
        kA[r] = KIND_OUTDOOR;
        zA[r] = -SLAB;
      } else if (!(f & TF.EXPLORED)) {
        kA[r] = KIND_SOLID;
        zA[r] = 0;
        mA[r] = bg[i] || M.LIMESTONE;
        fA[r] = 2;
      } else if (SOLID[mat[i]!]) {
        kA[r] = KIND_SOLID;
        zA[r] = 0;
        mA[r] = mat[i]!;
      } else {
        kA[r] = KIND_CAVITY;
        zA[r] = -depth[i]! / 32;
        mA[r] = bg[i]!;
        if (f & TF.NATURAL) fA[r] = 1;
      }
    }
  }
  // Grass: soil whose upper neighbour is open sky.
  for (let ry = 1; ry < RH; ry++)
    for (let rx = 0; rx < RW; rx++) {
      const r = ry * RW + rx;
      const m = mA[r];
      if (kA[r] === KIND_SOLID && (m === M.SOIL || m === M.CLAY) && kA[r - RW] === KIND_OUTDOOR) fA[r]! |= 4;
    }

  const at = (x: number, y: number) => (y - y0 + 1) * RW + (x - x0 + 1);

  // Jitter: amplitude grows near natural cave tiles around the corner.
  const seed = world.seed;
  const cornerNatural = (X: number, Y: number): number => {
    let n = 0;
    for (let dy = -1; dy <= 0; dy++)
      for (let dx = -1; dx <= 0; dx++) {
        const r = at(X + dx, Y + dy);
        if (r >= 0 && r < fA.length && fA[r]! & 1) n++;
      }
    return n;
  };
  const jitter = (X: number, Y: number, Z: number, out: Float32Array): void => {
    const zk = Math.round(Z * 32);
    const nat = cornerNatural(X, Y);
    const front = zk === 0;
    const axy = nat > 0 ? 0.16 : 0.07;
    const az = front ? 0.02 : nat > 0 ? 0.14 : 0.05;
    out[0] = X + (hash3f(X, Y, zk, seed) - 0.5) * 2 * axy;
    out[1] = -Y + (hash3f(X, Y, zk, seed ^ 0x55) - 0.5) * 2 * axy;
    out[2] = Z + (hash3f(X, Y, zk, seed ^ 0xaa) - 0.5) * 2 * az;
  };
  const J = new Float32Array(3);

  B.reset();
  const mfOf = (m: number, faceFlags: number) => m + faceFlags * 256;

  // Cavity back walls form one smooth surface: each corner takes the mean
  // depth of the cavity tiles around it, so there are no steps between
  // neighbouring cavity tiles. Walls only separate open space from rock.
  const CW = x1 - x0 + 1;
  const CH = y1 - y0 + 1;
  const cz = new Float32Array(CW * CH);
  const cSolid = new Uint8Array(CW * CH);
  for (let Y = y0; Y <= y1; Y++)
    for (let X = x0; X <= x1; X++) {
      let sum = 0;
      let n = 0;
      let solid = 0;
      for (let dy = -1; dy <= 0; dy++)
        for (let dx = -1; dx <= 0; dx++) {
          const r = at(X + dx, Y + dy);
          const k = kA[r]!;
          if (k === KIND_CAVITY) {
            sum += zA[r]!;
            n++;
          } else if (k === KIND_SOLID) solid++;
        }
      const c = (Y - y0) * CW + (X - x0);
      cz[c] = n > 0 ? sum / n : 0;
      cSolid[c] = solid;
    }
  const capZ = (X: number, Y: number) => cz[(Y - y0) * CW + (X - x0)]!;
  const capAO = (X: number, Y: number) => {
    const c = (Y - y0) * CW + (X - x0);
    const occ = cSolid[c]! * Math.min(1.2, -cz[c]!);
    return Math.max(0.32, 1 - 0.2 * occ);
  };

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const r = at(x, y);
      const kind = kA[r]!;
      const ft = fA[r]!;

      // ---- cap
      if (kind !== KIND_OUTDOOR) {
        let faceFlags = 0;
        if (kind === KIND_CAVITY) faceFlags |= FACE.INTERIOR;
        if (ft & 1) faceFlags |= FACE.NATURAL;
        if (ft & 2) faceFlags |= FACE.UNEXPLORED;
        if (ft & 4) faceFlags |= FACE.GRASSY;
        const mf = mfOf(mA[r]!, faceFlags);
        const cav = kind === KIND_CAVITY;
        const corner = (X: number, Y: number): number => {
          const z = cav ? capZ(X, Y) : 0;
          jitter(X, Y, z, J);
          return B.vertex(J[0]!, J[1]!, J[2]!, 0, 0, 1, mf, cav ? capAO(X, Y) : 1);
        };
        const v0 = corner(x, y + 1);
        const v1 = corner(x + 1, y + 1);
        const v2 = corner(x + 1, y);
        const v3 = corner(x, y);
        B.quad(v0, v1, v2, v3);
      }
      if (kind === KIND_SOLID) continue;

      // ---- walls toward shallower neighbours (open space -> rock / cave)
      for (let dir = 0; dir < 4; dir++) {
        const dx = dir === 0 ? -1 : dir === 1 ? 1 : 0;
        const dy = dir === 2 ? -1 : dir === 3 ? 1 : 0;
        const rn = r + dx + dy * RW;
        const kn = kA[rn]!;
        if (kind === KIND_CAVITY && kn !== KIND_SOLID) continue;
        if (kind === KIND_OUTDOOR && kn === KIND_OUTDOOR) continue;
        const fn = fA[rn]!;
        let faceFlags = FACE.INTERIOR;
        const outdoor = kind === KIND_OUTDOOR;
        if (outdoor) faceFlags |= FACE.OUTDOOR;
        if (ft & 1 || fn & 1) faceFlags |= FACE.NATURAL;
        if (fn & 2) faceFlags |= FACE.UNEXPLORED;
        if (dy === 1) faceFlags |= FACE.TOP;
        if (dy === 1 && fn & 4) faceFlags |= FACE.GRASSY;
        const mf = mfOf(mA[r + dx + dy * RW]!, faceFlags);
        const nx = -dx;
        const ny = dy;
        let ax: number, ay: number, bx: number, by: number;
        if (dx === -1) {
          ax = x; ay = y + 1; bx = x; by = y;
        } else if (dx === 1) {
          ax = x + 1; ay = y; bx = x + 1; by = y + 1;
        } else if (dy === -1) {
          ax = x; ay = y; bx = x + 1; by = y;
        } else {
          ax = x + 1; ay = y + 1; bx = x; by = y + 1;
        }
        const deepA = outdoor ? -SLAB : capZ(ax, ay);
        const deepB = outdoor ? -SLAB : capZ(bx, by);
        const frontA = kn === KIND_CAVITY ? capZ(ax, ay) : 0;
        const frontB = kn === KIND_CAVITY ? capZ(bx, by) : 0;
        const segs = outdoor ? Math.max(1, Math.round(SLAB)) : 1;
        let prevA = -1;
        let prevB = -1;
        for (let s = 0; s <= segs; s++) {
          const t = s / segs;
          const za = deepA + (frontA - deepA) * t;
          const zb = deepB + (frontB - deepB) * t;
          let ao = outdoor ? 1 : 0.55 + 0.45 * t;
          if (!outdoor && dy !== 0) ao *= 0.92;
          jitter(ax, ay, za, J);
          const va = B.vertex(J[0]!, J[1]!, J[2]!, nx, ny, 0, mf, ao);
          jitter(bx, by, zb, J);
          const vb = B.vertex(J[0]!, J[1]!, J[2]!, nx, ny, 0, mf, ao);
          if (s > 0) B.quad(prevA, prevB, vb, va);
          prevA = va;
          prevB = vb;
        }
      }
    }
  }
  return B.take();
}
