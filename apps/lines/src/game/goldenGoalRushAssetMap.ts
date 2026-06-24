const GOLDEN_GOAL_RUSH_ASSET_BASE = '/assets/golden-goal-rush';

const assetUrl = (path: string) => `${GOLDEN_GOAL_RUSH_ASSET_BASE}/${path}`;

// LIVE symbols are only the top-level symbol-* files. The backup_originals
// directory is kept for audit/rollback and is intentionally never loaded.
export const goldenGoalRushBackupOriginalPaths = [
	'backup_originals/symbol-h1.png',
	'backup_originals/symbol-h2.png',
	'backup_originals/symbol-h3.png',
	'backup_originals/symbol-h4.png',
	'backup_originals/symbol-l1.png',
	'backup_originals/symbol-l2.png',
	'backup_originals/symbol-l3.png',
	'backup_originals/symbol-l4.png',
	'backup_originals/symbol-l5.png',
	'backup_originals/symbol-s.png',
	'backup_originals/symbol-w.png',
] as const;

export const goldenGoalRushSkippedAliasPaths = [
	'10.png',
	'a.png',
	'fussball.png',
	'j.png',
	'k.png',
	'pfeife.png',
	'pokal.png',
	'q.png',
	'scatter.png',
	'trikot.png',
	'wild.png',
] as const;

export const goldenGoalRushAssetMap = {
	backgrounds: {
		stadium: assetUrl('slot-background.png'),
	},
	branding: {
		logoHorizontal: assetUrl('logo-horizontal.png'),
		standaloneSpin: assetUrl('spin.png'),
	},
	symbols: {
		H1: assetUrl('symbol-h1.png'),
		H2: assetUrl('symbol-h2.png'),
		H3: assetUrl('symbol-h3.png'),
		H4: assetUrl('symbol-h4.png'),
		L1: assetUrl('symbol-l1.png'),
		L2: assetUrl('symbol-l2.png'),
		L3: assetUrl('symbol-l3.png'),
		L4: assetUrl('symbol-l4.png'),
		L5: assetUrl('symbol-l5.png'),
		S: assetUrl('symbol-s.png'),
		W: assetUrl('symbol-w.png'),
	},
	hud: {
		autoSpinButton: assetUrl('hud-extracted/autospin-button.png'),
		betStepperFrame: assetUrl('hud-extracted/hud-bet-stepper-frame-empty.png'),
		bonusButton: assetUrl('hud-extracted/bonus-button.png'),
		bottomBarFrame: assetUrl('hud-extracted/bottom-bar-frame.png'),
		controlPanelWide: assetUrl('hud-extracted/control-panel-wide.png'),
		featureBannerWide: assetUrl('hud-extracted/feature-banner-wide.png'),
		featurePanel: assetUrl('hud-extracted/feature-panel.png'),
		hudPanelSmall: assetUrl('hud-extracted/hud_panel_small_empty.png'),
		hudPanelWide: assetUrl('hud-extracted/hud_panel_wide_empty.png'),
		infoButton: assetUrl('hud-extracted/info-button.png'),
		menuButton: assetUrl('hud-extracted/menu-button.png'),
		meterPanelA: assetUrl('hud-extracted/meter-panel-a.png'),
		meterPanelB: assetUrl('hud-extracted/meter-panel-b.png'),
		meterPanelC: assetUrl('hud-extracted/meter-panel-c.png'),
		minusButton: assetUrl('hud-extracted/minus-button.png'),
		pillFrame: assetUrl('hud-extracted/pill-frame.png'),
		playRoundButton: assetUrl('hud-extracted/play-round-button.png'),
		plusButton: assetUrl('hud-extracted/plus-button.png'),
		reelFrameGold: assetUrl('hud-extracted/reel-frame-gold-empty.png'),
		settingsButton: assetUrl('hud-extracted/settings-button.png'),
		spinButton: assetUrl('hud-extracted/spin-button.png'),
		spinButtonActive: assetUrl('hud-extracted/spin-button-active.png'),
		turboButton: assetUrl('hud-extracted/turbo-button.png'),
		waysBadge: assetUrl('hud-extracted/ways-badge-empty.png'),
		winBannerWide: assetUrl('hud-extracted/win-banner-wide.png'),
	},
	ui: {
		autoSpin: assetUrl('ui/autospin.png'),
		blitz: assetUrl('ui/blitz.png'),
		bonusBuy: assetUrl('ui/bonus-buy.png'),
		betUp: assetUrl('ui/einsatz-hoch.png'),
		betDown: assetUrl('ui/einsatz-runter.png'),
		nobleSpinLogo: assetUrl('ui/noble-spin-logo.png'),
		spin: assetUrl('ui/spin.png'),
	},
	special: {
		symbols: {
			collector: assetUrl('special/symbol_collector.png'),
			multiplier: assetUrl('special/symbol_multiplier.png'),
			rainbow: assetUrl('special/symbol_rainbow.png'),
		},
		collectors: {
			bronze: assetUrl('special/bronze.png'),
			collector: assetUrl('special/collector.png'),
			gold: assetUrl('special/gold.png'),
			rainbow: assetUrl('special/rainbow.png'),
			silver: assetUrl('special/silber.png'),
		},
		coins: {
			'0_2x': assetUrl('special/coin_0_2x.png'),
			'0_5x': assetUrl('special/coin_0_5x.png'),
			'1x': assetUrl('special/coin_1x.png'),
			'2x': assetUrl('special/coin_2x.png'),
			'3x': assetUrl('special/coin_3x.png'),
			'4x': assetUrl('special/coin_4x.png'),
			'5x': assetUrl('special/coin_5x.png'),
			'10x': assetUrl('special/coin_10x.png'),
			'15x': assetUrl('special/coin_15x.png'),
			'20x': assetUrl('special/coin_20x.png'),
			'25x': assetUrl('special/coin_25x.png'),
			'50x': assetUrl('special/coin_50x.png'),
			'100x': assetUrl('special/coin_100x.png'),
			'250x': assetUrl('special/coin_250x.png'),
			'500x': assetUrl('special/coin_500x.png'),
		},
		multipliers: {
			'0_2x': assetUrl('special/0.2x.png'),
			'0_5x': assetUrl('special/0.5x.png'),
			'1x': assetUrl('special/1x.png'),
			'2x': assetUrl('special/2x.png'),
			'4x': assetUrl('special/4x.png'),
			'5x': assetUrl('special/5x.png'),
			'10x': assetUrl('special/10x.png'),
			'15x': assetUrl('special/15x.png'),
			'20x': assetUrl('special/20x.png'),
			'25x': assetUrl('special/25x.png'),
			'50x': assetUrl('special/50x.png'),
			'100x': assetUrl('special/100x.png'),
			'250x': assetUrl('special/250x.png'),
			'500x': assetUrl('special/500x.png'),
		},
		xBadges: {
			x2: assetUrl('special/x2.png'),
			x3: assetUrl('special/x3.png'),
			x4: assetUrl('special/x4.png'),
			x5: assetUrl('special/x5.png'),
			x10: assetUrl('special/x10.png'),
		},
	},
} as const;

export const goldenGoalRushStaticAssetUrls = [
	goldenGoalRushAssetMap.backgrounds.stadium,
	...Object.values(goldenGoalRushAssetMap.branding),
	...Object.values(goldenGoalRushAssetMap.symbols),
	...Object.values(goldenGoalRushAssetMap.hud),
	...Object.values(goldenGoalRushAssetMap.ui),
	...Object.values(goldenGoalRushAssetMap.special.symbols),
	...Object.values(goldenGoalRushAssetMap.special.collectors),
	...Object.values(goldenGoalRushAssetMap.special.coins),
	...Object.values(goldenGoalRushAssetMap.special.multipliers),
	...Object.values(goldenGoalRushAssetMap.special.xBadges),
] as const;

export const goldenGoalRushPixiAssets = {
	'ggr-l1': {
		type: 'sprite',
		src: goldenGoalRushAssetMap.symbols.L1,
	},
	'ggr-l2': {
		type: 'sprite',
		src: goldenGoalRushAssetMap.symbols.L2,
	},
	'ggr-l3': {
		type: 'sprite',
		src: goldenGoalRushAssetMap.symbols.L3,
	},
	'ggr-l4': {
		type: 'sprite',
		src: goldenGoalRushAssetMap.symbols.L4,
	},
	'ggr-l5': {
		type: 'sprite',
		src: goldenGoalRushAssetMap.symbols.L5,
	},
	'ggr-h1': {
		type: 'sprite',
		src: goldenGoalRushAssetMap.symbols.H1,
	},
	'ggr-h2': {
		type: 'sprite',
		src: goldenGoalRushAssetMap.symbols.H2,
	},
	'ggr-h3': {
		type: 'sprite',
		src: goldenGoalRushAssetMap.symbols.H3,
	},
	'ggr-h4': {
		type: 'sprite',
		src: goldenGoalRushAssetMap.symbols.H4,
	},
	'ggr-w': {
		type: 'sprite',
		src: goldenGoalRushAssetMap.symbols.W,
	},
	'ggr-s': {
		type: 'sprite',
		src: goldenGoalRushAssetMap.symbols.S,
	},
	slotBackground: {
		type: 'sprite',
		src: goldenGoalRushAssetMap.backgrounds.stadium,
		preload: true,
	},
} as const;

export const goldenGoalRushSixByFivePreviewPixiAssets = {
	...goldenGoalRushPixiAssets,
	'ggr-preview-logo': {
		type: 'sprite',
		src: goldenGoalRushAssetMap.branding.logoHorizontal,
		preload: true,
	},
	'ggr-preview-reel-frame': {
		type: 'sprite',
		src: goldenGoalRushAssetMap.hud.reelFrameGold,
		preload: true,
	},
	'ggr-preview-hud-wide': {
		type: 'sprite',
		src: goldenGoalRushAssetMap.hud.hudPanelWide,
	},
	'ggr-preview-hud-small': {
		type: 'sprite',
		src: goldenGoalRushAssetMap.hud.hudPanelSmall,
	},
	'ggr-preview-bet-stepper': {
		type: 'sprite',
		src: goldenGoalRushAssetMap.hud.betStepperFrame,
	},
	'ggr-preview-ways-badge': {
		type: 'sprite',
		src: goldenGoalRushAssetMap.hud.waysBadge,
	},
	'ggr-preview-spin-button': {
		type: 'sprite',
		src: goldenGoalRushAssetMap.hud.spinButton,
	},
	'ggr-preview-bonus-buy': {
		type: 'sprite',
		src: goldenGoalRushAssetMap.ui.bonusBuy,
	},
	'ggr-preview-bet-up': {
		type: 'sprite',
		src: goldenGoalRushAssetMap.hud.plusButton,
	},
	'ggr-preview-bet-down': {
		type: 'sprite',
		src: goldenGoalRushAssetMap.hud.minusButton,
	},
	'ggr-preview-autospin': {
		type: 'sprite',
		src: goldenGoalRushAssetMap.ui.autoSpin,
	},
	'ggr-preview-turbo': {
		type: 'sprite',
		src: goldenGoalRushAssetMap.ui.blitz,
	},
	'ggr-preview-menu': {
		type: 'sprite',
		src: goldenGoalRushAssetMap.hud.menuButton,
	},
	'ggr-preview-info': {
		type: 'sprite',
		src: goldenGoalRushAssetMap.hud.infoButton,
	},
	'ggr-preview-settings': {
		type: 'sprite',
		src: goldenGoalRushAssetMap.hud.settingsButton,
	},
} as const;
