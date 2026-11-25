# Roadmapa — Underhearth (pełna gra: ~40 h ukończenia, ~120 h wymaksowania)

Zasady pracy: głębia ponad tempo, bramki jakości (`QUALITY.md`), **turnieje min. 10 wariantów** dla
wszystkiego, co gracz widzi/słyszy/czuje, symulacje Monte Carlo dla balansu. Sesje wznawiane
automatycznie co 5 h. Każda sesja zaczyna od pierwszego niezaznaczonego punktu.

## Faza A — Fundamenty projektu i kierunek wizualny
- [x] A0. Szkielet: Vite 8 + TypeScript 7 + Three.js r187 + Preact, CI → GitHub Pages
- [x] A1. Czysta karta (prototyp w historii gita `4416b41`), biblioteki techniczne z testami
- [x] A2. **Biblia treści** jako dane (`src/content/`): 9 biomów, 15 zagrożeń, 26 złóż, 27 surowców
      kopalnych, 47 dropów, 81 materiałów, 91 przedmiotów, 24 budowle × 3, 36 elementów infrastruktury,
      187 receptur, 134 węzły badań, 34 stworzenia (9 bossów), 8 Wielkich Dzieł × 3 → `docs/CONTENT.md`
- [x] A3. Analiza progresji + 19 testów spójności grafu treści
- [x] A4. **Model balansu** + Monte Carlo + turniej 64 wariantów krzywej → `docs/BALANCE.md` (40,4 h)
- [x] A5. Laboratorium turniejów wizualnych: arena, 8 scenariuszy, automat zrzutów, plansze, metryki
- [x] A6. **Turniej nr 1 — styl wizualny**: 12 stylów + 3 finalistów → zwycięzca **R2B „Sylwetki czytelne”**
      (`docs/variants/01-render-style.md`); finaliści pokazani właścicielowi do ewentualnej zmiany
- [ ] A7. Turnieje materiałów skał (paleta i wzory), światła, nieba, dekoracji, płynów, post-processingu, kamery

## Faza B — Świat i symulacja
- [ ] B1. Generator świata 2.0 dla 9 biomów (złoża wg biblii, jaskinie wg typów, miejsca specjalne, bossowie)
      — turniej wariantów generatora oceniany metrykami (dostępność złóż, łączność, różnorodność)
- [ ] B2. Model świata w grze: kopanie, zawały i podpory, płyny (woda, lawa, obsydian), temperatura, gazy, groza
- [ ] B3. Krasnoludy: model i animacje (turniej), potrzeby, cechy, umiejętności, ekwipunek w slotach
- [ ] B4. Nawigacja z grawitacją (drabiny, schody, platformy, windy, tory) + testy
- [ ] B5. Zadania i priorytety, magazyny, transport, produkcja w budynkach, energia
- [ ] B6. Badania: Sala Wiedzy, księgi z próbek, zakryte drzewko z licznikami

## Faza C — Gra
- [ ] C1. Budowanie 24 budowli × 3 poziomy (modele proceduralne — turniej stylu budynków) + infrastruktura
- [ ] C2. Ekonomia wg biblii treści, wszystkie 187 receptur
- [ ] C3. Stworzenia i bossowie (AI, walka, łup), najazdy, reżyser zdarzeń
- [ ] C4. Interfejs (turniej układu HUD), drzewko technologii, kronika, zlecenia
- [ ] C5. Samouczek ~1 h płynnie przechodzący w grę swobodną

## Faza D — Treść końcowa i szlif
- [ ] D1. Wielkie Dzieła (8 × 3 etapy)
- [ ] D2. Kręgi Otchłani (gra po ukończeniu) — dociągnięcie wymaksowania do ~120 h
- [ ] D3. Dźwięk i muzyka generatywna (turnieje), zapis/wczytanie, ustawienia, PL/EN
- [ ] D4. Bot grający w prawdziwą symulację → rekalibracja balansu; wydajność, dotyk, PWA
- [ ] D5. Drugie przeglądy wszystkich bramek jakości

---

## Dziennik pracy
- **2026-11-25 (dzień 1)** — Szkielet projektu, prototyp renderera (później zarchiwizowany).
  Nowe ustalenia: bramki jakości, turnieje min. 10 wariantów, czysta karta, praca od limitu do limitu
  (zaplanowane wznawianie co 5 h).
- **2026-11-25 (dzień 1, wieczór)** — Sesja kilkukrotnie restartowana (~3,5 h przerwy, pliki ocalały).
  Nowe wymagania właściciela: pełnoprawna gra 40 h / 120 h, ≥15 budowli × 3 poziomy, ~80 przedmiotów,
  ≥20 złóż, ≥30 dropów, 60–80 materiałów, zakryte drzewko technologii, samouczek ~1 h, balans,
  inspiracje Factorio/Satisfactory/Return to Moria/Palworld (bez oswajania stworzeń — decyzja właściciela).
  Zrobione: arena laboratorium, biblia treści z analizą progresji i testami, model balansu z Monte Carlo
  i turniejem krzywej kosztów (wynik 40,4 h), Wielkie Dzieła, projekt Kręgów Otchłani.
  Laboratorium wizualne i turniej nr 1 (12 stylów, 2 rundy, 15 wariantów, 120 renderów): zwycięża
  „Sylwetki czytelne” (8,4/10) — kontrast przekroju 0,55, rudy ΔE 28 (iskrzenie), mocny nastrój.
