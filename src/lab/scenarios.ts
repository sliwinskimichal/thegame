import { BIOMES } from '../content/biomes';
import { BLOCK_SIZE, blockOrigin, GALLERY_H, GALLERY_W } from './gallery';

/** Fixed camera scenarios: every variant is judged on exactly these shots. */

export interface Scenario {
  id: string;
  namePl: string;
  /** Look-at point (world units: x right, y up). */
  x: number;
  y: number;
  /** Camera distance from the cut plane. */
  d: number;
  /** Time of day 0..1. */
  t: number;
}

export const SCENARIOS: readonly Scenario[] = [
  { id: 'overview', namePl: 'Cały przekrój', x: 32, y: -23, d: 92, t: 0.42 },
  { id: 'meadow', namePl: 'Łąka i wejście szybu', x: 18, y: -7, d: 24, t: 0.4 },
  { id: 'tunnel_night', namePl: 'Tunel nocą (pochodnie)', x: 25, y: -17.5, d: 16, t: 0.0 },
  { id: 'cave', namePl: 'Jaskinia z wodą', x: 48, y: -30, d: 24, t: 0.42 },
  { id: 'fungal', namePl: 'Grota grzybowa', x: 24, y: -38, d: 24, t: 0.42 },
  { id: 'lava', namePl: 'Kieszeń lawy', x: 51, y: -39.5, d: 22, t: 0.42 },
  { id: 'dusk', namePl: 'Zmierzch nad grodem', x: 34, y: -11, d: 42, t: 0.74 },
  { id: 'fog', namePl: 'Granica nieznanego', x: 12, y: -31, d: 28, t: 0.42 },
];

/** Material gallery shots (see gallery.ts): the whole wall by day, then every biome block by torchlight. */
export const GALLERY_SCENARIOS: readonly Scenario[] = [
  { id: 'g_all', namePl: 'Galeria — całość', x: GALLERY_W / 2, y: -GALLERY_H / 2, d: 160, t: 0.42 },
  ...BIOMES.map((b, k) => {
    const o = blockOrigin(k);
    return { id: `g_${b.id}`, namePl: `Galeria — ${b.namePl}`, x: o.x + BLOCK_SIZE.w / 2, y: -(o.y + BLOCK_SIZE.h / 2), d: 50, t: 0.0 };
  }),
];
