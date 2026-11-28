import { it } from 'vitest';
import { DWARF_VARIANTS, makeSpec } from '../../../src/render/characters/model/index';
it('probe', () => {
  for (const v of DWARF_VARIANTS) {
    const row: string[] = [];
    let ms = 0;
    for (let role = 0; role < 4; role++) {
      const t0 = performance.now();
      const m = v.build(makeSpec(7, role as 0, 0, v.proportions));
      ms += performance.now() - t0;
      row.push(m.lods.map((l) => l.triangles).join('/'));
    }
    console.log(v.id.padEnd(16), row.join('  '), (ms / 4).toFixed(1) + 'ms');
  }
});
