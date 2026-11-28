# Tablica zadań (prowadzi Executive Producer)

Statusy: `kolejka` · `w toku` · `do przeglądu` · `zrobione` · `zablokowane (przez …)`

## Fala 1 — kierunek ilustrowany i fundamenty (M1)
| Id | Zadanie | Agent | Status | Wyjście | Kryterium „gotowe” |
|---|---|---|---|---|---|
| F1-1 | Wizja v1 + ocena kierunku ilustrowanego | game-director | **zrobione** (przyjęte 2026-11-26) | `docs/team/vision/VISION.md` | struktura roli (5 sekcji), tabela decyzji kierunkowych, checklista „czy pasuje?” |
| F1-2 | Biblia sztuki v1 (styl ilustrowany 2.5D) + karty: krasnolud, Palenisko, huta, tło wnęki | concept-artist | **zrobione** (v1.1; 4 pytania do game-director) | `docs/art/ART-BIBLE.md`, `docs/art/concepts/*.md` | parametry liczbowe (kontur, wartości, HEX per biom), różnice wobec referencji |
| F1-3 | Turniej nr 3 — styl ilustrowany | engine-graphics-programmer | runda 1 i runda 2 A, B, C1 **zrobione**; **zwycięzca warstwy światła zapisany jako dane gry** (`src/render/illustrated-v1.json`, styl `w1-illustrated`: rysunek i08 + L12 z lawą L14; kontur przeżywa średnio 0,63 poza lawą); `createIllustratedWith` dla innych scen; **C2** (język skały, kod gotowy) i **C3** (finaliści, ślepy test) + plan wartości tła izby po sprincie krasnoludów | `src/lab/*`, `src/render/*`, `docs/variants/03-illustrated-style.md` | cele kadru CHARTER §4 (krawędzie 6,3% vs 15%, kreska 1,8% vs 3%) — do C2/C3 |
| F1-4 | Walidator treści `content:check` + przeglądarka danych + refstats w potoku | tools-programmer | **zrobione** (0 błędów, 7 ostrzeżeń → F2-14) | `scripts/`, `src/tools/`, `tests/tools/` | komunikaty błędów testowane na zepsutych danych |
| F1-5 | Audyt jakości repozytorium i laboratorium + plan testów M1–M3 | qa-tester | **zrobione** (10 błędów, plan testów) | `docs/qa/` | raporty BUG-NNN z krokami; macierz ryzyka |
| F1-6 | Harmonogram M1–M4 i rejestr ryzyk | producer | kolejka | `docs/team/production/` | zależności, bufory, decyzje do podjęcia |

## Fala 2 — systemy, świat, narracja w danych (M2–M3)
| Id | Zadanie | Agent | Status |
|---|---|---|---|
| F2-1 | Ekonomia: źródła i odpływy wszystkich zasobów i mierników (Weksel, Przebudzenie, Autorytet) | systems-designer | **zrobione** (ECONOMY.md) |
| F2-2 | Specyfikacja generatora 2.0 jako dane + metryki (+ BUG-006) | level-systems-designer | **zrobione** (`src/content/worldgen.ts`, `src/world/worldgenRules.ts`, `src/world/worldgenMetrics.ts`, `docs/design/levels/WORLDGEN.md`; świat 224×736; reguła sklepienia; **wykrył deficyt surowców → F2-20**) |
| F2-20 | **Deficyt surowców**: 19 z 23 surowców kopalnych ma podaż w świecie poniżej popytu receptur (np. rubin 29 vs 1 417, węgiel 3 360 vs 18 866) — przyczyna: księgi badań zużywają surowce głębi; model balansu zakłada złoża nieskończone. Kierunek producenta: strażnik podaż ≥ 2× popyt w testach balansu (zawsze) + księgi w partiach + źródła odnawialne (węgiel drzewny, obsydian z lawy i wody); wydajność złóż ×2–3 tylko jeśli nie wystarczy; gęstości T0–T1 od level-designera do akceptacji | systems-designer (+ level-systems) | kolejka — **pierwsze zadanie systems po sprincie krasnoludów** (blokuje M2 i M5) |
| F2-21 | Generator świata 2.0 (implementacja wg specyfikacji) + turniej 10 seedów (`docs/variants/05-worldgen.md`) | level-systems-designer (+ engine do podglądu) | kolejka (po F2-20) |
| F2-3 | Rdzeń symulacji — etap 1: mutacje świata (BUG-003), kopanie, zawały i podpory | gameplay-programmer | **zrobione** (200 kopaczy 0,17 ms średnio / 0,60 ms p95 na tick; `docs/design/sim/WORLD-MUTATION.md`) |
| F2-3b | Rdzeń symulacji — etap 2: zadania i priorytety, krasnoludy jako agenci, magazyn i noszenie, determinizm + zapis/odczyt | gameplay-programmer | **zrobione** (200 krasnoludów 1,65 ms p95 na pełny tick; „mała kopalnia” zaliczona; `docs/design/sim/JOBS.md`) |
| F2-3c | Rdzeń symulacji — etap 3: `World.infra` (jedna warstwa infrastruktury w pierścieniu zmian), budowa budowli z `buildings.ts`, kamień Prakowali (kilof 9), samouczkowa sala zawału | gameplay-programmer | kolejka (po sprincie krasnoludów) |
| F2-19 | Zatwierdzenie liczb rdzenia: rozpiętości stropów per skała, czasy ostrzeżeń (samouczek: ≥ 60 s), rumosz bez łupu, 1 blok z muru; udźwig i prędkości krasnoludów (tymczasowo: chód 1,1 kafla/s, trucht 2,5 przy alarmie — skutki dla tempa 40 h) | systems-designer | kolejka (z F2-15) |
| F2-4 | Nawigacja z grawitacją — benchmark 3 algorytmów | ai-programmer | **zrobione** (HPA\* 16×16 + kolejka planowania; 200 krasnoludów 0,29 ms mediany / 1,7 ms p95 na tick; `docs/design/ai/NAVIGATION.md`) |
| F2-5 | HUD i sterowanie — specyfikacja + makiety do turnieju | ui-ux-designer | kolejka |
| F2-6 | Zadania jako dane + testy kompletności | quest-designer (**lider zespołu 4 scenarzystów** — decyzja właściciela 2026-11-28; start wg harmonogramu) | kolejka |
| F2-7 | Teksty samouczka (król Gostomir) i Krążków Pamięci | zespół scenarzystów (lider: quest-designer) | kolejka (M4) |
| F2-8 | Przegląd spójności biblii po nowym kierunku sztuki (+ usunięcie zależności od R2B w 01-world §10 i 05-level §1.4) **+ przepisanie samouczka: gracz gra Gostomirem** (persona gracza, Kołysanka trzymana przez gracza, następca; decyzja właściciela 2026-11-28) + sala zawału 14×3 | lead-narrative-designer + quest-designer | kolejka (przed tekstami M4) |
| F2-9 | Gobliny: pogodzić dane (drapieżcy) z biblią (lud wypierany przez Raroga) | lead-narrative-designer + systems-designer | kolejka |
| F2-10 | Przegląd Kręgów Otchłani pod charakter gry o kolonii | systems-designer + game-director | kolejka |
| F2-11 | Metryka nasycenia (udział pikseli chroma > 30) w `scripts/refstats.py` | tools-programmer | kolejka |
| F2-12 | Scenariusze tonu w laboratorium: izba wieczorem, przodek w mroku, zawał — **wymagane przed decyzją M1** | engine-graphics-programmer | w toku (etap B rundy 2; izba gęsto zastawiona, mur obok naturalnej skały, 2 seedy) |
| F2-14 | 7 ostrzeżeń walidatora (moc pieca vs receptury kobaltu, tiery `feast_platter`/`heart_key`, `copper_rod` light 0, trofeum `guardian_sigil` bez badania, `gas_masks` odsłaniane w T3) — decyzja i poprawka danych | systems-designer | kolejka (z F2-1) |
| F2-15 | Wdrożenie ekonomii w danych: wytrzymałość i naprawa/przetop 62 przedmiotów, `src/content/economy.ts` (Weksel: 5 rat/rok), paliwo i utrzymanie, ceny wyrobów, krzywa ksiąg 6,2/1,31; poprawka 7 ostrzeżeń walidatora; Monte Carlo w `tests/balance.test.ts`; potem `--strict` w CI | systems-designer | kolejka |
| F2-16 | Czarne złoto jako surowiec (dane + lore + walidator) | systems-designer + lead-narrative-designer | kolejka |
| F2-18 | Percepcja i decyzje AI (`src/sim/ai/`): wzrok i słuch po kaflach, użyteczność z histerezą, taktyka najazdu; plus z F2-3b: `save/load` w `NavAgent`/`NavPlanner` (zamiast mostu `navsave.ts`), warstwa kar ścieżki (pękający strop), kolejność urabiania z zasięgiem i drabinami (krasnoludy wkopują się w rów bez wyjścia), indeks przestrzenny zadań; z F2-2: `testmaps.ts` i testy nav z 720 na `CONFIG.worldH`, przekrok szczeliny 1 kafla | ai-programmer | kolejka (po sprincie krasnoludów) |
| F2-17 | Granitowe Korzenie przeciążone (7,5 h vs 6 h) — korekta treści/kosztów | systems-designer + level-systems-designer | kolejka |
| F2-13 | Kalibracja materiałów pod kreskę: galeria biomów ponownie, `tests/palette.test.ts` pod styl ilustrowany | engine-graphics + concept-artist | kolejka (po M1) |

## Punkty kontrolne i platforma (decyzje właściciela 2026-11-28)
| Id | Zadanie | Agent | Status |
|---|---|---|---|
| K-SKALA | **Weryfikacja skali** po ukończeniu wszystkich modeli (krasnoludy → ekwipunek i budowle → sale, biomy, świat): skala kafla, wymiary sal, rozmiar świata, prześwity nawigacji, zoomy, budżety | producent + level-systems + engine + ai | czeka na modele (F3-1 i zespół budowli) |
| F7-1 | Warstwa platformy `src/platform/` (zapis/odczyt plików, ustawienia) — interfejs teraz, implementacje przy pakowaniu | gameplay-programmer | kolejka (przy F2-3c) |
| F7-2 | Budżety wydajności per klasa sprzętu (desktop średni GPU / Android średni) w QUALITY + tryb jakości mobilnej | engine-graphics + producent | kolejka (po M1) |
| F7-3 | Opakowanie natywne: benchmark Electron vs Tauri vs Capacitor (rozmiar, start, FPS, zgodność renderu), instalatory Windows/macOS, APK; podpisywanie kodu | tools-programmer + engine | M7 |
| F7-4 | Menu główne, lokalne zapisy (sloty), demo samouczka na GitHub Pages | ui-ux + gameplay | M7 |

## Fala 3 — postacie, efekty, dźwięk (M3–M4)
| Id | Zadanie | Agent | Status |
|---|---|---|---|
| F3-1 | Krasnolud: model i ruch (turniej) | **zespół krasnoludów**: lider animator-ta + W1 modelarz, W2 animator ruchu, W3 technical artist (briefy: `docs/team/dwarf-team/BRIEFS.md`) | **w toku — sprint zespołu** (decyzja właściciela): kontrakt `src/render/characters/types.ts`, ≥ 10 wariantów × 4 role, rig, cykle, stanowisko `dwarves.html`, `docs/variants/04-dwarf.md`, plansza dla właściciela |
| F3-2 | Efekty: kopanie, iskry, zawał, Pieśń (turniej) | vfx-artist | kolejka (czeka na M1) |
| F3-3 | Ikony surowców (turniej stylu) | artist-2d | kolejka (czeka na biblię sztuki) |
| F3-4 | Dźwięki kopania per materiał (turniej) | sound-designer | kolejka |
| F3-5 | Motyw Podgórza i Progów (turniej) | composer | kolejka |
| F3-6 | Silnik audio: szyny, limity, okluzja w przekroju | audio-programmer | kolejka |

## Triage błędów QA (2026-11-26)
| Błąd | Priorytet | Właściciel | Kiedy |
|---|---|---|---|
| BUG-001 nieznany id stylu → cichy render innego stylu; turniej nie weryfikuje | P2 | engine-graphics (lab i `tournament.mjs` — jeden właściciel, mniej przekazań) | **naprawiony** (runda 2, etap A) |
| BUG-002 `frameMs` nie mierzy renderu | P2 | engine-graphics | **naprawiony** (runda 2, etap A) |
| BUG-003 `World.fill()` psuje stan kafla | P2 (M3) | gameplay-programmer | **naprawiony** (F2-3 etap 1) |
| BUG-004 model balansu: NaN, ukryty limit 500 h, ujemna populacja | P3 | systems-designer | z F2-1 / F2-14 |
| BUG-005 tekstura kafli pokazuje rudę przez mgłę przy `bg = 0` | P3 | engine-graphics | **naprawiony** (runda 2, etap A) |
| BUG-006 `worldH` 480 vs świat 720 | P3 | level-systems-designer | **naprawiony** (`worldH` 736, test przełączony i rozszerzony; F2-2) |
| BUG-007 test palety nie łapie par mylonych w renderze | P3 | engine-graphics + concept-artist | F2-13 |
| BUG-008 81 materiałów vs „60–80” | — | — | nie błąd (brzmienie wymagania poprawione) |
| BUG-009 EventBus | P4 | producent | **naprawiony** |
| BUG-010 model balansu ma własną twardość skał | P4 | systems-designer | z F2-14 |
| D4 laboratorium bez parametru `seed` (wymóg 2 seedów) | P3 | engine-graphics | **naprawiony** (runda 2, etap A) |

