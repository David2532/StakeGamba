# BLACKSITE // BREACH — Math v3 Game & Event Contract

Status: **verified internal math candidate; not release or Stake approval**

Contract: `blacksite-book-events-v3`  
Candidate: `0.3.0-math-v3`  
Lifecycle: `MATH_V3_CANDIDATE_NOT_RELEASE`  
Candidate fingerprint: `a30e33d3aa5b7b121cc94053306944f22714888952a95f5432177121e591a2d7`  
Event-schema SHA-256: `8d68ffcf0d47fdf20648868d975d2cd944dd4892ac5bd9bf411f6d96b8834b75`  
Payout unit: unsigned integer centi-x (`100 = 1.00x`)

## Board and paylines

Each authoritative board has five column-major reels and three visible rows.
Ten fixed paylines are evaluated left-to-right from reel `0`. A line pays for
exactly 3, 4 or 5 consecutive matching cells beginning on reel `0`.

| ID | Row vector, reels 0–4 |
|---:|---|
| 0 | `1,1,1,1,1` |
| 1 | `0,0,0,0,0` |
| 2 | `2,2,2,2,2` |
| 3 | `0,1,2,1,0` |
| 4 | `2,1,0,1,2` |
| 5 | `0,0,1,2,2` |
| 6 | `2,2,1,0,0` |
| 7 | `1,0,0,0,1` |
| 8 | `1,2,2,2,1` |
| 9 | `0,1,0,1,0` |

## Exact reel-symbol identity

The v3 reel vocabulary contains exactly these thirteen IDs, in asset-contract
order:

1. `operative`
2. `encrypted_drive`
3. `tactical_radio`
4. `classified_folder`
5. `night_vision_goggles`
6. `supply_crate`
7. `ghost_wild`
8. `breach`
9. `a`
10. `k`
11. `q`
12. `j`
13. `ten`

The eleven regular symbols are all entries above except `ghost_wild` and
`breach`. `ghost_wild` substitutes for regular symbols and can also pay as
itself. `breach` never substitutes and has no line pay.

When WILD permits multiple candidates on the same line, exactly one pays:
highest base payout, then longest match, then the canonical paytable order
shown below.

## Frozen paytable

Values are raw centi-x for 3 / 4 / 5 matches. The row order is also the
canonical deterministic line-resolution order; WILD is final.

| Symbol | 3 | 4 | 5 |
|---|---:|---:|---:|
| `operative` | 25 | 250 | 1,000 |
| `encrypted_drive` | 15 | 150 | 750 |
| `tactical_radio` | 10 | 100 | 500 |
| `classified_folder` | 7 | 75 | 400 |
| `night_vision_goggles` | 5 | 50 | 250 |
| `supply_crate` | 4 | 40 | 200 |
| `a` | 3 | 30 | 150 |
| `k` | 2 | 20 | 100 |
| `q` | 2 | 15 | 75 |
| `j` | 1 | 10 | 50 |
| `ten` | 1 | 8 | 40 |
| `ghost_wild` | 100 | 2,500 | 125,000 |

## BLACKOUT feature

`breach` on at least three distinct opening-spin reels awards exactly eight
free spins. At `feature_start`, the authoritative book selects one regular
symbol as the expansion target. Before each free-spin line evaluation, every
reel containing that target on the original free-spin board expands to three
target symbols. Expansion is then evaluated by the same ten paylines. There is
no retrigger.

- Base has no guaranteed BREACH position.
- Deep Access guarantees BREACH at `(0,1)` and `(4,1)` on every opening spin;
  a third BREACH on another reel triggers BLACKOUT.
- Blackout enters the eight free spins directly.

## Modes and exact totals

| Mode | Cost | Books | Zero / positive | Required payout sum | RTP |
|---|---:|---:|---:|---:|---:|
| `base` | 1x | 100,000 | 65,000 / 35,000 | 9,620,000 | 0.962 |
| `deep_access` | 4x | 100,000 | 40,000 / 60,000 | 38,480,000 | 0.962 |
| `blackout` | 80x | 100,000 | 5,000 / 95,000 | 769,600,000 | 0.962 |

Every lookup weight is `1`. Every payout is constructed from boards evaluated
by the real line evaluator. The complete originating round is capped at
`1,000,000` raw (`10,000x`); line awards are applied in ascending payline ID
order and truncated only at that cap. Base retains 10,000 positive opening-spin
line books without feature entry.

## Closed event grammar

Records reject missing, extra and unknown fields. Indices are contiguous and
zero-based. The v3 record types are unchanged structurally from v2, but the
contract and symbol enums are deliberately incompatible:

- `round_start`
- `spin_set`
- `expansion_applied`
- `line_win`
- `feature_trigger`
- `feature_start`
- `free_spin_start`
- `feature_end`
- `cap_reached`
- `round_end`

Normal base grammar is `round_start -> spin_set -> [line_win] ->
[feature_trigger -> feature_start -> eight free spins] -> round_end`. Direct
BLACKOUT starts `round_start -> feature_start`. Each free spin is
`free_spin_start -> spin_set -> [expansion_applied] -> [line_win]`. Cap
termination is always `line_win -> cap_reached -> round_end`.

The exact closed fields and types are canonical in
`math/games/blacksite_breach/config/event_schema.json`.

## Version boundary and verification

v3 changes both symbol identity and paytable identity, so v2 event cursors,
fixtures, fingerprints and books must never be interpreted as v3. The outer
RGS mode names, costs and money-unit boundaries remain unchanged.

The independent verifier decompresses and validates all 300,000 books,
recomputes board shape, BREACH placement/trigger, target expansion, WILD
candidate resolution, ten-line awards, cumulative totals, cap termination and
the entire closed lifecycle. Generated evidence lives under
`math/games/blacksite_breach/library/publish_files/`. This retained candidate
passed 91/91 verification gates and 11/11 math tests and publishes 41 fixture
identities. Internal verification is not external Stake approval.
