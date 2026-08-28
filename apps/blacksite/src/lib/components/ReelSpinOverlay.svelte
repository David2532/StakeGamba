<script>
	import { BLACKSITE_ASSETS } from '../assets/blacksite-assets.js';

	export let active = false;
	export let settling = false;
	export let anticipating = false;
	export let lockedReels = [];
	export let turbo = false;
	export let phaseSeed = 0;

	const REEL_COUNT = 5;
	const REEL_STRIPS = BLACKSITE_ASSETS.ui.reelStrips;
	export let stripSources = REEL_STRIPS;
	const LEGACY_PHASE_STEP_MS = -137;

	function seededPhaseMs(seed, columnIndex) {
		const normalizedSeed = Number(seed) >>> 0;
		// A zero seed preserves the exact Live/Production reel phases.
		if (normalizedSeed === 0) return columnIndex * LEGACY_PHASE_STEP_MS;
		let mixed = (normalizedSeed ^ Math.imul(columnIndex + 1, 0x9e3779b9)) >>> 0;
		mixed = Math.imul(mixed ^ (mixed >>> 16), 0x21f0aaad) >>> 0;
		mixed = Math.imul(mixed ^ (mixed >>> 15), 0x735a2d97) >>> 0;
		mixed = (mixed ^ (mixed >>> 15)) >>> 0;
		return -(23 + (mixed % 4093));
	}

	$: authoritativeVaultReels = Array.isArray(lockedReels)
		? Array.from(new Set(lockedReels))
			.filter((column) => Number.isInteger(column) && column >= 0 && column < REEL_COUNT)
			.sort((left, right) => left - right)
		: [];
	$: lockedThroughReel = authoritativeVaultReels.length >= 2 ? authoritativeVaultReels[1] : -1;
	$: reelPhaseMs = Array.from({ length: REEL_COUNT }, (_, columnIndex) =>
		seededPhaseMs(phaseSeed, columnIndex));
	$: renderedStripSources = Array.isArray(stripSources) && stripSources.length === REEL_COUNT
		? stripSources
		: REEL_STRIPS;
</script>

{#if active}
	<div
		class="reel-spin-overlay"
		class:settling
		class:anticipating
		class:turbo
		data-testid="reel-spin-overlay"
		data-state={anticipating ? 'anticipating' : settling ? 'settling' : 'spinning'}
		data-turbo={turbo ? 'true' : 'false'}
		data-locked-reels={authoritativeVaultReels.map((column) => column + 1).join(',')}
		data-locked-through-reel={lockedThroughReel >= 0 ? lockedThroughReel + 1 : ''}
		data-phase-seed={phaseSeed === 0 ? undefined : phaseSeed}
		aria-hidden="true"
	>
		{#each renderedStripSources as stripSrc, columnIndex}
			<div
				class="reel-column-window"
				class:locked-reel={anticipating && columnIndex <= lockedThroughReel}
				class:searching-reel={anticipating && columnIndex > lockedThroughReel}
				style={`--column-index:${columnIndex}`}
				data-reel={columnIndex + 1}
				data-vault-result={authoritativeVaultReels.includes(columnIndex) ? 'true' : 'false'}
			>
				<img
					class="reel-spin-column-layer"
					style={`--spin-phase:${reelPhaseMs[columnIndex]}ms`}
					src={stripSrc}
					alt=""
					aria-hidden="true"
					draggable="false"
					decoding="async"
				/>
			</div>
		{/each}
	</div>
{/if}

<style>
	.reel-spin-overlay {
		--fade-duration: 72ms;
		--settle-step: 82ms;
		--spin-duration: 720ms;
		position: absolute;
		z-index: 8;
		inset: 0;
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		overflow: hidden;
		background: transparent;
		pointer-events: none;
		contain: layout paint style;
	}

	.reel-column-window {
		position: relative;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
		border: 0;
		isolation: isolate;
		background: #020607;
		opacity: 1;
		transition: opacity var(--fade-duration) linear, transform 90ms cubic-bezier(.2, .75, .25, 1);
		transition-delay: 0ms;
	}

	.reel-spin-column-layer {
		position: relative;
		z-index: 1;
		display: block;
		width: 100%;
		height: 533.333333%;
		max-width: none;
		object-fit: fill;
		animation: classic-column-roll var(--spin-duration) linear infinite;
		animation-delay: var(--spin-phase);
		transform: translate3d(0, 0, 0);
	}

	.reel-column-window::after {
		position: absolute;
		z-index: 2;
		inset: 0;
		background: linear-gradient(180deg, rgba(0, 0, 0, .76), rgba(0, 0, 0, .08) 18%, transparent 40% 62%, rgba(0, 0, 0, .16) 81%, rgba(0, 0, 0, .84));
		box-shadow: inset 8px 0 10px -10px #000, inset -8px 0 10px -10px #000;
		content: '';
		pointer-events: none;
	}

	.reel-spin-overlay:not(.settling) .reel-spin-column-layer {
		will-change: transform;
	}

	.reel-spin-overlay.settling .reel-column-window {
		opacity: 0;
		transform: translate3d(0, 1.5%, 0) scaleY(.988);
		transition-delay: calc(var(--column-index) * var(--settle-step));
	}

	/* Reveal the authoritative board through the second left-to-right VAULT.
	   Only later raster strips keep moving; the server result is never changed. */
	.reel-spin-overlay.anticipating .reel-column-window.locked-reel {
		opacity: 0;
	}

	.reel-spin-overlay.anticipating .reel-column-window.locked-reel .reel-spin-column-layer {
		animation-play-state: paused;
		will-change: auto;
	}

	.reel-spin-overlay.anticipating .reel-column-window.searching-reel .reel-spin-column-layer {
		--spin-duration: 1080ms;
		animation-timing-function: cubic-bezier(.42, 0, .58, 1);
	}

	.reel-spin-overlay.anticipating .reel-column-window.searching-reel {
		background: radial-gradient(ellipse at 50% 50%, rgba(224, 48, 38, .2), transparent 72%);
	}

	.reel-spin-overlay.turbo {
		--fade-duration: 10ms;
		--settle-step: 4ms;
		--spin-duration: 250ms;
	}

	.reel-spin-overlay.turbo.anticipating .reel-column-window.searching-reel .reel-spin-column-layer {
		--spin-duration: 360ms;
	}

	@keyframes classic-column-roll {
		from { transform: translate3d(0, 0, 0); }
		to { transform: translate3d(0, -81.25%, 0); }
	}

	@media (prefers-reduced-motion: reduce) {
		.reel-spin-column-layer {
			animation: none;
			transform: translate3d(0, -40.625%, 0);
			will-change: auto;
		}

		.reel-column-window {
			transition: none;
		}

		.reel-spin-overlay.anticipating .reel-column-window.searching-reel .reel-spin-column-layer {
			animation: none;
		}
	}
</style>
