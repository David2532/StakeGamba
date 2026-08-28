import assert from 'node:assert/strict';
import test from 'node:test';

import { DisplayRefreshMonitor } from '../src/lib/runtime/display-refresh-monitor.js';

const frameMs = (refreshHz) => 1000 / refreshHz;

function createMonitor() {
	return new DisplayRefreshMonitor({
		requestFrame: () => 1,
		cancelFrame: () => {},
		documentObject: null,
	});
}

function publishAt(monitor, refreshHz, timestamp) {
	monitor.samples = Array.from({ length: 60 }, () => frameMs(refreshHz));
	monitor.publish(timestamp);
	return monitor.snapshot.refreshHz;
}

test('refresh baseline requires two stable windows and adapts from 240 Hz down to 60 Hz', () => {
	const monitor = createMonitor();

	assert.equal(publishAt(monitor, 240, 500), 60);
	assert.equal(publishAt(monitor, 240, 1_000), 240);
	assert.equal(publishAt(monitor, 60, 1_500), 240);
	assert.equal(publishAt(monitor, 60, 2_000), 60);
});

test('refresh baseline adapts bidirectionally for 60 to 30 and 60 to 144 Hz switches', () => {
	const slowMonitor = createMonitor();
	assert.equal(publishAt(slowMonitor, 60, 500), 60);
	assert.equal(publishAt(slowMonitor, 30, 1_000), 60);
	assert.equal(publishAt(slowMonitor, 30, 1_500), 30);

	const fastMonitor = createMonitor();
	assert.equal(publishAt(fastMonitor, 60, 500), 60);
	assert.equal(publishAt(fastMonitor, 144, 1_000), 60);
	assert.equal(publishAt(fastMonitor, 144, 1_500), 144);
});

test('a contradictory sample window clears a pending refresh switch', () => {
	const monitor = createMonitor();

	assert.equal(publishAt(monitor, 60, 500), 60);
	assert.equal(publishAt(monitor, 30, 1_000), 60);
	assert.equal(publishAt(monitor, 60, 1_500), 60);
	assert.equal(publishAt(monitor, 30, 2_000), 60);
});

test('sampling reset also clears an unconfirmed refresh switch', () => {
	const monitor = createMonitor();

	assert.equal(publishAt(monitor, 144, 500), 60);
	monitor.resetSampling();
	assert.equal(publishAt(monitor, 144, 1_000), 60);
});
