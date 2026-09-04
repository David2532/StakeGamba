---
name: stake-intro
description: Use when creating or reviewing a Stake game boot intro, logo reveal, bonus intro/outro, big-win sequence, or max-win cinematic. Focus on polish, skip/replay/restore safety, mobile composition, performance, and fast transition to play.
---

# Stake Intro / Cinematic Skill

## Goal

A premium intro should establish theme and quality fast, then get out of the player's way. It is presentation only; authentication/RGS state and settlement remain authoritative outside the cinematic.

## BLACKSITE boot concept

Target 2.5–4.0 seconds on a normal first launch, with a fast/skip path:

1. `0.00–0.35s` — black frame, tiny system boot ticks / low sub hit.
2. `0.35–1.20s` — server rack lights and security scanner sweep reveal the environment.
3. `1.20–2.20s` — BLACKSITE lockup assembles as if an encrypted terminal authenticates it.
4. `2.20–3.20s` — breach line fractures the logo; the penguin Vaultkeeper appears in silhouette as mechanical vault bolts retract.
5. `3.20–4.00s` — scene resolves directly into the playable layout with no blank/loading cut.

Do not make the player watch a long movie every session. Persist only a local presentation preference if allowed by the app architecture; never make intro history affect game odds or outcomes.

## Rules

- Intro must have `complete`, `skip`, `destroy`, and failure fallback paths.
- Never wait indefinitely for audio/animation assets.
- If session restore or replay requires immediate board reconstruction, skip/short-circuit the boot cinematic.
- Bonus intros must not replay as live purchase/trigger UI during deterministic Bet Replay unless the recorded presentation contract calls for it.
- Fast/turbo mode may use shortened transitions but must preserve required outcome legibility.
- Mobile and popout get recomposed shots, not a desktop canvas scaled down until text/board becomes tiny.
- Avoid external video/CDN dependencies. Prefer Pixi/Spine/timeline composition with local assets so the scene can be controlled and cleaned up.

## Cinematic grammar

Use a small vocabulary consistently:

- hard impact cut for breach/alarm moments;
- 100–250ms eased UI reveals;
- 250–600ms parallax/camera moves;
- 80–200ms flashes with quick decay;
- restrained screen shake only on authored impact markers;
- diegetic scanlines/terminal glyphs as accents, never constant readability-destroying noise.

## State contract

`IntroController` should conceptually expose:

- `playBoot()`
- `playFeatureEnter(feature)`
- `playFeatureExit(feature)`
- `playBigWin(tier)`
- `playMaxWin()`
- `skip()`
- `reset()`
- `destroy()`

All methods must resolve even when an asset or sound is unavailable.

## Approval-facing checks

Stake's current frontend guidelines require unique visual/audio assets, mobile and popout support, no broken/missing animations, and all assets/fonts loaded from Stake's CDN/static package. Treat those as cinematic gates too.

Primary reference:
https://stake-engine.com/docs/approval-guidelines/front-end-communication
