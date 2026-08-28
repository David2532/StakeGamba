<script>
	import { BLACKSITE_ASSETS } from '../assets/blacksite-assets.js';
	import UiSurface from './UiSurface.svelte';

	export let enabled = false;
	export let status = 'loading';
	export let eyebrow = 'BLACKSITE // SYSTEM';
	export let headline = '';
	export let detail = '';
	export let progress = null;
	export let progressLabel = '';
	export let fallbackSrc = '';
	export let compact = false;
	export let testId = 'cinematic-status-surface';
	export let role = '';
	export let ariaLive = '';
	export let ariaAtomic = true;

	const STATUS_CONTRACT = Object.freeze({
		loading: Object.freeze({
			label: 'INITIALIZING',
			headline: 'LOADING SYSTEMS',
			detail: 'Preparing the secure operation surface.',
			surface: 'readout',
			surfaceState: 'idle',
			tone: 'neutral',
			busy: true,
			role: 'status',
			live: 'polite',
		}),
		connecting: Object.freeze({
			label: 'HANDSHAKE',
			headline: 'CONNECTING SECURE CHANNEL',
			detail: 'Establishing the operation link.',
			surface: 'readout',
			surfaceState: 'focus',
			tone: 'accent',
			busy: true,
			role: 'status',
			live: 'polite',
		}),
		presenting: Object.freeze({
			label: 'PRESENTING',
			headline: 'OPERATION IN PROGRESS',
			detail: 'The current presentation sequence is active.',
			surface: 'panel',
			surfaceState: 'selected',
			tone: 'feature',
			busy: true,
			role: 'status',
			live: 'polite',
		}),
		ready: Object.freeze({
			label: 'READY',
			headline: 'OPERATION READY',
			detail: 'Controls are available.',
			surface: 'panel',
			surfaceState: 'selected',
			tone: 'success',
			busy: false,
			role: 'status',
			live: 'polite',
		}),
		error: Object.freeze({
			label: 'FAULT',
			headline: 'OPERATION INTERRUPTED',
			detail: 'The secure operation could not continue.',
			surface: 'panel',
			surfaceState: 'danger',
			tone: 'danger',
			busy: false,
			role: 'alert',
			live: 'assertive',
		}),
		success: Object.freeze({
			label: 'COMPLETE',
			headline: 'OPERATION COMPLETE',
			detail: 'The secure sequence completed successfully.',
			surface: 'panel',
			surfaceState: 'selected',
			tone: 'success',
			busy: false,
			role: 'status',
			live: 'polite',
		}),
	});

	const VALID_ROLES = Object.freeze(['status', 'alert']);
	const VALID_LIVE_VALUES = Object.freeze(['off', 'polite', 'assertive']);

	function normalizeProgress(value) {
		if (value === null || value === undefined || value === '') return null;
		const numeric = Number(value);
		if (!Number.isFinite(numeric)) return null;
		return Math.max(0, Math.min(100, numeric));
	}

	$: normalizedStatus = STATUS_CONTRACT[status] ? status : 'loading';
	$: contract = STATUS_CONTRACT[normalizedStatus];
	$: resolvedHeadline = headline || contract.headline;
	$: resolvedDetail = detail || contract.detail;
	$: normalizedProgress = normalizeProgress(progress);
	$: hasProgress = normalizedProgress !== null;
	$: showProgress = hasProgress || contract.busy;
	$: roundedProgress = hasProgress ? Math.round(normalizedProgress) : null;
	$: resolvedRole = VALID_ROLES.includes(role) ? role : contract.role;
	$: resolvedAriaLive = VALID_LIVE_VALUES.includes(ariaLive) ? ariaLive : contract.live;
	$: resolvedFallbackSrc = fallbackSrc || (contract.surface === 'readout'
		? BLACKSITE_ASSETS.ui.premiumPanels.ticker
		: normalizedStatus === 'error'
			? BLACKSITE_ASSETS.ui.premiumPanels.dialogs.runtimeError
			: BLACKSITE_ASSETS.ui.premiumPanels.dialogs.confirmation);
	$: resolvedProgressLabel = progressLabel || `${resolvedHeadline} progress`;
	$: progressValueText = hasProgress ? `${roundedProgress}%` : 'In progress';
</script>

<section
	class="cinematic-status"
	class:cinematic-status--compact={compact}
	data-testid={testId || undefined}
	data-cinematic-status={normalizedStatus}
	data-cinematic-surface={contract.surface}
	data-cinematic-ui-enabled={enabled ? 'true' : 'false'}
	data-cinematic-progress={hasProgress ? 'determinate' : showProgress ? 'indeterminate' : 'none'}
	role={resolvedRole}
	aria-live={resolvedAriaLive}
	aria-atomic={ariaAtomic}
	aria-busy={contract.busy ? 'true' : 'false'}
>
	<UiSurface
		{enabled}
		kind={contract.surface}
		state={contract.surfaceState}
		tone={contract.tone}
		danger={normalizedStatus === 'error'}
		interactive={false}
		fallbackSrc={resolvedFallbackSrc}
		on:ready
		on:error
	/>

	<div class="cinematic-status__signal" aria-hidden="true">
		<i></i>
		<span></span>
	</div>

	<div class="cinematic-status__copy">
		<small class="cinematic-status__eyebrow">{eyebrow}</small>
		<strong class="cinematic-status__headline">{resolvedHeadline}</strong>
		{#if resolvedDetail}<p class="cinematic-status__detail">{resolvedDetail}</p>{/if}
	</div>

	<div
		class="cinematic-status__state"
		data-cinematic-ui-inner-surface={enabled ? 'content' : undefined}
	>
		{#if enabled}
			<UiSurface
				enabled
				kind="content"
				state={contract.surfaceState}
				tone={contract.tone}
				danger={normalizedStatus === 'error'}
				interactive={false}
				fallbackSrc={BLACKSITE_ASSETS.ui.premiumPanels.ticker}
			/>
		{/if}
		<span class="cinematic-status__light" aria-hidden="true"><i></i></span>
		<strong>{contract.label}</strong>
		{#if hasProgress}<em>{roundedProgress}%</em>{/if}
	</div>

	{#if showProgress}
		<div
			class="cinematic-status__progress"
			role="progressbar"
			aria-label={resolvedProgressLabel}
			aria-valuemin="0"
			aria-valuemax="100"
			aria-valuenow={hasProgress ? roundedProgress : undefined}
			aria-valuetext={progressValueText}
			data-cinematic-ui-inner-surface={enabled ? 'progress' : undefined}
			style={`--cinematic-progress:${hasProgress ? normalizedProgress / 100 : 0}`}
		>
			{#if enabled}
				<UiSurface
					enabled
					kind="progress"
					state={contract.surfaceState}
					tone={contract.tone}
					danger={normalizedStatus === 'error'}
					interactive={false}
				/>
			{/if}
			<i></i>
		</div>
	{/if}
</section>

<style>
	.cinematic-status {
		--cinematic-accent: #76cbd1;
		--cinematic-accent-hot: #f2c46b;
		position: relative;
		display: grid;
		grid-template-columns: 14px minmax(0, 1fr) auto;
		grid-template-rows: 1fr 5px;
		width: 100%;
		min-width: 0;
		min-height: 104px;
		gap: 10px 16px;
		align-items: center;
		padding: 18px 22px 14px;
		overflow: hidden;
		box-sizing: border-box;
		isolation: isolate;
		color: #eef7f4;
	}

	.cinematic-status[data-cinematic-status='ready'],
	.cinematic-status[data-cinematic-status='success'] {
		--cinematic-accent: #7ed7a3;
		--cinematic-accent-hot: #e7cf80;
	}

	.cinematic-status[data-cinematic-status='error'] {
		--cinematic-accent: #ff7b6d;
		--cinematic-accent-hot: #ffc3a8;
	}

	.cinematic-status > :global(.ui-surface) {
		z-index: 0;
	}

	.cinematic-status__signal,
	.cinematic-status__copy,
	.cinematic-status__state,
	.cinematic-status__progress {
		position: relative;
		z-index: 1;
	}

	.cinematic-status__signal {
		align-self: stretch;
		display: grid;
		grid-template-rows: 12px 1fr;
		justify-items: center;
		gap: 5px;
	}

	.cinematic-status__signal i {
		display: block;
		width: 8px;
		height: 8px;
		border: 1px solid color-mix(in srgb, var(--cinematic-accent) 82%, white 18%);
		border-radius: 50%;
		background: var(--cinematic-accent);
		box-shadow: 0 0 12px color-mix(in srgb, var(--cinematic-accent) 72%, transparent);
	}

	.cinematic-status__signal span {
		display: block;
		width: 2px;
		min-height: 38px;
		background: linear-gradient(180deg, var(--cinematic-accent), transparent);
		opacity: .68;
	}

	.cinematic-status__copy {
		display: grid;
		min-width: 0;
		gap: 4px;
	}

	.cinematic-status__eyebrow,
	.cinematic-status__headline,
	.cinematic-status__detail,
	.cinematic-status__state strong,
	.cinematic-status__state em {
		margin: 0;
	}

	.cinematic-status__eyebrow {
		color: var(--cinematic-accent);
		font: 900 10px/1 ui-monospace, monospace;
		letter-spacing: .18em;
		text-transform: uppercase;
	}

	.cinematic-status__headline {
		overflow: hidden;
		color: #fff2c2;
		font: 900 clamp(19px, 2.4vw, 30px)/.98 Arial, sans-serif;
		letter-spacing: -.025em;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-shadow: 0 4px 18px rgba(0, 0, 0, .72);
	}

	.cinematic-status__detail {
		overflow: hidden;
		max-width: 58ch;
		color: #c6d4d2;
		font: 700 12px/1.25 ui-monospace, monospace;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.cinematic-status__state {
		display: grid;
		grid-template-columns: 10px auto;
		align-items: center;
		gap: 6px 8px;
		min-width: 118px;
		padding: 8px 10px;
		border-left: 1px solid color-mix(in srgb, var(--cinematic-accent) 55%, transparent);
		text-align: left;
	}

	.cinematic-status[data-cinematic-ui-enabled='true'] .cinematic-status__state {
		isolation: isolate;
		border-left-color: transparent;
	}

	.cinematic-status__state > :global(.ui-surface) {
		--ui-surface-border-y: 6px;
		--ui-surface-border-x: 9px;
		z-index: 0;
	}

	.cinematic-status__state strong,
	.cinematic-status__state em {
		font: 900 9px/1 ui-monospace, monospace;
		font-style: normal;
		letter-spacing: .14em;
		white-space: nowrap;
	}

	.cinematic-status__state strong { color: var(--cinematic-accent-hot); }
	.cinematic-status__state em { grid-column: 2; color: #a9b8b6; }

	.cinematic-status__light {
		grid-row: 1 / span 2;
		display: grid;
		place-items: center;
		width: 10px;
		height: 10px;
	}

	.cinematic-status__light i {
		display: block;
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--cinematic-accent);
		box-shadow: 0 0 10px color-mix(in srgb, var(--cinematic-accent) 78%, transparent);
	}

	.cinematic-status[aria-busy='true'] .cinematic-status__light i {
		animation: cinematic-status-pulse 1.1s ease-in-out infinite;
	}

	.cinematic-status__progress {
		grid-column: 2 / -1;
		height: 4px;
		overflow: hidden;
		background: rgba(18, 37, 38, .84);
		box-shadow: inset 0 0 0 1px rgba(137, 184, 181, .13);
	}

	.cinematic-status[data-cinematic-ui-enabled='true'] .cinematic-status__progress {
		isolation: isolate;
		background: transparent;
		box-shadow: none;
	}

	.cinematic-status__progress > :global(.ui-surface) {
		--ui-surface-border-y: 2px;
		--ui-surface-border-x: 8px;
		z-index: 0;
	}

	.cinematic-status__progress > i {
		display: block;
		width: 100%;
		height: 100%;
		background: linear-gradient(90deg, var(--cinematic-accent), var(--cinematic-accent-hot));
		box-shadow: 0 0 12px color-mix(in srgb, var(--cinematic-accent) 58%, transparent);
		transform: scaleX(var(--cinematic-progress, 0));
		transform-origin: left center;
		transition: transform 180ms ease-out;
	}

	.cinematic-status[data-cinematic-ui-enabled='true'] .cinematic-status__state strong,
	.cinematic-status[data-cinematic-ui-enabled='true'] .cinematic-status__state em,
	.cinematic-status[data-cinematic-ui-enabled='true'] .cinematic-status__light,
	.cinematic-status[data-cinematic-ui-enabled='true'] .cinematic-status__progress > i {
		position: relative;
		z-index: 1;
	}

	.cinematic-status[data-cinematic-progress='indeterminate'] .cinematic-status__progress > i {
		width: 34%;
		transform: translateX(-120%);
		animation: cinematic-status-scan 1.2s ease-in-out infinite;
	}

	.cinematic-status--compact {
		min-height: 44px;
		grid-template-columns: 10px minmax(0, 1fr);
		grid-template-rows: minmax(0, 1fr) 3px;
		gap: 4px 9px;
		padding: 6px 10px 5px;
	}

	.cinematic-status--compact .cinematic-status__eyebrow,
	.cinematic-status--compact .cinematic-status__detail,
	.cinematic-status--compact .cinematic-status__state { display: none; }
	.cinematic-status--compact .cinematic-status__signal { grid-row: 1; align-self: center; }
	.cinematic-status--compact .cinematic-status__signal span { display: none; }
	.cinematic-status--compact .cinematic-status__headline {
		font-size: clamp(10px, 1.2vw, 14px);
		line-height: 1;
		letter-spacing: .08em;
	}
	.cinematic-status--compact .cinematic-status__progress {
		grid-row: 2;
		grid-column: 1 / -1;
		height: 2px;
	}

	@keyframes cinematic-status-pulse {
		0%, 100% { opacity: .58; transform: scale(.78); }
		50% { opacity: 1; transform: scale(1.18); }
	}

	@keyframes cinematic-status-scan {
		0% { transform: translateX(-120%); }
		70%, 100% { transform: translateX(360%); }
	}

	@media (max-width: 480px) {
		.cinematic-status {
			grid-template-columns: 10px minmax(0, 1fr);
			min-height: 96px;
			gap: 7px 10px;
			padding: 14px 15px 11px;
		}

		.cinematic-status__state {
			grid-column: 2;
			grid-template-columns: 10px auto auto;
			min-width: 0;
			padding: 4px 0 0;
			border-left: 0;
		}

		.cinematic-status__state em { grid-column: auto; justify-self: end; }
		.cinematic-status__light { grid-row: auto; }
		.cinematic-status__progress { grid-column: 2; }
	}

	@media (prefers-reduced-motion: reduce) {
		.cinematic-status__light i,
		.cinematic-status__progress > i {
			animation: none !important;
			transition: none !important;
		}

		.cinematic-status[data-cinematic-progress='indeterminate'] .cinematic-status__progress > i {
			width: 100%;
			opacity: .52;
			transform: scaleX(.38);
			transform-origin: left center;
		}
	}
</style>
