import assert from 'node:assert/strict';
import test from 'node:test';
import { createAuthoritativePageLifecycle } from '../src/lib/runtime/page-lifecycle.js';

test('pagehide tears authoritative controllers down exactly once', () => {
	let teardownCount = 0;
	let reloadCount = 0;
	const lifecycle = createAuthoritativePageLifecycle({
		teardown: () => {
			teardownCount += 1;
		},
		reload: () => {
			reloadCount += 1;
		},
	});

	assert.equal(lifecycle.handlePageHide(), true);
	assert.equal(lifecycle.handlePageHide(), false);
	assert.equal(lifecycle.dispose(), false);
	assert.equal(teardownCount, 1);
	assert.equal(reloadCount, 0);
});

test('only a persisted pageshow requests one authoritative reload', () => {
	let teardownCount = 0;
	let reloadCount = 0;
	const lifecycle = createAuthoritativePageLifecycle({
		teardown: () => {
			teardownCount += 1;
		},
		reload: () => {
			reloadCount += 1;
		},
	});

	assert.equal(lifecycle.handlePageShow({ persisted: false }), false);
	assert.equal(lifecycle.handlePageHide(), true);
	assert.equal(lifecycle.handlePageShow({ persisted: true }), true);
	assert.equal(lifecycle.handlePageShow({ persisted: true }), false);
	assert.equal(teardownCount, 1);
	assert.equal(reloadCount, 1);
});

test('component disposal tears down once and ignores later transition events', () => {
	let teardownCount = 0;
	let reloadCount = 0;
	const lifecycle = createAuthoritativePageLifecycle({
		teardown: () => {
			teardownCount += 1;
		},
		reload: () => {
			reloadCount += 1;
		},
	});

	assert.equal(lifecycle.dispose(), true);
	assert.equal(lifecycle.handlePageHide(), false);
	assert.equal(lifecycle.handlePageShow({ persisted: true }), false);
	assert.equal(lifecycle.dispose(), false);
	assert.equal(teardownCount, 1);
	assert.equal(reloadCount, 0);
});

test('page lifecycle rejects missing transition dependencies', () => {
	assert.throws(() => createAuthoritativePageLifecycle(), /teardown must be a function/u);
	assert.throws(
		() => createAuthoritativePageLifecycle({ teardown() {} }),
		/reload must be a function/u,
	);
});
