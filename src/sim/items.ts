/** Item definitions. Items are physical things dwarves carry and store. */

export const IT = {
  NONE: 0,
  STONE: 1,
  CLAY: 2,
  COAL: 3,
  COPPER_ORE: 4,
  IRON_ORE: 5,
  SILVER_ORE: 6,
  GOLD_ORE: 7,
  CRYSTAL: 8,
  AMETHYST: 9,
  GLIMMERITE_ORE: 10,
  EMBERITE: 11,
  OBSIDIAN: 12,
  WOOD: 13,
  MUSHROOM: 14,
  MEAL: 15,
  ALE: 16,
  COPPER_BAR: 17,
  IRON_BAR: 18,
  SILVER_BAR: 19,
  GOLD_BAR: 20,
  GLIMMERITE_BAR: 21,
  STONE_BLOCK: 22,
  SPORES: 23,
} as const;

export type ItemId = (typeof IT)[keyof typeof IT];

export type ItemCategory = 'stone' | 'ore' | 'gem' | 'wood' | 'food' | 'drink' | 'bar' | 'crafted' | 'misc';

export interface ItemDef {
  id: ItemId;
  key: string;
  category: ItemCategory;
  /** Display color (sRGB hex), used for icons and the dropped-item mesh. */
  color: number;
  /** Mesh shape used for dropped items. */
  shape: 'chunk' | 'nugget' | 'gem' | 'log' | 'mushroom' | 'barrel' | 'bar' | 'block' | 'sack';
  value: number;
  /** Emissive glow of the dropped mesh (0..1). */
  glow?: number;
}

const D = (
  id: ItemId,
  key: string,
  category: ItemCategory,
  color: number,
  shape: ItemDef['shape'],
  value: number,
  glow = 0,
): ItemDef => ({ id, key, category, color, shape, value, glow });

export const ITEMS: readonly ItemDef[] = [
  D(IT.NONE, 'none', 'misc', 0xffffff, 'chunk', 0),
  D(IT.STONE, 'stone', 'stone', 0x8a8580, 'chunk', 1),
  D(IT.CLAY, 'clay', 'stone', 0xb0704a, 'chunk', 1),
  D(IT.COAL, 'coal', 'ore', 0x262422, 'chunk', 2),
  D(IT.COPPER_ORE, 'copperOre', 'ore', 0xd07a45, 'nugget', 4),
  D(IT.IRON_ORE, 'ironOre', 'ore', 0x9a6a5a, 'nugget', 6),
  D(IT.SILVER_ORE, 'silverOre', 'ore', 0xd8dde6, 'nugget', 10),
  D(IT.GOLD_ORE, 'goldOre', 'ore', 0xf2c14e, 'nugget', 16),
  D(IT.CRYSTAL, 'crystal', 'gem', 0x6fd6ff, 'gem', 20, 0.8),
  D(IT.AMETHYST, 'amethyst', 'gem', 0xb57bff, 'gem', 24, 0.7),
  D(IT.GLIMMERITE_ORE, 'glimmeriteOre', 'ore', 0xa8d8ff, 'nugget', 40, 0.5),
  D(IT.EMBERITE, 'emberite', 'ore', 0xff7a2a, 'nugget', 30, 0.9),
  D(IT.OBSIDIAN, 'obsidian', 'stone', 0x231a2e, 'chunk', 5),
  D(IT.WOOD, 'wood', 'wood', 0x9b6b3d, 'log', 2),
  D(IT.MUSHROOM, 'mushroom', 'food', 0xd9b38c, 'mushroom', 2),
  D(IT.MEAL, 'meal', 'food', 0xe0a05a, 'sack', 4),
  D(IT.ALE, 'ale', 'drink', 0xc98a2e, 'barrel', 4),
  D(IT.COPPER_BAR, 'copperBar', 'bar', 0xe08a55, 'bar', 10),
  D(IT.IRON_BAR, 'ironBar', 'bar', 0xb8bcc4, 'bar', 14),
  D(IT.SILVER_BAR, 'silverBar', 'bar', 0xe8edf5, 'bar', 24),
  D(IT.GOLD_BAR, 'goldBar', 'bar', 0xffd257, 'bar', 40),
  D(IT.GLIMMERITE_BAR, 'glimmeriteBar', 'bar', 0xbfe6ff, 'bar', 90, 0.6),
  D(IT.STONE_BLOCK, 'stoneBlock', 'crafted', 0xa49e96, 'block', 3),
  D(IT.SPORES, 'spores', 'food', 0x7fd1b9, 'sack', 1, 0.3),
];

export function itemDef(id: number): ItemDef {
  return ITEMS[id] ?? ITEMS[0]!;
}
