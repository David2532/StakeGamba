# BLACKSITE // BREACH — M3 Asset Manifest and Integration Gate

Status: **M3 STARTED — PENGUIN FALLBACK AND RESPONSIVE BASE VAULT ENVIRONMENT INTEGRATED; SPINE, BLACKOUT AND HUMAN APPROVAL PENDING**
Date: **2026-08-30**
Machine-readable manifest: [`apps/blacksite/art/asset-manifest.json`](../../apps/blacksite/art/asset-manifest.json)

## What this M3 increment closes

- A text-only, project-authored generation route and exact prompt/provenance record now exist.
- Original direction anchors exist for bunker material/lighting and all six frozen symbol identities. The former human-operative character anchor and its embedded environment silhouette are superseded and cannot direct production.
- Each retained file has a semantic path, exact dimensions, SHA-256 identity, owner, status and explicit non-runtime contract.
- The corrected environment intentionally contains an empty board aperture; the authoritative 7 × 7 topology remains code/event-owned rather than baked into uncertain artwork.
- Historical M3 concept sheets remain excluded from the runtime; only separately generated, tracked and optimized production candidates are imported.
- An original mature penguin Vaultkeeper static fallback is imported through a semantic asset map, optimized to a 78,732-byte WebP, pointer-inert and hidden in compact layouts. It is a production candidate, not a human-approved rig or final character group.
- Independently composed desktop and portrait mechanical-vault plates are imported through the same semantic map. The 77,992-byte wide plate and 48,628-byte tall plate retain an empty board aperture, while `<picture>` selection prevents an automatic desktop crop on compact layouts.

This does not close M3. The integrated candidates have exact source/runtime hashes and responsive runtime contracts, but generation is not a substitute for the required turnaround, Spine authoring, BLACKOUT/foreground environment layers, final cleanup or human art/rights review.

## Retained concept set

| Asset ID                                              | Source path                                                                              |  Dimensions | SHA-256                                                            | Status                 | Intended use                                                                                               |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------: | ------------------------------------------------------------------ | ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| `concept.environment.server_bunker_board_aperture.v1` | `apps/blacksite/art/concepts/m3/environment-server-bunker-board-aperture-concept-v1.png` |  1672 × 941 | `7a71b005b46c542882ed6553132e43a79c67207945651c8cbc4dcaf132dc991d` | `reference-only`       | Material, lighting and empty-aperture reference only; embedded human and composition are excluded          |
| `concept.character.operative_spine_anchor.v1`         | `apps/blacksite/art/concepts/m3/operative-spine-anchor-concept-v1.png`                   | 1024 × 1536 | `3b2cb5013bede3ea786f538f77b66dc716cc4ef4439268d428e4990c361f4869` | `superseded`           | Historical provenance/negative reference only; never runtime-eligible                                      |
| `concept.symbols.material_language.v1`                | `apps/blacksite/art/concepts/m3/symbols-material-language-concept-v1.png`                | 1254 × 1254 | `e63ff125b5fbdc4b361176a3019a5590cca942ef710fbdb82c11fbf6fb148662` | `concept`              | BYTE/RELAY/PROXY/CIPHER/DAEMON/VAULT family language in reading order                                      |
| `product.character.penguin_vaultkeeper.fallback.v1`   | `apps/blacksite/art/production/character/penguin-vaultkeeper-fallback-v1.png`            | 1024 × 1536 | `9eda38025f7adc6685215e50def26be7abedeac1406c1984be46c644a107d58d` | `production-candidate` | Original static fallback; optimized runtime WebP is integrated, while human approval and Spine remain open |
| `product.environment.mechanical_vault.desktop.v1`     | `apps/blacksite/art/production/environment/mechanical-vault-desktop-v1.png`              |  1672 × 941 | `6a66ab13003b4e92228bdf4cfa7c19dddf7bd46725604ca1846ed8c8d13a680b` | `production-candidate` | Original wide base-vault plate; optimized runtime WebP is integrated behind the desktop board              |
| `product.environment.mechanical_vault.portrait.v1`    | `apps/blacksite/art/production/environment/mechanical-vault-portrait-v1.png`             |  941 × 1672 | `e7786bbf289a1655cabc9a53199353913bc0a214c0563259c5dce2560f6ba44c` | `production-candidate` | Independent tall base-vault recomposition; selected for compact/mobile rather than cropped from desktop    |

Exact prompts, iteration history and observed limitations are recorded in [`PROVENANCE.md`](../../apps/blacksite/art/concepts/m3/PROVENANCE.md). The first environment generation was rejected rather than retained because it invented a non-authoritative grid.

## Production group ledger

| Group               | Current state                      | Production deliverable before integration/approval                                                                                                                                                       |
| ------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Title/brand         | `planned`                          | Original full/compact lockups, provider mark, monochrome variants and title/legal review                                                                                                                 |
| Environment         | `base-desktop-portrait-integrated` | Base desktop and independently composed portrait/Popout plates are runtime-integrated; BLACKOUT state, separable foreground layers and human approval remain required                                    |
| Board               | `planned`                          | Frame, cell plates, breach levels, masks and feature overlays aligned to the exact DOM/Pixi 7 × 7 geometry                                                                                               |
| Symbols             | `concept-started`                  | Six isolated alpha sprites with identical square bounds/pivots, idle/win/dim readability and a measured Pixi spritesheet                                                                                 |
| Penguin Vaultkeeper | `static-fallback-integrated`       | Original approved turnaround plus Spine **4.2.x** skeleton data, atlas/pages, root/bounds convention and all 14 semantic clips/events from `ANIMATION_BIBLE.md`; current fallback remains review-pending |
| UI                  | `planned`                          | Production control icons, mode surfaces, modal/rules support art and visible mute control without replacing familiar interaction affordances                                                             |
| FX                  | `planned`                          | Breach pulses, sparks, network traces and controlled particles/spritesheets with failure-safe completion                                                                                                 |
| Audio               | `planned`                          | Ambience/music/SFX plus one global mute/resume lifecycle and Replay/turbo behavior                                                                                                                       |
| Game tile           | `planned`                          | Current Stake BG, transparent FG/key art and provider mark with exact dimension/size/manual-preview proof                                                                                                |

## Runtime boundary

Approved optimized exports will live under `apps/blacksite/static/assets/blacksite/`, grouped by `environment/`, `board/`, `symbols/`, `character/`, `ui/`, `fx/` and `audio/`. Concept PNGs remain outside `static` and must never be referenced by the runtime.

The first import must satisfy and preserve these gates:

1. add `apps/blacksite/static` to the SHA-bound source identity targets in `scripts/blacksite-qa-e2e.mjs`;
2. define a semantic asset map under `apps/blacksite/src/lib/assets/` rather than scattering literal URLs;
3. keep environment/character layers `aria-hidden` and `pointer-events: none` behind the unchanged M2 board and controls;
4. preserve all test IDs, authoritative event flow, board geometry and result surfaces;
5. make missing assets fall back safely without blocking play, settlement, Replay or restore;
6. measure asset bytes, texture dimensions, first-interactive behavior and the heaviest deterministic fixture;
7. re-run units, lint, production build and clean-SHA browser evidence.

## Locked penguin + vault identity contract

The production identity is fixed as an original mature stylized anthropomorphic penguin Vaultkeeper inside a physical armored vault/security facility.

Acceptance criteria:

- unmistakable penguin silhouette at desktop, portrait-mobile crop and fallback-pose sizes, with authored beak, flipper and body articulation;
- restrained graphite/charcoal utility materials and limited cyan/amber/red practical light consistent with the bunker, never a human body wearing a mascot suit;
- clever, focused and adult-toned characterization; no childlike/chibi proportions, comedy-only mascot treatment or recognizable franchise resemblance;
- mechanical lock, vault-door, locking-bolt and iris motifs authored into environment, board frame, feature transition and key art; a generic server room alone is insufficient;
- the penguin frames the board and may be reduced or omitted in Popout before board/control readability is compromised;
- character and vault motion remain presentation-only, consume authoritative cues and cannot affect payout, feature occurrence, replay or restore state;
- final source/provenance, rights, turnaround, responsive crops, runtime bytes and manual Creative/Compliance review are recorded before promotion from `planned`.

The retained human-operative PNG and the human silhouette in the old environment PNG are provenance records only. They are forbidden as runtime, key-art, rig, compositing or production-generation references.

## Spine delivery gate

The locked penguin brief is the identity authority. A production character is not accepted without:

- Spine runtime/export compatibility with the repository's 4.2.x stack;
- skeleton data, `.atlas` and texture pages;
- stable root orientation, reference scale, bounds and mobile bust composition;
- all 14 machine-manifest states: `idle_a`, `idle_b`, `spin_start`, `anticipation`, `win_small`, `win_medium`, `win_big`, `loss_acknowledge`, `feature_tease`, `feature_trigger`, `bonus_idle`, `bonus_win`, `max_win` and `recover`;
- documented loops, transitions, mixes, tracks, event markers, turbo behavior, Replay/restore behavior and timeouts;
- static fallback pose and an asset-missing fixture proving gameplay cannot deadlock.

## Truthful M3 status

M3 is **started, not complete**. The exact built app now contains an original review-pending static penguin fallback and responsive base mechanical-vault environment; no asset is marked `approved`. The next production actions are BLACKOUT/foreground environment states, manual cleanup/Creative/Compliance review, and a real Spine 4.2 penguin delivery behind the frozen M2 interface.
