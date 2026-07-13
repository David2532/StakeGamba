# Stake team ready message

Stake team,

The current build fixes the Replay payoutMultiplier contract and preserves the prior Replay UI corrections. Bonus and Bonus Tier 1 replay responses may omit or null `payoutMultiplier`; the game now uses validated `finalWin` as the authoritative replay result and still rejects any present contradictory `payoutMultiplier` or explicit payout. Rainbow replay remains covered as the comparison case with a present cross-checked `payoutMultiplier`.

Replay remains read-only: no authenticate, wallet play, end-round or event-save request is made during Replay launch, Replay Play or Play Again. Event ID 0, KRW formatting, Stake.us XSC display and Paytable values are covered by the current QA evidence.

Upload frontend: `publish/frontend`

Upload math: `publish/math`

Frontend build ID: `d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5`

Math version: `0.2.2-cluster`

Tested commit: resolved by `git rev-parse HEAD` during final validation.

QA status: READY when the PR body points to the final commit and all listed gates remain green.

## Validation context

- Frontend build ID: `d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5`
- Math version: `0.2.2-cluster`
- Evidence directory: `artifacts/stake-qa/2026-07-13T11-53-50-381Z`
