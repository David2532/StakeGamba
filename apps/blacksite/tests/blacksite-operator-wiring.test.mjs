import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const pageSource = await readFile(new URL('../src/routes/+page.svelte', import.meta.url), 'utf8');
const penguinSource = await readFile(
	new URL('../src/lib/components/PenguinOperator.svelte', import.meta.url),
	'utf8',
);
const prunerSource = await readFile(
	new URL('../scripts/prune-production-assets.mjs', import.meta.url),
	'utf8',
);

test('modern production renders the Penguin while the legacy adult surface stays statically unselected', () => {
	assert.match(
		pageSource,
		/penguinOperatorEnabled = __BLACKSITE_MODERN_PRESENTATION__/u,
	);
	assert.match(
		pageSource,
		/\{#if penguinOperatorEnabled\}[\s\S]*?<PenguinOperator[\s\S]*?state=\{penguinOperatorState\}[\s\S]*?suspended=\{operatorSuspended\}[\s\S]*?\/>[\s\S]*?\{:else\}[\s\S]*?\{#each OPERATOR_BUFFER_INDICES as bufferIndex \(bufferIndex\)\}/u,
	);
	assert.match(pageSource, /if \(penguinOperatorEnabled\) \{[\s\S]*?return;/u);
	assert.match(prunerSource, /'symbols\/sym_01_operative'/u);
	assert.match(prunerSource, /'runtime-rgba-v1': Object\.freeze\(\[[\s\S]*?standalone_fx/u);
	assert.doesNotMatch(
		prunerSource.slice(
			prunerSource.indexOf("'runtime-rgba-v1':"),
			prunerSource.indexOf('\n\tv21:', prunerSource.indexOf("'runtime-rgba-v1':")),
		),
		/runtime_sequences|keyposes|CHAR_/u,
	);
	assert.match(pageSource, /OPERATOR_BUFFER_INDICES = Object\.freeze\(\[0, 1\]\)/u);
	assert.match(pageSource, /\{#each OPERATOR_BUFFER_INDICES as bufferIndex \(bufferIndex\)\}/u);
	assert.match(
		pageSource,
		/data-testid=\{bufferIndex === operatorVisibleBuffer[\s\S]*?'operative-animation-frame'[\s\S]*?: 'operative-animation-buffer'\}/u,
	);
	assert.match(pageSource, /class:operative-frame-active=\{bufferIndex === operatorVisibleBuffer\}/u);
	assert.match(pageSource, /width="1280"[\s\S]*?height="1024"/u);
	assert.match(
		pageSource,
		/data-sequence=\{penguinOperatorEnabled \? penguinOperatorState : operatorVisibleFrame\.sequence\}/u,
	);
	assert.match(
		pageSource,
		/data-frame-index=\{penguinOperatorEnabled \? undefined : operatorVisibleFrame\.frameIndex\}/u,
	);
	assert.match(pageSource, /data-sequence=\{operatorFrameBuffers\[bufferIndex\]\.sequence\}/u);
	assert.match(pageSource, /data-frame-index=\{operatorFrameBuffers\[bufferIndex\]\.frameIndex\}/u);
	assert.match(pageSource, /data-zero-streak=\{operatorZeroStreak\}/u);
	assert.match(pageSource, /await decodeMountedFrame\(operatorFrameElements\[pendingBuffer\], source, 'operator'\)/u);
	assert.match(pageSource, /while \(operatorPendingFrame\)/u);
	assert.doesNotMatch(pageSource, /\|\| operatorPendingFrame !== null/u);
	assert.match(pageSource, /nextFrame\.generation !== operatorFrame\?\.generation/u);
	assert.match(pageSource, /surfaceManagedDecoding: true/u);
	assert.ok(
		pageSource.indexOf("await decodeMountedFrame(operatorFrameElements[pendingBuffer], source, 'operator')")
		< pageSource.indexOf('operatorVisibleBuffer = pendingBuffer'),
	);
	assert.doesNotMatch(pageSource, /BLACKSITE_ASSETS\.character\.poses/u);
	assert.doesNotMatch(pageSource, /operative-pose(?:-stack)?/u);
});

test('decoded frames cannot starve behind newer same-generation targets', () => {
	assert.doesNotMatch(pageSource, /\|\| operatorPendingFrame !== null/u);
	assert.doesNotMatch(pageSource, /\|\| standaloneFxPendingFrame !== null/u);
	assert.match(pageSource, /nextFrame\.generation !== operatorFrame\?\.generation/u);
	assert.match(pageSource, /nextFrame\.generation !== standaloneFxFrame\.generation/u);
	assert.equal((pageSource.match(/surfaceManagedDecoding: true/gu) ?? []).length, 2);
});

test('startup does not eagerly decode every reaction and FX first frame', () => {
	assert.doesNotMatch(pageSource, /operatorPreloadTimers/u);
	assert.doesNotMatch(pageSource, /standaloneFxPreloadTimers/u);
	assert.doesNotMatch(pageSource, /operatorAnimator\?\.preload/u);
	assert.doesNotMatch(pageSource, /standaloneFxDirector\?\.preload/u);
});

test('production Penguin uses its static poster when the host requests reduced motion', () => {
	assert.match(
		pageSource,
		/operatorViewportQuery = window\.matchMedia\(\s*'\(min-width: 1041px\) and \(min-height: 561px\) and \(min-aspect-ratio: 667\/500\)'/u,
	);
	assert.match(pageSource, /href=\{PENGUIN_OPERATOR_ASSETS\.poster\}[\s\S]*?media="\(min-width: 1041px\)[^"]*"/u);
	assert.match(
		pageSource,
		/href=\{PENGUIN_OPERATOR_ASSETS\.idle\}[\s\S]*?\(prefers-reduced-motion: no-preference\)/u,
	);
	assert.match(penguinSource, /source: PENGUIN_OPERATOR_ASSETS\.poster/u);
	assert.match(penguinSource, /export let suspended = false/u);
	assert.match(penguinSource, /\$: desiredState = reducedMotion \|\| suspended \? 'poster' : normalizePenguinState\(state\)/u);
	assert.match(
		penguinSource,
		/reducedMotionQuery = globalThis\.matchMedia\?\.\('\(prefers-reduced-motion: reduce\)'\)/u,
	);
	assert.match(penguinSource, /reducedMotion = reducedMotionQuery\?\.matches === true/u);
	assert.match(penguinSource, /reducedMotion = event\.matches === true/u);
});

test('Penguin promotes a fresh animated play instance only after mounted decode', () => {
	assert.match(penguinSource, /const PLAY_INSTANCE_ATTEMPTS = 2/u);
	assert.match(
		penguinSource,
		/for \(let attempt = 0; attempt < PLAY_INSTANCE_ATTEMPTS; attempt \+= 1\)[\s\S]*?playbackSource\(clip\.source, `play-\$\{attempt \+ 1\}`\)/u,
	);
	assert.match(
		penguinSource,
		/playReady = await waitForMountedWarm\([\s\S]*?playSource,[\s\S]*?playBuffer,[\s\S]*?\);/u,
	);
	assert.match(
		penguinSource,
		/if \(playReady && isCurrent\(token\) && buffers\[pendingBufferIndex\] === playBuffer\) break;[\s\S]*?releaseStaleBuffer\(pendingBufferIndex, playBuffer\);[\s\S]*?if \(!isCurrent\(token\)\) return false;/u,
	);
	assert.match(
		penguinSource,
		/if \(!playReady \|\| !playBuffer \|\| buffers\[pendingBufferIndex\] !== playBuffer\) return false;/u,
	);
	assert.match(penguinSource, /if \(!await waitForNextPaint\(token\)/u);
	assert.ok(
		penguinSource.indexOf('playReady = await waitForMountedWarm(')
		< penguinSource.indexOf('activeBuffer = pendingBufferIndex'),
	);
	assert.match(
		penguinSource,
		/image\?\.complete[\s\S]*?image\.naturalWidth > 0[\s\S]*?image\.getAttribute\('src'\) === buffers\[bufferIndex\]\.playSource[\s\S]*?return;/u,
	);
});

test('Penguin remains live for extraction and max-win reports while boot and ordinary modals suspend it', () => {
	assert.match(
		pageSource,
		/\$: vaultReportActive = vaultCinematicState\.active[\s\S]*?vaultCinematicState\.state === VAULT_STATE\.EXTRACTION;/u,
	);
	assert.match(
		pageSource,
		/\$: operatorSuspended = \(modalOpen \|\| bootInteractionLocked\) && !vaultReportActive;/u,
	);
	assert.match(
		pageSource,
		/<PenguinOperator state=\{penguinOperatorState\} suspended=\{operatorSuspended\} \/>/u,
	);
});

test('accepted Penguin reactions cannot be cancelled by recovery before their first decoded frame', () => {
	assert.match(
		penguinSource,
		/isPenguinReactionState\(requestedState\)[\s\S]*?visibleState !== requestedState[\s\S]*?normalizedState === 'idle'[\s\S]*?followupAfterQueuedReaction = 'idle';[\s\S]*?ignoredRecoveryEchoState = activeReaction;[\s\S]*?return;/u,
	);
	assert.match(
		penguinSource,
		/normalizedState === activeReaction[\s\S]*?authoritative round completion[\s\S]*?return;/u,
	);
	assert.match(
		penguinSource,
		/normalizedState === ignoredRecoveryEchoState[\s\S]*?followupAfterQueuedReaction === 'idle' \|\| requestedState === 'idle'[\s\S]*?return;/u,
	);
	assert.ok(
		penguinSource.indexOf("followupAfterQueuedReaction = 'idle'")
		< penguinSource.indexOf('if (normalizedState === activeReaction)'),
		'idle recovery must latch before a late active-reaction echo is ignored',
	);
	assert.match(
		penguinSource,
		/function launchDeferredSequence[\s\S]*?requestedState = deferredState;[\s\S]*?queuedReaction = isPenguinReactionState\(deferredState\) \? deferredState : '';/u,
	);
	assert.match(
		penguinSource,
		/if \(followupAfterQueuedReaction && requestedState === targetState\) \{[\s\S]*?deferredRequestedState = followupAfterQueuedReaction;[\s\S]*?followupAfterQueuedReaction = null;[\s\S]*?\}[\s\S]*?launchDeferredSequence\(targetState\)/u,
	);
	assert.ok(
		penguinSource.indexOf('isPenguinReactionState(requestedState)')
		< penguinSource.indexOf('requestedState = normalizedState'),
	);
});

test('modern terminal cues fence stale hidden-director callbacks and converge the parent reaction to idle', () => {
	const animationHandler = pageSource.slice(
		pageSource.indexOf('function handleOperatorAnimation(nextFrame)'),
		pageSource.indexOf('\n\tasync function triggerOperatorSequence', pageSource.indexOf('function handleOperatorAnimation(nextFrame)')),
	);
	assert.ok(
		animationHandler.indexOf('operatorFrame = nextFrame;')
		< animationHandler.indexOf('if (penguinOperatorEnabled)'),
		'modern mode must retain the hidden director generation before returning early',
	);
	assert.match(
		animationHandler,
		/operatorTerminalPresentationGeneration === operatorPresentationGeneration[\s\S]*?nextFrame\.generation <= operatorTerminalAnimationGeneration[\s\S]*?return;/u,
	);
	assert.match(
		animationHandler,
		/operatorTerminalPresentationGeneration === operatorPresentationGeneration[\s\S]*?\? 'idle'[\s\S]*?\? 'bonus-idle'/u,
	);

	const cueHandler = pageSource.slice(
		pageSource.indexOf('async function handleOperatorCue('),
		pageSource.indexOf('\n\tfunction safeTotalAmount', pageSource.indexOf('async function handleOperatorCue(')),
	);
	assert.match(cueHandler, /case 'feature_ended':[\s\S]*?markOperatorPresentationTerminal\(\);/u);
	assert.match(cueHandler, /case 'settled':[\s\S]*?markOperatorPresentationTerminal\(\);/u);
	assert.match(
		cueHandler,
		/if \(penguinOperatorEnabled \|\| operatorFrame\.sequence === OPERATOR_SEQUENCE\.IDLE\) \{[\s\S]*?setOperatorReaction\('recover'\);/u,
	);
});

test('operator cues carry explicit source context and await only mandatory feature audio, never image decode', () => {
	assert.match(pageSource, /source: 'fixture'/u);
	assert.match(pageSource, /source: 'replay'/u);
	assert.match(pageSource, /source: 'live'/u);
	assert.match(pageSource, /const roundOrigin = pendingRoundOrigin/u);
	assert.match(pageSource, /async function handleOperatorCue\(/u);
	const handlerSource = pageSource.slice(
		pageSource.indexOf('async function handleOperatorCue('),
		pageSource.indexOf('\n\tfunction safeTotalAmount', pageSource.indexOf('async function handleOperatorCue(')),
	);
	assert.match(handlerSource, /await ensureVaultAudioReady\(\)/u);
	assert.doesNotMatch(handlerSource, /decodeMountedFrame|\.decode\(\)/u);
	assert.match(pageSource, /void triggerOperatorSequence\(sequence, dedupeKey\)/u);
	assert.match(pageSource, /origin === 'restore'/u);
});

test('loss streak mutates only after successful live completion and autoplay waits boundedly', () => {
	assert.equal((pageSource.match(/liveOutcomeStreak\.commit\(/gu) ?? []).length, 1);
	const completion = pageSource.indexOf('await liveSession.completePresentation()');
	const commit = pageSource.indexOf('liveOutcomeStreak.commit(');
	assert.ok(completion >= 0 && commit > completion);
	assert.match(pageSource, /if \(roundOrigin === 'play' && liveOutcomeStreak\)/u);
	assert.match(
		pageSource,
		/await operatorAnimator\?\.waitForIdle\(\{ timeoutMs: turboEnabled \? 140 : 620 \}\)/u,
	);
	assert.match(pageSource, /Cosmetic reactions can never invalidate an already settled RGS round/u);
});

test('big-win dedupe is round-wide and replay generation advances per playback', () => {
	assert.match(pageSource, /OPERATOR_BIG_WIN_CENTIX_PER_COST = 1_000/u);
	assert.match(pageSource, /operatorRoundSequenceKey\(context, OPERATOR_SEQUENCE\.BIG_WIN\)/u);
	const activate = pageSource.slice(pageSource.indexOf('async function activatePrimary()'));
	const replayBranch = activate.slice(activate.indexOf("if (launch.kind === 'replay') {"));
	assert.ok(replayBranch.indexOf('replayPlaybackGeneration += 1') < replayBranch.indexOf('replayController.play'));
});

test('cap big win defers nonblocking behind bonus and is generation-cancelled at boundaries', () => {
	assert.match(pageSource, /OPERATOR_DEFERRED_SEQUENCE_TIMEOUT_MS = 4_000/u);
	assert.match(pageSource, /function deferCapBigWin\(context\)/u);
	assert.match(pageSource, /async function handleOperatorCue\(/u);
	assert.match(
		pageSource,
		/operatorFrame\.sequence === OPERATOR_SEQUENCE\.BONUS[\s\S]*?operatorBonusTriggerPending > 0[\s\S]*?deferCapBigWin\(context\)/u,
	);
	assert.match(
		pageSource,
		/idleCompleted = await operatorAnimator\?\.waitForIdle\([\s\S]*?await triggerOperatorSequence\(OPERATOR_SEQUENCE\.BIG_WIN, dedupeKey\)/u,
	);
	assert.match(pageSource, /case 'round_started':[\s\S]*?cancelDeferredOperatorSequence\(\)/u);
	assert.match(pageSource, /operatorAnimator\?\.returnToIdle\('fixture_playback_started'\)/u);
	assert.match(pageSource, /operatorAnimator\?\.returnToIdle\('replay_playback_started'\)/u);
	assert.match(pageSource, /cancelDeferredOperatorSequence\(\);[\s\S]*?operatorAnimator\.returnToIdle\('runtime_error'\)/u);
	assert.match(pageSource, /const suppressOutcome = context\.source === 'live' && context\.origin === 'restore'/u);
});
