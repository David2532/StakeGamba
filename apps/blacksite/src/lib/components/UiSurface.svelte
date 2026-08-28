<script>
	import { createEventDispatcher, onMount } from 'svelte';
	import { BLACKSITE_ASSETS } from '../assets/blacksite-assets.js';
	import {
		blacksiteUiV21SurfaceSources,
		preloadBlacksiteUiV21Sources,
		resolveBlacksiteUiV21State,
	} from '../assets/blacksite-ui-v21.js';

	export let kind = 'control';
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
	export let kit = null;

	const dispatch = createEventDispatcher();
	const SURFACE_KINDS = Object.freeze([
		'control',
		'panel',
		'readout',
		'round',
		'feature',
		'content',
		'header',
		'award',
		'chip',
		'progress',
	]);
	const V27_FALLBACK_KINDS = Object.freeze({
		feature: 'readout',
		content: 'panel',
		header: 'panel',
		award: 'panel',
		chip: 'readout',
		progress: 'readout',
	});
	let mounted = false;
	let destroyed = false;
	let loadGeneration = 0;
	let lastLoadKey = '';
	let ready = false;
	let failed = false;

	$: activeKit = kit ?? (enabled
		? BLACKSITE_ASSETS.ui.v27 ?? BLACKSITE_ASSETS.ui.v22 ?? BLACKSITE_ASSETS.ui.v21
		: BLACKSITE_ASSETS.ui.v22 ?? BLACKSITE_ASSETS.ui.v21);
	$: surfaceKind = SURFACE_KINDS.includes(kind) ? kind : 'control';
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
	$: sources = blacksiteUiV21SurfaceSources(activeKit, surfaceKind);
	$: sourceSignature = `${enabled ? 'on' : 'off'}:${surfaceKind}:${sources.join('|')}`;
	$: surfaceStyle = buildSurfaceStyle(activeKit, surfaceKind, resolvedState);
	$: currentSource = sourceForState(activeKit, surfaceKind, resolvedState);
	$: inheritedFallbackKind = V27_FALLBACK_KINDS[surfaceKind] ?? surfaceKind;
	$: automaticFallbackSrc = enabled && activeKit?.version === 27 && !fallbackSrc
		? sourceForState(BLACKSITE_ASSETS.ui.v22 ?? BLACKSITE_ASSETS.ui.v21, inheritedFallbackKind, resolvedState)
		: '';
	$: effectiveFallbackSrc = fallbackSrc || automaticFallbackSrc;
	$: sliceHook = sliceHookForKind(activeKit, surfaceKind);
	$: if (mounted) prepareSources(sourceSignature, sources);

	function cssUrl(source) {
		if (!source) return 'none';
		return `url("${String(source).replaceAll('\\', '\\\\').replaceAll('"', '\\"')}")`;
	}

	function buildSurfaceStyle(catalog, nextKind, nextState) {
		if (nextKind === 'round') {
			return `--ui-v21-round-source:${cssUrl(catalog?.atlases?.roundStates?.source)}`;
		}
		const surface = catalog?.nineSlice?.[nextKind] ?? {};
		const states = surface.states ?? {};
		const slice = surface.sliceInsets;
		const selectedSource = sourceForState(catalog, nextKind, nextState);
		return [
			`--ui-frame-source:${cssUrl(selectedSource)}`,
			...(slice ? [
				`--ui-slice-top:${slice.top}`,
				`--ui-slice-right:${slice.right}`,
				`--ui-slice-bottom:${slice.bottom}`,
				`--ui-slice-left:${slice.left}`,
			] : []),
			...Object.entries(states)
			.map(([nextState, source]) => `--ui-v21-${nextKind}-${nextState}:${cssUrl(source)}`)
		].join(';');
	}

	function sourceForState(catalog, nextKind, nextState) {
		if (nextKind === 'round') return catalog?.atlases?.roundStates?.source ?? '';
		const stateSources = catalog?.nineSlice?.[nextKind]?.states ?? {};
		return stateSources[nextState]
			?? stateSources[nextState === 'danger' ? 'danger' : 'idle']
			?? stateSources.idle
			?? '';
	}

	function sliceHookForKind(catalog, nextKind) {
		if (nextKind === 'round') return 'atlas:200x200';
		const slice = catalog?.nineSlice?.[nextKind]?.sliceInsets;
		return slice ? `${slice.top} ${slice.right} ${slice.bottom} ${slice.left}` : '';
	}

	function prepareSources(key, nextSources) {
		if (key === lastLoadKey) return;
		lastLoadKey = key;
		const token = ++loadGeneration;
		ready = false;
		failed = false;
		if (!enabled) return;
		void preloadBlacksiteUiV21Sources(nextSources).then((loaded) => {
			if (destroyed || token !== loadGeneration) return;
			ready = loaded;
			failed = !loaded;
			dispatch(loaded ? 'ready' : 'error', {
				kind: surfaceKind,
				sources: [...nextSources],
			});
		});
	}

	onMount(() => {
		mounted = true;
		prepareSources(sourceSignature, sources);
		return () => {
			destroyed = true;
			loadGeneration += 1;
		};
	});
</script>

<span
	class="ui-surface"
	data-testid="ui-v21-surface"
	data-ui-kit={`v${activeKit?.version ?? 21}`}
	data-ui-primitive={surfaceKind}
	data-ui-state={resolvedState}
	data-ui-tone={tone}
	data-ui-ready={ready ? 'true' : 'false'}
	data-ui-fallback={!ready && effectiveFallbackSrc ? 'true' : 'false'}
	data-ui-fallback-kind={automaticFallbackSrc ? `v22-${inheritedFallbackKind}` : fallbackSrc ? 'explicit' : 'none'}
	data-ui-failed={failed ? 'true' : 'false'}
	data-ui-interactive={interactive && (surfaceKind === 'control' || surfaceKind === 'round') ? 'true' : 'false'}
	data-ui-slice-insets={sliceHook}
	data-ui-source={currentSource}
	style={surfaceStyle}
	aria-hidden="true"
>
	{#if enabled && ready}
		<span class="ui-surface__frame"></span>
	{:else if effectiveFallbackSrc}
		<img class="ui-surface__fallback" src={effectiveFallbackSrc} alt="" draggable="false" />
	{/if}
</span>

<style>
	.ui-surface,
	.ui-surface__frame,
	.ui-surface__fallback {
		position: absolute;
		inset: 0;
		display: block;
		width: 100%;
		height: 100%;
		box-sizing: border-box;
		pointer-events: none;
		user-select: none;
	}

	.ui-surface {
		z-index: 0;
		isolation: isolate;
	}

	.ui-surface__fallback {
		object-fit: fill;
	}

	.ui-surface[data-ui-primitive='control'] {
		--ui-v21-frame-source: var(--ui-v21-control-idle);
	}

	.ui-surface[data-ui-primitive='panel'] {
		--ui-v21-frame-source: var(--ui-v21-panel-idle);
	}

	.ui-surface[data-ui-primitive='readout'] {
		--ui-v21-frame-source: var(--ui-v21-readout-idle);
	}

	.ui-surface:not([data-ui-primitive='round']) {
		--ui-surface-border-y: 10px;
		--ui-surface-border-x: 12px;
	}

	.ui-surface:not([data-ui-primitive='round']) .ui-surface__frame {
		border-style: solid;
		border-color: transparent;
		border-width: var(--ui-surface-border-y) var(--ui-surface-border-x);
		border-image-source: var(--ui-frame-source);
		border-image-slice: var(--ui-slice-top, 48) var(--ui-slice-right, 48) var(--ui-slice-bottom, 48) var(--ui-slice-left, 48) fill;
		border-image-width: 1;
		border-image-outset: 0;
		border-image-repeat: stretch;
	}

	.ui-surface[data-ui-primitive='control'] .ui-surface__frame {
		--ui-surface-border-y: var(--ui-v21-control-border, 14px);
		--ui-surface-border-x: var(--ui-v21-control-border, 14px);
		border-image-source: var(--ui-v21-frame-source);
	}

	.ui-surface[data-ui-primitive='panel'] .ui-surface__frame {
		--ui-surface-border-y: var(--ui-v21-panel-border, 20px);
		--ui-surface-border-x: var(--ui-v21-panel-border, 20px);
		border-image-source: var(--ui-v21-frame-source);
	}

	.ui-surface[data-ui-primitive='readout'] .ui-surface__frame {
		--ui-surface-border-y: var(--ui-v21-readout-border-y, 8px);
		--ui-surface-border-x: var(--ui-v21-readout-border-x, 12px);
		border-image-source: var(--ui-v21-frame-source);
	}

	.ui-surface[data-ui-primitive='feature'] { --ui-surface-border-y: 8px; --ui-surface-border-x: 12px; }
	.ui-surface[data-ui-primitive='content'] { --ui-surface-border-y: 7px; --ui-surface-border-x: 10px; }
	.ui-surface[data-ui-primitive='header'] { --ui-surface-border-y: 8px; --ui-surface-border-x: 14px; }
	.ui-surface[data-ui-primitive='award'] { --ui-surface-border-y: 14px; --ui-surface-border-x: 18px; }
	.ui-surface[data-ui-primitive='chip'] { --ui-surface-border-y: 5px; --ui-surface-border-x: 9px; }
	.ui-surface[data-ui-primitive='progress'] { --ui-surface-border-y: 3px; --ui-surface-border-x: 9px; }

	.ui-surface[data-ui-primitive='round'] {
		--ui-v21-round-position: 0%;
	}

	.ui-surface[data-ui-primitive='round'] .ui-surface__frame {
		background-image: var(--ui-v21-round-source);
		background-repeat: no-repeat;
		background-position: var(--ui-v21-round-position) 0;
		background-size: 700% 100%;
	}

	/*
	 * Keep atlas/source swaps discrete so sprite cells never smear into one another.
	 * V22 feedback is instead blended on compositor-friendly visual properties.
	 */
	.ui-surface:is([data-ui-kit='v22'], [data-ui-kit='v27'])[data-ui-interactive='true'] .ui-surface__frame,
	.ui-surface:is([data-ui-kit='v22'], [data-ui-kit='v27'])[data-ui-interactive='true'] .ui-surface__fallback {
		transition:
			filter 135ms cubic-bezier(.2, .8, .2, 1),
			opacity 135ms ease-out;
	}

	.ui-surface[data-ui-primitive='control'][data-ui-state='hover'] { --ui-v21-frame-source: var(--ui-v21-control-hover); }
	.ui-surface[data-ui-primitive='control'][data-ui-state='pressed'] { --ui-v21-frame-source: var(--ui-v21-control-pressed); }
	.ui-surface[data-ui-primitive='control'][data-ui-state='focus'] { --ui-v21-frame-source: var(--ui-v21-control-focus); }
	.ui-surface[data-ui-primitive='control'][data-ui-state='selected'] { --ui-v21-frame-source: var(--ui-v21-control-selected); }
	.ui-surface[data-ui-primitive='control'][data-ui-state='disabled'] { --ui-v21-frame-source: var(--ui-v21-control-disabled); }
	.ui-surface[data-ui-primitive='control'][data-ui-state='danger'] { --ui-v21-frame-source: var(--ui-v21-control-danger); }
	.ui-surface[data-ui-primitive='round'][data-ui-state='hover'] { --ui-v21-round-position: 16.666667%; }
	.ui-surface[data-ui-primitive='round'][data-ui-state='pressed'] { --ui-v21-round-position: 33.333333%; }
	.ui-surface[data-ui-primitive='round'][data-ui-state='focus'] { --ui-v21-round-position: 50%; }
	.ui-surface[data-ui-primitive='round'][data-ui-state='selected'] { --ui-v21-round-position: 66.666667%; }
	.ui-surface[data-ui-primitive='round'][data-ui-state='disabled'] { --ui-v21-round-position: 83.333333%; }
	.ui-surface[data-ui-primitive='round'][data-ui-state='danger'] { --ui-v21-round-position: 100%; }
	.ui-surface[data-ui-primitive='panel'][data-ui-state='danger'] { --ui-v21-frame-source: var(--ui-v21-panel-danger); }

	.ui-surface:is([data-ui-kit='v22'], [data-ui-kit='v27'])[data-ui-state='hover'] .ui-surface__frame { filter: brightness(1.06) contrast(1.03); }
	.ui-surface:is([data-ui-kit='v22'], [data-ui-kit='v27'])[data-ui-state='pressed'] .ui-surface__frame { filter: brightness(.82) contrast(1.1) saturate(.9); }
	.ui-surface:is([data-ui-kit='v22'], [data-ui-kit='v27'])[data-ui-state='focus'] .ui-surface__frame { filter: brightness(1.08) contrast(1.04) saturate(.95); }
	.ui-surface:is([data-ui-kit='v22'], [data-ui-kit='v27'])[data-ui-state='selected'] .ui-surface__frame { filter: brightness(1.1) contrast(1.06) saturate(1.02); }
	.ui-surface:is([data-ui-kit='v22'], [data-ui-kit='v27'])[data-ui-state='disabled'] .ui-surface__frame { filter: brightness(.54) contrast(.92) saturate(.18); opacity: .58; }
	.ui-surface:is([data-ui-kit='v22'], [data-ui-kit='v27'])[data-ui-state='danger'] .ui-surface__frame { filter: brightness(.93) contrast(1.12) saturate(.78); }

	@media (hover: hover) {
		:global(button:hover:not(:disabled)) .ui-surface[data-ui-interactive='true'][data-ui-state='idle'] {
			--ui-v21-frame-source: var(--ui-v21-control-hover);
			--ui-v21-round-position: 16.666667%;
		}
	}

	:global(button.selected:not(:disabled)) .ui-surface[data-ui-interactive='true'][data-ui-state='idle'],
	:global(button.selected:not(:disabled)) .ui-surface[data-ui-interactive='true'][data-ui-state='hover'],
	:global(button.active:not(:disabled)) .ui-surface[data-ui-interactive='true'][data-ui-state='idle'],
	:global(button.active:not(:disabled)) .ui-surface[data-ui-interactive='true'][data-ui-state='hover'],
	:global(button[aria-selected='true']:not(:disabled)) .ui-surface[data-ui-interactive='true'][data-ui-state='idle'],
	:global(button[aria-selected='true']:not(:disabled)) .ui-surface[data-ui-interactive='true'][data-ui-state='hover'],
	:global(button[aria-pressed='true']:not(:disabled)) .ui-surface[data-ui-interactive='true'][data-ui-state='idle'],
	:global(button[aria-pressed='true']:not(:disabled)) .ui-surface[data-ui-interactive='true'][data-ui-state='hover'] {
		--ui-v21-frame-source: var(--ui-v21-control-selected);
		--ui-v21-round-position: 66.666667%;
	}

	:global(button:focus-visible:not(:disabled)) .ui-surface[data-ui-interactive='true'][data-ui-state='idle'],
	:global(button:focus-visible:not(:disabled)) .ui-surface[data-ui-interactive='true'][data-ui-state='hover'],
	:global(button:focus-visible:not(:disabled)) .ui-surface[data-ui-interactive='true'][data-ui-state='selected'] {
		--ui-v21-frame-source: var(--ui-v21-control-focus);
		--ui-v21-round-position: 50%;
	}

	:global(button:active:not(:disabled)) .ui-surface[data-ui-interactive='true'][data-ui-state='idle'],
	:global(button:active:not(:disabled)) .ui-surface[data-ui-interactive='true'][data-ui-state='hover'],
	:global(button:active:not(:disabled)) .ui-surface[data-ui-interactive='true'][data-ui-state='focus'],
	:global(button:active:not(:disabled)) .ui-surface[data-ui-interactive='true'][data-ui-state='selected'] {
		--ui-v21-frame-source: var(--ui-v21-control-pressed);
		--ui-v21-round-position: 33.333333%;
	}

	:global(button:disabled) .ui-surface[data-ui-interactive='true'] {
		--ui-v21-frame-source: var(--ui-v21-control-disabled);
		--ui-v21-round-position: 83.333333%;
	}

	@media (hover: hover) {
		:global(button:hover:not(:disabled)) .ui-surface:is([data-ui-kit='v22'], [data-ui-kit='v27'])[data-ui-interactive='true'] .ui-surface__frame {
			filter: brightness(1.06) contrast(1.03);
		}
	}

	:global(button.selected:not(:disabled)) .ui-surface:is([data-ui-kit='v22'], [data-ui-kit='v27'])[data-ui-interactive='true'] .ui-surface__frame,
	:global(button.active:not(:disabled)) .ui-surface:is([data-ui-kit='v22'], [data-ui-kit='v27'])[data-ui-interactive='true'] .ui-surface__frame,
	:global(button[aria-selected='true']:not(:disabled)) .ui-surface:is([data-ui-kit='v22'], [data-ui-kit='v27'])[data-ui-interactive='true'] .ui-surface__frame,
	:global(button[aria-pressed='true']:not(:disabled)) .ui-surface:is([data-ui-kit='v22'], [data-ui-kit='v27'])[data-ui-interactive='true'] .ui-surface__frame {
		filter: brightness(1.1) contrast(1.06) saturate(1.02);
	}

	:global(button:focus-visible:not(:disabled)) .ui-surface:is([data-ui-kit='v22'], [data-ui-kit='v27'])[data-ui-interactive='true'] .ui-surface__frame {
		filter: brightness(1.08) contrast(1.04) saturate(.95);
	}

	:global(button:active:not(:disabled)) .ui-surface:is([data-ui-kit='v22'], [data-ui-kit='v27'])[data-ui-interactive='true'] .ui-surface__frame {
		filter: brightness(.82) contrast(1.1) saturate(.9);
		transition-duration: 80ms;
	}

	:global(button:disabled) .ui-surface:is([data-ui-kit='v22'], [data-ui-kit='v27'])[data-ui-interactive='true'] .ui-surface__frame {
		filter: brightness(.54) contrast(.92) saturate(.18);
		opacity: .58;
	}

	.ui-surface:is([data-ui-kit='v22'], [data-ui-kit='v27'])[data-ui-interactive='true'][data-ui-state='pressed'] .ui-surface__frame,
	.ui-surface:is([data-ui-kit='v22'], [data-ui-kit='v27'])[data-ui-interactive='true'][data-ui-state='pressed'] .ui-surface__fallback {
		transition-duration: 80ms;
	}

	/* Reduced quality keeps the authored atlas states but avoids animated GPU filters. */
	:global([data-render-quality='reduced']) .ui-surface:is([data-ui-kit='v22'], [data-ui-kit='v27'])[data-ui-interactive='true'] .ui-surface__frame,
	:global([data-render-quality='reduced']) .ui-surface:is([data-ui-kit='v22'], [data-ui-kit='v27'])[data-ui-interactive='true'] .ui-surface__fallback {
		filter: none !important;
		transition-property: opacity;
		transition-duration: 120ms;
	}

	@media (prefers-reduced-motion: reduce) {
		.ui-surface:is([data-ui-kit='v22'], [data-ui-kit='v27'])[data-ui-interactive='true'] .ui-surface__frame,
		.ui-surface:is([data-ui-kit='v22'], [data-ui-kit='v27'])[data-ui-interactive='true'] .ui-surface__fallback {
			transition: none !important;
		}
	}
</style>
