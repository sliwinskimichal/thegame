#!/usr/bin/env python3
"""Style report of a tournament run: the illustrated-direction metrics per variant.

Usage: python3 scripts/style-report.py <outDir> [--detail] [--sort score|order|name]
                                       [--json PATH] [--ref IMAGE] [--jobs N]

Walks <outDir>/<variant>/<scenario>.png (the layout written by scripts/tournament.mjs),
measures every screenshot with scripts/refstats.py (its stats/score/TARGET are imported,
not copied, so the report and the reference measurement can never disagree), prints a
markdown table per variant - means over its scenarios, a check per target, the number of
targets met, the distance to the targets and the per-scenario hit rate - and writes
<outDir>/style_metrics.json (or --json PATH).

  --detail      also one row per variant x scenario
  --sort        score (default: most targets met, then closest), order (manifest/directory), name
  --ref IMAGE   add a reference row, e.g. --ref .reference/owner-style.jpg (local only)
  --jobs N      measure N images in parallel (default 1)

Targets come from refstats.TARGET (docs/team/CHARTER.md section 4).
dist = sum over targets of how far the mean lies outside its range, in range widths
(open ranges such as "edges >= 15%" use the lower bound as the width); 0 = all met.
Exit: 0 report written, 1 nothing measurable found, 2 bad arguments or missing directory.
"""
import argparse
import json
import os
import sys
from concurrent.futures import ProcessPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from refstats import TARGET, score, stats  # noqa: E402  (shared measurement, see docstring)

LABELS = {'L_mean': 'L* śr', 'dark_pct': 'czerń %', 'chroma_mean': 'chroma', 'edge_pct': 'krawędzie %', 'ink_pct': 'kreska %'}
KEYS = list(TARGET.keys())
OPEN = 100  # an upper bound of 100 (%) means "at least lo"


def width(lo, hi):
    return float(lo if hi >= OPEN else hi - lo) or 1.0


def dist(mean):
    d = 0.0
    for k, (lo, hi) in TARGET.items():
        v = mean[k]
        d += max(0.0, lo - v, v - hi) / width(lo, hi)
    return d


def target_text(k):
    lo, hi = TARGET[k]
    return f'{LABELS.get(k, k)} ≥ {lo}' if hi >= OPEN else f'{LABELS.get(k, k)} {lo}–{hi}'


def plural(n, one, few, many):
    if n == 1:
        return one
    return few if 2 <= n % 10 <= 4 and not 12 <= n % 100 <= 14 else many


def discover(out):
    """{variant: [scenario, ...]} for every subdirectory holding PNG screenshots, plus the scenario order."""
    variants = {}
    for name in sorted(os.listdir(out)):
        d = os.path.join(out, name)
        if not os.path.isdir(d):
            continue
        shots = sorted(f[:-4] for f in os.listdir(d) if f.lower().endswith('.png'))
        if shots:
            variants[name] = shots
    order, sc_order = [], []
    man = os.path.join(out, 'manifest.json')
    if os.path.exists(man):
        try:
            m = json.load(open(man, encoding='utf-8'))
            order = list(m.get('styles', {}).keys())
            sc_order = list(m.get('scenarios', []))
        except (OSError, ValueError) as e:
            print(f'uwaga: nie odczytano {man} ({e}); kolejność alfabetyczna', file=sys.stderr)
    rank = lambda v: (order.index(v) if v in order else len(order), v)
    variants = dict(sorted(variants.items(), key=lambda kv: rank(kv[0])))
    scen = sorted({s for shots in variants.values() for s in shots}, key=lambda s: (sc_order.index(s) if s in sc_order else len(sc_order), s))
    return variants, scen


def measure(path):
    try:
        return path, stats(path), None
    except Exception as e:  # unreadable or truncated image: report it, keep going
        return path, None, f'{type(e).__name__}: {e}'


def main(argv):
    ap = argparse.ArgumentParser(description='Raport stylu turnieju (metryki z scripts/refstats.py).')
    ap.add_argument('outDir')
    ap.add_argument('--detail', action='store_true')
    ap.add_argument('--sort', choices=['score', 'order', 'name'], default='score')
    ap.add_argument('--json', dest='json_path')
    ap.add_argument('--ref')
    ap.add_argument('--jobs', type=int, default=1)
    a = ap.parse_args(argv)

    out = a.outDir
    if not os.path.isdir(out):
        print(f'Katalog „{out}” nie istnieje. Podaj katalog wyników turnieju (node scripts/tournament.mjs <url> <outDir> ...).', file=sys.stderr)
        return 2
    variants, scenarios = discover(out)
    if not variants:
        print(f'Nie znaleziono wariantów w „{out}”: oczekiwano plików {out}/<wariant>/<scenariusz>.png.', file=sys.stderr)
        return 1

    jobs = [(v, s, os.path.join(out, v, f'{s}.png')) for v, shots in variants.items() for s in shots]
    paths = [p for _, _, p in jobs]
    if a.jobs > 1:
        with ProcessPoolExecutor(a.jobs) as ex:
            results = {p: (st, err) for p, st, err in ex.map(measure, paths)}
    else:
        results = {p: (st, err) for p, st, err in map(measure, paths)}

    skipped, rows = [], {}
    for v, s, p in jobs:
        st, err = results[p]
        if err:
            skipped.append({'path': p, 'reason': err})
            continue
        rows.setdefault(v, {})[s] = {**st, 'targets_met': score(st)}

    report = {}
    for v in variants:
        per = rows.get(v, {})
        if not per:
            continue
        mean = {k: round(sum(r[k] for r in per.values()) / len(per), 2) for k in next(iter(per.values())) if k != 'targets_met'}
        met = {k: lo <= mean[k] <= hi for k, (lo, hi) in TARGET.items()}
        report[v] = {
            'scenarios': per,
            'missing': [s for s in scenarios if s not in per],
            'mean': mean,
            'met': met,
            'targets_met': sum(met.values()),
            'targets_total': len(TARGET),
            'dist': round(dist(mean), 3),
            'scenario_hit_rate': round(sum(r['targets_met'] for r in per.values()) / len(per), 3),
        }
    if not report:
        print(f'Żaden zrzut w „{out}” nie dał się zmierzyć ({len(skipped)} błędów, np. {skipped[0]["reason"] if skipped else "?"}).', file=sys.stderr)
        return 1

    names = list(report)
    if a.sort == 'score':
        names.sort(key=lambda v: (-report[v]['targets_met'], report[v]['dist'], -report[v]['scenario_hit_rate'], v))
    elif a.sort == 'name':
        names.sort()

    ref = None
    if a.ref:
        _, st, err = measure(a.ref)
        if err:
            print(f'uwaga: referencji „{a.ref}” nie zmierzono ({err})', file=sys.stderr)
        else:
            ref = {**st, 'met': {k: lo <= st[k] <= hi for k, (lo, hi) in TARGET.items()}, 'dist': round(dist(st), 3)}

    path = a.json_path or os.path.join(out, 'style_metrics.json')
    doc = {
        'outDir': out,
        'width': 960,
        'targets': {k: list(v) for k, v in TARGET.items()},
        'scenarios': scenarios,
        'ranking': names,
        'variants': report,
        'reference': ref,
        'skipped': skipped,
    }
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(doc, f, indent=1, ensure_ascii=False)
    mark = lambda ok: '✓' if ok else '✗'
    nv, ns = len(report), len(scenarios)
    print(f'Raport stylu: {out} · {nv} {plural(nv, "wariant", "warianty", "wariantów")} × {ns} {plural(ns, "scena", "sceny", "scen")} · zrzuty skalowane do 960 px (scripts/refstats.py)')
    print('Cele (CHARTER §4): ' + ' · '.join(target_text(k) for k in KEYS))
    print()
    print('| # | wariant | sceny | ' + ' | '.join(LABELS.get(k, k) for k in KEYS) + ' | cele | odl. | cele/scena |')
    print('|---|---|---|' + '---|' * len(KEYS) + '---|---|---|')
    for i, v in enumerate(names, 1):
        r = report[v]
        cells = ' | '.join(f"{r['mean'][k]:.1f} {mark(r['met'][k])}" for k in KEYS)
        print(f"| {i} | {v} | {len(r['scenarios'])}/{len(scenarios)} | {cells} | {r['targets_met']}/{r['targets_total']} | {r['dist']:.2f} | {r['scenario_hit_rate']:.0%} |")
    if ref:
        cells = ' | '.join(f"{ref[k]:.1f} {mark(ref['met'][k])}" for k in KEYS)
        print(f"| — | referencja ({os.path.basename(a.ref)}) | 1 | {cells} | {sum(ref['met'].values())}/{len(TARGET)} | {ref['dist']:.2f} | — |")
    print()
    print('odl. = suma odległości średnich od przedziałów celu (w szerokościach przedziału; 0 = wszystkie cele); cele/scena = średni odsetek celów spełnionych w pojedynczej scenie.')

    if a.detail:
        print()
        print('| wariant | scena | ' + ' | '.join(LABELS.get(k, k) for k in KEYS) + ' | cele |')
        print('|---|---|' + '---|' * len(KEYS) + '---|')
        for v in names:
            for s, st in report[v]['scenarios'].items():
                cells = ' | '.join(f"{st[k]:.1f} {mark(TARGET[k][0] <= st[k] <= TARGET[k][1])}" for k in KEYS)
                print(f"| {v} | {s} | {cells} | {st['targets_met']:.0%} |")

    incomplete = {v: r['missing'] for v, r in report.items() if r['missing']}
    for v, miss in incomplete.items():
        print(f'uwaga: wariant „{v}” nie ma scen: {", ".join(miss)} — jego średnie liczone z mniejszej liczby scen (porównanie nierówne).', file=sys.stderr)
    for sk in skipped:
        print(f'uwaga: pominięto {sk["path"]} ({sk["reason"]})', file=sys.stderr)

    print(f'\nzapisano {path}')
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main(sys.argv[1:]))
    except BrokenPipeError:  # e.g. `| head`: the JSON is already written
        os.dup2(os.open(os.devnull, os.O_WRONLY), sys.stdout.fileno())
        sys.exit(0)
