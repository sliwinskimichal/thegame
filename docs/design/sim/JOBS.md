# Zadania, krasnoludy, magazyn i noszenie (F2-3, etap 2)

> gameplay-programmer · v1 · 2026-11-27 · kod: `src/sim/jobs/` (types, board, chooser), `src/sim/dwarves.ts`,
> `src/sim/items.ts`, `src/sim/stockpile.ts`, `src/sim/colony.ts`, `src/sim/navsave.ts`; dane: `src/content/dwarves.ts`;
> testy: `tests/sim/jobs|dwarves|hauling|colony|scenario.test.ts`, benchmark `tests/sim/colony.bench.test.ts`.
> Podstawy: `WORLD-MUTATION.md` (świat, kopanie, stropy), `docs/design/ai/NAVIGATION.md` (ścieżki).

## 1. Architektura Rozwiązania i Przepływ Danych

| Moduł | Decyduje / wykonuje / przechowuje |
|---|---|
| `JobBoard` (`jobs/board.ts`) | **decyduje, co jest otwarte**: zlecenia (kop, zbuduj, zanieś), priorytety 1–9, rezerwacja celu (jedno zadanie na kafel, miejsce budowy, stos), czarna lista, zależności (podpora przed kopaniem pod pękającym stropem), automatyczne noszenie i podpory; SoA 8192 slotów z generacjami |
| `JobChooser` (`jobs/chooser.ts`) | **decyduje, co weźmie krasnolud**: interfejs; domyślnie `PriorityDistanceChooser` (priorytet osobisty × typ, priorytet zadania, odległość, wiek zlecenia), do zastąpienia warstwą użyteczności (F2-18) |
| `Dwarves` (`dwarves.ts`) | **wykonuje**: maszyna stanów, `NavAgent` na krasnoluda + wspólny `NavPlanner`, kilof (tier, szybkość), ładunek, rezerwacja miejsca pracy, upadki, zasypanie, ucieczka; SoA do 256 krasnoludów |
| `ItemPiles` (`items.ts`) | **przechowuje** stosy na ziemi (zasób z `resources.ts`, ≤ `stack`), rezerwacje jednostek, grawitację stosów, zasypanie i powrót po odkopaniu |
| `Stockpiles` (`stockpile.ts`) | strefy składowania (prostokąty), pojemność na kafel, rezerwacja miejsca dla nadchodzących ładunków |
| `ColonySim` (`colony.ts`) | korzeń kompozycji: kolejność ticku, zlecenia gracza, zapis/odczyt, hash |
| `navsave.ts` | most zapisu stanu `NavAgent`/`NavPlanner`/zegara siatki (do zastąpienia API ai-programmera) |

**Kolejność ticku** (`ColonySim.step`, 20 Hz, zawsze ta sama): `grid.sync` → `dwarves.think` (decyzje i działania:
wybór zadania, podniesienie, odłożenie, start kopania, budowa) → `planner.run` (ścieżki w budżecie 2000 rozwinięć)
→ `dwarves.move` (ruch, upadki, grawitacja stojących) → `dig.tick` → `structure.tick` (ostrzeżenia, zawały) →
`board.tick` (wznowienia z pierścienia zmian, sprzątanie zadań bez celu, pamięć dostępności materiałów i miejsca).

**Styk z innymi systemami.** Gracz/UI wywołuje `orderDig/orderBuild/orderStockpile`, `board.setPriority/cancel`,
`dwarves.setWorkPriority/setPick`. Łup z `digLoot` trafia na ziemię (`items.drop`). Nawigacja: krasnolud jest
`NavAgent`, miejsca pracy to `workSpots`, drabina ze zlecenia budowy to `grid.setInfra(LADDER)`, podpora to
`structure.placeSupport`. Render czyta pozycję (`agents[d].cell`, `path`, `progress`), stan (`state`, `step`,
`carryItem/carryN`), stosy i strefy. Audio i UI dostają zdarzenia (tabela niżej). Symulacja nie zna renderu.

**Zdarzenia EventBus dla UI i audio** (nowe w tym etapie; z etapu 1: `tileChanged`, `dig*`, `caveIn*`, `buried`, `support*`):

| Zdarzenie | Ładunek | UI | Audio |
|---|---|---|---|
| `jobOrdered` | job, type, x, y, priority | znacznik zlecenia, licznik | stuk pieczątki rozkazu |
| `jobClaimed` | job, type, dwarf | „kto to robi” w podpowiedzi | — |
| `jobDone` | job, type, x, y, dwarf | zdjęcie znacznika, kronika | krótki akcent ukończenia |
| `jobCancelled` | job, type, x, y, reason (`player`, `gone`, `blocked`, `notNeeded`) | zdjęcie znacznika | — |
| `jobBlacklisted` | job, type, x, y, fails | ikona „nieosiągalne” + powód | sygnał ostrzegawczy (cichy) |
| `jobReopened` | job, type, x, y, reason (`expired`, `worldChanged`) | ikona znika | — |
| `itemsDropped` / `itemsPicked` / `itemsStored` | i, item, n (+ dwarf) | liczniki magazynu | stuk kamienia, rzut do składu |
| `itemsBuried` | i, item, n | „zasypane w rumoszu” | — |
| `dwarfSpawned` | dwarf, x, y | lista krasnoludów | — |
| `dwarfFell` | dwarf, x, y, rows, damage | wpis w kronice przy obrażeniach | upadek / jęk przy damage > 0 |
| `dwarfFled` | dwarf, x, y | ikona ucieczki | okrzyk ostrzegawczy |
| `dwarfBuried` / `dwarfRescued` | dwarf, x, y | alarm ratunkowy, cel na mapie / ulga | stłumione wołanie / oklaski |
| `dwarfDied` | dwarf, x, y, cause (`fall`, `buried`, `lost`) | żałoba, kronika | dzwon żałobny |

## 2. Maszyna Stanów, Logika Wykonania i Reguły

**Krasnolud** (`DS`): `IDLE → GOTO → WORK → IDLE`; `FLEE`; `STUNNED`; `BURIED`; `DEAD`. Podkroki zadania (`STEP`):
`TO_SITE` (miejsce pracy), `TO_PILE` (po materiał lub ładunek), `TO_DEST` (do strefy składowania).

| Przejście | Warunek |
|---|---|
| IDLE → GOTO | wybór zadania (faza krasnoluda co 0,5 s, tylko gdy tablica się zmieniła lub minęły 3 s, budżet 16 wyszukań na tick) i wolne miejsce pracy |
| GOTO → WORK / następny podkrok | `NavAgent` ARRIVED; kopanie startuje `DigSystem`, budowa odlicza `work`, noszenie podnosi/odkłada |
| GOTO → IDLE (porażka planu) | `NavAgent` BLOCKED: zadanie wraca na tablicę z winą (`fail`), krasnolud omija je 20 s, ładunek ląduje na ziemi |
| WORK → IDLE | kafel wykopany / budowa stoi / zadanie anulowane; słabszy kilof → zwrot bez winy i omijanie |
| * → FLEE | stoi lub pracuje pod pękającym stropem, albo przechodzi, gdy do zawału zostało ≤ `crossSec` (wyjątek: podpora i ratunek, dopóki starcza odliczania) |
| GOTO → IDLE (krawędź) | następny krok ścieżki wchodzi pod strop, który runie za ≤ `crossSec` |
| * → STUNNED | upadek > `maxSafeDrop`: obrażenia 15/rząd, ogłuszenie 1,5 s, zadanie wraca na tablicę |
| * → BURIED | lity kafel stóp albo rumosz nad głową (szczelina 1-kaflowa w litej skale to czołganie, nie zasypanie); −25 HP, potem −1 HP/s; od razu zlecenia ratunkowe (priorytet 9, kafle ciała + chodnik 2-kaflowy od najbliższej pustki) |
| BURIED → IDLE | ciało odkopane |

**Zadanie** (`JS`): `OPEN → CLAIMED → (koniec | OPEN | SUSPENDED)`. Czarna lista: plany **3 różnych** krasnoludów
(mniej w małej kolonii) zawiodły → `SUSPENDED`; wraca po 60 s albo po zmianie świata w promieniu ~8 kafli
(czytanej z pierścienia zmian `World.changesSince`, także zawały i płyny; budowa drabiny woła `touch`).
Jeden zablokowany krasnolud nie zablokuje zadania innym. Zależność: ostrzeżenie stropu zleca podporę (`JF.AUTO`)
na środku pękającego odcinka (najniższy typ z `SUPPORTS`, którego `maxHeight` sięga stropu), a kopanie w tym
odcinku czeka (`wait`), aż podpora stanie albo zagrożenie minie. Niepotrzebna automatyczna podpora sama się anuluje.
Kopanie ratunkowe (`JF.RESCUE`) ignoruje zagrożenie i zależności.

**Krok po kroku — noszenie:** stos `p` pojawia się poza strefą → `orderHaul(p)` → krasnolud: najbliższy wolny kafel
strefy (`nearest`), `k = min(wolne w stosie, udźwig 10, stack, miejsce)` → rezerwacja `k` w stosie i `k` w strefie
→ marsz do stosu (sam kafel lub jego miejsca pracy) → `take` → marsz z prędkością 0,85 → `drop` na kafel strefy →
zwolnienie rezerwacji → zadanie wraca jako OPEN, jeśli w stosie coś zostało. **Budowa:** dla każdego brakującego
materiału kurs do najbliższego stosu → dostarczenie na miejsce (`got`) → praca `work` s → podpora / drabina; anulowanie
zwraca dostarczone materiały na ziemię.

## 3. Model Danych i Parametry dla Designerów (Data-Driven) — `src/content/dwarves.ts`

| Parametr | Typ | Rola | Zakres / uwaga (do zatwierdzenia przez systems-designera) |
|---|---|---|---|
| `DWARF_STATS.hp` | liczba | zdrowie | 100 |
| `carry` | jednostki | udźwig jednego kursu (jeden zasób) | 10; **model balansu liczy 1 jedn./kurs × plecak** — do uzgodnienia |
| `loadedSpeed` | mnożnik | prędkość z ładunkiem | 0,85 |
| `workMul` | mnożnik | kopanie i budowa (umiejętności później) | 1 |
| `fallDamagePerRow`, `fallStunSec` | HP, s | upadek ponad `CONFIG.maxSafeDrop` (3) | 15 / 1,5 (7 rzędów = 60 HP) |
| `buriedHit`, `buriedPerSec` | HP, HP/s | zasypanie | 25 / 1 (ratunek ma ~75 s) |
| `startPick` | id | kilof na start | `copper_pick` (granit wymaga żelaznego) |
| `WORK_DEFAULT` | 0–9 | priorytet osobisty dig/build/haul | 5/5/5; 0 = nigdy |
| `JOB_RULES.defaultPriority / rescuePriority / supportPriority / haulPriority` | 1–9 | priorytety zleceń | 5 / 9 / 8 / 3 |
| `failsToBlacklist`, `blacklistSec`, `reopenRadius`, `avoidSec` | n, s, kafle, s | czarna lista | 3 / 60 / 8 / 20 |
| `thinkSec`, `chooseAttempts`, `searchesPerTick` | s, n, n | rytm i koszt wyboru | 0,5 / 8 / 16 |
| `autoSupport`, `braveMarginSec`, `crossSec`, `fleeRadius` | bool, s, s, kafle | zachowanie pod pękającym stropem | tak / 5 / 5 / 12 |
| `STOCKPILE_RULES.perTile` | jednostki | pojemność kafla strefy | 50 (ECONOMY §2.7 liczy w sztukach) |

## 4. Pseudokod / Szkielet Implementacji

```ts
// ColonySim.step(): grid.sync; dwarves.think; planner.run; dwarves.move; sim.step; board.tick
think(d):
  if BURIED: odkopany ? rescued : hp -= buriedPerSec·dt
  if bodyBlocked(d): bury(d) -> orderRescue(...)          // priorytet 9
  if failing && !brave(d):
    cd = countdownAt(stopy)
    if cd > 0 && (stan != GOTO || cd <= cross): flee(d)   // cele: najbliższe bezpieczne stanowiska w rzędzie
    elif GOTO && countdownAt(następny krok) in (0, cross]: abandon(d)   // czekaj na krawędzi
  IDLE  && faza && (epoch zmienione || retryAt) && budżet: pickJob(d)
  GOTO  : rezerwuj miejsce celu ścieżki (konflikt -> nowy plan bez niego); ARRIVED -> arrive; BLOCKED -> navFail
  WORK  : kopanie gotowe? -> board.complete;  budowa: work -= dt -> place -> complete
pickJob(d): for s of chooser.candidates(d) (top 8 z board.openJobs()): if begin(d, s) return true
begin(DIG): spots = workSpots(cel) bez zajętych i bez pękających (chyba że ratunek); claim; agent.go(spots)
begin(HAUL): dest = nearest(stos); k = min(...); reserve(stos,k); book(dest,k); claim; agent.go(miejsca stosu)
```
Zabezpieczenia: uchwyty z generacjami (nieaktualny → odrzucony), rezerwacje zwalniane na każdej ścieżce wyjścia
(`abandon`, `navFail`, `die`), test „żadnych wycieków rezerwacji”, pamięć dostępności liczona raz na zmianę stanu
(czysta funkcja stanu, więc nie zmienia wyników), zapis kompletny (w tym epoka tablicy, kolejka planera, zegar siatki).

## 5. Edge Cases, Wydajność i Debugowanie

**Przypadki brzegowe i ich obsługa:**
1. **Zakleszczenie ratunku pod pękającym stropem** (rumosz nad głową zasypanego sam jest pękającym stropem, a podpora
   automatyczna bez drewna blokowała kopanie): zadania RESCUE omijają zagrożenie i zależności, ratownik pracuje,
   dopóki starcza odliczania (`brave`).
2. **Krążenie pod pękającym stropem** (wybór zadania z miejscem pracy pod nim → ucieczka → powrót): przy pękającym
   stropie miejsca pod nim są wykluczone; przechodzący nie wchodzą, gdy do zawału ≤ 5 s. Bez tej reguły w wariancie
   bez drewna zawał zasypywał 3 krasnoludów przechodzących przez kolumnę.
3. **Fałszywe zasypanie w szczelinie** (profil krasnoluda się czołga): zasypanie tylko przy litym kaflu stóp lub
   rumoszu nad głową.
4. **Synchronizacja wyszukiwań** (krasnoludy, którym wybór się nie udał, wyrównywały fazę: 100+ wyszukań w jednym
   ticku, piki 40 ms): stała faza na krasnoluda, budżet wyszukań na tick, wyszukiwanie tylko po zmianie tablicy.
5. **Zapis w trakcie** (wszystko w ruchu: ścieżki, rezerwacje, odliczania): zapis obejmuje kolejkę planera, zegar
   siatki (wersja + znaczniki regionów, po `grid.sync`), epokę tablicy, oczekujące zmiany stref; po wczytaniu
   pamięci podręczne liczone od razu. Test: zapis/odczyt przez JSON w tickach 137, 613, 1000, 1499 → ten sam hash.
6. **Samouwięzienie w wykopie**: rów 2 kafle w głąb o pionowych ścianach więzi kopaczy (zeskok tak, wyjście nie).
   Dziś: plany zawodzą → czarna lista z wygasaniem (brak trwałego zakleszczenia), ale zadania zostają. Kopanie od
   góry z zasięgiem (krasnolud sięga kafel nad głowę) — scenariusz zleca spąg po górze komory.

**Wydajność** (`SIM_BENCH=1 npx vitest run tests/sim/colony.bench.test.ts --silent=false`; świat 224×736, 10 galerii
z drabiną i filarami, 200 krasnoludów z żelaznymi kilofami, ~2900 zleceń; 1100 ticków po 100 ticków rozgrzewki):

| Podsystem | HPA\* śr. / p95 / maks. [ms] | A\* śr. / p95 / maks. [ms] |
|---|---|---|
| `grid.sync` | 0,006 / 0,030 / 0,29 | 0,008 / 0,030 / 1,99 |
| krasnoludy: decyzje i działania | 0,314 / 1,147 / 5,45 | 0,306 / 1,073 / 3,54 |
| planer ścieżek (2000 rozwinięć) | 0,031 / 0,206 / 1,94 | 0,031 / 0,169 / 2,66 |
| krasnoludy: ruch, upadki | 0,015 / 0,050 / 0,71 | 0,010 / 0,031 / 0,18 |
| kopanie + stropy | 0,019 / 0,077 / 3,54 | 0,017 / 0,072 / 0,42 |
| tablica zadań | 0,149 / 0,229 / 0,47 | 0,145 / 0,233 / 0,39 |
| **cały tick** | **0,534 / 1,645 / 6,62** | **0,518 / 1,515 / 4,52** |

Budżet M3 (200 krasnoludów < 4 ms p95) spełniony z zapasem ×2,4. Przed optymalizacjami decyzje kosztowały 3,4 ms
średnio i miały piki do 40 ms (punkt 4 + przeglądanie wszystkich slotów z drogim `isOpen`): dziś lista otwartych
zadań i pamięć ważności. Wynik: 771 kafli w 55 s; noszenie przegrywa z kopaniem (priorytet 3 < 5) — zgodnie z
priorytetami.

**Scenariusz-dowód „mała kopalnia”** (`tests/sim/scenario.test.ts`, `SCENARIO_OUT=1` drukuje widoki; `d` = krasnolud,
cyfry = naprężenie stropu w dziesiątkach %, `!` = odliczanie, `T` = podpora, `r` = rumosz). 8 krasnoludów, komora
10×4 w granicie za 2-kaflowym chodnikiem wejściowym, składowisko na łące: 2805 ticków (140 s), 44 kamienie w
magazynie, 0 ofiar, 0 zaległych zadań, wszyscy bezczynni na końcu.
```
przed:                                   po:
....................################     ....................################
....................################     ....................##1245775421####
....................################     ....................01..........####
....................################     ................................####
..dddddddd..........################     ...........d....................####
####################################     ######################..........####
```
Warianty z zawałem (komora 10×3 w wapieniu: szersza niż 6 pęka). Z drewnem — ostrzeżenie, krasnoludy stawiają
stemple, strop trzyma:
```
ostrzeżenie:            po:
......369!963#######    ......363#369963####
.............#######    ................####
..d.d........#######    ................####
######..dddd.#######    ######...T...ddd####
```
Bez drewna — nikt nie podeprze, krasnoludy schodzą spod stropu, zawał nie trafia nikogo:
```
ostrzeżenie:            po:
......369!963#######    ......363#369963####
.............#######    .........r......####
d............1######    .........r......####
######.d...dd.######    ######...r.dd.d.####
```

**Narzędzia debugowania:** `asciiWorld` + nakładka krasnoludów (jak w scenariuszu), `stats` krasnoludów (navFails,
spotConflicts, fled, buried, deaths) i tablicy (ordered, done, blacklisted, reopened), `board.missing(h)` (brakujące
materiały), `ColonySim.hash()` i porównanie krok w krok przy szukaniu rozjazdów. W edytorze (engine-graphics / UI):
znaczniki zleceń z kolorem stanu (otwarte / w toku / czarna lista), linia ścieżki krasnoluda, zarezerwowane miejsce
pracy, ładunek nad głową, strefa zagrożenia z licznikiem.

**Testy:** `jobs` (8), `dwarves` (8), `hauling` (4), `colony` (determinizm 2000 ticków, zapis w 5 punktach, A\*),
`scenario` (3), benchmark (2, pomijany domyślnie).

**Plan na następny etap i decyzje do podjęcia:**
- **Samouczek (F2-2, WORLDGEN):** sala zawału 14×6 ma 6 kafli wysokości, a stempel `maxHeight` 3, do tego ostrzeżenie
  wapienia 30 s przy skrypcie 60 s. Rekomendacja: **podest w sali** (platforma na wysokości 3 — stemple stają na
  podeście, a strop „widzi” je przez kolumnę 3-kaflową) albo sala niższa (14×3, jak wariant „z drewnem” wyżej), plus
  `structure.extendTimers` w skrypcie na +30 s (Pieśń króla „Ostrzeżenie” trzyma strop). Odrzucam stempel samouczkowy
  o innych liczbach (gracz uczyłby się nieprawdziwej reguły).
- **Kamień Prakowali** (kilof 9) na ściany Gardzieli zamiast `bedrock`: nowy materiał w `materials.ts` z `tier 9` i
  `ROCK_STRENGTH` (∞); mutator już odmawia kopania tieru 9 poza skryptem.
- **`World.infra`** (z kontraktem `WorldgenResult` i propozycją ai-programmera): jedna warstwa infrastruktury
  logowana w pierścieniu (`CHANGE.INFRA`), z niej drabiny dla nawigacji i podpory dla stropów (dziś `grid.infra` i
  `structure.support` osobno).
- Dla ai-programmera: `NavAgent.save/load` i `NavPlanner.save/load` (zastąpią `navsave.ts`); warstwa kar ścieżki
  (omijanie pękających stropów zamiast reguły krawędzi); planowanie kolejności urabiania z zasięgiem i drabinami
  (samouwięzienie); indeks przestrzenny otwartych zadań w warstwie użyteczności (F2-18).
