import assert from 'node:assert/strict';
import test from 'node:test';
import {
	AUDIO_STORAGE_KEY,
	AudioDirector,
	createInitialAudioState,
} from '../src/lib/runtime/audio-director.js';
import { GAME_EVENT_CUE_KINDS } from '../src/lib/runtime/game-event-adapter.js';
import { PresentationDirector } from '../src/lib/runtime/presentation-director.js';

class FakeAudioParam {
	constructor() {
		this.value = 0;
		this.automation = [];
	}
	setValueAtTime(value, time) {
		this.value = value;
		this.automation.push(['set', value, time]);
	}
	exponentialRampToValueAtTime(value, time) {
		this.value = value;
		this.automation.push(['ramp', value, time]);
	}
	cancelScheduledValues(time) {
		this.automation.push(['cancel', time]);
	}
}

class FakeNode {
	constructor() {
		this.connections = [];
	}
	connect(node) {
		this.connections.push(node);
		return node;
	}
	disconnect() {
		this.connections = [];
	}
}

class FakeGain extends FakeNode {
	constructor() {
		super();
		this.gain = new FakeAudioParam();
	}
}

class FakeOscillator extends FakeNode {
	constructor() {
		super();
		this.frequency = new FakeAudioParam();
		this.started = false;
		this.stopped = false;
		this.onended = null;
		this.startedAt = null;
		this.stoppedAt = null;
	}
	start(time) {
		this.started = true;
		this.startedAt = time;
	}
	stop(time) {
		this.stopped = true;
		this.stoppedAt = time ?? this.stoppedAt;
	}
	finish() {
		this.onended?.();
	}
}

class FakeAudioContext {
	constructor({ state = 'suspended' } = {}) {
		this.currentTime = 1;
		this.state = state;
		this.destination = new FakeNode();
		this.gains = [];
		this.oscillators = [];
		this.resumeCalls = 0;
		this.suspendCalls = 0;
		this.closeCalls = 0;
		this.suspendGate = null;
		this.resumeError = null;
		this.resumeState = 'running';
		this.listeners = new Map();
	}
	addEventListener(type, listener) {
		const listeners = this.listeners.get(type) ?? new Set();
		listeners.add(listener);
		this.listeners.set(type, listeners);
	}
	removeEventListener(type, listener) {
		this.listeners.get(type)?.delete(listener);
	}
	listenerCount(type) {
		return this.listeners.get(type)?.size ?? 0;
	}
	setState(state) {
		this.state = state;
		for (const listener of this.listeners.get('statechange') ?? []) listener();
	}
	createGain() {
		const gain = new FakeGain();
		this.gains.push(gain);
		return gain;
	}
	createOscillator() {
		const oscillator = new FakeOscillator();
		this.oscillators.push(oscillator);
		return oscillator;
	}
	async resume() {
		this.resumeCalls += 1;
		if (this.resumeError) throw this.resumeError;
		if (this.resumeState !== null) this.setState(this.resumeState);
	}
	async suspend() {
		this.suspendCalls += 1;
		if (this.suspendGate) await this.suspendGate;
		this.setState('suspended');
	}
	async close() {
		this.closeCalls += 1;
		this.setState('closed');
	}
}

function createStorage(initial = {}) {
	const values = new Map(Object.entries(initial));
	return {
		getItem: (key) => values.get(key) ?? null,
		setItem: (key, value) => values.set(key, value),
		value: (key) => values.get(key),
	};
}

function createDocument() {
	const listeners = new Map();
	return {
		hidden: false,
		addEventListener(type, listener) {
			listeners.set(type, listener);
		},
		removeEventListener(type) {
			listeners.delete(type);
		},
		dispatch(type) {
			return listeners.get(type)?.();
		},
		listenerCount: () => listeners.size,
	};
}

test('audio stays policy-locked until a user gesture and starts one ambience graph', async () => {
	const context = new FakeAudioContext();
	const documentRef = createDocument();
	const director = new AudioDirector({
		audioContextFactory: () => context,
		storage: createStorage(),
		documentRef,
	});
	assert.deepEqual(director.state, createInitialAudioState());
	assert.equal(director.consume({ kind: 'round_started' }), false);
	assert.equal(context.oscillators.length, 0);
	assert.equal(await director.unlock(), true);
	assert.equal(await director.unlock(), true);
	assert.equal(context.resumeCalls, 1);
	assert.equal(director.state.unlocked, true);
	assert.equal(director.state.ambienceInstances, 1);
	assert.equal(context.oscillators.length, 1);
	assert.equal(context.listenerCount('statechange'), 1);
	director.destroy();
	assert.equal(documentRef.listenerCount(), 0);
	assert.equal(context.listenerCount('statechange'), 0);
	assert.equal(context.closeCalls, 1);
});

test('interrupted contexts resume only when they reach running and external changes stay truthful', async () => {
	const context = new FakeAudioContext({ state: 'interrupted' });
	const director = new AudioDirector({
		audioContextFactory: () => context,
		storage: createStorage(),
		documentRef: createDocument(),
	});

	assert.equal(await director.unlock(), true);
	assert.equal(context.resumeCalls, 1);
	assert.equal(director.state.status, 'running');
	assert.equal(director.state.contextState, 'running');
	assert.equal(director.state.ambienceInstances, 1);

	context.setState('interrupted');
	assert.equal(director.state.status, 'suspended');
	assert.equal(director.state.contextState, 'interrupted');
	assert.equal(director.playUi(), false);
	assert.equal(await director.resume(), true);
	assert.equal(context.resumeCalls, 2);
	assert.equal(director.state.status, 'running');
	assert.equal(director.state.ambienceInstances, 1);

	context.setState('interrupted');
	director.setVolume(0);
	assert.equal(director.state.status, 'suspended');
	assert.equal(director.state.ambienceInstances, 0);
	director.setVolume(0.28);
	assert.equal(director.state.status, 'suspended');
	assert.equal(director.state.ambienceInstances, 0);
	context.setState('running');
	assert.equal(director.state.status, 'running');
	assert.equal(director.state.ambienceInstances, 1);
	context.setState('closed');
	assert.equal(director.state.status, 'closed');
	assert.equal(director.state.contextState, 'closed');
	assert.equal(director.state.ambienceInstances, 0);
	assert.equal(await director.resume(), false);

	director.destroy();
	assert.equal(context.listenerCount('statechange'), 0);
});

test('unlock fails closed when resume rejects, does not transition, or the context is closed', async () => {
	for (const setup of [
		(context) => {
			context.resumeError = new Error('resume rejected');
		},
		(context) => {
			context.resumeState = null;
		},
	]) {
		const context = new FakeAudioContext({ state: 'interrupted' });
		setup(context);
		const director = new AudioDirector({
			audioContextFactory: () => context,
			storage: createStorage(),
			documentRef: createDocument(),
		});

		assert.equal(await director.unlock(), false);
		assert.equal(context.resumeCalls, 1);
		assert.equal(director.state.unlocked, false);
		assert.equal(director.state.status, 'suspended');
		assert.equal(director.state.contextState, 'interrupted');
		assert.equal(director.state.ambienceInstances, 0);
		director.destroy();
	}

	const closedContext = new FakeAudioContext({ state: 'closed' });
	const closedDirector = new AudioDirector({
		audioContextFactory: () => closedContext,
		storage: createStorage(),
		documentRef: createDocument(),
	});
	assert.equal(await closedDirector.unlock(), false);
	assert.equal(closedContext.resumeCalls, 0);
	assert.equal(closedDirector.state.unlocked, false);
	assert.equal(closedDirector.state.status, 'closed');
	assert.equal(closedDirector.state.contextState, 'closed');
	assert.equal(closedDirector.state.ambienceInstances, 0);
	closedDirector.destroy();
});

test('mute tears down active sources and unmute restores exactly one ambience graph', async () => {
	const storage = createStorage({ [AUDIO_STORAGE_KEY]: '0.28' });
	const context = new FakeAudioContext();
	const director = new AudioDirector({
		audioContextFactory: () => context,
		storage,
		documentRef: createDocument(),
	});
	assert.equal(director.state.level, 'LOW');
	await director.unlock();
	assert.equal(director.consume({ kind: 'win' }), true);
	const initialAmbience = context.oscillators[0];
	const activeVoice = context.oscillators[1];
	const activeVoiceGain = context.gains[2];
	assert.equal(director.state.activeVoices, 1);
	assert.equal(activeVoiceGain.connections.length, 1);
	director.setVolume(0);
	assert.equal(storage.value(AUDIO_STORAGE_KEY), '0');
	assert.equal(director.consume({ kind: 'win' }), false);
	assert.equal(initialAmbience.stopped, true);
	assert.equal(activeVoice.stopped, true);
	assert.equal(activeVoiceGain.connections.length, 0);
	assert.equal(director.state.activeVoices, 0);
	assert.equal(director.state.ambienceInstances, 0);
	director.cycleVolume();
	assert.equal(director.state.level, 'LOW');
	assert.equal(director.consume({ kind: 'win' }), true);
	assert.equal(director.state.cueCount, 2);
	assert.equal(director.state.ambienceInstances, 1);
	assert.equal(director.state.activeVoices, 1);
	assert.equal(context.oscillators.length, 4);
	assert.equal(context.oscillators[2].stopped, false);
	director.destroy();
});

test('visibility lifecycle suspends and resumes the same graph without stacked music', async () => {
	const documentRef = createDocument();
	const context = new FakeAudioContext();
	const director = new AudioDirector({
		audioContextFactory: () => context,
		storage: createStorage(),
		documentRef,
	});
	await director.unlock();
	documentRef.hidden = true;
	await documentRef.dispatch('visibilitychange');
	assert.equal(context.state, 'suspended');
	assert.equal(director.consume({ kind: 'feature_started' }), false);
	documentRef.hidden = false;
	await documentRef.dispatch('visibilitychange');
	assert.equal(context.state, 'running');
	assert.equal(director.state.ambienceInstances, 1);
	assert.equal(context.oscillators.length, 1);
	director.destroy();
});

test('rapid hidden-visible transitions finish resumed instead of racing into suspended audio', async () => {
	const documentRef = createDocument();
	const context = new FakeAudioContext();
	let releaseSuspend;
	context.suspendGate = new Promise((resolve) => {
		releaseSuspend = resolve;
	});
	const director = new AudioDirector({
		audioContextFactory: () => context,
		storage: createStorage(),
		documentRef,
	});
	await director.unlock();
	documentRef.hidden = true;
	const hiddenTransition = documentRef.dispatch('visibilitychange');
	await Promise.resolve();
	await Promise.resolve();
	assert.equal(context.suspendCalls, 1);
	documentRef.hidden = false;
	const visibleTransition = documentRef.dispatch('visibilitychange');
	releaseSuspend();
	await Promise.all([hiddenTransition, visibleTransition]);
	assert.equal(context.state, 'running');
	assert.equal(director.state.status, 'running');
	assert.equal(context.resumeCalls, 2);
	assert.equal(director.state.ambienceInstances, 1);
	director.destroy();
});

test('muted visibility resume remains source-free until the player unmutes', async () => {
	const documentRef = createDocument();
	const context = new FakeAudioContext();
	const director = new AudioDirector({
		audioContextFactory: () => context,
		storage: createStorage({ [AUDIO_STORAGE_KEY]: '0' }),
		documentRef,
	});
	await director.unlock();
	assert.equal(director.state.level, 'MUTED');
	assert.equal(director.state.ambienceInstances, 0);
	assert.equal(context.oscillators.length, 0);
	documentRef.hidden = true;
	await documentRef.dispatch('visibilitychange');
	assert.equal(context.state, 'suspended');
	documentRef.hidden = false;
	await documentRef.dispatch('visibilitychange');
	assert.equal(context.state, 'running');
	assert.equal(director.state.level, 'MUTED');
	assert.equal(director.state.ambienceInstances, 0);
	assert.equal(context.oscillators.length, 0);
	director.cycleVolume();
	assert.equal(director.state.ambienceInstances, 1);
	assert.equal(context.oscillators.length, 1);
	director.destroy();
});

test('authoritative cues are bounded in turbo and presentation forwards exact cue order', async () => {
	let nowMs = 1_000;
	const context = new FakeAudioContext();
	const audio = new AudioDirector({
		audioContextFactory: () => context,
		storage: createStorage(),
		documentRef: createDocument(),
		now: () => nowMs,
	});
	await audio.unlock();
	assert.equal(audio.consume({ kind: 'tumble' }, { timingProfile: 'turbo' }), true);
	assert.equal(audio.consume({ kind: 'tumble' }, { timingProfile: 'turbo' }), false);
	nowMs += 70;
	assert.equal(audio.consume({ kind: 'tumble' }, { timingProfile: 'turbo' }), true);

	const forwarded = [];
	const presentation = new PresentationDirector(
		() => {},
		(cue) => forwarded.push(cue.kind),
	);
	presentation.consume({
		kind: 'round_started',
		eventIndex: 0,
		event: { mode: 'base', initial_phase: 'base' },
	});
	presentation.consume({
		kind: 'board_snapshot',
		eventIndex: 1,
		event: { board: [], phase: 'base', feature_cycle: 0, tumble_index: 0 },
	});
	assert.deepEqual(forwarded, ['round_started', 'board_snapshot']);
	presentation.destroy();
	audio.destroy();
});

test('breach cues play only for newly breached cells and remain cooldown-bounded', async () => {
	let nowMs = 2_000;
	const context = new FakeAudioContext();
	const audio = new AudioDirector({
		audioContextFactory: () => context,
		storage: createStorage(),
		documentRef: createDocument(),
		now: () => nowMs,
	});
	await audio.unlock();

	assert.equal(
		audio.consume({ kind: 'route_snapshot', event: { newly_breached_cells: [] } }),
		false,
	);
	assert.equal(
		audio.consume({
			kind: 'route_snapshot',
			event: { newly_breached_cells: [{ column: 3, row: 3 }] },
		}),
		true,
	);
	assert.equal(audio.state.lastRecipe, 'breach_cell_activation');
	assert.equal(audio.state.cueCount, 1);
	assert.equal(
		audio.consume({
			kind: 'route_snapshot',
			event: { newly_breached_cells: [{ column: 3, row: 4 }] },
		}),
		false,
	);
	nowMs += 24;
	assert.equal(
		audio.consume({
			kind: 'route_snapshot',
			event: { newly_breached_cells: [{ column: 3, row: 4 }] },
		}),
		true,
	);
	assert.equal(audio.state.cueCount, 2);
	audio.destroy();
});

test('audio accepts every cue kind emitted by the authoritative event adapter', async () => {
	let nowMs = 3_000;
	const context = new FakeAudioContext();
	const audio = new AudioDirector({
		audioContextFactory: () => context,
		storage: createStorage(),
		documentRef: createDocument(),
		now: () => nowMs,
	});
	await audio.unlock();

	for (const kind of GAME_EVENT_CUE_KINDS) {
		nowMs += 100;
		const event =
			kind === 'route_snapshot' ? { newly_breached_cells: [{ column: 3, row: 3 }] } : {};
		assert.equal(audio.consume({ kind, event }), true, `${kind} must have an audio recipe`);
	}
	assert.equal(audio.state.cueCount, GAME_EVENT_CUE_KINDS.length);
	audio.destroy();
});

test('reel stops schedule seven mechanical pulses and priority cues duck ambience', async () => {
	const context = new FakeAudioContext();
	const audio = new AudioDirector({
		audioContextFactory: () => context,
		storage: createStorage(),
		documentRef: createDocument(),
	});
	await audio.unlock();
	assert.equal(audio.consume({ kind: 'board_snapshot' }, { timingProfile: 'normal' }), true);
	assert.deepEqual(
		context.oscillators.slice(1).map((oscillator) => Number((oscillator.startedAt - 1).toFixed(3))),
		[0, 0.024, 0.048, 0.072, 0.096, 0.12, 0.144],
	);
	assert.equal(audio.state.lastRecipe, 'reel_stop_cadence');
	assert.equal(audio.state.reelStopPulses, 7);
	assert.equal(audio.state.activeVoices, 7);
	const oldestVoiceGain = context.gains[2];
	assert.equal(oldestVoiceGain.connections.length, 1);

	assert.equal(audio.consume({ kind: 'feature_started' }), true);
	assert.equal(audio.state.lastRecipe, 'blackout_lock');
	assert.equal(audio.state.priorityCues, 1);
	assert.equal(audio.state.duckCount, 1);
	assert.ok(
		context.gains[1].gain.automation.some(([kind, value]) => kind === 'ramp' && value === 0.0045),
	);
	assert.ok(audio.state.activeVoices <= 8);
	assert.equal(audio.consume({ kind: 'win' }), true);
	assert.equal(audio.state.activeVoices, 8);
	assert.equal(oldestVoiceGain.connections.length, 0);
	audio.destroy();
});
