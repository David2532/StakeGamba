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
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Shared math config — the SAME numbers the RTP simulation (ggr-sim.mjs) measures.
import { SYMBOL_MATH, CONFIG } from './ggr-config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const COMPONENT = join(ROOT, 'src/components/GoldenGoalRushFinalPreview.svelte');
const OUT = join(ROOT, 'preview.html');

const source = readFileSync(COMPONENT, 'utf8');
const style = source.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '';

const A = 'src/assets/golden-goal-rush';
const HUD = `${A}/hud-extracted`;
const SPECIAL = `${A}/special`;
const AUDIO = `${A}/audio`;

const assets = {
	background: `${A}/slot-background.webp`,
	headerLogo: `${A}/logo-horizontal-tight.webp`,
	football: `${A}/fussball.webp`,
	euro: `${HUD}/euro-symbol.webp`,
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
	['BALANCE', 'balance', 'euro', 'meterPanelA'],
	['WIN', 'win', 'trophy', 'meterPanelB'],
	['BET', 'bet', 'euro', 'meterPanelC'],
];
const meterRows = meters
	.map(
		([label, id, icon, frame]) => `\t\t\t<div class="meter">
				<img class="panel-art" src="${assets[frame]}" alt="" />
				<img class="meter-asset-icon" src="${assets[icon]}" alt="" />
				<div><div class="meter-label">${label}</div><div class="meter-value" id="meter-${id}">0.00</div></div>
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

const extraCss = `
	/* ---- interactive demo layer ---- */
	.logo-wordmark {
		top: -4px;
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
	@keyframes stage-shake { 0%,100%{transform:translate(0,0);} 20%{transform:translate(-6px,2px);}
		40%{transform:translate(5px,-2px);} 60%{transform:translate(-4px,1px);} 80%{transform:translate(3px,-1px);} }
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

	/* ---- modals (menu / settings / info / bonus buy) ---- */
	.modal-backdrop { position:absolute; inset:0; z-index:60; display:none;
		align-items:center; justify-content:center; background:rgba(2,3,6,0.8);
		-webkit-backdrop-filter:blur(4px); backdrop-filter:blur(4px); }
	.modal-backdrop.open { display:flex; }
	.modal { position:relative; width:min(640px,92%); max-height:88%; display:flex; flex-direction:column;
		background:
			radial-gradient(125% 70% at 50% -12%, rgba(213,162,59,0.2), transparent 62%),
			linear-gradient(180deg,#17140c 0%,#0b0a07 55%,#050505 100%);
		border:2px solid #d5a23b; border-radius:18px; overflow:hidden;
		box-shadow:0 0 0 1px rgba(255,224,130,0.22) inset, 0 0 0 4px #050505,
			0 26px 62px rgba(0,0,0,0.82), 0 0 52px rgba(255,191,44,0.26);
		color:#f1e4c6; font-family:Inter,Arial,sans-serif; animation:modal-in .24s cubic-bezier(.2,.9,.3,1.3) both; }
	.modal::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; z-index:2;
		background:linear-gradient(90deg, transparent, #ffe49a 18%, #d5a23b 50%, #ffe49a 82%, transparent); }
	@keyframes modal-in { from { opacity:0; transform:translateY(16px) scale(0.96); } }
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
	.fs-counter { position:absolute; top:118px; left:50%; transform:translateX(-50%); z-index:15; display:none;
		padding:5px 24px 7px; border-radius:999px; border:2px solid #ffe49a; text-align:center;
		background:linear-gradient(180deg,#1c1305,#0a0a0f); box-shadow:0 0 18px rgba(255,200,60,0.5);
		color:#ffe49a; font-family:Inter,Arial,sans-serif; }
	.fs-counter.show { display:block; }
	.fs-counter .fs-name { font-size:11px; letter-spacing:2px; color:#ffd96f; }
	.fs-counter .fs-big { font-size:21px; font-weight:1000; color:#fff; line-height:1.1; }

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
	html, body { margin: 0; height: 100%; overflow: hidden; background: #05080f; }
	/* Centre explicitly with translate(-50%,-50%) rather than grid place-items,
	   which keeps centring identical across browsers (Firefox included) when the
	   stage is scaled up past the viewport size. */
	.viewport { position: absolute; top: 50%; left: 50%; width: 1200px; height: 675px; transform-origin: center center; }
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
			<button type="button" class="asset-button bonus" id="btn-bonus" aria-label="Buy Bonus">
				<img class="button-art" src="${assets.bonusButton}" alt="" />
			</button>
			<button type="button" class="asset-button" id="btn-auto" aria-label="Auto Spin">
				<img class="button-art" src="${assets.autoSpinButton}" alt="" />
			</button>
			<div class="feature-control" aria-label="Golden Goal Rush feature logic preview">
				<img class="button-art" src="${assets.featurePanel}" alt="" />
				<div class="feature-items">
${featureItems}
				</div>
			</div>
			<button type="button" class="spin-button" id="btn-spin" aria-label="Spin">
				<img class="spin-art" src="${assets.spinButton}" alt="" /><span>SPIN</span>
			</button>
			<button type="button" class="asset-button turbo" id="btn-turbo" aria-label="Turbo">
				<img class="button-art" src="${assets.turboButton}" alt="" />
			</button>
			<div class="bet-controls" id="bet-controls" aria-label="Bet controls">
				<img class="button-art" src="${assets.controlPanel}" alt="" />
				<button type="button" id="btn-bet-minus" aria-label="Decrease bet"><img src="${assets.minusButton}" alt="" /></button>
				<div class="bet-display"><span>BET</span><strong id="bet-display">1.00</strong></div>
				<button type="button" id="btn-bet-plus" aria-label="Increase bet"><img src="${assets.plusButton}" alt="" /></button>
			</div>
			<button type="button" class="icon-button info" id="btn-info" aria-label="Info"><img class="button-art" src="${assets.infoButton}" alt="" /></button>
			<button type="button" class="icon-button settings" id="btn-settings" aria-label="Settings"><img class="button-art" src="${assets.settingsButton}" alt="" /></button>
		</div>

		<!-- ===== Menu modal ===== -->
		<div class="modal-backdrop" id="modal-menu" data-modal>
			<div class="modal">
				<div class="modal-header"><div class="modal-title">MENU</div><button class="modal-close" data-close>&times;</button></div>
				<div class="modal-body">
					<button class="menu-item" data-open="modal-paytable"><span class="mi-ico">PT</span><span class="mi-text"><span class="mi-label">Pay Table</span><span class="mi-desc">Symbol payouts and cluster sizes</span></span><span class="mi-arrow">&rsaquo;</span></button>
					<button class="menu-item" data-open="modal-rules"><span class="mi-ico">?</span><span class="mi-text"><span class="mi-label">Rules &amp; Features</span><span class="mi-desc">Cluster wins, coins, multipliers and free spins</span></span><span class="mi-arrow">&rsaquo;</span></button>
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
				<div class="modal-header"><div class="modal-title">PAY TABLE</div><button class="modal-close" data-close>&times;</button></div>
				<div class="modal-body">
					<p class="pt-intro">Payouts are shown as bet multipliers. Wins start at <b>5 connected matching symbols</b>, and bigger clusters pay more.</p>
					<div class="pt-head">Symbol Pays <small>cluster 5+ &middot; 7+ &middot; 9+ &middot; 12+</small></div>
					<div class="pt-grid" id="pt-grid"></div>
					<div class="pt-note">All values are multiplied by the active bet. Wilds substitute for regular paying symbols but do not replace Scatters.</div>
				</div>
			</div>
		</div>

		<!-- ===== Rules and features modal ===== -->
		<div class="modal-backdrop" id="modal-rules" data-modal>
			<div class="modal">
				<div class="modal-header"><div class="modal-title">RULES &amp; FEATURES</div><button class="modal-close" data-close>&times;</button></div>
				<div class="modal-body">
					<p class="pt-intro">Golden Goal Rush is a 6&times;5 <b>cluster-pays</b> game. Land <b>5 or more matching symbols connected horizontally or vertically</b> to win. Winning symbols are removed and new ones cascade in; every cascade raises the win multiplier.</p>
					<div class="pt-head">Core Game</div>
					<div class="pt-feat"><img src="${SYMBOLS.wild.src}" alt="Wild" /><div><b>WILD</b>Substitutes for every paying symbol to help complete clusters. Does not replace the Scatter.</div></div>
					<div class="pt-feat"><img src="${SYMBOLS.scatter.src}" alt="Scatter" /><div><b>SCATTER &mdash; VIP TICKET</b>3, 4 or 5 trigger Free Spins Tier 1 / 2 / 3.</div></div>
					<div class="pt-feat"><div class="pt-chip"></div><div><b>GOLDEN CELLS</b>Every winning position turns into a Golden Cell for the rest of the spin sequence.</div></div>
					<div class="pt-head">Golden Goal Feature</div>
					<div class="pt-feat"><img src="${SYMBOLS.rainbow.src}" alt="Golden Arc" /><div><b>GOLDEN ARC (RAINBOW)</b>While an Arc is on the board it activates all Golden Cells, revealing Coins, Multiplier Badges and Collector Cups.</div></div>
					<div class="pt-feat"><img src="${COIN_ASSETS.gold}" alt="Coins" /><div><b>SPONSOR COINS</b>Bronze ${CONFIG.bronzeValues[0]}&ndash;${CONFIG.bronzeValues[CONFIG.bronzeValues.length-1]}&times;, Silver ${CONFIG.silverValues[0]}&ndash;${CONFIG.silverValues[CONFIG.silverValues.length-1]}&times;, Gold ${CONFIG.goldValues[0]}&ndash;${CONFIG.goldValues[CONFIG.goldValues.length-1]}&times; the bet.</div></div>
					<div class="pt-feat"><img src="${MULT_ASSETS[5]}" alt="Multiplier Badge" /><div><b>MULTIPLIER BADGE</b>Multiplies adjacent coins by ${CONFIG.multiplierValues.map((v) => 'x' + v).join(', ')}.</div></div>
					<div class="pt-feat"><img src="${COLLECTOR_ASSET}" alt="Collector Cup" /><div><b>COLLECTOR CUP</b>Collects the value of every visible coin (top-to-bottom, left-to-right). After the last cup the Golden Cells reveal again, repeating while new cups appear.</div></div>
					<div class="pt-head">Free Spins &amp; Bonus Buy</div>
					<div class="pt-feat"><img src="${SYMBOLS.scatter.src}" alt="Free Spins" /><div><b>FREE SPINS</b>
						${Object.entries(CONFIG.tiers).map(([t, v]) => 'Tier ' + t + ' &mdash; ' + v.name + ': ' + v.spins + ' spins' + (v.guaranteedRainbow ? ', guaranteed Arc each spin' : '') + '.').join('<br>')}</div></div>
					<div class="pt-feat"><img src="${assets.bonusButton}" alt="Bonus Buy" /><div><b>BONUS BUY</b>
						${CONFIG.bonusBuy.map((o) => o.label + ' &mdash; ' + o.mult + '&times; bet').join('<br>')}<br>Tier 3 (End of the Rainbow) can only trigger naturally.</div></div>
					<div class="pt-note">If the game is reloaded while a base-game round is still active, the round is immediately settled with Stake Engine and the result is available in game history. Active Bonus Buy bonus rounds resume from the saved round state with the purchased balance and bet preserved.</div>
					<div class="pt-note">RTP 96.45% &middot; Max win ${CONFIG.maxWinMultiplier.toLocaleString()}&times; bet &middot; All wins are a multiple of the bet. Malfunction voids all pays and plays.</div>
				</div>
			</div>
		</div>

		<!-- ===== Bonus Buy modal ===== -->
		<div class="modal-backdrop" id="modal-bonusbuy" data-modal>
			<div class="modal">
				<div class="modal-header"><div class="modal-title">BONUS BUY</div><button class="modal-close" data-close>&times;</button></div>
				<div class="modal-body">
					<div class="bonusbuy-hero"><img src="${assets.featureBanner}" alt="" /><div class="bonusbuy-title">Golden Goal Rush</div></div>
					<div class="bb-list" id="bonusbuy-list"></div>
					<div class="bb-note" id="bonusbuy-note"></div>
				</div>
			</div>
		</div>
	</section>
	</div>

<script>
const SYMBOLS = ${JSON.stringify(SYMBOLS)};
const COIN_ASSETS = ${JSON.stringify(COIN_ASSETS)};
const MULT_ASSETS = ${JSON.stringify(MULT_ASSETS)};
const COLLECTOR_ASSET = ${JSON.stringify(COLLECTOR_ASSET)};
const AUDIO_ASSETS = ${JSON.stringify(AUDIO_ASSETS)};
const CONFIG = ${JSON.stringify(CONFIG)};
const COLS = 6, ROWS = 5, MIN_CLUSTER = 5;
let BETS = [
	0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9,
	1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 7.5,
	10, 15, 20, 25, 30, 40, 50, 75,
	100, 150, 200, 250, 300, 500, 750,
	1000, 1500, 2000, 2500, 5000, 7500, 10000,
];
const API_AMOUNT_MULTIPLIER = 1000000;
const DEFAULT_CURRENCY = 'EUR';
const USE_RGS_STATE_RENDERER = false;
const USE_SAFE_RGS_BASE_RENDERER = true;

const state = {
	balance: 1000, bet: 1, betIdx: 9, currency: DEFAULT_CURRENCY, grid: [], spinning: false, walletBusy: false, turbo: false, auto: false,
	golden: new Set(), reveals: new Map(), // golden = 'c,r' keys; reveals = 'c,r' -> {kind,value,asset}
	mode: 'base', tier: 0, fsLeft: 0, fsTotal: 0, win: 0, sound: true, musicVolume: 100, sfxVolume: 100,
	skipRequested: false, walletBalanceDeferred: false, pendingWalletBalance: null,
	fatal: false,
};

const $ = (id) => document.getElementById(id);
const board = $('board');
const stage = $('stage');
let spinSeq = 0;
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
const ck = (c, r) => c + ',' + r;
const apiAmountToMoney = (amount) => Math.round(((Number(amount) || 0) / API_AMOUNT_MULTIPLIER) * 100) / 100;
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
		currency: () => (get('currency') || DEFAULT_CURRENCY).toUpperCase(),
		device: () => get('device', 'deviceType').toLowerCase(),
		replay: () => get('replay') === 'true',
		debug: () => get('debug', 'rgs_debug') === 'true',
		hasLaunchParam,
		requiresRgs: () => hostRequiresRgs() || hasAnyRgsParam(),
	};
})();

const initialLaunchUrl = window.location.href;
function fatalError(title, detail = '') {
	state.fatal = true;
	stopAutoSpin();
	state.spinning = false;
	state.walletBusy = false;
	clearSkip();
	closeModals();
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
	overlay.querySelector('.fatal-error-detail').textContent = detail || 'Please relaunch the game from Stake Engine.';
	overlay.classList.add('show');
	overlay.setAttribute('aria-hidden', 'false');
	console.error('[GGR fatal]', { title, detail });
}
function validateLaunchUrl() {
	if (!UrlState.requiresRgs()) return true;
	if (UrlState.replay()) {
		// This build does not implement replay rendering. A manipulated launch
		// URL with replay=true must NOT silently fall back to the local demo.
		fatalError('Invalid game launch', 'The game URL contains unsupported launch parameters. Please relaunch the game from Stake Engine.');
		return false;
	}
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
		fatalError('Invalid game launch', 'The game URL is missing or has invalid Stake Engine launch parameters: ' + missing.join(', ') + '. Please relaunch the game.');
		return false;
	}
	return true;
}
function checkLaunchUrlIntegrity() {
	if (!UrlState.requiresRgs()) return;
	if (window.location.href !== initialLaunchUrl) {
		fatalError('Game launch URL changed', 'The launch URL changed after the game started. Please relaunch the game from Stake Engine.');
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
	const toApiAmount = (amount) => Math.round((Number(amount) || 0) * API_AMOUNT_MULTIPLIER);
	const fromApiAmount = (amount) => Math.round(((Number(amount) || 0) / API_AMOUNT_MULTIPLIER) * 100) / 100;
	const syncBetLevels = (config) => {
		const levels = (config && Array.isArray(config.betLevels) ? config.betLevels : [])
			.map(fromApiAmount)
			.filter((v) => Number.isFinite(v) && v > 0);
		if (!levels.length) return;
		BETS = [...new Set(levels)].sort((a, b) => a - b);
		const current = Number(state.bet) || BETS[0];
		let idx = 0;
		let best = Infinity;
		for (let i = 0; i < BETS.length; i += 1) {
			const diff = Math.abs(BETS[i] - current);
			if (diff < best) { best = diff; idx = i; }
		}
		state.betIdx = idx;
		state.bet = BETS[idx];
		updateMeters();
	};
	const normalizeBet = (amount) => {
		const config = walletConfig || {};
		const levels = Array.isArray(config.betLevels) ? config.betLevels : [];
		if (levels.length) {
			const requested = toApiAmount(amount);
			let selected = levels[0];
			let best = Math.abs(levels[0] - requested);
			for (const level of levels) {
				const diff = Math.abs(level - requested);
				if (diff < best) { best = diff; selected = level; }
			}
			const normalized = fromApiAmount(selected);
			if (normalized !== state.bet) {
				const idx = BETS.findIndex((v) => Math.abs(v - normalized) < 0.000001);
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
			if (data.config.betModes) availableModes = Object.keys(data.config.betModes);
			syncBetLevels(data.config);
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
			fatalError('Stake Engine connection error', 'The game launch session is invalid or expired. Please relaunch the game from Stake Engine.');
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
				fatalError('Stake Engine connection error', 'The game could not authenticate with Stake Engine. Please relaunch the game.');
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
	const spinId = ++spinSeq;
	const events = normalizeRgsEvents(round.state);
	const startIndex = rgsResumeIndex(round);
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
			fatalError('Stake Engine settlement failed', 'The resumed bonus round could not be settled. Please relaunch the game.');
			return;
		}
		if (walletBalanceAfterEndRound) state.balance = walletBalanceAfterEndRound.amount;
		else if (displayedWin > 0) state.balance = roundMoney(state.balance + displayedWin);
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
	POOL = buildPool(opts);
	state.grid = Array.from({ length: COLS }, () => Array.from({ length: ROWS }, randKey));
	if (opts.forceRainbow && !state.grid.flat().includes('rainbow')) {
		state.grid[(Math.random() * COLS) | 0][(Math.random() * ROWS) | 0] = 'rainbow';
	}
	for (let i = 0; i < (opts.forceScatters || 0); i += 1) {
		state.grid[i % COLS][(i / COLS) | 0] = 'scatter';
	}
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
	const raw = Number(round && round.payout);
	if (Number.isFinite(raw)) return Math.abs(raw) >= 1000 ? apiAmountToMoney(raw) : roundMoney(raw);
	const mult = Number(round && round.payoutMultiplier);
	if (!Number.isFinite(mult)) return null;
	return roundMoney((mult > 1000 ? mult / 100 : mult) * state.bet);
}
function bookAmountToMoney(amount) {
	return roundMoney((Number(amount) || 0) * state.bet / 100);
}
function finalBookWinMoney(events) {
	const final = [...events].reverse().find((event) => event && event.type === 'finalWin');
	return final ? bookAmountToMoney(final.amount) : 0;
}
function rgsDisplayWinMoney(round, events) {
	const stateFinal = finalBookWinMoney(events);
	const walletPayout = rgsRoundPayoutMoney(round);
	// Stake wallet payout is authoritative whenever it is positive. Active
	// rounds can still carry a payout in /wallet/play, and showing a smaller
	// book finalWin makes the UI look disconnected from the RGS payload.
	if (walletPayout !== null && walletPayout > 0) return walletPayout;
	// During active rounds, round.payout can still be 0 until /wallet/end-round;
	// then the RGS book finalWin is the best display source.
	if (round && round.active === true && stateFinal > 0) return stateFinal;
	return walletPayout !== null ? walletPayout : stateFinal;
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
	return {
		hasFreeSpinTrigger,
		hasUpdateFreeSpin,
		hasFreeSpinEnd,
		hasCompleteRgsFeature,
		hasConfirmedFreeSpinFeature,
		finalWin: final ? Number(final.amount) || 0 : 0,
		willStartVisualFeature: hasConfirmedFreeSpinFeature,
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
	return Rgs.configured() && list.some((event) => event && event.type === 'reveal' && event.board);
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
	Sound.stopFreeSpins();
}
async function renderRgsWinInfo(event, runningWin, stepOverride = null) {
	const wins = Array.isArray(event.wins) ? event.wins : [];
	const cells = rgsCellsFromPositions(wins.flatMap((win) => win.positions || []));
	const eventStepWin = bookAmountToMoney(event.totalWin || wins.reduce((sum, win) => sum + (Number(win.win) || 0), 0));
	const stepWin = stepOverride !== null ? Math.max(0, roundMoney(stepOverride)) : eventStepWin;
	const targetWin = roundMoney(runningWin + stepWin);
	if (cells.length) {
		stage.classList.add('win-focus');
		cells.forEach(([c, r]) => {
			state.golden.add(ck(c, r));
			const el = cellEl(c, r);
			if (el) el.classList.add('win');
		});
		Sound.cluster(Math.max(1, wins.length));
		showClusterFloat(stepWin, cells);
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
	const winInfoCount = events.filter((event) => event && event.type === 'winInfo').length;
	const hasRgsAwardEvents = events.some((event) => event && event.type === 'goldenAward');
	const startIndex = Math.max(0, Number(options.startIndex) || 0);
	const skipBonusIntro = !!options.skipBonusIntro;
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
			const stepOverride = hasAuthoritativePayout && expected > 0 && winInfoCount === 1
				&& !hasRgsAwardEvents
				? Math.max(0, roundMoney(expected - runningWin))
				: null;
			runningWin = await renderRgsWinInfo(event, runningWin, stepOverride);
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
			await bonusSummary(total, state.fsTotal || 0, total);
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
function showClusterFloat(amount, cells) {
	if (!amount || !cells || !cells.length) return;
	const layer = $('fx-layer') || stage;
	const pos = clusterCenter(cells); if (!layer || !pos) return;
	const el = document.createElement('div');
	el.className = 'cluster-float';
	el.textContent = '+' + fmt(amount);
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
		if (music) { music.pause(); music.currentTime = 0; }
		if (freeSpinRoar) { try { freeSpinRoar.pause(); freeSpinRoar.currentTime = 0; } catch (e) {} }
		reelEndPool.forEach((a) => { try { a.pause(); a.currentTime = 0; } catch (e) {} });
		pingPool.forEach((a) => { try { a.pause(); a.currentTime = 0; } catch (e) {} });
		scatterPool.forEach((a) => { try { a.pause(); a.currentTime = 0; } catch (e) {} });
		clusterBurstPool.forEach((a) => { try { a.pause(); a.currentTime = 0; } catch (e) {} });
		if (rainbowReveal) { try { rainbowReveal.pause(); rainbowReveal.currentTime = 0; } catch (e) {} }
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
		for (let i = 0; i < n; i += 1) setTimeout(pingOnce, i * 85 * TF());
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
		for (let i = 0; i < n; i += 1) setTimeout(scatterOnce, i * 95 * TF());
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
		for (let i = 0; i < n; i += 1) setTimeout(clusterBurstOnce, baseDelay + i * 70 * TF());
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
	$('meter-balance').textContent = fmt(state.balance);
	$('meter-bet').textContent = fmt(state.bet);
	$('bet-display').textContent = fmt(state.bet);
	$('bet-controls').classList.toggle('low', state.betIdx === 0);
}

function findClusters() {
	const seen = Array.from({ length: COLS }, () => Array(ROWS).fill(false));
	const clusters = [];
	for (let c = 0; c < COLS; c += 1) for (let r = 0; r < ROWS; r += 1) {
		const key = state.grid[c][r];
		if (seen[c][r] || SYMBOLS[key].wild || SYMBOLS[key].scatter) continue;
		const stack = [[c, r]]; const cells = []; seen[c][r] = true;
		while (stack.length) {
			const [cc, rr] = stack.pop(); cells.push([cc, rr]);
			for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
				const nc = cc + dc, nr = rr + dr;
				if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS || seen[nc][nr]) continue;
				if (symbolsConnect(key, state.grid[nc][nr])) { seen[nc][nr] = true; stack.push([nc, nr]); }
			}
		}
		if (cells.length >= MIN_CLUSTER) clusters.push({ key, cells });
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
	const n = Number(text.replace(/,/g, ''));
	return Number.isFinite(n) ? n : 0;
}
async function countUp(amount, from = meterWinValue()) {
	const el = $('meter-win');
	const steps = countUpSteps(); let i = 0;
	const target = Math.min(amount, capWin());
	if (state.skipRequested || Math.abs(target - from) < 0.000001) { el.textContent = fmt(target); return; }
	return new Promise((resolve) => {
		const t = setInterval(() => {
			if (state.skipRequested) {
				clearInterval(t);
				el.textContent = fmt(target);
				resolve();
				return;
			}
			i += 1; el.textContent = fmt(from + ((target - from) * i) / steps); Sound.tick(i, steps);
			if (i >= steps) { clearInterval(t); el.textContent = fmt(target); resolve(); }
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
	for (let i = 1; i <= steps; i += 1) { amt.textContent = fmt((amount * i) / steps); await wait(x >= 100 ? 38 : 28); }
	await wait(lv.hold); b.classList.remove('show', lv.tier);
}

const capWin = () => CONFIG.maxWinMultiplier * state.bet;
const setWin = (abs, render = true) => {
	state.win = Math.min(abs, capWin());
	if (render) $('meter-win').textContent = fmt(state.win);
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
	let multiplier = 1;
	let cascade = 0;
	while (state.win < capWin()) {
		const clusters = findClusters();
		if (!clusters.length) break;
		cascade += 1;
		const flat = clusters.flatMap((cl) => cl.cells);
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
function stopAutoSpin() {
	state.auto = false;
	const btn = $('btn-auto');
	if (btn) btn.classList.remove('armed');
}
function setWalletBusy(busy) {
	state.walletBusy = !!busy;
	const spinBtn = $('btn-spin');
	if (spinBtn) spinBtn.classList.toggle('busy', state.spinning || state.walletBusy);
	updateLocks();
}
async function spin(buy, internalFreeSpin = false) {
	if (state.fatal) return;
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
		stage.classList.add('shake'); setTimeout(() => stage.classList.remove('shake'), 420); return;
	}
	const paidRound = state.mode !== 'free';
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
			fatalError('Stake Engine request failed', 'The game could not start a wallet round. Please relaunch the game from Stake Engine.');
			if (paidRound) setWalletBusy(false);
			$('btn-spin').classList.remove('busy'); state.spinning = false; clearSkip();
			updateMeters();
			return;
		}
		walletManaged = !!rgsPlay;
		roundNeedsEnd = !!(rgsPlay && rgsPlay.__needsEndRound);
		const rgsEvents = normalizeRgsEvents(rgsPlay && rgsPlay.round && rgsPlay.round.state);
		const renderSafeRgsBase = Rgs.configured() && rgsPlay && shouldRenderSafeRgsBase(rgsEvents);
		const renderRgsRound = Rgs.configured() && rgsPlay && shouldRenderRgsRound(rgsEvents);
		if ((USE_RGS_STATE_RENDERER || renderSafeRgsBase || renderRgsRound) && Rgs.configured() && rgsPlay) {
			state.balance = roundMoney(state.balance - cost);
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
					fatalError('Stake Engine settlement failed', 'The round could not be settled with Stake Engine. Please relaunch the game.');
					setWalletBusy(false);
					updateMeters();
					$('btn-spin').classList.remove('busy'); state.spinning = false; clearSkip();
					return;
				}
			}
			if (walletBalanceAfterEndRound) state.balance = walletBalanceAfterEndRound.amount;
			else if (walletBalanceAfterPlay) state.balance = walletBalanceAfterPlay.amount;
			else state.balance = roundMoney(balanceBefore - cost + displayedWin);
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
			if (state.mode === 'base' && state.auto) setTimeout(() => { if (!state.walletBusy && !Rgs.busy()) spin(); }, state.turbo ? 250 : 600);
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
					fatalError('Stake Engine settlement failed', 'The round could not be settled after an unsupported RGS state. Please relaunch the game.');
					setWalletBusy(false);
					$('btn-spin').classList.remove('busy'); state.spinning = false; clearSkip();
					updateMeters();
					return;
				}
			}
			Rgs.setBalanceDeferred(false);
			if (walletBalanceAfterEndRound) state.balance = walletBalanceAfterEndRound.amount;
			else if (walletBalanceAfterPlay) state.balance = walletBalanceAfterPlay.amount;
			fatalError('Unsupported Stake Engine round', 'The game received a RGS round state it cannot display safely. No local fallback was used.');
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
		$('meter-win').textContent = fmt(state.fsWin); // WIN shows the running bonus total
	} else {
		if (rgsVisualSync && walletBalanceAfterPlay && !rgsRoundActive) state.balance = walletBalanceAfterPlay.amount;
		else if (!rgsVisualSync || !rgsRoundActive) state.balance = roundMoney(state.balance + state.win);
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
		await Rgs.endRound({ spinId });
		walletBalanceAfterEndRound = Rgs.consumePendingBalance();
		Rgs.setBalanceDeferred(false);
		if (rgsVisualSync && walletBalanceAfterEndRound) {
			const walletWin = Math.max(0, roundMoney(walletBalanceAfterEndRound.amount - balanceAfterBet));
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
	if (state.mode === 'base' && state.auto && !triggered) setTimeout(() => { if (!state.walletBusy && !Rgs.busy()) spin(); }, state.turbo ? 250 : 600);
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
	const lock = state.mode === 'free' || state.walletBusy;
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
function bonusSummary(total, spins, best) {
	return new Promise((resolve) => {
		const el = $('bonus-summary'); const btn = $('bs-continue');
		$('bs-total').textContent = '0.00'; $('bs-spins').textContent = spins; $('bs-best').textContent = fmt(best);
		el.classList.add('show');
		const lv = winLevel(total / state.bet);
		Sound.win(lv ? lv.tier : 'big'); coinShower(lv && lv.coins ? lv.coins : 22);
		const steps = 30; let i = 0;
		const cnt = setInterval(() => { i += 1; $('bs-total').textContent = fmt(total * i / steps); Sound.tick(i, steps); if (i >= steps) { clearInterval(cnt); $('bs-total').textContent = fmt(total); } }, 40);
		let closed = false;
		const close = () => { if (closed) return; closed = true; clearInterval(cnt); $('bs-total').textContent = fmt(total); el.classList.remove('show'); btn.onclick = null; resolve(); };
		btn.onclick = close;
		setTimeout(close, state.turbo ? 2600 : 8000); // fallback so auto-play / tests never hang
	});
}
async function startFreeSpins(tier, walletManaged = false) {
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
	state.balance = roundMoney(state.balance + won);
	updateMeters(); updateFsCounter();
	setBonusMode(false);
	await bonusSummary(won, state.fsPlayed, state.fsBest || 0);
}

function changeBet(dir) {
	if (state.fatal || state.spinning || state.walletBusy || state.mode === 'free') return; // bet locked during active paid/free rounds
	state.betIdx = Math.max(0, Math.min(BETS.length - 1, state.betIdx + dir));
	state.bet = BETS[state.betIdx]; updateMeters();
}

$('btn-spin').addEventListener('click', () => spin());
$('btn-bet-minus').addEventListener('click', () => changeBet(-1));
$('btn-bet-plus').addEventListener('click', () => changeBet(1));
$('btn-turbo').addEventListener('click', () => setTurbo(!state.turbo));
$('btn-auto').addEventListener('click', () => {
	if (state.fatal) return;
	state.auto = !state.auto; $('btn-auto').classList.toggle('armed', state.auto);
	if (state.auto && !state.spinning && !state.walletBusy && !Rgs.busy()) spin();
});
// ---- bonus buy ----
const BB_META = {
	hunt: { asset: MULT_ASSETS[5], accent: '#cf9b3f', tag: 'Boost' },
	rainbow: { asset: SYMBOLS.rainbow.src, accent: '#7d5cff', tag: 'Arc' },
	tier1: { asset: SYMBOLS.scatter.src, accent: '#e7b84e', tag: '8 Spins' },
	tier2: { asset: COLLECTOR_ASSET, accent: '#ffd24a', tag: '12 Spins' },
};
function buildBonusBuy() {
	const wrap = $('bonusbuy-list');
	let anyDisabled = false;
	wrap.innerHTML = CONFIG.bonusBuy.map((o) => {
		const price = Math.round(o.mult * state.bet * 100) / 100;
		const afford = state.balance >= price; if (!afford) anyDisabled = true;
		const m = BB_META[o.id] || { asset: SYMBOLS.football.src, accent: '#d5a23b', tag: 'Bonus' };
		return '<button class="bb-opt' + (afford ? '' : ' disabled') + '" data-buy="' + o.id + '" style="--bb-accent:' + m.accent + '"' + (afford ? '' : ' disabled') + '>' +
			'<span class="bb-ico"><img src="' + m.asset + '" alt="" /></span>' +
			'<div class="bb-text"><div class="bb-name">' + o.label + '</div><div class="bb-desc">' + o.desc + '</div><div class="bb-tag">' + m.tag + '</div></div>' +
			'<div class="bb-price">' + fmt(price) + '</div></button>';
	}).join('');
	$('bonusbuy-note').textContent = anyDisabled ? 'Greyed options exceed your balance. Tier 3 can only trigger naturally.' : 'Prices scale with your current bet. Tier 3 can only trigger naturally.';
	wrap.querySelectorAll('[data-buy]').forEach((btn) => btn.addEventListener('click', () => {
		const o = CONFIG.bonusBuy.find((x) => x.id === btn.dataset.buy);
		const price = Math.round(o.mult * state.bet * 100) / 100;
		if (state.balance < price) return;
		showBuyConfirm(o, price);
	}));
}
// Confirm/Cancel before a purchase, with a plain-language description of what
// the player gets, so Bonus Buy never jumps straight into spins.
function showBuyConfirm(o, price) {
	const what = o.id === 'tier1' ? CONFIG.tiers[1].spins + ' Free Spins · Tier 1'
		: o.id === 'tier2' ? CONFIG.tiers[2].spins + ' Free Spins · Tier 2'
		: o.id === 'rainbow' ? 'one spin with a guaranteed Golden Arc'
		: 'one spin with boosted feature chance';
	$('bonusbuy-list').innerHTML = '<div class="bb-confirm">'
		+ '<div class="c-q">Buy <b>' + o.label + '</b><br>(' + what + ')<br>for <b>&#9917; ' + fmt(price) + '</b>?</div>'
		+ '<div class="c-row"><button class="c-no" id="bb-cancel">Cancel</button><button class="c-yes" id="bb-confirm">Confirm</button></div></div>';
	$('bonusbuy-note').textContent = 'Balance after purchase: ' + fmt(Math.max(0, Math.round((state.balance - price) * 100) / 100));
	$('bb-cancel').onclick = () => buildBonusBuy();
	$('bb-confirm').onclick = async () => {
		const confirmBtn = $('bb-confirm');
		if (confirmBtn && confirmBtn.disabled) return;
		if (confirmBtn) confirmBtn.disabled = true;
		if (state.balance < price) { buildBonusBuy(); return; }
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
					fatalError('Stake Engine request failed', 'The bonus buy could not start a wallet round. Please relaunch the game from Stake Engine.');
					return;
				}
				const walletManaged = !!rgsPlay;
				const roundNeedsEnd = !!(rgsPlay && rgsPlay.__needsEndRound);
				if (walletBalanceAfterPlay) state.balance = walletBalanceAfterPlay.amount;
				else state.balance = roundMoney(state.balance - price);
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
					if (!shouldRenderRgsRound(rgsEvents)) {
						if (roundNeedsEnd) {
							const endRoundResult = await Rgs.endRound({ spinId: purchaseSpinId, recovery: 'unrenderable-bonus-buy' });
							if (endRoundResult && endRoundResult.blocked) {
								fatalError('Stake Engine settlement failed', 'The unsupported bonus buy round could not be settled. Please relaunch the game.');
								return;
							}
						}
						fatalError('Unsupported Stake Engine round', 'The bonus buy returned a RGS round state the game cannot display safely. No local fallback was used.');
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
							fatalError('Stake Engine settlement failed', 'The bonus buy round could not be settled. Please relaunch the game.');
							return;
						}
					}
					if (walletBalanceAfterEndRound) state.balance = walletBalanceAfterEndRound.amount;
					else if (walletBalanceAfterPlay) state.balance = walletBalanceAfterPlay.amount;
					else if (displayedWin > 0) state.balance = roundMoney(state.balance + displayedWin);
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
$('btn-bonus').addEventListener('click', () => { if (!state.fatal && !state.spinning && !state.walletBusy && state.mode === 'base') { buildBonusBuy(); openModal('modal-bonusbuy'); } });
window.addEventListener('keydown', (e) => { if (e.code === 'Space') { e.preventDefault(); spin(); } });

// ---- modals: open / close ----
function openModal(id) { document.querySelectorAll('[data-modal]').forEach((m) => m.classList.remove('open')); const el = document.getElementById(id); if (el) el.classList.add('open'); }
function closeModals() { document.querySelectorAll('[data-modal]').forEach((m) => m.classList.remove('open')); }
$('btn-menu').addEventListener('click', () => openModal('modal-menu'));
$('btn-settings').addEventListener('click', () => openModal('modal-settings'));
$('btn-info').addEventListener('click', () => openModal('modal-rules'));
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeModals));
document.querySelectorAll('[data-modal]').forEach((m) => m.addEventListener('click', (e) => { if (e.target === m) closeModals(); }));
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
		const s = SYMBOLS[key]; const p5 = s.pay, p7 = s.pay * 2, p9 = s.pay * 4, p12 = s.pay * 8;
		const f = (n) => (n >= 1 ? n.toFixed(n % 1 ? 1 : 0) : n.toFixed(2));
		return '<div class="pt-cell"><img src="' + s.src + '" alt="' + key + '" />' +
			'<div class="pt-pays"><b>12+</b> ' + f(p12) + '× &nbsp; <b>9+</b> ' + f(p9) + '×<br>' +
			'<b>7+</b> ' + f(p7) + '× &nbsp; <b>5+</b> ' + f(p5) + '×</div></div>';
	}).join('');
})();

newGrid(); paint(); updateMeters(); updateLocks();
resumeLaunchRound();

// Scale the 1200x675 stage to fit any window so nothing (incl. the side
// panels) is ever cut off — including fullscreen and mobile.
function fitViewport() {
	// clientWidth/Height exclude scrollbars and track fullscreen reliably;
	// fall back to innerWidth/Height. Take min so the whole stage always fits.
	const vw = document.documentElement.clientWidth || window.innerWidth;
	const vh = document.documentElement.clientHeight || window.innerHeight;
	const s = Math.min(vw / 1200, vh / 675);
	state.scale = s;
	const vp = document.querySelector('.viewport');
	if (vp) vp.style.transform = 'translate(-50%, -50%) scale(' + s + ')';
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

// Lightweight preview API — lets you trigger a guaranteed win to preview the
// cluster/cascade/win-banner presentation (open console: __ggr.demoWin()).
window.__ggr = {
	state, spin, startFreeSpins, buildBonusBuy, CONFIG,
	setGrid: (g) => { state.grid = g; paint(); },
	demoWin: async () => {
		if (state.spinning) return;
		state.spinning = true; $('btn-spin').classList.add('busy');
		state.golden.clear(); state.reveals.clear(); setWin(0);
		newGrid({ noRainbow: true });
		for (let c = 0; c < 4; c += 1) for (let r = 0; r < 3; r += 1) state.grid[c][r] = 'football';
		paint({ drops: fullDropMap() });
		await wait(420);
		const base = await resolveCascades();
		state.balance += state.win; updateMeters();
		state.golden.clear(); state.reveals.clear(); paint();
		$('btn-spin').classList.remove('busy'); state.spinning = false;
		return base;
	},
	// Golden cells + Rainbow -> full coin feature (coins, multipliers, collector).
	demoFeature: async () => {
		if (state.spinning) return;
		state.spinning = true; $('btn-spin').classList.add('busy');
		state.golden.clear(); state.reveals.clear(); setWin(0);
		newGrid({ noRainbow: true });
		for (let c = 0; c < 5; c += 1) for (let r = 0; r < 3; r += 1) state.grid[c][r] = 'football';
		state.grid[5][4] = 'rainbow';
		paint({ drops: fullDropMap() }); await wait(420);
		const base = await resolveCascades();
		let fw = 0;
		if (state.golden.size) fw = await runFeature(base);
		setWin(base + fw); state.balance += state.win; updateMeters();
		const goldenCount = state.golden.size;
		state.golden.clear(); state.reveals.clear(); paint();
		$('btn-spin').classList.remove('busy'); state.spinning = false;
		return { base, featureWin: fw, goldenCount, win: state.win };
	},
};
window.__ggrBuild = '${new Date().toISOString()}';
console.log('Golden Goal Rush build', window.__ggrBuild);
window.__ggrReady = true;
</script>
</body>
</html>
`;

writeFileSync(OUT, html);
console.log('Wrote', OUT);
