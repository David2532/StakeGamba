# BLACKSITE // BREACH — math v3 candidate

Lifecycle: **`MATH_V3_CANDIDATE_NOT_RELEASE`**

This directory contains the deterministic, stateless 5 × 3 line-pay candidate
for `blacksite_breach`. Math v3 supersedes the v2 placeholder-symbol contract
as a new versioned candidate; it is not an approval or a release.

Canonical commands:

```text
node math/games/blacksite_breach/generate.mjs
node math/games/blacksite_breach/verify.mjs
node --test math/games/blacksite_breach/tests/*.test.mjs
```

The generator emits 100,000 unit-weight books for each canonical mode:

- `base`, cost `1x`;
- `deep_access`, cost `4x`;
- `blackout`, cost `80x`.

Every mode has exact cost-normalized RTP `0.962`, a complete-round cap of
`1,000,000` raw centi-x (`10,000x`), a positive-weight max book and at least
100 distinct positive payouts. The strict verifier decompresses every book and
recomputes the closed `blacksite-book-events-v3` lifecycle, all ten paylines,
WILD resolution, BREACH triggers, target expansion, cumulative payout and cap.

Math v3 binds the final thirteen-symbol visual vocabulary: `operative`,
`encrypted_drive`, `tactical_radio`, `classified_folder`,
`night_vision_goggles`, `supply_crate`, `ghost_wild`, `breach`, `a`, `k`, `q`,
`j` and `ten`. It replaces the v2 placeholder-symbol contract; v2 books and
event cursors are not compatible with v3.

The minimal Stake math upload remains seven files:

- `library/publish_files/index.json`;
- three `library/lookup_tables/*_lookup.csv` files;
- three `library/books_compressed/*_books.jsonl.zst` files.

Configs and the generated manifest/audits/fixture index are retained evidence,
not extra files for the minimal upload root. Source-of-truth configs live under
`config/`; byte-identical published copies live under `library/configs/`.

See `docs/blacksite/MATH_V3_GAME_CONTRACT.md` for the frozen rules and event
grammar.
