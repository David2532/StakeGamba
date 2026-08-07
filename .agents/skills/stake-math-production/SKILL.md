---
name: stake-math-production
description: Use for production Stake slot math, static books/lookups/index, BetMode/distribution conditions, RTP/max-win/volatility optimization, force records, candidate math audits and frontend math contracts.
---

# Stake Production Math Skill

## Read first
- `docs/blacksite/MATH_STANDARD.md`
- `docs/blacksite/STAKE_REQUIREMENTS_51.md`
- `docs/blacksite/STAKE_ENGINE_SOURCE_INDEX.md`
- `docs/blacksite/STAKEGAMBA_LESSONS.md`
- current Stake Math SDK quickstart, BetMode, Distribution, optimization and required-file-format docs.

## Package contract
Each production mode needs exact candidate files referenced from root `index.json`; lookup and book IDs/payouts must match exactly; game books are compressed JSONL in the current Stake-required format; all values/types/weights are validated after extraction from the actual upload package.

## Modeling rules
- fixed stateless probability model only;
- no player/session/history dependence;
- frontend never chooses payout;
- freeze canonical mode name/cost/RTP/max win/event schema before final art polish;
- current rules values derive from exact candidate math, not hardcoded marketing text.

## Candidate analysis
For every mode report:
- target/achieved/raw RTP;
- hit/no-win rate;
- raw payout and cost-normalized return buckets;
- variance/stddev/quantiles;
- tail RTP contribution;
- max-win odds and positive lookup weight;
- lookup diversity/effective sample size/top-book share;
- representative short-window GGR/player-RTP distributions.

Use large diverse production pools per current Stake guidance; record seeds/counts/commands/config identity.

## Distribution optimization
May use fixed published lookup weights, Distribution criteria/quotas, forced freegame/max-win generation, payout-range scaling and volatility objectives. Never introduce adaptive live RTP or frontend-selected outcomes.

## Required deterministic books
- zero win;
- five representative wins per mode;
- feature trigger/retrigger if present;
- multi-cascade/special mechanic;
- big win;
- max win.

## Release failure conditions
Fail on missing index/mode/files, duplicate/mismatched IDs, payout mismatch, invalid types/weights, RTP tolerance miss, unselectable advertised max, cap violation, stale audit, schema mismatch or tested-package identity mismatch.
