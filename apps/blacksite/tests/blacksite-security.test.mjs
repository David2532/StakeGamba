import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createReplayClient } from '../src/lib/replay/client.js';
import { createLiveRgsClient } from '../src/lib/rgs/client.js';
import { normalizeTrustedRgsBaseUrl } from '../src/lib/rgs/url-policy.js';
import { resolveLaunchMode } from '../src/lib/runtime/launch-mode.js';

const blacksitePackage = JSON.parse(
	readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);
const configSveltePackage = JSON.parse(
	readFileSync(new URL('../../../packages/config-svelte/package.json', import.meta.url), 'utf8'),
);
const playerSource = readFileSync(new URL('../src/routes/+page.svelte', import.meta.url), 'utf8');

function liveQuery(rgsUrl, extra = '') {
	return `?sessionID=security-test&currency=XSC&lang=en&device=desktop&rgs_url=${encodeURIComponent(rgsUrl)}${extra}`;
}

function replayQuery(rgsUrl) {
	return `?replay=true&game=blacksite_breach&version=0.1.0-m2&mode=base&event=0&rgs_url=${encodeURIComponent(rgsUrl)}`;
}

function replayLaunch(rgsUrl) {
	return {
		game: 'blacksite_breach',
		version: '0.1.0-m2',
		mode: 'base',
		event: '0',
		rgsUrl,
	};
}

function response(data = {}) {
	return {
		ok: true,
		status: 200,
		text: async () => JSON.stringify(data),
	};
}

test('BLACKSITE pins its security floor and binds local Vite servers to loopback', () => {
	assert.equal(blacksitePackage.dependencies.vite, '6.4.3');
	assert.equal(configSveltePackage.dependencies.vite, '6.4.3');
	assert.equal(configSveltePackage.dependencies['@sveltejs/adapter-static'], '3.0.10');
	assert.equal(blacksitePackage.scripts.dev, 'vite dev --host 127.0.0.1 --port 3002');
	assert.equal(blacksitePackage.scripts.preview, 'vite preview --host 127.0.0.1 --port 4302');
});

test('player wires development loopback policy only from the compile-time development gate', () => {
	assert.match(
		playerSource,
		/resolveLaunchMode\(window\.location\.search, \{ dev: __BLACKSITE_DEV_FIXTURES__ \}\)/u,
	);
	assert.equal(
		playerSource.match(/allowHttpLoopbackForDevelopment: __BLACKSITE_DEV_FIXTURES__/gu)?.length,
		2,
	);
});

test('RGS URL policy rejects every HTTP destination by default', () => {
	for (const url of [
		'http://127.0.0.1:3000/rgs',
		'http://[::1]:3000/rgs',
		'http://localhost:3000/rgs',
		'http://127.0.0.2:3000/rgs',
		'http://0.0.0.0:3000/rgs',
		'http://10.0.0.1/rgs',
		'http://rgs.example/rgs',
	]) {
		assert.equal(normalizeTrustedRgsBaseUrl(url), null, url);
		assert.equal(resolveLaunchMode(liveQuery(url)).code, 'RGS_URL_INVALID', url);
	}

	assert.equal(normalizeTrustedRgsBaseUrl('https://rgs.example/root/'), 'https://rgs.example/root');
	assert.equal(resolveLaunchMode(liveQuery('https://rgs.example/root/')).kind, 'live');
	assert.equal(resolveLaunchMode(replayQuery('https://rgs.example/root/')).kind, 'replay');
});

test('empty query and fragment delimiters cannot corrupt live or Replay endpoint paths', async () => {
	let fetchCalls = 0;
	const fetchImpl = async () => {
		fetchCalls += 1;
		return response();
	};

	for (const url of [
		'https://rgs.example/root?',
		'https://rgs.example/root#',
		'https://rgs.example/root?#',
	]) {
		assert.equal(normalizeTrustedRgsBaseUrl(url), null, url);
		assert.equal(resolveLaunchMode(liveQuery(url)).code, 'RGS_URL_INVALID', url);
		assert.equal(resolveLaunchMode(replayQuery(url)).code, 'REPLAY_QUERY_INVALID', url);
		assert.throws(
			() => createLiveRgsClient({ baseUrl: url, fetchImpl }),
			(error) => error.code === 'RGS_BASE_URL_INVALID',
		);
		const replay = createReplayClient({ fetchImpl });
		await assert.rejects(
			replay.fetchRound(replayLaunch(url)),
			(error) => error.code === 'REPLAY_REQUEST_INVALID',
		);
	}

	assert.equal(fetchCalls, 0);
});

test('ambiguous launch authority parameters fail closed before live or Replay bootstrap', () => {
	const liveAuthority =
		'sessionID=security-test&currency=XSC&lang=en&device=desktop' +
		'&rgs_url=https%3A%2F%2Frgs.example';
	const replayAuthority =
		'game=blacksite_breach&version=0.1.0-m2&mode=base&event=0' +
		'&rgs_url=https%3A%2F%2Frgs.example';

	for (const query of [
		`?replay=false&replay=true&${liveAuthority}&${replayAuthority}`,
		`?replay=true&replay=false&${liveAuthority}&${replayAuthority}`,
	]) {
		const launch = resolveLaunchMode(query);
		assert.equal(launch.kind, 'error');
		assert.equal(launch.code, 'REPLAY_QUERY_INVALID');
		assert.equal(launch.surface, 'replay');
	}

	for (const query of [
		`?${liveAuthority}&rgs_url=https%3A%2F%2Fother.example`,
		`?${liveAuthority}&session_id=other-session`,
		`?${liveAuthority}&language=de`,
	]) {
		const launch = resolveLaunchMode(query);
		assert.equal(launch.kind, 'error');
		assert.equal(launch.code, 'LIVE_QUERY_INVALID');
		assert.equal(launch.surface, 'live');
	}

	for (const query of [
		`?replay=true&${replayAuthority}&rgs_url=https%3A%2F%2Fother.example`,
		`?replay=true&${replayAuthority}&amount=1&bet=2`,
		`?replay=true&${replayAuthority}&lang=en&language=de`,
	]) {
		const launch = resolveLaunchMode(query);
		assert.equal(launch.kind, 'error');
		assert.equal(launch.code, 'REPLAY_QUERY_INVALID');
		assert.equal(launch.surface, 'replay');
	}
});

test('exact-QA HTTP opt-in is code-owned and limited to numeric loopback', () => {
	const exactQaPolicy = { allowHttpLoopbackForExactQa: true };
	for (const url of ['http://127.0.0.1:3000/rgs/', 'http://[::1]:3000/rgs/']) {
		assert.equal(normalizeTrustedRgsBaseUrl(url, exactQaPolicy), url.replace(/\/$/, ''), url);
		assert.equal(resolveLaunchMode(liveQuery(url), exactQaPolicy).kind, 'live', url);
		assert.equal(resolveLaunchMode(replayQuery(url), exactQaPolicy).kind, 'replay', url);
	}

	for (const url of [
		'http://localhost:3000/rgs',
		'http://127.0.0.2:3000/rgs',
		'http://0.0.0.0:3000/rgs',
		'http://10.0.0.1/rgs',
		'http://rgs.example/rgs',
	]) {
		assert.equal(normalizeTrustedRgsBaseUrl(url, exactQaPolicy), null, url);
	}

	const queryCannotOptIn = `${liveQuery('http://127.0.0.1:3000/rgs')}&allowHttpLoopbackForExactQa=true`;
	assert.equal(resolveLaunchMode(queryCannotOptIn).code, 'RGS_URL_INVALID');
});

test('development HTTP opt-in is code-owned and limited to numeric loopback', () => {
	for (const url of ['http://127.0.0.1:3000/rgs/', 'http://[::1]:3000/rgs/']) {
		assert.equal(resolveLaunchMode(liveQuery(url), { dev: true }).kind, 'live', url);
		assert.equal(resolveLaunchMode(replayQuery(url), { dev: true }).kind, 'replay', url);
	}

	for (const url of [
		'http://localhost:3000/rgs',
		'http://127.0.0.2:3000/rgs',
		'http://0.0.0.0:3000/rgs',
		'http://10.0.0.1/rgs',
		'http://rgs.example/rgs',
	]) {
		assert.equal(resolveLaunchMode(liveQuery(url), { dev: true }).code, 'RGS_URL_INVALID', url);
	}
});

test('live and Replay transports enforce the same RGS trust boundary', async () => {
	assert.throws(
		() => createLiveRgsClient({ baseUrl: 'http://127.0.0.1:3000/rgs' }),
		(error) => error.code === 'RGS_BASE_URL_INVALID',
	);

	const exactQaLive = createLiveRgsClient({
		baseUrl: 'http://127.0.0.1:3000/rgs/',
		allowHttpLoopbackForExactQa: true,
		fetchImpl: async () => response(),
	});
	assert.equal(exactQaLive.baseUrl, 'http://127.0.0.1:3000/rgs');
	assert.equal(
		createLiveRgsClient({
			baseUrl: 'http://127.0.0.1:3000/rgs/',
			allowHttpLoopbackForDevelopment: true,
			fetchImpl: async () => response(),
		}).baseUrl,
		'http://127.0.0.1:3000/rgs',
	);

	let replayUrl = null;
	const defaultReplay = createReplayClient({
		fetchImpl: async (url) => {
			replayUrl = url;
			return response();
		},
	});
	await assert.rejects(
		defaultReplay.fetchRound(replayLaunch('http://127.0.0.1:3000/rgs')),
		(error) => error.code === 'REPLAY_REQUEST_INVALID',
	);
	assert.equal(replayUrl, null);

	const exactQaReplay = createReplayClient({
		allowHttpLoopbackForExactQa: true,
		fetchImpl: async (url) => {
			replayUrl = url;
			return response();
		},
	});
	await exactQaReplay.fetchRound(replayLaunch('http://127.0.0.1:3000/rgs'));
	assert.equal(replayUrl, 'http://127.0.0.1:3000/rgs/bet/replay/blacksite_breach/0.1.0-m2/base/0');
});
