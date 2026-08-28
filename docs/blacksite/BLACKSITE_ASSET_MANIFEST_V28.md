# BLACKSITE // BREACH — Asset Manifest Contract V28

Status: **DESIGN LOCK — PASS / PRODUCTION ASSET DELIVERY — BLOCKED**
Canonical runtime root: `apps/blacksite/static/assets/blacksite/v28/`
Source/master root: `apps/blacksite/art/v28/`
Owners: Asset Director, Creative Director, Animation Director, Audio Director
Locked: 2026-08-20
Identity amendment: 2026-08-21 — tactical Penguin supersedes the adult-male operative. Runtime geometry/state/alpha/budget gates remain unchanged.

## 1. Purpose and truth boundary

This is the binding V28 delivery manifest and naming contract. It freezes what must be produced, where it will live, how it is bounded, how it fails safely, and how it is reviewed. It does not claim that planned V28 files already exist. Until an entry is delivered and its source/master/runtime/review hashes are recorded in the machine-readable manifest, its hash state is `BLOCKED_NOT_DELIVERED` and its production status is `required-gap`.

No current preview, AI-assisted image, generated video, third-party sound, or development rig is approved merely because it exists in `static/`.

## 2. Naming and machine-readable row schema

New stable IDs use:

`bsb-<domain>-<object>-<state>-v28`

Runtime paths use lowercase ASCII kebab-case. Sequence frames use zero-padded numeric order:

`v28/operative/<clip>/rgba/frame-000.png`

Every actual file row in `apps/blacksite/art/asset-manifest.json` must contain:

| Field | Requirement |
|---|---|
| `id` | globally unique stable V28 ID |
| `category` | brand, environment, board, symbol, operative, ui, fx, audio, tile |
| `gameStates` | exact application/event states in which it may appear |
| `sourcePath` | repo-relative authoring source; never inside upload package |
| `masterPath` | repo-relative flattened/approved master; never runtime by accident |
| `runtimePath` | repo-relative static path or explicit `null` for non-runtime evidence |
| `reviewPath` | solid-magenta review render for alpha assets or contact sheet for opaque groups |
| `sourceFormat`, `masterFormat`, `runtimeFormat` | explicit formats; audio masters are WAV 48 kHz/24-bit |
| `width`, `height`, `pixelDensity` | exact pixel geometry; sequence entries also include frame count/fps |
| `canvas`, `pivot`, `bounds` | exact coordinate contract, including transparent padding |
| `alpha`, `mask` | alpha mode and named mask requirement |
| `timing`, `interrupt` | animation duration/loop/cleanup contract or `static` |
| `budgetBytes` | hard per-file or per-group ceiling |
| `fallback` | runtime behavior on decode/load failure |
| `source`, `author`, `license`, `licenseUrl` | originality/rights chain; `internal-original` still names authoring workflow |
| `attribution` | exact required copy or `none` |
| `sha256Source`, `sha256Master`, `sha256Runtime`, `sha256Review` | lowercase 64-char hashes after delivery |
| `owner` | accountable discipline/person/agent |
| `status` | `required-gap`, `concept`, `review`, `production`, `approved`, `superseded`, or `rejected` |

No hash may be copied across derivatives. `approved` requires all four applicable hashes, visual review, rights review, optimization, static-build path proof, and exact-build browser proof.

## 3. Package budgets

| Group | Hard V28 budget |
|---|---:|
| Environment + board | 11 MiB |
| All symbol assets/states | 9 MiB |
| Operative runtime PNG sequences | 18 MiB and ≤96 frames |
| UI + brand | 4 MiB |
| FX + phased vault cinematic assets | 6 MiB |
| Audio runtime derivatives | 8 MiB |
| Target V28 production assets | ≤60 MiB |
| Full production static asset tree | <64 MiB hard gate |

First-play critical transfer is ≤12 MiB. Any category overrun is resolved by cropping, recompression, frame reduction, atlasing of non-operative FX, or asset reuse within the same semantic role; no overrun may be hidden by misclassifying a production dependency as development-only.

## 4. Brand and environment entries

All environment plates are opaque WebP unless an overlay explicitly requires alpha. They contain no UI text, values, reels, symbols, people, logos, or watermarks.

| ID | Runtime path | Geometry / budget | Game states | Alpha / fallback | Status |
|---|---|---:|---|---|---|
| `bsb-brand-lockup-full-idle-v28` | `v28/brand/blacksite-breach-lockup-full.webp` | 1600×520 / 180 KiB | boot, guide, tile review | alpha; live DOM title fallback | `required-gap` |
| `bsb-brand-lockup-compact-idle-v28` | `v28/brand/blacksite-breach-lockup-compact.webp` | 640×256 / 80 KiB | phone, Popout, modal | alpha; live DOM title fallback | `required-gap` |
| `bsb-env-base-desktop-idle-v28` | `v28/environment/base-desktop.webp` | 2560×1440 / 1.8 MiB | Base desktop | opaque; solid obsidian facility fallback | `required-gap` |
| `bsb-env-base-portrait-idle-v28` | `v28/environment/base-portrait.webp` | 1536×2048 / 1.4 MiB | phone/tablet portrait | opaque; Base desktop cropped only as safe fallback, never approval | `required-gap` |
| `bsb-env-base-short-landscape-idle-v28` | `v28/environment/base-short-landscape.webp` | 1792×828 / 1.0 MiB | phone landscape / constrained height | opaque; obsidian fallback | `required-gap` |
| `bsb-env-base-popout-idle-v28` | `v28/environment/base-popout.webp` | 1024×1024 / 700 KiB | Popout S/L | opaque; obsidian fallback | `required-gap` |
| `bsb-env-base-ambient-active-v28` | `v28/environment/base-ambient-overlay.webp` | 2560×1440 / 500 KiB | Base idle/spin | alpha; omit animation | `required-gap` |
| `bsb-env-alert-anticipation-active-v28` | `v28/environment/alert-overlay.webp` | 2560×1440 / 450 KiB | confirmed BREACH anticipation/error | alpha; live red/cyan outline fallback | `required-gap` |
| `bsb-env-blackout-desktop-idle-v28` | `v28/environment/blackout-interior-desktop.webp` | 2560×1440 / 1.8 MiB | BLACKOUT desktop | opaque unique secure interior; no Base tint fallback for approval | `required-gap` |
| `bsb-env-blackout-portrait-idle-v28` | `v28/environment/blackout-interior-portrait.webp` | 1536×2048 / 1.4 MiB | BLACKOUT portrait | opaque unique recomposition | `required-gap` |
| `bsb-env-blackout-short-landscape-idle-v28` | `v28/environment/blackout-interior-short-landscape.webp` | 1792×828 / 1.0 MiB | BLACKOUT landscape | opaque unique recomposition | `required-gap` |
| `bsb-env-blackout-popout-idle-v28` | `v28/environment/blackout-interior-popout.webp` | 1024×1024 / 700 KiB | BLACKOUT Popout | opaque unique recomposition | `required-gap` |
| `bsb-env-blackout-gold-active-v28` | `v28/environment/blackout-gold-light.webp` | 2560×1440 / 550 KiB | vault open / BLACKOUT | alpha; CSS live gold core fallback | `required-gap` |

Composition contract: Base shows cold wall-integrated depth and closed security hardware. BLACKOUT changes geometry, depth, practical-light layout, visible vault interior, and gold source. A hue-shifted Base file cannot fill a BLACKOUT entry.

## 5. Board and vault entries

| ID | Runtime path | Geometry / budget | Role / states | Alpha, pivot, fallback | Status |
|---|---|---:|---|---|---|
| `bsb-board-frame-outer-idle-v28` | `v28/board/frame-outer.webp` | 2048×1152 / 800 KiB | wall armor surrounding exact 5×3 aperture | alpha; center pivot; CSS gunmetal frame fallback | `required-gap` |
| `bsb-board-bezel-inner-idle-v28` | `v28/board/bezel-inner.webp` | 1920×1080 / 500 KiB | machined inner frame/separators | alpha; exact reel mask; code separators fallback | `required-gap` |
| `bsb-board-glass-idle-v28` | `v28/board/reel-glass.webp` | 1920×1080 / 300 KiB | hardened smoked glass reflection | alpha; omit on failure | `required-gap` |
| `bsb-board-seal-idle-v28` | `v28/board/rubber-seal.webp` | 1920×1080 / 250 KiB | rubber aperture seal/contact shadow | alpha; code shadow fallback | `required-gap` |
| `bsb-board-led-base-idle-v28` | `v28/board/led-base.webp` | 1920×1080 / 180 KiB | restrained cyan channels | alpha; code cyan line fallback | `required-gap` |
| `bsb-board-led-blackout-active-v28` | `v28/board/led-blackout.webp` | 1920×1080 / 180 KiB | sparse cyan plus gold BLACKOUT channels | alpha; live semantic outline fallback | `required-gap` |
| `bsb-board-payline-path-active-v28` | `v28/board/payline-path-atlas.webp` | 2048×2048 / 600 KiB | exact ten line masks/paths | alpha atlas; code SVG/canvas line fallback | `required-gap` |
| `bsb-vault-door-closed-idle-v28` | `v28/vault/door-closed.webp` | 1600×1600 / 900 KiB | closed door, phase 1–3 | alpha; center `(800,800)` | `required-gap` |
| `bsb-vault-door-open-active-v28` | `v28/vault/door-open.webp` | 1600×1600 / 900 KiB | final open-door pose / reduced motion | alpha; same bounds; static open fallback | `required-gap` |
| `bsb-vault-wheel-active-v28` | `v28/vault/wheel.webp` | 768×768 / 280 KiB | phase 4 weighted turn | alpha; center `(384,384)`; closed pose fallback | `required-gap` |
| `bsb-vault-lock-active-v28` | `v28/vault/lock.webp` | 384×384 / 120 KiB | six instances phases 3/6 | alpha; center; state outline fallback | `required-gap` |
| `bsb-vault-pressure-active-v28` | `v28/vault/pressure-fx-atlas.webp` | 2048×2048 / 650 KiB | phase 5 vapor/gauge detail | alpha atlas; omit particles, keep label | `required-gap` |
| `bsb-vault-gold-portal-active-v28` | `v28/vault/gold-portal.webp` | 1600×1600 / 600 KiB | phases 8–10 and BLACKOUT handoff | alpha; center; bounded live radial fallback | `required-gap` |

Door, wheel, locks, bolts, pressure, gold, and camera are separately addressable phases. They must not be flattened into one uncontrolled MP4/WebM. Transparent assets require matching `review/magenta/` renders on solid `#FF00FF` with identical bounds.

## 6. Canonical symbol family

Every symbol state is a 512 × 512 alpha WebP on a protected 40 px inner margin, centered optical bounds, and ≤180 KiB per file. Required common state IDs/paths are:

`bsb-symbol-<symbol>-<state>-v28` -> `v28/symbols/<symbol>/<state>.webp`

Common states: `idle`, `land`, `win`, `dim`, `exit`. `exit` may be a bounded atlas/transform contract only when it improves clarity; if omitted after review, the manifest row is `N/A` with the approved reason rather than silently absent. `ghost_wild` additionally requires `entry`, `anticipation`, and `triggered`. `breach` additionally requires `entry`, `anticipation`, and `triggered`; it never has a line-win state.

| Canonical symbol | Exact common IDs | Additional IDs | Current coverage / gap |
|---|---|---|---|
| `operative` | `bsb-symbol-operative-{idle,land,win,dim,exit}-v28` | none | V22 Penguin Base/Win/Dim is the preferred identity reference; Land/Exit and final production approval remain gaps |
| `encrypted_drive` | `bsb-symbol-encrypted-drive-{idle,land,win,dim,exit}-v28` | none | V4 Base/Win/Dim exists; Land/Exit and final approval gap |
| `tactical_radio` | `bsb-symbol-tactical-radio-{idle,land,win,dim,exit}-v28` | none | same gap |
| `classified_folder` | `bsb-symbol-classified-folder-{idle,land,win,dim,exit}-v28` | none | same gap |
| `night_vision_goggles` | `bsb-symbol-night-vision-goggles-{idle,land,win,dim,exit}-v28` | none | same gap |
| `supply_crate` | `bsb-symbol-supply-crate-{idle,land,win,dim,exit}-v28` | none | same gap |
| `ghost_wild` | `bsb-symbol-ghost-wild-{idle,land,win,dim,exit}-v28` | `entry`, `anticipation`, `triggered` | V4 Base/Win/Dim/Anticipation/Triggered exists; Land/Entry/Exit and approval gap |
| `breach` | `bsb-symbol-breach-{idle,land,dim,exit}-v28` | `entry`, `anticipation`, `triggered`; **no win** | V19 states exist; Entry/Land/Exit and coherent V28 treatment gap |
| `a` | `bsb-symbol-a-{idle,land,win,dim,exit}-v28` | none | V4 Base/Win/Dim exists; Land/Exit and approval gap |
| `k` | `bsb-symbol-k-{idle,land,win,dim,exit}-v28` | none | same gap |
| `q` | `bsb-symbol-q-{idle,land,win,dim,exit}-v28` | none | same gap |
| `j` | `bsb-symbol-j-{idle,land,win,dim,exit}-v28` | none | same gap |
| `ten` | `bsb-symbol-ten-{idle,land,win,dim,exit}-v28` | none | same gap |

Acceptance requires actual-size 72 px phone contact sheets on Base, dimmed, and win backgrounds; grayscale silhouette review; consistent perspective/light; alpha halo/crop review; exact 13-ID registry closure; and accessible live names.

## 7. Tactical Penguin operative runtime contract

All final V28 Penguin operative runtime frames are PNG RGBA, exactly 1280 × 1024, under `rgba/`, anchored at source coordinate `x=310`, `y=1000`. The root, floor contact, scale, and layout box are identical across clips. No adult-male fallback, opaque video, or unbounded parallel animation may be selected by the final V28 runtime path. Existing animated WebP Penguin films are vertical-slice inputs only until the required PNG frame family is delivered.

| ID / clip folder | Max frames | FPS / loop | Required segments | Interrupt / fallback | Status |
|---|---:|---:|---|---|---|
| `bsb-operative-idle-a-v28` / `operative/idle-a/rgba/` | 12 | 8–12 / loop | entry, breathe/blink loop, settle | any higher state; fallback neutral frame | `required-gap` |
| `bsb-operative-idle-b-v28` / `operative/idle-b/rgba/` | 10 | 8–12 / one-shot | entry, glance/gear check, settle, exit | any confirmed state; fallback idle A | `required-gap` |
| `bsb-operative-spin-v28` / `operative/spin/rgba/` | 6 | 12–18 / no | entry, terminal action, settle, exit | result/bonus; fallback recover | `required-gap` |
| `bsb-operative-anticipation-v28` / `operative/anticipation/rgba/` | 8 | 10–15 / bounded hold | entry, focus hold, release/exit | trigger, release, timeout; fallback recover | `required-gap` |
| `bsb-operative-loss-v28` / `operative/loss/rgba/` | 6 | 10–15 / no | entry, neutral reset, settle, exit | higher priority; fallback recover | `required-gap` |
| `bsb-operative-loss-streak-v28` / `operative/loss-streak/rgba/` | 8 | 10–15 / no | entry, terminal-directed fatigue, settle, exit | higher priority; fallback recover | `required-gap` |
| `bsb-operative-win-v28` / `operative/win/rgba/` | 6 | 12–18 / no | entry, acknowledgment, settle, exit | bonus/big/rage; fallback recover | `required-gap` |
| `bsb-operative-big-win-v28` / `operative/big-win/rgba/` | 8 | 12–18 / no | entry, hero action, settle, exit | bonus/rage only after amount readable; fallback recover | `required-gap` |
| `bsb-operative-bonus-v28` / `operative/bonus/rgba/` | 10 | 10–15 / bounded loop | entry, feature stance, settle, exit | rage only if explicitly legal; otherwise feature completion | `required-gap` |
| `bsb-operative-rage-v28` / `operative/rage/rgba/` | 8 | 12–18 / no | entry, facility-directed action, settle, exit | feature/result authority; fallback recover | `required-gap`, default-off binding |
| `bsb-operative-recover-v28` / `operative/recover/rgba/` | 6 | 10–15 / no | neutral return | may cut to idle A | `required-gap` |
| `bsb-operative-static-fallback-v28` | 1 | static | legal neutral pose | always available | `required-gap` |

Frame total hard ceiling is 96; table maxima total 89 including fallback. Group runtime ceiling is 18 MiB. Each alpha frame gets an identically bounded magenta review render outside `static`. Decode failure hides the failed clip, uses the fallback or no operative, reports once, and never blocks board, wallet, settlement, replay, or restore.

Priority is `rage > bonus > bigWin > win > lossStreak > loss > idle`; spin/anticipation are non-result transients. Rage is default off and remains unapproved until human review verifies it cannot shame or threaten the player.

## 8. HUD and modal asset family

UI raster supplies material surfaces/glyphs only. All labels, numbers, focus rings, states, currency, costs, rules, counters, and accessibility names are live UI.

Control pattern:

`bsb-ui-control-<control>-<state>-v28` -> `v28/ui/controls/<control>/<state>.webp`

Controls: `spin`, `auto`, `sound`, `info`, `turbo`, `settings`, `mode`, `minus`, `plus`, `close`, `confirm`, `cancel`, `recover`.

States: `idle`, `hover`, `focus`, `pressed`, `selected`, `disabled`, `loading`, `error` where semantically applicable. Secondary control canvas is 112 × 112 at 2× for a 56 CSS px box; optical glyph box is 56 × 56 at 2×. Spin canvas is 224 × 224 at 2× for a 112 CSS px box. Minus/plus canvas is 96 × 96 at 2× for a 48 CSS px box. Transparent optical-centering error is ≤2 source pixels.

| Group ID | Runtime path | Geometry / budget | Contract | Status |
|---|---|---:|---|---|
| `bsb-ui-control-family-v28` | `v28/ui/controls/` | ≤2.0 MiB total | all named controls/states, true distinct state pixels where required | `required-gap`; current V27 repeats one master across states |
| `bsb-ui-readout-nine-slice-idle-v28` | `v28/ui/nine-slice/readout.webp` | 384×384 / 100 KiB | 48 px protected corners; live values | `required-gap` |
| `bsb-ui-panel-nine-slice-idle-v28` | `v28/ui/nine-slice/panel.webp` | 512×512 / 140 KiB | modal/card material | `required-gap` |
| `bsb-ui-panel-danger-error-v28` | `v28/ui/nine-slice/panel-danger.webp` | 512×512 / 140 KiB | error material only | `required-gap` |
| `bsb-ui-feature-counter-idle-v28` | `v28/ui/feature-counter.webp` | 1024×320 / 180 KiB | live n/8 and target text | `required-gap` |
| `bsb-ui-mode-card-idle-v28` | `v28/ui/mode-card.webp` | 960×560 / 180 KiB | live mode data; one card per available mode | `required-gap` |
| `bsb-ui-reward-halo-active-v28` | `v28/ui/reward-halo.webp` | 1024×1024 / 220 KiB | bounded gold reward accent | `required-gap` |

There is no V28 generic hamburger/menu asset. Settings has one route. Mode appears only when multiple modes are available. Current premium HUD assets may be reference inputs but are not automatically V28-approved.

## 9. FX assets

| ID | Runtime path | Geometry / budget | Use / cap | Fallback | Status |
|---|---|---:|---|---|---|
| `bsb-fx-symbol-land-active-v28` | `v28/fx/symbol-land.atlas.webp` + JSON | 1024² / 300 KiB | regular/high land, ≤4 particles | outline/transform only | `required-gap` |
| `bsb-fx-ghost-wild-active-v28` | `v28/fx/ghost-wild.atlas.webp` + JSON | 2048² / 700 KiB | spectral entry/win, bounded | static symbol state | `required-gap` |
| `bsb-fx-breach-active-v28` | `v28/fx/breach.atlas.webp` + JSON | 2048² / 700 KiB | BREACH 1/2/trigger, ≤28 live | static trigger outline | `required-gap` |
| `bsb-fx-expansion-active-v28` | `v28/fx/expansion.atlas.webp` + JSON | 2048² / 700 KiB | authoritative expanded reels | instant evaluated-board swap | `required-gap` |
| `bsb-fx-win-active-v28` | `v28/fx/win.atlas.webp` + JSON | 2048² / 700 KiB | line/big/top, ≤64 live | line path + amount | `required-gap` |
| `bsb-fx-max-active-v28` | `v28/fx/max-win.atlas.webp` + JSON | 2048² / 800 KiB | `cap_reached`, ≤96 live | exact max report | `required-gap` |
| `bsb-fx-vault-dust-active-v28` | `v28/fx/vault-dust.atlas.webp` + JSON | 2048² / 650 KiB | gold reveal, ≤36 live | omit particles | `required-gap` |

Only one full-stage filter may be active. FX atlases are pre-multiplied/straight-alpha according to the renderer's tested contract and must record that choice in the manifest.

## 10. Audio and tile groups

Audio file-level entries are created from every non-N/A row in `BLACKSITE_AUDIO_EVENT_MATRIX_V28.md`. Runtime paths use `v28/audio/<bus>/<semantic-name>.<runtime-extension>`. Source WAVs and license evidence remain under `apps/blacksite/art/v28/audio/`, never in static.

Required tile entries:

| ID | Runtime/review path | Contract | Status |
|---|---|---|---|
| `bsb-tile-background-idle-v28` | `apps/blacksite/art/v28/tile/blacksite-breach-bg.png` | current Stake dimension/name/size contract reverified at candidate time; no UI text | `required-gap` |
| `bsb-tile-foreground-idle-v28` | `apps/blacksite/art/v28/tile/blacksite-breach-fg.png` | transparent tactical Penguin operative + vault hook, no cropped halo | `required-gap` |
| `bsb-tile-provider-idle-v28` | `apps/blacksite/art/v28/tile/provider-logo.png` | transparent approved provider mark only | `required-gap` |
| `bsb-tile-composite-review-v28` | `apps/blacksite/art/v28/tile/review/composite.png` | BG+FG small preview and size evidence; not runtime | `required-gap` |

Tile dimensions/combined size are not guessed in this design lock; current official Stake requirements must be rechecked and recorded before production export.

## 11. Current asset disposition

| Current group | Disposition for V28 | Reason |
|---|---|---|
| `runtime-rgba-v1` adult operative | **rejected/superseded** | the user's later Penguin identity direction overrides this path; keep unselected provenance only |
| `runtime-rgba-dev-v1` / `runtime-rgba-dev-fx-v1` | development-only, never package | explicitly development film/FX groups |
| `v20/penguin-operator` | vertical-slice reference/runtime input; not final V28 approval | correct user-selected identity, but current animated-WebP format and final rights/state/PNG-frame gates remain open |
| `v21/ui-kit`, `v22/ui-kit`, `v27/ui-kit` | reference/rework input; not wholesale promotion | useful material/nine-slice direction, but production flag coupling and repeated/insufficient state differentiation remain |
| `v22/symbols/operative` | preferred symbol identity reference; review required | aligns with the user-selected Penguin direction but still needs complete state and exact-build review |
| `symbols/*/states-v4` | review input; replace/complete as V28 family | canonical IDs exist, but Land/Exit gaps and production art/rights review remain |
| `v19/cinematic/dev-rig-v1` | timing prototype only | synchronizable but visible development asset, not final art |
| `v24` 1080p/2160p vault video | remove from V28 production path; source review reference at most | whole-sequence media cannot provide deterministic phase control; 2160p violates budget intent |
| `v26` Kling 720p vault video/poster | **rejected and remove from production** | visible Kling watermark, quality/rights risk, uncontrolled sequence |
| `v19/scenes` and mode art | reference only | BLACKOUT not sufficiently distinct; no V28 responsive family |
| `audio/v19` three MP3s | temporary runtime only; not V28 approval | incomplete bank, source/master hash/license closure and engine contract gaps |

Rejected/superseded files may remain in source history or explicit dev-only directories, but the production package closure must exclude them.

## 12. Alpha and quality gate

Every transparent runtime file has an identical-bounds review render on solid `#FF00FF`. The review checks:

- no light/dark matte halo;
- no jagged fringe or premultiplication mismatch;
- no shadow cropped by canvas;
- no unintended transparent padding;
- consistent pivot/bounds across states/frames;
- no anatomy, perspective, text, watermark, or duplicated-detail artifact;
- exact SHA-256 before status changes.

Opaque environment groups receive desktop, portrait, short-landscape, and Popout contact sheets. Symbol/operative groups receive actual-size and full-board/contact-sheet review. A generated asset with visible AI anatomy/perspective/text defects is rejected, not hidden by runtime scaling.

## 13. Runtime fallback and release rule

Fallback order:

1. use same-semantic approved static pose/state;
2. use accessible live DOM/code-native board/control surface;
3. omit nonessential operative/particle/environment overlay;
4. report the failed source once and continue authoritative presentation.

Fallback can keep gameplay, replay, restore, and settlement functional, but any visible fallback or missing V28 production asset makes the candidate gate `FAIL`. Release packages contain no placeholder, watermark, developer film, source master, review render, unused high-resolution source, or external URL.

## 14. Acceptance checklist

Asset delivery passes only when:

- every required non-N/A ID has exact source/master/runtime/review paths and hashes;
- all runtime paths exist in the exact extracted build and produce zero 404s/external fetches;
- tactical Penguin operative, unique Base/BLACKOUT families, 13 symbols, phased vault, complete UI states, FX, audio, and tile package pass human creative/rights review;
- PNG operative frames meet 1280 × 1024, `(310,1000)`, fixed bounds, ≤96 frames, and ≤18 MiB;
- icon state geometry and optical centering meet the Art Bible;
- alpha magenta, actual-size mobile, responsive composition, no-watermark, and no-baked-text reviews pass;
- V28 and total build stay inside package/decoded-memory/load budgets;
- missing-asset fixtures finish without deadlock while the candidate correctly remains failed;
- exact-build screenshots/video/performance traces and independent reinspection exist.

The manifest design is implementation-ready and therefore Design Lock PASS. Actual production asset delivery is still BLOCKED.
