# Turniej nr 4 — model i ruch krasnoluda (F3-1, runda 1)

**Status: w toku — etap E1 (zespół krasnoludów pracuje na kontrakcie).** Wyniki, plansze i finaliści zostaną
dopisani po przebiegu E3. Lider: animator-ta; zespół i briefy: `docs/team/dwarf-team/BRIEFS.md`.

## 1. Pytanie

Z jakiej konstrukcji i w jakich proporcjach zbudować krasnoluda-robotnika, żeby w ilustrowanym przekroju
(baza i08 „Głębia warstw”, światło gry **L12** — decyzja właściciela 2026-11-28) gracz w 1 s odczytał **rolę** (nakrycie głowy + narzędzie + element na
plecach), **stan społeczny** (jeden akcent barwy) i **czy postać jest w świetle** — na zoomach Izba (~220 px),
Gród (~75 px) i Okolica (~24 px), w plamie lampy i na jej skraju — a 200 krasnoludów zmieściło się w budżecie?
Drugie pytanie (to samo stanowisko): czy rig proceduralny i cykle (spoczynek, chód, kopanie, wspinaczka,
noszenie) dają ruch „ciężki i pewny” bez ślizgania stóp i z czytelną antycypacją uderzenia. Trzecie (zasada
właściciela „świat skaluje się do modeli”): **jaka skala postaci** — wzrost w kaflach i w px na każdym zoomie —
daje najlepszą czytelność i detal; skala jest parametrem (`CHARACTER_SCALE`), świat i budowle dostosują się do wyniku.

## 2. Protokół

- **Kontrakt zespołu** (wspólny dla wszystkich wariantów): `src/render/anim/types.ts` (osie, kości, poza,
  wejścia z `path.moves` / `agent.progress` / zdarzeń symulacji, notify, animator), `src/render/characters/types.ts`
  (krasnolud jako dane: części, proporcje, rola, paleta, seed; siatka; renderer tłumu; ujęcia; metryki),
  `src/render/characters/direction.ts` (kierunek artystyczny jako dane, `referenceJoints`).
- **Jedna anatomia, wiele technik**: każdy wariant buduje te same części (karta `docs/art/concepts/dwarf.md`)
  inną techniką lub w innych proporcjach; ten sam rig, te same cykle, te same palety z tych samych seedów,
  te same materiały (płaska barwa 2–3 tony + obrys W1 o stałej grubości w px), to samo światło L12
  (`LAB_LIGHT_VARIANT`). Kontrakt v2 (2026-11-28): jednostki modelu + `CHARACTER_SCALE.worldPerModel`,
  zoomy z wysokości wzorcowego krasnoluda w px (`ZOOMS.dwarfPx`), LOD0 bez oszczędzania (miękki budżet 4000 tr.).
- **Stanowisko**: `dwarves.html` (własny świat: izba, tunel z przodkiem i szyb, korytarze pasków, ściana drabin,
  ciemny tunel z jedną pochodnią, sieć dla tłumu), łańcuch światła z laboratorium importowany bez zmian.
  Świat i kamery liczone ze skali i wysokości wzorcowej — identyczne dla wszystkich wariantów.
  Zrzuty 960×540 jako wycinki 1:1 ekranu 1080p (krasnolud ~218 / ~75 / ~24 px); szerokości kreski silnika
  przeskalowane ×2 do tej gęstości (`LAB_FRAME`).
- **Ujęcia** (identyczne dla każdego wariantu): `izba`, `grod`, `okolica`, `walk8`, `dig8`, `climb8`, `carry8`,
  `swiatlo`, `sil75`, `sil24`, `seq30` (opis w kontrakcie i briefie W3).
- **Zamrożony build** (vite build → serwer statyczny), sprawdzenie id wariantu, zero błędów konsoli.
- **Powtórzenie przebiegu**: `bash scripts/dwarf-e3run.sh <out> [warianty|all] ["scale=1.2&pxGrod=95"]`
  (build, `scripts/dwarf-tournament.mjs`, plansze `scripts/contact-sheet.py`, tabela
  `python3 scripts/dwarf-evaltable.py <out>` z podocenami metrycznymi czytelności i wydajności).

## 3. Warianty rundy 1 (12)

| id | Technika | Proporcje | Yaw | Co testuje |
|---|---|---|---|---|
| d01 | prymitywy wg karty | A „Kowadło” 3,4 gł. | 40° | kontrola — dosłownie tabela karty |
| d02 | bryły toczone i wyciągane | A | 40° | gładki obrys beczki, hełmu i butów |
| d03 | fasetowany low-poly | A | 40° | rysunkowa faseta vs koszt |
| d04 | wycinanka 2.5D | A | 0° (profil) | płaskie karty w 3 warstwach — najbliżej rysunku |
| d05 | figurka z drewna z fazami | A | 40° | „ciężka geometria podhalańska” w postaci |
| d06 | kontur 2D wyciągnięty z fazą | A | 25° | sylwetka projektowana w 2D, objętość „poduszki” |
| d07 | części instancjonowane | A (= d01) | 40° | bliźniak kosztowy d01 (inne wywołania rysowania) |
| d08 | glina SDF, jedna skóra | A | 40° | ciągła skóra z wagami 2 kości (objętość w stawach) |
| d09 | prymitywy | B „Beczka” 3,2 gł. | 40° | czy krąglej = słodziej |
| d10 | prymitywy | C „Słup” 3,6 gł. | 40° | czy wyżej = mniej krasnoludzko |
| d11 | prymitywy | A+ (barki 0,68, dłoń 0,16, broda 0,40) | 40° | przerysowane kowadło |
| d12 | prymitywy | 3,0 gł. | 40° | dolna granica wizji (strażnik przeciw chibi) |

Każdy wariant w 4 rolach: **hajer** (hełm-kopuła z kagankiem i kitką, kilof, tylnik), **cieśla** (kaptur ze
szpicem, topór, belka na barku), **tragarz** (opaska, nosidło z koszem nad barkami), **kowal** (czapa z osłoną
karku i okularem z miki, młot i szczypce, długi fartuch z przodu).

**Techniki w praktyce** (raport W1): jedna lista części (anatomia + ekwipunek ról z grupami tożsamości), techniki tylko
interpretują kształty; LOD1 strojone ręcznie nadpisaniami części, wspólny żeton LOD2 (trapez z butami, ≤ 60 tr.),
tułów eliptyczny (głębokość 0,74 szerokości), broda-klin z pasm przylegających do beczki tułowia.
- d01, d09–d12: prymitywy, segmenty z obwodu elipsy, gładkie normalne.
- d02: splajny beczki i spódnicy, głowa-jajo, nakrycia z profilu, kończyny z wybrzuszeniem, trzonki z gałką i okuciem.
- d03: 4–6 segmentów, płaskie cieniowanie, „struganie” wierzchołków z seeda.
- d04: profil części jako karta 0,02–0,032 w warstwach z −0,25 / 0 / +0,25; płaskie fartuchy w skrócie ~35°.
- d05: fazowane prostopadłościany i kliny, ośmioboki z fazowanymi końcami, kule strugane w ośmiokąty.
- d06: profil 2D wyciągnięty przez głębokość części z mocną zaokrągloną fazą.
- d07: siatki d01 w przestrzeni kości, osobny obrys na część (instancjonowanie części).
- d08: SDF + gładkie minimum, surface nets w łańcuchach, wagi 2 kości; tylko LOD0 (LOD1/2 jak d01).

## 3a. Ruch — wspólny dla wszystkich wariantów (W2)

| Klip | Sterowanie | Fazy i czasy | Notify | Okno przerwania |
|---|---|---|---|---|
| `idle` | czas, oddech 3–4 s | przenoszenie ciężaru, broda z opóźnieniem, odwiedzenie ud 14° (rozstaw stóp z karty) | — | zawsze |
| `walk` / `jog` | **droga** (faza = droga / krok podwójny) | blend po prędkości: chód → trucht z fazą lotu; miednica i nogi w profilu wzdłuż ruchu, tułów ku kamerze | 2 × `FOOT_DOWN` na cykl | zawsze (kontakt stopy) |
| `dig` | czas | **zamach 0,35 s → przytrzymanie 0,08 s → uderzenie 0,15 s → powrót 0,32 s**; narzędzie jako bryła w obu pięściach | `DIG_WINDUP`, `TOOL_SWOOSH`, `DIG_HIT` w klatce końca uderzenia, w punkcie lica kafla (błąd < 2 mm) | [trafienie, 1) i [0, 20% zamachu) |
| `build` | czas | rytm `dig` z młotem / toporem, belka cieśli odłożona | jak `dig` | jak `dig` |
| `climb` | **wysokość** (cykl = 2 szczeble) | każda kończyna 1 szczebel na ruch (60% taktu), biodra do drabiny, górny tułów skręcony 30° na prawy bok, narzędzia na plecach | 4 × `RUNG_GRAB` na cykl | między ruchami |
| `carry` | warstwa | pochylenie 8°, cięższy krok, `LOAD` widoczny tylko z ładunkiem | jak `walk` | — |
| `stunned`, `flee`, ledge, drop, land, ride | proste wersje rundy 1 | drop balistycznie, land z siłą od wysokości | `LAND` | — |

Pomiary (preset A): poślizg stopy podporowej 0,005% (chód 1,1 kafla/s) i 0,003% (2,5 kafla/s), szew cykli 0, stopy i dłonie
na szczeblach przy skalach 1,0 / 1,2 / 1,4; koszt animacji 200 krasnoludów 1,19 ms (Node, bundle), 0,68 ms przy
`setDetail(2)` dla Okolicy. **Kadencja przy 1,1 kafla/s: skala 1,0 → 2,95 kroku/s, 1,2 → 2,61, 1,4 → 2,42**
(karta: 2,22) — argument w rekomendacji skali (§7).

## 4. Metryki (automatyczne, `scripts/dwarf-tournament.mjs`)

| Metryka | Definicja | Cel |
|---|---|---|
| rozróżnialność ról 75 px / 24 px | 1 − IoU czarnych sylwetek par ról (wyrównanie środków ciężkości); min. para; trafność klasyfikacji najbliższym wzorcem spoczynku dla 8 póz × 4 role | min. para jak największa; trafność 75 px ≥ 90%, 24 px ≥ 75% |
| kontrast postaci do tła | średnie L\* wypełnienia vs pierścień 6–12 px poza obrysem, w plamie i na skraju | ΔL\* ≥ 15 |
| akcent | udział pikseli wypełnienia z C\* > 30 | ≤ 10% sylwetki |
| poślizg stóp | maks. prędkość stopy podporowej / prędkość chodu (chód koncepcyjny i 2,5 kafla/s) | < 2% |
| ciągłość cyklu | skok kości na szwie cyklu | ≤ 0,01 kafla |
| stabilność sylwetki | średnie i min. IoU kolejnych klatek 30 kl./s (`seq30`) | wysokie, bez zapadnięć |
| koszt | trójkąty na LOD (budżet 4000 miękki / 400 / 60), wywołania rysowania 1 vs 200, czas klatki 0 vs 200, ms animacji 200 | 200 krasnoludów w kilku wywołaniach |

## 5. Rubryka (ocena lidera, CLAUDE.md)

czytelność 25 · wow 25 · atmosfera 15 · spójność z wizją 10 · skalowalność 10 · wydajność 10 · oryginalność 5.
Czytelność i wydajność opierają się na metrykach; wow, atmosfera, spójność i oryginalność — na planszach
(Izba, Gród, Okolica, paski ruchu) z uzasadnieniem w tabeli ocen. Odrzucenie z urzędu: chibi (głowa > ⅓
wzrostu bez nakrycia), rola nieczytelna z sylwetki przy 75 px, podobieństwo do postaci z referencji lub innej gry.

## 5a. Przebieg prac zespołu

- **E1 (2026-11-28)** — odbiór: `docs/team/dwarf-team/E1-REVIEW.md`. Działają: 11 wariantów × 4 role × 3 LOD,
  rig z IK i lokomocją bez poślizgu (0%), stanowisko z 11 ujęciami (26 s na wariant), 200 krasnoludów w 8 wywołaniach
  rysowania. Do poprawy przed turniejem: odpowiedź materiału postaci na światło L12 (akcent C\* > 30 w 67–88%
  wypełnienia, strój za jasny), światło stanowiska za jasne, obrys rwany w L12, broda „deska”, kitka i kaganek jak
  rogi, żetony LOD2 bez szerokiej podstawy, trzymanie kilofa i topora.
- **Reguła ruchu (z E1)**: przy lokomocji miednica i nogi w profilu wzdłuż ruchu (stopy bez dryfu), tułów, broda
  i głowa skręcone ku kamerze o yaw wariantu; w spoczynku i przy pracy całe ciało pod yaw wariantu.

## 6. Wyniki

*(po E3: tabela metryk, tabela ocen, plansze `docs/variants/04-dwarf/`, finaliści)*

## 7. Konflikt do rozstrzygnięcia: prędkość chodu a anatomia (analiza lidera)

Nawigacja liczy chód krasnoluda jako **400 ms/kafel = 2,5 kafla/s** (`src/sim/nav`, model balansu). Karta konceptu
każe chodzić **„ciężko i pewnie”: 2 kroki / 0,9 s** przy nogach **0,30 kafla** (23% wzrostu).
- Długość kroku przy takiej nodze (udo + goleń ≈ 0,22, but 0,22 z przetaczaniem stopy): ~0,33–0,40 kafla →
  przy kadencji z karty prędkość **~0,75–0,9 kafla/s**.
- Liczba Froude'a v² / (g·L) dla L = 0,30 m: przy 0,8 m/s ≈ 0,22 (spokojny chód), przy 2,5 m/s ≈ **2,1 (bieg)**;
  naturalne przejście chód → bieg wypada przy Fr ≈ 0,5, czyli **~1,2 kafla/s**.
- Wniosek: przy 2,5 kafla/s każdy krasnolud w grodzie musiałby stale truchtać z kadencją ~4 kroków/s albo
  ślizgać stopami — oba wyniki łamią wizję („ruch ciężki i pewny”, „bez gagów”).
- **Rekomendacja** (do systems-designer + gameplay, decyzja game-director/producenta): chód **1,0–1,2 kafla/s**
  (~850–1000 ms/kafel) jako domyślny, trucht 2,0–2,5 kafla/s tylko dla ucieczki, alarmu i rozkazu „biegiem”;
  utratę przepustowości logistyki oddać przez tory, windy i tragarzy (to i tak oś postępu gry). Do tego czasu
  animator obsługuje cały zakres (blend chód ↔ trucht po prędkości, faza sterowana drogą — bez poślizgu).

## 8. Plan rundy 2 (szkic, do potwierdzenia po E3)

Runda 2 dopracowuje 2–3 finalistów i domyka **pełną maszynę stanów** na prawdziwej symulacji (`src/sim/dwarves.ts`).

**Stany i wejścia** (kontrakt `AS`, `AnimInput`, `AnimEdge`, `AnimEvent`):

| Stan | Wejście z symulacji | Klip / logika | Wyjście |
|---|---|---|---|
| IDLE | `SIM.IDLE`, brak krawędzi | `idle` + trzymanie wg roli, wiercenie z seeda co 6–12 s | każda krawędź, praca, zagrożenie |
| WALK | krawędź `WALK_L/R` | blend `walk` ↔ `jog` po prędkości krawędzi, faza z drogi | koniec ścieżki → IDLE (krok domykający na kontakcie stopy) |
| LEDGE | `STEP_UL/UR` (700 ms, półka 1 kafel) | wspięcie: dłonie na krawędzi półki → kolano → wstanie; korzeń po łuku | WALK / IDLE |
| STAIRS | `STAIR_*` (600 / 500 ms) | chód z IK stóp na stopniach (`probe.floorAt`) | WALK |
| DROP → LAND | `DROP_L/R`, `FALL` (`rows`) | odbicie / puszczenie szczebla, lot balistyczny, przysiad lądowania z siłą od `rows`; `fell.damage > 0` → STUNNED | IDLE / WALK |
| CLIMB | `UP` / `DOWN` (900 / 600 ms na wiersz) | `climb` plecami do kamery, faza z wysokości, wejście i zejście z drabiny jako osobne pół-cykle | WALK / IDLE |
| RIDE | `LINK` (winda, tory, lina, most) | stanie / trzymanie się / chód po moście | wg następnej krawędzi |
| DIG / BUILD | `SIM.WORK` + `WORK.DIG` / `BUILD` | `dig` / `build`, cel z `workX/workY` (przed stopami, przed głową, pod stopami, strop) | `digDone` → ostatnie uderzenie i powrót → IDLE |
| FLEE | `SIM.FLEE`, `danger = 1` | `jog` + osłona głowy, spojrzenie przez ramię | IDLE po wyjściu spod stropu |
| STUNNED | `SIM.STUNNED` | przysiad, kołysanie, wstawanie | IDLE |
| HIDDEN | `SIM.BURIED`, `SIM.DEAD` | nic nie rysujemy (tragedia przez odejmowanie); zgaszona lampka zostaje w świecie | `rescued` → STUNNED |

**Przejścia** (czasy blendu): domyślnie 0,15–0,2 s; do DIG/BUILD 0,15 s z dosunięciem stóp; do FLEE i HIDDEN
natychmiast lub 0,08 s; z DIG tylko w oknie przerwania (od trafienia do 20% kolejnego zamachu) — **gameplay czyta
`canCancel()`** i kończy akcję po uderzeniu (wymaga uzgodnienia z gameplay-programmer); zmiana kierunku = lustro
w klatce kontaktu stopy.

**Zdarzenia animacji** (dla vfx-artist i sound-designer, przez `drainNotifies`):

| Notify | Kiedy | Dane | Odbiorca |
|---|---|---|---|
| `FOOT_DOWN` | kontakt pięty (2 na cykl chodu) | pozycja stopy, siła (ładunek, trucht) | dźwięk kroku per podłoże, pył |
| `DIG_WINDUP` | start zamachu | pozycja narzędzia | dźwięk napięcia (opcjonalnie) |
| `TOOL_SWOOSH` | środek uderzenia | pozycja głowicy | świst |
| `DIG_HIT` | klatka uderzenia (koniec fazy 0,15 s) | punkt `strike` w świecie, siła (ostatnie uderzenie = 1) | iskry/pył (F3-2), dźwięk per materiał (F3-4), synchronizacja z `digCrack` |
| `RUNG_GRAB` | dłoń na szczeblu | pozycja dłoni | stuk drewna |
| `LAND` | lądowanie | siła od `rows` | tąpnięcie, pył |
| `PICK_UP` / `PUT_DOWN` | podjęcie / odłożenie ładunku | pozycja `LOAD` | dźwięk worka / kamienia |

**Synchronizacja kopania z symulacją**: liczba uderzeń na kafel = zaokrąglony czas kopania / długość cyklu;
cykl rozciągany ±15%, żeby **ostatnie uderzenie trafiło w `digDone`**, a pęknięcia `digCrack` (25/50/75%)
wypadły na kolejnych `DIG_HIT` — wymaga od gameplay odczytu postępu (`dig.progressAt`) i przewidywanego czasu.

**Integracja z silnikiem** (lista otwarta, uzupełniana raportem W3): materiał postaci i obrys skórowany jako
część stylu w `src/render/` (dziś kopia w `src/render/characters/render/`), lampki krasnoludów w polu światła
(dziś światła dynamiczne ≤ 12), obrys W1 postaci a kreska terenu (2,6 px w laboratorium vs 4 px w biblii).
