# Wizja Underhearth — v1

> Rola: game-director · wersja 1 · 2026-11-26 · status: do akceptacji producenta (spór wizji → właściciel).
> Podstawy: `CLAUDE.md`, `docs/team/CHARTER.md` §4, `docs/GDD.md`, `docs/narrative/`, `docs/variants/01-render-style.md`,
> `docs/variants/02-materials.md`. Dokument wyznacza kierunek i granice; parametry ustalają biblia sztuki i turnieje.

## 1. Rdzeń Wizji, Tożsamość i „Dusza” Gry

**Dusza w jednym zdaniu.** Niesiesz ciepło paleniska coraz głębiej w trzewia góry, której ciemność jest głodna
światła — i odkrywasz, że twój lud nie przyszedł tu kopać, tylko pilnować.

**Trzy słowa: Palenisko · Przodek · Pamięć.** *Palenisko* to dom, wspólnota i pierwsze światło gracza (budowla,
limit ludności, miejsce rozmów drużyny). *Przodek* w gwarze to czoło wyrobiska — praca, chciwość i ryzyko — ale też
ten, po kim dziedziczymy: krasnoludy są potomkami strażników. *Pamięć* to Krążki, wina Gostomira i prawda podawana
warstwami.

**Obietnica dla gracza.**
1. Zbudujesz gród od ogniska przy wozie po miasto na dziewięć pięter — widoczny w całości i żywy jak makieta,
   w której każdy pokój ma mieszkańców.
2. Każde zejście zmieni zasady: nowe zagrożenie, paleta, brzmienie, maszyny i wiedza. Tym, co już masz, dalej nie przejdziesz.
3. Twoje decyzje będą miały twarze i imiona; finał rozliczy je życiem drużyny i mieszkańców.
4. Prawda o górze zmieni sens wszystkiego, co zbudowałeś.

**Napięcia rdzenia.**
| Oś | Biegun ciepły | Biegun zimny | Jak gracz to czuje |
|---|---|---|---|
| **Ciepło ↔ Głód** | Palenisko, żur, piwo, gwar, lampy | ciemność, zawał, groza, Raróg | światło daje tempo pracy i spokój, kosztuje paliwo, a w finale staje się przynętą |
| **Wziąć ↔ Pilnować** | Weksel, żyły-matki, czarne złoto, Korona Żaru | Prawo Głębi, Kołysanka, Przebudzenie | najbogatsza strategia jest najgroźniejsza (`05-level-systems.md`, R6) |
| **Ludzie ↔ Urobek** | Ósma Szychta, zastawni, drużyna | raty, kontrakty Wagi, tempo | „Nikogo nie zostawiamy w przodku” kontra termin raty |

**Ton:** dorosła baśń górnicza — ciepła na wierzchu, ciężka pod spodem. Gród pachnie żurem i smarem i śmieje się
przy kuflu; głębia milczy i pamięta. Nikt nie jest czarnym charakterem z głupoty.

**Obraz: żywa mapa mierniczego.** Kierunek właściciela czytam jako ręcznie rysowany, podkolorowany przekrój — jak
dawne mapy kopalń — który ożył jako przytulna makieta. Z rodziny stylu referencji bierzemy kreskę, płaskie plamy
z fakturą, przygaszoną paletę i gęsto zastawione piętra. Od siebie dokładamy trzy rzeczy: głębię 2.5D (wnęki, tylne
ściany, światło z głębią), mrok jako treść (trochę ciemniej, bo światło jest tu zasobem i stawką, a przytulność
rodzi się z kontrastu ciepłej izby i zimnej skały) oraz tożsamość słowiańsko-górniczą. Metafora mapy spina obraz
z UI i fabułą: „Mapy mierniczego” są w grze księgą badań, nieznane jest niezbadanym skrawkiem mapy, a oddalenie
pokazuje górę jak plan kopalni.

**Werdykt o kierunku ilustrowanym: przyjmuję.** Wzmacnia rdzeń lepiej niż R2B: tamten dawał nastrój, ale gubił
materiał, gęstość życia i czytelność (pomiary w §2.3); styl ilustrowany przywraca „dom”, a ciemniejszy wariant
zachowuje grozę. Warunki: słownik z §2.1, granice z §3, kryteria z §5.

**Czego gra świadomie nie udaje:** symulatora fabryki, w którym ludzie są kosztem; przytulnej gry bez stawki;
grimdarku nędzy; taktycznego RPG z osobnym ekranem walki; wersji gry z referencji.

## 2. Spójność Między Dyscyplinami (Art, Design, Narracja, Audio, UI)

### 2.1 Wspólny słownik środków wyrazu
Każdy środek ma jedno znaczenie w obrazie, dźwięku, systemach i UI. Nie wolno go „pożyczać” do dekoracji.

| Środek | Znaczy zawsze i tylko | W dźwięku |
|---|---|---|
| ciepła plama światła | życie, praca, bezpieczeństwo | gwar; rytm pracy zgrany z tempem muzyki |
| utrata koloru, chłód | brak światła — kształt i kreska zostają | muzyka traci górę, rośnie pogłos skały |
| drżenie kreski | groza narastająca w mroku | niskie dudnienie, rozstrojone interwały |
| gęste kreskowanie | nieznane, nieodkryte | cisza, szum skały |
| nasycony akcent, błysk | informacja: złoże, magia, zagrożenie | krótki, strojony sygnał |
| gęstość rekwizytów | zamieszkanie; pustka = dzikość albo opuszczenie | warstwy gwaru |
| linia idealnie prosta, bez drżenia | Prakowale: maszyna, obcość | ciągły akord |
| linia światła bez wypełnienia | Pieśń Kamienia i pamięć (Krążki) | chór modalny |
| zanik kreski, popiół unoszący się w górę | Raróg | dźwięk „zgaszony”: bez pogłosu i wysokich tonów |

### 2.2 Punkty styku
- **Palenisko** — budowla (Ognisko → Kamienne → Wielkie), limit ludności, miejsce rozmów drużyny, motyw muzyczny
  grodu i pierwszy kadr gry. Jego poziom jest widocznym poziomem grodu.
- **Zawał w Sali Pierwszego Progu** — symulacja naprężeń, Pieśń Ostrzeżenia i Kołysanka (efekty + chór), licznik
  60 s, odejmowanie koloru i dźwięku, śmierć króla. Proponuję go jako **scenę wzorcową**: w M4 oceniamy ją jako
  całość, nie po działach.
- **Przebudzenie** — jedna liczba, wiele nośników: puls Gardzieli, przygasające lampy w głębi, exodus goblinów,
  muzyka głębi, sny krasnoludów.
- **Pierwsze minuty w nowym biomie** — zapowiedź z bezpiecznego miejsca (R4), zmiana palety i brzmienia, potrzeba
  nowego sprzętu i nowy język budowli w jednym beacie.

### 2.3 Zgrzyty widoczne już dziś
| # | Zgrzyt i dowód | Kierunek rozstrzygnięcia | Kto |
|---|---|---|---|
| 1 | **R2B kontra styl ilustrowany.** W R2B krawędź niesie poświata, nie kreska; bloom i „świecące powietrze” rozmywają kontur. Pomiar zrzutów R2B z rundy 2 turnieju nr 1 (`refstats`): kreska 0,01–0,33% (cel ≥ 3%), w tunelu nocą 43% pikseli silnie nasyconych (chroma > 30; referencja 4,8%), w jaskini 77% czerni. | Kreska przejmuje rolę krawędzi. Poświata zostaje tylko jako światło rozlane od źródła, bloom wyłącznie na emiterach. Światło to plama o miękkim brzegu, nie barwienie całego kadru. | engine-graphics (turniej nr 3), concept-artist |
| 2 | **Dokumenty wciąż wiążą R2B:** `01-world.md` §10 („zgodnie z R2B: ciemna skała”), `05-level-systems.md` §1.4 pkt 7 (pustki kuszą „poświatą krawędzi”), `CLAUDE.md` („Kierunek wizualny: R2B”), opcje R2A „jaśniejszy przekrój” i filtr Kuwahary. | Przepisać na słownik z §2.1. R2A i Kuwaharę wycofać: dostępność zapewni suwak jasności i tryb mocnej kreski w nowym stylu; filtr malarski kłóci się z kreską. | lead-narrative (F2-8), level-systems, producent |
| 3 | **Materiały skalibrowane pod R2B** (`02-materials.md`): iskry HDR, aura 0,08, poświata `uRimTint`, ΔE mierzone nocą. Cel chroma 13–18 obniży akcenty; zagrożone pary: cyna–wapień (5,3), galena–kwarc przy deuteranopii (3,0), obsydian–bazalt (6,0). | Zostaje reguła „matryca + akcent + forma + połysk”; formy minerałów stają się rysowanymi znakami (zmiana stylu im służy), błysk jest rysowany, pary rozsuwa jasność. Obsydian rozpoznawalny po muszlowym przełamie. Powtórzyć galerię, dostosować `tests/palette.test.ts` do kreski. | engine-graphics, concept-artist |
| 4 | **Ton biblii kontra przytulna kreska:** dług dziedziczny 30% ludności, Ogniści zamurowani z dziećmi, KM4 Z3 (wymordowana młodzież), ofiara głosu, porwania z ciemnych sal. W „uroczej” makiecie zabrzmią jak parodia albo okrucieństwo w lukrze. | Godność postaci (bez chibi), tragedia przez odejmowanie (kolor, kreska, dźwięk) i trwałe ślady w świecie; przemoc poza kadrem. | concept-artist, animator-ta, narrative-writer, vfx |
| 5 | **Gobliny: lud czy łup?** `01-world.md` §3: „nie atakują z natury”, uciekają przed Rarogiem. `src/content/biomes.ts`: „sprawdzają, czy przybysze są łatwym łupem”, najazdy z bogactwa; `sources.ts`: `goblin_raider` daje kość (→ klej kostny). | Gobliny zostawiają to, co niosą (rudy, drewno), nigdy części ciała. Częstość najazdów z Przebudzenia, cel z bogactwa (głód idzie do ciepła). Ucieczka i oszczędzenie mają echo w finale. | systems-designer, lead-narrative |
| 6 | **UI kontra makieta:** ponad 10 mierników fabularnych (Przebudzenie, Weksel, Autorytet, 6 frakcji, 9 × Zaufanie, Chciwość, Zdziczenie, Drabina Szychty) plus potrzeby, 11 slotów, 187 receptur, 134 badania. | Nośniki w świecie, liczby w księdze, budżet ekranu (§3, wiersz UI). | ui-ux-designer |
| 7 | **Dwa tryby sterowania** (kolonia pośrednio, wyprawa bezpośrednio z pauzą — `03-companions.md` §1). | Jedna makieta i kamera. Tryb sygnalizuje rama interfejsu, nie przyciemnienie świata — ciemność jest zarezerwowana dla mroku. | ui-ux, gameplay |
| 8 | **Kręgi Otchłani** (`BALANCE.md`: 10 poziomów po ~100 walk z elitami) kontra gra kolonii i sens zakończenia. | Gra po finale to dziedzictwo i cena wybranego zakończenia, nie arena; walki elit jako wyprawy grodu z logistyką. | systems-designer, quest-designer |
| 9 | **Synteza kontra ludowa barwa:** syntezowane skrzypce i chór łatwo brzmią tanio. | Brzmienia, które synteza robi dobrze: szarpane struny, drewno, metal, dzwony, burdon; chór formantowy oszczędnie, tylko dla Pieśni. | composer, sound-designer |
| 10 | **Jedna liczba jasności dla całej gry** (CHARTER §4: L* 36–40), choć mrok jest mechaniką (Progi: praca −40%; R2: groza po 2 dobach w ciemności). | Cele per kontekst: gród oświetlony — jak w CHARTER; odkryta dzika głębia — L* ≥ 26, czerń ≤ 30%, kreska ≥ 3%; Raróg — świadomy wyjątek. Propozycja do weryfikacji w turnieju nr 3. | producent, engine-graphics |

## 3. Kluczowe Decyzje Kierunkowe i Granice Wizji

| Obszar / pytanie kierunkowe | Decyzja / kierunek | Co wspiera w wizji | Czego świadomie NIE robimy |
|---|---|---|---|
| **Kontur** — jaka kreska? | Gruba, lekko nierówna, ciepła prawie-czerń (umbra, nie #000). Trzy grubości według wagi dla gry: granica skała/pustka i postacie → budowle i maszyny → rekwizyty i infrastruktura. Grubość stała w pikselach ekranu; w spoczynku kreska nie drży. | czytelność, ręczność, słownik (drżenie = groza) | jednolitej kreski wektorowej; konturu cel-shadingu na wszystkim (turniej nr 1, S06: „brudzi tło, plastik”); kreski grubiejącej z zoomem |
| **Języki form** — jak odróżnić ludy i epoki? | Każdy język z `01-world.md` §10 ma własną kreskę: krasnoludy — ciężka i spokojna; gnomy — cienka, nerwowa, z zawijasami; Prakowale — idealnie prosta, obca w ręcznym świecie; magia — linia światła; Raróg — brak kreski. | rozpoznanie z dystansu, niepokój ruin | jednego rysunku dla wszystkich |
| **Jasność, czerń i światło** | Trochę ciemniej niż referencja (cele CHARTER §4). Czerń tylko dla kreski, nieznanego i Raroga. Odkryta, nieoświetlona skała — przygaszona, chłodna, z fakturą i kreską: mrok zabiera kolor, nie kształt. Nastrój budują ciepłe plamy światła. | przytulność z kontrastu, światło jako zasób | zgniecionej czerni; równego „biurowego” światła; mgły bloomu na całym kadrze |
| **Paleta i nasycenie** | Baza ziemi, ochry i łupku, chłodny cień, ciepłe światło. Kolor biomu niosą światło i akcenty (historia barw z turnieju nr 2). Nasycenie = informacja; kandydat na metrykę: ≤ 8% pikseli o chroma > 30 w kadrze grodu. | czytelność rud, magii, zagrożeń; zmiana świata w głąb | zalewania kadru barwą lampy (tunel R2B); neonowej tęczy kryształów |
| **Rudy i materiały** | Forma minerału (7 form rud, 4 kryształów) jest głównym nośnikiem i rysuje się kreską; połysk to rysowany błysk; pary rozsuwa jasność. | kopanie jako czytanie skały; daltoniści | rozpoznawania tylko po barwie; aur i iskier HDR jako nośnika |
| **Nieodkryte** | Ciemne, gęste kreskowanie jak niezbadany skrawek mapy. Zapowiedzi (przeciąg, szum wody, ciepło, kości) czytelne z bezpiecznego miejsca; kopanie i Pieśń „dorysowują” świat. | ciekawość, reguła R4 | czarnej pustki; rozmytej mgły |
| **Skala zoomu kamery i głębia 2.5D** | Przy kamerze laboratorium (FOV 30°) cztery odczyty: Izba (~12, krasnolud ~220 px przy 1080p: twarze, faktura), Gród (~35, domyślny, ~75 px — skala referencji: rola z sylwetki), Okolica (~110, ~24 px: sylwetki, światła, zagrożenia), Mapa (cała góra, znaki legendy). Trzy plany: tylna ściana i wnęki (ciemniej, mniej kontrastu), plan gry, krawędź cięcia makiety. Bez obrotu kamery. | czytelność na każdym dystansie, „makieta” | jednego poziomu detalu na wszystkie dystanse; swobodnej kamery 3D; rozmycia głębi ostrości |
| **Gęstość detalu w pomieszczeniach** | Gęstość = zamieszkanie: sale grodu gęsto zastawione (półki, beczki, narzędzia, rury) na planie tylnym o niższym kontraście; dzika głębia rzadka i monumentalna. Poziom budowli widać w materiale: drewno i płótno → kamień i miedź → żelazo, para, runy. | przytulność, postęp widoczny w kadrze | gratów zasłaniających krasnoludy, rudy i zagrożenia; „pustego pudełka z jedną maszyną” |
| **Postacie krasnoludów** — proporcje, czytelność | Krępe, 3–3,5 głowy wzrostu, przerysowane dłonie i narzędzia; broda i warkocze ze znakami cechu. Na widoku roboczym rolę niesie nakrycie głowy i narzędzie, stan — jeden akcent barwny (jak pióropusz na górniczym czaku); twarz dopiero w zbliżeniu. Ruch ciężki i pewny. | czytelność ról, godność postaci | chibi i wielkich głów; szkocko-nordyckiej sztampy (kilty, rogi, pijak jako gag) |
| **Humor vs groza** | Humor ludzi pracy: gwara, docinki Bolka i Mirosza, sucha mądrość Gostomira. Groza miejsca: dźwięk, mrok, głębia. Im głębiej, tym mniej żartu. Tragedia przez nieobecność i konsekwencję. | ton dorosłej baśni | slapsticku, memów, ironii wobec ofiar; epatowania przemocą |
| **Narracja środowiskowa** | Każde pomieszczenie odpowiada: kto tu mieszka, co robi, czego się boi. Decyzje zostawiają trwałe ślady (napis na grobie króla, Ściana Szychty, Strażnica nad Kominem, Ołtarz Ofiarny); ruiny królestwa (rdzawe tory, solne kaplice) opowiadają przeszłość. | pamięć jako temat, echa zadań | ścian tekstu; notatek-wykładów rozrzuconych po korytarzach |
| **Muzyka** | Generatywna, modalna, zależna od głębi i stanu grodu. Na górze skala podhalańska (lidyjska z małą septymą), szarpane struny, drewno, piszczałka, burdon; w głębi mniej melodii, więcej burdonu i chóru; Prakowale — czyste interwały i dzwony. Gród „gra”: rytm młotów w tempie muzyki, w kryzysie rytm się rwie. | tożsamość, słyszalny stan grodu | orkiestry hollywoodzkiej; celtyckiej „krasnoludzkiej” sztampy; chiptune; ciągłej muzyki walki |
| **Dźwięk** | Drugi zmysł przekroju: przez skałę słychać sąsiednie sale, materiał po brzmieniu kilofa, zagrożenie zanim je widać (strop „płacze”, woda za ścianą, syk żaru). Interfejs brzmi drewnem, kamieniem i metalem. | czytelność, reguła R4 | cyfrowych „bipów”; muzyki zagłuszającej sygnały; realistycznego gore |
| **UI** | Stół mierniczego: papier i łupek, ta sama kreska co świat, czytelny krój pisma do liczb. Mierniki najpierw w świecie (puls Gardzieli, dzwon raty, szept korony), liczby na żądanie w księdze. Koszt systemowy (zasoby, Przebudzenie, raty) zapowiedziany przed decyzją; reakcje towarzyszy widoczne dopiero po niej, bez liczb. Na widoku roboczym świat zajmuje ≥ 80% ekranu. | immersja przy dużej skali systemów | HUD-u z MMO; pisma odręcznego w danych; liczb aprobaty w dialogach |
| **Raróg** — antagonista w obrazie i dźwięku | Jedyny byt bez kreski: odejmuje światło, kolor, kreskę i pogłos. Popiół to płatki kreski unoszące się w górę. Przed finałem obecny tylko przez odejmowanie. | groza bez kopiowania archetypu | skrzydeł, bicza, miecza, ryku; czerwono-pomarańczowego „demona ognia” |
| **Oryginalność wobec referencji i tożsamość** | Z referencji bierzemy rodzinę (kreska, plamy, gęste piętra, ciepłe światła), zmieniamy wszystko rozpoznawalne: proporcje postaci, materiały (drewno, kamień, sól, miedź), tła (warstwy skały z głębią), źródła światła (kaganki, kosze żarowe, kryształy), paletę, ikony, UI. Źródła własne: gwara, Skarbnik, Barbórka (Święto Lampy), solne kaplice, podhalańska geometria, dawne mapy kopalń; ornament tylko w miejscach znaczenia (Palenisko, Krążnica, grób króla). | prawo, własny charakter | odrysowywania maszyn, postaci, ikon i teł; białych kafli, płaskiej turkusowej tapety, żarówek na kablach; cepeliady; futharku i celtyckich plecionek; obrazu referencji w repozytorium |

## 4. Łuk Doświadczenia Gracza (Player Journey & Feel)

Łuk prowadzi od pierwszego ognia, który zapala gracz, do decyzji, co zrobić z ogniem, który pożera światło.

| Etap (czas) | Gracz robi | Ma czuć | Czym to budujemy |
|---|---|---|---|
| Kadr otwierający (0–1 min) | patrzy | „wracamy do domu, ale coś tam czeka” | noc na równinie: ognisko wyprawy przy wozie jako jedyna ciepła plama; kamera wspina się po zboczu do łuny i pary nad kraterem; szarpana struna i trzask ognia, bez fanfar |
| Przyjazd (1–3) | rozładowuje wóz u stóp góry, stawia Ognisko | ulga, ciekawość, sympatia do króla | świt; Gostomir mówi pierwszy, krótko i dowcipnie; pierwsze światło zapalone przez gracza otwiera gramatykę gry |
| Nauka skały (3–36) | kopie w zboczu, stawia pochodnie, warzy piwo, znajduje miedź, pisze pierwszą księgę | kompetencja: „umiem czytać skałę” | przekrój „rysuje się” pod kilofem; miedź jako zielone dendryty; licznik ukrytych badań budzi apetyt |
| Pierwsza noc (36–44) | broni obozu przed wilkami | przytulność pod presją | krąg światła obozu = bezpieczeństwo, za nim chłód i kreskowanie; „wilki nie są złe, są głodne” |
| Zejście i zawał (44–60) | schodzi szybem, stawia 4 stemple w 60 s, ratuje uwięzionych | groza → żałoba → odpowiedzialność | zmiana tonu króla; czerwona siatka Ostrzeżenia, pierścienie Kołysanki; po zawale kolor gaśnie, muzyka milknie do jednego głosu; Młot Pamięci; cele bez cięcia ekranu stają się zleceniami |
| Akt I (1–6 h) | rządzi bez korony, odbudowuje Próg, prowadzi śledztwo | niepewność władzy, pierwszy prawdziwy dom | Kamienne Palenisko w odzyskanej sali i pierwsza pełna pieśń karczmy; ścięty stempel prowadzi w dół |
| Akty II–III (6–29 h) | przebija granit, groty, morze, kryształy; automatyzuje; werbuje drużynę | mistrzostwo i zachwyt, pod nimi narastający niepokój | każdy biom zmienia paletę, brzmienie, zagrożenie i język budowli; gród gęstnieje; puls Gardzieli przyspiesza; prawda o strażnikach zmienia sens zbudowanego miasta |
| Akt IV (29–39 h) | idzie przez Pas Magmy do Popielnych i Odźwiernego, przekracza punkt bez powrotu | ciężar winy, presja czasu | dowcipny mentor z samouczka okazuje się głosem dawnego zawału; po otwarciu Bramy Serca światło grodu staje się tarczą — ciemność zabiera ludzi z najciemniejszych sal |
| Akt V — finał (39–40 h) | przygotowuje gród, przydziela role, schodzi Gardzielą | „wszystko, czego się nauczyłem, ma znaczenie” | światło, przez 40 godzin oznaczające życie, staje się bronią i przynętą: gracz zasłania i odsłania lampy w rytm ataku; wybór zakończenia; plansze losu jako ilustracje |
| Po grze (40–120 h) | Wielkie Dzieła, Kręgi Otchłani | „co po nas zostanie” | świat zmieniony zakończeniem (np. Korona Żaru: −30% światła w grodzie); motto z ostatnich słów króla: „Kop dla tych, którzy przyjdą po tobie” |

**Rytm sesji:** każda sesja (1–2 h) kończy się czymś zbudowanym, czymś odkrytym i czymś niepokojącym (drżenie,
szybszy puls, nowy ślad). Na koniec aktu kamera odjeżdża do mapy całej góry — gracz widzi, ile zbudował i jak
głęboko zszedł.

**Co gracz ma wynieść:** król trzymający pieśnią walący się strop; pierwsze rozpalone Kamienne Palenisko; czerwony
puls Gardzieli; cisza w karczmie, gdy przez skałę przechodzi drżenie; cała jego góra na mapie mierniczego.

## 5. Kryteria Oceny „Czy To Pasuje?” i Ryzyka Rozmycia Wizji

### 5.1 Checklista reżyserska (tak / nie)
1. Czy wzmacnia co najmniej jedną oś rdzenia (Ciepło ↔ Głód, Wziąć ↔ Pilnować, Ludzie ↔ Urobek) i żadnej nie osłabia?
2. Czy dzieje się w przekroju — makieta zostaje sceną, a kamera, światło i dźwięk zastępują osobny ekran?
3. Czy czyta się w 1 s na widoku roboczym, także w mroku i przy deuteranopii (kształt i jasność, nie tylko barwa)?
4. Czy używa słownika z §2.1 zgodnie ze znaczeniem (nie pożycza drżenia, kreskowania, nasycenia ani ciemności do dekoracji)?
5. Czy należy do jednego języka form i odróżnia się od pozostałych sylwetką i kreską?
6. Czy ma korzeń w świecie (gwara, tradycja górnicza, wiara, dane treści), a nie w generycznym fantasy?
7. Czy przechodzi test pomyłki — zrzut bez interfejsu nie zostanie wzięty za referencję ani inną grę?
8. Czy humor wynika z ludzi i pracy, a ciężkie tematy są pokazane przez nieobecność i konsekwencję?
9. Czy ma cenę w systemie i czy gracz widzi ją przed decyzją?
10. Czy zostawia w świecie ślad, który gracz zobaczy później?
11. Czy działa we wszystkich trzech scenach tonu: izba wieczorem, przodek w mroku, zawał?
12. Czy szanuje zakazy właściciela (bez oswajania i stworzeń-pracowników, bez cudzych nazw i assetów, wszystko z kodu)?

**Reguła:** „nie” w pytaniu 1, 3, 7 lub 12 — odrzucenie; dwa „nie” w pozostałych — poprawka przed turniejem.

### 5.2 Ryzyka rozmycia wizji
| Ryzyko | Jak pilnujemy |
|---|---|
| **Kopia zamiast rodziny stylu** — najkrótsza droga do celów `refstats` (statystyki zbliżone do referencji) prowadzi do jej odrysowania | metryki mierzą tylko własności obrazu, nigdy podobieństwo; w finale każdego turnieju ślepy test: kadry wymieszane z wycinkami referencji — pomyłka oceniającego = odpada; każda karta konceptu ma sekcję „czym różni się od referencji”; weto game-directora |
| **Rozjazd tonu** — przytulna kreskówka trywializuje fabułę albo „ciemniej” zabija czytelność | trzy sceny tonu obowiązkowe w turniejach (wariant wygrywa tylko, gdy niesie wszystkie trzy); cele jasności per kontekst; zasady godności postaci |
| **Systemy zjadają atmosferę** — nowe mierniki, ekrany i automatyzacja zamieniają gród w arkusz albo halę bez ludzi | nowy miernik bez nośnika w świecie wypada; budżet ekranu (świat ≥ 80%); maszyny przejmują znój, krasnoludy zostają w kadrze; przegląd zrzutów z 1., 10. i 30. godziny gry bota: czy w kadrze nadal żyje gród? |
| **Rozdźwięk fabuły i mechaniki** — gobliny jako łup, chciwość jako strategia dominująca, Raróg jako worek punktów życia | kontrakt fabuła–system: każda deklaracja biblii ma zaczep w systemie i odwrotnie (przegląd lead-narrative + systems); Monte Carlo musi pokazać, że chciwość jest szybsza, ale ryzykowniejsza — nigdy dominująca |
