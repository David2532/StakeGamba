# BLACKSITE // BREACH — Animation Bible

Owner: `animation_director`  
Co-owners: Creative Director, Frontend Engineer, Intro Director, Mobile/Performance

Goal: every motion beat should feel authored, readable and synchronized while remaining deterministic, skippable, performant and independent from payout authority.

## 1. Runtime standard

Use the existing repository stack first:
- PixiJS v8;
- Svelte 5 / pixi-svelte;
- `@esotericsoftware/spine-pixi-v8` + Spine 4.2 runtime for skeletal hero/side character work;
- Pixi spritesheets/AnimatedSprite for short repeated FX;
- existing particle emitter for bounded particles;
- Pixi filters only where their cost is measured and justified.

Do not add another major animation runtime by default.

## 2. Presentation architecture

Authoritative game/book events feed a semantic presentation layer:

`RGS/Book Event -> GameEventAdapter -> PresentationDirector -> Board / Character / FX / Audio / UI`

Presentation may:
- sequence;
- delay for readability;
- interpolate;
- layer character reactions;
- play sound/particles/camera impulses;
- shorten in turbo.

Presentation may **not**:
- calculate payout;
- change multiplier;
- decide whether a feature occurred;
- manufacture a win absent from authoritative events;
- block settlement forever when an asset fails.

## 3. Side-character role

Working fantasy: adult cyber operative/security specialist in a classified server facility. The character reacts to the intrusion and helps sell escalation, but the board is always the focal point.

Desktop:
- character may occupy left/right scene margin;
- silhouette frames the board rather than competing with it;
- low-amplitude idle most of the time;
- eye/head/hand focus directs attention toward meaningful board events.

Portrait mobile:
- recompose to bust/corner/behind-board crop;
- never scale the entire desktop composition uniformly just to preserve the full body;
- if necessary reduce character presence before reducing board readability.

Popout:
- character can switch to compact portrait or be partially omitted;
- required gameplay communication must not depend on seeing the character.

## 4. Spine state contract

Minimum semantic animations:

| State | Loop | Purpose |
|---|---|---|
| `idle_a` | yes | default breathing/focus |
| `idle_b` | yes/one-shot blend | occasional secondary idle |
| `spin_start` | no | brief terminal/hand action on legal play |
| `anticipation` | conditional loop | reacts to near-feature/meaningful suspense |
| `win_small` | no | restrained acknowledgment |
| `win_medium` | no | stronger positive reaction |
| `win_big` | no | energetic but not max-win level |
| `feature_tease` | no/hold | security alert/focus toward board |
| `feature_trigger` | no | full transition into feature state |
| `bonus_idle` | yes | heightened feature-mode idle |
| `bonus_win` | no | feature reaction |
| `max_win` | no | hero celebration/cinematic pose |
| `recover` | no | safe return from interrupted/skipped state |

Every animation state specifies:
- nominal duration;
- loop/queue behaviour;
- valid outgoing states;
- mix duration;
- track use;
- animation event markers;
- turbo version/scale;
- mobile visibility/crop;
- replay behaviour;
- restore behaviour;
- fallback timeout.

## 5. Track strategy

Suggested default:
- Track 0: body base state (`idle`, `anticipation`, feature stance, max-win main pose).
- Track 1: short upper-body/arm/head reactions that can layer without destroying base motion.
- Track 2+: rare additive micro-reactions only if rig/authoring supports clean blending.

Avoid stacking uncontrolled tracks. Clear/fade tracks deliberately on mode transitions and teardown.

## 6. Animation events / markers

Use authored event markers for synchronization where practical. Example event vocabulary:
- `sfx_terminal`;
- `sfx_alarm`;
- `fx_spark_left`;
- `fx_spark_right`;
- `fx_breach_pulse`;
- `camera_hit_small`;
- `camera_hit_big`;
- `ui_count_start`;
- `ui_count_impact`;
- `light_red_on`;
- `light_restore`.

The listener maps events to semantic controllers. Missing optional FX must not prevent the animation state from completing.

## 7. Board motion language

### Spin/reveal
- fast, controlled initiation;
- no excessive whole-screen motion;
- symbols settle with readable spacing and no blurry unresolved final frame.

### Win highlight
- winning cells must be unmistakable;
- non-winning content can dim slightly but must not disappear in a way that obscures board context;
- visible amount appears near the winning region without covering key symbols;
- minimum readable highlight time exists even in turbo.

### Winning lines
Motion should make the classic line evaluation immediately legible:
1. all five reels settle on the authoritative board;
2. the canonical payline path appears;
3. only the awarded 3/4/5-symbol prefix lifts or brightens;
4. WILD substitutions receive a distinct accent;
5. simultaneous lines are presented once in deterministic line-ID order;
6. the exact step award remains readable before the next free spin or settlement.

Do not invent reel stops, positions or line awards between authoritative events.

### BREACH and expanding target
Feature state must feel physical without obscuring the familiar reel game:
- three or more BREACH symbols on distinct reels trigger the eight-spin entry;
- BREACH never receives a line-win highlight;
- the selected regular target is visible throughout the feature;
- reels containing that target expand across all three rows before payline evaluation;
- free-spin current/total/remaining counters stay legible through every transition.

## 8. Anticipation

Anticipation may trigger only from authoritative state/events or a deterministic presentation rule based on the already-known round result. It cannot change probabilities.

Build tiers:
- micro anticipation: short audio/character attention;
- feature anticipation: board edge/lighting + character reaction;
- trigger confirmation: hard visual/audio beat after the feature is actually present.

Avoid fake repeated near-miss spam that makes normal spins feel dishonest or slow.

## 9. Win escalation

Define presentation thresholds separately from math buckets. A suggested system is based on return relative to mode cost, not raw absolute multiplier:
- small;
- medium;
- big;
- super;
- max.

Threshold values are product/presentation constants and never alter payout. They must be documented and tested against high-cost modes so a feature-buy result is not incorrectly treated as gigantic merely because the raw payout multiplier is large.

## 10. Boot intro

Target normal path: roughly 2.5–4.0 s, skippable.

Beat structure:
1. black/system wake;
2. rack lights and scanning pass;
3. BLACKSITE title decrypt/assemble;
4. BREACH impact/glitch;
5. operative/monitor reveal;
6. camera/layout resolves directly into playable composition.

Requirements:
- no opaque video dependency as the only implementation;
- skip always resolves to the exact playable state;
- active-round restore bypasses or shortens boot cinematic;
- Replay bypasses live-session intro unless explicitly part of the replayed round;
- mobile has its own composition, not a crop disaster;
- critical RGS/auth errors are not hidden behind a looping intro.

## 11. Feature / blackout cinematic

Feature transitions should reuse the physical environment:
- security lights shift;
- board breach network expands;
- character moves to feature stance;
- environment layers change;
- UI mode identity updates cleanly.

The transition must preserve:
- current authoritative win display;
- feature counter/state;
- skip/turbo path;
- restore from mid-feature;
- replay determinism.

## 12. Big/Max Win

Big-win treatment should scale in layers rather than immediately cover the game:
- board remains visually connected to the cause of the win;
- count-up is driven to authoritative final amount;
- character/FX can escalate at thresholds;
- skip resolves instantly to final amount and clean state;
- Max Win may use a stronger cinematic but must return deterministically.

No count-up logic is allowed to become wallet/settlement authority.

## 13. Turbo / fastplay

Turbo is not `animationDuration = 0`.

It must retain:
- visible winning symbols/combinations;
- readable win amounts;
- required confirmation/modals;
- feature trigger clarity;
- deterministic cleanup.

Shorten:
- idle gaps;
- travel distances/durations;
- count-up time;
- nonessential flourish loops.

Keep minimum perceptual hits for the information the player must understand.

## 14. Failure safety

Every async animation primitive has:
- completion promise/event;
- cleanup path;
- max-duration guard;
- skip path;
- asset-missing fallback;
- component teardown cancellation.

A failed Spine asset or particle texture may reduce polish, but cannot permanently lock the bet button, replay or restore flow.

## 15. Performance budget

Measure, do not guess.

Rules:
- atlas related textures;
- avoid huge transparent canvases;
- limit simultaneous full-screen filters;
- cap particles per semantic event;
- avoid per-frame allocation in hot loops;
- prefer transform/alpha over expensive texture regeneration;
- unload/disable bonus-only heavy effects when not needed;
- test the heaviest deterministic fixture on older mobile targets.

Record:
- first interactive time/load size;
- texture memory risk;
- frame-time spikes during feature/max-win;
- draw-call/filter regressions where tooling allows.

## 16. Deterministic animation fixtures

Required routes/stories/fixture IDs:
- `idle`;
- `spin-start`;
- `zero-win`;
- `small-win`;
- `medium-win`;
- `big-win`;
- `line-win-3`;
- `line-win-5`;
- `simultaneous-lines`;
- `wild-substitution`;
- `expanding-target`;
- `feature-tease`;
- `feature-trigger`;
- `bonus-enter`;
- `bonus-win`;
- `max-win`;
- `intro-full`;
- `intro-skip`;
- `replay-big-win`;
- `restore-mid-feature`;
- `animation-asset-failure`.

Each is testable on desktop, portrait mobile and Popout where applicable.

## 17. Visual acceptance checklist

Animation Director cannot sign off until:
- transitions have no visible snapping unless deliberately authored;
- character gaze/action supports board focus;
- win highlights identify actual winning positions;
- no effect hides the final payout or required UI;
- no loop survives into the wrong mode;
- turbo remains readable;
- restore/replay do not replay inappropriate boot/live overlays;
- mobile composition remains intentional;
- max-win path always exits cleanly;
- missing animation assets do not deadlock;
- heavy fixtures meet the agreed device/performance floor.
