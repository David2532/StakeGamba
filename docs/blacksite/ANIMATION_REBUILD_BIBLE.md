# BLACKSITE // BREACH Animation Rebuild Bible

Status: historical baseline plus current render note, updated 2026-08-15. Math and event authority remain unchanged.

## 1. Source authority and measured baseline

This contract is derived from the files currently present in the repository. It does not promote any preview asset to production.

| Area | Repository evidence | Measured/current fact |
| --- | --- | --- |
| Active Vault render | `apps/blacksite/src/lib/components/VaultCinematic.svelte` and `apps/blacksite/src/lib/assets/blacksite-assets.js` | One muted finite `<video>` loads the V23 1080p film; reduced motion and media errors use the matching static poster. Desktop uses `cover`; portrait, compact, short and ultrawide layouts use `contain`. |
| Active Vault asset | `apps/blacksite/static/assets/blacksite/v23/cinematic/vault-opening-blackout-v1.webm` | 1920 x 1080, 247 physical frames, 60 fps, 4,116.667 ms, finite two-pass VP8. The former seven-frame V19 WebP is retired from static delivery. |
| Vault source stills | `apps/blacksite/art/generated/v19/cinematic/sequence/vault-anchor-01-sealed.png` through `vault-anchor-04-portal.png` | Seven independent 1536 x 1024 full-frame anchors, not object layers or a motion scene. |
| Reusable Vault sources | `apps/blacksite/art/generated/v19/sources/master-vault-source.png`, `working/master-vault-alpha.png`, `sources/vault-access-desktop-source.png`, `sources/blackout-interior-desktop-source.png` | A 1254-square Vault master/alpha and two 1672 x 941 environment plates exist. They are look and reconstruction sources, not a rig. |
| Vault semantic clock | `apps/blacksite/src/lib/runtime/vault-cinematic-director.js` | `trigger-lock` 520 ms, wheel 1,100, locks 680, door 1,100, light 720, award 1,500, bonus 520; hard maximum 7,000 ms. |
| Operator package | `apps/blacksite/static/assets/blacksite/runtime-rgba-v1/animation_manifest.json` | Seven 1280 x 1024 full-frame RGBA-WebP sequences at 8-14 fps with one fixed root anchor `(310, 1000)`. Package status is review-pending, not production-approved. |
| Operator display | `apps/blacksite/src/routes/+page.svelte` | Desktop frame shell reaches 1000 x 800 CSS px, is 5:4 and normally uses `contain`; one exact-shell variant stretches to its box. Operator is hidden in current compact and short-landscape layouts. |
| Production source search | Vault and character source trees | No `.blend`, `.gltf/.glb`, `.fbx`, `.obj`, Spine project/export, atlas, PSD/PSB or compositing project exists for these sequences. |

### Root-cause table

| Symptom | Root cause | Evidence | Required correction |
| --- | --- | --- | --- |
| Vault looks like a slideshow | Seven long-held stills stand in for continuous motion. | 7 frames over 3.984 s; longest hold 830 ms. | Animate stable, separated objects on one continuous timeline; target compositor interpolation at display refresh, not more AI keyframes. |
| Vault jitters and changes shape | Each full scene was generated independently, so geometry, texture, tunnel, perspective and light are re-synthesized at every cut. | Adjacent frames change by more than RGB 3 across 52-93% of pixels and by more than RGB 16 across 15.7-54.5%. | One camera, one door, one wheel, one hinge and fixed pivots for the complete shot. |
| Vault is soft full-screen | The 1536 x 1024 source is enlarged to about 1934 x 1290 even at DPR 1; at DPR 2 the required sample grid is 3868 x 2580. | Desktop `cover` plus the observed 1934 x 1290 viewport. Current lossy encode adds about 6.43-6.68 RGB mean absolute error per frame. | Native high-DPI masters and responsive derivatives; never upscale the seven-frame WebP. |
| Picture and cue boundaries drift | The animated WebP advances on its own cut clock while the director independently advances semantic states. | Asset cuts occur at 0.830/1.577/1.992/2.407/2.905/3.403/3.984 s, unlike the director boundaries 0.520/1.620/2.300/3.400/4.120 s. | One deterministic timeline owns visuals, cue markers, skip, turbo and reduced-motion completion. |
| Operator motion feels stepped | Low-rate full-frame swaps have no bone interpolation and re-decode large canvases. | Current sequences are 8, 10, 12 or 14 fps on 1280 x 1024 frames. | A real rig or a consistent high-rate rendered sequence is required; do not synthesize in-between full scenes. |
| Operator identity is not stable at source level | Two incompatible character directions coexist. | Runtime package shows the current male operative; `operative-spine-anchor-concept-v1.png` defines an adult woman and is explicitly only a future Spine anchor. | Creative must approve one identity before any production character rebuild. Never blend the two. |

## 2. Character Bible

### 2.1 Identity status

There is **no production-approved canonical character yet**. Until Creative closes Gate 2, the only permitted rebuild reference is the currently integrated male runtime package for composition and behaviour. The female concept at `apps/blacksite/art/concepts/m3/operative-spine-anchor-concept-v1.png` remains a separate, unapproved future direction. It must not be used to alter individual frames of the male package.

Provisional current-runtime invariants:

- Adult male tactical operative; short dark hair, grounded athletic build and a consistent mature face.
- Matte black/charcoal long-sleeve tactical uniform and vest, utility belt, cargo trousers, gloves and combat boots.
- No logos, readable text, weapon, duplicate body parts or outfit changes between states.
- Front-facing, eye-level full-body base pose. Feet stay on one floor line and the root stays at manifest anchor `(310, 1000)` on the 1280 x 1024 design canvas.
- Cool cyan camera-left rim light, restrained red camera-right rim light, neutral dark bunker key. Rim colours may intensify for outcomes but may not migrate across the body.
- Face landmarks, hairline, shoulder width, limb length, belt height, boot shape and costume seams are locked across all states.
- Hands and props may overlap the reel-side space only in authored `rage` or `bonus` actions; the root and camera never jump.

The final identity approval must name one source image, one neutral turnaround, one expression sheet and one colour script. Those four items become immutable regeneration references.

### 2.2 State storyboard and event contract

Presentation may react only to confirmed game events. It never predicts an outcome. Durations below are target action windows; `idle` and `spin` are held by state, not by a fixed timeout.

| Product state | Real trigger / guard | Target performance | Target timing | Current source reference | Exit |
| --- | --- | --- | --- | --- | --- |
| `idle` | Initial/settled state after recovery | Asymmetric breathing, one blink, tiny eye shift to reels; hips and feet locked. | 4-7 s non-obvious loop | `CHAR_IDLE_WATCH`, currently 12 frames/8 fps/1500 ms | `round_started` or feature cue |
| `anticipation` | Confirmed `board_snapshot` creates Vault anticipation, or `feature_armed` | Torso leans 2-3%, eyes lock on final reel/Vault, wrist hand tenses; no celebratory read. | 300-600 ms attack, then hold | No dedicated production sequence; current UI uses reaction states and idle imagery | Resolution cue, cancel, or `feature_started` |
| `spin` | `round_started`; held while reel motion is active | Alert watch pose, breathing compressed, eyes track reel stops; one clean hold loop. | Reel-owned duration | No dedicated production sequence | `board_snapshot`/`expansion` |
| `loss` | Confirmed zero-win `settled`, isolated loss | Short exhale, shoulders drop, restrained facepalm; never comic on first loss. | 1.2-1.8 s | `CHAR_LOSS_SINGLE`, 16/10 fps/1600 ms | `recover` |
| `loss_streak` | Confirmed third-fifth consecutive zero-win | Facepalm grows into two-hand frustration; root stays planted. | 1.5-2.2 s | `CHAR_LOSS_STREAK`, 20/12 fps/1660 ms | `recover` |
| `rage` | Confirmed sixth-or-later zero-win **and** explicit rage presentation enabled | Wind-up, one terminal impact, recoil, settle. Impact prop and sparks are separate layers; no repeated flashing. | 1.7-2.8 s | `CHAR_RAGE_PC_SMASH`, 24/14 fps/1704 ms plus `FX_SCREEN_IMPACT` | `recover` |
| `win_small` | Confirmed `win` below configured big-win threshold | Compact fist pump and direct player acknowledgement; feet/root locked. | 1.2-1.8 s | `CHAR_WIN_HAPPY`, 18/12 fps/1494 ms plus `FX_WIN_FLASH` | `recover` or next feature cue |
| `win_big` | Confirmed `win` above threshold or `cap_reached` | Two-stage celebration: intake/read, then both-arm release; coins remain a separate FX layer. | 2.2-3.6 s | `CHAR_BIG_WIN`, 20/12 fps/1660 ms plus `FX_COIN_BURST` | `recover`; cap cue may be deferred behind bonus |
| `bonus` | Confirmed `feature_started` | Presents/tosses the bonus object toward the Vault, then clears the composition for the cinematic. | 1.6-2.4 s | `CHAR_BONUS_TOSS`, 20/12 fps/1660 ms plus crate FX | Vault owns focus; feature cycles use bonus-idle |
| `recover` | Completion/cancel of any one-shot, or `feature_ended` | 200-500 ms pose match into neutral; no cross-fade between mismatched roots. | 200-500 ms | Final keypose/idle | `idle` or immediately queued higher-priority state |

Priority remains: `rage` > `bonus` > `win_big` > `win_small` > `loss_streak` > `loss` > `idle`. Restore/replay suppression rules in the current event adapter remain authoritative.

### 2.3 Character resolution and export target

- Authoring canvas: fixed 5:4 with the same root convention as the manifest.
- Production desktop master: **2560 x 2048 RGBA** or a rig rendered at equivalent native detail. This exceeds the current maximum 1000 x 800 CSS display at DPR 2 without upscale.
- Current 1280 x 1024 frames are acceptable only as behavioural previews at DPR 1, not as DPR-2 production masters.
- Runtime derivatives: 1280 x 1024 for DPR-1 desktop and 2560 x 2048 for DPR-2 desktop, selected responsively; no full master preload for every state.
- Current compact/mobile layout hides the operator. A future mobile bust is a separate composition and requires its own approved crop and budget; desktop frames must not simply be squeezed into portrait.
- Alpha edges must be inspected on black, middle gray and cyan/red bunker plates. No green/pink fringe, baked background, double edge or changing transparent canvas is accepted.
- The exact-shell `fill` variant must be removed or given an aspect-matched source during implementation; production character pixels may not be non-uniformly stretched.

## 3. Vault opening shot list

The timing preserves the existing director boundaries so game/event semantics do not change. The award copy and number stay native DOM; no UI text is baked into cinematic pixels.

| Time | Director state | Camera | Object action and fixed easing | Light | Existing SFX cue |
| --- | --- | --- | --- | --- | --- |
| 0.000-0.180 | `trigger-lock` | Locked 1536 x 1024 design camera; zero shake | Sealed door, wheel and six bolts fully still. Only a sub-pixel ambient machinery drift is permitted. | Low cyan edge, dim red lock strip, gold ring readable. | `vault-notice` begins |
| 0.180-0.520 | `trigger-lock` | Locked | Six latch indicators preload in three opposed pairs, 45 ms stagger, 2-3 px compression then settle; `cubic-bezier(.45,0,.55,1)`. This is tension, not full retraction. | Red strip rises to 135% then returns to 100%; no full-screen flash. | `vault-notice` mechanical warning bed |
| 0.520-1.620 | `wheel-turn` | Locked; no zoom | Inner wheel rotates one authored direction about one immutable centre, 0 -> 148 degrees with 3-degree mechanical overshoot; `cubic-bezier(.45,.05,.20,1.00)`, 80 ms settle. Door/ring do not morph. | Moving specular pass follows wheel angle; surrounding plate remains stable. | `vault-wheel-turn` |
| 1.620-2.300 | `locks-release` | Locked | Three opposed bolt pairs retract into fixed sockets at 0/130/260 ms; 110-140 ms travel each, `cubic-bezier(.55,0,1,.45)`, hard-stop rebound 2 px. | Brief amber socket glints; red lock strip extinguishes after final pair. | `vault-locks-release` and its existing three-hit cadence |
| 2.300-3.100 | `door-opening` | Camera remains locked through the first 60% of door travel | Door leaf rotates from its physical camera-left hinge; planar layer uses fixed perspective/origin, separate edge/thickness and contact-shadow layers. 0 -> 68 degrees, `cubic-bezier(.22,.61,.36,1)`. No scale substitute. | Warm edge light reveals door thickness; interior stays nearly black. | `vault-door-open` |
| 3.100-3.400 | `door-opening` | Controlled 0 -> 3.5% dolly into the aperture; tunnel layers move by fixed depth coefficients 0.15/0.35/0.65, `cubic-bezier(.22,.61,.36,1)` | Door completes 68 -> 78 degrees and holds; foreground ring occludes it correctly. | Cyan interior practicals appear in depth, never on the foreground plate. | Tail of `vault-door-open` |
| 3.400-4.120 | `light-entry` | Dolly completes at 5%; no shake | Portal core expands behind the aperture mask; restrained particles travel toward camera on fixed paths. | Cyan-white core ramps 0 -> 100%, gold spill on ring and red residuals; peak white is limited to 80 ms before settling to 82%. | `vault-light-entry` |
| 4.120-5.620 | `free-spins-awarded` | Camera stops; cinematic layers hold | Portal becomes the visual bridge while the native award card enters. Cinematic art contains no number, label or target copy. | Portal drops to 65% so DOM copy wins contrast. | `free-spins-awarded` |
| 5.620-6.140 | `bonus-entry` | No new camera motion | Award confirms, then deterministic cut/cross-fade to BLACKOUT interior. | Match cyan/gold portal luminance into the BLACKOUT plate. | `bonus-ready` |

Reduced motion jumps from sealed Vault to the final open/light keypose with a 150 ms opacity bridge, still fires the confirmed award cue and preserves the same DOM award. Turbo may compress authored intervals, but may not reorder wheel, locks, door, light or award markers.

## 4. Pipeline decision: controlled 2.5D Vault

**Decision ANIM-VLT-01:** rebuild the Vault as one deterministic, layered 2.5D composition driven by the existing Svelte presentation director and browser compositor. Do not create another animated WebP from generated full-frame stills.

Required layers, all registered to one 1536 x 1024 logical camera:

1. opaque access-corridor/background plate;
2. tunnel far/mid/near depth plates;
3. outer aperture and foreground occluder;
4. door leaf, edge/thickness, hinge/arm and contact shadow;
5. inner wheel and wheel highlight mask;
6. six individually addressable bolts/sockets;
7. red security strip and practical-light masks;
8. portal core, spill, aperture mask and restrained particle layer;
9. ambient-occlusion and grade overlays.

Implementation contract for the later runtime phase:

- Reconstruct layers from the retained master/alpha and environment plates; use the seven anchors only as look/storyboard references.
- Store every object pivot, source rectangle, depth coefficient and z-order in one manifest. Tight-bound transparent objects are preferred over full-frame RGBA layers.
- One monotonic timeline owns visual progress and emits the existing semantic cue boundaries. It must support seek, cancel, skip, turbo and reduced motion without parallel `setTimeout` drift.
- Animate compositor-safe transforms and opacity. Expensive blur, dynamic full-screen filters and per-frame layout are prohibited.
- Preload the sealed plate and first moving layers before `feature_started`; decode later portal/award layers during the wheel/lock window. Dispose non-reused large layers after entry.
- If measured browser composition fails the frame/memory gate, pre-render this **same controlled 2.5D scene** to a true 30 fps video master with WebM and MP4 fallbacks. A video made from unrelated generated stills is not an acceptable fallback.

### Resolution/DPR contract

| Target | Required source/export | Rationale |
| --- | --- | --- |
| Vault logical camera | 1536 x 1024, 3:2 | Matches current anchors and the observed 1934 x 1290 viewport composition. |
| Vault large master | **4096 x 2732**, 3:2-safe | Covers 1934 x 1290 at DPR 2 (3868 x 2580 required) and 1920 x 1080 `cover` at DPR 2 without upscale. |
| Vault DPR-1 derivative | **2048 x 1366** | Covers the current 1934 x 1290 display at DPR 1 with a small reserve. |
| Vault compact derivative | **1536 x 1024** maximum plate, tight-bound moving layers | Current mobile/short layout uses `contain`; avoids decoding the 4096 master where the displayed image is materially smaller. |
| Character desktop | 1280 x 1024 DPR-1; **2560 x 2048 DPR-2** | Current maximum CSS box is 1000 x 800. |

At 1920 x 1080, a 3:2 `cover` composition crops about 200 logical source pixels vertically. All door mechanics, hinge, wheel, bolts and portal aperture must remain inside the resulting 16:9 safe area. At 1934 x 1290 the 3:2 frame is effectively uncropped. Responsive QA must test both, not only the source aspect.

### Why full 3D and Spine are not currently production-feasible

- Vault 3D is unavailable because there is no model, topology, UV set, material set, rig, DCC scene or authored camera in the repository. The blacksite app also has no Three.js runtime dependency. Building those is a new asset-production track, not a safe conversion of the current PNG/WebP files.
- Character Spine is the preferred long-term path documented by M3, but no Spine project, skeleton, mesh, atlas or separated body-part artwork has been delivered. The current package is flattened full-frame imagery, so it cannot be honestly converted into a production Spine rig without rebuilding the character.
- Repository-wide Spine capability does not satisfy the delivery gate. A version-compatible exported rig, source project, atlas, fallback pose, bounds/pivots, licensing and human likeness/anatomy/originality approval are all still required.

## 5. Stop-gate status

| Gate | Status | Exit evidence required |
| --- | --- | --- |
| Phase 0 inventory | **PASS** | Active components, files, dimensions, timings, display geometry and absent source formats were inspected. |
| Gate 1: root cause understood | **PASS** | Seven-frame cadence, independent-frame drift, semantic-clock mismatch and DPR deficit are measured above. |
| Gate 2: consistent approved sources | **BLOCKED** | Creative approves one operator identity; Vault delivers the enumerated separated layers from one locked camera with provenance. |
| Gate 3: real motion | **BLOCKED** | Review capture proves continuous wheel/bolt/hinge/parallax motion from stable objects; no full-frame morphing. |
| Gate 4: resolution/export | **BLOCKED** | Native 4096 x 2732 Vault and 2560 x 2048 character masters/derivatives pass alpha, crop, decode-memory and DPR checks. |
| Gate 5: real event correctness | **OPEN** | Later integration demonstrates `feature_armed` -> `feature_started` -> award/bonus against real adapter events, including restore, skip, turbo and reduced motion. |
| Gate 6: final visual proof | **BLOCKED** | Side-by-side desktop 1934 x 1290, 1920 x 1080, compact portrait and short-landscape captures plus a smooth-motion recording are approved. |

**Overall stop decision:** Phase 1/2 documentation is complete. Production animation work must not claim completion or replace the current runtime until Gate 2 closes. The next authorized production action is source approval and layer delivery, not another encode of the existing seven frames.
