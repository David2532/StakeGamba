---
name: aaa-animation
description: Use for BLACKSITE character animation, Spine/Pixi animation architecture, symbol/cascade motion, anticipation, win celebrations, particles, camera motion, timing, performance, and animation QA. Do not use this skill to change payout math.
---

# AAA Slot Animation Skill

## Stack decision
The repository already ships PixiJS v8 plus `@esotericsoftware/spine-core` and `@esotericsoftware/spine-pixi-v8` 4.2.x. Use this stack before adding another production animation dependency.

- **Spine**: hero/side character, complex skeletal loops, layered reactions, feature transformations.
- **Pixi AnimatedSprite + atlases**: short symbol loops, sparks, screen overlays, mechanical UI loops.
- **Existing particle emitter**: bounded sparks, dust, shards, scan particles.
- **Svelte/Pixi scene state**: layout and semantic orchestration, not frame-by-frame character animation.

Primary references:
- https://pixijs.com/8.x/tutorials/spine-boy-adventure
- https://esotericsoftware.com/spine-applying-animations
- https://esotericsoftware.com/spine-pixi
- https://pixijs.com/8.x/guides/components/assets

The official Spine AnimationState guidance is the model: queue playback, explicit mixing/crossfades, multiple tracks for layering, and animation event listeners. The official guide includes a video explaining AnimationState concepts that also apply across Spine runtimes.

## Side-character standard
Build the side character as a semantic state machine with authored clips, not a looping GIF/video.

Minimum clip contract:
- `idle_a`: 3–6s breathing/monitoring loop.
- `idle_b`: alternate idle used occasionally; no random movement that steals focus every few seconds.
- `spin_start`: 0.25–0.6s acknowledgement.
- `anticipation`: loopable tension pose while the board is actually awaiting/playing a tease sequence.
- `win_small`: <=0.8s restrained reaction.
- `win_medium`: 0.8–1.4s.
- `win_big`: 1.4–2.2s, may layer arm/head effects.
- `feature_tease`: short alert/scan reaction.
- `feature_trigger`: 1.0–2.0s transition into bonus context.
- `bonus_idle`: distinct stance but compositional continuity.
- `bonus_win`: bonus-specific reaction.
- `max_win`: authored hero moment with a guaranteed exit.
- `recover`: neutral fallback pose used after interrupted/failed presentation.

Suggested Spine tracks:
- Track 0: full-body base state (`idle`, `anticipation`, `bonus_idle`, hero poses).
- Track 1: short upper-body/head/arm reactions when the rig is authored to permit layering.
- Track 2: optional additive effects/attachments only when the rig requires it.

Use `AnimationStateData` mixes. Start from roughly 80–250ms crossfades and tune per transition in Spine Preview/runtime. Impact cuts may use 0 mix deliberately; do not default everything to hard cuts.

## Event synchronization
Author animation markers/events such as:
- `sfx_hit`
- `sfx_alarm`
- `fx_spark`
- `fx_screen_pulse`
- `camera_impact`
- `ui_count_start`
- `ui_count_peak`

Runtime listeners synchronize sound/particles/UI to these events. Never derive payout amounts from animation events.

## Presentation bus
Game/book events are authoritative. Convert them into semantic presentation cues, for example:

`book reveal -> presentation.spinStart()`

`winInfo -> presentation.winTier(tier, positions, amount)`

`feature trigger event -> presentation.featureTrigger()`

`finalWin -> presentation.settle(amount)`

The presentation layer may choose visual intensity based on declared thresholds, but may not change the amount or outcome.

## Motion hierarchy
Every scene needs visual priority:
1. Current winning symbols / feature trigger.
2. Win amount / required game information.
3. Board state and next cascade.
4. Character reaction.
5. Background ambience.

If a side-character reaction competes with #1–#3, reduce or delay it.

## Timing grammar
Use consistent motion families:
- UI confirmation: 90–180ms.
- Symbol hit/read: 180–420ms.
- Cascade transition: 220–550ms depending on turbo.
- Anticipation beat: 450–1200ms only when the outcome event warrants it.
- Feature transition: 900–2200ms, skippable/shortened where appropriate.
- Big-win stage: use escalating phases rather than one long generic count-up.

Fast/turbo mode shortens the grammar but must keep winning combinations and win amounts legible per Stake requirements.

## Board animation rules
- Do not scale the entire board wildly on every win.
- Highlight exact winning cells before removing them.
- Keep cascade direction and timing physically consistent.
- Use anticipation only from authoritative event information; do not fake near-misses unrelated to the actual book.
- Win trails/glows must clear deterministically before the next board state.
- A large win may add subtle camera impulse, but the board must remain readable.

## Mobile recomposition
Desktop side character can occupy a dedicated flank. Portrait mobile should switch to one of:
- cropped bust behind/above the board;
- compact corner portrait;
- hidden idle character with reactions moved to a header vignette.

Do not shrink a 1200px desktop composition uniformly just to retain the full character.

## Performance gates
- Atlas related textures and animation frames.
- Avoid giant transparent canvases around each frame.
- Prefer skeletal animation for long character sequences over hundreds of full-frame PNGs.
- Bound particle counts and lifetime.
- Use filters intentionally; avoid stacking multiple full-screen blur/glow/displacement filters during normal spins.
- Preload the minimum first-play bundle; background-load bonus-only assets when safe.
- Asset load failure must show a deterministic fallback and must never block settlement or replay.

## Determinism and lifecycle
Every animation API returns/owns a completion signal with timeout/fallback. On destroy/replay/restore/viewport change:
- remove listeners;
- kill pending timelines/tickers;
- return character to a known state;
- clear transient particles/filters;
- never leave the game waiting for an animation callback that can no longer fire.

## QA fixture matrix
Create deterministic preview/story fixtures for:
- idle variants;
- spin start;
- anticipation;
- each win tier;
- feature tease/trigger;
- bonus entry/idle/win/exit;
- max win;
- turbo equivalents;
- replay mode;
- restore/interrupted round;
- asset failure/fallback;
- portrait/landscape/popout layouts.

A feature is not complete until browser screenshots/video frames show the intended composition at those states.