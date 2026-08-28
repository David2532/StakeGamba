# BLACKSITE V22 UI kit provenance

## Generation

- Date: 2026-08-14
- Generator: built-in Codex `image_gen` tool via the installed `imagegen` skill
- Mode: five independent built-in generations; no CLI/API fallback and no external stock assets
- Intended scope: versioned V22 authoring/runtime asset package only; not wired into Svelte or JavaScript
- Original built-in outputs were retained in the local Imagegen cache; the accepted project copies are listed below.

| Role | Built-in output | Project authoring source |
| --- | --- | --- |
| Control | `exec-879c8bac-60dc-4d31-885c-e50201f051e8.png` | `authoring/sources/control-master-source.webp` |
| Panel | `exec-2a3a45f8-066e-4af1-aaa1-c5828559691e.png` | `authoring/sources/panel-master-source.webp` |
| Readout | `exec-62feea57-2a1b-42cc-9b1d-650925d0f62d.png` | `authoring/sources/readout-master-source.webp` |
| Reel-stage bezel | `exec-bf83d1ad-277b-4660-8af0-f2f3ae129ee0.png` | `authoring/sources/reel-stage-source.webp` |
| Reel-cell depth overlay | `exec-b679e0d2-ba85-43a2-a763-5d798ea4bcd3.png` | `authoring/sources/cell-depth-overlay-source.webp` |

The built-in tool returned RGBA PNGs with transparent corners/openings, so a destructive chroma-key pass was unnecessary. The PNGs were copied into the project as lossless alpha WebP authoring masters; no existing project asset was replaced.

## Deterministic runtime normalization

`authoring/build_v22_ui_kit.py` center-fits each approved source to its exact runtime geometry with Lanczos resampling, normalizes alpha endpoints, clears invisible RGB data, neutralizes only low-alpha edge fringes, validates transparent corners and the required center mode, and writes lossless WebP with exact transparent RGB retention.

Runtime masters:

- `nine-slice/control/master.webp` — 768x384
- `nine-slice/panel/master.webp` — 960x640
- `nine-slice/readout/master.webp` — 960x384
- `reel-stage/inner-bezel-depth-overlay.webp` — 1280x768
- `reel-stage/cell-depth-overlay.webp` — 640x512 RGBA

## Visual QA

- PASS: no text, letters, numbers, logos, emblems, watermarks, or insignia.
- PASS: oxidized gunmetal/steel and restrained aged-brass material family is consistent across all five masters.
- PASS: lighting is neutral warm-white only; no authored cyan, blue, red, or magenta police-style rim lighting.
- PASS: control, panel, and readout central content fields remain empty and opaque.
- PASS: reel-stage opening and all outer corners remain transparent.
- PASS: reel-cell overlay has a fully enclosed transparent center component covering 45.881958% of the 640x512 canvas, plus a conservative 432x304 all-transparent safe opening.
- PASS: reel-cell overlay contributes zero visible saturated cyan, blue, red, or magenta pixels under the package color guard.
- PASS: perspective is front-facing and symmetric enough for modular slicing/stretching.

Exact paths, dimensions, slice/content insets, state derivation recipes, hashes, byte counts, alpha contracts, and package budgets are recorded in `manifest.json`.
