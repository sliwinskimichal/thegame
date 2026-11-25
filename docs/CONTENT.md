# Biblia treści — Underhearth

> Plik generowany z danych (`src/content/`) poleceniem `CONTENT_DOC=1 npx vitest run tests/contentdoc.test.ts`.
> Nie edytuj ręcznie — zmieniaj dane. Spójność pilnuje `tests/content.test.ts`.

## Podsumowanie

| Kategoria | Liczba |
|---|---|
| Biomy | 9 |
| Zagrożenia środowiskowe | 15 |
| Złoża (rodzaje) | 26 |
| Surowce kopalne | 27 |
| Surowce z obiektów i stworzeń | 47 |
| Materiały wytwarzane | 81 |
| Przedmioty użytkowe krasnoludów | 91 |
| Typy budowli (× 3 poziomy) | 24 (72) |
| Elementy infrastruktury | 28 |
| Receptury | 184 |
| Węzły drzewka technologii | 127 |
| Obiekty do zbierania | 16 |
| Stworzenia (w tym bossowie) | 34 (9) |

## Biomy i zagrożenia

### 0. Podgórze (0–20 kafli w głąb)

Łąki i sosnowy las u stóp góry. Za dnia spokojnie, nocą krążą wilki, a gobliny sprawdzają, czy przybysze są łatwym łupem.

**Wyzwanie:** Obóz, drewno i kamień, pierwsze schronienie w zboczu, ogień i warta przed nocą.

- **Nocne drapieżniki** — Wilki atakują krasnoludy poza obozem po zmroku. Przeciwdziałanie: wooden_door, torch, defense_tower, Miedziany topór bojowy, Włócznia myśliwska.
- **Najazdy** — Gobliny i potwory szturmują gród, gdy rośnie jego bogactwo. Przeciwdziałanie: defense_tower, barracks, iron_door, stone_wall.

Stworzenia: Wilk, Dzik, Jeleń, Goblin rabuś, **Wilczy Herszt (boss)**.
Złoża: Złoże gliny, Złoże piasku, Żyła miedzi.

### 1. Wapienne Progi (20–100 kafli w głąb)

Ciepłe warstwy wapienia i piaskowca, pokłady węgla i jaskinie nietoperzy pełne saletry. Szerokie hale bez podpór się zawalają.

**Wyzwanie:** Światło i podpory: pochodnie, stemple, zaprawa wapienna. Brąz z miedzi i cyny.

- **Ciemność** — Bez światła praca idzie wolniej, nastrój spada, potwory śmielej atakują. Przeciwdziałanie: torch, oil_lamp_post, crystal_lamp_post, Kaganek, Latarnia smolna, Lampa kryształowa, Lampa lśnitowa.
- **Zawały** — Szerokie wyrobiska bez podpór osuwają się, raniąc i grzebiąc krasnoludy. Przeciwdziałanie: wooden_prop, stone_pillar, iron_truss.

Stworzenia: Nietoperz jaskiniowy, Szczur skalny, Goblin kopacz, **Królowa Nietoperzy (boss)**.
Złoża: Złoże gliny, Żyła miedzi, Pokład węgla, Żyła cyny, Ławica wapienia, Naloty saletry.

### 2. Granitowe Korzenie (100–190 kafli w głąb)

Twardy granit, w którym kryją się żelazo, ołów i cynk. Przebicie się do kieszeni wodnej zalewa tunele w kilka chwil.

**Wyzwanie:** Twardsze kilofy, żelazo i stal, pompy i grodzie przeciw wodzie, pierwsza energia z koła wodnego.

- **Twarda skała** — Granit i bazalt wymagają lepszych kilofów. Przeciwdziałanie: Kilof brązowy, Kilof żelazny, Kilof stalowy.
- **Zalania** — Przebite kieszenie wodne zalewają tunele; woda topi i niszczy zapasy. Przeciwdziałanie: pump_station, bulkhead, stone_wall.

Stworzenia: Pełzacz jaskiniowy, Olbrzymi kret, Ślepiec, **Matka Pełzaczy (boss)**.
Złoża: Żyła miedzi, Pokład węgla, Żyła żelaza, Żyła galeny, Żyła sfalerytu, Żyła kwarcu.

### 3. Grzybowe Groty (190–280 kafli w głąb)

Ogromne groty porośnięte świecącą grzybnią. Zarodniki dławią płuca, a w sieciach czekają olbrzymie pająki.

**Wyzwanie:** Maski z filtrem i wentylacja, antidotum, uprawa grzybów, jedwab i proch górniczy.

- **Zarodniki** — Duszące chmury zarodników w grotach grzybowych. Przeciwdziałanie: Maska z filtrem, Maska z kryształowym filtrem, vent_shaft.
- **Jad** — Ukąszenia pająków zatruwają; bez antidotum trucizna zabija powoli. Przeciwdziałanie: Antidotum, Kamizela chitynowa, infirmary.

Stworzenia: Olbrzymi pająk, Grzybnik, Śluzowiec, **Królowa Pajęczyn (boss)**.
Złoża: Pokład węgla, Żyła żelaza, Żyła srebra, Wyziew siarki.

### 4. Zatopione Głębie (280–370 kafli w głąb)

Podziemne morze w czarnych kawernach. Pod wodą perły, sól i nikiel, w toni węgorze długie jak wagonik.

**Wyzwanie:** Hydraulika: pompy parowe, tamy, akwedukty, stroje nurków i maszyna parowa.

- **Głęboka woda** — Zatopione kawerny skrywają złoża pod wodą; bez sprzętu krasnolud się topi. Przeciwdziałanie: Strój ze skóry węgorza, Hełm nurka, pump_station.
- **Zalania** — Przebite kieszenie wodne zalewają tunele; woda topi i niszczy zapasy. Przeciwdziałanie: pump_station, bulkhead, stone_wall.

Stworzenia: Węgorz głębinowy, Topielec, Krab skalny, **Lewiatan Jeziora (boss)**.
Złoża: Złoże piasku, Żyła żelaza, Żyła srebra, Pokład soli, Żyła niklu, Żyła złota.

### 5. Kryształowe Głębie (370–460 kafli w głąb)

Geody wielkie jak katedry. Mroźne kryształy wysysają ciepło z powietrza, a niektóre z nich chodzą.

**Wyzwanie:** Ogrzewanie i ocieplana odzież, optyka i lampy kryształowe, stal kobaltowa przeciw golemom.

- **Mróz** — Mroźne kryształy wysysają ciepło; wychłodzenie spowalnia i zabija. Przeciwdziałanie: Futrzany płaszcz, Ocieplany kubrak, heater, Napój rozgrzewający.
- **Ciemność** — Bez światła praca idzie wolniej, nastrój spada, potwory śmielej atakują. Przeciwdziałanie: torch, oil_lamp_post, crystal_lamp_post, Kaganek, Latarnia smolna, Lampa kryształowa, Lampa lśnitowa.

Stworzenia: Golem kryształowy, Mroźna ćma, Troll jaskiniowy, **Kryształowy Kolos (boss)**.
Złoża: Żyła kwarcu, Żyła srebra, Żyła złota, Żyła kobaltu, Geoda ametystu, Geoda szafiru, Kępa mroźnych kryształów.

### 6. Pas Magmy (460–550 kafli w głąb)

Rzeki lawy, obsydian i żaryt. Gorąco zabija szybciej niż chochliki, które w nim tańczą.

**Wyzwanie:** Chłodzenie mroźnymi rdzeniami z poprzedniej warstwy, obsydianowe mury, kuźnia i turbina magmowa.

- **Żar** — Temperatura pasa magmy pali bez ochrony. Przeciwdziałanie: Szata z łuski salamandry, Pancerz z rdzeniem mrozu, cooler, Mikstura ognioodporności.
- **Lawa** — Wylewy lawy niszczą wszystko na swojej drodze; z wodą tworzą obsydian. Przeciwdziałanie: obsidian_wall, pump_station, bulkhead.
- **Opary** — Siarkowe opary nad lawą. Przeciwdziałanie: Maska z kryształowym filtrem, vent_shaft.

Stworzenia: Salamandra, Ognisty chochlik, Robak magmowy, **Pradawny Robak Magmowy (boss)**.
Złoża: Wyziew siarki, Żyła złota, Geoda rubinu, Zastygły obsydian, Żyła żarytu.

### 7. Prastare Głębiny (550–640 kafli w głąb)

Ruiny cywilizacji starszej niż krasnoludy. Mrok tu gęstnieje i odbiera odwagę, a strażnicy wciąż pełnią wartę.

**Wyzwanie:** Runy ochronne, światło lśnitu, adamant przeciw pancernym konstruktom.

- **Groza** — Prastary mrok odbiera odwagę: nastrój spada, światło gaśnie szybciej. Przeciwdziałanie: Płaszcz run, Amulet lśnitu, ward_stone, Lampa lśnitowa.
- **Konstrukty** — Pancerni strażnicy ruin odporni na zwykłą broń. Przeciwdziałanie: Adamantowy topór bojowy, Runiczny młot, defense_tower.
- **Ciemność** — Bez światła praca idzie wolniej, nastrój spada, potwory śmielej atakują. Przeciwdziałanie: torch, oil_lamp_post, crystal_lamp_post, Kaganek, Latarnia smolna, Lampa kryształowa, Lampa lśnitowa.

Stworzenia: Upiór, Prastary konstrukt, Cieniostwór, **Strażnik Ruin (boss)**.
Złoża: Żyła złota, Geoda ametystu, Żyła adamantytu, Złoże runokamienia, Żyła lśnitu.

### 8. Serce Góry (640–680 kafli w głąb)

Zapieczętowana komnata, w której śpi Pożeracz Światła. Kto go zbudzi, musi go pokonać.

**Wyzwanie:** Wszystko, czego nauczył się gród: klucz Serca, najlepszy ekwipunek i przygotowana obrona.

- **Groza** — Prastary mrok odbiera odwagę: nastrój spada, światło gaśnie szybciej. Przeciwdziałanie: Płaszcz run, Amulet lśnitu, ward_stone, Lampa lśnitowa.
- **Żar** — Temperatura pasa magmy pali bez ochrony. Przeciwdziałanie: Szata z łuski salamandry, Pancerz z rdzeniem mrozu, cooler, Mikstura ognioodporności.
- **Ciemność** — Bez światła praca idzie wolniej, nastrój spada, potwory śmielej atakują. Przeciwdziałanie: torch, oil_lamp_post, crystal_lamp_post, Kaganek, Latarnia smolna, Lampa kryształowa, Lampa lśnitowa.

Stworzenia: **Pożeracz Światła (boss)**.

## Złoża

| Złoże | Daje | Biomy | Twardość | Kilof (poziom) | Rzadkość |
|---|---|---|---|---|---|
| Złoże gliny | Glina | Podgórze, Wapienne Progi | 1.3 | 0 | common |
| Złoże piasku | Piasek | Podgórze, Zatopione Głębie | 0.8 | 0 | common |
| Żyła miedzi | Ruda miedzi | Podgórze, Wapienne Progi, Granitowe Korzenie | 2.8 | 1 | common |
| Pokład węgla | Węgiel | Wapienne Progi, Granitowe Korzenie, Grzybowe Groty | 2 | 1 | common |
| Żyła cyny | Ruda cyny | Wapienne Progi | 2.6 | 1 | uncommon |
| Ławica wapienia | Wapień | Wapienne Progi | 2.2 | 1 | common |
| Naloty saletry | Saletra | Wapienne Progi | 1.6 | 1 | uncommon |
| Żyła żelaza | Ruda żelaza | Granitowe Korzenie, Grzybowe Groty, Zatopione Głębie | 3.6 | 2 | common |
| Żyła galeny | Galena | Granitowe Korzenie | 3 | 2 | uncommon |
| Żyła sfalerytu | Sfaleryt | Granitowe Korzenie | 3.2 | 2 | uncommon |
| Żyła kwarcu | Kwarc | Granitowe Korzenie, Kryształowe Głębie | 3.8 | 2 | uncommon |
| Żyła srebra | Ruda srebra | Grzybowe Groty, Zatopione Głębie, Kryształowe Głębie | 3.8 | 2 | uncommon |
| Wyziew siarki | Siarka | Grzybowe Groty, Pas Magmy | 2.4 | 2 | uncommon |
| Pokład soli | Sól kamienna | Zatopione Głębie | 2.2 | 2 | common |
| Żyła niklu | Ruda niklu | Zatopione Głębie | 4.2 | 3 | uncommon |
| Żyła złota | Ruda złota | Zatopione Głębie, Kryształowe Głębie, Pas Magmy, Prastare Głębiny | 3.4 | 3 | rare |
| Żyła kobaltu | Ruda kobaltu | Kryształowe Głębie | 4.6 | 3 | uncommon |
| Geoda ametystu | Ametyst | Kryształowe Głębie, Prastare Głębiny | 4.2 | 3 | rare |
| Geoda szafiru | Szafir | Kryształowe Głębie | 4.4 | 3 | rare |
| Kępa mroźnych kryształów | Mroźny kryształ | Kryształowe Głębie | 4 | 3 | uncommon |
| Geoda rubinu | Rubin | Pas Magmy | 5 | 4 | rare |
| Zastygły obsydian | Obsydian | Pas Magmy | 6 | 4 | common |
| Żyła żarytu | Ruda żarytu | Pas Magmy | 5.5 | 4 | uncommon |
| Żyła adamantytu | Ruda adamantytu | Prastare Głębiny | 8 | 4 | rare |
| Złoże runokamienia | Runokamień | Prastare Głębiny | 6.5 | 4 | uncommon |
| Żyła lśnitu | Ruda lśnitu | Prastare Głębiny | 7.5 | 5 | legendary |

## Surowce kopalne

| Nazwa | Warstwa (dostępne od) | Wartość | Skąd | Do czego |
|---|---|---|---|---|
| Kamień | 0 | 1 |  | Kilof krzemienny, Kamienna siekiera, Włócznia myśliwska, Blok kamienny, Notatki górnicze, Ognisko obozowe… |
| Glina | 0 | 1 | Złoże gliny | Cegła, Palenisko kuchenne, Piec glinany, Dymarka, Zielarnia |
| Piasek | 0 | 1 | Złoże piasku | Zaprawa, Szkło |
| Ruda miedzi | 0 | 3 | Żyła miedzi, Goblin rabuś, Goblin kopacz | Sztabka miedzi |
| Węgiel | 1 | 2 | Pokład węgla, Goblin kopacz | Wapno palone, Koks, Szkło, Sztabka miedzi, Sztabka cyny, Sztabka ołowiu… |
| Ruda cyny | 1 | 4 | Żyła cyny, Goblin kopacz | Sztabka cyny |
| Wapień | 1 | 1 | Ławica wapienia | Wapno palone, Mapy mierniczego |
| Saletra | 1 | 4 | Naloty saletry | Proch górniczy |
| Ruda żelaza | 2 | 5 | Żyła żelaza | Sztabka żelaza, Plany inżyniera |
| Galena | 2 | 4 | Żyła galeny | Sztabka ołowiu |
| Sfaleryt | 2 | 5 | Żyła sfalerytu | Sztabka cynku |
| Kwarc | 2 | 6 | Żyła kwarcu, Kiść kryształów, Golem kryształowy | Szkło, Soczewka, Huta szkła, Szlifiernia |
| Ruda srebra | 3 | 10 | Żyła srebra | Sztabka srebra |
| Siarka | 3 | 5 | Wyziew siarki | Proch górniczy |
| Sól kamienna | 4 | 4 | Pokład soli | Pasztet rybny, Gulasz grzybowy, Krasnoludzka uczta |
| Ruda niklu | 4 | 9 | Żyła niklu | Sztabka niklu |
| Ruda złota | 4 | 16 | Żyła złota | Sztabka złota |
| Ruda kobaltu | 5 | 14 | Żyła kobaltu | Sztabka kobaltu |
| Ametyst | 5 | 20 | Geoda ametystu | Kryształowa tabliczka, Szlifowany ametyst |
| Szafir | 5 | 24 | Geoda szafiru | Szlifowany szafir |
| Mroźny kryształ | 5 | 18 | Kępa mroźnych kryształów, Kiść kryształów | Rdzeń mrozu, Kryształowa tabliczka |
| Rubin | 6 | 28 | Geoda rubinu | Ognisty kodeks, Szlifowany rubin |
| Obsydian | 6 | 8 | Zastygły obsydian, Robak magmowy | Ostrze obsydianowe, Bomba ogniowa, Ognisty kodeks, Kuźnia magmowa, Turbina magmowa, Mur obsydianowy |
| Ruda żarytu | 6 | 26 | Żyła żarytu | Sztabka brązu żarowego |
| Ruda adamantytu | 7 | 40 | Żyła adamantytu | Sztabka adamantu |
| Ruda lśnitu | 7 | 50 | Żyła lśnitu | Sztabka lśnitstali |
| Runokamień | 7 | 30 | Złoże runokamienia | Tablica runiczna, Księga run |

## Surowce z obiektów i stworzeń

| Nazwa | Warstwa (dostępne od) | Wartość | Skąd | Do czego |
|---|---|---|---|---|
| Drewno | 0 | 1 | Sosna, Brzoza, Goblin rabuś | Deska, Belka, Kilof krzemienny, Kamienna siekiera, Włócznia myśliwska, Węgiel drzewny… |
| Żywica | 0 | 2 | Sosna | Smoła, Skóra garbowana, Atrament, Kaganek, Pochodnia |
| Włókno | 0 | 1 | Brzoza, Krzak jagód, Wysoka trawa | Kilof krzemienny, Kamienna siekiera, Włócznia myśliwska, Lina, Płótno, Notatki górnicze… |
| Jagody | 0 | 1 | Krzak jagód, Poletko, Ogród świetlny | Napój leczniczy, Racja podróżna, Miód jagodowy |
| Jęczmień | 0 | 1 | Dziki jęczmień, Poletko, Ogród świetlny | Mąka jęczmienna, Słód |
| Surowe mięso | 0 | 2 | Olbrzymi małż, Wilk, Dzik, Jeleń | Racja podróżna, Pieczeń, Gulasz grzybowy |
| Skóra surowa | 0 | 3 | Wilk, Dzik, Jeleń, Wilczy Herszt | Tarcza drewniana, Skóra garbowana, Pergamin |
| Kość | 0 | 1 | Stos kości, Wilk, Jeleń, Goblin rabuś | Wędka z jedwabną żyłką, Klej kostny |
| Kieł | 0 | 3 | Wilk, Wilczy Herszt | badanie: Łowiectwo |
| Pióro | 0 | 1 | Ptasie gniazdo | Bełty, Bełty przebijające |
| Guano | 1 | 1 | Hałda guana, Nietoperz jaskiniowy, Królowa Nietoperzy | Nawóz |
| Błona nietoperza | 1 | 3 | Nietoperz jaskiniowy, Królowa Nietoperzy | Tonik nocnego wzroku |
| Mech jaskiniowy | 1 | 1 | Kępa mchu | Napój leczniczy, Antidotum |
| Chityna | 2 | 4 | Pełzacz jaskiniowy, Matka Pełzaczy, Olbrzymi pająk, Krab skalny | Płytka chitynowa |
| Kwas pełzacza | 2 | 5 | Pełzacz jaskiniowy, Matka Pełzaczy | Mosiężna sonda |
| Futro | 2 | 6 | Olbrzymi kret | Futro wyprawione |
| Grzyb jadalny | 3 | 2 | Olbrzymi grzyb, Świetlik grzybowy, Grzybnik, Grzybnia | Gulasz grzybowy, Ciemny stout grzybowy |
| Drewno grzybowe | 3 | 2 | Olbrzymi grzyb | Płyta grzybowa |
| Świecące zarodniki | 3 | 4 | Świetlik grzybowy, Grzybnik, Grzybnia | Pasta zarodnikowa, Kodeks alchemiczny |
| Jedwab pajęczy | 3 | 6 | Olbrzymi pająk, Królowa Pajęczyn | Tkanina jedwabna, Lina jedwabna |
| Gruczoł jadowy | 3 | 6 | Olbrzymi pająk, Królowa Pajęczyn | Ekstrakt jadu, Kodeks alchemiczny |
| Śluz | 3 | 3 | Śluzowiec | Uszczelka, Pasta zarodnikowa |
| Ryba jaskiniowa | 4 | 3 | Ławica ryb, Węgorz głębinowy | Olej rybi, Pasztet rybny |
| Skóra węgorza | 4 | 8 | Węgorz głębinowy, Lewiatan Jeziora | Uszczelka, Strój ze skóry węgorza, Traktat hydrauliczny |
| Perła | 4 | 20 | Olbrzymi małż, Topielec, Lewiatan Jeziora | Traktat hydrauliczny, Broszka z perłą |
| Wodorost jaskiniowy | 4 | 2 | Łąka wodorostów, Topielec | Gulasz grzybowy |
| Odłamek golema | 5 | 10 | Golem kryształowy, Kryształowy Kolos | Lampa kryształowa |
| Kryształowe serce | 5 | 40 | Golem kryształowy, Kryształowy Kolos | Klucz Serca |
| Skóra trolla | 5 | 14 | Troll jaskiniowy | Ocieplany kubrak |
| Tłuszcz trolla | 5 | 8 | Troll jaskiniowy | Napój rozgrzewający |
| Pył mroźnej ćmy | 5 | 8 | Mroźna ćma | Rdzeń mrozu, Maska z kryształowym filtrem |
| Łuska salamandry | 6 | 14 | Salamandra | Skóra łuskowa, Mikstura ognioodporności |
| Gruczoł ognisty | 6 | 12 | Ognisty chochlik, Pradawny Robak Magmowy | Esencja ognia |
| Rdzeń magmowy | 6 | 30 | Robak magmowy, Pradawny Robak Magmowy | Sztabka adamantu |
| Ektoplazma | 7 | 18 | Upiór, Cieniostwór | Esencja eteryczna |
| Prastary tryb | 7 | 22 | Skrytka w ruinach, Prastary konstrukt, Strażnik Ruin | Mechanizm zegarowy |
| Pył runiczny | 7 | 15 | Skrytka w ruinach, Prastary konstrukt | Atrament runiczny, Księga run |
| Relikwia | 7 | 60 | Skrytka w ruinach, Strażnik Ruin | Klucz Serca |
| Futro Wilczego Herszta | 0 | 30 | Wilczy Herszt | badanie: Kamienne Palenisko |
| Serce Królowej Nietoperzy | 1 | 50 | Królowa Nietoperzy | badanie: Wielki piec |
| Pancerz Matki Pełzaczy | 2 | 70 | Matka Pełzaczy | badanie: Grzybnie |
| Jedwab Królowej Pajęczyn | 3 | 90 | Królowa Pajęczyn | badanie: Uszczelnienia |
| Łuska Lewiatana | 4 | 120 | Lewiatan Jeziora | badanie: Szlif klejnotów |
| Rdzeń Kolosa | 5 | 150 | Kryształowy Kolos | badanie: Kuźnia magmowa |
| Serce Robaka Magmowego | 6 | 180 | Pradawny Robak Magmowy | badanie: Esencja eteryczna |
| Pieczęć Strażnika | 7 | 220 | Strażnik Ruin | Klucz Serca |
| Okruch Pożeracza | 8 | 1000 | Pożeracz Światła |  |

## Materiały wytwarzane

| Nazwa | Warstwa (dostępne od) | Wartość | Skąd | Do czego |
|---|---|---|---|---|
| Deska | 0 | 2 | Kozioł stolarski, Tartak parowy | Tarcza drewniana, Kusza drewniana, Kilof żelazny, Kilof stalowy, Stalowy topór drwala, Stalowy młot budowniczego… |
| Belka | 0 | 3 | Kozioł stolarski | Szyna, Koło wodne, Kołowrót linowy, Kołowrót wiertniczy, Kratownica żelazna |
| Lina | 0 | 3 | Warsztat rzemieślnika | Kusza drewniana, Kusza stalowa, Skórznia, Skórzany plecak, Lina z hakiem, Plecak z ramą… |
| Węgiel drzewny | 0 | 2 | Piec glinany | Cegła, Sztabka miedzi, Atrament, Filtr węglowy, Proch górniczy |
| Cegła | 0 | 2 | Piec glinany | Kamienne Palenisko, Kuchnia, Wielka kuchnia, Wapiennik, Huta szkła, Wielki piec… |
| Blok kamienny | 0 | 3 | Ława kamieniarska, Szlifiernia mistrzowska | Kamienne Palenisko, Wielkie Palenisko, Kamienny skład, Skarbiec, Komnaty, Kamieniarnia… |
| Skóra garbowana | 0 | 6 | Warsztat rzemieślnika | Hełm brązowy, Stalowy topór bojowy, Hełm stalowy, Kolczuga, Okute buty, Stalowe raki… |
| Pergamin | 0 | 4 | Warsztat rzemieślnika | Mapy mierniczego, Plany inżyniera, Kodeks alchemiczny, Traktat hydrauliczny, Ognisty kodeks, Księga run |
| Atrament | 0 | 3 | Warsztat rzemieślnika | Atrament runiczny, Mapy mierniczego, Plany inżyniera |
| Płótno | 0 | 4 | Warsztat rzemieślnika | Bandaż, Filtr węglowy, Ładunek górniczy, Izby, Posłanie zielarza, Karczma… |
| Sztabka miedzi | 0 | 8 | Dymarka | Sztabka brązu, Sztabka mosiądzu, Kilof miedziany, Miedziany topór bojowy, Gwoździe, Drut miedziany… |
| Mąka jęczmienna | 0 | 2 | Palenisko kuchenne | Chleb jęczmienny, Pasztet rybny |
| Słód | 0 | 2 | Kadź | Piwo, Miód jagodowy, Ciemny stout grzybowy |
| Klej kostny | 1 | 3 | Zielarnia | Płytka chitynowa |
| Smoła | 0 | 3 | Piec glinany | Latarnia smolna, Gródź |
| Notatki górnicze | 0 | 6 | Kącik kronikarza | badanie: Rzemiosło obozowe, badanie: Kamieniarstwo, badanie: Wypał w glinie, badanie: Łowiectwo, badanie: Pismo, badanie: Gotowanie… |
| Sztabka cyny | 1 | 9 | Dymarka | Sztabka brązu |
| Sztabka brązu | 1 | 12 | Dymarka | Kusza drewniana, Sztabka brązu żarowego, Kilof brązowy, Brązowy topór bojowy, Brązowa siekiera, Brązowy młot budowniczego… |
| Wapno palone | 1 | 3 | Wapiennik | Zaprawa, Szkło, Szkło hartowane, Futro wyprawione |
| Zaprawa | 1 | 3 | Ława kamieniarska | Filar kamienny, Mur obsydianowy |
| Gwoździe | 1 | 1 | Kowadło | Okute buty, Izby, Stolarnia |
| Drut miedziany | 1 | 4 | Kowadło | Miedziana różdżka, Mosiężna sonda |
| Nawóz | 1 | 2 | Zielarnia | Grzyb jadalny, Świecące zarodniki, Jęczmień, Grzybnia |
| Mapy mierniczego | 1 | 10 | Kącik kronikarza | badanie: Kamienne Palenisko, badanie: Wytop cyny, badanie: Węgiel kamienny, badanie: Epoka brązu, badanie: Wypał wapna, badanie: Obudowa górnicza… |
| Koks | 2 | 4 | Wapiennik | Szkło hartowane, Sztabka żelaza, Sztabka stali, Sztabka cynku, Sztabka srebra, Sztabka niklu… |
| Sztabka żelaza | 2 | 14 | Wielki piec | Sztabka stali, Kilof żelazny, Żelazny młot bojowy, Blacha żelazna, Łańcuch, Szyna… |
| Sztabka stali | 2 | 22 | Wielki piec | Stal niklowa, Stal kobaltowa, Sztabka lśnitstali, Kilof stalowy, Stalowy topór drwala, Stalowy młot budowniczego… |
| Sztabka ołowiu | 2 | 10 | Dymarka | Rura |
| Sztabka cynku | 2 | 11 | Wielki piec | Sztabka mosiądzu |
| Sztabka mosiądzu | 2 | 16 | Wielki piec | Zębatka, Maska z filtrem, Mosiężna sonda, Zawór ciśnieniowy, Hełm nurka, Mechanizm zegarowy… |
| Szkło | 2 | 6 | Wapiennik | Szkło hartowane, Maska z filtrem, Mosiężna sonda, Hełm nurka, Kodeks alchemiczny, Kryształowa tabliczka… |
| Zębatka | 2 | 10 | Pracownia mechanizmów | Kusza powtarzalna, Skarbiec, Tartak parowy, Szlifiernia mistrzowska, Fabryka parowa, Balista powtarzalna… |
| Rura | 2 | 8 | Pracownia mechanizmów | Wymiennik ciepła, Browar, Grzybnia, Ogród świetlny, Pompa ręczna, Pompa tłokowa… |
| Blacha żelazna | 2 | 18 | Kuźnia | Zbroja płytowa, Balista powtarzalna, Pompa tłokowa, Maszyna parowa, Stacja z dźwigiem, Drzwi żelazne… |
| Łańcuch | 2 | 10 | Kuźnia | Kolczuga, Winda zębata, Winda parowa, Stacja z dźwigiem, Przenośnik łańcuchowy |
| Szyna | 2 | 6 | Kuźnia | Zajezdnia, Tory |
| Sprężyna | 2 | 12 | Pracownia mechanizmów | Kusza stalowa, Kusza powtarzalna, Mechanizm zegarowy, Balista powtarzalna, Pułapka ostrzowa |
| Płytka chitynowa | 2 | 10 | Pracownia mechanizmów | Kamizela chitynowa, Rękawice kowalskie |
| Filtr węglowy | 2 | 6 | Pracownia mechanizmów | Maska z filtrem |
| Futro wyprawione | 2 | 10 | Pracownia mechanizmów | Futrzany płaszcz, Ocieplina |
| Plany inżyniera | 2 | 18 | Kącik kronikarza | badanie: Koksownia, badanie: Wielki piec, badanie: Kuźnia, badanie: Stal, badanie: Uzbrojenie stalowe, badanie: Ołów i rury… |
| Płyta grzybowa | 3 | 4 | Stolarnia, Tartak parowy | Kilof żarowy, Włócznia obsydianowa, Kilof adamantowy, Tarcza runiczna, Grzybnia |
| Tkanina jedwabna | 3 | 14 | Pracownia mechanizmów | Strój ze skóry węgorza, Ocieplina, Szata z łuski salamandry, Płaszcz run, Komnaty |
| Lina jedwabna | 3 | 10 | Pracownia mechanizmów | Włócznia obsydianowa, Wędka z jedwabną żyłką |
| Proch górniczy | 3 | 12 | Laboratorium | Ładunek górniczy, Bomba ogniowa |
| Ekstrakt jadu | 3 | 10 | Laboratorium | Antidotum |
| Pasta zarodnikowa | 3 | 8 | Laboratorium | Tonik nocnego wzroku, Napój rozgrzewający, Ciemny stout grzybowy |
| Sztabka srebra | 3 | 24 | Wielki piec | Kryształowa tabliczka, Srebrny pierścień, Broszka z perłą, Amulet szafirowy, Browar mistrzowski, Laboratorium eteryczne… |
| Kodeks alchemiczny | 3 | 28 | Biblioteka | badanie: Drewno grzybowe, badanie: Grzybnie, badanie: Laboratorium, badanie: Odtrutki, badanie: Tkactwo jedwabiu, badanie: Proch górniczy… |
| Olej rybi | 4 | 6 | Laboratorium | Tłok |
| Sztabka niklu | 4 | 20 | Wielki piec | Stal niklowa |
| Stal niklowa | 4 | 32 | Wielki piec | Zbroja płytowa, Tłok, Nosidło parowe, Pancerz z rdzeniem mrozu, Wymiennik ciepła, Skarbiec… |
| Sztabka złota | 4 | 40 | Wielki piec | Księga run, Talizman ametystowy, Amulet rubinowy, Lampa lśnitowa, Wielkie Palenisko, Laboratorium eteryczne… |
| Uszczelka | 4 | 8 | Pracownia mechanizmów | Zawór ciśnieniowy, Strój ze skóry węgorza, Hełm nurka, Tłok |
| Zawór ciśnieniowy | 4 | 20 | Pracownia mechanizmów | Hełm nurka, Fabryka parowa, Pompa parowa, Maszyna parowa, Parowa kolejka |
| Tłok | 4 | 30 | Fabryka parowa | Nosidło parowe, Tartak parowy, Pompa parowa, Maszyna parowa, Winda parowa, Parowa kolejka… |
| Traktat hydrauliczny | 4 | 40 | Biblioteka | badanie: Uszczelnienia, badanie: Nurkowanie, badanie: Nikiel, badanie: Rybołówstwo, badanie: Fabryka parowa, badanie: Maszyna parowa… |
| Sztabka kobaltu | 5 | 30 | Wielki piec | Stal kobaltowa |
| Stal kobaltowa | 5 | 50 | Wielki piec | Kilof kobaltowy, Kobaltowy topór bojowy, Wielkie Palenisko, Szlifiernia mistrzowska, Kuźnia magmowa, Kuźnia mistrzowska… |
| Soczewka | 5 | 12 | Szlifiernia | Kryształowy wykrywacz, Lampa kryształowa, Maska z kryształowym filtrem, Lampa lśnitowa, Ogród świetlny, Latarnia kryształowa… |
| Szkło hartowane | 5 | 16 | Huta szkła | Ognisty kodeks, Ogród świetlny, Laboratorium eteryczne, Archiwum |
| Szlifowany ametyst | 5 | 40 | Pracownia jubilerska | Talizman ametystowy, Amulet lśnitu, Sanktuarium, Runiczny jubiler |
| Szlifowany szafir | 5 | 48 | Pracownia jubilerska | Amulet szafirowy, Kryształowy wykrywacz, Wielkie Palenisko, Kuźnia mistrzowska, Archiwum |
| Rdzeń mrozu | 5 | 45 | Laboratorium | Pancerz z rdzeniem mrozu, Wymiennik ciepła, Chłodnica |
| Ocieplina | 5 | 20 | Pracownia mechanizmów | Hełm adamantowy, Ocieplany kubrak, Pancerz z rdzeniem mrozu |
| Kryształowa tabliczka | 5 | 60 | Biblioteka | badanie: Optyka, badanie: Szlif klejnotów, badanie: Kobalt, badanie: Kuźnia mistrzowska, badanie: Alchemia mrozu, badanie: Ocieplenie… |
| Szlifowany rubin | 6 | 56 | Runiczny jubiler | Amulet rubinowy |
| Sztabka brązu żarowego | 6 | 60 | Kuźnia magmowa | Kilof żarowy, Żarowy młot, Runiczny jubiler, Wiertło magmowe |
| Ostrze obsydianowe | 6 | 24 | Szlifiernia mistrzowska | Włócznia obsydianowa |
| Esencja ognia | 6 | 30 | Laboratorium eteryczne | Żarowy młot, Bełty ogniste, Mikstura ognioodporności, Bomba ogniowa, Działo runiczne |
| Skóra łuskowa | 6 | 40 | Fabryka parowa | Adamantowy topór bojowy, Zbroja adamantowa, Szata z łuski salamandry |
| Wymiennik ciepła | 6 | 70 | Fabryka parowa | Turbina magmowa, Wiertło magmowe |
| Ognisty kodeks | 6 | 80 | Archiwum | badanie: Kuźnia magmowa, badanie: Narzędzia żarowe, badanie: Obsydian, badanie: Alchemia ognia, badanie: Garbowanie łusek, badanie: Wymienniki ciepła… |
| Sztabka adamantu | 7 | 110 | Kuźnia magmowa | Kilof adamantowy, Adamantowy topór bojowy, Hełm adamantowy, Zbroja adamantowa, Runiczny młot, Tarcza runiczna… |
| Sztabka lśnitstali | 7 | 140 | Kuźnia magmowa | Lśniący kilof, Amulet lśnitu, Lampa lśnitowa, Klucz Serca, Latarnia lśnitu |
| Atrament runiczny | 7 | 40 | Laboratorium eteryczne | Tablica runiczna, Płaszcz run, Amulet lśnitu |
| Tablica runiczna | 7 | 70 | Szlifiernia mistrzowska | Runiczny młot, Tarcza runiczna, Działo runiczne, Kamień ochronny |
| Esencja eteryczna | 7 | 50 | Laboratorium eteryczne | Sztabka lśnitstali, Płaszcz run |
| Mechanizm zegarowy | 7 | 80 | Fabryka parowa | Działo runiczne |
| Księga run | 7 | 120 | Archiwum | badanie: Esencja eteryczna, badanie: Atrament runiczny, badanie: Tablice runiczne, badanie: Adamant, badanie: Oręż adamantowy, badanie: Lśnitstal… |
| Klucz Serca | 8 | 500 | Wielkie Palenisko |  |

## Przedmioty krasnoludów

| Nazwa | Slot | Warstwa | Statystyki | Receptura |
|---|---|---|---|---|
| Kilof krzemienny | pick | 0 | pickTier 1, workSpeed 0.8, durability 120 | 1× Drewno, 3× Kamień, 1× Włókno |
| Kilof miedziany | pick | 0 | pickTier 1, workSpeed 1, durability 260 | 3× Sztabka miedzi, 1× Drewno |
| Kilof brązowy | pick | 1 | pickTier 2, workSpeed 1.15, durability 420 | 3× Sztabka brązu, 1× Drewno |
| Kilof żelazny | pick | 2 | pickTier 2, workSpeed 1.35, durability 600 | 3× Sztabka żelaza, 1× Deska |
| Kilof stalowy | pick | 2 | pickTier 3, workSpeed 1.6, durability 900 | 3× Sztabka stali, 1× Deska |
| Kilof kobaltowy | pick | 5 | pickTier 4, workSpeed 1.95, durability 1300 | 3× Stal kobaltowa, 1× Deska |
| Kilof żarowy | pick | 6 | pickTier 4, workSpeed 2.35, durability 1600 | 3× Sztabka brązu żarowego, 1× Płyta grzybowa |
| Kilof adamantowy | pick | 7 | pickTier 5, workSpeed 2.8, durability 2400 | 3× Sztabka adamantu, 1× Płyta grzybowa |
| Lśniący kilof | pick | 7 | pickTier 5, workSpeed 3.4, light 3, durability 4000 | 3× Sztabka lśnitstali, 1× Sztabka adamantu |
| Kamienna siekiera | tool | 0 | workSpeed 0.9 | 1× Drewno, 2× Kamień, 1× Włókno |
| Brązowa siekiera | tool | 1 | workSpeed 1.3 | 2× Sztabka brązu, 1× Drewno |
| Stalowy topór drwala | tool | 2 | workSpeed 1.8 | 2× Sztabka stali, 1× Deska |
| Brązowy młot budowniczego | tool | 1 | workSpeed 1.25 | 2× Sztabka brązu, 1× Drewno |
| Stalowy młot budowniczego | tool | 2 | workSpeed 1.6 | 2× Sztabka stali, 1× Deska |
| Miedziana różdżka | tool | 1 | light 0 | 3× Drut miedziany, 1× Drewno |
| Mosiężna sonda | tool | 2 |  | 3× Sztabka mosiądzu, 1× Szkło, 2× Drut miedziany, 1× Kwas pełzacza |
| Kryształowy wykrywacz | tool | 5 |  | 2× Soczewka, 2× Sztabka mosiądzu, 1× Szlifowany szafir |
| Wędka z jedwabną żyłką | tool | 4 |  | 1× Kość, 1× Lina jedwabna |
| Lina z hakiem | back | 0 | workSpeed 1.2 | 3× Lina, 1× Sztabka miedzi |
| Stalowe raki | feet | 2 | workSpeed 1.4, armor 1 | 2× Sztabka stali, 1× Skóra garbowana |
| Skórzany plecak | back | 0 | carry 2 | 3× Skóra garbowana, 2× Lina |
| Plecak z ramą | back | 2 | carry 4 | 3× Skóra garbowana, 2× Sztabka żelaza, 2× Lina |
| Nosidło parowe | back | 4 | carry 7 | 1× Tłok, 2× Stal niklowa, 2× Skóra garbowana |
| Kaganek | gear | 0 | light 3 | 1× Sztabka miedzi, 2× Żywica |
| Latarnia smolna | gear | 1 | light 5 | 1× Sztabka brązu, 2× Smoła |
| Lampa kryształowa | gear | 5 | light 8 | 1× Soczewka, 2× Odłamek golema, 1× Sztabka mosiądzu |
| Lampa lśnitowa | gear | 7 | light 11, dreadRes 0.3 | 1× Sztabka lśnitstali, 2× Soczewka, 1× Sztabka złota |
| Miedziany topór bojowy | weapon | 0 | damage 8 | 3× Sztabka miedzi, 1× Drewno |
| Brązowy topór bojowy | weapon | 1 | damage 11 | 3× Sztabka brązu, 1× Drewno |
| Stalowy topór bojowy | weapon | 2 | damage 16 | 3× Sztabka stali, 1× Skóra garbowana |
| Kobaltowy topór bojowy | weapon | 5 | damage 26 | 3× Stal kobaltowa, 1× Skóra garbowana |
| Adamantowy topór bojowy | weapon | 7 | damage 40 | 3× Sztabka adamantu, 1× Skóra łuskowa |
| Żelazny młot bojowy | weapon | 2 | damage 14 | 4× Sztabka żelaza, 1× Deska |
| Żarowy młot | weapon | 6 | damage 30 | 4× Sztabka brązu żarowego, 1× Esencja ognia |
| Runiczny młot | weapon | 7 | damage 38 | 3× Sztabka adamantu, 1× Tablica runiczna |
| Włócznia myśliwska | weapon | 0 | damage 7 | 2× Drewno, 1× Kamień, 1× Włókno |
| Włócznia obsydianowa | weapon | 6 | damage 24 | 2× Ostrze obsydianowe, 2× Płyta grzybowa, 1× Lina jedwabna |
| Kusza drewniana | weapon | 1 | damage 9 | 3× Deska, 2× Lina, 1× Sztabka brązu |
| Kusza stalowa | weapon | 2 | damage 15 | 2× Sztabka stali, 2× Deska, 1× Sprężyna, 1× Lina |
| Kusza powtarzalna | weapon | 4 | damage 13 | 3× Sztabka stali, 4× Sprężyna, 3× Zębatka |
| Bełty | ammo | 1 | damage 1 | 1× Drewno, 1× Sztabka miedzi, 1× Pióro |
| Bełty przebijające | ammo | 2 | damage 4 | 1× Sztabka stali, 1× Deska, 1× Pióro |
| Bełty ogniste | ammo | 6 | damage 8 | 10× Bełty, 1× Esencja ognia |
| Tarcza drewniana | offhand | 0 | armor 3 | 4× Deska, 1× Skóra surowa |
| Tarcza stalowa | offhand | 2 | armor 7 | 3× Sztabka stali, 2× Deska |
| Tarcza runiczna | offhand | 7 | armor 14, dreadRes 0.2 | 2× Sztabka adamantu, 1× Tablica runiczna, 2× Płyta grzybowa |
| Skórzany kaptur | head | 0 | armor 1 | 2× Skóra garbowana |
| Hełm brązowy | head | 1 | armor 3 | 3× Sztabka brązu, 1× Skóra garbowana |
| Hełm stalowy | head | 2 | armor 5 | 3× Sztabka stali, 1× Skóra garbowana |
| Hełm adamantowy | head | 7 | armor 10 | 3× Sztabka adamantu, 1× Ocieplina |
| Skórznia | body | 0 | armor 2 | 3× Skóra garbowana, 1× Lina |
| Kamizela chitynowa | body | 2 | armor 4, gasRes 0.1 | 3× Płytka chitynowa, 1× Skóra garbowana |
| Kolczuga | body | 2 | armor 6 | 6× Łańcuch, 2× Skóra garbowana |
| Zbroja płytowa | body | 4 | armor 10 | 4× Stal niklowa, 2× Skóra garbowana, 2× Blacha żelazna |
| Zbroja adamantowa | body | 7 | armor 18 | 6× Sztabka adamantu, 2× Skóra łuskowa |
| Skórzane buty | feet | 0 | armor 1 | 2× Skóra garbowana |
| Okute buty | feet | 2 | armor 2, workSpeed 1.05 | 2× Skóra garbowana, 10× Gwoździe |
| Skórzane rękawice | hands | 0 | workSpeed 1.05 | 1× Skóra garbowana |
| Rękawice kowalskie | hands | 2 | workSpeed 1.1, heatRes 0.15 | 2× Skóra garbowana, 1× Płytka chitynowa |
| Maska z filtrem | head | 2 | gasRes 0.7 | 2× Skóra garbowana, 2× Filtr węglowy, 1× Sztabka mosiądzu, 1× Szkło |
| Maska z kryształowym filtrem | head | 5 | gasRes 0.95 | 1× Soczewka, 2× Pył mroźnej ćmy, 2× Skóra garbowana, 1× Sztabka mosiądzu |
| Strój ze skóry węgorza | body | 4 | waterRes 0.5, armor 2 | 4× Skóra węgorza, 2× Uszczelka, 2× Tkanina jedwabna |
| Hełm nurka | head | 4 | waterRes 1, armor 3 | 3× Sztabka mosiądzu, 2× Szkło, 2× Uszczelka, 1× Zawór ciśnieniowy |
| Futrzany płaszcz | back | 2 | coldRes 0.5 | 3× Futro wyprawione, 1× Skóra garbowana |
| Ocieplany kubrak | body | 5 | coldRes 0.9, armor 3 | 2× Ocieplina, 1× Skóra trolla, 1× Skóra garbowana |
| Pancerz z rdzeniem mrozu | body | 5 | heatRes 0.8, armor 6 | 2× Rdzeń mrozu, 4× Stal niklowa, 1× Ocieplina |
| Szata z łuski salamandry | body | 6 | heatRes 0.95, armor 5 | 3× Skóra łuskowa, 2× Tkanina jedwabna |
| Płaszcz run | back | 7 | dreadRes 0.6 | 3× Tkanina jedwabna, 2× Atrament runiczny, 1× Esencja eteryczna |
| Racja podróżna | consumable | 0 | food 35 | 2× Jagody, 1× Surowe mięso |
| Chleb jęczmienny | consumable | 0 | food 45 | 2× Mąka jęczmienna |
| Pieczeń | consumable | 0 | food 60, mood 4 | 2× Surowe mięso |
| Gulasz grzybowy | consumable | 3 | food 70, mood 3 | 3× Grzyb jadalny, 1× Surowe mięso |
| Pasztet rybny | consumable | 4 | food 80, mood 5 | 2× Ryba jaskiniowa, 1× Mąka jęczmienna, 1× Sól kamienna |
| Krasnoludzka uczta | consumable | 5 | food 100, mood 12 | 2× Pieczeń, 2× Gulasz grzybowy, 1× Pasztet rybny, 2× Sól kamienna |
| Piwo | consumable | 0 | drink 50, mood 3 | 2× Słód |
| Miód jagodowy | consumable | 1 | drink 50, mood 6 | 4× Jagody, 1× Słód |
| Ciemny stout grzybowy | consumable | 3 | drink 60, mood 9 | 3× Grzyb jadalny, 2× Słód, 1× Pasta zarodnikowa |
| Bandaż | consumable | 0 | heal 15 | 1× Płótno |
| Napój leczniczy | consumable | 1 | heal 45 | 2× Mech jaskiniowy, 2× Jagody |
| Antidotum | consumable | 3 | heal 10 | 1× Ekstrakt jadu, 2× Mech jaskiniowy |
| Tonik nocnego wzroku | consumable | 3 | light 4, duration 240 | 1× Pasta zarodnikowa, 1× Błona nietoperza |
| Napój rozgrzewający | consumable | 5 | coldRes 0.6, duration 300 | 1× Tłuszcz trolla, 1× Pasta zarodnikowa |
| Mikstura ognioodporności | consumable | 6 | heatRes 0.6, duration 300 | 1× Esencja ognia, 1× Łuska salamandry |
| Ładunek górniczy | consumable | 3 | damage 60 | 2× Proch górniczy, 1× Płótno, 1× Lina |
| Bomba ogniowa | consumable | 6 | damage 90 | 2× Proch górniczy, 1× Esencja ognia, 1× Obsydian |
| Srebrny pierścień | trinket | 3 | mood 5 | 2× Sztabka srebra |
| Broszka z perłą | trinket | 4 | mood 8 | 1× Perła, 1× Sztabka srebra |
| Amulet szafirowy | trinket | 5 | coldRes 0.3 | 1× Szlifowany szafir, 1× Sztabka srebra |
| Talizman ametystowy | trinket | 5 | dreadRes 0.3 | 1× Szlifowany ametyst, 1× Sztabka złota |
| Amulet rubinowy | trinket | 6 | heatRes 0.3 | 1× Szlifowany rubin, 1× Sztabka złota |
| Amulet lśnitu | trinket | 7 | dreadRes 0.6, light 2 | 1× Sztabka lśnitstali, 1× Szlifowany ametyst, 1× Atrament runiczny |

## Budowle (3 poziomy każda)

### Ognisko obozowe → Kamienne Palenisko → Wielkie Palenisko

Serce grodu. Wyznacza limit mieszkańców, ogrzewa i podnosi morale. Jego poziom otwiera kolejne epoki.

| Poziom | Koszt | Dostępny od warstwy | Efekty |
|---|---|---|---|
| 1. Ognisko obozowe | 10× Kamień, 10× Drewno | 0 | popCap 10, morale 2, radius 6 |
| 2. Kamienne Palenisko | 30× Blok kamienny, 20× Cegła, 10× Sztabka miedzi, 4× Sztabka brązu | 1 | popCap 24, morale 4, radius 9, storage 20 |
| 3. Wielkie Palenisko | 60× Blok kamienny, 10× Sztabka złota, 6× Stal kobaltowa, 4× Szlifowany szafir | 5 | popCap 50, morale 8, radius 12, storage 60 |

### Skład skrzyń → Kamienny skład → Skarbiec

Magazyn na surowce i wyroby. Wyższe poziomy mieszczą więcej i same sortują towary.

| Poziom | Koszt | Dostępny od warstwy | Efekty |
|---|---|---|---|
| 1. Skład skrzyń | 12× Deska | 0 | capacity 80 |
| 2. Kamienny skład | 24× Blok kamienny, 4× Sztabka brązu, 10× Deska | 1 | capacity 240 |
| 3. Skarbiec | 40× Blok kamienny, 8× Stal niklowa, 10× Zębatka | 4 | capacity 700, autosort 1 |

### Legowiska → Izby → Komnaty

Miejsca do spania. Lepsze kwatery = szybsza regeneracja i lepszy nastrój.

| Poziom | Koszt | Dostępny od warstwy | Efekty |
|---|---|---|---|
| 1. Legowiska | 8× Drewno, 10× Włókno | 0 | beds 4, rest 1 |
| 2. Izby | 20× Deska, 8× Płótno, 30× Gwoździe | 1 | beds 6, rest 1.25, mood 1 |
| 3. Komnaty | 30× Blok kamienny, 10× Tkanina jedwabna, 6× Sztabka mosiądzu | 3 | beds 8, rest 1.5, mood 3 |

### Palenisko kuchenne → Kuchnia → Wielka kuchnia

Zamienia surowe jedzenie w posiłki: syci bardziej, psuje się wolniej, poprawia nastrój.

| Poziom | Koszt | Dostępny od warstwy | Efekty |
|---|---|---|---|
| 1. Palenisko kuchenne | 12× Kamień, 8× Glina | 0 | speed 1 |
| 2. Kuchnia | 20× Cegła, 8× Sztabka miedzi | 1 | speed 1.5 |
| 3. Wielka kuchnia | 30× Cegła, 6× Stal niklowa, 6× Szkło | 4 | speed 2.2 |

### Kadź → Browar → Browar mistrzowski

Piwo to dla krasnoluda nie przyjemność, tylko paliwo. Bez niego nastrój leci w dół.

| Poziom | Koszt | Dostępny od warstwy | Efekty |
|---|---|---|---|
| 1. Kadź | 15× Deska, 4× Sztabka miedzi | 0 | speed 1 |
| 2. Browar | 20× Deska, 12× Sztabka miedzi, 4× Rura | 2 | speed 1.6 |
| 3. Browar mistrzowski | 10× Sztabka mosiądzu, 4× Sztabka srebra, 10× Szkło | 3 | speed 2.4 |

### Poletko → Grzybnia → Ogród świetlny

Na powierzchni jęczmień, pod ziemią grzyby, a w końcu świetlne ogrody gdziekolwiek.

| Poziom | Koszt | Dostępny od warstwy | Efekty |
|---|---|---|---|
| 1. Poletko | 6× Drewno, 6× Włókno | 0 | plots 4, surfaceOnly 1 |
| 2. Grzybnia | 12× Płyta grzybowa, 10× Nawóz, 4× Rura | 3 | plots 6 |
| 3. Ogród świetlny | 6× Soczewka, 12× Rura, 6× Szkło hartowane | 5 | plots 10, yield 2 |

### Kozioł stolarski → Stolarnia → Tartak parowy

Drewno w deski i belki, a z nich drabiny, pomosty i meble.

| Poziom | Koszt | Dostępny od warstwy | Efekty |
|---|---|---|---|
| 1. Kozioł stolarski | 10× Drewno, 6× Kamień | 0 | speed 1 |
| 2. Stolarnia | 20× Deska, 6× Sztabka brązu, 20× Gwoździe | 1 | speed 1.6 |
| 3. Tartak parowy | 10× Sztabka stali, 8× Zębatka, 2× Tłok | 4 | speed 3, energia 4 |

### Ława kamieniarska → Kamieniarnia → Szlifiernia mistrzowska

Kamień w bloki, mury i posągi. Bez niej gród zostanie obozowiskiem.

| Poziom | Koszt | Dostępny od warstwy | Efekty |
|---|---|---|---|
| 1. Ława kamieniarska | 15× Kamień, 5× Drewno | 0 | speed 1 |
| 2. Kamieniarnia | 20× Blok kamienny, 8× Sztabka brązu | 1 | speed 1.6 |
| 3. Szlifiernia mistrzowska | 6× Stal kobaltowa, 30× Blok kamienny, 6× Zębatka | 5 | speed 2.6, energia 3 |

### Piec glinany → Wapiennik → Huta szkła

Wypala węgiel drzewny, cegły i smołę, potem wapno, koks i szkło, w końcu szkło hartowane.

| Poziom | Koszt | Dostępny od warstwy | Efekty |
|---|---|---|---|
| 1. Piec glinany | 15× Glina, 10× Kamień | 0 | speed 1 |
| 2. Wapiennik | 30× Cegła, 4× Sztabka brązu | 1 | speed 1.5 |
| 3. Huta szkła | 40× Cegła, 8× Stal niklowa, 10× Kwarc | 5 | speed 2.2, energia 3 |

### Dymarka → Wielki piec → Kuźnia magmowa

Wytapia rudy w sztabki. Dymarka zna tylko miedź i cynę; magmowa kuźnia topi nawet adamant.

| Poziom | Koszt | Dostępny od warstwy | Efekty |
|---|---|---|---|
| 1. Dymarka | 20× Glina, 15× Kamień | 0 | speed 1 |
| 2. Wielki piec | 40× Cegła, 12× Sztabka brązu, 20× Blok kamienny | 2 | speed 1.6, energia 2 |
| 3. Kuźnia magmowa | 30× Obsydian, 12× Stal kobaltowa, 40× Cegła | 6 | speed 2.4, energia 6 |

### Kowadło → Kuźnia → Kuźnia mistrzowska

Kuje narzędzia, broń i pancerze. Każdy poziom otwiera nowe metale.

| Poziom | Koszt | Dostępny od warstwy | Efekty |
|---|---|---|---|
| 1. Kowadło | 10× Kamień, 6× Sztabka miedzi | 0 | speed 1 |
| 2. Kuźnia | 20× Cegła, 10× Sztabka żelaza, 6× Sztabka brązu | 2 | speed 1.5 |
| 3. Kuźnia mistrzowska | 10× Stal kobaltowa, 20× Blok kamienny, 2× Szlifowany szafir | 5 | speed 2.3, energia 3 |

### Warsztat rzemieślnika → Pracownia mechanizmów → Fabryka parowa

Skóry, liny i tkaniny; potem zębatki, rury i sprężyny; w końcu tłoki i zawory maszyn parowych.

| Poziom | Koszt | Dostępny od warstwy | Efekty |
|---|---|---|---|
| 1. Warsztat rzemieślnika | 12× Deska, 6× Kamień | 0 | speed 1 |
| 2. Pracownia mechanizmów | 10× Sztabka żelaza, 6× Sztabka mosiądzu, 10× Deska | 2 | speed 1.5 |
| 3. Fabryka parowa | 12× Stal niklowa, 10× Zębatka, 4× Zawór ciśnieniowy | 4 | speed 2.4, energia 6 |

### Zielarnia → Laboratorium → Laboratorium eteryczne

Nawozy, leki, odtrutki, proch górniczy, esencje i atrament runiczny.

| Poziom | Koszt | Dostępny od warstwy | Efekty |
|---|---|---|---|
| 1. Zielarnia | 10× Deska, 10× Glina, 4× Sztabka miedzi | 1 | speed 1 |
| 2. Laboratorium | 12× Szkło, 8× Sztabka miedzi, 10× Cegła | 3 | speed 1.5 |
| 3. Laboratorium eteryczne | 10× Szkło hartowane, 8× Sztabka srebra, 4× Sztabka złota | 6 | speed 2.2, energia 2 |

### Kącik kronikarza → Biblioteka → Archiwum

Kronikarze spisują wiedzę i prowadzą badania. Bez niej drzewko technologii stoi.

| Poziom | Koszt | Dostępny od warstwy | Efekty |
|---|---|---|---|
| 1. Kącik kronikarza | 10× Deska, 10× Kamień | 0 | research 1, packTier 2 |
| 2. Biblioteka | 30× Blok kamienny, 10× Szkło, 4× Sztabka mosiądzu | 2 | research 1.6, packTier 5 |
| 3. Archiwum | 4× Szlifowany szafir, 8× Sztabka złota, 8× Szkło hartowane, 40× Blok kamienny | 5 | research 2.4, packTier 7 |

### Ćwiczebnia → Koszary → Sala bohaterów

Szkolenie straży: krasnoludy uczą się walki i trzymają tu ekwipunek bojowy.

| Poziom | Koszt | Dostępny od warstwy | Efekty |
|---|---|---|---|
| 1. Ćwiczebnia | 15× Drewno, 10× Kamień, 6× Skóra garbowana | 1 | guards 4, training 1 |
| 2. Koszary | 25× Blok kamienny, 10× Sztabka żelaza, 8× Skóra garbowana | 2 | guards 8, training 1.5 |
| 3. Sala bohaterów | 10× Stal kobaltowa, 6× Sztabka złota, 40× Blok kamienny | 5 | guards 12, training 2.2, morale 3 |

### Balista → Balista powtarzalna → Działo runiczne

Automatyczna obrona korytarzy. Obsługuje ją jeden strażnik.

| Poziom | Koszt | Dostępny od warstwy | Efekty |
|---|---|---|---|
| 1. Balista | 15× Deska, 6× Lina, 4× Sztabka miedzi | 0 | damage 18, range 10, rate 0.5 |
| 2. Balista powtarzalna | 6× Blacha żelazna, 6× Zębatka, 4× Sprężyna | 2 | damage 22, range 12, rate 1.4 |
| 3. Działo runiczne | 4× Sztabka adamantu, 2× Tablica runiczna, 4× Esencja ognia, 2× Mechanizm zegarowy, 30× Blok kamienny | 7 | damage 90, range 16, rate 0.6, vsConstructs 2, energia 3 |

### Pompa ręczna → Pompa tłokowa → Pompa parowa

Odpompowuje wodę i lawę z wyrobisk. Bez pomp Zatopione Głębie pozostaną zatopione.

| Poziom | Koszt | Dostępny od warstwy | Efekty |
|---|---|---|---|
| 1. Pompa ręczna | 10× Deska, 6× Rura, 4× Sztabka brązu | 2 | flow 1 |
| 2. Pompa tłokowa | 8× Blacha żelazna, 8× Zębatka, 10× Rura | 2 | flow 4, energia 3 |
| 3. Pompa parowa | 10× Stal niklowa, 4× Tłok, 4× Zawór ciśnieniowy | 4 | flow 12, lava 1, energia 6 |

### Koło wodne → Maszyna parowa → Turbina magmowa

Energia dla maszyn: koło wodne na podziemnym strumieniu, maszyna parowa, wreszcie turbina na lawie.

| Poziom | Koszt | Dostępny od warstwy | Efekty |
|---|---|---|---|
| 1. Koło wodne | 10× Belka, 20× Deska, 6× Zębatka | 2 | needsWater 1, energia -6 |
| 2. Maszyna parowa | 12× Blacha żelazna, 10× Rura, 2× Tłok, 2× Zawór ciśnieniowy | 4 | fuelPerMin 6, energia -16 |
| 3. Turbina magmowa | 2× Wymiennik ciepła, 12× Stal niklowa, 20× Obsydian | 6 | needsLava 1, energia -45 |

### Kołowrót linowy → Winda zębata → Winda parowa

Pionowy transport ludzi i towarów. W grodzie sięgającym setek kafli w dół to kręgosłup logistyki.

| Poziom | Koszt | Dostępny od warstwy | Efekty |
|---|---|---|---|
| 1. Kołowrót linowy | 8× Belka, 10× Lina, 10× Deska | 1 | speed 1, cargo 4 |
| 2. Winda zębata | 10× Sztabka żelaza, 10× Zębatka, 6× Łańcuch | 2 | speed 2.5, cargo 10, energia 2 |
| 3. Winda parowa | 10× Stal niklowa, 4× Tłok, 10× Łańcuch | 4 | speed 5, cargo 24, energia 5 |

### Zajezdnia → Stacja z dźwigiem → Parowa kolejka

Wagoniki na torach: od pchanych ręcznie po parową kolejkę z automatycznymi trasami.

| Poziom | Koszt | Dostępny od warstwy | Efekty |
|---|---|---|---|
| 1. Zajezdnia | 10× Szyna, 10× Deska, 4× Sztabka żelaza | 2 | carts 2, speed 2 |
| 2. Stacja z dźwigiem | 8× Blacha żelazna, 6× Zębatka, 4× Łańcuch | 3 | carts 4, speed 2.5, autoload 1, energia 2 |
| 3. Parowa kolejka | 8× Stal niklowa, 4× Tłok, 2× Zawór ciśnieniowy | 4 | carts 8, speed 5, routes 1, energia 4 |

### Posłanie zielarza → Lecznica → Sanktuarium

Leczenie ran, zatruć i odmrożeń.

| Poziom | Koszt | Dostępny od warstwy | Efekty |
|---|---|---|---|
| 1. Posłanie zielarza | 10× Deska, 6× Płótno | 1 | heal 1, beds 2 |
| 2. Lecznica | 20× Blok kamienny, 6× Szkło, 2× Sztabka srebra | 3 | heal 2, beds 4 |
| 3. Sanktuarium | 4× Szlifowany ametyst, 4× Sztabka złota, 30× Blok kamienny | 5 | heal 3.5, beds 6, cure 1 |

### Szynk → Karczma → Biesiadna sala

Opowieści, kufle i śpiew. Karczma podnosi morale i ściąga nowych osadników.

| Poziom | Koszt | Dostępny od warstwy | Efekty |
|---|---|---|---|
| 1. Szynk | 15× Deska, 10× Kamień | 1 | morale 2, migrants 1 |
| 2. Karczma | 25× Cegła, 10× Sztabka miedzi, 6× Płótno | 2 | morale 4, migrants 1.5 |
| 3. Biesiadna sala | 6× Sztabka złota, 6× Sztabka srebra, 30× Blok kamienny, 8× Szkło | 4 | morale 7, migrants 2.2 |

### Szlifiernia → Pracownia jubilerska → Runiczny jubiler

Soczewki, szlif klejnotów, pierścienie i amulety chroniące przed żywiołami.

| Poziom | Koszt | Dostępny od warstwy | Efekty |
|---|---|---|---|
| 1. Szlifiernia | 10× Blok kamienny, 6× Sztabka żelaza, 4× Kwarc | 2 | speed 1 |
| 2. Pracownia jubilerska | 8× Sztabka mosiądzu, 6× Szkło, 4× Sztabka srebra | 3 | speed 1.5 |
| 3. Runiczny jubiler | 8× Sztabka złota, 4× Sztabka brązu żarowego, 2× Szlifowany ametyst | 6 | speed 2.2 |

### Kołowrót wiertniczy → Wiertło parowe → Wiertło magmowe

Automatyczne wydobycie złóż w zasięgu, bez krasnoluda przy przodku — jak kopalnia przyszłości.

| Poziom | Koszt | Dostępny od warstwy | Efekty |
|---|---|---|---|
| 1. Kołowrót wiertniczy | 10× Belka, 8× Lina, 6× Sztabka żelaza | 2 | tilesPerMin 0.3, radius 3 |
| 2. Wiertło parowe | 8× Stal niklowa, 2× Tłok, 8× Zębatka | 4 | tilesPerMin 1.2, radius 5, energia 5 |
| 3. Wiertło magmowe | 8× Sztabka brązu żarowego, 2× Wymiennik ciepła, 6× Stal kobaltowa | 6 | tilesPerMin 3, radius 7, energia 12 |

## Infrastruktura

| Nazwa | Koszt | Warstwa | Opis |
|---|---|---|---|
| Drabina | 2× Drewno | 0 | Pozwala wspinać się po pionowych szybach. |
| Pomost | 2× Deska | 0 | Podłoga nad pustką; można po niej chodzić. |
| Pochodnia | 1× Drewno, 1× Żywica | 0 | Ciepłe światło na kilka kafli. Wypala się powoli. |
| Drzwi drewniane | 4× Deska | 0 | Krasnoludy przechodzą, wilki i gobliny muszą je wyważyć. |
| Schody | 2× Blok kamienny | 1 | Szybsze od drabiny przejście między poziomami. |
| Zsyp | 2× Deska | 1 | Towary spadają nim w dół szybu prosto do magazynu. |
| Kosz żarowy | 1× Sztabka miedzi, 3× Kamień | 1 | Mocne światło i ciepło; pali węgiel. |
| Stempel drewniany | 3× Drewno | 1 | Podpiera strop i zapobiega zawałom. |
| Filar kamienny | 3× Blok kamienny, 2× Zaprawa | 1 | Trwała podpora szerokich hal. |
| Mur kamienny | 2× Blok kamienny | 1 | Zamyka przejścia i chroni przed zalaniem. |
| Pułapka z kolcami | 2× Deska, 1× Sztabka miedzi | 1 | Rani wrogów przechodzących przez kafel. |
| Sztandar | 2× Płótno, 1× Deska | 1 | Podnosi nastrój w pomieszczeniu. |
| Posąg | 6× Blok kamienny | 1 | Piękno, które krasnoludy doceniają. |
| Drzwi żelazne | 2× Blacha żelazna | 2 | Wytrzymuje szturm trolla. |
| Gródź | 2× Blacha żelazna, 2× Smoła | 2 | Wodoszczelne drzwi przeciw zalaniom i lawie. |
| Kratownica żelazna | 2× Sztabka żelaza, 1× Belka | 2 | Podpora dla wielkich kawern. |
| Latarnia olejna | 1× Sztabka brązu, 1× Szkło | 2 | Jasne światło; pali smołę lub olej. |
| Tory | 1× Szyna | 2 | Droga dla wagoników. |
| Rurociąg | 1× Rura | 2 | Prowadzi wodę, parę i lawę. |
| Szyb wentylacyjny | 4× Deska, 1× Zębatka | 3 | Wyciąga zarodniki i opary z wyrobisk. |
| Kocioł grzewczy | 2× Sztabka mosiądzu, 2× Rura | 4 | Ogrzewa pomieszczenie parą lub węglem. |
| Przenośnik łańcuchowy | 2× Łańcuch, 1× Zębatka | 4 | Automatycznie przenosi towary (wymaga energii). |
| Pułapka ostrzowa | 2× Sztabka stali, 1× Sprężyna | 4 | Ciężkie ostrza na sprężynach. |
| Latarnia kryształowa | 1× Soczewka, 1× Sztabka mosiądzu | 5 | Świeci bez paliwa, chłodnym blaskiem. |
| Chłodnica | 1× Rdzeń mrozu, 1× Stal niklowa | 5 | Mroźny rdzeń chłodzi pomieszczenia w Pasie Magmy. |
| Mur obsydianowy | 3× Obsydian, 1× Zaprawa | 6 | Lawa się o niego rozbija. |
| Latarnia lśnitu | 1× Sztabka lśnitstali, 1× Soczewka | 7 | Światło, którego nie pożera prastary mrok. |
| Kamień ochronny | 1× Tablica runiczna, 2× Blok kamienny | 7 | Runy odpędzające grozę w promieniu kilku kafli. |

## Drzewko technologii

Węzły są ukryte („???”), dopóki gracz nie odkryje surowca z kolumny „Ujawnia”; liczba ukrytych węzłów jest zawsze widoczna.

### Poziom 0 — Podgórze (12 węzłów)

| Badanie | Koszt | Wymaga | Ujawnia | Odblokowuje |
|---|---|---|---|---|
| **Rzemiosło obozowe** — Liny, płótno i bandaże z włókna roślinnego. | 4× Notatki górnicze | — | od startu | Warsztat rzemieślnika, Lina, Płótno, Bandaż |
| **Kamieniarstwo** — Ciosanie kamienia w bloki. | 4× Notatki górnicze | — | od startu | Ława kamieniarska, Blok kamienny |
| **Wypał w glinie** — Węgiel drzewny, cegły i smoła z prostego pieca. | 4× Notatki górnicze | — | Glina | Piec glinany, Węgiel drzewny, Cegła, Smoła |
| **Łowiectwo** — Garbowanie skór i pierwsze ubrania. | 4× Notatki górnicze, 2× Kieł | Rzemiosło obozowe | Skóra surowa | Skóra garbowana, Skórzany kaptur, Skórznia, Skórzane buty, Skórzane rękawice, Skórzany plecak |
| **Pismo** — Pergamin i atrament — wiedza, która przetrwa krasnoluda. | 4× Notatki górnicze | Rzemiosło obozowe | Skóra surowa | Pergamin, Atrament |
| **Gotowanie** — Racje, pieczenie i chleb. | 4× Notatki górnicze | — | Jęczmień, Surowe mięso | Palenisko kuchenne, Racja podróżna, Pieczeń, Mąka jęczmienna, Chleb jęczmienny |
| **Warzenie** — Słód i piwo — krasnoludzkie paliwo. | 4× Notatki górnicze | Gotowanie | Jęczmień | Kadź, Słód, Piwo |
| **Wytop miedzi** — Dymarka i pierwszy metal. | 8× Notatki górnicze | Wypał w glinie | Ruda miedzi | Dymarka, Sztabka miedzi |
| **Kowalstwo** — Kowadło: miedziane kilofy i topory. | 8× Notatki górnicze | Wytop miedzi | Ruda miedzi | Kowadło, Kilof miedziany, Miedziany topór bojowy |
| **Kaganki** — Przenośne światło i lina z hakiem. | 4× Notatki górnicze | Kowalstwo | Ruda miedzi | Kaganek, Lina z hakiem, Drzwi drewniane |
| **Balista** — Pierwsza obrona przed nocą i goblinami. | 8× Notatki górnicze | Kowalstwo, Rzemiosło obozowe | Ruda miedzi | Balista |
| **Miernictwo** — Mapy nowej warstwy z próbek węgla i wapienia — klucz do badań Wapiennych Progów. | 8× Notatki górnicze | Pismo | Węgiel, Wapień | Mapy mierniczego |

### Poziom 1 — Wapienne Progi (19 węzłów)

| Badanie | Koszt | Wymaga | Ujawnia | Odblokowuje |
|---|---|---|---|---|
| **Kamienne Palenisko** — Gród przestaje być obozem. Wymaga trofeum Wilczego Herszta. | 14× Mapy mierniczego, 8× Notatki górnicze, 1× Futro Wilczego Herszta | Kamieniarstwo, Wytop miedzi | Węgiel, Wapień | Kamienne Palenisko |
| **Wytop cyny** — Cyna i wytop na węglu kamiennym. | 5× Mapy mierniczego, 3× Notatki górnicze | Wytop miedzi | Ruda cyny | Sztabka cyny |
| **Węgiel kamienny** — Kosze żarowe, zsypy i wytop na węglu. | 5× Mapy mierniczego, 3× Notatki górnicze | Wytop miedzi | Węgiel | Sztabka miedzi, Kosz żarowy, Zsyp |
| **Epoka brązu** — Brąz: kilof, który kruszy granit. | 14× Mapy mierniczego, 8× Notatki górnicze | Wytop cyny, Kowalstwo | Ruda cyny | Sztabka brązu, Kilof brązowy, Brązowy topór bojowy, Brązowa siekiera, Brązowy młot budowniczego, Hełm brązowy |
| **Wypał wapna** — Wapno palone i zaprawa; kamienne filary. | 9× Mapy mierniczego, 5× Notatki górnicze | Wypał w glinie, Kamieniarstwo | Wapień | Wapiennik, Wapno palone, Zaprawa, Filar kamienny |
| **Obudowa górnicza** — Stemple, mury i schody — koniec z zawałami. | 5× Mapy mierniczego, 3× Notatki górnicze | Kamieniarstwo | Wapień, Węgiel | Stempel drewniany, Mur kamienny, Schody |
| **Kamieniarnia** — Większa wydajność i posągi. | 9× Mapy mierniczego, 5× Notatki górnicze | Kamieniarstwo, Epoka brązu | Wapień | Kamieniarnia, Posąg |
| **Stolarnia** — Szybsza obróbka drewna. | 9× Mapy mierniczego, 5× Notatki górnicze | Epoka brązu | Ruda cyny | Stolarnia |
| **Ciągnienie drutu** — Drut, gwoździe i miedziana różdżka do szukania rud. | 5× Mapy mierniczego, 3× Notatki górnicze | Kowalstwo | Węgiel, Ruda cyny | Drut miedziany, Gwoździe, Miedziana różdżka |
| **Kusze** — Broń dystansowa i bełty. | 9× Mapy mierniczego, 5× Notatki górnicze | Epoka brązu, Stolarnia | Pióro, Ruda cyny | Kusza drewniana, Bełty |
| **Zielarstwo** — Zielarnia: klej, nawóz i napój leczniczy. | 5× Mapy mierniczego, 3× Notatki górnicze | Gotowanie | Mech jaskiniowy, Guano | Zielarnia, Klej kostny, Nawóz, Napój leczniczy |
| **Izby i składy** — Prawdziwe łóżka i kamienne magazyny. | 9× Mapy mierniczego, 5× Notatki górnicze | Ciągnienie drutu, Kamieniarstwo | Węgiel | Izby, Kamienny skład |
| **Kuchnia** — Lepsza kuchnia i miód jagodowy. | 5× Mapy mierniczego, 3× Notatki górnicze | Gotowanie, Warzenie | Węgiel | Kuchnia, Miód jagodowy |
| **Straż grodu** — Ćwiczebnia, pułapki i sztandary. | 9× Mapy mierniczego, 5× Notatki górnicze | Balista, Łowiectwo | Kieł, Węgiel | Ćwiczebnia, Pułapka z kolcami, Sztandar |
| **Uzdrowiciele** — Posłanie zielarza dla rannych. | 5× Mapy mierniczego, 3× Notatki górnicze | Zielarstwo | Mech jaskiniowy | Posłanie zielarza |
| **Szynk** — Miejsce, gdzie krasnolud odpoczywa przy kuflu. | 5× Mapy mierniczego, 3× Notatki górnicze | Warzenie | Węgiel | Szynk |
| **Kołowrót** — Pierwsza winda: towary w górę i w dół szybu. | 9× Mapy mierniczego, 5× Notatki górnicze | Obudowa górnicza | Węgiel | Kołowrót linowy |
| **Latarnie smolne** — Jaśniejsze, mocniejsze światło na ramieniu. | 5× Mapy mierniczego, 3× Notatki górnicze | Kaganki, Epoka brązu | Węgiel | Latarnia smolna |
| **Kreślarstwo** — Plany inżyniera z próbek rudy żelaza — klucz do badań granitu. | 9× Mapy mierniczego, 5× Notatki górnicze | Miernictwo, Epoka brązu | Ruda żelaza | Plany inżyniera |

### Poziom 2 — Granitowe Korzenie (26 węzłów)

| Badanie | Koszt | Wymaga | Ujawnia | Odblokowuje |
|---|---|---|---|---|
| **Koksownia** — Koks: czystsze i gorętsze paliwo. | 6× Plany inżyniera, 4× Mapy mierniczego | Wypał wapna | Ruda żelaza | Koks |
| **Wielki piec** — Żelazo. Wymaga Serca Królowej Nietoperzy do miechów. | 17× Plany inżyniera, 10× Mapy mierniczego, 1× Serce Królowej Nietoperzy | Koksownia, Epoka brązu | Ruda żelaza | Wielki piec, Sztabka żelaza |
| **Kuźnia** — Blachy, łańcuchy i młot bojowy. | 11× Plany inżyniera, 7× Mapy mierniczego | Wielki piec | Ruda żelaza | Kuźnia, Blacha żelazna, Łańcuch, Żelazny młot bojowy |
| **Stal** — Stalowe kilofy, siekiery i młoty budowniczego. | 17× Plany inżyniera, 10× Mapy mierniczego | Wielki piec | Ruda żelaza | Sztabka stali, Kilof żelazny, Kilof stalowy, Stalowy topór drwala, Stalowy młot budowniczego |
| **Uzbrojenie stalowe** — Stalowe topory, tarcze, hełmy i kolczugi. | 11× Plany inżyniera, 7× Mapy mierniczego | Stal, Kuźnia | Ruda żelaza | Stalowy topór bojowy, Tarcza stalowa, Hełm stalowy, Kolczuga, Bełty przebijające |
| **Ołów i rury** — Rury z ołowiu i rurociągi. | 6× Plany inżyniera, 4× Mapy mierniczego | Wytop miedzi | Galena | Sztabka ołowiu, Rura, Rurociąg |
| **Mosiądz** — Cynk i mosiądz na mechanizmy. | 11× Plany inżyniera, 7× Mapy mierniczego | Wielki piec | Sfaleryt | Sztabka cynku, Sztabka mosiądzu |
| **Szkło** — Szkło z piasku i kwarcu; latarnie olejne. | 11× Plany inżyniera, 7× Mapy mierniczego | Wypał wapna | Kwarc, Piasek | Szkło, Latarnia olejna |
| **Mechanizmy** — Zębatki i sprężyny; pracownia mechanizmów. | 11× Plany inżyniera, 7× Mapy mierniczego | Mosiądz, Kuźnia | Sfaleryt | Pracownia mechanizmów, Zębatka, Sprężyna |
| **Pompy** — Pompy ręczne i tłokowe, grodzie przeciw zalaniom. | 11× Plany inżyniera, 7× Mapy mierniczego | Ołów i rury, Mechanizmy | Galena, Ruda żelaza | Pompa ręczna, Pompa tłokowa, Gródź |
| **Koło wodne** — Pierwsza energia z podziemnego strumienia. | 11× Plany inżyniera, 7× Mapy mierniczego | Mechanizmy | Sfaleryt | Koło wodne |
| **Winda zębata** — Szybsza winda napędzana kołem wodnym. | 11× Plany inżyniera, 7× Mapy mierniczego | Mechanizmy, Kołowrót | Sfaleryt | Winda zębata |
| **Kolej kopalniana** — Szyny, tory i zajezdnia wagoników. | 11× Plany inżyniera, 7× Mapy mierniczego | Kuźnia | Ruda żelaza | Zajezdnia, Szyna, Tory |
| **Wiertnictwo** — Kołowrót wiertniczy wydobywa złoża bez krasnoluda. | 11× Plany inżyniera, 7× Mapy mierniczego | Mechanizmy, Kolej kopalniana | Ruda żelaza | Kołowrót wiertniczy |
| **Kratownice** — Żelazne podpory i drzwi. | 6× Plany inżyniera, 4× Mapy mierniczego | Kuźnia | Ruda żelaza | Kratownica żelazna, Drzwi żelazne |
| **Biblioteka** — Szybsze badania i kodeksy wyższych warstw. | 11× Plany inżyniera, 7× Mapy mierniczego | Szkło, Mosiądz | Kwarc | Biblioteka |
| **Szlifiernia** — Szlifowanie kwarcu. | 6× Plany inżyniera, 4× Mapy mierniczego | Szkło, Kuźnia | Kwarc | Szlifiernia |
| **Chityna** — Lekkie pancerze z chityny pełzaczy. | 6× Plany inżyniera, 4× Mapy mierniczego | Zielarstwo | Chityna | Płytka chitynowa, Kamizela chitynowa, Rękawice kowalskie |
| **Kuśnierstwo** — Wyprawione futra i ciepłe płaszcze. | 6× Plany inżyniera, 4× Mapy mierniczego | Wypał wapna, Łowiectwo | Futro | Futro wyprawione, Futrzany płaszcz |
| **Maski z filtrem** — Węglowe filtry chroniące przed zarodnikami. | 11× Plany inżyniera, 7× Mapy mierniczego | Szkło, Mosiądz | Świecące zarodniki | Filtr węglowy, Maska z filtrem |
| **Poszukiwania** — Sonda, plecak z ramą, okute buty i raki. | 11× Plany inżyniera, 7× Mapy mierniczego | Mosiądz, Stal | Sfaleryt, Kwas pełzacza | Mosiężna sonda, Plecak z ramą, Okute buty, Stalowe raki |
| **Koszary** — Koszary i stalowe kusze. | 11× Plany inżyniera, 7× Mapy mierniczego | Uzbrojenie stalowe, Straż grodu | Ruda żelaza | Koszary, Kusza stalowa |
| **Balista powtarzalna** — Szybkostrzelna obrona korytarzy. | 11× Plany inżyniera, 7× Mapy mierniczego | Mechanizmy | Sfaleryt | Balista powtarzalna |
| **Browar** — Większy browar z rurociągiem. | 6× Plany inżyniera, 4× Mapy mierniczego | Ołów i rury | Galena | Browar |
| **Karczma** — Prawdziwa karczma przyciąga osadników. | 6× Plany inżyniera, 4× Mapy mierniczego | Szynk, Kuźnia | Ruda żelaza | Karczma |
| **Kodeksy alchemiczne** — Próbki jadu i zarodników — klucz do badań grot. | 11× Plany inżyniera, 7× Mapy mierniczego | Kreślarstwo, Szkło | Gruczoł jadowy, Świecące zarodniki | Kodeks alchemiczny |

### Poziom 3 — Grzybowe Groty (14 węzłów)

| Badanie | Koszt | Wymaga | Ujawnia | Odblokowuje |
|---|---|---|---|---|
| **Drewno grzybowe** — Płyty z olbrzymich grzybów — drewno głębin. | 7× Kodeks alchemiczny, 4× Plany inżyniera | Stolarnia | Drewno grzybowe | Płyta grzybowa |
| **Grzybnie** — Uprawy pod ziemią. Wymaga pancerza Matki Pełzaczy na skrzynie. | 20× Kodeks alchemiczny, 12× Plany inżyniera, 1× Pancerz Matki Pełzaczy | Zielarstwo, Drewno grzybowe | Grzyb jadalny | Grzybnia, Grzyb jadalny, Świecące zarodniki |
| **Laboratorium** — Ekstrakty jadu i pasta zarodnikowa. | 13× Kodeks alchemiczny, 8× Plany inżyniera | Zielarstwo, Szkło | Gruczoł jadowy | Laboratorium, Ekstrakt jadu, Pasta zarodnikowa |
| **Odtrutki** — Antidotum i tonik nocnego wzroku. | 7× Kodeks alchemiczny, 4× Plany inżyniera | Laboratorium | Gruczoł jadowy | Antidotum, Tonik nocnego wzroku |
| **Tkactwo jedwabiu** — Jedwabna tkanina i lina. | 13× Kodeks alchemiczny, 8× Plany inżyniera | Rzemiosło obozowe | Jedwab pajęczy | Tkanina jedwabna, Lina jedwabna |
| **Proch górniczy** — Ładunki kruszące skałę w promieniu. | 13× Kodeks alchemiczny, 8× Plany inżyniera | Laboratorium | Siarka | Proch górniczy, Ładunek górniczy |
| **Srebro** — Srebrne sztabki, jubiler i pierścienie. | 13× Kodeks alchemiczny, 8× Plany inżyniera | Wielki piec, Szlifiernia | Ruda srebra | Pracownia jubilerska, Sztabka srebra, Srebrny pierścień |
| **Wentylacja** — Szyby wyciągające zarodniki. | 7× Kodeks alchemiczny, 4× Plany inżyniera | Mechanizmy | Świecące zarodniki | Szyb wentylacyjny |
| **Komnaty** — Jedwab i mosiądz w sypialniach. | 7× Kodeks alchemiczny, 4× Plany inżyniera | Tkactwo jedwabiu, Izby i składy | Jedwab pajęczy | Komnaty |
| **Browar mistrzowski** — Ciemny stout grzybowy. | 13× Kodeks alchemiczny, 8× Plany inżyniera | Browar, Srebro | Grzyb jadalny | Browar mistrzowski, Ciemny stout grzybowy |
| **Kuchnia grzybowa** — Gulasz grzybowy. | 7× Kodeks alchemiczny, 4× Plany inżyniera | Kuchnia | Grzyb jadalny | Gulasz grzybowy |
| **Lecznica** — Lecznica ze srebrnymi narzędziami. | 7× Kodeks alchemiczny, 4× Plany inżyniera | Uzdrowiciele, Srebro | Ruda srebra | Lecznica |
| **Stacja z dźwigiem** — Automatyczny załadunek wagoników. | 13× Kodeks alchemiczny, 8× Plany inżyniera | Kolej kopalniana, Mechanizmy | Drewno grzybowe | Stacja z dźwigiem |
| **Traktaty hydrauliczne** — Próbki pereł i skór węgorzy — klucz do badań zatopionych głębi. | 13× Kodeks alchemiczny, 8× Plany inżyniera | Kodeksy alchemiczne, Pompy | Perła, Skóra węgorza | Traktat hydrauliczny |

### Poziom 4 — Zatopione Głębie (18 węzłów)

| Badanie | Koszt | Wymaga | Ujawnia | Odblokowuje |
|---|---|---|---|---|
| **Uszczelnienia** — Uszczelki i zawory. Wymaga jedwabiu Królowej Pajęczyn. | 23× Traktat hydrauliczny, 14× Kodeks alchemiczny, 1× Jedwab Królowej Pajęczyn | Mechanizmy, Tkactwo jedwabiu | Skóra węgorza | Uszczelka, Zawór ciśnieniowy |
| **Nurkowanie** — Strój ze skóry węgorza i hełm nurka. | 16× Traktat hydrauliczny, 10× Kodeks alchemiczny | Uszczelnienia, Szkło | Skóra węgorza | Strój ze skóry węgorza, Hełm nurka |
| **Nikiel** — Stal niklowa odporna na wilgoć i parę. | 16× Traktat hydrauliczny, 10× Kodeks alchemiczny | Stal | Ruda niklu | Sztabka niklu, Stal niklowa |
| **Rybołówstwo** — Wędka, olej rybi, pasztet i zupa z wodorostów. | 8× Traktat hydrauliczny, 5× Kodeks alchemiczny | Kuchnia grzybowa, Tkactwo jedwabiu | Ryba jaskiniowa, Wodorost jaskiniowy | Wędka z jedwabną żyłką, Olej rybi, Pasztet rybny, Gulasz grzybowy |
| **Fabryka parowa** — Tłoki i maszyny na parę. | 23× Traktat hydrauliczny, 14× Kodeks alchemiczny | Nikiel, Uszczelnienia, Rybołówstwo | Ruda niklu | Fabryka parowa, Tłok |
| **Maszyna parowa** — Energia z węgla i wody — wszędzie, nie tylko przy strumieniu. | 23× Traktat hydrauliczny, 14× Kodeks alchemiczny | Fabryka parowa, Koło wodne | Ruda niklu | Maszyna parowa |
| **Pompa parowa** — Osusza całe zatopione kawerny. | 16× Traktat hydrauliczny, 10× Kodeks alchemiczny | Maszyna parowa, Pompy | Ruda niklu | Pompa parowa |
| **Winda parowa** — Kręgosłup głębokiego grodu. | 16× Traktat hydrauliczny, 10× Kodeks alchemiczny | Maszyna parowa, Winda zębata | Ruda niklu | Winda parowa |
| **Parowa kolejka** — Automatyczne trasy wagoników. | 16× Traktat hydrauliczny, 10× Kodeks alchemiczny | Maszyna parowa, Stacja z dźwigiem | Ruda niklu | Parowa kolejka |
| **Wiertło parowe** — Szybkie wydobycie bez górników. | 16× Traktat hydrauliczny, 10× Kodeks alchemiczny | Maszyna parowa, Wiertnictwo | Ruda niklu | Wiertło parowe |
| **Tartak parowy** — Masowa produkcja desek i płyt grzybowych. | 8× Traktat hydrauliczny, 5× Kodeks alchemiczny | Fabryka parowa, Drewno grzybowe | Ruda niklu | Tartak parowy, Deska, Płyta grzybowa |
| **Skarbiec** — Ogromny magazyn z automatycznym sortowaniem. | 16× Traktat hydrauliczny, 10× Kodeks alchemiczny | Nikiel, Mechanizmy | Ruda niklu | Skarbiec |
| **Wielka kuchnia** — Kuchnia ze stali niklowej i krasnoludzka uczta. | 16× Traktat hydrauliczny, 10× Kodeks alchemiczny | Nikiel, Rybołówstwo | Sól kamienna | Wielka kuchnia, Krasnoludzka uczta |
| **Złoto** — Złote sztabki i broszki z pereł. | 16× Traktat hydrauliczny, 10× Kodeks alchemiczny | Srebro | Ruda złota | Sztabka złota, Broszka z perłą |
| **Zbroja płytowa** — Pełna zbroja, nosidło parowe i kusza powtarzalna. | 16× Traktat hydrauliczny, 10× Kodeks alchemiczny | Fabryka parowa, Uzbrojenie stalowe | Ruda niklu | Zbroja płytowa, Nosidło parowe, Kusza powtarzalna |
| **Ogrzewanie i przenośniki** — Kotły grzewcze, przenośniki łańcuchowe i pułapki ostrzowe. | 16× Traktat hydrauliczny, 10× Kodeks alchemiczny | Fabryka parowa | Ruda niklu | Kocioł grzewczy, Przenośnik łańcuchowy, Pułapka ostrzowa |
| **Biesiadna sala** — Złoto i srebro w największej karczmie. | 16× Traktat hydrauliczny, 10× Kodeks alchemiczny | Złoto, Karczma | Ruda złota | Biesiadna sala |
| **Kryształowe tabliczki** — Próbki mroźnych kryształów i ametystu — klucz do badań głębi kryształów. | 16× Traktat hydrauliczny, 10× Kodeks alchemiczny | Traktaty hydrauliczne, Srebro | Mroźny kryształ, Ametyst | Kryształowa tabliczka |

### Poziom 5 — Kryształowe Głębie (17 węzłów)

| Badanie | Koszt | Wymaga | Ujawnia | Odblokowuje |
|---|---|---|---|---|
| **Optyka** — Soczewki i latarnie kryształowe bez paliwa. | 18× Kryształowa tabliczka, 11× Traktat hydrauliczny | Szlifiernia | Mroźny kryształ, Odłamek golema | Soczewka, Latarnia kryształowa |
| **Szlif klejnotów** — Ametysty i szafiry. Wymaga łuski Lewiatana do tarczy szlifierskiej. | 27× Kryształowa tabliczka, 16× Traktat hydrauliczny, 1× Łuska Lewiatana | Srebro, Optyka | Ametyst, Szafir | Szlifowany ametyst, Szlifowany szafir |
| **Kobalt** — Stal kobaltowa — twardsza niż wszystko dotąd. | 18× Kryształowa tabliczka, 11× Traktat hydrauliczny | Nikiel, Maszyna parowa | Ruda kobaltu | Sztabka kobaltu, Stal kobaltowa |
| **Kuźnia mistrzowska** — Kobaltowe kilofy i topory — przebiją obsydian. | 27× Kryształowa tabliczka, 16× Traktat hydrauliczny | Kobalt, Szlif klejnotów | Ruda kobaltu | Kuźnia mistrzowska, Kilof kobaltowy, Kobaltowy topór bojowy |
| **Alchemia mrozu** — Rdzenie mrozu, napój rozgrzewający i chłodnice. | 18× Kryształowa tabliczka, 11× Traktat hydrauliczny | Laboratorium | Mroźny kryształ, Pył mroźnej ćmy | Rdzeń mrozu, Napój rozgrzewający, Chłodnica |
| **Ocieplenie** — Ocieplina i kubrak przeciw mrozowi. | 18× Kryształowa tabliczka, 11× Traktat hydrauliczny | Kuśnierstwo, Tkactwo jedwabiu | Mroźny kryształ, Skóra trolla | Ocieplina, Ocieplany kubrak |
| **Pancerz mrozu** — Chłód kryształów jako tarcza przed żarem głębin. | 18× Kryształowa tabliczka, 11× Traktat hydrauliczny | Alchemia mrozu, Fabryka parowa | Mroźny kryształ | Pancerz z rdzeniem mrozu |
| **Lampy kryształowe** — Lampa, wykrywacz złóż i maska z kryształowym filtrem. | 18× Kryształowa tabliczka, 11× Traktat hydrauliczny | Optyka, Szlif klejnotów | Odłamek golema | Lampa kryształowa, Kryształowy wykrywacz, Maska z kryształowym filtrem |
| **Wielkie Palenisko** — Trzecia epoka grodu: limit mieszkańców 50. | 27× Kryształowa tabliczka, 16× Traktat hydrauliczny | Szlif klejnotów, Kobalt, Kamienne Palenisko | Szafir | Wielkie Palenisko |
| **Archiwum** — Najszybsze badania i kodeksy najgłębszych warstw. | 18× Kryształowa tabliczka, 11× Traktat hydrauliczny | Szlif klejnotów, Biblioteka | Szafir | Archiwum |
| **Huta szkła** — Szkło hartowane. | 18× Kryształowa tabliczka, 11× Traktat hydrauliczny | Optyka, Nikiel | Mroźny kryształ | Huta szkła, Szkło hartowane |
| **Ogród świetlny** — Uprawy w każdej głębi pod sztucznym słońcem. | 18× Kryształowa tabliczka, 11× Traktat hydrauliczny | Huta szkła, Grzybnie | Mroźny kryształ | Ogród świetlny, Jęczmień |
| **Szlifiernia mistrzowska** — Masowa produkcja bloków. | 9× Kryształowa tabliczka, 5× Traktat hydrauliczny | Kobalt, Kamieniarnia | Ruda kobaltu | Szlifiernia mistrzowska, Blok kamienny |
| **Sala bohaterów** — Elitarna straż. | 18× Kryształowa tabliczka, 11× Traktat hydrauliczny | Kuźnia mistrzowska, Koszary | Ruda kobaltu | Sala bohaterów |
| **Sanktuarium** — Leczy nawet najcięższe rany. | 9× Kryształowa tabliczka, 5× Traktat hydrauliczny | Szlif klejnotów, Lecznica | Ametyst | Sanktuarium |
| **Amulety** — Amulet szafirowy i talizman ametystowy. | 9× Kryształowa tabliczka, 5× Traktat hydrauliczny | Szlif klejnotów, Złoto | Szafir, Ametyst | Amulet szafirowy, Talizman ametystowy |
| **Ogniste kodeksy** — Próbki obsydianu i rubinów — klucz do badań Pasa Magmy. | 18× Kryształowa tabliczka, 11× Traktat hydrauliczny | Kryształowe tabliczki, Huta szkła | Obsydian, Rubin | Ognisty kodeks |

### Poziom 6 — Pas Magmy (10 węzłów)

| Badanie | Koszt | Wymaga | Ujawnia | Odblokowuje |
|---|---|---|---|---|
| **Kuźnia magmowa** — Lawa zamiast węgla; brąz żarowy. Wymaga Rdzenia Kolosa. | 32× Ognisty kodeks, 19× Kryształowa tabliczka, 1× Rdzeń Kolosa | Kobalt, Alchemia mrozu | Ruda żarytu | Kuźnia magmowa, Sztabka brązu żarowego |
| **Narzędzia żarowe** — Kilof żarowy i żarowy młot. | 22× Ognisty kodeks, 13× Kryształowa tabliczka | Kuźnia magmowa, Alchemia ognia | Ruda żarytu | Kilof żarowy, Żarowy młot |
| **Obsydian** — Ostrza, włócznie i mury obsydianowe. | 22× Ognisty kodeks, 13× Kryształowa tabliczka | Kuźnia mistrzowska | Obsydian | Ostrze obsydianowe, Włócznia obsydianowa, Mur obsydianowy |
| **Alchemia ognia** — Esencja ognia, ognioodporność, bomby i bełty ogniste. | 22× Ognisty kodeks, 13× Kryształowa tabliczka | Laboratorium, Proch górniczy | Gruczoł ognisty | Laboratorium eteryczne, Esencja ognia, Mikstura ognioodporności, Bomba ogniowa, Bełty ogniste |
| **Garbowanie łusek** — Skóra łuskowa i szata z łuski salamandry. | 22× Ognisty kodeks, 13× Kryształowa tabliczka | Fabryka parowa, Łowiectwo | Łuska salamandry | Skóra łuskowa, Szata z łuski salamandry |
| **Wymienniki ciepła** — Mróz kryształów okiełznuje żar lawy. | 22× Ognisty kodeks, 13× Kryształowa tabliczka | Alchemia mrozu, Fabryka parowa | Rdzeń magmowy, Obsydian | Wymiennik ciepła |
| **Turbina magmowa** — Ogromna energia z lawy. | 32× Ognisty kodeks, 19× Kryształowa tabliczka | Wymienniki ciepła, Maszyna parowa | Rdzeń magmowy | Turbina magmowa |
| **Wiertło magmowe** — Najszybsze automatyczne wydobycie. | 22× Ognisty kodeks, 13× Kryształowa tabliczka | Wymienniki ciepła, Kuźnia magmowa, Wiertło parowe | Rdzeń magmowy | Wiertło magmowe |
| **Rubiny** — Szlif rubinów, amulet rubinowy, runiczny jubiler. | 22× Ognisty kodeks, 13× Kryształowa tabliczka | Szlif klejnotów, Kuźnia magmowa | Rubin | Runiczny jubiler, Szlifowany rubin, Amulet rubinowy |
| **Księgi run** — Próbki runokamienia i pyłu runicznego — klucz do badań prastarych głębin. | 22× Ognisty kodeks, 13× Kryształowa tabliczka | Ogniste kodeksy, Archiwum | Runokamień, Pył runiczny | Księga run |

### Poziom 7 — Prastare Głębiny (11 węzłów)

| Badanie | Koszt | Wymaga | Ujawnia | Odblokowuje |
|---|---|---|---|---|
| **Esencja eteryczna** — To, z czego zbudowane są upiory. Wymaga Serca Robaka Magmowego. | 38× Księga run, 23× Ognisty kodeks, 1× Serce Robaka Magmowego | Alchemia ognia | Ektoplazma | Esencja eteryczna |
| **Atrament runiczny** — Pył runiczny w atramencie. | 25× Księga run, 15× Ognisty kodeks | Laboratorium, Pismo | Pył runiczny | Atrament runiczny |
| **Tablice runiczne** — Tablice i kamienie ochronne odpędzające grozę. | 38× Księga run, 23× Ognisty kodeks | Atrament runiczny, Szlifiernia mistrzowska | Runokamień | Tablica runiczna, Kamień ochronny |
| **Adamant** — Najtwardszy metal świata, wytapiany na rdzeniach magmy. | 38× Księga run, 23× Ognisty kodeks | Kuźnia magmowa | Ruda adamantytu | Sztabka adamantu |
| **Oręż adamantowy** — Kilof, topór, hełm i zbroja z adamantu. | 38× Księga run, 23× Ognisty kodeks | Adamant, Garbowanie łusek, Ocieplenie | Ruda adamantytu | Kilof adamantowy, Adamantowy topór bojowy, Hełm adamantowy, Zbroja adamantowa |
| **Lśnitstal** — Metal, który świeci — mrok go nie pożera. | 38× Księga run, 23× Ognisty kodeks | Esencja eteryczna, Adamant | Ruda lśnitu | Sztabka lśnitstali, Latarnia lśnitu |
| **Dzieła z lśnitu** — Lśniący kilof, lampa i amulet lśnitu. | 38× Księga run, 23× Ognisty kodeks | Lśnitstal, Rubiny, Atrament runiczny | Ruda lśnitu | Lśniący kilof, Lampa lśnitowa, Amulet lśnitu |
| **Mechanizmy zegarowe** — Odtworzone mechanizmy prastarych. | 25× Księga run, 15× Ognisty kodeks | Mechanizmy | Prastary tryb | Mechanizm zegarowy |
| **Oręż runiczny** — Runiczny młot, tarcza i płaszcz run. | 38× Księga run, 23× Ognisty kodeks | Tablice runiczne, Adamant, Esencja eteryczna | Runokamień | Runiczny młot, Tarcza runiczna, Płaszcz run |
| **Działo runiczne** — Obrona, która rozbija konstrukty. | 38× Księga run, 23× Ognisty kodeks | Tablice runiczne, Mechanizmy zegarowe, Alchemia ognia | Prastary tryb | Działo runiczne |
| **Klucz Serca** — Pieczęć Strażnika, relikwie, adamant i lśnitstal otwierają Serce Góry. | 38× Księga run, 23× Ognisty kodeks | Lśnitstal, Tablice runiczne, Wielkie Palenisko | Relikwia, Pieczęć Strażnika | Klucz Serca |
