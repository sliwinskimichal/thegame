/**
 * Balance: pacing simulation targets (docs/BALANCE.md).
 * BALANCE_REPORT=1 prints the full report and evaluates the cost-curve variants.
 */
import { describe, expect, it } from 'vitest';
import { PacingModel, percentile, TARGET_COMPLETION, TARGET_HOURS, TARGET_MAX } from '../src/balance/model';

const fmt = (x: number) => x.toFixed(1).padStart(6);

describe('balance: pacing model', () => {
  const m = new PacingModel();

  it('produces finite work for every tier', () => {
    const r = m.run('complete');
    for (const t of r.tiers) expect(Number.isFinite(t.workHours), `tier ${t.tier}`).toBe(true);
  });

  it('keeps a first completion near 40 h and a max-out near 120 h (model estimate)', () => {
    const c = m.run('complete');
    const x = m.run('max');
    expect(c.total).toBeGreaterThan(34);
    expect(c.total).toBeLessThan(46);
    expect(x.total).toBeGreaterThan(100);
    expect(x.total).toBeLessThan(140);
    // no tier collapses or explodes relative to its target
    c.tiers.filter((t) => t.tier < 9).forEach((t, k) => {
      expect(t.realHours / TARGET_HOURS[k]!, `tier ${k}`).toBeGreaterThan(0.55);
      expect(t.realHours / TARGET_HOURS[k]!, `tier ${k}`).toBeLessThan(1.8);
    });
  });

  it.runIf(!!process.env.BALANCE_REPORT)('prints a report', () => {
    const c = m.run('complete');
    const x = m.run('max');
    const lines = ['tier | target | complete h (work dh, pop) | max h | breakdown (dwarf-hours)'];
    c.tiers.filter((t) => t.tier < 9).forEach((t, k) => {
      const b = Object.entries(t.breakdown).map(([k2, v]) => `${k2} ${v.toFixed(0)}`).join(', ');
      lines.push(`T${k}  | ${fmt(TARGET_HOURS[k]!)} | ${fmt(t.realHours)} (${t.workHours.toFixed(0)} dh, ${t.pop}) | ${fmt(x.tiers[k]!.realHours)} | ${b}`);
    });
    lines.push(`TOTAL complete ${c.total.toFixed(1)} h (target ${TARGET_COMPLETION}), max ${x.total.toFixed(1)} h (target ${TARGET_MAX})`);
    lines.push(`completion nodes: ${m.completionNodes().size}`);
    const mc = m.monteCarlo('complete', 200, 7);
    lines.push(`MC complete P10 ${percentile(mc.totals, 0.1).toFixed(1)} P50 ${percentile(mc.totals, 0.5).toFixed(1)} P90 ${percentile(mc.totals, 0.9).toFixed(1)}`);
    console.log(lines.join('\n'));
  });

  it.runIf(!!process.env.BALANCE_REPORT)('evaluates great-work scales for the max-out', () => {
    const rows: string[] = [];
    for (const g of (process.env.GW ?? '1,2,4,6,8,10').split(',').map(Number)) {
      const mm = new PacingModel();
      mm.gwScale = g;
      const x = mm.run('max');
      const mc = mm.monteCarlo('max', 60, 3);
      rows.push(`gw x${g}: max ${x.total.toFixed(1)} h, MC P50 ${percentile(mc.totals, 0.5).toFixed(1)} | ${x.tiers.map((t) => t.realHours.toFixed(1)).join(' ')}`);
    }
    console.log(rows.join('\n'));
  });

  it.runIf(!!process.env.BALANCE_REPORT)('evaluates pack-curve variants', () => {
    const rows: { name: string; score: number; total: number; tiers: number[] }[] = [];
    const bases = (process.env.BASES ?? '3,4,5,6').split(',').map(Number);
    const growths = (process.env.GROWTHS ?? '1.14,1.2,1.26,1.32').split(',').map(Number);
    const earlies = (process.env.EARLY ?? '1').split(',').map(Number);
    for (const base of bases)
      for (const growth of growths)
        for (const early of earlies) {
        const mm = new PacingModel({ base, growth, prevShare: 0.6, early });
        const r = mm.run('complete');
        const tiers = r.tiers.map((t) => t.realHours);
        let score = 0;
        tiers.forEach((h, k) => (score += Math.log(h / TARGET_HOURS[k]!) ** 2));
        score += 3 * Math.log(r.total / TARGET_COMPLETION) ** 2;
        rows.push({ name: `base ${base} growth ${growth} early ${early}`, score, total: r.total, tiers });
      }
    rows.sort((a, b) => a.score - b.score);
    console.log(rows.map((r) => `${r.name.padEnd(32)} score ${r.score.toFixed(3)} total ${r.total.toFixed(1)} | ${r.tiers.map((h) => h.toFixed(1)).join(' ')}`).join('\n'));
  });
});
