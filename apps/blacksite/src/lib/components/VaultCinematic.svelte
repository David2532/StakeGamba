<script>
	import { createEventDispatcher, onMount, tick } from 'svelte';
	import { BLACKSITE_ASSETS } from '../assets/blacksite-assets.js';
	import DevVaultRig from './DevVaultRig.svelte';
	import PanelStateArt from './PanelStateArt.svelte';
	import UiSurface from './UiSurface.svelte';
	import { VAULT_AWARDED_SPINS, VAULT_STATE } from '../runtime/vault-cinematic-director.js';
	import {
		VAULT_COMPACT_MEDIA_QUERY,
		VAULT_MEDIA_TIER,
		VAULT_VIDEO_CONTENT_TYPE,
		createVaultUltraHdDecodeConfiguration,
		requiresVaultUltraHd,
		resolveVaultMediaSelection,
		resolveVaultVideoResumeTime,
		vaultOpeningDurationForTier,
		vaultOpeningPlaybackRateForTier,
	} from '../runtime/vault-media-selector.js';

	export let cinematic;
	export let assets;
	export let targetLabel = 'LOCKING';
	export let targetAsset = null;
	export let winLabel = '0.00×';
	export let devRigEnabled = false;
	export let devMotion = null;
	export let devFixtureId = null;

	const dispatch = createEventDispatcher();
	const DIALOG_TITLE_ID = 'vault-cinematic-title';
	const DIALOG_DESCRIPTION_ID = 'vault-cinematic-description';
	const CAP_BANNER_ID = 'vault-cinematic-cap-status';
	const DIRECT_BLACKOUT_CODE = 'DIRECT BLACKOUT / PROTOCOL AUTHORIZED';
	const VAULT_CAPABILITY_TIMEOUT_MS = 800;
	const VAULT_WAITING_WATCHDOG_MS = 800;
	const VAULT_DRIFT_WINDOW_MS = 750;
	const VAULT_MAX_PLAYBACK_LAG_SECONDS = 0.35;
	const LEGACY_VAULT_UI = Object.freeze({
		readout: BLACKSITE_ASSETS.ui.premiumPanels.ticker,
		awardPanel: BLACKSITE_ASSETS.ui.premiumPanels.dialogs.confirmation,
		extractionPanel: BLACKSITE_ASSETS.ui.premiumPanels.dialogs.menu,
		control: BLACKSITE_ASSETS.ui.premiumPanels.modeCard,
	});
	const V27_VAULT_UI = BLACKSITE_ASSETS.ui.v27 ?? null;
	const DEV_RUNTIME_ENABLED = __BLACKSITE_DEV_FIXTURES__;
	const MODERN_PRESENTATION_ENABLED = __BLACKSITE_MODERN_PRESENTATION__;
	const MODERN_V27_ENABLED = MODERN_PRESENTATION_ENABLED && Boolean(V27_VAULT_UI);
	const V27_REWARD_HALO = V27_VAULT_UI?.decor?.rewardHalo ?? '';
	let mounted = false;
	let vaultRoot = null;
	let skipButton = null;
	let returnButton = null;
	let previousFocus = null;
	let focusGeneration = 0;
	let wasActive = false;
	let wasSkippable = false;
	let wasExtraction = false;
	let topLineSurfaceReady = false;
	let statusSurfaceReady = false;
	let stageSurfaceReady = false;
	let progressSurfaceReady = false;
	let openingVideo = null;
	let openingPrewarmVideo = null;
	let openingVideoSrc = null;
	let openingMediaTier = VAULT_MEDIA_TIER.POSTER;
	let openingMediaGeneration = -1;
	let openingMediaIdentity = 0;
	let openingResumeTime = 0;
	let openingCompactViewport = true;
	let openingSaveData = false;
	let openingSystemReducedMotion = false;
	let openingMediaSignalsResolved = false;
	let openingUltraHdCapable = false;
	let openingUltraHdRequired = false;
	let openingCapabilityResolved = false;
	let openingCapabilityProbeGeneration = 0;
	let cancelOpeningCapabilityProbe = null;
	let openingWaitingWatchdog = null;
	let openingWaitingWatchdogToken = 0;
	let openingPlaybackBaseline = null;

	function messageFor(state, awardedSpins, triggerCount, targetLabel, direct) {
		const triggerLockMessage = direct
			? ['DIRECT BLACKOUT AUTHORIZED', 'Protocol entry confirmed without a VAULT-symbol trigger', DIRECT_BLACKOUT_CODE]
			: ['VAULT TRIGGER LOCKED', 'Three VAULT symbols confirmed', `${triggerCount} VAULTS CONFIRMED`];
		const awardMessage = direct
			? [`${awardedSpins} FREE SPINS AWARDED`, 'Your direct BLACKOUT protocol is ready', DIRECT_BLACKOUT_CODE]
			: [`${awardedSpins} FREE SPINS AWARDED`, 'Your BLACKOUT bonus is ready', `${triggerCount} VAULTS CONFIRMED`];

		return ({
			[VAULT_STATE.TRIGGER_LOCK]: triggerLockMessage,
			[VAULT_STATE.WHEEL]: ['MECHANICAL WHEEL TURNING', 'Primary lock disengaging', 'WHEEL / ROTATING'],
			[VAULT_STATE.LOCKS]: ['VAULT LOCKS RELEASED', 'Six containment bolts withdrawn', 'LOCKS / CLEAR'],
			[VAULT_STATE.DOOR]: ['VAULT DOOR OPENING', 'Access chamber unsealing', 'DOOR / OPENING'],
			[VAULT_STATE.LIGHT]: ['VAULT ACCESS GRANTED', `Expanding target acquired: ${targetLabel}`, 'LIGHT / ENTERING'],
			[VAULT_STATE.AWARD]: awardMessage,
			[VAULT_STATE.BONUS]: ['BLACKOUT STARTS NOW', `${targetLabel} EXPANDS TO FILL EVERY REEL IT LANDS ON`, `BONUS / ${awardedSpins}`],
			[VAULT_STATE.EXTRACTION]: ['BLACKOUT COMPLETE', `${awardedSpins}/${awardedSpins} FREE SPINS COMPLETE`, 'EXTRACTION REPORT'],
		})[state] ?? ['VAULT ACCESS', '', 'CHANNEL / V19'];
	}

	$: state = cinematic?.state ?? VAULT_STATE.IDLE;
	$: isExtraction = state === VAULT_STATE.EXTRACTION;
	$: isAward = state === VAULT_STATE.AWARD;
	$: isBonus = state === VAULT_STATE.BONUS;
	$: isPresentationCard = isExtraction || isAward || isBonus;
	$: showOpeningSequence = !isPresentationCard;
	$: isActive = cinematic?.active === true;
	$: showSkip = isActive && !isExtraction && cinematic?.skippable === true;
	$: devDialog = DEV_RUNTIME_ENABLED && isActive;
	$: dialogActive = devDialog || (isActive && isExtraction);
	$: showModernStagePanel = MODERN_PRESENTATION_ENABLED && (isAward || isBonus || isExtraction);
	$: stagePanelFallback = isExtraction
		? LEGACY_VAULT_UI.extractionPanel
		: LEGACY_VAULT_UI.awardPanel;
	$: topLineSurfaceBacked = MODERN_PRESENTATION_ENABLED && (topLineSurfaceReady || Boolean(LEGACY_VAULT_UI.readout));
	$: statusSurfaceBacked = MODERN_PRESENTATION_ENABLED && (statusSurfaceReady || Boolean(LEGACY_VAULT_UI.readout));
	$: stageSurfaceBacked = showModernStagePanel && (stageSurfaceReady || Boolean(stagePanelFallback));
	$: progressSurfaceBacked = MODERN_PRESENTATION_ENABLED && (progressSurfaceReady || Boolean(LEGACY_VAULT_UI.readout));
	$: sequenceKey = cinematic?.generation ?? 0;
	$: openingReduced = cinematic?.reducedMotion === true;
	$: openingHasV26Contract = Boolean(
		assets?.cinematic?.vaultOpeningVideoV26
		&& assets?.cinematic?.vaultOpeningPoster,
	);
	$: openingPosterSrc = assets?.cinematic?.vaultOpeningPoster ?? null;
	$: openingPlaybackRate = vaultOpeningPlaybackRateForTier(openingMediaTier, {
		direct: cinematic?.direct === true,
		turbo: cinematic?.turbo === true,
	});
	$: openingMediaSelectionReady = mounted && openingMediaSignalsResolved && (
		openingReduced
		|| openingHasV26Contract
		|| cinematic?.turbo === true
		|| openingCompactViewport
		|| openingSaveData
		|| openingCapabilityResolved
	);
	$: if (openingMediaSelectionReady && sequenceKey !== openingMediaGeneration) {
		const selection = resolveVaultMediaSelection({
			assets: assets?.cinematic,
			reducedMotion: openingReduced,
			turbo: cinematic?.turbo === true,
			compactViewport: openingCompactViewport,
			saveData: openingSaveData,
			ultraHdCapable: openingUltraHdCapable && openingUltraHdRequired,
		});
		releaseOpeningMediaNodes();
		openingMediaGeneration = sequenceKey;
		openingMediaIdentity += 1;
		openingVideoSrc = selection.source;
		openingMediaTier = selection.tier;
		openingResumeTime = 0;
	}
	$: openingMediaCommitted = sequenceKey === openingMediaGeneration;
	$: openingPrewarmEligible = mounted
		&& !isActive
		&& state === VAULT_STATE.TRIGGER_LOCK
		&& openingMediaCommitted
		&& !openingReduced
		&& !openingSystemReducedMotion
		&& !openingSaveData
		&& openingMediaTier !== VAULT_MEDIA_TIER.POSTER
		&& Boolean(openingVideoSrc);
	$: reportedAwardedSpins = cinematic?.awardedSpins === VAULT_AWARDED_SPINS
		? VAULT_AWARDED_SPINS
		: null;
	$: awardedSpins = reportedAwardedSpins ?? VAULT_AWARDED_SPINS;
	$: triggerCount = cinematic?.triggerCount ?? 3;
	$: isDirect = cinematic?.direct === true;
	$: isMaxWinReport = isExtraction && cinematic?.reportKind === 'max-win';
	$: isFeatureCapReport = isMaxWinReport && cinematic?.reportScope === 'feature';
	$: reportedCompletedSpins = Number.isSafeInteger(cinematic?.completedSpins)
		&& cinematic.completedSpins > 0
		&& reportedAwardedSpins !== null
		&& cinematic.completedSpins <= reportedAwardedSpins
			? cinematic.completedSpins
			: null;
	$: hasCapTarget = isFeatureCapReport
		&& typeof cinematic?.targetSymbol === 'string'
		&& cinematic.targetSymbol.length > 0;
	$: isCapped = isExtraction && cinematic?.capped === true;
	$: message = isMaxWinReport
		? [
			'MAX WIN CONFIRMED',
			isFeatureCapReport
				? reportedCompletedSpins !== null
					? `BLACKOUT stopped at free spin ${reportedCompletedSpins} of ${reportedAwardedSpins}`
					: 'BLACKOUT feature payout locked at the maximum'
				: 'Base-game payout locked at the authoritative maximum',
			isFeatureCapReport ? 'BLACKOUT FEATURE / PAYOUT LOCKED' : 'BASE GAME / PAYOUT LOCKED',
		]
		: messageFor(state, awardedSpins, triggerCount, targetLabel, isDirect);
	$: scene = isExtraction
		? assets?.scenes?.extraction
		: assets?.scenes?.blackout;
	$: progress = Math.max(0, Math.min(100, Math.round((cinematic?.progress ?? 0) * 100)));
	$: semanticProgress = isAward || isBonus ? 100 : progress;
	$: useDevRig = DEV_RUNTIME_ENABLED
		&& devRigEnabled === true
		&& openingReduced
		&& Boolean(assets?.devCinematic);
	$: openingRenderer = useDevRig
		? 'dev-2d5-rig'
		: !openingMediaCommitted
			? 'media-selection-pending'
		: openingMediaTier === VAULT_MEDIA_TIER.POSTER
				? (openingReduced ? 'static-poster' : 'static-poster-fallback')
				: openingMediaTier === VAULT_MEDIA_TIER.PRIMARY
					? 'video-film-v26-720p'
				: openingMediaTier === VAULT_MEDIA_TIER.ULTRA_HD
					? 'video-film-2160p'
					: 'video-film-1080p';
	$: if (mounted && openingVideo && showOpeningSequence) {
		syncOpeningVideoState(openingVideo, state, openingPlaybackRate);
	}
	$: if (mounted && !openingPrewarmEligible && openingPrewarmVideo) {
		releaseOpeningVideoNode(openingPrewarmVideo);
		openingPrewarmVideo = null;
	}
	$: if (mounted && (!isActive || !showOpeningSequence || openingMediaTier === VAULT_MEDIA_TIER.POSTER) && openingVideo) {
		releaseOpeningVideoNode(openingVideo);
		openingVideo = null;
	}
	$: if (mounted) syncFocusLifecycle(isActive, showSkip, isExtraction);

	function releaseOpeningVideoNode(video) {
		if (!(video instanceof HTMLVideoElement)) return;
		try {
			video.pause();
		} catch {
			// A detached media node is already inert.
		}
		video.removeAttribute('src');
		try {
			video.load();
		} catch {
			// Some test DOMs do not implement load(); the source is still detached.
		}
	}

	function cancelOpeningWaitingWatchdog() {
		openingWaitingWatchdogToken += 1;
		if (openingWaitingWatchdog !== null) clearTimeout(openingWaitingWatchdog);
		openingWaitingWatchdog = null;
	}

	function releaseOpeningMediaNodes() {
		cancelOpeningWaitingWatchdog();
		openingPlaybackBaseline = null;
		const visibleVideo = openingVideo;
		const prewarmVideo = openingPrewarmVideo;
		openingVideo = null;
		openingPrewarmVideo = null;
		releaseOpeningVideoNode(visibleVideo);
		if (prewarmVideo !== visibleVideo) releaseOpeningVideoNode(prewarmVideo);
	}

	function isCurrentOpeningVideo(video, {
		generation = openingMediaGeneration,
		identity = openingMediaIdentity,
		tier = openingMediaTier,
	} = {}) {
		return mounted
			&& video === openingVideo
			&& generation === sequenceKey
			&& generation === openingMediaGeneration
			&& identity === openingMediaIdentity
			&& tier === openingMediaTier
			&& Number(video?.dataset?.vaultMediaIdentity) === identity;
	}

	function syncOpeningVideoState(video, nextState, playbackRate) {
		if (!(video instanceof HTMLVideoElement)) return;
		video.defaultMuted = true;
		video.muted = true;
		video.playbackRate = Number.isFinite(playbackRate) ? playbackRate : 1;
		const identity = String(openingMediaIdentity);
		if (video.readyState < 2 || video.dataset.vaultPlaybackSynchronized === identity) return;
		// Keep the sealed lead-in continuous, then align exactly once at the wheel boundary.
		// Later semantic stage changes must never seek a film that is already playing.
		if (nextState === VAULT_STATE.TRIGGER_LOCK && openingResumeTime <= 0) return;
		const resumeTime = resolveVaultVideoResumeTime({
			state: nextState,
			currentTime: openingResumeTime,
			durationSeconds: vaultOpeningDurationForTier(openingMediaTier),
		});
		if (video.currentTime < resumeTime - 0.05) video.currentTime = resumeTime;
		video.dataset.vaultPlaybackSynchronized = identity;
		openingPlaybackBaseline = {
			identity,
			wallTime: globalThis.performance?.now?.() ?? Date.now(),
			mediaTime: video.currentTime,
		};
	}

	function downgradeOpeningVideo(video, expected = {}) {
		if (!isCurrentOpeningVideo(video, expected)) return;
		const outgoingTier = openingMediaTier;
		const fallbackTier = (
			(outgoingTier === VAULT_MEDIA_TIER.PRIMARY || outgoingTier === VAULT_MEDIA_TIER.ULTRA_HD)
			&& assets?.cinematic?.vaultOpeningVideo1080
		)
			? VAULT_MEDIA_TIER.FULL_HD
			: VAULT_MEDIA_TIER.POSTER;
		const outgoingDuration = vaultOpeningDurationForTier(outgoingTier);
		const fallbackDuration = vaultOpeningDurationForTier(fallbackTier);
		const proportionalCurrentTime = Number.isFinite(video.currentTime) && outgoingDuration > 0
			? (video.currentTime / outgoingDuration) * fallbackDuration
			: 0;
		openingResumeTime = resolveVaultVideoResumeTime({
			state,
			currentTime: proportionalCurrentTime,
			durationSeconds: fallbackDuration,
		});
		openingPlaybackBaseline = null;
		cancelOpeningWaitingWatchdog();
		releaseOpeningVideoNode(video);
		openingVideo = null;
		openingMediaIdentity += 1;
		if (fallbackTier === VAULT_MEDIA_TIER.FULL_HD) {
			openingMediaTier = VAULT_MEDIA_TIER.FULL_HD;
			openingVideoSrc = assets.cinematic.vaultOpeningVideo1080;
			return;
		}
		openingMediaTier = VAULT_MEDIA_TIER.POSTER;
		openingVideoSrc = null;
	}

	function handleOpeningVideoReady(event) {
		const video = event.currentTarget;
		if (!isCurrentOpeningVideo(video)) return;
		syncOpeningVideoState(video, state, openingPlaybackRate);
		const playAttempt = video.play();
		if (playAttempt && typeof playAttempt.catch === 'function') {
			const expected = {
				generation: openingMediaGeneration,
				identity: openingMediaIdentity,
				tier: openingMediaTier,
			};
			playAttempt.catch(() => downgradeOpeningVideo(video, expected));
		}
	}

	function handleOpeningVideoError(event) {
		downgradeOpeningVideo(event.currentTarget);
	}

	function handleOpeningVideoWaiting(event) {
		const video = event.currentTarget;
		if (!isCurrentOpeningVideo(video)) return;
		cancelOpeningWaitingWatchdog();
		const expected = {
			generation: openingMediaGeneration,
			identity: openingMediaIdentity,
			tier: openingMediaTier,
		};
		const watchdogToken = openingWaitingWatchdogToken;
		openingWaitingWatchdog = setTimeout(() => {
			openingWaitingWatchdog = null;
			if (watchdogToken !== openingWaitingWatchdogToken) return;
			downgradeOpeningVideo(video, expected);
		}, VAULT_WAITING_WATCHDOG_MS);
	}

	function handleOpeningVideoRecovered(event) {
		const video = event.currentTarget;
		if (!isCurrentOpeningVideo(video)) return;
		cancelOpeningWaitingWatchdog();
		syncOpeningVideoState(video, state, openingPlaybackRate);
	}

	function handleOpeningVideoTimeUpdate(event) {
		const video = event.currentTarget;
		if (
			!isCurrentOpeningVideo(video)
			|| (openingMediaTier !== VAULT_MEDIA_TIER.PRIMARY && openingMediaTier !== VAULT_MEDIA_TIER.ULTRA_HD)
		) return;
		const identity = String(openingMediaIdentity);
		if (video.dataset.vaultPlaybackSynchronized !== identity) return;
		const now = globalThis.performance?.now?.() ?? Date.now();
		if (!openingPlaybackBaseline || openingPlaybackBaseline.identity !== identity) {
			openingPlaybackBaseline = { identity, wallTime: now, mediaTime: video.currentTime };
			return;
		}
		const wallSeconds = (now - openingPlaybackBaseline.wallTime) / 1_000;
		if (wallSeconds < VAULT_DRIFT_WINDOW_MS / 1_000) return;
		const mediaSeconds = Math.max(0, video.currentTime - openingPlaybackBaseline.mediaTime);
		const expectedSeconds = wallSeconds * video.playbackRate;
		if (expectedSeconds - mediaSeconds > VAULT_MAX_PLAYBACK_LAG_SECONDS) {
			downgradeOpeningVideo(video);
			return;
		}
		openingPlaybackBaseline = { identity, wallTime: now, mediaTime: video.currentTime };
	}

	function handleOpeningPrewarmPlaying(event) {
		const video = event.currentTarget;
		if (video !== openingPrewarmVideo) return;
		video.pause();
	}

	function probeOpeningUltraHdCapability(timeoutMs = VAULT_CAPABILITY_TIMEOUT_MS) {
		const probe = document.createElement('video');
		if (probe.canPlayType(VAULT_VIDEO_CONTENT_TYPE) === '') return Promise.resolve(false);
		const capabilities = navigator.mediaCapabilities;
		if (!capabilities || typeof capabilities.decodingInfo !== 'function') return Promise.resolve(false);

		return new Promise((resolve) => {
			let settled = false;
			let timeout = null;
			const finish = (capable) => {
				if (settled) return;
				settled = true;
				if (timeout !== null) clearTimeout(timeout);
				if (cancelOpeningCapabilityProbe === cancel) cancelOpeningCapabilityProbe = null;
				resolve(capable === true);
			};
			const cancel = () => finish(false);
			cancelOpeningCapabilityProbe = cancel;
			timeout = setTimeout(cancel, Math.max(1, timeoutMs));

			let capabilityResult;
			try {
				capabilityResult = capabilities.decodingInfo(createVaultUltraHdDecodeConfiguration());
			} catch {
				finish(false);
				return;
			}
			Promise.resolve(capabilityResult).then(
				(result) => finish(result?.supported === true && result?.smooth === true),
				() => finish(false),
			);
		});
	}

	function isSafeFocusTarget(target) {
		if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) return false;
		if (!target.isConnected || target === document.body || target === document.documentElement) return false;
		if (target.matches(':disabled, [aria-disabled="true"]') || target.closest('[inert]')) return false;
		return target.getClientRects().length > 0;
	}

	function focusSafely(target) {
		if (!isSafeFocusTarget(target)) return false;
		try {
			target.focus({ preventScroll: true });
		} catch {
			target.focus();
		}
		return document.activeElement === target;
	}

	function focusAfterRender(targetName) {
		const token = ++focusGeneration;
		void tick().then(() => {
			if (!mounted || token !== focusGeneration || cinematic?.active !== true) return;
			const target = targetName === 'return'
				? returnButton
				: targetName === 'skip'
					? skipButton
					: vaultRoot;
			focusSafely(target);
		});
	}

	function restoreFocusAfterClose() {
		const targetBeforeOpen = previousFocus;
		previousFocus = null;
		const token = ++focusGeneration;
		void tick().then(() => {
			if (!mounted || token !== focusGeneration || cinematic?.active === true) return;
			if (focusSafely(targetBeforeOpen)) return;
			focusSafely(document.querySelector('[data-testid="primary-action"]:not(:disabled)'));
		});
	}

	function syncFocusLifecycle(active, skippable, extraction) {
		const activeStarted = active && !wasActive;
		const activeClosed = !active && wasActive;
		const skipAppeared = active && skippable && !wasSkippable;
		const extractionStarted = active && extraction && !wasExtraction;

		if (activeStarted) {
			const activeElement = document.activeElement;
			previousFocus = isSafeFocusTarget(activeElement) && !vaultRoot?.contains(activeElement)
				? activeElement
				: null;
		}

		wasActive = active;
		wasSkippable = skippable;
		wasExtraction = extraction;

		if (activeClosed) {
			restoreFocusAfterClose();
			return;
		}
		if (extractionStarted) focusAfterRender('return');
		else if (skipAppeared) focusAfterRender('skip');
		else if (activeStarted && DEV_RUNTIME_ENABLED) focusAfterRender('root');
	}

	function handleDialogKeydown(event) {
		if (!dialogActive || event.key !== 'Tab' || !vaultRoot) return;
		const focusable = [skipButton, returnButton].filter(isSafeFocusTarget);
		if (focusable.length === 0) {
			event.preventDefault();
			focusSafely(vaultRoot);
			return;
		}
		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		if (event.shiftKey && (document.activeElement === first || document.activeElement === vaultRoot || !vaultRoot.contains(document.activeElement))) {
			event.preventDefault();
			focusSafely(last);
		} else if (!event.shiftKey && (document.activeElement === last || !vaultRoot.contains(document.activeElement))) {
			event.preventDefault();
			focusSafely(first);
		}
	}

	onMount(() => {
		mounted = true;
		const compactQuery = window.matchMedia(VAULT_COMPACT_MEDIA_QUERY);
		const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
		const connection = navigator.connection;
		const syncMediaSignals = () => {
			openingCompactViewport = compactQuery.matches;
			openingUltraHdRequired = requiresVaultUltraHd({
				cssWidth: window.innerWidth,
				cssHeight: window.innerHeight,
				devicePixelRatio: window.devicePixelRatio,
			});
			openingSystemReducedMotion = reducedMotionQuery.matches;
			openingSaveData = connection?.saveData === true;
			openingMediaSignalsResolved = true;
		};
		syncMediaSignals();
		compactQuery.addEventListener?.('change', syncMediaSignals);
		reducedMotionQuery.addEventListener?.('change', syncMediaSignals);
		connection?.addEventListener?.('change', syncMediaSignals);
		window.addEventListener('resize', syncMediaSignals);
		const capabilityProbe = ++openingCapabilityProbeGeneration;
		void probeOpeningUltraHdCapability().then((capable) => {
			if (mounted && capabilityProbe === openingCapabilityProbeGeneration) {
				openingUltraHdCapable = capable;
				openingCapabilityResolved = true;
			}
		});
		return () => {
			mounted = false;
			cancelOpeningCapabilityProbe?.();
			cancelOpeningCapabilityProbe = null;
			openingCapabilityProbeGeneration += 1;
			releaseOpeningMediaNodes();
			compactQuery.removeEventListener?.('change', syncMediaSignals);
			reducedMotionQuery.removeEventListener?.('change', syncMediaSignals);
			connection?.removeEventListener?.('change', syncMediaSignals);
			window.removeEventListener('resize', syncMediaSignals);
			focusGeneration += 1;
			previousFocus = null;
		};
	});
</script>

{#if openingPrewarmEligible}
	{#key `prewarm:${sequenceKey}:${openingMediaTier}:${openingMediaIdentity}`}
		<video
			bind:this={openingPrewarmVideo}
			hidden
			data-vault-prewarm="armed"
			data-vault-generation={sequenceKey}
			data-vault-media-identity={openingMediaIdentity}
			data-vault-source-tier={openingMediaTier}
			src={openingVideoSrc}
			muted
			playsinline
			preload="auto"
			disablepictureinpicture
			aria-hidden="true"
			on:playing={handleOpeningPrewarmPlaying}
		></video>
	{/key}
{/if}

{#if cinematic?.active}
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<section
		bind:this={vaultRoot}
		class="vault-cinematic"
		class:vault-extraction={isExtraction}
		class:vault-ui-v22={MODERN_PRESENTATION_ENABLED}
		class:vault-ui-v27={MODERN_V27_ENABLED}
		class:vault-reduced={cinematic?.reducedMotion === true}
		data-testid="vault-cinematic"
		data-dev-dialog={devDialog ? 'true' : undefined}
		data-vault-renderer={openingRenderer}
		data-dev-fixture={useDevRig ? devFixtureId : undefined}
		data-vault-state={state}
		data-vault-phase={cinematic?.phase ?? 'idle'}
		data-vault-report={cinematic?.reportKind ?? undefined}
		data-vault-report-scope={cinematic?.reportScope ?? undefined}
		role={dialogActive ? 'dialog' : 'status'}
		aria-modal={dialogActive ? 'true' : undefined}
		aria-labelledby={dialogActive ? DIALOG_TITLE_ID : undefined}
		aria-describedby={dialogActive
			? `${DIALOG_DESCRIPTION_ID}${isCapped ? ` ${CAP_BANNER_ID}` : ''}`
			: undefined}
		aria-live={dialogActive ? undefined : 'assertive'}
		tabindex={dialogActive ? '-1' : undefined}
		on:keydown={handleDialogKeydown}
	>
		{#if DEV_RUNTIME_ENABLED && !isExtraction}
			<div
				class="vault-stage-announcement"
				data-testid="vault-dev-stage-announcement"
				data-dev-only="true"
				role="status"
				aria-live="polite"
				aria-atomic="true"
			>
				{message[0]}. {message[1]}
			</div>
		{/if}

		{#if scene}<img class="vault-scene-art" src={scene} alt="" draggable="false" aria-hidden="true" />{/if}

		{#if showOpeningSequence}
			{#if useDevRig}
				<DevVaultRig motion={devMotion} assets={assets.devCinematic} generation={sequenceKey} />
			{:else if (!openingMediaCommitted || openingMediaTier === VAULT_MEDIA_TIER.POSTER) && openingPosterSrc}
				<img
					class="vault-opening-sequence"
					data-testid="vault-opening-animation"
					data-vault-generation={sequenceKey}
					data-vault-media={!openingMediaCommitted
						? 'static-poster-pending'
						: openingReduced
							? 'static-poster'
							: 'static-poster-fallback'}
					src={openingPosterSrc}
					alt=""
					draggable="false"
					aria-hidden="true"
				/>
			{:else if openingMediaCommitted && openingVideoSrc}
				{#key `${sequenceKey}:${openingMediaTier}`}
					<video
						bind:this={openingVideo}
						class="vault-opening-sequence"
						data-testid="vault-opening-animation"
						data-vault-generation={sequenceKey}
						data-vault-media-identity={openingMediaIdentity}
						data-vault-media={openingMediaTier === VAULT_MEDIA_TIER.PRIMARY
								? 'v26-720p24'
								: openingMediaTier === VAULT_MEDIA_TIER.ULTRA_HD
									? 'v24-2160p60'
									: 'v24-1080p60'}
						data-vault-source-tier={openingMediaTier}
						src={openingVideoSrc}
						poster={openingPosterSrc}
						autoplay
						muted
						playsinline
						preload="auto"
						disablepictureinpicture
						controlslist="nodownload noplaybackrate nofullscreen"
						aria-hidden="true"
						on:loadedmetadata={handleOpeningVideoReady}
						on:waiting={handleOpeningVideoWaiting}
						on:stalled={handleOpeningVideoWaiting}
						on:canplay={handleOpeningVideoRecovered}
						on:playing={handleOpeningVideoRecovered}
						on:progress={handleOpeningVideoRecovered}
						on:timeupdate={handleOpeningVideoTimeUpdate}
						on:error={handleOpeningVideoError}
					></video>
				{/key}
			{/if}
		{/if}

		<div class="vault-shade" class:vault-shade-opening={showOpeningSequence} aria-hidden="true"></div>

		<div class="vault-shell">
			<div
				class="vault-topline"
				class:vault-ui-v21-backed={topLineSurfaceBacked}
				data-vault-ui-surface={MODERN_PRESENTATION_ENABLED ? 'topline-readout' : undefined}
			>
				{#if MODERN_PRESENTATION_ENABLED}
					<UiSurface
						enabled
						kind="readout"
						fallbackSrc={LEGACY_VAULT_UI.readout}
						on:ready={() => topLineSurfaceReady = true}
						on:error={() => topLineSurfaceReady = false}
					/>
				{/if}
				<span>{isMaxWinReport ? 'BLACKSITE // MAX WIN' : 'BLACKSITE // BREACH'}</span>
				<strong><i></i> {isMaxWinReport ? 'CAP REPORT' : 'LIVE CINEMATIC'}</strong>
			</div>

			<div
				class="vault-stage"
				class:vault-stage-status={!isPresentationCard}
				class:vault-stage-card={isPresentationCard}
				class:vault-ui-v21-backed={stageSurfaceBacked}
				data-testid={isExtraction ? 'extraction-report' : 'vault-access-scene'}
				data-vault-ui-surface={showModernStagePanel
					? isExtraction
						? 'extraction-panel'
						: isBonus
							? 'blackout-panel'
							: 'award-panel'
					: undefined}
			>
				{#if isPresentationCard}
					{#if showModernStagePanel}
						<UiSurface
							enabled
							kind="panel"
							fallbackSrc={stagePanelFallback}
							on:ready={() => stageSurfaceReady = true}
							on:error={() => stageSurfaceReady = false}
						/>
					{/if}
					{#if MODERN_V27_ENABLED && V27_REWARD_HALO}
						<img
							class="vault-v27-reward-halo"
							data-vault-ui-decor="reward-halo"
							src={V27_REWARD_HALO}
							alt=""
							draggable="false"
							aria-hidden="true"
						/>
					{/if}
					<div class="vault-corner vault-corner-a" aria-hidden="true"></div>
					<div class="vault-corner vault-corner-b" aria-hidden="true"></div>
					<div class="vault-classification">BLACKOUT PROTOCOL</div>
					<div class="vault-code">{message[2]}</div>
					<h2 id={dialogActive ? DIALOG_TITLE_ID : undefined}>{message[0]}</h2>
					<p id={dialogActive ? DIALOG_DESCRIPTION_ID : undefined}>{message[1]}</p>

					{#if isAward}
						<div
							class="vault-award"
							class:vault-ui-v27-inner={MODERN_V27_ENABLED}
							data-testid="vault-free-spins-award"
							data-vault-ui-inner-surface={MODERN_V27_ENABLED ? 'award' : undefined}
						>
							{#if MODERN_V27_ENABLED}
								<UiSurface
									enabled
									kind="award"
									state="selected"
									tone="feature"
									interactive={false}
									fallbackSrc={LEGACY_VAULT_UI.awardPanel}
								/>
							{/if}
							<div class="vault-award-count">
								<span>FREE SPINS</span>
								<strong data-testid="vault-free-spins-count">{awardedSpins}</strong>
								<b>AWARDED</b>
							</div>
							<div class="vault-award-target" data-testid="vault-free-spins-target" data-target-label={targetLabel} aria-label={`Expanding target: ${targetLabel}`}>
								<span>EXPANDING TARGET</span>
								{#if targetAsset}
									<img class="vault-award-target-art" data-testid="vault-free-spins-target-art" src={targetAsset} alt={targetLabel} draggable="false" />
								{:else}
									<strong>{targetLabel}</strong>
								{/if}
							</div>
							<small>NEXT: FREE SPIN 1 OF {awardedSpins}</small>
						</div>
					{:else if isBonus}
						<strong class="vault-target">TARGET / {targetLabel}</strong>
					{/if}

					{#if isExtraction}
						{#if isCapped}
							<div
								class="vault-cap-banner"
								class:vault-ui-v27-inner={MODERN_V27_ENABLED}
								id={CAP_BANNER_ID}
								data-testid="vault-cap-reached"
								data-cap-raw={isMaxWinReport ? cinematic?.capRaw : undefined}
								data-vault-ui-inner-surface={MODERN_V27_ENABLED ? 'feature' : undefined}
							>
								{#if MODERN_V27_ENABLED}
									<UiSurface
										enabled
										kind="feature"
										state="danger"
										tone="danger"
										danger
										interactive={false}
										fallbackSrc={LEGACY_VAULT_UI.readout}
									/>
								{/if}
								<span>MAX WIN</span>
								<strong>CAP REACHED</strong>
							</div>
						{/if}
						<span class="vault-result-label">
							{isMaxWinReport
								? isFeatureCapReport
									? 'TOTAL FEATURE WIN'
									: 'TOTAL ROUND WIN'
								: 'TOTAL BONUS WIN'}
						</span>
						<strong class="vault-result">{winLabel}</strong>
						{#if isFeatureCapReport && hasCapTarget}
							<div
								class="vault-cap-context"
								class:vault-ui-v27-inner={MODERN_V27_ENABLED}
								data-testid="vault-cap-feature-context"
								data-vault-ui-inner-surface={MODERN_V27_ENABLED ? 'content' : undefined}
							>
								{#if MODERN_V27_ENABLED}
									<UiSurface
										enabled
										kind="content"
										state="selected"
										tone="feature"
										interactive={false}
										fallbackSrc={LEGACY_VAULT_UI.readout}
									/>
								{/if}
								<span>BLACKOUT TARGET</span>
								<strong>{targetLabel}</strong>
							</div>
						{/if}
						<button
							bind:this={returnButton}
							class:vault-ui-v21-control={MODERN_PRESENTATION_ENABLED && Boolean(LEGACY_VAULT_UI.control?.normal)}
							data-testid="return-to-base"
							data-vault-ui-surface={MODERN_PRESENTATION_ENABLED ? 'return-control-selected' : undefined}
							type="button"
							on:click={() => dispatch('return')}
						>
							{#if MODERN_PRESENTATION_ENABLED}
								<PanelStateArt assets={LEGACY_VAULT_UI.control} state="selected" selected />
								<span class="vault-button-label">RETURN TO BASE</span>
							{:else}
								RETURN TO BASE
							{/if}
						</button>
					{/if}
				{:else}
					<div
						class="vault-status-copy"
						class:vault-ui-v21-backed={statusSurfaceBacked}
						data-vault-ui-surface={MODERN_PRESENTATION_ENABLED ? 'status-readout' : undefined}
					>
						{#if MODERN_PRESENTATION_ENABLED}
							<UiSurface
								enabled
								kind="readout"
								fallbackSrc={LEGACY_VAULT_UI.readout}
								on:ready={() => statusSurfaceReady = true}
								on:error={() => statusSurfaceReady = false}
							/>
						{/if}
						<span>{message[2]}</span>
						<strong id={dialogActive ? DIALOG_TITLE_ID : undefined}>{message[0]}</strong>
						<small id={dialogActive ? DIALOG_DESCRIPTION_ID : undefined}>{message[1]}</small>
					</div>
				{/if}

				{#if showSkip}
					<button
						bind:this={skipButton}
						class="vault-skip"
						class:vault-ui-v21-control={MODERN_PRESENTATION_ENABLED && Boolean(LEGACY_VAULT_UI.control?.normal)}
						data-testid="vault-cinematic-skip"
						data-vault-ui-surface={MODERN_PRESENTATION_ENABLED ? 'skip-control-selected' : undefined}
						type="button"
						on:click={() => dispatch('skip')}
					>
						{#if MODERN_PRESENTATION_ENABLED}
							<PanelStateArt assets={LEGACY_VAULT_UI.control} state="selected" selected />
							<span class="vault-button-label">SKIP</span>
						{:else}
							SKIP
						{/if}
					</button>
				{/if}
			</div>

			<div
				class="vault-progress"
				class:vault-ui-v21-backed={progressSurfaceBacked}
				data-vault-ui-surface={MODERN_PRESENTATION_ENABLED ? 'progress-readout' : undefined}
				aria-hidden="true"
			>
				{#if MODERN_PRESENTATION_ENABLED}
					<UiSurface
						enabled
						kind="readout"
						fallbackSrc={LEGACY_VAULT_UI.readout}
						on:ready={() => progressSurfaceReady = true}
						on:error={() => progressSurfaceReady = false}
					/>
				{/if}
				<span>{isMaxWinReport ? 'MAXIMUM PAYOUT CONFIRMED' : isAward ? 'AWARD CONFIRMED' : isBonus ? 'BLACKOUT READY' : 'VAULT OPENING'}</span>
				<div
					class:vault-progress-track-v27={MODERN_V27_ENABLED}
					data-vault-ui-inner-surface={MODERN_V27_ENABLED ? 'progress' : undefined}
				>
					{#if MODERN_V27_ENABLED}
						<UiSurface
							enabled
							kind="progress"
							state={isExtraction || isAward || isBonus ? 'selected' : 'idle'}
							tone={isExtraction || isAward || isBonus ? 'feature' : 'neutral'}
							interactive={false}
						/>
					{/if}
					<i style={`--vault-progress:${semanticProgress / 100}`}></i>
				</div>
				<strong>{String(semanticProgress).padStart(3, '0')}%</strong>
			</div>
		</div>
	</section>
{/if}

<style>
	.vault-cinematic {
		position: fixed;
		z-index: 80;
		inset: 0;
		display: grid;
		place-items: center;
		overflow: hidden;
		background: #010304;
		color: #f4ecdb;
		isolation: isolate;
		contain: layout paint;
	}

	.vault-scene-art,
	.vault-shade {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	.vault-stage-announcement {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.vault-scene-art {
		object-fit: cover;
		transform: scale(1.015);
	}

	.vault-opening-sequence {
		position: absolute;
		z-index: 1;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center;
		pointer-events: none;
		image-rendering: auto;
	}

	.vault-shade {
		z-index: 2;
		pointer-events: none;
		background:
			linear-gradient(180deg, rgba(0, 0, 0, .52), transparent 19%, transparent 73%, rgba(0, 0, 0, .78)),
			radial-gradient(circle at 50% 48%, transparent 14%, rgba(0, 0, 0, .56) 93%);
	}

	.vault-shade-opening {
		background: linear-gradient(180deg, rgba(0, 0, 0, .12), transparent 14%, transparent 88%, rgba(0, 0, 0, .18));
	}

	.vault-shell {
		position: relative;
		z-index: 3;
		display: grid;
		width: min(900px, calc(100vw - 40px));
		height: min(82vh, 720px);
		grid-template-rows: 42px 1fr 36px;
		gap: 8px;
		pointer-events: none;
	}

	.vault-topline,
	.vault-progress {
		display: flex;
		align-items: center;
		border: 1px solid rgba(151, 177, 174, .36);
		background: rgba(2, 8, 9, .88);
		box-shadow: 0 12px 36px rgba(0, 0, 0, .48);
		font: 800 10px/1 ui-monospace, monospace;
		letter-spacing: .17em;
	}

	.vault-ui-v21-backed {
		position: relative;
		isolation: isolate;
	}

	.vault-topline.vault-ui-v21-backed,
	.vault-progress.vault-ui-v21-backed,
	.vault-status-copy.vault-ui-v21-backed,
	.vault-stage-card.vault-ui-v21-backed {
		background: transparent;
	}

	.vault-ui-v21-backed > :global(.ui-surface) {
		z-index: 0;
	}

	.vault-topline.vault-ui-v21-backed > span,
	.vault-topline.vault-ui-v21-backed > strong,
	.vault-status-copy.vault-ui-v21-backed > span,
	.vault-status-copy.vault-ui-v21-backed > strong,
	.vault-status-copy.vault-ui-v21-backed > small,
	.vault-progress.vault-ui-v21-backed > span,
	.vault-progress.vault-ui-v21-backed > div,
	.vault-progress.vault-ui-v21-backed > strong,
	.vault-stage-card.vault-ui-v21-backed > .vault-classification,
	.vault-stage-card.vault-ui-v21-backed > .vault-code,
	.vault-stage-card.vault-ui-v21-backed > h2,
	.vault-stage-card.vault-ui-v21-backed > p,
	.vault-stage-card.vault-ui-v21-backed > .vault-award,
	.vault-stage-card.vault-ui-v21-backed > .vault-target,
	.vault-stage-card.vault-ui-v21-backed > .vault-cap-banner,
	.vault-stage-card.vault-ui-v21-backed > .vault-cap-context,
	.vault-stage-card.vault-ui-v21-backed > .vault-result-label,
	.vault-stage-card.vault-ui-v21-backed > .vault-result,
	.vault-stage-card.vault-ui-v21-backed > button {
		position: relative;
		z-index: 1;
	}

	.vault-stage-card.vault-ui-v21-backed > .vault-corner {
		z-index: 1;
	}

	.vault-topline { justify-content: space-between; padding: 0 16px; border-top-color: rgba(227, 181, 89, .86); color: #91c8cd; }
	.vault-topline strong { color: #e8e2d2; font-size: 9px; }
	.vault-topline i { display: inline-block; width: 7px; height: 7px; margin-right: 8px; border-radius: 50%; background: #e94938; box-shadow: 0 0 14px #f13e2c; }

	.vault-stage { position: relative; display: grid; place-items: center; min-height: 0; pointer-events: none; }
	.vault-stage-status { align-content: end; padding: 0 12px 12px; }
	.vault-stage-card {
		align-content: center;
		justify-items: center;
		box-sizing: border-box;
		min-width: 0;
		max-width: 100%;
		overflow: hidden;
		padding: clamp(28px, 5vw, 56px);
		border: 1px solid rgba(216, 171, 87, .78);
		background: linear-gradient(150deg, rgba(4, 13, 14, .94), rgba(3, 8, 9, .88));
		box-shadow: 0 30px 100px rgba(0, 0, 0, .9), inset 0 0 70px rgba(5, 53, 58, .24);
		text-align: center;
	}

	.vault-stage-card::before { content: ''; position: absolute; inset: 8px; border: 1px solid rgba(99, 161, 165, .18); pointer-events: none; }
	.vault-corner { position: absolute; width: 40px; height: 40px; border-color: #c18e3f; pointer-events: none; }
	.vault-corner-a { top: 14px; left: 14px; border-top: 2px solid; border-left: 2px solid; }
	.vault-corner-b { right: 14px; bottom: 14px; border-right: 2px solid; border-bottom: 2px solid; }

	.vault-status-copy {
		display: grid;
		min-width: min(460px, 78vw);
		max-width: 620px;
		gap: 5px;
		padding: 10px 18px;
		border-left: 3px solid #d9aa53;
		background: rgba(2, 7, 8, .82);
		box-shadow: 0 14px 40px rgba(0, 0, 0, .64);
		text-align: left;
	}
	.vault-status-copy span { color: #8bcbd0; font: 900 9px/1 ui-monospace, monospace; letter-spacing: .18em; }
	.vault-status-copy strong { color: #f0c66b; font-size: clamp(17px, 2vw, 24px); }
	.vault-status-copy small { color: #c9d4d2; font-size: 12px; }

	.vault-classification,
	.vault-code { color: #75c8d3; font: 900 10px/1 ui-monospace, monospace; letter-spacing: .22em; }
	.vault-code { margin-top: 10px; color: #e6b75e; }
	.vault-stage h2 { margin: 12px 0 4px; color: #f1c76c; font-size: clamp(30px, 5vw, 58px); line-height: .94; letter-spacing: -.04em; text-shadow: 0 3px 20px rgba(0, 0, 0, .8); }
	.vault-stage p { max-width: 600px; margin: 8px 0 22px; color: #d6dfdd; font-size: clamp(14px, 1.7vw, 18px); }
	.vault-result {
		display: block;
		min-width: 0;
		max-width: calc(100% - 16px);
		margin: -4px 0 22px;
		padding-inline: .08em;
		color: #fff0b3;
		font-size: clamp(38px, 7vw, 76px);
		line-height: .96;
		overflow-wrap: anywhere;
		text-align: center;
		text-shadow: 0 0 32px rgba(240, 188, 81, .28);
		white-space: normal;
	}
	.vault-result-label {
		min-width: 0;
		max-width: calc(100% - 16px);
		margin-top: -6px;
		color: #8fcbd0;
		font: 900 10px/1.35 ui-monospace, monospace;
		letter-spacing: .18em;
		overflow-wrap: anywhere;
		text-align: center;
		text-wrap: balance;
	}
	.vault-cap-banner {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		margin: -5px 0 16px;
		padding: 8px 16px;
		border: 1px solid rgba(255, 105, 78, .82);
		background: rgba(72, 12, 8, .82);
		box-shadow: inset 0 0 20px rgba(238, 68, 42, .18), 0 0 22px rgba(238, 68, 42, .2);
		font: 900 11px/1 ui-monospace, monospace;
		letter-spacing: .16em;
	}
	.vault-cap-banner span { color: #ffb29f; }
	.vault-cap-banner strong { color: #fff0bd; }
	.vault-cap-context {
		display: flex;
		align-items: center;
		gap: 9px;
		margin: -10px 0 16px;
		color: #8fcbd0;
		font: 900 10px/1 ui-monospace, monospace;
		letter-spacing: .14em;
	}
	.vault-cap-context strong { color: #f6d58b; }
	.vault-target { margin: 3px 0 20px; color: #ff9a81; font-size: clamp(15px, 2vw, 22px); letter-spacing: .12em; }

	.vault-award {
		display: grid;
		grid-template-columns: minmax(150px, 1fr) minmax(150px, 1fr);
		min-width: min(470px, 78vw);
		max-width: min(520px, 82vw);
		margin: -4px 0 18px;
		padding: 14px 24px;
		border: 1px solid rgba(240, 191, 91, .76);
		background: linear-gradient(135deg, rgba(76, 17, 12, .84), rgba(6, 12, 13, .94));
		box-shadow: inset 0 0 32px rgba(221, 65, 42, .18), 0 0 30px rgba(226, 74, 46, .18);
	}
	.vault-award-count,
	.vault-award-target { display: grid; min-height: 104px; align-content: center; justify-items: center; padding: 2px 20px; }
	.vault-award-target { border-left: 1px solid rgba(219, 173, 81, .42); }
	.vault-award span,
	.vault-award b { color: #f6d58b; font: 900 12px/1 ui-monospace, monospace; letter-spacing: .18em; text-align: center; }
	.vault-award-count strong { font: 900 clamp(64px, 11vw, 112px)/.75 Arial, sans-serif; color: #fff2bc; text-shadow: 0 0 28px rgba(244, 166, 47, .62), 0 5px 0 #6d2518; animation: vault-award-impact .52s cubic-bezier(.2, 1.4, .35, 1) both; }
	.vault-award-count b { margin-top: 6px; }
	.vault-award-target-art { width: 82px; height: 82px; margin-top: 4px; object-fit: contain; filter: drop-shadow(0 6px 12px rgba(0, 0, 0, .7)); }
	.vault-award-target strong { margin-top: 12px; color: #fff2bc; font: 900 32px/1 Arial, sans-serif; }
	.vault-award small { grid-column: 1 / -1; margin-top: 12px; padding-top: 10px; border-top: 1px solid rgba(219, 173, 81, .42); color: #f6d58b; font: 900 9px/1 ui-monospace, monospace; letter-spacing: .12em; }

	.vault-stage button { min-width: 176px; min-height: 44px; padding: 0 20px; border: 1px solid #c89b4c; background: linear-gradient(#1c2424, #0b1011); color: #f7dfaa; font: 900 11px/1 ui-monospace, monospace; letter-spacing: .12em; cursor: pointer; pointer-events: auto; }
	.vault-stage button.vault-ui-v21-control {
		position: relative;
		isolation: isolate;
		border: 0;
		background: none;
		box-shadow: none;
	}
	.vault-stage button.vault-ui-v21-control > :global(.panel-state-art) { z-index: 0; }
	.vault-button-label { position: relative; z-index: 1; }
	.vault-stage button:hover,
	.vault-stage button:focus-visible { border-color: #ffe29b; outline: 2px solid rgba(103, 210, 224, .7); outline-offset: 2px; }
	.vault-stage button.vault-ui-v21-control:hover {
		border: 0;
		background: none;
		box-shadow: none;
		outline: none;
	}
	.vault-stage button.vault-ui-v21-control:focus-visible {
		border: 0;
		background: none;
		box-shadow: none;
		outline: 2px solid rgba(103, 210, 224, .7);
		outline-offset: 2px;
	}
	.vault-stage-status button.vault-skip {
		position: absolute;
		z-index: 3;
		right: 12px;
		bottom: 12px;
		min-width: 96px;
		min-height: 44px;
	}

	.vault-progress { min-height: 36px; padding: 0 13px; gap: 12px; color: #879b99; }
	.vault-progress > div { flex: 1; height: 3px; overflow: hidden; background: #182325; }
	.vault-progress > div i { display: block; width: 100%; height: 100%; background: linear-gradient(90deg, #4ca6ad, #ebbb5c); transform: scaleX(var(--vault-progress, 0)); transform-origin: left center; transition: transform .25s ease-out; box-shadow: 0 0 10px rgba(99, 210, 218, .44); will-change: transform; }
	.vault-progress strong { min-width: 36px; color: #e5bd69; text-align: right; }

	[data-vault-state='free-spins-awarded'] .vault-stage-card,
	[data-vault-state='bonus-entry'] .vault-stage-card { border-color: rgba(231, 77, 52, .84); box-shadow: 0 30px 100px rgba(0, 0, 0, .92), inset 0 0 90px rgba(116, 15, 10, .23); }

	@keyframes vault-award-impact { from { transform: scale(.72); } to { transform: scale(1); } }

	@media (max-width: 1040px), (max-height: 560px), (pointer: coarse) {
		.vault-opening-sequence { object-fit: contain; background: #010304; }
	}

	@media (max-width: 640px) {
		.vault-opening-sequence { object-fit: contain; background: #010304; }
		.vault-shell { width: calc(100vw - 22px); height: min(88vh, 680px); }
		.vault-topline { padding: 0 10px; }
		.vault-topline strong { letter-spacing: .08em; }
		.vault-stage-status { padding-bottom: 8px; }
		.vault-status-copy { min-width: 0; width: calc(100% - 4px); padding: 9px 12px; }
		.vault-status-copy strong { font-size: 16px; }
		.vault-status-copy small { font-size: 11px; }
		.vault-stage-status button.vault-skip { right: 5px; bottom: 84px; min-width: 78px; min-height: 44px; padding: 0 10px; }
		.vault-stage-card { padding: 26px 14px; }
		.vault-stage h2 { font-size: clamp(26px, 9vw, 38px); }
		.vault-stage p { font-size: 13px; }
		.vault-award { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); min-width: 0; width: min(340px, 86vw); padding: 12px 14px; }
		.vault-award-count,
		.vault-award-target { min-width: 0; min-height: 90px; padding: 2px 8px; }
		.vault-award span,
		.vault-award b { letter-spacing: .12em; }
		.vault-award-count strong { font-size: clamp(54px, 18vw, 76px); }
		.vault-award-target-art { width: 68px; height: 68px; }
	}

	@media (max-aspect-ratio: 4 / 3), (min-aspect-ratio: 2 / 1) {
		.vault-opening-sequence { object-fit: contain; background: #010304; }
	}

	@media (max-height: 430px) and (min-aspect-ratio: 4 / 3) {
		.vault-opening-sequence { object-fit: contain; }
		.vault-shell { height: calc(100vh - 16px); grid-template-rows: 34px 1fr 28px; }
		.vault-stage-status { padding-bottom: 5px; }
		.vault-stage-status .vault-status-copy {
			justify-self: start;
			min-width: 0;
			width: min(520px, calc(100% - 124px));
			max-width: 520px;
			padding-block: 7px;
		}
		.vault-stage-status button.vault-skip { right: 8px; bottom: 5px; }
		.vault-stage-card { padding: 18px 14px 12px; }
		.vault-stage h2 { font-size: clamp(24px, 5vw, 36px); }
		.vault-stage p { margin: 0 0 12px; font-size: 12px; }
		.vault-award { margin-bottom: 8px; padding: 8px 14px; }
		.vault-award-count,
		.vault-award-target { min-height: 76px; }
		.vault-award-count strong { font-size: 54px; }
		.vault-award-target-art { width: 58px; height: 58px; }
		.vault-award small { margin-top: 6px; padding-top: 6px; }
	}

	.vault-cinematic[data-dev-dialog='true'] .vault-stage button {
		min-width: 44px;
		min-height: 44px;
	}

	@media (prefers-reduced-motion: reduce) {
		.vault-award strong { animation: none !important; }
	}

	.vault-reduced .vault-award strong { animation: none !important; }

	/* DEV V22 cinematic room. The legacy scene and production cinematic remain
	   untouched; result and feature cards use the same warm material language as
	   the rebuilt machine instead of the old cyan/red fullscreen frame. */
	.vault-cinematic.vault-ui-v22 {
		background:
			radial-gradient(ellipse at 50% 43%, rgba(165, 124, 59, .18), transparent 31%),
			linear-gradient(180deg, rgba(0, 0, 0, .42), transparent 26% 70%, rgba(0, 0, 0, .7)),
			url('/assets/blacksite/v22/environment/premium-machine-shell-v22.webp') center / cover no-repeat,
			#020303;
	}

	.vault-cinematic.vault-ui-v22::before,
	.vault-cinematic.vault-ui-v22::after {
		position: absolute;
		z-index: 2;
		inset: 0;
		content: '';
		pointer-events: none;
	}

	.vault-cinematic.vault-ui-v22::before {
		background:
			radial-gradient(ellipse at 50% 45%, rgba(207, 160, 78, .13), rgba(22, 17, 11, .08) 46%, rgba(0, 0, 0, .24) 88%),
			linear-gradient(90deg, rgba(214, 168, 91, .16) 0 1px, transparent 1px) 50% 0 / 96px 100%,
			linear-gradient(180deg, rgba(255, 246, 224, .025), transparent 30% 72%, rgba(0, 0, 0, .46));
		mask-image: linear-gradient(90deg, #0000, #000 15% 85%, #0000);
		opacity: .34;
	}

	.vault-cinematic.vault-ui-v22::after {
		inset: 18px;
		border: 1px solid rgba(224, 184, 112, .14);
		box-shadow: inset 0 0 90px rgba(0, 0, 0, .52);
	}

	.vault-ui-v22:is(.vault-extraction, [data-vault-state='free-spins-awarded'], [data-vault-state='bonus-entry']) .vault-scene-art {
		display: none;
	}

	.vault-ui-v22:is(.vault-extraction, [data-vault-state='free-spins-awarded'], [data-vault-state='bonus-entry']) .vault-shade {
		background:
			radial-gradient(ellipse at 50% 47%, transparent 13%, rgba(0, 0, 0, .42) 73%),
			linear-gradient(180deg, rgba(0, 0, 0, .28), transparent 28% 70%, rgba(0, 0, 0, .54));
	}

	.vault-ui-v22 .vault-shell {
		width: min(1180px, calc(100vw - 48px));
		height: min(86vh, 820px);
		grid-template-rows: 48px minmax(0, 1fr) 42px;
		gap: 10px;
	}

	.vault-ui-v22 .vault-topline,
	.vault-ui-v22 .vault-progress {
		border-color: rgba(205, 163, 91, .6);
		box-shadow: 0 16px 40px rgba(0, 0, 0, .62), inset 0 0 0 1px rgba(255, 244, 219, .035);
		color: #b6aa92;
	}

	.vault-ui-v22 .vault-topline {
		padding-inline: 22px;
		color: #e5c98f;
	}

	.vault-ui-v22 .vault-topline strong { color: #f4eee1; }
	.vault-ui-v22 .vault-topline i {
		background: #d9a34f;
		box-shadow: 0 0 14px rgba(221, 173, 89, .72);
	}

	.vault-ui-v22 .vault-stage-card {
		padding: clamp(34px, 5vw, 68px);
		border-color: rgba(218, 176, 99, .82);
		box-shadow:
			0 34px 110px rgba(0, 0, 0, .78),
			inset 0 0 0 1px rgba(255, 242, 214, .05),
			inset 0 -80px 120px rgba(0, 0, 0, .24);
	}

	.vault-ui-v22 .vault-stage-card::before {
		inset: 12px;
		border-color: rgba(218, 176, 99, .26);
	}

	.vault-ui-v22 .vault-classification,
	.vault-ui-v22 .vault-result-label,
	.vault-ui-v22 .vault-cap-context,
	.vault-ui-v22 .vault-status-copy span {
		color: #bcb19c;
	}

	.vault-ui-v22 .vault-code { color: #e2b866; }
	.vault-ui-v22 .vault-stage h2 {
		max-width: 920px;
		margin-top: 18px;
		color: #fff3d5;
		font-size: clamp(40px, 5.1vw, 74px);
		letter-spacing: -.055em;
		text-wrap: balance;
	}

	.vault-ui-v22 .vault-stage p {
		max-width: 720px;
		color: #d6d0c4;
		font-size: clamp(15px, 1.5vw, 20px);
		line-height: 1.42;
		text-wrap: balance;
	}

	.vault-ui-v22 .vault-result {
		margin: 0 0 26px;
		color: #fff1c4;
		font-size: clamp(58px, 8vw, 112px);
		line-height: .9;
		letter-spacing: -.055em;
		text-shadow: 0 3px 0 #4a331b, 0 18px 42px rgba(218, 167, 76, .28);
	}

	.vault-ui-v22 .vault-award {
		min-width: min(660px, 76vw);
		max-width: 720px;
		padding: 22px 30px;
		border-color: rgba(222, 181, 104, .78);
		background: linear-gradient(135deg, rgba(50, 39, 23, .82), rgba(5, 8, 9, .92));
		box-shadow: inset 0 0 38px rgba(197, 147, 62, .1), 0 18px 45px rgba(0, 0, 0, .44);
	}

	.vault-ui-v22 .vault-award-target {
		border-left-color: rgba(222, 181, 104, .38);
	}

	.vault-ui-v22 .vault-award-count strong {
		color: #fff4cd;
		text-shadow: 0 3px 0 #5e411d, 0 12px 30px rgba(220, 168, 69, .42);
	}

	.vault-ui-v22 .vault-cap-banner {
		border-color: rgba(223, 179, 94, .82);
		background: linear-gradient(100deg, rgba(72, 51, 23, .92), rgba(22, 17, 11, .92));
		box-shadow: inset 0 0 20px rgba(224, 177, 80, .12), 0 10px 28px rgba(0, 0, 0, .42);
	}

	.vault-ui-v22 .vault-cap-banner span { color: #d9b46f; }
	.vault-ui-v22 .vault-cap-banner strong { color: #fff0bd; }
	.vault-ui-v22 .vault-target { color: #e6ba6d; }

	.vault-ui-v22 .vault-stage button {
		min-width: 220px;
		min-height: 52px;
		font-size: 12px;
	}

	.vault-ui-v22 .vault-stage button:hover,
	.vault-ui-v22 .vault-stage button:focus-visible {
		outline-color: rgba(244, 207, 139, .9);
	}

	.vault-ui-v22 .vault-progress { padding-inline: 18px; }
	.vault-ui-v22 .vault-progress > div { height: 4px; background: #17140f; }
	.vault-ui-v22 .vault-progress > div i {
		background: linear-gradient(90deg, #8c642d, #edc575, #fff0b6);
		box-shadow: 0 0 10px rgba(218, 171, 81, .38);
	}

	.vault-ui-v22[data-vault-state='free-spins-awarded'] .vault-stage-card,
	.vault-ui-v22[data-vault-state='bonus-entry'] .vault-stage-card {
		border-color: rgba(224, 180, 99, .88);
		box-shadow: 0 34px 110px rgba(0, 0, 0, .82), inset 0 0 100px rgba(158, 111, 42, .1);
	}

	/* V27 supplies only empty physical chrome. Reward copy, values, target art,
	   progress and accessibility semantics remain live above these surfaces. */
	.vault-ui-v27 .vault-v27-reward-halo {
		position: absolute;
		z-index: 0;
		inset: 50% auto auto 50%;
		width: min(900px, 96%);
		height: min(540px, 86%);
		object-fit: contain;
		opacity: .86;
		pointer-events: none;
		transform: translate(-50%, -50%);
		filter: drop-shadow(0 22px 52px rgba(201, 151, 69, .2));
	}

	.vault-ui-v27 .vault-ui-v27-inner {
		position: relative;
		isolation: isolate;
	}

	.vault-ui-v27 .vault-ui-v27-inner > :global(.ui-surface) {
		z-index: 0;
	}

	.vault-ui-v27 .vault-award.vault-ui-v27-inner,
	.vault-ui-v27 .vault-cap-banner.vault-ui-v27-inner {
		border-color: transparent;
		background: transparent;
		box-shadow: none;
	}

	.vault-ui-v27 .vault-award.vault-ui-v27-inner > .vault-award-count,
	.vault-ui-v27 .vault-award.vault-ui-v27-inner > .vault-award-target,
	.vault-ui-v27 .vault-award.vault-ui-v27-inner > small,
	.vault-ui-v27 .vault-cap-banner.vault-ui-v27-inner > span,
	.vault-ui-v27 .vault-cap-banner.vault-ui-v27-inner > strong,
	.vault-ui-v27 .vault-cap-context.vault-ui-v27-inner > span,
	.vault-ui-v27 .vault-cap-context.vault-ui-v27-inner > strong {
		position: relative;
		z-index: 1;
	}

	.vault-ui-v27 .vault-award.vault-ui-v27-inner > .vault-award-target,
	.vault-ui-v27 .vault-award.vault-ui-v27-inner > small {
		border-color: transparent;
	}

	.vault-ui-v27 .vault-cap-context.vault-ui-v27-inner {
		min-height: 30px;
		padding: 7px 13px;
	}

	.vault-ui-v27 .vault-progress > .vault-progress-track-v27 {
		position: relative;
		isolation: isolate;
		height: 8px;
		background: transparent;
		box-shadow: none;
	}

	.vault-ui-v27 .vault-progress-track-v27 > :global(.ui-surface) {
		--ui-surface-border-y: 2px;
		--ui-surface-border-x: 8px;
		z-index: 0;
	}

	.vault-ui-v27 .vault-progress-track-v27 > i {
		position: absolute;
		z-index: 1;
		inset: 2px 8px;
		width: auto;
		height: auto;
	}

	/* Award, bonus handoff and extraction are decisions/results, not loading
	   states. Their cards keep only the information the player can act on. */
	.vault-ui-v27:is(.vault-extraction, [data-vault-state='free-spins-awarded'], [data-vault-state='bonus-entry']) .vault-shell {
		grid-template-rows: 40px minmax(0, 1fr);
	}

	.vault-ui-v27:is(.vault-extraction, [data-vault-state='free-spins-awarded'], [data-vault-state='bonus-entry']) .vault-progress {
		display: none;
	}

	@media (max-width: 640px) {
		.vault-ui-v22 .vault-shell {
			width: calc(100vw - 12px);
			height: min(96dvh, 760px);
			grid-template-rows: 38px minmax(0, 1fr) 34px;
			gap: 5px;
		}

		.vault-ui-v22::after { inset: 5px; }
		.vault-ui-v22 .vault-topline { padding-inline: 9px; }
		.vault-ui-v22 .vault-topline,
		.vault-ui-v22 .vault-progress { font-size: 8px; letter-spacing: .085em; }
		.vault-ui-v22 .vault-stage-card { padding: 28px 13px 22px; }
		.vault-ui-v22 .vault-stage h2 { font-size: clamp(30px, 10vw, 42px); }
		.vault-ui-v22 .vault-stage p { margin-bottom: 14px; font-size: 12px; }
		.vault-ui-v22 .vault-result { margin-bottom: 18px; font-size: clamp(52px, 17vw, 76px); }
		.vault-ui-v22 .vault-award { min-width: 0; width: min(350px, 91vw); padding: 14px 12px; }
		.vault-ui-v22 .vault-stage button { min-width: 178px; min-height: 48px; }
	}

	@media (max-height: 430px) and (min-aspect-ratio: 4 / 3) {
		.vault-ui-v22 .vault-shell {
			width: calc(100vw - 16px);
			height: calc(100dvh - 10px);
			grid-template-rows: 32px minmax(0, 1fr) 28px;
			gap: 4px;
		}

		.vault-ui-v22 .vault-stage-card { padding: 14px 24px 10px; }
		.vault-ui-v22 .vault-stage h2 { margin: 4px 0; font-size: clamp(25px, 4.7vw, 38px); }
		.vault-ui-v22 .vault-stage p { margin: 0 0 8px; font-size: 11px; }
		.vault-ui-v22 .vault-result { margin: -2px 0 8px; font-size: clamp(42px, 8vw, 68px); }
		.vault-ui-v22 .vault-award { width: min(650px, 78vw); margin-bottom: 5px; padding: 7px 18px; }
		.vault-ui-v22 .vault-stage button { min-height: 44px; }
		.vault-ui-v22 .vault-progress { min-height: 28px; }
	}
</style>
