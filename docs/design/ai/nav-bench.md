# Benchmark nawigacji — pełne wyniki (F2-4)

Wygenerowane: `NAV_BENCH=1 NAV_BENCH_OUT=docs/design/ai/nav-bench.md npx vitest run tests/sim/nav.bench.test.ts --silent=false`
(Node 22, wspólny kontener z innymi agentami — szum pomiaru p95/maks. ±30–50%, kolejność median stabilna w 4 przebiegach).
Omówienie i rekomendacja: [NAVIGATION.md](NAVIGATION.md) §2.3.

### arena 64×46
węzły (kafle stawialne): 187, linki: 0, budowa NavGrid: 5.89 ms, pamięć NavGrid: 32 KB (+ wspólne bufory wyszukiwania 97 KB)

| Algorytm | budowa [ms] | pamięć własna | lokalne: mediana / p95 [ms] | globalne: mediana / p95 [ms] | brak ścieżki: mediana / p95 [ms] | rozwinięte węzły (globalne) | koszt / optimum (śr. / maks.) | tick: 200 lok. + 20 glob. [ms] |
|---|---|---|---|---|---|---|---|---|
| A* | 0.035 | 0 KB | 0.006 / 0.015 | 0.006 / 0.019 | 0.007 / 0.025 (146) | 38 | 1.0000 / 1.000 | 2.10 |
| A* + skoki (JPS+) | 0.791 | 12 KB | 0.009 / 0.022 | 0.004 / 0.009 | 0.004 / 0.012 (146) | 14 | 1.0000 / 1.000 | 1.26 |
| HPA* 16×16 | 1.40 | 45 KB | 0.017 / 0.028 | 0.015 / 0.023 | 0.013 / 0.027 (146) | 45 | 1.0000 / 1.000 | 2.55 |
| HPA* 32×32 | 0.380 | 89 KB | 0.016 / 0.024 | 0.017 / 0.024 | 0.016 / 0.021 (146) | 79 | 1.0000 / 1.000 | 3.53 |
| A* ważony w=1,5 | 0.080 | 0 KB | 0.007 / 0.028 | 0.005 / 0.014 | 0.007 / 0.021 (146) | 33 | 1.0000 / 1.000 | 1.96 |

zapytań: lokalnych 300 (cel ≤ 24 kafle), globalnych 300 (w tym bez ścieżki: 146)

| Algorytm | aktualizacja po zmianie kafla: mediana / p95 [ms] |
|---|---|
| A* | 0.015 / 0.036 |
| A*+skoki | 0.019 / 0.041 |
| HPA* 16×16 | 0.022 / 0.085 |
| HPA* 32×32 | 0.035 / 0.103 |

(150 zmian: kopanie przy pustkach i zasypywanie; A* = sam NavGrid: mediana 0.015 ms)

### kopalnia 224×720 (seed 1)
węzły (kafle stawialne): 6579, linki: 668, budowa NavGrid: 48.4 ms, pamięć NavGrid: 1641 KB (+ wspólne bufory wyszukiwania 2726 KB)

| Algorytm | budowa [ms] | pamięć własna | lokalne: mediana / p95 [ms] | globalne: mediana / p95 [ms] | brak ścieżki: mediana / p95 [ms] | rozwinięte węzły (globalne) | koszt / optimum (śr. / maks.) | tick: 200 lok. + 20 glob. [ms] |
|---|---|---|---|---|---|---|---|---|
| A* | 0.010 | 0 KB | 0.010 / 0.061 | 0.402 / 0.995 | 1.01 / 1.07 (71) | 2414 | 1.0000 / 1.000 | 21.5 |
| A* + skoki (JPS+) | 5.62 | 634 KB | 0.005 / 0.026 | 0.155 / 0.361 | 0.360 / 0.400 (71) | 557 | 1.0000 / 1.000 | 8.41 |
| HPA* 16×16 | 23.7 | 878 KB | 0.014 / 0.035 | 0.148 / 0.327 | 0.300 / 0.468 (71) | 423 | 1.0000 / 1.000 | 8.75 |
| HPA* 32×32 | 7.61 | 1618 KB | 0.026 / 0.049 | 0.115 / 0.229 | 0.216 / 0.256 (71) | 334 | 1.0000 / 1.000 | 9.56 |
| A* ważony w=1,5 | 0.029 | 0 KB | 0.009 / 0.063 | 0.524 / 1.56 | 1.04 / 1.91 (71) | 2113 | 1.0021 / 1.084 | 34.8 |

zapytań: lokalnych 300 (cel ≤ 24 kafle), globalnych 300 (w tym bez ścieżki: 71)

| Algorytm | aktualizacja po zmianie kafla: mediana / p95 [ms] |
|---|---|
| A* | 0.024 / 0.061 |
| A*+skoki | 0.074 / 0.164 |
| HPA* 16×16 | 0.058 / 0.160 |
| HPA* 32×32 | 0.074 / 0.288 |

(150 zmian: kopanie przy pustkach i zasypywanie; A* = sam NavGrid: mediana 0.024 ms)

### kopalnia 224×720 (seed 2) + gród
węzły (kafle stawialne): 10402, linki: 534, budowa NavGrid: 36.4 ms, pamięć NavGrid: 1641 KB (+ wspólne bufory wyszukiwania 2726 KB)

| Algorytm | budowa [ms] | pamięć własna | lokalne: mediana / p95 [ms] | globalne: mediana / p95 [ms] | brak ścieżki: mediana / p95 [ms] | rozwinięte węzły (globalne) | koszt / optimum (śr. / maks.) | tick: 200 lok. + 20 glob. [ms] |
|---|---|---|---|---|---|---|---|---|
| A* | 0.010 | 0 KB | 0.027 / 0.343 | 0.437 / 1.18 | 0.447 / 1.42 (145) | 2347 | 1.0000 / 1.000 | 26.1 |
| A* + skoki (JPS+) | 5.82 | 634 KB | 0.024 / 0.280 | 0.429 / 1.21 | 0.252 / 1.92 (145) | 1327 | 1.0000 / 1.000 | 36.4 |
| HPA* 16×16 | 28.4 | 1246 KB | 0.077 / 0.286 | 0.211 / 0.491 | 0.175 / 0.615 (145) | 495 | 1.0000 / 1.000 | 16.9 |
| HPA* 32×32 | 20.2 | 2160 KB | 0.108 / 0.193 | 0.208 / 0.376 | 0.184 / 0.412 (145) | 522 | 1.0000 / 1.000 | 25.5 |
| A* ważony w=1,5 | 0.017 | 0 KB | 0.018 / 0.275 | 0.360 / 1.18 | 0.462 / 1.47 (145) | 1883 | 1.0004 / 1.026 | 22.2 |

zapytań: lokalnych 300 (cel ≤ 24 kafle), globalnych 300 (w tym bez ścieżki: 145)

| Algorytm | aktualizacja po zmianie kafla: mediana / p95 [ms] |
|---|---|
| A* | 0.018 / 0.036 |
| A*+skoki | 0.049 / 0.090 |
| HPA* 16×16 | 0.037 / 0.357 |
| HPA* 32×32 | 0.062 / 1.40 |

(150 zmian: kopanie przy pustkach i zasypywanie; A* = sam NavGrid: mediana 0.018 ms)

### 200 krasnoludów w grodzie (kopalnia seed 2 + gród), 600 ticków × 50 ms, 1 wykop na tick

| Algorytm | kolejka planowania | tick: mediana / p95 / maks. [ms] | pierwszy tick [ms] | planów / tick (śr.) | czekanie w kolejce: śr. / maks. [ticki] | przeplanowań po zmianach | dotarło do celu |
|---|---|---|---|---|---|---|---|
| A* | brak (od razu) | 0.131 / 2.77 / 11.8 | 28.4 | 0.47 | — | 478 | 193 |
| A* | 3000 rozwinięć/tick | 0.358 / 1.63 / 4.12 | 1.26 | 0.44 | 3.5 / 30 | 390 | 185 |
| A* + skoki (JPS+) | brak (od razu) | 0.197 / 2.51 / 14.5 | 42.2 | 0.48 | — | 481 | 196 |
| A* + skoki (JPS+) | 3000 rozwinięć/tick | 0.999 / 1.59 / 2.35 | 1.60 | 0.45 | 2.7 / 19 | 511 | 184 |
| HPA* 16×16 | brak (od razu) | 0.317 / 1.53 / 5.25 | 26.0 | 0.50 | — | 457 | 196 |
| HPA* 16×16 | 3000 rozwinięć/tick | 0.294 / 1.68 / 2.42 | 1.83 | 0.43 | 1.4 / 15 | 435 | 179 |
