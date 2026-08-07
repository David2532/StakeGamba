---
name: asset-pipeline
description: Use for BLACKSITE art/audio/Spine asset briefs, generation prompts, manifests, naming, atlasing, compression, provenance, local packaging, and asset QA. Do not ship sample-game or unverified third-party assets.
---

# Production Asset Pipeline

## Principle
Codex should never improvise final art by scattering random SVG placeholders through the app. Every visible production asset must have an owner, role, contract, provenance, and quality target.

## Asset stages
1. **Brief** — purpose, composition, visual hierarchy, required variants, viewport use.
2. **Concept/reference** — prompt/reference sheet approved against the BLACKSITE art direction.
3. **Production** — source asset or rig produced at required resolution/version.
4. **Integration contract** — filename, dimensions, pivot/anchor, states/events, alpha/bounds, atlas/bundle.
5. **Optimization** — crop transparent waste, compress, atlas, remove duplicates.
6. **Runtime proof** — load/render in Storybook/fixture states.
7. **Manifest + provenance** — record source/originality and final shipped path.

## Character deliverable contract
For a Spine side character, require:
- skeleton data (`.json` or supported binary);
- atlas file and texture pages;
- export version compatible with repo runtime 4.2.x;
- fixed root orientation/scale convention;
- stable bounds or explicit bounds provider strategy;
- animation names required by `aaa-animation`;
- event markers for synchronization;
- attachment/skin names if used;
- static fallback image/pose;
- source/provenance record.

## Image assets
- Use transparent PNG/WebP only when alpha is needed; otherwise prefer efficient opaque formats supported by the build/runtime.
- Keep source resolution proportional to maximum on-screen size and DPR target; do not ship 8K textures for 300px UI elements.
- Crop transparent margins unless required for an authored effect.
- Group symbol frames/FX into atlases where it improves request count and batching.

PixiJS notes that spritesheets reduce the number of resource requests and improve batching because related sprites share a texture. Use that deliberately.
Reference: https://pixijs.com/8.x/guides/components/assets

## Naming
Use semantic stable names, e.g.:
- `character/operative.spine.json`
- `character/operative.atlas`
- `symbols/core.webp`
- `fx/breach-sparks.atlas.json`
- `background/server-room.webp`
- `ui/logo-blacksite.webp`

Avoid `final2.png`, `new-new.png`, opaque hashes in source names, or filenames that encode temporary prompt text.

## Final-release constraints
- No Stake SDK sample-game visual/audio assets in production.
- No remote font/image/audio fetches.
- No asset without a manifest entry.
- No manifest entry without a runtime reference or explicit reason.
- No third-party material without clear rights/provenance.
- No unused high-resolution source files in the upload package.

## Asset manifest fields
For each shipped asset record:
`id`, `type`, `purpose`, `source`, `originality/provenance`, `path`, `dimensions`, `alpha`, `anchor/pivot`, `atlas/bundle`, `states/animations`, `mobile fallback`, `compression`, `owner`, `status`.
