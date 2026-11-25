/** Decorative props scattered by world generation. */

export const DECOR = {
  PINE: 0,
  BIRCH: 1,
  BUSH: 2,
  BOULDER: 3,
  GRASS: 4,
  FLOWER: 5,
  STALACTITE: 6,
  STALAGMITE: 7,
  GLOW_SHROOM: 8,
  GIANT_SHROOM: 9,
  CRYSTAL_CLUSTER: 10,
  BONES: 11,
  PILLAR: 12,
  ROOTS: 13,
  EMBER_VENT: 14,
} as const;

export const DECOR_COUNT = 15;

/** Linear RGB light emitted by a decor type (added to the light field). */
export const DECOR_LIGHT: Partial<Record<number, readonly [number, number, number]>> = {
  [DECOR.GLOW_SHROOM]: [0.05, 0.32, 0.26],
  [DECOR.GIANT_SHROOM]: [0.1, 0.28, 0.34],
  [DECOR.CRYSTAL_CLUSTER]: [0.12, 0.4, 0.7],
  [DECOR.EMBER_VENT]: [0.7, 0.25, 0.05],
};
