# 05 — Projekt poziomów i systemów: góra, ścieżka w dół, ekonomia ryzyka

> Rola: Senior Level & Systems Designer. Jednostka: **kafel** (1 kafel ≈ 1 m w świecie gry; krasnolud ma ok. 1,3
> kafla wzrostu). Liczby są celami dla generatora świata (faza B1) i mają zostać zakodowane jako dane oraz
> sprawdzone metrykami generatora (dostępność złóż, łączność, gęstości). Nazwy biomów, złóż, budowli i przedmiotów
> są identyczne z danymi w `src/content/`.

## 1. Makrostruktura i topografia

### 1.1 Kształt świata
- **Przekrój pionowy** 224 × 720 kafli: 40 kafli nad równiną (góra), 680 kafli w głąb (9 biomów).
- **Góra Kuźnica** to stożek o podstawie 150 kafli, wierzchołek przy x = 150 (prawa część przekroju), 40 kafli
  nad równiną. Lewa strona to **równina Nadrzecza**: łąka startowa (x 0–60), pas boru sosnowo-brzozowego
  (x 60–100), potem zbocze.
- **Gardziel** — pionowa rozpadlina Prakowali od krateru na szczycie (x ≈ 150) do Serca (y = 640–680).
  Szerokość 6–10 kafli; ściany z kamienia Prakowali (nieprzebijalnego, poziom kilofa 9) z wąskimi oknami
  na każdy biom. Na dnie pulsuje czerwone światło (jasność = miernik Przebudzenia).
- **Pieczęcie Gardzieli** (twarde bramy skrótu): **Pierwsza** (y ≈ 150, granit), **Wodna** (y ≈ 300, wejście
  do Zatopionych Głębi), **Ognia** = Brama Popiołu (y ≈ 470, Pas Magmy), **Brama Serca** (y ≈ 640).
- **Układ: kaskada pionowa z osią centralną** (nie koncentryczny). Każdy biom to poziomy pas z **hubem po jednej
  stronie Gardzieli** i **źródłem klucza po drugiej**. Gracz schodzi zygzakiem: zachód → Gardziel → wschód →
  Gardziel → zachód… Pieczęcie zamykają szybką drogę osią, więc pierwsze zejście do biomu zawsze prowadzi
  przez jego skrzydło (zagrożenia), a otwarta pieczęć zamienia Gardziel w autostradę windy (nagroda logistyczna).

### 1.2 Biomy — topografia konkretna
| # | Biom (głębokość) | Ukształtowanie | Bariery naturalne | Hub (strona) | Źródło klucza (strona) |
|---|---|---|---|---|---|
| 0 | Podgórze (0–20) | łąka 60 kafli, bór 40 kafli, zbocze 25–35° | strumień 4 kafle szeroki z wodospadem 12 kafli; nocą wilki | obóz przy wozie (zachód) | Leże Wilczego Herszta w wąwozie pod zboczem (wschód) |
| 1 | Wapienne Progi (20–100) | 5 „progów”: poziome płyty wapienia po 12–18 kafli grubości, połączone kominami krasowymi | **ponor**: strumień z łąki znika w lejku i płynie kanałem krasowym na y 40–60; szerokie sale bez podpór się zawalają | Sala Pierwszego Progu (zachód, y 30) | Grota Królowej Nietoperzy (wschód, y 70–95), Komin Popiołu (y 30–70) |
| 2 | Granitowe Korzenie (100–190) | lity granit z pionowymi szczelinami co 15–25 kafli; Sala Tronowa 40×14 kafli | szczeliny pełne wody pod ciśnieniem (przebicie = zalanie 200 kafli w 30 s); twarda skała (kilof 2) | Sala Tronowa (wschód, y 120) | Gniazdo Matki Pełzaczy w zalanej szczelinie przy Pierwszej Pieczęci (zachód, y 150–170) |
| 3 | Grzybowe Groty (190–280) | 3 olbrzymie groty (60×30 kafli) z lasem grzybów do 18 kafli wysokości; kominy z pajęczyną | kieszenie zarodników; przepaście między grotami do 20 kafli (mosty linowe) | Wielka Grota (zachód) | Leże Królowej Pajęczyn w kominie (wschód, y 240–275); Serce Grzybni |
| 4 | Zatopione Głębie (280–370) | podziemne morze 120 × 40 kafli, wyspy, czarne kawerny | głęboka woda (bez hełmu nurka: 20 s oddechu), prądy | przystań na wyspie zachodniej | Zatopione Archiwum (dno, środek), Lewiatan |
| 5 | Kryształowe Głębie (370–460) | geody wielkości katedr (średnica 30–45 kafli), lodowe komory | mróz (wychłodzenie bez ogrzewania w 90 s), mrok | Geoda Katedralna (wschód) | Stacja pomp Prakowali i Kryształowy Kolos (zachód) |
| 6 | Pas Magmy (460–550) | rzeki lawy co 30–40 kafli, tunele lawowe, kopuła Popielnych (zastygła lawa, 50 kafli) | żar, wylewy lawy, opary siarki | Kopuła Popielnych (zachód) | Brama Popiołu (środek, Gardziel), Robak Magmowy (wschód) |
| 7 | Prastare Głębiny (550–640) | geometryczne sale Prakowali (sześciokąty 12–24 kafle), wieże Słupów Akordów | groza, konstrukty, zamki śpiewane | Archiwum Ruin (wschód) | Odźwierny przy Bramie Serca (środek) |
| 8 | Serce Góry (640–680) | kulista komora 40 kafli, Kowadło Serca | wszystko naraz | — | Raróg |

### 1.3 Układ wody (logika fizyczna, która prowadzi gracza w dół)
Śnieżnik na szczycie → strumień po zboczu → **ponor** na łące (zjawisko krasowe: woda znika) → kanał krasowy
w Wapiennych Progach → szczeliny granitu pod ciśnieniem (zalania) → **podziemne morze** (Zatopione Głębie) →
kontakt z Pasem Magmy = **kominy pary** (zagrożenie i źródło energii dla maszyny parowej). Woda zawsze płynie
tam, dokąd gracz ma iść: kto idzie za wodą, znajduje drogę w dół.

### 1.4 Główny punkt orientacyjny i prowadzenie wzroku
**Główny landmark: Gardziel z czerwonym pulsem.** Na mapie przekroju to jedyna pionowa linia światła widoczna
przez całą wysokość góry. Nocą na łące widać nad kraterem łunę i parę — pierwsze ujęcie gry kończy się na niej.

Linie prowadzące (leading lines):
1. **Puls Gardzieli**: czerwone światło wnika przez okna pieczęci w każdy biom — z każdego huba widać kierunek osi.
2. **Upad warstw**: warstwy skał opadają o 5–10° ku Gardzieli (geologia generatora), a żyły rud biegną wzdłuż
   warstw — wzrok i kopanie naturalnie „spływają” ku środkowi.
3. **Słupy Akordów**: pary bladoniebieskich słupów co 40 kafli w ścianach Gardzieli; zaśpiewane rozbłyskują
   w górę i w dół jak światła pasa startowego.
4. **Stare tory i schody królestwa**: rdzawe szyny i wykute stopnie biegną wzdłuż progów w stronę Gardzieli
   (odkrywane jako ruiny do odbudowy — tańsza infrastruktura po odnowieniu).
5. **Woda**: wodospady i strumienie (§1.3) prowadzą do następnego zejścia.
6. **Życie**: o zmierzchu z jaskiń krasowych wylatują nietoperze (pokazują wejścia), z pęknięć granitu widać
   turkusową poświatę grzybni z biomu niżej (zapowiedź).
7. **Kontrast światła** (styl R2B): ciemna lita skała i jasne wnętrza — każda nieodkryta pustka zarysowana
   delikatną poświatą krawędzi kusi do kopania.

## 2. Ekonomia zasobów i pętla rozgrywki

### 2.1 Strefa zagrożenia → unikalny zasób → wymóg → co odblokowuje
| Strefa zagrożenia | Unikalny zasób | Narzędzie / wymóg | Odblokowuje w grodzie / ekwipunku |
|---|---|---|---|
| Leże Wilczego Herszta (Podgórze, noc) | Futro Wilczego Herszta | drzwi, warta, włócznia myśliwska | badanie Kamienne Palenisko (limit ludności 24) |
| Grota Królowej Nietoperzy (Progi, mrok) | Serce Królowej Nietoperzy, guano, saletra | osłonięte lampy (kaganek), kusza drewniana | Wielki piec (brąz → żelazo), proch górniczy |
| Szczeliny pod ciśnieniem (Granit, zalania) | żyła-matka żelaza, galena, sfaleryt | kilof brązowy, stacja pomp, gródź | stal, mosiądz, kolej i wagoniki |
| Gniazdo Matki Pełzaczy (zalana szczelina) | Pancerz Matki Pełzaczy, chityna, kwas | stal, antidotum | Grzybnie (uprawa grzybów — żywność bez powierzchni), kamizela chitynowa |
| Kieszenie zarodników (Groty) | Jedwab Królowej Pajęczyn, jedwab pajęczy, świecące zarodniki | maska z filtrem, szyb wentylacyjny | Uszczelnienia (pompy parowe, hełm nurka), lampa zarodnikowa |
| Zatopione Archiwum (Głębie, woda) | Łuska Lewiatana, perły, nikiel, Wielki Krążek | hełm nurka, strój ze skóry węgorza, winda parowa | Szlif klejnotów, stal niklowa, zakończenie „Kołysanka” |
| Komory lodowe (Kryształowe, mróz) | Rdzeń Kolosa, mroźny kryształ, kobalt, szafir | kocioł grzewczy, ocieplany kubrak, kilof stalowy | Kuźnia magmowa, chłodnice (finał!), kilof kobaltowy |
| Rzeki lawy (Pas Magmy, żar) | Serce Robaka Magmowego, żaryt, obsydian, rubin | chłodnica, pancerz z rdzeniem mrozu, kilof kobaltowy | Esencja eteryczna, mur obsydianowy, grodzie obsydianowe (finał!) |
| Sale konstruktów (Prastare, groza) | Pieczęć Strażnika, lśnit, adamantyt, runokamień, Krążki Prakowali | płaszcz run, kamień ochronny, lampa lśnitu, śpiewak | Klucz Serca, kilof adamantowy, runiczny młot |

### 2.2 Zasoby powszechne vs strategiczne (cele gęstości dla generatora)
Gęstość podana jako **kafle złoża na 1000 kafli litej skały biomu** (‰) i typowy rozmiar żyły. Żyła-matka
= rzadkie skupisko 3–5× większe od typowego, zawsze w strefie zagrożenia (§3).

**Powszechne** (budowa i przetrwanie — dostępne wszędzie, „nie myśl o nich za długo”):
| Zasób | Źródło | Gęstość / dostępność |
|---|---|---|
| kamień | każda skała macierzysta | 70–85% kafli każdego biomu |
| drewno | sosny i brzozy Podgórza (odrastają), drewno grzybowe w Grotach | 1 drzewo na 4–6 kafli boru; olbrzymi grzyb co 10–15 kafli groty |
| glina, piasek | złoża w Podgórzu, Progach, Głębiach | 25–40 ‰, płaty 15–40 kafli |
| wapień | ławice w Progach (wapień muszlowy) | 20 ‰, ławice 20–60 kafli wzdłuż warstw |
| węgiel | pokłady w Progach, Granicie, Grotach | 30 ‰, pokłady 1–3 kafle grubości × 15–40 długości |
| woda | strumień, kanał krasowy, morze | zawsze w zasięgu pompy z huba biomu |

**Strategiczne** (wyznaczają tempo progresji — gracz planuje wyprawy):
| Zasób | Biomy | Gęstość typowa | Żyła typowa | Żyły-matki na świat |
|---|---|---|---|---|
| ruda miedzi | Podgórze, Progi, Granit | 12 ‰ | 8–20 kafli | 3 |
| ruda cyny | Progi | 5 ‰ | 6–12 | 2 |
| saletra | Progi (groty nietoperzy) | 4 ‰ | naloty 4–10 | 1 |
| ruda żelaza | Granit, Groty, Głębie | 10 ‰ | 10–25 | 3 |
| galena, sfaleryt | Granit | 4 ‰ każda | 6–14 | 1 każdej |
| kwarc | Granit, Kryształowe | 5 ‰ | żyły 1 kafel × 10–30 | 2 |
| ruda srebra | Groty, Głębie, Kryształowe | 4 ‰ | 5–12 | 2 |
| siarka | Groty, Magma | 3 ‰ przy wyziewach | 3–8 | 1 |
| sól kamienna | Głębie | 8 ‰ | pokłady 20–50 | 1 |
| ruda niklu | Głębie (pod wodą) | 3 ‰ | 5–10 | 1 |
| ruda złota | Głębie, Kryształowe, Magma, Prastare | 1,5 ‰ | 3–6 | 2 |
| ruda kobaltu | Kryształowe | 3 ‰ | 5–10 | 1 |
| ametyst, szafir, mroźny kryształ | Kryształowe (geody) | 2 ‰ każdy | geody 10–30 | 1 każdego |
| rubin, obsydian, żaryt | Magma | rubin 1 ‰, obsydian 15 ‰, żaryt 3 ‰ | 3–40 | żaryt 1 |
| adamantyt, runokamień, lśnit | Prastare | 1 ‰ / 2 ‰ / 0,5 ‰ | 2–6 | lśnit 1 (przy Bramie Serca) |

### 2.3 Pętla rozgrywki w biomie
1. **Zwiad** (nietoperz Wilgi, Pieśń Nasłuchu, sonda) → mapa zagrożeń i żył.
2. **Przyczółek** (światło, podpory, pompa lub ogrzewanie — przeciwdziałanie zagrożeniu biomu).
3. **Wydobycie powszechnych** przy hubie → **wyprawa po strategiczne** w strefę zagrożenia.
4. **Próbki → księgi badań** w Sali Wiedzy → odkrycie nowych węzłów (ukrytych do znalezienia surowca).
5. **Boss strefy** → trofeum → węzeł-klucz → możliwość wejścia w następny biom.
6. **Pieczęć Gardzieli** (fabuła) → otwarta oś logistyczna → odciążenie transportu przed kolejnym zejściem.

## 3. Pętla ryzyka i nagrody — reguły rozmieszczenia
- **R1 — Żyły-matki tylko w strefach zagrożenia**: każda w promieniu ≤ 12 kafli od rdzenia zagrożenia (zalana
  szczelina, kieszeń zarodników, rzeka lawy, sala konstruktów) albo w ścianie Gardzieli (żar, spadający gruz,
  ruch potworów). Wydajność ×3 względem typowej żyły.
- **R2 — Odległość od światła**: kafle w ciemności dłużej niż 2 doby gry generują zdarzenia grozy; najcenniejsze
  złoża leżą tam, gdzie gród jeszcze nie oświetlił drogi (prospekcja = inwestycja w infrastrukturę).
- **R3 — Krążki Pamięci zawsze za zagrożeniem**: 48 krążków; żaden nie leży w zasięgu 20 kafli od huba biomu;
  Krążki Prakowali — tylko za zamkami śpiewanymi albo konstruktami.
- **R4 — Ryzyko czytelne przed decyzją**: każda strefa ma zapowiedź widoczną z bezpiecznego miejsca (para nad
  lawą, kości przy gnieździe, migotanie lamp przy sadzy Raroga), a gra pokazuje szacowany wymóg (ikony zagrożeń
  na mapie po zwiadzie).
- **R5 — Nagroda rośnie z głębią, nie z grindem**: wartość tego samego surowca w kontraktach Wagi rośnie o 15%
  na każdy biom w dół od miejsca, w którym występuje najpłycej — opłaca się zejść, a nie kopać w kółko.
- **R6 — Chciwość ma koszt systemowy**: każda żyła-matka czarnego złota i każde użycie czarnego ognia dodaje
  Przebudzenie (+1 do +5). Najbogatsza strategia jest najgroźniejsza dla całego świata.

## 4. Bramy progresji
### 4.1 Miękkie bramy (da się wejść, nie da się zostać)
| Biom | Zagrożenie | Skutek bez przeciwdziałania | Przeciwdziałanie (dane gry) |
|---|---|---|---|
| Podgórze | noc, drapieżniki | ataki na krasnoludy poza obozem po zmroku | drzwi drewniane, pochodnie, wieża obronna, topór miedziany |
| Wapienne Progi | ciemność, zawały | praca −40%, groza; zawał sal szerszych niż 6 kafli bez podpór | pochodnie, latarnie, stemple drewniane, filary kamienne |
| Granitowe Korzenie | twarda skała, zalania | kopanie niemożliwe bez kilofa 2; przebite szczeliny zalewają 200 kafli w 30 s | kilof brązowy/żelazny, stacja pomp, gródź, mur kamienny |
| Grzybowe Groty | zarodniki, jad | duszenie (obrażenia co 5 s w chmurze), zatrucie | maska z filtrem, szyb wentylacyjny, antidotum, kamizela chitynowa |
| Zatopione Głębie | głęboka woda, zalania | 20 s oddechu | hełm nurka, strój ze skóry węgorza, stacja pomp |
| Kryształowe Głębie | mróz, ciemność | wychłodzenie w 90 s | futrzany płaszcz, ocieplany kubrak, kocioł grzewczy, napój rozgrzewający, lampy kryształowe |
| Pas Magmy | żar, lawa, opary | oparzenia w 60 s, wylewy niszczą budowle | szata z łuski salamandry, pancerz z rdzeniem mrozu, chłodnica, mur obsydianowy, mikstura ognioodporności |
| Prastare Głębiny | groza, konstrukty, ciemność | ucieczki, spadek nastroju, konstrukty odporne na zwykłą broń | płaszcz run, amulet lśnitu, kamień ochronny, lampa lśnitu, topór adamantowy, runiczny młot |

### 4.2 Twarde bramy (nie da się przejść bez spełnienia warunku)
| Brama | Warunek | Uzasadnienie w świecie |
|---|---|---|
| Twardość skały macierzystej | poziom kilofa: Progi 1, Granit/Groty/Głębie 2, Kryształowe 3, Magma/Prastare 4, Serce 5 | granit, łupek krystaliczny, bazalt, prakamień |
| Pieczęcie Gardzieli | Pierwsza: pieśń albo ładunki (KM2); Wodna: hełm nurka + pompy; Ognia: chłodnice + pieśń albo rozbicie (QDD-L8); Brama Serca: Klucz Serca (KM4) | kamień Prakowali (poziom 9) nie do przekopania |
| Zamki śpiewane | śpiewak z umiejętnością ≥ poziom zamka (1–5) albo kamertony Iskry | technika „kamienia, który śpiewa” |
| Węzły-klucze badań | trofeum bossa poprzedniej warstwy | `src/content/tech.ts` |
| Przejścia nad przepaściami | most linowy (Groty) albo forma nietoperza (zwiad) | przepaście 20 kafli |
| Punkt bez powrotu | KM4 ukończona | otwarcie Bramy Serca budzi Raroga |

## 5. Strefa szczytowa (propozycja do biblii treści — wymaga danych)
**Gniazdo Burz** na wierzchołku Kuźnicy (y −40 do −25): półki skalne nad kraterem, wiatr i oblodzenie.
Zarządzanie wytrzymałością: wspinaczka (lina z hakiem, stalowe raki) zużywa wytrzymałość krasnoluda; przy zerze
spada z półki. Nagroda: **piorunit** — kryształ ładowany przez burze (strategiczny surowiec gnomiej techniki:
iskrowniki bez ryzyka żaru) i widok w głąb krateru na Gardziel (jednorazowe odsłonięcie mgły w osi). Ryzyko:
burza co 2 doby gry (pioruny w metalowe przedmioty). Wymaga dodania do danych: surowiec, złoże, przedmioty,
receptury i węzeł badań — decyzja przy fazie B1.
