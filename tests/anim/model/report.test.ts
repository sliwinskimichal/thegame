// W1 model report (runs only with DWARF_REPORT=1): a markdown table per variant —
// triangles per LOD (mean / max over the 4 roles), build time, role silhouette distinctness at 75 and 24 px
// (1 − IoU of black silhouettes, centroids aligned, W2 idle pose, variant yaw; min pair), token fidelity
// (IoU of the LOD2 token vs the LOD1 silhouette at 24 px) and the accent share (max over roles, LOD1).
//   DWARF_REPORT=1 npx vitest run tests/anim/model/report.test.ts --silent=false
import { describe, it } from 'vitest';
import { createAnimator } from '../../../src/render/anim/index';
import { PROPORTION_PRESETS, totalHeight } from '../../../src/render/characters/direction';
import { DWARF_VARIANTS, makeSpec } from '../../../src/render/characters/model/index';
import { accentShare, iouAligned, rasterize, type Raster } from '../../../src/render/characters/model/inspect';
import type { DwarfModel } from '../../../src/render/characters/types';

const H = totalHeight(PROPORTION_PRESETS.A);

function idle(m: DwarfModel): Float32Array {
  const a = createAnimator(m.rig, { viewYawDeg: 0 });
  a.pose('idle', 0.25, { sim: 0, x: 0, y: 0, facing: 1, edge: null, work: 0, workX: Number.NaN, workY: Number.NaN, carry: 0, danger: 0 });
  return a.bones;
}

function sil(m: DwarfModel, lod: 0 | 1 | 2, px: number, yaw: number, bones: Float32Array): Raster {
  const ppu = px / H;
  const size = Math.ceil(px * 1.9);
  return rasterize(m.lods[lod], m, { width: size, height: size, ppu, yawDeg: yaw, cy: H / 2, bones });
}

function minPair(rs: Raster[]): { min: number; mean: number } {
  let min = 1;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < rs.length; i++)
    for (let j = i + 1; j < rs.length; j++) {
      const d = 1 - iouAligned(rs[i]!, rs[j]!);
      min = Math.min(min, d);
      sum += d;
      n++;
    }
  return { min, mean: sum / n };
}

describe.skipIf(!process.env.DWARF_REPORT)('model report', () => {
  it('table', () => {
    const rows: string[] = [
      '| wariant | LOD0 śr./maks. | LOD1 śr./maks. | LOD2 śr./maks. | budowa [ms/rola] | 1−IoU 75 px min / śr. | 1−IoU 24 px min / śr. | wierność żetonu 24 px | akcent maks. |',
      '|---|---|---|---|---|---|---|---|---|',
    ];
    for (const v of DWARF_VARIANTS) {
      const t0 = performance.now();
      const ms = [0, 1, 2, 3].map((r) => v.build(makeSpec(11 + r, r as 0, 0, v.proportions)));
      const buildMs = (performance.now() - t0) / 4;
      const tri = [0, 1, 2].map((l) => ms.map((m) => m.lods[l]!.triangles));
      const fmt = (a: number[]) => `${Math.round(a.reduce((s, x) => s + x, 0) / a.length)} / ${Math.max(...a)}`;
      const bones = ms.map(idle);
      const s75 = ms.map((m, i) => sil(m, 1, 75, v.viewYawDeg, bones[i]!));
      const s24 = ms.map((m, i) => sil(m, 2, 24, v.viewYawDeg, bones[i]!));
      const s24l1 = ms.map((m, i) => sil(m, 1, 24, v.viewYawDeg, bones[i]!));
      const p75 = minPair(s75);
      const p24 = minPair(s24);
      const fid = s24.reduce((s, r, i) => s + iouAligned(r, s24l1[i]!), 0) / 4;
      const acc = Math.max(...ms.map((m, i) => accentShare(rasterize(m.lods[1], m, { width: 200, height: 200, ppu: 120, yawDeg: v.viewYawDeg, cy: H / 2, bones: bones[i]! }))));
      rows.push(
        `| ${v.id} | ${fmt(tri[0]!)} | ${fmt(tri[1]!)} | ${fmt(tri[2]!)} | ${buildMs.toFixed(1)} | ${p75.min.toFixed(2)} / ${p75.mean.toFixed(2)} | ${p24.min.toFixed(2)} / ${p24.mean.toFixed(2)} | ${fid.toFixed(2)} | ${(acc * 100).toFixed(1)}% |`,
      );
    }
    console.log(rows.join('\n'));
  });
});
