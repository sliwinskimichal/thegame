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
- **Samouczek ~1 h** na starcie, płynnie przechodzący w grę swobodną. Przewodnikiem jest **stary król**, który
  ginie w zawale tunelu na końcu samouczka i przekazuje władzę następcy (graczowi) — decyzja właściciela.
- **Główny przeciwnik**: oryginalny demon cienia i ognia z głębin, *na wzór* archetypu balroga — bez nazw
  i szczegółów z Tolkiena (decyzja właściciela; nazwy własne wymyślamy sami).
- **Warstwa drużyny (RPG)** inspirowana Dragon Age: Origins / Mass Effect 2: nazwani towarzysze w kolonii
  (frakcja, klasa społeczna, światopogląd), misje rekrutacyjne i lojalnościowe, konflikty w drużynie, finał,
  w którym stawką jest przeżycie drużyny. Biblia narracyjna: `docs/narrative/`.
- **Gnomy** to sojuszniczy lud wynalazców (mogą prowadzić badania i budować wynalazki) — ludzie, nie stworzenia;
  zakaz oswajania stworzeń obowiązuje dalej. Pracują krasnoludy, sojusznicze ludy i maszyny.
- **Drzewko technologii** (badania odblokowują budowle i przedmioty): węzły ukryte, dopóki gracz nie odkryje
  kluczowego surowca, ale skala i liczba zakrytych węzłów są widoczne.
- **Balans** całości — weryfikowany symulacjami progresji (docs/BALANCE.md).
- Treść jest danymi w `src/content/` (jedno źródło prawdy) + testy spójności grafu i minimów ilościowych.

## Zespół i rola tej sesji (decyzja właściciela, 2026-11-26)
- **Sesja główna = Senior Executive Producer / Lead Producer**: planuje fale pracy, deleguje zadania
  agentom-specjalistom, zdejmuje blokady, integruje wyniki (testy, build, zrzuty), commituje i pushuje,
  prowadzi `docs/team/BOARD.md`, `docs/team/DECISIONS.md` i dziennik w `docs/ROADMAP.md`.
- **20 agentów-specjalistów** zdefiniowanych w `.claude/agents/*.md` (skład: `docs/team/ROSTER.md`), zasady
  współpracy, własność katalogów i przekazania: `docs/team/CHARTER.md`; plan produkcji: `docs/team/PRODUCTION.md`.
  Agenci nie commitują i nie edytują plików wspólnych; kończą raportem końcowym.
- Jeśli typ agenta nie jest jeszcze załadowany w sesji, uruchom `general-purpose` z poleceniem przeczytania
  `.claude/agents/<id>.md` i działania jako ta rola. Maks. 4 agentów równolegle (7 naraz wyczerpało 5-godzinny limit użycia); przerwanego agenta wznawiaj przez SendMessage, nie od nowa.

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
   **Darmowe biblioteki zewnętrzne** (np. post-processing, AO, shadery) wolno wprowadzić, jeśli wygrają turniej
   z naszym rozwiązaniem w identycznych scenariuszach (licencja MIT/BSD/Apache/CC0, rozmiar paczki w ocenie).
4. Po każdym ukończonym kroku: `npm test`, `npm run build`, commit, push na
   `claude/fervent-ptolemy-fv7lmn`, wpis w dzienniku `docs/ROADMAP.md`.

## Polecenia
```bash
npm run dev            # serwer deweloperski (gra: http://localhost:5173, src/main.ts — na razie zaślepka)
npm test               # testy Vitest
npm run build          # typecheck (tsc 7) + build produkcyjny do dist/
npx vite --port 5174 --strictPort                       # serwer laboratorium (producent trzyma go na 5174)
node scripts/tournament.mjs http://localhost:5174 <out> <entries.json|style,...> 960 540 2   # turniej
python3 scripts/contact-sheet.py <out> [names.json]     # plansze porównawcze
python3 scripts/metrics.py <out>                        # czytelność przekroju (arena)
python3 scripts/galmetrics.py <out> [--detail]          # rozróżnialność materiałów per biom (galeria)
python3 scripts/refstats.py <zrzuty...>                 # styl vs referencja właściciela (cele CHARTER §4)
CONTENT_DOC=1 npx vitest run tests/contentdoc.test.ts   # regeneruje docs/CONTENT.md
BALANCE_REPORT=1 npx vitest run tests/balance.test.ts --silent=false   # raport balansu
ARENA_OUT=map.png npx vitest run tests/arena.test.ts    # podgląd mapy areny
```
Laboratorium: `lab.html?style=<id>&scenario=<id>[&world=gallery][&flood=1][&mat=<wariant>][&hud=0]`
(automatyzacja przez `window.__lab`: `styles`, `scenarios`, `setScenario`, `probes`, `layout`, `frameMs`).

**Sieć / npm w tym kontenerze:** `registry.npmjs.org` jest w `no_proxy`, ale DNS nie rozwiązuje go
bezpośrednio — przed `npm install` ustaw:
`export npm_config_noproxy="localhost,127.0.0.1" NO_PROXY="localhost,127.0.0.1" no_proxy="localhost,127.0.0.1"`.
Playwright w skryptach `.mjs` ładuj przez `createRequire` (pakiet globalny).

## Architektura (stan faktyczny)
```
src/config.ts          stałe globalne (rozmiar świata, chunk, głębokość gruntu, tick, doba)
src/core/              rng.ts (sfc32 + hashe), noise.ts (simplex, fbm, ridged), events.ts (EventBus)
src/content/           biblia treści jako dane: biomes, resources, sources (złoża, obiekty, stworzenia),
                       buildings, recipes, tech, greatworks, types; analysis.ts (analiza progresji)
src/balance/model.ts   model tempa gry + Monte Carlo (cele 40 h / 120 h)
src/world/             world.ts (SoA kafli, wnęki, płyny, flagi, rekwizyty), materials.ts (44 materiały
                       powiązane z treścią), lightfield.ts (pole światła: max-decay, niebo, emitery)
src/render/            shaderlib.ts (szum, model światła, procedury skał i form minerałów), worldTex.ts
                       (tekstury świata dla shaderów), palette.ts (wygląd materiałów), paletteCheck.ts,
                       heightfield.ts (geometria przekroju), propsGeo.ts (rekwizyty, manekiny), fluids.ts,
                       sky.ts, daylight.ts, post.ts (bloom, gradacja)
src/lab/               laboratorium turniejów: main.ts, arena.ts, gallery.ts (galeria biomów), scenarios.ts,
                       common.ts (uniformy i pokrętła z URL), materialVariants.ts, styles/ (style renderu)
src/main.ts            gra (zaślepka — gra powstaje w fazach B–C)
src/sim/, src/ui/, src/audio/, src/tools/   (do zbudowania przez zespół — własność katalogów: docs/team/CHARTER.md §6)
tests/                 Vitest: core, arena, content (+contentdoc), balance, palette
scripts/               tournament.mjs, contact-sheet.py, metrics.py, galmetrics.py, matmetrics.py, refstats.py, shot.mjs
docs/                  GDD, ROADMAP, QUALITY, BALANCE, CONTENT, narrative/, variants/, team/
.claude/agents/        definicje 20 agentów-specjalistów
```
**Materiały (turniej nr 2):** 44 materiały (26 złóż z biblii treści + skały 9 biomów) w `src/world/materials.ts`,
wygląd w `src/render/palette.ts` (paleta per biom + forma minerału + kolor połysku), reguły w
`docs/variants/02-materials.md`; galeria `lab.html?world=gallery[&flood=1]`, metryki `scripts/galmetrics.py`,
strażnik palety `tests/palette.test.ts`.
**Kierunek wizualny (decyzja właściciela 2026-11-26):** **ilustrowany przekrój kolonii w 2.5D** — rodzina stylu
z referencji właściciela (ręczny kontur, płaskie plamy z fakturą, przygaszona paleta, gęsto zastawione
pomieszczenia, ciepłe plamy światła), **trochę ciemniejszy** niż referencja; własne projekty, zero cudzych
assetów. Cele mierzalne w `docs/team/CHARTER.md` §4, pomiar `python3 scripts/refstats.py <zrzut>`; referencja
leży lokalnie w `.reference/owner-style.jpg` (git-ignored — to zrzut innej gry, nigdy nie commitować).
Rozstrzyga turniej nr 3 (styl ilustrowany). Poprzedni zwycięzca R2B „Sylwetki czytelne”
(`src/lab/styles/round2.ts`) zostaje bazą oświetlenia i nastroju.
Model renderingu: płyta skalna oglądana z przodu. Lita skała = płaszczyzna cięcia z=0, wnętrza
jaskiń/tuneli = wgłębienia (gładka tylna ściana z uśrednionych głębokości narożników), na
powierzchni pas gruntu o głębokości `CONFIG.groundDepth` przechodzi w krajobraz w tle.
Światło: tekstura RGBA (rgb = światło bloków, a = niebo), kierunek z gradientu pola.

## Konwencje
- Komentarze w kodzie po angielsku, dokumentacja i UI po polsku.
- Symulacja deterministyczna (tylko `Rng` z seeda, nigdy `Math.random` w `src/sim`/`src/world`).
- Gorące pętle na tablicach typowanych, bez alokacji; brak `glslVersion: GLSL3` w ShaderMaterial
  (three r187 i tak kompiluje GLSL ES 3.0 i definiuje `gl_FragColor`); unikaj słów zarezerwowanych GLSL
  (np. `patch`, `sample`, `input`, `output`, `filter`).
- Nie kopiujemy żadnej istniejącej gry (nazw, postaci, wyglądu) — gra jest oryginalna w swoim gatunku.
