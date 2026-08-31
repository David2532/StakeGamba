# BLACKSITE // BREACH — Current Slot State

Status: **V39 implementation snapshot / internal QA / not released / not Stake-approved**

Branch: `codex/blacksite-ui-v39`

Implementation commit: `25b384c238b63be34f78a17bce9e4da798ab323e`

Snapshot date: `2026-08-31`

This file is the first source to read when choosing which BLACKSITE frontend
state to run or edit. Historical version documents remain useful evidence, but
they do not select the current slot. The `asset_rev` query parameter is only a
development cache-busting label; the checked-out branch and commit are the
actual source identity.

## Authoritative game contract

- Math and event contract: `blacksite-book-events-v3`.
- Math candidate fingerprint:
  `a30e33d3aa5b7b121cc94053306944f22714888952a95f5432177121e591a2d7`.
- Event-schema SHA-256:
  `8d68ffcf0d47fdf20648868d975d2cd944dd4892ac5bd9bf411f6d96b8834b75`.
- Board: five reels by three rows, ten fixed paylines, thirteen canonical
  internal symbol IDs.
- Book-style feature: three `breach` symbols, shown to the player as VAULT,
  on distinct reels award eight free spins. One of the eleven regular symbols
  is selected and expands to fill every reel on which it lands.
- V39 changes presentation assets and alignment only. It does not change
  probabilities, strips/books used by math, payouts, mode costs, wallet state,
  RGS settlement, replay normalization, or the feature rules.

## Current presentation ownership

| Surface | Current owner |
| --- | --- |
| Responsive machine shell and reel stage | V22 raster package |
| Control geometry and rectangular HUD surfaces | V21/V22 raster packages |
| Buy glyph | V39 cart-only overlay on the V21 glyph atlas geometry |
| Feature HUD cards and dialog support surfaces | V27 raster package |
| Command-layout CSS lineage | V36 layout with V37 hard-clean and V38 asset restoration |
| Current DOM revision markers | `data-ui-revision="v39"`, `data-polish-revision="repo-snapshot-v39"` |
| Tactical Penguin character | canonical V20 character package |
| Penguin reel symbol | V22 operative state pack |
| Current symbol/reel presentation | mixed retained assets plus V39 redesigned packs and five V39 spin strips |
| Normal startup | V33 Vault video, then V33 rules/start screen, then slot |
| BLACKOUT feature film | V26 Vault-opening package |
| Runtime audio | curated V29 RuntimePack V1 |

The information and settings glyphs use the authored atlas and are centered by
the corrected short-landscape right-rail geometry. `TOTAL BET` is kept on one
line within its authored meter. The free-spin purchase action uses the V39
shopping-cart glyph; no other HUD glyph column is redrawn.

## Symbol art state

The internal symbol order remains:

`operative`, `encrypted_drive`, `tactical_radio`, `classified_folder`,
`night_vision_goggles`, `supply_crate`, `ghost_wild`, `breach`, `a`, `k`,
`q`, `j`, `ten`.

Retained exactly from the accepted runtime art:

- tactical Penguin operative;
- encrypted-drive/tablet;
- GHOST WILD, including its anticipation and triggered states;
- K;
- J.

Redesigned in V39 while keeping the same IDs and roles:

- tactical radio;
- classified folder;
- night-vision goggles;
- supply crate;
- VAULT (`breach`), with independent Base/Win/Dim/Anticipation/Triggered art
  and no baked `SCATTER` text;
- A;
- Q;
- 10.

The five V39 presentation spin strips contain the complete mixed active set so
old art cannot flash during motion. They are visual strips only and do not
define RGS or math probabilities. Exact source/output hashes, alpha checks,
reel orders and toolchain versions are recorded in
`apps/blacksite/art/generated/v39/symbols/build-report.generated.json`.

## Versioned runtime roots

- Cart atlas: `apps/blacksite/static/assets/blacksite/v39/ui-kit/`.
- Redesigned symbol states: `apps/blacksite/static/assets/blacksite/v39/symbols/`.
- Current presentation strips: `apps/blacksite/static/assets/blacksite/v39/ui/reel-strips/`.
- Source masters and provenance: `apps/blacksite/art/generated/v39/`.

Superseded symbol state packs, the V19 Vault symbol, V21 glyph atlas and V22
spin strips remain as historical source/runtime archives in the repository but
are explicitly pruned from the production build. Retained symbol packs stay at
their existing paths and remain production inputs.

## Reproduce this exact development view

```text
git switch codex/blacksite-ui-v39
git pull --ff-only
pnpm --filter blacksite dev
```

Then open:

```text
http://127.0.0.1:3002/?dev_fixture=base_natural_blackout&asset_rev=repo_snapshot_v39
```

Development fixtures are Vite-development-only and are forbidden in a
production build. A future candidate must still be generated from a clean,
explicit commit and pass exact-package, device, audible, rights and external
Stake review gates.

## Verification record

The implementation commit above is the code-and-assets identity.

- `pnpm --filter blacksite test`: 329/329 passing.
- `pnpm --filter blacksite lint`: passing; the repository still emits the
  existing ESLintRC deprecation notice.
- `pnpm --filter blacksite build`: passing; the existing Svelte unused-CSS
  diagnostics remain warnings, not build failures.
- Production runtime closure after pruning: 410 files, 61,110,097 bytes,
  SHA-256 `6cf5b1ddf2189e6e4bfbb5573f00370959fa013de2eaafbda730ac8cf60af1cf`.
- Complete generated build: 416 files, 63,474,175 bytes, SHA-256
  `6c6dba3cff2621d226c103d0667c16e5ff76049175da162d7b9387119fb8cda6`;
  3,634,689 bytes below the 64 MiB hard limit.
- Browser QA completed on the deterministic natural-BLACKOUT fixture through
  startup, base spin, award modal, all eight free spins, extraction and return
  to base with no new console error or warning.
- At 1545 × 270, the cart, information and settings glyph centers differ from
  their button centers by exactly 0 CSS px. `TOTAL BET` remains a single
  39.672 × 7 CSS-px line within its authored meter.

The same exact closure is recorded in `apps/blacksite/art/asset-manifest.json`.
This snapshot must not be described as approved, upload-authorized or released.
