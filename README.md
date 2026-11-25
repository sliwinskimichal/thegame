# Underhearth

Krasnoludzka kolonia w przekroju góry, renderowana jak żywa makieta 2.5D w przeglądarce.
Kop coraz głębiej, buduj podziemny gród, rozpalaj Palenisko i stawiaj czoła temu, co śpi w głębinach.

> Projekt w budowie — plan na miesiąc pracy: [docs/ROADMAP.md](docs/ROADMAP.md).
> Projekt gry: [docs/GDD.md](docs/GDD.md). Kryteria jakości: [docs/QUALITY.md](docs/QUALITY.md).

## Zagraj
Gra jest publikowana na GitHub Pages przy każdym pushu na domyślną gałąź repozytorium
(workflow `.github/workflows/deploy.yml`). Jednorazowo trzeba włączyć Pages:
**Settings → Pages → Build and deployment → Source: GitHub Actions**.

## Uruchomienie lokalne
```bash
npm install
npm run dev
```
Następnie otwórz http://localhost:5173.

## Technologia
TypeScript 7 · Vite 8 · Three.js r187 (WebGL2, własne shadery) · Preact · Vitest.
Cała grafika i dźwięk są generowane proceduralnie — bez zewnętrznych tekstur i nagrań.
