<script lang="ts">
	const assets = {
		background: new URL('../assets/golden-goal-rush/slot-background.png', import.meta.url).href,
		ten: new URL('../assets/golden-goal-rush/10.png', import.meta.url).href,
		j: new URL('../assets/golden-goal-rush/j.png', import.meta.url).href,
		q: new URL('../assets/golden-goal-rush/q.png', import.meta.url).href,
		k: new URL('../assets/golden-goal-rush/k.png', import.meta.url).href,
		a: new URL('../assets/golden-goal-rush/a.png', import.meta.url).href,
		football: new URL('../assets/golden-goal-rush/fussball.png', import.meta.url).href,
		trophy: new URL('../assets/golden-goal-rush/pokal.png', import.meta.url).href,
		jersey: new URL('../assets/golden-goal-rush/trikot.png', import.meta.url).href,
		whistle: new URL('../assets/golden-goal-rush/pfeife.png', import.meta.url).href,
		wild: new URL('../assets/golden-goal-rush/wild.png', import.meta.url).href,
		scatter: new URL('../assets/golden-goal-rush/scatter.png', import.meta.url).href,
		spin: new URL('../assets/golden-goal-rush/ui/spin.png', import.meta.url).href,
		autoSpin: new URL('../assets/golden-goal-rush/ui/autospin.png', import.meta.url).href,
		turbo: new URL('../assets/golden-goal-rush/ui/blitz.png', import.meta.url).href,
		betUp: new URL('../assets/golden-goal-rush/ui/einsatz-hoch.png', import.meta.url).href,
		betDown: new URL('../assets/golden-goal-rush/ui/einsatz-runter.png', import.meta.url).href,
	};

	type SymbolTile = {
		src: string;
		label: string;
		size?: 'wide' | 'feature';
	};

	const board: SymbolTile[] = [
		{ src: assets.jersey, label: 'Jersey', size: 'wide' },
		{ src: assets.trophy, label: 'Trophy' },
		{ src: assets.k, label: 'K' },
		{ src: assets.football, label: 'Football', size: 'feature' },
		{ src: assets.ten, label: '10' },
		{ src: assets.scatter, label: 'Scatter', size: 'wide' },
		{ src: assets.q, label: 'Q' },
		{ src: assets.ten, label: '10' },
		{ src: assets.jersey, label: 'Jersey', size: 'wide' },
		{ src: assets.a, label: 'A' },
		{ src: assets.whistle, label: 'Whistle', size: 'feature' },
		{ src: assets.j, label: 'J' },
		{ src: assets.wild, label: 'Wild', size: 'feature' },
		{ src: assets.j, label: 'J' },
		{ src: assets.trophy, label: 'Trophy' },
		{ src: assets.q, label: 'Q' },
		{ src: assets.k, label: 'K' },
		{ src: assets.jersey, label: 'Jersey', size: 'wide' },
		{ src: assets.ten, label: '10' },
		{ src: assets.football, label: 'Football', size: 'feature' },
		{ src: assets.j, label: 'J' },
		{ src: assets.scatter, label: 'Scatter', size: 'wide' },
		{ src: assets.a, label: 'A' },
		{ src: assets.q, label: 'Q' },
		{ src: assets.j, label: 'J' },
		{ src: assets.jersey, label: 'Jersey', size: 'wide' },
		{ src: assets.k, label: 'K' },
		{ src: assets.whistle, label: 'Whistle', size: 'feature' },
		{ src: assets.trophy, label: 'Trophy' },
		{ src: assets.ten, label: '10' },
	];

	const meters = [
		{ label: 'BALANCE', value: '$0.00', icon: 'wallet' },
		{ label: 'WIN', value: '$0.00', icon: 'cup' },
		{ label: 'BET', value: '$1.00', icon: 'coin' },
	];
</script>

<section class="stage" aria-label="Golden Goal Rush final visual direction preview">
	<img class="background" src={assets.background} alt="" />
	<div class="stadium-vignette"></div>
	<div class="top-light left"></div>
	<div class="top-light right"></div>

	<div class="logo-wordmark" aria-label="Golden Goal Rush">
		<span>GOLDEN G</span>
		<img class="logo-ball" src={assets.football} alt="" />
		<span>AL RUSH</span>
	</div>
	<div class="world-plaque">WORLD STADIUM</div>

	<div class="board-wrap">
		<div class="board-glow"></div>
		<div class="board-frame">
			<div class="side-badge left">243<span>WAYS</span></div>
			<div class="side-badge right">243<span>WAYS</span></div>
			<div class="board">
				{#each board as symbol}
					<div class="cell">
						<img class={symbol.size ?? ''} src={symbol.src} alt={symbol.label} />
					</div>
				{/each}
			</div>
		</div>
	</div>

	<div class="meters">
		{#each meters as meter}
			<div class="meter">
				<div class="meter-icon" data-icon={meter.icon}></div>
				<div>
					<div class="meter-label">{meter.label}</div>
					<div class="meter-value">{meter.value}</div>
				</div>
			</div>
		{/each}
	</div>

	<div class="controls">
		<button type="button" class="control-button menu" aria-label="Menu">
			<span class="hamburger"></span>
			<span>MENU</span>
		</button>
		<button type="button" class="control-button bonus" aria-label="Buy Bonus">
			<img src={assets.football} alt="" />
			<span>BUY BONUS</span>
		</button>
		<button type="button" class="control-button" aria-label="Auto Spin">
			<img src={assets.autoSpin} alt="" />
			<span>AUTO SPIN</span>
		</button>
		<div class="spacer-panel"></div>
		<button type="button" class="spin-button" aria-label="Spin">
			<img src={assets.spin} alt="" />
			<span>SPIN</span>
		</button>
		<button type="button" class="control-button turbo" aria-label="Turbo">
			<img src={assets.turbo} alt="" />
			<span>TURBO</span>
		</button>
		<div class="bet-controls" aria-label="Bet controls">
			<button type="button" aria-label="Decrease bet">
				<img src={assets.betDown} alt="" />
			</button>
			<div class="bet-display">
				<span>BET</span>
				<strong>$1.00</strong>
			</div>
			<button type="button" aria-label="Increase bet">
				<img src={assets.betUp} alt="" />
			</button>
		</div>
		<button type="button" class="small-button info" aria-label="Info">i</button>
		<button type="button" class="small-button settings" aria-label="Settings"></button>
	</div>
</section>

<style>
	.stage {
		position: relative;
		width: 1200px;
		height: 675px;
		overflow: hidden;
		background: #020406;
		color: #ffd86d;
		font-family: Inter, Arial, sans-serif;
		letter-spacing: 0;
	}

	.background,
	.stadium-vignette {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	.background {
		object-fit: cover;
	}

	.stadium-vignette {
		background:
			radial-gradient(circle at 50% 18%, rgba(255, 206, 69, 0.18), transparent 28%),
			linear-gradient(180deg, rgba(0, 0, 0, 0.34) 0%, transparent 36%, rgba(0, 0, 0, 0.54) 100%),
			radial-gradient(circle at 50% 50%, transparent 43%, rgba(0, 0, 0, 0.62) 100%);
	}

	.top-light {
		position: absolute;
		top: 62px;
		width: 160px;
		height: 160px;
		border-radius: 50%;
		background: radial-gradient(
			circle,
			rgba(255, 245, 215, 0.9) 0 8%,
			rgba(255, 180, 73, 0.35) 16%,
			transparent 56%
		);
		filter: blur(1px);
		opacity: 0.85;
	}

	.top-light.left {
		left: 18px;
	}

	.top-light.right {
		right: 18px;
	}

	.logo-wordmark {
		position: absolute;
		top: 8px;
		left: 50%;
		z-index: 4;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 980px;
		height: 62px;
		gap: 0;
		transform: translateX(-50%);
		background: linear-gradient(180deg, #fff8bf 0%, #ffc84d 34%, #9c4f08 76%, #ffe27a 100%);
		background-clip: text;
		color: #ffcf5a;
		font-family:
			Arial Black,
			Impact,
			Arial,
			sans-serif;
		font-size: 48px;
		font-style: italic;
		font-weight: 1000;
		line-height: 1;
		white-space: nowrap;
		text-align: center;
		text-shadow:
			0 1px 0 #fff0a0,
			0 3px 0 #5e2601,
			0 5px 7px rgba(0, 0, 0, 0.95),
			0 0 18px rgba(255, 190, 38, 0.85);
		-webkit-background-clip: text;
		-webkit-text-fill-color: #ffd45c;
		-webkit-text-stroke: 2px #4b2101;
	}

	.logo-wordmark span {
		display: block;
		flex: 0 0 auto;
	}

	.logo-wordmark::before,
	.logo-wordmark::after {
		content: '';
		flex: 0 0 86px;
		width: 86px;
		height: 13px;
		margin: 0 14px;
		border-top: 4px solid #f7c85a;
		border-bottom: 4px solid #9f5a12;
		transform: skewX(-28deg);
		background: linear-gradient(90deg, transparent, rgba(255, 236, 130, 0.95), transparent);
		box-shadow: 0 2px 4px #000;
	}

	.logo-wordmark::after {
		transform: skewX(28deg);
	}

	.logo-ball {
		width: 52px;
		height: 52px;
		flex: 0 0 auto;
		margin: 0 -1px 0 -2px;
		object-fit: contain;
		filter: drop-shadow(0 2px 2px #000) drop-shadow(0 0 8px rgba(255, 217, 82, 0.75));
	}

	.world-plaque {
		position: absolute;
		top: 82px;
		left: 50%;
		z-index: 7;
		min-width: 310px;
		padding: 6px 24px 7px;
		transform: translateX(-50%);
		border: 2px solid rgba(245, 188, 62, 0.95);
		border-radius: 999px;
		background: linear-gradient(180deg, #1c1b17 0%, #050505 100%);
		box-shadow:
			0 0 0 2px rgba(0, 0, 0, 0.75),
			0 0 16px rgba(255, 190, 42, 0.45);
		color: #ffd36a;
		font-size: 20px;
		font-weight: 900;
		line-height: 1;
		text-align: center;
		text-shadow: 0 2px 2px #000;
	}

	.world-plaque::before,
	.world-plaque::after {
		content: '*';
		margin: 0 10px;
		color: #fff1a5;
		font-size: 13px;
		vertical-align: 2px;
	}

	.board-wrap {
		position: absolute;
		top: 105px;
		left: 171px;
		z-index: 3;
		width: 858px;
		height: 410px;
	}

	.board-glow {
		position: absolute;
		inset: -30px -44px;
		border-radius: 36px;
		background:
			linear-gradient(90deg, rgba(8, 107, 44, 0.62), transparent 12% 88%, rgba(8, 107, 44, 0.62)),
			radial-gradient(circle at 50% -2%, rgba(255, 208, 54, 0.38), transparent 28%);
		filter: blur(2px);
		opacity: 0.9;
	}

	.board-frame {
		position: absolute;
		inset: -18px -25px;
		padding: 18px 25px;
		border: 6px solid #e7b84e;
		border-radius: 30px;
		background:
			linear-gradient(90deg, rgba(0, 74, 25, 0.9), transparent 7% 93%, rgba(0, 74, 25, 0.9)),
			linear-gradient(180deg, #0b0f0d 0%, #060606 100%);
		box-shadow:
			inset 0 0 0 2px #4c2a09,
			inset 0 0 0 7px rgba(255, 231, 119, 0.24),
			0 0 0 4px rgba(5, 5, 5, 0.92),
			0 0 34px rgba(255, 191, 44, 0.75);
	}

	.side-badge {
		position: absolute;
		top: 39%;
		display: grid;
		width: 61px;
		min-height: 73px;
		place-items: center;
		border: 3px solid #dca943;
		border-radius: 15px;
		background: linear-gradient(180deg, #2a2a27 0%, #080808 100%);
		box-shadow:
			inset 0 0 10px rgba(255, 214, 93, 0.25),
			0 0 12px rgba(0, 0, 0, 0.75);
		color: #ffe284;
		font-size: 21px;
		font-weight: 1000;
		line-height: 1;
		text-align: center;
		text-shadow: 0 2px 3px #000;
	}

	.side-badge span {
		display: block;
		font-size: 16px;
		line-height: 1.1;
	}

	.side-badge.left {
		left: -75px;
	}

	.side-badge.right {
		right: -75px;
	}

	.board {
		position: relative;
		display: grid;
		width: 100%;
		height: 100%;
		overflow: hidden;
		grid-template-columns: repeat(6, 1fr);
		grid-template-rows: repeat(5, 1fr);
		border: 2px solid rgba(255, 215, 91, 0.92);
		border-radius: 13px;
		background: #02070b;
		box-shadow:
			inset 0 0 38px rgba(0, 0, 0, 0.78),
			inset 0 0 0 999px rgba(0, 12, 20, 0.3);
	}

	.cell {
		position: relative;
		display: grid;
		overflow: hidden;
		place-items: center;
		border-right: 1px solid rgba(203, 139, 33, 0.74);
		border-bottom: 1px solid rgba(203, 139, 33, 0.74);
		background:
			radial-gradient(circle at 50% 42%, rgba(18, 45, 43, 0.38), transparent 60%),
			linear-gradient(180deg, rgba(4, 16, 24, 0.92), rgba(2, 5, 9, 0.94));
	}

	.cell:nth-child(6n) {
		border-right: 0;
	}

	.cell:nth-last-child(-n + 6) {
		border-bottom: 0;
	}

	.cell img {
		max-width: 72%;
		max-height: 78%;
		object-fit: contain;
		filter: drop-shadow(0 5px 6px rgba(0, 0, 0, 0.78)) drop-shadow(0 0 7px rgba(255, 188, 46, 0.22));
	}

	.cell img.wide {
		max-width: 83%;
		max-height: 82%;
	}

	.cell img.feature {
		max-width: 80%;
		max-height: 86%;
	}

	.meters {
		position: absolute;
		top: 533px;
		left: 174px;
		z-index: 7;
		display: grid;
		width: 852px;
		grid-template-columns: repeat(3, 1fr);
		gap: 18px;
	}

	.meter {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 48px;
		gap: 14px;
		border: 3px solid #c99135;
		border-radius: 12px;
		background:
			linear-gradient(180deg, rgba(42, 42, 39, 0.96), rgba(4, 4, 4, 0.98)),
			radial-gradient(circle at 50% 0%, rgba(255, 218, 90, 0.18), transparent 62%);
		box-shadow:
			inset 0 0 0 2px #050505,
			0 0 12px rgba(0, 0, 0, 0.8);
		text-shadow: 0 2px 2px #000;
	}

	.meter-icon {
		position: relative;
		width: 32px;
		height: 27px;
		color: #ffd05f;
	}

	.meter-icon::before,
	.meter-icon::after {
		content: '';
		position: absolute;
		display: block;
		box-sizing: border-box;
	}

	.meter-icon[data-icon='wallet']::before {
		inset: 6px 2px 3px;
		border: 3px solid currentcolor;
		border-radius: 4px;
	}

	.meter-icon[data-icon='wallet']::after {
		right: 3px;
		bottom: 9px;
		width: 9px;
		height: 7px;
		border: 2px solid currentcolor;
		border-radius: 3px;
	}

	.meter-icon[data-icon='cup']::before {
		left: 8px;
		top: 4px;
		width: 16px;
		height: 15px;
		border: 3px solid currentcolor;
		border-top: 0;
		border-radius: 0 0 9px 9px;
	}

	.meter-icon[data-icon='cup']::after {
		left: 11px;
		bottom: 2px;
		width: 10px;
		height: 9px;
		border-bottom: 4px solid currentcolor;
	}

	.meter-icon[data-icon='coin']::before {
		left: 7px;
		top: 2px;
		width: 18px;
		height: 22px;
		border: 3px solid currentcolor;
		border-radius: 50%;
		box-shadow: inset 0 0 0 3px rgba(255, 208, 74, 0.2);
	}

	.meter-label {
		color: #ffd96f;
		font-size: 15px;
		font-weight: 900;
		line-height: 1;
		text-align: center;
	}

	.meter-value {
		margin-top: 3px;
		color: #fff;
		font-size: 23px;
		font-weight: 1000;
		line-height: 1;
		text-align: center;
	}

	.controls {
		position: absolute;
		bottom: 10px;
		left: 25px;
		z-index: 6;
		display: flex;
		align-items: end;
		width: 1150px;
		height: 86px;
		gap: 13px;
	}

	button {
		padding: 0;
		border: 0;
		color: inherit;
		font: inherit;
	}

	.control-button,
	.small-button,
	.bet-controls,
	.spacer-panel {
		height: 72px;
		border: 3px solid #bd8730;
		border-radius: 12px;
		background: linear-gradient(180deg, #2b2c2b 0%, #08090a 100%);
		box-shadow:
			inset 0 0 0 2px #050505,
			inset 0 0 12px rgba(255, 210, 92, 0.18),
			0 0 8px rgba(0, 0, 0, 0.8);
	}

	.control-button {
		display: grid;
		width: 86px;
		place-items: center;
		grid-template-rows: 38px 22px;
		color: #ffd96f;
		font-size: 13px;
		font-weight: 1000;
		text-shadow: 0 2px 2px #000;
	}

	.control-button img {
		max-width: 38px;
		max-height: 34px;
		object-fit: contain;
	}

	.control-button.bonus {
		width: 112px;
	}

	.control-button.bonus img {
		max-width: 42px;
	}

	.hamburger,
	.hamburger::before,
	.hamburger::after {
		display: block;
		width: 30px;
		height: 4px;
		border-radius: 8px;
		background: #ffd86a;
		box-shadow: 0 0 5px rgba(255, 205, 63, 0.38);
	}

	.hamburger {
		position: relative;
	}

	.hamburger::before,
	.hamburger::after {
		content: '';
		position: absolute;
		left: 0;
	}

	.hamburger::before {
		top: -10px;
	}

	.hamburger::after {
		top: 10px;
	}

	.spacer-panel {
		width: 130px;
		opacity: 0.9;
	}

	.spin-button {
		position: relative;
		display: grid;
		width: 100px;
		height: 100px;
		margin-right: 28px;
		margin-left: 16px;
		place-items: center;
		align-self: end;
		border-radius: 50%;
		background:
			radial-gradient(circle at 50% 55%, #17191a 0 42%, #050505 55%),
			linear-gradient(180deg, #ffe088 0%, #9b5a13 100%);
		box-shadow:
			0 0 0 4px #050505,
			0 0 0 7px #e5ae39,
			0 0 22px rgba(255, 197, 48, 0.9);
		color: #ffdc6c;
		font-size: 23px;
		font-weight: 1000;
		text-shadow: 0 3px 2px #000;
	}

	.spin-button img {
		position: absolute;
		inset: 5px;
		width: calc(100% - 10px);
		height: calc(100% - 10px);
		object-fit: contain;
		opacity: 0.8;
	}

	.spin-button span {
		position: relative;
		z-index: 1;
		margin-top: 33px;
	}

	.turbo {
		width: 84px;
	}

	.turbo img {
		max-width: 28px;
	}

	.bet-controls {
		display: grid;
		width: 220px;
		grid-template-columns: 58px 1fr 58px;
		overflow: hidden;
	}

	.bet-controls button {
		display: grid;
		place-items: center;
		background: linear-gradient(180deg, #350807, #090405);
		border-right: 2px solid #73201a;
	}

	.bet-controls button:last-child {
		border-right: 0;
		border-left: 2px solid #73201a;
	}

	.bet-controls img {
		width: 34px;
		height: 34px;
		object-fit: contain;
	}

	.bet-display {
		display: grid;
		place-items: center;
		background: linear-gradient(180deg, #01340f 0 28%, #030303 29% 100%);
		text-shadow: 0 2px 2px #000;
	}

	.bet-display span {
		color: #ffdb6f;
		font-size: 15px;
		font-weight: 1000;
		line-height: 1;
	}

	.bet-display strong {
		color: #fff;
		font-size: 17px;
		line-height: 1;
	}

	.small-button {
		position: relative;
		display: grid;
		width: 55px;
		place-items: center;
		color: #f4f4f4;
		font-size: 34px;
		font-weight: 900;
		text-shadow: 0 2px 3px #000;
	}

	.settings::before,
	.settings::after {
		content: '';
		position: absolute;
		display: block;
		box-sizing: border-box;
		border-radius: 50%;
	}

	.settings::before {
		width: 29px;
		height: 29px;
		border: 7px solid #f4f4f4;
		box-shadow: 0 2px 3px #000;
	}

	.settings::after {
		width: 9px;
		height: 9px;
		background: #101010;
	}
</style>
