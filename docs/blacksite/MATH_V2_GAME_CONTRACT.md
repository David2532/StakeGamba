# BLACKSITE // BREACH — Math v2 Game & Event Contract

Status: **HISTORICAL SUPERSEDED v2 EVIDENCE; NOT CURRENT, RELEASED OR STAKE-APPROVED**

> Retained unchanged as the frozen v2 evidence contract. Current candidates use
> `MATH_V3_GAME_CONTRACT.md` / `blacksite-book-events-v3`; v2 books, hashes,
> fixtures, restore cursors and symbol IDs must never be interpreted as v3.

Contract: `blacksite-book-events-v2`  
Candidate: `0.2.0-math-v2`  
Lifecycle: `MATH_V2_CANDIDATE_NOT_RELEASE`  
Candidate fingerprint: `7b9c58b518c357bd5d9c4a8f0ddbb3278946a46837cf45e17ecedc576b6c0b63`  
Event-schema SHA-256: `1e26365e513489b549482089cb8a65deda52312538e168f3d5c577641091a5bf`  
Payout unit: unsigned integer centi-x (`100 = 1.00x`)

## Board and wins

Boards are five column-major reels with three visible rows. Ten fixed paylines
are evaluated from reel/column `0` toward the right. A line pays for 3, 4 or 5
consecutive matching cells from column `0`:

| ID | Row vector, columns 0–4 |
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

The regular symbols are `byte`, `relay`, `proxy`, `cipher`, `daemon` and
`vault`. `ghost_wild` substitutes for regular symbols only and has its own
pay. `breach` never substitutes and never pays. Each reel may contain at most
one `breach`.

When WILD creates more than one candidate on a line, the line pays exactly one:
highest base payout, then longest match, then the canonical paytable order
`byte`, `relay`, `proxy`, `cipher`, `daemon`, `vault`, `ghost_wild`.

Paytable values below are raw centi-x for 3 / 4 / 5 matches:

| Symbol | 3 | 4 | 5 |
|---|---:|---:|---:|
| BYTE | 1 | 10 | 50 |
| RELAY | 2 | 20 | 100 |
| PROXY | 3 | 30 | 599 |
| CIPHER | 5 | 50 | 250 |
| DAEMON | 10 | 100 | 500 |
| VAULT | 25 | 250 | 1,000 |
| GHOST WILD | 100 | 2,500 | 125,000 |

## BLACKOUT feature

`breach` on at least three distinct reels of the opening spin awards exactly
eight free spins. At `feature_start`, the authoritative book selects one
regular target. Before each free-spin line evaluation, every reel containing
that target in the original board expands to three target symbols. There is no
retrigger.

- Base starts without guaranteed BREACH symbols.
- Deep Access guarantees BREACH at `(0,1)` and `(4,1)` on every opening spin;
  another BREACH on a distinct reel triggers BLACKOUT.
- Blackout begins the eight free spins directly.

## Modes and exact distribution totals

| Mode | Cost | Books | Zero / positive | Required payout sum | RTP |
|---|---:|---:|---:|---:|---:|
| `base` | 1x | 100,000 | 65,000 / 35,000 | 9,620,000 | 0.962 |
| `deep_access` | 4x | 100,000 | 40,000 / 60,000 | 38,480,000 | 0.962 |
| `blackout` | 80x | 100,000 | 5,000 / 95,000 | 769,600,000 | 0.962 |

Every lookup weight is `1`. Every final payout is constructed from genuine
evaluated line boards. A line event lists every canonical winning payline in
ascending ID order. Awards are applied in that order against the complete-round
cap of `1,000,000` raw. Reaching the cap terminates immediately.

The Base library deliberately contains 10,000 positive books that settle on
the opening 5 × 3 spin without entering BLACKOUT. This preserves a familiar
ordinary line-win path in addition to natural feature books.

## Closed event grammar

Event records reject missing, extra and unknown fields. Event indices are
contiguous and zero-based.

- `round_start`
- `spin_set`
- `expansion_applied` — required exactly when a free-spin board contains the
  selected target
- `line_win` — required exactly when the evaluated board has paying lines
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

The exact required fields and record types are canonical in
`math/games/blacksite_breach/config/event_schema.json`.

## Verification boundary

The verifier independently recomputes board shape, one-BREACH-per-reel,
guaranteed positions, trigger reels, target expansion, WILD candidate choice,
paytable values, line positions, applied awards, cumulative totals, cap and
lifecycle for all 300,000 books. Generated evidence is retained under
`math/games/blacksite_breach/library/publish_files/`.

The retained candidate passed 91/91 verification gates, 10/10 math tests and
publishes 41 deterministic fixture identities. These counts and hashes bind
this document to one exact internal candidate; they do not self-certify Stake
approval.

This v2 contract invalidates the initial v1 cluster candidate's evidence. It
does not inherit external approval, release status or production compatibility
for active v1 rounds.
