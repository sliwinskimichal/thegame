# Karta konceptu: Palenisko (Ognisko obozowe → Kamienne Palenisko → Wielkie Palenisko)

> concept-artist · v1 · 2026-11-26 · zgodna z `docs/art/ART-BIBLE.md` v1.1 i wizją v1 (§2.2: Palenisko = poziom grodu).
> Dane: `src/content/buildings.ts` `hearth` — rozmiar 3×2 / 4×3 / 5×4 kafli, popCap 10/24/50, morale 2/4/8,
> radius 6/9/12, storage 0/20/60. Odbiorcy: engine-graphics (geometria, emiter), vfx (ogień, iskry, para), level design.

## 1. Kierunek wizualny, funkcja i nastrój
- **Idea**: serce grodu i jego zegar epok — poziom Paleniska jest widocznym poziomem grodu. Najjaśniejsza ciepła plama
  w kadrze; miejsce rozmów drużyny (siedziska = sloty towarzyszy); pierwszy kadr gry (ognisko przy wozie nocą).
- **Postęp w materiale** (wizja): poz. 1 **drewno i płótno** → poz. 2 **kamień i miedź** → poz. 3 **żelazo, para, runy**
  (+ złoto i szafiry — Palenisko to miejsce znaczenia, ornament dozwolony).
- **Fabuła**: poz. 2 rozpalane w odzyskanej Sali Pierwszego Progu (koniec Aktu I) — stary okap przodków, spękany,
  połatany nową cegłą i miedzią; naprzeciw nisza z grobem króla Gostomira.
- **Słowa-klucze**: krąg ciepła · okap jak dzwon · siedziska wokół ognia · sadza na sklepieniu · para w rurach · runy na łuku.

## 2. Sylwetka, proporcje i hierarchia czytelności
| Poziom | Rozmiar [kafle] | Sylwetka (czyta się z Okolicy) | Wysokość | Punkt skupienia | Siedziska |
|---|---|---|---|---|---|
| 1. Ognisko obozowe | 3×2 | niski, szeroki: krąg kamieni r 0,55 + trójnóg 1,1 + **płachta wiatrochronu** (trapez płótna 1,2×1,0 na 2 tyczkach) | 1,2 | płomień w środku (rdzeń L\* 95) | 3 kłody (walce r 0,15, l 0,6) |
| 2. Kamienne Palenisko | 4×3 | **dzwon/trapez**: podstawa 3,2 szer. × 0,7, palenisko z łukiem 1,2 szer., **okap** zwężający się do przewodu 0,8 szer., przewód w skałę | 3,0 | żar w łuku + miedziany kocioł | 2 ławy kamienne 1,0 × 0,35 (6 miejsc) |
| 3. Wielkie Palenisko | 5×4 | **brama**: łuk żebrowy z 9 klińcami (rozpiętość 3,0, filary 0,6), misa ognia na 3 stopniach, **dwie żelazne rury pary** pionowo po bokach jak piszczałki | 4,0 | misa ognia + klucz łuku z rozetą + 4 szafirowe soczewki | pierścień 10 siedzisk |

- **70/20/10**: 70% — kamień, płótno, sadza (L\* 34–52, C\* ≤ 19); 20% — miedź, żelazo, drewno, kocioł (40–60);
  10% — ogień (85–98), rozeta ze złotem, soczewki i runy (informacja: poziom 3).
- **Kreska**: W2 obrys budowli, W3 siedziska i naczynia, Wd spoiny i słoje; kontur ognia linią żaru `#6A2A0E`.
- **Test 3 wartości**: jasny ogień w centrum, średnie siedziska i okap, ciemna sadza nad — każda epoka rozpoznawalna
  samą sylwetką (płachta / dzwon / brama z piszczałkami).

## 3. Materiały, konstrukcja i detale funkcjonalne (callouts)
| Poz. | Element | Materiał / HEX | Konstrukcja | Funkcja / zużycie |
|---|---|---|---|---|
| 1 | krąg ogniska | kamienie `#7A746A` (7–9 brył, ikosaedr skala 0,18–0,26) | luźno, bez zaprawy | osmalone od środka (−12 L\*) |
| 1 | trójnóg + kociołek | żelazo `#3E3B3A`, kociołek miedź `#8A5A3A` | 3 żerdzie r 0,02 l 1,1, łańcuch | kołysanie 0,5 Hz |
| 1 | wiatrochron | płótno `#8A8270`, tyczki dąb | płachta na 2 tyczkach, sznury Wd | odbija ciepłe światło (+10 L\* od strony ognia), łaty |
| 1 | wóz wyprawy (obok, tylko samouczek) | dąb, płótno plandeki | koła 0,9 | kadr otwierający |
| 2 | palenisko i łuk | kamień ciosany `#AB9676`, cegła `#8E4C32` (nowa: +8 L\*) | podstawa z 2 warstw bloków, łuk z 5 klińców | stare bloki spękane (Wd), nowa cegła czysta — „powrót do domu” |
| 2 | okap | kamień + **opaska miedziana** `#8A5A3A` z jasną krawędzią `#C8844A` | trapez 3,2→0,8, wys. 1,4 | **wilcze zęby** (piłka 10 trójkątów po 0,12) pod opaską — ornament dozwolony; sadza od środka |
| 2 | przewód | cegła | prostokąt 0,8 szer. do stropu wnęki, dalej rysowany W2 w płycie | dym znika w skale (jasna smuga pary 0,3 s) |
| 2 | nisze magazynu (storage 20) | kamień | 2 nisze 0,5 × 0,6 po bokach | worki, dzbany (plan tylny, ±12 L\*) |
| 2 | stara rozeta nad okapem | kamień zatarty | sześciopłatkowa Ø 0,6, pęknięta | pamięć przodków |
| 3 | łuk i filary | kamień ciosany, klucz z rozetą inkrustowaną złotem `#C89A3A` | 9 klińców, filary 0,6 × 3,2 | runy ochronne na łuku (linia światła `#6FF0FF`, puls 0,4 Hz) = morale/groza |
| 3 | misa i ruszt | stal kobaltowa `#4A4644`, misa brąz | misa Ø 1,6 na 3 stopniach | żar 0,4 kafla nad krawędzią |
| 3 | kocioł i rury pary | żelazo nitowane (nity co 0,2) | kocioł za misą, 2 rury Ø 0,3 do stropu, zawory | **para rozprowadza ciepło po grodzie** → radius 12; kłęby co 4–6 s |
| 3 | soczewki | szlifowany szafir `#3A6CFF` w oprawach | 4 okrągłe Ø 0,25 w spandrelach łuku | skupiają światło ognia na zewnątrz → zasięg plamy 12; nocą chłodny refleks |
| 3 | magazyn (storage 60) | kamień | 4 nisze + skrzynie | gęstość = zamieszkanie |

## 4. Paleta barwna, światło i atmosfera
- **Ogień**: rdzeń `#FFE6A0` (L\* 92–96), płomień `#FFB060`, końce języków `#E07A30`, kontur żaru `#6A2A0E`; iskry
  w górę (jasne punkty gasnące po 0,6–1,2 s — nie mylić z popiołem Raroga, który jest ciemny i nie gaśnie).
- **Plama**: `#FFB060`, R = 6 / 9 / 12, rdzeń 0,35 R (+18 L\*), migotanie ±3%; sadza na stropie i tylnej ścianie:
  −10 L\* przy źródle → 0 po 2 kaflach, szerzej u góry.
- **Trzy sceny tonu**: *izba wieczorem* — bohater kadru, twarze towarzyszy w rdzeniu plamy; *przodek w mroku* — z
  Okolicy widać plamę Paleniska jako latarnię grodu; *zawał* — pył w snopie światła, ogień płonie dalej (nadzieja);
  po śmierci postaci jej siedzisko pozostaje puste (bez koloru stroju).

## 5. Warianty, wskazówki produkcyjne i prompty
**Kierunki (po 3 na poziom → do turnieju ≥ 10 wariantów w scenie „izba wieczorem”):**
poz. 1: A płachta wiatrochronu *(faworyt)* / B koło z kamieni z daszkiem z gałęzi / C ognisko w misie z wozu;
poz. 2: A okap-dzwon *(faworyt)* / B piec kaflowy z polepy (terakota, przygaszona) / C palenisko w łuku z kominem w skale;
poz. 3: A brama z piszczałkami pary *(faworyt)* / B kopuła z żebrami nad misą / C trzy misy w osi z kotłem pod spodem.

**Produkcja**: ogień = 3 nakładające się billboardy z szumem (osobny mesh), emiter światła w polu światła, iskry i para
jako cząstki (vfx); kocioł i łańcuch — wahadło; siedziska jako sloty (punkty zakotwiczenia postaci). Kreska per siatka.
Ornament (wilcze zęby, rozeta, runy) tylko na Palenisku i w miejscach znaczenia — nie kopiować na inne budowle.

**Czym różni się od referencji**: tam brak ognisk i paleń — źródłem światła są żarówki, a pomieszczenia to modułowe
pudełka z płytami; u nas żywy ogień w kamiennej architekturze (okap, łuk z klińcami, rozeta), postęp epok w materiale
i plamie światła, sadza jako ślad czasu, siedziska drużyny; żadnych paneli, ekranów ani kremowych płyt.

**Prompt referencyjny**: *„Three upgrade stages of a dwarven hearth in a 2.5D mine cross-section, side view, hand-inked
warm umber outlines and muted gouache: 1) campfire ring of stones with an iron tripod, small copper pot and a patched
canvas windbreak on two poles, log seats; 2) carved stone hearth with a bell-shaped hood banded with oxidized copper and
a zigzag wolf-tooth frieze, old cracked six-petal rosette above, new bricks patching old stones, stone benches, storage
niches, soot on the vault; 3) monumental rib arch with keystone rosette inlaid with gold, fire basin on three steps,
riveted iron boiler with two vertical steam pipes like organ pipes, four sapphire lenses in the spandrels, faint turquoise
runes; warm amber light pool, cool dark rock around, no light bulbs, no screens, original design”*.
