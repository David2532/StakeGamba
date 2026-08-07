# Stake Engine Source Index

Last reviewed: **2026-08-07**

This file is the research map Codex must use before making compliance, RGS, math, frontend, replay or release claims. Prefer current first-party material. Historical chat/PR notes are useful for failure modes, not for deciding what Stake currently requires.

## 1. Approval / publication

### General approval guidelines
`https://stake-engine.com/docs/approval-guidelines`

Use for:
- approval being tied to specific frontend/math versions;
- stateless-bet restriction;
- originality/IP restrictions;
- Stake-branding restrictions;
- unsuitable/underage content restrictions;
- Stake.US consideration;
- post-release limitation on math/modes/gameplay changes.

### Frontend and communication
`https://stake-engine.com/docs/approval-guidelines/front-end-communication`

Use for:
- unique audio/visual assets;
- broken asset/animation rejection risk;
- mobile and popout requirements;
- Stake-CDN/static asset expectations;
- Game Information/rules requirements;
- mode cost/action communication;
- RTP and Max Win per mode;
- paytable/special values/feature triggers;
- all RGS bet levels;
- balance/final win display;
- sound mute;
- spacebar;
- autoplay confirmation;
- fastplay legibility;
- currency/language playtesting.

### RGS communication approval guidance
`https://stake-engine.com/docs/approval-guidelines/rgs-communication`

Use for:
- `rgs_url` authority;
- authenticate bet-level constraints;
- language/currency handling;
- static/no-external-source restrictions.

### Replay requirements
`https://stake-engine.com/docs/approval-guidelines/game-replay-requirements`

Use for:
- Replay being mandatory for new approvals;
- sessionless Replay;
- replay query parameters;
- replay endpoint;
- loading/play/play-again UX;
- no authenticated/wallet calls in Replay;
- event IDs/scenarios requested during review;
- replay Popout/mobile requirements.

### Jurisdiction / Stake.US
`https://stake-engine.com/docs/approval-guidelines/jurisdiction-requirements`

Use for:
- Social Mode `social=true/false`;
- prohibited gambling terminology;
- social wording replacements;
- Social Mode language policy.

### Game tile visual assets
`https://stake-engine.com/docs/approval-guidelines/game-tile-requirements`

Use for:
- background image;
- transparent foreground/key art;
- provider logo;
- naming conventions;
- high-resolution source requirement;
- combined foreground/background size budget.

### General disclaimer
`https://stake-engine.com/docs/approval-guidelines/general-disclaimer`

Use for the current required meaning of the Game Information disclaimer. Keep the repository text semantically aligned with the current official wording rather than copying an old cached version forever.

### Game quality rankings
`https://stake-engine.com/docs/approval-guidelines/game-quality-rankings`

Use for the 3-star target:
- studio quality;
- exceptional creativity/uniqueness/attention to detail;
- clean art and animation;
- device testing;
- optimized bundle/load behaviour;
- meaningful gameplay depth;
- avoiding generic AI-looking visual treatment.

### Submission checklist
`https://stake-engine.com/docs/approval-guidelines/submission-checklist`

The public page explains review flow but currently gates the exact checklist behind login. Treat `STAKE_REQUIREMENTS_51.md` as this project's explicit approval checklist and reconcile it with whatever the authenticated checklist says at submission time.

## 2. RGS

### Stake Engine RGS docs
`https://stake-engine.com/docs/rgs`

### SDK RGS technical details
`https://stakeengine.github.io/math-sdk/rgs_docs/RGS/`

Important invariants:
- monetary values use six-decimal integer units at the API boundary;
- currency affects display, not game logic;
- bet amount must satisfy authenticate-provided min/max/step rules;
- mode debit = base amount × mode cost multiplier;
- authenticate happens before other wallet endpoints;
- authenticate may return an active round that must be continued;
- play debits and returns authoritative round data;
- end-round settles/closes the round when required by its lifecycle;
- `/bet/event` can persist in-progress presentation position for resume;
- insufficient balance is an RGS error class and the frontend should also prevent obviously impossible requests.

### RGS example
`https://stake-engine.com/docs/rgs/example`

Use for the minimum authenticate → play → settlement mental model and for required math publication outputs.

## 3. Math SDK

### Math SDK home / table of contents
`https://stakeengine.github.io/math-sdk/math_home/`

The current documentation tree covers:
- engine setup/quickstart;
- required file format;
- game/state structure;
- simulation acceptance;
- BetMode and Distribution;
- symbols/boards/wins/events/force files;
- line/ways/scatter/cluster/tumble calculations;
- outputs and utilities;
- example games;
- uploads;
- optimization;
- frontend SDK details;
- RGS technical details.

### Required math file format
`https://stakeengine.github.io/math-sdk/rgs_docs/data_format/`

Release-critical requirements:
- root math `index.json`;
- per-mode name/cost/event/weight references;
- lookup CSV entries with integer simulation ID, probability/weight and payout multiplier;
- zstd-compressed JSONL book files;
- every book contains at least `id`, `events`, `payoutMultiplier`;
- payout values in lookup and books must match exactly.

### BetMode
`https://stakeengine.github.io/math-sdk/math_docs/gamestate_section/configuration_section/betmode_overview/`

Use for:
- mode RTP, cost, Max Win and distributions;
- `auto_close_disabled` lifecycle implications;
- feature/buy-mode flags;
- interrupted-round design.

### Distribution conditions
`https://stakeengine.github.io/math-sdk/math_docs/gamestate_section/configuration_section/betmode_dist/`

Use for:
- criteria/quota/conditions;
- forcing freegame/max-win simulations for production diversity and evidence;
- separating known simulation classes before optimization.

### Optimization
`https://stakeengine.github.io/math-sdk/math_docs/optimization_section/optimization_algorithm/`

Use for:
- controlling freegame/max-win/zero-win conditions;
- payout-range scaling;
- volatility control via distribution metrics;
- simulated test spins for candidate ranking.

### Quickstart
`https://stakeengine.github.io/math-sdk/math_docs/quickstart/`

Use for production simulation guidance. Current docs recommend large production batches (typically 100k+ simulations per mode) to provide a diverse optimization pool and reduce repeated outcomes.

## 4. Frontend SDK

### Frontend overview
`https://stake-engine.com/docs/front-end`

### Adding book events
`https://stakeengine.github.io/math-sdk/fe_docs/steps/`

Use this as a reminder that new math events need an explicit frontend event contract and deterministic fixture/story data. BLACKSITE must not let math and presentation drift independently.

### UI
`https://stakeengine.github.io/math-sdk/fe_docs/ui/`

Use together with current Stake approval guidance, not instead of it.

## 5. Provably Fair

`https://stake-engine.com/fair`

Current Stake Engine public material describes published outcome probabilities and deterministic seed/nonce selection for compatible stateless games. The project must never introduce account/session/history-dependent selection logic that would contradict the published math model.

## 6. Research procedure for Codex

Before changing a compliance-sensitive contract:

1. open the relevant official pages above;
2. note the date checked;
3. compare wording against this repo;
4. update the repo if requirements changed;
5. implement/test the change;
6. link the requirement to evidence in the 51-point matrix;
7. never use a search snippet or old PR summary as the sole authority when the first-party page is available.

## 7. Known documentation ambiguities

Some rules are expressed differently between high-level approval pages and SDK/RGS implementation docs. Resolve them by preserving the stronger invariant and testing the actual RGS lifecycle. Example: end-round behaviour depends on the mode/round auto-close contract; do not blindly couple end-round to `payout > 0` or `payout == 0` in frontend code. The review requirement is that the frontend sends no incorrect/unnecessary request and restores/settles active rounds exactly as the RGS expects.
