<script>
	import { BLACKSITE_ASSETS } from '../assets/blacksite-assets.js';
	import UiGlyph from './UiGlyph.svelte';
	import UiSurface from './UiSurface.svelte';

	export let name = 'info';
	export let size = 26;

	let surfaceReady = false;
	let glyphReady = false;

	$: assetName = name === 'shop' ? 'buy' : name;
	$: assets = BLACKSITE_ASSETS.ui.premiumHud[assetName] ?? BLACKSITE_ASSETS.ui.premiumHud.info;
	$: intrinsicStyle = `--hud-icon-size:${Number.isFinite(Number(size)) ? Number(size) : 26}px`;
</script>

{#if __BLACKSITE_MODERN_PRESENTATION__}
	<span class="hud-icon hud-icon--v21" style={intrinsicStyle} aria-hidden="true">
		<UiSurface
			enabled={true}
			kind="round"
			on:ready={() => surfaceReady = true}
			on:error={() => surfaceReady = false}
		/>
		<span class="hud-icon__v21-glyph">
			<UiGlyph
				enabled={true}
				name={assetName}
				size={size}
				on:ready={() => glyphReady = true}
				on:error={() => glyphReady = false}
			/>
		</span>
		{#if !surfaceReady || !glyphReady}
			<img class="hud-icon__v21-fallback" src={assets.normal} alt="" draggable="false" />
		{/if}
	</span>
{:else}
	<picture class="hud-icon" style={intrinsicStyle} aria-hidden="true">
		<img class="hud-icon__state hud-icon__normal" src={assets.normal} alt="" draggable="false" />
		<img class="hud-icon__state hud-icon__hover" src={assets.hover} alt="" draggable="false" />
		<img class="hud-icon__state hud-icon__pressed" src={assets.pressed} alt="" draggable="false" />
		<img class="hud-icon__state hud-icon__active" src={assets.active} alt="" draggable="false" />
		<img class="hud-icon__state hud-icon__disabled" src={assets.disabled} alt="" draggable="false" />
	</picture>
{/if}

<style>
	.hud-icon {
		position: relative;
		display: block;
		width: var(--hud-icon-size);
		height: var(--hud-icon-size);
		flex: none;
		isolation: isolate;
		pointer-events: none;
		user-select: none;
	}

	.hud-icon__state {
		position: absolute;
		inset: 0;
		display: block;
		width: 100%;
		height: 100%;
		object-fit: fill;
		opacity: 0;
		pointer-events: none;
	}

	.hud-icon__v21-glyph {
		position: absolute;
		z-index: 1;
		inset: 23%;
		display: block;
		pointer-events: none;
	}

	.hud-icon__v21-glyph :global(.ui-glyph) {
		width: 100%;
		height: 100%;
	}

	.hud-icon__v21-fallback {
		position: absolute;
		z-index: 2;
		inset: 0;
		display: block;
		width: 100%;
		height: 100%;
		object-fit: fill;
		pointer-events: none;
	}

	.hud-icon__normal { opacity: 1; }

	:global(button:hover:not(:disabled)) .hud-icon__normal,
	:global(button:focus-visible:not(:disabled)) .hud-icon__normal,
	:global(button:active:not(:disabled)) .hud-icon__normal,
	:global(button.active:not(:disabled)) .hud-icon__normal,
	:global(button[aria-pressed='true']:not(:disabled)) .hud-icon__normal,
	:global(button:disabled) .hud-icon__normal { opacity: 0; }

	:global(button:hover:not(:disabled)) .hud-icon__hover,
	:global(button:focus-visible:not(:disabled)) .hud-icon__hover { opacity: 1; }

	:global(button.active:not(:disabled)) .hud-icon__hover,
	:global(button[aria-pressed='true']:not(:disabled)) .hud-icon__hover,
	:global(button:active:not(:disabled)) .hud-icon__hover { opacity: 0; }

	:global(button.active:not(:disabled)) .hud-icon__active,
	:global(button[aria-pressed='true']:not(:disabled)) .hud-icon__active { opacity: 1; }

	:global(button:active:not(:disabled)) .hud-icon__active { opacity: 0; }
	:global(button:active:not(:disabled)) .hud-icon__pressed { opacity: 1; }
	:global(button:disabled) .hud-icon__disabled { opacity: 1; }
</style>
