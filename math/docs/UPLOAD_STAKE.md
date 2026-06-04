# Vorbereitung zum Upload auf Stake Engine

Diese Anleitung betrifft nur den Math-Publish.

Source of truth:
- `math/src/math.ts`
- oeffentlicher Math-Entry: `math/src/index.ts`
- Stake/Game-Entry: `math/games/golden_goal_rush/math.ts`

Upload-Ordner fuer Stake Math:
- `math/library/publish_files/golden_goal_rush/`

Dieser Ordner soll mindestens enthalten:
- `index.json`
- `lookUpTable_base_0.csv`
- `books_base.jsonl.zst`

Zusaetzlich liegt dort:
- `math.js` fuer lokalen Import und interne Validierung
- `game.json` als zusaetzliches Kompatibilitaets-Manifest

Manifest-Pfade:
- im Publish-Ordner referenziert `index.json` die Dateien `books_base.jsonl.zst` und `lookUpTable_base_0.csv`
- auf Repository-Ebene referenzieren `math/index.json` und `math/game.json` dieselben Dateien mit Pfadpraefix `library/publish_files/golden_goal_rush/`
