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
const SYMBOLS = {
	ten: { src: `${A}/10.png`, weight: 22, pay: 0.1 },
	j: { src: `${A}/j.png`, weight: 20, pay: 0.1 },
	q: { src: `${A}/q.png`, weight: 17, pay: 0.15 },
	k: { src: `${A}/k.png`, weight: 15, pay: 0.2 },
	a: { src: `${A}/a.png`, weight: 13, pay: 0.25 },
	football: { src: `${A}/fussball.png`, weight: 9, pay: 0.4, cls: 'feature' },
	whistle: { src: `${A}/pfeife.png`, weight: 8, pay: 0.5, cls: 'feature' },
	trophy: { src: `${A}/pokal.png`, weight: 6, pay: 0.75 },
	jersey: { src: `${A}/trikot.png`, weight: 6, pay: 1, cls: 'wide' },
	wild: { src: `${A}/wild.png`, weight: 2, pay: 0, cls: 'feature', wild: true },
	scatter: { src: `${A}/scatter.png`, weight: 2, pay: 0, cls: 'wide', scatter: true },
};

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
	.cell img.dropping { animation: drop-in 0.32s cubic-bezier(.25,.9,.3,1.2) both; }
	.cell img.clearing { animation: clear-out 0.26s ease-in forwards; }
	.stage.turbo .cell img.dropping { animation-duration: 0.16s; }
	.stage.turbo .cell img.clearing { animation-duration: 0.12s; }
	@keyframes drop-in { 0% { transform: translateY(-340%) scale(0.85); opacity: 0; }
		70% { opacity: 1; } 100% { transform: translateY(0) scale(1); opacity: 1; } }
	@keyframes clear-out { 0% { transform: scale(1); opacity: 1; }
		40% { transform: scale(1.18); } 100% { transform: scale(0.2); opacity: 0; } }
	@keyframes win-pop { 0%,100% { transform: scale(1); } 50% { transform: scale(1.12); } }
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

	/* ---- modals (menu / settings / info) ---- */
	.modal-backdrop { position:absolute; inset:0; z-index:60; display:none;
		align-items:center; justify-content:center; background:rgba(0,0,0,0.74);
		-webkit-backdrop-filter:blur(3px); backdrop-filter:blur(3px); }
	.modal-backdrop.open { display:flex; }
	.modal { width:min(640px,92%); max-height:88%; display:flex; flex-direction:column;
		background:linear-gradient(180deg,#14120b 0%,#070707 100%);
		border:3px solid #d5a23b; border-radius:18px; overflow:hidden;
		box-shadow:0 0 0 3px #050505, 0 22px 55px rgba(0,0,0,0.75), 0 0 44px rgba(255,191,44,0.3);
		color:#f1e4c6; font-family:Inter,Arial,sans-serif; animation:modal-in .22s ease both; }
	@keyframes modal-in { from { opacity:0; transform:translateY(14px) scale(0.97); } }
	.modal-header { display:flex; align-items:center; justify-content:space-between;
		padding:14px 20px; border-bottom:1px solid rgba(213,162,59,0.4);
		background:linear-gradient(180deg, rgba(213,162,59,0.2), transparent); }
	.modal-title { font-size:20px; font-weight:900; letter-spacing:2px; color:#ffe49a; text-shadow:0 2px 2px #000; }
	.modal-close { width:34px; height:34px; border-radius:9px; cursor:pointer;
		border:2px solid #d5a23b; background:#0a0a0f; color:#ffe49a; font-size:20px; font-weight:900; line-height:1; }
	.modal-close:hover { border-color:#ffe49a; }
	.modal-body { padding:16px 20px; overflow-y:auto; }
	.menu-item { display:flex; align-items:center; gap:14px; width:100%; cursor:pointer;
		padding:13px 16px; margin-bottom:9px; border-radius:11px; text-align:left;
		border:1px solid rgba(213,162,59,0.45); background:rgba(8,8,12,0.85);
		color:#ffe9b8; font-size:16px; font-weight:700; letter-spacing:0.4px; }
	.menu-item:hover { border-color:#ffe49a; background:rgba(28,22,8,0.9); transform:translateX(2px); }
	.menu-item .mi-ico { font-size:20px; width:26px; text-align:center; }
	.menu-item .mi-arrow { margin-left:auto; color:#d5a23b; }
	.set-row { display:flex; align-items:center; justify-content:space-between;
		padding:13px 4px; border-bottom:1px solid rgba(213,162,59,0.22); }
	.set-row span { font-size:15px; font-weight:700; color:#f1e4c6; }
	.toggle { width:54px; height:28px; border-radius:16px; cursor:pointer; position:relative;
		border:2px solid #7a5a1c; background:#15130d; transition:background .18s, border-color .18s; }
	.toggle::after { content:''; position:absolute; top:2px; left:2px; width:20px; height:20px;
		border-radius:50%; background:linear-gradient(180deg,#cfcfcf,#888); transition:left .18s; }
	.toggle.on { background:linear-gradient(180deg,#2a6b2f,#14491f); border-color:#3fae57; }
	.toggle.on::after { left:26px; background:linear-gradient(180deg,#fff3bd,#e7b84e); }
	.set-slider { width:140px; accent-color:#e7b84e; }
	.pt-intro { font-size:14px; line-height:1.5; color:#d8cba6; margin:0 0 14px; }
	.pt-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:10px; margin-bottom:16px; }
	.pt-cell { display:flex; flex-direction:column; align-items:center; gap:4px;
		padding:10px 6px; border-radius:10px; border:1px solid rgba(213,162,59,0.35); background:rgba(8,8,12,0.8); }
	.pt-cell img { width:46px; height:46px; object-fit:contain; filter:drop-shadow(0 2px 3px #000); }
	.pt-pays { font-size:11px; line-height:1.45; color:#ffe9b8; text-align:center; }
	.pt-pays b { color:#ffd96f; }
	.pt-feat { display:flex; gap:12px; align-items:flex-start; padding:11px 0; border-top:1px solid rgba(213,162,59,0.25); }
	.pt-feat img { width:44px; height:44px; object-fit:contain; flex:0 0 auto; filter:drop-shadow(0 2px 3px #000); }
	.pt-feat div { font-size:13px; line-height:1.45; color:#d8cba6; }
	.pt-feat b { color:#ffe49a; display:block; margin-bottom:2px; font-size:14px; letter-spacing:0.5px; }
	.pt-note { margin-top:14px; padding-top:12px; border-top:1px solid rgba(213,162,59,0.3);
		font-size:12px; color:#9b906f; text-align:center; line-height:1.5; }
`;

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Golden Goal Rush — Interactive Preview</title>
<style>
	* { box-sizing: border-box; }
	html, body { margin: 0; height: 100%; background: #05080f; display: grid; place-items: center; }
	.viewport { width: 1200px; height: 675px; }
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
				<div class="side-badge left">243<span>WAYS</span></div>
				<div class="side-badge right">243<span>WAYS</span></div>
				<div class="board" id="board"></div>
			</div>
		</div>

		<div class="win-banner" id="win-banner"><small id="win-banner-label">BIG WIN</small><span id="win-banner-amount">0.00</span></div>

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
					<button class="menu-item" data-open="modal-info"><span class="mi-ico">💰</span> Pay Table <span class="mi-arrow">›</span></button>
					<button class="menu-item" data-open="modal-info"><span class="mi-ico">📖</span> How To Play <span class="mi-arrow">›</span></button>
					<button class="menu-item" data-open="modal-settings"><span class="mi-ico">⚙️</span> Settings <span class="mi-arrow">›</span></button>
					<button class="menu-item" id="menu-sound"><span class="mi-ico">🔊</span> Sound: <span id="menu-sound-state" style="color:#ffd96f;margin-left:4px">ON</span></button>
					<button class="menu-item" data-open="modal-info"><span class="mi-ico">📜</span> Game Rules <span class="mi-arrow">›</span></button>
					<button class="menu-item" id="menu-history"><span class="mi-ico">🕘</span> Game History <span class="mi-arrow">›</span></button>
				</div>
			</div>
		</div>

		<!-- ===== Settings modal ===== -->
		<div class="modal-backdrop" id="modal-settings" data-modal>
			<div class="modal">
				<div class="modal-header"><div class="modal-title">SETTINGS</div><button class="modal-close" data-close>&times;</button></div>
				<div class="modal-body">
					<div class="set-row"><span>Music</span><button class="toggle on" data-toggle="music"></button></div>
					<div class="set-row"><span>Sound Effects</span><button class="toggle on" data-toggle="sfx"></button></div>
					<div class="set-row"><span>Master Volume</span><input class="set-slider" type="range" min="0" max="100" value="80" /></div>
					<div class="set-row"><span>Turbo Spin</span><button class="toggle" data-toggle="turbo"></button></div>
					<div class="set-row"><span>Quick Spin</span><button class="toggle" data-toggle="quick"></button></div>
					<div class="set-row"><span>Intro Screen</span><button class="toggle on" data-toggle="intro"></button></div>
					<div class="set-row" style="border-bottom:0"><span>Left-handed Layout</span><button class="toggle" data-toggle="lefty"></button></div>
				</div>
			</div>
		</div>

		<!-- ===== Info / Paytable modal ===== -->
		<div class="modal-backdrop" id="modal-info" data-modal>
			<div class="modal">
				<div class="modal-header"><div class="modal-title">HOW TO WIN</div><button class="modal-close" data-close>&times;</button></div>
				<div class="modal-body">
					<p class="pt-intro">Golden Goal Rush is a 6×5 cluster-pays game. Land <b>5 or more matching symbols connected horizontally or vertically</b> to win. Winning symbols are removed and new ones cascade in &mdash; each cascade raises the win multiplier. Bigger clusters pay more.</p>
					<div class="pt-grid" id="pt-grid"></div>
					<div class="pt-feat"><img src="${SYMBOLS.wild.src}" alt="Wild" /><div><b>WILD</b>Substitutes for every paying symbol to help complete clusters. Does not replace Scatter.</div></div>
					<div class="pt-feat"><img src="${SYMBOLS.scatter.src}" alt="Scatter" /><div><b>SCATTER &mdash; VIP TICKET</b>3 or more trigger the Golden Sponsor Bonus free spins, where Sponsor Coins, Multipliers and the Trophy Collector appear.</div></div>
					<div class="pt-feat"><img src="${assets.collector}" alt="Collector" /><div><b>TROPHY COLLECTOR</b>Collects the cash value of every Sponsor Coin on screen.</div></div>
					<div class="pt-feat"><img src="${assets.multiplier}" alt="Multiplier" /><div><b>SPONSOR MULTIPLIER</b>Multiplies the value of collected coins (x2 up to x10).</div></div>
					<div class="pt-note">Theoretical RTP 96.0% &middot; Max win 10,000&times; bet &middot; All wins are shown as a multiple of the bet. Malfunction voids all pays and plays.</div>
				</div>
			</div>
		</div>
	</section>
	</div>

<script>
const SYMBOLS = ${JSON.stringify(SYMBOLS)};
const KEYS = Object.keys(SYMBOLS);
const POOL = KEYS.flatMap((k) => Array(SYMBOLS[k].weight).fill(k));
const PAYKEYS = KEYS.filter((k) => SYMBOLS[k].pay > 0);
const COLS = 6, ROWS = 5, MIN_CLUSTER = 5;
const BETS = [0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];

const state = { balance: 1000, bet: 1, betIdx: 2, grid: [], spinning: false, turbo: false, auto: false };

const $ = (id) => document.getElementById(id);
const board = $('board');
const stage = $('stage');
const wait = (ms) => new Promise((r) => setTimeout(r, state.turbo ? ms * 0.42 : ms));
const fmt = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const randKey = () => POOL[(Math.random() * POOL.length) | 0];

function newColumn() { return Array.from({ length: ROWS }, randKey); }
function newGrid() { state.grid = Array.from({ length: COLS }, newColumn); } // grid[col][row], row0 = top

function cellEl(col, row) { return board.children[row * COLS + col]; }

function paint({ dropping = false } = {}) {
	board.innerHTML = '';
	for (let row = 0; row < ROWS; row += 1) {
		for (let col = 0; col < COLS; col += 1) {
			const key = state.grid[col][row];
			const sym = SYMBOLS[key];
			const cell = document.createElement('div');
			cell.className = 'cell';
			const img = document.createElement('img');
			img.src = sym.src;
			img.alt = key;
			if (sym.cls) img.classList.add(sym.cls);
			if (dropping) { img.classList.add('dropping'); img.style.animationDelay = (col * 45 + row * 12) + 'ms'; }
			cell.appendChild(img);
			board.appendChild(cell);
		}
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
			i += 1; el.textContent = fmt((amount * i) / steps);
			if (i >= steps) { clearInterval(t); el.textContent = fmt(amount); resolve(); }
		}, 28);
	});
}

async function showBanner(amount) {
	const x = amount / state.bet;
	let label = null;
	if (x >= 50) label = 'EPIC WIN'; else if (x >= 20) label = 'MEGA WIN'; else if (x >= 8) label = 'BIG WIN';
	if (!label) return;
	$('win-banner-label').textContent = label;
	const b = $('win-banner'); b.classList.add('show');
	if (x >= 20) { stage.classList.add('shake'); setTimeout(() => stage.classList.remove('shake'), 420); }
	const amt = $('win-banner-amount'); const steps = 22;
	for (let i = 1; i <= steps; i += 1) { amt.textContent = fmt((amount * i) / steps); await wait(30); }
	await wait(700); b.classList.remove('show');
}

async function resolveCascades() {
	let total = 0, multiplier = 1;
	$('meter-win').textContent = '0.00';
	while (true) {
		const clusters = findClusters();
		if (!clusters.length) break;
		const flat = clusters.flatMap((cl) => cl.cells);
		flat.forEach(([c, r]) => cellEl(c, r).classList.add('win'));
		const stepWin = clusters.reduce((s, cl) => s + payFor(cl.key, cl.cells.length) * state.bet, 0) * multiplier;
		total += stepWin;
		await countUp(total);
		await wait(420);
		// clear winning cells
		flat.forEach(([c, r]) => { const img = cellEl(c, r).querySelector('img'); if (img) img.classList.add('clearing'); });
		await wait(260);
		// cascade per column: drop survivors, fill new on top
		const removed = Array.from({ length: COLS }, () => new Set());
		flat.forEach(([c, r]) => removed[c].add(r));
		for (let c = 0; c < COLS; c += 1) {
			const kept = [];
			for (let r = 0; r < ROWS; r += 1) if (!removed[c].has(r)) kept.push(state.grid[c][r]);
			const add = ROWS - kept.length;
			state.grid[c] = [...Array.from({ length: add }, randKey), ...kept];
		}
		paint({ dropping: true });
		await wait(360);
		multiplier += 1;
	}
	if (total > 0) { state.balance += total; await showBanner(total); }
	updateMeters();
	return total;
}

async function spin() {
	if (state.spinning) return;
	if (state.balance < state.bet) {
		stage.classList.add('shake'); setTimeout(() => stage.classList.remove('shake'), 420); return;
	}
	state.spinning = true;
	$('btn-spin').classList.add('busy');
	state.balance -= state.bet; $('meter-win').textContent = '0.00'; updateMeters();
	// drop out then in
	[...board.querySelectorAll('img')].forEach((img) => img.classList.add('clearing'));
	await wait(220);
	newGrid(); paint({ dropping: true });
	await wait(420);
	await resolveCascades();
	$('btn-spin').classList.remove('busy');
	state.spinning = false;
	if (state.auto) setTimeout(spin, state.turbo ? 250 : 600);
}

function changeBet(dir) {
	if (state.spinning) return;
	state.betIdx = Math.max(0, Math.min(BETS.length - 1, state.betIdx + dir));
	state.bet = BETS[state.betIdx]; updateMeters();
}

$('btn-spin').addEventListener('click', spin);
$('btn-bet-minus').addEventListener('click', () => changeBet(-1));
$('btn-bet-plus').addEventListener('click', () => changeBet(1));
$('btn-turbo').addEventListener('click', () => { state.turbo = !state.turbo; $('btn-turbo').classList.toggle('armed', state.turbo); });
$('btn-auto').addEventListener('click', () => {
	state.auto = !state.auto; $('btn-auto').classList.toggle('armed', state.auto);
	if (state.auto && !state.spinning) spin();
});
$('btn-bonus').addEventListener('click', () => { if (state.balance >= state.bet * 100) { state.balance -= state.bet * 99; state.bet = state.bet; spin(); } });
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

// menu: sound toggle
$('menu-sound').addEventListener('click', () => {
	const s = $('menu-sound-state'); const on = s.textContent === 'ON'; s.textContent = on ? 'OFF' : 'ON';
});
$('menu-history').addEventListener('click', () => openModal('modal-info'));

// settings: toggle switches
document.querySelectorAll('.toggle').forEach((t) => t.addEventListener('click', () => {
	t.classList.toggle('on');
	if (t.dataset.toggle === 'turbo') { state.turbo = t.classList.contains('on'); $('btn-turbo').classList.toggle('armed', state.turbo); }
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

newGrid(); paint(); updateMeters();

// Lightweight preview API — lets you trigger a guaranteed win to preview the
// cluster/cascade/win-banner presentation (open console: __ggr.demoWin()).
window.__ggr = {
	state,
	spin,
	resolveCascades,
	setGrid: (g) => { state.grid = g; paint(); },
	demoWin: async () => {
		if (state.spinning) return;
		state.spinning = true; $('btn-spin').classList.add('busy');
		// Seed a large football block (guaranteed >=12 cluster) + scattered fillers.
		newGrid();
		for (let c = 0; c < 4; c += 1) for (let r = 0; r < 3; r += 1) state.grid[c][r] = 'football';
		paint({ dropping: true });
		await wait(420);
		await resolveCascades();
		$('btn-spin').classList.remove('busy'); state.spinning = false;
	},
};
window.__ggrReady = true;
</script>
</body>
</html>
`;

writeFileSync(OUT, html);
console.log('Wrote', OUT);
