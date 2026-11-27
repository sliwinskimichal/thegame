/**
 * Art direction of the dwarf (team lead, F3-1) as data — the single source the model, the rig and
 * the lab read. Sources: docs/art/concepts/dwarf.md, docs/art/ART-BIBLE.md §0/§2.4/§4.3,
 * docs/team/vision/VISION.md (3–3.5 heads, big hands and tools, heavy sure motion, no chibi).
 * Values in tiles (1 tile ≈ 1 m), colours sRGB hex.
 */
import { BONE, BONE_COUNT } from '../anim/types';
import { LOD, ROLE, SOCIAL, type Proportions, type RoleId, type SocialId, type ZoomDef } from './types';

// ------------------------------------------------------------------------------------------------ proportions
/** A "Kowadło" (favourite of the concept card): 3.4 heads, shoulders 0.62, legs 23%. */
export const PROPORTIONS_A: Proportions = {
  heads: 3.4,
  headH: 0.36,
  hatH: 0.07,
  shoulderW: 0.62,
  chestR: 0.29,
  bellyR: 0.25,
  beardLen: 0.32,
  beardW: 0.34,
  handS: 0.13,
  legH: 0.3,
  armLen: 0.42,
  stanceW: 0.58,
};
/** B "Beczka": 3.2 heads, rounder torso, shorter beard (risk: sweetness). */
export const PROPORTIONS_B: Proportions = { ...PROPORTIONS_A, heads: 3.2, chestR: 0.31, bellyR: 0.29, beardLen: 0.24, beardW: 0.3 };
/** C "Słup": 3.6 heads, 1.40 tall, narrower shoulders (risk: loses dwarfishness). */
export const PROPORTIONS_C: Proportions = { ...PROPORTIONS_A, heads: 3.6, headH: 0.37, shoulderW: 0.58, chestR: 0.27, bellyR: 0.24, legH: 0.32, armLen: 0.45 };
/** A+ exaggerated anvil: shoulders 0.68, hands 0.16, long beard 0.40. */
export const PROPORTIONS_A_PLUS: Proportions = { ...PROPORTIONS_A, shoulderW: 0.68, chestR: 0.3, handS: 0.16, beardLen: 0.4, beardW: 0.38 };
/** Lower bound of the vision: 3.0 heads at the same height (bigger head) — the chibi guard. */
export const PROPORTIONS_3_0: Proportions = { ...PROPORTIONS_A, heads: 3.0, headH: 0.41 };

export const PROPORTION_PRESETS = { A: PROPORTIONS_A, B: PROPORTIONS_B, C: PROPORTIONS_C, A_PLUS: PROPORTIONS_A_PLUS, H3_0: PROPORTIONS_3_0 } as const;

/** Total height with headgear. */
export function totalHeight(p: Proportions): number {
  return p.heads * p.headH + p.hatH;
}

/**
 * Canonical rest joint positions (model space, BONE_COUNT * 3) for a set of proportions. The model
 * builds its geometry around these joints and passes them on in RigInput.rest; the rig derives
 * every bone length from them (never from constants). Body joints are fixed by this function;
 * sockets (TOOL_*, BACK, LOAD, APRON_*, LANTERN) are defaults the gear may move.
 */
export function referenceJoints(p: Proportions, out = new Float32Array(BONE_COUNT * 3)): Float32Array {
  const set = (b: number, x: number, y: number, z: number) => {
    out[b * 3] = x;
    out[b * 3 + 1] = y;
    out[b * 3 + 2] = z;
  };
  const crownY = p.heads * p.headH;
  const chinY = crownY - p.headH;
  const shoulderY = chinY - 0.025;
  const hipY = p.legH;
  const beltY = hipY + 0.2 * (p.legH / 0.3);
  const ankleY = 0.08 * (p.legH / 0.3);
  const legLen = hipY - ankleY;
  const thigh = legLen * 0.52;
  const armR = 0.065;
  const shoulderZ = p.shoulderW / 2 - armR;
  const upper = (p.armLen - p.handS) * 0.52;
  const fore = (p.armLen - p.handS) * 0.48;
  const hipZ = p.chestR * 0.38;
  set(BONE.ROOT, 0, 0, 0);
  set(BONE.PELVIS, 0, hipY, 0);
  set(BONE.SPINE, 0, beltY, 0);
  set(BONE.CHEST, 0, shoulderY - 0.04, 0);
  set(BONE.HEAD, 0.02, chinY, 0);
  set(BONE.BEARD, 0.02 + p.headH * 0.22, chinY - 0.01, 0);
  set(BONE.BEARD2, 0.04 + p.headH * 0.22, chinY - p.beardLen * 0.5, 0);
  for (const [arm, fo, hand, tool, s] of [
    [BONE.ARM_R, BONE.FORE_R, BONE.HAND_R, BONE.TOOL_R, 1],
    [BONE.ARM_L, BONE.FORE_L, BONE.HAND_L, BONE.TOOL_L, -1],
  ] as const) {
    set(arm, 0, shoulderY, s * shoulderZ);
    set(fo, 0, shoulderY - upper, s * shoulderZ);
    set(hand, 0, shoulderY - upper - fore, s * shoulderZ);
    set(tool, 0, shoulderY - upper - fore - p.handS * 0.45, s * shoulderZ);
  }
  for (const [th, sh, ft, s] of [
    [BONE.THIGH_R, BONE.SHIN_R, BONE.FOOT_R, 1],
    [BONE.THIGH_L, BONE.SHIN_L, BONE.FOOT_L, -1],
  ] as const) {
    set(th, 0, hipY, s * hipZ);
    set(sh, 0, hipY - thigh, s * hipZ);
    set(ft, 0, ankleY, s * hipZ);
  }
  set(BONE.BACK, -p.chestR * 0.7, shoulderY - 0.06, 0);
  set(BONE.LOAD, p.chestR + 0.12, beltY + 0.12, 0);
  set(BONE.APRON_F, p.bellyR, beltY - 0.01, 0);
  set(BONE.APRON_B, -p.bellyR, beltY - 0.01, 0);
  set(BONE.LANTERN, 0.06, beltY - 0.03, p.bellyR * 0.95 + 0.02);
  return out;
}

// ------------------------------------------------------------------------------------------------ roles (silhouette = headgear + tool + back element)
export interface RoleDirection {
  role: RoleId;
  namePl: string;
  headgear: string;
  tool: string;
  back: string;
  /** Where the social accent sits (it is the same colour for everyone of one social state). */
  accentOn: string;
  /** Lamp: miners wear the kaganek on the helmet, the rest a belt lantern. */
  lamp: 'helmet' | 'belt';
  /** Garment colours (C* <= 26, L* 30–48). */
  tunic: number;
  tunic2: number;
  cloth: number;
  /** Braids in the beard (guild sign: 1 miner, 2 craftsman). */
  braids: number;
}

export const ROLE_DIRECTION: readonly RoleDirection[] = [
  {
    role: ROLE.MINER,
    namePl: 'hajer (górnik)',
    headgear: 'skórzany hełm-kopuła z daszkiem, kaganek (lampka) z przodu na blaszce, kitka z tyłu ciemienia',
    tool: 'kilof: trzonek 0,75, głowica 0,36 z dwoma ostrzami (T), jasna krawędź ostrza +20 L*',
    back: 'tylnik: skórzany trapez 0,30 × 0,34 z tyłu na pasie (2 kości wtórne)',
    accentOn: 'kitka na hełmie',
    lamp: 'helmet',
    tunic: 0x7e6446,
    tunic2: 0x5e4a38,
    cloth: 0x4a3626,
    braids: 1,
  },
  {
    role: ROLE.CARPENTER,
    namePl: 'cieśla / stemplarz',
    headgear: 'kaptur ze szpicem odrzuconym do tyłu (szpic przekracza obrys głowy)',
    tool: 'topór ciesielski: trzonek 0,55, szerokie ostrze; w ruchu wisi w prawej dłoni',
    back: 'belka (stempel) 0,11 × 0,11 × 1,0 na lewym barku, ukośnie; odkładana do pracy',
    accentOn: 'chwost na szpicu kaptura',
    lamp: 'belt',
    tunic: 0x5c5a44,
    tunic2: 0x4e4436,
    cloth: 0x6a5640,
    braids: 2,
  },
  {
    role: ROLE.PORTER,
    namePl: 'tragarz',
    headgear: 'opaska na czole, odkryte włosy (bez hełmu) — najniższa głowa w grupie',
    tool: 'bez narzędzia: obie dłonie na pasach nosidła przy piersi',
    back: 'nosidło: rama 0,5 × 0,7 sięgająca nad barki + kosz (przy noszeniu z urobkiem)',
    accentOn: 'węzeł opaski z dwoma końcami z tyłu',
    lamp: 'belt',
    tunic: 0x56585a,
    tunic2: 0x4a4038,
    cloth: 0x6e6252,
    braids: 2,
  },
  {
    role: ROLE.SMITH,
    namePl: 'kowal / hutnik',
    headgear: 'czapa z osłoną karku + okular z miki na czole',
    tool: 'młot w prawej dłoni, szczypce w lewej',
    back: 'długi skórzany fartuch z przodu do kolan (element ciała zamiast pleców), sadza na rękawach',
    accentOn: 'piórko / kitka przy czapie',
    lamp: 'belt',
    tunic: 0x6a5c50,
    tunic2: 0x3e3630,
    cloth: 0x4a3a2c,
    braids: 2,
  },
];

// ------------------------------------------------------------------------------------------------ palettes
/** Beards (concept card §3): red, chestnut, black, grey, fair. Contrast to the tunic must be >= 15 L*. */
export const BEARD_COLORS: readonly number[] = [0x9a5a30, 0x5a3a26, 0x2e2620, 0xb8b2a6, 0xa08458];
/** Skin base (and ±8 L* variants are derived by the spec factory). */
export const SKIN_BASE = 0xc89474;
export const SKIN_SHADE = 0x9a6a54;
/** Fixed materials. */
export const FIXED_COLORS = {
  leather: 0x5e4432,
  leatherDark: 0x4a3020,
  boot: 0x3e2a1e,
  iron: 0x4a4644,
  ironEdge: 0x7a7672, // +20 L* edge of blades
  wood: 0x7a5634,
  woodWorn: 0x8e6a46,
  mica: 0xb8ac8a,
  ink: 0x201812,
  lampFlame: 0xffd890,
  basket: 0x8a6a40,
  ore: 0x6a5a50,
} as const;
/** The one saturated accent per social state (ART-BIBLE §4.3); PLEDGED: grey tin tag, no colour. */
export const SOCIAL_ACCENT: Record<SocialId, number> = {
  [SOCIAL.FREE_MINER]: 0xc8902e,
  [SOCIAL.MASTER]: 0xe6e0d2,
  [SOCIAL.CROWN]: 0xa8303a,
  [SOCIAL.PLEDGED]: 0x9aa0a0,
};
/** Value bands on screen (L*): garments, beard, face and hands, lamp; accent chroma and share. */
export const VALUE_BANDS = {
  tunicL: [30, 48] as const,
  faceL: [58, 68] as const,
  lampL: [88, 98] as const,
  beardMinDeltaL: 15,
  garmentMaxC: 26,
  accentMinC: 30,
  accentMaxShare: 0.1,
  figureGroundMinDeltaL: 15,
};

// ------------------------------------------------------------------------------------------------ zooms and lines
/**
 * Zooms of the vision at 1080p (FOV 30°). Lab shots are 960×540 crops at the SAME pixel density as a
 * 1080p screen, so a dwarf is ~220 / ~75 / ~24 px tall and line widths are the 1080p values.
 */
export const ZOOMS: Readonly<Record<ZoomDef['id'], ZoomDef>> = {
  izba: { id: 'izba', namePl: 'Izba', pxPerTile: 168, lod: LOD.IZBA, hullPx: 4, innerPx: 1.25 },
  grod: { id: 'grod', namePl: 'Gród', pxPerTile: 57.7, lod: LOD.GROD, hullPx: 4, innerPx: 1.25 },
  okolica: { id: 'okolica', namePl: 'Okolica', pxPerTile: 18.3, lod: LOD.OKOLICA, hullPx: 3, innerPx: 0 },
};
/** LOD from pixel density (px per tile on screen). */
export function lodForPxPerTile(ppt: number): 0 | 1 | 2 {
  return ppt >= 100 ? 0 : ppt >= 30 ? 1 : 2;
}

// ------------------------------------------------------------------------------------------------ motion direction
/** Timing targets (concept card §5, art notes for the animator). */
export const MOTION = {
  /** Walk: 2 steps per 0.9 s, sway 0.02 tile — heavy and sure. */
  walkStepsPerSecond: 2 / 0.9,
  walkSway: 0.02,
  /** Dig: windup 0.35 s -> hold 0.08 s -> strike 0.15 s (hit frame with dust) -> recovery ~0.32 s. */
  digWindup: 0.35,
  digHold: 0.08,
  digStrike: 0.15,
  digRecover: 0.32,
  /** Carrying: forward lean 8 degrees. */
  carryLeanDeg: 8,
  /** Nav speeds the sim uses today (src/sim/nav: walk 400 ms/tile, ladder up 900 / down 600 ms per row). */
  navWalkTilesPerSecond: 2.5,
  navClimbUpMsPerRow: 900,
  navClimbDownMsPerRow: 600,
  /** Ladder rungs of the current lab dressing (4 per tile). */
  rungSpacing: 0.25,
} as const;
