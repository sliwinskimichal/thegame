/**
 * Content schema. All game content (biomes, resources, items, buildings,
 * recipes, research) is plain data validated by tests/content.test.ts.
 * Ids are stable snake_case strings (they end up in save files).
 */

export type BiomeId =
  | 'foothills'
  | 'limestone'
  | 'granite'
  | 'fungal'
  | 'sunken'
  | 'crystal'
  | 'magma'
  | 'ancient'
  | 'heart';

export type HazardId =
  | 'night_predators'
  | 'raids'
  | 'darkness'
  | 'cave_ins'
  | 'flooding'
  | 'hard_rock'
  | 'spores'
  | 'poison'
  | 'deep_water'
  | 'cold'
  | 'heat'
  | 'lava'
  | 'fumes'
  | 'dread'
  | 'constructs';

export interface Stack {
  id: string;
  n: number;
}

export interface Biome {
  id: BiomeId;
  /** 0 = surface ... 8 = the Heart. Also the "tier" of content found there. */
  tier: number;
  namePl: string;
  nameEn: string;
  /** Approximate depth band, tiles below the surface. */
  depth: readonly [number, number];
  hazards: readonly HazardId[];
  /** What the player must learn/build to thrive here (design intent). */
  approachPl: string;
  descPl: string;
}

export interface Hazard {
  id: HazardId;
  namePl: string;
  descPl: string;
  /** Items, buildings or infrastructure that mitigate it (ids). */
  counters: readonly string[];
}

/** raw = mined from a deposit, drop = from an object/creature,
 *  material = crafted intermediate, item = usable by a dwarf. */
export type ResKind = 'raw' | 'drop' | 'material' | 'item';

export type ItemSlot =
  | 'pick'
  | 'tool'
  | 'weapon'
  | 'offhand'
  | 'ammo'
  | 'head'
  | 'body'
  | 'feet'
  | 'hands'
  | 'back'
  | 'gear'
  | 'trinket'
  | 'consumable';

export interface ItemStats {
  /** Pick tier (can dig materials with tier <= this). */
  pickTier?: number;
  /** Multiplier on the relevant work (digging, chopping, building...). */
  workSpeed?: number;
  damage?: number;
  armor?: number;
  /** Light radius in tiles (lamps). */
  light?: number;
  /** Extra carry capacity (items). */
  carry?: number;
  coldRes?: number;
  heatRes?: number;
  gasRes?: number;
  waterRes?: number;
  dreadRes?: number;
  /** Consumables. */
  food?: number;
  drink?: number;
  heal?: number;
  mood?: number;
  /** Duration of a consumable effect, seconds. */
  duration?: number;
  durability?: number;
}

export interface Resource {
  id: string;
  kind: ResKind;
  namePl: string;
  nameEn: string;
  /** Biome tier where it first becomes obtainable. */
  tier: number;
  value: number;
  stack: number;
  slot?: ItemSlot;
  stats?: ItemStats;
  tags?: readonly string[];
  descPl?: string;
}

export interface Deposit {
  id: string;
  namePl: string;
  nameEn: string;
  /** Raw resource mined from this deposit. */
  yields: string;
  /** Average yield per mined tile. */
  amount: number;
  biomes: readonly BiomeId[];
  /** Work units to mine one tile with an average dwarf. */
  hardness: number;
  /** Minimum pick tier required. */
  pickTier: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'legendary';
}

export interface DropEntry {
  id: string;
  min: number;
  max: number;
  chance: number;
}

/** A harvestable world object (tree, mushroom, ruin chest...). */
export interface WorldObject {
  id: string;
  namePl: string;
  nameEn: string;
  biomes: readonly BiomeId[];
  /** Work units to harvest. */
  work: number;
  /** Required tool slot to harvest (e.g. axe), if any. */
  tool?: 'axe' | 'pick' | 'rod' | 'hands';
  drops: readonly DropEntry[];
  regrows?: boolean;
}

export type Behavior = 'passive' | 'skittish' | 'territorial' | 'hunter' | 'swarm' | 'raider' | 'ambusher' | 'boss';

export interface Creature {
  id: string;
  namePl: string;
  nameEn: string;
  biome: BiomeId;
  behavior: Behavior;
  hp: number;
  damage: number;
  armor: number;
  /** Tiles per second. */
  speed: number;
  drops: readonly DropEntry[];
  boss?: boolean;
  descPl?: string;
}

export type BuildingCategory = 'core' | 'living' | 'food' | 'production' | 'research' | 'logistics' | 'power' | 'defense';

export interface BuildingLevel {
  namePl: string;
  nameEn: string;
  cost: readonly Stack[];
  /** Work units to construct. */
  work: number;
  /** Footprint in tiles (w, h). */
  size: readonly [number, number];
  workers: number;
  /** Power consumed (positive) or produced (negative), in "kW-dwarves". */
  power?: number;
  /** Free-form effects for the simulation (capacity, speed...). */
  effects: Readonly<Record<string, number>>;
}

export interface Building {
  id: string;
  category: BuildingCategory;
  descPl: string;
  levels: readonly [BuildingLevel, BuildingLevel, BuildingLevel];
}

/** Small placeable structures that are not "buildings" (ladders, lamps...). */
export interface Infrastructure {
  id: string;
  namePl: string;
  nameEn: string;
  cost: readonly Stack[];
  work: number;
  descPl: string;
  tier: number;
}

export interface Recipe {
  id: string;
  /** Building id and the minimum level required. */
  at: string;
  level: 1 | 2 | 3;
  inputs: readonly Stack[];
  outputs: readonly Stack[];
  /** Work seconds per craft at an average dwarf / machine. */
  time: number;
  power?: number;
}

export interface TechNode {
  id: string;
  tier: number;
  namePl: string;
  nameEn: string;
  descPl: string;
  /** Research cost: research packs (+ optional rare items). */
  cost: readonly Stack[];
  requires: readonly string[];
  /** The node is shown (instead of "???") once ANY of these resources is discovered.
   *  Empty = visible from the start. */
  revealBy: readonly string[];
  unlocks: {
    buildings?: readonly (readonly [string, 1 | 2 | 3])[];
    recipes?: readonly string[];
    infra?: readonly string[];
  };
}
