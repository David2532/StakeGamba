export const BLACKSITE_UI_V21_ROOT = 'v21/ui-kit';

export const BLACKSITE_UI_V21_STATES = Object.freeze([
	'idle',
	'hover',
	'pressed',
	'focus',
	'selected',
	'disabled',
	'danger',
]);

export const BLACKSITE_UI_V21_STATE_PRECEDENCE = Object.freeze([
	'disabled',
	'danger',
	'pressed',
	'focus',
	'selected',
	'hover',
	'idle',
]);

export const BLACKSITE_UI_V21_GLYPHS = Object.freeze([
	'menu',
	'buy',
	'auto',
	'minus',
	'plus',
	'spin',
	'turbo',
	'info',
	'settings',
	'close',
	'resume',
	'warning',
	'chevron-down',
	'check',
	'lock',
	'audio',
]);

const GLYPH_ROWS = Object.freeze([
	'idle',
	'hover-focus',
	'pressed-selected',
	'disabled',
	'danger',
]);

const GLYPH_STATE_ROW = Object.freeze({
	idle: 'idle',
	hover: 'hover-focus',
	focus: 'hover-focus',
	pressed: 'pressed-selected',
	selected: 'pressed-selected',
	disabled: 'disabled',
	danger: 'danger',
});

const GLYPH_ALIASES = Object.freeze({
	shop: 'buy',
	warn: 'warning',
	chevron: 'chevron-down',
	sound: 'audio',
});

function freezeBox(top, right, bottom, left) {
	return Object.freeze({ top, right, bottom, left });
}

function atlasCell(index, count, cellWidth, cellHeight, row = 0) {
	return Object.freeze({
		column: index,
		row,
		x: index * cellWidth,
		y: row * cellHeight,
		positionXPercent: count > 1 ? (index / (count - 1)) * 100 : 0,
	});
}

function atlasRow(index, count, cellHeight) {
	return Object.freeze({
		row: index,
		y: index * cellHeight,
		positionYPercent: count > 1 ? (index / (count - 1)) * 100 : 0,
	});
}

export const BLACKSITE_UI_V21_SCREEN_ROLES = Object.freeze({
	baseHud: Object.freeze({ controls: 'round', primaryAction: 'round', meters: 'readout', ticker: 'readout' }),
	menus: Object.freeze({ shell: 'panel', actions: 'control', tabs: 'control', settingsRows: 'control' }),
	blackout: Object.freeze({ award: 'panel', counter: 'readout', progress: 'readout', callToAction: 'control:selected' }),
	vaultAward: Object.freeze({ shell: 'panel', award: 'readout', continueAction: 'control:selected' }),
	extraction: Object.freeze({ shell: 'panel', totals: 'readout', continueAction: 'control:selected' }),
	error: Object.freeze({ shell: 'panel:danger', message: 'readout', retryAction: 'control:danger' }),
	insufficient: Object.freeze({ shell: 'panel', warning: 'readout', dismissAction: 'control', retryAction: 'control:danger' }),
	loading: Object.freeze({ shell: 'panel', status: 'readout', controls: 'control:disabled' }),
});

export function normalizeBlacksiteUiV21State(state) {
	return BLACKSITE_UI_V21_STATES.includes(state) ? state : 'idle';
}

export function resolveBlacksiteUiV21State({
	state = 'idle',
	disabled = false,
	danger = false,
	pressed = false,
	focused = false,
	selected = false,
	hovered = false,
	tone = 'neutral',
} = {}) {
	const requested = normalizeBlacksiteUiV21State(state);
	if (disabled || requested === 'disabled') return 'disabled';
	if (danger || tone === 'danger' || requested === 'danger') return 'danger';
	if (pressed || requested === 'pressed') return 'pressed';
	if (focused || requested === 'focus') return 'focus';
	if (selected || requested === 'selected') return 'selected';
	if (hovered || requested === 'hover') return 'hover';
	return 'idle';
}

export function resolveBlacksiteUiV21Glyph(name) {
	const normalized = GLYPH_ALIASES[name] ?? name;
	return BLACKSITE_UI_V21_GLYPHS.includes(normalized) ? normalized : 'info';
}

export function createBlacksiteUiV21Catalog(resolveAsset) {
	if (typeof resolveAsset !== 'function') {
		throw new TypeError('BLACKSITE v21 UI catalog requires an asset resolver.');
	}
	const asset = (path) => resolveAsset(`${BLACKSITE_UI_V21_ROOT}/${path}`);
	const controlStates = Object.freeze(Object.fromEntries(
		BLACKSITE_UI_V21_STATES.map((state) => [
			state,
			asset(`nine-slice/control/${state}.webp`),
		]),
	));
	const panelStates = Object.freeze({
		idle: asset('nine-slice/panel/idle.webp'),
		danger: asset('nine-slice/panel/danger.webp'),
	});
	const readoutStates = Object.freeze({ idle: asset('nine-slice/readout/idle.webp') });
	const roundStateCells = Object.freeze(Object.fromEntries(
		BLACKSITE_UI_V21_STATES.map((state, index) => [
			state,
			atlasCell(index, BLACKSITE_UI_V21_STATES.length, 200, 200),
		]),
	));
	const glyphColumns = Object.freeze(Object.fromEntries(
		BLACKSITE_UI_V21_GLYPHS.map((glyph, index) => [
			glyph,
			atlasCell(index, BLACKSITE_UI_V21_GLYPHS.length, 96, 96),
		]),
	));
	const glyphRows = Object.freeze(Object.fromEntries(
		GLYPH_ROWS.map((row, index) => [row, atlasRow(index, GLYPH_ROWS.length, 96)]),
	));
	const roundSource = asset('atlas/round-states.webp');
	const glyphSource = asset('atlas/glyphs.webp');
	const preload = Object.freeze([
		...Object.values(controlStates),
		...Object.values(panelStates),
		...Object.values(readoutStates),
		roundSource,
		glyphSource,
	]);

	return Object.freeze({
		devOnly: false,
		productionScope: 'shared-control-atlases-and-nine-slice',
		sourceManifestDevOnly: true,
		version: 21,
		root: BLACKSITE_UI_V21_ROOT,
		manifest: asset('manifest.json'),
		contexts: Object.freeze(['breach', 'blackout']),
		states: BLACKSITE_UI_V21_STATES,
		statePrecedence: BLACKSITE_UI_V21_STATE_PRECEDENCE,
		legacyStateAliases: Object.freeze({ normal: 'idle', active: 'selected' }),
		nineSlice: Object.freeze({
			control: Object.freeze({
				width: 288,
				height: 144,
				sliceInsets: freezeBox(48, 48, 48, 48),
				contentInsets: freezeBox(54, 56, 54, 56),
				states: controlStates,
			}),
			panel: Object.freeze({
				width: 384,
				height: 256,
				sliceInsets: freezeBox(64, 64, 64, 64),
				contentInsets: freezeBox(76, 76, 76, 76),
				states: panelStates,
			}),
			readout: Object.freeze({
				width: 320,
				height: 128,
				sliceInsets: freezeBox(32, 48, 32, 48),
				contentInsets: freezeBox(38, 56, 38, 56),
				states: readoutStates,
			}),
		}),
		atlases: Object.freeze({
			roundStates: Object.freeze({
				source: roundSource,
				width: 1400,
				height: 200,
				columns: 7,
				rows: 1,
				cellWidth: 200,
				cellHeight: 200,
				safeInset: 12,
				states: roundStateCells,
			}),
			glyphs: Object.freeze({
				source: glyphSource,
				width: 1536,
				height: 480,
				columns: 16,
				rows: 5,
				cellWidth: 96,
				cellHeight: 96,
				safeInset: 12,
				glyphs: glyphColumns,
				stateRows: glyphRows,
				stateRowAliases: GLYPH_STATE_ROW,
			}),
		}),
		screenRoles: BLACKSITE_UI_V21_SCREEN_ROLES,
		preload,
	});
}

export function blacksiteUiV21SurfaceSources(catalog, kind) {
	if (kind === 'round') return [catalog?.atlases?.roundStates?.source].filter(Boolean);
	return Object.values(catalog?.nineSlice?.[kind]?.states ?? {});
}

export function blacksiteUiV21GlyphRow(catalog, state) {
	const normalizedState = normalizeBlacksiteUiV21State(state);
	const rowName = catalog?.atlases?.glyphs?.stateRowAliases?.[normalizedState] ?? 'idle';
	return catalog?.atlases?.glyphs?.stateRows?.[rowName]
		?? Object.freeze({ row: 0, y: 0, positionYPercent: 0 });
}

const SOURCE_DECODE_PROMISES = new Map();

function decodeSource(source, ImageClass, timeoutMs) {
	if (!source || typeof ImageClass !== 'function') return Promise.resolve(false);
	if (SOURCE_DECODE_PROMISES.has(source)) return SOURCE_DECODE_PROMISES.get(source);
	const pending = new Promise((resolve) => {
		const image = new ImageClass();
		let timeout = null;
		let settled = false;
		const finish = (result) => {
			if (settled) return;
			settled = true;
			if (timeout !== null) globalThis.clearTimeout(timeout);
			image.onload = null;
			image.onerror = null;
			const ready = Boolean(result && image.complete && image.naturalWidth > 0);
			if (!ready) SOURCE_DECODE_PROMISES.delete(source);
			resolve(ready);
		};
		image.decoding = 'async';
		image.onload = () => finish(true);
		image.onerror = () => finish(false);
		timeout = globalThis.setTimeout(() => finish(false), timeoutMs);
		image.src = source;
		if (typeof image.decode === 'function') {
			image.decode().then(() => finish(true), () => finish(false));
		}
	});
	SOURCE_DECODE_PROMISES.set(source, pending);
	return pending;
}

export async function preloadBlacksiteUiV21Sources(
	sources,
	{ ImageClass = globalThis.Image, timeoutMs = 2_500 } = {},
) {
	const uniqueSources = [...new Set((sources ?? []).filter(Boolean))];
	if (uniqueSources.length === 0) return false;
	const safeTimeoutMs = Number.isFinite(timeoutMs) ? Math.max(250, timeoutMs) : 2_500;
	const results = await Promise.all(
		uniqueSources.map((source) => decodeSource(source, ImageClass, safeTimeoutMs)),
	);
	return results.every(Boolean);
}
