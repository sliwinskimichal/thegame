# Underhearth — dokument projektowy gry (GDD v2)

> Robocza nazwa. „Under-hearth” = palenisko pod ziemią: serce krasnoludzkiego grodu.
> Szczegółowe listy treści (generowane z danych): [CONTENT.md](CONTENT.md).
> Balans i symulacje: [BALANCE.md](BALANCE.md). Kryteria jakości: [QUALITY.md](QUALITY.md).

## 1. Wizja
Pełnoprawna strategiczna symulacja krasnoludzkiej kolonii w przekroju góry, oglądana jak żywa makieta 2.5D.
Gracz prowadzi garstkę krasnoludów od wozu u podnóża góry, przez dziewięć coraz głębszych biomów, aż do
Serca Góry, gdzie śpi Pożeracz Światła. **Ukończenie: ok. 40 h. Wymaksowanie: ok. 120 h.**

Gra jest oryginalna w swoim gatunku (kolonia + produkcja + eksploracja w widoku z boku).
Inspiracje mechaniczne: łańcuchy produkcji i automatyzacja (Factorio, Satisfactory), biomy kopalni
wymagające nowego podejścia i rzemiosła (Return to Moria), najazdy na bazę i bossowie strzegący terenów
(Palworld — tylko te elementy). **Bez oswajania stworzeń** — pracują wyłącznie krasnoludy i maszyny.

## 2. Filary
1. **Przekrój, który żyje** — makieta z dynamicznym światłem, cyklem dnia, żywymi tunelami.
2. **Głębia wymusza postęp** — każdy biom stawia nowe wyzwanie środowiskowe (mrok, zawały, zalania,
   zarodniki, głęboka woda, mróz, żar, groza), którego nie da się przejść tym, co już masz.
3. **Produkcja ma sens** — każdy surowiec ma źródło i zastosowanie; nowe budowle i ekwipunek wynikają
   z potrzeb kolejnych biomów (pilnują tego testy grafu treści).
4. **Odkrywanie, nie lista zakupów** — drzewko technologii jest zakryte; węzły ujawniają się, gdy
   krasnoludy znajdą kluczowy surowiec. Gracz widzi skalę („jeszcze 23 ukryte badania”), ale nie treść.
5. **Krasnoludy z charakterem** — imiona, cechy, umiejętności, nastrój, piwo; kronika ich losów.

## 3. Pętle rozgrywki
- **Sekundy**: wyznacz kopanie → krasnolud kuje → kafel pęka → łup wypada.
- **Minuty**: zbieraj → przetwarzaj (piec, huta, kuźnia, warsztat) → buduj → wyposażaj → zaspokajaj potrzeby.
- **Godziny**: odkryj nowy biom → poznaj jego zagrożenie → zdobądź próbki → napisz nowe księgi badań →
  odblokuj technologię → zbuduj przeciwdziałanie → pokonaj bossa warstwy → zejdź głębiej.

## 4. Struktura progresji (9 biomów)
| # | Biom | Nowe wyzwanie | Odpowiedź gracza | Boss (trofeum otwiera kluczowe badanie) |
|---|------|---------------|------------------|------------------------------------------|
| 0 | Podgórze | noc, gobliny | obóz, drzwi, balista, miedź | Wilczy Herszt → Kamienne Palenisko |
| 1 | Wapienne Progi | mrok, zawały | pochodnie, stemple, zaprawa, brąz | Królowa Nietoperzy → Wielki piec |
| 2 | Granitowe Korzenie | twarda skała, zalania | żelazo/stal, pompy, koło wodne, kolej | Matka Pełzaczy → Grzybnie |
| 3 | Grzybowe Groty | zarodniki, jad | maski, wentylacja, antidotum, jedwab, proch | Królowa Pajęczyn → Uszczelnienia |
| 4 | Zatopione Głębie | głęboka woda | para: pompy, windy, kolejka; stroje nurków | Lewiatan Jeziora → Szlif klejnotów |
| 5 | Kryształowe Głębie | mróz, mrok | ogrzewanie, ocieplina, optyka, kobalt | Kryształowy Kolos → Kuźnia magmowa |
| 6 | Pas Magmy | żar, lawa, opary | chłodzenie rdzeniami mrozu, obsydian, turbina magmowa | Robak Magmowy → Esencja eteryczna |
| 7 | Prastare Głębiny | groza, konstrukty | runy, lśnit, adamant | Strażnik Ruin → Klucz Serca |
| 8 | Serce Góry | finał | wszystko powyżej | Pożeracz Światła |

Synergie międzywarstwowe (przykłady): futro kretów z granitu ociepla w kryształach; mroźne rdzenie
z kryształów chłodzą w magmie; rdzenie magmy wytapiają adamant w prastarych głębinach.

## 5. Badania
- 127 węzłów w 8 poziomach. Koszt: **księgi badań** pisane w Sali Wiedzy z **próbek najnowszego biomu**
  (np. Mapy mierniczego = pergamin + atrament + węgiel + wapień) — badania ciągną gród w głąb.
- Węzeł ukryty do odkrycia surowca z listy „ujawnia”. Interfejs pokazuje liczbę ukrytych węzłów per poziom.
- Jeden węzeł-klucz na poziom wymaga trofeum bossa poprzedniej warstwy.

## 6. Ekonomia i logistyka
- 26 złóż, 27 surowców kopalnych, 47 surowców z obiektów i stworzeń, 81 materiałów, 91 przedmiotów,
  24 budowle × 3 poziomy, 28 elementów infrastruktury, 184 receptury.
- Logistyka rośnie z głębią: noszenie → zsypy i kołowrót → tory i wagoniki → winda zębata → para
  (winda, kolejka, przenośniki) → wiertła automatyczne na złożach.
- Energia: koło wodne (wymaga strumienia) → maszyna parowa (węgiel + woda) → turbina magmowa (lawa).

## 7. Krasnoludy
Potrzeby (sen, jedzenie, piwo, towarzystwo, światło, piękno), umiejętności rosnące z praktyką
(górnictwo, budownictwo, kowalstwo, warzenie, gotowanie, uprawa, walka, nauka), 2–3 cechy na osobę,
ekwipunek w slotach (kilof, narzędzie, broń, tarcza, głowa, tułów, nogi, ręce, plecy, sprzęt, amulet),
nastrój wpływający na tempo pracy. Populacja: limit Paleniska (10 → 24 → 50), osadnicy przyciągani
bogactwem i karczmą.

## 8. Zagrożenia
34 stworzenia (w tym 9 bossów), najazdy wyzwalane przez bogactwo grodu i reżysera zdarzeń, zjawiska
środowiskowe (zawały, zalania, wylewy lawy, chmury zarodników, wychłodzenie, groza).

## 9. Samouczek (~1 h) i gra swobodna
Samouczek prowadzi przez cele w Podgórzu i pierwszym zejściu do Wapiennych Progów: obóz i Ognisko,
magazyn, pierwsze kopanie w zboczu, światło, kwatery, jedzenie i piwo, odkrycie miedzi, piec i huta,
pierwsze badanie (pokazanie zakrytego drzewka), pierwsza noc z wilkami, zejście szybem z drabinami,
podpory i zawał pokazowy. Kończy się naturalnie: przewodnik („Stary Brodacz”) oddaje stery, a cele
zmieniają się w **zlecenia** (tablica opcjonalnych zadań) — bez twardego przejścia ekranem.

## 10. Kierunek artystyczny i dźwiękowy
Rozstrzygane turniejami wariantów (min. 10 na element, `docs/variants/`). Ograniczenie: wszystko
generowane kodem (brak zewnętrznych tekstur i nagrań). Docelowo: makieta 2.5D, dynamiczne światło,
generatywna muzyka zależna od głębokości.

## 11. Technologia
TypeScript 7, Vite 8, Three.js r187 (WebGL2, własne shadery), Preact + Signals, Vitest.
Treść jako dane (`src/content/`) z analizą progresji (`analysis.ts`) i testami spójności.
Symulacja deterministyczna, oddzielona od renderowania. Hosting: GitHub Pages.

## 12. Poza zakresem
Tryb wieloosobowy; oswajanie stworzeń i stworzenia-pracownicy; postacie sterowane modelem językowym;
mikrotransakcje; zasoby skopiowane z innych gier.
