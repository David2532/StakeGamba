# Stake Engine Upload — World Goal Rush

## Source of Truth

| Zweck    | Ordner           |
|----------|------------------|
| Frontend | `/frontend`      |
| Math     | `/math`          |

## Vorgehen: Build und Upload

```bash
cd frontend
npm run build:upload
# → erzeugt upload/frontend/ und upload/math/
```

Danach diese zwei Ordner bei der Stake Engine hochladen:

### Frontend-Upload → `upload/frontend/`
- `index.html` (alles inline, ein einziger File)
- `version.json`

### Math-Upload → `upload/math/`
- `index.json`
- `game.json`
- `config.json`
- `config_fe.json`
- `config_math.json`
- `books_base.jsonl.zst`
- `lookUpTable_base_0.csv`

## Was nicht hochgeladen wird

- `math/library/publish_files/` — nur intermediärer Compile-Output (math.js)
- `frontend/dist/` — nur intermediärer Vite-Output (vor dem Inlining)
- `stake-front/` / `stake-math/` — veraltete Ordner, nicht mehr genutzt

## Math-Architektur

```
math/src/math.ts          ← Quellcode (TypeScript)
        ↓  build:math:compile
math/library/publish_files/golden_goal_rush/math.js   ← kompiliert
        ↓  generateStakePublish.mjs (Simulation, 4096 Spins)
upload/math/books_base.jsonl.zst
upload/math/lookUpTable_base_0.csv
upload/math/index.json + game.json + config*.json
```
