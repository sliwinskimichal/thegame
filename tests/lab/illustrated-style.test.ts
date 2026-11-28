/** The game's illustrated style (tournament #3 winner) is data and stays equal to its tournament definition. */
import { describe, expect, it } from 'vitest';
import WINNER from '../../src/render/illustrated-v1.json';
import { I08_DRAWING, illParams, LIGHT_VARIANTS, STYLE_ILLUSTRATED_V1 } from '../../src/lab/styles/illustrated';

describe('illustrated style v1 (data)', () => {
  it('equals i08 drawing + light L16 (L12 with the lava of L14)', () => {
    const l16 = LIGHT_VARIANTS.find((v) => v.id === 'l16-winner')!;
    expect(WINNER.params).toEqual(illParams({ ...I08_DRAWING, ...l16.params }));
    expect(STYLE_ILLUSTRATED_V1.id).toBe('underhearth-illustrated-v1');
  });
  it('keeps the owner choices: L00 light chain, ink over bloom, softer in lava light', () => {
    const p = WINNER.params;
    expect(p.post).toBe('r2b');
    expect([p.bloom, p.bloomRadius, p.bloomThreshold]).toEqual([0.95, 0.8, 0.62]);
    expect(p.inkOver).toBe(1);
    expect(p.lavaInk).toBe(0.6);
  });
});
