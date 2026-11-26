# Narzędzia zespołu (F1-4) — walidator treści, przeglądarka danych, raport stylu

> Właściciel: tools-programmer. Kod: `src/tools/`, `scripts/`, testy: `tests/tools/`.
> Narzędzia wewnętrzne — gracz ich nie widzi, więc nie podlegają turniejowi wariantów.

## 1. Cel narzędzia, problem zespołu i przepływ pracy
| Narzędzie | Problem dziś | Po wdrożeniu |
|---|---|---|
| **Walidator treści** `scripts/content-check.mjs` | literówka w id, zły tier albo zmiana nazwy złoża wychodzą dopiero jako czerwony test po angielsku albo wyjątek przy starcie | w 0,1 s lista: poziom, `plik:linia`, id, co jest nie tak, jak naprawić (z podpowiedzią „czy chodziło o…”) |
| **Przeglądarka danych** `tools.html` | „skąd się bierze X / do czego służy / od której warstwy” = grep po 9 plikach | wyszukiwarka + filtry; dla elementu: źródła, użycia, biomy, badanie, uwagi walidatora; link `#resource:x` do wklejenia |
| **Raport stylu** `scripts/style-report.py` | metryki referencji liczone ręcznie, obraz po obrazie | jedna tabela per wariant turnieju: średnie, ✓/✗ celów CHARTER §4, ranking, JSON |

Przepływ: designer zmienia `src/content/*.ts` → `node scripts/content-check.mjs` (albo podgląd na żywo w `tools.html`,
Vite przeładowuje stronę) → poprawia wskazaną linię → `npm test` / CI. Artysta: `tournament.mjs` → `style-report.py <out>`
→ tabela do `docs/variants/<element>.md`.

## 2. Architektura i integracja z potokiem
- `src/tools/contentCheck.ts` — **czysta logika** (wejście: `ContentBundle`, wyjście: `Issue[]`), bez I/O i bez importu danych;
  57 reguł w rejestrze `RULES`, grupy reguł izolowane (`try/catch` → błąd `internal`, reszta grup działa dalej).
- `src/tools/contentBundle.ts` — jedyne miejsce, które składa prawdziwe dane (`src/content/*` + `src/world/materials.ts`).
- `src/tools/contentCheckCli.ts` — opcje, kody wyjścia, numery linii (I/O wstrzykiwane → testowalne w procesie).
- `scripts/content-check.mjs` — rozruch bez zależności: wbudowane w Node 22.18+ usuwanie typów + hak rozwiązywania
  importów bez rozszerzeń; awaryjnie (`CONTENT_CHECK_LOADER=vite` lub starszy Node) moduł-runner Vite.
- `src/tools/contentIndex.ts` — czysty indeks 778 elementów i ich relacji; `src/tools/browser/*.tsx` (Preact) tylko go renderuje.
- `scripts/style-report.py` — importuje `stats/score/TARGET` z `scripts/refstats.py` (jedno źródło metryk).
- **Bezpieczeństwo**: walidator i przeglądarka tylko czytają dane; raport stylu pisze wyłącznie `style_metrics.json`
  (lub plik z `--json`) i zapisuje go **przed** drukiem tabeli; uszkodzony PNG jest pomijany z wpisem w `skipped`;
  awaria wczytania danych = czytelny komunikat i kod 2 zamiast stosu wywołań.

## 3. Funkcje kluczowe, sterowanie i parametry
| Funkcja / element UI | Rola dla twórcy | Wejście / parametry | Zachowanie i ograniczenia |
|---|---|---|---|
| `content-check` | sprawdź całą treść | `--strict` `-q` `-v` `--only=ref,boss` `--json` `--bundle f.ts` | 0 = brak błędów, 1 = błędy (lub ostrzeżenia z `--strict`), 2 = dane się nie wczytały / zła opcja |
| filtr reguł `--only` | praca wsadowa nad jedną klasą problemów | prefiks grupy lub id reguły | literówka w regule → podpowiedź |
| celowe wyjątki | brak szumu | `-v` wypisuje listę | paczki badań (+1 warstwa), trofeum finału, przedmiot `quest` |
| wyszukiwarka | znajdź element | PL/EN/id, bez ogonków („miedz”) | wiele słów = AND; `/` fokus, `↑↓` wyniki, `Esc` czyść |
| filtry | przekroje treści | grupa, biom, warstwa od–do, slot, „tylko z uwagami” | liczniki przy grupach liczą się na żywo |
| karta elementu | skąd / do czego / badanie / biom | klik albo `#rodzaj:id` | budowla: 3 poziomy obok siebie (koszt, odblokowanie, receptury) |
| plakietka walidatora | lista problemów z liniami | klik = tylko elementy z uwagami | w `npm run dev` link `plik:linia` otwiera edytor |
| `style-report.py` | ranking stylu w turnieju | `--detail` `--sort score|order|name` `--ref img` `--json` `--jobs N` | niepełny wariant = ostrzeżenie (porównanie nierówne) |
| `tools-smoke.mjs` | dymny test przeglądarki (QA) | `[url] [outDir]` | 10 kontroli + 8 zrzutów, kod 1 przy błędzie |

## 4. Szkielet implementacji / logika walidacji
```text
bundle = realBundle()                    # albo moduł z --bundle (np. szkic zmian, fixture testowy)
analysis = analyze()                     # src/content/analysis.ts — jedno źródło progresji
for group in [id, ref, world, range, unlock, tech, source, orphan, boss, consistency, prog]:
    try: group.run(bundle, analysis)     # każda reguła: push(severity, rule, file, id, message, fix)
    except e: push(error, 'internal', …) # zły typ pola nie zabija pozostałych reguł
sort(errors first, file, rule, id); line = locateLine(source(file), id)   # heurystyka definicji
exit = errors ? 1 : (strict && warnings ? 1 : 0)
```

## 5. Ryzyka, przypadki brzegowe i wdrożenie
1. **Zmiana schematu przez innego agenta** (nowe pole, inny plik) → reguły czytają dane defensywnie; brak/zły typ = błąd
   z nazwą pola; pliki źródłowe w `CONTENT_FILES` (jedna stała). Test „0 błędów na prawdziwych danych” łapie rozjazd.
2. **Dane nie wczytują się** (zmiana id złoża → `materials.ts` rzuca przy imporcie) → `explainLoadError` mówi, który
   plik i co poprawić; kod 2.
3. **Fałszywe alarmy** (zamierzone wyjątki projektu) → semantyczne wyjątki (`tag quest`, paczki badań, ostatni boss)
   widoczne przez `-v`, nigdy ciche; nowy wyjątek = decyzja systems-designera, nie wyłączanie reguły.
4. **Długi czas / blokowanie pracy** → walidacja 26–60 ms, CLI ~0,13 s, raport stylu ~0,15 s/zrzut (`--jobs N`).
**Wdrożenie**: testy na danych wzorcowych i celowo zepsutych kopiach (`tests/tools/*.test.ts`, 60 przypadków, treść
komunikatów sprawdzana); pierwszy tydzień — systems-designer i qa używają CLI przy każdej zmianie, uwagi zbieram w
notatce przekazania; po ustaleniu wyjątków włączyć `--strict` w CI.

## Instrukcja dla designerów
```bash
node scripts/content-check.mjs            # cała treść; czytaj od BŁĘDÓW, potem OSTRZEŻENIA
node scripts/content-check.mjs -q         # tylko błędy (ostrzeżenia policzone w podsumowaniu)
node scripts/content-check.mjs --only=prog,boss -v   # progresja i trofea + lista celowych wyjątków
http://localhost:5174/tools.html          # przeglądarka (serwer Vite); np. #building:smelter, #biome:fungal
python3 scripts/style-report.py <outTurnieju> [--detail] [--ref .reference/owner-style.jpg]
node scripts/tools-smoke.mjs http://localhost:5174/tools.html /tmp/underhearth-tools
```
Komunikat: `POZIOM plik:linia id [reguła]`, pod nim „co jest nie tak” i „Jak naprawić”. Najczęstsze reguły:
`ref.*` (literówka — przyjmij podpowiedź), `unlock.missing` (dopisz do `unlocks` węzła), `range.*` (liczba poza zakresem),
`prog.*` (zadeklarowany `tier` ≠ analiza progresji), `boss.trophyTech` (trofeum bossa nie otwiera badania),
`world.*` (złoże bez materiału świata — dopisz `D(M.…)` w `src/world/materials.ts`). Pełna lista: `RULES` w `src/tools/contentCheck.ts`.
