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

const assets = {
	background: `${A}/slot-background.png`,
	football: `${A}/fussball.png`,
	coin: `${SPECIAL}/coin_1x.png`,
	collector: `${SPECIAL}/symbol_collector.png`,
	multiplier: `${SPECIAL}/symbol_multiplier.png`,
	trophy: `${A}/pokal.png`,
	meterPanelA: `${HUD}/meter-panel-a.png`,
	meterPanelB: `${HUD}/meter-panel-b.png`,
	meterPanelC: `${HUD}/meter-panel-c.png`,
	controlPanel: `${HUD}/control-panel-wide.png`,
	featurePanel: `${HUD}/feature-panel.png`,
	menuButton: `${HUD}/menu-button.png`,
	bonusButton: `${HUD}/bonus-button.png`,
	autoSpinButton: `${HUD}/autospin-button.png`,
	turboButton: `${HUD}/turbo-button.png`,
	spinButton: `${HUD}/spin-button-active.png`,
	minusButton: `${HUD}/minus-button.png`,
	plusButton: `${HUD}/plus-button.png`,
	infoButton: `${HUD}/info-button.png`,
	settingsButton: `${HUD}/settings-button.png`,
};

// Symbol pool for the demo engine. `pay` = base multiple for a 5-cluster.
// Build the render symbol map from the shared math (weights/pays) + asset src.
const SYMBOL_SRC = {
	ten: { src: `${A}/10.png` }, j: { src: `${A}/j.png` }, q: { src: `${A}/q.png` },
	k: { src: `${A}/k.png` }, a: { src: `${A}/a.png` },
	football: { src: `${A}/fussball.png`, cls: 'feature' }, whistle: { src: `${A}/pfeife.png`, cls: 'feature' },
	trophy: { src: `${A}/pokal.png` }, jersey: { src: `${A}/trikot.png`, cls: 'wide' },
	wild: { src: `${A}/wild.png`, cls: 'feature' }, scatter: { src: `${A}/scatter.png`, cls: 'wide' },
	rainbow: { src: `${SPECIAL}/symbol_rainbow.png`, cls: 'feature' },
};
const SYMBOLS = Object.fromEntries(Object.entries(SYMBOL_MATH).map(([k, m]) => [k, { ...m, ...SYMBOL_SRC[k] }]));

// Coin medals (tier color) + a value label render on top; multiplier badge / collector.
const COIN_ASSETS = {
	bronze: `${SPECIAL}/bronze.png`, silver: `${SPECIAL}/silber.png`, gold: `${SPECIAL}/gold.png`,
};
const MULT_ASSETS = {
	2: `${SPECIAL}/x2.png`, 3: `${SPECIAL}/x3.png`, 4: `${SPECIAL}/x4.png`,
	5: `${SPECIAL}/x5.png`, 10: `${SPECIAL}/x10.png`,
};
const COLLECTOR_ASSET = `${SPECIAL}/symbol_collector.png`;
// CONFIG is imported from ggr-config.mjs (shared with the RTP simulation).

const meters = [
	['BALANCE', 'balance', 'coin', 'meterPanelA'],
	['WIN', 'win', 'trophy', 'meterPanelB'],
	['BET', 'bet', 'coin', 'meterPanelC'],
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
	.cell.win img { animation: win-pop 0.5s ease-in-out infinite; filter:
		drop-shadow(0 0 10px rgba(255,221,90,0.95)) drop-shadow(0 0 18px rgba(255,200,60,0.7)); }
	.cell.win::after { content:''; position:absolute; inset:0; border-radius:6px;
		background: radial-gradient(circle, rgba(255,224,120,0.35), transparent 68%); pointer-events:none; }
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
	/* a winning position briefly burns gold as it converts to a Golden Cell */
	.cell.converting::after { content:''; position:absolute; inset:0; border-radius:6px; z-index:3; pointer-events:none;
		background: radial-gradient(circle, rgba(255,242,175,0.95), rgba(255,200,60,0.45) 48%, transparent 72%);
		animation: golden-convert 0.5s ease-out forwards; }
	@keyframes golden-convert { 0%{ opacity:0; transform:scale(0.4);} 32%{opacity:1; transform:scale(1.12);} 100%{opacity:0; transform:scale(1.3);} }
	/* Busy state: dim slightly, no rotation (per request the spin button must
	   not spin while the reels are spinning). */
	.spin-button.busy { pointer-events: none; filter: saturate(0.85) brightness(0.82); }
	.spin-button.busy .spin-art { animation: none; }
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
		transition:background .15s, border-color .15s, transform .2s; }
	.modal-close:hover { border-color:#ffe49a; background:linear-gradient(180deg,#3a2c0e,#1a1407); transform:rotate(90deg); }
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
	.menu-item .mi-ico { font-size:18px; width:38px; height:38px; flex:0 0 auto; display:grid; place-items:center;
		border-radius:50%; border:1px solid rgba(255,224,130,0.5);
		background:radial-gradient(circle at 50% 30%, rgba(255,224,130,0.28), rgba(10,10,15,0.92));
		box-shadow:0 0 10px rgba(255,200,60,0.22) inset; }
	.menu-item .mi-label { flex:1 1 auto; }
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
	.toggle { width:54px; height:28px; border-radius:16px; cursor:pointer; position:relative; flex:0 0 auto;
		border:2px solid #7a5a1c; background:#15130d; transition:background .18s, border-color .18s; }
	.toggle::after { content:''; position:absolute; top:2px; left:2px; width:20px; height:20px;
		border-radius:50%; background:linear-gradient(180deg,#cfcfcf,#888); transition:left .18s; }
	.toggle.on { background:linear-gradient(180deg,#2f7335,#14491f); border-color:#3fae57; }
	.toggle.on::after { left:26px; background:linear-gradient(180deg,#fff3bd,#e7b84e); }
	.set-vol { display:flex; align-items:center; gap:12px; }
	.set-slider { width:150px; accent-color:#e7b84e; }
	.set-vol-val { font-size:13px; font-weight:800; color:#ffd96f; min-width:32px; text-align:right; }
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
	.reveal { position:absolute; inset:0; display:grid; place-items:center; z-index:2;
		animation:reveal-pop 0.34s cubic-bezier(.2,.9,.3,1.5) both; }
	.reveal img { position:relative; inset:auto; width:88%; height:88%; padding:0; object-fit:contain; filter:drop-shadow(0 3px 5px #000); }
	.reveal .coin-val { position:absolute; bottom:5%; left:0; right:0; text-align:center;
		font-family:'Arial Black',Impact,sans-serif; font-size:15px; font-weight:1000; color:#fff;
		text-shadow:0 1px 0 #000,0 0 6px #ffcf5a; -webkit-text-stroke:1px #5a2500; }
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
	.bb-list { display:flex; flex-direction:column; gap:11px; }
	.bb-opt { display:flex; align-items:center; gap:14px; width:100%; position:relative; overflow:hidden;
		cursor:pointer; text-align:left; padding:13px 16px 13px 15px; border-radius:13px;
		border:1px solid rgba(213,162,59,0.45); border-left:4px solid var(--bb-accent,#d5a23b);
		background:linear-gradient(180deg, rgba(26,21,9,0.7), rgba(8,8,12,0.88)); color:#ffe9b8;
		transition:border-color .15s, transform .15s, box-shadow .15s; }
	.bb-opt:hover:not(.disabled) { border-color:#ffe49a; border-left-color:var(--bb-accent,#ffe49a);
		transform:translateY(-2px); box-shadow:0 8px 20px rgba(0,0,0,0.5), 0 0 18px rgba(255,191,44,0.18); }
	.bb-opt.disabled { opacity:0.42; cursor:not-allowed; }
	.bb-ico { width:44px; height:44px; flex:0 0 auto; display:grid; place-items:center; font-size:23px; border-radius:11px;
		border:1px solid rgba(255,224,130,0.45);
		background:radial-gradient(circle at 50% 30%, rgba(255,224,130,0.22), rgba(8,8,12,0.92));
		box-shadow:0 0 10px rgba(255,200,60,0.2) inset; }
	.bb-text { flex:1 1 auto; min-width:0; }
	.bb-name { font-size:16px; font-weight:800; letter-spacing:0.3px; }
	.bb-desc { font-size:12px; color:#c9bd97; margin-top:2px; line-height:1.35; }
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
	.bonus-intro.show { display:grid; animation:bi-fade 0.4s ease both; }
	.bonus-intro.out { animation:bi-fade 0.4s ease reverse both; }
	@keyframes bi-fade { from{opacity:0;} to{opacity:1;} }
	.bi-rays { position:absolute; width:1000px; height:1000px; left:50%; top:46%; transform:translate(-50%,-50%);
		background:conic-gradient(from 0deg, rgba(255,212,90,0.14) 0 8deg, transparent 8deg 22deg,
			rgba(255,212,90,0.14) 22deg 30deg, transparent 30deg 45deg,
			rgba(255,212,90,0.14) 45deg 53deg, transparent 53deg 68deg,
			rgba(255,212,90,0.14) 68deg 76deg, transparent 76deg 90deg);
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
<title>Golden Goal Rush — Interactive Preview</title>
<style>
	* { box-sizing: border-box; }
	html, body { margin: 0; height: 100%; overflow: hidden; background: #05080f; display: grid; place-items: center; }
	.viewport { width: 1200px; height: 675px; transform-origin: center center; }
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
			<span>GOLDEN G</span>
			<img class="logo-ball" src="${assets.football}" alt="" />
			<span>AL RUSH</span>
		</div>
		<div class="world-plaque">WORLD STADIUM</div>

		<div class="board-wrap">
			<div class="board-glow"></div>
			<div class="board-frame">
				<div class="side-badge left">CLUSTER<span>PAYS</span></div>
				<div class="side-badge right">CLUSTER<span>PAYS</span></div>
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
				<img class="button-art" src="${assets.menuButton}" alt="" /><span>MENU</span>
			</button>
			<button type="button" class="asset-button bonus" id="btn-bonus" aria-label="Buy Bonus">
				<img class="button-art" src="${assets.bonusButton}" alt="" /><span>BUY BONUS</span>
			</button>
			<button type="button" class="asset-button" id="btn-auto" aria-label="Auto Spin">
				<img class="button-art" src="${assets.autoSpinButton}" alt="" /><span>AUTO SPIN</span>
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
				<img class="button-art" src="${assets.turboButton}" alt="" /><span>TURBO</span>
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
					<button class="menu-item" data-open="modal-info"><span class="mi-ico">💰</span><span class="mi-label">Pay Table</span><span class="mi-arrow">›</span></button>
					<button class="menu-item" data-open="modal-info"><span class="mi-ico">📖</span><span class="mi-label">How To Play</span><span class="mi-arrow">›</span></button>
					<button class="menu-item" data-open="modal-settings"><span class="mi-ico">⚙️</span><span class="mi-label">Settings</span><span class="mi-arrow">›</span></button>
					<button class="menu-item" id="menu-sound"><span class="mi-ico">🔊</span><span class="mi-label">Sound</span><span class="mi-pill" id="menu-sound-state">ON</span></button>
					<button class="menu-item" data-open="modal-info"><span class="mi-ico">📜</span><span class="mi-label">Game Rules</span><span class="mi-arrow">›</span></button>
					<button class="menu-item" id="menu-history"><span class="mi-ico">🕘</span><span class="mi-label">Game History</span><span class="mi-arrow">›</span></button>
				</div>
			</div>
		</div>

		<!-- ===== Settings modal ===== -->
		<div class="modal-backdrop" id="modal-settings" data-modal>
			<div class="modal">
				<div class="modal-header"><div class="modal-title">SETTINGS</div><button class="modal-close" data-close>&times;</button></div>
				<div class="modal-body">
					<div class="set-section">Audio</div>
					<div class="set-row"><span>Music</span><button class="toggle on" data-toggle="music"></button></div>
					<div class="set-row"><span>Sound Effects</span><button class="toggle on" data-toggle="sfx"></button></div>
					<div class="set-row"><span>Master Volume</span><div class="set-vol"><input class="set-slider" type="range" min="0" max="100" value="80" id="vol-slider" /><span class="set-vol-val" id="vol-val">80</span></div></div>
					<div class="set-section">Gameplay</div>
					<div class="set-row"><span>Turbo Spin</span><button class="toggle" data-toggle="turbo"></button></div>
					<div class="set-row"><span>Quick Spin</span><button class="toggle" data-toggle="quick"></button></div>
					<div class="set-row"><span>Intro Screen</span><button class="toggle on" data-toggle="intro"></button></div>
					<div class="set-row"><span>Left-handed Layout</span><button class="toggle" data-toggle="lefty"></button></div>
				</div>
			</div>
		</div>

		<!-- ===== Info / Paytable modal ===== -->
		<div class="modal-backdrop" id="modal-info" data-modal>
			<div class="modal">
				<div class="modal-header"><div class="modal-title">HOW TO WIN</div><button class="modal-close" data-close>&times;</button></div>
				<div class="modal-body">
					<p class="pt-intro">Golden Goal Rush is a 6×5 <b>cluster-pays</b> game. Land <b>5 or more matching symbols connected horizontally or vertically</b> to win. Winning symbols are removed and new ones cascade in &mdash; each cascade raises the win multiplier. Bigger clusters pay more.</p>
					<div class="pt-head">Symbol Pays <small>cluster 5+ &middot; 7+ &middot; 9+ &middot; 12+</small></div>
					<div class="pt-grid" id="pt-grid"></div>
					<div class="pt-head">Features</div>
					<div class="pt-feat"><img src="${SYMBOLS.wild.src}" alt="Wild" /><div><b>WILD</b>Substitutes for every paying symbol to help complete clusters. Does not replace the Scatter.</div></div>
					<div class="pt-feat"><img src="${SYMBOLS.scatter.src}" alt="Scatter" /><div><b>SCATTER &mdash; VIP TICKET</b>3, 4 or 5 trigger Free Spins Tier 1 / 2 / 3.</div></div>
					<div class="pt-feat"><div class="pt-chip"></div><div><b>GOLDEN CELLS</b>Every winning position turns into a Golden Cell for the rest of the spin sequence.</div></div>
					<div class="pt-feat"><img src="${SYMBOLS.rainbow.src}" alt="Golden Arc" /><div><b>GOLDEN ARC (RAINBOW)</b>While an Arc is on the board it activates all Golden Cells, revealing Coins, Multiplier Badges and Collector Cups.</div></div>
					<div class="pt-feat"><img src="${COIN_ASSETS.gold}" alt="Coins" /><div><b>SPONSOR COINS</b>Bronze ${CONFIG.bronzeValues[0]}&ndash;${CONFIG.bronzeValues[CONFIG.bronzeValues.length-1]}×, Silver ${CONFIG.silverValues[0]}&ndash;${CONFIG.silverValues[CONFIG.silverValues.length-1]}×, Gold ${CONFIG.goldValues[0]}&ndash;${CONFIG.goldValues[CONFIG.goldValues.length-1]}× the bet.</div></div>
					<div class="pt-feat"><img src="${MULT_ASSETS[5]}" alt="Multiplier Badge" /><div><b>MULTIPLIER BADGE</b>Multiplies adjacent coins by ${CONFIG.multiplierValues.map((v) => 'x' + v).join(', ')}.</div></div>
					<div class="pt-feat"><img src="${COLLECTOR_ASSET}" alt="Collector Cup" /><div><b>COLLECTOR CUP</b>Collects the value of every visible coin (top-to-bottom, left-to-right). After the last cup the Golden Cells reveal again, repeating while new cups appear.</div></div>
					<div class="pt-head">Free Spins &amp; Bonus Buy</div>
					<div class="pt-feat"><img src="${SYMBOLS.scatter.src}" alt="Free Spins" /><div><b>FREE SPINS</b>
						${Object.entries(CONFIG.tiers).map(([t, v]) => 'Tier ' + t + ' &mdash; ' + v.name + ': ' + v.spins + ' spins' + (v.guaranteedRainbow ? ', guaranteed Arc each spin' : '') + '.').join('<br>')}</div></div>
					<div class="pt-feat"><img src="${assets.bonusButton}" alt="Bonus Buy" /><div><b>BONUS BUY</b>
						${CONFIG.bonusBuy.map((o) => o.label + ' &mdash; ' + o.mult + '× bet').join('<br>')}<br>Tier 3 (End of the Rainbow) can only trigger naturally.</div></div>
					<div class="pt-note">Theoretical RTP target ~96% (demo) &middot; Max win ${CONFIG.maxWinMultiplier.toLocaleString()}× bet &middot; All wins are a multiple of the bet. Malfunction voids all pays and plays.</div>
				</div>
			</div>
		</div>

		<!-- ===== Bonus Buy modal ===== -->
		<div class="modal-backdrop" id="modal-bonusbuy" data-modal>
			<div class="modal">
				<div class="modal-header"><div class="modal-title">BONUS BUY</div><button class="modal-close" data-close>&times;</button></div>
				<div class="modal-body">
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
const CONFIG = ${JSON.stringify(CONFIG)};
const COLS = 6, ROWS = 5, MIN_CLUSTER = 5;
const BETS = [0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];

const state = {
	balance: 1000, bet: 1, betIdx: 2, grid: [], spinning: false, turbo: false, auto: false,
	golden: new Set(), reveals: new Map(), // golden = 'c,r' keys; reveals = 'c,r' -> {kind,value,asset}
	mode: 'base', tier: 0, fsLeft: 0, fsTotal: 0, win: 0, sound: true,
};

const $ = (id) => document.getElementById(id);
const board = $('board');
const stage = $('stage');
const wait = (ms) => new Promise((r) => setTimeout(r, state.turbo ? ms * 0.42 : ms));
const fmt = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ck = (c, r) => c + ',' + r;
const wpick = (entries) => { // entries: [[value, weight], ...]
	const tot = entries.reduce((s, e) => s + e[1], 0); let x = Math.random() * tot;
	for (const [v, w] of entries) { x -= w; if (x < 0) return v; } return entries[0][0];
};
const rand = (arr) => arr[(Math.random() * arr.length) | 0];

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
const rawWait = (ms) => new Promise((r) => setTimeout(r, ms)); // not turbo-scaled (the wait IS the drop)
const COL_DELAY = 58;                                    // per-column stagger (left -> right)
const DROP_DUR = (rows) => 220 + Math.min(rows, ROWS) * 42;
// A full-board drop: every column falls in as a stack, staggered by column.
function fullDropMap() {
	const drops = new Map();
	for (let c = 0; c < COLS; c += 1) for (let r = 0; r < ROWS; r += 1)
		drops.set(ck(c, r), { rows: ROWS, delay: c * COL_DELAY * TF(), dur: DROP_DUR(ROWS) * TF() });
	return drops;
}
// Latest land time (delay+dur) across a drop map, for awaiting the settle.
function dropEnd(drops) { let m = 0; for (const d of drops.values()) m = Math.max(m, d.delay + d.dur); return m; }

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
				if (rv.kind === 'coin') { const lab = document.createElement('span'); lab.className = 'coin-val'; lab.textContent = rv.value + 'x'; wrap.appendChild(lab); }
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
	el.classList.remove('out'); el.classList.add('show');
	Sound.fanfare(); coinShower(18);
	await wait(state.turbo ? 1000 : 1900);
	el.classList.add('out'); await wait(420); el.classList.remove('show', 'out');
}

// Light bar sweeps across the board while the Golden Cells energise.
async function rainbowSweep() {
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
	await wait(state.turbo ? 340 : 560);
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

// ---- synthesised sound hooks (Web Audio; gated by the menu Sound toggle) ----
const Sound = (() => {
	let ctx = null;
	function ac() {
		try {
			if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
			if (ctx.state === 'suspended') ctx.resume();
			return ctx;
		} catch (e) { return null; }
	}
	function tone(freq, t0, dur, type, gain) {
		const c = ac(); if (!c) return;
		const o = c.createOscillator(), g = c.createGain();
		o.type = type; o.frequency.setValueAtTime(freq, t0);
		g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(gain, t0 + 0.008);
		g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
		o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + dur);
	}
	const on = () => state.sound !== false;
	return {
		tick(i, total) { if (!on()) return; const c = ac(); if (!c) return; const f = 520 + Math.min(i, total) / total * 660; tone(f, c.currentTime, 0.055, 'square', 0.045); },
		fanfare() { if (!on()) return; const c = ac(); if (!c) return; [0, 4, 7, 12].forEach((n, i) => tone(523.25 * Math.pow(2, n / 12), c.currentTime + i * 0.1, 0.5, 'triangle', 0.09)); },
		win(tier) { if (!on()) return; const c = ac(); if (!c) return; const base = tier === 'epic' ? 523.25 : tier === 'mega' ? 466.16 : 392; const set = tier === 'epic' ? [0, 4, 7, 12, 16] : [0, 4, 7, 12]; set.forEach((n, i) => tone(base * Math.pow(2, n / 12), c.currentTime + i * 0.085, 0.55, 'triangle', 0.1)); },
		collect() { if (!on()) return; const c = ac(); if (!c) return; tone(880, c.currentTime, 0.12, 'sine', 0.085); tone(1318.5, c.currentTime + 0.045, 0.14, 'sine', 0.06); },
		sweep() { if (!on()) return; const c = ac(); if (!c) return; const o = c.createOscillator(), g = c.createGain(); const t0 = c.currentTime; o.type = 'triangle'; o.frequency.setValueAtTime(440, t0); o.frequency.exponentialRampToValueAtTime(1320, t0 + 0.5); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.06, t0 + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.55); o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + 0.6); },
		anticipation(sc) { if (!on()) return; const c = ac(); if (!c) return; const o = c.createOscillator(), g = c.createGain(); const t0 = c.currentTime, dur = sc >= 3 ? 0.9 : 0.68; o.type = 'sawtooth'; o.frequency.setValueAtTime(196, t0); o.frequency.exponentialRampToValueAtTime(sc >= 3 ? 784 : 523, t0 + dur); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(0.05, t0 + 0.06); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + dur); },
		scatterHit() { if (!on()) return; const c = ac(); if (!c) return; tone(1046.5, c.currentTime, 0.3, 'square', 0.09); tone(1568, c.currentTime + 0.02, 0.3, 'triangle', 0.06); },
	};
})();

function updateMeters() {
	$('meter-balance').textContent = fmt(state.balance);
	$('meter-bet').textContent = fmt(state.bet);
	$('bet-display').textContent = fmt(state.bet);
	$('bet-controls').classList.toggle('low', state.betIdx === 0);
}

function findClusters() {
	const seen = Array.from({ length: COLS }, () => Array(ROWS).fill(false));
	const clusters = [];
	const sameAs = (target, k) => k === target || SYMBOLS[k].wild || (SYMBOLS[target] && SYMBOLS[target].wild && SYMBOLS[k].pay > 0);
	for (let c = 0; c < COLS; c += 1) for (let r = 0; r < ROWS; r += 1) {
		const key = state.grid[c][r];
		if (seen[c][r] || SYMBOLS[key].wild || SYMBOLS[key].scatter) continue;
		const stack = [[c, r]]; const cells = []; seen[c][r] = true;
		while (stack.length) {
			const [cc, rr] = stack.pop(); cells.push([cc, rr]);
			for (const [dc, dr] of [[1,0],[-1,0],[0,1],[0,-1]]) {
				const nc = cc + dc, nr = rr + dr;
				if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS || seen[nc][nr]) continue;
				if (sameAs(key, state.grid[nc][nr])) { seen[nc][nr] = true; stack.push([nc, nr]); }
			}
		}
		if (cells.length >= MIN_CLUSTER) clusters.push({ key, cells });
	}
	return clusters;
}

function payFor(key, count) {
	const base = SYMBOLS[key].pay;
	const sizeBoost = count >= 12 ? 8 : count >= 9 ? 4 : count >= 7 ? 2 : 1;
	return base * sizeBoost;
}

async function countUp(amount) {
	const el = $('meter-win');
	const steps = state.turbo ? 8 : 18; let i = 0;
	return new Promise((resolve) => {
		const t = setInterval(() => {
			i += 1; el.textContent = fmt((amount * i) / steps); Sound.tick(i, steps);
			if (i >= steps) { clearInterval(t); el.textContent = fmt(amount); resolve(); }
		}, 28);
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
const setWin = (abs) => { state.win = Math.min(abs, capWin()); $('meter-win').textContent = fmt(state.win); };

// Cluster pays + cascades. Every winning position becomes a Golden Cell.
async function resolveCascades(baseStart) {
	let multiplier = 1;
	while (true) {
		const clusters = findClusters();
		if (!clusters.length) break;
		const flat = clusters.flatMap((cl) => cl.cells);
		flat.forEach(([c, r]) => { cellEl(c, r).classList.add('win'); state.golden.add(ck(c, r)); });
		const stepWin = clusters.reduce((s, cl) => s + payFor(cl.key, cl.cells.length) * state.bet, 0) * multiplier;
		setWin(state.win + stepWin);
		await countUp(state.win);
		await wait(360);
		flat.forEach(([c, r]) => {
			const el = cellEl(c, r); const img = el.querySelector('img');
			if (img) img.classList.add('clearing');
			el.classList.add('converting'); // gold burn as the cell turns into a Golden Cell
			const p = stagePos(el); burstAt(p.x, p.y, 5);
		});
		await wait(230);
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
			for (let r = 0; r < add; r += 1) drops.set(ck(c, r), { rows: add }); // refill stack falls from above
		}
		// uniform per-column duration (everything in a column lands together), staggered left->right
		const colMax = {};
		for (const [k, d] of drops) { const c = +k.split(',')[0]; colMax[c] = Math.max(colMax[c] || 0, d.rows); }
		for (const [k, d] of drops) { const c = +k.split(',')[0]; d.dur = DROP_DUR(colMax[c]) * TF(); d.delay = c * COL_DELAY * TF(); }
		paint({ drops });
		await rawWait(dropEnd(drops) + 80 * TF());
		multiplier += 1;
		if (state.win >= capWin()) break;
	}
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
		if (kind === 'blank') continue;
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
			setWin(baseWinAbs + coinMult * state.bet);
			await countUp(state.win);
			await wait(300);
			if (state.win >= capWin()) return coinMult * state.bet;
		}
		coinMult += sum; // the coins themselves pay
		setWin(baseWinAbs + coinMult * state.bet);
		await countUp(state.win);
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
// the last two columns hang back and the stage dims so the final reels "decide".
async function dropInBoard(anticipate) {
	const drops = fullDropMap();
	if (anticipate) {
		for (const [k, d] of drops) {
			const c = +k.split(',')[0];
			if (c >= COLS - 2) { d.delay += (c === COLS - 2 ? 420 : 820) * TF(); d.dur = (DROP_DUR(ROWS) + 240) * TF(); }
		}
		stage.classList.add('antic'); Sound.anticipation(2); stadiumFlash();
	}
	paint({ drops });
	await rawWait(dropEnd(drops) + 80 * TF());
	if (anticipate) stage.classList.remove('antic');
}

// ---- spin orchestration ----
async function spin(buy) {
	if (state.spinning) return;
	const cost = state.mode === 'free' ? 0 : Math.round(state.bet * (buy ? buy.mult : 1) * 100) / 100;
	if (state.mode !== 'free' && state.balance < cost) {
		stage.classList.add('shake'); setTimeout(() => stage.classList.remove('shake'), 420); return;
	}
	state.spinning = true; $('btn-spin').classList.add('busy');
	if (state.mode !== 'free') { state.balance -= cost; state.golden.clear(); }
	state.reveals.clear();
	setWin(0); updateMeters();

	const opts = {};
	if ((buy && buy.id === 'rainbow') || (state.mode === 'free' && CONFIG.tiers[state.tier] && CONFIG.tiers[state.tier].guaranteedRainbow)) opts.forceRainbow = true;
	if (buy && buy.id === 'hunt') { opts.boostRainbow = 5; opts.noBonus = true; }
	if (state.mode === 'free' && CONFIG.tiers[state.tier] && CONFIG.tiers[state.tier].rainbowBoost) opts.boostRainbow = CONFIG.tiers[state.tier].rainbowBoost;

	[...board.querySelectorAll('img')].forEach((img) => img.classList.add('clearing'));
	await wait(200);
	newGrid(opts);
	let earlyScatters = 0;
	for (let c = 0; c < COLS - 2; c += 1) for (let r = 0; r < ROWS; r += 1) if (state.grid[c][r] === 'scatter') earlyScatters += 1;
	const anticipate = state.mode === 'base' && !opts.noBonus && !(buy && (buy.id === 'tier1' || buy.id === 'tier2')) && earlyScatters >= 2;
	await dropInBoard(anticipate);
	await scatterAnticipation();

	const baseWin = await resolveCascades();
	let featureWin = 0;
	if (rainbowOnBoard() && state.golden.size) {
		// flash the rainbow symbol(s), then sweep light across the energising cells
		for (let c = 0; c < COLS; c += 1) for (let r = 0; r < ROWS; r += 1)
			if (state.grid[c][r] === 'rainbow') { const e = cellEl(c, r); if (e) e.classList.add('rainbow-flash'); }
		await wait(state.turbo ? 200 : 360);
		await rainbowSweep();
		featureWin = await runFeature(baseWin);
		if (state.mode === 'free' && CONFIG.tiers[state.tier] && !CONFIG.tiers[state.tier].persistAfterReveal) state.golden.clear();
	}
	setWin(baseWin + featureWin);

	// payout / accumulate
	if (state.mode === 'free') {
		state.fsWin = (state.fsWin || 0) + state.win;
		state.fsBest = Math.max(state.fsBest || 0, state.win); // track best single spin for the summary
		$('meter-win').textContent = fmt(state.fsWin); // WIN shows the running bonus total
	} else {
		state.balance += state.win;
		if (state.win > 0) await showBanner(state.win);
	}
	updateMeters();

	// scatters -> trigger / retrigger free spins
	const sc = scatterCount();
	let triggered = false;
	if (state.mode === 'base' && sc >= 3 && !opts.noBonus && !(buy && (buy.id === 'tier1' || buy.id === 'tier2'))) {
		triggered = true; $('btn-spin').classList.remove('busy'); state.spinning = false;
		await startFreeSpins(sc >= 5 ? 3 : sc >= 4 ? 2 : 1); return;
	} else if (state.mode === 'free' && sc >= 2) {
		await retrigger(sc);
	}

	if (state.mode === 'base') { state.golden.clear(); state.reveals.clear(); paint(); } // repaint to remove golden frames
	$('btn-spin').classList.remove('busy'); state.spinning = false;
	if (state.mode === 'base' && state.auto && !triggered) setTimeout(() => spin(), state.turbo ? 250 : 600);
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
	const lock = state.mode === 'free';
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
async function startFreeSpins(tier) {
	state.mode = 'free'; state.tier = tier; state.fsTotal = CONFIG.tiers[tier].spins; state.fsLeft = state.fsTotal;
	state.fsWin = 0; state.fsBest = 0; state.fsPlayed = 0;
	state.golden.clear(); state.reveals.clear();
	setBonusMode(true);
	updateFsCounter();
	await bonusIntro(tier);
	while (state.fsLeft > 0 && (state.fsWin || 0) < capWin()) {
		state.fsLeft -= 1; updateFsCounter();
		await spin();
		state.fsPlayed += 1;
		await wait(state.turbo ? 250 : 550);
	}
	const won = state.fsWin || 0;
	state.mode = 'base'; state.tier = 0; state.golden.clear(); state.reveals.clear(); paint();
	state.balance += won; updateMeters(); updateFsCounter();
	setBonusMode(false);
	await bonusSummary(won, state.fsPlayed, state.fsBest || 0);
}

function changeBet(dir) {
	if (state.spinning || state.mode === 'free') return; // bet locked during free spins
	state.betIdx = Math.max(0, Math.min(BETS.length - 1, state.betIdx + dir));
	state.bet = BETS[state.betIdx]; updateMeters();
}

$('btn-spin').addEventListener('click', () => spin());
$('btn-bet-minus').addEventListener('click', () => changeBet(-1));
$('btn-bet-plus').addEventListener('click', () => changeBet(1));
$('btn-turbo').addEventListener('click', () => { state.turbo = !state.turbo; $('btn-turbo').classList.toggle('armed', state.turbo); });
$('btn-auto').addEventListener('click', () => {
	state.auto = !state.auto; $('btn-auto').classList.toggle('armed', state.auto);
	if (state.auto && !state.spinning) spin();
});
// ---- bonus buy ----
const BB_META = {
	hunt: { ico: '🎯', accent: '#cf9b3f' },
	rainbow: { ico: '🌈', accent: '#7d5cff' },
	tier1: { ico: '⭐', accent: '#e7b84e' },
	tier2: { ico: '🏆', accent: '#ffd24a' },
};
function buildBonusBuy() {
	const wrap = $('bonusbuy-list');
	let anyDisabled = false;
	wrap.innerHTML = CONFIG.bonusBuy.map((o) => {
		const price = Math.round(o.mult * state.bet * 100) / 100;
		const afford = state.balance >= price; if (!afford) anyDisabled = true;
		const m = BB_META[o.id] || { ico: '⚽', accent: '#d5a23b' };
		return '<button class="bb-opt' + (afford ? '' : ' disabled') + '" data-buy="' + o.id + '" style="--bb-accent:' + m.accent + '"' + (afford ? '' : ' disabled') + '>' +
			'<span class="bb-ico">' + m.ico + '</span>' +
			'<div class="bb-text"><div class="bb-name">' + o.label + '</div><div class="bb-desc">' + o.desc + '</div></div>' +
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
		+ '<div class="c-q">Buy <b>' + o.label + '</b><br>(' + what + ')<br>for <b>⚽ ' + fmt(price) + '</b>?</div>'
		+ '<div class="c-row"><button class="c-no" id="bb-cancel">Cancel</button><button class="c-yes" id="bb-confirm">Confirm</button></div></div>';
	$('bonusbuy-note').textContent = 'Balance after purchase: ' + fmt(Math.max(0, Math.round((state.balance - price) * 100) / 100));
	$('bb-cancel').onclick = () => buildBonusBuy();
	$('bb-confirm').onclick = () => {
		if (state.balance < price) { buildBonusBuy(); return; }
		closeModals();
		if (o.id === 'tier1' || o.id === 'tier2') { state.balance -= price; updateMeters(); startFreeSpins(o.id === 'tier1' ? 1 : 2); }
		else spin(o);
	};
}
$('btn-bonus').addEventListener('click', () => { if (!state.spinning && state.mode === 'base') { buildBonusBuy(); openModal('modal-bonusbuy'); } });
window.addEventListener('keydown', (e) => { if (e.code === 'Space') { e.preventDefault(); spin(); } });

// ---- modals: open / close ----
function openModal(id) { document.querySelectorAll('[data-modal]').forEach((m) => m.classList.remove('open')); const el = document.getElementById(id); if (el) el.classList.add('open'); }
function closeModals() { document.querySelectorAll('[data-modal]').forEach((m) => m.classList.remove('open')); }
$('btn-menu').addEventListener('click', () => openModal('modal-menu'));
$('btn-settings').addEventListener('click', () => openModal('modal-settings'));
$('btn-info').addEventListener('click', () => openModal('modal-info'));
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeModals));
document.querySelectorAll('[data-modal]').forEach((m) => m.addEventListener('click', (e) => { if (e.target === m) closeModals(); }));
document.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => openModal(b.dataset.open)));
window.addEventListener('keydown', (e) => { if (e.code === 'Escape') closeModals(); });

// menu: sound toggle (drives the synthesised SFX hooks)
$('menu-sound').addEventListener('click', () => {
	const s = $('menu-sound-state'); const willOn = s.textContent !== 'ON';
	state.sound = willOn; s.textContent = willOn ? 'ON' : 'OFF'; s.classList.toggle('off', !willOn);
});
$('menu-history').addEventListener('click', () => openModal('modal-info'));

// settings: live master-volume readout
(function () {
	const sl = $('vol-slider'); const out = $('vol-val');
	if (sl && out) sl.addEventListener('input', () => { out.textContent = sl.value; });
})();

// settings: toggle switches
document.querySelectorAll('.toggle').forEach((t) => t.addEventListener('click', () => {
	t.classList.toggle('on');
	if (t.dataset.toggle === 'turbo') { state.turbo = t.classList.contains('on'); $('btn-turbo').classList.toggle('armed', state.turbo); }
	if (t.dataset.toggle === 'sfx') { state.sound = t.classList.contains('on'); const p = $('menu-sound-state'); if (p) { p.textContent = state.sound ? 'ON' : 'OFF'; p.classList.toggle('off', !state.sound); } }
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

// Scale the 1200x675 stage to fit any window so nothing (incl. the side
// panels) is ever cut off on smaller screens.
function fitViewport() {
	const s = Math.min(window.innerWidth / 1200, window.innerHeight / 675);
	state.scale = s;
	const vp = document.querySelector('.viewport');
	if (vp) vp.style.transform = 'scale(' + s + ')';
}
window.addEventListener('resize', fitViewport);
fitViewport();

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
window.__ggrReady = true;
</script>
</body>
</html>
`;

writeFileSync(OUT, html);
console.log('Wrote', OUT);
