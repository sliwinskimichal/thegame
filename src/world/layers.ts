/** Depth layers ("biomes") of the mountain, from the surface down. */

export interface LayerDef {
  key: string;
  /** Nominal top row of the layer (boundaries wobble around this). */
  base: number;
  /** Ambient tint of the darkness in this layer (sRGB hex). */
  ambient: number;
  /** Background fog colour used for the deep cut-away (sRGB hex). */
  fog: number;
  /** 0..1 how dangerous the layer is (monster spawn weighting). */
  danger: number;
}

export const LAYERS: readonly LayerDef[] = [
  { key: 'foothills', base: 0, ambient: 0x2a2620, fog: 0x1a1612, danger: 0 },
  { key: 'limestone', base: 58, ambient: 0x2a2722, fog: 0x15130f, danger: 0.05 },
  { key: 'granite', base: 126, ambient: 0x23222a, fog: 0x111016, danger: 0.2 },
  { key: 'fungal', base: 198, ambient: 0x15302c, fog: 0x07140f, danger: 0.4 },
  { key: 'crystal', base: 272, ambient: 0x1a2140, fog: 0x080b1a, danger: 0.55 },
  { key: 'magma', base: 342, ambient: 0x3a1a10, fog: 0x1a0804, danger: 0.75 },
  { key: 'ancient', base: 408, ambient: 0x1d1a30, fog: 0x0a0814, danger: 0.95 },
];

export const BEDROCK_ROWS = 12;

export const LAYER_IDX = {
  FOOTHILLS: 0,
  LIMESTONE: 1,
  GRANITE: 2,
  FUNGAL: 3,
  CRYSTAL: 4,
  MAGMA: 5,
  ANCIENT: 6,
} as const;
