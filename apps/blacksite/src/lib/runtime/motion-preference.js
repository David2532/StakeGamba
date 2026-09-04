export const MOTION_STORAGE_KEY = 'blacksite.presentation.speed.v1';

const MOTION_MODES = new Set(['normal', 'turbo']);

export function readMotionMode(storage = null) {
	try {
		const stored = storage?.getItem(MOTION_STORAGE_KEY);
		return MOTION_MODES.has(stored) ? stored : 'normal';
	} catch {
		return 'normal';
	}
}

export function writeMotionMode(storage, mode) {
	if (!MOTION_MODES.has(mode)) {
		throw new TypeError('Motion mode must be normal or turbo.');
	}
	try {
		storage?.setItem(MOTION_STORAGE_KEY, mode);
	} catch {
		// Presentation controls remain usable when storage is unavailable.
	}
	return mode;
}
