<script>
	import { createEventDispatcher, onMount, tick } from 'svelte';
	import {
		BLACKSITE_INTRO_FALLBACK,
		BLACKSITE_INTRO_MANIFEST_URL,
		normalizeBlacksiteIntroManifest,
	} from '../assets/blacksite-intro-assets.js';
	import { BLACKSITE_ASSETS } from '../assets/blacksite-assets.js';
	import { createMissionBriefing } from '../contracts/mission-briefing.js';
	import { LINE_LENGTHS, SYMBOL_PAYOUTS } from '../contracts/rules.js';
	import { PAYING_SYMBOLS, SYMBOL_DISPLAY_NAMES } from '../contracts/reels.js';
	import {
		BOOT_SEQUENCE_STATE,
		BootSequenceDirector,
	} from '../runtime/boot-sequence-director.js';

	export let criticalAssets = [];
	export let preloadCriticalAudio = async () => ({ requested: 0, loaded: 0, failed: 0 });
	export let reducedMotion = false;
	export let language = 'en';
	export let social = false;
	export let audioMuted = true;
	export let launchKind = 'live';
	export let activeRound = false;

	const dispatch = createEventDispatcher();
	const focusableSelector = [
		'button:not(:disabled)',
		'[href]',
		'input:not(:disabled)',
		'select:not(:disabled)',
		'textarea:not(:disabled)',
		'[tabindex]:not([tabindex="-1"])',
	].join(',');
	const introStates = new Set([
		BOOT_SEQUENCE_STATE.READY_FOR_INTRO,
		BOOT_SEQUENCE_STATE.INTRO_PLAYING,
		BOOT_SEQUENCE_STATE.INTRO_UNAVAILABLE,
		BOOT_SEQUENCE_STATE.INTRO_ERROR,
		BOOT_SEQUENCE_STATE.ASSET_ERROR,
	]);
	let mounted = false;
	let started = false;
	let destroyed = false;
	let startupGeneration = 0;
	let preloadAbortController = null;
	let director = null;
	let sequenceRoot = null;
	let missionDialog = null;
	let missionStartButton = null;
	let skipButton = null;
	let videoElement = null;
	let resumeVideoAfterVisibility = false;
	let showingEndFrame = false;
	let detailsOpen = false;
	let introManifest = normalizeBlacksiteIntroManifest(BLACKSITE_INTRO_FALLBACK);
	let snapshot = Object.freeze({
		state: BOOT_SEQUENCE_STATE.BOOT,
		inputLocked: true,
		skippable: false,
		suspended: false,
		preload: Object.freeze({ total: 0, settled: 0, loaded: 0, failed: 0, fraction: 0, percent: 0 }),
		error: null,
		reason: 'boot',
	});
	let lastAnnouncedState = null;
	let pendingIntroStart = false;
	let pendingIntroForce = false;

	$: briefing = createMissionBriefing({ language, social });
	$: visible = snapshot.state !== BOOT_SEQUENCE_STATE.GAME_READY;
	$: showingLoading = [
		BOOT_SEQUENCE_STATE.BOOT,
		BOOT_SEQUENCE_STATE.PRELOADING,
	].includes(snapshot.state);
	$: showingIntro = introStates.has(snapshot.state);
	$: showingBriefing = snapshot.state === BOOT_SEQUENCE_STATE.MISSION_BRIEFING;
	$: enteringGame = snapshot.state === BOOT_SEQUENCE_STATE.ENTERING_GAME;
	$: if (director) director.setReducedMotion(reducedMotion);
	$: if (director) director.setLaunchContext({ launchKind, activeRound });
	$: if (mounted && !started && Array.isArray(criticalAssets) && criticalAssets.length > 0) void beginStartup();

	function announceState(next) {
		if (next.state === lastAnnouncedState) return;
		lastAnnouncedState = next.state;
		dispatch('statechange', next);
		if (next.state === BOOT_SEQUENCE_STATE.READY_FOR_INTRO) {
			queueMicrotask(() => {
				const force = pendingIntroForce;
				pendingIntroForce = false;
				void launchIntroOrFallback({ force });
			});
		}
		if (next.state === BOOT_SEQUENCE_STATE.MISSION_BRIEFING) {
			detailsOpen = false;
			void tick().then(() => missionStartButton?.focus?.({ preventScroll: true }));
		}
		if (next.state === BOOT_SEQUENCE_STATE.GAME_READY) dispatch('ready', next);
	}

	function handleSnapshot(next) {
		if (
			snapshot.state === BOOT_SEQUENCE_STATE.INTRO_PLAYING
			&& next.state !== BOOT_SEQUENCE_STATE.INTRO_PLAYING
		) {
			resumeVideoAfterVisibility = false;
			showingEndFrame = false;
			videoElement?.pause?.();
		}
		snapshot = next;
		announceState(next);
	}

	function loadImage(url) {
		return new Promise((resolve, reject) => {
			if (!url) {
				reject(new Error('Missing critical image URL.'));
				return;
			}
			const image = new Image();
			image.decoding = 'async';
			image.onload = () => resolve(image);
			image.onerror = () => reject(new Error(`Image failed to load: ${url}`));
			image.src = url;
			if (image.complete && image.naturalWidth > 0) resolve(image);
		});
	}

	async function loadIntroManifestForPreload(signal) {
		try {
			const response = await fetch(BLACKSITE_INTRO_MANIFEST_URL, { cache: 'no-store', signal });
			if (!response?.ok) {
				throw new Error(`Intro manifest response ${response?.status ?? 'failed'}.`);
			}
			const manifest = normalizeBlacksiteIntroManifest(await response.json());
			introManifest = manifest;
			try {
				await Promise.all(
					[...new Set([manifest.endFrame, manifest.rulesScreen].filter(Boolean))]
						.map((url) => loadImage(url)),
				);
				return manifest;
			} catch (error) {
				introManifest = Object.freeze({
					...manifest,
					endFrame: manifest.poster.desktop,
					rulesScreen: manifest.poster.desktop,
				});
				return { failed: 1, error };
			}
		} catch (error) {
			introManifest = normalizeBlacksiteIntroManifest(BLACKSITE_INTRO_FALLBACK);
			throw new Error(
				`Intro manifest failed to load; poster fallback armed: ${error?.message ?? 'unknown error'}`,
			);
		}
	}

	async function settleTask(targetDirector, runGeneration, id, task, { critical = true } = {}) {
		const isCurrentRun = () => mounted
			&& !destroyed
			&& director === targetDirector
			&& startupGeneration === runGeneration;
		try {
			const result = await task;
			if (!isCurrentRun()) return;
			const failed = Number.isFinite(result?.failed) ? result.failed : 0;
			targetDirector.recordAsset(id, {
				ok: failed === 0,
				critical,
				error: failed > 0
					? result?.error ?? `${failed} ${id === 'audio:critical' ? 'audio' : 'nested'} asset${failed === 1 ? '' : 's'} failed to load`
					: null,
			});
		} catch (error) {
			if (isCurrentRun()) targetDirector.recordAsset(id, { ok: false, critical, error });
		}
	}

	async function beginStartup() {
		if (!mounted || started || destroyed || !director) return;
		started = true;
		const targetDirector = director;
		const runGeneration = ++startupGeneration;
		preloadAbortController?.abort();
		preloadAbortController = new AbortController();
		const preloadSignal = preloadAbortController.signal;
		const uniqueAssets = [...new Set(criticalAssets.filter(Boolean))];
		const tasks = [
			...uniqueAssets.map((url, index) => ({
				id: `visual:${index + 1}`,
				critical: true,
				task: loadImage(url),
			})),
			{
				id: 'font:ui',
				critical: false,
				task: document.fonts?.ready ?? Promise.resolve(),
			},
			{
				id: 'audio:critical',
				critical: false,
				task: Promise.resolve().then(() => preloadCriticalAudio?.()),
			},
			{
				id: 'intro:manifest',
				critical: false,
				task: loadIntroManifestForPreload(preloadSignal),
			},
		];
		if (!targetDirector.beginPreloading(tasks.length)) return;
		await Promise.all(tasks.map(({ id, task, critical }) => settleTask(
			targetDirector,
			runGeneration,
			id,
			task,
			{ critical },
		)));
		if (
			mounted
			&& !destroyed
			&& director === targetDirector
			&& startupGeneration === runGeneration
		) {
			preloadAbortController = null;
			targetDirector.finishPreloading();
		}
	}

	async function launchIntroOrFallback({ force }) {
		if (pendingIntroStart || destroyed || snapshot.state !== BOOT_SEQUENCE_STATE.READY_FOR_INTRO) return;
		pendingIntroStart = true;
		const targetDirector = director;
		try {
			if (!targetDirector?.beginIntro({ durationSeconds: introManifest.durationSeconds })) return;
			if (targetDirector.snapshot.state !== BOOT_SEQUENCE_STATE.INTRO_PLAYING) return;
			if (!introManifest.videoAvailable) {
				targetDirector.introUnavailable('video-not-delivered');
				return;
			}
			await tick();
			if (
				destroyed
				|| director !== targetDirector
				|| targetDirector.snapshot.state !== BOOT_SEQUENCE_STATE.INTRO_PLAYING
			) return;
			if (!videoElement) {
				targetDirector.introError(new Error('Intro video element is unavailable.'));
				return;
			}
			videoElement.muted = true;
			videoElement.currentTime = 0;
			try {
				await videoElement.play();
			} catch (error) {
				if (!destroyed && director === targetDirector) targetDirector.introError(error);
			}
		} finally {
			pendingIntroStart = false;
		}
	}

	function handleIntroEnded() {
		if (snapshot.state !== BOOT_SEQUENCE_STATE.INTRO_PLAYING) return;
		showingEndFrame = true;
		videoElement?.pause?.();
		director?.completeIntroPlayback();
	}

	function handleIntroError(event) {
		director?.introError(event?.error ?? new Error('Intro video failed.'));
	}

	function skipIntro() {
		if (!snapshot.skippable) return;
		videoElement?.pause?.();
		director?.showMissionBriefing('skip');
	}

	function acceptMission() {
		if (!director?.beginEnteringGame()) return;
		dispatch('missionaccepted', director.snapshot);
	}

	function trapFocus(event) {
		if (event.key !== 'Tab' || !sequenceRoot) return false;
		const focusable = [...sequenceRoot.querySelectorAll(focusableSelector)]
			.filter((element) => element.getClientRects().length > 0 && element.getAttribute('aria-hidden') !== 'true');
		if (focusable.length === 0) {
			event.preventDefault();
			sequenceRoot.focus();
			return true;
		}
		const first = focusable[0];
		const last = focusable.at(-1);
		if (event.shiftKey && (document.activeElement === first || !sequenceRoot.contains(document.activeElement))) {
			event.preventDefault();
			last.focus();
			return true;
		}
		if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
			return true;
		}
		return false;
	}

	function handleKeydown(event) {
		if (!visible) return;
		if (trapFocus(event)) return;
		if (showingIntro && snapshot.skippable && ['Escape', 'Enter', ' ', 'Spacebar'].includes(event.key)) {
			event.preventDefault();
			skipIntro();
			return;
		}
		if (showingBriefing && event.key === 'Escape') {
			event.preventDefault();
			missionStartButton?.focus?.();
		}
	}

	function handleVisibility() {
		if (!director) return;
		const hidden = document.hidden;
		director.setSuspended(hidden);
		if (!videoElement || snapshot.state !== BOOT_SEQUENCE_STATE.INTRO_PLAYING) return;
		if (hidden) {
			resumeVideoAfterVisibility = !videoElement.paused;
			videoElement.pause();
		} else if (resumeVideoAfterVisibility) {
			resumeVideoAfterVisibility = false;
			void videoElement.play().catch(handleIntroError);
		}
	}

	export function replayIntro() {
		pendingIntroForce = true;
		if (!director?.replayIntro()) {
			pendingIntroForce = false;
			return false;
		}
		return true;
	}

	export function openMissionBriefing() {
		return director?.openMissionBriefing() ?? false;
	}

	export function currentSnapshot() {
		return director?.snapshot ?? snapshot;
	}

	onMount(() => {
		mounted = true;
		director = new BootSequenceDirector({
			onChange: handleSnapshot,
			reducedMotion,
			launchKind,
			activeRound,
			timings: Object.freeze({ fallbackHoldMs: 1_800, enteringDurationMs: 560 }),
		});
		handleSnapshot(director.snapshot);
		document.addEventListener('visibilitychange', handleVisibility);
		window.addEventListener('keydown', handleKeydown, true);
		return () => {
			destroyed = true;
			startupGeneration += 1;
			preloadAbortController?.abort();
			preloadAbortController = null;
			resumeVideoAfterVisibility = false;
			videoElement?.pause?.();
			videoElement?.removeAttribute?.('src');
			videoElement?.load?.();
			document.removeEventListener('visibilitychange', handleVisibility);
			window.removeEventListener('keydown', handleKeydown, true);
			director?.destroy();
			director = null;
		};
	});
</script>

{#if visible}
	<div
		class="boot-sequence"
		class:boot-sequence-entering={enteringGame}
		data-testid="boot-sequence"
		data-boot-state={snapshot.state}
		data-intro-mode={introManifest.videoAvailable ? 'video' : 'poster-fallback'}
		data-audio-muted={audioMuted ? 'true' : 'false'}
		data-intro-manifest={BLACKSITE_INTRO_MANIFEST_URL}
		role={showingBriefing ? 'presentation' : 'status'}
		aria-live={showingLoading ? 'polite' : 'off'}
		bind:this={sequenceRoot}
		tabindex="-1"
	>
		<picture class="boot-backdrop" aria-hidden="true">
			<source media="(max-height: 560px) and (min-aspect-ratio: 4/3)" srcset={introManifest.poster.shortLandscape} />
			<source media="(max-width: 700px) and (orientation: portrait)" srcset={introManifest.poster.portrait} />
			<img src={introManifest.poster.desktop} alt="" draggable="false" />
		</picture>
		<div class="boot-scrim" aria-hidden="true"></div>
		<div class="boot-grain" aria-hidden="true"></div>

		{#if showingLoading}
			<section class="loading-console" data-testid="boot-loading-screen" aria-labelledby="boot-title">
				<div class="loading-classification"><span>BS-77</span><b>OMEGA CLEARANCE</b></div>
				<p>BLACKSITE SECURE OPERATIONS</p>
				<h1 id="boot-title"><span>BLACKSITE</span><strong>BREACH</strong></h1>
				<div class="loading-status-grid" aria-label="Startup verification status">
					<span><i class:verified={snapshot.preload.settled > 0}></i>SECURE LINK</span>
					<span><i class:verified={snapshot.preload.fraction >= 0.5}></i>BREACH PROTOCOL</span>
					<span><i class:verified={snapshot.preload.fraction >= 1}></i>ASSET VERIFICATION</span>
				</div>
				<div class="loading-progress-row">
					<div
						class="loading-progress"
						data-testid="boot-progress"
						role="progressbar"
						aria-label="Loading critical game assets"
						aria-valuemin="0"
						aria-valuemax="100"
						aria-valuenow={snapshot.preload.percent}
					>
						<i style:--boot-progress={`${snapshot.preload.percent}%`}></i>
					</div>
					<strong>{String(snapshot.preload.percent).padStart(3, '0')}%</strong>
				</div>
				<small>{snapshot.preload.failed > 0 ? 'DEGRADED LINK — SAFE FALLBACK ARMED' : 'VERIFYING LOCAL PACKAGE ASSETS'}</small>
			</section>
		{:else if showingIntro}
			<section class="intro-stage" data-testid="boot-intro" aria-label="BLACKSITE BREACH cinematic intro">
				{#if snapshot.state === BOOT_SEQUENCE_STATE.INTRO_PLAYING && introManifest.videoAvailable}
					<video
						bind:this={videoElement}
						class="intro-video"
						poster={introManifest.poster.desktop}
						preload="auto"
						playsinline
						muted
						aria-describedby="intro-screenreader-copy"
						on:ended={handleIntroEnded}
						on:error={handleIntroError}
					>
						{#if introManifest.video.mobile.webm}
							<source media="(max-width: 700px)" src={introManifest.video.mobile.webm} type="video/webm" />
						{/if}
						<source media="(max-width: 700px)" src={introManifest.video.mobile.mp4} type="video/mp4" />
						{#if introManifest.video.desktop.webm}
							<source src={introManifest.video.desktop.webm} type="video/webm" />
						{/if}
						<source src={introManifest.video.desktop.mp4} type="video/mp4" />
					</video>
				{/if}
				{#if showingEndFrame}
					<img
						class="intro-end-frame"
						data-testid="boot-intro-end-frame"
						src={introManifest.endFrame}
						alt=""
						aria-hidden="true"
						draggable="false"
					/>
				{/if}
				{#if snapshot.state !== BOOT_SEQUENCE_STATE.INTRO_PLAYING || !introManifest.videoAvailable}
					<div class="intro-vignette" aria-hidden="true"></div>
					<div class="intro-title-lockup">
						<span>SECURE FACILITY // ACCESS VECTOR 77</span>
						<h1><b>BLACKSITE</b><strong>BREACH</strong></h1>
						<p>{snapshot.state === BOOT_SEQUENCE_STATE.INTRO_ERROR
							? 'CINEMATIC LINK LOST // STATIC TRANSITION ACTIVE'
							: snapshot.state === BOOT_SEQUENCE_STATE.ASSET_ERROR
								? 'ASSET LINK DEGRADED // SAFE START ACTIVE'
								: reducedMotion
									? 'REDUCED MOTION // STATIC TRANSITION ACTIVE'
									: 'BREACH PROTOCOL INITIALIZED'}</p>
					</div>
				{/if}
				<p id="intro-screenreader-copy" class="sr-only">A cinematic transition into a fortified underground vault. No gameplay result is determined by this presentation.</p>
				{#if snapshot.skippable}
					<button bind:this={skipButton} class="intro-skip" data-testid="boot-intro-skip" type="button" on:click={skipIntro}>
						<span>SKIP INTRO</span><kbd>ESC</kbd>
					</button>
				{:else}
					<span class="intro-hold" aria-hidden="true">SECURING CHANNEL</span>
				{/if}
			</section>
		{:else if showingBriefing}
			{#if snapshot.origin !== 'briefing-reopen'}
				<section
					class="startup-rules-screen"
					data-testid="boot-rules-screen"
					role="dialog"
					aria-modal="true"
					aria-labelledby="boot-rules-title"
					aria-describedby="boot-rules-description"
				>
					<h1 id="boot-rules-title" class="sr-only">BLACKSITE BREACH — {briefing.copy.title}</h1>
					<p id="boot-rules-description" class="sr-only">
						Three VAULT symbols on different reels trigger eight free spins. One of eleven regular symbols is selected for the feature and expands to fill every reel where it lands. Activate the start card to enter the slot.
					</p>
					<button
						bind:this={missionStartButton}
						class="boot-start-card"
						data-testid="boot-start-card"
						type="button"
						aria-label={`${briefing.copy.cta} — BLACKSITE BREACH`}
						on:click={acceptMission}
					>
						<img
							class="boot-rules-image"
							data-testid="boot-rules-image"
							src={introManifest.rulesScreen}
							alt=""
							aria-hidden="true"
							draggable="false"
						/>
						<span class="sr-only">{briefing.copy.cta}</span>
					</button>
				</section>
			{:else}
			<section
				class="mission-briefing"
				data-testid="mission-briefing"
				role="dialog"
				aria-modal="true"
				aria-labelledby="mission-briefing-title"
				aria-describedby="mission-briefing-summary"
				tabindex="-1"
				bind:this={missionDialog}
			>
				<header>
					<div><span>{briefing.copy.eyebrow}</span><h1>BLACKSITE <b>BREACH</b></h1></div>
					<div class="briefing-title"><small>BS-77 // READ BEFORE ENTRY</small><h2 id="mission-briefing-title">{briefing.copy.title}</h2></div>
				</header>
				<div class="briefing-scroll" data-testid="mission-briefing-scroll">
					<section class="mission-summary" id="mission-briefing-summary">
						<div><span>01</span><h3>{briefing.copy.mission}</h3></div>
						<div>{#each briefing.missionCopy as paragraph}<p>{paragraph}</p>{/each}</div>
						<div class="board-facts" aria-label="Game board facts">
							<strong><b>{briefing.facts.columns}×{briefing.facts.rows}</b><small>REELS / ROWS</small></strong>
							<strong><b>{briefing.facts.paylines}</b><small>FIXED LINES</small></strong>
							<strong><b>{briefing.facts.minimumMatch}+</b><small>FROM LEFT</small></strong>
						</div>
					</section>

					<section class="briefing-section">
						<div class="section-heading"><span>02</span><h3>{briefing.copy.features}</h3></div>
						<div class="feature-cards">
							{#each briefing.features as feature}
								<article data-feature={feature.id}>
									<img src={feature.id === 'wild'
										? BLACKSITE_ASSETS.symbols.states.ghost_wild.base
										: feature.id === 'breach'
											? BLACKSITE_ASSETS.v19.vaultSymbol.triggered
											: BLACKSITE_ASSETS.symbols.states.night_vision_goggles.base} alt="" aria-hidden="true" draggable="false" />
									<div><h4>{feature.title}</h4><p>{feature.copy}</p></div>
								</article>
							{/each}
						</div>
					</section>

					<section class="briefing-section">
						<div class="section-heading"><span>03</span><h3>{briefing.copy.modes}</h3></div>
						<div class="mode-cards">
							{#each briefing.modes as mode}
								<article>
									<img src={BLACKSITE_ASSETS.v19.modes[mode.id]} alt="" aria-hidden="true" draggable="false" />
									<div><h4>{mode.label}</h4><p>{mode.description}</p></div>
									<strong>{mode.costMultiplier}×</strong>
								</article>
							{/each}
						</div>
					</section>

					<section class="classified-intel">
						<div class="section-heading"><span>04</span><h3>{briefing.copy.intel}</h3></div>
						<div class="intel-facts">
							<strong><small>{briefing.copy.rtp}</small><b>{briefing.rtpPercent.toFixed(2)}%</b></strong>
							<strong><small>{briefing.copy.maxWin}</small><b>{briefing.maxWinMultiplier.toLocaleString(briefing.locale === 'de' ? 'de-DE' : 'en-US')}<em>{briefing.copy.maxWinSuffix}</em></b></strong>
						</div>
						<button class="paytable-toggle" data-testid="mission-briefing-paytable-toggle" type="button" aria-expanded={detailsOpen} on:click={() => detailsOpen = !detailsOpen}>
							{detailsOpen ? briefing.copy.detailsClose : briefing.copy.details}
						</button>
						{#if detailsOpen}
							<div class="briefing-paytable" data-testid="mission-briefing-paytable">
								{#each PAYING_SYMBOLS as symbol}
									<article><img src={BLACKSITE_ASSETS.symbols.states[symbol].base} alt="" aria-hidden="true" /><strong>{SYMBOL_DISPLAY_NAMES[symbol]}</strong><span>{#each LINE_LENGTHS as band, index}<small><b>{band.label}</b>{(SYMBOL_PAYOUTS[symbol][index] / 100).toLocaleString(briefing.locale === 'de' ? 'de-DE' : 'en-US')}×</small>{/each}</span></article>
								{/each}
							</div>
						{/if}
						<p class="responsible-copy">{briefing.copy.responsible}</p>
					</section>
				</div>
				<footer>
					<span><i></i>BRIEFING VERIFIED</span>
					<button bind:this={missionStartButton} data-testid="mission-start" type="button" on:click={acceptMission}>
						{briefing.copy.cta}<b aria-hidden="true">→</b>
					</button>
				</footer>
			</section>
			{/if}
		{:else if enteringGame}
			<div class="entry-transition" data-testid="boot-entry-transition" aria-hidden="true"><i></i></div>
		{/if}
	</div>
{/if}

<style>
	:global(body:has(.boot-sequence)) { overflow: hidden; }
	.boot-sequence { position: fixed; inset: 0; z-index: 10000; display: grid; place-items: center; overflow: hidden; color: #e7ecea; background: #030607; isolation: isolate; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
	.boot-backdrop, .boot-backdrop img, .boot-scrim, .boot-grain { position: absolute; inset: 0; width: 100%; height: 100%; }
	.boot-backdrop img { object-fit: cover; object-position: center; filter: saturate(.74) brightness(.43) contrast(1.12); transform: scale(1.015); animation: boot-drift 12s ease-out both; }
	.boot-scrim { z-index: 1; background: radial-gradient(circle at 60% 48%, transparent 0 20%, rgba(2,5,6,.35) 58%, rgba(1,3,4,.94) 100%), linear-gradient(90deg, rgba(2,4,5,.92), rgba(4,8,9,.25) 52%, rgba(1,3,4,.82)); }
	.boot-grain { z-index: 2; pointer-events: none; opacity: .1; background-image: repeating-linear-gradient(0deg, transparent 0 3px, rgba(196,217,215,.08) 4px), radial-gradient(circle at 20% 30%, rgba(255,255,255,.15) 0 .6px, transparent .8px); background-size: auto, 7px 7px; mix-blend-mode: soft-light; }
	.loading-console { position: relative; z-index: 3; width: min(760px, calc(100vw - 36px)); padding: clamp(24px, 5vw, 64px); border: 1px solid rgba(188,145,70,.55); background: linear-gradient(145deg, rgba(8,13,14,.94), rgba(4,8,9,.78)); box-shadow: 0 30px 100px rgba(0,0,0,.62), inset 0 1px rgba(255,235,190,.1); clip-path: polygon(0 0, calc(100% - 28px) 0, 100% 28px, 100% 100%, 28px 100%, 0 calc(100% - 28px)); }
	.loading-classification { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: #aeb9b7; font-size: 10px; letter-spacing: .16em; }
	.loading-classification span { color: #d04a3d; font-weight: 900; }
	.loading-console > p { margin: clamp(44px, 8vh, 90px) 0 8px; color: #85928f; font-size: 10px; letter-spacing: .24em; }
	.loading-console h1 { display: flex; flex-wrap: wrap; align-items: baseline; gap: 12px; margin: 0; line-height: .86; letter-spacing: -.055em; }
	.loading-console h1 span { font-size: clamp(38px, 8vw, 78px); font-weight: 950; }
	.loading-console h1 strong { color: #e0ab52; font-size: clamp(38px, 8vw, 78px); font-weight: 950; text-shadow: 0 0 34px rgba(224,171,82,.18); }
	.loading-status-grid { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 8px; margin: clamp(42px, 8vh, 80px) 0 18px; }
	.loading-status-grid span { display: flex; align-items: center; gap: 8px; min-width: 0; color: #8f9c99; font-size: 9px; letter-spacing: .1em; }
	.loading-status-grid i { width: 7px; height: 7px; flex: 0 0 auto; border: 1px solid #64716f; border-radius: 50%; }
	.loading-status-grid i.verified { border-color: #d7a553; background: #d7a553; box-shadow: 0 0 12px rgba(215,165,83,.65); }
	.loading-progress-row { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 14px; }
	.loading-progress { height: 8px; overflow: hidden; border: 1px solid #45504e; background: #070b0c; }
	.loading-progress i { display: block; width: var(--boot-progress); height: 100%; background: linear-gradient(90deg,#782d27,#d04c3d 45%,#e5b763); box-shadow: 0 0 16px rgba(221,161,67,.5); transition: width 180ms ease-out; }
	.loading-progress-row strong { min-width: 46px; color: #f1c779; font-size: 17px; }
	.loading-console > small { display: block; margin-top: 10px; color: #72807d; font-size: 8px; letter-spacing: .12em; }
	.intro-stage { position: absolute; inset: 0; z-index: 3; display: grid; place-items: center; overflow: hidden; }
	.intro-video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; background: #030607; }
	.intro-end-frame { position: absolute; inset: 0; z-index: 1; width: 100%; height: 100%; object-fit: contain; background: #030607; opacity: 0; animation: intro-end-frame 480ms ease-out both; }
	.intro-vignette { position: absolute; inset: 0; background: radial-gradient(circle at 50% 48%, transparent 0 28%, rgba(0,0,0,.4) 66%, rgba(0,0,0,.9)), linear-gradient(0deg, rgba(0,0,0,.72), transparent 34% 72%, rgba(0,0,0,.44)); }
	.intro-title-lockup { position: relative; z-index: 2; width: min(920px, calc(100vw - 40px)); text-align: center; animation: intro-lock 900ms cubic-bezier(.2,.75,.2,1) both; }
	.intro-title-lockup > span { color: #a8b7b4; font-size: clamp(8px,1vw,12px); letter-spacing: .25em; }
	.intro-title-lockup h1 { display: flex; justify-content: center; gap: .18em; margin: 14px 0 12px; font-size: clamp(44px,9vw,118px); line-height: .82; letter-spacing: -.065em; text-shadow: 0 12px 48px #000; }
	.intro-title-lockup h1 b { color: #eff3ef; }
	.intro-title-lockup h1 strong { color: #e5ad51; }
	.intro-title-lockup p { margin: 0; color: #d45a49; font-size: clamp(9px,1.2vw,13px); font-weight: 900; letter-spacing: .16em; }
	.intro-skip { position: absolute; z-index: 4; right: max(22px,env(safe-area-inset-right)); bottom: max(22px,env(safe-area-inset-bottom)); display: flex; align-items: center; gap: 14px; min-width: 142px; min-height: 48px; justify-content: center; border: 1px solid rgba(223,181,103,.66); background: rgba(5,9,10,.85); color: #f1d49c; font: inherit; font-size: 10px; font-weight: 900; letter-spacing: .1em; cursor: pointer; }
	.intro-skip:hover, .intro-skip:focus-visible { outline: 2px solid #fff0c7; outline-offset: 3px; border-color: #f1c778; background: rgba(20,16,10,.92); }
	.intro-skip kbd { padding: 3px 5px; border: 1px solid #606b69; color: #8d9a97; font: inherit; font-size: 8px; }
	.intro-hold { position: absolute; z-index: 3; right: 24px; bottom: 28px; color: #899491; font-size: 8px; letter-spacing: .14em; }
	.startup-rules-screen { position: absolute; inset: 0; z-index: 5; display: grid; place-items: center; overflow: hidden; padding: max(8px,env(safe-area-inset-top)) max(8px,env(safe-area-inset-right)) max(8px,env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left)); background: #030607; }
	.boot-start-card { display: block; width: min(calc(100vw - 16px),calc((100dvh - 16px) * 1672 / 941)); max-width: 100%; aspect-ratio: 1672 / 941; padding: 0; overflow: hidden; border: 1px solid rgba(220,172,87,.72); background: #020405; box-shadow: 0 28px 110px #000, 0 0 54px rgba(203,151,67,.12), inset 0 1px rgba(255,239,202,.16); cursor: pointer; }
	.boot-rules-image { display: block; width: 100%; height: 100%; object-fit: contain; }
	.boot-start-card:hover { border-color: #efc87f; filter: brightness(1.035); }
	.boot-start-card:focus-visible { outline: 3px solid #fff0c7; outline-offset: 3px; border-color: #efc87f; }
	.mission-briefing { position: relative; z-index: 5; display: grid; grid-template-rows: auto minmax(0,1fr) auto; width: min(1180px,calc(100vw - 32px)); max-height: calc(100dvh - 28px); overflow: hidden; border: 1px solid rgba(214,166,83,.7); background: linear-gradient(145deg,rgba(9,14,15,.98),rgba(4,8,9,.97)); box-shadow: 0 28px 110px #000, inset 0 1px rgba(255,240,202,.1); clip-path: polygon(0 0,calc(100% - 30px) 0,100% 30px,100% 100%,22px 100%,0 calc(100% - 22px)); }
	.mission-briefing > header { position: relative; display: flex; align-items: end; justify-content: space-between; gap: 24px; padding: clamp(18px,2.7vw,34px) clamp(20px,3.4vw,44px) 18px; border-bottom: 1px solid #3a4442; background: linear-gradient(90deg,rgba(121,39,31,.2),transparent 34%); }
	.mission-briefing > header span, .briefing-title small { color: #9aa8a5; font-size: 8px; letter-spacing: .16em; }
	.mission-briefing > header h1 { margin: 5px 0 0; color: #eef2ee; font-size: clamp(24px,3.6vw,48px); line-height: .88; letter-spacing: -.05em; }
	.mission-briefing > header h1 b { color: #dfab51; }
	.briefing-title { text-align: right; }
	.briefing-title h2 { margin: 4px 0 0; color: #d75c4c; font-size: clamp(16px,2.1vw,28px); letter-spacing: .05em; }
	.briefing-scroll { overflow: auto; overscroll-behavior: contain; scrollbar-color: #a8793b #111718; padding: clamp(18px,2.8vw,34px) clamp(20px,3.4vw,44px) 30px; }
	.mission-summary { display: grid; grid-template-columns: minmax(170px,.55fr) minmax(260px,1.15fr) minmax(250px,.8fr); gap: clamp(18px,3vw,42px); align-items: start; }
	.section-heading, .mission-summary > div:first-child { display: flex; align-items: center; gap: 12px; }
	.section-heading > span, .mission-summary > div:first-child > span { display: grid; width: 34px; height: 34px; place-items: center; border: 1px solid #8d3d34; color: #e16a59; font-size: 10px; font-weight: 900; }
	.section-heading h3, .mission-summary h3 { margin: 0; color: #e7c789; font-size: 13px; letter-spacing: .09em; }
	.mission-summary p, .feature-cards p, .mode-cards p { margin: 0 0 8px; color: #b3bfbc; font-size: 11px; line-height: 1.55; }
	.board-facts { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 7px; }
	.board-facts strong, .intel-facts strong { display: grid; align-content: center; min-height: 76px; padding: 10px; border: 1px solid #384441; background: rgba(13,20,20,.72); text-align: center; }
	.board-facts b { color: #f0ca7f; font-size: clamp(19px,2.3vw,30px); }
	.board-facts small, .intel-facts small { color: #82908d; font-size: 7px; letter-spacing: .08em; }
	.briefing-section, .classified-intel { margin-top: clamp(24px,4vw,46px); }
	.feature-cards, .mode-cards { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 9px; margin-top: 14px; }
	.feature-cards article, .mode-cards article { position: relative; display: grid; grid-template-columns: 72px minmax(0,1fr); gap: 12px; align-items: center; min-height: 118px; padding: 12px; overflow: hidden; border: 1px solid #394543; background: linear-gradient(135deg,rgba(20,29,28,.9),rgba(7,11,12,.9)); }
	.feature-cards article[data-feature='breach'] { border-color: #806238; box-shadow: inset 0 0 26px rgba(220,165,69,.08); }
	.feature-cards img { width: 72px; height: 72px; object-fit: contain; }
	.feature-cards h4, .mode-cards h4 { margin: 0 0 7px; color: #e9c982; font-size: 11px; letter-spacing: .08em; }
	.mode-cards article { grid-template-columns: 82px minmax(0,1fr) auto; }
	.mode-cards img { width: 82px; height: 82px; object-fit: cover; filter: saturate(.8) brightness(.84); }
	.mode-cards article > strong { color: #e9bd6d; font-size: 24px; }
	.intel-facts { display: grid; grid-template-columns: .5fr 1fr; gap: 9px; margin-top: 14px; }
	.intel-facts strong { min-height: 88px; text-align: left; padding: 14px 18px; }
	.intel-facts b { margin-top: 6px; color: #f0c779; font-size: clamp(20px,3vw,34px); }
	.intel-facts em { margin-left: 8px; color: #a7b2af; font-size: 9px; font-style: normal; letter-spacing: .06em; }
	.paytable-toggle { min-height: 44px; margin-top: 10px; border: 1px solid #576360; background: #101718; color: #d8dfdc; font: inherit; font-size: 9px; font-weight: 900; letter-spacing: .09em; cursor: pointer; }
	.paytable-toggle:focus-visible, .mission-briefing footer button:focus-visible { outline: 2px solid #fff0c7; outline-offset: 3px; }
	.briefing-paytable { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 7px; margin-top: 10px; }
	.briefing-paytable article { display: grid; grid-template-columns: 42px minmax(0,1fr); grid-template-rows: auto auto; align-items: center; gap: 3px 8px; padding: 7px; border: 1px solid #303a38; background: rgba(9,14,15,.86); }
	.briefing-paytable img { grid-row: 1 / 3; width: 42px; height: 42px; object-fit: contain; }
	.briefing-paytable > article > strong { overflow: hidden; color: #dce5e1; font-size: 8px; text-overflow: ellipsis; white-space: nowrap; }
	.briefing-paytable article > span { display: flex; gap: 7px; }
	.briefing-paytable small { color: #caa665; font-size: 7px; }
	.briefing-paytable small b { margin-right: 2px; color: #788582; }
	.responsible-copy { margin: 18px 0 0; color: #8e9b98; font-size: 9px; line-height: 1.5; }
	.mission-briefing > footer { display: flex; min-height: 76px; align-items: center; justify-content: space-between; gap: 20px; padding: 12px clamp(20px,3.4vw,44px); border-top: 1px solid #414b49; background: rgba(4,8,9,.98); }
	.mission-briefing > footer > span { display: flex; align-items: center; gap: 8px; color: #82908d; font-size: 8px; letter-spacing: .12em; }
	.mission-briefing > footer > span i { width: 7px; height: 7px; border-radius: 50%; background: #d7aa59; box-shadow: 0 0 12px rgba(215,170,89,.7); }
	.mission-briefing footer button { display: flex; min-width: 240px; min-height: 50px; align-items: center; justify-content: space-between; gap: 24px; padding: 0 18px 0 22px; border: 1px solid #d6a656; background: linear-gradient(90deg,#6e2e27,#a84335 52%,#c48f43); color: #fff1d2; font: inherit; font-size: 11px; font-weight: 950; letter-spacing: .09em; cursor: pointer; box-shadow: inset 0 1px rgba(255,236,191,.25), 0 8px 30px rgba(0,0,0,.35); }
	.mission-briefing footer button:hover { filter: brightness(1.12); }
	.mission-briefing footer button b { font-size: 21px; }
	.entry-transition { position: absolute; inset: 0; z-index: 10; display: grid; place-items: center; background: #e0ac51; animation: entry-flare 650ms cubic-bezier(.2,.8,.2,1) both; }
	.entry-transition i { width: 28vmax; height: 28vmax; border-radius: 50%; background: #fff5d7; filter: blur(50px); }
	.boot-sequence-entering .boot-backdrop { animation: entry-backdrop 650ms ease both; }
	.sr-only { position: absolute!important; width: 1px!important; height: 1px!important; padding: 0!important; margin: -1px!important; overflow: hidden!important; clip: rect(0,0,0,0)!important; white-space: nowrap!important; border: 0!important; }
	@keyframes boot-drift { from { transform: scale(1.015); } to { transform: scale(1.045); } }
	@keyframes intro-lock { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
	@keyframes intro-end-frame { 0% { opacity: 0; } 45%, 100% { opacity: 1; } }
	@keyframes entry-flare { 0% { opacity: 0; transform: scale(.4); } 38% { opacity: .9; transform: scale(1.25); } 100% { opacity: 0; transform: scale(1.9); } }
	@keyframes entry-backdrop { to { opacity: 0; transform: scale(1.03); } }

	@media (max-width: 800px) {
		.mission-briefing { width: calc(100vw - 16px); max-height: calc(100dvh - 16px); }
		.mission-briefing > header { align-items: start; padding: 17px 18px 13px; }
		.briefing-title small { display: none; }
		.briefing-scroll { padding: 16px 18px 24px; }
		.mission-summary { grid-template-columns: 1fr; gap: 12px; }
		.board-facts { order: 2; }
		.feature-cards, .mode-cards { grid-template-columns: 1fr; }
		.feature-cards article, .mode-cards article { min-height: 98px; }
		.intel-facts { grid-template-columns: 1fr 1.3fr; }
		.briefing-paytable { grid-template-columns: repeat(2,minmax(0,1fr)); }
		.mission-briefing > footer { position: relative; min-height: 72px; padding: 10px 18px max(10px,env(safe-area-inset-bottom)); }
		.mission-briefing footer button { min-width: min(250px,70vw); }
	}

	@media (max-width: 480px) {
		.loading-console { width: calc(100vw - 20px); padding: 24px 19px; }
		.loading-status-grid { grid-template-columns: 1fr; margin-top: 40px; }
		.intro-title-lockup h1 { flex-direction: column; gap: 6px; }
		.intro-video,
		.intro-end-frame { object-fit: cover; object-position: center; }
		/* The commissioned V33 briefing is itself the required player-facing
		   screen. Preserve the complete composition instead of cropping it into
		   a second, competing mobile layout. */
		.boot-start-card { width: min(calc(100vw - 16px),calc((100dvh - 16px) * 1672 / 941)); height: auto; aspect-ratio: 1672 / 941; }
		.boot-rules-image { position: static; width: 100%; height: 100%; object-fit: contain; object-position: center; filter: none; transform: none; }
		.mission-briefing > header { display: grid; gap: 10px; }
		.briefing-title { text-align: left; }
		.briefing-title h2 { font-size: 15px; }
		.mission-briefing > header h1 { font-size: 27px; }
		.feature-cards article { grid-template-columns: 58px minmax(0,1fr); }
		.feature-cards img { width: 58px; height: 58px; }
		.mode-cards article { grid-template-columns: 62px minmax(0,1fr) auto; }
		.mode-cards img { width: 62px; height: 62px; }
		.intel-facts { grid-template-columns: 1fr; }
		.briefing-paytable { grid-template-columns: 1fr; }
		.mission-briefing > footer > span { display: none; }
		.mission-briefing footer button { width: 100%; min-width: 0; }
	}

	@media (max-height: 560px) and (min-aspect-ratio: 4/3) {
		.loading-console { width: min(740px,calc(100vw - 24px)); padding: 18px 28px; }
		.loading-console > p { margin-top: 18px; }
		.loading-status-grid { margin-top: 24px; }
		.mission-briefing { width: calc(100vw - 18px); max-height: calc(100dvh - 12px); }
		.mission-briefing > header { padding: 10px 20px 8px; }
		.mission-briefing > header h1 { font-size: 25px; }
		.briefing-title h2 { font-size: 15px; }
		.briefing-scroll { padding: 12px 20px 18px; }
		.mission-summary { grid-template-columns: .45fr 1.25fr .8fr; gap: 14px; }
		.feature-cards article, .mode-cards article { min-height: 92px; }
		.feature-cards img { width: 56px; height: 56px; }
		.mode-cards img { width: 62px; height: 62px; }
		.mission-briefing > footer { min-height: 58px; padding: 6px 20px; }
		.mission-briefing footer button { min-height: 44px; }
	}

	@media (prefers-reduced-motion: reduce) {
		.boot-backdrop img, .intro-title-lockup, .intro-end-frame, .entry-transition, .boot-sequence-entering .boot-backdrop { animation: none!important; }
		.loading-progress i { transition: none; }
	}
</style>
