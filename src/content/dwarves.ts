/**
 * Dwarf and colony-work tuning (F2-3 stage 2): carrying, speeds, injuries, job-system timings and
 * stockpile capacity. Proposed numbers for the systems-designer (balance); read by src/sim/.
 * Movement costs live in the navigation profile (src/sim/nav/profiles.ts, DWARF: 2.5 tiles/s).
 */

export const DWARF_STATS = {
  hp: 100,
  /**
   * Units carried in one trip (one resource at a time, at most the resource's stack size).
   * Note: the balance model's haul cost (src/balance/model.ts haulAt) assumes 1 unit per trip times the
   * backpack carry factor - to be reconciled by the systems-designer.
   */
  carry: 10,
  /** Walk speed factor while carrying anything (1 = profile speed). */
  loadedSpeed: 0.85,
  /** Work speed multiplier on digging and building (skills and mood later). */
  workMul: 1,
  /** Damage per row fallen beyond the safe drop (CONFIG.maxSafeDrop). */
  fallDamagePerRow: 15,
  /** Seconds stunned after a harmful fall. */
  fallStunSec: 1.5,
  /** Damage when a cave-in buries the dwarf, then per second while trapped. */
  buriedHit: 25,
  buriedPerSec: 1,
  /** Pick a new dwarf starts with (content item id); null = bare hands. */
  startPick: 'copper_pick' as string | null,
};

/** Work types a dwarf can be assigned to, with the default personal priority (0 = never, 1..9). */
export const WORK_TYPES = ['dig', 'build', 'haul'] as const;
export type WorkType = (typeof WORK_TYPES)[number];
export const WORK_DEFAULT: Readonly<Record<WorkType, number>> = { dig: 5, build: 5, haul: 5 };

export const JOB_RULES = {
  /** Priority of a new player order (1 lowest .. 9 highest). */
  defaultPriority: 5,
  /** Digging out a buried dwarf. */
  rescuePriority: 9,
  /** Support ordered automatically under a roof warning. */
  supportPriority: 8,
  haulPriority: 3,
  /** Different dwarves whose plans must fail before a job is blacklisted (fewer if the colony is smaller). */
  failsToBlacklist: 3,
  /** A blacklisted job reopens after this long, or earlier when the world changes within reopenRadius. */
  blacklistSec: 60,
  reopenRadius: 8,
  /** A dwarf skips a job its own plan failed for this long. */
  avoidSec: 20,
  /** Idle dwarves look for work this often (staggered by dwarf id). */
  thinkSec: 0.5,
  /** Order a support automatically for every roof warning; dig jobs under that roof wait for it. */
  autoSupport: true,
  /** A dwarf keeps working under a failing roof only while more than this remains of the countdown. */
  braveMarginSec: 5,
  /** How far (tiles) a fleeing dwarf looks sideways for a safe spot. */
  fleeRadius: 12,
  /** Candidate jobs the chooser checks for a free work spot before waiting for the next round. */
  chooseAttempts: 8,
  /** Job searches per tick for the whole colony (the rest wait a tick: smooth cost, deterministic). */
  searchesPerTick: 24,
};

export const STOCKPILE_RULES = {
  /** Units one stockpile tile holds (ECONOMY.md section 2.7 counts storage in units). */
  perTile: 50,
};
