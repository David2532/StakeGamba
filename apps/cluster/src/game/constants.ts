import _ from 'lodash';

import type { RawSymbol, SymbolState } from './types';

// Sized so the 6x5 Golden Goal Rush board fills the 1422x800 main layout
// like the final mockup.
export const SYMBOL_SIZE = 112;

export const REEL_PADDING = 0.53;

// initial board (padded top and bottom)
export const INITIAL_BOARD: RawSymbol[][] = [
	[{ name: 'L1' }, { name: 'H1' }, { name: 'L5' }, { name: 'L2' }, { name: 'L3' }, { name: 'H3' }, { name: 'L4' }],
	[{ name: 'L2' }, { name: 'L5' }, { name: 'H2' }, { name: 'L1' }, { name: 'L4' }, { name: 'L3' }, { name: 'H4' }],
	[{ name: 'L3' }, { name: 'H4' }, { name: 'L2' }, { name: 'L5' }, { name: 'H1' }, { name: 'L1' }, { name: 'L2' }],
	[{ name: 'H2' }, { name: 'L3' }, { name: 'L1' }, { name: 'L4' }, { name: 'L2' }, { name: 'H3' }, { name: 'L5' }],
	[{ name: 'L4' }, { name: 'L2' }, { name: 'H3' }, { name: 'L3' }, { name: 'L5' }, { name: 'L1' }, { name: 'H1' }],
	[{ name: 'L5' }, { name: 'H1' }, { name: 'L4' }, { name: 'L1' }, { name: 'L2' }, { name: 'H2' }, { name: 'L3' }],
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

const M_SIZE = 0.3;
const HIGH_SYMBOL_SIZE = 0.9;
const LOW_SYMBOL_SIZE = 0.9;
const SPECIAL_SYMBOL_SIZE = 1;

const SPIN_OPTIONS_SHARED = {
	reelFallInDelay: 80,
	reelPaddingMultiplierNormal: 1.25,
	reelPaddingMultiplierAnticipated: 18,
	reelFallOutDelay: 145,
};

export const SPIN_OPTIONS_DEFAULT = {
	...SPIN_OPTIONS_SHARED,
	symbolFallInSpeed: 3.5,
	symbolFallInInterval: 30,
	symbolFallInBounceSpeed: 0.15,
	symbolFallInBounceSizeMulti: 0.5,
	symbolFallOutSpeed: 3.5,
	symbolFallOutInterval: 20,
};

export const SPIN_OPTIONS_FAST = {
	...SPIN_OPTIONS_SHARED,
	symbolFallInSpeed: 7,
	symbolFallInInterval: 0,
	symbolFallInBounceSpeed: 0.3,
	symbolFallInBounceSizeMulti: 0.25,
	symbolFallOutSpeed: 7,
	symbolFallOutInterval: 0,
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

// Golden Goal Rush final art (stake-upload master). All states render the
// final sprites; the win pop/glow is handled by SymbolSprite.
const GGR_SYMBOL_SIZE = 0.92;
const GGR_FEATURE_SIZE = 1;

const makeStatic = (assetKey: string, size = GGR_SYMBOL_SIZE) =>
	({ type: 'sprite', assetKey, sizeRatios: { width: size, height: size } }) as const;

const symbolStates = (assetKey: string, size = GGR_SYMBOL_SIZE) => {
	const staticInfo = makeStatic(assetKey, size);
	return {
		explosion,
		win: staticInfo,
		postWinStatic: staticInfo,
		static: staticInfo,
		spin: staticInfo,
		land: staticInfo,
	} as const;
};

export const SYMBOL_INFO_MAP = {
	H1: symbolStates('ggr-h1'),
	H2: symbolStates('ggr-h2'),
	H3: symbolStates('ggr-h3'),
	H4: symbolStates('ggr-h4'),
	L1: symbolStates('ggr-l1'),
	L2: symbolStates('ggr-l2'),
	L3: symbolStates('ggr-l3'),
	L4: symbolStates('ggr-l4'),
	L5: symbolStates('ggr-l5'),
	W: symbolStates('ggr-w', GGR_FEATURE_SIZE),
	S: symbolStates('ggr-s', GGR_FEATURE_SIZE),
	RB: symbolStates('ggr-rb', GGR_FEATURE_SIZE),
	CL: symbolStates('ggr-cl', GGR_FEATURE_SIZE),
} as const;

export const SCATTER_LAND_SOUND_MAP = {
	1: 'sfx_scatter_stop_1',
	2: 'sfx_scatter_stop_2',
	3: 'sfx_scatter_stop_3',
	4: 'sfx_scatter_stop_4',
	5: 'sfx_scatter_stop_5',
} as const;
