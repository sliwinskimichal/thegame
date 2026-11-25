/**
 * Tile materials. Each tile of the world grid holds one material id (Uint8).
 * Rendering parameters here drive the procedural terrain shader.
 */
import { IT, type ItemId } from '../sim/items';

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

export type MatId = number;

/** Shader pattern ids (must match terrain shader). */
export const PAT = {
  SOIL: 0,
  STRATA: 1,
  SPECKLE: 2,
  ORE: 3,
  CRYSTAL: 4,
  MAGMA: 5,
  BRICK: 6,
  GLASSY: 7,
  MYCELIUM: 8,
  BEDROCK: 9,
  SAND: 10,
} as const;

export interface MaterialDef {
  id: MatId;
  key: string;
  solid: boolean;
  /** Work units needed to dig (1 unit ~ 1 s for an average dwarf). */
  hardness: number;
  diggable: boolean;
  drop: ItemId;
  dropChance: number;
  /** sRGB colors: two base tones and an accent (ore, crystal, crack...). */
  colorA: number;
  colorB: number;
  accent: number;
  pattern: number;
  /** Specular strength of the surface (0..1). */
  spec: number;
  /** Emissive strength of the accent (HDR, >1 blooms). */
  emissive: number;
  /** Pattern scale / bump / accent density / variation. */
  scale: number;
  bump: number;
  accentAmount: number;
  variation: number;
  /** Light emitted into the light field (linear RGB). */
  light?: readonly [number, number, number];
  /** Wealth value of an exposed tile (for ores this is the item value). */
  value: number;
  /** True for ores and gems (hidden until explored, counted as resources). */
  ore?: boolean;
}

const defs: MaterialDef[] = [];

function def(d: Partial<MaterialDef> & Pick<MaterialDef, 'id' | 'key'>): void {
  defs[d.id] = {
    solid: true,
    hardness: 2,
    diggable: true,
    drop: IT.NONE,
    dropChance: 0,
    colorA: 0x777777,
    colorB: 0x999999,
    accent: 0xffffff,
    pattern: PAT.SPECKLE,
    spec: 0.1,
    emissive: 0,
    scale: 1,
    bump: 1,
    accentAmount: 0.5,
    variation: 0.5,
    value: 0,
    ...d,
  };
}

def({ id: M.AIR, key: 'air', solid: false, diggable: false, hardness: 0 });
def({
  id: M.SOIL, key: 'soil', hardness: 1, colorA: 0x4a3222, colorB: 0x6e4a30, accent: 0x8a7a68,
  pattern: PAT.SOIL, spec: 0.02, scale: 1.4, bump: 0.8, accentAmount: 0.35, variation: 0.7,
});
def({
  id: M.CLAY, key: 'clay', hardness: 1.3, drop: IT.CLAY, dropChance: 0.5,
  colorA: 0x7d4430, colorB: 0x9c5a3a, accent: 0xb87a55, pattern: PAT.SOIL, spec: 0.08,
  scale: 0.8, bump: 0.5, accentAmount: 0.15, variation: 0.4,
});
def({
  id: M.SAND, key: 'sand', hardness: 0.8, colorA: 0xb39364, colorB: 0xd1b07c, accent: 0xe8d3a6,
  pattern: PAT.SAND, spec: 0.05, scale: 2.0, bump: 0.4, accentAmount: 0.4,
});
def({
  id: M.LIMESTONE, key: 'limestone', hardness: 2.2, drop: IT.STONE, dropChance: 0.25,
  colorA: 0x8a8070, colorB: 0xaea38e, accent: 0xc9bfaa, pattern: PAT.STRATA, spec: 0.08,
  scale: 1.0, bump: 1.0, accentAmount: 0.5, variation: 0.5,
});
def({
  id: M.SANDSTONE, key: 'sandstone', hardness: 2.0, drop: IT.STONE, dropChance: 0.25,
  colorA: 0x93653f, colorB: 0xb98854, accent: 0xd4a66f, pattern: PAT.STRATA, spec: 0.05,
  scale: 1.3, bump: 0.8, accentAmount: 0.6, variation: 0.6,
});
def({
  id: M.SHALE, key: 'shale', hardness: 2.0, drop: IT.STONE, dropChance: 0.25,
  colorA: 0x4c4e53, colorB: 0x63666c, accent: 0x7b7f86, pattern: PAT.STRATA, spec: 0.12,
  scale: 2.2, bump: 0.9, accentAmount: 0.4, variation: 0.3,
});
def({
  id: M.GRANITE, key: 'granite', hardness: 3.5, drop: IT.STONE, dropChance: 0.25,
  colorA: 0x625c5c, colorB: 0x837a77, accent: 0xc79a8f, pattern: PAT.SPECKLE, spec: 0.18,
  scale: 1.0, bump: 1.1, accentAmount: 0.55, variation: 0.4,
});
def({
  id: M.SLATE, key: 'slate', hardness: 3.0, drop: IT.STONE, dropChance: 0.25,
  colorA: 0x333a46, colorB: 0x48525f, accent: 0x6c7a8c, pattern: PAT.STRATA, spec: 0.2,
  scale: 2.6, bump: 1.0, accentAmount: 0.35, variation: 0.3,
});
def({
  id: M.BASALT, key: 'basalt', hardness: 4.0, drop: IT.STONE, dropChance: 0.2,
  colorA: 0x232428, colorB: 0x34353c, accent: 0x55565f, pattern: PAT.SPECKLE, spec: 0.15,
  scale: 1.6, bump: 1.3, accentAmount: 0.3, variation: 0.35,
});
def({
  id: M.OBSIDIAN, key: 'obsidian', hardness: 6, drop: IT.OBSIDIAN, dropChance: 0.5,
  colorA: 0x0c0912, colorB: 0x211832, accent: 0x6a4c9c, pattern: PAT.GLASSY, spec: 0.9,
  scale: 0.8, bump: 1.4, accentAmount: 0.4, variation: 0.6, value: 2,
});
def({
  id: M.MAGMA_ROCK, key: 'magmaRock', hardness: 4.5, drop: IT.STONE, dropChance: 0.2,
  colorA: 0x221310, colorB: 0x371b13, accent: 0xff5a1a, pattern: PAT.MAGMA, spec: 0.1,
  emissive: 3.0, scale: 1.0, bump: 1.3, accentAmount: 0.5, variation: 0.5,
  light: [0.45, 0.14, 0.03],
});
def({
  id: M.BEDROCK, key: 'bedrock', hardness: Infinity, diggable: false,
  colorA: 0x111015, colorB: 0x1e1c24, accent: 0x3a3550, pattern: PAT.BEDROCK, spec: 0.25,
  scale: 0.7, bump: 1.6, accentAmount: 0.3, variation: 0.3,
});
def({
  id: M.COAL, key: 'coal', hardness: 2.0, drop: IT.COAL, dropChance: 1, ore: true,
  colorA: 0x37332f, colorB: 0x4a443f, accent: 0x0d0c0c, pattern: PAT.ORE, spec: 0.6,
  scale: 1.2, bump: 1.1, accentAmount: 0.65, variation: 0.4, value: 2,
});
def({
  id: M.COPPER, key: 'copper', hardness: 2.8, drop: IT.COPPER_ORE, dropChance: 1, ore: true,
  colorA: 0x7f7769, colorB: 0x9b917f, accent: 0xe07b3c, pattern: PAT.ORE, spec: 0.85,
  emissive: 0.05, scale: 1.0, bump: 1.0, accentAmount: 0.55, variation: 0.4, value: 4,
});
def({
  id: M.IRON, key: 'iron', hardness: 3.6, drop: IT.IRON_ORE, dropChance: 1, ore: true,
  colorA: 0x5f5958, colorB: 0x7a716e, accent: 0xa4523a, pattern: PAT.ORE, spec: 0.7,
  scale: 1.0, bump: 1.1, accentAmount: 0.55, variation: 0.4, value: 6,
});
def({
  id: M.SILVER, key: 'silver', hardness: 3.8, drop: IT.SILVER_ORE, dropChance: 1, ore: true,
  colorA: 0x4e5058, colorB: 0x666872, accent: 0xeef3ff, pattern: PAT.ORE, spec: 1.0,
  emissive: 0.08, scale: 1.1, bump: 1.0, accentAmount: 0.5, variation: 0.4, value: 10,
});
def({
  id: M.GOLD, key: 'gold', hardness: 3.2, drop: IT.GOLD_ORE, dropChance: 1, ore: true,
  colorA: 0x413d47, colorB: 0x56505d, accent: 0xffc23d, pattern: PAT.ORE, spec: 1.0,
  emissive: 0.15, scale: 1.0, bump: 1.0, accentAmount: 0.55, variation: 0.4, value: 16,
});
def({
  id: M.CRYSTAL, key: 'crystal', hardness: 4.0, drop: IT.CRYSTAL, dropChance: 1, ore: true,
  colorA: 0x1f2a3c, colorB: 0x2e3b57, accent: 0x52d6ff, pattern: PAT.CRYSTAL, spec: 1.0,
  emissive: 2.2, scale: 1.0, bump: 1.4, accentAmount: 0.6, variation: 0.5, value: 20,
  light: [0.1, 0.42, 0.7],
});
def({
  id: M.AMETHYST, key: 'amethyst', hardness: 4.2, drop: IT.AMETHYST, dropChance: 1, ore: true,
  colorA: 0x251f30, colorB: 0x372c4a, accent: 0xb46cff, pattern: PAT.CRYSTAL, spec: 1.0,
  emissive: 2.0, scale: 1.1, bump: 1.4, accentAmount: 0.55, variation: 0.5, value: 24,
  light: [0.45, 0.18, 0.7],
});
def({
  id: M.GLIMMERITE, key: 'glimmerite', hardness: 7, drop: IT.GLIMMERITE_ORE, dropChance: 1, ore: true,
  colorA: 0x171b27, colorB: 0x252c40, accent: 0xc4ecff, pattern: PAT.ORE, spec: 1.0,
  emissive: 1.6, scale: 1.4, bump: 1.2, accentAmount: 0.45, variation: 0.5, value: 40,
  light: [0.22, 0.32, 0.45],
});
def({
  id: M.MYCELIUM, key: 'mycelium', hardness: 1.2, drop: IT.SPORES, dropChance: 0.3,
  colorA: 0x26302f, colorB: 0x384a47, accent: 0x45e6c0, pattern: PAT.MYCELIUM, spec: 0.1,
  emissive: 1.3, scale: 1.2, bump: 0.7, accentAmount: 0.35, variation: 0.6,
  light: [0.03, 0.14, 0.11],
});
def({
  id: M.ANCIENT_BRICK, key: 'ancientBrick', hardness: 5, drop: IT.STONE, dropChance: 0.3,
  colorA: 0x403f4a, colorB: 0x55535f, accent: 0x6ff0ff, pattern: PAT.BRICK, spec: 0.3,
  emissive: 1.4, scale: 1.0, bump: 1.0, accentAmount: 0.15, variation: 0.4,
});
def({
  id: M.EMBERITE, key: 'emberite', hardness: 5.5, drop: IT.EMBERITE, dropChance: 1, ore: true,
  colorA: 0x26170f, colorB: 0x3a2216, accent: 0xff8a26, pattern: PAT.ORE, spec: 0.8,
  emissive: 2.6, scale: 1.0, bump: 1.2, accentAmount: 0.5, variation: 0.5, value: 30,
  light: [0.55, 0.22, 0.05],
});
def({
  id: M.STONE_BRICK, key: 'stoneBrick', hardness: 3, drop: IT.STONE_BLOCK, dropChance: 1,
  colorA: 0x6e685f, colorB: 0x8b847a, accent: 0x5a554e, pattern: PAT.BRICK, spec: 0.12,
  scale: 1.0, bump: 1.0, accentAmount: 0.0, variation: 0.3,
});

export const MATERIALS: readonly MaterialDef[] = defs;
export const MATERIAL_COUNT = defs.length;

/** Fast lookup tables for hot loops. */
export const SOLID = new Uint8Array(256);
export const HARDNESS = new Float32Array(256);
export const IS_ORE = new Uint8Array(256);
for (const d of defs) {
  SOLID[d.id] = d.solid ? 1 : 0;
  HARDNESS[d.id] = d.hardness;
  IS_ORE[d.id] = d.ore ? 1 : 0;
}

export function matDef(id: number): MaterialDef {
  return defs[id] ?? defs[0]!;
}
