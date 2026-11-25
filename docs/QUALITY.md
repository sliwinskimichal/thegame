# Bramki jakości (Definition of Done)

Zasada nadrzędna: **żaden element nie jest „gotowy”, dopóki nie spełnia wszystkich swoich
kryteriów, potwierdzonych dowodem** (zrzut ekranu, test, pomiar). Szybkość nie jest celem —
celem jest efekt „wow” i dopracowanie każdego detalu.

## Proces dla każdego elementu

1. **Kryteria** — spisane poniżej, mierzalne tam, gdzie się da.
2. **Narzędzie podglądu** — scena testowa / galeria / mapa, która pokazuje element w izolacji
   i w kontekście (np. `?gallery=materials`, `tests/worldmap.test.ts`).
3. **Iteracje** — poprawka → zrzut → ocena względem kryteriów → kolejna poprawka.
   Minimum 3 iteracje wizualne na element, nawet jeśli pierwsza „wygląda dobrze”.
4. **Scenariusze obowiązkowe** dla elementów wizualnych:
   - dzień / noc,
   - pochodnia blisko / ciemność / światło nieba w szybie,
   - zbliżenie (dystans ~12) / widok roboczy (~35) / oddalenie (~110),
   - co najmniej dwa różne seedy świata.
5. **Dowody** — zrzuty zapisane w `docs/progress/<element>/` (nazwa: `NN-opis.png`),
   testy w `tests/`, pomiary wydajności w opisie commita.
6. **Drugi przegląd** — po dodaniu systemów, które wpływają na element (np. postacie → światło),
   element wraca na listę do ponownej oceny. Status zmienia się wtedy na „do przeglądu”.

Statusy: `⬜ nie zaczęte` · `🟨 w pracy` · `🟦 do przeglądu` · `✅ spełnia bramkę`

---

## Fundamenty świata

### E1. Model danych świata (`src/world/world.ts`) — 🟨
- [ ] Wszystkie dane kafla w tablicach typowanych (SoA), indeks `y*w+x`, bez alokacji w gorących pętlach.
- [ ] Każda zmiana kafla przechodzi przez jedną ścieżkę (`dig`/`place`/`setFluid`) i unieważnia:
      chunki do przebudowy, światło, mgłę, stan nawigacji, dekoracje — pokryte testami.
- [ ] Zdarzenia zmian (tile changed / revealed / decor removed) emitowane do subskrybentów.
- [ ] Serializacja i deserializacja świata (kompresja) z testem „zapisz → wczytaj → identyczny”.
- [ ] Testy: granice świata, ujawnianie, oznaczanie chunków na krawędziach.

### E2. Materiały (`src/world/materials.ts`) — 🟨
- [ ] Każdy materiał ma: nazwę PL/EN, twardość, łup, kolorystykę, wzór, połysk, emisję, dźwięk kopania,
      kolor odłamków, wymagane narzędzie.
- [ ] **Galeria materiałów** (`?gallery=materials`): każdy materiał jako przekrój z tunelem
      (czoło, ściany, podłoga, sufit) pod 3 rodzajami światła (pochodnia, niebo, ciemność).
- [ ] Każdy materiał rozpoznawalny w 1 sekundę na widoku roboczym, bez podpisu.
- [ ] Rudy wyraźnie odróżnialne od skały macierzystej i od siebie nawzajem (także dla daltonistów:
      różnią się kształtem wzoru, nie tylko kolorem).
- [ ] Brak artefaktów: pasm „desek”, wzoru „ciasteczka”, powtarzalności widocznej z dystansu 35.
- [ ] Spójna paleta między warstwami (ziemiste u góry → chłodne → bioluminescencja → żar → mrok).

### E3. Generator świata (`src/world/worldgen.ts`) — 🟨
- [ ] Deterministyczny (test), < 400 ms dla 224×480 (test), żadnych „pływających” kafli płynów.
- [ ] Warstwy geologiczne z fałdami, uskokami i strefami przejściowymi (nie proste pasy).
- [ ] Rudy: żyły wzdłuż warstw i uskoków, gniazda, rzadkie „żyły-matki”; bogactwo rośnie z głębokością.
- [ ] Jaskinie zróżnicowane: korytarze, kominy, komory, zalane groty, rozpadliny, geody (puste kule
      wyłożone kryształami), grzybowe lasy, tunele lawowe.
- [ ] Powierzchnia: łąka startowa, las, skaliste zbocze góry, przynajmniej jedno naturalne wejście do jaskini.
- [ ] Miejsca specjalne: ruiny starożytnych, gniazda potworów, podziemne jezioro, Serce Góry.
- [ ] Start bezpieczny i czytelny: płaski teren pod wóz, brak jaskiń 25 kafli w głąb.
- [ ] Mapa `worldmap` dla 3 seedów oceniona: każda warstwa ma charakter rozpoznawalny bez legendy.

### E4. Światło (`src/world/lighting.ts`) — 🟨
- [ ] Pochodnia oświetla tunel ~10 kafli, nie przebija się przez >2 kafle skały (test).
- [ ] Światło dzienne wpada szybem i wejściami jaskiń (test), zmienia barwę z porą dnia.
- [ ] Brak widocznych schodków/pasm na przejściach światła w skale.
- [ ] Przeliczenie całego świata < 50 ms; aktualizacje lokalne < 5 ms (pomiar).
- [ ] Ruchome światła (latarnie krasnoludów) z okluzją przez skałę.

### E5. Renderer terenu (`src/render/terrain*.ts`) — 🟨
- [ ] Przekrój czyta się natychmiast: lita skała vs wnętrze tunelu vs nieodkryte.
- [ ] Brak efektu „klocków Minecrafta”: krawędzie wykopów fazowane/nieregularne,
      tylne ściany jaskiń gładkie, naturalne jaskinie organiczne.
- [ ] Brak dziur, migotania, z-fightingu (sprawdzone na zbliżeniu i oddaleniu).
- [ ] Pęknięcia przy kopaniu i oznaczenia rozkazów czytelne także w ciemności.
- [ ] Przebudowa chunka < 4 ms; 60 FPS na zintegrowanym GPU przy widoku roboczym.

### E6. Powierzchnia i niebo (`src/render/sky.ts`) — 🟨
- [ ] Płynny cykl dnia: świt, dzień, zmierzch, noc z gwiazdami i księżycem.
- [ ] Krajobraz w tle łączy się z przekrojem bez szwu; góry naturalne, nie „szpikulce”.
- [ ] Chmury objętościowe w wyglądzie (nie mgła), drzewa w tle o sylwetkach lepszych niż stożki.

### E7. Dekoracje · E8. Płyny · E9. Post-processing · E10. Kamera — ⬜
Kryteria zostaną rozpisane przed rozpoczęciem każdego z nich (patrz ROADMAP).

---

## Rozgrywka (rozpisywane przed startem danej fazy)

E11 Krasnoludy (model, animacje, osobowości) · E12 Nawigacja · E13 Zadania i AI ·
E14 Przedmioty i magazyny · E15 Budowanie · E16 Produkcja i potrzeby · E17 Potwory i walka ·
E18 Interfejs · E19 Dźwięk i muzyka · E20 Zapis/wczytanie · E21 Samouczek · E22 Wydajność i mobile
