/**
 * World generator 2.0 as data (F2-2, level-systems-designer). The generator (`src/world/worldgen*.ts`,
 * M2) reads every number from here: no magic numbers in generator code. Design rationale, pass order and
 * acceptance metrics: `docs/design/levels/WORLDGEN.md`; level design: `docs/narrative/05-level-systems.md`.
 *
 * Coordinates: tiles, x to the right, `depth` = rows below the plain (depth 0 = row WORLD_FRAME.plainRow,
 * negative = above the plain, inside the mountain or in the sky). Densities are per mille (tiles of a
 * deposit per 1000 solid tiles of the biome). Ids reference the content bible and are checked by
 * `tests/content/worldgen.test.ts` (biomes, deposits, objects, creatures, hazards, items, buildings,
 * infrastructure, tech nodes, world material keys, quest milestones in docs/narrative/04-quests.md).
 */
import type { BiomeId, HazardId } from './types';

// =====================================================================================================
// Types
// =====================================================================================================

export type Range = readonly [number, number];
export type Side = 'W' | 'E';

/** Shape of a deposit body. */
export type VeinForm =
  /** Thin band along the strata (dips with the layers): seams, beds, crusts. */
  | 'seam'
  /** Branching random-walk vein, 1-2 tiles thick, follows strata or faults. */
  | 'vein'
  /** Compact blob (pods, nests). */
  | 'pod'
  /** Crust lining the walls of a void (geodes, saltpeter on cave walls, sulfur at vents). */
  | 'lining'
  /** Frozen flow on the floor of a lava void (obsidian). */
  | 'flow';

export type DepositClass = 'common' | 'strategic';

export interface DepositRule {
  deposit: string;
  /** Target density, per mille of the biome's solid tiles (acceptance: +-ACCEPTANCE.densityTolerance). */
  density: number;
  form: VeinForm;
  /** Tiles per vein (typical body; a mother lode is MOTHER_LODE.sizeMul larger). */
  vein: Range;
  /** Relative depth inside the biome band, 0 = top boundary, 1 = bottom boundary. */
  band: Range;
  cls: DepositClass;
  /** Mother lodes of this deposit in this biome (R1: inside hazard zones only). */
  motherLodes: number;
  /** Placement anchor: veins grow next to these voids / hazard cores (else anywhere in the band). */
  near?: 'void' | 'water' | 'lava' | 'vent' | 'geode' | HazardId;
}

export type CaveKind =
  | 'gallery' // horizontal tube along the strata
  | 'chimney' // vertical shaft
  | 'hall' // flat-floored room (old halls, karst rooms)
  | 'dome' // vaulted room: its roof always passes the structure model
  | 'fissure' // 1-2 tiles wide crack, vertical
  | 'bedding' // low and long void between strata (2-3 tall)
  | 'geode' // round void lined with crystals
  | 'sea' // chain of water-filled domes with islands
  | 'lavaRiver' // horizontal lava channel with an air gap above
  | 'lavaTube' // tube left by a lava flow
  | 'hexHall' // Prakowali hexagonal hall (ancient masonry walls)
  | 'chasm'; // wide vertical gap between two cave floors (needs a bridge)

export interface CaveForm {
  kind: CaveKind;
  /** Relative frequency inside the biome's void budget. */
  weight: number;
  /** Width and height ranges, tiles (for chained forms: the whole chain). */
  w: Range;
  h: Range;
  /**
   * Roof shape against the structure model (`src/sim/structure.ts`, evaluated on every row at start):
   * 'flat' = open runs as wide as the form (w <= 2 x natural capacity of the biome's roof rock, x2 when
   * h <= 2); 'vault' = arched roof, the run under the crown is (w/2) x sqrt(2/h) wide.
   */
  roof: 'flat' | 'vault';
  /** Chained forms (sea, lava rivers): width of one vault of the chain, separated by rock ribs or necks. */
  vaultW?: Range;
  /** Roof rock of this form when it differs from the band's `roofRock` (e.g. a lining around lava). */
  roofRock?: string;
  /** Long low passages: a squeeze (crawl pinch or floor bump, alternating) at most every this many tiles. */
  squeezeEvery?: number;
  /** Share of the form's volume filled with water / lava from the floor up (0..1). */
  water?: number;
  lava?: number;
}

export interface BiomeCaves {
  /** Share of the biome band (below the cap) that is natural void (open tiles, fluid included). */
  voidShare: Range;
  forms: readonly CaveForm[];
  /** Natural rock pillars that keep wide voids under the roof limit (structure model), tiles wide. */
  pillarWidth: Range;
  /** Hazard cores (R1/R4 anchors) of the biome: count and radius in tiles. */
  hazardCores: readonly { hazard: HazardId; count: Range; radius: Range; cue: string }[];
}

export interface HostRock {
  /** World material key (`MaterialInfo.key`); the set must equal `Biome.rocks`. */
  rock: string;
  /** Share of the biome's host-rock tiles (sums to 1). */
  share: number;
  /** How the rock is laid out: strata bands, irregular bodies, lining around voids, masonry walls. */
  layout: 'matrix' | 'strata' | 'bodies' | 'lining' | 'masonry' | 'shell';
  /** Strata or body thickness, tiles (for `strata`, `bodies`, `lining`). */
  thickness?: Range;
}

export interface BiomeBand {
  biome: BiomeId;
  /** Host rocks (spec of `Biome.rocks`). */
  rocks: readonly HostRock[];
  /**
   * Rock of the two rows above every natural void (its `ROCK_STRENGTH` sets the cave sizes). Linings and
   * deposits weaker than it (sand, soil, coal, saltpeter, sulfur, mycelium) never form those roof rows.
   */
  roofRock: string;
  /** Mixing zone with the biome above, tiles (top boundary +- half of it). */
  transition: number;
  /** Top boundary undulation: amplitude (tiles) and wavelength (tiles). */
  undulation: { amp: number; wavelength: number };
  /** Strata dip inside the band toward the Gorge axis, degrees (05 §1.4 leading line 2): seams and veins follow it. */
  dipDeg: number;
  /**
   * Range of the dip's shift of the band's top boundary, tiles: from -dipMax/2 at the far edge of a wing to
   * +dipMax/2 at the axis. 0 for the Limestone Ledges: their top is the soil skin (SURFACE.mountain.skin).
   */
  dipMax: number;
  /**
   * Cave-free rock under the top boundary (after the transition), tiles of this biome's host rock:
   * keeps the pick-tier gate of the biome hard (no natural opening from the biome above).
   */
  cap: number;
  caves: BiomeCaves;
}

export interface Landmark {
  id: string;
  /** Working name (lead-narrative approves names). */
  namePl: string;
  biome: BiomeId;
  role: 'hub' | 'key' | 'lair' | 'line' | 'vista' | 'tutorial' | 'cache';
  side: Side | 'axis' | 'both';
  /** Depth range of the landmark (top..bottom), tiles below the plain. */
  depth: Range;
  /** Width and height, tiles. */
  size: readonly [number, number];
  /** Horizontal distance from the Gorge axis to the landmark centre, tiles. */
  fromAxis: Range;
  descPl: string;
}

export interface Lair {
  creature: string;
  biome: BiomeId;
  /** Landmark that hosts the arena. */
  landmark: string;
  /** Leash radius of the boss around the arena centre, tiles. */
  leash: number;
  /** Minimum walking distance from the biome hub (never next to the base), tiles. */
  minFromHub: number;
  /** Visible cue from a safe place (R4). */
  cue: string;
}

export interface SpawnRule {
  creature: string;
  /** Packs per 1000 open floor tiles of the biome (wild zone; none within hubSafeRadius). */
  perKFloor: number;
  pack: Range;
  minSpacing: number;
  zone: 'wild' | 'hazard' | 'surface' | 'water' | 'raid';
}

export interface ObjectRule {
  object: string;
  /** Objects per 100 tiles of suitable floor (surface or cave floor) of the biome. */
  per100: number;
  minSpacing: number;
  where: 'surface' | 'forest' | 'meadow' | 'caveFloor' | 'caveWall' | 'shore' | 'underwater' | 'ruin' | 'lairs';
}

export interface Window {
  biome: BiomeId;
  side: Side;
  /** Depth range of the opening in the Gorge wall, tiles below the plain. */
  depth: Range;
  /** What closes it on the biome side: host-rock plug (pick tier gate) or a sung lock (level). */
  gate: { kind: 'plug'; thickness: number } | { kind: 'songLock'; level: number };
}

export interface Seal {
  id: string;
  namePl: string;
  /** Depth of the top of the seal, tiles below the plain. */
  depth: number;
  thickness: number;
  opens: readonly GateRef[];
}

export interface GateRef {
  kind: 'item' | 'building' | 'infra' | 'tech' | 'creature' | 'quest' | 'hazard' | 'resource';
  id: string;
}

export interface SoftGate {
  biome: BiomeId;
  hazard: HazardId;
  /** What happens without counters (numbers for the hazard systems). */
  effect: string;
  /** Exposure the generator lets the player see before committing (R4 cue). */
  cue: string;
  /** Counters the player needs to stay (subset of the hazard's counters, plus extras). */
  counters: readonly GateRef[];
}

export interface HardGate {
  id: string;
  /** Biome entered (or 'axis' for Gorge seals). */
  biome: BiomeId;
  kind: 'pickTier' | 'seal' | 'songLock' | 'chasm' | 'noReturn';
  requires: readonly GateRef[];
  descPl: string;
}

// =====================================================================================================
// 1. Frame and surface
// =====================================================================================================

/** Vertical layout of the 224 x 736 grid (CONFIG.worldW/worldH; BUG-006). */
export const WORLD_FRAME = {
  w: 224,
  h: 736,
  /** Row of depth 0 (the plain). Rows above it: sky and the mountain. */
  plainRow: 40,
  /** Depth of the bottom of the Heart (last biome row is plainRow + biomeDepth - 1). */
  biomeDepth: 680,
  /** Bedrock floor under the Heart: unbreakable, reads as the end of the world. */
  floorRows: 16,
  floorMaterial: 'bedrock',
  /** Open rows kept above the summit so a dwarf can stand on the crater rim. */
  skyAboveSummit: 4,
} as const;

/** The surface strip: meadow and camp, forest, the mountain with its crater, the stream and the ponor. */
export const SURFACE = {
  meadow: { x: [0, 60] as Range, heightNoise: 1.5, wavelength: 40 },
  forest: { x: [56, 104] as Range },
  mountain: {
    /** Base of the cone and its peak (05 §1.1: 150 tiles wide, peak right of centre). */
    baseX: [75, 224] as Range,
    peakX: 150,
    /** Crater rim height above the plain (40 rows above the plain minus the sky margin). */
    rimHeight: 36,
    /** Slope angle along the flanks, measured over 8-column windows. */
    slopeDeg: [18, 38] as Range,
    /** Steps on every walkable slope are at most this tall (wolves and dwarves cross the summit). */
    maxStep: 1,
    /** Soil skin over the uplifted limestone: plain 20 tiles, thinning on the flanks. */
    skin: { plain: 20, flank: 5 },
    crater: {
      /** Opening at the rim, floor width and depth below the rim, tiles. */
      topWidth: 12,
      floorWidth: 4,
      depth: 8,
      /** Bedrock plug between the crater floor and the Gorge shaft (steam and glow are effects). */
      plug: 3,
    },
  },
  stream: {
    /** Snowfield spring on the west flank, the waterfall step and the ponor on the meadow. */
    springX: [132, 140] as Range,
    waterfall: { x: [96, 104] as Range, height: 12 },
    /** Surface channel 1-2 tiles deep, flowing west from the waterfall to the ponor. */
    depth: [1, 2] as Range,
    ponorX: [44, 52] as Range,
    /** The ponor drains into the karst channel of the Limestone Ledges at this depth. */
    karstDepth: [40, 60] as Range,
  },
  /** Natural cave entrances on the flanks (QUALITY E3: at least one). */
  caveEntrances: { count: [1, 2] as Range, side: 'W' as Side, minFromCamp: 40 },
} as const;

// =====================================================================================================
// 2. The Gorge (Gardziel): axis, walls, windows, seals, chord pillars
// =====================================================================================================

export const GORGE = {
  /** Axis x at the crater; it meanders gently with depth (sine + noise), staying inside axisRange. */
  axisX: 150,
  meander: { amp: 4, wavelength: 120 },
  axisRange: [144, 156] as Range,
  /** Open width of the shaft. */
  width: [6, 10] as Range,
  /** Prakowali stone wall on both sides (tier 9). `bedrock` until a dedicated material exists. */
  wall: { material: 'bedrock', thickness: 2 },
  /** Shaft runs from the crater plug to the top of the Heart chamber. */
  depth: [-28, 642] as Range,
  /** Pairs of chord pillars in both walls every `spacing` rows (05 leading line 3), pale-blue emitters. */
  chordPillars: { spacing: 40, height: 6 },
  /** Ledges inside the shaft: never a walkable descent (logistics needs ladders, ropes, lifts). */
  maxLedgeRun: 2,
  minLedgeGap: 5,
  windows: [
    { biome: 'limestone', side: 'W', depth: [36, 41], gate: { kind: 'plug', thickness: 2 } },
    { biome: 'limestone', side: 'E', depth: [74, 79], gate: { kind: 'plug', thickness: 2 } },
    { biome: 'granite', side: 'E', depth: [117, 122], gate: { kind: 'plug', thickness: 2 } },
    { biome: 'granite', side: 'W', depth: [140, 145], gate: { kind: 'plug', thickness: 2 } },
    { biome: 'fungal', side: 'W', depth: [204, 209], gate: { kind: 'plug', thickness: 2 } },
    { biome: 'fungal', side: 'E', depth: [246, 251], gate: { kind: 'plug', thickness: 2 } },
    { biome: 'sunken', side: 'W', depth: [312, 317], gate: { kind: 'plug', thickness: 2 } },
    { biome: 'sunken', side: 'E', depth: [340, 345], gate: { kind: 'plug', thickness: 2 } },
    { biome: 'crystal', side: 'E', depth: [392, 397], gate: { kind: 'plug', thickness: 2 } },
    { biome: 'crystal', side: 'W', depth: [430, 435], gate: { kind: 'plug', thickness: 2 } },
    { biome: 'magma', side: 'W', depth: [486, 491], gate: { kind: 'plug', thickness: 2 } },
    { biome: 'magma', side: 'E', depth: [520, 525], gate: { kind: 'plug', thickness: 2 } },
    { biome: 'ancient', side: 'E', depth: [568, 573], gate: { kind: 'songLock', level: 3 } },
    { biome: 'ancient', side: 'W', depth: [606, 611], gate: { kind: 'songLock', level: 4 } },
  ] as readonly Window[],
  /** Seals cut the shaft into segments; each segment holds the windows of the biomes between seals. */
  seals: [
    {
      id: 'seal_first', namePl: 'Pierwsza Pieczęć', depth: 150, thickness: 3,
      opens: [{ kind: 'quest', id: 'KM2' }, { kind: 'tech', id: 'blasting' }],
    },
    {
      id: 'seal_water', namePl: 'Pieczęć Wodna', depth: 300, thickness: 3,
      opens: [{ kind: 'item', id: 'diving_helmet' }, { kind: 'building', id: 'pump_station' }, { kind: 'tech', id: 'steam_pump' }],
    },
    {
      id: 'seal_fire', namePl: 'Brama Popiołu', depth: 470, thickness: 3,
      opens: [{ kind: 'quest', id: 'QDD-L8' }, { kind: 'infra', id: 'cooler' }, { kind: 'tech', id: 'cooling_grid' }],
    },
    {
      id: 'seal_heart', namePl: 'Brama Serca', depth: 640, thickness: 2,
      opens: [{ kind: 'quest', id: 'KM4' }, { kind: 'resource', id: 'heart_key' }],
    },
  ] as readonly Seal[],
} as const;

// =====================================================================================================
// 3. Biome bands: host rocks, boundaries, caves and hazard cores
// =====================================================================================================

export const BANDS: readonly BiomeBand[] = [
  {
    biome: 'foothills',
    rocks: [{ rock: 'soil', share: 1, layout: 'matrix' }],
    roofRock: 'soil',
    transition: 0, undulation: { amp: 0, wavelength: 1 }, dipDeg: 0, dipMax: 0, cap: 0,
    caves: {
      voidShare: [0.02, 0.06],
      forms: [
        { kind: 'gallery', weight: 2, w: [8, 20], h: [2, 2], roof: 'flat' },
        { kind: 'chasm', weight: 1, w: [4, 8], h: [8, 14], roof: 'vault' },
      ],
      pillarWidth: [1, 2],
      hazardCores: [{ hazard: 'night_predators', count: [1, 1], radius: [10, 14], cue: 'kości i wycie z wąwozu o zmierzchu' }],
    },
  },
  {
    biome: 'limestone',
    rocks: [
      { rock: 'limestone', share: 0.6, layout: 'strata', thickness: [6, 14] },
      { rock: 'sandstone', share: 0.25, layout: 'strata', thickness: [4, 10] },
      { rock: 'shale', share: 0.15, layout: 'strata', thickness: [2, 5] },
    ],
    roofRock: 'limestone',
    transition: 4, undulation: { amp: 4, wavelength: 70 }, dipDeg: 6, dipMax: 0, cap: 3,
    caves: {
      voidShare: [0.1, 0.16],
      forms: [
        // karst passages: low, squeezed every <= 15 tiles (limestone natural low-roof run 30)
        { kind: 'gallery', weight: 3, w: [30, 90], h: [2, 2], roof: 'flat', squeezeEvery: 15, water: 0.3 },
        { kind: 'chimney', weight: 2, w: [2, 4], h: [10, 30], roof: 'flat' },
        { kind: 'hall', weight: 2, w: [8, 14], h: [4, 7], roof: 'flat' },
        { kind: 'bedding', weight: 3, w: [12, 30], h: [2, 2], roof: 'flat' },
        { kind: 'dome', weight: 1, w: [16, 26], h: [10, 14], roof: 'vault' },
      ],
      pillarWidth: [2, 4],
      hazardCores: [
        { hazard: 'darkness', count: [2, 3], radius: [12, 18], cue: 'nietoperze wylatujące o zmierzchu' },
        { hazard: 'cave_ins', count: [2, 4], radius: [6, 10], cue: 'gruz na dnie i spękany strop' },
      ],
    },
  },
  {
    biome: 'granite',
    rocks: [
      { rock: 'granite', share: 0.8, layout: 'matrix' },
      { rock: 'slate', share: 0.2, layout: 'bodies', thickness: [3, 8] },
    ],
    roofRock: 'granite',
    transition: 6, undulation: { amp: 6, wavelength: 60 }, dipDeg: 5, dipMax: 9, cap: 4,
    caves: {
      voidShare: [0.06, 0.1],
      forms: [
        // pressure fissures: sealed water pockets (breach = flood), 1-2 tiles wide
        { kind: 'fissure', weight: 4, w: [1, 2], h: [8, 25], roof: 'flat', water: 0.4 },
        { kind: 'gallery', weight: 2, w: [20, 34], h: [3, 4], roof: 'flat', water: 0.2 },
        { kind: 'hall', weight: 1, w: [10, 24], h: [5, 9], roof: 'flat' },
        { kind: 'dome', weight: 1, w: [18, 30], h: [10, 16], roof: 'vault' },
      ],
      pillarWidth: [2, 3],
      hazardCores: [
        { hazard: 'flooding', count: [3, 5], radius: [4, 8], cue: 'wilgotne zacieki i szum wody za ścianą' },
      ],
    },
  },
  {
    biome: 'fungal',
    rocks: [
      { rock: 'sporeShale', share: 0.7, layout: 'matrix' },
      { rock: 'mycelium', share: 0.3, layout: 'lining', thickness: [1, 3] },
    ],
    roofRock: 'sporeShale',
    transition: 6, undulation: { amp: 7, wavelength: 55 }, dipDeg: 4, dipMax: 8, cap: 3,
    caves: {
      voidShare: [0.22, 0.3],
      forms: [
        // grottos: vaults up to 48 wide (sporeShale crown); the 60-wide Great Grotto is two vaults
        { kind: 'dome', weight: 3, w: [36, 48], h: [24, 30], roof: 'vault' },
        { kind: 'chimney', weight: 2, w: [3, 6], h: [20, 36], roof: 'flat' },
        { kind: 'gallery', weight: 2, w: [20, 40], h: [2, 2], roof: 'flat', squeezeEvery: 15 },
        { kind: 'chasm', weight: 1, w: [8, 20], h: [12, 24], roof: 'vault' },
      ],
      pillarWidth: [2, 4],
      hazardCores: [
        { hazard: 'spores', count: [4, 6], radius: [5, 8], cue: 'turkusowa mgiełka i martwe ćmy na dnie' },
        { hazard: 'poison', count: [2, 3], radius: [8, 12], cue: 'pajęczyny w kominach i owinięte kokony' },
      ],
    },
  },
  {
    biome: 'sunken',
    rocks: [{ rock: 'mudstone', share: 1, layout: 'matrix' }],
    roofRock: 'mudstone',
    transition: 6, undulation: { amp: 5, wavelength: 80 }, dipDeg: 3, dipMax: 6, cap: 3,
    caves: {
      voidShare: [0.25, 0.35],
      forms: [
        // the sea: a chain of three water-filled vaults, rock ribs and islands between them
        { kind: 'sea', weight: 4, w: [110, 130], h: [26, 34], roof: 'vault', vaultW: [32, 46], water: 0.75 },
        { kind: 'dome', weight: 2, w: [16, 28], h: [10, 16], roof: 'vault', water: 0.9 },
        { kind: 'gallery', weight: 1, w: [20, 40], h: [2, 2], roof: 'flat', squeezeEvery: 15, water: 0.5 },
      ],
      pillarWidth: [3, 6],
      hazardCores: [
        { hazard: 'deep_water', count: [3, 4], radius: [10, 16], cue: 'czarna toń bez dna i bańki z głębi' },
        { hazard: 'flooding', count: [2, 3], radius: [5, 8], cue: 'kapiący strop nad nisko położonym chodnikiem' },
      ],
    },
  },
  {
    biome: 'crystal',
    rocks: [{ rock: 'schist', share: 1, layout: 'matrix' }],
    roofRock: 'schist',
    transition: 6, undulation: { amp: 6, wavelength: 65 }, dipDeg: 5, dipMax: 9, cap: 4,
    caves: {
      voidShare: [0.15, 0.22],
      forms: [
        { kind: 'geode', weight: 3, w: [30, 45], h: [30, 45], roof: 'vault' },
        { kind: 'geode', weight: 3, w: [8, 16], h: [8, 16], roof: 'vault' },
        { kind: 'gallery', weight: 2, w: [16, 24], h: [3, 4], roof: 'flat' },
        { kind: 'dome', weight: 1, w: [14, 22], h: [8, 12], roof: 'vault' },
      ],
      pillarWidth: [2, 3],
      hazardCores: [
        { hazard: 'cold', count: [3, 5], radius: [8, 14], cue: 'szron na ścianach i para oddechu w świetle' },
        { hazard: 'darkness', count: [2, 3], radius: [12, 18], cue: 'kryształy gasnące jeden po drugim' },
      ],
    },
  },
  {
    biome: 'magma',
    rocks: [
      { rock: 'basalt', share: 0.75, layout: 'matrix' },
      { rock: 'magmaRock', share: 0.25, layout: 'lining', thickness: [2, 4] },
    ],
    roofRock: 'basalt',
    transition: 6, undulation: { amp: 5, wavelength: 50 }, dipDeg: 2, dipMax: 4, cap: 4,
    caves: {
      voidShare: [0.18, 0.26],
      forms: [
        // lava rivers are lined with magma rock up to their crown: necks every 20-30 tiles (2 x 15)
        { kind: 'lavaRiver', weight: 3, w: [60, 140], h: [5, 8], roof: 'flat', vaultW: [20, 30], roofRock: 'magmaRock', lava: 0.45 },
        { kind: 'lavaTube', weight: 2, w: [20, 40], h: [3, 5], roof: 'flat' },
        { kind: 'dome', weight: 1, w: [40, 52], h: [18, 24], roof: 'vault' },
        { kind: 'chimney', weight: 1, w: [2, 4], h: [10, 24], roof: 'flat' },
      ],
      pillarWidth: [2, 4],
      hazardCores: [
        { hazard: 'lava', count: [3, 4], radius: [6, 10], cue: 'czerwona poświata i drżące powietrze nad szczeliną' },
        { hazard: 'heat', count: [3, 5], radius: [10, 16], cue: 'pękające skorupy i para z sączącej się wody' },
        { hazard: 'fumes', count: [2, 3], radius: [5, 8], cue: 'żółte naloty siarki i syk wyziewów' },
      ],
    },
  },
  {
    biome: 'ancient',
    rocks: [
      { rock: 'deepstone', share: 0.8, layout: 'matrix' },
      { rock: 'ancientBrick', share: 0.2, layout: 'masonry', thickness: [1, 2] },
    ],
    roofRock: 'deepstone',
    transition: 4, undulation: { amp: 3, wavelength: 90 }, dipDeg: 0, dipMax: 0, cap: 4,
    caves: {
      voidShare: [0.2, 0.28],
      forms: [
        { kind: 'hexHall', weight: 4, w: [12, 24], h: [12, 24], roof: 'vault' },
        { kind: 'gallery', weight: 3, w: [20, 44], h: [4, 4], roof: 'flat' },
        { kind: 'chimney', weight: 1, w: [3, 3], h: [12, 30], roof: 'flat' },
      ],
      pillarWidth: [2, 2],
      hazardCores: [
        { hazard: 'dread', count: [3, 4], radius: [12, 20], cue: 'drżąca kreska i gasnące lampy w głębi sali' },
        { hazard: 'constructs', count: [2, 3], radius: [8, 12], cue: 'regularny stukot i prosto ułożony gruz' },
      ],
    },
  },
  {
    biome: 'heart',
    rocks: [
      { rock: 'heartstone', share: 0.9, layout: 'matrix' },
      { rock: 'bedrock', share: 0.1, layout: 'shell', thickness: [2, 3] },
    ],
    roofRock: 'heartstone',
    transition: 3, undulation: { amp: 0, wavelength: 1 }, dipDeg: 0, dipMax: 0, cap: 0,
    caves: {
      voidShare: [0.12, 0.2],
      forms: [{ kind: 'dome', weight: 1, w: [36, 36], h: [34, 36], roof: 'vault' }],
      pillarWidth: [0, 0],
      hazardCores: [{ hazard: 'dread', count: [1, 1], radius: [18, 18], cue: 'czerwony puls dna Gardzieli' }],
    },
  },
];

// =====================================================================================================
// 4. Landmarks and leading lines
// =====================================================================================================

export const LANDMARKS: readonly Landmark[] = [
  // T0 Foothills
  { id: 'camp', namePl: 'Obóz przy wozie', biome: 'foothills', role: 'hub', side: 'W', depth: [-2, 0], size: [17, 3], fromAxis: [120, 136], descPl: 'Płaski plac pod wóz i ognisko na łące; pierwszy kadr gry.' },
  { id: 'wolf_ravine', namePl: 'Wilczy Wąwóz', biome: 'foothills', role: 'lair', side: 'W', depth: [-14, 6], size: [16, 10], fromAxis: [28, 46], descPl: 'Wąwóz u stóp zachodniego zbocza; leże Wilczego Herszta, widoczne z obozu jako ciemna szczerba.' },
  { id: 'waterfall', namePl: 'Wodospad Śnieżnika', biome: 'foothills', role: 'line', side: 'W', depth: [-24, -12], size: [4, 12], fromAxis: [46, 54], descPl: 'Strumień ze śnieżnika spada z progu skalnego i płynie łąką do ponoru.' },
  { id: 'crater', namePl: 'Krater Kuźnicy', biome: 'foothills', role: 'vista', side: 'axis', depth: [-36, -28], size: [12, 8], fromAxis: [0, 0], descPl: 'Łuna i para nad szczytem; pierwsze ujęcie gry kończy się na niej.' },
  // T1 Limestone
  { id: 'first_ledge_hall', namePl: 'Sala Pierwszego Progu', biome: 'limestone', role: 'hub', side: 'W', depth: [24, 30], size: [14, 6], fromAxis: [100, 116], descPl: 'Sala chóru z niszami i sześcioma zbutwiałymi stemplami; miejsce zawału i grobu króla, potem hub Progów.' },
  { id: 'old_shaft', namePl: 'Stary Szyb', biome: 'limestone', role: 'tutorial', side: 'W', depth: [0, 24], size: [2, 24], fromAxis: [96, 110], descPl: 'Szyb dawnego królestwa z łąki do Sali Pierwszego Progu; górne 3 kafle zasypane, bez drabin.' },
  { id: 'karst_channel', namePl: 'Kanał Ponoru', biome: 'limestone', role: 'line', side: 'W', depth: [40, 60], size: [90, 4], fromAxis: [10, 100], descPl: 'Kanał krasowy, którym woda z ponoru płynie ku Gardzieli; koła wodne i droga w dół.' },
  { id: 'bat_grotto', namePl: 'Grota Królowej Nietoperzy', biome: 'limestone', role: 'lair', side: 'E', depth: [70, 95], size: [24, 14], fromAxis: [28, 52], descPl: 'Kopuła z guanem i naloty saletry; przy niej gaśnie każde nieosłonięte światło.' },
  { id: 'ash_chimney', namePl: 'Komin Popiołu', biome: 'limestone', role: 'key', side: 'E', depth: [30, 70], size: [4, 40], fromAxis: [12, 22], descPl: 'Komin z zakopconymi ścianami: pierwszy ślad czarnego ognia sprzed 312 lat.' },
  // T2 Granite
  { id: 'throne_hall', namePl: 'Sala Tronowa', biome: 'granite', role: 'hub', side: 'E', depth: [112, 126], size: [40, 14], fromAxis: [14, 54], descPl: 'Sala królestwa z sześcioma filarami; hub Korzeni przy wschodnim oknie Gardzieli.' },
  { id: 'brood_fissure', namePl: 'Gniazdo Matki Pełzaczy', biome: 'granite', role: 'lair', side: 'W', depth: [150, 170], size: [12, 20], fromAxis: [10, 24], descPl: 'Zalana szczelina przy Pierwszej Pieczęci; kości przy wejściu.' },
  { id: 'seal_vestibule', namePl: 'Przedsionek Pieczęci', biome: 'granite', role: 'key', side: 'W', depth: [146, 158], size: [12, 12], fromAxis: [6, 18], descPl: 'Sześciokątny przedsionek Prakowali za gniazdem Matki Pełzaczy; pierwszy Krążek Prakowali (KM2).' },
  // T3 Fungal
  { id: 'great_grotto', namePl: 'Wielka Grota', biome: 'fungal', role: 'hub', side: 'W', depth: [196, 226], size: [60, 30], fromAxis: [40, 100], descPl: 'Największa z trzech grot, las grzybów do 18 kafli; hub Grot.' },
  { id: 'web_chimney', namePl: 'Leże Królowej Pajęczyn', biome: 'fungal', role: 'lair', side: 'E', depth: [240, 275], size: [8, 35], fromAxis: [20, 40], descPl: 'Komin zasnuty jedwabiem nad przepaścią; kokony widać z mostu.' },
  { id: 'mycelium_heart', namePl: 'Serce Grzybni', biome: 'fungal', role: 'key', side: 'E', depth: [250, 270], size: [20, 14], fromAxis: [30, 60], descPl: 'Pulsująca bryła grzybni; najgęstsze kieszenie zarodników.' },
  // T4 Sunken
  { id: 'west_harbor', namePl: 'Przystań Zachodnia', biome: 'sunken', role: 'hub', side: 'W', depth: [300, 312], size: [20, 10], fromAxis: [100, 128], descPl: 'Wyspa przy zachodnim brzegu morza; hub Głębi.' },
  { id: 'sunken_sea', namePl: 'Podziemne Morze', biome: 'sunken', role: 'line', side: 'W', depth: [306, 340], size: [120, 34], fromAxis: [66, 80], descPl: 'Łańcuch trzech zalanych sklepień z wyspami w skrzydle zachodnim; prądy prowadzą ku Gardzieli.' },
  { id: 'sunken_archive', namePl: 'Zatopione Archiwum', biome: 'sunken', role: 'lair', side: 'E', depth: [344, 362], size: [24, 14], fromAxis: [16, 50], descPl: 'Ruina na dnie zatoki wschodniej (za Gardzielą), Wielki Krążek; Lewiatan.' },
  // T5 Crystal
  { id: 'cathedral_geode', namePl: 'Geoda Katedralna', biome: 'crystal', role: 'hub', side: 'E', depth: [376, 416], size: [40, 40], fromAxis: [20, 60], descPl: 'Geoda wielkości katedry przy wschodnim oknie; hub Kryształowych.' },
  { id: 'pump_station', namePl: 'Stacja pomp Prakowali', biome: 'crystal', role: 'lair', side: 'W', depth: [424, 452], size: [30, 28], fromAxis: [20, 60], descPl: 'Lodowa komora z maszyną Prakowali; Kryształowy Kolos.' },
  // T6 Magma
  { id: 'ash_dome', namePl: 'Kopuła Popielnych', biome: 'magma', role: 'hub', side: 'W', depth: [478, 502], size: [50, 24], fromAxis: [40, 100], descPl: 'Kopuła z zastygłej lawy; gród Popielnych i hub Pasa.' },
  { id: 'wyrm_tubes', namePl: 'Tunele Robaka', biome: 'magma', role: 'lair', side: 'E', depth: [520, 545], size: [40, 25], fromAxis: [20, 70], descPl: 'Splot tuneli lawowych nad rzeką lawy; Pradawny Robak Magmowy.' },
  // T7 Ancient
  { id: 'ruin_archive', namePl: 'Archiwum Ruin', biome: 'ancient', role: 'hub', side: 'E', depth: [558, 582], size: [24, 24], fromAxis: [16, 50], descPl: 'Sześciokątna sala z półkami Krążków; hub Prastarych.' },
  { id: 'gatekeeper_hall', namePl: 'Sala Odźwiernego', biome: 'ancient', role: 'lair', side: 'axis', depth: [616, 638], size: [36, 22], fromAxis: [0, 18], descPl: 'Przedsionek Bramy Serca nad dnem Gardzieli; Odźwierny i Strażnik Ruin.' },
  // T8 Heart
  { id: 'heart_chamber', namePl: 'Komora Serca', biome: 'heart', role: 'lair', side: 'axis', depth: [642, 678], size: [36, 36], fromAxis: [0, 0], descPl: 'Kulista komora z Kowadłem Serca; Pożeracz Światła.' },
];

/** Lines that lead the eye and the feet toward the Gorge (05 §1.4). */
export const LEADING_LINES = {
  /** The red pulse leaks through every window plug (light passes <= 2 tiles of rock, QUALITY E4). */
  gorgePulse: { maxPlugForLight: 2 },
  /** Ore veins and seams follow the strata dip (BANDS[].dipDeg): kopanie „spływa” ku osi. */
  strataDip: true,
  /** Old kingdom road from each hub to its window (biomes 1-6): galleries, stairs, rusted rails. */
  kingdomRoad: {
    biomes: ['limestone', 'granite', 'fungal', 'sunken', 'crystal', 'magma'] as readonly BiomeId[],
    /** Walkable for the dwarf profile with generator stairs and ladders; drops <= CONFIG.maxSafeDrop. */
    maxDrop: 3,
    /** One-way drops on the road (the way back needs a ladder: a cheap first investment). */
    oneWayDrops: [1, 3] as Range,
    /** Rail ruins along the road (cheaper rebuild), share of the road length. */
    railShare: [0.3, 0.5] as Range,
    /** Gaps of exactly 2 tiles never cross the road (they look crossable, but are not). */
    noGapWidth: 2,
  },
  /** Prakowali causeway in the Ancient Deep: straight, perfectly level, lit by chord pillars when sung. */
  causeway: { biome: 'ancient' as BiomeId, level: true },
  /** Water always flows toward the next descent (05 §1.3): stream -> ponor -> karst -> fissures -> sea. */
  waterChain: ['stream', 'ponor', 'karst_channel', 'granite_fissures', 'sunken_sea', 'steam_vents'] as readonly string[],
  /** Bats leave the karst caves at dusk (cave entrances), turquoise glow leaks from granite cracks. */
  previewWindows: { perBoundary: [1, 2] as Range, wall: 2 },
} as const;

// =====================================================================================================
// 5. Deposits per biome (05 §2.2; supply vs demand: WORLDGEN.md §4)
// =====================================================================================================

/** R1: mother lodes are larger, richer and sit inside hazard zones (or in the Gorge wall rock). */
export const MOTHER_LODE = {
  sizeMul: [3, 5] as Range,
  yieldMul: 3,
  /** Distance from the centre of the mother lode to the nearest hazard core, tiles. */
  maxFromHazard: 12,
  /** Distance from the hub of the biome, tiles. */
  minFromHub: 30,
} as const;

/** The Heart has no deposits by design: it is the final arena (reward: the boss and the Anvil). */
export const NO_DEPOSIT_BIOMES: readonly BiomeId[] = ['heart'];

export const DEPOSIT_RULES: Readonly<Record<BiomeId, readonly DepositRule[]>> = {
  foothills: [
    { deposit: 'clay_bed', density: 35, form: 'pod', vein: [15, 40], band: [0.2, 1], cls: 'common', motherLodes: 0 },
    { deposit: 'sand_bed', density: 30, form: 'seam', vein: [15, 40], band: [0, 0.6], cls: 'common', motherLodes: 0, near: 'water' },
    { deposit: 'copper_vein', density: 16, form: 'vein', vein: [12, 20], band: [0.1, 1], cls: 'strategic', motherLodes: 0 },
  ],
  limestone: [
    { deposit: 'clay_bed', density: 30, form: 'pod', vein: [15, 40], band: [0, 0.5], cls: 'common', motherLodes: 0 },
    { deposit: 'limestone_bed', density: 20, form: 'seam', vein: [20, 60], band: [0, 1], cls: 'common', motherLodes: 0 },
    { deposit: 'coal_seam', density: 40, form: 'seam', vein: [15, 40], band: [0.2, 1], cls: 'common', motherLodes: 0 },
    { deposit: 'copper_vein', density: 20, form: 'vein', vein: [8, 20], band: [0, 1], cls: 'strategic', motherLodes: 2, near: 'cave_ins' },
    { deposit: 'tin_vein', density: 10, form: 'vein', vein: [6, 12], band: [0.3, 1], cls: 'strategic', motherLodes: 2, near: 'darkness' },
    { deposit: 'saltpeter_crust', density: 4, form: 'lining', vein: [4, 10], band: [0.5, 1], cls: 'strategic', motherLodes: 1, near: 'darkness' },
  ],
  granite: [
    { deposit: 'coal_seam', density: 35, form: 'seam', vein: [15, 40], band: [0, 0.6], cls: 'common', motherLodes: 0 },
    { deposit: 'copper_vein', density: 14, form: 'vein', vein: [8, 20], band: [0, 0.6], cls: 'strategic', motherLodes: 1, near: 'flooding' },
    { deposit: 'iron_vein', density: 14, form: 'vein', vein: [10, 25], band: [0.2, 1], cls: 'strategic', motherLodes: 2, near: 'flooding' },
    { deposit: 'lead_vein', density: 5, form: 'vein', vein: [6, 14], band: [0.3, 1], cls: 'strategic', motherLodes: 1, near: 'flooding' },
    { deposit: 'zinc_vein', density: 5, form: 'vein', vein: [6, 14], band: [0.3, 1], cls: 'strategic', motherLodes: 1, near: 'flooding' },
    { deposit: 'quartz_vein', density: 6, form: 'vein', vein: [10, 30], band: [0, 1], cls: 'strategic', motherLodes: 1, near: 'flooding' },
  ],
  fungal: [
    { deposit: 'coal_seam', density: 30, form: 'seam', vein: [15, 40], band: [0, 0.5], cls: 'common', motherLodes: 0 },
    { deposit: 'iron_vein', density: 12, form: 'vein', vein: [10, 25], band: [0, 1], cls: 'strategic', motherLodes: 1, near: 'poison' },
    { deposit: 'silver_vein', density: 5, form: 'vein', vein: [5, 12], band: [0.3, 1], cls: 'strategic', motherLodes: 1, near: 'spores' },
    { deposit: 'sulfur_vent', density: 4, form: 'lining', vein: [3, 8], band: [0.4, 1], cls: 'strategic', motherLodes: 1, near: 'spores' },
  ],
  sunken: [
    { deposit: 'sand_bed', density: 30, form: 'flow', vein: [20, 50], band: [0, 1], cls: 'common', motherLodes: 0, near: 'water' },
    { deposit: 'salt_bed', density: 10, form: 'seam', vein: [20, 50], band: [0, 0.7], cls: 'common', motherLodes: 1, near: 'flooding' },
    { deposit: 'iron_vein', density: 12, form: 'vein', vein: [10, 25], band: [0, 1], cls: 'strategic', motherLodes: 0 },
    { deposit: 'silver_vein', density: 5, form: 'vein', vein: [5, 12], band: [0.2, 1], cls: 'strategic', motherLodes: 1, near: 'deep_water' },
    { deposit: 'nickel_vein', density: 4, form: 'pod', vein: [5, 10], band: [0.3, 1], cls: 'strategic', motherLodes: 1, near: 'deep_water' },
    { deposit: 'gold_vein', density: 2, form: 'vein', vein: [3, 6], band: [0.5, 1], cls: 'strategic', motherLodes: 0, near: 'deep_water' },
  ],
  crystal: [
    { deposit: 'quartz_vein', density: 6, form: 'vein', vein: [10, 30], band: [0, 1], cls: 'strategic', motherLodes: 1, near: 'cold' },
    { deposit: 'silver_vein', density: 5, form: 'vein', vein: [5, 12], band: [0, 0.6], cls: 'strategic', motherLodes: 0 },
    { deposit: 'gold_vein', density: 2, form: 'vein', vein: [3, 6], band: [0.3, 1], cls: 'strategic', motherLodes: 1, near: 'cold' },
    { deposit: 'cobalt_vein', density: 4, form: 'vein', vein: [5, 10], band: [0.2, 1], cls: 'strategic', motherLodes: 1, near: 'cold' },
    { deposit: 'amethyst_geode', density: 3, form: 'lining', vein: [10, 30], band: [0, 1], cls: 'strategic', motherLodes: 1, near: 'cold' },
    { deposit: 'sapphire_geode', density: 2, form: 'lining', vein: [10, 30], band: [0.4, 1], cls: 'strategic', motherLodes: 1, near: 'cold' },
    { deposit: 'frost_crystal_bed', density: 3, form: 'lining', vein: [10, 30], band: [0.2, 1], cls: 'strategic', motherLodes: 1, near: 'cold' },
  ],
  magma: [
    { deposit: 'obsidian_flow', density: 20, form: 'flow', vein: [10, 40], band: [0, 1], cls: 'common', motherLodes: 0, near: 'lava' },
    { deposit: 'sulfur_vent', density: 4, form: 'lining', vein: [3, 8], band: [0, 1], cls: 'strategic', motherLodes: 0, near: 'fumes' },
    { deposit: 'gold_vein', density: 2, form: 'vein', vein: [3, 6], band: [0, 1], cls: 'strategic', motherLodes: 0, near: 'heat' },
    { deposit: 'ruby_geode', density: 2, form: 'pod', vein: [3, 8], band: [0.3, 1], cls: 'strategic', motherLodes: 0, near: 'heat' },
    { deposit: 'emberite_vein', density: 4, form: 'vein', vein: [5, 12], band: [0.3, 1], cls: 'strategic', motherLodes: 1, near: 'lava' },
  ],
  ancient: [
    { deposit: 'gold_vein', density: 3, form: 'vein', vein: [3, 6], band: [0, 1], cls: 'strategic', motherLodes: 1, near: 'constructs' },
    { deposit: 'amethyst_geode', density: 2, form: 'lining', vein: [6, 16], band: [0, 0.6], cls: 'strategic', motherLodes: 0, near: 'geode' },
    { deposit: 'runestone_vein', density: 4, form: 'vein', vein: [3, 8], band: [0, 1], cls: 'strategic', motherLodes: 0, near: 'constructs' },
    { deposit: 'adamantite_vein', density: 2, form: 'vein', vein: [2, 6], band: [0.4, 1], cls: 'strategic', motherLodes: 1, near: 'dread' },
    { deposit: 'glimmerite_vein', density: 0.6, form: 'vein', vein: [2, 5], band: [0.7, 1], cls: 'strategic', motherLodes: 1, near: 'dread' },
  ],
  heart: [],
};

// =====================================================================================================
// 6. Objects and creatures
// =====================================================================================================

export const OBJECT_RULES: Readonly<Record<BiomeId, readonly ObjectRule[]>> = {
  foothills: [
    // 05 §2.2: one tree per 4-6 tiles of forest
    { object: 'pine_tree', per100: 12, minSpacing: 3, where: 'forest' },
    { object: 'birch_tree', per100: 8, minSpacing: 3, where: 'forest' },
    { object: 'berry_bush', per100: 6, minSpacing: 3, where: 'meadow' },
    { object: 'tall_grass', per100: 20, minSpacing: 1, where: 'meadow' },
    { object: 'wild_barley', per100: 8, minSpacing: 2, where: 'meadow' },
    { object: 'bird_nest', per100: 2, minSpacing: 8, where: 'forest' },
  ],
  limestone: [
    { object: 'moss_patch', per100: 6, minSpacing: 3, where: 'caveFloor' },
    { object: 'guano_pile', per100: 4, minSpacing: 4, where: 'lairs' },
  ],
  granite: [
    { object: 'moss_patch', per100: 3, minSpacing: 4, where: 'caveFloor' },
    { object: 'bone_pile', per100: 2, minSpacing: 6, where: 'lairs' },
  ],
  fungal: [
    // 05 §2.2: a giant mushroom every 10-15 tiles of grotto floor
    { object: 'giant_mushroom', per100: 8, minSpacing: 8, where: 'caveFloor' },
    { object: 'glowcap', per100: 10, minSpacing: 2, where: 'caveFloor' },
    { object: 'bone_pile', per100: 1, minSpacing: 10, where: 'lairs' },
  ],
  sunken: [
    { object: 'kelp_bed', per100: 8, minSpacing: 3, where: 'underwater' },
    { object: 'giant_clam', per100: 2, minSpacing: 6, where: 'underwater' },
    { object: 'fish_shoal', per100: 1.5, minSpacing: 12, where: 'underwater' },
  ],
  crystal: [{ object: 'crystal_cluster', per100: 4, minSpacing: 4, where: 'caveWall' }],
  magma: [],
  ancient: [
    { object: 'ruin_cache', per100: 1.5, minSpacing: 12, where: 'ruin' },
    { object: 'bone_pile', per100: 1, minSpacing: 10, where: 'ruin' },
  ],
  heart: [],
};

/** Monster and wildlife spawns (no creature is ever tamed or put to work). */
export const SPAWN_RULES: Readonly<Record<BiomeId, readonly SpawnRule[]>> = {
  foothills: [
    { creature: 'deer', perKFloor: 20, pack: [1, 3], minSpacing: 20, zone: 'surface' },
    { creature: 'boar', perKFloor: 12, pack: [1, 2], minSpacing: 24, zone: 'surface' },
    { creature: 'wolf', perKFloor: 8, pack: [3, 5], minSpacing: 40, zone: 'surface' },
    { creature: 'goblin_raider', perKFloor: 0, pack: [4, 8], minSpacing: 0, zone: 'raid' },
  ],
  limestone: [
    { creature: 'cave_bat', perKFloor: 6, pack: [4, 10], minSpacing: 16, zone: 'wild' },
    { creature: 'rock_rat', perKFloor: 8, pack: [1, 3], minSpacing: 10, zone: 'wild' },
    { creature: 'goblin_miner', perKFloor: 2, pack: [2, 4], minSpacing: 30, zone: 'wild' },
  ],
  granite: [
    { creature: 'cave_crawler', perKFloor: 6, pack: [2, 4], minSpacing: 18, zone: 'hazard' },
    { creature: 'giant_mole', perKFloor: 3, pack: [1, 1], minSpacing: 24, zone: 'wild' },
    { creature: 'blind_lizard', perKFloor: 4, pack: [1, 2], minSpacing: 16, zone: 'wild' },
  ],
  fungal: [
    { creature: 'giant_spider', perKFloor: 4, pack: [1, 3], minSpacing: 20, zone: 'hazard' },
    { creature: 'myconid', perKFloor: 5, pack: [2, 4], minSpacing: 16, zone: 'wild' },
    { creature: 'cave_slime', perKFloor: 4, pack: [1, 3], minSpacing: 12, zone: 'wild' },
  ],
  sunken: [
    { creature: 'deep_eel', perKFloor: 3, pack: [1, 2], minSpacing: 24, zone: 'water' },
    { creature: 'drowned_one', perKFloor: 3, pack: [1, 3], minSpacing: 18, zone: 'hazard' },
    { creature: 'shore_crab', perKFloor: 5, pack: [2, 4], minSpacing: 12, zone: 'wild' },
  ],
  crystal: [
    { creature: 'crystal_golem', perKFloor: 2, pack: [1, 2], minSpacing: 24, zone: 'hazard' },
    { creature: 'frost_moth', perKFloor: 5, pack: [5, 10], minSpacing: 16, zone: 'wild' },
    { creature: 'cave_troll', perKFloor: 1, pack: [1, 1], minSpacing: 40, zone: 'wild' },
  ],
  magma: [
    { creature: 'salamander', perKFloor: 3, pack: [1, 2], minSpacing: 20, zone: 'hazard' },
    { creature: 'fire_imp', perKFloor: 4, pack: [3, 6], minSpacing: 18, zone: 'hazard' },
    { creature: 'magma_worm', perKFloor: 1, pack: [1, 1], minSpacing: 40, zone: 'hazard' },
  ],
  ancient: [
    { creature: 'wraith', perKFloor: 2, pack: [1, 2], minSpacing: 24, zone: 'hazard' },
    { creature: 'ancient_construct', perKFloor: 2, pack: [1, 2], minSpacing: 24, zone: 'hazard' },
    { creature: 'shadow_stalker', perKFloor: 1.5, pack: [1, 1], minSpacing: 30, zone: 'wild' },
  ],
  heart: [],
};

/** Monsters never spawn closer than this to a hub, tiles (hub = landmark with role 'hub'). */
export const HUB_SAFE_RADIUS = 24;

/** Boss lairs: one per biome, never next to the hub (R4 cue visible from a safe place). */
export const LAIRS: readonly Lair[] = [
  { creature: 'alpha_wolf', biome: 'foothills', landmark: 'wolf_ravine', leash: 30, minFromHub: 60, cue: 'wycie i kości przy wąwozie, widoczne z obozu' },
  { creature: 'bat_queen', biome: 'limestone', landmark: 'bat_grotto', leash: 16, minFromHub: 80, cue: 'chmura nietoperzy o zmierzchu nad wschodnim oknem' },
  { creature: 'brood_mother', biome: 'granite', landmark: 'brood_fissure', leash: 14, minFromHub: 50, cue: 'kości i chityna przy zalanej szczelinie' },
  { creature: 'web_queen', biome: 'fungal', landmark: 'web_chimney', leash: 18, minFromHub: 70, cue: 'kokony w kominie widoczne z przeciwległej groty' },
  { creature: 'leviathan', biome: 'sunken', landmark: 'sunken_archive', leash: 40, minFromHub: 40, cue: 'fale bez wiatru i grzbiet w toni' },
  { creature: 'crystal_colossus', biome: 'crystal', landmark: 'pump_station', leash: 20, minFromHub: 80, cue: 'dudnienie maszyny i szron rosnący na ścianach' },
  { creature: 'magma_wyrm', biome: 'magma', landmark: 'wyrm_tubes', leash: 30, minFromHub: 80, cue: 'drżenie i obsydianowe łuski na brzegu rzeki lawy' },
  { creature: 'ruin_guardian', biome: 'ancient', landmark: 'gatekeeper_hall', leash: 20, minFromHub: 40, cue: 'prosty jak struna akord i nieruchoma postać przy Bramie' },
  { creature: 'light_eater', biome: 'heart', landmark: 'heart_chamber', leash: 20, minFromHub: 0, cue: 'czerwony puls dna Gardzieli i gasnące lampy' },
];

// =====================================================================================================
// 7. Progression gates
// =====================================================================================================

export const SOFT_GATES: readonly SoftGate[] = [
  { biome: 'foothills', hazard: 'night_predators', effect: 'ataki wilków na krasnoludy poza kręgiem światła po zmroku', cue: 'wycie od wąwozu o zmierzchu', counters: [{ kind: 'infra', id: 'wooden_door' }, { kind: 'infra', id: 'torch' }, { kind: 'item', id: 'hunting_spear' }] },
  { biome: 'limestone', hazard: 'darkness', effect: 'praca -40% i groza bez światła', cue: 'nietoperze wylatujące z ciemnych sal', counters: [{ kind: 'infra', id: 'torch' }, { kind: 'item', id: 'hand_lantern' }] },
  { biome: 'limestone', hazard: 'cave_ins', effect: 'zawał hal szerszych niż 6 kafli bez podpór', cue: 'gruz i spękany strop w naturalnych salach', counters: [{ kind: 'infra', id: 'wooden_prop' }, { kind: 'infra', id: 'stone_pillar' }, { kind: 'tech', id: 'supports' }] },
  { biome: 'granite', hazard: 'flooding', effect: 'przebita szczelina zalewa ok. 200 kafli w 30 s', cue: 'wilgotne zacieki i szum wody za ścianą', counters: [{ kind: 'building', id: 'pump_station' }, { kind: 'infra', id: 'bulkhead' }, { kind: 'tech', id: 'pumps' }] },
  { biome: 'fungal', hazard: 'spores', effect: 'obrażenia co 5 s w chmurze zarodników', cue: 'turkusowa mgiełka i martwe ćmy', counters: [{ kind: 'item', id: 'filter_mask' }, { kind: 'infra', id: 'vent_shaft' }, { kind: 'tech', id: 'gas_masks' }] },
  { biome: 'fungal', hazard: 'poison', effect: 'zatrucie po ukąszeniu, bez antidotum rana ropieje', cue: 'kokony i pajęczyny w kominach', counters: [{ kind: 'item', id: 'antidote' }, { kind: 'item', id: 'chitin_vest' }] },
  { biome: 'sunken', hazard: 'flooding', effect: 'przebity strop kawerny zalewa chodnik w kilka sekund', cue: 'kapiący strop nad nisko położonym chodnikiem', counters: [{ kind: 'building', id: 'pump_station' }, { kind: 'infra', id: 'bulkhead' }] },
  { biome: 'sunken', hazard: 'deep_water', effect: '20 s oddechu pod wodą', cue: 'czarna toń i bańki z głębi', counters: [{ kind: 'item', id: 'diving_helmet' }, { kind: 'item', id: 'eelskin_suit' }, { kind: 'tech', id: 'diving' }] },
  { biome: 'crystal', hazard: 'cold', effect: 'wychłodzenie w 90 s bez ogrzewania', cue: 'szron i para oddechu', counters: [{ kind: 'item', id: 'padded_coat' }, { kind: 'infra', id: 'heater' }, { kind: 'tech', id: 'heating' }] },
  { biome: 'crystal', hazard: 'darkness', effect: 'praca -40%, gasnące kryształy', cue: 'kryształy gasnące jeden po drugim', counters: [{ kind: 'infra', id: 'crystal_lamp_post' }, { kind: 'item', id: 'crystal_lamp' }] },
  { biome: 'magma', hazard: 'heat', effect: 'oparzenia w 60 s', cue: 'drżące powietrze i pękające skorupy', counters: [{ kind: 'item', id: 'scale_robe' }, { kind: 'infra', id: 'cooler' }, { kind: 'tech', id: 'cooling_grid' }] },
  { biome: 'magma', hazard: 'lava', effect: 'wylewy niszczą budowle na drodze lawy', cue: 'czerwona poświata spod skorupy', counters: [{ kind: 'infra', id: 'obsidian_wall' }, { kind: 'infra', id: 'bulkhead' }] },
  { biome: 'magma', hazard: 'fumes', effect: 'duszenie przy wyziewach siarki', cue: 'żółte naloty i syk', counters: [{ kind: 'item', id: 'crystal_filter_mask' }, { kind: 'infra', id: 'vent_shaft' }] },
  { biome: 'ancient', hazard: 'dread', effect: 'spadek nastroju, ucieczki, światło gaśnie szybciej', cue: 'drżąca kreska w głębi sal', counters: [{ kind: 'item', id: 'rune_cloak' }, { kind: 'infra', id: 'ward_stone' }, { kind: 'item', id: 'glimmer_lamp' }] },
  { biome: 'ancient', hazard: 'darkness', effect: 'praca -40%, światło gaśnie szybciej w grozie', cue: 'gasnące lampy w głębi sal', counters: [{ kind: 'item', id: 'glimmer_lamp' }, { kind: 'infra', id: 'crystal_lamp_post' }] },
  { biome: 'ancient', hazard: 'constructs', effect: 'konstrukty odporne na zwykłą broń', cue: 'regularny stukot za ścianą', counters: [{ kind: 'item', id: 'runic_hammer' }, { kind: 'item', id: 'adamant_axe' }] },
  { biome: 'heart', hazard: 'dread', effect: 'groza Raroga: nastrój i odwaga topnieją', cue: 'czerwony puls dna Gardzieli', counters: [{ kind: 'item', id: 'glimmer_amulet' }, { kind: 'item', id: 'glimmer_lamp' }] },
  { biome: 'heart', hazard: 'heat', effect: 'żar komory: oparzenia w 60 s', cue: 'drżące powietrze nad Kowadłem', counters: [{ kind: 'item', id: 'frostcore_armor' }, { kind: 'item', id: 'fire_ward_potion' }] },
  { biome: 'heart', hazard: 'darkness', effect: 'światło gaśnie: Pożeracz pochłania lampy', cue: 'gasnące lampy na dnie Gardzieli', counters: [{ kind: 'item', id: 'glimmer_lamp' }] },
];

export const HARD_GATES: readonly HardGate[] = [
  { id: 'rock_limestone', biome: 'limestone', kind: 'pickTier', requires: [{ kind: 'item', id: 'flint_pick' }], descPl: 'Wapień: kilof 1 (krzemienny albo miedziany).' },
  { id: 'rock_granite', biome: 'granite', kind: 'pickTier', requires: [{ kind: 'item', id: 'bronze_pick' }, { kind: 'tech', id: 'bronze_age' }], descPl: 'Granit: kilof 2 (brązowy).' },
  { id: 'rock_crystal', biome: 'crystal', kind: 'pickTier', requires: [{ kind: 'item', id: 'steel_pick' }, { kind: 'tech', id: 'steelmaking' }], descPl: 'Łupek krystaliczny: kilof 3 (stalowy).' },
  { id: 'rock_magma', biome: 'magma', kind: 'pickTier', requires: [{ kind: 'item', id: 'cobalt_pick' }, { kind: 'tech', id: 'cobalt' }], descPl: 'Bazalt: kilof 4 (kobaltowy).' },
  { id: 'rock_heart', biome: 'heart', kind: 'pickTier', requires: [{ kind: 'item', id: 'adamant_pick' }, { kind: 'tech', id: 'adamant' }], descPl: 'Sercokamień: kilof 5 (adamantowy).' },
  { id: 'seal_first', biome: 'granite', kind: 'seal', requires: [{ kind: 'quest', id: 'KM2' }], descPl: 'Pierwsza Pieczęć (gł. 150): pieśń albo ładunki; otwiera Gardziel do Grot.' },
  { id: 'seal_water', biome: 'sunken', kind: 'seal', requires: [{ kind: 'item', id: 'diving_helmet' }, { kind: 'building', id: 'pump_station' }], descPl: 'Pieczęć Wodna (gł. 300): hełm nurka i pompy.' },
  { id: 'seal_fire', biome: 'magma', kind: 'seal', requires: [{ kind: 'quest', id: 'QDD-L8' }, { kind: 'infra', id: 'cooler' }], descPl: 'Brama Popiołu (gł. 470): chłodnice i pieśń albo rozbicie.' },
  { id: 'song_locks', biome: 'ancient', kind: 'songLock', requires: [{ kind: 'tech', id: 'rune_lore' }], descPl: 'Zamki śpiewane okien Prastarych (poziom 3-4): śpiewak albo kamertony Iskry.' },
  { id: 'grotto_chasms', biome: 'fungal', kind: 'chasm', requires: [{ kind: 'infra', id: 'rope_bridge' }, { kind: 'tech', id: 'silk_bridges' }], descPl: 'Przepaście między grotami do 20 kafli: most linowy.' },
  { id: 'seal_heart', biome: 'heart', kind: 'noReturn', requires: [{ kind: 'quest', id: 'KM4' }, { kind: 'resource', id: 'heart_key' }], descPl: 'Brama Serca (gł. 640): Klucz Serca; otwarcie budzi Raroga.' },
];

// =====================================================================================================
// 8. Start and tutorial (docs/narrative/02-campaign.md §2)
// =====================================================================================================

export const START = {
  /** Flat pad for the wagon and the campfire: exact plain level, no step inside the pad. */
  pad: { x: [14, 30] as Range, maxStep: 0 },
  /** Camp safety zone: no open tile under it down to `noCavesDepth`, no spawns, no lairs. */
  campZone: { x: [6, 38] as Range, noCavesDepth: 25 },
  /** First resources within reach: max walking distance (tiles) from the wagon to the nearest tile. */
  reach: [
    { what: 'pine_tree', kind: 'object', maxDist: 45, minCount: 6 },
    { what: 'berry_bush', kind: 'object', maxDist: 30, minCount: 2 },
    { what: 'wild_barley', kind: 'object', maxDist: 30, minCount: 2 },
    { what: 'clay_bed', kind: 'deposit', maxDist: 30, minCount: 8 },
    { what: 'copper_vein', kind: 'deposit', maxDist: 70, minCount: 12 },
    { what: 'coal_seam', kind: 'deposit', maxDist: 90, minCount: 10 },
    { what: 'limestone_bed', kind: 'deposit', maxDist: 90, minCount: 10 },
  ] as readonly { what: string; kind: 'object' | 'deposit'; maxDist: number; minCount: number }[],
  /** The tutorial copper vein is visible in the slope: at most this deep under the local surface. */
  copperOutcrop: { maxDepthUnderSurface: 6, minTiles: 12 },
  tutorialHall: {
    landmark: 'first_ledge_hall',
    /** 14 x 6 hall 30 tiles under the plain (02 §2): floor row at depth 30. */
    floorDepth: 30,
    size: [14, 6] as const,
    rottenProps: 6,
    nicheSide: 'W' as Side,
    /** Copper vein behind the east wall, this many tiles in (the trigger of the cave-in). */
    copperBehindEastWall: 3,
    /**
     * Old settled room: natural cavity (CAV.NATURAL), so the structure model gives it limestone's natural
     * flat run 2 x floor(3 x 2.5) = 14 = its width. It holds at start; widening it fails (the script's trigger).
     * The 6-tile height is taller than a timber prop (maxHeight 3): see WORLDGEN.md, open questions.
     */
    cavity: 'natural' as const,
  },
  oldShaft: { landmark: 'old_shaft', width: 2, plugRows: 3, ladders: false },
} as const;

// =====================================================================================================
// 9. Risk and reward rules (05 §3) as parameters
// =====================================================================================================

export const RISK = {
  /** R1: mother lodes, see MOTHER_LODE. */
  /** R3: memory disks (48) are never this close to a hub; Prakowali disks only behind locks or constructs. */
  diskMinFromHub: 20,
  disks: { total: 48, prakowali: 12 },
  /** Strategic deposits: nearest vein never closer to the hub than this (commons may be at the door). */
  strategicMinFromHub: 15,
  /** Value of the same raw per biome below its first occurrence (contracts; ECONOMY: covered by value). */
  depthValueGrowth: 0.15,
} as const;

// =====================================================================================================
// 10. Pass order and acceptance
// =====================================================================================================

/** Generator passes in order; each pass draws from its own `rng.fork(name)` (determinism per pass). */
export const PASSES = [
  'frame', // bedrock floor, plain row, biome map with undulating boundaries and transitions
  'surface', // meadow, pad, forest, mountain cone, crater, stream, ponor, cave entrances
  'strata', // host rocks per band (strata dip toward the axis, bodies, masonry)
  'gorge', // shaft, walls, windows with plugs or song locks, seals, chord pillars, ledges
  'landmarks', // hubs, lairs, tutorial hall, old shaft, kingdom road, sea, geodes, dome, halls
  'caves', // void budget per biome with the cave forms; cap under each top boundary stays solid
  'pillars', // natural pillars until every natural roof passes the structure model
  'fluids', // water and lava fill from the floor up, sealed pressure pockets, sea level
  'deposits', // densities per biome, veins along strata, mother lodes inside hazard cores
  'linings', // mycelium, magma rock, crystal and saltpeter linings around voids
  'objects', // trees, mushrooms, clams, caches with min spacing
  'spawns', // creature spawn points, lairs, raid entries; none near hubs
  'guarantees', // repair passes: start rules, reach, coverage, road walkability, roofs (re-checked by metrics)
] as const;

/** Acceptance thresholds for M2 (functions: src/world/worldgenMetrics.ts). */
export const ACCEPTANCE = {
  seeds: 10,
  /** 100% of the deposits of the bible present in every biome they belong to, on every seed. */
  coverage: 1,
  /** Density per biome and deposit within +-20% of DEPOSIT_RULES. */
  densityTolerance: 0.2,
  /** Smallest vein counted for coverage, tiles. */
  minVein: 3,
  /** Natural roofs failing the structure model at generation. */
  roofFailures: 0,
  /** Fluid in solid tiles and water floating over open non-water tiles. */
  fluidErrors: 0,
  /** Generation time on Node, one thread, 224 x 736 (QUALITY E3, same 3.6 us per tile as 400 ms at 224 x 480). */
  genMs: 600,
  /** Standable cells (dwarf profile) of a fresh world: bounds of the navigation graph (answer d). */
  navNodes: [5000, 12000] as Range,
} as const;
