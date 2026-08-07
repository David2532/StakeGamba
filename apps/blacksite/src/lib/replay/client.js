const DEFAULT_TIMEOUT_MS = 10_000;

export class ReplayClientError extends Error {
	constructor(code, message, { cause = null, status = null, rgsCode = null } = {}) {
		super(message, cause ? { cause } : undefined);
		this.name = 'ReplayClientError';
		this.code = code;
		this.status = status;
		this.rgsCode = rgsCode;
	}
}

function clientError(code, message, details) {
	return new ReplayClientError(code, message, details);
}

function requiredIdentity(value, label) {
	if (typeof value !== 'string' || value.trim() === '') {
		throw clientError('REPLAY_REQUEST_INVALID', `Replay ${label} is required.`);
	}
	return value;
}

function replayBaseUrl(rawValue) {
	if (typeof rawValue !== 'string' || rawValue.trim() === '') {
		throw clientError('REPLAY_REQUEST_INVALID', 'Replay rgsUrl is required.');
	}
	let url;
	try {
		url = new URL(rawValue);
	} catch (cause) {
		throw clientError('REPLAY_REQUEST_INVALID', 'Replay rgsUrl is invalid.', { cause });
	}
	if (
		!['https:', 'http:'].includes(url.protocol) ||
		url.username ||
		url.password ||
		url.search ||
		url.hash
	) {
		throw clientError('REPLAY_REQUEST_INVALID', 'Replay rgsUrl is invalid.');
	}
	return url.toString().replace(/\/+$/, '');
}

function replayUrl(launch) {
	const base = replayBaseUrl(launch?.rgsUrl);
	const identity = ['game', 'version', 'mode', 'event'].map((field) =>
		requiredIdentity(launch?.[field], field),
	);
	const path = identity.map((value) => encodeURIComponent(value)).join('/');
	return new URL(`${base}/bet/replay/${path}`).toString();
}

function rgsFailure(data) {
	if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
	const statusCode = data.status?.statusCode;
	if (data.error) {
		return {
			code: data.error.code ?? statusCode ?? null,
			message: data.error.message ?? data.status?.statusMessage ?? 'Replay RGS error.',
		};
	}
	if (statusCode && statusCode !== 'SUCCESS') {
		return {
			code: statusCode,
			message: data.status?.statusMessage ?? 'Replay RGS error.',
		};
	}
	return null;
}

export function createReplayClient({
	fetchImpl = globalThis.fetch,
	timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
	if (typeof fetchImpl !== 'function') {
		throw new TypeError('createReplayClient requires fetch.');
	}
	if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
		throw new TypeError('Replay timeoutMs must be a positive integer.');
	}

	const fetchRound = async (launch) => {
		const url = replayUrl(launch);
		const controller = new AbortController();
		let timedOut = false;
		const timeout = setTimeout(() => {
			timedOut = true;
			controller.abort();
		}, timeoutMs);

		try {
			let response;
			try {
				response = await fetchImpl(url, {
					method: 'GET',
					headers: { Accept: 'application/json' },
					signal: controller.signal,
					credentials: 'omit',
					redirect: 'error',
				});
			} catch (cause) {
				if (timedOut || cause?.name === 'AbortError') {
					throw clientError('REPLAY_TIMEOUT', 'Replay request timed out.', { cause });
				}
				throw clientError('REPLAY_NETWORK_ERROR', 'Replay request failed.', { cause });
			}

			let text;
			try {
				text = await response.text();
			} catch (cause) {
				if (timedOut || cause?.name === 'AbortError') {
					throw clientError('REPLAY_TIMEOUT', 'Replay request timed out.', { cause });
				}
				throw clientError('REPLAY_NETWORK_ERROR', 'Replay response could not be read.', {
					cause,
					status: response.status,
				});
			}
			let data;
			try {
				data = text === '' ? null : JSON.parse(text);
			} catch (cause) {
				throw clientError('REPLAY_JSON_INVALID', 'Replay endpoint returned invalid JSON.', {
					cause,
					status: response.status,
				});
			}

			if (!response.ok) {
				throw clientError('REPLAY_HTTP_ERROR', 'Replay endpoint returned an HTTP error.', {
					status: response.status,
				});
			}
			const failure = rgsFailure(data);
			if (failure) {
				throw clientError('REPLAY_RGS_ERROR', failure.message, { rgsCode: failure.code });
			}
			return data;
		} finally {
			clearTimeout(timeout);
		}
	};

	return Object.freeze({ fetchRound });
}
