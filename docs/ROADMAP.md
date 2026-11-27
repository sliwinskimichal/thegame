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
- [x] A9. **Zespół 20 agentów-specjalistów** (`.claude/agents/`, `docs/team/`): statut, skład, plan produkcji,
      tablica zadań, rejestr decyzji; sesja główna jako Executive Producer
- [ ] A10. **Turniej nr 3 — styl ilustrowany 2.5D** (nowy kierunek właściciela): ≥ 10 wariantów, cele z
      `docs/team/CHARTER.md` §4, biblia sztuki v1 (`docs/art/`) — kamień milowy M1
- [ ] A7. Turnieje: ~~materiałów skał~~ ✅ (`docs/variants/02-materials.md`; do adaptacji pod styl ilustrowany),
      światła, nieba, dekoracji, płynów, post-processingu (z bibliotekami zewnętrznymi jako zawodnikami), kamery
- [x] A8. **Biblia narracyjna** (`docs/narrative/`): świat, frakcje, bóstwa i magia, 5 aktów, 9 towarzyszy z misjami
      rekrutacyjnymi i lojalnościowymi, 14 dokumentów zadań, makrostruktura świata i ekonomia ryzyka

## Faza B — Świat i symulacja
- [ ] B1. Generator świata 2.0 dla 9 biomów wg `docs/narrative/05-level-systems.md` (Gardziel, pieczęcie, kaskada,
      układ wody, gęstości złóż, żyły-matki w strefach zagrożenia; świat ~224×720)
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
- [ ] C5. Samouczek ~1 h ze starym królem Gostomirem (śmierć w zawale) płynnie przechodzący w grę swobodną
- [ ] C6. Warstwa drużyny: wyprawy, Palenisko, Zaufanie/lojalność, frakcje, Przebudzenie, Weksel, Krążki Pamięci,
      Pieśń Kamienia, druidzi, Pracownia Wynalazków; 5 kamieni milowych i 17 misji drużyny jako dane + testy
- [ ] C7. Finał „Serce Góry”: przygotowanie grodu, przydział ról, 3 zakończenia, epilog

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
- **2026-11-25 (dzień 1, noc)** — Turniej nr 2 (materiały): 6 rund, 47 wariantów, ~1300 renderów. W trakcie wyszło,
  że tabela renderu (25 materiałów) nie pokrywa biblii treści (26 złóż) — zbudowana pełna tabela 44 materiałów
  powiązana z danymi treści (twardość, kilof), galeria biomów, metryki per biom i test palety. Zwycięzca:
  paleta projektowana per biom + **formy minerałów** (pokłady, dendryty, nerki, igły, sześciany, bryłki, pył;
  pryzmaty, szczotki, heksagony) + osobny kolor połysku + poświata krawędzi w kolorze skały. Najsłabsza para
  rud w świetle roboczym ΔE 1,0 → 8,2, skał 14,0 → 24,3. Nowe decyzje właściciela: stary król-przewodnik
  ginie w zawale na końcu samouczka; główny przeciwnik na wzór balroga (oryginalny); warstwa drużyny RPG
  (DA:O, ME2); gnomy-wynalazcy jako sojuszniczy lud; biblioteki zewnętrzne dopuszczone przez turnieje.
- **2026-11-26 (dzień 2)** — Biblia narracyjna (`docs/narrative/`, ~18 tys. słów): research (Tolkien, WoW —
  sprawdzone źródła, Sanderson, Lynch, DA:O, ME2, folklor górniczy i słowiański), świat (Prakowale, Ociosani,
  Pierwszy Wybór, Raróg), 6 frakcji z interesami i urazami, panteon, Pieśń Kamienia, druidzi, Krążki Pamięci,
  kierunek artystyczny techniki/nauki/magii; samouczek z królem Gostomirem i zawałem; 5 aktów; 9 towarzyszy;
  14 dokumentów zadań (zwroty z konkretnymi dowodami, 2–3 wykluczające się zakończenia z ceną, echa);
  projekt poziomów (kaskada z Gardzielą, linie prowadzące, tabela ryzyka i nagrody, gęstości zasobów, bramy).
- **2026-11-26 (dzień 2, przedpołudnie)** — Nowe decyzje właściciela: (1) kierunek artystyczny — ilustrowany
  przekrój kolonii w 2.5D, trochę ciemniejszy niż referencja (pomiar referencji: L* 43,5, krawędzie 29%, kreska
  5,3% — nasz R2B ma 10× mniej kreski i detalu, a nocą 3× więcej czerni; cele w CHARTER §4, skrypt
  `scripts/refstats.py`); (2) zespół 20 agentów-specjalistów zarządzany przez sesję główną jako Executive
  Producer — statut, skład, plan produkcji M1–M7, tablica zadań i rejestr decyzji w `docs/team/`.
- **2026-11-26 (dzień 2, popołudnie i noc)** — Fala 1 zespołu zintegrowana: wizja v1 (game-director; dusza
  „ciepło paleniska niesione w głąb głodnej światła góry”, słownik znaczeń, 4 poziomy zoomu), biblia sztuki v1.1
  (concept-artist; wagi kreski w px, tusz, zakresy L* per warstwa, paleta ilustrowana, karty: krasnolud,
  Palenisko, huta, tylna ściana wnęki), walidator treści `npm run content:check` (57 reguł, krok CI) i przeglądarka
  danych `tools.html` (tools-programmer), audyt QA (10 błędów, plan testów M1–M3; BUG-009 w EventBus naprawiony
  od ręki), ekonomia F2-1 (waluta księgowa srebrny, odpływy, czarne złoto, kierunek Kręgów Otchłani). Pomiar
  tempa zespołu: 7 równoległych agentów wyczerpuje 5-godzinne okno limitu w ok. 1 h → maks. 4 naraz.
- **2026-11-27 (dzień 3, noc)** — Turniej nr 3 (styl ilustrowany), runda 1: 13 wariantów + kontrola R2B,
  252 rendery z zamrożonego builda, metryki per kontekst (gród / dzika głębia). Kreska 0,2% → 3,1% (i10),
  rozróżnialność skał w galerii ΔE 8,9 → 22–30, rudy względem skały bez straty. Finaliści: i10 Hybryda,
  i08 Głębia warstw, i12 Ciemna kopalnia; zawodnik biblioteczny (pmndrs/postprocessing) odpada. Przegląd
  producenta wykrył dwie wady wspólne finalistom, których rubryka nie złapała: naturalna skała wygląda jak mur
  (łamie test „kreska to kultura”) i tła wnęk są białawe (średnie L* ukrywało dwumodalny kadr). Runda 2: najpierw
  poprawki QA (BUG-001/002/005, `seed`) i trzy sceny tonu, potem finaliści × języki struktury skały naturalnej
  i nowa metryka regularności siatki. Równolegle: nawigacja z grawitacją (benchmark 3 algorytmów) i rdzeń
  symulacji etap 1 (mutacje świata, kopanie, zawały).
