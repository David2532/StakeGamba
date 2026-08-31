# BLACKSITE V39 symbol-pack provenance

## Scope

This authoring package owns eight redesigned symbol masters, their V39 runtime
states, and five recomposited spin strips. It preserves all thirteen canonical
symbol IDs and does not own math, RGS outcomes, wallet/payout behavior,
frontend registration, tests, or the main asset manifest.

## New source inputs

The eight `source/*-master-v39.png` files are repository-local supplied masters
received for this V39 pass on 2026-08-31. This builder does not infer or assert
their external generator, license, or final human approval. The generated
`build-report.generated.json` records the exact file and decoded-pixel SHA-256,
geometry, alpha bounds, and chroma validation for each input.

## Retained source inputs

The active Penguin operative, encrypted-drive/tablet, WILD, K, and J are read
from their existing registered V22/states-v4 runtime packs. They remain at
those paths and are not copied into `v39/symbols`. The report records hashes
for all retained Base/Win/Dim inputs and the existing WILD anticipation and
triggered inputs.

## Deterministic transformation

`build_v39_symbol_pack.py` normalizes only the eight new masters into the
frozen 512 x 512 symbol geometry, derives Base/Win/Dim, derives dedicated Vault
anticipation and triggered states, and encodes bounded WebP outputs. It then
recomposites every logical cell of all five strips from the complete mixed
active set and copies logical cells 0-2 into tail cells 13-15 before encoding.

The builder verifies source geometry/alpha/chroma, output geometry/format,
pixel-exact encoded alpha, decoded tail RMS, exact ID/stop invariants, hashes,
and the two-megabyte replacement-package gate. Its default mode performs the
complete build in temporary storage with no promotion. `--apply` uses staged,
rollback-safe promotion for only `v39/symbols`, `v39/ui/reel-strips`, the proof,
and the generated report; sibling `v39/ui-kit` remains outside its ownership.

## Production budget condition

V39 is a replacement, not an additive package. Production integration must
prune the 25 superseded redesigned-symbol state files (1,359,552 bytes) and the
five superseded V22 reel strips (2,793,632 bytes). The final complete production
build `<64 MiB` gate remains authoritative after registry/pruner integration.

Visual approval, source-rights approval, registry promotion, focused runtime
tests, main-manifest registration, and final package QA remain separate gates.
