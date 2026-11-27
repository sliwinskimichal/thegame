# Generator świata 2.0: specyfikacja jako dane (F2-2)

> Rola: level-systems-designer · Status: specyfikacja i metryki gotowe, generator do napisania w M2.
> Dane: `src/content/worldgen.ts`. Reguły pochodne: `src/world/worldgenRules.ts`. Metryki: `src/world/worldgenMetrics.ts`.
> Testy: `tests/content/worldgen.test.ts` (24) i `tests/world/worldgenMetrics.test.ts` (14).
> Projekt poziomów: `docs/narrative/05-level-systems.md`. Kafel ≈ 1 m, głębokość = wiersze pod równiną.

## 1. Makro-struktura i topografia

**Rozmiar świata (BUG-006): 224 × 736** = 40 wierszy nieba i góry + 680 biomów + 16 wierszy dna ze skały
macierzystej (`bedrock`, kilof 9). Potwierdzam propozycję producenta:
- chunk 32 dzieli obie osie (7 × 23), klaster nawigacji 16 też (14 × 46). Nie ma niepełnego chunka na dnie,
  więc render i brudne regiony nie potrzebują przypadku brzegowego;
- E3: budżet **600 ms**, czyli ten sam koszt na kafel (3,6 µs) co dzisiejsze 400 ms dla 224 × 480;
- E4: pole światła 224 × 720 liczy się w 13,9 ms (pomiar QA), przy 736 wierszach ok. 14,2 ms, poniżej budżetu 50 ms;
- dno: 16 wierszy nieprzebijalnej skały pod Komorą Serca czyta się jako koniec świata, a kula komory nie
  dotyka krawędzi siatki.

Odrzucone: 720 (720 % 32 = 16, czyli niepełny chunk) i 768 (+4,3% kafli bez potrzeby). 768 wróci, jeśli
przyjmiemy Gniazdo Burz z 05 §5, bo potrzebuje nieba nad szczytem. Krawędź krateru leży 36 kafli nad
równiną, a nad nią zostają 4 wolne wiersze: `NavGrid` stawia krasnoluda tylko w wierszu y ≥ 0, więc na
szczycie potrzebny jest zapas.

```
głęb.     | skrzydło zachodnie (x 0–144)            | Gardziel (oś x≈150, ±4)            | skrzydło wschodnie (x 157–223)
-40…-37   | niebo (min. 4 wiersze nad kraterem)     |                                    |
-36       |                    stok 18–38° ↗        | krawędź krateru, czop bedrock 3    | ↘ stok
  0       | łąka: ■wóz x 14–30, ponór x 44–52, bór  |                                    | stok wschodni
  0–20    | PODGÓRZE (gleba): ✕Wilczy Wąwóz         | szyb od −28                        |
 20–100   | WAPIENNE PROGI: ■Sala Pierwszego Progu  | okno W 36–41 · okno E 74–79        | ✕Grota Królowej Nietoperzy 70–95
          | 24–30, Stary Szyb 0–24, Kanał Ponoru    |                                    |  Komin Popiołu 30–70
100–190   | GRANIT: ✕Gniazdo Matki 150–170,         | okno E 117–122 · okno W 140–145    | ■Sala Tronowa 112–126
          | Przedsionek Pieczęci                    | ═══ Pierwsza Pieczęć 150 ═══       |
190–280   | GROTY: ■Wielka Grota 196–226            | okno W 204–209 · okno E 246–251    | ✕Leże Królowej Pajęczyn 240–275
280–370   | GŁĘBIE: ■Przystań 300–312, Morze 306–340| ═══ Pieczęć Wodna 300 ═══          | ✕Zatopione Archiwum 344–362
          |                                         | okno W 312–317 · okno E 340–345    |
370–460   | KRYSZTAŁOWE: ✕Stacja pomp 424–452       | okno E 392–397 · okno W 430–435    | ■Geoda Katedralna 376–416
460–550   | MAGMA: ■Kopuła Popielnych 478–502       | ═══ Brama Popiołu 470 ═══          | ✕Tunele Robaka 520–545
          |                                         | okno W 486–491 · okno E 520–525    |
550–640   | PRASTARE: zamek śpiewany W 606–611      | zamek E 568–573 · ✕Sala Odźwiernego| ■Archiwum Ruin 558–582
          |                                         | ═══ Brama Serca 640 ═══            |
640–680   |                ✕ Komora Serca (kula 36) z Kowadłem, na osi                |
680–696   | dno: skała macierzysta (wiersze 720–735)                                     |
```
■ hub biomu · ✕ legowisko bossa. Każdy biom ma hub po jednej stronie Gardzieli i legowisko po drugiej.

**Gardziel** to szyb szerokości 6–10 kafli. Obie ściany mają po 2 kafle kamienia Prakowali (dziś `bedrock`).
Oś meandruje o ±4 kafle na fali 120. Cztery pieczęcie dzielą szyb na segmenty: S0 (krater–150: Progi
i górny granit), S1 (Groty), S2 (Głębie i Kryształowe), S3 (Magma i Prastare), S4 (Serce). Każdy biom
1–7 ma okno w obu ścianach w jednym segmencie i to tworzy zygzak: hub → okno po swojej stronie → szyb →
okno naprzeciwko → legowisko. Okno zamyka czop skały gospodarza grubości 2 kafli. Przez czop przechodzi
czerwony puls (światło pokonuje do 2 kafli skały, E4), ale przebić go można dopiero kilofem tego biomu.
W Prastarych okna zamykają zamki śpiewane poziomu 3 i 4. Otwarta pieczęć łączy segmenty: to nagroda
logistyczna i dostęp do górnych okien kolejnego biomu.

**Linie prowadzące** (`LEADING_LINES`):
- puls przez czopy;
- upad warstw 2–6° ku osi, wzdłuż którego biegną żyły i pokłady;
- szlak królestwa w biomach 1–6: chodniki, schody i rdzawe tory z huba do okna, 30–50% długości to ruiny
  torów. Szlak jest przechodni w dół (zeskoki do 3), a na 1–3 zeskokach powrót wymaga drabiny, co daje
  pierwszą tanią inwestycję;
- poziom jak struna grobla Prakowali w Prastarych;
- łańcuch wody: strumień → ponór → kanał krasowy → szczeliny → morze → kominy pary;
- 1–2 okna zapowiedzi na każdej granicy biomów (ściana 2 kafli, przez którą widać światło biomu niżej).

## 2. Ekonomia zasobów: gęstości, podaż a popyt

Gęstość to kafle złoża na 1000 litych kafli biomu (‰). Budżet wizualny wynika z tego, że nasycony kolor
niesie informację (VISION §2.1): na biom najwyżej 120‰ złóż i 50‰ strategicznych, a lokalnie w każdym
plasterku pasa najwyżej 300‰ (test).

| Biom | powszechne (‰, żyła w kaflach) | strategiczne (‰, żyła) |
|---|---|---|
| Podgórze | glina 35 (15–40), piasek 30 | miedź 16 (12–20) |
| Progi | wapień muszlowy 20, węgiel 40 (15–40), glina 24 | miedź 20, cyna 10 (6–12), saletra 4 (4–10) |
| Granit | węgiel 35 | miedź 14, żelazo 14 (10–25), galena 5, sfaleryt 5, kwarc 6 |
| Groty | węgiel 30 | żelazo 12, srebro 5, siarka 4 (przy zarodnikach) |
| Głębie | piasek 30 (dno), sól 10 (20–50) | żelazo 12, srebro 5, nikiel 4, złoto 2 |
| Kryształowe | — | kwarc 6, srebro 5, kobalt 4, ametyst 3, mroźny kryształ 3, złoto 2, szafir 2 (8–20) |
| Magma | obsydian 20 (przy lawie) | siarka 4, żaryt 4, złoto 2, rubin 2 |
| Prastare | — | runokamień 4, złoto 3, ametyst 2, adamantyt 2 (2–6), lśnit 0,6 (2–5, dno pasa) |
| Serce | brak złóż z założenia: to arena finału | — |

**Zmiany względem 05 §2.2:** miedź 12 → 16–20‰, cyna 5 → 10‰, węgiel 30 → 40/35‰, żelazo 10 → 12–14‰,
złoto 1,5 → 2–3‰. Test „podaż Aktu I” wymaga, by podaż w Podgórzu i Progach pokrywała popyt poziomów 0–1
na glinę, piasek, miedź, węgiel, wapień i saletrę. Przy gęstościach z 05 miedź pokrywała tylko 1,1× tego
popytu.

**Serce bez złóż:** `DEPOSIT_RULES.heart = []`, a `NO_DEPOSIT_BIOMES = ['heart']`. Przebieg złóż losuje przez
`weightedOrNull`, który zwraca `null` zamiast wyjątku (`Rng.weighted([])` rzuca; test QA).

**Podaż a popyt (najważniejsze ustalenie, do systems-designera).** Porównałem podaż (gęstość × lite kafle
biomu z ramy × `amount`) z popytem ukończenia gry. Popyt to rozwinięcie wydatków modelu balansu do surowców
kopalnych najtańszą recepturą (`tests/content/rawDemand.ts`): księgi węzłów ścieżki ukończenia, budowle
(produkcyjne ×2), sprzęt wyprawy, straż, kilofy, infrastruktura kolonii na każdy poziom i raty Weksla.

| surowiec | podaż | popyt | × | | surowiec | podaż | popyt | × |
|---|---|---|---|---|---|---|---|---|
| rubin | 29 | 1 417 | 0,02 | | żelazo | 1 140 | 5 276 | 0,22 |
| runokamień | 57 | 1 270 | 0,05 | | galena | 174 | 652 | 0,27 |
| złoto | 130 | 2 458 | 0,05 | | kwarc | 393 | 1 384 | 0,28 |
| lśnit | 9 | 144 | 0,06 | | miedź | 1 208 | 3 963 | 0,30 |
| ametyst | 75 | 1 196 | 0,06 | | nikiel | 106 | 334 | 0,32 |
| mroźny kryształ | 92 | 1 446 | 0,06 | | wapień | 652 | 2 015 | 0,32 |
| adamantyt | 29 | 414 | 0,07 | | cyna | 326 | 533 | 0,61 |
| obsydian | 590 | 4 727 | 0,12 | | żaryt | 59 | 78 | 0,76 |
| węgiel | 3 360 | 18 866 | 0,18 | | kobalt / szafir | 123 / 31 | 119 / 24 | 1,0 / 1,3 |
| srebro / sfaleryt | 426 / 174 | 2 388 / 928 | 0,18 / 0,19 | | piasek / glina | 923 / 1 129 | 297 / 306 | 3,1 / 3,7 |

Przyczyną są receptury ksiąg badań: `ember_codex` zużywa 2 obsydiany i 1 rubin, `rune_tome` 1 runokamień
i sztabę złota, `crystal_tablet` mroźny kryształ, ametyst i sztabę srebra, `engineer_plans` 2 rudy żelaza.
Na każdy poziom drzewka trzeba setek ksiąg, a złoże daje 1–3 sztuki z kafla. Księgi odpowiadają za 60–100%
popytu na surowce głębi. Model balansu zakłada złoża nieskończone, więc tego nie widzi. Generator nie może
tego nadrobić, bo czytelny świat nie zmieści 10–50× więcej rudy: kolor przestałby nieść informację.
Propozycje (decyzja systems-designera i producenta):
1. księgi w partiach, np. `ember_codex` ×5 z jednej receptury, albo klejnot jako drobny składnik;
2. `amount` złóż powszechnych ×2–3 (węgiel, miedź, żelazo, obsydian): bogatszy kafel zamiast większej liczby kafli;
3. źródła odnawialne: obsydian z lawy i wody (biblia zagrożenia `lava` już to obiecuje), węgiel drzewny z drewna grzybowego;
4. strażnik w `tests/balance`: podaż ≥ 2× popyt na każdy surowiec. Generator potem stroi już tylko `DEPOSIT_RULES`.

Do tego czasu test `documents the raws…` trzyma listę 19 znanych deficytów i uruchomi alarm przy każdej zmianie.

## 3. Pętla ryzyka i nagrody: reguły rozmieszczenia

- **R1, żyły-matki:** są 3–5× większe od typowej żyły i dają ×3 urobku. Leżą najwyżej 12 kafli od rdzenia
  zagrożenia własnego biomu i co najmniej 30 kafli od huba. Liczby na świat odpowiadają 05 §2.2: miedź 3,
  cyna 2, żelazo 3, kwarc 2, srebro 2, złoto 2, pozostałe po 1.
- **Rdzenie zagrożeń** (`BANDS[].caves.hazardCores`) podają liczbę, promień i znak R4 widoczny z bezpiecznego
  miejsca, np. „turkusowa mgiełka i martwe ćmy”, „wilgotne zacieki i szum wody za ścianą”.
- **Odległości od huba:** złoża strategiczne co najmniej 15 kafli (powszechne mogą leżeć przy drzwiach),
  legowiska 40–80 kafli, spawny potworów co najmniej 24. Krążki Pamięci co najmniej 20 kafli od huba,
  a Krążki Prakowali tylko za zamkami lub konstruktami.
- **Start:** wóz stoi na płaskim placu x 14–30. W strefie obozu x 6–38 nie ma pustek do głębokości 25
  (E3) ani spawnów. W zasięgu wozu: ≥ 6 sosen w promieniu 45 kafli, po 2 krzaki jagód i kępy jęczmienia
  w promieniu 30, ≥ 8 kafli gliny w promieniu 30, ≥ 12 kafli miedzi w promieniu 70 (w tym wychodnia
  ≤ 6 kafli pod powierzchnią stoku), węgiel i wapień muszlowy w promieniu 90.
- **Zawał samouczka:** Sala Pierwszego Progu to naturalna, osiadła sala 14 × 6 na głębokości 24–30.
  Naturalny płaski bieg w wapieniu wynosi 2 × ⌊3 × 2,5⌋ = 14, czyli dokładnie szerokość sali: sala stoi
  przy starcie, a zawali się po poszerzeniu (wyzwalacz skryptu). Stary Szyb ma 2 kafle szerokości, prowadzi
  z łąki do sali, górne 3 kafle są zasypane i nie ma w nim drabin, bo samouczek uczy drabin.

## 4. Bramy progresji

**Miękkie** (`SOFT_GATES`, 18 wpisów: każde lokalne zagrożenie każdego biomu ma przeciwdziałanie z biblii
`HAZARDS[].counters`):

| Biom | zagrożenie: skutek | zapowiedź (R4) |
|---|---|---|
| Podgórze | nocne drapieżniki: ataki poza kręgiem światła | wycie z wąwozu o zmierzchu |
| Progi | ciemność −40% pracy; zawały hal > 6 kafli | nietoperze, gruz i spękany strop |
| Granit | zalanie ok. 200 kafli w 30 s | zacieki, szum wody za ścianą |
| Groty | zarodniki co 5 s; jad | turkusowa mgiełka; kokony |
| Głębie | 20 s oddechu; zalania | czarna toń, kapiący strop |
| Kryształowe | wychłodzenie w 90 s; mrok | szron, gasnące kryształy |
| Magma | oparzenia w 60 s; wylewy; opary | drżące powietrze, poświata, siarka |
| Prastare | groza; konstrukty; ciemność | drżąca kreska, stukot |
| Serce | groza, żar, ciemność naraz | puls dna Gardzieli |

**Twarde** (`HARD_GATES`, 11 wpisów):
- kilof: Progi 1 (krzemienny), Granit 2 (brązowy), Kryształowe 3 (stalowy), Magma 4 (kobaltowy),
  Serce 5 (adamantowy). Pod każdą granicą z bramą kilofa leży czapa bez pustek o grubości 2–4 kafli skały
  gospodarza;
- pieczęcie: Pierwsza (KM2 albo ładunki), Wodna (hełm nurka i pompy), Brama Popiołu (QDD-L8 i chłodnice),
  Brama Serca (KM4 i Klucz Serca; punkt bez powrotu);
- zamki śpiewane okien Prastarych;
- przepaście grot do 20 kafli (most linowy).

Test sprawdza istnienie każdego id: przedmiotu, budowli, infrastruktury, badania i zadania w `04-quests.md`.

## 5. Parametry dla generatora i metryki weryfikacji

**Przebiegi** (`PASSES`): rama i mapa biomów → powierzchnia → warstwy → Gardziel → landmarki → jaskinie →
filary → płyny → złoża → okładziny → obiekty → spawny → gwarancje. Każdy przebieg losuje z własnego
`rng.fork(nazwa)`, więc zmiana jednego przebiegu nie przetasowuje pozostałych. Szum dostaje seed
`hash(seed, przebieg)` i nie używamy `Math.random`. Przebieg gwarancji naprawia start, zasięg, pokrycie
złóż, szlak i stropy, a metryki sprawdzają wynik jeszcze raz.

**Reguła sklepienia.** `StructureSystem` przy starcie ocenia każdy wiersz, więc każda naturalna pustka
musi od razu spełniać jego wzór nośności, inaczej zawali się w pierwszym ticku:
- formy płaskie: szerokość ≤ 2⌊maxSpan/2 · 2,5⌋, a przy wysokości ≤ 2 dwa razy więcej;
- sklepienia: (w/2)·√(2/h) ≤ ⌊maxSpan/2 · 2,5⌋;
- długie chodniki dostają zwężenia (naprzemiennie przecisk i próg) najwyżej co 15 kafli w wapieniu;
- morze to łańcuch 3 sklepień o szerokości 32–46 z żebrami i wyspami;
- rzeki lawy mają przewężenia co 20–30 kafli;
- Wielka Grota to dwa sklepienia;
- strop pustki buduje `roofRock` pasa: piasek, węgiel ani grzybnia nie trafiają do stropu.

Test rasteryzuje największą instancję każdej formy i porównuje wynik z dyskretnym modelem stropów.

| Parametr (dane) | Typ | Wartość | Uzasadnienie | Pomiar |
|---|---|---|---|---|
| `WORLD_FRAME` | kafle | 224 × 736, równina w wierszu 40, dno 16 | §1 | test ramy |
| `BANDS[].transition / undulation / dipMax` | kafle | 0–6 / amplituda 0–7, fala 50–90 / 0–9 | granice nie są prostymi pasami (E3), każdy pas zachowuje ≥ 50% grubości | `minThickness` |
| `BANDS[].cap` | kafle | 2–4 pod bramą kilofa | twarda brama: brak naturalnej drogi w dół | `gateIntegrity` = 0 |
| `caves.voidShare` | udział | Podgórze 2–6%, Granit 6–10%, Groty 22–30%, Głębie 25–35% | gród gęsty, dzika głębia rzadka i monumentalna (VISION) | `voidShares` |
| `GORGE.width / wall / windows / seals` | kafle | 6–10 / 2 / 14 okien / 4 pieczęcie | zygzak, nagroda logistyczna | test segmentów |
| `DEPOSIT_RULES[].density` | ‰ | §2 | tempo ekonomii, Akt I bez głodu | `depositDensities` ±20% |
| `MOTHER_LODE` | × / kafle | 3–5× rozmiar, ×3 urobek, ≤ 12 od zagrożenia, ≥ 30 od huba | R1 | `placementCheck` |
| `HUB_SAFE_RADIUS`, `LAIRS[].minFromHub` | kafle | 24; 40–80 | baza nie jest areną | `placementCheck` |
| `START.reach` | kafle | 30–90 | samouczek ok. 60 min bez szukania | `startCheck` |
| `NAV_DESIGN` | — | §6 | spójność z nawigacją | test profili |
| `ACCEPTANCE.genMs` | ms | 600 | E3 przy 224 × 736 | test czasu generatora (M2) |

**Metryki akceptacji M2** (każdy seed turnieju; `evaluateWorld` zbiera je w jeden raport):

| Metryka | Funkcja | Próg |
|---|---|---|
| pokrycie złóż: każde złoże z biblii w każdym swoim biomie (żyła ≥ 2 kafle) | `depositCensus` + `depositCoverage` | 100% |
| gęstość złoża w biomie | `depositDensities` | ±20% celu |
| udział pustek w biomie | `voidShares` | zakres `voidShare` |
| hub → okno Gardzieli: `NavGrid` + `HpaStar` 16 (profil krasnoluda, zeskok `CONFIG.maxSafeDrop`, infrastruktura generatora) | `gorgeAccess` | FOUND w biomach 1–7; raportuje koszt, zeskoki bez powrotu i drogę powrotną |
| bramy kilofa: od wozu z kilofem T−1 nie da się dokopać do rdzenia biomu | `gateIntegrity` | 0 kafli |
| stropy pękające przy starcie | `roofCheck` | 0 |
| płyn w skale, płyn „w powietrzu”, lawa przy wodzie | `fluidCheck` | 0 |
| plac, strefa obozu, zasięg zasobów, sala zawału | `startCheck` | brak uwag |
| żyły-matki, odległości od hubów, legowiska, spawny, pieczęcie | `placementCheck` | brak uwag |
| rozmiar grafu nawigacji | `navStats` | 5–12 tys. węzłów |
| determinizm | `worldHash` | ten sam seed daje ten sam skrót |

**Wyniki:** 24 testy danych i 14 testów metryk przechodzą, `npm run build` jest zielony. Metryki na świecie
224 × 736 zajmują ok. 50–100 ms (spis złóż 5 ms, stropy 6 ms, bramy 32 ms, graf nawigacji 18 ms), czyli
mieszczą się poza budżetem generatora. Turniej 10 seedów odbędzie się, gdy generator powstanie; wynik trafi
do `docs/variants/04-worldgen.md` (przebiegi zaliczone, marginesy gęstości, mapy 3 seedów).

## 6. Decyzje dla nawigacji (odpowiedzi dla ai-programmera, dane: `NAV_DESIGN`)

**(a) Szczelina 1 kafla: tak, przekrok.** Krasnolud, nurek, goblin i wilk przekraczają szczelinę szeroką na
1 kafel. Warunki: oba brzegi stawialne w tym samym wierszu i 2 wolne kafle nad szczeliną. Koszt to 2 ruchy
chodu + 100 ms. Troll nie przekracza, więc rów 1 kafla staje się tanią zaporą na trolle. Uzasadnienie:
- szczelina 1 kafla czyta się jak pęknięcie, nie przepaść;
- szyb z drabiną i klatka schodowa w podłodze nie mogą przecinać chodników gęstego grodu;
- barierą jest dopiero szczelina od 2 kafli (pomost albo most).

Generator nie stawia na szlaku szczelin szerokich na 2 kafle, bo wyglądają na przekraczalne, a nie są.

**(b) Most linowy to połączenie (link), nie pokład.** Ma pojemność 3, rozpiętość do 20 kafli i nie da się
na nim stanąć ani budować. Uzasadnienie:
- nie zajmuje kafli, więc nie zamyka pionu Gardzieli: winda przejeżdża pod nim, a pomost by ją zablokował;
- limit obciążenia to wąskie gardło logistyki, które gracz później wymienia na pomost albo windę;
- gobliny nie korzystają z mostów (profil: tylko liny), więc most jest punktem obrony.

Generator robi przepaście z półkami-kotwami po obu stronach w tym samym wierszu (±1).

**(c) Zeskok goblinów 4 przy krasnoludach 3: świadomie.** To czytelny atut wroga: goblin skacze tam, gdzie
krasnolud potrzebuje drabiny. Najazd wycofuje się trasą bez powrotu dla pogoni, a gracz odpowiada
drabinami i drzwiami. Ograniczenia, żeby ryzyko było widoczne:
- szlak królestwa ma zeskoki najwyżej 3;
- naturalne półki 4 nie powstają w promieniu 24 kafli od hubów;
- wejścia najazdów generator znaczy kośćmi i zadrapaniami (R4).

**(d) Gęstość grafu.** Świeży świat ma mieć 5–12 tys. stawialnych węzłów (krasnolud) na 224 × 736: podłogi
jaskiń (ok. 20–25 tys. kafli pustek przy średniej wysokości 4–5) plus powierzchnia. Infrastruktura
generatora (schody i drabiny szlaku) to najwyżej 600 kafli, a na szlaku każdego biomu powinno być 6–12
rozwidleń. Gród gracza dokłada w późnej grze 10–15 tys. węzłów, więc szczyt wyniesie ok. 25 tys., czyli
2,5× gęsty gród z benchmarku. HPA* 16 jest na to właściwym wyborem, A* bez hierarchii nie. Pomiar:
`navStats` w każdym seedzie turnieju.

## 7. Otwarte kwestie

- **systems-designer:** podaż i popyt (§2): wydajność `amount`, receptury ksiąg, strażnik podaży. Gęstości
  T0–T1 podniosłem, reszta czeka na decyzję.
- **lead-narrative:**
  - nazwy robocze landmarków do akceptacji: Wilczy Wąwóz, Wodospad Śnieżnika, Kanał Ponoru, Stary Szyb,
    Przedsionek Pieczęci, Przystań Zachodnia, Tunele Robaka, Sala Odźwiernego, Komora Serca;
  - Zatopione Archiwum przeniosłem do zatoki wschodniej, żeby zachować zygzak (05: „dno, środek”);
  - Gniazdo Burz zostaje poza zakresem, bo wymaga świata 768.
- **gameplay-programmer:**
  - sala zawału ma 6 kafli wysokości, a stempel `maxHeight` 3, więc „4 stemple w 60 s” nie podeprą stropu:
    podest w sali albo stempel samouczkowy;
  - `warnSec` wapienia wynosi 30 s przy 60 s skryptu (`extendTimers`);
  - potrzebny materiał kamienia Prakowali (kilof 9) na ściany Gardzieli zamiast `bedrock` i rekwizyt Słupów
    Akordów;
  - wynik generatora (`WorldgenResult`: `biome`, `infra`, `layout`) obok `World`, docelowo `World.infra`.
- **ai-programmer:** mapy testowe 224 × 720 przejść na `CONFIG.worldH` (736); przekrok (a) do zaimplementowania.
