/**
 * Lab URL parameters, validated (BUG-001: no silent fallback to another style or
 * scenario; D4: `seed` for every lab world). Pure and DOM-free so it is unit-tested.
 *
 * URL: lab.html?style=<id>&scenario=<id>&world=arena|gallery|tone&seed=<uint>
 * Missing `style` = the first registered style (documented default); a present
 * but unknown `style`, `scenario` or `world`, or a malformed `seed`, is an error.
 */
export const LAB_WORLDS = ['arena', 'gallery', 'tone'] as const;
export type LabWorld = (typeof LAB_WORLDS)[number];

export interface LabParams {
  styleId: string;
  /** null = the world's first scenario (documented default). */
  scenarioId: string | null;
  world: LabWorld;
  /** null = the world's own default seed. */
  seed: number | null;
  errors: string[];
}

export function parseLabParams(search: string, styles: readonly string[], scenarios: Record<LabWorld, readonly string[]>): LabParams {
  const q = new URLSearchParams(search);
  const errors: string[] = [];
  const worldRaw = q.get('world');
  let world: LabWorld = 'arena';
  if (worldRaw !== null) {
    if ((LAB_WORLDS as readonly string[]).includes(worldRaw)) world = worldRaw as LabWorld;
    else errors.push(`nieznany świat "${worldRaw}" (dozwolone: ${LAB_WORLDS.join(', ')})`);
  }
  const styleRaw = q.get('style');
  let styleId = styles[0] ?? '';
  if (styleRaw !== null) {
    if (styles.includes(styleRaw)) styleId = styleRaw;
    else errors.push(`nieznany styl "${styleRaw}"`);
  }
  const scRaw = q.get('scenario');
  let scenarioId: string | null = null;
  if (scRaw !== null) {
    if (scenarios[world].includes(scRaw)) scenarioId = scRaw;
    else errors.push(`nieznany scenariusz "${scRaw}" w świecie "${world}"`);
  }
  const seedRaw = q.get('seed');
  let seed: number | null = null;
  if (seedRaw !== null) {
    if (/^\d{1,9}$/.test(seedRaw)) seed = Number(seedRaw);
    else errors.push(`niepoprawny seed "${seedRaw}" (liczba całkowita 0–999999999)`);
  }
  return { styleId, scenarioId, world, seed, errors };
}
