# Vorbereitung zum Upload auf Stake Engine (Checkliste)

Kurzanleitung, wie dieses Repo für Stake vorbereitet werden kann:

1. Build

```bash
npm install
npm run build:ts
```

Dadurch wird `math.ts` nach `front/math.js` transpiliert. Ergänze weitere Build-Schritte falls dein Frontend Assets/Bundling braucht.

2. Struktur

- `front/` — Client-Assets (z.B. `index.html`, `math.js`, Bilder, CSS)
- `backend/` — Provably-fair / RNG Endpoints (z.B. `/server-seed-hash`, `/reveal-server-seed`)

3. `game.json` (Stake-Anforderungen)

Erstelle eine `game.json` mit Metadaten (Name, Version, author, entry: `front/index.html`, rtp, assets list). Beispielstruktur in Stake-Dokumentation prüfen.

4. HTTPS-Hosting

Alle Assets müssen über HTTPS erreichbar sein. Host `front/` statisch (z.B. S3, Netlify) oder zippe das Paket, falls Stake Upload erlaubt.

5. Provably-Fair

Stelle sicher, dass du ServerSeed-Hash veröffentlichst, Spielinstanzen ClientSeed verwenden, und nach Session ServerSeed offenlegst. Anpassungen am `math.ts` können nötig sein, um ClientSeed/ServerSeed zu kombinieren.

6. Tests

Teste lokal mit `vite` oder statischem Server, verifiziere RTP/MaxWin mit Simulationen.
