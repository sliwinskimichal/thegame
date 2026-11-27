/**
 * Data contract of src/content/structure.ts: every solid material has rock strength (even spans),
 * supports exist as infrastructure and cover the cave_ins hazard, loot ids exist; plus the determinism
 * guard for the world-change core (no Math.random / wall clock in src/sim outside nav and ai).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { INFRASTRUCTURE } from '../../src/content/buildings';
import { HAZARDS } from '../../src/content/biomes';
import { RESOURCES } from '../../src/content/resources';
import { EXCAVATION, ROCK_STRENGTH, STRUCTURE, SUPPORTS } from '../../src/content/structure';
import { MATERIALS } from '../../src/world/materials';

describe('content/structure.ts', () => {
  it('gives every solid material an even span limit and a positive warning time, and nothing else', () => {
    const solid = MATERIALS.filter((m) => m.solid).map((m) => m.key).sort();
    expect(Object.keys(ROCK_STRENGTH).sort()).toEqual(solid);
    for (const [k, r] of Object.entries(ROCK_STRENGTH)) {
      expect(r.maxSpan === Infinity || (Number.isInteger(r.maxSpan) && r.maxSpan >= 2 && r.maxSpan % 2 === 0), k).toBe(true);
      expect(r.warnSec * 20, k).toBeGreaterThanOrEqual(1);
      expect(r.warnSec * 20, k).toBeLessThanOrEqual(65535);
    }
    // only unbreakable rock never fails
    for (const m of MATERIALS) if (m.solid && ROCK_STRENGTH[m.key]!.maxSpan === Infinity) expect(m.tier, m.key).toBe(9);
  });

  it('supports are infrastructure pieces and cover every counter of the cave_ins hazard', () => {
    const infra = new Set(INFRASTRUCTURE.map((i) => i.id));
    for (const s of SUPPORTS) {
      expect(infra.has(s.id), s.id).toBe(true);
      expect(s.maxHeight).toBeGreaterThanOrEqual(1);
      expect(s.reach).toBeGreaterThanOrEqual(0);
      expect(s.reach).toBeLessThanOrEqual(8);
    }
    const counters = HAZARDS.find((h) => h.id === 'cave_ins')!.counters;
    for (const c of counters) expect(SUPPORTS.some((s) => s.id === c), c).toBe(true);
  });

  it('loot ids exist, hands dig only tier 0, multipliers are sane', () => {
    const res = new Set(RESOURCES.map((r) => r.id));
    expect(res.has(EXCAVATION.plainLoot.id)).toBe(true);
    for (const v of Object.values(EXCAVATION.lootByMaterial)) if (v) expect(res.has(v.id), v.id).toBe(true);
    for (const k of Object.keys(EXCAVATION.lootByMaterial)) expect(MATERIALS.some((m) => m.key === k), k).toBe(true);
    expect(EXCAVATION.hands.pickTier).toBe(0);
    expect(EXCAVATION.progressKept).toBeGreaterThanOrEqual(0);
    expect(EXCAVATION.progressKept).toBeLessThanOrEqual(1);
    expect([...EXCAVATION.crackStages]).toEqual([...EXCAVATION.crackStages].sort((a, b) => a - b));
    expect(STRUCTURE.naturalSpanMul).toBeGreaterThanOrEqual(1);
    expect(STRUCTURE.lowRoof.spanMul).toBeGreaterThanOrEqual(1);
    expect(STRUCTURE.rubbleMaxRows).toBeGreaterThanOrEqual(1);
    expect(STRUCTURE.rubbleHardnessMul).toBeGreaterThan(0);
  });
});

describe('determinism guard (M3-10)', () => {
  it('src/sim (outside nav/ and ai/) never uses Math.random, Date or performance.now', () => {
    const root = join(__dirname, '../../src/sim');
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f);
        if (statSync(p).isDirectory()) {
          if (f !== 'nav' && f !== 'ai') walk(p);
        } else if (p.endsWith('.ts')) files.push(p);
      }
    };
    walk(root);
    expect(files.length).toBeGreaterThanOrEqual(7);
    for (const f of files) expect(readFileSync(f, 'utf8'), f).not.toMatch(/Math\.random|Date\.now|new Date\(|performance\.now/);
  });
});
