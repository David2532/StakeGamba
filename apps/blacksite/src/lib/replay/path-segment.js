const URL_DOT_SEGMENTS = new Set(['.', '..']);
const URL_PATH_SEGMENT = /^[A-Za-z0-9._~-]+$/u;

export function isSafeReplayPathSegment(value, maxLength = 240) {
	return (
		typeof value === 'string' &&
		value.length > 0 &&
		value.length <= maxLength &&
		value === value.trim() &&
		URL_PATH_SEGMENT.test(value) &&
		!URL_DOT_SEGMENTS.has(value)
	);
}
