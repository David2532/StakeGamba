<script>
	export let motion = null;
	export let assets = null;
	export let generation = 0;

	const BOLT_ANGLES = Object.freeze([0, 45, 135, 180, 225, 315]);
	// Seven evenly spaced shells retain the visible door thickness without asking
	// the compositor to repaint seventeen full-resolution rim images per frame.
	const DEPTH_OFFSETS = Object.freeze([-32, -21, -11, 0, 11, 21, 32]);
	const STAGE_RANK = Object.freeze({ sealed: 0, wheel: 1, locks: 2, door: 3, light: 4, award: 5 });

	function clamp01(value) {
		return Math.max(0, Math.min(1, Number(value) || 0));
	}

	function smoothstep(value) {
		const t = clamp01(value);
		return t * t * (3 - (2 * t));
	}

	function smootherstep(value) {
		const t = clamp01(value);
		return t * t * t * (t * ((t * 6) - 15) + 10);
	}

	function remap(value, start, end) {
		if (end <= start) return clamp01(value >= end ? 1 : 0);
		return clamp01((value - start) / (end - start));
	}

	$: channels = motion?.channels ?? {};
	$: stage = motion?.stage ?? 'sealed';
	$: stageRank = STAGE_RANK[stage] ?? 0;
	$: reducedMotion = motion?.reducedMotion === true;
	// Reduced motion uses stable semantic keyposes. It never replays the full
	// wheel/door/camera trajectory faster; only the portal state cross-fades.
	$: wheelProgress = reducedMotion ? Number(stageRank >= STAGE_RANK.wheel) : smootherstep(channels.wheel);
	$: lockProgress = reducedMotion ? Number(stageRank >= STAGE_RANK.locks) : smoothstep(channels.locks);
	$: doorProgress = reducedMotion ? 0 : smootherstep(channels.door);
	$: lightProgress = reducedMotion ? Number(stageRank >= STAGE_RANK.light) : smootherstep(channels.light);
	$: doorClearProgress = smootherstep(remap(doorProgress, .58, 1));
	$: lightBloomProgress = smootherstep(remap(lightProgress, .18, 1));
	$: wheelDegrees = Math.round(wheelProgress * 720 * 1000) / 1000;
	$: boltTravel = Math.round(lockProgress * 7.25 * 1000) / 1000;
	$: doorAngle = Math.round(doorProgress * -118 * 1000) / 1000;
	$: doorShiftX = Math.round(doorClearProgress * 36 * 1000) / 1000;
	$: doorShiftZ = Math.round(((-42 * doorProgress) - (218 * doorClearProgress)) * 1000) / 1000;
	$: doorOpacity = reducedMotion
		? Number(stageRank < STAGE_RANK.light)
		: Math.round((1 - (lightBloomProgress * .88)) * 1000) / 1000;
	$: cameraScale = reducedMotion ? 1 : Math.round((.985 + (lightProgress * 3.45)) * 10000) / 10000;
	$: portalOpacity = reducedMotion
		? (stageRank >= STAGE_RANK.light ? 1 : .08)
		: Math.round(Math.max(.08, doorProgress * .72, lightProgress) * 1000) / 1000;
	$: portalScale = reducedMotion ? 1 : Math.round((.76 + (lightProgress * .38)) * 10000) / 10000;
	$: apertureOpacity = reducedMotion ? 1 : Math.round((1 - (lightBloomProgress * .28)) * 1000) / 1000;
	$: lightWipeOpacity = reducedMotion
		? (stageRank >= STAGE_RANK.light ? .34 : 0)
		: Math.round(lightBloomProgress * .96 * 1000) / 1000;
	$: lightWipeScale = reducedMotion ? 1 : Math.round((.12 + (lightBloomProgress * 1.72)) * 10000) / 10000;
	$: shadowOpacity = Math.round((.24 * (1 - (doorClearProgress * .72)) * (1 - lightProgress)) * 1000) / 1000;
	$: shadowShift = Math.round(doorClearProgress * 58 * 1000) / 1000;
	$: shadowScale = Math.round((.7 + (doorProgress * .42) - (doorClearProgress * .28)) * 1000) / 1000;
</script>

<div
	class="dev-vault-rig"
	class:dev-vault-reduced={reducedMotion}
	data-testid="vault-dev-2d5-rig"
	data-dev-only="true"
	data-vault-generation={generation}
	data-dev-vault-stage={stage}
	data-dev-vault-progress={String(Math.round(clamp01(motion?.motionProgress) * 1000) / 1000)}
	data-vault-door-direction={reducedMotion ? 'static-crossfade' : 'away-right'}
	data-vault-camera-motion={reducedMotion ? 'static-keypose' : 'aperture-dolly'}
	data-vault-reduced-motion={reducedMotion ? 'true' : undefined}
	data-vault-door-angle={doorAngle}
	data-vault-camera-scale={cameraScale}
	aria-hidden="true"
>
	<div
		class="dev-vault-flight-camera"
		data-testid="vault-dev-aperture-dolly"
		style={`transform:scale(${cameraScale});opacity:${apertureOpacity}`}
	>
		<div class="dev-vault-portal-throat" aria-hidden="true"></div>
		{#if assets?.portalLight}
			<img
				class="dev-vault-portal"
				src={assets.portalLight}
				alt=""
				draggable="false"
				style={`opacity:${portalOpacity};transform:scale(${portalScale})`}
			/>
		{/if}
		<div
			class="dev-vault-portal-rays"
			style={`opacity:${Math.round(lightProgress * .72 * 1000) / 1000};transform:rotate(${Math.round(lightProgress * 17 * 1000) / 1000}deg) scale(${Math.round((.62 + (lightProgress * .54)) * 1000) / 1000})`}
			aria-hidden="true"
		></div>
		{#if assets?.sideRim}
			<img
				class="dev-vault-aperture-rim"
				data-testid="vault-dev-circular-aperture"
				src={assets.sideRim}
				alt=""
				draggable="false"
			/>
		{/if}
		<div class="dev-vault-aperture-depth" aria-hidden="true"></div>
	</div>

	<div class="dev-vault-perspective">
		<div
			class="dev-vault-door-contact-shadow"
			style={`opacity:${shadowOpacity};transform:translate3d(${shadowShift}%,128%, -130px) scale(${shadowScale})`}
			aria-hidden="true"
		></div>

		<div
			class="dev-vault-door-assembly"
			data-testid="vault-dev-door-assembly"
			data-vault-hinge="right"
			data-vault-door-depth-px="76"
			style={`opacity:${doorOpacity};transform:translate3d(${doorShiftX}%,0,${doorShiftZ}px) rotateY(${doorAngle}deg)`}
		>
			{#if assets?.sideRim}
				<div class="dev-vault-door-depth" data-vault-door-layer="depth" aria-hidden="true">
					{#each DEPTH_OFFSETS as depthOffset}
						<img
							class="dev-vault-door-rim-slice"
							src={assets.sideRim}
							alt=""
							draggable="false"
							style={`transform:translateZ(${depthOffset}px)`}
						/>
					{/each}
				</div>
			{/if}

			{#if assets?.doorBack}
				<img
					class="dev-vault-door-back"
					data-vault-door-layer="back"
					src={assets.doorBack}
					alt=""
					draggable="false"
				/>
			{/if}

			<div class="dev-vault-door-front" data-vault-door-layer="front">
				{#if assets?.doorBase}
					<img class="dev-vault-door-base" src={assets.doorBase} alt="" draggable="false" />
				{/if}

				{#if assets?.bolt}
					{#each BOLT_ANGLES as angle}
						<div class="dev-vault-bolt-axis" style={`transform:rotate(${angle}deg)`}>
							<img
								class="dev-vault-bolt"
								src={assets.bolt}
								alt=""
								draggable="false"
								style={`transform:translate3d(${boltTravel}%,0,12px)`}
							/>
						</div>
					{/each}
				{/if}

				{#if assets?.wheel}
					<img
						class="dev-vault-wheel"
						src={assets.wheel}
						alt=""
						draggable="false"
						style={`transform:translateZ(18px) rotate(${wheelDegrees}deg)`}
					/>
				{/if}
			</div>
		</div>
	</div>

	<div
		class="dev-vault-light-wipe"
		data-testid="vault-dev-light-entry"
		style={`opacity:${lightWipeOpacity};transform:translate3d(-50%,-50%,0) scale(${lightWipeScale})`}
		aria-hidden="true"
	></div>
</div>

<style>
	.dev-vault-rig {
		position: absolute;
		z-index: 1;
		inset: 0;
		overflow: hidden;
		pointer-events: none;
		transform-origin: 50% 50%;
		background: radial-gradient(circle at 50% 50%, #101719 0, #040809 43%, #010203 78%);
	}

	.dev-vault-flight-camera {
		position: absolute;
		z-index: 0;
		inset: 0;
		display: grid;
		place-items: center;
		transform-origin: 50% 50%;
		will-change: transform, opacity;
	}

	.dev-vault-portal,
	.dev-vault-portal-throat,
	.dev-vault-portal-rays,
	.dev-vault-aperture-depth {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	.dev-vault-portal-throat {
		z-index: 0;
		margin: auto;
		width: min(70vh, 57vw);
		height: min(70vh, 57vw);
		border-radius: 50%;
		background:
			radial-gradient(circle, rgba(239, 191, 99, .14), rgba(12, 29, 31, .72) 38%, #020405 74%);
		box-shadow:
			inset 0 0 60px 24px rgba(0, 0, 0, .94),
			0 0 72px rgba(82, 196, 211, .18);
	}

	.dev-vault-portal {
		z-index: 1;
		object-fit: cover;
		object-position: center;
		transform-origin: 50% 49%;
		will-change: opacity, transform;
	}

	.dev-vault-portal-rays {
		z-index: 2;
		margin: auto;
		width: min(74vh, 61vw);
		height: min(74vh, 61vw);
		border-radius: 50%;
		background: repeating-conic-gradient(
			from 3deg,
			rgba(255, 231, 168, .22) 0deg 1.2deg,
			transparent 1.2deg 8deg
		);
		mask-image: radial-gradient(circle, rgba(0, 0, 0, .9), transparent 72%);
		mix-blend-mode: screen;
		transform-origin: 50% 50%;
		will-change: opacity, transform;
	}

	.dev-vault-aperture-rim {
		position: relative;
		z-index: 4;
		width: min(82vh, 67vw);
		height: min(82vh, 67vw);
		object-fit: contain;
		filter: drop-shadow(0 12px 30px rgba(0, 0, 0, .82));
		image-rendering: auto;
	}

	.dev-vault-aperture-depth {
		z-index: 3;
		margin: auto;
		width: min(73vh, 60vw);
		height: min(73vh, 60vw);
		border-radius: 50%;
		box-shadow:
			inset 0 0 0 2px rgba(232, 185, 91, .42),
			inset 0 0 48px 17px rgba(0, 0, 0, .95),
			0 0 28px rgba(72, 198, 219, .24);
	}

	.dev-vault-perspective {
		position: absolute;
		z-index: 2;
		inset: 0;
		display: grid;
		place-items: center;
		perspective: min(1700px, 120vw);
		perspective-origin: 50% 50%;
	}

	.dev-vault-door-assembly,
	.dev-vault-door-front,
	.dev-vault-door-back,
	.dev-vault-door-depth,
	.dev-vault-door-rim-slice,
	.dev-vault-door-base,
	.dev-vault-wheel,
	.dev-vault-bolt-axis,
	.dev-vault-bolt {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	.dev-vault-door-assembly {
		position: relative;
		width: min(82vh, 67vw);
		height: min(82vh, 67vw);
		transform-origin: 100% 50%;
		transform-style: preserve-3d;
		will-change: transform, opacity;
	}

	.dev-vault-door-front {
		transform: translateZ(38px);
		transform-style: preserve-3d;
	}

	.dev-vault-door-back {
		object-fit: contain;
		transform: translateZ(-38px) rotateY(180deg);
		backface-visibility: hidden;
		image-rendering: auto;
	}

	.dev-vault-door-depth {
		transform: translate3d(0, 0, 0);
		transform-style: preserve-3d;
	}

	.dev-vault-door-rim-slice {
		object-fit: contain;
		backface-visibility: visible;
		image-rendering: auto;
		opacity: .72;
	}

	.dev-vault-door-contact-shadow {
		position: absolute;
		width: min(76vh, 62vw);
		height: min(16vh, 12vw);
		border-radius: 50%;
		background: radial-gradient(ellipse at center, rgba(0, 0, 0, .82), rgba(0, 0, 0, .34) 48%, transparent 74%);
		filter: blur(12px);
		transform-origin: 50% 50%;
		will-change: opacity, transform;
	}

	.dev-vault-light-wipe {
		position: absolute;
		z-index: 5;
		left: 50%;
		top: 50%;
		width: min(96vh, 78vw);
		height: min(96vh, 78vw);
		margin: 0;
		border-radius: 50%;
		background: radial-gradient(
			circle,
			rgba(255, 250, 224, .98) 0,
			rgba(255, 220, 143, .76) 34%,
			rgba(107, 218, 229, .28) 62%,
			transparent 76%
		);
		mix-blend-mode: screen;
		transform-origin: 50% 50%;
		will-change: opacity, transform;
	}

	.dev-vault-door-base,
	.dev-vault-wheel,
	.dev-vault-bolt {
		object-fit: contain;
		image-rendering: auto;
		backface-visibility: hidden;
	}

	.dev-vault-wheel {
		transform-origin: 50% 50%;
		will-change: transform;
	}

	.dev-vault-bolt-axis {
		transform-origin: 50% 50%;
		transform-style: preserve-3d;
	}

	.dev-vault-bolt {
		will-change: transform;
	}

	.dev-vault-reduced,
	.dev-vault-reduced * {
		will-change: auto !important;
	}

	.dev-vault-reduced .dev-vault-flight-camera,
	.dev-vault-reduced .dev-vault-portal,
	.dev-vault-reduced .dev-vault-door-assembly,
	.dev-vault-reduced .dev-vault-light-wipe {
		transition: opacity 140ms ease-out;
	}

	/* The refresh monitor marks the DEV fixture shell as reduced when sustained
	   frame cost is high. Drop blend/blur layers and half the depth slices while
	   retaining the same semantic scene and hit-free presentation surface. */
	:global(.app-shell[data-render-quality='reduced']) .dev-vault-portal-rays,
	:global(.app-shell[data-render-quality='reduced']) .dev-vault-door-contact-shadow {
		display: none;
	}

	:global(.app-shell[data-render-quality='reduced']) .dev-vault-door-rim-slice:nth-child(even) {
		display: none;
	}

	:global(.app-shell[data-render-quality='reduced']) .dev-vault-aperture-rim {
		filter: none;
	}

	@media (prefers-reduced-motion: reduce) {
		.dev-vault-reduced .dev-vault-flight-camera,
		.dev-vault-reduced .dev-vault-portal,
		.dev-vault-reduced .dev-vault-door-assembly,
		.dev-vault-reduced .dev-vault-light-wipe {
			transition-duration: 120ms;
		}
	}

	@media (max-width: 640px) {
		.dev-vault-portal { object-fit: cover; }
		.dev-vault-aperture-rim {
			width: min(88vw, 58vh);
			height: min(88vw, 58vh);
		}
		.dev-vault-door-assembly {
			width: min(88vw, 58vh);
			height: min(88vw, 58vh);
		}
	}

	@media (max-height: 430px) and (min-aspect-ratio: 4 / 3) {
		.dev-vault-portal { object-fit: cover; }
		.dev-vault-aperture-rim {
			width: min(64vh, 48vw);
			height: min(64vh, 48vw);
		}
		.dev-vault-door-assembly {
			width: min(64vh, 48vw);
			height: min(64vh, 48vw);
		}
	}
</style>
