/**
 * Public entry of the model module (owner: W1 "Modelarz", dwarf team).
 * STUB written by the team lead so the contract compiles from day one; W1 replaces it.
 * Exported names (fixed by the contract): DWARF_VARIANTS, makeSpec.
 */
import type { DwarfVariant, MakeSpec } from '../types';

/** Tournament variants (≥ 10), each building all 4 roles with 3 LODs. */
export const DWARF_VARIANTS: readonly DwarfVariant[] = [];

/** Deterministic spec factory (palette with beard ΔL* >= 15 against the tunic). */
export const makeSpec: MakeSpec = () => {
  throw new Error('makeSpec: not implemented yet (W1)');
};
