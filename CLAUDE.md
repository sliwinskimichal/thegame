# CLAUDE.md — instrukcje dla kolejnych sesji

Projekt: **Underhearth** — przeglądarkowa gra o krasnoludzkiej kolonii w przekroju 2.5D
(Three.js). Właściciel pisze po polsku; odpowiadaj po polsku. Interfejs gry po polsku (i18n PL/EN).

## Twarde wymagania zakresu gry (od właściciela, 2026-11-25)
- **Pełnoprawna gra, nie demo** — rozbudowany tytuł: ukończenie ok. **40 h**, wymaksowanie ok. **120 h**
  (minimum 20 h rozgrywki).
- **≥ 15 typów budowli**, każda z **3 poziomami ulepszeń**.
- **~80 przedmiotów użytkowych** dla krasnoludów (narzędzia, broń, pancerz, sprzęt środowiskowy, mikstury...).
- **≥ 20 rodzajów złóż**, **≥ 30 surowców** wypadających z obiektów/stworzeń, **60–80 materiałów wytwarzanych**.
- Wszystko osadzone w systemach (ekonomia, środowisko, zagrożenia): każdy nowy, głębszy biom wymaga
  nowego podejścia, nowych budowli, ekwipunku i bardziej zaawansowanej produkcji.
- Inspiracje: Factorio, Satisfactory (łańcuchy produkcji, automatyzacja), LOTR: Return to Moria
  (biomy kopalni, wyzwania środowiskowe, rzemiosło), Palworld — WYŁĄCZNIE najazdy na gród i bossowie
  strzegący biomów. **ZAKAZ: żadnego oswajania stworzeń ani stworzeń-pracowników** (decyzja właściciela).
  Pracują tylko krasnoludy i maszyny; stworzenia to zwierzyna i potwory (źródło dropu).
- **Samouczek ~1 h** na starcie, płynnie przechodzący w grę swobodną.
- **Drzewko technologii** (badania odblokowują budowle i przedmioty): węzły ukryte, dopóki gracz nie odkryje
  kluczowego surowca, ale skala i liczba zakrytych węzłów są widoczne.
- **Balans** całości — weryfikowany symulacjami progresji (docs/BALANCE.md).
- Treść jest danymi w `src/content/` (jedno źródło prawdy) + testy spójności grafu i minimów ilościowych.

## Jak pracować (wymagania właściciela — obowiązkowe)
1. **Głębia ponad tempo.** Pracuj „od limitu do limitu”; nie kończ tury, póki jest praca.
   Sesja wznawiana jest automatycznie co 5 h (zaplanowane zadanie `trig_01Y6ieq8SwSN8YiEXGtXzHgM`).
2. **Bramki jakości** — `docs/QUALITY.md`. Element przechodzi dalej dopiero po spełnieniu kryteriów
   z dowodami (zrzuty w `docs/progress/`, testy, pomiary).
3. **Turniej wariantów** — dla KAŻDEGO elementu, który gracz widzi, słyszy lub czuje, przygotuj
   **co najmniej 10 wariantów**, wyrenderuj je w identycznych scenariuszach, zestaw na planszy
   porównawczej (`scripts/contact-sheet.py`), oceń wg rubryki + metryk automatycznych
   (`scripts/metrics.py`), 2–3 finalistów dopracuj w drugiej rundzie, wybierz zwycięzcę.
   Zapisz wynik w `docs/variants/<element>.md` (tabela ocen + uzasadnienie + plansza).
   Dla kodu niewidocznego: benchmark 2–3 algorytmów tam, gdzie liczy się wydajność, i testy.
   Dla balansu/trudności/generatora: symulacje Monte Carlo wielu kolonii na wariant.
4. Po każdym ukończonym kroku: `npm test`, `npm run build`, commit, push na
   `claude/fervent-ptolemy-fv7lmn`, wpis w dzienniku `docs/ROADMAP.md`.

## Polecenia
```bash
npm run dev            # serwer deweloperski (http://localhost:5173)
npm test               # testy Vitest
npm run build          # typecheck (tsc 7) + build produkcyjny do dist/
node scripts/shot.mjs "http://localhost:5173/?x=70&y=-235&d=45&t=0.42&reveal=1" out.png 8000
WORLDMAP_OUT=map.png npx vitest run tests/worldmap.test.ts --silent=false   # mapa świata 2D + statystyki
```
Parametry URL (debug): `seed`, `x`, `y`, `d` (kamera), `t` (pora dnia 0..1), `reveal=1`.

**Sieć / npm w tym kontenerze:** `registry.npmjs.org` jest w `no_proxy`, ale DNS nie rozwiązuje go
bezpośrednio — przed `npm install` ustaw:
`export npm_config_noproxy="localhost,127.0.0.1" NO_PROXY="localhost,127.0.0.1" no_proxy="localhost,127.0.0.1"`.
Playwright w skryptach `.mjs` ładuj przez `createRequire` (pakiet globalny).

## Architektura
```
src/config.ts          stałe globalne (rozmiar świata, chunk, slab, tick)
src/core/              rng (sfc32, hashe), noise (simplex, fbm, ridged), events (EventBus)
src/world/             world.ts (SoA kafli, flagi, dirty-tracking), materials.ts, layers.ts,
                       decor.ts, worldgen.ts (generator), lighting.ts (pole światła: sweep max-decay)
src/sim/               symulacja (items.ts; dalej: nav, jobs, dwarves, buildings) — BEZ importów z render/
src/render/            gameRenderer (scena, pętla), terrainMesher (Z-heightfield), terrain (shader skał),
                       worldTextures (tekstury światła/mgły/stanu/materiałów), glsl (szum + model światła),
                       litMaterial (materiał propów/postaci), sky (niebo, krajobraz), post (bloom, grading)
src/input/             camera.ts (kamera makiety), dalej: input, narzędzia
src/ui/, src/audio/, src/i18n/  (do zrobienia)
tests/                 Vitest; worldmap.test.ts = narzędzie podglądu mapy (WORLDMAP_OUT)
scripts/               shot.mjs (zrzuty), contact-sheet.py, metrics.py
docs/                  GDD.md, ROADMAP.md, QUALITY.md, variants/, progress/
```
**Kierunek wizualny (turniej nr 1):** R2B „Sylwetki czytelne” — `src/lab/styles/round2.ts`
(baza: makieta `s01-diorama.ts` + ciemniejsza skała z poświatą krawędzi, iskrzące rudy, świecące powietrze).
Laboratorium: `lab.html?style=<id>&scenario=<id>`; turniej: `node scripts/tournament.mjs <url> <out> [style,...]`,
potem `python3 scripts/contact-sheet.py <out> [names.json]` i `python3 scripts/metrics.py <out>`.

Model renderingu: płyta skalna oglądana z przodu. Lita skała = płaszczyzna cięcia z=0, wnętrza
jaskiń/tuneli = wgłębienia (gładka tylna ściana z uśrednionych głębokości narożników), na
powierzchni pas gruntu o głębokości `CONFIG.slabDepth` przechodzi w krajobraz w tle.
Światło: tekstura RGBA (rgb = światło bloków, a = niebo), kierunek z gradientu pola.

## Konwencje
- Komentarze w kodzie po angielsku, dokumentacja i UI po polsku.
- Symulacja deterministyczna (tylko `Rng` z seeda, nigdy `Math.random` w `src/sim`/`src/world`).
- Gorące pętle na tablicach typowanych, bez alokacji; brak `glslVersion: GLSL3` w ShaderMaterial
  (three r187 i tak kompiluje GLSL ES 3.0 i definiuje `gl_FragColor`); unikaj słów zarezerwowanych GLSL
  (np. `patch`, `sample`, `input`, `output`, `filter`).
- Nie kopiujemy żadnej istniejącej gry (nazw, postaci, wyglądu) — gra jest oryginalna w swoim gatunku.
