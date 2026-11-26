# Skład zespołu (agenci-specjaliści)

Definicje: `.claude/agents/<id>.md` (rola, zasady, wymagana struktura odpowiedzi, kontekst projektu).
Sesja główna pełni rolę **Senior Executive Producer / Lead Producer** i deleguje zadania tym agentom.

| # | Id agenta | Rola | Obszar odpowiedzialności | Pierwsza fala |
|---|---|---|---|---|
| 19 | `game-director` | Senior Game / Creative Director | wizja, „dusza” gry, spójność dyscyplin, akceptacja kierunku | 1 |
| 16 | `producer` | Senior Game Producer / PM | harmonogram, zależności, rejestr ryzyk, plan kamieni milowych | 1 |
| 1 | `systems-designer` | Senior Systems & Game Designer | mechaniki, progresja, ekonomia (źródła/odpływy), exploity, balans | 2 |
| — | `level-systems-designer` | Senior Level & Systems Designer | makrostruktura świata, ryzyko–nagroda, bramy, gęstości zasobów, specyfikacja generatora | 2 |
| — | `lead-narrative-designer` | Lead Narrative Designer | biblia narracyjna, frakcje, towarzysze, spójność świata | 2 |
| — | `quest-designer` | Senior Quest Designer | dokumenty zadań (QDD), zadania jako dane | 2 |
| 3 | `narrative-writer` | Senior Narrative Designer & Writer | dialogi, Krążki Pamięci, opisy przedmiotów, ślady w świecie | 2 |
| 2 | `ui-ux-designer` | Senior Game UI/UX Designer | HUD, menu, ekwipunek, produkcja, mapa, sterowanie | 2 |
| 4 | `gameplay-programmer` | Senior Gameplay Programmer | symulacja: kopanie, budowa, zadania, walka, maszyny stanów | 2 |
| 5 | `engine-graphics-programmer` | Senior Engine & Graphics Programmer | potok renderowania, shadery, styl ilustrowany 2.5D, wydajność | 1 |
| 6 | `ai-programmer` | Senior AI Programmer | nawigacja z grawitacją, zachowania krasnoludów i potworów, taktyka | 2 |
| 7 | `tools-programmer` | Senior Tools Programmer | walidatory treści, podglądy, automaty turniejów, CI | 1 |
| 8 | `concept-artist` | Senior Concept Artist | biblia sztuki, koncepty postaci, budowli, biomów, rekwizytów | 1 |
| 9 | `artist-2d` | Senior 2D Artist & Illustrator | ikony (SVG), elementy UI, ilustracje, tekstury stylizowane | 3 |
| 11 | `animator-ta` | Senior Animator & Technical Artist | ruch postaci, rig proceduralny, materiały postaci, LOD | 3 |
| 12 | `vfx-artist` | Senior VFX Artist | efekty: kopanie, iskry rud, Pieśń, czarny ogień, lawa, zawały | 3 |
| 13 | `sound-designer` | Senior Sound Designer | efekty dźwiękowe syntetyzowane (Web Audio) | 3 |
| 14 | `composer` | Senior Game Composer | muzyka generatywna i adaptacyjna per biom | 3 |
| 15 | `audio-programmer` | Senior Audio Programmer / Technical Sound Designer | silnik audio, miks dynamiczny, przestrzeń, budżety | 3 |
| 17 | `qa-tester` | Senior QA Tester | plany testów, przypadki brzegowe, raporty, regresja | 1 |

Fale: **1** — fundamenty i ścieżka krytyczna nowego kierunku artystycznego; **2** — systemy, świat i narracja
w danych; **3** — postacie, efekty i dźwięk na bazie zatwierdzonej biblii sztuki i silnika.
Plan produkcji: `docs/team/PRODUCTION.md`; tablica zadań: `docs/team/BOARD.md`.

Uwagi do definicji ról: rola nr 13 (Sound Designer) dotarła ucięta po punkcie 1 struktury — sekcje 2–5
odtworzono analogicznie do pozostałych ról audio; role nr 10 i 18 nie zostały przekazane.
