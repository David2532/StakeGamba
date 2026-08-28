<script>
	import UiSurface from './UiSurface.svelte';

	export let assets;
	export let kind = 'control';
	export let tone = 'neutral';
	export let state = 'idle';
	export let disabled = false;
	export let selected = false;

	$: fallbackSrc = disabled
		? assets?.disabled ?? assets?.normal ?? ''
		: selected || state === 'selected'
			? assets?.active ?? assets?.selected ?? assets?.normal ?? ''
			: state === 'pressed'
				? assets?.pressed ?? assets?.active ?? assets?.selected ?? assets?.hover ?? assets?.normal ?? ''
				: state === 'hover' || state === 'focus'
					? assets?.hover ?? assets?.normal ?? ''
					: assets?.normal ?? '';
</script>

{#if __BLACKSITE_MODERN_PRESENTATION__}
	<span class="panel-state-art panel-state-art--v21" aria-hidden="true">
		<UiSurface
			enabled={true}
			{kind}
			{tone}
			{state}
			{disabled}
			{selected}
			fallbackSrc={fallbackSrc}
		/>
	</span>
{:else}
	<picture class="panel-state-art" aria-hidden="true">
		<img class="panel-state-art__state panel-state-art__normal" src={assets.normal} alt="" draggable="false" />
		{#if assets.hover}<img class="panel-state-art__state panel-state-art__hover" src={assets.hover} alt="" draggable="false" />{/if}
		<img
			class="panel-state-art__state panel-state-art__pressed"
			src={assets.pressed ?? assets.active ?? assets.selected ?? assets.hover ?? assets.normal}
			alt=""
			draggable="false"
		/>
		{#if assets.active ?? assets.selected}<img class="panel-state-art__state panel-state-art__active" src={assets.active ?? assets.selected} alt="" draggable="false" />{/if}
		{#if assets.disabled}<img class="panel-state-art__state panel-state-art__disabled" src={assets.disabled} alt="" draggable="false" />{/if}
	</picture>
{/if}

<style>
	.panel-state-art {
		position: absolute;
		z-index: 0;
		inset: 0;
		display: block;
		width: 100%;
		height: 100%;
		pointer-events: none;
		user-select: none;
	}

	.panel-state-art__state {
		position: absolute;
		inset: 0;
		display: block;
		width: 100%;
		height: 100%;
		object-fit: fill;
		opacity: 0;
		pointer-events: none;
	}

	.panel-state-art__normal { opacity: 1; }

	:global(button:hover:not(:disabled)) .panel-state-art__normal,
	:global(button:focus-visible:not(:disabled)) .panel-state-art__normal,
	:global(button:active:not(:disabled)) .panel-state-art__normal,
	:global(button.selected:not(:disabled)) .panel-state-art__normal,
	:global(button[aria-pressed='true']:not(:disabled)) .panel-state-art__normal,
	:global(button:disabled) .panel-state-art__normal { opacity: 0; }

	:global(button:hover:not(:disabled)) .panel-state-art__hover,
	:global(button:focus-visible:not(:disabled)) .panel-state-art__hover { opacity: 1; }

	:global(button.selected:not(:disabled)) .panel-state-art__hover,
	:global(button[aria-pressed='true']:not(:disabled)) .panel-state-art__hover,
	:global(button:active:not(:disabled)) .panel-state-art__hover { opacity: 0; }

	:global(button.selected:not(:disabled)) .panel-state-art__active,
	:global(button[aria-pressed='true']:not(:disabled)) .panel-state-art__active { opacity: 1; }

	:global(button:active:not(:disabled)) .panel-state-art__active { opacity: 0; }
	:global(button:active:not(:disabled)) .panel-state-art__pressed { opacity: 1; }
	:global(button:disabled) .panel-state-art__disabled { opacity: 1; }
</style>
