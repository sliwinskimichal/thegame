/**
 * QA (F1-5): CPU-side render data - fog of war in the GPU tile texture (WorldTex) and the
 * cross-section mesher (heightfield). Runs in Node (three.js geometry only, no WebGL).
 */
import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { buildArena } from '../../src/lab/arena';
import { buildGallery } from '../../src/lab/gallery';
import { buildHeightfield } from '../../src/render/heightfield';
import { WorldTex } from '../../src/render/worldTex';
import { LightField } from '../../src/world/lightfield';
import { M } from '../../src/world/materials';
import { CAV, TF, World } from '../../src/world/world';

const worlds = (): [string, World][] => [['arena', buildArena().world], ['arena seed 9', buildArena(9).world], ['gallery', buildGallery().world]];

describe('fog of war in the tile texture', () => {
  it('arena and gallery give every unexplored, non-sky tile a back-wall material (bg != 0)', () => {
    for (const [name, w] of worlds()) {
      let n = 0;
      for (let i = 0; i < w.size; i++) if (!(w.flags[i]! & TF.EXPLORED) && w.cav[i] !== CAV.SKY && w.bg[i] === 0) n++;
      expect(n, name).toBe(0);
    }
  });

  it('BUG-005 (fixed): an unexplored ore tile without a back-wall material does not reveal the ore', () => {
    const w = new World(3, 3, 1);
    for (let i = 0; i < 9; i++) {
      w.mat[i] = w.bg[i] = M.GRANITE;
      w.cav[i] = CAV.SOLID;
      w.flags[i] = TF.EXPLORED;
    }
    const c = w.idx(1, 1);
    w.mat[c] = M.GOLD;
    w.bg[c] = 0; // a generator that forgets bg
    w.flags[c] = 0;
    const tiles = new WorldTex(w, new LightField(3, 3)).tiles.image.data as Uint8Array;
    // heightfield falls back to limestone here; the texture must not show the gold either
    expect(tiles[c * 4]).not.toBe(M.GOLD);
    expect(tiles[c * 4]).toBe(M.LIMESTONE); // same fallback as buildHeightfield
  });
});

/** Triangles as sorted strings of rounded vertex data (position, material flags, edge data). */
function tris(g: THREE.BufferGeometry): string[] {
  const p = g.getAttribute('position')!;
  const m = g.getAttribute('aMatFlags')!;
  const e = g.getAttribute('aEdge');
  const v = (i: number) =>
    `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}|${m.getX(i)}|${e ? [e.getX(i), e.getY(i), e.getZ(i), e.getW(i)].map((x) => x.toFixed(3)).join(',') : ''}`;
  const idx = g.getIndex()!.array;
  const out: string[] = [];
  for (let k = 0; k < idx.length; k += 3) out.push(`${v(idx[k]!)} / ${v(idx[k + 1]!)} / ${v(idx[k + 2]!)}`);
  return out.sort();
}

describe('heightfield mesher (E5: no holes, no seams)', () => {
  it('builds the same triangles chunk by chunk as in one piece (watertight chunk seams)', () => {
    for (const [name, w] of worlds()) {
      const full = tris(buildHeightfield(w, 0, 0, w.w, w.h));
      const parts: string[] = [];
      const C = 16;
      for (let y0 = 0; y0 < w.h; y0 += C)
        for (let x0 = 0; x0 < w.w; x0 += C) parts.push(...tris(buildHeightfield(w, x0, y0, Math.min(w.w, x0 + C), Math.min(w.h, y0 + C))));
      expect(parts.sort(), name).toEqual(full);
    }
  });

  it('emits finite positions, in-range indices and one edge record per vertex', () => {
    for (const [name, w] of worlds()) {
      const g = buildHeightfield(w, 0, 0, w.w, w.h);
      const pos = g.getAttribute('position')!;
      expect((pos.array as Float32Array).every(Number.isFinite), name).toBe(true);
      let maxIdx = 0;
      for (const i of g.getIndex()!.array) maxIdx = Math.max(maxIdx, i);
      expect(maxIdx, name).toBeLessThan(pos.count);
      const edge = g.getAttribute('aEdge'); // new in tournament #3 (in progress)
      if (edge) expect(edge.count, name).toBe(pos.count);
    }
  });
});
