# Underhearth — dokument projektowy gry (GDD)

> Robocza nazwa. „Under-hearth” = palenisko pod ziemią: serce krasnoludzkiego grodu.

## 1. Wizja
Strategiczna symulacja kolonii w przekroju góry, widzianym jak żywa makieta 2.5D. Prowadzisz
garstkę krasnoludów, które zaczynają od wozu u podnóża góry, a kończą jako gród sięgający
Serca Góry, setki kafli pod powierzchnią. Każdy wykopany kafel to decyzja: odsłania rudy,
jaskinie, wodę, ruiny — i rzeczy, które powinny były pozostać pogrzebane.

Gra należy do gatunku kolonii z widokiem z boku (kopanie, budowanie, zarządzanie postaciami),
ale jest **oryginalna**: własny świat, postacie, grafika i mechaniki. Nie kopiujemy żadnej
istniejącej gry — ani jej nazw, postaci, wyglądu, ani poziomów.

## 2. Filary
1. **Przekrój, który żyje** — świat jest dioramą: tunele wykute w głąb płyty skalnej, światło
   pochodni rozlewa się po ścianach, w głębi pulsują kryształy i lawa, na powierzchni mija dzień i noc.
2. **Kopanie to decyzja** — nie widzisz, co kryje skała. Kopiesz po rudę, ale możesz przebić się
   do zalanej groty albo gniazda pająków. Ryzyko rośnie z głębokością, nagrody też.
3. **Światło kontra mrok** — światło to bezpieczeństwo, wydajność i nastrój. Potwory lubią ciemność.
   Pochodnie, kryształowe lampy i ogień paleniska to infrastruktura, nie ozdoba.
4. **Krasnoludy z charakterem** — każdy ma imię, brodę, cechy, umiejętności, nastrój i relacje.
   Z ich działań rodzi się kronika grodu — historie, które gracz opowiada potem znajomym.
5. **Głębia jako opowieść** — siedem warstw to siedem rozdziałów, każdy z własną paletą,
   muzyką, surowcami i zagrożeniami. Na dnie czeka finał.

## 3. Co robimy nowocześnie (względem klasyki gatunku z lat 90.)
- Dynamiczne światło i cienie w czasie rzeczywistym, bloom, cykl dnia, makieta 3D zamiast płaskich sprite'ów.
- Zero mikrozarządzania: przeciągasz obszary, krasnoludy same dzielą się pracą wg priorytetów i umiejętności.
- Czytelność: nakładki (światło, pokoje, ścieżki), podpowiedzi, kolejka rozkazów w pauzie, przyspieszanie czasu.
- Emergentne historie (kronika), reżyser zdarzeń dopasowujący tempo zagrożeń do sytuacji gracza.
- Seed świata do udostępniania, wyzwanie dnia (ten sam świat dla wszystkich).
- Przeglądarka bez instalacji, PWA offline, zapis lokalny, sterowanie myszą, klawiaturą i dotykiem.
- Dostępność: rudy rozróżnialne kształtem wzoru (nie tylko kolorem), skalowanie UI, język PL/EN.

## 4. Pętle rozgrywki
- **Sekundy**: wyznacz kopanie → krasnolud idzie, kuje (iskry, pył, odłamki) → kafel znika → łup wypada.
- **Minuty**: zbieraj surowce → buduj warsztaty i pomieszczenia → produkuj (sztabki, narzędzia, piwo, posiłki)
  → zaspokajaj potrzeby → przyciągaj nowych osadników.
- **Godziny**: schodź coraz głębiej → odblokowuj technologie i surowce warstw → broń gród przed
  coraz groźniejszymi potworami → dotrzyj do Serca Góry.

## 5. Świat — warstwy
| # | Warstwa | Skały | Surowce | Zagrożenia | Nastrój |
|---|---------|-------|---------|------------|---------|
| 0 | Podgórze | gleba, glina, piasek | miedź (rzadko), drewno z drzew na powierzchni | dzikie zwierzęta, gobliny z powierzchni | ciepło, zieleń, słońce |
| 1 | Wapienne Progi | wapień, piaskowiec, łupek | węgiel, miedź, żelazo | nietoperze, zawały | ziemiste, przytulne |
| 2 | Granitowe Korzenie | granit, łupek ilasty | żelazo, srebro, miedź | pełzacze jaskiniowe | chłodne, twarde |
| 3 | Grzybowe Groty | wapień, łupek, grzybnia | srebro, złoto, drewno grzybowe | pająki, grzybowi strażnicy | bioluminescencja, turkus |
| 4 | Kryształowe Głębie | łupek, bazalt | kryształy, ametyst, złoto | trolle | zimny blask, fiolet i błękit |
| 5 | Pas Magmy | bazalt, obsydian, skała magmowa | żaryt, złoto | ogniste chochliki, wylewy lawy | żar, czerwień |
| 6 | Prastare Głębiny | bazalt, łupek, starożytna cegła | lśnit (legendarny metal) | koszmary głębin | mrok, runy, cisza |
| — | Serce Góry | skała macierzysta | — | Strażnik | finał |

## 6. Krasnoludy
- **Potrzeby**: sen, jedzenie, picie (piwo daje bonus nastroju), towarzystwo, światło, piękno otoczenia.
- **Umiejętności** (rosną z praktyką): górnictwo, budownictwo, kowalstwo, warzenie, gotowanie,
  uprawa, walka.
- **Cechy** (2–3 na osobę), np. Pracowity, Leniwy, Odważny, Tchórzliwy, Piwosz, Klaustrofob,
  Ciemnolubny, Śpiewak, Mruk, Złotoręki.
- **Imiona**: brzmienie krasnoludzkie + polski przydomek („Borin Żelaznobrody”, „Thrain Kamienioręki”).
- **Nastrój** wpływa na tempo pracy; skrajny prowadzi do załamań (odmowa pracy, pijaństwo, ucieczka).

## 7. Ekonomia i produkcja
Kamień → bloki (kamieniarz) · Ruda + węgiel → sztabki (huta) · Sztabki → narzędzia, broń, zbroje (kuźnia) ·
Grzyby → posiłki (kuchnia), piwo (browar) · Drewno / drewno grzybowe → drabiny, platformy, łóżka, stoły.
Bogactwo grodu (wartość wydobycia, budowli i wyrobów) przyciąga osadników i … uwagę potworów.

## 8. Budowle
Infrastruktura: drabina, platforma, schody, drzwi, pochodnia, kryształowa lampa, podpora, mur.
Pomieszczenia: magazyn, sypialnia, jadalnia, sala Paleniska. Warsztaty: kamieniarz, huta, kuźnia,
browar, kuchnia, farma grzybów, stolarnia. Obrona: kolce, zapadnie, balista, runy ochronne.
**Palenisko** — serce grodu; jego ulepszenia wyznaczają poziomy rozwoju i odblokowania.

## 9. Zagrożenia
Potwory zależne od warstwy i światła; gniazda budzą się po przebiciu się do ich jaskini.
Zdarzenia: zawały stropów bez podpór, zalanie tunelu po przebiciu do wody, wylew lawy, najazd goblinów.
Reżyser zdarzeń dozuje napięcie wg bogactwa, liczebności i głębokości.

## 10. Cel i progresja
Dotrzeć do Serca Góry i pokonać Strażnika. Po drodze: kamienie milowe głębokości, kolejne poziomy
Paleniska, technologie (lepsze kilofy, lampy, maszyny), kronika grodu. Potem tryb nieskończony.

## 11. Sterowanie
Mysz: przeciąganie obszarów rozkazów, PPM/środkowy — przesuwanie, kółko — zoom do kursora.
Klawiatura: WASD/strzałki, spacja — pauza, 1/2/3 — prędkość, skróty narzędzi (K kopanie, B budowa,
X anuluj, L drabina, T pochodnia). Dotyk: jeden palec — narzędzie, dwa — przesuwanie i zoom.

## 12. Kierunek artystyczny
Makieta: przekrój płyty skalnej oglądany kamerą o wąskim kącie, z lekką paralaksą. Geometria
low-poly + bogate, proceduralne materiały w shaderach (warstwy, żyłki rud, fasetki kryształów,
pęknięcia magmy). Ciepłe światło ognia kontra zimny blask głębin. Bloom na źródłach światła,
delikatna winieta i ziarno. Żadnych zewnętrznych tekstur — wszystko generowane kodem.

## 13. Kierunek dźwiękowy
Dźwięki generowane (Web Audio): stuk kilofa zależny od materiału, osuwanie się skał, kapanie wody,
echo jaskiń rosnące z głębokością. Muzyka generatywna: ciepłe bordunowe akordy przy powierzchni,
coraz mroczniejsza i rzadsza w głębi, bębny podczas walki.

## 14. Technologia
TypeScript 7, Vite 8, Three.js r187 (WebGL2, własne shadery GLSL), Preact + Signals dla UI,
Vitest. Symulacja oddzielona od renderowania (czysty TS, deterministyczny RNG z seeda).
Hosting: GitHub Pages (workflow w `.github/workflows/deploy.yml`).

## 15. Poza zakresem (świadomie)
Tryb wieloosobowy; postacie sterowane modelem językowym (wymagałyby backendu i kluczy API);
zakupy w grze; jakiekolwiek zasoby skopiowane z innych gier.
