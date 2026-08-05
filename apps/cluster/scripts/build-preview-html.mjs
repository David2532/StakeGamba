/**
 * Generates a standalone, self-contained, INTERACTIVE preview.html from the
 * GoldenGoalRushFinalPreview.svelte component so the Golden Goal Rush visual
 * direction can be opened and *played* directly in any browser (no Storybook).
 *
 * The Svelte component remains the visual source of truth: this script reads
 * its <style> block verbatim and re-uses the same markup/asset paths, then
 * layers a self-contained demo engine on top (spin, cascades, cluster wins,
 * rising cascade multiplier, bet/turbo/auto controls, animated meters).
 *
 *   node apps/cluster/scripts/build-preview-html.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CURRENCY_META } from '../../../packages/utils-shared/currency.js';

// Shared math config — the SAME numbers the RTP simulation (ggr-sim.mjs) measures.
import { SYMBOL_MATH, CONFIG } from './ggr-config.mjs';
import {
	CLUSTER_THRESHOLDS,
	PAYING_SYMBOLS,
	PRODUCTION_GAME_CONFIG,
	PRODUCTION_PAYTABLE,
	formatPaytableMultiplier,
} from './production-math-contract.mjs';
import {
	STAKE_PLAYER_VISIBLE_RESTRICTED_TERMS,
	formatMaxWinMultiplier,
	playerVisibleRestrictedHits,
	summarizeFeatureEvents,
	reconcileWalletBalance,
} from './stake-compliance-contract.mjs';
import { INTRO_CONFIG, validateIntroConfig } from './ggr-intro-config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const COMPONENT = join(ROOT, 'src/components/GoldenGoalRushFinalPreview.svelte');
const OUT = join(ROOT, 'preview.html');
const BUILDER = fileURLToPath(import.meta.url);

const source = readFileSync(COMPONENT, 'utf8');
const style = source.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';
validateIntroConfig(INTRO_CONFIG);
const canonicalHashText = (value) => value.replace(/\r\n?/g, '\n');
const frontendBuildId = createHash('sha256')
	.update(canonicalHashText(readFileSync(BUILDER, 'utf8')))
	.update(canonicalHashText(readFileSync(join(__dirname, 'ggr-config.mjs'), 'utf8')))
	.update(canonicalHashText(readFileSync(join(__dirname, 'production-math-contract.mjs'), 'utf8')))
	.update(canonicalHashText(readFileSync(join(__dirname, 'stake-compliance-contract.mjs'), 'utf8')))
	.update(canonicalHashText(readFileSync(join(__dirname, 'ggr-intro-config.mjs'), 'utf8')))
	.update(canonicalHashText(source))
	.update(JSON.stringify(PRODUCTION_GAME_CONFIG))
	.digest('hex');

const A = 'src/assets/golden-goal-rush';
const HUD = `${A}/hud-extracted`;
const SPECIAL = `${A}/special`;
const AUDIO = `${A}/audio`;

const assets = {
	background: `${A}/slot-background.webp`,
	headerLogo: `${A}/logo-horizontal-tight.webp`,
	football: `${A}/fussball.webp`,
	collector: `${SPECIAL}/symbol_collector.webp`,
	multiplier: `${SPECIAL}/symbol_multiplier.webp`,
	trophy: `${A}/pokal.webp`,
	featureBanner: `${HUD}/feature-banner-wide.webp`,
	meterPanelA: `${HUD}/meter-panel-a.webp`,
	meterPanelB: `${HUD}/meter-panel-b.webp`,
	meterPanelC: `${HUD}/meter-panel-c.webp`,
	controlPanel: `${HUD}/control-panel-wide.webp`,
	featurePanel: `${HUD}/feature-panel.webp`,
	menuButton: `${HUD}/menu-button.webp`,
	bonusButton: `${HUD}/bonus-button.webp`,
	autoSpinButton: `${HUD}/autospin-button.webp`,
	turboButton: `${HUD}/turbo-button.webp`,
	spinButton: `${HUD}/spin-button-active.webp`,
	minusButton: `${HUD}/minus-button.webp`,
	plusButton: `${HUD}/plus-button.webp`,
	infoButton: `${HUD}/info-button.webp`,
	settingsButton: `${HUD}/settings-button.webp`,
};

const PLAYER_MODE_META = {
	base: {
		name: 'Base Game',
		socialName: 'Base Game',
		costMultiplier: 1,
		trigger: 'Main Play button',
		socialTrigger: 'Main Play button',
		description: 'Standard play on the 6x5 cluster grid. Winning clusters cascade and mark Golden Cells.',
		socialDescription: 'Standard play on the 6x5 cluster grid. Winning clusters cascade and mark Golden Cells.',
		retrigger: 'Not a feature sequence. Scatter tickets can trigger Free Spins from the play.',
		socialRetrigger: 'Not a feature sequence. Scatter tickets can trigger Free Spins from the play.',
	},
	hunt: {
		name: 'Feature Spins',
		socialName: 'Feature Spins',
		costMultiplier: CONFIG.bonusBuy.find((o) => o.id === 'hunt')?.mult ?? 4.2,
		trigger: 'Feature panel',
		socialTrigger: 'Feature panel',
		description: 'One play with boosted Golden Arc chance. Free-spin triggers are disabled for this mode.',
		socialDescription: 'One play with boosted Golden Arc chance. Free-spin triggers are disabled for this mode.',
		retrigger: 'No retrigger inside this single-spin mode.',
		socialRetrigger: 'No extra sequence is added inside this single-play mode.',
	},
	rainbow: {
		name: 'Rainbow Spin',
		socialName: 'Rainbow Spin',
		costMultiplier: CONFIG.bonusBuy.find((o) => o.id === 'rainbow')?.mult ?? 6,
		trigger: 'Feature panel',
		socialTrigger: 'Feature panel',
		description: 'One play with a guaranteed Golden Arc. Scatter tickets can still award Free Spins.',
		socialDescription: 'One play with a guaranteed Golden Arc. Scatter tickets can still award Free Spins.',
		retrigger: 'The Rainbow Spin itself does not retrigger; a scatter award starts the matching Free Spins tier.',
		socialRetrigger: 'The Rainbow Spin itself does not add more plays; a scatter award starts the matching Free Spins tier.',
	},
	bonus_tier1: {
		name: CONFIG.tiers[1].name,
		socialName: CONFIG.tiers[1].name,
		costMultiplier: CONFIG.bonusBuy.find((o) => o.id === 'tier1')?.mult ?? 31,
		trigger: 'Feature panel or 3 Scatter tickets',
		socialTrigger: 'Feature panel or 3 Scatter tickets',
		description: `${CONFIG.tiers[1].spins} Free Spins. Golden Cells persist during the sequence and reset after reveal.`,
		socialDescription: `${CONFIG.tiers[1].spins} Free Spins. Golden Cells persist during the sequence and reset after reveal.`,
		retrigger: 'The current math book does not create additional Free Spins inside this tier.',
		socialRetrigger: 'The current math book does not add extra Free Spins inside this tier.',
	},
	bonus: {
		name: CONFIG.tiers[2].name,
		socialName: CONFIG.tiers[2].name,
		costMultiplier: CONFIG.bonusBuy.find((o) => o.id === 'tier2')?.mult ?? 95,
		trigger: 'Feature panel or 4 Scatter tickets',
		socialTrigger: 'Feature panel or 4 Scatter tickets',
		description: `${CONFIG.tiers[2].spins} Free Spins. Golden Cells persist after reveal, increasing the chance of later Arc awards.`,
		socialDescription: `${CONFIG.tiers[2].spins} Free Spins. Golden Cells persist after reveal, increasing the chance of later Arc awards.`,
		retrigger: 'The current math book does not create additional Free Spins inside this tier.',
		socialRetrigger: 'The current math book does not add extra Free Spins inside this tier.',
	},
	bonus_tier3: {
		name: CONFIG.tiers[3].name,
		socialName: CONFIG.tiers[3].name,
		costMultiplier: 1,
		trigger: '5 Scatter tickets only',
		socialTrigger: '5 Scatter tickets only',
		description: `${CONFIG.tiers[3].spins} Free Spins with a guaranteed Golden Arc each spin. This tier is not available from the feature panel.`,
		socialDescription: `${CONFIG.tiers[3].spins} Free Spins with a guaranteed Golden Arc each spin. This tier is not available from the feature panel.`,
		retrigger: 'The current math book does not create additional Free Spins inside this tier.',
		socialRetrigger: 'The current math book does not add extra Free Spins inside this tier.',
	},
};

const FREE_SPIN_COUNTER_EXPLANATION = 'The counter identifies the current Free Spin. After the final counter value appears, cascades and Golden Cell awards may still finish as part of that same final Free Spin; they do not start an additional play or wallet request.';

// Symbol pool for the demo engine. `pay` = base multiple for a 5-cluster.
// Build the render symbol map from the shared math (weights/pays) + asset src.
const SYMBOL_SRC = {
	ten: { src: `${A}/10.webp` }, j: { src: `${A}/j.webp` }, q: { src: `${A}/q.webp` },
	k: { src: `${A}/k.webp` }, a: { src: `${A}/a.webp` },
	football: { src: `${A}/fussball.webp`, cls: 'feature' }, whistle: { src: `${A}/pfeife.webp`, cls: 'feature' },
	trophy: { src: `${A}/pokal.webp` }, jersey: { src: `${A}/trikot.webp`, cls: 'wide' },
	wild: { src: `${A}/wild.webp`, cls: 'feature' }, scatter: { src: `${A}/scatter.webp`, cls: 'wide' },
	rainbow: { src: `${SPECIAL}/symbol_rainbow.webp`, cls: 'feature' },
};
const SYMBOLS = Object.fromEntries(Object.entries(SYMBOL_MATH).map(([k, m]) => [k, { ...m, ...SYMBOL_SRC[k] }]));
const FORMATTED_PRODUCTION_PAYTABLE = Object.fromEntries(Object.entries(PRODUCTION_PAYTABLE).map(([symbol, pay]) => [symbol, {
	cluster5: formatPaytableMultiplier(pay.cluster5),
	cluster7: formatPaytableMultiplier(pay.cluster7),
	cluster9: formatPaytableMultiplier(pay.cluster9),
	cluster12: formatPaytableMultiplier(pay.cluster12),
}]));

// Coin medals (tier color) + a value label render on top; multiplier badge / collector.
const COIN_ASSETS = {
	bronze: `${SPECIAL}/bronze.webp`, silver: `${SPECIAL}/silber.webp`, gold: `${SPECIAL}/gold.webp`,
};
const MULT_ASSETS = {
	2: `${SPECIAL}/x2.webp`, 3: `${SPECIAL}/x3.webp`, 4: `${SPECIAL}/x4.webp`,
	5: `${SPECIAL}/x5.webp`, 10: `${SPECIAL}/x10.webp`,
};
const COLLECTOR_ASSET = `${SPECIAL}/symbol_collector.webp`;
const AUDIO_ASSETS = {
	music: `${AUDIO}/background-music.mp3`,
	roar: `${AUDIO}/stadium-roar.mp3`,
	reelEnd: `${AUDIO}/reel-end.mp3`,
	ping: `${AUDIO}/ping.mp3`,
	rainbowReveal: `${AUDIO}/rainbow-reveal.mp3`,
	scatter: `${AUDIO}/scatter-metal.mp3`,
	clusterBurst: `${AUDIO}/cluster-burst.mp3`,
};
// CONFIG is imported from ggr-config.mjs (shared with the RTP simulation).

const meters = [
	['balanceLabel', 'balance', 'currency', 'meterPanelA'],
	['winLabel', 'win', 'trophy', 'meterPanelB'],
	['betLabel', 'bet', 'currency', 'meterPanelC'],
];
const meterRows = meters
	.map(
		([labelKey, id, icon, frame]) => `\t\t\t<div class="meter" data-meter="${id}">
				<img class="panel-art" src="${assets[frame]}" alt="" />
				${icon === 'currency'
					? `<span class="meter-currency-symbol" id="meter-${id}-currency" aria-hidden="true"></span>`
					: `<img class="meter-asset-icon" src="${assets[icon]}" alt="" />`}
				<div><div class="meter-label" data-i18n="${labelKey}">${labelKey === 'betLabel' ? 'PLAY' : labelKey === 'winLabel' ? 'WIN' : 'BALANCE'}</div><div class="meter-value" id="meter-${id}">0.00</div></div>
			</div>`,
	)
	.join('\n');

const features = [
	['COLLECT', 'collector'],
	['MULTI', 'multiplier'],
	['FREE SPINS', 'scatter'],
];
const featureItems = features
	.map(
		([label, icon]) =>
			`\t\t\t\t\t<div class="feature-item"><img src="${assets[icon] ?? SYMBOLS[icon].src}" alt="" /><span>${label}</span></div>`,
	)
	.join('\n');

const controlRules = [
	['spin', 'Play', 'Play', assets.spinButton, 'Starts one play with the selected amount.', 'Starts one play with the selected amount.'],
	['auto-bet', 'Auto-Play', 'Auto-Play', assets.autoSpinButton, 'Opens the Auto-Play amount selection. Auto-Play starts only after selecting an amount and confirming.', 'Opens the Auto-Play amount selection. Auto-Play starts only after selecting an amount and confirming.'],
	['turbo', 'Turbo', 'Turbo', assets.turboButton, 'Toggles faster animations if available.', 'Toggles faster animations if available.'],
	['bonus-buy', 'Bonus / Feature', 'Bonus / Feature', assets.bonusButton, 'Opens the feature confirmation. The feature starts only after confirmation.', 'Opens the feature confirmation. The feature starts only after confirmation.'],
	['bet-minus', 'Play Minus', 'Play Minus', assets.minusButton, 'Decreases the selected play amount.', 'Decreases the selected play amount.'],
	['bet-plus', 'Play Plus', 'Play Plus', assets.plusButton, 'Increases the selected play amount.', 'Increases the selected play amount.'],
	['bet-selector', 'Play Selector / Play Panel', 'Play Selector / Play Panel', assets.controlPanel, 'Shows the selected play amount and available amount steps.', 'Shows the selected play amount and available amount steps.'],
	['info-rules', 'Info / Rules', 'Info / Rules', assets.infoButton, 'Opens game rules, symbol values, feature descriptions and button explanations.', 'Opens game rules, symbol values, feature descriptions and button explanations.'],
	['settings', 'Settings', 'Settings', assets.settingsButton, 'Opens settings such as sound or game options.', 'Opens settings such as sound or game options.'],
	['menu', 'Menu', 'Menu', assets.menuButton, 'Opens the main menu.', 'Opens the main menu.'],
	['sound-music', 'Sound / Music', 'Sound / Music', assets.menuButton, 'Toggles sound and music from the menu or settings panel.', 'Toggles sound and music from the menu or settings panel.'],
	['collect', 'Collect', 'Collect', assets.collector, 'Collects bonus feature values depending on the active Golden Goal feature.', 'Collects feature values depending on the active Golden Goal feature.'],
	['free-spins', 'Free Spins / Feature Button', 'Free Spins / Feature Button', assets.featurePanel, 'Shows feature state for collect, multiplier and free spins during active feature play.', 'Shows feature state for collect, multiplier and free spins during active feature play.'],
	['close-modal', 'Close Modal', 'Close Modal', assets.infoButton, 'Closes the current dialog without applying unconfirmed actions.', 'Closes the current dialog without applying unconfirmed actions.'],
];
const controlRuleRows = controlRules
	.map(
		([key, name, socialName, icon, description, socialDescription]) => `\t\t\t\t\t<div class="control-rule" data-control-key="${key}" data-normal-name="${name}" data-social-name="${socialName}" data-normal-desc="${description}" data-social-desc="${socialDescription}">
						<img src="${icon}" alt="${name}" />
						<div><b>${name}</b>${description}</div>
					</div>`,
	)
	.join('\n');

const extraCss = `
	/* ---- interactive demo layer ---- */
	.viewport .stage {
		position:absolute;
		top:50%;
		left:50%;
		transform-origin:center center;
		transform:var(--stage-fit-transform, translate(-50%, -50%) scale(1));
	}
	/* --stage-x-shift / --stage-y-shift (set by fitViewport) keep the play area
	   centered inside the extended fullscreen stage on mobile: portrait extends
	   the stage vertically, landscape horizontally — without the shift the
	   board/HUD would stick to the top/left edge and leave a dead gap. */
	.logo-wordmark {
		top: calc(-4px + var(--stage-y-shift, 0px));
		width: 460px;
		height: 137px;
		background: none;
		color: transparent;
		text-shadow: none;
		-webkit-text-fill-color: initial;
		-webkit-text-stroke: 0;
	}
	.logo-wordmark::before,
	.logo-wordmark::after { content: none; display: none; }
	.logo-header-img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		filter: drop-shadow(0 5px 8px rgba(0,0,0,0.9)) drop-shadow(0 0 15px rgba(255,190,38,0.5));
	}
	.board-wrap { top: calc(105px + var(--stage-y-shift, 0px)); left: calc(171px + var(--stage-x-shift, 0px)); }
	.meters { top: calc(528px + var(--stage-y-shift, 0px)); left: calc(174px + var(--stage-x-shift, 0px)); }
	.controls { left: calc(23px + var(--stage-x-shift, 0px)); }
	.win-banner { top: calc(250px + var(--stage-y-shift, 0px)); }
	.fs-counter { top: calc(89px + var(--stage-y-shift, 0px)); }
	.rt-toast { top: calc(200px + var(--stage-y-shift, 0px)); }
	.asset-button.turbo { margin-right: 20px; }
	.bet-controls { margin-right: 22px; }
	.icon-button.info { margin-right: 10px; }
	.stage.win-focus .cell:not(.win) img { opacity:0.42; filter:brightness(0.58) saturate(0.75); transition:opacity .16s ease, filter .16s ease; }
	.cell.win { z-index:9; }
	.cell.win img { animation: win-pop 0.46s ease-in-out infinite; filter:
		drop-shadow(0 0 12px rgba(255,246,170,1)) drop-shadow(0 0 24px rgba(255,200,60,0.92)) drop-shadow(0 4px 7px #000); }
	.cell.win::before { content:''; position:absolute; inset:3px; border-radius:8px; z-index:2; pointer-events:none;
		border:2px solid rgba(255,229,126,0.98); box-shadow:0 0 14px rgba(255,218,90,0.95), inset 0 0 15px rgba(255,202,50,0.45); }
	.cell.win::after { content:''; position:absolute; inset:-7px; border-radius:13px; z-index:1;
		background: radial-gradient(circle, rgba(255,234,140,0.42), transparent 68%); pointer-events:none; animation:win-aura .62s ease-in-out infinite; }
	.cluster-float { position:absolute; z-index:22; min-width:82px; text-align:center; pointer-events:none;
		padding:6px 13px; border-radius:999px; border:2px solid rgba(255,229,126,0.96);
		background:linear-gradient(180deg,rgba(28,19,5,0.98),rgba(6,6,10,0.96)); color:#fff4b7;
		font-family:'Arial Black',Impact,sans-serif; font-size:20px; font-weight:1000; line-height:1;
		text-shadow:0 2px 0 #4b2101,0 0 10px rgba(255,204,62,0.96); box-shadow:0 0 22px rgba(255,204,62,0.55);
		transform:translate(-50%,-50%) scale(0.7); opacity:0; animation:cluster-float 1.05s cubic-bezier(.2,.85,.25,1) both; }
	.cell img.dropping { animation: drop-in 0.42s cubic-bezier(.3,.62,.5,1) both; z-index:5; }
	.cell img.clearing { animation: clear-out 0.26s ease-in forwards; z-index:6; }
	.stage.turbo .cell img.clearing { animation-duration: 0.12s; }
	@keyframes drop-in {
		0% { transform: translateY(var(--dropY,-300%)) scale(1); }
		62% { transform: translateY(0) scale(1); }
		74% { transform: translateY(0) scaleX(1.05) scaleY(0.93); }
		86% { transform: translateY(0) scaleX(0.985) scaleY(1.03); }
		100% { transform: translateY(0) scale(1); } }
	@keyframes clear-out { 0% { transform: scale(1); opacity: 1; }
		40% { transform: scale(1.18); } 100% { transform: scale(0.2); opacity: 0; } }
	@keyframes win-pop { 0%,100% { transform: scale(1); } 50% { transform: scale(1.12); } }
	@keyframes win-aura { 0%,100% { opacity:0.62; transform:scale(1); } 50% { opacity:1; transform:scale(1.05); } }
	@keyframes cluster-float { 0% { opacity:0; transform:translate(-50%,-36%) scale(0.72); }
		16% { opacity:1; transform:translate(-50%,-54%) scale(1.03); }
		72% { opacity:1; transform:translate(-50%,-78%) scale(1); }
		100% { opacity:0; transform:translate(-50%,-104%) scale(0.94); } }
	/* a winning position briefly burns gold as it converts to a Golden Cell */
	.cell.converting::after { content:''; position:absolute; inset:0; border-radius:6px; z-index:3; pointer-events:none;
		background: radial-gradient(circle, rgba(255,242,175,0.95), rgba(255,200,60,0.45) 48%, transparent 72%);
		animation: golden-convert 0.5s ease-out forwards; }
	@keyframes golden-convert { 0%{ opacity:0; transform:scale(0.4);} 32%{opacity:1; transform:scale(1.12);} 100%{opacity:0; transform:scale(1.3);} }
	/* Busy state: dim slightly, no rotation (per request the spin button must
	   not spin while the reels are spinning). */
	.spin-button.busy { pointer-events:auto; cursor:pointer; filter: saturate(0.85) brightness(0.82); }
	.spin-button.busy .spin-art { animation: none; }
	.spin-button.skip-armed { filter: saturate(1.08) brightness(1.06) drop-shadow(0 0 10px rgba(255,224,130,0.75)); }
	.stage.skip-mode .cell img.dropping,
	.stage.skip-mode .cell img.clearing,
	.stage.skip-mode .cell.converting::after,
	.stage.skip-mode .reveal,
	.stage.skip-mode .cluster-float,
	.stage.skip-mode .fx-sweep,
	.stage.skip-mode .fly-coin { animation-duration:0.04s !important; animation-delay:0s !important; transition-duration:0.04s !important; }
	.asset-button.armed .button-art, .spin-button.armed .spin-art {
		filter: drop-shadow(0 0 12px rgba(94,211,255,0.9)) drop-shadow(0 4px 6px rgba(0,0,0,0.82)); }
	.win-banner { position:absolute; top:250px; left:50%; transform:translate(-50%,0) scale(0.6);
		z-index:20; padding:14px 46px; border-radius:18px; opacity:0; pointer-events:none;
		border:3px solid #ffe49a; background:linear-gradient(180deg,#1c1305,#0a0a0f);
		box-shadow:0 0 40px rgba(255,200,60,0.6), inset 0 0 24px rgba(255,200,60,0.25);
		color:#ffe49a; font-family:'Arial Black',Impact,sans-serif; font-size:46px; font-weight:1000;
		font-style:italic; text-align:center; white-space:nowrap; text-shadow:0 3px 0 #5a2500,0 0 16px rgba(255,190,40,0.9);
		-webkit-text-stroke:2px #4b2101; transition:opacity .25s ease, transform .35s cubic-bezier(.2,.9,.3,1.4); }
	.win-banner.show { opacity:1; transform:translate(-50%,0) scale(1); }
	.win-banner small { display:block; font-size:20px; letter-spacing:3px; color:#fff; -webkit-text-stroke:0;
		text-shadow:0 2px 2px #000; margin-bottom:2px; }
	.stage.shake { animation: stage-shake 0.4s ease; }
	@keyframes stage-shake { 0%,100%{transform:var(--stage-fit-transform, translate(-50%, -50%) scale(1));}
		20%{transform:var(--stage-fit-transform, translate(-50%, -50%) scale(1)) translate(-6px,2px);}
		40%{transform:var(--stage-fit-transform, translate(-50%, -50%) scale(1)) translate(5px,-2px);}
		60%{transform:var(--stage-fit-transform, translate(-50%, -50%) scale(1)) translate(-4px,1px);}
		80%{transform:var(--stage-fit-transform, translate(-50%, -50%) scale(1)) translate(3px,-1px);} }
	.fatal-error { position:absolute; inset:0; z-index:95; display:none; place-items:center; padding:34px;
		background:rgba(0,0,0,0.88); pointer-events:auto; }
	.fatal-error.show { display:grid; }
	.fatal-error-card { width:min(560px,92%); padding:28px 30px; border-radius:16px;
		border:2px solid #ffcf6d; background:linear-gradient(180deg,#1d1508,#070707);
		box-shadow:0 0 0 4px #060606, 0 26px 70px rgba(0,0,0,0.8), 0 0 34px rgba(255,90,60,0.28);
		color:#fff0c4; text-align:center; font-family:Inter,Arial,sans-serif; }
	.fatal-error-title { margin-bottom:10px; color:#ffd66e; font-size:24px; font-weight:1000; letter-spacing:1.4px; text-transform:uppercase; }
	.fatal-error-detail { color:#f5dec0; font-size:15px; line-height:1.45; }
	.stage.fatal .board-wrap,
	.stage.fatal .hud,
	.stage.fatal .controls { pointer-events:none; filter:grayscale(0.35) brightness(0.55); }
	.bet-controls.low .bet-display strong { color:#ff8d8d; }
	.meter-currency-symbol { position:relative; z-index:1; min-width:34px; height:32px; display:grid; place-items:center;
		color:#ffd96f; font-size:18px; font-weight:1000; line-height:1; text-shadow:0 2px 3px #000, 0 0 7px rgba(255,213,88,0.42); }
	.meter[data-meter="balance"] .meter-value,
	.meter[data-meter="bet"] .meter-value,
	.meter[data-meter="win"] .meter-value { font-size:16px; }

	/* ---- modals (menu / settings / info / bonus buy) ---- */
	.modal-backdrop { position:absolute; inset:0; z-index:60; display:none;
		align-items:center; justify-content:center; background:rgba(2,3,6,0.8);
		-webkit-backdrop-filter:blur(4px); backdrop-filter:blur(4px); }
	.modal-backdrop.open { display:flex; }
	/* width/max-height use vw/vh and the counter-scale below so dialogs render
	   at native, readable pixel size on phones even though the stage that
	   contains them can be scaled down to ~0.33 (net scale on screen is 1). */
	.modal { position:relative; width:min(640px,92vw); max-height:min(88%,86vh); transform:scale(var(--stage-inv-scale, 1)); display:flex; flex-direction:column;
		background:
			radial-gradient(125% 70% at 50% -12%, rgba(213,162,59,0.2), transparent 62%),
			linear-gradient(180deg,#17140c 0%,#0b0a07 55%,#050505 100%);
		border:2px solid #d5a23b; border-radius:18px; overflow:hidden;
		box-shadow:0 0 0 1px rgba(255,224,130,0.22) inset, 0 0 0 4px #050505,
			0 26px 62px rgba(0,0,0,0.82), 0 0 52px rgba(255,191,44,0.26);
		color:#f1e4c6; font-family:Inter,Arial,sans-serif; animation:modal-in .24s cubic-bezier(.2,.9,.3,1.3) both; }
	.modal::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; z-index:2;
		background:linear-gradient(90deg, transparent, #ffe49a 18%, #d5a23b 50%, #ffe49a 82%, transparent); }
	@keyframes modal-in { from { opacity:0; transform:translateY(16px) scale(calc(var(--stage-inv-scale, 1) * 0.96)); } }
	.modal-header { position:relative; display:flex; align-items:center; justify-content:space-between;
		padding:16px 20px 14px; border-bottom:1px solid rgba(213,162,59,0.4);
		background:linear-gradient(180deg, rgba(213,162,59,0.22), transparent); }
	.modal-title { display:flex; align-items:center; gap:11px;
		font-size:21px; font-weight:900; letter-spacing:3px; color:#ffe49a; text-shadow:0 2px 3px #000; }
	.modal-title::before { content:''; width:6px; height:22px; border-radius:3px;
		background:linear-gradient(180deg,#ffe49a,#d5a23b); box-shadow:0 0 9px rgba(255,200,60,0.65); }
	.modal-close { width:36px; height:36px; border-radius:10px; cursor:pointer; display:grid; place-items:center;
		border:2px solid #d5a23b; background:#0a0a0f; color:#ffe49a; font-size:21px; font-weight:900; line-height:1;
		transition:background .15s, border-color .15s; }
	.modal-close:hover { border-color:#ffe49a; background:linear-gradient(180deg,#3a2c0e,#1a1407); transform:none; }
	.modal-body { padding:18px 20px; overflow-y:auto; scrollbar-width:thin; scrollbar-color:rgba(213,162,59,0.55) rgba(0,0,0,0.3); }
	.modal-body::-webkit-scrollbar { width:8px; }
	.modal-body::-webkit-scrollbar-thumb { background:rgba(213,162,59,0.55); border-radius:8px; }
	.modal-body::-webkit-scrollbar-track { background:rgba(0,0,0,0.3); }
	.menu-item { display:flex; align-items:center; gap:14px; width:100%; cursor:pointer;
		padding:11px 14px; margin-bottom:9px; border-radius:12px; text-align:left;
		border:1px solid rgba(213,162,59,0.4);
		background:linear-gradient(180deg, rgba(26,21,9,0.7), rgba(8,8,12,0.85));
		color:#ffe9b8; font-size:16px; font-weight:700; letter-spacing:0.4px;
		transition:border-color .15s, background .15s, transform .15s; }
	.menu-item:hover { border-color:#ffe49a; transform:translateX(3px);
		background:linear-gradient(180deg, rgba(50,38,12,0.95), rgba(20,16,6,0.95)); }
	.menu-item .mi-ico { font-size:12px; font-weight:900; letter-spacing:0; color:#ffe49a; width:38px; height:38px; flex:0 0 auto; display:grid; place-items:center;
		border-radius:50%; border:1px solid rgba(255,224,130,0.5);
		background:radial-gradient(circle at 50% 30%, rgba(255,224,130,0.28), rgba(10,10,15,0.92));
		box-shadow:0 0 10px rgba(255,200,60,0.22) inset; }
	.menu-item .mi-text { flex:1 1 auto; display:flex; flex-direction:column; gap:2px; min-width:0; }
	.menu-item .mi-label { display:block; }
	.menu-item .mi-desc { display:block; font-size:11px; line-height:1.25; color:#9b906f; font-weight:600; letter-spacing:0; }
	.menu-item .mi-arrow { margin-left:auto; color:#d5a23b; font-size:22px; font-weight:400; transition:color .15s; }
	.menu-item:hover .mi-arrow { color:#ffe49a; }
	.mi-pill { margin-left:auto; padding:4px 13px; border-radius:999px; font-size:12px; font-weight:800; letter-spacing:1.5px;
		background:linear-gradient(180deg,#2f7335,#14491f); color:#eafce0; border:1px solid #3fae57; }
	.mi-pill.off { background:linear-gradient(180deg,#3a1414,#1e0a0a); color:#ffb4b4; border-color:#8a3030; }
	.set-section { font-size:11px; font-weight:800; letter-spacing:2.5px; text-transform:uppercase; color:#d5a23b;
		margin:14px 2px 4px; padding-bottom:6px; border-bottom:1px solid rgba(213,162,59,0.28); }
	.set-section:first-child { margin-top:0; }
	.set-row { display:flex; align-items:center; justify-content:space-between; gap:14px;
		padding:11px 6px; border-bottom:1px solid rgba(213,162,59,0.16); }
	.set-row:last-child { border-bottom:0; }
	.set-row span { font-size:15px; font-weight:700; color:#f1e4c6; }
	.volume-control { display:flex; align-items:center; gap:10px; flex:0 0 auto; min-width:190px; justify-content:flex-end; }
	.volume-slider { width:140px; accent-color:#e7b84e; cursor:pointer; }
	.set-row .volume-value { min-width:38px; text-align:right; color:#ffd96f; font-size:13px; font-weight:900; }
	.toggle { width:54px; height:28px; border-radius:16px; cursor:pointer; position:relative; flex:0 0 auto;
		border:2px solid #7a5a1c; background:#15130d; transition:background .18s, border-color .18s; }
	.toggle::after { content:''; position:absolute; top:2px; left:2px; width:20px; height:20px;
		border-radius:50%; background:linear-gradient(180deg,#cfcfcf,#888); transition:left .18s; }
	.toggle.on { background:linear-gradient(180deg,#2f7335,#14491f); border-color:#3fae57; }
	.toggle.on::after { left:26px; background:linear-gradient(180deg,#fff3bd,#e7b84e); }
	.pt-intro { font-size:14px; line-height:1.55; color:#d8cba6; margin:0; }
	.pt-head { display:flex; align-items:baseline; gap:8px; margin:20px 0 11px; padding-bottom:7px;
		font-size:13px; font-weight:800; letter-spacing:2px; text-transform:uppercase; color:#ffd96f;
		border-bottom:1px solid rgba(213,162,59,0.32); }
	.pt-head small { margin-left:auto; font-size:11px; font-weight:600; letter-spacing:0.4px; text-transform:none; color:#9b906f; }
	.pt-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; }
	.pt-cell { display:flex; flex-direction:column; align-items:center; gap:5px; padding:11px 6px; border-radius:11px;
		border:1px solid rgba(213,162,59,0.32); background:linear-gradient(180deg, rgba(26,21,9,0.55), rgba(8,8,12,0.85)); }
	.pt-cell img { width:48px; height:48px; object-fit:contain; filter:drop-shadow(0 2px 3px #000); }
	.pt-pays { font-size:11px; line-height:1.5; color:#ffe9b8; text-align:center; }
	.pt-pays b { color:#ffd96f; }
	.pt-feat { display:flex; gap:13px; align-items:flex-start; padding:10px 0; }
	.pt-feat + .pt-feat { border-top:1px solid rgba(213,162,59,0.16); }
	.pt-feat img { width:46px; height:46px; object-fit:contain; flex:0 0 auto; filter:drop-shadow(0 2px 3px #000); }
	.pt-feat .pt-chip { width:46px; height:46px; flex:0 0 auto; border-radius:9px; border:2px solid #ffd96f;
		box-shadow:0 0 11px rgba(255,210,90,0.7) inset; background:radial-gradient(circle, rgba(255,210,90,0.18), transparent 70%); }
	.pt-feat div { font-size:13px; line-height:1.5; color:#d8cba6; }
	.pt-feat b { color:#ffe49a; display:block; margin-bottom:3px; font-size:14px; letter-spacing:0.5px; }
	.pt-note { margin-top:16px; padding-top:13px; border-top:1px solid rgba(213,162,59,0.3);
		font-size:12px; color:#9b906f; text-align:center; line-height:1.6; }

	/* ---- golden cells + coin feature ---- */
	.cell.golden::before { content:''; position:absolute; inset:2px; border-radius:6px; z-index:0;
		border:2px solid #ffd96f; box-shadow:0 0 12px rgba(255,210,90,0.8), inset 0 0 14px rgba(255,200,60,0.4);
		background:radial-gradient(circle, rgba(255,210,90,0.18), transparent 70%); pointer-events:none;
		animation:golden-glow 1.6s ease-in-out infinite; }
	@keyframes golden-glow { 0%,100%{opacity:0.7;} 50%{opacity:1;} }
	.cell.rainbow-flash img { animation:rainbow-flash 0.5s ease-in-out 3; }
	@keyframes rainbow-flash { 0%,100%{filter:drop-shadow(0 0 6px #fff);}
		50%{filter:drop-shadow(0 0 22px #6cf) drop-shadow(0 0 16px #f6c) brightness(1.4);} }
	/* reveal cells don't take part in the tumble, so re-clip them (the board now
	   uses overflow:visible) to keep coins neatly inside their cell */
	.cell.has-reveal { overflow:hidden; }
	.reveal { position:absolute; inset:0; display:grid; place-items:center; z-index:2;
		animation:reveal-pop 0.34s cubic-bezier(.2,.9,.3,1.5) both; }
	.reveal img { position:relative; inset:auto; width:62%; height:62%; padding:0; object-fit:contain; filter:drop-shadow(0 3px 5px #000); }
	.reveal.coin img { width:58%; height:58%; transform:translateY(-5%); }
	.reveal.blank img { width:52%; height:52%; transform:translateY(-4%); opacity:0.55; filter:grayscale(0.25) drop-shadow(0 3px 5px #000); }
	.reveal.mult img { width:56%; height:56%; transform:translateY(-5%); }
	.reveal.collector img { width:52%; height:52%; transform:translateY(-5%); }
	.reveal .reveal-label, .reveal .coin-val { position:absolute; bottom:7%; left:5%; right:5%; text-align:center;
		font-family:'Arial Black',Impact,sans-serif; font-size:13px; line-height:1; font-weight:1000; color:#fff;
		text-shadow:0 1px 0 #000,0 0 6px #ffcf5a; -webkit-text-stroke:0.8px #5a2500; }
	.reveal.mult .reveal-label { font-size:14px; color:#ffe49a; bottom:6%; }
	.reveal.collector .reveal-label { bottom:6%; font-size:9px; letter-spacing:0.5px; -webkit-text-stroke:0.45px #2a1600; }
	.reveal.blank .reveal-label { color:#d8cba6; opacity:0.86; -webkit-text-stroke:0.5px #2a1600; }
	@keyframes reveal-pop { 0%{transform:scale(0.2);opacity:0;} 100%{transform:scale(1);opacity:1;} }
	.cell.mult-pulse .reveal { animation:feat-pulse 0.34s ease-in-out 2; }
	.cell.collect-pulse .reveal { animation:feat-pulse 0.4s ease-in-out 2; }
	@keyframes feat-pulse { 50%{transform:scale(1.22);filter:drop-shadow(0 0 12px #ffd96f);} }

	/* ---- free spins counter ---- */
	.fs-counter { position:absolute; top:89px; left:50%; transform:translateX(-50%); z-index:15; display:none;
		min-width:176px; padding:2px 18px 3px; border-radius:999px; border:2px solid #ffe49a; text-align:center;
		background:linear-gradient(180deg,#1c1305,#0a0a0f); box-shadow:0 0 18px rgba(255,200,60,0.5);
		color:#ffe49a; font-family:Inter,Arial,sans-serif; }
	.fs-counter.show { display:block; }
	.fs-counter .fs-name { font-size:8px; line-height:1.05; letter-spacing:1.5px; color:#ffd96f; }
	.fs-counter .fs-big { font-size:15px; font-weight:1000; color:#fff; line-height:1.05; }
	@media (orientation: landscape) and (max-height: 500px) {
		/* The logo and reel frame leave no vertical gap in short landscape
		   viewports. Dock the counter in the unused upper-right stadium area
		   so it never obscures either gameplay surface. */
		.fs-counter { left:86%; }
	}

	/* ---- bonus buy ---- */
	.bonusbuy-hero { position:relative; height:86px; margin:-2px 0 15px; border-radius:12px; overflow:hidden;
		border:1px solid rgba(213,162,59,0.55); background:linear-gradient(180deg,#1a1509,#07070a);
		box-shadow:0 0 18px rgba(255,191,44,0.13) inset; display:flex; align-items:center; justify-content:center; }
	.bonusbuy-hero img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; opacity:0.78; filter:saturate(1.15) contrast(1.08); }
	.bonusbuy-hero::after { content:''; position:absolute; inset:0; background:linear-gradient(90deg, rgba(0,0,0,0.42), rgba(0,0,0,0.08), rgba(0,0,0,0.42)); }
	.bonusbuy-title { position:relative; z-index:1; font-family:'Arial Black',Impact,sans-serif; font-size:26px; font-style:italic;
		color:#ffe49a; -webkit-text-stroke:1px #5a2500; text-shadow:0 3px 0 #4b2101, 0 0 16px rgba(255,200,60,0.8); letter-spacing:1px; }
	.bb-list { display:flex; flex-direction:column; gap:11px; }
	.bb-opt { display:flex; align-items:center; gap:14px; width:100%; position:relative; overflow:hidden;
		cursor:pointer; text-align:left; padding:13px 16px 13px 15px; border-radius:13px;
		border:1px solid rgba(213,162,59,0.45); border-left:4px solid var(--bb-accent,#d5a23b);
		background:linear-gradient(180deg, rgba(26,21,9,0.7), rgba(8,8,12,0.88)); color:#ffe9b8;
		transition:border-color .15s, transform .15s, box-shadow .15s; }
	.bb-opt::before { content:''; position:absolute; inset:0; background:linear-gradient(90deg, rgba(255,224,130,0.1), transparent 34%, rgba(255,255,255,0.04)); opacity:0.75; pointer-events:none; }
	.bb-opt:hover:not(.disabled) { border-color:#ffe49a; border-left-color:var(--bb-accent,#ffe49a);
		transform:translateY(-2px); box-shadow:0 8px 20px rgba(0,0,0,0.5), 0 0 18px rgba(255,191,44,0.18); }
	.bb-opt.disabled { opacity:0.42; cursor:not-allowed; }
	.bb-ico { width:44px; height:44px; flex:0 0 auto; display:grid; place-items:center; font-size:23px; border-radius:11px;
		border:1px solid rgba(255,224,130,0.45);
		background:radial-gradient(circle at 50% 30%, rgba(255,224,130,0.22), rgba(8,8,12,0.92));
		box-shadow:0 0 10px rgba(255,200,60,0.2) inset; position:relative; z-index:1; overflow:hidden; }
	.bb-ico img { width:82%; height:82%; object-fit:contain; filter:drop-shadow(0 3px 4px #000); }
	.bb-text { flex:1 1 auto; min-width:0; }
	.bb-name { font-size:16px; font-weight:800; letter-spacing:0.3px; }
	.bb-desc { font-size:12px; color:#c9bd97; margin-top:2px; line-height:1.35; }
	.bb-tag { display:inline-flex; margin-top:5px; padding:2px 8px; border-radius:999px; border:1px solid rgba(255,224,130,0.35);
		color:#ffd96f; background:rgba(12,10,5,0.7); font-size:10px; font-weight:900; letter-spacing:1px; text-transform:uppercase; }
	.bb-price { display:inline-flex; align-items:center; gap:5px; flex:0 0 auto; white-space:nowrap;
		font-size:16px; font-weight:1000; color:#241803; padding:8px 14px; border-radius:999px;
		background:linear-gradient(180deg,#ffe9a3,#e7b84e); box-shadow:0 2px 7px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.25) inset; }
	.bb-price::before { content:'\\26BD'; font-size:14px; }
	.bb-opt.disabled .bb-price { background:linear-gradient(180deg,#7a6f4a,#4a4330); color:#1a1206; box-shadow:none; }
	.bb-note { margin-top:15px; padding-top:12px; border-top:1px solid rgba(213,162,59,0.28);
		font-size:12px; color:#9b906f; text-align:center; line-height:1.55; }

	/* ---- animation FX layer (sparks / coin shower / fly-to-collector / flash) ---- */
	.fx-layer { position:absolute; inset:0; z-index:18; pointer-events:none; overflow:hidden; }
	.spark { position:absolute; width:11px; height:11px; border-radius:50%; transform:translate(-50%,-50%);
		background:radial-gradient(circle, #fff 0%, #ffe48a 38%, rgba(255,170,40,0) 72%); will-change:transform,opacity;
		animation:spark-fly var(--dur,0.6s) ease-out forwards; }
	@keyframes spark-fly { 0% { opacity:1; transform:translate(-50%,-50%) scale(1); }
		100% { opacity:0; transform:translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) scale(0.2); } }
	.coin-drop { position:absolute; top:-46px; width:34px; height:34px; background-size:contain; background-repeat:no-repeat;
		filter:drop-shadow(0 2px 4px rgba(0,0,0,0.6)); will-change:transform,opacity; animation:coin-fall var(--dur,1.6s) ease-in forwards; }
	@keyframes coin-fall { 0% { opacity:0; transform:translateY(0) rotate(0); }
		8% { opacity:1; } 88% { opacity:1; } 100% { opacity:0; transform:translateY(720px) rotate(var(--rot,540deg)); } }
	.fly-coin { position:absolute; width:42px; height:42px; z-index:19; background-size:contain; background-repeat:no-repeat;
		filter:drop-shadow(0 2px 4px #000); transform:translate(-50%,-50%); will-change:left,top,transform,opacity;
		transition:left .5s cubic-bezier(.45,-0.25,.6,1), top .5s cubic-bezier(.45,-0.25,.6,1), transform .5s ease, opacity .45s ease; }
	.cell.collect-burst .reveal img { animation:collect-burst 0.5s ease; }
	@keyframes collect-burst { 0%{transform:scale(1);} 38%{transform:scale(1.4);filter:drop-shadow(0 0 18px #ffd96f);} 100%{transform:scale(1);} }
	.fx-flash { position:absolute; inset:0; z-index:19; pointer-events:none; opacity:0;
		background:radial-gradient(circle at 50% 42%, rgba(255,242,205,0.92), rgba(255,200,80,0.25) 38%, transparent 68%); }
	.fx-flash.go { animation:fx-flash 0.6s ease-out; }
	@keyframes fx-flash { 0%{opacity:0;} 16%{opacity:1;} 100%{opacity:0;} }
	/* tiered big-win banner */
	.win-banner.mega { border-color:#ffd24a; color:#ffe9a3; box-shadow:0 0 52px rgba(255,180,40,0.75), inset 0 0 26px rgba(255,200,60,0.3); }
	.win-banner.epic { border-color:#ffcaff; color:#fff0c2;
		box-shadow:0 0 64px rgba(255,150,40,0.85), 0 0 40px rgba(190,120,255,0.5), inset 0 0 30px rgba(255,200,60,0.35);
		animation:epic-throb 0.7s ease-in-out infinite alternate; }
	@keyframes epic-throb { from{transform:translate(-50%,0) scale(1);} to{transform:translate(-50%,0) scale(1.05);} }

	/* ---- bonus intro overlay ---- */
	.bonus-intro { position:absolute; inset:0; z-index:40; display:none; place-items:center; pointer-events:none; overflow:hidden;
		background:radial-gradient(ellipse 70% 60% at 50% 45%, rgba(34,22,4,0.82), rgba(2,2,4,0.95)); }
	.bonus-intro.show { display:grid; pointer-events:auto; cursor:pointer; animation:bi-fade 0.4s ease both; }
	.bonus-intro.out { animation:bi-fade 0.4s ease reverse both; }
	@keyframes bi-fade { from{opacity:0;} to{opacity:1;} }
	.bi-rays { position:absolute; width:1000px; height:1000px; left:50%; top:46%; transform:translate(-50%,-50%);
		background:repeating-conic-gradient(from 0deg, rgba(255,212,90,0.15) 0 8deg, transparent 8deg 21deg,
			rgba(255,212,90,0.13) 21deg 28deg, transparent 28deg 42deg);
		border-radius:50%; animation:bi-spin 16s linear infinite; }
	@keyframes bi-spin { to { transform:translate(-50%,-50%) rotate(360deg); } }
	.bi-card { position:relative; text-align:center; transform:scale(0.8);
		animation:bi-pop 0.6s cubic-bezier(.2,.9,.3,1.5) 0.1s both; }
	.bi-kicker { font-size:18px; letter-spacing:7px; color:#ffd96f; font-weight:800; text-transform:uppercase;
		text-shadow:0 2px 4px #000; margin-bottom:12px; }
	.bi-title { font-family:'Arial Black',Impact,sans-serif; font-style:italic; font-size:58px; font-weight:1000;
		color:#ffe49a; -webkit-text-stroke:2px #4b2101; text-shadow:0 4px 0 #5a2500, 0 0 32px rgba(255,200,60,0.9);
		line-height:1.05; white-space:nowrap; }
	.bi-spins { margin-top:16px; font-size:30px; font-weight:1000; color:#fff; letter-spacing:2px;
		text-shadow:0 2px 3px #000, 0 0 16px rgba(255,200,60,0.8); }
	.bi-continue { margin-top:22px; font-size:13px; font-weight:900; letter-spacing:3px; color:#ffd96f;
		text-shadow:0 2px 4px #000; animation:bi-pulse 1.1s ease-in-out infinite; }
	@keyframes bi-pulse { 0%,100%{opacity:0.48;} 50%{opacity:1;} }
	@keyframes bi-pop { from{transform:scale(0.6);opacity:0;} to{transform:scale(1);opacity:1;} }

	/* ---- rainbow activation sweep ---- */
	.fx-sweep { position:absolute; width:68px; border-radius:40px; z-index:19; pointer-events:none; filter:blur(2px);
		background:linear-gradient(90deg, transparent, rgba(170,225,255,0.55) 28%, rgba(255,255,242,0.96) 50%, rgba(255,222,140,0.6) 72%, transparent);
		box-shadow:0 0 34px rgba(255,240,205,0.75); transform:translateX(-84px); animation:fx-sweep var(--dur,0.58s) ease-in-out forwards; }
	@keyframes fx-sweep { from{ transform:translateX(-84px); opacity:0; } 14%{opacity:1;} 86%{opacity:1;}
		to{ transform:translateX(var(--travel,600px)); opacity:0; } }
	.cell.activating::before { animation:golden-activate 0.55s ease both !important; }
	@keyframes golden-activate { 0%{opacity:0.8;}
		35%{opacity:1; box-shadow:0 0 32px rgba(255,240,160,1), inset 0 0 24px rgba(255,225,130,0.95); transform:scale(1.04);}
		100%{opacity:1; transform:scale(1);} }

	/* ---- scatter anticipation (2+ scatters build tension before the trigger) ---- */
	.stage.antic .cell { filter:brightness(0.58) saturate(0.82); transition:filter .28s ease; }
	.stage.antic .cell.scatter-antic { filter:none; }
	.cell.scatter-antic { z-index:6; }
	.cell.scatter-antic img { animation:scatter-antic 0.5s ease-in-out infinite !important;
		filter:drop-shadow(0 0 14px rgba(130,205,255,0.95)) drop-shadow(0 0 24px rgba(255,210,90,0.85)) !important; }
	@keyframes scatter-antic { 0%,100%{transform:scale(1);} 50%{transform:scale(1.16);} }
	.cell.scatter-antic::after { content:''; position:absolute; inset:-2px; border-radius:8px; pointer-events:none;
		border:2px solid rgba(140,210,255,0.9); box-shadow:0 0 18px rgba(120,200,255,0.85), inset 0 0 10px rgba(255,225,140,0.6);
		animation:scatter-ring 0.7s ease-in-out infinite; }
	@keyframes scatter-ring { 0%,100%{opacity:0.45; transform:scale(1);} 50%{opacity:1; transform:scale(1.07);} }
	.cell.scatter-hit img { animation:scatter-hit 0.4s ease !important; }
	@keyframes scatter-hit { 0%{transform:scale(1.16);} 45%{transform:scale(1.42); filter:drop-shadow(0 0 32px #fff) drop-shadow(0 0 20px #ffd96f) !important;} 100%{transform:scale(1.16);} }

	/* ---- win-level escalation: Super Mega + Golden Goal takeover ---- */
	.win-banner.takeover { border-color:#fff0b0; color:#fff;
		box-shadow:0 0 80px rgba(255,170,40,0.95), 0 0 56px rgba(255,90,40,0.55), inset 0 0 34px rgba(255,210,90,0.4);
		animation:takeover-throb 0.55s ease-in-out infinite alternate; }
	@keyframes takeover-throb { from{transform:translate(-50%,0) scale(1);} to{transform:translate(-50%,0) scale(1.08);} }
	.top-light.burst { animation:light-burst 0.85s ease-out; }
	@keyframes light-burst { 0%{opacity:var(--lo,0.5);} 22%{opacity:1; filter:brightness(1.8);} 100%{opacity:var(--lo,0.5); filter:brightness(1);} }
	/* bonus mode gives the whole stage a warm golden grade + vignette */
	.stage.bonus-mode::after { content:''; position:absolute; inset:0; z-index:4; pointer-events:none;
		background:radial-gradient(ellipse 80% 75% at 50% 42%, rgba(255,180,40,0.1), transparent 55%),
			radial-gradient(ellipse 100% 100% at 50% 50%, transparent 52%, rgba(60,30,0,0.5) 100%);
		animation:bonus-grade 0.6s ease both; }
	@keyframes bonus-grade { from{opacity:0;} to{opacity:1;} }

	/* ---- retrigger toast ---- */
	.rt-toast { position:absolute; top:200px; left:50%; transform:translate(-50%,-12px) scale(0.9); z-index:42;
		opacity:0; pointer-events:none; padding:12px 30px 14px; border-radius:14px; text-align:center;
		border:2px solid #6cf0ff; background:linear-gradient(180deg,#06243a,#0a0a0f);
		box-shadow:0 0 34px rgba(70,200,255,0.55), inset 0 0 18px rgba(70,200,255,0.2);
		transition:opacity .3s ease, transform .35s cubic-bezier(.2,.9,.3,1.5); }
	.rt-toast.show { opacity:1; transform:translate(-50%,0) scale(1); }
	.rt-toast .rt-big { font-family:'Arial Black',Impact,sans-serif; font-style:italic; font-size:30px; font-weight:1000;
		color:#bff0ff; text-shadow:0 2px 3px #000, 0 0 18px rgba(90,210,255,0.9); letter-spacing:1px; }
	.rt-toast .rt-sub { font-size:13px; letter-spacing:3px; color:#7fd6ff; font-weight:800; text-transform:uppercase; margin-top:2px; }

	/* ---- bonus end summary ---- */
	.bonus-summary { position:absolute; inset:0; z-index:44; display:none; place-items:center; overflow:hidden;
		background:radial-gradient(ellipse 70% 60% at 50% 45%, rgba(30,20,4,0.9), rgba(2,2,4,0.97)); }
	.bonus-summary.show { display:grid; animation:bi-fade 0.4s ease both; }
	.bs-card { position:relative; width:min(440px,86%); padding:26px 30px 24px; border-radius:18px; text-align:center;
		border:2px solid #d5a23b; background:linear-gradient(180deg,#1a160c,#08080a);
		box-shadow:0 0 0 4px #050505, 0 24px 60px rgba(0,0,0,0.8), 0 0 50px rgba(255,191,44,0.32);
		animation:bi-pop 0.55s cubic-bezier(.2,.9,.3,1.5) 0.05s both; }
	.bs-kicker { font-size:14px; letter-spacing:5px; color:#ffd96f; font-weight:800; text-transform:uppercase; }
	.bs-total { font-family:'Arial Black',Impact,sans-serif; font-style:italic; font-size:52px; font-weight:1000; line-height:1.1;
		color:#ffe49a; -webkit-text-stroke:2px #4b2101; text-shadow:0 3px 0 #5a2500, 0 0 28px rgba(255,200,60,0.9); margin:6px 0 4px; }
	.bs-total small { display:block; font-size:13px; letter-spacing:3px; color:#fff; -webkit-text-stroke:0; text-shadow:0 2px 2px #000; margin-bottom:2px; }
	.bs-stats { display:flex; gap:10px; margin:16px 0 20px; }
	.bs-stat { flex:1; padding:11px 8px; border-radius:11px; border:1px solid rgba(213,162,59,0.4); background:rgba(8,8,12,0.7); }
	.bs-stat .v { font-size:21px; font-weight:1000; color:#ffd96f; }
	.bs-stat .l { font-size:11px; letter-spacing:1px; color:#c9bd97; text-transform:uppercase; margin-top:2px; }
	.bs-continue { cursor:pointer; padding:13px 40px; border-radius:12px; font-size:17px; font-weight:900; letter-spacing:1.5px;
		color:#241803; border:0; background:linear-gradient(180deg,#ffe9a3,#e7b84e);
		box-shadow:0 4px 0 #9a6f1e, 0 8px 16px rgba(0,0,0,0.5); transition:transform .12s, box-shadow .12s; }
	.bs-continue:hover { transform:translateY(-1px); box-shadow:0 5px 0 #9a6f1e, 0 10px 18px rgba(0,0,0,0.55); }
	.bs-continue:active { transform:translateY(3px); box-shadow:0 1px 0 #9a6f1e, 0 4px 10px rgba(0,0,0,0.5); }

	/* ---- bonus buy confirm ---- */
	.bb-confirm { margin-top:14px; padding:16px; border-radius:13px; border:1px solid rgba(213,162,59,0.5);
		background:linear-gradient(180deg, rgba(40,30,10,0.92), rgba(8,8,12,0.95)); text-align:center; }
	.bb-confirm .c-q { font-size:14px; color:#f1e4c6; line-height:1.5; margin-bottom:13px; }
	.bb-confirm .c-q b { color:#ffd96f; }
	.bb-confirm .c-row { display:flex; gap:10px; }
	.bb-confirm button { flex:1; cursor:pointer; padding:12px; border-radius:10px; font-size:15px; font-weight:900; letter-spacing:0.5px; }
	.bb-confirm .c-yes { color:#241803; border:0; background:linear-gradient(180deg,#ffe9a3,#e7b84e); box-shadow:0 3px 0 #9a6f1e; }
	.bb-confirm .c-no { color:#ffe9b8; border:1px solid rgba(213,162,59,0.5); background:rgba(8,8,12,0.85); }
	.bb-confirm .c-yes:active { transform:translateY(2px); box-shadow:0 1px 0 #9a6f1e; }
	.auto-options { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin:16px 0; }
	.auto-option { min-height:46px; padding:10px; border-radius:11px; border:1px solid rgba(213,162,59,0.46);
		background:linear-gradient(180deg, rgba(26,21,9,0.7), rgba(8,8,12,0.9)); color:#ffe9b8;
		font-size:15px; font-weight:900; cursor:pointer; }
	.auto-option.selected { border-color:#ffe49a; color:#241803; background:linear-gradient(180deg,#ffe9a3,#e7b84e); }
	.auto-confirm { display:none; margin-top:13px; padding:14px; border-radius:12px; border:1px solid rgba(213,162,59,0.5);
		background:rgba(8,8,12,0.72); text-align:center; }
	.auto-confirm.show { display:block; }
	.auto-confirm p { margin:0 0 12px; color:#f1e4c6; font-size:14px; line-height:1.45; }
	.auto-confirm-row { display:flex; gap:10px; }
	.auto-confirm-row button { flex:1; padding:11px; border-radius:10px; font-size:15px; font-weight:900; cursor:pointer; }
	.auto-confirm-row .confirm { color:#241803; border:0; background:linear-gradient(180deg,#ffe9a3,#e7b84e); box-shadow:0 3px 0 #9a6f1e; }
	.auto-confirm-row .cancel { color:#ffe9b8; border:1px solid rgba(213,162,59,0.5); background:rgba(8,8,12,0.85); }
	.replay-modal { width:min(560px,92vw); }
	.replay-kicker { display:inline-flex; align-items:center; justify-content:center; min-width:126px; margin:0 auto 14px; padding:8px 22px;
		border-radius:999px; color:#241803; background:linear-gradient(180deg,#ffe55f,#ffad10); font-size:14px; font-weight:1000; letter-spacing:4px; }
	.replay-title { margin:0 0 20px; color:#f7f7ff; font-size:34px; line-height:1.1; text-align:center; font-weight:1000; }
	.replay-card { padding:17px 19px; border-radius:12px; background:rgba(8,10,24,0.92); box-shadow:inset 0 0 0 1px rgba(255,255,255,0.04); }
	.replay-row { display:flex; justify-content:space-between; gap:16px; padding:10px 0; color:#aaaec1; font-size:16px; line-height:1.25; border-bottom:1px solid rgba(255,255,255,0.12); }
	.replay-row:last-child { border-bottom:0; }
	.replay-row strong { color:#ffe450; font-size:18px; text-align:right; }
	.replay-row.highlight { margin:8px -8px; padding:12px 8px; border-radius:9px; border-bottom:0; background:rgba(255,226,70,0.08); }
	.replay-row.win strong { color:#20d884; }
	.replay-start { width:100%; margin-top:22px; padding:15px 18px; border:0; border-radius:12px; cursor:pointer; color:#1b2032;
		background:linear-gradient(90deg,#ffe600,#ff9c0a); box-shadow:0 4px 0 #9a6f1e; font-size:22px; font-weight:1000; }
	.replay-start:focus,
	.replay-start:focus-visible { outline:4px solid #fff; outline-offset:3px; }
	.replay-note { margin:16px 0 0; color:#8d91a8; font-size:13px; text-align:center; line-height:1.45; }
	.replay-metadata { display:none; margin-top:18px; text-align:left; }
	.replay-metadata[aria-hidden="false"] { display:block; }
	.replay-control-panel { display:none; position:relative; align-items:center; justify-content:space-between; gap:calc(18px * var(--stage-inv-scale,1));
		width:calc(520px * var(--stage-inv-scale,1)); min-height:calc(76px * var(--stage-inv-scale,1));
		padding:calc(10px * var(--stage-inv-scale,1)) calc(14px * var(--stage-inv-scale,1)) calc(10px * var(--stage-inv-scale,1)) calc(20px * var(--stage-inv-scale,1));
		border:2px solid #d5a23b; border-radius:15px;
		background:linear-gradient(180deg,rgba(28,25,15,.98),rgba(6,7,10,.98));
		box-shadow:inset 0 0 0 2px #050505,0 0 18px rgba(255,194,48,.28),0 6px 16px rgba(0,0,0,.7); }
	.replay-control-copy { min-width:0; display:grid; gap:4px; color:#fff; font-family:Inter,Arial,sans-serif; }
	.replay-control-copy strong { color:#ffe36e; font-size:calc(16px * var(--stage-inv-scale,1)); font-weight:1000; letter-spacing:1.2px; }
	.replay-control-copy small { overflow:hidden; color:#d6c69e; font-size:calc(12px * var(--stage-inv-scale,1)); line-height:1.25; text-overflow:ellipsis; white-space:nowrap; }
	.replay-currency-code { display:inline-flex; align-items:center; justify-content:center; min-width:44px; margin-left:6px;
		padding:3px 7px; border:1px solid rgba(255,226,110,.5); border-radius:999px; color:#fff2b6; font-weight:900; }
	.replay-action { flex:0 0 auto; min-width:calc(178px * var(--stage-inv-scale,1)); min-height:calc(54px * var(--stage-inv-scale,1)); padding:10px 18px; border:2px solid #fff0a6; border-radius:12px;
		background:linear-gradient(180deg,#ffe862,#f4a817); color:#211704; box-shadow:0 4px 0 #8c621a,0 0 18px rgba(255,207,62,.3);
		font-size:calc(18px * var(--stage-inv-scale,1)); font-weight:1000; letter-spacing:.5px; cursor:pointer; }
	.replay-action:hover { filter:brightness(1.07); transform:translateY(-1px); }
	.replay-action:active { transform:translateY(2px); box-shadow:0 1px 0 #8c621a; }
	.replay-action:focus,
	.replay-action:focus-visible { outline:calc(4px * var(--stage-inv-scale,1)) solid #fff; outline-offset:calc(3px * var(--stage-inv-scale,1)); }
	.replay-action[hidden] { display:none !important; }
	.replay-overlay { position:absolute; inset:0; z-index:92; display:none; place-items:center; padding:28px;
		background:rgba(0,0,0,.84); -webkit-backdrop-filter:blur(4px); backdrop-filter:blur(4px); pointer-events:auto; }
	.stage.replay-mode[data-replay-state="loading"] .replay-overlay,
	.stage.replay-mode[data-replay-state="ready"] .replay-overlay,
	.stage.replay-mode[data-replay-state="completed"] .replay-overlay,
	.stage.replay-mode[data-replay-state="error"] .replay-overlay { display:grid; }
	.replay-overlay-card { width:min(560px,92vw); padding:30px; transform:scale(var(--stage-inv-scale,1)); border:2px solid #d5a23b;
		border-radius:18px; background:linear-gradient(180deg,#1b170d,#060709); box-shadow:0 0 0 4px #050505,0 26px 70px #000,0 0 38px rgba(255,194,48,.26);
		color:#f8edcf; text-align:center; font-family:Inter,Arial,sans-serif; }
	.replay-spinner { width:52px; height:52px; margin:0 auto 18px; border:5px solid rgba(255,226,100,.2); border-top-color:#ffe264; border-radius:50%;
		animation:replay-spin .9s linear infinite; }
	@keyframes replay-spin { to { transform:rotate(360deg); } }
	.replay-overlay-title { color:#ffe36e; font-size:26px; font-weight:1000; letter-spacing:1.4px; text-transform:uppercase; }
	.replay-overlay-detail { margin-top:10px; color:#e8d9b5; font-size:15px; line-height:1.45; }
	.stage.replay-mode[data-replay-state="error"] .replay-spinner { display:none; }
	.stage.replay-mode[data-replay-state="ready"] .replay-spinner,
	.stage.replay-mode[data-replay-state="completed"] .replay-spinner,
	.stage.replay-mode[data-replay-state="ready"] .replay-overlay-detail,
	.stage.replay-mode[data-replay-state="completed"] .replay-overlay-detail { display:none; }
	.stage.replay-mode .replay-control-panel { display:flex; }
	.stage.replay-mode[data-replay-state="ready"] .replay-control-panel,
	.stage.replay-mode[data-replay-state="completed"] .replay-control-panel { display:none; }
	.stage.replay-mode .meter[data-meter="balance"],
	.stage.replay-mode #btn-bonus,
	.stage.replay-mode #btn-auto,
	.stage.replay-mode .feature-control,
	.stage.replay-mode #btn-spin,
	.stage.replay-mode #bet-controls { display:none !important; }
	.stage.replay-mode .meters { width:570px; left:calc(315px + var(--stage-x-shift,0px)); grid-template-columns:repeat(2,minmax(0,1fr)); }
	.stage.replay-mode .controls { bottom:0; justify-content:center; align-items:center; gap:calc(12px * var(--stage-inv-scale,1)); }
	.stage.replay-mode #btn-turbo { margin-right:0; }
	.stage.replay-mode[data-replay-state="running"] .replay-action,
	.stage.replay-mode[data-replay-state="loading"] .replay-action,
	.stage.replay-mode[data-replay-state="error"] .replay-action { display:none !important; }
	.stage.replay-mode[data-replay-state="error"] .replay-control-panel { opacity:.55; pointer-events:none; }
	@media (min-width: 701px) and (orientation: portrait) {
		.stage.replay-mode .controls { bottom:calc(12px * var(--stage-inv-scale,1)); }
	}
	@media (max-height: 520px) and (orientation: landscape) {
		.replay-overlay { padding:6px; }
		.replay-overlay-card { width:min(760px,94vw); padding:8px 16px; }
		.replay-overlay-title { font-size:18px; }
		.replay-metadata { margin-top:4px; }
		.replay-card { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); column-gap:18px; padding:6px 12px; }
		.replay-row { min-width:0; padding:5px 0; font-size:13px; }
		.replay-row strong { font-size:14px; }
		.replay-row.highlight { margin:0; padding:5px 6px; }
		.replay-start { margin-top:7px; padding:8px 14px; font-size:17px; }
		.replay-note { margin-top:6px; font-size:10px; line-height:1.2; }
		.stage.replay-mode .replay-control-panel {
			width:calc(390px * var(--stage-inv-scale,1));
			min-height:calc(44px * var(--stage-inv-scale,1));
			padding:calc(3px * var(--stage-inv-scale,1)) calc(8px * var(--stage-inv-scale,1));
			gap:calc(8px * var(--stage-inv-scale,1));
		}
		.stage.replay-mode .replay-control-copy { gap:calc(2px * var(--stage-inv-scale,1)); }
		.stage.replay-mode .replay-control-copy strong { font-size:calc(11px * var(--stage-inv-scale,1)); letter-spacing:.8px; }
		.stage.replay-mode .replay-control-copy small { font-size:calc(10px * var(--stage-inv-scale,1)); }
		.stage.replay-mode .replay-currency-code { min-width:calc(32px * var(--stage-inv-scale,1)); padding:calc(1px * var(--stage-inv-scale,1)) calc(5px * var(--stage-inv-scale,1)); }
		.stage.replay-mode .replay-action {
			min-width:calc(128px * var(--stage-inv-scale,1));
			min-height:calc(36px * var(--stage-inv-scale,1));
			padding:calc(5px * var(--stage-inv-scale,1)) calc(8px * var(--stage-inv-scale,1));
			font-size:calc(13px * var(--stage-inv-scale,1));
		}
	}
	.notice-copy { color:#f1e4c6; font-size:15px; line-height:1.5; text-align:center; }
	.notice-copy strong { color:#ffe49a; }
	.interrupted-copy { max-width:500px; color:#f1e4c6; font-size:16px; line-height:1.5; text-align:center; }
	.interrupted-actions { display:flex; justify-content:center; margin-top:18px; }
	.interrupted-actions button { min-width:150px; padding:12px 18px; border-radius:10px; color:#241803;
		border:0; background:linear-gradient(180deg,#ffe9a3,#e7b84e); box-shadow:0 3px 0 #9a6f1e;
		font-size:16px; font-weight:1000; cursor:pointer; }
	.controls-guide { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
	.control-rule { display:flex; align-items:center; gap:12px; min-width:0; padding:10px; border-radius:11px;
		border:1px solid rgba(213,162,59,0.28); background:linear-gradient(180deg, rgba(26,21,9,0.48), rgba(8,8,12,0.78)); }
	.control-rule img { width:42px; height:42px; object-fit:contain; flex:0 0 auto; filter:drop-shadow(0 2px 3px #000); }
	.control-rule div { min-width:0; color:#d8cba6; font-size:12px; line-height:1.45; }
	.control-rule b { display:block; color:#ffe49a; font-size:13px; margin-bottom:2px; }
	@media (max-width: 620px) {
		.auto-options, .controls-guide { grid-template-columns:1fr; }
		/* vw/vh are real screen units: combined with the base .modal counter-scale
		   (net scale 1) the dialog fills ~94% of the phone screen and stays
		   readable instead of inheriting the stage's ~0.33 downscale. */
		.modal { width:min(560px,94vw); max-height:min(92%,86vh); }
	}

	/* ===== Mobile portrait: playable layout ===================================
	   fitViewport() detects portrait phones, switches the stage to a
	   board-first scale (board ≈ 94vw, max 460px) and adds .mobile-portrait.
	   All sizes below multiply by --stage-inv-scale (1/stage scale), so they
	   render at FIXED on-screen pixel sizes on every phone width: 44px+ touch
	   targets, 66px spin, readable HUD — layout/scaling only, no logic. */
	.stage.mobile-portrait {
		--mobile-control-size: calc(50px * var(--stage-inv-scale, 1));
		--mobile-spin-size: calc(66px * var(--stage-inv-scale, 1));
		--mobile-hud-font-size: calc(13px * var(--stage-inv-scale, 1));
		--mobile-hud-height: calc(44px * var(--stage-inv-scale, 1));
		--mobile-gap: calc(7px * var(--stage-inv-scale, 1));
		--mobile-bottom-safe-padding: calc((8px + env(safe-area-inset-bottom, 0px)) * var(--stage-inv-scale, 1));
	}
	/* HUD: readable balance/bet/win directly under the board */
	.stage.mobile-portrait .meters { gap: calc(6px * var(--stage-inv-scale, 1)); }
	.stage.mobile-portrait .meter { height: var(--mobile-hud-height); gap: calc(4px * var(--stage-inv-scale, 1)); }
	.stage.mobile-portrait .meter > div { min-width: 0; }
	.stage.mobile-portrait .meter-label { font-size: calc(9px * var(--stage-inv-scale, 1)); letter-spacing: 0.4px; }
	.stage.mobile-portrait .meter-value { margin-top: calc(2px * var(--stage-inv-scale, 1)); font-size: var(--mobile-hud-font-size); }
	.stage.mobile-portrait .meter-currency-symbol { min-width: calc(16px * var(--stage-inv-scale, 1)); height: auto; font-size: calc(12px * var(--stage-inv-scale, 1)); }
	.stage.mobile-portrait .meter-asset-icon { width: calc(18px * var(--stage-inv-scale, 1)); height: calc(18px * var(--stage-inv-scale, 1)); }
	/* Bottom controls: same buttons, full-width wrap into 2 rows, thumb-sized */
	.stage.mobile-portrait .controls {
		left: 50%;
		bottom: var(--mobile-bottom-safe-padding);
		width: calc(100vw * var(--stage-inv-scale, 1));
		height: auto;
		padding: 0 calc(4px * var(--stage-inv-scale, 1));
		transform: translateX(-50%);
		flex-wrap: wrap;
		justify-content: center;
		align-items: center;
		gap: calc(6px * var(--stage-inv-scale, 1)) var(--mobile-gap);
	}
	.stage.mobile-portrait .asset-button,
	.stage.mobile-portrait .icon-button {
		width: var(--mobile-control-size);
		height: calc(48px * var(--stage-inv-scale, 1));
		margin: 0;
		grid-template-rows: 1fr;
	}
	.stage.mobile-portrait .asset-button.bonus { width: calc(56px * var(--stage-inv-scale, 1)); }
	.stage.mobile-portrait .spin-button {
		width: var(--mobile-spin-size);
		height: var(--mobile-spin-size);
		margin: 0;
		align-self: center;
		font-size: calc(13px * var(--stage-inv-scale, 1));
	}
	.stage.mobile-portrait .spin-button span { margin-top: calc(19px * var(--stage-inv-scale, 1)); }
	.stage.mobile-portrait .bet-controls {
		position: relative;
		width: calc(150px * var(--stage-inv-scale, 1));
		height: calc(48px * var(--stage-inv-scale, 1));
		margin: 0;
		grid-template-columns: calc(46px * var(--stage-inv-scale, 1)) 1fr calc(46px * var(--stage-inv-scale, 1));
	}
	/* only the minus/plus glyphs — the panel frame art must keep filling the box */
	.stage.mobile-portrait .bet-controls button img { width: calc(22px * var(--stage-inv-scale, 1)); height: calc(22px * var(--stage-inv-scale, 1)); }
	.stage.mobile-portrait .bet-controls .button-art { position: absolute; inset: 0; width: 100%; height: 100%; }
	.stage.mobile-portrait .bet-display span { font-size: calc(8px * var(--stage-inv-scale, 1)); }
	.stage.mobile-portrait .bet-display strong { font-size: calc(12px * var(--stage-inv-scale, 1)); }
	.stage.mobile-portrait .feature-control { width: calc(96px * var(--stage-inv-scale, 1)); height: calc(46px * var(--stage-inv-scale, 1)); }
	.stage.mobile-portrait .feature-items { width: calc(90px * var(--stage-inv-scale, 1)); gap: calc(2px * var(--stage-inv-scale, 1)); }
	.stage.mobile-portrait .feature-item img { width: calc(16px * var(--stage-inv-scale, 1)); height: calc(16px * var(--stage-inv-scale, 1)); }
	.stage.mobile-portrait .feature-item span { font-size: calc(6px * var(--stage-inv-scale, 1)); }
	.stage.mobile-portrait.replay-mode .meters {
		left:50%; width:min(calc(94vw * var(--stage-inv-scale,1)),calc(570px * var(--stage-inv-scale,1))); transform:translateX(-50%);
	}
	.stage.mobile-portrait.replay-mode .replay-control-panel {
		order:-1; width:min(calc(94vw * var(--stage-inv-scale,1)),calc(430px * var(--stage-inv-scale,1))); min-height:calc(68px * var(--stage-inv-scale,1));
		padding:calc(7px * var(--stage-inv-scale,1)) calc(9px * var(--stage-inv-scale,1)); gap:calc(7px * var(--stage-inv-scale,1));
	}
	.stage.mobile-portrait.replay-mode .replay-control-copy { gap:calc(2px * var(--stage-inv-scale,1)); }
	.stage.mobile-portrait.replay-mode .replay-control-copy strong { font-size:calc(12px * var(--stage-inv-scale,1)); }
	.stage.mobile-portrait.replay-mode .replay-control-copy small { font-size:calc(11px * var(--stage-inv-scale,1)); white-space:normal; }
	.stage.mobile-portrait.replay-mode .replay-currency-code { min-width:calc(36px * var(--stage-inv-scale,1)); margin-left:calc(3px * var(--stage-inv-scale,1)); padding:calc(2px * var(--stage-inv-scale,1)) calc(5px * var(--stage-inv-scale,1)); }
	.stage.mobile-portrait.replay-mode .replay-action { min-width:calc(130px * var(--stage-inv-scale,1)); min-height:calc(48px * var(--stage-inv-scale,1)); padding:calc(7px * var(--stage-inv-scale,1)); font-size:calc(14px * var(--stage-inv-scale,1)); }

	/* ===== Cinematic launch sequence ===========================================
	   The main scenic imagery is raster artwork. Canvas only supplies the
	   lightweight atmosphere (gold dust and real light falloff); it is never a
	   substitute for the scene art. */
	.cinematic-intro { position:fixed; inset:0; z-index:300; overflow:hidden; isolation:isolate; background:#020406; color:#fff; }
	.cinematic-intro[hidden] { display:none !important; }
	.cinematic-intro.is-leaving { pointer-events:none; animation:intro-exit .48s cubic-bezier(.2,.7,.2,1) both; }
	.intro-backdrop, .intro-backdrop picture, .intro-backdrop img { position:absolute; inset:0; width:100%; height:100%; }
	.intro-backdrop img { object-fit:cover; object-position:50% 50%; filter:brightness(.66) saturate(.92); transform:scale(var(--intro-camera-from,1.14)); will-change:transform,filter; }
	.cinematic-intro[data-scene] .intro-backdrop img { animation:intro-camera var(--intro-scene-duration,1200ms) cubic-bezier(.22,.72,.12,1) both; }
	.intro-backdrop .intro-mobile-art { display:none; }
	.intro-atmosphere { position:absolute; inset:0; width:100%; height:100%; pointer-events:none; mix-blend-mode:screen; }
	.intro-vignette { position:absolute; inset:0; pointer-events:none; background:linear-gradient(180deg,rgba(0,0,0,.56),transparent 36%,rgba(0,0,0,.18) 62%,rgba(0,0,0,.82)); }
	.intro-content { position:relative; z-index:2; display:grid; min-height:100%; place-items:center; padding:max(24px,env(safe-area-inset-top,0px)) max(24px,env(safe-area-inset-right,0px)) max(24px,env(safe-area-inset-bottom,0px)) max(24px,env(safe-area-inset-left,0px)); }
	.intro-stage { width:min(720px,100%); display:grid; justify-items:center; text-align:center; }
	.intro-wordmark { width:min(500px,82vw); opacity:0; transform:translateY(18px) scale(.96); filter:drop-shadow(0 9px 22px rgba(0,0,0,.88)); }
	.cinematic-intro[data-scene="title"] .intro-wordmark,
	.cinematic-intro[data-scene="ready"] .intro-wordmark { opacity:1; transform:none; transition:opacity .48s ease,transform .58s cubic-bezier(.16,.8,.24,1); }
	.intro-scene-copy { min-height:1.4em; margin:18px 0 0; color:#f6dea0; font-family:Arial,sans-serif; font-size:clamp(11px,1.25vw,16px); font-weight:800; letter-spacing:.22em; text-shadow:0 2px 16px #000; }
	.intro-ready { width:min(540px,100%); display:grid; justify-items:center; gap:16px; margin-top:28px; opacity:0; transform:translateY(18px); pointer-events:none; }
	.cinematic-intro[data-scene="ready"] .intro-ready { opacity:1; transform:none; pointer-events:auto; transition:opacity .38s ease,transform .48s cubic-bezier(.16,.8,.24,1); }
	.intro-ready-title { margin:0; color:#fff4cb; font-family:Arial Black,Impact,sans-serif; font-size:clamp(18px,3vw,29px); letter-spacing:.08em; text-shadow:0 3px 20px #000; }
	.intro-sound-prompt { margin:0; color:#e3d3a4; font-size:14px; }
	.intro-actions { width:min(500px,100%); display:grid; grid-template-columns:1fr 1fr; gap:12px; }
	.intro-action { min-height:58px; border:1px solid rgba(255,224,138,.78); border-radius:10px; padding:12px 16px; color:#241703; background:linear-gradient(180deg,#fff0a9,#d49a22); box-shadow:inset 0 1px 0 rgba(255,255,255,.85),0 9px 26px rgba(0,0,0,.38),0 0 20px rgba(229,175,48,.26); cursor:pointer; font-family:Arial Black,Impact,sans-serif; font-size:14px; letter-spacing:.08em; transition:transform .18s ease,filter .18s ease,box-shadow .18s ease; }
	.intro-action:hover { transform:translateY(-2px); filter:brightness(1.06); box-shadow:inset 0 1px 0 rgba(255,255,255,.95),0 13px 30px rgba(0,0,0,.46),0 0 30px rgba(255,209,88,.38); }
	.intro-action:active { transform:translateY(1px); }
	.intro-action.secondary { color:#f8e6b0; background:rgba(4,9,13,.72); }
	.intro-action:focus-visible, .intro-skip:focus-visible { outline:3px solid #fff; outline-offset:4px; }
	.intro-progress-wrap { width:min(420px,82vw); display:grid; gap:8px; margin-top:18px; opacity:.98; }
	.intro-progress { width:100%; height:4px; accent-color:#f0c64d; }
	.intro-progress-label { color:#d7c99f; font-size:11px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; }
	.cinematic-intro[data-scene="ready"] .intro-progress-wrap { display:none; }
	.intro-skip { position:absolute; right:max(18px,env(safe-area-inset-right,0px)); top:max(18px,env(safe-area-inset-top,0px)); z-index:3; min-height:44px; border:0; padding:10px 12px; color:#eadfb9; background:transparent; cursor:pointer; font-family:Arial,sans-serif; font-size:11px; font-weight:800; letter-spacing:.14em; opacity:0; pointer-events:none; transition:opacity .2s ease,color .2s ease; }
	.intro-skip.is-available { opacity:.9; pointer-events:auto; }
	.intro-skip:hover { color:#fff3c8; }
	@keyframes intro-camera { from { transform:scale(var(--intro-camera-from,1.14)); filter:brightness(.58) saturate(.84); } to { transform:scale(var(--intro-camera-to,1)); filter:brightness(.8) saturate(1); } }
	@keyframes intro-exit { to { opacity:0; transform:scale(1.018); } }
	@media (max-width:700px) and (orientation:portrait) {
		.intro-backdrop .intro-desktop-art { display:none; }
		.intro-backdrop .intro-mobile-art { display:block; object-position:50% 50%; }
		.intro-wordmark { width:min(430px,88vw); }
		.intro-stage { align-content:center; }
		.intro-actions { grid-template-columns:1fr; }
		.intro-ready { margin-top:22px; }
	}
	@media (prefers-reduced-motion:reduce) {
		.cinematic-intro *, .cinematic-intro *::before, .cinematic-intro *::after { animation-duration:.01ms !important; animation-iteration-count:1 !important; transition-duration:.01ms !important; }
	}
`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
<meta http-equiv="Pragma" content="no-cache" />
<meta http-equiv="Expires" content="0" />
<title>Golden Goal Rush</title>
<style>
	* { box-sizing: border-box; }
	html, body { margin: 0; width: 100%; height: 100%; min-height: 100vh; min-height: 100svh; min-height: 100dvh; overflow: hidden; background: #020406; }
	.viewport { position: fixed; inset: 0; width: 100vw; height: 100vh; height: 100svh; height: 100dvh; overflow: hidden; background: #020406; }
	.stage { position: absolute; top: 50%; left: 50%; transform-origin: center center; }
	.locked { opacity: 0.4; pointer-events: none; filter: grayscale(0.4); }
${style}
${extraCss}
</style>
</head>
<body>
	<div class="viewport">
	<section class="stage" id="stage" aria-label="Golden Goal Rush interactive preview">
		<img class="background" src="${assets.background}" alt="" />
		<div class="stadium-vignette"></div>
		<div class="top-light left"></div>
		<div class="top-light right"></div>

		<div class="logo-wordmark" aria-label="Golden Goal Rush">
			<img class="logo-header-img" src="${assets.headerLogo}" alt="" />
		</div>

		<div class="board-wrap">
			<div class="board-glow"></div>
			<div class="board-frame">
				<div class="board" id="board"></div>
			</div>
		</div>

		<div class="fx-layer" id="fx-layer"></div>
		<div class="fx-flash" id="fx-flash"></div>
		<div class="win-banner" id="win-banner"><small id="win-banner-label">BIG WIN</small><span id="win-banner-amount">0.00</span></div>
		<div class="fs-counter" id="fs-counter"><div class="fs-name" id="fs-name"></div><div class="fs-big">SPIN <span id="fs-count">0</span> / <span id="fs-total">0</span></div></div>

		<div class="bonus-intro" id="bonus-intro" aria-hidden="true">
			<div class="bi-rays"></div>
			<div class="bi-card">
				<div class="bi-kicker">Free Spins Unlocked</div>
				<div class="bi-title" id="bi-title">Golden Chance</div>
				<div class="bi-spins" id="bi-spins">8 FREE SPINS</div>
				<div class="bi-continue">CLICK TO START</div>
			</div>
		</div>

		<div class="rt-toast" id="rt-toast"><div class="rt-big" id="rt-big">+4 FREE SPINS</div><div class="rt-sub" id="rt-sub">Retrigger</div></div>

		<div class="bonus-summary" id="bonus-summary" aria-hidden="true">
			<div class="bs-card">
				<div class="bs-kicker">Bonus Complete</div>
				<div class="bs-total"><small>TOTAL WIN</small><span id="bs-total">0.00</span></div>
				<div class="bs-stats">
					<div class="bs-stat"><div class="v" id="bs-spins">0</div><div class="l">Spins Played</div></div>
					<div class="bs-stat"><div class="v" id="bs-best">0.00</div><div class="l">Best Spin</div></div>
				</div>
				<button class="bs-continue" id="bs-continue">CONTINUE</button>
			</div>
		</div>

		<div class="meters">
${meterRows}
		</div>

		<div class="controls">
			<button type="button" class="asset-button menu" id="btn-menu" aria-label="Menu">
				<img class="button-art" src="${assets.menuButton}" alt="" />
			</button>
			<button type="button" class="asset-button bonus" id="btn-bonus" aria-label="Feature">
				<img class="button-art" src="${assets.bonusButton}" alt="" />
			</button>
			<button type="button" class="asset-button" id="btn-auto" aria-label="Auto-Play">
				<img class="button-art" src="${assets.autoSpinButton}" alt="" />
			</button>
			<div class="feature-control" aria-label="Golden Goal Rush feature logic preview">
				<img class="button-art" src="${assets.featurePanel}" alt="" />
				<div class="feature-items">
${featureItems}
				</div>
			</div>
			<div class="replay-control-panel" id="replay-controls" aria-live="polite" aria-label="Replay controls" hidden>
				<div class="replay-control-copy">
					<strong id="replay-status">LOADING REPLAY</strong>
					<small><span id="replay-summary">Saved play &middot; view only</span><span class="replay-currency-code" id="replay-currency" aria-hidden="true" hidden></span></small>
				</div>
				<button type="button" class="replay-action" id="replay-action" data-testid="replay-action" hidden>Replay Play</button>
			</div>
			<button type="button" class="spin-button" id="btn-spin" aria-label="Play">
				<img class="spin-art" src="${assets.spinButton}" alt="" /><span>PLAY</span>
			</button>
			<button type="button" class="asset-button turbo" id="btn-turbo" aria-label="Turbo">
				<img class="button-art" src="${assets.turboButton}" alt="" />
			</button>
			<div class="bet-controls" id="bet-controls" aria-label="Play controls">
				<img class="button-art" src="${assets.controlPanel}" alt="" />
				<button type="button" id="btn-bet-minus" aria-label="Decrease play amount"><img src="${assets.minusButton}" alt="" /></button>
				<div class="bet-display"><span id="bet-display-label" data-i18n="betLabel">PLAY</span><strong id="bet-display">1.00</strong></div>
				<button type="button" id="btn-bet-plus" aria-label="Increase play amount"><img src="${assets.plusButton}" alt="" /></button>
			</div>
			<button type="button" class="icon-button info" id="btn-info" aria-label="Info"><img class="button-art" src="${assets.infoButton}" alt="" /></button>
			<button type="button" class="icon-button settings" id="btn-settings" aria-label="Settings"><img class="button-art" src="${assets.settingsButton}" alt="" /></button>
		</div>

		<!-- ===== Menu modal ===== -->
		<div class="modal-backdrop" id="modal-menu" data-modal>
			<div class="modal">
				<div class="modal-header"><div class="modal-title">MENU</div><button class="modal-close" data-close>&times;</button></div>
				<div class="modal-body">
					<button class="menu-item" data-open="modal-paytable"><span class="mi-ico">ST</span><span class="mi-text"><span class="mi-label" id="menu-paytable-label">Symbol Table</span><span class="mi-desc" id="menu-paytable-desc">Symbol values and cluster sizes</span></span><span class="mi-arrow">&rsaquo;</span></button>
					<button class="menu-item" data-open="modal-rules"><span class="mi-ico">?</span><span class="mi-text"><span class="mi-label">Rules &amp; Features</span><span class="mi-desc" id="menu-rules-desc">Cluster wins, coins, multipliers and free spins</span></span><span class="mi-arrow">&rsaquo;</span></button>
					<button class="menu-item" data-open="modal-settings"><span class="mi-ico">SET</span><span class="mi-text"><span class="mi-label">Settings</span><span class="mi-desc">Stadium audio and turbo mode</span></span><span class="mi-arrow">&rsaquo;</span></button>
					<button class="menu-item" id="menu-sound"><span class="mi-ico">SFX</span><span class="mi-text"><span class="mi-label">Sound</span><span class="mi-desc">Toggle music and effects</span></span><span class="mi-pill" id="menu-sound-state">ON</span></button>
				</div>
			</div>
		</div>

		<!-- ===== Settings modal ===== -->
		<div class="modal-backdrop" id="modal-settings" data-modal>
			<div class="modal">
				<div class="modal-header"><div class="modal-title">SETTINGS</div><button class="modal-close" data-close>&times;</button></div>
				<div class="modal-body">
					<div class="set-section">Audio</div>
					<div class="set-row"><span>Sound &amp; Music</span><button class="toggle on" data-toggle="sfx" id="toggle-sfx" aria-label="Toggle sound and music"></button></div>
					<div class="set-row"><span>Music Volume</span><div class="volume-control"><input class="volume-slider" id="music-volume" data-volume="music" type="range" min="0" max="100" value="100" /><span class="volume-value" id="music-volume-val">100%</span></div></div>
					<div class="set-row"><span>Sound Volume</span><div class="volume-control"><input class="volume-slider" id="sfx-volume" data-volume="sfx" type="range" min="0" max="100" value="100" /><span class="volume-value" id="sfx-volume-val">100%</span></div></div>
					<div class="set-section">Gameplay</div>
					<div class="set-row"><span>Turbo Spin</span><button class="toggle" data-toggle="turbo" id="toggle-turbo" aria-label="Toggle turbo spin"></button></div>
				</div>
			</div>
		</div>

		<!-- ===== Paytable modal ===== -->
		<div class="modal-backdrop" id="modal-paytable" data-modal>
			<div class="modal">
				<div class="modal-header"><div class="modal-title" id="paytable-title">SYMBOL TABLE</div><button class="modal-close" data-close>&times;</button></div>
				<div class="modal-body">
					<p class="pt-intro" id="paytable-intro">Values are multipliers of the active play amount. Awards begin with <b>5 orthogonally connected matching symbols</b>; substituting Wilds are included in the displayed cluster size.</p>
					<div class="pt-head" id="paytable-head">Symbol Values <small>cluster 5+ &middot; 7+ &middot; 9+ &middot; 12+</small></div>
					<div class="pt-grid" id="pt-grid"></div>
					<div class="pt-note" id="paytable-note">5+ means 5–6 symbols; 7+ means 7–8; 9+ means 9–11; 12+ means 12 or more. Each eligible symbol is evaluated independently with orthogonally connected Wilds. A Wild may support multiple distinct symbol clusters, counts toward each supported cluster, and appears only once within a single award. The tumble removes all awarded positions. The cascade multiplier starts at 1× and increases after each successful cascade. A floating amount shows that award step; the WIN meter is cumulative for the complete round.</div>
				</div>
			</div>
		</div>

		<!-- ===== Rules and features modal ===== -->
		<div class="modal-backdrop" id="modal-rules" data-modal>
			<div class="modal">
				<div class="modal-header"><div class="modal-title">RULES &amp; FEATURES</div><button class="modal-close" data-close>&times;</button></div>
				<div class="modal-body" id="rules-body">
					<p class="pt-intro">Golden Goal Rush is a 6&times;5 <b>cluster-awards</b> game. Land <b>5 or more matching symbols connected horizontally or vertically</b> to receive an award. The 5+/7+/9+/12+ bands mean 5–6, 7–8, 9–11, and 12 or more symbols. Awarded symbols are removed and new ones cascade in. The cascade multiplier starts at 1&times; and increments after each successful cascade.</p>
					<div class="pt-head">Core Game</div>
					<div class="pt-feat"><img src="${SYMBOLS.wild.src}" alt="Wild" /><div><b>WILD</b>Substitutes for every normal eligible symbol to help complete clusters and is included in the displayed cluster size. Does not replace the Scatter.</div></div>
					<div class="pt-feat"><div class="pt-chip"></div><div><b>WIN AMOUNTS</b>Each floating cluster amount is the award for that specific cascade step, including its cascade multiplier. The WIN meter is the cumulative authoritative result for the full round.</div></div>
					<div class="pt-feat"><img src="${SYMBOLS.scatter.src}" alt="Scatter" /><div><b>SCATTER &mdash; VIP TICKET</b>3, 4 or 5 trigger Free Spins Tier 1 / 2 / 3.</div></div>
					<div class="pt-feat"><div class="pt-chip"></div><div><b>GOLDEN CELLS</b>Every winning position turns into a Golden Cell for the rest of the spin sequence.</div></div>
					<div class="pt-head">Golden Goal Feature</div>
					<div class="pt-feat"><img src="${SYMBOLS.rainbow.src}" alt="Golden Arc" /><div><b>GOLDEN ARC (RAINBOW)</b>While an Arc is on the board it activates all Golden Cells, revealing Coins, Multiplier Badges and Collector Cups.</div></div>
					<div class="pt-feat"><img src="${COIN_ASSETS.gold}" alt="Coins" /><div><b>SPONSOR COINS</b>Bronze ${CONFIG.bronzeValues[0]}&ndash;${CONFIG.bronzeValues[CONFIG.bronzeValues.length-1]}&times;, Silver ${CONFIG.silverValues[0]}&ndash;${CONFIG.silverValues[CONFIG.silverValues.length-1]}&times;, Gold ${CONFIG.goldValues[0]}&ndash;${CONFIG.goldValues[CONFIG.goldValues.length-1]}&times; the play amount.</div></div>
					<div class="pt-feat"><img src="${MULT_ASSETS[5]}" alt="Multiplier Badge" /><div><b>MULTIPLIER BADGE</b>Multiplies adjacent coins by ${CONFIG.multiplierValues.map((v) => 'x' + v).join(', ')}.</div></div>
					<div class="pt-feat"><img src="${COLLECTOR_ASSET}" alt="Collector Cup" /><div><b>COLLECTOR CUP</b>Collects the value of every visible coin (top-to-bottom, left-to-right). After the last cup the Golden Cells reveal again, repeating while new cups appear.</div></div>
					<div class="pt-head">Free Spins &amp; Features</div>
					<div class="pt-feat"><img src="${SYMBOLS.scatter.src}" alt="Free Spins" /><div><b>FREE SPINS</b>
						${Object.entries(CONFIG.tiers).map(([t, v]) => 'Tier ' + t + ' &mdash; ' + v.name + ': ' + v.spins + ' spins' + (v.guaranteedRainbow ? ', guaranteed Arc each spin' : '') + '.').join('<br>')}</div></div>
					<div class="pt-feat"><div class="pt-chip"></div><div><b>FREE SPIN COUNTER</b>${FREE_SPIN_COUNTER_EXPLANATION}</div></div>
					<div class="pt-feat"><img src="${assets.bonusButton}" alt="Feature" /><div><b>BONUS / FEATURE</b>
						${CONFIG.bonusBuy.map((o) => o.label + ' &mdash; ' + o.mult + '&times; play amount').join('<br>')}<br>Tier 3 (End of the Rainbow) can only trigger naturally.</div></div>
					<div class="pt-head">Game Modes</div>
					${Object.values(PLAYER_MODE_META).map((mode) => `<div class="pt-feat"><div class="pt-chip"></div><div><b>${mode.name}</b>${mode.description}<br><small>Access: ${mode.trigger}. Feature Multiplier: ${mode.costMultiplier}&times;. ${mode.retrigger}</small></div></div>`).join('\n\t\t\t\t\t')}
					<div class="pt-head">Retriggers</div>
					<div class="pt-feat"><img src="${SYMBOLS.scatter.src}" alt="Retrigger" /><div><b>RETRIGGERS</b>Base Game and Rainbow Spin can trigger Free Spins with 3, 4 or 5 Scatter tickets. Feature-panel Free Spins do not add additional Free Spins in the current math book.</div></div>
					<div class="pt-head">Buttons &amp; Controls</div>
					<div class="controls-guide">
${controlRuleRows}
					</div>
					<div class="pt-note">If the game is refreshed while a base-game round is still active, the round is completed by the game service and the result is available in game history. Active feature rounds resume from the saved round state with the selected balance and play amount preserved.</div>
					<div class="pt-note">RTP 96.45% &middot; Max award ${formatMaxWinMultiplier(CONFIG.maxWinMultiplier)}&times; play amount &middot; All awards use the play amount. Malfunction voids all wins and plays. A consistent internet connection is required. After a disconnection, reload the game to finish any incomplete round. Expected return is calculated over many plays. The display is illustrative and does not represent a physical device. Wins are settled from the authoritative amount received from the Remote Game Server, not from browser events.</div>
				</div>
			</div>
		</div>

		<!-- ===== Auto-Bet modal ===== -->
		<div class="modal-backdrop" id="modal-autospin" data-modal>
			<div class="modal">
				<div class="modal-header"><div class="modal-title" id="autospin-title">AUTO-PLAY</div><button class="modal-close" data-close>&times;</button></div>
				<div class="modal-body">
					<div class="auto-options" id="auto-options"></div>
					<div class="auto-confirm" id="auto-confirm" aria-live="polite"></div>
				</div>
			</div>
		</div>

		<!-- Replay lifecycle and immutable saved-round summary. -->
		<div class="replay-overlay" id="replay-overlay" data-testid="replay-overlay" role="status" aria-live="assertive" aria-hidden="true">
			<div class="replay-overlay-card replay-modal">
				<div class="replay-spinner" aria-hidden="true"></div>
				<div class="replay-overlay-title" id="replay-overlay-title">Loading Replay</div>
				<div class="replay-overlay-detail" id="replay-overlay-detail">Retrieving the saved play from the game service.</div>
				<div class="replay-metadata" id="replay-metadata" data-testid="replay-metadata" aria-label="Replay details" aria-hidden="true">
					<div class="replay-card">
						<div class="replay-row"><span id="replay-mode-label">Mode</span><strong id="replay-mode-value" data-testid="replay-mode-value">-</strong></div>
						<div class="replay-row"><span id="replay-basebet-label">Base Play</span><strong id="replay-basebet-value" data-testid="replay-base-play">-</strong></div>
						<div class="replay-row"><span id="replay-cost-label">Feature Multiplier</span><strong id="replay-cost-value" data-testid="replay-feature-multiplier">-</strong></div>
						<div class="replay-row highlight"><span id="replay-totalcost-label">Final Play Amount</span><strong id="replay-totalcost-value" data-testid="replay-final-play-amount">-</strong></div>
						<div class="replay-row"><span id="replay-payout-label">Final Multiplier</span><strong id="replay-payout-value" data-testid="replay-final-multiplier">-</strong></div>
						<div class="replay-row win"><span id="replay-totalwin-label">Total Win</span><strong id="replay-totalwin-value" data-testid="replay-total-win">-</strong></div>
					</div>
					<button type="button" class="replay-start" id="replay-start" data-testid="replay-start" hidden>Start Replay</button>
					<p class="replay-note" id="replay-note">This is a replay of a previous play round. No new play will be placed.</p>
				</div>
			</div>
		</div>

		<!-- ===== Notification modal ===== -->
		<div class="modal-backdrop" id="modal-notification" data-modal>
			<div class="modal">
				<div class="modal-header"><div class="modal-title" id="notice-title">NOTICE</div><button class="modal-close" data-close>&times;</button></div>
				<div class="modal-body">
					<p class="notice-copy" id="notice-body"></p>
					<div class="c-row"><button class="c-yes" id="notice-ok">OK</button></div>
				</div>
			</div>
		</div>

		<!-- ===== Interrupted round resume modal ===== -->
		<div class="modal-backdrop" id="modal-interrupted-round" data-modal data-persistent="true">
			<div class="modal">
				<div class="modal-header"><div class="modal-title">ROUND INTERRUPTED</div></div>
				<div class="modal-body">
					<p class="interrupted-copy">Your previous round was interrupted. You can continue where you left off.</p>
					<div class="interrupted-actions"><button class="c-yes" id="interrupted-continue">Continue</button></div>
				</div>
			</div>
		</div>

		<!-- ===== Generic major-action confirmation (future features, e.g. Double Chance) ===== -->
		<div class="modal-backdrop" id="modal-major-confirm" data-modal>
			<div class="modal">
				<div class="modal-header"><div class="modal-title" id="major-confirm-title">CONFIRM ACTION</div><button class="modal-close" data-close>&times;</button></div>
				<div class="modal-body">
					<p class="notice-copy" id="major-confirm-body"></p>
					<div class="c-row"><button class="c-no" id="major-confirm-no">Cancel</button><button class="c-yes" id="major-confirm-yes">Confirm</button></div>
				</div>
			</div>
		</div>

		<!-- ===== Bonus Buy modal ===== -->
		<div class="modal-backdrop" id="modal-bonusbuy" data-modal>
			<div class="modal">
				<div class="modal-header"><div class="modal-title" id="bonusbuy-title">BONUS / FEATURE</div><button class="modal-close" data-close>&times;</button></div>
				<div class="modal-body">
					<div class="bonusbuy-hero"><img src="${assets.featureBanner}" alt="" /><div class="bonusbuy-title">Golden Goal Rush</div></div>
					<div class="bb-list" id="bonusbuy-list"></div>
					<div class="bb-note" id="bonusbuy-note"></div>
				</div>
			</div>
		</div>
	</section>
	<section class="cinematic-intro" id="cinematic-intro" aria-label="Golden Goal Rush opening" aria-live="polite" hidden>
		<div class="intro-backdrop" aria-hidden="true">
			<picture>
				<img class="intro-desktop-art" id="intro-desktop-art" src="${INTRO_CONFIG.assets.desktopBackdrop}" alt="" />
				<img class="intro-mobile-art" id="intro-mobile-art" src="${INTRO_CONFIG.assets.mobileBackdrop}" alt="" />
			</picture>
		</div>
		<canvas class="intro-atmosphere" id="intro-atmosphere" aria-hidden="true"></canvas>
		<div class="intro-vignette" aria-hidden="true"></div>
		<button class="intro-skip" id="intro-skip" type="button" hidden>SKIP INTRO</button>
		<div class="intro-content">
			<div class="intro-stage">
				<img class="intro-wordmark" id="intro-wordmark" src="${INTRO_CONFIG.assets.logo}" alt="Golden Goal Rush" />
				<p class="intro-scene-copy" id="intro-scene-copy"></p>
				<div class="intro-ready" id="intro-ready">
					<h1 class="intro-ready-title" id="intro-ready-title">THE STADIUM IS READY</h1>
					<p class="intro-sound-prompt" id="intro-sound-prompt">Choose your matchday sound</p>
					<div class="intro-actions">
						<button class="intro-action" id="intro-enter-sound" type="button" aria-describedby="intro-sound-prompt">PLAY WITH SOUND</button>
						<button class="intro-action secondary" id="intro-enter-silent" type="button" aria-describedby="intro-sound-prompt">PLAY SILENT</button>
					</div>
				</div>
				<div class="intro-progress-wrap" id="intro-progress-wrap">
					<progress class="intro-progress" id="intro-progress" max="100" value="0">0%</progress>
					<div class="intro-progress-label" id="intro-progress-label">PREPARING THE STADIUM · 0%</div>
				</div>
			</div>
		</div>
	</section>
	</div>

<script>
const SYMBOLS = ${JSON.stringify(SYMBOLS)};
const PRODUCTION_PAYTABLE = ${JSON.stringify(PRODUCTION_PAYTABLE)};
const FORMATTED_PRODUCTION_PAYTABLE = ${JSON.stringify(FORMATTED_PRODUCTION_PAYTABLE)};
const PRODUCTION_PAYING_SYMBOLS = ${JSON.stringify(PAYING_SYMBOLS)};
const CLUSTER_THRESHOLDS = ${JSON.stringify(CLUSTER_THRESHOLDS)};
const PRODUCTION_GAME_ID = ${JSON.stringify(PRODUCTION_GAME_CONFIG.gameId)};
const PRODUCTION_MATH_VERSION = ${JSON.stringify(PRODUCTION_GAME_CONFIG.version)};
const PRODUCTION_BET_MODES = ${JSON.stringify(Object.keys(PRODUCTION_GAME_CONFIG.betModes || {}))};
const COIN_ASSETS = ${JSON.stringify(COIN_ASSETS)};
const MULT_ASSETS = ${JSON.stringify(MULT_ASSETS)};
const COLLECTOR_ASSET = ${JSON.stringify(COLLECTOR_ASSET)};
const AUDIO_ASSETS = ${JSON.stringify(AUDIO_ASSETS)};
const INTRO_CONFIG = ${JSON.stringify(INTRO_CONFIG)};
const STAKE_PLAYER_VISIBLE_RESTRICTED_TERMS = ${JSON.stringify(STAKE_PLAYER_VISIBLE_RESTRICTED_TERMS)};
const playerVisibleRestrictedHits = ${playerVisibleRestrictedHits.toString()};
const summarizeFeatureEvents = ${summarizeFeatureEvents.toString()};
const reconcileWalletBalance = ${reconcileWalletBalance.toString()};
const ASSETS = ${JSON.stringify(assets)};
const PLAYER_MODE_META = ${JSON.stringify(PLAYER_MODE_META)};
const FREE_SPIN_COUNTER_EXPLANATION = ${JSON.stringify(FREE_SPIN_COUNTER_EXPLANATION)};
const CONTROL_RULES = ${JSON.stringify(controlRules)};
const CONFIG = ${JSON.stringify(CONFIG)};
const CURRENCY_META = ${JSON.stringify(CURRENCY_META)};
const COLS = 6, ROWS = 5, MIN_CLUSTER = 5;
const DEV_BET_LEVELS = [
	0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9,
	1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 7.5,
	10, 15, 20, 25, 30, 40, 50, 75,
	100, 150, 200, 250, 300, 500, 750,
	1000, 1500, 2000, 2500, 5000, 7500, 10000,
];
let BETS = [...DEV_BET_LEVELS];
const API_AMOUNT_MULTIPLIER = 1000000;
const DEFAULT_CURRENCY = 'EUR';
const AUTO_SPIN_OPTIONS = [10, 25, 50, 100, 200, Infinity];
const USE_RGS_STATE_RENDERER = false;
const USE_SAFE_RGS_BASE_RENDERER = true;
const LANGUAGE_RESOURCES = {
	en: {
		balanceLabel: 'BALANCE',
		winLabel: 'WIN',
		betLabel: 'PLAY',
		spinButton: 'PLAY',
		buyBonusAria: 'Feature',
		autoAria: 'Auto-Play',
		betControlsAria: 'Play controls',
		decreaseBetAria: 'Decrease play amount',
		increaseBetAria: 'Increase play amount',
		autoTitle: 'AUTO-PLAY',
		bonusBuyTitle: 'BONUS / FEATURE',
		paytableLabel: 'Symbol Table',
		paytableDesc: 'Symbol values and cluster sizes',
		paytableTitle: 'SYMBOL TABLE',
		paytableIntro: 'Values are multipliers of the active play amount. Awards begin with <b>5 orthogonally connected matching symbols</b>; substituting Wilds are included in the displayed cluster size.',
		paytableHead: 'Symbol Values <small>cluster 5+ &middot; 7+ &middot; 9+ &middot; 12+</small>',
		paytableNote: '5+ means 5–6 symbols; 7+ means 7–8; 9+ means 9–11; 12+ means 12 or more. Each eligible symbol is evaluated independently with orthogonally connected Wilds. A Wild may support multiple distinct symbol clusters, counts toward each supported cluster, and appears only once within a single award. The tumble removes all awarded positions. The cascade multiplier starts at 1× and increases after each successful cascade. A floating amount shows that award step; the WIN meter is cumulative for the complete round.',
		rulesDesc: 'Cluster awards, coins, multipliers and free spins',
		autoConfirm: 'Start Auto-Play for',
		bonusNoteAffordable: 'Feature amounts scale with your current play amount. Tier 3 can only trigger naturally.',
		bonusNoteDisabled: 'Greyed options exceed your balance. Tier 3 can only trigger naturally.',
		buyConfirmVerb: 'Start',
		balanceAfterPurchase: 'Balance after feature',
		replayTitle: 'Play Replay',
		startReplay: 'Start Replay',
		replayEvent: 'Replay Play',
		replayMode: 'Mode',
		replayBaseBet: 'Base Play',
		replayCostMultiplier: 'Feature Multiplier',
		replayTotalCost: 'Final Play Amount',
		replayPayoutMultiplier: 'Final Multiplier',
		replayTotalWin: 'Total Win',
		replayNote: 'This is a replay of a previous play round. No new play will be placed.',
		replayComplete: 'Replay Complete',
		replayLoading: 'LOADING REPLAY',
		replayReady: 'READY TO REPLAY',
		replayRunning: 'REPLAY RUNNING',
		replayCompleted: 'REPLAY COMPLETED',
		replayError: 'REPLAY ERROR',
		replayLoadingDetail: 'Retrieving the saved play from the game service.',
		replayErrorDetail: 'The saved play replay could not be loaded.',
		replaySummaryLoading: 'Saved play · view only',
		replayAction: 'Replay Play',
		replayAgainAction: 'Play Again',
		replayStageAria: 'Golden Goal Rush play replay',
	},
	sweeps_en: {
		balanceLabel: 'BALANCE',
		winLabel: 'WIN',
		betLabel: 'PLAY',
		spinButton: 'PLAY',
		buyBonusAria: 'Feature',
		autoAria: 'Auto-Play',
		betControlsAria: 'Play controls',
		decreaseBetAria: 'Decrease play amount',
		increaseBetAria: 'Increase play amount',
		autoTitle: 'AUTO-PLAY',
		bonusBuyTitle: 'BONUS / FEATURE',
		paytableLabel: 'Symbol Table',
		paytableDesc: 'Symbol values and cluster sizes',
		paytableTitle: 'SYMBOL TABLE',
		paytableIntro: 'Values are multipliers of the active play amount. Awards begin with <b>5 orthogonally connected matching symbols</b>; substituting Wilds are included in the displayed cluster size.',
		paytableHead: 'Symbol Values <small>cluster 5+ &middot; 7+ &middot; 9+ &middot; 12+</small>',
		paytableNote: '5+ means 5–6 symbols; 7+ means 7–8; 9+ means 9–11; 12+ means 12 or more. Each eligible symbol is evaluated independently with orthogonally connected Wilds. A Wild may support multiple distinct symbol clusters, counts toward each supported cluster, and appears only once within a single award. The tumble removes all awarded positions. The cascade multiplier starts at 1× and increases after each successful cascade. A floating amount shows that award step; the WIN meter is cumulative for the complete round.',
		rulesDesc: 'Cluster awards, coins, multipliers and free spins',
		autoConfirm: 'Start Auto-Play for',
		bonusNoteAffordable: 'Feature amounts scale with your current play amount. Tier 3 can only trigger naturally.',
		bonusNoteDisabled: 'Greyed options exceed your balance. Tier 3 can only trigger naturally.',
		buyConfirmVerb: 'Start',
		balanceAfterPurchase: 'Balance after feature',
		replayTitle: 'Play Replay',
		startReplay: 'Start Replay',
		replayEvent: 'Replay Play',
		replayMode: 'Mode',
		replayBaseBet: 'Base Play',
		replayCostMultiplier: 'Feature Multiplier',
		replayTotalCost: 'Final Play Amount',
		replayPayoutMultiplier: 'Final Multiplier',
		replayTotalWin: 'Total Win',
		replayNote: 'This is a replay of a previous play round. No new play will be placed.',
		replayComplete: 'Replay Complete',
		replayLoading: 'LOADING REPLAY',
		replayReady: 'READY TO REPLAY',
		replayRunning: 'REPLAY RUNNING',
		replayCompleted: 'REPLAY COMPLETED',
		replayError: 'REPLAY ERROR',
		replayLoadingDetail: 'Retrieving the saved play from the game service.',
		replayErrorDetail: 'The saved play replay could not be loaded.',
		replaySummaryLoading: 'Saved play · view only',
		replayAction: 'Replay Play',
		replayAgainAction: 'Play Again',
		replayStageAria: 'Golden Goal Rush play replay',
	},
};

for (const [resourceName, resource] of Object.entries(LANGUAGE_RESOURCES)) {
	const restrictedHits = playerVisibleRestrictedHits(Object.values(resource).join(' '));
	if (restrictedHits.length) console.error('[GGR player-copy] restricted phrase in language resource', resourceName, restrictedHits);
}

const state = {
	balance: 1000, bet: 1, betIdx: 9, currency: DEFAULT_CURRENCY, grid: [], spinning: false, walletBusy: false, turbo: false, auto: false, autoRemaining: 0, selectedAutoSpins: null,
	golden: new Set(), reveals: new Map(), // golden = 'c,r' keys; reveals = 'c,r' -> {kind,value,asset}
	mode: 'base', tier: 0, fsLeft: 0, fsTotal: 0, fsWin: 0, fsBest: 0, fsPlayed: 0, win: 0, sound: true, musicVolume: 100, sfxVolume: 100,
	skipRequested: false, walletBalanceDeferred: false, pendingWalletBalance: null,
	fatal: false, replay: false, replayPlaying: false, socialCasino: false, localWalletCredits: 0,
};

const $ = (id) => document.getElementById(id);
const board = $('board');
const stage = $('stage');
let spinSeq = 0;
let autoTimer = null;
const skipWaiters = new Set();
function requestSkip() {
	if (!state.spinning) return false;
	state.skipRequested = true;
	stage.classList.add('skip-mode');
	$('btn-spin').classList.add('skip-armed');
	[...skipWaiters].forEach((resolve) => resolve());
	return true;
}
function clearSkip() {
	state.skipRequested = false;
	stage.classList.remove('skip-mode');
	$('btn-spin').classList.remove('skip-armed');
}
function waitBase(ms, raw = false) {
	if (state.skipRequested) return Promise.resolve();
	const dur = raw ? ms : (state.turbo ? ms * 0.42 : ms);
	if (dur <= 0) return Promise.resolve();
	return new Promise((resolve) => {
		let timer = null;
		const done = () => {
			clearTimeout(timer);
			skipWaiters.delete(done);
			resolve();
		};
		skipWaiters.add(done);
		timer = setTimeout(done, dur);
	});
}
const wait = (ms) => waitBase(ms, false);
const fmt = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatMaxWinMultiplier = (value) => new Intl.NumberFormat('en-US', { useGrouping: true, maximumFractionDigits: 20 }).format(Number(value));
const normalizeCurrency = (currency) => String(currency || '').trim().toUpperCase();
function currencyMeta(currency) { return CURRENCY_META[normalizeCurrency(currency)] || null; }
function formatCurrency(amount, currency = state.currency) {
	const code = normalizeCurrency(currency);
	const meta = currencyMeta(code);
	const value = Number(amount);
	const safeValue = Number.isFinite(value) ? value : 0;
	if (!meta) return safeValue.toFixed(2) + ' ' + (code || 'UNKNOWN');
	const formattedAmount = safeValue.toFixed(meta.decimals);
	return meta.symbolAfter ? formattedAmount + ' ' + meta.symbol : meta.symbol + formattedAmount;
}
function formatReplayCurrency(amount, currency = state.currency) {
	const code = normalizeCurrency(currency);
	const meta = currencyMeta(code);
	const value = Number(amount);
	const safeValue = Number.isFinite(value) ? value : 0;
	const minimumDigits = meta ? meta.decimals : 2;
	const maximumDigits = Math.max(minimumDigits, 4);
	let formattedAmount = safeValue.toFixed(maximumDigits);
	const decimalIndex = formattedAmount.indexOf('.');
	while (formattedAmount.endsWith('0') && formattedAmount.length - decimalIndex - 1 > minimumDigits) {
		formattedAmount = formattedAmount.slice(0, -1);
	}
	if (!meta) return formattedAmount + ' ' + (code || 'UNKNOWN');
	return meta.symbolAfter ? formattedAmount + ' ' + meta.symbol : meta.symbol + formattedAmount;
}
function currencySymbol(currency = state.currency) {
	const code = normalizeCurrency(currency);
	return (currencyMeta(code) && currencyMeta(code).symbol) || code || '';
}
const ck = (c, r) => c + ',' + r;
const apiAmountToMoney = (amount) => Math.round(((Number(amount) || 0) / API_AMOUNT_MULTIPLIER) * 100) / 100;
const moneyToApiAmount = (amount) => Math.round((Number(amount) || 0) * API_AMOUNT_MULTIPLIER);
const moneyRound = (amount) => Math.round((Number(amount) || 0) * 100) / 100;
const BOOK_MULTIPLIER_SCALE = 100;
const replayApiAmountToMoney = (amount) => Number(amount) / API_AMOUNT_MULTIPLIER;
const replayBookUnitsToMultiplier = (amount) => Number(amount) / BOOK_MULTIPLIER_SCALE;
function requireReplaySafeInteger(value, label, { positive = false } = {}) {
	if (typeof value !== 'number' || !Number.isSafeInteger(value) || (positive ? value <= 0 : value < 0)) {
		throw new Error(label + ' must be a ' + (positive ? 'positive' : 'non-negative') + ' integer');
	}
	return value;
}
function replayPayoutMultiplierCandidates(value) {
	const candidates = [];
	const push = (candidate) => {
		if (Number.isSafeInteger(candidate) && candidate >= 0 && !candidates.includes(candidate)) candidates.push(candidate);
	};
	const numeric = typeof value === 'number'
		? value
		: (typeof value === 'string' && value.trim() !== '' ? Number(value.trim()) : NaN);
	if (!Number.isFinite(numeric) || numeric < 0) return candidates;
	if (Number.isSafeInteger(numeric)) push(numeric);
	const scaled = Math.round(numeric * BOOK_MULTIPLIER_SCALE);
	if (Math.abs((numeric * BOOK_MULTIPLIER_SCALE) - scaled) <= 1e-9) push(scaled);
	return candidates;
}
const DEV_BET_CONFIG = {
	source: 'dev-fallback',
	currency: DEFAULT_CURRENCY,
	defaultBet: 1,
	betLevels: [...DEV_BET_LEVELS],
	apiLevels: DEV_BET_LEVELS.map((amount) => moneyToApiAmount(amount)),
};
let activeBetConfig = { ...DEV_BET_CONFIG };
function configAmountLooksApi(value) {
	const n = Number(value);
	return Number.isFinite(n) && Math.abs(n) >= 1000;
}
function rawConfigAmount(raw) {
	if (raw && typeof raw === 'object') return raw.amount ?? raw.value ?? raw.bet ?? raw.level ?? raw.betLevel ?? raw.defaultBetLevel;
	return raw;
}
function configAmountToMoney(raw) {
	const value = rawConfigAmount(raw);
	const n = Number(value);
	if (!Number.isFinite(n) || n <= 0) return null;
	return configAmountLooksApi(n) ? apiAmountToMoney(n) : moneyRound(n);
}
function configAmountToApi(raw, money) {
	const value = rawConfigAmount(raw);
	const n = Number(value);
	return configAmountLooksApi(n) ? Math.round(n) : moneyToApiAmount(money);
}
function uniqueSortedBetLevels(items) {
	const byMoney = new Map();
	for (const item of items || []) {
		if (!item || !Number.isFinite(item.money) || item.money <= 0) continue;
		const key = item.money.toFixed(2);
		if (!byMoney.has(key)) byMoney.set(key, { money: item.money, api: item.api || moneyToApiAmount(item.money) });
	}
	return [...byMoney.values()].sort((a, b) => a.money - b.money);
}
function firstArrayConfig(config, keys) {
	for (const key of keys) {
		if (Array.isArray(config && config[key])) return config[key];
	}
	return [];
}
function firstMoneyConfig(config, keys) {
	for (const key of keys) {
		const value = config && config[key];
		const money = configAmountToMoney(value);
		if (money !== null) return money;
	}
	return null;
}
function normalizeBetConfig(data = {}, source = 'authenticate') {
	const config = data && data.config ? data.config : (data || {});
	const balanceCurrency = data && data.balance && data.balance.currency;
	const currency = normalizeCurrency(config.currency || config.defaultCurrency || balanceCurrency || state.currency || UrlState.currency());
	const rawLevels = firstArrayConfig(config, ['betLevels', 'availableBetLevels', 'betAmounts', 'bets', 'levels', 'denominations']);
	const levels = uniqueSortedBetLevels(rawLevels.map((raw) => {
		const money = configAmountToMoney(raw);
		return money === null ? null : { money, api: configAmountToApi(raw, money) };
	}));
	let defaultBet = firstMoneyConfig(config, ['defaultBetLevel', 'defaultBet', 'defaultBetAmount', 'betLevel', 'betAmount', 'minBet']);
	if (defaultBet === null && levels.length) defaultBet = levels[0].money;
	if (defaultBet === null && data && data.round && data.round.amount) defaultBet = configAmountToMoney(data.round.amount);
	if (defaultBet === null && source === 'dev-fallback') defaultBet = DEV_BET_CONFIG.defaultBet;
	if (source === 'authenticate' && !levels.length && defaultBet !== null) {
		levels.push({ money: defaultBet, api: moneyToApiAmount(defaultBet) });
	}
	return {
		source,
		currency,
		defaultBet,
		betLevels: levels.map((item) => item.money),
		apiLevels: levels.map((item) => item.api),
		modes: config.betModes || config.modes || {},
		raw: config,
	};
}
function nearestBetIndex(amount, levels = BETS) {
	if (!levels.length) return -1;
	let idx = 0;
	let best = Math.abs(levels[0] - amount);
	for (let i = 1; i < levels.length; i += 1) {
		const diff = Math.abs(levels[i] - amount);
		if (diff < best) { best = diff; idx = i; }
	}
	return idx;
}
function applyBetConfig(config, options = {}) {
	if (!config) return false;
	activeBetConfig = { ...activeBetConfig, ...config };
	if (config.currency) state.currency = normalizeCurrency(config.currency);
	const levels = Array.isArray(config.betLevels) ? config.betLevels.filter((v) => Number.isFinite(v) && v > 0) : [];
	const apiLevels = Array.isArray(config.apiLevels) ? config.apiLevels : [];
	if (levels.length) {
		BETS = levels;
		activeBetConfig.apiLevels = levels.map((level, index) => apiLevels[index] || moneyToApiAmount(level));
	} else if (config.source === 'authenticate' && UrlState.requiresRgs()) {
		const fallback = Number.isFinite(config.defaultBet) && config.defaultBet > 0 ? config.defaultBet : state.bet;
		BETS = [fallback];
		activeBetConfig.apiLevels = [moneyToApiAmount(fallback)];
	}
	const target = options.preferDefault && Number.isFinite(config.defaultBet) && config.defaultBet > 0
		? config.defaultBet
		: (Number.isFinite(state.bet) && state.bet > 0 ? state.bet : (config.defaultBet || BETS[0] || 1));
	const idx = nearestBetIndex(target, BETS);
	if (idx >= 0) {
		state.betIdx = idx;
		state.bet = BETS[idx];
	}
	updateMeters();
	return true;
}
function debugJson(label, value) {
	if (!UrlState.debug()) return;
	try { console.log(label, JSON.stringify(value)); } catch (e) { console.log(label, value); }
}
const wpick = (entries) => { // entries: [[value, weight], ...]
	const tot = entries.reduce((s, e) => s + e[1], 0); let x = Math.random() * tot;
	for (const [v, w] of entries) { x -= w; if (x < 0) return v; } return entries[0][0];
};
const rand = (arr) => arr[(Math.random() * arr.length) | 0];
const RGS_SYMBOL_ALIASES = {
	H1: 'football', H2: 'trophy', H3: 'jersey', H4: 'whistle',
	L1: 'a', L2: 'k', L3: 'q', L4: 'j', L5: 'ten',
	W: 'wild', S: 'scatter',
};
const RGS_FILLER_REEL = ['ten', 'j', 'q', 'k', 'a'];
let rgsBoardMeta = { rowStarts: [] };

const UrlState = (() => {
	const params = new URLSearchParams(window.location.search);
	const rgsKeys = ['sessionID', 'sessionId', 'session_id', 'sid', 'rgs_url', 'rgsUrl', 'rgsURL'];
	const get = (...keys) => {
		for (const key of keys) {
			const value = params.get(key);
			if (value !== null && value !== '') return value;
		}
		return '';
	};
	const hasLaunchParam = (...keys) => keys.some((key) => {
		const value = params.get(key);
		return value !== null && value !== '';
	});
	const hostRequiresRgs = () => /(^|\.)stake-engine\.com$/i.test(window.location.hostname);
	const hasAnyRgsParam = () => rgsKeys.some((key) => params.has(key));
	return {
		sessionID: () => get('sessionID', 'sessionId', 'session_id', 'sid'),
		rgsUrl: () => get('rgs_url', 'rgsUrl', 'rgsURL'),
		lang: () => {
			const value = get('lang', 'language') || 'en';
			return value === 'br' ? 'pt' : value;
		},
		currencyRaw: () => get('currency').toUpperCase(),
		currency: () => (get('currency') || DEFAULT_CURRENCY).toUpperCase(),
		device: () => get('device', 'deviceType').toLowerCase(),
		game: () => get('game', 'gameName', 'slug') || 'golden-goal-rush',
		version: () => get('version', 'gameVersion') || '1',
		launchMode: () => get('mode', 'betMode') || 'base',
		event: () => get('event', 'eventID', 'eventId', 'betID', 'betId'),
		amount: () => get('amount', 'bet', 'stake'),
		social: () => ['social', 'socialCasino', 'social_casino', 'stakeUS'].some((key) => /^(1|true|yes)$/i.test(get(key))),
		replay: () => get('replay') === 'true',
		debug: () => get('debug', 'rgs_debug') === 'true',
		hasLaunchParam,
		requiresRgs: () => hostRequiresRgs() || hasAnyRgsParam(),
	};
})();
state.currency = UrlState.currency();
if (UrlState.replay()) state.currency = UrlState.currency();
state.socialCasino = UrlState.social();

function isSocialPlay() {
	return state.socialCasino === true || normalizeCurrency(state.currency) === 'XGC' || normalizeCurrency(state.currency) === 'XSC';
}
function textResource() {
	return isSocialPlay() ? LANGUAGE_RESOURCES.sweeps_en : LANGUAGE_RESOURCES.en;
}
function t(key) {
	const resource = textResource();
	return resource[key] || LANGUAGE_RESOURCES.en[key] || key;
}
function canonicalMode(mode) {
	const key = String(mode || 'base').toLowerCase();
	if (key === 'bonus_tier1' || key === 'tier1' || key === 'golden_chance') return 'bonus_tier1';
	if (key === 'bonus_tier2' || key === 'tier2' || key === 'all_that_glitters') return 'bonus';
	if (key === 'bonus_tier3' || key === 'tier3' || key === 'end_of_the_rainbow') return 'bonus_tier3';
	if (key === 'feature' || key === 'feature_spins') return 'hunt';
	if (key === 'rainbow_spin') return 'rainbow';
	return PLAYER_MODE_META[key] ? key : 'base';
}
function modeMeta(mode) {
	return PLAYER_MODE_META[canonicalMode(mode)] || PLAYER_MODE_META.base;
}
function playerModeName(mode) {
	const meta = modeMeta(mode);
	return isSocialPlay() ? (meta.socialName || meta.name) : meta.name;
}
function multiplierText(value) {
	const n = Number(value);
	if (!Number.isFinite(n)) return '0x';
	return (Math.round(n * 10000) / 10000).toString() + 'x';
}
function controlRulesGuideHtml(social = isSocialPlay()) {
	return '<div class="controls-guide">' + CONTROL_RULES.map((rule) => {
		const key = rule[0], name = social ? rule[2] : rule[1], icon = rule[3], desc = social ? rule[5] : rule[4];
		return '<div class="control-rule" data-control-key="' + key + '" data-normal-name="' + rule[1] + '" data-social-name="' + rule[2] + '" data-normal-desc="' + rule[4] + '" data-social-desc="' + rule[5] + '">'
			+ '<img src="' + icon + '" alt="' + name + '" />'
			+ '<div><b>' + name + '</b>' + desc + '</div></div>';
	}).join('') + '</div>';
}
function buildPlayerSafeRulesBodyHtml() {
	const modeKeys = ['base', 'hunt', 'rainbow', 'bonus_tier1', 'bonus', 'bonus_tier3'];
	const modeRows = modeKeys.map((key) => {
		const meta = PLAYER_MODE_META[key];
		return '<div class="pt-feat"><div class="pt-chip"></div><div><b>' + (meta.socialName || meta.name) + '</b>'
			+ meta.socialDescription + '<br><small>Access: ' + meta.socialTrigger + '. Feature Multiplier: ' + multiplierText(meta.costMultiplier) + '. ' + meta.socialRetrigger + '</small></div></div>';
	}).join('');
	const tierRows = Object.entries(CONFIG.tiers).map(([tier, value]) => 'Tier ' + tier + ' - ' + value.name + ': ' + value.spins + ' free spins' + (value.guaranteedRainbow ? ', guaranteed Arc each spin' : '') + '.').join('<br>');
	const featureRows = CONFIG.bonusBuy.map((option) => option.label + ' - ' + multiplierText(option.mult) + ' play amount').join('<br>');
	return ''
		+ '<p class="pt-intro">Golden Goal Rush is a 6&times;5 <b>cluster-awards</b> game. Land <b>5 or more matching symbols connected horizontally or vertically</b> to receive an award. The 5+/7+/9+/12+ bands mean 5–6, 7–8, 9–11, and 12 or more symbols. The cascade multiplier starts at 1&times; and increments after each successful cascade.</p>'
		+ '<div class="pt-head">Core Game</div>'
		+ '<div class="pt-feat"><img src="' + SYMBOLS.wild.src + '" alt="Wild" /><div><b>WILD</b>Substitutes for every normal symbol to help complete clusters and is included in the displayed cluster size. Does not replace the Scatter.</div></div>'
		+ '<div class="pt-feat"><div class="pt-chip"></div><div><b>WIN AMOUNTS</b>Each floating cluster amount is the award for that cascade step, including its cascade multiplier. The WIN meter is cumulative for the full recorded round.</div></div>'
		+ '<div class="pt-feat"><img src="' + SYMBOLS.scatter.src + '" alt="Scatter" /><div><b>SCATTER - VIP TICKET</b>3, 4 or 5 trigger Free Spins Tier 1 / 2 / 3.</div></div>'
		+ '<div class="pt-feat"><div class="pt-chip"></div><div><b>GOLDEN CELLS</b>Every winning position turns into a Golden Cell for the rest of the spin sequence.</div></div>'
		+ '<div class="pt-head">Golden Goal Feature</div>'
		+ '<div class="pt-feat"><img src="' + SYMBOLS.rainbow.src + '" alt="Golden Arc" /><div><b>GOLDEN ARC (RAINBOW)</b>While an Arc is on the board it activates all Golden Cells, revealing Coins, Multiplier Badges and Collector Cups.</div></div>'
		+ '<div class="pt-feat"><img src="' + COIN_ASSETS.gold + '" alt="Coins" /><div><b>SPONSOR COINS</b>Bronze ' + CONFIG.bronzeValues[0] + '-' + CONFIG.bronzeValues[CONFIG.bronzeValues.length - 1] + 'x, Silver ' + CONFIG.silverValues[0] + '-' + CONFIG.silverValues[CONFIG.silverValues.length - 1] + 'x, Gold ' + CONFIG.goldValues[0] + '-' + CONFIG.goldValues[CONFIG.goldValues.length - 1] + 'x the play amount.</div></div>'
		+ '<div class="pt-feat"><img src="' + MULT_ASSETS[5] + '" alt="Multiplier Badge" /><div><b>MULTIPLIER BADGE</b>Multiplies adjacent coins by ' + CONFIG.multiplierValues.map((v) => 'x' + v).join(', ') + '.</div></div>'
		+ '<div class="pt-feat"><img src="' + COLLECTOR_ASSET + '" alt="Collector Cup" /><div><b>COLLECTOR CUP</b>Collects the value of every visible coin. After the last cup the Golden Cells reveal again, repeating while new cups appear.</div></div>'
		+ '<div class="pt-head">Free Spins &amp; Features</div>'
		+ '<div class="pt-feat"><img src="' + SYMBOLS.scatter.src + '" alt="Free Spins" /><div><b>FREE SPINS</b>' + tierRows + '</div></div>'
		+ '<div class="pt-feat"><div class="pt-chip"></div><div><b>FREE SPIN COUNTER</b>' + FREE_SPIN_COUNTER_EXPLANATION + '</div></div>'
		+ '<div class="pt-feat"><img src="' + ASSETS.bonusButton + '" alt="Feature" /><div><b>BONUS / FEATURE</b>' + featureRows + '<br>Tier 3 (End of the Rainbow) can only trigger naturally.</div></div>'
		+ '<div class="pt-head">Game Modes</div>' + modeRows
		+ '<div class="pt-head">Retriggers</div>'
		+ '<div class="pt-feat"><img src="' + SYMBOLS.scatter.src + '" alt="Retrigger" /><div><b>RETRIGGERS</b>Base Game and Rainbow Spin can trigger Free Spins with 3, 4 or 5 Scatter tickets. Feature-panel Free Spins do not add additional Free Spins in the current math book.</div></div>'
		+ '<div class="pt-head">Buttons &amp; Controls</div>' + controlRulesGuideHtml(true)
		+ '<div class="pt-note">If the game is refreshed while a base-game round is still active, the round is completed by the game service and the result is available in game history. Active feature rounds resume from the saved round state with the selected balance and play amount preserved.</div>'
		+ '<div class="pt-note">RTP 96.45% &middot; Max award ' + formatMaxWinMultiplier(CONFIG.maxWinMultiplier) + 'x play amount &middot; All awards use the play amount. Malfunction voids all wins and plays. A consistent internet connection is required. After a disconnection, reload the game to finish any incomplete round. Expected return is calculated over many plays. The display is illustrative and does not represent a physical device. Wins are settled from the authoritative amount received from the Remote Game Server, not from browser events.</div>';
}
function applyLanguage() {
	const social = isSocialPlay();
	document.documentElement.dataset.social = social ? 'true' : 'false';
	document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
	const setText = (id, value) => { const el = $(id); if (el) el.textContent = value; };
	const setHtml = (id, value) => { const el = $(id); if (el) el.innerHTML = value; };
	const setAttr = (id, attr, value) => { const el = $(id); if (el) el.setAttribute(attr, value); };
	const spinText = $('btn-spin')?.querySelector('span');
	if (spinText) spinText.textContent = t('spinButton');
	setAttr('btn-spin', 'aria-label', t('spinButton'));
	setAttr('btn-bonus', 'aria-label', t('buyBonusAria'));
	setAttr('btn-auto', 'aria-label', t('autoAria'));
	setAttr('bet-controls', 'aria-label', t('betControlsAria'));
	setAttr('btn-bet-minus', 'aria-label', t('decreaseBetAria'));
	setAttr('btn-bet-plus', 'aria-label', t('increaseBetAria'));
	setText('autospin-title', t('autoTitle'));
	setText('bonusbuy-title', t('bonusBuyTitle'));
	setText('menu-paytable-label', t('paytableLabel'));
	setText('menu-paytable-desc', t('paytableDesc'));
	setText('menu-rules-desc', t('rulesDesc'));
	setText('paytable-title', t('paytableTitle'));
	setHtml('paytable-intro', t('paytableIntro'));
	setHtml('paytable-head', t('paytableHead'));
	setText('paytable-note', t('paytableNote'));
	setText('replay-title', t('replayTitle'));
	setText('replay-start', t('startReplay'));
	setText('replay-again', t('replayEvent'));
	setText('replay-mode-label', t('replayMode'));
	setText('replay-basebet-label', t('replayBaseBet'));
	setText('replay-cost-label', t('replayCostMultiplier'));
	setText('replay-totalcost-label', t('replayTotalCost'));
	setText('replay-payout-label', t('replayPayoutMultiplier'));
	setText('replay-totalwin-label', t('replayTotalWin'));
	setText('replay-end-mode-label', t('replayMode'));
	setText('replay-end-win-label', t('replayTotalWin'));
	setText('replay-note', t('replayNote'));
	setText('replay-end-title', t('replayComplete'));
	const rulesBody = $('rules-body');
	if (rulesBody) {
		rulesBody.innerHTML = buildPlayerSafeRulesBodyHtml();
	}
}

const initialLaunchUrl = window.location.href;
const REPLAY_FORBIDDEN_IDS = Object.freeze([
	'meter-balance',
	'btn-spin',
	'btn-auto',
	'btn-bonus',
	'bet-controls',
	'modal-autospin',
	'modal-bonusbuy',
	'modal-major-confirm',
	'modal-interrupted-round',
]);

function makeUnavailableInReplay(element) {
	if (!element) return;
	element.hidden = true;
	element.setAttribute('aria-hidden', 'true');
	element.setAttribute('inert', '');
	try { element.inert = true; } catch (error) {}
	if ('disabled' in element) element.disabled = true;
	element.querySelectorAll?.('button,input,select,textarea,[tabindex]').forEach((child) => {
		if ('disabled' in child) child.disabled = true;
		child.setAttribute('tabindex', '-1');
	});
}

function enterReplayUi() {
	state.replay = true;
	stopAutoSpin();
	stage.classList.add('replay-mode');
	stage.setAttribute('aria-label', t('replayStageAria'));
	const controls = $('replay-controls');
	if (controls) {
		controls.hidden = false;
		controls.removeAttribute('aria-hidden');
	}
	for (const id of REPLAY_FORBIDDEN_IDS) makeUnavailableInReplay($(id));
	makeUnavailableInReplay(document.querySelector('.meter[data-meter="balance"]'));
	makeUnavailableInReplay(document.querySelector('.feature-control'));
	const replayBetLabel = document.querySelector('.meter[data-meter="bet"] .meter-label');
	if (replayBetLabel) {
		replayBetLabel.textContent = 'REPLAY PLAY';
		replayBetLabel.removeAttribute('data-i18n');
	}
	const turbo = $('btn-turbo');
	if (turbo) turbo.setAttribute('aria-label', t('replayStageAria') + ' speed');
	updateLocks();
}

function setReplayLifecycle(status, meta = null, detail = '') {
	enterReplayUi();
	stage.dataset.replayState = status;
	const action = $('replay-action');
	const overlayAction = $('replay-start');
	const statusLabel = $('replay-status');
	const summary = $('replay-summary');
	const currency = $('replay-currency');
	const overlay = $('replay-overlay');
	const overlayTitle = $('replay-overlay-title');
	const overlayDetail = $('replay-overlay-detail');
	const metadata = $('replay-metadata');
	const labels = {
		loading: t('replayLoading'),
		ready: t('replayReady'),
		running: t('replayRunning'),
		completed: t('replayCompleted'),
		error: t('replayError'),
	};
	if (statusLabel) statusLabel.textContent = labels[status] || t('replayTitle');
	// formatCurrency already renders the approved display form (GC/SC). Keep
	// the legacy node for layout/test compatibility but never show raw XGC/XSC.
	if (currency) {
		currency.textContent = '';
		currency.hidden = true;
		currency.setAttribute('aria-hidden', 'true');
	}
	if (summary && meta) {
		summary.textContent = String(meta.mode || 'Base Game').toUpperCase() + ' · ' + formatCurrency(meta.baseBet);
	}
	if (summary && status === 'loading') summary.textContent = t('replaySummaryLoading');
	if (action) {
		const available = status === 'ready' || status === 'completed';
		action.hidden = !available;
		action.disabled = !available;
		action.textContent = status === 'completed' ? t('replayAgainAction') : t('replayAction');
		action.setAttribute('aria-label', status === 'completed' ? t('replayAgainAction') : t('replayAction'));
	}
	const metadataAvailable = !!meta && (status === 'ready' || status === 'completed');
	if (metadata) metadata.setAttribute('aria-hidden', metadataAvailable ? 'false' : 'true');
	if (metadataAvailable) {
		const setReplayValue = (id, value) => { const element = $(id); if (element) element.textContent = value; };
		setReplayValue('replay-mode-value', meta.mode || 'Base Game');
		setReplayValue('replay-basebet-value', formatCurrency(meta.baseBet));
		setReplayValue('replay-cost-value', multiplierText(meta.costMultiplier));
		setReplayValue('replay-totalcost-value', formatReplayCurrency(meta.totalCost));
		setReplayValue('replay-payout-value', multiplierText(meta.payoutMultiplier));
		setReplayValue('replay-totalwin-value', formatReplayCurrency(meta.totalWin));
	}
	if (overlayAction) {
		overlayAction.hidden = !metadataAvailable;
		overlayAction.disabled = !metadataAvailable;
		overlayAction.textContent = status === 'completed' ? t('replayAgainAction') : t('startReplay');
		overlayAction.setAttribute('aria-label', status === 'completed' ? t('replayAgainAction') : t('startReplay'));
	}
	if (overlay) overlay.setAttribute('aria-hidden', status === 'running' ? 'true' : 'false');
	if (status === 'loading') {
		if (overlayTitle) overlayTitle.textContent = t('replayLoading');
		if (overlayDetail) overlayDetail.textContent = detail || t('replayLoadingDetail');
	} else if (status === 'ready') {
		if (overlayTitle) overlayTitle.textContent = t('replayTitle');
	} else if (status === 'completed') {
		if (overlayTitle) overlayTitle.textContent = t('replayCompleted');
	} else if (status === 'error') {
		if (overlayTitle) overlayTitle.textContent = t('replayError');
		if (overlayDetail) overlayDetail.textContent = detail || t('replayErrorDetail');
	}
}

function replayError(title, detail) {
	state.fatal = true;
	state.replay = true;
	state.replayPlaying = false;
	state.spinning = false;
	state.walletBusy = false;
	stopAutoSpin();
	clearSkip();
	closeModals(true);
	state.grid = [];
	board.innerHTML = '';
	stage.classList.remove('spinning', 'bonus-mode', 'win-focus', 'antic', 'skip-mode');
	setReplayLifecycle('error', null, 'The saved play could not be loaded or validated. Please relaunch the replay from the game host.');
	console.error('[GGR replay error]', { title, detail });
}

function fatalError(title, detail = '') {
	state.fatal = true;
	stopAutoSpin();
	state.spinning = false;
	state.walletBusy = false;
	clearSkip();
	closeModals(true);
	updateLocks();
	stage.classList.add('fatal');
	$('btn-spin')?.classList.remove('busy', 'skip-armed');
	let overlay = $('fatal-error');
	if (!overlay) {
		overlay = document.createElement('div');
		overlay.id = 'fatal-error';
		overlay.className = 'fatal-error';
		overlay.innerHTML = '<div class="fatal-error-card"><div class="fatal-error-title"></div><div class="fatal-error-detail"></div></div>';
		stage.appendChild(overlay);
	}
	overlay.querySelector('.fatal-error-title').textContent = title;
	overlay.querySelector('.fatal-error-detail').textContent = detail || 'Please relaunch the game from the game host.';
	overlay.classList.add('show');
	overlay.setAttribute('aria-hidden', 'false');
	console.error('[GGR fatal]', { title, detail });
}
function validateLaunchUrl() {
	if (UrlState.replay()) {
		const missing = [];
		if (!UrlState.hasLaunchParam('rgs_url', 'rgsUrl', 'rgsURL')) missing.push('rgs_url');
		if (!UrlState.hasLaunchParam('game', 'gameName', 'slug')) missing.push('game');
		if (!UrlState.hasLaunchParam('version', 'gameVersion')) missing.push('version');
		if (!UrlState.hasLaunchParam('mode', 'betMode')) missing.push('mode');
		if (!UrlState.hasLaunchParam('event', 'eventID', 'eventId', 'betID', 'betId')) missing.push('event');
		if (missing.length) {
			replayError('Invalid replay launch', 'Missing required Stake Engine replay parameters: ' + missing.join(', ') + '.');
			return false;
		}
		const malformed = [];
		const boundedPathValue = (value) => typeof value === 'string' && value.length > 0 && value.length <= 240
			&& ![...value].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
		if (!boundedPathValue(UrlState.game())) malformed.push('game');
		if (!boundedPathValue(UrlState.version())) malformed.push('version');
		if (!boundedPathValue(UrlState.launchMode())) malformed.push('mode');
		if (!boundedPathValue(UrlState.event())) malformed.push('event');
		if (!PRODUCTION_BET_MODES.map((mode) => mode.toLowerCase()).includes(replayModeIdentity(UrlState.launchMode()))) malformed.push('mode');
		try {
			const raw = UrlState.rgsUrl();
			const lowerRaw = raw.toLowerCase();
			const url = new URL(lowerRaw.startsWith('http://') || lowerRaw.startsWith('https://') ? raw : 'https://' + raw);
			if (!/^https?:$/.test(url.protocol) || !url.hostname || url.username || url.password || url.search || url.hash) malformed.push('rgs_url');
		} catch (error) { malformed.push('rgs_url'); }
		if (UrlState.hasLaunchParam('amount', 'bet', 'stake')) {
			const amount = Number(rawConfigAmount(UrlState.amount()));
			if (!Number.isSafeInteger(amount) || amount <= 0) malformed.push('amount');
		}
		if (UrlState.hasLaunchParam('currency') && !/^[A-Z]{2,8}$/.test(UrlState.currencyRaw())) malformed.push('currency');
		if (UrlState.hasLaunchParam('lang', 'language') && !/^[a-z]{2}(-[a-z]{2})?$/i.test(UrlState.lang())) malformed.push('lang');
		if (UrlState.hasLaunchParam('device', 'deviceType') && !/^(desktop|mobile|tablet)$/i.test(UrlState.device())) malformed.push('device');
		if (malformed.length) {
			replayError('Invalid replay launch', 'Malformed Stake Engine replay parameters: ' + [...new Set(malformed)].join(', ') + '.');
			return false;
		}
		return true;
	}
	if (!UrlState.requiresRgs()) return true;
	const missing = [];
	if (!UrlState.sessionID()) missing.push('sessionID');
	if (!UrlState.rgsUrl()) missing.push('rgs_url');
	if (!UrlState.hasLaunchParam('currency')) missing.push('currency');
	if (!UrlState.hasLaunchParam('lang', 'language')) missing.push('lang');
	if (!UrlState.hasLaunchParam('device', 'deviceType')) missing.push('device');
	const lang = UrlState.lang();
	const currency = UrlState.currency();
	const device = UrlState.device();
	if (!/^[a-z]{2}(-[a-z]{2})?$/i.test(lang)) missing.push('valid lang');
	if (!/^[A-Z]{2,8}$/.test(currency)) missing.push('valid currency');
	if (!/^(desktop|mobile|tablet)$/i.test(device)) missing.push('valid device');
	if (missing.length) {
		fatalError('Invalid game launch', 'The game URL is missing or has invalid game-service launch parameters: ' + missing.join(', ') + '. Please relaunch the game.');
		return false;
	}
	return true;
}
function checkLaunchUrlIntegrity() {
	if (!UrlState.requiresRgs()) return;
	if (window.location.href !== initialLaunchUrl) {
		fatalError('Game launch URL changed', 'The launch URL changed after the game started. Please relaunch the game from the game host.');
	}
}
window.addEventListener('popstate', checkLaunchUrlIntegrity);
window.addEventListener('hashchange', checkLaunchUrlIntegrity);
['pushState', 'replaceState'].forEach((method) => {
	const original = history[method];
	history[method] = function patchedHistoryMethod(...args) {
		const result = original.apply(this, args);
		setTimeout(checkLaunchUrlIntegrity, 0);
		return result;
	};
});

function insufficientBalanceTitle() {
	return 'Insufficient Balance';
}
function showNotice(title, body) {
	const titleEl = $('notice-title');
	const bodyEl = $('notice-body');
	if (titleEl) titleEl.textContent = title;
	if (bodyEl) bodyEl.innerHTML = body;
	const ok = $('notice-ok');
	if (ok) ok.onclick = closeModals;
	openModal('modal-notification');
}
function showInsufficientFunds(requiredAmount = state.bet) {
	const title = insufficientBalanceTitle();
	const needed = Math.max(0, roundMoney(requiredAmount - state.balance));
	const detail = needed > 0
		? 'Your balance is too low for this action. Required: <strong>' + formatCurrency(requiredAmount) + '</strong>. Available: <strong>' + formatCurrency(state.balance) + '</strong>.'
		: 'Your balance is too low for this action.';
	stage.classList.add('shake');
	setTimeout(() => stage.classList.remove('shake'), 420);
	showNotice(title, detail);
}
function showInterruptedRoundMessage() {
	return new Promise((resolve) => {
		const btn = $('interrupted-continue');
		if (!btn) { resolve(); return; }
		btn.onclick = () => {
			btn.onclick = null;
			closeModals(true);
			resolve();
		};
		openModal('modal-interrupted-round');
	});
}
// Generic confirmation gate for major actions. Stake rule: no major action
// (starting Auto-Bet, buying a bonus, enabling a double-chance style feature)
// may activate on a single click. Auto-Bet and Bonus Buy have their own
// specialised confirm dialogs; every FUTURE major action (e.g. Double Chance)
// must be routed through this gate before it takes effect:
//
//   if (!(await confirmMajorAction({ title: 'DOUBLE CHANCE', body: '...' }))) return;
//
// Resolves true only on an explicit Confirm click. Cancel, the close button,
// a backdrop click and Escape all resolve false without side effects.
function confirmMajorAction({ title = 'CONFIRM ACTION', body = '', confirmLabel = 'Confirm', cancelLabel = 'Cancel' } = {}) {
	if (state.replay || UrlState.replay()) return Promise.resolve(false);
	return new Promise((resolve) => {
		const modal = $('modal-major-confirm');
		const titleEl = $('major-confirm-title');
		const bodyEl = $('major-confirm-body');
		const yes = $('major-confirm-yes');
		const no = $('major-confirm-no');
		if (!modal || !titleEl || !bodyEl || !yes || !no) { resolve(false); return; }
		titleEl.textContent = title;
		bodyEl.innerHTML = body;
		yes.textContent = confirmLabel;
		no.textContent = cancelLabel;
		let settled = false;
		let observer = null;
		const done = (result) => {
			if (settled) return;
			settled = true;
			if (observer) observer.disconnect();
			yes.onclick = null;
			no.onclick = null;
			closeModals();
			resolve(result);
		};
		yes.onclick = () => done(true);
		no.onclick = () => done(false);
		// Escape / backdrop / close-x go through closeModals() directly; treat
		// any non-confirm dismissal as Cancel so the promise can never hang.
		observer = new MutationObserver(() => {
			if (!modal.classList.contains('open')) done(false);
		});
		observer.observe(modal, { attributes: true, attributeFilter: ['class'] });
		openModal('modal-major-confirm');
	});
}

// Stake RGS wallet bridge. This mirrors packages/rgs-requests in standalone form.
const Rgs = (() => {
	let authenticatePromise = null;
	let lastRound = null;
	let walletConfig = null;
	let cooldownUntil = 0;
	let nextRequestAt = 0;
	let requestGate = Promise.resolve();
	let availableModes = [];
	let lastRgsWarningAt = 0;
	let currentRoundNeedsEnd = false;
	let expectedNextRequest = null;
	let playPromise = null;
	let endRoundPromise = null;
	let eventPromise = null;
	let startupRecoveryPromise = null;
	const configured = () => !!UrlState.sessionID() && !!UrlState.rgsUrl() && !UrlState.replay();
	const now = () => Date.now();
	const setCooldown = (ms = 1800) => { cooldownUntil = Math.max(cooldownUntil, now() + ms); };
	const cooldownRemaining = () => Math.max(0, cooldownUntil - now());
	const blocked = () => cooldownRemaining() > 0;
	const endpoint = (path) => {
		const host = UrlState.rgsUrl();
		if (!host) return path;
		let base = host.indexOf('http://') === 0 || host.indexOf('https://') === 0 ? host : 'https://' + host;
		while (base.endsWith('/')) base = base.slice(0, -1);
		return base + path;
	};
	const toApiAmount = moneyToApiAmount;
	const fromApiAmount = apiAmountToMoney;
	const syncBetLevels = (config, data = {}) => {
		return applyBetConfig(normalizeBetConfig({ ...data, config }, 'authenticate'), { preferDefault: true });
	};
	const normalizeBet = (amount) => {
		const config = walletConfig || {};
		const levels = Array.isArray(activeBetConfig.apiLevels) ? activeBetConfig.apiLevels : [];
		if (levels.length && BETS.length) {
			const requestedMoney = Number(amount) || state.bet;
			const idx = nearestBetIndex(requestedMoney, BETS);
			const selected = levels[Math.max(0, idx)] || toApiAmount(BETS[Math.max(0, idx)] || requestedMoney);
			const normalized = BETS[Math.max(0, idx)] || fromApiAmount(selected);
			if (normalized !== state.bet) {
				state.bet = normalized;
				state.betIdx = idx >= 0 ? idx : state.betIdx;
				updateMeters();
			}
			return selected;
		}
		let apiAmount = toApiAmount(amount);
		const min = Number(config.minBet || 0);
		const max = Number(config.maxBet || 0);
		const step = Number(config.stepBet || config.defaultBetLevel || 0);
		if (min && apiAmount < min) apiAmount = min;
		if (max && apiAmount > max) apiAmount = max;
		if (step) apiAmount = Math.round(apiAmount / step) * step;
		if (min && apiAmount < min) apiAmount = min;
		if (max && apiAmount > max) apiAmount = max;
		return apiAmount;
	};
	const shouldDeferWalletBalance = () => state.spinning || state.walletBalanceDeferred;
	const applyWalletBalance = (walletBalance) => {
		state.balance = walletBalance.amount;
		if (walletBalance.currency) state.currency = walletBalance.currency;
		applyLanguage();
		updateMeters();
	};
	const consumePendingBalance = () => {
		const pending = state.pendingWalletBalance;
		state.pendingWalletBalance = null;
		return pending;
	};
	const setBalanceDeferred = (deferred) => {
		state.walletBalanceDeferred = !!deferred;
		if (!state.walletBalanceDeferred) state.pendingWalletBalance = null;
	};
	const applyResponse = (data) => {
		const balanceAmount = Number(data && data.balance && data.balance.amount);
		if (Number.isFinite(balanceAmount)) {
			const walletBalance = {
				amount: fromApiAmount(balanceAmount),
				currency: data.balance.currency ? String(data.balance.currency) : state.currency,
				rawAmount: balanceAmount,
			};
			if (shouldDeferWalletBalance()) state.pendingWalletBalance = walletBalance;
			else applyWalletBalance(walletBalance);
		}
		if (data && data.round) lastRound = data.round;
		if (data && data.config) {
			walletConfig = data.config;
			if (typeof data.config.jurisdiction?.socialCasino === 'boolean') {
				state.socialCasino = data.config.jurisdiction.socialCasino;
			}
			if (data.config.betModes) availableModes = Object.keys(data.config.betModes);
			syncBetLevels(data.config, data);
			applyLanguage();
		}
		return data;
	};
	const errorInfo = (error) => ({
		status: error && error.status,
		message: error && error.message,
		data: error && error.data,
	});
	const roundId = (round) => round && (round.id || round.roundID || round.roundId || round.uuid || round.uid || null);
	const balanceFromResponse = (data) => {
		const amount = Number(data && data.balance && data.balance.amount);
		return Number.isFinite(amount) ? fromApiAmount(amount) : null;
	};
	const debugWallet = (entry) => {
		if (!UrlState.debug()) return;
		debugJson('[GGR wallet-json]', entry);
		console.table([{
			spinId: entry.spinId ?? null,
			requestType: entry.requestType,
			roundId: entry.roundId ?? null,
			active: entry.active ?? null,
			payout: entry.payout ?? null,
			payoutMultiplier: entry.payoutMultiplier ?? null,
			willCallEndRound: entry.willCallEndRound ?? false,
			balanceBefore: entry.balanceBefore ?? null,
			balanceAfter: entry.balanceAfter ?? null,
			timestamp: new Date().toISOString(),
		}]);
	};
	const assertWalletOrder = (requestType) => {
		if (!UrlState.debug()) return;
		if (expectedNextRequest && requestType !== expectedNextRequest) {
			console.error('[RGS assert] expected next wallet request to be ' + expectedNextRequest + ', got ' + requestType, {
				expectedNextRequest,
				requestType,
				lastRound,
				currentRoundNeedsEnd,
			});
		}
	};
	const assertOk = (response, data) => {
		const statusCode = data && data.status && data.status.statusCode;
		if (!response.ok || data?.error || (statusCode && statusCode !== 'SUCCESS')) {
			const message = data?.error?.message || data?.status?.statusMessage || response.statusText || 'RGS request failed';
			const error = new Error(message);
			error.data = data;
			error.status = response.status;
			throw error;
		}
	};
	const errorText = (error) => (JSON.stringify((error && error.data) || {}) + ' ' + ((error && error.message) || '')).toLowerCase();
	const isPlayerHasActiveRoundError = (error) => {
		const text = errorText(error);
		return text.includes('player has active round') || (text.includes('has active round') && !text.includes('no active round'));
	};
	const isNoActiveRoundError = (error) => {
		const text = errorText(error);
		return text.includes('no active round') || text.includes('does not have active round') || text.includes('round is not active') || text.includes('already closed');
	};
	const isRateLimitedError = (error) => Number(error && error.status) === 429;
	const isFatalRgsError = (error) => {
		const text = errorText(error);
		return Number(error && error.status) === 401 || Number(error && error.status) === 403
			|| text.includes('invalid session') || text.includes('session not found') || text.includes('unauthorized')
			|| text.includes('forbidden') || text.includes('invalid launch') || text.includes('invalid token');
	};
	const warnRgs = (label, error) => {
		if (!UrlState.debug()) return;
		if (now() - lastRgsWarningAt < 5000) return;
		lastRgsWarningAt = now();
		console.debug(label, errorInfo(error));
	};
	const failRequest = (reason, error) => {
		if (error) warnRgs('[RGS] ' + reason, error);
		if (error && UrlState.requiresRgs() && isFatalRgsError(error)) {
			fatalError('Game service connection error', 'The game launch session is invalid or expired. Please relaunch the game from the game host.');
		}
		if (error) setCooldown(isRateLimitedError(error) ? 2200 : 1200);
		return false;
	};
	const resolveMode = (mode) => {
		if (!availableModes.length) return mode;
		const candidates = [mode, String(mode).toUpperCase(), String(mode).toLowerCase()];
		return candidates.find((candidate) => availableModes.includes(candidate))
			|| availableModes.find((candidate) => candidate.toLowerCase() === String(mode).toLowerCase())
			|| mode;
	};
	const post = async (path, variables, options = {}) => {
		if (state.replay || UrlState.replay()) throw new Error('Wallet/session requests are forbidden in Replay Mode');
		if (!options.force && blocked()) {
			const error = new Error('RGS request throttled');
			error.status = 429;
			error.data = { code: 'CLIENT_THROTTLE', retryAfterMs: cooldownRemaining() };
			throw error;
		}
		const waitForTurn = requestGate.then(async () => {
			const delay = Math.max(0, nextRequestAt - now());
			if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
			nextRequestAt = now() + 350;
		});
		requestGate = waitForTurn.catch(() => {});
		await waitForTurn;
		const response = await fetch(endpoint(path), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(variables),
		});
		let data = {};
		const text = await response.text();
		try { data = text ? JSON.parse(text) : {}; } catch (e) { data = { raw: text }; }
		try {
			assertOk(response, data);
		} catch (error) {
			if (isRateLimitedError(error)) setCooldown(2200);
			throw error;
		}
		return applyResponse(data);
	};
	const markRoundClosed = () => {
		if (lastRound) lastRound = { ...lastRound, active: false };
	};
	const markNoActiveRound = () => {
		markRoundClosed();
		currentRoundNeedsEnd = false;
		expectedNextRequest = null;
	};
	// Stake's flow is explicit: call /wallet/end-round only when /wallet/play
	// returns round.active=true. Win/loss and payout fields are not a reliable
	// signal here; using them makes end-round look random during review.
	const roundNeedsEnd = (round) => !!round && round.active === true;
	const markRoundFromPlay = (round) => {
		currentRoundNeedsEnd = roundNeedsEnd(round);
		expectedNextRequest = currentRoundNeedsEnd ? 'end-round' : null;
		return currentRoundNeedsEnd;
	};
	const recoverActiveRound = async (round) => {
		if (!round || round.active !== true) return null;
		if (startupRecoveryPromise) return startupRecoveryPromise;
		currentRoundNeedsEnd = true;
		startupRecoveryPromise = endRound().catch((error) => {
			warnRgs('[RGS] active-round recovery failed', error);
			return false;
		}).finally(() => { startupRecoveryPromise = null; });
		return startupRecoveryPromise;
	};
	const authenticate = async () => {
		if (!configured()) return null;
		if (authenticatePromise) return authenticatePromise;
		authenticatePromise = post('/wallet/authenticate', {
			sessionID: UrlState.sessionID(),
			language: UrlState.lang(),
		}).then(async (data) => {
			if (data && data.round && data.round.active === true) {
				lastRound = data.round;
				applyBetFromRound(data.round);
				if (rgsRoundIsBonus(data.round)) markRoundFromPlay(data.round);
				else await recoverActiveRound(data.round);
			}
			return data;
		}).catch((error) => {
			console.warn('[RGS] authenticate failed', error);
			if (UrlState.requiresRgs()) {
				fatalError('Game service connection error', 'The game could not authenticate with the game service. Please relaunch the game.');
			}
			authenticatePromise = null;
			return false;
		});
		return authenticatePromise;
	};
	const play = async (amount, mode, context = {}) => {
		if (!configured()) return null;
		if (blocked()) return false;
		if (playPromise) return false;
		playPromise = (async () => {
			if (endRoundPromise) {
				const ended = await endRoundPromise;
				if (ended && ended.blocked) return false;
			}
			if (currentRoundNeedsEnd) {
				const ended = await endRound(context);
				if (!ended || ended.blocked) return false;
			}
			const auth = await authenticate();
			if (auth === false) return false;
			const apiAmount = normalizeBet(amount);
			if (!apiAmount || apiAmount <= 0) return false;
			try {
				assertWalletOrder('play');
				const balanceBefore = state.balance;
				const data = await post('/wallet/play', {
					mode: resolveMode(mode),
					currency: state.currency,
					sessionID: UrlState.sessionID(),
					amount: apiAmount,
				});
				const needsEnd = markRoundFromPlay(data && data.round);
				if (data) data.__needsEndRound = needsEnd;
				debugWallet({
					spinId: context.spinId,
					requestType: 'play',
					roundId: roundId(data && data.round),
					active: data && data.round ? data.round.active : null,
					payout: data && data.round ? data.round.payout : null,
					payoutMultiplier: data && data.round ? data.round.payoutMultiplier : null,
					willCallEndRound: needsEnd,
					balanceBefore,
					balanceAfter: balanceFromResponse(data),
				});
				return data;
			} catch (error) {
				if (isPlayerHasActiveRoundError(error)) {
					warnRgs('[RGS] play found active round; recovering with end-round', error);
					currentRoundNeedsEnd = true;
					expectedNextRequest = 'end-round';
					const ended = await endRound({ ...context, recovery: 'play-active-round' });
					if (ended && !ended.blocked) {
						return false;
					}
					setCooldown(isRateLimitedError(error) ? 2200 : 900);
					return false;
				}
				currentRoundNeedsEnd = false;
				expectedNextRequest = null;
				return failRequest('play failed', error);
			}
		})().finally(() => { playPromise = null; });
		return playPromise;
	};
	const endRound = async (context = {}) => {
		if (!configured()) return null;
		if (!currentRoundNeedsEnd) {
			debugWallet({ spinId: context.spinId, requestType: 'end-round-skip', willCallEndRound: false, balanceBefore: state.balance, balanceAfter: state.balance });
			return null;
		}
		if (endRoundPromise) return endRoundPromise;
		try {
			assertWalletOrder('end-round');
			const balanceBefore = state.balance;
			endRoundPromise = post('/wallet/end-round', { sessionID: UrlState.sessionID() }, { force: true })
				.then((data) => {
					debugWallet({
						spinId: context.spinId,
						requestType: 'end-round',
						roundId: roundId(data && data.round),
						active: data && data.round ? data.round.active : null,
						payout: data && data.round ? data.round.payout : null,
						payoutMultiplier: data && data.round ? data.round.payoutMultiplier : null,
						willCallEndRound: false,
						balanceBefore,
						balanceAfter: balanceFromResponse(data),
					});
					currentRoundNeedsEnd = false;
					expectedNextRequest = null;
					markRoundClosed();
					return data;
				})
				.finally(() => { endRoundPromise = null; });
			return await endRoundPromise;
		} catch (error) {
			if (isNoActiveRoundError(error)) {
				markNoActiveRound();
				return { ignored: 'no-active-round' };
			}
			warnRgs('[RGS] end-round failed', error);
			setCooldown(isRateLimitedError(error) ? 2200 : 900);
			return { blocked: true, reason: isRateLimitedError(error) ? 'rate-limit' : 'end-round-error' };
		}
	};
	const saveEvent = async (eventValue, context = {}) => {
		if (!configured()) return null;
		if (eventValue === undefined || eventValue === null) return null;
		const event = typeof eventValue === 'string' ? eventValue : JSON.stringify(eventValue);
		eventPromise = post('/bet/event', { sessionID: UrlState.sessionID(), event }, { force: true })
			.then((data) => {
				debugWallet({
					spinId: context.spinId,
					requestType: 'bet-event',
					roundId: roundId(data && data.round),
					active: data && data.round ? data.round.active : null,
					payout: data && data.round ? data.round.payout : null,
					payoutMultiplier: data && data.round ? data.round.payoutMultiplier : null,
					willCallEndRound: currentRoundNeedsEnd,
					balanceBefore: state.balance,
					balanceAfter: balanceFromResponse(data),
				});
				return data;
			})
			.catch((error) => {
				warnRgs('[RGS] event save failed', error);
				return false;
			})
			.finally(() => { eventPromise = null; });
		return eventPromise;
	};
	const modeFor = (buy) => {
		if (!buy) return 'base';
		if (buy.id === 'hunt') return 'hunt';
		if (buy.id === 'rainbow') return 'rainbow';
		if (buy.id === 'tier1') return 'bonus_tier1';
		if (buy.id === 'tier2') return 'bonus';
		return 'base';
	};
	const busy = () => !!playPromise || !!endRoundPromise || !!eventPromise || !!startupRecoveryPromise || currentRoundNeedsEnd;
	return { authenticate, play, endRound, saveEvent, modeFor, configured, blocked, cooldownRemaining, consumePendingBalance, setBalanceDeferred, busy, get lastRound() { return lastRound; } };
})();

async function resumeLaunchRound() {
	if (!validateLaunchUrl()) return;
	if (Replay.configured()) {
		await Replay.start();
		return;
	}
	if (!Rgs.configured()) return;
	// Lock the UI until launch authentication (including any base-mode
	// active-round settlement) is finished. Without this lock an immediate
	// manual spin could race the startup flow and settle a resumable bonus
	// round through the play/active-round recovery path.
	setWalletBusy(true);
	const auth = await Rgs.authenticate();
	if (auth === false || state.fatal) { setWalletBusy(false); return; }
	const round = auth && auth.round;
	if (!round || round.active !== true || !rgsRoundIsBonus(round)) { setWalletBusy(false); return; }
	// A restored feature is gameplay, not a presentation opportunity. Remove
	// the visual layer before showing its mandatory interruption message.
	Intro.dismiss('active-round-restore', { immediate:true });
	const spinId = ++spinSeq;
	const events = normalizeRgsEvents(round.state);
	try {
		rgsRoundAmountContract(round, events);
	} catch (error) {
		console.error('[RGS contract] rejected resumed round', { message: error && error.message, roundId: rgsRoundId(round) });
		Rgs.setBalanceDeferred(true);
		const endRoundResult = await Rgs.endRound({ spinId, recovery: 'inconsistent-resumed-round' });
		Rgs.consumePendingBalance();
		Rgs.setBalanceDeferred(false);
		if (endRoundResult && endRoundResult.blocked) {
			fatalError('Game service settlement failed', 'The inconsistent saved round could not be closed safely. Please relaunch the game.');
		} else {
			fatalError('Inconsistent game-service round', 'The saved round amounts did not agree with its authoritative event data. Nothing was reconstructed locally.');
		}
		setWalletBusy(false);
		return;
	}
	const startIndex = rgsResumeIndex(round);
	await showInterruptedRoundMessage();
	if (state.fatal) { setWalletBusy(false); return; }
	setWalletBusy(true);
	state.spinning = true;
	$('btn-spin').classList.add('busy');
	clearSkip();
	try {
		applyBetFromRound(round);
		state.mode = 'free';
		state.tier = 1;
		state.fsTotal = rgsFreeSpinTotal(events, CONFIG.tiers[1].spins);
		state.fsLeft = state.fsTotal;
		state.reveals.clear();
		state.golden.clear();
		setWin(0);
		updateFsCounter();
		updateMeters();
		if (startIndex <= 0) await bonusIntroRgs(state.fsTotal);
		const displayedWin = await playRgsBookRound({ round }, spinId, {
			startIndex,
			skipBonusIntro: true,
			trackProgress: true,
		});
		Rgs.setBalanceDeferred(true);
		const endRoundResult = await Rgs.endRound({ spinId, resume: 'bonus' });
		const walletBalanceAfterEndRound = Rgs.consumePendingBalance();
		Rgs.setBalanceDeferred(false);
		if (endRoundResult && endRoundResult.blocked) {
			stopAutoSpin();
			fatalError('Game service settlement failed', 'The resumed feature round could not be completed. Please relaunch the game.');
			return;
		}
		try {
			applyAuthoritativeWalletBalance({
				active: true,
				walletBalanceAfterPlay: null,
				walletBalanceAfterEndRound,
			});
		} catch (error) {
			fatalError('Game service settlement failed', 'The authoritative balance could not be applied. Please relaunch the game.');
			return;
		}
		if (displayedWin > 0) await showBanner(displayedWin);
	} finally {
		Rgs.setBalanceDeferred(false);
		state.mode = 'base';
		state.tier = 0;
		state.fsLeft = 0;
		state.fsTotal = 0;
		updateFsCounter();
		state.spinning = false;
		$('btn-spin').classList.remove('busy');
		clearSkip();
		setWalletBusy(false);
		updateMeters();
	}
}

// Board symbol pool — weights from SYMBOLS, feature-symbol weights from CONFIG.
const POOL_SCALE = 50; // allows fractional feature-symbol weights (matches the sim)
function buildPool({ noRainbow = false, boostRainbow = 1, boostScatter = 1 } = {}) {
	const pool = [];
	for (const k of Object.keys(SYMBOLS)) {
		let w = SYMBOLS[k].weight;
		if (k === 'rainbow') w = noRainbow ? 0 : CONFIG.rainbowWeight * boostRainbow;
		if (k === 'scatter') w = CONFIG.scatterWeight * boostScatter;
		const n = Math.round(w * POOL_SCALE);
		for (let i = 0; i < n; i += 1) pool.push(k);
	}
	return pool;
}
let POOL = buildPool();
const randKey = () => POOL[(Math.random() * POOL.length) | 0];

function newGrid(opts = {}) {
	if (state.replay || UrlState.replay()) return false;
	POOL = buildPool(opts);
	state.grid = Array.from({ length: COLS }, () => Array.from({ length: ROWS }, randKey));
	if (opts.forceRainbow && !state.grid.flat().includes('rainbow')) {
		state.grid[(Math.random() * COLS) | 0][(Math.random() * ROWS) | 0] = 'rainbow';
	}
	for (let i = 0; i < (opts.forceScatters || 0); i += 1) {
		state.grid[i % COLS][(i / COLS) | 0] = 'scatter';
	}
	return true;
}

function cellEl(col, row) { return board.children[row * COLS + col]; }

// ---- column-based drop timing ----
const TF = () => (state.turbo ? 0.5 : 1);               // turbo time factor
const rawWait = (ms) => waitBase(ms, true); // not turbo-scaled (the wait IS the drop)
const COL_DELAY = 58;                                    // per-column stagger (left -> right)
const DROP_DUR = (rows) => 220 + Math.min(rows, ROWS) * 42;
const REEL_END_LEAD_MS = 1500;
const SCATTER_SOUND_LEAD_MS = 500;
const CLUSTER_BURST_LEAD_MS = 500;
const COUNT_UP_INTERVAL_MS = 28;
const countUpSteps = () => (state.turbo ? 8 : 18);
// A full-board drop: every column falls in as a stack, staggered by column.
function fullDropMap() {
	const drops = new Map();
	for (let c = 0; c < COLS; c += 1) for (let r = 0; r < ROWS; r += 1)
		drops.set(ck(c, r), { rows: ROWS, delay: c * COL_DELAY * TF(), dur: DROP_DUR(ROWS) * TF() });
	return drops;
}
function applyAnticipationDropTiming(drops) {
	const COLD = [0, 150, 320, 510, 900, 1480]; // progressive deceleration (ms, pre-turbo)
	for (const [k, d] of drops) {
		const c = +k.split(',')[0];
		d.delay = COLD[c] * TF();
		d.dur = (DROP_DUR(ROWS) + c * 45 + (c >= COLS - 2 ? 150 : 0)) * TF();
	}
}
// Latest land time (delay+dur) across a drop map, for awaiting the settle.
function dropEnd(drops) { let m = 0; for (const d of drops.values()) m = Math.max(m, d.delay + d.dur); return m; }
function fmtFeatureValue(value) {
	const n = Math.round((Number(value) || 0) * 100) / 100;
	return Number.isInteger(n) ? String(n) : String(n).replace(/\.?0+$/, '');
}
function revealLabel(rv) {
	if (!rv) return '';
	if (rv.kind === 'coin' || rv.kind === 'blank') return fmtFeatureValue(rv.value) + 'x';
	if (rv.kind === 'mult') return 'x' + fmtFeatureValue(rv.value);
	if (rv.kind === 'collector') return 'COLLECT';
	return '';
}

// paint rebuilds the board; cells listed in the drops map fall in (only moved
// or new symbols), everything else is placed statically so nothing re-drops.
function paint({ drops = null } = {}) {
	board.innerHTML = '';
	for (let row = 0; row < ROWS; row += 1) {
		for (let col = 0; col < COLS; col += 1) {
			const key = state.grid[col][row];
			const sym = SYMBOLS[key];
			const cell = document.createElement('div');
			cell.className = 'cell';
			if (state.golden.has(ck(col, row))) cell.classList.add('golden');
			const rv = state.reveals.get(ck(col, row));
			if (rv) {
				cell.classList.add('has-reveal');
				const wrap = document.createElement('div');
				wrap.className = 'reveal ' + rv.kind;
				const ri = document.createElement('img'); ri.src = rv.asset; wrap.appendChild(ri);
				const label = revealLabel(rv);
				if (label) { const lab = document.createElement('span'); lab.className = 'reveal-label'; lab.textContent = label; wrap.appendChild(lab); }
				cell.appendChild(wrap);
			} else {
				const img = document.createElement('img');
				img.src = sym.src; img.alt = key;
				if (sym.cls) img.classList.add(sym.cls);
				const d = drops && drops.get(ck(col, row));
				if (d && d.rows > 0) {
					img.classList.add('dropping');
					img.style.setProperty('--dropY', (-(d.rows * 100)) + '%');
					img.style.animationDelay = d.delay + 'ms';
					img.style.animationDuration = d.dur + 'ms';
				}
				cell.appendChild(img);
			}
			board.appendChild(cell);
		}
	}
}

function rgsSymbolKey(raw) {
	const name = typeof raw === 'string' ? raw : (raw && (raw.name || raw.symbol || raw.id || raw.key));
	const key = RGS_SYMBOL_ALIASES[name] || RGS_SYMBOL_ALIASES[String(name || '').toUpperCase()] || name;
	return SYMBOLS[key] ? key : 'ten';
}
// Normalizes the Stake RGS book returned by /wallet/play. In Stake mode this
// book is the source of truth for the visible result and final WIN display.
function normalizeRgsEvents(roundState) {
	if (!roundState) return [];
	let stateValue = roundState;
	if (typeof stateValue === 'string') {
		try { stateValue = JSON.parse(stateValue); } catch (e) { return []; }
	}
	if (Array.isArray(stateValue)) return stateValue;
	if (Array.isArray(stateValue.events)) return stateValue.events;
	if (Array.isArray(stateValue.state)) return stateValue.state;
	return [];
}
function rgsRoundId(round) {
	return round && (round.betID || round.betId || round.roundID || round.roundId || round.id || null);
}
function rgsRoundMode(round) {
	return String(round && round.mode ? round.mode : 'base').toLowerCase();
}
function rgsRoundIsBonus(round) {
	const mode = rgsRoundMode(round);
	return mode.includes('bonus') || mode.includes('free');
}
function applyBetFromRound(round) {
	const bet = apiAmountToMoney(round && round.amount);
	if (!bet || bet <= 0) return;
	state.bet = bet;
	const exact = BETS.findIndex((value) => Math.abs(value - bet) < 0.000001);
	if (exact >= 0) state.betIdx = exact;
	else {
		let closest = 0;
		for (let i = 1; i < BETS.length; i += 1) {
			if (Math.abs(BETS[i] - bet) < Math.abs(BETS[closest] - bet)) closest = i;
		}
		state.betIdx = closest;
	}
	updateMeters();
}
function rgsRoundPayoutMoney(round) {
	const raw = round && round.payout;
	if (raw !== undefined && raw !== null) {
		if (typeof raw !== 'number' || !Number.isSafeInteger(raw) || raw < 0) return null;
		return replayApiAmountToMoney(raw);
	}
	const bookUnits = round && round.payoutMultiplier;
	if (typeof bookUnits !== 'number' || !Number.isSafeInteger(bookUnits) || bookUnits < 0) return null;
	return moneyRound(replayBookUnitsToMultiplier(bookUnits) * state.bet);
}
function bookAmountToMoney(amount) {
	return roundMoney((Number(amount) || 0) * state.bet / 100);
}
function finalBookWinMoney(events) {
	const final = [...events].reverse().find((event) => event && event.type === 'finalWin');
	return final ? bookAmountToMoney(final.amount) : 0;
}
function rgsRoundAmountContract(round, events) {
	if (!round || typeof round !== 'object' || Array.isArray(round)) throw new Error('RGS round is missing');
	// Normal wallet rounds and Replay use the same event-level arithmetic
	// contract. This prevents a visually plausible winInfo sequence from
	// drifting away from its running total or finalWin before settlement.
	const validatedEvents = validateReplayEvents(Array.isArray(events) ? events : []);
	const finalEvents = (Array.isArray(events) ? events : []).filter((event) => event && event.type === 'finalWin');
	if (finalEvents.length !== 1) throw new Error('RGS round must contain exactly one authoritative finalWin event');
	const finalBookUnits = finalEvents[0].amount;
	if (typeof finalBookUnits !== 'number' || !Number.isSafeInteger(finalBookUnits) || finalBookUnits < 0) {
		throw new Error('RGS finalWin must be a non-negative integer in book units');
	}
	const maxBookUnits = Math.round(Number(CONFIG.maxWinMultiplier) * BOOK_MULTIPLIER_SCALE);
	if (finalBookUnits > maxBookUnits) throw new Error('RGS finalWin exceeds the configured max win');
	if (validatedEvents.runningBookUnits !== finalBookUnits || validatedEvents.final.amount !== finalBookUnits) {
		throw new Error('RGS event totals differ from the authoritative finalWin event');
	}
	const amount = round.amount;
	if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount <= 0) {
		throw new Error('RGS round amount must be a positive integer in API units');
	}
	const rawPayout = round.payout;
	if (rawPayout !== undefined && rawPayout !== null
		&& (typeof rawPayout !== 'number' || !Number.isSafeInteger(rawPayout) || rawPayout < 0)) {
		throw new Error('RGS payout must be a non-negative integer in API units');
	}
	const payoutPending = round.active === true && (rawPayout === undefined || rawPayout === null || rawPayout === 0);
	const rawPayoutMultiplier = round.payoutMultiplier;
	if (rawPayoutMultiplier !== undefined && rawPayoutMultiplier !== null) {
		const candidates = replayPayoutMultiplierCandidates(rawPayoutMultiplier);
		const unsettledZeroMultiplier = payoutPending && candidates.includes(0);
		if (!candidates.includes(finalBookUnits) && !unsettledZeroMultiplier) {
			throw new Error('RGS payoutMultiplier differs from the authoritative finalWin event');
		}
	}
	const expectedPayoutApiAmount = Math.round(amount * finalBookUnits / BOOK_MULTIPLIER_SCALE);
	if (rawPayout !== undefined && rawPayout !== null && rawPayout !== expectedPayoutApiAmount && !payoutPending) {
		throw new Error('RGS payout differs from the authoritative finalWin event');
	}
	return {
		finalBookUnits,
		expectedPayoutApiAmount,
		payoutPending,
		totalWin: replayApiAmountToMoney(expectedPayoutApiAmount),
	};
}
function rgsDisplayWinMoney(round, events) {
	return rgsRoundAmountContract(round, events).totalWin;
}
function rgsEventIndex(event, fallback) {
	const raw = event && (event.index ?? event.eventIndex ?? event.idx);
	const index = Number(raw);
	return Number.isFinite(index) ? Math.max(0, Math.floor(index)) : fallback;
}
function rgsResumeIndex(round) {
	const event = round && (round.event ?? round.currentEvent ?? round.eventIndex ?? round.resumeIndex);
	if (event === undefined || event === null || event === '') return 0;
	if (typeof event === 'number') return Math.max(0, Math.floor(event));
	if (typeof event === 'string') {
		const numeric = Number(event);
		if (Number.isFinite(numeric)) return Math.max(0, Math.floor(numeric));
		try {
			const parsed = JSON.parse(event);
			return rgsResumeIndex({ event: parsed });
		} catch (e) {
			return 0;
		}
	}
	if (typeof event === 'object') {
		const raw = event.nextIndex ?? event.index ?? event.eventIndex ?? event.currentEvent ?? event.step;
		const numeric = Number(raw);
		if (Number.isFinite(numeric)) return Math.max(0, Math.floor(numeric));
	}
	return 0;
}
function rgsFreeSpinTotal(events, fallback = 0) {
	const trigger = events.find((event) => event && event.type === 'freeSpinTrigger');
	const update = events.find((event) => event && event.type === 'updateFreeSpin');
	const value = Number((trigger && (trigger.totalFs ?? trigger.total ?? trigger.amount)) ?? (update && update.total));
	return Number.isFinite(value) && value > 0 ? value : fallback;
}
function rgsFeatureSummary(events) {
	const list = Array.isArray(events) ? events : [];
	const final = [...list].reverse().find((event) => event && event.type === 'finalWin');
	const hasFreeSpinTrigger = list.some((event) => event && event.type === 'freeSpinTrigger');
	const hasUpdateFreeSpin = list.some((event) => event && event.type === 'updateFreeSpin');
	const hasFreeSpinEnd = list.some((event) => event && event.type === 'freeSpinEnd');
	const hasCompleteRgsFeature = hasUpdateFreeSpin || hasFreeSpinEnd;
	const hasConfirmedFreeSpinFeature = hasFreeSpinTrigger && hasCompleteRgsFeature;
	const featureStats = hasCompleteRgsFeature ? summarizeFeatureEvents(list) : { ok: false, error: 'No complete feature book' };
	return {
		hasFreeSpinTrigger,
		hasUpdateFreeSpin,
		hasFreeSpinEnd,
		hasCompleteRgsFeature,
		hasConfirmedFreeSpinFeature,
		finalWin: final ? Number(final.amount) || 0 : 0,
		willStartVisualFeature: hasConfirmedFreeSpinFeature,
		featureStats,
	};
}
function rgsRevealHasConfirmedScatterTrigger(events, revealPos) {
	const list = Array.isArray(events) ? events : [];
	if (!Number.isInteger(revealPos) || revealPos < 0 || revealPos >= list.length) return false;
	let nextRevealPos = list.length;
	for (let i = revealPos + 1; i < list.length; i += 1) {
		if (list[i] && list[i].type === 'reveal') { nextRevealPos = i; break; }
	}
	const hasTriggerForReveal = list
		.slice(revealPos + 1, nextRevealPos)
		.some((event) => event && event.type === 'freeSpinTrigger');
	if (!hasTriggerForReveal) return false;
	return list.some((event) => event && (event.type === 'updateFreeSpin' || event.type === 'freeSpinEnd'));
}
function shouldRenderSafeRgsBase(events) {
	const list = Array.isArray(events) ? events : [];
	if (!USE_SAFE_RGS_BASE_RENDERER || !list.length) return false;
	const known = new Set(['reveal', 'winInfo', 'updateTumbleWin', 'setWin', 'setTotalWin', 'tumbleBoard', 'goldenReveal', 'goldenAward', 'goldenClear', 'finalWin']);
	if (!list.every((event) => event && known.has(event.type))) return false;
	return list.some((event) => event.type === 'reveal' && event.board);
}
function shouldRenderRgsRound(events) {
	const list = Array.isArray(events) ? events : [];
	return Rgs.configured()
		&& list.length > 0
		&& list.every((event) => event && REPLAY_EVENT_TYPES.has(event.type))
		&& list.some((event) => event.type === 'reveal' && event.board);
}
function setGridFromRgsBoard(rawBoard) {
	const boardData = Array.isArray(rawBoard) ? rawBoard : [];
	const rowStarts = [];
	state.grid = Array.from({ length: COLS }, (_, col) => {
		const reel = Array.isArray(boardData[col]) ? boardData[col] : null;
		if (!reel) {
			rowStarts[col] = 0;
			return Array.from({ length: ROWS }, (_, row) => RGS_FILLER_REEL[(col + row) % RGS_FILLER_REEL.length]);
		}
		const start = Math.max(0, Math.floor((reel.length - ROWS) / 2));
		rowStarts[col] = start;
		return Array.from({ length: ROWS }, (_, row) => rgsSymbolKey(reel[start + row] || reel[row] || reel[reel.length - 1]));
	});
	rgsBoardMeta = { rowStarts };
}
function rgsPosToCell(pos) {
	if (!pos) return null;
	const col = Number(pos.col ?? pos.column ?? pos.reel);
	const rawRow = Number(pos.row);
	if (!Number.isFinite(col) || !Number.isFinite(rawRow)) return null;
	const start = rgsBoardMeta.rowStarts[col] || 0;
	const candidates = [rawRow - start, rawRow - 1 - start, rawRow];
	for (const row of candidates) {
		if (Number.isInteger(row) && col >= 0 && col < COLS && row >= 0 && row < ROWS) return [col, row];
	}
	return null;
}
function rgsCellsFromPositions(positions) {
	const seen = new Set();
	const cells = [];
	for (const pos of positions || []) {
		const cell = rgsPosToCell(pos);
		if (!cell) continue;
		const key = ck(cell[0], cell[1]);
		if (seen.has(key)) continue;
		seen.add(key);
		cells.push(cell);
	}
	return cells;
}
function primeRgsResumeState(events, startIndex) {
	if (!startIndex) return;
	const prior = events.filter((event, fallback) => event && rgsEventIndex(event, fallback) < startIndex);
	const reveal = [...prior].reverse().find((event) => event.type === 'reveal' && event.board);
	if (reveal) {
		const revealPos = events.indexOf(reveal);
		setGridFromRgsBoard(reveal.board);
		if (!rgsRevealHasConfirmedScatterTrigger(events, revealPos)) removeUnconfirmedRgsScatterTrigger();
		if (reveal.gameType === 'freegame') state.mode = 'free';
		paint();
	}
	const freeSpin = [...prior].reverse().find((event) => event.type === 'updateFreeSpin');
	if (freeSpin) {
		state.mode = 'free';
		state.tier = state.tier || 1;
		state.fsTotal = Number(freeSpin.total) || state.fsTotal || 0;
		// Same 1-based mapping as the updateFreeSpin handler (see below).
		state.fsLeft = Math.max(0, state.fsTotal - Math.min(state.fsTotal, (Number(freeSpin.amount) || 0) + 1));
		updateFsCounter();
	}
}
async function bonusIntroRgs(totalFreeSpins, title = 'Golden Chance') {
	const el = $('bonus-intro'); if (!el) return;
	$('bi-title').textContent = title || 'Golden Chance';
	$('bi-spins').textContent = Math.max(0, Number(totalFreeSpins) || 0) + ' FREE SPINS';
	el.setAttribute('aria-hidden', 'false');
	el.classList.remove('out'); el.classList.add('show');
	Sound.freeSpins(); coinShower(18);
	const dismiss = new Promise((resolve) => {
		let done = false;
		let replayTimer = null;
		const close = () => {
			if (done) return;
			done = true;
			clearTimeout(replayTimer);
			el.removeEventListener('click', close);
			window.removeEventListener('keydown', onKey);
			resolve();
		};
		const onKey = (e) => {
			if (e.code === 'Enter' || e.code === 'Space') close();
		};
		el.addEventListener('click', close);
		window.addEventListener('keydown', onKey);
		if (state.replayPlaying) replayTimer = setTimeout(close, state.turbo ? 380 : 900);
	});
	await wait(state.turbo ? 320 : 520);
	await dismiss;
	el.classList.add('out'); await wait(420); el.classList.remove('show', 'out');
	el.setAttribute('aria-hidden', 'true');
	Sound.stopFreeSpins();
}
async function renderRgsWinInfo(event, runningWin) {
	const wins = Array.isArray(event.wins) ? event.wins : [];
	const cells = rgsCellsFromPositions(wins.flatMap((win) => win.positions || []));
	const eventStepWin = bookAmountToMoney(event.totalWin || wins.reduce((sum, win) => sum + (Number(win.win) || 0), 0));
	const stepWin = eventStepWin;
	const targetWin = roundMoney(runningWin + stepWin);
	if (cells.length) {
		stage.classList.add('win-focus');
		cells.forEach(([c, r]) => {
			state.golden.add(ck(c, r));
			const el = cellEl(c, r);
			if (el) el.classList.add('win');
		});
		Sound.cluster(Math.max(1, wins.length));
		wins.forEach((win) => {
			const winCells = rgsCellsFromPositions(win.positions || []);
			const cascadeMultiplier = Number(win.meta && (win.meta.multiplier ?? win.meta.globalMult)) || 1;
			showClusterFloat(bookAmountToMoney(win.win), winCells, cascadeMultiplier > 1 ? cascadeMultiplier + '× cascade' : '');
		});
	}
	setWin(targetWin, false);
	await countUp(targetWin, runningWin);
	await wait(state.turbo ? 280 : 620);
	if (cells.length) {
		Sound.clusterBurst(Math.max(1, wins.length), 0);
		cells.forEach(([c, r]) => {
			const el = cellEl(c, r); const img = el && el.querySelector('img');
			if (img) img.classList.add('clearing');
			if (el) {
				el.classList.add('converting');
				const p = stagePos(el); burstAt(p.x, p.y, 5);
			}
		});
		await wait(230);
		document.querySelectorAll('#board .cell.win').forEach((el) => el.classList.remove('win', 'converting'));
		stage.classList.remove('win-focus');
	}
	return targetWin;
}
function rgsRewardAsset(reward) {
	if (!reward) return COIN_ASSETS.bronze;
	if (reward.kind === 'mult') return MULT_ASSETS[reward.value] || MULT_ASSETS[2];
	if (reward.kind === 'collector') return COLLECTOR_ASSET;
	if (reward.kind === 'coin') return COIN_ASSETS[reward.tier] || COIN_ASSETS.bronze;
	return COIN_ASSETS.bronze;
}
function rgsRewardToReveal(reward) {
	if (!reward) return null;
	const kind = reward.kind === 'coin' ? 'coin'
		: reward.kind === 'mult' ? 'mult'
		: reward.kind === 'collector' ? 'collector'
		: 'blank';
	return {
		kind,
		tier: reward.tier || (kind === 'coin' ? 'bronze' : undefined),
		value: Number(reward.value) || 0,
		asset: rgsRewardAsset(reward),
	};
}
async function renderRgsTumble(event) {
	const removedByCol = Array.from({ length: COLS }, () => new Set());
	for (const [c, r] of rgsCellsFromPositions(event.explodingSymbols || [])) removedByCol[c].add(r);
	const drops = new Map();
	if (Array.isArray(event.board) && event.board.length === COLS) {
		setGridFromRgsBoard(event.board);
		for (let col = 0; col < COLS; col += 1) {
			const rows = Math.max(1, removedByCol[col].size);
			for (let row = 0; row < ROWS; row += 1) drops.set(ck(col, row), { rows, delay: col * COL_DELAY * TF(), dur: DROP_DUR(rows) * TF() });
		}
		paint({ drops });
		scheduleDropStops(drops);
		await rawWait(dropEnd(drops) + 80 * TF());
		return;
	}
	for (let col = 0; col < COLS; col += 1) {
		if (!removedByCol[col].size) continue;
		const additions = (Array.isArray(event.newSymbols && event.newSymbols[col]) ? event.newSymbols[col] : []).map(rgsSymbolKey);
		const survivors = state.grid[col].filter((_, row) => !removedByCol[col].has(row));
		let next = [...additions, ...survivors].slice(0, ROWS);
		while (next.length < ROWS) next.unshift(RGS_FILLER_REEL[(col + next.length) % RGS_FILLER_REEL.length]);
		state.grid[col] = next;
		for (let row = 0; row < ROWS; row += 1) drops.set(ck(col, row), { rows: ROWS, delay: col * COL_DELAY * TF(), dur: DROP_DUR(ROWS) * TF() });
	}
	paint({ drops });
	scheduleDropStops(drops);
	await rawWait(dropEnd(drops) + 80 * TF());
}
async function renderRgsGoldenReveal(event) {
	const rewards = Array.isArray(event.rewards) ? event.rewards : [];
	state.reveals.clear();
	const cells = [];
	const pendingReveals = [];
	for (const reward of rewards) {
		const cell = rgsPosToCell(reward);
		if (!cell) continue;
		const [c, r] = cell;
		const key = ck(c, r);
		state.golden.add(key);
		const reveal = rgsRewardToReveal(reward);
		if (reveal) pendingReveals.push({ col: c, row: r, key, reveal });
		cells.push([c, r]);
	}
	if (cells.length) {
		paint();
		await rainbowSweep((sweepCol) => {
			let changed = false;
			for (const item of pendingReveals) {
				if (item.col !== sweepCol || state.reveals.has(item.key)) continue;
				state.reveals.set(item.key, item.reveal);
				changed = true;
			}
			if (changed) {
				paint();
				document.querySelectorAll('#board .cell.golden').forEach((el) => el.classList.add('activating'));
			}
		});
	}
	for (const item of pendingReveals) state.reveals.set(item.key, item.reveal);
	paint();
	await wait(state.turbo ? 300 : 520);
}
async function renderRgsGoldenAward(event, runningWin) {
	const amount = bookAmountToMoney(event.amount);
	const target = event.totalWin !== undefined ? bookAmountToMoney(event.totalWin) : roundMoney(runningWin + amount);
	const collectorCells = rgsCellsFromPositions(event.collectorPositions || []);
	if (collectorCells.length) {
		for (const [c, r] of collectorCells) {
			const el = cellEl(c, r);
			if (el) el.classList.add('collect-pulse', 'collect-burst');
		}
		Sound.collect();
		await wait(state.turbo ? 160 : 280);
		for (const [c, r] of collectorCells) {
			const el = cellEl(c, r);
			if (el) el.classList.remove('collect-pulse', 'collect-burst');
		}
	}
	if (amount > 0) {
		const cells = [...state.reveals.keys()].map((key) => key.split(',').map(Number)).filter((cell) => cell.length === 2);
		showClusterFloat(amount, cells);
		setWin(target, false);
		await countUp(target, runningWin);
	} else {
		setWin(target);
	}
	return target;
}
async function playRgsBookRound(rgsPlay, spinId, options = {}) {
	const round = rgsPlay && rgsPlay.round;
	const events = normalizeRgsEvents(round && round.state);
	const featureInfo = rgsFeatureSummary(events);
	const walletExpected = rgsRoundPayoutMoney(round);
	const expected = rgsDisplayWinMoney(round, events);
	const hasAuthoritativePayout = expected !== null;
	const startIndex = Math.max(0, Number(options.startIndex) || 0);
	const skipBonusIntro = !!options.skipBonusIntro;
	const isReplay = !!options.replay;
	const trackProgress = !!options.trackProgress && Rgs.configured() && rgsRoundIsBonus(round);
	let runningWin = 0;
	let visibleRgsWinShown = false;
	let rgsFinalFromState = finalBookWinMoney(events);
	state.reveals.clear();
	state.golden.clear();
	primeRgsResumeState(events, startIndex);
	for (let eventPos = 0; eventPos < events.length; eventPos += 1) {
		const event = events[eventPos];
		const eventIndex = rgsEventIndex(event, eventPos);
		if (!event || !event.type) continue;
		if (eventIndex < startIndex) continue;
		if (event.type === 'reveal') {
			[...board.querySelectorAll('img')].forEach((img) => img.classList.add('clearing'));
			await wait(160);
			setGridFromRgsBoard(event.board);
			const revealHasTrigger = rgsRevealHasConfirmedScatterTrigger(events, eventPos);
			if (!revealHasTrigger) removeUnconfirmedRgsScatterTrigger();
			state.mode = event.gameType === 'freegame' ? 'free' : state.mode;
			const drops = fullDropMap();
			const anticipate = !revealHasTrigger && scatterCount() === 2 && earlyScatterCount() >= 2;
			if (anticipate) {
				applyAnticipationDropTiming(drops);
				stage.classList.add('antic'); Sound.anticipation(2); stadiumFlash();
			}
			paint({ drops });
			scheduleScatterSounds(drops);
			scheduleDropStops(drops);
			await rawWait(dropEnd(drops) + 80 * TF());
			if (anticipate) stage.classList.remove('antic');
		} else if (event.type === 'winInfo') {
			if (hasAuthoritativePayout && expected <= 0) continue;
			const cells = rgsCellsFromPositions((Array.isArray(event.wins) ? event.wins : []).flatMap((win) => win.positions || []));
			if (!cells.length) continue;
			runningWin = await renderRgsWinInfo(event, runningWin);
			visibleRgsWinShown = true;
		} else if (event.type === 'updateTumbleWin' || event.type === 'setWin' || event.type === 'setTotalWin') {
			if (hasAuthoritativePayout) continue;
			const target = bookAmountToMoney(event.amount);
			if (target >= runningWin) {
				setWin(target, false);
				await countUp(target, runningWin);
				runningWin = target;
			}
		} else if (event.type === 'tumbleBoard') {
			if (hasAuthoritativePayout && expected <= 0) continue;
			await renderRgsTumble(event);
		} else if (event.type === 'goldenReveal') {
			await renderRgsGoldenReveal(event);
		} else if (event.type === 'goldenAward') {
			runningWin = await renderRgsGoldenAward(event, runningWin);
		} else if (event.type === 'goldenClear') {
			state.reveals.clear();
			if (event.clearGolden) state.golden.clear();
			paint();
			await wait(state.turbo ? 80 : 140);
		} else if (event.type === 'freeSpinTrigger') {
			if (!featureInfo.hasCompleteRgsFeature) continue;
			const cells = rgsCellsFromPositions(event.positions || []);
			cells.forEach(([c, r]) => { const el = cellEl(c, r); if (el) el.classList.add('scatter-antic', 'scatter-hit'); });
			Sound.scatter(Math.max(1, cells.length));
			await wait(state.turbo ? 240 : 520);
			cells.forEach(([c, r]) => { const el = cellEl(c, r); if (el) el.classList.remove('scatter-antic', 'scatter-hit'); });
			state.mode = 'free';
			state.tier = 1;
			if (Number(event.tier)) state.tier = Number(event.tier);
			state.fsTotal = Number(event.totalFs) || 0;
			state.fsLeft = state.fsTotal;
			updateFsCounter();
			if (!skipBonusIntro) await bonusIntroRgs(state.fsTotal, event.title || event.name || 'Golden Chance');
		} else if (event.type === 'updateFreeSpin') {
			state.mode = 'free';
			state.tier = Number(event.tier) || state.tier || 1;
			state.fsTotal = Number(event.total) || state.fsTotal || 0;
			// The math emits updateFreeSpin BEFORE each spin with a 0-based
			// amount (0..total-1). The counter shows the spin currently being
			// played, so map it 1-based — otherwise the last spin shows 11/12.
			state.fsLeft = Math.max(0, state.fsTotal - Math.min(state.fsTotal, (Number(event.amount) || 0) + 1));
			updateFsCounter();
		} else if (event.type === 'freeSpinEnd') {
			const total = bookAmountToMoney(event.amount);
			state.fsWin = total;
			const stats = featureInfo.featureStats;
			if (!stats || !stats.ok) throw new Error('RGS feature summary is not reconcilable: ' + (stats && stats.error || 'missing statistics'));
			// The summary is presentation-only. Start it without awaiting the
			// Continue/timeout path so an active round can settle immediately.
			if (!isReplay) {
				void bonusSummary(
					total,
					stats.spinsPlayed,
					bookAmountToMoney(stats.bestSpinUnits),
					{ blocking: false },
				);
			}
			state.mode = 'base'; state.tier = 0; state.fsLeft = 0; state.fsTotal = 0; updateFsCounter();
		} else if (event.type === 'finalWin') {
			rgsFinalFromState = bookAmountToMoney(event.amount);
		}
		if (trackProgress && (event.type === 'updateFreeSpin' || event.type === 'freeSpinEnd' || event.type === 'finalWin')) {
			await Rgs.saveEvent(String(eventIndex + 1), { spinId });
		}
	}
	const displayedWin = hasAuthoritativePayout ? expected : rgsFinalFromState;
	if (Math.abs(displayedWin - runningWin) > 0.01) {
		setWin(displayedWin, false);
		await countUp(displayedWin, runningWin);
	} else {
		setWin(displayedWin);
	}
	if (UrlState.debug()) {
		debugJson('[GGR rgs-visual-json]', {
			spinId,
			source: Rgs.configured() ? 'RGS' : 'LOCAL',
			rgsBetId: rgsRoundId(round),
			rgsActive: round && round.active,
			rgsPayout: round && round.payout,
			rgsWalletExpected: walletExpected,
			rgsStateFinalWin: finalBookWinMoney(events),
			displayedWin,
			hasFreeSpinTrigger: featureInfo.hasFreeSpinTrigger,
			hasUpdateFreeSpin: featureInfo.hasUpdateFreeSpin,
			hasFreeSpinEnd: featureInfo.hasFreeSpinEnd,
			finalWin: featureInfo.finalWin,
			willStartVisualFeature: featureInfo.willStartVisualFeature,
			willCallEndRound: round && round.active === true,
			visibleRgsWinShown,
		});
		console.table([{
			spinId,
			source: Rgs.configured() ? 'RGS' : 'LOCAL',
			rgsBetId: rgsRoundId(round),
			rgsActive: round && round.active,
			rgsPayout: round && round.payout,
			rgsWalletExpected: walletExpected,
			rgsStateFinalWin: finalBookWinMoney(events),
			displayedWin,
			hasFreeSpinTrigger: featureInfo.hasFreeSpinTrigger,
			hasUpdateFreeSpin: featureInfo.hasUpdateFreeSpin,
			hasFreeSpinEnd: featureInfo.hasFreeSpinEnd,
			finalWin: featureInfo.finalWin,
			willStartVisualFeature: featureInfo.willStartVisualFeature,
			willCallEndRound: round && round.active === true,
			visibleRgsWinShown,
		}]);
	}
	if (hasAuthoritativePayout && Math.abs(displayedWin - expected) > 0.01) console.error('[RGS assert] displayedWin must equal the RGS display win', { spinId, expected, walletExpected, stateFinal: finalBookWinMoney(events), displayedWin, round });
	if (!(round && round.active === true && finalBookWinMoney(events) > 0 && walletExpected === 0) && walletExpected !== null && Math.abs(displayedWin - walletExpected) > 0.01) console.error('[RGS assert] displayedWin must equal settled wallet payout when wallet payout is authoritative', { spinId, walletExpected, displayedWin, round });
	if ((round && Number(round.payout) > 0) && displayedWin <= 0) console.error('[RGS assert] RGS payout > 0 but visible game shows no win', { spinId, displayedWin, round });
	if (displayedWin > 0 && !events.length) console.error('[RGS assert] visible win has no RGS round.state events', { spinId, displayedWin, round });
	if (state.mode === 'free') { state.mode = 'base'; state.tier = 0; state.fsLeft = 0; state.fsTotal = 0; updateFsCounter(); }
	state.reveals.clear();
	state.golden.clear();
	paint();
	return displayedWin;
}

const REPLAY_TIMEOUT_MS = 10000;
const REPLAY_EVENT_TYPES = new Set([...${JSON.stringify(PRODUCTION_GAME_CONFIG.frontendContract?.eventTypes || [])}, 'updateTumbleWin']);

function cloneReplayData(value) {
	return JSON.parse(JSON.stringify(value));
}
function deepFreezeReplayData(value) {
	if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
	Object.freeze(value);
	Object.values(value).forEach(deepFreezeReplayData);
	return value;
}
function replaySymbolIsKnown(raw) {
	const name = typeof raw === 'string' ? raw : raw && (raw.name || raw.symbol || raw.id || raw.key);
	const key = RGS_SYMBOL_ALIASES[name] || RGS_SYMBOL_ALIASES[String(name || '').toUpperCase()] || name;
	return !!SYMBOLS[key];
}
function validateReplayBoard(rawBoard, context) {
	if (!Array.isArray(rawBoard) || rawBoard.length !== COLS) throw new Error(context + ' must contain exactly ' + COLS + ' reels');
	rawBoard.forEach((reel, reelIndex) => {
		if (!Array.isArray(reel) || reel.length < ROWS) throw new Error(context + ' reel ' + reelIndex + ' is missing visible rows');
		reel.forEach((symbol, rowIndex) => {
			if (!replaySymbolIsKnown(symbol)) throw new Error(context + ' contains unsupported symbol at reel ' + reelIndex + ', row ' + rowIndex);
		});
	});
}
function validateReplayPosition(position, context) {
	const col = Number(position && (position.col ?? position.column ?? position.reel));
	const row = Number(position && position.row);
	if (!Number.isInteger(col) || !Number.isInteger(row) || col < 0 || col >= COLS || row < 0 || row > ROWS + 8) {
		throw new Error(context + ' contains an invalid board position');
	}
}
function validateReplayEvents(events) {
	if (!Array.isArray(events) || !events.length) throw new Error('Replay response contains no round-state events');
	let revealCount = 0;
	let previousIndex = -1;
	let runningBookUnits = 0;
	const maxBookUnits = Math.round(Number(CONFIG.maxWinMultiplier) * BOOK_MULTIPLIER_SCALE);
	const assertBookUnits = (value, label) => {
		const units = requireReplaySafeInteger(value, label);
		if (units > maxBookUnits) throw new Error(label + ' exceeds the configured max win');
		return units;
	};
	events.forEach((event, position) => {
		if (!event || typeof event !== 'object' || Array.isArray(event) || typeof event.type !== 'string') {
			throw new Error('Replay event ' + position + ' is malformed');
		}
		if (!REPLAY_EVENT_TYPES.has(event.type)) throw new Error('Unsupported replay event type: ' + event.type);
		const eventIndex = rgsEventIndex(event, position);
		if (eventIndex < previousIndex) throw new Error('Replay event indexes are not ordered');
		previousIndex = eventIndex;
		if (event.type === 'reveal') {
			revealCount += 1;
			validateReplayBoard(event.board, 'Replay reveal event ' + eventIndex + ' board');
		}
		if (event.type === 'tumbleBoard') {
			validateReplayBoard(event.board, 'Replay tumble event ' + eventIndex + ' board');
			if (!Array.isArray(event.explodingSymbols) || !Array.isArray(event.newSymbols)) throw new Error('Replay tumble event ' + eventIndex + ' is incomplete');
			event.explodingSymbols.forEach((item) => validateReplayPosition(item, 'Replay tumble event ' + eventIndex));
		}
		if (event.type === 'winInfo') {
			if (!Array.isArray(event.wins) || !event.wins.length) throw new Error('Replay win event ' + eventIndex + ' has no wins');
			let sumOfWins = 0;
			event.wins.forEach((win, winIndex) => {
				const winAmount = assertBookUnits(win && win.win, 'Replay win ' + winIndex + ' in event ' + eventIndex);
				sumOfWins += winAmount;
				if (!Array.isArray(win.positions) || !win.positions.length) throw new Error('Replay win event ' + eventIndex + ' has no winning positions');
				const uniquePositions = new Set();
				win.positions.forEach((item) => {
					validateReplayPosition(item, 'Replay win ' + winIndex + ' in event ' + eventIndex);
					const col = Number(item && (item.col ?? item.column ?? item.reel));
					const row = Number(item && item.row);
					const key = col + ',' + row;
					if (uniquePositions.has(key)) throw new Error('Replay win ' + winIndex + ' in event ' + eventIndex + ' repeats a winning position');
					uniquePositions.add(key);
				});
			});
			const stepTotal = assertBookUnits(event.totalWin, 'Replay win event ' + eventIndex + ' totalWin');
			if (stepTotal !== sumOfWins) {
				throw new Error('Replay win event ' + eventIndex + ' totalWin differs from wins[].win');
			}
			runningBookUnits += stepTotal;
			if (runningBookUnits > maxBookUnits) throw new Error('Replay cumulative win exceeds the configured max win');
			if (event.runningTotalWin !== undefined
				&& assertBookUnits(event.runningTotalWin, 'Replay win event ' + eventIndex + ' runningTotalWin') !== runningBookUnits) {
				throw new Error('Replay win event ' + eventIndex + ' runningTotalWin is inconsistent');
			}
		}
		if (event.type === 'goldenReveal') {
			if (!Array.isArray(event.rewards)) throw new Error('Replay Golden Cell reveal event ' + eventIndex + ' is incomplete');
			event.rewards.forEach((item) => validateReplayPosition(item, 'Replay Golden Cell reveal event ' + eventIndex));
		}
		if (event.type === 'goldenAward') {
			const award = assertBookUnits(event.amount, 'Replay Golden Cell award event ' + eventIndex + ' amount');
			runningBookUnits += award;
			if (runningBookUnits > maxBookUnits) throw new Error('Replay cumulative win exceeds the configured max win');
			if (event.totalWin === undefined
				|| assertBookUnits(event.totalWin, 'Replay Golden Cell award event ' + eventIndex + ' totalWin') !== runningBookUnits) {
				throw new Error('Replay Golden Cell award event ' + eventIndex + ' totalWin is inconsistent');
			}
		}
		if (['setWin', 'setTotalWin', 'updateTumbleWin'].includes(event.type)) {
			if (assertBookUnits(event.amount, 'Replay event ' + eventIndex + ' amount') !== runningBookUnits) {
				throw new Error('Replay event ' + eventIndex + ' cumulative amount is inconsistent');
			}
		}
		if (event.type === 'freeSpinEnd'
			&& assertBookUnits(event.amount, 'Replay free-spin end event ' + eventIndex + ' amount') !== runningBookUnits) {
			throw new Error('Replay free-spin end event ' + eventIndex + ' amount is inconsistent');
		}
		if (event.type === 'finalWin'
			&& assertBookUnits(event.amount, 'Replay finalWin event ' + eventIndex + ' amount') !== runningBookUnits) {
			throw new Error('Replay finalWin differs from the cumulative event total');
		}
	});
	if (!revealCount) throw new Error('Replay response has no board reveal data');
	const final = [...events].reverse().find((event) => event.type === 'finalWin');
	if (!final) throw new Error('Replay response is missing the authoritative finalWin event');
	return { final, runningBookUnits };
}
function replayModeIdentity(mode) {
	const key = String(mode || '').trim().toLowerCase();
	if (key === 'tier1' || key === 'golden_chance') return 'bonus_tier1';
	if (key === 'tier2' || key === 'bonus_tier2' || key === 'all_that_glitters') return 'bonus';
	if (key === 'feature' || key === 'feature_spins') return 'hunt';
	if (key === 'rainbow_spin') return 'rainbow';
	return key;
}
function normalizeReplayPayload(data) {
	if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Replay response must be a JSON object');
	const payload = data.replay && typeof data.replay === 'object' ? data.replay : data;
	const source = (payload.round || payload.bet || payload.eventRound || payload);
	if (!source || typeof source !== 'object' || Array.isArray(source)) throw new Error('Replay response does not contain a round object');
	const launchMode = UrlState.launchMode();
	const replayMode = replayModeIdentity(launchMode);
	const responseMode = source.mode ?? payload.mode;
	if (responseMode && replayModeIdentity(responseMode) !== replayModeIdentity(launchMode)) {
		throw new Error('Replay response mode does not match the launch mode');
	}
	const responseGame = source.game ?? source.gameId ?? payload.game ?? payload.gameId;
	if (responseGame !== undefined && String(responseGame) !== String(UrlState.game())) throw new Error('Replay response game does not match the launch game');
	const responseVersion = source.version ?? source.gameVersion ?? payload.version ?? payload.gameVersion;
	if (responseVersion !== undefined && String(responseVersion) !== String(UrlState.version())) throw new Error('Replay response version does not match the launch version');
	const responseEvent = source.eventId ?? source.eventID ?? payload.eventId ?? payload.eventID;
	if (responseEvent !== undefined && String(responseEvent) !== String(UrlState.event())) throw new Error('Replay response event does not match the launch event');
	const stateValue = source.state ?? source.events ?? payload.state ?? payload.events;
	const events = normalizeRgsEvents(stateValue);
	const { final, runningBookUnits } = validateReplayEvents(events);
	const hasLaunchAmount = UrlState.hasLaunchParam('amount', 'bet', 'stake');
	const launchAmount = hasLaunchAmount
		? requireReplaySafeInteger(Number(UrlState.amount()), 'Replay launch amount', { positive: true })
		: null;
	const responseAmount = source.amount ?? source.betAmount ?? payload.amount ?? payload.betAmount;
	if ((responseAmount === undefined || responseAmount === null) && launchAmount === null) {
		throw new Error('Replay amount is missing from both the optional launch parameter and the saved round');
	}
	const amount = responseAmount === undefined || responseAmount === null
		? launchAmount
		: requireReplaySafeInteger(responseAmount, 'Replay response amount', { positive: true });
	if (launchAmount !== null && amount !== launchAmount) throw new Error('Replay response amount does not match the launch amount');
	const baseBet = replayApiAmountToMoney(amount);
	const rawPayoutMultiplier = source.payoutMultiplier ?? payload.payoutMultiplier;
	let payoutMultiplierBookUnits = final.amount;
	if (rawPayoutMultiplier !== undefined && rawPayoutMultiplier !== null) {
		const candidates = replayPayoutMultiplierCandidates(rawPayoutMultiplier);
		const matchingCandidate = candidates.find((candidate) => candidate === runningBookUnits && candidate === final.amount);
		if (matchingCandidate === undefined) {
			if (!candidates.length) throw new Error('Replay payoutMultiplier must be a non-negative integer or multiplier number');
			throw new Error('Replay payoutMultiplier differs from the authoritative finalWin event');
		}
		payoutMultiplierBookUnits = matchingCandidate;
	}
	if (payoutMultiplierBookUnits !== runningBookUnits || payoutMultiplierBookUnits !== final.amount) {
		throw new Error('Replay payoutMultiplier differs from the authoritative finalWin event');
	}
	const payoutMultiplier = replayBookUnitsToMultiplier(payoutMultiplierBookUnits);
	const rawCostMultiplier = source.costMultiplier ?? payload.costMultiplier ?? modeMeta(replayMode).costMultiplier ?? 1;
	if (typeof rawCostMultiplier !== 'number' || !Number.isFinite(rawCostMultiplier) || rawCostMultiplier <= 0) {
		throw new Error('Replay response contains an invalid costMultiplier');
	}
	const costMultiplier = rawCostMultiplier;
	const explicitPayout = source.payout ?? payload.payout;
	if (explicitPayout !== undefined && explicitPayout !== null) {
		const payoutApiAmount = requireReplaySafeInteger(explicitPayout, 'Replay payout');
		const expectedPayoutApiAmount = Math.round(amount * payoutMultiplierBookUnits / BOOK_MULTIPLIER_SCALE);
		if (payoutApiAmount !== expectedPayoutApiAmount) throw new Error('Replay payout differs from the authoritative finalWin event');
	}
	const hasLaunchCurrency = UrlState.hasLaunchParam('currency');
	const launchCurrency = hasLaunchCurrency ? normalizeCurrency(UrlState.currencyRaw()) : '';
	const responseCurrency = normalizeCurrency(source.currency || source.currencyCode || payload.currency || payload.currencyCode || '');
	if (launchCurrency && responseCurrency && responseCurrency !== launchCurrency) throw new Error('Replay response currency does not match the launch currency');
	const currency = responseCurrency || launchCurrency || DEFAULT_CURRENCY;
	if (!/^[A-Z]{2,8}$/.test(currency)) throw new Error('Replay response contains an invalid currency');
	return {
		round: {
			...cloneReplayData(source),
			active: false,
			mode: replayMode,
			amount,
			currency,
			costMultiplier,
			payoutMultiplier: payoutMultiplierBookUnits,
			payout: Math.round(amount * payoutMultiplierBookUnits / BOOK_MULTIPLIER_SCALE),
			state: { events: cloneReplayData(events) },
		},
		meta: { baseBet, payoutMultiplier },
	};
}
function replayMetadata(round) {
	const events = normalizeRgsEvents(round && round.state);
	const meta = modeMeta(rgsRoundMode(round));
	const baseBet = replayApiAmountToMoney(round && round.amount);
	const costMultiplier = Number(round && round.costMultiplier) || Number(meta.costMultiplier) || 1;
	const totalCost = replayApiAmountToMoney(Math.round(baseBet * costMultiplier * API_AMOUNT_MULTIPLIER));
	const totalWin = rgsDisplayWinMoney(round, events) || 0;
	const payoutMultiplier = replayBookUnitsToMultiplier(round && round.payoutMultiplier);
	return {
		mode: playerModeName(rgsRoundMode(round)),
		baseBet,
		costMultiplier,
		totalCost,
		payoutMultiplier,
		totalWin,
		 events,
	};
}
function resetReplayPresentation() {
	clearSkip();
	closeModals(true);
	state.mode = 'base';
	state.tier = 0;
	state.fsLeft = 0;
	state.fsTotal = 0;
	state.fsWin = 0;
	state.fsBest = 0;
	state.fsPlayed = 0;
	state.reveals.clear();
	state.golden.clear();
	state.grid = [];
	rgsBoardMeta = { rowStarts: [] };
	board.innerHTML = '';
	setWin(0);
	stage.classList.remove('spinning', 'bonus-mode', 'win-focus', 'antic', 'skip-mode', 'shake');
	document.querySelectorAll('#board .win,#board .converting,#board .scatter-antic,#board .scatter-hit,#board .activating').forEach((element) => {
		element.classList.remove('win', 'converting', 'scatter-antic', 'scatter-hit', 'activating');
	});
	const fx = $('fx-layer'); if (fx) fx.replaceChildren();
	const flash = $('fx-flash'); if (flash) flash.classList.remove('go');
	const banner = $('win-banner'); if (banner) banner.classList.remove('show');
	const intro = $('bonus-intro'); if (intro) { intro.classList.remove('show', 'out'); intro.setAttribute('aria-hidden', 'true'); }
	const summary = $('bonus-summary'); if (summary) { summary.classList.remove('show'); summary.setAttribute('aria-hidden', 'true'); }
	const toast = $('rt-toast'); if (toast) toast.classList.remove('show');
	Sound.resetRound();
	updateFsCounter();
	updateMeters();
}
const Replay = (() => {
	let current = null;
	let status = 'idle';
	const configured = () => UrlState.replay();
	const endpoint = (path, params = {}) => {
		const host = UrlState.rgsUrl();
		if (!host) return path;
		let base = host.indexOf('http://') === 0 || host.indexOf('https://') === 0 ? host : 'https://' + host;
		while (base.endsWith('/')) base = base.slice(0, -1);
		const query = new URLSearchParams(params);
		const suffix = query.toString() ? '?' + query.toString() : '';
		return base + path + suffix;
	};
	const replayPath = () => '/bet/replay/'
		+ encodeURIComponent(UrlState.game()) + '/'
		+ encodeURIComponent(UrlState.version()) + '/'
		+ encodeURIComponent(UrlState.launchMode() || 'base') + '/'
		+ encodeURIComponent(UrlState.event());
	const fetchReplayRound = async () => {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), REPLAY_TIMEOUT_MS);
		try {
			const response = await fetch(endpoint(replayPath(), { language: UrlState.lang(), lang: UrlState.lang() }), {
				method: 'GET',
				headers: { Accept: 'application/json' },
				signal: controller.signal,
			});
			const text = await response.text();
			let data;
			try { data = text ? JSON.parse(text) : null; } catch (error) { throw new Error('Replay endpoint returned invalid JSON'); }
			const statusCode = data && data.status && data.status.statusCode;
			if (!response.ok || data?.error || (statusCode && statusCode !== 'SUCCESS')) {
				const message = data?.error?.message || data?.status?.statusMessage || response.statusText || 'Replay request failed';
				throw new Error('Replay endpoint returned ' + response.status + ': ' + message);
			}
			return normalizeReplayPayload(data);
		} catch (error) {
			if (error && error.name === 'AbortError') throw new Error('Replay request timed out');
			throw error;
		} finally {
			clearTimeout(timeout);
		}
	};
	const start = async () => {
		if (!configured()) return false;
		status = 'loading';
		setReplayLifecycle(status);
		try {
			const replay = await fetchReplayRound();
			const immutableRound = deepFreezeReplayData(cloneReplayData(replay.round));
			current = { round: immutableRound, signature: JSON.stringify(immutableRound) };
			const replayCurrency = immutableRound.currency || immutableRound.currencyCode || UrlState.currency();
			if (replayCurrency) state.currency = normalizeCurrency(replayCurrency);
			applyBetFromRound(immutableRound);
			current.meta = Object.freeze(replayMetadata(immutableRound));
			state.win = current.meta.totalWin;
			updateMeters();
			applyLanguage();
			enterReplayUi();
			status = 'ready';
			setReplayLifecycle(status, current.meta);
			return true;
		} catch (error) {
			status = 'error';
			replayError('Replay unavailable', error && error.message ? error.message : 'The saved event could not be loaded.');
			console.warn('[Replay] load failed', error);
			return false;
		}
	};
	const play = async () => {
		if (!current || !current.round || state.replayPlaying || !['ready', 'completed'].includes(status)) return false;
		state.replayPlaying = true;
		state.fatal = false;
		resetReplayPresentation();
		state.bet = current.meta.baseBet;
		status = 'running';
		setReplayLifecycle(status, current.meta);
		state.spinning = true;
		stage.classList.add('spinning');
		try {
			const playbackRound = cloneReplayData(current.round);
			const displayedWin = await playRgsBookRound({ round: playbackRound }, ++spinSeq, { replay: true, skipBonusIntro: true, trackProgress: false });
			if (JSON.stringify(current.round) !== current.signature) throw new Error('Saved replay data changed during playback');
			if (Math.abs(displayedWin - current.meta.totalWin) > 0.01) throw new Error('Displayed replay total differs from the authoritative saved result');
			setWin(current.meta.totalWin);
			status = 'completed';
			setReplayLifecycle(status, current.meta);
			return true;
		} catch (error) {
			status = 'error';
			replayError('Replay playback failed', error && error.message ? error.message : 'The saved event could not be rendered.');
			return false;
		} finally {
			state.spinning = false;
			state.replayPlaying = false;
			stage.classList.remove('spinning');
			clearSkip();
			updateMeters();
			updateLocks();
		}
	};
	const action = $('replay-action');
	if (action) action.onclick = () => play();
	const overlayAction = $('replay-start');
	if (overlayAction) overlayAction.onclick = () => play();
	return { configured, start, play, fetchReplayRound, get current() { return current; }, get status() { return status; } };
})();

// ---- animation FX helpers ----
// Cell centre in the stage's own (unscaled) coordinate space, correcting for
// the viewport's fit-to-window scale so FX line up with the board exactly.
function stagePos(el) {
	const sr = stage.getBoundingClientRect();
	const cr = el.getBoundingClientRect();
	const sc = state.scale || 1;
	return { x: (cr.left + cr.width / 2 - sr.left) / sc, y: (cr.top + cr.height / 2 - sr.top) / sc };
}
function burstAt(x, y, count = 6) {
	const layer = $('fx-layer'); if (!layer) return;
	for (let i = 0; i < count; i += 1) {
		const s = document.createElement('div'); s.className = 'spark';
		const ang = Math.random() * Math.PI * 2, dist = 24 + Math.random() * 36;
		s.style.left = x + 'px'; s.style.top = y + 'px';
		s.style.setProperty('--dx', (Math.cos(ang) * dist) + 'px');
		s.style.setProperty('--dy', (Math.sin(ang) * dist) + 'px');
		s.style.setProperty('--dur', (0.45 + Math.random() * 0.35) + 's');
		layer.appendChild(s); setTimeout(() => s.remove(), 900);
	}
}
function clusterCenter(cells) {
	let x = 0, y = 0, n = 0;
	for (const [c, r] of cells) {
		const el = cellEl(c, r); if (!el) continue;
		const p = stagePos(el); x += p.x; y += p.y; n += 1;
	}
	return n ? { x: x / n, y: y / n } : null;
}
function showClusterFloat(amount, cells, detail = '') {
	if (!amount || !cells || !cells.length) return;
	const layer = $('fx-layer') || stage;
	const pos = clusterCenter(cells); if (!layer || !pos) return;
	const el = document.createElement('div');
	el.className = 'cluster-float';
	el.textContent = '+' + formatCurrency(amount) + (detail ? ' · ' + detail : '');
	el.style.left = pos.x + 'px';
	el.style.top = pos.y + 'px';
	layer.appendChild(el);
	setTimeout(() => el.remove(), state.turbo ? 520 : 1250);
}
function flashScreen() { const f = $('fx-flash'); if (!f) return; f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
// Floodlight burst — used for big wins and a 3+ scatter trigger.
function stadiumFlash() {
	['left', 'right'].forEach((side) => { const l = document.querySelector('.top-light.' + side); if (!l) return; l.classList.remove('burst'); void l.offsetWidth; l.classList.add('burst'); setTimeout(() => l.classList.remove('burst'), 900); });
}
function setBonusMode(on) { stage.classList.toggle('bonus-mode', !!on); }
function coinShower(n) {
	const layer = $('fx-layer'); if (!layer) return;
	const tiers = [COIN_ASSETS.gold, COIN_ASSETS.silver, COIN_ASSETS.bronze];
	for (let i = 0; i < n; i += 1) {
		const c = document.createElement('div'); c.className = 'coin-drop';
		c.style.left = (6 + Math.random() * 88) + '%';
		c.style.backgroundImage = 'url(' + tiers[(Math.random() * tiers.length) | 0] + ')';
		const dur = 1.3 + Math.random() * 0.9;
		c.style.setProperty('--dur', dur + 's');
		c.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
		c.style.animationDelay = (Math.random() * 0.5) + 's';
		layer.appendChild(c); setTimeout(() => c.remove(), (dur + 0.7) * 1000);
	}
}
// Fly clones of every visible coin into the collector cup cell.
async function flyCoinsTo(tc, tr) {
	if (state.turbo) return; // keep turbo snappy
	const layer = $('fx-layer'); const target = cellEl(tc, tr); if (!layer || !target) return;
	const coins = [...state.reveals.entries()].filter(([, v]) => v.kind === 'coin');
	if (!coins.length) return;
	const tp = stagePos(target);
	const flyers = [];
	for (const [k, rv] of coins) {
		const [c, r] = k.split(',').map(Number); const el = cellEl(c, r); if (!el) continue;
		const p = stagePos(el);
		const f = document.createElement('div'); f.className = 'fly-coin';
		f.style.backgroundImage = 'url(' + rv.asset + ')';
		f.style.left = p.x + 'px'; f.style.top = p.y + 'px';
		layer.appendChild(f); flyers.push(f);
		const orig = el.querySelector('.reveal'); if (orig) { orig.style.transition = 'opacity .3s'; orig.style.opacity = '0.15'; }
	}
	void layer.offsetWidth; // commit start positions before transitioning
	flyers.forEach((f, i) => setTimeout(() => {
		f.style.left = tp.x + 'px'; f.style.top = tp.y + 'px';
		f.style.transform = 'translate(-50%,-50%) scale(0.3)'; f.style.opacity = '0.15';
	}, i * 28));
	await wait(560 + coins.length * 28);
	flyers.forEach((f) => f.remove());
}
async function bonusIntro(tier) {
	const el = $('bonus-intro'); if (!el) return;
	$('bi-title').textContent = CONFIG.tiers[tier].name;
	$('bi-spins').textContent = CONFIG.tiers[tier].spins + ' FREE SPINS';
	el.setAttribute('aria-hidden', 'false');
	el.classList.remove('out'); el.classList.add('show');
	Sound.fanfare(); coinShower(18);
	await wait(state.turbo ? 320 : 520);
	await new Promise((resolve) => {
		let done = false;
		const close = () => {
			if (done) return;
			done = true;
			el.removeEventListener('click', close);
			window.removeEventListener('keydown', onKey);
			resolve();
		};
		const onKey = (e) => {
			if (e.code === 'Enter' || e.code === 'Space') close();
		};
		el.addEventListener('click', close);
		window.addEventListener('keydown', onKey);
	});
	el.classList.add('out'); await wait(420); el.classList.remove('show', 'out');
	el.setAttribute('aria-hidden', 'true');
}

// Light bar sweeps across the board while the Golden Cells energise.
async function rainbowSweep(onColumn = null) {
	const layer = $('fx-layer'); if (!layer) return;
	const sr = stage.getBoundingClientRect(); const br = board.getBoundingClientRect(); const sc = state.scale || 1;
	const x = (br.left - sr.left) / sc, y = (br.top - sr.top) / sc, w = br.width / sc, h = br.height / sc;
	const bar = document.createElement('div'); bar.className = 'fx-sweep';
	bar.style.left = x + 'px'; bar.style.top = y + 'px'; bar.style.height = h + 'px';
	bar.style.setProperty('--travel', w + 'px');
	bar.style.setProperty('--dur', (state.turbo ? 0.34 : 0.58) + 's');
	layer.appendChild(bar);
	Sound.sweep();
	document.querySelectorAll('#board .cell.golden').forEach((el) => el.classList.add('activating'));
	if (typeof onColumn === 'function') {
		const step = (state.turbo ? 340 : 560) / COLS;
		for (let col = 0; col < COLS; col += 1) {
			await wait(step);
			onColumn(col);
		}
	} else {
		await wait(state.turbo ? 340 : 560);
	}
	bar.remove();
	document.querySelectorAll('#board .cell.activating').forEach((el) => el.classList.remove('activating'));
}

// 2+ scatters: dim the board and pulse the scatters to build bonus tension.
async function scatterAnticipation() {
	const sc = scatterCount();
	if (sc < 2 || state.mode === 'free') return;
	const cells = [];
	for (let c = 0; c < COLS; c += 1) for (let r = 0; r < ROWS; r += 1)
		if (state.grid[c][r] === 'scatter') { const e = cellEl(c, r); if (e) cells.push(e); }
	if (!cells.length) return;
	stage.classList.add('antic');
	cells.forEach((e) => e.classList.add('scatter-antic'));
	Sound.anticipation(sc);
	await wait(state.turbo ? 360 : (sc >= 3 ? 900 : 680));
	if (sc >= 3) { cells.forEach((e) => e.classList.add('scatter-hit')); Sound.scatterHit(); await wait(state.turbo ? 160 : 340); }
	stage.classList.remove('antic');
	cells.forEach((e) => { e.classList.remove('scatter-antic', 'scatter-hit'); });
}

// ---- sound hooks ----
const Sound = (() => {
	const noop = () => {};
	let music = null;
	let restoreTimer = null;
	let freeSpinRoar = null;
	let reelEndPool = [];
	let reelEndIndex = 0;
	let pingPool = [];
	let pingIndex = 0;
	let rainbowReveal = null;
	let scatterPool = [];
	let scatterIndex = 0;
	let clusterBurstPool = [];
	let clusterBurstIndex = 0;
	const roundSoundTimers = new Set();
	const MUSIC_VOLUME = 0.16;
	const REEL_END_VOLUME = 0.34;
	const PING_VOLUME = 0.42;
	const RAINBOW_REVEAL_VOLUME = 0.46;
	const SCATTER_VOLUME = 0.42;
	const CLUSTER_BURST_VOLUME = 0.46;
	const FREE_SPIN_ROAR_START = 0.9;
	function enabled() { return state.sound !== false; }
	function clamp01(v) { return Math.max(0, Math.min(1, v)); }
	function musicVolume(mult = 1) { return clamp01(MUSIC_VOLUME * (state.musicVolume / 100) * mult); }
	function sfxVolume(base) { return clamp01(base * (state.sfxVolume / 100)); }
	function make(src, volume, loop = false) {
		const a = new Audio(src);
		a.preload = 'auto';
		a.loop = loop;
		a.volume = volume;
		return a;
	}
	function ensureMusic() {
		if (!music) music = make(AUDIO_ASSETS.music, musicVolume(), true);
		return music;
	}
	function prime() {
		if (!enabled()) return;
		const a = ensureMusic();
		ensureReelEndPool();
		ensurePingPool();
		ensureRainbowReveal();
		ensureScatterPool();
		ensureClusterBurstPool();
		ensureFreeSpinRoar();
		if (a.paused) a.play().catch(() => {});
	}
	function ensureReelEndPool() {
		if (!reelEndPool.length) {
			reelEndPool = Array.from({ length: Math.max(COLS, 6) }, () => make(AUDIO_ASSETS.reelEnd, sfxVolume(REEL_END_VOLUME), false));
			reelEndPool.forEach((a) => { try { a.load(); } catch (e) {} });
		}
		return reelEndPool;
	}
	function ensurePingPool() {
		if (!pingPool.length) {
			pingPool = Array.from({ length: 10 }, () => make(AUDIO_ASSETS.ping, sfxVolume(PING_VOLUME), false));
			pingPool.forEach((a) => { try { a.load(); } catch (e) {} });
		}
		return pingPool;
	}
	function ensureScatterPool() {
		if (!scatterPool.length) {
			scatterPool = Array.from({ length: 10 }, () => make(AUDIO_ASSETS.scatter, sfxVolume(SCATTER_VOLUME), false));
			scatterPool.forEach((a) => { try { a.load(); } catch (e) {} });
		}
		return scatterPool;
	}
	function ensureClusterBurstPool() {
		if (!clusterBurstPool.length) {
			clusterBurstPool = Array.from({ length: 10 }, () => make(AUDIO_ASSETS.clusterBurst, sfxVolume(CLUSTER_BURST_VOLUME), false));
			clusterBurstPool.forEach((a) => { try { a.load(); } catch (e) {} });
		}
		return clusterBurstPool;
	}
	function ensureRainbowReveal() {
		if (!rainbowReveal) {
			rainbowReveal = make(AUDIO_ASSETS.rainbowReveal, sfxVolume(RAINBOW_REVEAL_VOLUME), false);
			try { rainbowReveal.load(); } catch (e) {}
		}
		return rainbowReveal;
	}
	function ensureFreeSpinRoar() {
		if (!freeSpinRoar) {
			freeSpinRoar = make(AUDIO_ASSETS.roar, sfxVolume(0.2), false);
			try { freeSpinRoar.load(); } catch (e) {}
		}
		return freeSpinRoar;
	}
	function setVolumes() {
		if (music) music.volume = musicVolume();
		if (freeSpinRoar) freeSpinRoar.volume = sfxVolume(0.2);
		reelEndPool.forEach((a) => { a.volume = sfxVolume(REEL_END_VOLUME); });
		pingPool.forEach((a) => { a.volume = sfxVolume(PING_VOLUME); });
		scatterPool.forEach((a) => { a.volume = sfxVolume(SCATTER_VOLUME); });
		clusterBurstPool.forEach((a) => { a.volume = sfxVolume(CLUSTER_BURST_VOLUME); });
		if (rainbowReveal) rainbowReveal.volume = sfxVolume(RAINBOW_REVEAL_VOLUME);
	}
	function stopAll() {
		clearTimeout(restoreTimer);
		roundSoundTimers.forEach((timer) => clearTimeout(timer));
		roundSoundTimers.clear();
		if (music) { music.pause(); music.currentTime = 0; }
		if (freeSpinRoar) { try { freeSpinRoar.pause(); freeSpinRoar.currentTime = 0; } catch (e) {} }
		reelEndPool.forEach((a) => { try { a.pause(); a.currentTime = 0; } catch (e) {} });
		pingPool.forEach((a) => { try { a.pause(); a.currentTime = 0; } catch (e) {} });
		scatterPool.forEach((a) => { try { a.pause(); a.currentTime = 0; } catch (e) {} });
		clusterBurstPool.forEach((a) => { try { a.pause(); a.currentTime = 0; } catch (e) {} });
		if (rainbowReveal) { try { rainbowReveal.pause(); rainbowReveal.currentTime = 0; } catch (e) {} }
	}
	function scheduleRoundSound(callback, delay) {
		const timer = setTimeout(() => {
			roundSoundTimers.delete(timer);
			callback();
		}, delay);
		roundSoundTimers.add(timer);
	}
	function resetRound() {
		clearTimeout(restoreTimer);
		roundSoundTimers.forEach((timer) => clearTimeout(timer));
		roundSoundTimers.clear();
		if (freeSpinRoar) { try { freeSpinRoar.pause(); freeSpinRoar.currentTime = 0; } catch (e) {} }
		reelEndPool.forEach((audio) => { try { audio.pause(); audio.currentTime = 0; } catch (e) {} });
		pingPool.forEach((audio) => { try { audio.pause(); audio.currentTime = 0; } catch (e) {} });
		scatterPool.forEach((audio) => { try { audio.pause(); audio.currentTime = 0; } catch (e) {} });
		clusterBurstPool.forEach((audio) => { try { audio.pause(); audio.currentTime = 0; } catch (e) {} });
		if (rainbowReveal) { try { rainbowReveal.pause(); rainbowReveal.currentTime = 0; } catch (e) {} }
		if (music && enabled()) music.volume = musicVolume();
	}
	function duck(ms = 1300) {
		if (!music || music.paused) return;
		clearTimeout(restoreTimer);
		music.volume = musicVolume(0.56);
		restoreTimer = setTimeout(() => { if (music && enabled()) music.volume = musicVolume(); }, ms);
	}
	function freeSpins() {
		if (!enabled()) return;
		prime();
		duck(8500);
		freeSpinRoar = ensureFreeSpinRoar();
		try {
			freeSpinRoar.pause();
			freeSpinRoar.currentTime = FREE_SPIN_ROAR_START;
			freeSpinRoar.volume = sfxVolume(0.2);
			freeSpinRoar.loop = false;
			freeSpinRoar.playbackRate = 1;
			freeSpinRoar.play().catch(() => {});
		} catch (e) {}
	}
	function stopFreeSpins() {
		if (!freeSpinRoar) return;
		try {
			freeSpinRoar.pause();
			freeSpinRoar.currentTime = 0;
		} catch (e) {}
		clearTimeout(restoreTimer);
		if (music && enabled()) music.volume = musicVolume();
	}
	function reelStop() {
		if (!enabled()) return;
		prime();
		ensureReelEndPool();
		const a = reelEndPool[reelEndIndex % reelEndPool.length];
		reelEndIndex += 1;
		try {
			a.pause();
			a.currentTime = 0;
			a.volume = sfxVolume(REEL_END_VOLUME);
			a.playbackRate = 1;
			a.play().catch(() => {});
		} catch (e) {}
	}
	function pingOnce() {
		if (!enabled()) return;
		prime();
		ensurePingPool();
		const a = pingPool[pingIndex % pingPool.length];
		pingIndex += 1;
		try {
			a.pause();
			a.currentTime = 0;
			a.volume = sfxVolume(PING_VOLUME);
			a.playbackRate = 1;
			a.play().catch(() => {});
		} catch (e) {}
	}
	function pings(count = 1) {
		const n = Math.max(0, Math.min(30, count | 0));
		for (let i = 0; i < n; i += 1) scheduleRoundSound(pingOnce, i * 85 * TF());
	}
	function scatterOnce() {
		if (!enabled()) return;
		prime();
		ensureScatterPool();
		const a = scatterPool[scatterIndex % scatterPool.length];
		scatterIndex += 1;
		try {
			a.pause();
			a.currentTime = 0;
			a.volume = sfxVolume(SCATTER_VOLUME);
			a.playbackRate = 1;
			a.play().catch(() => {});
		} catch (e) {}
	}
	function scatterSounds(count = 1) {
		const n = Math.max(0, Math.min(30, count | 0));
		for (let i = 0; i < n; i += 1) scheduleRoundSound(scatterOnce, i * 95 * TF());
	}
	function clusterBurstOnce() {
		if (!enabled()) return;
		prime();
		ensureClusterBurstPool();
		const a = clusterBurstPool[clusterBurstIndex % clusterBurstPool.length];
		clusterBurstIndex += 1;
		try {
			a.pause();
			a.currentTime = 0;
			a.volume = sfxVolume(CLUSTER_BURST_VOLUME);
			a.playbackRate = 1;
			a.play().catch(() => {});
		} catch (e) {}
	}
	function clusterBurst(count = 1, leadMs = 0) {
		const n = Math.max(0, Math.min(30, count | 0));
		const baseDelay = Math.max(0, leadMs | 0);
		for (let i = 0; i < n; i += 1) scheduleRoundSound(clusterBurstOnce, baseDelay + i * 70 * TF());
	}
	function revealBling() {
		if (!enabled()) return;
		prime();
		const a = ensureRainbowReveal();
		try {
			a.pause();
			a.currentTime = 0;
			a.volume = sfxVolume(RAINBOW_REVEAL_VOLUME);
			a.playbackRate = 1;
			a.play().catch(() => {});
		} catch (e) {}
	}
	return {
		prime,
		setEnabled(v) { state.sound = !!v; if (state.sound) { setVolumes(); prime(); } else stopAll(); },
		setVolumes,
		spinStart: noop,
		reelStop,
		cluster: pings,
		clusterBurst,
		feature: noop,
		tick: noop,
		fanfare: noop,
		win: noop,
		collect: noop,
		sweep: revealBling,
		anticipation: noop,
		scatterHit: noop,
		scatter: scatterSounds,
		freeSpins,
		stopFreeSpins,
		resetRound,
	};
})();

function scheduleDropStops(drops) {
	if (!drops || !drops.size) return;
	const byCol = {};
	for (const [k, d] of drops) {
		const c = +k.split(',')[0];
		const start = d.delay || 0;
		const end = start + (d.dur || 0);
		if (!byCol[c]) byCol[c] = { start, end };
		byCol[c].start = Math.min(byCol[c].start, start);
		byCol[c].end = Math.max(byCol[c].end, end);
	}
	Object.entries(byCol).forEach(([c, timing]) => {
		const earliest = Math.max(30, timing.start + 30 * TF());
		const target = Math.max(earliest, timing.end - REEL_END_LEAD_MS * TF());
		setTimeout(() => Sound.reelStop(+c), target);
	});
}

function scheduleScatterSounds(drops) {
	if (!drops || !drops.size || scatterCount() < 2) return;
	for (const [key, d] of drops) {
		const [c, r] = key.split(',').map(Number);
		if (state.grid[c][r] !== 'scatter') continue;
		const start = d.delay || 0;
		const end = start + (d.dur || 0);
		const earliest = Math.max(30, start + 30 * TF());
		const target = Math.max(earliest, end - SCATTER_SOUND_LEAD_MS * TF());
		setTimeout(() => Sound.scatter(1), target);
	}
}

function updateMeters() {
	const balanceCurrency = $('meter-balance-currency');
	const betCurrency = $('meter-bet-currency');
	if (balanceCurrency) balanceCurrency.textContent = currencySymbol();
	if (betCurrency) betCurrency.textContent = currencySymbol();
	$('meter-balance').textContent = formatCurrency(state.balance);
	$('meter-bet').textContent = formatCurrency(state.bet);
	// WIN must use the same currency formatting as balance/bet (e.g. "0 CLP",
	// "0.00 SC"). setWin/countUp own the value mid-round; here we only sync the
	// idle/current value so the meter is never left as an unformatted number.
	$('meter-win').textContent = formatCurrency(state.mode === 'free' ? state.fsWin || 0 : state.win);
	$('bet-display').textContent = formatCurrency(state.bet);
	$('bet-controls').classList.toggle('low', state.betIdx === 0);
}

function findClusters() {
	const clusters = [];
	const payingSymbols = Object.keys(SYMBOLS).filter((key) => SYMBOLS[key].pay > 0 && !SYMBOLS[key].wild && !SYMBOLS[key].scatter);
	for (const key of payingSymbols) {
		const seen = Array.from({ length: COLS }, () => Array(ROWS).fill(false));
		for (let c = 0; c < COLS; c += 1) for (let r = 0; r < ROWS; r += 1) {
			if (seen[c][r] || state.grid[c][r] !== key) continue;
			const stack = [[c, r]];
			const cells = [];
			seen[c][r] = true;
			while (stack.length) {
				const [cc, rr] = stack.pop(); cells.push([cc, rr]);
				for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
					const nc = cc + dc, nr = rr + dr;
					if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS || seen[nc][nr]) continue;
					if (state.grid[nc][nr] === key || SYMBOLS[state.grid[nc][nr]]?.wild) {
						seen[nc][nr] = true;
						stack.push([nc, nr]);
					}
				}
			}
			if (cells.length >= MIN_CLUSTER) clusters.push({ key, cells });
		}
	}
	return clusters;
}

function symbolsConnect(target, key) {
	return key === target || SYMBOLS[key].wild || (SYMBOLS[target] && SYMBOLS[target].wild && SYMBOLS[key].pay > 0);
}

function replacementSymbolForCell(col, row) {
	const candidates = Object.keys(SYMBOLS).filter((key) => SYMBOLS[key].pay > 0 && !SYMBOLS[key].wild && !SYMBOLS[key].scatter && key !== 'rainbow');
	const current = state.grid[col][row];
	for (const key of candidates) {
		if (key === current) continue;
		let touches = false;
		for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
			const nc = col + dc, nr = row + dr;
			if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
			if (symbolsConnect(key, state.grid[nc][nr]) || symbolsConnect(state.grid[nc][nr], key)) {
				touches = true;
				break;
			}
		}
		if (!touches) return key;
	}
	return candidates.find((key) => key !== current) || current;
}

function removeVisibleClustersForRgsFinal() {
	for (let pass = 0; pass < 90; pass += 1) {
		const clusters = findClusters();
		if (!clusters.length) return true;
		for (const cluster of clusters) {
			const [col, row] = cluster.cells[Math.floor(cluster.cells.length / 2)];
			state.grid[col][row] = replacementSymbolForCell(col, row);
		}
	}
	return findClusters().length === 0;
}

function removeUnconfirmedRgsScatterTrigger() {
	let scatters = [];
	for (let c = 0; c < COLS; c += 1) for (let r = 0; r < ROWS; r += 1) {
		if (state.grid[c][r] === 'scatter') scatters.push([c, r]);
	}
	if (scatters.length < 3) return;
	let hash = 2166136261;
	for (let c = 0; c < COLS; c += 1) for (let r = 0; r < ROWS; r += 1) {
		const key = state.grid[c][r] || '';
		for (let i = 0; i < key.length; i += 1) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
		hash = Math.imul(hash ^ (c * 31 + r), 16777619);
	}
	const roll = (hash >>> 0) / 4294967295;
	const target = roll < 0.45 ? 0 : roll < 0.82 ? 1 : 2;
	while (scatters.length > target) {
		const [col, row] = scatters.pop();
		state.grid[col][row] = replacementSymbolForCell(col, row);
		scatters = scatters.filter(([c, r]) => state.grid[c][r] === 'scatter');
	}
}

function earlyScatterCount() {
	let count = 0;
	for (let c = 0; c < COLS - 2; c += 1) for (let r = 0; r < ROWS; r += 1) if (state.grid[c][r] === 'scatter') count += 1;
	return count;
}

function payFor(key, count) {
	const base = SYMBOLS[key].pay;
	const sizeBoost = count >= 12 ? 8 : count >= 9 ? 4 : count >= 7 ? 2 : 1;
	return base * sizeBoost;
}

function meterWinValue() {
	const text = $('meter-win').textContent || '0';
	const n = Number(text.replace(/[^0-9.-]/g, ''));
	return Number.isFinite(n) ? n : 0;
}
async function countUp(amount, from = meterWinValue()) {
	const el = $('meter-win');
	const steps = countUpSteps(); let i = 0;
	const target = Math.min(amount, capWin());
	if (state.skipRequested || Math.abs(target - from) < 0.000001) { el.textContent = formatCurrency(target); return; }
	return new Promise((resolve) => {
		const t = setInterval(() => {
			if (state.skipRequested) {
				clearInterval(t);
				el.textContent = formatCurrency(target);
				resolve();
				return;
			}
			i += 1; el.textContent = formatCurrency(from + ((target - from) * i) / steps); Sound.tick(i, steps);
			if (i >= steps) { clearInterval(t); el.textContent = formatCurrency(target); resolve(); }
		}, COUNT_UP_INTERVAL_MS);
	});
}

// Win levels (multiple of bet): below 10x stays a quiet count-up, no overlay.
function winLevel(x) {
	if (x >= 100) return { label: 'GOLDEN GOAL!', tier: 'takeover', coins: 60, hold: 1500 };
	if (x >= 50) return { label: 'SUPER MEGA WIN', tier: 'epic', coins: 44, hold: 1100 };
	if (x >= 25) return { label: 'MEGA WIN', tier: 'mega', coins: 30, hold: 850 };
	if (x >= 10) return { label: 'BIG WIN', tier: 'big', coins: 18, hold: 700 };
	return null;
}
async function showBanner(amount) {
	const x = amount / state.bet;
	const lv = winLevel(x);
	if (!lv) return;
	if (state.skipRequested) return;
	Sound.win(lv.tier); flashScreen();
	if (lv.tier === 'takeover' || lv.tier === 'epic') stadiumFlash();
	coinShower(lv.coins);
	$('win-banner-label').textContent = lv.label;
	const b = $('win-banner'); b.classList.add('show', lv.tier);
	if (x >= 25) { const n = x >= 100 ? 3 : x >= 50 ? 2 : 1; for (let s = 0; s < n; s += 1) { stage.classList.add('shake'); await wait(120); stage.classList.remove('shake'); await wait(60); } }
	const amt = $('win-banner-amount'); const steps = x >= 50 ? 34 : 24;
	for (let i = 1; i <= steps; i += 1) { amt.textContent = formatCurrency((amount * i) / steps); await wait(x >= 100 ? 38 : 28); }
	await wait(lv.hold); b.classList.remove('show', lv.tier);
}

const capWin = () => CONFIG.maxWinMultiplier * state.bet;
const setWin = (abs, render = true) => {
	state.win = Math.min(abs, capWin());
	if (render) $('meter-win').textContent = formatCurrency(state.win);
};
function roundMoney(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function debugWinStep(spinDebug, cascade, wins, stepWin, targetWin) {
	if (!spinDebug) return;
	const sumWins = roundMoney(wins.reduce((s, w) => s + w.amount, 0));
	const entry = { spinId: spinDebug.spinId, cascade, stepWin: roundMoney(stepWin), totalWin: roundMoney(targetWin), sumWinsAmount: sumWins, wins };
	spinDebug.cascades.push(entry);
	spinDebug.wins.push(...wins.map((w) => ({ ...w, cascade })));
	console.debug('[GGR win-step]', entry);
	if (Math.abs(sumWins - roundMoney(stepWin)) > 0.01) console.error('[GGR assert] sum(wins.amount) !== stepWin', entry);
	if (stepWin > 0 && !wins.some((w) => w.positions && w.positions.length)) console.error('[GGR assert] paid win without visible positions', entry);
}
function finishSpinDebug(spinDebug, result) {
	if (!spinDebug) return;
	const sumWins = roundMoney(spinDebug.wins.reduce((s, w) => s + w.amount, 0));
	const displayedWin = roundMoney(result.displayedWin);
	const totalWin = roundMoney(result.baseWin + result.featureWin);
	const expectedBalance = roundMoney(result.balanceBefore - result.cost + (result.payoutApplied ? displayedWin : 0));
	const rgsRound = result.rgsPlay && result.rgsPlay.round;
	const rgsEvents = normalizeRgsEvents(rgsRound && rgsRound.state);
	const rgsFeature = rgsFeatureSummary(rgsEvents);
	const walletPayout = result.walletBalanceAfterEndRound
		? roundMoney(result.walletBalanceAfterEndRound.amount - result.balanceAfterBet)
		: null;
	const entry = {
		spinId: spinDebug.spinId,
		source: result.source || (USE_RGS_STATE_RENDERER ? 'RGS_STATE' : 'LOCAL_VISUAL'),
		bet: spinDebug.bet,
		mode: spinDebug.mode,
		buy: spinDebug.buy,
		balanceBefore: roundMoney(result.balanceBefore),
		balanceAfterBet: roundMoney(result.balanceAfterBet),
		clusterWin: roundMoney(result.baseWin),
		scatterWin: 0,
		coinWin: roundMoney(result.featureWin),
		featureWin: 0,
		bonusWin: 0,
		totalWin,
		displayedWin,
		balanceAfterPayout: roundMoney(result.balanceAfter),
		expectedBalanceAfterPayout: expectedBalance,
		walletBalanceAfterPlay: result.walletBalanceAfterPlay ? roundMoney(result.walletBalanceAfterPlay.amount) : null,
		walletBalanceAfterEndRound: result.walletBalanceAfterEndRound ? roundMoney(result.walletBalanceAfterEndRound.amount) : null,
		walletPayout,
		rgsBetId: rgsRoundId(rgsRound),
		rgsActive: rgsRound ? rgsRound.active : null,
		rgsPayout: rgsRound ? rgsRound.payout : null,
		rgsAuthoritativeWin: rgsRound ? rgsRoundPayoutMoney(rgsRound) : null,
		rgsVisualSync: !!result.rgsVisualSync,
		hasFreeSpinTrigger: rgsFeature.hasFreeSpinTrigger,
		hasUpdateFreeSpin: rgsFeature.hasUpdateFreeSpin,
		hasFreeSpinEnd: rgsFeature.hasFreeSpinEnd,
		finalWin: rgsFeature.finalWin,
		willStartVisualFeature: rgsFeature.willStartVisualFeature,
		allowLocalFreeSpins: !!result.allowLocalFreeSpins,
		willCallEndRound: rgsRound ? rgsRound.active === true : false,
		walletBusy: state.walletBusy,
		animationBusy: state.spinning,
		featureBusy: state.mode === 'free' || !!result.featureBusy,
		balanceDelta: roundMoney(result.balanceAfter - result.balanceBefore),
		sumWinsAmount: sumWins,
		wins: spinDebug.wins,
	};
	console.debug('[GGR spin-result]', entry);
	debugJson('[GGR spin-result-json]', entry);
	console.table([{
		spinId: entry.spinId,
		source: entry.source,
		bet: entry.bet,
		balanceBefore: entry.balanceBefore,
		balanceAfterBet: entry.balanceAfterBet,
		displayedWin: entry.displayedWin,
		finalDisplayedWin: entry.displayedWin,
		rgsActive: entry.rgsActive,
		rgsPayout: entry.rgsPayout,
		rgsAuthoritativeWin: entry.rgsAuthoritativeWin,
		rgsVisualSync: entry.rgsVisualSync,
		hasFreeSpinTrigger: entry.hasFreeSpinTrigger,
		hasUpdateFreeSpin: entry.hasUpdateFreeSpin,
		hasFreeSpinEnd: entry.hasFreeSpinEnd,
		finalWin: entry.finalWin,
		willStartVisualFeature: entry.willStartVisualFeature,
		allowLocalFreeSpins: entry.allowLocalFreeSpins,
		willCallEndRound: entry.willCallEndRound,
		walletBusy: entry.walletBusy,
		animationBusy: entry.animationBusy,
		featureBusy: entry.featureBusy,
	}]);
	const sourceIsRgs = String(entry.source || '').startsWith('RGS_');
	if (!sourceIsRgs && !entry.rgsVisualSync) {
		if (result.baseWin > 0 && !spinDebug.wins.some((w) => w.positions && w.positions.length)) console.error('[GGR assert] totalWin > 0 but no visible cluster positions', entry);
		if (result.baseWin < capWin() - 0.001 && Math.abs(sumWins - roundMoney(result.baseWin)) > 0.01) console.error('[GGR assert] sum(wins.amount) !== baseWin', entry);
		if (Math.abs(totalWin - displayedWin) > 0.01) console.error('[GGR assert] displayedWin !== totalWin', entry);
		if (result.payoutApplied && Math.abs(roundMoney(result.balanceAfter) - expectedBalance) > 0.01) console.error('[GGR assert] balanceAfterPayout !== balanceBefore - bet + totalWin', entry);
	}
	if (walletPayout !== null && Math.abs(walletPayout - displayedWin) > 0.01) console.warn('[GGR wallet/math mismatch] RGS payout differs from visible frontend win.', entry);
}

// Cluster pays + cascades. Every winning position becomes a Golden Cell.
async function resolveCascades(spinDebug = null) {
	if (state.replay || UrlState.replay()) return 0;
	let multiplier = 1;
	let cascade = 0;
	while (state.win < capWin()) {
		const clusters = findClusters();
		if (!clusters.length) break;
		cascade += 1;
		const flat = [...new Map(clusters.flatMap((cl) => cl.cells).map((cell) => [ck(cell[0], cell[1]), cell])).values()];
		const rawWins = clusters.map((cl) => ({
			symbol: cl.key,
			amount: payFor(cl.key, cl.cells.length) * state.bet * multiplier,
			multiplier,
			positions: cl.cells.map(([c, r]) => ({ col: c, row: r, key: ck(c, r) })),
		}));
		const rawStepWin = rawWins.reduce((s, w) => s + w.amount, 0);
		const prevWin = state.win;
		const targetWin = Math.min(prevWin + rawStepWin, capWin());
		const stepWin = Math.max(0, targetWin - prevWin);
		const scale = rawStepWin > 0 ? stepWin / rawStepWin : 0;
		const wins = rawWins.map((w) => ({ ...w, rawAmount: w.amount, amount: w.amount * scale, displayAmount: roundMoney(w.amount * scale) }));

		stage.classList.add('win-focus');
		flat.forEach(([c, r]) => { cellEl(c, r).classList.add('win'); state.golden.add(ck(c, r)); });
		Sound.cluster(clusters.length);
		showClusterFloat(stepWin, flat);
		debugWinStep(spinDebug, cascade, wins, stepWin, targetWin);
		setWin(targetWin, false);
		const holdMs = state.turbo ? 300 : 640;
		Sound.clusterBurst(clusters.length, Math.max(0, countUpSteps() * COUNT_UP_INTERVAL_MS + holdMs * TF() - CLUSTER_BURST_LEAD_MS));
		await countUp(state.win, prevWin);
		await wait(holdMs);
		flat.forEach(([c, r]) => {
			const el = cellEl(c, r); const img = el.querySelector('img');
			if (img) img.classList.add('clearing');
			el.classList.add('converting'); // gold burn as the cell turns into a Golden Cell
			const p = stagePos(el); burstAt(p.x, p.y, 5);
		});
		await wait(230);
		stage.classList.remove('win-focus');
		// Tumble: only winning cells are removed. Survivors above fall down into
		// the gaps, new symbols refill from the top. Unchanged cells never move.
		const removed = Array.from({ length: COLS }, () => new Set());
		flat.forEach(([c, r]) => removed[c].add(r));
		const drops = new Map();
		for (let c = 0; c < COLS; c += 1) {
			if (!removed[c].size) continue; // column untouched -> nothing falls
			const survivors = [];
			for (let r = 0; r < ROWS; r += 1) if (!removed[c].has(r)) survivors.push(r);
			const add = ROWS - survivors.length;
			state.grid[c] = [...Array.from({ length: add }, randKey), ...survivors.map((r) => state.grid[c][r])];
			survivors.forEach((oldR, i) => { const newR = add + i; if (newR > oldR) drops.set(ck(c, newR), { rows: newR - oldR }); });
			for (let r = 0; r < add; r += 1) {
				drops.set(ck(c, r), { rows: add }); // refill stack falls from above
			}
		}
		// uniform per-column duration (everything in a column lands together), staggered left->right
		const colMax = {};
		for (const [k, d] of drops) { const c = +k.split(',')[0]; colMax[c] = Math.max(colMax[c] || 0, d.rows); }
		for (const [k, d] of drops) { const c = +k.split(',')[0]; d.dur = DROP_DUR(colMax[c]) * TF(); d.delay = c * COL_DELAY * TF(); }
		paint({ drops });
		scheduleScatterSounds(drops);
		await rawWait(dropEnd(drops) + 80 * TF());
		multiplier += 1;
	}
	stage.classList.remove('win-focus');
	return state.win;
}

// ---- Golden Goal Rush coin feature (Rainbow activates Golden Cells) ----
function revealGolden() {
	state.reveals.clear();
	const reduce = state.mode === 'free' && CONFIG.tiers[state.tier] && CONFIG.tiers[state.tier].reduceBronze;
	const w = {
		bronze: reduce ? Math.max(1, Math.round(CONFIG.bronzeWeight * 0.12)) : CONFIG.bronzeWeight,
		silver: CONFIG.silverWeight, gold: CONFIG.goldWeight,
		mult: CONFIG.multiplierWeight, collector: CONFIG.collectorWeight,
	};
	for (const key of state.golden) {
		const kind = wpick([['blank', CONFIG.blankWeight], ['bronze', w.bronze], ['silver', w.silver], ['gold', w.gold], ['mult', w.mult], ['collector', w.collector]]);
		if (kind === 'blank') { state.reveals.set(key, { kind: 'blank', value: 0, asset: COIN_ASSETS.bronze }); continue; }
		if (kind === 'mult') { const v = rand(CONFIG.multiplierValues); state.reveals.set(key, { kind: 'mult', value: v, asset: MULT_ASSETS[v] }); }
		else if (kind === 'collector') { state.reveals.set(key, { kind: 'collector', value: 0, asset: COLLECTOR_ASSET }); }
		else { const tbl = kind === 'gold' ? CONFIG.goldValues : kind === 'silver' ? CONFIG.silverValues : CONFIG.bronzeValues; state.reveals.set(key, { kind: 'coin', tier: kind, value: rand(tbl), asset: COIN_ASSETS[kind] }); }
	}
}
const coinList = () => [...state.reveals.values()].filter((v) => v.kind === 'coin');
const collectorKeys = () => [...state.reveals.entries()].filter(([, v]) => v.kind === 'collector')
	.map(([k]) => k).sort((a, b) => { const [ac, ar] = a.split(',').map(Number), [bc, br] = b.split(',').map(Number); return ar - br || ac - bc; });

async function applyMultipliers(baseWinAbs) {
	const mults = [...state.reveals.entries()].filter(([, v]) => v.kind === 'mult');
	for (const [key, badge] of mults) {
		const [c, r] = key.split(',').map(Number);
		const el = cellEl(c, r); if (el) el.classList.add('mult-pulse');
		for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
			const nv = state.reveals.get(ck(c + dc, r + dr));
			if (nv && nv.kind === 'coin') nv.value = Math.round(nv.value * badge.value * 100) / 100;
		}
		paint(); await wait(320);
	}
}

async function runFeature(baseWinAbs) {
	let coinMult = 0; // accumulated multiplier of bet from the coin feature
	for (let cycle = 0; cycle < CONFIG.maxCollectorCycles; cycle += 1) {
		revealGolden();
		if (state.reveals.size) Sound.feature();
		paint(); await wait(440);
		await applyMultipliers(baseWinAbs);
		const sum = coinList().reduce((s, c) => s + c.value, 0);
		const collectors = collectorKeys();
		let flew = false;
		for (const key of collectors) {
			const [c, r] = key.split(',').map(Number);
			const el = cellEl(c, r); if (el) el.classList.add('collect-pulse');
			if (sum > 0 && !flew) { await flyCoinsTo(c, r); flew = true; }
			if (el) el.classList.add('collect-burst'); Sound.collect();
			coinMult += sum;
			const prevWin = state.win;
			setWin(baseWinAbs + coinMult * state.bet, false);
			await countUp(state.win, prevWin);
			await wait(300);
			if (state.win >= capWin()) return coinMult * state.bet;
		}
		coinMult += sum; // the coins themselves pay
		const prevWin = state.win;
		setWin(baseWinAbs + coinMult * state.bet, false);
		await countUp(state.win, prevWin);
		await wait(260);
		if (!collectors.length || state.win >= capWin()) break;
		// collectors present -> re-roll golden cells for the next cycle
		state.reveals.clear(); paint(); await wait(220);
	}
	state.reveals.clear();
	return coinMult * state.bet;
}

function rainbowOnBoard() { return state.grid.some((col) => col.includes('rainbow')); }
function scatterCount() { return state.grid.reduce((s, col) => s + col.filter((k) => k === 'scatter').length, 0); }

// Drop the whole board in, column by column. When the bonus is close (anticipate),
// the columns decelerate left->right: the first ones still drop visibly one after
// another, then the last two hang back dramatically so the final reels "decide".
async function dropInBoard(anticipate) {
	const drops = fullDropMap();
	if (anticipate) {
		applyAnticipationDropTiming(drops);
		stage.classList.add('antic'); Sound.anticipation(2); stadiumFlash();
	}
	paint({ drops });
	scheduleScatterSounds(drops);
	scheduleDropStops(drops);
	await rawWait(dropEnd(drops) + 80 * TF());
	if (anticipate) stage.classList.remove('antic');
}

// ---- spin orchestration ----
function autoSpinLabel(count) {
	return count === Infinity ? '\u221e' : String(count);
}
function autoSpinCountFromDataset(value) {
	return value === 'inf' ? Infinity : Math.max(0, Number(value) || 0);
}
function buildAutoSpinModal() {
	state.selectedAutoSpins = null;
	const options = $('auto-options');
	const confirm = $('auto-confirm');
	if (!options || !confirm) return;
	confirm.classList.remove('show');
	confirm.innerHTML = '';
	options.innerHTML = AUTO_SPIN_OPTIONS.map((count) => {
		const value = count === Infinity ? 'inf' : String(count);
		return '<button type="button" class="auto-option" data-auto-count="' + value + '">' + autoSpinLabel(count) + '</button>';
	}).join('');
	options.querySelectorAll('[data-auto-count]').forEach((button) => {
		button.addEventListener('click', () => {
			state.selectedAutoSpins = autoSpinCountFromDataset(button.dataset.autoCount);
			options.querySelectorAll('.auto-option').forEach((el) => el.classList.toggle('selected', el === button));
			const label = autoSpinLabel(state.selectedAutoSpins);
			confirm.innerHTML = '<p>' + t('autoConfirm') + ' <strong>' + label + '</strong> ' + (state.selectedAutoSpins === Infinity ? 'spins' : 'spins') + '?</p>'
				+ '<div class="auto-confirm-row"><button type="button" class="cancel" id="auto-cancel">Cancel</button><button type="button" class="confirm" id="auto-confirm-start">Confirm</button></div>';
			confirm.classList.add('show');
			$('auto-cancel').onclick = closeModals;
			$('auto-confirm-start').onclick = () => confirmAutoSpin(state.selectedAutoSpins);
		});
	});
}
function confirmAutoSpin(count) {
	if (state.fatal || state.replay || state.spinning || state.walletBusy || state.mode !== 'base' || Rgs.busy()) return;
	if (state.balance < state.bet) {
		closeModals();
		showInsufficientFunds(state.bet);
		return;
	}
	closeModals();
	startAutoSpin(count);
}
function startAutoSpin(count) {
	if (state.fatal || state.replay || state.mode !== 'base') return;
	state.auto = true;
	state.autoRemaining = count === Infinity ? Infinity : Math.max(0, Number(count) || 0);
	const btn = $('btn-auto');
	if (btn) btn.classList.add('armed');
	scheduleAutoSpin(0);
}
function scheduleAutoSpin(delay = 0) {
	if (autoTimer) {
		clearTimeout(autoTimer);
		autoTimer = null;
	}
	if (!state.auto || state.fatal || state.replay) return;
	autoTimer = setTimeout(() => {
		autoTimer = null;
		launchAutoSpin();
	}, Math.max(0, delay));
}
function launchAutoSpin() {
	if (!state.auto || state.fatal || state.replay) { stopAutoSpin(); return; }
	if (state.mode !== 'base') { stopAutoSpin(); return; }
	if (state.spinning || state.walletBusy || Rgs.busy()) { scheduleAutoSpin(120); return; }
	if (state.balance < state.bet) {
		stopAutoSpin();
		showInsufficientFunds(state.bet);
		return;
	}
	if (Number.isFinite(state.autoRemaining)) {
		if (state.autoRemaining <= 0) { stopAutoSpin(); return; }
		state.autoRemaining -= 1;
	}
	spin();
}
function stopAutoSpin() {
	state.auto = false;
	state.autoRemaining = 0;
	state.selectedAutoSpins = null;
	if (autoTimer) {
		clearTimeout(autoTimer);
		autoTimer = null;
	}
	const btn = $('btn-auto');
	if (btn) btn.classList.remove('armed');
}
function setWalletBusy(busy) {
	state.walletBusy = !!busy;
	const spinBtn = $('btn-spin');
	if (spinBtn) spinBtn.classList.toggle('busy', state.spinning || state.walletBusy);
	updateLocks();
}
function applyAuthoritativeWalletBalance({ active, walletBalanceAfterPlay, walletBalanceAfterEndRound }) {
	const rawAmount = reconcileWalletBalance({
		active: !!active,
		playBalance: walletBalanceAfterPlay && walletBalanceAfterPlay.rawAmount,
		endRoundBalance: walletBalanceAfterEndRound && walletBalanceAfterEndRound.rawAmount,
	});
	state.balance = apiAmountToMoney(rawAmount);
	updateMeters();
	return state.balance;
}
function creditLocalWallet(amount) {
	const credit = roundMoney(Math.max(0, Number(amount) || 0));
	state.balance = roundMoney(state.balance + credit);
	state.localWalletCredits = roundMoney(state.localWalletCredits + credit);
	return state.balance;
}
async function spin(buy, internalFreeSpin = false) {
	if (state.fatal) return;
	if (state.replay || UrlState.replay()) return false;
	// Free Spins are driven by startFreeSpins(). Manual clicks during the bonus
	// must not skip animations or start extra spins between loop iterations.
	if (state.mode === 'free' && !internalFreeSpin) return;
	if (state.walletBusy && !internalFreeSpin) return;
	if (state.spinning) {
		if (state.mode !== 'free' && !Rgs.configured()) requestSkip();
		return;
	}
	const cost = state.mode === 'free' ? 0 : Math.round(state.bet * (buy ? buy.mult : 1) * 100) / 100;
	if (state.mode !== 'free' && state.balance < cost) {
		showInsufficientFunds(cost);
		stopAutoSpin();
		return;
	}
	const paidRound = state.mode !== 'free';
	if (paidRound && Rgs.configured()) state.localWalletCredits = 0;
	const balanceBefore = state.balance;
	const spinId = ++spinSeq;
	const spinDebug = UrlState.debug() ? {
		spinId,
		bet: state.bet,
		mode: state.mode,
		buy: buy ? buy.id : 'spin',
		wins: [],
		cascades: [],
	} : null;
	clearSkip();
	state.spinning = true; $('btn-spin').classList.add('busy');
	if (paidRound) setWalletBusy(true);
	Sound.spinStart();
	let walletManaged = false;
	let roundNeedsEnd = false;
	let walletBalanceAfterPlay = null;
	let walletBalanceAfterEndRound = null;
	let rgsPlay = null;
	if (paidRound) {
		rgsPlay = await Rgs.play(state.bet, Rgs.modeFor(buy), { spinId });
		walletBalanceAfterPlay = Rgs.consumePendingBalance();
		if (Rgs.configured() && !rgsPlay) {
			stopAutoSpin();
			fatalError('Game service request failed', 'The game could not start a wallet round. Please relaunch the game from the game host.');
			if (paidRound) setWalletBusy(false);
			$('btn-spin').classList.remove('busy'); state.spinning = false; clearSkip();
			updateMeters();
			return;
		}
		walletManaged = !!rgsPlay;
		roundNeedsEnd = !!(rgsPlay && rgsPlay.__needsEndRound);
		const rgsEvents = normalizeRgsEvents(rgsPlay && rgsPlay.round && rgsPlay.round.state);
		let rgsAmountContractError = null;
		if (Rgs.configured() && rgsPlay) {
			try {
				rgsRoundAmountContract(rgsPlay.round, rgsEvents);
			} catch (error) {
				rgsAmountContractError = error;
				console.error('[RGS contract] rejected play round', { message: error && error.message, roundId: rgsRoundId(rgsPlay.round) });
			}
		}
		const renderSafeRgsBase = Rgs.configured() && rgsPlay && !rgsAmountContractError && shouldRenderSafeRgsBase(rgsEvents);
		const renderRgsRound = Rgs.configured() && rgsPlay && !rgsAmountContractError && shouldRenderRgsRound(rgsEvents);
		if ((USE_RGS_STATE_RENDERER || renderSafeRgsBase || renderRgsRound) && Rgs.configured() && rgsPlay) {
			if (!walletBalanceAfterPlay) {
				fatalError('Game service settlement failed', 'The play response did not include the authoritative updated balance.');
				setWalletBusy(false);
				$('btn-spin').classList.remove('busy'); state.spinning = false; clearSkip();
				return;
			}
			state.balance = walletBalanceAfterPlay.amount;
			state.reveals.clear();
			setWin(0); updateMeters();
			const displayedWin = await playRgsBookRound(rgsPlay, spinId);
			if (roundNeedsEnd) {
				Rgs.setBalanceDeferred(true);
				const endRoundResult = await Rgs.endRound({ spinId });
				walletBalanceAfterEndRound = Rgs.consumePendingBalance();
				Rgs.setBalanceDeferred(false);
				if (endRoundResult && endRoundResult.blocked) {
					stopAutoSpin();
					fatalError('Game service settlement failed', 'The round could not be completed by the game service. Please relaunch the game.');
					setWalletBusy(false);
					updateMeters();
					$('btn-spin').classList.remove('busy'); state.spinning = false; clearSkip();
					return;
				}
			}
			try {
				applyAuthoritativeWalletBalance({
					active: roundNeedsEnd,
					walletBalanceAfterPlay,
					walletBalanceAfterEndRound,
				});
			} catch (error) {
				fatalError('Game service settlement failed', 'The authoritative balance could not be applied. Please relaunch the game.');
				setWalletBusy(false);
				$('btn-spin').classList.remove('busy'); state.spinning = false; clearSkip();
				return;
			}
			if (displayedWin > 0) await showBanner(displayedWin);
			setWalletBusy(false);
			updateMeters();
			finishSpinDebug(spinDebug, {
				source: renderSafeRgsBase ? 'RGS_BASE_STATE' : 'RGS_PAYOUT_SYNC',
				baseWin: displayedWin,
				featureWin: 0,
				displayedWin,
				cost,
				payoutApplied: true,
				rgsPlay,
				balanceBefore,
				balanceAfterBet: roundMoney(balanceBefore - cost),
				balanceAfter: state.balance,
				walletBalanceAfterPlay,
				walletBalanceAfterEndRound,
				rgsVisualSync: true,
			});
			$('btn-spin').classList.remove('busy'); state.spinning = false; clearSkip();
			if (state.mode === 'base' && state.auto) scheduleAutoSpin(state.turbo ? 250 : 600);
			return;
		}
		if (Rgs.configured() && rgsPlay) {
			stopAutoSpin();
			Rgs.setBalanceDeferred(true);
			if (roundNeedsEnd) {
				const endRoundResult = await Rgs.endRound({ spinId, recovery: 'unrenderable-rgs-round' });
				walletBalanceAfterEndRound = Rgs.consumePendingBalance();
				if (endRoundResult && endRoundResult.blocked) {
					Rgs.setBalanceDeferred(false);
					fatalError('Game service settlement failed', 'The round could not be completed after an unsupported game-service state. Please relaunch the game.');
					setWalletBusy(false);
					$('btn-spin').classList.remove('busy'); state.spinning = false; clearSkip();
					updateMeters();
					return;
				}
			}
			Rgs.setBalanceDeferred(false);
			if (rgsAmountContractError) {
				fatalError('Inconsistent game-service round', 'The round amounts did not agree with its authoritative event data. Nothing was reconstructed locally.');
			} else {
				fatalError('Unsupported game-service round', 'The game received a round state it cannot display safely. No local fallback was used.');
			}
			setWalletBusy(false);
			$('btn-spin').classList.remove('busy'); state.spinning = false; clearSkip();
			updateMeters();
			return;
		}
	}
	if (paidRound) { state.balance = roundMoney(state.balance - cost); state.golden.clear(); }
	state.reveals.clear();
	setWin(0); updateMeters();
	const balanceAfterBet = state.balance;
	const rgsVisualSync = paidRound && Rgs.configured() && !!rgsPlay;
	const rgsRoundActive = rgsVisualSync && rgsPlay.round && rgsPlay.round.active === true;
	const rgsKnownFinalWin = (rgsVisualSync && !rgsRoundActive) ? Math.max(0, rgsRoundPayoutMoney(rgsPlay.round) || 0) : null;

	const opts = {};
	if ((buy && buy.id === 'rainbow') || (state.mode === 'free' && CONFIG.tiers[state.tier] && CONFIG.tiers[state.tier].guaranteedRainbow)) opts.forceRainbow = true;
	if (buy && buy.id === 'hunt') { opts.boostRainbow = CONFIG.huntBoost || 5; opts.noBonus = true; }
	if (state.mode === 'free' && CONFIG.tiers[state.tier] && CONFIG.tiers[state.tier].rainbowBoost) opts.boostRainbow = CONFIG.tiers[state.tier].rainbowBoost;

	[...board.querySelectorAll('img')].forEach((img) => img.classList.add('clearing'));
	await wait(200);
	newGrid(opts);
	if (rgsVisualSync) removeUnconfirmedRgsScatterTrigger();
	if (rgsVisualSync && !rgsRoundActive) removeVisibleClustersForRgsFinal();
	const allowLocalScatterFeature = !rgsVisualSync;
	const anticipate = allowLocalScatterFeature && state.mode === 'base' && !opts.noBonus && !(buy && (buy.id === 'tier1' || buy.id === 'tier2')) && earlyScatterCount() >= 2;
	await dropInBoard(anticipate);
	if (allowLocalScatterFeature) await scatterAnticipation();

	let baseWin = 0;
	if (rgsVisualSync && !rgsRoundActive) {
		baseWin = 0;
	} else {
		baseWin = await resolveCascades(spinDebug);
	}
	let featureWin = 0;
	if (rainbowOnBoard() && state.golden.size && !rgsVisualSync) {
		// flash the rainbow symbol(s), then sweep light across the energising cells
		for (let c = 0; c < COLS; c += 1) for (let r = 0; r < ROWS; r += 1)
			if (state.grid[c][r] === 'rainbow') { const e = cellEl(c, r); if (e) e.classList.add('rainbow-flash'); }
		await wait(state.turbo ? 200 : 360);
		await rainbowSweep();
		featureWin = await runFeature(baseWin);
		if (state.mode === 'free' && CONFIG.tiers[state.tier] && !CONFIG.tiers[state.tier].persistAfterReveal) state.golden.clear();
	}
	let localVisualWin = roundMoney(baseWin + featureWin);
	setWin(localVisualWin);
	if (rgsVisualSync && !rgsRoundActive) {
		const rgsWin = rgsKnownFinalWin;
		if (rgsWin > 0) console.warn('[RGS visual] Positive final payout without a safe renderable RGS base book; not fabricating a local cluster.', { spinId, rgsWin, round: rgsPlay.round });
		baseWin = 0;
		featureWin = 0;
		setWin(0);
	}

	// payout / accumulate
	if (state.mode === 'free') {
		state.fsWin = (state.fsWin || 0) + state.win;
		state.fsBest = Math.max(state.fsBest || 0, state.win); // track best single spin for the summary
		$('meter-win').textContent = formatCurrency(state.fsWin); // WIN shows the running bonus total
	} else {
		if (rgsVisualSync && walletBalanceAfterPlay && !rgsRoundActive) state.balance = walletBalanceAfterPlay.amount;
		else if (!rgsVisualSync) creditLocalWallet(state.win);
		if ((!rgsVisualSync || !rgsRoundActive) && state.win > 0) await showBanner(state.win);
	}

	// scatters -> trigger / retrigger free spins
	const sc = scatterCount();
	let triggered = false;
	const allowLocalFreeSpins = !Rgs.configured();
	if (allowLocalFreeSpins && state.mode === 'base' && sc >= 3 && !opts.noBonus && !(buy && (buy.id === 'tier1' || buy.id === 'tier2'))) {
		triggered = true; $('btn-spin').classList.remove('busy'); state.spinning = false; clearSkip();
		await startFreeSpins(sc >= 5 ? 3 : sc >= 4 ? 2 : 1, walletManaged);
		if (roundNeedsEnd) {
			Rgs.setBalanceDeferred(true);
			await Rgs.endRound({ spinId });
			walletBalanceAfterEndRound = Rgs.consumePendingBalance();
			Rgs.setBalanceDeferred(false);
		}
		if (paidRound) setWalletBusy(false);
		updateMeters();
		finishSpinDebug(spinDebug, {
			baseWin,
			featureWin,
			displayedWin: state.win,
			cost,
			payoutApplied: false,
			balanceBefore,
			balanceAfterBet,
			balanceAfter: state.balance,
			walletBalanceAfterPlay,
			walletBalanceAfterEndRound,
			rgsPlay,
			allowLocalFreeSpins,
			rgsVisualSync,
		});
		return;
	} else if (state.mode === 'free' && sc >= 2) {
		await retrigger(sc);
	}

	if (state.mode === 'base') { state.golden.clear(); state.reveals.clear(); paint(); } // repaint to remove golden frames
	if (roundNeedsEnd) {
		Rgs.setBalanceDeferred(true);
		const endRoundResult = await Rgs.endRound({ spinId });
		walletBalanceAfterEndRound = Rgs.consumePendingBalance();
		Rgs.setBalanceDeferred(false);
		if (endRoundResult && endRoundResult.blocked) {
			fatalError('Game service settlement failed', 'The round could not be completed by the game service. Please relaunch the game.');
			if (paidRound) setWalletBusy(false);
			return;
		}
		if (rgsVisualSync) {
			try {
				applyAuthoritativeWalletBalance({ active: true, walletBalanceAfterPlay, walletBalanceAfterEndRound });
			} catch (error) {
				fatalError('Game service settlement failed', 'The authoritative balance could not be applied. Please relaunch the game.');
				if (paidRound) setWalletBusy(false);
				return;
			}
			const walletWin = Math.max(0, roundMoney(state.balance - balanceAfterBet));
			baseWin = walletWin;
			featureWin = 0;
			setWin(walletWin);
			state.balance = walletBalanceAfterEndRound.amount;
			if (walletWin > 0) await showBanner(walletWin);
		}
	}
	if (paidRound) setWalletBusy(false);
	updateMeters();
	finishSpinDebug(spinDebug, {
		baseWin,
		featureWin,
		displayedWin: state.win,
		cost,
		payoutApplied: state.mode !== 'free',
		balanceBefore,
		balanceAfterBet,
		balanceAfter: state.balance,
		walletBalanceAfterPlay,
		walletBalanceAfterEndRound,
		rgsPlay,
		allowLocalFreeSpins,
		rgsVisualSync,
	});
	$('btn-spin').classList.remove('busy'); state.spinning = false; clearSkip();
	if (state.mode === 'base' && state.auto && !triggered) scheduleAutoSpin(state.turbo ? 250 : 600);
}

// ---- free spins (3 tiers) ----
function updateFsCounter() {
	const el = $('fs-counter'); if (!el) return;
	const free = state.mode === 'free';
	el.classList.toggle('show', free);
	$('fs-count').textContent = Math.max(0, state.fsTotal - state.fsLeft); // spins played so far
	$('fs-total').textContent = state.fsTotal;
	$('fs-name').textContent = CONFIG.tiers[state.tier] ? CONFIG.tiers[state.tier].name : '';
	updateLocks();
}
// Lock Buy Bonus + bet controls during free spins (no bonus-in-bonus, no bet change).
function updateLocks() {
	const lock = state.mode === 'free' || state.walletBusy || state.replay;
	['btn-bonus', 'btn-bet-minus', 'btn-bet-plus'].forEach((id) => { const e = $(id); if (e) e.classList.toggle('locked', lock); });
}
// Retrigger is a real highlight moment: freeze, pulse the scatters, toast, then
// the spin counter ticks up before play resumes.
async function retrigger(sc) {
	const add = sc >= 3 ? 4 : 2;
	if (state.tier === 1 && sc >= 4) state.tier = 2;
	const from = state.fsTotal;
	for (let c = 0; c < COLS; c += 1) for (let r = 0; r < ROWS; r += 1)
		if (state.grid[c][r] === 'scatter') { const e = cellEl(c, r); if (e) e.classList.add('scatter-antic'); }
	Sound.scatterHit(); stadiumFlash();
	const t = $('rt-toast'); $('rt-big').textContent = '+' + add + ' FREE SPINS'; $('rt-sub').textContent = CONFIG.tiers[state.tier].name;
	t.classList.add('show');
	await wait(state.turbo ? 320 : 650);
	state.fsLeft += add; state.fsTotal += add;
	for (let v = from + 1; v <= state.fsTotal; v += 1) { $('fs-total').textContent = v; Sound.tick(v - from, add); await wait(state.turbo ? 70 : 130); }
	updateFsCounter();
	await wait(state.turbo ? 200 : 420);
	t.classList.remove('show');
	document.querySelectorAll('#board .cell.scatter-antic').forEach((e) => e.classList.remove('scatter-antic'));
}
function bonusSummary(total, spins, best, { blocking = true } = {}) {
	const presentation = new Promise((resolve) => {
		const el = $('bonus-summary'); const btn = $('bs-continue');
		$('bs-total').textContent = formatCurrency(0); $('bs-spins').textContent = spins; $('bs-best').textContent = formatCurrency(best);
		el.classList.add('show');
		const lv = winLevel(total / state.bet);
		Sound.win(lv ? lv.tier : 'big'); coinShower(lv && lv.coins ? lv.coins : 22);
		const steps = 30; let i = 0;
		const cnt = setInterval(() => { i += 1; $('bs-total').textContent = formatCurrency(total * i / steps); Sound.tick(i, steps); if (i >= steps) { clearInterval(cnt); $('bs-total').textContent = formatCurrency(total); } }, 40);
		let closed = false;
		const close = () => { if (closed) return; closed = true; clearInterval(cnt); $('bs-total').textContent = formatCurrency(total); el.classList.remove('show'); btn.onclick = null; resolve(); };
		btn.onclick = close;
		if (state.replayPlaying || state.auto) {
			setTimeout(close, state.replayPlaying ? (state.turbo ? 500 : 1200) : (state.turbo ? 2600 : 8000));
		}
	});
	return blocking ? presentation : Promise.resolve();
}
async function startFreeSpins(tier, walletManaged = false) {
	if (state.replay || UrlState.replay()) return false;
	clearSkip();
	state.mode = 'free'; state.tier = tier; state.fsTotal = CONFIG.tiers[tier].spins; state.fsLeft = state.fsTotal;
	state.fsWin = 0; state.fsBest = 0; state.fsPlayed = 0;
	state.golden.clear(); state.reveals.clear();
	Sound.freeSpins();
	setBonusMode(true);
	updateFsCounter();
	await bonusIntro(tier);
	Sound.stopFreeSpins();
	while (state.fsLeft > 0 && (state.fsWin || 0) < capWin()) {
		state.fsLeft -= 1; updateFsCounter();
		await spin(null, true);
		state.fsPlayed += 1;
		await wait(state.turbo ? 250 : 550);
	}
	const won = state.fsWin || 0;
	state.mode = 'base'; state.tier = 0; state.golden.clear(); state.reveals.clear(); paint();
	creditLocalWallet(won);
	updateMeters(); updateFsCounter();
	setBonusMode(false);
	await bonusSummary(won, state.fsPlayed, state.fsBest || 0);
}

function changeBet(dir) {
	if (state.fatal || state.replay || state.spinning || state.walletBusy || state.mode === 'free') return; // bet locked during active paid/free rounds
	state.betIdx = Math.max(0, Math.min(BETS.length - 1, state.betIdx + dir));
	state.bet = BETS[state.betIdx]; updateMeters();
}

$('btn-spin').addEventListener('click', () => spin());
$('btn-bet-minus').addEventListener('click', () => changeBet(-1));
$('btn-bet-plus').addEventListener('click', () => changeBet(1));
$('btn-turbo').addEventListener('click', () => setTurbo(!state.turbo));
$('btn-auto').addEventListener('click', () => {
	if (state.fatal || state.replay) return;
	if (state.auto) { stopAutoSpin(); return; }
	if (state.spinning || state.walletBusy || state.mode !== 'base' || Rgs.busy()) return;
	buildAutoSpinModal();
	openModal('modal-autospin');
});
// ---- bonus buy ----
const BB_META = {
	hunt: { asset: MULT_ASSETS[5], accent: '#cf9b3f', tag: 'Boost' },
	rainbow: { asset: SYMBOLS.rainbow.src, accent: '#7d5cff', tag: 'Arc' },
	tier1: { asset: SYMBOLS.scatter.src, accent: '#e7b84e', tag: '8 Spins' },
	tier2: { asset: COLLECTOR_ASSET, accent: '#ffd24a', tag: '12 Spins' },
};
function buildBonusBuy() {
	if (state.replay || UrlState.replay()) return false;
	const wrap = $('bonusbuy-list');
	let anyDisabled = false;
	wrap.innerHTML = CONFIG.bonusBuy.map((o) => {
		const price = Math.round(o.mult * state.bet * 100) / 100;
		const afford = state.balance >= price; if (!afford) anyDisabled = true;
		const m = BB_META[o.id] || { asset: SYMBOLS.football.src, accent: '#d5a23b', tag: 'Bonus' };
		const desc = o.id === 'hunt' ? 'One play with boosted feature chance'
			: o.id === 'rainbow' ? 'One play with a guaranteed Golden Arc'
			: o.id === 'tier1' ? 'Start 8 Free Spins (Tier 1)'
			: o.id === 'tier2' ? 'Start 12 Free Spins (Tier 2)'
			: o.desc;
		return '<button class="bb-opt' + (afford ? '' : ' disabled') + '" data-buy="' + o.id + '" style="--bb-accent:' + m.accent + '" aria-disabled="' + (afford ? 'false' : 'true') + '">' +
			'<span class="bb-ico"><img src="' + m.asset + '" alt="" /></span>' +
			'<div class="bb-text"><div class="bb-name">' + o.label + '</div><div class="bb-desc">' + desc + '</div><div class="bb-tag">' + m.tag + '</div></div>' +
			'<div class="bb-price">' + formatCurrency(price) + '</div></button>';
	}).join('');
	$('bonusbuy-note').textContent = anyDisabled ? t('bonusNoteDisabled') : t('bonusNoteAffordable');
	wrap.querySelectorAll('[data-buy]').forEach((btn) => btn.addEventListener('click', () => {
		const o = CONFIG.bonusBuy.find((x) => x.id === btn.dataset.buy);
		const price = Math.round(o.mult * state.bet * 100) / 100;
		if (state.balance < price) { showInsufficientFunds(price); return; }
		showBuyConfirm(o, price);
	}));
}
// Confirm/Cancel before a purchase, with a plain-language description of what
// the player gets, so Bonus Buy never jumps straight into spins.
function showBuyConfirm(o, price) {
	if (state.replay || UrlState.replay()) return false;
	const what = o.id === 'tier1' ? CONFIG.tiers[1].spins + ' Free Spins · Tier 1'
		: o.id === 'tier2' ? CONFIG.tiers[2].spins + ' Free Spins · Tier 2'
		: o.id === 'rainbow' ? 'one spin with a guaranteed Golden Arc'
		: 'one spin with boosted feature chance';
	$('bonusbuy-list').innerHTML = '<div class="bb-confirm">'
		+ '<div class="c-q">' + t('buyConfirmVerb') + ' <b>' + o.label + '</b><br>(' + what + ')<br>for <b>' + formatCurrency(price) + '</b>?</div>'
		+ '<div class="c-row"><button class="c-no" id="bb-cancel">Cancel</button><button class="c-yes" id="bb-confirm">Confirm</button></div></div>';
	$('bonusbuy-note').textContent = t('balanceAfterPurchase') + ': ' + formatCurrency(Math.max(0, Math.round((state.balance - price) * 100) / 100));
	$('bb-cancel').onclick = () => buildBonusBuy();
	$('bb-confirm').onclick = async () => {
		const confirmBtn = $('bb-confirm');
		if (confirmBtn && confirmBtn.disabled) return;
		if (confirmBtn) confirmBtn.disabled = true;
		if (state.balance < price) { showInsufficientFunds(price); buildBonusBuy(); return; }
		closeModals();
		if (o.id === 'tier1' || o.id === 'tier2') {
			const purchaseSpinId = ++spinSeq;
			const purchaseUsesRgs = Rgs.configured();
			setWalletBusy(true);
			Rgs.setBalanceDeferred(true);
			if (purchaseUsesRgs) {
				state.spinning = true;
				$('btn-spin').classList.add('busy');
			}
			try {
				const rgsPlay = await Rgs.play(state.bet, Rgs.modeFor(o), { spinId: purchaseSpinId });
				const walletBalanceAfterPlay = Rgs.consumePendingBalance();
				if (Rgs.configured() && !rgsPlay) {
					fatalError('Game service request failed', 'The feature could not start a game round. Please relaunch the game.');
					return;
				}
				const walletManaged = !!rgsPlay;
				const roundNeedsEnd = !!(rgsPlay && rgsPlay.__needsEndRound);
				if (walletManaged) {
					if (!walletBalanceAfterPlay) {
						fatalError('Game service settlement failed', 'The play response did not include the authoritative updated balance.');
						return;
					}
					state.balance = walletBalanceAfterPlay.amount;
				} else state.balance = roundMoney(state.balance - price);
				updateMeters();
				// RGS/Stake mode: the purchased round must render only from the RGS
				// book/payout, exactly like a normal spin (see playRgsBookRound).
				// This used to be gated on USE_RGS_STATE_RENDERER, which stays
				// false, so every bonus buy fell through to the local
				// startFreeSpins() simulator below and produced a win with no
				// relation to the /wallet/play payout — that mismatch is what
				// Stake Engine flagged. Local free spins are now only for
				// non-RGS demo mode.
				if (Rgs.configured() && rgsPlay) {
					const tier = o.id === 'tier1' ? 1 : 2;
					const rgsEvents = normalizeRgsEvents(rgsPlay && rgsPlay.round && rgsPlay.round.state);
					let rgsAmountContractError = null;
					try {
						rgsRoundAmountContract(rgsPlay.round, rgsEvents);
					} catch (error) {
						rgsAmountContractError = error;
						console.error('[RGS contract] rejected feature round', { message: error && error.message, roundId: rgsRoundId(rgsPlay.round) });
					}
					if (rgsAmountContractError || !shouldRenderRgsRound(rgsEvents)) {
						if (roundNeedsEnd) {
							const endRoundResult = await Rgs.endRound({ spinId: purchaseSpinId, recovery: rgsAmountContractError ? 'inconsistent-bonus-buy' : 'unrenderable-bonus-buy' });
							if (endRoundResult && endRoundResult.blocked) {
								fatalError('Game service settlement failed', 'The unsupported feature round could not be completed. Please relaunch the game.');
								return;
							}
						}
						if (rgsAmountContractError) {
							fatalError('Inconsistent game-service round', 'The feature amounts did not agree with its authoritative event data. Nothing was reconstructed locally.');
						} else {
							fatalError('Unsupported game-service round', 'The feature returned a round state the game cannot display safely. No local fallback was used.');
						}
						return;
					}
					await bonusIntroRgs(CONFIG.tiers[tier].spins);
					const displayedWin = await playRgsBookRound(rgsPlay, purchaseSpinId, {
						skipBonusIntro: true,
						trackProgress: true,
					});
					let walletBalanceAfterEndRound = null;
					if (roundNeedsEnd) {
						Rgs.setBalanceDeferred(true);
						const endRoundResult = await Rgs.endRound({ spinId: purchaseSpinId });
						walletBalanceAfterEndRound = Rgs.consumePendingBalance();
						if (endRoundResult && endRoundResult.blocked) {
							fatalError('Game service settlement failed', 'The feature round could not be completed. Please relaunch the game.');
							return;
						}
					}
					try {
						applyAuthoritativeWalletBalance({
							active: roundNeedsEnd,
							walletBalanceAfterPlay,
							walletBalanceAfterEndRound,
						});
					} catch (error) {
						fatalError('Game service settlement failed', 'The authoritative balance could not be applied. Please relaunch the game.');
						return;
					}
					if (displayedWin > 0) await showBanner(displayedWin);
				} else {
					await startFreeSpins(o.id === 'tier1' ? 1 : 2, walletManaged);
				}
				if (!Rgs.configured() && roundNeedsEnd) {
					Rgs.setBalanceDeferred(true);
					await Rgs.endRound({ spinId: purchaseSpinId });
					Rgs.consumePendingBalance();
				}
			} finally {
				Rgs.setBalanceDeferred(false);
				if (purchaseUsesRgs) {
					state.spinning = false;
					$('btn-spin').classList.remove('busy');
					clearSkip();
				}
				setWalletBusy(false);
				updateMeters();
			}
		} else spin(o);
	};
}
$('btn-bonus').addEventListener('click', () => { if (!state.fatal && !state.replay && !state.spinning && !state.walletBusy && state.mode === 'base') { buildBonusBuy(); openModal('modal-bonusbuy'); } });
window.addEventListener('keydown', (event) => {
	if (event.code !== 'Space' || event.repeat) return;
	const target = event.target instanceof Element ? event.target : null;
	const interactive = target?.closest('button,a[href],input,select,textarea,[contenteditable="true"],[role="button"]');
	if (interactive || state.replay || UrlState.replay()) return;
	event.preventDefault();
	spin();
});

// ---- modals: open / close ----
function openModal(id) {
	if (state.replay && ['modal-autospin', 'modal-bonusbuy', 'modal-major-confirm', 'modal-interrupted-round'].includes(id)) return false;
	document.querySelectorAll('[data-modal]').forEach((m) => { if (!m.dataset.persistent || m.id === id) m.classList.remove('open'); });
	const el = document.getElementById(id);
	if (el) el.classList.add('open');
	return !!el;
}
function closeModals(force = false) {
	document.querySelectorAll('[data-modal]').forEach((m) => {
		if (force || !m.dataset.persistent) m.classList.remove('open');
	});
}
$('btn-menu').addEventListener('click', () => openModal('modal-menu'));
$('btn-settings').addEventListener('click', () => openModal('modal-settings'));
$('btn-info').addEventListener('click', () => openModal('modal-rules'));
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => closeModals()));
document.querySelectorAll('[data-modal]').forEach((m) => m.addEventListener('click', (e) => { if (e.target === m && !m.dataset.persistent) closeModals(); }));
document.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => openModal(b.dataset.open)));
window.addEventListener('keydown', (e) => { if (e.code === 'Escape') closeModals(); });
function primeSound() { Sound.prime(); }
window.addEventListener('load', primeSound);
document.addEventListener('visibilitychange', () => { if (!document.hidden) primeSound(); });
['pointerdown', 'mousedown', 'touchstart', 'click', 'keydown'].forEach((ev) => {
	document.addEventListener(ev, primeSound, { passive: true, capture: true });
});
setTimeout(primeSound, 100);

function setSound(on) {
	state.sound = !!on;
	Sound.setEnabled(state.sound);
	const pill = $('menu-sound-state');
	if (pill) { pill.textContent = state.sound ? 'ON' : 'OFF'; pill.classList.toggle('off', !state.sound); }
	const toggle = $('toggle-sfx');
	if (toggle) toggle.classList.toggle('on', state.sound);
}
function setVolume(kind, value) {
	const n = Math.max(0, Math.min(100, Number(value) || 0));
	if (kind === 'music') state.musicVolume = n;
	if (kind === 'sfx') state.sfxVolume = n;
	const input = $(kind + '-volume');
	const out = $(kind + '-volume-val');
	if (input) input.value = String(n);
	if (out) out.textContent = n + '%';
	Sound.setVolumes();
}
function initVolumeControls() {
	setVolume('music', state.musicVolume);
	setVolume('sfx', state.sfxVolume);
	document.querySelectorAll('[data-volume]').forEach((input) => {
		input.addEventListener('input', () => setVolume(input.dataset.volume, input.value));
	});
}
function setTurbo(on) {
	state.turbo = !!on;
	const button = $('btn-turbo');
	if (button) button.classList.toggle('armed', state.turbo);
	const toggle = $('toggle-turbo');
	if (toggle) toggle.classList.toggle('on', state.turbo);
}

// menu: sound toggle (drives the synthesised SFX hooks)
$('menu-sound').addEventListener('click', () => setSound(!state.sound));
initVolumeControls();

// settings: toggle switches
document.querySelectorAll('.toggle').forEach((t) => t.addEventListener('click', () => {
	t.classList.toggle('on');
	if (t.dataset.toggle === 'turbo') setTurbo(t.classList.contains('on'));
	if (t.dataset.toggle === 'sfx') setSound(t.classList.contains('on'));
}));

// info: build the paytable grid from the symbol set
(function buildPaytable() {
	const order = ['jersey', 'trophy', 'whistle', 'football', 'a', 'k', 'q', 'j', 'ten'];
	const grid = $('pt-grid');
	grid.innerHTML = order.map((key) => {
		const symbol = SYMBOLS[key];
		const pay = PRODUCTION_PAYTABLE[key];
		const formatted = FORMATTED_PRODUCTION_PAYTABLE[key];
		if (!symbol || !pay) throw new Error('Published Paytable symbol is missing from the frontend: ' + key);
		const value = (size) => size === 12 ? pay.cluster12 : size === 9 ? pay.cluster9 : size === 7 ? pay.cluster7 : pay.cluster5;
		const formattedValue = (size) => size === 12 ? formatted.cluster12 : size === 9 ? formatted.cluster9 : size === 7 ? formatted.cluster7 : formatted.cluster5;
		const item = (size) => '<span data-cluster-threshold="' + size + '" data-multiplier="' + value(size) + '"><b>' + size + '+</b> ' + formattedValue(size) + '×</span>';
		return '<div class="pt-cell" data-paytable-symbol="' + key + '"><img src="' + symbol.src + '" alt="' + key + '" />' +
			'<div class="pt-pays">' + item(12) + ' &nbsp; ' + item(9) + '<br>' + item(7) + ' &nbsp; ' + item(5) + '</div></div>';
	}).join('');
})();

// ---- cinematic launch intro -------------------------------------------------
// This controller owns only the optional presentation layer. It deliberately
// never awaits RGS, replay, restore, or the playable board and it releases all
// its handles when the player enters the game.
const Intro = (() => {
	const root = $('cinematic-intro');
	const gameStage = $('stage');
	const canvas = $('intro-atmosphere');
	const sceneCopy = $('intro-scene-copy');
	const progress = $('intro-progress');
	const progressLabel = $('intro-progress-label');
	const skip = $('intro-skip');
	const enterSound = $('intro-enter-sound');
	const enterSilent = $('intro-enter-silent');
	const readyTitle = $('intro-ready-title');
	const soundPrompt = $('intro-sound-prompt');
	const desktopArt = $('intro-desktop-art');
	const mobileArt = $('intro-mobile-art');
	const wordmark = $('intro-wordmark');
	const timers = new Set();
	const pauseResolvers = new Set();
	let raf = 0;
	let disposed = false;
	let started = false;
	let scene = null;
	let particles = [];
	let lightPulse = 0;
	let lastFrameAt = 0;
	let introAudio = null;
	let previousStageAriaHidden = null;
	const params = new URLSearchParams(window.location.search);
	const override = String(params.get('intro') || '').toLowerCase();
	const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	const isLocalQaHost = /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(window.location.hostname);
	const sessionKey = 'ggr-intro-session:' + INTRO_CONFIG.version + ':' + INTRO_CONFIG.theme;
	const persistentKey = 'ggr-intro-version:' + INTRO_CONFIG.version + ':' + INTRO_CONFIG.theme;
	function copy() {
		const language = (UrlState.lang() || 'en').toLowerCase().split('-')[0];
		return INTRO_CONFIG.locales[language] || INTRO_CONFIG.locales.en;
	}
	function sceneByKind(kind) { return INTRO_CONFIG.scenes.find((item) => item.kind === kind) || null; }
	function setScene(next) {
		if (!root || !next || disposed) return;
		scene = next;
		root.dataset.scene = next.id;
		root.style.setProperty('--intro-scene-duration', Math.max(1, next.durationMs) + 'ms');
		root.style.setProperty('--intro-camera-from', String(next.camera.scaleFrom));
		root.style.setProperty('--intro-camera-to', String(next.camera.scaleTo));
		root.style.setProperty('--intro-camera-x', String(next.camera.xPercent));
		root.style.setProperty('--intro-camera-y', String(next.camera.yPercent));
		const focalPoint = String(next.camera.xPercent) + '% ' + String(next.camera.yPercent) + '%';
		if (desktopArt) desktopArt.style.objectPosition = focalPoint;
		if (mobileArt) mobileArt.style.objectPosition = focalPoint;
		if (sceneCopy) sceneCopy.textContent = copy()[next.copyKey] || '';
		lightPulse = Number(next.atmosphere?.lightBurst) || 0;
		// Restart only the image camera keyframe; the scene ids and timings remain
		// data-driven and can be reordered in ggr-intro-config.mjs.
		desktopArt?.classList.remove('intro-scene-refresh');
		mobileArt?.classList.remove('intro-scene-refresh');
		void root.offsetWidth;
		desktopArt?.classList.add('intro-scene-refresh');
		mobileArt?.classList.add('intro-scene-refresh');
	}
	function after(ms, callback) {
		const id = window.setTimeout(() => { timers.delete(id); callback(); }, ms);
		timers.add(id);
		return id;
	}
	function pause(ms) {
		return new Promise((resolve) => {
			const complete = () => { pauseResolvers.delete(complete); resolve(); };
			pauseResolvers.add(complete);
			after(ms, complete);
		});
	}
	function markSeen() {
		try {
			if (INTRO_CONFIG.runPolicy === 'per-session') sessionStorage.setItem(sessionKey, '1');
			if (INTRO_CONFIG.runPolicy === 'once-per-version') localStorage.setItem(persistentKey, '1');
		} catch (error) { /* storage is optional and must never block the game */ }
	}
	function shouldRun() {
		if (!root || override === 'off' || INTRO_CONFIG.skipInReplay && (UrlState.replay() || Replay.configured())) return false;
		if (override === 'always' || override === 'ready') return true;
		// Local QA keeps its established direct-game routes. Browser tests can
		// opt in explicitly with ?intro=always without special production code.
		if (isLocalQaHost) return false;
		try {
			if (INTRO_CONFIG.runPolicy === 'per-session' && sessionStorage.getItem(sessionKey)) return false;
			if (INTRO_CONFIG.runPolicy === 'once-per-version' && localStorage.getItem(persistentKey)) return false;
		} catch (error) {}
		return true;
	}
	function updateProgress(done, total, degraded) {
		const percentage = total ? Math.round(done / total * 100) : 100;
		if (progress) progress.value = percentage;
		if (progressLabel) progressLabel.textContent = (degraded ? copy().degraded : copy().loading) + ' · ' + percentage + '%';
	}
	function waitForImage(element, fallback) {
		return new Promise((resolve) => {
			if (!element) { resolve(false); return; }
			const complete = () => { element.removeEventListener('load', onLoad); element.removeEventListener('error', onError); resolve(true); };
			const onLoad = () => complete();
			const onError = () => {
				element.removeEventListener('load', onLoad);
				element.removeEventListener('error', onError);
				if (fallback && element.src.indexOf(fallback) === -1) {
					element.src = fallback;
					element.addEventListener('load', () => resolve(false), { once:true });
					element.addEventListener('error', () => resolve(false), { once:true });
				} else resolve(false);
			};
			if (element.complete && element.naturalWidth > 0) { resolve(true); return; }
			element.addEventListener('load', onLoad, { once:true });
			element.addEventListener('error', onError, { once:true });
		});
	}
	async function preload() {
		const assets = [desktopArt, mobileArt, wordmark];
		let done = 0;
		let degraded = false;
		updateProgress(done, assets.length, degraded);
		for (const asset of assets) {
			const ok = await waitForImage(asset, INTRO_CONFIG.assets.fallbackBackdrop);
			degraded = degraded || !ok;
			done += 1;
			updateProgress(done, assets.length, degraded);
		}
		return !degraded;
	}
	function resizeCanvas() {
		if (!canvas) return;
		const ratio = Math.min(1.5, window.devicePixelRatio || 1);
		const rect = canvas.getBoundingClientRect();
		canvas.width = Math.max(1, Math.floor(rect.width * ratio));
		canvas.height = Math.max(1, Math.floor(rect.height * ratio));
		const lowMemory = Number(navigator.deviceMemory || 8) < INTRO_CONFIG.quality.lowMemoryDeviceThresholdGb;
		const count = reduced ? INTRO_CONFIG.reducedMotion.particleCount : lowMemory ? INTRO_CONFIG.quality.lowQualityParticleCount : INTRO_CONFIG.quality.maxParticleCount;
		particles = Array.from({ length: count }, () => ({ x: Math.random(), y: Math.random(), z: .25 + Math.random() * .75, drift: -.12 + Math.random() * .24, size: .6 + Math.random() * 1.8 }));
	}
	function drawFrame(timestamp) {
		if (disposed || !canvas) return;
		const cap = Math.max(24, Math.min(60, Number(INTRO_CONFIG.quality.frameRateCap) || 60));
		const now = Number(timestamp) || performance.now();
		const minFrameMs = 1000 / cap;
		if (lastFrameAt && now - lastFrameAt < minFrameMs) { raf = requestAnimationFrame(drawFrame); return; }
		const elapsed = lastFrameAt ? Math.min(34, now - lastFrameAt) : minFrameMs;
		lastFrameAt = now;
		const context = canvas.getContext('2d');
		if (!context) return;
		const width = canvas.width;
		const height = canvas.height;
		context.clearRect(0, 0, width, height);
		const pulse = Math.max(0, Math.min(1, lightPulse));
		if (pulse > 0) {
			const glow = context.createRadialGradient(width * .5, height * .58, 0, width * .5, height * .58, Math.max(width, height) * .48);
			glow.addColorStop(0, 'rgba(255,215,112,' + (pulse * .2) + ')');
			glow.addColorStop(1, 'rgba(255,215,112,0)');
			context.fillStyle = glow;
			context.fillRect(0, 0, width, height);
		}
		for (const particle of particles) {
			particle.y += (0.00005 + particle.z * 0.00018) * elapsed;
			particle.x += particle.drift * 0.00008 * elapsed;
			if (particle.y > 1.04) { particle.y = -.04; particle.x = Math.random(); }
			if (particle.x < -.04) particle.x = 1.04;
			if (particle.x > 1.04) particle.x = -.04;
			context.fillStyle = 'rgba(255,218,118,' + (.16 + particle.z * .5) + ')';
			context.beginPath();
			context.arc(particle.x * width, particle.y * height, particle.size * particle.z * (window.devicePixelRatio || 1), 0, Math.PI * 2);
			context.fill();
		}
		lightPulse *= .985;
		raf = requestAnimationFrame(drawFrame);
	}
	function beginAtmosphere() {
		if (!canvas || reduced) return;
		resizeCanvas();
		lastFrameAt = 0;
		window.addEventListener('resize', resizeCanvas, { passive:true });
		if (INTRO_CONFIG.parallax?.enabled) window.addEventListener('pointermove', applyParallax, { passive:true });
		raf = requestAnimationFrame(drawFrame);
	}
	function stopAtmosphere() {
		if (raf) cancelAnimationFrame(raf);
		raf = 0;
		lastFrameAt = 0;
		window.removeEventListener('resize', resizeCanvas);
		window.removeEventListener('pointermove', applyParallax);
		if (desktopArt) desktopArt.style.removeProperty('translate');
		if (mobileArt) mobileArt.style.removeProperty('translate');
		if (canvas) { const context = canvas.getContext('2d'); context?.clearRect(0, 0, canvas.width, canvas.height); }
	}
	function applyParallax(event) {
		if (disposed || !INTRO_CONFIG.parallax?.enabled || !root) return;
		const rect = root.getBoundingClientRect();
		if (!rect.width || !rect.height) return;
		const maxOffset = Number(INTRO_CONFIG.parallax.pointerMaxOffsetPx) || 0;
		const x = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1)) * maxOffset;
		const y = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1)) * maxOffset;
		if (desktopArt) desktopArt.style.translate = x * .28 + 'px ' + y * .16 + 'px';
		if (mobileArt) mobileArt.style.translate = x * .12 + 'px ' + y * .08 + 'px';
	}
	function playAccent(name) {
		if (!name || !state.sound || reduced) return;
		const src = INTRO_CONFIG.assets[name];
		if (!src) return;
		if (introAudio) { try { introAudio.pause(); introAudio.src = ''; } catch (error) {} }
		introAudio = new Audio(src);
		introAudio.preload = 'auto';
		introAudio.volume = name === 'stadiumRoar' ? .16 : .24;
		introAudio.play().catch(() => {});
	}
	function showReady() {
		const target = sceneByKind('ready');
		if (!target || disposed) return;
		setScene(target);
		// The ready heading is the semantic title; do not repeat it as cinematic
		// scene copy once the interactive controls are available.
		if (sceneCopy) sceneCopy.textContent = '';
		if (skip) { skip.hidden = true; skip.tabIndex = -1; skip.classList.remove('is-available'); }
		if (readyTitle) readyTitle.textContent = copy().ready;
		if (soundPrompt) soundPrompt.textContent = copy().soundChoice;
		if (enterSound) enterSound.textContent = copy().enterWithSound;
		if (enterSilent) enterSilent.textContent = copy().enterSilent;
		after(280, () => enterSound?.focus({ preventScroll:true }));
	}
	function skipSequence() {
		if (INTRO_CONFIG.skip.behavior === 'enter-silent') enter(false);
		else showReady();
	}
	function dispose(reason, immediate = false) {
		if (disposed) return;
		disposed = true;
		timers.forEach((id) => clearTimeout(id));
		timers.clear();
		pauseResolvers.forEach((resolve) => resolve());
		pauseResolvers.clear();
		stopAtmosphere();
		if (introAudio) { try { introAudio.pause(); introAudio.src = ''; } catch (error) {} introAudio = null; }
		if (gameStage) {
			gameStage.inert = false;
			if (previousStageAriaHidden === null) gameStage.removeAttribute('aria-hidden');
			else gameStage.setAttribute('aria-hidden', previousStageAriaHidden);
		}
		if (!root) return;
		root.dataset.dismissReason = reason || 'entered';
		if (immediate || reduced) { root.hidden = true; return; }
		root.classList.add('is-leaving');
		after(500, () => { root.hidden = true; root.classList.remove('is-leaving'); });
	}
	function enter(withSound) {
		markSeen();
		setSound(!!withSound);
		if (withSound) { Sound.prime(); playAccent('stadiumRoar'); }
		dispose(withSound ? 'sound-start' : 'silent-start');
	}
	async function playSequence() {
		for (const item of INTRO_CONFIG.scenes) {
			if (disposed) return;
			if (item.kind === 'ready') break;
			setScene(item);
			playAccent(item.atmosphere?.ambience);
			await pause(Math.max(0, item.durationMs));
			if (disposed) return;
			await pause(Math.max(0, item.transitionMs));
		}
		showReady();
	}
	async function start() {
		if (started || !shouldRun()) { if (root) root.hidden = true; return false; }
		started = true;
		if (!root) return false;
		root.hidden = false;
		if (gameStage) {
			previousStageAriaHidden = gameStage.getAttribute('aria-hidden');
			gameStage.setAttribute('aria-hidden', 'true');
			gameStage.inert = true;
		}
		// Browsers do not allow media to start until a gesture. Keep all existing
		// audio silent while the player makes the explicit start-screen choice.
		setSound(false);
		root.dataset.scene = 'loading';
		if (sceneCopy) sceneCopy.textContent = copy().loading;
		if (skip) {
			skip.textContent = copy().skip;
			skip.tabIndex = -1;
			skip.hidden = false;
			after(INTRO_CONFIG.skip.afterMs, () => { skip.tabIndex = 0; skip.classList.add('is-available'); });
		}
		beginAtmosphere();
		const loaded = await preload();
		if (disposed) return false;
		if (!loaded && progressLabel) progressLabel.textContent = copy().degraded;
		if (override === 'ready' || reduced && INTRO_CONFIG.reducedMotion.showReadyScreenImmediately) showReady();
		else await playSequence();
		return true;
	}
	if (skip) skip.addEventListener('click', skipSequence);
	if (enterSound) enterSound.addEventListener('click', () => enter(true));
	if (enterSilent) enterSilent.addEventListener('click', () => enter(false));
	window.addEventListener('keydown', (event) => {
		if (!started || disposed) return;
		if (INTRO_CONFIG.skip.keyboard.includes(event.key) && skip && skip.classList.contains('is-available')) { event.preventDefault(); skipSequence(); }
	});
	return Object.freeze({ start, dismiss: (reason, options = {}) => dispose(reason, !!options.immediate), get active() { return started && !disposed; } });
})();

if (!UrlState.requiresRgs() && !Replay.configured()) applyBetConfig({ ...DEV_BET_CONFIG, currency: state.currency }, { preferDefault: true });
applyLanguage();
if (Replay.configured()) {
	state.grid = [];
	board.innerHTML = '';
	setWin(0);
	setReplayLifecycle('loading');
} else {
	newGrid();
	paint();
}
updateMeters(); updateLocks();
// Start operational launch flows first. The cinematic is only visual and can
// never defer authentication, saved-round restoration, or replay loading.
resumeLaunchRound();
Intro.start();

// Scale the 1200x675 stage to fit any window so nothing (incl. the side
// panels) is ever cut off — including fullscreen and mobile.
function fitViewport() {
	const vw = document.documentElement.clientWidth || window.innerWidth;
	const vh = document.documentElement.clientHeight || window.innerHeight;
	const baseW = 1200;
	const baseH = 675;
	const aspect = baseW / baseH;
	const viewAspect = vw / Math.max(1, vh);
	// Portrait phones use a board-first fit: the 858px-wide board targets
	// ~94vw (capped at 460px on-screen) so symbols and controls stay playable,
	// instead of shrinking the whole 1200px desktop stage to the screen width.
	// Math.max(..., vw/baseW) guarantees the stage still covers the viewport
	// horizontally (no side letterboxing on wide portrait screens).
	const isPortraitMobile = vw <= 700 && vh > vw;
	const boardBaseW = 858;
	const s = isPortraitMobile
		? Math.max(Math.min(vw * 0.94, 460) / boardBaseW, vw / baseW)
		: (viewAspect < aspect ? vw / baseW : vh / baseH);
	const stageW = viewAspect > aspect ? Math.max(baseW, vw / s) : baseW;
	const stageH = viewAspect < aspect ? Math.max(baseH, vh / s) : baseH;
	state.scale = s;
	const stageEl = $('stage');
	if (stageEl) {
		stageEl.classList.toggle('mobile-portrait', isPortraitMobile);
		stageEl.style.width = stageW + 'px';
		stageEl.style.height = stageH + 'px';
		// Center the play area inside the extended stage: portrait grows the
		// stage downwards (y-shift re-centers board/HUD vertically), landscape
		// grows it to the right (x-shift re-centers horizontally). The bottom
		// control bar stays anchored to the real screen bottom. On portrait
		// phones the block sits slightly above center (0.38) so the board is
		// in the upper/middle area instead of behind a large empty sky.
		const yShiftFactor = isPortraitMobile ? 0.38 : 0.5;
		stageEl.style.setProperty('--stage-y-shift', Math.max(0, Math.round((stageH - baseH) * yShiftFactor)) + 'px');
		stageEl.style.setProperty('--stage-x-shift', Math.max(0, Math.round((stageW - baseW) / 2)) + 'px');
		stageEl.style.setProperty('--stage-inv-scale', String(1 / s));
		stageEl.style.setProperty('--stage-fit-transform', 'translate(-50%, -50%) scale(' + s + ')');
	}
}
let fitQueued = false;
function queueFit() { if (fitQueued) return; fitQueued = true; requestAnimationFrame(() => { fitQueued = false; fitViewport(); }); }
window.addEventListener('resize', queueFit);
window.addEventListener('orientationchange', queueFit);
document.addEventListener('fullscreenchange', queueFit);
document.addEventListener('webkitfullscreenchange', queueFit);
if (window.visualViewport) window.visualViewport.addEventListener('resize', queueFit);
fitViewport();
// re-fit shortly after load in case fonts/chrome settle the viewport late
setTimeout(fitViewport, 50);
setTimeout(fitViewport, 300);

// Production intentionally exposes no gameplay state or mutation functions.
// The E2E server replaces this inert marker in-memory with test-only
// instrumentation while serving QA; the generated/published HTML keeps only
// this comment and therefore has no raw-spin, demo-win, or state mutation API.
/*__STAKE_QA_RUNTIME_HOOK__*/
window.__ggrPaytable = Object.freeze(JSON.parse(JSON.stringify(PRODUCTION_PAYTABLE)));
window.__ggrBuild = '${frontendBuildId}';
console.log('Golden Goal Rush build', window.__ggrBuild);
window.__ggrReady = true;
</script>
</body>
</html>
`;

if (process.argv.includes('--check')) {
	let existing = '';
	try { existing = readFileSync(OUT, 'utf8'); } catch (error) {}
	if (existing !== html) {
		throw new Error(`Generated frontend is stale: run node ${BUILDER}`);
	}
	console.log('Generated frontend is current:', OUT);
} else {
	writeFileSync(OUT, html);
	console.log('Wrote', OUT);
}
