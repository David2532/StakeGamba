import { WHITE } from 'constants-shared/colors';

export const UI_BASE_SIZE = 150;

// Golden Goal Rush HUD palette (black / gold, red bet accent) recreated in
// vector after the final game mockup — the generated sheets have no alpha
// channel, so shapes are drawn instead of shipping sprites.
export const UI_THEME = {
	panel: 0x0b0b10,
	panelInner: 0x16161d,
	gold: 0xd5a23b,
	goldBright: 0xffe49a,
	betRed: 0x8e1620,
	errorRed: 0xc81b2e,
	disabledFill: 0x232328,
	disabledBorder: 0x55555c,
	disabledText: 0x9a9aa1,
	textGold: 0xf4d276,
} as const;

export const UI_BASE_FONT_SIZE = UI_BASE_SIZE * 0.3;

export const UI_TEXT_STYLES = {
	labelStyle: {
		fontSize: UI_BASE_FONT_SIZE,
		fill: WHITE,
	},
	amountStyle: {
		fontSize: UI_BASE_FONT_SIZE,
		fill: WHITE,
	},
};

// desktop
export const DESKTOP_BASE_SIZE = UI_BASE_SIZE * 0.9;

export const DESKTOP_BACKGROUND_WIDTH_LIST = [
	DESKTOP_BASE_SIZE * (188 / 116),
	800,
	350,
	DESKTOP_BASE_SIZE * (340 / 116),
];

// portrait
export const PORTRAIT_BASE_SIZE = UI_BASE_SIZE * 1.32;

// landscape
export const LANDSCAPE_BASE_SIZE = UI_BASE_SIZE * 1.1;

export const LANDSCAPE_BACKGROUND_WIDTH_LIST = [
	LANDSCAPE_BASE_SIZE * (188 / 116),
	1000,
	LANDSCAPE_BASE_SIZE * (373 / 116),
];

// desktop
export const TABLET_BASE_SIZE = UI_BASE_SIZE * 1.2;

export const TABLET_BACKGROUND_WIDTH_LIST = [
	TABLET_BASE_SIZE * (188 / 116),
	650,
	350,
	TABLET_BASE_SIZE * (340 / 116),
];
