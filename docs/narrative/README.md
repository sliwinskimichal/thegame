# Biblia narracyjna Underhearth

Świat, drużyna i zadania gry o krasnoludach, którzy wracają do góry Kuźnicy — i odkrywają, że ich przodkowie
nie byli górnikami, lecz strażnikami czarnego ognia.

| Dokument | Rola | Zawartość |
|---|---|---|
| [00-research.md](00-research.md) | Lead Narrative Designer | Tolkien, WoW, Sanderson, Lynch, Dragon Age: Origins, Mass Effect 2, folklor górniczy — co bierzemy, co przerabiamy, czego nie wolno |
| [01-world.md](01-world.md) | Lead Narrative Designer | kosmologia, kalendarium, ludy, 6 frakcji (interesy, urazy, filozofie), stany, panteon, Pieśń Kamienia, druidyzm, Krążki Pamięci, kierunek artystyczny techniki, nauki i magii |
| [02-campaign.md](02-campaign.md) | Lead Narrative Designer | samouczek ze starym królem Gostomirem i jego śmierć w zawale, 5 aktów, Raróg — Pożeracz Światła, zakończenia |
| [03-companions.md](03-companions.md) | Lead Narrative Designer | 9 towarzyszy (frakcja, stan, światopogląd), misje rekrutacyjne, dwie pary tarcia, role w finale |
| [04-quests.md](04-quests.md) | Senior Quest Designer | 14 dokumentów zadań: 5 kamieni milowych i 9 misji lojalnościowych |
| [05-level-systems.md](05-level-systems.md) | Senior Level & Systems Designer | układ góry, Gardziel jako punkt orientacyjny, linie prowadzące, ekonomia ryzyka, gęstości zasobów, bramy progresji |

## Słowniczek
| Nazwa | Co to |
|---|---|
| **Kuźnica** | samotna góra; wnętrze przebudowane przez Prakowali w maszynę |
| **Gród Pod Paleniskiem** | dawna i odbudowywana twierdza krasnoludów (Underhearth) |
| **Gardziel** | pionowa rozpadlina od krateru do Serca; główny punkt orientacyjny |
| **Raróg, Pożeracz Światła** | czarny ogień w Sercu Góry; „Ten Pod Spodem” |
| **Prakowale** | dawna cywilizacja, która zaprzęgła Raroga i zgasła |
| **Ociosani** | kamienni słudzy Prakowali; przodkowie krasnoludów |
| **Pierwszy Wybór** | zamiana kamienia na ciało — za cenę pamięci |
| **Odźwierny** | ostatni Ociosany, strażnik Bramy Serca |
| **Pieśń Kamienia** | magia rezonansu skały (Nasłuch, Ostrzeżenie, Kołysanka, Klucz, Odczyt, Pieczęć) |
| **Krążki Pamięci** | kamienne dyski z obrazem i głosem; Krążnica — sala, w której się je odtwarza |
| **Słupy Akordów** | maszyny Prakowali w Gardzieli nucące kołysankę |
| **Weksel Kuźnicy** | pożyczka Bractwa Wagi pod zastaw urobku; 7 lat na spłatę |
| **Ósma Szychta** | brygada zastawnych pod wodzą Dzierżka |
| **Namiestnik** | postać gracza — następca wskazany przez umierającego króla |
| **Przebudzenie** | miernik budzenia się Raroga (0–100) |
| **Szczęść Głębi!** | krasnoludzkie pozdrowienie górnicze |

## Konsekwencje dla danych i systemów (do wdrożenia w fazie C)
- **Nowe systemy**: wyprawy drużyny (sterowanie bezpośrednie z pauzą), Palenisko jako hub rozmów, Zaufanie
  i lojalność towarzyszy, Autorytet Namiestnika, stosunki 6 frakcji, Przebudzenie, Weksel (raty), Chciwość,
  dekrety Namiestnika, Kronika, zdarzenia rocznicowe, przydział ról w finale.
- **Nowe zawody i zdolności**: Śpiewak Kamienia (6 pieśni), druid (4 formy, Zdziczenie), wynalazca-gnom (prototypy).
- **Nowe budowle i obiekty fabularne** (do biblii treści): Krążnica, Pracownia Wynalazków, Strażnica nad Kominem,
  Strażnica Pieczęci, Osadnik (filtr odpadów huty), Krąg (druidzi), Gaj Pamięci, Ściana Szychty, Grób Króla,
  Bank Kuźnicy, Dom Magdy, Ołtarz Ofiarny, Obserwatorium Żaru, Pracownia Harmoniczna, Pomnik Niedokończonego.
- **Nowe przedmioty i zasoby**: Młot Pamięci, 6 odłamków Krążka Gostomira, 48 Krążków Pamięci, korona z czarnego
  złota, kamertony Iskry, (propozycja) piorunit ze Szczytu Burz.
- **Zmiany istniejących danych**: boss `light_eater` → „Raróg, Pożeracz Światła”; boss `ruin_guardian` →
  Odźwierny z opcją rozwiązania Pieśnią; wysokość świata 480 → ok. 720 kafli (`src/config.ts`, faza B1);
  gęstości złóż z `05-level-systems.md` §2.2 jako parametry generatora.
- **Testy**: kompletność zadań jako danych (każda misja lojalnościowa ma 2–3 wykluczające się zakończenia z ceną
  i ≥ 2 echa; każdy towarzysz ma frakcję, stan, światopogląd, rekrutację, lojalność i ocenę ról finału).
