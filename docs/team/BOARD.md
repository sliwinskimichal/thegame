# Tablica zadań (prowadzi Executive Producer)

Statusy: `kolejka` · `w toku` · `do przeglądu` · `zrobione` · `zablokowane (przez …)`

## Fala 1 — kierunek ilustrowany i fundamenty (M1)
| Id | Zadanie | Agent | Status | Wyjście | Kryterium „gotowe” |
|---|---|---|---|---|---|
| F1-1 | Wizja v1 + ocena kierunku ilustrowanego | game-director | **zrobione** (przyjęte 2026-11-26) | `docs/team/vision/VISION.md` | struktura roli (5 sekcji), tabela decyzji kierunkowych, checklista „czy pasuje?” |
| F1-2 | Biblia sztuki v1 (styl ilustrowany 2.5D) + karty: krasnolud, Palenisko, huta, tło wnęki | concept-artist | **zrobione** (v1.1; 4 pytania do game-director) | `docs/art/ART-BIBLE.md`, `docs/art/concepts/*.md` | parametry liczbowe (kontur, wartości, HEX per biom), różnice wobec referencji |
| F1-3 | Turniej nr 3 — styl ilustrowany: ≥ 10 wariantów, metryki referencji, finaliści | engine-graphics-programmer | runda 1 **zrobiona**; **właściciel wybrał bazę i08 „Głębia warstw” i przywrócił efekty światła R2B** (bloom, poświata lamp i lawy); **runda 2 w toku**: etap B sceny tonu → C1 turniej warstwy światła (12 wariantów; **właściciel wybrał kierunek L00 = światło R2B 1:1**; hybrydy L12–L14 z konturem nad blaskiem, wybór końcowy na planszy) → C2 język skały naturalnej (2 warianty) → C3 finaliści łączeni + ślepe kadry | `src/lab/styles/illustrated*.ts`, `docs/variants/03-illustrated-style.md` | cele CHARTER §4; przeżywalność kreski w strefach światła; spadek plamy ≥ 20 L* na 3 kafle; natura ≠ mur; ore_ore_d ≥ 3; wybór właściciela na planszy; ms z poprawionym `frameMs`; testy i build zielone |
| F1-4 | Walidator treści `content:check` + przeglądarka danych + refstats w potoku | tools-programmer | **zrobione** (0 błędów, 7 ostrzeżeń → F2-14) | `scripts/`, `src/tools/`, `tests/tools/` | komunikaty błędów testowane na zepsutych danych |
| F1-5 | Audyt jakości repozytorium i laboratorium + plan testów M1–M3 | qa-tester | **zrobione** (10 błędów, plan testów) | `docs/qa/` | raporty BUG-NNN z krokami; macierz ryzyka |
| F1-6 | Harmonogram M1–M4 i rejestr ryzyk | producer | kolejka | `docs/team/production/` | zależności, bufory, decyzje do podjęcia |

## Fala 2 — systemy, świat, narracja w danych (M2–M3)
| Id | Zadanie | Agent | Status |
|---|---|---|---|
| F2-1 | Ekonomia: źródła i odpływy wszystkich zasobów i mierników (Weksel, Przebudzenie, Autorytet) | systems-designer | **zrobione** (ECONOMY.md) |
| F2-2 | Specyfikacja generatora 2.0 jako dane + metryki (+ BUG-006: `worldH` 736 = 23 chunki × 32 = 46 klastrów × 16) + odpowiedzi na 4 pytania nawigacji | level-systems-designer | w toku (wznowione po F2-4) |
| F2-3 | Rdzeń symulacji — etap 1: mutacje świata (BUG-003), kopanie, zawały i podpory | gameplay-programmer | **zrobione** (200 kopaczy 0,17 ms średnio / 0,60 ms p95 na tick; `docs/design/sim/WORLD-MUTATION.md`) |
| F2-3b | Rdzeń symulacji — etap 2: zadania i priorytety (rezerwacje, czarna lista), krasnoludy jako agenci (nawigacja F2-4), magazyn i noszenie, determinizm + zapis/odczyt, 200 krasnoludów < 4 ms/tick, scenariusz „mała kopalnia” | gameplay-programmer | w toku |
| F2-19 | Zatwierdzenie liczb rdzenia: rozpiętości stropów per skała, czasy ostrzeżeń (samouczek: ≥ 60 s), rumosz bez łupu, 1 blok z muru; udźwig i prędkości krasnoludów | systems-designer | kolejka (z F2-15) |
| F2-4 | Nawigacja z grawitacją — benchmark 3 algorytmów | ai-programmer | **zrobione** (HPA\* 16×16 + kolejka planowania; 200 krasnoludów 0,29 ms mediany / 1,7 ms p95 na tick; `docs/design/ai/NAVIGATION.md`) |
| F2-5 | HUD i sterowanie — specyfikacja + makiety do turnieju | ui-ux-designer | kolejka |
| F2-6 | Zadania jako dane + testy kompletności | quest-designer | kolejka |
| F2-7 | Teksty samouczka (król Gostomir) i Krążków Pamięci | narrative-writer | kolejka |
| F2-8 | Przegląd spójności biblii po nowym kierunku sztuki (+ usunięcie zależności od R2B w 01-world §10 i 05-level §1.4) | lead-narrative-designer | kolejka |
| F2-9 | Gobliny: pogodzić dane (drapieżcy) z biblią (lud wypierany przez Raroga) | lead-narrative-designer + systems-designer | kolejka |
| F2-10 | Przegląd Kręgów Otchłani pod charakter gry o kolonii | systems-designer + game-director | kolejka |
| F2-11 | Metryka nasycenia (udział pikseli chroma > 30) w `scripts/refstats.py` | tools-programmer | kolejka |
| F2-12 | Scenariusze tonu w laboratorium: izba wieczorem, przodek w mroku, zawał — **wymagane przed decyzją M1** | engine-graphics-programmer | w toku (etap B rundy 2; izba gęsto zastawiona, mur obok naturalnej skały, 2 seedy) |
| F2-14 | 7 ostrzeżeń walidatora (moc pieca vs receptury kobaltu, tiery `feast_platter`/`heart_key`, `copper_rod` light 0, trofeum `guardian_sigil` bez badania, `gas_masks` odsłaniane w T3) — decyzja i poprawka danych | systems-designer | kolejka (z F2-1) |
| F2-15 | Wdrożenie ekonomii w danych: wytrzymałość i naprawa/przetop 62 przedmiotów, `src/content/economy.ts` (Weksel: 5 rat/rok), paliwo i utrzymanie, ceny wyrobów, krzywa ksiąg 6,2/1,31; poprawka 7 ostrzeżeń walidatora; Monte Carlo w `tests/balance.test.ts`; potem `--strict` w CI | systems-designer | kolejka |
| F2-16 | Czarne złoto jako surowiec (dane + lore + walidator) | systems-designer + lead-narrative-designer | kolejka |
| F2-18 | Percepcja i decyzje AI (`src/sim/ai/`): wzrok i słuch po kaflach, użyteczność z histerezą, taktyka najazdu — na stosie nawigacji F2-4 | ai-programmer | kolejka (po rdzeniu zadań F2-3) |
| F2-17 | Granitowe Korzenie przeciążone (7,5 h vs 6 h) — korekta treści/kosztów | systems-designer + level-systems-designer | kolejka |
| F2-13 | Kalibracja materiałów pod kreskę: galeria biomów ponownie, `tests/palette.test.ts` pod styl ilustrowany | engine-graphics + concept-artist | kolejka (po M1) |

## Fala 3 — postacie, efekty, dźwięk (M3–M4)
| Id | Zadanie | Agent | Status |
|---|---|---|---|
| F3-1 | Krasnolud: model i ruch (turniej) | animator-ta | **w toku — etap 1** (start przed M1 na prośbę właściciela; styl zawężony do i08 + światło L00): ≥ 10 wariantów konstrukcji × 4 role, rig proceduralny, cykle spoczynek/chód/kopanie/wspinaczka/noszenie, stanowisko `dwarves.html`, `docs/variants/04-dwarf.md` |
| F3-2 | Efekty: kopanie, iskry, zawał, Pieśń (turniej) | vfx-artist | kolejka (czeka na M1) |
| F3-3 | Ikony surowców (turniej stylu) | artist-2d | kolejka (czeka na biblię sztuki) |
| F3-4 | Dźwięki kopania per materiał (turniej) | sound-designer | kolejka |
| F3-5 | Motyw Podgórza i Progów (turniej) | composer | kolejka |
| F3-6 | Silnik audio: szyny, limity, okluzja w przekroju | audio-programmer | kolejka |

## Triage błędów QA (2026-11-26)
| Błąd | Priorytet | Właściciel | Kiedy |
|---|---|---|---|
| BUG-001 nieznany id stylu → cichy render innego stylu; turniej nie weryfikuje | P2 | engine-graphics (lab i `tournament.mjs` — jeden właściciel, mniej przekazań) | **w toku** (etap A rundy 2) |
| BUG-002 `frameMs` nie mierzy renderu | P2 | engine-graphics | **w toku** (etap A rundy 2; zapytania czasowe GPU lub `gl.finish()`) |
| BUG-003 `World.fill()` psuje stan kafla | P2 (M3) | gameplay-programmer | **naprawiony** (F2-3 etap 1) |
| BUG-004 model balansu: NaN, ukryty limit 500 h, ujemna populacja | P3 | systems-designer | z F2-1 / F2-14 |
| BUG-005 tekstura kafli pokazuje rudę przez mgłę przy `bg = 0` | P3 | engine-graphics | **w toku** (etap A rundy 2) |
| BUG-006 `worldH` 480 vs świat 720 | P3 | level-systems-designer | **naprawiony** (`worldH` 736, test przełączony; F2-2) |
| BUG-007 test palety nie łapie par mylonych w renderze | P3 | engine-graphics + concept-artist | F2-13 |
| BUG-008 81 materiałów vs „60–80” | — | — | nie błąd (brzmienie wymagania poprawione) |
| BUG-009 EventBus | P4 | producent | **naprawiony** |
| BUG-010 model balansu ma własną twardość skał | P4 | systems-designer | z F2-14 |
| D4 laboratorium bez parametru `seed` (wymóg 2 seedów) | P3 | engine-graphics | **w toku** (etap A rundy 2) |

