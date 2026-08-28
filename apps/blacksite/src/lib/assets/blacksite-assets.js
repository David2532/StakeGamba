/* global __BLACKSITE_DEV_FIXTURES__ */
import { createBlacksiteUiV21Catalog } from './blacksite-ui-v21.js';
import { createBlacksiteUiV22Catalog } from './blacksite-ui-v22.js';
import { createBlacksiteUiV27Catalog } from './blacksite-ui-v27.js';

const ASSET_ROOT = 'assets/blacksite';
const DEV_ASSETS_ENABLED = typeof __BLACKSITE_DEV_FIXTURES__ !== 'undefined'
	&& __BLACKSITE_DEV_FIXTURES__;

export const SYMBOL_MASTER_IDS = Object.freeze([
	'operative',
	'encrypted_drive',
	'tactical_radio',
	'classified_folder',
	'night_vision_goggles',
	'supply_crate',
	'ghost_wild',
	'breach',
	'a',
	'k',
	'q',
	'j',
	'ten',
]);

export function packageAsset(path) {
	const relativePath = `${ASSET_ROOT}/${path}`;
	if (typeof window === 'undefined') return relativePath;

	// Stake may inject a file:// <base> while serving the game over HTTPS. Using
	// document.baseURI would then turn package assets into blocked local-file
	// requests. The actual frame location is the package authority and mount.
	const packageBase = new URL(window.location.href);
	packageBase.search = '';
	packageBase.hash = '';
	if (!packageBase.pathname.endsWith('/')) {
		const lastSegment = packageBase.pathname.split('/').at(-1) ?? '';
		packageBase.pathname = /\.html?$/i.test(lastSegment)
			? packageBase.pathname.slice(0, -lastSegment.length)
			: `${packageBase.pathname}/`;
	}
	return new URL(relativePath, packageBase).href;
}

function premiumHudStateSet(controlName) {
	return Object.freeze({
		normal: packageAsset(`ui/premium-hud-v2/controls/${controlName}/normal.webp`),
		hover: packageAsset(`ui/premium-hud-v2/controls/${controlName}/hover.webp`),
		pressed: packageAsset(`ui/premium-hud-v2/controls/${controlName}/pressed.webp`),
		active: packageAsset(`ui/premium-hud-v2/controls/${controlName}/active.webp`),
		disabled: packageAsset(`ui/premium-hud-v2/controls/${controlName}/disabled.webp`),
	});
}

function symbolStateSet(directoryName, special = false) {
	const root = `symbols/${directoryName}/states-v4`;
	return Object.freeze({
		base: packageAsset(`${root}/base-v4.webp`),
		win: packageAsset(`${root}/win-v4.webp`),
		dim: packageAsset(`${root}/dim-v4.webp`),
		...(special
			? {
				anticipation: packageAsset(`${root}/anticipation-v4.webp`),
				triggered: packageAsset(`${root}/triggered-v4.webp`),
			}
			: {}),
	});
}

const V19_VAULT_ASSETS = Object.freeze({
	base: packageAsset('v19/vault-symbol/base.webp'),
	anticipation: packageAsset('v19/vault-symbol/anticipation.webp'),
	triggered: packageAsset('v19/vault-symbol/triggered.webp'),
	dim: packageAsset('v19/vault-symbol/dim.webp'),
});
const V19_VAULT_STATE_SET = Object.freeze({ ...V19_VAULT_ASSETS, win: V19_VAULT_ASSETS.triggered });

const SYMBOL_STATE_SETS = Object.freeze({
	operative: Object.freeze({
		base: packageAsset('v22/symbols/operative/base.webp'),
		win: packageAsset('v22/symbols/operative/win.webp'),
		dim: packageAsset('v22/symbols/operative/dim.webp'),
	}),
	encrypted_drive: symbolStateSet('sym_02_encrypted_drive'),
	tactical_radio: symbolStateSet('sym_03_tactical_radio'),
	classified_folder: symbolStateSet('sym_04_classified_folder'),
	night_vision_goggles: symbolStateSet('sym_05_night_vision_goggles'),
	supply_crate: symbolStateSet('sym_06_supply_crate'),
	ghost_wild: symbolStateSet('sym_07_ghost_wild', true),
	breach: V19_VAULT_STATE_SET,
	a: symbolStateSet('sym_09_a'),
	k: symbolStateSet('sym_10_k'),
	q: symbolStateSet('sym_11_q'),
	j: symbolStateSet('sym_12_j'),
	ten: symbolStateSet('sym_13_ten'),
});

const PENGUIN_REEL_STRIPS = Object.freeze(Array.from(
	{ length: 5 },
	(_, index) => packageAsset(`v22/ui/reel-strips/reel-${String(index + 1).padStart(2, '0')}.webp`),
));

const BLACKSITE_UI_V21 = createBlacksiteUiV21Catalog(packageAsset);
const BLACKSITE_UI_V22 = createBlacksiteUiV22Catalog(
	packageAsset,
	BLACKSITE_UI_V21,
	PENGUIN_REEL_STRIPS,
);
const BLACKSITE_UI_V27 = createBlacksiteUiV27Catalog(packageAsset, BLACKSITE_UI_V22);

export const BLACKSITE_ASSETS = Object.freeze({
	environment: Object.freeze({
		desktop: packageAsset('environment/server-bunker-desktop-v1.webp'),
		premiumMachine: packageAsset('environment/premium-machine-shell-v1.webp'),
		premiumMachinePortrait: packageAsset('environment/premium-machine-shell-portrait-v1.webp'),
		premiumMachinePhone: packageAsset('environment/premium-machine-shell-phone-v1.webp'),
		premiumMachineShortLandscape: packageAsset('environment/premium-machine-shell-short-landscape-v1.webp'),
		premiumMachineV22: packageAsset('v22/environment/premium-machine-shell-v22.webp'),
		premiumMachinePortraitV22: packageAsset('v22/environment/premium-machine-shell-portrait-v22.webp'),
		premiumMachinePhoneV22: packageAsset('v22/environment/premium-machine-shell-phone-v22.webp'),
		premiumMachineCompactPhoneV22: packageAsset('v22/environment/premium-machine-shell-compact-phone-v22.webp'),
		premiumMachineShortLandscapeV22: packageAsset('v22/environment/premium-machine-shell-short-landscape-v22.webp'),
		v28Candidate: Object.freeze({
			status: 'catalogued-preload-candidate',
			runtimeOwner: 'v22-responsive-machine-shell',
			base: Object.freeze({
				desktop: packageAsset('v28/environment/base-desktop.webp'),
				portrait: packageAsset('v28/environment/base-portrait.webp'),
				shortLandscape: packageAsset('v28/environment/base-short-landscape.webp'),
			}),
			blackout: Object.freeze({
				desktop: packageAsset('v28/environment/blackout-interior-desktop.webp'),
				portrait: packageAsset('v28/environment/blackout-interior-portrait.webp'),
				shortLandscape: packageAsset('v28/environment/blackout-interior-short-landscape.webp'),
			}),
		}),
	}),
	symbols: Object.freeze({
		master: Object.freeze(Object.fromEntries(
			SYMBOL_MASTER_IDS.map((symbolId) => [symbolId, SYMBOL_STATE_SETS[symbolId].base]),
		)),
		states: SYMBOL_STATE_SETS,
		special: Object.freeze({
			wild: Object.freeze({ id: 'ghost_wild', label: 'GHOST WILD' }),
			feature: Object.freeze({ id: 'breach', label: 'VAULT' }),
		}),
	}),
	ui: Object.freeze({
		v21: BLACKSITE_UI_V21,
		v22: BLACKSITE_UI_V22,
		v27: BLACKSITE_UI_V27,
		premiumHud: Object.freeze({
			menu: premiumHudStateSet('menu'),
			buy: premiumHudStateSet('buy'),
			auto: premiumHudStateSet('auto'),
			minus: premiumHudStateSet('minus'),
			plus: premiumHudStateSet('plus'),
			spin: premiumHudStateSet('spin'),
			turbo: premiumHudStateSet('turbo'),
			info: premiumHudStateSet('info'),
			settings: premiumHudStateSet('settings'),
			close: premiumHudStateSet('close'),
			resume: premiumHudStateSet('resume'),
		}),
		premiumPanels: Object.freeze({
			dialogs: Object.freeze({
				mode: packageAsset('ui/premium-panels-v1/dialog-mode.webp'),
				menu: packageAsset('ui/premium-panels-v1/dialog-menu.webp'),
				confirmation: packageAsset('ui/premium-panels-v1/dialog-confirmation.webp'),
				rules: packageAsset('ui/premium-panels-v1/dialog-rules.webp'),
				auto: packageAsset('ui/premium-panels-v1/dialog-auto.webp'),
				settings: packageAsset('ui/premium-panels-v1/dialog-settings.webp'),
				runtimeError: packageAsset('ui/premium-panels-v1/dialog-runtime-error.webp'),
			}),
			modeCard: Object.freeze({
				normal: packageAsset('ui/premium-hud-v2/panels/mode-card/normal.webp'),
				hover: packageAsset('ui/premium-hud-v2/panels/mode-card/hover.webp'),
				selected: packageAsset('ui/premium-hud-v2/panels/mode-card/selected.webp'),
				disabled: packageAsset('ui/premium-hud-v2/panels/mode-card/disabled.webp'),
			}),
			meters: Object.freeze({
				bet: packageAsset('ui/premium-hud-v2/panels/meter-bet.webp'),
				total: packageAsset('ui/premium-hud-v2/panels/meter-total.webp'),
				win: packageAsset('ui/premium-hud-v2/panels/meter-win.webp'),
				balance: packageAsset('ui/premium-hud-v2/panels/meter-balance.webp'),
				howTo: packageAsset('ui/premium-hud-v2/panels/how-to.webp'),
			}),
			ticker: packageAsset('ui/premium-hud-v2/panels/ticker.webp'),
			marker: Object.freeze({
				normal: packageAsset('ui/premium-hud-v2/panels/marker/normal.webp'),
				active: packageAsset('ui/premium-hud-v2/panels/marker/active.webp'),
				disabled: packageAsset('ui/premium-hud-v2/panels/marker/disabled.webp'),
			}),
		}),
		paylines: Object.freeze(Array.from(
			{ length: 10 },
			(_, index) => packageAsset(`ui/paylines-v1/line-${String(index + 1).padStart(2, '0')}.webp`),
		)),
		reelStrips: PENGUIN_REEL_STRIPS,
		reelDepth: Object.freeze({
			cellOverlay: packageAsset('ui/reel-depth-v1/reel-cell-depth-overlay.webp'),
		}),
	}),
	v19: Object.freeze({
		vaultSymbol: V19_VAULT_ASSETS,
		cinematic: Object.freeze({
			vaultOpeningVideoV26: packageAsset('v26/cinematic/vault-opening-blackout-v26-720p24.mp4'),
			vaultOpeningPoster: packageAsset('v26/cinematic/vault-opening-blackout-v26-poster-720p.webp'),
		}),
		...(DEV_ASSETS_ENABLED ? {
			devCinematic: Object.freeze({
				doorBase: packageAsset('v19/cinematic/dev-rig-v1/door-base.webp'),
				doorBack: packageAsset('v19/cinematic/dev-rig-v1/door-back.webp'),
				sideRim: packageAsset('v19/cinematic/dev-rig-v1/side-rim.webp'),
				wheel: packageAsset('v19/cinematic/dev-rig-v1/wheel.webp'),
				bolt: packageAsset('v19/cinematic/dev-rig-v1/bolt.webp'),
				portalLight: packageAsset('v19/cinematic/dev-rig-v1/portal-light.webp'),
			}),
		} : {}),
		scenes: Object.freeze({
			access: packageAsset('v19/scenes/vault-access-desktop.webp'),
			blackout: packageAsset('v19/scenes/blackout-interior-desktop.webp'),
			extraction: packageAsset('v19/scenes/extraction-report-desktop.webp'),
		}),
		modes: Object.freeze({
			base: packageAsset('v19/modes/base.webp'),
			deep_access: packageAsset('v19/modes/deep-access.webp'),
			blackout: packageAsset('v19/modes/blackout.webp'),
		}),
	}),
});
