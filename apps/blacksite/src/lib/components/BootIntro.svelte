<script>
	import { onMount } from 'svelte';

	export let state;
	export let onSkip;

	let skipButton;

	onMount(() => {
		skipButton?.focus({ preventScroll: true });
	});
</script>

<section
	class="boot-intro"
	data-testid="boot-intro"
	data-intro-status={state.status}
	data-intro-beat={state.beat}
	data-intro-profile={state.profile}
	data-dismiss-reason={state.dismissReason}
	role="dialog"
	aria-modal="true"
	aria-labelledby="boot-intro-title"
>
	<div class="system-field" aria-hidden="true">
		<div class="rack rack-left"><i></i><i></i><i></i><i></i></div>
		<div class="rack rack-right"><i></i><i></i><i></i><i></i></div>
		<div class="scanner"></div>
		<div class="vault-lock"><span></span><i></i></div>
		<div class="vaultkeeper-silhouette"><span></span></div>
		<div class="breach-line"></div>
	</div>

	<h2 id="boot-intro-title" class="intro-lockup">
		<span>BLACKSITE</span>
		<strong>// BREACH</strong>
	</h2>

	<button
		bind:this={skipButton}
		class="skip-intro"
		data-testid="skip-intro"
		type="button"
		on:click={onSkip}>SKIP INTRO</button
	>
</section>

<style>
	.boot-intro {
		position: fixed;
		inset: 0;
		z-index: 100;
		display: grid;
		place-items: center;
		overflow: hidden;
		background:
			radial-gradient(circle at 50% 58%, rgba(48, 87, 93, 0.18), transparent 30%),
			linear-gradient(150deg, #020709, #071115 58%, #020607);
		color: #dce8ea;
		isolation: isolate;
	}

	.boot-intro::before {
		position: absolute;
		inset: 0;
		z-index: 4;
		background: repeating-linear-gradient(
			to bottom,
			transparent 0 3px,
			rgba(135, 205, 215, 0.025) 4px
		);
		content: '';
		pointer-events: none;
	}

	.system-field {
		position: absolute;
		inset: 0;
		opacity: 0;
	}

	.rack {
		position: absolute;
		top: 12%;
		bottom: 10%;
		display: grid;
		width: min(22vw, 320px);
		padding: 18px;
		border: 1px solid rgba(91, 139, 146, 0.18);
		background: linear-gradient(90deg, rgba(8, 22, 26, 0.96), rgba(18, 37, 42, 0.72));
		gap: 10px;
	}

	.rack-left {
		left: 3%;
	}

	.rack-right {
		right: 3%;
		transform: scaleX(-1);
	}

	.rack i {
		position: relative;
		border: 1px solid rgba(99, 146, 153, 0.16);
		background: repeating-linear-gradient(90deg, #071216 0 12px, #0c1d21 13px 15px);
	}

	.rack i::after {
		position: absolute;
		top: 10px;
		right: 12px;
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: #7fcbd4;
		box-shadow: 0 0 12px #6bb5bf;
		content: '';
		opacity: 0;
	}

	.scanner {
		position: absolute;
		inset: 12% 0 auto;
		height: 1px;
		background: linear-gradient(90deg, transparent, #8fd4df 30% 70%, transparent);
		box-shadow: 0 0 20px rgba(111, 206, 219, 0.7);
		opacity: 0;
	}

	.vault-lock {
		position: absolute;
		left: 50%;
		top: 53%;
		width: min(42vw, 430px);
		aspect-ratio: 1;
		border: 1px solid rgba(116, 164, 170, 0.22);
		border-radius: 50%;
		box-shadow:
			inset 0 0 0 22px rgba(15, 33, 38, 0.72),
			inset 0 0 0 24px rgba(95, 139, 145, 0.2),
			inset 0 0 90px rgba(79, 126, 133, 0.16);
		opacity: 0;
		transform: translate(-50%, -50%) scale(0.82) rotate(-14deg);
	}

	.vault-lock span,
	.vault-lock i {
		position: absolute;
		inset: 19%;
		border: 2px solid rgba(217, 184, 111, 0.55);
		border-radius: 50%;
	}

	.vault-lock i {
		inset: 40%;
		border-radius: 6px;
		transform: rotate(45deg);
	}

	.vaultkeeper-silhouette {
		position: absolute;
		left: calc(50% + min(24vw, 250px));
		bottom: 5%;
		width: min(17vw, 170px);
		aspect-ratio: 0.72;
		border: 1px solid rgba(104, 156, 163, 0.3);
		border-radius: 48% 48% 34% 34%;
		background: radial-gradient(ellipse at 50% 62%, #13272c 0 28%, #050b0d 29% 100%);
		box-shadow: 0 0 42px rgba(80, 145, 153, 0.16);
		opacity: 0;
		transform: translateY(10%) scale(0.94);
	}

	.vaultkeeper-silhouette span {
		position: absolute;
		left: 50%;
		bottom: 20%;
		width: 24%;
		aspect-ratio: 1;
		border: 2px solid #d9b86f;
		border-radius: 4px;
		box-shadow: 0 0 16px rgba(217, 184, 111, 0.3);
		transform: translateX(-50%) rotate(45deg);
	}

	.intro-lockup {
		position: relative;
		z-index: 5;
		display: grid;
		margin: 0;
		text-align: center;
		text-transform: uppercase;
		opacity: 0;
		transform: scaleX(0.9);
	}

	.intro-lockup span {
		font-size: clamp(42px, 8vw, 112px);
		font-weight: 900;
		letter-spacing: 0.06em;
		line-height: 0.9;
		text-shadow: 0 0 32px rgba(142, 205, 214, 0.16);
	}

	.intro-lockup strong {
		justify-self: end;
		color: #d9b86f;
		font-size: clamp(16px, 2.8vw, 38px);
		letter-spacing: 0.18em;
	}

	.breach-line {
		position: absolute;
		left: 50%;
		top: 51%;
		width: min(68vw, 900px);
		height: 2px;
		background: linear-gradient(90deg, transparent, #d9b86f 18% 82%, transparent);
		box-shadow: 0 0 22px rgba(217, 184, 111, 0.58);
		opacity: 0;
		transform: translateX(-50%) scaleX(0.2) skewX(-18deg);
	}

	.skip-intro {
		position: absolute;
		right: max(18px, env(safe-area-inset-right));
		bottom: max(18px, env(safe-area-inset-bottom));
		z-index: 8;
		min-width: 132px;
		min-height: 44px;
		padding: 10px 16px;
		border: 1px solid #55747a;
		background: rgba(6, 16, 19, 0.88);
		color: #dce8ea;
		font: inherit;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.12em;
		cursor: pointer;
	}

	.skip-intro:hover {
		border-color: #d9b86f;
		color: #efc06a;
	}

	.skip-intro:focus-visible {
		outline: 3px solid #efc06a;
		outline-offset: 2px;
	}

	.boot-intro[data-intro-beat='wake'] .system-field {
		opacity: 0.2;
		animation: wake-field 350ms ease-out both;
	}

	.boot-intro[data-intro-beat='scan'] .system-field,
	.boot-intro[data-intro-beat='title'] .system-field,
	.boot-intro[data-intro-beat='breach'] .system-field,
	.boot-intro[data-intro-beat='resolve'] .system-field {
		opacity: 1;
	}

	.boot-intro[data-intro-beat='scan'] .rack i::after,
	.boot-intro[data-intro-beat='title'] .rack i::after,
	.boot-intro[data-intro-beat='breach'] .rack i::after,
	.boot-intro[data-intro-beat='resolve'] .rack i::after {
		animation: rack-light 360ms ease-out both;
	}

	.boot-intro[data-intro-beat='scan'] .scanner {
		animation: scanner-pass 850ms ease-in-out both;
	}

	.boot-intro[data-intro-beat='title'] .intro-lockup,
	.boot-intro[data-intro-beat='breach'] .intro-lockup,
	.boot-intro[data-intro-beat='resolve'] .intro-lockup {
		opacity: 1;
		transform: scaleX(1);
		transition:
			opacity 180ms ease-out,
			transform 220ms ease-out;
	}

	.boot-intro[data-intro-beat='breach'] .breach-line {
		animation: breach-impact 220ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
	}

	.boot-intro[data-intro-beat='breach'] .vault-lock,
	.boot-intro[data-intro-beat='resolve'] .vault-lock {
		opacity: 1;
		transform: translate(-50%, -50%) scale(1) rotate(0);
		transition:
			opacity 160ms ease-out,
			transform 520ms cubic-bezier(0.2, 0.8, 0.2, 1);
	}

	.boot-intro[data-intro-beat='breach'] .vaultkeeper-silhouette,
	.boot-intro[data-intro-beat='resolve'] .vaultkeeper-silhouette {
		opacity: 1;
		transform: translateY(0) scale(1);
		transition:
			opacity 180ms ease-out 80ms,
			transform 420ms ease-out 80ms;
	}

	.boot-intro[data-intro-beat='resolve'] {
		animation: resolve-layout 800ms ease-in-out both;
	}

	@keyframes wake-field {
		from {
			opacity: 0;
		}
		to {
			opacity: 0.2;
		}
	}

	@keyframes rack-light {
		from {
			opacity: 0;
		}
		to {
			opacity: 0.9;
		}
	}

	@keyframes scanner-pass {
		0% {
			top: 12%;
			opacity: 0;
		}
		12%,
		82% {
			opacity: 1;
		}
		100% {
			top: 88%;
			opacity: 0;
		}
	}

	@keyframes breach-impact {
		0% {
			opacity: 0;
			transform: translateX(-50%) scaleX(0.2) skewX(-18deg);
		}
		45% {
			opacity: 1;
		}
		100% {
			opacity: 0.34;
			transform: translateX(-50%) scaleX(1) skewX(-18deg);
		}
	}

	@keyframes resolve-layout {
		0%,
		62% {
			opacity: 1;
		}
		100% {
			opacity: 0;
		}
	}

	@media (max-width: 820px) {
		.rack {
			top: 8%;
			bottom: 8%;
			width: 30vw;
			padding: 8px;
		}

		.rack-left {
			left: -13%;
		}
		.rack-right {
			right: -13%;
		}

		.vault-lock {
			top: 47%;
			width: min(74vw, 390px);
		}

		.vaultkeeper-silhouette {
			left: 68%;
			bottom: 8%;
			width: min(30vw, 140px);
		}

		.intro-lockup {
			width: min(88vw, 560px);
		}

		.intro-lockup span {
			font-size: clamp(38px, 13vw, 70px);
		}

		.skip-intro {
			right: max(10px, env(safe-area-inset-right));
			bottom: max(10px, env(safe-area-inset-bottom));
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.boot-intro,
		.boot-intro *,
		.boot-intro *::after {
			animation: none !important;
			transition: none !important;
		}
	}
</style>
