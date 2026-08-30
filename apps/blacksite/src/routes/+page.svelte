<script>
	import { onMount, tick } from 'svelte';
	import { BLACKSITE_ASSETS } from '../lib/assets/blacksite-assets.js';
	import { MODES, getMode, getModeLabel } from '../lib/contracts/modes.js';
	import {
		CLUSTER_BANDS,
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
	import {
		PresentationDirector,
		createInitialPresentationState,
		planPresentationRestore,
	} from '../lib/runtime/presentation-director.js';

	const boardCells = Array.from({ length: 49 }, (_, index) => ({
		column: index % 7,
		row: Math.floor(index / 7),
	}));
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
			}, 250);
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
		motionMode = motionMode === 'normal' ? 'turbo' : 'normal';
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
			void activatePrimary();
		}
	}

	onMount(() => {
		let disposed = false;
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
					stepDelayMs: 16,
					winDelayMs: 220,
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
			liveSession?.destroy();
			if (sessionTimerHandle !== null) window.clearInterval(sessionTimerHandle);
			if (minimumRoundWait) {
				window.clearTimeout(minimumRoundWait.timer);
				minimumRoundWait.resolve();
				minimumRoundWait = null;
			}
			if (replayController) replayController.destroy();
			else director?.destroy();
			audioDirector?.destroy();
			delete document.body.dataset.runtimeState;
			delete document.body.dataset.motionPhase;
			delete document.body.dataset.motionProfile;
			delete document.body.dataset.audioStatus;
			delete document.body.dataset.audioLevel;
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
			<div class="lifecycle" data-testid="launch-status" aria-label="Vault connection status">
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
					<h2>Choose your route</h2>
				</div>
			</div>

			<div class="mode-list">
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

			<div class="vaultkeeper-presence" data-testid="vaultkeeper-presence" aria-hidden="true">
				<img
					src={BLACKSITE_ASSETS.character.vaultkeeperFallback}
					alt=""
					width="702"
					height="1080"
					decoding="async"
				/>
				<div class="vaultkeeper-tag">
					<span>VAULTKEEPER</span>
					<strong>LOCK CONTROL // PRESENT</strong>
				</div>
			</div>

			<div class="mode-readout">
				<div><span>Mode</span><strong>{getModeLabel(selectedMode.id, social)}</strong></div>
				<div><span>Cost</span><strong>{selectedMode.costMultiplier}× play amount</strong></div>
				<div><span>RTP</span><strong>96.20%</strong></div>
				<div><span>Max win</span><strong>10,000×</strong></div>
			</div>
		</aside>

		<section
			class="board-stage"
			data-motion-phase={presentation.motion?.phase ?? 'idle'}
			data-motion-profile={presentationTimingProfile}
			aria-label="BLACKSITE seven by seven vault grid"
		>
			<picture class="vault-environment" data-testid="vault-environment" aria-hidden="true">
				<source media="(max-width: 820px)" srcset={BLACKSITE_ASSETS.environment.vaultPortrait} />
				<img
					src={BLACKSITE_ASSETS.environment.vaultDesktop}
					alt=""
					width="1672"
					height="941"
					decoding="async"
				/>
			</picture>
			<div class="stage-heading">
				<div>
					<span>GHOST ROUTE // VAULT GRID</span>
					<strong data-testid="board-status">{boardStatus}</strong>
				</div>
				<div class="phase-chip">{getModeLabel(selectedMode.id, social)}</div>
			</div>

			<div
				class="board-frame"
				data-motion-phase={presentation.motion?.phase ?? 'idle'}
				data-motion-profile={presentationTimingProfile}
			>
				<div
					class="board"
					data-testid="board"
					data-motion-phase={presentation.motion?.phase ?? 'idle'}
					data-motion-profile={presentationTimingProfile}
					role="grid"
					aria-rowcount="7"
					aria-colcount="7"
				>
					{#each boardCells as cell}
						{@const symbol = symbolAt(cell)}
						<div
							class="cell"
							class:live={liveKeys.has(cellKey(cell))}
							class:dormant={dormantKeys.has(cellKey(cell))}
							class:sealed={sealedKeys.has(cellKey(cell))}
							class:cluster-active={activeClusterKeys.has(cellKey(cell))}
							class:motion-hit={presentation.motion?.phase === 'hit' &&
								activeMotionKeys.has(cellKey(cell))}
							class:motion-remove={presentation.motion?.phase === 'remove' &&
								activeMotionKeys.has(cellKey(cell))}
							class:motion-drop={presentation.motion?.phase === 'drop' &&
								activeMotionKeys.has(cellKey(cell))}
							class:motion-settle={presentation.motion?.phase === 'settle' &&
								activeMotionKeys.has(cellKey(cell))}
							data-column={cell.column}
							data-row={cell.row}
							data-symbol={symbol ?? ''}
							data-cluster-active={activeClusterKeys.has(cellKey(cell))}
							role="gridcell"
							aria-label={`Column ${cell.column + 1}, row ${cell.row + 1}, ${symbol ? symbolPresentation[symbol].label : 'concealed'}${activeClusterKeys.has(cellKey(cell)) ? ', active cluster' : ''}`}
						>
							{#if symbol}
								<span class="symbol-mark" aria-hidden="true">{symbolPresentation[symbol].mark}</span
								>
								<strong>{symbolPresentation[symbol].label}</strong>
							{:else}
								<span class="concealed-cell" aria-hidden="true"></span>
							{/if}
						</div>
					{/each}
				</div>
				<div class="ingress ingress-left" title="Ingress"></div>
				<div class="ingress ingress-center" title="Ingress"></div>
				<div class="ingress ingress-right" title="Ingress"></div>
				{#if presentation.activeClusters?.length > 0}
					<div class="cluster-cue" data-testid="cluster-cue" role="status">
						{#each presentation.activeClusters as cluster}
							<span
								data-symbol={cluster.symbol}
								data-size={cluster.cluster_size}
								data-access-multiplier={cluster.access_multiplier}
								data-applied-raw={cluster.applied_award_raw}
							>
								{cluster.symbol.toUpperCase()} · {cluster.cluster_size} CELLS ·
								{formatCentiMultiplier(cluster.base_payout_raw)} × {cluster.access_multiplier} ACCESS
								=
								{formatCentiMultiplier(cluster.applied_award_raw)}
							</span>
						{/each}
						<strong>STEP {formatCentiMultiplier(presentation.stepWinRaw)}</strong>
					</div>
				{/if}
			</div>

			<div class="meter-row" aria-live="polite">
				<div>
					<span>BALANCE</span>
					<strong data-testid="wallet-balance">
						{launch.kind === 'replay' ? 'READ-ONLY' : balanceText}
					</strong>
				</div>
				<div class="primary-meter">
					<span>TOTAL PLAY</span>
					<strong data-testid="total-play">
						{launch.kind === 'replay'
							? formatReplayQueryUnits(replayTotalUnits, launch.currency)
							: totalAmountText}
					</strong>
				</div>
				<div>
					<span>WIN</span>
					<strong data-testid="final-win">{finalWinText}</strong>
				</div>
			</div>
		</section>

		<aside class="panel contract-panel">
			<div class="panel-heading">
				<span aria-hidden="true">⬡</span>
				<div>
					<p>PLAY CONTROL</p>
					<h2>Vault console</h2>
				</div>
			</div>

			{#if runtimeError || launch.kind === 'error'}
				<div class="launch-card error" data-testid="launch-error" role="alert">
					<strong>{social ? 'AUTHORITATIVE_ERROR' : (runtimeError?.code ?? launch.code)}</strong>
					<span>{visibleRuntimeMessage ?? launch.message}</span>
					{#if runtimeError && (launch.kind === 'live' || launch.kind === 'replay')}
						<button type="button" data-testid="recovery-action" on:click={recoverRuntime}
							>RELOAD / RESTORE</button
						>
					{/if}
					<small>No local round or development fallback was started.</small>
				</div>
			{:else if launch.kind === 'booting'}
				<div class="launch-card pending" aria-live="polite">Inspecting launch contract…</div>
			{:else if launch.kind === 'fixture'}
				<div class="launch-card fixture">
					<strong>DEV FIXTURE / {launch.fixtureId}</strong>
					<span>Explicit development route with frozen M1 authority.</span>
					<small>Development-only content; unavailable in production builds.</small>
				</div>
			{:else if launch.kind === 'replay'}
				<div class="launch-card replay-card">
					<strong>REPLAY / {replaySnapshot.status.toUpperCase()}</strong>
					<span>
						{getModeLabel(launch.mode, social)} · {social
							? 'record verified'
							: `event ${launch.event}`} · base {formatReplayQueryUnits(
							launch.amountUnitsRaw,
							launch.currency,
						)} ·
						{replaySnapshot.replay?.costMultiplier ?? selectedMode.costMultiplier}× play factor ·
						{replaySnapshot.status === 'completed'
							? formatCentiMultiplier(replaySnapshot.replay?.packagePayoutCentiX ?? 0)
							: '—'} result
					</span>
					<small>Read-only presentation with zero wallet or event write calls.</small>
				</div>
			{:else}
				<div class="launch-card live-card">
					<strong>VAULT LINK / {liveSnapshot.status === 'ready' ? 'READY' : 'SECURING'}</strong>
					<span>{getModeLabel(selectedMode.id, social)} · {totalAmountText}</span>
					<small>Rounds and wins are securely settled by the game service.</small>
				</div>
			{/if}

			{#if launch.kind === 'live' && (displayNetPosition || displaySessionTimer)}
				<div class="jurisdiction-readouts" aria-live="polite">
					{#if displayNetPosition}
						<span
							><em>SESSION POSITION</em><strong data-testid="session-net-position"
								>{netPositionText}</strong
							></span
						>
					{/if}
					{#if displaySessionTimer}
						<span
							><em>SESSION TIME</em><strong data-testid="session-timer">{sessionTimerText}</strong
							></span
						>
					{/if}
				</div>
			{/if}

			<div class="play-summary">
				<div><span>ACTIVE MODE</span><strong>{getModeLabel(selectedMode.id, social)}</strong></div>
				<div><span>TOTAL PLAY</span><strong>{totalAmountText}</strong></div>
				<p>Select an access level and breach the vault when you are ready.</p>
			</div>

			<div class="action-stack">
				<div class="motion-controls" aria-label="Presentation speed controls">
					<button
						class="motion-action"
						data-testid="motion-mode"
						type="button"
						aria-pressed={presentationTimingProfile === 'turbo'}
						disabled={reducedMotion || presentationBusy}
						on:click={toggleMotionMode}
					>
						{reducedMotion ? 'REDUCED' : motionMode === 'turbo' ? 'TURBO' : 'NORMAL'}
					</button>
					<button
						class="motion-action"
						data-testid="skip-presentation"
						type="button"
						disabled={!presentationBusy}
						on:click={skipPresentation}>SKIP</button
					>
				</div>
				<button
					class="primary-action"
					data-testid="primary-action"
					type="button"
					disabled={actionDisabled}
					on:click={() => void activatePrimary()}
				>
					{actionLabel}
				</button>
				<button
					class="info-action"
					data-testid="info-action"
					type="button"
					on:click={() => void openRules()}
				>
					INFO / RULES
				</button>
			</div>
		</aside>
	</section>

	{#if confirmationOpen}
		<!-- Backdrop pointer dismissal complements the dialog's global Escape handler. -->
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="modal-backdrop" on:click|self={() => void closeConfirmation()}>
			<section
				class="confirmation-dialog"
				role="dialog"
				aria-modal="true"
				aria-labelledby="confirm-title"
				tabindex="-1"
				bind:this={confirmationDialog}
			>
				<span>SECOND EXPLICIT ACTION</span>
				<h2 id="confirm-title">Confirm complete play amount</h2>
				<p>
					{getModeLabel(selectedMode.id, social)} uses {selectedMode.costMultiplier}× the selected
					Play Amount.
				</p>
				<strong>{totalAmountText}</strong>
				<div class="modal-actions">
					<button
						bind:this={confirmationCancelButton}
						type="button"
						on:click={() => void closeConfirmation()}>CANCEL</button
					>
					<button class="confirm-action" type="button" on:click={confirmLivePlay}>CONFIRM</button>
				</div>
			</section>
		</div>
	{/if}

	{#if rulesOpen}
		<!-- Backdrop pointer dismissal complements the dialog's global Escape handler. -->
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="modal-backdrop" on:click|self={() => void closeRules()}>
			<section
				class="rules-dialog"
				role="dialog"
				aria-modal="true"
				aria-labelledby="rules-title"
				tabindex="-1"
				bind:this={rulesDialog}
			>
				<header>
					<div>
						<span>GAME INFORMATION</span>
						<h2 id="rules-title">BLACKSITE // BREACH</h2>
					</div>
					<button
						bind:this={rulesCloseButton}
						type="button"
						aria-label="Close game information"
						on:click={() => void closeRules()}>CLOSE</button
					>
				</header>

				<div class="rules-scroll">
					<section>
						<h3>Mode profiles</h3>
						<div class="table-wrap">
							<table>
								<thead
									><tr
										><th>Profile</th><th>Action</th><th>Play factor</th><th>RTP</th><th>Max</th></tr
									></thead
								>
								<tbody>
									{#each MODES as mode}
										<tr>
											<td>{getModeLabel(mode.id, social)}</td>
											<td class="mode-action-description">{mode.actionDescription}</td>
											<td>{mode.costMultiplier}×</td>
											<td>{(mode.targetRtp * 100).toFixed(2)}%</td>
											<td>{formatCentiMultiplier(mode.maxWinRaw)}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</section>

					<section>
						<h3>Result matrix · connected cells · multiplier</h3>
						<div class="table-wrap result-table">
							<table>
								<thead>
									<tr
										><th>Symbol</th>{#each CLUSTER_BANDS as band}<th>{band.label}</th>{/each}</tr
									>
								</thead>
								<tbody>
									{#each Object.entries(SYMBOL_PAYOUTS) as [symbol, values]}
										<tr>
											<td>{symbol.toUpperCase()}</td>
											{#each values as value}<td>{formatCentiMultiplier(value)}</td>{/each}
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</section>

					<div class="rules-copy-grid">
						<section>
							<h3>How it works</h3>
							{#each RULES_CONTRACT.mechanic as line}<p>{line}</p>{/each}
						</section>
						<section>
							<h3>Blackout Protocol</h3>
							{#each RULES_CONTRACT.feature as line}<p>{line}</p>{/each}
						</section>
						<section>
							<h3>Controls</h3>
							{#each RULES_CONTRACT.controls as line}<p>{line}</p>{/each}
						</section>
					</div>

					<section class="disclaimer">
						<h3>Disclaimer</h3>
						<p>{legalDisclaimer}</p>
					</section>
				</div>
			</section>
		</div>
	{/if}
</main>

<style>
	:global(*) {
		box-sizing: border-box;
	}

	:global(html),
	:global(body) {
		width: 100%;
		height: 100%;
		margin: 0;
		overflow: hidden;
		overscroll-behavior: none;
		background: #081015;
		color: #dce8ea;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		touch-action: manipulation;
	}

	:global(button),
	:global(select) {
		font: inherit;
	}

	.app-shell {
		position: fixed;
		inset: 0;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		gap: clamp(8px, 1.2vw, 16px);
		padding: max(10px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right))
			max(10px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left));
		background:
			radial-gradient(circle at 50% 44%, rgba(38, 101, 108, 0.16), transparent 38%),
			linear-gradient(rgba(69, 114, 121, 0.055) 1px, transparent 1px),
			linear-gradient(90deg, rgba(69, 114, 121, 0.055) 1px, transparent 1px), #081015;
		background-size: 32px 32px;
	}

	.masthead {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 18px;
		min-width: 0;
		border-bottom: 1px solid #29434a;
		padding: 0 4px 10px;
	}

	.identity {
		min-width: 0;
	}

	.eyebrow,
	.panel-heading p,
	.stage-heading span,
	.meter-row span,
	.mode-readout span,
	.play-summary span {
		color: #6f939a;
		font-size: clamp(8px, 0.65vw, 11px);
		letter-spacing: 0.13em;
		text-transform: uppercase;
	}

	h1 {
		margin: 2px 0 0;
		font-family: Arial, Helvetica, sans-serif;
		font-size: clamp(21px, 2.5vw, 40px);
		font-weight: 800;
		letter-spacing: -0.045em;
		line-height: 0.95;
	}

	h1 span {
		color: #f05c55;
		font-weight: 300;
	}

	.lifecycle {
		display: flex;
		align-items: center;
		gap: 8px;
		color: #a7bdc1;
		font-size: clamp(8px, 0.75vw, 11px);
		letter-spacing: 0.08em;
		text-align: right;
	}

	.masthead-actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		min-width: 0;
		gap: 10px;
	}

	.sound-action {
		min-width: 94px;
		min-height: 44px;
		padding: 0 10px;
		border: 1px solid #48646b;
		background: #0a181d;
		color: #a9c0c4;
		font-size: 9px;
		font-weight: 800;
		letter-spacing: 0.07em;
		white-space: nowrap;
		cursor: pointer;
	}

	.sound-action[data-audio-status='running'] {
		border-color: #6d9994;
		color: #bce2dc;
	}

	.sound-action[aria-pressed='true'] {
		border-color: #9a5552;
		color: #e69a95;
	}

	.sound-action:focus-visible {
		outline: 3px solid #efc06a;
		outline-offset: 2px;
	}

	.pulse {
		width: 7px;
		height: 7px;
		flex: 0 0 auto;
		border-radius: 50%;
		background: #efc06a;
		box-shadow: 0 0 10px #efc06a;
	}

	.pulse.error-pulse {
		background: #f05c55;
		box-shadow: 0 0 10px #f05c55;
	}

	.studio {
		min-height: 0;
		display: grid;
		grid-template-columns: minmax(190px, 0.72fr) minmax(320px, 1.6fr) minmax(210px, 0.8fr);
		gap: clamp(8px, 1vw, 14px);
	}

	.panel,
	.board-stage {
		min-width: 0;
		min-height: 0;
		border: 1px solid #29434a;
		background: linear-gradient(145deg, rgba(12, 27, 33, 0.96), rgba(7, 16, 20, 0.96));
		box-shadow:
			0 14px 44px rgba(0, 0, 0, 0.34),
			inset 0 1px rgba(154, 197, 202, 0.04);
	}

	.panel {
		display: flex;
		flex-direction: column;
		gap: clamp(9px, 1.2vh, 16px);
		padding: clamp(10px, 1.25vw, 18px);
		overflow: hidden;
	}

	.panel-heading {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.panel-heading > span {
		display: grid;
		width: 30px;
		height: 30px;
		place-items: center;
		border: 1px solid #3c626b;
		color: #8db1b8;
		font-size: 10px;
	}

	.panel-heading p,
	.panel-heading h2 {
		margin: 0;
	}

	.panel-heading h2 {
		margin-top: 2px;
		font-family: Arial, Helvetica, sans-serif;
		font-size: clamp(13px, 1.15vw, 18px);
	}

	.mode-list {
		display: grid;
		gap: 7px;
	}

	.mode-list button {
		position: relative;
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 2px 10px;
		min-height: 48px;
		padding: 8px 10px;
		border: 1px solid #29434a;
		background: #0d1b20;
		color: #b8cbcf;
		text-align: left;
		cursor: pointer;
	}

	.mode-list button:hover,
	.mode-list button.selected {
		border-color: #e05b55;
		background: linear-gradient(90deg, rgba(224, 91, 85, 0.13), #182328 72%);
	}

	.mode-list button:focus-visible {
		z-index: 1;
		border-color: #efc06a;
		outline: 3px solid #efc06a;
		outline-offset: 2px;
	}

	.mode-list button:disabled {
		cursor: not-allowed;
		opacity: 0.78;
	}

	.mode-list button.selected::before {
		position: absolute;
		inset: -1px auto -1px -1px;
		width: 3px;
		background: #f05c55;
		content: '';
	}

	.mode-list strong {
		grid-row: span 2;
		align-self: center;
		color: #efc06a;
		font-size: clamp(14px, 1.3vw, 20px);
	}

	.amount-control {
		display: grid;
		gap: 5px;
		color: #6f939a;
		font-size: 9px;
		letter-spacing: 0.11em;
		text-transform: uppercase;
	}

	.amount-control select {
		width: 100%;
		min-width: 0;
		min-height: 44px;
		padding: 7px 30px;
		border: 1px solid #3c626b;
		border-radius: 0;
		background: #0d1b20;
		color: #dce8ea;
		text-align: center;
		text-align-last: center;
		cursor: pointer;
	}

	.amount-control select:focus-visible {
		border-color: #efc06a;
		outline: 3px solid #efc06a;
		outline-offset: 2px;
	}

	.amount-control select:disabled {
		cursor: not-allowed;
		opacity: 0.72;
	}

	.amount-range {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		min-height: 44px;
		gap: 8px;
		padding: 6px 8px;
		border: 1px solid #3c626b;
		background: #0d1b20;
	}

	.amount-range input {
		width: 100%;
		min-width: 70px;
		accent-color: #d55b55;
		cursor: pointer;
	}

	.amount-range input:focus-visible {
		outline: 3px solid #efc06a;
		outline-offset: 3px;
	}

	.amount-range input:disabled {
		cursor: not-allowed;
		opacity: 0.72;
	}

	.amount-range output {
		color: #dce8ea;
		font-size: 10px;
		letter-spacing: 0;
		text-transform: none;
		white-space: nowrap;
	}

	.mode-readout {
		display: grid;
		gap: 1px;
		margin-top: auto;
		background: #29434a;
		border: 1px solid #29434a;
	}

	.vaultkeeper-presence {
		position: relative;
		display: grid;
		flex: 1 1 150px;
		min-height: 120px;
		place-items: end center;
		overflow: hidden;
		border: 1px solid #29434a;
		background: #081317;
		isolation: isolate;
		pointer-events: none;
	}

	.vaultkeeper-presence::before {
		position: absolute;
		inset: 14% 8% 8%;
		z-index: -1;
		border: 1px solid rgba(77, 127, 134, 0.28);
		border-radius: 50% 50% 12px 12px;
		box-shadow: inset 0 0 36px rgba(60, 111, 117, 0.12);
		content: '';
	}

	.vaultkeeper-presence img {
		position: absolute;
		inset: 8px 10px 18px;
		display: block;
		width: calc(100% - 20px);
		height: calc(100% - 26px);
		object-fit: contain;
		object-position: center bottom;
		filter: drop-shadow(0 12px 16px rgba(0, 0, 0, 0.6));
	}

	.vaultkeeper-tag {
		position: absolute;
		inset: auto 7px 7px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 5px 7px;
		border: 1px solid rgba(93, 144, 151, 0.5);
		background: rgba(5, 15, 19, 0.86);
		color: #789ba1;
		font-size: 7px;
		letter-spacing: 0.1em;
	}

	.vaultkeeper-tag strong {
		color: #d9b86f;
		font-size: 7px;
		font-weight: 600;
		text-align: right;
	}

	.mode-readout > div {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		min-width: 0;
		padding: 7px 9px;
		background: #0b171c;
	}

	.mode-readout strong {
		overflow: hidden;
		color: #c8d7da;
		font-size: clamp(9px, 0.72vw, 11px);
		text-align: right;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.board-stage {
		position: relative;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		gap: clamp(8px, 1vh, 12px);
		padding: clamp(9px, 1vw, 15px);
		overflow: hidden;
		background: #071014;
		isolation: isolate;
	}

	.vault-environment {
		position: absolute;
		inset: 0;
		z-index: 0;
		display: block;
		pointer-events: none;
	}

	.vault-environment img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center;
	}

	.stage-heading,
	.board-frame,
	.meter-row {
		position: relative;
		z-index: 1;
	}

	.stage-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.stage-heading > div:first-child {
		display: grid;
		gap: 2px;
		min-width: 0;
	}

	.stage-heading strong {
		overflow: hidden;
		font-size: clamp(9px, 0.82vw, 12px);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.phase-chip {
		flex: 0 0 auto;
		padding: 5px 9px;
		border: 1px solid #506d73;
		color: #9eb3b7;
		font-size: 9px;
		letter-spacing: 0.12em;
	}

	.board-frame {
		position: relative;
		align-self: center;
		justify-self: center;
		width: min(100%, 68vh);
		max-height: 100%;
		aspect-ratio: 1;
		padding: clamp(5px, 0.6vw, 9px);
		border: 1px solid #63777a;
		border-radius: clamp(12px, 1.2vw, 20px);
		background: linear-gradient(145deg, #17262a, #050b0e 24%, #071015 76%, #18282c);
		box-shadow:
			0 18px 45px rgba(0, 0, 0, 0.42),
			inset 0 0 0 3px #0e2228,
			inset 0 0 28px rgba(84, 142, 148, 0.08);
	}

	.board-frame::before,
	.board-frame::after {
		position: absolute;
		inset: 3%;
		z-index: 4;
		border-radius: inherit;
		content: '';
		opacity: 0;
		pointer-events: none;
	}

	.board-frame::before {
		border: 2px solid rgba(216, 184, 111, 0.82);
		background:
			radial-gradient(circle at center, transparent 0 31%, rgba(216, 184, 111, 0.42) 31.5% 32%, transparent 32.5%),
			repeating-conic-gradient(from 0deg, rgba(216, 184, 111, 0.7) 0 2deg, transparent 2deg 22.5deg);
		box-shadow:
			inset 0 0 55px rgba(216, 184, 111, 0.18),
			0 0 34px rgba(216, 184, 111, 0.2);
	}

	.board-frame::after {
		inset: 0;
		background: radial-gradient(circle, transparent 18%, rgba(1, 5, 7, 0.82) 72%);
	}

	.board-frame[data-motion-phase='spin'] .board {
		animation: vault-prime 160ms ease-out both;
	}

	.board-frame[data-motion-phase='reveal'] .cell {
		animation: board-reveal 180ms ease-out both;
	}

	.board-frame[data-motion-phase='anticipation']::before {
		animation: lock-anticipation 600ms ease-in-out both;
	}

	.board-frame[data-motion-phase='blackout-enter']::before {
		animation: lock-engage 1000ms cubic-bezier(0.16, 0.72, 0.18, 1) both;
	}

	.board-frame[data-motion-phase='blackout-enter']::after {
		animation: blackout-shutter 1000ms ease-in-out both;
	}

	.board-frame[data-motion-phase='blackout-exit']::before {
		animation: lock-release 1000ms ease-in-out both;
	}

	.board-frame[data-motion-phase='blackout-exit']::after {
		animation: blackout-release 1000ms ease-in-out both;
	}

	.board-stage[data-motion-phase='blackout-enter'] .vault-environment,
	.board-stage[data-motion-phase='blackout-exit'] .vault-environment {
		animation: environment-lock-pulse 1000ms ease-in-out both;
	}

	.board {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		grid-template-rows: repeat(7, 1fr);
		gap: clamp(2px, 0.28vw, 5px);
		width: 100%;
		height: 100%;
	}

	.cell {
		position: relative;
		display: grid;
		place-items: center;
		min-width: 0;
		min-height: 0;
		border: 1px solid #31494f;
		border-radius: clamp(3px, 0.42vw, 8px);
		background: linear-gradient(145deg, #14272c, #0c191d);
		color: #8fa8ad;
		transition:
			border-color 140ms ease,
			background 140ms ease,
			color 140ms ease,
			filter 140ms ease,
			opacity 140ms ease,
			transform 140ms ease;
		transform-origin: center;
	}

	.cell.motion-hit {
		z-index: 2;
		border-color: #f2c36e;
		animation: cluster-hit 280ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
		background: linear-gradient(145deg, #46381e, #14282c);
		filter: brightness(1.3) saturate(1.18);
	}

	.cell.motion-remove {
		z-index: 2;
		animation: cluster-remove 150ms ease-in both;
	}

	.cell.motion-drop {
		animation: symbol-drop 250ms cubic-bezier(0.18, 0.72, 0.2, 1) both;
	}

	.cell.motion-settle {
		animation: symbol-settle 90ms ease-out both;
	}

	.board[data-motion-profile='turbo'] .cell.motion-hit {
		animation-duration: 110ms;
	}

	.board[data-motion-profile='turbo'] .cell.motion-remove {
		animation-duration: 55ms;
	}

	.board[data-motion-profile='turbo'] .cell.motion-drop {
		animation-duration: 105ms;
	}

	.board[data-motion-profile='turbo'] .cell.motion-settle {
		animation-duration: 35ms;
	}

	.board-frame[data-motion-profile='turbo'][data-motion-phase='spin'] .board,
	.board-frame[data-motion-profile='turbo'][data-motion-phase='reveal'] .cell {
		animation-duration: 70ms;
		animation-delay: 0ms;
	}

	.board-frame[data-motion-profile='turbo'][data-motion-phase='anticipation']::before {
		animation-duration: 180ms;
	}

	.board-frame[data-motion-profile='turbo'][data-motion-phase^='blackout-']::before,
	.board-frame[data-motion-profile='turbo'][data-motion-phase^='blackout-']::after,
	.board-stage[data-motion-profile='turbo'][data-motion-phase^='blackout-'] .vault-environment {
		animation-duration: 360ms;
	}

	.board-frame[data-motion-profile='reduced']::before,
	.board-frame[data-motion-profile='reduced']::after,
	.board-frame[data-motion-profile='reduced'] .board,
	.board-frame[data-motion-profile='reduced'] .cell,
	.board-stage[data-motion-profile='reduced'] .vault-environment {
		animation: none !important;
	}

	@keyframes vault-prime {
		0% { filter: brightness(0.76); transform: scale(0.992); }
		100% { filter: brightness(1); transform: scale(1); }
	}

	@keyframes board-reveal {
		0% { filter: brightness(0.58); opacity: 0.42; transform: translateY(-5%); }
		100% { filter: brightness(1); opacity: 1; transform: translateY(0); }
	}

	@keyframes lock-anticipation {
		0%, 100% { opacity: 0; transform: rotate(-3deg) scale(0.92); }
		35%, 72% { opacity: 0.78; }
		52% { opacity: 1; transform: rotate(1deg) scale(1); }
	}

	@keyframes lock-engage {
		0% { opacity: 0; transform: rotate(-20deg) scale(1.18); }
		38% { opacity: 0.96; }
		72% { opacity: 0.72; transform: rotate(0deg) scale(0.98); }
		100% { opacity: 0; transform: rotate(2deg) scale(1); }
	}

	@keyframes blackout-shutter {
		0%, 100% { opacity: 0; }
		48% { opacity: 0.92; }
		70% { opacity: 0.44; }
	}

	@keyframes lock-release {
		0% { opacity: 0; transform: rotate(0deg) scale(0.98); }
		35% { opacity: 0.78; }
		100% { opacity: 0; transform: rotate(18deg) scale(1.14); }
	}

	@keyframes blackout-release {
		0%, 100% { opacity: 0; }
		32% { opacity: 0.72; }
	}

	@keyframes environment-lock-pulse {
		0%, 100% { filter: brightness(1) saturate(1); }
		48% { filter: brightness(0.42) saturate(0.72); }
	}

	@keyframes cluster-hit {
		0% {
			transform: scale(1);
		}
		52% {
			transform: scale(1.075);
		}
		100% {
			transform: scale(1.025);
		}
	}

	@keyframes cluster-remove {
		0% {
			opacity: 1;
			transform: scale(1.025);
		}
		100% {
			opacity: 0;
			transform: scale(0.72);
		}
	}

	@keyframes symbol-drop {
		0% {
			opacity: 0;
			transform: translateY(-44%) scale(0.92);
		}
		72% {
			opacity: 1;
			transform: translateY(4%) scale(1.015);
		}
		100% {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	@keyframes symbol-settle {
		0% {
			transform: translateY(3%);
		}
		100% {
			transform: translateY(0);
		}
	}

	.cell::after {
		position: absolute;
		inset: 7%;
		border: 1px solid rgba(129, 163, 170, 0.1);
		border-radius: inherit;
		content: '';
	}

	.cell strong {
		position: relative;
		z-index: 1;
		font-size: clamp(6px, 0.55vw, 9px);
		letter-spacing: 0.08em;
	}

	.symbol-mark {
		position: relative;
		z-index: 1;
		color: var(--symbol-color, #a8c2c7);
		font-family: Arial, Helvetica, sans-serif;
		font-size: clamp(14px, 2.15vw, 34px);
		font-weight: 800;
		line-height: 0.8;
		text-shadow: 0 0 14px color-mix(in srgb, var(--symbol-color, #a8c2c7) 35%, transparent);
	}

	.concealed-cell {
		position: relative;
		z-index: 1;
		width: 18%;
		aspect-ratio: 1;
		border: 1px solid #547178;
		transform: rotate(45deg);
		opacity: 0.5;
	}

	.cell[data-symbol='byte'] {
		--symbol-color: #78d9df;
	}

	.cell[data-symbol='relay'] {
		--symbol-color: #f0c26d;
	}

	.cell[data-symbol='proxy'] {
		--symbol-color: #81a8e8;
	}

	.cell[data-symbol='cipher'] {
		--symbol-color: #d49be8;
	}

	.cell[data-symbol='daemon'] {
		--symbol-color: #ef7d72;
	}

	.cell[data-symbol='vault'] {
		--symbol-color: #f5d888;
	}

	.cell.sealed {
		background: #111c21;
	}

	.cell.dormant {
		border-color: #8d6b38;
		background: #302718;
		color: #d3aa62;
	}

	.cell.live {
		border-color: #d55b55;
		background: #3a1f20;
		color: #ffd0c8;
		box-shadow: inset 0 0 14px rgba(240, 92, 85, 0.22);
	}

	.cell.cluster-active {
		z-index: 1;
		border-color: #f4d06f;
		background: #4a3717;
		color: #fff0bd;
		box-shadow:
			inset 0 0 18px rgba(244, 208, 111, 0.42),
			0 0 8px rgba(244, 208, 111, 0.36);
	}

	.cluster-cue {
		position: absolute;
		z-index: 3;
		top: clamp(6px, 1vw, 12px);
		right: clamp(6px, 1vw, 12px);
		display: grid;
		max-width: calc(100% - 12px);
		gap: 3px;
		padding: 7px 9px;
		border: 1px solid #d5ad58;
		background: rgba(24, 20, 12, 0.94);
		color: #f7df9e;
		font-size: clamp(7px, 0.62vw, 10px);
		box-shadow: 0 7px 24px rgba(0, 0, 0, 0.42);
		pointer-events: none;
	}

	.cluster-cue strong {
		color: #fff0bd;
		text-align: right;
	}

	.ingress {
		position: absolute;
		bottom: -5px;
		width: 5px;
		height: 10px;
		background: #d95d56;
		box-shadow: 0 0 8px rgba(240, 92, 85, 0.65);
	}

	.ingress-left {
		left: 36%;
	}

	.ingress-center {
		left: 50%;
	}

	.ingress-right {
		left: 64%;
	}

	.meter-row {
		display: grid;
		grid-template-columns: 1fr 1.4fr 0.7fr;
		gap: 7px;
	}

	.meter-row > div {
		display: grid;
		gap: 2px;
		min-width: 0;
		padding: 7px 9px;
		border: 1px solid #29434a;
		background: #0b171c;
		text-align: center;
	}

	.meter-row strong {
		overflow: hidden;
		font-size: clamp(9px, 0.8vw, 13px);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.meter-row .primary-meter {
		border-color: #76504a;
		text-align: center;
	}

	.primary-meter strong {
		color: #f1c170;
	}

	.launch-card {
		display: grid;
		gap: 6px;
		padding: 10px;
		border: 1px solid #4c6267;
		background: #101d21;
		font-size: clamp(9px, 0.72vw, 11px);
		line-height: 1.35;
	}

	.launch-card strong {
		letter-spacing: 0.06em;
	}

	.launch-card span {
		color: #a9bdc1;
	}

	.launch-card small {
		color: #6e8b91;
	}

	.launch-card.error {
		border-color: #a94743;
		background: #2b1718;
	}

	.launch-card.error strong {
		color: #ff928b;
	}

	.launch-card.error button {
		min-height: 44px;
		padding: 0 12px;
		border: 1px solid #d86f69;
		background: #32191a;
		color: #ffd0cc;
		font-weight: 700;
		letter-spacing: 0.06em;
		cursor: pointer;
	}

	.launch-card.error button:hover,
	.launch-card.error button:focus-visible {
		border-color: #ffaaa4;
		outline: 2px solid rgba(255, 170, 164, 0.4);
		outline-offset: 2px;
	}

	.launch-card.fixture {
		border-color: #557b66;
		background: #13221b;
	}

	.launch-card.fixture strong {
		color: #93c9a8;
	}

	.launch-card.live-card {
		border-color: #527783;
		background: #102129;
	}

	.launch-card.live-card strong,
	.launch-card.replay-card strong {
		color: #9bc6cd;
	}

	.play-summary {
		display: grid;
		gap: 1px;
		border: 1px solid #29434a;
		background: #29434a;
	}

	.play-summary > div {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 9px 10px;
		background: #0b171c;
	}

	.play-summary strong {
		overflow: hidden;
		color: #dce8ea;
		font-size: clamp(9px, 0.72vw, 11px);
		text-align: right;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.play-summary p {
		margin: 0;
		padding: 12px 10px;
		background: #0b171c;
		color: #78969c;
		font-size: 9px;
		line-height: 1.5;
	}

	.jurisdiction-readouts {
		display: flex;
		grid-column: 1 / -1;
		gap: 6px;
		min-width: 0;
	}

	.jurisdiction-readouts > span {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-width: 0;
		gap: 8px;
		padding: 5px 7px;
		border: 1px solid #355761;
		background: #0b1920;
	}

	.jurisdiction-readouts em {
		color: #6f939a;
		font-size: 8px;
		font-style: normal;
		letter-spacing: 0.08em;
	}

	.jurisdiction-readouts strong {
		color: #d9e6e8;
		font-size: 9px;
		white-space: nowrap;
	}

	.action-stack {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 7px;
		margin-top: auto;
	}

	.motion-controls {
		grid-row: 2;
		grid-column: 1;
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 5px;
	}

	.motion-action {
		min-width: 0;
		min-height: 44px;
		padding: 0 4px;
		border: 1px solid #48646b;
		background: #0a181d;
		color: #9fb6ba;
		font-size: clamp(7px, 0.58vw, 9px);
		font-weight: 700;
		letter-spacing: 0.05em;
		cursor: pointer;
	}

	.motion-action[aria-pressed='true'] {
		border-color: #efc06a;
		color: #efc06a;
	}

	.motion-action:focus-visible {
		outline: 3px solid #efc06a;
		outline-offset: 2px;
	}

	.motion-action:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.primary-action {
		grid-row: 1;
		grid-column: 1 / -1;
		min-height: 44px;
		border: 1px solid #d55b55;
		background: #d55b55;
		color: #0a1114;
		font-size: clamp(9px, 0.8vw, 12px);
		font-weight: 800;
		letter-spacing: 0.08em;
		cursor: pointer;
	}

	.primary-action:focus-visible {
		outline: 3px solid #efc06a;
		outline-offset: 2px;
	}

	.primary-action:disabled {
		border-color: #354b51;
		background: #17272c;
		color: #6d858b;
		cursor: not-allowed;
	}

	.info-action {
		grid-row: 2;
		grid-column: 2;
		min-height: 44px;
		border: 1px solid #48646b;
		background: #0d1b20;
		color: #aac0c4;
		font-size: clamp(9px, 0.75vw, 11px);
		font-weight: 700;
		letter-spacing: 0.08em;
		cursor: pointer;
	}

	.info-action:hover,
	.info-action:focus-visible {
		border-color: #efc06a;
		color: #f0d6a5;
	}

	.info-action:focus-visible {
		outline: 3px solid #efc06a;
		outline-offset: 2px;
	}

	.modal-backdrop {
		position: fixed;
		z-index: 20;
		inset: 0;
		display: grid;
		place-items: center;
		padding: max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right))
			max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
		background: rgba(3, 8, 11, 0.88);
		backdrop-filter: blur(5px);
	}

	.confirmation-dialog,
	.rules-dialog {
		width: min(100%, 940px);
		border: 1px solid #48646b;
		background: #0b171c;
		box-shadow: 0 24px 80px rgba(0, 0, 0, 0.62);
	}

	.confirmation-dialog {
		display: grid;
		gap: 12px;
		width: min(100%, 440px);
		padding: clamp(18px, 3vw, 30px);
		text-align: center;
	}

	.confirmation-dialog > span,
	.rules-dialog header span {
		color: #efc06a;
		font-size: 10px;
		letter-spacing: 0.13em;
	}

	.confirmation-dialog h2,
	.confirmation-dialog p,
	.rules-dialog h2,
	.rules-dialog h3,
	.rules-dialog p {
		margin: 0;
	}

	.confirmation-dialog h2,
	.rules-dialog h2,
	.rules-dialog h3 {
		font-family: Arial, Helvetica, sans-serif;
	}

	.confirmation-dialog p {
		color: #9db4b9;
		font-size: 12px;
		line-height: 1.55;
	}

	.confirmation-dialog > strong {
		color: #f1c170;
		font-size: clamp(22px, 5vw, 34px);
	}

	.modal-actions {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 8px;
	}

	.modal-actions button,
	.rules-dialog header button {
		min-height: 44px;
		border: 1px solid #48646b;
		background: #101f25;
		color: #b9cccf;
		font-weight: 700;
		cursor: pointer;
	}

	.modal-actions button.confirm-action {
		border-color: #d55b55;
		background: #d55b55;
		color: #091115;
	}

	.modal-actions button:focus-visible,
	.rules-dialog header button:focus-visible {
		outline: 2px solid #f4d19b;
		outline-offset: 2px;
	}

	.rules-dialog {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		max-height: calc(100vh - 24px);
	}

	.rules-dialog > header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 14px 16px;
		border-bottom: 1px solid #29434a;
	}

	.rules-dialog h2 {
		margin-top: 2px;
		font-size: clamp(18px, 2.5vw, 28px);
	}

	.rules-dialog header button {
		min-width: 74px;
		padding: 0 12px;
	}

	.rules-scroll {
		display: grid;
		gap: 18px;
		overflow: auto;
		padding: 16px;
		overscroll-behavior: contain;
	}

	.rules-scroll section {
		display: grid;
		gap: 8px;
	}

	.rules-dialog h3 {
		color: #d5e1e3;
		font-size: 14px;
	}

	.table-wrap {
		overflow-x: auto;
		border: 1px solid #29434a;
	}

	.rules-dialog table {
		width: 100%;
		border-collapse: collapse;
		font-size: 10px;
		white-space: nowrap;
	}

	.rules-dialog th,
	.rules-dialog td {
		padding: 7px 8px;
		border: 1px solid #29434a;
		text-align: right;
	}

	.rules-dialog th:first-child,
	.rules-dialog td:first-child {
		position: sticky;
		left: 0;
		background: #0d1b20;
		text-align: left;
	}

	.rules-dialog .mode-action-description {
		min-width: 280px;
		white-space: normal;
		text-align: left;
	}

	.rules-dialog th {
		color: #88a5ab;
		font-weight: 600;
	}

	.result-table td:not(:first-child) {
		color: #efc06a;
	}

	.rules-copy-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 12px;
	}

	.rules-copy-grid section,
	.disclaimer {
		align-content: start;
		padding: 12px;
		border: 1px solid #29434a;
		background: #0d1b20;
	}

	.rules-dialog p {
		color: #9eb3b7;
		font-size: 10px;
		line-height: 1.5;
	}

	@media (max-width: 820px) {
		.app-shell {
			gap: 6px;
			padding: max(6px, env(safe-area-inset-top)) max(6px, env(safe-area-inset-right))
				max(6px, env(safe-area-inset-bottom)) max(6px, env(safe-area-inset-left));
		}

		.masthead {
			align-items: center;
			padding-bottom: 6px;
		}

		.eyebrow {
			display: none;
		}

		.lifecycle {
			gap: 0;
			font-size: 0;
		}

		.masthead-actions {
			flex: 0 0 auto;
		}

		.sound-action {
			min-width: 88px;
		}

		.studio {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: auto minmax(0, 1fr) auto;
			gap: 6px;
		}

		.panel {
			gap: 6px;
			padding: 7px;
		}

		.mode-panel {
			order: 1;
		}

		.board-stage {
			order: 2;
			padding: 6px;
		}

		.contract-panel {
			order: 3;
		}

		.panel-heading,
		.vaultkeeper-presence,
		.mode-readout,
		.play-summary {
			display: none;
		}

		.mode-list {
			grid-template-columns: repeat(3, 1fr);
			gap: 5px;
		}

		.mode-list button {
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: 2px;
			min-height: 44px;
			padding: 3px 7px;
			text-align: center;
		}

		.mode-list button span {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 100%;
			min-height: 2.3em;
			font-size: 9px;
			line-height: 1.15;
			white-space: normal;
		}

		.mode-list strong {
			font-size: 14px;
			line-height: 1;
		}

		.amount-control {
			grid-template-columns: auto minmax(130px, 1fr);
			align-items: center;
			gap: 8px;
		}

		.board-frame {
			width: min(92vw, 51vh);
		}

		.cell strong {
			display: none;
		}

		.symbol-mark {
			font-size: clamp(13px, 4.2vw, 24px);
		}

		.launch-card {
			grid-template-columns: auto 1fr;
			gap: 4px 8px;
			padding: 6px 8px;
		}

		.launch-card small {
			display: none;
		}

		.jurisdiction-readouts {
			flex-wrap: wrap;
		}

		.jurisdiction-readouts > span {
			flex: 1 1 150px;
		}

		.contract-panel {
			display: grid;
			grid-template-columns: minmax(0, 1fr) minmax(145px, 0.62fr);
			align-items: stretch;
		}

		.action-stack {
			margin: 0;
		}
	}

	@media (max-width: 480px), (max-height: 560px) {
		h1 {
			font-size: 18px;
		}

		.lifecycle {
			font-size: 7px;
		}

		.stage-heading strong,
		.phase-chip {
			display: none;
		}

		.meter-row {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}

		.board-frame {
			width: min(91vw, 58vh);
		}

		.primary-action {
			padding: 0 10px;
		}

		.rules-copy-grid {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 480px) {
		.board-frame {
			width: min(91vw, 38vh);
		}

		.action-stack {
			grid-template-columns: repeat(3, minmax(44px, 1fr));
			gap: 4px;
		}

		.motion-controls {
			grid-column: 1 / 3;
			gap: 4px;
		}

		.info-action {
			grid-column: 3;
		}
	}

	@media (min-width: 821px) and (max-height: 560px) {
		.app-shell {
			gap: 6px;
			padding: max(6px, env(safe-area-inset-top)) max(6px, env(safe-area-inset-right))
				max(6px, env(safe-area-inset-bottom)) max(6px, env(safe-area-inset-left));
		}

		.masthead {
			align-items: center;
			padding-bottom: 5px;
		}

		.eyebrow,
		.panel-heading,
		.vaultkeeper-presence,
		.mode-readout,
		.play-summary,
		.launch-card small {
			display: none;
		}

		.panel,
		.board-stage {
			gap: 5px;
			padding: 6px;
		}

		.mode-list {
			gap: 5px;
		}

		.mode-list button {
			min-height: 44px;
			padding: 3px 7px;
			align-items: center;
			text-align: center;
		}

		.amount-control {
			gap: 3px;
		}

		.launch-card {
			padding: 7px;
		}

		.action-stack {
			gap: 5px;
			margin-top: 0;
		}

		.board-frame {
			width: min(100%, 58vh);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.cell {
			animation: none !important;
			transition: none;
		}
	}
</style>
