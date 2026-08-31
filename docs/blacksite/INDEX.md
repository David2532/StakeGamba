# BLACKSITE // BREACH — Codex Studio Index

Status: **M2 repository greybox gate complete / M3 concept-asset pass started**
Last official-doc review: **2026-08-07**

This directory is the durable source of truth for the next original Stake Engine slot. Root `AGENTS.md` is intentionally a routing document; detailed knowledge lives here so Codex does not have to carry the entire project encyclopedia in every turn.

## Read order

Every major Codex task starts with:

1. `/AGENTS.md`
2. this file
3. the task-relevant documents below
4. the relevant repo skill under `/.agents/skills/`
5. the relevant specialist agent under `/.codex/agents/`

## Core product and architecture

- `MASTER_PLAN.md` — product vision, architecture, milestones and Definition of Done.
- `M1_GAME_MATH_CONTRACT.md` — frozen BLACKSITE M1 mechanic, modes, Ghost Route, events, fixtures and Gate A–D decisions.
- `M1_COMPLIANCE_REVIEW.md` — truthful requirement-by-requirement M1 status and next-evidence gates for all 51 checklist items.
- `M2_COMPLIANCE_REVIEW.md` — exact SHA-bound M2 unit/browser/build evidence and truthful current status for every checklist row.
- `M3_ASSET_MANIFEST.md` — concept-asset ledger, retained file hashes, production group gaps and the safe runtime/Spine integration gate.
- `STAKE_REQUIREMENTS_51.md` — the exact 51-point approval checklist supplied for this project, with proof expectations and release ownership.
- `RELEASE_EVIDENCE_51.json` — machine-checked current-candidate mapping for all 51 rows; separates automated proof from open manual and external gates.
- `STAKE_ENGINE_SOURCE_INDEX.md` — official Stake Engine/SDK source map and precedence rules.
- `OFFICIAL_DOC_REVIEW_2026-08-07.md` — dated review map covering current approval, RGS, math SDK, frontend SDK and Codex-source conclusions.
- `STAKEGAMBA_LESSONS.md` — reusable lessons from Golden Goal Rush, previous Stake feedback, PRs, release evidence and conversation history.
- `AGENT_OPERATING_MODEL.md` — orchestration, delegation, handoffs, ownership boundaries and escalation rules.
- `ANIMATION_BIBLE.md` — side-character, Spine/Pixi, symbol, cascade, cinematic, turbo and responsive animation standards.
- `RGS_REPLAY_CONTRACT.md` — authentication, play, active-round restore, settlement, replay, currency and social-mode invariants.
- `MATH_STANDARD.md` — math file contract, statelessness, lookup/books, RTP, volatility, force/evidence and optimization requirements.
- `ASSET_ART_STANDARD.md` — original asset pipeline, game-tile package, Spine delivery contract, audio, provenance and bundle budget.
- `QUALITY_QA_RELEASE.md` — deterministic fixtures, browser QA, extracted-package testing, candidate identity and approval lifecycle.
- `CODEX_MASTER_TASK.md` — reusable autonomous build brief for moving the project through M1–M6 without repeatedly rewriting the whole prompt.

## Specialist agents

Current repo-scoped Codex roles under `.codex/agents/`:

- `creative_director`
- `game_designer`
- `animation_director`
- `intro_director`
- `asset_director`
- `frontend_engineer`
- `math_rgs_engineer`
- `rgs_replay_engineer`
- `mobile_performance`
- `stake_compliance`
- `research_librarian`
- `qa_director`
- `release_manager`

Use the smallest set that covers the task; the parent session remains accountable for integration and truthfulness.

## Repo skills

Current reusable skills under `.agents/skills/`:

- `aaa-animation`
- `stake-intro`
- `asset-pipeline`
- `stake-3star-compliance`
- `stake-rgs-replay`
- `stake-math-production`
- `aaa-visual-qa`
- `mobile-performance`

Load task-relevant skills rather than carrying every specialty into every run.

## Existing StakeGamba infrastructure to inspect before rebuilding anything

The hardened Golden Goal Rush branches already contain useful infrastructure. Reuse only when its contract is verified for the new game:

- RGS request/session utilities;
- active-round restore and event persistence;
- Replay read-only path;
- currency formatting including sub-cent and social currencies;
- Social Mode terminology gates;
- responsive/mobile/popout QA;
- insufficient-funds and major-action confirmation QA;
- paytable/rules verification;
- exact frontend/math package manifests and release hashes;
- extracted-build Playwright retests;
- math/book/lookup consistency gates.

Never inherit Golden Goal Rush theme assets, game-specific math, text, assumptions or stale release artifacts merely because the code exists.

## Source precedence

When sources disagree, use this order:

1. current Stake Engine approval/publication requirements;
2. current Stake RGS and SDK technical documentation;
3. the exact 51-point project checklist;
4. verified behaviour of the current StakeGamba hardened branch;
5. these BLACKSITE design documents;
6. historical chat/PR notes.

A current official requirement always wins. Update the affected document when that happens.

The exact candidate CI resolves every browser reference in `RELEASE_EVIDENCE_51.json` against the packaged-frontend evidence. A complete matrix does not convert manual or external rows into repository-owned passes.

## Definition of a truthful PASS

A requirement is not PASS because code looks correct. Depending on the requirement it needs one or more of:

- unit/contract test;
- real browser test;
- mocked RGS network proof;
- deterministic fixture screenshot/video;
- extracted upload-package retest;
- math/book/lookup audit;
- exact artifact hash/manifest;
- manual visual inspection;
- external Stake/Slack/ACP confirmation.

External lifecycle items such as Front/Math approval, approved-channel posting and Game Released can never be self-certified by repository CI.
