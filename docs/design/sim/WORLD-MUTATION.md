# Zmiany świata: mutacje, kopanie, stropy i zawały (F2-3, etap 1)

> gameplay-programmer · v1 · 2026-11-27 · kod: `src/sim/world/`, `src/sim/dig.ts`, `src/sim/structure.ts`,
> `src/sim/worldsim.ts`, `src/sim/debug.ts`, dane: `src/content/structure.ts`, testy: `tests/sim/`.
> Bramki: E1 (model świata), E2 (zagrożenie „cave_ins”), M3-01…M3-04, M3-09, M3-10, M3-12 z `docs/qa/TEST-PLAN.md`.

## 1. Architektura Rozwiązania i Przepływ Danych

| Moduł | Odpowiedzialność | Stan, który przechowuje |
|---|---|---|
| `World` (`src/world/world.ts`) | surowe prymitywy `dig` / `fill` / `setFluid` / `reveal`; spójność kafla (BUG-003); pierścień zmian z rodzajem zmiany | tablice SoA kafli, `baseCav`/`baseDepth` (stan wnęki pod zabudową), rekwizyty |
| `WorldMutator` (`sim/world/mutate.ts`) | **jedyna ścieżka mutacji w symulacji**: brama kilofa 9 (tylko `SCRIPT` ją omija), tagi kafli, brudne obszary, zdarzenia | `tag` (RUBBLE, BUILT), `DirtyMap` |
| `DirtyMap` (`sim/world/dirty.ts`) | brudne chunki (32×32) per kanał: MESH (±1 kafel), LIGHT (±16), FOG, NAV (±1), FLUID | flagi + listy w kolejności oznaczania |
| `DigSystem` (`sim/dig.ts`) | **wykonuje** kopanie: postęp w czasie, brama kilofa z powodem, odsłonięcie, rezerwacja kafla, łup | `progress` (Float64, praca na kaflu), zadania SoA (1024 sloty z generacjami) |
| `StructureSystem` (`sim/structure.ts`) | **decyduje** o nośności stropów, odlicza ostrzeżenia, wykonuje zawał przez mutator | `stress` (% nośności), `timer` (ticki do zawału), `support`, kotwice kolumn |
| `WorldSim` (`sim/worldsim.ts`) | korzeń kompozycji: jeden `EventBus`, stała kolejność ticku, zapis/odczyt, hash | numer ticku, ziarno |
| `asciiWorld` (`sim/debug.ts`) | tekstowy podgląd stanu do logów, testów i raportów błędów | — |

**Kto decyduje, kto wykonuje.** Gracz (rozkazy) → system zadań (przyszły) → krasnolud/AI wybiera kafel i wywołuje
`dig.start(x, y, worker, tool)`; `DigSystem` sam dolicza pracę co tick i po ukończeniu woła `mut.dig`. Strop ocenia
wyłącznie `StructureSystem`; zawał wypełnia kafle przez `mut.place(..., CAUSE.COLLAPSE)`. Nikt poza mutatorem nie
pisze tablic `World` w symulacji.

**Kolejność ticku** (`WorldSim.step`, 20 Hz): polecenia gracza (między tickami) → `dig.tick()` → `structure.tick()`
(ocena brudnych wierszy → odliczanie → zawały). Podpora postawiona w tym samym ticku, w którym mija ostrzeżenie,
ratuje halę (ocena przed odliczaniem).

**Zdarzenia (`src/sim/events.ts`, `SimEvents`)** — dla innych działów:

| Zdarzenie | Kiedy | Odbiorcy |
|---|---|---|
| `tileChanged {i,x,y,before,after,cause}` | każda zmiana lity ↔ otwarty (1 na kafel) | AI (przeplanowanie), audio, chciwość P (`cause = DIG`), budowa |
| `tileRevealed {i,x,y}` | kafel odkryty (mgła) | badania (ujawnianie węzłów po złożach), UI |
| `propsRemoved`, `fluidChanged`, `fluidDisplaced` | rekwizyty usunięte; płyn zmieniony / zniszczony zabudową | render rekwizytów, symulacja płynów (B2) |
| `digStarted`, `digCrack {stage 1–3}`, `digBlocked {reason, need}`, `digResumed`, `digDone`, `digLoot {mat, deposit, resource, n}` | proces kopania | animacja i VFX (pęknięcia), dźwięk uderzeń, UI (powód), przedmioty/magazyn (łup) |
| `supportPlaced`, `supportRemoved {reason: removed / floorLost / buried}` | podpory | render, UI, budowa |
| `caveInWarning {id,row,x0,x1,tiles,ticksLeft}` | strop zaczyna pękać (nowa grupa) | UI (toast, licznik), audio (trzeszczenie), VFX (sypiący się pył), samouczek |
| `caveInAverted {row,tiles}` | pękający strop znów trzyma | UI, audio |
| `caveIn {id,roof,filled}`, `buried {id,tiles,water,lava,supports,props}` | zawał i to, co zasypał | VFX/audio (zawał), AI (zasypani krasnoludzi), ekonomia (A −3 za zawał bez podpór), płyny |

**Nawigacja** (ai-programmer) przelicza się z pierścienia `World.changesSince`; od tej wersji wpis niesie rodzaj
zmiany (`CHANGE.TERRAIN | FLUID | FOG`), więc nawigacja może pominąć zmiany mgły. Wszystkie ścieżki (kopanie,
zawał, zabudowa, płyny) idą przez `World.dig/fill/setFluid/reveal`, które logują do pierścienia; podpory nie
zmieniają kafla i są przechodnie — nie wymagają `grid.markDirty`. **Render** czyta `structure.stress/timer/version`,
`dig.progressAt`, `mut.tag` (rumosz) i `DirtyMap` (MESH/LIGHT/FOG/FLUID). Symulacja nie importuje `src/render`.

## 2. Maszyna Stanów, Logika Wykonania i Reguły

**Zadanie kopania** (`JOB`):

| Stan | Wejście | Wyjście |
|---|---|---|
| FREE | `cancel`, ukończenie | `start` (tylko gdy `canDig = OK` i kafel wolny) |
| ACTIVE | `start`; `digResumed` (lepszy kilof, otwarty sąsiad) | `digBlocked` (słabszy kilof, zamurowany jedyny dostęp, kafel zniknął); ukończenie → FREE |
| BLOCKED | `digBlocked {reason, need}` | `setTool` / zmiana sąsiada → ACTIVE; `cancel` → FREE |

Powody (`DIG_FAIL`, klucze i18n w `DIG_FAIL_KEY`): `OUT_OF_BOUNDS`, `NOT_SOLID`, `UNBREAKABLE` (kilof 9: skała
macierzysta), `TIER_TOO_LOW` + `need` („Za słaby kilof: potrzebny poziom 2”), `NOT_EXPOSED` („Brak dojścia —
najpierw odkop sąsiedni kafel”), `RESERVED`, `NO_SLOT`, `BAD_JOB`. Jeden kafel = jedno zadanie (brak podwójnego łupu).

**Kopanie krok po kroku (tick):** dla każdego ACTIVE slotu rosnąco: `progress += workSpeed × mnożnik × 1/20`;
przekroczenie progu pęknięcia (25/50/75%) → `digCrack`; `progress ≥ twardość` (× 0,5 dla rumoszu) → zwolnienie slotu,
`mut.dig` (→ `tileChanged`, odkrycie 3×3), `digLoot` (złoże: `yields × amount`; zwykła skała: kamień ×1; mur:
blok ×1; rumosz: nic), `digDone`. Czas = ⌈twardość / (workSpeed/20)⌉ ticków (granit 3,5 kilofem żelaznym 1,35 = 52).
Przerwanie zostawia pracę na kaflu (`progressKept = 1`): kolejny krasnolud kończy resztę.

**Kafel stropu:** TRZYMA (`stress ≤ 100`) → PĘKA (`stress > 100`, `timer` odlicza `warnSec`) → ZAWAŁ (kolumna
zasypana) lub z powrotem TRZYMA (`caveInAverted`).

**Ocena stropu (wiersz r):** bieg otwartych kafli podziemnych w wierszu r jest ograniczony litymi kaflami (ściany,
filary skalne, krawędź mapy) oraz otwartym niebem (lico zbocza niesie masyw nad nim; decyzja z F2-3 etapu 2 —
bez niej strop każdej komory za wejściem ze zbocza liczył się jak wspornik i pękał). Podpora stoi na podłodze kolumny i usztywnia cały segment kolumny, jeśli jest on nie wyższy niż
`maxHeight` (kratownica dodatkowo `reach` kolumn w bok). Kafel stropu = lity kafel nad biegiem; `d` = odległość do
najbliższej ściany lub usztywnionej kolumny; nośność = ⌊maxSpan/2 × 2,5 (naturalna jaskinia, nawis) × 2 (chodnik ≤ 2
kafle)⌋. Płaska hala szerokości L trzyma ⇔ L ≤ maxSpan. Kafle, które przestają trzymać, startują odliczanie;
nowa grupa → `caveInWarning`, grupa ze starym odliczaniem nie dostaje nowego ostrzeżenia (poszerzenie nie odracza
zawału). **Zawał:** gdy licznik kafla dobiega końca, padają wszystkie pękające kafle jego odcinka; każda kolumna
wypełnia się rumoszem od podłogi w górę (≤ 8 kafli, skała macierzysta tła, nigdy ruda). Rumosz to ściana — reszta hali
trzyma; wysoka hala wali się etapami, każdy etap ostrzeżony.

**Priorytety:** ocena wierszy przed odliczaniem; w jednym ticku wiersze od góry; zawały w kolejności indeksu kafla;
obsługa zdarzeń nie mutuje świata (systemy działają we własnym ticku).

## 3. Model Danych i Parametry dla Designerów (Data-Driven)

| Parametr | Typ | Rola w mechanice | Bezpieczny zakres / uwaga |
|---|---|---|---|
| `ROCK_STRENGTH[klucz].maxSpan` | liczba parzysta / ∞ | najszersza hala bez podpór | 2–20; nieparzyste działają jak niższa parzysta; ∞ tylko kilof 9 (test) |
| `ROCK_STRENGTH[klucz].warnSec` | s | czas od ostrzeżenia do zawału | 8–60; samouczek (4 stemple w 60 s) potrzebuje ≥ 60 lub `extendTimers` |
| `STRUCTURE.naturalSpanMul` | mnożnik | jaskinie naturalne i nawisy to osiadłe łuki | 2–3; generator: szerokość jaskini ≤ 2·⌊maxSpan/2·mul⌋ |
| `STRUCTURE.lowRoof` | `{maxHeight, spanMul}` | chodnik (≤ 2 kafle) niesie dłuższy strop niż hala | 2 / 2 |
| `STRUCTURE.rubbleMaxRows` | kafle | ile rumoszu spada na kolumnę | 4–12 (mniej = więcej etapów zawału) |
| `STRUCTURE.rubbleHardnessMul` / `rubbleTier` / `rubbleLoot` | mnożnik / tier / Stack | odgruzowanie: szybciej, gołymi rękami, bez łupu | 0,3–0,7 / 0 / `null` (inaczej zawał duplikuje kamień) |
| `SUPPORTS[].maxHeight` / `reach` | kafle | stempel 3/0, filar kamienny 6/0, kratownica 10/1, filar obsydianowy 8/0 | reach ≤ 2 |
| `EXCAVATION.hands` | `{pickTier, workSpeed}` | kopanie bez kilofa (gleba, glina, piasek) | 0 / 0,6 (= podłoga modelu balansu) |
| `EXCAVATION.plainLoot` / `lootByMaterial` | Stack / mapa | łup skał bez złoża (kamień ×1; mur → blok ×1) | zgodne z `analysis.ts` (kamień z T0) |
| `EXCAVATION.progressKept` | 0–1 | praca zostaje na kaflu po przerwaniu | 1 |
| `EXCAVATION.crackStages` | ułamki | progi zdarzeń `digCrack` | rosnące |
| twardość, kilof, łup złóż | z `MATERIALS` / `DEPOSITS` / `RESOURCES` | czas, brama, łup | jedno źródło prawdy: biblia treści |

**Proponowane rozpiętości** (`maxSpan`, warnSec): gleba 4/15, glina 4/20, piasek 2/8; wapień, piaskowiec, wapień
muszlowy 6/30, łupek 4/25, węgiel 4/20, saletra 4/15, miedź i cyna 8/30; granit 14/60, łupek ilasty 10/45, żelazo
10/40, kwarc 12/45; łupek zarodnikowy 6/30, grzybnia 4/20; mułowiec 6/25, sól 8/40; łupek krystaliczny 10/45;
bazalt 16/60, skała magmowa 12/40, obsydian 10/30; prakamień 18/60, prastary mur 16/60, sercokamień 20/60; mur
kamienny 8/40; skała macierzysta ∞. Wapienne Progi uczą podpór co 6 kafli (chodnik 12); granit niesie hale 14, ale
hale fabryczne 15–20 kafli wymagają filarów i kratownic także głębiej; Zatopione Głębie (mułowiec 6) znów są słabe.

## 4. Pseudokod / Szkielet Implementacji

```ts
// StructureSystem.evaluateRow(r): roof tiles of row r-1 over the open runs of row r
for (const [a, b] of openRuns(r)) {
  if (!hasRoofAbove(a, b)) continue;                      // sky rows: skip
  sweep a→b: run = anchor[k] >= 0 ? -anchor[k] : run + 1; dl[k] = run;   // walls count as 1
  sweep b→a: the same into dr[k];
  for (k of a..b) {
    if (anchor[k] >= 0) { closeSpan(); continue; }        // braced column: its own roof holds
    if (!solid(k, r - 1)) continue;                       // roof steps up: no roof tile here
    const d = max(0, min(dl[k], dr[k])), cap = capacity(roof, below);
    stress = round(100 * d / cap);
    if (d > cap) wasFailing ? keepTimer() : (timer = warnTicks(mat), queueWarning());
    else if (wasFailing) { timer = 0; averted.push(roof); }
  }
}
// tick(): flush dirty rows → for rows with failures: timer === 1 ? collapse(tile) : timer--
// collapse(tile): span = walls/braces around it; for each failing roof of the span:
//   fill its column from the floor up (<= rubbleMaxRows) via mut.place(..., COLLAPSE); emit caveIn + buried
```

Zabezpieczenia: `World.fill` odrzuca materiał nielity, kafel lity i spoza siatki; `mut.dig` odrzuca kilof 9;
odświeżenie kolumny (kotwice) przy każdej zmianie kafla lub podpory; wiersze i chunki oznaczone w trakcie odbioru
nie giną (`flush`, `take`); uchwyt zadania z generacją (nieaktualny uchwyt → `BAD_JOB`).

## 5. Edge Cases, Wydajność i Debugowanie

**Przypadki brzegowe i ich obsługa:**
1. **Zabudowa i rozbiórka (BUG-003):** mur w niebie po rozkopaniu wraca do nieba, w zalanej jaskini do jaskini
   o tej samej głębokości, bez widmowego płynu; `fill(AIR)` odrzucone; rekwizyty stojące w kaflu usunięte.
2. **Poszerzanie pękającej hali / zdjęcie podpory w trakcie odliczania:** odcinki łączą się bez nowego
   ostrzeżenia, a cały połączony odcinek pada w pierwotnym terminie (brak odraczania i brak spamu zdarzeń).
3. **Zapis w trakcie odliczania:** zapis obejmuje `stress`, `timer`, podpory i brudne wiersze, więc wczytana gra
   wali strop w tym samym ticku, co niezapisana (brak exploitu „wczytaj, by zresetować licznik”).
4. **Dwóch krasnoludów na jednym kaflu:** drugi dostaje `RESERVED`; po przerwaniu następca kończy pozostałą pracę,
   łup wypada raz.
5. **Stropy schodkowe i żebra:** schodek w górę nie jest kotwicą (odległość biegnie dalej), wisząca część niższego
   stropu pęka w pełnej szerokości hali — „piłokształtny strop” nie obchodzi limitu. Filar skalny (lity kafel
   do podłogi) dzieli halę — działa jak w kopalni komorowo-filarowej.
6. **Zawał na krawędzi mapy i nad wodą:** krawędź to ściana; rumosz niszczy płyn i raportuje ilość (`buried.water`).

**Wydajność** (`SIM_BENCH=1 npx vitest run tests/sim/worldsim.bench.test.ts --silent=false`; świat 224×736,
400 komór, 200 kopaczy, 1000 ticków; Node, kontener):

| Pomiar | średnia ms | p50 | p95 | max |
|---|---|---|---|---|
| A: pełna ocena stropów | 3,16 | 2,27 | 10,35 (zimny JIT) | 10,35 |
| B: tick (kopanie + stropy przyrostowo) | 0,168 | 0,060 | 0,598 | 2,80 |
| — kopanie | 0,038 | 0,021 | 0,100 | 1,51 |
| — stropy (brudne wiersze + odliczanie + zawały) | 0,129 | 0,027 | 0,491 | 2,70 |
| C: tick ze strategią A (pełna ocena co tick) | 2,61 | 2,58 | 2,70 | 4,94 |

Wynik: 5 861 kafli, 63 zawały (1 195 kafli rumoszu). Strategia przyrostowa (B) jest ok. 15× tańsza od pełnej (C)
i mieści się z zapasem w budżecie 4 ms/tick dla 200 krasnoludów. Gorące pętle bez alokacji; alokują tylko ładunki
rzadkich zdarzeń.

**Narzędzia debugowania:** `asciiWorld(sim, x0, y0, x1, y1)` (`#` skała, `.` pustka, `0–9` naprężenie stropu
w dziesiątkach %, `!` odliczanie, `T`/`t` podpora działa/nie działa, `r` rumosz, `X` kopany kafel);
`structure.warnings()` (grupy z czasem do zawału), `supportStatus` (`ok`/`tooTall`/`noRoof`), `stats` każdego systemu,
`WorldSim.hash()` do szukania rozjazdu. Wizualizacja w edytorze (dla engine-graphics): siatka naprężeń na kaflach
stropu z `stress` (zielony < 70, żółty 70–100, czerwony pulsujący > 100 z licznikiem `timer/20` s), pęknięcia
z `dig.progressAt`, rumosz z `mut.tag & RUBBLE`.

**Testy** (`tests/sim/`): `world-mutation` (BUG-003, ścieżka mutacji, rodzaje zmian w pierścieniu, brudne chunki
na krawędziach, zapis/odczyt świata), `dig` (czas ±0 ticków, brama kilofa z `need`, odsłonięcie, zmiana kilofa,
rezerwacja, rumosz, pęknięcia, zapis w trakcie), `structure` (limit, ostrzeżenie i zawał co do ticku, podpory,
filary skalne, chodniki, jaskinie naturalne, kratownica, strop schodkowy, krawędź mapy, płyn, etapowy zawał,
Kołysanka, determinizm i zapis przez JSON w trakcie odliczania), `structure-data` (kontrakt danych, strażnik
`Math.random`). Najpierw przetestować w grze: salę samouczka 14×6 z 6 stemplami i wyzwalaczem w ścianie wschodniej.

**Plan na następny etap (z przekazania ai-programmera i własny):** warstwa `World.infra` (drabiny, schody, pomosty,
podpory w jednej tablicy logowanej w pierścieniu jako `CHANGE.INFRA`) razem z systemem budowy; rejestr budowli-połączeń
(windy, tory, liny, mosty) dla nawigacji; warstwa kar ścieżek (światło dla goblinów, zarodniki) po stronie środowiska;
system zadań: rezerwacja miejsca pracy i kafla przy planowaniu (dziś `DigSystem` rezerwuje tylko kafel), czarna lista
zadania po 3 nieudanych planach (stan `BLOCKED` agenta nawigacji), ratunek zasypanych z `buried.tiles`.
