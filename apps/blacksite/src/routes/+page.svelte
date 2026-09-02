<script>
	import { onMount, tick } from 'svelte';
	import { BLACKSITE_ASSETS } from '../lib/assets/blacksite-assets.js';
	import { waitForDecodedImagePaint } from '../lib/assets/image-paint.js';
	import { MODES, getMode, getModeLabel } from '../lib/contracts/modes.js';
	import {
		CLUSTER_BANDS,
		CONTROL_GUIDE,
		RULES_CONTRACT,
		SYMBOL_PAYOUTS,
		getRulesDisclaimer,
	} from '../lib/contracts/rules.js';
	import { createReplayClient } from '../lib/replay/client.js';
	import { ReplayController } from '../lib/replay/controller.js';
	import {
		replayQueryUnitsTimesCentiX,
		replayQueryUnitsTimesInteger,
	} from '../lib/replay/money-domains.js';
	import { createReplayNormalizer } from '../lib/replay/normalizer.js';
	import { createLiveRgsClient } from '../lib/rgs/client.js';
	import { InsufficientBalanceError, totalPlayAmountApi } from '../lib/rgs/contracts.js';
	import { LiveSessionController } from '../lib/rgs/live-session.js';
	import { AudioDirector, createInitialAudioState } from '../lib/runtime/audio-director.js';
	import { GameEventAdapter } from '../lib/runtime/game-event-adapter.js';
	import {
		formatBalanceApi,
		formatCentiMultiplier,
		formatExactApi,
		formatReplayQueryUnits,
		formatSignedExactApi,
	} from '../lib/runtime/display-money.js';
	import { resolveLaunchMode } from '../lib/runtime/launch-mode.js';
	import { readMotionMode, writeMotionMode } from '../lib/runtime/motion-preference.js';
	import {
		PresentationDirector,
		createInitialPresentationState,
		planPresentationRestore,
	} from '../lib/runtime/presentation-director.js';

	const boardCells = Array.from({ length: 49 }, (_, index) => ({
		column: index % 7,
		row: Math.floor(index / 7),
	}));
	const boardRows = Array.from({ length: 7 }, (_, row) =>
		boardCells.slice(row * 7, row * 7 + 7),
	);
	const symbolPresentation = Object.freeze({
		byte: Object.freeze({ label: 'BYTE', mark: '01' }),
		relay: Object.freeze({ label: 'RELAY', mark: '↯' }),
		proxy: Object.freeze({ label: 'PROXY', mark: '◆' }),
		cipher: Object.freeze({ label: 'CIPHER', mark: '⌁' }),
		daemon: Object.freeze({ label: 'DAEMON', mark: '△' }),
		vault: Object.freeze({ label: 'VAULT', mark: '⬡' }),
	});
	const presentationCheckpointKinds = new Set([
		'board_snapshot',
		'route_snapshot',
		'feature_started',
		'feature_cycle',
		'feature_ended',
		'cap_reached',
	]);
	const SESSION_TIMER_INTERVAL_MS = 1_000;

	let launch = { kind: 'booting' };
	let presentation = createInitialPresentationState();
	let selectedModeId = 'base';
	let selectedMode = getMode(selectedModeId);
	let activeFixture = null;
	let activeCues = [];
	let director = null;
	let audioDirector = null;
	let audioState = createInitialAudioState();
	let liveSession = null;
	let replayController = null;
	let liveSnapshot = {
		status: 'idle',
		balance: null,
		config: null,
		selectedBaseAmountApi: null,
		round: null,
	};
	let replaySnapshot = { status: 'idle', replay: null, error: null };
	let runtimeState = 'booting';
	let runtimeError = null;
	let pendingRoundOrigin = null;
	let primaryBusy = false;
	let confirmationOpen = false;
	let rulesOpen = false;
	let finalWinApi = null;
	let finalWinRaw = 0;
	let sessionOpeningBalanceApi = null;
	let sessionElapsedSeconds = 0;
	let sessionTimerHandle = null;
	let liveRoundStartedAtMs = null;
	let minimumRoundWait = null;
	let confirmationDialog = null;
	let confirmationCancelButton = null;
	let rulesDialog = null;
	let rulesCloseButton = null;
	let returnFocusElement = null;
	let motionMode = 'normal';
	let reducedMotion = false;
	let characterAssetFailed = false;
	let characterAssetState = 'loading';
	let environmentAssetState = 'loading';
	/** @type {HTMLImageElement | null} */
	let characterAssetElement = null;
	/** @type {HTMLImageElement | null} */
	let environmentAssetElement = null;
	let characterPaintRequest = 0;
	let environmentPaintRequest = 0;

	$: selectedMode = getMode(selectedModeId);
	$: social = launch.social === true || liveSnapshot.config?.jurisdiction?.socialCasino === true;
	$: currency = liveSnapshot.balance?.currency ?? launch.currency ?? 'USD';
	$: baseAmountApi = liveSnapshot.selectedBaseAmountApi ?? 0;
	$: betLevelsApi = liveSnapshot.config?.betLevelsApi ?? [];
	$: spacebarDisabled = liveSnapshot.config?.jurisdiction?.disabledSpacebar === true;
	$: buyFeatureDisabled = liveSnapshot.config?.jurisdiction?.disabledBuyFeature === true;
	$: selectedModeBlocked = Boolean(
		buyFeatureDisabled && liveSnapshot.config?.betModes?.[selectedModeId]?.feature,
	);
	$: displayNetPosition = liveSnapshot.config?.jurisdiction?.displayNetPosition === true;
	$: displaySessionTimer = liveSnapshot.config?.jurisdiction?.displaySessionTimer === true;
	$: netPositionText =
		liveSnapshot.balance && sessionOpeningBalanceApi !== null
			? formatSignedExactApi(
					sessionOpeningBalanceApi - liveSnapshot.balance.amountApi,
					liveSnapshot.balance.currency,
				)
			: '—';
	$: sessionTimerText = `${String(Math.floor(sessionElapsedSeconds / 60)).padStart(2, '0')}:${String(sessionElapsedSeconds % 60).padStart(2, '0')}`;
	$: totalAmountApi = safeTotalAmount(baseAmountApi, selectedModeId);
	$: insufficientKnown = Boolean(
		launch.kind === 'live' &&
			liveSnapshot.balance &&
			totalAmountApi > liveSnapshot.balance.amountApi,
	);
	$: balanceText = liveSnapshot.balance
		? formatBalanceApi(liveSnapshot.balance.amountApi, liveSnapshot.balance.currency)
		: '—';
	$: totalAmountText = totalAmountApi > 0 ? formatExactApi(totalAmountApi, currency) : '—';
	$: replayTotalUnits =
		launch.kind === 'replay' && replaySnapshot.replay
			? replayQueryUnitsTimesInteger(launch.amountUnitsRaw, replaySnapshot.replay.costMultiplier)
			: launch.kind === 'replay'
				? launch.amountUnitsRaw
				: null;
	$: replayWinUnits =
		launch.kind === 'replay' && replaySnapshot.replay
			? replayQueryUnitsTimesCentiX(
					launch.amountUnitsRaw,
					replaySnapshot.replay.packagePayoutCentiX,
				)
			: null;
	$: finalWinText =
		launch.kind === 'replay'
			? replaySnapshot.status === 'completed'
				? formatReplayQueryUnits(replayWinUnits, launch.currency)
				: '—'
			: launch.kind === 'fixture'
				? formatCentiMultiplier(finalWinRaw)
				: finalWinApi !== null
					? formatExactApi(finalWinApi, currency)
					: '—';
	$: modalOpen = confirmationOpen || rulesOpen;
	$: actionLabel = primaryActionLabel({
		launchKind: launch.kind,
		liveStatus: liveSnapshot.status,
		replayStatus: replaySnapshot.status,
		fixtureCompleted: runtimeState === 'fixture-completed',
		insufficient: insufficientKnown,
	});
	$: actionDisabled = primaryActionDisabled({
		launchKind: launch.kind,
		liveStatus: liveSnapshot.status,
		replayStatus: replaySnapshot.status,
		busy: primaryBusy,
		confirming: confirmationOpen,
		showingRules: rulesOpen,
		fixtureReady: Boolean(activeFixture),
		insufficient: insufficientKnown,
		modeBlocked: selectedModeBlocked,
	});
	$: presentationBusy = primaryBusy || replaySnapshot.status === 'playing';
	$: visibleRuntimeMessage =
		social && runtimeError
			? 'The authoritative game flow could not continue.'
			: runtimeError?.message;
	$: legalDisclaimer = getRulesDisclaimer(social);
	$: playerStatus = playerStatusLabel(runtimeState, runtimeError);
	$: boardStatus = boardStatusLabel(runtimeState, presentation.activeClusters?.length ?? 0);
	$: if (typeof document !== 'undefined') document.body.dataset.runtimeState = runtimeState;
	$: liveKeys = new Set(
		(presentation.routeSnapshot?.live_cells ?? []).map((cell) => cellKey(cell)),
	);
	$: dormantKeys = new Set(
		(presentation.routeSnapshot?.dormant_cells ?? []).map((cell) => cellKey(cell)),
	);
	$: sealedKeys = new Set(
		(presentation.routeSnapshot?.sealed_cells ?? []).map((cell) => cellKey(cell)),
	);
	$: activeClusterKeys = new Set(
		(presentation.activeClusters ?? []).flatMap((cluster) =>
			cluster.positions.map((cell) => cellKey(cell)),
		),
	);
	$: activeMotionKeys = new Set((presentation.motion?.cells ?? []).map((cell) => cellKey(cell)));
	$: presentationTimingProfile = reducedMotion ? 'reduced' : motionMode;
	$: if (director) director.setTimingProfile(presentationTimingProfile);
	$: if (typeof document !== 'undefined') {
		document.body.dataset.motionPhase = presentation.motion?.phase ?? 'idle';
		document.body.dataset.motionProfile = presentationTimingProfile;
		document.body.dataset.audioStatus = audioState.status;
		document.body.dataset.audioLevel = audioState.level;
		document.body.dataset.assetPaintState =
			['painted', 'fallback'].includes(characterAssetState) &&
			environmentAssetState === 'painted'
				? 'painted'
				: characterAssetState === 'failed' || environmentAssetState === 'failed'
					? 'failed'
					: 'loading';
	}

	async function confirmAssetPaint(kind, image) {
		const request =
			kind === 'character' ? ++characterPaintRequest : ++environmentPaintRequest;
		if (kind === 'character') characterAssetState = 'loading';
		else environmentAssetState = 'loading';

		try {
			await waitForDecodedImagePaint(image, {
				reveal: async () => {
					if (kind === 'character') {
						if (request !== characterPaintRequest) return;
						characterAssetState = 'decoded';
					} else {
						if (request !== environmentPaintRequest) return;
						environmentAssetState = 'decoded';
					}
					await tick();
				},
			});
			if (kind === 'character' && request === characterPaintRequest) {
				characterAssetState = 'painted';
			}
			if (kind === 'environment' && request === environmentPaintRequest) {
				environmentAssetState = 'painted';
			}
		} catch {
			if (kind === 'character' && request === characterPaintRequest) {
				characterAssetFailed = true;
				characterAssetState = 'failed';
				await tick();
				await new Promise((resolve) =>
					requestAnimationFrame(() => requestAnimationFrame(resolve)),
				);
				characterAssetState = 'fallback';
			}
			if (kind === 'environment' && request === environmentPaintRequest) {
				environmentAssetState = 'failed';
			}
		}
	}

	function handleCharacterAssetError() {
		void confirmAssetPaint('character', null);
	}

	function handleEnvironmentAssetError() {
		environmentPaintRequest += 1;
		environmentAssetState = 'failed';
	}

	function cellKey(cell) {
		return `${cell.column},${cell.row}`;
	}

	function symbolAt(cell) {
		return presentation.board?.[cell.column]?.[cell.row] ?? null;
	}

	function playerStatusLabel(state, error) {
		if (error) return 'ATTENTION REQUIRED';
		if (state.includes('authenticating') || state === 'booting') return 'CONNECTING';
		if (state.includes('requesting') || state.includes('presenting') || state.includes('playing')) {
			return 'BREACH IN PROGRESS';
		}
		if (state.includes('settling') || state.includes('minimum-duration')) return 'SECURING RESULT';
		if (state.startsWith('replay-')) return 'REPLAY MODE';
		return 'VAULT READY';
	}

	function boardStatusLabel(state, activeClusterCount) {
		if (activeClusterCount > 0) return 'ACCESS CLUSTER FOUND';
		if (state.includes('presenting') || state.includes('playing')) return 'BREACHING VAULT GRID';
		if (state.includes('settling') || state.includes('minimum-duration')) return 'VERIFYING RESULT';
		if (state.includes('error')) return 'CONNECTION INTERRUPTED';
		return 'CHOOSE ACCESS LEVEL AND SPIN';
	}

	function safeTotalAmount(amountApi, modeId) {
		if (!Number.isSafeInteger(amountApi) || amountApi <= 0) return 0;
		try {
			return totalPlayAmountApi(amountApi, modeId);
		} catch {
			return 0;
		}
	}

	function publicError(error, fallbackCode = 'RUNTIME_ERROR') {
		return {
			code: error?.code ?? fallbackCode,
			message: error?.message ?? 'The authoritative game flow could not continue.',
		};
	}

	function recoverRuntime() {
		window.location.reload();
	}

	function fixtureFailure(code, message) {
		launch = { kind: 'error', code, message, surface: 'fixture' };
		runtimeState = 'error';
		runtimeError = { code, message };
	}

	async function playFixture() {
		if (!director || activeCues.length === 0) return;
		primaryBusy = true;
		runtimeState = 'fixture-playing';
		try {
			director.reset();
			const completed = await director.play(activeCues, {
				timingProfile: presentationTimingProfile,
			});
			if (!completed) throw new Error('Fixture presentation was cancelled.');
			finalWinRaw = activeFixture.book.payoutMultiplier;
			runtimeState = 'fixture-completed';
		} finally {
			primaryBusy = false;
		}
	}

	function handleLiveState(nextState) {
		liveSnapshot = nextState;
		if (sessionOpeningBalanceApi === null && nextState.balance) {
			sessionOpeningBalanceApi = nextState.balance.amountApi;
		}
		if (
			nextState.config?.jurisdiction?.displaySessionTimer === true &&
			sessionTimerHandle === null
		) {
			const sessionStartedAtMs = Date.now();
			sessionTimerHandle = window.setInterval(() => {
				sessionElapsedSeconds = Math.floor((Date.now() - sessionStartedAtMs) / 1_000);
			}, SESSION_TIMER_INTERVAL_MS);
		}
		if (nextState.status === 'authenticating') runtimeState = 'live-authenticating';
		if (nextState.status === 'playing') runtimeState = 'live-requesting';
		if (nextState.status === 'presenting') {
			runtimeState = pendingRoundOrigin === 'play' ? 'live-presenting' : 'live-restore-ready';
			selectedModeId = nextState.round?.mode ?? selectedModeId;
		}
		if (nextState.status === 'settling') runtimeState = 'live-settling';
		if (nextState.status === 'ready' && !primaryBusy) runtimeState = 'live-ready';
		if (nextState.status === 'error') {
			runtimeState = 'live-error';
			runtimeError = nextState.lastError ?? {
				code: 'LIVE_SESSION_ERROR',
				message: 'The live game session stopped safely.',
			};
		}
	}

	function handleReplayState(nextState) {
		replaySnapshot = nextState;
		runtimeState = `replay-${nextState.status}`;
		if (nextState.replay) {
			selectedModeId = nextState.replay.identity.mode;
			if (nextState.status === 'completed') {
				finalWinRaw = nextState.replay.packagePayoutCentiX;
			}
		}
		if (
			nextState.status === 'loading' ||
			nextState.status === 'ready' ||
			nextState.status === 'playing'
		) {
			finalWinRaw = 0;
		}
		if (nextState.error) runtimeError = nextState.error;
	}

	async function loadDevelopmentFixture(fixtureId, adapter) {
		if (!__BLACKSITE_DEV_FIXTURES__) {
			fixtureFailure('DEV_FIXTURE_FORBIDDEN', 'Development fixtures are disabled.');
			return;
		}
		const catalog = await import('../lib/fixtures/catalog.generated.js');
		activeFixture = catalog.getFixture(fixtureId);
		if (!activeFixture) {
			fixtureFailure('DEV_FIXTURE_UNKNOWN', `Unknown development fixture: ${fixtureId}`);
			return;
		}
		try {
			activeCues = adapter.adaptBook(activeFixture.book, {
				expectedMode: activeFixture.mode,
			});
			selectedModeId = activeFixture.mode;
			finalWinRaw = activeFixture.book.payoutMultiplier;
			runtimeState = 'fixture-ready';
		} catch (error) {
			fixtureFailure('DEV_FIXTURE_CONTRACT_INVALID', error.message);
		}
	}

	async function presentLiveRound() {
		const round = liveSession?.snapshot().round;
		if (!round || primaryBusy) return;
		primaryBusy = true;
		runtimeError = null;
		runtimeState = pendingRoundOrigin === 'play' ? 'live-presenting' : 'live-restoring';

		try {
			director.reset();
			if (pendingRoundOrigin === 'play') await waitForMinimumRoundDuration();
			const plan =
				pendingRoundOrigin === 'restore'
					? planPresentationRestore(round.cues, round.eventCursor ?? 0)
					: planPresentationRestore(round.cues, 0);
			for (const cue of plan.primeCues) director.consume(cue);
			const completed = await director.play(plan.resumeCues, {
				timingProfile: presentationTimingProfile,
				onCue: async (cue) => {
					if (round.active && presentationCheckpointKinds.has(cue.kind)) {
						await liveSession.savePresentationCursor(cue.eventIndex + 1);
					}
				},
			});
			if (!completed) throw new Error('Authoritative presentation was cancelled.');
			await waitForMinimumRoundDuration();
			finalWinApi = round.payoutApi;
			finalWinRaw = round.payoutMultiplierRaw;
		} catch (error) {
			runtimeError = publicError(error, 'PRESENTATION_ERROR');
			try {
				await liveSession.failPresentation(error);
				await waitForMinimumRoundDuration();
				finalWinApi = round.payoutApi;
				finalWinRaw = round.payoutMultiplierRaw;
				runtimeState = 'live-ready';
				pendingRoundOrigin = null;
				liveRoundStartedAtMs = null;
			} catch (settlementError) {
				runtimeError = publicError(settlementError, 'SETTLEMENT_ERROR');
				runtimeState = 'live-error';
			}
			primaryBusy = false;
			return;
		}

		try {
			await liveSession.completePresentation();
			runtimeState = 'live-ready';
			pendingRoundOrigin = null;
			liveRoundStartedAtMs = null;
		} catch (error) {
			runtimeError = publicError(error, 'SETTLEMENT_ERROR');
			runtimeState = 'live-error';
		} finally {
			primaryBusy = false;
		}
	}

	async function executeLivePlay() {
		if (!liveSession || primaryBusy) return;
		primaryBusy = true;
		pendingRoundOrigin = 'play';
		runtimeError = null;
		finalWinApi = null;
		finalWinRaw = 0;
		liveRoundStartedAtMs = Date.now();
		try {
			await liveSession.play(selectedModeId);
		} catch (error) {
			runtimeError = publicError(error);
			liveRoundStartedAtMs = null;
			if (error instanceof InsufficientBalanceError) runtimeState = 'live-insufficient';
			else runtimeState = 'live-error';
			primaryBusy = false;
			return;
		}
		primaryBusy = false;
		await presentLiveRound();
	}

	async function waitForMinimumRoundDuration() {
		if (pendingRoundOrigin !== 'play' || liveRoundStartedAtMs === null) return;
		const minimumMs = liveSnapshot.config?.jurisdiction?.minimumRoundDuration ?? 0;
		const remainingMs = minimumMs - (Date.now() - liveRoundStartedAtMs);
		if (remainingMs <= 0) return;
		runtimeState = 'live-minimum-duration';
		await new Promise((resolve) => {
			const timer = window.setTimeout(() => {
				minimumRoundWait = null;
				resolve();
			}, remainingMs);
			minimumRoundWait = { timer, resolve };
		});
	}

	function requestLivePlay() {
		if (selectedModeBlocked) return;
		if (selectedMode.costMultiplier > 1) void openConfirmation();
		else void executeLivePlay();
	}

	function toggleMotionMode() {
		if (reducedMotion) return;
		audioDirector?.playUi();
		motionMode = writeMotionMode(
			window.localStorage,
			motionMode === 'normal' ? 'turbo' : 'normal',
		);
	}

	function skipPresentation() {
		audioDirector?.playUi();
		director?.skip();
	}

	async function toggleAudio() {
		if (!audioDirector) return;
		if (!audioState.unlocked) {
			if (await audioDirector.unlock()) {
				if (audioState.volume === 0) audioDirector.cycleVolume();
				audioDirector.playUi();
			}
			return;
		}
		const nextState = audioDirector.cycleVolume();
		if (nextState.volume > 0) audioDirector.playUi();
	}

	async function confirmLivePlay() {
		const focusTarget = returnFocusElement;
		confirmationOpen = false;
		returnFocusElement = null;
		await tick();
		focusTarget?.focus?.();
		void executeLivePlay();
	}

	function rememberFocus() {
		returnFocusElement =
			document.activeElement instanceof HTMLElement ? document.activeElement : null;
	}

	async function openConfirmation() {
		rememberFocus();
		confirmationOpen = true;
		await tick();
		confirmationCancelButton?.focus();
	}

	async function closeConfirmation() {
		const focusTarget = returnFocusElement;
		confirmationOpen = false;
		returnFocusElement = null;
		await tick();
		focusTarget?.focus?.();
	}

	async function openRules() {
		rememberFocus();
		rulesOpen = true;
		await tick();
		rulesCloseButton?.focus();
	}

	async function closeRules() {
		const focusTarget = returnFocusElement;
		rulesOpen = false;
		returnFocusElement = null;
		await tick();
		focusTarget?.focus?.();
	}

	function trapDialogFocus(event, dialog) {
		if (event.key !== 'Tab' || !dialog) return false;
		const focusable = [
			...dialog.querySelectorAll(
				'button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
			),
		].filter((element) => element instanceof HTMLElement && element.offsetParent !== null);
		if (focusable.length === 0) {
			event.preventDefault();
			dialog.focus();
			return true;
		}
		const first = focusable[0];
		const last = focusable.at(-1);
		if (!dialog.contains(document.activeElement)) {
			event.preventDefault();
			first.focus();
			return true;
		}
		if (event.shiftKey && document.activeElement === first) {
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

	function selectMode(modeId) {
		if (launch.kind !== 'live' || liveSnapshot.status !== 'ready' || primaryBusy) return;
		const modeConfig = liveSnapshot.config?.betModes?.[modeId];
		if (!modeConfig || (buyFeatureDisabled && modeConfig.feature)) return;
		selectedModeId = modeId;
		runtimeError = null;
	}

	function selectBaseAmount(event) {
		try {
			liveSession?.selectBaseAmount(Number(event.currentTarget.value));
			runtimeError = null;
		} catch (error) {
			runtimeError = publicError(error, 'PLAY_AMOUNT_INVALID');
		}
	}

	async function activatePrimary() {
		if (actionDisabled) return;
		await audioDirector?.unlock();
		if (launch.kind === 'fixture') return playFixture();
		if (launch.kind === 'replay') {
			if (replaySnapshot.status === 'completed') return replayController.playAgain();
			return replayController.play();
		}
		if (launch.kind === 'live' && liveSnapshot.status === 'presenting') {
			pendingRoundOrigin ??= 'restore';
			return presentLiveRound();
		}
		if (launch.kind === 'live' && liveSnapshot.status === 'ready') requestLivePlay();
	}

	function primaryActionLabel({
		launchKind,
		liveStatus,
		replayStatus,
		fixtureCompleted,
		insufficient,
	}) {
		if (launchKind === 'fixture') {
			return fixtureCompleted ? 'REPLAY DEV FIXTURE' : 'PLAY DEV FIXTURE';
		}
		if (launchKind === 'replay') {
			if (replayStatus === 'loading') return 'LOADING REPLAY';
			if (replayStatus === 'ready') return 'PLAY REPLAY';
			if (replayStatus === 'playing') return 'REPLAYING';
			if (replayStatus === 'completed') return 'PLAY AGAIN';
			return 'REPLAY UNAVAILABLE';
		}
		if (launchKind === 'live') {
			if (liveStatus === 'presenting') return 'CONTINUE ROUND';
			if (liveStatus === 'ready' && insufficient) return 'INSUFFICIENT BALANCE';
			if (liveStatus === 'ready') return 'INITIATE BREACH';
			if (liveStatus === 'authenticating') return 'AUTHENTICATING';
			if (liveStatus === 'settling') return 'SETTLING';
		}
		return 'UNAVAILABLE';
	}

	function primaryActionDisabled({
		launchKind,
		liveStatus,
		replayStatus,
		busy,
		confirming,
		showingRules,
		fixtureReady,
		insufficient,
		modeBlocked,
	}) {
		if (busy || confirming || showingRules) return true;
		if (launchKind === 'fixture') return !fixtureReady;
		if (launchKind === 'replay') return !['ready', 'completed'].includes(replayStatus);
		if (launchKind === 'live') {
			return (
				insufficient ||
				(modeBlocked && liveStatus === 'ready') ||
				!['ready', 'presenting'].includes(liveStatus)
			);
		}
		return true;
	}

	function suppressPrimaryKeyRepeat(event) {
		if (!event.repeat) return;
		if (event.key !== 'Enter' && event.code !== 'Space') return;
		event.preventDefault();
	}

	function keydown(event) {
		const openDialog = confirmationOpen ? confirmationDialog : rulesOpen ? rulesDialog : null;
		if (openDialog && trapDialogFocus(event, openDialog)) return;
		if (event.key === 'Escape') {
			if (confirmationOpen) void closeConfirmation();
			else if (rulesOpen) void closeRules();
			event.preventDefault();
			return;
		}
		if (
			event.code === 'Space' &&
			launch.kind === 'live' &&
			!spacebarDisabled &&
			!confirmationOpen &&
			!rulesOpen &&
			!['BUTTON', 'SELECT', 'INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)
		) {
			event.preventDefault();
			if (event.repeat) return;
			void activatePrimary();
		}
	}

	onMount(() => {
		let disposed = false;
		const destroyLiveSession = () => {
			liveSession?.destroy();
		};
		const destroyReplaySession = () => {
			replayController?.destroy();
		};
		motionMode = readMotionMode(window.localStorage);
		const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
		const syncReducedMotion = () => {
			reducedMotion = reducedMotionQuery.matches;
		};
		syncReducedMotion();
		reducedMotionQuery.addEventListener('change', syncReducedMotion);
		const adapter = new GameEventAdapter();
		audioDirector = new AudioDirector({
			audioContextFactory: window.AudioContext ? () => new window.AudioContext() : null,
			storage: window.localStorage,
			documentRef: document,
			onState: (nextState) => {
				audioState = nextState;
			},
		});
		audioState = audioDirector.state;
		director = new PresentationDirector(
			(nextState) => {
				presentation = nextState;
			},
			(cue) => {
				audioDirector?.consume(cue, { timingProfile: presentationTimingProfile });
			},
		);
		launch = resolveLaunchMode(window.location.search, { dev: __BLACKSITE_DEV_FIXTURES__ });
		window.addEventListener('keydown', keydown);
		window.addEventListener('pagehide', destroyLiveSession);
		window.addEventListener('pagehide', destroyReplaySession);
		if (characterAssetElement?.complete) {
			void confirmAssetPaint('character', characterAssetElement);
		}
		if (environmentAssetElement?.complete) {
			void confirmAssetPaint('environment', environmentAssetElement);
		}

		void (async () => {
			if (launch.kind === 'error') {
				runtimeState = 'error';
				runtimeError = { code: launch.code, message: launch.message };
				return;
			}
			if (launch.kind === 'fixture') {
				await loadDevelopmentFixture(launch.fixtureId, adapter);
				return;
			}
			if (launch.kind === 'replay') {
				selectedModeId = launch.mode;
				replayController = new ReplayController({
					client: createReplayClient(),
					normalizer: createReplayNormalizer({ gameEventAdapter: adapter }),
					director,
					onState: handleReplayState,
				});
				await replayController.load(launch);
				return;
			}
			liveSession = new LiveSessionController({
				client: createLiveRgsClient({ baseUrl: launch.rgsUrl }),
				adapter,
				sessionID: launch.sessionId,
				language: launch.language,
				onState: handleLiveState,
			});
			try {
				const state = await liveSession.bootstrap();
				if (disposed) return;
				if (state.round?.active) {
					pendingRoundOrigin = 'restore';
					selectedModeId = state.round.mode;
					runtimeState = 'live-restore-ready';
					await presentLiveRound();
				}
			} catch (error) {
				if (!disposed) {
					runtimeError = publicError(error, 'AUTHENTICATION_ERROR');
					runtimeState = 'live-error';
				}
			}
		})();

		return () => {
			disposed = true;
			reducedMotionQuery.removeEventListener('change', syncReducedMotion);
			window.removeEventListener('keydown', keydown);
			window.removeEventListener('pagehide', destroyLiveSession);
			window.removeEventListener('pagehide', destroyReplaySession);
			destroyLiveSession();
			destroyReplaySession();
			if (sessionTimerHandle !== null) window.clearInterval(sessionTimerHandle);
			if (minimumRoundWait) {
				window.clearTimeout(minimumRoundWait.timer);
				minimumRoundWait.resolve();
				minimumRoundWait = null;
			}
			if (!replayController) director?.destroy();
			audioDirector?.destroy();
			delete document.body.dataset.runtimeState;
			delete document.body.dataset.motionPhase;
			delete document.body.dataset.motionProfile;
			delete document.body.dataset.audioStatus;
			delete document.body.dataset.audioLevel;
			delete document.body.dataset.assetPaintState;
		};
	});
</script>

<svelte:head>
	<title>BLACKSITE // BREACH</title>
	<meta name="description" content="Enter the BLACKSITE vault and breach the Ghost Route." />
</svelte:head>

<main class="app-shell" data-launch-kind={launch.kind} data-testid="player-hud">
	<header class="masthead" inert={modalOpen} aria-hidden={modalOpen ? 'true' : undefined}>
		<div class="identity">
			<span class="eyebrow">ARMORED ACCESS FACILITY</span>
			<h1>BLACKSITE <span>// BREACH</span></h1>
		</div>
		<div class="masthead-actions">
			<div
				class="lifecycle"
				data-testid="launch-status"
				role="status"
				aria-label="Vault connection status"
				aria-live="polite"
				aria-atomic="true"
			>
				<span class="pulse" class:error-pulse={runtimeError !== null}></span>
				{playerStatus}
			</div>
			<button
				class="sound-action"
				data-testid="sound-action"
				type="button"
				aria-label={`Game audio ${audioState.unlocked ? audioState.level.toLowerCase() : 'off until enabled'}`}
				aria-pressed={audioState.volume === 0}
				data-audio-status={audioState.status}
				data-audio-level={audioState.level}
				data-audio-cues={audioState.cueCount}
				data-audio-voices={audioState.activeVoices}
				data-ambience-instances={audioState.ambienceInstances}
				data-audio-recipe={audioState.lastRecipe ?? 'none'}
				data-audio-reel-pulses={audioState.reelStopPulses}
				data-audio-priority-cues={audioState.priorityCues}
				data-audio-ducks={audioState.duckCount}
				on:click={() => void toggleAudio()}
			>
				SOUND {audioState.unlocked ? audioState.level : 'OFF'}
			</button>
		</div>
	</header>

	<section
		class="studio"
		aria-label="BLACKSITE game interface"
		inert={modalOpen}
		aria-hidden={modalOpen ? 'true' : undefined}
	>
		<aside class="panel mode-panel">
			<div class="panel-heading">
				<span aria-hidden="true">⌁</span>
				<div>
					<p>ACCESS LEVEL</p>
					<h2 id="access-level-title">Choose your route</h2>
				</div>
			</div>

			<div class="mode-list" role="group" aria-labelledby="access-level-title">
				{#each MODES as mode}
					{#if !(buyFeatureDisabled && liveSnapshot.config?.betModes?.[mode.id]?.feature)}
						<button
							type="button"
							data-testid={`mode-${mode.id}`}
							class:selected={mode.id === selectedModeId}
							aria-pressed={mode.id === selectedModeId}
							disabled={launch.kind !== 'live' || liveSnapshot.status !== 'ready' || primaryBusy}
							on:click={() => selectMode(mode.id)}
						>
							<span>{getModeLabel(mode.id, social)}</span>
							<strong>{mode.costMultiplier}×</strong>
						</button>
					{/if}
				{/each}
			</div>

			<label class="amount-control" for="blacksite-base-amount">
				<span>BASE AMOUNT</span>
				{#if betLevelsApi.length > 0}
					<select
						id="blacksite-base-amount"
						data-testid="base-amount"
						value={baseAmountApi}
						disabled={launch.kind !== 'live' || liveSnapshot.status !== 'ready' || primaryBusy}
						on:change={selectBaseAmount}
					>
						{#each betLevelsApi as amountApi}
							<option value={amountApi}>{formatExactApi(amountApi, currency)}</option>
						{/each}
					</select>
				{:else if liveSnapshot.config}
					<span class="amount-range">
						<input
							id="blacksite-base-amount"
							data-testid="base-amount"
							type="range"
							min={liveSnapshot.config.minBetApi}
							max={liveSnapshot.config.maxBetApi}
							step={liveSnapshot.config.stepBetApi}
							value={baseAmountApi}
							aria-valuetext={formatExactApi(baseAmountApi, currency)}
							disabled={launch.kind !== 'live' || liveSnapshot.status !== 'ready' || primaryBusy}
							on:change={selectBaseAmount}
						/>
						<output for="blacksite-base-amount">{formatExactApi(baseAmountApi, currency)}</output>
					</span>
				{:else}
					<select id="blacksite-base-amount" data-testid="base-amount" disabled>
						<option value="">—</option>
					</select>
				{/if}
			</label>

			<div
				class="vaultkeeper-presence"
				data-testid="vaultkeeper-presence"
				data-character-state={presentation.character?.state ?? 'idle_a'}
				data-motion-profile={presentationTimingProfile}
				data-asset-state={characterAssetFailed ? 'fallback' : 'image'}
				data-asset-paint-state={characterAssetState}
				aria-hidden="true"
			>
				<img
					bind:this={characterAssetElement}
					src={BLACKSITE_ASSETS.character.vaultkeeperFallback}
					alt=""
					width="702"
					height="1080"
					decoding="async"
					on:load={(event) => void confirmAssetPaint('character', event.currentTarget)}
					on:error={handleCharacterAssetError}
				/>
				<div class="vaultkeeper-safe-fallback" data-testid="vaultkeeper-safe-fallback">
					<span></span>
				</div>
				<div class="vaultkeeper-tag">
					<span>VAULTKEEPER</span>
					<strong>LOCK CONTROL // PRESENT</strong>
				</div>
			</div>

			<div class="mode-readout">
				<div><span>Mode</span><strong>{getModeLabel(selectedMode.id, social)}</strong></div>
				<div><span>Cost</span><strong>{selectedMode.costMultiplier}× play amount</strong></div>
				<div><span>RTP</span><strong>96.20%</strong></div>
				<div><span>Max w