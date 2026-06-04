
# StakeGamba

Projektstruktur (bereinigt)

- `frontend/` — Vite-Frontend-App
	- `index.html`
	- `vite.config.ts` (base: `./` für statische Uploads)
	- `package.json`, `package-lock.json`, `tsconfig.json`
	- `src/` (Animation, Audio, Design, UI, Game, `main.ts`/`main.js`)
	- `dist/` wird durch `npm run build` erzeugt

- `math/` — Spiel-Mathematik und Publish-Artefakte
	- `game.json` (Manifest für Math/Publish)
	- `math.ts` (Math-Quelle)
	- `docs/` (Upload-Hinweise)
	- `library/publish_files/` (kompilierte Math-Dateien für Stake)

- `_archive/` — archivierte alte Dateien (falls nötig)

Quickstart

1. Frontend (in `frontend/`):

```bash
cd frontend
npm install
npm run build
```

2. Math-Publish erstellen:

```bash
cd frontend
npm run build:math
# erzeugt: math/library/publish_files/golden_goal_rush/math.js
```

Deployment

- Frontend: Lade den Inhalt von `frontend/dist/` auf die Plattform hoch.
- Math: Lade die Dateien aus `math/library/publish_files/<game>/` gemäß Stake-Engine-Anforderungen hoch.


