import { BLACKSITE_UI_V21_STATES } from './blacksite-ui-v21.js';

export const BLACKSITE_UI_V22_ROOT = 'v22/ui-kit';

function freezeBox(top, right, bottom, left) {
	return Object.freeze({ top, right, bottom, left });
}

function repeatedStates(source) {
	return Object.freeze(Object.fromEntries(
		BLACKSITE_UI_V21_STATES.map((state) => [state, source]),
	));
}

export function createBlacksiteUiV22Catalog(resolveAsset, v21Catalog, penguinReelStrips) {
	if (typeof resolveAsset !== 'function') {
		throw new TypeError('BLACKSITE v22 UI catalog requires an asset resolver.');
	}
	if (!Array.isArray(penguinReelStrips) || penguinReelStrips.length !== 5) {
		throw new TypeError('BLACKSITE v22 UI catalog requires five Penguin reel strips.');
	}

	const asset = (path) => resolveAsset(`${BLACKSITE_UI_V22_ROOT}/${path}`);
	const controlSource = asset('nine-slice/control/master.webp');
	const panelSource = asset('nine-slice/panel/master.webp');
	const readoutSource = asset('nine-slice/readout/master.webp');
	const reelBezelSource = asset('reel-stage/inner-bezel-depth-overlay.webp');
	const reelCellDepthSource = asset('reel-stage/cell-depth-overlay.webp');
	const reelStrips = Object.freeze([...penguinReelStrips]);

	return Object.freeze({
		devOnly: false,
		productionScope: 'penguin-operative-reels-surface-and-depth',
		excludes: Object.freeze(['ui-authoring']),
		version: 22,
		root: BLACKSITE_UI_V22_ROOT,
		manifest: asset('manifest.json'),
		contexts: Object.freeze(['breach', 'blackout']),
		states: BLACKSITE_UI_V21_STATES,
		nineSlice: Object.freeze({
			control: Object.freeze({
				width: 768,
				height: 384,
				sliceInsets: freezeBox(144, 160, 144, 160),
				contentInsets: freezeBox(112, 136, 112, 136),
				states: repeatedStates(controlSource),
			}),
			panel: Object.freeze({
				width: 960,
				height: 640,
				sliceInsets: freezeBox(160, 176, 160, 176),
				contentInsets: freezeBox(112, 128, 112, 128),
				states: repeatedStates(panelSource),
			}),
			readout: Object.freeze({
				width: 960,
				height: 384,
				sliceInsets: freezeBox(128, 176, 128, 176),
				contentInsets: freezeBox(104, 152, 104, 152),
				states: repeatedStates(readoutSource),
			}),
		}),
		// V22 deliberately reuses the compact V21 atlas geometry: the round
		// controls stay authored V21 while the glyph source carries the V39 buy overlay.
		atlases: v21Catalog?.atlases,
		reelStrips,
		reelStage: Object.freeze({
			innerBezel: Object.freeze({
				source: reelBezelSource,
				width: 1280,
				height: 768,
				contentInsets: freezeBox(112, 112, 112, 112),
			}),
			cellDepth: Object.freeze({
				source: reelCellDepthSource,
				width: 640,
				height: 512,
				sliceInsets: freezeBox(96, 96, 96, 96),
			}),
		}),
		screenRoles: v21Catalog?.screenRoles,
		preload: Object.freeze([
			controlSource,
			panelSource,
			readoutSource,
			reelBezelSource,
			reelCellDepthSource,
			...reelStrips,
			...(v21Catalog?.preload ?? []).filter((source) => /\/atlas\//u.test(source)),
		]),
	});
}
