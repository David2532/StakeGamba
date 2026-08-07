# BLACKSITE // BREACH — AAA Stake Slot Master Plan

Status: **M1 COMPLETE — INITIAL NON-RELEASE MATH CANDIDATE VERIFIED / M2 GREYBOX STARTED**

## 1. Product target
Create a new, original Stake Engine slot that aims for **3-star studio quality**, not merely technical acceptance. The game should reuse the hardened Stake/RGS/replay/QA infrastructure already proven in StakeGamba while establishing a fully new theme, mechanic implementation, visual identity, math package, assets, and presentation layer.

Working title: **BLACKSITE // BREACH**

Theme: premium cyber-heist / classified server-bunker intrusion. Dark physical environment, dense machinery, restrained emissive lighting, tactical security UI, authored side character/operative, and a board that appears integrated into the facility rather than floating over a generic background.

## 2. Core experience
The player should understand the visual story without reading flavor copy:
- Spin = initiate intrusion attempt.
- Winning cells = compromised/breached positions.
- Cascades = the intrusion propagates through the network.
- Persistent/strengthening breach cells during the round = deeper access.
- Feature trigger = security layer collapses / BLACKOUT PROTOCOL begins.
- Side character reacts to state but never controls or alters game results.

The v1 mechanic, mode, payout-unit, event and presentation interfaces are frozen in `M1_GAME_MATH_CONTRACT.md`. The initial non-release math candidate has passed its M1 automated package, distribution, risk, schema and fixture gates: 300,000 books, 90/90 gates, 48/48 fixtures and 7/7 tests. Candidate fingerprint: `d03fab2727e046eb6a151e579c4852cbb0536415b37028dcb3d2de9c99f278d8`; typed event-schema hash: `bb4f3ff88200519682a539909b196f1462069b865a48afd04cb3219e7b9efe29`. This closes M1 only and does not imply frontend readiness, manual 3-star review, Stake approval or release.

## 3. Technology direction
Reuse the existing Stake web-SDK style monorepo:
- Svelte 5
- PixiJS v8
- existing `pixi-svelte`
- existing Spine 4.2 Pixi runtime
- existing particle emitter
- existing RGS/session/replay/restore/currency/social utilities where correct
- existing Playwright/Stake QA pipeline, generalized for the new app

Do **not** add GSAP/Rive/another animation runtime by default. The current stack already supports skeletal character animation, spritesheets, filters and particles. New production dependencies require a measured technical need.

## 4. Codex studio structure
Codex should orchestrate specialists rather than asking one generalist to own everything:

1. `creative_director` — art direction, hierarchy, composition, 3-star bar.
2. `stake_compliance` — current approval requirements and proof matrix.
3. `math_rgs_engineer` — fixed stateless math, books/lookups, event contract, RTP/max-win/tail analysis.
4. `asset_director` — asset briefs, original/provenance manifest, Spine delivery contracts, optimization.
5. `frontend_engineer` — app integration, RGS flow, board/UI/responsive/replay.
6. `animation_director` — Spine character, board motion, event synchronization, performance.
7. `intro_director` — boot/feature/big-win/max-win cinematics.
8. `qa_director` — deterministic fixtures, browser evidence, extracted package and release verdict.

Parallel work is allowed only where contracts are stable. Math/event contract and visual state contract must be agreed before deep animation work.

## 5. Agent workflow per major feature
For each feature:
1. Parent agent reads root `AGENTS.md` and relevant skills.
2. `stake_compliance` verifies current requirements affected by the feature.
3. `creative_director` defines visual acceptance criteria.
4. `math_rgs_engineer` defines/validates any authoritative book events.
5. `frontend_engineer` creates deterministic fixture/state plumbing.
6. `asset_director` provides the asset contract/manifest entries.
7. `animation_director` implements motion using the fixtures.
8. `intro_director` joins only when cinematic staging is involved.
9. `qa_director` proves desktop/mobile/popout/replay/restore/turbo behavior.
10. Parent agent integrates findings, runs full gates, and records residual blockers.

No specialist may silently change another discipline's contract.

## 6. Side-character system
### Desktop
A single operative/AI-security character occupies one side of the board, integrated into the bunker composition. The character should feel alive but spend most time in low-amplitude idle motion.

### Portrait mobile
Do not shrink the desktop scene uniformly. Recompose into a compact bust/corner vignette or crop the character behind the board. The board and controls always win the hierarchy battle.

### Runtime
Use Spine 4.2 through the repository's existing `@esotericsoftware/spine-pixi-v8` integration.

Required semantic states:
`idle_a`, `idle_b`, `spin_start`, `anticipation`, `win_small`, `win_medium`, `win_big`, `feature_tease`, `feature_trigger`, `bonus_idle`, `bonus_win`, `max_win`, `recover`.

Use Spine mixing and tracks, not hard replacement for every state. Use authored animation events to synchronize sparks, impacts, sound and UI pulses.

Every state has:
- expected duration/loop behavior;
- allowed transitions;
- turbo behavior;
- replay/restore behavior;
- mobile composition behavior;
- timeout/failure fallback.

## 7. Animation quality system
Create a `PresentationDirector`/equivalent semantic layer. It consumes authoritative game events and emits presentation cues. It never calculates payouts.

Suggested hierarchy:
- `GameEventAdapter` — converts book/RGS event structures into typed game-domain presentation messages.
- `PresentationDirector` — sequences board, character, UI, FX and sound cues.
- `CharacterController` — Spine state/mixing/tracks.
- `BoardMotionController` — reveal/hit/cascade/feature-cell motion.
- `FxController` — particles/filters/camera impulse.
- `CinematicController` — intro/feature/big-win sequences.
- `AudioDirector` — semantic SFX/music cues with mute/resume lifecycle.

All controllers support cleanup and deterministic completion.

## 8. Intro standard
Normal boot cinematic target: ~2.5–4.0 seconds with skip/fast path.

Beat sheet:
- black/system boot;
- rack lights/security scan;
- BLACKSITE lockup assembly;
- breach/glitch impact;
- operative/monitor reveal;
- seamless resolve into playable board.

Do not block restored rounds or Bet Replay behind the first-launch cinematic. Do not use an opaque full-screen video as the only implementation if it makes state, skip, mobile composition or asset loading fragile.

## 9. UI standard
Build a distinct production UI rather than visually shipping Stake's sample UI package. Required controls and information remain easy to find.

Rules:
- Board first.
- Clear balance / bet / win.
- Strong spin affordance.
- Bet control uses all RGS-supported levels.
- Sound mute visible/accessible.
- Game information/rules discoverable.
- Mode cost/RTP/max-win communication derives from the shipped math config.
- Autoplay requires confirmation if present.
- Spacebar maps to bet.
- Win increments remain legible in fast/turbo.
- Touch targets and safe-area behavior verified on mobile.

## 10. Stake-first architecture gates
Before visual polish is considered complete:
- stateless bet model;
- exact RGS/session flow;
- interrupted-round restore without double play/settle;
- mandatory Bet Replay;
- exact canonical mode identity;
- currency formatting including fractional cases;
- social language restrictions;
- insufficient funds behavior;
- no external network dependencies from final static build;
- unique final assets;
- mobile and popout layouts;
- current disclaimer/rules text;
- exact frontend/math package identity.

## 11. Math pre-production gate
Do not start final polish on unstable math.

Math agent deliverables first:
- mechanics spec and state diagram;
- game modes and costs;
- generated book event schema;
- simulation counts/seeds;
- target and achieved RTP by mode;
- hit frequency and payout buckets normalized by mode cost;
- volatility/variance/stddev;
- tail metrics;
- max-win existence and lookup achievability;
- lookup diversity/effective sample size;
- short-window operator/player distribution analysis for risk visibility;
- force records/fixtures covering every presentation state.

All odds stay fixed and player-independent.

## 12. Asset production gate
No final integration from ad-hoc placeholders.

Required manifest groups:
- logo/title lockup;
- desktop background layers;
- portrait/mobile background crop/layers;
- board frame and breach-cell layers;
- symbol set;
- wild/scatter/feature symbols;
- operative Spine rig + atlas + states/events;
- UI icons/control surfaces;
- intro FX;
- feature FX;
- particles;
- audio/music.

Every final asset has provenance/originality, path, dimensions, runtime contract and optimization status.

## 13. Deterministic visual fixture system
A polished slot cannot depend on random spins for visual iteration. Create direct fixture/story states for:
- base idle;
- zero win;
- small/medium/big base wins;
- multi-cascade sequence;
- feature tease;
- feature trigger;
- bonus intro;
- representative bonus states;
- max win;
- insufficient funds;
- interrupted round;
- replay;
- all supported major currencies/social displays;
- desktop / 390x844 / landscape / tablet / popout;
- turbo equivalents;
- missing animation asset fallback.

This is the key enabler for fast Codex visual iteration: the agent can repeatedly open the exact state instead of waiting for RNG.

## 14. Quality measurement
The QA agent must capture and track:
- build/lint/test state;
- no console/network errors;
- screenshot evidence for required fixtures/viewports;
- no overlapping/clipped controls;
- no scrollbars in game viewport;
- board readability;
- animation completion/deadlock checks;
- replay/restore determinism;
- first-play readiness/load timing;
- asset and total bundle size;
- heavy-scene frame-time regressions;
- exact extracted-build checks;
- release hashes/manifests.

## 15. Milestones
### M0 — Studio foundation
Agent system, skills, current official research and master plan. **Complete.**

### M1 — Game design + math contract
Freeze mechanic/event/state contract and initial valid math candidate. **Complete for the initial non-release candidate; exact automated evidence is recorded under `math/games/blacksite_breach/library/publish_files/`.**

### M2 — Greybox playable
New app/game identity, deterministic fixtures, RGS/replay/restore, board without final assets. **Started as greybox only; no frontend, browser, visual or release gate is claimed complete.**

### M3 — Art/character integration
Production asset manifest, first original asset set, Spine side character runtime and responsive composition.

### M4 — Motion/cinematic pass
All semantic animation states, boot intro, feature transitions, big-win/max-win presentation, turbo variants.

### M5 — 3-star polish
Audio, microinteraction, particles/filters, layout tuning, performance and bundle optimization.

### M6 — Stake candidate
Full math + frontend regeneration, extracted package QA, requirement trace, manual visual review, exact release hashes. No claim of Stake approval until Stake itself approves the version.

## 16. Definition of done
BLACKSITE is not ready merely because it builds. It is ready for submission only when:
- the current official Stake requirement matrix is complete;
- the exact math/frontend candidate is frozen and identified;
- full repository QA is green;
- extracted-package QA is green;
- deterministic visual fixtures pass all target viewports;
- animation/cinematic failure paths cannot deadlock gameplay;
- no final sample/placeholder assets remain;
- manual art-direction review judges it cohesive and studio-grade;
- known risks are documented and no release blocker remains.
