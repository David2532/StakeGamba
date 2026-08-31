<script>
	import { onMount, tick } from 'svelte';
	import { BLACKSITE_ASSETS } from '../lib/assets/blacksite-assets.js';
	import {
		OPERATOR_ANIMATION_CATALOG,
		OPERATOR_FX_CATALOG,
	} from '../lib/assets/operator-animation-assets.js';
	import {
		PENGUIN_OPERATOR_ASSETS,
		penguinStateForOperatorReaction,
	} from '../lib/assets/penguin-operator-assets.js';
	import CinematicStatusSurface from '../lib/components/CinematicStatusSurface.svelte';
	import BlacksiteAtmosphere from '../lib/components/BlacksiteAtmosphere.svelte';
	import BlacksiteBootSequence from '../lib/components/BlacksiteBootSequence.svelte';
	import HudIcon from '../lib/components/HudIcon.svelte';
	import FeatureHudSurface from '../lib/components/FeatureHudSurface.svelte';
	import PanelStateArt from '../lib/components/PanelStateArt.svelte';
	import PenguinOperator from '../lib/components/PenguinOperator.svelte';
	import ReelSpinOverlay from '../lib/components/ReelSpinOverlay.svelte';
	import UiGlyph from '../lib/components/UiGlyph.svelte';
	import UiSurface from '../lib/components/UiSurface.svelte';
	import VaultCinematic from '../lib/components/VaultCinematic.svelte';
	import {
		CANDIDATE_FINGERPRINT_SHA256,
		EVENT_SCHEMA_SHA256,
		MODES,
		getMode,
		getModeActionDescription,
		getModeLabel,
	} from '../lib/contracts/modes.js';
	import {
		LINE_LENGTHS,
		RULES_CONTRACT,
		SYMBOL_PAYOUTS,
		getRulesDisclaimer,
		getRulesInterfaceCopy,
	} from '../lib/contracts/rules.js';
	import { PAYLINES, SYMBOL_DISPLAY_NAMES } from '../lib/contracts/reels.js';
	import { missionBriefingControls } from '../lib/contracts/mission-briefing.js';
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
	import { GameEventAdapter } from '../lib/runtime/game-event-adapter.js';
	import {
		formatBalanceApi,
		formatCentiMultiplier,
		formatExactApi,
		formatReplayQueryUnits,
		formatSignedExactApi,
	} from '../lib/runtime/display-money.js';
	import { resolveLaunchMode } from '../lib/runtime/launch-mode.js';
	import { LiveOutcomeStreakTracker } from '../lib/runtime/live-outcome-streak.js';
	import {
		OPERATOR_SEQUENCE,
		OperatorAnimationDirector,
	} from '../lib/runtime/operator-animation-director.js';
	import { StandaloneFxDirector } from '../lib/runtime/standalone-fx-director.js';
	import { BlacksiteAudioDirector } from '../lib/runtime/blacksite-audio-director.js';
	import { BOOT_SEQUENCE_STATE } from '../lib/runtime/boot-sequence-director.js';
	import { DevVaultMotionDirector } from '../lib/runtime/dev-vault-motion-director.js';
	import { DisplayRefreshMonitor } from '../lib/runtime/display-refresh-monitor.js';
	import { VaultCinematicDirector, VAULT_STATE } from '../lib/runtime/vault-cinematic-director.js';
	import {
		PresentationDirector,
		createInitialPresentationState,
		planPresentationRestore,
	} from '../lib/runtime/presentation-director.js';

	const boardCells = Array.from({ length: 15 }, (_, index) => ({
		column: index % 5,
		row: Math.floor(index / 5),
	}));
	const attractBoard = Object.freeze([
		Object.freeze(['operative', 'night_vision_goggles', 'ten']),
		Object.freeze(['encrypted_drive', 'a', 'supply_crate']),
		Object.freeze(['ghost_wild', 'classified_folder', 'q']),
		Object.freeze(['tactical_radio', 'k', 'night_vision_goggles']),
		Object.freeze(['supply_crate', 'j', 'encrypted_drive']),
	]);
	const symbolCodes = Object.freeze({
		operative: 'OPERATIVE',
		encrypted_drive: 'ENCRYPTED',
		tactical_radio: 'RADIO',
		classified_folder: 'CLASSIFIED',
		night_vision_goggles: 'NIGHT VISION',
		supply_crate: 'SUPPLY CRATE',
		a: 'A',
		k: 'K',
		q: 'Q',
		j: 'J',
		ten: '10',
		ghost_wild: 'WILD',
		breach: 'VAULT',
	});
	const rankGlyphSymbolIds = new Set(['a', 'k', 'q', 'j', 'ten']);
	const GUIDE_TABS = Object.freeze([
		Object.freeze({ id: 'overview', label: 'QUICK START' }),
		Object.freeze({ id: 'symbols', label: 'SYMBOLS & PAYOUTS' }),
		Object.freeze({ id: 'modes', label: 'MODES' }),
		Object.freeze({ id: 'vault', label: 'BLACKOUT BONUS' }),
		Object.freeze({ id: 'controls', label: 'CONTROLS & LEGAL' }),
	]);
	const GUIDE_QUICK_STEPS = Object.freeze([
		Object.freeze({ step: '01', title: 'SET BET', copy: 'Choose your play amount.' }),
		Object.freeze({ step: '02', title: 'CHOOSE MODE', copy: 'Pick Base, Deep Access or BLACKOUT.' }),
		Object.freeze({ step: '03', title: 'SPIN', copy: 'Press SPIN or Space to play.' }),
	]);
	const GUIDE_HIGH_SYMBOLS = Object.freeze([
		'operative',
		'encrypted_drive',
		'tactical_radio',
		'classified_folder',
		'night_vision_goggles',
		'supply_crate',
	]);
	const GUIDE_CARD_SYMBOLS = Object.freeze(['a', 'k', 'q', 'j', 'ten']);
	const VAULT_TIMELINE = Object.freeze([
		'3× VAULT',
		'TRIGGER LOCK',
		'WHEEL TURNS',
		'LOCKS RELEASE',
		'DOOR OPENS',
		'LIGHT ENTERS',
		'8 FREE SPINS',
		'BLACKOUT STARTS',
		'EXTRACTION',
	]);
	const VAULT_GUIDE_STEPS = Object.freeze([
		'3 VAULTS TRIGGER',
		'1 OF 11 TARGETS IS CHOSEN',
		'8 FREE SPINS · TARGET EXPANDS',
		'TOTAL WIN RETURNS TO BASE',
	]);
	const regularSymbolIds = new Set([
		'operative',
		'encrypted_drive',
		'tactical_radio',
		'classified_folder',
		'night_vision_goggles',
		'supply_crate',
		'a',
		'k',
		'q',
		'j',
		'ten',
	]);
	const presentationCheckpointKinds = new Set([
		'board_snapshot',
		'expansion',
		'feature_started',
		'feature_cycle',
		'feature_ended',
		'cap_reached',
	]);
	const NORMAL_PLAYBACK_TIMING = Object.freeze({ stepDelayMs: 650, winDelayMs: 900 });
	const TURBO_PLAYBACK_TIMING = Object.freeze({ stepDelayMs: 55, winDelayMs: 160 });
	const WIN_ROLLUP_DURATION_MS = Object.freeze({ big: 650, top: 900, turbo: 120 });
	const UI_HOVER_COOLDOWN_MS = 70;
	const UI_DENY_COOLDOWN_MS = 250;
	const OPERATOR_BIG_WIN_CENTIX_PER_COST = 1_000;
	const OPERATOR_DEFERRED_SEQUENCE_TIMEOUT_MS = 4_000;
	const DEV_RANDOM_FIXTURE_PATTERN = /^(base|deep_access|blackout)_random$/u;
	const NORMAL_REEL_SETTLE_MS = 420;
	const TURBO_REEL_SETTLE_MS = 30;
	const NORMAL_VAULT_ANTICIPATION_MS = 780;
	const TURBO_VAULT_ANTICIPATION_MS = 180;
	const OPERATOR_BUFFER_INDICES = Object.freeze([0, 1]);
	const INITIAL_OPERATOR_FRAME = Object.freeze({
		sequence: OPERATOR_SEQUENCE.IDLE,
		frameIndex: 0,
		frameSrc: OPERATOR_ANIMATION_CATALOG.idle.frames[0],
		generation: 0,
		reason: 'boot',
	});
	const EMPTY_OPERATOR_BUFFER = Object.freeze({
		sequence: '',
		frameIndex: -1,
		frameSrc: null,
		generation: -1,
		reason: 'empty',
	});
	const INACTIVE_STANDALONE_FX_FRAME = Object.freeze({
		active: false,
		name: null,
		frameIndex: -1,
		frameSrc: null,
		generation: 0,
	});

	let launch = { kind: 'booting' };
	let presentation = createInitialPresentationState();
	let selectedModeId = 'base';
	let selectedMode = getMode(selectedModeId);
	let activeFixture = null;
	let activeCues = [];
	let developmentFixtureAdapter = null;
	let director = null;
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
	let bootSequenceComponent = null;
	let bootSequenceState = BOOT_SEQUENCE_STATE.BOOT;
	let bootCriticalAssets = [];
	let bootReadyWaiters = [];
	let primaryActionButton = null;
	let pendingRoundOrigin = null;
	let primaryBusy = false;
	let visualAssetsReady = false;
	let visualPreloadImages = [];
	let v28EnvironmentCandidateSources = null;
	let v28EnvironmentCandidateImages = [];
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
	let recoveryButton = null;
	let runtimeErrorDialog = null;
	let devErrorFocusPending = false;
	let rulesDialog = null;
	let rulesCloseButton = null;
	let guideScroll = null;
	let guideTab = 'overview';
	let settingsOpen = false;
	let settingsDialog = null;
	let settingsCloseButton = null;
	let turboEnabled = false;
	let rageOutEnabled = false;
	let menuOpen = false;
	let menuDialog = null;
	let menuCloseButton = null;
	let modeDialogOpen = false;
	let modeDialog = null;
	let modeCloseButton = null;
	let autoDialogOpen = false;
	let autoDialog = null;
	let autoCloseButton = null;
	let autoSpinCount = 10;
	let autoRemaining = 0;
	let autoRunning = false;
	let autoAwaitingRound = false;
	let autoRoundStarted = false;
	let autoNextTimer = null;
	let autoFinishing = false;
	let autoLifecycleGeneration = 0;
	let autoCostApi = 0;
	let autoCostText = '—';
	let autoEligible = false;
	let lifecycleLabel = 'CONNECTING';
	let returnFocusElement = null;
	let operatorReaction = 'idle';
	let operatorAnimator = null;
	let standaloneFxDirector = null;
	let displayRefreshMonitor = null;
	let displayRefresh = Object.freeze({
		refreshHz: 60,
		renderFps: 60,
		frameTimeMs: 1000 / 60,
		p95FrameTimeMs: 1000 / 60,
		missedFrameRate: 0,
		quality: 'full',
		sampleCount: 0,
	});
	let vaultCinematicDirector = null;
	let devVaultMotionDirector = null;
	let audioDirector = null;
	let vaultAudioAuthority = null;
	let vaultAudioPreloadPromise = null;
	let audioMuted = false;
	let lastRuntimeAudioErrorKey = null;
	let lastUiDenyAt = -Infinity;
	let roundTerminalAudioAcknowledged = false;
	let winRollupActive = false;
	let winRollupDisplayedRaw = 0;
	let winRollupTargetRaw = 0;
	let winRollupTimer = null;
	let winRollupAuthority = null;
	let operatorGearTimer = null;
	let operatorGearOrdinal = 0;
	const uiHoverTimes = new WeakMap();
	let reducedMotionQuery = null;
	let vaultCinematicState = Object.freeze({
		active: false,
		state: VAULT_STATE.IDLE,
		stageIndex: -1,
		skippable: false,
		targetSymbol: null,
		generation: 0,
	});
	let devVaultMotionState = Object.freeze({
		active: false,
		stage: null,
		motionProgress: 0,
		channels: Object.freeze({ sealed: 0, wheel: 0, locks: 0, door: 0, light: 0, award: 0 }),
		generation: 0,
	});
	let liveOutcomeStreak = null;
	let standaloneFxStartTimer = null;
	let standaloneFxStopTimer = null;
	let standaloneFxGeneration = 0;
	let operatorViewportQuery = null;
	let operatorViewportListener = null;
	let operatorViewportVisible = false;
	let operatorZeroStreak = 0;
	let fallbackLiveRoundId = 0;
	let fallbackLiveRoundTokens = new WeakMap();
	let fixturePlaybackGeneration = 0;
	let replayPlaybackGeneration = 0;
	let operatorFrame = INITIAL_OPERATOR_FRAME;
	let operatorVisibleFrame = INITIAL_OPERATOR_FRAME;
	let operatorVisibleBuffer = 0;
	let operatorFrameBuffers = [INITIAL_OPERATOR_FRAME, EMPTY_OPERATOR_BUFFER];
	let operatorFrameElements = [null, null];
	let operatorSurfaceGeneration = 0;
	let operatorPendingFrame = null;
	let operatorSurfacePumpActive = false;
	let operatorBonusTriggerPending = 0;
	let operatorDeferredGeneration = 0;
	let operatorDeferredBigWin = null;
	let operatorPresentationGeneration = 0;
	let operatorTerminalPresentationGeneration = -1;
	let operatorTerminalAnimationGeneration = -1;
	let standaloneFxFrame = INACTIVE_STANDALONE_FX_FRAME;
	let standaloneFxVisibleFrame = INACTIVE_STANDALONE_FX_FRAME;
	let standaloneFxVisibleBuffer = 0;
	let standaloneFxBuffers = [INACTIVE_STANDALONE_FX_FRAME, INACTIVE_STANDALONE_FX_FRAME];
	let standaloneFxElements = [null, null];
	let standaloneFxSurfaceGeneration = 0;
	let standaloneFxPendingFrame = null;
	let standaloneFxSurfacePumpActive = false;
	let reelMotionActive = false;
	let reelMotionSettling = false;
	let reelMotionAnticipating = false;
	let reelMotionLockedReels = [];
	let reelMotionLockedThrough = -1;
	let reelMotionTimer = null;
	let reelMotionPresentationResolve = null;
	let reelMotionGeneration = 0;
	let reelSpinPhaseSeed = 0;
	let expansionFxActive = false;
	let expansionTickerActive = false;
	let expansionFxReels = [];
	let expansionFxTarget = '';
	let expansionFxTimer = null;
	let expansionTickerTimer = null;
	let expansionFxGeneration = 0;
	$: reelMotionLockedThrough = reelMotionLockedReels.length >= 2 ? reelMotionLockedReels[1] : -1;

	$: selectedMode = getMode(selectedModeId);
	$: bootInteractionLocked = bootSequenceState !== BOOT_SEQUENCE_STATE.GAME_READY;
	$: startupFailureVisible = bootInteractionLocked
		&& Boolean(runtimeError || launch.kind === 'error');
	$: briefingControlCopy = missionBriefingControls(launch.language ?? 'en');
	$: penguinOperatorEnabled = __BLACKSITE_MODERN_PRESENTATION__;
	$: devVaultRigEnabled = __BLACKSITE_DEV_FIXTURES__
		&& launch.kind === 'fixture'
		&& activeFixture?.id === launch.fixtureId;
	// These legacy variable names are retained to keep the established CSS
	// contract stable; their authority is the independent production flag.
	$: devUiV21Enabled = __BLACKSITE_MODERN_PRESENTATION__;
	$: devUiV22Enabled = __BLACKSITE_MODERN_PRESENTATION__;
	$: activeReelStripSources = BLACKSITE_ASSETS.ui.reelStrips;
	$: devFixtureUiPreview = __BLACKSITE_DEV_FIXTURES__ && launch.kind === 'fixture';
	$: if ((devUiV21Enabled || startupFailureVisible)
		&& (runtimeError || launch.kind === 'error')
		&& !devErrorFocusPending) {
		menuOpen = false;
		modeDialogOpen = false;
		confirmationOpen = false;
		rulesOpen = false;
		settingsOpen = false;
		autoDialogOpen = false;
		devErrorFocusPending = true;
		void tick().then(() => recoveryButton?.focus?.());
	}
	$: if (!runtimeError && launch.kind !== 'error') devErrorFocusPending = false;
	$: social = launch.social === true || liveSnapshot.config?.jurisdiction?.socialCasino === true;
	$: rulesInterfaceCopy = getRulesInterfaceCopy(social);
	$: currency = liveSnapshot.balance?.currency ?? launch.currency ?? 'USD';
	$: baseAmountApi = liveSnapshot.selectedBaseAmountApi ?? 0;
	$: betLevelsApi = liveSnapshot.config?.betLevelsApi ?? [];
	$: spacebarDisabled = liveSnapshot.config?.jurisdiction?.disabledSpacebar === true;
	$: buyFeatureDisabled = liveSnapshot.config?.jurisdiction?.disabledBuyFeature === true;
	$: autoplayDisabled = liveSnapshot.config?.jurisdiction?.disabledAutoplay === true;
	$: turboDisabled = liveSnapshot.config?.jurisdiction?.disabledTurbo === true
		|| liveSnapshot.config?.jurisdiction?.disabledSuperTurbo === true;
	$: selectedModeBlocked = Boolean(
		buyFeatureDisabled && liveSnapshot.config?.betModes?.[selectedModeId]?.feature,
	);
	$: displayNetPosition = liveSnapshot.config?.jurisdiction?.displayNetPosition === true;
	$: displaySessionTimer = liveSnapshot.config?.jurisdiction?.displaySessionTimer === true;
	$: netPositionText = liveSnapshot.balance && sessionOpeningBalanceApi !== null
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
	$: replayTotalUnits = launch.kind === 'replay' && replaySnapshot.replay
		? replayQueryUnitsTimesInteger(
			launch.amountUnitsRaw,
			replaySnapshot.replay.costMultiplier,
		)
		: launch.kind === 'replay' ? launch.amountUnitsRaw : null;
	$: replayWinUnits = launch.kind === 'replay' && replaySnapshot.replay
		? replayQueryUnitsTimesCentiX(
			launch.amountUnitsRaw,
			replaySnapshot.replay.packagePayoutCentiX,
		)
		: null;
	$: finalWinText = launch.kind === 'replay'
		? replaySnapshot.status === 'completed'
			? formatReplayQueryUnits(replayWinUnits, launch.currency)
			: '—'
		: launch.kind === 'fixture'
			? runtimeState === 'fixture-completed' && boardIsAuthoritative
				? formatCentiMultiplier(finalWinRaw)
				: '—'
			: finalWinApi !== null
				? formatExactApi(finalWinApi, currency)
				: '—';
	$: displayedWinText = runtimeState === 'live-requesting'
		? '—'
		: finalWinText !== '—'
			? finalWinText
			: presentation.status !== 'idle' && presentation.lastEventIndex >= 0
				? formatPresentedWin(winRollupActive ? winRollupDisplayedRaw : presentation.cumulativeWinRaw)
				: finalWinText;
	$: hudBalanceText = launch.kind === 'fixture' && !liveSnapshot.balance ? '—' : balanceText;
	$: hudTotalAmountText = launch.kind === 'fixture' && totalAmountApi <= 0
		? `${selectedMode.costMultiplier}×`
		: totalAmountText;
	$: hudWinText = hudPhase === 'feature'
		? featureRunningWinText
		: launch.kind === 'fixture'
			&& !(runtimeState === 'fixture-completed' && boardIsAuthoritative)
			? '0'
			: displayedWinText;
	$: modalOpen = confirmationOpen
		|| rulesOpen
		|| settingsOpen
		|| autoDialogOpen
		|| menuOpen
		|| modeDialogOpen
		|| vaultCinematicState.active
		|| (devUiV21Enabled && Boolean(runtimeError || launch.kind === 'error'));
	$: vaultReportActive = vaultCinematicState.active
		&& vaultCinematicState.state === VAULT_STATE.EXTRACTION;
	$: operatorSuspended = (modalOpen || bootInteractionLocked) && !vaultReportActive;
	$: autoCostApi = Number.isSafeInteger(totalAmountApi * autoSpinCount)
		? totalAmountApi * autoSpinCount
		: 0;
	$: autoCostText = autoCostApi > 0 ? formatExactApi(autoCostApi, currency) : '—';
	$: autoEligible = launch.kind === 'live'
		&& !bootInteractionLocked
		&& selectedModeId === 'base'
		&& liveSnapshot.status === 'ready'
		&& !autoplayDisabled
		&& !primaryBusy
		&& !insufficientKnown
		&& !runtimeError;
	$: autoUnavailableReason = autoplayDisabled
		? 'REGION LOCKED — AUTOPLAY IS DISABLED FOR THIS JURISDICTION.'
		: launch.kind !== 'live'
			? 'DEV PREVIEW ONLY — AUTOPLAY STARTS IN LIVE MODE.'
			: selectedModeId !== 'base'
				? 'SELECT THE 1× BASE MODE BEFORE STARTING AUTOPLAY.'
				: insufficientKnown
					? 'AVAILABLE BALANCE IS BELOW THE REQUIRED TOTAL.'
					: liveSnapshot.status !== 'ready' || primaryBusy
						? 'WAIT FOR THE CURRENT OPERATION TO FINISH.'
						: runtimeError
							? 'AUTOPLAY IS UNAVAILABLE WHILE THE LINK IS OFFLINE.'
							: '';
	$: lifecycleLabel = runtimeError || launch.kind === 'error'
		? 'LINK ERROR'
		: launch.kind === 'replay'
			? 'REPLAY'
			: launch.kind === 'fixture'
				? 'PREVIEW'
				: /authenticating|booting/u.test(runtimeState)
					? 'AUTHENTICATING'
					: /presenting|requesting|settling|minimum-duration|restor/u.test(runtimeState)
						? 'PRESENTING'
						: liveSnapshot.status === 'ready'
							? 'READY'
							: 'CONNECTING';
	$: if (autoRunning && autoAwaitingRound && liveSnapshot.status !== 'ready') {
		autoRoundStarted = true;
	}
	$: if (
		autoRunning
		&& autoAwaitingRound
		&& autoRoundStarted
		&& liveSnapshot.status === 'ready'
		&& !primaryBusy
		&& !autoFinishing
	) {
		void finishAutoRound();
	}
	$: if (autoRunning && (runtimeError || insufficientKnown || selectedModeId !== 'base' || autoplayDisabled)) {
		stopAutoplay();
	}
	$: actionLabel = !visualAssetsReady
		? 'LOADING ASSETS'
		: bootInteractionLocked
			? 'MISSION BRIEFING'
			: primaryActionLabel({
		launchKind: launch.kind,
		liveStatus: liveSnapshot.status,
		replayStatus: replaySnapshot.status,
		fixtureCompleted: runtimeState === 'fixture-completed',
		fixtureRandom: isRandomDevelopmentFixture(),
		insufficient: insufficientKnown,
	});
	$: compactActionLabel = compactPrimaryActionLabel(actionLabel);
	$: actionDisabled = primaryActionDisabled({
		launchKind: launch.kind,
		liveStatus: liveSnapshot.status,
		replayStatus: replaySnapshot.status,
		busy: primaryBusy,
		confirming: confirmationOpen,
		showingRules: rulesOpen || modeDialogOpen || vaultCinematicState.active,
		fixtureReady: Boolean(activeFixture),
		insufficient: insufficientKnown,
		modeBlocked: selectedModeBlocked,
		assetsReady: visualAssetsReady && !bootInteractionLocked,
	});
	$: visibleRuntimeMessage = social && runtimeError
		? 'The authoritative game flow could not continue.'
		: runtimeError?.message;
	$: cinematicLifecycle = deriveCinematicLifecycleStatus({
		enabled: devUiV21Enabled,
		runtimeError,
		launchKind: launch.kind,
		runtimeState,
		replayStatus: replaySnapshot.status,
		liveStatus: liveSnapshot.status,
		assetsReady: visualAssetsReady,
		errorMessage: visibleRuntimeMessage ?? launch.message,
	});
	$: cinematicLifecycleFallbackSrc = cinematicLifecycle?.status === 'error'
		? BLACKSITE_ASSETS.ui.premiumPanels.dialogs.runtimeError
		: ['loading', 'connecting'].includes(cinematicLifecycle?.status)
			? BLACKSITE_ASSETS.ui.premiumPanels.ticker
			: BLACKSITE_ASSETS.ui.premiumPanels.dialogs.confirmation;
	$: syncRuntimeAudioState(
		audioDirector,
		runtimeError ?? (launch.kind === 'error' ? { code: launch.code, message: launch.message } : null),
	);
	$: operatorDisplayReaction = runtimeError || launch.kind === 'error' ? 'alert' : operatorReaction;
	$: penguinOperatorState = penguinStateForOperatorReaction(operatorDisplayReaction);
	$: if ((runtimeError || launch.kind === 'error') && operatorAnimator) {
		cancelDeferredOperatorSequence();
		operatorAnimator.returnToIdle('runtime_error');
		stopStandaloneFx();
		stopReelMotion();
	}
	$: operatorReactionLabel = ({
		idle: 'Watching the reels',
		'spin-start': 'Reels spinning',
		'spin-loop': 'Checking paylines',
		'vault-anticipation': 'Two Breaches locked - final reels turning',
		'win-small': 'Winning line confirmed',
		'win-medium': 'Winning lines confirmed',
		'win-big': 'Critical win confirmed',
		loss: 'No winning line',
		'loss-streak': 'Loss streak confirmed',
		rage: 'Containment failure',
		'feature-tease': 'Blackout signature detected',
		'feature-trigger': 'Blackout protocol engaged',
		'bonus-idle': 'Inside blackout protocol',
		'bonus-win': 'Blackout return confirmed',
		'max-win': 'Maximum extraction confirmed',
		recover: 'Round secured',
		alert: 'Authoritative link offline',
	})[operatorDisplayReaction] ?? 'Watching the reels';
	$: legalDisclaimer = getRulesDisclaimer(social);
	$: if (typeof document !== 'undefined') document.body.dataset.runtimeState = runtimeState;
	$: authoritativeBoard = presentation.evaluatedBoard ?? presentation.board;
	$: boardIsAuthoritative = Boolean(authoritativeBoard);
	$: presentationBoard = authoritativeBoard ?? attractBoard;
	$: reelsSpinning = (
		['spin-start', 'spin-loop', 'vault-anticipation'].includes(operatorDisplayReaction)
		&& (!devUiV21Enabled || presentationActive || primaryBusy || runtimeState === 'live-requesting')
	)
		|| runtimeState === 'live-requesting'
		|| (primaryBusy && !boardIsAuthoritative && /fixture-playing|replay-playing/u.test(runtimeState));
	$: presentationActive = /fixture-playing|replay-playing|live-presenting|live-restoring/u.test(runtimeState);
	$: visualPhase = presentationActive && presentation.phase === 'feature' ? 'feature' : 'base';
	$: activeLineWins = presentation.activeLines ?? [];
	$: activeWinKeys = new Set(
		activeLineWins.flatMap((win) => (win.positions ?? []).map((cell) => cellKey(cell))),
	);
	$: uiAtmosphereState = runtimeError || launch.kind === 'error'
		? 'danger'
		: visualPhase === 'feature'
			? 'feature'
			: activeWinKeys.size > 0
				? 'win'
				: reelsSpinning
					? 'spin'
					: 'idle';
	$: activeLineIds = Array.from(
		new Set(activeLineWins.map((win) => Number(win.line_id ?? win.lineId)).filter((id) => id >= 0 && id < PAYLINES.length)),
	);
	$: featureTargetSymbol = presentation.featureTarget ?? null;
	$: featureSpin = presentation.freeSpinIndex ?? 0;
	$: featureSpinsAwarded = presentation.totalFreeSpins || RULES_CONTRACT.initialFeatureSpins;
	$: remainingFeatureSpins = presentation.remainingFreeSpins ?? Math.max(0, featureSpinsAwarded - featureSpin);
	$: featureTargetLabel = featureTargetSymbol
		? (symbolCodes[featureTargetSymbol] ?? featureTargetSymbol.toUpperCase())
		: 'LOCKING';
	$: featureTargetAsset = featureTargetSymbol
		? baseSymbolAsset(featureTargetSymbol)
		: null;
	$: featureProgressValue = `${featureSpin}/${featureSpinsAwarded}`;
	$: featureRemainingValue = `${remainingFeatureSpins} LEFT`;
	$: featureRunningWinText = formatPresentedWin(
		winRollupActive ? winRollupDisplayedRaw : (presentation.cumulativeWinRaw ?? 0),
	);
	$: breachReelCount = boardIsAuthoritative && presentationBoard
		? presentationBoard.reduce((count, reel) => count + (reel?.includes?.('breach') ? 1 : 0), 0)
		: 0;
	$: betweenRounds = launch.kind === 'live' && liveSnapshot.status === 'ready';
	$: authoritativeFeatureActive = presentationActive
		&& presentation.phase === 'feature'
		&& presentation.totalFreeSpins > 0;
	$: hudPhase = authoritativeFeatureActive ? 'feature' : 'base';
	$: gameplayHint = betweenRounds
		? rulesInterfaceCopy.gameplayHint
		: playerFacingHint(presentation, runtimeError);
	$: selectedModeGuide = displaySpecialSymbolCopy(getModeActionDescription(selectedModeId, social));
	$: passiveStatusText = runtimeError
		? 'AUTHORITATIVE LINK OFFLINE'
		: vaultCinematicState.state === VAULT_STATE.EXTRACTION
			? 'EXTRACTION READY'
			: hudPhase === 'feature'
				? `FREE SPIN ${featureSpin || 'READY'} OF ${featureSpinsAwarded} - ${remainingFeatureSpins} REMAIN`
				: `${getModeLabel(selectedModeId, social)} · ${selectedMode.costMultiplier}×`;

	$: devUiStatus = deriveDevUiStatus({
		enabled: devUiV21Enabled,
		runtimeError,
		launchKind: launch.kind,
		runtimeState,
		assetsReady: visualAssetsReady,
		insufficient: insufficientKnown,
		primaryBusy,
		reelsSpinning,
		actionLabel,
	});
	$: resultTickerPriority = Boolean(
		expansionTickerActive
		|| (devUiStatus && ['danger', 'warning', 'notice'].includes(devUiStatus.severity))
		|| reelMotionAnticipating
		|| activeLineWins.length > 0
		|| (presentation.status === 'complete' && presentation.finalWinRaw === 0),
	);
	$: resultTickerPassive = !resultTickerPriority
		&& (hudPhase === 'feature' || (!reelsSpinning && !presentationActive));

	function deriveCinematicLifecycleStatus({
		enabled,
		runtimeError: currentError,
		launchKind,
		runtimeState: currentRuntimeState,
		replayStatus,
		liveStatus,
		assetsReady,
		errorMessage,
	}) {
		if (!enabled) return null;
		if (currentError || launchKind === 'error') {
			return {
				mode: 'error',
				status: 'error',
				eyebrow: 'BLACKSITE // SYSTEM FAULT',
				headline: 'SECURE LINK INTERRUPTED',
				detail: errorMessage || 'The operation stopped safely.',
			};
		}
		if (launchKind === 'replay') {
			const replayLoading = replayStatus === 'loading';
			const replayPresenting = replayStatus === 'playing';
			const replayCompleted = replayStatus === 'completed';
			return {
				mode: 'replay',
				status: replayPresenting ? 'presenting' : replayLoading ? 'loading' : 'ready',
				eyebrow: 'BLACKSITE // REPLAY CHANNEL',
				headline: replayLoading
					? 'LOADING REPLAY'
					: replayPresenting
					? 'REPLAY IN PROGRESS'
					: replayCompleted
						? 'REPLAY COMPLETE'
						: 'REPLAY READY',
				detail: replayLoading
					? 'Loading the recorded authoritative operation.'
					: replayPresenting
					? 'Presenting the recorded authoritative operation.'
					: 'Recorded operation data is available.',
			};
		}
		if (/authenticating/u.test(currentRuntimeState) || liveStatus === 'authenticating') {
			return {
				mode: 'authenticating',
				status: 'connecting',
				eyebrow: 'BLACKSITE // AUTHORITY',
				headline: 'AUTHENTICATING SESSION',
				detail: 'Validating the secure player session.',
			};
		}
		if (!assetsReady || /booting|sampling/u.test(currentRuntimeState)) {
			return {
				mode: 'loading',
				status: 'loading',
				eyebrow: 'BLACKSITE // SYSTEM BOOT',
				headline: 'LOADING BLACKSITE',
				detail: 'Preparing secure visual systems.',
			};
		}
		if (/presenting|requesting|settling|minimum-duration|restor|playing/u.test(currentRuntimeState)) {
			return {
				mode: 'presenting',
				status: 'presenting',
				eyebrow: 'BLACKSITE // LIVE FEED',
				headline: 'OPERATION IN PROGRESS',
				detail: 'The current authoritative presentation is active.',
			};
		}
		if (liveStatus === 'ready' || /ready|completed/u.test(currentRuntimeState)) {
			return {
				mode: 'ready',
				status: 'ready',
				eyebrow: launchKind === 'fixture' ? 'BLACKSITE // DEV PREVIEW' : 'BLACKSITE // OPERATIONS',
				headline: launchKind === 'fixture' ? 'DEMO' : 'SECURE LINK',
				detail: 'Controls are available.',
			};
		}
		return {
			mode: 'loading',
			status: 'loading',
			eyebrow: 'BLACKSITE // SECURE CHANNEL',
			headline: 'CONNECTING SYSTEMS',
			detail: 'Waiting for the operation link.',
		};
	}

	function deriveDevUiStatus({
		enabled,
		runtimeError: currentError,
		launchKind,
		runtimeState: currentRuntimeState,
		assetsReady,
		insufficient,
		primaryBusy: busy,
		reelsSpinning: spinning,
		actionLabel: currentActionLabel,
	}) {
		if (!enabled) return null;
		if (currentError || launchKind === 'error') {
			return { severity: 'danger', headline: 'AUTHORITATIVE LINK OFFLINE', detail: 'RELOAD FIXTURE' };
		}
		if (currentRuntimeState === 'live-restore-ready') {
			return { severity: 'notice', headline: 'ROUND READY', detail: 'CONTINUE PRESENTATION' };
		}
		if (insufficient) {
			return { severity: 'warning', headline: 'PLAY AMOUNT TOO HIGH', detail: 'LOWER PLAY AMOUNT' };
		}
		if (!assetsReady) {
			return { severity: 'loading', headline: 'LOADING BLACKSITE', detail: 'PREPARING VISUAL ASSETS' };
		}
		if (/authenticating|booting/u.test(currentRuntimeState)) {
			return { severity: 'loading', headline: 'SECURE LINK', detail: 'AUTHENTICATING' };
		}
		if (busy && !spinning) {
			return { severity: 'loading', headline: 'ROUND IN PROGRESS', detail: 'PLEASE WAIT' };
		}
		return null;
	}

	function cellKey(cell) {
		return `${cell.column},${cell.row}`;
	}

	function symbolAt(cell) {
		const symbol = presentationBoard?.[cell.column]?.[cell.row];
		if (!symbol) return '--';
		return symbolCodes[symbol];
	}

	function symbolNameAt(cell) {
		return presentationBoard?.[cell.column]?.[cell.row] ?? 'empty';
	}

	function visualSymbolStates(symbol) {
		return BLACKSITE_ASSETS.symbols.states?.[symbol] ?? null;
	}

	function baseSymbolAsset(symbol) {
		return visualSymbolStates(symbol)?.base ?? null;
	}

	function symbolAssetAt(cell) {
		const symbol = symbolNameAt(cell);
		const states = visualSymbolStates(symbol);
		if (!states) return null;
		if (activeWinKeys.has(cellKey(cell))) return states.win;
		if (activeWinKeys.size > 0) return states.dim;
		if ((symbol === 'breach' || symbol === 'ghost_wild') && visualPhase === 'feature') {
			return states.triggered ?? states.base;
		}
		if (symbol === 'breach' && breachReelCount >= 2 && presentationActive) {
			return states.anticipation ?? states.base;
		}
		return states.base;
	}

	function isRegularSymbol(cell) {
		return regularSymbolIds.has(symbolNameAt(cell));
	}

	function winningLineIdsAt(cell) {
		return activeLineWins
			.filter((win) => (win.positions ?? []).some((position) => cellKey(position) === cellKey(cell)))
			.map((win) => Number(win.line_id ?? win.lineId) + 1)
			.filter((id) => Number.isInteger(id));
	}

	function compactModeLabel(modeId, socialMode) {
		if (socialMode) return getModeLabel(modeId, true);
		if (modeId === 'base') return 'RUN';
		if (modeId === 'deep_access') return 'DEEP';
		return 'BLACKOUT';
	}

	function playerFacingHint(state, error) {
		if (error) return 'LINK LOST - restore the authoritative round to continue.';
		if (activeLineWins.length > 0) {
			const ids = activeLineIds.map((id) => String(id + 1).padStart(2, '0')).join(' + ');
			return `WINNING ${activeLineWins.length === 1 ? 'LINE' : 'LINES'} ${ids}`;
		}
		if (state.phase === 'feature') {
			return featureSpin > 0
				? `FREE SPIN ${featureSpin} OF ${featureSpinsAwarded} - ${remainingFeatureSpins} REMAINING`
				: `${featureSpinsAwarded} FREE SPINS AWARDED - EXPANDING TARGET ${featureTargetLabel}`;
		}
		if (state.status === 'complete') return state.finalWinRaw === 0 ? 'NO LINE WIN' : 'ROUND COMPLETE';
		if (presentationBoard) return 'CHECKING 10 FIXED LINES FROM LEFT TO RIGHT';
		return 'MATCH 3+ FROM THE LEFT / ALL 10 LINES ACTIVE';
	}

	function setOperatorReaction(reaction) {
		operatorReaction = reaction;
	}

	function playbackTiming() {
		return turboEnabled ? TURBO_PLAYBACK_TIMING : NORMAL_PLAYBACK_TIMING;
	}

	function formatPresentedWin(cumulativeRaw) {
		if (!Number.isSafeInteger(cumulativeRaw) || cumulativeRaw < 0) return finalWinText;
		if (launch.kind === 'replay') {
			return formatReplayQueryUnits(
				replayQueryUnitsTimesCentiX(launch.amountUnitsRaw, cumulativeRaw),
				launch.currency,
			);
		}
		if (launch.kind === 'fixture') return formatCentiMultiplier(cumulativeRaw);
		if (launch.kind === 'live' && Number.isSafeInteger(baseAmountApi) && baseAmountApi > 0) {
			const scaled = BigInt(baseAmountApi) * BigInt(cumulativeRaw);
			if (scaled % 100n === 0n) {
				const exactApi = scaled / 100n;
				if (exactApi <= BigInt(Number.MAX_SAFE_INTEGER)) {
					return formatExactApi(Number(exactApi), currency);
				}
			}
		}
		return formatCentiMultiplier(cumulativeRaw);
	}

	function clearReelMotionTimer() {
		if (reelMotionTimer === null) return;
		window.clearTimeout(reelMotionTimer);
		reelMotionTimer = null;
	}

	function cancelReelMotionPresentation() {
		clearReelMotionTimer();
		if (reelMotionPresentationResolve === null) return;
		const resolve = reelMotionPresentationResolve;
		reelMotionPresentationResolve = null;
		resolve(false);
	}

	function nextDevMathReelPhaseSeed() {
		if (!__BLACKSITE_DEV_FIXTURES__ || !isRandomDevelopmentFixture()) return 0;
		const entropy = new Uint32Array(1);
		try {
			window.crypto.getRandomValues(entropy);
		} catch {
			// Local DEV fallback only; modern localhost contexts use Web Crypto above.
			entropy[0] = ((Date.now() >>> 0) ^ Math.imul(reelMotionGeneration + 1, 0x9e3779b9)) >>> 0;
		}
		return entropy[0] || 0x6d2b79f5;
	}

	function beginReelMotion() {
		const startsFreshMotion = !reelMotionActive;
		cancelReelMotionPresentation();
		if (startsFreshMotion) reelSpinPhaseSeed = nextDevMathReelPhaseSeed();
		reelMotionGeneration += 1;
		reelMotionActive = true;
		reelMotionSettling = false;
		reelMotionAnticipating = false;
		reelMotionLockedReels = [];
	}

	function boardVaultReels(board) {
		if (!Array.isArray(board)) return [];
		return board.reduce((reels, reel, column) => {
			if (Array.isArray(reel) && reel.includes('breach')) reels.push(column);
			return reels;
		}, []);
	}

	function settleReelMotion({ board = null, phase = 'base', allowAnticipation = true } = {}) {
		if (!reelMotionActive) return null;
		cancelReelMotionPresentation();
		const generation = reelMotionGeneration;
		const vaultReels = phase === 'base' ? boardVaultReels(board) : [];
		const secondVaultReel = vaultReels[1] ?? -1;
		const holdsForVault = allowAnticipation && secondVaultReel >= 0 && secondVaultReel < 4;
		reelMotionAnticipating = holdsForVault;
		reelMotionSettling = !holdsForVault;
		reelMotionLockedReels = holdsForVault ? vaultReels : [];
		const anticipationMs = turboEnabled ? TURBO_VAULT_ANTICIPATION_MS : NORMAL_VAULT_ANTICIPATION_MS;
		const settleMs = turboEnabled ? TURBO_REEL_SETTLE_MS : NORMAL_REEL_SETTLE_MS;

		if (!holdsForVault) {
			reelMotionTimer = window.setTimeout(() => {
				reelMotionTimer = null;
				if (generation !== reelMotionGeneration) return;
				reelMotionActive = false;
				reelMotionSettling = false;
				reelMotionLockedReels = [];
			}, settleMs);
			return null;
		}

		return new Promise((resolve) => {
			reelMotionPresentationResolve = resolve;
			const finishPresentation = (completed) => {
				if (reelMotionPresentationResolve === resolve) reelMotionPresentationResolve = null;
				resolve(completed);
			};

			reelMotionTimer = window.setTimeout(() => {
				reelMotionTimer = null;
				if (generation !== reelMotionGeneration) {
					finishPresentation(false);
					return;
				}
				reelMotionAnticipating = false;
				reelMotionSettling = true;
				reelMotionTimer = window.setTimeout(() => {
					reelMotionTimer = null;
					if (generation !== reelMotionGeneration) {
						finishPresentation(false);
						return;
					}
					reelMotionActive = false;
					reelMotionSettling = false;
					reelMotionLockedReels = [];
					finishPresentation(true);
				}, settleMs);
			}, anticipationMs);
		});
	}

	function stopReelMotion() {
		cancelReelMotionPresentation();
		reelMotionGeneration += 1;
		reelMotionActive = false;
		reelMotionSettling = false;
		reelMotionAnticipating = false;
		reelMotionLockedReels = [];
	}

	function stopExpansionFx() {
		expansionFxGeneration += 1;
		if (expansionFxTimer !== null) window.clearTimeout(expansionFxTimer);
		if (expansionTickerTimer !== null) window.clearTimeout(expansionTickerTimer);
		expansionFxTimer = null;
		expansionTickerTimer = null;
		expansionFxActive = false;
		expansionTickerActive = false;
		expansionFxReels = [];
		expansionFxTarget = '';
	}

	function showExpansionFx(event) {
		stopExpansionFx();
		const generation = expansionFxGeneration;
		const targetSymbol = event?.target_symbol ?? presentation.featureTarget ?? null;
		expansionFxReels = Array.isArray(event?.expanded_reels) ? [...event.expanded_reels] : [];
		expansionFxTarget = targetSymbol ? (symbolCodes[targetSymbol] ?? String(targetSymbol).toUpperCase()) : 'TARGET';
		expansionFxActive = true;
		expansionTickerActive = true;
		expansionTickerTimer = window.setTimeout(() => {
			expansionTickerTimer = null;
			if (generation !== expansionFxGeneration) return;
			expansionTickerActive = false;
		}, turboEnabled ? 240 : 420);
		expansionFxTimer = window.setTimeout(() => {
			expansionFxTimer = null;
			if (generation !== expansionFxGeneration) return;
			expansionFxActive = false;
		}, turboEnabled ? 420 : 650);
	}

	function operatorReactionForSequence(sequence) {
		return ({
			[OPERATOR_SEQUENCE.LOSS]: 'loss',
			[OPERATOR_SEQUENCE.LOSS_STREAK]: 'loss-streak',
			[OPERATOR_SEQUENCE.WIN]: 'win-small',
			[OPERATOR_SEQUENCE.BIG_WIN]: 'win-big',
			[OPERATOR_SEQUENCE.BONUS]: 'feature-trigger',
			[OPERATOR_SEQUENCE.RAGE]: 'rage',
		})[sequence] ?? 'idle';
	}

	function registerOperatorFrameBuffer(node, bufferIndex) {
		operatorFrameElements[bufferIndex] = node;
		return {
			destroy() {
				if (operatorFrameElements[bufferIndex] === node) operatorFrameElements[bufferIndex] = null;
			},
		};
	}

	function setOperatorBufferFrame(bufferIndex, nextFrame) {
		operatorFrameBuffers = operatorFrameBuffers.map((frame, index) => (
			index === bufferIndex ? nextFrame : frame
		));
	}

	function registerStandaloneFxBuffer(node, bufferIndex) {
		standaloneFxElements[bufferIndex] = node;
		return {
			destroy() {
				if (standaloneFxElements[bufferIndex] === node) standaloneFxElements[bufferIndex] = null;
			},
		};
	}

	function setStandaloneFxBufferFrame(bufferIndex, nextFrame) {
		standaloneFxBuffers = standaloneFxBuffers.map((frame, index) => (
			index === bufferIndex ? nextFrame : frame
		));
	}

	async function decodeMountedFrame(image, expectedSource, label) {
		if (!image) throw new Error(`${label} image buffer is unavailable.`);
		if (typeof image.decode === 'function') {
			await image.decode();
		} else if (!image.complete) {
			await new Promise((resolve, reject) => {
				const cleanup = () => {
					image.removeEventListener('load', loaded);
					image.removeEventListener('error', failed);
				};
				const loaded = () => {
					cleanup();
					resolve();
				};
				const failed = () => {
					cleanup();
					reject(new Error(`Unable to decode mounted ${label} frame: ${expectedSource}`));
				};
				image.addEventListener('load', loaded, { once: true });
				image.addEventListener('error', failed, { once: true });
			});
		}
		if (!image.complete || image.naturalWidth <= 0 || image.getAttribute('src') !== expectedSource) {
			throw new Error(`Mounted ${label} frame was not ready: ${expectedSource}`);
		}
	}

	function enqueueOperatorFrame(nextFrame) {
		if (nextFrame?.paused) {
			operatorSurfaceGeneration += 1;
			operatorPendingFrame = null;
			return;
		}
		operatorPendingFrame = nextFrame;
		if (!operatorSurfacePumpActive) void pumpOperatorFrames();
	}

	async function pumpOperatorFrames() {
		if (operatorSurfacePumpActive) return;
		operatorSurfacePumpActive = true;
		try {
			while (operatorPendingFrame) {
				const nextFrame = operatorPendingFrame;
				operatorPendingFrame = null;
				const generation = operatorSurfaceGeneration;
				const source = nextFrame?.frameSrc ?? OPERATOR_ANIMATION_CATALOG.idle.frames[0];
				const visibleFrame = source === nextFrame?.frameSrc
					? nextFrame
					: Object.freeze({ ...nextFrame, frameSrc: source });
				if (source === operatorVisibleFrame.frameSrc) {
					operatorVisibleFrame = visibleFrame;
					setOperatorBufferFrame(operatorVisibleBuffer, visibleFrame);
					continue;
				}

				const pendingBuffer = operatorVisibleBuffer === 0 ? 1 : 0;
				setOperatorBufferFrame(pendingBuffer, visibleFrame);
				await tick();
				try {
					await decodeMountedFrame(operatorFrameElements[pendingBuffer], source, 'operator');
				} catch {
					if (generation === operatorSurfaceGeneration) {
						operatorAnimator?.reportFrameError(source);
					}
					continue;
				}
				if (
					generation !== operatorSurfaceGeneration
					|| operatorFrame?.paused
					|| nextFrame.generation !== operatorFrame?.generation
					|| operatorFrameElements[pendingBuffer]?.getAttribute('src') !== source
				) continue;
				operatorVisibleFrame = visibleFrame;
				operatorVisibleBuffer = pendingBuffer;
			}
		} finally {
			operatorSurfacePumpActive = false;
			if (operatorPendingFrame && !operatorFrame?.paused) void pumpOperatorFrames();
		}
	}

	function handleOperatorBufferError(bufferIndex) {
		const source = operatorFrameBuffers[bufferIndex]?.frameSrc;
		if (source) operatorAnimator?.reportFrameError(source);
	}

	function handleOperatorAnimation(nextFrame) {
		// The hidden legacy director remains the semantic reaction scheduler for
		// both character renderers. Track its state even when the Penguin owns the
		// visible pixels so cap deferral never reads the boot-time idle snapshot.
		operatorFrame = nextFrame;
		if (penguinOperatorEnabled) {
			// The modern character owns its browser-native animated WebP surface.
			// Keep the semantic director for reaction authority without decoding or
			// revealing the hidden legacy adult raster sequence.
			if (nextFrame.sequence !== OPERATOR_SEQUENCE.IDLE) {
				// Once this presentation has reached an authoritative terminal cue,
				// callbacks from the reaction that was already active at that boundary
				// are stale. A later explicit post-round reaction gets a newer animation
				// generation and remains eligible (for example live Rage Out).
				if (
					operatorTerminalPresentationGeneration === operatorPresentationGeneration
					&& nextFrame.generation <= operatorTerminalAnimationGeneration
				) return;
				setOperatorReaction(operatorReactionForSequence(nextFrame.sequence));
			} else if (['complete', 'decode_fallback', 'frame_error', 'missing_sequence'].includes(nextFrame.reason)) {
				setOperatorReaction(
					operatorTerminalPresentationGeneration === operatorPresentationGeneration
						? 'idle'
						: presentationActive && presentation.phase === 'feature'
							? 'bonus-idle'
							: 'idle',
				);
			}
			return;
		}
		if (!nextFrame.paused) enqueueOperatorFrame(nextFrame);
		if (nextFrame.sequence !== OPERATOR_SEQUENCE.IDLE) {
			setOperatorReaction(operatorReactionForSequence(nextFrame.sequence));
		} else if (['complete', 'decode_fallback', 'frame_error', 'missing_sequence'].includes(nextFrame.reason)) {
			setOperatorReaction(presentationActive && presentation.phase === 'feature' ? 'bonus-idle' : 'idle');
		}
	}

	async function triggerOperatorSequence(sequence, dedupeKey = null) {
		if (!operatorAnimator || operatorViewportQuery?.matches === false) return false;
		const tracksBonus = sequence === OPERATOR_SEQUENCE.BONUS;
		if (tracksBonus) operatorBonusTriggerPending += 1;
		try {
			return await operatorAnimator.trigger(sequence, { dedupeKey });
		} catch {
			return false;
		} finally {
			if (tracksBonus) operatorBonusTriggerPending = Math.max(0, operatorBonusTriggerPending - 1);
		}
	}

	function cancelDeferredOperatorSequence() {
		operatorDeferredGeneration += 1;
		operatorDeferredBigWin = null;
	}

	function beginOperatorPresentation() {
		operatorPresentationGeneration += 1;
		operatorTerminalPresentationGeneration = -1;
		operatorTerminalAnimationGeneration = -1;
	}

	function markOperatorPresentationTerminal() {
		if (!penguinOperatorEnabled) return;
		cancelDeferredOperatorSequence();
		operatorTerminalPresentationGeneration = operatorPresentationGeneration;
		operatorTerminalAnimationGeneration = operatorAnimator?.snapshot?.generation
			?? operatorFrame?.generation
			?? -1;
	}

	function deferCapBigWin(context) {
		if (!operatorAnimator) return;
		const dedupeKey = operatorRoundSequenceKey(context, OPERATOR_SEQUENCE.BIG_WIN);
		if (operatorDeferredBigWin?.dedupeKey === dedupeKey) return;
		const fxDedupeKey = standaloneFxRoundKey(context, 'coinBurst');
		const generation = ++operatorDeferredGeneration;
		operatorDeferredBigWin = { generation, dedupeKey, fxDedupeKey };
		void (async () => {
			let idleCompleted = false;
			try {
				idleCompleted = await operatorAnimator?.waitForIdle({
					timeoutMs: OPERATOR_DEFERRED_SEQUENCE_TIMEOUT_MS,
				});
			} catch {
				idleCompleted = false;
			}
			if (
				!idleCompleted
				|| generation !== operatorDeferredGeneration
				|| operatorDeferredBigWin?.generation !== generation
			) return;
			operatorDeferredBigWin = null;
			const started = await triggerOperatorSequence(OPERATOR_SEQUENCE.BIG_WIN, dedupeKey);
			if (!started || generation !== operatorDeferredGeneration) return;
			scheduleStandaloneFx('coinBurst', fxDedupeKey, { delayMs: 220 });
		})();
	}

	function handleStandaloneFx(nextFrame) {
		standaloneFxFrame = nextFrame;
		if (!nextFrame.active || !nextFrame.frameSrc) {
			standaloneFxSurfaceGeneration += 1;
			standaloneFxPendingFrame = null;
			standaloneFxVisibleFrame = INACTIVE_STANDALONE_FX_FRAME;
			return;
		}
		standaloneFxPendingFrame = nextFrame;
		if (!standaloneFxSurfacePumpActive) void pumpStandaloneFxFrames();
	}

	async function pumpStandaloneFxFrames() {
		if (standaloneFxSurfacePumpActive) return;
		standaloneFxSurfacePumpActive = true;
		try {
			while (standaloneFxPendingFrame) {
				const nextFrame = standaloneFxPendingFrame;
				standaloneFxPendingFrame = null;
				const generation = standaloneFxSurfaceGeneration;
				const source = nextFrame.frameSrc;
				if (standaloneFxVisibleFrame.active && source === standaloneFxVisibleFrame.frameSrc) {
					standaloneFxVisibleFrame = nextFrame;
					setStandaloneFxBufferFrame(standaloneFxVisibleBuffer, nextFrame);
					continue;
				}
				const pendingBuffer = standaloneFxVisibleFrame.active
					? (standaloneFxVisibleBuffer === 0 ? 1 : 0)
					: 0;
				setStandaloneFxBufferFrame(pendingBuffer, nextFrame);
				await tick();
				try {
					await decodeMountedFrame(standaloneFxElements[pendingBuffer], source, 'standalone FX');
				} catch {
					if (generation === standaloneFxSurfaceGeneration) {
						standaloneFxDirector?.reportFrameError(source);
					}
					continue;
				}
				if (
					generation !== standaloneFxSurfaceGeneration
					|| !standaloneFxFrame.active
					|| nextFrame.generation !== standaloneFxFrame.generation
					|| standaloneFxElements[pendingBuffer]?.getAttribute('src') !== source
				) continue;
				standaloneFxVisibleFrame = nextFrame;
				standaloneFxVisibleBuffer = pendingBuffer;
			}
		} finally {
			standaloneFxSurfacePumpActive = false;
			if (standaloneFxPendingFrame && standaloneFxFrame.active) void pumpStandaloneFxFrames();
		}
	}

	function handleStandaloneFxBufferError(bufferIndex) {
		const source = standaloneFxBuffers[bufferIndex]?.frameSrc;
		if (source) standaloneFxDirector?.reportFrameError(source);
	}

	function clearStandaloneFxTimers() {
		if (standaloneFxStartTimer !== null) window.clearTimeout(standaloneFxStartTimer);
		if (standaloneFxStopTimer !== null) window.clearTimeout(standaloneFxStopTimer);
		standaloneFxStartTimer = null;
		standaloneFxStopTimer = null;
	}

	function stopStandaloneFx() {
		standaloneFxGeneration += 1;
		clearStandaloneFxTimers();
		standaloneFxDirector?.stop();
	}

	function scheduleStandaloneFx(name, dedupeKey, {
		delayMs = 0,
		holdMs = null,
	} = {}) {
		if (!standaloneFxDirector || operatorViewportQuery?.matches === false) return;
		standaloneFxGeneration += 1;
		const generation = standaloneFxGeneration;
		clearStandaloneFxTimers();
		const start = () => {
			standaloneFxStartTimer = null;
			void standaloneFxDirector?.trigger(name, { dedupeKey }).then((started) => {
				if (!started || generation !== standaloneFxGeneration || holdMs === null) return;
				standaloneFxStopTimer = window.setTimeout(() => {
					if (generation === standaloneFxGeneration) stopStandaloneFx();
				}, holdMs);
			});
		};
		if (delayMs > 0) standaloneFxStartTimer = window.setTimeout(start, delayMs);
		else start();
	}

	function operatorCueKey(context, cue, sequence) {
		if (context.source === 'live') {
			return `live:${String(context.roundId ?? 'local')}:${cue.eventIndex}:${sequence}`;
		}
		if (context.source === 'replay') {
			return `replay:${context.playbackGeneration}:${cue.eventIndex}:${sequence}`;
		}
		return `fixture:${context.playbackGeneration}:${cue.eventIndex}:${sequence}`;
	}

	function operatorRoundSequenceKey(context, sequence) {
		if (context.source === 'live') {
			return `live:${String(context.roundId ?? 'local')}:round:${sequence}`;
		}
		return `${context.source}:${context.playbackGeneration}:round:${sequence}`;
	}

	function standaloneFxCueKey(context, cue, name) {
		return operatorCueKey(context, cue, `fx:${name}`);
	}

	function standaloneFxRoundKey(context, name) {
		return operatorRoundSequenceKey(context, `fx:${name}`);
	}

	function presentationAudioOptions(context, cue, ordinal = 0) {
		// Playback generations are presentation cancellation tokens, not replay
		// identity. Keeping them out of the audio key makes Play Again select the
		// same cosmetic variants for the same validated event stream.
		const roundOrReplayId = `${context.source}:${String(context.roundId ?? 'local')}`;
		return {
			roundOrReplayId,
			eventIndex: cue.eventIndex,
			ordinal,
		};
	}

	function playPresentationAudio(audioCue, cue, context, ordinal = 0, options = {}) {
		return audioDirector?.play(audioCue, {
			...presentationAudioOptions(context, cue, ordinal),
			...options,
		}) ?? false;
	}

	function ensureVaultAudioReady() {
		if (!audioDirector) return Promise.resolve([]);
		vaultAudioPreloadPromise ??= audioDirector.preloadVault();
		return vaultAudioPreloadPromise;
	}

	function finishWinRollup({ emitEnd = false } = {}) {
		if (winRollupTimer !== null) window.clearInterval(winRollupTimer);
		winRollupTimer = null;
		winRollupDisplayedRaw = winRollupTargetRaw;
		audioDirector?.stop('win.rollup.loop');
		if (emitEnd && winRollupAuthority) {
			const { cue, context } = winRollupAuthority;
			playPresentationAudio('win.rollup.end', cue, context, 1);
		}
		winRollupAuthority = null;
		winRollupActive = false;
	}

	function startWinRollup(cue, state, context, tierCue) {
		if (!['win.big', 'win.top'].includes(tierCue)) {
			winRollupDisplayedRaw = state.cumulativeWinRaw ?? 0;
			return false;
		}
		if (winRollupActive) finishWinRollup({ emitEnd: true });
		const stepRaw = Math.max(0, Number(cue.event?.step_payout_raw) || 0);
		const targetRaw = Math.max(0, Number(cue.event?.cumulative_after_raw ?? state.cumulativeWinRaw) || 0);
		const startRaw = Math.max(0, targetRaw - stepRaw);
		if (targetRaw <= startRaw) {
			winRollupDisplayedRaw = targetRaw;
			return false;
		}
		const durationMs = turboEnabled
			? WIN_ROLLUP_DURATION_MS.turbo
			: tierCue === 'win.top'
				? WIN_ROLLUP_DURATION_MS.top
				: WIN_ROLLUP_DURATION_MS.big;
		const startedAt = Date.now();
		winRollupDisplayedRaw = startRaw;
		winRollupTargetRaw = targetRaw;
		winRollupAuthority = { cue, context };
		winRollupActive = true;
		playPresentationAudio('win.rollup.loop', cue, context, 0);
		winRollupTimer = window.setInterval(() => {
			const progress = Math.min(1, (Date.now() - startedAt) / durationMs);
			const eased = 1 - (1 - progress) ** 3;
			winRollupDisplayedRaw = startRaw + Math.floor((targetRaw - startRaw) * eased);
			if (progress >= 1) finishWinRollup({ emitEnd: true });
		}, 16);
		return true;
	}

	function audioInteractiveControl(event) {
		if (!(event.target instanceof Element)) return null;
		return event.target.closest('button, [role="button"], input, select');
	}

	function audioControlDisabled(control) {
		return control?.matches?.(':disabled, [aria-disabled="true"]') === true;
	}

	function playUiDeny() {
		const now = Date.now();
		if (now - lastUiDenyAt < UI_DENY_COOLDOWN_MS) return false;
		lastUiDenyAt = now;
		return audioDirector?.play('ui.deny', { dedupe: false }) ?? false;
	}

	function handleUiPointerOver(event) {
		if (event.pointerType && event.pointerType !== 'mouse') return;
		if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
		const control = audioInteractiveControl(event);
		if (!control || audioControlDisabled(control)) return;
		if (event.relatedTarget instanceof Node && control.contains(event.relatedTarget)) return;
		const now = Date.now();
		if (now - (uiHoverTimes.get(control) ?? -Infinity) < UI_HOVER_COOLDOWN_MS) return;
		uiHoverTimes.set(control, now);
		audioDirector?.play('ui.hover', { dedupe: false });
	}

	function playUiActivationStart(control) {
		if (!control) return;
		if (audioControlDisabled(control)) {
			playUiDeny();
			return;
		}
		if (['primary-action', 'global-mute-toggle'].includes(control.dataset.testid)) return;
		audioDirector?.play('ui.press', { dedupe: false });
	}

	function handleUiPointerDown(event) {
		playUiActivationStart(audioInteractiveControl(event));
	}

	function handleUiKeyActivation(event) {
		if (event.repeat || !['Enter', ' '].includes(event.key)) return;
		playUiActivationStart(audioInteractiveControl(event));
	}

	function syncRuntimeAudioState(directorInstance, error) {
		if (!directorInstance) return;
		const nextKey = error ? `${String(error.code ?? 'RUNTIME_ERROR')}|${String(error.message ?? '')}` : null;
		if (nextKey === lastRuntimeAudioErrorKey) return;
		const previousKey = lastRuntimeAudioErrorKey;
		lastRuntimeAudioErrorKey = nextKey;
		if (nextKey) {
			if (/INSUFFICIENT|INVALID|FORBIDDEN|DISABLED|BLOCKED/iu.test(nextKey)) playUiDeny();
			else directorInstance.play('ui.error', { dedupe: false });
		} else if (previousKey) {
			directorInstance.play('operative.recover', { dedupe: false });
		}
	}

	function boardAudioEvents(cue) {
		const board = cue.event?.board;
		if (!Array.isArray(board)) return [];
		const breachReels = boardVaultReels(board);
		const events = board.map((reel, column) => {
			const delayMs = column * (turboEnabled ? 35 : 82);
			return { cueId: `reel.stop.${column + 1}`, ordinal: column + 1, delayMs };
		});
		let breachLandOrdinal = 0;
		for (let column = 0; column < board.length; column += 1) {
			const reel = board[column];
			if (!Array.isArray(reel)) continue;
			let cueId = 'symbol.land.regular';
			if (reel.includes('breach')) {
				breachLandOrdinal += 1;
				if (breachLandOrdinal > 2) continue;
				cueId = `breach.land.${breachLandOrdinal}`;
			} else if (reel.includes('ghost_wild')) {
				cueId = 'symbol.land.ghost_wild';
			} else if (reel.some((symbol) => GUIDE_HIGH_SYMBOLS.includes(symbol))) {
				cueId = 'symbol.land.high';
			}
			events.push({
				cueId,
				ordinal: column + 1,
				delayMs: column * (turboEnabled ? 35 : 82),
				pan: -0.8 + column * 0.4,
			});
		}
		events.push({ cueId: 'spin.complete', ordinal: 0, delayMs: turboEnabled ? 175 : 410 });
		const secondBreachReel = breachReels[1] ?? -1;
		if (cue.event?.phase === 'base' && secondBreachReel >= 0 && secondBreachReel < 4) {
			// One bounded anticipation cue is enough. `ambience.tension` used the
			// same machine sample on a second bus and only doubled the buzz.
			events.push({ cueId: 'anticipation.confirmed', ordinal: 0, sustained: true });
			events.push({ cueId: 'operative.anticipation', ordinal: 0 });
			if (breachReels.length === 2) {
				events.push({
					cueId: 'anticipation.release',
					ordinal: 0,
					delayMs: turboEnabled ? TURBO_VAULT_ANTICIPATION_MS : NORMAL_VAULT_ANTICIPATION_MS,
				});
			}
		}
		return events;
	}

	function winTierAudioCue(event, state) {
		const modeCost = state.mode ? getMode(state.mode).costMultiplier : selectedMode.costMultiplier;
		const returnPerCostRaw = (event?.step_payout_raw ?? 0) / Math.max(1, modeCost);
		if (returnPerCostRaw >= 5_000) return 'win.top';
		if (returnPerCostRaw >= 1_000) return 'win.big';
		if (returnPerCostRaw >= 500) return 'win.medium';
		if (returnPerCostRaw >= 100) return 'win.small';
		return 'win.micro';
	}

	function authoritativeAudioEvents(cue, state, { includeDeferredVault = false } = {}) {
		switch (cue.kind) {
			case 'round_started': {
				const events = [
					{ cueId: 'spin.confirmed', ordinal: 0 },
					{ cueId: 'operative.spin', ordinal: 0 },
				];
				// Normal play uses the start whoosh plus spatial reel stops. The old
				// 1.2 s motor sample repeated across consecutive spins like a drill.
				if (turboEnabled) events.splice(1, 0, { cueId: 'reels.turbo.attack', ordinal: 0 });
				if (cue.event?.mode === 'deep_access') events.push({ cueId: 'mode.deep_access', ordinal: 0 });
				if (cue.event?.mode === 'blackout') events.push({ cueId: 'blackout.direct.prep', ordinal: 0 });
				return events;
			}
			case 'board_snapshot':
				return boardAudioEvents(cue);
			case 'expansion':
				return [
					{ cueId: 'feature.expand.attack', ordinal: 0 },
					...(cue.event?.expanded_reels ?? []).map((column) => ({
						cueId: 'feature.expand.reel',
						ordinal: column + 1,
						pan: -0.8 + column * 0.4,
					})),
					{ cueId: 'feature.expand.settle', ordinal: 0, delayMs: turboEnabled ? 140 : 360 },
				];
			case 'win': {
				const tierCue = winTierAudioCue(cue.event, state);
				return [
					{ cueId: tierCue, ordinal: 0 },
					{ cueId: ['win.big', 'win.top'].includes(tierCue) ? 'operative.big_win' : 'operative.win', ordinal: 0 },
				];
			}
			case 'feature_armed':
				return [{ cueId: 'breach.trigger', ordinal: 0 }];
			case 'feature_started': {
				const events = [
					{ cueId: 'blackout.enter', ordinal: 0 },
					{ cueId: 'feature.target.confirm', ordinal: 0 },
					{ cueId: 'operative.bonus', ordinal: 0 },
				];
				if (includeDeferredVault) {
					events.push(
						{ cueId: 'vault.hold', ordinal: 0 },
						{ cueId: 'vault.focus', ordinal: 0 },
						...Array.from({ length: 6 }, (_, index) => ({ cueId: `vault.lock.${index + 1}`, ordinal: 0 })),
						{ cueId: 'vault.wheel', ordinal: 0 },
						{ cueId: 'vault.pressure', ordinal: 0 },
						{ cueId: 'vault.bolts', ordinal: 0 },
						{ cueId: 'vault.door', ordinal: 0 },
						{ cueId: 'vault.door.impact', ordinal: 0 },
						{ cueId: 'vault.gold', ordinal: 0 },
						{ cueId: 'vault.camera', ordinal: 0 },
						{ cueId: 'vault.handoff', ordinal: 0 },
					);
				}
				return events;
			}
			case 'feature_cycle':
				return [
					{ cueId: 'feature.spin.count', ordinal: cue.event?.free_spin_index ?? 0 },
					...(turboEnabled ? [{ cueId: 'reels.turbo.attack', ordinal: 0 }] : []),
					{ cueId: 'operative.spin', ordinal: cue.event?.free_spin_index ?? 0 },
				];
			case 'cap_reached':
				return [
					{ cueId: 'win.max', ordinal: 0 },
					{ cueId: 'operative.big_win', ordinal: 0 },
				];
			case 'feature_ended':
				return [{ cueId: 'feature.summary.open', ordinal: 0 }];
			case 'settled':
				if (cue.event?.payout_multiplier_raw === 0) {
					return [
						{ cueId: 'round.loss', ordinal: 0 },
						{ cueId: 'operative.loss', ordinal: 0 },
					];
				}
				return roundTerminalAudioAcknowledged
					? []
					: [{ cueId: 'round.complete', ordinal: 0 }];
			default:
				return [];
		}
	}

	function playAuthoritativeAudio(cue, state, context) {
		for (const event of authoritativeAudioEvents(cue, state)) {
			playPresentationAudio(event.cueId, cue, context, event.ordinal, {
				delayMs: event.delayMs,
				pan: event.pan,
			});
		}
	}

	function primeAuthoritativeAudio(cue, state, context) {
		const events = authoritativeAudioEvents(cue, state, { includeDeferredVault: true })
			.filter((event) => !event.sustained)
			.map((event) => ({
				...presentationAudioOptions(context, cue, event.ordinal),
				cueId: event.cueId,
			}));
		audioDirector?.primeConsumed(events);
	}

	function resetPresentationAudio({ preserveConsumed = true, scene = 'base' } = {}) {
		finishWinRollup();
		roundTerminalAudioAcknowledged = false;
		audioDirector?.resetPresentation({ preserveConsumed });
		setPresentationAudioScene(scene);
	}

	function prewarmV28EnvironmentCandidate(phase) {
		const source = v28EnvironmentCandidateSources?.[phase];
		if (
			!source
			|| v28EnvironmentCandidateImages.some((image) => image.dataset.source === source)
		) return;
		const image = new Image();
		image.decoding = 'async';
		image.dataset.source = source;
		image.src = source;
		v28EnvironmentCandidateImages = [...v28EnvironmentCandidateImages, image];
		if (typeof image.decode === 'function') void image.decode().catch(() => {});
	}

	function setPresentationAudioScene(scene) {
		return audioDirector?.setScene(scene) ?? false;
	}

	function playVaultCinematicAudio(audioCue, cinematicState) {
		if (!vaultAudioAuthority) return false;
		const { cue, context } = vaultAudioAuthority;
		const play = (cueId, ordinal = 0, options = {}) =>
			playPresentationAudio(cueId, cue, context, ordinal, options);
		switch (audioCue) {
			case 'vault-tease':
				// A short target-acquire hit communicates the tease without leaving
				// the former 1.35 s machine sample running as a background loop.
				return play('vault.focus');
			case 'vault-notice':
				return play('vault.hold');
			case 'vault-wheel-turn':
				play('vault.focus');
				return play('vault.wheel');
			case 'vault-locks-release':
				for (let index = 0; index < 6; index += 1) {
					play(`vault.lock.${index + 1}`, 0, { delayMs: index * 90 });
				}
				play('vault.pressure', 0, { delayMs: 180 });
				return play('vault.bolts', 0, { delayMs: 420 });
			case 'vault-door-open':
				play('vault.door');
				return play('vault.door.impact', 0, { delayMs: 1_050 });
			case 'vault-light-entry':
				audioDirector?.stop('anticipation.confirmed');
				audioDirector?.stop('ambience.tension');
				play('vault.gold');
				return play('vault.camera', 0, { delayMs: 260 });
			case 'free-spins-awarded':
				return play('vault.handoff');
			case 'bonus-ready':
				audioDirector?.stop('anticipation.confirmed');
				audioDirector?.stop('ambience.tension');
				setPresentationAudioScene('blackout');
				return true;
			case 'extraction':
				return play('feature.summary.open');
			case 'return-base':
				audioDirector?.stop('anticipation.confirmed');
				audioDirector?.stop('ambience.tension');
				play('feature.summary.close');
				setPresentationAudioScene('base');
				return true;
			default:
				return false;
		}
	}

	function bindVaultAudioAuthority(cue, context) {
		vaultAudioAuthority = { cue, context };
	}

	async function handleOperatorCue(cue, state = presentation, context) {
		const suppressOutcome = context.source === 'live' && context.origin === 'restore';
		switch (cue.kind) {
			case 'round_started':
				beginOperatorPresentation();
				cancelDeferredOperatorSequence();
				finishWinRollup();
				roundTerminalAudioAcknowledged = false;
				stopExpansionFx();
				vaultCinematicDirector?.cancel('round_started');
				devVaultMotionDirector?.cancel('round_started');
				operatorAnimator?.returnToIdle('round_started');
				stopStandaloneFx();
				vaultAudioAuthority = null;
				if (context.origin !== 'restore') {
					if (cue.event?.mode === 'blackout') await ensureVaultAudioReady();
					beginReelMotion();
					playAuthoritativeAudio(cue, state, context);
				}
				setOperatorReaction('spin-start');
				break;
			case 'board_snapshot': {
				audioDirector?.stop('reels.motor.loop');
				playAuthoritativeAudio(cue, state, context);
				const anticipationPresentation = settleReelMotion({
					board: cue.event?.board,
					phase: cue.event?.phase,
					allowAnticipation: context.origin !== 'restore',
				});
				if (anticipationPresentation) {
					setOperatorReaction('vault-anticipation');
					return anticipationPresentation.then((completed) => {
						audioDirector?.stop('anticipation.confirmed');
						audioDirector?.stop('ambience.tension');
						if (!completed) return;
						setOperatorReaction(state.phase === 'feature' ? 'bonus-idle' : 'spin-loop');
					});
				}
				audioDirector?.stop('ambience.tension');
				setOperatorReaction(state.phase === 'feature' ? 'bonus-idle' : 'spin-loop');
				break;
			}
			case 'expansion':
				settleReelMotion({ board: cue.event?.evaluated_board, phase: 'feature' });
				showExpansionFx(cue.event);
				setOperatorReaction(state.phase === 'feature' ? 'bonus-idle' : 'spin-loop');
				playAuthoritativeAudio(cue, state, context);
				break;
			case 'win': {
				if (suppressOutcome) break;
				const step = cue.event?.step_payout_raw ?? 0;
				const modeCost = state.mode ? getMode(state.mode).costMultiplier : selectedMode.costMultiplier;
				const sequence = step / Math.max(1, modeCost) >= OPERATOR_BIG_WIN_CENTIX_PER_COST
					? OPERATOR_SEQUENCE.BIG_WIN
					: OPERATOR_SEQUENCE.WIN;
				if (devUiV21Enabled) setOperatorReaction(sequence === OPERATOR_SEQUENCE.BIG_WIN ? 'win-big' : 'win-small');
				const dedupeKey = sequence === OPERATOR_SEQUENCE.BIG_WIN
					? operatorRoundSequenceKey(context, sequence)
					: operatorCueKey(context, cue, sequence);
				void triggerOperatorSequence(sequence, dedupeKey);
				const fxName = sequence === OPERATOR_SEQUENCE.BIG_WIN ? 'coinBurst' : 'winFlash';
				const fxKey = sequence === OPERATOR_SEQUENCE.BIG_WIN
					? standaloneFxRoundKey(context, fxName)
					: standaloneFxCueKey(context, cue, fxName);
				scheduleStandaloneFx(fxName, fxKey, {
					delayMs: sequence === OPERATOR_SEQUENCE.BIG_WIN ? 220 : 90,
				});
				playAuthoritativeAudio(cue, state, context);
				startWinRollup(cue, state, context, winTierAudioCue(cue.event, state));
				roundTerminalAudioAcknowledged = true;
				break;
			}
			case 'feature_armed':
				setOperatorReaction('feature-tease');
				if (!suppressOutcome) {
					prewarmV28EnvironmentCandidate('blackout');
					audioDirector?.stop('anticipation.confirmed');
					audioDirector?.stop('ambience.tension');
					playAuthoritativeAudio(cue, state, context);
					void ensureVaultAudioReady();
					bindVaultAudioAuthority(cue, context);
					vaultCinematicDirector?.arm({
						triggerCount: cue.event?.distinct_reels ?? 3,
						targetSymbol: state.featureTarget,
						awardedSpins: cue.event?.awarded_free_spins,
					});
					scheduleStandaloneFx(
						'bonusCratePulse',
						standaloneFxCueKey(context, cue, 'bonusCratePulse'),
						{ holdMs: 720 },
					);
				}
				break;
			case 'feature_started': {
				setOperatorReaction('feature-trigger');
				prewarmV28EnvironmentCandidate('blackout');
				await ensureVaultAudioReady();
				audioDirector?.stop('anticipation.confirmed');
				audioDirector?.stop('ambience.tension');
				setPresentationAudioScene('blackout');
				if (!suppressOutcome) {
					playAuthoritativeAudio(cue, state, context);
					bindVaultAudioAuthority(cue, context);
					void triggerOperatorSequence(
						OPERATOR_SEQUENCE.BONUS,
						operatorCueKey(context, cue, OPERATOR_SEQUENCE.BONUS),
					);
					scheduleStandaloneFx(
						'bonusCrateSpin',
						standaloneFxCueKey(context, cue, 'bonusCrateSpin'),
						{ delayMs: 180, holdMs: 1_340 },
					);
					const cinematicOptions = {
						direct: cue.event?.direct === true,
						targetSymbol: cue.event?.target_symbol ?? state.featureTarget,
						awardedSpins: cue.event?.total_free_spins,
						turbo: turboEnabled,
						reducedMotion: reducedMotionQuery?.matches === true,
					};
					const cinematicPlay = vaultCinematicDirector?.play(cinematicOptions);
					if (!devVaultRigEnabled || !devVaultMotionDirector) return cinematicPlay;
					// The DEV rig is presentation-only. A throttled or backgrounded rAF
					// must never delay the authoritative feature timeline or settlement.
					void devVaultMotionDirector.play(cinematicOptions);
					return cinematicPlay;
				}
				break;
			}
			case 'feature_cycle':
				beginReelMotion();
				setOperatorReaction('bonus-idle');
				playAuthoritativeAudio(cue, state, context);
				break;
			case 'cap_reached': {
				const featureCap = state.phase === 'feature';
				if (winRollupActive) finishWinRollup({ emitEnd: true });
				if (!suppressOutcome) {
					bindVaultAudioAuthority(cue, context);
					vaultCinematicDirector?.showCapReport({
						reportScope: featureCap ? 'feature' : 'base',
						targetSymbol: featureCap ? state.featureTarget : null,
						awardedSpins: featureCap ? state.totalFreeSpins : null,
						completedSpins: featureCap ? state.freeSpinIndex : null,
						capRaw: cue.event?.cap_raw,
						winRaw: cue.event?.cumulative_payout_raw,
					});
				}
				if (!suppressOutcome && operatorFrame.sequence !== OPERATOR_SEQUENCE.BIG_WIN) {
					if (
						operatorFrame.sequence === OPERATOR_SEQUENCE.BONUS
						|| operatorBonusTriggerPending > 0
					) {
						deferCapBigWin(context);
					} else {
						void triggerOperatorSequence(
							OPERATOR_SEQUENCE.BIG_WIN,
							operatorRoundSequenceKey(context, OPERATOR_SEQUENCE.BIG_WIN),
						);
						scheduleStandaloneFx(
							'coinBurst',
							standaloneFxRoundKey(context, 'coinBurst'),
							{ delayMs: 220 },
						);
					}
				}
				if (!suppressOutcome) playAuthoritativeAudio(cue, state, context);
				if (!suppressOutcome) roundTerminalAudioAcknowledged = true;
				break;
			}
			case 'feature_ended':
				markOperatorPresentationTerminal();
				stopReelMotion();
				audioDirector?.stop('anticipation.confirmed');
				audioDirector?.stop('ambience.tension');
				setPresentationAudioScene('base');
				if (winRollupActive) finishWinRollup({ emitEnd: true });
				setOperatorReaction('recover');
				if (!suppressOutcome) playAuthoritativeAudio(cue, state, context);
				if (!suppressOutcome) roundTerminalAudioAcknowledged = true;
				if (!suppressOutcome && !autoRunning) {
					bindVaultAudioAuthority(cue, context);
					vaultCinematicDirector?.showExtraction({
						targetSymbol: state.featureTarget,
						awardedSpins: state.totalFreeSpins,
						winRaw: cue.event?.cumulative_payout_raw ?? state.cumulativeWinRaw,
						capped: cue.event?.capped === true,
					});
				}
				break;
			case 'settled':
				markOperatorPresentationTerminal();
				stopReelMotion();
				if (winRollupActive) finishWinRollup({ emitEnd: true });
				audioDirector?.stop('reels.motor.loop');
				audioDirector?.stop('anticipation.confirmed');
				audioDirector?.stop('ambience.tension');
				if (cue.event?.payout_multiplier_raw === 0) {
					if (devUiV21Enabled) setOperatorReaction('loss');
					if (context.source !== 'live') {
						void triggerOperatorSequence(
							OPERATOR_SEQUENCE.LOSS,
							operatorCueKey(context, cue, OPERATOR_SEQUENCE.LOSS),
						);
					}
					if (!suppressOutcome) playAuthoritativeAudio(cue, state, context);
				} else {
					if (!suppressOutcome) {
						playAuthoritativeAudio(cue, state, context);
						roundTerminalAudioAcknowledged = true;
					}
					if (penguinOperatorEnabled || operatorFrame.sequence === OPERATOR_SEQUENCE.IDLE) {
						setOperatorReaction('recover');
					}
				}
				if (!vaultCinematicState.active || autoRunning) setPresentationAudioScene('base');
				break;
		}
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

	function randomFixtureMode(fixtureId) {
		return DEV_RANDOM_FIXTURE_PATTERN.exec(fixtureId)?.[1] ?? null;
	}

	function isRandomDevelopmentFixture(fixture = activeFixture) {
		return fixture?.mathBacked === true && randomFixtureMode(fixture?.id) !== null;
	}

	async function sampleDevelopmentMathFixture(fixtureId, adapter) {
		const mode = randomFixtureMode(fixtureId);
		if (!mode) throw new Error(`Unknown random development fixture: ${fixtureId}`);
		const response = await fetch(`/__blacksite/dev/math-round?mode=${encodeURIComponent(mode)}`, {
			cache: 'no-store',
			headers: { accept: 'application/json' },
		});
		if (!response.ok) {
			let detail = null;
			try {
				detail = await response.json();
			} catch {
				// The status code remains the useful bounded fallback.
			}
			throw new Error(detail?.error?.message ?? `DEV Math sampler returned HTTP ${response.status}.`);
		}
		const sampledFixture = await response.json();
		if (
			sampledFixture?.fixtureId !== fixtureId
			|| sampledFixture?.mode !== mode
			|| sampledFixture?.mathBacked !== true
			|| !sampledFixture?.book
		) {
			throw new Error('DEV Math sampler returned an invalid fixture envelope.');
		}
		const sampledCues = adapter.adaptBook(sampledFixture.book, { expectedMode: mode });
		activeFixture = {
			...sampledFixture,
			id: fixtureId,
		};
		activeCues = sampledCues;
		selectedModeId = mode;
		finalWinRaw = 0;
		return activeFixture;
	}

	async function playFixture() {
		if (!director || !activeFixture) return;
		if (isRandomDevelopmentFixture()) {
			primaryBusy = true;
			runtimeError = null;
			runtimeState = 'fixture-sampling';
			try {
				if (!developmentFixtureAdapter) throw new Error('DEV Math adapter is unavailable.');
				await sampleDevelopmentMathFixture(activeFixture.id, developmentFixtureAdapter);
			} catch (error) {
				runtimeError = publicError(error, 'DEV_MATH_SAMPLE_FAILED');
				runtimeState = 'fixture-error';
				primaryBusy = false;
				return;
			}
		}
		if (activeCues.length === 0) {
			primaryBusy = false;
			return;
		}
		cancelDeferredOperatorSequence();
		operatorAnimator?.returnToIdle('fixture_playback_started');
		beginReelMotion();
		fixturePlaybackGeneration += 1;
		const playbackGeneration = fixturePlaybackGeneration;
		primaryBusy = true;
		runtimeState = 'fixture-playing';
		try {
			director.reset();
			await director.play(activeCues, {
				...playbackTiming(),
				onCue: (cue, state) => handleOperatorCue(cue, state, {
					source: 'fixture',
					origin: null,
					playbackGeneration,
					roundId: activeFixture.book.id,
				}),
			});
			finalWinRaw = activeFixture.book.payoutMultiplier;
			runtimeState = 'fixture-completed';
		} finally {
			if (runtimeState !== 'fixture-completed') stopReelMotion();
			primaryBusy = false;
		}
	}

	function handleLiveState(nextState) {
		liveSnapshot = nextState;
		if (sessionOpeningBalanceApi === null && nextState.balance) {
			sessionOpeningBalanceApi = nextState.balance.amountApi;
		}
		if (nextState.config?.jurisdiction?.displaySessionTimer === true && sessionTimerHandle === null) {
			const sessionStartedAtMs = Date.now();
			sessionTimerHandle = window.setInterval(() => {
				sessionElapsedSeconds = Math.floor((Date.now() - sessionStartedAtMs) / 1_000);
			}, 1_000);
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
		if (nextState.status === 'loading' || nextState.status === 'ready' || nextState.status === 'playing') {
			finalWinRaw = 0;
		}
		if (nextState.error) runtimeError = nextState.error;
	}

	async function loadDevelopmentFixture(fixtureId, adapter) {
		if (!__BLACKSITE_DEV_FIXTURES__) {
			fixtureFailure('DEV_FIXTURE_FORBIDDEN', 'Development fixtures are disabled.');
			return;
		}
		developmentFixtureAdapter = adapter;
		const randomMode = randomFixtureMode(fixtureId);
		if (randomMode) {
			activeFixture = {
				id: fixtureId,
				fixtureId,
				mode: randomMode,
				mathBacked: true,
				bookId: null,
				lookupWeight: null,
				book: null,
			};
			activeCues = [];
			selectedModeId = randomMode;
			finalWinRaw = 0;
			runtimeState = 'fixture-ready';
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
		const roundOrigin = pendingRoundOrigin;
		let roundDedupeToken = round.roundId;
		if (roundDedupeToken == null) {
			roundDedupeToken = fallbackLiveRoundTokens.get(round);
			if (!roundDedupeToken) {
				roundDedupeToken = `local-live:${++fallbackLiveRoundId}`;
				fallbackLiveRoundTokens.set(round, roundDedupeToken);
			}
		}
		const presentationContext = {
			source: 'live',
			origin: roundOrigin,
			roundId: roundDedupeToken,
			playbackGeneration: 0,
		};
		primaryBusy = true;
		runtimeError = null;
		runtimeState = roundOrigin === 'play' ? 'live-presenting' : 'live-restoring';

		try {
			finishWinRollup();
			roundTerminalAudioAcknowledged = false;
			audioDirector?.resetPresentation({ preserveConsumed: true });
			director.reset();
			if (roundOrigin === 'play') await waitForMinimumRoundDuration();
			const plan = roundOrigin === 'restore'
				? planPresentationRestore(round.cues, round.eventCursor ?? 0)
				: planPresentationRestore(round.cues, 0);
			for (const cue of plan.primeCues) {
				director.consume(cue);
				primeAuthoritativeAudio(cue, director.state, presentationContext);
			}
			if (director.state.phase === 'feature') {
				prewarmV28EnvironmentCandidate('blackout');
				await ensureVaultAudioReady();
			}
			setPresentationAudioScene(director.state.phase === 'feature' ? 'blackout' : 'base');
			const completed = await director.play(plan.resumeCues, {
				...playbackTiming(),
				onCue: async (cue) => {
					await handleOperatorCue(cue, director.state, presentationContext);
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
			try {
				if (roundOrigin === 'play' && liveOutcomeStreak) {
					const outcome = liveOutcomeStreak.commit({
						dedupeToken: roundDedupeToken,
						payoutRaw: round.payoutMultiplierRaw,
					});
					operatorZeroStreak = outcome.zeroStreak;
					if (outcome.accepted && outcome.reaction) {
						const outcomeAudioCue = outcome.reaction === OPERATOR_SEQUENCE.RAGE
							? 'operative.rage'
							: outcome.reaction === OPERATOR_SEQUENCE.LOSS_STREAK
								? 'operative.loss_streak'
								: null;
						if (outcomeAudioCue) {
							audioDirector?.play(outcomeAudioCue, {
								roundOrReplayId: `live:${String(roundDedupeToken)}`,
								eventIndex: round.cues.at(-1)?.eventIndex ?? Math.max(0, round.cues.length - 1),
								ordinal: 0,
							});
						}
						await triggerOperatorSequence(
							outcome.reaction,
							`live-outcome:${typeof roundDedupeToken}:${String(roundDedupeToken)}:${outcome.reaction}`,
						);
						if (outcome.reaction === OPERATOR_SEQUENCE.RAGE) {
							scheduleStandaloneFx(
								'screenImpact',
								`live-outcome:${typeof roundDedupeToken}:${String(roundDedupeToken)}:fx:screenImpact`,
								{ delayMs: 620 },
							);
						}
					}
				}
			} catch {
				// Cosmetic reactions can never invalidate an already settled RGS round.
			}
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
		beginReelMotion();
		pendingRoundOrigin = 'play';
		runtimeError = null;
		finalWinApi = null;
		finalWinRaw = 0;
		liveRoundStartedAtMs = Date.now();
		try {
			await liveSession.play(selectedModeId);
		} catch (error) {
			stopReelMotion();
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

	async function confirmLivePlay() {
		audioDirector?.play('ui-confirm');
		const focusTarget = returnFocusElement;
		confirmationOpen = false;
		returnFocusElement = null;
		await tick();
		focusTarget?.focus?.();
		void executeLivePlay();
	}

	function rememberFocus() {
		returnFocusElement = document.activeElement instanceof HTMLElement
			? document.activeElement
			: null;
	}

	function handleBootStateChange(event) {
		bootSequenceState = event.detail?.state ?? BOOT_SEQUENCE_STATE.BOOT;
	}

	function waitForBootGameReady() {
		if (bootSequenceState === BOOT_SEQUENCE_STATE.GAME_READY) return Promise.resolve();
		return new Promise((resolve) => bootReadyWaiters.push(resolve));
	}

	function handleBootMissionAccepted() {
		void audioDirector?.unlock?.();
		audioDirector?.play('ui-confirm', { dedupe: false });
	}

	function handleBootReady(event) {
		bootSequenceState = event.detail?.state ?? BOOT_SEQUENCE_STATE.GAME_READY;
		const waiters = bootReadyWaiters;
		bootReadyWaiters = [];
		for (const resolve of waiters) resolve();
		void tick().then(() => primaryActionButton?.focus?.({ preventScroll: true }));
	}

	async function replayBootIntro() {
		if (primaryBusy || vaultCinematicState.active) return;
		audioDirector?.play('ui-select', { dedupe: false });
		rulesOpen = false;
		menuOpen = false;
		settingsOpen = false;
		returnFocusElement = null;
		await tick();
		bootSequenceComponent?.replayIntro?.();
	}

	async function reopenMissionBriefing() {
		if (primaryBusy || vaultCinematicState.active) return;
		audioDirector?.play('ui-select', { dedupe: false });
		rulesOpen = false;
		menuOpen = false;
		settingsOpen = false;
		returnFocusElement = null;
		await tick();
		bootSequenceComponent?.openMissionBriefing?.();
	}

	function focusConfirmationEntry() {
		const shortViewport = window.matchMedia('(max-width: 700px) and (max-height: 430px)').matches;
		if (shortViewport) {
			confirmationDialog?.querySelector('.confirmation-scroll')?.scrollTo({ top: 0 });
			confirmationDialog?.focus({ preventScroll: true });
			return;
		}
		confirmationCancelButton?.focus();
	}

	async function openConfirmation() {
		rememberFocus();
		audioDirector?.play('ui-open');
		confirmationOpen = true;
		await tick();
		focusConfirmationEntry();
	}

	async function closeConfirmation() {
		audioDirector?.play('ui.cancel', { dedupe: false });
		const focusTarget = returnFocusElement;
		confirmationOpen = false;
		returnFocusElement = null;
		await tick();
		focusTarget?.focus?.();
	}

	async function openRules(initialTab = 'overview') {
		if (primaryBusy || vaultCinematicState.active) return;
		if (autoRunning) stopAutoplay();
		rememberFocus();
		audioDirector?.play('ui-open');
		guideTab = GUIDE_TABS.some((tab) => tab.id === initialTab) ? initialTab : 'overview';
		rulesOpen = true;
		await tick();
		rulesCloseButton?.focus();
	}

	async function closeRules() {
		audioDirector?.play('ui.modal.close', { dedupe: false });
		const focusTarget = returnFocusElement;
		rulesOpen = false;
		returnFocusElement = null;
		await tick();
		focusTarget?.focus?.();
	}

	function modeTotalText(modeId) {
		const amount = safeTotalAmount(baseAmountApi, modeId);
		return amount > 0 ? formatExactApi(amount, currency) : '—';
	}

	function modeCardState(modeId) {
		if (modeId === selectedModeId) return devFixtureUiPreview ? 'CURRENT' : 'ACTIVE';
		if (devFixtureUiPreview) return 'PREVIEW';
		if (autoRunning || launch.kind !== 'live' || liveSnapshot.status !== 'ready' || primaryBusy) {
			return 'UNAVAILABLE';
		}
		return 'SELECT';
	}

	async function openSettings() {
		if (primaryBusy || vaultCinematicState.active) return;
		if (autoRunning) stopAutoplay();
		rememberFocus();
		audioDirector?.play('ui-open');
		settingsOpen = true;
		await tick();
		settingsCloseButton?.focus();
	}

	async function closeSettings() {
		audioDirector?.play('ui.modal.close', { dedupe: false });
		const focusTarget = returnFocusElement;
		settingsOpen = false;
		returnFocusElement = null;
		await tick();
		focusTarget?.focus?.();
	}

	async function openMenu() {
		if (primaryBusy || vaultCinematicState.active) return;
		if (autoRunning) stopAutoplay();
		rememberFocus();
		audioDirector?.play('ui-open');
		menuOpen = true;
		await tick();
		menuCloseButton?.focus();
	}

	async function closeMenu() {
		audioDirector?.play('ui.modal.close', { dedupe: false });
		const focusTarget = returnFocusElement;
		menuOpen = false;
		returnFocusElement = null;
		await tick();
		focusTarget?.focus?.();
	}

	async function openModeDialog() {
		if (autoRunning) stopAutoplay();
		if (launch.kind !== 'live' && !devFixtureUiPreview) return;
		if (primaryBusy || vaultCinematicState.active || (launch.kind === 'live' && liveSnapshot.status !== 'ready')) return;
		rememberFocus();
		audioDirector?.play('ui-open');
		modeDialogOpen = true;
		await tick();
		modeCloseButton?.focus();
	}

	async function closeModeDialog() {
		audioDirector?.play('ui.modal.close', { dedupe: false });
		const focusTarget = returnFocusElement;
		modeDialogOpen = false;
		returnFocusElement = null;
		await tick();
		focusTarget?.focus?.();
	}

	async function chooseMode(modeId) {
		audioDirector?.play('ui-select');
		if (devFixtureUiPreview) {
			if (modeId !== selectedModeId) return;
			modeDialogOpen = false;
			confirmationOpen = true;
			await tick();
			focusConfirmationEntry();
			return;
		}
		selectMode(modeId);
		await closeModeDialog();
	}

	async function openRulesFromMenu() {
		if (primaryBusy || vaultCinematicState.active) return;
		audioDirector?.play('ui-select');
		menuOpen = false;
		guideTab = 'overview';
		rulesOpen = true;
		await tick();
		rulesCloseButton?.focus();
	}

	async function openModeDialogFromMenu() {
		if (primaryBusy || vaultCinematicState.active || (launch.kind === 'live' && liveSnapshot.status !== 'ready')) return;
		audioDirector?.play('ui-select');
		menuOpen = false;
		modeDialogOpen = true;
		await tick();
		modeCloseButton?.focus();
	}

	async function selectGuideTab(tabId, { focusTab = false } = {}) {
		if (!GUIDE_TABS.some((tab) => tab.id === tabId)) return;
		guideTab = tabId;
		await tick();
		if (guideScroll) guideScroll.scrollTop = 0;
		if (focusTab) document.getElementById(`game-guide-tab-${tabId}`)?.focus?.();
	}

	function handleGuideTabKey(event, index) {
		let nextIndex = null;
		if (event.key === 'ArrowRight') nextIndex = (index + 1) % GUIDE_TABS.length;
		else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + GUIDE_TABS.length) % GUIDE_TABS.length;
		else if (event.key === 'Home') nextIndex = 0;
		else if (event.key === 'End') nextIndex = GUIDE_TABS.length - 1;
		if (nextIndex === null) return;
		event.preventDefault();
		void selectGuideTab(GUIDE_TABS[nextIndex].id, { focusTab: true });
	}

	function toggleAudioMuted() {
		if (!audioDirector) return;
		if (audioMuted) {
			audioMuted = audioDirector.setMuted(false).muted;
			audioDirector.play('ui.toggle.on');
		} else {
			audioMuted = audioDirector.muteWithCue('ui.toggle.off').muted;
		}
	}

	function toggleTurboPresentation() {
		if (turboDisabled) {
			playUiDeny();
			return;
		}
		turboEnabled = !turboEnabled;
		audioDirector?.play(turboEnabled ? 'ui.toggle.on' : 'ui.toggle.off', { dedupe: false });
	}

	function toggleRageOut() {
		if (launch.kind !== 'live') {
			playUiDeny();
			return;
		}
		rageOutEnabled = !rageOutEnabled;
		if (liveOutcomeStreak) liveOutcomeStreak.rageEnabled = rageOutEnabled;
		audioDirector?.play(rageOutEnabled ? 'ui.toggle.on' : 'ui.toggle.off', { dedupe: false });
	}

	function skipVaultCinematic() {
		vaultCinematicDirector?.skip();
		if (devVaultRigEnabled) devVaultMotionDirector?.skip();
	}

	function returnVaultToBase() {
		vaultCinematicDirector?.returnToBase();
		devVaultMotionDirector?.cancel('return_to_base');
		setPresentationAudioScene('base');
		vaultAudioAuthority = null;
	}

	function closePageDialogsForVault() {
		confirmationOpen = false;
		rulesOpen = false;
		settingsOpen = false;
		autoDialogOpen = false;
		menuOpen = false;
		modeDialogOpen = false;
		returnFocusElement = null;
	}

	async function openAutoDialog() {
		const devPreview = __BLACKSITE_DEV_FIXTURES__ && launch.kind === 'fixture';
		if (primaryBusy || vaultCinematicState.active || (!devPreview && launch.kind !== 'live') || (autoplayDisabled && !devPreview)) return;
		rememberFocus();
		audioDirector?.play('ui-open');
		autoDialogOpen = true;
		await tick();
		autoCloseButton?.focus();
	}

	async function closeAutoDialog() {
		audioDirector?.play('ui.modal.close', { dedupe: false });
		const focusTarget = returnFocusElement;
		autoDialogOpen = false;
		returnFocusElement = null;
		await tick();
		focusTarget?.focus?.();
	}

	function activateHudAuto() {
		if (launch.kind === 'replay') {
			void activatePrimary();
			return;
		}
		if (autoplayDisabled && !devFixtureUiPreview) return;
		if (autoRunning) {
			stopAutoplay();
			return;
		}
		void openAutoDialog();
	}

	async function startAutoplay() {
		if (!autoEligible || ![5, 10, 25].includes(autoSpinCount)) return;
		const focusTarget = returnFocusElement;
		autoDialogOpen = false;
		returnFocusElement = null;
		autoRemaining = autoSpinCount;
		autoRunning = true;
		autoFinishing = false;
		autoLifecycleGeneration += 1;
		autoAwaitingRound = false;
		autoRoundStarted = false;
		await tick();
		focusTarget?.focus?.();
		queueAutoSpin(0);
	}

	function stopAutoplay() {
		autoLifecycleGeneration += 1;
		autoRunning = false;
		autoFinishing = false;
		autoAwaitingRound = false;
		autoRoundStarted = false;
		if (autoNextTimer !== null) {
			window.clearTimeout(autoNextTimer);
			autoNextTimer = null;
		}
	}

	function queueAutoSpin(delayMs = 360) {
		if (!autoRunning) return;
		if (autoRemaining <= 0) {
			stopAutoplay();
			return;
		}
		if (autoNextTimer !== null) window.clearTimeout(autoNextTimer);
		autoNextTimer = window.setTimeout(() => {
			autoNextTimer = null;
			runAutoSpin();
		}, delayMs);
	}

	function runAutoSpin() {
		if (!autoRunning || !autoEligible || actionDisabled) {
			stopAutoplay();
			return;
		}
		autoRemaining -= 1;
		autoAwaitingRound = true;
		autoRoundStarted = false;
		void activatePrimary();
	}

	async function finishAutoRound() {
		if (autoFinishing) return;
		autoFinishing = true;
		const generation = autoLifecycleGeneration;
		try {
			await operatorAnimator?.waitForIdle({ timeoutMs: turboEnabled ? 140 : 620 });
			if (!autoRunning || generation !== autoLifecycleGeneration) return;
			autoAwaitingRound = false;
			autoRoundStarted = false;
			if (autoRemaining <= 0) stopAutoplay();
			else queueAutoSpin(turboEnabled ? 60 : 120);
		} catch {
			if (autoRunning && generation === autoLifecycleGeneration) {
				autoAwaitingRound = false;
				autoRoundStarted = false;
				queueAutoSpin(turboEnabled ? 60 : 120);
			}
		} finally {
			if (generation === autoLifecycleGeneration) autoFinishing = false;
		}
	}

	function trapDialogFocus(event, dialog) {
		if (event.key !== 'Tab' || !dialog) return false;
		const focusable = [...dialog.querySelectorAll(
			'button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
		)].filter((element) => element instanceof HTMLElement && element.offsetParent !== null);
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

	function shiftBaseAmount(direction) {
		if (launch.kind !== 'live' || liveSnapshot.status !== 'ready' || primaryBusy) return;
		let nextAmount = baseAmountApi;
		if (betLevelsApi.length > 0) {
			const currentIndex = Math.max(0, betLevelsApi.indexOf(baseAmountApi));
			const nextIndex = Math.min(
				betLevelsApi.length - 1,
				Math.max(0, currentIndex + direction),
			);
			nextAmount = betLevelsApi[nextIndex];
		} else if (liveSnapshot.config) {
			const step = liveSnapshot.config.stepBetApi;
			nextAmount = Math.min(
				liveSnapshot.config.maxBetApi,
				Math.max(liveSnapshot.config.minBetApi, baseAmountApi + step * direction),
			);
		}
		try {
			liveSession?.selectBaseAmount(nextAmount);
			runtimeError = null;
		} catch (error) {
			runtimeError = publicError(error, 'PLAY_AMOUNT_INVALID');
		}
	}

	async function activatePrimary() {
		if (actionDisabled) return;
		if (launch.kind === 'fixture' || launch.kind === 'replay') {
			resetPresentationAudio({ preserveConsumed: false, scene: 'base' });
		}
		audioDirector?.play('spin.press');
		if (launch.kind === 'fixture') return playFixture();
		if (launch.kind === 'replay') {
			cancelDeferredOperatorSequence();
			operatorAnimator?.returnToIdle('replay_playback_started');
			beginReelMotion();
			replayPlaybackGeneration += 1;
			Object.assign(replayController, playbackTiming());
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
		fixtureRandom,
		insufficient,
	}) {
		if (launchKind === 'fixture') {
			if (fixtureRandom) return fixtureCompleted ? 'NEXT SPIN' : 'SPIN';
			return fixtureCompleted ? 'REPLAY' : 'SPIN';
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
			if (liveStatus === 'ready') return 'SPIN';
			if (liveStatus === 'authenticating') return 'AUTHENTICATING';
			if (liveStatus === 'settling') return 'SETTLING';
		}
		return 'UNAVAILABLE';
	}

	function compactPrimaryActionLabel(label) {
		if (/INSUFFICIENT/u.test(label)) return 'LOW FUNDS';
		if (/AUTHENTICATING/u.test(label)) return 'AUTH';
		if (/LOADING/u.test(label)) return 'LOADING';
		if (/CONTINUE/u.test(label)) return 'CONTINUE';
		if (/REPLAYING|REPLAY/u.test(label)) return 'REPLAY';
		if (/PLAY AGAIN/u.test(label)) return 'AGAIN';
		if (/NEXT/u.test(label)) return 'NEXT';
		if (/SETTLING/u.test(label)) return 'SETTLING';
		if (/UNAVAILABLE/u.test(label)) return 'LOCKED';
		if (/PLAY DEV/u.test(label)) return 'PLAY';
		return 'SPIN';
	}

	function displaySpecialSymbolCopy(copy) {
		return copy;
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
		assetsReady,
	}) {
		if (!assetsReady || busy || confirming || showingRules) return true;
		if (launchKind === 'fixture') return !fixtureReady;
		if (launchKind === 'replay') return !['ready', 'completed'].includes(replayStatus);
		if (launchKind === 'live') {
			return insufficient
				|| (modeBlocked && liveStatus === 'ready')
				|| !['ready', 'presenting'].includes(liveStatus);
		}
		return true;
	}

	function keydown(event) {
		if (bootInteractionLocked) return;
		handleUiKeyActivation(event);
		const openDialog = (runtimeError || launch.kind === 'error') && devUiV21Enabled
			? runtimeErrorDialog
			: modeDialogOpen
			? modeDialog
			: menuOpen
			? menuDialog
			: confirmationOpen
			? confirmationDialog
			: rulesOpen
				? rulesDialog
				: settingsOpen
					? settingsDialog
					: autoDialogOpen
						? autoDialog
						: null;
		if (openDialog && trapDialogFocus(event, openDialog)) return;
		if (event.key === 'Escape') {
			if (modeDialogOpen) void closeModeDialog();
			else if (menuOpen) void closeMenu();
			else if (confirmationOpen) void closeConfirmation();
			else if (rulesOpen) void closeRules();
			else if (settingsOpen) void closeSettings();
			else if (autoDialogOpen) void closeAutoDialog();
			else if (vaultCinematicState.active) {
				if (vaultCinematicState.state === VAULT_STATE.EXTRACTION) returnVaultToBase();
				else skipVaultCinematic();
			}
			event.preventDefault();
			return;
		}
		if (
			event.code === 'Space' &&
			launch.kind === 'live' &&
			!spacebarDisabled &&
			!confirmationOpen &&
			!modeDialogOpen &&
			!menuOpen &&
			!rulesOpen &&
			!settingsOpen &&
			!autoDialogOpen &&
			!vaultCinematicState.active &&
			!autoRunning &&
			!['BUTTON', 'SELECT', 'INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)
		) {
			event.preventDefault();
			void activatePrimary();
		}
	}

	onMount(() => {
		let disposed = false;
		let deferredVisualPreloadImages = [];
		let deferredVisualPreloadHandle = null;
		let deferredVisualPreloadUsesIdleCallback = false;
		let deferredVisualPreloadCursor = 0;
		if (__BLACKSITE_DEV_FIXTURES__) {
			displayRefreshMonitor = new DisplayRefreshMonitor({
				onChange: (nextDisplayRefresh) => {
					displayRefresh = nextDisplayRefresh;
				},
			});
			displayRefresh = displayRefreshMonitor.start();
		}
		const adapter = new GameEventAdapter();
		director = new PresentationDirector((nextState) => {
			presentation = nextState;
		});
		liveOutcomeStreak = new LiveOutcomeStreakTracker({ dedupeLimit: 256 });
		audioDirector = new BlacksiteAudioDirector();
		vaultAudioPreloadPromise = null;
		audioMuted = audioDirector.snapshot().muted;
		setPresentationAudioScene('base');
		void audioDirector.preloadBank('base');
		operatorGearTimer = window.setInterval(() => {
			if (
				document.hidden
				|| primaryBusy
				|| bootInteractionLocked
				|| modalOpen
				|| !['idle', 'complete'].includes(presentation.status)
			) return;
			operatorGearOrdinal += 1;
			audioDirector?.play('operative.gear', {
				roundOrReplayId: `${launch.kind}:idle`,
				eventIndex: operatorGearOrdinal,
				ordinal: operatorGearOrdinal,
			});
		}, 12_000);
		reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
		vaultCinematicDirector = new VaultCinematicDirector({
			onChange: (nextState) => {
				if (nextState.active && !vaultCinematicState.active) closePageDialogsForVault();
				vaultCinematicState = nextState;
			},
			onAudioCue: playVaultCinematicAudio,
		});
		if (__BLACKSITE_DEV_FIXTURES__) {
			devVaultMotionDirector = new DevVaultMotionDirector({
				onChange: (nextState) => {
					devVaultMotionState = nextState;
				},
			});
		}
		operatorViewportQuery = window.matchMedia(
			'(min-width: 1041px) and (min-height: 561px) and (min-aspect-ratio: 667/500)',
		);
		operatorAnimator = new OperatorAnimationDirector({
			catalog: OPERATOR_ANIMATION_CATALOG,
			reducedMotion: false,
			surfaceManagedDecoding: true,
			onChange: handleOperatorAnimation,
		});
		operatorAnimator.setSuspended(operatorViewportQuery.matches !== true);
		operatorFrame = operatorAnimator.start();
		standaloneFxDirector = new StandaloneFxDirector({
			catalog: OPERATOR_FX_CATALOG,
			surfaceManagedDecoding: true,
			onChange: handleStandaloneFx,
		});
		standaloneFxDirector.setSuspended(operatorViewportQuery.matches !== true);
		operatorViewportListener = () => {
			const suspended = operatorViewportQuery?.matches !== true;
			operatorViewportVisible = !suspended;
			operatorAnimator?.setSuspended(suspended);
			standaloneFxDirector?.setSuspended(suspended);
			if (suspended) {
				cancelDeferredOperatorSequence();
				operatorAnimator?.returnToIdle('viewport_hidden');
				stopStandaloneFx();
			}
		};
		operatorViewportQuery.addEventListener('change', operatorViewportListener);
		operatorViewportListener();
		launch = resolveLaunchMode(window.location.search, { dev: __BLACKSITE_DEV_FIXTURES__ });
		window.addEventListener('keydown', keydown);
		const responsiveMachineShell = window.matchMedia('(max-width: 380px) and (max-height: 700px) and (orientation: portrait), (min-width: 381px) and (max-width: 480px) and (max-height: 430px) and (orientation: portrait)').matches
			? (__BLACKSITE_MODERN_PRESENTATION__
				? BLACKSITE_ASSETS.environment.premiumMachineCompactPhoneV22
				: BLACKSITE_ASSETS.environment.premiumMachinePhone)
			: window.matchMedia('(max-width: 480px) and (orientation: portrait)').matches
			? (__BLACKSITE_MODERN_PRESENTATION__
				? BLACKSITE_ASSETS.environment.premiumMachinePhoneV22
				: BLACKSITE_ASSETS.environment.premiumMachinePhone)
			: window.matchMedia('(max-height: 560px) and (min-aspect-ratio: 2/1)').matches
				? (__BLACKSITE_MODERN_PRESENTATION__
					? BLACKSITE_ASSETS.environment.premiumMachineShortLandscapeV22
					: BLACKSITE_ASSETS.environment.premiumMachineShortLandscape)
				: window.matchMedia('(max-aspect-ratio: 5/4)').matches
					? (__BLACKSITE_MODERN_PRESENTATION__
						? BLACKSITE_ASSETS.environment.premiumMachinePortraitV22
						: BLACKSITE_ASSETS.environment.premiumMachinePortrait)
					: (__BLACKSITE_MODERN_PRESENTATION__
						? BLACKSITE_ASSETS.environment.premiumMachineV22
						: BLACKSITE_ASSETS.environment.premiumMachine);
		const v28EnvironmentCandidateVariant = window.matchMedia('(max-height: 560px) and (min-aspect-ratio: 2/1)').matches
			? 'shortLandscape'
			: window.matchMedia('(max-aspect-ratio: 5/4)').matches
				? 'portrait'
				: 'desktop';
		v28EnvironmentCandidateSources = Object.freeze({
			base: BLACKSITE_ASSETS.environment.v28Candidate.base[v28EnvironmentCandidateVariant],
			blackout: BLACKSITE_ASSETS.environment.v28Candidate.blackout[v28EnvironmentCandidateVariant],
		});
		// Candidate-only evaluation contract: V22 remains the sole opaque machine/
		// HUD owner until a transparent shell/aperture separation exists.
		prewarmV28EnvironmentCandidate('base');
		// Gate interaction only on the artwork required for the first visible
		// frame. Modes, scenes, animated strips and cinematic layers are warmed
		// after READY so optional screens cannot add ~100 MiB of decoded RGBA to
		// startup or turn a single cold optional asset into a blocking error.
		const requiredVisualUrls = Array.from(new Set([
			responsiveMachineShell,
			...Object.values(BLACKSITE_ASSETS.symbols.master),
			...(__BLACKSITE_MODERN_PRESENTATION__ ? [
				BLACKSITE_ASSETS.ui.v22.reelStage.innerBezel.source,
				BLACKSITE_ASSETS.ui.v22.reelStage.cellDepth.source,
			] : []),
		]));
		bootCriticalAssets = requiredVisualUrls;
		const deferredVisualUrls = Array.from(new Set([
			...['ghost_wild', 'breach'].flatMap((symbolId) => [
				BLACKSITE_ASSETS.symbols.states[symbolId].anticipation,
				BLACKSITE_ASSETS.symbols.states[symbolId].triggered,
			]),
			...activeReelStripSources,
			...(__BLACKSITE_MODERN_PRESENTATION__ ? BLACKSITE_ASSETS.ui.v27.preload : []),
			...Object.values(BLACKSITE_ASSETS.symbols.states.breach),
			...Object.values(BLACKSITE_ASSETS.v19.modes),
			...Object.values(BLACKSITE_ASSETS.v19.scenes),
			...(__BLACKSITE_DEV_FIXTURES__ && launch.kind === 'fixture'
				? Object.values(BLACKSITE_ASSETS.v19.devCinematic)
				: []),
		])).filter((url) => !requiredVisualUrls.includes(url));
		const warmDeferredVisuals = (deadline = null) => {
			deferredVisualPreloadHandle = null;
			if (disposed || deferredVisualPreloadCursor >= deferredVisualUrls.length) return;
			if (document.hidden || primaryBusy || reelMotionActive || vaultCinematicState.active || modalOpen) {
				scheduleDeferredVisuals();
				return;
			}
			const idleBudgetMs = typeof deadline?.timeRemaining === 'function'
				? deadline.timeRemaining()
				: 0;
			const batchSize = idleBudgetMs >= 10 ? 2 : 1;
			const batchUrls = deferredVisualUrls.slice(
				deferredVisualPreloadCursor,
				deferredVisualPreloadCursor + batchSize,
			);
			deferredVisualPreloadCursor += batchUrls.length;
			deferredVisualPreloadImages = batchUrls.map((url) => {
				const image = new Image();
				image.decoding = 'async';
				image.src = url;
				return image;
			});
			void Promise.allSettled(deferredVisualPreloadImages.map((image) => image.decode())).then(() => {
				deferredVisualPreloadImages = [];
				scheduleDeferredVisuals();
			});
		};
		const scheduleDeferredVisuals = () => {
			if (
				disposed
				|| deferredVisualPreloadHandle !== null
				|| deferredVisualPreloadCursor >= deferredVisualUrls.length
			) return;
			if (typeof window.requestIdleCallback === 'function') {
				deferredVisualPreloadUsesIdleCallback = true;
				deferredVisualPreloadHandle = window.requestIdleCallback(warmDeferredVisuals, { timeout: 1_200 });
				return;
			}
			deferredVisualPreloadUsesIdleCallback = false;
			deferredVisualPreloadHandle = window.setTimeout(() => warmDeferredVisuals(null), 240);
		};
		visualPreloadImages = requiredVisualUrls.map((url) => {
			const image = new Image();
			image.decoding = 'async';
			image.src = url;
			return image;
		});
		void Promise.all(visualPreloadImages.map((image) => image.decode())).then(
			() => {
				if (!disposed) {
					visualAssetsReady = true;
					visualPreloadImages = [];
					scheduleDeferredVisuals();
				}
			},
			() => {
				if (!disposed) {
					runtimeError = publicError(new Error('Required reel artwork could not be decoded.'), 'ASSET_LOAD_ERROR');
					runtimeState = 'asset-error';
				}
			},
		);

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
					onCue: (cue, state) => handleOperatorCue(cue, state, {
						source: 'replay',
						origin: null,
						playbackGeneration: replayPlaybackGeneration,
						roundId: replaySnapshot.replay?.identity?.roundId ?? launch.roundId,
					}),
					...playbackTiming(),
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
					await waitForBootGameReady();
					if (disposed) return;
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
			const bootWaiters = bootReadyWaiters;
			bootReadyWaiters = [];
			for (const resolve of bootWaiters) resolve();
			bootCriticalAssets = [];
			if (deferredVisualPreloadHandle !== null) {
				if (deferredVisualPreloadUsesIdleCallback && typeof window.cancelIdleCallback === 'function') {
					window.cancelIdleCallback(deferredVisualPreloadHandle);
				} else {
					window.clearTimeout(deferredVisualPreloadHandle);
				}
				deferredVisualPreloadHandle = null;
			}
			deferredVisualPreloadImages = [];
			deferredVisualPreloadCursor = deferredVisualUrls.length;
			v28EnvironmentCandidateImages = [];
			v28EnvironmentCandidateSources = null;
			cancelDeferredOperatorSequence();
			stopReelMotion();
			stopExpansionFx();
			operatorSurfaceGeneration += 1;
			operatorPendingFrame = null;
			standaloneFxSurfaceGeneration += 1;
			standaloneFxPendingFrame = null;
			window.removeEventListener('keydown', keydown);
			liveSession?.destroy();
			if (sessionTimerHandle !== null) window.clearInterval(sessionTimerHandle);
			if (operatorGearTimer !== null) window.clearInterval(operatorGearTimer);
			if (autoNextTimer !== null) window.clearTimeout(autoNextTimer);
			operatorGearTimer = null;
			finishWinRollup();
			stopStandaloneFx();
			if (operatorViewportQuery && operatorViewportListener) {
				operatorViewportQuery.removeEventListener('change', operatorViewportListener);
			}
			operatorViewportQuery = null;
			operatorViewportListener = null;
			operatorViewportVisible = false;
			autoNextTimer = null;
			visualPreloadImages = [];
			if (minimumRoundWait) {
				window.clearTimeout(minimumRoundWait.timer);
				minimumRoundWait.resolve();
				minimumRoundWait = null;
			}
			if (replayController) replayController.destroy();
			else director?.destroy();
			operatorAnimator?.destroy();
			operatorAnimator = null;
			standaloneFxDirector?.destroy();
			standaloneFxDirector = null;
			vaultCinematicDirector?.destroy();
			vaultCinematicDirector = null;
			devVaultMotionDirector?.destroy();
			devVaultMotionDirector = null;
			audioDirector?.destroy();
			audioDirector = null;
			vaultAudioPreloadPromise = null;
			displayRefreshMonitor?.destroy();
			displayRefreshMonitor = null;
			reducedMotionQuery = null;
			liveOutcomeStreak = null;
			delete document.body.dataset.runtimeState;
		};
	});
</script>

<svelte:window
	on:pointerover={handleUiPointerOver}
	on:pointerdown|capture={handleUiPointerDown}
/>

<svelte:head>
	<title>BLACKSITE // BREACH</title>
	{#if penguinOperatorEnabled}
		<link rel="preload" as="image" href={PENGUIN_OPERATOR_ASSETS.poster} media="(min-width: 1041px) and (min-height: 561px) and (min-aspect-ratio: 667/500)" />
		<link rel="preload" as="image" href={PENGUIN_OPERATOR_ASSETS.idle} media="(min-width: 1041px) and (min-height: 561px) and (min-aspect-ratio: 667/500) and (prefers-reduced-motion: no-preference)" />
	{:else}
		<link rel="preload" as="image" href={OPERATOR_ANIMATION_CATALOG.idle.frames[0]} />
	{/if}
	<link rel="preload" as="image" href={__BLACKSITE_MODERN_PRESENTATION__ ? BLACKSITE_ASSETS.environment.premiumMachineV22 : BLACKSITE_ASSETS.environment.premiumMachine} media="(min-aspect-ratio: 5/4) and (max-aspect-ratio: 2/1), (min-height: 561px) and (min-aspect-ratio: 2/1)" />
	<link rel="preload" as="image" href={__BLACKSITE_MODERN_PRESENTATION__ ? BLACKSITE_ASSETS.environment.premiumMachineCompactPhoneV22 : BLACKSITE_ASSETS.environment.premiumMachinePhone} media="(max-width: 380px) and (max-height: 700px) and (orientation: portrait), (min-width: 381px) and (max-width: 480px) and (max-height: 430px) and (orientation: portrait)" />
	<link rel="preload" as="image" href={__BLACKSITE_MODERN_PRESENTATION__ ? BLACKSITE_ASSETS.environment.premiumMachinePhoneV22 : BLACKSITE_ASSETS.environment.premiumMachinePhone} media="(min-width: 381px) and (max-width: 480px) and (min-height: 431px) and (orientation: portrait)" />
	<link rel="preload" as="image" href={__BLACKSITE_MODERN_PRESENTATION__ ? BLACKSITE_ASSETS.environment.premiumMachineShortLandscapeV22 : BLACKSITE_ASSETS.environment.premiumMachineShortLandscape} media="(max-height: 560px) and (min-aspect-ratio: 2/1)" />
	{#each activeReelStripSources as stripUrl (stripUrl)}
		<link rel="preload" as="image" href={stripUrl} />
	{/each}
	{#each Object.entries(BLACKSITE_ASSETS.symbols.master) as [symbolId, symbolUrl] (symbolId)}
		<link rel="preload" as="image" href={symbolUrl} />
	{/each}
	<meta
		name="description"
		content="BLACKSITE // BREACH authoritative five-reel bunker slot experience"
	/>
</svelte:head>

<main
	class="app-shell"
	inert={bootInteractionLocked}
	aria-hidden={bootInteractionLocked ? 'true' : undefined}
	class:turbo-enabled={turboEnabled}
	class:dev-ui-v21={devUiV21Enabled}
	class:dev-ui-v22={devUiV22Enabled}
	class:dev-ui-v27={devUiV22Enabled}
	class:blacksite-ui-v36={devUiV22Enabled}
	class:blacksite-ui-v37={devUiV22Enabled}
	data-launch-kind={launch.kind}
	data-ui-kit={devUiV22Enabled ? 'v27' : devUiV21Enabled ? 'v21' : undefined}
	data-ui-revision={devUiV22Enabled ? 'v39' : undefined}
	data-polish-revision={devUiV22Enabled ? 'repo-snapshot-v39' : undefined}
	data-dev-math-book={__BLACKSITE_DEV_FIXTURES__ && isRandomDevelopmentFixture()
		? activeFixture.bookId ?? 'pending'
		: undefined}
	data-phase={visualPhase}
	data-operator-reaction={operatorDisplayReaction}
	data-audio-muted={audioMuted ? 'true' : 'false'}
	data-display-hz={__BLACKSITE_DEV_FIXTURES__ ? displayRefresh.refreshHz : undefined}
	data-render-fps={__BLACKSITE_DEV_FIXTURES__ ? displayRefresh.renderFps : undefined}
	data-render-quality={__BLACKSITE_DEV_FIXTURES__ ? displayRefresh.quality : undefined}
	style:--display-hz={__BLACKSITE_DEV_FIXTURES__ ? displayRefresh.refreshHz : 60}
	style:--display-frame-ms={`${displayRefresh.frameTimeMs}ms`}
>
	<div class="scene-world" data-testid="scene">
		{#if !__BLACKSITE_MODERN_PRESENTATION__}
			<img
				class="bunker-backdrop"
				src={BLACKSITE_ASSETS.environment.desktop}
				alt=""
				aria-hidden="true"
				draggable="false"
				loading="eager"
				fetchpriority="high"
			/>
		{/if}
		<picture class="premium-machine-shell-picture" aria-hidden="true">
			<source media="(max-width: 380px) and (max-height: 700px) and (orientation: portrait), (min-width: 381px) and (max-width: 480px) and (max-height: 430px) and (orientation: portrait)" srcset={__BLACKSITE_MODERN_PRESENTATION__ ? BLACKSITE_ASSETS.environment.premiumMachineCompactPhoneV22 : BLACKSITE_ASSETS.environment.premiumMachinePhone} />
			<source media="(max-width: 480px) and (orientation: portrait)" srcset={__BLACKSITE_MODERN_PRESENTATION__ ? BLACKSITE_ASSETS.environment.premiumMachinePhoneV22 : BLACKSITE_ASSETS.environment.premiumMachinePhone} />
			<source media="(max-height: 560px) and (min-aspect-ratio: 2/1)" srcset={__BLACKSITE_MODERN_PRESENTATION__ ? BLACKSITE_ASSETS.environment.premiumMachineShortLandscapeV22 : BLACKSITE_ASSETS.environment.premiumMachineShortLandscape} />
			<source media="(max-aspect-ratio: 5/4)" srcset={__BLACKSITE_MODERN_PRESENTATION__ ? BLACKSITE_ASSETS.environment.premiumMachinePortraitV22 : BLACKSITE_ASSETS.environment.premiumMachinePortrait} />
			<img
				class="premium-machine-shell"
				src={__BLACKSITE_MODERN_PRESENTATION__ ? BLACKSITE_ASSETS.environment.premiumMachineV22 : BLACKSITE_ASSETS.environment.premiumMachine}
				alt=""
				draggable="false"
				loading="eager"
				fetchpriority="high"
			/>
		</picture>
		<BlacksiteAtmosphere enabled={devUiV22Enabled} intensity={0.48} state={uiAtmosphereState} />
	<div class="scene-grade" aria-hidden="true"></div>

	<section
		class="operative-stage"
		class:penguin-character-stage={penguinOperatorEnabled}
		data-testid="operative"
		data-reaction={operatorDisplayReaction}
		data-sequence={penguinOperatorEnabled ? penguinOperatorState : operatorVisibleFrame.sequence}
		data-state={penguinOperatorEnabled ? penguinOperatorState : operatorDisplayReaction}
		data-frame-index={penguinOperatorEnabled ? undefined : operatorVisibleFrame.frameIndex}
		data-zero-streak={operatorZeroStreak}
		aria-hidden="true"
	>
		<div class="operative-halo"></div>
		{#if penguinOperatorEnabled}
			{#if operatorViewportVisible}
				<PenguinOperator state={penguinOperatorState} suspended={operatorSuspended} />
			{/if}
		{:else}
			<div class="operative-frame-shell">
				{#each OPERATOR_BUFFER_INDICES as bufferIndex (bufferIndex)}
					<img
						class="operative-frame"
						class:operative-frame-active={bufferIndex === operatorVisibleBuffer}
						use:registerOperatorFrameBuffer={bufferIndex}
						data-testid={bufferIndex === operatorVisibleBuffer
							? 'operative-animation-frame'
							: 'operative-animation-buffer'}
						data-buffer-testid="operative-animation-buffer"
						src={operatorFrameBuffers[bufferIndex].frameSrc ?? undefined}
						alt=""
						aria-hidden="true"
						draggable="false"
						loading="eager"
						decoding="async"
						fetchpriority={bufferIndex === operatorVisibleBuffer ? 'high' : 'auto'}
						width="1280"
						height="1024"
						data-sequence={operatorFrameBuffers[bufferIndex].sequence}
						data-frame-index={operatorFrameBuffers[bufferIndex].frameIndex}
						data-active={bufferIndex === operatorVisibleBuffer ? 'true' : 'false'}
						on:error={() => handleOperatorBufferError(bufferIndex)}
					/>
				{/each}
			</div>
		{/if}
		<div
			class="standalone-fx-layer"
			class:standalone-fx-crate={standaloneFxVisibleFrame.name?.startsWith('bonusCrate')}
			data-testid="standalone-fx"
			data-active={standaloneFxVisibleFrame.active ? 'true' : 'false'}
			data-name={standaloneFxVisibleFrame.name ?? ''}
			data-frame-index={standaloneFxVisibleFrame.frameIndex}
		>
			{#each OPERATOR_BUFFER_INDICES as bufferIndex (bufferIndex)}
				<img
					class="standalone-fx-frame"
					class:standalone-fx-frame-active={standaloneFxVisibleFrame.active
						&& bufferIndex === standaloneFxVisibleBuffer}
					use:registerStandaloneFxBuffer={bufferIndex}
					data-testid={standaloneFxVisibleFrame.active && bufferIndex === standaloneFxVisibleBuffer
						? 'standalone-fx-frame'
						: 'standalone-fx-buffer'}
					data-buffer-testid="standalone-fx-buffer"
					src={standaloneFxBuffers[bufferIndex].frameSrc ?? undefined}
					alt=""
					aria-hidden="true"
					draggable="false"
					loading="eager"
					decoding="async"
					width={standaloneFxBuffers[bufferIndex].name?.startsWith('bonusCrate') ? 512 : 1280}
					height={standaloneFxBuffers[bufferIndex].name?.startsWith('bonusCrate') ? 512 : 1024}
					data-name={standaloneFxBuffers[bufferIndex].name ?? ''}
					data-frame-index={standaloneFxBuffers[bufferIndex].frameIndex}
					data-active={standaloneFxVisibleFrame.active && bufferIndex === standaloneFxVisibleBuffer
						? 'true'
						: 'false'}
					on:error={() => handleStandaloneFxBufferError(bufferIndex)}
				/>
			{/each}
		</div>
		<div class="operative-floor-light"></div>
		<div class="operative-readout v27-surface-carrier v27-chip-surface">
			{#if devUiV22Enabled}<UiSurface enabled kit={BLACKSITE_ASSETS.ui.v27} kind="chip" interactive={false} />{/if}
			<span>OPERATIVE / 01</span>
			<strong>{operatorReactionLabel}</strong>
		</div>
	</section>

	<section
		class="breach-monitor"
		class:feature-active={hudPhase === 'feature'}
		data-testid="slot-monitor"
		aria-label="BLACKSITE game interface"
		inert={modalOpen}
		aria-hidden={modalOpen ? 'true' : undefined}
	>
		<header class="monitor-header">
			<div class="monitor-identity">
				<span>CLASSIFIED OPERATIONS DIVISION</span>
				<h1><b>BLACKSITE</b> <em>// BREACH</em></h1>
			</div>
			{#if devUiV21Enabled}
				<div
					class="selected-mode-carrier v27-surface-carrier v27-chip-surface"
					data-testid="selected-mode-carrier"
					data-mode-id={selectedModeId}
					aria-label={`Selected mode: ${getModeLabel(selectedModeId, social)}, cost ${selectedMode.costMultiplier} times base`}
				>
					{#if devUiV22Enabled}<UiSurface enabled kit={BLACKSITE_ASSETS.ui.v27} kind="chip" interactive={false} />{/if}
					<small>ENTRY MODE</small>
					<strong>
						<span class="mode-label-full">{getModeLabel(selectedModeId, social)}</span>
						<span class="mode-label-compact">{compactModeLabel(selectedModeId, social)}</span>
						<em>· {selectedMode.costMultiplier}×</em>
					</strong>
				</div>
			{/if}
			{#if devUiV21Enabled && cinematicLifecycle}
				<div class="lifecycle lifecycle--cinematic" data-testid="launch-status" data-lifecycle-mode={cinematicLifecycle.mode}>
					<CinematicStatusSurface
						enabled
						compact
						status={cinematicLifecycle.status}
						eyebrow={cinematicLifecycle.eyebrow}
						headline={cinematicLifecycle.headline}
						detail={cinematicLifecycle.detail}
						fallbackSrc={cinematicLifecycleFallbackSrc}
						testId="launch-status-cinematic"
						role={cinematicLifecycle.status === 'error' ? 'alert' : 'status'}
						ariaLive={cinematicLifecycle.status === 'error' ? 'assertive' : 'polite'}
					/>
				</div>
			{:else}
				<div class="lifecycle v27-surface-carrier v27-chip-surface" data-testid="launch-status" aria-label="Current runtime status">
					{#if devUiV22Enabled}<UiSurface enabled kit={BLACKSITE_ASSETS.ui.v27} kind="chip" interactive={false} />{/if}
					<span class="pulse" class:error-pulse={runtimeError !== null}></span>
					<small>OPERATION STATUS</small>
					<strong>{launch.kind === 'live' ? `LIVE: ${lifecycleLabel}` : lifecycleLabel}</strong>
				</div>
			{/if}
		</header>

		<div class="reel-console">
			<div
				class="reel-mechanic-strip"
				class:feature-strip={hudPhase === 'feature'}
				data-testid="quick-start-hud"
				data-hud-phase={hudPhase}
				aria-label={hudPhase === 'feature'
					? 'Free spin progress, expanding symbol and bonus win'
					: `10 fixed paylines. ${breachReelCount} of 3 VAULT symbols toward BLACKOUT.`}
			>
				{#if hudPhase === 'feature'}
					{#if devUiV21Enabled}
						<FeatureHudSurface enabled kind="progress" state="active" label="FREE SPINS" compactLabel="SPINS" value={featureProgressValue} secondary={featureRemainingValue} ariaLabel={`Free spins ${featureProgressValue}, ${featureRemainingValue}`} fallbackSrc={BLACKSITE_ASSETS.ui.premiumPanels.ticker} testId="feature-progress" secondaryTestId="feature-spins-remaining" />
						<FeatureHudSurface enabled kind="target" state="armed" label="EXPANDING SYMBOL" compactLabel="EXPANDING" value={featureTargetLabel} iconSrc={featureTargetAsset} iconAlt="" ariaLabel={`Expanding symbol ${featureTargetLabel}`} fallbackSrc={BLACKSITE_ASSETS.ui.premiumPanels.ticker} testId="feature-target" />
						<FeatureHudSurface enabled kind="win" state={presentation.finalWinRaw > 0 ? 'winning' : 'idle'} label={social ? 'RESULT' : 'BONUS WIN'} compactLabel="WIN" value={featureRunningWinText} fallbackSrc={BLACKSITE_ASSETS.ui.premiumPanels.ticker} testId="feature-running-win" />
					{:else}
						<span class="feature-state" data-testid="feature-progress">
							<small>FREE SPINS</small>
							<strong>{featureProgressValue}</strong>
							<em data-testid="feature-spins-remaining">{featureRemainingValue}</em>
						</span>
						<span class="target-state" data-testid="feature-target">
							<small>EXPANDING SYMBOL</small>
							<span class="feature-target-value">
								{#if featureTargetAsset}<img src={featureTargetAsset} alt="" draggable="false" aria-hidden="true" />{/if}
								<strong>{featureTargetLabel}</strong>
							</span>
						</span>
						<span class="running-win-state" data-testid="feature-running-win">
							<small>{social ? 'RESULT' : 'BONUS WIN'}</small>
							<strong>{featureRunningWinText}</strong>
						</span>
					{/if}
				{:else}
					{#if devUiV21Enabled}
						<span class="mechanic-contract-copy" aria-hidden="true">10 FIXED LINES · 3+ FROM LEFT · WILD SUBSTITUTES · {breachReelCount}/3 VAULT</span>
						<FeatureHudSurface enabled kind="quick-start" value="10" secondary="LINES" fallbackSrc={BLACKSITE_ASSETS.ui.premiumPanels.modeCard.normal} />
						<FeatureHudSurface enabled kind="quick-start" state={breachReelCount >= 2 ? 'armed' : 'idle'} value={`${breachReelCount}/3`} secondary="VAULT" tone={breachReelCount >= 2 ? 'target' : 'neutral'} fallbackSrc={BLACKSITE_ASSETS.ui.premiumPanels.modeCard.normal} />
					{:else}
					<span><strong>10 FIXED LINES</strong> · ALL ACTIVE</span>
					<span><strong>3+</strong> FROM LEFT</span>
					<span class="wild-rule"><strong>WILD</strong> SUBSTITUTES</span>
					<span class:armed={breachReelCount >= 2}><strong>{breachReelCount}/3</strong> VAULT</span>
					{/if}
				{/if}
			</div>

			<section class="reel-stage" aria-label="Authoritative five reel by three row slot">
				<div class="reel-stage-heading">
					<div>
						<span>ALL LINES ACTIVE</span>
						<strong data-testid="gameplay-hint" aria-live="off">{gameplayHint}</strong>
					</div>
					<div class:feature-phase={hudPhase === 'feature'} class="phase-chip v27-surface-carrier v27-chip-surface">
						{#if devUiV22Enabled}<UiSurface enabled kit={BLACKSITE_ASSETS.ui.v27} kind="chip" state={hudPhase === 'feature' ? 'selected' : 'idle'} selected={hudPhase === 'feature'} interactive={false} />{/if}
						<span class="v27-live-copy">{hudPhase === 'feature' ? 'BLACKOUT' : 'BASE GAME'}</span>
					</div>
				</div>

				<div
					class="reel-machine"
					data-has-win={activeWinKeys.size > 0 ? 'true' : 'false'}
					data-has-loss={presentation.status === 'complete' && presentation.finalWinRaw === 0 ? 'true' : 'false'}
					data-vault-anticipation={reelMotionAnticipating ? 'true' : 'false'}
					data-vault-reels={reelMotionLockedReels.join(',')}
					data-locked-through-reel={reelMotionLockedThrough >= 0 ? reelMotionLockedThrough + 1 : ''}
					data-expansion-active={expansionFxActive ? 'true' : 'false'}
					data-expanded-reels={expansionFxReels.map((reel) => reel + 1).join(',')}
				>
					<div class="line-gutter line-gutter-left" data-testid="line-markers-left" aria-hidden="true">
						{#each [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as lineId}
							<span data-testid={`line-marker-left-${lineId + 1}`} data-line-id={lineId} class:active={activeLineIds.includes(lineId)}>
								<img class="line-marker-art" src={activeLineIds.includes(lineId) ? BLACKSITE_ASSETS.ui.premiumPanels.marker.active : BLACKSITE_ASSETS.ui.premiumPanels.marker.normal} alt="" draggable="false" aria-hidden="true" />
								<b>{lineId + 1}</b>
							</span>
						{/each}
					</div>

					<div
						class="board-frame reel-window"
						data-has-win={activeWinKeys.size > 0 ? 'true' : 'false'}
						data-ready-attract={!boardIsAuthoritative ? 'true' : 'false'}
						data-spinning={reelsSpinning ? 'true' : 'false'}
						data-anticipating={reelMotionAnticipating ? 'true' : 'false'}
					>
						<div
							class="board reel-grid"
							style={`--reel-cell-depth-art:url("${devUiV22Enabled
								? BLACKSITE_ASSETS.ui.v22.reelStage.cellDepth.source
								: BLACKSITE_ASSETS.ui.reelDepth.cellOverlay}")`}
							data-testid="board"
							data-authoritative={boardIsAuthoritative ? 'true' : 'false'}
							data-has-win={activeWinKeys.size > 0 ? 'true' : 'false'}
							data-spinning={reelsSpinning ? 'true' : 'false'}
							data-anticipating={reelMotionAnticipating ? 'true' : 'false'}
							role="grid"
							aria-label={boardIsAuthoritative ? 'Authoritative slot result' : 'Decorative ready preview'}
							aria-rowcount="3"
							aria-colcount="5"
						>
							{#each boardCells as cell}
								<div
									class="cell reel-cell"
									class:rank-glyph={rankGlyphSymbolIds.has(symbolNameAt(cell))}
									class:line-active={activeWinKeys.has(cellKey(cell))}
									class:wild-cell={symbolNameAt(cell) === 'ghost_wild'}
									class:breach-cell={symbolNameAt(cell) === 'breach'}
									class:vault-anticipation-cell={reelMotionAnticipating && cell.column <= reelMotionLockedThrough && symbolNameAt(cell) === 'breach'}
									class:expansion-cell={expansionFxActive && expansionFxReels.includes(cell.column)}
									data-column={cell.column}
									data-row={cell.row}
									data-symbol={symbolAt(cell)}
									data-symbol-id={symbolNameAt(cell)}
									data-authoritative={boardIsAuthoritative ? 'true' : 'false'}
									data-line-active={activeWinKeys.has(cellKey(cell))}
									data-winning-lines={winningLineIdsAt(cell).join(',')}
									role="gridcell"
									aria-rowindex={cell.row + 1}
									aria-colindex={cell.column + 1}
									aria-label={`Reel ${cell.column + 1}, row ${cell.row + 1}, ${displaySpecialSymbolCopy(symbolAt(cell))}${winningLineIdsAt(cell).length > 0 ? `, winning line ${winningLineIdsAt(cell).join(', ')}` : ''}`}
								>
									{#if symbolNameAt(cell) !== 'empty'}
										<span class={`symbol-art symbol-${symbolNameAt(cell)}`} class:special-symbol={!isRegularSymbol(cell)} aria-hidden="true">
											{#if symbolAssetAt(cell)}
												<img
													src={symbolAssetAt(cell)}
													alt=""
													draggable="false"
													loading="eager"
												/>
											{/if}
										</span>
									{/if}
								</div>
							{/each}
						</div>
						{#if devUiV22Enabled}
							<div
								class="v22-reel-bezel"
								style={`--v22-reel-bezel-art:url("${BLACKSITE_ASSETS.ui.v22.reelStage.innerBezel.source}")`}
								aria-hidden="true"
							></div>
						{/if}

						{#if expansionFxActive}
							<div class="expansion-callout v27-surface-carrier v27-feature-surface" data-testid="expansion-callout" data-expanded-reels={expansionFxReels.map((reel) => reel + 1).join(',')} role="status" aria-live="assertive" aria-atomic="true">
								{#if devUiV22Enabled}<UiSurface enabled kit={BLACKSITE_ASSETS.ui.v27} kind="feature" state="selected" selected interactive={false} />{/if}
								<span>BLACKOUT EXPANSION</span>
								<strong>{expansionFxTarget} FILLS REELS {expansionFxReels.map((reel) => reel + 1).join(' · ')}</strong>
							</div>
						{/if}

						{#if activeLineIds.length > 0}
							<div class="payline-overlay" data-testid="payline-overlay" aria-hidden="true">
								{#each activeLineIds as lineId}
									<img src={BLACKSITE_ASSETS.ui.paylines[lineId]} data-line-id={lineId} alt="" draggable="false" />
								{/each}
							</div>
						{/if}

						<ReelSpinOverlay
							active={reelMotionActive}
							stripSources={activeReelStripSources}
							settling={reelMotionSettling}
							anticipating={reelMotionAnticipating}
							lockedReels={reelMotionLockedReels}
							turbo={turboEnabled}
							phaseSeed={reelSpinPhaseSeed}
						/>

					</div>

					<div class="line-gutter line-gutter-right" data-testid="line-markers-right" aria-hidden="true">
						{#each [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as lineId}
							<span data-testid={`line-marker-right-${lineId + 1}`} data-line-id={lineId} class:active={activeLineIds.includes(lineId)}>
								<img class="line-marker-art" src={activeLineIds.includes(lineId) ? BLACKSITE_ASSETS.ui.premiumPanels.marker.active : BLACKSITE_ASSETS.ui.premiumPanels.marker.normal} alt="" draggable="false" aria-hidden="true" />
								<b>{lineId + 1}</b>
							</span>
						{/each}
					</div>
				</div>

				<div class="result-ticker" class:result-ticker-passive={resultTickerPassive} data-testid="line-win-cue" data-ticker-priority={resultTickerPriority ? 'true' : 'false'} role="status" aria-live="polite" aria-atomic="true">
					{#if devUiV21Enabled}
						<div class="premium-panel-art premium-ticker-art" aria-hidden="true"><UiSurface enabled kind="readout" fallbackSrc={BLACKSITE_ASSETS.ui.premiumPanels.ticker} /></div>
					{:else}
						<img class="premium-panel-art premium-ticker-art" src={BLACKSITE_ASSETS.ui.premiumPanels.ticker} alt="" draggable="false" aria-hidden="true" />
					{/if}
					<span class="responsive-penguin-cameo" data-testid="responsive-penguin-cameo" aria-hidden="true">
						<img src={PENGUIN_OPERATOR_ASSETS.poster} alt="" draggable="false" />
					</span>
					{#if expansionTickerActive}
						<span>BLACKOUT EXPANSION</span><strong>{expansionFxTarget} FILLS REELS {expansionFxReels.map((reel) => reel + 1).join(' · ')}</strong>
					{:else if devUiStatus && ['danger', 'warning', 'notice'].includes(devUiStatus.severity)}
						<span data-ui-status={devUiStatus.severity}>{devUiStatus.headline}</span><strong>{devUiStatus.detail}</strong>
					{:else if reelMotionAnticipating}
						<span>VAULT ANTICIPATION</span><strong>2 LOCKED - REELS {reelMotionLockedThrough + 2}-5 TURNING</strong>
					{:else if activeLineWins.length > 0}
						<span>{activeLineWins.length === 1 ? `LINE ${String(activeLineIds[0] + 1).padStart(2, '0')} WON` : `${activeLineWins.length} LINES WON`}</span>
						<strong>+{formatCentiMultiplier(presentation.stepWinRaw ?? activeLineWins.reduce((sum, win) => sum + (win.applied_award_raw ?? 0), 0))}</strong>
					{:else if devUiStatus}
						<span data-ui-status={devUiStatus.severity}>{devUiStatus.headline}</span><strong>{devUiStatus.detail}</strong>
					{:else if presentation.status === 'complete' && presentation.finalWinRaw === 0}
						<span>ROUND COMPLETE</span><strong>NO LINE WIN</strong>
					{:else if reelsSpinning}
						{#if visualPhase === 'feature' && featureSpin > 0}
							<span>BLACKOUT</span><strong>REELS IN MOTION</strong>
						{:else}
							<span>REELS SPINNING</span><strong>AWAITING RESULT</strong>
						{/if}
					{:else if presentationActive}
						{#if visualPhase === 'feature'}
							<span>BLACKOUT</span><strong>{featureSpin > 0 ? 'CHECKING EXPANSION' : 'FEATURE ARMED'}</strong>
						{:else}
							<span>CHECKING PAYLINES</span><strong>10 LINES ACTIVE</strong>
						{/if}
					{:else}
						<span>{launch.kind === 'replay'
							? 'PRESS PLAY REPLAY'
							: launch.kind === 'fixture' && runtimeState === 'fixture-completed'
								? isRandomDevelopmentFixture() ? 'PRESS NEXT SPIN' : 'PRESS REPLAY'
								: 'PRESS SPIN'}</span>
					{/if}
					{#if devUiV21Enabled}
						<div class="compact-value-strip v27-surface-carrier v27-feature-surface" data-testid="compact-value-strip" aria-hidden="true">
							{#if devUiV22Enabled}<UiSurface enabled kit={BLACKSITE_ASSETS.ui.v27} kind="feature" interactive={false} />{/if}
							<span class="compact-operative-badge"><img src={PENGUIN_OPERATOR_ASSETS.poster} alt="" draggable="false" /></span>
							<span class="compact-balance-value"><small>BAL</small><b>{launch.kind === 'replay' ? 'R/O' : hudBalanceText}</b></span>
							<span class="compact-bet-value"><small>{social ? 'PLAY' : 'BET'}</small><b>{launch.kind === 'replay' ? formatReplayQueryUnits(replayTotalUnits, launch.currency) : hudTotalAmountText}</b></span>
							<span class="compact-win-value"><small>WIN</small><b>{hudWinText}</b></span>
						</div>
					{/if}
				</div>
			</section>

			<div class="premium-hud" data-testid="bottom-hud" aria-label="BLACKSITE game controls">
				{#if devUiV22Enabled}<div class="v27-responsive-hud-rail" aria-hidden="true"><UiSurface enabled kit={BLACKSITE_ASSETS.ui.v27} kind="feature" interactive={false} /></div>{/if}
				<nav class="hud-tools hud-tools-left" aria-label="Game tools">
					<button class="round-tool" data-testid="hud-menu" type="button" aria-label="Open game menu" disabled={primaryBusy || vaultCinematicState.active} on:click={() => void openMenu()}><HudIcon name="menu" /><span class="hud-tool-label">MENU</span></button>
					<button class="round-tool shop-tool" data-testid="hud-shop" type="button" aria-label={devFixtureUiPreview ? 'Preview entry modes' : 'Select entry mode'} disabled={autoRunning || primaryBusy || vaultCinematicState.active || (launch.kind === 'live' && liveSnapshot.status !== 'ready') || (launch.kind !== 'live' && !devFixtureUiPreview)} on:click={() => void openModeDialog()}><HudIcon name="shop" /><span class="hud-tool-label">{devFixtureUiPreview ? 'MODES' : social ? 'FEATURES' : 'BUY'}</span></button>
					<button class="round-tool" class:active={autoRunning} data-testid="hud-auto" type="button" aria-label={launch.kind === 'replay' ? 'Replay round' : autoRunning ? `Stop autoplay with ${autoRemaining} spins remaining` : 'Open autoplay selection'} disabled={primaryBusy || vaultCinematicState.active || (launch.kind === 'live' && autoplayDisabled && !autoRunning)} on:click={activateHudAuto}><HudIcon name="auto" /><span class="hud-tool-label">{launch.kind === 'replay' ? 'REPLAY' : autoRunning ? `STOP ${autoRemaining}` : 'AUTO'}</span></button>
				</nav>

			<div class="control-deck" aria-label={rulesInterfaceCopy.controlDeckLabel}>
				<button class="bet-step bet-step-minus" data-testid="hud-bet-minus" type="button" aria-label={social ? 'Decrease play amount' : 'Decrease bet'} disabled={autoRunning || launch.kind !== 'live' || liveSnapshot.status !== 'ready' || primaryBusy} on:click={() => shiftBaseAmount(-1)}><HudIcon name="minus" size={20} /></button>
				<label class="amount-control reel-bet-control" for="blacksite-base-amount-stage">
					{#if devUiV21Enabled}<div class="premium-panel-art" aria-hidden="true"><UiSurface enabled kind="readout" fallbackSrc={BLACKSITE_ASSETS.ui.premiumPanels.meters.bet} /></div>{:else}<img class="premium-panel-art" src={BLACKSITE_ASSETS.ui.premiumPanels.meters.bet} alt="" draggable="false" aria-hidden="true" />{/if}
					<span class="hud-meter-label">{rulesInterfaceCopy.amountLabel}</span>
					{#if betLevelsApi.length > 0}
						<select
							id="blacksite-base-amount-stage"
							data-testid="base-amount"
							value={baseAmountApi}
							disabled={autoRunning || launch.kind !== 'live' || liveSnapshot.status !== 'ready' || primaryBusy}
							on:change={selectBaseAmount}
						>
							{#each betLevelsApi as amountApi}<option value={amountApi}>{formatExactApi(amountApi, currency)}</option>{/each}
						</select>
					{:else if liveSnapshot.config}
						<span class="amount-range">
							<input
								id="blacksite-base-amount-stage"
								data-testid="base-amount"
								type="range"
								min={liveSnapshot.config.minBetApi}
								max={liveSnapshot.config.maxBetApi}
								step={liveSnapshot.config.stepBetApi}
								value={baseAmountApi}
								aria-valuetext={formatExactApi(baseAmountApi, currency)}
								disabled={autoRunning || launch.kind !== 'live' || liveSnapshot.status !== 'ready' || primaryBusy}
								on:change={selectBaseAmount}
							/>
							<output for="blacksite-base-amount-stage">{formatExactApi(baseAmountApi, currency)}</output>
						</span>
					{:else}
						<select id="blacksite-base-amount-stage" data-testid="base-amount" disabled><option value="">—</option></select>
					{/if}
				</label>
				<button class="bet-step bet-step-plus" data-testid="hud-bet-plus" type="button" aria-label={social ? 'Increase play amount' : 'Increase bet'} disabled={autoRunning || launch.kind !== 'live' || liveSnapshot.status !== 'ready' || primaryBusy} on:click={() => shiftBaseAmount(1)}><HudIcon name="plus" size={20} /></button>
				<div class="balance-meter">{#if devUiV21Enabled}<div class="premium-panel-art" aria-hidden="true"><UiSurface enabled kind="readout" fallbackSrc={BLACKSITE_ASSETS.ui.premiumPanels.meters.balance} /></div>{:else}<img class="premium-panel-art" src={BLACKSITE_ASSETS.ui.premiumPanels.meters.balance} alt="" draggable="false" aria-hidden="true" />{/if}<span class="hud-meter-label">BALANCE</span><strong data-testid="wallet-balance">{launch.kind === 'replay' ? 'READ-ONLY' : hudBalanceText}</strong></div>
				<div class="control-meter total-meter">{#if devUiV21Enabled}<div class="premium-panel-art" aria-hidden="true"><UiSurface enabled kind="readout" fallbackSrc={BLACKSITE_ASSETS.ui.premiumPanels.meters.total} /></div>{:else}<img class="premium-panel-art" src={BLACKSITE_ASSETS.ui.premiumPanels.meters.total} alt="" draggable="false" aria-hidden="true" />{/if}<span class="hud-meter-label">{social ? 'TOTAL PLAY' : 'TOTAL BET'}</span><strong data-testid="total-play">{launch.kind === 'replay' ? formatReplayQueryUnits(replayTotalUnits, launch.currency) : hudTotalAmountText}</strong></div>
				<div class="control-meter win-meter">{#if devUiV21Enabled}<div class="premium-panel-art" aria-hidden="true"><UiSurface enabled kind="readout" fallbackSrc={BLACKSITE_ASSETS.ui.premiumPanels.meters.win} /></div>{:else}<img class="premium-panel-art" src={BLACKSITE_ASSETS.ui.premiumPanels.meters.win} alt="" draggable="false" aria-hidden="true" />{/if}<span class="hud-meter-label">{social ? 'RESULTS' : 'WIN'}</span><strong data-testid="final-win">{hudWinText}</strong></div>
				<button
					bind:this={primaryActionButton}
					class="primary-action reel-spin"
					data-testid="primary-action"
					type="button"
					aria-label={actionLabel}
					class:feature-action={presentation.phase === 'feature'}
					disabled={actionDisabled || autoRunning}
					on:click={() => void activatePrimary()}
				>
					<HudIcon name="spin" size={52} />
					<small>{actionLabel}</small>
					{#if devUiV21Enabled}<b class="responsive-spin-label" aria-hidden="true">{compactActionLabel}</b>{/if}
				</button>
			</div>

			<div class="secondary-deck">
				<div class="info-action status-plate" data-testid="status-plate" role={devUiV21Enabled ? 'presentation' : 'status'} aria-live={devUiV21Enabled ? 'off' : 'polite'}>{#if devUiV21Enabled}<div class="premium-panel-art" aria-hidden="true"><UiSurface enabled kind="readout" fallbackSrc={BLACKSITE_ASSETS.ui.premiumPanels.meters.howTo} /></div>{:else}<img class="premium-panel-art" src={BLACKSITE_ASSETS.ui.premiumPanels.meters.howTo} alt="" draggable="false" aria-hidden="true" />{/if}<span>{devUiV21Enabled ? (runtimeError ? 'LINK OFFLINE' : primaryBusy ? 'IN PROGRESS' : hudPhase === 'feature' ? 'AUTO FEATURE' : 'READY') : passiveStatusText}</span></div>
			</div>

				<nav class="hud-tools hud-tools-right" aria-label="Play settings">
					<button class="round-tool" class:active={turboEnabled} data-testid="hud-turbo" type="button" aria-label="Toggle turbo presentation" aria-pressed={turboEnabled} disabled={turboDisabled || primaryBusy || vaultCinematicState.active} on:click={() => turboEnabled = !turboEnabled}><HudIcon name="turbo" /><span class="hud-tool-label">TURBO</span></button>
					<button class="round-tool info-tool" data-testid="hud-info" type="button" aria-label={social ? 'Open game guide and results' : 'Open game guide and paytable'} disabled={primaryBusy || vaultCinematicState.active} on:click={() => void openRules()}><HudIcon name="info" /><span class="hud-tool-label">INFO</span></button>
					<button class="round-tool" data-testid="hud-settings" type="button" aria-label="Open settings" disabled={primaryBusy || vaultCinematicState.active} on:click={() => void openSettings()}><HudIcon name="settings" /><span class="hud-tool-label">SETTINGS</span></button>
				</nav>
			</div>

			{#if (runtimeError || launch.kind === 'error') && !devUiV21Enabled && !startupFailureVisible}
				<aside class="monitor-status reel-error-status" aria-label="Runtime error">
					<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
					<div bind:this={runtimeErrorDialog} class="launch-card error" data-testid="launch-error" role={devUiV21Enabled ? 'alertdialog' : 'alert'} aria-modal={devUiV21Enabled ? 'true' : undefined} aria-labelledby={devUiV21Enabled ? 'runtime-error-title' : undefined} tabindex={devUiV21Enabled ? -1 : undefined}>
						{#if devUiV21Enabled}<div class="premium-dialog-frame" aria-hidden="true"><UiSurface enabled kind="panel" tone="danger" fallbackSrc={BLACKSITE_ASSETS.ui.premiumPanels.dialogs.runtimeError} /></div>{:else}<img class="premium-dialog-frame" src={BLACKSITE_ASSETS.ui.premiumPanels.dialogs.runtimeError} alt="" draggable="false" aria-hidden="true" />{/if}
						<strong id="runtime-error-title">{social ? 'AUTHORITATIVE_ERROR' : (runtimeError?.code ?? launch.code)}</strong>
						<span>{visibleRuntimeMessage ?? launch.message}</span>
						{#if runtimeError || launch.kind === 'error'}
							<button bind:this={recoveryButton} type="button" data-testid="recovery-action" on:click={recoverRuntime}><PanelStateArt assets={BLACKSITE_ASSETS.ui.premiumPanels.modeCard} tone="danger" /><span>{launch.kind === 'fixture' ? 'RELOAD FIXTURE' : 'RELOAD / RESTORE'}</span></button>
						{/if}
						<small>No local round or development fallback was started.</small>
					</div>
				</aside>
			{/if}
		</div>

		<footer class="reel-footer" aria-live="off">
			<span class="footer-guide">{selectedModeGuide}</span>
			<span
				class="premium-footer-id"
				data-testid={__BLACKSITE_DEV_FIXTURES__ && isRandomDevelopmentFixture()
					? 'dev-math-draw'
					: undefined}
			>
				{#if __BLACKSITE_DEV_FIXTURES__ && isRandomDevelopmentFixture()}
					DEV MATH · BOOK {runtimeState === 'fixture-sampling'
						? 'DRAWING'
						: activeFixture.bookId ?? 'NEXT DRAW'}
				{:else}
					BLACKSITE ID: BS-77-ALPHA
				{/if}
			</span>
			<span class="premium-footer-clearance">CLEARANCE LEVEL: OMEGA</span>
			{#if launch.kind === 'live' && (displayNetPosition || displaySessionTimer)}
				<span class="session-readouts">
					{#if displayNetPosition}
						<span class="session-readout v27-surface-carrier v27-chip-surface">{#if devUiV22Enabled}<UiSurface enabled kit={BLACKSITE_ASSETS.ui.v27} kind="chip" interactive={false} />{/if}<small>SESSION NET</small><strong data-testid="session-net-position">{netPositionText}</strong></span>
					{/if}
					{#if displaySessionTimer}
						<span class="session-readout v27-surface-carrier v27-chip-surface">{#if devUiV22Enabled}<UiSurface enabled kit={BLACKSITE_ASSETS.ui.v27} kind="chip" interactive={false} />{/if}<small>TIME</small><strong data-testid="session-timer" role="timer">{sessionTimerText}</strong></span>
					{/if}
				</span>
			{/if}
			<strong>{getModeLabel(selectedMode.id, social)} · {selectedMode.costMultiplier}× COST</strong>
		</footer>

		<div class="monitor-glass" aria-hidden="true"></div>
	</section>

	{#if devUiV21Enabled && (runtimeError || launch.kind === 'error') && !startupFailureVisible}
		<aside class="monitor-status reel-error-status runtime-error-overlay" aria-label="Runtime error">
			<div bind:this={runtimeErrorDialog} class="launch-card error" data-testid="launch-error" role="alertdialog" aria-modal="true" aria-labelledby="runtime-error-title" aria-describedby="runtime-error-message runtime-error-help" tabindex="-1">
				<div class="premium-dialog-frame" aria-hidden="true"><UiSurface enabled kind="panel" tone="danger" fallbackSrc={BLACKSITE_ASSETS.ui.premiumPanels.dialogs.runtimeError} /></div>
				<div class="runtime-error-content v27-surface-carrier v27-content-surface">
					{#if devUiV22Enabled}<UiSurface enabled kit={BLACKSITE_ASSETS.ui.v27} kind="content" tone="danger" danger interactive={false} />{/if}
					<strong id="runtime-error-title">{social ? 'AUTHORITATIVE_ERROR' : (runtimeError?.code ?? launch.code)}</strong>
					<span id="runtime-error-message">{visibleRuntimeMessage ?? launch.message}</span>
				</div>
				<button bind:this={recoveryButton} type="button" data-testid="recovery-action" on:click={recoverRuntime}><PanelStateArt assets={BLACKSITE_ASSETS.ui.premiumPanels.modeCard} tone="danger" /><span>{launch.kind === 'fixture' ? 'RELOAD FIXTURE' : 'RELOAD / RESTORE'}</span></button>
				<small id="runtime-error-help">No local round or development fallback was started.</small>
			</div>
		</aside>
	{/if}
	</div>

	{#if menuOpen}
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="modal-backdrop" on:click|self={() => void closeMenu()}>
			<section
				class="menu-dialog"
				data-testid="operations-hub-dialog"
				role="dialog"
				aria-modal="true"
				aria-labelledby="menu-title"
				tabindex="-1"
				bind:this={menuDialog}
			>
				{#if devUiV21Enabled}<div class="premium-dialog-frame" aria-hidden="true"><UiSurface enabled kind="panel" fallbackSrc={BLACKSITE_ASSETS.ui.premiumPanels.dialogs.menu} /></div>{:else}<img class="premium-dialog-frame" src={BLACKSITE_ASSETS.ui.premiumPanels.dialogs.menu} alt="" draggable="false" aria-hidden="true" />{/if}
				<header class="v27-surface-carrier v27-modal-header">
					{#if devUiV22Enabled}<UiSurface enabled kit={BLACKSITE_ASSETS.ui.v27} kind="header" interactive={false} />{/if}
					<div><span>SECURE COMMAND</span><h2 id="menu-title">OPERATIONS HUB</h2></div>
					<button bind:this={menuCloseButton} data-testid="operations-hub-close" type="button" aria-label="Close game menu" on:click={() => void closeMenu()}><HudIcon name="close" /></button>
				</header>
				<div class="menu-actions">
					<button data-testid="operations-hub-continue" type="button" on:click={() => void closeMenu()}><PanelStateArt assets={BLACKSITE_ASSETS.ui.premiumPanels.modeCard} />{#if devUiV22Enabled}<span class="menu-action-icon"><UiGlyph enabled name="resume" size={64} /></span>{/if}<span>CONTINUE OPERATION</span><small>Return to the active operation.</small></button>
					<button data-testid="operations-hub-select-mode" type="button" disabled={primaryBusy || vaultCinematicState.active || (launch.kind === 'live' && liveSnapshot.status !== 'ready') || (launch.kind !== 'live' && !devFixtureUiPreview)} on:click={() => void openModeDialogFromMenu()}><PanelStateArt assets={BLACKSITE_ASSETS.ui.premiumPanels.modeCard} />{#if devUiV22Enabled}<span class="menu-action-icon"><UiGlyph enabled name="buy" size={64} /></span>{/if}<span>{devFixtureUiPreview ? 'CURRENT MODE' : 'SELECT MODE'}</span><small>{devFixtureUiPreview ? `${getModeLabel(selectedMode.id, social)} · ${selectedMode.costMultiplier}× COST` : `Active: ${getModeLabel(selectedMode.id, social)} · Total: ${totalAmountText}`}</small></button>
					<button data-testid="operations-hub-game-guide" type="button" on:click={() => void openRulesFromMenu()}><PanelStateArt assets={BLACKSITE_ASSETS.ui.premiumPanels.modeCard} />{#if devUiV22Enabled}<span class="menu-action-icon"><UiGlyph enabled name="info" size={64} /></span>{/if}<span>GAME GUIDE</span><small>Rules, symbols, modes, BLACKOUT feature and controls.</small></button>
				</div>
			</section>
		</div>
	{/if}

	{#if modeDialogOpen}
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="modal-backdrop" on:click|self={() => void closeModeDialog()}>
			<section
				class="menu-dialog mode-dialog"
				data-testid="mode-dialog"
				role="dialog"
				aria-modal="true"
				aria-labelledby="mode-dialog-title"
				tabindex="-1"
				bind:this={modeDialog}
			>
				{#if devUiV21Enabled}<div class="premium-dialog-frame" aria-hidden="true"><UiSurface enabled kind="panel" fallbackSrc={BLACKSITE_ASSETS.ui.premiumPanels.dialogs.mode} /></div>{:else}<img class="premium-dialog-frame" src={BLACKSITE_ASSETS.ui.premiumPanels.dialogs.mode} alt="" draggable="false" aria-hidden="true" />{/if}
				<header class="v27-surface-carrier v27-modal-header">
					{#if devUiV22Enabled}<UiSurface enabled kit={BLACKSITE_ASSETS.ui.v27} kind="header" interactive={false} />{/if}
					<div><span>ENTRY PROTOCOL</span><h2 id="mode-dialog-title">{devFixtureUiPreview ? 'CURRENT MODE' : 'SELECT MODE'}</h2></div>
					<button bind:this={modeCloseButton} data-testid="mode-close" type="button" aria-label="Close mode selection" on:click={() => void closeModeDialog()}><HudIcon name="close" /></button>
				</header>
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<div class="mode-list mode-dialog-list" role="region" aria-label="Available entry modes" tabindex="0">
					{#each MODES as mode}
						{#if !(buyFeatureDisabled && liveSnapshot.config?.betModes?.[mode.id]?.feature)}
							<button
								type="button"
								data-testid={`mode-${mode.id}`}
								data-mode-state={modeCardState(mode.id)}
								class:selected={mode.id === selectedModeId}
								aria-pressed={mode.id === selectedModeId}
								disabled={(autoRunning || launch.kind !== 'live' || liveSnapshot.status !== 'ready' || primaryBusy)
									&& !(devFixtureUiPreview && mode.id === selectedModeId)}
								on:click={() => void chooseMode(mode.id)}
							>
								<PanelStateArt assets={BLACKSITE_ASSETS.ui.premiumPanels.modeCard} />
								<img class="mode-key-art" src={BLACKSITE_ASSETS.v19.modes[mode.id]} alt="" draggable="false" aria-hidden="true" />
								<span>{getModeLabel(mode.id, social)}</span>
								<small class="mode-card-effect">{displaySpecialSymbolCopy(getModeActionDescription(mode.id, social))}</small>
								<div class="mode-card-meta">
								<span class="mode-card-facts" aria-hidden="true"><b>RTP {(mode.targetRtp * 100).toFixed(2)}%</b><b>MAX {mode.maxWinRaw / 100}×</b></span>
								{#if !devFixtureUiPreview}<span class="mode-card-total"><small>{social ? 'TOTAL PLAY' : 'TOTAL'}</small><b>{modeTotalText(mode.id)}</b></span>{/if}
									<em class="v27-surface-carrier v27-chip-surface">{#if devUiV22Enabled}<UiSurface enabled kit={BLACKSITE_ASSETS.ui.v27} kind="chip" state={['ACTIVE', 'CURRENT'].includes(modeCardState(mode.id)) ? 'selected' : 'idle'} selected={['ACTIVE', 'CURRENT'].includes(modeCardState(mode.id))} interactive={false} />{/if}<span>{modeCardState(mode.id)}</span></em>
								</div>
								<strong><small>MODE COST</small>{mode.costMultiplier}×</strong>
							</button>
						{/if}
					{/each}
				</div>
			</section>
		</div>
	{/if}

	{#if confirmationOpen}
		<!-- Backdrop pointer dismissal complements the dialog's global Escape handler. -->
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="modal-backdrop" on:click|self={() => void closeConfirmation()}>
			<section
				class="confirmation-dialog"
				data-testid="confirmation-dialog"
				role="dialog"
				aria-modal="true"
				aria-labelledby="confirm-title"
				tabindex="-1"
				bind:this={confirmationDialog}
			>
				{#if devUiV21Enabled}<div class="premium-dialog-frame" aria-hidden="true"><UiSurface enabled kind="panel" fallbackSrc={BLACKSITE_ASSETS.ui.premiumPanels.dialogs.confirmation} /></div>{:else}<img class="premium-dialog-frame" src={BLACKSITE_ASSETS.ui.premiumPanels.dialogs.confirmation} alt="" draggable="false" aria-hidden="true" />{/if}
				<div class="confirmation-scroll" data-testid="confirmation-scroll">
					<span>SECURE ENTRY AUTHORIZATION</span>
					<h2 id="confirm-title" data-testid="confirmation-mode">{devFixtureUiPreview ? 'MODE PREVIEW' : 'CONFIRM'} {getModeLabel(selectedMode.id, social)}</h2>
					<div class="confirmation-ledger">
						<p class="v27-surface-carrier v27-content-surface">{#if devUiV22Enabled}<UiSurface enabled kit={BLACKSITE_ASSETS.ui.v27} kind="content" interactive={false} />{/if}<span>BASE PLAY AMOUNT</span><strong data-testid="confirmation-base">{devFixtureUiPreview ? 'NO CHARGE' : formatExactApi(baseAmountApi, currency)}</strong></p>
						<p class="v27-surface-carrier v27-content-surface">{#if devUiV22Enabled}<UiSurface enabled kit={BLACKSITE_ASSETS.ui.v27} kind="content" interactive={false} />{/if}<span>MODE COST</span><strong data-testid="confirmation-multiplier">{selectedMode.costMultiplier}×</strong></p>
						<p class="v27-surface-carrier v27-content-surface">{#if devUiV22Enabled}<UiSurface enabled kit={BLACKSITE_ASSETS.ui.v27} kind="content" interactive={false} />{/if}<span>COMPLETE PLAY AMOUNT</span><strong data-testid="confirmation-total">{devFixtureUiPreview ? 'PREVIEW' : totalAmountText}</strong></p>
					</div>
					<p data-testid="confirmation-effect">{selectedModeGuide}</p>
					<div class="modal-actions" class:preview-only={devFixtureUiPreview}>
						{#if devFixtureUiPreview}
							<button class="preview-close-action" bind:this={confirmationCancelButton} data-testid="confirmation-cancel" type="button" on:click={() => void closeConfirmation()}><PanelStateArt assets={BLACKSITE_ASSETS.ui.premiumPanels.modeCard} selected /><span>CLOSE PREVIEW</span></button>
						{:else}
							<button bind:this={confirmationCancelButton} data-testid="confirmation-cancel" type="button" on:click={() => void closeConfirmation()}><PanelStateArt assets={BLACKSITE_ASSETS.ui.premiumPanels.modeCard} /><span>CANCEL</span></button>
							<button class="confirm-action" data-testid="confirmation-start" type="button" on:click={confirmLivePlay}><PanelStateArt assets={BLACKSITE_ASSETS.ui.premiumPanels.modeCard} selected /><span>START {getModeLabel(selectedMode.id, social)} — {totalAmountText}</span></button>
						{/if}
					</div>
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
				data-testid="game-guide-dialog"
				role="dialog"
				aria-modal="true"
				aria-labelledby="rules-title"
				tabindex="-1"
				bind:this={rulesDialog}
			>
				{#if devUiV21Enabled}<div class="premium-dialog-frame" aria-hidden="true"><UiSurface enabled kind="panel" fallbackSrc={BLACKSITE_ASSETS.ui.premiumPanels.dialogs.rules} /></div>{:else}<img class="premium-dialog-frame" src={BLACKSITE_ASSETS.ui.premiumPanels.dialogs.rules} alt="" draggable="false" aria-hidden="true" />{/if}
				<header class="v27-surface-carrier v27-modal-header">
					{#if devUiV22Enabled}<UiSurface enabled kit={BLACKSITE_ASSETS.ui.v27} kind="header" interactive={false} />{/if}
					<div>
						<span>AUTHORITATIVE FIELD MANUAL</span>
						<h2 id="rules-title">GAME GUIDE</h2>
					</div>
					<button bind:this={rulesCloseButton} data-testid="rules-close" type="button" aria-label="Close game information" on:click={() => void closeRules()}><HudIcon name="close" /></button>
				</header>
				<div class="guide-tabs" role="tablist" aria-label="Game guide sections">
					{#each GUIDE_TABS as tab, index}
						<button data-testid={`game-guide-tab-${tab.id}`} id={`game-guide-tab-${tab.id}`} role="tab" aria-selected={guideTab === tab.id} aria-controls="game-guide-panel" tabindex={guideTab === tab.id ? 0 : -1} class:active={guideTab === tab.id} type="button" on:click={() => void selectGuideTab(tab.id)} on:keydown={(event) => handleGuideTabKey(event, index)}>{#if devUiV21Enabled}<UiSurface enabled kind="control" selected={guideTab === tab.id} fallbackSrc={BLACKSITE_ASSETS.ui.premiumPanels.modeCard.normal} />{/if}<span>{social && tab.id === 'symbols' ? 'SYMBOLS & RESULTS' : tab.label}</span></button>
					{/each}
				</div>

				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<div class="rules-scroll game-guide-scroll" data-testid="game-guide-scroll" role="region" aria-label="Game guide content" tabindex="0" bind:this={guideScroll}>
					<div class="game-guide-panel" id="game-guide-panel" data-testid="game-guide-panel" role="tabpanel" aria-labelledby={`game-guide-tab-${guideTab}`}>
						{#if guideTab === 'overview'}
							<div class="rules-section-heading"><span>QUICK START</span><h3>HOW TO PLAY</h3></div>
							<p class="rules-lead">{rulesInterfaceCopy.rulesLead}</p>
							<div class="rules-step-grid guide-four-steps">{#each GUIDE_QUICK_STEPS as item}<article class="v27-surface-carrier v27-content-surface">{#if devUiV22Enabled}<UiSurface enabled kit={BLACKSITE_ASSETS.ui.v27} kind="content" interactive={false} />{/if}<em>{item.step}</em><h4>{displaySpecialSymbolCopy(item.title)}</h4><p>{displaySpecialSymbolCopy(item.copy)}</p></article>{/each}</div>
							<div class="formula-strip v27-surface-carrier v27-content-surface">{#if devUiV22Enabled}<UiSurface enabled kit={BLACKSITE_ASSETS.ui.v27} kind="content" interactive={false} />{/if}<strong>{rulesInterfaceCopy.totalFormula}</strong><span>10 fixed lines · 3+ from the left · 3 VAULT = 8 free spins.</span></div>
							<div class="guide-boot-actions" aria-label="Startup presentation controls">
								<button data-testid="game-guide-replay-intro" type="button" disabled={primaryBusy || vaultCinematicState.active} on:click={() => void replayBootIntro()}><PanelStateArt assets={BLACKSITE_ASSETS.ui.premiumPanels.modeCard} /><span>{briefingControlCopy.introReplay}</span></button>
								<button data-testid="game-guide-open-briefing" type="button" disabled={primaryBusy || vaultCinematicState.active} on:click={() => void reopenMissionBriefing()}><PanelStateArt assets={BLACKSITE_ASSETS.ui.premiumPanels.modeCard} /><span>{briefingControlCopy.briefingReplay}</span></button>
							</div>
						{:else if guideTab === 'symbols'}
							<h3>{rulesInterfaceCopy.resultHeading}</h3><p>{displaySpecialSymbolCopy(rulesInterfaceCopy.resultExplanation)}</p>
							<section class="symbol-card-section"><h4>HIGH VALUE</h4><div class="symbol-card-grid">{#each GUIDE_HIGH_SYMBOLS as symbol}<article class="v27-surface-carrier v27-content-surface">{#if devUiV22Enabled}<UiSurface enabled kit={BLACKSITE_ASSETS.ui.v27} kind="content" interactive={false} />{/if}<img src={baseSymbolAsset(symbol)} alt="" aria-hidden="true" /><strong>{SYMBOL_DISPLAY_NAMES[symbol]}</strong><span>{#each LINE_LENGTHS as band, index}<small><b>{band.label}</b>{formatCentiMultiplier(SYMBOL_PAYOUTS[symbol][index])}</small>{/each}</span></article>{/each}</div></section>
							<section class="symbol-card-section"><h4>CARDS</h4><div class="symbol-card-grid compact">{#each GUIDE_CARD_SYMBOLS as symbol}<article class="v27-surface-carrier v27-content-surface">{#if devUiV22Enabled}<UiSurface enabled kit={BLACKSITE_ASSETS.ui.v27} kind="content" interactive={false} />{/if}<img src={BLACKSITE_ASSETS.symbols.states[symbol].base} alt="" aria-hidden="true" /><strong>{SYMBOL_DISPLAY_NAMES[symbol]}</strong><span>{#each LINE_LENGTHS as band, index}<small><b>{band.label}</b>{formatCentiMultiplier(SYMBOL_PAYOUTS[symbol][index])}</small>{/each}</span></article>{/each}</div></section>
						<div class="special-symbol-cards"><article class="v27-surface-carrier v27-content-surface">{#if devUiV22Enabled}<UiSurface enabled kit={BLACKSITE_ASSETS.ui.v27} kind="content" interactive={false} />{/if}<img src={BLACKSITE_ASSETS.symbols.states.ghost_wild.base} alt="" aria-hidden="true" /><div><h4>GHOST WILD</h4><p>{displaySpecialSymbolCopy(RULES_CONTRACT.specialSymbols[0].copy)}</p><span>{#each LINE_LENGTHS as band, index}<small><b>{band.label}</b>{formatCentiMultiplier(SYMBOL_PAYOUTS.ghost_wild[index])}</small>{/each}</span></div></article><article class="v27-surface-carrier v27-content-surface">{#if devUiV22Enabled}<UiSurface enabled kit={BLACKSITE_ASSETS.ui.v27} kind="content" interactive={false} />{/if}<img src={BLACKSITE_ASSETS.symbols.states.breach.base} alt="" aria-hidden="true" /><div><h4>VAULT TRIGGER</h4><p>{displaySpecialSymbolCopy(RULES_CONTRACT.specialSymbols[1].copy)} It has no line award.</p></div></article></div>
						{:else if guideTab === 'modes'}
							<h3>ENTRY MODES</h3><div class="guide-mode-cards">{#each MODES as mode}<article class="v27-surface-carrier v27-content-surface">{#if devUiV22Enabled}<UiSurface enabled kit={BLACKSITE_ASSETS.ui.v27} kind="content" interactive={false} />{/if}<img src={BLACKSITE_ASSETS.v19.modes[mode.id]} alt="" aria-hidden="true" /><div><h4>{getModeLabel(mode.id, social)}</h4><p>{displaySpecialSymbolCopy(getModeActionDescription(mode.id, social))}</p><span class="guide-mode-facts"><small>RTP {(mode.targetRtp * 100).toFixed(2)}%</small><small>MAX WIN {mode.maxWinRaw / 100}×</small></span></div><strong>{mode.costMultiplier}×</strong></article>{/each}</div>
						{:else if guideTab === 'vault'}
						<h3>BLACKOUT BONUS</h3><div class="vault-guide-hero v27-surface-carrier v27-content-surface">{#if devUiV22Enabled}<UiSurface enabled kit={BLACKSITE_ASSETS.ui.v27} kind="content" interactive={false} />{/if}<img src={BLACKSITE_ASSETS.symbols.states.breach.triggered} alt="" aria-hidden="true" /><div>{#each RULES_CONTRACT.feature as line}<p>{displaySpecialSymbolCopy(line)}</p>{/each}</div></div><div class="vault-timeline" data-cinematic-stage-count={VAULT_TIMELINE.length} aria-label="BLACKOUT bonus timeline">{#each VAULT_GUIDE_STEPS as step, index}<span class="v27-surface-carrier v27-content-surface">{#if devUiV22Enabled}<UiSurface enabled kit={BLACKSITE_ASSETS.ui.v27} kind="content" interactive={false} />{/if}<b>{String(index + 1).padStart(2, '0')}</b><small class="v27-live-copy">{displaySpecialSymbolCopy(step)}</small></span>{/each}</div>
						{:else}
							<h3>CONTROLS & LEGAL</h3><div class="guide-contract-facts"><span class="v27-surface-carrier v27-content-surface">{#if devUiV22Enabled}<UiSurface enabled kit={BLACKSITE_ASSETS.ui.v27} kind="content" interactive={false} />{/if}<small>AUTHORITATIVE RTP</small><strong>{(RULES_CONTRACT.targetRtp * 100).toFixed(2)}%</strong></span><span class="v27-surface-carrier v27-content-surface">{#if devUiV22Enabled}<UiSurface enabled kit={BLACKSITE_ASSETS.ui.v27} kind="content" interactive={false} />{/if}<small>MAX WIN</small><strong>{RULES_CONTRACT.maxWinRaw / 100}×</strong></span></div><div class="rules-copy-grid"><section class="v27-surface-carrier v27-content-surface">{#if devUiV22Enabled}<UiSurface enabled kit={BLACKSITE_ASSETS.ui.v27} kind="content" interactive={false} />{/if}{#each RULES_CONTRACT.controls as line}<p>{displaySpecialSymbolCopy(line)}</p>{/each}</section><section class="v27-surface-carrier v27-content-surface">{#if devUiV22Enabled}<UiSurface enabled kit={BLACKSITE_ASSETS.ui.v27} kind="content" interactive={false} />{/if}<p>Turbo and Skip change presentation time only. Mute affects game audio only. Neither changes the outcome, price or settlement.</p><p>{legalDisclaimer}</p></section></div>
						{/if}
					</div>
				</div>
			</section>
		</div>
	{/if}

	{#if autoDialogOpen}
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="modal-backdrop" on:click|self={() => void closeAutoDialog()}>
			<section
				class="auto-dialog"
				data-testid="auto-dialog"
				role="dialog"
				aria-modal="true"
				aria-labelledby="auto-title"
				tabindex="-1"
				bind:this={autoDialog}
			>
				{#if devUiV21Enabled}<div class="premium-dialog-frame" aria-hidden="true"><UiSurface enabled kind="panel" fallbackSrc={BLACKSITE_ASSETS.ui.premiumPanels.dialogs.auto} /></div>{:else}<img class="premium-dialog-frame" src={BLACKSITE_ASSETS.ui.premiumPanels.dialogs.auto} alt="" draggable="false" aria-hidden="true" />{/if}
				<header class="v27-surface-carrier v27-modal-header">
					{#if devUiV22Enabled}<UiSurface enabled kit={BLACKSITE_ASSETS.ui.v27} kind="header" interactive={false} />{/if}
					<div><span>LIMITED AUTOPLAY</span><h2 id="auto-title">SELECT SPINS</h2></div>
					<button bind:this={autoCloseButton} data-testid="auto-close" type="button" aria-label="Close autoplay selection" on:click={() => void closeAutoDialog()}><HudIcon name="close" /></button>
				</header>
				<div class="auto-body">
					{#if launch.kind === 'fixture'}
						<div class="auto-preview-note v27-surface-carrier v27-content-surface" data-testid="auto-unavailable-reason">{#if devUiV22Enabled}<UiSurface enabled kit={BLACKSITE_ASSETS.ui.v27} kind="content" interactive={false} />{/if}<strong>AUTOPLAY IS AVAILABLE IN LIVE PLAY</strong><span>Connect a player session to choose a spin count.</span></div>
					{:else}
						<p>Base mode only. Stops on errors, {social ? 'insufficient available amount' : 'insufficient balance'} or STOP.</p>
						<div class="auto-options" aria-label="Autoplay spin count">
							{#each [5, 10, 25] as count}
								<button data-testid={`auto-count-${count}`} type="button" class:selected={autoSpinCount === count} aria-pressed={autoSpinCount === count} disabled={autoplayDisabled} on:click={() => autoSpinCount = count}><PanelStateArt assets={BLACKSITE_ASSETS.ui.premiumPanels.modeCard} /><strong>{count}</strong><small>SPINS</small></button>
							{/each}
						</div>
						<div class="auto-summary v27-surface-carrier v27-content-surface">{#if devUiV22Enabled}<UiSurface enabled kit={BLACKSITE_ASSETS.ui.v27} kind="content" interactive={false} />{/if}<span>TOTAL FOR {autoSpinCount} SPINS</span><strong>{autoCostText}</strong></div>
						{#if autoUnavailableReason}<p class="auto-warning" data-testid="auto-unavailable-reason">{autoUnavailableReason}</p>{/if}
						<button class="auto-start" data-testid="auto-start" type="button" disabled={!autoEligible} on:click={() => void startAutoplay()}><PanelStateArt assets={BLACKSITE_ASSETS.ui.premiumPanels.modeCard} selected={autoEligible} disabled={!autoEligible} /><span>START {autoSpinCount} SPINS</span></button>
					{/if}
				</div>
			</section>
		</div>
	{/if}

	{#if settingsOpen}
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div class="modal-backdrop" on:click|self={() => void closeSettings()}>
			<section
				class="settings-dialog"
				data-testid="settings-dialog"
				role="dialog"
				aria-modal="true"
				aria-labelledby="settings-title"
				tabindex="-1"
				bind:this={settingsDialog}
			>
				{#if devUiV21Enabled}<div class="premium-dialog-frame" aria-hidden="true"><UiSurface enabled kind="panel" fallbackSrc={BLACKSITE_ASSETS.ui.premiumPanels.dialogs.settings} /></div>{:else}<img class="premium-dialog-frame" src={BLACKSITE_ASSETS.ui.premiumPanels.dialogs.settings} alt="" draggable="false" aria-hidden="true" />{/if}
				<header class="v27-surface-carrier v27-modal-header">
					{#if devUiV22Enabled}<UiSurface enabled kit={BLACKSITE_ASSETS.ui.v27} kind="header" interactive={false} />{/if}
					<div><span>GAME PREFERENCES</span><h2 id="settings-title">SETTINGS</h2></div>
					<button bind:this={settingsCloseButton} data-testid="settings-close" type="button" aria-label="Close settings" on:click={() => void closeSettings()}><HudIcon name="close" /></button>
				</header>
				<div class="settings-body">
					<button data-testid="global-mute-toggle" class:active={!audioMuted} type="button" aria-pressed={!audioMuted} on:click={toggleAudioMuted}>
						<PanelStateArt assets={BLACKSITE_ASSETS.ui.premiumPanels.modeCard} /><span>{#if devUiV22Enabled}<UiGlyph enabled name="audio" size={28} />{/if} AUDIO</span><strong>{audioMuted ? 'MUTED' : 'ON'}</strong>
					</button>
					<button data-testid="settings-turbo-toggle" class:active={turboEnabled} type="button" aria-pressed={turboEnabled} disabled={turboDisabled} on:click={toggleTurboPresentation}>
						<PanelStateArt assets={BLACKSITE_ASSETS.ui.premiumPanels.modeCard} /><span>{#if devUiV22Enabled}<UiGlyph enabled name="turbo" size={28} />{:else}<HudIcon name="turbo" />{/if} TURBO PRESENTATION</span><strong>{turboDisabled ? 'REGION LOCKED' : turboEnabled ? 'ON' : 'OFF'}</strong>
					</button>
					<button data-testid="rage-out-toggle" class:active={rageOutEnabled} type="button" aria-pressed={rageOutEnabled} disabled={launch.kind !== 'live'} on:click={toggleRageOut}>
						<PanelStateArt assets={BLACKSITE_ASSETS.ui.premiumPanels.modeCard} /><span>{#if devUiV22Enabled}<UiGlyph enabled name="warning" size={28} />{/if} OPERATOR REACTIONS</span><strong>{launch.kind === 'live' ? (rageOutEnabled ? 'ON' : 'OFF') : 'LIVE ONLY'}</strong>
					</button>
					<p>Turbo changes presentation speed only. Outcomes and payouts do not change.</p>
				</div>
			</section>
		</div>
	{/if}

	<VaultCinematic
		cinematic={vaultCinematicState}
		assets={BLACKSITE_ASSETS.v19}
		devRigEnabled={devVaultRigEnabled}
		devMotion={devVaultMotionState}
		devFixtureId={launch.kind === 'fixture' ? launch.fixtureId : null}
		targetLabel={featureTargetLabel}
		targetAsset={featureTargetAsset}
		winLabel={formatPresentedWin(vaultCinematicState.winRaw ?? presentation.cumulativeWinRaw ?? 0)}
		on:skip={skipVaultCinematic}
		on:return={returnVaultToBase}
	/>
</main>

{#if startupFailureVisible}
	<aside class="startup-failure-gate" data-testid="startup-failure-gate" aria-label="Startup error">
		<div
			bind:this={runtimeErrorDialog}
			class="launch-card error startup-failure-card"
			data-testid="launch-error"
			role="alertdialog"
			aria-modal="true"
			aria-labelledby="startup-error-title"
			aria-describedby="startup-error-message startup-error-help"
			tabindex="-1"
		>
			<div class="premium-dialog-frame" aria-hidden="true"><UiSurface enabled kind="panel" tone="danger" fallbackSrc={BLACKSITE_ASSETS.ui.premiumPanels.dialogs.runtimeError} /></div>
			<div class="startup-failure-content v27-surface-carrier v27-content-surface">
				<UiSurface enabled kit={BLACKSITE_ASSETS.ui.v27} kind="content" tone="danger" danger interactive={false} />
				<strong id="startup-error-title">{social ? 'AUTHORITATIVE_ERROR' : (runtimeError?.code ?? launch.code)}</strong>
				<span id="startup-error-message">{visibleRuntimeMessage ?? launch.message}</span>
			</div>
			<button bind:this={recoveryButton} type="button" data-testid="recovery-action" on:click={recoverRuntime}>
				<PanelStateArt assets={BLACKSITE_ASSETS.ui.premiumPanels.modeCard} tone="danger" />
				<span>{launch.kind === 'fixture' ? 'RELOAD FIXTURE' : 'RELOAD / RESTORE'}</span>
			</button>
			<small id="startup-error-help">No local round or development fallback was started. Gameplay remains locked.</small>
		</div>
	</aside>
{:else}
	<BlacksiteBootSequence
		bind:this={bootSequenceComponent}
		criticalAssets={bootCriticalAssets}
		preloadCriticalAudio={() => audioDirector?.preloadCritical?.() ?? Promise.resolve({ requested: 0, loaded: 0, failed: 0 })}
		reducedMotion={reducedMotionQuery?.matches === true}
		language={launch.language ?? 'en'}
		{social}
		{audioMuted}
		launchKind={launch.kind}
		activeRound={Boolean(liveSnapshot.round?.active)}
		on:statechange={handleBootStateChange}
		on:missionaccepted={handleBootMissionAccepted}
		on:ready={handleBootReady}
	/>
{/if}

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

	.startup-failure-gate {
		position: fixed;
		z-index: 10020;
		inset: 0;
		display: grid;
		place-items: center;
		padding: max(18px, env(safe-area-inset-top)) max(18px, env(safe-area-inset-right))
			max(18px, env(safe-area-inset-bottom)) max(18px, env(safe-area-inset-left));
		background:
			radial-gradient(circle at 50% 42%, rgba(132, 47, 30, .24), transparent 38%),
			linear-gradient(145deg, rgba(4, 8, 9, .97), rgba(1, 3, 4, .995));
	}

	.startup-failure-card {
		position: relative;
		display: grid;
		width: min(560px, 100%);
		max-height: calc(100dvh - 36px);
		gap: 16px;
		padding: clamp(24px, 5vw, 48px);
		overflow: auto;
		border: 1px solid rgba(222, 105, 91, .74);
		background: linear-gradient(145deg, rgba(42, 18, 18, .98), rgba(12, 12, 13, .98));
		box-shadow: 0 32px 110px rgba(0, 0, 0, .76), inset 0 1px rgba(255, 199, 190, .12);
		clip-path: polygon(0 0, calc(100% - 26px) 0, 100% 26px, 100% 100%, 20px 100%, 0 calc(100% - 20px));
		overflow-wrap: anywhere;
	}

	.startup-failure-content {
		display: grid;
		gap: 9px;
	}

	.startup-failure-content strong {
		color: #ffaaa1;
		font-size: clamp(15px, 3vw, 22px);
		letter-spacing: .1em;
	}

	.startup-failure-content span,
	.startup-failure-card small {
		color: #d9c9c6;
		font-size: clamp(11px, 2vw, 14px);
		line-height: 1.5;
	}

	.startup-failure-card button {
		position: relative;
		isolation: isolate;
		min-height: 48px;
		overflow: hidden;
	}

	.startup-failure-card button > span {
		position: relative;
		z-index: 1;
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
			linear-gradient(rgba(69, 114, 121, 0.07) 1px, transparent 1px),
			linear-gradient(90deg, rgba(69, 114, 121, 0.07) 1px, transparent 1px),
			#081015;
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
	.contract-grid span {
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
		max-width: 50%;
		color: #a7bdc1;
		font-size: clamp(8px, 0.75vw, 11px);
		letter-spacing: 0.08em;
		text-align: right;
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
		background: rgba(9, 20, 25, 0.93);
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.28);
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
	.mode-list button:focus-visible,
	.mode-list button.selected {
		border-color: #e05b55;
		background: #182328;
		outline: none;
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

	.mode-list small {
		color: #55767d;
		font-size: 9px;
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
		padding: 7px 30px 7px 10px;
		border: 1px solid #3c626b;
		border-radius: 0;
		background: #0d1b20;
		color: #dce8ea;
		cursor: pointer;
	}

	.amount-control select:focus-visible {
		border-color: #efc06a;
		outline: 2px solid rgba(239, 192, 106, 0.3);
		outline-offset: 1px;
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
		outline: 2px solid rgba(239, 192, 106, 0.42);
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

	.mode-readout,
	.contract-grid {
		display: grid;
		gap: 1px;
		margin-top: auto;
		background: #29434a;
		border: 1px solid #29434a;
	}

	.mode-readout > div,
	.contract-grid > div {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		min-width: 0;
		padding: 7px 9px;
		background: #0b171c;
	}

	.mode-readout strong,
	.contract-grid strong {
		overflow: hidden;
		color: #c8d7da;
		font-size: clamp(9px, 0.72vw, 11px);
		text-align: right;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.board-stage {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		gap: clamp(8px, 1vh, 12px);
		padding: clamp(9px, 1vw, 15px);
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
		border: 1px solid #48646b;
		background: #071015;
		box-shadow: inset 0 0 0 3px #0e2228;
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
		border: 1px solid #263d43;
		background: #112126;
		color: #8fa8ad;
		transition: border-color 140ms ease, background 140ms ease, color 140ms ease;
	}

	.cell::after {
		position: absolute;
		inset: 7%;
		border: 1px solid rgba(129, 163, 170, 0.12);
		content: '';
	}

	.cell small {
		position: absolute;
		top: 3px;
		left: 4px;
		color: #38555c;
		font-size: clamp(5px, 0.42vw, 8px);
	}

	.cell strong {
		font-size: clamp(8px, 1.05vw, 17px);
		letter-spacing: 0.04em;
	}

	.cell.line-active {
		z-index: 1;
		border-color: #f4d06f;
		background: #4a3717;
		color: #fff0bd;
		box-shadow: inset 0 0 18px rgba(244, 208, 111, 0.42), 0 0 8px rgba(244, 208, 111, 0.36);
	}

	.line-win-cue {
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

	.line-win-cue strong {
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
		gap: 7px;
		margin-top: auto;
	}

	.primary-action {
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
		outline: 2px solid #f4d19b;
		outline-offset: 2px;
	}

	.primary-action:disabled {
		border-color: #354b51;
		background: #17272c;
		color: #6d858b;
		cursor: not-allowed;
	}

	.info-action {
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
		outline: none;
	}

	.hashes {
		display: grid;
		gap: 3px;
		color: #4f7077;
		font-size: clamp(7px, 0.58vw, 9px);
		word-break: break-all;
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

	.table-scroll-hint {
		display: none;
		color: #e5b95f;
		font-size: 8px;
		font-weight: 800;
		letter-spacing: 0.09em;
		text-align: right;
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

	.rules-quick-start {
		padding: clamp(12px, 2vw, 20px);
		border: 1px solid rgba(91, 169, 179, 0.56);
		background:
			radial-gradient(circle at 12% 0, rgba(55, 184, 201, 0.11), transparent 42%),
			linear-gradient(145deg, rgba(12, 33, 39, 0.98), rgba(5, 17, 21, 0.98));
		box-shadow: inset 0 0 24px rgba(40, 157, 173, 0.05);
	}

	.rules-section-heading {
		display: flex;
		align-items: baseline;
		gap: 9px;
	}

	.rules-section-heading > span {
		color: #f1bd64;
		font-size: 9px;
		font-weight: 800;
		letter-spacing: 0.14em;
	}

	.rules-lead {
		max-width: 760px;
		color: #d1e0e2 !important;
		font-size: 12px !important;
	}

	.rules-step-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 8px;
	}

	.rules-step-grid article {
		position: relative;
		display: grid;
		align-content: start;
		gap: 5px;
		min-height: 124px;
		padding: 12px 12px 12px 44px;
		border: 1px solid rgba(64, 115, 124, 0.68);
		background: rgba(3, 13, 16, 0.74);
	}

	.rules-step-grid em {
		position: absolute;
		top: 11px;
		left: 10px;
		display: grid;
		width: 25px;
		height: 25px;
		place-items: center;
		border: 1px solid #df5c52;
		color: #ff9b8f;
		font-size: 9px;
		font-style: normal;
		font-weight: 800;
	}

	.rules-step-grid h4 {
		margin: 0;
		color: #edf7f8;
		font-family: Arial, Helvetica, sans-serif;
		font-size: 13px;
	}

	.route-legend {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 6px;
	}

	.route-legend > div {
		display: grid;
		grid-template-columns: 12px auto;
		gap: 2px 7px;
		align-items: center;
		padding: 8px;
		border: 1px solid rgba(54, 94, 102, 0.72);
		background: rgba(4, 15, 18, 0.78);
	}

	.route-legend > div > span {
		grid-row: 1 / 3;
		width: 10px;
		height: 10px;
		border: 1px solid #56676b;
		background: #1a292d;
		box-shadow: 0 0 7px rgba(255, 255, 255, 0.06);
	}

	.route-legend .route-dormant > span {
		border-color: #c18b3d;
		background: #5c3c14;
		box-shadow: 0 0 8px rgba(223, 151, 53, 0.28);
	}

	.route-legend .route-live > span {
		border-color: #6fdcea;
		background: #167184;
		box-shadow: 0 0 9px rgba(72, 210, 231, 0.46);
	}

	.route-legend strong {
		color: #cfe0e2;
		font-size: 9px;
	}

	.route-legend p {
		grid-column: 2;
		font-size: 9px;
	}

	.formula-strip {
		display: grid;
		gap: 4px;
		padding: 10px 12px;
		border-left: 3px solid #e4ad51;
		background: rgba(51, 38, 15, 0.42);
	}

	.formula-strip strong {
		color: #f4c978;
		font-size: 10px;
	}

	.formula-strip span {
		color: #b8c9cc;
		font-size: 10px;
		line-height: 1.5;
	}

	@media (max-width: 680px) {
		.rules-step-grid,
		.route-legend {
			grid-template-columns: 1fr;
		}

		.rules-step-grid article {
			min-height: 0;
		}

		.table-scroll-hint {
			display: block;
		}
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
			max-width: 58%;
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
		.mode-readout,
		.contract-grid,
		.hashes {
			display: none;
		}

		.mode-list {
			grid-template-columns: repeat(3, 1fr);
			gap: 5px;
		}

		.mode-list button {
			min-height: 44px;
			padding: 5px 7px;
		}

		.mode-list button span {
			overflow: hidden;
			font-size: 9px;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.mode-list button small {
			display: none;
		}

		.amount-control {
			grid-template-columns: auto minmax(130px, 1fr);
			align-items: center;
			gap: 8px;
		}

		.board-frame {
			width: min(92vw, 51vh);
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
			width: min(91vw, 43vh);
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
		.mode-readout,
		.contract-grid,
		.hashes,
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
			padding: 5px 7px;
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


	/* V34 clarity pass: every live value owns one stable visual slot, authored
	   ornaments never become a second box, and secondary rules stay in the Guide. */
	.mechanic-contract-copy {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		overflow: hidden;
		clip: rect(0 0 0 0);
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.app-shell.dev-ui-v22 .reel-mechanic-strip:not(.feature-strip) {
		grid-template-columns: minmax(0, 1.15fr) minmax(0, .85fr);
		gap: clamp(5px, .55cqw, 10px);
	}

	.app-shell.dev-ui-v22 .reel-mechanic-strip:not(.feature-strip) > :global(.feature-hud-surface) {
		height: 100%;
		min-width: 0;
	}

	.app-shell.dev-ui-v22 .selected-mode-carrier {
		display: grid;
		height: 44px;
		min-height: 44px;
		grid-template-columns: auto minmax(0, 1fr);
		grid-template-rows: minmax(0, 1fr);
		align-items: center;
		gap: 10px;
		padding: 0 13px;
		text-align: left;
	}

	.app-shell.dev-ui-v22 .selected-mode-carrier > small {
		grid-column: 1;
		grid-row: 1;
		align-self: center;
		margin: 0;
	}

	.app-shell.dev-ui-v22 .selected-mode-carrier > strong {
		grid-column: 2;
		grid-row: 1;
		display: flex;
		min-width: 0;
		align-items: baseline;
		justify-content: flex-start;
		gap: 5px;
		margin: 0;
		line-height: 1;
	}

	.app-shell.dev-ui-v22 .control-deck .balance-meter,
	.app-shell.dev-ui-v22 .control-meter,
	.app-shell.dev-ui-v22 .status-plate {
		place-content: center;
		place-items: center;
		text-align: center;
	}

	.app-shell.dev-ui-v22 .premium-footer-id,
	.app-shell.dev-ui-v22 .premium-footer-clearance {
		display: none !important;
	}

	/* The hit target and its visible circular asset share one centre. The focus
	   indicator stays accessible but follows the circle instead of drawing a box. */
	.app-shell.dev-ui-v22 :is(.round-tool, .bet-step, .reel-spin) {
		display: grid;
		place-items: center;
		padding: 0 !important;
		border-radius: 50% !important;
	}

	.app-shell.dev-ui-v22 :is(.round-tool, .bet-step, .reel-spin):focus-visible {
		border-radius: 50% !important;
		outline-offset: 2px !important;
	}

	.app-shell.dev-ui-v22 :is(.round-tool, .bet-step, .reel-spin) > :global(.hud-icon) {
		place-self: center;
	}

	/* Mode cards keep the decision-critical content only. RTP and Max Win stay
	   available in the authoritative Game Guide instead of repeating per card. */
	.app-shell.dev-ui-v22 .mode-dialog {
		width: min(980px, calc(100vw - 32px));
		height: auto;
		min-height: 0;
		max-height: calc(100dvh - 32px);
	}

	.app-shell.dev-ui-v22 .mode-dialog-list {
		grid-template-columns: repeat(3, minmax(0, 1fr));
		grid-template-rows: none;
		grid-auto-rows: minmax(210px, auto);
		align-content: start;
		align-items: stretch;
		overflow: auto;
		padding: 18px;
	}

	.app-shell.dev-ui-v22 .mode-dialog-list button {
		display: grid !important;
		height: auto;
		min-height: 210px !important;
		grid-template-columns: minmax(58px, 22%) minmax(0, 1fr) auto !important;
		grid-template-rows: auto minmax(52px, 1fr) auto !important;
		align-content: stretch;
		align-items: start;
		gap: 8px 10px;
		padding: 18px 14px 16px !important;
	}

	.app-shell.dev-ui-v22 .mode-dialog-list button > span {
		grid-column: 2;
		grid-row: 1;
		align-self: center;
		padding: 0 !important;
		font-size: clamp(12px, 1.05vw, 15px);
		line-height: 1.15;
	}

	.app-shell.dev-ui-v22 .mode-dialog-list button > small {
		grid-column: 2 / -1 !important;
		grid-row: 2 !important;
		display: -webkit-box;
		align-self: start;
		max-height: 4.2em;
		margin: 0 !important;
		padding: 0 !important;
		overflow: hidden;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		font-size: 11px;
		line-height: 1.4;
	}

	.app-shell.dev-ui-v22 .mode-dialog-list button > strong {
		position: relative !important;
		top: auto !important;
		right: auto !important;
		bottom: auto !important;
		grid-column: 3;
		grid-row: 1;
		align-self: start;
		justify-self: end;
		font-size: clamp(18px, 1.6vw, 23px);
		line-height: 1;
	}

	.app-shell.dev-ui-v22 .mode-card-meta {
		position: relative;
		z-index: 2;
		display: flex;
		grid-column: 2 / -1;
		grid-row: 3;
		min-width: 0;
		align-items: end;
		justify-content: space-between;
		gap: 8px;
		padding: 0 !important;
	}

	.app-shell.dev-ui-v22 .mode-card-facts { display: none !important; }
	.app-shell.dev-ui-v22 .mode-card-total { min-width: 0; }
	.app-shell.dev-ui-v22 .mode-card-meta > em {
		display: inline-grid;
		min-height: 28px;
		place-items: center;
		justify-self: end;
		margin-left: auto;
		padding: 5px 10px;
		white-space: nowrap;
	}

	/* Game Guide height follows its content. Longer paytable tabs scroll inside
	   the frame instead of forcing every short tab into an empty 820px panel. */
	.app-shell.dev-ui-v22 .rules-dialog {
		height: auto !important;
		min-height: 0;
		max-height: calc(100dvh - 32px);
	}

	.app-shell.dev-ui-v22 .game-guide-scroll {
		min-height: 0;
		max-height: min(66dvh, 650px);
		overflow: auto;
		overscroll-behavior: contain;
	}

	.app-shell.dev-ui-v22 .game-guide-panel { min-height: 0; }
	.app-shell.dev-ui-v22 .rules-lead { display: none; }
	.app-shell.dev-ui-v22 .guide-four-steps { grid-template-columns: repeat(3, minmax(0, 1fr)); }
	.app-shell.dev-ui-v22 .guide-boot-actions button {
		min-height: 52px;
		place-content: center;
		padding: 12px 16px;
		text-align: center;
	}

	.app-shell.dev-ui-v22 :is(
		.rules-step-grid article,
		.formula-strip,
		.guide-mode-cards article,
		.special-symbol-cards article,
		.rules-copy-grid section
	) {
		padding: 14px 16px 18px;
	}

	.app-shell.dev-ui-v22 .symbol-card-grid.compact {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}

	.app-shell.dev-ui-v22 .menu-dialog:not(.mode-dialog) .menu-actions button {
		grid-template-rows: 78px minmax(34px, auto) minmax(38px, auto);
		align-content: start;
	}

	.app-shell.dev-ui-v22 .menu-dialog:not(.mode-dialog) .menu-actions button > span,
	.app-shell.dev-ui-v22 .menu-dialog:not(.mode-dialog) .menu-actions button > small {
		align-self: start;
	}

	.app-shell.dev-ui-v22 .auto-preview-note {
		position: relative;
		display: grid;
		min-height: 150px;
		place-content: center;
		gap: 8px;
		padding: 24px;
		text-align: center;
	}

	.app-shell.dev-ui-v22 .auto-preview-note > strong,
	.app-shell.dev-ui-v22 .auto-preview-note > span {
		position: relative;
		z-index: 1;
	}

	.app-shell.dev-ui-v22 .auto-preview-note > strong { color: #f1cf86; font-size: 14px; letter-spacing: .08em; }
	.app-shell.dev-ui-v22 .auto-preview-note > span { color: #9eaaa8; font-size: 11px; }
	.app-shell.dev-ui-v22 .settings-body > button[data-testid='rage-out-toggle']:disabled { display: none; }

	@media (min-width: 1041px) and (max-width: 1400px) and (min-height: 561px) and (min-aspect-ratio: 4/3) {
		.app-shell.dev-ui-v22 .selected-mode-carrier { max-width: 230px; }
		.app-shell.dev-ui-v22 .selected-mode-carrier small { display: block !important; }
		.app-shell.dev-ui-v22 .selected-mode-carrier .mode-label-full { display: inline !important; }
		.app-shell.dev-ui-v22 .selected-mode-carrier .mode-label-compact { display: none !important; }
	}

	@media (max-width: 700px) {
		.app-shell.dev-ui-v22 .mode-dialog {
			width: calc(100vw - 16px);
			height: calc(100dvh - 16px);
			max-height: calc(100dvh - 16px);
		}

		.app-shell.dev-ui-v22 .mode-dialog-list {
			height: auto;
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: none;
			grid-auto-rows: minmax(136px, auto);
			gap: 8px;
			overflow-y: auto;
			padding: 8px 10px 12px;
		}

		.app-shell.dev-ui-v22 .mode-dialog-list button {
			height: auto;
			min-height: 136px !important;
			grid-template-columns: minmax(64px, 22%) minmax(0, 1fr) auto !important;
			grid-template-rows: auto minmax(36px, 1fr) auto !important;
			gap: 5px 8px;
			padding: 13px 12px 12px !important;
		}

		.app-shell.dev-ui-v22 .mode-dialog-list button > span { font-size: 12px; }
		.app-shell.dev-ui-v22 .mode-dialog-list button > small {
			max-height: 2.8em;
			-webkit-line-clamp: 2;
			line-clamp: 2;
			font-size: 9px;
			line-height: 1.4;
		}
		.app-shell.dev-ui-v22 .mode-dialog-list button > strong { font-size: 18px; }
		.app-shell.dev-ui-v22 .mode-card-meta > em { min-height: 24px; padding: 4px 8px; font-size: 8px; }

		.app-shell.dev-ui-v22 .rules-dialog {
			width: calc(100vw - 16px);
			max-height: calc(100dvh - 16px);
		}

		.app-shell.dev-ui-v22 .game-guide-scroll { max-height: calc(100dvh - 190px); }
		.app-shell.dev-ui-v22 .guide-four-steps { grid-template-columns: minmax(0, 1fr); }
		.app-shell.dev-ui-v22 .symbol-card-grid.compact { grid-template-columns: repeat(2, minmax(0, 1fr)); }
		.app-shell.dev-ui-v22 .confirmation-ledger { grid-template-columns: repeat(2, minmax(0, 1fr)); }
		.app-shell.dev-ui-v22 .confirmation-ledger > p:last-child { grid-column: 1 / -1; }
	}

	@media (max-width: 480px) and (orientation: portrait) {
		.app-shell.dev-ui-v22 .selected-mode-carrier {
			height: 100%;
			min-height: 0;
			grid-template-columns: minmax(0, 1fr);
			gap: 0;
			padding: 0 4px;
			text-align: center;
		}
		.app-shell.dev-ui-v22 .selected-mode-carrier > small { display: none; }
		.app-shell.dev-ui-v22 .selected-mode-carrier > strong { grid-column: 1; justify-content: center; }
		.app-shell.dev-ui-v22 .reel-mechanic-strip:not(.feature-strip) { grid-template-columns: 1.1fr .9fr; }
		.app-shell.dev-ui-v22 .guide-boot-actions { grid-template-columns: repeat(2, minmax(0, 1fr)); }
		.app-shell.dev-ui-v22 .guide-boot-actions button { min-height: 48px; padding: 8px; }
	}

	@media (max-height: 560px) and (min-aspect-ratio: 2/1) {
		.app-shell.dev-ui-v22 .monitor-header {
			top: 0 !important;
			height: 24px !important;
			min-height: 24px !important;
		}

		.app-shell.dev-ui-v22 .selected-mode-carrier {
			height: 20px;
			min-height: 20px;
			grid-template-columns: minmax(0, 1fr);
			gap: 0;
			padding: 0 4px;
		}
		.app-shell.dev-ui-v22 .selected-mode-carrier > small { display: none; }
		.app-shell.dev-ui-v22 .selected-mode-carrier > strong { grid-column: 1; justify-content: center; }

		.app-shell.dev-ui-v22 .control-meter span,
		.app-shell.dev-ui-v22 .control-deck .balance-meter span {
			display: block;
			font-size: clamp(4px, .62cqw, 6px);
			letter-spacing: .045em;
		}

		.app-shell.dev-ui-v22 .hud-tools .round-tool > :global(.hud-icon),
		.app-shell.dev-ui-v22 .control-deck .bet-step > :global(.hud-icon) {
			inset: 4px !important;
			width: calc(100% - 8px) !important;
			height: calc(100% - 8px) !important;
		}

		.app-shell.dev-ui-v22 .mode-dialog-list {
			grid-auto-rows: minmax(92px, auto);
			gap: 5px;
			padding: 6px 8px;
		}
		.app-shell.dev-ui-v22 .mode-dialog-list button {
			min-height: 92px !important;
			grid-template-columns: minmax(48px, 17%) minmax(0, 1fr) auto !important;
			grid-template-rows: auto minmax(24px, 1fr) auto !important;
			gap: 2px 7px;
			padding: 8px 10px !important;
		}
		.app-shell.dev-ui-v22 .mode-dialog-list button > span { font-size: 10px; }
		.app-shell.dev-ui-v22 .mode-dialog-list button > small { max-height: 2.5em; font-size: 7px; line-height: 1.25; }
		.app-shell.dev-ui-v22 .mode-dialog-list button > strong { font-size: 15px; }
		.app-shell.dev-ui-v22 .mode-card-meta > em { min-height: 20px; padding: 2px 6px; font-size: 6px; }

		.app-shell.dev-ui-v22 .rules-dialog {
			height: calc(100dvh - 16px) !important;
			max-height: calc(100dvh - 16px);
		}
		.app-shell.dev-ui-v22 .game-guide-scroll { max-height: none; }
	}

	@media (prefers-reduced-motion: reduce) {
		.cell {
			transition: none;
		}
	}

	/* M3 bunker composition: operative left, authoritative slot monitor right-middle. */
	.app-shell {
		position: fixed;
		isolation: isolate;
		inset: 0;
		display: block;
		padding: 0;
		overflow: clip;
		background: #030708;
	}

	.bunker-backdrop,
	.scene-grade {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.bunker-backdrop {
		z-index: -4;
		filter: saturate(0.92) contrast(1.05) brightness(0.82);
		transform: scale(1.004);
	}

	.scene-grade {
		z-index: -3;
		background:
			radial-gradient(circle at 66% 49%, rgba(56, 212, 228, 0.09), transparent 37%),
			radial-gradient(circle at 17% 68%, rgba(236, 57, 43, 0.16), transparent 25%),
			linear-gradient(90deg, rgba(0, 0, 0, 0.18), transparent 34%, transparent 82%, rgba(0, 0, 0, 0.34)),
			linear-gradient(180deg, rgba(0, 0, 0, 0.2), transparent 23%, transparent 78%, rgba(0, 0, 0, 0.32));
		box-shadow: inset 0 0 11vw rgba(0, 0, 0, 0.6);
	}

	.app-shell[data-phase='feature'] .scene-grade {
		background:
			radial-gradient(circle at 66% 49%, rgba(245, 73, 58, 0.16), transparent 41%),
			radial-gradient(circle at 17% 68%, rgba(245, 73, 58, 0.28), transparent 28%),
			linear-gradient(90deg, rgba(0, 0, 0, 0.22), transparent 38%, transparent 82%, rgba(0, 0, 0, 0.38));
		animation: bunker-alarm 1.7s ease-in-out infinite;
	}

	.operative-stage {
		position: absolute;
		z-index: 1;
		left: 1.6vw;
		bottom: 1.2vh;
		width: 29vw;
		height: 81vh;
		min-width: 290px;
		pointer-events: none;
		transform-origin: 58% 92%;
	}

	.operative-halo {
		position: absolute;
		z-index: 1;
		inset: 10% 0 3%;
		border-radius: 46%;
		background: radial-gradient(ellipse at 62% 54%, rgba(47, 206, 226, 0.18), transparent 55%);
		filter: blur(18px);
		opacity: 0.55;
	}

	.operative-floor-light {
		position: absolute;
		z-index: 1;
		left: 17%;
		right: 2%;
		bottom: 0;
		height: 9%;
		border-radius: 50%;
		background: radial-gradient(ellipse, rgba(43, 205, 222, 0.32), rgba(0, 0, 0, 0) 68%);
		filter: blur(7px);
		transform: scaleX(0.78);
	}

	.operative-readout {
		position: absolute;
		z-index: 3;
		left: 5%;
		bottom: 5%;
		display: grid;
		width: min(220px, 66%);
		gap: 3px;
		padding: 8px 10px;
		border-left: 2px solid #55d8e8;
		background: linear-gradient(90deg, rgba(4, 14, 17, 0.92), rgba(4, 14, 17, 0.2));
		text-shadow: 0 1px 3px #000;
	}

	.operative-readout span {
		color: #69a8b1;
		font-size: 8px;
		letter-spacing: 0.14em;
	}

	.operative-readout strong {
		color: #d8f3f5;
		font-size: clamp(8px, 0.62vw, 11px);
		letter-spacing: 0.02em;
	}

	.operative-stage[data-reaction='feature-tease'] .operative-halo,
	.operative-stage[data-reaction='vault-anticipation'] .operative-halo,
	.operative-stage[data-reaction='feature-trigger'] .operative-halo,
	.operative-stage[data-reaction='bonus-idle'] .operative-halo,
	.operative-stage[data-reaction='alert'] .operative-halo {
		background: radial-gradient(ellipse at 62% 54%, rgba(250, 64, 49, 0.32), transparent 58%);
		opacity: 0.9;
	}

	.breach-monitor {
		position: absolute;
		z-index: 4;
		top: 12.2vh;
		left: 39.7vw;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr) auto;
		width: 43.5vw;
		height: 71.5vh;
		min-width: 620px;
		min-height: 520px;
		overflow: hidden;
		border: 1px solid rgba(106, 198, 210, 0.6);
		background:
			linear-gradient(rgba(49, 115, 124, 0.04) 1px, transparent 1px),
			linear-gradient(90deg, rgba(49, 115, 124, 0.04) 1px, transparent 1px),
			rgba(3, 11, 14, 0.955);
		background-size: 18px 18px;
		box-shadow:
			inset 0 0 0 3px rgba(7, 27, 32, 0.9),
			inset 0 0 36px rgba(31, 146, 162, 0.08),
			0 0 24px rgba(0, 0, 0, 0.72),
			0 0 26px rgba(67, 199, 216, 0.08);
		clip-path: polygon(9px 0, calc(100% - 9px) 0, 100% 9px, 100% calc(100% - 9px), calc(100% - 9px) 100%, 9px 100%, 0 calc(100% - 9px), 0 9px);
	}

	.breach-monitor::before {
		position: absolute;
		z-index: 7;
		inset: 0;
		border: 1px solid rgba(103, 220, 234, 0.14);
		box-shadow: inset 0 0 28px rgba(51, 190, 207, 0.07);
		content: '';
		pointer-events: none;
	}

	.monitor-header {
		position: relative;
		z-index: 4;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		min-height: 52px;
		padding: 7px 12px 6px;
		border-bottom: 1px solid rgba(70, 125, 134, 0.52);
		background: linear-gradient(180deg, rgba(18, 39, 45, 0.96), rgba(5, 17, 21, 0.92));
	}

	.monitor-identity {
		min-width: 0;
	}

	.monitor-identity > span {
		color: #67a3ab;
		font-size: clamp(6px, 0.48vw, 9px);
		letter-spacing: 0.16em;
	}

	.monitor-identity h1 {
		margin: 2px 0 0;
		font-size: clamp(17px, 1.5vw, 27px);
		letter-spacing: -0.045em;
	}

	.monitor-identity h1 em {
		color: #f15c51;
		font-style: normal;
		font-weight: 300;
	}

	.breach-monitor .lifecycle {
		max-width: 43%;
		font-size: clamp(6px, 0.48vw, 9px);
	}

	.monitor-main {
		position: relative;
		z-index: 2;
		display: grid;
		grid-template-columns: minmax(105px, 0.34fr) minmax(360px, 1.75fr) minmax(120px, 0.47fr);
		min-height: 0;
		gap: clamp(5px, 0.48vw, 9px);
		padding: clamp(6px, 0.55vw, 10px);
	}

	.mode-console,
	.monitor-status {
		display: flex;
		min-width: 0;
		min-height: 0;
		flex-direction: column;
		gap: 7px;
	}

	.breach-monitor .mode-list {
		display: grid;
		grid-template-columns: 1fr;
		gap: 5px;
	}

	.breach-monitor .mode-list button {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		min-height: 44px;
		padding: 6px 7px;
		border-color: rgba(59, 99, 108, 0.78);
		background: linear-gradient(135deg, rgba(13, 32, 38, 0.96), rgba(5, 15, 18, 0.96));
		font-size: clamp(7px, 0.48vw, 9px);
	}

	.breach-monitor .mode-list button span {
		overflow: hidden;
		align-self: center;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.breach-monitor .mode-list button .mode-label-compact {
		display: none;
	}

	.breach-monitor .mode-list button strong {
		grid-row: auto;
		font-size: clamp(10px, 0.78vw, 14px);
	}

	.breach-monitor .mode-list button.selected {
		border-color: #e35c51;
		background: linear-gradient(135deg, rgba(64, 31, 29, 0.94), rgba(18, 25, 28, 0.97));
		box-shadow: inset 3px 0 #f16459, 0 0 12px rgba(234, 87, 76, 0.16);
	}

	.breach-monitor .amount-control {
		margin-top: auto;
	}

	.breach-monitor .amount-control > span:first-child {
		font-size: 7px;
	}

	.breach-monitor .compact-readout {
		margin-top: 0;
	}

	.breach-monitor .amount-control select,
	.breach-monitor .amount-range {
		min-height: 44px;
		background: rgba(7, 22, 27, 0.96);
		font-size: 9px;
	}

	.monitor-board-stage {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		min-width: 0;
		min-height: 0;
		gap: 5px;
	}

	.breach-monitor .stage-heading strong {
		font-size: clamp(7px, 0.5vw, 10px);
	}

	.breach-monitor .phase-chip {
		padding: 4px 6px;
		font-size: 7px;
	}

	.breach-monitor .board-frame {
		align-self: center;
		justify-self: center;
		width: min(100%, 56vh);
		max-width: 100%;
		max-height: 100%;
		padding: clamp(4px, 0.42vw, 7px);
		border: 1px solid rgba(85, 148, 157, 0.88);
		background: rgba(2, 10, 13, 0.98);
		box-shadow: inset 0 0 0 2px #0d252b, 0 0 22px rgba(40, 166, 184, 0.12);
	}

	.breach-monitor .board {
		gap: clamp(2px, 0.22vw, 4px);
	}

	.breach-monitor .cell {
		isolation: isolate;
		overflow: hidden;
		border-color: rgba(54, 91, 99, 0.78);
		background:
			radial-gradient(circle at 50% 46%, rgba(66, 122, 132, 0.12), transparent 62%),
			linear-gradient(145deg, #10252b, #08161a);
		box-shadow: inset 0 0 8px rgba(0, 0, 0, 0.52);
	}

	.breach-monitor .cell::after {
		z-index: 3;
		inset: 5%;
		border-color: rgba(124, 184, 193, 0.1);
	}

	.symbol-art {
		position: absolute;
		z-index: 1;
		inset: 6%;
		filter: saturate(0.78) brightness(1.08) contrast(1.08);
		opacity: 0.92;
		transform: scale(0.96);
		transition: filter 160ms ease, opacity 160ms ease, transform 160ms ease;
	}

	.symbol-empty {
		display: none;
	}

	.symbol-code {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.breach-monitor .cell.line-active .symbol-art {
		filter: sepia(0.62) saturate(2.2) brightness(1.48);
		transform: scale(1.08);
	}

	.breach-monitor .line-win-cue {
		top: 5px;
		right: 5px;
		max-width: calc(100% - 10px);
		font-size: clamp(6px, 0.44vw, 8px);
	}

	.monitor-status .launch-card {
		max-height: 52%;
		overflow: auto;
		padding: 7px;
		font-size: clamp(7px, 0.46vw, 9px);
	}

	.monitor-status .launch-card.error button {
		min-height: 44px;
		padding: 4px 7px;
		font-size: 8px;
	}

	.monitor-status .jurisdiction-readouts {
		display: grid;
		grid-template-columns: 1fr;
	}

	.monitor-status .action-stack {
		margin-top: auto;
	}

	.monitor-status .primary-action,
	.monitor-status .info-action {
		min-height: 44px;
		padding: 5px;
		font-size: clamp(7px, 0.48vw, 9px);
	}

	.monitor-status .primary-action:not(:disabled) {
		box-shadow: 0 0 16px rgba(231, 89, 77, 0.22);
	}

	.monitor-status .primary-action.feature-action:not(:disabled) {
		background: #efb64f;
		border-color: #efc66f;
	}

	.monitor-footer {
		position: relative;
		z-index: 4;
		display: grid;
		grid-template-columns: 1fr 1.2fr 1fr;
		gap: 5px;
		padding: 6px 8px 7px;
		border-top: 1px solid rgba(70, 125, 134, 0.52);
		background: linear-gradient(180deg, rgba(5, 16, 20, 0.96), rgba(16, 35, 40, 0.97));
	}

	.monitor-footer > div {
		display: grid;
		min-width: 0;
		gap: 1px;
		padding: 5px 7px;
		border: 1px solid rgba(56, 96, 104, 0.64);
		background: rgba(4, 14, 17, 0.86);
	}

	.monitor-footer span {
		color: #62919a;
		font-size: clamp(6px, 0.42vw, 8px);
		letter-spacing: 0.12em;
	}

	.monitor-footer strong {
		overflow: hidden;
		color: #dceff1;
		font-size: clamp(8px, 0.58vw, 11px);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.monitor-footer .primary-meter {
		border-color: rgba(185, 117, 81, 0.8);
		text-align: center;
	}

	.monitor-footer .primary-meter strong {
		color: #f0c06b;
	}

	.monitor-glass {
		position: absolute;
		z-index: 6;
		inset: 0;
		background:
			linear-gradient(112deg, transparent 20%, rgba(167, 236, 243, 0.03) 42%, transparent 60%),
			repeating-linear-gradient(180deg, rgba(120, 195, 204, 0.025) 0 1px, transparent 1px 4px);
		mix-blend-mode: screen;
		opacity: 0.75;
		pointer-events: none;
	}

	.app-shell[data-operator-reaction='spin-start'] .breach-monitor,
	.app-shell[data-operator-reaction='spin-loop'] .breach-monitor {
		box-shadow: inset 0 0 0 3px rgba(7, 27, 32, 0.9), inset 0 0 42px rgba(31, 187, 207, 0.14), 0 0 36px rgba(42, 204, 225, 0.13);
	}

	.app-shell[data-operator-reaction='feature-trigger'] .breach-monitor,
	.app-shell[data-operator-reaction='max-win'] .breach-monitor {
		animation: monitor-impact 760ms ease-out both;
	}

	@keyframes operative-idle {
		0%, 100% { transform: translate3d(0, 0, 0) rotate(0.01deg); }
		50% { transform: translate3d(0.3%, -0.7%, 0) rotate(-0.18deg); }
	}

	@keyframes operative-spin-start {
		0% { transform: translate3d(0, 0, 0) rotate(0); }
		30% { transform: translate3d(4.4%, -0.4%, 0) rotate(2.2deg); }
		70% { transform: translate3d(3%, 0, 0) rotate(1.2deg); }
		100% { transform: translate3d(1.1%, 0, 0) rotate(0.25deg); }
	}

	@keyframes operative-trace {
		0%, 100% { transform: translate3d(1%, 0, 0) rotate(0.2deg); }
		45% { transform: translate3d(2.7%, -0.7%, 0) rotate(1deg); }
	}

	@keyframes operative-win-small {
		0% { transform: translate3d(1%, 0, 0); }
		38% { transform: translate3d(-1.2%, -1%, 0) rotate(-1.1deg); }
		100% { transform: translate3d(0, 0, 0); }
	}

	@keyframes operative-win-medium {
		0% { transform: translate3d(1%, 0, 0); }
		32% { transform: translate3d(-2.2%, -2.3%, 0) rotate(-2.1deg) scale(1.015); }
		58% { transform: translate3d(-1%, -1.2%, 0) rotate(-0.8deg) scale(1.01); }
		100% { transform: translate3d(0, 0, 0) scale(1); }
	}

	@keyframes operative-win-big {
		0% { transform: translate3d(1%, 0, 0); }
		24% { transform: translate3d(-4%, -3.4%, 0) rotate(-3.1deg) scale(1.03); }
		48% { transform: translate3d(-2%, -4.4%, 0) rotate(-1.2deg) scale(1.045); }
		78% { transform: translate3d(-1%, -1.1%, 0) scale(1.012); }
		100% { transform: translate3d(0, 0, 0); }
	}

	@keyframes operative-tease {
		0%, 100% { transform: translate3d(0, 0, 0); }
		22%, 58% { transform: translate3d(1.8%, -0.4%, 0) rotate(0.8deg); }
		40%, 76% { transform: translate3d(0.4%, 0, 0) rotate(-0.4deg); }
	}

	@keyframes operative-feature-trigger {
		0% { transform: translate3d(0, 0, 0); }
		24% { transform: translate3d(5%, -2.2%, 0) rotate(2.8deg) scale(1.02); }
		48% { transform: translate3d(1%, -4.5%, 0) rotate(-2deg) scale(1.04); }
		74% { transform: translate3d(2.5%, -2%, 0) rotate(1deg) scale(1.025); }
		100% { transform: translate3d(1%, 0, 0) scale(1); }
	}

	@keyframes operative-bonus-idle {
		0%, 100% { transform: translate3d(1%, 0, 0); }
		50% { transform: translate3d(2.3%, -1%, 0) rotate(0.6deg); }
	}

	@keyframes operative-recover {
		0% { transform: translate3d(2.5%, -0.8%, 0) rotate(0.7deg); }
		100% { transform: translate3d(0, 0, 0) rotate(0); }
	}

	@keyframes operative-alert {
		0%, 100% { transform: translate3d(0, 0, 0); }
		25% { transform: translate3d(-0.8%, 0, 0) rotate(-0.35deg); }
		75% { transform: translate3d(0.8%, 0, 0) rotate(0.35deg); }
	}

	@keyframes operative-halo-pulse {
		0%, 100% { opacity: 0.46; transform: scale(0.96); }
		50% { opacity: 0.94; transform: scale(1.04); }
	}

	@keyframes bunker-alarm {
		0%, 100% { opacity: 0.72; }
		50% { opacity: 1; }
	}

	@keyframes monitor-impact {
		0% { filter: brightness(1); }
		28% { filter: brightness(1.42) saturate(1.3); }
		100% { filter: brightness(1); }
	}

	@media (max-width: 1320px) and (min-width: 821px) {
		.operative-stage {
			left: -1.5vw;
			width: 31vw;
		}

		.breach-monitor {
			left: 38.5vw;
			width: 47.5vw;
			min-width: 570px;
		}

		.monitor-main {
			grid-template-columns: minmax(95px, 0.3fr) minmax(330px, 1.65fr) minmax(110px, 0.42fr);
		}
	}

	@media (max-width: 820px) {
		.bunker-backdrop {
			background-position: 56% center;
			filter: saturate(0.75) brightness(0.48);
		}

		.scene-grade {
			background: linear-gradient(180deg, rgba(2, 7, 9, 0.26), rgba(2, 7, 9, 0.78));
		}

		.operative-stage {
			z-index: 2;
			top: -14px;
			left: -24px;
			bottom: auto;
			width: 158px;
			height: 225px;
			min-width: 0;
			opacity: 0.48;
		}

		.operative-readout,
		.operative-floor-light {
			display: none;
		}

		.breach-monitor {
			z-index: 4;
			inset: max(4px, env(safe-area-inset-top)) max(4px, env(safe-area-inset-right)) max(4px, env(safe-area-inset-bottom)) max(4px, env(safe-area-inset-left));
			width: auto;
			height: auto;
			min-width: 0;
			min-height: 0;
			background-color: rgba(3, 11, 14, 0.97);
			clip-path: polygon(7px 0, calc(100% - 7px) 0, 100% 7px, 100% calc(100% - 7px), calc(100% - 7px) 100%, 7px 100%, 0 calc(100% - 7px), 0 7px);
		}

		.monitor-header {
			min-height: 44px;
			padding: 5px 8px;
		}

		.monitor-identity > span {
			display: none;
		}

		.monitor-identity h1 {
			font-size: 18px;
		}

		.breach-monitor .lifecycle {
			max-width: 54%;
			font-size: 7px;
		}

		.monitor-main {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: auto minmax(0, 1fr) auto;
			gap: 5px;
			padding: 5px;
		}

		.mode-console {
			display: grid;
			grid-template-columns: minmax(0, 1fr) minmax(112px, 0.45fr);
			gap: 5px;
		}

		.breach-monitor .mode-list {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}

		.breach-monitor .mode-list button {
			min-height: 44px;
			padding: 4px 5px;
			font-size: 7px;
		}

		.breach-monitor .mode-list button strong {
			font-size: 10px;
		}

		.breach-monitor .amount-control {
			align-content: end;
			grid-template-columns: minmax(44px, 1fr);
			margin: 0;
		}

		.breach-monitor .amount-control > span:first-child {
			display: none;
		}

		.breach-monitor .board-frame {
			width: min(92vw, 45vh);
		}

		.monitor-status {
			display: grid;
			grid-template-columns: minmax(0, 1fr) minmax(76px, 0.28fr) minmax(132px, 0.42fr);
			gap: 5px;
		}

		.monitor-status .launch-card {
			align-content: center;
			max-height: 92px;
			padding: 5px 7px;
			font-size: 7px;
		}

		.monitor-status .launch-card small {
			display: none;
		}

		.monitor-status .jurisdiction-readouts {
			display: grid;
			grid-column: 2;
			grid-template-columns: 1fr;
			gap: 4px;
		}

		.monitor-status .jurisdiction-readouts > span {
			min-height: 44px;
			padding: 4px;
		}

		.monitor-status .action-stack {
			grid-column: 3;
			grid-template-columns: 1fr;
			gap: 4px;
			margin: 0;
		}

		.monitor-status .primary-action,
		.monitor-status .info-action {
			min-height: 44px;
		}

		.monitor-footer {
			padding: 4px 5px 5px;
		}

		.monitor-footer > div {
			padding: 3px 5px;
		}

		.monitor-footer strong {
			font-size: 8px;
		}
	}

	@media (max-width: 480px) {
		.monitor-status {
			grid-template-columns: minmax(0, 1fr) minmax(72px, 0.27fr) minmax(132px, 0.46fr);
		}

		.breach-monitor .board-frame {
			width: min(92vw, 47vh);
		}
	}

	@media (max-height: 560px) and (min-width: 481px) {
		.operative-stage {
			display: none;
		}

		.breach-monitor {
			inset: 2px;
			width: auto;
			height: auto;
			min-width: 0;
			min-height: 0;
		}

		.monitor-header {
			min-height: 36px;
			padding: 3px 7px;
		}

		.monitor-identity > span {
			display: none;
		}

		.monitor-identity h1 {
			font-size: 15px;
		}

		.monitor-main {
			grid-template: minmax(0, 1fr) / minmax(125px, 0.42fr) minmax(180px, 1.1fr) minmax(145px, 0.48fr);
			gap: 4px;
			padding: 4px;
		}

		.breach-monitor .mode-list {
			grid-template-columns: 1fr;
			gap: 3px;
		}

		.breach-monitor .mode-list button,
		.breach-monitor .amount-control select,
		.breach-monitor .amount-range,
		.monitor-status .primary-action,
		.monitor-status .info-action {
			min-height: 44px;
		}

		.breach-monitor .amount-control {
			margin-top: auto;
		}

		.breach-monitor .board-frame {
			width: min(42vw, calc(100vh - 101px));
		}

		.monitor-status {
			display: flex;
		}

		.monitor-status .launch-card {
			max-height: 86px;
		}

		.monitor-status .launch-card small,
		.monitor-status .jurisdiction-readouts {
			display: none;
		}

		.monitor-footer {
			padding: 3px 5px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.operative-halo,
		.scene-grade,
		.breach-monitor {
			animation: none !important;
		}
	}

	/* M4 production composition. Every desktop layer shares the 1672 x 941
	   bunker coordinate system; controls recompose at native CSS-pixel size. */
	.app-shell {
		position: fixed;
		isolation: isolate;
		inset: 0;
		display: block;
		padding: 0;
		overflow: hidden;
		background: #020506;
	}

	.app-shell::before {
		position: absolute;
		z-index: -2;
		inset: -28px;
		background:
			radial-gradient(circle at 62% 44%, rgba(25, 78, 84, 0.18), transparent 48%),
			#020506;
		content: '';
		filter: blur(18px);
		transform: scale(1.06);
	}

	.scene-world {
		position: absolute;
		isolation: isolate;
		top: 50%;
		left: 50%;
		width: min(100vw, calc(100vh * 1.776833));
		height: min(100vh, calc(100vw / 1.776833));
		overflow: clip;
		background: #020607;
		box-shadow: 0 0 70px rgba(0, 0, 0, 0.92);
		container-type: size;
		transform: translate(-50%, -50%);
	}

	.bunker-backdrop,
	.scene-grade {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.bunker-backdrop {
		z-index: 0;
		display: block;
		width: 100%;
		height: 100%;
		max-width: none;
		background: none;
		filter: saturate(0.88) contrast(1.06) brightness(0.78);
		object-fit: fill;
		object-position: center;
		transform: none;
	}

	.scene-grade {
		z-index: 1;
		background:
			radial-gradient(circle at 58% 45%, rgba(74, 214, 229, 0.08), transparent 35%),
			radial-gradient(circle at 13% 70%, rgba(230, 55, 42, 0.19), transparent 24%),
			linear-gradient(90deg, rgba(0, 0, 0, 0.08), transparent 31%, transparent 84%, rgba(0, 0, 0, 0.32)),
			linear-gradient(180deg, rgba(0, 0, 0, 0.2), transparent 24%, transparent 72%, rgba(0, 0, 0, 0.24));
		box-shadow: inset 0 0 7cqw rgba(0, 0, 0, 0.36);
	}

	.app-shell[data-phase='feature'] .scene-grade {
		background:
			radial-gradient(circle at 59% 45%, rgba(242, 66, 51, 0.18), transparent 38%),
			radial-gradient(circle at 13% 69%, rgba(245, 61, 45, 0.33), transparent 28%),
			linear-gradient(90deg, rgba(0, 0, 0, 0.12), transparent 36%, transparent 83%, rgba(0, 0, 0, 0.36));
		animation: bunker-alarm 1.8s ease-in-out infinite;
	}

	.operative-stage {
		position: absolute;
		z-index: 2;
		inset: 30% auto 2% 3%;
		width: 27%;
		height: auto;
		min-width: 0;
		pointer-events: none;
		transform-origin: 48% 92%;
	}

	.operative-halo {
		position: absolute;
		z-index: 1;
		inset: 17% 5% 7% 11%;
		border-radius: 48%;
		background: radial-gradient(ellipse at 54% 55%, rgba(54, 210, 229, 0.16), transparent 58%);
		filter: blur(1.2cqh);
		opacity: 0.58;
	}

	.operative-floor-light {
		position: absolute;
		z-index: 1;
		right: 4%;
		bottom: 0.5%;
		left: 17%;
		height: 8%;
		border-radius: 50%;
		background: radial-gradient(ellipse, rgba(52, 201, 219, 0.27), transparent 68%);
		filter: blur(0.6cqh);
	}

	.operative-readout {
		position: absolute;
		z-index: 4;
		bottom: 4%;
		left: 8%;
		display: grid;
		width: min(15cqw, 230px);
		gap: 3px;
		padding: 7px 10px;
		border: 0;
		border-left: 2px solid rgba(83, 215, 232, 0.82);
		background: linear-gradient(90deg, rgba(3, 13, 16, 0.88), transparent);
		text-shadow: 0 1px 4px #000;
	}

	.operative-readout span {
		color: #65a3ab;
		font-size: clamp(6px, 0.48cqw, 9px);
		letter-spacing: 0.15em;
	}

	.operative-readout strong {
		color: #d7f0f2;
		font-size: clamp(7px, 0.62cqw, 11px);
		letter-spacing: 0.015em;
	}

	.breach-monitor {
		position: absolute;
		z-index: 4;
		top: 9.9%;
		left: 41.3%;
		display: grid;
		grid-template-rows: clamp(48px, 5.3cqh, 60px) minmax(0, 1fr) clamp(50px, 5.5cqh, 62px);
		width: 47%;
		height: 79.3%;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
		border: 1px solid rgba(113, 207, 219, 0.46);
		background:
			linear-gradient(rgba(58, 131, 141, 0.035) 1px, transparent 1px),
			linear-gradient(90deg, rgba(58, 131, 141, 0.035) 1px, transparent 1px),
			rgba(2, 9, 12, 0.975);
		background-size: 16px 16px;
		box-shadow:
			inset 0 0 0 3px rgba(6, 24, 29, 0.9),
			inset 0 0 3cqw rgba(31, 151, 169, 0.08),
			0 0 1.6cqw rgba(0, 0, 0, 0.78),
			0 0 1cqw rgba(71, 203, 219, 0.08);
		clip-path: polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px);
	}

	.breach-monitor::before {
		position: absolute;
		z-index: 8;
		inset: 0;
		border: 1px solid rgba(111, 221, 234, 0.11);
		box-shadow: inset 0 0 22px rgba(46, 189, 207, 0.06);
		content: '';
		pointer-events: none;
	}

	.monitor-header {
		position: relative;
		z-index: 4;
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: 0;
		gap: 8px;
		padding: 5px clamp(8px, 0.8cqw, 13px);
		border-bottom: 1px solid rgba(67, 122, 131, 0.54);
		background: linear-gradient(180deg, rgba(15, 36, 42, 0.96), rgba(4, 15, 19, 0.94));
	}

	.monitor-identity > span {
		color: #5f9da6;
		font-size: clamp(7px, 0.46cqw, 10px);
		letter-spacing: 0.16em;
	}

	.monitor-identity h1 {
		margin: 1px 0 0;
		font-size: clamp(20px, 1.36cqw, 28px);
		letter-spacing: -0.045em;
	}

	.monitor-identity h1 em {
		color: #f26358;
		font-style: normal;
		font-weight: 300;
	}

	.breach-monitor .lifecycle {
		max-width: 42%;
		font-size: clamp(7px, 0.44cqw, 10px);
	}

	.breach-monitor .pulse {
		width: 6px;
		height: 6px;
	}

	.monitor-main {
		position: relative;
		z-index: 2;
		display: grid;
		grid-template-columns: minmax(0, 1fr) clamp(196px, 23.5%, 236px);
		grid-template-rows: minmax(0, 1fr);
		grid-template-areas: 'board rail';
		min-height: 0;
		gap: 10px;
		padding: 10px 12px;
	}

	.monitor-board-stage {
		grid-area: board;
		display: grid;
		grid-template-rows: 34px 28px minmax(0, 1fr);
		min-width: 0;
		min-height: 0;
		gap: 6px;
	}

	.stage-heading {
		min-width: 0;
		gap: 6px;
	}

	.breach-monitor .stage-heading span {
		font-size: clamp(7px, 0.46cqw, 10px);
	}

	.breach-monitor .stage-heading strong {
		font-size: clamp(8px, 0.54cqw, 11px);
	}

	.breach-monitor .phase-chip {
		padding: 4px 7px;
		font-size: clamp(7px, 0.42cqw, 9px);
	}

	.breach-monitor .board-frame {
		isolation: isolate;
		align-self: center;
		justify-self: center;
		width: min(100%, 57cqh);
		max-width: 100%;
		max-height: none;
		padding: 9px;
		border: 0;
		border-radius: 4px;
		background:
			linear-gradient(145deg, rgba(34, 70, 77, 0.92), rgba(4, 15, 18, 0.98) 18% 82%, rgba(36, 78, 85, 0.86)),
			rgba(1, 7, 9, 0.99);
		box-shadow:
			inset 0 0 0 2px rgba(70, 129, 138, 0.9),
			inset 0 16px 34px rgba(0, 0, 0, 0.78),
			inset 0 -5px 16px rgba(55, 155, 170, 0.08),
			0 10px 30px rgba(0, 0, 0, 0.58),
			0 0 22px rgba(39, 166, 184, 0.11);
	}

	.breach-monitor .board {
		position: relative;
		z-index: 1;
		gap: 5px;
		padding: 5px;
		border: 1px solid rgba(55, 105, 114, 0.56);
		background:
			repeating-linear-gradient(90deg, rgba(40, 93, 102, 0.045) 0 1px, transparent 1px 14.285714%),
			linear-gradient(180deg, rgba(2, 8, 11, 0.98), rgba(5, 17, 21, 0.99));
		box-shadow: inset 0 12px 24px rgba(0, 0, 0, 0.72), inset 0 0 18px rgba(40, 147, 162, 0.06);
	}

	.board-frame[data-guide-visible='true'] .board {
		filter: brightness(0.42) saturate(0.5);
		opacity: 0.34;
	}

	.field-brief {
		position: absolute;
		z-index: 6;
		top: 50%;
		left: 50%;
		display: grid;
		width: min(88%, 410px);
		gap: 8px;
		padding: clamp(11px, 1.05cqw, 18px);
		border: 1px solid rgba(99, 191, 202, 0.72);
		background:
			radial-gradient(circle at 10% 0, rgba(60, 192, 210, 0.14), transparent 46%),
			linear-gradient(145deg, rgba(8, 25, 30, 0.975), rgba(2, 10, 13, 0.985));
		box-shadow: inset 0 0 0 2px rgba(28, 72, 80, 0.64), 0 15px 40px rgba(0, 0, 0, 0.78), 0 0 22px rgba(44, 174, 191, 0.15);
		clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
		pointer-events: none;
		transform: translate(-50%, -50%);
	}

	.field-brief header {
		display: grid;
		gap: 2px;
		padding-bottom: 7px;
		border-bottom: 1px solid rgba(70, 123, 131, 0.54);
	}

	.field-brief header span {
		color: #62a9b2;
		font-size: clamp(6px, 0.44cqw, 9px);
		font-weight: 800;
		letter-spacing: 0.14em;
	}

	.field-brief h2 {
		margin: 0;
		color: #eff9fa;
		font-family: Arial, Helvetica, sans-serif;
		font-size: clamp(13px, 1.02cqw, 20px);
		letter-spacing: -0.02em;
	}

	.field-brief-flow {
		display: grid;
		gap: 5px;
	}

	.field-brief-flow > div {
		display: grid;
		grid-template-columns: 27px minmax(72px, 0.46fr) minmax(0, 1fr);
		align-items: center;
		gap: 7px;
		min-height: 43px;
		padding: 6px 8px;
		border: 1px solid rgba(49, 91, 99, 0.66);
		background: rgba(3, 13, 16, 0.7);
	}

	.field-brief-flow em {
		display: grid;
		width: 24px;
		height: 24px;
		place-items: center;
		border: 1px solid #df5a51;
		color: #ff958b;
		font-size: 8px;
		font-style: normal;
		font-weight: 800;
	}

	.field-brief-flow strong {
		color: #e5f1f2;
		font-size: clamp(8px, 0.54cqw, 11px);
	}

	.field-brief-flow span {
		color: #8eaaaf;
		font-size: clamp(8px, 0.47cqw, 10px);
		line-height: 1.42;
	}

	.field-brief > p {
		margin: 0;
		padding: 7px 8px;
		border-left: 3px solid #e2aa4d;
		background: rgba(57, 40, 11, 0.36);
		color: #efc97d;
		font-size: clamp(8px, 0.5cqw, 10px);
		font-weight: 700;
		line-height: 1.45;
	}

	.breach-monitor .cell {
		--symbol-glow: rgba(83, 175, 188, 0.11);
		isolation: isolate;
		overflow: hidden;
		border: 0;
		border-radius: 3px;
		background:
			radial-gradient(circle at 48% 39%, var(--symbol-glow), transparent 58%),
			linear-gradient(150deg, rgba(18, 39, 44, 0.98), rgba(4, 13, 16, 0.99));
		box-shadow:
			inset 0 1px 0 rgba(151, 207, 215, 0.12),
			inset 0 -7px 12px rgba(0, 0, 0, 0.48),
			0 2px 5px rgba(0, 0, 0, 0.58);
		transition: opacity 180ms ease, filter 180ms ease, transform 180ms ease, box-shadow 180ms ease;
	}

	.breach-monitor .cell::after {
		z-index: 3;
		inset: 0;
		border: 0;
		border-radius: inherit;
		background: linear-gradient(128deg, rgba(185, 232, 238, 0.045), transparent 28% 72%, rgba(0, 0, 0, 0.18));
		box-shadow: inset 0 0 0 1px rgba(118, 179, 188, 0.065);
		pointer-events: none;
	}

	.symbol-art {
		position: absolute;
		z-index: 1;
		inset: 4%;
		overflow: hidden;
		background: none;
		filter: saturate(0.9) brightness(1.08) contrast(1.06);
		opacity: 0.94;
		transform: scale(1.01);
		transition: filter 160ms ease, opacity 160ms ease, transform 160ms ease;
	}

	.symbol-art img {
		position: absolute;
		width: 200%;
		height: 300%;
		max-width: none;
		object-fit: fill;
		pointer-events: none;
		user-select: none;
	}

	.symbol-empty { display: none; }
	.breach-monitor .cell:nth-child(3n + 1) .symbol-art { filter: saturate(0.86) brightness(1.03) contrast(1.07); }
	.breach-monitor .cell:nth-child(4n + 2) .symbol-art { opacity: 0.9; transform: translateY(1px) scale(1); }

	.symbol-code {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		clip-path: inset(50%);
		white-space: nowrap;
	}

	.breach-monitor .cell.line-active .symbol-art {
		filter: sepia(0.42) saturate(2.15) brightness(1.46);
		transform: scale(1.08);
	}

	.breach-monitor .board[data-has-win='true'] .cell:not(.line-active) {
		filter: saturate(0.32) brightness(0.58);
		opacity: 0.26;
		transform: scale(0.965);
	}

	.breach-monitor .cell.line-active {
		z-index: 4;
		border: 0;
		background:
			radial-gradient(circle at 50% 44%, rgba(255, 223, 129, 0.28), transparent 62%),
			linear-gradient(145deg, rgba(84, 58, 19, 0.98), rgba(17, 18, 16, 0.99));
		box-shadow:
			inset 0 0 0 2px rgba(255, 222, 128, 0.96),
			inset 0 0 18px rgba(255, 197, 75, 0.42),
			0 0 14px rgba(255, 205, 84, 0.48),
			0 6px 12px rgba(0, 0, 0, 0.58);
		transform: translateY(-2px) scale(1.025);
		animation: line-cell-hit 720ms cubic-bezier(0.18, 0.74, 0.22, 1) both;
	}

	.breach-monitor .line-win-cue {
		top: auto;
		right: 50%;
		bottom: 9px;
		max-width: 76%;
		padding: 5px 8px;
		font-size: clamp(7px, 0.45cqw, 10px);
		opacity: 0.92;
		transform: translateX(50%);
	}

	.board-result-plaque {
		position: absolute;
		z-index: 6;
		top: 50%;
		left: 50%;
		display: grid;
		min-width: 46%;
		gap: 3px;
		padding: 10px 16px;
		border: 1px solid rgba(111, 208, 219, 0.74);
		background: linear-gradient(145deg, rgba(3, 17, 21, 0.96), rgba(1, 7, 9, 0.94));
		box-shadow: inset 0 0 0 2px rgba(17, 55, 62, 0.9), 0 12px 30px rgba(0, 0, 0, 0.72);
		color: #d9f1f3;
		text-align: center;
		transform: translate(-50%, -50%);
		pointer-events: none;
	}

	.board-result-plaque span {
		color: #79b7bf;
		font-size: clamp(7px, 0.48cqw, 10px);
		font-weight: 800;
		letter-spacing: 0.17em;
	}

	.board-result-plaque strong {
		font-size: clamp(16px, 1.35cqw, 27px);
		letter-spacing: 0.035em;
		line-height: 1;
	}

	.board-result-plaque.win {
		border-color: rgba(255, 217, 113, 0.92);
		background:
			radial-gradient(circle at 50% 0, rgba(255, 210, 93, 0.24), transparent 58%),
			linear-gradient(145deg, rgba(48, 34, 11, 0.97), rgba(8, 11, 11, 0.95));
		box-shadow: inset 0 0 0 2px rgba(116, 81, 24, 0.8), 0 0 26px rgba(255, 205, 76, 0.28), 0 12px 30px rgba(0, 0, 0, 0.7);
		animation: win-plaque-enter 680ms cubic-bezier(0.16, 0.82, 0.22, 1) both;
	}

	.board-result-plaque.win span,
	.board-result-plaque.win strong {
		color: #ffe5a0;
	}

	.board-result-plaque.loss {
		opacity: 0.9;
		animation: loss-plaque-enter 420ms ease-out both;
	}

	.mode-console,
	.monitor-status {
		min-width: 0;
		min-height: 0;
	}

	.mode-console {
		grid-area: rail;
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding-bottom: 156px;
	}

	.breach-monitor .mode-list {
		display: grid;
		grid-template-columns: 1fr;
		gap: 7px;
	}

	.breach-monitor .mode-list button {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		min-height: 48px;
		padding: 7px 9px;
		border-color: rgba(61, 105, 113, 0.78);
		background: linear-gradient(135deg, rgba(12, 31, 37, 0.97), rgba(4, 13, 16, 0.98));
		font-size: clamp(8px, 0.5cqw, 11px);
	}

	.breach-monitor .mode-list button span {
		overflow: hidden;
		align-self: center;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.breach-monitor .mode-list button strong {
		grid-row: auto;
		display: inline-flex;
		align-items: baseline;
		gap: 3px;
		font-size: clamp(11px, 0.72cqw, 15px);
	}

	.breach-monitor .mode-list button strong small {
		color: #75969c;
		font-size: clamp(5px, 0.32cqw, 7px);
		letter-spacing: 0.08em;
	}

	.breach-monitor .mode-list button.selected {
		border-color: #eb655a;
		background: linear-gradient(135deg, rgba(66, 28, 27, 0.95), rgba(16, 24, 27, 0.98));
		box-shadow: inset 3px 0 #f4685d, 0 0 11px rgba(238, 91, 79, 0.16);
	}

	.mode-player-guide {
		display: grid;
		gap: 4px;
		padding: 9px;
		border: 1px solid rgba(58, 107, 116, 0.7);
		border-left: 3px solid #d25349;
		background: linear-gradient(135deg, rgba(11, 29, 34, 0.94), rgba(4, 14, 17, 0.95));
	}

	.mode-player-guide > strong {
		color: #e7bd70;
		font-size: clamp(6px, 0.38cqw, 8px);
		letter-spacing: 0.11em;
	}

	.mode-player-guide > span {
		color: #b9cccf;
		font-size: clamp(7px, 0.45cqw, 9px);
		line-height: 1.4;
	}

	.mode-player-guide > small {
		color: #6f9298;
		font-size: clamp(5px, 0.34cqw, 7px);
		line-height: 1.3;
	}

	.breach-monitor .amount-control {
		margin-top: auto;
		gap: 3px;
	}

	.breach-monitor .amount-control > span:first-child {
		font-size: 8px;
	}

	.breach-monitor .amount-control select,
	.breach-monitor .amount-range {
		min-height: 48px;
		background: rgba(6, 20, 24, 0.98);
		font-size: 10px;
	}

	.breach-monitor .compact-readout {
		display: none;
	}

	.monitor-status {
		position: absolute;
		z-index: 5;
		right: 12px;
		bottom: 12px;
		display: grid;
		width: clamp(196px, 23.5%, 236px);
		gap: 7px;
	}

	.monitor-status .launch-card {
		max-height: 154px;
		overflow: auto;
		padding: 6px;
		font-size: clamp(6px, 0.4cqw, 8px);
	}

	.monitor-status .live-card,
	.monitor-status .fixture,
	.monitor-status .pending {
		display: none;
	}

	.monitor-status .launch-card.error {
		position: fixed;
		z-index: 12;
		top: 50%;
		left: 50%;
		width: min(330px, 84%);
		max-height: 70%;
		padding: 14px;
		border: 1px solid rgba(238, 91, 79, 0.92);
		background: rgba(37, 11, 13, 0.975);
		box-shadow: 0 18px 60px rgba(0, 0, 0, 0.72), 0 0 32px rgba(232, 74, 62, 0.16);
		font-size: 9px;
		transform: translate(-50%, -50%);
	}

	.monitor-status .launch-card.error::before {
		color: #ff766c;
		font-size: 8px;
		font-weight: 800;
		letter-spacing: 0.16em;
		content: 'LINK LOST';
	}

	.monitor-status .launch-card.error button {
		min-height: 44px;
	}

	.monitor-status .replay-card {
		display: grid;
		max-height: 76px;
		gap: 3px;
		overflow: hidden;
	}

	.monitor-status .replay-card span {
		display: block;
		color: #7fa5aa;
		font-size: clamp(5px, 0.37cqw, 7px);
		line-height: 1.35;
	}

	.monitor-status .replay-card small {
		display: none;
	}

	.monitor-status .jurisdiction-readouts {
		display: grid;
		grid-template-columns: 1fr;
		gap: 3px;
	}

	.monitor-status .jurisdiction-readouts > span {
		min-height: 30px;
		padding: 3px 5px;
	}

	.monitor-status .action-stack {
		display: grid;
		grid-template-columns: 1fr;
		gap: 5px;
		margin: 0;
	}

	.monitor-status .primary-action {
		min-height: 88px;
		padding: 6px;
		border: 1px solid #f3685c;
		background:
			radial-gradient(circle at 50% 35%, rgba(255, 190, 132, 0.22), transparent 48%),
			linear-gradient(145deg, #f06c60, #a92e2b);
		color: #130707;
		font-size: clamp(9px, 0.58cqw, 12px);
		box-shadow: inset 0 0 0 2px rgba(255, 205, 180, 0.13), 0 0 18px rgba(224, 72, 61, 0.22);
		clip-path: polygon(9px 0, calc(100% - 9px) 0, 100% 9px, 100% calc(100% - 9px), calc(100% - 9px) 100%, 9px 100%, 0 calc(100% - 9px), 0 9px);
	}

	.monitor-status .primary-action:not(:disabled):hover,
	.monitor-status .primary-action:not(:disabled):focus-visible {
		filter: brightness(1.16);
	}

	.monitor-status .primary-action:disabled {
		border-color: #344c52;
		background: linear-gradient(145deg, #18292e, #0d191d);
		color: #648088;
		box-shadow: none;
	}

	.monitor-status .primary-action.feature-action:not(:disabled) {
		background: linear-gradient(145deg, #ff776a, #bd302c);
		box-shadow: 0 0 22px rgba(241, 75, 62, 0.4);
	}

	.monitor-status .info-action {
		min-height: 48px;
		font-size: clamp(8px, 0.5cqw, 11px);
	}

	.monitor-footer {
		position: relative;
		z-index: 4;
		display: grid;
		grid-template-columns: 1fr 1.15fr 1fr;
		gap: 5px;
		padding: 4px clamp(6px, 0.52cqw, 9px) 5px;
		border-top: 1px solid rgba(66, 120, 129, 0.56);
		background: linear-gradient(180deg, rgba(4, 16, 20, 0.96), rgba(9, 27, 32, 0.98));
	}

	.monitor-footer > div {
		display: grid;
		align-content: center;
		min-width: 0;
		padding: 2px 6px;
		border: 1px solid rgba(54, 98, 106, 0.74);
		background: rgba(4, 14, 17, 0.72);
	}

	.monitor-footer span {
		color: #5c959d;
		font-size: clamp(7px, 0.4cqw, 9px);
		letter-spacing: 0.14em;
	}

	.monitor-footer strong {
		overflow: hidden;
		color: #d8e9eb;
		font-size: clamp(10px, 0.56cqw, 12px);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.monitor-footer .primary-meter {
		border-color: rgba(162, 103, 70, 0.84);
		text-align: center;
	}

	.monitor-footer .primary-meter strong {
		color: #f0bc66;
	}

	.monitor-glass {
		position: absolute;
		z-index: 9;
		inset: 0;
		background:
			linear-gradient(111deg, transparent 16%, rgba(131, 226, 237, 0.025) 31%, transparent 44%),
			repeating-linear-gradient(180deg, transparent 0 3px, rgba(111, 207, 218, 0.018) 3px 4px);
		mix-blend-mode: screen;
		pointer-events: none;
	}

	@keyframes line-cell-hit {
		0% { opacity: 0.72; transform: translateY(0) scale(0.98); }
		42% { opacity: 1; transform: translateY(-3px) scale(1.045); }
		100% { opacity: 1; transform: translateY(-2px) scale(1.025); }
	}

	@keyframes win-plaque-enter {
		0% { opacity: 0; transform: translate(-50%, -46%) scale(0.86); }
		62% { opacity: 1; transform: translate(-50%, -52%) scale(1.035); }
		100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
	}

	@keyframes loss-plaque-enter {
		0% { opacity: 0; transform: translate(-50%, -47%) scale(0.96); }
		100% { opacity: 0.9; transform: translate(-50%, -50%) scale(1); }
	}

	.operative-stage[data-reaction='feature-tease'] .operative-halo,
	.operative-stage[data-reaction='vault-anticipation'] .operative-halo,
	.operative-stage[data-reaction='feature-trigger'] .operative-halo,
	.operative-stage[data-reaction='bonus-idle'] .operative-halo,
	.operative-stage[data-reaction='alert'] .operative-halo {
		background: radial-gradient(ellipse at 54% 55%, rgba(250, 64, 49, 0.32), transparent 58%);
		opacity: 0.92;
	}

	.app-shell[data-operator-reaction='spin-start'] .breach-monitor,
	.app-shell[data-operator-reaction='spin-loop'] .breach-monitor {
		animation: monitor-scan 620ms ease-out;
	}

	.app-shell[data-operator-reaction='feature-trigger'] .breach-monitor,
	.app-shell[data-operator-reaction='max-win'] .breach-monitor {
		animation: monitor-impact 720ms ease-out;
	}

	@media (max-width: 960px), (max-aspect-ratio: 4/3) {
		.app-shell::before {
			inset: -16px;
			filter: blur(12px) brightness(0.28) saturate(0.65);
		}

		.scene-world {
			inset: 0;
			width: 100%;
			height: 100%;
			box-shadow: none;
			transform: none;
		}

		.bunker-backdrop {
			filter: saturate(0.72) brightness(0.42);
			object-fit: cover;
			object-position: 58% center;
		}

		.scene-grade {
			background: linear-gradient(180deg, rgba(2, 7, 9, 0.2), rgba(2, 7, 9, 0.84));
		}

		.operative-stage {
			display: none;
		}

		.operative-readout,
		.operative-floor-light {
			display: none;
		}

		.breach-monitor {
			z-index: 4;
			inset: max(4px, env(safe-area-inset-top)) max(4px, env(safe-area-inset-right)) max(4px, env(safe-area-inset-bottom)) max(4px, env(safe-area-inset-left));
			grid-template-rows: 44px minmax(0, 1fr) 48px;
			width: auto;
			height: auto;
			min-width: 0;
			min-height: 0;
			background-color: rgba(2, 10, 13, 0.9);
			clip-path: polygon(7px 0, calc(100% - 7px) 0, 100% 7px, 100% calc(100% - 7px), calc(100% - 7px) 100%, 7px 100%, 0 calc(100% - 7px), 0 7px);
		}

		.monitor-header {
			min-height: 44px;
			padding: 5px 8px;
		}

		.monitor-identity > span { display: none; }
		.monitor-identity h1 { font-size: 18px; }

		.breach-monitor .lifecycle {
			max-width: 48%;
			font-size: 7px;
		}

		.monitor-main {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: auto minmax(0, 1fr) auto;
			grid-template-areas: 'rail' 'board' 'status';
			gap: 5px;
			padding: 5px;
		}

		.mode-console {
			display: grid;
			grid-template-columns: minmax(0, 1fr) minmax(108px, 0.36fr);
			gap: 5px;
			padding: 0;
		}

		.mode-player-guide {
			display: none;
		}

		.breach-monitor .mode-list {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}

		.breach-monitor .mode-list button {
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: auto auto;
			align-content: center;
			min-height: 44px;
			gap: 2px;
			padding: 3px 4px;
			font-size: 7px;
			text-align: center;
		}

		.breach-monitor .mode-list button .mode-label-full { display: none; }
		.breach-monitor .mode-list button .mode-label-compact {
			display: block;
			width: 100%;
			font-size: 8px;
			text-overflow: clip;
		}

		.breach-monitor .mode-list button strong {
			justify-content: center;
			font-size: 9px;
		}

		.breach-monitor .mode-list button strong small {
			display: inline;
			font-size: 6px;
		}

		.breach-monitor .amount-control {
			align-content: end;
			margin: 0;
		}

		.breach-monitor .amount-control > span:first-child {
			display: block;
			font-size: 6px;
		}

		.monitor-board-stage {
			grid-template-rows: 24px 24px minmax(0, 1fr);
			gap: 4px;
		}

		.field-brief {
			width: min(94%, 410px);
			gap: 5px;
			padding: 8px;
		}

		.field-brief-flow {
			gap: 3px;
		}

		.field-brief-flow > div {
			grid-template-columns: 23px minmax(66px, 0.42fr) minmax(0, 1fr);
			min-height: 37px;
			gap: 5px;
			padding: 4px 5px;
		}

		.field-brief-flow em {
			width: 21px;
			height: 21px;
		}

		.field-brief > p {
			padding: 5px 6px;
		}

		.breach-monitor .board-frame {
			align-self: center;
			width: min(calc(100cqw - 20px), calc(100cqh - 286px));
		}

		.monitor-status {
			position: static;
			grid-area: status;
			display: grid;
			width: auto;
			gap: 4px;
			align-self: end;
		}

		.monitor-status .launch-card {
			max-height: 82px;
			padding: 5px 7px;
			font-size: 7px;
		}

		.monitor-status .launch-card.error {
			position: absolute;
			width: min(360px, calc(100% - 24px));
		}

		.monitor-status .launch-card small { display: none; }

		.monitor-status .replay-card {
			display: none;
		}

		.monitor-status .jurisdiction-readouts {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.monitor-status .jurisdiction-readouts > span {
			min-height: 44px;
		}

		.monitor-status .action-stack {
			grid-column: 1 / -1;
			grid-template-columns: minmax(132px, 1fr) minmax(96px, 0.42fr);
			width: 100%;
		}

		.monitor-status .primary-action,
		.monitor-status .info-action {
			min-height: 44px;
		}

		.monitor-footer {
			padding: 4px 5px;
		}

		.monitor-footer > div { padding: 3px 5px; }
		.monitor-footer strong { font-size: 8px; }
	}

	@media (max-width: 480px) {
		.operative-stage {
			display: none;
		}

		.monitor-identity h1 { font-size: 16px; }

		.breach-monitor .board-frame {
			width: min(calc(100cqw - 20px), calc(100cqh - 278px));
		}

		.monitor-footer span { font-size: 5px; }
		.monitor-footer strong { font-size: 7px; }
	}

	@media (max-height: 560px) and (min-aspect-ratio: 2/1) {
		.operative-stage { display: none; }

		.breach-monitor {
			inset: 2px;
			grid-template-rows: 36px minmax(0, 1fr) 40px;
		}

		.monitor-header {
			min-height: 36px;
			padding: 3px 7px;
		}

		.monitor-identity h1 { font-size: 15px; }

		.monitor-main {
			grid-template-columns: minmax(124px, 0.44fr) minmax(180px, 1fr) minmax(142px, 0.48fr);
			grid-template-rows: minmax(0, 1fr);
			grid-template-areas: 'rail board status';
			gap: 4px;
			padding: 4px;
		}

		.mode-console {
			display: flex;
			padding: 0;
		}

		.breach-monitor .mode-list {
			grid-template-columns: 1fr;
			gap: 3px;
		}

		.breach-monitor .mode-list button,
		.breach-monitor .amount-control select,
		.breach-monitor .amount-range,
		.monitor-status .primary-action,
		.monitor-status .info-action {
			min-height: 44px;
		}

		.breach-monitor .amount-control { margin-top: auto; }

		.breach-monitor .board-frame {
			width: min(44cqw, calc(100cqh - 100px));
		}

		.monitor-status {
			position: static;
			display: flex;
			width: auto;
		}

		.monitor-status .launch-card {
			max-height: 78px;
		}

		.monitor-status .launch-card small,
		.monitor-status .jurisdiction-readouts {
			display: none;
		}

		.monitor-status .action-stack {
			grid-column: auto;
			grid-template-columns: 1fr;
			margin-top: auto;
		}

		.monitor-footer { padding: 3px 5px; }
	}

	.guide-boot-actions {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 8px;
		margin-top: 12px;
	}

	.guide-boot-actions button {
		position: relative;
		display: grid;
		min-height: 72px;
		align-content: center;
		gap: 6px;
		padding: 10px 12px;
		overflow: hidden;
		border: 1px solid #53605d;
		background: #0b1112;
		color: #e7c982;
		font: inherit;
		font-size: 9px;
		font-weight: 900;
		letter-spacing: .07em;
		text-align: left;
		cursor: pointer;
	}

	.guide-boot-actions button > :not(:global(.panel-state-art)) {
		position: relative;
		z-index: 2;
	}

	.guide-boot-actions button small {
		color: #8d9b98;
		font-size: 8px;
		font-weight: 650;
		line-height: 1.35;
		letter-spacing: .02em;
	}

	.guide-boot-actions button strong {
		color: #f0bd65;
	}

	.guide-boot-actions button:hover:not(:disabled),
	.guide-boot-actions button:focus-visible {
		border-color: #d1a14d;
		outline: 2px solid #fff0c7;
		outline-offset: 2px;
	}

	@media (max-width: 620px) {
		.guide-boot-actions { grid-template-columns: 1fr; }
		.guide-boot-actions button { min-height: 58px; }
	}

	@media (prefers-reduced-motion: reduce) {
		.operative-halo,
		.scene-grade,
		.breach-monitor,
		.breach-monitor .cell.line-active,
		.board-result-plaque {
			animation: none !important;
		}

		.breach-monitor .cell,
		.symbol-art {
			transition: none !important;
		}

		.payline-overlay img {
			animation: none !important;
		}
	}
	/* M5: classic 5x3 reel presentation. This final layer intentionally wins
	   over the retained shared shell/modal primitives above. */
	.breach-monitor {
		grid-template-rows: clamp(46px, 5cqh, 56px) minmax(0, 1fr) 30px;
	}

	.reel-console {
		position: relative;
		z-index: 3;
		display: grid;
		grid-template-rows: 30px minmax(0, 1fr) 64px 44px;
		min-width: 0;
		min-height: 0;
		gap: 5px;
		padding: 6px 9px;
		overflow: hidden;
	}

	.reel-mechanic-strip {
		position: relative;
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		min-width: 0;
		gap: 4px;
	}

	.reel-mechanic-strip > span {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 0;
		gap: 4px;
		padding: 3px 5px;
		overflow: hidden;
		border: 1px solid rgba(59, 111, 120, 0.68);
		background: rgba(3, 15, 18, 0.9);
		color: #86a7ac;
		font-size: clamp(6px, 0.42cqw, 9px);
		font-weight: 750;
		letter-spacing: 0.055em;
		white-space: nowrap;
	}

	.reel-mechanic-strip strong { color: #eaf7f8; font-size: 1.12em; }
	.reel-mechanic-strip .wild-rule { border-color: rgba(232, 81, 69, 0.66); color: #e2aaa5; }
	.reel-mechanic-strip .wild-rule strong { color: #ff766a; }
	.reel-mechanic-strip .armed { border-color: #e7aa48; box-shadow: inset 0 0 14px rgba(232, 160, 48, 0.16); }
	.reel-mechanic-strip .feature-state,
	.reel-mechanic-strip .target-state { border-color: #f26458; background: rgba(53, 16, 16, 0.86); }
	.reel-mechanic-strip .target-state small { color: #d59690; font-size: 0.72em; }
	.reel-mechanic-strip.feature-strip > span {
		display: grid;
		grid-template-rows: auto 1fr auto;
		place-items: center;
		gap: 1px;
		line-height: 1;
	}
	.reel-mechanic-strip.feature-strip small,
	.reel-mechanic-strip.feature-strip em {
		overflow: hidden;
		max-width: 100%;
		color: #aeb9b8;
		font: 800 .72em/1 ui-monospace, monospace;
		font-style: normal;
		letter-spacing: .08em;
		text-overflow: ellipsis;
	}
	.reel-mechanic-strip.feature-strip > span > strong {
		font-size: 1.34em;
		letter-spacing: .04em;
	}
	.feature-target-value {
		display: flex;
		min-width: 0;
		align-items: center;
		justify-content: center;
		gap: 4px;
	}
	.feature-target-value img {
		width: 22px;
		height: 22px;
		object-fit: contain;
	}
	.reel-stage {
		display: grid;
		grid-template-rows: 27px minmax(0, 1fr) 30px;
		min-width: 0;
		min-height: 0;
		gap: 4px;
	}

	.reel-stage-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-width: 0;
		gap: 8px;
	}

	.reel-stage-heading > div:first-child {
		display: grid;
		min-width: 0;
		gap: 1px;
	}

	.reel-stage-heading span {
		color: #5e9ba3;
		font-size: clamp(6px, 0.38cqw, 8px);
		letter-spacing: 0.14em;
	}

	.reel-stage-heading strong {
		overflow: hidden;
		color: #dcebed;
		font-size: clamp(7px, 0.48cqw, 10px);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.reel-stage-heading .phase-chip {
		flex: none;
		padding: 4px 7px;
		border-color: rgba(72, 141, 150, 0.72);
		font-size: clamp(6px, 0.4cqw, 9px);
	}

	.reel-stage-heading .feature-phase {
		border-color: #f1665a;
		background: rgba(63, 20, 18, 0.86);
		color: #ff968d;
	}

	.reel-machine {
		display: grid;
		grid-template-columns: 22px minmax(0, 1fr) 22px;
		align-items: stretch;
		align-self: center;
		justify-self: center;
		width: min(100%, 548px);
		max-height: 100%;
		aspect-ratio: 1.79;
		min-width: 0;
		min-height: 0;
	}

	.line-gutter {
		display: grid;
		grid-template-rows: repeat(10, minmax(0, 1fr));
		align-items: center;
		justify-items: center;
		padding-block: 6px;
	}

	.line-gutter span {
		display: grid;
		width: 18px;
		height: 18px;
		place-items: center;
		border: 1px solid rgba(73, 130, 139, 0.7);
		background: #061419;
		color: #6e9ba2;
		font-size: 7px;
		font-weight: 800;
		line-height: 1;
	}

	.line-gutter span.active {
		border-color: #ffd36b;
		background: #6a4915;
		color: #fff0b8;
		box-shadow: 0 0 9px rgba(255, 199, 70, 0.68);
	}

	.breach-monitor .reel-window {
		position: relative;
		align-self: stretch;
		justify-self: stretch;
		width: 100%;
		height: 100%;
		max-width: none;
		max-height: 100%;
		aspect-ratio: 5 / 3;
		padding: 8px;
		border: 1px solid rgba(75, 139, 148, 0.82);
		background:
			linear-gradient(145deg, rgba(46, 83, 90, 0.96), rgba(2, 9, 11, 0.99) 16% 84%, rgba(42, 86, 93, 0.9)),
			#010709;
		box-shadow:
			inset 0 0 0 3px rgba(6, 22, 26, 0.96),
			inset 0 16px 30px rgba(0, 0, 0, 0.8),
			0 10px 25px rgba(0, 0, 0, 0.6),
			0 0 18px rgba(52, 184, 202, 0.12);
	}

	.breach-monitor .reel-grid {
		display: grid;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		grid-template-rows: repeat(3, minmax(0, 1fr));
		width: 100%;
		height: 100%;
		gap: 4px;
		padding: 4px;
		border: 1px solid rgba(71, 126, 135, 0.6);
		background: linear-gradient(180deg, #02080a, #07181c 48%, #02090b);
		box-shadow: inset 0 10px 24px rgba(0, 0, 0, 0.84), inset 0 -8px 18px rgba(37, 155, 171, 0.05);
	}

	.breach-monitor .reel-cell {
		position: relative;
		isolation: isolate;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
		border: 0;
		border-radius: 3px;
		background:
			radial-gradient(circle at 50% 42%, var(--symbol-glow, rgba(66, 167, 182, 0.12)), transparent 62%),
			linear-gradient(150deg, #132b30, #041014 82%);
		box-shadow: inset 0 1px rgba(166, 224, 231, 0.12), inset 0 -8px 14px rgba(0, 0, 0, 0.55), 0 2px 4px #000;
	}

	.breach-monitor .reel-cell::before {
		position: absolute;
		z-index: 4;
		inset: 0;
		border: 1px solid rgba(108, 171, 179, 0.08);
		border-radius: inherit;
		content: '';
		pointer-events: none;
	}

	.breach-monitor .reel-cell[data-symbol-id='ghost_wild'] { --symbol-glow: rgba(245, 59, 45, 0.34); }
	.breach-monitor .reel-cell[data-symbol-id='breach'] { --symbol-glow: rgba(46, 225, 245, 0.34); }

	.breach-monitor .reel-cell .symbol-art {
		inset: 2px 3px 12px;
		filter: saturate(1.02) brightness(1.08) contrast(1.05);
		opacity: 1;
	}

	.breach-monitor .reel-cell .special-symbol img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		max-width: 100%;
		object-fit: contain;
	}

	.breach-monitor .reel-cell .symbol-code {
		position: absolute;
		z-index: 5;
		right: 2px;
		bottom: 2px;
		left: 2px;
		display: block;
		width: auto;
		height: auto;
		overflow: hidden;
		padding: 1px 2px;
		clip: auto;
		clip-path: none;
		background: linear-gradient(90deg, rgba(1, 8, 10, 0.88), rgba(1, 8, 10, 0.62), rgba(1, 8, 10, 0.88));
		color: #cfe4e7;
		font-size: clamp(5px, 0.36cqw, 8px);
		letter-spacing: 0.08em;
		line-height: 1.25;
		text-align: center;
		text-shadow: 0 1px 2px #000;
		white-space: nowrap;
	}

	.breach-monitor .wild-cell .symbol-code { color: #ff8b80; font-size: clamp(7px, 0.48cqw, 10px); }
	.breach-monitor .breach-cell .symbol-code { color: #8ceeff; font-size: clamp(7px, 0.48cqw, 10px); }

	.breach-monitor .reel-grid[data-has-win='true'] .reel-cell:not(.line-active) {
		filter: saturate(0.45) brightness(0.55);
		opacity: 0.38;
		transform: scale(0.975);
	}

	.breach-monitor .reel-cell.line-active {
		z-index: 3;
		background: radial-gradient(circle, rgba(255, 220, 114, 0.25), transparent 66%), #15130d;
		box-shadow: inset 0 0 0 2px #ffe18a, inset 0 0 15px rgba(255, 196, 65, 0.38), 0 0 13px rgba(255, 201, 70, 0.54);
		transform: translateY(-2px) scale(1.018);
	}

	.payline-overlay {
		position: absolute;
		z-index: 7;
		inset: 12px;
		width: calc(100% - 24px);
		height: calc(100% - 24px);
		overflow: visible;
		pointer-events: none;
	}

	.payline-overlay img {
		animation: line-signal 720ms ease-out both;
	}

	.result-ticker {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-width: 0;
		gap: 8px;
		padding: 4px 8px;
		border: 1px solid rgba(72, 129, 137, 0.62);
		border-left: 3px solid #d95a50;
		background: linear-gradient(90deg, rgba(27, 13, 13, 0.92), rgba(3, 14, 17, 0.94));
		color: #8eabb0;
		font-size: clamp(6px, 0.42cqw, 9px);
		letter-spacing: 0.08em;
	}

	.result-ticker span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.result-ticker strong { flex: none; color: #ffd978; font-size: clamp(8px, 0.58cqw, 12px); }

	.reel-brief {
		width: min(92%, 470px);
		gap: 6px;
		padding: 8px;
	}

	.reel-brief .field-brief-flow { grid-template-columns: repeat(3, minmax(0, 1fr)); }
	.reel-brief .field-brief-flow > div {
		grid-template-columns: 23px minmax(0, 1fr);
		grid-template-rows: auto auto;
		align-content: center;
		min-height: 74px;
		padding: 5px;
	}
	.reel-brief .field-brief-flow em { grid-row: 1 / 3; }
	.reel-brief .field-brief-flow span { font-size: clamp(6px, 0.4cqw, 8px); line-height: 1.25; }

	.control-deck {
		display: grid;
		grid-template-columns: minmax(108px, 0.9fr) minmax(92px, 0.78fr) minmax(108px, 1fr) minmax(132px, 1.12fr);
		min-width: 0;
		gap: 5px;
	}

	.reel-console .reel-bet-control,
	.control-meter,
	.balance-meter {
		display: grid;
		align-content: center;
		min-width: 0;
		gap: 2px;
		margin: 0;
		padding: 4px 7px;
		border: 1px solid rgba(61, 108, 116, 0.72);
		background: rgba(3, 14, 17, 0.92);
	}

	.reel-console .reel-bet-control {
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		align-content: stretch;
		gap: 6px;
		padding-block: 2px;
	}

	.reel-console .reel-bet-control > span:first-child,
	.control-meter span,
	.balance-meter span {
		color: #659ba3;
		font-size: clamp(6px, 0.39cqw, 8px);
		font-weight: 800;
		letter-spacing: 0.13em;
	}

	.reel-console .reel-bet-control select,
	.reel-console .reel-bet-control .amount-range {
		width: 100%;
		min-height: 44px;
		border: 0;
		background: rgba(7, 25, 29, 0.98);
		color: #e3f0f2;
		font-size: clamp(9px, 0.6cqw, 13px);
		font-weight: 800;
	}

	.reel-console .reel-bet-control .amount-range { padding: 0 6px; }
	.reel-console .reel-bet-control input[data-testid='base-amount'] {
		min-height: 44px;
		margin: 0;
	}

	.control-meter strong,
	.balance-meter strong {
		overflow: hidden;
		color: #e8f2f3;
		font-size: clamp(11px, 0.75cqw, 16px);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.total-meter { border-color: rgba(181, 116, 62, 0.82); }
	.total-meter strong { color: #f2c16d; }
	.win-meter { border-color: rgba(91, 163, 174, 0.82); text-align: center; }
	.win-meter strong { color: #fff0b4; font-size: clamp(14px, 0.95cqw, 20px); }

	.reel-console .reel-spin {
		display: grid;
		min-height: 0;
		place-content: center;
		gap: 1px;
		padding: 5px;
		border: 1px solid #ff786d;
		background: radial-gradient(circle at 50% 30%, rgba(255, 205, 155, 0.24), transparent 48%), linear-gradient(145deg, #ed665b, #9e2826);
		color: #160707;
		box-shadow: inset 0 0 0 2px rgba(255, 202, 179, 0.12), 0 0 17px rgba(227, 70, 59, 0.24);
		font-size: clamp(14px, 1cqw, 21px);
		font-weight: 950;
		letter-spacing: 0.08em;
	}

	.reel-console .reel-spin small { font-size: 6px; letter-spacing: 0.13em; opacity: 0.66; }
	.reel-console .reel-spin:disabled { border-color: #385158; background: #14242a; color: #708c92; box-shadow: none; }

	.secondary-deck {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(96px, 0.25fr) minmax(94px, 0.22fr);
		min-width: 0;
		gap: 5px;
	}

	.breach-monitor .secondary-mode-list {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 4px;
	}

	.breach-monitor .secondary-mode-list button {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-width: 0;
		min-height: 40px;
		gap: 4px;
		padding: 4px 7px;
		border: 1px solid rgba(56, 101, 109, 0.72);
		background: #08191d;
		color: #8ba9ae;
		font-size: clamp(6px, 0.42cqw, 9px);
	}

	.breach-monitor .secondary-mode-list button span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.breach-monitor .secondary-mode-list button strong { color: #e2b25f; font-size: 1.14em; }
	.breach-monitor .secondary-mode-list button.selected { border-color: #ef695e; background: #371a19; color: #f1d7d4; box-shadow: inset 3px 0 #f4695e; }

	.balance-meter { min-height: 44px; padding: 3px 6px; }
	.balance-meter strong { font-size: clamp(8px, 0.52cqw, 11px); }
	.secondary-deck .info-action { min-height: 44px; padding: 4px; font-size: clamp(7px, 0.46cqw, 10px); }

	.reel-footer {
		position: relative;
		z-index: 3;
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-width: 0;
		gap: 8px;
		padding: 4px 10px;
		border-top: 1px solid rgba(62, 114, 123, 0.54);
		background: rgba(3, 14, 17, 0.96);
		color: #71999f;
		font-size: clamp(6px, 0.39cqw, 8px);
	}

	.reel-footer span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.reel-footer strong { flex: none; color: #d4e5e7; font-size: inherit; }
	.session-readouts {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 0;
		gap: 4px;
		margin-left: auto;
	}

	.session-readout {
		display: flex;
		align-items: center;
		min-width: 0;
		gap: 3px;
		padding: 2px 4px;
		border: 1px solid rgba(71, 124, 133, 0.58);
		background: rgba(5, 22, 26, 0.82);
	}

	.session-readout small { color: #6799a0; font-size: inherit; }
	.session-readout strong { color: #e0ecee; }
	.reel-error-status {
		position: absolute;
		z-index: 12;
		inset: 0;
		grid-area: auto;
		align-self: stretch;
		justify-self: stretch;
		width: auto;
		height: auto;
	}

	.reel-error-status .launch-card.error {
		position: absolute;
		top: 50%;
		left: 50%;
		width: min(330px, calc(100% - 24px));
		max-height: 76%;
		transform: translate(-50%, -50%);
	}

	@keyframes line-signal {
		0% { opacity: 0; stroke-dasharray: 0 620; }
		55% { opacity: 1; }
		100% { opacity: 1; stroke-dasharray: 620 0; }
	}

	@media (max-width: 960px), (max-aspect-ratio: 4/3) {
		.breach-monitor { grid-template-rows: 44px minmax(0, 1fr) 28px; }
		.reel-console { grid-template-rows: auto minmax(0, 1fr) auto auto; gap: 4px; padding: 5px; }
		.reel-mechanic-strip { grid-template-columns: repeat(4, minmax(0, 1fr)); }
		.reel-mechanic-strip > span { min-height: 28px; padding: 3px; font-size: 6px; }
		.reel-mechanic-strip .feature-state,
		.reel-mechanic-strip .target-state { grid-column: span 2; }
		.reel-stage { grid-template-rows: 30px minmax(0, 1fr) 32px; }
		.reel-machine { width: min(100%, calc((100cqh - 260px) * 1.79)); max-width: 590px; }
		.control-deck { grid-template-columns: repeat(3, minmax(0, 1fr)); grid-template-rows: 50px 54px; }
		.reel-console .reel-spin { grid-column: 1 / -1; min-height: 54px; }
		.secondary-deck { grid-template-columns: minmax(0, 1fr) minmax(106px, 0.3fr); grid-template-rows: 44px 44px; }
		.breach-monitor .secondary-mode-list { grid-column: 1 / -1; }
		.breach-monitor .secondary-mode-list button,
		.balance-meter,
		.secondary-deck .info-action { min-height: 44px; }
		.reel-footer { padding: 3px 7px; font-size: 6px; }
	}

	@media (max-width: 480px) {
		.monitor-identity h1 { font-size: 16px; }
		.breach-monitor .lifecycle { font-size: 6px; }
		.reel-mechanic-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
		.reel-mechanic-strip > span { font-size: 6px; }
		.reel-stage-heading span { display: none; }
		.reel-stage-heading strong { font-size: 7px; }
		.reel-machine { grid-template-columns: 18px minmax(0, 1fr) 18px; width: 100%; }
		.line-gutter span { width: 15px; height: 15px; font-size: 6px; }
		.breach-monitor .reel-window { padding: 5px; }
		.breach-monitor .reel-grid { gap: 3px; padding: 3px; }
		.payline-overlay { inset: 8px; width: calc(100% - 16px); height: calc(100% - 16px); }
		.reel-brief { width: 94%; padding: 6px; }
		.reel-brief header { padding-bottom: 4px; }
		.reel-brief h2 { font-size: 11px; }
		.reel-brief .field-brief-flow > div { grid-template-columns: 1fr; grid-template-rows: auto auto; min-height: 48px; text-align: center; }
		.reel-brief .field-brief-flow em { display: none; }
		.reel-brief .field-brief-flow span { display: none; }
		.control-meter strong { font-size: 11px; }
		.win-meter strong { font-size: 14px; }
		.breach-monitor .secondary-mode-list button { padding: 3px 4px; font-size: 7px; }
		.reel-footer > span:first-child { display: none; }
		.reel-footer { justify-content: center; }
	}

	@media (max-height: 560px) and (min-aspect-ratio: 2/1) {
		.breach-monitor { grid-template-rows: 36px minmax(0, 1fr) 22px; }
		.reel-console { grid-template-rows: 24px minmax(0, 1fr) 48px 44px; gap: 3px; padding: 3px 5px; }
		.reel-mechanic-strip > span { min-height: 24px; }
		.reel-stage { grid-template-rows: minmax(0, 1fr) 24px; }
		.reel-stage-heading { display: none; }
		.reel-machine { width: min(100%, calc((100cqh - 178px) * 1.79)); }
		.control-deck { grid-template-columns: minmax(92px, .8fr) minmax(84px, .7fr) minmax(90px, .8fr) minmax(118px, 1fr); grid-template-rows: 48px; }
		.reel-console .reel-spin { grid-column: auto; min-height: 48px; }
		.secondary-deck { grid-template-columns: minmax(0, 1fr) 96px 96px; grid-template-rows: 44px; }
		.breach-monitor .secondary-mode-list { grid-column: auto; }
		.reel-footer > span:first-child { display: none; }
	}

	/* M6 premium classic-slot composition. The retained component contracts above
	   stay authoritative; this final layer owns only presentation and interaction. */
	:global(*) { box-sizing: border-box; }
	:global(html),
	:global(body) {
		width: 100%;
		height: 100%;
		margin: 0;
		overflow: hidden;
		background: #020404;
		touch-action: manipulation;
	}

	:global(button),
	:global(select),
	:global(input) { font: inherit; }

	.app-shell {
		position: fixed;
		inset: 0;
		min-width: 0;
		min-height: 0;
		overflow: clip;
		background: #020404;
		color: #f4f3ef;
		font-family: Inter, "Segoe UI", Arial, sans-serif;
	}

	.scene-world {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: clip;
		border: 0;
		background: #030607;
		transform: none;
	}

	.bunker-backdrop {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center;
		filter: saturate(.7) brightness(.5) contrast(1.13);
		transform: scale(1.015);
	}

	.scene-grade {
		position: absolute;
		z-index: 1;
		inset: 0;
		background:
			radial-gradient(circle at 14% 47%, rgba(15, 108, 137, .16), transparent 25%),
			radial-gradient(circle at 80% 33%, rgba(145, 31, 24, .14), transparent 30%),
			linear-gradient(90deg, rgba(0, 0, 0, .25), transparent 32% 80%, rgba(0, 0, 0, .3)),
			linear-gradient(180deg, rgba(0, 0, 0, .45), transparent 15% 82%, rgba(0, 0, 0, .62));
		pointer-events: none;
	}

	.operative-stage {
		position: absolute;
		z-index: 3;
		top: clamp(68px, 8vh, 118px);
		bottom: clamp(116px, 13vh, 160px);
		left: clamp(10px, 1.4vw, 30px);
		display: block;
		width: clamp(220px, 24vw, 440px);
		height: auto;
		min-height: 0;
		pointer-events: none;
	}

	.operative-halo {
		position: absolute;
		inset: 11% 1% 2%;
		border-radius: 50% 50% 26% 26%;
		background:
			radial-gradient(ellipse at 45% 45%, rgba(4, 74, 95, .34), transparent 57%),
			radial-gradient(ellipse at 60% 55%, rgba(170, 28, 22, .22), transparent 68%);
		filter: blur(18px);
	}

	.operative-floor-light {
		position: absolute;
		right: 10%;
		bottom: -2%;
		left: 10%;
		height: 7%;
		border-radius: 50%;
		background: radial-gradient(ellipse, rgba(44, 177, 210, .3), rgba(180, 37, 25, .14) 45%, transparent 72%);
		filter: blur(10px);
	}

	.operative-readout {
		position: absolute;
		right: 3%;
		bottom: -46px;
		left: 7%;
		display: grid;
		gap: 3px;
		padding: 8px 11px 8px 13px;
		border-left: 3px solid #ce342d;
		background: linear-gradient(90deg, rgba(4, 14, 16, .95), rgba(4, 14, 16, .28));
		box-shadow: 0 10px 28px rgba(0, 0, 0, .5);
	}

	.operative-readout span {
		color: #6cb4c4;
		font-size: 8px;
		font-weight: 800;
		letter-spacing: .18em;
	}

	.operative-readout strong {
		overflow: hidden;
		color: #f0f3ef;
		font-size: 10px;
		font-weight: 750;
		letter-spacing: .04em;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.breach-monitor {
		position: absolute;
		z-index: 4;
		top: clamp(12px, 2vh, 28px);
		right: clamp(10px, 1.5vw, 30px);
		bottom: clamp(10px, 1.5vh, 22px);
		left: clamp(280px, 26vw, 470px);
		display: grid;
		width: auto;
		height: auto;
		min-width: 0;
		min-height: 0;
		grid-template-rows: clamp(64px, 7.2vh, 82px) minmax(0, 1fr) 24px;
		overflow: hidden;
		border: 1px solid rgba(193, 151, 73, .75);
		border-radius: 4px;
		background:
			linear-gradient(135deg, rgba(255,255,255,.05), transparent 12% 88%, rgba(255,255,255,.03)),
			rgba(3, 10, 12, .96);
		box-shadow:
			0 0 0 3px rgba(2, 7, 9, .92),
			0 0 0 5px rgba(81, 91, 91, .75),
			0 24px 70px rgba(0,0,0,.82),
			inset 0 0 35px rgba(18, 76, 89, .08);
		container-type: size;
	}

	.breach-monitor::before,
	.breach-monitor::after {
		position: absolute;
		z-index: 15;
		width: 52px;
		height: 18px;
		border-top: 3px solid #b88943;
		content: '';
		pointer-events: none;
	}
	.breach-monitor::before { top: -1px; left: -1px; border-left: 3px solid #b88943; }
	.breach-monitor::after { top: -1px; right: -1px; border-right: 3px solid #b88943; }

	.monitor-header {
		position: relative;
		z-index: 4;
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-width: 0;
		gap: 18px;
		padding: 8px clamp(14px, 1.7vw, 28px) 7px;
		border-bottom: 1px solid rgba(182, 133, 63, .55);
		background:
			linear-gradient(180deg, rgba(36, 44, 44, .96), rgba(5, 11, 13, .98)),
			#090d0e;
		box-shadow: inset 0 -1px rgba(0,0,0,.9), 0 6px 18px rgba(0,0,0,.5);
	}

	.monitor-identity {
		display: grid;
		min-width: 0;
		gap: 2px;
	}

	.monitor-identity > span {
		color: #7c9aa0;
		font-size: clamp(7px, .52vw, 10px);
		font-weight: 800;
		letter-spacing: .2em;
	}

	.monitor-identity h1 {
		margin: 0;
		font-size: clamp(28px, 2.55vw, 54px);
		font-weight: 900;
		letter-spacing: -.035em;
		line-height: .9;
		white-space: nowrap;
	}

	.monitor-identity h1 b {
		background: linear-gradient(180deg, #ffffff 0%, #aeb6b8 48%, #fcfcf7 56%, #677174 100%);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
		filter: drop-shadow(0 2px 0 #0b1012) drop-shadow(0 0 6px rgba(199,226,230,.18));
	}

	.monitor-identity h1 em {
		color: #ec463e;
		font-style: normal;
		font-weight: 500;
		text-shadow: 0 2px 0 #3d0806, 0 0 12px rgba(231,48,39,.2);
	}

	.lifecycle {
		display: grid;
		grid-template-columns: 9px auto;
		align-items: center;
		justify-items: start;
		min-width: 116px;
		gap: 1px 9px;
		padding: 6px 10px;
		border: 1px solid rgba(125, 139, 138, .25);
		background: rgba(0,0,0,.28);
	}

	.lifecycle .pulse { grid-row: 1 / 3; width: 8px; height: 8px; border-radius: 50%; background: #d93631; box-shadow: 0 0 9px rgba(235,47,42,.9); }
	.lifecycle strong { color: #f1eee7; font-size: 10px; letter-spacing: .16em; }
	.lifecycle small { color: #677b7f; font-size: 7px; letter-spacing: .09em; }

	.reel-console {
		position: relative;
		z-index: 3;
		display: grid;
		min-width: 0;
		min-height: 0;
		grid-template-rows: 34px minmax(0, 1fr) clamp(136px, 17cqh, 174px);
		gap: 7px;
		padding: 8px clamp(9px, 1.1vw, 18px) 7px;
		overflow: hidden;
		background:
			linear-gradient(90deg, transparent 49.8%, rgba(83, 132, 138, .055) 50%, transparent 50.2%),
			linear-gradient(rgba(71, 111, 116, .045) 1px, transparent 1px),
			linear-gradient(90deg, rgba(71, 111, 116, .045) 1px, transparent 1px),
			linear-gradient(180deg, #071013, #020708);
		background-size: auto, 26px 26px, 26px 26px, auto;
	}

	.reel-mechanic-strip {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 6px;
	}

	.reel-mechanic-strip > span {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 0;
		min-height: 32px;
		gap: 5px;
		padding: 4px 7px;
		overflow: hidden;
		border: 1px solid rgba(112, 121, 116, .34);
		background: linear-gradient(180deg, rgba(24,31,32,.94), rgba(4,9,11,.96));
		color: #9aa9aa;
		font-size: clamp(7px, .48cqw, 10px);
		font-weight: 800;
		letter-spacing: .09em;
		white-space: nowrap;
	}
	.reel-mechanic-strip > span strong { color: #f2cb7d; font-size: 1.12em; }
	.reel-mechanic-strip .wild-rule { border-color: rgba(193, 144, 64, .48); color: #c6b590; }
	.reel-mechanic-strip .wild-rule strong { color: #f2d493; }
	.reel-mechanic-strip .armed,
	.reel-mechanic-strip .feature-state,
	.reel-mechanic-strip .target-state { border-color: #b9312c; background: linear-gradient(180deg, rgba(78,25,23,.94), rgba(20,7,8,.96)); box-shadow: inset 3px 0 #d53e37; }

	.reel-stage {
		display: grid;
		min-width: 0;
		min-height: 0;
		grid-template-rows: 28px minmax(0, 1fr) 34px;
		gap: 5px;
	}

	.reel-stage-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-width: 0;
		gap: 10px;
		padding-inline: 34px;
	}

	.reel-stage-heading > div:first-child { display: flex; align-items: center; min-width: 0; gap: 10px; }
	.reel-stage-heading span { color: #719096; font-size: 8px; font-weight: 800; letter-spacing: .14em; }
	.reel-stage-heading strong { overflow: hidden; color: #d8dedc; font-size: clamp(8px,.52cqw,11px); letter-spacing: .04em; text-overflow: ellipsis; white-space: nowrap; }
	.reel-stage-heading .phase-chip { flex: none; padding: 5px 9px; border: 1px solid rgba(187, 143, 74, .5); background: rgba(12,15,14,.95); color: #d7c397; font-size: 8px; font-weight: 800; letter-spacing: .12em; }
	.reel-stage-heading .feature-phase { border-color: #c53731; background: rgba(77,18,16,.9); color: #ff9289; }

	.reel-machine {
		display: grid;
		grid-template-columns: 34px minmax(0, 1fr) 34px;
		align-items: center;
		align-self: center;
		justify-self: center;
		width: min(100%, 1050px);
		height: 100%;
		min-width: 0;
		min-height: 0;
	}

	.line-gutter {
		display: grid;
		grid-template-rows: repeat(10, minmax(0, 1fr));
		align-items: center;
		justify-items: center;
		height: min(100%, 560px);
		padding-block: 7px;
	}

	.line-gutter span {
		display: grid;
		width: 27px;
		height: 27px;
		place-items: center;
		border: 1px solid #586064;
		border-radius: 3px;
		background: linear-gradient(180deg, #1c2224, #050708);
		box-shadow: inset 0 0 0 2px #0b1012, 0 2px 4px #000;
		color: #dbe4e3;
		font-size: 10px;
		font-weight: 900;
	}
	.line-gutter span.active { border-color: #f0b956; background: #69420d; color: #fff3c1; box-shadow: inset 0 0 0 2px #251705, 0 0 13px rgba(244,178,66,.8); }

	.breach-monitor .reel-window {
		position: relative;
		align-self: center;
		justify-self: center;
		width: auto;
		height: 100%;
		max-width: 980px;
		max-height: 100%;
		aspect-ratio: 5 / 3;
		padding: 7px;
		overflow: hidden;
		border: 1px solid #ad7e3f;
		border-radius: 3px;
		background:
			linear-gradient(145deg, #888b86 0 2px, #1c2425 3px 11px, #b18242 12px 13px, #050708 14px calc(100% - 14px), #a7793c calc(100% - 13px) calc(100% - 12px), #1a2122 calc(100% - 11px));
		box-shadow: 0 0 0 3px #06090a, 0 0 0 5px #3a4141, 0 12px 30px rgba(0,0,0,.7), inset 0 0 24px rgba(0,0,0,.78);
	}

	.breach-monitor .reel-grid {
		display: grid;
		width: 100%;
		height: auto;
		aspect-ratio: 5 / 3;
		grid-template-columns: repeat(5, minmax(0, 1fr));
		grid-template-rows: repeat(3, minmax(0, 1fr));
		gap: 3px;
		padding: 3px;
		border: 1px solid rgba(190,145,69,.66);
		background: #020506;
		box-shadow: inset 0 16px 30px rgba(0,0,0,.76), inset 0 -12px 22px rgba(0,0,0,.5);
	}

	.breach-monitor .reel-cell {
		position: relative;
		isolation: isolate;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
		border: 1px solid rgba(144, 105, 52, .5);
		border-radius: 2px;
		background:
			radial-gradient(ellipse at 50% 45%, var(--symbol-glow, rgba(69,105,111,.18)), transparent 66%),
			linear-gradient(180deg, #11191b, #030708 86%);
		box-shadow: inset 0 1px rgba(255,255,255,.08), inset 0 -12px 18px rgba(0,0,0,.58);
	}

	.breach-monitor .reel-cell::before {
		position: absolute;
		z-index: 4;
		inset: 0;
		border: 1px solid rgba(238,194,111,.06);
		content: '';
		pointer-events: none;
	}
	.breach-monitor .reel-cell[data-symbol-id='ghost_wild'] { --symbol-glow: rgba(225,181,83,.3); border-color: rgba(221,180,88,.62); }
	.breach-monitor .reel-cell[data-symbol-id='breach'] { --symbol-glow: rgba(222,47,37,.42); border-color: rgba(211,54,45,.76); }

	.breach-monitor .reel-cell .symbol-art {
		position: absolute;
		z-index: 2;
		inset: 3px 5px 15px;
		display: grid;
		place-items: center;
		filter: saturate(1.04) brightness(1.04) contrast(1.04);
		opacity: 1;
	}

	.breach-monitor .reel-cell .symbol-art img {
		position: absolute;
		inset: 0;
		display: block;
		width: 100%;
		height: 100%;
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
		filter: drop-shadow(0 6px 6px rgba(0,0,0,.7));
	}

	.breach-monitor .reel-grid[data-spinning='true'] .reel-cell .symbol-art {
		animation: reel-column-spin 360ms linear infinite;
		filter: saturate(.76) brightness(1.08) blur(1.8px);
	}
	.breach-monitor .reel-grid[data-spinning='true'] .reel-cell:nth-child(5n + 2) .symbol-art { animation-delay:-70ms; }
	.breach-monitor .reel-grid[data-spinning='true'] .reel-cell:nth-child(5n + 3) .symbol-art { animation-delay:-140ms; }
	.breach-monitor .reel-grid[data-spinning='true'] .reel-cell:nth-child(5n + 4) .symbol-art { animation-delay:-210ms; }
	.breach-monitor .reel-grid[data-spinning='true'] .reel-cell:nth-child(5n + 5) .symbol-art { animation-delay:-280ms; }

	.breach-monitor .reel-cell .symbol-art img.sheet-symbol {
		position: absolute;
		width: auto;
		height: 600%;
		max-width: none;
		object-fit: initial;
	}

	.breach-monitor .reel-cell .symbol-code {
		position: absolute;
		z-index: 5;
		right: 3px;
		bottom: 2px;
		left: 3px;
		display: block;
		width: auto;
		height: auto;
		overflow: hidden;
		padding: 1px 3px;
		clip: auto;
		clip-path: none;
		background: linear-gradient(90deg, transparent, rgba(0,0,0,.78) 18% 82%, transparent);
		color: #d9ddd8;
		font-size: clamp(6px, .46cqw, 9px);
		font-weight: 900;
		letter-spacing: .08em;
		line-height: 1.3;
		text-align: center;
		text-shadow: 0 1px 2px #000;
		white-space: nowrap;
	}
	.breach-monitor .wild-cell .symbol-code { color: #f4d17f; font-size: clamp(7px,.48cqw,11px); }
	.breach-monitor .breach-cell .symbol-code { color: #ff665d; font-size: clamp(7px,.48cqw,11px); }

	.breach-monitor .reel-grid[data-has-win='true'] .reel-cell:not(.line-active) { filter: saturate(.38) brightness(.48); opacity: .45; transform: scale(.98); }
	.breach-monitor .reel-cell.line-active { z-index: 3; border-color: #ffd36f; background: radial-gradient(circle, rgba(255,211,111,.26), transparent 64%), #151109; box-shadow: inset 0 0 0 2px #f4c863, inset 0 0 20px rgba(255,190,58,.35), 0 0 16px rgba(246,190,61,.45); transform: translateY(-2px) scale(1.012); }

	.payline-overlay { position: absolute; z-index: 7; inset: 10px; width: calc(100% - 20px); height: calc(100% - 20px); overflow: visible; pointer-events: none; }
	.payline-overlay img { animation: line-signal 720ms ease-out both; }

	.result-ticker {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 0;
		gap: clamp(12px, 2cqw, 28px);
		padding: 5px 16px;
		border: 1px solid rgba(104, 111, 107, .42);
		border-inline: 3px solid #8e2a25;
		background: linear-gradient(90deg, transparent, rgba(7,10,10,.96) 12% 88%, transparent);
		color: #d5d0c6;
		font-size: clamp(7px,.52cqw,11px);
		font-weight: 800;
		letter-spacing: .1em;
		text-align: center;
	}
	.result-ticker::before { width: 24px; height: 18px; border: 1px solid #aa3730; background: linear-gradient(135deg,#60110e,#1d0807); box-shadow: inset 0 0 8px rgba(255,65,51,.28); content: '///'; color: #e24a40; font-size: 7px; line-height: 16px; }
	.result-ticker strong { flex: none; color: #f1c66e; font-size: 1.08em; }

	.reel-brief {
		position: absolute;
		z-index: 10;
		top: 50%;
		left: 50%;
		width: min(78%, 560px);
		padding: 14px;
		border: 1px solid rgba(196,151,77,.68);
		background: linear-gradient(180deg, rgba(14,20,20,.95), rgba(3,7,8,.96));
		box-shadow: 0 18px 42px rgba(0,0,0,.72), inset 0 0 22px rgba(166,119,53,.07);
		transform: translate(-50%,-50%);
		pointer-events: none;
	}
	.reel-brief header { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; padding-bottom: 10px; border-bottom: 1px solid rgba(165,126,67,.25); }
	.reel-brief header span { color: #d84038; font-size: 8px; font-weight: 900; letter-spacing: .16em; }
	.reel-brief h2 { margin: 0; color: #efe6d5; font-size: clamp(13px,1.2cqw,19px); letter-spacing: .05em; }
	.reel-brief .field-brief-flow { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 8px; margin-top: 10px; }
	.reel-brief .field-brief-flow > div { display: grid; grid-template-columns: 30px minmax(0,1fr); grid-template-rows: auto auto; min-height: 62px; gap: 2px 8px; padding: 7px; border: 1px solid rgba(105,119,117,.34); background: rgba(3,8,9,.72); }
	.reel-brief .field-brief-flow em { grid-row: 1 / 3; display:grid; width:28px; height:28px; place-items:center; align-self:center; border:1px solid #9d7438; border-radius:50%; color:#e6bd70; font-size:10px; font-style:normal; font-weight:900; }
	.reel-brief .field-brief-flow strong { color:#f0ebe0; font-size:9px; letter-spacing:.08em; }
	.reel-brief .field-brief-flow span { color:#899795; font-size:8px; line-height:1.35; }

	.premium-hud {
		display: grid;
		grid-template-columns: clamp(220px, 18cqw, 280px) minmax(0, 1fr) clamp(150px, 13cqw, 200px);
		grid-template-rows: minmax(82px, 1fr) 46px;
		min-width: 0;
		min-height: 0;
		gap: 6px 8px;
		padding: 3px 0 0;
	}

	.hud-tools {
		display: grid;
		grid-template-columns: repeat(3,minmax(0,1fr));
		align-items: center;
		justify-items: center;
		min-width: 0;
		gap: 5px;
	}
	.hud-tools-left { grid-column:1; grid-row:1; }
	.hud-tools-right { grid-column:3; grid-row:1; }

	.round-tool {
		position: relative;
		display: grid;
		width: clamp(44px, 3.7cqw, 58px);
		height: clamp(52px, 5.1cqh, 68px);
		min-width: 44px;
		min-height: 44px;
		place-items: center;
		align-content: center;
		gap: 3px;
		padding: 4px;
		border: 1px solid #6d7372;
		border-radius: 50%;
		background: radial-gradient(circle at 36% 28%, #364044, #0b1012 52%, #020405 68%);
		box-shadow: inset 0 0 0 3px #080b0c, inset 0 0 0 4px rgba(198,154,77,.5), 0 5px 12px rgba(0,0,0,.64);
		color: #e8d09b;
		cursor: pointer;
	}
	.round-tool span { position:absolute; top:calc(100% + 2px); color:#84918f; font-size:7px; font-weight:900; letter-spacing:.1em; white-space:nowrap; }
	.round-tool:hover:not(:disabled), .round-tool:focus-visible, .round-tool.active { border-color:#d2a653; color:#ffe4a8; box-shadow:inset 0 0 0 3px #080b0c,inset 0 0 0 4px #d0a04d,0 0 16px rgba(228,170,65,.28); outline:none; }
	.round-tool:disabled { filter:grayscale(.6); opacity:.44; cursor:not-allowed; }
	.shop-tool { color:#f2c86f; }

	.control-deck {
		grid-column: 2;
		grid-row: 1;
		display: grid;
		grid-template-columns: 44px minmax(94px,.9fr) 44px minmax(90px,.82fr) minmax(96px,.88fr) clamp(88px,8.6cqw,126px);
		grid-template-rows: minmax(76px,1fr);
		align-items: stretch;
		min-width: 0;
		gap: 6px;
	}

	.control-deck > * { min-width:0; }
	.reel-console .reel-bet-control,
	.control-meter,
	.balance-meter {
		display:grid;
		align-content:center;
		min-width:0;
		gap:3px;
		margin:0;
		padding:7px 9px;
		border:1px solid rgba(131,127,112,.5);
		background:linear-gradient(180deg,rgba(27,31,30,.96),rgba(4,7,8,.98));
		box-shadow:inset 0 0 0 2px rgba(0,0,0,.4),0 5px 12px rgba(0,0,0,.38);
	}

	.reel-console .reel-bet-control { grid-column:2; grid-row:1; grid-template-columns:1fr; align-items:center; gap:2px; padding:5px 7px; text-align:center; }
	.reel-console .reel-bet-control > span:first-child,
	.control-meter span,
	.balance-meter span { color:#d2b777; font-size:8px; font-weight:900; letter-spacing:.14em; }
	.reel-console .reel-bet-control select,
	.reel-console .reel-bet-control .amount-range { width:100%; min-width:44px; min-height:44px; border:0; background:transparent; color:#f5f1e8; font-size:clamp(12px,.85cqw,17px); font-weight:850; text-align:center; }
	.reel-console .reel-bet-control select { text-align-last:center; }
	.reel-console .reel-bet-control .amount-range { display:grid; grid-template-columns:1fr; align-items:center; }
	.reel-console .reel-bet-control input[data-testid='base-amount'] { width:100%; min-height:44px; margin:0; }
	.reel-console .reel-bet-control output { color:#f5f1e8; font-weight:850; }

	.bet-step {
		display:grid;
		width:44px;
		height:44px;
		min-width:44px;
		min-height:44px;
		place-items:center;
		align-self:center;
		border:1px solid #777d7b;
		border-radius:8px;
		background:linear-gradient(180deg,#252b2c,#070a0b);
		box-shadow:inset 0 0 0 2px #050707,0 3px 9px rgba(0,0,0,.55);
		color:#eee6d5;
		cursor:pointer;
	}
	.bet-step-minus { grid-column:1; grid-row:1; }
	.bet-step-plus { grid-column:3; grid-row:1; }
	.bet-step:hover:not(:disabled), .bet-step:focus-visible { border-color:#d3a650; color:#ffd989; outline:none; }
	.bet-step:disabled { opacity:.42; cursor:not-allowed; }

	.control-meter strong,
	.balance-meter strong { overflow:hidden; color:#f6f3eb; font-size:clamp(12px,.82cqw,17px); font-weight:850; text-overflow:ellipsis; white-space:nowrap; }
	.total-meter { grid-column:4; grid-row:1; border-color:rgba(139,115,74,.7); }
	.total-meter strong { color:#e6bd6b; }
	.win-meter { grid-column:5; grid-row:1; border-color:rgba(139,115,74,.7); }
	.win-meter strong { color:#fff0bd; font-size:clamp(14px,1cqw,20px); }

	.reel-console .reel-spin {
		position:relative;
		grid-column:6;
		grid-row:1;
		display:grid;
		width:clamp(82px,7.6cqw,112px);
		height:clamp(82px,7.6cqw,112px);
		min-width:82px;
		min-height:82px;
		place-items:center;
		align-self:center;
		justify-self:center;
		gap:0;
		padding:7px;
		border:1px solid #b7c0bd;
		border-radius:50%;
		background:
			radial-gradient(circle at 38% 30%, #f6f8f5 0 5%, #8c999b 16%, #182023 40%, #050809 61%, #253136 65%, #070a0b 72%);
		box-shadow:inset 0 0 0 4px #030506,inset 0 0 0 6px #829096,inset 0 0 18px rgba(72,207,240,.2),0 0 0 3px #111719,0 8px 22px rgba(0,0,0,.65),0 0 18px rgba(43,190,232,.2);
		color:#edf9fb;
		cursor:pointer;
	}
	.reel-console .reel-spin::after { position:absolute; inset:9px; border:1px solid rgba(105,211,240,.5); border-radius:50%; content:''; box-shadow:inset 0 0 12px rgba(55,196,235,.12); }
	.reel-console .reel-spin .spin-ring { position:relative; z-index:2; display:grid; place-items:center; }
	.reel-console .reel-spin small { position:absolute; z-index:3; right:3px; bottom:-13px; left:3px; overflow:hidden; color:#f0d38f; font-size:6px; font-weight:900; letter-spacing:.08em; text-align:center; text-overflow:ellipsis; white-space:nowrap; }
	.reel-console .reel-spin:hover:not(:disabled), .reel-console .reel-spin:focus-visible { color:#fff; box-shadow:inset 0 0 0 4px #030506,inset 0 0 0 6px #d2d9d5,inset 0 0 20px rgba(79,220,255,.3),0 0 0 3px #111719,0 8px 22px rgba(0,0,0,.65),0 0 28px rgba(65,205,241,.46); outline:none; transform:scale(1.025); }
	.reel-console .reel-spin:disabled { border-color:#374144; background:radial-gradient(circle,#273134,#06090a 68%); color:#677579; box-shadow:inset 0 0 0 4px #030506,inset 0 0 0 6px #263034,0 0 0 3px #111719; cursor:not-allowed; }
	.reel-console .reel-spin.feature-action { color:#ffe1a2; box-shadow:inset 0 0 0 4px #030506,inset 0 0 0 6px #d39b40,0 0 0 3px #111719,0 0 26px rgba(224,53,42,.42); }

	.secondary-deck { display:contents; }
	.breach-monitor .secondary-mode-list { grid-column:1; grid-row:2; display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:4px; }
	.breach-monitor .secondary-mode-list button {
		display:flex;
		align-items:center;
		justify-content:space-between;
		min-width:44px;
		min-height:44px;
		gap:4px;
		padding:4px 7px;
		border:1px solid rgba(101,113,111,.48);
		background:linear-gradient(180deg,#1b2223,#06090a);
		color:#a5b0ae;
		font-size:8px;
		font-weight:800;
		letter-spacing:.05em;
		cursor:pointer;
	}
	.breach-monitor .secondary-mode-list button strong { color:#e9bd66; font-size:1.08em; }
	.breach-monitor .secondary-mode-list button.selected { border-color:#c93b34; background:linear-gradient(180deg,#57211e,#150807); color:#f4e3dc; box-shadow:inset 3px 0 #e04a40; }
	.balance-meter { grid-column:2; grid-row:2; min-height:44px; padding:4px 9px; text-align:center; }
	.secondary-deck .info-action { grid-column:3; grid-row:2; min-width:44px; min-height:44px; padding:5px; border:1px solid rgba(151,124,74,.62); background:linear-gradient(180deg,#24231d,#080807); color:#e2c47f; font-size:8px; font-weight:900; letter-spacing:.1em; cursor:pointer; }
	.secondary-deck .info-action:hover, .secondary-deck .info-action:focus-visible { border-color:#e0b75c; color:#ffe6a7; outline:none; }

	.reel-footer {
		position:relative;
		z-index:3;
		display:flex;
		align-items:center;
		justify-content:space-between;
		min-width:0;
		gap:8px;
		padding:3px 12px;
		border-top:1px solid rgba(158,119,60,.38);
		background:#030607;
		color:#73817f;
		font-size:7px;
		letter-spacing:.05em;
	}
	.reel-footer span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
	.reel-footer strong { flex:none; color:#cbb27b; font-size:inherit; }
	.session-readouts { display:flex; align-items:center; gap:4px; margin-left:auto; }
	.session-readout { display:flex; align-items:center; min-width:0; gap:3px; padding:2px 4px; border:1px solid rgba(95,106,104,.5); background:#080d0e; }
	.session-readout small { color:#71817f; font-size:inherit; }
	.session-readout strong { color:#e4e6df; }

	.monitor-glass { position:absolute; z-index:20; inset:0; background:linear-gradient(112deg,rgba(255,255,255,.025),transparent 24% 73%,rgba(255,255,255,.018)); pointer-events:none; }
	.reel-error-status { position:absolute; z-index:30; inset:0; display:block; background:rgba(0,0,0,.62); backdrop-filter:blur(4px); }
	.reel-error-status .launch-card.error { position:absolute; top:50%; left:50%; width:min(440px,calc(100% - 30px)); max-height:76%; padding:18px; border:1px solid #c13d36; background:linear-gradient(180deg,rgba(78,18,16,.98),rgba(18,5,5,.98)); transform:translate(-50%,-50%); }
	.reel-error-status button { min-height:44px; }

	.modal-backdrop {
		position:fixed;
		z-index:100;
		inset:0;
		display:grid;
		place-items:center;
		padding:
			max(clamp(8px,3vw,34px), env(safe-area-inset-top))
			max(clamp(8px,3vw,34px), env(safe-area-inset-right))
			max(clamp(8px,3vw,34px), env(safe-area-inset-bottom))
			max(clamp(8px,3vw,34px), env(safe-area-inset-left));
		background:rgba(0,0,0,.78);
		backdrop-filter:blur(7px);
	}
	.confirmation-dialog,
	.rules-dialog,
	.settings-dialog,
	.auto-dialog,
	.menu-dialog { width:min(940px,100%); max-height:min(86vh,820px); overflow:hidden; border:1px solid #a57c3d; border-radius:4px; background:linear-gradient(160deg,#161d1e,#050809 54%,#100909); box-shadow:0 30px 90px rgba(0,0,0,.85),inset 0 0 0 3px #06090a,inset 0 0 0 4px rgba(117,127,125,.4); color:#ede9df; }
	.confirmation-dialog { display:grid; width:min(520px,100%); padding:0; text-align:center; }
	.confirmation-scroll { display:grid; min-height:0; gap:14px; padding:clamp(20px,4vw,38px); overflow:auto; overscroll-behavior:contain; }
	.confirmation-scroll > span,
	.rules-dialog header span,
	.settings-dialog header span,
	.auto-dialog header span,
	.menu-dialog header span { color:#c79d51; font-size:9px; font-weight:900; letter-spacing:.18em; }
	.confirmation-dialog h2,
	.rules-dialog h2,
	.settings-dialog h2,
	.auto-dialog h2,
	.menu-dialog h2 { margin:5px 0 0; color:#f5f1e8; font-size:clamp(23px,3vw,36px); letter-spacing:-.02em; }
	.confirmation-scroll > strong { display:block; margin:20px 0; color:#f0c873; font-size:clamp(32px,5vw,52px); }
	.modal-actions { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
	.modal-actions button { min-height:48px; border:1px solid #6e7775; background:#121819; color:#d7ddda; font-weight:900; letter-spacing:.09em; }
	.modal-actions .confirm-action { border-color:#d04a40; background:linear-gradient(180deg,#b23a32,#591713); color:#fff0e9; }
	.rules-dialog { display:grid; grid-template-rows:auto minmax(0,1fr); }
	.rules-dialog > header,
	.settings-dialog > header,
	.auto-dialog > header,
	.menu-dialog > header { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:16px clamp(16px,3vw,28px); border-bottom:1px solid rgba(167,126,61,.4); background:linear-gradient(180deg,#222929,#090d0e); }
	.rules-dialog > header button,
	.settings-dialog > header button,
	.auto-dialog > header button,
	.menu-dialog > header button { display:grid; min-width:44px; min-height:44px; place-items:center; border:1px solid #78807e; background:#0b0f10; color:#eee4ce; font-weight:900; }
	.rules-scroll { min-height:0; padding:clamp(14px,2.5vw,26px); overflow:auto; overscroll-behavior:contain; }
	.rules-scroll h3 { color:#e4c17a; font-size:13px; letter-spacing:.1em; }
	.rules-lead, .rules-scroll p { color:#adb7b4; line-height:1.55; }
	.rules-step-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:9px; }
	.rules-step-grid article { padding:12px; border:1px solid rgba(112,122,118,.4); background:rgba(7,12,13,.72); }
	.rules-step-grid em { display:grid; width:30px; height:30px; place-items:center; border:1px solid #a67a3d; border-radius:50%; color:#efc572; font-style:normal; font-weight:900; }
	.route-legend { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:9px; }
	.route-legend > div { padding:12px; border:1px solid rgba(150,112,59,.45); background:#080d0e; }
	.formula-strip { display:grid; gap:6px; margin-top:10px; padding:12px; border-left:3px solid #c53a32; background:rgba(57,15,13,.5); }
	.table-wrap { overflow:auto; }
	.rules-dialog table { width:100%; min-width:580px; border-collapse:collapse; }
	.rules-dialog th, .rules-dialog td { padding:9px; border-bottom:1px solid rgba(108,116,113,.26); text-align:left; }
	.rules-dialog th { color:#cbaa69; font-size:9px; letter-spacing:.09em; }
	.rules-dialog td { color:#c7cfcc; font-size:11px; }
	.rules-copy-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; }
	.rules-copy-grid > section { padding:12px; border:1px solid rgba(101,111,108,.35); background:rgba(6,10,11,.65); }
	.settings-dialog { width:min(520px,100%); }
	.settings-body { display:grid; gap:14px; padding:24px; }
	.settings-body > button { display:flex; align-items:center; justify-content:space-between; min-height:54px; gap:14px; padding:8px 14px; border:1px solid #6f7775; background:#0b1112; color:#dbe0dd; font-weight:850; }
	.settings-body > button span { display:flex; align-items:center; gap:10px; }
	.settings-body > button strong { color:#8b9996; }
	.settings-body > button.active { border-color:#c79a49; color:#f7deb0; box-shadow:inset 3px 0 #d1a14d; }
	.settings-body > button.active strong { color:#efc66f; }
	.settings-body p { margin:0; color:#96a29f; font-size:12px; line-height:1.55; }
	.auto-dialog { display:grid; width:min(540px,100%); grid-template-rows:auto minmax(0,1fr); }
	.auto-body { display:grid; min-height:0; gap:14px; padding:24px; overflow:auto; overscroll-behavior:contain; }
	.auto-body > p { margin:0; color:#aab4b1; font-size:12px; line-height:1.55; }
	.auto-options { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; }
	.auto-options button { display:grid; min-height:62px; place-items:center; align-content:center; gap:2px; border:1px solid #626c6a; background:linear-gradient(180deg,#1d2525,#080c0d); color:#e6e7df; font-size:20px; font-weight:900; }
	.auto-options button small { color:#85928f; font-size:7px; letter-spacing:.12em; }
	.auto-options button.selected { border-color:#d09e4a; background:linear-gradient(180deg,#46371e,#151006); color:#ffe3a4; box-shadow:inset 0 0 0 2px rgba(221,171,77,.15); }
	.auto-summary { display:flex; align-items:center; justify-content:space-between; min-height:52px; gap:12px; padding:9px 12px; border:1px solid rgba(137,126,103,.45); background:#080d0e; }
	.auto-summary span { color:#909d99; font-size:8px; font-weight:900; letter-spacing:.12em; }
	.auto-summary strong { color:#f1ca75; font-size:18px; }
	.auto-warning { color:#ef8b80 !important; }
	.auto-start { min-height:50px; border:1px solid #d94c42; background:linear-gradient(180deg,#bd4037,#651a16); color:#fff1e9; font-weight:900; letter-spacing:.1em; }
	.auto-start:disabled { border-color:#4d5856; background:#171e1e; color:#70807c; }
	.menu-dialog { width:min(520px,100%); }
	.menu-actions { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:9px; padding:24px; }
	.menu-actions button { display:grid; min-height:92px; place-items:center; align-content:center; gap:8px; border:1px solid #66716f; background:linear-gradient(180deg,#202828,#080c0d); color:#e8e5da; font-size:10px; font-weight:900; letter-spacing:.09em; }
	.menu-actions button:hover, .menu-actions button:focus-visible { border-color:#d1a14d; color:#ffe0a0; outline:none; box-shadow:inset 0 0 18px rgba(205,151,61,.12); }

	.turbo-enabled .reel-cell { transition-duration:80ms !important; }
	.turbo-enabled .reel-grid[data-spinning='true'] .symbol-art { animation-duration:180ms; }

	@keyframes reel-column-spin { 0%{transform:translateY(-12%) scaleY(1.05)} 50%{transform:translateY(12%) scaleY(.96)} 100%{transform:translateY(-12%) scaleY(1.05)} }

	@media (max-aspect-ratio: 5/4), (max-height: 560px) and (min-aspect-ratio: 2/1) {
		.operative-stage { display:none; }
		.breach-monitor { inset:8px; grid-template-rows:58px minmax(0,1fr) 22px; }
		.monitor-identity h1 { font-size:clamp(23px,5vw,36px); }
		.reel-console { grid-template-rows:32px minmax(0,1fr) 176px; gap:5px; padding:6px 8px; }
		.premium-hud { grid-template-columns:140px minmax(0,1fr) 140px; grid-template-rows:minmax(86px,1fr) 46px; gap:5px; }
		.round-tool { width:44px; height:50px; }
		.control-deck { grid-template-columns:44px minmax(78px,.9fr) 44px minmax(74px,.8fr) minmax(82px,.85fr) 84px; gap:4px; }
		.reel-console .reel-spin { width:82px; height:82px; min-width:82px; min-height:82px; }
		.breach-monitor .secondary-mode-list button { padding:4px; font-size:7px; }
		.reel-machine { width:min(100%, 820px); max-width:820px; height:auto; }
		.breach-monitor .reel-window { width:100%; height:auto; max-width:100%; max-height:100%; }
		.breach-monitor .reel-grid { width:100%; height:auto; }
		.reel-brief { width:min(86%,520px); }
	}

	@media (max-width: 620px) {
		.breach-monitor { inset:4px; grid-template-rows:48px minmax(0,1fr) 22px; border-radius:2px; }
		.monitor-header { padding:5px 9px; }
		.monitor-identity > span { display:none; }
		.monitor-identity h1 { font-size:clamp(19px,6vw,27px); }
		.lifecycle { min-width:84px; padding:4px 6px; }
		.lifecycle strong { font-size:7px; }
		.lifecycle small { display:none; }
		.reel-console { grid-template-rows:28px minmax(0,1fr) 220px; gap:4px; padding:4px; }
		.reel-mechanic-strip { gap:3px; }
		.reel-mechanic-strip > span { min-height:28px; padding:2px 3px; font-size:6px; letter-spacing:.03em; }
		.reel-stage { grid-template-rows:24px minmax(0,1fr) 30px; gap:3px; }
		.reel-stage-heading { padding-inline:20px; }
		.reel-stage-heading span { display:none; }
		.reel-stage-heading strong { font-size:7px; }
		.reel-stage-heading .phase-chip { padding:4px 6px; font-size:6px; }
		.reel-machine { grid-template-columns:20px minmax(0,1fr) 20px; width:100%; height:auto; align-self:center; }
		.line-gutter { height:100%; padding-block:4px; }
		.line-gutter span { width:18px; height:18px; font-size:7px; }
		.breach-monitor .reel-window { width:100%; max-width:520px; padding:4px; }
		.breach-monitor .reel-grid { gap:2px; padding:2px; }
		.breach-monitor .reel-cell .symbol-art { inset:2px 2px 11px; }
		.breach-monitor .reel-cell .symbol-code { font-size:6px; }
		.result-ticker { gap:6px; padding:3px 5px; font-size:6px; }
		.result-ticker::before { display:none; }
		.reel-brief { width:92%; padding:8px; }
		.reel-brief header { justify-content:center; padding-bottom:5px; }
		.reel-brief header span { display:none; }
		.reel-brief h2 { font-size:11px; }
		.reel-brief .field-brief-flow { gap:4px; margin-top:6px; }
		.reel-brief .field-brief-flow > div { grid-template-columns:1fr; grid-template-rows:auto auto; min-height:45px; padding:4px; text-align:center; }
		.reel-brief .field-brief-flow em { display:none; }
		.reel-brief .field-brief-flow strong { font-size:7px; }
		.reel-brief .field-brief-flow span { display:none; }

		.premium-hud { grid-template-columns:1fr 1fr; grid-template-rows:58px 68px 46px 44px; gap:3px; padding-top:0; }
		.hud-tools { grid-template-columns:repeat(3,minmax(0,1fr)); gap:3px; }
		.hud-tools-left { grid-column:1; grid-row:1; }
		.hud-tools-right { grid-column:2; grid-row:1; }
		.round-tool { width:44px; height:44px; min-width:44px; min-height:44px; }
		.round-tool span { display:none; }
		.control-deck { grid-column:1 / -1; grid-row:2; grid-template-columns:44px minmax(76px,.8fr) 44px minmax(70px,.72fr) minmax(72px,.74fr) 62px; grid-template-rows:68px; gap:3px; }
		.reel-console .reel-bet-control { padding:2px 3px; }
		.reel-console .reel-bet-control > span:first-child,
		.control-meter span,
		.balance-meter span { font-size:6px; letter-spacing:.06em; }
		.reel-console .reel-bet-control select,
		.reel-console .reel-bet-control .amount-range { font-size:10px; }
		.control-meter { padding:3px; }
		.control-meter strong { font-size:9px; }
		.win-meter strong { font-size:11px; }
		.reel-console .reel-spin { width:62px; height:62px; min-width:62px; min-height:62px; }
		.reel-console .reel-spin :global(.hud-icon) { width:34px; height:34px; }
		.reel-console .reel-spin small { display:none; }
		.secondary-deck { display:contents; }
		.breach-monitor .secondary-mode-list { grid-column:1 / -1; grid-row:3; }
		.balance-meter { grid-column:1; grid-row:4; }
		.secondary-deck .info-action { grid-column:2; grid-row:4; }
		.reel-footer > span:first-child { display:none; }
		.reel-footer { justify-content:center; padding:2px 5px; font-size:6px; }
		.rules-step-grid, .rules-copy-grid { grid-template-columns:1fr; }
		.route-legend { grid-template-columns:1fr; }
		.rules-dialog > header, .settings-dialog > header, .auto-dialog > header, .menu-dialog > header { padding:10px; }
		.rules-dialog h2, .settings-dialog h2, .auto-dialog h2, .menu-dialog h2 { font-size:20px; }
		.rules-scroll { padding:10px; }
	}

	@media (max-width: 390px) and (orientation: portrait) {
		.reel-console { grid-template-rows:28px minmax(0,1fr) 276px; }
		.premium-hud { grid-template-rows:58px 116px 46px 44px; }
		.control-deck {
			grid-template-columns:minmax(72px,.8fr) minmax(94px,1fr) 64px;
			grid-template-rows:48px 64px;
			gap:4px;
		}
		.bet-step-minus { grid-column:1; grid-row:1; justify-self:center; }
		.reel-console .reel-bet-control { grid-column:2; grid-row:1; }
		.bet-step-plus { grid-column:3; grid-row:1; justify-self:center; }
		.total-meter { grid-column:1; grid-row:2; }
		.win-meter { grid-column:2; grid-row:2; }
		.reel-console .reel-spin { grid-column:3; grid-row:2; width:62px; height:62px; min-width:62px; min-height:62px; }
		.menu-actions { gap:5px; padding:14px 10px; }
		.menu-actions button { min-height:82px; padding:6px 3px; font-size:8px; }
	}

	@media (max-width: 390px) and (max-height: 620px) and (orientation: portrait) {
		.reel-stage { overflow:hidden; }
		.reel-machine {
			grid-template-columns:20px minmax(0,1fr) 20px;
			width:min(100%, 276px);
			max-width:276px;
			height:auto;
		}
		.breach-monitor .reel-window {
			width:100%;
			height:auto;
			max-width:100%;
			max-height:100%;
			padding:3px;
		}
		.breach-monitor .reel-grid { width:100%; height:auto; }
		.line-gutter { height:100%; padding-block:0; }
		.line-gutter span { width:14px; height:14px; font-size:5px; }
	}

	@media (max-height: 560px) and (min-aspect-ratio: 2/1) {
		.breach-monitor { inset:3px; grid-template-rows:38px minmax(0,1fr) 18px; }
		.monitor-header { padding:3px 9px; }
		.monitor-identity > span { display:none; }
		.monitor-identity h1 { font-size:22px; }
		.lifecycle { min-width:84px; padding:2px 5px; }
		.lifecycle strong { font-size:7px; }
		.lifecycle small { display:none; }
		.reel-console { grid-template-rows:24px minmax(0,1fr) 94px; gap:3px; padding:3px 5px; }
		.reel-mechanic-strip > span { min-height:24px; font-size:6px; }
		.reel-stage { grid-template-rows:minmax(0,1fr) 24px; }
		.reel-stage-heading { display:none; }
		.reel-machine { grid-template-columns:22px minmax(0,1fr) 22px; width:min(100%,600px); height:100%; }
		.line-gutter { padding-block:0; }
		.line-gutter span { width:16px; height:16px; font-size:6px; }
		.breach-monitor .reel-window { width:auto; height:100%; aspect-ratio:5/3; padding:4px; }
		.breach-monitor .reel-grid { height:100%; aspect-ratio:5/3; }
		.breach-monitor .reel-cell .symbol-art { inset:1px 2px 9px; }
		.result-ticker { padding:2px 5px; font-size:6px; }
		.premium-hud { grid-template-columns:140px minmax(0,1fr) 140px; grid-template-rows:48px 44px; gap:3px; }
		.round-tool { width:44px; height:44px; min-width:44px; min-height:44px; }
		.round-tool span { display:none; }
		.control-deck { grid-template-columns:44px minmax(62px,.8fr) 44px minmax(57px,.7fr) minmax(57px,.72fr) 48px; grid-template-rows:48px; gap:3px; }
		.reel-console .reel-bet-control { padding:1px 3px; }
		.reel-console .reel-bet-control > span:first-child,
		.control-meter span { font-size:6px; }
		.reel-console .reel-bet-control select,
		.reel-console .reel-bet-control .amount-range { min-height:44px; font-size:9px; }
		.control-meter strong { font-size:6px; letter-spacing:-.05em; }
		.control-meter { padding:2px 3px; }
		.reel-console .reel-spin { width:48px; height:48px; min-width:48px; min-height:48px; }
		.reel-console .reel-spin :global(.hud-icon) { width:26px; height:26px; }
		.reel-console .reel-spin small { display:none; }
		.breach-monitor .secondary-mode-list { grid-column:1; grid-row:2; }
		.balance-meter { grid-column:2; grid-row:2; }
		.secondary-deck .info-action { grid-column:3; grid-row:2; }
		.reel-footer { font-size:5px; }
	}

	/* Performance guard: keep the final scene GPU-cheap inside embedded Stake iframes. */
	.app-shell::before {
		display: none !important;
		filter: none !important;
		transform: none !important;
	}

	.bunker-backdrop {
		filter: none;
		opacity: .58;
		transform: none;
	}

	.app-shell[data-phase='feature'] .scene-grade,
	.operative-halo {
		animation: none !important;
		filter: none !important;
	}

	.operative-stage {
		top: clamp(48px, 5vh, 82px);
		bottom: clamp(82px, 9vh, 118px);
		left: 0;
		width: clamp(620px, 52vw, 1000px);
		contain: layout style;
		overflow: visible;
	}

	.breach-monitor .reel-window {
		contain: layout paint style;
	}

	.operative-frame-shell {
		position: absolute;
		z-index: 2;
		inset: auto auto 0 0;
		width: 100%;
		height: auto;
		aspect-ratio: 5 / 4;
		contain: layout style;
		pointer-events: none;
	}

	.operative-frame {
		display: block;
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: contain;
		object-position: left bottom;
		opacity: 0;
		visibility: hidden;
		transform: none !important;
		transition: none !important;
		animation: none !important;
		pointer-events: none;
	}

	.operative-idle-film {
		display: block;
		position: absolute;
		z-index: 1;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: contain;
		object-position: left bottom;
		opacity: 0;
		visibility: hidden;
		pointer-events: none;
	}

	.operative-frame-shell.operative-idle-film-active .operative-idle-film {
		opacity: 1;
		visibility: visible;
	}

	.operative-frame-shell.operative-idle-film-active .operative-frame {
		opacity: 0;
		visibility: hidden;
	}

	.operative-frame.operative-frame-active {
		opacity: 1;
		visibility: visible;
	}

	.operative-stage[data-sequence='bonus'],
	.operative-stage[data-sequence='rage'] {
		z-index: 5;
	}

	.standalone-fx-layer {
		position: absolute;
		z-index: 3;
		inset: auto auto 0 0;
		width: 100%;
		aspect-ratio: 5 / 4;
		contain: layout style;
		pointer-events: none;
	}

	.standalone-fx-layer[data-active='false'] {
		display: none;
	}

	.standalone-fx-frame {
		display: block;
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: contain;
		object-position: left bottom;
		opacity: 0;
		visibility: hidden;
		animation: none;
		filter: none;
		transform: none;
		pointer-events: none;
	}

	.standalone-fx-frame.standalone-fx-frame-active {
		opacity: 1;
		visibility: visible;
	}

	.standalone-fx-layer.standalone-fx-crate {
		left: clamp(250px, 37%, 430px);
		bottom: 26%;
		width: clamp(132px, 24%, 230px);
		aspect-ratio: 1;
	}

	.standalone-fx-crate .standalone-fx-frame {
		object-position: center;
	}

	.operative-halo {
		right: 58%;
	}

	.operative-readout {
		right: auto;
		left: clamp(28px, 5%, 62px);
		width: min(320px, 34%);
	}

	.operative-floor-light {
		right: 62%;
		left: 4%;
		filter: none;
	}

	.app-shell[data-operator-reaction] .breach-monitor {
		animation: none !important;
	}

	.monitor-glass {
		mix-blend-mode: normal;
	}

	.breach-monitor .reel-cell .symbol-art,
	.breach-monitor .reel-cell .symbol-art img,
	.breach-monitor .reel-grid[data-has-win='true'] .reel-cell:not(.line-active),
	.payline-overlay img {
		filter: none !important;
	}

	.breach-monitor .reel-grid[data-spinning='true'] {
		position: relative;
		isolation: isolate;
		animation: reel-grid-spin 420ms ease-in-out infinite;
		will-change: transform, opacity;
	}

	.breach-monitor .reel-grid[data-spinning='true']::after {
		position: absolute;
		z-index: 20;
		inset: -42% 0;
		background: repeating-linear-gradient(
			180deg,
			transparent 0 13px,
			rgba(103, 218, 230, .08) 14px 16px,
			transparent 17px 31px,
			rgba(227, 179, 83, .06) 32px 34px
		);
		content: '';
		pointer-events: none;
		animation: reel-motion-streak 420ms linear infinite;
		will-change: transform, opacity;
	}

	.breach-monitor .reel-grid .reel-cell .symbol-art {
		animation: none !important;
		filter: none !important;
		will-change: auto;
	}

	.breach-monitor .reel-grid[data-spinning='false'] {
		animation: none !important;
		will-change: auto;
	}

	.turbo-enabled .reel-grid[data-spinning='true'],
	.turbo-enabled .reel-grid[data-spinning='true']::after {
		animation-duration: 180ms;
	}

	.reel-error-status,
	.modal-backdrop {
		backdrop-filter: none;
	}

	@keyframes reel-grid-spin {
		0%, 100% { opacity: .82; transform: translate3d(0, -2px, 0); }
		50% { opacity: 1; transform: translate3d(0, 2px, 0); }
	}

	@keyframes reel-motion-streak {
		from { opacity: .5; transform: translate3d(0, -20%, 0); }
		to { opacity: .86; transform: translate3d(0, 20%, 0); }
	}

	@media (prefers-reduced-motion: reduce) {
		.operative-halo,
		.reel-grid[data-spinning='true'],
		.reel-grid[data-spinning='true']::after,
		.reel-grid[data-spinning='true'] .symbol-art,
		.payline-overlay img { animation:none !important; }
		.operative-frame,
		.reel-cell,
		.reel-spin { transition:none !important; }
	}

	@keyframes dev-operative-presence {
		0%, 100% { transform: translate3d(0, 0, 0) scale3d(1, 1, 1); }
		25% { transform: translate3d(-0.018%, -0.06%, 0) scale3d(1.0005, 1.0008, 1); }
		50% { transform: translate3d(0.012%, -0.14%, 0) scale3d(1.001, 1.0015, 1); }
		75% { transform: translate3d(0.02%, -0.065%, 0) scale3d(1.0005, 1.0009, 1); }
	}

	.app-shell[data-launch-kind='fixture'] .operative-stage[data-sequence='idle'] .operative-frame-shell {
		animation: dev-operative-presence 3.2s linear infinite !important;
		contain: layout paint style;
		transform-origin: 32% 88%;
		will-change: transform;
	}

	/* The browser composites these time-based effects once per display refresh.
	   Higher-Hz monitors therefore receive more visual samples without changing
	   any gameplay, reel-settle or presentation duration. */
	.app-shell[data-launch-kind='fixture'] .reel-spin-column-layer,
	.app-shell[data-launch-kind='fixture'] .vault-opening-sequence,
	.app-shell[data-launch-kind='fixture'] .standalone-fx-frame,
	.app-shell[data-launch-kind='fixture'] .payline-overlay img {
		backface-visibility: hidden;
		transform-style: preserve-3d;
	}

	.app-shell[data-launch-kind='fixture'][data-render-quality='balanced'] .scene-grade,
	.app-shell[data-launch-kind='fixture'][data-render-quality='reduced'] .scene-grade {
		filter: none !important;
	}

	.app-shell[data-launch-kind='fixture'][data-render-quality='reduced'] .reel-column-window::after,
	.app-shell[data-launch-kind='fixture'][data-render-quality='reduced'] .symbol-art::after {
		display: none !important;
	}

	.app-shell[data-launch-kind='fixture'] .reel-cell {
		transition-property: opacity, transform !important;
	}

	@media (prefers-reduced-motion: reduce) {
		.app-shell[data-launch-kind='fixture'] .operative-stage[data-sequence='idle'] .operative-frame-shell {
			animation: none !important;
			transform: none !important;
			will-change: auto !important;
		}
	}

	/* M7: three clear zones — slim header, dominant reels, one compact control bar. */
	.breach-monitor .reel-grid[data-spinning='true'],
	.turbo-enabled .reel-grid[data-spinning='true'] {
		opacity: 1;
		animation: none !important;
		transform: none !important;
		will-change: auto;
	}

	.breach-monitor .reel-grid[data-spinning='true']::after {
		display: none;
		animation: none !important;
	}

	.board-frame :global(.reel-spin-overlay) {
		inset: 7px;
		border-radius: 2px;
	}

	@media (min-width: 1041px) and (min-aspect-ratio: 4/3) {
		.breach-monitor {
			top: 8px;
			right: 8px;
			bottom: 8px;
			left: clamp(250px, 22vw, 430px);
			grid-template-rows: 56px minmax(0, 1fr) 18px;
		}

		.monitor-header {
			gap: 12px;
			padding: 6px 14px;
		}

		.monitor-identity {
			gap: 0;
		}

		.monitor-identity > span {
			display: none;
		}

		.monitor-identity h1 {
			font-size: clamp(25px, 2.25vw, 38px);
			line-height: 1;
		}

		.lifecycle {
			min-width: 102px;
			padding: 5px 8px;
		}

		.lifecycle small {
			display: none;
		}

		.reel-console {
			grid-template-rows: 26px minmax(0, 1fr) 128px;
			gap: 4px;
			padding: 6px 8px;
		}

		.reel-mechanic-strip:not(.feature-strip) {
			display: grid;
			grid-template-columns: repeat(4, minmax(0, 1fr));
			gap: 4px;
			padding: 0;
			border: 0;
			background: transparent;
		}

		.reel-mechanic-strip.feature-strip {
			grid-template-columns: repeat(3, minmax(0, 1fr));
			gap: 4px;
		}

		.reel-mechanic-strip > span {
			min-height: 26px;
			gap: 4px;
			padding: 2px 7px;
			border-color: rgba(140, 115, 72, .34);
			background: rgba(6, 11, 12, .82);
			font-size: clamp(7px, .54cqw, 10px);
			letter-spacing: .07em;
		}

		.reel-mechanic-strip:not(.feature-strip) > span {
			min-height: 26px;
			padding: 2px 7px;
			border: 1px solid rgba(140, 115, 72, .38);
			background: linear-gradient(180deg, rgba(24, 31, 32, .94), rgba(4, 9, 11, .96));
			box-shadow: inset 0 1px rgba(255, 228, 170, .035);
			white-space: nowrap;
		}

		.reel-mechanic-strip:not(.feature-strip) > span + span {
			padding-left: 7px;
		}

		.reel-mechanic-strip .running-win-state {
			border-color: rgba(202, 157, 76, .62);
			background: linear-gradient(180deg, rgba(43, 34, 18, .94), rgba(8, 9, 7, .96));
		}

		.reel-mechanic-strip .running-win-state strong {
			color: #ffe08d;
			font-size: 1.18em;
		}

		.reel-stage {
			grid-template-rows: 24px minmax(0, 1fr) 28px;
			gap: 3px;
		}

		.reel-stage-heading {
			padding-inline: 28px;
		}

		.reel-stage-heading span {
			display: none;
		}

		.reel-stage-heading strong {
			font-size: clamp(8px, .62cqw, 11px);
		}

		.reel-stage-heading .phase-chip {
			padding: 3px 8px;
			font-size: 7px;
		}

		.reel-machine {
			grid-template-columns: 28px minmax(0, 1fr) 28px;
			width: min(100%, calc(166.667cqh - 454px));
			max-width: 1120px;
		}

		.line-gutter {
			padding-block: 3px;
		}

		.line-gutter span {
			width: 22px;
			height: 22px;
			font-size: 8px;
		}

		.breach-monitor .reel-window {
			width: 100%;
			height: auto;
			max-width: 1064px;
			max-height: 100%;
		}

		.result-ticker {
			min-height: 28px;
			gap: 12px;
			padding: 3px 10px;
			font-size: clamp(7px, .58cqw, 10px);
		}

		.result-ticker::before {
			display: none;
		}

		.premium-hud {
			grid-template-columns: 144px minmax(0, 1fr) 144px;
			grid-template-rows: 78px 44px;
			gap: 3px 6px;
			padding: 0;
		}

		.hud-tools {
			grid-template-columns: repeat(3, 44px);
			gap: 4px;
		}

		.round-tool {
			width: 44px;
			height: 52px;
			min-width: 44px;
			min-height: 44px;
			padding: 3px;
		}

		.round-tool span {
			font-size: 6px;
		}

		.control-deck {
			grid-template-columns: minmax(88px, 1.05fr) 44px minmax(74px, .8fr) 44px clamp(76px, 7cqw, 92px) minmax(78px, .9fr) minmax(78px, .9fr);
			grid-template-rows: 78px;
			gap: 4px;
		}

		.control-deck .balance-meter {
			grid-column: 1;
			grid-row: 1;
			min-height: 0;
			padding: 5px 7px;
			text-align: center;
		}

		.bet-step-minus { grid-column: 2; }
		.reel-console .reel-bet-control { grid-column: 3; padding: 4px; }
		.bet-step-plus { grid-column: 4; }
		.reel-console .reel-spin { grid-column: 5; width: 76px; height: 76px; min-width: 76px; min-height: 76px; }
		.win-meter { grid-column: 6; }
		.total-meter { grid-column: 7; }

		.control-meter,
		.control-deck .balance-meter {
			min-width: 0;
		}

		.control-meter span,
		.control-deck .balance-meter span,
		.reel-console .reel-bet-control > span:first-child {
			font-size: 7px;
			letter-spacing: .1em;
		}

		.control-meter strong,
		.control-deck .balance-meter strong,
		.reel-console .reel-bet-control select,
		.reel-console .reel-bet-control .amount-range {
			font-size: clamp(10px, .84cqw, 15px);
		}

		.breach-monitor .secondary-mode-list {
			grid-column: 2;
			grid-row: 2;
			gap: 3px;
		}

		.breach-monitor .secondary-mode-list button {
			display: flex;
			min-height: 44px;
			padding: 2px 8px;
			font-size: 7px;
		}

		.secondary-deck .info-action {
			display: none;
		}

		.reel-footer {
			padding: 2px 10px;
			font-size: 6px;
		}
	}

	/* M8 exact-reference desktop artboard. The opaque raster plate owns every
	   physical surface; live DOM is limited to authoritative content and controls. */
	.premium-machine-shell,
	.premium-control-art {
		display: none;
	}

	.mode-dialog-list {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 14px;
		padding: 18px;
	}

	.mode-dialog {
		width: min(820px, calc(100vw - 32px));
		max-width: 820px;
	}

	.mode-dialog-list button {
		position: relative;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		grid-template-rows: auto minmax(0, 1fr);
		min-height: 164px;
		align-content: start;
		gap: 12px;
		padding: 22px 68px 20px 20px;
		border: 1px solid rgba(184, 137, 66, .5);
		background: linear-gradient(180deg, #172022, #070a0b);
		color: #eee9df;
		text-align: left;
	}

	.mode-dialog-list button.selected {
		border-color: #e3b05c;
		box-shadow: inset 4px 0 #c83b31, 0 0 20px rgba(202, 59, 49, .2);
	}

	.mode-dialog-list button span {
		grid-column: 1;
		grid-row: 1;
		font-size: 16px;
		font-weight: 900;
		letter-spacing: .09em;
	}
	.mode-dialog-list button small {
		grid-column: 1;
		grid-row: 2;
		color: #aab3b2;
		font-size: 12px;
		line-height: 1.5;
	}
	.mode-dialog-list button strong {
		position: absolute;
		top: 20px;
		right: 18px;
		color: #f0c66e;
		font-size: 24px;
	}

	@media (max-width: 700px) {
		.mode-dialog { max-height: calc(100dvh - 24px); overflow: auto; }
		.mode-dialog-list { grid-template-columns: 1fr; gap: 8px; padding: 10px; }
		.mode-dialog-list button { min-height: 104px; gap: 6px; padding: 14px 58px 12px 14px; }
		.mode-dialog-list button span { font-size: 13px; }
		.mode-dialog-list button small { font-size: 10px; line-height: 1.35; }
		.mode-dialog-list button strong { top: 14px; right: 14px; font-size: 20px; }
	}

	@media (min-aspect-ratio: 5/4) {
		.scene-world {
			inset: 50% auto auto 50%;
			width: min(100vw, calc(100vh * 1672 / 941));
			height: auto;
			aspect-ratio: 1672 / 941;
			transform: translate(-50%, -50%);
			background: #020303;
		}

		.bunker-backdrop,
		.scene-grade { display: none; }

		.premium-machine-shell {
			position: absolute;
			z-index: 0;
			inset: 0;
			display: block;
			width: 100%;
			height: 100%;
			max-width: none;
			object-fit: fill;
			pointer-events: none;
			user-select: none;
		}

		.operative-stage {
			z-index: 2;
			top: 13.603%;
			bottom: auto;
			left: 3.05%;
			width: 51.914%;
			height: 72.264%;
			min-height: 0;
			contain: layout style;
		}

		.operative-frame-shell,
		.standalone-fx-layer {
			inset: 0;
			width: 100%;
			height: 100%;
			aspect-ratio: auto;
		}

		.operative-frame,
		.operative-idle-film,
		.standalone-fx-frame {
			object-fit: fill;
			object-position: center;
		}

		.operative-halo,
		.operative-floor-light,
		.operative-readout { display: none; }

		.standalone-fx-layer.standalone-fx-crate {
			left: 0;
			bottom: 0;
			width: 100%;
			height: 100%;
			aspect-ratio: auto;
		}

		.breach-monitor {
			position: absolute;
			z-index: 3;
			inset: 0;
			display: block;
			width: 100%;
			height: 100%;
			overflow: visible;
			border: 0;
			border-radius: 0;
			background: transparent;
			box-shadow: none;
			container-type: size;
		}

		.breach-monitor::before,
		.breach-monitor::after,
		.monitor-glass { display: none; }

		.monitor-header {
			position: absolute;
			z-index: 5;
			top: 8.077%;
			left: 29.964%;
			display: flex;
			width: 61.304%;
			height: 7.864%;
			padding: .85% 1.15%;
			border: 0;
			background: transparent;
			box-shadow: none;
		}

		.monitor-identity > span {
			display: block;
			font-size: clamp(6px, .52cqw, 9px);
			letter-spacing: .13em;
		}

		.monitor-identity h1 {
			font-size: clamp(25px, 1.98cqw, 33px);
			line-height: .95;
		}

		.lifecycle {
			display: grid;
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: auto auto;
			width: 140px;
			min-width: 140px;
			min-height: 44px;
			align-content: center;
			justify-items: start;
			gap: 2px;
			padding: 6px 12px;
			border: 0;
			background: transparent;
		}

		.lifecycle .pulse { display: none; }
		.lifecycle small {
			display: block;
			grid-column: 1;
			grid-row: 1;
			white-space: nowrap;
			color: #8e9796;
			font-size: clamp(6px, .46cqw, 8px);
			letter-spacing: .08em;
			line-height: 1.05;
		}
		.lifecycle strong {
			grid-column: 1;
			grid-row: 2;
			white-space: nowrap;
			font-size: clamp(9px, .72cqw, 12px);
			line-height: 1.05;
		}

		.reel-console {
			position: absolute;
			z-index: 4;
			inset: 0;
			display: block;
			padding: 0;
			overflow: visible;
			background: transparent;
		}

		.reel-mechanic-strip,
		.reel-mechanic-strip:not(.feature-strip),
		.reel-mechanic-strip.feature-strip {
			position: absolute;
			z-index: 6;
			top: 16.366%;
			left: 30.682%;
			display: grid;
			width: 59.928%;
			height: 3.188%;
			grid-template-columns: repeat(4, minmax(0, 1fr));
			gap: .32%;
			padding: 0;
			border: 0;
			background: transparent;
		}

		.reel-mechanic-strip.feature-strip {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}

		.reel-mechanic-strip > span,
		.reel-mechanic-strip:not(.feature-strip) > span {
			min-height: 0;
			height: 100%;
			padding: 0 8px;
			border: 0;
			background: transparent;
			box-shadow: none;
			font-size: clamp(6px, .45cqw, 9px);
			letter-spacing: .08em;
		}

		.reel-stage {
			position: absolute;
			z-index: 5;
			inset: 0;
			display: block;
		}

		.reel-stage-heading { display: none; }

		.reel-machine {
			position: absolute;
			top: 20.723%;
			left: 30.801%;
			display: block;
			width: 58.852%;
			height: 46.121%;
			max-width: none;
			margin: 0;
		}

		.line-gutter {
			position: absolute;
			top: 6.682%;
			display: flex;
			width: 4.065%;
			height: 79.954%;
			flex-direction: column;
			align-items: center;
			justify-content: space-between;
			padding: 0;
		}

		.line-gutter-left { left: 0; }
		.line-gutter-right { right: 0; }

		.line-gutter span {
			width: 100%;
			height: 8.357%;
			border: 0;
			border-radius: 0;
			background: transparent;
			box-shadow: none;
			font-size: clamp(7px, .6cqw, 11px);
		}

		.line-gutter span.active {
			color: #ffd77b;
			text-shadow: 0 0 8px rgba(255, 186, 53, .8);
		}

		.breach-monitor .reel-window {
			position: absolute;
			top: 0;
			left: 6.707%;
			width: 86.28%;
			height: 100%;
			max-width: none;
			max-height: none;
			padding: 2.238% 2.473% 1.884% 2.709%;
			overflow: hidden;
			border: 0;
			border-radius: 0;
			background: transparent;
			box-shadow: none;
			contain: layout paint style;
		}

		.breach-monitor .reel-grid {
			width: 100%;
			height: 100%;
			grid-template-columns: repeat(5, minmax(0, 1fr));
			grid-template-rows: repeat(3, minmax(0, 1fr));
			gap: 5px;
			padding: 0;
			background: transparent;
		}

		.breach-monitor .reel-cell {
			min-width: 0;
			min-height: 0;
			border: 0;
			border-radius: 0;
			background: transparent;
			box-shadow: none;
		}

		.breach-monitor .reel-cell::before { display: none; }

		.breach-monitor .reel-cell .symbol-art {
			inset: 5px 8px 19px;
			display: grid;
			place-items: center;
		}

		.breach-monitor .reel-cell .symbol-art img {
			position: static;
			width: 100%;
			height: 100%;
			max-width: 100%;
			max-height: 100%;
			object-fit: contain;
		}

		.breach-monitor .reel-cell .symbol-code {
			bottom: 4px;
			font-size: clamp(6px, .48cqw, 9px);
			letter-spacing: .08em;
		}

		.breach-monitor .reel-cell.line-active {
			border: 1px solid #ffd66b;
			background: rgba(255, 188, 45, .06);
			box-shadow: inset 0 0 18px rgba(255, 196, 53, .22);
			transform: none;
		}

		.payline-overlay,
		.board-frame :global(.reel-spin-overlay) {
			inset: 4.378% 2.473% 3.687% 2.709%;
			border-radius: 0;
		}

		.result-ticker {
			position: absolute;
			z-index: 7;
			top: 66.95%;
			left: 30.622%;
			width: 58.493%;
			height: 4.463%;
			min-height: 0;
			gap: 18px;
			padding: 0 50px;
			border: 0;
			background: transparent;
			box-shadow: none;
			font-size: clamp(7px, .65cqw, 11px);
		}

		.result-ticker::before { display: none; }

		.premium-hud {
			position: absolute;
			z-index: 8;
			top: 75.027%;
			left: 21.95%;
			display: block;
			width: 75.538%;
			height: 23.379%;
			padding: 0;
			background: transparent;
		}

		.hud-tools {
			position: absolute;
			top: 7.273%;
			display: block;
			height: 50%;
		}

		.hud-tools-left { left: 3.088%; width: 22.803%; }
		.hud-tools-right { left: 77.118%; width: 19.16%; }

		.hud-tools .round-tool,
		.control-deck .bet-step,
		.control-deck .reel-spin {
			position: absolute;
			min-width: 44px;
			min-height: 44px;
			padding: 0;
			overflow: visible;
			border: 0;
			border-radius: 0;
			background: transparent;
			box-shadow: none;
		}

		.hud-tools .round-tool > :global(.hud-icon),
		.control-deck .bet-step > :global(.hud-icon),
		.control-deck .reel-spin > :global(.hud-icon) {
			position: absolute;
			z-index: 2;
			inset: 0;
			display: block;
			width: 100%;
			height: 100%;
		}

		.hud-tools .round-tool > span,
		.control-deck .reel-spin .spin-ring,
		.control-deck .reel-spin small { display: none; }

		.hud-tools-left .round-tool:nth-child(1) { top: 0; left: 0; width: 28.125%; height: 100%; }
		.hud-tools-left .round-tool:nth-child(2) { top: 0; left: 28.125%; width: 35.069%; height: 100%; }
		.hud-tools-left .round-tool:nth-child(3) { top: 0; left: 63.194%; width: 36.806%; height: 100%; }

		.hud-tools-right .round-tool:nth-child(1) { top: 0; left: 0; width: 39.256%; height: 100%; }
		.hud-tools-right .round-tool:nth-child(2) { top: 0; left: 39.256%; width: 34.298%; height: 100%; }
		.hud-tools-right .round-tool:nth-child(3) { top: 0; left: 73.554%; width: 37.603%; height: 100%; }

		.control-deck {
			position: absolute;
			inset: 0;
			display: block;
			pointer-events: none;
		}

		.control-deck .bet-step,
		.control-deck .reel-bet-control,
		.control-deck .reel-spin {
			pointer-events: auto;
		}

		.bet-step-minus { top: 12.273%; left: 26.445%; width: 4.909%; height: 28.636%; }
		.bet-step-plus { top: 12.273%; left: 40.302%; width: 4.909%; height: 28.636%; }

		.reel-console .reel-bet-control {
			position: absolute;
			top: 8.636%;
			left: 31.987%;
			display: grid;
			width: 7.601%;
			height: 35%;
			place-content: center;
			gap: 4px;
			padding: 6px;
			border: 0;
			background: transparent;
			box-shadow: none;
		}

		.reel-console .reel-bet-control > span:first-child {
			display: block;
			font-size: clamp(7px, .62cqw, 11px);
			letter-spacing: .1em;
		}

		.reel-console .reel-bet-control select,
		.reel-console .reel-bet-control .amount-range {
			min-height: 44px;
			border: 0;
			background: transparent;
			font-size: clamp(11px, .96cqw, 16px);
			text-align: center;
		}

		.reel-console .reel-bet-control select {
			appearance: none;
			padding: 0 4px;
			text-align-last: center;
		}

		.control-meter {
			position: absolute;
			top: 7.273%;
			height: 50%;
			min-width: 0;
			padding: 15px 9px 8px;
			border: 0;
			background: transparent;
			box-shadow: none;
			text-align: center;
		}

		.total-meter { left: 46.081%; width: 8.709%; }
		.win-meter { left: 54.79%; width: 10.372%; }

		.control-meter span { font-size: clamp(7px, .58cqw, 10px); }
		.control-meter strong { font-size: clamp(13px, 1.25cqw, 21px); }

		.control-deck .balance-meter {
			position: absolute;
			top: 65%;
			left: 4.751%;
			display: grid;
			width: 13.935%;
			height: 24.091%;
			place-content: center start;
			gap: 4px;
			padding: 0 12px;
			border: 0;
			background: transparent;
			box-shadow: none;
			text-align: left;
		}

		.control-deck .balance-meter span { font-size: clamp(7px, .62cqw, 10px); }
		.control-deck .balance-meter strong { font-size: clamp(12px, 1.12cqw, 19px); }

		.reel-console .reel-spin {
			top: -6.364%;
			left: 64.925%;
			width: 12.51%;
			height: 70.455%;
		}

		.secondary-deck {
			position: absolute;
			inset: 0;
			display: block;
			pointer-events: none;
		}

		.secondary-deck .info-action {
			position: absolute;
			top: 65%;
			left: 84.165%;
			display: block;
			width: 13.935%;
			height: 20.455%;
			min-height: 44px;
			border: 0;
			background: transparent;
			box-shadow: none;
			color: #e4bd72;
			font-size: clamp(9px, .8cqw, 13px);
			letter-spacing: .08em;
			pointer-events: auto;
		}

		.reel-footer {
			position: absolute;
			z-index: 9;
			top: 88.523%;
			left: 22.488%;
			display: block;
			width: 73.983%;
			height: 8.927%;
			padding: 0;
			border: 0;
			background: transparent;
			font-size: clamp(7px, .6cqw, 10px);
			pointer-events: none;
		}

		.footer-guide,
		.reel-footer > strong { display: none; }

		.premium-footer-id,
		.premium-footer-clearance {
			position: absolute;
			top: 19.048%;
			display: grid;
			height: 63.095%;
			place-items: center;
			color: #9b9e9b;
			font-size: clamp(7px, .65cqw, 11px);
			letter-spacing: .05em;
		}

		.premium-footer-id { left: 24.576%; width: 17.057%; }
		.premium-footer-clearance { left: 47.938%; width: 18.351%; }

		.session-readouts {
			position: absolute;
			top: 18%;
			left: 67%;
			display: flex;
		}

		.reel-error-status {
			position: absolute;
			z-index: 30;
			top: 20%;
			left: 34%;
			width: 51%;
		}
	}

	/* Raster-first finish: every physical carrier comes from a production PNG.
	   Live DOM remains responsible only for authoritative values and accessible text. */
	.premium-panel-art,
	.premium-dialog-frame,
	.line-marker-art,
	.rules-symbol-art,
	.paytable-symbol img,
	.payline-overlay img {
		display: block;
		pointer-events: none;
		user-select: none;
	}

	.premium-panel-art,
	.premium-dialog-frame {
		position: absolute;
		z-index: 0;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: fill;
	}

	.result-ticker,
	.amount-control,
	.balance-meter,
	.secondary-deck .info-action,
	.modal-actions button,
	.auto-options button,
	.auto-start,
	.settings-body > button,
	.menu-actions button,
	.reel-error-status button {
		position: relative;
		isolation: isolate;
	}

	.control-meter {
		isolation: isolate;
	}

	.result-ticker > :not(.premium-panel-art),
	.amount-control > :not(.premium-panel-art),
	.balance-meter > :not(.premium-panel-art),
	.control-meter > :not(.premium-panel-art),
	.secondary-deck .info-action > :not(.premium-panel-art),
	.modal-actions button > :not(:global(.panel-state-art)),
	.auto-options button > :not(:global(.panel-state-art)),
	.auto-start > :not(:global(.panel-state-art)),
	.settings-body > button > :not(:global(.panel-state-art)),
	.menu-actions button > :not(:global(.panel-state-art)),
	.reel-error-status button > :not(:global(.panel-state-art)) {
		position: relative;
		z-index: 1;
	}

	.line-gutter span {
		position: relative;
		isolation: isolate;
		border: 0 !important;
		background: transparent !important;
		box-shadow: none !important;
	}

	.line-marker-art {
		position: absolute;
		z-index: 0;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: fill;
	}

	.line-gutter span b {
		position: relative;
		z-index: 1;
		font: inherit;
	}

	.payline-overlay {
		position: absolute;
		z-index: 14;
		pointer-events: none;
	}

	.payline-overlay {
		width: auto;
		height: auto;
	}

	.payline-overlay img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: fill;
		animation: line-signal 560ms ease-out both;
	}

	.result-ticker::before {
		display: none !important;
	}

	.round-tool,
	.bet-step,
	.reel-spin {
		border: 0 !important;
		background: transparent !important;
		box-shadow: none !important;
		filter: none !important;
		opacity: 1 !important;
	}

	.round-tool > :global(.hud-icon),
	.bet-step > :global(.hud-icon),
	.reel-spin > :global(.hud-icon) {
		width: 100%;
		height: 100%;
	}

	.reel-error-status .launch-card.error {
		position: relative;
		isolation: isolate;
		border: 0 !important;
		background: transparent !important;
		box-shadow: none !important;
	}

	.reel-error-status .launch-card.error > :not(.premium-dialog-frame) {
		position: relative;
		z-index: 1;
	}

	@media (min-aspect-ratio: 5/4) {
		.reel-mechanic-strip .armed,
		.reel-mechanic-strip .feature-state,
		.reel-mechanic-strip .target-state {
			border: 0;
			background: transparent;
			box-shadow: none;
		}
	}

	.breach-monitor .reel-cell .symbol-art {
		inset: -2px 2px 11px;
	}

	.breach-monitor .reel-cell .symbol-art img {
		filter: none !important;
		opacity: 1 !important;
		transform: none !important;
	}

	.breach-monitor .reel-grid[data-has-win='true'] .reel-cell:not(.line-active) {
		filter: none !important;
		opacity: 1 !important;
	}

	.breach-monitor .reel-cell.line-active {
		border: 0 !important;
		background: transparent !important;
		box-shadow: none !important;
	}

	.confirmation-dialog,
	.rules-dialog,
	.settings-dialog,
	.auto-dialog,
	.menu-dialog {
		position: relative;
		isolation: isolate;
		border: 0 !important;
		background: transparent !important;
		box-shadow: none !important;
	}

	.premium-dialog-frame {
		z-index: 0;
	}

	.confirmation-dialog > :not(.premium-dialog-frame),
	.rules-dialog > :not(.premium-dialog-frame),
	.settings-dialog > :not(.premium-dialog-frame),
	.auto-dialog > :not(.premium-dialog-frame),
	.menu-dialog > :not(.premium-dialog-frame) {
		position: relative;
		z-index: 1;
	}

	.mode-dialog-list button,
	.menu-actions button,
	.modal-actions button,
	.auto-options button,
	.auto-start,
	.settings-body > button,
	.reel-error-status button {
		position: relative;
		isolation: isolate;
		border: 0 !important;
		background: transparent !important;
		box-shadow: none !important;
		overflow: hidden;
	}

	.mode-dialog-list button > :not(:global(.panel-state-art)),
	.menu-actions button > :not(:global(.panel-state-art)),
	.modal-actions button > :not(:global(.panel-state-art)),
	.auto-options button > :not(:global(.panel-state-art)),
	.auto-start > :not(:global(.panel-state-art)),
	.settings-body > button > :not(:global(.panel-state-art)),
	.reel-error-status button > :not(:global(.panel-state-art)) {
		position: relative;
		z-index: 1;
	}

	.rules-symbol-art {
		width: 74px;
		height: 74px;
		object-fit: contain;
		float: left;
		margin: -8px 10px 2px -6px;
	}

	.paytable-symbol {
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}

	.paytable-symbol img {
		width: 38px;
		height: 38px;
		object-fit: contain;
	}

	/* M9 responsive raster composition. Each target family owns a native,
	   text-free machine shell; DOM supplies only authoritative content and hit areas. */
	.premium-machine-shell-picture {
		position: absolute;
		z-index: 0;
		inset: 0;
		display: none;
		width: 100%;
		height: 100%;
		pointer-events: none;
		user-select: none;
		line-height: 0;
	}

	.premium-machine-shell-picture .premium-machine-shell {
		position: absolute;
		inset: 0;
		display: block;
		width: 100%;
		height: 100%;
		max-width: none;
	}

	@media (min-aspect-ratio: 5/4) {
		.premium-machine-shell-picture { display: block; }
	}

	/* Dialog assets are authored for their real runtime envelopes, avoiding
	   stretched corners and a single generic frame across incompatible shapes. */
	.menu-dialog:not(.mode-dialog) { width: min(520px, calc(100vw - 24px)); min-height: 240px; }
	.mode-dialog { width: min(820px, calc(100vw - 24px)); min-height: 320px; }
	.confirmation-dialog { width: min(520px, calc(100vw - 24px)); min-height: 340px; }
	.rules-dialog { width: min(940px, calc(100vw - 24px)); height: min(820px, calc(100dvh - 24px)); }
	.auto-dialog { width: min(540px, calc(100vw - 24px)); min-height: 380px; }
	.settings-dialog { width: min(520px, calc(100vw - 24px)); min-height: 260px; }
	.reel-error-status .launch-card.error { min-height: 260px; }

	/* The generic dialog z-index rule must not turn the cost badge back into a
	   grid item. Keep every player-facing line legible over the raster card. */
	.mode-dialog-list button > span,
	.mode-dialog-list button > small {
		position: relative;
		z-index: 1;
		display: block;
		min-width: 0;
		overflow: visible;
		text-overflow: clip;
		white-space: normal;
	}

	.mode-dialog-list button > span {
		font-size: 13px;
		line-height: 1.15;
		letter-spacing: .055em;
	}

	.mode-dialog-list button > small {
		font-size: 10px;
		line-height: 1.35;
	}

	.mode-dialog-list button > strong {
		position: absolute;
		z-index: 1;
		top: 18px;
		right: 16px;
		grid-row: auto;
		align-self: auto;
		font-size: 20px;
		line-height: 1;
	}

	@media (max-aspect-ratio: 5/4), (max-height: 560px) and (min-aspect-ratio: 2/1) {
		.scene-world {
			inset: 50% auto auto 50%;
			width: min(100vw, calc(100dvh * 3 / 4));
			height: auto;
			aspect-ratio: 3 / 4;
			overflow: hidden;
			background: #020303;
			transform: translate(-50%, -50%);
			container-type: size;
		}

		.bunker-backdrop,
		.scene-grade,
		.operative-stage { display: none; }

		.premium-machine-shell-picture,
		.premium-machine-shell {
			display: block;
			width: 100%;
			height: 100%;
			max-width: none;
			object-fit: fill;
		}

		.breach-monitor {
			position: absolute;
			z-index: 3;
			inset: 0;
			display: block;
			width: 100%;
			height: 100%;
			overflow: visible;
			border: 0;
			border-radius: 0;
			background: transparent;
			box-shadow: none;
		}

		.breach-monitor::before,
		.breach-monitor::after,
		.monitor-glass { display: none; }

		.monitor-header {
			position: absolute;
			z-index: 6;
			top: 4.2%;
			left: 6.2%;
			display: flex;
			width: 87.6%;
			height: 10.2%;
			padding: 1.8% 2.4%;
			border: 0;
			background: transparent;
			box-shadow: none;
		}

		.monitor-identity > span { display: none; }
		.monitor-identity h1 { font-size: clamp(20px, 4.3cqw, 34px); }

		.lifecycle {
			width: auto;
			min-width: 92px;
			min-height: 44px;
			padding: 5px 8px;
			border: 0;
			background: transparent;
		}
		.lifecycle small { display: block; font-size: clamp(5px, .9cqw, 8px); }
		.lifecycle strong { font-size: clamp(7px, 1.25cqw, 11px); }

		.reel-console {
			position: absolute;
			z-index: 4;
			inset: 0;
			display: block;
			padding: 0;
			overflow: visible;
			background: transparent;
		}

		.reel-mechanic-strip,
		.reel-mechanic-strip:not(.feature-strip),
		.reel-mechanic-strip.feature-strip {
			position: absolute;
			z-index: 6;
			top: 15.15%;
			left: 8.25%;
			display: grid;
			width: 83.5%;
			height: 3.75%;
			grid-template-columns: repeat(4, minmax(0, 1fr));
			gap: .6%;
			padding: 0;
			border: 0;
			background: transparent;
		}

		.reel-mechanic-strip.feature-strip { grid-template-columns: repeat(3, minmax(0, 1fr)); }
		.reel-mechanic-strip > span,
		.reel-mechanic-strip:not(.feature-strip) > span {
			height: 100%;
			min-height: 0;
			padding: 0 3px;
			border: 0;
			background: transparent;
			box-shadow: none;
			font-size: clamp(5px, .85cqw, 8px);
			letter-spacing: .04em;
		}

		.reel-stage {
			position: absolute;
			z-index: 5;
			inset: 0;
			display: block;
			overflow: visible;
		}

		.reel-stage-heading,
		.line-gutter { display: none; }

		.reel-machine {
			position: absolute;
			top: 20.51%;
			left: 9.77%;
			display: block;
			width: 79.69%;
			height: 42.29%;
			max-width: none;
			margin: 0;
		}

		.breach-monitor .reel-window {
			position: absolute;
			inset: 0;
			width: 100%;
			height: 100%;
			max-width: none;
			max-height: none;
			aspect-ratio: auto;
			padding: 1.35%;
			overflow: hidden;
			border: 0;
			border-radius: 0;
			background: transparent;
			box-shadow: none;
		}

		.breach-monitor .reel-grid {
			width: 100%;
			height: 100%;
			aspect-ratio: auto;
			grid-template-columns: repeat(5, minmax(0, 1fr));
			grid-template-rows: repeat(3, minmax(0, 1fr));
			gap: .8%;
			padding: 0;
			border: 0;
			background: transparent;
			box-shadow: none;
		}

		.breach-monitor .reel-cell {
			min-width: 0;
			min-height: 0;
			border: 0;
			border-radius: 0;
			background: transparent;
			box-shadow: none;
		}
		.breach-monitor .reel-cell::before { display: none; }
		.breach-monitor .reel-cell .symbol-art { inset: 0 2% 11%; }
		.breach-monitor .reel-cell .symbol-art img { position: static; width: 100%; height: 100%; object-fit: contain; }
		.breach-monitor .reel-cell .symbol-code { right: 2px; bottom: 2px; left: 2px; font-size: clamp(5px, .85cqw, 8px); }

		.payline-overlay,
		.board-frame :global(.reel-spin-overlay) { inset: 1.35%; }

		.result-ticker {
			position: absolute;
			z-index: 7;
			top: 65.33%;
			left: 8.6%;
			width: 82.8%;
			height: 5.65%;
			min-height: 0;
			gap: 10px;
			padding: 0 8%;
			border: 0;
			background: transparent;
			box-shadow: none;
			font-size: clamp(6px, 1.05cqw, 10px);
		}

		.premium-hud {
			position: absolute;
			z-index: 8;
			top: 71.78%;
			left: 0;
			display: block;
			width: 100%;
			height: 28.22%;
			padding: 0;
			background: transparent;
		}

		.premium-hud .premium-panel-art { display: none; }
		.hud-tools { position: absolute; top: 5%; display: block; height: 42%; }
		.hud-tools-left { left: 3.5%; width: 25%; }
		.hud-tools-right { left: 73%; width: 25%; }

		.hud-tools .round-tool,
		.control-deck .bet-step,
		.control-deck .reel-spin {
			position: absolute;
			min-width: 44px;
			min-height: 44px;
			padding: 0;
			overflow: visible;
			border: 0;
			border-radius: 0;
			background: transparent;
			box-shadow: none;
		}

		.hud-tools .round-tool > :global(.hud-icon),
		.control-deck .bet-step > :global(.hud-icon),
		.control-deck .reel-spin > :global(.hud-icon) {
			position: absolute;
			inset: 0;
			display: block;
			width: 100%;
			height: 100%;
		}

		.hud-tools .round-tool > span,
		.control-deck .reel-spin small { display: none; }

		.hud-tools-left .round-tool:nth-child(1),
		.hud-tools-right .round-tool:nth-child(1) { top: 0; left: 0; width: 33.333%; height: 100%; }
		.hud-tools-left .round-tool:nth-child(2),
		.hud-tools-right .round-tool:nth-child(2) { top: 0; left: 33.333%; width: 33.333%; height: 100%; }
		.hud-tools-left .round-tool:nth-child(3),
		.hud-tools-right .round-tool:nth-child(3) { top: 0; left: 66.666%; width: 33.334%; height: 100%; }

		.control-deck {
			position: absolute;
			inset: 0;
			display: block;
			pointer-events: none;
		}

		.control-deck .bet-step,
		.control-deck .reel-bet-control,
		.control-deck .reel-spin { pointer-events: auto; }

		.bet-step-minus { top: 8%; left: 29.5%; width: 6.5%; height: 23%; }
		.bet-step-plus { top: 8%; left: 49.5%; width: 6.5%; height: 23%; }
		.reel-console .reel-bet-control {
			position: absolute;
			top: 7%;
			left: 36%;
			display: grid;
			width: 13.5%;
			height: 28%;
			place-content: center;
			gap: 1px;
			padding: 3px;
			border: 0;
			background: transparent;
			box-shadow: none;
			text-align: center;
		}
		.reel-console .reel-bet-control > span:first-child { font-size: clamp(5px, .9cqw, 8px); }
		.reel-console .reel-bet-control select,
		.reel-console .reel-bet-control .amount-range { min-height: 44px; padding: 0; border: 0; background: transparent; font-size: clamp(9px, 1.65cqw, 14px); text-align: center; }

		.control-meter,
		.control-deck .balance-meter {
			position: absolute;
			top: 64%;
			display: grid;
			height: 25%;
			place-content: center;
			gap: 2px;
			padding: 0 5px;
			border: 0;
			background: transparent;
			box-shadow: none;
			text-align: center;
		}
		.control-deck .balance-meter { left: 6%; width: 24%; }
		.total-meter { left: 38%; width: 24%; }
		.win-meter { left: 70%; width: 24%; }
		.control-meter span,
		.control-deck .balance-meter span { font-size: clamp(5px, .9cqw, 8px); }
		.control-meter strong,
		.control-deck .balance-meter strong { font-size: clamp(9px, 1.55cqw, 14px); }

		.reel-console .reel-spin {
			top: 0;
			left: 58%;
			width: 14%;
			height: 50%;
		}

		.secondary-deck { pointer-events: none; }
		.secondary-deck .info-action { display: none; }
		.reel-footer {
			position: absolute;
			z-index: 10;
			top: 90.5%;
			left: 8%;
			display: block;
			width: 84%;
			height: 7%;
			padding: 0;
			border: 0;
			background: transparent;
			pointer-events: none;
		}
		.reel-footer > .footer-guide,
		.reel-footer > .premium-footer-id,
		.reel-footer > .premium-footer-clearance,
		.reel-footer > strong { display: none; }
		.reel-footer .session-readouts {
			position: absolute;
			inset: 8% 4%;
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 8%;
			margin: 0;
		}
		.reel-footer .session-readout {
			display: grid;
			min-width: 34%;
			place-items: center;
			gap: 1px;
			padding: 0;
			border: 0;
			background: transparent;
			font-size: clamp(5px, 1.05cqw, 8px);
		}
		.reel-footer .session-readout strong { font-size: clamp(8px, 1.65cqw, 13px); }
	}

	@media (max-width: 480px) and (orientation: portrait) {
		.scene-world {
			width: min(100vw, calc(100dvh * 390 / 844));
			aspect-ratio: 390 / 844;
		}

		.monitor-header { top: 3.7%; left: 7%; width: 86%; height: 8.8%; padding: 1.5% 2.5%; }
		.monitor-identity h1 { font-size: clamp(16px, 5.4cqw, 23px); }
		.lifecycle { min-width: 70px; min-height: 44px; padding: 2px 4px; }
		.lifecycle small { display: none; }
		.lifecycle strong { font-size: clamp(6px, 1.8cqw, 8px); }

		.reel-mechanic-strip,
		.reel-mechanic-strip:not(.feature-strip),
		.reel-mechanic-strip.feature-strip { top: 13.3%; left: 8%; width: 84%; height: 3.6%; gap: .5%; }
		.reel-mechanic-strip > span,
		.reel-mechanic-strip:not(.feature-strip) > span { padding: 0 1px; font-size: clamp(4px, 1.15cqw, 6px); }

		.reel-machine { top: 18.48%; left: 8.21%; width: 83.08%; height: 36.49%; }
		.breach-monitor .reel-window { padding: 1.1%; }
		.breach-monitor .reel-grid { gap: .7%; }
		.breach-monitor .reel-cell .symbol-art { inset: 2% 0 10%; }
		.breach-monitor .reel-cell .symbol-code { bottom: 1px; font-size: clamp(4px, 1.15cqw, 6px); }
		.payline-overlay,
		.board-frame :global(.reel-spin-overlay) { inset: 1.1%; }

		.result-ticker { top: 57.7%; left: 11.54%; width: 75.38%; height: 4.03%; padding: 0 5%; font-size: clamp(5px, 1.3cqw, 7px); }

		.premium-hud { top: 63.27%; left: 2.56%; width: 95.13%; height: 35.55%; }
		.reel-footer {
			position: absolute;
			z-index: 10;
			top: 88.4%;
			left: 8.5%;
			display: block;
			width: 83%;
			height: 7.6%;
			padding: 0;
			border: 0;
			background: transparent;
			pointer-events: none;
		}
		.reel-footer > .footer-guide,
		.reel-footer > .premium-footer-id,
		.reel-footer > .premium-footer-clearance,
		.reel-footer > strong { display: none; }
		.reel-footer .session-readouts {
			position: absolute;
			inset: 8% 4%;
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 8%;
			margin: 0;
		}
		.reel-footer .session-readout {
			display: grid;
			min-width: 34%;
			place-items: center;
			gap: 1px;
			padding: 0;
			border: 0;
			background: transparent;
			font-size: clamp(5px, 1.45cqw, 7px);
		}
		.reel-footer .session-readout strong { font-size: clamp(8px, 2.55cqw, 12px); }
		.hud-tools { top: 36%; height: 20%; }
		.hud-tools-left { left: 4%; width: 35%; }
		.hud-tools-right { left: calc(63% - 11px); width: 35%; }
		.hud-tools .round-tool { width: 33.333%; height: 100%; }
		.hud-tools-right .round-tool:nth-child(3) { left: 66.666%; }

		.bet-step-minus { top: 4%; left: 31%; width: 12%; height: 23%; }
		.bet-step-plus { top: 4%; left: 57%; width: 12%; height: 23%; }
		.reel-console .reel-bet-control { top: 3%; left: 42%; width: 16%; height: 25%; }
		.reel-console .reel-bet-control > span:first-child { display: none; }
		.reel-console .reel-bet-control select,
		.reel-console .reel-bet-control .amount-range { font-size: clamp(8px, 2.8cqw, 12px); }

		.control-deck .balance-meter { top: 4%; left: 5%; width: 24%; height: 25%; }
		.total-meter { top: 4%; left: 71%; width: 24%; height: 25%; }
		.win-meter { top: 71%; left: 6%; width: 88%; height: 24%; }
		.control-meter span,
		.control-deck .balance-meter span { font-size: clamp(4px, 1.4cqw, 6px); }
		.control-meter strong,
		.control-deck .balance-meter strong { font-size: clamp(8px, 2.5cqw, 11px); }
		.reel-console .reel-spin { top: 31%; left: 40%; width: 22%; height: 31%; }
	}

	@media (max-height: 560px) and (min-aspect-ratio: 2/1) {
		.scene-world {
			width: min(100vw, calc(100dvh * 844 / 390));
			aspect-ratio: 844 / 390;
		}

		.monitor-header,
		.reel-mechanic-strip:not(.feature-strip) { display: none !important; }
		.reel-mechanic-strip.feature-strip {
			top: .8%;
			left: 16.1%;
			display: grid !important;
			width: 67.8%;
			height: 5.3%;
			grid-template-columns: 1.15fr 1fr 1.15fr;
			gap: .4%;
		}
		.reel-mechanic-strip.feature-strip > span {
			padding: 0 3px;
			font-size: clamp(5px, .75cqw, 7px);
		}
		.reel-mechanic-strip.feature-strip small,
		.reel-mechanic-strip.feature-strip em { font-size: .72em; }
		.reel-mechanic-strip.feature-strip .feature-target-value img { width: 14px; height: 14px; }
		.mode-dialog {
			width: min(780px, calc(100vw - 32px));
			max-height: calc(100dvh - 16px);
		}
		.reel-machine { top: 6.41%; left: 16.11%; width: 66.59%; height: 57.69%; }
		.breach-monitor .reel-window { padding: .9%; }
		.breach-monitor .reel-grid { gap: .6%; }
		.breach-monitor .reel-cell .symbol-art { inset: 0 1% 10%; }
		.breach-monitor .reel-cell .symbol-code { font-size: clamp(4px, .72cqw, 6px); }
		.payline-overlay,
		.board-frame :global(.reel-spin-overlay) { inset: .9%; }
		.result-ticker { top: 66.15%; left: 15.6%; width: 68.8%; height: 7.2%; padding: 0 5%; font-size: clamp(5px, .82cqw, 7px); }

		.premium-hud { top: 78.21%; left: 2.13%; width: 95.73%; height: 21.79%; }
		.hud-tools { top: 14%; height: 70%; }
		.hud-tools-left { left: 2%; width: 18%; }
		.hud-tools-right { left: 80%; width: 18%; }
		.hud-tools .round-tool { min-width: 44px; min-height: 44px; }
		.bet-step-minus { top: 15%; left: 29%; width: 5.5%; height: 68%; }
		.reel-console .reel-bet-control { top: 14%; left: 34%; width: 7.5%; height: 70%; }
		.bet-step-plus { top: 15%; left: 40%; width: 5.5%; height: 68%; }
		.control-deck .bet-step { z-index: 12; }
		.reel-console .reel-spin { top: -10%; left: 43.8%; width: 11.5%; height: 110%; }
		.control-deck .balance-meter { top: 14%; left: 20%; width: 9%; height: 70%; }
		.total-meter { top: 14%; left: 57.5%; width: 9.5%; height: 70%; }
		.win-meter { top: 14%; left: 67%; width: 10.5%; height: 70%; }
		.reel-console .reel-bet-control > span:first-child,
		.control-meter span,
		.control-deck .balance-meter span { display: none; }
		.control-meter strong,
		.control-deck .balance-meter strong,
		.reel-console .reel-bet-control select,
		.reel-console .reel-bet-control .amount-range { font-size: clamp(7px, 1.25cqw, 11px); }
		.reel-footer {
			top: 73.75%;
			left: 14%;
			width: 72%;
			height: 4.25%;
		}
		.reel-footer .session-readouts { inset: 0; justify-content: space-between; gap: 0; }
		.reel-footer .session-readout {
			width: 28%;
			min-width: 0;
			grid-template-columns: auto auto;
			gap: 4px;
			font-size: clamp(4px, .7cqw, 6px);
		}
		.reel-footer .session-readout strong { font-size: clamp(6px, 1cqw, 8px); }
	}

	@media (max-width: 700px) {
		.menu-dialog:not(.mode-dialog),
		.mode-dialog,
		.confirmation-dialog,
		.auto-dialog,
		.settings-dialog { width: calc(100vw - 16px); min-height: 0; }
		.rules-dialog { width: calc(100vw - 16px); height: calc(100dvh - 16px); }
		.premium-dialog-frame { object-fit: fill; }
		.mode-dialog-list button {
			min-height: 112px;
			padding: 14px 58px 12px 14px;
		}
		.mode-dialog-list button > span { font-size: 12px; }
		.mode-dialog-list button > small { font-size: 9px; }
		.mode-dialog-list button > strong { top: 14px; right: 14px; font-size: 18px; }
	}

	/* Final cross-viewport rank safe area. Keep this after every responsive symbol rule. */
	.breach-monitor .reel-cell.rank-glyph .symbol-art img {
		transform: scale(0.86) !important;
		transform-origin: center center !important;
	}

	.breach-monitor .reel-cell.rank-glyph[data-symbol-id='ten'] .symbol-art img {
		transform: scale(0.98) !important;
	}

	/* V19 presentation: artwork owns the entire symbol tile. No baked or DOM
	   captions are repeated below the reel symbols. */
	.breach-monitor .reel-cell .symbol-art {
		inset: 4% !important;
	}

	.status-plate {
		pointer-events: none !important;
		cursor: default !important;
	}

	.status-plate span {
		position: relative;
		z-index: 1;
		display: block;
		overflow: hidden;
		padding: 0 10px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.mode-key-art {
		position: absolute !important;
		z-index: 1 !important;
		inset: 8px auto 8px 10px;
		width: 38%;
		height: calc(100% - 16px);
		object-fit: cover;
		opacity: .42;
		mask-image: linear-gradient(90deg, #000 45%, transparent 100%);
		pointer-events: none;
	}

	.mode-dialog-list button > span,
	.mode-dialog-list button > small { padding-left: 26%; }

	.confirmation-dialog { gap: 14px; }
	.confirmation-ledger { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
	.confirmation-ledger p { display: grid; min-width: 0; min-height: 64px; padding: 10px; align-content: center; border: 1px solid rgba(173, 132, 67, .52); background: rgba(5, 10, 11, .72); }
	.confirmation-ledger span { color: #839491; font-size: 8px; font-weight: 900; letter-spacing: .12em; }
	.confirmation-ledger strong { overflow: hidden; color: #f2cb79; font-size: clamp(14px, 2vw, 21px); text-overflow: ellipsis; white-space: nowrap; }

	.rules-dialog { grid-template-rows: auto auto minmax(0, 1fr) !important; }
	.guide-tabs { position: relative; z-index: 2; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 4px; padding: 8px 12px; border-bottom: 1px solid rgba(161, 124, 64, .42); background: rgba(5, 9, 10, .84); }
	.guide-tabs button { min-width: 0; min-height: 44px; padding: 6px; border: 1px solid rgba(109, 126, 125, .58); background: #0b1112; color: #aab7b4; font: 900 9px/1.15 ui-monospace, monospace; letter-spacing: .06em; }
	.guide-tabs button.active { border-color: #ddb45f; background: #211b10; color: #ffe1a0; box-shadow: inset 0 -3px #d64137; }
	.game-guide-scroll { min-height: 0; overflow: auto; }
	.game-guide-panel { min-height: 100%; }
	.legacy-rules-content { display: none !important; }
	.menu-actions button { min-height: 112px; padding: 14px 10px; text-align: left; }
	.menu-actions button > span,
	.menu-actions button > small { position: relative; z-index: 2; width: 100%; }
	.menu-actions button > span { color: #f4d287; font-size: 12px; line-height: 1.2; }
	.menu-actions button > small { color: #96a6a3; font-size: 9px; font-weight: 700; line-height: 1.4; letter-spacing: .02em; }
	.mode-dialog-list button { min-height: 220px; padding-bottom: 14px; }
	.mode-dialog { display: grid; grid-template-rows: auto minmax(0, 1fr); overflow: hidden; }
	.mode-dialog-list { min-height: 0; }
	.mode-dialog-list button {
		display: grid !important;
		grid-template-columns: minmax(0, 1fr) !important;
		grid-template-rows: auto minmax(0, 1fr) auto !important;
		align-content: stretch;
	}
	.mode-dialog-list button > span {
		grid-column: 1 !important;
		grid-row: 1 !important;
		padding-right: 58px;
	}
	.mode-dialog-list button > small {
		grid-column: 1 !important;
		grid-row: 2 !important;
		align-self: start;
		margin-top: 4px;
	}
	.mode-dialog-list button > strong { display: grid; gap: 3px; justify-items: end; }
	.mode-dialog-list button > strong > small { color: #8d9a97; font-size: 7px; letter-spacing: .08em; }
	.mode-card-meta { position: relative; z-index: 2; display: grid; grid-column: 1; grid-row: 3; gap: 7px; min-width: 0; padding-left: 26%; }
	.mode-card-meta span,
	.mode-card-meta small,
	.mode-card-meta b,
	.mode-card-meta em,
	.mode-dialog-list button > strong > small {
		grid-column: auto !important;
		grid-row: auto !important;
		padding-left: 0 !important;
	}
	.mode-card-facts { display: flex; flex-wrap: wrap; gap: 5px 10px; color: #c8aa70; font-size: 8px; letter-spacing: .06em; }
	.mode-card-total { display: grid; justify-items: start; gap: 2px; color: #f7d88e; }
	.mode-card-total small { color: #83918e; font-size: 7px; font-weight: 900; letter-spacing: .08em; }
	.mode-card-total b { max-width: 100%; overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
	.mode-card-meta > em { justify-self: start; padding: 3px 7px; border: 1px solid rgba(207, 161, 79, .58); color: #f0c66e; font-size: 8px; font-style: normal; font-weight: 900; letter-spacing: .1em; }
	.mode-dialog-list button[data-mode-state='ACTIVE'] .mode-card-meta > em { border-color: #d84b40; background: rgba(80, 20, 17, .72); color: #ffd19a; }
	.mode-dialog-list button[data-mode-state='UNAVAILABLE'] .mode-card-meta > em { border-color: #687370; color: #82908d; }
	.guide-four-steps { grid-template-columns: repeat(4, minmax(0, 1fr)); }
	.symbol-card-section { margin-top: 16px; }
	.symbol-card-section > h4 { margin: 0 0 7px; color: #8f9d9a; font-size: 9px; letter-spacing: .12em; }
	.symbol-card-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
	.symbol-card-grid.compact { grid-template-columns: repeat(5, minmax(0, 1fr)); }
	.symbol-card-grid article { display: grid; grid-template-columns: 62px minmax(0, 1fr); grid-template-rows: auto auto; min-width: 0; min-height: 92px; align-items: center; gap: 4px 9px; padding: 8px; border: 1px solid rgba(166, 127, 64, .48); background: rgba(4, 9, 10, .78); }
	.symbol-card-grid article > img { grid-row: 1 / 3; width: 62px; height: 74px; object-fit: contain; }
	.symbol-card-grid article > strong { overflow: hidden; color: #f3d184; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
	.symbol-card-grid article > span,
	.special-symbol-cards article div > span { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 3px; }
	.symbol-card-grid article small,
	.special-symbol-cards article small { display: grid; gap: 2px; color: #d9e0dc; font-size: 8px; }
	.symbol-card-grid article small b,
	.special-symbol-cards article small b { color: #7f8d8a; font-size: 7px; }
	.special-symbol-cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 14px; }
	.special-symbol-cards article { display: grid; grid-template-columns: 112px minmax(0, 1fr); align-items: center; gap: 12px; min-height: 132px; padding: 10px; border: 1px solid rgba(198, 145, 57, .58); background: linear-gradient(135deg, rgba(36, 27, 12, .88), rgba(4, 9, 10, .86)); }
	.special-symbol-cards article > img { width: 112px; height: 112px; object-fit: contain; }
	.special-symbol-cards h4 { margin: 0 0 5px; color: #ffd47c; font-size: 13px; }
	.special-symbol-cards p { margin: 0 0 8px; }
	.guide-mode-cards { display: grid; gap: 10px; }
	.guide-mode-cards article { position: relative; display: grid; grid-template-columns: minmax(110px, 24%) minmax(0, 1fr) auto; min-height: 126px; align-items: center; gap: 16px; overflow: hidden; border: 1px solid rgba(170, 129, 62, .52); background: rgba(4, 9, 10, .82); }
	.guide-mode-cards article > img { width: 100%; height: 126px; object-fit: cover; }
	.guide-mode-cards article h4 { margin: 0 0 5px; color: #f4d287; font-size: 16px; }
	.guide-mode-cards article p { margin: 0; }
	.guide-mode-facts { display: flex; flex-wrap: wrap; gap: 5px 14px; margin-top: 8px; color: #f0d38f; font-size: 11px; font-weight: 900; letter-spacing: .08em; }
	.guide-mode-cards article > strong { padding-right: 18px; color: #ffdf91; font-size: 28px; }
	.vault-guide-hero { display: grid; grid-template-columns: minmax(150px, 32%) minmax(0, 1fr); align-items: center; gap: 20px; }
	.vault-guide-hero > img { width: 100%; max-height: 280px; object-fit: contain; }
	.vault-timeline { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 4px; margin: 14px 0; }
	.vault-timeline span { position: relative; display: grid; min-height: 66px; place-content: center; gap: 5px; padding: 6px; border: 1px solid rgba(181, 134, 61, .5); background: rgba(7, 12, 13, .88); color: #ddd9cd; font-size: 8px; font-weight: 900; line-height: 1.25; text-align: center; }
	.vault-timeline span:not(:last-child)::after { position: absolute; top: 50%; right: -6px; z-index: 2; color: #d34b3f; content: '›'; transform: translateY(-50%); }
	.vault-timeline b { color: #d44a40; font-size: 9px; }
	.guide-contract-facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 10px 0 14px; }
	.guide-contract-facts span { display: grid; min-height: 64px; place-content: center; gap: 4px; border: 1px solid rgba(175, 132, 65, .55); background: rgba(6, 11, 12, .82); text-align: center; }
	.guide-contract-facts small { color: #82918e; font-size: 8px; font-weight: 900; letter-spacing: .1em; }
	.guide-contract-facts strong { color: #f4ce7c; font-size: 22px; }

	@media (max-width: 700px) {
		.guide-tabs { grid-template-columns: repeat(2, minmax(0, 1fr)); }
		.guide-tabs button:last-child { grid-column: 1 / -1; }
		.confirmation-ledger { grid-template-columns: 1fr; }
		.confirmation-dialog { overflow: hidden; }
		.confirmation-scroll { padding: 18px; }
		.menu-actions { grid-template-columns: 1fr; }
		.menu-actions button { min-height: 72px; }
		.mode-dialog {
			height: calc(100dvh - 16px);
			min-height: 0 !important;
			max-height: calc(100dvh - 16px);
			grid-template-rows: auto minmax(0, 1fr);
			overflow: hidden;
		}
		.mode-dialog > header { min-height: 68px; padding: 9px 12px !important; }
		.mode-dialog-list {
			height: 100%;
			min-height: 0;
			grid-template-columns: 1fr;
			grid-template-rows: repeat(3, minmax(0, 1fr));
			gap: 5px;
			overflow: hidden;
			padding: 6px;
		}
		.mode-dialog-list button {
			height: 100%;
			min-height: 0 !important;
			gap: 2px;
			padding: 8px 48px 7px 9px;
		}
		.mode-dialog-list button > span { padding-left: 26%; padding-right: 38px; font-size: 11px; }
		.mode-dialog-list button > small {
			max-height: 2.65em;
			margin-top: 1px;
			padding-left: 26%;
			overflow: hidden;
			font-size: 8px;
			line-height: 1.25;
		}
		.mode-dialog-list button > strong { top: 9px; right: 9px; font-size: 16px; }
		.mode-card-meta { gap: 2px; padding-left: 26%; }
		.mode-card-facts { gap: 2px 7px; font-size: 6px; }
		.mode-card-total { gap: 5px; }
		.mode-card-total small { font-size: 5.5px; }
		.mode-card-total b { font-size: 9px; }
		.mode-card-meta > em { padding: 2px 5px; font-size: 6px; }
		.guide-four-steps { grid-template-columns: 1fr; }
		.symbol-card-grid,
		.symbol-card-grid.compact { grid-template-columns: 1fr; }
		.special-symbol-cards { grid-template-columns: 1fr; }
		.vault-timeline { grid-template-columns: repeat(2, minmax(0, 1fr)); }
		.vault-timeline span:not(:last-child)::after { display: none; }
		.guide-mode-cards article { grid-template-columns: 88px minmax(0, 1fr) auto; gap: 8px; }
		.guide-mode-cards article > img { height: 104px; }
		.vault-guide-hero { grid-template-columns: 1fr; }
		.vault-guide-hero > img { max-height: 150px; }
	}

	@media (max-height: 560px) and (min-aspect-ratio: 2/1) {
		.mode-dialog {
			height: calc(100dvh - 36px);
			min-height: 0 !important;
			max-height: calc(100dvh - 36px);
			grid-template-rows: auto minmax(0, 1fr);
			overflow: hidden;
		}
		.mode-dialog > header { min-height: 68px; padding: 9px 18px !important; }
		.mode-dialog-list {
			height: 100%;
			min-height: 0;
			align-items: stretch;
			gap: 8px;
			overflow: hidden;
			padding: 8px;
		}
		.mode-dialog-list button {
			height: 100%;
			min-height: 0 !important;
			gap: 3px;
			padding: 10px 46px 8px 10px;
		}
		.mode-dialog-list button > span { padding-left: 24%; padding-right: 34px; font-size: 10px; }
		.mode-dialog-list button > small {
			max-height: 3.8em;
			padding-left: 24%;
			overflow: hidden;
			font-size: 7px;
			line-height: 1.25;
		}
		.mode-dialog-list button > strong { top: 10px; right: 9px; font-size: 15px; }
		.mode-card-meta { gap: 3px; padding-left: 24%; }
		.mode-card-facts { gap: 2px 6px; font-size: 5.5px; }
		.mode-card-total small { font-size: 5px; }
		.mode-card-total b { font-size: 8px; }
		.mode-card-meta > em { padding: 2px 5px; font-size: 6px; }
	}

	@media (prefers-reduced-motion: reduce) {
		.payline-overlay img { animation: none !important; }
	}

	/* Final reel and outcome polish stays raster-first: symbols, paylines and
	   standalone FX remain packaged WebP; these lightweight layers add depth. */
	.breach-monitor .reel-window[data-anticipating='true'] {
		box-shadow:
			inset 0 0 0 2px rgba(226, 57, 46, .74),
			inset 0 0 34px rgba(202, 34, 27, .24),
			0 0 26px rgba(214, 45, 35, .28) !important;
	}

	.breach-monitor .reel-cell.vault-anticipation-cell {
		z-index: 5;
		box-shadow:
			inset 0 0 0 2px rgba(255, 186, 91, .9),
			inset 0 0 20px rgba(225, 48, 37, .48),
			0 0 18px rgba(231, 63, 48, .46) !important;
		animation: vault-confirmed-pulse 620ms ease-in-out infinite alternate;
	}

	.breach-monitor .reel-window[data-has-win='true']::after {
		position: absolute;
		z-index: 12;
		inset: 3% 4%;
		border: 1px solid rgba(255, 213, 114, .58);
		background: radial-gradient(ellipse at 50% 50%, rgba(255, 204, 88, .12), transparent 68%);
		box-shadow: inset 0 0 24px rgba(255, 193, 69, .12), 0 0 18px rgba(255, 190, 55, .18);
		content: '';
		pointer-events: none;
		animation: premium-win-bloom 720ms ease-out both;
	}

	.app-shell[data-operator-reaction='feature-tease'] .breach-monitor .reel-window,
	.app-shell[data-operator-reaction='vault-anticipation'] .breach-monitor .reel-window,
	.app-shell[data-operator-reaction='feature-trigger'] .breach-monitor .reel-window {
		box-shadow:
			inset 0 0 0 2px rgba(220, 53, 43, .64),
			inset 0 0 38px rgba(194, 33, 27, .18),
			0 0 26px rgba(208, 43, 34, .2) !important;
	}

	/* The final cascade must win over older broad responsive symbol insets. */
	.breach-monitor .reel-cell .symbol-art {
		inset: 7% 6% 9% !important;
	}

	.breach-monitor .reel-cell.rank-glyph .symbol-art {
		inset: 10% 8% 12% !important;
	}

	.breach-monitor .reel-cell.rank-glyph .symbol-art img {
		transform: scale(.8) !important;
	}

	.breach-monitor .reel-cell.rank-glyph[data-symbol-id='ten'] .symbol-art img {
		transform: scale(.9) !important;
	}

	/* DEV reel depth: one cached raster carrier supplies the physical bezel for
	   all 15 cells. Geometry, paylines and the authoritative 5x3 board stay put. */
	.breach-monitor .reel-window {
		perspective: 1150px;
		perspective-origin: 50% 44%;
	}

	.breach-monitor .reel-window::before {
		position: absolute;
		z-index: 7;
		inset: 0;
		background: linear-gradient(180deg, rgba(0, 0, 0, .5), transparent 15% 79%, rgba(0, 0, 0, .62));
		box-shadow: inset 0 15px 20px -14px #000, inset 0 -13px 18px -12px #000;
		content: '';
		pointer-events: none;
	}

	.breach-monitor .reel-cell {
		perspective: 460px;
		perspective-origin: 50% 44%;
		background: rgba(2, 7, 8, .42) !important;
		box-shadow: inset 0 10px 15px rgba(0, 0, 0, .48), inset 0 -2px 0 rgba(201, 151, 73, .12) !important;
	}

	.breach-monitor .reel-cell::after {
		position: absolute;
		z-index: 6;
		inset: 0;
		display: block;
		border: 0;
		background: var(--reel-cell-depth-art) center / 100% 100% no-repeat;
		box-shadow: none;
		content: '';
		pointer-events: none;
	}

	.breach-monitor .reel-cell .symbol-art {
		z-index: 3;
		transform: translate3d(0, -1%, 12px) scale(.955);
		transform-origin: 50% 54%;
		transition: transform 170ms cubic-bezier(.2, .75, .25, 1);
	}

	/* These two state packs own their labels in the bitmap. Reserve the full
	   aperture so WILD and VAULT can never be clipped by a DOM caption lane. */
	.breach-monitor .reel-cell.wild-cell .symbol-art,
	.breach-monitor .reel-cell.breach-cell .symbol-art {
		inset: 2% 3% 3% !important;
		overflow: visible;
		transform: translate3d(0, -1%, 16px) scale(.97);
	}

	.breach-monitor .reel-cell.wild-cell .symbol-art img,
	.breach-monitor .reel-cell.breach-cell .symbol-art img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		max-width: none;
		max-height: none;
		object-fit: contain;
	}

	.breach-monitor .reel-cell.line-active .symbol-art {
		transform: translate3d(0, -2%, 24px) scale(1.02);
	}

	.breach-monitor .reel-grid[data-spinning='true'] .symbol-art {
		transform: translate3d(0, 0, 0) scale(.95);
		transition-duration: 70ms;
	}

	@media (hover: hover) and (pointer: fine) {
		.breach-monitor .reel-window[data-spinning='false'] .reel-cell:hover .symbol-art {
			transform: translate3d(0, -2%, 18px) scale(.98);
		}
	}

	@keyframes vault-confirmed-pulse {
		from { transform: translateZ(0) scale(1); }
		to { transform: translateZ(0) scale(1.018); }
	}

	@keyframes premium-win-bloom {
		0% { opacity: 0; transform: scale(.96); }
		32% { opacity: 1; }
		100% { opacity: .52; transform: scale(1); }
	}

	@media (prefers-reduced-motion: reduce) {
		.breach-monitor .reel-cell.vault-anticipation-cell,
		.breach-monitor .reel-window[data-has-win='true']::after {
			animation: none !important;
		}
	}

	/* The canonical Penguin owns its lighting inside the authored raster film. */
	.operative-stage.penguin-character-stage .operative-halo,
	.operative-stage.penguin-character-stage .operative-floor-light,
	.operative-stage.penguin-character-stage .operative-readout {
		display: none !important;
		background: none !important;
		box-shadow: none !important;
		filter: none !important;
	}

	/* DEV v21 UI kit: one scalable raster language across every HUD control,
	   readout and modal while all text, focus and authority remain DOM-native. */
	.app-shell.dev-ui-v21 .premium-dialog-frame,
	.app-shell.dev-ui-v21 .premium-panel-art {
		isolation: isolate;
		overflow: visible;
	}

	.app-shell.dev-ui-v21 .guide-tabs button {
		position: relative;
		isolation: isolate;
		overflow: hidden;
		border: 0;
		background: transparent;
		box-shadow: none;
	}

	.app-shell.dev-ui-v21 .guide-tabs button > span {
		position: relative;
		z-index: 2;
	}

	.app-shell.dev-ui-v21 :is(
		.round-tool,
		.bet-step,
		.reel-spin,
		.menu-actions button,
		.mode-dialog-list button,
		.modal-actions button,
		.guide-tabs button,
		.auto-options button,
		.auto-start,
		.settings-body button,
		.menu-dialog > header button,
		.auto-dialog > header button,
		.settings-dialog > header button,
		.launch-card.error button,
		.game-guide-scroll
	):focus-visible {
		outline: 3px solid #ffe09b !important;
		outline-offset: 3px;
		box-shadow: 0 0 0 2px rgba(10, 16, 17, .95), 0 0 18px rgba(231, 178, 79, .62) !important;
	}

	.app-shell.dev-ui-v21 :is(.round-tool, .bet-step, .reel-spin):disabled {
		cursor: not-allowed;
		filter: saturate(.62);
	}

	.app-shell.dev-ui-v21 .game-guide-scroll,
	.app-shell.dev-ui-v21 .mode-dialog-list {
		scrollbar-color: #c18d43 #071011;
		scrollbar-width: thin;
	}

	.app-shell.dev-ui-v21 .game-guide-scroll::-webkit-scrollbar,
	.app-shell.dev-ui-v21 .auto-body::-webkit-scrollbar,
	.app-shell.dev-ui-v21 .mode-dialog-list::-webkit-scrollbar {
		width: 10px;
	}

	.app-shell.dev-ui-v21 .game-guide-scroll::-webkit-scrollbar-track,
	.app-shell.dev-ui-v21 .auto-body::-webkit-scrollbar-track,
	.app-shell.dev-ui-v21 .mode-dialog-list::-webkit-scrollbar-track {
		background: #071011;
	}

	.app-shell.dev-ui-v21 .game-guide-scroll::-webkit-scrollbar-thumb,
	.app-shell.dev-ui-v21 .auto-body::-webkit-scrollbar-thumb,
	.app-shell.dev-ui-v21 .mode-dialog-list::-webkit-scrollbar-thumb {
		border: 2px solid #071011;
		border-radius: 8px;
		background: linear-gradient(#e0b769, #8e5d26);
	}

	.app-shell.dev-ui-v21 .launch-card.error {
		grid-template-columns: minmax(0, 1fr);
		align-content: center;
		justify-items: stretch;
		gap: 12px;
		max-height: min(76%, 560px);
		overflow: auto;
		overflow-wrap: anywhere;
	}

	.app-shell.dev-ui-v21 .launch-card.error > strong {
		font-size: clamp(14px, 2.8cqw, 19px);
		letter-spacing: .12em;
		text-align: center;
	}

	.app-shell.dev-ui-v21 .launch-card.error > span {
		font-size: clamp(11px, 1.8cqw, 14px);
		line-height: 1.45;
		text-align: center;
	}

	.app-shell.dev-ui-v21 .launch-card.error > button {
		justify-self: center;
		width: min(240px, 100%);
	}

	.app-shell.dev-ui-v21 .launch-card.error > small {
		display: block;
		font-size: clamp(9px, 1.25cqw, 11px);
		line-height: 1.35;
		text-align: center;
	}

	.app-shell.dev-ui-v21 .compact-value-strip {
		display: none;
	}

	.app-shell.dev-ui-v21 .reel-machine[data-expansion-active='true'] .reel-window {
		isolation: isolate;
	}

	.app-shell.dev-ui-v21 .reel-cell.expansion-cell {
		z-index: 4;
		outline: 2px solid rgba(255, 188, 73, .92);
		outline-offset: -3px;
		animation: v21-expansion-reel 680ms cubic-bezier(.18, .78, .22, 1) both;
	}

	.app-shell.dev-ui-v21 .reel-cell.expansion-cell .symbol-art {
		animation: v21-expansion-symbol 680ms cubic-bezier(.2, .78, .2, 1) both;
	}

	.app-shell.dev-ui-v21 .expansion-callout {
		position: absolute;
		z-index: 38;
		top: 50%;
		left: 50%;
		display: grid;
		place-items: center;
		min-width: min(72%, 520px);
		gap: 4px;
		padding: 12px 28px;
		border: 1px solid rgba(255, 198, 86, .9);
		background: linear-gradient(100deg, rgba(37, 7, 5, .94), rgba(9, 17, 18, .97) 42% 58%, rgba(43, 13, 5, .94));
		box-shadow: inset 0 0 0 2px rgba(0, 0, 0, .72), 0 10px 34px rgba(0, 0, 0, .72);
		color: #fff1c7;
		text-align: center;
		transform: translate(-50%, -50%);
		animation: v21-expansion-callout 680ms cubic-bezier(.2, .72, .2, 1) both;
		pointer-events: none;
	}

	.app-shell.dev-ui-v21 .expansion-callout span {
		color: #ff6a57;
		font-size: clamp(9px, .8cqw, 14px);
		font-weight: 900;
		letter-spacing: .19em;
	}

	.app-shell.dev-ui-v21 .expansion-callout strong {
		font-size: clamp(14px, 1.45cqw, 25px);
		font-weight: 950;
		letter-spacing: .08em;
		text-shadow: 0 2px 0 #000;
	}

	@keyframes v21-expansion-reel {
		0% { opacity: .45; transform: translateY(-5%) scale(.96); }
		32% { opacity: 1; transform: translateY(2%) scale(1.025); }
		68% { transform: translateY(-1%) scale(1.01); }
		100% { opacity: 1; transform: translateY(0) scale(1); }
	}

	@keyframes v21-expansion-symbol {
		0% { opacity: .42; transform: scaleY(.82); }
		40% { opacity: 1; transform: scaleY(1.08); }
		100% { opacity: 1; transform: scaleY(1); }
	}

	@keyframes v21-expansion-callout {
		0% { opacity: 0; transform: translate(-50%, -42%) scale(.92); }
		20%, 72% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
		100% { opacity: 0; transform: translate(-50%, -56%) scale(1.02); }
	}

	@media (prefers-reduced-motion: reduce) {
		.app-shell.dev-ui-v21 .reel-cell.expansion-cell,
		.app-shell.dev-ui-v21 .reel-cell.expansion-cell .symbol-art,
		.app-shell.dev-ui-v21 .expansion-callout {
			animation: none !important;
		}
	}

	.app-shell.dev-ui-v21 .vault-timeline {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}

	.app-shell.dev-ui-v21 .vault-timeline span:nth-child(3n)::after,
	.app-shell.dev-ui-v21 .vault-timeline span:last-child::after {
		display: none;
	}

	.app-shell.dev-ui-v21 .rules-copy-grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	@media (min-width: 701px) and (max-width: 940px) {
		.app-shell.dev-ui-v21 .symbol-card-grid.compact {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	@media (max-width: 480px) and (orientation: portrait) {
		.app-shell.dev-ui-v21 .bet-step-minus {
			left: 30.5%;
		}

		.app-shell.dev-ui-v21 .reel-console .reel-bet-control {
			left: 42.5%;
			width: 15%;
		}

		.app-shell.dev-ui-v21 .bet-step-plus {
			left: 58%;
		}

		.app-shell.dev-ui-v21 .reel-mechanic-strip.feature-strip > span {
			font-size: clamp(9px, 2.45cqw, 11px);
			line-height: 1;
		}

		.app-shell.dev-ui-v21 .reel-mechanic-strip.feature-strip strong {
			font-size: clamp(15px, 4.2cqw, 19px);
		}

		.app-shell.dev-ui-v21 .result-ticker {
			font-size: clamp(9px, 2.4cqw, 11px);
		}

		.app-shell.dev-ui-v21 .hud-tools {
			top: 65%;
			height: 22%;
		}

		.app-shell.dev-ui-v21 .hud-tools-left {
			left: 2%;
			width: 46%;
		}

		.app-shell.dev-ui-v21 .hud-tools-right {
			left: 52%;
			width: 46%;
		}

		.app-shell.dev-ui-v21 .hud-tools .round-tool {
			min-width: 44px;
		}

		.app-shell.dev-ui-v21 .win-meter {
			top: 89%;
			height: 10%;
		}

		.app-shell.dev-ui-v21 .mode-dialog-list {
			overflow: auto;
		}

		.app-shell.dev-ui-v21 .vault-timeline {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	@media (max-width: 380px) and (max-height: 700px) and (orientation: portrait) {
		.app-shell.dev-ui-v21 .compact-value-strip {
			position: absolute;
			z-index: 24;
			top: calc(100% + 1px);
			left: 0;
			display: grid;
			grid-template-columns: 24px repeat(3, minmax(0, 1fr));
			align-items: center;
			width: 100%;
			height: 16px;
			padding: 0 4px;
			border: 1px solid rgba(170, 125, 58, .72);
			background: linear-gradient(90deg, rgba(4, 10, 11, .98), rgba(17, 12, 8, .97));
			box-shadow: inset 0 0 0 1px rgba(0, 0, 0, .76), 0 3px 9px rgba(0, 0, 0, .54);
		}

		.app-shell.dev-ui-v21 .compact-value-strip > span:not(.compact-operative-badge) {
			display: flex;
			align-items: center;
			justify-content: center;
			min-width: 0;
			gap: 2px;
			white-space: nowrap;
		}

		.app-shell.dev-ui-v21 .compact-value-strip small,
		.app-shell.dev-ui-v21 .compact-value-strip b {
			font-size: 7px;
			line-height: 1;
			letter-spacing: .04em;
		}

		.app-shell.dev-ui-v21 .compact-value-strip small { color: #8fa1a2; }
		.app-shell.dev-ui-v21 .compact-value-strip b { color: #ffe1a0; }

		.app-shell.dev-ui-v21 .compact-operative-badge {
			position: relative;
			align-self: center;
			width: 22px;
			height: 22px;
			overflow: hidden;
			border: 1px solid rgba(222, 185, 106, .82);
			border-radius: 50%;
			background: #06090a;
		}

		.app-shell.dev-ui-v21 .compact-operative-badge img {
			position: absolute;
			top: -1px;
			left: -7px;
			width: 80px;
			height: 64px;
			max-width: none;
			object-fit: contain;
			object-position: left top;
		}

		.app-shell.dev-ui-v21 .hud-tools-left,
		.app-shell.dev-ui-v21 .hud-tools-right {
			left: calc(50% - 72px);
			width: 144px;
			height: 44px;
		}

		.app-shell.dev-ui-v21 .hud-tools-left { top: 51%; }
		.app-shell.dev-ui-v21 .hud-tools-right { top: 73%; }

		.app-shell.dev-ui-v21 .reel-console .reel-spin {
			top: calc(51% - 50px);
			left: calc(50% - 24px);
			width: 48px;
			height: 48px;
			min-width: 48px;
			min-height: 48px;
		}

		.app-shell.dev-ui-v21 .hud-tools .round-tool:nth-child(1) { left: 0; width: 44px; }
		.app-shell.dev-ui-v21 .hud-tools .round-tool:nth-child(2) { left: 50px; width: 44px; }
		.app-shell.dev-ui-v21 .hud-tools .round-tool:nth-child(3) { left: 100px; width: 44px; }

		.app-shell.dev-ui-v21 .bet-step-minus {
			left: calc(50% - 70px);
			width: 44px;
		}

		.app-shell.dev-ui-v21 .reel-console .reel-bet-control {
			left: calc(50% - 22px);
			width: 44px;
		}

		.app-shell.dev-ui-v21 .bet-step-plus {
			left: calc(50% + 26px);
			width: 44px;
		}

		.app-shell.dev-ui-v21 .win-meter {
			display: none;
		}
	}

	@media (max-height: 560px) and (min-aspect-ratio: 2/1) {
		.app-shell.dev-ui-v21 .modal-backdrop {
			padding: 8px;
		}

		.app-shell.dev-ui-v21 :is(.menu-dialog, .mode-dialog, .confirmation-dialog, .rules-dialog, .auto-dialog, .settings-dialog) {
			min-height: 0 !important;
			max-height: calc(100dvh - 16px) !important;
		}

		.app-shell.dev-ui-v21 .auto-dialog,
		.app-shell.dev-ui-v21 .rules-dialog {
			overflow: auto;
		}

		.app-shell.dev-ui-v21 .reel-mechanic-strip.feature-strip > span {
			font-size: clamp(9px, 1.05cqw, 11px);
		}

		.app-shell.dev-ui-v21 .result-ticker {
			font-size: clamp(9px, 1.05cqw, 11px);
		}

		.app-shell.dev-ui-v21 .bet-step-minus { left: 29.7%; }
		.app-shell.dev-ui-v21 .reel-console .reel-bet-control { left: 35.6%; width: 5.5%; }
		.app-shell.dev-ui-v21 .bet-step-plus { left: 41.55%; }
		.app-shell.dev-ui-v21 .reel-console .reel-spin { left: 47.8%; width: 9.7%; }
	}

	@media (max-width: 700px) and (max-height: 560px) and (min-aspect-ratio: 2/1) {
		.app-shell.dev-ui-v21 .compact-value-strip {
			position: absolute;
			z-index: 24;
			top: calc(100% + 1px);
			left: 0;
			display: grid;
			grid-template-columns: 24px repeat(3, minmax(0, 1fr));
			align-items: center;
			width: 100%;
			height: 16px;
			padding: 0 4px;
			border: 1px solid rgba(170, 125, 58, .72);
			background: rgba(5, 10, 11, .97);
		}

		.app-shell.dev-ui-v21 .compact-value-strip > span:not(.compact-operative-badge) {
			display: flex;
			align-items: center;
			justify-content: center;
			min-width: 0;
			gap: 3px;
		}

		.app-shell.dev-ui-v21 .compact-value-strip small,
		.app-shell.dev-ui-v21 .compact-value-strip b {
			font-size: 8px;
			line-height: 1;
		}

		.app-shell.dev-ui-v21 .compact-value-strip small { color: #8fa1a2; }
		.app-shell.dev-ui-v21 .compact-value-strip b { color: #ffe1a0; }
		.app-shell.dev-ui-v21 .compact-operative-badge { width: 20px; height: 20px; overflow: hidden; border: 1px solid #9f793e; border-radius: 50%; }
		.app-shell.dev-ui-v21 .compact-operative-badge img { width: 72px; height: 58px; max-width: none; transform: translate(-7px, -1px); object-fit: contain; object-position: left top; }

		.app-shell.dev-ui-v21 .premium-hud {
			left: 2%;
			width: 96%;
		}

		.app-shell.dev-ui-v21 .hud-tools {
			display: contents;
		}

		.app-shell.dev-ui-v21 .hud-tools .round-tool,
		.app-shell.dev-ui-v21 .control-deck .bet-step,
		.app-shell.dev-ui-v21 .reel-console .reel-bet-control,
		.app-shell.dev-ui-v21 .reel-console .reel-spin {
			top: 15%;
			width: 44px;
			height: 68%;
			min-width: 44px;
			min-height: 44px;
		}

		.app-shell.dev-ui-v21 .hud-tools-left .round-tool:nth-child(1) { left: 2%; }
		.app-shell.dev-ui-v21 .hud-tools-left .round-tool:nth-child(2) { left: 12%; }
		.app-shell.dev-ui-v21 .hud-tools-left .round-tool:nth-child(3) { left: 22%; }
		.app-shell.dev-ui-v21 .bet-step-minus { left: 32%; }
		.app-shell.dev-ui-v21 .reel-console .reel-bet-control { left: 42%; }
		.app-shell.dev-ui-v21 .bet-step-plus { left: 52%; }
		.app-shell.dev-ui-v21 .reel-console .reel-spin { left: 62%; }
		.app-shell.dev-ui-v21 .hud-tools-right .round-tool:nth-child(1) { left: 72%; }
		.app-shell.dev-ui-v21 .hud-tools-right .round-tool:nth-child(2) { left: 82%; }
		.app-shell.dev-ui-v21 .hud-tools-right .round-tool:nth-child(3) { left: calc(100% - 44px); }

		.app-shell.dev-ui-v21 :is(.balance-meter, .total-meter, .win-meter) {
			display: none;
		}
	}

	/* DEV v21 lifecycle carrier: isolated from the production status readout. */
	.app-shell.dev-ui-v21 .lifecycle.lifecycle--cinematic {
		display: block;
		width: clamp(220px, 29cqw, 340px);
		min-width: 220px;
		max-width: 54%;
		height: 44px;
		min-height: 44px;
		padding: 0;
		overflow: visible;
		border: 0;
		background: transparent;
	}

	.app-shell.dev-ui-v21 .lifecycle--cinematic :global(.cinematic-status) {
		--ui-v21-panel-border: 8px;
		--ui-v21-readout-border-y: 5px;
		--ui-v21-readout-border-x: 8px;
		grid-template-columns: 7px minmax(0, 1fr) minmax(52px, auto);
		grid-template-rows: minmax(0, 1fr) 2px;
		width: 100%;
		height: 44px;
		min-height: 44px;
		gap: 2px 7px;
		padding: 5px 8px 4px;
		text-align: left;
	}

	.app-shell.dev-ui-v21 .lifecycle--cinematic :global(.cinematic-status__signal) {
		grid-template-rows: 6px 1fr;
		gap: 2px;
	}

	.app-shell.dev-ui-v21 .lifecycle--cinematic :global(.cinematic-status__signal i) {
		width: 5px;
		height: 5px;
	}

	.app-shell.dev-ui-v21 .lifecycle--cinematic :global(.cinematic-status__signal span) {
		width: 1px;
		min-height: 12px;
	}

	.app-shell.dev-ui-v21 .lifecycle--cinematic :global(.cinematic-status__copy) { gap: 2px; }
	.app-shell.dev-ui-v21 .lifecycle--cinematic :global(.cinematic-status__eyebrow) {
		font-size: clamp(5px, .48cqw, 7px);
		letter-spacing: .13em;
	}
	.app-shell.dev-ui-v21 .lifecycle--cinematic :global(.cinematic-status__headline) {
		font-size: clamp(9px, .92cqw, 14px);
		letter-spacing: -.015em;
	}
	.app-shell.dev-ui-v21 .lifecycle--cinematic :global(.cinematic-status__detail) { display: none; }

	.app-shell.dev-ui-v21 .lifecycle--cinematic :global(.cinematic-status__state) {
		grid-template-columns: 7px auto;
		min-width: 52px;
		gap: 2px 4px;
		padding: 3px 4px 3px 6px;
	}
	.app-shell.dev-ui-v21 .lifecycle--cinematic :global(.cinematic-status__state strong),
	.app-shell.dev-ui-v21 .lifecycle--cinematic :global(.cinematic-status__state em) {
		font-size: clamp(5px, .47cqw, 7px);
		letter-spacing: .1em;
	}
	.app-shell.dev-ui-v21 .lifecycle--cinematic :global(.cinematic-status__light) {
		width: 7px;
		height: 7px;
	}
	.app-shell.dev-ui-v21 .lifecycle--cinematic :global(.cinematic-status__light i) {
		width: 5px;
		height: 5px;
	}
	.app-shell.dev-ui-v21 .lifecycle--cinematic :global(.cinematic-status__progress) { height: 2px; }

	@media (max-width: 480px) and (orientation: portrait) {
		.app-shell.dev-ui-v21 .lifecycle.lifecycle--cinematic {
			width: 108px;
			min-width: 108px;
			max-width: 46%;
		}

		.app-shell.dev-ui-v21 .lifecycle--cinematic :global(.cinematic-status) {
			grid-template-columns: minmax(0, 1fr);
			padding: 5px 6px 4px;
		}

		.app-shell.dev-ui-v21 .lifecycle--cinematic :global(.cinematic-status__signal),
		.app-shell.dev-ui-v21 .lifecycle--cinematic :global(.cinematic-status__state) {
			display: none;
		}

		.app-shell.dev-ui-v21 .lifecycle--cinematic :global(.cinematic-status__eyebrow) { font-size: 5px; }
		.app-shell.dev-ui-v21 .lifecycle--cinematic :global(.cinematic-status__headline) { font-size: clamp(7px, 2.05cqw, 9px); }
		.app-shell.dev-ui-v21 .lifecycle--cinematic :global(.cinematic-status__progress) { grid-column: 1; }
	}

	@media (max-height: 560px) and (min-aspect-ratio: 2/1) {
		.app-shell.dev-ui-v21 .lifecycle.lifecycle--cinematic {
			width: clamp(154px, 22cqw, 214px);
			min-width: 154px;
			height: 38px;
			min-height: 38px;
		}

		.app-shell.dev-ui-v21 .lifecycle--cinematic :global(.cinematic-status) {
			height: 38px;
			min-height: 38px;
			padding-block: 4px 3px;
		}
	}

	/* Cycle 2 readability pass: illustrated surfaces stay dense, but rules and
	   mode facts never collapse into decorative microtype. */
	.app-shell.dev-ui-v21 .guide-four-steps article {
		display: grid;
		grid-template-columns: 32px minmax(0, 1fr);
		grid-template-rows: auto minmax(0, 1fr);
		column-gap: 10px;
		padding: 12px;
	}

	.app-shell.dev-ui-v21 .guide-four-steps article > em {
		position: static;
		grid-row: 1 / span 2;
		align-self: start;
	}

	.app-shell.dev-ui-v21 .guide-four-steps article > :is(h4, p) {
		grid-column: 2;
		min-width: 0;
	}

	@media (max-width: 480px) and (orientation: portrait) {
		.app-shell.dev-ui-v21 .mode-dialog-list {
			grid-template-rows: none;
			align-content: start;
			overflow-y: auto;
			scroll-snap-type: y proximity;
		}

		.app-shell.dev-ui-v21 .mode-dialog-list button {
			height: auto;
			min-height: 252px !important;
			scroll-snap-align: start;
		}

		.app-shell.dev-ui-v21 .mode-dialog-list button > span { font-size: 12px; }
		.app-shell.dev-ui-v21 .mode-dialog-list button > small {
			max-height: 3.75em;
			font-size: 10px;
			line-height: 1.25;
		}
		.app-shell.dev-ui-v21 .mode-card-facts { font-size: 8px; }
		.app-shell.dev-ui-v21 .mode-card-total small { font-size: 7px; }
		.app-shell.dev-ui-v21 .mode-card-total b { font-size: 11px; }
		.app-shell.dev-ui-v21 .mode-card-meta > em { font-size: 8px; }
	}

	@media (max-width: 700px) and (max-height: 560px) and (min-aspect-ratio: 2/1) {
		.app-shell.dev-ui-v21 .mode-dialog > header {
			min-height: 52px;
			padding-block: 5px !important;
		}

		.app-shell.dev-ui-v21 .mode-dialog-list {
			grid-template-columns: 1fr;
			grid-template-rows: none;
			grid-auto-rows: minmax(148px, auto);
			align-content: start;
			gap: 8px;
			overflow-y: auto;
			padding: 8px 10px;
			scroll-snap-type: y proximity;
		}

		.app-shell.dev-ui-v21 .mode-dialog-list button {
			height: auto;
			min-height: 148px !important;
			grid-template-rows: auto minmax(0, 1fr) auto !important;
			padding: 12px 58px 10px 12px;
			scroll-snap-align: start;
		}

		.app-shell.dev-ui-v21 .mode-key-art {
			width: 30%;
			opacity: .52;
		}

		.app-shell.dev-ui-v21 .mode-dialog-list button > span {
			padding-right: 48px;
			padding-left: 28%;
			font-size: 12px;
		}

		.app-shell.dev-ui-v21 .mode-dialog-list button > small {
			max-height: 3.8em;
			padding-left: 28%;
			font-size: 9px;
			line-height: 1.3;
		}

		.app-shell.dev-ui-v21 .mode-card-meta {
			gap: 4px;
			padding-left: 28%;
		}

		.app-shell.dev-ui-v21 .mode-card-facts {
			gap: 3px 9px;
			font-size: 8px;
		}
		.app-shell.dev-ui-v21 .mode-card-total small { font-size: 7px; }
		.app-shell.dev-ui-v21 .mode-card-total b { font-size: 11px; }
		.app-shell.dev-ui-v21 .mode-card-meta > em { font-size: 8px; }
		.app-shell.dev-ui-v21 .mode-dialog-list button > strong { font-size: 18px; }
	}

	.app-shell.dev-ui-v21 .responsive-penguin-cameo { display: none; }
	.app-shell.dev-ui-v21 .responsive-spin-label { display: none; }

	@media (min-width: 381px) and (max-width: 1040px) and (min-height: 561px) {
		.app-shell.dev-ui-v21 .responsive-spin-label {
			position: absolute;
			z-index: 5;
			bottom: -7px;
			left: 50%;
			display: block;
			min-width: 48px;
			padding: 2px 7px;
			border: 1px solid rgba(224, 179, 85, .82);
			background: rgba(5, 9, 10, .96);
			box-shadow: 0 2px 7px rgba(0, 0, 0, .74);
			color: #f6d58f;
			font: 900 7.5px/1 ui-monospace, monospace;
			letter-spacing: .1em;
			text-align: center;
			white-space: nowrap;
			transform: translateX(-50%);
		}

		.app-shell.dev-ui-v21 .reel-spin:disabled .responsive-spin-label {
			border-color: rgba(105, 119, 117, .7);
			color: #84918e;
		}

		.app-shell.dev-ui-v21 .reel-spin.feature-action .responsive-spin-label {
			border-color: rgba(224, 82, 64, .9);
			color: #ffe0ad;
		}
	}

	@media (max-aspect-ratio: 5/4), (max-height: 560px) and (min-aspect-ratio: 2/1) {
		.app-shell.dev-ui-v21 .result-ticker {
			padding-left: 40px !important;
		}

		.app-shell.dev-ui-v21 .responsive-penguin-cameo {
			position: absolute;
			z-index: 3;
			top: 50%;
			left: 6px;
			display: block;
			width: 28px;
			height: 28px;
			overflow: hidden;
			border: 1px solid rgba(231, 190, 101, .82);
			border-radius: 50%;
			background: #05090a;
			box-shadow: 0 0 0 2px rgba(1, 4, 5, .88), 0 0 10px rgba(205, 151, 60, .24);
			transform: translateY(-50%);
			pointer-events: none;
		}

		.app-shell.dev-ui-v21 .responsive-penguin-cameo img {
			position: absolute;
			top: -2px;
			left: -8px;
			width: 84px;
			height: 67px;
			max-width: none;
			object-fit: contain;
			object-position: left top;
		}
	}

	@media (max-width: 380px) and (max-height: 700px) and (orientation: portrait),
		(max-width: 700px) and (max-height: 560px) and (min-aspect-ratio: 2/1) {
		.app-shell.dev-ui-v21 .responsive-penguin-cameo { display: none; }
		.app-shell.dev-ui-v21 .result-ticker { padding-left: 4px !important; }
	}

	/* Cycle 3 dialog pass: the metal confirmation carrier stays fixed while its
	   accessible content owns scrolling, and secondary copy never becomes microtype. */
	.app-shell.dev-ui-v21 .confirmation-scroll,
	.app-shell.dev-ui-v21 .game-guide-scroll,
	.app-shell.dev-ui-v21 .mode-dialog-list {
		scrollbar-color: #c18d43 #071011;
		scrollbar-width: thin;
	}

	.app-shell.dev-ui-v21 :is(
		.confirmation-scroll > span,
		.rules-dialog > header span,
		.settings-dialog > header span,
		.auto-dialog > header span,
		.menu-dialog > header span,
		.confirmation-ledger span,
		.auto-options button small,
		.auto-summary span,
		.mode-card-facts,
		.mode-card-total small,
		.mode-card-meta > em,
		.mode-dialog-list button > strong > small,
		.guide-tabs button,
		.rules-dialog th,
		.symbol-card-section > h4,
		.vault-timeline span,
		.vault-timeline b,
		.guide-contract-facts small,
		.rules-dialog small b
	) {
		font-size: 10px;
		line-height: 1.25;
	}

	.app-shell.dev-ui-v21 :is(
		.confirmation-scroll > p,
		.auto-body > p,
		.settings-body > p,
		.menu-actions button > small,
		.mode-dialog-list button > small,
		.rules-dialog p,
		.rules-dialog small
	) {
		font-size: 11px;
		line-height: 1.45;
	}

	@media (max-width: 700px) and (max-height: 560px) and (min-aspect-ratio: 2/1) {
		.app-shell.dev-ui-v21 .confirmation-dialog {
			height: calc(100dvh - 16px);
			overflow: hidden !important;
		}

		.app-shell.dev-ui-v21 .confirmation-scroll {
			min-height: 0;
			padding: 16px 18px 18px;
			overflow-y: auto;
		}

		.app-shell.dev-ui-v21 .confirmation-ledger {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	/* Cycle 3 responsive identity: selected entry mode stays explicit even when
	   the lower status plate is removed by the illustrated portrait rig. This
	   carrier is deliberately not a live region; lifecycle remains the sole
	   DEV announcement surface. */
	.app-shell.dev-ui-v21 .selected-mode-carrier {
		position: relative;
		isolation: isolate;
		flex: 0 0 auto;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		width: max-content;
		min-width: max-content;
		height: 36px;
		gap: 7px;
		padding: 5px 11px;
		border: 1px solid rgba(184, 137, 65, .72);
		background: linear-gradient(105deg, rgba(41, 31, 19, .94), rgba(5, 12, 14, .97) 54%);
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, .72), 0 5px 14px rgba(0, 0, 0, .42);
		clip-path: polygon(5px 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%, 0 5px);
		white-space: nowrap;
	}

	.app-shell.dev-ui-v21 .selected-mode-carrier small {
		color: #8c9b99;
		font: 900 7px/1 ui-monospace, monospace;
		letter-spacing: .12em;
	}

	.app-shell.dev-ui-v21 .selected-mode-carrier strong {
		display: flex;
		align-items: baseline;
		min-width: max-content;
		gap: 5px;
		color: #f4eee0;
		font: 950 clamp(9px, .72cqw, 12px)/1 ui-monospace, monospace;
		letter-spacing: .055em;
		white-space: nowrap;
	}

	.app-shell.dev-ui-v21 .selected-mode-carrier strong span,
	.app-shell.dev-ui-v21 .selected-mode-carrier strong em {
		display: inline;
		font: inherit;
		white-space: nowrap;
	}

	.app-shell.dev-ui-v21 .selected-mode-carrier strong em {
		color: #f2bd62;
		font-style: normal;
	}

	.app-shell.dev-ui-v21 .selected-mode-carrier .mode-label-compact { display: none; }

	@media (max-width: 480px) and (orientation: portrait) {
		.app-shell.dev-ui-v21 .monitor-header {
			display: grid;
			grid-template-columns: minmax(0, 1fr) clamp(96px, 30cqw, 116px);
			grid-template-rows: auto minmax(22px, 1fr);
			align-content: center;
			align-items: center;
			column-gap: 5px;
			row-gap: 2px;
		}

		.app-shell.dev-ui-v21 .monitor-identity {
			grid-column: 1 / -1;
			grid-row: 1;
			align-self: end;
		}

		.app-shell.dev-ui-v21 .monitor-identity h1 {
			font-size: clamp(14px, 5.2cqw, 21px);
			line-height: .92;
		}

		.app-shell.dev-ui-v21 .selected-mode-carrier {
			grid-column: 1;
			grid-row: 2;
			width: 100%;
			min-width: 0;
			max-width: none;
			height: 22px;
			gap: 0;
			padding: 2px 6px;
		}

		.app-shell.dev-ui-v21 .selected-mode-carrier small { display: none; }
		.app-shell.dev-ui-v21 .selected-mode-carrier .mode-label-full { display: none; }
		.app-shell.dev-ui-v21 .selected-mode-carrier .mode-label-compact { display: inline; }
		.app-shell.dev-ui-v21 .selected-mode-carrier strong {
			min-width: 0;
			gap: 4px;
			font-size: clamp(7px, 1.95cqw, 8.5px);
			letter-spacing: .025em;
		}

		.app-shell.dev-ui-v21 .lifecycle.lifecycle--cinematic {
			grid-column: 2;
			grid-row: 2;
			width: 100%;
			min-width: 0;
			max-width: none;
			height: 22px;
			min-height: 22px;
		}

		.app-shell.dev-ui-v21 .lifecycle--cinematic :global(.cinematic-status) {
			height: 22px;
			min-height: 22px;
			align-content: center;
			padding: 3px 5px 3px;
		}

		.app-shell.dev-ui-v21 .lifecycle--cinematic :global(.cinematic-status__eyebrow) { display: none; }
		.app-shell.dev-ui-v21 .lifecycle--cinematic :global(.cinematic-status__headline) {
			overflow: hidden;
			font-size: clamp(8px, 2.1cqw, 9px);
			letter-spacing: .02em;
			line-height: 1;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
	}

	/* V22 extreme visual pass. The illustrated shell, material system and
	   atmosphere are compile-gated to DEV; authority, hit targets and geometry
	   stay DOM-native. */
	.app-shell.dev-ui-v22 {
		isolation: isolate;
		background:
			radial-gradient(ellipse at 50% 48%, rgba(82, 62, 34, .12), transparent 58%),
			linear-gradient(180deg, rgba(0, 0, 0, .4), transparent 22% 74%, rgba(0, 0, 0, .52)),
			#020303;
		color: #f4eee3;
	}

	.app-shell.dev-ui-v22::before {
		position: absolute;
		z-index: 0;
		inset: 0;
		background:
			radial-gradient(ellipse at 50% 48%, rgba(255, 239, 205, .025), transparent 62%),
			linear-gradient(180deg, rgba(0, 0, 0, .32), transparent 23% 73%, rgba(0, 0, 0, .48));
		content: '';
		opacity: .25;
		pointer-events: none;
	}

	.app-shell.dev-ui-v22 .scene-world {
		z-index: 1;
		box-shadow:
			0 0 0 1px rgba(223, 188, 126, .12),
			0 18px 70px rgba(0, 0, 0, .82),
			0 0 120px rgba(116, 83, 38, .12);
	}

	.app-shell.dev-ui-v22 .scene-world :global(.blacksite-atmosphere) {
		--blacksite-atmosphere-z: 1;
	}

	.app-shell.dev-ui-v22 .premium-machine-shell-picture { filter: none; }

	.app-shell.dev-ui-v22 .monitor-header {
		text-shadow: 0 2px 8px rgba(0, 0, 0, .88);
	}

	.app-shell.dev-ui-v22 .monitor-identity > span {
		color: #aaa89f;
		font-weight: 850;
	}

	.app-shell.dev-ui-v22 .monitor-identity h1 {
		color: #fffaf0;
		letter-spacing: -.025em;
		text-shadow: 0 2px 0 #000, 0 0 18px rgba(229, 194, 128, .12);
	}

	.app-shell.dev-ui-v22 .monitor-identity h1 b { color: #f8f2e8; }
	.app-shell.dev-ui-v22 .monitor-identity h1 em { color: #d9a753; }

	/* Older guide key art carries police-light cyan/red. Keep the source rasters
	   but grade only these static, off-gameplay illustrations into the neutral
	   parkerized-steel/brass V22 room. */
	.app-shell.dev-ui-v22 :is(.guide-mode-cards, .vault-guide-hero) img {
		filter: grayscale(.85) sepia(.35) saturate(.7) brightness(.88) contrast(1.12);
	}

	.app-shell.dev-ui-v22 .selected-mode-carrier {
		border-color: rgba(214, 172, 98, .8);
		background: linear-gradient(110deg, rgba(50, 39, 24, .98), rgba(7, 10, 11, .98) 58%);
		box-shadow:
			inset 0 0 0 1px rgba(255, 239, 204, .06),
			inset 0 -12px 20px rgba(0, 0, 0, .32),
			0 6px 18px rgba(0, 0, 0, .5);
	}

	.app-shell.dev-ui-v22 .reel-mechanic-strip {
		text-shadow: 0 1px 5px #000;
	}

	.app-shell.dev-ui-v22 .reel-stage {
		filter: none;
	}

	.app-shell.dev-ui-v22 .breach-monitor .reel-window {
		isolation: isolate;
		background: #020303;
		box-shadow:
			inset 0 20px 34px rgba(0, 0, 0, .54),
			inset 0 -16px 30px rgba(0, 0, 0, .5),
			0 12px 34px rgba(0, 0, 0, .62) !important;
	}

	.app-shell.dev-ui-v22 .v22-reel-bezel {
		position: absolute;
		z-index: 13;
		inset: -2px;
		display: block;
		box-sizing: border-box;
		border: clamp(12px, 1.6cqw, 26px) solid transparent;
		border-image-source: var(--v22-reel-bezel-art);
		border-image-slice: 112 fill;
		border-image-width: 1;
		border-image-repeat: stretch;
		pointer-events: none;
		user-select: none;
	}

	.app-shell.dev-ui-v22 .breach-monitor .reel-grid {
		background:
			linear-gradient(180deg, rgba(255, 245, 220, .025), transparent 24% 74%, rgba(0, 0, 0, .16)),
			#030606;
	}

	.app-shell.dev-ui-v22 .breach-monitor .reel-cell {
		background:
			radial-gradient(circle at 50% 38%, rgba(222, 194, 139, .045), transparent 56%),
			rgba(2, 6, 7, .7) !important;
		box-shadow:
			inset 0 13px 19px rgba(0, 0, 0, .5),
			inset 0 -2px 0 rgba(215, 174, 102, .2) !important;
	}

	/* The registered cell frame is a true nine-slice. Keeping its 96px corner
	   plates intact prevents bolts and bevels becoming oval at phone/short ARs. */
	.app-shell.dev-ui-v22 .breach-monitor .reel-cell::after {
		box-sizing: border-box;
		border: clamp(6px, .72cqw, 12px) solid transparent;
		border-image-source: var(--reel-cell-depth-art);
		border-image-slice: 96 fill;
		border-image-width: 1;
		border-image-repeat: stretch;
		background: none;
	}

	.app-shell.dev-ui-v22 .standalone-fx-layer[data-name^='bonusCrate'] .standalone-fx-frame {
		filter: grayscale(.86) sepia(.72) saturate(.82) brightness(.94) contrast(1.08);
	}

	.app-shell.dev-ui-v22 .result-ticker {
		color: #f4efe7;
		text-shadow: 0 1px 5px #000;
	}

	.app-shell.dev-ui-v22 .result-ticker strong { color: #f1c878; }

	/* V22 machine rasters already own the complete physical HUD chrome. Keep
	   only live glyphs, values and hit targets above those authored sockets so
	   a second generic button/readout frame cannot appear inside each well. */
	.app-shell.dev-ui-v22 .premium-hud :global(.hud-icon--v21 > .ui-surface),
	.app-shell.dev-ui-v22 .premium-hud .premium-panel-art,
	.app-shell.dev-ui-v22 .result-ticker .premium-panel-art {
		display: none;
	}

	.app-shell.dev-ui-v22 :is(
		.amount-control,
		.balance-meter,
		.control-meter,
		.status-plate,
		.result-ticker
	) strong {
		font-weight: 950;
		letter-spacing: .025em;
	}

	.app-shell.dev-ui-v22 .premium-dialog-frame {
		filter: drop-shadow(0 24px 48px rgba(0, 0, 0, .72));
	}

	.app-shell.dev-ui-v22 .mode-key-art {
		filter: grayscale(.72) sepia(.34) saturate(.72) contrast(1.08);
	}

	.app-shell.dev-ui-v22 .formula-strip {
		border-left-color: #c89b4f;
		background: linear-gradient(100deg, rgba(58, 43, 23, .74), rgba(12, 14, 14, .74));
	}

	.app-shell.dev-ui-v22 .expansion-callout {
		border-color: rgba(227, 190, 111, .88);
		background: linear-gradient(100deg, rgba(54, 39, 19, .96), rgba(8, 12, 13, .97) 42% 58%, rgba(54, 39, 19, .96));
	}

	.app-shell.dev-ui-v22 .expansion-callout span { color: #efc675; }

	.app-shell.dev-ui-v22 .mode-dialog-list button.selected {
		border-color: #d8a85b;
		box-shadow: inset 4px 0 #d3a35a, 0 0 20px rgba(197, 148, 67, .2);
	}

	.app-shell.dev-ui-v22 .mode-dialog-list button > strong {
		position: absolute !important;
		top: auto !important;
		right: 14px !important;
		bottom: 12px !important;
		align-self: auto;
		justify-items: end;
	}

	.app-shell.dev-ui-v22 :is(.modal-actions, .auto-options, .settings-body, .menu-actions) button:disabled > :not(:global(.panel-state-art)) {
		opacity: .72 !important;
		color: #9c988f !important;
	}

	.app-shell.dev-ui-v22 .modal-backdrop {
		background:
			radial-gradient(circle at 50% 44%, rgba(98, 72, 36, .15), transparent 36%),
			rgba(0, 0, 0, .84);
		backdrop-filter: none;
		animation: dev-v22-backdrop-in 140ms ease-out both;
	}

	.app-shell.dev-ui-v22 .modal-backdrop > :is(.menu-dialog, .mode-dialog, .confirmation-dialog, .rules-dialog, .auto-dialog, .settings-dialog) {
		animation: dev-v22-dialog-in 180ms cubic-bezier(.2, .78, .22, 1) both;
	}

	@keyframes dev-v22-backdrop-in {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes dev-v22-dialog-in {
		from { opacity: 0; transform: translateY(7px) scale(.988); }
		to { opacity: 1; transform: translateY(0) scale(1); }
	}

	.app-shell.dev-ui-v22 .runtime-error-overlay {
		position: absolute;
		z-index: 80;
		inset: 0;
		display: grid;
		grid-template-columns: minmax(0, 1fr) !important;
		grid-template-rows: minmax(0, 1fr) !important;
		place-items: center;
		width: auto;
		height: auto;
		padding: clamp(10px, 3vw, 34px);
		background:
			radial-gradient(circle at 50% 44%, rgba(116, 48, 31, .2), transparent 38%),
			rgba(0, 0, 0, .88);
	}

	.app-shell.dev-ui-v22 .runtime-error-overlay .launch-card.error {
		position: relative;
		top: auto;
		left: auto;
		width: min(520px, calc(100% - 20px));
		max-height: min(82dvh, 620px);
		overflow: auto;
		overflow-wrap: anywhere;
		transform: none;
		align-self: center;
		justify-self: center;
	}

	.app-shell.dev-ui-v22 :is(.menu-dialog, .mode-dialog, .confirmation-dialog, .rules-dialog, .auto-dialog, .settings-dialog) > header h2 {
		color: #fff8eb;
		letter-spacing: .08em;
		text-shadow: 0 2px 10px #000;
	}

	.app-shell.dev-ui-v22 :is(.round-tool, .bet-step, .reel-spin, .menu-actions button, .mode-dialog-list button, .modal-actions button, .auto-options button, .settings-body > button) {
		transition: transform 135ms cubic-bezier(.2, .78, .22, 1), color 130ms ease-out, opacity 130ms ease-out;
	}

	.app-shell.dev-ui-v22 .menu-action-icon {
		display: none;
	}

	@media (hover: hover) and (pointer: fine) {
		.app-shell.dev-ui-v22 :is(.round-tool, .bet-step, .reel-spin, .menu-actions button, .mode-dialog-list button, .modal-actions button, .auto-options button, .settings-body > button):hover:not(:disabled) {
			transform: translateY(-2px) scale(1.012);
			color: #fff8e9;
		}

		.app-shell.dev-ui-v22 :is(.round-tool, .bet-step, .reel-spin):active:not(:disabled) {
			transition-duration: 80ms;
			transform: translateY(1px) scale(.985);
		}
	}

	.app-shell.dev-ui-v22 :is(button, select, input):focus-visible {
		outline: 2px solid #f2cf8b !important;
		outline-offset: 3px;
	}

	.app-shell.dev-ui-v22 :is(.mode-dialog-list, .game-guide-scroll):focus-visible {
		outline: 2px solid #f2cf8b;
		outline-offset: -4px;
	}

	.app-shell.dev-ui-v22 [data-ui-status='success'],
	.app-shell.dev-ui-v22 [data-has-win='true'] .phase-chip {
		color: #ffe3a1;
	}

	@media (min-aspect-ratio: 5/4) {
		.app-shell.dev-ui-v22 .monitor-identity > span { font-size: clamp(7px, .56cqw, 10px); }
		.app-shell.dev-ui-v22 .monitor-identity h1 { font-size: clamp(28px, 2.12cqw, 36px); }
		.app-shell.dev-ui-v22 .result-ticker { font-size: clamp(8px, .7cqw, 12px); }
		.app-shell.dev-ui-v22 .result-ticker strong { font-size: 1.12em; }

		.app-shell.dev-ui-v22 .hud-tools-right { left: 77.65%; width: 21.34%; }
		.app-shell.dev-ui-v22 .hud-tools .round-tool { top: 12%; height: 76%; }
		.app-shell.dev-ui-v22 .hud-tools-left .round-tool:nth-child(1) { left: 0; width: 29.1%; }
		.app-shell.dev-ui-v22 .hud-tools-left .round-tool:nth-child(2) { left: 31.1%; width: 29.1%; }
		.app-shell.dev-ui-v22 .hud-tools-left .round-tool:nth-child(3) { left: 67.1%; width: 29.1%; }
		.app-shell.dev-ui-v22 .hud-tools-right .round-tool:nth-child(1) { left: 2.1%; width: 31.1%; }
		.app-shell.dev-ui-v22 .hud-tools-right .round-tool:nth-child(2) { left: 35.3%; width: 31.1%; }
		.app-shell.dev-ui-v22 .hud-tools-right .round-tool:nth-child(3) { left: 67.6%; width: 31.1%; }
	}

	@media (min-width: 1041px) and (max-width: 1400px) and (min-height: 561px) and (min-aspect-ratio: 4/3) {
		.app-shell.dev-ui-v22 .monitor-identity { min-width: 0; }
		.app-shell.dev-ui-v22 .monitor-identity h1 {
			overflow: hidden;
			font-size: clamp(22px, 1.8cqw, 29px);
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.app-shell.dev-ui-v22 .selected-mode-carrier {
			max-width: 190px;
			min-width: 0;
		}

		.app-shell.dev-ui-v22 .selected-mode-carrier small { display: none; }
		.app-shell.dev-ui-v22 .selected-mode-carrier .mode-label-full { display: none; }
		.app-shell.dev-ui-v22 .selected-mode-carrier .mode-label-compact { display: inline; }
	}

	@media (max-width: 480px) and (orientation: portrait) {
		.app-shell.dev-ui-v22 .compact-value-strip {
			height: 16px;
			min-height: 0;
			font-size: 8px;
		}

		.app-shell.dev-ui-v22 .compact-value-strip small { font-size: 7px; }
		.app-shell.dev-ui-v22 .compact-value-strip b { font-size: 9px; }
		.app-shell.dev-ui-v22 .compact-value-strip > span:last-child b {
			color: #ffe0a0;
			font-size: 10px;
		}

		.app-shell.dev-ui-v22 .reel-mechanic-strip:not(.feature-strip) :global(.feature-hud-surface__value) { font-size: clamp(9px, 2.6cqw, 12px); }
		.app-shell.dev-ui-v22 .reel-mechanic-strip:not(.feature-strip) :global(.feature-hud-surface__secondary) { font-size: clamp(7px, 2cqw, 9px); }

		.app-shell.dev-ui-v22 .round-tool > span {
			position: absolute;
			z-index: 7;
			bottom: -8px;
			left: 50%;
			display: block !important;
			padding: 2px 4px;
			border: 1px solid rgba(192, 151, 83, .62);
			background: rgba(3, 6, 7, .94);
			color: #e9dbc0;
			font: 900 7px/1 ui-monospace, monospace;
			letter-spacing: .04em;
			white-space: nowrap;
			transform: translateX(-50%);
			pointer-events: none;
		}

		.app-shell.dev-ui-v22 .menu-dialog:not(.mode-dialog) .menu-actions {
			grid-auto-rows: 82px;
		}

		.app-shell.dev-ui-v22 .menu-dialog:not(.mode-dialog) .menu-actions button {
			height: 82px;
			min-height: 82px;
		}

		.app-shell.dev-ui-v22 .settings-body > button {
			min-height: 58px;
		}

		.app-shell.dev-ui-v22 .mode-card-effect {
			display: -webkit-box !important;
			min-height: 48px;
			max-height: 48px;
			overflow: hidden;
			-webkit-box-orient: vertical;
			-webkit-line-clamp: 3;
			line-clamp: 3;
			text-overflow: ellipsis;
		}
	}

	@media (max-width: 380px) and (max-height: 700px) and (orientation: portrait) {
		.app-shell.dev-ui-v22 .scene-world {
			top: 50%;
			left: 50%;
			width: min(100vw, calc(100dvh * 320 / 568));
			height: auto;
			aspect-ratio: 320 / 568;
			transform: translate(-50%, -50%);
		}

		.app-shell.dev-ui-v22 .responsive-spin-label {
			position: absolute;
			z-index: 8;
			bottom: -5px;
			left: 50%;
			display: block !important;
			min-width: 50px;
			padding: 2px 6px;
			border: 1px solid rgba(229, 188, 105, .82);
			background: rgba(3, 7, 8, .97);
			color: #ffdfa0;
			font: 950 8px/1 ui-monospace, monospace;
			letter-spacing: .06em;
			white-space: nowrap;
			transform: translateX(-50%);
		}
	}

	@media (max-aspect-ratio: 5/4) {
		.app-shell.dev-ui-v22 {
			background:
				linear-gradient(180deg, rgba(0, 0, 0, .32), transparent 24% 74%, rgba(0, 0, 0, .48)),
				#020303;
		}

		.app-shell.dev-ui-v22::before {
			background: linear-gradient(180deg, rgba(255, 244, 216, .025), transparent 26% 72%, rgba(0, 0, 0, .42));
		}
	}

	@media (max-height: 560px) and (min-aspect-ratio: 2/1) {
		.app-shell.dev-ui-v22 {
			background:
				linear-gradient(180deg, rgba(0, 0, 0, .42), transparent 24% 72%, rgba(0, 0, 0, .56)),
				#020303;
		}

		.app-shell.dev-ui-v22 .monitor-header {
			position: absolute !important;
			z-index: 30;
			top: -6px !important;
			left: 13% !important;
			display: grid !important;
			grid-template-columns: auto minmax(0, 1fr) minmax(110px, 28%);
			align-items: center;
			width: 74% !important;
			height: 20px !important;
			min-height: 20px !important;
			gap: 7px;
			padding: 2px 7px !important;
			border: 1px solid rgba(187, 146, 78, .58) !important;
			background: linear-gradient(90deg, rgba(7, 10, 10, .96), rgba(25, 20, 13, .94), rgba(7, 10, 10, .96)) !important;
			box-shadow: 0 5px 14px rgba(0, 0, 0, .58) !important;
		}

		.app-shell.dev-ui-v22 .monitor-identity { min-width: 0; }
		.app-shell.dev-ui-v22 .monitor-identity > span { display: none; }
		.app-shell.dev-ui-v22 .monitor-identity h1 {
			overflow: hidden;
			font-size: clamp(9px, 1.55cqw, 13px);
			line-height: 1;
			white-space: nowrap;
		}

		.app-shell.dev-ui-v22 .selected-mode-carrier,
		.app-shell.dev-ui-v22 .lifecycle.lifecycle--cinematic {
			position: relative;
			inset: auto;
			width: 100%;
			min-width: 0;
			height: 20px;
			min-height: 20px;
			padding: 2px 5px;
		}

		.app-shell.dev-ui-v22 .selected-mode-carrier small,
		.app-shell.dev-ui-v22 .selected-mode-carrier .mode-label-full { display: none; }
		.app-shell.dev-ui-v22 .selected-mode-carrier .mode-label-compact { display: inline; }
		.app-shell.dev-ui-v22 .selected-mode-carrier strong { font-size: 7.5px; }

		.app-shell.dev-ui-v22 .lifecycle--cinematic :global(.cinematic-status) {
			height: 20px;
			min-height: 20px;
			padding: 2px 4px;
		}

		.app-shell.dev-ui-v22 .lifecycle--cinematic :global(.cinematic-status__eyebrow),
		.app-shell.dev-ui-v22 .lifecycle--cinematic :global(.cinematic-status__detail),
		.app-shell.dev-ui-v22 .lifecycle--cinematic :global(.cinematic-status__progress) { display: none; }
		.app-shell.dev-ui-v22 .lifecycle--cinematic :global(.cinematic-status__headline) {
			overflow: hidden;
			font-size: 7.5px;
			line-height: 1;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.app-shell.dev-ui-v22 .responsive-spin-label {
			position: absolute;
			z-index: 8;
			bottom: -4px;
			left: 50%;
			display: block !important;
			min-width: 48px;
			padding: 2px 5px;
			border: 1px solid rgba(226, 185, 100, .78);
			background: rgba(3, 7, 8, .96);
			color: #ffdfa0;
			font: 950 8px/1 ui-monospace, monospace;
			white-space: nowrap;
			transform: translateX(-50%);
		}

		.app-shell.dev-ui-v22 :is(.rules-dialog, .auto-dialog, .settings-dialog) {
			overflow: hidden !important;
		}

		.app-shell.dev-ui-v22 .settings-dialog {
			display: grid;
			grid-template-rows: auto minmax(0, 1fr);
		}

		.app-shell.dev-ui-v22 .settings-dialog .settings-body {
			min-height: 0;
			overflow-y: auto;
			overscroll-behavior: contain;
		}

		.app-shell.dev-ui-v22 .menu-dialog:not(.mode-dialog) .menu-actions {
			grid-auto-rows: 72px;
		}

		.app-shell.dev-ui-v22 .menu-dialog:not(.mode-dialog) .menu-actions button {
			height: 72px;
			min-height: 72px;
		}
	}

	@media (min-width: 701px) and (min-height: 561px) {
		.app-shell.dev-ui-v22 .confirmation-dialog {
			width: min(640px, calc(100vw - 48px));
			min-height: 380px;
		}

		.app-shell.dev-ui-v22 :is(.settings-dialog, .auto-dialog) {
			width: min(660px, calc(100vw - 48px));
			min-height: 430px;
		}

		.app-shell.dev-ui-v22 :is(.settings-dialog, .auto-dialog) > header {
			padding: 22px 28px;
		}

		.app-shell.dev-ui-v22 .settings-body,
		.app-shell.dev-ui-v22 .auto-body {
			gap: 16px;
			padding: 28px;
		}

		.app-shell.dev-ui-v22 .settings-body > button {
			min-height: 68px;
			padding-inline: 18px;
			font-size: 14px;
		}

		.app-shell.dev-ui-v22 .auto-options button { min-height: 84px; }
		.app-shell.dev-ui-v22 .auto-summary { min-height: 64px; padding-inline: 18px; }

		.app-shell.dev-ui-v22 .menu-dialog:not(.mode-dialog) {
			width: min(760px, calc(100vw - 48px));
			min-height: 360px;
		}

		.app-shell.dev-ui-v22 .menu-dialog:not(.mode-dialog) > header {
			padding: 22px 28px;
		}

		.app-shell.dev-ui-v22 .menu-dialog:not(.mode-dialog) .menu-actions {
			gap: 14px;
			padding: 30px;
		}

		.app-shell.dev-ui-v22 .menu-dialog:not(.mode-dialog) .menu-actions button {
			grid-template-rows: minmax(76px, 1fr) auto auto;
			justify-items: start;
			min-height: 174px;
			align-content: stretch;
			padding: 24px 20px;
		}

		.app-shell.dev-ui-v22 .menu-action-icon {
			display: grid;
			width: 78px;
			height: 78px;
			place-items: center;
			align-self: start;
			justify-self: center;
			border: 1px solid rgba(207, 168, 96, .52);
			background:
				radial-gradient(circle at 50% 42%, rgba(226, 187, 112, .12), transparent 58%),
				linear-gradient(145deg, rgba(37, 34, 27, .84), rgba(5, 8, 9, .9));
			box-shadow: inset 0 0 0 1px rgba(255, 246, 220, .035), 0 10px 22px rgba(0, 0, 0, .4);
			clip-path: polygon(9px 0, calc(100% - 9px) 0, 100% 9px, 100% calc(100% - 9px), calc(100% - 9px) 100%, 9px 100%, 0 calc(100% - 9px), 0 9px);
			transition: transform 150ms ease-out, border-color 150ms ease-out, background-color 150ms ease-out;
		}

		.app-shell.dev-ui-v22 .menu-actions button:hover:not(:disabled) .menu-action-icon,
		.app-shell.dev-ui-v22 .menu-actions button:focus-visible:not(:disabled) .menu-action-icon {
			border-color: rgba(242, 202, 127, .9);
			transform: translateY(-3px) scale(1.035);
		}

		.app-shell.dev-ui-v22 .menu-dialog:not(.mode-dialog) .menu-actions button > span {
			font-size: 14px;
		}

		.app-shell.dev-ui-v22 .menu-dialog:not(.mode-dialog) .menu-actions button > small {
			font-size: 11px;
		}
	}

	/* Keep every responsive control square and in one deterministic reading-order grid. */
	@media (min-width: 481px) and (min-height: 561px) and (max-aspect-ratio: 5/4) {
		.app-shell.dev-ui-v22 .premium-hud {
			--responsive-control-size: clamp(44px, calc(10cqw - 4px), 64px);
			display: grid;
			grid-template-columns: repeat(10, minmax(0, 1fr));
			grid-template-rows: var(--responsive-control-size);
			align-content: start;
			align-items: center;
			box-sizing: border-box;
			padding-top: 5%;
		}

		.app-shell.dev-ui-v22 .hud-tools,
		.app-shell.dev-ui-v22 .control-deck {
			display: contents;
		}

		.app-shell.dev-ui-v22 :is(
			.hud-tools .round-tool,
			.control-deck .bet-step,
			.reel-console .reel-bet-control,
			.reel-console .reel-spin
		) {
			position: relative !important;
			top: auto !important;
			left: auto !important;
			width: var(--responsive-control-size);
			height: var(--responsive-control-size);
			min-width: 44px;
			min-height: 44px;
			grid-row: 1;
			align-self: center;
			justify-self: center;
		}

		.app-shell.dev-ui-v22 .hud-tools .round-tool > :global(.hud-icon),
		.app-shell.dev-ui-v22 .control-deck .bet-step > :global(.hud-icon),
		.app-shell.dev-ui-v22 .reel-console .reel-spin > :global(.hud-icon) {
			inset: 2px !important;
			width: calc(100% - 4px) !important;
			height: calc(100% - 4px) !important;
		}

		.app-shell.dev-ui-v22 .hud-tools-left .round-tool:nth-child(1) { grid-column: 1; }
		.app-shell.dev-ui-v22 .hud-tools-left .round-tool:nth-child(2) { grid-column: 2; }
		.app-shell.dev-ui-v22 .hud-tools-left .round-tool:nth-child(3) { grid-column: 3; }
		.app-shell.dev-ui-v22 .bet-step-minus { grid-column: 4; }
		.app-shell.dev-ui-v22 .reel-console .reel-bet-control { grid-column: 5; }
		.app-shell.dev-ui-v22 .bet-step-plus { grid-column: 6; }
		.app-shell.dev-ui-v22 .reel-console .reel-spin { grid-column: 7; }
		.app-shell.dev-ui-v22 .hud-tools-right .round-tool:nth-child(1) { grid-column: 8; }
		.app-shell.dev-ui-v22 .hud-tools-right .round-tool:nth-child(2) { grid-column: 9; }
		.app-shell.dev-ui-v22 .hud-tools-right .round-tool:nth-child(3) { grid-column: 10; }

		.app-shell.dev-ui-v22 .reel-console .reel-bet-control {
			grid-template-rows: minmax(0, 1fr);
			place-content: stretch;
			gap: 0;
			padding: 0;
		}

		.app-shell.dev-ui-v22 .reel-console .reel-bet-control > span:first-child {
			display: none;
		}

		.app-shell.dev-ui-v22 .reel-console .reel-bet-control :is(select, .amount-range) {
			align-self: stretch;
			width: 100%;
			height: var(--responsive-control-size) !important;
			min-height: 44px;
		}
	}

	@media (min-width: 381px) and (max-width: 480px) and (orientation: portrait) {
		.app-shell.dev-ui-v22 .hud-tools {
			display: grid;
			grid-template-columns: repeat(3, minmax(0, 1fr));
			align-items: center;
			gap: 4px;
		}

		.app-shell.dev-ui-v22 .hud-tools .round-tool {
			position: relative !important;
			top: auto !important;
			left: auto !important;
			width: 100%;
			height: auto;
			min-width: 44px;
			min-height: 44px;
			aspect-ratio: 1;
		}
	}

	/* The 3:4 scene—not the viewport—owns the tracks. Switch exactly when its
	   content box cannot fit ten independent 44px hit targets. */
	@media (min-width: 481px) and (min-height: 561px) {
		@container (width < 440px) {
			.app-shell.dev-ui-v22 .premium-hud {
				--responsive-control-size: 44px;
				grid-template-columns: repeat(5, minmax(44px, 1fr));
				grid-template-rows: repeat(2, 44px);
				gap: 4px 0;
				padding-top: 4px;
			}

			.app-shell.dev-ui-v22 .hud-tools-left .round-tool:nth-child(1) { grid-column: 1; grid-row: 1; }
			.app-shell.dev-ui-v22 .hud-tools-left .round-tool:nth-child(2) { grid-column: 2; grid-row: 1; }
			.app-shell.dev-ui-v22 .hud-tools-left .round-tool:nth-child(3) { grid-column: 3; grid-row: 1; }
			.app-shell.dev-ui-v22 .control-deck .bet-step-minus { grid-column: 4; grid-row: 1; }
			.app-shell.dev-ui-v22 .reel-console .reel-bet-control { grid-column: 5; grid-row: 1; }
			.app-shell.dev-ui-v22 .control-deck .bet-step-plus { grid-column: 1; grid-row: 2; }
			.app-shell.dev-ui-v22 .reel-console .reel-spin { grid-column: 2; grid-row: 2; }
			.app-shell.dev-ui-v22 .hud-tools-right .round-tool:nth-child(1) { grid-column: 3; grid-row: 2; }
			.app-shell.dev-ui-v22 .hud-tools-right .round-tool:nth-child(2) { grid-column: 4; grid-row: 2; }
			.app-shell.dev-ui-v22 .hud-tools-right .round-tool:nth-child(3) { grid-column: 5; grid-row: 2; }
		}
	}

	@media (max-width: 480px) and (orientation: portrait) {
		.app-shell.dev-ui-v22 .round-tool > span,
		.app-shell.dev-ui-v22 .responsive-spin-label {
			top: auto !important;
			bottom: 1px;
			min-width: 0;
			padding: 1px 2px;
			border: 0;
			background: rgba(3, 6, 7, .86);
			font-size: 6px;
		}
	}

	.app-shell.dev-ui-v22 :is(.menu-dialog, .mode-dialog, .rules-dialog, .auto-dialog, .settings-dialog) > header > button {
		flex: 0 0 46px;
		width: 46px;
		height: 46px;
		min-width: 46px;
		min-height: 46px;
		padding: 0;
	}

	.app-shell.dev-ui-v22 .guide-tabs button {
		min-height: 46px;
	}

	@media (max-width: 700px) {
		.app-shell.dev-ui-v22 .guide-tabs {
			grid-template-columns: repeat(6, minmax(0, 1fr));
		}

		.app-shell.dev-ui-v22 .guide-tabs button {
			grid-column: span 2;
			width: 100%;
			min-width: 0;
		}

		.app-shell.dev-ui-v22 .guide-tabs button:nth-child(4) { grid-column: 2 / span 2; }
		.app-shell.dev-ui-v22 .guide-tabs button:nth-child(5) { grid-column: 4 / span 2; }
	}

	/* Final responsive control geometry: every hit target owns a distinct grid cell. */
	@media (max-width: 700px) and (max-height: 560px) and (min-aspect-ratio: 2/1) {
		.app-shell.dev-ui-v22 .premium-hud {
			box-sizing: border-box;
		}

		.app-shell.dev-ui-v22 .hud-tools,
		.app-shell.dev-ui-v22 .control-deck {
			display: contents;
		}

		.app-shell.dev-ui-v22 .reel-console .reel-bet-control {
			display: grid;
			width: 44px;
			height: 44px;
			min-width: 44px;
			min-height: 44px;
			grid-template-rows: minmax(0, 1fr);
			place-content: stretch;
			gap: 0;
			padding: 0;
		}

		.app-shell.dev-ui-v22 .reel-console .reel-bet-control > span:first-child {
			display: none;
		}

		.app-shell.dev-ui-v22 .reel-console .reel-bet-control :is(select, .amount-range) {
			align-self: stretch;
			width: 100%;
			height: 44px;
			min-height: 44px;
		}

		.app-shell.dev-ui-v22 .hud-tools .round-tool > :global(.hud-icon),
		.app-shell.dev-ui-v22 .control-deck .bet-step > :global(.hud-icon),
		.app-shell.dev-ui-v22 .reel-console .reel-spin > :global(.hud-icon) {
			inset: 2px !important;
			width: calc(100% - 4px) !important;
			height: calc(100% - 4px) !important;
		}

		.app-shell.dev-ui-v22 .menu-dialog:not(.mode-dialog) {
			display: grid;
			grid-template-rows: auto minmax(0, 1fr);
			overflow: hidden !important;
		}

		.app-shell.dev-ui-v22 .menu-dialog:not(.mode-dialog) .menu-actions {
			min-height: 0;
			overflow-y: auto;
			overscroll-behavior: contain;
			align-content: start;
		}
	}

	@media (min-width: 701px) and (max-height: 560px) and (min-aspect-ratio: 2/1) {
		/* The authored short-landscape Spin well is circular. Keep the live target
		   square so it cannot stretch below the viewport on shallow displays. */
		.app-shell.dev-ui-v22 .reel-console .reel-spin {
			height: auto !important;
			aspect-ratio: 1;
		}
	}

	@media (min-width: 468px) and (max-width: 700px) and (max-height: 560px) and (min-aspect-ratio: 2/1) {
		.app-shell.dev-ui-v22 .premium-hud {
			display: grid;
			grid-template-columns: repeat(10, minmax(0, 1fr));
			align-items: center;
			padding-inline: 1%;
		}

		.app-shell.dev-ui-v22 :is(
			.hud-tools .round-tool,
			.control-deck .bet-step,
			.reel-console .reel-bet-control,
			.reel-console .reel-spin
		) {
			position: relative !important;
			top: auto !important;
			left: auto !important;
			width: 44px;
			height: 44px;
			min-width: 44px;
			min-height: 44px;
			grid-row: 1;
			align-self: center;
			justify-self: center;
		}

		.app-shell.dev-ui-v22 .hud-tools-left .round-tool:nth-child(1) { grid-column: 1; }
		.app-shell.dev-ui-v22 .hud-tools-left .round-tool:nth-child(2) { grid-column: 2; }
		.app-shell.dev-ui-v22 .hud-tools-left .round-tool:nth-child(3) { grid-column: 3; }
		.app-shell.dev-ui-v22 .bet-step-minus { grid-column: 4; }
		.app-shell.dev-ui-v22 .reel-console .reel-bet-control { grid-column: 5; }
		.app-shell.dev-ui-v22 .bet-step-plus { grid-column: 6; }
		.app-shell.dev-ui-v22 .reel-console .reel-spin { grid-column: 7; }
		.app-shell.dev-ui-v22 .hud-tools-right .round-tool:nth-child(1) { grid-column: 8; }
		.app-shell.dev-ui-v22 .hud-tools-right .round-tool:nth-child(2) { grid-column: 9; }
		.app-shell.dev-ui-v22 .hud-tools-right .round-tool:nth-child(3) { grid-column: 10; }
	}

	@media (max-width: 467px) and (max-height: 560px) and (min-aspect-ratio: 2/1) {
		.app-shell.dev-ui-v22 .scene-world {
			top: calc(50% - 3px);
			overflow: visible;
		}

		.app-shell.dev-ui-v22 .breach-monitor {
			clip-path: none;
		}

		.app-shell.dev-ui-v22 .compact-value-strip {
			display: none;
		}

		.app-shell.dev-ui-v22 .premium-hud {
			top: 73.35%;
			display: grid;
			height: 88px;
			grid-template-columns: repeat(5, minmax(44px, 1fr));
			grid-template-rows: repeat(2, 44px);
			align-items: center;
			gap: 0;
			padding: 0;
		}

		.app-shell.dev-ui-v22 :is(
			.hud-tools .round-tool,
			.control-deck .bet-step,
			.reel-console .reel-bet-control,
			.reel-console .reel-spin
		) {
			position: relative !important;
			top: auto !important;
			left: auto !important;
			width: 44px;
			height: 44px;
			min-width: 44px;
			min-height: 44px;
			align-self: center;
			justify-self: center;
		}

		.app-shell.dev-ui-v22 .hud-tools-left .round-tool:nth-child(1) { grid-column: 1; grid-row: 1; }
		.app-shell.dev-ui-v22 .hud-tools-left .round-tool:nth-child(2) { grid-column: 2; grid-row: 1; }
		.app-shell.dev-ui-v22 .hud-tools-left .round-tool:nth-child(3) { grid-column: 3; grid-row: 1; }
		.app-shell.dev-ui-v22 .bet-step-minus { grid-column: 4; grid-row: 1; }
		.app-shell.dev-ui-v22 .reel-console .reel-bet-control { grid-column: 5; grid-row: 1; }
		.app-shell.dev-ui-v22 .bet-step-plus { grid-column: 1; grid-row: 2; }
		.app-shell.dev-ui-v22 .reel-console .reel-spin { grid-column: 2; grid-row: 2; }
		.app-shell.dev-ui-v22 .hud-tools-right .round-tool:nth-child(1) { grid-column: 3; grid-row: 2; }
		.app-shell.dev-ui-v22 .hud-tools-right .round-tool:nth-child(2) { grid-column: 4; grid-row: 2; }
		.app-shell.dev-ui-v22 .hud-tools-right .round-tool:nth-child(3) { grid-column: 5; grid-row: 2; }

		.app-shell.dev-ui-v22 .responsive-spin-label {
			bottom: 1px;
			min-width: 0;
			padding: 1px 2px;
			border: 0;
			font-size: 6px;
		}
	}

	@media (max-width: 380px) and (max-height: 700px) and (orientation: portrait) {
		.app-shell.dev-ui-v22 .control-deck .bet-step {
			height: 44px;
			min-height: 44px;
		}

		.app-shell.dev-ui-v22 .reel-console .reel-spin {
			top: calc(51% - 46px);
			left: calc(50% - 22px);
			width: 44px;
			height: 44px;
			min-width: 44px;
			min-height: 44px;
		}

		.app-shell.dev-ui-v22 .reel-console .reel-bet-control {
			height: 44px;
			min-height: 44px;
			grid-template-rows: minmax(0, 1fr);
			place-content: stretch;
			gap: 0;
			padding: 0;
		}

		.app-shell.dev-ui-v22 .reel-console .reel-bet-control > span:first-child {
			display: none;
		}

		.app-shell.dev-ui-v22 .reel-console .reel-bet-control :is(select, .amount-range) {
			align-self: stretch;
			width: 100%;
			height: 44px;
			min-height: 44px;
		}
	}

	/* Final V22 precision pass. Shell-native profiles keep the authored wells;
	   layouts that genuinely reflow get one opaque live rail, never two layers
	   of competing button chrome. */
	.app-shell.dev-ui-v22 .premium-hud :global(.hud-icon__v21-fallback),
	.app-shell.dev-ui-v22 :is(.menu-dialog, .mode-dialog, .rules-dialog, .auto-dialog, .settings-dialog) > header > button :global(.hud-icon__v21-fallback),
	.app-shell.dev-ui-v22 :is(.menu-dialog, .mode-dialog, .rules-dialog, .auto-dialog, .settings-dialog) > header > button :global(.hud-icon--v21 > .ui-surface) {
		display: none;
	}

	.app-shell.dev-ui-v22 :is(.menu-dialog, .mode-dialog, .rules-dialog, .auto-dialog, .settings-dialog) > header > button {
		position: relative;
		display: grid;
		place-items: center;
		border-color: rgba(205, 170, 106, .62);
		background: linear-gradient(145deg, rgba(31, 29, 24, .96), rgba(4, 7, 8, .98));
		box-shadow: inset 0 0 0 1px rgba(255, 244, 218, .035), 0 7px 16px rgba(0, 0, 0, .38);
	}

	.app-shell.dev-ui-v22 :is(.menu-dialog, .mode-dialog, .rules-dialog, .auto-dialog, .settings-dialog) > header > button > :global(.hud-icon) {
		width: 30px !important;
		height: 30px !important;
	}

	.app-shell.dev-ui-v22 .modal-actions.preview-only {
		grid-template-columns: minmax(0, 1fr);
	}

	.app-shell.dev-ui-v22 .modal-actions.preview-only .preview-close-action {
		min-height: 56px;
		color: #fff2d5;
		font-size: 12px;
	}

	.app-shell.dev-ui-v22 :is(.rules-scroll, .auto-body, .settings-body, .confirmation-scroll) > p,
	.app-shell.dev-ui-v22 .rules-copy-grid p {
		font-size: clamp(11px, 1.05vw, 13px);
	}

	@media (min-aspect-ratio: 5/4) {
		/* Register the live hitboxes to the 1672x941 desktop master. CSS translate
		   is independent of the hover transform, so interaction remains smooth. */
		.app-shell.dev-ui-v22 .operative-stage {
			width: 44%;
			height: 61.4%;
		}

		.app-shell.dev-ui-v22 .hud-tools-left { translate: 0 -.72cqw; }
		.app-shell.dev-ui-v22 .hud-tools-left .round-tool:nth-child(1) { translate: -.53cqw 0; }
		.app-shell.dev-ui-v22 .hud-tools-left .round-tool:nth-child(2) { translate: -.09cqw 0; }
		.app-shell.dev-ui-v22 .hud-tools-left .round-tool:nth-child(3) { translate: -.67cqw 0; }
		.app-shell.dev-ui-v22 .hud-tools-right { translate: -.76cqw -.72cqw; }
		.app-shell.dev-ui-v22 .reel-console .reel-spin {
			width: calc(12.51% - 2px);
			translate: -.24cqw -.27cqw;
		}
	}

	@media (min-width: 481px) and (min-height: 561px) and (max-aspect-ratio: 5/4) {
		.app-shell.dev-ui-v22 .premium-hud {
			--v22-live-rail-height: calc(var(--responsive-control-size) + 40px);
			isolation: isolate;
		}

		.app-shell.dev-ui-v22 .premium-hud::before {
			position: absolute;
			z-index: 0;
			top: 0;
			left: 0;
			display: block;
			width: 100%;
			height: var(--v22-live-rail-height);
			border-block: 1px solid rgba(204, 164, 94, .58);
			background:
				radial-gradient(ellipse at 50% 28%, rgba(212, 174, 105, .09), transparent 54%),
				linear-gradient(180deg, rgba(21, 22, 19, .99), rgba(3, 6, 7, .995));
			box-shadow: inset 0 0 0 2px rgba(0, 0, 0, .58), inset 0 12px 24px rgba(255, 243, 214, .02), 0 8px 18px rgba(0, 0, 0, .42);
			content: '';
			pointer-events: none;
		}

		.app-shell.dev-ui-v22 .premium-hud :is(.round-tool, .bet-step, .reel-bet-control, .reel-spin) {
			z-index: 1;
		}

		.app-shell.dev-ui-v22 .premium-hud :global(.hud-icon--v21 > .ui-surface),
		.app-shell.dev-ui-v22 .premium-hud .reel-bet-control .premium-panel-art {
			display: block;
		}
	}

	@media (max-width: 700px) and (max-height: 560px) and (min-aspect-ratio: 2/1) {
		.app-shell.dev-ui-v22 .premium-hud {
			isolation: isolate;
			border-block: 1px solid rgba(204, 164, 94, .58);
			background:
				radial-gradient(ellipse at 50% 18%, rgba(212, 174, 105, .1), transparent 58%),
				linear-gradient(180deg, rgba(21, 22, 19, .995), rgba(3, 6, 7, .998));
			box-shadow: inset 0 0 0 2px rgba(0, 0, 0, .62), 0 8px 18px rgba(0, 0, 0, .44);
		}

		.app-shell.dev-ui-v22 .premium-hud :global(.hud-icon--v21 > .ui-surface),
		.app-shell.dev-ui-v22 .premium-hud .reel-bet-control .premium-panel-art {
			display: block;
		}
	}

	@media (min-width: 468px) and (max-width: 700px) and (max-height: 560px) and (min-aspect-ratio: 2/1) {
		.app-shell.dev-ui-v22 .premium-hud {
			grid-template-columns: repeat(10, 44px);
			grid-template-rows: 44px;
			align-content: center;
			justify-content: space-evenly;
			padding: 0 !important;
		}
	}

	@media (max-width: 467px) and (max-height: 560px) and (min-aspect-ratio: 2/1) {
		.app-shell.dev-ui-v22 .premium-hud {
			top: min(73.35%, calc(50dvh + 50% - 92px));
			height: 92px;
			grid-template-columns: repeat(5, 44px);
			grid-template-rows: repeat(2, 44px);
			align-content: center;
			justify-content: space-around;
			gap: 4px 0;
		}
	}

	@media (max-width: 620px) {
		.app-shell.dev-ui-v22 .rules-copy-grid {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	@media (max-width: 700px) and (max-height: 430px) {
		.app-shell.dev-ui-v22 :is(.menu-dialog:not(.mode-dialog), .settings-dialog) {
			display: grid;
			grid-template-rows: auto minmax(0, 1fr);
			overflow: hidden !important;
		}

		.app-shell.dev-ui-v22 .confirmation-dialog {
			height: calc(100dvh - 16px);
			max-height: calc(100dvh - 16px) !important;
			overflow: hidden !important;
		}

		.app-shell.dev-ui-v22 .menu-dialog:not(.mode-dialog) .menu-actions,
		.app-shell.dev-ui-v22 .settings-dialog .settings-body,
		.app-shell.dev-ui-v22 .confirmation-dialog .confirmation-scroll {
			min-height: 0;
			overflow-y: auto;
			overscroll-behavior: contain;
			align-content: start;
		}
	}

	@media (max-width: 480px) and (max-height: 430px) and (orientation: portrait) {
		/* The authored 320/390 shells are taller than these embedded viewports.
		   Keep gameplay visible and dock one complete, source-ordered command tray
		   to the viewport instead of clipping or stacking invisible hitboxes. */
		.app-shell.dev-ui-v22 .scene-world {
			top: 50%;
			left: 50%;
			width: min(100vw, calc(100dvh * 320 / 568));
			height: auto;
			aspect-ratio: 320 / 568;
			overflow: visible;
			transform: translate(-50%, -50%);
		}

		.app-shell.dev-ui-v22 .breach-monitor {
			clip-path: none;
		}

		.app-shell.dev-ui-v22 .result-ticker .responsive-penguin-cameo {
			display: none;
		}

		.app-shell.dev-ui-v22 .result-ticker {
			justify-content: space-between;
			gap: 4px;
			padding-inline: 8px !important;
		}

		.app-shell.dev-ui-v22 .premium-hud {
			position: absolute;
			top: calc(100dvh - 96px);
			left: 50%;
			display: grid !important;
			width: 100vw;
			height: 92px;
			grid-template-columns: repeat(5, minmax(44px, 1fr));
			grid-template-rows: repeat(2, 44px);
			align-content: center;
			align-items: center;
			gap: 4px 0;
			padding: 0 4px;
			border-block: 1px solid rgba(204, 164, 94, .62);
			background:
				radial-gradient(ellipse at 50% 16%, rgba(212, 174, 105, .11), transparent 58%),
				linear-gradient(180deg, rgba(21, 22, 19, .998), rgba(3, 6, 7, .998));
			box-shadow: inset 0 0 0 2px rgba(0, 0, 0, .64), 0 -8px 20px rgba(0, 0, 0, .52);
			transform: translateX(-50%);
		}

		/* The tall phone artwork is letterboxed in ultra-short portrait embeds.
		   Mask its unused baked lower wells before the single live command tray,
		   so the interface never reads as two stacked HUDs. */
		.app-shell.dev-ui-v22 .premium-hud::before {
			position: absolute;
			z-index: 0;
			top: -52px;
			left: 0;
			display: block;
			width: 100%;
			height: 52px;
			border-top: 1px solid rgba(204, 164, 94, .24);
			background:
				linear-gradient(180deg, rgba(1, 3, 4, .82), rgba(2, 4, 5, .995) 72%),
				radial-gradient(ellipse at 50% 0%, rgba(201, 161, 91, .08), transparent 68%);
			content: '';
			pointer-events: none;
		}

		.app-shell.dev-ui-v22 .hud-tools,
		.app-shell.dev-ui-v22 .control-deck {
			display: contents;
		}

		.app-shell.dev-ui-v22 :is(
			.hud-tools .round-tool,
			.control-deck .bet-step,
			.reel-console .reel-bet-control,
			.reel-console .reel-spin
		) {
			position: relative !important;
			top: auto !important;
			left: auto !important;
			width: 44px;
			height: 44px;
			min-width: 44px;
			min-height: 44px;
			align-self: center;
			justify-self: center;
			translate: 0 !important;
		}

		.app-shell.dev-ui-v22 .hud-tools-left .round-tool:nth-child(1) { grid-column: 1; grid-row: 1; }
		.app-shell.dev-ui-v22 .hud-tools-left .round-tool:nth-child(2) { grid-column: 2; grid-row: 1; }
		.app-shell.dev-ui-v22 .hud-tools-left .round-tool:nth-child(3) { grid-column: 3; grid-row: 1; }
		.app-shell.dev-ui-v22 .bet-step-minus { grid-column: 4; grid-row: 1; }
		.app-shell.dev-ui-v22 .reel-console .reel-bet-control { grid-column: 5; grid-row: 1; }
		.app-shell.dev-ui-v22 .bet-step-plus { grid-column: 1; grid-row: 2; }
		.app-shell.dev-ui-v22 .reel-console .reel-spin { grid-column: 2; grid-row: 2; }
		.app-shell.dev-ui-v22 .hud-tools-right .round-tool:nth-child(1) { grid-column: 3; grid-row: 2; }
		.app-shell.dev-ui-v22 .hud-tools-right .round-tool:nth-child(2) { grid-column: 4; grid-row: 2; }
		.app-shell.dev-ui-v22 .hud-tools-right .round-tool:nth-child(3) { grid-column: 5; grid-row: 2; }

		.app-shell.dev-ui-v22 .reel-console .reel-bet-control {
			display: grid;
			grid-template-rows: minmax(0, 1fr);
			place-content: stretch;
			gap: 0;
			padding: 0;
		}

		.app-shell.dev-ui-v22 .reel-console .reel-bet-control > span,
		.app-shell.dev-ui-v22 :is(.balance-meter, .total-meter, .win-meter, .secondary-deck) {
			display: none;
		}

		.app-shell.dev-ui-v22 .reel-console .reel-bet-control :is(select, .amount-range) {
			align-self: stretch;
			width: 100%;
			height: 44px;
			min-height: 44px;
		}

		.app-shell.dev-ui-v22 .premium-hud :global(.hud-icon--v21 > .ui-surface),
		.app-shell.dev-ui-v22 .premium-hud .reel-bet-control .premium-panel-art {
			display: block;
		}
	}

	/* V27 replaces the last CSS-drawn information surfaces while all readable
	   copy, images, focus targets and live-region semantics remain DOM-native. */
	.app-shell.dev-ui-v27 .v27-surface-carrier:not(.compact-value-strip) {
		position: relative;
		isolation: isolate;
	}

	.app-shell.dev-ui-v27 .compact-value-strip.v27-surface-carrier {
		isolation: isolate;
	}

	:global(.app-shell.dev-ui-v27 .v27-surface-carrier > .ui-surface) {
		z-index: 0;
	}

	:global(.app-shell.dev-ui-v27 .v27-surface-carrier > .ui-surface ~ *) {
		z-index: 1;
	}

	.app-shell.dev-ui-v27 :is(
		.v27-chip-surface,
		.v27-feature-surface,
		.v27-content-surface,
		.v27-modal-header
	) {
		border-color: transparent !important;
		background: transparent !important;
		box-shadow: none !important;
	}

	.app-shell.dev-ui-v27 .v27-live-copy {
		position: relative;
		z-index: 1;
		color: inherit;
		font: inherit;
		letter-spacing: inherit;
	}

	.app-shell.dev-ui-v27 .v27-modal-header > div,
	.app-shell.dev-ui-v27 .v27-modal-header > button,
	:global(.app-shell.dev-ui-v27 .runtime-error-content > :not(.ui-surface)) {
		position: relative;
		z-index: 1;
	}

	.app-shell.dev-ui-v27 .runtime-error-content {
		display: grid;
		min-width: 0;
		gap: 7px;
		padding: 14px 16px;
		overflow-wrap: anywhere;
		text-align: center;
	}

	.app-shell.dev-ui-v27 .runtime-error-content > strong {
		color: #ff928b;
		font-size: clamp(14px, 2.8cqw, 19px);
		letter-spacing: .12em;
	}

	.app-shell.dev-ui-v27 .runtime-error-content > span {
		color: #d8c8c4;
		font-size: clamp(11px, 1.8cqw, 14px);
		line-height: 1.45;
	}

	.app-shell.dev-ui-v27 .v27-responsive-hud-rail {
		position: absolute;
		z-index: 0;
		display: none;
		isolation: isolate;
		pointer-events: none;
	}

	:global(.app-shell.dev-ui-v27 .v27-responsive-hud-rail > .ui-surface) {
		position: absolute;
		inset: 0;
	}

	@media (min-width: 481px) and (min-height: 561px) and (max-aspect-ratio: 5/4) {
		.app-shell.dev-ui-v27 .premium-hud::before { display: none !important; }
		.app-shell.dev-ui-v27 .v27-responsive-hud-rail {
			top: 0;
			left: 0;
			display: block;
			width: 100%;
			height: var(--v22-live-rail-height);
		}
	}

	@media (max-width: 700px) and (max-height: 560px) and (min-aspect-ratio: 2/1) {
		.app-shell.dev-ui-v27 .premium-hud {
			border-color: transparent !important;
			background: transparent !important;
			box-shadow: none !important;
		}

		.app-shell.dev-ui-v27 .v27-responsive-hud-rail {
			inset: 0;
			display: block;
		}
	}

	@media (max-width: 480px) and (max-height: 430px) and (orientation: portrait) {
		.app-shell.dev-ui-v27 .premium-hud {
			border-color: transparent !important;
			background: transparent !important;
			box-shadow: none !important;
		}

		.app-shell.dev-ui-v27 .premium-hud::before { display: none !important; }
		.app-shell.dev-ui-v27 .v27-responsive-hud-rail {
			inset: -52px 0 0;
			display: block;
		}
	}

	@media (max-width: 380px) and (max-height: 700px) and (orientation: portrait) {
		.app-shell.dev-ui-v27 .control-deck .reel-bet-control > span {
			display: none !important;
		}

		.app-shell.dev-ui-v27 .control-deck :is(.balance-meter, .total-meter) > span {
			font-size: 7px;
			letter-spacing: .06em;
		}

		.app-shell.dev-ui-v27 .control-deck :is(.balance-meter, .total-meter) > strong {
			font-size: 10px;
		}

		.app-shell.dev-ui-v27 .round-tool > span:last-child,
		.app-shell.dev-ui-v27 .responsive-spin-label {
			font-size: 7px;
			letter-spacing: .02em;
		}

		.app-shell.dev-ui-v27 .compact-value-strip {
			top: calc(100% - 1px);
			grid-template-columns: 1fr;
			height: 18px;
			padding: 0 12px;
		}

		.app-shell.dev-ui-v27 .compact-value-strip > span:is(.compact-operative-badge, .compact-balance-value, .compact-bet-value) {
			display: none !important;
		}

		.app-shell.dev-ui-v27 .compact-value-strip > .compact-win-value {
			display: flex;
			justify-content: center;
			gap: 7px;
		}

		.app-shell.dev-ui-v27 .compact-value-strip > .compact-win-value small {
			font-size: 8px;
			letter-spacing: .12em;
		}

		.app-shell.dev-ui-v27 .compact-value-strip > .compact-win-value b {
			font-size: 11px;
			letter-spacing: .08em;
		}
	}

	/* During free spins the telemetry becomes the primary header. Reclaim the
	   normal identity/status band so the spin count and expanding symbol are
	   genuinely large instead of only declaring sizes that a shallow rail clips. */
	.app-shell.dev-ui-v22 .breach-monitor.feature-active .monitor-header {
		display: none;
	}

	.app-shell.dev-ui-v22 .reel-mechanic-strip.feature-strip {
		container-name: feature-telemetry-rail;
		container-type: size;
		grid-template-columns: 1.3fr 1.5fr .7fr;
	}

	@media (min-aspect-ratio: 5/4) {
		.app-shell.dev-ui-v22 .breach-monitor.feature-active .reel-mechanic-strip.feature-strip {
			top: 8.077%;
			height: 12.15%;
		}
	}

	@media (min-width: 481px) and (min-height: 561px) and (max-aspect-ratio: 5/4) {
		.app-shell.dev-ui-v22 .breach-monitor.feature-active .reel-mechanic-strip.feature-strip {
			top: 4.2%;
			height: 15.6%;
		}
	}

	@media (max-width: 480px) and (orientation: portrait) {
		.app-shell.dev-ui-v22 .breach-monitor.feature-active .reel-mechanic-strip.feature-strip {
			top: 3.7%;
			height: 14.1%;
			grid-template-columns: 1.2fr 1.4fr .9fr;
		}
	}

	@media (max-height: 560px) and (min-aspect-ratio: 2/1) {
		.app-shell.dev-ui-v22 .breach-monitor.feature-active .reel-mechanic-strip.feature-strip {
			top: 0;
			left: 0;
			display: block !important;
			width: 100%;
			height: 100%;
			pointer-events: none;
		}

		.app-shell.dev-ui-v22 .breach-monitor.feature-active .reel-mechanic-strip.feature-strip > :global(.feature-hud-surface[data-feature-hud-kind='progress']) {
			position: absolute;
			top: 10%;
			left: 1.2%;
			width: 13.7%;
			height: 28%;
		}

		.app-shell.dev-ui-v22 .breach-monitor.feature-active .reel-mechanic-strip.feature-strip > :global(.feature-hud-surface[data-feature-hud-kind='target']) {
			position: absolute;
			top: 10%;
			left: 85.1%;
			width: 13.7%;
			height: 28%;
		}

		.app-shell.dev-ui-v22 .breach-monitor.feature-active .reel-mechanic-strip.feature-strip > :global(.feature-hud-surface[data-feature-hud-kind='win']) {
			position: absolute;
			top: .8%;
			left: 31%;
			width: 38%;
			height: 5.3%;
		}
	}

	/* V35 alignment and hierarchy lock. This final layer intentionally sits after
	   every authored-shell breakpoint so no legacy rule can reintroduce clipped
	   labels, equal-height modal rows or rectangular focus rings. */
	.app-shell.dev-ui-v22 :is(.round-tool, .bet-step, .reel-spin) {
		display: grid;
		place-items: center;
		padding: 0 !important;
		border-radius: 50% !important;
	}

	.app-shell.dev-ui-v22 :is(.round-tool, .bet-step, .reel-spin):focus-visible {
		border-radius: 50% !important;
		outline-offset: 2px !important;
	}

	.app-shell.dev-ui-v22 :is(.balance-meter, .control-meter, .status-plate) {
		place-content: center;
		place-items: center;
		text-align: center;
	}

	.app-shell.dev-ui-v22 .status-plate {
		display: grid;
	}

	.app-shell.dev-ui-v22 .lifecycle--cinematic :global(.cinematic-status) {
		grid-template-columns: 10px minmax(0, 1fr) !important;
		grid-template-rows: minmax(0, 1fr) 2px !important;
	}

	.app-shell.dev-ui-v22 .lifecycle--cinematic :global(.cinematic-status__copy) {
		grid-column: 2 !important;
		min-width: 0;
		width: 100%;
	}

	.app-shell.dev-ui-v22 .lifecycle--cinematic :global(.cinematic-status__state) {
		display: none !important;
	}

	.app-shell.dev-ui-v22 .breach-monitor.feature-active .monitor-header {
		display: none !important;
	}

	.app-shell.dev-ui-v22 :is(.mode-dialog-list, .game-guide-scroll, .settings-body, .auto-body, .confirmation-scroll) {
		scrollbar-color: #c18d43 #071011;
		scrollbar-width: thin;
	}

	.app-shell.dev-ui-v22 :is(.mode-dialog-list, .game-guide-scroll, .settings-body, .auto-body, .confirmation-scroll)::-webkit-scrollbar {
		width: 8px;
		height: 8px;
	}

	.app-shell.dev-ui-v22 :is(.mode-dialog-list, .game-guide-scroll, .settings-body, .auto-body, .confirmation-scroll)::-webkit-scrollbar-track {
		background: #071011;
	}

	.app-shell.dev-ui-v22 :is(.mode-dialog-list, .game-guide-scroll, .settings-body, .auto-body, .confirmation-scroll)::-webkit-scrollbar-thumb {
		border: 2px solid #071011;
		background: #c18d43;
	}

	.app-shell.dev-ui-v22 .mode-dialog {
		width: min(980px, calc(100vw - 32px));
		height: auto !important;
		min-height: 0 !important;
		max-height: calc(100dvh - 32px) !important;
		overflow: hidden !important;
	}

	.app-shell.dev-ui-v22 .mode-dialog-list {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		grid-template-rows: none !important;
		grid-auto-rows: minmax(210px, auto);
		align-content: start;
		align-items: stretch;
		gap: 12px;
		padding: 18px;
		overflow: auto;
		overscroll-behavior: contain;
	}

	.app-shell.dev-ui-v22 .mode-dialog-list button {
		display: grid !important;
		height: auto !important;
		min-height: 210px !important;
		grid-template-columns: minmax(58px, 22%) minmax(0, 1fr) auto !important;
		grid-template-rows: auto minmax(52px, 1fr) auto !important;
		align-content: stretch;
		align-items: start;
		gap: 8px 10px;
		padding: 18px 14px 16px !important;
	}

	.app-shell.dev-ui-v22 .mode-dialog-list button > span {
		grid-column: 2;
		grid-row: 1;
		align-self: center;
		padding: 0 !important;
		font-size: clamp(12px, 1.05vw, 15px);
		line-height: 1.15;
	}

	.app-shell.dev-ui-v22 .mode-dialog-list button > small {
		grid-column: 2 / -1 !important;
		grid-row: 2 !important;
		display: -webkit-box !important;
		align-self: start;
		max-height: 4.2em !important;
		margin: 0 !important;
		padding: 0 !important;
		overflow: hidden;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		font-size: 11px;
		line-height: 1.4;
	}

	.app-shell.dev-ui-v22 .mode-dialog-list button > strong {
		position: relative !important;
		top: auto !important;
		right: auto !important;
		bottom: auto !important;
		grid-column: 3;
		grid-row: 1;
		align-self: start;
		justify-self: end;
		font-size: clamp(18px, 1.6vw, 23px);
		line-height: 1;
	}

	.app-shell.dev-ui-v22 .mode-card-meta {
		position: relative;
		z-index: 2;
		display: flex;
		grid-column: 2 / -1;
		grid-row: 3;
		min-width: 0;
		align-items: end;
		justify-content: flex-end;
		gap: 8px;
		padding: 0 !important;
	}

	.app-shell.dev-ui-v22 .mode-card-facts {
		display: none !important;
	}

	.app-shell.dev-ui-v22 .mode-card-meta > em {
		display: inline-grid;
		min-height: 28px;
		place-items: center;
		margin-left: auto;
		padding: 5px 10px;
		white-space: nowrap;
	}

	.app-shell.dev-ui-v22 .rules-dialog {
		height: auto !important;
		min-height: 0 !important;
		max-height: calc(100dvh - 32px) !important;
		overflow: hidden !important;
	}

	.app-shell.dev-ui-v22 .game-guide-scroll {
		min-height: 0;
		max-height: min(66dvh, 650px);
		overflow: auto;
		overscroll-behavior: contain;
	}

	.app-shell.dev-ui-v22 .game-guide-panel {
		min-height: 0;
	}

	.app-shell.dev-ui-v22 .rules-lead {
		display: none;
	}

	.app-shell.dev-ui-v22 .guide-four-steps {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}

	.app-shell.dev-ui-v22 .guide-four-steps article {
		min-height: 88px !important;
		grid-template-rows: auto auto;
		align-content: start;
		row-gap: 5px;
	}

	.app-shell.dev-ui-v22 .symbol-card-grid.compact {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}

	@media (min-aspect-ratio: 5/4) {
		.app-shell.dev-ui-v22 .monitor-header {
			display: grid;
			grid-template-columns: minmax(0, 1fr) max-content minmax(200px, 230px);
			align-items: center;
			gap: 10px;
		}

		.app-shell.dev-ui-v22 .monitor-identity {
			min-width: 0;
		}

		.app-shell.dev-ui-v22 .monitor-identity h1 {
			overflow: visible;
			text-overflow: clip;
		}

		.app-shell.dev-ui-v22 .selected-mode-carrier {
			width: max-content;
			max-width: 230px;
			min-width: 0;
		}

		.app-shell.dev-ui-v22 .selected-mode-carrier small {
			display: block !important;
		}

		.app-shell.dev-ui-v22 .selected-mode-carrier .mode-label-full {
			display: inline !important;
		}

		.app-shell.dev-ui-v22 .selected-mode-carrier .mode-label-compact {
			display: none !important;
		}

		.app-shell.dev-ui-v22 .lifecycle.lifecycle--cinematic {
			width: 100%;
			min-width: 0;
			max-width: none;
		}
	}

	@media (max-width: 700px) {
		.app-shell.dev-ui-v22 .mode-dialog {
			width: calc(100vw - 16px);
			height: auto !important;
			max-height: calc(100dvh - 16px) !important;
		}

		.app-shell.dev-ui-v22 .mode-dialog-list {
			grid-template-columns: minmax(0, 1fr);
			grid-auto-rows: minmax(140px, auto);
			gap: 8px;
			padding: 8px 10px 12px;
			max-height: calc(100dvh - 88px);
		}

		.app-shell.dev-ui-v22 .mode-dialog-list button {
			min-height: 140px !important;
			grid-template-columns: minmax(64px, 22%) minmax(0, 1fr) auto !important;
			grid-template-rows: auto minmax(36px, 1fr) auto !important;
			gap: 5px 8px;
			padding: 13px 12px 12px !important;
		}

		.app-shell.dev-ui-v22 .mode-dialog-list button > small {
			max-height: 2.8em !important;
			-webkit-line-clamp: 2;
			line-clamp: 2;
			font-size: 9px;
		}

		.app-shell.dev-ui-v22 .guide-four-steps {
			grid-template-columns: minmax(0, 1fr);
		}

		.app-shell.dev-ui-v22 .symbol-card-grid.compact {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 380px) and (orientation: portrait) {
		.app-shell.dev-ui-v22 .compact-value-strip {
			top: 100% !important;
		}
	}

	@media (max-width: 480px) and (orientation: portrait) {
		/* The portrait cabinet already dedicates three labelled value wells to
		   balance, bet and win. The desktop status plate otherwise stretches over
		   those labels as a fourth, redundant full-width box. */
		.app-shell.dev-ui-v22 .status-plate {
			display: none !important;
		}
	}

	@media (max-height: 560px) and (min-aspect-ratio: 2/1) {
		.app-shell.dev-ui-v22 .mode-dialog {
			height: calc(100dvh - 16px) !important;
			max-height: calc(100dvh - 16px) !important;
		}

		.app-shell.dev-ui-v22 .monitor-header {
			top: 0 !important;
		}

		.app-shell.dev-ui-v22 .status-plate {
			display: none !important;
		}

		.app-shell.dev-ui-v22 .lifecycle--cinematic :global(.cinematic-status__headline) {
			display: block !important;
			overflow: hidden;
			color: #f6e4bd;
			font-size: 7.5px;
			line-height: 1;
			text-align: center;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.app-shell.dev-ui-v22 .mode-dialog-list {
			grid-template-columns: minmax(0, 1fr);
			grid-auto-rows: minmax(104px, auto);
			gap: 5px;
			padding: 6px 8px;
		}

		.app-shell.dev-ui-v22 .mode-dialog-list button {
			min-height: 104px !important;
			grid-template-columns: minmax(48px, 17%) minmax(0, 1fr) auto !important;
			grid-template-rows: auto minmax(24px, 1fr) auto !important;
			gap: 2px 7px;
			padding: 8px 10px !important;
		}

		.app-shell.dev-ui-v22 .mode-dialog-list button > span {
			font-size: 11px;
		}

		.app-shell.dev-ui-v22 .mode-dialog-list button > small {
			max-height: 2.6em !important;
			font-size: 8.5px;
			line-height: 1.3;
		}

		.app-shell.dev-ui-v22 .mode-dialog-list button > strong {
			font-size: 15px;
		}

		.app-shell.dev-ui-v22 .mode-card-meta > em {
			min-height: 20px;
			padding: 2px 6px;
			font-size: 6px;
		}

		.app-shell.dev-ui-v22 .rules-dialog > header {
			min-height: 52px;
			padding: 7px 12px !important;
		}

		.app-shell.dev-ui-v22 .guide-tabs {
			gap: 3px;
			padding: 4px 8px;
		}

		.app-shell.dev-ui-v22 .guide-tabs button {
			min-height: 44px;
		}

		.app-shell.dev-ui-v22 .rules-dialog {
			height: calc(100dvh - 16px) !important;
			max-height: calc(100dvh - 16px) !important;
		}

		.app-shell.dev-ui-v22 .game-guide-scroll {
			max-height: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.app-shell.dev-ui-v22 :is(.round-tool, .bet-step, .reel-spin, .menu-actions button, .mode-dialog-list button, .modal-actions button, .auto-options button, .settings-body > button) {
			transition: none !important;
			transform: none !important;
		}

		.app-shell.dev-ui-v22 .modal-backdrop,
		.app-shell.dev-ui-v22 .modal-backdrop > :is(.menu-dialog, .mode-dialog, .confirmation-dialog, .rules-dialog, .auto-dialog, .settings-dialog) {
			animation: none !important;
		}
	}

	/* V36 command-interface rebuild. V22/V27 remain the art owners; this layer
	   owns information hierarchy, readable type, interaction geometry and the
	   responsive recomposition. */
	.app-shell.blacksite-ui-v36 {
		--v36-ink: #050809;
		--v36-panel: rgba(7, 11, 12, .94);
		--v36-panel-soft: rgba(11, 16, 16, .82);
		--v36-line: rgba(198, 153, 78, .58);
		--v36-line-soft: rgba(132, 145, 138, .34);
		--v36-gold: #f1c978;
		--v36-copy: #f5eee0;
		--v36-muted: #aeb9b4;
		--v36-danger: #f07a67;
		--v36-gap: 8px;
		font-variant-numeric: tabular-nums;
	}

	.app-shell.blacksite-ui-v36 .result-ticker > span:not(.responsive-penguin-cameo),
	.app-shell.blacksite-ui-v36 .result-ticker > strong {
		transition: opacity 150ms ease-out;
	}

	.app-shell.blacksite-ui-v36 .result-ticker.result-ticker-passive > span:not(.responsive-penguin-cameo),
	.app-shell.blacksite-ui-v36 .result-ticker.result-ticker-passive > strong {
		opacity: .68;
	}

	/* V36 has one canonical BALANCE / TOTAL / WIN row. The legacy compact strip
	   becomes a second WIN readout at 320px and can overlap that row. */
	.app-shell.blacksite-ui-v36 .compact-value-strip {
		display: none !important;
	}

	.app-shell.blacksite-ui-v36 .result-ticker[data-ticker-priority='true'] {
		color: var(--v36-copy);
		text-shadow: 0 1px 7px #000;
	}

	.app-shell.blacksite-ui-v36 .result-ticker[data-ticker-priority='true'] strong {
		color: var(--v36-gold);
	}

	.app-shell.blacksite-ui-v36 .hud-tools .round-tool > span {
		position: absolute;
		z-index: 8;
		bottom: -5px;
		left: 50%;
		display: block !important;
		max-width: calc(100% - 4px);
		padding: 2px 4px;
		overflow: hidden;
		border: 1px solid rgba(190, 148, 79, .48);
		background: rgba(3, 6, 7, .94);
		color: #e9dfcd;
		font: 900 clamp(8px, .58cqw, 10px)/1 ui-monospace, monospace;
		letter-spacing: .04em;
		text-overflow: ellipsis;
		white-space: nowrap;
		transform: translateX(-50%);
		pointer-events: none;
	}

	.app-shell.blacksite-ui-v36 .reel-spin .responsive-spin-label {
		position: absolute;
		z-index: 9;
		bottom: -5px;
		left: 50%;
		display: block !important;
		min-width: 54px;
		padding: 3px 7px;
		border: 1px solid rgba(232, 191, 107, .8);
		background: rgba(3, 6, 7, .96);
		color: #ffe2a3;
		font: 950 9px/1 ui-monospace, monospace;
		letter-spacing: .06em;
		text-align: center;
		white-space: nowrap;
		transform: translateX(-50%);
		pointer-events: none;
	}

	.app-shell.blacksite-ui-v36 :is(.round-tool, .bet-step, .reel-spin):disabled {
		opacity: .44 !important;
	}

	.app-shell.blacksite-ui-v36 :is(.balance-meter, .control-meter, .reel-bet-control) > span,
	.app-shell.blacksite-ui-v36 .reel-bet-control > span:first-child {
		color: var(--v36-muted);
		font-weight: 850;
		letter-spacing: .1em;
	}

	.app-shell.blacksite-ui-v36 :is(.balance-meter, .control-meter) > strong,
	.app-shell.blacksite-ui-v36 .reel-bet-control select,
	.app-shell.blacksite-ui-v36 .reel-bet-control output {
		color: var(--v36-copy);
		font-weight: 950;
		font-variant-numeric: tabular-nums;
		text-shadow: 0 2px 10px #000;
	}

	.app-shell.blacksite-ui-v36 .win-meter > strong {
		color: #ffe09a;
	}

	/* The ticker is the single contextual status line in V36. */
	.app-shell.blacksite-ui-v36 .status-plate {
		display: none !important;
	}

	.app-shell.blacksite-ui-v36 .reel-footer > :is(.premium-footer-id, .premium-footer-clearance) {
		display: none !important;
	}

	.app-shell.blacksite-ui-v36 .breach-monitor.feature-active :is(.bet-step, .reel-bet-control) {
		opacity: .22 !important;
		filter: grayscale(1);
	}

	/* Free spins advance automatically. Keep the authoritative money row, but
	   remove dormant base controls so the feature rail and reels own the scene. */
	.app-shell.blacksite-ui-v36 .breach-monitor.feature-active :is(.bet-step, .reel-bet-control, .reel-spin, .hud-tools) {
		visibility: hidden;
		pointer-events: none;
	}

	.app-shell.blacksite-ui-v36 .modal-backdrop {
		padding: max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left));
		background: radial-gradient(circle at 50% 42%, rgba(88, 62, 30, .12), transparent 42%), rgba(0, 0, 0, .86);
		backdrop-filter: blur(5px);
	}

	.app-shell.blacksite-ui-v36 .modal-backdrop > :is(.menu-dialog, .mode-dialog, .confirmation-dialog, .rules-dialog, .auto-dialog, .settings-dialog) {
		height: auto !important;
		min-height: 0 !important;
		max-height: calc(100dvh - 24px) !important;
		align-self: center;
		justify-self: center;
	}

	.app-shell.blacksite-ui-v36 .menu-dialog:not(.mode-dialog) {
		width: min(760px, calc(100vw - 24px));
	}

	.app-shell.blacksite-ui-v36 .menu-dialog:not(.mode-dialog) .menu-actions {
		grid-auto-rows: minmax(150px, auto);
		gap: 14px;
		padding: 24px;
	}

	.app-shell.blacksite-ui-v36 .menu-dialog:not(.mode-dialog) .menu-actions button {
		height: auto !important;
		min-height: 150px !important;
		padding: 22px 18px 18px !important;
	}

	.app-shell.blacksite-ui-v36 .menu-dialog:not(.mode-dialog) .menu-actions button > span {
		font-size: 13px;
		line-height: 1.2;
	}

	.app-shell.blacksite-ui-v36 .menu-dialog:not(.mode-dialog) .menu-actions button > small {
		font-size: 12px;
		line-height: 1.45;
	}

	.app-shell.blacksite-ui-v36 :is(.auto-dialog, .settings-dialog) {
		display: grid;
		width: min(540px, calc(100vw - 24px));
		grid-template-rows: auto minmax(0, auto);
		overflow: hidden !important;
	}

	.app-shell.blacksite-ui-v36 :is(.auto-body, .settings-body) {
		min-height: 0;
		max-height: calc(100dvh - 112px);
		align-content: start;
		gap: 12px;
		padding: 20px;
		overflow-y: auto;
	}

	.app-shell.blacksite-ui-v36 :is(.auto-body, .settings-body) > p {
		font-size: 13px;
		line-height: 1.55;
	}

	.app-shell.blacksite-ui-v36 .settings-body > button {
		min-height: 56px;
		font-size: 13px;
	}

	.app-shell.blacksite-ui-v36 .confirmation-dialog {
		width: min(620px, calc(100vw - 24px));
	}

	.app-shell.blacksite-ui-v36 .confirmation-scroll {
		max-height: calc(100dvh - 24px);
		align-content: start;
		padding: clamp(20px, 3vw, 34px);
	}

	.app-shell.blacksite-ui-v36 .rules-dialog {
		width: min(1080px, calc(100vw - 24px));
	}

	.app-shell.blacksite-ui-v36 .game-guide-scroll {
		max-height: min(70dvh, 680px);
	}

	.app-shell.blacksite-ui-v36 .game-guide-panel {
		font-size: 13px;
		line-height: 1.5;
	}

	.app-shell.blacksite-ui-v36 .game-guide-panel :is(p, small) {
		font-size: max(12px, 1em);
		line-height: 1.5;
	}

	.app-shell.blacksite-ui-v36 .guide-tabs button {
		min-height: 48px;
		font-size: 11px;
	}

	.app-shell.blacksite-ui-v36 .vault-timeline {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 8px;
	}

	.app-shell.blacksite-ui-v36 .vault-timeline > span {
		min-height: 92px;
		align-content: center;
		gap: 8px;
		padding: 12px;
	}

	.app-shell.blacksite-ui-v36 .vault-timeline > span small {
		font-size: 11px;
		line-height: 1.35;
	}

	.app-shell.blacksite-ui-v36 .vault-guide-hero {
		padding: 16px 18px 26px;
	}

	.app-shell.blacksite-ui-v36 .vault-guide-hero > div {
		display: grid;
		gap: 5px;
	}

	.app-shell.blacksite-ui-v36 .vault-guide-hero p {
		margin: 0;
	}

	.app-shell.blacksite-ui-v36 .mode-dialog-list button[data-mode-state='CURRENT'] {
		box-shadow: inset 0 0 0 1px rgba(239, 194, 106, .78), inset 0 0 32px rgba(209, 155, 66, .09);
	}

	.app-shell.blacksite-ui-v36 .mode-dialog-list button > small.mode-card-effect {
		color: #bfc8c4;
		font-size: 12px;
		line-height: 1.45;
	}

	.app-shell.blacksite-ui-v36 .mode-card-meta > em {
		font-size: 9px;
		letter-spacing: .08em;
	}

	@media (max-width: 700px) {
		.app-shell.blacksite-ui-v36 .modal-backdrop {
			padding: 8px;
		}

		.app-shell.blacksite-ui-v36 .modal-backdrop > :is(.menu-dialog, .mode-dialog, .confirmation-dialog, .rules-dialog, .auto-dialog, .settings-dialog) {
			width: calc(100vw - 16px);
			max-height: calc(100dvh - 16px) !important;
		}

		.app-shell.blacksite-ui-v36 .menu-dialog:not(.mode-dialog) .menu-actions {
			grid-template-columns: minmax(0, 1fr);
			grid-auto-rows: auto;
			gap: 8px;
			padding: 10px;
		}

		.app-shell.blacksite-ui-v36 .menu-dialog:not(.mode-dialog) .menu-actions button {
			min-height: 82px !important;
			grid-template-rows: auto auto !important;
			align-content: center !important;
			row-gap: 5px;
			padding: 12px 14px !important;
		}

		.app-shell.blacksite-ui-v36 .menu-dialog:not(.mode-dialog) .menu-actions button > :is(span, small) {
			align-self: center;
		}

		.app-shell.blacksite-ui-v36 .mode-dialog-list button > small.mode-card-effect {
			font-size: 11px;
		}

		.app-shell.blacksite-ui-v36 .game-guide-scroll {
			max-height: calc(100dvh - 116px);
		}

		.app-shell.blacksite-ui-v36 .game-guide-panel {
			font-size: 13px;
		}

		.app-shell.blacksite-ui-v36 .vault-timeline {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.app-shell.blacksite-ui-v36 .vault-guide-hero {
			gap: 10px;
			padding: 14px 12px 32px;
		}
	}

	@media (max-width: 480px) and (min-height: 431px) and (orientation: portrait) {
		.app-shell.blacksite-ui-v36 .monitor-identity > span,
		.app-shell.blacksite-ui-v36 .selected-mode-carrier > small,
		.app-shell.blacksite-ui-v36 .lifecycle small {
			font-size: 9px;
		}

		.app-shell.blacksite-ui-v36 .selected-mode-carrier strong,
		.app-shell.blacksite-ui-v36 .lifecycle strong {
			font-size: 10px;
		}

		.app-shell.blacksite-ui-v36 .reel-mechanic-strip:not(.feature-strip) :global(.feature-hud-surface__value) {
			font-size: 14px;
		}

		.app-shell.blacksite-ui-v36 .reel-mechanic-strip:not(.feature-strip) :global(.feature-hud-surface__secondary) {
			font-size: 10px;
		}

		.app-shell.blacksite-ui-v36 .payline-overlay img:not(:first-child) {
			display: none;
		}

		.app-shell.blacksite-ui-v36 .premium-hud {
			top: 63.27%;
			left: 2.56%;
			width: 95.13%;
			height: 35.55%;
		}

		.app-shell.blacksite-ui-v36 .hud-tools {
			top: auto;
			bottom: 2%;
			height: max(44px, 16%);
		}

		.app-shell.blacksite-ui-v36 .hud-tools-left {
			left: 2%;
			width: 48%;
		}

		.app-shell.blacksite-ui-v36 .hud-tools-right {
			left: 50%;
			width: 48%;
		}

		.app-shell.blacksite-ui-v36 .hud-tools .round-tool {
			top: 0;
			height: 100%;
		}

		.app-shell.blacksite-ui-v36 .hud-tools .round-tool > span {
			bottom: 1px;
			max-width: 54px;
			padding-inline: 3px;
			font-size: 8px;
		}

		.app-shell.blacksite-ui-v36 .control-deck .balance-meter,
		.app-shell.blacksite-ui-v36 .control-deck .control-meter {
			top: 2%;
			display: grid;
			width: 28%;
			height: 20%;
			min-height: 44px;
			place-content: center;
			gap: 2px;
			padding: 4px 6px;
			border: 1px solid rgba(177, 138, 73, .4);
			background: linear-gradient(180deg, rgba(16, 20, 19, .94), rgba(4, 7, 8, .96));
			box-shadow: inset 0 1px rgba(255, 235, 195, .06);
			text-align: center;
		}

		.app-shell.blacksite-ui-v36 .control-deck .balance-meter { left: 2%; }
		.app-shell.blacksite-ui-v36 .control-deck .total-meter { left: 36%; }
		.app-shell.blacksite-ui-v36 .control-deck .win-meter { left: 70%; }

		.app-shell.blacksite-ui-v36 .control-deck :is(.balance-meter, .control-meter) span {
			display: block;
			font-size: 10px;
			line-height: 1;
		}

		.app-shell.blacksite-ui-v36 .control-deck :is(.balance-meter, .control-meter) strong {
			font-size: 15px;
			line-height: 1;
		}

		.app-shell.blacksite-ui-v36 .bet-step-minus,
		.app-shell.blacksite-ui-v36 .bet-step-plus {
			top: 24%;
			width: 12%;
			height: 18%;
			min-height: 44px;
		}

		.app-shell.blacksite-ui-v36 .bet-step-minus { left: 27%; }
		.app-shell.blacksite-ui-v36 .bet-step-plus { left: 61%; }

		.app-shell.blacksite-ui-v36 .reel-console .reel-bet-control {
			top: 24%;
			left: 39%;
			width: 22%;
			height: 18%;
			min-height: 44px;
			padding: 2px 4px;
			border: 1px solid rgba(177, 138, 73, .4);
			background: rgba(4, 7, 8, .94);
		}

		.app-shell.blacksite-ui-v36 .reel-console .reel-bet-control > span:first-child {
			display: block;
			font-size: 9px;
		}

		.app-shell.blacksite-ui-v36 .reel-console .reel-bet-control select,
		.app-shell.blacksite-ui-v36 .reel-console .reel-bet-control .amount-range {
			font-size: 14px;
		}

		.app-shell.blacksite-ui-v36 .reel-console .reel-spin {
			top: 52%;
			left: 39%;
			width: 22%;
			height: 26%;
			min-width: 58px;
			min-height: 58px;
		}

		.app-shell.blacksite-ui-v36 .responsive-spin-label {
			bottom: 1px;
			font-size: 10px;
		}

		.app-shell.blacksite-ui-v36 .compact-value-strip small {
			font-size: 9px;
		}

		.app-shell.blacksite-ui-v36 .compact-value-strip b {
			font-size: 11px;
		}

		/* Jurisdiction-controlled session facts stay visible when the RGS asks
		   for them, but occupy the narrow authored gap between reels and ticker. */
		.app-shell.blacksite-ui-v36 .reel-footer:has(.session-readouts) {
			top: 55.1%;
			left: 11.5%;
			width: 77%;
			height: 2.45%;
		}

		.app-shell.blacksite-ui-v36 .reel-footer .session-readouts {
			inset: 0;
			display: grid;
			grid-auto-flow: column;
			grid-auto-columns: minmax(0, 1fr);
			gap: 4px;
		}

		.app-shell.blacksite-ui-v36 .reel-footer .session-readout {
			display: grid;
			min-width: 0;
			grid-template-columns: auto auto;
			place-content: center;
			gap: 4px;
			padding: 0 5px;
		}

		.app-shell.blacksite-ui-v36 .reel-footer .session-readout small {
			font-size: clamp(5px, 1.35cqw, 7px);
			white-space: nowrap;
		}

		.app-shell.blacksite-ui-v36 .reel-footer .session-readout strong {
			font-size: clamp(7px, 2cqw, 10px);
			white-space: nowrap;
		}
	}

	@media (max-width: 380px) and (max-height: 700px) and (orientation: portrait) {
		.app-shell.blacksite-ui-v36 .reel-mechanic-strip:not(.feature-strip) {
			top: 13%;
			height: 5%;
		}

		.app-shell.blacksite-ui-v36 .hud-tools .round-tool > span {
			font-size: 8px;
		}

		.app-shell.blacksite-ui-v36 .reel-console .reel-spin {
			left: 40.5%;
			width: 19%;
		}

		.app-shell.blacksite-ui-v36 .control-deck :is(.balance-meter, .control-meter) span {
			font-size: 9px;
		}

		.app-shell.blacksite-ui-v36 .control-deck :is(.balance-meter, .control-meter) strong {
			font-size: 13px;
		}
	}

	@media (max-width: 480px) and (max-height: 430px) and (orientation: portrait) {
		/* Preserve the complete authored two-row command tray for embedded, very
		   short portrait surfaces; the taller V36 cabinet geometry starts at 431px. */
		.app-shell.blacksite-ui-v36 .hud-tools .round-tool > span,
		.app-shell.blacksite-ui-v36 .responsive-spin-label {
			display: none !important;
		}

		.app-shell.blacksite-ui-v36 .reel-footer .session-readouts {
			display: none;
		}
	}

	@media (max-height: 560px) and (min-aspect-ratio: 2/1) {
		.app-shell.blacksite-ui-v36 .monitor-header {
			height: 24px !important;
			min-height: 24px !important;
		}

		.app-shell.blacksite-ui-v36 .monitor-identity h1,
		.app-shell.blacksite-ui-v36 .selected-mode-carrier strong,
		.app-shell.blacksite-ui-v36 .lifecycle--cinematic :global(.cinematic-status__headline) {
			font-size: 10px;
		}

		.app-shell.blacksite-ui-v36 .control-deck :is(.balance-meter, .control-meter) span {
			font-size: 8px;
		}

		.app-shell.blacksite-ui-v36 .control-deck :is(.balance-meter, .control-meter) strong {
			font-size: 12px;
		}

		.app-shell.blacksite-ui-v36 .hud-tools .round-tool > span {
			bottom: -3px;
			font-size: 8px;
		}

		.app-shell.blacksite-ui-v36 .payline-overlay img:not(:first-child) {
			display: none;
		}

		.app-shell.blacksite-ui-v36 .breach-monitor .reel-cell .symbol-art {
			inset: 4% 4% 16%;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.app-shell.blacksite-ui-v36 .result-ticker > span,
		.app-shell.blacksite-ui-v36 .result-ticker > strong {
			transition: none;
		}
	}

	/* ---------------------------------------------------------------------
	 * V37 HARD CLEAN
	 *
	 * This is the only final owner for live hierarchy, controls and dialogs.
	 * Earlier generations still own the authored cabinet, reel aperture and
	 * animation timing; no V37 rule creates a second cabinet coordinate plane.
	 * ------------------------------------------------------------------ */
	.app-shell.blacksite-ui-v37 {
		--v37-bg: rgba(4, 7, 8, .975);
		--v37-panel: rgba(8, 12, 13, .965);
		--v37-panel-hover: rgba(18, 22, 21, .98);
		--v37-line: rgba(190, 148, 78, .58);
		--v37-line-soft: rgba(142, 151, 146, .24);
		--v37-gold: #f2ca79;
		--v37-gold-bright: #ffe5a7;
		--v37-copy: #f7f2e9;
		--v37-muted: #aab5b1;
		--v37-danger: #ef7568;
		--v37-control: 52px;
		--v37-spin: 88px;
		font-variant-numeric: tabular-nums;
		-webkit-font-smoothing: antialiased;
		text-rendering: geometricPrecision;
	}

	.app-shell.blacksite-ui-v37 :is(button, select, input) {
		-webkit-tap-highlight-color: transparent;
	}

	.app-shell.blacksite-ui-v37 :is(button, select, input, [tabindex='0']):focus-visible {
		outline: 2px solid var(--v37-gold-bright) !important;
		outline-offset: 3px !important;
	}

	/* One quiet header line: title, mode, runtime. */
	.app-shell.blacksite-ui-v37 .monitor-header {
		display: grid !important;
		grid-template-columns: minmax(0, 1fr) auto auto !important;
		align-items: center !important;
		gap: clamp(8px, .9cqw, 16px) !important;
		padding-inline: clamp(12px, 1.2cqw, 22px) !important;
		border-bottom: 1px solid var(--v37-line-soft) !important;
		background: linear-gradient(90deg, rgba(4, 7, 8, .98), rgba(11, 14, 14, .94), rgba(4, 7, 8, .98)) !important;
		box-shadow: none !important;
	}

	.app-shell.blacksite-ui-v37 .monitor-identity {
		display: grid !important;
		min-width: 0;
		align-content: center;
		gap: 2px;
	}

	.app-shell.blacksite-ui-v37 .monitor-identity > span {
		color: #8e9a96 !important;
		font-size: clamp(8px, .56cqw, 10px) !important;
		line-height: 1 !important;
		letter-spacing: .14em !important;
	}

	.app-shell.blacksite-ui-v37 .monitor-identity h1 {
		display: flex !important;
		min-width: 0;
		align-items: baseline;
		gap: .32em;
		margin: 0;
		font-size: clamp(24px, 2cqw, 34px) !important;
		line-height: .96 !important;
		white-space: nowrap;
	}

	.app-shell.blacksite-ui-v37 :is(.selected-mode-carrier, .lifecycle) {
		position: relative !important;
		inset: auto !important;
		display: grid !important;
		width: auto !important;
		height: auto !important;
		min-width: 0 !important;
		min-height: 34px !important;
		place-content: center !important;
		place-items: center !important;
		gap: 2px !important;
		padding: 5px 10px !important;
		overflow: hidden;
		border: 1px solid var(--v37-line-soft) !important;
		border-radius: 999px;
		background: rgba(6, 10, 11, .9) !important;
		box-shadow: none !important;
		text-align: center;
		transform: none !important;
	}

	.app-shell.blacksite-ui-v37 :is(.selected-mode-carrier, .lifecycle) > :global(.ui-surface) {
		display: none !important;
	}

	.app-shell.blacksite-ui-v37 :is(.selected-mode-carrier, .lifecycle) > small {
		display: none !important;
	}

	.app-shell.blacksite-ui-v37 :is(.selected-mode-carrier, .lifecycle) > strong {
		display: flex !important;
		align-items: baseline !important;
		justify-content: center !important;
		gap: .35em;
		color: var(--v37-copy) !important;
		font-size: clamp(10px, .72cqw, 12px) !important;
		line-height: 1 !important;
		letter-spacing: .06em !important;
		white-space: nowrap;
	}

	.app-shell.blacksite-ui-v37 .lifecycle .pulse {
		position: absolute !important;
		top: 50% !important;
		left: 8px !important;
		width: 6px !important;
		height: 6px !important;
		border: 0 !important;
		border-radius: 50%;
		background: #d6b364 !important;
		box-shadow: 0 0 8px rgba(224, 184, 98, .45) !important;
		transform: translateY(-50%) !important;
	}

	/* The shell contains four baked bays. One opaque rail makes the two useful
	   base facts deliberate instead of visually misregistered. */
	.app-shell.blacksite-ui-v37 .reel-mechanic-strip:not(.feature-strip) {
		display: grid !important;
		grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
		align-items: stretch !important;
		gap: 0 !important;
		padding: 0 !important;
		overflow: hidden !important;
		border: 1px solid var(--v37-line-soft) !important;
		border-radius: 4px;
		background: var(--v37-bg) !important;
		box-shadow: inset 0 1px rgba(255, 242, 212, .035) !important;
	}

	.app-shell.blacksite-ui-v37 .reel-mechanic-strip .mechanic-contract-copy {
		display: none !important;
	}

	.app-shell.blacksite-ui-v37 .reel-mechanic-strip:not(.feature-strip) > :global(.feature-hud-surface) {
		display: flex !important;
		width: 100% !important;
		height: 100% !important;
		min-height: 0 !important;
		align-items: center !important;
		justify-content: center !important;
		gap: 8px !important;
		padding: 4px 10px !important;
		border: 0 !important;
		background: transparent !important;
		text-align: center;
	}

	.app-shell.blacksite-ui-v37 .reel-mechanic-strip:not(.feature-strip) > :global(.feature-hud-surface:first-of-type) {
		border-right: 1px solid var(--v37-line-soft) !important;
	}

	.app-shell.blacksite-ui-v37 .reel-mechanic-strip:not(.feature-strip) :global(.feature-hud-surface__value-row) {
		flex: 0 0 auto !important;
		align-self: center !important;
		min-width: 0 !important;
	}

	.app-shell.blacksite-ui-v37 .reel-mechanic-strip:not(.feature-strip) :global(.feature-hud-surface__value) {
		color: var(--v37-copy) !important;
		font-size: clamp(15px, 1.22cqw, 22px) !important;
		line-height: 1 !important;
		letter-spacing: .03em !important;
	}

	.app-shell.blacksite-ui-v37 .reel-mechanic-strip:not(.feature-strip) :global(.feature-hud-surface__secondary) {
		flex: 0 0 auto !important;
		align-self: center !important;
		color: var(--v37-muted) !important;
		font-size: clamp(10px, .68cqw, 12px) !important;
		font-style: normal !important;
		line-height: 1 !important;
		letter-spacing: .12em !important;
	}

	/* Reels remain dominant; inactive line numbers and heavy cell chrome recede. */
	.app-shell.blacksite-ui-v37 .line-gutter > span {
		opacity: .2 !important;
		filter: saturate(.35) brightness(.72);
		transition: opacity 120ms ease-out, filter 120ms ease-out;
	}

	.app-shell.blacksite-ui-v37 .line-gutter > span.active {
		opacity: 1 !important;
		filter: none;
	}

	.app-shell.blacksite-ui-v37 .v22-reel-bezel {
		opacity: .76;
	}

	.app-shell.blacksite-ui-v37 .breach-monitor .reel-cell::after {
		opacity: .62;
	}

	.app-shell.blacksite-ui-v37 .reel-cell > .symbol-art {
		inset: 7% !important;
		display: grid !important;
		place-items: center !important;
		transform: translateY(-1%) scale(.96) !important;
		transform-origin: center !important;
	}

	.app-shell.blacksite-ui-v37 .reel-cell.rank-glyph > .symbol-art {
		inset: 9% !important;
		transform: translateY(-1%) scale(1.04) !important;
	}

	.app-shell.blacksite-ui-v37 .reel-cell:is(.wild-cell, .breach-cell) > .symbol-art {
		inset: 5% !important;
		transform: translateY(-1%) scale(.98) !important;
	}

	.app-shell.blacksite-ui-v37 .symbol-art > img {
		width: 100% !important;
		height: 100% !important;
		object-fit: contain !important;
		object-position: center !important;
	}

	/* One contextual status line; no footer IDs and no resurrected status well. */
	.app-shell.blacksite-ui-v37 .result-ticker {
		display: flex !important;
		align-items: center !important;
		justify-content: center !important;
		gap: .55em !important;
		padding-inline: 12px !important;
		border: 0 !important;
		background: rgba(3, 6, 7, .96) !important;
		box-shadow: inset 0 1px var(--v37-line-soft) !important;
		color: var(--v37-muted) !important;
		font-size: clamp(10px, .7cqw, 12px) !important;
		letter-spacing: .08em !important;
		text-align: center !important;
	}

	.app-shell.blacksite-ui-v37 .result-ticker::before,
	.app-shell.blacksite-ui-v37 .result-ticker .premium-panel-art,
	.app-shell.blacksite-ui-v37 .result-ticker .responsive-penguin-cameo,
	.app-shell.blacksite-ui-v37 .compact-value-strip,
	.app-shell.blacksite-ui-v37 .secondary-deck,
	.app-shell.blacksite-ui-v37 .status-plate,
	.app-shell.blacksite-ui-v37 .reel-footer,
	.app-shell.blacksite-ui-v37 .reel-footer > :is(.premium-footer-id, .premium-footer-clearance),
	.app-shell.blacksite-ui-v37 .reel-footer > strong {
		display: none !important;
	}

	.app-shell.blacksite-ui-v37 .result-ticker > strong {
		color: var(--v37-gold) !important;
		font-size: 1em !important;
	}

	.app-shell.blacksite-ui-v37 .reel-footer {
		min-height: 20px !important;
		justify-content: center !important;
		padding: 2px 10px !important;
		border-top: 1px solid rgba(142, 151, 146, .18) !important;
		background: #030607 !important;
		font-size: clamp(8px, .55cqw, 10px) !important;
	}

	.app-shell.blacksite-ui-v37 .reel-footer .footer-guide {
		max-width: 100%;
		color: #889491 !important;
		text-align: center;
	}

	/* V38 HUD ASSET RESTORE
	 * The V22 cabinet and V27 reflow rail remain the only physical HUD chrome.
	 * Keep their authored raster wells visible and centre only the live content. */
	.app-shell.blacksite-ui-v37 .premium-hud :is(
		.hud-tools .round-tool,
		.control-deck .bet-step,
		.control-deck .reel-spin
	) > :global(.hud-icon) {
		position: absolute !important;
		inset: 0 !important;
		margin: auto !important;
		transform: none !important;
		transform-origin: center !important;
	}

	.app-shell.blacksite-ui-v37 .premium-hud :is(
		.reel-bet-control,
		.balance-meter,
		.control-meter
	) {
		align-content: center !important;
		align-items: center !important;
		justify-content: center !important;
		justify-items: center !important;
		text-align: center !important;
	}

	.app-shell.blacksite-ui-v37 .premium-hud :is(
		.reel-bet-control,
		.balance-meter,
		.control-meter
	) > :is(.hud-meter-label, strong, select, .amount-range, output) {
		position: relative;
		z-index: 2;
		width: 100%;
		margin-inline: auto;
		text-align: center !important;
		text-align-last: center !important;
	}

	.app-shell.blacksite-ui-v37 .premium-hud .hud-tools .round-tool > .hud-tool-label,
	.app-shell.blacksite-ui-v37 .premium-hud .reel-spin > .responsive-spin-label {
		left: 50% !important;
		margin-inline: 0 !important;
		text-align: center !important;
		transform: translateX(-50%) !important;
	}

	/* Free spins have one persistent telemetry rail. The bottom rail retains
	   only authoritative money values; no mask, blank socket or duplicate CTA. */
	.app-shell.blacksite-ui-v37 .breach-monitor.feature-active .reel-mechanic-strip.feature-strip {
		display: grid !important;
		grid-template-columns: minmax(0, 1.2fr) minmax(0, 1.25fr) minmax(0, .8fr) !important;
		align-items: stretch !important;
		gap: 8px !important;
		padding: 0 !important;
		background: transparent !important;
	}

	.app-shell.blacksite-ui-v37 .breach-monitor.feature-active .reel-mechanic-strip.feature-strip > :global(.feature-hud-surface) {
		position: relative !important;
		inset: auto !important;
		display: grid !important;
		width: 100% !important;
		height: 100% !important;
		min-width: 0 !important;
		min-height: 0 !important;
		place-content: center !important;
		place-items: center !important;
		gap: 3px !important;
		padding: 8px 10px !important;
		overflow: hidden !important;
		text-align: center !important;
	}

	.app-shell.blacksite-ui-v37 .breach-monitor.feature-active .reel-mechanic-strip.feature-strip :global(.feature-hud-surface__label) {
		position: relative !important;
		inset: auto !important;
		display: block !important;
		grid-row: 1 !important;
		grid-column: 1 / -1 !important;
		align-self: center !important;
		justify-self: center !important;
		color: var(--v37-muted) !important;
		font-size: clamp(10px, .7cqw, 12px) !important;
		font-weight: 850 !important;
		line-height: 1 !important;
		letter-spacing: .12em !important;
	}

	.app-shell.blacksite-ui-v37 .breach-monitor.feature-active .reel-mechanic-strip.feature-strip :global(.feature-hud-surface__value-row) {
		position: relative !important;
		inset: auto !important;
		display: flex !important;
		grid-row: 2 !important;
		grid-column: 1 / -1 !important;
		align-items: center !important;
		justify-content: center !important;
		align-self: center !important;
		justify-self: center !important;
		gap: 7px !important;
	}

	.app-shell.blacksite-ui-v37 .breach-monitor.feature-active :global(.feature-hud-surface[data-feature-hud-kind='progress']) {
		grid-template-columns: minmax(0, 1fr) auto !important;
		grid-template-rows: auto minmax(0, 1fr) !important;
	}

	.app-shell.blacksite-ui-v37 .breach-monitor.feature-active :global(.feature-hud-surface[data-feature-hud-kind='progress'] .feature-hud-surface__value) {
		color: var(--v37-copy) !important;
		font-size: clamp(24px, 2.1cqw, 34px) !important;
		line-height: 1 !important;
	}

	.app-shell.blacksite-ui-v37 .breach-monitor.feature-active :global(.feature-hud-surface[data-feature-hud-kind='progress'] .feature-hud-surface__secondary) {
		position: relative !important;
		inset: auto !important;
		display: block !important;
		grid-row: 2 !important;
		grid-column: 2 !important;
		align-self: center !important;
		justify-self: end !important;
		color: var(--v37-gold) !important;
		font-size: clamp(13px, 1cqw, 18px) !important;
		font-style: normal !important;
		line-height: 1 !important;
		letter-spacing: .06em !important;
	}

	.app-shell.blacksite-ui-v37 .breach-monitor.feature-active :global(.feature-hud-surface[data-feature-hud-kind='target'] .feature-hud-surface__icon) {
		width: clamp(48px, 5.2cqw, 72px) !important;
		height: clamp(48px, 5.2cqw, 72px) !important;
		min-width: 48px !important;
		min-height: 48px !important;
		object-fit: contain !important;
		object-position: center !important;
	}

	.app-shell.blacksite-ui-v37 .breach-monitor.feature-active :global(.feature-hud-surface[data-feature-hud-kind='target'] .feature-hud-surface__value--icon-label) {
		position: absolute !important;
		width: 1px !important;
		height: 1px !important;
		padding: 0 !important;
		overflow: hidden !important;
		clip: rect(0 0 0 0) !important;
		white-space: nowrap !important;
	}

	.app-shell.blacksite-ui-v37 .breach-monitor.feature-active :global(.feature-hud-surface[data-feature-hud-kind='win'] .feature-hud-surface__value) {
		color: var(--v37-gold-bright) !important;
		font-size: clamp(20px, 1.75cqw, 30px) !important;
		line-height: 1 !important;
	}

	/* Dialogs: one matte shell, one header, one scroll owner. Decorative raster
	   frames no longer stack behind every card and every action. */
	.app-shell.blacksite-ui-v37 .modal-backdrop {
		display: grid !important;
		place-items: center !important;
		padding:
			max(12px, env(safe-area-inset-top))
			max(12px, env(safe-area-inset-right))
			max(12px, env(safe-area-inset-bottom))
			max(12px, env(safe-area-inset-left)) !important;
		background: rgba(0, 0, 0, .86) !important;
		backdrop-filter: blur(6px) saturate(.75) !important;
	}

	.app-shell.blacksite-ui-v37 .modal-backdrop > :is(.menu-dialog, .mode-dialog, .confirmation-dialog, .rules-dialog, .auto-dialog, .settings-dialog) {
		position: relative !important;
		inset: auto !important;
		display: grid !important;
		width: min(920px, calc(100vw - 24px)) !important;
		height: auto !important;
		min-width: 0 !important;
		min-height: 0 !important;
		max-height: calc(100dvh - 24px) !important;
		grid-template-rows: auto minmax(0, 1fr) !important;
		align-self: center !important;
		justify-self: center !important;
		overflow: hidden !important;
		border: 1px solid var(--v37-line) !important;
		border-radius: 8px !important;
		background: rgba(5, 8, 9, .985) !important;
		box-shadow: 0 24px 70px rgba(0, 0, 0, .7), inset 0 1px rgba(255, 238, 202, .05) !important;
		transform: none;
	}

	.app-shell.blacksite-ui-v37 .modal-backdrop > .confirmation-dialog {
		width: min(640px, calc(100vw - 24px)) !important;
		grid-template-rows: minmax(0, 1fr) !important;
	}

	.app-shell.blacksite-ui-v37 .modal-backdrop > :is(.auto-dialog, .settings-dialog) {
		width: min(560px, calc(100vw - 24px)) !important;
	}

	.app-shell.blacksite-ui-v37 .premium-dialog-frame,
	.app-shell.blacksite-ui-v37 :global(.panel-state-art),
	.app-shell.blacksite-ui-v37 .v27-modal-header > :global(.ui-surface),
	.app-shell.blacksite-ui-v37 .mode-card-meta :global(.ui-surface),
	.app-shell.blacksite-ui-v37 .game-guide-panel :global(.ui-surface) {
		display: none !important;
	}

	.app-shell.blacksite-ui-v37 .v27-modal-header {
		position: sticky !important;
		top: 0 !important;
		z-index: 10 !important;
		display: grid !important;
		min-height: 72px !important;
		grid-template-columns: minmax(0, 1fr) 48px !important;
		align-items: center !important;
		gap: 12px !important;
		padding: 10px 12px 10px 20px !important;
		border: 0 !important;
		border-bottom: 1px solid var(--v37-line-soft) !important;
		background: rgba(7, 11, 12, .99) !important;
		box-shadow: none !important;
	}

	.app-shell.blacksite-ui-v37 .v27-modal-header > div {
		display: grid !important;
		min-width: 0;
		gap: 4px;
	}

	.app-shell.blacksite-ui-v37 .v27-modal-header > div > span {
		color: var(--v37-muted) !important;
		font-size: 10px !important;
		font-weight: 800 !important;
		line-height: 1 !important;
		letter-spacing: .14em !important;
	}

	.app-shell.blacksite-ui-v37 .v27-modal-header h2 {
		margin: 0 !important;
		color: var(--v37-copy) !important;
		font-size: clamp(22px, 2.3vw, 32px) !important;
		line-height: 1 !important;
		letter-spacing: .055em !important;
		white-space: normal !important;
	}

	.app-shell.blacksite-ui-v37 .v27-modal-header > button {
		position: relative !important;
		inset: auto !important;
		display: grid !important;
		width: 48px !important;
		height: 48px !important;
		min-width: 48px !important;
		min-height: 48px !important;
		place-items: center !important;
		padding: 0 !important;
		border: 1px solid var(--v37-line-soft) !important;
		border-radius: 12px !important;
		background: rgba(14, 18, 18, .98) !important;
		box-shadow: none !important;
		color: var(--v37-copy) !important;
		transform: none !important;
	}

	.app-shell.blacksite-ui-v37 .v27-modal-header > button > :global(.hud-icon) {
		position: relative !important;
		inset: auto !important;
		width: 28px !important;
		height: 28px !important;
		transform: none !important;
	}

	.app-shell.blacksite-ui-v37 .menu-dialog:not(.mode-dialog) {
		width: min(760px, calc(100vw - 24px)) !important;
	}

	.app-shell.blacksite-ui-v37 .menu-dialog:not(.mode-dialog) .menu-actions {
		display: grid !important;
		min-height: 0 !important;
		grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
		grid-auto-rows: minmax(112px, auto) !important;
		gap: 10px !important;
		align-content: start !important;
		padding: 14px !important;
		overflow-y: auto !important;
	}

	.app-shell.blacksite-ui-v37 .menu-dialog:not(.mode-dialog) .menu-actions > button {
		position: relative !important;
		display: grid !important;
		height: auto !important;
		min-height: 112px !important;
		grid-template-rows: auto auto !important;
		place-content: center !important;
		place-items: center !important;
		gap: 8px !important;
		padding: 16px !important;
		border: 1px solid var(--v37-line-soft) !important;
		border-radius: 6px !important;
		background: var(--v37-panel) !important;
		box-shadow: none !important;
		text-align: center !important;
	}

	.app-shell.blacksite-ui-v37 .menu-dialog:not(.mode-dialog) .menu-actions > button:last-child:nth-child(odd) {
		width: calc(50% - 5px) !important;
		grid-column: 1 / -1 !important;
		justify-self: center !important;
	}

	.app-shell.blacksite-ui-v37 .menu-actions > button > span:not(.menu-action-icon) {
		color: var(--v37-copy) !important;
		font-size: 13px !important;
		font-weight: 900 !important;
		line-height: 1.15 !important;
		letter-spacing: .07em !important;
		text-align: center !important;
	}

	.app-shell.blacksite-ui-v37 .menu-actions > button > small {
		color: var(--v37-muted) !important;
		font-size: 12px !important;
		line-height: 1.45 !important;
		text-align: center !important;
	}

	.app-shell.blacksite-ui-v37 .mode-dialog-list {
		display: grid !important;
		min-height: 0 !important;
		grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
		grid-auto-rows: minmax(126px, auto) !important;
		gap: 10px !important;
		align-content: start !important;
		padding: 14px !important;
		overflow-y: auto !important;
		overscroll-behavior: contain;
	}

	.app-shell.blacksite-ui-v37 .mode-dialog-list > button {
		position: relative !important;
		display: grid !important;
		height: auto !important;
		min-height: 126px !important;
		grid-template-columns: 82px minmax(0, 1fr) auto !important;
		grid-template-rows: auto minmax(0, 1fr) auto !important;
		gap: 5px 10px !important;
		padding: 12px !important;
		overflow: hidden !important;
		border: 1px solid var(--v37-line-soft) !important;
		border-radius: 6px !important;
		background: var(--v37-panel) !important;
		box-shadow: none !important;
		text-align: left !important;
	}

	.app-shell.blacksite-ui-v37 .mode-dialog-list > button:last-child:nth-child(odd) {
		grid-column: 1 / -1 !important;
		width: calc(50% - 5px) !important;
		justify-self: center !important;
	}

	.app-shell.blacksite-ui-v37 .mode-dialog-list > button.selected {
		border-color: var(--v37-gold) !important;
		box-shadow: inset 3px 0 var(--v37-gold) !important;
	}

	.app-shell.blacksite-ui-v37 .mode-dialog-list .mode-key-art {
		position: relative !important;
		inset: auto !important;
		width: 82px !important;
		height: 82px !important;
		grid-column: 1 !important;
		grid-row: 1 / -1 !important;
		align-self: center !important;
		object-fit: contain !important;
		filter: grayscale(.45) sepia(.22) saturate(.8) !important;
		transform: none !important;
	}

	.app-shell.blacksite-ui-v37 .mode-dialog-list > button > span {
		grid-column: 2 !important;
		grid-row: 1 !important;
		align-self: end !important;
		color: var(--v37-copy) !important;
		font-size: 13px !important;
		font-weight: 900 !important;
		line-height: 1.15 !important;
		letter-spacing: .06em !important;
	}

	.app-shell.blacksite-ui-v37 .mode-dialog-list .mode-card-effect {
		grid-column: 2 / -1 !important;
		grid-row: 2 !important;
		align-self: start !important;
		max-height: none !important;
		overflow: visible !important;
		color: var(--v37-muted) !important;
		font-size: 12px !important;
		line-height: 1.42 !important;
		-webkit-line-clamp: unset !important;
		line-clamp: unset !important;
	}

	.app-shell.blacksite-ui-v37 .mode-dialog-list > button > strong {
		position: relative !important;
		inset: auto !important;
		display: grid !important;
		grid-column: 3 !important;
		grid-row: 1 !important;
		align-self: start !important;
		justify-items: end !important;
		color: var(--v37-gold-bright) !important;
		font-size: 18px !important;
		line-height: 1 !important;
	}

	.app-shell.blacksite-ui-v37 .mode-dialog-list > button > strong > small {
		font-size: 8px !important;
		letter-spacing: .08em !important;
	}

	.app-shell.blacksite-ui-v37 .mode-dialog-list .mode-card-meta {
		position: relative !important;
		inset: auto !important;
		display: flex !important;
		min-width: 0;
		grid-column: 2 / -1 !important;
		grid-row: 3 !important;
		align-items: center !important;
		justify-content: space-between !important;
		gap: 8px !important;
	}

	.app-shell.blacksite-ui-v37 .mode-card-meta :is(.mode-card-facts, .mode-card-total) {
		font-size: 9px !important;
	}

	.app-shell.blacksite-ui-v37 .mode-card-meta > em {
		position: relative !important;
		inset: auto !important;
		display: grid !important;
		min-height: 24px !important;
		place-items: center !important;
		padding: 3px 8px !important;
		border: 1px solid var(--v37-line-soft) !important;
		border-radius: 999px !important;
		background: rgba(3, 6, 7, .85) !important;
		font-size: 8px !important;
		font-style: normal !important;
		letter-spacing: .08em !important;
	}

	.app-shell.blacksite-ui-v37 .guide-tabs {
		position: sticky !important;
		top: 72px !important;
		z-index: 9 !important;
		display: grid !important;
		grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
		gap: 6px !important;
		padding: 8px 12px !important;
		border-bottom: 1px solid var(--v37-line-soft) !important;
		background: rgba(5, 8, 9, .99) !important;
	}

	.app-shell.blacksite-ui-v37 .guide-tabs > button {
		min-width: 0 !important;
		min-height: 46px !important;
		padding: 7px 6px !important;
		border: 1px solid var(--v37-line-soft) !important;
		border-radius: 5px !important;
		background: var(--v37-panel) !important;
		color: var(--v37-muted) !important;
		font-size: 11px !important;
		font-weight: 850 !important;
		letter-spacing: .06em !important;
	}

	.app-shell.blacksite-ui-v37 .guide-tabs > button.active {
		border-color: var(--v37-gold) !important;
		color: var(--v37-gold-bright) !important;
	}

	.app-shell.blacksite-ui-v37 .game-guide-scroll,
	.app-shell.blacksite-ui-v37 :is(.auto-body, .settings-body),
	.app-shell.blacksite-ui-v37 .confirmation-scroll {
		min-height: 0 !important;
		max-height: none !important;
		overflow-y: auto !important;
		overscroll-behavior: contain;
	}

	.app-shell.blacksite-ui-v37 .game-guide-panel {
		padding: 16px !important;
		color: var(--v37-copy) !important;
		font-size: 13px !important;
		line-height: 1.5 !important;
	}

	.app-shell.blacksite-ui-v37 .game-guide-panel :is(p, small),
	.app-shell.blacksite-ui-v37 .rules-copy-grid p {
		font-size: 12.5px !important;
		line-height: 1.52 !important;
	}

	.app-shell.blacksite-ui-v37 :is(.guide-four-steps article, .symbol-card-grid article, .rules-copy-grid > section, .vault-timeline > span, .confirmation-ledger > p) {
		border: 1px solid var(--v37-line-soft) !important;
		border-radius: 5px !important;
		background: var(--v37-panel) !important;
		box-shadow: none !important;
	}

	.app-shell.blacksite-ui-v37 :is(.auto-body, .settings-body) {
		align-content: start !important;
		gap: 10px !important;
		padding: 14px !important;
	}

	.app-shell.blacksite-ui-v37 .settings-body > button,
	.app-shell.blacksite-ui-v37 .auto-options > button,
	.app-shell.blacksite-ui-v37 .modal-actions > button {
		min-height: 52px !important;
		padding: 10px 14px !important;
		border: 1px solid var(--v37-line-soft) !important;
		border-radius: 5px !important;
		background: var(--v37-panel) !important;
		box-shadow: none !important;
		color: var(--v37-copy) !important;
		font-size: 12px !important;
	}

	.app-shell.blacksite-ui-v37 .modal-actions > .confirm-action {
		border-color: var(--v37-gold) !important;
		color: var(--v37-gold-bright) !important;
	}

	/* Portrait and narrow Stake iframe: three metric wells, one aligned action
	   row and one icon-only utility row. */
	@media (max-aspect-ratio: 1249 / 1000) {
		.app-shell.blacksite-ui-v37 {
			--v37-control: 48px;
			--v37-spin: 64px;
		}

		.app-shell.blacksite-ui-v37 .monitor-header {
			grid-template-columns: minmax(0, 1fr) auto !important;
			grid-template-rows: minmax(0, 1fr) !important;
			align-items: center !important;
			gap: 7px !important;
			padding-inline: 10px !important;
		}

		.app-shell.blacksite-ui-v37 .monitor-identity {
			grid-column: 1 !important;
			grid-row: 1 !important;
			align-self: center !important;
		}

		.app-shell.blacksite-ui-v37 .monitor-identity > span {
			display: none !important;
		}

		.app-shell.blacksite-ui-v37 .monitor-identity h1 {
			font-size: clamp(17px, 3.4cqw, 25px) !important;
		}

		.app-shell.blacksite-ui-v37 .selected-mode-carrier {
			display: none !important;
		}

		.app-shell.blacksite-ui-v37 .lifecycle {
			grid-column: 2 !important;
			grid-row: 1 !important;
			align-self: center !important;
			justify-self: end !important;
			min-height: 30px !important;
			padding: 4px 8px 4px 18px !important;
		}

		.app-shell.blacksite-ui-v37 .lifecycle > strong {
			font-size: 9px !important;
		}

		.app-shell.blacksite-ui-v37 .reel-mechanic-strip:not(.feature-strip) :global(.feature-hud-surface__value) {
			font-size: clamp(15px, 3.2cqw, 20px) !important;
		}

		.app-shell.blacksite-ui-v37 .reel-mechanic-strip:not(.feature-strip) :global(.feature-hud-surface__secondary) {
			font-size: clamp(9px, 1.8cqw, 11px) !important;
		}

		.app-shell.blacksite-ui-v37 .breach-monitor.feature-active .reel-mechanic-strip.feature-strip {
			grid-template-columns: minmax(0, 1.15fr) minmax(0, 1.25fr) minmax(0, .9fr) !important;
			gap: 5px !important;
		}

		.app-shell.blacksite-ui-v37 .breach-monitor.feature-active .reel-mechanic-strip.feature-strip > :global(.feature-hud-surface) {
			padding: 5px 4px !important;
		}

		.app-shell.blacksite-ui-v37 .breach-monitor.feature-active :global(.feature-hud-surface[data-feature-hud-kind='progress']) {
			grid-template-columns: minmax(0, 1fr) !important;
			grid-template-rows: auto minmax(0, 1fr) auto !important;
		}

		.app-shell.blacksite-ui-v37 .breach-monitor.feature-active :global(.feature-hud-surface[data-feature-hud-kind='progress'] .feature-hud-surface__value-row) {
			grid-row: 2 !important;
			grid-column: 1 !important;
		}

		.app-shell.blacksite-ui-v37 .breach-monitor.feature-active :global(.feature-hud-surface[data-feature-hud-kind='progress'] .feature-hud-surface__secondary) {
			grid-row: 3 !important;
			grid-column: 1 !important;
			justify-self: center !important;
			font-size: 10px !important;
			letter-spacing: .04em !important;
		}

		.app-shell.blacksite-ui-v37 .breach-monitor.feature-active :global(.feature-hud-surface[data-feature-hud-kind='target'] .feature-hud-surface__icon) {
			width: clamp(40px, 9cqw, 56px) !important;
			height: clamp(40px, 9cqw, 56px) !important;
			min-width: 40px !important;
			min-height: 40px !important;
		}
	}

	@media (max-width: 700px) {
		.app-shell.blacksite-ui-v37 .modal-backdrop {
			padding: 0 !important;
		}

		.app-shell.blacksite-ui-v37 .modal-backdrop > :is(.menu-dialog, .mode-dialog, .confirmation-dialog, .rules-dialog, .auto-dialog, .settings-dialog) {
			width: 100vw !important;
			height: 100dvh !important;
			max-height: 100dvh !important;
			border-inline: 0 !important;
			border-radius: 0 !important;
		}

		.app-shell.blacksite-ui-v37 .v27-modal-header {
			min-height: 64px !important;
			grid-template-columns: minmax(0, 1fr) 46px !important;
			gap: 8px !important;
			padding: max(8px, env(safe-area-inset-top)) 9px 8px 13px !important;
		}

		.app-shell.blacksite-ui-v37 .v27-modal-header h2 {
			font-size: clamp(20px, 6vw, 28px) !important;
		}

		.app-shell.blacksite-ui-v37 .v27-modal-header > button {
			width: 46px !important;
			height: 46px !important;
			min-width: 46px !important;
			min-height: 46px !important;
		}

		.app-shell.blacksite-ui-v37 .menu-dialog:not(.mode-dialog) .menu-actions {
			grid-template-columns: minmax(0, 1fr) !important;
			grid-auto-rows: minmax(92px, auto) !important;
			gap: 8px !important;
			padding: 10px !important;
		}

		.app-shell.blacksite-ui-v37 .menu-dialog:not(.mode-dialog) .menu-actions > button,
		.app-shell.blacksite-ui-v37 .menu-dialog:not(.mode-dialog) .menu-actions > button:last-child:nth-child(odd) {
			width: 100% !important;
			min-height: 92px !important;
			grid-column: 1 !important;
		}

		.app-shell.blacksite-ui-v37 .mode-dialog-list {
			grid-template-columns: minmax(0, 1fr) !important;
			grid-auto-rows: minmax(126px, auto) !important;
			gap: 8px !important;
			padding: 10px !important;
		}

		.app-shell.blacksite-ui-v37 .mode-dialog-list > button {
			grid-template-columns: 72px minmax(0, 1fr) auto !important;
		}

		.app-shell.blacksite-ui-v37 .mode-dialog-list > button:last-child:nth-child(odd) {
			grid-column: 1 !important;
			width: 100% !important;
		}

		.app-shell.blacksite-ui-v37 .mode-dialog-list .mode-key-art {
			width: 72px !important;
			height: 72px !important;
		}

		.app-shell.blacksite-ui-v37 .guide-tabs {
			top: 64px !important;
			display: flex !important;
			gap: 6px !important;
			padding: 7px 10px !important;
			overflow-x: auto !important;
			scrollbar-width: thin;
		}

		.app-shell.blacksite-ui-v37 .guide-tabs > button {
			flex: 0 0 min(126px, 34vw) !important;
			min-height: 44px !important;
			font-size: 10px !important;
		}

		.app-shell.blacksite-ui-v37 .game-guide-panel {
			padding: 12px 10px 18px !important;
		}

		.app-shell.blacksite-ui-v37 .game-guide-panel :is(p, small),
		.app-shell.blacksite-ui-v37 .rules-copy-grid p {
			font-size: 12px !important;
			line-height: 1.5 !important;
		}
	}

	@media (max-width: 480px) and (min-height: 431px) and (orientation: portrait) {
		.app-shell.blacksite-ui-v37 .premium-hud .hud-tools {
			display: grid !important;
			place-items: center !important;
		}
	}

	/* The 390x844 shell owns one six-well row. Keep V36's exact horizontal
	   registration and move only that row and its raster glyphs onto the wells. */
	@media (max-width: 380px) and (min-height: 701px) and (orientation: portrait),
		(min-width: 381px) and (max-width: 480px) and (min-height: 431px) and (orientation: portrait) {
		.app-shell.blacksite-ui-v37 .premium-hud .hud-tools {
			top: 66% !important;
			bottom: auto !important;
			height: 22% !important;
		}

		.app-shell.blacksite-ui-v37 .premium-hud .hud-tools-left {
			left: 2% !important;
			width: 46% !important;
		}

		.app-shell.blacksite-ui-v37 .premium-hud .hud-tools-right {
			left: 52% !important;
			width: 46% !important;
		}

		.app-shell.blacksite-ui-v37 .premium-hud .hud-tools .round-tool > .hud-tool-label {
			bottom: -8.2cqw !important;
		}
	}

	/* The compact 320x568 shell owns two authored rows of three wells. Restore
	   the package geometry that V36's one-row override displaced. */
	@media (max-width: 380px) and (min-height: 431px) and (max-height: 700px) and (orientation: portrait) {
		.app-shell.blacksite-ui-v37 .premium-hud .hud-tools-left,
		.app-shell.blacksite-ui-v37 .premium-hud .hud-tools-right {
			left: calc(50% - 72px) !important;
			width: 144px !important;
			height: 44px !important;
			bottom: auto !important;
		}

		.app-shell.blacksite-ui-v37 .premium-hud .hud-tools-left { top: 51% !important; }
		.app-shell.blacksite-ui-v37 .premium-hud .hud-tools-right { top: 73% !important; }
	}

	/* Ultra-short landscape retains true 44px targets but uses a two-row rail,
	   preventing the old ten-way squeeze and oval icons. */
	@media (max-height: 560px) and (min-aspect-ratio: 2 / 1) {
		.app-shell.blacksite-ui-v37 {
			--v37-control: 44px;
			--v37-spin: 60px;
		}

		.app-shell.blacksite-ui-v37 .monitor-header {
			min-height: 26px !important;
			height: 26px !important;
		}

		.app-shell.blacksite-ui-v37 .monitor-identity > span,
		.app-shell.blacksite-ui-v37 .selected-mode-carrier {
			display: none !important;
		}

		.app-shell.blacksite-ui-v37 .monitor-identity h1 {
			font-size: 12px !important;
		}

		.app-shell.blacksite-ui-v37 .lifecycle {
			min-height: 22px !important;
			padding-block: 2px !important;
		}

		/* The 844x390 short-landscape cabinet owns three fixed wells on the
		   right. Register the live rail to those wells instead of stretching it
		   across the wider desktop percentage track. */
		@media (min-width: 701px) {
			.app-shell.blacksite-ui-v37 .premium-hud .hud-tools-right {
				width: 15.7% !important;
			}

			.app-shell.blacksite-ui-v37 .premium-hud .total-meter > .hud-meter-label {
				font-size: 7px !important;
				letter-spacing: .02em !important;
				line-height: 1 !important;
				white-space: nowrap !important;
			}
		}

		.app-shell.blacksite-ui-v37 .breach-monitor.feature-active .reel-mechanic-strip.feature-strip {
			display: grid !important;
			grid-template-columns: minmax(0, 1.15fr) minmax(0, 1.2fr) minmax(0, .85fr) !important;
			gap: 5px !important;
		}

		.app-shell.blacksite-ui-v37 .breach-monitor.feature-active .reel-mechanic-strip.feature-strip > :global(.feature-hud-surface) {
			position: relative !important;
			inset: auto !important;
			width: 100% !important;
			height: 100% !important;
		}

		.app-shell.blacksite-ui-v37 .v27-modal-header {
			min-height: 54px !important;
		}

		.app-shell.blacksite-ui-v37 .guide-tabs {
			top: 54px !important;
			padding-block: 4px !important;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.app-shell.blacksite-ui-v37 *,
		.app-shell.blacksite-ui-v37 *::before,
		.app-shell.blacksite-ui-v37 *::after {
			scroll-behavior: auto !important;
			transition-duration: .01ms !important;
		}
	}
</style>
