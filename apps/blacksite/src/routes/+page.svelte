<script>
	import { onMount } from 'svelte';
	import {
		CANDIDATE_FINGERPRINT_SHA256,
		EVENT_SCHEMA_SHA256,
		MODES,
		getMode,
		getModeLabel,
	} from '../lib/contracts/modes.js';
	import { getFixture } from '../lib/fixtures/base-zero.js';
	import { GameEventAdapter } from '../lib/runtime/game-event-adapter.js';
	import { resolveLaunchMode } from '../lib/runtime/launch-mode.js';
	import {
		PresentationDirector,
		createInitialPresentationState,
	} from '../lib/runtime/presentation-director.js';

	const boardCells = Array.from({ length: 49 }, (_, index) => ({
		column: index % 7,
		row: Math.floor(index / 7),
	}));
	const symbolCodes = Object.freeze({
		byte: 'BYT',
		relay: 'RLY',
		proxy: 'PRX',
		cipher: 'CPH',
		daemon: 'DMN',
		vault: 'VLT',
	});

	let launch = { kind: 'booting' };
	let presentation = createInitialPresentationState();
	let selectedModeId = 'base';
	let selectedMode = getMode(selectedModeId);
	let activeFixture = null;
	let activeCues = [];
	let director = null;

	$: selectedMode = getMode(selectedModeId);
	$: liveKeys = new Set(
		(presentation.routeSnapshot?.live_cells ?? []).map((cell) => cellKey(cell)),
	);
	$: dormantKeys = new Set(
		(presentation.routeSnapshot?.dormant_cells ?? []).map((cell) => cellKey(cell)),
	);
	$: sealedKeys = new Set(
		(presentation.routeSnapshot?.sealed_cells ?? []).map((cell) => cellKey(cell)),
	);

	function cellKey(cell) {
		return `${cell.column},${cell.row}`;
	}

	function symbolAt(cell) {
		const symbol = presentation.board?.[cell.column]?.[cell.row];
		return symbol ? symbolCodes[symbol] : '--';
	}

	function fixtureFailure(code, message) {
		launch = { kind: 'error', code, message, surface: 'fixture' };
	}

	function playFixture() {
		if (!director || activeCues.length === 0) return;
		director.reset();
		void director.play(activeCues, { stepDelayMs: 120 });
	}

	onMount(() => {
		director = new PresentationDirector((nextState) => {
			presentation = nextState;
		});
		launch = resolveLaunchMode(window.location.search, { dev: __BLACKSITE_DEV_FIXTURES__ });

		if (launch.kind === 'fixture') {
			activeFixture = getFixture(launch.fixtureId);
			if (!activeFixture) {
				fixtureFailure(
					'DEV_FIXTURE_UNKNOWN',
					`Unknown development fixture: ${launch.fixtureId}`,
				);
			} else {
				try {
					activeCues = new GameEventAdapter().adaptBook(activeFixture.book, {
						expectedMode: activeFixture.mode,
					});
					selectedModeId = activeFixture.mode;
					void director.play(activeCues, { stepDelayMs: 120 });
				} catch (error) {
					fixtureFailure('DEV_FIXTURE_CONTRACT_INVALID', error.message);
				}
			}
		}

		return () => director?.destroy();
	});
</script>

<svelte:head>
	<title>BLACKSITE // BREACH — M2 Greybox</title>
	<meta
		name="description"
		content="BLACKSITE // BREACH M2 authoritative-event presentation greybox"
	/>
</svelte:head>

<main class="app-shell">
	<header class="masthead">
		<div class="identity">
			<span class="eyebrow">CLASSIFIED SYSTEM / PRESENTATION CONTRACT</span>
			<h1>BLACKSITE <span>// BREACH</span></h1>
		</div>
		<div class="lifecycle" aria-label="Current lifecycle">
			<span class="pulse"></span>
			M2_STARTED · GREYBOX · NOT CANDIDATE
		</div>
	</header>

	<section class="studio" aria-label="BLACKSITE greybox studio">
		<aside class="panel mode-panel">
			<div class="panel-heading">
				<span>01</span>
				<div>
					<p>ACCESS PROFILE</p>
					<h2>Canonical modes</h2>
				</div>
			</div>

			<div class="mode-list">
				{#each MODES as mode}
					<button
						type="button"
						class:selected={mode.id === selectedModeId}
						aria-pressed={mode.id === selectedModeId}
						on:click={() => (selectedModeId = mode.id)}
					>
						<span>{mode.normalLabel}</span>
						<strong>{mode.costMultiplier}×</strong>
						<small>{mode.id}</small>
					</button>
				{/each}
			</div>

			<div class="mode-readout">
				<div><span>Selected</span><strong>{getModeLabel(selectedMode.id)}</strong></div>
				<div><span>Cost</span><strong>{selectedMode.costMultiplier}× base</strong></div>
				<div><span>RTP</span><strong>96.20%</strong></div>
				<div><span>Max</span><strong>10,000×</strong></div>
			</div>
		</aside>

		<section class="board-stage" aria-label="Authoritative 7 by 7 board">
			<div class="stage-heading">
				<div>
					<span>GHOST ROUTE // 7×7</span>
					<strong>{presentation.notice}</strong>
				</div>
				<div class="phase-chip">{presentation.phase.toUpperCase()}</div>
			</div>

			<div class="board-frame">
				<div class="board" role="grid" aria-rowcount="7" aria-colcount="7">
					{#each boardCells as cell}
						<div
							class="cell"
							class:live={liveKeys.has(cellKey(cell))}
							class:dormant={dormantKeys.has(cellKey(cell))}
							class:sealed={sealedKeys.has(cellKey(cell))}
							role="gridcell"
							aria-label={`Column ${cell.column + 1}, row ${cell.row + 1}, ${symbolAt(cell)}`}
						>
							<small>{cell.column}{cell.row}</small>
							<strong>{symbolAt(cell)}</strong>
						</div>
					{/each}
				</div>
				<div class="ingress ingress-left" title="Ingress"></div>
				<div class="ingress ingress-center" title="Ingress"></div>
				<div class="ingress ingress-right" title="Ingress"></div>
			</div>

			<div class="meter-row" aria-live="polite">
				<div>
					<span>STEP / RAW</span>
					<strong>{presentation.stepWinRaw} centi-x</strong>
				</div>
				<div class="primary-meter">
					<span>AUTHORITATIVE ROUND TOTAL</span>
					<strong>{presentation.cumulativeWinRaw} centi-x</strong>
				</div>
				<div>
					<span>ACCESS</span>
					<strong>{presentation.accessMultiplier}×</strong>
				</div>
			</div>
		</section>

		<aside class="panel contract-panel">
			<div class="panel-heading">
				<span>02</span>
				<div>
					<p>AUTHORITY BOUNDARY</p>
					<h2>Runtime status</h2>
				</div>
			</div>

			{#if launch.kind === 'booting'}
				<div class="launch-card pending" aria-live="polite">Inspecting launch contract…</div>
			{:else if launch.kind === 'error'}
				<div class="launch-card error" role="alert">
					<strong>{launch.code}</strong>
					<span>{launch.message}</span>
					<small>No paid or fixture fallback was started.</small>
				</div>
			{:else if launch.kind === 'fixture'}
				<div class="launch-card fixture">
					<strong>DEV FIXTURE / {launch.fixtureId}</strong>
					<span>Explicit development route. Never a paid-play fallback.</span>
					<small>Published base book 1 · lookup weight 1</small>
				</div>
			{:else if launch.kind === 'replay'}
				<div class="launch-card pending">
					<strong>REPLAY / READ-ONLY PENDING</strong>
					<span>Identity parsed; fetch/playback wiring is not implemented yet.</span>
					<small>Zero authenticate/play/end-round/event-save calls.</small>
				</div>
			{:else}
				<div class="launch-card pending">
					<strong>LIVE RGS CONTRACT ACCEPTED</strong>
					<span>Authentication/play wiring is intentionally pending.</span>
					<small>No local wallet, RNG or paid simulation exists.</small>
				</div>
			{/if}

			<div class="contract-grid">
				<div><span>Event</span><strong>blacksite-book-events-v1</strong></div>
				<div><span>Board</span><strong>column-major 7×7</strong></div>
				<div><span>Payout unit</span><strong>centi-x uint64</strong></div>
				<div><span>Final authority</span><strong>book / RGS round</strong></div>
			</div>

			<button
				class="primary-action"
				type="button"
				disabled={launch.kind !== 'fixture' || !activeFixture}
				on:click={playFixture}
			>
				{launch.kind === 'fixture' ? 'REPLAY DEV FIXTURE' : 'PAID PLAY NOT WIRED'}
			</button>

			<div class="hashes">
				<span>Candidate {CANDIDATE_FINGERPRINT_SHA256.slice(0, 12)}…</span>
				<span>Schema {EVENT_SCHEMA_SHA256.slice(0, 12)}…</span>
			</div>
		</aside>
	</section>
</main>

<style>
	:global(*) {
		box-sizing: border-box;
	}

	:global(html),
	:global(body) {
		width: 100%;
		height: 100%;
		margin: 0;
		overflow: hidden;
		overscroll-behavior: none;
		background: #081015;
		color: #dce8ea;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		touch-action: manipulation;
	}

	:global(button) {
		font: inherit;
	}

	.app-shell {
		position: fixed;
		inset: 0;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		gap: clamp(8px, 1.2vw, 16px);
		padding: max(10px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right))
			max(10px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left));
		background:
			linear-gradient(rgba(69, 114, 121, 0.07) 1px, transparent 1px),
			linear-gradient(90deg, rgba(69, 114, 121, 0.07) 1px, transparent 1px),
			#081015;
		background-size: 32px 32px;
	}

	.masthead {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 18px;
		min-width: 0;
		border-bottom: 1px solid #29434a;
		padding: 0 4px 10px;
	}

	.identity {
		min-width: 0;
	}

	.eyebrow,
	.panel-heading p,
	.stage-heading span,
	.meter-row span,
	.mode-readout span,
	.contract-grid span {
		color: #6f939a;
		font-size: clamp(8px, 0.65vw, 11px);
		letter-spacing: 0.13em;
		text-transform: uppercase;
	}

	h1 {
		margin: 2px 0 0;
		font-family: Arial, Helvetica, sans-serif;
		font-size: clamp(21px, 2.5vw, 40px);
		font-weight: 800;
		letter-spacing: -0.045em;
		line-height: 0.95;
	}

	h1 span {
		color: #f05c55;
		font-weight: 300;
	}

	.lifecycle {
		display: flex;
		align-items: center;
		gap: 8px;
		max-width: 50%;
		color: #a7bdc1;
		font-size: clamp(8px, 0.75vw, 11px);
		letter-spacing: 0.08em;
		text-align: right;
	}

	.pulse {
		width: 7px;
		height: 7px;
		flex: 0 0 auto;
		border-radius: 50%;
		background: #efc06a;
		box-shadow: 0 0 10px #efc06a;
	}

	.studio {
		min-height: 0;
		display: grid;
		grid-template-columns: minmax(190px, 0.72fr) minmax(320px, 1.6fr) minmax(210px, 0.8fr);
		gap: clamp(8px, 1vw, 14px);
	}

	.panel,
	.board-stage {
		min-width: 0;
		min-height: 0;
		border: 1px solid #29434a;
		background: rgba(9, 20, 25, 0.93);
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.28);
	}

	.panel {
		display: flex;
		flex-direction: column;
		gap: clamp(9px, 1.2vh, 16px);
		padding: clamp(10px, 1.25vw, 18px);
		overflow: hidden;
	}

	.panel-heading {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.panel-heading > span {
		display: grid;
		width: 30px;
		height: 30px;
		place-items: center;
		border: 1px solid #3c626b;
		color: #8db1b8;
		font-size: 10px;
	}

	.panel-heading p,
	.panel-heading h2 {
		margin: 0;
	}

	.panel-heading h2 {
		margin-top: 2px;
		font-family: Arial, Helvetica, sans-serif;
		font-size: clamp(13px, 1.15vw, 18px);
	}

	.mode-list {
		display: grid;
		gap: 7px;
	}

	.mode-list button {
		position: relative;
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 2px 10px;
		min-height: 48px;
		padding: 8px 10px;
		border: 1px solid #29434a;
		background: #0d1b20;
		color: #b8cbcf;
		text-align: left;
		cursor: pointer;
	}

	.mode-list button:hover,
	.mode-list button:focus-visible,
	.mode-list button.selected {
		border-color: #e05b55;
		background: #182328;
		outline: none;
	}

	.mode-list button.selected::before {
		position: absolute;
		inset: -1px auto -1px -1px;
		width: 3px;
		background: #f05c55;
		content: '';
	}

	.mode-list strong {
		grid-row: span 2;
		align-self: center;
		color: #efc06a;
		font-size: clamp(14px, 1.3vw, 20px);
	}

	.mode-list small {
		color: #55767d;
		font-size: 9px;
	}

	.mode-readout,
	.contract-grid {
		display: grid;
		gap: 1px;
		margin-top: auto;
		background: #29434a;
		border: 1px solid #29434a;
	}

	.mode-readout > div,
	.contract-grid > div {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		min-width: 0;
		padding: 7px 9px;
		background: #0b171c;
	}

	.mode-readout strong,
	.contract-grid strong {
		overflow: hidden;
		color: #c8d7da;
		font-size: clamp(9px, 0.72vw, 11px);
		text-align: right;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.board-stage {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		gap: clamp(8px, 1vh, 12px);
		padding: clamp(9px, 1vw, 15px);
	}

	.stage-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.stage-heading > div:first-child {
		display: grid;
		gap: 2px;
		min-width: 0;
	}

	.stage-heading strong {
		overflow: hidden;
		font-size: clamp(9px, 0.82vw, 12px);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.phase-chip {
		flex: 0 0 auto;
		padding: 5px 9px;
		border: 1px solid #506d73;
		color: #9eb3b7;
		font-size: 9px;
		letter-spacing: 0.12em;
	}

	.board-frame {
		position: relative;
		align-self: center;
		justify-self: center;
		width: min(100%, 68vh);
		max-height: 100%;
		aspect-ratio: 1;
		padding: clamp(5px, 0.6vw, 9px);
		border: 1px solid #48646b;
		background: #071015;
		box-shadow: inset 0 0 0 3px #0e2228;
	}

	.board {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		grid-template-rows: repeat(7, 1fr);
		gap: clamp(2px, 0.28vw, 5px);
		width: 100%;
		height: 100%;
	}

	.cell {
		position: relative;
		display: grid;
		place-items: center;
		min-width: 0;
		min-height: 0;
		border: 1px solid #263d43;
		background: #112126;
		color: #8fa8ad;
		transition: border-color 140ms ease, background 140ms ease, color 140ms ease;
	}

	.cell::after {
		position: absolute;
		inset: 7%;
		border: 1px solid rgba(129, 163, 170, 0.12);
		content: '';
	}

	.cell small {
		position: absolute;
		top: 3px;
		left: 4px;
		color: #38555c;
		font-size: clamp(5px, 0.42vw, 8px);
	}

	.cell strong {
		font-size: clamp(8px, 1.05vw, 17px);
		letter-spacing: 0.04em;
	}

	.cell.sealed {
		background: #111c21;
	}

	.cell.dormant {
		border-color: #8d6b38;
		background: #302718;
		color: #d3aa62;
	}

	.cell.live {
		border-color: #d55b55;
		background: #3a1f20;
		color: #ffd0c8;
		box-shadow: inset 0 0 14px rgba(240, 92, 85, 0.22);
	}

	.ingress {
		position: absolute;
		bottom: -5px;
		width: 5px;
		height: 10px;
		background: #d95d56;
		box-shadow: 0 0 8px rgba(240, 92, 85, 0.65);
	}

	.ingress-left {
		left: 36%;
	}

	.ingress-center {
		left: 50%;
	}

	.ingress-right {
		left: 64%;
	}

	.meter-row {
		display: grid;
		grid-template-columns: 1fr 1.4fr 0.7fr;
		gap: 7px;
	}

	.meter-row > div {
		display: grid;
		gap: 2px;
		min-width: 0;
		padding: 7px 9px;
		border: 1px solid #29434a;
		background: #0b171c;
	}

	.meter-row strong {
		overflow: hidden;
		font-size: clamp(9px, 0.8vw, 13px);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.meter-row .primary-meter {
		border-color: #76504a;
		text-align: center;
	}

	.primary-meter strong {
		color: #f1c170;
	}

	.launch-card {
		display: grid;
		gap: 6px;
		padding: 10px;
		border: 1px solid #4c6267;
		background: #101d21;
		font-size: clamp(9px, 0.72vw, 11px);
		line-height: 1.35;
	}

	.launch-card strong {
		letter-spacing: 0.06em;
	}

	.launch-card span {
		color: #a9bdc1;
	}

	.launch-card small {
		color: #6e8b91;
	}

	.launch-card.error {
		border-color: #a94743;
		background: #2b1718;
	}

	.launch-card.error strong {
		color: #ff928b;
	}

	.launch-card.fixture {
		border-color: #557b66;
		background: #13221b;
	}

	.launch-card.fixture strong {
		color: #93c9a8;
	}

	.launch-card.pending strong {
		color: #efc06a;
	}

	.primary-action {
		min-height: 46px;
		margin-top: auto;
		border: 1px solid #d55b55;
		background: #d55b55;
		color: #0a1114;
		font-size: clamp(9px, 0.8vw, 12px);
		font-weight: 800;
		letter-spacing: 0.08em;
		cursor: pointer;
	}

	.primary-action:focus-visible {
		outline: 2px solid #f4d19b;
		outline-offset: 2px;
	}

	.primary-action:disabled {
		border-color: #354b51;
		background: #17272c;
		color: #6d858b;
		cursor: not-allowed;
	}

	.hashes {
		display: grid;
		gap: 3px;
		color: #4f7077;
		font-size: clamp(7px, 0.58vw, 9px);
		word-break: break-all;
	}

	@media (max-width: 820px) {
		.app-shell {
			gap: 6px;
			padding: max(6px, env(safe-area-inset-top)) max(6px, env(safe-area-inset-right))
				max(6px, env(safe-area-inset-bottom)) max(6px, env(safe-area-inset-left));
		}

		.masthead {
			align-items: center;
			padding-bottom: 6px;
		}

		.eyebrow {
			display: none;
		}

		.lifecycle {
			max-width: 58%;
		}

		.studio {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: auto minmax(0, 1fr) auto;
			gap: 6px;
		}

		.panel {
			gap: 6px;
			padding: 7px;
		}

		.mode-panel {
			order: 1;
		}

		.board-stage {
			order: 2;
			padding: 6px;
		}

		.contract-panel {
			order: 3;
		}

		.panel-heading,
		.mode-readout,
		.contract-grid,
		.hashes {
			display: none;
		}

		.mode-list {
			grid-template-columns: repeat(3, 1fr);
			gap: 5px;
		}

		.mode-list button {
			min-height: 42px;
			padding: 5px 7px;
		}

		.mode-list button span {
			overflow: hidden;
			font-size: 9px;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.mode-list button small {
			display: none;
		}

		.board-frame {
			width: min(92vw, 51vh);
		}

		.launch-card {
			grid-template-columns: auto 1fr;
			gap: 4px 8px;
			padding: 6px 8px;
		}

		.launch-card small {
			display: none;
		}

		.primary-action {
			min-height: 40px;
		}
	}

	@media (max-width: 480px), (max-height: 560px) {
		h1 {
			font-size: 18px;
		}

		.lifecycle {
			font-size: 7px;
		}

		.stage-heading strong,
		.phase-chip,
		.meter-row > div:first-child,
		.meter-row > div:last-child {
			display: none;
		}

		.meter-row {
			grid-template-columns: 1fr;
		}

		.board-frame {
			width: min(91vw, 49vh);
		}

		.contract-panel {
			grid-template-columns: minmax(0, 1fr) auto;
			align-items: stretch;
	}

		.primary-action {
			margin: 0;
			padding: 0 10px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.cell {
			transition: none;
		}
	}
</style>
