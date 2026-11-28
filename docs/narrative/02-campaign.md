# 02 — Kampania: samouczek ze starym królem, pięć aktów, Raróg

> Kampania prowadzi przez 9 biomów w ok. 40 h (kalibracja: `docs/BALANCE.md`). Struktura: **pięć kamieni
> milowych (KM1–KM5)** — pełne dokumenty zadań w `04-quests.md`. Towarzysze: `03-companions.md`.

## 1. Mapa kampanii
| Akt | Godziny (cel) | Biomy | Bossowie (trofeum → badanie) | Kamień milowy | Rekrutacje | Misje lojalnościowe dostępne |
|---|---|---|---|---|---|---|
| I „Powrót” | 0–6 | Podgórze, Wapienne Progi | Wilczy Herszt → Kamienne Palenisko; Królowa Nietoperzy → Wielki piec | **KM1 Ostatni Pamiętający** (incydent otwierający) | Dzierżko, Wilga, Świętosława, Ludmir | — |
| II „Pieczęć” | 6–17 | Granitowe Korzenie, Grzybowe Groty | Matka Pełzaczy → Grzybnie; Królowa Pajęczyn → Uszczelnienia | **KM2 Pierwsza Pieczęć** | Bolko i Mirosz, Iskra, Drahomira | Dzierżko, Świętosława, Wilga |
| III „Pamięć” | 17–29 | Zatopione Głębie, Kryształowe Głębie | Lewiatan Jeziora → Szlif klejnotów; Kryształowy Kolos → Kuźnia magmowa | **KM3 Zatopione Archiwum** | — | Bolko, Mirosz, Iskra, Ludmir |
| IV „Popiół” | 29–39 | Pas Magmy, Prastare Głębiny | Robak Magmowy → Esencja eteryczna; Strażnik Ruin (Odźwierny) → Klucz Serca | **KM4 Brama Popiołu** (punkt bez powrotu) | Żarko | Drahomira, Żarko |
| V „Serce” | 39–40+ | Serce Góry | Raróg, Pożeracz Światła | **KM5 Serce Góry** (finał, przeżycie drużyny) | — | — |
| Po grze | 40–120 | Kręgi Otchłani, Wielkie Dzieła | — | epilog zależny od zakończenia | — | — |

**Każdy akt zmienia znaczenie poprzedniego:**
| Akt | Gracz wierzy na początku | Gracz wie na końcu |
|---|---|---|
| I | wracamy po dziedzictwo i skarb | król zginął, a stemple ktoś podciął |
| II | pieczęcie w Gardzieli to drzwi do bogactw | pieczęcie to części więzienia, a Strażnicy coś ukrywają |
| III | Strażnicy strzegą świętego prawa | krasnoludy to strażnicy, którzy wybrali ciało; kołysanka wymaga ofiar |
| IV | Popielni to podpalacze świata | Popielni zostali zamurowani przez Strażników i Koronę; głosem zawału był Gostomir |
| V | trzeba pokonać demona | trzeba zdecydować, czym jest strażnik: kat, zabójca czy następca Prakowali |

## 2. Samouczek (ok. 60 min): stary król Gostomir
> **Zmiana właściciela 2026-11-28 (do przepisania tej sekcji przez lead-narrative + quest-designer, F2-8):** gracz
> **gra Gostomirem** — król jest personą gracza (jego głos wydaje rozkazy, jego Pieśni są mocami gracza), a nie
> przewodnikiem obok gracza. Gracz sam trzyma Kołysankę w zawale, żeby drużyna uciekła; król ginie zawsze. Potem gracz
> przejmuje następcę. Szczegóły: `docs/team/DECISIONS.md` (2026-11-28). Poniższy tekst opisuje wersję sprzed zmiany.

**Król Gostomir, Ostatni Pamiętający** — 321 lat, ślepy na lewe oko, nosi **Młot Pamięci** (regalia z gniazdem
na Krążki Królewskie w obuchu). Dowcipny, zmęczony, z poczuciem winy, którego nie nazywa. Prowadzi wyprawę,
bo jako jedyny żyjący pamięta korytarze góry. Ma zawsze rację co do skały i nigdy co do siebie.

| # | Beat (min) | Cel gracza | Uczony system | Kwestia króla (przykład) |
|---|---|---|---|---|
| 1 | Przyjazd (0–3) | rozładuj wóz, postaw Ognisko obozowe | budowanie, magazyn | „Trzysta lat. A łąka pachnie tak samo. Zdradliwa ta łąka.” |
| 2 | Pierwsze kopanie (3–8) | wyznacz kopanie w zboczu, zbierz kamień | rozkazy kopania, łup | „Kop wzdłuż warstwy. Skała, jak każda stara baba, nie lubi, gdy ktoś idzie pod włos.” |
| 3 | Światło (8–12) | pochodnie w wyrobisku | pole światła, mrok spowalnia pracę | „W ciemności krasnolud pracuje jak człowiek. Powoli i narzekając.” |
| 4 | Kwatery, jedzenie, piwo (12–20) | Legowiska, kuchnia, browar | potrzeby, nastrój | „Bez piwa nikt tu nie zejdzie głębiej niż do piwnicy.” |
| 5 | Miedź (20–26) | znajdź żyłę miedzi (dendryty w skale) | czytanie rud, forma złoża | „Widzisz te zielone gałązki? Miedź rośnie w skale jak paproć. Tylko wolniej płaci.” |
| 6 | Piec i huta (26–32) | Wypał gliny, huta miedzi | łańcuch produkcji | „Ruda to obietnica. Sztaba to dotrzymana obietnica.” |
| 7 | Pierwsze badanie (32–36) | Sala Wiedzy: pierwsza księga z próbek | zakryte drzewko (licznik ukrytych węzłów) | „Nie wszystko pamiętam. Reszta jest w skale — trzeba ją przeczytać.” |
| 8 | Noc i wilki (36–44) | drzwi, warta, odparcie watahy | walka, noc, obrona | „Wilki nie są złe. Są głodne. To gorzej.” |
| 9 | Zejście szybem (44–50) | drabiny do Wapiennych Progów | nawigacja, transport | „Tu był Pierwszy Próg. Stąd śpiewaliśmy… stąd zaczynał się dom.” (pauza, zmiana tonu) |
| 10 | Sala Pierwszego Progu (50–55) | otwórz salę, postaw 4 stemple w 60 s | podpory, naprężenia stropu (Pieśń „Ostrzeżenie” króla pokazuje pęknięcia) | „Słyszysz? Strop płacze. Stemple! Szybko, zanim zacznie krzyczeć!” |
| 11 | **Zawał** (55–58) | ratuj uwięzionych | zawał, ratownictwo | patrz niżej |
| 12 | Namiestnik (58–60) | przyjmij Młot Pamięci | przejście w grę swobodną: cele → **zlecenia** | „Nie kop dla złota. Kop dla tych, którzy przyjdą po tobie.” |

### Sekwencja zawału (scenariusz dla level designu i skryptu)
- **Lokacja**: Sala Pierwszego Progu — 14×6 kafli, 30 kafli pod powierzchnią, wapień; w ścianach nisze dawnego
  chóru (ryte rozety), 6 przegniłych stempli z epoki królestwa (obiekty „zbutwiały stempel”, wytrzymałość 20%).
- **Wyzwalacz**: wykop trzeciego kafla w ścianie wschodniej (cel: żyła miedzi za ścianą). Król śpiewa
  „Ostrzeżenie” — na stropie pojawia się czerwona siatka naprężeń.
- **Zadanie czasowe**: 4 stemple w 60 s (są w magazynie obok). Sukces: zawala się tylko część zachodnia.
  Porażka: zawala się też środek, dwóch hajerów z Ósmej Szychty zostaje uwięzionych (dodatkowy cel ratunkowy,
  przeżycie zależy od tempa).
- **W obu wariantach** król stoi w zachodniej niszy chóru (rozpoznał miejsce; gracz widział, jak tam podchodzi).
  Gdy strop rusza, Gostomir unosi Młot i śpiewa **Kołysankę** — gracz widzi pierścienie Pieśni podtrzymujące
  strop przez 8 s; krasnoludy uciekają; kamera trzyma się króla; strop spada.
- **Ratunek**: drużyna odkopuje 2 kafle. Król przygnieciony, Młot w dłoni, obuch pęknięty — **Krążek Gostomira
  rozpada się na 6 odłamków** (jeden zostaje w Młocie, pięć rozsypuje się po świecie fabularnie w kolejnych aktach).
- **Ostatnia rozmowa** (świadkowie: Dzierżko z Ósmą Szychtą, faktor Ludmir Kruszec, brat Cichosław ze Strażników):
  - Król: „Wnuczka będzie chciała korony. Waga będzie chciała głębi. Strażnicy będą chcieli ciszy. Ty… ty
    słuchaj skały. Ona pamięta więcej niż ja.”
  - Król (do świadków): „Przed górą i przed wami: oto Namiestnik Kuźnicy. Do czasu, aż góra wybierze króla.”
  - Ostatnie słowa, ciszej, do nikogo: „Tym razem ja zostałem po złej stronie…” — zdanie, które gracz zrozumie
    dopiero w Akcie IV.
- **Ślad sabotażu** (do odkrycia natychmiast lub później): gracz może zbadać obiekt „ścięty stempel” — pień
  z równym cięciem piły i grudką popiołu w nacięciu, choć w sali nie płonął żaden ogień. Wpis w Kronice:
  „Stempel nie złamał się. Ktoś go przeciął.” Otwiera wątek KM1.
- **Pochówek w kamieniu**: grób króla w niszy sali — stały punkt grodu (miejsce składania odłamków Krążka,
  rocznicowe zdarzenie „Król przemawia”).

## 3. Akty — cel, polityka, zagrożenie
### Akt I „Powrót” (0–6 h)
- **Cel**: odzyskać Pierwszy Próg, przetrwać zimę, spłacić 1. ratę Weksla (miedź i cyna), zabić Królową
  Nietoperzy, która gasi nieosłonięte światła.
- **Polityka**: kryzys sukcesji — Świętosława z poparciem Wagi żąda korony; Namiestnik ma tylko słowo
  zmarłego króla. Korzenni sabotują wodę grodu, bo huta zatruwa strumień.
- **Zagrożenie**: noc, wilki, mrok, zawały; pierwsze drżenia (Przebudzenie 5–15).
- **Kończy się**: rozpaleniem Kamiennego Paleniska w odzyskanej sali i rozstrzygnięciem KM1 (kto podciął stemple — trop prowadzi w dół).

### Akt II „Pieczęć” (6–17 h)
- **Cel**: przebić się przez granit, opanować zalania, zdobyć żelazo i stal, otworzyć **Pierwszą Pieczęć**
  w Gardzieli (szybka droga w dół = wielka korzyść logistyczna).
- **Polityka**: Waga chce Pieczęci otwartej natychmiast (srebro i żelazo za nią), Strażnicy przybywają z Drahomirą
  i zakazują. Gnomy wiercą w pieczęć bez pozwolenia.
- **Zagrożenie**: twarda skała, zalania, zarodniki, jad; najazdy goblinów (Przebudzenie 15–35).
- **Kończy się**: Pieczęć otwarta (albo zostawiona) — pierwszy Krążek Prakowali pokazuje, że pieczęcie to część więzienia.

### Akt III „Pamięć” (17–29 h)
- **Cel**: zejść do podziemnego morza, odzyskać **Wielki Krążek** z Zatopionego Archiwum, przetrwać mróz
  Kryształowych Głębi.
- **Polityka**: prawda o Pierwszym Wyborze uderza w Strażników; Gildia próbuje przejąć głębokie sale za
  zaległe raty; poseł Nadrzecza żąda trybutu z „góry na ziemi księcia”.
- **Zagrożenie**: głęboka woda, mróz, mrok (Przebudzenie 35–55).
- **Kończy się**: Wielki Krążek odczytany — gracz wie, jak działa kołysanka i ile kosztuje.

### Akt IV „Popiół” (29–39 h)
- **Cel**: dotrzeć do Popielnych, przejść Pas Magmy, zdobyć **Klucz Serca** od Odźwiernego (walką albo pieśnią).
- **Polityka**: sojusz albo wojna z Popielnymi; Krążek Gostomira ujawnia, że król był głosem zawału Bramy Popiołu.
- **Zagrożenie**: żar, lawa, opary, groza, konstrukty (Przebudzenie 55–80).
- **Kończy się**: otwarcie Bramy Serca — **punkt bez powrotu**: Raróg się budzi, Przebudzenie rośnie o 2 dziennie;
  każdy dzień zwłoki to porwani mieszkańcy (ciemność zabiera ludzi z najsłabiej oświetlonych sal).

### Akt V „Serce” (39–40+ h)
Finał w stylu misji samobójczej: przygotowanie grodu, przydział ról, trzy wykluczające się zakończenia
(`04-quests.md`, KM5). Epilog: plansze losów każdego towarzysza, frakcji i grodu.

## 4. Antagonista: Raróg, Pożeracz Światła
*Wzorowany na archetypie demona cienia i ognia z głębin, zbudzonego przez chciwość kopiących — z własną
tożsamością wizualną i moralną.*

- **Natura**: istota starsza niż światło; ogień, który nie świeci. Nie jest zła jak tyran, jest głodna jak
  pożar — i ma wolę. Przez pięć tysięcy lat była więźniem i baterią Prakowali. Nazywa krasnoludy
  „strażnikami, którzy zapomnieli”.
- **Wygląd (przekrój 2.5D)**: sylwetka wysoka na ~20 kafli, z czarnego płomienia z purpurowo-czerwoną
  obwódką; we wnętrzu prześwituje szkielet z zastygłego czarnego złota — wtopione **kajdany Prakowali**;
  zamiast skrzydeł — wznoszące się w górę płachty popiołu. Brak broni w dłoni: jego bronią jest **głód światła**.
- **Obecność przed finałem** (sterowana Przebudzeniem): drżenia stropu; czarne języki ognia w szczelinach;
  przygasające pochodnie w głębszych salach; czerwony puls w Gardzieli jaśnieje; sny krasnoludów (zdarzenia
  grozy w nocy); exodus goblinów w górę; kapłani Popielnych mówią jego głosem.
- **Walka (KM5) — trzy fazy**:
  1. **Głód**: wciąga światło (pochodnie, lampy, świecące rudy); im więcej światła pochłonie, tym jest silniejszy.
     Gracz utrzymuje źródła światła zasłonięte i odsłania je w chwili ataku (lustra gnomów, lampy lśnitu).
  2. **Popiół**: burze wznoszącego się popiołu ograniczają widoczność i podnoszą grozę; Kołysanka śpiewaków
     tłumi burzę, druidzi-nietoperze prowadzą drużynę po echu.
  3. **Serce**: przebieg zależy od wybranego zakończenia (uśpić / zgasić / wziąć w koronę).
- **Dylemat moralny finału**: uśpienie = przedłużenie więzienia, które zbudowali Prakowale; zgaszenie = zabicie
  pradawnej istoty i ostudzenie serca góry; korona = zostanie nowymi Prakowalami.
- **Imię**: krasnoludy go nie wymawiają („Ten Pod Spodem”); Popielni mówią „Ojciec Żaru”; w Krążkach Prakowali
  jest glifem „Niewidzący Ogień”. Imię **Raróg** gracz słyszy pierwszy raz od Żarka w Akcie IV.

## 5. Zakończenia (szczegóły w KM5)
| Zakończenie | Warunek | Cena | Epilog grodu |
|---|---|---|---|
| **Kołysanka** (uśpić) | odczytany Wielki Krążek + śpiewak pieczęci | głos (albo życie) śpiewaka wpleciony w pieczęć na zawsze | królestwo strażników; Strażnicy odzyskują autorytet; Przebudzenie do 0; Kręgi Otchłani dostępne |
| **Zgaszenie** (zabić) | Kowadło Serca przywrócone (wiedza Iskry) + przewodnik szybów | serce góry stygnie: w ciągu 3 lat gry gasną turbiny magmowe i kuźnie żaru; wiara Popielnych upada | wolni Popielni, uwolnione głosy dawnych śpiewaków; gospodarka musi przejść na parę |
| **Korona Żaru** (wziąć ogień) | korona z czarnego złota + Chciwość ≥ 60 | władca nosi Raroga w sobie; ciemność rozlewa się z sali tronowej | potęga i nieograniczona energia; epilog: gród dostatni i coraz ciemniejszy, a towarzysze odchodzą lub giną |
