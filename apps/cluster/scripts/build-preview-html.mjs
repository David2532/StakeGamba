/**
 * Generates a standalone, self-contained preview.html from the
 * GoldenGoalRushFinalPreview.svelte component so the Golden Goal Rush visual
 * direction can be opened directly in any browser (no Storybook / bundler).
 *
 * The Svelte component remains the single source of truth: this script reads
 * its <style> block verbatim and re-emits the same markup with asset paths
 * resolved relative to apps/cluster/. Run after editing the component:
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
	ten: `${A}/10.png`,
	j: `${A}/j.png`,
	q: `${A}/q.png`,
	k: `${A}/k.png`,
	a: `${A}/a.png`,
	football: `${A}/fussball.png`,
	trophy: `${A}/pokal.png`,
	jersey: `${A}/trikot.png`,
	whistle: `${A}/pfeife.png`,
	wild: `${A}/wild.png`,
	scatter: `${A}/scatter.png`,
	coin: `${SPECIAL}/coin_1x.png`,
	collector: `${SPECIAL}/symbol_collector.png`,
	multiplier: `${SPECIAL}/symbol_multiplier.png`,
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

const board = [
	['jersey', 'Jersey', 'wide'], ['trophy', 'Trophy'], ['k', 'K'], ['football', 'Football', 'feature'], ['ten', '10'], ['scatter', 'Scatter', 'wide'],
	['q', 'Q'], ['ten', '10'], ['jersey', 'Jersey', 'wide'], ['a', 'A'], ['whistle', 'Whistle', 'feature'], ['j', 'J'],
	['wild', 'Wild', 'feature'], ['j', 'J'], ['trophy', 'Trophy'], ['q', 'Q'], ['k', 'K'], ['jersey', 'Jersey', 'wide'],
	['ten', '10'], ['football', 'Football', 'feature'], ['j', 'J'], ['scatter', 'Scatter', 'wide'], ['a', 'A'], ['q', 'Q'],
	['j', 'J'], ['jersey', 'Jersey', 'wide'], ['k', 'K'], ['whistle', 'Whistle', 'feature'], ['trophy', 'Trophy'], ['ten', '10'],
];

const meters = [
	['BALANCE', '$0.00', 'coin', 'meterPanelA'],
	['WIN', '$0.00', 'trophy', 'meterPanelB'],
	['BET', '$1.00', 'coin', 'meterPanelC'],
];

const features = [
	['COLLECT', 'collector'],
	['MULTI', 'multiplier'],
	['FREE SPINS', 'scatter'],
];

const cells = board
	.map(([key, label, size]) => `\t\t\t\t\t<div class="cell"><img class="${size ?? ''}" src="${assets[key]}" alt="${label}" /></div>`)
	.join('\n');

const meterRows = meters
	.map(
		([label, value, icon, frame]) => `\t\t\t<div class="meter">
				<img class="panel-art" src="${assets[frame]}" alt="" />
				<img class="meter-asset-icon" src="${assets[icon]}" alt="" />
				<div><div class="meter-label">${label}</div><div class="meter-value">${value}</div></div>
			</div>`,
	)
	.join('\n');

const featureItems = features
	.map(([label, icon]) => `\t\t\t\t\t<div class="feature-item"><img src="${assets[icon]}" alt="" /><span>${label}</span></div>`)
	.join('\n');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Golden Goal Rush — Final Direction Preview</title>
<style>
	* { box-sizing: border-box; }
	html, body { margin: 0; height: 100%; background: #05080f; display: grid; place-items: center; }
	.viewport { width: 1200px; height: 675px; }
${style}
</style>
</head>
<body>
	<div class="viewport">
	<section class="stage" aria-label="Golden Goal Rush final visual direction preview">
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
				<div class="board">
${cells}
				</div>
			</div>
		</div>

		<div class="meters">
${meterRows}
		</div>

		<div class="controls">
			<button type="button" class="asset-button menu" aria-label="Menu">
				<img class="button-art" src="${assets.menuButton}" alt="" /><span>MENU</span>
			</button>
			<button type="button" class="asset-button bonus" aria-label="Buy Bonus">
				<img class="button-art" src="${assets.bonusButton}" alt="" /><span>BUY BONUS</span>
			</button>
			<button type="button" class="asset-button" aria-label="Auto Spin">
				<img class="button-art" src="${assets.autoSpinButton}" alt="" /><span>AUTO SPIN</span>
			</button>
			<div class="feature-control" aria-label="Golden Goal Rush feature logic preview">
				<img class="button-art" src="${assets.featurePanel}" alt="" />
				<div class="feature-items">
${featureItems}
				</div>
			</div>
			<button type="button" class="spin-button" aria-label="Spin">
				<img class="spin-art" src="${assets.spinButton}" alt="" /><span>SPIN</span>
			</button>
			<button type="button" class="asset-button turbo" aria-label="Turbo">
				<img class="button-art" src="${assets.turboButton}" alt="" /><span>TURBO</span>
			</button>
			<div class="bet-controls" aria-label="Bet controls">
				<img class="button-art" src="${assets.controlPanel}" alt="" />
				<button type="button" aria-label="Decrease bet"><img src="${assets.minusButton}" alt="" /></button>
				<div class="bet-display"><span>BET</span><strong>$1.00</strong></div>
				<button type="button" aria-label="Increase bet"><img src="${assets.plusButton}" alt="" /></button>
			</div>
			<button type="button" class="icon-button info" aria-label="Info"><img class="button-art" src="${assets.infoButton}" alt="" /></button>
			<button type="button" class="icon-button settings" aria-label="Settings"><img class="button-art" src="${assets.settingsButton}" alt="" /></button>
		</div>
	</section>
	</div>
</body>
</html>
`;

writeFileSync(OUT, html);
console.log('Wrote', OUT);
