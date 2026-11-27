/** Global tuning constants. Gameplay numbers live next to their systems. */
export const CONFIG = {
  /**
   * World size in tiles (BUG-006): 40 rows above the plain (sky and the mountain), 680 rows of biomes
   * (Foothills 0 .. Heart 680, `src/content/biomes.ts`) and a 16-row bedrock floor. 224 = 7 x 32 and
   * 736 = 23 x 32, so terrain chunks (32) and navigation clusters (16) divide both axes. Row layout:
   * `src/content/worldgen.ts` (WORLD_FRAME).
   */
  worldW: 224,
  worldH: 736,
  /** Terrain chunk size in tiles (render + dirty tracking). */
  chunk: 32,
  /** Depth of the walkable outdoor ground strip behind the cut plane (world units). */
  groundDepth: 3,
  /** Simulation ticks per second at 1x speed. */
  tickRate: 20,
  /** Length of a full day/night cycle in seconds of game time at 1x. */
  dayLength: 480,
  /** Max height (tiles) a dwarf will drop down without a ladder. */
  maxSafeDrop: 3,
} as const;

export const TICK_DT = 1 / CONFIG.tickRate;
