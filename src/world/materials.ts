/**
 * Material identities and gameplay properties (no visuals here — the look of
 * each material is decided by tournaments and lives in the render layer).
 *
 * Every resource deposit of the content bible (`src/content/sources.ts`) has
 * exactly one material here, and every biome lists its host rocks
 * (`Biome.rocks`). Hardness and pick tier of deposits come from the content
 * bible, so the world and the balance model never disagree.
 */
import { BIOMES } from '../content/biomes';
import { DEPOSITS, ROCK_PICK_TIER } from '../content/sources';

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
  FROST_CRYSTAL: 18,
  AMETHYST: 19,
  GLIMMERITE: 20,
  MYCELIUM: 21,
  ANCIENT_BRICK: 22,
  EMBERITE: 23,
  STONE_BRICK: 24,
  TIN: 25,
  SALTPETER: 26,
  GALENA: 27,
  SPHALERITE: 28,
  QUARTZ: 29,
  SULFUR: 30,
  SALT: 31,
  NICKEL: 32,
  COBALT: 33,
  SAPPHIRE: 34,
  RUBY: 35,
  ADAMANTITE: 36,
  RUNESTONE: 37,
  SHELL_LIMESTONE: 38,
  SPORE_SHALE: 39,
  MUDSTONE: 40,
  SCHIST: 41,
  DEEPSTONE: 42,
  HEARTSTONE: 43,
} as const;

export type MatId = (typeof M)[keyof typeof M];
export const MAT_COUNT = 44;

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
  /** Minimum pick tier, the content bible's scale (0 hands/flint ... 5 adamant; 9 = never). */
  tier: number;
  /** Content deposit mined from this material (yields its resource), if any. */
  deposit?: string;
  /** Light emitted into the light field (linear RGB), if any. */
  glow?: readonly [number, number, number];
}

type Glow = readonly [number, number, number];
const DEP = new Map(DEPOSITS.map((d) => [d.id, d]));

/** Plain material (rock, soil, special). */
const T = (id: number, key: string, namePl: string, nameEn: string, cls: MatClass, hardness: number, tier = 0, glow?: Glow): MaterialInfo =>
  ({ id, key, namePl, nameEn, cls, solid: cls !== 'air', hardness, tier, glow });

/** Deposit material: hardness and pick tier come from the content bible. */
const D = (id: number, key: string, deposit: string, namePl: string, nameEn: string, cls: MatClass, glow?: Glow): MaterialInfo => {
  const d = DEP.get(deposit);
  if (!d) throw new Error(`material ${key}: unknown deposit ${deposit}`);
  return { id, key, namePl, nameEn, cls, solid: true, hardness: d.hardness, tier: d.pickTier, deposit, glow };
};

const R = ROCK_PICK_TIER;

export const MATERIALS: readonly MaterialInfo[] = [
  T(M.AIR, 'air', 'powietrze', 'air', 'air', 0),
  T(M.SOIL, 'soil', 'gleba', 'soil', 'soil', 1, R.foothills),
  D(M.CLAY, 'clay', 'clay_bed', 'glina', 'clay', 'soil'),
  D(M.SAND, 'sand', 'sand_bed', 'piasek', 'sand', 'soil'),
  T(M.LIMESTONE, 'limestone', 'wapień', 'limestone', 'rock', 2.2, R.limestone),
  T(M.SANDSTONE, 'sandstone', 'piaskowiec', 'sandstone', 'rock', 2.0, R.limestone),
  T(M.SHALE, 'shale', 'łupek', 'shale', 'rock', 2.0, R.limestone),
  T(M.GRANITE, 'granite', 'granit', 'granite', 'rock', 3.5, R.granite),
  T(M.SLATE, 'slate', 'łupek ilasty', 'slate', 'rock', 3.0, R.granite),
  T(M.BASALT, 'basalt', 'bazalt', 'basalt', 'rock', 4.6, R.magma),
  D(M.OBSIDIAN, 'obsidian', 'obsidian_flow', 'obsydian', 'obsidian', 'rock'),
  T(M.MAGMA_ROCK, 'magmaRock', 'skała magmowa', 'magma rock', 'rock', 4.8, R.magma, [0.45, 0.14, 0.03]),
  T(M.BEDROCK, 'bedrock', 'skała macierzysta', 'bedrock', 'special', Infinity, 9),
  D(M.COAL, 'coal', 'coal_seam', 'węgiel', 'coal', 'ore'),
  D(M.COPPER, 'copper', 'copper_vein', 'ruda miedzi', 'copper ore', 'ore'),
  D(M.IRON, 'iron', 'iron_vein', 'ruda żelaza', 'iron ore', 'ore'),
  D(M.SILVER, 'silver', 'silver_vein', 'ruda srebra', 'silver ore', 'ore'),
  D(M.GOLD, 'gold', 'gold_vein', 'złoto rodzime', 'native gold', 'ore'),
  D(M.FROST_CRYSTAL, 'frostCrystal', 'frost_crystal_bed', 'mroźny kryształ', 'frost crystal', 'gem', [0.1, 0.42, 0.7]),
  D(M.AMETHYST, 'amethyst', 'amethyst_geode', 'ametyst', 'amethyst', 'gem', [0.45, 0.18, 0.7]),
  D(M.GLIMMERITE, 'glimmerite', 'glimmerite_vein', 'lśnit', 'glimmerite', 'ore', [0.22, 0.32, 0.45]),
  T(M.MYCELIUM, 'mycelium', 'grzybnia', 'mycelium', 'soil', 1.6, R.fungal, [0.03, 0.14, 0.11]),
  T(M.ANCIENT_BRICK, 'ancientBrick', 'prastary mur', 'ancient masonry', 'special', 6.0, R.ancient),
  D(M.EMBERITE, 'emberite', 'emberite_vein', 'żaryt', 'emberite', 'ore', [0.55, 0.22, 0.05]),
  T(M.STONE_BRICK, 'stoneBrick', 'mur kamienny', 'stone wall', 'special', 3.0),
  D(M.TIN, 'tin', 'tin_vein', 'kasyteryt (ruda cyny)', 'cassiterite (tin ore)', 'ore'),
  D(M.SALTPETER, 'saltpeter', 'saltpeter_crust', 'saletra', 'saltpeter', 'ore'),
  D(M.GALENA, 'galena', 'lead_vein', 'galena (ruda ołowiu)', 'galena (lead ore)', 'ore'),
  D(M.SPHALERITE, 'sphalerite', 'zinc_vein', 'sfaleryt (ruda cynku)', 'sphalerite (zinc ore)', 'ore'),
  D(M.QUARTZ, 'quartz', 'quartz_vein', 'kwarc', 'quartz', 'gem'),
  D(M.SULFUR, 'sulfur', 'sulfur_vent', 'siarka', 'sulfur', 'ore'),
  D(M.SALT, 'salt', 'salt_bed', 'sól kamienna', 'rock salt', 'ore'),
  D(M.NICKEL, 'nickel', 'nickel_vein', 'garnieryt (ruda niklu)', 'garnierite (nickel ore)', 'ore'),
  D(M.COBALT, 'cobalt', 'cobalt_vein', 'ruda kobaltu', 'cobalt ore', 'ore'),
  D(M.SAPPHIRE, 'sapphire', 'sapphire_geode', 'szafir', 'sapphire', 'gem', [0.06, 0.14, 0.55]),
  D(M.RUBY, 'ruby', 'ruby_geode', 'rubin', 'ruby', 'gem', [0.5, 0.04, 0.1]),
  D(M.ADAMANTITE, 'adamantite', 'adamantite_vein', 'ruda adamantytu', 'adamantite ore', 'ore'),
  D(M.RUNESTONE, 'runestone', 'runestone_vein', 'runokamień', 'runestone', 'ore', [0.42, 0.06, 0.2]),
  D(M.SHELL_LIMESTONE, 'shellLimestone', 'limestone_bed', 'wapień muszlowy', 'shell limestone', 'rock'),
  T(M.SPORE_SHALE, 'sporeShale', 'łupek zarodnikowy', 'spore shale', 'rock', 3.0, R.fungal),
  T(M.MUDSTONE, 'mudstone', 'mułowiec', 'mudstone', 'rock', 3.2, R.sunken),
  T(M.SCHIST, 'schist', 'łupek krystaliczny', 'schist', 'rock', 4.2, R.crystal),
  T(M.DEEPSTONE, 'deepstone', 'prakamień', 'deepstone', 'rock', 6.0, R.ancient),
  T(M.HEARTSTONE, 'heartstone', 'sercokamień', 'heartstone', 'rock', 8.0, R.heart, [0.3, 0.03, 0.07]),
];

export const SOLID = new Uint8Array(256);
for (const m of MATERIALS) SOLID[m.id] = m.solid ? 1 : 0;

export const MAT_BY_KEY: ReadonlyMap<string, MaterialInfo> = new Map(MATERIALS.map((m) => [m.key, m]));

/** Material of a content deposit. */
export const DEPOSIT_MAT: ReadonlyMap<string, number> = new Map(
  MATERIALS.filter((m) => m.deposit).map((m) => [m.deposit!, m.id]),
);

/** Materials that meet inside one biome: its host rocks first, then its deposits. */
export function biomeMaterials(biomeId: string): { rocks: number[]; deposits: number[] } {
  const b = BIOMES.find((x) => x.id === biomeId);
  if (!b) throw new Error(`unknown biome ${biomeId}`);
  const rocks = b.rocks.map((k) => {
    const m = MAT_BY_KEY.get(k);
    if (!m) throw new Error(`biome ${biomeId}: unknown rock ${k}`);
    return m.id;
  });
  const deposits = DEPOSITS.filter((d) => d.biomes.includes(b.id)).map((d) => DEPOSIT_MAT.get(d.id)!);
  return { rocks, deposits };
}
