<script>
	import { onMount, tick } from 'svelte';
	import {
		PENGUIN_OPERATOR_ASSETS,
		isPenguinReactionState,
		penguinClipForId,
	} from '../assets/penguin-operator-assets.js';
	import {
		normalizePenguinState,
		planPenguinIdleRotation,
		planPenguinSemanticTransition,
		penguinIdleSafeWindowDelayMs,
	} from '../runtime/penguin-operator-sequencer.js';

	export let state = 'idle';
	export let suspended = false;

	const CROSSFADE_MS = 130;
	const CROSSFADE_RELEASE_FALLBACK_MS = 480;
	const IMAGE_READY_TIMEOUT_MS = 2_500;
	const PLAY_INSTANCE_ATTEMPTS = 2;
	const FRAME_ARM_BUDGET_MS = 17;
	const SAFE_GATE_TOLERANCE_MS = 18;
	const BUFFER_INDICES = Object.freeze([0, 1]);
	const EMPTY_BUFFER = Object.freeze({
		clipId: '', state: '', source: null, playSource: null, token: -1, startedAt: 0,
	});
	const POSTER_BUFFER = Object.freeze({
		clipId: 'poster',
		state: 'poster',
		source: PENGUIN_OPERATOR_ASSETS.poster,
		playSource: PENGUIN_OPERATOR_ASSETS.poster,
		token: 0,
		startedAt: 0,
	});

	let mounted = false;
	let destroyed = false;
	let generation = 0;
	let playSerial = 0;
	let requestedState = 'poster';
	let visibleState = 'poster';
	let settledState = 'poster';
	let activeReaction = null;
	let queuedReaction = '';
	let currentClipId = 'poster';
	let targetClipId = 'poster';
	let sequencePhase = 'poster';
	let currentClipActivatedAt = 0;
	let currentClipPlaybackStartedAt = 0;
	let reactionActivatedAt = 0;
	let idleIndex = 0;
	let idlePaceIndex = 0;
	let bridgeLocked = false;
	let deferredRequestedState = null;
	let followupAfterQueuedReaction = null;
	let ignoredRecoveryEchoState = null;
	let sequenceWaitCancel = null;
	let armWaitCancel = null;
	let activeProbeCancel = null;
	let idleRotationTimer = null;
	let reducedMotion = false;
	let reducedMotionQuery = null;
	let reducedMotionListener = null;
	let activeBuffer = 0;
	let ready = false;
	let failed = false;
	let buffers = [POSTER_BUFFER, EMPTY_BUFFER];
	const decodedSources = new Set();
	const bufferElements = [null, null];
	const bufferReleaseCleanups = [null, null];

	$: desiredState = reducedMotion || suspended ? 'poster' : normalizePenguinState(state);
	$: if (mounted && desiredState !== requestedState) requestSemanticState(desiredState);
	$: visibleMinimumHoldMs = activeReaction
		? (penguinClipForId(activeReaction)?.minimumHoldMs ?? 0)
		: 0;
	$: queuedState = requestedState !== visibleState ? requestedState : '';
	$: currentIdleClip = penguinClipForId(currentClipId)?.kind === 'idle'
		? penguinClipForId(currentClipId)
		: null;
	$: visibleIdleDwellMs = currentIdleClip?.rotateAfterMs ?? 0;
	$: visibleIdleLoopMs = currentIdleClip?.durationMs ?? 0;

	function now() {
		return globalThis.performance?.now?.() ?? Date.now();
	}

	function isCurrent(token) {
		return !destroyed && token === generation;
	}

	function clearIdleRotationTimer() {
		if (idleRotationTimer === null) return;
		globalThis.clearTimeout(idleRotationTimer);
		idleRotationTimer = null;
	}

	function cancelSequenceWait() {
		sequenceWaitCancel?.();
	}

	function cancelArmWait() {
		armWaitCancel?.();
	}

	function cancelActiveProbe() {
		activeProbeCancel?.();
	}

	function cancelSequenceWork() {
		clearIdleRotationTimer();
		cancelSequenceWait();
		cancelArmWait();
		cancelActiveProbe();
	}

	function launchDeferredSequence(completedTargetState) {
		const deferredState = deferredRequestedState;
		deferredRequestedState = null;
		if (!deferredState || deferredState === completedTargetState || destroyed) return false;
		requestedState = deferredState;
		queuedReaction = isPenguinReactionState(deferredState) ? deferredState : '';
		const token = ++generation;
		cancelSequenceWork();
		sequencePhase = 'queued';
		void runSemanticSequence(deferredState, token);
		return true;
	}

	function clearBufferRelease(bufferIndex) {
		bufferReleaseCleanups[bufferIndex]?.();
	}

	function clearBufferReleases() {
		for (const bufferIndex of BUFFER_INDICES) clearBufferRelease(bufferIndex);
	}

	function registerBuffer(node, bufferIndex) {
		bufferElements[bufferIndex] = node;
		return {
			destroy() {
				if (bufferElements[bufferIndex] === node) bufferElements[bufferIndex] = null;
			},
		};
	}

	function setBuffer(bufferIndex, nextBuffer) {
		clearBufferRelease(bufferIndex);
		const immutableBuffer = Object.freeze(nextBuffer);
		buffers = buffers.map((buffer, index) => (
			index === bufferIndex ? immutableBuffer : buffer
		));
		return immutableBuffer;
	}

	function releaseBufferAfterCrossfade(bufferIndex, expectedBuffer, startedAt) {
		if (!expectedBuffer?.source) return;
		clearBufferRelease(bufferIndex);
		const image = bufferElements[bufferIndex];
		let fallbackTimer = null;
		const cleanup = () => {
			image?.removeEventListener('transitionend', handleTransitionEnd);
			if (fallbackTimer !== null) globalThis.clearTimeout(fallbackTimer);
			fallbackTimer = null;
			if (bufferReleaseCleanups[bufferIndex] === cleanup) {
				bufferReleaseCleanups[bufferIndex] = null;
			}
		};
		const release = () => {
			cleanup();
			if (
				destroyed
				|| activeBuffer === bufferIndex
				|| buffers[bufferIndex] !== expectedBuffer
			) return;
			setBuffer(bufferIndex, EMPTY_BUFFER);
		};
		function handleTransitionEnd(event) {
			if (event.target === image && event.propertyName === 'opacity') release();
		}
		bufferReleaseCleanups[bufferIndex] = cleanup;
		image?.addEventListener('transitionend', handleTransitionEnd);
		const elapsedMs = Math.max(0, now() - startedAt);
		fallbackTimer = globalThis.setTimeout(
			release,
			Math.max(0, CROSSFADE_RELEASE_FALLBACK_MS - elapsedMs),
		);
	}

	function releaseStaleBuffer(bufferIndex, expectedBuffer) {
		if (activeBuffer === bufferIndex || buffers[bufferIndex] !== expectedBuffer) return;
		setBuffer(bufferIndex, EMPTY_BUFFER);
	}

	function playbackSource(source, purpose) {
		playSerial += 1;
		return `${source}#penguin-${purpose}-${playSerial}`;
	}

	function waitForDelay(delayMs, token) {
		if (!isCurrent(token)) return Promise.resolve(false);
		if (delayMs <= 0) return Promise.resolve(true);
		cancelSequenceWait();
		return new Promise((resolve) => {
			let timer = null;
			let complete = false;
			const finish = (result) => {
				if (complete) return;
				complete = true;
				if (timer !== null) globalThis.clearTimeout(timer);
				if (sequenceWaitCancel === cancel) sequenceWaitCancel = null;
				resolve(result && isCurrent(token));
			};
			const cancel = () => finish(false);
			sequenceWaitCancel = cancel;
			timer = globalThis.setTimeout(() => finish(true), Math.ceil(delayMs));
		});
	}

	function waitForNextPaint(token) {
		if (!isCurrent(token)) return Promise.resolve(false);
		return new Promise((resolve) => {
			const finish = () => resolve(isCurrent(token));
			if (typeof globalThis.requestAnimationFrame === 'function') {
				globalThis.requestAnimationFrame(finish);
			} else {
				globalThis.setTimeout(finish, FRAME_ARM_BUDGET_MS);
			}
		});
	}

	function probeSource(source, token) {
		if (decodedSources.has(source)) return Promise.resolve(isCurrent(token));
		if (!isCurrent(token) || typeof globalThis.Image !== 'function') return Promise.resolve(false);
		cancelActiveProbe();

		return new Promise((resolve) => {
			const image = new globalThis.Image();
			let timeout = null;
			let complete = false;
			const cleanup = () => {
				if (timeout !== null) globalThis.clearTimeout(timeout);
				timeout = null;
				image.onload = null;
				image.onerror = null;
				image.removeAttribute('src');
				if (activeProbeCancel === cancel) activeProbeCancel = null;
			};
			const finish = (result) => {
				if (complete) return;
				complete = true;
				const decoded = result
					&& isCurrent(token)
					&& image.complete
					&& image.naturalWidth > 0;
				if (decoded) decodedSources.add(source);
				cleanup();
				resolve(decoded);
			};
			const cancel = () => finish(false);
			activeProbeCancel = cancel;
			image.decoding = 'async';
			image.onerror = () => finish(false);
			timeout = globalThis.setTimeout(() => finish(false), IMAGE_READY_TIMEOUT_MS);
			image.src = source;
			if (typeof image.decode === 'function') {
				image.decode().then(() => finish(true), () => finish(false));
			} else {
				image.onload = () => finish(true);
			}
		});
	}

	function waitForMountedWarm(image, expectedSource, token, expectedBuffer) {
		if (!image || !isCurrent(token)) return Promise.resolve(false);
		if (
			image.getAttribute('src') === expectedSource
			&& image.complete
			&& image.naturalWidth > 0
		) return Promise.resolve(true);

		cancelArmWait();
		return new Promise((resolve) => {
			let timeout = null;
			let complete = false;
			const cleanup = () => {
				image.removeEventListener('load', loaded);
				image.removeEventListener('error', failedToLoad);
				if (timeout !== null) globalThis.clearTimeout(timeout);
				timeout = null;
				if (armWaitCancel === cancel) armWaitCancel = null;
			};
			const finish = (result) => {
				if (complete) return;
				complete = true;
				cleanup();
				resolve(Boolean(
					result
					&& isCurrent(token)
					&& buffers.includes(expectedBuffer)
					&& image.getAttribute('src') === expectedSource
					&& image.complete
					&& image.naturalWidth > 0
				));
			};
			const cancel = () => finish(false);
			const loaded = () => finish(true);
			const failedToLoad = () => finish(false);
			armWaitCancel = cancel;
			image.addEventListener('load', loaded, { once: true });
			image.addEventListener('error', failedToLoad, { once: true });
			timeout = globalThis.setTimeout(() => finish(false), IMAGE_READY_TIMEOUT_MS);
		});
	}

	async function activateClip(clipId, token, phase) {
		const clip = penguinClipForId(clipId);
		if (!clip || !isCurrent(token)) return false;
		targetClipId = clipId;
		if (
			clip.kind !== 'bridge'
			&& currentClipId === clipId
			&& buffers[activeBuffer].source === clip.source
			&& ready
		) {
			sequencePhase = phase;
			return true;
		}

		const pendingBufferIndex = activeBuffer === 0 ? 1 : 0;
		sequencePhase = 'arming';
		let warmBuffer = null;
		let warmed = false;
		for (let attempt = 0; attempt < 2; attempt += 1) {
			const warmSource = playbackSource(clip.source, `warm-${attempt + 1}`);
			warmBuffer = setBuffer(pendingBufferIndex, {
				clipId,
				state: clip.semanticState,
				source: clip.source,
				playSource: warmSource,
				token,
				startedAt: 0,
			});
			await tick();
			warmed = await waitForMountedWarm(
				bufferElements[pendingBufferIndex],
				warmSource,
				token,
				warmBuffer,
			);
			if (warmed && isCurrent(token)) break;
			releaseStaleBuffer(pendingBufferIndex, warmBuffer);
			if (!isCurrent(token) || attempt > 0) return false;
			await tick();
			decodedSources.delete(clip.source);
			if (!await probeSource(clip.source, token)) return false;
		}
		if (!warmed || !isCurrent(token)) return false;

		// The warm URL proves that the bytes are paintable, but that hidden animated
		// instance may already be past frame zero. A fresh fragment restarts the native
		// WebP timeline. Keep the last decoded buffer visible until that fresh instance
		// is itself mounted and decoded; promoting it earlier lets a superseded fragment
		// error strand the semantic request on the fallback poster.
		const previousActiveBuffer = activeBuffer;
		const previousBuffer = buffers[previousActiveBuffer];
		let playBuffer = null;
		let playReady = false;
		let startedAt = 0;
		for (let attempt = 0; attempt < PLAY_INSTANCE_ATTEMPTS; attempt += 1) {
			startedAt = now();
			const playSource = playbackSource(clip.source, `play-${attempt + 1}`);
			playBuffer = setBuffer(pendingBufferIndex, {
				clipId,
				state: clip.semanticState,
				source: clip.source,
				playSource,
				token,
				startedAt,
			});
			await tick();
			playReady = await waitForMountedWarm(
				bufferElements[pendingBufferIndex],
				playSource,
				token,
				playBuffer,
			);
			if (playReady && isCurrent(token) && buffers[pendingBufferIndex] === playBuffer) break;
			releaseStaleBuffer(pendingBufferIndex, playBuffer);
			if (!isCurrent(token)) return false;
			await tick();
		}
		if (!playReady || !playBuffer || buffers[pendingBufferIndex] !== playBuffer) return false;
		if (!await waitForNextPaint(token) || buffers[pendingBufferIndex] !== playBuffer) {
			releaseStaleBuffer(pendingBufferIndex, playBuffer);
			return false;
		}
		// Latch semantic changes before the Svelte flush can paint a bridge. This
		// closes the one-frame window between DOM activation and the 400 ms hold.
		if (clip.kind === 'bridge') bridgeLocked = true;
		activeBuffer = pendingBufferIndex;
		currentClipId = clipId;
		currentClipPlaybackStartedAt = startedAt;
		currentClipActivatedAt = now();
		visibleState = clip.semanticState;
		sequencePhase = phase;
		ready = true;
		await tick();
		if (buffers[activeBuffer] !== playBuffer) return false;
		releaseBufferAfterCrossfade(previousActiveBuffer, previousBuffer, startedAt);
		return isCurrent(token);
	}

	function reactionPriority(reaction) {
		return penguinClipForId(reaction)?.priority ?? 0;
	}

	async function waitForReactionHold(targetState, token) {
		if (!activeReaction || reactionActivatedAt <= 0 || targetState === 'poster') return true;
		if (
			isPenguinReactionState(targetState)
			&& reactionPriority(targetState) > reactionPriority(activeReaction)
		) return true;
		const minimumHoldMs = penguinClipForId(activeReaction)?.minimumHoldMs ?? 0;
		const remainingMs = minimumHoldMs - (now() - reactionActivatedAt);
		if (remainingMs <= 0) return true;
		sequencePhase = 'hold';
		return waitForDelay(remainingMs, token);
	}

	async function waitForIdleSafeGate(token) {
		const clip = penguinClipForId(currentClipId);
		if (
			clip?.kind !== 'idle'
			|| currentClipPlaybackStartedAt <= 0
		) return true;
		const loopMs = clip.durationMs;
		if (!Number.isFinite(loopMs) || loopMs <= 0) return true;
		const positionMs = Math.max(0, now() - currentClipPlaybackStartedAt) % loopMs;
		const waitMs = penguinIdleSafeWindowDelayMs({
			positionMs,
			loopMs,
			safeGateWindowsMs: clip.safeGateWindowsMs,
			armBudgetMs: FRAME_ARM_BUDGET_MS,
		});
		if (waitMs === null || waitMs <= 0) return true;
		sequencePhase = 'gate';
		return waitForDelay(waitMs, token);
	}

	async function waitForReactionLoopBoundary(token) {
		const clip = penguinClipForId(currentClipId);
		if (
			clip?.kind !== 'reaction'
			|| currentClipPlaybackStartedAt <= 0
		) return true;
		const elapsedMs = Math.max(0, now() - currentClipPlaybackStartedAt);
		if (clip.loop !== true && elapsedMs >= clip.durationMs - SAFE_GATE_TOLERANCE_MS) {
			return true;
		}
		const positionMs = clip.loop === true ? elapsedMs % clip.durationMs : elapsedMs;
		if (
			clip.loop === true
			&& (positionMs <= SAFE_GATE_TOLERANCE_MS || clip.durationMs - positionMs <= SAFE_GATE_TOLERANCE_MS)
		) return true;
		sequencePhase = 'reaction-gate';
		return waitForDelay(Math.max(0, clip.durationMs - positionMs - FRAME_ARM_BUDGET_MS), token);
	}

	async function preflightPlan(steps, token) {
		const availability = new Map();
		const orderedSteps = [
			...steps.filter((step) => step.required),
			...steps.filter((step) => !step.required),
		];
		for (const step of orderedSteps) {
			if (!isCurrent(token)) return null;
			if (availability.has(step.clipId)) continue;
			const clip = penguinClipForId(step.clipId);
			const available = Boolean(clip) && await probeSource(clip.source, token);
			availability.set(step.clipId, available);
			if (!available && step.required) return availability;
		}
		return availability;
	}

	async function revealFallbackPoster(token) {
		if (!isCurrent(token)) return;
		failed = true;
		targetClipId = 'poster';
		sequencePhase = 'fallback';
		const poster = penguinClipForId('poster');
		if (!poster || !await probeSource(poster.source, token) || !isCurrent(token)) {
			visibleState = 'missing';
			ready = Boolean(buffers[activeBuffer].source);
			return;
		}
		if (await activateClip('poster', token, 'fallback')) {
			settledState = 'poster';
			activeReaction = null;
			reactionActivatedAt = 0;
		}
	}

	function firstAvailableStep(plan, availability) {
		return plan.steps.find((step) => availability?.get(step.clipId) === true) ?? null;
	}

	async function runSemanticSequence(targetState, token) {
		const plan = planPenguinSemanticTransition({
			targetState,
			activeReaction,
			idleIndex,
			idlePaceIndex,
			currentClipId,
		});
		targetClipId = plan.steps[0]?.clipId ?? currentClipId;
		if (!await waitForReactionHold(targetState, token) || !isCurrent(token)) return;

		if (plan.steps.length === 0) {
			settledState = 'idle';
			sequencePhase = 'idle';
			queuedReaction = '';
			ignoredRecoveryEchoState = null;
			scheduleIdleRotation();
			return;
		}

		sequencePhase = 'preload';
		const availability = await preflightPlan(plan.steps, token);
		if (!availability || !isCurrent(token)) return;
		if (plan.steps.some((step) => step.required && availability.get(step.clipId) !== true)) {
			await revealFallbackPoster(token);
			return;
		}
		const degraded = plan.steps.some((step) => !step.required && availability.get(step.clipId) !== true);
		const firstStep = firstAvailableStep(plan, availability);
		targetClipId = firstStep?.clipId ?? currentClipId;

		if (!await waitForIdleSafeGate(token) || !isCurrent(token)) return;
		if (
			firstStep?.phase === 'exit'
			&& !await waitForReactionLoopBoundary(token)
		) return;

		for (const step of plan.steps) {
			if (!isCurrent(token)) return;
			if (availability.get(step.clipId) !== true) continue;
			targetClipId = step.clipId;
			const activated = await activateClip(step.clipId, token, step.phase);
			if (!isCurrent(token)) return;
			if (!activated) {
				bridgeLocked = false;
				await revealFallbackPoster(token);
				return;
			}

			if (step.phase === 'reaction') {
				activeReaction = step.reaction;
				reactionActivatedAt = currentClipActivatedAt;
				bridgeLocked = false;
				if (followupAfterQueuedReaction && requestedState === targetState) {
					deferredRequestedState = followupAfterQueuedReaction;
					followupAfterQueuedReaction = null;
				}
				if (launchDeferredSequence(targetState)) return;
				queuedReaction = requestedState === targetState ? '' : queuedReaction;
			}
			if (step.phase === 'idle') {
				idleIndex = plan.nextIdleIndex;
				idlePaceIndex = plan.nextIdlePaceIndex;
				activeReaction = null;
				reactionActivatedAt = 0;
			}

			const clip = penguinClipForId(step.clipId);
			if (clip?.kind === 'bridge') {
				bridgeLocked = true;
				if (!await waitForDelay(clip.durationMs, token)) {
					bridgeLocked = false;
					return;
				}
				if (step.phase === 'enter') {
					// Keep the bridge latch through activation of the reaction clip. The
					// bridge ends on reaction frame zero; an exit bridge starts at its end.
					activeReaction = step.reaction;
				} else {
					bridgeLocked = false;
					if (step.phase === 'exit') {
						activeReaction = null;
						reactionActivatedAt = 0;
					}
					if (launchDeferredSequence(targetState)) return;
				}
			}
		}

		if (!isCurrent(token)) return;
		failed = degraded;
		settledState = targetState;
		sequencePhase = targetState === 'idle' ? 'idle' : targetState === 'poster' ? 'poster' : 'reaction';
		targetClipId = currentClipId;
		if (targetState === 'idle') {
			ignoredRecoveryEchoState = null;
			scheduleIdleRotation();
		}
	}

	async function runIdleRotation(token) {
		const plan = planPenguinIdleRotation(idlePaceIndex);
		targetClipId = plan.steps[0].clipId;
		sequencePhase = 'preload-idle';
		const availability = await preflightPlan(plan.steps, token);
		if (!availability || !isCurrent(token)) return;
		// An idle variant is never cut directly to another. If either endpoint or
		// the neutral handoff is missing, keep the current loop and try again later.
		if (plan.steps.some((step) => availability.get(step.clipId) !== true)) {
			failed = true;
			sequencePhase = 'idle';
			targetClipId = currentClipId;
			scheduleIdleRotation();
			return;
		}
		if (!await waitForIdleSafeGate(token) || !isCurrent(token)) return;

		for (const step of plan.steps) {
			targetClipId = step.clipId;
			const activated = await activateClip(step.clipId, token, step.phase);
			if (!isCurrent(token)) return;
			if (!activated) {
				bridgeLocked = false;
				await revealFallbackPoster(token);
				return;
			}
			const clip = penguinClipForId(step.clipId);
			if (clip?.kind === 'bridge') {
				bridgeLocked = true;
				if (!await waitForDelay(clip.durationMs, token)) {
					bridgeLocked = false;
					return;
				}
				bridgeLocked = false;
				if (launchDeferredSequence('idle')) return;
			}
		}
		if (!isCurrent(token)) return;
		idleIndex = plan.nextIdleIndex;
		idlePaceIndex = plan.nextIdlePaceIndex;
		visibleState = 'idle';
		settledState = 'idle';
		sequencePhase = 'idle';
		targetClipId = currentClipId;
		failed = false;
		scheduleIdleRotation();
	}

	function scheduleIdleRotation() {
		clearIdleRotationTimer();
		const clip = penguinClipForId(currentClipId);
		if (
			destroyed
			|| reducedMotion
			|| requestedState !== 'idle'
			|| clip?.kind !== 'idle'
		) return;
		const dwellMs = clip.rotateAfterMs;
		if (!Number.isFinite(dwellMs) || dwellMs <= 0) return;
		idleRotationTimer = globalThis.setTimeout(() => {
			idleRotationTimer = null;
			if (destroyed || reducedMotion || requestedState !== 'idle') return;
			const token = ++generation;
			cancelSequenceWait();
			cancelArmWait();
			cancelActiveProbe();
			void runIdleRotation(token);
		}, dwellMs);
	}

	function requestSemanticState(nextState) {
		const normalizedState = normalizePenguinState(nextState);
		if (
			normalizedState === ignoredRecoveryEchoState
			&& (followupAfterQueuedReaction === 'idle' || requestedState === 'idle')
		) return;
		if (
			isPenguinReactionState(requestedState)
			&& visibleState !== requestedState
		) {
			if (normalizedState === 'idle') {
				// The semantic director can finish before a lower-priority accepted
				// reaction has cleared its hold (BONUS -> WIN BIG). Queue recovery behind
				// that reaction's first decoded frame instead of cancelling it mid-bridge.
				followupAfterQueuedReaction = 'idle';
				ignoredRecoveryEchoState = activeReaction;
				return;
			}
			if (normalizedState === activeReaction) {
				// A late feature-background echo describes the reaction we are already
				// leaving. It must not overwrite an idle recovery that was queued by the
				// authoritative round completion.
				return;
			}
		}
		followupAfterQueuedReaction = null;
		ignoredRecoveryEchoState = null;
		requestedState = normalizedState;
		queuedReaction = isPenguinReactionState(normalizedState) ? normalizedState : '';
		if (bridgeLocked && normalizedState !== 'poster') {
			// Once a one-shot bridge is visible it is atomic. Keep only the newest
			// semantic request and re-plan from the authored endpoint.
			deferredRequestedState = normalizedState;
			return;
		}
		bridgeLocked = false;
		deferredRequestedState = null;
		const token = ++generation;
		cancelSequenceWork();
		sequencePhase = 'queued';
		void runSemanticSequence(normalizedState, token);
	}

	function handleBufferError(bufferIndex) {
		if (bufferIndex !== activeBuffer || destroyed) return;
		const image = bufferElements[bufferIndex];
		if (
			image?.complete
			&& image.naturalWidth > 0
			&& image.getAttribute('src') === buffers[bufferIndex].playSource
		) return;
		failed = true;
		ready = false;
		if (buffers[bufferIndex].source === PENGUIN_OPERATOR_ASSETS.poster) {
			visibleState = 'missing';
			sequencePhase = 'missing';
			return;
		}
		const token = ++generation;
		bridgeLocked = false;
		deferredRequestedState = null;
		cancelSequenceWork();
		void revealFallbackPoster(token);
	}

	onMount(() => {
		reducedMotionQuery = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null;
		reducedMotion = reducedMotionQuery?.matches === true;
		reducedMotionListener = (event) => {
			reducedMotion = event.matches === true;
		};
		if (typeof reducedMotionQuery?.addEventListener === 'function') {
			reducedMotionQuery.addEventListener('change', reducedMotionListener);
		} else {
			reducedMotionQuery?.addListener?.(reducedMotionListener);
		}
		mounted = true;
		const activeImage = bufferElements[activeBuffer];
		if (activeImage?.complete && activeImage.naturalWidth > 0) {
			decodedSources.add(PENGUIN_OPERATOR_ASSETS.poster);
			ready = true;
		}
		requestSemanticState(reducedMotion ? 'poster' : state);
		return () => {
			destroyed = true;
			generation += 1;
			cancelSequenceWork();
			clearBufferReleases();
			if (typeof reducedMotionQuery?.removeEventListener === 'function') {
				reducedMotionQuery.removeEventListener('change', reducedMotionListener);
			} else {
				reducedMotionQuery?.removeListener?.(reducedMotionListener);
			}
			reducedMotionQuery = null;
			reducedMotionListener = null;
		};
	});
</script>

<div
	class="penguin-operator"
	data-testid="penguin-operator"
	data-operator-kind="swat-penguin-v1"
	data-state={visibleState}
	data-settled-state={settledState}
	data-target-state={desiredState}
	data-source={buffers[activeBuffer].source ?? ''}
	data-play-source={buffers[activeBuffer].playSource ?? ''}
	data-ready={ready ? 'true' : 'false'}
	data-fallback={failed ? 'true' : 'false'}
	data-transition-ms={CROSSFADE_MS}
	data-minimum-hold-ms={visibleMinimumHoldMs}
	data-queued-state={queuedState}
	data-reduced-motion={reducedMotion ? 'true' : 'false'}
	data-suspended={suspended ? 'true' : 'false'}
	data-phase={sequencePhase}
	data-sequence-phase={sequencePhase}
	data-clip={currentClipId}
	data-current-clip={currentClipId}
	data-target-clip={targetClipId}
	data-idle-index={idleIndex}
	data-idle-pace-index={idlePaceIndex}
	data-idle-dwell-ms={visibleIdleDwellMs}
	data-idle-loop-ms={visibleIdleLoopMs}
	data-queued-reaction={queuedReaction}
	data-generation={generation}
	data-bridge-locked={bridgeLocked ? 'true' : 'false'}
	data-deferred-state={deferredRequestedState ?? ''}
>
	<div class="penguin-media" data-testid="penguin-media" aria-hidden="true">
		{#each BUFFER_INDICES as bufferIndex (bufferIndex)}
			<img
				class="penguin-buffer"
				use:registerBuffer={bufferIndex}
				data-testid={bufferIndex === activeBuffer
					? 'penguin-operator-active'
					: 'penguin-operator-buffer'}
				data-state={buffers[bufferIndex].state}
				data-clip={buffers[bufferIndex].clipId}
				data-active={bufferIndex === activeBuffer ? 'true' : 'false'}
				src={buffers[bufferIndex].playSource ?? undefined}
				alt=""
				aria-hidden="true"
				draggable="false"
				loading="eager"
				decoding="async"
				fetchpriority={bufferIndex === activeBuffer ? 'high' : 'auto'}
				on:error={() => handleBufferError(bufferIndex)}
			/>
		{/each}
	</div>
</div>

<style>
	.penguin-operator {
		position: absolute;
		inset: 0;
		contain: layout paint;
		overflow: hidden;
		pointer-events: none;
	}

	.penguin-media {
		position: absolute;
		inset: 0;
		width: 100%;
	}

	/* Keep the grounding shadow static. Applying a blurred drop-shadow to the
	   animated alpha bitmap forces a full filter pass for every decoded frame. */
	.penguin-media::before {
		content: '';
		position: absolute;
		z-index: 0;
		left: 8%;
		bottom: 0.2%;
		width: 32%;
		height: 4.2%;
		border-radius: 50%;
		background: radial-gradient(
			ellipse at center,
			rgba(0, 0, 0, 0.52) 0%,
			rgba(0, 0, 0, 0.25) 44%,
			transparent 74%
		);
		pointer-events: none;
	}

	.penguin-buffer {
		position: absolute;
		inset: 0;
		display: block;
		width: 100%;
		height: 100%;
		z-index: 1;
		object-fit: contain;
		object-position: left bottom;
		opacity: 0;
		transition: opacity 130ms cubic-bezier(0.2, 0.72, 0.22, 1);
	}

	.penguin-buffer[data-active='true'] {
		z-index: 2;
		opacity: 1;
		transition-duration: 0ms;
	}

	.penguin-buffer[data-active='false'] {
		z-index: 1;
		opacity: 0;
	}

	@media (max-height: 720px) and (min-aspect-ratio: 667/500) {
		.penguin-media {
			inset: 1.5% 0 0;
			width: 100%;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.penguin-buffer {
			transition-duration: 0ms;
		}
	}
</style>
