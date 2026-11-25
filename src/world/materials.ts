/**
 * Material identities and gameplay properties (no visuals here — the look of
 * each material is decided by tournaments and lives in the render layer).
 */

export const M = {
  AIR: 0,
  SOIL: 1,
  CLAY: 2,
  SAND: 3,
  LIMESTONE: 4,
  SANDSTONE: 5,
  SHALE: 6,
  GRANITE: 7,
  SLATE: 8,
  BASALT: 9,
  OBSIDIAN: 10,
  MAGMA_ROCK: 11,
  BEDROCK: 12,
  COAL: 13,
  COPPER: 14,
  IRON: 15,
  SILVER: 16,
  GOLD: 17,
  CRYSTAL: 18,
  AMETHYST: 19,
  GLIMMERITE: 20,
  MYCELIUM: 21,
  ANCIENT_BRICK: 22,
  EMBERITE: 23,
  STONE_BRICK: 24,
} as const;

export type MatId = (typeof M)[keyof typeof M];
export const MAT_COUNT = 25;

export type MatClass = 'air' | 'soil' | 'rock' | 'ore' | 'gem' | 'special';

export interface MaterialInfo {
  id: number;
  key: string;
  namePl: string;
  nameEn: string;
  cls: MatClass;
  solid: boolean;
  /** Work units to dig (1 unit ~ 1 s for an average dwarf with a basic pick). */
  hardness: number;
  /** Minimum pick tier (0 any, 1 copper, 2 iron, 3 glimmerite). */
  tier: number;
  /** Light emitted into the light field (linear RGB), if any. */
  glow?: readonly [number, number, number];
}

const T = (
  id: number,
  key: string,
  namePl: string,
  nameEn: string,
  cls: MatClass,
  hardness: number,
  tier = 0,
  glow?: readonly [number, number, number],
): MaterialInfo => ({ id, key, namePl, nameEn, cls, solid: cls !== 'air', hardness, tier, glow });

export const MATERIALS: readonly MaterialInfo[] = [
  T(M.AIR, 'air', 'powietrze', 'air', 'air', 0),
  T(M.SOIL, 'soil', 'gleba', 'soil', 'soil', 1),
  T(M.CLAY, 'clay', 'glina', 'clay', 'soil', 1.3),
  T(M.SAND, 'sand', 'piasek', 'sand', 'soil', 0.8),
  T(M.LIMESTONE, 'limestone', 'wapień', 'limestone', 'rock', 2.2),
  T(M.SANDSTONE, 'sandstone', 'piaskowiec', 'sandstone', 'rock', 2.0),
  T(M.SHALE, 'shale', 'łupek', 'shale', 'rock', 2.0),
  T(M.GRANITE, 'granite', 'granit', 'granite', 'rock', 3.5),
  T(M.SLATE, 'slate', 'łupek ilasty', 'slate', 'rock', 3.0),
  T(M.BASALT, 'basalt', 'bazalt', 'basalt', 'rock', 4.0, 1),
  T(M.OBSIDIAN, 'obsidian', 'obsydian', 'obsidian', 'rock', 6.0, 2),
  T(M.MAGMA_ROCK, 'magmaRock', 'skała magmowa', 'magma rock', 'rock', 4.5, 1, [0.45, 0.14, 0.03]),
  T(M.BEDROCK, 'bedrock', 'skała macierzysta', 'bedrock', 'special', Infinity, 9),
  T(M.COAL, 'coal', 'węgiel', 'coal', 'ore', 2.0),
  T(M.COPPER, 'copper', 'ruda miedzi', 'copper ore', 'ore', 2.8),
  T(M.IRON, 'iron', 'ruda żelaza', 'iron ore', 'ore', 3.6, 1),
  T(M.SILVER, 'silver', 'ruda srebra', 'silver ore', 'ore', 3.8, 1),
  T(M.GOLD, 'gold', 'złoto', 'gold ore', 'ore', 3.2, 1),
  T(M.CRYSTAL, 'crystal', 'kryształ', 'crystal', 'gem', 4.0, 2, [0.1, 0.42, 0.7]),
  T(M.AMETHYST, 'amethyst', 'ametyst', 'amethyst', 'gem', 4.2, 2, [0.45, 0.18, 0.7]),
  T(M.GLIMMERITE, 'glimmerite', 'lśnit', 'glimmerite', 'ore', 7.0, 2, [0.22, 0.32, 0.45]),
  T(M.MYCELIUM, 'mycelium', 'grzybnia', 'mycelium', 'soil', 1.2, 0, [0.03, 0.14, 0.11]),
  T(M.ANCIENT_BRICK, 'ancientBrick', 'starożytna cegła', 'ancient brick', 'special', 5.0, 2),
  T(M.EMBERITE, 'emberite', 'żaryt', 'emberite', 'ore', 5.5, 2, [0.55, 0.22, 0.05]),
  T(M.STONE_BRICK, 'stoneBrick', 'mur kamienny', 'stone wall', 'special', 3.0),
];

export const SOLID = new Uint8Array(256);
for (const m of MATERIALS) SOLID[m.id] = m.solid ? 1 : 0;
