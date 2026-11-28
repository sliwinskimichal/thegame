# Odbiór E1 zespołu krasnoludów (lider, 2026-11-28)

Metoda: `npx tsc`, `npx vitest run tests/anim`, podglądy W1 (`DWARF_PREVIEW`, rasteryzator `model/inspect.ts`),
przebieg `scripts/dwarf-tournament.mjs` na **zamrożonym buildzie** (vite build → serwer statyczny 5179;
przebieg na serwerze deweloperskim przerwało przeładowanie HMR) dla d01, d02, d04, światło L12.

## Wyniki
| Obszar | Stan | Dowód |
|---|---|---|
| Kompilacja i testy | tsc zielony; tests/anim: 1 czerwony (`tests/anim/render/crowd.test.ts` — W3); benchmark W2 pomijany domyślnie (`ANIM_BENCH=1`) | producent 711e3d3, przebieg lidera |
| W1 model | 11/12 wariantów (d08 w toku) × 4 role × 3 LOD; LOD1 ≤ 400 i LOD2 ≤ 60 wszędzie; LOD0 1460–4730 tr. (miękki) | raport W1, `cost.trianglesPerLod` |
| W2 ruch | poślizg stopy 0 (≤ 0,02%) przy 0,69 / 1,1 / 2,5 kafla/s i skalach 1,2/1,4; szew 0,005; FK = THREE do 1e-9, IK 1e-4; 2 × FOOT_DOWN na cykl | `anim` w metrics.json, raport W2 |
| W3 stanowisko | 11 ujęć, 26 s na wariant, 0 błędów konsoli; 200 krasnoludów = 8 wywołań rysowania (role × wypełnienie/obrys), 9 w Okolicy; klatka 0 → 200: ~205 → ~345 ms (SwiftShader, względnie) | metrics.json |
| Koszt animacji | przeglądarka: 3,1 ms (animacja) + 0,7 ms (wysyłka) na 200 krasnoludów; Node (bundle): 1,33 ms | metrics.json, raport W2 |

## Problemy kierunkowe (przekazane pracownikom)
1. **Materiał postaci w L12 (W3)** — w plamie lampy postać przejmuje całą barwę i jasność światła: w izbie
   akcent C\* > 30 = **67–88%** wypełnienia (cel ≤ 10%), strój L\* 45–62 (cel 30–48), kontrast −11…−15 L\*
   (cel |ΔL| ≥ 15). Wymaganie: częściowe odbarwienie barwy lampy na postaci, kolano jasności (strój ≤ ~48,
   twarz ≤ 68, lampka 88–98) — „ciemna krępa bryła z jasnym okiem”.
2. **Światło stanowiska (W3)** za jasne i za równe (latarnie co ~2 kafle, tło L\* 60–85, bloom) — nie przypomina
   gry w L12. Gęstość źródeł jak w scenach tonu; w paskach identyczne światło dla każdej fazy.
3. **Obrys W1 rwie się w L12 (W3)** — pokrycie tuszu skorupy a `InkOverPass`.
4. **Broda jak deska (W1)** — klin w profilu (gruby przy podbródku, cienki u dołu), przylega do tułowia,
   nieregularny dół; najlepiej robi to d04.
5. **Kitka i kaganek czytają się jak rogi (W1)** — zakazana sztampa; kitka = puszysty pędzel z tyłu ciemienia,
   kaganek bez szpica, piórko kowala prosto do tyłu.
6. **Żetony LOD2 (W1)** — prostokąt na „łodydze”; podstawa ma być szeroka (kowadło).
7. **Trzymanie (W2)** — hajer w spoczynku: kilof na barku (głowica przy bucie znika w sylwetce); cieśla: topór
   wzdłuż uda zamiast ostrzem przed twarzą; LOAD ukryty bez ładunku.

## Przyjęte reguły
- **Lokomocja w profilu, tułów do kamery** (W2): przy chodzie miednica i nogi idą wzdłuż ruchu (zero dryfu stóp),
  tułów, broda i głowa skręcają o yaw wariantu; w spoczynku i przy pracy całe ciało pod yaw wariantu.
- Lustro kierunku: jedno wywołanie na kubełek, culling przez `gl_FrontFacing` XOR znak lustra (W3).
- Zmienność w tłumie: paleta + skala kości brody 0,9–1,1 z seeda (W2), geometria wspólna na (wariant, rola, LOD).

## Weryfikacja poprawek W1 i W2 (podglądy `DWARF_PREVIEW`, d01/d04/d08)
- Przyjęte: broda jako klin z 4 pasm (LOD0), rozwidlone stożki w przekroju rombu (LOD1), żeton szpicem (LOD2);
  kitka jako pędzel z tyłu ciemienia (nie róg); kaganek z okrągłym płomykiem; żeton LOD2 z szerszą podstawą;
  kilof na barku w spoczynku (mocne „T” w sylwetce 75 px); topór cieśli przy udzie.
- Do poprawy (zlecone): trzonek kilofa w LOD2 (głowica wisi w powietrzu), krótsze i ciemniejsze piórko kowala,
  kowal — większy obuch młota, dłuższe szczypce trzymane przed obrysem (W1 geometria, W2 poza).
- Trójkąty po poprawkach (LOD0/1/2, maks. z ról): d01 3906/376/60 · d02 4738/384/60 · d03 1670/376/60 ·
  d04 3532/380/60 · d05 4700/376/60 · d06 4489/380/60 · d07 = d01 · d08 5198/376/60 · d09–d12 ~3970/376/60.

## Weryfikacja poprawek W3 (zamrożony build, d01 / d04, lightgain 0,5)
- Przyjęte: światło stanowiska jak w scenach tonu (izba 3 źródła, tunele co ~7 kafli, w paskach pochodnia
  przy każdym krasnoludzie z tym samym przesunięciem); materiał `DWARF_TONE` (barwa lampy na postaci odbarwiona
  w 65%, kolano jasności, własna lampka 10%); obrys ciągły 4 px (przyczyna: arkusz świecącego powietrza stylu
  przed postaciami i meble przecinające bryły — postacie rysowane po powietrzu, izba głębsza).
- Liczby: izba ΔL\* −22/−16/−18/−10 (d01) i −25/−20/−22/−10 (d04), tło 41–55, strój 20–34, twarz 56–64,
  lampka 96–98, **C\* > 30: 1–4%** (było 67–88%); Gród w plamie ΔL\* −19…−25; skraj: hajer −22, tragarz +3.
- **Decyzje lidera**: (1) turniej rundy 1 na `lightgain=0,5` (tło w plamie ≈ cel biblii); przebieg kontrolny
  finalistów na `lightgain=1` (pochodnia gry). Pochodnia L12 bieli tylną ścianę do L\* 60–85 przy celu biblii
  44–46 — potrzeba integracji z silnikiem (engine-graphics / concept-artist). (2) `DWARF_TONE` stały w rundzie 1
  (materiał wspólny = porównanie konstrukcji uczciwe); strojenie tonu w rundzie 2: strój 26–36 w plamie,
  ≥ 24 w Grodzie. Pasmo biblii 30–48 kłóci się z kontrastem ≥ 15 przy tle 44–50 — rozstrzygnąć w biblii.
- Błąd zgłoszony W2: `pose()` nie jest czystą funkcją (stan z poprzedniego wywołania zmienia placement).
