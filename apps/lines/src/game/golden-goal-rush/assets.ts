/**
 * Golden Goal Rush — asset manifest for elements extracted from the generated asset-sheets.
 * Raw sheets live in apps/lines/src/assets/golden-goal-rush/raw/.
 * Individual elements were content-segmented out of the sheets (pure-Node pipeline) into
 * apps/lines/src/assets/golden-goal-rush/{features,board,ui,panels,fx,typo}/.
 *
 * Paths use new URL(..., import.meta.url) so Vite resolves them base-aware (works under /StakeGamba/).
 * These are convenience URLs; the in-game loader keys are registered in ../assets.ts (ggr-*).
 */
const u = (p: string) => new URL(`../../assets/golden-goal-rush/${p}`, import.meta.url).href;

export const goldenGoalRushAssets = {
	feature: {
		coinBronze: u('features/coin_bronze.png'),
		coinSilver: u('features/coin_silver.png'),
		coinGold: u('features/coin_gold.png'),
		rainbowGoal: u('features/coin_rainbow_goal.png'),
		goalBooster: u('features/goal_booster.png'),
		trophyCollector: u('features/trophy_collector.png'),
		scatter: u('features/scatter.png'),
		wild: u('features/wild.png'),
		multiplier: {
			x2: u('features/multiplier_x2.png'),
			x3: u('features/multiplier_x3.png'),
			x5: u('features/multiplier_x5.png'),
			x10: u('features/multiplier_x10.png'),
			x20: u('features/multiplier_x20.png'),
		},
		valueBadge: {
			1: u('features/value_badge_1.png'),
			2: u('features/value_badge_2.png'),
			5: u('features/value_badge_5.png'),
			10: u('features/value_badge_10.png'),
			20: u('features/value_badge_20.png'),
			50: u('features/value_badge_50.png'),
			100: u('features/value_badge_100.png'),
			500: u('features/value_badge_500.png'),
		},
	},
	raw: {
		featureSymbols: u('raw/sheet_feature_symbols.png'),
		boardTiles: u('raw/sheet_board_tiles.png'),
		hud: u('raw/sheet_hud.png'),
		uiSmall: u('raw/sheet_ui_small.png'),
		panels: u('raw/sheet_panels.png'),
		fxTypo: u('raw/sheet_fx_typo.png'),
	},
} as const;

export default goldenGoalRushAssets;
