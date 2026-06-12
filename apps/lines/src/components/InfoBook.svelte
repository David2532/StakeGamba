<script lang="ts">
	import type { Snippet } from 'svelte';

	import { Popup } from 'components-shared';
	import { zIndex } from 'constants-shared/zIndex';
	import { stateModal } from 'state-shared';

	import config from '../game/config';

	type Props = {
		version?: Snippet;
	};

	const props: Props = $props();

	// Number of free spins awarded on scatter trigger. Mirrors
	// DEFAULT_TOTAL_FREE_SPINS in math/games/golden_goal_rush/game_config.py —
	// the value is not part of the generated frontend config yet.
	const TOTAL_FREE_SPINS = 8;
	const SCATTER_TRIGGER_COUNT = 3;

	const numReels = config.numReels;
	const numRows = config.numRows[0];
	const numPaylines = Object.keys(config.paylines).length;
	// TODO(balancing): bonus buy price comes from config.betModes.bonus.cost
	// (currently 100x). The bonus EV is far above this price — see
	// math/games/golden_goal_rush/BALANCING_NOTES.md before treating it as final.
	const bonusBuyCost = config.betModes.bonus.cost;
	const maxWin = config.betModes.base.max_win;
	// TODO(balancing): configured target RTP, not yet matched by the generated
	// books. See math/games/golden_goal_rush/BALANCING_NOTES.md.
	const rtpPercent = (config.rtp * 100).toFixed(2);

	// Final stake-upload symbol art mapping — see ../assets/golden-goal-rush/ASSETS.md.
	const SYMBOL_IMAGE_MAP: Record<string, string> = {
		H1: 'fussball',
		H2: 'pokal',
		H3: 'pfeife',
		H4: 'trikot',
		L1: 'a',
		L2: 'k',
		L3: 'q',
		L4: 'j',
		L5: '10',
		W: 'wild',
		S: 'scatter',
	};
	const symbolImage = (key: string) =>
		new URL(`../assets/golden-goal-rush/${SYMBOL_IMAGE_MAP[key]}.png`, import.meta.url).href;

	type SymbolPays = { count: string; pay: number }[];
	const paysOf = (key: keyof typeof config.symbols): SymbolPays => {
		const symbol = config.symbols[key];
		if (!('paytable' in symbol) || !symbol.paytable) return [];
		return symbol.paytable
			.flatMap((entry) => Object.entries(entry))
			.map(([count, pay]) => ({ count, pay: pay as number }))
			.sort((a, b) => Number(b.count) - Number(a.count));
	};

	const HIGH_SYMBOLS = ['H1', 'H2', 'H3', 'H4'] as const;
	const LOW_SYMBOLS = ['L1', 'L2', 'L3', 'L4', 'L5'] as const;

	// Smallest symbol count that pays on a line, derived from the paytable.
	const minLineCount = Math.min(
		...[...HIGH_SYMBOLS, ...LOW_SYMBOLS].flatMap((key) =>
			paysOf(key).map(({ count }) => Number(count)),
		),
	);

	const PAGES = [
		'Overview',
		'Symbols',
		'How to Win',
		'Wild',
		'Free Spins',
		'Bonus Buy',
		'Rules & RTP',
	] as const;

	let pageIndex = $state(0);

	const close = () => (stateModal.modal = null);
	const previousPage = () => (pageIndex = (pageIndex - 1 + PAGES.length) % PAGES.length);
	const nextPage = () => (pageIndex = (pageIndex + 1) % PAGES.length);
</script>

{#if stateModal.modal?.name === 'payTable'}
	<Popup zIndex={zIndex.modal} onclose={close}>
		<div class="infobook" data-test="infobook">
			<header class="infobook-header">
				<h1>GOLDEN GOAL RUSH</h1>
				<span class="subtitle">GAME INFO</span>
			</header>

			<nav class="infobook-tabs">
				{#each PAGES as page, index (page)}
					<button
						class="tab"
						class:active={index === pageIndex}
						onclick={() => (pageIndex = index)}
					>
						{page}
					</button>
				{/each}
			</nav>

			<section class="infobook-content">
				{#if PAGES[pageIndex] === 'Overview'}
					<h2>Overview</h2>
					<p>
						Golden Goal Rush is a football-themed video slot played on {numReels} reels and
						{numRows} rows with {numPaylines} fixed paylines.
					</p>
					<p>
						Land matching symbols from the leftmost reel on a payline to win. Scatter symbols
						award Free Spins, and the Bonus Buy option takes you straight to the feature.
					</p>
					<p>Wins are paid as a multiple of your current bet.</p>
				{:else if PAGES[pageIndex] === 'Symbols'}
					<h2>High Symbols</h2>
					<div class="symbol-grid">
						{#each HIGH_SYMBOLS as key (key)}
							<div class="symbol-card">
								<img src={symbolImage(key)} alt={`High symbol ${key}`} />
								<table>
									<tbody>
										{#each paysOf(key) as { count, pay } (count)}
											<tr><td>{count}×</td><td>{pay}× bet</td></tr>
										{/each}
									</tbody>
								</table>
							</div>
						{/each}
					</div>
					<h2>Low Symbols</h2>
					<div class="symbol-grid">
						{#each LOW_SYMBOLS as key (key)}
							<div class="symbol-card">
								<img src={symbolImage(key)} alt={`Low symbol ${key}`} />
								<table>
									<tbody>
										{#each paysOf(key) as { count, pay } (count)}
											<tr><td>{count}×</td><td>{pay}× bet</td></tr>
										{/each}
									</tbody>
								</table>
							</div>
						{/each}
					</div>
					<h2>Special Symbols</h2>
					<div class="symbol-grid">
						<div class="symbol-card">
							<img src={symbolImage('W')} alt="Wild symbol" />
							<span class="symbol-name">WILD</span>
							<table>
								<tbody>
									{#each paysOf('W') as { count, pay } (count)}
										<tr><td>{count}×</td><td>{pay}× bet</td></tr>
									{/each}
								</tbody>
							</table>
						</div>
						<div class="symbol-card">
							<img src={symbolImage('S')} alt="Scatter symbol" />
							<span class="symbol-name">SCATTER</span>
							<p class="symbol-note">Triggers Free Spins</p>
						</div>
					</div>
				{:else if PAGES[pageIndex] === 'How to Win'}
					<h2>How to Win</h2>
					<p>
						Wins are formed by landing {minLineCount} or more matching symbols on one of the
						{numPaylines} paylines, starting from the leftmost reel and running consecutively to
						the right.
					</p>
					<p>
						Only the highest win per payline is paid. Wins on different paylines are added
						together. All payline wins are multiplied by your current bet.
					</p>
				{:else if PAGES[pageIndex] === 'Wild'}
					<h2>Wild</h2>
					<div class="feature-row">
						<img class="feature-icon" src={symbolImage('W')} alt="Wild symbol" />
						<div>
							<p>The Wild symbol substitutes for all paying symbols to help complete line wins.</p>
							<p>Wild does <strong>not</strong> substitute for the Scatter symbol.</p>
							<p>Wild also pays on its own when enough Wilds line up on a payline.</p>
						</div>
					</div>
				{:else if PAGES[pageIndex] === 'Free Spins'}
					<h2>Scatter &amp; Free Spins</h2>
					<div class="feature-row">
						<img class="feature-icon" src={symbolImage('S')} alt="Scatter symbol" />
						<div>
							<p>
								Landing {SCATTER_TRIGGER_COUNT} or more Scatter symbols anywhere on the reels
								triggers the Free Spins feature.
							</p>
							<p>You are awarded {TOTAL_FREE_SPINS} Free Spins.</p>
							<p>
								Free Spins are played at the bet of the triggering spin. The total feature win is
								presented at the end of the feature.
							</p>
						</div>
					</div>
				{:else if PAGES[pageIndex] === 'Bonus Buy'}
					<h2>Bonus Buy</h2>
					<p>
						The Bonus Buy option lets you purchase direct entry into the Free Spins feature for
						<strong>{bonusBuyCost}× your current bet</strong>.
					</p>
					<p>
						After the purchase, the Free Spins feature starts immediately. The feature plays
						exactly like a naturally triggered bonus.
					</p>
					<p>The Bonus Buy button is unavailable while a spin is running or when your balance does not cover the buy price.</p>
				{:else if PAGES[pageIndex] === 'Rules & RTP'}
					<h2>Rules &amp; RTP</h2>
					<p>The theoretical return to player (RTP) of this game is {rtpPercent}%.</p>
					<p>The maximum win is capped at {maxWin.toLocaleString()}× bet.</p>
					<p>All wins are multiplied by the current bet.</p>
					<p>Malfunction voids all pays and plays.</p>
					{#if props.version}
						<div class="version">
							{@render props.version()}
						</div>
					{/if}
				{/if}
			</section>

			<footer class="infobook-footer">
				<button class="arrow" aria-label="Previous page" onclick={previousPage}>‹</button>
				<span class="page-indicator">{pageIndex + 1} / {PAGES.length}</span>
				<button class="arrow" aria-label="Next page" onclick={nextPage}>›</button>
			</footer>
		</div>
	</Popup>
{/if}

<style lang="scss">
	.infobook {
		--gold: #d5a23b;
		--gold-bright: #ffe49a;
		--emerald: #14803c;
		--emerald-dark: #0b2415;
		--panel: #08080d;

		z-index: 100;
		// Popup renders its children twice (once outside the overlay layer);
		// only show the copy inside the overlay.
		display: none;
		flex-direction: column;
		width: min(92vw, 56rem);
		height: min(86vh, 44rem);
		background: linear-gradient(180deg, #0d0d14 0%, var(--panel) 55%, var(--emerald-dark) 100%);
		border: 2px solid var(--gold);
		border-radius: 1rem;
		box-shadow:
			0 0 2.5rem rgba(213, 162, 59, 0.35),
			inset 0 0 4rem rgba(20, 128, 60, 0.15);
		overflow: hidden;
	}

	:global(.top-layer) .infobook {
		display: flex;
	}

	.infobook-header {
		display: flex;
		align-items: baseline;
		gap: 0.8rem;
		padding: 1rem 1.4rem 0.6rem;
		border-bottom: 1px solid rgba(213, 162, 59, 0.4);

		h1 {
			margin: 0;
			font-size: 1.5rem;
			font-weight: 800;
			letter-spacing: 0.15em;
			background: linear-gradient(180deg, var(--gold-bright), var(--gold));
			-webkit-background-clip: text;
			background-clip: text;
			color: transparent;
		}

		.subtitle {
			font-size: 0.85rem;
			letter-spacing: 0.3em;
			color: rgba(255, 228, 154, 0.7);
		}
	}

	.infobook-tabs {
		display: flex;
		gap: 0.4rem;
		padding: 0.6rem 1.2rem;
		overflow-x: auto;

		.tab {
			flex-shrink: 0;
			cursor: pointer;
			padding: 0.45rem 0.9rem;
			font-size: 0.85rem;
			font-weight: 700;
			letter-spacing: 0.06em;
			color: var(--gold-bright);
			background: rgba(8, 8, 13, 0.85);
			border: 1px solid rgba(213, 162, 59, 0.55);
			border-radius: 0.5rem;
			transition:
				background 0.15s ease,
				transform 0.1s ease;

			&:hover {
				border-color: var(--gold-bright);
				transform: translateY(-1px);
			}

			&.active {
				color: #fff;
				background: linear-gradient(180deg, var(--emerald), var(--emerald-dark));
				border-color: var(--gold-bright);
			}
		}
	}

	.infobook-content {
		flex: 1;
		overflow-y: auto;
		padding: 0.4rem 1.6rem 1rem;
		line-height: 1.55;
		font-size: 0.95rem;
		color: #e8e8ee;

		h2 {
			font-size: 1.1rem;
			letter-spacing: 0.1em;
			color: var(--gold-bright);
			border-bottom: 1px solid rgba(213, 162, 59, 0.3);
			padding-bottom: 0.3rem;
		}

		strong {
			color: var(--gold-bright);
		}
	}

	.symbol-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
		gap: 0.8rem;
	}

	.symbol-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
		padding: 0.6rem;
		background: rgba(8, 8, 13, 0.7);
		border: 1px solid rgba(213, 162, 59, 0.35);
		border-radius: 0.6rem;

		img {
			width: 4.5rem;
			height: 4.5rem;
			object-fit: contain;
		}

		.symbol-name {
			font-weight: 800;
			letter-spacing: 0.15em;
			color: var(--gold-bright);
		}

		.symbol-note {
			margin: 0;
			font-size: 0.8rem;
			color: #c9c9d2;
		}

		table {
			border-collapse: collapse;
			font-size: 0.85rem;

			td {
				padding: 0.05rem 0.5rem;

				&:first-child {
					color: var(--gold-bright);
					text-align: right;
				}
			}
		}
	}

	.feature-row {
		display: flex;
		align-items: flex-start;
		gap: 1.2rem;

		.feature-icon {
			width: 7rem;
			height: 7rem;
			object-fit: contain;
			flex-shrink: 0;
		}
	}

	.version {
		margin-top: 1rem;
		opacity: 0.6;
		font-size: 0.8rem;
	}

	.infobook-footer {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1.2rem;
		padding: 0.5rem;
		border-top: 1px solid rgba(213, 162, 59, 0.4);

		.arrow {
			cursor: pointer;
			width: 2.4rem;
			height: 2.4rem;
			font-size: 1.4rem;
			line-height: 1;
			color: var(--gold-bright);
			background: rgba(8, 8, 13, 0.85);
			border: 1px solid rgba(213, 162, 59, 0.55);
			border-radius: 50%;

			&:hover {
				border-color: var(--gold-bright);
			}
		}

		.page-indicator {
			font-size: 0.85rem;
			letter-spacing: 0.1em;
			color: rgba(255, 228, 154, 0.8);
		}
	}
</style>
