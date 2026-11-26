# Karta konceptu: huta (Dymarka → Wielki piec → Kuźnia magmowa)

> concept-artist · v1 · 2026-11-26 · zgodna z `docs/art/ART-BIBLE.md` v1.1. Dane: `src/content/buildings.ts` `smelter` —
> 2×2 / 3×3 / 4×3 kafli, pracownicy 1/2/2, speed 1 / 1,6 / 2,4, energia 0 / 2 / 6. Samouczek krok 6 („Piec i huta”),
> Akt I: żużel huty truje strumień Korzennych (rekrutacja Wilgi: osadnik). Odbiorcy: engine-graphics, vfx, level design.

## 1. Kierunek wizualny, funkcja i nastrój
- **Idea**: „ruda to obietnica, sztaba to dotrzymana obietnica” (Gostomir). Huta pokazuje przemianę: ciemny urobek
  wchodzi górą, jasny metal wypływa dołem, żużel i dym zostają jako koszt. Ciężka praca przy ogniu.
- **Postęp w materiale**: poz. 1 **glina, skóra, drewno, płótno** (dymarka z miechami nożnymi) → poz. 2 **kamień, cegła,
  brąz/miedź** (wielki piec z miechem na wale od koła wodnego, energia 2) → poz. 3 **żelazo, para, runy + obsydian**
  (kuźnia magmowa przy kanale lawy, energia 6). Bez ornamentu (budowla codzienna) — tylko konstrukcja.
- **Słowa-klucze**: szyb pieca · miech · spust · rynna z piaskiem · wlewnice · żużel · osadnik · sadza.

## 2. Sylwetka, proporcje i hierarchia czytelności
| Poziom | Rozmiar | Sylwetka (Okolica) | Wys. [kafle] | Punkt skupienia | Ruch |
|---|---|---|---|---|---|
| 1. Dymarka | 2×2 | **butelka/stożek ścięty**: Ø 1,0 u podstawy → 0,45 u góry; obok 2 worki miechów; stos węgla drzewnego | 1,7 | otwór dyszy u podstawy (żar L\* 85–92) + iskry z gardzieli | miechy deptane 1,0 s/cykl |
| 2. Wielki piec | 3×3 | **czworoboczny trapez** 2,0 → 1,2 szer., obręcze; na górze pomost zasypowy z drabiną; z boku skrzynia miecha z wałem | 2,8 | spust: strumień metalu rynną do wlewnic | miech 1,2 s/cykl, wał krzywkowy, wózek urobku na pomoście |
| 3. Kuźnia magmowa | 4×3 | **niska misa-tygiel** na nogach (Ø 2,0) + **żelazny żuraw** z kadzią + pionowe ekrany żaroodporne | 3,0 | kanał lawy wpadający do tygla + kadź wylewająca | żuraw obraca się, para z chłodnic co 3 s |

- **70/20/10**: 70% — glina / cegła / obsydian i sadza (L\* 26–50); 20% — miech, pomost, żuraw, wlewnice (30–55);
  10% — żar, metal płynny, iskry, kanał lawy (85–98) i chłodne światło rdzeni mrozu w poz. 3 (informacja).
- **Kreska**: W2 obrys pieca, W3 miech, pomost, wózki, wlewnice; Wd spoiny i obręcze; kontur żaru `#6A2A0E` wokół
  otworów i strumienia metalu.

## 3. Materiały, konstrukcja i detale funkcjonalne (callouts)
| Poz. | Element | Materiał / HEX | Konstrukcja | Funkcja / zużycie |
|---|---|---|---|---|
| 1 | szyb dymarki | glina `#9A6A48`, przepalona `#6A3A28` u dołu | profil obrotowy, spękania Wd | po wytopie rozbijana u dołu (łata gliny jaśniejsza) |
| 1 | miechy | skóra `#6A4630`, deski | 2 worki 0,4 × 0,3 + rura do dyszy | strefa deformacji (ściskanie) |
| 1 | okap dymu | płótno `#8A8270` na tyczkach | daszek kierujący dym do szczeliny | okopcony (−15 L\* u góry) |
| 1 | dół żużlowy, kosz rudy | żużel `#4A3A30` z pęknięciami `#C8502A` | — | zielona ruda miedzi w koszu = informacja |
| 2 | stos pieca | cegła `#8E4C32`, kamień, **obręcze brązowe** `#9A7040` | trapez, 3 obręcze, otwór spustowy z łukiem | sadza smugami w górę |
| 2 | pomost zasypowy | dąb, drabina | pomost 1,5 × 0,25 na zastrzałach | wózek z urobkiem i koszem węgla |
| 2 | miech wałowy | skóra + skrzynia dębowa, wał żelazny | wał wchodzi z boku (od koła wodnego) | energia 2 — widoczny ruch = działa |
| 2 | rynna i wlewnice | piasek `#B8A070`, żelazo | rynna 1,2 kafla, 4 wlewnice | strumień metalu (rdzeń `#FFE6A0`), stygnące sztaby `#FF8A3A` → `#7A4A30` w 4 s |
| 2 | **osadnik żużla** (moduł opcjonalny) | kamień, deski | kadź 1,0 × 0,5 obok spustu żużla | z osadnikiem woda strumienia czysta (`#2E6E86`), bez — rdzawa (`#7A5A30`): skutek decyzji widoczny w świecie |
| 3 | tygiel | obsydian `#2A2236` z muszlowym przełamem, wnętrze żar | misa Ø 2,0 na 4 nogach ze stali kobaltowej | kanał lawy `#FF5A1A` z płytami skorupy |
| 3 | żuraw i kadź | stal kobaltowa `#4A4644`, nity co 0,2 | ramię 2,2 kafla na obrotnicy | wylewa do form (adamant: jasnozielony połysk `#A0FFE0`) |
| 3 | ekrany i chłodnice | żelazo + **rdzenie mrozu** `#7AE4FF` | 3 płyty 0,6 × 2,0, runy chłodu (linia światła) | w Pasie Magmy chłód = bezpieczeństwo: plama chłodnicy przy stanowisku pracy |

## 4. Paleta barwna, światło i atmosfera
- **Temperatura metalu**: biało-żółty `#FFE6A0` (płynny) → pomarańcz `#FF8A3A` → ciemna czerwień `#9A3A22` → stygnący
  `#7A4A30`; nigdy alarmowy `#E8542A` (zastrzeżony).
- **Światło**: poz. 1 R = 4, ±6% (oddech miechów); poz. 2 R = 6, rytm miecha 1,2 s; poz. 3 R = 7 ciepłe + 2 chłodne
  plamy chłodnic (R = 2, `#7AE4FF`). Dym i para: `#6A645C` / `#D8D4CC`, kontur W3 przerywany.
- **Trzy sceny tonu**: *izba wieczorem* — rytm miecha i błysk spustu ożywiają warsztat; *przodek w mroku* — dymarka
  jako jedyne ciepło w ciemnym wyrobisku; *zawał* — piec gaśnie (plama zapada się do halo w 2 s), metal w rynnie stygnie.

## 5. Warianty, wskazówki produkcyjne i prompty
**Kierunki (≥ 10 wariantów do turnieju; scena: warsztat wieczorem + przodek w mroku):**
poz. 1: A butelka z gliny *(faworyt)* / B niski piec w zboczu (kopuła) / C para bliźniaczych szybów;
poz. 2: A czworoboczny trapez z obręczami *(faworyt)* / B okrągła wieża z obręczami żelaznymi / C piec wpisany w skałę
(tylko lico i spust widoczne); poz. 3: A tygiel z żurawiem *(faworyt)* / B tygiel w ziemi z mostem kadziowym /
C pionowy reaktor z obsydianu z rurami pary.

**Produkcja**: osobne siatki — miechy (skalowanie w osi), wał i krzywki (obrót), wózek, żuraw (obrót), kadź (pochył),
strumień metalu (wstęga z emisją, osobny materiał), wlewnice (emisja zanika w 4 s). Emitery w polu światła: otwór
pieca, spust, tygiel. Cząstki: iskry z gardzieli, dym, para (vfx). Osadnik jako moduł przyłączany obok spustu żużla.

**Czym różni się od referencji**: tam maszyny to zamknięte obudowy z panelami i kontrolkami; u nas otwarty proces
widoczny jak na ilustracji z dawnej huty: szyb, miech, spust, rynna, żużel, dym i jego skutek w strumieniu; glina,
cegła, brąz i obsydian zamiast blach; żadnych ekranów, kontrolek ani żarówek.

**Prompt referencyjny**: *„Three upgrade stages of a dwarven smelter in a 2.5D mine cross-section, side view, hand-inked
warm umber outlines, muted gouache: 1) bottle-shaped clay bloomery 1.7 m tall with two leather foot bellows, charcoal
heap, ore basket with green copper ore, canvas smoke hood, glowing tuyere; 2) square tapering brick blast furnace with
bronze hoops, timber charging platform with ladder and ore cart, cam-shaft driven bellows box, tapping hole pouring
white-yellow molten metal along a sand channel into ingot molds, slag settling tank; 3) low obsidian crucible on steel
legs fed by a lava channel, riveted iron crane with ladle, heat shields with frost-blue coolers; soot, sparks, smoke,
warm light in cool dark rock, no panels, no screens, no light bulbs, original design”*.
