# Golden Goal Rush — asset mapping (visual source of truth)

**Source of truth:** `stake-upload/golden-goal-rush/assets/` — the finished
build uploaded to Stake is the visual master. `apps/lines` (and its Storybook)
mirror that look; files here are 1:1 copies, original names kept.

## Symbol mapping (math symbol → asset file → asset key)

| Math symbol | File                  | Asset key (`assets.ts`) |
| ----------- | --------------------- | ----------------------- |
| H1          | `fussball.png`        | `ggr-h1`                |
| H2          | `pokal.png`           | `ggr-h2`                |
| H3          | `pfeife.png`          | `ggr-h3`                |
| H4          | `trikot.png`          | `ggr-h4`                |
| L1          | `a.png`               | `ggr-l1`                |
| L2          | `k.png`               | `ggr-l2`                |
| L3          | `q.png`               | `ggr-l3`                |
| L4          | `j.png`               | `ggr-l4`                |
| L5          | `10.png`              | `ggr-l5`                |
| W (Wild)    | `wild.png`            | `ggr-w`                 |
| S (Scatter) | `scatter.png`         | `ggr-s`                 |
| —           | `slot-background.png` | `slotBackground`        |
| —           | `logo-horizontal.png` | `ggr-logo`              |

The previous placeholder set (`symbol-h1.png` … `symbol-s.png`) has been
deleted; nothing references it anymore.

## `ui/` (copied, not yet wired)

`ui/` contains the icon glyphs of the stake-upload HTML HUD (spin, autospin,
blitz/turbo, bonus-buy badge, einsatz-hoch/runter, noble-spin-logo). They are
copied for completeness but the Pixi HUD keeps its vector buttons for now:
several of these PNGs have baked black backgrounds and inconsistent sizes
(`spin.png` is 1536x1024), so they are not clean button textures. In the
stake-upload front they sit on CSS-styled buttons, whose dark/gold look the
vector HUD already mirrors.

## `special/` (copied, wiring pending on math)

`special/` (sponsor coins, multipliers, collector, golden-goal tiers) is
copied 1:1 from the stake-upload master for the planned "Golden Sponsor
Bonus". The features are not part of the `apps/lines` math/event contract
yet, so nothing references these files in game code — see
`documentation/sponsor-bonus-design.md` for the event contract and balancing
guardrails before wiring them up.
