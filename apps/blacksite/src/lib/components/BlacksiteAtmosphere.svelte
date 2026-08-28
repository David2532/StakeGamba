<script>
	export let enabled = false;
	export let intensity = 0.58;
	export let state = 'idle';

	const ATMOSPHERE_STATES = Object.freeze(['idle', 'spin', 'feature', 'win', 'danger']);

	function normalizeIntensity(value) {
		const numeric = Number(value);
		if (!Number.isFinite(numeric)) return 0.58;
		return Math.max(0, Math.min(1, numeric));
	}

	$: normalizedState = ATMOSPHERE_STATES.includes(state) ? state : 'idle';
	$: normalizedIntensity = normalizeIntensity(intensity);
</script>

<div
	class="blacksite-atmosphere"
	data-testid="blacksite-atmosphere"
	data-blacksite-atmosphere="true"
	data-atmosphere-enabled={enabled ? 'true' : 'false'}
	data-atmosphere-state={normalizedState}
	data-atmosphere-intensity={normalizedIntensity.toFixed(2)}
	style={`--blacksite-atmosphere-intensity:${normalizedIntensity}`}
	hidden={!enabled}
	aria-hidden="true"
>
	<div class="blacksite-atmosphere__vignette" data-atmosphere-layer="vignette"></div>
	<div class="blacksite-atmosphere__grain" data-atmosphere-layer="grain"></div>
	<div class="blacksite-atmosphere__scanlines" data-atmosphere-layer="scanlines"></div>
	<div class="blacksite-atmosphere__reflection" data-atmosphere-layer="reflection"></div>
	<div class="blacksite-atmosphere__edge-light" data-atmosphere-layer="edge-light"></div>
</div>

<style>
	.blacksite-atmosphere {
		--blacksite-atmosphere-intensity: .58;
		--atmosphere-vignette-opacity: .84;
		--atmosphere-grain-opacity: .052;
		--atmosphere-scanline-opacity: .052;
		--atmosphere-reflection-opacity: .12;
		--atmosphere-edge-opacity: .19;
		--atmosphere-reflection-x: 0%;
		--atmosphere-reflection-y: 0%;
		--atmosphere-edge-a: 226, 205, 160;
		--atmosphere-edge-b: 226, 177, 80;
		position: absolute;
		z-index: var(--blacksite-atmosphere-z, 0);
		inset: 0;
		display: block;
		overflow: hidden;
		contain: layout paint;
		isolation: isolate;
		opacity: var(--blacksite-atmosphere-intensity);
		pointer-events: none;
		user-select: none;
	}

	.blacksite-atmosphere[hidden] {
		display: none;
	}

	.blacksite-atmosphere[data-atmosphere-state='spin'] {
		--atmosphere-grain-opacity: .066;
		--atmosphere-scanline-opacity: .075;
		--atmosphere-reflection-opacity: .17;
		--atmosphere-edge-opacity: .25;
		--atmosphere-reflection-x: 1.5%;
		--atmosphere-reflection-y: -.5%;
	}

	.blacksite-atmosphere[data-atmosphere-state='feature'] {
		--atmosphere-vignette-opacity: .92;
		--atmosphere-grain-opacity: .058;
		--atmosphere-scanline-opacity: .064;
		--atmosphere-reflection-opacity: .2;
		--atmosphere-edge-opacity: .34;
		--atmosphere-edge-a: 221, 143, 64;
		--atmosphere-edge-b: 244, 196, 91;
		--atmosphere-reflection-x: -1%;
	}

	.blacksite-atmosphere[data-atmosphere-state='win'] {
		--atmosphere-vignette-opacity: .72;
		--atmosphere-grain-opacity: .048;
		--atmosphere-scanline-opacity: .044;
		--atmosphere-reflection-opacity: .23;
		--atmosphere-edge-opacity: .39;
		--atmosphere-edge-a: 255, 224, 142;
		--atmosphere-edge-b: 225, 157, 52;
		--atmosphere-reflection-x: 1%;
		--atmosphere-reflection-y: -1%;
	}

	.blacksite-atmosphere[data-atmosphere-state='danger'] {
		--atmosphere-vignette-opacity: .96;
		--atmosphere-grain-opacity: .07;
		--atmosphere-scanline-opacity: .078;
		--atmosphere-reflection-opacity: .1;
		--atmosphere-edge-opacity: .42;
		--atmosphere-edge-a: 234, 146, 64;
		--atmosphere-edge-b: 155, 92, 38;
		--atmosphere-reflection-x: -1.5%;
	}

	.blacksite-atmosphere > [data-atmosphere-layer] {
		position: absolute;
		inset: 0;
		pointer-events: none;
		transition: opacity 180ms ease-out;
	}

	.blacksite-atmosphere__vignette {
		z-index: 1;
		background:
			linear-gradient(180deg, rgba(0, 0, 0, .28), transparent 14%, transparent 76%, rgba(0, 0, 0, .42)),
			radial-gradient(ellipse at 50% 47%, transparent 0 48%, rgba(0, 0, 0, .15) 66%, rgba(0, 0, 0, .7) 100%);
		opacity: var(--atmosphere-vignette-opacity);
	}

	.blacksite-atmosphere__grain {
		z-index: 2;
		background-image:
			radial-gradient(circle at 20% 30%, rgba(255, 255, 255, .9) 0 .45px, transparent .65px),
			radial-gradient(circle at 74% 68%, rgba(0, 0, 0, .95) 0 .5px, transparent .7px),
			radial-gradient(circle at 42% 82%, rgba(226, 214, 190, .65) 0 .35px, transparent .6px);
		background-position: 0 0, 1px 2px, 2px 1px;
		background-size: 4px 4px, 5px 5px, 7px 7px;
		opacity: var(--atmosphere-grain-opacity);
	}

	.blacksite-atmosphere__scanlines {
		z-index: 3;
		background: repeating-linear-gradient(
			180deg,
			rgba(214, 207, 192, .46) 0,
			rgba(214, 207, 192, .46) 1px,
			transparent 1px,
			transparent 4px
		);
		opacity: var(--atmosphere-scanline-opacity);
	}

	.blacksite-atmosphere__reflection {
		z-index: 4;
		inset: -14% -18%;
		background:
			linear-gradient(112deg, transparent 0 31%, rgba(227, 246, 239, .13) 42%, rgba(227, 246, 239, .035) 49%, transparent 58%),
			linear-gradient(162deg, transparent 0 58%, rgba(193, 164, 111, .06) 67%, transparent 74%);
		opacity: var(--atmosphere-reflection-opacity);
		transform: translate3d(var(--atmosphere-reflection-x), var(--atmosphere-reflection-y), 0) scale(1.015);
		transform-origin: center;
		transition: opacity 180ms ease-out, transform 260ms ease-out;
	}

	.blacksite-atmosphere__edge-light {
		z-index: 5;
		background:
			linear-gradient(90deg, rgba(var(--atmosphere-edge-a), .54), transparent 2.4%, transparent 97.5%, rgba(var(--atmosphere-edge-b), .48)),
			linear-gradient(180deg, rgba(var(--atmosphere-edge-a), .2), transparent 4.5%, transparent 94%, rgba(var(--atmosphere-edge-b), .18));
		opacity: var(--atmosphere-edge-opacity);
	}

	@media (max-width: 640px) {
		.blacksite-atmosphere {
			--atmosphere-vignette-opacity: .7;
			--atmosphere-grain-opacity: .036;
			--atmosphere-scanline-opacity: .038;
			--atmosphere-reflection-opacity: .075;
			--atmosphere-edge-opacity: .14;
		}

		.blacksite-atmosphere__vignette {
			background:
				linear-gradient(180deg, rgba(0, 0, 0, .2), transparent 12%, transparent 82%, rgba(0, 0, 0, .32)),
				radial-gradient(ellipse at 50% 48%, transparent 0 58%, rgba(0, 0, 0, .12) 74%, rgba(0, 0, 0, .58) 100%);
		}

		.blacksite-atmosphere__reflection {
			inset: -8% -34%;
		}
	}

	@media (max-height: 560px) and (min-aspect-ratio: 4 / 3) {
		.blacksite-atmosphere {
			--atmosphere-vignette-opacity: .68;
			--atmosphere-grain-opacity: .03;
			--atmosphere-scanline-opacity: .032;
			--atmosphere-reflection-opacity: .06;
			--atmosphere-edge-opacity: .13;
		}

		.blacksite-atmosphere__reflection {
			inset: -34% -12%;
		}
	}

	:global([data-render-quality='balanced']) .blacksite-atmosphere {
		--atmosphere-grain-opacity: .026;
		--atmosphere-scanline-opacity: .03;
		--atmosphere-reflection-opacity: .08;
	}

	:global([data-render-quality='balanced']) .blacksite-atmosphere > [data-atmosphere-layer] {
		transition-duration: 120ms;
	}

	:global([data-render-quality='balanced']) .blacksite-atmosphere__reflection {
		transition-duration: 120ms, 180ms;
	}

	:global([data-render-quality='reduced']) .blacksite-atmosphere {
		--atmosphere-vignette-opacity: .7;
		--atmosphere-edge-opacity: .12;
	}

	:global([data-render-quality='reduced']) .blacksite-atmosphere__grain,
	:global([data-render-quality='reduced']) .blacksite-atmosphere__scanlines,
	:global([data-render-quality='reduced']) .blacksite-atmosphere__reflection {
		display: none;
	}

	:global([data-render-quality='reduced']) .blacksite-atmosphere > [data-atmosphere-layer] {
		transition: none;
	}

	:global([data-render-quality='reduced']) .blacksite-atmosphere__reflection {
		transform: none;
	}

	@media (prefers-reduced-motion: reduce) {
		.blacksite-atmosphere > [data-atmosphere-layer] {
			transition: none !important;
		}

		.blacksite-atmosphere__reflection {
			transform: none !important;
		}
	}
</style>
