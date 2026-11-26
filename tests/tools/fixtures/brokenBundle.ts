/**
 * Deliberately broken content for the CLI end-to-end test
 * (tests/tools/contentCheck.test.ts): `node scripts/content-check.mjs --bundle <this file>`.
 * The real data with one typo: the bronze recipe asks for "copper_barr".
 */
import { analyze } from '../../../src/content/analysis';
import { realBundle } from '../../../src/tools/contentBundle';
import type { ContentBundle } from '../../../src/tools/contentCheck';

const real = realBundle();

export const bundle: ContentBundle = {
  ...real,
  recipes: real.recipes.map((r) => (r.id === 'bronze_bar' ? { ...r, inputs: [{ id: 'copper_barr', n: 3 }, ...r.inputs.slice(1)] } : r)),
};

export const analysis = analyze();
