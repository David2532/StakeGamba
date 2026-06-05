# WORLD GOAL RUSH — Asset Folders

These folders are reserved for later, original/licensed art and audio. The MVP
renders everything with built-in vector symbols and a synthesized AudioManager,
so the build never fails when these are empty (no CDN, no broken paths).

## Planned files (spec Anhang D / I / J)

### backgrounds/
- `stadium.webp` — 16:9 night stadium, no real-world brands.

### ui/
- `spin-button.webp` — green football glass, arrow ring, 3 states.
- `panel-bg.webp`, `gold-frame.webp` — 9-slice capable gold frame.

### symbols/
- `ball.webp`, `trophy.webp`, `whistle.webp`, `glove.webp`, `light.webp`,
  `red-card.webp`, `boot.webp`, `letter-a.webp` … `letter-10.webp`.
- WEBP preferred, PNG fallback. Missing image → vector/label fallback (no crash).

### audio/
- `ui-click.ogg`, `spin-start.ogg`, `reel-loop.ogg`, `reel-stop-1..3.ogg`,
  `win-small.ogg`, `win-big.ogg`, `bonus-trigger.ogg`.
- All routed through `src/audio/AudioManager.ts` and gated by the muted state.

## Wiring later
Symbol art swaps in via the central symbol meta; audio swaps in inside
`AudioManager`. No component reads asset paths directly, so adding files is
non-breaking. Math/publish files stay read-only.
