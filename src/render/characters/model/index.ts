/**
 * Public entry of the model module (owner: W1 "Modelarz", dwarf team).
 *  DWARF_VARIANTS — the tournament variants (brief §2: d01–d12), each `build(spec)` gives 4 roles × 3 LOD
 *                   (welded skinned geometry + inverted hull, or instanced parts for d07);
 *  makeSpec       — deterministic spec factory (palette: tunic hue ±4°, C* <= 26, L* 30–48; beard ΔL* >= 15;
 *                   skin ±8 L*; social accent);
 *  canonicalSpec  — the one spec a crowd geometry is built from (contract v2: one geometry per variant,
 *                   role and LOD; per-dwarf variety = palette + animator bone scale).
 * Units: MODEL units (contract v2), never tiles.
 */
import { SOCIAL, type DwarfSpec, type Proportions, type RoleId, type SocialId } from '../types';
import { makeSpec } from './spec';

export { DWARF_VARIANTS, VARIANT_DEFS } from './variants';
export { makeSpec, makePalette } from './spec';

/** Seed of the canonical crowd geometry of every role (beardShape 0.5: neutral beard and nose). */
export const CANONICAL_SEED = 1;

export function canonicalSpec(role: RoleId, proportions: Proportions, social: SocialId = SOCIAL.FREE_MINER): DwarfSpec {
  return { ...makeSpec(CANONICAL_SEED, role, social, proportions), beardShape: 0.5 };
}
