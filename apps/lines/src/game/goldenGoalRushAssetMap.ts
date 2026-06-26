const GOLDEN_GOAL_RUSH_ASSET_BASE = '/assets/golden-goal-rush';

const assetUrl = (path: string) => `${GOLDEN_GOAL_RUSH_ASSET_BASE}/${path}`;

// LIVE symbols are only the top-level symbol-* files. The backup_originals
// directory is kept for audit/rollback and is intentionally never loaded.
export const goldenGoalRushBackupOriginalPaths = [
	'backup_originals/symbol-h1.webp',
	'backup_originals/symbol-h2.webp',
	'backup_originals/symbol-h3.webp',
	'backup_originals/symbol-h4.webp',
	'backup_originals/symbol-l1.webp',
	'backup_originals/symbol-l2.webp',
	'backup_originals/symbol-l3.webp',
	'backup_originals/symbol-l4.webp',
	'backup_originals/symbol-l5.webp',
	'backup_originals/symbol-s.webp',
	'backup_originals/symbol-w.webp',
] as const;

export const goldenGoalRushSkippedAliasPaths = [
	'10.webp',
	'a.webp',
	'fussball.webp',
	'j.webp',
	'k.webp',
	'pfeife.webp',
	'pokal.webp',
	'q.webp',
	'scatter.webp',
	'trikot.webp',
	'wild.webp',
] as const;

export const goldenGoalRushAssetMap = {
	backgrounds: {
		stadium: assetUrl('slot-background.webp'),
	},
	branding: {
		logoHorizontal: assetUrl('logo-horizontal.webp'),
		standaloneSpin: assetUrl('spin.webp'),
	},
	symbols: {
		H1: assetUrl('symbol-h1.webp'),
		H2: assetUrl('symbol-h2.webp'),
		H3: assetUrl('symbol-h3.webp'),
		H4: assetUrl('symbol-h4.webp'),
		L1: assetUrl('symbol-l1.webp'),
		L2: assetUrl('symbol-l2.webp'),
		L3: assetUrl('symbol-l3.webp'),
		L4: assetUrl('symbol-l4.webp'),
		L5: assetUrl('symbol-l5.webp'),
		S: assetUrl('symbol-s.webp'),
		W: assetUrl('symbol-w.webp'),
	},
	hud: {
		autoSpinButton: assetUrl('hud-extracted/autospin-button.webp'),
		betStepperFrame: assetUrl('hud-extracted/hud-bet-stepper-frame-empty.webp'),
		bonusButton: assetUrl('hud-extracted/bonus-button.webp'),
		bottomBarFrame: assetUrl('hud-extracted/bottom-bar-frame.webp'),
		controlPanelWide: assetUrl('hud-extracted/control-panel-wide.webp'),
		featureBannerWide: assetUrl('hud-extracted/feature-banner-wide.webp'),
		featurePanel: assetUrl('hud-extracted/feature-panel.webp'),
		hudPanelSmall: assetUrl('hud-extracted/hud_panel_small_empty.webp'),
		hudPanelWide: assetUrl('hud-extracted/hud_panel_wide_empty.webp'),
		infoButton: assetUrl('hud-extracted/info-button.webp'),
		menuButton: assetUrl('hud-extracted/menu-button.webp'),
		meterPanelA: assetUrl('hud-extracted/meter-panel-a.webp'),
		meterPanelB: assetUrl('hud-extracted/meter-panel-b.webp'),
		meterPanelC: assetUrl('hud-extracted/meter-panel-c.webp'),
		minusButton: assetUrl('hud-extracted/minus-button.webp'),
		pillFrame: assetUrl('hud-extracted/pill-frame.webp'),
		playRoundButton: assetUrl('hud-extracted/play-round-button.webp'),
		plusButton: assetUrl('hud-extracted/plus-button.webp'),
		reelFrameGold: assetUrl('hud-extracted/reel-frame-gold-empty.webp'),
		settingsButton: assetUrl('hud-extracted/settings-button.webp'),
		spinButton: assetUrl('hud-extracted/spin-button.webp'),
		spinButtonActive: assetUrl('hud-extracted/spin-button-active.webp'),
		turboButton: assetUrl('hud-extracted/turbo-button.webp'),
		waysBadge: assetUrl('hud-extracted/ways-badge-empty.webp'),
		winBannerWide: assetUrl('hud-extracted/win-banner-wide.webp'),
	},
	ui: {
		autoSpin: assetUrl('ui/autospin.webp'),
		blitz: assetUrl('ui/blitz.webp'),
		bonusBuy: assetUrl('ui/bonus-buy.webp'),
		betUp: assetUrl('ui/einsatz-hoch.webp'),
		betDown: assetUrl('ui/einsatz-runter.webp'),
		nobleSpinLogo: assetUrl('ui/noble-spin-logo.webp'),
		spin: assetUrl('ui/spin.webp'),
	},
	special: {
		symbols: {
			collector: assetUrl('special/symbol_collector.webp'),
			multiplier: assetUrl('special/symbol_multiplier.webp'),
			rainbow: assetUrl('special/symbol_rainbow.webp'),
		},
		collectors: {
			bronze: assetUrl('special/bronze.webp'),
			collector: assetUrl('special/collector.webp'),
			gold: assetUrl('special/gold.webp'),
			rainbow: assetUrl('special/rainbow.webp'),
			silver: assetUrl('special/silber.webp'),
		},
		coins: {
			'0_2x': assetUrl('special/coin_0_2x.webp'),
			'0_5x': assetUrl('special/coin_0_5x.webp'),
			'1x': assetUrl('special/coin_1x.webp'),
			'2x': assetUrl('special/coin_2x.webp'),
			'3x': assetUrl('special/coin_3x.webp'),
			'4x': assetUrl('special/coin_4x.webp'),
			'5x': assetUrl('special/coin_5x.webp'),
			'10x': assetUrl('special/coin_10x.webp'),
			'15x': assetUrl('special/coin_15x.webp'),
			'20x': assetUrl('special/coin_20x.webp'),
			'25x': assetUrl('special/coin_25x.webp'),
			'50x': assetUrl('special/coin_50x.webp'),
			'100x': assetUrl('special/coin_100x.webp'),
			'250x': assetUrl('special/coin_250x.webp'),
			'500x': assetUrl('special/coin_500x.webp'),
		},
		multipliers: {
			'0_2x': assetUrl('special/0.2x.webp'),
			'0_5x': assetUrl('special/0.5x.webp'),
			'1x': assetUrl('special/1x.webp'),
			'2x': assetUrl('special/2x.webp'),
			'4x': assetUrl('special/4x.webp'),
			'5x': assetUrl('special/5x.webp'),
			'10x': assetUrl('special/10x.webp'),
			'15x': assetUrl('special/15x.webp'),
			'20x': assetUrl('special/20x.webp'),
			'25x': assetUrl('special/25x.webp'),
			'50x': assetUrl('special/50x.webp'),
			'100x': assetUrl('special/100x.webp'),
			'250x': assetUrl('special/250x.webp'),
			'500x': assetUrl('special/500x.webp'),
		},
		xBadges: {
			x2: assetUrl('special/x2.webp'),
			x3: assetUrl('special/x3.webp'),
			x4: assetUrl('special/x4.webp'),
			x5: assetUrl('special/x5.webp'),
			x10: assetUrl('special/x10.webp'),
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
