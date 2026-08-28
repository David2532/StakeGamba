export const REEL_COLUMNS = 5;
export const REEL_ROWS = 3;
export const PAYLINE_COUNT = 10;
export const FREE_SPIN_COUNT = 8;

export const REGULAR_SYMBOLS = Object.freeze([
	'operative',
	'encrypted_drive',
	'tactical_radio',
	'classified_folder',
	'night_vision_goggles',
	'supply_crate',
	'a',
	'k',
	'q',
	'j',
	'ten',
]);
export const WILD_SYMBOL = 'ghost_wild';
export const TRIGGER_SYMBOL = 'breach';
export const PAYING_SYMBOLS = Object.freeze([...REGULAR_SYMBOLS, WILD_SYMBOL]);
export const ALL_SYMBOLS = Object.freeze([...PAYING_SYMBOLS, TRIGGER_SYMBOL]);

export const PAYLINES = Object.freeze([
	Object.freeze([1, 1, 1, 1, 1]),
	Object.freeze([0, 0, 0, 0, 0]),
	Object.freeze([2, 2, 2, 2, 2]),
	Object.freeze([0, 1, 2, 1, 0]),
	Object.freeze([2, 1, 0, 1, 2]),
	Object.freeze([0, 0, 1, 2, 2]),
	Object.freeze([2, 2, 1, 0, 0]),
	Object.freeze([1, 0, 0, 0, 1]),
	Object.freeze([1, 2, 2, 2, 1]),
	Object.freeze([0, 1, 0, 1, 0]),
]);

export const LINE_PAYTABLE_RAW = Object.freeze({
	operative: Object.freeze({ 3: 25, 4: 250, 5: 1_000 }),
	encrypted_drive: Object.freeze({ 3: 15, 4: 150, 5: 750 }),
	tactical_radio: Object.freeze({ 3: 10, 4: 100, 5: 500 }),
	classified_folder: Object.freeze({ 3: 7, 4: 75, 5: 400 }),
	night_vision_goggles: Object.freeze({ 3: 5, 4: 50, 5: 250 }),
	supply_crate: Object.freeze({ 3: 4, 4: 40, 5: 200 }),
	a: Object.freeze({ 3: 3, 4: 30, 5: 150 }),
	k: Object.freeze({ 3: 2, 4: 20, 5: 100 }),
	q: Object.freeze({ 3: 2, 4: 15, 5: 75 }),
	j: Object.freeze({ 3: 1, 4: 10, 5: 50 }),
	ten: Object.freeze({ 3: 1, 4: 8, 5: 40 }),
	ghost_wild: Object.freeze({ 3: 100, 4: 2_500, 5: 125_000 }),
});

export const SYMBOL_DISPLAY_NAMES = Object.freeze({
	operative: 'OPERATIVE',
	encrypted_drive: 'ENCRYPTED DRIVE',
	tactical_radio: 'TACTICAL RADIO',
	classified_folder: 'CLASSIFIED FOLDER',
	night_vision_goggles: 'NIGHT VISION',
	supply_crate: 'SUPPLY CRATE',
	ghost_wild: 'GHOST WILD',
	breach: 'VAULT',
	a: 'A',
	k: 'K',
	q: 'Q',
	j: 'J',
	ten: '10',
});

export const DEEP_ACCESS_GUARANTEED_BREACH_POSITIONS = Object.freeze([
	Object.freeze({ column: 0, row: 1 }),
	Object.freeze({ column: 4, row: 1 }),
]);

export function cellKey(cell) {
	return `${cell.column},${cell.row}`;
}

export function compareCells(left, right) {
	return left.column - right.column || left.row - right.row;
}

export function linePayoutRaw(symbol, matchCount) {
	return LINE_PAYTABLE_RAW[symbol]?.[matchCount] ?? null;
}
