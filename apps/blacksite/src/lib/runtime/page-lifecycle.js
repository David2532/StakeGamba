function requireCallback(value, label) {
	if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
}

/**
 * Owns page-transition teardown and forces a fresh authoritative bootstrap when a
 * previously frozen document is restored from the back-forward cache.
 *
 * @param {{teardown?: () => void, reload?: () => void}} [options]
 */
export function createAuthoritativePageLifecycle(options = {}) {
	const { teardown, reload } = options;
	requireCallback(teardown, 'teardown');
	requireCallback(reload, 'reload');

	let disposed = false;
	let teardownComplete = false;
	let reloadRequested = false;

	function teardownOnce() {
		if (teardownComplete) return false;
		teardownComplete = true;
		teardown();
		return true;
	}

	function handlePageHide() {
		if (disposed) return false;
		return teardownOnce();
	}

	function handlePageShow(event) {
		if (disposed || event?.persisted !== true || reloadRequested) return false;
		reloadRequested = true;
		reload();
		return true;
	}

	function dispose() {
		if (disposed) return false;
		disposed = true;
		return teardownOnce();
	}

	return Object.freeze({ dispose, handlePageHide, handlePageShow });
}
