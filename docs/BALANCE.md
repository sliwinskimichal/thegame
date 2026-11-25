# Balans — cele, model i wyniki symulacji

> Model: `src/balance/model.ts`. Raport: `BALANCE_REPORT=1 npx vitest run tests/balance.test.ts --silent=false`.
> Strażnik regresji (zawsze w CI): ukończenie 34–46 h, wymaksowanie 100–140 h, żaden biom poza 0,55–1,8× celu.

## Cele (od właściciela)
- **Ukończenie gry: ok. 40 h.** **Wymaksowanie: ok. 120 h.** Samouczek ~1 h, potem gra swobodna.

## Uczciwe zastrzeżenie
To **estymacja z modelu**, nie pomiar na graczach. Model liczy pracę krasnoludów potrzebną do
przejścia każdego biomu i przelicza ją na czas rzeczywisty. Po zbudowaniu symulacji gry kalibracja
zostanie powtórzona botem grającym w prawdziwą symulację, a potem na danych z prawdziwych sesji.

## Model w skrócie
1. **Koszt jednostkowy** każdego surowca w danym biomie (sekundy pracy krasnoluda): najtańsza droga —
   kopanie najlepszym kilofem, zbieranie, polowanie albo produkcja na najwyższym dostępnym poziomie
   budynku — plus **transport** zależny od głębokości, udźwigu (plecaki) i logistyki
   (tory i winda zębata → para → wiertła i przenośniki).
2. **Zapotrzebowanie per biom**: badania (koszt ksiąg wg krzywej), poziomy budowli, sprzęt na zagrożenia
   dla wyprawy (8 krasnoludów), zestaw straży, kilofy, **infrastruktura kolonii** (drabiny, pomosty, światło,
   podpory, mury, tory, rury...), kopie budynków produkcyjnych, **elektrownie** dla maszyn, drążenie tuneli.
3. **Siła robocza**: populacja (limit Paleniska 10 → 24 → 50, osadnicy) × efektywność × prędkość gry,
   pomniejszona o **jedzenie i piwo** (posiłek i kufel na krasnoluda na dobę), plus czas walk z bossami,
   pauz i „zabawy” (zwiedzanie, upiększanie).
4. **Monte Carlo**: 200 losowych profili gracza (efektywność, prędkość gry, tempo osadników, ilość kopania,
   czas na bossów, pauzy, zabawa) → percentyle czasu.

## Turniej wariantów krzywej kosztów badań
Koszt węzła = `baza × rozmiar × wzrost^poziom` (× mnożnik wczesnej gry dla poziomów 0–1) ksiąg
bieżącego poziomu + 60% tego w księgach poprzedniego. Sprawdzono **36 + 16 + 12 wariantów**; ocena:
suma kwadratów log-odchyleń od celów per biom + 3× log-odchylenie sumy.

| Wariant (najlepsze) | Wynik | Suma | Czas per biom (h) |
|---|---|---|---|
| **baza 7, wzrost 1,33, wczesna 0,6 — WYBRANY** | 0,323 | 40,4 h | 2,2 4,6 6,9 4,6 5,5 5,6 3,7 5,7 1,5 |
| baza 6,5, wzrost 1,36, wczesna 0,6 | 0,317 | 41,1 h | 2,2 4,6 6,8 4,6 5,7 5,7 3,9 6,2 1,5 |
| baza 8, wzrost 1,30, wczesna 0,6 | 0,333 | 41,0 h | 2,2 4,8 7,2 4,8 5,7 5,6 3,7 5,6 1,5 |
| baza 4, wzrost 1,18 (pierwotny) | — | 27,2 h | gra za krótka o ⅓ |

Wybrano wariant o niemal najlepszym wyniku, ale z łagodniejszym końcem (T7 5,7 h zamiast 6,2 h).

**Wniosek projektowy z turnieju:** Pasa Magmy nie dało się wyważyć samą krzywą — miał za mało treści.
Dodano inżynierię lawy (kanały, zasuwy), sieć chłodzącą, architekturę obsydianową, hartowanie w magmie
(wydajne receptury), obronę ogniową; grotom — lampy zarodnikowe i mosty linowe; turbina magmowa stała się
warunkiem wytopu adamantu. T6 wzrósł z 2,5 h do 3,7 h.

## Wynik: pierwsze ukończenie (krzywa wybrana)
| Biom | Cel (h) | Model (h) | Praca (krasnoludo-godziny) | Populacja |
|---|---|---|---|---|
| 0 Podgórze (z samouczkiem) | 2 | 2,2 | 5 | 10 |
| 1 Wapienne Progi | 4 | 4,6 | 21 | 24 |
| 2 Granitowe Korzenie | 6 | 6,9 | 52 | 24 |
| 3 Grzybowe Groty | 5 | 4,6 | 35 | 24 |
| 4 Zatopione Głębie | 6 | 5,5 | 50 | 24 |
| 5 Kryształowe Głębie | 6 | 5,6 | 72 | 45 |
| 6 Pas Magmy | 5 | 3,7 | 63 | 50 |
| 7 Prastare Głębiny | 5 | 5,7 | 112 | 50 |
| 8 Serce Góry | 1 | 1,5 | 13 | 50 |
| **Razem** | **40** | **40,4** | | |

Monte Carlo (200 profili): **P10 33,5 h · P50 41,3 h · P90 55,2 h**.
Na ścieżce ukończenia leży 93 ze 134 węzłów badań; pozostałe służą wydajności, wygodzie i wymaksowaniu.

## Wymaksowanie (~120 h)
Wszystkie badania i poziomy budowli po drodze (≈60 h), a potem faza końcowa:
- **8 Wielkich Dzieł × 3 etapy** (megaprojekty na tysiące bloków, szkła, stali — wymagają automatyzacji),
- **Kręgi Otchłani** — 10 proceduralnych poziomów pod Sercem Góry (każdy: ~9000 kafli, wysunięta baza,
  ~100 walk z elitami), **do zaprojektowania w fazie E**,
- legendarny ekwipunek dla 50 krasnoludów, bestiariusz (każdy gatunek ×10), dekoracje.

Model: **106 h** (deterministycznie), **P50 111 h** — w przedziale celu; po implementacji Otchłani
zostanie dociągnięty do 120 h na danych z bota.

## Znane ograniczenia modelu
- Zakłada sprawnego gracza, który nie traci kolonii; katastrofy (zalanie, zawał, najazd) są w czasie „zabawy”.
- Walka jest uproszczona (DPS vs HP); bossowie jako stały narzut czasu.
- Logistyka to średni dystans per biom, nie prawdziwe ścieżki.
- Liczby kosztów budowli i receptur są pierwszą wersją; kalibracja na żywej symulacji w fazie F.
