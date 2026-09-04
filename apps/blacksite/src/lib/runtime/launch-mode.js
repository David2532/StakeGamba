import { GAME_ID, isCanonicalMode } from '../contracts/modes.js';
import { isSafeReplayPathSegment } from '../replay/path-segment.js';
import { normalizeTrustedRgsBaseUrl } from '../rgs/url-policy.js';

const REPLAY_AUTHORITY_QUERY_GROUPS = Object.freeze([
	Object.freeze(['game']),
	Object.freeze(['version']),
	Object.freeze(['mode']),
	Object.freeze(['event']),
	Object.freeze(['rgs_url']),
	Object.freeze(['currency']),
	Object.freeze(['amount', 'bet', 'stake']),
	Object.freeze(['lang', 'language']),
	Object.freeze(['device', 'deviceType']),
	Object.freeze(['social', 'socialCasino', 'social_casino', 'stakeUS']),
]);
const LIVE_AUTHORITY_QUERY_GROUPS = Object.freeze([
	Object.freeze(['rgs_url']),
	Object.freeze(['sessionID', 'sessionId', 'session_id', 'sid']),
	Object.freeze(['currency']),
	Object.freeze(['lang', 'language']),
	Object.freeze(['device', 'deviceType']),
	Object.freeze(['social', 'socialCasino', 'social_casino', 'stakeUS']),
]);

function launchError(code, message, surface, social = false) {
	return Object.freeze({ kind: 'error', code, message, surface, social });
}

function parseRgsUrl(rawValue, options) {
	if (typeof rawValue !== 'string' || rawValue.trim() === '') {
		return { ok: false, code: 'RGS_URL_MISSING' };
	}
	const url = normalizeTrustedRgsBaseUrl(rawValue, options);
	return url ? { ok: true, url } : { ok: false, code: 'RGS_URL_INVALID' };
}

function requiredQuery(params, name) {
	const value = params.get(name);
	return value && value.trim() ? value.trim() : null;
}

function firstQuery(params, names) {
	for (const name of names) {
		const value = requiredQuery(params, name);
		if (value !== null) return value;
	}
	return null;
}

function repeatedAuthorityGroup(params, groups) {
	return (
		groups.find(
			(names) => names.reduce((count, name) => count + params.getAll(name).length, 0) > 1,
		) ?? null
	);
}

function isBoundedText(value, maxLength = 240) {
	return (
		typeof value === 'string' &&
		value.length > 0 &&
		value.length <= maxLength &&
		![...value].some((character) => {
			const code = character.charCodeAt(0);
			return code < 32 || code === 127;
		})
	);
}

function parseLanguage(value, { required = false } = {}) {
	if (value === null) return required ? null : undefined;
	// BLACKSITE M2 intentionally ships English only. Unknown or malformed
	// language values must not corrupt launch; they resolve to the supported
	// English resource instead of being reflected into UI or requests.
	return 'en';
}

function parseDevice(value, { required = false } = {}) {
	if (value === null) return required ? null : undefined;
	return /^(desktop|mobile|tablet)$/i.test(value) ? value.toLowerCase() : null;
}

function parseCurrency(value, { required = false } = {}) {
	if (value === null) return required ? null : undefined;
	return /^[a-z]{2,8}$/i.test(value) ? value.toUpperCase() : null;
}

function parseReplayAmount(value) {
	if (value === null) return undefined;
	if (value.length > 64 || !/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value)) return null;
	return Number(value) > 0 ? value : null;
}

function parseSocial(params) {
	return ['social', 'socialCasino', 'social_casino', 'stakeUS'].some((name) =>
		/^(?:1|true|yes)$/i.test(params.get(name) ?? ''),
	);
}

export function resolveLaunchMode(
	search,
	{ dev = false, allowHttpLoopbackForExactQa = false } = {},
) {
	const params = search instanceof URLSearchParams ? search : new URLSearchParams(search);
	const social = parseSocial(params);
	const replayValues = params.getAll('replay');
	if (replayValues.length > 1) {
		const replaySurface = replayValues.includes('true');
		return launchError(
			replaySurface ? 'REPLAY_QUERY_INVALID' : 'LIVE_QUERY_INVALID',
			'Launch parameters contain an ambiguous repeated replay marker.',
			replaySurface ? 'replay' : 'live',
			social,
		);
	}
	const rgsUrlPolicy = {
		allowHttpLoopbackForDevelopment: dev,
		allowHttpLoopbackForExactQa,
	};

	if (replayValues[0] === 'true') {
		if (repeatedAuthorityGroup(params, REPLAY_AUTHORITY_QUERY_GROUPS)) {
			return launchError(
				'REPLAY_QUERY_INVALID',
				'Replay parameters contain repeated or conflicting authority values.',
				'replay',
				social,
			);
		}
		const game = requiredQuery(params, 'game');
		const version = requiredQuery(params, 'version');
		const mode = requiredQuery(params, 'mode');
		const event = requiredQuery(params, 'event');
		const rgs = parseRgsUrl(params.get('rgs_url'), rgsUrlPolicy);
		const currency = parseCurrency(requiredQuery(params, 'currency'));
		const amountUnitsRaw = parseReplayAmount(firstQuery(params, ['amount', 'bet', 'stake']));
		const language = parseLanguage(firstQuery(params, ['lang', 'language']));
		const device = parseDevice(firstQuery(params, ['device', 'deviceType']));

		if (
			!isBoundedText(game) ||
			!isBoundedText(version) ||
			!isBoundedText(mode) ||
			!isBoundedText(event) ||
			!isSafeReplayPathSegment(version) ||
			!isSafeReplayPathSegment(event) ||
			!rgs.ok ||
			currency === null ||
			amountUnitsRaw === null ||
			language === null ||
			device === null
		) {
			return launchError(
				'REPLAY_QUERY_INVALID',
				'Replay requires game, version, canonical mode, event and a valid rgs_url.',
				'replay',
				social,
			);
		}
		if (game !== GAME_ID || !isCanonicalMode(mode)) {
			return launchError(
				'REPLAY_IDENTITY_INVALID',
				'The requested Replay identity is not a BLACKSITE candidate event.',
				'replay',
				social,
			);
		}

		return Object.freeze({
			kind: 'replay',
			game,
			version,
			mode,
			event,
			rgsUrl: rgs.url,
			currency,
			amountUnitsRaw,
			language,
			device,
			social,
		});
	}

	const fixtureId = requiredQuery(params, 'dev_fixture');
	if (fixtureId) {
		if (params.getAll('dev_fixture').length > 1) {
			return launchError(
				'DEV_FIXTURE_QUERY_INVALID',
				'Development fixture parameters are ambiguous.',
				'fixture',
				social,
			);
		}
		if (!dev) {
			return launchError(
				'DEV_FIXTURE_FORBIDDEN',
				'Development fixtures are disabled in production builds.',
				'fixture',
				social,
			);
		}
		return Object.freeze({ kind: 'fixture', fixtureId });
	}

	if (repeatedAuthorityGroup(params, LIVE_AUTHORITY_QUERY_GROUPS)) {
		return launchError(
			'LIVE_QUERY_INVALID',
			'Live launch parameters contain repeated or conflicting authority values.',
			'live',
			social,
		);
	}

	const rgs = parseRgsUrl(params.get('rgs_url'), rgsUrlPolicy);
	if (!rgs.ok) {
		return launchError(
			rgs.code,
			rgs.code === 'RGS_URL_MISSING'
				? 'Live launch requires rgs_url. No local game was started.'
				: 'Live launch rejected the invalid rgs_url. No local game was started.',
			'live',
			social,
		);
	}
	const sessionId = firstQuery(params, ['sessionID', 'sessionId', 'session_id', 'sid']);
	const language = parseLanguage(firstQuery(params, ['lang', 'language']), { required: true });
	const currency = parseCurrency(requiredQuery(params, 'currency'));
	const device = parseDevice(firstQuery(params, ['device', 'deviceType']), { required: true });
	if (!isBoundedText(sessionId) || !language || currency === null || !device) {
		return launchError(
			'LIVE_QUERY_INVALID',
			'Live launch requires valid sessionID, lang and device parameters.',
			'live',
			social,
		);
	}

	return Object.freeze({
		kind: 'live',
		rgsUrl: rgs.url,
		sessionId,
		language,
		currency,
		device,
		social,
	});
}
