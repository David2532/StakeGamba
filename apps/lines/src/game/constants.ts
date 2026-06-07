import _ from 'lodash';

import type { RawSymbol, SymbolState } from './types';

export const SYMBOL_SIZE = 120;

export const REEL_PADDING = 0.53;

// initial board (padded top and bottom)
export const INITIAL_BOARD: RawSymbol[][] = [
	[
		{
			name: 'L2',
		},
		{
			name: 'L1',
		},
		{
			name: 'L4',
		},
		{
			name: 'H2',
		},
		{
			name: 'L1',
		},
	],
	[
		{
			name: 'H1',
		},
		{
			name: 'L5',
		},
		{
			name: 'L2',
		},
		{
			name: 'H3',
		},
		{
			name: 'L4',
		},
	],
	[
		{
			name: 'L3',
		},
		{
			name: 'L5',
		},
		{
			name: 'L3',
		},
		{
			name: 'H4',
		},
		{
			name: 'L4',
		},
	],
	[
		{
			name: 'H4',
		},
		{
			name: 'H3',
		},
		{
			name: 'L4',
		},
		{
			name: 'L5',
		},
		{
			name: 'L1',
		},
	],
	[
		{
			name: 'H3',
		},
		{
			name: 'L3',
		},
		{
			name: 'L3',
		},
		{
			name: 'H1',
		},
		{
			name: 'H1',
		},
	],
];

export const BOARD_DIMENSIONS = { x: INITIAL_BOARD.length, y: INITIAL_BOARD[0].length - 2 };

export const BOARD_SIZES = {
	width: SYMBOL_SIZE * BOARD_DIMENSIONS.x,
	height: SYMBOL_SIZE * BOARD_DIMENSIONS.y,
};

export const BACKGROUND_RATIO = 2039 / 1000;
export const PORTRAIT_BACKGROUND_RATIO = 1242 / 2208;
const PORTRAIT_RATIO = 800 / 1422;
const LANDSCAPE_RATIO = 1600 / 900;
const DESKTOP_RATIO = 1422 / 800;

const DESKTOP_HEIGHT = 800;
const LANDSCAPE_HEIGHT = 900;
const PORTRAIT_HEIGHT = 1422;
export const DESKTOP_MAIN_SIZES = { width: DESKTOP_HEIGHT * DESKTOP_RATIO, height: DESKTOP_HEIGHT };
export const LANDSCAPE_MAIN_SIZES = {
	width: LANDSCAPE_HEIGHT * LANDSCAPE_RATIO,
	height: LANDSCAPE_HEIGHT,
};
export const PORTRAIT_MAIN_SIZES = {
	width: PORTRAIT_HEIGHT * PORTRAIT_RATIO,
	height: PORTRAIT_HEIGHT,
};

export const HIGH_SYMBOLS = ['H1', 'H2', 'H3', 'H4', 'H5'];

export const INITIAL_SYMBOL_STATE: SymbolState = 'static';

const HIGH_SYMBOL_SIZE = 0.9;
const LOW_SYMBOL_SIZE = 0.9;
const SPECIAL_SYMBOL_SIZE = 1;

const SPIN_OPTIONS_SHARED = {
	reelBounceBackSpeed: 0.15,
	reelSpinSpeedBeforeBounce: 4,
	reelPaddingMultiplierNormal: 1.2,
	reelPaddingMultiplierAnticipated: 10,
	reelSpinDelay: 145,
};

export const SPIN_OPTIONS_DEFAULT = {
	...SPIN_OPTIONS_SHARED,
	reelPreSpinSpeed: 2,
	reelSpinSpeed: 3,
	reelBounceSizeMulti: 0.3,
};

export const SPIN_OPTIONS_FAST = {
	...SPIN_OPTIONS_SHARED,
	reelPreSpinSpeed: 5,
	reelSpinSpeed: 5,
	reelBounceSizeMulti: 0.05,
};

export const MOTION_BLUR_VELOCITY = 31;

export const zIndexes = {
	background: {
		backdrop: -3,
		normal: -2,
		feature: -1,
	},
};

const explosion = {
	type: 'spine',
	assetKey: 'explosion',
	animationName: 'explosion',
	sizeRatios: { width: 1, height: 1 },
};

// Golden Goal Rush placeholder football symbols (see scripts/generate-placeholder-assets.mjs).
// Keys map to the ggr* sprite assets registered in assets.ts. Symbol IDs are unchanged.
// All visible symbol states (static/spin/land/win/postWinStatic) use the football sprites;
// only `explosion` keeps the shared spine burst (generic, no mining branding) for timing safety.
const ggr = (assetKey: string, scale = 1) => ({
	type: 'sprite' as const,
	assetKey,
	sizeRatios: { width: scale, height: scale },
});

const footballSymbol = (assetKey: string, scale = 1) => ({
	explosion,
	win: ggr(assetKey, scale),
	postWinStatic: ggr(assetKey, scale),
	static: ggr(assetKey, scale),
	spin: ggr(assetKey, scale),
	land: ggr(assetKey, scale),
});

export const SYMBOL_INFO_MAP = {
	H1: footballSymbol('ggrH1'),
	H2: footballSymbol('ggrH2'),
	H3: footballSymbol('ggrH3'),
	H4: footballSymbol('ggrH4'),
	H5: footballSymbol('ggrH4'),
	L1: footballSymbol('ggrL1'),
	L2: footballSymbol('ggrL2'),
	L3: footballSymbol('ggrL3'),
	L4: footballSymbol('ggrL4'),
	L5: footballSymbol('ggrL5'),
	W: footballSymbol('ggrW', 1.08),
	S: footballSymbol('ggrS', 1.08),
} as const;

export const SCATTER_LAND_SOUND_MAP = {
	1: 'sfx_scatter_stop_1',
	2: 'sfx_scatter_stop_2',
	3: 'sfx_scatter_stop_3',
	4: 'sfx_scatter_stop_4',
	5: 'sfx_scatter_stop_5',
} as const;
