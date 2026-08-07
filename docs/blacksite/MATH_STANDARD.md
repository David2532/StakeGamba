# BLACKSITE // BREACH — Math & Distribution Standard

Owner: `math_rgs_engineer`  
Co-owners: Game Design, Stake Compliance, QA, Frontend

This file defines the production math contract for BLACKSITE. It is intentionally stricter than merely “RTP matches target”.

## 1. Core invariants

- Every paid bet is stateless and independent of prior outcomes.
- All production outcomes are represented by published static books/lookups/index files in the Stake-required format.
- Frontend code never changes payout probability or settlement.
- Player/account/session/history-dependent weighting is forbidden.
- Game mode identity, cost, RTP, max win and book event contract are canonical and versioned.
- Post-approval math/mechanic changes are treated as a new Stake review problem, not a hotfix.

## 2. Production package contract

The exact uploaded math package must contain the current Stake-required structure, including:
- root `index.json`;
- lookup CSV for each mode;
- zstd-compressed JSONL book/event files;
- every lookup ID backed by exactly one book;
- every book ID represented correctly in lookup;
- lookup payout value exactly equal to book `payoutMultiplier`;
- non-negative integer weights/probabilities in the required numeric domain;
- no duplicate IDs;
- no missing/extra canonical modes.

The release gate extracts/reads the actual package and repeats these checks from package bytes, not just source folders.

## 3. Canonical mode registry

Before final simulation, freeze a mode registry containing:
- canonical mode name;
- player-facing normal label;
- Social Mode label;
- cost multiplier;
- target RTP;
- max win;
- `is_feature` / buy behaviour;
- auto-close/manual-close behaviour;
- feature trigger/retrigger semantics;
- presentation fixture IDs;
- Replay aliases only when required for backward compatibility.

No frontend-local second copy may drift from this registry.

## 4. Simulation strategy

Development phases:

### Smoke/debug
Small deterministic batches, uncompressed where useful, optimized for inspection and schema debugging.

### Candidate generation
Large diverse simulation pool per mode. Production guidance should be re-checked against the current Stake Math SDK before each candidate; current docs recommend 100k+ simulations per mode as a typical production baseline for diversity.

### Release freeze
Record:
- code SHA;
- RNG seeds/config;
- simulation counts per mode;
- generation command/environment;
- source config hash;
- output file hashes;
- optimization parameters/version;
- accepted/rejected simulation statistics.

## 5. Event contract

A book is not just a payout. It is the complete authoritative presentation record for one simulated round.

Every event type has:
- stable `type` name;
- required/optional fields;
- numeric units;
- semantic meaning;
- ordering rules;
- frontend handler;
- deterministic fixture/replay case;
- schema validation.

Events should be emitted immediately after the corresponding math state transformation so the frontend receives a valid state snapshot.

Frontend cannot infer missing payout-critical state from visuals.

## 6. Max Win

For every mode:
- configured max win is explicit;
- accepted books never exceed the cap;
- if the UI advertises a cap, a real positive-weight outcome reaches it unless Stake/product contract intentionally defines a lower observed mode maximum;
- max-win outcome is selectable in published lookup;
- forced/criteria generation creates deterministic max-win evidence without changing runtime fairness;
- rules/game information value is derived/cross-checked against the exact published candidate;
- Replay and restore handle max-win cleanly.

If nested free-game play belongs to one paid round, enforce the cap across the complete originating round.

## 7. RTP

Per mode, record:
- target RTP;
- achieved weighted RTP from final lookup;
- raw/unweighted simulation RTP;
- cost multiplier;
- tolerance/error;
- any optimization capping/constraint result.

The number shown to the player must correspond to the exact mode/candidate required by Stake communication rules.

Never “fix” a display mismatch by changing the frontend number alone.

## 8. Distribution / volatility reporting

For each published mode calculate at least:
- hit frequency;
- no-win share;
- mean return;
- median return;
- variance;
- standard deviation;
- coefficient of variation where useful;
- payout quantiles;
- tail contribution metrics;
- max-win odds;
- effective sample size / lookup diversity;
- top single-book selection share;
- most common final payouts;
- contribution to RTP by payout band.

Always report both:

`raw payout multiplier`

and

`cost-normalized return = payoutMultiplier / modeCost`

when comparing modes with different costs. Never call a 95× raw return a “95× player win” for a 95×-cost feature without normalization context.

## 9. Short-window risk visibility

Before freeze, run Monte Carlo / exact lookup sampling over realistic windows:
- 100 bets;
- 1k bets;
- 5k bets;
- 10k bets;
- 100k bets;
- representative mixed-mode sessions.

Report distribution of:
- player RTP;
- operator GGR;
- probability of negative operator GGR over the window;
- p1/p5/p50/p95/p99 GGR where useful;
- largest payout contribution;
- concentration from 20×+/50×+/100×+ cost-normalized returns.

This analysis is for variance/risk visibility and game design. It does not authorize history-adaptive outcome selection.

## 10. Optimization policy

Allowed:
- fixed published lookup-weight optimization;
- Stake Math SDK distribution criteria/quotas;
- forced generation of known freegame/max-win simulation classes for pool coverage;
- payout-range scaling/optimization against declared candidate objectives;
- volatility shaping while preserving target RTP and fixed public math.

Forbidden:
- per-player/account weighting;
- loss-chasing logic;
- changing odds based on previous bets;
- hidden live RTP switches;
- frontend-chosen outcomes;
- unpublished conditional weighting.

Candidate optimizer objectives should balance:
- exact RTP;
- healthy/intentional hit rate;
- reasonable short-window variance;
- tail limits;
- max-win achievability;
- lookup diversity;
- gameplay identity and feature frequency.

## 11. Feature / free-game design

For every feature define:
- trigger probability/conditions;
- scatter/special symbol rules;
- base vs freegame trigger semantics;
- retrigger rules or explicit no-retrigger rule;
- number of awarded spins/actions;
- persistent state;
- event emissions;
- complete-round payout cap interaction;
- how the rule is communicated in Game Information.

Any displayed numerical chance/probability must be derived from or audited against published math.

## 12. Five-win validation per mode

The 51-point checklist requires five wins for every mode to be checked against Game Rules.

For each canonical mode maintain at least five deterministic accepted books spanning different win shapes, e.g.:
- small win;
- medium win;
- multi-cascade win;
- special-symbol/feature-related win;
- large win.

For each case prove:
- symbol(s);
- winning positions/combinations;
- per-win amount;
- multipliers;
- cumulative total;
- final payout multiplier;
- displayed rules/paytable consistency.

## 13. Force / fixture records

Maintain deterministic IDs for review and frontend development:
- zero payout;
- five representative wins per mode;
- feature trigger;
- retrigger if applicable;
- high cascade count;
- big win;
- max win;
- edge-case special mechanics.

These IDs are evidence/dev aids. They do not alter production random selection.

## 14. Math integrity gates

Candidate build fails on any of:
- missing `index.json`;
- mode set mismatch;
- missing/extra book IDs;
- duplicate IDs;
- lookup/book payout mismatch;
- invalid numeric/string-typed fields where strict numeric type is required;
- negative/invalid weights;
- advertised max absent/unselectable;
- book exceeding cap;
- RTP outside candidate tolerance;
- stale audit/config/hash file;
- event schema mismatch;
- source package != tested package.

## 15. Frontend contract generation

Prefer generating or validating a compact frontend math contract from exact candidate outputs containing:
- mode metadata;
- symbol/paytable values;
- max win;
- RTP;
- event schema/version;
- feature rule metadata safe for display.

Frontend Game Information uses this contract rather than hand-entered numbers.

## 16. Approval freeze

Before Stake review:
- final candidate math is immutable except through a new explicit candidate version;
- exact output hashes are recorded;
- all previous candidate hashes are marked superseded;
- frontend is tested against that exact math/event contract;
- Replay IDs are selected from that exact version;
- no further “small tuning” occurs behind the same approved identity.
