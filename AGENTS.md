# StakeGamba — Codex AAA Slot Studio

## Mission
Build new Stake Engine games to a studio-quality / 3-star target, not merely to minimum approval. The current new-game codename is **BLACKSITE // BREACH**. Treat existing Golden Goal Rush code as reusable infrastructure and evidence only; do not copy its theme, shipped artwork, game-specific math, or user-facing text into the new title.

## Non-negotiable workflow
1. Inspect the real repository and current Stake requirements before changing behavior.
2. Delegate specialist work to the repo-scoped subagents under `.codex/agents/` when the task crosses disciplines.
3. Load the relevant skill under `.agents/skills/` before implementing animation, intro, compliance, math, assets, or visual QA.
4. Work from evidence. Never invent Stake requirements, RGS payloads, asset contracts, math results, or browser behavior.
5. Keep math/RGS outcome authority separate from presentation. Frontend animation must never create, alter, or infer a payout.
6. New games must be stateless: every paid bet is independent of prior outcomes.
7. Do not use Stake sample-game art/audio/animation assets in a release candidate. Final assets must be original and locally packaged for Stake CDN delivery.
8. Bet Replay is a first-class feature from day one, not a late retrofit.
9. Mobile, popout/mini-player, currencies, social language, interrupted rounds, insufficient funds, accessibility, sound mute, fast/turbo legibility, and all RGS bet levels are release-blocking concerns.
10. Never call a candidate READY based only on build success. Require extracted-build browser QA, math contract checks, replay checks, and manual visual review.

## Visual quality bar
- Target Stake Engine 3-star quality: exceptional creativity, uniqueness, polish, clean animation, strong concept depth, and optimized bundle size.
- The board must remain the gameplay focal point. Side characters may amplify events but must never hide outcomes, controls, balance, bet, win, or required information.
- Animation should communicate game state: anticipation, hit confirmation, cascade continuity, feature escalation, bonus entry, large-win escalation, and settlement.
- Prefer authored motion with intentional timing over generic CSS fades or random particle spam.
- Character animation standard: Spine skeletal animation through the existing PixiJS v8 runtime for hero/side characters; Pixi spritesheets/AnimatedSprite for short FX loops; existing particle emitter for bounded particles. Avoid adding a new animation framework unless the existing stack cannot satisfy a measured requirement.
- Every animation must have a deterministic completion/fallback path so game state cannot deadlock when an asset fails or playback is skipped.

## Animation architecture
Expose presentation events, not business logic. At minimum support semantic cues such as:
- `idle`, `idle_alt`, `spin_start`, `anticipation`, `win_small`, `win_medium`, `win_big`, `feature_tease`, `feature_trigger`, `bonus_enter`, `bonus_idle`, `bonus_win`, `max_win`, `error_recover`.
- Character base locomotion/idle belongs on Spine track 0; short reactions may layer on higher tracks when the rig supports it.
- Define explicit mix durations and never hard-cut between major poses unless the creative direction requires a deliberate impact cut.
- Use animation events/markers to synchronize sound, particles, board pulses, camera shake, and UI count-up. Do not use arbitrary setTimeout chains as the source of truth.
- Turbo/fastplay may shorten timing but must preserve visible winning combinations, win amounts, and required popups.

## Responsive composition
- Desktop may use a side character framing the board.
- Portrait mobile must recompose rather than uniformly shrink the whole desktop scene. Keep controls >= the project touch-target gate and keep the board readable.
- Character can crop, move behind the board, or switch to a compact bust/portrait state on narrow viewports; never let the character reduce board clarity.
- Support Stake popout/mini-player without board distortion.

## Performance
- Preload critical first-spin assets; lazily/background-load noncritical bonus cinematics only when it does not create a visible hitch.
- Atlas related textures to reduce draw calls and requests.
- Keep filter count, overdraw, giant transparent textures, and full-screen particle counts bounded.
- No external network dependencies from the built game. Fonts/images/audio/animation data must be packaged for Stake CDN delivery.

## Verification commands
Use the repository commands that exist at the current branch. For a release candidate, the expected baseline includes:
- `npm run lint`
- `npm run build`
- `npm run stake:qa`
- `npm run stake:qa:replay`
- `npm run stake:qa:mobile`
- `npm run stake:qa:intro`
- `npm run stake:qa:math`
- the release/publish pipeline applicable to the target game

When adding the new app/game, extend these scripts rather than bypassing the existing gates.

## Research sources
Use primary/current sources for implementation decisions:
- Stake Engine approval/docs: https://stake-engine.com/docs
- Stake SDK docs: https://stakeengine.github.io/math-sdk/
- PixiJS v8 docs: https://pixijs.com/8.x/
- Spine runtimes: https://esotericsoftware.com/spine-runtimes
- OpenAI Codex docs for agent/skill behavior: https://learn.chatgpt.com/codex/

If a current public requirement conflicts with this file, the current official requirement wins and this file must be updated.