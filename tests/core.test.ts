import { describe, expect, it } from 'vitest';
import { EventBus } from '../src/core/events';
import { Noise2D } from '../src/core/noise';
import { Rng, hash2f, hashString } from '../src/core/rng';

describe('Rng', () => {
  it('is deterministic per seed and differs across seeds', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const c = new Rng(43);
    const sa = Array.from({ length: 8 }, () => a.nextU32());
    const sb = Array.from({ length: 8 }, () => b.nextU32());
    const sc = Array.from({ length: 8 }, () => c.nextU32());
    expect(sa).toEqual(sb);
    expect(sa).not.toEqual(sc);
  });

  it('produces uniform-ish floats in [0, 1)', () => {
    const r = new Rng('uniform');
    const bins = new Array(10).fill(0);
    for (let i = 0; i < 100000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      bins[Math.floor(v * 10)]++;
    }
    for (const b of bins) expect(Math.abs(b - 10000)).toBeLessThan(500);
  });

  it('round-trips state', () => {
    const r = new Rng(7);
    r.next();
    const s = r.getState();
    const x = r.next();
    r.setState(s);
    expect(r.next()).toBe(x);
  });

  it('int() covers the inclusive range', () => {
    const r = new Rng(1);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) seen.add(r.int(3, 6));
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
  });
});

describe('hashing', () => {
  it('is stable', () => {
    expect(hashString('underhearth')).toBe(hashString('underhearth'));
    expect(hash2f(3, 4, 9)).toBe(hash2f(3, 4, 9));
    expect(hash2f(3, 4, 9)).not.toBe(hash2f(4, 3, 9));
  });
});

describe('Noise2D', () => {
  it('stays in range and is deterministic', () => {
    const n = new Noise2D(5);
    const m = new Noise2D(5);
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < 5000; i++) {
      const x = i * 0.137;
      const y = i * 0.071;
      const v = n.simplex(x, y);
      expect(v).toBe(m.simplex(x, y));
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
    expect(min).toBeGreaterThanOrEqual(-1);
    expect(max).toBeLessThanOrEqual(1);
    expect(max - min).toBeGreaterThan(1.2);
  });
});

describe('EventBus', () => {
  it('delivers and unsubscribes', () => {
    const bus = new EventBus<{ ping: number }>();
    let got = 0;
    const off = bus.on('ping', (v) => (got += v));
    bus.emit('ping', 2);
    off();
    bus.emit('ping', 5);
    expect(got).toBe(2);
  });
});
