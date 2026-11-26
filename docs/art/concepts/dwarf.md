# Karta konceptu: krasnolud-robotnik (+ jak odróżnić towarzyszy)

> concept-artist · v1 · 2026-11-26 · zgodna z `docs/art/ART-BIBLE.md` v1.1 i `docs/team/vision/VISION.md` §3.
> Odbiorcy: animator-ta (model i ruch, F3-1), artist-2d (ikony), ui-ux (znaki nad postaciami). Akceptuje: game-director.

## 1. Kierunek wizualny, funkcja i nastrój
- **Idea**: „kowadło z brodą” — krępy, nisko osadzony pracownik, którego ciężar i pewność ruchu mówią „to jest jego
  góra”. Godność ludzi pracy, zero chibi i zero gagów (wizja §3: bez kiltów, rogów, pijaka jako żartu).
- **Funkcja**: podstawowa jednostka symulacji (do 200 na mapie, M3). Gracz musi w 1 s odczytać **rolę** (nakrycie
  głowy + narzędzie), **stan społeczny** (jeden akcent barwy, jak kitka na górniczym czaku) i **czy jest w świetle**
  (krasnolud niesie własną małą plamę — lampkę). Twarz dopiero w zoomie Izba.
- **Słowa-klucze**: krępy trapez · broda-klin · wielkie dłonie i narzędzia · lampka na hełmie · tylnik (skórzany
  fartuch noszony z tyłu, jak u dawnych górników) · kitka · ciężki krok.

## 2. Sylwetka, proporcje i hierarchia czytelności
**Proporcje (kafel ≈ 1 m; px w Grodzie = 58 px/kafel, w nawiasie 40 px/kafel):**
| Część | Wymiar [kafle] | px Gród (40) | Prymityw 3D (start dla animator-ta) |
|---|---|---|---|
| wysokość całkowita z nakryciem | **1,30** | 75 (52) | — |
| głowa (podbródek–ciemię) = moduł | 0,36 → **3,4 głowy** bez nakrycia | 21 (14) | kula r 0,16 + nos kula r 0,055 + łuk brwi (prostopadłościan 0,2×0,05×0,08) |
| nakrycie głowy | +0,07 nad ciemię | 4 (3) | wg roli (tabela niżej) |
| broda (klin) | od podbródka (0,87) do 0,55; szer. u dołu 0,34 | 19 × 20 | wyciągnięty trapez 0,26→0,34 × 0,32, gł. 0,12, pochylony 8° w przód |
| barki | szer. **0,62** na wys. 0,84 | 36 (25) | spłaszczona elipsoida 0,62 × 0,22 × 0,34 |
| tułów („beczka”) | wys. 0,40, obwód max pod barkami | — | profil obrotowy r 0,29 (pierś) → 0,25 (brzuch) |
| pas | wys. 0,50, szer. 0,52 | — | walec r 0,27 h 0,06 + klamra 0,06 |
| ramię + dłoń | 0,42; **dłoń 0,13** (⅓ głowy — przerysowana) | 24 / 7,5 | kapsuła r 0,065 l 0,32 + kula/bryła 0,13 |
| nogi z butami | **0,30** (23% wzrostu); but 0,10 × 0,22 | 17 | walec r 0,075 h 0,20 + prostopadłościan 0,14×0,10×0,22 |
| rozstaw stóp | 0,58 | 34 | — |
| narzędzie (kilof) | trzonek **0,75**, głowica 0,36 | 43 / 21 | walec r 0,02 + prostopadłościan z klinami |

**Dominujący kształt**: kowadło — szerokie barki, broda-klin na piersi, pas, szeroka podstawa z butów. Linia barków
i broda tworzą odwrócony trójkąt w trójkącie: czyta się jako „krasnolud” nawet jako wypełniona tuszem plama 30 px.
**Punkty skupienia**: lampka (L\* 88–98) i twarz (58–68) nad ciemniejszym strojem; kitka stanu na nakryciu głowy.

**70/20/10 w postaci:** 70% — strój (tunika, fartuch, tylnik), L\* 30–48, C\* ≤ 26; 20% — broda, skóra, narzędzie,
kontrast do stroju **≥ 15 L\***; 10% — twarz, dłonie, lampka, kitka (jedyny akcent C\* > 30, ≤ 10% sylwetki).

**Role z sylwetki (Gród, ~75 px): nakrycie głowy + narzędzie + jeden element na plecach.**
| Rola | Nakrycie głowy (sylwetka) | Narzędzie / ładunek | Strój |
|---|---|---|---|
| hajer (górnik) | skórzany hełm-kopuła z daszkiem + **kaganek z przodu** | kilof (T), na plecach tylnik | ochra `#7E6446`, skóra `#5E4432` |
| cieśla / budowniczy | kaptur ze **szpicem odrzuconym do tyłu** | topór ciesielski; belka na ramieniu | kamizela z kieszeniami na kliny |
| kamieniarz | chusta zawiązana, **dwa rożki węzła** | młot i dłuto, kliny za pasem | jasny pył na stroju (+8 L\* od dołu) |
| hutnik / kowal | czapa z **osłoną karku** + okular miki na czole | szczypce + młot; długi fartuch z przodu do kolan | sadza na rękawach |
| tragarz | opaska, bez hełmu | **nosidło** (rama 0,5 × 0,7 nad barki) z koszem | krótki kubrak |
| kucharz / piwowar / rolnik | miękki **kołpak** (półkula opadająca na bok) | warząchew / sierp / cebrzyk | lniany fartuch `#8A8270` |
| wartownik | **hełm stożkowy z nosalem** | włócznia (1,4 kafla — przekracza sylwetkę) + tarcza | przeszywanica |
| uczony (Sala Wiedzy) | gołowy, **okulary** | zwój map pod pachą, pióro za uchem | długi kaftan |
| pompiarz (Korzenie) | kapelusz o **szerokim rondzie** (przeciw kapaniu) | korba / klucz | ceratowa peleryna |

**Sprzęt środowiskowy zastępuje nakrycie głowy** (i staje się sylwetką roli w danym biomie): maska z filtrem
(Groty — „pysk” z okrągłym filtrem), hełm nurka (Zatopione — wielka kula z okienkiem), futrzany kaptur (Kryształowe),
kaptur żaroodporny z wizjerem z miki (Magma). Rola przechodzi wtedy na narzędzie i element na plecach.

**Stan społeczny — jeden akcent (kitka / wstęga / blaszka)** wg biblii §4.3: hajer — kitka ochrowa `#C8902E`;
mistrz cechu — biała `#E6E0D2`; Korona — karmazynowa `#A8303A`; Waga — mosiężna blaszka-waga; Strażnik — biały
kołnierz; **zastawny — brak barwy**: szara blaszka długu na sznurku i łuczywo zamiast lampki.

**Towarzysze — jak odróżnić od tłumu (zawsze w Grodzie):** każdy ma **jeden unikalny wyłom sylwetki** (element
wystający poza obrys zwykłego krasnoluda), **barwę frakcji** jako akcent i **własną wysokość**; nigdy nie dostaje
ozdobników, które gubią rolę.
| Towarzysz | Wys. [kafle] | Wyłom sylwetki | Akcent / wartości | Uwagi |
|---|---|---|---|---|
| Dzierżko Tarczownik | 1,30, **przygarbiony** (−8°) | prostokątna tarcza 0,5 × 0,7 z wypaloną „8” na plecach; kilof przypięty jak broń | szare płótno zastawnego + rdza „8” `#8A4A2A`; bez kitki (stan!) | najszerszy w barkach (0,70) |
| Wilga z Kręgu Korzeni | 1,55, smukła | **kij z porożem** 1,7 kafla (rozwidlenie nad głową), warkocze z korzeniami | mech `#4E5636` + bursztyn `#E0A030`; bosa (jasne stopy) | jedyna bosa sylwetka |
| Świętosława Gostomirówna | 1,35, prosta | **płaszcz do ziemi** (trójkąt), srebrny diadem (błysk), sztylet | wiśnia `#6A3436` + srebro; haft rozet | najprostsza postawa w grodzie |
| Ludmir Kruszec | 1,30 | **laska z ołowianą gałką** + długi płaszcz z kieszeniami na wagi, okulary | butelkowa zieleń `#344A40` + mosiądz | lekko odchylony w tył (pewność) |
| Bolko Ćwik | **1,20, wąski** (barki 0,50) | torba na dokumenty na ukos, czapka zsunięta na bakier | połatana szarość + **szal czerwony** (jedyny w grodzie) | najszybszy chód |
| Mirosz zwany Kaligrafem | 1,35, **masywny** (barki 0,74) | **dwa toporki** „Pióro” i „Kałamarz” skrzyżowane na plecach | spłowiała szara szata Chóru z oderwanym naszyciem + plamy atramentu `#2A3A6A` | łagodna, zaokrąglona bryła |
| Iskra Zębatka (gnom) | 0,95 | **gogle z pięcioma soczewkami** (kółka nad czołem), plecak z rurkami | patyna `#3E6A62` + fioletowy płyn w bańce | dłonie w grubych rękawicach |
| Drahomira z Chóru Głębi | 1,45, kolumna | **długa szata** (pion), kamertony przy pasie, krótkie włosy | popiel + biel soli; haft pierścieni fal | jedyna „kolumna” — bez trapezu |
| Żarko z Popielnych | 1,40 | **nagi tors w bliznach** (duża jasna plama skóry L\* 56), młot z obsydianowym obuchem | popiół + **oczy-żar** `#FF7A2A` (2 punkty) | jedyne świecące oczy w drużynie |

Na zoomie Okolica towarzysz to: wyłom sylwetki + akcent frakcji (tusz bez detalu). W UI nazwa tylko na żądanie.

## 3. Materiały, konstrukcja i detale funkcjonalne (callouts)
| Element | Materiał / HEX | Konstrukcja i łączenie | Funkcja / zużycie |
|---|---|---|---|
| hełm hajera | utwardzana skóra `#4A3626`, okucie żelazne | kopuła + daszek + **kaganek** (prostopadłościan 0,07, emisja L\* 92) na blaszce | lampka = własna plama R ≈ 2 kafle; okopcony od góry |
| broda | 5 barw: ruda `#9A5A30`, kasztan `#5A3A26`, czarna `#2E2620`, siwa `#B8B2A6`, płowa `#A08458` | klin + 2–3 warkocze z koralikami (znaki cechu: 1 warkocz hajer, 2 rzemieślnik, rozwidlony Strażnik) | wtórny ruch (2 kości); warkocze widoczne od zoomu Gród |
| twarz i dłonie | `#C89474` / cień `#9A6A54` (warianty skóry ±8 L\*) | nos wydatny, brwi jako daszek | dłonie przerysowane — czytelny chwyt |
| tunika / kubrak | len, wełna (barwy stanu, C\* ≤ 26) | łaty innego odcienia, szwy Wd | plamy potu i sadzy |
| tylnik | skóra `#5E4432` | trapez 0,30 × 0,34 z tyłu na pasie | chroni przy siadaniu w przodku; strefa deformacji (2 kości) |
| pas | skóra + klamra mosiężna | kieszenie, kliny, krzesiwo | miejsce na mały przedmiot (wskaźnik ekwipunku) |
| buty | skóra `#3E2A1E`, podbite żelazem | duży nosek | ślady w pyle (opcjonalnie) |
| narzędzia | trzonek dąb `#7A5634`, głowica żelazo `#4A4644` z jasną krawędzią ostrza (+20 L\*) | klin w oku głowicy (Wd) | zużycie: wytarte trzonki jaśniejsze |

**Sloty ekwipunku widoczne na modelu** (dane przedmiotów: head / body / back / trinket): każdy slot to osobny
podmesh na stałym punkcie mocowania (głowa, tułów, plecy, pas) — modularność pod ~90 przedmiotów.
**Tragedia przez odejmowanie**: ranny — strój traci barwę (C\* ×0,5) i lampka przygasa; zmarły — nie pokazujemy
ciała; zostaje zgaszona lampka i hełm przy Ścianie Szychty.

## 4. Paleta barwna, światło i atmosfera
- **Wartości**: strój 30–48, broda kontrastuje (jasna broda na ciemnym stroju albo ciemna na jasnym — losowanie
  wymusza ΔL\* ≥ 15), twarz 58–68, lampka 88–98. Na tylnej ścianie w plamie (L\* 44–46) postać czyta się jako ciemna
  bryła z jasnym punktem — także przy deuteranopii.
- **Światło**: krasnolud niesie małą ciepłą plamę (`#FFD890`, R ≈ 2 kafle, migotanie ±2%); w mroku jego barwy gasną
  jak wszystko (C\* ×0,45), **lampka i W1 zostają** — w „przodku w mroku” widać kontur i światełko.
- **Akcent stanu** jest jedynym nasyconym kolorem na postaci (informacja), mieści się w budżecie ≤ 8% C\* > 30.
- **Trzy sceny tonu**: *izba wieczorem* — pełne barwy, twarze w świetle Paleniska, kitki widoczne; *przodek w mroku*
  — szara sylwetka z W1 i lampką, kreska drży przy grozie; *zawał* — pył (jasne cząstki w snopie lampki), barwy
  znikają, postacie uciekają ciężko (bez komizmu).

## 5. Warianty, wskazówki dla 3D / animacji i prompty referencyjne
**Kierunki eksploracji (do turnieju F3-1, ≥ 10 wariantów w identycznych scenach):**
1. **A „Kowadło”** *(faworyt)* — 3,4 głowy, barki 0,62, nogi 23%: ciężko, stabilnie.
2. **B „Beczka”** — 3,2 głowy, tułów okrąglejszy (r 0,31), krótsza broda: przytulniej, ryzyko „słodkości”.
3. **C „Słup”** — 3,6 głowy, 1,40 kafla, barki 0,58: bardziej heroicznie, ryzyko utraty „krasnoludzkości”.
Osie siatki: głowa {3,2; 3,4; 3,6} × barki {0,56; 0,62; 0,68} × broda {krótka 0,24; 0,32; długa 0,40} + 2 warianty
nakryć głowy na rolę; ocena: rozpoznanie roli z sylwetki na Gród i Okolica (test z 9 ról), ms na 200 postaci.

**Uwagi produkcyjne:**
- Osobne elementy: nakrycie głowy, broda (+warkocze), tylnik/fartuch, narzędzie w dłoni, ładunek na plecach, kaganek
  (emiter). Strefy deformacji: broda (2 kości), tylnik i fartuch (2), warkocze (1 każdy), kaganek (wahadło).
- Ruch **ciężki i pewny**: chód 2 kroki / 0,9 s, kołysanie 0,02 kafla; kopanie: zamach 0,35 s → przytrzymanie 0,08 s
  → uderzenie 0,15 s (klatka uderzenia z pyłem); dźwiganie — pochylenie 8°; wspinaczka po drabinie — broda odchyla się.
- LOD: Izba — pełny (~1200 tr.); Gród — ≤ 400 tr., warkocze scalone; Okolica — ≤ 60 tr. + sprite lampki (żeton:
  nakrycie głowy + lampka). Kreska: W1 zawsze, Wd tylko Izba/Gród.
- Kolor stroju z instancji (atrybut), nakrycie głowy i narzędzie z puli meshy — 200 postaci w kilku draw callach.

**Czym różni się od referencji:** tam okrągłe postacie z wielką głową (~40% wzrostu) i kombinezonami; u nas krępe
trapezy 3,4 głowy z brodą-klinem jako głównym kształtem, wielkie dłonie i narzędzia, rola z nakrycia głowy (tradycja
górnicza: kaganek, tylnik, czako z kitą), stan z jednego akcentu, strój z lnu, wełny i skóry; żadnych kombinezonów,
hełmów-misek z tworzywa ani wesołych min jako stałej ekspresji.

**Prompt referencyjny** (tablica nastroju; produkcja proceduralna):
> *„Character turnaround sheet of a stocky dignified dwarf miner, 3.4 heads tall, anvil-shaped silhouette with broad
> shoulders and a wedge beard with two braided cords and beads, oversized hands, short legs with big hobnailed boots,
> hardened leather dome helmet with a small oil lamp in front and a short ochre plume, leather apron worn at the back,
> pick-axe with a long oak handle, muted ochre wool and dark leather, hand-inked thick warm umber outlines, flat gouache
> colors with brush mottling, side view and three-quarter view, value study in 3 tones, plus nine silhouette variants
> for different jobs (carpenter with pointed hood, stonecutter with knotted kerchief, smelter with neck-flap cap,
> porter with pack frame, cook with soft cap, guard with conical nasal helmet, scholar with spectacles, pump-man with
> wide-brim hat), no chibi, no horns, no kilt, original design”*.
