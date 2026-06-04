# Vorbereitung zum Upload auf Stake Engine

Diese Anleitung betrifft nur den Math-Publish.

Source of truth:
- `math/src/math.ts`
- oeffentlicher Math-Entry: `math/src/index.ts`
- Stake/Game-Entry: `math/games/golden_goal_rush/math.ts`

Upload-Ordner fuer Stake Math:
- `math/library/publish_files/golden_goal_rush/`

Dieser Ordner soll mindestens enthalten:
- `math.js`
- `index.json`

Kompatibilitaetshalber liegt dort auch `game.json`.

Manifest-Pfade:
- im Publish-Ordner zeigen `index.json` und `game.json` auf `math.js`
- auf Repository-Ebene zeigt `math/index.json` auf `library/publish_files/golden_goal_rush/math.js`
