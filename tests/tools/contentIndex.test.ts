/**
 * Data browser index: every content entry is there, relations answer
 * "where from / what for / which biome / which research", search ignores
 * Polish diacritics, filters work, and no link in the UI points nowhere.
 */
import { describe, expect, it } from 'vitest';
import { analyze } from '../../src/content/analysis';
import { realBundle } from '../../src/tools/contentBundle';
import { checkContent, type Issue } from '../../src/tools/contentCheck';
import { buildIndex, filterEntries, issuesByKey, normalize, type Detail } from '../../src/tools/contentIndex';

const B = realBundle();
const A = analyze();
const IX = buildIndex(B, A);
const detail = (key: string): Detail => {
  const d = IX.detail(key);
  expect(d, key).toBeDefined();
  return d!;
};
const section = (d: Detail, title: string) => d.sections.find((s) => s.title === title)?.links ?? [];
const keys = (links: { key?: string }[]) => links.map((l) => l.key);

describe('content index', () => {
  it('has one entry per resource, building, recipe, research node and biome', () => {
    for (const r of B.resources) expect(IX.byKey.has(`resource:${r.id}`), r.id).toBe(true);
    for (const b of B.buildings) expect(IX.byKey.has(`building:${b.id}`), b.id).toBe(true);
    for (const r of B.recipes) expect(IX.byKey.has(`recipe:${r.id}`), r.id).toBe(true);
    for (const t of B.tech) expect(IX.byKey.has(`tech:${t.id}`), t.id).toBe(true);
    for (const b of B.biomes) expect(IX.byKey.has(`biome:${b.id}`), b.id).toBe(true);
    expect(new Set(IX.entries.map((e) => e.key)).size).toBe(IX.entries.length);
  });

  it('never links to an entry that does not exist', () => {
    const dangling: string[] = [];
    for (const e of IX.entries) {
      const d = IX.detail(e.key)!;
      const links = [...d.research, ...d.sections.flatMap((s) => s.links), ...(d.levels ?? []).flatMap((l) => [l.unlock, ...l.cost, ...l.recipes])];
      for (const l of links) if (l.key && !IX.byKey.has(l.key)) dangling.push(`${e.key} -> ${l.key}`);
    }
    expect(dangling).toEqual([]);
  });

  it('answers where a material comes from and what it is for', () => {
    const d = detail('resource:copper_bar');
    expect(keys(section(d, 'Skąd się bierze'))).toEqual(expect.arrayContaining(['recipe:copper_bar', 'recipe:copper_bar_coal']));
    expect(keys(section(d, 'Do czego służy'))).toEqual(expect.arrayContaining(['recipe:bronze_bar', 'building:hearth', 'infra:brazier']));
    expect(d.research.map((l) => l.key)).toContain('tech:copper_smelting');
    expect(d.entry.tier).toBe(0);
  });

  it('gives raw resources their deposits and biomes', () => {
    const d = detail('resource:iron_ore');
    const dep = section(d, 'Skąd się bierze').find((l) => l.key === 'deposit:iron_vein');
    expect(dep?.detail).toMatch(/Granitowe Korzenie.*kilof ≥ 2/);
    expect(d.entry.biomes).toEqual(expect.arrayContaining(['granite', 'fungal', 'sunken']));
    expect(keys(section(detail('resource:stone'), 'Skąd się bierze'))).toContain(undefined); // ordinary rock, no link
  });

  it('shows trophies with their boss and the node they open', () => {
    const d = detail('resource:alpha_pelt');
    expect(d.entry.sub).toBe('Trofeum bossa');
    expect(keys(section(d, 'Skąd się bierze'))).toContain('creature:alpha_wolf');
    expect(keys(section(d, 'Do czego służy'))).toContain('tech:stone_hearth');
  });

  it('shows the three building levels with unlock, tier, cost and recipes', () => {
    const d = detail('building:smelter');
    expect(d.levels).toHaveLength(3);
    expect(d.levels!.map((l) => l.unlock.key)).toEqual(['tech:copper_smelting', 'tech:blast_furnace', 'tech:magma_smeltery']);
    expect(d.levels!.map((l) => l.tier)).toEqual([0, 2, 6]);
    expect(keys(d.levels![0]!.recipes)).toContain('recipe:copper_bar');
    expect(d.levels![0]!.facts.find((f) => f.label === 'Rozmiar')?.value).toBe('2 × 2 kafli');
    expect(detail('building:hearth').levels![0]!.unlock.label).toBe('dostępne od startu');
  });

  it('shows recipes and research nodes with their relations', () => {
    const r = detail('recipe:bronze_bar');
    expect(keys(section(r, 'Wejścia'))).toEqual(['resource:copper_bar', 'resource:tin_bar']);
    expect(r.research[0]!.key).toBe('tech:bronze_age');
    const t = detail('tech:gas_masks');
    expect(keys(section(t, 'Odblokowuje'))).toEqual(['recipe:filter', 'recipe:filter_mask']);
    expect(keys(section(t, 'Wymaga'))).toEqual(['tech:glassmaking', 'tech:zinc_brass']);
    expect(t.facts.find((f) => f.label === 'Odsłania się')).toMatchObject({ value: 'od T3 · Grzybowe Groty', warn: true });
    expect(keys(section(detail('tech:glassmaking'), 'Wymagany przez'))).toContain('tech:gas_masks');
  });

  it('lists what a biome contains and what it introduces', () => {
    const d = detail('biome:fungal');
    expect(keys(section(d, 'Stworzenia'))).toContain('creature:web_queen');
    expect(keys(section(d, 'Złoża'))).toContain('deposit:silver_vein');
    expect(keys(section(d, 'Skały'))).toEqual(['material:sporeShale', 'material:mycelium']);
    expect(keys(section(d, 'Badania tej warstwy'))).toContain('tech:mushroom_farming');
    expect(keys(section(d, 'Nowe surowce i materiały od tej warstwy'))).toContain('resource:spider_silk');
  });

  it('searches names, English names and ids, ignoring Polish diacritics', () => {
    expect(normalize('Żółć łąki')).toBe('zolc laki');
    const names = (q: string) => filterEntries(IX, { q }).map((e) => e.key);
    expect(names('miedz')).toEqual(expect.arrayContaining(['resource:copper_bar', 'resource:copper_ore']));
    expect(names('ruda zel')[0]).toBe('resource:iron_ore');
    expect(names('brass')).toContain('resource:brass_bar');
    expect(names('iron_ore')[0]).toBe('resource:iron_ore');
  });

  it('filters by group, slot, biome and tier', () => {
    const weapons = filterEntries(IX, { groups: ['items'], slot: 'weapon' });
    expect(weapons.length).toBeGreaterThan(5);
    expect(weapons.every((e) => e.kind === 'resource' && e.slot === 'weapon')).toBe(true);
    const granite = filterEntries(IX, { groups: ['resources'], biome: 'granite' }).map((e) => e.id);
    expect(granite).toEqual(expect.arrayContaining(['iron_ore', 'lead_ore', 'chitin']));
    expect(granite).not.toContain('obsidian');
    const t6 = filterEntries(IX, { groups: ['tech'], tierMin: 6, tierMax: 6 });
    expect(t6.length).toBeGreaterThan(5);
    expect(t6.every((e) => e.tier === 6)).toBe(true);
  });

  it('attaches validator remarks to the right entries', () => {
    const issues: Issue[] = [
      { severity: 'warning', rule: 'prog.reveal', file: 'src/content/tech.ts', id: 'gas_masks', message: 'x', fix: 'y' },
      { severity: 'warning', rule: 'boss.trophyTech', file: 'src/content/tech.ts', id: 'guardian_sigil', message: 'x', fix: 'y' },
      { severity: 'error', rule: 'range.cost', file: 'src/content/buildings.ts', id: 'kiln:2', message: 'x', fix: 'y' },
      { severity: 'error', rule: 'world.depositMaterial', file: 'src/world/materials.ts', id: 'tin_vein', message: 'x', fix: 'y' },
    ];
    const m = issuesByKey(IX, issues);
    expect([...m.keys()].sort()).toEqual(['building:kiln', 'deposit:tin_vein', 'resource:guardian_sigil', 'tech:gas_masks']);
    // and every real remark finds its entry
    const real = checkContent(B, { analysis: A }).issues;
    const mapped = [...issuesByKey(IX, real).values()].flat().length;
    expect(mapped).toBe(real.length);
  });
});
