# Turniej nr 4 — model i ruch krasnoluda (F3-1, runda 1)

**Status: w toku — etap E1 (zespół krasnoludów pracuje na kontrakcie).** Wyniki, plansze i finaliści zostaną
dopisani po przebiegu E3. Lider: animator-ta; zespół i briefy: `docs/team/dwarf-team/BRIEFS.md`.

## 1. Pytanie

Z jakiej konstrukcji i w jakich proporcjach zbudować krasnoluda-robotnika, żeby w ilustrowanym przekroju
(baza i08 „Głębia warstw”, światło L00) gracz w 1 s odczytał **rolę** (nakrycie głowy + narzędzie + element na
plecach), **stan społeczny** (jeden akcent barwy) i **czy postać jest w świetle** — na zoomach Izba (~220 px),
Gród (~75 px) i Okolica (~24 px), w plamie lampy i na jej skraju — a 200 krasnoludów zmieściło się w budżecie?
Drugie pytanie (to samo stanowisko): czy rig proceduralny i cykle (spoczynek, chód, kopanie, wspinaczka,
noszenie) dają ruch „ciężki i pewny” bez ślizgania stóp i z czytelną antycypacją uderzenia.

## 2. Protokół

- **Kontrakt zespołu** (wspólny dla wszystkich wariantów): `src/render/anim/types.ts` (osie, kości, poza,
  wejścia z `path.moves` / `agent.progress` / zdarzeń symulacji, notify, animator), `src/render/characters/types.ts`
  (krasnolud jako dane: części, proporcje, rola, paleta, seed; siatka; renderer tłumu; ujęcia; metryki),
  `src/render/characters/direction.ts` (kierunek artystyczny jako dane, `referenceJoints`).
- **Jedna anatomia, wiele technik**: każdy wariant buduje te same części (karta `docs/art/concepts/dwarf.md`)
  inną techniką lub w innych proporcjach; ten sam rig, te same cykle, te same palety z tych samych seedów,
  te same materiały (płaska barwa 2–3 tony + obrys W1 o stałej grubości w px), to samo światło L00.
- **Stanowisko**: `dwarves.html` (własny świat: izba, tunel z przodkiem i szyb, korytarze pasków, ściana drabin,
  ciemny tunel z jedną pochodnią, sieć dla tłumu), łańcuch L00 z laboratorium importowany bez zmian.
  Zrzuty 960×540 jako wycinki ekranu 1080p w tej samej gęstości pikseli (krasnolud ~220 / ~75 / ~24 px).
- **Ujęcia** (identyczne dla każdego wariantu): `izba`, `grod`, `okolica`, `walk8`, `dig8`, `climb8`, `carry8`,
  `swiatlo`, `sil75`, `sil24`, `seq30` (opis w kontrakcie i briefie W3).
- **Zamrożony build** (vite build → serwer statyczny), sprawdzenie id wariantu, zero błędów konsoli.

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

## 4. Metryki (automatyczne, `scripts/dwarf-tournament.mjs`)

| Metryka | Definicja | Cel |
|---|---|---|
| rozróżnialność ról 75 px / 24 px | 1 − IoU czarnych sylwetek par ról (wyrównanie środków ciężkości); min. para; trafność klasyfikacji najbliższym wzorcem spoczynku dla 8 póz × 4 role | min. para jak największa; trafność 75 px ≥ 90%, 24 px ≥ 75% |
| kontrast postaci do tła | średnie L\* wypełnienia vs pierścień 6–12 px poza obrysem, w plamie i na skraju | ΔL\* ≥ 15 |
| akcent | udział pikseli wypełnienia z C\* > 30 | ≤ 10% sylwetki |
| poślizg stóp | maks. prędkość stopy podporowej / prędkość chodu (chód koncepcyjny i 2,5 kafla/s) | < 2% |
| ciągłość cyklu | skok kości na szwie cyklu | ≤ 0,01 kafla |
| stabilność sylwetki | średnie i min. IoU kolejnych klatek 30 kl./s (`seq30`) | wysokie, bez zapadnięć |
| koszt | trójkąty na LOD (budżet 1500 / 400 / 60), wywołania rysowania 1 vs 200, czas klatki 0 vs 200, ms animacji 200 | 200 krasnoludów w kilku wywołaniach |

## 5. Rubryka (ocena lidera, CLAUDE.md)

czytelność 25 · wow 25 · atmosfera 15 · spójność z wizją 10 · skalowalność 10 · wydajność 10 · oryginalność 5.
Czytelność i wydajność opierają się na metrykach; wow, atmosfera, spójność i oryginalność — na planszach
(Izba, Gród, Okolica, paski ruchu) z uzasadnieniem w tabeli ocen. Odrzucenie z urzędu: chibi (głowa > ⅓
wzrostu bez nakrycia), rola nieczytelna z sylwetki przy 75 px, podobieństwo do postaci z referencji lub innej gry.

## 6. Wyniki

*(po E3: tabela metryk, tabela ocen, plansze `docs/variants/04-dwarf/`, finaliści, plan rundy 2)*
