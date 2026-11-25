# Roadmapa — Underhearth (plan na ~30 dni pracy)

Praca idzie **w głąb, nie wszerz**: element przechodzi dalej dopiero po spełnieniu bramki
z `docs/QUALITY.md`. Kolejność faz wynika z zależności (światło → materiały → postacie → ...).
Sesje wznawiają się automatycznie co 5 h (zaplanowane zadanie) — każda sesja zaczyna od
pierwszego niezaznaczonego punktu poniżej.

## Faza A — Świat, który zachwyca sam w sobie (dni 1–7)
- [x] A0. Szkielet projektu: Vite 8 + TypeScript 7 + Three.js r187 + Preact, CI → GitHub Pages
- [x] A1. ~~Prototyp: model świata, generator, światło~~ (zarchiwizowany w `4416b41`)
- [x] A2. ~~Prototyp renderera 2.5D~~ (zarchiwizowany — wystartuje jako jeden z wariantów)
- [ ] A2.5. **Laboratorium turniejów**: arena, scenariusze, automat zrzutów, plansze, metryki
- [ ] A2.6. **Turniej nr 1 — styl wizualny** (12 stylów renderowania areny)
- [ ] A3. **Galeria materiałów** i dopracowanie każdego z 25 materiałów (E2)
- [ ] A4. Przekrój bez „klocków”: fazowane krawędzie, czytelność skała/wnętrze/nieodkryte (E5)
- [ ] A5. Światło bez pasm, kolorowe źródła, światło nieba w szybach, okluzja latarni (E4)
- [ ] A6. Generator 2.0: fałdy i uskoki warstw, żyły rud, geody, typy jaskiń, wejście do jaskini,
      miejsca specjalne (E3)
- [ ] A7. Powierzchnia i niebo: góry, chmury, drzewa w tle, cykl dnia (E6)
- [ ] A8. Dekoracje: stalaktyty, stalagmity, grzyby (także olbrzymie), kryształy, korzenie, kości,
      kolumny, trawa i kwiaty z wiatrem (E7)
- [ ] A9. Płyny: woda (półprzezroczysta, kaustyki, powierzchnia z falą), lawa (żar, bąble) (E8)
- [ ] A10. Post-processing i kamera: bloom, grading, tilt-shift do trybu zdjęć, kamera z paralaksą (E9, E10)

## Faza B — Krasnoludy (dni 8–12)
- [ ] B1. Proceduralny model krasnoluda: brody, hełmy, ubrania, narzędzia, latarnia; LOD
- [ ] B2. Animacje proceduralne: chód, wspinaczka, kopanie, noszenie, sen, jedzenie, walka, upadek
- [ ] B3. Nawigacja z grawitacją: chodzenie, stopnie, zeskoki, drabiny, platformy (+ testy)
- [ ] B4. System zadań: kopanie, szyb z drabiną, noszenie, budowa; priorytety i rezerwacje
- [ ] B5. Osobowości: imiona (PL), cechy, umiejętności, nastrój, relacje; portrety 3D
- [ ] B6. Przedmioty i magazyny: wypadanie łupu, odłamki skał, transport, wóz startowy

## Faza C — Gród (dni 13–17)
- [ ] C1. Budowanie: plany, dostarczanie materiałów, postęp budowy, rozbiórka
- [ ] C2. Konstrukcje: drabiny, platformy, schody, drzwi, pochodnie, podpory, mury
- [ ] C3. Pomieszczenia: sypialnie, jadalnia, magazyny; Palenisko (serce grodu) i jego ulepszenia
- [ ] C4. Produkcja: kamieniarz, huta, kuźnia, browar, kuchnia, farma grzybów, stolarnia
- [ ] C5. Potrzeby: głód, pragnienie (piwo!), sen, nastrój; konsekwencje zaniedbań
- [ ] C6. Interfejs: pasek zasobów, narzędzia, panel krasnoluda, powiadomienia, minimapa głębokości

## Faza D — Zagrożenia (dni 18–21)
- [ ] D1. Potwory per warstwa (pełzacze, pająki, gobliny, trolle, ogniste chochliki, koszmary głębin)
- [ ] D2. Walka, rany, śmierć, groby i żałoba; straż i uzbrojenie z kuźni
- [ ] D3. Obrona: drzwi, pułapki, mury, światło jako broń
- [ ] D4. Reżyser zdarzeń (tempo zagrożeń wg bogactwa i głębokości), kronika grodu

## Faza E — Głębia i cel gry (dni 22–25)
- [ ] E1. Postęp przez warstwy: nowe surowce, technologie, wyzwania środowiskowe
- [ ] E2. Płyny symulowane: zalewanie tuneli, lawa + woda = obsydian, pompy
- [ ] E3. Zawały i podpory (integralność stropów)
- [ ] E4. Serce Góry: finał, starożytny strażnik, zakończenie; tryb nieskończony

## Faza F — Szlif i dostępność (dni 26–30)
- [ ] F1. Dźwięk: proceduralne efekty, przestrzenny pogłos jaskiń, generatywna muzyka zależna od głębokości
- [ ] F2. Zapis/wczytanie (IndexedDB + eksport pliku), autozapis
- [ ] F3. Menu główne z żywą makietą świata, ustawienia (grafika, dźwięk, język PL/EN, skala UI)
- [ ] F4. Samouczek przez cele, podpowiedzi kontekstowe
- [ ] F5. Wydajność (Web Worker dla symulacji/świateł), sterowanie dotykiem, PWA offline
- [ ] F6. Balans, testy gry, poprawki — drugie przeglądy wszystkich bramek jakości

---

## Dziennik pracy
Każda sesja dopisuje: datę, co zrobiono, co zostało, decyzje.

- **2026-11-25 (dzień 1)** — Szkielet projektu, generator świata (7 warstw, rudy, jaskinie, płyny,
  ruiny, Serce Góry), pole światła (pochodnie, niebo), renderer 2.5D (gładkie ściany jaskiń,
  proceduralne materiały), niebo z cyklem dnia i krajobrazem w tle, post-processing.
  Zmiana procesu na bramki jakości po uwadze, że tempo szło kosztem detalu.
  Wznawianie pracy: zaplanowane zadanie co 5 h.
- **2026-11-25 (dzień 1, cd.)** — Nowe ustalenia: każdy element widoczny/słyszalny/odczuwalny
  powstaje przez **turniej min. 10 wariantów** (plansze porównawcze + rubryka + metryki), balans
  przez symulacje Monte Carlo. **Czysta karta**: prototyp usunięty z drzewa roboczego (zostaje w
  historii gita, commit `4416b41`); zachowane tylko biblioteki techniczne (RNG, szum, zdarzenia),
  konfiguracja, CI i dokumentacja. Plan faz poniżej zostaje, ale każdy punkt przechodzi przez turniej.
