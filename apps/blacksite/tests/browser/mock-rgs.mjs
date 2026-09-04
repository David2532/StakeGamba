export const BLACKSITE_QA_RGS_ORIGIN = 'https://rgs.blacksite-qa.test';

const ENDPOINTS = Object.freeze([
	{
		name: 'authenticate',
		method: 'POST',
		matches: (path) => path === '/wallet/authenticate',
	},
	{
		name: 'play',
		method: 'POST',
		matches: (path) => path === '/wallet/play',
	},
	{
		name: 'endRound',
		method: 'POST',
		matches: (path) => path === '/wallet/end-round',
	},
	{
		name: 'event',
		method: 'POST',
		matches: (path) => path === '/bet/event',
	},
	{
		name: 'replay',
		method: 'GET',
		matches: (path) => path.startsWith('/bet/replay/'),
	},
]);

function parseBody(request) {
	const rawBody = request.postData();
	if (rawBody === null || rawBody === '') {
		return { body: null, rawBody: null, bodyParseError: null };
	}

	try {
		return { body: JSON.parse(rawBody), rawBody, bodyParseError: null };
	} catch (error) {
		return {
			body: null,
			rawBody,
			bodyParseError: error instanceof Error ? error.message : String(error),
		};
	}
}

function corsHeaders(pageOrigin, extra = {}) {
	return {
		'access-control-allow-origin': pageOrigin,
		'access-control-allow-methods': 'GET, POST, OPTIONS',
		'access-control-allow-headers': 'content-type',
		'cache-control': 'no-store',
		...extra,
	};
}

function responseParts(value) {
	if (value && typeof value === 'object' && Object.hasOwn(value, 'httpStatus')) {
		return {
			status: value.httpStatus,
			body: value.body,
			headers: value.headers ?? {},
		};
	}

	return { status: 200, body: value ?? {}, headers: {} };
}

export function mockHttpResponse(httpStatus, body, headers = {}) {
	return Object.freeze({ httpStatus, body, headers });
}

/**
 * Installs a strict, fully recorded RGS transport boundary on one isolated
 * BrowserContext. The catch-all route is registered last intentionally:
 * Playwright runs it first and route.fallback() hands allowed RGS traffic to
 * the endpoint-specific route registered before it.
 */
export async function installMockRgs(
	context,
	{
		pageOrigin,
		rgsOrigin = BLACKSITE_QA_RGS_ORIGIN,
		handlers = {},
		replayOnly = false,
	} = {},
) {
	if (!pageOrigin) throw new Error('installMockRgs requires pageOrigin');

	const evidence = {
		requests: [],
		preflights: [],
		unexpected: [],
		forbidden: [],
		order: [],
		byEndpoint: {
			authenticate: [],
			play: [],
			endRound: [],
			event: [],
			replay: [],
		},
	};

	let sequence = 0;

	await context.route(`${rgsOrigin}/**`, async (route) => {
		const request = route.request();
		const url = new URL(request.url());

		if (request.method() === 'OPTIONS') {
			evidence.preflights.push({
				method: request.method(),
				path: url.pathname,
				origin: url.origin,
			});
			await route.fulfill({
				status: 204,
				headers: corsHeaders(pageOrigin),
				body: '',
			});
			return;
		}

		const endpoint = ENDPOINTS.find((candidate) => candidate.matches(url.pathname));
		const parsed = parseBody(request);
		const entry = {
			sequence: ++sequence,
			endpoint: endpoint?.name ?? 'unknown',
			method: request.method(),
			url: request.url(),
			origin: url.origin,
			path: url.pathname,
			search: Object.fromEntries(url.searchParams.entries()),
			contentType: request.headers()['content-type'] ?? null,
			...parsed,
		};
		evidence.requests.push(entry);

		if (!endpoint) {
			evidence.unexpected.push({ ...entry, reason: 'UNKNOWN_RGS_ENDPOINT' });
			await route.fulfill({
				status: 404,
				contentType: 'application/json',
				headers: corsHeaders(pageOrigin),
				body: JSON.stringify({ error: { code: 'BLACKSITE_QA_UNKNOWN_ENDPOINT' } }),
			});
			return;
		}

		evidence.byEndpoint[endpoint.name].push(entry);
		evidence.order.push(endpoint.name);

		if (request.method() !== endpoint.method) {
			evidence.unexpected.push({
				...entry,
				reason: `METHOD_MISMATCH_EXPECTED_${endpoint.method}`,
			});
			await route.fulfill({
				status: 405,
				contentType: 'application/json',
				headers: corsHeaders(pageOrigin),
				body: JSON.stringify({ error: { code: 'BLACKSITE_QA_METHOD_MISMATCH' } }),
			});
			return;
		}

		if (parsed.bodyParseError) {
			evidence.unexpected.push({ ...entry, reason: 'INVALID_JSON_BODY' });
		}

		const handler = handlers[endpoint.name];
		if (typeof handler !== 'function') {
			evidence.unexpected.push({ ...entry, reason: 'UNHANDLED_RGS_ENDPOINT' });
			await route.fulfill({
				status: 500,
				contentType: 'application/json',
				headers: corsHeaders(pageOrigin),
				body: JSON.stringify({ error: { code: 'BLACKSITE_QA_UNHANDLED_ENDPOINT' } }),
			});
			return;
		}

		try {
			const result = responseParts(await handler(entry, evidence));
			await route.fulfill({
				status: result.status,
				contentType: 'application/json',
				headers: corsHeaders(pageOrigin, result.headers),
				body:
					typeof result.body === 'string'
						? result.body
						: JSON.stringify(result.body ?? {}),
			});
		} catch (error) {
			evidence.unexpected.push({
				...entry,
				reason: 'MOCK_HANDLER_FAILURE',
				detail: error instanceof Error ? error.message : String(error),
			});
			await route.fulfill({
				status: 500,
				contentType: 'application/json',
				headers: corsHeaders(pageOrigin),
				body: JSON.stringify({ error: { code: 'BLACKSITE_QA_HANDLER_FAILURE' } }),
			});
		}
	});

	await context.route('**/*', async (route) => {
		const request = route.request();
		const url = new URL(request.url());

		if (url.origin === pageOrigin) {
			await route.fallback();
			return;
		}

		if (url.origin === rgsOrigin) {
			const walletOrEvent =
				url.pathname.startsWith('/wallet/') || url.pathname === '/bet/event';
			if (replayOnly && (request.method() !== 'GET' || walletOrEvent)) {
				const parsed = parseBody(request);
				const entry = {
					sequence: ++sequence,
					endpoint: 'forbidden-replay-write',
					method: request.method(),
					url: request.url(),
					origin: url.origin,
					path: url.pathname,
					search: Object.fromEntries(url.searchParams.entries()),
					contentType: request.headers()['content-type'] ?? null,
					...parsed,
				};
				evidence.forbidden.push(entry);
				await route.abort('blockedbyclient');
				return;
			}

			await route.fallback();
			return;
		}

		const entry = {
			method: request.method(),
			url: request.url(),
			origin: url.origin,
			path: url.pathname,
			reason: 'UNEXPECTED_EXTERNAL_ORIGIN',
		};
		evidence.unexpected.push(entry);
		await route.abort('blockedbyclient');
	});

	return evidence;
}
