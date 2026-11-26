/**
 * QA (F1-5): the pacing model (src/balance/model.ts) at the edges of its parameter space.
 * The model is a design tool: a bad input must fail loudly, never return a plausible number.
 * Known defects: BUG-004 (it.fails). Passing tests guard properties the tuning relies on.
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_BEHAVIOUR, PacingModel, percentile, type Behaviour, type RunReport } from '../../src/balance/model';
import { RESOURCES } from '../../src/content/resources';
import { TECH } from '../../src/content/tech';

const m = new PacingModel();
/** true when the model refuses the input: throws, returns a non-finite total or flags saturation. */
function refused(bh: Partial<Behaviour>, mode: 'complete' | 'max' = 'complete'): boolean {
  try {
    const r = m.run(mode, { ...DEFAULT_BEHAVIOUR, ...bh }) as RunReport & { saturated?: boolean };
    return !Number.isFinite(r.total) || r.saturated === true;
  } catch {
    return true;
  }
}

describe('balance model: out-of-domain behaviour parameters (BUG-004)', () => {
  it.fails('BUG-004: efficiency = NaN is refused (today: a plausible 6.9 h completion)', () => {
    expect(refused({ efficiency: Number.NaN })).toBe(true);
  });
  it.fails('BUG-004: gameSpeed = 0 is refused (today: every tier silently capped at 500 h -> 6305.7 h)', () => {
    expect(refused({ gameSpeed: 0 })).toBe(true);
  });
  it.fails('BUG-004: population never goes negative (today: migrantsPerHour = -10 -> pop -44993)', () => {
    const r = m.run('complete', { ...DEFAULT_BEHAVIOUR, migrantsPerHour: -10 });
    expect(Math.min(...r.tiers.map((t) => t.pop))).toBeGreaterThanOrEqual(0);
  });
  it.fails('BUG-004: percentile of an empty sample is NaN or throws (today: undefined typed as number)', () => {
    let v: unknown;
    try {
      v = percentile([], 0.5);
    } catch {
      v = Number.NaN;
    }
    expect(typeof v).toBe('number');
  });
  it('still rejects inputs that already propagate NaN (pause, bossHours) - keep it that way', () => {
    expect(refused({ pause: Number.NaN })).toBe(true);
    expect(refused({ bossHours: Number.NaN })).toBe(true);
  });
});

describe('balance model: properties the tuning relies on', () => {
  it('prices every resource independently of the query order (no recipe cycles / memo order effects)', () => {
    const ids = RESOURCES.map((r) => r.id);
    const a = new PacingModel();
    const b = new PacingModel();
    for (const k of [0, 3, 7]) {
      const fwd = ids.map((id) => a.unitWork(id, k));
      const rev = new Map([...ids].reverse().map((id) => [id, b.unitWork(id, k)] as const));
      ids.forEach((id, i) => expect(rev.get(id), `${id}@T${k}`).toBe(fwd[i]));
    }
  });

  it('reproduces a Monte Carlo run from the same seed', () => {
    const a = new PacingModel().monteCarlo('complete', 3, 5).totals;
    const b = new PacingModel().monteCarlo('complete', 3, 5).totals;
    expect(a).toEqual(b);
  });

  it('charges every research node exactly its data cost under the default curve (pack/extra split)', () => {
    // nodeCost() separates packs from extras with a name regex; an extra named like a pack
    // (e.g. "rune_tablet") would silently vanish from the balance - this test catches it.
    for (const t of TECH) expect(m.nodeCost(t.id), t.id).toEqual(t.cost);
  });
});
