# BLACKSITE V39 symbol-state and spin-strip builder

This is the isolated authoring lane for the targeted V39 symbol-art pass. It
does not change the frontend registry, tests, math contract, main asset
manifest, or any existing retained runtime pack.

## Immutable identity contract

The builder keeps the existing thirteen internal IDs and their order:

1. `operative`
2. `encrypted_drive`
3. `tactical_radio`
4. `classified_folder`
5. `night_vision_goggles`
6. `supply_crate`
7. `ghost_wild`
8. `breach` (player-facing Vault)
9. `a`
10. `k`
11. `q`
12. `j`
13. `ten`

The five spin strips retain the registered presentation-only 13-stop order and
three-stop seamless tail. They do not define probabilities or mutate RGS/math
outcomes.

## Required V39 master inputs

The eight redesigned transparent PNGs live directly under
`apps/blacksite/art/generated/v39/symbols/source/`:

- `sym_03_tactical_radio-master-v39.png`
- `sym_04_classified_folder-master-v39.png`
- `sym_05_night_vision_goggles-master-v39.png`
- `sym_06_supply_crate-master-v39.png`
- `sym_08_breach-master-v39.png`
- `sym_09_a-master-v39.png`
- `sym_11_q-master-v39.png`
- `sym_13_ten-master-v39.png`

Each master must be a square PNG of at least 512 x 512, contain an alpha
channel and transparent background pixels, keep its visible subject inside the
canvas, and contain no visible chroma-magenta background. Edge-touching source
art fails validation; the builder does not silently crop it.

Five accepted symbols are read from, and remain at, their existing registered
runtime paths. They are never copied into the V39 symbol-state root:

- `operative`: `static/assets/blacksite/v22/symbols/operative/`
- `encrypted_drive`: `static/assets/blacksite/symbols/sym_02_encrypted_drive/states-v4/`
- `ghost_wild`: `static/assets/blacksite/symbols/sym_07_ghost_wild/states-v4/`
- `k`: `static/assets/blacksite/symbols/sym_10_k/states-v4/`
- `j`: `static/assets/blacksite/symbols/sym_12_j/states-v4/`

This preserves the accepted Penguin, tablet/encrypted-drive, WILD, K, and J
art exactly, including the existing WILD anticipation and triggered states.

## Generated outputs

An applied build writes only the isolated V39 paths:

- For each of the eight redesigned IDs:
  `static/assets/blacksite/v39/symbols/<sym-directory>/{base,win,dim}.webp`
- Vault additionally:
  `static/assets/blacksite/v39/symbols/sym_08_breach_vault/{anticipation,triggered}.webp`
- `static/assets/blacksite/v39/ui/reel-strips/reel-01.webp` through
  `reel-05.webp`
- `art/generated/v39/symbols/proof-v39-symbols.webp`
- `art/generated/v39/symbols/build-report.generated.json`

Every symbol state is an alpha-preserving 512 x 512 WebP. Every spin strip is
an opaque 320 x 3840 WebP containing sixteen 320 x 240 cells. All five strips
are freshly composited from the complete mixed active set: eight V39 base
states plus the five retained base states. Cells 13-15 are pixel copies of
cells 0-2 before WebP encoding.

Runtime encoding is bounded lossy WebP (state quality 86 with alpha quality
100, strip quality 84, method 6) with a hard 2,000,000-byte V39 replacement-
package gate. The gate is not an additive production allowance: integration
must prune the 25 superseded redesigned-symbol state files (1,359,552 bytes)
and five superseded V22 strips (2,793,632 bytes). The final complete production
build must still pass the authoritative `<64 MiB` gate after that replacement.
The authoring proof remains lossless. The generated report records source and
output hashes, decoded-pixel hashes, dimensions, ownership, exact reel order,
toolchain versions, encoding settings, and measured budget.

## Commands

From the repository root:

```powershell
python apps/blacksite/art/generated/v39/symbols/build_v39_symbol_pack.py
```

The default is a genuine dry run: it validates all inputs, generates and
validates the complete package in a temporary directory, checks the budget,
prints the result, deletes staging, and does not promote files. `--dry-run` is
an explicit alias for the same behavior.

After the dry run passes, promote the package explicitly:

```powershell
python apps/blacksite/art/generated/v39/symbols/build_v39_symbol_pack.py --apply
```

Apply stages and validates the entire package before promotion. Existing V39
runtime/proof/report targets are backed up and restored on promotion failure;
the owned `v39/symbols` and `v39/ui/reel-strips` directories are each moved as
units. Sibling `v39/ui-kit` content is neither inspected nor replaced.
Unexpected files under the two owned roots cause a closed failure instead of
being silently packaged.

Registry integration, focused tests, and main-manifest promotion are separate
reviewed changes after visual acceptance.
