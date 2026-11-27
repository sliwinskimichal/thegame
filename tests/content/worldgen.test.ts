/**
 * World generator 2.0 spec (src/content/worldgen.ts) against the content bible, the world frame and the
 * structure model: bands cover the whole depth without gaps or overlaps, every deposit has a rule in each of
 * its biomes, every gate references an existing id, densities fit the rock, natural caves hold at start, the
 * Heart has no deposits and the generator's weighted pick survives it. Supply vs demand: WORLDGEN.md §4.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config';
import { BIOMES, HAZARDS } from '../../src/content/biomes';
import { BUILDINGS, INFRASTRUCTURE } from '../../src/content/buildings';
import { RES } from '../../src/content/resources';
import { CREATURES, DEPOSITS, OBJECTS, ROCK_PICK_TIER } from '../../src/content/sources';
import { TECH_BY_ID } from '../../src/content/tech';
import {
  ACCEPTANCE, BANDS, DEPOSIT_RULES, GORGE, HARD_GATES, HUB_SAFE_RADIUS, LAIRS, LANDMARKS, LEADING_LINES, MOTHER_LODE,
  NO_DEPOSIT_BIOMES, OBJECT_RULES, PASSES, SOFT_GATES, SPAWN_RULES, START, SURFACE, WORLD_FRAME, type GateRef,
} from '../../src/content/worldgen';
import { Rng } from '../../src/core/rng';
import { MAT_BY_KEY } from '../../src/world/materials';
import {
  bandCore, BIOME_INDEX, depositTable, formRoof, gorgeSegments, maxFlatRun, minThickness, nominal, segmentOf,
  solidEstimate, supplyEstimate, weightedOrNull,
} from '../../src/world/worldgenRules';
import { completionRawDemand } from './rawDemand';

const quests = readFileSync(new URL('../../docs/narrative/04-quests.md', import.meta.url), 'utf8');

/** Does a gate reference point at something that exists in the content bible? */
function refExists(r: GateRef): boolean {
  switch (r.kind) {
    case 'item': return RES.get(r.id)?.kind === 'item';
    case 'resource': return RES.has(r.id);
    case 'building': return BUILDINGS.some((b) => b.id === r.id);
    case 'infra': return INFRASTRUCTURE.some((i) => i.id === r.id);
    case 'tech': return TECH_BY_ID.has(r.id);
    case 'creature': return CREATURES.some((c) => c.id === r.id);
    case 'hazard': return HAZARDS.some((h) => h.id === r.id);
    case 'quest': return /^(KM[1-5]|QDD-[A-Z0-9-]+)$/.test(r.id) && quests.includes(r.id);
  }
}

const biomeIds = BIOMES.map((b) => b.id);

describe('world frame (BUG-006)', () => {
  it('matches CONFIG and stacks sky + mountain, nine biomes and the bedrock floor without a gap', () => {
    expect(WORLD_FRAME.w).toBe(CONFIG.worldW);
    expect(WORLD_FRAME.h).toBe(CONFIG.worldH);
    expect(WORLD_FRAME.plainRow + WORLD_FRAME.biomeDepth + WORLD_FRAME.floorRows).toBe(CONFIG.worldH);
    expect(WORLD_FRAME.biomeDepth).toBe(Math.max(...BIOMES.map((b) => b.depth[1])));
    expect(SURFACE.mountain.rimHeight + WORLD_FRAME.skyAboveSummit).toBeLessThanOrEqual(WORLD_FRAME.plainRow);
    expect(MAT_BY_KEY.get(WORLD_FRAME.floorMaterial)!.tier).toBe(9);
    expect(MAT_BY_KEY.get(GORGE.wall.material)!.tier).toBe(9);
  });

  it('keeps the surface zones inside the world and the wagon pad on the meadow, far from the ponor', () => {
    const W = WORLD_FRAME.w;
    for (const r of [SURFACE.meadow.x, SURFACE.forest.x, SURFACE.mountain.baseX, START.pad.x, START.campZone.x]) {
      expect(r[0]).toBeGreaterThanOrEqual(0);
      expect(r[1]).toBeLessThanOrEqual(W);
    }
    expect(START.pad.x[0]).toBeGreaterThanOrEqual(START.campZone.x[0]);
    expect(START.pad.x[1]).toBeLessThanOrEqual(START.campZone.x[1]);
    expect(START.pad.x[1]).toBeLessThanOrEqual(SURFACE.meadow.x[1]);
    expect(SURFACE.stream.ponorX[0] - START.campZone.x[1]).toBeGreaterThanOrEqual(6);
    expect(SURFACE.mountain.peakX).toBe(GORGE.axisX);
    expect(START.campZone.noCavesDepth).toBeGreaterThanOrEqual(25); // QUALITY E3
  });
});

describe('biome bands', () => {
  it('follow the biome bible in order, with the same host rocks (shares sum to 1)', () => {
    expect(BANDS.map((b) => b.biome)).toEqual(biomeIds);
    BANDS.forEach((b, k) => {
      expect(new Set(b.rocks.map((r) => r.rock)), b.biome).toEqual(new Set(BIOMES[k]!.rocks));
      expect(b.rocks.reduce((s, r) => s + r.share, 0)).toBeCloseTo(1, 6);
      for (const r of b.rocks) expect(MAT_BY_KEY.has(r.rock), r.rock).toBe(true);
      expect(b.rocks.some((r) => r.rock === b.roofRock), `${b.biome} roof rock`).toBe(true);
    });
  });

  it('cover the whole depth 0..680 without holes or overlaps, keeping half of every band on its thinnest column', () => {
    BANDS.forEach((_, k) => {
      const [d0, d1] = nominal(k);
      if (k === 0) expect(d0).toBe(0);
      else expect(d0).toBe(nominal(k - 1)[1]);
      expect(minThickness(k), BIOMES[k]!.id).toBeGreaterThanOrEqual(0.5 * (d1 - d0));
      const [c0, c1] = bandCore(k);
      expect(c1 - c0, `${BIOMES[k]!.id} core`).toBeGreaterThan(0);
    });
    expect(nominal(BANDS.length - 1)[1]).toBe(WORLD_FRAME.biomeDepth);
  });

  it('keep every natural cave form under the roof limit of its rock (StructureSystem evaluates every row at start)', () => {
    const bad: string[] = [];
    for (const b of BANDS)
      for (const f of b.caves.forms) {
        const r = formRoof(b, f);
        if (!r.ok) bad.push(`${b.biome}.${f.kind} w${f.w[1]} h${f.h[0]}: load ${r.load.toFixed(1)} > cap ${r.cap}`);
        expect(f.w[0]).toBeLessThanOrEqual(f.w[1]);
        expect(f.h[0]).toBeLessThanOrEqual(f.h[1]);
        expect(f.weight).toBeGreaterThan(0);
      }
    expect(bad).toEqual([]);
  });

  it('give every biome a void budget and hazard cores for each of its local hazards', () => {
    BANDS.forEach((b, k) => {
      const [v0, v1] = b.caves.voidShare;
      expect(v0 > 0 && v0 < v1 && v1 <= 0.4, b.biome).toBe(true);
      for (const h of b.caves.hazardCores) {
        expect(BIOMES[k]!.hazards, `${b.biome} core ${h.hazard}`).toContain(h.hazard);
        expect(h.count[0]).toBeLessThanOrEqual(h.count[1]);
        expect(h.cue.length).toBeGreaterThan(8); // R4: a visible cue for every hazard zone
      }
    });
  });
});

describe('the Gorge: windows, seals, segments', () => {
  it('puts both windows of every deep biome (zigzag crossing) inside its core and inside one shaft segment', () => {
    for (const id of biomeIds.slice(1, 8)) {
      const ws = GORGE.windows.filter((w) => w.biome === id);
      expect(new Set(ws.map((w) => w.side)), id).toEqual(new Set(['W', 'E']));
      const [c0, c1] = bandCore(BIOME_INDEX.get(id)!);
      for (const w of ws) {
        expect(w.depth[0], `${id} ${w.side} top`).toBeGreaterThanOrEqual(c0);
        expect(w.depth[1], `${id} ${w.side} bottom`).toBeLessThanOrEqual(c1);
        expect(segmentOf(w.depth[0])).toBe(segmentOf(w.depth[1]));
        expect(w.depth[1] - w.depth[0] + 1, 'a dwarf fits through').toBeGreaterThanOrEqual(3);
        if (w.gate.kind === 'plug') expect(w.gate.thickness).toBeLessThanOrEqual(LEADING_LINES.gorgePulse.maxPlugForLight);
      }
      expect(new Set(ws.map((w) => segmentOf(w.depth[0]))).size, `${id}: one segment`).toBe(1);
    }
  });

  it('orders the seals down the shaft, each one a hard gate with existing requirements', () => {
    const segs = gorgeSegments();
    expect(segs.length).toBe(GORGE.seals.length + 1);
    for (let i = 1; i < GORGE.seals.length; i++) expect(GORGE.seals[i]!.depth).toBeGreaterThan(GORGE.seals[i - 1]!.depth);
    for (const s of GORGE.seals) {
      expect(s.depth > GORGE.depth[0] && s.depth < GORGE.depth[1]).toBe(true);
      expect(HARD_GATES.some((g) => g.id === s.id), s.id).toBe(true);
      for (const r of s.opens) expect(refExists(r), `${s.id} ${r.kind}:${r.id}`).toBe(true);
    }
  });
});

describe('landmarks, lairs, objects and spawns', () => {
  it('gives every biome but the Heart exactly one hub, inside the biome core (the camp on the surface)', () => {
    for (const id of biomeIds) {
      const hubs = LANDMARKS.filter((l) => l.biome === id && l.role === 'hub');
      expect(hubs.length, id).toBe(id === 'heart' ? 0 : 1);
    }
    for (const l of LANDMARKS) {
      expect(new Set(LANDMARKS.map((x) => x.id)).size).toBe(LANDMARKS.length);
      if (l.biome === 'foothills') continue; // surface landmarks live above the plain
      const k = BIOME_INDEX.get(l.biome)!;
      const [d0, d1] = nominal(k);
      expect(l.depth[0], `${l.id} top`).toBeGreaterThanOrEqual(d0 - (k === 1 ? 60 : 0)); // Ledges rise into the mountain
      expect(l.depth[1], `${l.id} bottom`).toBeLessThanOrEqual(d1);
    }
  });

  it('has one lair per boss in its own biome, never at the hub, on the far side of the Gorge in Ledges..Magma', () => {
    const bosses = CREATURES.filter((c) => c.boss);
    expect(new Set(LAIRS.map((l) => l.creature))).toEqual(new Set(bosses.map((b) => b.id)));
    for (const l of LAIRS) {
      const c = CREATURES.find((x) => x.id === l.creature)!;
      expect(c.biome, l.creature).toBe(l.biome);
      const lm = LANDMARKS.find((x) => x.id === l.landmark)!;
      expect(lm.biome).toBe(l.biome);
      if (l.biome !== 'heart') expect(l.minFromHub).toBeGreaterThanOrEqual(HUB_SAFE_RADIUS);
      const hub = LANDMARKS.find((x) => x.biome === l.biome && x.role === 'hub');
      const k = BIOME_INDEX.get(l.biome)!;
      if (k >= 1 && k <= 6) expect(lm.side, `${l.biome}: zigzag`).not.toBe(hub!.side);
    }
  });

  it('places every world object and every non-boss creature by a rule in one of its biomes', () => {
    for (const id of biomeIds)
      for (const r of OBJECT_RULES[id]) {
        const o = OBJECTS.find((x) => x.id === r.object);
        expect(o?.biomes, `${id} ${r.object}`).toContain(id);
        expect(r.per100).toBeGreaterThan(0);
      }
    for (const o of OBJECTS) expect(o.biomes.some((b) => OBJECT_RULES[b].some((r) => r.object === o.id)), o.id).toBe(true);
    for (const id of biomeIds)
      for (const r of SPAWN_RULES[id]) {
        const c = CREATURES.find((x) => x.id === r.creature);
        expect(c && !c.boss && c.biome === id, `${id} ${r.creature}`).toBe(true);
      }
    for (const c of CREATURES.filter((x) => !x.boss)) expect(SPAWN_RULES[c.biome].some((r) => r.creature === c.id), c.id).toBe(true);
  });
});

describe('deposits', () => {
  it('has a rule for every deposit of the bible in each of its biomes, and none elsewhere', () => {
    for (const d of DEPOSITS)
      for (const b of biomeIds) {
        const has = DEPOSIT_RULES[b].some((r) => r.deposit === d.id);
        expect(has, `${d.id} in ${b}`).toBe(d.biomes.includes(b));
      }
    for (const b of biomeIds) for (const r of DEPOSIT_RULES[b]) expect(DEPOSITS.some((d) => d.id === r.deposit), r.deposit).toBe(true);
  });

  it('handles the Heart: no deposits by design, and the guarded weighted pick returns null instead of throwing', () => {
    const empty = biomeIds.filter((b) => !DEPOSITS.some((d) => d.biomes.includes(b)));
    expect(empty).toEqual([...NO_DEPOSIT_BIOMES]);
    for (const b of NO_DEPOSIT_BIOMES) expect(DEPOSIT_RULES[b]).toEqual([]);
    const rng = new Rng(7);
    expect(() => rng.weighted(depositTable('heart'))).toThrow(); // the raw pick would crash the deposit pass
    expect(weightedOrNull(rng, depositTable('heart'))).toBeNull();
    expect(weightedOrNull(rng, depositTable('limestone'))?.deposit).toBeTruthy();
  });

  it('fits the rock: total and local densities, vein sizes, strata bands and the visual budget', () => {
    for (const b of BANDS) {
      const rules = DEPOSIT_RULES[b.biome];
      const total = rules.reduce((s, r) => s + r.density, 0);
      const strategic = rules.filter((r) => r.cls === 'strategic').reduce((s, r) => s + r.density, 0);
      expect(total, `${b.biome} total per mille`).toBeLessThanOrEqual(120); // ores stay information (VISION §2.1)
      expect(strategic, `${b.biome} strategic per mille`).toBeLessThanOrEqual(50);
      // local saturation: in every slice of the band the active deposits take at most 30% of the rock
      for (let s = 0; s < 1; s += 0.05) {
        let local = 0;
        for (const r of rules) if (s >= r.band[0] && s < r.band[1]) local += r.density / (r.band[1] - r.band[0]);
        expect(local, `${b.biome} slice ${s.toFixed(2)}`).toBeLessThanOrEqual(300);
      }
      for (const r of rules) {
        expect(r.vein[0]).toBeGreaterThanOrEqual(ACCEPTANCE.minVein);
        expect(r.vein[0]).toBeLessThanOrEqual(r.vein[1]);
        expect(r.band[0] >= 0 && r.band[0] < r.band[1] && r.band[1] <= 1, `${b.biome} ${r.deposit} band`).toBe(true);
        // the target tiles of the biome hold at least one vein of the largest size
        const veins = ((r.density / 1000) * solidEstimate(b.biome)) / r.vein[1];
        expect(veins, `${b.biome} ${r.deposit}: veins`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('keeps mother lodes inside hazard zones of their biome (R1) and matches the per-world counts of 05 §2.2', () => {
    const per = new Map<string, number>();
    for (const b of biomeIds)
      for (const r of DEPOSIT_RULES[b]) {
        if (!r.motherLodes) continue;
        per.set(r.deposit, (per.get(r.deposit) ?? 0) + r.motherLodes);
        const band = BANDS[BIOME_INDEX.get(b)!]!;
        expect(band.caves.hazardCores.some((h) => h.hazard === r.near), `${b} ${r.deposit} near ${r.near}`).toBe(true);
      }
    expect(Object.fromEntries(per)).toEqual({
      copper_vein: 3, tin_vein: 2, saltpeter_crust: 1, iron_vein: 3, lead_vein: 1, zinc_vein: 1, quartz_vein: 2,
      silver_vein: 2, sulfur_vent: 1, salt_bed: 1, nickel_vein: 1, gold_vein: 2, cobalt_vein: 1, amethyst_geode: 1,
      sapphire_geode: 1, frost_crystal_bed: 1, emberite_vein: 1, adamantite_vein: 1, glimmerite_vein: 1,
    });
    expect(MOTHER_LODE.maxFromHazard).toBe(12);
  });
});

describe('progression gates', () => {
  it('references only existing ids (items, buildings, infrastructure, tech, quests in 04-quests.md)', () => {
    const refs: GateRef[] = [...SOFT_GATES.flatMap((g) => g.counters), ...HARD_GATES.flatMap((g) => g.requires), ...GORGE.seals.flatMap((s) => s.opens)];
    const bad = refs.filter((r) => !refExists(r)).map((r) => `${r.kind}:${r.id}`);
    expect(bad).toEqual([]);
  });

  it('gives every local hazard of every biome a soft gate whose counters come from the hazard bible', () => {
    for (const b of BIOMES)
      for (const h of b.hazards) {
        if (h === 'raids' || h === 'hard_rock') continue; // colony-wide threat / hard gate by pick tier
        const g = SOFT_GATES.filter((x) => x.biome === b.id && x.hazard === h);
        expect(g.length, `${b.id} ${h}`).toBeGreaterThan(0);
        const counters = HAZARDS.find((x) => x.id === h)!.counters;
        for (const c of g.flatMap((x) => x.counters))
          if (c.kind !== 'tech') expect(counters, `${b.id} ${h}: ${c.id}`).toContain(c.id);
      }
    for (const g of SOFT_GATES) expect(BIOMES.find((b) => b.id === g.biome)!.hazards, `${g.biome} ${g.hazard}`).toContain(g.hazard);
  });

  it('puts a pick-tier hard gate at every biome whose rock needs a better pick, and the pick is good enough', () => {
    BIOMES.forEach((b, k) => {
      const rises = k > 0 && ROCK_PICK_TIER[b.id]! > ROCK_PICK_TIER[BIOMES[k - 1]!.id]!;
      const g = HARD_GATES.find((x) => x.biome === b.id && x.kind === 'pickTier');
      expect(Boolean(g), b.id).toBe(rises);
      if (g) {
        const pick = g.requires.find((r) => r.kind === 'item')!;
        expect(RES.get(pick.id)!.stats!.pickTier, `${b.id} ${pick.id}`).toBeGreaterThanOrEqual(ROCK_PICK_TIER[b.id]!);
      }
    });
    for (const b of BANDS) if (HARD_GATES.some((g) => g.biome === b.biome && g.kind === 'pickTier')) expect(b.cap, b.biome).toBeGreaterThanOrEqual(2);
  });
});

describe('start and tutorial (02-campaign §2)', () => {
  it('names existing objects and deposits within reach of the wagon', () => {
    for (const r of START.reach) {
      if (r.kind === 'object') expect(OBJECTS.some((o) => o.id === r.what && o.biomes.includes('foothills')), r.what).toBe(true);
      else expect(DEPOSITS.some((d) => d.id === r.what && (d.biomes.includes('foothills') || d.biomes.includes('limestone'))), r.what).toBe(true);
      expect(r.maxDist).toBeGreaterThan(0);
    }
  });

  it('builds the cave-in hall as an old settled room that holds exactly at its width (the script widens it)', () => {
    const h = START.tutorialHall;
    const lm = LANDMARKS.find((l) => l.id === h.landmark)!;
    expect(lm.size).toEqual(h.size);
    expect(lm.depth[1]).toBe(h.floorDepth);
    expect(h.size[0]).toBe(maxFlatRun('limestone', h.cavity === 'natural', false));
    const shaft = LANDMARKS.find((l) => l.id === START.oldShaft.landmark)!;
    expect(shaft.depth[0]).toBe(0);
    expect(shaft.depth[1]).toBe(lm.depth[0]);
    expect(h.floorDepth).toBeGreaterThan(START.campZone.noCavesDepth);
  });
});

describe('passes and acceptance', () => {
  it('runs deposits after caves and fluids, guarantees last, and keeps the E3 budget per tile', () => {
    const at = (p: string) => PASSES.indexOf(p as (typeof PASSES)[number]);
    expect(at('caves')).toBeLessThan(at('pillars'));
    expect(at('fluids')).toBeLessThan(at('deposits'));
    expect(at('guarantees')).toBe(PASSES.length - 1);
    // QUALITY E3 was 400 ms for 224 x 480; the budget per tile stays the same at 224 x 736
    expect(ACCEPTANCE.genMs).toBeLessThanOrEqual(Math.ceil((400 * CONFIG.worldH) / 480 / 100) * 100);
    expect(ACCEPTANCE.seeds).toBeGreaterThanOrEqual(10);
  });
});

describe('supply vs demand (WORLDGEN.md §4)', () => {
  const supply = supplyEstimate();
  const demand = completionRawDemand();

  it('covers the Act I demand (tiers 0-1) of every raw found in the Foothills and the Ledges', () => {
    const early = ['clay', 'sand', 'copper_ore', 'coal', 'limestone', 'saltpeter'];
    for (const id of early) {
      const need = (demand.get(id)?.byTier ?? []).slice(0, 2).reduce((s, x) => s + x, 0);
      expect(supply.get(id)!, `${id}: supply ${Math.round(supply.get(id)!)} vs T0-T1 demand ${Math.round(need)}`).toBeGreaterThanOrEqual(need);
    }
  });

  it('documents the raws whose world supply is below the completion demand (to systems-designer, F2-2)', () => {
    const rows = [...demand.entries()].map(([id, d]) => ({ id, need: d.total, have: supply.get(id) ?? 0 }));
    if (process.env.WORLDGEN_REPORT)
      console.log(rows.sort((a, b) => a.have / a.need - b.have / b.need).map((r) => `${r.id.padEnd(16)} supply ${Math.round(r.have).toString().padStart(6)}  demand ${Math.round(r.need).toString().padStart(6)}  x${(r.have / r.need).toFixed(2)}`).join('\n'));
    const deficits = rows.filter((r) => r.have < r.need).map((r) => r.id).sort();
    // Known: research packs of T5-T7 eat gems and coal far beyond a readable world (WORLDGEN.md §4).
    expect(deficits).toEqual(KNOWN_DEFICITS);
  });
});

/**
 * Raws whose estimated world supply is below the completion demand today (alarm when the list changes).
 * Cause: research packs of T2-T7 consume raw gems and ores one per pack (ember_codex: a ruby, rune_tome: a
 * runestone, crystal_tablet: frost crystal + amethyst) at hundreds of packs per tier, and deposits yield 1-3
 * per tile. Proposals for systems-designer: WORLDGEN.md §4.
 */
const KNOWN_DEFICITS: string[] = [
  'adamantite_ore', 'amethyst', 'coal', 'copper_ore', 'emberite_ore', 'frost_crystal', 'glimmerite_ore', 'gold_ore',
  'iron_ore', 'lead_ore', 'limestone', 'nickel_ore', 'obsidian', 'quartz', 'ruby', 'runestone', 'silver_ore', 'tin_ore',
  'zinc_ore',
];
