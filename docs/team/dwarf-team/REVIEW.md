# Odbiór prac zespołu krasnoludów — lista kontrolna lidera

> Lider sprawdza każdy etap (E1, E2) według tej listy, zanim prace wejdą do turnieju. Pracownicy mogą
> z niej korzystać jako autokontroli. Źródła: karta `docs/art/concepts/dwarf.md`, biblia §0/§2.4/§5.3, wizja §3.

## Integracja (wszyscy)
- [ ] `npx tsc --noEmit -p .`, `npx vitest run tests/anim`, `npm run build` przechodzą na złożonym drzewie.
- [ ] Brak importów z plików wewnętrznych innego pracownika (tylko `model/index.ts`, `anim/index.ts`, kontrakt).
- [ ] Brak zmian w plikach silnika i wspólnych (`git status` pokazuje tylko pliki z tabeli własności).
- [ ] Brak `Math.random`; ten sam seed → identyczne bufory i zrzuty.

## Wygląd (W1 + W3, na zrzutach `izba`, `grod`, `okolica`, `swiatlo`)
- [ ] Kowadło: szerokie barki, broda-klin na piersi, szeroka podstawa z butów; **3,0–3,5 głowy** (d10 — świadomie 3,6).
- [ ] Bez chibi: głowa bez nakrycia ≤ ⅓ wzrostu; dłonie i narzędzia przerysowane (dłoń ≈ ⅓ głowy).
- [ ] Rola z czarnej sylwetki przy 75 px: kopuła z lampką / szpic kaptura / rama nad barkami / czapa z osłoną karku
      + narzędzie + element pleców — rozpoznaję 4/4 bez barw.
- [ ] Przy 24 px: nakrycie głowy + lampka nadal odróżniają hajera; reszta przynajmniej przez element pleców.
- [ ] Jeden nasycony akcent (kitka / chwost / węzeł / piórko) ≤ 10% sylwetki; strój przygaszony (C\* ≤ 26).
- [ ] Broda kontrastuje ze strojem (≥ 15 L\*); twarz i lampka są najjaśniejsze na postaci.
- [ ] W plamie lampy: ciemna krępa bryła z jasnym „okiem” (twarz + lampka), kreska W1 widoczna mimo bloomu.
- [ ] Na skraju i w mroku: kontur i światełko zostają (mrok zabiera kolor, nie kształt).
- [ ] Obrys stały w px na wszystkich zoomach; lustro kierunku nie psuje obrysu ani cieniowania.
- [ ] Oryginalność: nic nie przypomina krasnoludów z gier o koloniach ani postaci z referencji (okrągłe głowy,
      kombinezony, hełmy-miski).

## Ruch (W2, na paskach `walk8`, `dig8`, `climb8`, `carry8` i w `seq30`)
- [ ] Chód ciężki i pewny: kołysanie 0,02, miednica pracuje, głowa stabilna, broda i fartuchy z opóźnieniem.
- [ ] Stopa podporowa stoi w miejscu (poślizg < 2%); kontakt pięty = `FOOT_DOWN`.
- [ ] Kopanie: wyraźna antycypacja (kilof za głową, tułów odchylony), krótkie przytrzymanie, szybkie uderzenie,
      odbicie i powrót; klatka uderzenia czytelna w pasku; `DIG_HIT` w punkcie styku ze skałą.
- [ ] Wspinaczka: dłonie i stopy na szczeblach, plecy do kamery z widocznym elementem pleców i nakryciem głowy.
- [ ] Noszenie: pochylenie 8°, cięższy krok; ładunek widoczny tylko przy noszeniu.
- [ ] Szwy cykli bez skoku; przejścia bez „teleportów” korzenia.

## Koszt (W3 + W1)
- [ ] Trójkąty: LOD0 ≤ 1500, LOD1 ≤ 400, LOD2 ≤ 60 (albo uczciwie zgłoszone przekroczenie).
- [ ] 200 krasnoludów: wywołania rysowania rzędu (role × LOD × 2), nie (krasnoludy × części).
- [ ] Animacja + wysyłka 200 krasnoludów ≤ 1,5 ms na klatkę (Node/przeglądarka, podać metodę pomiaru).
