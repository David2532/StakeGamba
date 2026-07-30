# Stake team ready message

Stake team,

The current build fixes the Replay payoutMultiplier contract and preserves the prior Replay UI corrections. Bonus and Bonus Tier 1 replay responses may omit/null `payoutMultiplier` or provide legacy decimal/string multiplier values; the game now uses validated `finalWin` as the authoritative replay result and still rejects any present contradictory `payoutMultiplier` or explicit payout. Rainbow replay remains covered as the comparison case with a present cross-checked `payoutMultiplier`.

Replay remains read-only: no authenticate, wallet play, end-round or event-save request is made during Replay launch, Replay Play or Play Again. Event ID 0, KRW formatting, Stake.us XSC display and Paytable values are covered by the current QA evidence.

Upload frontend: `publish/frontend`

Upload math: `publish/math`

Frontend build ID: `74dc84abea7750ed76fc4adc1623125e8773cde2b98fd357f529921d8b4a06e7`

Math version: `0.2.2-cluster`

Tested commit: resolved by `git rev-parse HEAD` during final validation.

QA status: automated checks passed for the recorded candidate. Human review, Stake upload, and Stake acceptance remain separate external decisions.

## Validation context

- Frontend build ID: `74dc84abea7750ed76fc4adc1623125e8773cde2b98fd357f529921d8b4a06e7`
- Math version: `0.2.2-cluster`
- Evidence directory: `artifacts/stake-qa/2026-07-30T08-59-08-860Z`
