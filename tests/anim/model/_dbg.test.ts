import { it } from 'vitest';
import { DWARF_VARIANTS, makeSpec } from '../../../src/render/characters/model/index';
import { accentShare, rasterize } from '../../../src/render/characters/model/inspect';
it('dbg', () => {
  const v = DWARF_VARIANTS[0]!;
  for (const r of [0, 1, 2, 3]) {
    const m = v.build(makeSpec(4242, r as 0, 0, v.proportions));
    const row: string[] = [];
    for (const lod of [0, 1] as const) for (const yaw of [0, 40]) row.push(accentShare(rasterize(m.lods[lod], m, { width: 160, height: 180, ppu: 120, yawDeg: yaw, cy: 0.66 })).toFixed(4));
    console.log(r, row.join(' '));
  }
});
