# Ekonomia Underhearth — jeden system (F2-1)

> Rola: systems-designer. Status: projekt v1 do akceptacji producenta. Liczby są celami wyjściowymi, a każdą zmianę
> w `src/content/` wdrażamy razem z testem balansu (`tests/balance.test.ts`).
> Dowody liczbowe: `node docs/design/systems/tools/economy-audit.mjs [sinks|values|power|timeline|sim]`. Skrypt czyta
> prawdziwe dane i model `src/balance/model.ts` i niczego w `src/` nie zmienia.
> Skróty: **kh** to krasnoludo-godzina pracy, **P** to Przebudzenie, **A** to Autorytet, **sr** to srebrny (§2.2).

## 1. Cel Systemu i Pętla Działania (Core & Meta Loop)

**Problem gracza:** jak z garstki krasnoludów i wozu zrobić gród na dziewięć pięter, który przetrwa długi, głód,
mrok i własną chciwość. **Frajda:** łańcuch, który zaczyna się od kilofa, a kończy na windzie parowej, oraz chwila,
w której pierwszy wagonik zastępuje dwunastu tragarzy. Napięcie wizji „Wziąć ↔ Pilnować” (VISION §1) przekładam na
trzy waluty decyzji. Każda decyzja ekonomiczna wydaje co najmniej dwie z nich:

1. **Praca** (kh). To prawdziwa waluta modelu: ukończenie gry to ok. 423 kh (`BALANCE.md`).
2. **Ryzyko**: P, zagrożenia biomu, najazdy i śmierć mieszkańców.
3. **Zasoby i czas kalendarzowy**: magazyn, psucie się zapasów, terminy rat Weksla.

| Skala | Bodziec / akcja | Koszt / ryzyko | Rezultat / nagroda | Wpływ na kolejne decyzje |
|---|---|---|---|---|
| Sekundy | wyznaczenie kopania, krasnolud kuje | twardość × kilof; zawał bez podpór; kopanie w głębi podnosi P | kafel pęka, łup wypada | gdzie stawiać podpory, światło i zsyp |
| Minuty | zbieranie → przetwarzanie → budowa → wyposażenie | transport to 60–85% kosztu jednostki surowca (model: 6,7 s z 8,1 s na rudę miedzi w T0); paliwo, smar, psucie | sztabki, budowle, sprzęt na zagrożenie | który łańcuch automatyzować, gdzie postawić magazyn |
| Godziny (biom) | zagrożenie → próbki → księgi → węzeł → przeciwdziałanie → boss | wyprawa w strefę zagrożenia; żyły-matki podnoszą P | trofeum i węzeł-klucz, nowy poziom logistyki | schodzić teraz czy dopiąć gospodarkę płytszego biomu |
| Akt (Weksel) | rata za 44–66 dób | eksport zabiera towary z bieżącej głębi (2,5–6% pracy biomu); zwłoka grozi zajęciem sal | A, ceny, spokój z Wagą | inwestować we wzrost czy spłacać; kogo wysłać do przodka |
| Cała gra (P) | chciwe dźwignie: żyły-matki, turbina magmowa, pieczęcie siłą, czarne złoto | najazdy, mrok, trudniejszy finał, ryzyko P = 100 | szybsza gospodarka (ok. −5–8% czasu) | ile kołysanek, ofiar i zaniechań kupić za pracę |

**Logistyka rośnie z głębią.** Typowy dystans dowozu rośnie z 25 do 90 kafli (model, `DISTANCE`). Kolejne progi
logistyki odpowiadają mnożnikom 1 → 0,8 → 0,55 → 0,45, a plecaki dają udźwig 1 → 3 → 5 → 8. Bez tych progów
transport jednostki w Pasie Magmy kosztowałby 2,3× więcej. To główna dźwignia ekonomii: gracz nie kupuje w niej
procentów, tylko inny sposób grania (§3).

## 2. Specyfikacja Mechaniki i Reguły Gry

### 2.1 Jednostki i kalendarz
- Doba trwa 600 s przy prędkości 1× (`DAY_SECONDS`). **Rok to 4 pory po 11 dób, czyli 44 doby.** Pauza nie płynie.
- Według modelu mediana gracza kończy T1 w 56. dobie, T3 w 153., T5 w 245., T7 w 321., a finał w 332.
  Skrajny profil szybki (24,5 h) kończy T7 w 239. dobie, skrajny wolny (72 h) w 464. (`timeline`).
- Ceny i wartości liczymy w srebrnych (sr). Dziś 1 sr odpowiada 1 punktowi pola `value`.

### 2.2 Waluta: decyzja i uzasadnienie
**Rekomendacja: waluta rozrachunkowa „srebrny” prowadzona w Księdze Wagi, bez monet w magazynie.**

Za wariantem A przemawia biblia, która już liczy w srebrnych (okup 500 srebrnych, ceny ±10%, cło −20%), oraz
jedna jednostka dla Weksla, frakcji, cła, kar i nagród bez fizycznego stosu do gromadzenia. Barter (B) wymagałby
osobnej tabeli dla każdej frakcji i kary. Monety (C) to kolejny towar do noszenia i „tysiąc monet”. Warunek
wariantu A: cena widoczna przed decyzją (VISION).
- **Saldo** rośnie z dostaw do kantoru, nagród i wpłat sztab, maleje przez import, usługi, cło, kary i okupy.
  Nie przynosi odsetek.
- **Cena skupu.** Dla surowców cena równa się `value`. Audyt potwierdza, że `value` już nagradza głębię: wartość na
  kh rośnie z 1 339 sr/kh (miedź, T0) do 2 436 (kwarc, T2), 8 828 (złoto, T4), 12 980 (szafir, T5) i 28 773
  (lśnit, T7). Surowce płytsze o dwa biomy dają 1,9–2,3× mniej niż rodzime. Reguła R5 z `05-level-systems.md` jest
  więc spełniona przez krzywą wartości i nie potrzebuje osobnej premii.
- **Wyroby.** Pole `value` nie nadaje się na cenę wyrobów: 90 ze 185 receptur nie dodaje wartości albo ją niszczy
  (stal 32 → 22, zbroja adamantowa 740 → 360). Wprowadzamy cenę pochodną:
  `cena = max(value, 1,1 × Σ cen wejść / liczba sztuk wyjścia)`. Przetworzenie nigdy więc nie traci na wartości
  w kontraktach.
- **Budulec nie jest towarem eksportowym.** Waga nie skupuje kamienia, bloków, cegieł, desek, belek, gliny, piasku,
  zaprawy ani płyt grzybowych. To odcina „drukarki” w rodzaju masowych desek (×5) i cegieł z magmy (×5,3).

### 2.3 Kantor, handel i frakcje
- **Eksport** jest fizyczny: towar trzeba dowieźć do kantoru przy Bramie; karawany mogą napaść Windykatorzy.
- **Nasycenie:** każde 50 sztuk tego samego towaru w porze roku obniża cenę o 3% (minimum 60%); pora odbudowuje 10%.
- **Import** jest wąski: zboże, drewno, płótno, liny i towary T0–T1 za `value` × 1,5 oraz najemni sztygarzy
  (krasnolud na 5 dób za 60 sr × (tier + 1), najwyżej 2). Głębi nie da się kupić.
- **Cło Nadrzecza** 10% (KM3 Z3: −20%). **Frakcje**: mnożnik ceny 1 − stosunek / 400 (±25% przy ±100).

### 2.4 Weksel Kuźnicy jako zegar
Weksel to 5 rat w ciągu 7 lat, płatnych towarami po cenie skupu. **Koszyk:** co najmniej 40% wartości raty
w towarach z najgłębszego biomu, w którym gród ma przyczółek. Resztę gracz płaci dowolnymi towarami
eksportowymi albo saldem.

| Rata | Doba (rok) | Koszyk wzorcowy (symulacja) | sr | Praca | Udział w pracy biomu |
|---|---|---|---|---|---|
| 1 (Akt I, KM1) | 44 (1) | 50 sztab miedzi + 20 brązu | 640 | 1,3 kh | 6,2% T1 |
| 2 (Akt II, KM2) | 110 (2,5) | 60 żelaza + 25 stali; srebro z grot jako zamiennik z premią +10% | 1 390 | 2,5 kh | 4,9% T2 |
| 3 (Akt III, audyt L4) | 176 (4) | 30 stali niklowej + 15 złota + 10 pereł | 1 760 | 1,9 kh | 3,7% T4 |
| 4 (Akt III) | 242 (5,5) | 30 stali kobaltowej + 12 szafirów i 10 ametystów (szlif.) | 2 476 | 1,8 kh | 2,5% T5 |
| 5 (Akt IV) | 308 (7) | 30 adamantu + 30 brązu żarowego + 10 rubinów (szlif.) | 5 660 | 1,2 kh | 1,0% T7 |

- **Rachunek raty:** dostawy zalicza się od razu, więc nie ma powodu gromadzić towaru na jeden dzień. Wpłata całej
  raty co najmniej 11 dób przed terminem daje 5% rabatu.
- **Prolongata:** o jedną porę roku za +10% i A −3, najwyżej dwa razy na ratę (trzy z lojalnym Ludmirem).
  Skrajnie wolny profil potrzebuje 2–3 prolongat i płaci ok. +20% na tych ratach, zamiast wpaść w spiralę.
- **Zwłoka:** +1% za dobę (do +30%). Po 10 dobach Waga zajmuje najcenniejszy magazyn (towar zamrożony, ceny +10%,
  A −10), po 30 dobach najemnicy zajmują głęboką salę, a zastawni pracują dla Wagi co piątą dobę (−6% pracy).
  Spłata cofa każdą sankcję.
- **Modyfikatory zadań** (z biblii): KM1 Z1 +50%, KM1 Z3 −20%, KM3 Z3 umarza ratę, QDD-L4 Z1 kary −50%, L1 Z3 ×2.
- **Po spłacie** Waga zostaje kontrahentem: kontrakty eksportowe z premią +15%, jeden na porę.

### 2.5 Przebudzenie: koszt chciwości
**P = podłoga fabularna + Σ chciwość − Σ ukojenie**, w zakresie 0–100. Ukojenie nie zejdzie poniżej podłogi.
Podłoga to 5 na starcie, 15 po wejściu do T2, 35 do T4 i 55 do T6. Po KM4 wynosi 80 i rośnie o 2 na dobę.

| Źródło chciwości | Wartość |
|---|---|
| kopanie | +0,1 na 100 kafli w T0–T1; +0,2 na 100 kafli od T2 |
| żyła-matka (R6) | +0,05 za kafel (żyła 40–80 kafli to +2–4) |
| głęboka pieśń poniżej Granitu | +0,2 (biblia §7.1) |
| turbina magmowa | +0,1 za dobę pracy (kradzież żaru) |
| kuźnia magmowa, wiertło magmowe | +0,05 za dobę pracy |
| decyzje | wg QDD, np. KM2 Z2: +15 oraz +0,1 za dobę |
| czarne złoto | +0,5 za sztabę (decyzja §5.5) |

| Ukojenie | Wartość |
|---|---|
| Kołysanka przy Słupie Akordów | śpiewak przez dobę: −0,3; drugi −0,2; trzeci −0,1 (na pieczęć) |
| ofiary z żarytu (po KM4 Z2) | 10 rudy żarytu: −1, najwyżej −1 na dobę |
| decyzje | np. QDD-L3 Z2: −5, KM4 Z3: −10 |

**Skutki P:**
- Odstęp najazdów goblinów: 12 dób × 30 / (P + 10). Przy P = 20 to 12 dób, przy P = 50 sześć.
- Siła najazdu ∝ bogactwo^0,6 × (1 + P/100). Gobliny uciekają do ciepła, a cel wybierają po bogactwie (VISION
  zgrzyt 5). Zostawiają to, co niosły, nigdy części ciała.
- Zasięg światła maleje o P/400. Groza w nieoświetlonych kaflach rośnie proporcjonalnie do P.
- P = 100 przed KM5 oznacza Pełne Przebudzenie: finał w ciągu 3 dób, w najsilniejszej fazie Głodu.

**Budżet P mediany:** Akt I ok. 10 (biblia 5–15), II 27–37 (15–35; zależnie od sposobu otwarcia pieczęci),
III 43–53 (35–55), IV 70–85 (55–80, z czego dwie turbiny przez 75 dób to +15). Chciwy gracz kończy powyżej zakresu,
oszczędny w jego dolnej części.

### 2.6 Mierniki społeczne

| Miernik | Źródło | Odpływ | Progi i skutek |
|---|---|---|---|
| **Chciwość** 0–100 | +0,5 za dobę za każdą rezerwę ponad rezerwę (rezerwa = 50 sr na mieszkańca; najwyżej +2 na dobę); skarb to sztaby srebra i złota, klejnoty, perły, relikwie, nienoszona biżuteria i saldo; korona w skarbcu +1 na dobę | −0,5 za dobę poniżej rezerwy; raty, Święto Lampy, dary, zniszczenie korony | 40 szepty; 60 „Korona Żaru”; 80 ryzyko zdrady Świętosławy |
| **Autorytet** 0–100 (start 30) | zlecenie +1–3 (najwyżej +6 na porę), rata w terminie +5 (wcześniej +7), obrona bez ofiar +2, boss +4; dryf ±0,2 na dobę ku 20 + 0,5 × nastrój | zwłoka −10, prolongata −3, zawał bez podpór −3, złamana obietnica −5, dekret −5 do −15 (1 na porę) | progi 40–75 z QDD |
| **Zaufanie** −100…100 | decyzje ±5…±40, rozmowa +2 (1 na dobę), dar +5 albo +10 | decyzje sprzeczne, dar nielubiany −5 | z darów najwyżej +30, powtórka ×0,5; lojalność tylko z misji |
| **Nastrój** 0–100 | posiłki (pieczeń +4, uczta +12, stout +9), Palenisko 2/4/8, karczma 2/4/7, piękno, światło | mrok, głód −15, śmierć −10, groza, tłok | tempo ×0,75 przy < 20, ×1,15 przy ≥ 80; ucieczki przy < 15 przez 3 doby |
| **Ludność** | limit 10/24/50; osadnik co 2 doby × karczma (1/1,5/2,2) przy nastroju ≥ 30; zadania (Ósma Szychta, Popielni) | śmierć, ucieczki, porwania po KM4 (1 na 2 doby), zastawni dla Wagi; 1 posiłek i 1 kufel na dobę | wzrost bez kuchni i browaru się nie opłaca |

### 2.7 Fizyczne odpływy i limity
- **Magazyn** liczony w sztukach (ekwipunek: 5 miejsc). Pojemność 80/240/700 → 120/400/1200: kolonia T2 przerabia
  ok. 200 sztuk na dobę, więc bufor dwóch dób to 3–4 składy. Palenisko (20/60) trzyma tylko żywność.
- **Psucie** (doby): mięso 3, ryba 2, jagody 4, grzyby 5, wodorost 6; pieczeń 4, chleb 8, gulasz 5, pasztet rybny
  (solony) 12, uczta 3, racja 40; piwo 40, miód 80, stout 60. Zboże, mąka i słód się nie psują. Kamienny skład
  mnoży czas psucia przez 1/0,6, Skarbiec przez 1/0,4, chłód T5 przez 1/0,5. Cel to straty 4–10% żywności.
- **Energia** się nie magazynuje; niedobór spowalnia maszyny proporcjonalnie, według priorytetów. Koło wodne:
  6 kW, jedno na odcinek strumienia ≥ 8 kafli. Maszyna parowa: 16 kW i 24 węgla na dobę przy pełnym obciążeniu
  (dziś `fuelPerMin: 6`, czyli 60 na dobę); moc paliw: koks ×2, tłuszcz trolla ×2, olej rybi ×1,5, węgiel drzewny
  ×0,8, drewno ×0,4. Turbina magmowa: 45 kW bez paliwa, +0,1 P na dobę. Pobór jednej kopii każdej maszyny: T2 7 kW
  (2 koła), T4 32 kW (2 maszyny, ok. 48 węgla na dobę), T5 41, T6 54 (2 turbiny), T7 57.
- **Utrzymanie** (tylko maszyny z poborem mocy) na 10 dób: T2–T3 smoła jako smar, od T4 uszczelka i ½ oleju
  rybiego (albo ¼ tłuszczu trolla); piece i huty: 4 cegły na wymurówkę. Inne budowle nie mają utrzymania; naprawa
  po katastrofie lub najeździe kosztuje 25% ceny.
- **Światło:** pochodnia wystarcza na 5 dób, kosz żarowy spala 1 węgiel na dobę, latarnia olejna 1 smołę na 4 doby;
  lampy zarodnikowe (T3), kryształowe (T5), żarowe (T6) i lśnitowe (T7) działają bez paliwa.
- **Zużycie:** wytrzymałość mają dziś tylko kilofy. Proponuję ją dla 62 sztuk ekwipunku (broń: ciosy, pancerz:
  obrażenia, sprzęt środowiskowy: minuty ekspozycji); naprawa 25% materiałów, przetop zbędnego daje 40% sztab,
  maska zużywa 1 filtr na dobę w chmurze zarodników.

### 2.8 Kluczowe kompromisy
- **Koło, para czy turbina:** koło jest darmowe, ale przywiązane do strumienia; para działa wszędzie, ale zjada
  ok. 0,6 krasnoluda pracy dziennie na węglu; turbina daje nadmiar mocy za ok. +7 P na akt.
- **Rata czy wzrost:** termin daje A, inwestycja tempo; prolongata kosztuje 10% i A.
- **Żyła-matka:** wydajność ×3 (R1) za +2–4 P i strefę zagrożenia. **Śpiewak:** nie kopie, ale obniża P.
- **Nadwyżka:** sprzedaż nasyca rynek, skarb podnosi Chciwość, pełne składy wabią najazdy.
- **Naprawić, przetopić czy ulepszyć:** dzięki zużyciu rzemiosło jest potrzebne do końca gry.

## 3. System Progresji i Krzywa Rozwoju
Krzywa ma być schodkowa: między progami gracz optymalizuje przepływ, a próg zmienia sposób grania.

| Próg (kiedy) | Co się zmienia w stylu gry |
|---|---|
| Kamienne Palenisko (T1, trofeum Herszta) | limit ludności 10 → 24: z obozu robi się gród z podziałem prac; pojawiają się kuchnia i browar jako wąskie gardła |
| Zsyp i kołowrót (T1) | grawitacja pracuje za tragarza: magazyn trafia pod szyb |
| **Pierwsze wagoniki i winda zębata (T2)** | transport ×0,8; trasy zamiast noszenia, a układ grodu wzdłuż torów; koło wodne przywiązuje przemysł do strumienia |
| Lampy zarodnikowe (T3) | koniec paliwa do światła w nowych salach; ciemność przestaje być stałym podatkiem |
| Grzybnie (T3, pancerz Matki) | jedzenie bez wypraw na powierzchnię |
| **Para (T4)** | energia wszędzie (paliwo), pompy osuszają kawerny, winda i kolejka parowa (×0,55); po raz pierwszy w grze pojawia się utrzymanie maszyn |
| **Automatyczne wiertła (T4 → T6)** | 1,2 → 3 kafle na minutę bez krasnoluda; wydobycie odrywa się od ludności, a wąskim gardłem staje się przetwórstwo |
| **Otwarcie pieczęci Gardzieli (KM2 i dalej)** | Gardziel jako winda główna: skrót logistyczny przez całą górę, okupiony P (Z2) albo pieśnią (Z1) |
| Wielkie Palenisko (T5) | ludność 50: produkcja masowa, osobne zmiany, Skarbiec z sortowaniem |
| Turbina magmowa (T6) | nadmiar energii za P; gracz przestaje liczyć waty i zaczyna liczyć dni do finału |
| Spłata Weksla (ok. doby 308) | eksport zamienia się w inwestycję: kontrakty Wagi i Wielkie Dzieła |

**Endgame (VISION, zgrzyt 8).** Kręgi Otchłani w obecnym modelu to 10 poziomów po ok. 100 walk z elitami, co kłóci
się z grą o kolonii. Rekomenduję **Wyprawy Dziedzictwa**: każdy Krąg to wysunięta baza z linią zaopatrzenia (tory,
windy, światło, chłodzenie), ok. 25 wypraw elit i warunek logistyczny zamiast fal walk. Stałe odpływy produkcji
zautomatyzowanej to Wielkie Dzieła, **Mistrzostwa** (powtarzalne węzły +5% wydobycia, rzemiosła lub transportu,
koszt ×1,5 na poziom, najwyżej 10 poziomów na gałąź; odpływ ksiąg po zamknięciu drzewka) i zużywający się ekwipunek
legendarny dla 50 krasnoludów. Zakończenie zmienia ekonomię Kręgów: Kołysanka to groza −20%, Zgaszenie to brak lawy
i powrót węgla i pary jako odpływu, Korona Żaru to energia ×2 przy świetle −30%. Wymaksowanie (cel 120 h) trzeba po
tej zmianie przeliczyć w modelu.

## 4. Ekonomia i Przepływ Zasobów (Faucets & Sinks)

### 4.1 Tabela źródeł i odpływów

| Zasób / element | Źródło | Odpływ | Rola w balansie |
|---|---|---|---|
| **Kopalne T0–T1** (kamień, glina, piasek, ruda miedzi, węgiel, cyna, wapień, saletra) | złoża, zwykła skała; potem wiertła | bloki, cegły, zaprawa, szkło, sztaby, proch; **nowe:** wymurówka pieców (glina i cegła) i paliwo maszyn (węgiel) | budulec i paliwo przez całą grę; nie są towarem eksportowym (§2.2) |
| **Kopalne T2–T3** (żelazo, galena, sfaleryt, kwarc, srebro, siarka) | złoża; żyły-matki w strefach zagrożenia | stal, rury, mosiądz, szkło, zębatki, proch; raty 2–3; nowe: naprawy, przetop | kręgosłup maszyn; srebro to pierwszy towar „skarbowy” |
| **Kopalne T4–T7** (sól, nikiel, złoto, kobalt, ametyst, szafir, mroźny kryształ, rubin, obsydian, żaryt, adamantyt, lśnit, runokamień) | złoża głębi; wiertła parowe i magmowe | stopy, szlif, rdzenie, runy; raty 3–5; ofiary z żarytu; Wielkie Dzieła | najwyższa wartość na kh (do 28 773 sr/kh), a więc nagroda za głębię |
| **Dropy z obiektów** (drewno, żywica, włókno, jagody, jęczmień, pióro, mech, guano, grzyby, drewno grzybowe, zarodniki, wodorost, ryba, perła, skrytki: relikwia, pył run, tryb) | obiekty odrastające (z wyczerpaniem: −25% plonu przy zbiorze przed odrostem, powrót w 3 doby); skrytki jednorazowe | żywność, budulec, smoła i paliwo światła, księgi, nawozy | odnawialne, ale ograniczone przepustowością, nie zapasem |
| **Dropy ze stworzeń** (mięso, skóra, kość, kieł, błona, chityna, kwas, futro, jedwab, gruczoł jadowy, śluz, skóra węgorza, odłamek golema, kryształowe serce, skóra i tłuszcz trolla, pył ćmy, łuska, gruczoł ognisty, rdzeń magmowy, ektoplazma) | polowanie, obrona, gniazda z limitem populacji | rzemiosło, sprzęt środowiskowy, uszczelki i smar, mikstury, księgi; nowe: naprawy | dropy mają mniej sr/kh niż rudy (perła 2 222 wobec złota 8 828 w T4), więc nie stają się farmą pieniędzy |
| **Trofea** (9) | jeden boss to jedna sztuka; Odźwierny przekonany pieśnią przekazuje pieczęć przez zadanie | jeden węzeł-klucz na warstwę; nowy koszt zastępczy, gdy trofeum zużyto lub pominięto | bramka postępu, nie towar handlowy |
| **Materiały** (T0 deska, cegła; T2 stal, rura, zębatka; T4 stal niklowa, uszczelka, tłok; T5 stal kobaltowa, soczewka, rdzeń mrozu; T6 brąz żarowy, wymiennik; T7 adamant, lśnitstal, tablica run) | receptury | budowle, infrastruktura, ekwipunek, utrzymanie, raty, Wielkie Dzieła | przetworzenie ≥ +10% wartości (§2.2) |
| **Żywność i piwo** | pole, łowy, grzybnie (T3), ryby (T4), ogród świetlny (T5), import zboża | 1 posiłek i 1 kufel na mieszkańca na dobę; psucie 4–10%; uczty | podatek od ludności; jakość jedzenia to nastrój, a nastrój to tempo |
| **Drewno** | sosny i brzozy (odrastają), drewno grzybowe (T3), import | deski, belki, węgiel drzewny, pochodnie, stemple | wyręb ponad przyrost lasu: Korzenni −1 za 10 drzew; w głębi zastępuje je grzyb |
| **Energia** | koło 6, para 16, turbina 45 kW | maszyny 7–57 kW; paliwo albo P | moc się nie magazynuje, więc dostawca to zawsze wybór kosztu |
| **Księgi badań** (8) | Sala Wiedzy z próbek najnowszego biomu | węzły drzewka, Archiwum Wieków, Mistrzostwa | ciągną gród w głąb |
| **Srebrne** (saldo) | dostawy, nagrody, wpłaty sztab | raty, import, najemnicy, cło, kary, okupy | bez odsetek, więc nie ma powodu trzymać salda |
| **Weksel** (ok. 12 000 sr) | dług startowy | 5 rat towarami bieżącej głębi | zegar Aktów I–IV i jedyny zużywalny odpływ kruszców |
| **Ludność** | Palenisko, osadnicy, zadania | śmierć, ucieczki, porwania, zastawni dla Wagi | pracownik i odbiorca naraz |
| **Nastrój** | jedzenie, piwo, Palenisko, karczma, piękno | mrok, głód, groza, śmierć, tłok | przekłada się na tempo pracy (±15–25%) |
| **Autorytet** | dotrzymane terminy, obrona, wyroki | dekrety, zwłoka, zaniedbania | kapitał polityczny, wydawany na dekrety i progi QDD |
| **Zaufanie** | decyzje, rozmowy, dary | decyzje sprzeczne | dary są odpływem wyrobów luksusowych, z limitem |
| **Przebudzenie** | podłoga fabularna i chciwe dźwignie | kołysanki, ofiary, decyzje | działa jak zanieczyszczenie w grach fabrycznych: przyspieszasz, a świat odpowiada najazdami |
| **Chciwość** | skarb ponad rezerwę, korona, czarne złoto | raty, święta, dary | miękki limit gromadzenia i bramka zakończenia |

### 4.2 Audyt: co dziś nie ma odpływu
Klasy odpływu z `economy-audit.mjs sinks`: **R** zużywalny, **S** skalowalny, **E** wyposażenie bez zużycia,
**O** jednorazowy, **G** tylko Wielkie Dzieła.

| Grupa | Rozkład klas |
|---|---|
| surowce kopalne | R 13, S 8, E 5, O 1 |
| dropy | R 22, S 3, E 9, O 9, G 3, brak 1 |
| materiały | R 24, S 23, E 20, O 13, brak 1 |
| przedmioty | R 29, E 62 |

| Zasób bez odpływu zużywalnego | Dziś | Proponowany odpływ |
|---|---|---|
| 62 sztuki ekwipunku (wszystko poza kilofami, amunicją i konsumpcyjnymi) | założone raz, nigdy nie znikają | wytrzymałość, naprawa 25%, przetop 40%, dary |
| glina i cegła | tylko koszty budowli | wymurówka pieców i hut (4 cegły na 10 dób) |
| srebro, złoto, ametyst, szafir, rubin, perła i ich szlif | biżuteria i budowle | raty Weksla, kantor, skarb (Chciwość) |
| kieł | 2 sztuki do badania Łowiectwo | bełty z grotem z kła (1 drewno + 2 kły + pióro → 10 bełtów) |
| kość (spada do T7, ostatni konsument T4), chityna (do T4, konsument T2) | klej, wędka, płytki | mączka kostna: 3 kości → 2 nawozy (grzybnie i ogrody aż do T8); naprawy kamizeli i rękawic |
| tryb i mechanizm zegarowy | tylko działo runiczne | utrzymanie maszyn poziomu 3 od T7 (1 mechanizm na 20 dób) |
| skóra węgorza, odłamek golema, skóra trolla, kwas, futro, ocieplina, szlif | ekwipunek bez zużycia | zużycie i naprawy sprzętu środowiskowego |
| olej rybi, tłuszcz trolla, uszczelka | tłok, mikstura | smar i uszczelki w utrzymaniu maszyn |
| księgi badań | tylko węzły | Mistrzostwa po zamknięciu drzewka |
| kryształowe serce, relikwia | Klucz i Wielkie Dzieła | bez zmian: rzadkie, późne, nie inflacyjne |
| Okruch Pożeracza, Klucz Serca | brak | celowe pamiątki (wyjątek w teście), a Klucz zużywa Brama Serca |
| Pieczęć Strażnika | **popyt 2, podaż 1** (Klucz i Latarnia, etap 3) | §5.3, poz. 5 |

### 4.3 Jak system unika „tysiąca sztuk” i ślepego zaułka
- **Przeciw nadmiarowi:** każdy tier ma odpływ powtarzalny (paliwo, smar, wymurówka, naprawy, księgi, raty);
  rynek się nasyca, a budulca Waga nie skupuje; magazyn ogranicza zapas; bogactwo wabi najazdy, a skarb podnosi
  Chciwość; zbędny ekwipunek idzie do przetopu.
- **Przeciw zaułkowi:** surowce T0–T1 są odnawialne albo leżą w kilku biomach; import zboża i desek ratuje
  głodującą kolonię; koszt zastępczy trofeum (3× księgi i rzadkie dropy biomu) obchodzi pominiętego bossa;
  prolongata zastępuje spiralę długu, a każdą sankcję Wagi da się odwrócić.

## 5. Balans, Wrażliwe Punkty i Potencjalne Nadużycia

### 5.1 Exploity i zabezpieczenia

| # | Nadużycie | Mechanizm zaradczy | Metryka ostrzegawcza (bot lub telemetria) |
|---|---|---|---|
| 1 | **Bezpieczne farmienie płytkich złóż** zamiast schodzenia | płytkie dają 1,9–2,3× mniej sr/kh; nasycenie −3% na 50 sztuk; 40% koszyka raty z bieżącej głębi; import bez T2+; wiertła wyczerpują żyły | udział salda z towarów co najmniej 2 tiery płytszych > 30%; czas w biomie > 1,5× celu u ponad 20% przejść |
| 2 | **Magazynowanie przed ratą** i ukrywanie bogactwa przed najazdami | rachunek raty zaliczany na bieżąco i 5% rabatu za wczesną wpłatę; bogactwo liczy też towar na wózkach i placach budowy | stosunek szczytowego do średniego zapasu w ostatnich 3 dobach przed terminem > 2,5; straty z najazdów > 8% produkcji |
| 3 | **Farmienie odradzających się obiektów i stworzeń** (małże i perły, krzewy, gniazda) | wyczerpanie plonu −25% przy zbiorze przed odrostem; limit populacji gniazd; nasycenie dropów ×0,9 na 20 sztuk; bestiariusz liczy 10 zabić na gatunek | udział dropów w saldzie > 25%; ponad 3 zbiory tego samego obiektu na dobę |
| 4 | **Minimalizacja P przez niekopanie** albo odwrotnie: ignorowanie P (turbiny, żyły-matki) | podłoga fabularna; najazdy zależą też od bogactwa; mniej kopania to mniej postępu; P = 100 skraca przygotowania do finału | rozkład P przy KM4: oszczędni ≤ podłoga + 5, chciwi ok. podłoga + 25; P = 100 przed KM4 w < 5% przebiegów; chciwy profil −5–8% czasu przy ×2 wariancji strat |
| 5 | **Kupowanie Zaufania darami** i Autorytetu łatwymi zleceniami | dary najwyżej +30 i ×0,5 za powtórkę; zlecenia najwyżej +6 A na porę i ważone trudnością; lojalność tylko z misji | ponad 50% Zaufania z darów; A ≥ 70 przed Aktem III u ponad 30% graczy |
| 6 | **Najemnicy jako zamiana sr na pracę** | najwyżej 2 jednocześnie, 60 sr × (tier + 1) za 5 dób | najemnicy > 10% pracy kolonii |

Wizja wymaga, by chciwość była szybsza, ale ryzykowniejsza i nigdy dominująca. Test w kolejnym kroku: Monte Carlo
profili „chciwy” i „oszczędny” z najazdami. Kryterium: chciwy wygrywa medianą czasu o 5–10% i przegrywa na P90
strat (zgony, utracone sale).

### 5.2 Wynik w modelu (skrypt `sim`, mediana gracza)
- Proponowane odpływy (Weksel 8,6 kh, utrzymanie 20,5 kh, razem 6,3% pracy) wydłużają ukończenie z 40,4 h do 45,2 h.
- Kompensacja krzywą ksiąg (baza 7 → 6,2, wzrost 1,33 → 1,31) daje **41,7 h**; każdy biom mieści się w 0,55–1,8×
  celu (2,6 / 5,3 / 7,5 / 4,8 / 6,0 / 5,5 / 3,4 / 5,0 / 1,6 h).
- T2 jest przeciążony (7,5 h przy celu 6 h). Proponuję przesunąć część raty 2 na srebro z T3 i wcześniej włączyć lampy
  zarodnikowe. Zostaje +1,7 h, w granicach strażnika (34–46 h).
- Profile skrajne z osi czasu (24,5 h i 72 h) są szersze niż P10/P90 Monte Carlo (33,5/55,2 h), bo celowo łączą
  skrajne parametry.

### 5.3 Ostrzeżenia walidatora: rekomendacje
1. **`cobalt_bar`, moc 3 przy Wielkim piecu 2.** Obniżyć `power` receptury do 2. Energia to atrybut maszyny, który
   gracz widzi na budowli. Trudność kobaltu wyrażają już czas (32 s) i 2× koks.
2. **`cobalt_steel`:** to samo, `power: 2`.
3. **`feast_platter`:** ustawić `tier: 4`. Uczta jest nagrodą za sól i Wielką kuchnię (T4).
4. **`heart_key`:** ustawić `tier: 7`. Klucz wytwarza się w T7, a w T8 tylko się go używa.
5. **`guardian_sigil`:**
   - dodać `{ guardian_sigil: 1 }` do kosztu węzła `heart_key_t` (reguła węzła-klucza);
   - usunąć pieczęć z receptury `heart_key`;
   - w Latarni Głębin, etap 3, zastąpić pieczęć 4 relikwiami i 20 tablicami run.
   To usuwa konflikt popytu 2 przy podaży 1. Quest-designer dodaje źródło pieczęci dla wariantu „Odźwierny
   przekonany”.
6. **`copper_rod`:** usunąć `light: 0`. Zasięg różdżek (tagi `r4`/`r7`/`r12`) przenieść do pola `stats.prospect`.
7. **`gas_masks`:** dodać `zinc_ore` do `revealBy`. Maska wymaga mosiądzu, a R4 każe zapowiedzieć zagrożenie, zanim
   gracz zdecyduje o zejściu (turkusowa poświata z pęknięć granitu).

Po wdrożeniu tych poprawek włączyć `--strict` w CI z listą celowych wyjątków.

### 5.4 Zmiany w danych do wdrożenia w następnym kroku (razem z testem balansu)
1. Nowy `src/content/economy.ts`: kalendarz (rok 44 doby), Weksel (5 rat: doba, sr, koszyk, 40% z bieżącej głębi),
   reguły cen (cena pochodna, nasycenie, budulec bez skupu, import, cło, frakcje), stałe P, Chciwości, A i Zaufania.
2. `buildings.ts`: `fuelPerMin: 6` → `fuelPerDay: 24` z tabelą mocy paliw; `upkeep` maszyn (T2–T3 smoła, T4+
   uszczelka i olej) i wymurówka pieców; magazyny 120/400/1200 ze `spoilMult` 1/0,6/0,4; koło wodne `perStream: 1`.
3. `types.ts`: `Resource.spoilDays`, `BuildingLevel.upkeep`, `TechNode.altCost`, `ItemStats.prospect`.
4. `resources.ts`: `durability` dla 62 sztuk ekwipunku (ok. 150 · 250 · 400 · 600 · 900 · 1500 dla
   T0/T1/T2/T4/T5/T7); `feast_platter` → T4, `heart_key` → T7, `copper_rod` bez `light`; `spoilDays` wg §2.7.
5. `recipes.ts`: `cobalt_bar` i `cobalt_steel` z `power: 2`; nowe: mączka kostna, bełty z kłów, przetop
   ekwipunku (smelter, 40%), filtry jako zużycie maski.
6. `tech.ts`: `guardian_sigil` w `heart_key_t`; `altCost` dla 7 węzłów z trofeami; `gas_masks.revealBy += zinc_ore`;
   `PACK_CURVE` baza 6,2, wzrost 1,31; węzły Mistrzostw (T8).
7. `greatworks.ts`: Latarnia Głębin, etap 3, bez pieczęci.
8. `src/balance/model.ts` (mój katalog, po akceptacji): drenaż kolonii (paliwo, smar, światło, śpiewacy), straty
   żywności, kategoria `weksel`, profile chciwy i oszczędny w Monte Carlo, ponowny turniej krzywej i przeliczenie
   wymaksowania z Wyprawami Dziedzictwa.

### 5.5 Decyzje dla producenta
1. **Waluta:** księga „srebrny” (rekomendacja), barter albo monety.
2. **Czas:** akceptujemy 41,7 h po kompensacji czy tniemy dalej utrzymanie w T2.
3. **Czarne złoto** jako nowy surowiec (żyły-matki w Pasie Magmy i Prastarych, +0,5 P za sztabę, premia Wagi
   ×1,5, korona). Wymagają go R6 i VISION, a w danych go nie ma. Do decyzji razem z lead-narrative.
4. **Kręgi Otchłani** jako Wyprawy Dziedzictwa zamiast ok. 100 walk z elitami na Krąg.
5. **`--strict` w CI** po poprawkach ostrzeżeń.
