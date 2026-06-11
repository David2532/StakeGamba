/**
 * Manifest for assets extracted from the generated 4K asset-sheets.
 * Raw sheets: apps/lines/src/assets/golden-goal-rush/generated/raw/
 * Extracted elements: apps/lines/src/assets/golden-goal-rush/generated/{ui,buttons,features,...}
 * Vite-resolved paths (work under /StakeGamba/). In-game loader keys live in ../assets.ts (ggr-*).
 */
const u = (p: string) => new URL(`../../assets/golden-goal-rush/generated/${p}`, import.meta.url).href;

export const generatedAssets = {
	hud: {
		panelFull: u('ui/hud_panel_full.png'),
		buttonSpin: u('buttons/button_spin.png'),
		buttonBonusBuy: u('buttons/button_bonus_buy.png'),
		buttonAuto: u('buttons/button_auto.png'),
		buttonTurbo: u('buttons/button_turbo.png'),
		buttonPlus: u('buttons/button_plus.png'),
		buttonMinus: u('buttons/button_minus.png'),
	},
	raw: {
		hud: u('raw/sheet_hud.png'),
		uiSmall: u('raw/sheet_ui_small.png'),
		panels: u('raw/sheet_panels.png'),
		fxTypo: u('raw/sheet_fx_typo.png'),
		featureSymbols: u('raw/sheet_feature_symbols.png'),
		boardTiles: u('raw/sheet_board_tiles.png'),
	},
} as const;

export default generatedAssets;
