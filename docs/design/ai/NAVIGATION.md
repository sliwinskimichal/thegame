# Nawigacja z grawitacją i warstwa ruchu AI (F2-4)

> Rola: Senior AI Programmer · Status: **moduł gotowy do integracji (M3)**, decyzje do akceptacji w §5.4.
> Kod: `src/sim/nav/` · Testy: `tests/sim/nav.test.ts` (29) · Benchmark: `tests/sim/nav.bench.test.ts`
> (`NAV_BENCH=1`), pełne tabele: [nav-bench.md](nav-bench.md) · Mapa testowa 224×720: `src/sim/nav/testmaps.ts`.

**Werdykt benchmarku:** domyślny planer = **HPA\* 16×16** (ścieżki optymalne, najlepszy najgorszy przypadek:
globalne p95 0,33–0,49 ms, „brak ścieżki” 0,18–0,30 ms, aktualizacja po wykopaniu kafla 0,04–0,06 ms) +
**kolejka planowania z budżetem rozwinięć na tick** + **walidacja ścieżek znacznikami regionów 16×16**.
Budżet: **200 krasnoludów = 0,29 ms mediany / 1,7 ms p95 / 2,4 ms maks. na tick** (test obciążeniowy, §2.3).

---

## 1. Architektura AI i przepływ decyzji

### 1.1 Warstwy (dla krasnoludów i potworów)
| Warstwa | Krasnolud | Potwór / najazd / boss | Gdzie |
|---|---|---|---|
| **Percepcja i pamięć** | widzi to, co odkryte i oświetlone; słyszy wezwania; zna mapę grodu | wzrok (linia widzenia po kaflach, zasięg zależny od światła), słuch (hałas kopania), pamięć ostatniej pozycji celu z wygasaniem | `src/sim/ai/perception` (do zrobienia, §2.4) |
| **Decyzja** | użyteczność: zadania (gameplay) × potrzeby × bezpieczeństwo; wybór *celu* (zbioru kafli) | użyteczność z histerezą (atak / podejście / ucieczka / grabież / powrót do legowiska) | `src/sim/ai/` (do zrobienia) |
| **Taktyka** | wybór miejsca pracy (wiele celów naraz), unikanie zagrożeń (warstwa kar) | podział grupy na trasy, flankowanie, trzymanie się ciemności, wyważanie drzwi, smycz bossa | `src/sim/ai/` (zarys §2.5) |
| **Lokomocja** | `NavGrid` → `PathFinder` (HPA\*) → `NavPlanner` (kolejka) → `NavAgent` (ruch po krawędziach, upadki, przeplanowanie) | ten sam stos z innym profilem ruchu (`GOBLIN`, `TROLL`, `WOLF`, `SPIDER`, `BAT`) | `src/sim/nav/` (**gotowe**) |

Decyzja nigdy nie woła algorytmu ścieżki bezpośrednio: zleca **cel** (`agent.go(cele)`), a lokomocja raportuje stan
(`MOVING / WAITING / ARRIVED / BLOCKED / LOST`, `lastFall`, `replans`). Dzięki temu warstwy da się stroić i testować osobno.

### 1.2 Kolejność w ticku symulacji (deterministyczna)
```
1. mutacje świata (gameplay: kopanie, budowa, zawały, płyny)  -> pierścień zmian World (dig/fill/setFluid logują kafel)
2. grid.sync()            -> lokalne przeliczenie okien wokół zmienionych kafli, powiadomienie słuchaczy
                             (JumpTables: wiersz+kolumna; HpaStar: brudne klastry, przebudowa leniwa)
3. decyzje AI             -> agent.go(cele) dla tych, którzy zmienili zamiar (plany trafiają do kolejki)
4. planner.run()          -> obsługa kolejki FIFO do wyczerpania budżetu rozwinięć węzłów (min. 1 plan)
5. agent.tick(50 ms)      -> walidacja (tylko gdy zmienił się region na trasie), upadek, ruch po krawędziach,
                             rezerwacja linków (winda/lina/most) na czas przejazdu
6. zdarzenia -> gameplay  -> dotarł / zablokowany / spadł z wysokości h (obrażenia, gdy h > maxDrop)
```
**Determinizm:** koszty całkowite (ms czasu ruchu), tablice typowane, kopiec z jednoznacznym kluczem `f·2²⁰ + h`,
kolejka FIFO z budżetem w **rozwinięciach, nie w milisekundach** (test: dwa przebiegi → identyczne pozycje 60 agentów).

### 1.3 Styk z innymi systemami
- **Świat** (gameplay-programmer, `src/sim/world/mutate.ts`, `src/sim/dig.ts`): nawigacja czyta wyłącznie `SOLID[mat]`,
  parę (`fluid`, `fluidKind`) — woda/lawa tylko gdy poziom > 0 — oraz pierścień `changesSince`. Nie trzeba wołać nawigacji
  z kodu kopania: wystarczy, że każda zmiana idzie przez `dig/fill/setFluid` (logują kafel). Zmiany poza pierścieniem →
  `grid.markDirty(x0, y0, x1, y1)`.
- **Budowa** (gameplay): do czasu pola `World.infra` (§5.4) infrastrukturę stawia się przez `grid.setInfra(x, y, kod)`
  (`INFRA_BY_CONTENT` mapuje id z `src/content/buildings.ts`), budowle-połączenia przez `grid.addLift / addRail /
  addRope / addBridge`; wyłączenie (brak energii, zniszczenie) — `grid.setGroupEnabled(g, false)`.
- **Animacja**: każdy węzeł ścieżki niesie ruch, którym się do niego wchodzi (`path.moves[k]`: chód, wejście na stopień,
  zeskok z wysokością, wspinaczka, schody, puszczenie drabiny, przejazd) i postęp `agent.progress` w ms — wystarcza do
  wyboru klipu i interpolacji pozycji.
- **Walka**: taktyka ustawia cele (np. kafle w zasięgu ataku = `workSpots` z innym zasięgiem), lokomocja tylko dowozi.

### 1.4 API dla gameplay (sygnatury)
```ts
new NavGrid(world, { profiles?: MoveProfile[], infra?: Uint8Array })
grid.sync(): number                                  // raz na tick (finders i agenci wołają też sami)
grid.setInfra(x, y, code) · grid.setInfraColumn(x, y0, y1, code) · grid.markDirty(x0, y0, x1, y1)
grid.addLift(stops, { speed, wait, capacity }) / addRail(stations, { speed, board, capacity })
grid.addRope(top, bottom) / addBridge(a, b, { capacity }) / addLink(kind, from, to, cost, group?, profiles?)
grid.setLinkEnabled(l, on) · setGroupEnabled(g, on) · reserve(g) · release(g)
grid.standable(p, cell) · grid.landing(p, x, y) (+ grid.lastFall) · grid.profileIndex('dwarf')
new HpaStar(grid, p, { cluster: 16 }) | new AStar(grid, p, { jumps?, weight? })     // PathFinder
finder.find(start, goals: ArrayLike<number>, out: Path, { maxExpansions? }): NAV.*  // wiele celów = najbliższy
workSpots(grid, p, tx, ty, out: Int32Array): number  // kafle, z których krasnolud dosięga kafla (kopanie/budowa)
new NavPlanner(budget) · planner.run(): number
new NavAgent(finder, cell, planner?) · agent.go(goals) · agent.tick(dtMs) · agent.state / lastFall / replans
```

## 2. Nawigacja, percepcja i taktyka w terenie

### 2.1 Model ruchu (przekrój z grawitacją)
**Węzeł** = kafel stóp. Ciało ma `height` kafli (krasnolud 1,3 kafla → 2); w niższej szczelinie krasnolud **czołga się**
(koszt ×2,5), troll nie. Kafel jest **stawialny**, gdy ciało się mieści (otwarte, głowa nie pod wodą), a pod stopami jest
podłoże: lita skała, **pomost** (pokład w pustce), **wierzch drabiny**, dół mapy — albo agent jest **na drabinie**, **na
schodach** lub **pływa** (profil nurka). Krasnolud nie lata.

| Ruch (bit) | Warunek | Koszt bazowy krasnoluda [ms] |
|---|---|---|
| `WALK_L/R` | sąsiad w poziomie stawialny | 400 (2,5 kafla/s jak w modelu balansu) |
| `STEP_UL/UR` | sąsiad zablokowany, nad nim stawialny kafel, nad głową wolne (bez „przeciskania po skosie”) | 700 — **tylko 1 kafel** |
| `DROP_L/R` (k) | sąsiad wolny bez podłoża → spadanie kolumną do lądowania w ≤ `maxDrop` (CONFIG.maxSafeDrop = 3) | 300 + 250·k |
| `FALL` (k) | puszczenie drabiny nad szczeliną (drabina urwana) | 300 + 250·k, k ≥ 2 |
| `UP/DOWN` | drabina (także „chwyt” szczebla nad głową / zejście z ostatniego szczebla), pływanie | 900 / 600 |
| `STAIR_U*/D*` | schody: rampa rosnąca o 1 wiersz na kolumnę, orientacja w kodzie kafla | 600 / 500 |
| `LINK` | połączenie specjalne z tabeli linków | wg linku + kolejka |

**Infrastruktura** (`INFRA`): drabina (wspinaczka; wierzch = podłoga), pomost (podłoga, ciało przez niego nie przechodzi),
schody (z orientacją `INFRA_RISE_RIGHT`), drzwi drewniane / żelazne / gródź (mnożnik kosztu per profil, 0 = nieprzechodnie;
flaga `INFRA_LOCKED`), tory (chodzi się po nich normalnie; przejazd wagonikiem to link `RAIL`). Woda: brodzenie ×1,6, głowa
pod wodą = nieprzejezdne bez profilu nurka; lawa nieprzejezdna (poza profilami `lavaOk`).

**Połączenia specjalne (off-mesh links, z kosztem i pojemnością)** — grupy z pojemnością i obciążeniem; koszt linku rośnie
o czas kursu × ⌊obciążenie/pojemność⌋, gdy grupa jest pełna (winda zatłoczona → planer sam wybiera drabinę):
| Link | Koszt | Pojemność | Uwagi |
|---|---|---|---|
| lina (`ROPE`) | 400 + 1300/wiersz w górę, 700/wiersz w dół | 1 | tani pion na start; tylko końce |
| most linowy (`BRIDGE`) | 560/kafel | 3 | przeprawa nad rozpadliną (Groty, Gardziel); nie da się na nim stanąć |
| winda (`LIFT`) | czekanie + wiersze/prędkość (L1 1, L2 2,5, L3 5 kafli/s) | ładunek z `buildings.ts` | każdy przystanek z każdym |
| tory (`RAIL`) | wsiadanie + długość toru/prędkość | wagoniki | stacje w kolejności toru |

**Profile** (`src/sim/nav/profiles.ts`, propozycja przeniesienia do `src/content/navProfiles.ts`): `DWARF` (h 2, czołganie,
zeskok 3, wszystkie linki), `DWARF_DIVER` (+ pływanie), `GOBLIN` (h 1, zeskok 4, drabiny i liny, drzwi drewniane ×8 = wyważa,
żelazne nie), `TROLL` (h 2 bez czołgania, zeskok 2, bez drabin i linek, drzwi drewniane ×4 / żelazne ×12), `WOLF` (h 1, bez
drabin, drzwi nieprzechodnie), `SPIDER` (wspinacz: każda ściana i strop), `BAT` (lot w 8 kierunkach bez ścinania narożników).

### 2.2 Struktura danych i aktualizacja lokalna
- `NavGrid` na profil: `mask: Uint16` (bity ruchów), `drop: Uint16` (spakowane wysokości 3 spadków), `mul: Uint8`
  (mnożnik kosztu wejścia ×16; 0 = niestawialny) — 5 B/kafel/profil; wspólne: `solid`, `infra`, stan płynów, flagi.
- **Aktualizacja**: zmiana kafla T przelicza tylko okno `x ∈ [Tx−2, Tx+2] × y ∈ [Ty−maxDrop−2, Ty+height+1]` (≈ 45 kafli)
  + źródła linków, których koniec leży w oknie; słuchacze dostają listę kafli o zmienionych danych. Test: po ~120
  wykopach i zasypach lokalny wynik **bajt w bajt** równy pełnej przebudowie (maski, spadki, koszty, wyniki HPA\* i skoków).
- **Heurystyka** `h = a·|dx| + up·wiersze_w_górę + down·wiersze_w_dół`, współczynniki wyprowadzone z najtańszych ruchów
  profilu (dopuszczalna i spójna) i skalowane w dół, jeśli któryś link jest szybszy (test „szybki tor”).
- **HPA\***: portale = **wszystkie** kafle-źródła i cele krawędzi przecinających granicę klastra (graf jest skierowany:
  zeskok działa w jedną stronę) + końce linków; w klastrze mapy poprzedników Dijkstry z każdego portalu → wynik
  **optymalny** (test zgodności kosztów z A\* na 80 losowych zapytaniach), rafinacja bez wyszukiwania.
- **Skoki (JPS+)**: długości przebiegów w poziomie (chodniki) i w pionie (szyby z drabiną) do najbliższego kafla, gdzie
  dzieje się coś innego; martwe końce przycinane.

### 2.3 Benchmark (3 algorytmy + 2 warianty kontrolne)
Mapy: arena laboratorium (64×46 z dodanymi drabinami), syntetyczna kopalnia 224×720 (seed 1: 6,6 tys. węzłów, 668 linków)
i ta sama kopalnia (seed 2) z **gęstym grodem** 128×144 (36 kondygnacji, drabiny co 12 kolumn, co trzeci strop to pomost;
10,4 tys. węzłów). 300 zapytań lokalnych (cel ≤ 24 kafle) + 300 globalnych (w tym 71–198 bez ścieżki), 150 zmian kafli.

**Kopalnia 224×720 + gród (najtrudniejsza)** — czasy w ms (mediana / p95):
| Algorytm | lokalne | globalne | brak ścieżki | aktualizacja po zmianie kafla | pamięć własna | koszt / optimum |
|---|---|---|---|---|---|---|
| A\* (warstwy ruchu) | 0,027 / 0,343 | 0,437 / 1,18 | 0,447 / 1,42 | 0,018 / 0,036 | 0 | 1,0000 |
| A\* + skoki (JPS+) | 0,024 / 0,280 | 0,429 / 1,21 | 0,252 / 1,92 | 0,049 / 0,090 | 634 KB | 1,0000 |
| **HPA\* 16×16** | 0,077 / 0,286 | **0,211 / 0,491** | **0,175 / 0,615** | 0,037 / 0,357 | 1,2 MB | 1,0000 |
| HPA\* 32×32 | 0,108 / 0,193 | 0,208 / 0,376 | 0,184 / 0,412 | 0,062 / **1,40** | 2,2 MB | 1,0000 |
| A\* ważony w = 1,5 (kontrolny) | 0,018 / 0,275 | 0,360 / 1,18 | 0,462 / 1,47 | — | 0 | 1,0004 (maks. 1,026) |

**Kopalnia 224×720 (rzadka)**: A\* globalne 0,40 / 1,00, brak ścieżki 1,01; skoki 0,16 / 0,36 i 0,36; HPA\* 16 0,15 / 0,33
i 0,30; HPA\* 32 0,12 / 0,23 i 0,22. Lokalne: skoki 0,005 / 0,026 (najszybsze), HPA\* 16 0,014 / 0,035.
Wspólne koszty: `NavGrid` 1,6 MB (1 profil) + bufory wyszukiwania 2,7 MB; budowa siatki 18–48 ms, HPA\* 16: 21–28 ms.

**200 krasnoludów** (gród, 600 ticków × 50 ms, 1 wykop na tick, 10% celów dalekich, nowe zadanie po dotarciu):
| Planer | kolejka | tick mediana / p95 / maks. [ms] | pierwszy tick (200 planów) | czekanie w kolejce śr. / maks. |
|---|---|---|---|---|
| A\* | brak | 0,131 / 2,77 / 11,8 | 28,4 ms | — |
| A\* | 3000 rozwinięć/tick | 0,358 / 1,63 / 4,12 | 1,26 ms | 3,5 / 30 ticków |
| A\* + skoki | 3000 rozwinięć/tick | 0,999 / 1,59 / 2,35 | 1,60 ms | 2,7 / 19 ticków |
| HPA\* 16×16 | brak | 0,317 / 1,53 / 5,25 | 26,0 ms | — |
| **HPA\* 16×16** | **3000 rozwinięć/tick** | **0,294 / 1,68 / 2,42** | **1,83 ms** | **1,4 / 15 ticków** |
Walidacja ścieżek znacznikami regionów obniżyła medianę ticka 2–3× (A\*: 0,42 → 0,12 ms) przy tej samej liczbie przeplanowań.

**Rekomendacja: HPA\* 16×16 + `NavPlanner` + walidacja regionami.** Uzasadnienie: (1) wszystkie trzy algorytmy dają
ścieżki optymalne, więc rozstrzyga najgorszy przypadek, a ten wygrywa HPA\*: globalne p95 2,4× i „brak ścieżki” p95
2,3× lepsze niż A\* w grodzie (nieosiągalne cele są w grze częste — graf jest skierowany: pułapki, urwane drabiny);
(2) klaster 16 dzieli 720 bez reszty i ma 4× tańszą przebudowę w szczycie niż 32 (p95 0,36 vs 1,40 ms przy kopaniu
co tick), a 32 wygrywa tylko globalne zapytania (o 1–30%); (3) skoki JPS+ błyszczą w rzadkich chodnikach (lokalne 0,005 ms),
ale w gęstym grodzie przebiegi rwą się co 12 kolumn i zysk znika; (4) A\* ważony — czas w granicach szumu (od −18% do +30% względem A\*) za cenę do 8,4% dłuższych
ścieżek — odrzucony. **Budżet M3** („200 krasnoludów < 4 ms/tick” dla całej symulacji): nawigacja mieści się w
≈ 0,3 ms mediany i ≤ 2,5 ms w szczycie; aby zostawić zapas dla reszty symulacji, ustawić budżet kolejki na
**2000 rozwinięć/tick** (szacunek: szczyt ≈ 1,6 ms) i potwierdzić w M3 na prawdziwym generatorze.

### 2.4 Percepcja (zarys do `src/sim/ai/perception`)
- **Wzrok**: linia widzenia DDA po kaflach (lita skała i zamknięte drzwi zasłaniają), zasięg = `bazowy × f(światło)`
  odczytane z pola światła (`lightfield.ts`); w ciemności krasnolud widzi 3 kafle, potwór ze zmysłem ciemności 8.
  Gobliny „ślepnące w świetle”: w kaflu oświetlonym ponad próg zasięg ×0,4 i kara ruchu (warstwa kar, §5.4).
- **Słuch**: hałas kopania, walki, maszyn rozchodzi się Dijkstrą po kaflach z tłumieniem (powietrze 1/kafel, skała 3,
  woda 2), promień ≤ 24; budżet: jedno rozchodzenie na zdarzenie, wyniki w buforze z wygasaniem.
- **Pamięć**: ostatnia znana pozycja celu, wygasa po 30 s (stan „sprawdź”), pamięć tras ucieczki (wejście najazdu).
- **Bez wszechwiedzy**: potwór planuje do *zapamiętanej* pozycji, a przeplanowuje dopiero po nowym bodźcu.

### 2.5 Taktyka (zarys)
- **Najazd goblinów** (wypierani przez Przebudzenie, przychodzą z dołu): grupa 4–12 rusza z tunelu wejścia do celu
  „łup” (magazyn, skarbiec), omijając Palenisko i straż; trasa po ciemku (kara za oświetlone kafle ×2–4), drzwi drewniane
  wyważane (koszt w profilu ×8 → wybierają inne wejście, jeśli jest), przy ≥ 2 trasach dzielą się (druga trasa = ta sama
  kwerenda z karą na kaflach pierwszej) i flankują. Ucieczka: straty ≥ 40%, śmierć herszta albo rozbłysk światła; łup
  niosą z powrotem do tunelu wejścia. Czytelność: bębny i gasnące pochodnie na 10–20 s przed wejściem.
- **Wilki nocą**: osaczanie — każdy wilk dostaje inny kafel podejścia (wiele celów + rezerwacje), unikają ognia.
- **Bossowie**: smycz (region areny jako maska celów; poza areną powrót), fazy, zapowiedź ataku ≥ 0,8 s, duże ciała
  (`height` 3–4); szerokość > 1 kafel — propozycja mapy prześwitu (clearance) w M4.
- **Krasnoludy w zagrożeniu**: ucieczka = kwerenda wielocelowa do „bezpiecznych” kafli (oświetlone, przy straży).

## 3. Parametry strojenia i profile zachowań
| Parametr | Typ | Rola | Wpływ zmiany |
|---|---|---|---|
| `height` | int 1–4 | wysokość ciała (wolne kafle nad stopami) | większy = mniej przejść; troll/boss nie wejdzie do niskich chodników |
| `crawl`, `crawlMul` | bool, ×≥1 | przeciskanie się przez szczeliny 1 kafla | wyłączenie = szczeliny stają się barierą (styl „dziki stwór”) |
| `maxDrop` | int ≤ 15 | najwyższy bezpieczny zeskok | wyżej = więcej skrótów w dół i jednokierunkowych tras (gobliny 4 > krasnoludy 3: czytelny atut wroga) |
| `ladders`, `stairs` | bool | czy korzysta z drabin / schodów | wyłączenie (wilk, troll) = drabina jest barierą obronną |
| `swim`, `deepLevel`, `wadeLevel` | bool, 0–255 | woda: pływanie, próg głębokości, próg brodzenia | hełm nurka otwiera Zatopione Głębie; niższy próg = woda groźniejsza |
| `lavaOk` | bool | lawa przejezdna (salamandry, chochliki) | wrogi skrót przez rzeki lawy |
| `links` | maska bitów | lina / most / winda / tory | gobliny bez wind: winda to bezpieczna oś grodu |
| `cost.walk … stairDown` | ms | czasy ruchów (prędkość profilu) | proporcje decydują, czy krasnolud woli schody, drabinę czy windę |
| `wadeMul`, `swimMul` | ×≥1 | spowolnienie w wodzie | omijanie płycizn vs brodzenie |
| `doorMul[3]` | ×, 0 = blokada | koszt przejścia drzwi (wyważanie) | 0 = drzwi zatrzymują; 4–12 = wróg woli inne wejście, ale przebije się |
| linki: prędkość, czekanie, pojemność | ms, int | windy, tory, liny, mosty | pojemność 1 liny = korek; zatłoczona winda → drabina |
| klaster HPA\* | 4–32 | rozmiar klastra | 16 zalecane; 32 = szybsze dalekie zapytania, droższe przebudowy |
| `NavPlanner.budget` | rozwinięcia/tick | budżet planowania | mniejszy = gładszy tick, dłuższe czekanie na plan (1–2 ticki średnio) |
| odstęp ponowień (`backoff`) | ticki 1→64 | po nieudanym planie | chroni CPU przed nieosiągalnymi celami |
| `maxExpansions` | int | limit pojedynczej kwerendy | odcina patologiczne kwerendy (status `BUDGET`) |
| region walidacji | 16×16 | znaczniki zmian dla ścieżek | mniejszy = mniej fałszywych walidacji, więcej pamięci |
| percepcja: zasięg wzroku, wpływ światła, promień słuchu, czas pamięci | kafle, ×, s | wykrywanie (§2.4) | dłuższa pamięć = uparty pościg; mocniejszy wpływ światła = pochodnie jako obrona |
| najazd: liczebność, próg morale, awersja do światła | int, %, × | taktyka goblinów (§2.5) | wyższy próg = najazdy do końca; większa awersja = oświetlenie realnie broni |

## 4. Pseudokod / szkielet logiki
```ts
// tick symulacji (AI): kolejność stała, brak zależności od czasu zegarowego
grid.sync();                                 // jedno przeliczenie zmian świata na tick
for (const d of deciders) d.update();        // zmiana zamiaru -> agent.go(cele) (plan do kolejki)
planner.run();                               // FIFO do budżetu rozwinięć, min. 1 plan na tick
for (const a of agents) a.tick(50);

// NavAgent.tick(dt) — bez pętli decyzyjnych
if (state === BLOCKED) { if (--retryIn <= 0) plan(); return; }        // odstęp 1, 2, 4 … 64 ticki
if (state !== MOVING) return;
if (grid.version !== seen) {
  if (!grid.standable(p, cell)) {                                     // podłoże znikło (wykop, zawał)
    land = grid.landing(p, x, y); if (land < 0) return LOST;          // lawa / głęboka woda
    falls++; lastFall = grid.lastFall; cell = land; plan(); return;   // obrażenia: lastFall > maxDrop
  }
  if (pathTouched(seen) && !pathValid()) { replans++; plan(); }       // O(regionów), potem O(krawędzi)
  seen = grid.version;
}
while (budget > 0 && step + 1 < path.length) {                       // ruch po krawędziach w czasie
  if (move is LINK && !riding) grid.reserve(group);                   // miejsce w windzie / na linie
  need = grid.edgeCost(...) - progress; ...                           // koszt na żywo (kolejka windy)
}

// NavPlanner.run()
while (queue && (served === 0 || spent < budget)) spent += queue.shift().planNow();

// decyzja goblina (histereza zamiast ping-ponga)
score.flee = losses*2 + lightHere*1.5 - (carryingLoot ? 0.5 : 0);
if (state !== FLEE && score.flee > 1.2) enter(FLEE);                  // wejście przy 1,2 …
if (state === FLEE && score.flee < 0.6 && timeInState > 3 s) leave(); // … wyjście dopiero przy 0,6
```

## 5. Edge cases, wydajność i debugowanie

### 5.1 Konkretne problemy i rozwiązania
1. **Pułapki jednokierunkowe** (zeskok do dołu, urwana drabina, przepaść): graf jest skierowany, więc planer nigdy nie
   wejdzie w pułapkę, chyba że cel jest w środku. Testy: „drabina urwana” (dwa szczeble = tylko w dół, jeden = obie
   strony), „zeskok za wysoki” (krasnolud 3 odmawia 4 wierszy, goblin schodzi, ale nie wraca).
2. **Wybuch planowania** (wczytanie gry, zawał, 200 dotarć w jednym ticku): synchronicznie 26–45 ms → kolejka z budżetem
   rozwinięć: pierwszy tick 1,3–1,8 ms, szczyt 2,4 ms (HPA\*), średnie czekanie 1,4 ticka.
3. **Nieosiągalne cele palą CPU**: A\* przeszukuje całą składową (do 1,4 ms p95); HPA\* rozstrzyga na portalach
   (0,6 ms p95), agent cofa się wykładniczo (1→64 ticków), gameplay powinien czarnolistować zadanie po 3 porażkach.
4. **„Ping-pong” przeplanowań przy kopaniu co tick**: przeplanowanie tylko, gdy zniknęła krawędź na *pozostałej*
   trasie (nie przy zmianie kosztu), a walidacja startuje wyłącznie, gdy zmienił się region 16×16 na trasie.
5. **Zawał na trasie w trakcie ruchu**: agent przeplanowuje od razu (nie dopiero przy przeszkodzie), wraca do węzła
   startowego krawędzi — test „zawał przecinający ścieżkę”; bez obejścia → `BLOCKED` z odstępem.
6. **Stłoczenie** (wszyscy do jednej drabiny / jednego miejsca pracy): kwerendy wielocelowe + rezerwacje miejsc
   (gameplay); pojemność linków (lina 1, most 3) z kosztem kolejki; proponowana miękka kara za zajęte kafle drabiny.
7. **BUG-003** (stary `fill()` zostawiał `fluidKind` bez wody): nawigacja czyta wodę tylko przy poziomie > 0 —
   test na stanie wpisanym ręcznie. **BUG-006** (`worldH` 480 vs 720): moduł bierze rozmiar ze świata, testy i benchmark
   działają na 224×720; klaster 16 dzieli 720 (45 rzędów), klaster 32 obsługuje niepełny ostatni rząd (16 wierszy).

### 5.2 Testy (`tests/sim/nav.test.ts`, 29, < 1 s)
Reguły ruchu (chód, stopień 1, brak stopnia 2, wierzch drabiny, schody w obie strony, pomosty, czołganie, drzwi, woda,
lawa, lot, wspinacz, heurystyka ≤ kosztów), przypadki brzegowe F2-4 (brak ścieżki, cel w powietrzu + `landing`, drabina
urwana, zeskok za wysoki, aktualizacja po wykopaniu = pełna przebudowa, zawał w trakcie ruchu → przeplanowanie, wykopanie
podłogi pod idącym → upadek z wysokością, cel/start na granicy mapy, kwerenda wielocelowa do miejsca pracy, kolejka
planowania deterministyczna), linki (lina obie strony, troll bez lin, zatłoczona winda → drabina, wyłączona winda,
heurystyka przy szybkim torze), arena (łąka → tunel, warsztat, jaskinia granitowa, grota grzybowa: zgodność algorytmów),
kopalnia 224×720 (rozmiar, determinizm, 80 losowych kwerend: te same statusy i koszty dla A\*, skoków, HPA\* 16 i 32,
ważony A\* ≤ 1,5× optimum; 120 zmian → lokalnie = od zera, także dla HPA\* i skoków).

### 5.3 Narzędzia debugowe — propozycja do laboratorium (do wykonania przez engine-graphics)
- `lab.html?nav=1`: nakładka kafli stawialnych (zielone), strzałki ruchów, **krawędzie jednokierunkowe na czerwono**
  (zeskoki bez powrotu, urwane drabiny), wysokość zeskoku jako cyfra, linki jako łuki z pojemnością/obciążeniem.
- `&nav=hpa`: granice klastrów i portale; `&nav=why&from=…&to=…`: „dlaczego brak ścieżki” — kafle, z których cel jest
  osiągalny (wsteczna Dijkstra), i najbliższy punkt zbliżenia od startu.
- Ścieżka każdego agenta kolorem stanu (`MOVING/WAITING/BLOCKED`), licznik przeplanowań z przyczyną, wykres długości
  kolejki planowania i ms na tick. Mapa PNG: `NAV_BENCH=1 NAV_MAP_OUT=mapa.png` (kafle stawialne, drabiny, schody,
  pomosty, woda, końce linków).

### 5.4 Proponowane zmiany modelu świata i decyzje do podjęcia
- `World.infra: Uint8Array` (kod `INFRA` + flagi orientacji/zamknięcia) zmieniany przez jedną ścieżkę mutacji i logowany
  w pierścieniu — nawigacja przejmie go zamiast własnej kopii (`NavGrid.infra`).
- Rodzaj zmiany w pierścieniu (teren / płyn / mgła) — dziś nawigacja porównuje stan kafla, by pominąć odsłonięcia mgły.
- Rejestr budowli-połączeń (windy, zajezdnie, liny, mosty) jako encje z przystankami → `addLift/addRail/...`.
- `CONFIG.worldH = 720` (BUG-006); rozmiar klastra nawigacji 16 (dzieli 224 i 720).
- Warstwa kar (zarodniki, światło dla goblinów, strefy walki) jako `Uint8Array` dodawana do kosztu wejścia — zmiana
  oznacza klastry HPA\* jako brudne, więc aktualizować ją rzadko (co 1 s), nie co tick.
- **Do decyzji level-systems-designera**: (a) czy krasnolud ma przekraczać szczelinę 1 kafla — dziś dół szeroki na 1
  i głęboki ≥ 2 przecina chodnik, a klatka schodowa 45° wycięta w podłodze też go przecina (generator testowy stawia
  schody przy końcach chodników); (b) most linowy jako link (nie da się na nim stanąć, ma limit obciążenia) czy pokład;
  (c) zeskok 3 vs 4 dla goblinów jako cecha projektowa; (d) docelowa gęstość grafu — gród 10 tys. węzłów był
  najtrudniejszy; duże jaskinie generatora 2.0 podniosą tę liczbę (HPA\* to zniesie, A\* nie).
