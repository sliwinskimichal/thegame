/**
 * Navigation constants shared by the grid, the path finders and the agents.
 *
 * The walkable graph is stored as one bit mask per cell and movement profile:
 * every bit is an edge "slot" with a fixed offset, except drops and falls,
 * whose height is stored per cell in a packed drop table. Off-mesh links
 * (ropes, rope bridges, lifts, rail lines) live in a separate link table and
 * are flagged in the mask with the LINK bit.
 *
 * Coordinates follow `World`: x to the right, y downward, index = y * w + x.
 * A node is the cell an agent's feet occupy; its body extends `height - 1`
 * cells upward.
 */

/** Edge slots (bit index in the per-cell move mask). */
export const MV = {
  WALK_L: 0,
  WALK_R: 1,
  /** Step up onto a one-tile ledge (diagonal up). Flyers: diagonal flight up. */
  STEP_UL: 2,
  STEP_UR: 3,
  /** Step off a ledge sideways and fall k rows (k from the drop table). */
  DROP_L: 4,
  DROP_R: 5,
  /** Climb / swim / fly one row up or down. */
  UP: 6,
  DOWN: 7,
  /** Along a staircase (diagonal). Flyers use STAIR_D* for diagonal flight down. */
  STAIR_UL: 8,
  STAIR_UR: 9,
  STAIR_DL: 10,
  STAIR_DR: 11,
  /** Let go of a ladder and fall k rows straight down (k from the drop table). */
  FALL: 12,
  /** Off-mesh links start here (see the link table). */
  LINK: 13,
} as const;

export const MOVE_COUNT = 14;
/** Move code of the first path node (nothing was traversed to get there). */
export const MOVE_NONE = 255;

/** dx of every move. */
export const MOVE_DX: Int8Array = Int8Array.of(-1, 1, -1, 1, -1, 1, 0, 0, -1, 1, -1, 1, 0, 0);
/** dy of fixed moves (drops and falls take their height from the drop table). */
export const MOVE_DY: Int8Array = Int8Array.of(0, 0, -1, -1, 0, 0, -1, 1, -1, -1, 1, 1, 0, 0);

export const BIT = {
  WALK_L: 1 << MV.WALK_L,
  WALK_R: 1 << MV.WALK_R,
  WALKS: (1 << MV.WALK_L) | (1 << MV.WALK_R),
  UP: 1 << MV.UP,
  DOWN: 1 << MV.DOWN,
  CLIMBS: (1 << MV.UP) | (1 << MV.DOWN),
  LINK: 1 << MV.LINK,
} as const;

/**
 * Drop table packing (Uint16 per cell): bits 0-3 DROP_L height, 4-7 DROP_R
 * height, 8-11 FALL height. Heights are 1..15 rows.
 */
export function dropHeight(drop: number, move: number): number {
  if (move === MV.DROP_L) return drop & 15;
  if (move === MV.DROP_R) return (drop >> 4) & 15;
  return (drop >> 8) & 15;
}

/**
 * Infrastructure stored per tile (the proposed `World.infra` field; for now
 * owned by `NavGrid`). Low nibble = kind, high bits = flags.
 */
export const INFRA = {
  NONE: 0,
  /** Climbable column; the tile above a ladder top is standable. */
  LADDER: 1,
  /** Deck over the void: carries whoever stands on top; bodies cannot pass it. */
  PLATFORM: 2,
  /** Ramp rising one row per column; orientation flag RISE_RIGHT. */
  STAIRS: 3,
  DOOR_WOOD: 4,
  DOOR_IRON: 5,
  BULKHEAD: 6,
  /** Rail track on a floor: walkable as usual; cart travel is a RAIL link. */
  RAIL: 7,
} as const;
export const INFRA_KIND = 0x0f;
/** Stairs: the ramp rises toward +x (else toward -x). */
export const INFRA_RISE_RIGHT = 0x10;
/** Doors: shut and locked for everyone. */
export const INFRA_LOCKED = 0x20;

/** Content infrastructure ids (`src/content/buildings.ts`) that change navigation. */
export const INFRA_BY_CONTENT: Readonly<Record<string, number>> = {
  ladder: INFRA.LADDER,
  platform: INFRA.PLATFORM,
  stairs: INFRA.STAIRS,
  wooden_door: INFRA.DOOR_WOOD,
  iron_door: INFRA.DOOR_IRON,
  bulkhead: INFRA.BULKHEAD,
  rail_track: INFRA.RAIL,
};

/** Off-mesh link kinds (bit index in `MoveProfile.links`). */
export const LINK = {
  /** Hanging rope: vertical, capacity 1, slower up than down. */
  ROPE: 0,
  /** Rope bridge over a chasm: traversal only, load limit. */
  BRIDGE: 1,
  /** Lift car between stops of one shaft. */
  LIFT: 2,
  /** Cart ride between rail stations. */
  RAIL: 3,
} as const;
export const LINK_ALL = 0b1111;

/** Result of a path query. */
export const NAV = {
  FOUND: 0,
  NO_PATH: 1,
  INVALID_START: 2,
  INVALID_GOAL: 3,
  /** Node expansion budget exhausted before a path was proven. */
  BUDGET: 4,
} as const;

/** Unreachable / unset cost. */
export const INF = 0x3fffffff;
