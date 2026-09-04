const URL_DOT_SEGMENTS = new Set(['.', '..']);

function decodesToUrlDotSegment(value) {
	let decoded = value;
	for (let depth = 0; depth <= value.length; depth += 1) {
		if (URL_DOT_SEGMENTS.has(decoded)) return true;
		let next;
		try {
			next = decodeURIComponent(decoded);
		} catch {
			return false;
		}
		if (next === decoded) return false;
		decoded = next;
	}
	return true;
}

export function isSafeReplayPathSegment(value, maxLength = 240) {
	return (
		typeof value === 'string' &&
		value.length > 0 &&
		value.length <= maxLength &&
		value === value.trim() &&
		!decodesToUrlDotSegment(value) &&
		![...value].some((character) => {
			const code = character.charCodeAt(0);
			return code < 32 || code === 127;
		})
	);
}
