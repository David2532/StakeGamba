import { GAME_ID, isCanonicalMode } from '../contracts/modes.js';

function launchError(code, message, surface) {
	return Object.freeze({ kind: 'error', code, message, surface });
}

function parseRgsUrl(rawValue) {
	if (typeof rawValue !== 'string' || rawValue.trim() === '') {
		return { ok: false, code: 'RGS_URL_MISSING' };
	}
	try {
		const url = new URL(rawValue);
		if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
			return { ok: false, code: 'RGS_URL_INVALID' };
		}
		return { ok: true, url: url.toString().replace(/\/$/, '') };
	} catch {
		return { ok: false, code: 'RGS_URL_INVALID' };
	}
}

function requiredQuery(params, name) {
	const value = params.get(name);
	return value && value.trim() ? value.trim() : null;
}

export function resolveLaunchMode(search, { dev = false } = {}) {
	const params = search instanceof URLSearchParams ? search : new URLSearchParams(search);

	if (params.get('replay') === 'true') {
		const game = requiredQuery(params, 'game');
		const version = requiredQuery(params, 'version');
		const mode = requiredQuery(params, 'mode');
		const event = requiredQuery(params, 'event');
		const rgs = parseRgsUrl(params.get('rgs_url'));

		if (!game || !version || !mode || !event || !rgs.ok) {
			return launchError(
				'REPLAY_QUERY_INVALID',
				'Replay requires game, version, canonical mode, event and a valid rgs_url.',
				'replay',
			);
		}
		if (game !== GAME_ID || !isCanonicalMode(mode)) {
			return launchError(
				'REPLAY_IDENTITY_INVALID',
				'The requested Replay identity is not a BLACKSITE candidate event.',
				'replay',
			);
		}

		return Object.freeze({
			kind: 'replay',
			game,
			version,
			mode,
			event,
			rgsUrl: rgs.url,
			currency: params.get('currency'),
			amount: params.get('amount'),
			lang: params.get('lang'),
			device: params.get('device'),
			social: params.get('social') === 'true',
		});
	}

	const fixtureId = requiredQuery(params, 'dev_fixture');
	if (fixtureId) {
		if (!dev) {
			return launchError(
				'DEV_FIXTURE_FORBIDDEN',
				'Development fixtures are disabled in production builds.',
				'fixture',
			);
		}
		return Object.freeze({ kind: 'fixture', fixtureId });
	}

	const rgs = parseRgsUrl(params.get('rgs_url'));
	if (!rgs.ok) {
		return launchError(
			rgs.code,
			rgs.code === 'RGS_URL_MISSING'
				? 'Paid live launch requires rgs_url. No local game was started.'
				: 'Paid live launch rejected the invalid rgs_url. No local game was started.',
			'live',
		);
	}

	return Object.freeze({
		kind: 'live',
		rgsUrl: rgs.url,
		status: 'RGS_WIRING_PENDING',
	});
}
