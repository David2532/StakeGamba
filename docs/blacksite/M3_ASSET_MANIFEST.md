# BLACKSITE // BREACH — M3 Asset Manifest and Integration Gate

Status: **M3 STARTED — PENGUIN + VAULT IDENTITY LOCKED; NO PRODUCTION ASSET OR SPINE RIG APPROVED**
Date: **2026-08-30**
Machine-readable manifest: [`apps/blacksite/art/asset-manifest.json`](../../apps/blacksite/art/asset-manifest.json)

## What this M3 increment closes

- A text-only, project-authored generation route and exact prompt/provenance record now exist.
- Original direction anchors exist for bunker material/lighting and all six frozen symbol identities. The former human-operative character anchor and its embedded environment silhouette are superseded and cannot direct production.
- Each retained file has a semantic path, exact dimensions, SHA-256 identity, owner, status and explicit non-runtime contract.
- The corrected environment intentionally contains an empty board aperture; the authoritative 7 × 7 topology remains code/event-owned rather than baked into uncertain artwork.
- No generated concept has been imported into the M2 app or upload build, so M2 behavior and bundle identity remain unchanged until a gated integration pass.

This does not close M3. Concepts are not automatically production art, and image generation is not a substitute for responsive composition, layered source production, Spine authoring, optimization, runtime failure handling or human art/rights review.

## Retained concept set

| Asset ID                                              | Source path                                                                              |  Dimensions | SHA-256                                                            | Status           | Intended use                                                                                      |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------: | ------------------------------------------------------------------ | ---------------- | ------------------------------------------------------------------------------------------------- |
| `concept.environment.server_bunker_board_aperture.v1` | `apps/blacksite/art/concepts/m3/environment-server-bunker-board-aperture-concept-v1.png` |  1672 × 941 | `7a71b005b46c542882ed6553132e43a79c67207945651c8cbc4dcaf132dc991d` | `reference-only` | Material, lighting and empty-aperture reference only; embedded human and composition are excluded |
| `concept.character.operative_spine_anchor.v1`         | `apps/blacksite/art/concepts/m3/operative-spine-anchor-concept-v1.png`                   | 1024 × 1536 | `3b2cb5013bede3ea786f538f77b66dc716cc4ef4439268d428e4990c361f4869` | `superseded`     | Historical provenance/negative reference only; never runtime-eligible                             |
| `concept.symbols.material_language.v1`                | `apps/blacksite/art/concepts/m3/symbols-material-language-concept-v1.png`                | 1254 × 1254 | `e63ff125b5fbdc4b361176a3019a5590cca942ef710fbdb82c11fbf6fb148662` | `concept`        | BYTE/RELAY/PROXY/CIPHER/DAEMON/VAULT family language in reading order                             |

Exact prompts, iteration history and observed limitations are recorded in [`PROVENANCE.md`](../../apps/blacksite/art/concepts/m3/PROVENANCE.md). The first environment generation was rejected rather than retained because it invented a non-authoritative grid.

## Production group ledger

| Group               | Current state             | Production deliverable before integration/approval                                                                                                                                                   |
| ------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Title/brand         | `planned`                 | Original full/compact lockups, provider mark, monochrome variants and title/legal review                                                                                                             |
| Environment         | `reference-material-only` | New independently composed desktop, portrait and Popout vault-facility layers plus BLACKOUT state; original penguin integration; opaque optimized WebP/AVIF as supported; no automatic portrait crop |
| Board               | `planned`                 | Frame, cell plates, breach levels, masks and feature overlays aligned to the exact DOM/Pixi 7 × 7 geometry                                                                                           |
| Symbols             | `concept-started`         | Six isolated alpha sprites with identical square bounds/pivots, idle/win/dim readability and a measured Pixi spritesheet                                                                             |
| Penguin Vaultkeeper | `planned`                 | Original approved turnaround plus Spine **4.2.x** skeleton data, atlas/pages, root/bounds convention, fallback pose and all 13 semantic clips/events from `ANIMATION_BIBLE.md`                       |
| UI                  | `planned`                 | Production control icons, mode surfaces, modal/rules support art and visible mute control without replacing familiar interaction affordances                                                         |
| FX                  | `planned`                 | Breach pulses, sparks, network traces and controlled particles/spritesheets with failure-safe completion                                                                                             |
| Audio               | `planned`                 | Ambience/music/SFX plus one global mute/resume lifecycle and Replay/turbo behavior                                                                                                                   |
| Game tile           | `planned`                 | Current Stake BG, transparent FG/key art and provider mark with exact dimension/size/manual-preview proof                                                                                            |

## Reserved runtime boundary

Approved optimized exports will live under `apps/blacksite/static/assets/blacksite/`, grouped by `environment/`, `board/`, `symbols/`, `character/`, `ui/`, `fx/` and `audio/`. Concept PNGs remain outside `static` and must never be referenced by the runtime.

Before the first runtime asset import:

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
- `idle_a`, `idle_b`, `spin_start`, `anticipation`, `win_small`, `win_medium`, `win_big`, `feature_tease`, `feature_trigger`, `bonus_idle`, `bonus_win`, `max_win` and `recover`;
- documented loops, transitions, mixes, tracks, event markers, turbo behavior, Replay/restore behavior and timeouts;
- static fallback pose and an asset-missing fixture proving gameplay cannot deadlock.

## Truthful M3 status

M3 is **started, not complete**. The concrete next autonomous production action is to author an original penguin turnaround/fallback and new layer-ready mechanical-vault environment compositions, then obtain a real Spine 4.2 penguin delivery and integrate it behind the frozen M2 interface. Human Creative/Compliance review must still cover originality, anatomy, perspective, responsive crops, possible text artifacts, rights/provenance and visual cohesion. No retained image is marked `production` or `approved`.
