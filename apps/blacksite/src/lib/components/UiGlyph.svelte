<script>
	import { createEventDispatcher, onMount } from 'svelte';
	import { BLACKSITE_ASSETS } from '../assets/blacksite-assets.js';
	import {
		blacksiteUiV21GlyphRow,
		preloadBlacksiteUiV21Sources,
		resolveBlacksiteUiV21Glyph,
		resolveBlacksiteUiV21State,
	} from '../assets/blacksite-ui-v21.js';

	export let name = 'info';
	export let size = 26;
	export let state = 'idle';
	export let tone = 'neutral';
	export let disabled = false;
	export let danger = false;
	export let pressed = false;
	export let focused = false;
	export let selected = false;
	export let hovered = false;
	export let interactive = true;
	export let enabled = false;
	export let fallbackSrc = '';
	export let kit = BLACKSITE_ASSETS.ui.v21;

	const dispatch = createEventDispatcher();
	let mounted = false;
	let destroyed = false;
	let loadGeneration = 0;
	let lastLoadKey = '';
	let ready = false;
	let failed = false;

	$: glyphName = resolveBlacksiteUiV21Glyph(name);
	$: resolvedState = resolveBlacksiteUiV21State({
		state,
		disabled,
		danger,
		pressed,
		focused,
		selected,
		hovered,
		tone,
	});
	$: glyphAtlas = kit?.atlases?.glyphs;
	$: glyphCell = glyphAtlas?.glyphs?.[glyphName] ?? glyphAtlas?.glyphs?.info;
	$: glyphRow = blacksiteUiV21GlyphRow(kit, resolvedState);
	$: atlasSource = glyphAtlas?.source ?? '';
	$: sourceSignature = `${enabled ? 'on' : 'off'}:${atlasSource}`;
	$: renderedSize = Number.isFinite(Number(size)) ? Math.max(1, Number(size)) : 26;
	$: glyphStyle = [
		`--ui-v21-glyph-size:${renderedSize}px`,
		`--ui-v21-glyph-source:${cssUrl(atlasSource)}`,
		`--ui-v21-glyph-x:${glyphCell?.positionXPercent ?? 0}%`,
	].join(';');
	$: if (mounted) prepareSource(sourceSignature, atlasSource);

	function cssUrl(source) {
		if (!source) return 'none';
		return `url("${String(source).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}")`;
	}

	function prepareSource(key, source) {
		if (key === lastLoadKey) return;
		lastLoadKey = key;
		const token = ++loadGeneration;
		ready = false;
		failed = false;
		if (!enabled) return;
		void preloadBlacksiteUiV21Sources([source]).then((loaded) => {
			if (destroyed || token !== loadGeneration) return;
			ready = loaded;
			failed = !loaded;
			dispatch(loaded ? 'ready' : 'error', { source, glyph: glyphName });
		});
	}

	onMount(() => {
		mounted = true;
		prepareSource(sourceSignature, atlasSource);
		return () => {
			destroyed = true;
			loadGeneration += 1;
		};
	});
</script>

<span
	class="ui-glyph"
	data-testid="ui-v21-glyph"
	data-ui-kit="v21"
	data-ui-primitive="glyph"
	data-ui-icon={glyphName}
	data-ui-state={resolvedState}
	data-ui-tone={tone}
	data-ui-ready={ready ? 'true' : 'false'}
	data-ui-fallback={!ready && fallbackSrc ? 'true' : 'false'}
	data-ui-failed={failed ? 'true' : 'false'}
	data-ui-interactive={interactive ? 'true' : 'false'}
	data-ui-atlas-column={glyphCell?.column ?? 0}
	data-ui-atlas-row={glyphRow?.row ?? 0}
	data-ui-source={atlasSource}
	style={glyphStyle}
	aria-hidden="true"
>
	{#if enabled && ready}
		<span class="ui-glyph__art"></span>
	{:else if fallbackSrc}
		<img class="ui-glyph__fallback" src={fallbackSrc} alt="" draggable="false" />
	{/if}
</span>

<style>
	.ui-glyph {
		position: relative;
		display: block;
		width: var(--ui-v21-glyph-size);
		height: var(--ui-v21-glyph-size);
		flex: none;
		isolation: isolate;
		pointer-events: none;
		user-select: none;
		--ui-v21-glyph-y: 0%;
	}

	.ui-glyph__art,
	.ui-glyph__fallback {
		position: absolute;
		inset: 0;
		display: block;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}

	.ui-glyph__art {
		background-image: var(--ui-v21-glyph-source);
		background-repeat: no-repeat;
		background-position: var(--ui-v21-glyph-x) var(--ui-v21-glyph-y);
		background-size: 1600% 500%;
	}

	.ui-glyph__fallback {
		object-fit: contain;
	}

	/*
	 * The glyph atlas row remains a discrete state swap. V22 only eases visual
	 * emphasis, preventing interpolation across neighbouring sprite rows.
	 */
	:global([data-ui-kit='v22']) .ui-glyph[data-ui-interactive='true'] .ui-glyph__art,
	:global([data-ui-kit='v22']) .ui-glyph[data-ui-interactive='true'] .ui-glyph__fallback {
		transition:
			filter 130ms cubic-bezier(.2, .8, .2, 1),
			opacity 130ms ease-out;
	}

	.ui-glyph[data-ui-state='hover'],
	.ui-glyph[data-ui-state='focus'] { --ui-v21-glyph-y: 25%; }
	.ui-glyph[data-ui-state='pressed'],
	.ui-glyph[data-ui-state='selected'] { --ui-v21-glyph-y: 50%; }
	.ui-glyph[data-ui-state='disabled'] { --ui-v21-glyph-y: 75%; }
	.ui-glyph[data-ui-state='danger'] { --ui-v21-glyph-y: 100%; }

	:global([data-ui-kit='v22']) .ui-glyph[data-ui-state='hover'] :is(.ui-glyph__art, .ui-glyph__fallback) {
		filter: brightness(1.08) contrast(1.03);
	}
	:global([data-ui-kit='v22']) .ui-glyph[data-ui-state='pressed'] :is(.ui-glyph__art, .ui-glyph__fallback) {
		filter: brightness(.84) contrast(1.08) saturate(.92);
		transition-duration: 80ms;
	}
	:global([data-ui-kit='v22']) .ui-glyph[data-ui-state='focus'] :is(.ui-glyph__art, .ui-glyph__fallback) {
		filter: brightness(1.1) contrast(1.04);
	}
	:global([data-ui-kit='v22']) .ui-glyph[data-ui-state='selected'] :is(.ui-glyph__art, .ui-glyph__fallback) {
		filter: brightness(1.12) contrast(1.05) saturate(1.04);
	}
	:global([data-ui-kit='v22']) .ui-glyph[data-ui-state='disabled'] :is(.ui-glyph__art, .ui-glyph__fallback) {
		filter: grayscale(.68) brightness(.72);
		opacity: .74;
	}
	:global([data-ui-kit='v22']) .ui-glyph[data-ui-state='danger'] :is(.ui-glyph__art, .ui-glyph__fallback) {
		filter: brightness(.96) contrast(1.1) saturate(.86);
	}

	@media (hover: hover) {
		:global(button:hover:not(:disabled)) .ui-glyph[data-ui-interactive='true'][data-ui-state='idle'] {
			--ui-v21-glyph-y: 25%;
		}
	}

	:global(button.selected:not(:disabled)) .ui-glyph[data-ui-interactive='true'][data-ui-state='idle'],
	:global(button.selected:not(:disabled)) .ui-glyph[data-ui-interactive='true'][data-ui-state='hover'],
	:global(button.active:not(:disabled)) .ui-glyph[data-ui-interactive='true'][data-ui-state='idle'],
	:global(button.active:not(:disabled)) .ui-glyph[data-ui-interactive='true'][data-ui-state='hover'],
	:global(button[aria-selected='true']:not(:disabled)) .ui-glyph[data-ui-interactive='true'][data-ui-state='idle'],
	:global(button[aria-selected='true']:not(:disabled)) .ui-glyph[data-ui-interactive='true'][data-ui-state='hover'],
	:global(button[aria-pressed='true']:not(:disabled)) .ui-glyph[data-ui-interactive='true'][data-ui-state='idle'],
	:global(button[aria-pressed='true']:not(:disabled)) .ui-glyph[data-ui-interactive='true'][data-ui-state='hover'] {
		--ui-v21-glyph-y: 50%;
	}

	:global(button:focus-visible:not(:disabled)) .ui-glyph[data-ui-interactive='true'][data-ui-state='idle'],
	:global(button:focus-visible:not(:disabled)) .ui-glyph[data-ui-interactive='true'][data-ui-state='hover'],
	:global(button:focus-visible:not(:disabled)) .ui-glyph[data-ui-interactive='true'][data-ui-state='selected'] {
		--ui-v21-glyph-y: 25%;
	}

	:global(button:active:not(:disabled)) .ui-glyph[data-ui-interactive='true'][data-ui-state='idle'],
	:global(button:active:not(:disabled)) .ui-glyph[data-ui-interactive='true'][data-ui-state='hover'],
	:global(button:active:not(:disabled)) .ui-glyph[data-ui-interactive='true'][data-ui-state='focus'],
	:global(button:active:not(:disabled)) .ui-glyph[data-ui-interactive='true'][data-ui-state='selected'] {
		--ui-v21-glyph-y: 50%;
	}

	:global(button:disabled) .ui-glyph[data-ui-interactive='true'] {
		--ui-v21-glyph-y: 75%;
	}

	@media (hover: hover) {
		:global([data-ui-kit='v22']) :global(button:hover:not(:disabled)) .ui-glyph[data-ui-interactive='true'] :is(.ui-glyph__art, .ui-glyph__fallback) {
			filter: brightness(1.08) contrast(1.03);
		}
	}

	:global([data-ui-kit='v22']) :global(button.selected:not(:disabled)) .ui-glyph[data-ui-interactive='true'] :is(.ui-glyph__art, .ui-glyph__fallback),
	:global([data-ui-kit='v22']) :global(button.active:not(:disabled)) .ui-glyph[data-ui-interactive='true'] :is(.ui-glyph__art, .ui-glyph__fallback),
	:global([data-ui-kit='v22']) :global(button[aria-selected='true']:not(:disabled)) .ui-glyph[data-ui-interactive='true'] :is(.ui-glyph__art, .ui-glyph__fallback),
	:global([data-ui-kit='v22']) :global(button[aria-pressed='true']:not(:disabled)) .ui-glyph[data-ui-interactive='true'] :is(.ui-glyph__art, .ui-glyph__fallback) {
		filter: brightness(1.12) contrast(1.05) saturate(1.04);
	}

	:global([data-ui-kit='v22']) :global(button:focus-visible:not(:disabled)) .ui-glyph[data-ui-interactive='true'] :is(.ui-glyph__art, .ui-glyph__fallback) {
		filter: brightness(1.1) contrast(1.04);
	}

	:global([data-ui-kit='v22']) :global(button:active:not(:disabled)) .ui-glyph[data-ui-interactive='true'] :is(.ui-glyph__art, .ui-glyph__fallback) {
		filter: brightness(.84) contrast(1.08) saturate(.92);
		transition-duration: 80ms;
	}

	:global([data-ui-kit='v22']) :global(button:disabled) .ui-glyph[data-ui-interactive='true'] :is(.ui-glyph__art, .ui-glyph__fallback) {
		filter: grayscale(.68) brightness(.72);
		opacity: .74;
	}

	/* Retain sprite-state feedback while shedding animated filter cost. */
	:global([data-render-quality='reduced'][data-ui-kit='v22']) .ui-glyph[data-ui-interactive='true'] :is(.ui-glyph__art, .ui-glyph__fallback) {
		filter: none !important;
		transition-property: opacity;
		transition-duration: 120ms;
	}

	@media (prefers-reduced-motion: reduce) {
		:global([data-ui-kit='v22']) .ui-glyph[data-ui-interactive='true'] :is(.ui-glyph__art, .ui-glyph__fallback) {
			transition: none !important;
		}
	}
</style>
