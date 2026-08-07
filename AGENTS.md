# StakeGamba / BLACKSITE Codex Operating Instructions

## Mission
Build **BLACKSITE // BREACH** as a new, original Stake Engine slot targeting studio-quality / 3-star execution. Reuse verified infrastructure and hard-won lessons from Golden Goal Rush, but do not copy its theme, shipped art, game-specific math, player-facing text, stale candidates, or unverified assumptions.

This file is a router, not the encyclopedia. Detailed source-of-truth documents live under `docs/blacksite/`.

## Mandatory context load
Before substantial work, read:

1. `docs/blacksite/INDEX.md`
2. the task-relevant BLACKSITE documents linked there
3. the relevant skill under `.agents/skills/`
4. the relevant specialist agent contract under `.codex/agents/`

For Stake approval/compliance work, always read `docs/blacksite/STAKE_REQUIREMENTS_51.md` and `docs/blacksite/STAKE_ENGINE_SOURCE_INDEX.md` first.

For any implementation that touches a problem already encountered in Golden Goal Rush, read `docs/blacksite/STAKEGAMBA_LESSONS.md` before coding.

## Source precedence
1. Current official Stake Engine approval/publication requirements.
2. Current Stake RGS and SDK technical documentation.
3. The exact 51-point project approval checklist.
4. Verified current StakeGamba code/evidence.
5. BLACKSITE design docs.
6. Historical PR/chat notes.

If official requirements changed, update the repo docs in the same change. Never preserve a stale instruction merely because it is already written here.

## Work style
- Inspect the real repository before proposing architecture.
- Prefer modifying/generalizing proven infrastructure over creating a parallel second implementation.
- Use specialist subagents for cross-discipline tasks instead of one giant generalist pass.
- Parallelize research, review and independent implementation lanes only after interfaces/contracts are stable.
- Do not ask for routine reversible decisions. Choose the safest maintainable option, document it and continue.
- Escalate only genuinely irreversible product decisions, unavailable credentials/external approvals, or evidence that requirements conflict.
- Do not declare success from source inspection alone when browser/package/math/external evidence is required.

## Non-negotiable Stake invariants
- Every paid bet is stateless and independent of previous outcomes.
- RGS/book output is payout authority. Frontend code never invents, recomputes or changes settlement.
- `rgs_url` and authentication/session data come from launch/RGS contract, not hardcoded production values.
- Use all valid bet parameters returned by authenticate and restore active-round bet state from authoritative round/auth data.
- No real play request on insufficient balance.
- Do not send frontend end-round calls when the round/RGS contract says the round is already/automatically closed; settlement logic follows authoritative round state, never win/loss presentation.
- Replay is read-only, does not authenticate or mutate wallet state, and is supported from day one.
- Preserve exact currency precision required for visible wins, including sub-cent/fractional cases and SC/GC presentation.
- Social Mode has its own terminology/language rules and is a separate test lane.
- Final frontend is static and contains no external runtime asset/font/network dependency beyond Stake/RGS endpoints allowed by the platform.
- No Stake Engine Loader in the submitted game.
- Final assets are original and production-ready; sample-game visual/audio assets and generic placeholders are forbidden in a candidate.
- Post-release math/gameplay changes require Stake handling; freeze math/mechanics before submission.

## Quality bar
Minimum approval is not enough. Target a coherent, polished, deep game with authored art, clean animation, optimized load behaviour and reliable operation across desktop, mobile and popout.

The board remains the gameplay focal point. Side characters/cinematics may reinforce state but cannot obscure controls, payouts, winning combinations or required information.

Use the existing PixiJS v8 + Spine 4.2 stack for authored character motion unless a measured requirement proves it insufficient. Use deterministic presentation state machines and Spine/Pixi events; never make arbitrary timeout chains the source of gameplay truth.

## Deterministic development
Every rare or review-critical state must be directly reproducible without waiting for RNG. Maintain fixtures/replay cases for at least:
- zero win;
- small/medium/big win;
- five representative wins per game mode;
- cascades/feature tease/feature trigger;
- bonus entry/bonus play;
- max win;
- insufficient funds;
- interrupted active round;
- replay loss/win/feature/max;
- currencies/sub-cent cases;
- Social Mode;
- desktop/mobile/landscape/popout S/L;
- turbo/fast path;
- missing-animation fallback.

## Golden Goal Rush lessons that are now permanent policy
- Never trust `main` to be the released/reviewed truth; identify the exact source/test/build/package commit and hashes.
- Never permit a local simulation fallback in paid RGS mode.
- Never infer visible wins from frontend calculations when RGS/book values exist.
- Round settlement is driven by round authority, not by whether the result won or lost.
- Replay aliases/modes, cost multipliers, fractional play amounts and final payout must be canonical and deterministic.
- Currency formatting must support exact fractional wins while keeping balance display rules separate.
- Social terminology must be tested on first render, rules, symbol table, feature UI, replay and accessibility text.
- Max Win shown in Game Information must be derived from shipped math/config/book evidence per mode.
- Exact upload packages must be regenerated, extracted and retested; stale/superseded artifacts must never be uploadable by mistake.
- CI is not release approval. External Stake actions remain external blockers until actually completed.

## Required verification families
Use and extend the repository's existing gates rather than bypassing them. Release-candidate coverage must include:
- lint/build;
- RGS/auth/play/settlement/restore;
- replay;
- currencies and Social Mode;
- insufficient funds and confirmation flows;
- rules/paytable/RTP/max-win consistency;
- desktop/mobile/popout/no-scroll/touch behaviour;
- animation completion and failure fallback;
- math books/lookups/index/config integrity;
- deterministic generation where required;
- exact extracted frontend/math package retest;
- release manifests/hashes/evidence;
- manual art-direction review.

The existing scripts include `stake:qa`, `stake:qa:replay`, `stake:qa:wallet`, `stake:qa:math`, `stake:qa:i18n`, `stake:qa:mobile`, `stake:qa:major-actions`, `stake:qa:interrupted-round`, `stake:qa:insufficient-funds`, `stake:qa:rules`, `stake:qa:intro`, `stake:qa:paytable`, `stake:qa:regression` and `stake:qa:e2e`. Generalize or replace them only with equal-or-stronger evidence.

## Release language
Allowed internal lifecycle examples:
`DESIGNING` → `MATH_CONTRACT_PENDING` → `IMPLEMENTING` → `QA_BLOCKED` → `CANDIDATE_GENERATED` → `MANUAL_REVIEW_REQUIRED` → `STAKE_REVIEW_PENDING` → `APPROVED` → `RELEASED`.

Never write `READY`, `APPROVED`, `LIVE` or `RELEASED` unless the evidence for that exact lifecycle state exists.

## Key documents
- `docs/blacksite/INDEX.md`
- `docs/blacksite/MASTER_PLAN.md`
- `docs/blacksite/STAKE_REQUIREMENTS_51.md`
- `docs/blacksite/STAKE_ENGINE_SOURCE_INDEX.md`
- `docs/blacksite/STAKEGAMBA_LESSONS.md`
- `docs/blacksite/AGENT_OPERATING_MODEL.md`
- `docs/blacksite/ANIMATION_BIBLE.md`
- `docs/blacksite/RGS_REPLAY_CONTRACT.md`
- `docs/blacksite/MATH_STANDARD.md`
- `docs/blacksite/ASSET_ART_STANDARD.md`
- `docs/blacksite/QUALITY_QA_RELEASE.md`
- `docs/blacksite/CODEX_MASTER_TASK.md`
