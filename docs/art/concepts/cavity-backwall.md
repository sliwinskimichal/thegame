# Karta konceptu: tylna ściana wnęki i krawędzie wykopu (Wapienne Progi, Granitowe Korzenie, Grzybowe Groty)

> concept-artist · v1 · 2026-11-26 · zgodna z `docs/art/ART-BIBLE.md` v1.1 (§0, §3.3, §4.2). Geometria: `src/render/heightfield.ts`
> (wykop: głębokość 1 kafel, jitter 0,07; jaskinia: 1,4–3,8 kafla, jitter 0,16; AO ścian bocznych 0,55 → 1,0).
> Odbiorcy: engine-graphics (shader terenu, runda 2 turnieju nr 3), level-systems (zapowiedzi zagrożeń).

## 1. Kierunek wizualny, funkcja i nastrój
- **Idea**: płaszczyzna cięcia, krawędź i tylna ściana to 55–70% ekranu — tło, które opowiada materiał, głębię, kto
  kopał (ręka krasnoluda vs natura) i co grozi za ścianą, ale **cofa się** (ciemniej, mniej kontrastu niż plan gry).
- **Rola w grze**: odczyt „wykop vs jaskinia”, materiał skały, zapowiedzi (woda, zarodniki) z bezpiecznego miejsca,
  gęstość zamieszkania (stemple, półki) vs dzikość (pustka, monumentalność).
- **Nastrój**: Progi — ciepłe warstwy, kras i nietoperze; Korzenie — twarde bloki, wilgoć pod ciśnieniem; Groty —
  żywa, świecąca tkanka i duszna mgiełka.

## 2. Sylwetka, proporcje i hierarchia czytelności
| Element | Wykop krasnoludów | Jaskinia naturalna |
|---|---|---|
| krawędź (W1, 4 px) | prostsza, nacięcia dłutem co 0,3–0,5 kafla (ząbki 0,04), narożniki fazowane 0,15 | organiczna, nierówność kreski ±30%, narożniki zaokrąglone |
| sucha krawędź | 0,12 kafla, −7 L\* | 0,15 kafla, −8 L\*, bardziej poszarpana |
| ściany boczne | −4 → −12 L\*, pociągnięcia w głąb; W2 na styku z tylną | jak obok + nacieki/blaszki |
| tylna ściana | 1 kafel w głąb, ślady narzędzi (Wd) | 1,4–3,8 kafla, formy naturalne (Wd) |
| kąt tylna/boczna | −8 L\* w pasie 0,25 kafla | jak obok |

**Hierarchia wartości (mrok / plama lampy):** cięcie L\* 30–46 / +8 · ściany boczne −4…−12 · tylna ściana 14–32 / 44–46
· rekwizyty planu tylnego ±12 od ściany (C\* ≤ 15) · plan gry ≥ 18 L\* kontrastu do tła. **Kreskowanie tylko w nieznanym**
— cień w odkrytym to spadek wartości.

## 3. Materiały, konstrukcja i detale funkcjonalne (callouts per biom)
| Biom | Tylna ściana (wzór, Wd) | Podpis wykopu | Podpis natury | Zapowiedź / życie |
|---|---|---|---|---|
| **Wapienne Progi** | poziome warstwy wapienia/piaskowca/łupka ciągnące się z cięcia, przesunięte o 0,1 kafla (perspektywa), linie warstw Wd co 0,3–0,6 kafla | **ślady kilofa**: rzędy krótkich kresek 0,25 kafla pod 35–55°, rząd co 0,3 kafla | **naciek**: pionowe fałdy draperii (Wd), stalaktyty na krawędzi stropu (rekwizyty 0,2–0,6), mleko wapienne (jasne plamy +10 L\*), **wykwity saletry** przy spągu: matowe białe kępki 0,2–0,4 `#D8DAD8` | o zmierzchu nietoperze z kominów krasowych; guano (ciemne plamy) pod grzędami |
| **Granitowe Korzenie** | **ciosy**: wieloboczne bloki 1,5–3 kafla, spoiny Wd prawie prostopadłe, plamki skalenia | **otwory klinowe**: rzędy półokrągłych żłobków (Ø 0,08) co 0,25 kafla wzdłuż linii łupania, gładkie lico łupania (+4 L\*) | żyłki kwarcu (jasne linie Wd `#B8B8BC`), pionowe szczeliny co 15–25 kafli (W2, mokra krawędź) | **mokre zacieki** pod spoinami (−8 L\*, błysk na krawędzi) = kieszeń wodna w promieniu ~6 kafli; w głębi szczelin słaba turkusowa nić grzybni z biomu niżej (`#45E6C0`, 1 px) |
| **Grzybowe Groty** | fioletowy łupek zarodnikowy oplatany **siecią grzybni** (linie światła `#45E6C0`, rozgałęzienia co 0,3–0,8 kafla, puls 0,3 Hz); śluz z połyskiem | **przecięta grzybnia świeci na krawędzi wykopu** (jasne punkty wzdłuż W1, gasną w 1 dobę gry) | huby (półki 0,3–0,6, W3), sieci w kominach (białe Wd), las grzybów do 18 kafli jako monumentalne sylwetki planu tylnego w dużych grotach | **mgiełka zarodników** przed tylną ścianą (żółtawa `#B8B060`, krycie ≤ 15%), gęstnieje przy kieszeniach zarodników |

Wspólne: stemple i półki krasnoludów na tylnej ścianie = W3; nowy wykop jaśniejszy o +6 L\* (świeża skała, zanika w 1 dobę).

## 4. Paleta barwna, światło i atmosfera (HEX ekranowe, z `docs/art/palette-illustrated.json`)
| Biom | Cięcie: mrok → plama | Sucha krawędź | Ściana boczna przód / tył | Tylna ściana: mrok / plama | Tusz | Ambient | Akcent biomu |
|---|---|---|---|---|---|---|---|
| Wapienne Progi | wapień `#6E6E6B`→`#8A816F`, piaskowiec `#756052`→`#A06D41`, łupek `#43464C`→`#5B575C` | `#5C5D5A` | `#646461` / `#50514F` | `#4C4C4A` / `#786B59` | `#1F1811` | `#5A6472` | saletra `#D8DAD8`, lampa `#FFB860` |
| Granitowe Korzenie | granit `#6F6464`→`#947366`, łupek ilasty `#353A44`→`#4D4A58` | `#5D5354` | `#645B5B` / `#504849` | `#4A4445` / `#836758` | `#221716` | `#4E5C78` | woda `#2E6E86`, kwarc `#B8B8BC` |
| Grzybowe Groty | ł. zarodnikowy `#4A4450`→`#6E5066`, grzybnia `#5A7770`→`#5E9079` | `#3A353F` | `#413C46` / `#2D2B33` | `#29272E` / `#7B6268` | `#1C151D` | `#2E6A66` | grzybnia `#45E6C0`, zarodniki `#B8B060` |

- **Światło**: plama lampy rozjaśnia tylną ścianę do 44–46 i przywraca barwę materiału; poza plamą barwa zabrana
  (C\* ×0,45), kreska i faktura zostają. Grzybnia w Grotach to jedyne „naturalne” światło (R 2–4, turkus) — chłodne,
  nie zastępuje ciepłych lamp (przytulność = lampa krasnoluda).
- **Trzy sceny tonu**: *izba wieczorem* — tylna ściana ciepła w plamie, gęsta od półek i narzędzi, niski kontrast;
  *przodek w mroku* — szara ściana ze śladami kilofa, tylko lampka hajera, kreska drży przy grozie; *zawał* — rysy Wd
  → W2 → W1 na stropie, pył z rys, barwa znika.

## 5. Warianty, wskazówki produkcyjne i prompty
**Kierunki (do turnieju: ≥ 10 wariantów, galeria biomów nocą + arena):** A **„warstwy ciągłe”** *(faworyt)* — tylna
ściana kontynuuje wzór cięcia (warstwy, ciosy) w ciemniejszej wartości; B **„ściana szkicowa”** — tylna ściana prawie
płaska (plamy σ 2), tylko podpisy wykopu/natury; C **„głęboka makieta”** — mocniejsze AO i ściany boczne (−6 → −16).
Osie: siła śladów narzędzi {0; 0,5; 1}, AO kąta {−4; −8; −12}, kierunek pociągnięć tylnej ściany {45°; 60°; pion}.

**Produkcja (shader terenu)**: wzór tylnej ściany = wzór materiału `bg` + flaga `NATURAL` (podpis wykopu vs natury) +
głębokość; ślady kilofa i otwory klinowe jako proceduralne „kalkomanie” na rzędach (hash z pozycji kafla, bez tekstur);
zacieki z pola bliskości wody (level-systems/sim dostarczają pole); świecące cięcia grzybni z czasu wykopu (atrybut
„świeżość” kafla); mgiełka zarodników jako osobna płaszczyzna z = −0,3 (krycie ≤ 15%). W1 na krawędzi z pola zajętości
płyty; LOD: Wd off w Okolicy.

**Czym różni się od referencji**: tam tło pomieszczeń to płaska, jednolita ściana z „kosmiczną” fakturą, a skała to
płaskie bloki z obrysem; u nas tylna ściana jest tą samą skałą co cięcie, wgłębioną w 2.5D, ze śladami konkretnych
narzędzi i procesów (kilof, kliny, naciek, grzybnia), z zapowiedziami zagrożeń i warstwami jak na planie kopalni.

**Prompt referencyjny**: *„Study sheet of recessed tunnel back walls in a 2.5D hand-drawn mine cross-section, three biomes
side by side: warm limestone strata with pick-axe marks, flowstone drapery and white saltpeter tufts; blocky salmon granite
with orthogonal joints, rows of half-round wedge holes and dark wet seeps under the joints; violet spore shale laced with
glowing teal mycelium threads, bracket fungi, faint yellow spore haze; thick warm umber ink line on the cut edge, darker
low-contrast back wall, lamp pool restoring color, colors drained in darkness but shapes kept, unexplored rock as dense
cross-hatching, gouache texture, original design”*.
