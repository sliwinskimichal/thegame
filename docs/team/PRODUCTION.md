# Plan produkcji — Senior Executive Producer (sesja główna)

> Stan na 2026-11-26. Aktualizowany przy każdej zmianie fali lub kamienia milowego. Szczegóły zadań:
> `docs/team/BOARD.md`; decyzje: `docs/team/DECISIONS.md`.

## 1. Cel operacyjny, kamienie milowe i kryteria sukcesu
**Cel**: z dokumentów i laboratorium dojść do **grywalnego pionowego wycinka** (Podgórze + Wapienne Progi:
samouczek ze starym królem, kopanie, budowa, produkcja do brązu, pierwsza noc, zawał), a potem rozciągnąć go
na 9 biomów, drużynę i finał — w nowym kierunku artystycznym (ilustrowany przekrój 2.5D).

**Ramy zasobowe**: zespół = sesja główna + agenci-specjaliści uruchamiani falami. **Pomiar z 2026-11-26**:
7 równoległych agentów wyczerpało 5-godzinne okno limitu w ok. 1 h, 4 agentów — w ok. 1,2 h. Całkowita praca
na okno jest stała; równoległość zmienia tylko to, kiedy budżet się kończy. Zasada: **3 agentów naraz +
rezerwa na integrację** (raport bez integracji w tym samym oknie to praca bez efektu), zadania krojone tak,
by agent kończył je w jednym oknie, a przerwany agent był wznawiany (`SendMessage`), nie startowany od nowa.
Jednostka planowania: **cykl** = jedno okno limitu (5 h; realnie ~1–1,5 h pracy zespołu).

| KM | Nazwa | Kryterium ukończenia (mierzalne) | Cykle (z buforem) |
|---|---|---|---|
| **M1** | Kierunek ilustrowany | turniej nr 3 rozstrzygnięty: ≥ 10 wariantów + 3 finalistów; zwycięzca spełnia cele z CHARTER §4 (L* 36–40, czerń 15–22%, kreska ≥ 3%, krawędzie ≥ 15%); biblia sztuki v1 zaakceptowana przez game-director; 60 FPS w scenariuszu „overview” na referencyjnym GPU lub udokumentowany budżet | 3 (+1 bufor) |
| **M2** | Świat 2.0 | generator 9 biomów wg `docs/narrative/05-level-systems.md`; metryki: 100% złóż z biblii obecnych, gęstości ±20% celu, łączność hub → Gardziel w każdym biomie; turniej 10 seedów | 3 (+1) |
| **M3** | Rdzeń symulacji | kopanie, zawały/podpory, nawigacja z grawitacją, zadania i priorytety, magazyn, transport; testy determinizmu, zapis/odczyt; 200 krasnoludów < 4 ms/tick | 5 (+2) |
| **M4** | Pionowy wycinek | 60 min samouczka grywalne od wozu do śmierci króla; UI v1 (turniej); dźwięk i muzyka v1 dla 2 biomów; raport QA bez błędów krytycznych | 6 (+2) |
| **M5** | Pełna progresja | 9 biomów, 24 budowle × 3, 187 receptur, badania, bossowie, najazdy; bot przechodzi grę w symulacji w 40 h ± 10% | 12 (+3) |
| **M6** | Drużyna i finał | 9 towarzyszy, 17 misji, 5 kamieni milowych fabuły, finał z rolami; zadania jako dane z testami kompletności | 8 (+2) |
| **M7** | Szlif i premiera | Wielkie Dzieła, Kręgi Otchłani (120 h), PL/EN, **instalator Windows/macOS i aplikacja Android** (opakowanie wybrane benchmarkiem: Electron / Tauri / Capacitor), **menu główne, lokalne zapisy**, demo samouczka na GitHub Pages, wydajność per klasa sprzętu, drugie przeglądy bramek | 7 (+2) |

## 2. Alokacja zasobów, harmonogram i przepływ pracy między działami
**Fala 1 (teraz, M1 + fundamenty):**
| Agent | Zadanie | Wyjście | Odblokowuje |
|---|---|---|---|
| game-director | Wizja v1: rdzeń, łuk gracza, granice; ocena kierunku ilustrowanego | `docs/team/vision/VISION.md` | wszystkich (kryteria „czy pasuje?”) |
| concept-artist | Biblia sztuki v1 dla stylu ilustrowanego 2.5D: kontur, wartości, paleta biomów, język form; karty krasnoluda i 3 budowli | `docs/art/ART-BIBLE.md`, `docs/art/concepts/` | engine-graphics (parametry wariantów), animator-ta, artist-2d, ui |
| engine-graphics-programmer | Turniej nr 3: ≥ 10 wariantów stylu ilustrowanego w laboratorium (kontur na granicy skała/pustka, cieniowanie pasmowe, faktura pędzla, tła wnęk, kontur rekwizytów, ziarno papieru; wariant z biblioteką zewnętrzną) + metryki referencji | `src/lab/styles/illustrated*.ts`, `docs/variants/03-illustrated-style.md` | M1, cała produkcja wizualna |
| tools-programmer | `npm run content:check` (walidator treści z jasnymi komunikatami), `scripts/refstats.py` w potoku turniejów, przeglądarka danych w laboratorium | `scripts/`, `src/tools/` | designerów (fala 2), QA |
| producer | Harmonogram szczegółowy M1–M4, rejestr ryzyk, mapa zależności | `docs/team/production/` | decyzje Executive Producera |
| qa-tester | Audyt stanu repozytorium i laboratorium, plan testów M1–M3, pierwsze raporty błędów | `docs/qa/` | wszystkich (jakość) |

**Fala 2 (po zaakceptowaniu wizji i biblii sztuki):** systems-designer (ekonomia: źródła/odpływy dla
wszystkich zasobów i mierników), level-systems-designer (specyfikacja generatora jako dane), gameplay-programmer
(kopanie, zawały, zadania), ai-programmer (nawigacja z grawitacją — benchmark 3 algorytmów), ui-ux-designer
(HUD i sterowanie, makiety do turnieju), lead-narrative-designer + quest-designer (zadania jako dane),
narrative-writer (samouczek z królem, Krążki Pamięci).

**Fala 3 (po wyborze stylu i działającym rdzeniu):** animator-ta (krasnolud: model i ruch — turniej),
vfx-artist (kopanie, iskry, zawał, Pieśń), artist-2d (ikony surowców — turniej), sound-designer (kopanie
per materiał), composer (motyw Podgórza i Progów), audio-programmer (silnik i miks).

**Blokady między działami i ich zdejmowanie:**
| Blokada | Kto czeka | Odblokowanie |
|---|---|---|
| Brak wybranego stylu ilustrowanego | animator-ta, vfx, artist-2d, ui | fala 3 startuje dopiero po M1; do tego czasu pracują na makietach szarych (greybox) i w dokumentach |
| Brak symulacji | ui, vfx, audio (brak zdarzeń) | uzgodnione **zdarzenia EventBus** (lista w handoffie gameplay → wszyscy) + laboratorium z zdarzeniami-atrapami |
| Generator 2.0 nie istnieje | gameplay, ai (brak map testowych) | arena i galeria laboratorium jako mapy testowe; generator dostarcza później |
| Zmiany palety i shaderów podczas turniejów | engine (skażone rendery) | zamrożenie `src/render/**` w trakcie przebiegu turnieju; zmiany tylko między przebiegami |
| Liczby balansu rozproszone w kodzie | systems | zasada: liczby tylko w `src/content/`; walidator narzędziowy |

## 3. Macierz priorytetów, zasobów i ryzyk operacyjnych
| Obszar / ryzyko | Wpływ | Decyzja / alokacja | Działanie naprawcze / plan awaryjny |
|---|---|---|---|
| Styl ilustrowany w 2.5D nie osiąga celów kreski bez utraty wydajności | M1, harmonogram całego artu | engine-graphics na ścieżce krytycznej, warianty kontur-w-shaderze (tani) i post-process (droższy) | fallback: kontur tylko na granicach skała/pustka i rekwizytach, faktura w teksturze proceduralnej zamiast post-procesu |
| Kolizje edycji między agentami | jakość, czas | własność katalogów (CHARTER §6), pliki wspólne tylko producent | konflikt = producent scala ręcznie; agent kodu w osobnym drzewie, gdy dotyka wspólnych modułów |
| Zużycie limitu przez wielu agentów naraz | tempo | maks. 4–5 równoległych agentów, krótkie zadania z jasnym wyjściem | zadania zbyt duże dzielę na etapy; agenci tylko-dokumentowi mają limity słów |
| Rozjazd wizji (każdy agent „swoją” grę) | spójność | game-director akceptuje kierunek; producent sprawdza zgodność z CHARTER i wizją | odrzucenie wyniku z listą zmian; powtórka zadania |
| Zakres: 20 ról × pełna gra 40/120 h | termin | pionowy wycinek (M4) przed szerokością; elementy „nice-to-have” w kolejce | cięcia w kolejności: post-game → liczba wariantów budowli → dodatkowe misje poboczne (nigdy rdzeń pętli i finał) |
| Brak dźwięku do późnej fazy | odbiór „wow” | fala 3 równolegle z M3 | szkic audio (3 dźwięki + 1 motyw) w M4 jako minimum |
| Prawo / oryginalność (styl referencji) | ryzyko prawne | rodzina stylu tak, cudze assety nie (CHARTER §4); przegląd game-director | każda karta konceptu ma sekcję „czym różni się od referencji” |

## 4. Rytm operacyjny, eskalacja blokad i decyzje kompromisowe
- **Start cyklu** (po wznowieniu): przegląd `BOARD.md`, raportów agentów i testów; wybór 3–5 zadań fali; start agentów w tle.
- **W trakcie**: integracja wyników po kolei (czytanie, weryfikacja testami i buildem, zrzuty), notatki przekazania
  do następnych ról, aktualizacja tablicy.
- **Koniec cyklu**: commit + push, wpis w dzienniku ROADMAP, decyzje w `DECISIONS.md`.
- **Eskalacja**: konflikt dwóch ról → producent decyduje w ramach zakresu; konflikt z wizją → game-director;
  konflikt z decyzją właściciela lub zmiana zakresu twardego → pytanie do właściciela (jedno, konkretne, z rekomendacją).
- **Kryteria korekty planu**: KM przekracza bufor o > 1 cykl; metryka bramki nie rośnie przez 2 iteracje; agent
  oddaje wynik niezgodny ze strukturą roli 2 razy → zadanie przeformułowane.

## 5. Wąskie gardła, kompromisy z wizją i pierwsze kroki
**Zagrożenia:**
1. *Ścieżka krytyczna przez renderer* — cały art czeka na M1. Opanowanie: greybox i dokumenty w fali 2–3,
   turniej nr 3 zaczyna się natychmiast, a jego warianty są małe i szybkie do renderu.
2. *Integracja jako wąskie gardło producenta* — 20 ról, jeden integrator. Opanowanie: twarde wyjścia
   w ścieżkach, raporty końcowe w stałym formacie, automatyczne testy i walidatory (tools-programmer w fali 1).
3. *Ambicja vs czas* — każda rola może rozdmuchać zakres. Opanowanie: każde zadanie ma limit (liczba wariantów,
   słów, plików) i kryterium „gotowe”; nowe pomysły trafiają do kolejki, nie do bieżącego zadania.
4. *Przeciążenie kluczowej roli* (engine-graphics: styl, wydajność, VFX-potok) — Opanowanie: vfx i animator-ta
   dostają własne moduły; engine przegląda tylko budżety.

**Pierwsze kroki (ten cykl):**
1. Zatwierdzić statut, skład, plan i tablicę (commit).
2. Uruchomić falę 1: game-director, concept-artist, engine-graphics-programmer, tools-programmer, qa-tester
   (producer — w następnym kroku, gdy będą pierwsze raporty do zaplanowania).
3. Integrować wyniki w kolejności: wizja → biblia sztuki → warianty stylu → turniej → decyzja M1.
