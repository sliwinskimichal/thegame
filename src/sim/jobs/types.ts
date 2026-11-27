/** Job-system constants (F2-3 stage 2). */
import { WORK_TYPES, type WorkType } from '../../content/dwarves';

/** Job types. BUILD covers supports, ladders and (later) every infrastructure piece and building. */
export const JT = { DIG: 1, BUILD: 2, HAUL: 3 } as const;
export type JobType = (typeof JT)[keyof typeof JT];

/** Work type (personal priority column) of each job type. */
export const JT_WORK: Readonly<Record<number, WorkType>> = { [JT.DIG]: 'dig', [JT.BUILD]: 'build', [JT.HAUL]: 'haul' };
export const WORK_INDEX: Readonly<Record<WorkType, number>> = Object.fromEntries(WORK_TYPES.map((t, k) => [t, k])) as Record<WorkType, number>;

/** Job states. */
export const JS = {
  FREE: 0,
  /** Waiting for a dwarf. */
  OPEN: 1,
  /** A dwarf works on it. */
  CLAIMED: 2,
  /** Blacklisted after failed plans: reopens on expiry or a nearby world change. */
  SUSPENDED: 3,
} as const;

/** Job flags. */
export const JF = { AUTO: 1, RESCUE: 2 } as const;

export const MAX_JOBS = 8192;
export const PRIORITY_MIN = 1;
export const PRIORITY_MAX = 9;
