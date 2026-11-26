#!/usr/bin/env node
/**
 * Economy audit — systems-designer tool for docs/design/systems/ECONOMY.md.
 *
 *   node docs/design/systems/tools/economy-audit.mjs [sinks] [values] [power] [timeline] [sim]
 *
 * Reads the real content graph (src/content) and pacing model (src/balance/model.ts) through
 * Vite's module runner, so it never needs a build step and never modifies src/.
 *   sinks    — sink class of every resource (recurring / scalable / equipment / one-off / great works / none)
 *   values   — value consistency of recipes (does crafting add value?) and value per dwarf-hour of gathering
 *   power    — power demand of one copy of every powered building vs plant output, per tier
 *   timeline — game days at the end of each tier (Weksel scheduling), default + Monte Carlo percentiles
 *   sim      — proposed recurring sinks (Weksel, fuel, maintenance, wear, spoilage, lullabies) added to the
 *              model, their cost in dwarf-hours and the pack-curve compensation that keeps ~40 h
 */
import { runnerImport } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const load = async (p) => (await runnerImport(root + p, { root, logLevel: 'silent', configFile: false })).module;
const [AN, RS, BL, RC, SR, TC, GW, MD] = await Promise.all(
  ['analysis', 'resources', 'buildings', 'recipes', 'sources', 'tech', 'greatworks'].map((f) => load(`src/content/${f}.ts`))
    .concat([load('src/balance/model.ts')]),
);
const { RESOURCES, RES } = RS;
const { BUILDINGS, INFRASTRUCTURE } = BL;
const { RECIPES } = RC;
const { DEPOSITS, OBJECTS, CREATURES } = SR;
const { TECH } = TC;
const { GREAT_WORKS } = GW;
const A = AN.analyze();
const U = AN.usages();

const want = new Set(process.argv.slice(2));
const on = (s) => want.size === 0 || want.has(s);
const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : '∞');
const pad = (s, n) => String(s).padEnd(n);
const line = (t) => console.log(`\n=== ${t} ${'='.repeat(Math.max(0, 70 - t.length))}`);

// ------------------------------------------------------------------ sinks
// Sink classes, strongest first. A resource inherits the strongest class among its consumers;
// a recipe consumer has the class of its strongest output (fixpoint over the recipe graph).
const RANK = { R: 5, S: 4, E: 3, O: 2, G: 1, '-': 0 };
const NAME = { R: 'zużywalny', S: 'skalowalny', E: 'wyposażenie', O: 'jednorazowy', G: 'Wielkie Dzieła', '-': 'BRAK' };
const BURNS = new Set(['torch']); // infra that burns out and is replaced
function itemBase(r) {
  if (r.slot === 'consumable' || r.slot === 'ammo') return 'R';
  if (r.stats?.durability) return 'R';
  return 'E';
}
const gwUse = new Map();
for (const g of GREAT_WORKS) g.stages.forEach((st, i) => st.cost.forEach((s) => {
  const l = gwUse.get(s.id) ?? [];
  l.push(`gw:${g.id}:${i + 1}`);
  gwUse.set(s.id, l);
}));
const cls = new Map(RESOURCES.map((r) => [r.id, r.kind === 'item' ? itemBase(r) : '-']));
const best = (a, b) => (RANK[a] >= RANK[b] ? a : b);
const consumerClass = (u) => {
  if (u.startsWith('recipe:')) {
    const r = RECIPES.find((x) => x.id === u.slice(7));
    return r.outputs.reduce((c, o) => best(c, cls.get(o.id)), '-');
  }
  if (u.startsWith('infra:')) return BURNS.has(u.slice(6)) ? 'R' : 'S';
  if (u.startsWith('building:') || u.startsWith('tech:')) return 'O';
  if (u.startsWith('gw:')) return 'G';
  return '-';
};
const usesOf = (id) => [...(U.get(id) ?? []), ...(gwUse.get(id) ?? [])];
for (let it = 0; it < 50; it++) {
  let changed = false;
  for (const r of RESOURCES) {
    let c = r.kind === 'item' ? itemBase(r) : '-';
    for (const u of usesOf(r.id)) c = best(c, consumerClass(u));
    if (c !== cls.get(r.id)) { cls.set(r.id, c); changed = true; }
  }
  if (!changed) break;
}
const consumerTier = (u) => {
  const [kind, ...rest] = u.split(':');
  if (kind === 'recipe') return A.recipe.get(rest[0]) ?? Infinity;
  if (kind === 'infra') return A.infra.get(rest[0]) ?? Infinity;
  if (kind === 'building') return A.building.get(`${rest[0]}:${rest[1]}`) ?? Infinity;
  if (kind === 'tech') return A.tech.get(rest[0]) ?? Infinity;
  if (kind === 'gw') return GREAT_WORKS.find((g) => g.id === rest[0]).tier;
  return Infinity;
};
/** Recurring sources: deposits in several biomes, regrowing objects, non-boss creatures (respawn). */
const renewable = (id) =>
  OBJECTS.some((o) => o.regrows && o.drops.some((d) => d.id === id)) ||
  CREATURES.some((c) => !c.boss && c.drops.some((d) => d.id === id));
const lastSourceTier = (id) => {
  const BT = { foothills: 0, limestone: 1, granite: 2, fungal: 3, sunken: 4, crystal: 5, magma: 6, ancient: 7, heart: 8 };
  let t = -1;
  for (const d of DEPOSITS) if (d.yields === id) t = Math.max(t, ...d.biomes.map((b) => BT[b]));
  for (const o of OBJECTS) if (o.drops.some((x) => x.id === id)) t = Math.max(t, ...o.biomes.map((b) => BT[b]));
  for (const c of CREATURES) if (c.drops.some((x) => x.id === id)) t = Math.max(t, BT[c.biome]);
  if (id === 'stone') t = 8;
  return t;
};

if (on('sinks')) {
  line('ODPŁYWY: klasa odpływu każdego zasobu (najsilniejszy konsument)');
  console.log('klasy: R zużywalny (receptury/eksploatacja), S skalowalny (infrastruktura stawiana wielokrotnie),');
  console.log('       E wyposażenie bez zużycia (1 na krasnoluda), O jednorazowy (budowla/badanie), G tylko Wielkie Dzieła');
  for (const kind of ['raw', 'drop', 'material', 'item']) {
    const rows = RESOURCES.filter((r) => r.kind === kind);
    const by = {};
    for (const r of rows) (by[cls.get(r.id)] ??= []).push(r.id);
    console.log(`\n[${kind}] ${rows.length} szt.: ` + Object.entries(by).sort((a, b) => RANK[b[0]] - RANK[a[0]]).map(([c, l]) => `${c}=${l.length}`).join(' '));
    for (const c of ['S', 'E', 'O', 'G', '-']) if (by[c]) console.log(`  ${c} ${NAME[c]}: ${by[c].join(', ')}`);
  }
  line('ODPŁYWY: zasoby bez zużywalnego odpływu (klasa < R) — kandydaci do nowych odpływów');
  for (const r of RESOURCES) {
    const c = cls.get(r.id);
    if (c === 'R' || r.kind === 'item') continue;
    const uses = usesOf(r.id);
    console.log(`${pad(r.id, 18)} ${pad(r.kind, 8)} T${r.tier} v${pad(r.value, 4)} ${pad(NAME[c], 14)} ${uses.join(' ') || '(brak użyć)'}`);
  }
  line('ODPŁYWY: zasoby odnawialne, których odpływ kończy się wcześnie (nadwyżka w głębi)');
  console.log('id                 źródło do T  ostatni konsument T  konsumenci');
  for (const r of RESOURCES) {
    if (r.kind === 'item' || !renewable(r.id)) continue;
    const uses = usesOf(r.id).filter((u) => !u.startsWith('gw:'));
    const last = Math.max(-1, ...uses.map(consumerTier));
    const src = lastSourceTier(r.id);
    if (src - last >= 2) console.log(`${pad(r.id, 18)} T${pad(src, 11)} T${pad(last, 19)} ${uses.join(' ')}`);
  }
  line('ODPŁYWY: trofea — popyt (badania/receptury/Dzieła) vs podaż (1 boss = 1 sztuka)');
  for (const r of RESOURCES.filter((x) => x.tags?.includes('trophy'))) {
    const uses = usesOf(r.id);
    const need = uses.reduce((s, u) => {
      const [kind, id, lv] = u.split(':');
      const st = kind === 'tech' ? TECH.find((t) => t.id === id).cost
        : kind === 'recipe' ? RECIPES.find((x) => x.id === id).inputs
        : kind === 'gw' ? GREAT_WORKS.find((g) => g.id === id).stages[Number(lv) - 1].cost : [];
      return s + (st.find((x) => x.id === r.id)?.n ?? 0);
    }, 0);
    const supply = CREATURES.filter((c) => c.drops.some((d) => d.id === r.id)).length;
    console.log(`${pad(r.id, 18)} popyt ${need} / podaż ${supply}${need > supply ? '  <-- KONFLIKT' : ''}  ${uses.join(' ') || '(brak odpływu)'}`);
  }
  line('ODPŁYWY: wyposażenie bez wytrzymałości (klasa E) per slot');
  const bySlot = {};
  for (const r of RESOURCES.filter((x) => x.kind === 'item' && cls.get(x.id) === 'E')) (bySlot[r.slot] ??= []).push(r.id);
  for (const [s, l] of Object.entries(bySlot)) console.log(`${pad(s, 8)} ${l.length}: ${l.join(', ')}`);
}

// ------------------------------------------------------------------ values
const m0 = new MD.PacingModel();
if (on('values')) {
  line('WARTOŚCI: czy receptura dodaje wartość? (Σ wyjść / Σ wejść wg pola value)');
  const rows = [];
  for (const r of RECIPES) {
    if (!r.inputs.length) continue;
    const inV = r.inputs.reduce((s, x) => s + x.n * RES.get(x.id).value, 0);
    const outV = r.outputs.reduce((s, x) => s + x.n * RES.get(x.id).value, 0);
    rows.push({ id: r.id, at: `${r.at}:${r.level}`, ratio: outV / inV, inV, outV, wage: ((outV - inV) / r.time) * 60 });
  }
  rows.sort((a, b) => a.ratio - b.ratio);
  const bad = rows.filter((x) => x.ratio < 1.05);
  const hot = rows.filter((x) => x.ratio > 2.5);
  console.log(`receptur z wejściami: ${rows.length}; mediana mnożnika ${rows[Math.floor(rows.length / 2)].ratio.toFixed(2)}`);
  console.log(`niszczą lub nie dodają wartości (< 1,05): ${bad.length}`);
  for (const x of bad) console.log(`  ${pad(x.id, 20)} ${pad(x.at, 14)} ${x.inV} -> ${x.outV}  (×${x.ratio.toFixed(2)})`);
  console.log(`„drukarki wartości” (> 2,5): ${hot.length}`);
  for (const x of hot) console.log(`  ${pad(x.id, 20)} ${pad(x.at, 14)} ${x.inV} -> ${x.outV}  (×${x.ratio.toFixed(2)})`);

  line('WARTOŚCI: wartość na krasnoludo-godzinę pozyskania (value / unitWork) — farmienie');
  console.log('id                 T  sr/kh w swoim T   sr/kh w T+2   sr/kh w T8   droga');
  const gather = RESOURCES.filter((r) => r.kind === 'raw' || (r.kind === 'drop' && !r.tags?.includes('trophy')));
  const out = [];
  for (const r of gather) {
    const k = A.res.get(r.id);
    if (!Number.isFinite(k)) continue;
    const v = (kk) => (r.value / m0.unitWork(r.id, kk)) * 3600;
    const route = DEPOSITS.some((d) => d.yields === r.id) ? 'złoże' : OBJECTS.some((o) => o.drops.some((d) => d.id === r.id)) ? 'obiekt' : 'stworzenie';
    out.push({ id: r.id, k, a: v(k), b: v(Math.min(8, k + 2)), c: v(8), route });
  }
  out.sort((a, b) => a.k - b.k || b.a - a.a);
  for (const x of out) console.log(`${pad(x.id, 18)} ${x.k}  ${pad(x.a.toFixed(0), 16)} ${pad(x.b.toFixed(0), 13)} ${pad(x.c.toFixed(0), 12)} ${x.route}`);
  // depth premium check: best sr/kh of resources native to tier k when the colony is at tier k
  console.log('\nnajlepsze sr/kh surowców z płytszych biomów vs rodzimych, gdy gród jest w T(k):');
  for (let k = 1; k <= 8; k++) {
    let shallow = 0, sId = '', native = 0, nId = '';
    for (const r of gather) {
      const t = A.res.get(r.id);
      if (!Number.isFinite(t) || t > k) continue;
      const v = (r.value / m0.unitWork(r.id, k)) * 3600;
      if (t <= k - 2 && v > shallow) { shallow = v; sId = r.id; }
      if (t === k && v > native) { native = v; nId = r.id; }
    }
    console.log(`  T${k}: płytkie (≤T${k - 2}) ${shallow.toFixed(0)} (${sId})  rodzime ${native.toFixed(0)} (${nId})  stosunek ${(native / Math.max(1, shallow)).toFixed(2)}`);
  }
}

// ------------------------------------------------------------------ power
const powerTable = () => {
  const plant = BUILDINGS.find((b) => b.id === 'power_plant');
  const rows = [];
  for (let k = 0; k <= 8; k++) {
    let need = 0;
    const who = [];
    for (const b of BUILDINGS) {
      if (b.id === 'power_plant') continue;
      let p = 0;
      b.levels.forEach((lv, i) => { if ((A.building.get(`${b.id}:${i + 1}`) ?? Infinity) <= k) p = lv.power ?? 0; });
      if (p > 0) { need += p; who.push(`${b.id}${p}`); }
    }
    let lvl = -1;
    plant.levels.forEach((_, i) => { if ((A.building.get(`power_plant:${i + 1}`) ?? Infinity) <= k) lvl = i; });
    const out = lvl >= 0 ? -plant.levels[lvl].power : 0;
    rows.push({ k, need, lvl, out, plants: out ? Math.ceil(need / out) : need ? Infinity : 0, who });
  }
  return rows;
};
if (on('power')) {
  line('ENERGIA: pobór 1 kopii każdej zasilanej budowli (najwyższy dostępny poziom) vs elektrownia');
  for (const r of powerTable()) console.log(`T${r.k}: pobór ${pad(r.need, 3)} kW  elektrownia poz.${r.lvl + 1} (${r.out} kW) -> ${r.plants} szt.  ${r.who.join(' ')}`);
}

// ------------------------------------------------------------------ timeline + sim
/** Same integration as PacingModel.run, plus game days and an optional colony-level labour drain
 *  (dwarf-equivalents busy with upkeep) and a food-waste factor per tier. */
function runDetailed(model, mode, bh = MD.DEFAULT_BEHAVIOUR, econ = null) {
  const nodes = model.completionNodes();
  let pop = 7;
  let total = 0;
  let days = 0;
  const tiers = [];
  for (let k = 0; k < MD.TIERS; k++) {
    const breakdown = model.demand(k, mode, nodes, bh.tunnelScale);
    if (econ) for (const [cat, sec] of Object.entries(econ.extra(model, k))) breakdown[cat] = (breakdown[cat] ?? 0) + sec / 3600;
    const workHours = Object.values(breakdown).reduce((a, b) => a + b, 0);
    const cap = model.popCap(k);
    const eff = bh.efficiency * (1 + 0.025 * k);
    const meal = Math.min(model.unitWork('bread', k), model.unitWork('roast', k), model.unitWork('mushroom_stew', k));
    const drink = model.unitWork('ale', k);
    const waste = econ ? econ.waste(k) : 0;
    const sustain = ((meal + drink) * (1 + waste)) / MD.DAY_SECONDS;
    const drain = econ ? econ.drain(model, k, pop) : 0;
    let done = 0;
    let hours = 0;
    let drainSum = 0;
    while (done < workHours && hours < 500) {
      const dt = 0.1;
      const d = econ ? econ.drain(model, k, pop) : drain;
      done += Math.max(pop * 0.05, pop * Math.max(0.05, eff - sustain) - d) * bh.gameSpeed * dt;
      drainSum += d * bh.gameSpeed * dt;
      pop = Math.min(cap, pop + bh.migrantsPerHour * dt);
      hours += dt;
    }
    const boss = bh.bossHours * (1 + 0.2 * k);
    const real = hours * (1 + bh.pause + bh.idle) + boss;
    const gameDays = (3600 / MD.DAY_SECONDS) * (bh.gameSpeed * hours * (1 + bh.idle) + boss);
    days += gameDays;
    total += real;
    tiers.push({ k, workHours, realHours: real, days, gameDays, pop: Math.round(pop), drainHours: drainSum, breakdown });
  }
  return { tiers, total, days };
}
const behaviours = (n, seed) => {
  // same distribution as PacingModel.monteCarlo
  const { Rng } = MD.__rng ?? {};
  void Rng;
  return null;
};
void behaviours;

if (on('timeline')) {
  line('OŚ CZASU: dni gry na końcu każdego biomu (pauza nie płynie; doba = 600 s przy 1×)');
  const r = runDetailed(m0, 'complete');
  console.log('T  h(real)  cum h   dni w T  cum dni  ludność');
  let cum = 0;
  for (const t of r.tiers) {
    cum += t.realHours;
    console.log(`${t.k}  ${pad(f1(t.realHours), 7)}  ${pad(f1(cum), 6)}  ${pad(f1(t.gameDays), 7)}  ${pad(f1(t.days), 7)}  ${t.pop}`);
  }
  // percentile profiles: slow / median / fast players (same parameter ranges as the model's Monte Carlo)
  const profiles = {
    'szybki (P10)': { efficiency: 0.47, gameSpeed: 2.0, migrantsPerHour: 8, tunnelScale: 0.85, bossHours: 0.28, pause: 0.1, idle: 0.12 },
    'mediana': MD.DEFAULT_BEHAVIOUR,
    'wolny (P90)': { efficiency: 0.33, gameSpeed: 1.3, migrantsPerHour: 4.5, tunnelScale: 1.25, bossHours: 0.48, pause: 0.23, idle: 0.42 },
  };
  console.log('\nprofil          h ukończenia  dni na końcu T1  T3  T5  T6  T7');
  for (const [name, bh] of Object.entries(profiles)) {
    const x = runDetailed(m0, 'complete', bh);
    const d = (k) => x.tiers[k].days.toFixed(0);
    console.log(`${pad(name, 15)} ${pad(f1(x.total), 13)} ${pad(d(1), 16)} ${d(3)} ${d(5)} ${d(6)} ${d(7)}`);
  }
}

// ---------------------------------------------------------------- proposed sinks (ECONOMY.md §4–§6)
const P = {
  /** Weksel: 5 installments on a 7-year calendar (year = 44 game days; due days 44/110/176/242/308), each a
   *  goods basket booked in the tier where the median colony is on its due day (timeline section). */
  weksel: {
    1: [['copper_bar', 50], ['bronze_bar', 20]],
    2: [['iron_bar', 60], ['steel_bar', 25]], // + optional silver from the grottos (doc §4)
    4: [['nickel_steel', 30], ['gold_bar', 15], ['pearl', 10]],
    5: [['cobalt_steel', 30], ['cut_sapphire', 12], ['cut_amethyst', 10]],
    7: [['adamant_bar', 30], ['emberbronze_bar', 30], ['cut_ruby', 10]],
  },
  /** Steam engine coal per game day at full load (data now: fuelPerMin 6 = 60/day); burn scales with load. */
  steamFuelPerDay: 24,
  /** Maintenance of powered machines, stacks per machine per 10 game days (T2-T3 pitch grease, T4+ gasket + fish oil). */
  maintenance: (k) => (k >= 4 ? [['gasket', 1], ['fish_oil', 0.5]] : k >= 2 ? [['pitch', 1]] : []),
  /** Fuel lights in use and burn per game day: torch 1 per 5 days; oil lamp 1 pitch per 4 days. Spore lamps (T3),
   *  crystal posts (T5), ember and glimmer lights burn nothing. */
  lights: (k) => (k <= 1 ? { torch: 30 / 5 } : k === 2 ? { oil: 20 } : k === 3 ? { oil: 10 } : k === 4 ? { oil: 5 } : {}),
  /** Equipment wear: repairs at 25% of cost, ~1 per piece of militia + expedition kit (14 sets) per tier. */
  repairsPerTier: 1,
  /** Food lost to spoilage (share of food & drink labour); salt (T4) and cold stores (T5) cut it. */
  waste: [0.1, 0.1, 0.08, 0.08, 0.05, 0.04, 0.04, 0.04, 0.04],
  /** Lullaby singers keeping Awakening down (voluntary; median player), dwarf-equivalents. */
  singers: [0, 0, 0.1, 0.1, 0.2, 0.2, 0.3, 0.3, 0.3],
};
const econ = {
  extra(model, k) {
    const out = {};
    const basket = P.weksel[k];
    if (basket) out.weksel = basket.reduce((s, [id, n]) => s + n * model.unitWork(id, k), 0);
    // wear of militia (6) and expedition (8) kit: best weapon/body/head of the tier
    let kit = 0;
    for (const slot of ['weapon', 'body', 'head']) {
      let bestId = null, bestV = -1;
      for (const r of RESOURCES) if (r.slot === slot && (A.res.get(r.id) ?? Infinity) <= k) {
        const v = r.stats?.damage ?? r.stats?.armor ?? 0;
        if (v > bestV) { bestV = v; bestId = r.id; }
      }
      if (bestId) kit += model.unitWork(bestId, k);
    }
    out.wear = 14 * kit * 0.25 * P.repairsPerTier;
    return out;
  },
  waste: (k) => P.waste[k],
  drain(model, k) {
    // dwarf-equivalents (dwarf-seconds per game second) busy with upkeep
    let perDay = 0; // dwarf-seconds per game day
    const pw = powerTable()[k];
    if (pw.lvl === 1) perDay += (pw.need / 16) * P.steamFuelPerDay * model.unitWork('coal', k);
    const machines = BUILDINGS.filter((b) => b.levels.some((lv, i) => (lv.power ?? 0) > 0 && (A.building.get(`${b.id}:${i + 1}`) ?? Infinity) <= k)).length;
    for (const [id, n] of P.maintenance(k)) perDay += (machines * n * model.unitWork(id, k)) / 10;
    const L = P.lights(k);
    if (L.torch) perDay += L.torch * (model.unitWork('wood', k) + model.unitWork('resin', k));
    if (L.oil) perDay += L.oil * 0.25 * model.unitWork('pitch', k);
    return perDay / MD.DAY_SECONDS + P.singers[k];
  },
};

if (on('sim')) {
  line('SYMULACJA: proponowane odpływy w modelu tempa (mediana gracza)');
  const base = runDetailed(m0, 'complete');
  const withE = runDetailed(m0, 'complete', MD.DEFAULT_BEHAVIOUR, econ);
  console.log('T  baza h  +odpływy h  weksel kh  zużycie kh  utrzymanie (drenaż) kh');
  base.tiers.forEach((t, k) => {
    const e = withE.tiers[k];
    console.log(`${k}  ${pad(f1(t.realHours), 6)}  ${pad(f1(e.realHours), 10)}  ${pad(f1(e.breakdown.weksel ?? 0), 9)}  ${pad(f1(e.breakdown.wear ?? 0), 10)}  ${f1(e.drainHours)}`);
  });
  const sumW = withE.tiers.reduce((s, t) => s + (t.breakdown.weksel ?? 0), 0);
  const sumD = withE.tiers.reduce((s, t) => s + t.drainHours, 0);
  const sumAll = withE.tiers.reduce((s, t) => s + t.workHours, 0) + sumD;
  console.log(`razem: baza ${f1(base.total)} h -> z odpływami ${f1(withE.total)} h; Weksel ${f1(sumW)} kh, utrzymanie ${f1(sumD)} kh (${((100 * (sumW + sumD)) / sumAll).toFixed(1)}% pracy)`);
  console.log('Weksel — wartość rat (sr = pole value):');
  for (const [k, b] of Object.entries(P.weksel)) {
    const sr = b.reduce((s, [id, n]) => s + n * RES.get(id).value, 0);
    const kh = b.reduce((s, [id, n]) => s + n * m0.unitWork(id, Number(k)), 0) / 3600;
    console.log(`  rata w T${k}: ${b.map(([id, n]) => `${n}× ${id}`).join(' + ')} = ${sr} sr, ${kh.toFixed(1)} kh pracy (${((100 * kh) / base.tiers[k].workHours).toFixed(1)}% pracy biomu)`);
  }

  line('SYMULACJA: kompensacja krzywą ksiąg (turniej mini: wynik jak w tests/balance.test.ts)');
  const T = MD.TARGET_HOURS;
  const rows = [];
  for (const base_ of [6.2, 6.5, 6.8, 7]) for (const growth of [1.3, 1.31, 1.32, 1.33]) {
    const mm = new MD.PacingModel({ base: base_, growth, prevShare: 0.6, early: 0.6 });
    const r = runDetailed(mm, 'complete', MD.DEFAULT_BEHAVIOUR, econ);
    let score = 0;
    r.tiers.forEach((t, k) => (score += Math.log(t.realHours / T[k]) ** 2));
    score += 3 * Math.log(r.total / MD.TARGET_COMPLETION) ** 2;
    const ok = r.tiers.every((t, k) => t.realHours / T[k] > 0.55 && t.realHours / T[k] < 1.8);
    rows.push({ name: `baza ${base_} wzrost ${growth}`, score, total: r.total, tiers: r.tiers.map((t) => t.realHours), ok });
  }
  rows.sort((a, b) => a.score - b.score);
  for (const r of rows.slice(0, 6)) console.log(`${pad(r.name, 22)} wynik ${r.score.toFixed(3)} suma ${f1(r.total)} h ${r.ok ? 'OK ' : 'POZA'} | ${r.tiers.map(f1).join(' ')}`);
  const cur = runDetailed(new MD.PacingModel(), 'complete', MD.DEFAULT_BEHAVIOUR, econ);
  console.log(`obecna krzywa (7 / 1,33) z odpływami: ${f1(cur.total)} h | ${cur.tiers.map((t) => f1(t.realHours)).join(' ')}`);
}
