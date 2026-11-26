# Plan testów M1–M3 — Underhearth

> qa-tester · v1 · 2026-11-26 · stan wyjściowy: `AUDIT-2026-11-26.md`, błędy: `bugs/BUG-001…010.md`.
> Statusy przypadków: **A** = zautomatyzowany i przechodzi · **F** = zautomatyzowany jako `it.fails` (znany BUG) ·
> **N** = do napisania, funkcja istnieje · **Z** = zablokowany, funkcji jeszcze nie ma (luka planu).

## 1. Zakres Testów, Cel i Kryteria Ryzyka

**Co testujemy.**
- **M1 — styl ilustrowany 2.5D** (turniej nr 3): laboratorium (`lab.html`, harness `tests/qa/harness/ill-lab.html`
  dla niezarejestrowanych wariantów), `src/render/ink.ts`, `src/lab/styles/illustrated.ts`, heightfield z `aEdge`,
  metryki CHARTER §4 (cele per kontekst z wizji v1), 3 sceny tonu, ślepy test oryginalności, wydajność.
- **M2 — generator świata 2.0** (B1, `05-level-systems.md`): 224 × 720, 9 biomów, Gardziel i pieczęcie, gęstości ‰,
  żyły-matki (R1), łączność, mgła wojny, determinizm, czas generowania. Dziś testowalne tylko kontrakty na arenie
  i galerii (generator nie istnieje).
- **M3 — rdzeń symulacji**: kopanie, zawały i podpory, nawigacja z grawitacją, zadania i priorytety, magazyn,
  transport, zapis/odczyt, determinizm, wydajność (200 krasnoludów < 4 ms/tick). Dziś istnieje tylko model danych
  (`World.dig/fill/reveal`, pierścień zmian, `LightField`, `EventBus`, `Rng`) — przypadki M3 są w większości **Z**.

**Najbardziej narażone obszary i dlaczego są krytyczne.**
| Obszar | Dlaczego | Najgorszy skutek |
|---|---|---|
| Integralność turnieju (M1) | warianty zmieniają się w trakcie przebiegu, cichy fallback id (BUG-001), miara czasu bez GPU (BUG-002) | zły kierunek artystyczny całej gry |
| Mutacje kafla (M3) | jedna ścieżka zmian ma unieważniać chunki, światło, mgłę, nawigację, dekoracje (E1); `fill()` już dziś psuje stan (BUG-003) | dziury w geometrii, widmowe płyny, duplikacja wody/łupu, soft-lock nawigacji |
| Determinizm i zapis (M3) | gra 40/120 h, zapis w trakcie akcji, rekalibracja balansu botem | utrata postępu, desynchronizacja powtórek, nieodtwarzalne błędy |
| Generator (M2) | łączność i dostępność złóż decydują o przechodniości 9 biomów | twardy soft-lock (zasób-klucz niedostępny), mgła ujawniająca rudy (BUG-005) |
| Wydajność | SwiftShader zaniża i zaszumia pomiary; budżety E4/E5/M3 | spadki klatek przy 200 krasnoludach i pełnym świecie |

**Kryteria ryzyka (waga):** P1 krytyczny — crash, utrata zapisu, twardy soft-lock, duplikacja zasobów, zła decyzja
kamienia milowego; P2 wysoki — błąd widoczny w każdej sesji, zafałszowany pomiar bramki; P3 średni — błąd
w warunkach brzegowych lub narzędziu projektowym; P4 niski — kosmetyka, rozbieżność dokumentacji bez skutku.

## 2. Scenariusze Testowe i Przypadki Brzegowe (Test Cases & Edge Cases)

### M1 — styl ilustrowany
| Id | Scenariusz i warunki | Oczekiwane (mierzalne) | Narzędzie | Status |
|---|---|---|---|---|
| M1-01 | Ton per kontekst: gród oświetlony (arena `tunnel_night`, `meadow`, `dusk`), dzika głębia (`cave`, `fungal`, `lava`), 960 px | gród: L* 36–40, czerń (L* < 15) 15–22%, chroma 13–18, krawędzie ≥ 15%, kreska ≥ 3%, chroma > 30 ≤ 8% pikseli; głębia: L* ≥ 26, czerń ≤ 30%, kreska ≥ 3% | `refstats.py` na zrzutach `lab-audit.mjs` | N |
| M1-02 | Metryki tonu na galerii | **nie używać** do celów tonu — ramki bedrocku dają 84–95% czerni nocą (audyt) | — | A (ustalenie) |
| M1-03 | Kreska stała w pikselach: `overview` (d 92), `cave` (24), `tunnel_night` (16); wariant i07 jako kontrola negatywna | szerokość konturu skała/pustka ±0,5 px między dystansami (i07 ma rosnąć — test musi to wykryć) | profil przekroju konturu na zrzutach | N |
| M1-04 | Kreska nie drży w spoczynku (wizja §3), `boil = 0` | ≤ 1% pikseli kreski zmienia się w 1 s poza strefami animowanych płynów (lawa ≤ 4%) | `STABILITY=1 lab-audit.mjs` | A (12 wariantów: poza lawą ≤ 0,9%, lawa ≤ 3,9%; i07 — powtórzony) |
| M1-05 | „Mrok zabiera kolor, nie kształt”: ten sam kadr t = 0,42 vs t = 0 | odsetek pikseli krawędzi nocą ≥ 70% dziennego; chroma nocą spada | para zrzutów, `refstats.py` | N |
| M1-06 | Kreskowanie = nieznane: `scenario=fog` | gęstość krawędzi w nieodkrytym > w odkrytym; żadna ruda ani kryształ nie widoczne w nieodkrytym (kontrakt BUG-005) | zrzut + `probes()` | N / F (BUG-005) |
| M1-07 | Rudy w kresce: galeria noc i `&flood=1`, deuteranopia | `galmetrics.py`: ore_host ≥ 8, ore_ore ≥ 8, *_d ≥ 6 w każdym biomie; formy rozróżnialne w skali szarości | `galmetrics.py`, BUG-007 | N |
| M1-08 | 3 sceny tonu: izba wieczorem, przodek w mroku, zawał | wariant wygrywa tylko, gdy przechodzi wszystkie 3 (CHARTER §4) | scenariusze laboratorium | **Z** (brak scen — D1, F2-12 po turnieju) |
| M1-09 | Ślepy test oryginalności | 20 kadrów (10 wariantu + 10 wycinków referencji, ta sama skala, bez UI, losowa kolejność z zapisanym seedem), 3 oceniających; każda pomyłka = wariant odpada; protokół w `docs/variants/03-…` | ręczny, arkusz | N |
| M1-10 | Integralność przebiegu turnieju | każdy kadr podpisany id, który faktycznie wyrenderowano; 0 błędów konsoli; te same parametry `mat`, seed, scenariusze; `src/render/**` zamrożone w trakcie | `lab-audit.mjs` (sonda `__no_such_style__`) | F (BUG-001) |
| M1-11 | Wydajność: `overview` po rozgrzaniu (pominięte 30 klatek), realny GPU + SwiftShader jako regresja względna | ≥ 60 FPS lub udokumentowany budżet (ms/klatkę na przejście: teren, rekwizyty, `DepthInkPass`, bloom); rozrzut powtórzeń ≤ 20% | nowa miara (BUG-002) | **Z** (BUG-002) |
| M1-12 | Odporność renderu: zmiana rozmiaru okna, DPR 1/2, utrata kontekstu (`WEBGL_lose_context`), `t` = 0 / 0,999 / NaN w URL | brak NaN/czerni, `resize()` wywołane (dziś laboratorium nie słucha `resize`), odzyskanie kontekstu albo komunikat | Playwright | N |
| M1-13 | Poziomy zoomu Izba ~12 / Gród ~35 / Okolica ~110 | krasnolud ≈ 220 / 75 / 24 px przy 1080p; kreskowanie bez „przeskoków” oktaw przy płynnym zoomie (seria 20 klatek) | zrzuty, różnica klatek | N |
| M1-14 | Biblioteka zewnętrzna jako zawodnik | licencja z listy właściciela (D2: `postprocessing` = Zlib), rozmiar paczki w ocenie, identyczne scenariusze | `npm ls`, build | N |
| M1-15 | Strażnik palety po kalibracji pod kreskę (F2-13) | regresja na renderach zamiast samej estymacji `meanColor` | BUG-007 | F/N |

### M2 — generator świata 2.0
| Id | Scenariusz i warunki | Oczekiwane | Narzędzie | Status |
|---|---|---|---|---|
| M2-01 | Determinizm: seed 1, 2, 777, 2³²−1, ten sam seed 2× | identyczny hash wszystkich tablic SoA i rekwizytów dla tego samego seeda; różny dla różnych | Vitest | A dla areny (40 seedów), Z dla generatora |
| M2-02 | Seed z wejścia gracza: `"abc"`, `""`, `1.9`, `-1`, `NaN` | jawna normalizacja lub odrzucenie; dziś `Rng`: NaN → 0, 1.9 → 1, −1 → 2³²−1 (kolizje) | Vitest | N |
| M2-03 | Rozmiar i czas: 224 × 720 | zgodny z `CONFIG`/specyfikacją (BUG-006); generowanie < 400 ms (E3, budżet dla tego rozmiaru), pole światła < 50 ms (A: 13,9 ms) | Vitest | F (BUG-006) / A |
| M2-04 | Granice: kolumny x = 0 i 223, wiersz 719, krater, Gardziel x ≈ 150 | dno z bedrocku bez dziur; ściany Gardzieli z materiału kilofa 9 (D8 — materiał nie istnieje); okna Gardzieli na każdy biom | Vitest + mapa | Z |
| M2-05 | Niepełny ostatni chunk (720 % 32 = 16) | heightfield i brudne flagi bez szwów i dziur | Vitest (wzór: `render-data.test.ts`) | N |
| M2-06 | Złoża i gęstości (05-level §2.2) na 100 seedach | 100% złóż biblii w swoich biomach; gęstość ±20% celu ‰; kamień 70–85% kafli biomu; żyły-matki: liczba na świat, R1 ≤ 12 kafli od rdzenia zagrożenia | Monte Carlo | Z |
| M2-07 | Łączność: hub → Gardziel w każdym biomie, pieczęcie y ≈ 150/300/470/640 | ścieżka istnieje przy narzędziach dostępnych w danej warstwie; żaden zasób-klucz w zamkniętej kieszeni bez dojścia | BFS z kosztem kopania (tier kilofa) | Z |
| M2-08 | Start (E3) | płaski teren pod wóz, brak jaskiń 25 kafli pod obozem, naturalne wejście do jaskini | Vitest | Z |
| M2-09 | Płyny po generacji | żaden płyn w litym kaflu; brak „pływających” płynów (pod płynem lity kafel albo płyn); lawa–woda tylko z obsydianem | Vitest | A (arena), Z |
| M2-10 | Mgła wojny | każdy nieodkryty lity kafel ma `bg ≠ 0`; rekwizyty-emitery w nieodkrytym nie świecą | Vitest | A (arena, galeria) / F (BUG-005) |
| M2-11 | Puste tabele losowania (Serce bez złóż) | generator nie wywołuje `rng.weighted([])` (rzuca TypeError) | Vitest | A (kontrakt) |
| M2-12 | Krążki Pamięci (R3) | 48 sztuk, żaden ≤ 20 kafli od huba biomu | Vitest | Z |
| M2-13 | Turniej 10 seedów | metryki: dostępność złóż, łączność, różnorodność; mapa `worldmap` dla 3 seedów (narzędzie nie istnieje — QUALITY E3) | Monte Carlo, mapa PNG | Z |

### M3 — rdzeń symulacji
| Id | Scenariusz i warunki | Oczekiwane | Status |
|---|---|---|---|
| M3-01 | Kopanie: twardość/`workSpeed`, brama kilofa (tier 9 — `World.dig` dziś jej nie ma), łup = `amount`, kafle brzegowe | czas = hardness / workSpeed ±1 tick; tier 9 nie do wykopania; odkrycie 3×3 przycięte do świata (A) | A (model) / Z |
| M3-02 | Przerwanie kopania w połowie: zmiana rozkazu, zawał, ucieczka, zapis w trakcie | postęp zgodny ze specyfikacją; brak podwójnego łupu przy dwóch krasnoludach na jednym kaflu (rezerwacja) | Z |
| M3-03 | Zawały: sala szersza niż 6 kafli bez podpór (Progi), usunięcie ostatniej podpory, zawał na krasnoluda i magazyn, łańcuch zawałów | zawał deterministyczny; brak pętli; rekwizyty zakotwiczone usunięte (A dla `dig`) | Z |
| M3-04 | Budowa i rozbiórka (`fill`): na wodzie, w niebie, materiał nielity, na kaflu z rekwizytem | spójny stan kafla (BUG-003); rekwizyt w bloku usunięty lub zablokowany | F (BUG-003) |
| M3-05 | Płyny: przebicie szczeliny (200 kafli w 30 s), zamurowanie zalanego tunelu, woda + lawa, woda spadająca szybem | brak widmowej wody; światło nieba pod spadającą wodą tłumione (dziś pod płynem wraca 1,0) | Z |
| M3-06 | Nawigacja z grawitacją: spadek 3 (ok) / 4 kafle (`maxSafeDrop`), drabina, schody, platforma, winda, tory; podłoga wykopana spod krasnoluda; krasnolud uwięziony | brak ścieżek przez lity kafel; repath po `changesSince`; uwięzienie → zadanie ratunkowe, nie soft-lock | Z (F2-4) |
| M3-07 | Zadania i priorytety: zadanie nieosiągalne, anulowane w trakcie, zmiana priorytetu w trakcie, 200 zadań na 1 kafel | brak głodzenia, brak blokady kolejki, każde zadanie wykonane najwyżej raz | Z |
| M3-08 | Magazyn i transport: pojemność 80/240/700, przepełnienie, rozbiórka pełnego magazynu, przerwany transport, stosy 50/20/1 | brak duplikacji i utraty bez komunikatu | Z |
| M3-09 | Zapis/odczyt: round-trip (hash świata, `Rng.getState`, kolejki, krasnoludy); zapis w trakcie kopania/transportu/zawału; uszkodzony i stary plik | identyczny stan; migracja wersji; komunikat zamiast crasha | Z (E1, E20) |
| M3-10 | Determinizm: seed + log poleceń → 10 000 ticków 2× | identyczny hash; niezależność od FPS (tick 20/s); brak `Math.random` w `src/sim`, `src/world` (grep w teście) | Z |
| M3-11 | Wydajność: 200 krasnoludów, świat 224 × 720, 10 000 rekwizytów | tick p95 < 4 ms (Node i przeglądarka); przebudowa chunka < 4 ms (E5); światło lokalne < 5 ms (E4 — brak aktualizacji przyrostowej); `removePropsAnchoredTo` alokuje i skanuje wszystkie rekwizyty przy każdym kopaniu — zmierzyć | Z / N |
| M3-12 | Zdarzenia: każde kopanie = 1 zdarzenie; odbiorca rzuca; subskrypcja w obsłudze | pozostali odbiorcy dostają zdarzenie (BUG-009); pierścień zmian: przepełnienie → pełna przebudowa (A) | F (BUG-009) / A |
| M3-13 | Długa sesja: bot 10 h gry przyspieszonej | stała pamięć (heap), brak narastania czasu ticka | Z |

**Przypadki brzegowe przekrojowe (już zautomatyzowane, `tests/qa/`, 37 ✓ + 13 `it.fails` + 4 todo):** granice świata
i odkrywanie (`world-state`), pole światła na krawędziach, nasycenie 8-bit, budżet E4 (`lightfield`), szwy chunków
i NaN w siatce (`render-data`), model balansu przy NaN/0/ujemnych (`balance-edges`), zgodność specyfikacji, arena 40 seedów
i galeria (`spec-consistency`), EventBus, szum, puste tabele, siła strażnika palety (`core-and-palette`).

## 3. Macierz Priorytetów i Ryzyka Błędów

| Typ problemu / Obszar | Priorytet / Waga | Wpływ na gracza / grę | Na co zwrócić szczególną uwagę |
|---|---|---|---|
| Utrata zapisu, crash przy wczytaniu | P1 | utrata wielu godzin gry | zapis w trakcie akcji, stare wersje formatu, limit pamięci przeglądarki |
| Soft-lock progresji (zasób-klucz niedostępny, krasnolud uwięziony, pieczęć bez warunku) | P1 | gra nie do ukończenia | łączność generatora na ≥ 100 seedach, ratunek uwięzionych, twarde bramy z 05-level §4.2 |
| Duplikacja / utrata zasobów (łup, transport, płyny) | P1 | exploit, zepsuta ekonomia 40 h | rezerwacje zadań, przerwanie w połowie, `fill/dig` na płynach (BUG-003) |
| Desynchronizacja determinizmu | P1 (M3) | nieodtwarzalne błędy, zły balans z bota | `Math.random`, kolejność Map/Set, zależność od FPS |
| Zafałszowany pomiar bramki (turniej, czas klatki, strażnik palety) | P2 | zła decyzja kierunku lub budżetu | BUG-001, BUG-002, BUG-007; zamrożenie kodu w trakcie przebiegu |
| Mgła wojny ujawnia zawartość | P2–P3 | spoiler, kopanie „na pewniaka” | `bg = 0`, emitery w nieodkrytym (BUG-005) |
| Wizualne: dziury, szwy, migotanie, NaN w shaderze | P2 | zepsuty odbiór „wow” | szwy chunków (A), z-fighting kreski i tylnych ścian, utrata kontekstu WebGL |
| Ton i czytelność (czerń, nasycenie, kreska) | P2 (M1) | groza bez czytelności albo „cukierek” | cele per kontekst, deuteranopia, 3 sceny tonu |
| Wydajność (tick, chunk, światło, post-proces) | P2 | spadki klatek, brak 60 FPS | pomiar po rozgrzaniu, realny GPU, 200 krasnoludów |
| Walidacja narzędzi projektowych (balans, walidator) | P3 | błędne liczby w dokumentach decyzji | NaN/0/ujemne (BUG-004), jedno źródło prawdy (BUG-010) |
| Rozbieżność dokumentacji | P3–P4 | zespół pracuje na złych założeniach | `AUDIT` §3 (D1–D13) |

## 4. Szablon Raportu Błędu i Przykładowy Zapis

**Szablon** (`docs/qa/bugs/BUG-NNN.md`):
```
# BUG-NNN — <skutek w jednym zdaniu: co się dzieje, gdzie, kiedy>
| Pole | Wartość |
| Typ | błąd / rozbieżność / UX |
| Priorytet / waga | P1–P4 + uzasadnienie |
| Obszar · KM | pliki / system · kamień milowy |
| Właściciel poprawki | rola |
| Środowisko | commit, Node/Vitest, przeglądarka + GPU (SwiftShader/realny), rozdzielczość, URL i parametry, seed |
| Częstość | 100% / x na N prób (warunki) |
| Test / dowód | plik testu (`it.fails('BUG-NNN…')`), zrzuty, audit.json |
## Warunki początkowe   (świat, seed, stan krasnoluda/ekwipunku/zadań, scenariusz)
## Kroki odtworzenia    (numerowane, kopiowalne)
## Oczekiwane           (ze specyfikacji — podaj źródło)
## Faktyczne            (liczby, stan tablic, zrzut)
## Wpływ                (gracz / zespół; soft-lock, utrata, crash, exploit, wizualny)
## Weryfikacja poprawki (który test zmienia status, jakie pomiary)
## Regresja             (obszary sąsiednie do ponownego sprawdzenia)
```
**Przykład** (pełny zapis: `bugs/BUG-003.md`): *„`World.fill()` zostawia niespójny stan kafla”* — Typ: błąd · P2 dla M3 ·
`src/world/world.ts` · właściciel gameplay-programmer · commit 2b63f08, Node 22.23.5 · 100% · `tests/qa/world-state.test.ts`.
Warunki: `buildArena()` (seed 777). Kroki: kafel wody → `fill(x, y, STONE_BRICK)` → `dig(x, y)`. Oczekiwane: `fluid = 0`
i `fluidKind = NONE`. Faktyczne: `fluidKind = WATER` → tekstura kafli i `probes()` widzą wodę w suchym tunelu; kafel nieba
po `fill + dig` staje się tunelem z tylną ścianą (`cav = DUG`). Wpływ: „dziura w niebie” po rozbiórce muru, ryzyko
odrodzenia wody przez symulację płynów. Weryfikacja: 3 × `it.fails('BUG-003…')` przechodzą → zdjąć `.fails`.
Regresja: `dig()`, `WorldTex.sync`, geometria płynów, pole światła, arena.

## 5. Diagnostyka Odtwarzania, Regresja i Wskazówki dla Zespołu

**Dane do zebrania przy błędzie rzadkim lub niestabilnym:** commit (`git rev-parse --short HEAD`) i informacja, czy drzewo
było brudne (agenci edytują równolegle — audyt jest migawką, np. i03: czerń 34% → 10% między przebiegami); pełny URL
laboratorium z parametrami (`style`, `scenario`, `world`, `flood`, `mat`, `exp/amb/glint/...`, `torch`) i **id faktycznie
wyrenderowanego stylu** (`__lab.style`); seed i `Rng.getState()`; numer ticku i log poleceń (M3); `audit.json`
z `lab-audit.mjs` (błędy konsoli, ostrzeżenia WebGL, czerń, średnia L*, `frameMs` i odstępy rAF); para zrzutów 1 s
odstępu (`STABILITY=1`); rozdzielczość, DPR, GPU (SwiftShader vs realny). Przy wydajności: min/p50/p95 po rozgrzaniu,
nie pierwsza klatka (kompilacja shaderów 58–1202 ms).

**Procedura dla niestabilnych:** powtórz 10× ze stałym seedem i zamrożonym czasem (harness: `?freeze=<s>`); jeśli zależy
od czasu — zawęź do animowanych źródeł (lawa, woda, wiatr, niebo); jeśli od kolejności — porównaj hash stanu po każdym
ticku z dwóch przebiegów i znajdź pierwszy rozjazd; `git bisect` na zatwierdzonych commitach (nie na drzewie roboczym).

**Regresja — co sprawdzić po poprawce:**
| Poprawiany obszar | Sprawdź także |
|---|---|
| `World` (dig/fill/reveal) | pierścień zmian i jego przepełnienie, kotwice rekwizytów, `WorldTex`, płyny, światło, arena i galeria, zapis/odczyt |
| Pole światła | budżet E4 (224 × 720 < 50 ms), krawędzie świata, nieodkryte emitery (15%), lawa w nasyceniu, metryki tonu M1-01 |
| Heightfield / `aEdge` / ink | szwy chunków (test), FACE-flagi materiałów ≥ 128 (dekodowanie `floor(m/256 + 0,5)` psuje flagi dla id ≥ 128), kreska stała w px |
| Paleta / materiały | `tests/palette.test.ts` (nie luzować progów), galeria noc + flood, deuteranopia, `content:check` |
| Laboratorium / narzędzia turnieju | wszystkie style z rejestru + harness, sonda nieznanego id, `metrics.py`/`galmetrics.py`/`refstats.py` na tym samym przebiegu |
| Model balansu | `tests/balance.test.ts` (40,4 h), Monte Carlo z tym samym seedem, `BALANCE_REPORT=1` |

**Rytm QA:** każda zmiana kodu — `npx vitest run`, `npm run build`, `npm run content:check` (kod 0); każdy przebieg
turnieju — `node tests/qa/lab-audit.mjs` (0 błędów konsoli, 0 fallbacków; dla wariantów spoza rejestru
`PAGE=tests/qa/harness/ill-lab.html`); kamień milowy — pełna tabela §2 z dowodami w `docs/qa/` i przegląd `it.fails`
(każdy naprawiony błąd zdejmuje swoje oznaczenie, nowy błąd dostaje test przed poprawką).
