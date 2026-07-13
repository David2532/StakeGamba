# Stake replay contract

Supported launch parameters: game, version, mode, event, amount, currency, language/lang and Stake popout parameters. Mandatory parameters are game, version, mode and event. Optional parameters include language/lang, amount and currency when the RGS response supplies validated equivalents.

Accepted modes and aliases: base, rainbow, rainbow_spin, hunt, feature, feature_spins, bonus_tier1, tier1, golden_chance, bonus, tier2, bonus_tier2 and all_that_glitters. Event ID 0 is valid.

API amount units are integer micro-units. Book multiplier units are integer hundredths of the bet multiplier. Replay `payoutMultiplier` may arrive as integer book units or as a decimal/string multiplier, but it is normalized only if it exactly matches `finalWin`. Explicit payout is an API amount and must match `amount * finalWin / 100`.

Event wrappers may be `round.state`, `round.events`, `replay.round`, `bet` or `eventRound`. Supported events include reveal, tumbleBoard, winInfo, goldenReveal, goldenAward, goldenClear, setWin, setTotalWin, updateTumbleWin, updateFreeSpin, freeSpinTrigger, freeSpinEnd and finalWin. Boards are six columns by five rows. Positions use col/column/reel plus row.

Validation rules:

- finalWin is mandatory and authoritative.
- winInfo totals must equal the sum of wins.
- runningTotalWin, setWin, setTotalWin, updateTumbleWin and freeSpinEnd must match the cumulative total.
- wins above configured Max Win are rejected.
- present payoutMultiplier is normalized from integer book units or decimal multiplier form and strictly cross-validated.
- absent or null payoutMultiplier is reconstructed from finalWin.
- explicit payout is strictly cross-validated.
- replay never authenticates, never sends wallet play, never sends end-round and never saves events.
- hidden paid controls are not visible, focusable, clickable or hit-testable.
- Play Again reuses immutable replay data and performs no refetch.

## Current regression coverage

`bonus` and `bonus_tier1` responses may omit `payoutMultiplier` or provide legacy decimal/string multiplier values. `rainbow` may include it. All variants use validated `finalWin` as the authoritative source, and present values remain strict cross-checks.

## Valid envelope examples

```json
{"round":{"game":"golden-goal-rush","version":"1","mode":"base","amount":1000000,"currency":"USD","payout":1250000,"payoutMultiplier":125,"state":[{"index":0,"type":"reveal","board":"6x5 board"},{"index":1,"type":"finalWin","amount":125}]}}
```

```json
{"round":{"game":"golden-goal-rush","version":"1","mode":"rainbow","amount":1000000,"currency":"USD","payout":480000,"payoutMultiplier":48,"state":[{"index":0,"type":"reveal","board":"6x5 board"},{"index":1,"type":"finalWin","amount":48}]}}
```

```json
{"round":{"game":"golden-goal-rush","version":"1","mode":"bonus_tier1","amount":1000000,"currency":"USD","payout":1120000,"state":[{"index":0,"type":"reveal","board":"6x5 board"},{"index":1,"type":"finalWin","amount":112}]}}
```

```json
{"round":{"game":"golden-goal-rush","version":"1","mode":"bonus","amount":1000000,"currency":"USD","payout":1120000,"state":[{"index":0,"type":"reveal","board":"6x5 board"},{"index":1,"type":"finalWin","amount":112}]}}
```

```json
{"round":{"game":"golden-goal-rush","version":"1","mode":"base","amount":1000000,"currency":"KRW","payout":0,"payoutMultiplier":0,"state":[{"index":0,"type":"reveal","board":"6x5 board"},{"index":1,"type":"finalWin","amount":0}]}}
```

```json
{"round":{"game":"golden-goal-rush","version":"1","mode":"base","amount":1000000,"currency":"XSC","payout":1250000,"payoutMultiplier":125,"state":[{"index":0,"type":"reveal","board":"6x5 board"},{"index":1,"type":"finalWin","amount":125}]}}
```

Rejected envelopes include negative finalWin, fractional finalWin, string finalWin, non-numeric payoutMultiplier, conflicting payoutMultiplier, conflicting explicit payout, malformed event sequence, wrong mode, wrong amount and wrong currency. These cases are covered by artifacts/stake-qa/2026-07-13T12-26-21-463Z/replay-validation-cases.json.

## Validation context

- Frontend build ID: `348cbfd4f1e28202a96f3aee3b5cb3349a1279474d4f6e19f3f16c3642eb857e`
- Math version: `0.2.2-cluster`
- Evidence directory: `artifacts/stake-qa/2026-07-13T12-26-21-463Z`
