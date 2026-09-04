import assert from 'node:assert/strict';
import test from 'node:test';

import {
	MOTION_STORAGE_KEY,
	readMotionMode,
	writeMotionMode,
} from '../src/lib/runtime/motion-preference.js';

function memoryStorage(initial = {}) {
	const values = new Map(Object.entries(initial));
	return {
		getItem: (key) => values.get(key) ?? null,
		setItem: (key, value) => values.set(key, value),
		value: (key) => values.get(key) ?? null,
	};
}

test('motion preference defaults safely and restores versioned normal or turbo values', () => {
	assert.equal(readMotionMode(), 'normal');
	assert.equal(readMotionMode(memoryStorage({ [MOTION_STORAGE_KEY]: 'turbo' })), 'turbo');
	assert.equal(readMotionMode(memoryStorage({ [MOTION_STORAGE_KEY]: 'normal' })), 'normal');
	assert.equal(readMotionMode(memoryStorage({ [MOTION_STORAGE_KEY]: 'warp' })), 'normal');
});

test('motion preference tolerates unavailable browser storage', () => {
	const blockedStorage = {
		getItem: () => {
			throw new Error('blocked');
		},
		setItem: () => {
			throw new Error('blocked');
		},
	};
	assert.equal(readMotionMode(blockedStorage), 'normal');
	assert.equal(writeMotionMode(blockedStorage, 'turbo'), 'turbo');
});

test('motion preference persists only canonical modes', () => {
	const storage = memoryStorage();
	assert.equal(writeMotionMode(storage, 'turbo'), 'turbo');
	assert.equal(storage.value(MOTION_STORAGE_KEY), 'turbo');
	assert.equal(readMotionMode(storage), 'turbo');
	assert.throws(() => writeMotionMode(storage, 'reduced'), /normal or turbo/u);
});
