# Vorbereitung zum Upload auf Stake Engine

Diese Anleitung betrifft nur den Math-Publish.

Source of truth:
- `math/src/math.ts`
- oeffentlicher Math-Entry: `math/src/index.ts`
- Stake/Game-Entry: `math/games/golden_goal_rush/math.ts`

Upload-Ordner fuer Stake Math:
- `stake-math/`

Alternative interne Quelle:
- `math/library/publish_files/golden_goal_rush/`

`stake-math/` enthaelt genau die Dateien fuer den ACP-Upload:
- `index.json`
- `game.json`
- `lookUpTable_base_0.csv`
- `books_base.jsonl.zst`

Im internen Publish-Ordner liegt zusaetzlich:
- `math.js` fuer lokalen Import und interne Validierung

Manifest-Pfade:
- im Publish-Ordner referenziert `index.json` die Dateien `books_base.jsonl.zst` und `lookUpTable_base_0.csv`
- auf Repository-Ebene referenzieren `math/index.json` und `math/game.json` dieselben Dateien mit Pfadpraefix `library/publish_files/golden_goal_rush/`

Empfohlener Upload:
- Front End: `stake-front/`
- Math: `stake-math/`
