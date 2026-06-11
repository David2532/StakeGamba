# Golden Goal Rush — HUD assets

## Status of the generated HUD sheets (2026-06)

Six AI-generated HUD reference sheets were provided for the premium HUD pass
(buttons, frames, bonus/bet elements, win ribbons, InfoBook chrome, icons).
They were inspected before integration:

- **Format:** 1448x1086 PNG, 8-bit **RGB — no alpha channel**.
- The checkerboard "transparency" pattern and the asset labels
  (`spin_btn_idle`, `bonus_buy_btn_hover`, …) are **baked into the pixels**.

Because of that, clean per-asset extraction is **not feasible**: cropping would
keep the checkerboard background and label remnants, and removing them per
asset would require manual repainting. Shipping them directly is explicitly
ruled out (no checkerboards or labels may appear in the game UI).

## What was done instead

The sheets are used as **visual direction only**. The HUD is recreated with
vector primitives (Pixi `Graphics`/`Rectangle`/`Circle`) in
`packages/components-ui-pixi` using the shared `UI_THEME` palette
(black / gold / emerald / electric-blue) defined in
`packages/components-ui-pixi/src/constants.ts`.

The big-win ribbons (BIG / SUPER / MEGA / EPIC / MAX) already exist as Spine
animations (`assets/spines/bigwin`) and are kept.

## Future art drop-in

When clean, transparent, label-free PNGs are produced, place them in the
subfolders below using these base names, then swap the vector shapes for
sprites in the matching components:

- `frames/`: `hud_bottom_bar_bg`, `hud_top_panel_bg`, `hud_center_win_frame`,
  `hud_balance_frame`, `hud_bet_frame`, `hud_multiplier_frame`,
  `hud_feature_banner_frame`
- `buttons/`: `spin_btn_idle|hover|pressed|disabled`, `spin_btn_glow`,
  `spin_btn_spinning_ring`, `spin_icon_arrow`, `auto_btn_idle|active|disabled`,
  `turbo_btn_idle|active|disabled`, `menu_btn`, `info_btn`, `settings_btn`,
  `sound_btn_on|off`
- `bonus/`: `bonus_buy_btn_idle|hover|pressed|disabled|glow`, `bonus_badge`,
  `free_spins_banner`, `golden_goal_banner`
- `bet/`: `bet_minus_btn_idle|hover|pressed`, `bet_plus_btn_idle|hover|pressed`,
  `bet_value_pill`
- `win/`: `win_counter_frame`, `big_win_ribbon`, `mega_win_ribbon`,
  `epic_win_ribbon`, `coin_burst_overlay`, `spark_glow_overlay`,
  `pulse_ring_overlay`, `error_red_flash_overlay`
- `infobook/`: `infobook_modal_bg`, `infobook_tab_idle|active`, `close_btn`,
  `arrow_left_btn`, `arrow_right_btn`, `tooltip_frame`
- `icons/`: `icon_coin`, `icon_bolt`, `icon_whistle`, `icon_ball`,
  `icon_trophy`, `icon_wild_star`, `icon_scatter`, `icon_collect`
- `atlas/`: atlas JSON + sheet if an atlas pipeline is preferred over
  individual PNGs
