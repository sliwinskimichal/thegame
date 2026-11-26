# Biblia sztuki Underhearth — v1.1 (styl ilustrowany 2.5D)

> Autor: concept-artist · Status: **v1.1 do akceptacji game-director** (F1-2) · Data: 2026-11-26
> Zgodna z: `docs/team/vision/VISION.md` v1 (obraz jako „żywa mapa mierniczego”, słownik znaczeń, 4 zoomy, cele
> per kontekst) i `docs/team/CHARTER.md` §4. Źródła: `docs/narrative/01-world.md` §10, `03-companions.md`,
> `docs/variants/02-materials.md` + `src/render/palette.ts`, `docs/variants/01-render-style.md`, pomiar referencji
> właściciela (Dodatek B). Karty konceptów: `docs/art/concepts/`. Paleta jako dane: `docs/art/palette-illustrated.json`.
>
> Jasność = **L\* CIELAB na ekranie** (po świetle i gradacji), chyba że napisano „albedo” (`palette.ts`).
> „Kafel” = 1 jednostka świata ≈ 1 m. Zoom: **px/kafel = H_ekranu / (0,536 · d)** (FOV 30°).

---

## 0. Parametry dla silnika (jedna tabela — runda 2 turnieju nr 3)

Liczby startowe dla `engine-graphics-programmer`. Zakres = pole manewru turnieju, „typ.” = faworyt.
Zoomy z wizji przy 1080p: **Izba** d ≈ 12 (~168 px/kafel), **Gród** d ≈ 35 (**~58 px/kafel, krasnolud ~75 px —
domyślny**), **Okolica** d ≈ 110 (~18 px/kafel), **Mapa** (cała góra). Brief F1-2 podawał 40 px/kafel (d ≈ 50) —
przeliczenia w tabeli. Do porównań z referencją: `refstats.py` mierzy ją w ~21,5 px/kafel (zrzut 960×540 z d ≈ 47).

| Grupa | Parametr | Wartość (typ.) | Zakres turnieju | Uwagi |
|---|---|---|---|---|
| **Kreska — wagi** (stałe w px ekranu, ×H/1080; **nie rosną z zoomem**) | **W1**: granica skała↔pustka, obrys postaci | **4 px** (= 0,07 kafla w Grodzie; 0,10 przy 40 px/kafel) | 3–5 px | ciągła |
| | **W2**: obrys budowli i maszyn | **3 px** (0,05 / 0,075) | 2,5–3,5 | |
| | **W3**: obrys rekwizytów i infrastruktury (drabiny, rury, pomosty, beczki, meble) | **2 px** (0,035 / 0,05) | 1,5–2,5 | |
| | **Wd** (detal): podziały wewnętrzne, pęknięcia, warstwy, słoje, nity, **znaki form minerałów** | **1,25 px** (0,02 / 0,03) | 1–1,5 | krycie 60–80% |
| | nierówność statyczna (ręka) | grubość ±20%, odchylenie ±0,6 px, fala 0,6–1,2 kafla | ±10–30% | **nieruchoma** — w spoczynku kreska nie drży |
| | **drżenie = groza** (jedyne ruchome) | 0 w spoczynku; w mroku i grozie do ±1,5 px, krok 8 kl./s | 0–2 px | tylko sygnał grozy, nigdy dekoracja |
| | kolor tuszu | ciepła prawie-czerń **`#201812`** (L\* 9, C\* 6), odcień per biom (§4.2) | L\* 6–12, C\* 4–9 | nigdy `#000` |
| | kreska w rdzeniu plamy lampy | L\* 16–20, 25% barwy lampy | — | brak efektu wycinanki |
| | kontur rzeczy żarzących (ogień, lawa, metal płynny) | `#6A2A0E` | — | |
| | tryb dostępności „mocna kreska” | wagi ×1,5 | — | wizja §3 (zamiast R2A) |
| **LOD kreski** | Izba / Gród | wszystkie wagi + Wd | — | |
| | Okolica | W1 3 px, W2 2 px, W3 1,5 px, **Wd wyłączony**, faktura → płaska barwa | — | postacie jako znaki (nakrycie głowy + lampa) |
| | Mapa | rysunek mapy mierniczego: kontury komór W2, znaki legendy budowli, kreskowanie nieznanego | — | wspólnie z ui-ux |
| **Wartości L\* — plan gry** | płaszczyzna cięcia skały, **w mroku** (tylko ambient) | **22–48**; mediany: Podgórze 34, Progi 46, Korzenie 43, Groty 30, Zatopione 29, Kryształowe 33, Magma 28, Prastare 27, Serce 25 | ±4 | barwa zabrana do C\* ×0,45 — kształt i kreska zostają |
| | ta sama skała w plamie lampy | +8 L\*, pełna barwa materiału | — | kolor wraca tylko w świetle |
| | sucha krawędź (pas wewnątrz W1, po stronie bryły) | 0,12 kafla, −7 L\*, brzeg poszarpany 0,05 kafla | 0,08–0,18 / −4…−10 | spadek wartości, **bez kreskowania** |
| | rekwizyty i maszyny planu gry | w świetle 40–62, w cieniu 26–40, połysk metalu ≤ 75 | — | kontrast do tła ≥ 18 L\* |
| | postacie | strój 30–48, broda 16–73 (≥ 15 L\* od stroju), twarz i dłonie 58–68, lampa 88–98 | — | |
| | źródła światła | 85–98 | — | jedyne miejsca bliskie bieli |
| | akcenty rud (znaki form, błyski) | 45–90, bez gradacji | — | „nasycenie = informacja” |
| **Wartości L\* — plan tylny** (ciemniej, mniej kontrastu) | ściany boczne wykopu | −4 (przód) → −12 (tył) względem cięcia | — | |
| | tylna ściana w mroku | cięcie −14 (min 14) → **14–32**, C\* ≤ 6 | — | |
| | tylna ściana w plamie lampy | **44** (Progi, Korzenie **46**) | 40–48 | zawsze ciemniejsza od rzeczy planu gry w tej samej plamie |
| | rekwizyty planu tylnego (półki, beczki, rury za grą) | ±12 L\* od tylnej ściany, C\* ≤ 15, kreska W3/Wd | — | gęstość = zamieszkanie, bez walki o uwagę |
| **Nieznane** | gęste kreskowanie tuszem na podkładzie | podkład `#333232` (L\* 21), krzyżowe linie Wd co 0,15 kafla (≈ 9 px w Grodzie) pod 45°/−45°, średnio L\* 14–17 | odstęp 0,12–0,2 | **kreskowanie tylko tu**; odkrycie „dorysowuje” świat (0,3–0,5 s) |
| **Gradacja materiałów** | ekspozycja albedo per biom | Podgórze ×1,98 · Progi ×0,60 · Korzenie ×0,60 · Groty ×2,29 · Zatopione ×1,64 · Kryształowe ×1,19 · Magma ×1,90 · Prastare ×3,42 · Serce ×4,42 | ×0,6 min | < 0,6 zgniata pary „ciemna ruda na ciemnej skale” (Dodatek B) |
| | miękka podłoga | L' = (L⁴ + 17⁴)^¼ | 15–19 | nic naturalnego nie schodzi do wartości tuszu |
| | kolano świateł | skały 32 → maks. 48; matryce rud 40 → maks. 60; akcenty 70 → maks. 90 | ±4 | `tanh` nad kolanem |
| | chroma w świetle / w mroku | skały ×0,8 / ×0,45 (+8% barwy ambientu); matryce rud ×0,9 / ×0,5; akcenty ×1,0 zawsze | — | mrok zabiera kolor, nie kształt |
| **Faktura pędzla** | plamy (mottling) | σ 3 L\* (maks. ±4), skala 0,3–0,8 kafla, anizotropia 3:1 | σ 2–4 | referencja 3,05 |
| | kierunek pociągnięć | cięcie: wzdłuż warstw (±15°); tylna ściana: ukośnie 60°; ściany boczne: w głąb | — | rozdziela płaszczyzny |
| | ziarno | σ 1,3 L\*, 0,05–0,1 kafla, w przestrzeni świata | σ 1–2 | referencja 1,32; zero szumu ekranowego |
| | wariacja barwy w plamach | ±4° odcienia, ±2 C\* | — | |
| **Gęstość rysunku** | linie wszystkich wag w kadrze grodu | ≥ 1,1 kafla linii / kafel² (skała 0,5–0,8; izby 2–3) | — | warunek krawędzi ≥ 15% |
| | linie W1–W3 | ≥ 0,5 kafla / kafel² | — | warunek kreski ≥ 3% |
| **Światło** | ambient (chłodny, per biom) | Progi `#5A6472` · Korzenie `#4E5C78` · Groty `#2E6A66` · Zatopione `#2C5662` · Kryształowe `#6A76A6` · Magma `#6E2E1E` · Prastare `#44304E` · Serce `#521A24` | — | |
| | plama: rdzeń / halo | rdzeń 0,35 R: +16…+20 L\*; halo do R: +6; miękki brzeg rdzenia (smoothstep 0,12 R) | 2 strefy vs ciągła | barwa lampy tylko w plamie — **nie barwimy kadru** |
| | źródła (barwa, R w kaflach, migotanie) | kaganek `#FFC878`, 6, ±2% · pochodnia `#FFB45A`, 8, ±6% (3–7 Hz) · kosz żarowy `#FF9A48`, 7, ±5% · latarnia olejna `#FFC878`, 9, ±2% · Palenisko `#FFB060`, 6/9/12 · lampa kryształowa `#CFEFFF`, 12, puls 0,4 Hz | R ±20% | żadnych żarówek na kablach |
| | poświata krawędzi R2B (`uRimTint`) i świecące powietrze | **wyłączone**; cięcie przy oświetlonej wnęce maks. +6 L\* w pasie 0,5 kafla | 0–0,03 | krawędź niesie kreska (wizja) |
| | bloom | tylko emitery, próg L\* ≥ 85, promień ≤ 0,6 | — | kreska nad bloomem |
| | błysk rudy | **rysowana gwiazdka** 4-ramienna 3–5 px (wypełnienie `sheen`, obrys Wd), 1–3 / kafel, tylko na ziarnach | — | nie HDR |
| **Cele kadru** (CHARTER §4, per kontekst) | gród oświetlony | L\* śr. **36–40** · czerń **15–22%** · chroma **13–18** · krawędzie **≥ 15%** · kreska **≥ 3%** · **≤ 8% pikseli C\* > 30** | — | scenariusz: izba wieczorem |
| | odkryta dzika głębia | L\* ≥ 26 · czerń ≤ 30% · kreska ≥ 3% | — | scenariusz: przodek w mroku |
| | strefa Raroga | wyjątek: zabiera światło, kolor i kreskę | — | |

---

## 1. Kierunek wizualny, funkcja i nastrój

**Idea główna — „żywa mapa mierniczego”.** Góra Kuźnica to ręcznie rysowany i podkolorowany przekrój, jak dawna
mapa kopalni, który ożył jako przytulna makieta. Mierniczy wykreślił warstwy skały i komory pewną kreską, nieznane
zakreskował, żyły kruszców oznaczył znakami — a gród wpisał się w ten rysunek jako ciepłe, gęsto zamieszkane izby.
Rodzinę stylu dzielimy z referencją właściciela (gruby nierówny kontur, płaskie plamy z fakturą, przygaszona paleta,
ciepłe światła, gęste piętra), a dokładamy trzy rzeczy własne (wizja §1): **głębię 2.5D** (wnęki, tylne ściany),
**mrok jako treść** (trochę ciemniej, bo światło jest zasobem) i **tożsamość słowiańsko-górniczą**: dawne mapy kopalń,
solne kaplice, ciesielstwo podhalańskie, gwara, Skarbnik, Święto Lampy, mundur górniczy z czakiem i kitą.

**Emocja.** Ciepło paleniska w głodnej światła górze. Przytulność rodzi się z kontrastu ciepłej izby i zimnej skały;
groza — z odejmowania (koloru, kreski, dźwięku), nie z dosłowności.

**Rola w rozgrywce.** Styl służy czytaniu gęstej symulacji:
1. **Trzy plany** — tylna ściana i wnęki (ciemniej, mniej kontrastu), plan gry, krawędź cięcia makiety — czytelne
   w 1 s na każdym zoomie.
2. **Skała do czytania** — złoże rozpoznaje się po **rysowanym znaku formy** i jasności, barwa dochodzi w świetle.
3. **Praca i rola** — nakrycie głowy i narzędzie w sylwetce; stan społeczny — jeden akcent barwny.
4. **Światło jako zasób** — ciepła plama = życie, praca, bezpieczeństwo; mrok = utrata koloru, nie kształtu.
5. **Nieznane jak niezbadana mapa** — gęste kreskowanie, które kopanie i Pieśń „dorysowują”.

**Słowa-klucze.** mapa mierniczego · kreska tuszem · gwasz · ciepłe plamy w chłodnym półmroku · ciężkie trapezy ·
drewno i płótno → kamień i miedź → żelazo, para, runy · sól i sadza · ślady pracy · godność ludzi pracy.

### 1.1 Słownik znaczeń (wizja §2.1 — obowiązuje każdy element)
| Środek | Znaczy zawsze i tylko | Reguła produkcyjna |
|---|---|---|
| ciepła plama światła | życie, praca, bezpieczeństwo | barwa lampy wyłącznie w plamie; żadnego barwienia kadru |
| utrata koloru, chłód | brak światła | w mroku C\* ×0,45 i chłód ambientu; **kształt, faktura i kreska zostają** |
| drżenie kreski | groza narastająca w mroku | jedyna ruchoma kreska; amplituda z poziomu grozy; zakaz dekoracyjnego drżenia |
| gęste, ciemne kreskowanie | nieznane, nieodkryte | cień w odkrytym = tylko spadek wartości albo rzadka jasna faktura |
| nasycony akcent, błysk | informacja: złoże, magia, zagrożenie, stan postaci | ≤ 8% pikseli C\* > 30 w kadrze grodu |
| gęstość rekwizytów | zamieszkanie (pustka = dzikość albo opuszczenie) | gród gęsty, dzika głębia rzadka i monumentalna |
| linia idealnie prosta | Prakowale: maszyna, obcość | jedyne miejsce bez nierówności ręki |
| linia światła bez wypełnienia | Pieśń Kamienia i pamięć (Krążki) | bez tuszu |
| zanik kreski, popiół w górę | Raróg | jedyny byt bez kreski |

### 1.2 Filary (checklista game-director)
| # | Filar | Pytanie kontrolne |
|---|---|---|
| F1 | Trzy plany | Czy po redukcji do 3 wartości widać cięcie, plan gry i tylną ścianę? |
| F2 | Światło opowiada | Czy ciepłe = życie, a mrok zabiera kolor, ale nie kształt? |
| F3 | Kreska to kultura | Czy po samej linii widać, kto to zbudował (krasnolud, gnom, Prakowale, natura, Raróg)? |
| F4 | Głębia zmienia świat | Czy kadr z każdego biomu rozpoznaję po palecie skały w świetle i barwie ambientu? |
| F5 | Gęstość = zamieszkanie | Czy izba ma ślady życia na niskokontrastowym planie tylnym, a dzika głębia oddycha pustką? |
| F6 | Trzy sceny tonu | Czy element działa w *izbie wieczorem*, *przodku w mroku* i *zawale*? |

---

## 2. Sylwetka, proporcje i hierarchia czytelności

### 2.1 Skala (1 kafel ≈ 1 m)
| Obiekt | Wysokość [kafle] | Szerokość [kafle] | px w Grodzie (58 px/kafel) | Uwagi |
|---|---|---|---|---|
| Krasnolud-robotnik | **1,30** (z nakryciem głowy); **3,4 głowy** bez nakrycia | 0,62 w barkach | ~75 × 36 | karta `concepts/dwarf.md`; bez chibi |
| Gnom | 0,95 | 0,45 | 55 × 26 | wielkie dłonie, gogle |
| Korzenna/Korzenny (Wilga) | 1,55 | 0,50 | 90 × 29 | smuklejsi |
| Popielny (Żarko) | 1,40 | 0,66 | 81 × 38 | nagi tors = duża jasna plama |
| Ociosany (Odźwierny) | 3,0 | 1,4 | 174 × 81 | kamień bez rysów twarzy |
| Tunel min. / izba | 2 / ≥ 3 | — | — | krasnolud + narzędzie + lampa pod stropem |
| Drzwi / drabina / pomost | 1,7 / 0,5 szer. / 0,25 grub. (kamienny 0,5) | — | — | |
| Budowle (dane `size`) | Palenisko 3×2 → 4×3 → 5×4; huta 2×2 → 3×3 → 4×3 | — | — | karty `hearth.md`, `smelter.md` |

### 2.2 Języki form (każdy ma własną kreskę)
| Język | Bryła i proporcje | Kreska | Ornament | Barwy | Zakazy |
|---|---|---|---|---|---|
| **Krasnoludzka technika** — „ciężka geometria podhalańska” | prostopadłościany i **trapezy szersze u dołu**, łuki z klińcami, zręby belek z wystającymi ostatkami; środek ciężkości nisko; ściany ≥ 0,25 kafla | **ciężka i spokojna**: wagi pełne, nierówność ±20%, długie pociągnięcia | **tylko w miejscach znaczenia** (Palenisko, Krążnica, grób króla, sale przodków): wilcze zęby (piłka trójkątów 0,12 kafla), rozeta sześciopłatkowa; w budowlach codziennych — tylko konstrukcja: nity co 0,2 kafla, okucia, kliny | ochra, miedź oksydowana, biel soli, czerń żelaza, dąb | cienkie wysmukłe formy, zaokrąglony „plastik”, ekrany, cepeliada |
| **Gnomia nauka** — „szkło i miedź” | okręgi, spirale, rurki, asymetria, przeciążone konstrukcje na cienkich nogach; bańki 0,2–0,5 kafla | **cienka i nerwowa**: wagi ×0,7, gęste załamania i zawijasy (statyczne), dużo Wd (nity, łaty) | łaty przynitowane krzywo, manometry, sprężyny | patyna `#5A9080`, mosiądz `#B89A50`, porcelana `#E8E4DC`, płyny zielony `#6AE070` i fioletowy `#B070F0` (tylko w bańkach) | trapezy krasnoludzkie, symetria |
| **Technika Prakowali** — „kamień, który śpiewa” | monolity bez spoin, idealne sześciokąty, koncentryczne pierścienie, skala ×2–4 krasnoluda | **idealnie prosta**: zero nierówności, stała grubość W2; detal tylko jako **świecące rowki** (linia światła) | sześciokąt, pierścień, glif-spirala | czarny łupek `#2A2A34`, kość `#D8D0BC`, żyły lśnitu `#C4ECFF`, puls `#8FD8FF` | śruby, nity, łaty, ciepłe światło |
| **Natura** (skała, grzyby, stwory) | organiczne, nieregularne; drapieżcy — ostre zakończenia | nierówność ±30%, przerwy do 4% (tylko W3/Wd) | pęknięcia, słoje, blaszki | paleta biomu | — |
| **Magia** | Pieśń: koncentryczne pierścienie biegnące w skale; runy: kanciaste znaki; druidyzm: sylwetka rozsypuje się w liście i kamyki | **linia światła bez wypełnienia** | — | Pieśń: barwa `sheen` rud; runy: turkus `#6FF0FF`; druidyzm: bursztyn i zieleń | futhark, celtyckie plecionki |
| **Raróg (czarny płomień)** | języki ognia „w negatywie”, popiół leci w górę | **brak kreski**: krawędź płomienia to miejsce, gdzie kreska świata rozpada się na **płatki (popiół = płatki kreski)** unoszące się w górę; obwódka z biblii (`01-world.md` §7.4) to miękki „siniak” `#3A1A2A`→`#5A1A3A` (0,06 kafla, bez linii) | — | rdzeń `#070508` | skrzydła, bicz, miecz, ryk, czerwono-pomarańczowy demon |

W promieniu Raroga świat traci po kolei: barwę (C\* → 0), fakturę pędzla, kreskę Wd, potem W3–W1 (przerywane,
rozsypujące się w płatki). Plamy lamp kurczą się do rdzenia. Kolejność odejmowania jest stała — to język grozy.

### 2.3 Hierarchia 70/20/10
| Warstwa | Co | Udział ekranu | L\* | C\* | Kreska | Kontrast lokalny |
|---|---|---|---|---|---|---|
| **70% — odpoczynek** | płaszczyzna cięcia, plan tylny (tylne ściany, rekwizyty tła), nieznane | 55–70% | 14–48 | 1–16 (w mroku ≤ 8) | W1 na krawędzi cięcia, Wd w skale | niski: faktura σ 2–4, rekwizyty tła ±12 |
| **20% — średni detal** | budowle, maszyny, pomosty, drabiny, rury i meble planu gry | 20–35% | 26–62 | 10–28 | W2/W3 obrys, Wd części | ΔL\* 15–25 między częściami, ≥ 18 do tła |
| **10% — skupienie** | postacie, płomienie i lampy, znaki rud i błyski, zagrożenia, obiekty interaktywne | 3–10% | twarze 58–68, światła 85–98, akcenty 45–90 | 25–80 (≤ 8% kadru) | W1 postacie | ΔL\* ≥ 30 do tła albo ruch |

Zasady: **czerń (L\* < 15) tylko dla kreski, nieznanego i Raroga**; najjaśniejsze są światła i twarze, nigdy skała;
krasnolud na tylnej ścianie w plamie (L\* 44–46) ma strój L\* 30–48, a twarz i lampę jaśniejsze — czyta się jako
ciemna, krępa sylwetka z jasnym „okiem” (lampa + twarz); rekwizyty planu tylnego nie mogą zasłaniać ani
przekrzykiwać krasnoludów, rud i zagrożeń.

### 2.4 Czytelność na czterech zoomach (wizja §3)
| Zoom | d / px/kafel @1080p | Krasnolud | Co musi przetrwać | Co znika |
|---|---|---|---|---|
| **Izba** | ~12 / ~168 | ~220 px | twarze, warkocze ze znakami cechu, faktura, ornament w miejscach znaczenia | — |
| **Gród** (domyślny) | ~35 / ~58 | ~75 px | rola z sylwetki (nakrycie głowy + narzędzie), stan (1 akcent), znaki form rud, budowle z poziomem w materiale | twarz jako detal (zostaje jasna plama) |
| **Okolica** | ~110 / ~18 | ~24 px | sylwetki, plamy światła, błyski rud, sygnały zagrożeń, kreskowanie nieznanego | Wd, faktura (płaska barwa < 12 px/kafel), szczegóły strojów — postać = nakrycie głowy + lampa |
| **Mapa** | cała góra | znak | komory, szyby, znaki legendy (budowle, złoża), kreskowanie nieznanego — jak plan kopalni | postacie, rekwizyty |

**Testy przed turniejem każdego obiektu:** (1) sylwetka wypełniona tuszem rozpoznawalna w Grodzie; (2) redukcja do 3
wartości zachowuje funkcję; (3) deuteranopia + skala szarości: akcenty dalej odstają; (4) trzy sceny tonu.

---

## 3. Materiały, konstrukcja i detale funkcjonalne (callouts)

### 3.1 System kreski
| Waga | Px @1080p | Gdzie | Kolor | Uwagi produkcyjne |
|---|---|---|---|---|
| W1 | 4 | granica płyta↔pustka (krawędź wykopu i jaskini), obrys postaci i stworów | tusz biomu | z pola zajętości płyty (`fogAt().y` / odległość do granicy) w shaderze terenu; postacie — odwrócona skorupa albo krawędzie z bufora głębi |
| W2 | 3 | obrys budowli i maszyn, styk ściany bocznej z tylną | tusz +3 L\* | per siatka budowli; części ruchome osobno |
| W3 | 2 | obrys rekwizytów i infrastruktury | tusz +3 L\* | |
| Wd | 1,25 | podziały wewnętrzne, pęknięcia (0,6–0,8 kafla linii na kafel² skały), warstwy, słoje, nity, **znaki form minerałów** | tusz, krycie 60–80% | wyłączony w Okolicy |
| linia światła | 1,5–2 | Pieśń, runy, rowki Prakowali, Krążki | barwa źródła | bez tuszu |
| linia żaru | jak waga obiektu | ogień, lawa, metal płynny | `#6A2A0E` | |
| brak kreski | — | Raróg | — | płatki kreski w górę |

### 3.2 Faktura pędzla
1. **Plamy** w każdej płaskiej strefie > 1 kafel²: σ 3 L\*, 0,3–0,8 kafla, wydłużone 3:1 wzdłuż kierunku pociągnięć
   (cięcie — wzdłuż warstw; tylna ściana — ukośnie 60°; ściany boczne — w głąb).
2. **Ziarno** σ 1,3 L\* na 0,05–0,1 kafla, przyklejone do świata (nic nie „pływa” przy przewijaniu).
3. **Sucha krawędź** — pas 0,12 kafla wewnątrz W1, −7 L\*, poszarpany brzeg: cień jako spadek wartości, **nigdy
   kreskowanie** (kreskowanie = nieznane).
4. **Wariacja barwy** w plamach: ±4° odcienia, ±2 C\*.
5. Zakazy: faktura na kresce, szum < 0,03 kafla (mieni się w ruchu), powtarzalność widoczna z d = 35 (bramka E2).

### 3.3 Konstrukcja przekroju (2.5D)
| Płaszczyzna | Geometria (`heightfield.ts`) | Pociągnięcia | Wartość | Kreska |
|---|---|---|---|---|
| płaszczyzna cięcia | z = 0 | wzdłuż warstw | 22–48 w mroku, +8 w świetle | Wd pęknięcia i warstwy; W2 granica dwóch skał (rzadko, przerywana) |
| krawędź cięcia | jitter 0,07 (wykop) / 0,16 (natura) | — | sucha krawędź −7 | **W1** |
| ściany boczne (strop, spąg, boki) | AO 0,55 (tył) → 1,0 (przód) | w głąb | −4 → −12 | W2 na styku z tylną ścianą |
| tylna ściana | głębokość 1 kafel (wykop) / 1,4–3,8 (jaskinia) | ukośnie 60° | 14–32 w mroku, 44–46 w plamie | Wd: ślady narzędzi lub naciek (karta `cavity-backwall.md`) |
| kąt tylnej i bocznej | AO | — | −8 w pasie 0,25 kafla | — |
| plan gry (budowle, postacie) | z = −0,45 (tunel) / −1,2 (powierzchnia) | wg materiału | 26–62 | W1–W3 |
| plan tylny (rekwizyty tła) | z ≤ −0,6 | wg materiału | tylna ściana ±12 | W3/Wd |

### 3.4 Materiały kultur — albedo i postęp poziomów budowli
**Poziom budowli widać w materiale** (wizja §3): **poz. 1 — drewno i płótno** (glina, skóra, sznur) → **poz. 2 —
kamień i miedź** (cegła, brąz) → **poz. 3 — żelazo, para, runy** (stal, kotły i rury, runy ochronne; złoto i klejnoty
tylko w miejscach znaczenia).

| Materiał | HEX (światło / cień) | L\* / C\* | Faktura i zużycie | Poziom |
|---|---|---|---|---|
| dąb (belki, stemple, deski) | `#7A5634` / `#5A3E26` | 34–42 / 24 | słoje Wd, ślady topora, jaśniejsze końce belek | 1 |
| płótno, len (daszki, worki, osłony) | `#8A8270` / `#6A6456` | 45–53 / 8 | łaty, sznurowanie, plamy sadzy | 1 |
| glina (dymarka, polepa) | `#9A6A48` / `#6A3A28` przepalona | 30–49 / 28–31 | spękania Wd, przepalone lico ciemniejsze | 1 |
| skóra (miechy, fartuchy) | `#6A4630` / `#4A3020` | 24–34 / 18 | przetarcia `#8A6448`, szwy Wd | 1 |
| kamień ciosany | `#AB9676` / `#8F7C60` (`STONE_BRICK`) | 52–60 / 19 | spoiny Wd, fazowane krawędzie, sadza nad ogniem | 2 |
| cegła | `#8E4C32` / `#6A3A26` | 30–40 / 37 | spoiny `#B8A890`, przepalone lico | 2 |
| miedź (duże płaszczyzny — oksydowana) | `#8A5A3A` z jasną krawędzią `#C8844A`; patyna `#5A9080` | 40–54 / 22–48 | patyna od dołu i w zagłębieniach | 2 |
| brąz | `#9A7040` / `#6A4C2C` | 34–50 / 30 | | 2 |
| żelazo kute / stal | `#4A4644` / `#2E2B2A` | 20–30 / 2 | nity co 0,2 kafla, rdza `#8A4A2A` w zagłębieniach | 3 |
| para (kłęby) | `#D8D4CC` przy 50–70% krycia | 80–86 / 4 | kontur W3 przerywany, rozwiewa się w 1–2 s | 3 |
| runy ochronne | rowek `#2A2A34`, światło `#6FF0FF` | — | linia światła, puls 0,4 Hz | 3 |
| mosiądz | `#B89A50` / `#8A6A2E` | 46–65 / 43 | połysk na krawędziach — małe powierzchnie | 2–3 |
| sól (rzeźba) | `#E6E2D8` / `#B8B8B0` | 74–90 / 5 | półprzejrzysta, ciepły odblask lamp | kaplice |
| obsydian | `#2A2236` / `#120E1A` | 6–15 / 15 | **muszlowy przełam**: łuki Wd z jasnym brzegiem | Popielni, kuźnia magmowa |
| czarny łupek Prakowali | `#2A2A34` / `#1E1E26` | 12–17 / 6 | bez spoin, świecące rowki | ruiny |
| czarne złoto | `#2A2418` z połyskiem `#E0B040` | 15 / 10 | drobne błyski w rytmie szeptu | przeklęte przedmioty |

### 3.5 Zużycie i opowiadanie bez słów
- **Sadza** nad każdym ogniem: −10 L\* przy źródle → 0 po 1,5–2 kaflach, wąsko u dołu, szeroko u góry.
- **Naprawy**: nowe cegły i kamienie jaśniejsze o 6–8 L\* i z czystszą linią; łaty z innego materiału. Wygnańcy
  wracają do sal przodków — stare rzeźby (rozety, wilcze zęby) zatarte i spękane, nowe dodatki proste.
- **Ślady pracy**: wiórki pod kozłem, żużel pod hutą, urobek pod przodkiem, mokre plamy przy pompach.
- **Stan społeczny**: zastawni — szare płótno, blaszka długu na sznurku, **bez akcentu barwy i bez lampy** (niosą
  łuczywo); hajerzy — skóra, lampa, kitka; Waga — mosiądz; Korona — haft rozet.
- **Tragedia przez odejmowanie** (wizja §2.3 pkt 4): śmierć i krzywda poza kadrem; po zawale miejsce traci kolor,
  zostaje kreska i pusty stołek, zgaszona lampa, imię na Ścianie Szychty.

### 3.6 Czytelność rud
1. **Ruda = matryca + akcent + forma + połysk**, a **forma jest głównym nośnikiem i rysuje się kreską** Wd jako znak
   (pokład = pasma z kliważem; dendryt = rozgałęzienie; nerki = grona kółek; igły = pęki kresek; sześciany = kwadraty;
   bryłki = nieregularne owale; pył = kropki; kryształy: pryzmaty, szczotka, heksagony, odłamki).
2. Granica żyły ze skałą — Wd ciągła (nie W1: krawędź W1 należy do pustki).
3. **Pary rozsuwa jasność** (ΔL\* ≥ 10 dla par z tego samego biomu, także w mroku, gdzie barwa jest zabrana do ×0,45).
4. **Nic w skale nie ma wartości tuszu**: matryce i akcenty ≥ L\* 17 (korekta cyny, §4.5).
5. Błysk = rysowana gwiazdka (0, 1–3 / kafel), nie HDR; saletra matowa; aura żyły nie jest nośnikiem (maks. 0,04).
6. **Obsydian** rozpoznawalny po muszlowym przełamie (2–3 łuki Wd z jasnym brzegiem na kafel), nie po iskrach.
7. W nieznanym — żadnych rud (chyba że Nasłuch/sonda: wtedy znak formy rysuje się jasną linią światła na kreskowaniu
   na 3 s).

### 3.7 Czytelność zagrożeń
| Zagrożenie | Kształt | Barwa | Ruch | Kreska |
|---|---|---|---|---|
| zawał | rysy rosnące od stempli, pył z rys | rysy tuszem; Ostrzeżenie Pieśni: siatka `#E8542A` | pył opada, rysy się wydłużają | Wd → W2 → W1 tuż przed zawałem; **drżenie** narasta |
| zalanie, woda pod ciśnieniem | lustro wody z jasną linią; mokre zacieki przed przebiciem | woda `#2E6E86`, piana `#CFE8F0` | falowanie, kapanie | lustro: linia światła |
| zarodniki | kłęby z kropkami | `#B8B060` → `#8A9A40` | wirowanie | bez kreski |
| jad | krople, kałuże | `#7AD040` | kapanie | Wd |
| mróz | szron jako biała piłka (sawtooth) na krawędziach | `#CFF4FF` / `#7AE4FF` | iskrzenie | jasna linia na krawędzi |
| żar i lawa | płyty skorupy na jasnym tle | rdzeń `#FFE6A0`, lawa `#FF5A1A`, skorupa `#2A1410` | falowanie powietrza | linia żaru |
| wyziewy | smuga | `#C8D050` | snucie | — |
| groza (mrok, Prastare) | odejmowanie barwy, winieta | — | **drżenie kreski** | kreska drży, potem rwie się |
| wróg | ostre kąty (natura) | oczy: 2 jasne punkty | ruch | W1 |

Zagrożenie ma ≥ 25 L\* kontrastu do tła albo ruch. `#E8542A` zastrzeżony dla alarmów.

---

## 4. Paleta barwna, światło i atmosfera

### 4.1 Skrypt barwny
Historia barw materiałów z turnieju nr 2 zostaje: ciepła ziemia → krem, ochra i szare łupki → łososiowy granit
i niebieski łupek → fiolet pod turkusową grzybnią → czarno-zielony mułowiec → zimna lawenda → czerń i ogień →
śliwka i runy → karmazynowe serce. Zgodnie z wizją **kolor biomu niosą światło i akcenty**: w mroku skała jest
przygaszona i chłodna (barwa ambientu biomu), w plamie lampy odzyskuje pełną barwę materiału. Lampy krasnoludów
zawsze ciepłe; wyjątki fabularne: Kryształowe Głębie (plama grzejnika = przeżycie), Pas Magmy (odwrócenie:
otoczenie gorące, **chłód mroźnych rdzeni `#7AE4FF` = bezpieczeństwo**), Prastare i Serce (obce światło run i żaru
walczy z lampami grodu).

### 4.2 Paleta ekranowa per biom (HEX — to, co widzi gracz)
Gradacja z §0 (ekspozycja, podłoga 17, kolano, chroma), korekty z §4.5. Skała: **w mroku → w plamie lampy**.
Pełne dane: `docs/art/palette-illustrated.json`.

| Biom | Ekspozycja | Skały cięcia: mrok → plama (L\* skały 1 w mroku) | Sucha krawędź | Tylna ściana: mrok / plama | Podkład nieznanego | Tusz | Ambient | Światło biomu |
|---|---|---|---|---|---|---|---|---|
| Podgórze | ×1,98 | gleba `#5C4D46`→`#825B3F` (34) | `#4A3D38` | `#382E2B` / `#816249` | `#343231` | `#201812` | `#56647E` | `#FFB45A` |
| Wapienne Progi | ×0,60 | wapień `#6E6E6B`→`#8A816F` · piaskowiec `#756052`→`#A06D41` · łupek `#43464C`→`#5B575C` (46) | `#5C5D5A` | `#4C4C4A` / `#786B59` | `#333232` | `#1F1811` | `#5A6472` | `#FFB860` |
| Granitowe Korzenie | ×0,60 | granit `#6F6464`→`#947366` · łupek ilasty `#353A44`→`#4D4A58` (43) | `#5D5354` | `#4A4445` / `#836758` | `#343232` | `#221716` | `#4E5C78` | `#FFAE5C` |
| Grzybowe Groty | ×2,29 | ł. zarodnikowy `#4A4450`→`#6E5066` · grzybnia `#5A7770`→`#5E9079` (30) | `#3A353F` | `#29272E` / `#7B6268` | `#333234` | `#1C151D` | `#2E6A66` | `#FFBE6E` + grzybnia `#45E6C0` |
| Zatopione Głębie | ×1,64 | mułowiec `#3C4648`→`#505955` (29) | `#2D3638` | `#1F2729` / `#6B685F` | `#323333` | `#0C1A1B` | `#2C5662` | `#FFB870` |
| Kryształowe Głębie | ×1,19 | ł. krystaliczny `#4D4C5D`→`#6B5B73` (33) | `#3D3C4B` | `#2D2D3A` / `#78626B` | `#333234` | `#171924` | `#6A76A6` | grzejnik `#FF9A50`, kryształy `#7AE4FF` |
| Pas Magmy | ×1,90 | bazalt `#464143`→`#5F5154` · skała magmowa `#49332B`→`#6F3C2A` (28) | `#363133` | `#282223` / `#7B625E` | `#323233` | `#21120D` | `#6E2E1E` | lawa `#FF6A2A`, chłód `#7AE4FF` |
| Prastare Głębiny | ×3,42 | prakamień `#453E42`→`#614E4B` · prastary mur `#6C7183`→`#7D859F` (27) | `#352F33` | `#272226` / `#78645B` | `#333233` | `#1C131A` | `#44304E` | runy `#6FF0FF` |
| Serce Góry | ×4,42 | sercokamień `#4D3538`→`#723F40` · skała macierzysta `#39323A`→`#4F424E` (25) | `#3B2629` | `#311F21` / `#865E57` | `#343232` | `#1F0F11` | `#521A24` | żar `#FF2A3A` |

Tylna ściana „w plamie” liczona dla ciepłej lampy grodu (`#FFB860` w Prastarych i Sercu) — lampa gracza jest ta sama
w całej grze; obce światło biomu dodaje się na nią. Chroma powierzchni w mroku: 1–11 (cel „mrok zabiera kolor”),
w plamie: 4–36 (piaskowiec 36 — jedyny duży nośnik ciepłej barwy w Progach, celowo).

### 4.3 Barwy stanów i frakcji (stroje — przygaszone; akcent — mały i nasycony)
Duże płaszczyzny strojów C\* ≤ 26; **jeden akcent stanu** (kitka, wstęga, blaszka) ≤ 10% sylwetki może mieć C\* > 30.
| Grupa | Strój (duże płaszczyzny) | Akcent stanu (jeden) | Znak |
|---|---|---|---|
| Hajerzy (wolni górnicy) | ochra `#7E6446` + skóra `#5E4432` | kitka ochrowa `#C8902E` na hełmie | lampa na hełmie, węzły cechu w brodzie |
| Mistrzowie cechów | jak cech + ciemniejszy fartuch | kitka biała `#E6E0D2` | — |
| Zastawni | szare płótno `#6E6A62` | **brak barwy**: blaszka cyny `#9AA0A0` | numer na blaszce, łuczywo zamiast lampy |
| Korona | wiśnia `#6A3436` | kitka karmazynowa `#A8303A` | haft rozet (tylko u rodu) |
| Bractwo Wagi | butelkowa zieleń `#344A40` | blaszka-waga z mosiądzu `#B89A50` | sygnet |
| Strażnicy (Chór Głębi) | popiel `#7A7A76` | biel soli `#E6E2D8` (kołnierz) | haft pierścieni fal |
| Korzenni | mech `#4E5636` | bursztyn `#E0A030` | korzenie we włosach |
| Gnomy (Konwent) | patyna `#3E6A62` | fiolet płynu `#B070F0` w bańce | gogle, rurki |
| Popielni | popiół `#5E5A58`, skóra `#8A8682` | oczy-żar `#FF7A2A` | blizny |

### 4.4 Barwy zastrzeżone
`#E8542A` — alarm, zawał, wróg (świat i UI); turkus `#6FF0FF` i bioluminescencja `#45E6C0` — magia, runy, grzybnia;
czerń „siniaka” — tylko Raróg; biel L\* > 92 — rdzenie świateł, błyski, metal płynny.

### 4.5 Korekty palety materiałów (propozycja dla `src/render/palette.ts`)
Albedo z turnieju nr 2 zostaje **warstwą tożsamości**; „ciemniej” robi gradacja biomu w shaderze, nie przemalowywanie.
Poprawiam trzy miejsca, w których styl z kreską psuje odczyt. Reguły `tests/palette.test.ts` (ΔE ≥ 12, deut. ≥ 7, mur
≥ 10) przechodzą po korekcie (port `paletteCheck.ts`, Dodatek B).

| Materiał | Było | Proponuję | Uzasadnienie | Efekt (symulacja ekranowa ΔE / deut.) |
|---|---|---|---|---|
| `TIN` akcent (igły) | `#2A1A14` (L\* 11) | **`#4A2C1E`** (L\* 21, żywiczny brąz) | igły w wartości tuszu czytałyby się jako kreska, nocą znikały (najsłabsze ore_host turnieju nr 2: 5,3); +10 L\* nad tuszem; połysk `#D0A070` bez zmian | wapień–cyna 10,9 → 10,4 (średnia barwy bez zmian, zysk w odczycie znaku igieł) |
| `SHELL_LIMESTONE` a/b | `#D6C296` / `#EAD8AC` | **`#D2B884` / `#E6CF9C`** (C\* 24 → 29) | kolano świateł spłaszcza jasność, którą wapień muszlowy różnił się od wapienia; cieplejsza ochra przenosi różnicę na odcień | wapień–w. muszlowy 11,0 / 11,2 → ≥ 12 / ≥ 12 |
| `RUNESTONE` a/b | `#241C24` / `#342832` (L\* 15) | **`#34243A` / `#46304E`** (L\* 21, śliwka) | matryca leżała na podłodze wartości razem z prakamieniem | prakamień–runokamień deut. 6,5 → ≥ 7 |

**Słabe pary po gradacji (rozwiązują je znak formy, jasność i błysk; weryfikacja w nocnej galerii):** łupek ilasty–galena
10,8; łupek–węgiel 10,9; łupek ilasty–węgiel 11,4; wapień–cyna 10,4; miedź–cyna 11,8; glina–piasek (deut. 6,2);
siarka–żaryt (deut. 4,7 — żaryt świeci, siarka matowa). Kryterium: `galmetrics.py` nocą **nie gorzej niż zwycięzca
turnieju nr 2**. `tests/palette.test.ts` warto uzupełnić o warunek ΔL\* ≥ 10 dla par w mroku (wizja: „pary rozsuwa
jasność”) — propozycja dla engine-graphics/qa.
Odrzucone w analizie: ciemniejszy wapień, jaśniejszy łupek ilasty, ciemniejsze sześciany galeny — pogarszały inne pary
(łupek ilasty–galena 10,8 → 10,1; węgiel–galena → 10,5).

### 4.6 Światło
1. **Plamy ciepłe vs chłodny mrok** — podpis gry. Barwa lampy żyje tylko w plamie (rdzeń + halo); mrok = przygaszona
   barwa i chłód ambientu, kształt zostaje. Różnica odcienia lampa–ambient ≥ 120° (wyjątek: Pas Magmy).
2. **Malowana plama**: rdzeń 0,35 R (+16…+20 L\*), halo do R (+6), miękki brzeg — jak położona pędzlem. Turniej:
   ciągła vs 2 strefy vs 3 pasma.
3. **Źródła z naszego świata**: kaganki, pochodnie, kosze żarowe, latarnie olejne, Palenisko, kryształy; gnomie
   iskrowniki dopiero w ich technice. Żadnych żarówek na kablach.
4. Krawędź cięcia niesie kreska; światło na płaszczyźnie cięcia przy oświetlonej wnęce maks. +6 L\* w pasie 0,5 kafla;
   nie przebija > 2 kafli skały (E4). Poświata R2B i świecące powietrze — wyłączone.
5. **Migotanie**: pochodnia ±6% (3–7 Hz), kaganek i latarnia ±2%, kosz żarowy ±5%, Palenisko ±3% + iskry w górę,
   kryształy i runy — puls 0,3–0,6 Hz, Prakowale — puls w rytmie akordu.
6. **Bloom** tylko na emiterach (L\* ≥ 85), promień ≤ 0,6; kreska nad bloomem.
7. **Powierzchnia**: dzień — chłodno-neutralne niebo `#DCE6F0`, cienie fioletowo-szare; zmierzch — ochra i róż; noc —
   granat `#1E2A44`, ognisko przy wozie jako jedyna ciepła plama (kadr otwierający, wizja §4); szyb niesie dzień
   w głąb jako chłodną smugę.
8. **Światło jako stawka**: Królowa Nietoperzy gasi nieosłonięte lampy (rdzeń zapada się do halo w 0,6 s); Raróg
   kurczy plamy i zabiera kreskę; w finale gracz zasłania i odsłania lampy — plama musi mieć wyraźny stan „zasłonięta”
   (halo bez rdzenia).

### 4.7 Atmosfera
- **Nieznane** = gęste kreskowanie jak niezbadany skrawek mapy (tabela §0). **Zapowiedzi rysowane w kreskowaniu**,
  czytelne z bezpiecznego miejsca: woda za ścianą — linie kreskowania falują; ciepło — kreskowanie ociepla się
  (`#3A2418`); przeciąg — linie układają się w smugi; kości — drobne jasne znaki. Odkrycie „dorysowuje” świat:
  kreskowanie znika pociągnięciami w 0,3–0,5 s, a kontur W1 rysuje się wzdłuż nowej krawędzi.
- **Pył** w snopach lamp (1–2 px, rzadko), **para** z kotłów (W3 przerywany), **zarodniki** (żółte kropki).
- **Głębia w powietrzu**: plan tylny (z ≤ −0,6) −4 L\* i 10% w stronę ambientu.

---

## 5. Warianty, wskazówki dla produkcji i prompty referencyjne

### 5.1 Trzy kierunki eksploracji (runda 2 turnieju nr 3)
| Kierunek | Istota | Kreska | Faktura | Światło | Ryzyko |
|---|---|---|---|---|---|
| **A „Plan kopalni”** | rysunek mierniczego, mało koloru | W1 5 px, dużo Wd (warstwy) | ziarno σ 1,8, plamy σ 2 | 2 strefy | za chłodny; ink% > 6% |
| **B „Gwasz na planie”** *(faworyt)* | malowana makieta na rysunku mapy | W1 4 / W2 3 / W3 2 / Wd 1,25 | plamy σ 3 z kierunkiem pociągnięć, sucha krawędź | 2 strefy, miękki brzeg | edge% zależy od gęstości izb |
| **C „Makieta lakierowana”** | najbliżej R2B: AO i głębia, cieńsza kreska | W1 3 / W2 2 / W3 1,5 | σ 2 | ciągła | kreska < 3% |

### 5.2 Osie wariantów (≥ 10 wariantów w identycznych scenach)
1) W1 {3; 4; 5} px; 2) nierówność ±{10; 20; 30}%; 3) tusz stały vs per biom; 4) sucha krawędź {brak; 0,12/−7;
0,18/−10}; 5) plamy σ {2; 3; 4} z/bez kierunku; 6) plama światła {ciągła; 2 strefy; 3 pasma}; 7) gradacja biomu vs
ekspozycja R2B; 8) mrok zabiera kolor {×0,3; ×0,45; ×0,6}; 9) kreskowanie nieznanego {odstęp 0,12; 0,15; 0,2};
10) wariant z biblioteką zewnętrzną (np. post-proces krawędzi) — tylko jeśli wygra.
Ocena (CHARTER §4): **trzy sceny tonu** (izba wieczorem, przodek w mroku, zawał), cele per kontekst, noc w galerii
(§4.5), ms/klatkę, rubryka, **ślepy test oryginalności** w finale.

### 5.3 Uwagi produkcyjne
- **Kreska w px ekranu**: wagi stałe przy zmianie zoomu, skalowane tylko rozdzielczością; LOD per zoom (§0); tryb
  „mocna kreska” ×1,5.
- **Osobne elementy**: płomienie (billboard z szumem, linia żaru), plamy światła, błyski, para, części ruchome maszyn
  (miech, koło, tłok, wahadło, zawór) z osią obrotu — obrys liczony per siatka.
- **Postacie**: obrys W1 (odwrócona skorupa ~0,03 kafla albo krawędzie z bufora), Wd na granicach części; cieniowanie
  3 tonami (baza, cień −12 L\* ku ambientowi, światło +10 L\* ku lampie), miękka granica 0,08.
- **Grubości realne**: każdy element ≥ 0,04 kafla; widoczne łączenia (nity, wiązania, zręby, kliny).
- **Budżet**: kreska krawędzi skały w shaderze terenu (bez dodatkowego przebiegu); obrys rekwizytów jednym przebiegiem;
  post-proces krawędzi pełnoekranowy tylko po wygranym turnieju i w 60 FPS (M1).
- **Drżenie**: jeden uniform „groza 0–1” sterujący amplitudą przesunięcia kreski (krok 8 kl./s) — tylko w mroku,
  grozie, przed zawałem i w strefie Raroga.

### 5.4 Checklista akceptacji obiektu
- [ ] język form i kreska (§2.2); [ ] testy sylwetki, 3 wartości, deuteranopii (§2.4); [ ] pasma L\* i C\* (§0, §2.3);
- [ ] słownik znaczeń (§1.1) — nic nie pożycza drżenia, kreskowania, nasycenia ani ciemności; [ ] poziom budowli widać
  w materiale (§3.4); [ ] zużycie opowiada (§3.5); [ ] trzy sceny tonu; [ ] sekcja „czym różni się od referencji”;
- [ ] warianty do turnieju (≥ 10) opisane parametrami.

### 5.5 Prompt referencyjny (tablica nastroju — produkcja jest proceduralna)
> *„Living hand-drawn surveyor's map of a dwarven mining colony inside a mountain, 2.5D cross-section diorama, side view,
> thick slightly uneven warm umber ink outlines (4 px), flat muted gouache color fields with visible brush mottling,
> rock strata drawn like an old mine plan, unexplored rock covered in dense dark cross-hatching like an unsurveyed map,
> dug galleries recessed with darker low-contrast back walls, warm amber lamp pools where colors come alive, everything
> outside the light greyish and cool but still drawn, stocky dignified dwarves 3.4 heads tall with heavy trapezoid
> silhouettes, big hands and tools, miner helmets with small lamps and a colored plume, heavy timber props, clay bloomery
> glowing orange, stone hearth with copper hood, ore veins marked with small ink signs (dendrites, cubes, needles), overall
> darker than daylight illustration, no sci-fi, no screens, no light bulbs, no plastic, no text, original design”* —
> negatywnie: *„chibi, big heads, kilts, horned helmets, neon, glossy 3D render, pixel art, photo, UI, logos”*.

---

## Dodatek A — Czym różnimy się od referencji właściciela
| Obszar | Referencja (pomiar / obserwacja) | Underhearth |
|---|---|---|
| **Postacie** | okrągłe, duże głowy (~40% wzrostu), miękkie kształty, kombinezony | krępe trapezy, **3,4 głowy**, broda jako główny kształt, wielkie dłonie i narzędzia; rola z nakrycia głowy, stan z jednego akcentu; godność, bez chibi |
| **Maszyny** | retrofuturystyczne sprzęty: ekrany, panele, zaokrąglone obudowy, nasycone kolory | od gliny i drewna przez kamień i miedź do żelaza, pary i run; płomień zamiast żarówki; manometry tylko u gnomów; Prakowale — monolity bez śrub |
| **Tła** | płaska oliwkowo-turkusowa ściana z „kosmiczną” fakturą | tylna ściana z materiału skały, wgłębiona w 2.5D, ze śladami narzędzi, naciekami, grzybnią; niebo tylko na powierzchni |
| **Architektura** | modułowe pudełka, białe/kremowe płyty podłóg (L\* 86) | rzeźbione komory, łuki z klińcami, stemple, pomosty z desek; ornament tylko w miejscach znaczenia |
| **Paleta** | oliwka/khaki i turkus w średnich tonach, wiele nasyconych paneli | ciemniej (L\* 36–40 vs 43,5), skała przygaszona w mroku, kolor w plamach światła, nasycenie tylko jako informacja (≤ 8% C\* > 30) |
| **Mrok i nieznane** | brak ciemności, wszystko równo oświetlone | mrok zabiera kolor; nieznane = kreskowanie mapy mierniczego; zapowiedzi rysowane w kreskowaniu |
| **Kreska** | mediana 2 px, p90 5–6 px przy ~43 px/kafel, tusz `#231B10` | cięższa sylwetka W1 4 px, wagi według znaczenia w grze, tusz tonowany per biom, kreska koduje kulturę, drży tylko ze strachu, Raróg jej nie ma |
| **Kompozycja** | prostokątna siatka pomieszczeń | nieregularne wnęki, warstwy jak na planie kopalni, gród gęsty, dzika głębia rzadka i monumentalna |
| **Nastrój** | jasny, pogodny, „laboratoryjny” | przytulny trud w głodnej światła górze; groza przez odejmowanie |

Zakazy: okrągłogłowe postacie, ekrany, panele, białe kafle, płaska turkusowa tapeta, żarówki na kablach, ikony i UI
referencji, cepeliada, futhark i celtyckie plecionki. Finał każdego turnieju: ślepy test pomyłki (CHARTER §4).

## Dodatek B — Dowody i metoda
**Referencja** (`.reference/owner-style.jpg`, 1920×1080; `refstats.py` + analiza własna w scratchpadzie):
`refstats` (960 px): L\* 43,47 · czerń 11,65% · chroma 14,56 · krawędzie 28,99% · kreska 5,31%. Skala: odstęp pięter
173 px = 4 kafle → ~43 px/kafel. Kreska (przebiegi pikseli L\* < 22 między jaśniejszymi): mediana 2 px, p75 3, p90 5–6.
Tusz: średnio `#231B10` (L\* 11, a\* 1,6, b\* 7,8). Wartości: L\* < 10: 8,4% · 10–15: 5,0% · 40–60: 42,9% · > 80: 6,5%;
klastry: oliwkowe średnie tony L\* 44–54 (~44%), ciemne L\* 8–19 (~18%), krem L\* 86 (6%), złote akcenty L\* 65 C\* 36 (3%).
Faktura: σ L\* w płaskich oknach 8 px = 1,32 (ziarno); σ średnich komórek 8 px w oknach 32 px = 3,05 (plamy).

**Paleta** (port `meanColor`/ΔE/deuteranopii z `src/render/paletteCheck.ts`, 177 par w biomach): albedo przed i po
korektach — 0 naruszeń reguł testu; przyciemnienie samą ekspozycją (Progi ×0,35, Korzenie ×0,14) — 13 słabych par,
min ΔE 4,7 (łupek–węgiel) → stąd ekspozycja ≥ 0,6 i kolano; gradacja z §0 — 9 słabych par bez korekt, 7 z korektami,
min ΔE 10,1. Ograniczenie: średnia barwa nie widzi znaku formy ani błysku — rozstrzyga nocna galeria.

**Szacunek kadru grodu (Progi, wieczór)**: cięcie 45% × L\* 43–46, kreska 6% × 9, nieznane 8% × 16, tylna ściana
w mroku 8% × 31, w plamie 15% × 46, rekwizyty 12% × 48, postacie 3% × 48, światła 1% × 92, akcenty 2% × 65 →
**L\* śr. 40–41**; czerń ≈ 6% (kreska) + 8% (nieznane) + zakamarki ≈ 15–18%. Mieści się w celu przy cięciu ≤ 43.

## Dodatek C — Otwarte pytania do game-director
1. **Gradacja biomu** (Progi i Korzenie ×0,6, głębokie biomy rozjaśnione ×1,6–4,4) zamiast globalnej ekspozycji —
   rekomenduję: tak (inaczej skała w głębi jest czarna).
2. **„Stan” w wizji §3** czytam jako stan społeczny (kitka jak na czaku). Czy akcent ma też nieść stan zdrowia/nastroju?
   Rekomendacja: nie — to rola UI (znaki nad głową), żeby akcent nie zmieniał znaczenia.
3. **Obwódka czarnego płomienia** z `01-world.md` §7.4 („cienka purpurowo-czerwona”) kontra wizja „Raróg bez kreski”:
   proponuję miękki „siniak” bez linii — do potwierdzenia przez lead-narrative (F2-8).
4. Kierunek rundy 2: rekomenduję **B „Gwasz na planie”**, A i C jako kontrolę.
5. Trzy korekty palety (§4.5) wymagają edycji `src/render/palette.ts` przez engine-graphics i przejścia testów.
6. Barwy stanów i frakcji (§4.3) — do potwierdzenia przez lead-narrative-designer.
