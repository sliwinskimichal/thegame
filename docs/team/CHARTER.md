# Statut zespołu Underhearth

> Obowiązuje każdego agenta-specjalistę (`.claude/agents/*.md`) i sesję główną. Przeczytaj w całości przed
> pierwszym zadaniem, razem z `CLAUDE.md`.

## 1. Kto kim jest
- **Sesja główna = Senior Executive Producer / Lead Producer** (orkiestrator): przydziela zadania, pilnuje
  kamieni milowych, zdejmuje blokady, integruje wyniki, uruchamia testy i build, robi commity i push,
  prowadzi `docs/team/BOARD.md`, `docs/team/DECISIONS.md` i dziennik w `docs/ROADMAP.md`.
- **Właściciel projektu** (człowiek) ma ostatnie słowo w sprawach wizji, zakresu i stylu. Jego decyzje są
  w `CLAUDE.md` (sekcja „Twarde wymagania”) i w `docs/team/DECISIONS.md`.
- **20 agentów-specjalistów** — lista i zakresy w `docs/team/ROSTER.md`.

## 2. Projekt w jednym akapicie
Przeglądarkowa strategia kolonii krasnoludów w przekroju góry, oglądana jak żywa makieta 2.5D (Three.js r187,
TypeScript 7, Vite 8, Vitest). Pełna gra: ukończenie ok. 40 h, wymaksowanie ok. 120 h; 9 biomów w głąb,
26 złóż, 24 budowle × 3 poziomy, ~90 przedmiotów, zakryte drzewko badań, bossowie i najazdy, drużyna
9 towarzyszy z misjami rekrutacyjnymi i lojalnościowymi, finał z rozliczeniem przeżycia drużyny.

## 3. Źródła prawdy (czytaj zamiast zgadywać)
| Temat | Plik |
|---|---|
| Wymagania właściciela, polecenia, architektura, konwencje | `CLAUDE.md` |
| Wizja i pętle gry | `docs/GDD.md` |
| Treść jako dane (biomy, złoża, przedmioty, budowle, receptury, badania) | `src/content/*.ts`, `docs/CONTENT.md` |
| Balans i symulacje | `docs/BALANCE.md`, `src/balance/model.ts` |
| Fabuła, frakcje, towarzysze, zadania, projekt poziomów | `docs/narrative/` |
| Bramki jakości | `docs/QUALITY.md` |
| Plan i dziennik | `docs/ROADMAP.md` |
| Wyniki turniejów wariantów | `docs/variants/` |
| Decyzje (rejestr) | `docs/team/DECISIONS.md` |
| Tablica zadań | `docs/team/BOARD.md` |

## 4. Kierunek artystyczny (decyzja właściciela z 2026-11-26)
**Ilustrowany przekrój kolonii w 2.5D, trochę ciemniejszy niż referencja.** Referencja właściciela to rodzina
stylu „ręcznie rysowanej, przytulno-przemysłowej makiety kolonii”: gruby, lekko nierówny kontur (kreska),
płaskie plamy barwne z fakturą pędzla, przygaszona paleta, czytelne pomieszczenia piętro po piętrze,
gęsto zastawione maszynami, rurami i drabinami, ciepłe żarówki dające plamy światła.
- **Bierzemy rodzinę stylu, nie cudze projekty.** Nie wolno odtwarzać postaci, maszyn, ikon, interfejsu ani
  teł konkretnej gry. Nasze krasnoludy, budowle i tła projektujemy sami (język form z
  `docs/narrative/01-world.md` §10: „ciężka geometria podhalańska”, gnomie „szkło i miedź”, Prakowale
  „kamień, który śpiewa”).
- **2.5D**: zachowujemy głębię (wnęki wykopów, tylne ściany, światło z głębią), na którą nakładamy kreskę
  i ilustracyjne cieniowanie.
- **Ciemniej niż referencja, ale nie czarno**: lita skała jest widoczna i ma fakturę (nie czarna sylwetka),
  nastrój budują plamy światła. Cele mierzalne (pomiar referencji: `scripts/refstats.py` w scratchpadzie
  producenta, wyniki niżej):
  | Metryka (zrzut 960 px) | Referencja | Nasz R2B (noc) | **Cel** |
  |---|---|---|---|
  | średnia jasność L* | 43,5 | 27–37 | **36–40** |
  | udział czerni (L* < 15) | 11,6% | 32–41% | **15–22%** |
  | średnie nasycenie (chroma) | 14,6 | 21–25 | **13–18** |
  | piksele krawędzi (gradient L* > 18) | 29% | 0,4–3% | **≥ 15%** |
  | kreska (ciemne piksele na krawędzi) | 5,3% | 0,01–0,3% | **≥ 3%** |
- Wszystko generowane kodem (shadery, geometria proceduralna, SVG, Web Audio). Brak zewnętrznych tekstur
  i nagrań. Darmowe biblioteki (MIT/BSD/Apache/CC0) tylko po wygranym turnieju.

## 5. Zasady pracy (obowiązkowe)
1. **Turniej wariantów** dla wszystkiego, co gracz widzi, słyszy lub czuje: min. 10 wariantów w identycznych
   scenariuszach, plansza (`scripts/contact-sheet.py`), metryki, 2–3 finalistów, zwycięzca, zapis
   w `docs/variants/<element>.md`. Kod niewidoczny: benchmark 2–3 algorytmów + testy. Balans: Monte Carlo.
2. **Bramki jakości** z `docs/QUALITY.md` — „gotowe” tylko z dowodem (zrzut, test, pomiar).
3. **Treść jako dane** w `src/content/` + testy spójności. Nie wpisuj liczb balansu w kod systemów.
4. **Determinizm** symulacji (`Rng` z seeda; nigdy `Math.random` w `src/sim`, `src/world`). Gorące pętle na
   tablicach typowanych, bez alokacji.
5. **Język**: dokumentacja i UI po polsku, komentarze w kodzie po angielsku. Nazwy własne świata — tylko nasze
   (słowiańsko-górnicza tożsamość), żadnych nazw z cudzych gier i książek.
6. **Zakazy właściciela**: żadnego oswajania stworzeń ani stworzeń-pracowników; pracują krasnoludy, sojusznicze
   ludy (gnomy) i maszyny.
7. **Nie commituj i nie pushuj** — robi to producent po integracji. Nie edytuj plików wspólnych
   (`CLAUDE.md`, `docs/ROADMAP.md`, `docs/QUALITY.md`, `docs/GDD.md`, `docs/team/BOARD.md`,
   `docs/team/DECISIONS.md`) — zaproponuj zmianę w notatce przekazania.
8. **Pracuj tylko w swoich katalogach** (§6). Jeśli zadanie wymaga zmiany cudzego pliku — opisz ją w notatce
   przekazania albo w raporcie końcowym; producent zdecyduje.
9. Przed oddaniem pracy z kodem: `npx vitest run` i `npm run build` muszą przechodzić; podaj wyniki w raporcie.

## 6. Własność katalogów
| Obszar | Właściciel (główny) | Współpraca |
|---|---|---|
| `docs/team/vision/` | game-director | wszyscy czytają |
| `docs/team/production/` | producer | executive producer |
| `docs/design/systems/`, `src/balance/` | systems-designer | level-systems-designer |
| `docs/design/levels/`, generator świata (`src/world/worldgen*.ts`) | level-systems-designer | engine-graphics, ai |
| `docs/narrative/` (biblia, spójność) | lead-narrative-designer | quest-designer, narrative-writer |
| `docs/narrative/quests/`, dane zadań (`src/content/quests*.ts`) | quest-designer | narrative-writer, systems |
| `docs/narrative/texts/` (dialogi, Krążki, opisy) | narrative-writer | lead-narrative |
| `docs/design/ui/`, `src/ui/` | ui-ux-designer | gameplay, artist-2d |
| `src/sim/` (bez AI) | gameplay-programmer | ai, systems |
| `src/sim/ai/`, `src/sim/nav/` | ai-programmer | gameplay |
| `src/render/`, `src/lab/styles/`, `src/lab/` | engine-graphics-programmer | animator-ta, vfx |
| `scripts/`, `src/tools/`, `tests/tools/` | tools-programmer | qa |
| `docs/art/` (biblia sztuki, koncepty) | concept-artist | artist-2d, animator-ta |
| `src/art/icons/`, `docs/art/icons/` | artist-2d | ui-ux |
| `src/render/characters/`, `src/render/anim/` | animator-ta | engine-graphics |
| `src/render/vfx/`, `docs/art/vfx/` | vfx-artist | engine-graphics |
| `src/audio/sfx/`, `docs/audio/sfx/` | sound-designer | audio-programmer |
| `src/audio/music/`, `docs/audio/music/` | composer | audio-programmer |
| `src/audio/` (silnik, miks) | audio-programmer | sound, composer |
| `docs/qa/`, `tests/` (nowe testy przekrojowe) | qa-tester | wszyscy |
| `src/content/` | systems-designer (liczby), quest-designer (zadania), lead-narrative (nazwy) | producent rozstrzyga konflikty |

## 7. Przekazania i współpraca
- Agenci nie rozmawiają bezpośrednio — **komunikują się przez pliki**, a producent przekazuje ustalenia.
- **Notatka przekazania**: `docs/team/handoffs/RRRR-MM-DD-<od>-<do>-<temat>.md`:
  ```
  # <temat>
  Od: <rola> · Do: <rola> · Pilność: wysoka/średnia/niska
  ## Co oddaję (ścieżki)
  ## Co jest potrzebne od odbiorcy (konkretnie, z kryteriami)
  ## Decyzje do podjęcia (opcje, rekomendacja)
  ## Ryzyka i znane braki
  ```
- **Raport końcowy agenta** (ostatnia wiadomość do producenta): co zrobione (ścieżki), dowody (testy, zrzuty,
  metryki), otwarte kwestie, proponowane zmiany w plikach wspólnych, kogo to odblokowuje.
- **Łańcuch akceptacji**:
  | Rodzaj wyniku | Akceptuje |
  |---|---|
  | wizja, ton, styl, zgodność z „duszą gry” | game-director |
  | spójność fabuły i nazw | lead-narrative-designer |
  | liczby balansu, ekonomia | systems-designer (dowód: test/Monte Carlo) |
  | wydajność renderu i budżety GPU | engine-graphics-programmer |
  | jakość i regresje | qa-tester |
  | zakres, kolejność, cięcia | executive producer (sesja główna); spór wizji — właściciel |

## 8. Definicja „gotowe” dla zadania agenta
1. Wynik w docelowych ścieżkach, w strukturze wymaganej przez rolę.
2. Dowody: testy przechodzą, build przechodzi (jeśli dotyczy kodu), zrzuty/metryki (jeśli dotyczy obrazu/dźwięku).
3. Elementy postrzegalne: turniej min. 10 wariantów albo wyraźna informacja, że to wejście do turnieju.
4. Raport końcowy z listą otwartych kwestii i zmian proponowanych w plikach wspólnych.

## 9. Środowisko
- Serwer laboratorium: `npx vite --port 5174 --strictPort` (producent utrzymuje go na 5174). Agent pracujący
  w osobnym drzewie roboczym używa portu 5175+ i dowiązuje `node_modules` z głównego repozytorium.
- Laboratorium: `http://localhost:5174/lab.html?style=<id>&scenario=<id>`; galeria materiałów:
  `?world=gallery[&flood=1]`; turniej: `node scripts/tournament.mjs <url> <out> <entries.json|styles>`.
- npm: przed instalacją pakietów ustaw `npm_config_noproxy`/`NO_PROXY`/`no_proxy` = `localhost,127.0.0.1`.
- Playwright jest zainstalowany globalnie; w `.mjs` ładuj przez `createRequire`.
- Pliki tymczasowe: katalog scratchpad podany w zadaniu albo `/tmp/underhearth-<rola>/`.
