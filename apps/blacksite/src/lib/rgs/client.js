import { isCanonicalMode } from '../contracts/modes.js';
import {
	InsufficientBalanceError,
	RgsContractError,
} from './contracts.js';

function clientError(code, message, details = null, cause) {
	return new RgsContractError(code, message, { details, cause });
}

function requireString(value, label) {
	if (typeof value !== 'string' || value.trim() === '') {
		throw clientError('RGS_REQUEST_INVALID', `${label} must be a non-empty string.`);
	}
	return value.trim();
}

function requireCurrency(value) {
	const currency = requireString(value, 'currency').toUpperCase();
	if (!/^[A-Z]{2,8}$/.test(currency)) {
		throw clientError('RGS_REQUEST_INVALID', 'currency must contain two to eight ASCII letters.');
	}
	return currency;
}

function normalizeBaseUrl(value) {
	let url;
	try {
		url = new URL(value);
	} catch (cause) {
		throw clientError('RGS_BASE_URL_INVALID', 'RGS base URL is invalid.', null, cause);
	}
	if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
		throw clientError('RGS_BASE_URL_INVALID', 'RGS base URL must be an HTTP(S) URL without credentials.');
	}
	if (url.search || url.hash) {
		throw clientError('RGS_BASE_URL_INVALID', 'RGS base URL cannot contain query or fragment data.');
	}
	return url.toString().replace(/\/+$/, '');
}

function rgsStatusCode(data) {
	return data?.status?.statusCode ?? data?.statusCode ?? data?.error?.code ?? null;
}

function rgsMessage(data, fallback) {
	return data?.error?.message
		?? data?.status?.statusMessage
		?? data?.statusMessage
		?? fallback;
}

export function createLiveRgsClient(options = {}) {
	const baseUrl = normalizeBaseUrl(options.baseUrl);
	const fetchImpl = options.fetchImpl ?? options.fetch ?? globalThis.fetch;
	const timeoutMs = options.timeoutMs ?? 10_000;
	if (typeof fetchImpl !== 'function') {
		throw clientError('RGS_FETCH_MISSING', 'A fetch implementation is required.');
	}
	if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
		throw clientError('RGS_TIMEOUT_INVALID', 'timeoutMs must be a positive safe integer.');
	}

	const endpoint = (path) => `${baseUrl}${path}`;
	const activeControllers = new Set();

	const abortPending = () => {
		const controllers = [...activeControllers];
		activeControllers.clear();
		for (const controller of controllers) controller.abort();
		return controllers.length;
	};

	const post = async (path, body) => {
		const controller = new AbortController();
		let timedOut = false;
		activeControllers.add(controller);
		const timer = setTimeout(() => {
			timedOut = true;
			controller.abort();
		}, timeoutMs);
		const release = () => {
			clearTimeout(timer);
			activeControllers.delete(controller);
		};
		const abortedError = (cause) => timedOut
			? clientError('RGS_TIMEOUT', `RGS ${path} timed out.`, { path, timeoutMs }, cause)
			: clientError('RGS_ABORTED', `RGS ${path} was cancelled.`, { path }, cause);
		let response;
		try {
			response = await fetchImpl(endpoint(path), {
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(body),
				signal: controller.signal,
				credentials: 'omit',
				redirect: 'error',
			});
		} catch (cause) {
			release();
			if (controller.signal.aborted || cause?.name === 'AbortError') {
				throw abortedError(cause);
			}
			throw clientError('RGS_NETWORK_ERROR', `RGS ${path} failed before a response was received.`, { path }, cause);
		}

		let text;
		try {
			text = await response.text();
		} catch (cause) {
			release();
			if (controller.signal.aborted || cause?.name === 'AbortError') {
				throw abortedError(cause);
			}
			throw clientError('RGS_RESPONSE_READ_ERROR', `RGS ${path} response could not be read.`, {
				path,
				status: response.status,
			}, cause);
		}
		release();
		let data;
		try {
			data = text ? JSON.parse(text) : null;
		} catch (cause) {
			throw clientError('RGS_INVALID_JSON', `RGS ${path} returned invalid JSON.`, {
				path,
				status: response.status,
			}, cause);
		}
		if (data === null || typeof data !== 'object' || Array.isArray(data)) {
			throw clientError('RGS_INVALID_JSON', `RGS ${path} returned a non-object JSON payload.`, {
				path,
				status: response.status,
			});
		}

		const statusCode = rgsStatusCode(data);
		if (statusCode === 'ERR_IPB') {
			throw new InsufficientBalanceError({ source: 'rgs' });
		}
		if (!response.ok) {
			throw clientError('RGS_HTTP_ERROR', rgsMessage(data, `RGS ${path} returned HTTP ${response.status}.`), {
				path,
				status: response.status,
				statusCode,
				data,
			});
		}
		if (data.error || (statusCode !== null && statusCode !== 'SUCCESS')) {
			throw clientError('RGS_API_ERROR', rgsMessage(data, `RGS ${path} returned an API error.`), {
				path,
				status: response.status,
				statusCode,
				data,
			});
		}
		return data;
	};

	return Object.freeze({
		baseUrl,
		abortPending,
		authenticate({ sessionID, language }) {
			const body = { sessionID: requireString(sessionID, 'sessionID') };
			if (language !== undefined && language !== null) {
				const normalizedLanguage = requireString(language, 'language');
				if (!/^[a-z]{2}(?:-[a-z]{2})?$/i.test(normalizedLanguage)) {
					throw clientError('RGS_REQUEST_INVALID', 'language must be an ISO-style language code.');
				}
				body.language = normalizedLanguage;
			}
			return post('/wallet/authenticate', body);
		},
		play({ sessionID, currency, amountApi, mode }) {
			if (!Number.isSafeInteger(amountApi) || amountApi <= 0) {
				throw clientError('RGS_REQUEST_INVALID', 'amountApi must be a positive safe integer.');
			}
			if (!isCanonicalMode(mode)) {
				throw clientError('RGS_REQUEST_INVALID', `mode is not canonical: ${String(mode)}.`);
			}
			return post('/wallet/play', {
				sessionID: requireString(sessionID, 'sessionID'),
				currency: requireCurrency(currency),
				amount: amountApi,
				mode,
			});
		},
		saveEvent({ sessionID, event }) {
			const normalizedEvent = requireString(event, 'event');
			if (normalizedEvent.length > 512) {
				throw clientError('RGS_REQUEST_INVALID', 'event must be at most 512 characters.');
			}
			return post('/bet/event', {
				sessionID: requireString(sessionID, 'sessionID'),
				event: normalizedEvent,
			});
		},
		endRound({ sessionID }) {
			return post('/wallet/end-round', {
				sessionID: requireString(sessionID, 'sessionID'),
			});
		},
	});
}
