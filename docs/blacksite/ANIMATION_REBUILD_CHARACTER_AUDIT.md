# BLACKSITE // BREACH — Phase 0 Character Animation Audit

**Audit date:** 2026-08-12

**Audit scope:** operator renderer, operator/FX raster delivery, CSS sizing and DPR behavior, presentation event wiring, reaction state machine, replay/restore behavior, and production-source feasibility

**Audited branch:** `codex/blacksite-v19-vault-implementation`

**Verdict:** `BLOCKED`

This is an evidence document only. It does not approve the current raster delivery as production character animation and it does not change game math, RGS authority, production code, or runtime assets.

## Executive finding

The current operator is not a rigged actor. It is a Svelte/DOM player that changes the `src` of two persistent `<img>` buffers between separately compressed, full-canvas alpha WebP files. The implementation prevents an empty frame from being exposed, but it cannot provide production-quality motion from the supplied source:

- the visible character occupies substantially fewer pixels than the declared 1280 × 1024 frame;
- desktop CSS stretches the source non-uniformly and has no DPR-aware source tier;
- only the first idle image is preloaded;
- surface-managed decoding disables the director's decode-ahead cache;
- the rAF clock continues while the mounted hidden image decodes, so late targets are replaced by newer targets and intermediate frames are skipped;
- several sequences contain decoded duplicate frames and whole-frame semi-transparent interpolation frames;
- the catalog has no real `loading`, `anticipation`, `spin`, or `recover` animation;
- the fixed anchor declared by the catalog is not applied by the DOM character surface;
- no BLACKSITE Spine skeleton, atlas, layered master, turnaround, or equivalent identity-stable rig source exists in the repository or the three supplied BLACKSITE ZIP archives inspected in this audit.

The root causes of blur, slideshow cadence, root jitter, and identity drift are therefore known. Stop Gates 2 and 3 remain failed: there is no approved consistent source and no real-motion source. A visible replacement must not be fabricated from another set of independently generated full-frame stills.

## Evidence scope and method

The audit inspected the following current sources directly:

- `apps/blacksite/src/lib/assets/operator-animation-assets.js`
- `apps/blacksite/src/lib/runtime/operator-animation-director.js`
- `apps/blacksite/src/lib/runtime/standalone-fx-director.js`
- `apps/blacksite/src/lib/runtime/live-outcome-streak.js`
- `apps/blacksite/src/lib/runtime/presentation-director.js`
- `apps/blacksite/src/routes/+page.svelte`
- `apps/blacksite/static/assets/blacksite/runtime-rgba-v1/animation_manifest.json`
- `apps/blacksite/static/assets/blacksite/runtime-rgba-v1/**`
- `apps/blacksite/art/concepts/m3/PROVENANCE.md`
- `docs/blacksite/M3_ASSET_MANIFEST.md`
- `apps/blacksite/package.json`
- `packages/pixi-svelte/package.json`

Raster measurements were made by decoding every operator WebP to RGBA with Pillow, then recording:

1. intrinsic dimensions and compressed file sizes;
2. the union of every non-zero-alpha bounding box in a sequence;
3. decoded-pixel SHA-256 identities, not compressed-file identities, to detect held duplicate frames;
4. alpha extrema to find frames whose entire non-transparent subject is below alpha 255;
5. horizontal bounding-box-center spread and bottom-edge spread.

All frame indices below are zero-based. “Faded frames” means the maximum alpha anywhere in that decoded frame is below 255. It does not refer merely to antialiased boundary pixels.

## Current asset inventory

### Deployable runtime package

| Group | WebP files | Compressed bytes | Notes |
|---|---:|---:|---|
| Operator runtime sequences | 130 | 13,756,384 | Seven full-frame character sequences |
| Standalone FX sequences | 78 | 2,383,822 | Five FX sequences |
| Static keyposes | 7 | 709,384 | Six character/key poses plus one crate pose |
| JSON manifest | 1 | 23,740 | Difference between image totals and package total |
| **Complete `runtime-rgba-v1` delivery** | **216 files** | **16,873,330** | 215 alpha WebPs plus one JSON manifest |

The authoring provenance records 215 declared alpha PNG inputs converted to WebP. The runtime conversion used WebP quality 90 for `runtime-rgba-v1`, method 6, alpha quality 100, and byte-identical alpha validation. This rules out changed alpha during PNG-to-WebP conversion as the primary cause of the current ghost frames; those alpha states are present in the delivered animation imagery.

### Operator sequence catalog

Every operator frame has an intrinsic canvas of 1280 × 1024 and the catalog declares the same anchor, `(310, 1000)`, for every sequence.

| Runtime state | Manifest ID | Frames | FPS | Nominal duration | Loop | Compressed bytes | File-byte range |
|---|---|---:|---:|---:|---|---:|---:|
| `idle` | `CHAR_IDLE_WATCH` | 12 | 8 | 1.500 s/cycle | yes | 1,103,356 | 86,556–93,648 |
| `loss` | `CHAR_LOSS_SINGLE` | 16 | 10 | 1.600 s | no | 1,323,992 | 55,244–93,326 |
| `lossStreak` | `CHAR_LOSS_STREAK` | 20 | 12 | 1.667 s | no | 1,612,834 | 50,326–87,868 |
| `win` | `CHAR_WIN_HAPPY` | 18 | 12 | 1.500 s | no | 1,754,108 | 60,634–115,640 |
| `bigWin` | `CHAR_BIG_WIN` | 20 | 12 | 1.667 s | no | 2,492,468 | 72,706–144,058 |
| `bonus` | `CHAR_BONUS_TOSS` | 20 | 12 | 1.667 s | no | 1,968,018 | 52,014–127,348 |
| `rage` | `CHAR_RAGE_PC_SMASH` | 24 | 14 | 1.714 s | no | 3,501,608 | 82,642–206,708 |
| **Total** |  | **130** |  |  |  | **13,756,384** |  |

Nominal duration is `frame count / manifest FPS`. The current director returns a one-shot to idle from elapsed wall-clock frame arithmetic, not from an animation-authored completion event.

### Measured alpha geometry and temporal artifacts

| Manifest ID | Union alpha bbox `(l,t,r,b)` | Usable subject extent | Decoded unique / total | Duplicate decoded indices | Whole-frame faded indices | Center spread | Bottom spread |
|---|---|---:|---:|---|---|---:|---:|
| `CHAR_IDLE_WATCH` | `(128,67,492,1003)` | 364 × 936 | 12 / 12 | — | — | 4.0 px | 4 px |
| `CHAR_LOSS_SINGLE` | `(127,72,493,1011)` | 366 × 939 | 12 / 16 | 4, 13, 14, 15 | 5, 6 | 7.0 px | 11 px |
| `CHAR_LOSS_STREAK` | `(83,63,548,1008)` | 465 × 945 | 18 / 20 | 5, 10 | 6, 7, 8 | 7.5 px | 14 px |
| `CHAR_WIN_HAPPY` | `(38,63,587,1012)` | 549 × 949 | 15 / 18 | 4, 8, 13 | 5, 6 | 18.5 px | 23 px |
| `CHAR_BIG_WIN` | `(32,0,1179,1011)` | 1147 × 1011 | 20 / 20 | — | — | 200.0 px | 26 px |
| `CHAR_BONUS_TOSS` | `(81,0,1118,1009)` | 1037 × 1009 | 20 / 20 | — | 1, 2, 3 | 293.5 px | 13 px |
| `CHAR_RAGE_PC_SMASH` | `(67,36,1094,1007)` | 1027 × 971 | 23 / 24 | 6 | 7, 8, 9, 10 | 287.5 px | 22 px |

The large center spreads in prop-heavy actions include intentional action to the right of the actor, so they are not by themselves proof of body drift. The bottom-edge spread is the relevant root/foot warning. Because the runtime surface does not use the catalog anchor, even modest bottom movement is rendered as a visible root shift. The duplicate and faded indices explain held cadence and ghosted interpolation independently of network performance.

### Standalone FX and static keyposes

| FX ID | Frames | FPS | Dimensions | Compressed bytes | File-byte range |
|---|---:|---:|---:|---:|---:|
| `BONUS_CRATE_PULSE` | 16 | 12 | 512 × 512 | 599,308 | 32,766–42,118 |
| `BONUS_CRATE_SPIN` | 20 | 15 | 512 × 512 | 754,798 | 32,734–42,814 |
| `FX_COIN_BURST` | 20 | 12 | 1280 × 1024 | 397,588 | 2,488–28,734 |
| `FX_SCREEN_IMPACT` | 12 | 15 | 1280 × 1024 | 480,494 | 10,736–59,328 |
| `FX_WIN_FLASH` | 10 | 15 | 1280 × 1024 | 151,634 | 6,556–20,620 |

The seven static keyposes comprise one 512 × 512 crate and six 1280 × 1024 character poses. They total 709,384 compressed bytes. The operator director does not use those keyposes as an approved character fallback; they are normalized by the standalone-FX director for reduced-motion FX selection.

## Renderer and decode pipeline

### Actual renderer

The operator is rendered by normal DOM images, not Canvas, PixiJS, Phaser, WebGL, Three.js, Spine, or video:

1. `+page.svelte` mounts exactly two operator `<img>` elements in one persistent shell.
2. Only one buffer is visible; the other receives the next `src`.
3. `decodeMountedFrame()` awaits `HTMLImageElement.decode()` or a load event.
4. After decode and generation/source checks, the hidden buffer becomes visible with a hard opacity/visibility swap.
5. The elements are not keyed by sequence or frame and do not remount per reaction. Svelte remounting is therefore not the primary stutter cause.

The active CSS explicitly removes transforms, transitions, and animations from `.operative-frame`. There is no CSS crossfade between buffers. Ghosting originates in the supplied faded frames, not a runtime opacity tween.

### Decode behavior that drops frames

The page creates `OperatorAnimationDirector` with `surfaceManagedDecoding: true`.

That option changes the director contract materially:

- `trigger()` does not decode the first frame before activating the sequence;
- `preload()` returns `{ loaded: 0, failed: 0 }`;
- the director's `decodeAhead` window is disabled;
- only `CHAR_IDLE_WATCH_000` is declared as a head preload;
- the general visual preload list includes the machine, symbols, reel strips, modes, and scenes, but no operator reaction sequence.

The mounted surface owns every reaction decode. While it is awaiting one hidden image, `operatorPendingFrame` is a single slot. A newer rAF emission overwrites an older pending target. In parallel, the director advances by:

```text
steps = floor((now - lastFrameAt) / frameDuration)
nextIndex = currentIndex + steps
```

Consequences:

- a late decode does not slow the animation clock;
- more than one source frame can be skipped after a long task or decode;
- event-to-first-visible-reaction latency is not bounded by the trigger promise;
- low native FPS, source holds, and runtime skips combine into the perceived “two-frame” slideshow;
- the implementation favors settlement independence over animation continuity, which is correct for authority but insufficient as a presentation renderer.

Frame decode failures are also vulnerable to becoming stale: `reportFrameError(source)` accepts only the director's current `state.frameSrc`. If rAF has already advanced beyond the hidden buffer source that failed, the failure can be ignored.

### Decode memory floor

A decoded 1280 × 1024 RGBA frame requires:

```text
1280 × 1024 × 4 = 5,242,880 bytes = 5 MiB
```

The two mounted operator buffers therefore impose a 10 MiB decoded-RGBA floor before browser image-cache copies, FX surfaces, layer promotion, or GPU duplication. This is not a complete measured memory peak; it is the deterministic minimum for two decoded full-size operator images.

## CSS sizing, stretch, and DPR evidence

### Desktop layout

For the desktop machine composition:

- `.scene-world` has aspect ratio `1672 / 941`;
- `.operative-stage` is 51.914% of scene width and 72.264% of scene height;
- both operator and standalone-FX images are overridden to `object-fit: fill`;
- no `srcset`, resolution tier, canvas backing resolution, or `devicePixelRatio` logic exists for the operator.

At the 1672 × 941 design size, the stage is approximately 868.002 × 680.004 CSS pixels. Its aspect is 1.27647, while the source aspect is 1.25. `object-fit: fill` therefore introduces a horizontal non-uniform stretch factor of:

```text
(868.002 / 680.004) / (1280 / 1024) = 1.02117
```

That is approximately 2.12% horizontal stretch before any DPI scaling.

### Representative 1934 × 1290 viewport

With a 1934 CSS-pixel-wide viewport and sufficient height, the 1672:941 scene is width-limited:

```text
scene                = 1934.000 × 1088.453 CSS px
operator stage       = 1004.017 × 786.560 CSS px
idle subject fraction = 364/1280 × 936/1024
visible idle subject = 285.517 × 718.965 CSS px
```

At DPR 1.5, the visible idle body needs approximately 428.276 × 1078.447 device pixels. Compared with the source body's 364 × 936 pixels, this is a 1.1766× horizontal and 1.1522× vertical upscale.

At DPR 2, it needs approximately 571.035 × 1437.930 device pixels. Compared with the source body, this is a 1.5688× horizontal and 1.5363× vertical upscale.

The nominal 1280 × 1024 canvas size hides this shortage because most idle-canvas pixels are transparent. Usable subject texel density, not full-canvas dimensions, determines the visible quality.

### Responsive behavior

At viewport width 1040 px or below, or aspect ratio 4:3 or narrower, CSS sets `.operative-stage { display: none; }`. The same media contract suspends the operator and returns it to idle. Portrait, Popout-style, and mobile compositions therefore have no functional operator reaction at all; this is not a lower-resolution fallback.

## Current character state machine

### Catalog and priority

The director exposes these raster states only:

```text
idle, loss, lossStreak, win, bigWin, bonus, rage
```

Current numeric priority is:

```text
rage 6 > bonus 5 > bigWin 4 > win 3 > lossStreak 2 > loss 1 > idle 0
```

A lower-priority request cannot interrupt a non-idle sequence. An equal- or higher-priority request can hard-restart/interrupt it. The current order does not implement the required presentation order:

```text
bonus / winBig > winSmall / loss > spin > anticipation > idle
```

### Missing semantic states

| Required state | Current implementation | Gap |
|---|---|---|
| `loading` | No operator animation | No deterministic first-paint/asset-ready state |
| `idle` | `CHAR_IDLE_WATCH` | Present, but only 8 FPS and low usable horizontal texel density |
| `anticipation` | UI reaction string and audio only | Raster actor remains idle |
| `spin` | UI reaction strings `spin-start`/`spin-loop` only | Raster actor remains idle |
| `loss` | `CHAR_LOSS_SINGLE` | Present; returns directly to idle by frame arithmetic |
| `winSmall` | `CHAR_WIN_HAPPY` | Present as `win`; repeat win cues may hard-restart it |
| `winBig` | `CHAR_BIG_WIN` | Present; round-wide dedupe exists |
| `bonus` | `CHAR_BONUS_TOSS` | Present; cinematic handoff is awaited |
| `recover` | UI reaction string only | No authored recovery animation or mix |
| `reducedMotion` | Director capability exists | Page forces full motion with `reducedMotion: false` |
| `fallback` | Decode failure falls back to idle | No approved identity-stable fallback character delivery |

Non-looping reactions return directly to the first idle frame after elapsed `frames / FPS`. There is no animation-authored completion event, no recovery clip, no cross-state mix, and no root-aligned handoff pose.

## Authoritative event-to-character mapping

Presentation remains cosmetic. Nothing in the current operator code decides RNG, RTP, a result, payout, balance, settlement, or feature inventory.

| Authoritative/presentation event | Current visible behavior | Authority/dedupe behavior | Character gap |
|---|---|---|---|
| Player activates primary action | Plays `spin-start` audio and starts decorative reel motion before the request completes | Does not settle or manufacture a result | No operator raster state |
| `round_started` | Cancels deferred reactions, cancels Vault cinematic, returns actor to idle, sets UI reaction `spin-start` | Presentation cue | Required `anticipation → spin` actor transition is absent |
| `board_snapshot` | Settles reels; with two confirmed Vault reels before the last reel, sets UI anticipation and awaits bounded reel presentation | Board is authoritative; restore disables anticipation | Actor remains idle; no anticipation pose/loop |
| `expansion` | Settles feature reels and sets `bonus-idle`/`spin-loop` label | Authoritative evaluated board | No feature-spin actor state |
| `win` | Uses `step_payout_raw / mode cost`; at `>= 1000` centiX per cost selects `bigWin`, otherwise `win`; starts win FX/audio | Big win dedupes round-wide; small win dedupes by event index | Multiple small-win events can equal-priority hard-restart a 1.5 s clip every 480 ms normal or 160 ms turbo |
| `feature_armed` | Sets feature-tease UI, arms Vault cinematic, plays crate-pulse FX | Suppressed on restore | No actor anticipation animation |
| `feature_started` | Triggers `bonus`, starts crate-spin FX, and awaits Vault cinematic before later feature cues | Uses authoritative target and free-spin total; suppressed on restore | Bonus clip itself is fire-and-forget and not the awaited completion boundary |
| `feature_cycle` | Starts reel motion and sets `bonus-idle` label | Authoritative cycle count | No actor spin/hold state |
| `cap_reached` | Triggers or defers `bigWin` until bonus returns idle, with a bounded 4 s wait | Round-wide dedupe; cosmetic only | Timeout is presentation timing, not authored transition |
| `feature_ended` | Stops reel motion and sets UI `recover`; may show extraction | Authoritative cumulative payout | No raster recover animation |
| `settled`, fixture/replay, zero payout | Triggers simple `loss` and loss audio | Runs only on a settled zero payout | Correct authority; no recovery clip |
| Live settlement completion | After `liveSession.completePresentation()`, commits round ID and payout to streak tracker; zero streak 1–2=`loss`, 3–5=`lossStreak`, each sixth may be `rage` only when enabled | Duplicate finalized round IDs cannot mutate/retrigger; positive result resets streak | Correct authority; delayed reaction can be cut by autoplay |
| Replay start / Play Again | Returns actor to idle, increments playback generation, replays cached cues | Dedupe keys include playback generation | Correct replay isolation; still uses incomplete raster state model |
| Restore | Consumes already-presented cues without callbacks and suppresses resumed outcome reactions | Prevents duplicate win/bonus/loss and does not commit live loss streak | Separate UI-label and raster states can finish inconsistent, e.g. label `spin-loop` while actor is idle |

## Timer, interruption, and jitter risks

### Proven safe behavior

- The two operator images remain mounted across state changes.
- Director generation checks prevent an old decoded frame from replacing a newer sequence frame.
- Visibility and explicit suspension stop rAF progression without consuming hidden elapsed time.
- Round-ID loss-streak dedupe runs after successful live presentation completion.
- Restore suppresses already-presented outcome reactions.
- Operator and FX failures are designed not to invalidate an authoritative round.

### Remaining conflicts

1. **Autoplay truncation:** autoplay waits at most 620 ms normally or 140 ms in turbo for the operator to become idle. Current reactions last approximately 1.5–1.714 s. A false wait result is not treated as a reason to hold the next spin, so the next `round_started` hard-resets the actor before most reactions complete.
2. **Equal-priority restart:** each small-win cue has an event-index dedupe key, so several valid wins in one round can restart the same `win` sequence before completion.
3. **Split state ownership:** `operatorReaction` controls labels/halo semantics while `OperatorAnimationDirector` controls the image sequence. Either can change without the other, producing semantic disagreement.
4. **Timer-based FX choreography:** win/bonus/rage FX use independent 90, 180, 220, and 620 ms start timers and optional hold timers. These are generation-cancelled, but they are not animation events from a shared actor timeline.
5. **Hard boundaries:** round start, replay start, viewport hide, and runtime error call `returnToIdle()` immediately. Without a common setup pose and recovery animation, each is a visible jump cut.
6. **Reduced motion mismatch:** the operator constructor explicitly forces `reducedMotion: false`, even though the underlying director can honor the host media query.

## Production-source feasibility

### What exists

The monorepo contains a technically suitable renderer stack:

- `pixi.js` 8.8.1
- `@esotericsoftware/spine-pixi-v8` 4.2.74
- reusable Pixi/Svelte Spine components in `packages/pixi-svelte`

The BLACKSITE app does not currently depend on those packages. Its own package declares SvelteKit, Svelte, Vite, and shared utilities only.

### What does not exist

Repository and archive inspection found no BLACKSITE file with a rig/source extension such as:

```text
.skel, .atlas, .spine, .blend, .fbx, .gltf, .glb,
.psd, .kra, .rive, .aep, .ma, .mb
```

The only operative “Spine” item is `operative-spine-anchor-concept-v1.png`, explicitly documented as an identity anchor rather than a turnaround, layered cutout, fallback pose, or Spine skeleton. The three supplied BLACKSITE ZIP archives inspected contain zero rig-like entries. Project provenance also marks the current runtime delivery as generated/review-pending and states that a real Spine 4.2 operative delivery remains required.

### Feasibility decision

The implementation is technically feasible with the existing monorepo runtime, but asset production is blocked. Stop Gate 0 requires `BLOCKED`, not a lower-quality visible replacement, until one of the following consistent-source deliveries is available.

## Required source delivery contract

### Preferred: Spine 4.2 actor delivery

Deliver one identity-stable actor authored from one approved master:

1. **Identity source**
   - approved character turnaround covering front, three-quarter, profile, face, hands, outfit, and gear;
   - one canonical setup pose and one documented floor/root reference;
   - layered lossless authoring source retained outside the deployable runtime;
   - human review for likeness, anatomy, originality, rights, and continuity.
2. **Runtime compatibility**
   - Spine Editor 4.2 export compatible with `spine-pixi-v8` 4.2.74;
   - skeleton JSON or binary, atlas text, and all referenced texture pages;
   - no missing attachments, skins, constraints, or events;
   - explicit premultiplied-alpha/export policy matching runtime texture settings.
3. **Named animations**
   - `loading`
   - `idle`
   - `anticipation`
   - `spin`
   - `loss`
   - `winSmall`
   - `winBig`
   - `bonus`
   - `recover`
   - a static reduced-motion pose/fallback
4. **Transition contract**
   - all reactions begin from, or mix safely from, the same authored setup/root pose;
   - non-looping reactions emit completion and recover events from the animation system;
   - `recover` ends at the exact idle setup pose;
   - no CSS transform or parallel timeline animates the actor root;
   - documented mix durations and interruption rules implement `bonus/winBig > winSmall/loss > spin > anticipation > idle`.
5. **Texture density**
   - texel-density evidence must cover the largest supported character display at clamped DPR 2;
   - at the current maximum desktop composition, the body can approach roughly 1,900 device pixels in height at DPR 2, so the delivered usable body—not merely a transparent page—must provide approximately 2K vertical subject detail;
   - use packed 2K/4K pages or split pages as needed without exceeding supported maximum texture size;
   - retain lossless masters; generate measured runtime texture tiers rather than scaling one low-resolution page.
6. **Responsive composition**
   - provide an approved portrait/mobile actor crop, alternate placement, or static fallback;
   - do not satisfy responsive behavior by silently hiding the character.
7. **Provenance**
   - author/tool/version, source identity, export command/settings, hashes, license/rightsholder, and review state.

### Acceptable fallback: atlas rendered from one real rig

If the live Spine skeleton cannot ship, a deterministic sprite atlas may be accepted only when it is rendered from the same approved rig and camera:

- 24–30 FPS source motion, unless authored timing justifies a different cadence;
- trimmed frames with per-frame pivots, duration metadata, and no transparent full-canvas waste;
- 1×/2× texture tiers or equivalent DPR-safe density;
- no independently generated pose-to-pose images;
- no baked crossfade used to disguise unrelated frames;
- bounded atlas requests and decode/preload behavior measured before first use;
- the same semantic states, priority, completion, replay, restore, and reduced-motion contract as the Spine path.

## Actionable acceptance tests

No implementation is complete until every applicable test below passes against the production build and an authoritative fixture/live/replay flow.

### A. Source and export validation

1. Load the skeleton/atlas or deterministic atlas with zero missing files, attachments, pages, frames, or parse warnings.
2. Verify all required animation names and completion markers programmatically.
3. Verify the canonical root/floor position at start and end of every non-translation reaction; final recovery alignment must be within 1 CSS pixel at the reference desktop viewport.
4. Verify that every atlas frame/piece derives from the same approved character master and rig; no independent full-frame generations are present.
5. Record texture dimensions, page count, compressed download bytes, decoded CPU memory estimate, GPU allocation estimate, alpha mode, and maximum texture dimension.
6. At transparent boundaries, inspect alpha and premultiplied RGB for dark/bright fringes on both light and dark debug backgrounds.

### B. DPR and visual matrix

Capture stills and screen recordings at minimum:

| Viewport | DPR | Required evidence |
|---|---:|---|
| 1366 × 768 | 1 | First load, idle, spin, one reaction |
| 1920 × 1080 | 1 | Idle and all reaction extremes |
| 1920 × 1080 | 1.5 | Face, hands, silhouette edges, root stability |
| 1934 × 1290 | 2 | Direct comparison with the measured failure case |
| 2560 × 1440 | 2 | Maximum desktop texel-density proof |
| Portrait and compact landscape targets | device DPR | Approved crop/fallback; actor must not disappear unintentionally |

For each recording, inspect frame-by-frame for the first empty frame, duplicate trigger, source swap, root jump, identity drift, alpha fringe, non-uniform stretch, or recovery pop.

### C. State-machine tests

1. Assert the complete deterministic graph: `loading → idle → anticipation → spin → outcome → recover → idle`.
2. Assert priority: `bonus/winBig > winSmall/loss > spin > anticipation > idle`.
3. Assert one reaction per authoritative event/round key; repeated UI renders must not retrigger it.
4. Assert that a lower-priority cue cannot interrupt a higher-priority reaction.
5. Assert that equal-priority line-win events coalesce or queue according to one documented rule instead of hard-restarting the actor.
6. Assert that all non-looping reactions return through animation completion events, not guessed duration timers.
7. Assert visibility pause/resume without elapsed-time catch-up or first-frame jump.
8. Assert `prefers-reduced-motion` selects an explicit semantic fallback and still communicates loss, win, big win, and bonus.
9. Assert renderer/component lifetime: one actor root remains mounted across idle, spin, outcome, replay, and restore.
10. Assert new rounds cancel or complete old presentation work without orphan timers, tracks, listeners, textures, or audio callbacks.

### D. Authority tests

1. `loss` can fire only after an authoritative settled payout of zero.
2. Positive settled payout resets live loss streak; duplicate round ID does not mutate it.
3. `winSmall` and `winBig` consume authoritative presentation values only; no character module computes a payout or result.
4. `bonus` can fire only from the authoritative bonus/feature trigger.
5. Replay generation can reproduce reactions once per playback without mutating live streak or wallet state.
6. Restore primes already-presented cues without replaying outcome reactions and resumes with a semantically consistent actor state.
7. Feature cycles and free-spin counts remain owned by RGS/presentation state; the actor cannot advance them.
8. No production test buttons, mock events, RNG, RTP, payout, balance, or settlement authority are added to the character renderer.

### E. Repeatability and latency

1. Reproduce `idle`, `loss`, `winSmall`, `winBig`, and `bonus` ten times each.
2. All ten runs must show the correct first frame, one trigger, one completion, stable identity/root, and deterministic return.
3. Measure input/authoritative-cue-to-first-visible-reaction latency; p95 must be at most 100 ms once required assets are declared ready.
4. Run a multi-win round and verify that small-win presentation does not reset every 160/480 ms.
5. Run autoplay through loss, win, big win, and bonus; verify the next spin follows the explicit interruption policy and never silently truncates a reaction because of the current 140/620 ms fallback waits.

### F. Rendering and performance

1. No 404, decode, canvas, texture, state-machine, WebGL, or unhandled-promise errors.
2. No visible layout shift or transparent/empty actor on first load.
3. Normal desktop presentation sustains at least 55 FPS or an explicitly approved equivalent frame-time target.
4. No new animation-attributable main-thread long task above 50 ms.
5. Measure cold and warm reaction paths separately, including asset requests and decode time.
6. Confirm DPR clamp, `autoDensity`/backing resolution, antialiasing, scale mode, mipmaps, alpha mode, and maximum texture size when Pixi is integrated.
7. Confirm inactive animation work stops when hidden and all GPU/CPU resources are released on teardown.

## Stop-gate status

| Gate | Status | Evidence / next action |
|---|---|---|
| Gate 1 — Root cause | **PASS** | Blur, frame skipping, source holds/fades, ignored anchors, and state/timer conflicts are evidenced above |
| Gate 2 — Consistent source | **FAIL** | No approved layered master, turnaround, or identity-stable rig; deliver the source contract above |
| Gate 3 — Real motion | **FAIL** | Current source is separately rendered full-frame raster imagery; deliver Spine 4.2 or atlas rendered from one real rig |
| Gate 4 — Resolution/export | **FAIL** | Current usable subject density fails DPR 1.5/2 in representative desktop layouts and uses `object-fit: fill` |
| Gate 5 — Event correctness | **PARTIAL** | Live loss/round dedupe/replay/restore authority is sound; spin/anticipation/recover actor semantics and equal-priority win handling are incomplete |
| Gate 6 — Visual proof | **FAIL** | Production rig does not exist; DPR-2 capture, ten-run recordings, and frame inspection cannot yet pass |

## Smallest valid next step

Obtain and approve the character source delivery—not another independently generated animation sheet. The minimum unblocker is either:

1. the Spine 4.2 skeleton/atlas/textures and approved identity master described above; or
2. an approved layered master and turnaround that an animator can rig once, followed by a short proof containing `idle`, `anticipation`, `spin`, `loss`, `recover`, and the DPR-2 export evidence.

Until that source exists, keep the current runtime as an explicitly review-pending preview and do not report the character rebuild as done.
