# BLACKSITE // BREACH Animation Rebuild - Gate 0 Evidence

Audit date: 2026-08-12

Verdict: `BLOCKED`

This document records the measured Phase 0 evidence for the requested one-shot
animation rebuild. It does not approve the current Vault or operator assets as
production motion. It does not change math, RGS, replay, restore, balance,
payout, or presentation-event order.

## Reference recording

The prompt's reference recording was supplied as:

```text
20260812-1641-53.7453357.mp4
```

Measured properties:

- file size: 8,041,839 bytes;
- SHA-256: `9e4b63aee882cc476a42bddacb041763f27224098b6d12966571d298db4e2ce7`;
- decoded display size: 1884 x 1170;
- duration: 7.167979 seconds;
- Chromium RVFC presentation: frames 2 through 209, approximately 29.16 fps.

Thirty-Hz sampling produced 216 comparison samples. Large full-frame changes
were measured at approximately:

| Time | Mean delta | Pixels materially changed |
| ---: | ---: | ---: |
| 0.933 s | 25.42 | 50.8% |
| 1.800 s | 6.55 | 12.5% |
| 2.533 s | 12.67 | 24.0% |
| 2.967 s | 14.65 | 29.5% |
| 3.333 s | 14.03 | 25.8% |
| 3.867 s | 25.71 | 50.3% |
| 4.333 s | 16.41 | 31.3% |
| 5.033 s | 29.16 | 55.3% |

Long visually static holds include 1.033-1.367, 1.433-1.767,
2.033-2.500, 3.367-3.834, 4.367-4.800, 5.133-5.967, and
6.567-6.967 seconds. The longest measured hold spans 26 recorded frames.
The source therefore behaves as a small set of held full-frame poses in a
nominal 30-fps recording. Container frame rate is not the root cause.

## Active Vault runtime

The production-facing component mounts one full-screen image:

```text
apps/blacksite/src/lib/components/VaultCinematic.svelte
apps/blacksite/static/assets/blacksite/v19/cinematic/sequence/vault-opening-cinematic-hd-v2.webp
```

The animated WebP is 1536 x 1024, 978,002 bytes, opaque, finite-looped, and
3,984 ms long. It contains exactly seven physical frames with durations:

```text
830, 747, 415, 415, 498, 498, 581 ms
```

That is 1.76 unique frames per second. Its seven source anchors are independent
1536 x 1024 full-scene renders. Adjacent anchors change across 52-93% of the
image above RGB delta 3; the open-to-portal pair changes 93.17%. This proves
camera, geometry, texture, and lighting re-synthesis between poses rather than
motion from one scene.

The semantic director is a separate `setTimeout` clock. WebP cuts occur near
0.830, 1.577, 1.992, 2.407, 2.905, 3.403, and 3.984 seconds, while semantic
boundaries occur near 0.520, 1.620, 2.300, 3.400, and 4.120 seconds. Visual
frames and game-facing cue states therefore do not share one timeline.

## Browser and DPR evidence

The local development application was inspected at:

```text
http://127.0.0.1:3002/?dev_fixture=base_natural_blackout
```

| Viewport | DPR | Result |
| --- | ---: | --- |
| 1884 x 1170 | 1 | Full-screen Vault uses `cover`; 1536-wide source is scaled about 1.227x and cropped about 43 CSS px at top and bottom. |
| 1884 x 1170 | 2 | Required physical area is 3768 x 2340; the 1536 x 1024 source is short by about 2.45x horizontally and 2.29x vertically. |
| 1280 x 720 | 1 | Source resolution is sufficient, but all seven long holds remain visible. |
| 390 x 844 | 3 | Vault uses `contain` and is letterboxed; operator is hidden by responsive policy. |

At the live 1934 x 1272 DPR-1 page, the operator image was measured at
1004.016 x 786.547 CSS px with intrinsic size 1280 x 1024 and
`object-fit: fill`. The visible idle subject occupies only about 364 x 936
source pixels, so nominal canvas size overstates usable character detail. At
DPR 2 the visible subject requires about 571 x 1438 physical pixels and is
therefore enlarged approximately 1.57x horizontally and 1.54x vertically.

The Vault asset loaded in 4-7 ms and browser rAF showed no renderer stall. No
Vault asset request failed. This separates spatial under-resolution and source
cadence from network or scheduler failure. The only observed unrelated 404 was
`/favicon.ico`.

## Operator source evidence

The current operator delivery contains 130 full-canvas 1280 x 1024 alpha WebP
frames across seven sequences, totaling 13,756,384 compressed bytes. Native
rates are 8-14 fps. The Svelte page uses two persistent DOM image buffers and
surface-managed decode; it does not use a Spine, Pixi, Canvas, WebGL, or 3D
actor rig.

The package lacks authored `loading`, `anticipation`, `spin`, and `recover`
clips. Duplicate decoded frames occur in delivered reactions, including
`CHAR_LOSS_STREAK` and `CHAR_WIN_HAPPY`, and several delivered frames fade the
entire character rather than only antialiased edges. The declared root anchor
is not applied by the DOM surface. Action bounding boxes move materially while
the renderer has no bone/root constraint or transition mixing.

Live loss authority, round-ID deduplication, replay generation isolation, and
restore suppression were inspected and are not the root cause. They must remain
unchanged in a later animation implementation.

## Source availability and stop decision

Repository and archive searches found no usable BLACKSITE production source in
`.blend`, `.fbx`, `.obj`, `.gltf`, `.glb`, `.spine`, `.skel`, `.atlas`, `.psd`,
`.aep`, `.kra`, `.ma`, or `.mb` form. The repository contains flat look
references and generated full-frame sequences, not separated Vault objects or
an identity-stable operator rig.

The monorepo includes PixiJS 8 and Spine 4.2 capability elsewhere, but the
BLACKSITE app neither declares that runtime nor has an exported BLACKSITE
skeleton/atlas. Runtime availability is not a substitute for authoring source.

The smallest valid unblocker is:

1. one approved operator identity with layered master/turnaround and a Spine
   4.2-compatible skeleton/atlas, or an atlas rendered from that one rig; and
2. one fixed-camera Vault source with separate door, wheel, six bolts, hinge,
   aperture/tunnel depth plates, light masks, and declared pivots.

Until those sources exist, Gate 2 (consistent source), Gate 3 (real motion),
Gate 4 (DPR-safe export), and Gate 6 (final visual proof) fail. Generating more
independent full-scene images, upscaling the current WebP, or adding CSS shake
would violate the supplied rebuild contract and is intentionally not done.

## Related design and character evidence

- `docs/blacksite/ANIMATION_REBUILD_BIBLE.md`
- `docs/blacksite/ANIMATION_REBUILD_CHARACTER_AUDIT.md`
