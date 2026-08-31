# BLACKSITE // BREACH V39

Lifecycle: **5×3 INTERNAL QA SNAPSHOT / NOT RELEASED / NOT STAKE-APPROVED**

The exact current branch, implementation commit, runtime ownership and
superseded-package policy live in
[`docs/blacksite/CURRENT_SLOT_STATE.md`](../../docs/blacksite/CURRENT_SLOT_STATE.md).
Do not use a historical V19/V36 document or an `asset_rev` URL label to choose
which implementation to build.

## Current game contract

V39 is a presentation and asset revision over the unchanged authoritative
`blacksite-book-events-v3` package:

- five reels by three rows;
- ten fixed, always-active paylines;
- thirteen canonical internal symbol IDs;
- GHOST WILD substitutes for regular symbols and has its own line pay;
- three VAULT symbols (internal ID `breach`) on distinct reels award eight
  BLACKOUT free spins;
- one of eleven regular symbols is selected and expands on every containing
  reel during the feature;
- every board, win, feature counter, payout and settlement remains owned by
  the RGS/book event stream.

The V39 pass keeps the Penguin, encrypted-drive/tablet, WILD, K and J art;
redesigns the other eight symbol families without changing their IDs; rebuilds
all five visual spin strips; uses a shopping cart for the free-spin purchase
action; and corrects short-landscape HUD registration while retaining the
authored V21/V22/V27 raster surfaces.

## Runtime sequence

Normal startup is V33 Vault video → V33 rules/start screen → slot. The
BLACKOUT feature keeps the canonical V26 Vault film. V29 owns the curated
runtime audio package. Historical packages remain in the repository for
provenance but the production pruner excludes superseded symbol, reel-strip
and glyph copies.

## Launch boundaries

- Live launch requires a valid HTTP(S) `rgs_url`; invalid or missing launch
  state fails closed instead of starting a local paid-round fallback.
- Replay is read-only and does not mutate wallet, event or end-round state.
- Development fixtures require Vite development mode and an explicit
  `?dev_fixture=<fixture_id>` query. Production builds reject fixture launch.
- Stake nested-path and hostile `file://` base handling resolve package assets
  from the real HTTPS frame location.

## Commands

```text
pnpm --filter blacksite test
pnpm --filter blacksite lint
pnpm --filter blacksite build
pnpm --filter blacksite dev
```

Local deterministic view:

```text
http://127.0.0.1:3002/?dev_fixture=base_natural_blackout&asset_rev=repo_snapshot_v39
```

The unchanged math fingerprint is
`a30e33d3aa5b7b121cc94053306944f22714888952a95f5432177121e591a2d7`;
the event-schema SHA-256 is
`8d68ffcf0d47fdf20648868d975d2cd944dd4892ac5bd9bf411f6d96b8834b75`.
These identities prove repository consistency only. Manual device, audible,
rights, exact-package and external Stake review remain separate gates.
