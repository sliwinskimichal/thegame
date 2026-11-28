// Preview sheets of the model variants (W1). Runs only with DWARF_PREVIEW=<dir> [DWARF_VARIANTS=d01,d02]:
//   DWARF_PREVIEW=/tmp/out npx vitest run tests/anim/model/preview.test.ts
// Rows = roles; columns: LOD0 idle (3/4 view), LOD0 side (rest), LOD1 idle at 75 px (x3), LOD2 at 24 px (x6),
// black silhouette at 75 px (x3).
import { mkdirSync } from 'node:fs';
import { describe, it } from 'vitest';
import { createAnimator } from '../../../src/render/anim/index';
import { PROPORTION_PRESETS, totalHeight } from '../../../src/render/characters/direction';
import { DWARF_VARIANTS, makeSpec } from '../../../src/render/characters/model/index';
import { rasterize } from '../../../src/render/characters/model/inspect';
import type { DwarfModel } from '../../../src/render/characters/types';
import { sheet, upscale, writePng, type Img } from './png';

const OUT = process.env.DWARF_PREVIEW;
const ONLY = process.env.DWARF_VARIANTS?.split(',');
const CLIP = process.env.DWARF_CLIP ?? 'idle';
const PHASE = Number(process.env.DWARF_PHASE ?? 0.25);

function posed(model: DwarfModel, clip: string, phase: number): Float32Array {
  const a = createAnimator(model.rig, { viewYawDeg: 0 });
  a.pose(clip, phase, { sim: 0, x: 0, y: 0, facing: 1, edge: null, work: 0, workX: Number.NaN, workY: Number.NaN, carry: 0, danger: 0 });
  return a.bones;
}

describe.skipIf(!OUT)('model preview sheets', () => {
  for (const v of DWARF_VARIANTS) {
    if (ONLY && !ONLY.some((o) => v.id.startsWith(o))) continue;
    it(v.id, () => {
      mkdirSync(OUT!, { recursive: true });
      const H = totalHeight(PROPORTION_PRESETS.A);
      const rows: Img[][] = [];
      for (let role = 0; role < 4; role++) {
        const m = v.build(makeSpec(11 + role, role as 0, 0, v.proportions));
        const bones = posed(m, CLIP, PHASE);
        const pal = m.spec.palette;
        const big = { width: 300, height: 330, ppu: 220, cx: 0, cy: H / 2 + 0.02, palette: pal, outlinePx: 3 };
        const a = rasterize(m.lods[0], m, { ...big, yawDeg: v.viewYawDeg, bones });
        const b = rasterize(m.lods[0], m, { ...big, yawDeg: 0 });
        const g = rasterize(m.lods[1], m, { width: 100, height: 110, ppu: 75 / H, cy: H / 2 + 0.02, yawDeg: v.viewYawDeg, bones, palette: pal, outlinePx: 2 });
        const o = rasterize(m.lods[2], m, { width: 50, height: 55, ppu: 24 / H, cy: H / 2 + 0.02, yawDeg: v.viewYawDeg, bones, palette: pal, outlinePx: 1 });
        const s = rasterize(m.lods[1], m, { width: 100, height: 110, ppu: 75 / H, cy: H / 2 + 0.02, yawDeg: v.viewYawDeg, bones, bg: [255, 255, 255] });
        for (let k = 0; k < s.mask.length; k++) if (s.mask[k]) s.rgba[k * 4] = s.rgba[k * 4 + 1] = s.rgba[k * 4 + 2] = 0;
        rows.push([a, b, upscale(g, 3), upscale(o, 6), upscale(s, 3)]);
      }
      writePng(`${OUT}/${v.id}-${CLIP}.png`, sheet(rows));
    });
  }
});
