/**
 * DWARF TEAM CONTRACT — model, rendering and lab side (F3-1). Owner: animator-ta (team lead).
 * Workers implement against these types and never edit this file; changes go through the lead.
 * Conventions (axes, units, placement, skinning): see src/render/anim/types.ts.
 * Art direction data (proportion presets, roles, palettes, line weights): ./direction.ts.
 */
import type * as THREE from 'three';
import type { BoneId, CreateAnimator, RigInput } from '../anim/types';

// ------------------------------------------------------------------------------------------------ identity
/** The four roles of the tournament (concept card docs/art/concepts/dwarf.md §2). */
export const ROLE = { MINER: 0, CARPENTER: 1, PORTER: 2, SMITH: 3 } as const;
export type RoleId = (typeof ROLE)[keyof typeof ROLE];
export const ROLE_IDS = ['hajer', 'ciesla', 'tragarz', 'kowal'] as const;
export const ROLE_NAMES_PL = ['hajer (górnik)', 'cieśla / stemplarz', 'tragarz', 'kowal / hutnik'] as const;

/** Social state = the ONE saturated accent (plume, tassel, ribbon). PLEDGED has no colour. */
export const SOCIAL = { FREE_MINER: 0, MASTER: 1, CROWN: 2, PLEDGED: 3 } as const;
export type SocialId = (typeof SOCIAL)[keyof typeof SOCIAL];

/** Body proportions in tiles (presets in direction.ts). */
export interface Proportions {
  /** Crown height in head modules (3.0–3.6; the vision allows 3–3.5, C "Słup" tests 3.6). */
  heads: number;
  /** Head module: chin to crown. */
  headH: number;
  /** Headgear above the crown (≈ 0.07). */
  hatH: number;
  /** Shoulder width (lateral, Z). */
  shoulderW: number;
  /** Torso barrel radii: chest and belly. */
  chestR: number;
  bellyR: number;
  /** Beard wedge: length from the chin, bottom width. */
  beardLen: number;
  beardW: number;
  /** Hand (fist) size. */
  handS: number;
  /** Legs with boots (hip joint height). */
  legH: number;
  /** Shoulder to fingertips. */
  armLen: number;
  /** Stance width (outer boot to outer boot). */
  stanceW: number;
}

// ------------------------------------------------------------------------------------------------ palette
/**
 * Colour slots. Fixed slots are baked into the vertex colour; VARIABLE slots come per instance
 * (one geometry serves every dwarf of a role: tunic, beard, skin and accent vary in a crowd).
 */
export const SLOT = {
  FIXED: 0, // vertex colour as baked (iron, wood, mica, eyes...)
  TUNIC: 1, // main garment (70% of the figure, L* 30–48, C* <= 26)
  TUNIC2: 2, // trousers / sleeves / second garment
  BEARD: 3, // beard, brows, hair (contrast to the tunic >= 15 L*)
  SKIN: 4, // face, hands
  CLOTH: 5, // headgear cloth / leather
  ACCENT: 6, // the social-state accent (only C* > 30 element besides the lamp)
} as const;
export const VAR_SLOTS = [SLOT.TUNIC, SLOT.TUNIC2, SLOT.BEARD, SLOT.SKIN, SLOT.CLOTH, SLOT.ACCENT] as const;

/** sRGB hex colours of one dwarf. */
export interface DwarfPalette {
  tunic: number;
  tunic2: number;
  beard: number;
  skin: number;
  cloth: number;
  accent: number;
  /** Fixed materials (same for everybody of a role): */
  leather: number;
  boot: number;
  iron: number;
  wood: number;
  lamp: number;
}

// ------------------------------------------------------------------------------------------------ parts (model as data)
/**
 * Shape of one part in its own frame (centred at the origin unless stated). The model builder
 * describes the dwarf as parts; every construction technique interprets the same parts its own way.
 */
export type PartShape =
  | { k: 'ellipsoid'; rx: number; ry: number; rz: number }
  | { k: 'capsule'; r: number; len: number } // along Y, centred
  | { k: 'box'; w: number; h: number; d: number } // X = d (depth), Y = h, Z = w (width)
  | { k: 'frustum'; r0: number; r1: number; h: number } // along Y, r0 bottom, r1 top
  | { k: 'lathe'; profile: readonly (readonly [number, number])[] } // [radius, y] around Y
  | { k: 'wedge'; w0: number; w1: number; h: number; d: number } // trapezoid prism: width w0 at top -> w1 at bottom (Z), height h (down -Y), depth d (X)
  | { k: 'dome'; r: number; ry: number } // upper half ellipsoid
  | { k: 'outline'; pts: readonly (readonly [number, number])[]; d: number }; // closed polygon in XY, extruded along Z by d

export interface PartDef {
  /** Unique within the dwarf (e.g. 'torso', 'helmet', 'pick.head'). */
  name: string;
  bone: BoneId;
  shape: PartShape;
  /** Placement of the shape in REST MODEL SPACE (not bone-local): translation and Euler ZYX. */
  t: readonly [number, number, number];
  r?: readonly [number, number, number];
  /** Colour slot (SLOT.*) and the fixed colour when slot = FIXED. */
  slot: number;
  color?: number;
  /** 0..n emission (lamp flame, embers). */
  emissive?: number;
  /** Papercut / layered techniques: -1 far side, 0 body, +1 near (camera) side. */
  layer?: -1 | 0 | 1;
  /** Part belongs to the role's identity (headgear, tool, back element) — never dropped by LOD. */
  identity?: boolean;
  /** Smallest LOD level that still draws the part (0 = Izba only ... 2 = everywhere). */
  minLod?: 0 | 1 | 2;
}

/** Everything that makes one dwarf (deterministic from the seed). */
export interface DwarfSpec {
  seed: number;
  role: RoleId;
  social: SocialId;
  proportions: Proportions;
  palette: DwarfPalette;
  /** Number of braids (cech: 1 miner, 2 craftsman) and a beard shape knob 0..1. */
  braids: number;
  beardShape: number;
}

// ------------------------------------------------------------------------------------------------ built model
/** Zoom-driven level of detail (Izba ~220 px, Gród ~75 px, Okolica ~24 px dwarf at 1080p). */
export const LOD = { IZBA: 0, GROD: 1, OKOLICA: 2 } as const;
export type LodLevel = (typeof LOD)[keyof typeof LOD];
/** Triangle budgets per dwarf (concept card §5): Izba ~1200, Gród <= 400, Okolica <= 60 (+ lamp sprite). */
export const LOD_TRIANGLE_BUDGET: readonly [number, number, number] = [1500, 400, 60];

/**
 * Geometry attribute contract of a welded (skinned) mesh. Positions and normals in REST MODEL SPACE.
 *  position vec3 · normal vec3 · color vec3 (LINEAR RGB; white where aSlot != FIXED)
 *  aSlot float (SLOT.*) · aBones vec2 (bone ids) · aWeight float (weight of aBones.x; rigid = 1)
 *  aEmissive float · aLayer float (-1, 0, 1; papercut z-order hint, 0 elsewhere)
 */
export const MESH_ATTRIBUTES = ['position', 'normal', 'color', 'aSlot', 'aBones', 'aWeight', 'aEmissive', 'aLayer'] as const;

/** One rigid part for the instanced-parts assembly: geometry in BONE-LOCAL space (rest offset removed). */
export interface PartMesh {
  name: string;
  bone: BoneId;
  geometry: THREE.BufferGeometry;
  slot: number;
  /** Ink hull of the part (null = no outline, e.g. eyes). */
  hull: THREE.BufferGeometry | null;
}

export interface DwarfMesh {
  lod: LodLevel;
  /** 'welded': one skinned geometry per role and LOD (bone texture, 1 draw + 1 hull draw per bucket).
   *  'parts': one instanced mesh per part (instance matrices per frame) — the cost comparison. */
  mode: 'welded' | 'parts';
  geometry: THREE.BufferGeometry | null;
  /** Inverted-hull outline geometry (same skinning attributes, smooth normals); null = technique draws its own line. */
  hull: THREE.BufferGeometry | null;
  parts: PartMesh[] | null;
  triangles: number;
}

export interface DwarfModel {
  variantId: string;
  spec: DwarfSpec;
  rig: RigInput;
  /** Index = LodLevel. */
  lods: readonly [DwarfMesh, DwarfMesh, DwarfMesh];
  /** View turn toward the camera (degrees from profile) the variant is designed for. */
  viewYawDeg: number;
  /** The parts the meshes were built from (debugging, papercut layers, metrics). */
  parts: readonly PartDef[];
}

/** Construction technique of a tournament variant (one axis of the tournament). */
export type Technique =
  | 'primitives' // spheres, capsules, boxes per the concept card
  | 'lathe' // revolved and extruded profiles
  | 'faceted' // low-poly facets, flat shading
  | 'papercut' // flat 2.5D cut-out layers
  | 'carved' // wooden figurine with chamfers
  | 'outline' // silhouettes extruded from 2D contours with a bevel
  | 'sdf' // one smooth skin from SDF primitives (2-bone weights)
  | 'parts'; // instanced rigid parts (cost twin)

export interface DwarfVariant {
  id: string;
  namePl: string;
  descPl: string;
  technique: Technique;
  /** Preset name from direction.ts + overrides. */
  proportions: Proportions;
  viewYawDeg: number;
  /** Deterministic: same spec -> identical geometry (tests hash the buffers). */
  build(spec: DwarfSpec): DwarfModel;
}

/** Spec factory (model side): seed + role + social -> DwarfSpec with the variant's proportions. */
export type MakeSpec = (seed: number, role: RoleId, social: SocialId, proportions: Proportions) => DwarfSpec;

// ------------------------------------------------------------------------------------------------ renderer (crowd)
/** Per-dwarf data the crowd renderer needs each frame. */
export interface CrowdMember {
  model: DwarfModel;
  anim: import('../anim/types').DwarfAnimator;
  /** Draw it (false = buried / dead / culled). */
  visible: boolean;
}

/** GPU side of many dwarves of one variant. */
export interface DwarfCrowdRenderer {
  readonly group: THREE.Group;
  /** Upload bones and instance data, pick LOD buckets from the camera (pixels per tile). */
  sync(members: readonly CrowdMember[], camera: THREE.PerspectiveCamera, viewportH: number): void;
  /** Rendering mode: 'color' (style), 'mask' (fill = white, hull = grey, unlit), 'sil' (black, no hull). */
  setMode(mode: 'color' | 'mask' | 'sil'): void;
  /** Draw calls and triangles of the last sync (for the cost metric). */
  readonly stats: { drawCalls: number; triangles: number; instances: number; uploadMs: number };
  dispose(): void;
}

// ------------------------------------------------------------------------------------------------ lab (tournament station)
/** The three zooms of the vision at 1080p (FOV 30°): px per tile, LOD, outline widths in px. */
export interface ZoomDef {
  id: 'izba' | 'grod' | 'okolica';
  namePl: string;
  pxPerTile: number;
  lod: LodLevel;
  /** W1 silhouette outline and Wd inner lines (px at 1080p; lab shots are 1:1 crops of a 1080p screen). */
  hullPx: number;
  innerPx: number;
}

/** One dwarf placed in a shot (deterministic: clip at a fixed phase). */
export interface ShotDwarf {
  role: RoleId;
  social: SocialId;
  seed: number;
  /** World feet position and facing. */
  x: number;
  y: number;
  z?: number;
  facing: 1 | -1;
  clip: import('../anim/types').ClipId;
  phase: number;
  carry?: number;
  lampOn?: boolean;
}

export type ShotKind = 'scene' | 'strip' | 'crowd' | 'sil';

/** A fixed shot of the tournament; every variant renders exactly the same list. */
export interface ShotDef {
  id: ShotId;
  namePl: string;
  kind: ShotKind;
  zoom: ZoomDef['id'];
  /** Look-at point (world) and time of day (0..1, 0 = midnight). */
  x: number;
  y: number;
  tod: number;
  dwarves: readonly ShotDwarf[];
  /** Metrics computed on this shot. */
  metrics: readonly ('contrast' | 'accent' | 'silhouette' | 'stability')[];
}

/**
 * Fixed shot list (content defined in the brief, docs/team/dwarf-team/BRIEFS.md §W3):
 *  izba     Izba zoom: 4 roles idle in a lamp pool in a dressed hall
 *  grod     Gród zoom: miner digging at a face (edge of the light), porter carrying, carpenter on a ladder, smith walking
 *  okolica  Okolica zoom: ~60 dwarves at work in a network of halls, tunnels and shafts
 *  walk8    walk cycle strip, 8 phases (k/8), one role per strip row ... at Gród zoom
 *  dig8     dig cycle strip, 8 phases incl. windup apex and the hit frame
 *  climb8   ladder climb strip, 8 phases
 *  carry8   carry (porter frame / sack) strip, 8 phases
 *  swiatlo  the 4 roles in the lamp core and the same 4 at the edge of the pool and beyond
 *  sil75    silhouettes only (black on white): 4 roles × 8 poses at ~75 px
 *  sil24    the same at ~24 px
 *  seq30    silhouettes of 8 consecutive 30 fps frames (walk and dig) — stability between frames
 */
export const SHOT_IDS = ['izba', 'grod', 'okolica', 'walk8', 'dig8', 'climb8', 'carry8', 'swiatlo', 'sil75', 'sil24', 'seq30'] as const;
export type ShotId = (typeof SHOT_IDS)[number];

/** Camera distance for a given pixel density on a canvas of height H (FOV 30°, like the lab). */
export function cameraDistance(pxPerTile: number, canvasH: number): number {
  return canvasH / (2 * Math.tan((15 * Math.PI) / 180) * pxPerTile);
}

// ------------------------------------------------------------------------------------------------ metrics
export interface ShotMetrics {
  shot: ShotId;
  /** Per role: mean L* of the fill and of the ring around it (6–12 px outside the outline), ΔL*. */
  contrast?: { role: RoleId; fillL: number; ringL: number; dL: number; lit: boolean }[];
  /** Share of fill pixels with C* > 30 (accent budget <= 10% of the silhouette). */
  accent?: { role: RoleId; share: number }[];
  /** Silhouette distinctness (1 - IoU between roles, centroid-aligned) and nearest-template role accuracy. */
  silhouette?: { px: number; pairDistance: number[][]; minPair: number; accuracy: number };
  /** Mean / min IoU of consecutive 30 fps silhouettes. */
  stability?: { clip: string; meanIoU: number; minIoU: number }[];
}

export interface CostMetrics {
  variantId: string;
  trianglesPerLod: [number, number, number];
  /** Draw calls of 200 dwarves (all roles, LOD by zoom) and with 1 dwarf. */
  drawCalls200: number;
  drawCalls1: number;
  /** Median frame time with 0 and 200 dwarves (gl.finish bracketed; SwiftShader: relative only). */
  frameMs0: number;
  frameMs200: number;
  /** CPU: animation update + upload for 200 dwarves per frame (ms). */
  animMs200: number;
}

export interface AnimMetrics {
  /** Max horizontal speed of a planted foot / walk speed (0 = no sliding), at the concept walk and at nav speed 2.5. */
  slipWalk: number;
  slipNav: number;
  /** Largest jump of any bone between consecutive 60 Hz samples across a cycle seam (tiles). */
  seamJump: number;
}

/** window.__dwarf on dwarves.html (automation for scripts/dwarf-tournament.mjs). */
export interface DwarfLabApi {
  variants: readonly string[];
  shots: readonly ShotId[];
  setVariant(id: string): Promise<void>;
  /** Render the shot (deterministic), return the screen boxes of the dwarves (for metrics and sheets). */
  shot(id: ShotId): Promise<{ boxes: { role: RoleId; x0: number; y0: number; x1: number; y1: number }[]; renderMs: number }>;
  analyze(id: ShotId): Promise<ShotMetrics>;
  bench(n: number): Promise<CostMetrics>;
  anim(): AnimMetrics;
}

/** Factories the integration wires together (model/index.ts, anim/index.ts). */
export interface DwarfTeamModules {
  variants: readonly DwarfVariant[];
  makeSpec: MakeSpec;
  createAnimator: CreateAnimator;
}

/** Re-export for convenience. */
export type { RigInput };
