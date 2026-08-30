import assert from 'node:assert/strict';
import test from 'node:test';
import {
	AUDIO_STORAGE_KEY,
	AudioDirector,
	createInitialAudioState,
} from '../src/lib/runtime/audio-director.js';
import { PresentationDirector } from '../src/lib/runtime/presentation-director.js';

class FakeAudioParam {
	constructor() {
		this.value = 0;
	}
	setValueAtTime(value) {
		this.value = value;
	}
	exponentialRampToValueAtTime(value) {
		this.value = value;
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
	}
	start() {
		this.started = true;
	}
	stop() {
		this.stopped = true;
	}
	finish() {
		this.onended?.();
	}
}

class FakeAudioContext {
	constructor() {
		this.currentTime = 1;
		this.state = 'suspended';
		this.destination = new FakeNode();
		this.gains = [];
		this.oscillators = [];
		this.resumeCalls = 0;
		this.suspendCalls = 0;
		this.closeCalls = 0;
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
		this.state = 'running';
	}
	async suspend() {
		this.suspendCalls += 1;
		this.state = 'suspended';
	}
	async close() {
		this.closeCalls += 1;
		this.state = 'closed';
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
	director.destroy();
	assert.equal(documentRef.listenerCount(), 0);
	assert.equal(context.closeCalls, 1);
});

test('mute levels persist, silence cues and restore without duplicating ambience', async () => {
	const storage = createStorage({ [AUDIO_STORAGE_KEY]: '0.28' });
	const context = new FakeAudioContext();
	const director = new AudioDirector({
		audioContextFactory: () => context,
		storage,
		documentRef: createDocument(),
	});
	assert.equal(director.state.level, 'LOW');
	await director.unlock();
	director.setVolume(0);
	assert.equal(storage.value(AUDIO_STORAGE_KEY), '0');
	assert.equal(director.consume({ kind: 'win' }), false);
	assert.equal(context.oscillators.length, 1);
	director.cycleVolume();
	assert.equal(director.state.level, 'LOW');
	assert.equal(director.consume({ kind: 'win' }), true);
	assert.equal(director.state.cueCount, 1);
	assert.equal(director.state.ambienceInstances, 1);
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
