# BLACKSITE // BREACH — Autonomous Codex Master Task

Use this document as the persistent build brief. Do not paste the entire repository context into every prompt; Codex must load `AGENTS.md` and the indexed BLACKSITE docs/skills/agents as needed.

## Mission

Build BLACKSITE // BREACH from the current M0 studio foundation through an exact Stake-review candidate. Target **Stake Engine 3-star studio quality**, not minimum technical compliance.

The project must reuse verified generic infrastructure from StakeGamba/Golden Goal Rush where appropriate while remaining a distinct new game with new math, new assets, new rules, new identity and a separate release lifecycle.

## Autonomy

Work autonomously through reversible technical/product-detail decisions. Do not repeatedly stop to ask the founder for implementation preferences that can be safely decided from:
- current official Stake documentation;
- the 51-point project matrix;
- the existing hardened StakeGamba implementation/evidence;
- the BLACKSITE art/mechanic brief;
- standard engineering judgment.

Escalate only real blockers described in `AGENT_OPERATING_MODEL.md`.

## Required startup sequence

Before any major implementation run:

1. Read root `AGENTS.md`.
2. Read `docs/blacksite/INDEX.md`.
3. Re-check current official Stake pages relevant to the milestone and update `STAKE_ENGINE_SOURCE_INDEX.md` / `STAKE_REQUIREMENTS_51.md` when requirements changed.
4. Inspect the exact current repository/branch, open PRs and existing StakeGamba infrastructure before designing a duplicate solution.
5. Load the relevant repo skills and delegate to specialist agents.
6. Record current lifecycle state and blockers.

## Permanent constraints

- Never modify released/reviewed Golden Goal Rush math/gameplay as a side effect of BLACKSITE work.
- Never use paid-game local RNG/fallback when RGS is unavailable.
- Never let frontend presentation become payout authority.
- Never introduce player/account/history-adaptive odds.
- Never ship sample-game art/audio or generic placeholder final assets.
- Never mark external Stake approval/release actions complete without external evidence.
- Never call a build `READY` merely because tests passed.
- Never bypass an existing strong StakeGamba gate without replacing it with equal/stronger proof.

## M1 — Game Design + Math/Event Contract

Orchestrate Creative, Game Design, Math/RGS, Stake Compliance and Frontend specialists.

Deliver:
- final original concept statement and player loop;
- canonical mode registry;
- exact base/feature mechanic specification;
- state diagram;
- win evaluation rules;
- feature trigger/retrigger rules;
- cost multipliers;
- target RTP and max win per mode;
- book event schema;
- event ordering;
- frontend display contract;
- force/fixture scenario list;
- initial valid math candidate;
- cost-normalized distribution/risk report;
- rules draft generated from exact contract;
- compliance design review against all 51 checklist items.

Gate: no deep final art/animation until mechanic/math/event/presentation contracts are stable.

## M2 — Greybox Playable

Deliver a new isolated app/game identity using verified framework packages.

Must include:
- correct live RGS auth/play/settlement lifecycle;
- invalid RGS/session failure behaviour;
- all authenticate-provided bet parameters;
- active-round restore without duplicate play;
- canonical mode selection;
- insufficient-balance prevention;
- confirmation for autoplay/high-cost modes;
- Replay from day one;
- exact currency/sub-cent formatting;
- Social Mode phrase/currency lane;
- no-scroll desktop/mobile/popout composition;
- rules/info generated or validated from candidate math;
- deterministic fixture harness for all required states;
- basic but non-final greybox board/assets only.

Gate: complete browser/network proof before visual complexity increases.

## M3 — Production Art + Character Integration

Asset Director + Creative Director create/approve the asset manifest and original art package.

Deliver:
- title/logo;
- production board/environment;
- complete symbol set;
- responsive desktop/mobile environment compositions;
- production Spine side-character rig and atlas;
- UI/control art;
- game tile BG/FG/provider logo package;
- production asset provenance/rights manifest;
- optimized static paths/atlases;
- zero final sample/placeholder assets in finished surfaces.

Frontend/Animation integrate without breaking M2 contracts.

## M4 — Motion + Cinematic Pass

Animation/Intro specialists implement:
- character semantic state machine;
- Spine mixing/tracks/events;
- spin/reveal motion;
- winning-cell readability;
- cascade continuity;
- breach-cell progression;
- anticipation;
- feature trigger/entry/exit;
- bonus idle/win states;
- big/super/max-win escalation;
- boot intro and skip;
- turbo variants;
- replay/restore-safe sequencing;
- missing-animation fallback;
- audio event hooks.

Use deterministic fixtures for iteration. Every async cue gets completion, cleanup, skip and timeout paths.

## M5 — 3-Star Polish

Creative + QA + Mobile/Performance run repeated critique loops.

Improve:
- composition/hierarchy;
- symbol readability;
- character integration;
- lighting/material consistency;
- audio/music quality;
- microinteractions;
- modal/rules polish;
- Popout S/L;
- older mobile performance;
- asset and bundle size;
- frame-time spikes;
- load/first-play readiness;
- Social/Replay visual parity.

Do not chase polish by weakening result readability or compliance.

## M6 — Exact Stake Candidate

Freeze source/math/frontend identity.

Run:
- full lint/build/test;
- all generalized Stake QA families;
- 51-point repo-owned matrix proof;
- large production math generation/optimization/audit;
- exact books/lookups/index/config checks;
- five-win rule cases per mode;
- replay scenario matrix;
- currency/social matrix;
- desktop/mobile/popout fixture suite;
- clean regeneration;
- canonical frontend/math package build;
- exact extraction/retest;
- hashes/manifests/evidence bundle;
- manual exact-package art-direction review;
- old mobile/device review.

Lifecycle after internal success is `STAKE_REVIEW_PENDING`, never `APPROVED` until Stake actually approves the exact versions.

## Implementation strategy

### Reuse first
Before writing new RGS/replay/currency/release code, locate the latest hardened Golden Goal Rush implementation and tests. Generalize into shared packages/scripts where clean. Copying old code into a second divergent stack is a last resort.

### Contracts before aesthetics
Final animation depends on stable event/state names. Final rules depend on stable math. Freeze those first.

### Evidence before claims
Every milestone summary includes:
- exact SHA;
- implemented scope;
- tests run/results;
- screenshots/network/math evidence;
- current checklist count by status;
- repo-owned blockers;
- external blockers;
- next autonomous step.

### Small durable docs
Keep root instructions concise. Update focused docs when new Stake feedback or hard-won lessons appear. Do not dump every historical log into `AGENTS.md`.

## Stake feedback ingestion rule

Whenever Stake gives new feedback:
1. preserve the exact feedback text in a dated history/evidence document;
2. map it to checklist/source requirement;
3. identify root cause rather than patching symptom only;
4. add regression test at the observed layer;
5. update the relevant durable standard if the lesson applies broadly;
6. generate a new candidate identity if frontend/math package changed;
7. mark previous packages superseded.

## Completion standard

The project is complete only when:
- the exact 51-point checklist is genuinely satisfied, including external lifecycle steps;
- exact frontend/math versions are approved;
- game is live and verified;
- no release blocker remains;
- approval request/live-channel operational closure is completed;
- repository records the final production identity without ambiguous superseded packages.
