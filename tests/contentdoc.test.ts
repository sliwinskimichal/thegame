/**
 * Generates docs/CONTENT.md (the human-readable content bible) from the data.
 * Runs only with CONTENT_DOC=1:  CONTENT_DOC=1 npx vitest run tests/contentdoc.test.ts
 * Also prints a sanity summary of the progression analysis.
 */
import { writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyze, usages } from '../src/content/analysis';
import { BIOMES, HAZARDS } from '../src/content/biomes';
import { BUILDINGS, INFRASTRUCTURE } from '../src/content/buildings';
import { RECIPES } from '../src/content/recipes';
import { RES, RESOURCES } from '../src/content/resources';
import { CREATURES, DEPOSITS, OBJECTS } from '../src/content/sources';
import { TECH } from '../src/content/tech';
import type { Stack } from '../src/content/types';

const n = (id: string) => RES.get(id)?.namePl ?? id;
const st = (ss: readonly Stack[]) => ss.map((s) => `${s.n}× ${n(s.id)}`).join(', ');

describe.runIf(!!process.env.CONTENT_DOC)('content doc', () => {
  it('writes docs/CONTENT.md', () => {
    const A = analyze();
    const U = usages();
    const L: string[] = [];
    const kinds = (k: string) => RESOURCES.filter((r) => r.kind === k);
    L.push('# Biblia treści — Underhearth', '');
    L.push('> Plik generowany z danych (`src/content/`) poleceniem `CONTENT_DOC=1 npx vitest run tests/contentdoc.test.ts`.');
    L.push('> Nie edytuj ręcznie — zmieniaj dane. Spójność pilnuje `tests/content.test.ts`.', '');
    L.push('## Podsumowanie', '');
    L.push(`| Kategoria | Liczba |`, `|---|---|`);
    L.push(`| Biomy | ${BIOMES.length} |`, `| Zagrożenia środowiskowe | ${HAZARDS.length} |`);
    L.push(`| Złoża (rodzaje) | ${DEPOSITS.length} |`, `| Surowce kopalne | ${kinds('raw').length} |`);
    L.push(`| Surowce z obiektów i stworzeń | ${kinds('drop').length} |`, `| Materiały wytwarzane | ${kinds('material').length} |`);
    L.push(`| Przedmioty użytkowe krasnoludów | ${kinds('item').length} |`, `| Typy budowli (× 3 poziomy) | ${BUILDINGS.length} (${BUILDINGS.length * 3}) |`);
    L.push(`| Elementy infrastruktury | ${INFRASTRUCTURE.length} |`, `| Receptury | ${RECIPES.length} |`);
    L.push(`| Węzły drzewka technologii | ${TECH.length} |`, `| Obiekty do zbierania | ${OBJECTS.length} |`, `| Stworzenia (w tym bossowie) | ${CREATURES.length} (${CREATURES.filter((c) => c.boss).length}) |`, '');

    L.push('## Biomy i zagrożenia', '');
    for (const b of BIOMES) {
      L.push(`### ${b.tier}. ${b.namePl} (${b.depth[0]}–${b.depth[1]} kafli w głąb)`, '', b.descPl, '');
      L.push(`**Wyzwanie:** ${b.approachPl}`, '');
      for (const h of b.hazards) {
        const hz = HAZARDS.find((x) => x.id === h)!;
        L.push(`- **${hz.namePl}** — ${hz.descPl} Przeciwdziałanie: ${hz.counters.map((c) => n(c)).join(', ')}.`);
      }
      const creatures = CREATURES.filter((c) => c.biome === b.id);
      if (creatures.length) L.push('', `Stworzenia: ${creatures.map((c) => (c.boss ? `**${c.namePl} (boss)**` : c.namePl)).join(', ')}.`);
      const deps = DEPOSITS.filter((d) => d.biomes.includes(b.id));
      if (deps.length) L.push(`Złoża: ${deps.map((d) => d.namePl).join(', ')}.`);
      L.push('');
    }

    L.push('## Złoża', '', '| Złoże | Daje | Biomy | Twardość | Kilof (poziom) | Rzadkość |', '|---|---|---|---|---|---|');
    for (const d of DEPOSITS)
      L.push(`| ${d.namePl} | ${n(d.yields)} | ${d.biomes.map((b) => BIOMES.find((x) => x.id === b)!.namePl).join(', ')} | ${d.hardness} | ${d.pickTier} | ${d.rarity} |`);
    L.push('');

    const section = (title: string, kind: string) => {
      L.push(`## ${title}`, '', '| Nazwa | Warstwa (dostępne od) | Wartość | Skąd | Do czego |', '|---|---|---|---|---|');
      for (const r of kinds(kind)) {
        const from = [
          ...DEPOSITS.filter((d) => d.yields === r.id).map((d) => d.namePl),
          ...OBJECTS.filter((o) => o.drops.some((x) => x.id === r.id)).map((o) => o.namePl),
          ...CREATURES.filter((c) => c.drops.some((x) => x.id === r.id)).map((c) => c.namePl),
          ...RECIPES.filter((x) => x.outputs.some((o) => o.id === r.id)).map((x) => BUILDINGS.find((b) => b.id === x.at)!.levels[x.level - 1]!.namePl),
        ];
        const uses = (U.get(r.id) ?? []).map((u) => {
          const [k, id, lvl] = u.split(':');
          if (k === 'recipe') {
            const rc = RECIPES.find((x) => x.id === id)!;
            return n(rc.outputs[0]!.id);
          }
          if (k === 'building') return `${BUILDINGS.find((b) => b.id === id)!.levels[Number(lvl) - 1]!.namePl}`;
          if (k === 'infra') return INFRASTRUCTURE.find((i) => i.id === id)!.namePl;
          return `badanie: ${TECH.find((t) => t.id === id)!.namePl}`;
        });
        const uniq = (a: string[]) => [...new Set(a)];
        L.push(`| ${r.namePl} | ${r.tier} | ${r.value} | ${uniq(from).slice(0, 4).join(', ')} | ${uniq(uses).slice(0, 6).join(', ')}${uniq(uses).length > 6 ? '…' : ''} |`);
      }
      L.push('');
    };
    section('Surowce kopalne', 'raw');
    section('Surowce z obiektów i stworzeń', 'drop');
    section('Materiały wytwarzane', 'material');

    L.push('## Przedmioty krasnoludów', '', '| Nazwa | Slot | Warstwa | Statystyki | Receptura |', '|---|---|---|---|---|');
    for (const r of kinds('item')) {
      const rc = RECIPES.find((x) => x.outputs.some((o) => o.id === r.id));
      const stats = Object.entries(r.stats ?? {}).map(([k, v]) => `${k} ${v}`).join(', ');
      L.push(`| ${r.namePl} | ${r.slot} | ${r.tier} | ${stats} | ${rc ? st(rc.inputs) : '—'} |`);
    }
    L.push('');

    L.push('## Budowle (3 poziomy każda)', '');
    for (const b of BUILDINGS) {
      L.push(`### ${b.levels[0].namePl} → ${b.levels[1].namePl} → ${b.levels[2].namePl}`, '', b.descPl, '');
      L.push('| Poziom | Koszt | Dostępny od warstwy | Efekty |', '|---|---|---|---|');
      b.levels.forEach((lv, k) =>
        L.push(`| ${k + 1}. ${lv.namePl} | ${st(lv.cost)} | ${A.building.get(`${b.id}:${k + 1}`)} | ${Object.entries(lv.effects).map(([e, v]) => `${e} ${v}`).join(', ')}${lv.power ? `, energia ${lv.power}` : ''} |`),
      );
      L.push('');
    }
    L.push('## Infrastruktura', '', '| Nazwa | Koszt | Warstwa | Opis |', '|---|---|---|---|');
    for (const i of INFRASTRUCTURE) L.push(`| ${i.namePl} | ${st(i.cost)} | ${i.tier} | ${i.descPl} |`);
    L.push('');

    L.push('## Drzewko technologii', '');
    L.push('Węzły są ukryte („???”), dopóki gracz nie odkryje surowca z kolumny „Ujawnia”; liczba ukrytych węzłów jest zawsze widoczna.', '');
    for (let t = 0; t <= 7; t++) {
      const nodes = TECH.filter((x) => x.tier === t);
      L.push(`### Poziom ${t} — ${BIOMES[t]!.namePl} (${nodes.length} węzłów)`, '', '| Badanie | Koszt | Wymaga | Ujawnia | Odblokowuje |', '|---|---|---|---|---|');
      for (const x of nodes) {
        const un = [
          ...(x.unlocks.buildings ?? []).map(([b, l]) => BUILDINGS.find((q) => q.id === b)!.levels[l - 1]!.namePl),
          ...(x.unlocks.recipes ?? []).map((r) => n(RECIPES.find((q) => q.id === r)!.outputs[0]!.id)),
          ...(x.unlocks.infra ?? []).map((i) => INFRASTRUCTURE.find((q) => q.id === i)!.namePl),
        ];
        L.push(`| **${x.namePl}** — ${x.descPl} | ${st(x.cost)} | ${x.requires.map((q) => TECH.find((y) => y.id === q)!.namePl).join(', ') || '—'} | ${x.revealBy.map(n).join(', ') || 'od startu'} | ${[...new Set(un)].join(', ')} |`);
      }
      L.push('');
    }
    writeFileSync('docs/CONTENT.md', L.join('\n'));

    // sanity summary of the analysis
    const byTier = new Map<number, number>();
    for (const r of RESOURCES) byTier.set(A.res.get(r.id)!, (byTier.get(A.res.get(r.id)!) ?? 0) + 1);
    console.log('resources by obtainable tier:', [...byTier].sort((a, b) => a[0] - b[0]));
    console.log('sample:', ['bronze_bar', 'steel_bar', 'nickel_steel', 'cobalt_pick', 'adamant_bar', 'heart_key', 'frostcore_armor'].map((id) => `${id}@${A.res.get(id)}`).join(' '));
    expect(A.res.get('heart_key')).toBe(7);
  });
});
