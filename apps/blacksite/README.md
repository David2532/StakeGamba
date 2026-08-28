# BLACKSITE // BREACH V19

Lifecycle: **5x3 CLASSIC-SLOT CANDIDATE / NOT RELEASED / NOT STAKE-APPROVED**

V19 is the final presentation and runtime revision built over the authoritative `blacksite-book-events-v3` package. The V3 math, event schema, payout behavior and thirteen canonical symbol IDs are unchanged. The internal trigger ID remains `breach` for strict book compatibility; every player-facing surface presents that symbol and feature as **VAULT**.

The game uses a premium raster machine shell, substantial WebP reel symbols, an asset-backed bottom HUD, ten fixed paylines and explicit spin, win, loss, bonus and restore states. Operations Hub exposes Continue, Select Mode and Game Guide; INFO opens the same five-tab guide. A VAULT trigger enters a bounded cinematic access sequence and finishes on an Extraction Report with an explicit Return to Base action.

## Game contract

- Three, four or five matching symbols from the left pay on each always-active line.
- GHOST WILD substitutes for regular symbols and has its own line pay.
- Three VAULT symbols (internal ID `breach`) on distinct reels award eight BLACKOUT free spins.
- One authoritative regular target expands on every containing reel during BLACKOUT.
- Every displayed board, line win, free-spin counter, payout and settlement comes from the RGS/book event stream and is independently validated in the browser adapter.

## V19 presentation runtime

- Seven manifest-backed operator sequences cover idle/watch, single loss, loss-streak frustration, win, big win, bonus toss and the optional terminal-smash reaction. Rage Out is disabled by default and can only be enabled explicitly in Settings.
- Two-buffer WebP playback keeps operator reactions responsive without decoding an entire sequence into memory. Static key poses remain available as deterministic fallbacks.
- VAULT access, blackout and extraction scenes are raster WebP assets driven by authoritative feature cues. Normal, turbo and reduced-motion timelines are bounded and skippable without changing settlement.
- Reel motion uses five WebP strips; win emphasis, dimming, anticipation, trigger, standalone effects and semantic audio are coordinated by runtime directors rather than by decorative timers.
- The production static asset tree contains WebP artwork plus its JSON manifest. It does not depend on prototype SVG or PNG UI artwork.

## Launch boundaries

- Live launch requires a valid HTTP(S) `rgs_url`. Missing or invalid values fail closed with a visible recovery surface; no local paid-round fallback is started.
- Replay performs one exact read-only request and never writes wallet, event or end-round state.
- Development fixtures require Vite development mode and explicit `?dev_fixture=<fixture_id>`. A production build rejects fixture launch instead of simulating a paid round.
- Stake nested-path and hostile `file://` base handling resolve package assets from the real HTTPS frame location.

## Commands

```text
pnpm --filter blacksite test
pnpm --filter blacksite lint
pnpm --filter blacksite build
pnpm --filter blacksite dev
```

`base_zero` mirrors published V3 book `base/1`. The unchanged internal math candidate is fingerprint `a30e33d3aa5b7b121cc94053306944f22714888952a95f5432177121e591a2d7` with event-schema SHA-256 `8d68ffcf0d47fdf20648868d975d2cd944dd4892ac5bd9bf411f6d96b8834b75`. These identities prove repository consistency only; they do not claim external approval or release readiness.
