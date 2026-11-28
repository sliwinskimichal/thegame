#!/usr/bin/env python3
"""Dwarf tournament evaluation (team lead, F3-1): <run>/metrics.json from scripts/dwarf-tournament.mjs ->
markdown table of metrics + metric sub-scores (0-10) used in the rubric of docs/variants/04-dwarf.md.

Usage: python3 scripts/dwarf-evaltable.py <run_dir> [--json out.json] > table.md
Sub-scores: readability = sil. accuracy 75 px (30%) and 24 px (20%), min pair distance 75/24 px (15/10%),
share of dwarves with |dL*| >= 15 (15%), accent budget (10%); performance = frame-time ratio 0->200 dwarves
against the best variant (50%), draw calls for 200 (25%), LOD1/LOD2 triangle budgets met (25%).
"""
import os
import json
import statistics as st
import sys

run = sys.argv[1]
m = json.load(open(f'{run}/metrics.json'))
names = json.load(open(f'{run}/names.json')) if os.path.exists(f'{run}/names.json') else {}
rows = []


def shot(v, sid):
    return v.get('shots', {}).get(sid, {}) or {}


for vid, v in m['variants'].items():
    if not isinstance(v, dict) or 'cost' not in v:
        continue
    c = v['cost']
    s75 = shot(v, 'sil75').get('silhouette', {})
    s24 = shot(v, 'sil24').get('silhouette', {})
    con = []
    for sid in ('izba', 'grod', 'swiatlo'):
        con += [(sid, x) for x in shot(v, sid).get('contrast', [])]
    lit = [abs(x['dL']) for _, x in con if x.get('lit')]
    dark = [abs(x['dL']) for _, x in con if not x.get('lit')]
    ok = sum(1 for _, x in con if abs(x['dL']) >= 15) / max(1, len(con))
    acc = []
    for sid in ('izba', 'grod', 'swiatlo'):
        acc += [x['share'] for x in shot(v, sid).get('accent', [])]
    stab = shot(v, 'seq30').get('stability', [])
    a = v.get('anim', {})
    r = {
        'id': vid,
        'name': names.get(vid, vid),
        'tri': c.get('trianglesPerLod'),
        'calls200': c.get('drawCalls200'),
        'ms0': c.get('frameMs0'),
        'ms200': c.get('frameMs200'),
        'anim200': c.get('animMs200'),
        'h': v.get('heights', {}).get('median'),
        'sil75min': s75.get('minPair'),
        'sil75acc': s75.get('accuracy'),
        'sil24min': s24.get('minPair'),
        'sil24acc': s24.get('accuracy'),
        'dLlit': st.median(lit) if lit else None,
        'dLdark': st.median(dark) if dark else None,
        'contrastOk': ok,
        'accentMax': max(acc) if acc else None,
        'accentMed': st.median(acc) if acc else None,
        'stabMin': min((x['minIoU'] for x in stab), default=None),
        'slip': max(a.get('slipWalk', 0) or 0, a.get('slipNav', 0) or 0),
        'seam': a.get('seamJump'),
    }
    rows.append(r)

# metric sub-scores (0..10): readability from silhouettes + contrast + accent; performance from cost
def norm(x, lo, hi):
    if x is None:
        return 0.0
    return max(0.0, min(1.0, (x - lo) / (hi - lo)))


ms_ratio = [r['ms200'] / r['ms0'] for r in rows if r['ms0']]
best_ratio = min(ms_ratio) if ms_ratio else 1
for r in rows:
    read = (0.3 * norm(r['sil75acc'], 0.5, 1.0) + 0.2 * norm(r['sil24acc'], 0.4, 1.0) + 0.15 * norm(r['sil75min'], 0.15, 0.45)
            + 0.1 * norm(r['sil24min'], 0.15, 0.45) + 0.15 * r['contrastOk'] + 0.1 * (1 - norm(r['accentMax'] or 0, 0.1, 0.5)))
    r['readM'] = round(10 * read, 2)
    ratio = r['ms200'] / r['ms0'] if r['ms0'] else 2
    tri_ok = r['tri'][1] <= 400 and r['tri'][2] <= 60 if r['tri'] else False
    perf = 0.5 * (best_ratio / ratio) + 0.25 * norm(-(r['calls200'] or 99), -40, -8) + 0.25 * (1 if tri_ok else 0)
    r['perfM'] = round(10 * perf, 2)

f = lambda x, d=2: '—' if x is None else (f'{x:.{d}f}'.replace('.', ',') if isinstance(x, float) else str(x))
print('| wariant | tr. LOD0/1/2 | sylw. 75 px: min 1−IoU / trafność | sylw. 24 px: min / trafność | |ΔL\\*| światło / mrok | ΔL\\*≥15 | akcent C\\*>30 maks. | stab. min IoU | klatka 0→200 [ms] | wywołania 200 | anim. 200 [ms] | wzrost | czytelność (metr.) | wydajność (metr.) |')
print('|' + '---|' * 15)
for r in rows:
    t = r['tri'] or [0, 0, 0]
    print(f"| {r['id']} | {t[0]:.0f}/{t[1]:.0f}/{t[2]:.0f} | {f(r['sil75min'])} / {f(r['sil75acc'])} | {f(r['sil24min'])} / {f(r['sil24acc'])} | {f(r['dLlit'],1)} / {f(r['dLdark'],1)} | {f(r['contrastOk'])} | {f(r['accentMax'])} | {f(r['stabMin'],3)} | {f(r['ms0'],0)}→{f(r['ms200'],0)} | {r['calls200']} | {f(r['anim200'],1)} | {f(r['h'])} | {f(r['readM'])} | {f(r['perfM'])} |")
if '--json' in sys.argv:
    json.dump(rows, open(sys.argv[sys.argv.index('--json') + 1], 'w'), indent=1)
