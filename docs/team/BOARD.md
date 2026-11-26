# Tablica zadań (prowadzi Executive Producer)

Statusy: `kolejka` · `w toku` · `do przeglądu` · `zrobione` · `zablokowane (przez …)`

## Fala 1 — kierunek ilustrowany i fundamenty (M1)
| Id | Zadanie | Agent | Status | Wyjście | Kryterium „gotowe” |
|---|---|---|---|---|---|
| F1-1 | Wizja v1 + ocena kierunku ilustrowanego | game-director | **zrobione** (przyjęte 2026-11-26) | `docs/team/vision/VISION.md` | struktura roli (5 sekcji), tabela decyzji kierunkowych, checklista „czy pasuje?” |
| F1-2 | Biblia sztuki v1 (styl ilustrowany 2.5D) + karty: krasnolud, Palenisko, huta, tło wnęki | concept-artist | w toku | `docs/art/ART-BIBLE.md`, `docs/art/concepts/*.md` | parametry liczbowe (kontur, wartości, HEX per biom), różnice wobec referencji |
| F1-3 | Turniej nr 3 — styl ilustrowany: ≥ 10 wariantów, metryki referencji, finaliści | engine-graphics-programmer | w toku | `src/lab/styles/illustrated*.ts`, `docs/variants/03-illustrated-style.md` | cele CHARTER §4; plansze; ms/klatkę; testy i build zielone |
| F1-4 | Walidator treści `content:check` + przeglądarka danych + refstats w potoku | tools-programmer | w toku | `scripts/`, `src/tools/`, `tests/tools/` | komunikaty błędów testowane na zepsutych danych |
| F1-5 | Audyt jakości repozytorium i laboratorium + plan testów M1–M3 | qa-tester | w toku | `docs/qa/` | raporty BUG-NNN z krokami; macierz ryzyka |
| F1-6 | Harmonogram M1–M4 i rejestr ryzyk | producer | kolejka | `docs/team/production/` | zależności, bufory, decyzje do podjęcia |

## Fala 2 — systemy, świat, narracja w danych (M2–M3)
| Id | Zadanie | Agent | Status |
|---|---|---|---|
| F2-1 | Ekonomia: źródła i odpływy wszystkich zasobów i mierników (Weksel, Przebudzenie, Autorytet) | systems-designer | w toku (start wcześniej — niezależne od sztuki) |
| F2-2 | Specyfikacja generatora 2.0 jako dane + metryki | level-systems-designer | kolejka |
| F2-3 | Kopanie, zawały i podpory, zadania (rdzeń symulacji) | gameplay-programmer | kolejka |
| F2-4 | Nawigacja z grawitacją — benchmark 3 algorytmów | ai-programmer | w toku (start wcześniej — niezależne od sztuki) |
| F2-5 | HUD i sterowanie — specyfikacja + makiety do turnieju | ui-ux-designer | kolejka |
| F2-6 | Zadania jako dane + testy kompletności | quest-designer | kolejka |
| F2-7 | Teksty samouczka (król Gostomir) i Krążków Pamięci | narrative-writer | kolejka |
| F2-8 | Przegląd spójności biblii po nowym kierunku sztuki (+ usunięcie zależności od R2B w 01-world §10 i 05-level §1.4) | lead-narrative-designer | kolejka |
| F2-9 | Gobliny: pogodzić dane (drapieżcy) z biblią (lud wypierany przez Raroga) | lead-narrative-designer + systems-designer | kolejka |
| F2-10 | Przegląd Kręgów Otchłani pod charakter gry o kolonii | systems-designer + game-director | kolejka |
| F2-11 | Metryka nasycenia (udział pikseli chroma > 30) w `scripts/refstats.py` | tools-programmer | kolejka |
| F2-12 | Scenariusze tonu w laboratorium: izba wieczorem, przodek w mroku, zawał | engine-graphics-programmer | kolejka (po turnieju nr 3) |
| F2-13 | Kalibracja materiałów pod kreskę: galeria biomów ponownie, `tests/palette.test.ts` pod styl ilustrowany | engine-graphics + concept-artist | kolejka (po M1) |

## Fala 3 — postacie, efekty, dźwięk (M3–M4)
| Id | Zadanie | Agent | Status |
|---|---|---|---|
| F3-1 | Krasnolud: model i ruch (turniej) | animator-ta | kolejka (czeka na M1) |
| F3-2 | Efekty: kopanie, iskry, zawał, Pieśń (turniej) | vfx-artist | kolejka (czeka na M1) |
| F3-3 | Ikony surowców (turniej stylu) | artist-2d | kolejka (czeka na biblię sztuki) |
| F3-4 | Dźwięki kopania per materiał (turniej) | sound-designer | kolejka |
| F3-5 | Motyw Podgórza i Progów (turniej) | composer | kolejka |
| F3-6 | Silnik audio: szyny, limity, okluzja w przekroju | audio-programmer | kolejka |
