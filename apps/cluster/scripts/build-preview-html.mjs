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
	.spin-button.busy { pointer-events: none; filter: saturate(0.7) brightness(0.85); }
	.spin-button.busy .spin-art { animation: spin-rotor 0.7s linear infinite; }
	@keyframes spin-rotor { to { transform: rotate(360deg); } }
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
			<button type="button" class="asset-button menu" aria-label="Menu">
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
			<button type="button" class="icon-button info" aria-label="Info"><img class="button-art" src="${assets.infoButton}" alt="" /></button>
			<button type="button" class="icon-button settings" aria-label="Settings"><img class="button-art" src="${assets.settingsButton}" alt="" /></button>
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
