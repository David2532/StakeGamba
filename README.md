# World Goal Rush — Championship Edition

## Projektstruktur

```
/frontend               ← EINZIGE Frontend-Quelle (hier arbeiten)
  index.html            ← Spiel-Quellcode (Phaser, UI, CSS, inline JS)
  src/                  ← TypeScript-Module (Animation, Audio, Config, …)
  vite.config.ts
  package.json          ← alle Build-Scripts

/math                   ← EINZIGE Math-Quelle (hier arbeiten)
  src/
    math.ts             ← Kern-Spiellogik (SlotMath, RNG, Cluster-Engine)
    index.ts            ← Öffentlicher Export
    symbols.ts / paytable.ts / config.ts / types.ts
  scripts/
    generateStakePublish.mjs
  games/golden_goal_rush/math.ts  ← Stake-Entry-Point

/upload                 ← NUR Build-Output — nie direkt bearbeiten!
  frontend/             → Stake Engine: Frontend hochladen
  math/                 → Stake Engine: Math hochladen
```

## Build-Befehle (alles in `frontend/` ausführen)

```bash
cd frontend
npm install             # einmalig nach Clone

npm run dev             # Dev-Server auf localhost:5173

npm run build:upload    # ALLES: Math + Frontend → upload/   ← Standard-Upload-Build
npm run build:math      # nur Math neu → upload/math/
npm run build:frontend  # nur Frontend neu → upload/frontend/
```

## Stake Engine Upload

Nach `npm run build:upload` genau diese zwei Ordner hochladen:

| Stake-Bereich | Ordner            |
|---------------|-------------------|
| **Frontend**  | `upload/frontend/` |
| **Math**      | `upload/math/`    |

Sonst nichts — kein `stake-front/`, kein `stake-math/`, kein `frontend/dist/`.

## Regeln

- Quellcode nur in `/frontend` und `/math` bearbeiten
- `/upload` nie direkt editieren — wird beim nächsten Build überschrieben
- `math/library/` nicht committen — nur intermediärer Compile-Output
