<script lang="ts">
	import { onMount } from 'svelte';

	const DESIGN_WIDTH = 1200;
	const DESIGN_HEIGHT = 675;
	const START_BALANCE = 10000;
	const ADD_TEST_MONEY_AMOUNT = 10000;
	const BET_OPTIONS = [0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];

	const assets = {
		background: new URL('../assets/golden-goal-rush/slot-background.png', import.meta.url).href,
		logo: new URL('../assets/golden-goal-rush/logo-horizontal.png', import.meta.url).href,
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
		collector: new URL('../assets/golden-goal-rush/special/symbol_collector.png', import.meta.url)
			.href,
		multiplier: new URL('../assets/golden-goal-rush/special/symbol_multiplier.png', import.meta.url)
			.href,
		featurePanel: new URL(
			'../assets/golden-goal-rush/hud-extracted/feature-panel.png',
			import.meta.url,
		).href,
		reelFrame: new URL(
			'../assets/golden-goal-rush/hud-extracted/reel-frame-gold-empty.png',
			import.meta.url,
		).href,
		waysBadge: new URL(
			'../assets/golden-goal-rush/hud-extracted/ways-badge-empty.png',
			import.meta.url,
		).href,
		betStepperFrame: new URL(
			'../assets/golden-goal-rush/hud-extracted/hud-bet-stepper-frame-empty.png',
			import.meta.url,
		).href,
		hudPanelWide: new URL(
			'../assets/golden-goal-rush/hud-extracted/hud_panel_wide_empty.png',
			import.meta.url,
		).href,
		menuButton: new URL('../assets/golden-goal-rush/hud-extracted/menu-button.png', import.meta.url)
			.href,
		bonusButton: new URL(
			'../assets/golden-goal-rush/hud-extracted/bonus-button.png',
			import.meta.url,
		).href,
		autoSpinButton: new URL(
			'../assets/golden-goal-rush/hud-extracted/autospin-button.png',
			import.meta.url,
		).href,
		turboButton: new URL(
			'../assets/golden-goal-rush/hud-extracted/turbo-button.png',
			import.meta.url,
		).href,
		spinButton: new URL(
			'../assets/golden-goal-rush/hud-extracted/spin-button-active.png',
			import.meta.url,
		).href,
		minusButton: new URL(
			'../assets/golden-goal-rush/hud-extracted/minus-button.png',
			import.meta.url,
		).href,
		plusButton: new URL('../assets/golden-goal-rush/hud-extracted/plus-button.png', import.meta.url)
			.href,
		infoButton: new URL('../assets/golden-goal-rush/hud-extracted/info-button.png', import.meta.url)
			.href,
		settingsButton: new URL(
			'../assets/golden-goal-rush/hud-extracted/settings-button.png',
			import.meta.url,
		).href,
	};

	type SymbolTile = {
		src: string;
		label: string;
		highlight?: 'win' | 'golden' | 'scatter' | 'collector' | 'reward';
		reward?: string;
	};

	type Modal = 'bonus' | 'rules' | 'debug' | 'confirm' | 'message' | null;

	type BonusOption = {
		name: string;
		description: string;
		costMultiplier: number;
		volatility: string;
		mode: 'feature' | 'collector' | 'golden' | 'trophy';
	};

	type FeatureMode = BonusOption['mode'];

	const symbolPool: SymbolTile[] = [
		{ src: assets.jersey, label: 'Jersey' },
		{ src: assets.trophy, label: 'Trophy' },
		{ src: assets.k, label: 'K' },
		{ src: assets.football, label: 'Football' },
		{ src: assets.ten, label: '10' },
		{ src: assets.scatter, label: 'Scatter' },
		{ src: assets.q, label: 'Q' },
		{ src: assets.a, label: 'A' },
		{ src: assets.whistle, label: 'Whistle' },
		{ src: assets.j, label: 'J' },
		{ src: assets.wild, label: 'Wild' },
	];

	const initialBoard: SymbolTile[] = [
		symbolPool[0],
		symbolPool[1],
		symbolPool[2],
		symbolPool[3],
		symbolPool[4],
		symbolPool[5],
		symbolPool[6],
		symbolPool[4],
		symbolPool[0],
		symbolPool[7],
		symbolPool[8],
		symbolPool[9],
		symbolPool[10],
		symbolPool[9],
		symbolPool[1],
		symbolPool[6],
		symbolPool[2],
		symbolPool[0],
		symbolPool[4],
		symbolPool[3],
		symbolPool[9],
		symbolPool[5],
		symbolPool[7],
		symbolPool[6],
		symbolPool[9],
		symbolPool[0],
		symbolPool[2],
		symbolPool[8],
		symbolPool[1],
		symbolPool[4],
	];

	const bonusOptions: BonusOption[] = [
		{
			name: 'Feature Spins',
			description: 'Preview TODO: higher Scatter pressure, final cost needs math audit.',
			costMultiplier: 3,
			volatility: 'Medium',
			mode: 'feature',
		},
		{
			name: 'Collector Rush',
			description: 'Goal Collector presence is boosted and Golden Tiles activate more often.',
			costMultiplier: 50,
			volatility: 'High',
			mode: 'collector',
		},
		{
			name: 'Golden Goal Bonus',
			description: '8 free spins with persistent Golden Tiles and moderate Stadium Rewards.',
			costMultiplier: 100,
			volatility: 'Very High',
			mode: 'golden',
		},
		{
			name: 'Trophy Rush Bonus',
			description: 'Top finale preview with forced Goal Collector pressure and higher volatility.',
			costMultiplier: 250,
			volatility: 'Extreme',
			mode: 'trophy',
		},
	];

	const goldenTileIndexes = [7, 8, 13, 14, 19, 20];
	const collectorIndexesByMode: Record<FeatureMode, number[]> = {
		feature: [11],
		collector: [4, 22],
		golden: [11, 23],
		trophy: [3, 10, 17, 24],
	};
	const rewardIndexesByMode: Record<FeatureMode, number[]> = {
		feature: [13],
		collector: [8, 19],
		golden: [8, 14, 20],
		trophy: [7, 13, 19, 20],
	};
	const rewardLabelsByMode: Record<FeatureMode, string[]> = {
		feature: ['Goal Reward 2x'],
		collector: ['Coin 5x', 'x3 Multi'],
		golden: ['Coin 10x', 'Trophy 25x', '+1 Spin'],
		trophy: ['Trophy 50x', 'Coin 100x', 'x5 Multi', '+2 Spins'],
	};

	const rules = [
		{
			title: 'How to Play',
			text: 'Set a bet, press Spin, and use the dev controls to add test money or force preview outcomes. This Storybook screen is a local preview, not final RTP/math.',
		},
		{
			title: 'Symbols / Paytable',
			text: 'Football, trophy, jersey, whistle, Wild, Scatter, and card symbols are preview symbols. Final payout values must be aligned with the real math package.',
		},
		{
			title: 'Cluster Pays',
			text: 'Preview TODO: connected symbol groups should pay from the configured minimum cluster size once final math is locked.',
		},
		{
			title: 'Cascades',
			text: 'Winning symbols disappear and new symbols fall in during the final engine flow. This preview only simulates the visual result.',
		},
		{
			title: 'Special Symbols',
			text: 'Golden Tiles, Goal Collector, Scatter, and Wild are shown as original Golden Goal Rush concepts without third-party names, brands, or assets.',
		},
		{
			title: 'Free Spins',
			text: 'Preview TODO: Scatter-triggered free spins and retriggers must match real book events before publish.',
		},
		{
			title: 'Bonus Buy',
			text: 'Bonus Buy costs are preview xBet values. Purchases deduct local Storybook balance only.',
		},
		{
			title: 'Max Win',
			text: 'Max win cap target is 10,000x bet. Preview TODO: final cap enforcement must be validated in production books.',
		},
	];

	let scale = $state(1);
	let balance = $state(START_BALANCE);
	let betIndex = $state(2);
	let win = $state(0);
	let board = $state<SymbolTile[]>(initialBoard);
	let modal = $state<Modal>(null);
	let selectedBonus = $state<BonusOption | null>(null);
	let message = $state('');
	let isSpinning = $state(false);
	let isTurbo = $state(false);
	let isAuto = $state(false);
	let spinCount = $state(0);
	let bonusLabel = $state('BASE GAME');
	let goldenTileCount = $state(0);
	let collectorFlash = $state(false);
	let bigWinFlash = $state(false);
	let featureNotice = $state('Base tiles clear after paid spins');
	let currentTierName = $state('Base Game');
	let lastRewards = $state<string[]>(['Stadium Rewards ready']);

	const bet = $derived(BET_OPTIONS[betIndex]);
	const balanceText = $derived(formatCurrency(balance));
	const winText = $derived(formatCurrency(win));
	const betText = $derived(formatCurrency(bet));
	const waysText = '243';
	const canDecreaseBet = $derived(betIndex > 0 && !isSpinning);
	const canIncreaseBet = $derived(betIndex < BET_OPTIONS.length - 1 && !isSpinning);
	const canSpin = $derived(!isSpinning && balance >= bet);

	const meters = $derived([
		{ label: 'BALANCE', value: balanceText, frame: assets.hudPanelWide },
		{ label: 'WIN', value: winText, frame: assets.hudPanelWide },
		{ label: 'BET', value: betText, frame: assets.hudPanelWide },
	]);

	const features = $derived([
		{ label: 'TILES', icon: assets.trophy, active: goldenTileCount > 0 },
		{ label: 'COLLECT', icon: assets.collector, active: collectorFlash || bonusLabel !== 'BASE GAME' },
		{ label: 'REWARDS', icon: assets.multiplier, active: win > 0 || lastRewards.length > 1 },
	]);

	function formatCurrency(value: number) {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
			minimumFractionDigits: 2,
		}).format(value);
	}

	function updateScale() {
		if (typeof window === 'undefined') return;

		scale = Math.min(window.innerWidth / DESIGN_WIDTH, window.innerHeight / DESIGN_HEIGHT);
	}

	function cloneSymbol(
		symbol: SymbolTile,
		highlight?: SymbolTile['highlight'],
		reward?: string,
	): SymbolTile {
		return { src: symbol.src, label: symbol.label, highlight, reward };
	}

	function featureSymbolFor(index: number, featureMode: FeatureMode): SymbolTile | null {
		if (collectorIndexesByMode[featureMode].includes(index)) {
			return { src: assets.collector, label: 'Goal Collector', highlight: 'collector' };
		}

		const rewardIndex = rewardIndexesByMode[featureMode].indexOf(index);
		if (rewardIndex >= 0) {
			const reward = rewardLabelsByMode[featureMode][rewardIndex % rewardLabelsByMode[featureMode].length];
			const isMultiplier = reward.includes('x') && !reward.includes('Coin') && !reward.includes('Trophy');
			return {
				src: isMultiplier ? assets.multiplier : reward.includes('Trophy') ? assets.trophy : assets.football,
				label: 'Stadium Reward',
				highlight: 'reward',
				reward,
			};
		}

		return null;
	}

	function buildDemoBoard(
		seed: number,
		mode: 'base' | 'win' | 'bonus' = 'base',
		featureMode: FeatureMode = 'golden',
	) {
		return Array.from({ length: 30 }, (_, index) => {
			const featureSymbol = mode === 'bonus' ? featureSymbolFor(index, featureMode) : null;
			if (featureSymbol) return featureSymbol;

			const symbol = symbolPool[(index * 7 + seed * 3 + (isTurbo ? 2 : 0)) % symbolPool.length];
			const highlight =
				mode === 'bonus' && [0, 11, 17, 23].includes(index)
					? 'scatter'
					: mode !== 'base' && goldenTileIndexes.includes(index)
						? 'golden'
						: undefined;

			return cloneSymbol(symbol, highlight);
		});
	}

	function clearBaseGoldenTiles(expectedSpinCount: number) {
		window.setTimeout(() => {
			if (spinCount !== expectedSpinCount || isSpinning || bonusLabel !== 'BASE GAME') return;
			goldenTileCount = 0;
			featureNotice = 'Base Golden Tiles reset after the round';
			board = board.map((symbol) =>
				symbol.highlight === 'golden' ? cloneSymbol(symbol) : symbol,
			);
		}, isTurbo ? 760 : 1400);
	}

	function openMessage(text: string) {
		message = text;
		modal = 'message';
	}

	function spin(
		mode: 'base' | 'win' | 'bonus' = 'base',
		chargeBet = true,
		featureMode: FeatureMode = 'golden',
	) {
		if (isSpinning) return;

		if (chargeBet && balance < bet) {
			openMessage('Not enough preview balance. Use Add Test Money to continue testing.');
			return;
		}

		isSpinning = true;
		if (chargeBet) balance = roundMoney(balance - bet);
		win = 0;
		spinCount += 1;
		collectorFlash = false;
		bigWinFlash = false;
		currentTierName = mode === 'bonus' ? bonusOptions.find((option) => option.mode === featureMode)?.name ?? 'Bonus Preview' : 'Base Game';
		featureNotice = mode === 'bonus' ? 'Golden Tiles stay live for Goal Collector hits' : 'Looking for cluster wins';
		lastRewards = mode === 'bonus' ? rewardLabelsByMode[featureMode] : ['Stadium Rewards ready'];
		goldenTileCount = 0;
		board = buildDemoBoard(spinCount, 'base');

		window.setTimeout(
			() => {
				const multiplier =
					mode === 'bonus'
						? featureMode === 'trophy'
							? 58
							: featureMode === 'collector'
								? 26
								: featureMode === 'golden'
									? 18
									: 10
						: mode === 'win'
							? 8
							: spinCount % 3 === 0
								? 3
								: 0;
				win = roundMoney(bet * multiplier);
				balance = roundMoney(balance + win);
				board = buildDemoBoard(
					spinCount + 1,
					multiplier > 0 ? (mode === 'bonus' ? 'bonus' : 'win') : 'base',
					featureMode,
				);
				goldenTileCount = multiplier > 0 ? goldenTileIndexes.length : 0;
				collectorFlash = mode === 'bonus';
				bigWinFlash = multiplier >= 26;
				featureNotice =
					mode === 'bonus'
						? 'Goal Collector activated Stadium Rewards'
						: multiplier > 0
							? 'Golden Tiles flashed and will clear'
							: 'No Golden Tiles this round';
				bonusLabel = mode === 'bonus' ? `${currentTierName.toUpperCase()} PREVIEW` : 'BASE GAME';
				isSpinning = false;
				if (mode !== 'bonus' && multiplier > 0) clearBaseGoldenTiles(spinCount);
				if (collectorFlash) window.setTimeout(() => (collectorFlash = false), isTurbo ? 520 : 980);
				if (bigWinFlash) window.setTimeout(() => (bigWinFlash = false), isTurbo ? 780 : 1400);
			},
			isTurbo ? 180 : 520,
		);
	}

	function roundMoney(value: number) {
		return Math.round(value * 100) / 100;
	}

	function decreaseBet() {
		if (canDecreaseBet) betIndex -= 1;
	}

	function increaseBet() {
		if (canIncreaseBet) betIndex += 1;
	}

	function addTestMoney() {
		balance = roundMoney(balance + ADD_TEST_MONEY_AMOUNT);
	}

	function resetBalance() {
		balance = START_BALANCE;
		win = 0;
		betIndex = 2;
		bonusLabel = 'BASE GAME';
		currentTierName = 'Base Game';
		featureNotice = 'Base tiles clear after paid spins';
		goldenTileCount = 0;
		collectorFlash = false;
		bigWinFlash = false;
		lastRewards = ['Stadium Rewards ready'];
		board = initialBoard;
	}

	function forceBaseWin() {
		spin('win');
	}

	function forceBonus() {
		spin('bonus', true, 'trophy');
	}

	function openBonusBuy() {
		selectedBonus = null;
		modal = 'bonus';
	}

	function selectBonus(option: BonusOption) {
		selectedBonus = option;
		modal = 'confirm';
	}

	function confirmBonusBuy() {
		if (!selectedBonus) return;

		const cost = selectedBonus.costMultiplier * bet;
		if (balance < cost) {
			openMessage(`Not enough preview balance for ${selectedBonus.name}. Need ${formatCurrency(cost)}.`);
			return;
		}

		balance = roundMoney(balance - cost);
		win = 0;
		bonusLabel = `${selectedBonus.name.toUpperCase()} BONUS`;
		currentTierName = selectedBonus.name;
		modal = null;
		spin('bonus', false, selectedBonus.mode);
	}

	function closeModal() {
		modal = null;
		selectedBonus = null;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') closeModal();
	}

	onMount(updateScale);
</script>

<svelte:window onresize={updateScale} onload={updateScale} onkeydown={handleKeydown} />

<section
	class="stage"
	class:collector-flash={collectorFlash}
	class:big-win-flash={bigWinFlash}
	class:finale-mode={bonusLabel.includes('TROPHY')}
	style={`--game-scale: ${scale};`}
	aria-label="Golden Goal Rush final visual direction preview"
>
	<img class="background" src={assets.background} alt="" />
	<div class="vignette"></div>

	<div class="game-layer">
		<div class="stadium-light left"></div>
		<div class="stadium-light right"></div>
		<div class="gold-dust"></div>

<<<<<<< HEAD
		<header class="header">
			<img class="logo-wordmark" src={assets.logo} alt="Golden Goal Rush" />
			<div class="world-plaque">
				<img src={assets.featurePanel} alt="" />
				<span>* WORLD STADIUM *</span>
=======
	<div class="board-wrap">
		<div class="board-glow"></div>
		<div class="board-frame">
			<div class="side-badge left">CLUSTER<span>PAYS</span></div>
			<div class="side-badge right">CLUSTER<span>PAYS</span></div>
			<div class="board">
				{#each board as symbol}
					<div class="cell">
						<img class={symbol.size ?? ''} src={symbol.src} alt={symbol.label} />
					</div>
				{/each}
>>>>>>> a618b3461dbcf0aae13bc7718acfcc5c3a88e1ad
			</div>
		</header>

		<div class="board-wrap">
			<div class="frame-aura"></div>
			<div class="board-frame">
				<img class="reel-frame-art" src={assets.reelFrame} alt="" />
				<div class="side-badge left">
					<img src={assets.waysBadge} alt="" />
					<strong>{waysText}</strong><span>WAYS</span>
				</div>
				<div class="side-badge right">
					<img src={assets.waysBadge} alt="" />
					<strong>{waysText}</strong><span>WAYS</span>
				</div>
				<div class="board" class:spinning={isSpinning}>
					<div class="board-depth"></div>
					{#each board as symbol, index (`${spinCount}-${index}-${symbol.label}-${symbol.highlight ?? 'idle'}-${symbol.reward ?? ''}`)}
						<div
							class:golden-tile={symbol.highlight === 'golden'}
							class:scatter-tile={symbol.highlight === 'scatter'}
							class:collector-tile={symbol.highlight === 'collector'}
							class:reward-tile={symbol.highlight === 'reward'}
							class="cell"
						>
							<img src={symbol.src} alt={symbol.label} />
							{#if symbol.reward}
								<span class="reward-tag">{symbol.reward}</span>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		</div>

		<div class="hud-panel">
			<div class="meters">
				{#each meters as meter}
					<div class="meter" class:win-pulse={meter.label === 'WIN' && win > 0}>
						<img src={meter.frame} alt="" />
						<span>{meter.label}</span>
						<strong>{meter.value}</strong>
					</div>
				{/each}
			</div>

			<div class="controls">
				<div class="control-group left-controls">
					<button type="button" class="asset-button" aria-label="Menu" onclick={() => (modal = 'debug')}>
						<img src={assets.menuButton} alt="" />
						<span>MENU</span>
					</button>
					<button type="button" class="asset-button bonus" aria-label="Buy Bonus" onclick={openBonusBuy}>
						<img src={assets.bonusButton} alt="" />
						<span>BUY BONUS</span>
					</button>
					<button
						type="button"
						class="asset-button"
						class:active={isAuto}
						aria-label="Auto Spin"
						onclick={() => (isAuto = !isAuto)}
					>
						<img src={assets.autoSpinButton} alt="" />
						<span>AUTO SPIN</span>
					</button>
				</div>

				<div class="control-group center-controls">
					<div class="feature-control" aria-label="Golden Goal Rush feature indicators">
						<img class="feature-frame" src={assets.featurePanel} alt="" />
						<div class="feature-items">
							{#each features as feature}
								<div class="feature-item" class:active={feature.active}>
									<img src={feature.icon} alt="" />
									<span>{feature.label}</span>
								</div>
							{/each}
						</div>
					</div>
					<button
						type="button"
						class="spin-button"
						class:disabled={!canSpin}
						aria-label="Spin"
						disabled={!canSpin}
						onclick={() => spin()}
					>
						<img src={assets.spinButton} alt="" />
						<span>{isSpinning ? 'GOAL' : 'SPIN'}</span>
					</button>
					<button
						type="button"
						class="asset-button turbo"
						class:active={isTurbo}
						aria-label="Turbo"
						onclick={() => (isTurbo = !isTurbo)}
					>
						<img src={assets.turboButton} alt="" />
						<span>TURBO</span>
					</button>
				</div>

				<div class="control-group right-controls">
					<div class="bet-controls" aria-label="Bet controls">
						<img class="bet-frame" src={assets.betStepperFrame} alt="" />
						<button type="button" aria-label="Decrease bet" disabled={!canDecreaseBet} onclick={decreaseBet}>
							<img src={assets.minusButton} alt="" />
						</button>
						<div class="bet-display">
							<span>BET</span>
							<strong>{betText}</strong>
						</div>
						<button type="button" aria-label="Increase bet" disabled={!canIncreaseBet} onclick={increaseBet}>
							<img src={assets.plusButton} alt="" />
						</button>
					</div>
					<button type="button" class="icon-button" aria-label="Info" onclick={() => (modal = 'rules')}>
						<img src={assets.infoButton} alt="" />
					</button>
					<button type="button" class="icon-button" aria-label="Settings" onclick={() => (modal = 'debug')}>
						<img src={assets.settingsButton} alt="" />
					</button>
				</div>
			</div>

			<div class="dev-strip">
				<span>{bonusLabel}</span>
				<strong>{currentTierName}</strong>
				<b>{goldenTileCount} Golden Tiles</b>
				<em>{featureNotice}</em>
				<button type="button" onclick={addTestMoney}>+{formatCurrency(ADD_TEST_MONEY_AMOUNT)}</button>
				<button type="button" onclick={forceBaseWin}>Force Win</button>
				<button type="button" onclick={forceBonus}>Force Bonus</button>
			</div>
			<div class="reward-strip" aria-label="Current Stadium Rewards">
				{#each lastRewards as reward}
					<span>{reward}</span>
				{/each}
			</div>
		</div>
	</div>

	{#if modal}
		<div class="modal-layer" role="presentation">
			<button
				type="button"
				class="modal-backdrop"
				aria-label="Close modal backdrop"
				onclick={closeModal}
			></button>
			<section
				class="modal-panel"
				class:wide-modal={modal === 'rules'}
				role="dialog"
				aria-modal="true"
			>
				<button type="button" class="modal-close" aria-label="Close modal" onclick={closeModal}>X</button>

				{#if modal === 'bonus'}
					<h2>Bonus Buy</h2>
					<p class="modal-copy">Preview-only bonus buys. Costs use current bet and local test balance.</p>
					<div class="bonus-grid">
						{#each bonusOptions as option}
							<article class="bonus-card">
								<div class="bonus-icon">
									<img
										src={option.mode === 'collector'
											? assets.collector
											: option.mode === 'trophy'
												? assets.trophy
												: option.mode === 'golden'
													? assets.football
													: assets.scatter}
										alt=""
									/>
								</div>
								<h3>{option.name}</h3>
								<p>{option.description}</p>
								<div class="bonus-meta">
									<span>{option.costMultiplier}x Bet</span>
									<strong>{formatCurrency(option.costMultiplier * bet)}</strong>
									<small>{option.volatility}</small>
								</div>
								<button type="button" onclick={() => selectBonus(option)}>Buy</button>
							</article>
						{/each}
					</div>
				{:else if modal === 'confirm' && selectedBonus}
					<h2>Confirm Bonus</h2>
					<p class="modal-copy">
						Buy {selectedBonus.name} for {formatCurrency(selectedBonus.costMultiplier * bet)}?
					</p>
					<div class="modal-actions">
						<button type="button" onclick={() => (modal = 'bonus')}>Cancel</button>
						<button type="button" class="primary-action" onclick={confirmBonusBuy}>Confirm</button>
					</div>
				{:else if modal === 'rules'}
					<h2>Info / Rules / Paytable</h2>
					<div class="rules-grid">
						{#each rules as item}
							<article>
								<h3>{item.title}</h3>
								<p>{item.text}</p>
							</article>
						{/each}
					</div>
				{:else if modal === 'debug'}
					<h2>Dev Test Menu</h2>
					<p class="modal-copy">Storybook-only controls for preview testing. No real math or backend calls.</p>
					<div class="debug-grid">
						<button type="button" onclick={addTestMoney}>Add Test Money +{formatCurrency(ADD_TEST_MONEY_AMOUNT)}</button>
						<button type="button" onclick={resetBalance}>Reset Balance</button>
						<button type="button" onclick={forceBaseWin}>Force Base Win</button>
						<button type="button" onclick={forceBonus}>Force Bonus</button>
						<button type="button" onclick={() => (modal = 'rules')}>Info / Rules</button>
						<button type="button" onclick={openBonusBuy}>Bonus Buy</button>
					</div>
				{:else if modal === 'message'}
					<h2>Preview Notice</h2>
					<p class="modal-copy">{message}</p>
					<div class="modal-actions">
						<button type="button" class="primary-action" onclick={closeModal}>OK</button>
					</div>
				{/if}
			</section>
		</div>
	{/if}
</section>

<style>
	.stage {
		position: relative;
		width: 100vw;
		height: 100vh;
		height: 100svh;
		overflow: hidden;
		background: #020406;
		color: #ffd86d;
		font-family: Inter, Arial, sans-serif;
		letter-spacing: 0;
	}

	.stage.collector-flash .stadium-light {
		animation: collector-flash 720ms ease-out both;
	}

	.stage.collector-flash .board {
		box-shadow:
			inset 0 0 34px rgba(0, 0, 0, 0.84),
			inset 0 0 70px rgba(0, 0, 0, 0.58),
			inset 0 0 0 2px rgba(255, 246, 176, 0.92),
			0 0 32px rgba(255, 232, 99, 0.72);
	}

	.stage.big-win-flash .hud-panel {
		box-shadow:
			0 -12px 30px rgba(255, 196, 46, 0.3),
			0 18px 26px rgba(0, 0, 0, 0.55),
			0 0 38px rgba(139, 255, 178, 0.28),
			inset 0 1px 0 rgba(255, 231, 137, 0.32);
	}

	.stage.finale-mode .vignette {
		background:
			radial-gradient(circle at 50% 16%, rgba(255, 238, 145, 0.28), transparent 31%),
			linear-gradient(180deg, rgba(0, 0, 0, 0.18), transparent 38%, rgba(0, 0, 0, 0.42)),
			radial-gradient(circle at 50% 52%, transparent 42%, rgba(0, 0, 0, 0.58));
	}

	.background,
	.vignette {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}

	.background {
		object-fit: cover;
	}

	.vignette {
		background:
<<<<<<< HEAD
			radial-gradient(circle at 50% 16%, rgba(255, 214, 86, 0.2), transparent 31%),
			linear-gradient(180deg, rgba(0, 0, 0, 0.24), transparent 38%, rgba(0, 0, 0, 0.46)),
			radial-gradient(circle at 50% 52%, transparent 44%, rgba(0, 0, 0, 0.66));
=======
			radial-gradient(circle at 50% 16%, rgba(255, 206, 69, 0.16), transparent 26%),
			linear-gradient(180deg, rgba(0, 0, 0, 0.42) 0%, transparent 34%, rgba(0, 0, 0, 0.6) 100%),
			radial-gradient(ellipse 72% 82% at 50% 47%, transparent 40%, rgba(0, 0, 0, 0.8) 100%);
>>>>>>> a618b3461dbcf0aae13bc7718acfcc5c3a88e1ad
	}

	.game-layer {
		position: absolute;
		top: 50%;
		left: 50%;
		z-index: 2;
		display: grid;
		width: 1200px;
		height: 675px;
		box-sizing: border-box;
		grid-template-rows: 88px 326px 229px;
		row-gap: 8px;
		padding: 8px 64px;
		transform: translate(-50%, -50%) scale(var(--game-scale, 1));
		transform-origin: center;
	}

	.stadium-light,
	.gold-dust,
	.frame-aura {
		position: absolute;
		pointer-events: none;
	}

	.stadium-light {
		top: 74px;
		z-index: -1;
		width: 260px;
		height: 260px;
		border-radius: 50%;
		background: radial-gradient(circle, rgba(255, 235, 159, 0.42), rgba(57, 182, 116, 0.16) 34%, transparent 68%);
		filter: blur(10px);
		animation: light-breathe 4.8s ease-in-out infinite;
	}

	.stadium-light.left {
		left: 58px;
	}

	.stadium-light.right {
		right: 58px;
		animation-delay: -2.3s;
	}

	.gold-dust {
		inset: 0 120px auto;
		top: 12px;
		height: 140px;
		background:
			radial-gradient(circle at 18% 42%, rgba(255, 212, 77, 0.75) 0 2px, transparent 3px),
			radial-gradient(circle at 62% 24%, rgba(255, 248, 183, 0.72) 0 1px, transparent 3px),
			radial-gradient(circle at 82% 58%, rgba(255, 177, 34, 0.6) 0 2px, transparent 4px);
		opacity: 0.42;
		animation: dust-drift 7s linear infinite;
	}

	.header {
		position: relative;
		display: grid;
		place-items: start center;
		pointer-events: none;
	}

	.logo-wordmark {
		width: 620px;
		height: 58px;
		object-fit: contain;
		object-position: center;
		filter: drop-shadow(0 5px 8px rgba(0, 0, 0, 0.88))
			drop-shadow(0 0 18px rgba(255, 199, 48, 0.45));
	}

	.world-plaque {
		position: absolute;
		bottom: -6px;
		display: grid;
		width: 328px;
		height: 48px;
		place-items: center;
		color: #ffd36a;
		font-size: 19px;
		font-weight: 900;
		line-height: 1;
		text-align: center;
		text-shadow: 0 2px 2px #000;
	}

	.world-plaque img,
	.reel-frame-art,
	.side-badge img,
	.meter img,
	.feature-frame,
	.bet-frame,
	.asset-button img,
	.icon-button img,
	.spin-button img {
		pointer-events: none;
	}

	.world-plaque img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: fill;
		filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.76));
	}

	.world-plaque span {
		position: relative;
		z-index: 1;
	}

	.board-wrap {
		position: relative;
		width: 850px;
		height: 292px;
		justify-self: center;
		align-self: center;
		perspective: 900px;
	}

	.frame-aura {
		inset: -36px -72px -42px;
		border-radius: 34px;
		background:
			radial-gradient(circle at 50% 0%, rgba(255, 227, 105, 0.35), transparent 36%),
			linear-gradient(90deg, rgba(21, 154, 80, 0.34), transparent 22%, transparent 78%, rgba(21, 154, 80, 0.34));
		filter: blur(12px);
		opacity: 0.82;
		animation: frame-aura 3.6s ease-in-out infinite;
	}

	.board-frame {
		position: absolute;
<<<<<<< HEAD
		inset: -18px -34px -20px;
		padding: 43px 42px 29px;
		transform: rotateX(1deg);
	}

	.reel-frame-art {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: fill;
		filter:
			drop-shadow(0 18px 22px rgba(0, 0, 0, 0.72))
			drop-shadow(0 0 25px rgba(255, 190, 42, 0.58))
			drop-shadow(0 0 18px rgba(44, 199, 99, 0.28));
	}

	.board {
		position: relative;
		display: grid;
		width: 100%;
		height: 100%;
		overflow: hidden;
		grid-template-columns: repeat(6, 1fr);
		grid-template-rows: repeat(5, 1fr);
		border: 0;
		border-radius: 12px;
		background:
			radial-gradient(circle at 50% 0%, rgba(61, 136, 80, 0.22), transparent 48%),
			linear-gradient(180deg, rgba(4, 22, 26, 0.98), rgba(2, 4, 7, 0.98));
		box-shadow:
			inset 0 0 34px rgba(0, 0, 0, 0.84),
			inset 0 0 70px rgba(0, 0, 0, 0.58),
			inset 0 0 0 1px rgba(255, 209, 74, 0.22);
		pointer-events: none;
	}

	.board-depth {
		position: absolute;
		inset: 0;
		z-index: 2;
		border-radius: inherit;
		background:
			linear-gradient(90deg, rgba(255, 214, 96, 0.1), transparent 10%, transparent 90%, rgba(255, 214, 96, 0.1)),
			radial-gradient(circle at 50% 50%, transparent 42%, rgba(0, 0, 0, 0.36) 100%),
			linear-gradient(180deg, rgba(255, 255, 255, 0.07), transparent 16%, transparent 82%, rgba(0, 0, 0, 0.28));
		mix-blend-mode: screen;
		pointer-events: none;
	}

	.board.spinning .cell img {
		animation: reel-spin 0.42s ease-in-out infinite;
	}

	.cell {
		container-type: size;
		position: relative;
		z-index: 1;
		display: grid;
		overflow: hidden;
		place-items: center;
		border-right: 1px solid rgba(211, 153, 48, 0.38);
		border-bottom: 1px solid rgba(211, 153, 48, 0.38);
		background:
			radial-gradient(circle at 50% 48%, rgba(58, 129, 85, 0.28), transparent 52%),
			linear-gradient(180deg, rgba(10, 28, 31, 0.96), rgba(2, 8, 11, 0.96));
	}

	.cell::before {
		position: absolute;
		inset: 7px;
		border-radius: 13px;
		background: radial-gradient(circle at 50% 44%, rgba(255, 221, 98, 0.09), transparent 58%);
		content: '';
		opacity: 0.82;
	}

	.cell.golden-tile {
		box-shadow:
			inset 0 0 22px rgba(255, 211, 61, 0.58),
			0 0 14px rgba(255, 211, 61, 0.35);
	}

	.cell.scatter-tile {
		box-shadow:
			inset 0 0 26px rgba(70, 179, 255, 0.62),
			0 0 18px rgba(70, 179, 255, 0.42);
	}

	.cell.collector-tile {
		background:
			radial-gradient(circle at 50% 45%, rgba(255, 244, 178, 0.56), transparent 58%),
			linear-gradient(180deg, rgba(14, 59, 38, 0.98), rgba(3, 11, 8, 0.98));
		box-shadow:
			inset 0 0 28px rgba(255, 233, 112, 0.78),
			0 0 24px rgba(255, 220, 85, 0.58);
		animation: collector-pop 920ms cubic-bezier(0.2, 0.72, 0.18, 1) both;
	}

	.cell.reward-tile {
		background:
			linear-gradient(180deg, rgba(255, 227, 99, 0.42), rgba(36, 138, 73, 0.42)),
			rgba(13, 28, 20, 0.96);
		box-shadow:
			inset 0 0 24px rgba(255, 215, 68, 0.72),
			0 0 18px rgba(110, 255, 159, 0.34);
		animation: reward-reveal 980ms cubic-bezier(0.2, 0.72, 0.18, 1) both;
	}

	.cell:nth-child(6n) {
		border-right: 0;
	}

	.cell:nth-last-child(-n + 6) {
		border-bottom: 0;
	}

	.cell img {
		display: block;
		position: relative;
		z-index: 1;
		width: 82cqw;
		height: 82cqh;
		object-fit: contain;
		object-position: center;
		filter: drop-shadow(0 5px 6px rgba(0, 0, 0, 0.78))
			drop-shadow(0 0 10px rgba(255, 188, 46, 0.34));
		animation: symbol-idle 4.2s ease-in-out infinite;
	}

	.reward-tag {
		position: absolute;
		right: 4px;
		bottom: 4px;
		z-index: 3;
		max-width: calc(100% - 8px);
		overflow: hidden;
		padding: 2px 5px;
		border: 1px solid rgba(255, 237, 141, 0.74);
		border-radius: 999px;
		background: rgba(2, 8, 7, 0.8);
		color: #fff4b8;
		font-size: 10px;
		font-weight: 1000;
		line-height: 1;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-shadow: 0 1px 2px #000;
	}

	.cell:nth-child(2n) img {
		animation-delay: -1.2s;
	}

	.cell:nth-child(3n) img {
		animation-delay: -2.1s;
=======
		inset: -20px -26px;
		padding: 20px 26px;
		border: 13px solid transparent;
		border-radius: 28px;
		/* Metallic gold gradient border (mockup look) with a dark, slightly
		   green-tinted interior — recreated in vector because the board border
		   cannot be cleanly extracted from the full mockup render. */
		background:
			linear-gradient(92deg, rgba(0, 70, 24, 0.5), transparent 8% 92%, rgba(0, 70, 24, 0.5))
				padding-box,
			linear-gradient(180deg, #0a0e0c 0%, #050505 100%) padding-box,
			linear-gradient(
					150deg,
					#fff3bd 0%,
					#f0c75a 13%,
					#a8741f 33%,
					#5c3c12 50%,
					#b6831d 64%,
					#ffe487 83%,
					#7e4f15 100%
				)
				border-box;
		box-shadow:
			inset 0 0 0 1px rgba(255, 236, 150, 0.55),
			inset 0 0 26px rgba(0, 0, 0, 0.9),
			0 0 0 3px #050505,
			0 10px 30px rgba(0, 0, 0, 0.6),
			0 0 42px rgba(255, 191, 44, 0.5);
>>>>>>> a618b3461dbcf0aae13bc7718acfcc5c3a88e1ad
	}


	.side-badge {
		position: absolute;
<<<<<<< HEAD
		top: 50%;
		display: grid;
		width: 61px;
		height: 73px;
		place-items: center;
=======
		top: 38%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 3px;
		width: 66px;
		min-height: 82px;
		padding: 8px 3px;
		border: 3px solid #dca943;
		border-radius: 14px;
		background: linear-gradient(180deg, #2a2a27 0%, #080808 100%);
		box-shadow:
			inset 0 0 10px rgba(255, 214, 93, 0.25),
			0 0 12px rgba(0, 0, 0, 0.75);
>>>>>>> a618b3461dbcf0aae13bc7718acfcc5c3a88e1ad
		color: #ffe284;
		font-size: 11.5px;
		font-weight: 1000;
		letter-spacing: 0;
		line-height: 1.05;
		text-align: center;
		text-shadow: 0 2px 3px #000;
		transform: translateY(-50%);
		pointer-events: none;
	}

	.side-badge img {
		position: absolute;
		inset: -4px;
		width: calc(100% + 8px);
		height: calc(100% + 8px);
		object-fit: fill;
		filter: drop-shadow(0 4px 7px rgba(0, 0, 0, 0.78));
	}

	.side-badge strong,
	.side-badge span {
		position: relative;
		z-index: 1;
	}

	.side-badge span {
		display: block;
		font-size: 11.5px;
		line-height: 1.05;
		color: #ffd86a;
	}

	.side-badge.left {
		left: -75px;
	}

	.side-badge.right {
		right: -75px;
	}

	.hud-panel {
		position: relative;
		z-index: 4;
		display: grid;
<<<<<<< HEAD
		width: 1060px;
		height: 226px;
		justify-self: center;
		align-self: end;
		box-sizing: border-box;
		grid-template-rows: 52px 92px 28px 20px;
		row-gap: 4px;
		padding: 8px 16px 10px;
		border-radius: 28px 28px 18px 18px;
		background:
			linear-gradient(180deg, rgba(255, 214, 96, 0.18), transparent 12%),
			radial-gradient(circle at 50% -10%, rgba(255, 216, 82, 0.18), transparent 42%),
			linear-gradient(180deg, rgba(5, 10, 9, 0.28), rgba(0, 0, 0, 0.52));
		box-shadow:
			0 -12px 30px rgba(255, 196, 46, 0.16),
			0 18px 26px rgba(0, 0, 0, 0.55),
			inset 0 1px 0 rgba(255, 231, 137, 0.22);
	}

	.hud-panel::before {
		position: absolute;
		inset: 4px 20px auto;
		height: 2px;
		border-radius: 999px;
		background: linear-gradient(90deg, transparent, rgba(255, 221, 108, 0.7), transparent);
		content: '';
=======
		width: 100%;
		height: 100%;
		overflow: hidden;
		grid-template-columns: repeat(6, 1fr);
		grid-template-rows: repeat(5, 1fr);
		border: 2px solid rgba(255, 215, 91, 0.92);
		border-radius: 13px;
		background:
			radial-gradient(ellipse at 50% 42%, rgba(40, 86, 70, 0.28), transparent 66%),
			#02070b;
		box-shadow:
			inset 0 0 46px rgba(0, 0, 0, 0.72),
			inset 0 0 0 1px rgba(255, 224, 130, 0.12);
	}

	.cell {
		position: relative;
		display: grid;
		overflow: visible;
		place-items: center;
		border-right: 1px solid rgba(214, 158, 54, 0.6);
		border-bottom: 1px solid rgba(214, 158, 54, 0.6);
		/* Recessed "slot" depth: warm top glow, top highlight, bottom inner shadow. */
		background:
			radial-gradient(circle at 50% 30%, rgba(34, 70, 64, 0.34), transparent 64%),
			linear-gradient(180deg, rgba(12, 28, 36, 0.7) 0%, rgba(3, 8, 13, 0.94) 100%);
		box-shadow:
			inset 0 1px 0 rgba(255, 224, 130, 0.08),
			inset 0 -12px 18px rgba(0, 0, 0, 0.45);
	}

	.cell:nth-child(6n) {
		border-right: 0;
	}

	.cell:nth-last-child(-n + 6) {
		border-bottom: 0;
	}

	.cell img {
		/* Absolutely fill the cell so percentage sizing resolves against the
		   cell's definite box, then letterbox with object-fit so the whole
		   symbol is always visible (in-flow % height was clipping symbols). */
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		padding: 1px 6px;
		box-sizing: border-box;
		object-fit: contain;
		filter: drop-shadow(0 5px 6px rgba(0, 0, 0, 0.78)) drop-shadow(0 0 7px rgba(255, 188, 46, 0.22));
	}

	.cell img.wide {
		padding: 1px 4px;
	}

	.cell img.feature {
		padding: 0 3px;
>>>>>>> a618b3461dbcf0aae13bc7718acfcc5c3a88e1ad
	}

	.meters {
		display: grid;
		width: 812px;
		height: 50px;
		margin-top: 0;
		justify-self: center;
		align-self: center;
		grid-template-columns: repeat(3, 1fr);
		gap: 16px;
		pointer-events: none;
	}

	.meter {
		position: relative;
		display: grid;
		place-items: center;
		overflow: hidden;
		text-shadow: 0 2px 2px #000;
		border-radius: 12px;
	}

	.meter img {
		position: absolute;
		inset: -6px -10px;
		width: calc(100% + 20px);
		height: calc(100% + 12px);
		object-fit: fill;
		filter: drop-shadow(0 4px 7px rgba(0, 0, 0, 0.82));
	}

<<<<<<< HEAD
	.meter span {
		position: relative;
		z-index: 1;
		color: #ffe28c;
		font-size: 13px;
		font-weight: 900;
		line-height: 1;
	}

	.meter strong {
		position: relative;
		z-index: 1;
		margin-top: 2px;
		color: #fff;
		font-size: 24px;
		font-weight: 1000;
		line-height: 1;
	}

	.meter.win-pulse strong {
		animation: win-pulse 0.9s ease-in-out infinite;
=======
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
		font-size: 12px;
		font-weight: 900;
		line-height: 1;
		letter-spacing: 0.5px;
		text-align: center;
	}

	.meter-value {
		margin-top: 4px;
		color: #fff;
		font-size: 18px;
		font-weight: 1000;
		line-height: 1;
		white-space: nowrap;
		text-align: center;
>>>>>>> a618b3461dbcf0aae13bc7718acfcc5c3a88e1ad
	}

	.controls {
		--hud-scale: 1;
		z-index: 3;
		display: grid;
		width: 100%;
		height: 92px;
		margin-top: 0;
		grid-template-columns: 312px 1fr 340px;
		gap: 18px;
		align-items: center;
		pointer-events: auto;
	}

	.control-group {
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 0;
	}

	.left-controls {
		justify-content: start;
	}

	.center-controls {
		justify-content: center;
	}

	.right-controls {
		justify-content: end;
	}

	button {
		padding: 0;
		border: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

<<<<<<< HEAD
	button:disabled {
		cursor: not-allowed;
		filter: grayscale(0.75) brightness(0.7);
=======
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

	.bet-controls {
		display: grid;
		width: 220px;
		grid-template-columns: 58px 1fr 58px;
		overflow: hidden;
	}

	.bet-controls button {
		display: grid;
		place-items: center;
		background: transparent;
		border: 0;
	}

	.bet-controls button:last-child {
		border: 0;
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

	.cell img {
		animation: symbol-idle 4.2s ease-in-out infinite;
	}

	.cell:nth-child(2n) img {
		animation-delay: -1.2s;
	}

	.cell:nth-child(3n) img {
		animation-delay: -2.1s;
	}

	.board::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(
			110deg,
			transparent 0 38%,
			rgba(255, 230, 128, 0.12) 48%,
			transparent 58% 100%
		);
		mix-blend-mode: screen;
		opacity: 0;
		pointer-events: none;
		animation: board-sweep 5.8s ease-in-out infinite;
	}

	.meters {
		top: 528px;
		z-index: 8;
	}

	.meter {
		position: relative;
		height: 58px;
		overflow: visible;
		border: 0;
		background: transparent;
		box-shadow: none;
	}

	.panel-art,
	.button-art {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: fill;
		pointer-events: none;
		user-select: none;
	}

	.panel-art {
		filter: drop-shadow(0 4px 7px rgba(0, 0, 0, 0.85))
			drop-shadow(0 0 10px rgba(255, 193, 48, 0.32));
	}

	.meter::after {
		content: '';
		position: absolute;
		inset: 8px 26px;
		background: linear-gradient(
			105deg,
			transparent 0 30%,
			rgba(255, 245, 168, 0.4) 47%,
			transparent 62% 100%
		);
		mix-blend-mode: screen;
		opacity: 0;
		pointer-events: none;
		animation: meter-glint 4.6s ease-in-out infinite;
	}

	.meter:nth-child(2)::after {
		animation-delay: -1.5s;
	}

	.meter:nth-child(3)::after {
		animation-delay: -3s;
	}

	.meter-asset-icon {
		position: relative;
		z-index: 1;
		width: 32px;
		height: 32px;
		object-fit: contain;
		filter: drop-shadow(0 2px 3px #000) drop-shadow(0 0 6px rgba(255, 213, 88, 0.36));
	}

	.meter > div {
		position: relative;
		z-index: 1;
		min-width: 108px;
	}

	.controls {
		bottom: 7px;
		left: 23px;
		z-index: 9;
		align-items: end;
		height: 91px;
		gap: 10px;
>>>>>>> a618b3461dbcf0aae13bc7718acfcc5c3a88e1ad
	}

	.asset-button,
	.icon-button,
	.feature-control,
	.spin-button,
	.bet-controls {
		position: relative;
		flex: 0 0 auto;
	}

	.asset-button,
	.icon-button {
		display: grid;
		width: calc(82px * var(--hud-scale));
		height: calc(74px * var(--hud-scale));
		place-items: center;
		grid-template-rows: 1fr auto;
		color: #ffdd73;
		font-size: 12px;
		font-weight: 1000;
		line-height: 1;
		text-shadow:
			0 2px 2px #000,
			0 0 6px rgba(255, 211, 76, 0.45);
		transition:
			transform 140ms ease,
			filter 140ms ease;
	}

	.asset-button.active,
	.feature-item.active,
	.turbo.active {
		filter: drop-shadow(0 0 12px rgba(58, 213, 255, 0.7));
	}

	.asset-button.bonus {
		width: calc(116px * var(--hud-scale));
		filter: drop-shadow(0 0 12px rgba(255, 193, 44, 0.3));
	}

	.asset-button:hover,
	.icon-button:hover,
	.bet-controls button:hover,
	.spin-button:hover {
		transform: translateY(-3px);
		filter: drop-shadow(0 0 13px rgba(255, 216, 93, 0.62));
	}

	.asset-button:active,
	.icon-button:active,
	.bet-controls button:active,
	.spin-button:active {
		transform: translateY(1px) scale(0.98);
	}

	.asset-button img,
	.icon-button img {
		position: absolute;
		inset: -4px;
		width: calc(100% + 8px);
		height: calc(100% + 8px);
		object-fit: contain;
		filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.82));
	}

	.asset-button span {
		position: relative;
		z-index: 1;
		align-self: end;
		margin-bottom: 7px;
	}

	.icon-button {
		width: 62px;
	}

	.feature-control {
		display: grid;
		width: 174px;
		height: 76px;
		place-items: center;
		pointer-events: none;
	}

	.feature-frame {
		position: absolute;
		inset: -7px -12px;
		width: calc(100% + 24px);
		height: calc(100% + 14px);
		object-fit: fill;
		filter: drop-shadow(0 4px 7px rgba(0, 0, 0, 0.86))
			drop-shadow(0 0 10px rgba(43, 169, 255, 0.26));
	}

	.feature-items {
		position: relative;
		z-index: 1;
		display: grid;
		width: 88%;
		grid-template-columns: repeat(3, 1fr);
		gap: 3px;
		align-items: center;
	}

	.feature-item {
		display: grid;
		place-items: center;
		gap: 1px;
		min-width: 0;
	}

	.feature-item img {
		width: 27px;
		height: 27px;
		object-fit: contain;
		filter: drop-shadow(0 2px 3px #000) drop-shadow(0 0 6px rgba(56, 191, 255, 0.45));
		animation: feature-pulse 2.8s ease-in-out infinite;
	}

	.feature-item span {
		width: 100%;
		overflow: hidden;
		color: #ffdf78;
		font-size: 8px;
		font-weight: 900;
		text-align: center;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-shadow: 0 2px 2px #000;
	}

	.spin-button {
<<<<<<< HEAD
		display: grid;
		width: 112px;
		height: 112px;
		place-items: center;
		animation: spin-pulse 2.2s ease-in-out infinite;
		transition:
			transform 140ms ease,
			filter 140ms ease;
=======
		width: 106px;
		height: 106px;
		margin-right: 20px;
		margin-left: 10px;
		border: 0;
		background: transparent;
		box-shadow: none;
		/* Static button — no permanent pulse/scale loop. Only user-driven
		   hover/active feedback (see rules below). */
		transition: transform 0.12s ease;
	}

	.spin-button:hover {
		transform: scale(1.03);
	}

	.spin-button:active {
		transform: scale(0.96);
>>>>>>> a618b3461dbcf0aae13bc7718acfcc5c3a88e1ad
	}

	.spin-button.disabled {
		animation: none;
	}

	.spin-button img {
		position: absolute;
<<<<<<< HEAD
		inset: -10px;
		width: calc(100% + 20px);
		height: calc(100% + 20px);
=======
		inset: 3px;
		border-radius: 50%;
		pointer-events: none;
	}

	.spin-button::before {
		/* Static soft glow — no animation. */
		background: radial-gradient(circle, rgba(255, 222, 102, 0.2), transparent 61%);
		filter: blur(4px);
	}

	.spin-button::after {
		border: 2px solid rgba(255, 213, 110, 0.3);
		opacity: 1;
	}

	.spin-art {
		position: absolute;
		inset: -7px;
		width: calc(100% + 14px);
		height: calc(100% + 14px);
>>>>>>> a618b3461dbcf0aae13bc7718acfcc5c3a88e1ad
		object-fit: contain;
		filter: drop-shadow(0 5px 8px rgba(0, 0, 0, 0.88))
			drop-shadow(0 0 14px rgba(255, 205, 57, 0.56));
	}

	.spin-button span {
		position: relative;
		z-index: 1;
		margin-top: 40px;
		color: #fff0a5;
		font-size: 24px;
		font-weight: 1000;
		text-shadow: 0 3px 2px #000;
		-webkit-text-stroke: 1px #5a2500;
	}

	.bet-controls {
		display: grid;
		width: 196px;
		height: 72px;
		grid-template-columns: 56px 1fr 56px;
		align-items: center;
		overflow: visible;
	}

	.bet-frame {
		position: absolute;
		inset: -8px -12px;
		width: calc(100% + 24px);
		height: calc(100% + 16px);
		object-fit: fill;
		filter: drop-shadow(0 4px 7px rgba(0, 0, 0, 0.82));
	}

	.bet-controls button {
		position: relative;
		z-index: 1;
		display: grid;
		height: 100%;
		place-items: center;
	}

	.bet-controls button img {
		width: 46px;
		height: 46px;
		object-fit: contain;
		filter: drop-shadow(0 3px 5px rgba(0, 0, 0, 0.85));
	}

	.bet-display {
		position: relative;
		z-index: 1;
		display: grid;
		min-width: 0;
		place-items: center;
		text-shadow: 0 2px 2px #000;
	}

	.bet-display span {
		color: #ffdb6f;
		font-size: 13px;
		font-weight: 1000;
		line-height: 1;
	}

	.bet-display strong {
		color: #fff;
		font-size: 16px;
		line-height: 1;
		white-space: nowrap;
	}

	.dev-strip {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		color: #ffe28c;
		font-size: 11px;
		font-weight: 900;
		text-transform: uppercase;
		text-shadow: 0 2px 2px #000;
	}

	.dev-strip span {
		min-width: 120px;
		text-align: center;
		color: #87ffae;
	}

	.dev-strip strong,
	.dev-strip b,
	.dev-strip em {
		flex: 0 1 auto;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.dev-strip strong {
		color: #fff3aa;
		font-style: normal;
	}

	.dev-strip b {
		color: #ffd152;
	}

	.dev-strip em {
		max-width: 250px;
		color: #bafbd0;
		font-style: normal;
	}

	.dev-strip button {
		min-height: 25px;
		padding: 4px 12px;
		border: 1px solid rgba(255, 218, 103, 0.58);
		border-radius: 999px;
		background: rgba(4, 9, 8, 0.72);
		color: #ffe28c;
		font-size: 10px;
		font-weight: 1000;
		box-shadow: inset 0 0 12px rgba(0, 0, 0, 0.6);
	}

	.dev-strip button:hover {
		background: rgba(79, 48, 8, 0.86);
	}

	.reward-strip {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		min-width: 0;
		overflow: hidden;
		color: #fff4b8;
		font-size: 10px;
		font-weight: 1000;
		text-shadow: 0 2px 2px #000;
	}

	.reward-strip span {
		flex: 0 1 auto;
		min-width: 0;
		max-width: 140px;
		overflow: hidden;
		padding: 3px 8px;
		border: 1px solid rgba(255, 221, 108, 0.5);
		border-radius: 999px;
		background: rgba(5, 16, 12, 0.76);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.modal-layer {
		position: absolute;
		inset: 0;
		z-index: 10;
		display: grid;
		place-items: center;
		pointer-events: none;
	}

	.modal-backdrop {
		position: absolute;
		inset: 0;
		display: block;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.62);
		pointer-events: auto;
	}

	.modal-panel {
		position: relative;
		z-index: 1;
		width: min(760px, 86vw);
		max-height: min(600px, 82vh);
		overflow: auto;
		box-sizing: border-box;
		padding: 28px;
		border: 2px solid #d49a29;
		border-radius: 14px;
		background:
			linear-gradient(135deg, rgba(17, 26, 18, 0.98), rgba(3, 5, 7, 0.98)),
			radial-gradient(circle at 50% 0%, rgba(255, 214, 82, 0.22), transparent 46%);
		box-shadow:
			0 0 0 4px rgba(0, 0, 0, 0.72),
			0 0 34px rgba(255, 194, 48, 0.42),
			inset 0 0 32px rgba(0, 0, 0, 0.78);
		color: #ffdf78;
		text-align: left;
		pointer-events: auto;
		animation: modal-in 180ms ease-out;
	}

	.wide-modal {
		width: min(920px, 90vw);
	}

	.modal-panel h2 {
		margin: 0 46px 12px 0;
		color: #fff1a3;
		font-size: 30px;
		line-height: 1;
		text-shadow: 0 3px 2px #000;
	}

	.modal-panel h3 {
		margin: 0 0 8px;
		color: #ffe390;
		font-size: 16px;
		line-height: 1.15;
	}

	.modal-copy,
	.modal-panel p {
		margin: 0 0 14px;
		color: #f5ddb0;
		font-size: 14px;
		line-height: 1.38;
	}

	.modal-close {
		position: absolute;
		top: 14px;
		right: 14px;
		display: grid;
		width: 34px;
		height: 34px;
		place-items: center;
		border: 1px solid #d49a29;
		border-radius: 50%;
		background: #151515;
		color: #fff1a3;
		font-weight: 1000;
	}

	.bonus-grid,
	.rules-grid,
	.debug-grid {
		display: grid;
		gap: 14px;
	}

	.bonus-grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.rules-grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.debug-grid {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}

	.bonus-card,
	.rules-grid article {
		position: relative;
		padding: 16px;
		border: 1px solid rgba(212, 154, 41, 0.72);
		border-radius: 10px;
		background:
			radial-gradient(circle at 50% 0%, rgba(255, 214, 91, 0.14), transparent 45%),
			linear-gradient(180deg, rgba(17, 35, 25, 0.94), rgba(0, 0, 0, 0.72));
		box-shadow: inset 0 0 18px rgba(0, 0, 0, 0.68);
		transition:
			transform 140ms ease,
			box-shadow 140ms ease,
			border-color 140ms ease;
	}

	.bonus-card:hover {
		transform: translateY(-4px);
		border-color: rgba(255, 222, 119, 0.92);
		box-shadow:
			0 10px 20px rgba(0, 0, 0, 0.42),
			0 0 18px rgba(255, 206, 61, 0.24),
			inset 0 0 18px rgba(0, 0, 0, 0.68);
	}

	.bonus-icon {
		display: grid;
		width: 66px;
		height: 66px;
		margin-bottom: 10px;
		place-items: center;
		border-radius: 50%;
		background: radial-gradient(circle, rgba(255, 223, 120, 0.22), rgba(0, 0, 0, 0.2) 62%);
	}

	.bonus-icon img {
		width: 58px;
		height: 58px;
		object-fit: contain;
		filter: drop-shadow(0 4px 5px rgba(0, 0, 0, 0.76))
			drop-shadow(0 0 8px rgba(255, 204, 64, 0.34));
	}

	.bonus-meta {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 4px 10px;
		align-items: center;
		margin: 12px 0;
	}

	.bonus-meta span,
	.bonus-meta small {
		color: #ffdf78;
		font-weight: 900;
	}

	.bonus-meta strong {
		color: #fff;
		font-size: 18px;
	}

	.bonus-card button,
	.debug-grid button,
	.modal-actions button {
		min-height: 38px;
		padding: 8px 14px;
		border: 1px solid #d49a29;
		border-radius: 8px;
		background: linear-gradient(180deg, #2f230c, #0d0d0d);
		color: #ffe390;
		font-weight: 1000;
		text-shadow: 0 2px 2px #000;
	}

	.modal-actions {
		display: flex;
		justify-content: end;
		gap: 12px;
		margin-top: 18px;
	}

	.primary-action,
	.bonus-card button:hover,
	.debug-grid button:hover {
		background: linear-gradient(180deg, #f5c552, #6d3307);
		color: #160b00;
		text-shadow: none;
	}

	@keyframes symbol-idle {
		0%,
		100% {
			transform: translateY(0) scale(1);
		}
		50% {
			transform: translateY(-2px) scale(1.015);
		}
	}

	@keyframes light-breathe {
		0%,
		100% {
			opacity: 0.58;
			transform: scale(0.96);
		}
		50% {
			opacity: 0.92;
			transform: scale(1.04);
		}
	}

	@keyframes collector-flash {
		0% {
			opacity: 0.42;
			transform: scale(0.88);
			filter: blur(16px);
		}
		34% {
			opacity: 1;
			transform: scale(1.18);
			filter: blur(4px);
		}
		100% {
			opacity: 0.72;
			transform: scale(1);
			filter: blur(10px);
		}
	}

	@keyframes collector-pop {
		0% {
			transform: scale(0.92);
			filter: brightness(1);
		}
		52% {
			transform: scale(1.06);
			filter: brightness(1.32);
		}
		100% {
			transform: scale(1);
			filter: brightness(1.08);
		}
	}

	@keyframes reward-reveal {
		0% {
			opacity: 0.58;
			transform: rotateY(0deg) scale(0.82);
		}
		58% {
			opacity: 1;
			transform: rotateY(540deg) scale(1.08);
		}
		100% {
			transform: rotateY(720deg) scale(1);
		}
	}

	@keyframes dust-drift {
		0% {
			transform: translateX(-20px);
		}
		100% {
			transform: translateX(20px);
		}
	}

	@keyframes frame-aura {
		0%,
		100% {
			opacity: 0.58;
		}
		50% {
			opacity: 0.92;
		}
	}

	@keyframes reel-spin {
		0%,
		100% {
			transform: translateY(-4px) scale(0.96);
			opacity: 0.72;
		}
		50% {
			transform: translateY(4px) scale(1.02);
			opacity: 1;
		}
	}

	@keyframes feature-pulse {
		0%,
		100% {
			transform: translateY(0) scale(1);
		}
		50% {
			transform: translateY(-2px) scale(1.08);
		}
	}

	@keyframes spin-pulse {
		0%,
		100% {
			transform: scale(1);
			filter: drop-shadow(0 0 8px rgba(255, 204, 55, 0.28));
		}
		50% {
			transform: scale(1.055);
			filter: drop-shadow(0 0 18px rgba(255, 218, 72, 0.62));
		}
	}

	@keyframes win-pulse {
		0%,
		100% {
			transform: scale(1);
			color: #fff;
		}
		50% {
			transform: scale(1.08);
			color: #8dffb0;
		}
	}

	@keyframes modal-in {
		from {
			opacity: 0;
			transform: translateY(12px) scale(0.96);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}
</style>
