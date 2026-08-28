import {
	BLACKSITE_UI_V21_STATE_PRECEDENCE,
	BLACKSITE_UI_V21_STATES,
} from './blacksite-ui-v21.js';

export const BLACKSITE_UI_V27_ROOT = 'v27/ui-kit';

export const BLACKSITE_UI_V27_KINDS = Object.freeze([
	'feature',
	'content',
	'header',
	'award',
	'chip',
	'progress',
]);

const V27_SURFACE_SPECS = Object.freeze({
	feature: Object.freeze({
		width: 960,
		height: 384,
		sliceInsets: Object.freeze({ top: 128, right: 176, bottom: 128, left: 176 }),
		contentInsets: Object.freeze({ top: 104, right: 152, bottom: 104, left: 152 }),
	}),
	content: Object.freeze({
		width: 768,
		height: 512,
		sliceInsets: Object.freeze({ top: 112, right: 128, bottom: 112, left: 128 }),
		contentInsets: Object.freeze({ top: 82, right: 96, bottom: 82, left: 96 }),
	}),
	header: Object.freeze({
		width: 1280,
		height: 256,
		sliceInsets: Object.freeze({ top: 64, right: 160, bottom: 64, left: 160 }),
		contentInsets: Object.freeze({ top: 44, right: 128, bottom: 44, left: 128 }),
	}),
	award: Object.freeze({
		width: 1280,
		height: 640,
		sliceInsets: Object.freeze({ top: 144, right: 176, bottom: 144, left: 176 }),
		contentInsets: Object.freeze({ top: 104, right: 128, bottom: 104, left: 128 }),
	}),
	chip: Object.freeze({
		width: 768,
		height: 240,
		sliceInsets: Object.freeze({ top: 60, right: 96, bottom: 60, left: 96 }),
		contentInsets: Object.freeze({ top: 44, right: 76, bottom: 44, left: 76 }),
	}),
	progress: Object.freeze({
		width: 1024,
		height: 96,
		sliceInsets: Object.freeze({ top: 28, right: 48, bottom: 28, left: 48 }),
		contentInsets: Object.freeze({ top: 18, right: 56, bottom: 18, left: 56 }),
	}),
});

function repeatedStates(source) {
	return Object.freeze(Object.fromEntries(
		BLACKSITE_UI_V21_STATES.map((state) => [state, source]),
	));
}

function v27ScreenRoles(v22Catalog) {
	const inherited = v22Catalog?.screenRoles ?? {};
	return Object.freeze({
		...inherited,
		baseHud: Object.freeze({
			...(inherited.baseHud ?? {}),
			featureRail: 'feature',
			status: 'chip',
		}),
		menus: Object.freeze({
			...(inherited.menus ?? {}),
			header: 'header',
			content: 'content',
			status: 'chip',
		}),
		blackout: Object.freeze({
			...(inherited.blackout ?? {}),
			award: 'award',
			counter: 'chip',
			progress: 'progress',
			callout: 'feature',
		}),
		vaultAward: Object.freeze({
			...(inherited.vaultAward ?? {}),
			shell: 'award',
			header: 'header',
			status: 'chip',
		}),
		extraction: Object.freeze({
			...(inherited.extraction ?? {}),
			header: 'header',
			totals: 'content',
			status: 'chip',
		}),
		error: Object.freeze({
			...(inherited.error ?? {}),
			header: 'header',
			message: 'content:danger',
			status: 'chip:danger',
		}),
		insufficient: Object.freeze({
			...(inherited.insufficient ?? {}),
			header: 'header',
			warning: 'content:danger',
		}),
		loading: Object.freeze({
			...(inherited.loading ?? {}),
			header: 'header',
			status: 'chip',
			progress: 'progress',
		}),
	});
}

export function createBlacksiteUiV27Catalog(resolveAsset, v22Catalog) {
	if (typeof resolveAsset !== 'function') {
		throw new TypeError('BLACKSITE v27 UI catalog requires an asset resolver.');
	}
	if (!v22Catalog?.nineSlice || !v22Catalog?.atlases || !v22Catalog?.reelStage) {
		throw new TypeError('BLACKSITE v27 UI catalog requires the V22 catalog it extends.');
	}

	const asset = (path) => resolveAsset(`${BLACKSITE_UI_V27_ROOT}/${path}`);
	const newSources = Object.freeze(Object.fromEntries(
		BLACKSITE_UI_V27_KINDS.map((kind) => [
			kind,
			asset(`nine-slice/${kind}/master.webp`),
		]),
	));
	const newSurfaces = Object.freeze(Object.fromEntries(
		BLACKSITE_UI_V27_KINDS.map((kind) => [
			kind,
			Object.freeze({
				...V27_SURFACE_SPECS[kind],
				states: repeatedStates(newSources[kind]),
			}),
		]),
	));
	const rewardHalo = asset('decor/reward-halo.webp');

	return Object.freeze({
		devOnly: false,
		version: 27,
		inheritedFrom: 22,
		root: BLACKSITE_UI_V27_ROOT,
		manifest: asset('manifest.json'),
		contexts: v22Catalog.contexts,
		states: BLACKSITE_UI_V21_STATES,
		statePrecedence: BLACKSITE_UI_V21_STATE_PRECEDENCE,
		legacyStateAliases: Object.freeze({ normal: 'idle', active: 'selected' }),
		nineSlice: Object.freeze({
			...v22Catalog.nineSlice,
			...newSurfaces,
		}),
		// V27 is an additive semantic-surface pack. It deliberately keeps V22's
		// rectangular controls/readouts, V21's state atlases and V22's reel stage.
		atlases: v22Catalog.atlases,
		reelStrips: v22Catalog.reelStrips,
		reelStage: v22Catalog.reelStage,
		decor: Object.freeze({ rewardHalo }),
		decorGeometry: Object.freeze({
			rewardHalo: Object.freeze({
				width: 768,
				height: 768,
				openingInsets: Object.freeze({ top: 220, right: 220, bottom: 220, left: 220 }),
			}),
		}),
		screenRoles: v27ScreenRoles(v22Catalog),
		preload: Object.freeze([...new Set([
			...(v22Catalog.preload ?? []),
			...Object.values(newSources),
			rewardHalo,
		])]),
	});
}
