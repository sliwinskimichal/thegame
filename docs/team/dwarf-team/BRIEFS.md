# Zespół krasnoludów (F3-1) — kontrakt i briefy

> Lider: **animator-ta** · Data: 2026-11-27 · Decyzja właściciela: zespół 4 osób pracuje wyłącznie nad krasnoludami.
> Producent uruchamia pracowników dokładnie na tych briefach i przekazuje liderowi ich raporty.
> Zadanie: turniej ≥ 10 wariantów modelu krasnoluda × 4 role, rig proceduralny, cykle ruchu, maszyna stanów,
> stanowisko zrzutów, metryki, plansza dla właściciela (`docs/variants/04-dwarf.md`).

## 0. Zasady wspólne (obowiązują każdego pracownika)

1. **Przeczytaj przed pracą**: `CLAUDE.md`, `docs/team/CHARTER.md` §4–§7, `docs/art/concepts/dwarf.md`
   (karta konceptu — główne źródło wyglądu), `docs/art/ART-BIBLE.md` §0, §2.3–§2.4, §4.3, §5.3,
   `docs/team/vision/VISION.md` (wiersze „Postacie krasnoludów” i „Skala zoomu”), ten plik w całości oraz
   **kontrakt w kodzie**:
   - `src/render/anim/types.ts` — osie, jednostki, kości i rodzice, `PoseFrame`, wejścia z symulacji
     (`AnimInput`, `AnimEdge` z `path.moves` i `agent.progress`, `AnimEvent`), wyjścia (`AnimNotify`, stany `AS`),
     interfejs klipu (`AnimClip`) i animatora (`DwarfAnimator`, `CreateAnimator`);
   - `src/render/characters/types.ts` — proporcje, role, stany społeczne, sloty barw, części (`PartDef`),
     `DwarfSpec`, `DwarfModel`, `DwarfMesh` (kontrakt atrybutów siatki), techniki, `DwarfVariant`,
     renderer tłumu, zoomy, lista ujęć `SHOT_IDS`, metryki, API `window.__dwarf`;
   - `src/render/characters/direction.ts` — **kierunek artystyczny jako dane** (lider): presety proporcji
     A/B/C/A+/3,0, `referenceJoints()`, role (`ROLE_DIRECTION`), palety, akcenty stanu, pasma wartości,
     zoomy i wagi kreski, czasy ruchu z karty.
2. **Kontraktu nie zmieniasz.** Plików `types.ts` i `direction.ts` nie edytuje nikt poza liderem. Jeśli
   czegoś brakuje — dopisz prośbę w raporcie (co, dlaczego, propozycja typu), producent przekaże ją liderowi.
   Do czasu decyzji obejdź brak lokalnie w swoim katalogu.
3. **Pracujesz tylko w swoich plikach** (tabela §1). Cudze moduły importujesz wyłącznie przez ich publiczne
   wejścia: `src/render/characters/model/index.ts` (W1), `src/render/anim/index.ts` (W2) i pliki kontraktu —
   nigdy z plików wewnętrznych innego pracownika. Zaślepki `index.ts` napisał lider; ich właściciel je zastępuje,
   zachowując eksportowane nazwy.
4. **Nie edytujesz plików silnika i wspólnych**: `src/lab/**`, istniejących `src/render/*.ts`, `src/sim/**`,
   `src/world/**`, `CLAUDE.md`, `docs/ROADMAP.md`, `docs/QUALITY.md`, `docs/team/*.md`. Importować wolno.
   Jeśli czegoś z silnika nie da się użyć bez zmiany — skopiuj minimum do swojego katalogu z komentarzem
   „copied from …, reason …” i opisz potrzebę integracji w raporcie. Wyjątek: W3 dopisuje jedną pozycję
   `dwarves: 'dwarves.html'` w `vite.config.ts` → `build.rollupOptions.input` (zgoda producenta).
5. **Nie commitujesz.** Komentarze w kodzie po angielsku, dokumentacja i raport po polsku.
6. **Determinizm**: żadnego `Math.random` (użyj `Rng` / hashy z `src/core/rng.ts`); ten sam seed → te same bufory.
   Gorące pętle bez alokacji (tablice typowane).
7. **Bramka przed raportem**: `npx tsc --noEmit -p .`, `npx vitest run tests/anim` i `npm run build` przechodzą.
   `tests/sim/colony.test.ts` może chwilowo nie przechodzić (praca gameplay) — nie Twój problem; podaj wyniki.
8. **Oryginalność**: żadnych postaci, sylwetek ani znaków z istniejących gier (zwłaszcza krasnoludów z gier
   o koloniach i z referencji właściciela). Bez chibi, rogów, kiltów, gagów. Zakaz oswojonych stworzeń.
9. **Serwery**: laboratorium producenta działa na 5174 (HMR z pracy innych agentów). Do własnych testów
   w przeglądarce używaj portu **5175 (W3)**, **5176 (W1)**, **5177 (W2)**: `npx vite --port 517x --strictPort`.
   Playwright ładuj przez `createRequire` (pakiet globalny), Chromium z SwiftShader jak w `scripts/tournament.mjs`.
   Pliki tymczasowe w swoim scratchpadzie.
10. **Raport końcowy** (ostatnia wiadomość): co zrobione (ścieżki), dowody (testy, liczby, zrzuty),
    odstępstwa od briefu i dlaczego, prośby o zmianę kontraktu, otwarte kwestie, kogo odblokowuje.

## 1. Podział zespołu i własność plików

| Kto | Rola | Pliki na wyłączność | Publiczne wejście |
|---|---|---|---|
| **Lider** (animator-ta) | integracja, kierunek artystyczny, kontrakt, ocena turnieju, dokument i plansza dla właściciela | `src/render/anim/types.ts`, `src/render/characters/types.ts`, `src/render/characters/direction.ts`, `docs/team/dwarf-team/**`, `docs/variants/04-dwarf.md`, `docs/variants/04-dwarf/**` | — |
| **W1 „Modelarz”** | budowniczowie ≥ 10 wariantów × 4 role × 3 LOD, specyfikacje i palety z seeda | `src/render/characters/model/**`, `tests/anim/model/**` | `model/index.ts`: `DWARF_VARIANTS`, `makeSpec` |
| **W2 „Animator ruchu”** | rig (FK), IK stóp i dłoni (kafle, stopnie, drabina), cykle, warstwy, ruch wtórny, maszyna stanów, metryki ruchu | `src/render/anim/**` (bez `types.ts`), `tests/anim/rig/**` | `anim/index.ts`: `createAnimator`, `animMetrics` |
| **W3 „Technical artist”** | materiały postaci w stylu i08 + L00, renderer tłumu (instancjonowanie, tekstura kości, LOD), stanowisko `dwarves.html`, skrypt turnieju, metryki obrazu i kosztu | `src/render/characters/render/**`, `src/render/characters/lab/**`, `src/render/characters/lab.ts`, `dwarves.html`, `scripts/dwarf-tournament.mjs`, jedna linia w `vite.config.ts`, `tests/anim/render/**` | strona `dwarves.html` + `window.__dwarf` |

**Etapy zespołu** (każdy pracownik raportuje po E1 krótko w swoim raporcie częściowym, jeśli producent o to poprosi;
inaczej jeden raport po E2):
- **E1 — pionowy przekrój**: W1 warianty d01, d02, d04 × 4 role × 3 LOD + `makeSpec`; W2 rig, IK, `idle`, `walk`,
  `pose()`; W3 materiały, renderer tłumu (tryb `welded`), strona z ujęciami `izba`, `grod`, `walk8`, szkielet skryptu.
- **E2 — całość**: W1 pozostałe warianty (d03, d05–d12); W2 `dig`, `build`, `climb`, `carry`, `flee`, `stunned`,
  ruch wtórny, maszyna stanów; W3 wszystkie ujęcia `SHOT_IDS`, tryb `parts`, metryki, `bench(200)`, skrypt pełny.
- **E3 — turniej** (lider): zamrożony build, przebieg, plansze, ocena, finaliści, plan rundy 2.

---

## 2. Brief W1 — „Modelarz”

**Cel.** Krasnolud jako **dane** (lista części z kości, kształtu, barwy i roli) i **≥ 10 technik konstrukcji**, które
z tych samych danych budują siatkę. Każdy wariant buduje 4 role (hajer, cieśla, tragarz, kowal) w 3 LOD
(Izba / Gród / Okolica), deterministycznie z seeda. Rola musi się czytać z samej czarnej sylwetki przy 75 px
i — w uproszczeniu — przy 24 px: **nakrycie głowy + narzędzie + element na plecach** (karta §2).

**Pliki na wyłączność**: `src/render/characters/model/**` (np. `spec.ts`, `anatomy.ts`, `roles.ts`, `geometry.ts`,
`hull.ts`, `lod.ts`, `techniques/*.ts`, `variants.ts`, `index.ts` — zastąp zaślepkę), `tests/anim/model/**`.

**Wejścia z kontraktu**: `PartDef`/`PartShape`, `DwarfSpec`, `DwarfModel`, `DwarfMesh`, `MESH_ATTRIBUTES`, `SLOT`,
`VAR_SLOTS`, `LOD`, `LOD_TRIANGLE_BUDGET`, `Technique`, `DwarfVariant`, `MakeSpec` (characters/types.ts);
`BONE`, `RigInput`, `ToolInfo`, `LampInfo`, `HOLD` (anim/types.ts); `PROPORTION_PRESETS`, `referenceJoints`,
`ROLE_DIRECTION`, `BEARD_COLORS`, `SKIN_*`, `FIXED_COLORS`, `SOCIAL_ACCENT`, `VALUE_BANDS` (direction.ts).

**Wyjścia** (`model/index.ts`):
- `makeSpec(seed, role, social, proportions)`: paleta roli z `ROLE_DIRECTION` (tunika ±4° odcienia, C\* ≤ 26,
  L\* stroju 30–48), broda z `BEARD_COLORS` z **ΔL\* ≥ 15 do tuniki** (deterministyczne ponowne losowanie),
  skóra `SKIN_BASE` ±8 L\*, akcent z `SOCIAL_ACCENT`, `braids` z roli, `beardShape` z seeda.
- `DWARF_VARIANTS` — dokładnie ta lista (id są wiążące, opisy `namePl`/`descPl` po polsku):

| id | technika | proporcje | yaw [°] | istota |
|---|---|---|---|---|
| `d01-karta` | `primitives` | A | 40 | kule, kapsuły, prostopadłościany, stożki ściśle wg tabeli karty — wariant kontrolny |
| `d02-toczone` | `lathe` | A | 40 | tułów-beczka, hełm, kaptur, kończyny i buty jako profile toczone/wyciągane (gładki obrys) |
| `d03-fasety` | `faceted` | A | 40 | niska liczba segmentów (4–6), płaskie cieniowanie, lekkie „struganie” wierzchołków z seeda |
| `d04-wycinanka` | `papercut` | A | 0 | płaskie karty 2.5D (profil części, grubość 0,02–0,04) w trzech warstwach z (`layer`): daleka, ciało, bliska |
| `d05-drewno` | `carved` | A | 40 | figurka rzeźbiona: bryły z fazami (chamfer), walce jako graniastosłupy 8-boczne z fazowanymi końcami |
| `d06-kontur` | `outline` | A | 25 | sylwetki części jako kontury 2D wyciągnięte z mocnym zaokrąglonym fazowaniem (bevel) |
| `d07-czesci` | `parts` | A | 40 | te same kształty co d01, ale `mode: 'parts'` (instancjonowana część = osobna siatka w przestrzeni kości) — bliźniak kosztowy |
| `d08-glina` | `sdf` | A | 40 | jedna gładka skóra z prymitywów SDF (smooth-min) metodą surface nets, wagi 2 kości (zachowanie objętości w stawach); narzędzia twarde jak d01 |
| `d09-beczka` | `primitives` | B | 40 | 3,2 głowy, okrąglejszy tułów, krótsza broda |
| `d10-slup` | `primitives` | C | 40 | 3,6 głowy, 1,40 kafla, węższe barki |
| `d11-kowadlo` | `primitives` | A+ | 40 | barki 0,68, dłonie 0,16, broda 0,40 — przerysowane kowadło |
| `d12-trzy-glowy` | `primitives` | 3,0 | 40 | dolna granica wizji (3,0 głowy) — strażnik przeciw chibi |

Kolejność dostaw: **d01, d02, d04** (E1), potem d03, d05, d06, d07, d09–d12, na końcu d08 (najwięcej ryzyka;
jeśli nie zdążysz — zgłoś, nie zastępuj innym wariantem bez zgody lidera).

**Anatomia (karta §2, w kaflach; wszystkie warianty z tych samych części):**
- korzeń na ziemi; stawy ciała **dokładnie** z `referenceJoints(proporcje)` (gniazda możesz przesunąć);
- głowa: elipsoida/kula r ≈ 0,16 nad podbródkiem (podbródek–ciemię = `headH`), **wydatny nos** r 0,055,
  łuk brwi 0,2 × 0,05 × 0,08 (slot BEARD), oczy jako 2 kropki tuszu (tylko LOD0), wąsy;
- broda-klin od podbródka w dół na `beardLen`, szer. góra 0,26 → dół `beardW`, gł. 0,12, pochylona 8° w przód;
  górna połowa na `BEARD`, dolna na `BEARD2`; warkocze (`braids`) z koralikami pod końcem brody (LOD0–1);
- barki: spłaszczona elipsoida `shoulderW` × 0,22 × 0,34 na `CHEST`; tułów-beczka r `chestR` → `bellyR`
  od pasa do barków na `SPINE`; dolna tunika (spódnica tuniki) 0,30–0,52 na `PELVIS`; pas r 0,27 h 0,06 + klamra;
- ramię + dłoń `armLen`; **dłoń `handS` (⅓ głowy, przerysowana)**; rękawy slot TUNIC/TUNIC2;
- nogi z butami `legH` (23% wzrostu): udo, goleń, **but 0,10 × 0,22 z dużym noskiem** (slot FIXED `boot`);
- kolory: 70% strój (TUNIC/TUNIC2), 20% broda/skóra/narzędzie, 10% twarz/dłonie/lampka/akcent.

**Role** (szczegóły w `ROLE_DIRECTION`; każdy element roli ma `identity: true` i nie znika w LOD):
- **hajer**: hełm-kopuła z daszkiem + żelazna obręcz, **kaganek** (prostopadłościan 0,07, `emissive` ≥ 2,
  `FIXED_COLORS.lampFlame`) na blaszce z przodu, **kitka** (slot ACCENT) z tyłu ciemienia; kilof (trzonek 0,75,
  głowica 0,36, jasna krawędź ostrza `ironEdge`); tylnik na `APRON_B`; `hold = HOLD.TOOL_SHOULDER`; lampa na `HEAD`.
- **cieśla**: kaptur ze szpicem odrzuconym do tyłu (szpic wystaje za obrys głowy), chwost (ACCENT) na szpicu;
  topór ciesielski w prawej dłoni (`TOOL_R`); belka 0,11 × 0,11 × 1,0 na lewym barku (`BACK`);
  `hold = HOLD.BEAM_SHOULDER`; latarka przy pasie (`LANTERN`).
- **tragarz**: opaska + odkryte włosy, węzeł opaski z końcami (ACCENT); nosidło na `BACK`: rama 0,5 × 0,7
  wystająca **nad barki**, kosz; urobek w koszu jako część na `LOAD` (animator ukrywa ją skalą 0, gdy nic nie
  niesie); bez narzędzia; `hold = HOLD.FRAME_STRAPS`; latarka przy pasie.
- **kowal**: czapa z osłoną karku + okular z miki na czole, piórko (ACCENT); młot w `TOOL_R`, szczypce w
  `TOOL_L`; długi fartuch z przodu do kolan na `APRON_F`; ciemniejsze rękawy (TUNIC2, „sadza”);
  `hold = HOLD.TWO_TOOLS`; latarka przy pasie.
- Pozostałe role mają na `LOAD` worek z urobkiem (noszenie w rękach), domyślnie ukryty.
- Narzędzia w układzie kontraktu (`ToolInfo`): początek = środek pięści, trzonek wzdłuż +Y, ostrze/obuch ku +X;
  wypełnij `length`, `gripL` (druga dłoń przy zamachu oburącz: kilof, topór), `head`, `strike`.
- `RigInput.lamp`: kość, przesunięcie płomienia, barwa i promień (kaganek R ≈ 2 kafle, `FIXED_COLORS.lampFlame`).

**Siatka** (kontrakt `MESH_ATTRIBUTES`): pozycje i normalne w przestrzeni modelu w pozie spoczynkowej; `color`
liniowy (konwersja z sRGB), biały tam, gdzie `aSlot ≠ FIXED`; `aBones`/`aWeight` (sztywne części: waga 1;
d08: 2 kości); `aEmissive`; `aLayer`. **Obrys** (`hull`): kopia z wygładzonymi normalnymi (zgrzewanie po pozycji
w obrębie tej samej kości), z tymi samymi atrybutami skórowania. `triangles` policzone.
**LOD**: LOD0 ≤ 1500 tr., LOD1 ≤ 400, LOD2 ≤ 60 (części z `minLod`, uproszczone segmenty; LOD2 może być „żetonem”:
5–8 brył — tułów, głowa z nakryciem, narzędzie, element pleców, nogi). Jeśli technika nie mieści budżetu —
zgłoś liczby, nie ukrywaj (to jest metryka turnieju).

**Kryterium „gotowe”**: 12 wariantów × 4 role × 3 LOD budują się w Node (Vitest) i w przeglądarce; testy w
`tests/anim/model/`: determinizm (hash buforów tego samego seeda równy, różne seedy różne), komplet atrybutów,
budżety LOD (twarde: LOD1 ≤ 400 i LOD2 ≤ 60 dla wariantów, które je deklarują), ΔL\* brody ≥ 15 na 200 seedach,
stawy ciała = `referenceJoints`, wysokość bryły = `totalHeight` ± 0,06, każda rola ma nakrycie + narzędzie/ładunek +
element pleców/fartuch oznaczone `identity`, udział akcentu w rzucie bocznym ≤ 10% pola sylwetki (przybliżenie
z pól trójkątów), żadnej kości spoza `BONE`.

**Raport**: tabela trójkątów (wariant × LOD, średnio na rolę), czego nie udało się zmieścić w budżecie,
decyzje konstrukcyjne per technika, zrzut kontrolny (gdy strona W3 działa: `dwarves.html?variant=<id>&shot=izba`
na porcie 5176), prośby o zmianę kontraktu.

---

## 3. Brief W2 — „Animator ruchu”

**Cel.** Ruch ciężki i pewny (karta §5, wizja), czytelny na 75 px, bez ślizgania stóp, gotowy do sterowania przez
symulację: rig proceduralny, IK, cykle, ruch wtórny i szkielet maszyny stanów z wejściami z `path.moves`,
`agent.progress` i zdarzeń symulacji (`docs/design/ai/NAVIGATION.md` §1.3, `docs/design/sim/WORLD-MUTATION.md` §1).

**Pliki na wyłączność**: `src/render/anim/**` poza `types.ts` (np. `rig.ts`, `mat.ts`, `ik.ts`, `clips/*.ts`,
`layers.ts`, `secondary.ts`, `machine.ts`, `metrics.ts`, `index.ts` — zastąp zaślepkę), `tests/anim/rig/**`.

**Wejścia z kontraktu**: wszystko z `anim/types.ts` (konwencje osi i Eulera ZYX, `BONE`, `BONE_PARENT`,
`PoseFrame`, `IK`, `RigInput`, `ToolInfo`, `HOLD`, `SIM`, `WORK`, `CARRY`, `AnimEdge`, `AnimInput`, `AnimEvent`,
`AnimWorldProbe`, `AS`, `NOTIFY`, `AnimClip`, `ClipContext`, `DwarfAnimator`, `CLIP_IDS`); `MOTION`, `referenceJoints`,
`PROPORTION_PRESETS` z `characters/direction.ts` (do testów buduj `RigInput` sam z `referenceJoints` — nie czekaj na W1).

**Wyjścia** (`anim/index.ts`): `createAnimator: CreateAnimator` (implementacja `DwarfAnimator`), `animMetrics(rig)`
→ `{ slipWalk, slipNav, seamJump }` zgodnie z `AnimMetrics` (characters/types.ts), eksport klipów do testów.

**Wymagania:**
1. **Rig/FK**: macierze kości w przestrzeni modelu z `RigInput.rest` + `PoseFrame` (rot ZYX, pos, scale, root);
   `placement` = pozycja świata × lustro kierunku (facing −1 = skala X −1) × yaw widoku (`viewYawDeg`, obrót przodu
   ku kamerze +Z) × yaw klipu. Zero alokacji w `update`.
2. **IK dwukostne 3D z wektorem bieguna** + ekstrakcja Eulera dla kości o osi spoczynkowej −Y; nogi (biegun:
   kolano w przód), ręce (łokieć w tył/dół); stopa: kąt podeszwy w świecie; obniżenie miednicy, gdy stopa nie
   sięga. Stopy na kaflach (`probe.floorAt`) — jedna stopa na stopniu 0,25–0,5 kafla wyżej; dłonie i stopy na
   szczeblach drabiny (`probe.ladder`: rozstaw 0,25, głębokość z).
3. **Cykle** (`CLIP_IDS`; fazy i zdarzenia w danych klipu, krzywe tempa nazwane):
   - `idle`: oddech 3–4 s (pierś ±1,5°), przenoszenie ciężaru, broda z opóźnieniem, przesunięcie fazy z seeda;
     trzymanie wg `hold` (hajer: kilof głowicą przy bucie; cieśla: belka na barku; tragarz: dłonie na pasach;
     kowal: młot i szczypce).
   - `walk`: **sterowany dystansem** (faza += droga / długość kroku podwójnego), stopa podporowa przypięta do
     świata, kołysanie 0,02, przechył i skręt miednicy, wymach rąk przeciwny do nóg (dłoń z narzędziem wg `hold`),
     stabilizacja głowy, broda i fartuchy z opóźnieniem fazy. Kadencja z karty: **2 kroki / 0,9 s** przy prędkości
     koncepcyjnej (długość kroku z długości nogi, ~0,33–0,4 kafla → ~0,75–0,9 kafla/s).
   - `jog`: blend 1D po prędkości do **2,5 kafla/s** (dzisiejsza prędkość nawigacji: 400 ms/kafel) z fazą lotu,
     dłuższym krokiem, mocniejszym pochyleniem — bez komizmu. **Konflikt do raportu**: przy nogach 0,30 kafla
     2,5 kafla/s to bieg (Froude ≈ 2); przedstaw liczby i rekomendację prędkości chodu dla systems/gameplay.
   - `dig`: **zamach 0,35 s → przytrzymanie 0,08 s → uderzenie 0,15 s → powrót ~0,32 s** (`MOTION`), wyraźna
     antycypacja (kilof za głową, odchylenie tułowia, ciężar na tylnej nodze), krzywa uderzenia przyspieszająca,
     odbicie po trafieniu; narzędzie animowane jako bryła, **obie dłonie IK na trzonku** (`gripL`); celowanie
     z `aimX/aimY` (kafel przed stopami, przed głową, pod stopami); notify `DIG_WINDUP`, `TOOL_SWOOSH`,
     **`DIG_HIT` w klatce uderzenia z pozycją punktu `strike` w świecie**; okno przerwania: od trafienia do 20%
     następnego zamachu. Element pleców cieśli (belka) odłożony (skala 0) przy pracy.
   - `build`: ten sam rytm z narzędziem roli (młot/topór), uderzenie na wysokości pasa/piersi.
   - `climb`: sterowany dystansem po drabinie (cykl = 2 szczeble), **plecami do kamery** z ~30° skrętu na prawy bok
     (widać nakrycie głowy i element pleców), dłonie i stopy na szczeblach (bez ślizgania po szczeblach), broda
     odchyla się od drabiny, narzędzie na plecach; notify `RUNG_GRAB`. Szybkości: w górę 900 ms/wiersz, w dół 600.
   - `carry`: warstwa na idle/walk: pochylenie 8°, krótszy i cięższy krok, ręce wg ładunku (`CARRY.HANDS`
     worek przed sobą, `SHOULDER` na barku, `BACK` — nosidło); `LOAD` widoczny (skala 1) tylko przy noszeniu.
   - `flee` (jog + dłoń osłania głowę przy `danger`), `stunned` (przysiad, kołysanie) — wersje proste.
4. **Ruch wtórny**: broda (2 kości), fartuchy (`APRON_F/B`), latarka (wahadło) — tłumione sprężyny niezależne od
   klatki albo opóźnienie fazy; deterministyczne.
5. **Maszyna stanów** (`AS`): mapowanie `AnimEdge.move` → stan (WALK_L/R → WALK; STEP_U* → LEDGE; DROP_*/FALL →
   DROP → LAND; UP/DOWN → CLIMB; STAIR_* → STAIRS; LINK → RIDE), `SIM` → stan (WORK+DIG → DIG, WORK+BUILD →
   BUILD, FLEE → FLEE, STUNNED → STUNNED, BURIED/DEAD → HIDDEN), zdarzenia (`digStart` zaczyna od zamachu,
   `digDone` — ostatnie uderzenie i powrót, `caveInWarning` — spojrzenie w górę, `fell` → LAND z siłą od `rows`,
   `buried` → HIDDEN, `pickUp`/`putDown` → `LOAD`); tabela czasów przejść (domyślnie ~0,15–0,2 s, ucieczka 0,08 s);
   **ruch korzenia po krawędzi** wyliczany z `from/to/t` krzywą zależną od ruchu (chód liniowo, zeskok
   balistycznie, wspięcie na półkę łukiem) — tak, by pozycja wizualna i przypięte stopy się zgadzały; zmiana
   kierunku (lustro) przy kontakcie stopy albo przez krótki obrót. LEDGE/STAIRS/DROP/RIDE w E2 mogą być proste,
   ale muszą istnieć (pełne w rundzie 2).
6. `pose(clipId, phase, input)` — deterministyczna poza dla ujęć laboratorium (bez maszyny stanów).

**Kryterium „gotowe”** — testy w `tests/anim/rig/`: FK zgodne z `THREE.Matrix4`/`Euler('ZYX')` dla losowych póz;
IK trafia osiągalny cel (≤ 1e-4), prostuje się przy nieosiągalnym, kolano w przód; stopa na stopniu (druga 0,25
wyżej) i na drabinie (dłonie i stopy na szczeblach we wszystkich fazach); ciągłość cykli (poza(0) = poza(1),
skok kości na szwie ≤ 0,01 kafla); **poślizg stopy podporowej < 2% prędkości chodu** przy prędkości koncepcyjnej
i przy 2,5 kafla/s; 2 × `FOOT_DOWN` na cykl chodu, 1 × `DIG_HIT` na cykl kopania w klatce końca uderzenia;
determinizm (te same wejścia → te same macierze); tabela przejść maszyny; benchmark: update + FK 200 krasnoludów
≤ 1,5 ms na klatkę w Node.

**Raport**: rozbicie faz każdego cyklu (klatki/sekundy, krzywe, pozy kluczowe, notify, okna przerwania),
tabela przejść, liczby poślizgu i kosztu, konflikt prędkości chodu z rekomendacją, prośby o zmianę kontraktu.

---

## 4. Brief W3 — „Technical artist”

**Cel.** Krasnolud wygląda jak część ilustrowanego przekroju (baza **i08** + światło **L00**: bloom, ciepłe plamy,
ciemne otoczenie) i czyta się w plamie lampy i na jej skraju; 200 krasnoludów w kilku wywołaniach rysowania;
powtarzalne stanowisko turniejowe z metrykami.

**Pliki na wyłączność**: `src/render/characters/render/**` (np. `materials.ts`, `boneTexture.ts`, `crowd.ts`,
`partsCrowd.ts`), `src/render/characters/lab/**` (np. `world.ts`, `shots.ts`, `metrics.ts`, `page.ts`),
`src/render/characters/lab.ts` (wejście strony), `dwarves.html`, `scripts/dwarf-tournament.mjs`, jedna pozycja
`dwarves: 'dwarves.html'` w `vite.config.ts`, `tests/anim/render/**`.

**Wejścia z kontraktu**: `DwarfModel`, `DwarfMesh`, `MESH_ATTRIBUTES`, `SLOT`, `VAR_SLOTS`, `DwarfCrowdRenderer`,
`CrowdMember`, `ZoomDef`, `ShotDef`, `ShotDwarf`, `SHOT_IDS`, `cameraDistance`, `ShotMetrics`, `CostMetrics`,
`AnimMetrics`, `DwarfLabApi` (characters/types.ts); `ZOOMS`, `lodForPxPerTile`, `VALUE_BANDS`, `FIXED_COLORS`
(direction.ts); `DwarfAnimator`, `CreateAnimator`, `LampInfo`, konwencja macierzy skórowania (anim/types.ts);
moduły zespołu wyłącznie przez `model/index.ts` i `anim/index.ts`. Z silnika importujesz (bez zmian):
`buildIllustratedScene`, `illParams`, `I08_DRAWING`, `LIGHT_VARIANTS` (`l00-r2b`) z `src/lab/styles/illustrated.ts`,
`PostFX` z `src/render/post.ts`, `GLSL_WORLD`, `GLSL_NOISE`, `GLSL_LIGHT`, `MAX_DYN_LIGHTS`, `LightField`,
`WorldTex`, `daylightAt`, `World`, `DressItem`/`ArenaInfo`.

**Wymagania:**
1. **Materiał wypełnienia** (skórowany, z teksturą kości): to samo światło co rekwizyty stylu (worldLight z pola
   światła, ambient `uAmbCool·uPropAmb·1,25 + barwa·l·uPropLight` jak `PROP_FRAG`), **płaska barwa w dwóch–trzech
   tonach** (biblia §5.3: baza, cień −12 L\* ku ambientowi, światło +10 L\* ku lampie w rdzeniu plamy, miękka
   granica 0,08); kierunek tonu = mieszanka stałego klucza ilustratora i gradientu pola światła (strona ku lampie
   jaśniejsza — „czy jest w świetle”); emisja lampki (bloom ją łapie); `discard` w mgle wojny jak rekwizyty.
2. **Obrys W1** odwróconą skorupą o stałej grubości w px (`ZOOMS[z].hullPx`: 4 / 4 / 3 px przy gęstości 1080p),
   tusz `uInk` stylu, alfa 0,5 jak `inkHullMaterial` (zgodność z L12); obsłuż **lustro** (facing −1) —
   wypełnienie bez odwracania normalnych przez `gl_FrontFacing`, skorupa z cullingiem poprawionym o znak lustra.
   Linie wewnętrzne Wd 1,25 px (Izba/Gród) — opcjonalnie, jeśli tanie.
3. **Renderer tłumu** (`DwarfCrowdRenderer`): tekstura kości RGBA32F (wiersz = krasnolud, 3 teksele na kość,
   macierz skórowania = placement × bones × T(−rest)); atrybuty instancji: wiersz, paleta 6 slotów zmiennych
   (liniowo), flagi (lampa, znak lustra); kubełki **(rola × LOD)** → 1 wywołanie wypełnienia + 1 obrysu na kubełek;
   LOD z `lodForPxPerTile` (gęstość pikseli na głębokości postaci); tryb `parts` (InstancedMesh na część,
   macierze instancji na klatkę) dla d07; tryby `color` / `mask` / `sil`. Światła dynamiczne lampek (≤ 12 =
   `MAX_DYN_LIGHTS`, najbliższe środka kadru) przez `uDynPos/uDynCol`, migotanie ±2%.
4. **Świat stanowiska** (własny `World` + lista `DressItem`, nic w `src/lab` nie zmieniasz): izba gęsto
   zastawiona (stół, ława, beczki, półka, stojak narzędzi, latarnia), tunel z przodkiem (lita ściana z rudą) i szyb
   z drabiną, korytarze pasków oświetlone równo (rząd latarni), ściana z 8 drabinami z segmentów 1-kaflowych
   (szczeble co 0,25), długi ciemny tunel z jedną pochodnią (`swiatlo`), sieć sal/tuneli/szybów dla `okolica`
   (~60 krasnoludów) i `bench` (200). Głębokości: tunel z = −0,45, drabina z = −0,85.
5. **Łańcuch L00**: `buildIllustratedScene(ctx, illParams({ ...I08_DRAWING, ...l00.params }))` + `PostFX`
   ustawiony jak gałąź `r2b` w `createIllustrated` (bloom 0,95 / 0,8 / 0,62, saturacja 1,1, winieta 0,55, ziarno
   0,035, ekspozycja 1,05, ACES) — skopiuj te ~20 linii z adnotacją źródła. Kamera jak w laboratorium (FOV 30°,
   pozycja (x, y + 0,07d, d), patrzy na (x, y, −0,5)), `d = cameraDistance(ZOOMS[z].pxPerTile, H)`.
6. **Ujęcia** `SHOT_IDS` (treść w komentarzu kontraktu): `izba` (4 role w spoczynku w plamie lampy), `grod`
   (hajer kopie przy przodku na skraju światła, tragarz niesie, cieśla na drabinie, kowal idzie; w plamie i poza),
   `okolica` (~60), `walk8`/`dig8`/`climb8`/`carry8` (8 faz k/8 obok siebie, ta sama rola w rzędzie — po jednym
   rzędzie na rolę, jeśli mieści się w kadrze, inaczej hajer + tragarz), `swiatlo` (4 role w rdzeniu plamy
   i te same 4 na skraju / za nią), `sil75`/`sil24` (czarne sylwetki na białym: 4 role × 8 póz — spoczynek,
   4 fazy chodu, szczyt zamachu, uderzenie, wspinaczka), `seq30` (sylwetki 8 kolejnych klatek 30 kl./s chodu
   i kopania). Czas sterowany jawnie (stały `uTime` na ujęcie), bez pętli RAF w trakcie zrzutu.
7. **API** `window.__dwarf` zgodne z `DwarfLabApi`; URL `dwarves.html?variant=<id>&shot=<id>&hud=0`;
   nieznany wariant lub ujęcie = błąd (jak BUG-001 laboratorium), nie cichy zamiennik.
8. **Metryki** (czyste funkcje w `lab/metrics.ts`, testowane): sRGB→L\*a\*b\*; **kontrast postaci do tła**
   (średnie L\* wypełnienia vs pierścień 6–12 px poza obrysem, cel ≥ 15 L\*, osobno w świetle i na skraju);
   **akcent**: udział pikseli wypełnienia z C\* > 30 (≤ 10%); **sylwetki** 75 i 24 px: 1 − IoU par ról (wyrównanie
   środków ciężkości), min. para, trafność klasyfikacji najbliższym wzorcem spoczynku (wszystkie pozy × role);
   **stabilność**: średnie i min. IoU kolejnych klatek `seq30`; **koszt**: trójkąty na LOD, wywołania rysowania
   1 vs 200 krasnoludów, mediana czasu klatki 0 vs 200 (gl.finish), ms animacji + wysyłki dla 200; metryki ruchu
   z `animMetrics` (W2).
9. **Skrypt** `node scripts/dwarf-tournament.mjs <baseUrl> <outDir> [warianty,csv] [W=960] [H=540]`:
   `<out>/<wariant>/<ujęcie>.png`, `<out>/metrics.json` (wszystkie metryki), `<out>/manifest.json` zgodny z
   `scripts/contact-sheet.py` (`width`, `height`, `scenarios` = ujęcia, `styles[id].frameMs[ujęcie]`) i
   `<out>/names.json`; obsługa błędów konsoli i sprawdzenie, że wyrenderowano żądany wariant.
10. Do czasu dostaw W1/W2: własny model zastępczy w `render/` (bryły na kościach z `referenceJoints`) pod
    `?variant=fixture`; zaślepka animatora z `anim/index.ts` już stawia postać w pozie spoczynkowej.

**Kryterium „gotowe”**: `dwarves.html` buduje się w `npm run build`; pełny przebieg skryptu dla 3 wariantów E1
bez błędów konsoli; testy w `tests/anim/render/`: matematyka metryk (L\* znanych barw, IoU znanych masek, kontrast
na obrazie syntetycznym), pakowanie tekstury kości (macierz skórowania = placement × bone × T(−rest)), wybór LOD,
kompletność listy ujęć (każde `SHOT_ID` ma definicję, 4 role w `izba`, `swiatlo`, `sil*`).

**Raport**: zrzuty E1 (ścieżki), tabela kosztu (trójkąty, wywołania, ms dla 0/200), czego nie dało się zrobić bez
zmian silnika (potrzeby integracji: shader, obrys, światło), czas przebiegu skryptu na wariant.

---

## 5. Co robi lider
- Integracja i spójność kontraktu (zmiany tylko przez lidera, ogłaszane przez producenta), przegląd zrzutów E1
  pod kątem karty i wizji, poprawki kierunku w `direction.ts`.
- Turniej (E3): zamrożony build, przebieg `scripts/dwarf-tournament.mjs` dla wszystkich wariantów, plansze
  (`scripts/contact-sheet.py`, `scripts/owner-sheet.py` — wiersze = finaliści, kolumny = Izba / Gród / Okolica /
  chód / kopanie), rubryka (czytelność 25, wow 25, atmosfera 15, spójność z wizją 10, skalowalność 10,
  wydajność 10, oryginalność 5), 2–3 finalistów, plan rundy 2 (pełna maszyna stanów, przejścia, zdarzenia).
- Dokument `docs/variants/04-dwarf.md` i plansze w `docs/variants/04-dwarf/`; raport końcowy dla producenta.
