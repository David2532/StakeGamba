# Golden Goal Rush Assets

These files support the static Storybook visual direction for Golden Goal
Rush in `apps/cluster`. They are not Math output and they are not a regulatory
RTP package.

## Active Preview Assets

| Use                      | File                                                    |
| ------------------------ | ------------------------------------------------------- |
| Stadium background       | `slot-background.png`                                   |
| Logo source              | `logo-horizontal.png`                                   |
| Low symbols              | `10.png`, `j.png`, `q.png`, `k.png`, `a.png`            |
| High symbols             | `fussball.png`, `pokal.png`, `trikot.png`, `pfeife.png` |
| Feature symbols          | `wild.png`, `scatter.png`, `special/symbol_collector.png`, `special/symbol_multiplier.png` |
| HUD/button reference art | `ui/*.png`                                              |
| Extracted HUD assets     | `hud-extracted/*.png`                                   |

## Symbol Intent

| ID  | Visual   |
| --- | -------- |
| L1  | 10       |
| L2  | J        |
| L3  | Q        |
| L4  | K        |
| L5  | A        |
| H1  | Football |
| H2  | Trophy   |
| H3  | Jersey   |
| H4  | Whistle  |
| W   | Wild     |
| S   | Scatter  |

## Prepared Only

`logo-horizontal.png` is kept as source art, but the static preview renders a
cleaner CSS wordmark because the source image has large transparent padding.

`hud-extracted/` contains transparent crops from the provided HUD/frame/button
PNG sheets. The preview uses these files as visible panel and button art, with
text and values layered over them.

`special/` contains coin, multiplier, collector, and bonus reference assets.
The static Storybook preview uses collector and multiplier art for Phase 8B
visual feedback only. Any production runtime use still needs the Math/event
contract review documented under `math/games/golden_goal_rush/feature_contract.py`.
