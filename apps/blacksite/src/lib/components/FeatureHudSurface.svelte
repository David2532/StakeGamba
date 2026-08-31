<script>
	import { resolveBlacksiteUiV21State } from '../assets/blacksite-ui-v21.js';
	import UiSurface from './UiSurface.svelte';

	export let enabled = false;
	export let kind = 'base';
	export let state = 'idle';
	export let label = '';
	export let compactLabel = '';
	export let value = '';
	export let secondary = '';
	export let tone = 'auto';
	export let fallbackSrc = '';
	export let iconSrc = '';
	export let iconAlt = '';
	export let testId = '';
	export let valueTestId = '';
	export let secondaryTestId = '';
	export let role = '';
	export let ariaLabel = '';
	export let ariaLive = '';
	export let ariaAtomic = undefined;

	const KIND_CONTRACT = Object.freeze({
		base: Object.freeze({ semantic: 'base', surface: 'feature', legacySurface: 'control', tone: 'neutral' }),
		'quick-start': Object.freeze({ semantic: 'base', surface: 'feature', legacySurface: 'control', tone: 'neutral' }),
		progress: Object.freeze({ semantic: 'progress', surface: 'feature', legacySurface: 'readout', tone: 'feature' }),
		target: Object.freeze({ semantic: 'target', surface: 'feature', legacySurface: 'readout', tone: 'target' }),
		win: Object.freeze({ semantic: 'win', surface: 'feature', legacySurface: 'readout', tone: 'win' }),
	});
	const STATE_ALIASES = Object.freeze({
		normal: 'idle',
		active: 'selected',
		armed: 'selected',
		complete: 'selected',
		winning: 'selected',
		locked: 'disabled',
		error: 'danger',
		warning: 'danger',
	});

	$: contract = KIND_CONTRACT[kind] ?? KIND_CONTRACT.base;
	$: semanticKind = contract.semantic;
	$: surfaceKind = enabled ? contract.surface : contract.legacySurface;
	$: requestedState = typeof state === 'string' ? state : 'idle';
	$: aliasedState = STATE_ALIASES[requestedState] ?? requestedState;
	$: normalizedTone = typeof tone === 'string' && tone.length > 0 && tone !== 'auto'
		? tone
		: contract.tone;
	$: surfaceState = resolveBlacksiteUiV21State({ state: aliasedState, tone: normalizedTone });
	$: hasLabel = label !== null && label !== undefined && label !== '';
	$: hasValue = value !== null && value !== undefined && value !== '';
	$: hasSecondary = secondary !== null && secondary !== undefined && secondary !== '';
</script>

<span
	class="feature-hud-surface"
	data-testid={testId || undefined}
	data-feature-hud-kind={semanticKind}
	data-feature-hud-source-kind={kind}
	data-feature-hud-state={requestedState}
	data-feature-hud-ui-state={surfaceState}
	data-feature-hud-tone={normalizedTone}
	data-feature-hud-surface={surfaceKind}
	data-feature-hud-v21={enabled ? 'true' : 'false'}
	data-feature-hud-v27={enabled ? 'feature' : undefined}
	data-feature-hud-fallback={fallbackSrc ? 'explicit' : 'none'}
	data-feature-hud-has-secondary={hasSecondary ? 'true' : 'false'}
	role={role || undefined}
	aria-label={ariaLabel || undefined}
	aria-live={ariaLive || undefined}
	aria-atomic={ariaAtomic}
>
	<UiSurface
		{enabled}
		kind={surfaceKind}
		state={surfaceState}
		tone={normalizedTone}
		interactive={false}
		{fallbackSrc}
		on:ready
		on:error
	/>
	{#if hasLabel}
		<small class="feature-hud-surface__label" class:has-compact-label={Boolean(compactLabel)}>
			<span class="feature-hud-surface__label-full">{label}</span>
			{#if compactLabel}<span class="feature-hud-surface__label-compact">{compactLabel}</span>{/if}
		</small>
	{/if}
	{#if hasValue}
		<span class="feature-hud-surface__value-row">
			{#if iconSrc}<img class="feature-hud-surface__icon" src={iconSrc} alt={iconAlt} draggable="false" />{/if}
			<strong class="feature-hud-surface__value" class:feature-hud-surface__value--icon-label={iconSrc} data-testid={valueTestId || undefined}>{value}</strong>
		</span>
	{/if}
	{#if hasSecondary}<em class="feature-hud-surface__secondary" data-testid={secondaryTestId || undefined}>{secondary}</em>{/if}
</span>

<style>
	.feature-hud-surface {
		--feature-hud-accent-soft: rgba(188, 143, 71, 0.17);
		--feature-hud-label: #b1a68f;
		--feature-hud-value: #f0faf7;
		--feature-hud-secondary: #c0d0cf;
		position: relative;
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		grid-template-rows: 11px minmax(0, 1fr);
		place-items: center;
		min-width: 0;
		min-height: 34px;
		column-gap: 7px;
		row-gap: 0;
		padding: 2px 10px 3px;
		overflow: hidden;
		box-sizing: border-box;
		isolation: isolate;
		color: var(--feature-hud-secondary);
		line-height: 1;
	}

	.feature-hud-surface :global(.ui-surface[data-ui-primitive='feature']) {
		--ui-surface-border-y: 6px;
		--ui-surface-border-x: 9px;
	}

	.feature-hud-surface[data-feature-hud-tone='feature'] {
		--feature-hud-accent-soft: rgba(232, 126, 45, 0.22);
		--feature-hud-label: #d6ae7e;
		--feature-hud-value: #fff0c7;
		--feature-hud-secondary: #edc894;
	}

	.feature-hud-surface[data-feature-hud-tone='target'] {
		--feature-hud-accent-soft: rgba(201, 108, 42, 0.22);
		--feature-hud-label: #d0a77e;
		--feature-hud-value: #ffe1bd;
		--feature-hud-secondary: #deb58d;
	}

	.feature-hud-surface[data-feature-hud-tone='win'],
	.feature-hud-surface[data-feature-hud-tone='accent'],
	.feature-hud-surface[data-feature-hud-tone='success'] {
		--feature-hud-accent-soft: rgba(215, 162, 45, 0.22);
		--feature-hud-label: #d8bc7d;
		--feature-hud-value: #fff2b8;
		--feature-hud-secondary: #ead39b;
	}

	.feature-hud-surface[data-feature-hud-tone='danger'] {
		--feature-hud-accent-soft: rgba(219, 43, 34, 0.28);
		--feature-hud-label: #e2a19a;
		--feature-hud-value: #ffd0ca;
		--feature-hud-secondary: #f0b2ab;
	}

	.feature-hud-surface[data-feature-hud-tone='muted'] {
		--feature-hud-accent-soft: rgba(103, 121, 122, 0.11);
		--feature-hud-label: #829092;
		--feature-hud-value: #b5c0c0;
		--feature-hud-secondary: #939fa0;
	}

	.feature-hud-surface__label,
	.feature-hud-surface__value-row,
	.feature-hud-surface__value,
	.feature-hud-surface__secondary {
		position: relative;
		z-index: 2;
		display: block;
		overflow: hidden;
		max-width: 100%;
		margin: 0;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.feature-hud-surface__value-row {
		display: flex;
		grid-row: 2;
		grid-column: 1 / -1;
		align-items: center;
		justify-content: center;
		min-width: 0;
		gap: 5px;
	}

	.feature-hud-surface__label {
		grid-row: 1;
		grid-column: 1 / -1;
		align-self: end;
	}

	.feature-hud-surface__label-compact {
		display: none;
	}

	.feature-hud-surface[data-feature-hud-has-secondary='true'] .feature-hud-surface__label {
		grid-column: 1 / -1;
		justify-self: center;
	}

	.feature-hud-surface[data-feature-hud-has-secondary='true'] .feature-hud-surface__value-row {
		grid-row: 2;
		grid-column: 1;
		justify-self: end;
	}

	.feature-hud-surface__secondary {
		grid-row: 2;
		grid-column: 2;
		align-self: center;
		justify-self: start;
	}

	.feature-hud-surface[data-feature-hud-kind='base'] {
		display: grid;
		grid-template-columns: minmax(0, auto) auto;
		grid-template-rows: minmax(0, 1fr);
		align-items: center;
		justify-content: center;
		min-height: 28px;
		column-gap: 12px;
		row-gap: 0;
		padding: 2px 8px;
	}

	.feature-hud-surface[data-feature-hud-kind='base'] .feature-hud-surface__value-row {
		grid-row: 1;
		grid-column: 1;
		align-self: center;
		justify-self: end;
	}

	.feature-hud-surface[data-feature-hud-kind='base'] .feature-hud-surface__secondary {
		grid-row: 1;
		grid-column: 2;
		align-self: center;
		justify-self: start;
	}

	.feature-hud-surface__icon {
		width: clamp(18px, 1.9em, 28px);
		height: clamp(18px, 1.9em, 28px);
		object-fit: contain;
		filter: drop-shadow(0 2px 4px rgba(0, 0, 0, .72));
	}

	.feature-hud-surface__value--icon-label {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.feature-hud-surface__label,
	.feature-hud-surface__secondary {
		color: var(--feature-hud-label);
		font: 850 0.68em/1 ui-monospace, monospace;
		font-style: normal;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.feature-hud-surface__value {
		color: var(--feature-hud-value);
		font-family: Arial, Helvetica, sans-serif;
		font-size: clamp(11px, 1.28em, 17px);
		font-weight: 900;
		font-variant-numeric: tabular-nums;
		letter-spacing: 0.055em;
		text-shadow: 0 1px 0 rgba(0, 0, 0, 0.94), 0 0 8px var(--feature-hud-accent-soft);
	}

	.feature-hud-surface__secondary {
		max-width: 100%;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--feature-hud-secondary);
	}

	.feature-hud-surface[data-feature-hud-kind='base'] .feature-hud-surface__label,
	.feature-hud-surface[data-feature-hud-kind='base'] .feature-hud-surface__secondary {
		font: inherit;
		font-style: normal;
		letter-spacing: inherit;
		text-transform: none;
	}

	.feature-hud-surface[data-feature-hud-kind='base'] .feature-hud-surface__value {
		font-size: 1.08em;
	}

	.feature-hud-surface[data-feature-hud-kind='base'] .feature-hud-surface__secondary {
		padding: 0;
		border: 0;
		background: transparent;
	}

	.feature-hud-surface[data-feature-hud-kind='target'] .feature-hud-surface__value,
	.feature-hud-surface[data-feature-hud-kind='win'] .feature-hud-surface__value {
		font-size: clamp(12px, 1.36em, 18px);
	}

	.feature-hud-surface[data-feature-hud-ui-state='disabled'] {
		opacity: 0.58;
	}

	@media (max-width: 960px), (max-aspect-ratio: 4 / 3) {
		.feature-hud-surface[data-feature-hud-kind='base'] {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
			column-gap: 0;
		}

		.feature-hud-surface[data-feature-hud-kind='base'] .feature-hud-surface__value-row {
			grid-row: 1;
			grid-column: 1;
			align-self: end;
			justify-self: center;
		}

		.feature-hud-surface[data-feature-hud-kind='base'] .feature-hud-surface__secondary {
			grid-row: 2;
			grid-column: 1;
			align-self: start;
			justify-self: center;
		}
	}

	@media (max-width: 640px) {
		.feature-hud-surface {
			min-height: 30px;
			grid-template-rows: 10px minmax(0, 1fr);
			padding: 1px 4px 2px;
		}

		.feature-hud-surface__label,
		.feature-hud-surface__secondary {
			font-size: 0.62em;
			letter-spacing: 0.065em;
		}

		.feature-hud-surface__label.has-compact-label .feature-hud-surface__label-full {
			display: none;
		}

		.feature-hud-surface__label-compact {
			display: inline;
		}

		.feature-hud-surface__value,
		.feature-hud-surface[data-feature-hud-kind='target'] .feature-hud-surface__value,
		.feature-hud-surface[data-feature-hud-kind='win'] .feature-hud-surface__value {
			font-size: 1.08em;
		}

		.feature-hud-surface[data-feature-hud-kind='base'] {
			display: grid;
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
			place-items: center;
			min-height: 0;
			height: 100%;
			gap: 0;
			padding: 1px 3px;
		}

		.feature-hud-surface[data-feature-hud-kind='base'] .feature-hud-surface__value-row {
			grid-row: 1;
			grid-column: 1;
			align-self: end;
			justify-self: center;
		}

		.feature-hud-surface[data-feature-hud-kind='base'] .feature-hud-surface__secondary {
			grid-row: 2;
			grid-column: 1;
			align-self: start;
			justify-self: center;
		}

		.feature-hud-surface[data-feature-hud-kind='base'] .feature-hud-surface__value {
			font-size: .94em;
		}

		.feature-hud-surface[data-feature-hud-kind='base'] .feature-hud-surface__label,
		.feature-hud-surface[data-feature-hud-kind='base'] .feature-hud-surface__secondary {
			font-size: .58em;
			line-height: 1;
			letter-spacing: .035em;
		}
	}

	/* Free-spin telemetry must remain readable inside every authored shell rail.
	   Those rails can be only ~20px tall, so progress, target and win use one
	   strong row instead of clipping a decorative two-row composition. */
	.feature-hud-surface:is(
		[data-feature-hud-kind='progress'],
		[data-feature-hud-kind='target'],
		[data-feature-hud-kind='win']
	) {
		display: grid;
		height: 100%;
		min-height: 0;
		grid-template-columns: auto minmax(0, 1fr) auto;
		grid-template-rows: minmax(0, 1fr);
		align-items: center;
		column-gap: 5px;
		padding: 0 6px;
	}

	.feature-hud-surface:is(
		[data-feature-hud-kind='progress'],
		[data-feature-hud-kind='target'],
		[data-feature-hud-kind='win']
	) .feature-hud-surface__label {
		grid-row: 1;
		grid-column: 1;
		align-self: center;
		justify-self: start;
		font-size: 8px;
		letter-spacing: .07em;
	}

	.feature-hud-surface:is(
		[data-feature-hud-kind='progress'],
		[data-feature-hud-kind='target'],
		[data-feature-hud-kind='win']
	) .feature-hud-surface__value-row {
		grid-row: 1;
		grid-column: 2;
		align-self: center;
		justify-self: center;
		min-width: 0;
	}

	.feature-hud-surface[data-feature-hud-kind='progress'] .feature-hud-surface__value {
		font-size: 17px;
		letter-spacing: .015em;
	}

	.feature-hud-surface[data-feature-hud-kind='progress'] .feature-hud-surface__secondary {
		grid-row: 1;
		grid-column: 3;
		align-self: center;
		justify-self: end;
		font-size: 12px;
		font-weight: 900;
		letter-spacing: .055em;
	}

	.feature-hud-surface[data-feature-hud-kind='target'] .feature-hud-surface__value-row,
	.feature-hud-surface[data-feature-hud-kind='win'] .feature-hud-surface__value-row {
		grid-column: 2 / -1;
		max-width: 100%;
		gap: 4px;
	}

	.feature-hud-surface[data-feature-hud-kind='target'] .feature-hud-surface__icon {
		/* The authored rail is percentage-height and can be shallower than a
		   viewport-based icon tier. Keep the symbol as large as that exact rail
		   permits, but never let it be clipped at short/compact aspect ratios. */
		--feature-hud-target-icon-size: 26px;
		width: min(var(--feature-hud-target-icon-size), calc(100cqh - 2px));
		height: min(var(--feature-hud-target-icon-size), calc(100cqh - 2px));
		flex: 0 0 auto;
	}

	.feature-hud-surface[data-feature-hud-kind='target'] .feature-hud-surface__value--icon-label {
		position: static;
		width: auto;
		height: auto;
		min-width: 0;
		padding: 0;
		overflow: hidden;
		clip: auto;
		font-size: 14px;
		letter-spacing: .025em;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@media (min-width: 1401px) {
		.feature-hud-surface:is(
			[data-feature-hud-kind='progress'],
			[data-feature-hud-kind='target'],
			[data-feature-hud-kind='win']
		) .feature-hud-surface__label { font-size: 9px; }
		.feature-hud-surface[data-feature-hud-kind='progress'] .feature-hud-surface__value { font-size: 22px; }
		.feature-hud-surface[data-feature-hud-kind='progress'] .feature-hud-surface__secondary { font-size: 14px; }
		.feature-hud-surface[data-feature-hud-kind='target'] .feature-hud-surface__icon { --feature-hud-target-icon-size: 34px; }
		.feature-hud-surface[data-feature-hud-kind='target'] .feature-hud-surface__value--icon-label { font-size: 17px; }
	}

	@media (min-width: 481px) and (max-width: 1040px), (max-aspect-ratio: 4 / 3) {
		.feature-hud-surface:is(
			[data-feature-hud-kind='progress'],
			[data-feature-hud-kind='target'],
			[data-feature-hud-kind='win']
		) .feature-hud-surface__label { font-size: 9px; }
		.feature-hud-surface[data-feature-hud-kind='progress'] .feature-hud-surface__value { font-size: 19px; }
		.feature-hud-surface[data-feature-hud-kind='progress'] .feature-hud-surface__secondary { font-size: 13px; }
		.feature-hud-surface[data-feature-hud-kind='target'] .feature-hud-surface__icon { --feature-hud-target-icon-size: 32px; }
		.feature-hud-surface[data-feature-hud-kind='target'] .feature-hud-surface__value--icon-label { font-size: 16px; }
	}

	@media (max-width: 480px) and (orientation: portrait) {
		.feature-hud-surface:is(
			[data-feature-hud-kind='progress'],
			[data-feature-hud-kind='target'],
			[data-feature-hud-kind='win']
		) {
			column-gap: 3px;
			padding-inline: 3px;
		}
		.feature-hud-surface:is(
			[data-feature-hud-kind='progress'],
			[data-feature-hud-kind='target'],
			[data-feature-hud-kind='win']
		) .feature-hud-surface__label { font-size: 8px; }
		.feature-hud-surface[data-feature-hud-kind='progress'] .feature-hud-surface__value { font-size: 16px; }
		.feature-hud-surface[data-feature-hud-kind='progress'] .feature-hud-surface__secondary { font-size: 12px; }
		.feature-hud-surface[data-feature-hud-kind='target'] .feature-hud-surface__value-row { gap: 3px; }
		.feature-hud-surface[data-feature-hud-kind='target'] .feature-hud-surface__icon { --feature-hud-target-icon-size: 28px; }
		.feature-hud-surface[data-feature-hud-kind='target'] .feature-hud-surface__value--icon-label { font-size: 14px; }
	}

	@media (max-width: 370px) and (orientation: portrait) {
		.feature-hud-surface[data-feature-hud-kind='progress'] .feature-hud-surface__value { font-size: 15px; }
		.feature-hud-surface[data-feature-hud-kind='progress'] .feature-hud-surface__secondary { font-size: 11px; }
		.feature-hud-surface[data-feature-hud-kind='target'] .feature-hud-surface__icon { --feature-hud-target-icon-size: 26px; }
		.feature-hud-surface[data-feature-hud-kind='target'] .feature-hud-surface__value--icon-label { font-size: 13px; }
	}

	@media (max-width: 330px) and (orientation: portrait) {
		.feature-hud-surface:is(
			[data-feature-hud-kind='progress'],
			[data-feature-hud-kind='target'],
			[data-feature-hud-kind='win']
		) .feature-hud-surface__label { font-size: 7px; }
		.feature-hud-surface[data-feature-hud-kind='progress'] .feature-hud-surface__value { font-size: 13px; }
		.feature-hud-surface[data-feature-hud-kind='progress'] .feature-hud-surface__secondary { font-size: 9px; }
		.feature-hud-surface[data-feature-hud-kind='target'] .feature-hud-surface__icon { --feature-hud-target-icon-size: 22px; }
		.feature-hud-surface[data-feature-hud-kind='target'] .feature-hud-surface__value--icon-label { font-size: 11px; }
	}

	@media (max-height: 560px) and (min-aspect-ratio: 2 / 1) {
		.feature-hud-surface:is(
			[data-feature-hud-kind='progress'],
			[data-feature-hud-kind='target'],
			[data-feature-hud-kind='win']
		) {
			column-gap: 4px;
			padding-inline: 4px;
		}
		.feature-hud-surface:is(
			[data-feature-hud-kind='progress'],
			[data-feature-hud-kind='target'],
			[data-feature-hud-kind='win']
		) .feature-hud-surface__label { font-size: 7px; }
		.feature-hud-surface[data-feature-hud-kind='progress'] .feature-hud-surface__value { font-size: min(20px, calc(100cqh - 4px)); }
		.feature-hud-surface[data-feature-hud-kind='progress'] .feature-hud-surface__secondary { font-size: 14px; }
		.feature-hud-surface[data-feature-hud-kind='target'] .feature-hud-surface__icon { --feature-hud-target-icon-size: 28px; }
		.feature-hud-surface[data-feature-hud-kind='target'] .feature-hud-surface__value--icon-label { font-size: 15px; }
	}

	/* A tall feature rail replaces the normal monitor header while free spins
	   run. Two-row cards make the remaining-spin count and expanding symbol the
	   dominant information without covering the reels. */
	@container feature-telemetry-rail (min-height: 60px) {
		.feature-hud-surface:is(
			[data-feature-hud-kind='progress'],
			[data-feature-hud-kind='target'],
			[data-feature-hud-kind='win']
		) {
			grid-template-columns: minmax(0, 1fr) auto;
			grid-template-rows: auto minmax(0, 1fr);
			align-content: stretch;
			column-gap: clamp(4px, 5cqh, 8px);
			row-gap: 1px;
			padding: clamp(4px, 5cqh, 8px) clamp(7px, 8cqh, 12px);
		}

		.feature-hud-surface:is(
			[data-feature-hud-kind='progress'],
			[data-feature-hud-kind='target'],
			[data-feature-hud-kind='win']
		) .feature-hud-surface__label {
			grid-row: 1;
			grid-column: 1 / -1;
			justify-self: center;
			font-size: clamp(9px, 12cqh, 12px);
			letter-spacing: .105em;
		}

		.feature-hud-surface:is(
			[data-feature-hud-kind='progress'],
			[data-feature-hud-kind='target'],
			[data-feature-hud-kind='win']
		) .feature-hud-surface__value-row {
			grid-row: 2;
			grid-column: 1;
			justify-self: center;
		}

		.feature-hud-surface[data-feature-hud-kind='progress'] .feature-hud-surface__value {
			font-size: clamp(24px, 34cqh, 34px);
		}

		.feature-hud-surface[data-feature-hud-kind='progress'] .feature-hud-surface__secondary {
			grid-row: 2;
			grid-column: 2;
			align-self: center;
			font-size: clamp(14px, 20cqh, 20px);
		}

		.feature-hud-surface[data-feature-hud-kind='target'] .feature-hud-surface__value-row,
		.feature-hud-surface[data-feature-hud-kind='win'] .feature-hud-surface__value-row {
			grid-column: 1 / -1;
			gap: clamp(5px, 7cqh, 9px);
		}

		.feature-hud-surface[data-feature-hud-kind='target'] .feature-hud-surface__icon {
			--feature-hud-target-icon-size: clamp(38px, 65cqh, 64px);
		}

		.feature-hud-surface[data-feature-hud-kind='target'] .feature-hud-surface__value--icon-label {
			font-size: clamp(15px, 22cqh, 22px);
		}

		.feature-hud-surface[data-feature-hud-kind='win'] .feature-hud-surface__value {
			font-size: clamp(20px, 30cqh, 30px);
		}
	}

	@media (max-width: 480px) and (orientation: portrait) {
		@container feature-telemetry-rail (min-height: 60px) {
			.feature-hud-surface:is(
				[data-feature-hud-kind='progress'],
				[data-feature-hud-kind='target'],
				[data-feature-hud-kind='win']
			) {
				grid-template-columns: minmax(0, 1fr);
				grid-template-rows: auto minmax(0, 1fr) auto;
				padding: 4px 1px;
			}

			.feature-hud-surface:is(
				[data-feature-hud-kind='progress'],
				[data-feature-hud-kind='target'],
				[data-feature-hud-kind='win']
			) .feature-hud-surface__label {
				grid-row: 1;
				font-size: clamp(8px, 10cqh, 11px);
			}

			.feature-hud-surface:is(
				[data-feature-hud-kind='progress'],
				[data-feature-hud-kind='target'],
				[data-feature-hud-kind='win']
			) .feature-hud-surface__value-row {
				grid-row: 2;
				grid-column: 1;
			}

			.feature-hud-surface[data-feature-hud-kind='progress'] .feature-hud-surface__value {
				font-size: clamp(22px, 28cqh, 27px);
			}

			.feature-hud-surface[data-feature-hud-kind='progress'] .feature-hud-surface__secondary {
				grid-row: 3;
				grid-column: 1;
				justify-self: center;
				font-size: clamp(13px, 17cqh, 17px);
			}

			.feature-hud-surface[data-feature-hud-kind='target'] .feature-hud-surface__value-row {
				flex-direction: column;
				gap: 1px;
			}

			.feature-hud-surface[data-feature-hud-kind='target'] .feature-hud-surface__icon {
				--feature-hud-target-icon-size: clamp(38px, 52cqh, 56px);
			}

			.feature-hud-surface[data-feature-hud-kind='target'] .feature-hud-surface__value--icon-label {
				max-width: 100%;
				font-size: clamp(13px, 17cqh, 17px);
			}
		}
	}

	@media (max-height: 560px) and (min-aspect-ratio: 2 / 1) {
		.feature-hud-surface[data-feature-hud-kind='target'] .feature-hud-surface__label.has-compact-label .feature-hud-surface__label-full {
			display: none;
		}

		.feature-hud-surface[data-feature-hud-kind='target'] .feature-hud-surface__label-compact {
			display: inline;
		}

		.feature-hud-surface[data-feature-hud-kind='progress'] {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: auto minmax(0, 1fr) auto;
			padding: 8px 5px;
		}

		.feature-hud-surface[data-feature-hud-kind='progress'] .feature-hud-surface__label {
			grid-row: 1;
			grid-column: 1;
			justify-self: center;
		}

		.feature-hud-surface[data-feature-hud-kind='progress'] .feature-hud-surface__value-row {
			grid-row: 2;
			grid-column: 1;
		}

		.feature-hud-surface[data-feature-hud-kind='progress'] .feature-hud-surface__secondary {
			grid-row: 3;
			grid-column: 1;
			justify-self: center;
		}

		.feature-hud-surface[data-feature-hud-kind='progress'] .feature-hud-surface__value {
			font-size: clamp(20px, 3.2vw, 32px);
		}

		.feature-hud-surface[data-feature-hud-kind='progress'] .feature-hud-surface__secondary {
			font-size: clamp(12px, 2vw, 18px);
		}

		.feature-hud-surface[data-feature-hud-kind='target'] .feature-hud-surface__icon {
			--feature-hud-target-icon-size: clamp(30px, 7vw, 64px);
		}

		.feature-hud-surface[data-feature-hud-kind='target'] .feature-hud-surface__value-row {
			flex-direction: column;
			gap: 2px;
		}

		.feature-hud-surface[data-feature-hud-kind='target'] .feature-hud-surface__value--icon-label {
			position: absolute;
			width: 1px;
			height: 1px;
			padding: 0;
			overflow: hidden;
			clip: rect(0, 0, 0, 0);
			white-space: nowrap;
		}

		.feature-hud-surface[data-feature-hud-kind='win'] {
			grid-template-columns: auto minmax(0, 1fr);
			grid-template-rows: minmax(0, 1fr);
			gap: 5px;
			padding: 0 6px;
		}

		.feature-hud-surface[data-feature-hud-kind='win'] .feature-hud-surface__label {
			grid-row: 1;
			grid-column: 1;
			font-size: 7px;
		}

		.feature-hud-surface[data-feature-hud-kind='win'] .feature-hud-surface__value-row {
			grid-row: 1;
			grid-column: 2;
		}

		.feature-hud-surface[data-feature-hud-kind='win'] .feature-hud-surface__value {
			font-size: clamp(14px, 2vw, 20px);
		}
	}

	@media (max-width: 699px) and (max-height: 560px) and (min-aspect-ratio: 2 / 1) {
		.feature-hud-surface:is(
			[data-feature-hud-kind='progress'],
			[data-feature-hud-kind='target'],
			[data-feature-hud-kind='win']
		) .feature-hud-surface__label {
			font-size: 6px;
		}

		.feature-hud-surface[data-feature-hud-kind='progress'] .feature-hud-surface__value { font-size: 18px; }
		.feature-hud-surface[data-feature-hud-kind='progress'] .feature-hud-surface__secondary { font-size: 12px; }
		.feature-hud-surface[data-feature-hud-kind='target'] .feature-hud-surface__icon { --feature-hud-target-icon-size: 24px; }
		.feature-hud-surface[data-feature-hud-kind='target'] .feature-hud-surface__value--icon-label { font-size: 13px; }
	}

	/* The expanding target's authoritative symbol artwork already communicates
	   the value. Keep its text for screen readers and automated contracts, but do
	   not print the same rank a second time beside or below the asset. */
	.feature-hud-surface[data-feature-hud-kind='target'] .feature-hud-surface__value--icon-label {
		position: absolute !important;
		width: 1px !important;
		height: 1px !important;
		padding: 0 !important;
		overflow: hidden !important;
		clip: rect(0, 0, 0, 0) !important;
		white-space: nowrap !important;
	}
</style>
