#!/usr/bin/env node
/**
 * Stake QA — browser end-to-end gates.
 *
 * Drives the real generated Stake preview (apps/cluster/preview.html) in
 * headless Chromium via Playwright and verifies the Stake Engine feedback
 * points with actual gameplay behaviour (not just static markers):
 *
 *   currency            HUD balance/bet/win formatting per currency (EUR, USD,
 *                       XSC, XGC, JPY, DKK, CLP) straight from the DOM.
 *   insufficient-funds  bet > balance blocks spin / auto-bet / bonus buy with
 *                       "Insufficient Funds" (fiat) or "Insufficient Balance"
 *                       (Stake.us / XSC / XGC) and fires NO /wallet/play call.
 *   major-actions       Auto-Bet never starts on a single click (amount
 *                       selection 10/25/50/100/200/∞ + Confirm), Bonus Buy
 *                       requires Confirm, confirmMajorAction() guard works.
 *   interrupted-round   refresh mid-bonus (mocked RGS active bonus round)
 *                       shows the resume message, blocks all actions while
 *                       open, resumes without a second bet, settles once.
 *   mobile              the game fills the screen on phone/tablet/landscape
 *                       viewports, no scrollbars, HUD/board/spin visible;
 *                       screenshots stored as QA artifacts.
 *   rules               every visible control has an entry with a loaded icon
 *                       and a real description in Rules → Buttons & Controls.
 *
 * Exit codes: 0 = all checks passed, 1 = at least one check failed,
 * 3 = Playwright/Chromium unavailable in this workspace (caller may skip).
 *
 * Usage: node scripts/stake-qa-e2e.mjs [all|currency|insufficient-funds|
 *        major-actions|interrupted-round|mobile|rules|bet-config|social|replay|rgs-round-states]
 */
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, normalize, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const clusterRoot = join(root, 'apps', 'cluster');
const frontendRoot = process.env.STAKE_QA_FRONTEND_ROOT
	? resolve(root, process.env.STAKE_QA_FRONTEND_ROOT)
	: clusterRoot;
const frontendEntry = process.env.STAKE_QA_FRONTEND_ENTRY
	|| (frontendRoot === clusterRoot ? 'preview.html' : 'index.html');
const previewFile = join(frontendRoot, frontendEntry);
const publishedMathFile = process.env.STAKE_QA_MATH_CONFIG
	? resolve(root, process.env.STAKE_QA_MATH_CONFIG)
	: join(root, 'publish', 'math', 'game_config.json');
const mode = (process.argv[2] || 'all').toLowerCase();
const artifactRoot = process.env.STAKE_QA_ARTIFACT_DIR
	|| join(root, 'artifacts', 'stake-qa', new Date().toISOString().replace(/[:.]/g, '-'));
const shotDir = join(artifactRoot, 'e2e-screenshots');
const productionMathConfig = JSON.parse(readFileSync(publishedMathFile, 'utf8'));

const checks = [];
const replayNetworkEvidence = [];
const replayValidationEvidence = [];
const responsiveLayoutEvidence = [];
const accessibilityEvidence = [];
const record = (group, name, status, detail = '') => checks.push({ group, name, status, detail });
const pass = (group, name, detail = '') => record(group, name, 'PASS', detail);
const fail = (group, name, detail = '') => record(group, name, 'FAIL', detail);
const expect = (group, name, condition, detail = '') => (condition ? pass(group, name, detail) : fail(group, name, detail));
const wants = (name) => mode === 'all' || mode === name;
const SOCIAL_FORBIDDEN_RENDERED = [
	'Bet Replay',
	'Base Bet',
	'Cost Multiplier',
	'Total Bet Cost',
	'Payout Multiplier',
	'Total Win',
	'Bonus Buy',
	'Buy Bonus',
	'Auto-Bet',
	'Auto Bet',
	'Bet',
	'Wager',
	'Gamble',
	'Purchase',
	'Paid',
	'Pay out',
	'Payout',
	'Rebet',
	'Cash',
	'Credit',
	'Currency',
];
const QA_RUNTIME_MARKER = '/*__STAKE_QA_RUNTIME_HOOK__*/';
const QA_RUNTIME_INSTRUMENTATION = `
Object.defineProperty(window, '__stakeQa', {
	configurable: false,
	enumerable: false,
	writable: false,
	value: Object.freeze({
		state,
		Replay,
		getBetConfig: () => cloneReplayData(activeBetConfig),
		setTurbo: (enabled) => setTurbo(!!enabled),
		confirmMajorAction,
		auditLocalClusters: (grid) => {
			const previousGrid = state.grid;
			try {
				state.grid = cloneReplayData(grid);
				return cloneReplayData(findClusters());
			} finally {
				state.grid = previousGrid;
			}
		},
		invokeInternalAction: async (name) => {
			if (name === 'spin') return spin(null, true);
			if (name === 'free-spins') return startFreeSpins(1, false);
			if (name === 'bonus-buy') return buildBonusBuy();
			if (name === 'auto-play') return startAutoSpin(10);
			if (name === 'change-bet') return changeBet(1);
			if (name === 'new-grid') return newGrid();
			if (name === 'resolve-cascades') return resolveCascades();
			if (name === 'open-paid-modal') return openModal('modal-autospin');
			throw new Error('Unknown QA action: ' + name);
		},
	}),
});
`;
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const socialForbiddenHits = (text) => SOCIAL_FORBIDDEN_RENDERED
	.filter((phrase) => new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'i').test(text));

// ---------------------------------------------------------------------------
// Playwright / Chromium resolution. The repo does not vendor Playwright, so we
// accept a local install, an explicit override, or a global installation.
// ---------------------------------------------------------------------------
function resolvePlaywright() {
	const candidates = [];
	if (process.env.STAKE_QA_PLAYWRIGHT_DIR) candidates.push(process.env.STAKE_QA_PLAYWRIGHT_DIR);
	candidates.push(root, __dirname);
	candidates.push('/opt/node22/lib/node_modules');
	const npmRoot = spawnSync('npm', ['root', '-g'], { encoding: 'utf8' });
	if (npmRoot.status === 0 && npmRoot.stdout.trim()) candidates.push(npmRoot.stdout.trim());
	for (const base of candidates) {
		try {
			const req = createRequire(join(base, 'noop.js'));
			return req('playwright');
		} catch {
			/* try next candidate */
		}
	}
	return null;
}

async function launchChromium(playwright) {
	const attempts = [undefined];
	for (const candidate of [
		process.env.STAKE_QA_CHROMIUM,
		'/opt/pw-browsers/chromium',
		'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
	]) {
		if (candidate && existsSync(candidate)) attempts.push(candidate);
	}
	let lastError = null;
	for (const executablePath of attempts) {
		try {
			return await playwright.chromium.launch(executablePath ? { executablePath } : {});
		} catch (error) {
			lastError = error;
		}
	}
	throw lastError || new Error('No Chromium executable found');
}

// ---------------------------------------------------------------------------
// Tiny static file server for the selected generated frontend. Release runs
// point this at publish/frontend so the exact upload artifact is exercised.
// ---------------------------------------------------------------------------
const MIME = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json',
	'.webp': 'image/webp',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.svg': 'image/svg+xml',
	'.mp3': 'audio/mpeg',
	'.woff2': 'font/woff2',
};
function startStaticServer() {
	const server = createServer((req, res) => {
		try {
			const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
			const filePath = normalize(join(frontendRoot, pathname));
			if (!filePath.startsWith(frontendRoot) || !existsSync(filePath) || !statSync(filePath).isFile()) {
				res.writeHead(404);
				res.end('not found');
				return;
			}
			let body = readFileSync(filePath);
			if (filePath === previewFile) {
				const source = body.toString('utf8');
				if (!source.includes(QA_RUNTIME_MARKER)) throw new Error('Generated frontend is missing the QA instrumentation marker');
				body = Buffer.from(source.replace(QA_RUNTIME_MARKER, QA_RUNTIME_INSTRUMENTATION));
			}
			res.writeHead(200, { 'content-type': MIME[extname(filePath)] || 'application/octet-stream' });
			res.end(body);
		} catch {
			res.writeHead(500);
			res.end('error');
		}
	});
	return new Promise((resolve) => {
		server.listen(0, '127.0.0.1', () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` }));
	});
}

// ---------------------------------------------------------------------------
// Mock Stake RGS. The preview talks to rgs_url from the launch URL; routing
// https://rgs.stake-qa.test/** through Playwright lets the tests answer the
// real /wallet/authenticate | /wallet/play | /wallet/end-round | /bet/event
// requests and count every call the game makes.
// ---------------------------------------------------------------------------
const RGS_HOST = 'rgs.stake-qa.test';
const rgsQuery = (currency, extra = '') =>
	`?sessionID=stake-qa-session&rgs_url=https://${RGS_HOST}&currency=${currency}&lang=en&device=desktop${extra}`;

async function mockRgs(context, handlers) {
	const calls = { authenticate: [], play: [], endRound: [], event: [], replay: [], other: [] };
	await context.route(`**://${RGS_HOST}/**`, async (route) => {
		const request = route.request();
		const path = new URL(request.url()).pathname;
		let body = {};
		try {
			body = JSON.parse(request.postData() || '{}');
		} catch {
			body = {};
		}
		const reply = (data) => route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ status: { statusCode: 'SUCCESS' }, ...data }),
		});
		if (path === '/wallet/authenticate') {
			calls.authenticate.push(body);
			return reply(handlers.authenticate(body));
		}
		if (path === '/wallet/play') {
			calls.play.push(body);
			return reply(handlers.play ? handlers.play(body) : {});
		}
		if (path === '/wallet/end-round') {
			calls.endRound.push(body);
			return reply(handlers.endRound ? handlers.endRound(body) : {});
		}
		if (path === '/bet/event') {
			calls.event.push(body);
			return reply(handlers.event ? handlers.event(body) : {});
		}
		if (path.startsWith('/bet/replay/')) {
			calls.replay.push({
				url: request.url(),
				path,
				search: Object.fromEntries(new URL(request.url()).searchParams.entries()),
			});
			return reply(handlers.replay ? handlers.replay(request.url()) : { round: replayRound() });
		}
		calls.other.push(path);
		return reply({});
	});
	return calls;
}

// Replay has a stricter transport contract than normal wallet play: the only
// request allowed to the supplied RGS origin is one GET to /bet/replay/**.
// Anything else is aborted and recorded as a test failure at interception
// time, so a later UI assertion cannot accidentally conceal a paid call.
async function mockReplayRgs(context, responder) {
	const calls = { replay: [], forbidden: [], observedRequestCount: 0 };
	await context.route(`**://${RGS_HOST}/**`, async (route) => {
		const request = route.request();
		const url = new URL(request.url());
		const entry = {
			method: request.method(),
			url: request.url(),
			origin: url.origin,
			path: url.pathname,
			search: Object.fromEntries(url.searchParams.entries()),
			postData: request.postData() || null,
		};
		if (entry.method !== 'GET' || !entry.path.startsWith('/bet/replay/')) {
			calls.forbidden.push(entry);
			fail('replay-network', `forbidden replay request blocked: ${entry.method} ${entry.path}`, entry.url);
			await route.abort('blockedbyclient');
			return;
		}
		calls.replay.push(entry);
		let result;
		try {
			result = responder ? await responder(entry) : { round: replayRound() };
		} catch (error) {
			await route.fulfill({
				status: 500,
				contentType: 'application/json',
				body: JSON.stringify({ error: { message: error?.message || 'mock replay failure' } }),
			});
			return;
		}
		if (result?.response) {
			const response = result.response;
			await route.fulfill({
				status: response.status ?? 200,
				contentType: response.contentType ?? 'application/json',
				body: typeof response.body === 'string' ? response.body : JSON.stringify(response.body ?? {}),
			});
			return;
		}
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ status: { statusCode: 'SUCCESS' }, ...(result || {}) }),
		});
		});
	// Register the catch-all last so it runs first. Allowed GETs fall through to
	// the RGS mock/static server; any non-GET anywhere in Replay Mode, or any
	// wallet/event endpoint regardless of method/origin, is blocked immediately.
	await context.route('**/*', async (route) => {
		const request = route.request();
		const url = new URL(request.url());
		calls.observedRequestCount += 1;
		const forbiddenEndpoint = url.pathname.startsWith('/wallet/') || url.pathname === '/bet/event';
		if (request.method() !== 'GET' || forbiddenEndpoint) {
			const entry = {
				method: request.method(),
				url: request.url(),
				origin: url.origin,
				path: url.pathname,
				postData: request.postData() || null,
			};
			calls.forbidden.push(entry);
			fail('replay-network', `forbidden replay request blocked: ${entry.method} ${entry.path}`, entry.url);
			await route.abort('blockedbyclient');
			return;
		}
		await route.fallback();
	});
	return calls;
}

const API = 1_000_000; // API_AMOUNT_MULTIPLIER of the preview
const balanceOf = (amount, currency) => ({ amount: Math.round(amount * API), currency });

// A 6x5 board of plain low symbols (no scatters/rainbows → no side effects).
const quietBoard = () => {
	const reelSymbols = ['L5', 'L4', 'L3', 'L2', 'L1'];
	return Array.from({ length: 6 }, (_, col) =>
		Array.from({ length: 5 }, (_, row) => reelSymbols[(col + row) % reelSymbols.length]));
};

// Resumable Stake bonus round: 2 free spins, book win 2.5x bet, still active.
const interruptedBonusRound = () => ({
	active: true,
	mode: 'bonus',
	amount: 1 * API,
	betID: 'stake-qa-round-77',
	event: 0,
	payout: 0,
	payoutMultiplier: 0,
	state: [
		{ index: 0, type: 'reveal', board: quietBoard(), gameType: 'freegame' },
		{ index: 1, type: 'updateFreeSpin', amount: 0, total: 2, tier: 1 },
		{ index: 2, type: 'reveal', board: quietBoard(), gameType: 'freegame' },
		{ index: 3, type: 'finalWin', amount: 250 },
	],
});

const replayRound = ({ mode = 'base', amount = 1 * API, payout = 0.1 * API } = {}) => ({
	active: false,
	mode,
	amount,
	betID: 'stake-qa-replay-99',
	payout,
	payoutMultiplier: 10,
	state: [
		{ index: 0, type: 'reveal', board: quietBoard(), gameType: mode.includes('bonus') ? 'freegame' : 'basegame' },
		{ index: 1, type: 'finalWin', amount: 10 },
	],
});

const columnPositions = (col = 0) => Array.from({ length: 5 }, (_, row) => ({ col, row }));
const boardWithColumn = (symbol, col = 0) => {
	const board = quietBoard();
	board[col] = Array(5).fill(symbol);
	return board;
};

// Two authoritative cascade wins deliberately differ from the client
// Paytable values. This proves popup/final replay amounts come from RGS events
// and round.payout, not from a local re-calculation of the saved board.
const baseReplayRound = () => ({
	active: false,
	game: 'golden-goal-rush',
	version: '1',
	mode: 'base',
	amount: 1 * API,
	currency: 'USD',
	betID: 'stake-qa-replay-base',
	payout: 1.25 * API,
	payoutMultiplier: 125,
	state: [
		{ index: 0, type: 'reveal', board: boardWithColumn('L2'), gameType: 'basegame' },
		{ index: 1, type: 'winInfo', totalWin: 51, wins: [{ symbol: 'L2', count: 5, win: 51, positions: columnPositions(0) }] },
		{
			index: 2,
			type: 'tumbleBoard',
			board: boardWithColumn('L3'),
			explodingSymbols: columnPositions(0),
			newSymbols: [Array(5).fill('L3'), [], [], [], [], []],
		},
		{ index: 3, type: 'winInfo', totalWin: 74, wins: [{ symbol: 'L3', count: 5, win: 74, positions: columnPositions(0) }] },
		{ index: 4, type: 'finalWin', amount: 125 },
	],
});

const bonusReplayRound = () => {
	const triggerBoard = quietBoard();
	const triggerPositions = [{ col: 0, row: 0 }, { col: 1, row: 0 }, { col: 2, row: 0 }];
	for (const { col, row } of triggerPositions) triggerBoard[col][row] = 'S';
	return {
		active: false,
		game: 'golden-goal-rush',
		version: '1',
		mode: 'bonus',
		amount: 1 * API,
		currency: 'USD',
		betID: 'stake-qa-replay-bonus',
		payout: 1.12 * API,
		payoutMultiplier: 112,
		state: [
			{ index: 0, type: 'reveal', board: triggerBoard, gameType: 'basegame' },
			{ index: 1, type: 'freeSpinTrigger', totalFs: 2, tier: 1, positions: triggerPositions },
			{ index: 2, type: 'updateFreeSpin', amount: 0, total: 2, tier: 1 },
			{ index: 3, type: 'reveal', board: boardWithColumn('L1'), gameType: 'freegame' },
			{ index: 4, type: 'winInfo', totalWin: 63, wins: [{ symbol: 'L1', count: 5, win: 63, positions: columnPositions(0) }] },
			{
				index: 5,
				type: 'goldenReveal',
				rewards: [{ col: 0, row: 0, kind: 'coin', tier: 'bronze', value: 0.49 }],
			},
			{ index: 6, type: 'goldenAward', amount: 49, totalWin: 112 },
			{ index: 7, type: 'goldenClear', clearGolden: true },
			{ index: 8, type: 'updateFreeSpin', amount: 1, total: 2, tier: 1 },
			{ index: 9, type: 'reveal', board: quietBoard(), gameType: 'freegame' },
			{ index: 10, type: 'freeSpinEnd', amount: 112 },
			{ index: 11, type: 'finalWin', amount: 112 },
		],
	};
};

const cloneRound = (round) => JSON.parse(JSON.stringify(round));
const withoutPayoutMultiplier = (round) => {
	const clone = cloneRound(round);
	delete clone.payoutMultiplier;
	return clone;
};
const bonusTier1ReplayRound = () => {
	const round = cloneRound(bonusReplayRound());
	round.mode = 'bonus_tier1';
	round.costMultiplier = 31;
	round.betID = 'stake-qa-replay-bonus-tier1';
	return round;
};
const rainbowReplayRound = () => {
	const round = cloneRound(authoritativeClusterReplayRound({ symbol: 'L2', positions: columnPositions(0), bookUnits: 48 }));
	round.mode = 'rainbow';
	round.costMultiplier = 6;
	round.betID = 'stake-qa-replay-rainbow';
	return round;
};

const authoritativeClusterReplayRound = ({ symbol, positions, bookUnits }) => {
	const board = quietBoard();
	for (const position of positions) board[position.col][position.row] = position.symbol || symbol;
	return {
		active: false,
		game: 'golden-goal-rush',
		version: '1',
		mode: 'base',
		amount: API,
		currency: 'USD',
		payout: Math.round(API * bookUnits / 100),
		payoutMultiplier: bookUnits,
		state: [
			{ index: 0, type: 'reveal', board, gameType: 'basegame' },
			{ index: 1, type: 'winInfo', totalWin: bookUnits, runningTotalWin: bookUnits, wins: [{ symbol, count: positions.length, win: bookUnits, positions }] },
			{ index: 2, type: 'setWin', amount: bookUnits },
			{ index: 3, type: 'setTotalWin', amount: bookUnits },
			{ index: 4, type: 'finalWin', amount: bookUnits },
		],
	};
};

const amountBoundaryReplayRound = (bookUnits) => ({
	active: false,
	game: 'golden-goal-rush',
	version: '1',
	mode: 'base',
	amount: API,
	currency: 'USD',
	payout: Math.round(API * bookUnits / 100),
	payoutMultiplier: bookUnits,
	state: bookUnits === 0
		? [{ index: 0, type: 'reveal', board: quietBoard(), gameType: 'basegame' }, { index: 1, type: 'finalWin', amount: 0 }]
		: authoritativeClusterReplayRound({ symbol: 'L2', positions: columnPositions(0), bookUnits }).state,
});

// ---------------------------------------------------------------------------
// Page helpers
// ---------------------------------------------------------------------------
async function openPreview(context, base, query = '') {
	const page = await context.newPage();
	const startupErrors = [];
	page.on('pageerror', (error) => startupErrors.push(`pageerror: ${error?.message || error}`));
	page.on('console', (message) => {
		if (message.type() === 'error') startupErrors.push(`console: ${message.text()}`);
	});
	page.setDefaultTimeout(20_000);
	await page.goto(`${base}/${frontendEntry}${query}`, { waitUntil: 'load' });
	try {
		await page.waitForFunction(() => window.__ggrReady === true);
	} catch (error) {
		throw new Error(`${error?.message || error}${startupErrors.length ? ` | ${startupErrors.join(' | ')}` : ''}`);
	}
	return page;
}
const meterText = (page, id) => page.evaluate((elId) => document.getElementById(elId)?.textContent?.trim() ?? null, id);
const modalOpen = (page, id) => page.evaluate((elId) => !!document.getElementById(elId)?.classList.contains('open'), id);
const gameState = (page) => page.evaluate(() => ({
	spinning: window.__stakeQa.state.spinning,
	walletBusy: window.__stakeQa.state.walletBusy,
	auto: window.__stakeQa.state.auto,
	autoRemaining: window.__stakeQa.state.autoRemaining,
	mode: window.__stakeQa.state.mode,
	balance: window.__stakeQa.state.balance,
	bet: window.__stakeQa.state.bet,
	win: window.__stakeQa.state.win,
	currency: window.__stakeQa.state.currency,
}));
// The free-spins intro attaches its continue handler ~520ms after it opens;
// keep nudging it (click + Enter) until it actually closes.
async function dismissBonusIntro(page) {
	await page.waitForSelector('#bonus-intro.show', { timeout: 15_000 });
	for (let attempt = 0; attempt < 25; attempt += 1) {
		const open = await page.evaluate(() => document.getElementById('bonus-intro')?.classList.contains('show'));
		if (!open) return;
		await page.evaluate(() => document.getElementById('bonus-intro')?.click());
		await page.keyboard.press('Enter');
		await page.waitForTimeout(400);
	}
	throw new Error('bonus intro did not close');
}
async function screenshot(page, name) {
	mkdirSync(shotDir, { recursive: true });
	const file = join(shotDir, `${name}.png`);
	await page.screenshot({ path: file });
	return relative(root, file).replaceAll('\\', '/');
}

const REPLAY_VIEWPORTS = [
	{ name: 'desktop-1280x720', width: 1280, height: 720 },
	{ name: 'landscape-844x390', width: 844, height: 390, mobile: true },
	{ name: 'phone-360x740', width: 360, height: 740, mobile: true },
	{ name: 'phone-390x844', width: 390, height: 844, mobile: true },
	{ name: 'phone-430x932', width: 430, height: 932, mobile: true },
	{ name: 'phone-450x900', width: 450, height: 900, mobile: true },
	{ name: 'tablet-768x1024', width: 768, height: 1024 },
];

const replayQuery = ({ mode = 'base', event = 'stake-qa-event', currency = 'USD', extra = '' } = {}) => {
	const params = new URLSearchParams({
		replay: 'true',
		rgs_url: `https://${RGS_HOST}`,
		game: 'golden-goal-rush',
		version: '1',
		mode,
		event,
		amount: String(API),
		currency,
		lang: 'en',
		device: 'desktop',
	});
	return `?${params.toString()}${extra}`;
};

async function waitForReplayState(page, state, timeout = 20_000) {
	await page.waitForFunction(
		(expected) => document.getElementById('stage')?.dataset.replayState === expected,
		state,
		{ timeout },
	);
}

async function installReplayObserver(page) {
	await page.evaluate(() => {
		window.__stakeQaReplay = { winCells: [], floats: [], boards: [], states: [], actionClicks: 0 };
		const uniquePush = (array, value) => {
			if (value && !array.includes(value)) array.push(value);
		};
		const snapshot = () => {
			const evidence = window.__stakeQaReplay;
			if (!evidence) return;
			const stage = document.getElementById('stage');
			uniquePush(evidence.states, stage?.dataset.replayState || '');
			const cells = [...document.querySelectorAll('#board .cell')];
			cells.forEach((cell, index) => {
				if (!cell.classList.contains('win')) return;
				const col = index % 6;
				const row = Math.floor(index / 6);
				uniquePush(evidence.winCells, `${col},${row}`);
			});
			for (const item of document.querySelectorAll('.cluster-float')) uniquePush(evidence.floats, item.textContent?.trim() || '');
			const board = [...document.querySelectorAll('#board .cell > img')].map((img) => img.alt || '').join('|');
			if (board.split('|').filter(Boolean).length === 30) uniquePush(evidence.boards, board);
		};
		window.__stakeQaReplayObserver?.disconnect();
		window.__stakeQaReplayObserver = new MutationObserver(snapshot);
		window.__stakeQaReplayObserver.observe(document.getElementById('stage'), {
			subtree: true,
			childList: true,
			attributes: true,
			attributeFilter: ['class', 'data-replay-state'],
		});
		if (!window.__stakeQaReplayClickObserverInstalled) {
			document.getElementById('replay-action')?.addEventListener('click', () => {
				if (window.__stakeQaReplay) window.__stakeQaReplay.actionClicks += 1;
			});
			window.__stakeQaReplayClickObserverInstalled = true;
		}
		window.__stakeQaResetReplayEvidence = () => {
			window.__stakeQaReplay = { winCells: [], floats: [], boards: [], states: [], actionClicks: 0 };
		};
	});
}

const replayEvidence = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__stakeQaReplay || {})));
const resetReplayEvidence = (page) => page.evaluate(() => window.__stakeQaResetReplayEvidence?.());

async function driveReplayOverlays(page) {
	for (let attempt = 0; attempt < 240; attempt += 1) {
		const state = await page.evaluate(() => document.getElementById('stage')?.dataset.replayState);
		if (state === 'completed' || state === 'error') return;
		await page.evaluate(() => {
			const intro = document.getElementById('bonus-intro');
			if (intro?.classList.contains('show')) intro.click();
			const summary = document.getElementById('bonus-summary');
			if (summary?.classList.contains('show')) document.getElementById('bs-continue')?.click();
		});
		await page.waitForTimeout(100);
	}
}

async function replayUiAudit(page) {
	return page.evaluate(() => {
		const intersection = (a, b) => {
			const left = Math.max(a.left, b.left);
			const top = Math.max(a.top, b.top);
			const right = Math.min(a.right, b.right);
			const bottom = Math.min(a.bottom, b.bottom);
			return { left, top, right, bottom, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
		};
		const area = (rect) => Math.max(0, rect.width) * Math.max(0, rect.height);
		const viewportRect = { left: 0, top: 0, right: innerWidth, bottom: innerHeight, width: innerWidth, height: innerHeight };
		const visible = (el) => {
			if (!el) return false;
			const style = getComputedStyle(el);
			const rect = el.getBoundingClientRect();
			return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0
				&& rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.bottom > 0
				&& rect.left < innerWidth && rect.top < innerHeight;
		};
		const blocked = (el) => !el || el.disabled || !!el.closest('[inert]') || el.getAttribute('aria-hidden') === 'true'
			|| getComputedStyle(el).pointerEvents === 'none' || !visible(el);
		const describe = (selector) => {
			const el = document.querySelector(selector);
			return { exists: !!el, visible: visible(el), blocked: blocked(el), disabled: !!el?.disabled, inert: !!el?.closest('[inert]') };
		};
		const geometry = (el) => {
			if (!el) return null;
			const rect = el.getBoundingClientRect();
			let visibleRect = intersection(rect, viewportRect);
			let ancestor = el.parentElement;
			const clippingAncestors = [];
			while (ancestor) {
				const style = getComputedStyle(ancestor);
				if (/(hidden|clip|auto|scroll)/.test(style.overflowX + ' ' + style.overflowY)) {
					const ancestorRect = ancestor.getBoundingClientRect();
					visibleRect = intersection(visibleRect, ancestorRect);
					clippingAncestors.push(ancestor.id || ancestor.className || ancestor.tagName);
				}
				ancestor = ancestor.parentElement;
			}
			const totalArea = area(rect);
			return {
				id: el.id || el.dataset.meter || el.className || el.tagName,
				left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom,
				width: rect.width, height: rect.height,
				visibleFraction: totalArea > 0 ? area(visibleRect) / totalArea : 0,
				insideViewport: rect.left >= -0.5 && rect.top >= -0.5 && rect.right <= innerWidth + 0.5 && rect.bottom <= innerHeight + 0.5,
				clippingAncestors,
			};
		};
		const action = document.getElementById('replay-action');
		const actionRect = action?.getBoundingClientRect();
		const actionPoints = actionRect ? [
			[0.5, 0.5], [0.08, 0.08], [0.92, 0.08], [0.08, 0.92], [0.92, 0.92],
		].map(([x, y]) => {
			const hit = document.elementFromPoint(actionRect.left + actionRect.width * x, actionRect.top + actionRect.height * y);
			return !!hit && (hit === action || action?.contains(hit));
		}) : [];
		const board = document.getElementById('board');
		const win = document.querySelector('[data-meter="win"]');
		const bet = document.querySelector('[data-meter="bet"]');
		const panel = document.getElementById('replay-controls');
		const requiredElements = [win, bet, panel, document.getElementById('replay-status'), document.getElementById('replay-summary'), document.getElementById('replay-currency')];
		if (visible(board)) requiredElements.push(board);
		if (visible(action)) requiredElements.push(action);
		const boxes = requiredElements.filter(Boolean).map(geometry);
		const panelRect = panel?.getBoundingClientRect();
		const overlapArea = (first, second) => first && second ? area(intersection(first.getBoundingClientRect(), second.getBoundingClientRect())) : 0;
		const tabbableIds = [...document.querySelectorAll('button,input,select,textarea,a[href],[tabindex]')]
			.filter((el) => visible(el) && !el.disabled && !el.closest('[inert]') && el.tabIndex >= 0)
			.map((el) => el.id || el.getAttribute('aria-label') || el.tagName);
		return {
			state: document.getElementById('stage')?.dataset.replayState,
			replayClass: document.getElementById('stage')?.classList.contains('replay-mode'),
			normal: {
				balance: describe('[data-meter="balance"]'),
				spin: describe('#btn-spin'),
				auto: describe('#btn-auto'),
				bonus: describe('#btn-bonus'),
				betControls: describe('#bet-controls'),
				betMinus: describe('#btn-bet-minus'),
				betPlus: describe('#btn-bet-plus'),
				autoModal: describe('#modal-autospin'),
				bonusModal: describe('#modal-bonusbuy'),
			},
			winVisible: visible(win),
			winText: document.getElementById('meter-win')?.textContent?.trim(),
			betVisible: visible(bet),
			betLabel: bet?.querySelector('.meter-label')?.textContent?.trim(),
			betText: document.getElementById('meter-bet')?.textContent?.trim(),
			betCurrency: document.getElementById('meter-bet-currency')?.textContent?.trim(),
			betDisplayOnly: !['INPUT', 'SELECT', 'TEXTAREA'].includes(document.getElementById('meter-bet')?.tagName || '')
				&& document.getElementById('meter-bet')?.isContentEditable !== true,
			actionVisible: visible(action),
			actionText: action?.textContent?.trim(),
			actionHittable: actionPoints.length === 5 && actionPoints.every(Boolean),
			actionHitPoints: actionPoints,
			actionRole: action?.getAttribute('role') || action?.tagName?.toLowerCase(),
			actionAccessibleName: action?.getAttribute('aria-label') || action?.textContent?.trim() || '',
			actionDisabled: !!action?.disabled,
			statusText: document.getElementById('replay-status')?.textContent?.trim(),
			boardVisible: visible(board),
			boxes,
			allRequiredInsideViewport: boxes.every((box) => box.insideViewport),
			allRequiredUnclipped: boxes.every((box) => box.visibleFraction >= 0.9999),
			panelOverlapWin: overlapArea(panel, win),
			panelOverlapBet: overlapArea(panel, bet),
			panelGeometry: geometry(panel),
			panelDescendants: panel ? [...panel.querySelectorAll('*')].filter(visible).map(geometry) : [],
			textSizes: panel ? [...panel.querySelectorAll('strong,small,span,button')].filter(visible).map((el) => ({ id: el.id || el.className || el.tagName, size: Number.parseFloat(getComputedStyle(el).fontSize), text: el.textContent?.trim() || '' })) : [],
			scrollX: document.documentElement.scrollWidth > innerWidth || document.body.scrollWidth > innerWidth,
			scrollY: document.documentElement.scrollHeight > innerHeight || document.body.scrollHeight > innerHeight,
			panelRect: panelRect ? { left: panelRect.left, top: panelRect.top, right: panelRect.right, bottom: panelRect.bottom, width: panelRect.width, height: panelRect.height } : null,
			tabbableIds,
		};
	});
}

async function pageSafeReplayError(page) {
	return page.evaluate(() => ({
		state: document.getElementById('stage')?.dataset.replayState,
		status: document.getElementById('replay-status')?.textContent?.trim(),
		current: window.__stakeQa?.Replay?.current || null,
		win: window.__stakeQa?.state?.win,
	}));
}

// ---------------------------------------------------------------------------
// 1. Currency display in the live HUD
// ---------------------------------------------------------------------------
async function testCurrency(browser, base) {
	const group = 'currency-e2e';
	const cases = [
		{ currency: 'EUR', balance: '€1000.00', bet: '€1.00', win: '€0.00' },
		{ currency: 'USD', balance: '$1000.00', bet: '$1.00', win: '$0.00' },
		{ currency: 'XSC', balance: '1000.00 SC', bet: '1.00 SC', win: '0.00 SC', extra: '&social=true' },
		{ currency: 'XGC', balance: '1000.00 GC', bet: '1.00 GC', win: '0.00 GC' },
		{ currency: 'JPY', balance: '¥1000', bet: '¥1', win: '¥0' },
		{ currency: 'DKK', balance: '1000.00 KR', bet: '1.00 KR', win: '0.00 KR' },
		{ currency: 'CLP', balance: '1000 CLP', bet: '1 CLP', win: '0 CLP' },
	];
	const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
	for (const testCase of cases) {
		const page = await openPreview(context, base, `?currency=${testCase.currency}${testCase.extra || ''}`);
		const balance = await meterText(page, 'meter-balance');
		const bet = await meterText(page, 'meter-bet');
		const win = await meterText(page, 'meter-win');
		const betDisplay = await meterText(page, 'bet-display');
		expect(group, `${testCase.currency} balance meter`, balance === testCase.balance, `${balance} === ${testCase.balance}`);
		expect(group, `${testCase.currency} bet meter`, bet === testCase.bet, `${bet} === ${testCase.bet}`);
		expect(group, `${testCase.currency} win meter`, win === testCase.win, `${win} === ${testCase.win}`);
		expect(group, `${testCase.currency} bet panel`, betDisplay === testCase.bet, `${betDisplay} === ${testCase.bet}`);
		await page.close();
	}
	await context.close();
}

// ---------------------------------------------------------------------------
// 2. Insufficient Funds / Insufficient Balance — spin, auto-bet, bonus buy
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// 1b. Authenticate-driven bet configuration
// ---------------------------------------------------------------------------
async function testBetConfig(browser, base) {
	const group = 'bet-config-e2e';
	const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
	const calls = await mockRgs(context, {
		authenticate: () => ({
			balance: balanceOf(5000, 'JPY'),
			config: {
				currency: 'JPY',
				betLevels: [2 * API, 3 * API, 7 * API],
				defaultBetLevel: 3 * API,
				betModes: { base: {}, hunt: {}, rainbow: {}, bonus_tier1: {}, bonus: {} },
			},
			round: null,
		}),
		play: (body) => ({
			balance: balanceOf(5000, 'JPY'),
			round: replayRound({ mode: body.mode, amount: body.amount, payout: 0 }),
		}),
	});
	const page = await openPreview(context, base, rgsQuery('JPY'));
	await page.waitForFunction(() => window.__stakeQa.state.walletBusy === false);
	const initial = await gameState(page);
	const betDisplay = await meterText(page, 'bet-display');
	const activeConfig = await page.evaluate(() => window.__stakeQa.getBetConfig());
	expect(group, 'default bet comes from authenticate.defaultBetLevel', initial.bet === 3, `bet=${initial.bet}`);
	expect(group, 'currency comes from authenticate balance/config', initial.currency === 'JPY', `currency=${initial.currency}`);
	expect(group, 'bet display uses authenticate currency', betDisplay === '¥3', `${betDisplay} === ¥3`);
	expect(group, 'active bet levels match authenticate', JSON.stringify(activeConfig.betLevels) === JSON.stringify([2, 3, 7]), JSON.stringify(activeConfig.betLevels));

	await page.click('#btn-bet-plus');
	await page.click('#btn-bet-plus');
	let state = await gameState(page);
	expect(group, 'bet plus is clamped to highest authenticate level', state.bet === 7, `bet=${state.bet}`);
	await page.click('#btn-bet-minus');
	state = await gameState(page);
	expect(group, 'bet minus returns to next authenticate level', state.bet === 3, `bet=${state.bet}`);
	await page.click('#btn-bet-plus');
	await page.click('#btn-spin');
	await page.waitForFunction(() => window.__stakeQa.state.spinning === false && window.__stakeQa.state.walletBusy === false, null, { timeout: 45_000 });
	expect(group, '/wallet/play uses selected authenticate API amount', calls.play[0]?.amount === 7 * API, `amount=${calls.play[0]?.amount}`);
	expect(group, '/wallet/play uses resolved RGS mode', calls.play[0]?.mode === 'base', `mode=${calls.play[0]?.mode}`);
	await context.close();
}

// ---------------------------------------------------------------------------
// 1c. Stake.us / social wording on live UI
// ---------------------------------------------------------------------------
async function testSocialWording(browser, base) {
	const group = 'social-e2e';
	const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
	const page = await openPreview(context, base, '?currency=XSC&social=true');
	const hud = await page.evaluate(() => ({
		betMeter: document.querySelector('[data-meter="bet"] .meter-label')?.textContent?.trim(),
		betPanel: document.getElementById('bet-display-label')?.textContent?.trim(),
		spin: document.querySelector('#btn-spin span')?.textContent?.trim(),
		bonusAria: document.getElementById('btn-bonus')?.getAttribute('aria-label'),
		autoAria: document.getElementById('btn-auto')?.getAttribute('aria-label'),
	}));
	expect(group, 'HUD bet label becomes PLAY', hud.betMeter === 'PLAY' && hud.betPanel === 'PLAY', JSON.stringify(hud));
	expect(group, 'main button becomes PLAY', hud.spin === 'PLAY', JSON.stringify(hud));
	expect(group, 'major action aria labels use social wording', hud.bonusAria === 'Feature' && hud.autoAria === 'Auto-Play', JSON.stringify(hud));

	await page.click('#btn-auto');
	await page.waitForFunction(() => document.getElementById('modal-autospin')?.classList.contains('open'));
	const autoTitle = await meterText(page, 'autospin-title');
	await page.click('[data-auto-count="25"]');
	const autoConfirm = await page.evaluate(() => document.getElementById('auto-confirm')?.textContent || '');
	expect(group, 'auto modal title is social-safe', autoTitle === 'AUTO-PLAY', autoTitle);
	expect(group, 'auto confirm says Auto-Play, not Auto-Bet', autoConfirm.includes('Start Auto-Play for 25') && !autoConfirm.includes('Auto-Bet'), autoConfirm.trim());
	await page.evaluate(() => document.querySelectorAll('[data-modal]').forEach((m) => m.classList.remove('open')));

	await page.click('#btn-bonus');
	await page.waitForFunction(() => document.getElementById('modal-bonusbuy')?.classList.contains('open'));
	const bonus = await page.evaluate(() => ({
		title: document.getElementById('bonusbuy-title')?.textContent?.trim(),
		text: document.getElementById('modal-bonusbuy')?.innerText || '',
	}));
	expect(group, 'bonus modal title is social-safe', bonus.title === 'BONUS / FEATURE', bonus.title);
	const bonusHits = socialForbiddenHits(bonus.text);
	expect(group, 'bonus modal avoids restricted Social Mode copy', bonusHits.length === 0, `hits=${bonusHits.join(',') || 'none'}; ${bonus.text.replace(/\s+/g, ' ').slice(0, 160)}`);
	await page.evaluate(() => document.querySelectorAll('[data-modal]').forEach((m) => m.classList.remove('open')));

	await page.click('#btn-info');
	await page.waitForFunction(() => document.getElementById('modal-rules')?.classList.contains('open'));
	const rulesAudit = await page.evaluate(() => ({
		text: document.getElementById('modal-rules')?.innerText || '',
		heads: [...document.querySelectorAll('#modal-rules .pt-head')].map((el) => el.textContent.trim()),
		controls: [...document.querySelectorAll('#modal-rules .control-rule')].map((el) => el.textContent.trim()),
	}));
	const hits = socialForbiddenHits(rulesAudit.text);
	expect(group, 'social rules avoid restricted Stake.us phrases', hits.length === 0, `hits=${hits.join(',') || 'none'}`);
	expect(group, 'social rules include detailed mode explanations', rulesAudit.heads.includes('Game Modes') && rulesAudit.text.includes('Base Play') && rulesAudit.text.includes('Feature Multiplier') && rulesAudit.text.includes('3 Scatter tickets'), JSON.stringify(rulesAudit.heads));
	expect(group, 'social rules explain retrigger conditions', rulesAudit.heads.includes('Retriggers') && rulesAudit.text.includes('Base Play and Rainbow Spin can trigger Free Spins') && rulesAudit.text.includes('Feature-panel Free Spins do not add additional Free Spins'), rulesAudit.text.replace(/\s+/g, ' ').slice(0, 220));
	expect(group, 'social rules still include button explanations', rulesAudit.heads.includes('Buttons & Controls') && rulesAudit.controls.some((row) => row.includes('Auto-Play')), JSON.stringify(rulesAudit.heads));
	await screenshot(page, 'social-wording');
	await context.close();
}

async function testInsufficientFunds(browser, base) {
	const group = 'insufficient-funds-e2e';
	const runCase = async ({ currency, extra, expectedTitle }) => {
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		const calls = await mockRgs(context, {
			authenticate: () => ({ balance: balanceOf(0.01, currency), round: null }),
		});
		const page = await openPreview(context, base, rgsQuery(currency, extra));
		await page.waitForFunction(() => window.__stakeQa.state.walletBusy === false);
		const before = await gameState(page);
		expect(group, `${currency} launch balance is 0.01`, before.balance === 0.01, `balance=${before.balance}`);

		// Spin with bet > balance
		await page.click('#btn-spin');
		await page.waitForFunction(() => document.getElementById('modal-notification')?.classList.contains('open'));
		const title = await meterText(page, 'notice-title');
		const after = await gameState(page);
		expect(group, `${currency} spin shows "${expectedTitle}"`, title === expectedTitle, `title=${title}`);
		expect(group, `${currency} spin makes no /wallet/play call`, calls.play.length === 0, `play calls=${calls.play.length}`);
		expect(group, `${currency} spin does not start`, after.spinning === false && after.balance === 0.01, JSON.stringify(after));
		await page.click('#notice-ok');

		// Auto-bet start with bet > balance: selection may open, confirm must block
		await page.click('#btn-auto');
		await page.waitForFunction(() => document.getElementById('modal-autospin')?.classList.contains('open'));
		await page.click('[data-auto-count="25"]');
		await page.click('#auto-confirm-start');
		await page.waitForFunction(() => document.getElementById('modal-notification')?.classList.contains('open'));
		const autoTitle = await meterText(page, 'notice-title');
		const autoState = await gameState(page);
		expect(group, `${currency} auto-bet confirm shows "${expectedTitle}"`, autoTitle === expectedTitle, `title=${autoTitle}`);
		expect(group, `${currency} auto-bet stays off`, autoState.auto === false, `auto=${autoState.auto}`);
		expect(group, `${currency} auto-bet makes no /wallet/play call`, calls.play.length === 0, `play calls=${calls.play.length}`);
		await page.click('#notice-ok');

		// Bonus buy with price > balance: no confirm step, no purchase.
		// The unaffordable offer is aria-disabled but still receives pointer
		// events — force the click to simulate a real user tapping it anyway.
		await page.click('#btn-bonus');
		await page.waitForFunction(() => document.getElementById('modal-bonusbuy')?.classList.contains('open'));
		await page.click('[data-buy]', { force: true });
		await page.waitForFunction(() => document.getElementById('modal-notification')?.classList.contains('open'));
		const buyTitle = await meterText(page, 'notice-title');
		const confirmVisible = await page.evaluate(() => !!document.getElementById('bb-confirm'));
		expect(group, `${currency} bonus buy shows "${expectedTitle}"`, buyTitle === expectedTitle, `title=${buyTitle}`);
		expect(group, `${currency} bonus buy opens no confirm`, confirmVisible === false, `confirm rendered=${confirmVisible}`);
		expect(group, `${currency} bonus buy makes no /wallet/play call`, calls.play.length === 0, `play calls=${calls.play.length}`);
		await context.close();
	};

	await runCase({ currency: 'EUR', extra: '', expectedTitle: 'Insufficient Funds' });
	await runCase({ currency: 'XSC', extra: '&social=true', expectedTitle: 'Insufficient Balance' });
}

// ---------------------------------------------------------------------------
// 3. Major actions need selection + confirmation (Auto-Bet, Bonus Buy, guard)
// ---------------------------------------------------------------------------
async function testMajorActions(browser, base) {
	const group = 'major-actions-e2e';
	const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
	const page = await openPreview(context, base); // demo mode: no RGS, no wallet

	// First click opens the selector — nothing starts.
	await page.click('#btn-auto');
	await page.waitForFunction(() => document.getElementById('modal-autospin')?.classList.contains('open'));
	let state = await gameState(page);
	expect(group, 'auto-bet click opens selection only', state.auto === false && state.spinning === false, JSON.stringify(state));
	const options = await page.evaluate(() =>
		[...document.querySelectorAll('#auto-options [data-auto-count]')].map((el) => el.textContent.trim()));
	expect(group, 'auto-bet options are 10/25/50/100/200/∞', JSON.stringify(options) === JSON.stringify(['10', '25', '50', '100', '200', '∞']), options.join(','));
	await screenshot(page, 'auto-bet-selection');

	// Selecting an amount only reveals the confirmation step.
	await page.click('[data-auto-count="25"]');
	await page.waitForSelector('#auto-confirm.show');
	const confirmText = await page.evaluate(() => document.getElementById('auto-confirm')?.textContent || '');
	state = await gameState(page);
	expect(group, 'selection shows confirm step, auto still off', state.auto === false && confirmText.includes('Start Auto-Bet for 25'), confirmText.trim());
	await screenshot(page, 'auto-bet-confirm');

	// Cancel keeps auto-bet off.
	await page.click('#auto-cancel');
	await page.waitForFunction(() => !document.getElementById('modal-autospin')?.classList.contains('open'));
	state = await gameState(page);
	expect(group, 'cancel keeps auto-bet off', state.auto === false && state.spinning === false, JSON.stringify(state));

	// Confirm actually starts auto-bet. Turbo keeps the demo spin that follows
	// short so the suite does not depend on long win animations.
	await page.click('#btn-turbo');
	await page.click('#btn-auto');
	await page.waitForFunction(() => document.getElementById('modal-autospin')?.classList.contains('open'));
	await page.click('[data-auto-count="10"]');
	await page.waitForSelector('#auto-confirm.show');
	await page.click('#auto-confirm-start');
	await page.waitForFunction(() => window.__stakeQa.state.auto === true);
	pass(group, 'confirm starts auto-bet', 'state.auto === true after Confirm');
	await page.click('#btn-auto'); // toggle back off (stop is not a major action)
	await page.waitForFunction(() => window.__stakeQa.state.auto === false);
	await page.waitForFunction(() => window.__stakeQa.state.spinning === false, null, { timeout: 90_000 });
	await page.click('#btn-turbo');

	// Bonus buy: first click opens the offer list, choosing an offer opens the
	// confirm step, Cancel returns to the list without buying.
	const balanceBeforeBuy = (await gameState(page)).balance;
	await page.click('#btn-bonus');
	await page.waitForFunction(() => document.getElementById('modal-bonusbuy')?.classList.contains('open'));
	state = await gameState(page);
	expect(group, 'bonus buy click opens list only', state.spinning === false && state.mode === 'base', JSON.stringify(state));
	await page.click('[data-buy="tier1"]');
	await page.waitForSelector('#bb-confirm');
	const bbQuestion = await page.evaluate(() => document.querySelector('.bb-confirm .c-q')?.textContent || '');
	state = await gameState(page);
	expect(group, 'bonus buy shows confirm with price', /Buy[\s\S]*for/.test(bbQuestion) && state.mode === 'base' && state.spinning === false, bbQuestion.replace(/\s+/g, ' ').trim());
	await screenshot(page, 'bonus-buy-confirm');
	await page.click('#bb-cancel');
	await page.waitForSelector('[data-buy="tier1"]');
	state = await gameState(page);
	expect(group, 'bonus buy cancel buys nothing', state.mode === 'base' && state.spinning === false && state.balance === balanceBeforeBuy, `balance ${state.balance} === ${balanceBeforeBuy}, ${JSON.stringify(state)}`);
	await page.click('.modal-close', { timeout: 5000 }).catch(() => {});
	await page.evaluate(() => document.querySelectorAll('[data-modal]').forEach((m) => m.classList.remove('open')));

	// confirmMajorAction(): the generic gate every future major action
	// (e.g. Double Chance) must use — Confirm resolves true, everything else false.
	const gate = await page.evaluate(async () => {
		const results = {};
		let pending = window.__stakeQa.confirmMajorAction({ title: 'DOUBLE CHANCE', body: 'Enable Double Chance for a higher bet?' });
		await new Promise((r) => setTimeout(r, 80));
		results.modalOpen = document.getElementById('modal-major-confirm').classList.contains('open');
		results.title = document.getElementById('major-confirm-title').textContent;
		document.getElementById('major-confirm-yes').click();
		results.confirm = await pending;
		pending = window.__stakeQa.confirmMajorAction({ title: 'DOUBLE CHANCE', body: 'x' });
		await new Promise((r) => setTimeout(r, 80));
		document.getElementById('major-confirm-no').click();
		results.cancel = await pending;
		pending = window.__stakeQa.confirmMajorAction({ title: 'DOUBLE CHANCE', body: 'x' });
		await new Promise((r) => setTimeout(r, 80));
		window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));
		results.escape = await pending;
		results.closedAfter = !document.getElementById('modal-major-confirm').classList.contains('open');
		return results;
	});
	expect(group, 'confirmMajorAction opens confirm modal', gate.modalOpen === true && gate.title === 'DOUBLE CHANCE', JSON.stringify(gate));
	expect(group, 'confirmMajorAction: Confirm resolves true', gate.confirm === true, `confirm=${gate.confirm}`);
	expect(group, 'confirmMajorAction: Cancel resolves false', gate.cancel === false, `cancel=${gate.cancel}`);
	expect(group, 'confirmMajorAction: Escape resolves false and closes', gate.escape === false && gate.closedAfter === true, JSON.stringify(gate));

	await context.close();
}

// ---------------------------------------------------------------------------
// 4. Interrupted bonus round: refresh mid-bonus → message → resume once
// ---------------------------------------------------------------------------
async function testInterruptedRound(browser, base) {
	const group = 'interrupted-round-e2e';
	const runCase = async ({ currency, extra, expectedBalance }) => {
		const label = currency;
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		const calls = await mockRgs(context, {
			authenticate: () => ({ balance: balanceOf(1000, currency), round: interruptedBonusRound() }),
			endRound: () => ({ balance: balanceOf(1002.5, currency), round: { ...interruptedBonusRound(), active: false, payout: 2.5 * API, payoutMultiplier: 250, state: undefined } }),
		});
		const page = await openPreview(context, base, rgsQuery(currency, extra));

		// The resume message must appear before anything is played.
		await page.waitForFunction(() => document.getElementById('modal-interrupted-round')?.classList.contains('open'));
		const copy = await page.evaluate(() => document.querySelector('#modal-interrupted-round .interrupted-copy')?.textContent?.trim());
		expect(group, `${label} resume message shown with required copy`, copy === 'Your previous round was interrupted. You can continue where you left off.', copy);
		expect(group, `${label} no bet was charged for the resume`, calls.play.length === 0, `play calls=${calls.play.length}`);
		await screenshot(page, `interrupted-round-${label}`);

		// While the message is open every major entry point stays blocked.
		// Physically: the persistent modal backdrop covers the whole stage.
		const covered = await page.evaluate(() => ['btn-spin', 'btn-auto', 'btn-bonus'].every((id) => {
			const rect = document.getElementById(id).getBoundingClientRect();
			const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
			return !!hit && !!hit.closest('#modal-interrupted-round');
		}));
		expect(group, `${label} modal physically covers spin/auto/bonus buttons`, covered === true, `covered=${covered}`);
		// Logically: even a forced click must be ignored by the state guards.
		await page.click('#btn-spin', { force: true });
		await page.click('#btn-auto', { force: true });
		await page.click('#btn-bonus', { force: true });
		await page.waitForTimeout(250);
		const blocked = await page.evaluate(() => ({
			spinning: window.__stakeQa.state.spinning,
			autoOpen: document.getElementById('modal-autospin').classList.contains('open'),
			buyOpen: document.getElementById('modal-bonusbuy').classList.contains('open'),
			interruptedStillOpen: document.getElementById('modal-interrupted-round').classList.contains('open'),
			walletBusy: window.__stakeQa.state.walletBusy,
		}));
		expect(group, `${label} spin blocked while message open`, blocked.spinning === false, JSON.stringify(blocked));
		expect(group, `${label} auto-bet blocked while message open`, blocked.autoOpen === false, JSON.stringify(blocked));
		expect(group, `${label} bonus buy blocked while message open`, blocked.buyOpen === false, JSON.stringify(blocked));
		expect(group, `${label} message persists over other clicks`, blocked.interruptedStillOpen === true && blocked.walletBusy === true, JSON.stringify(blocked));
		expect(group, `${label} still no /wallet/play while blocked`, calls.play.length === 0, `play calls=${calls.play.length}`);

		// Continue resumes the SAME round: intro → book playback → single end-round.
		await page.click('#interrupted-continue');
		await page.waitForFunction(() => !document.getElementById('modal-interrupted-round')?.classList.contains('open'));
		await dismissBonusIntro(page);
		await page.waitForFunction(() => window.__stakeQa.state.spinning === false && window.__stakeQa.state.walletBusy === false, null, { timeout: 45_000 });

		const finalState = await gameState(page);
		const balanceText = await meterText(page, 'meter-balance');
		expect(group, `${label} resume never called /wallet/play (no double bet)`, calls.play.length === 0, `play calls=${calls.play.length}`);
		expect(group, `${label} resumed round settled exactly once`, calls.endRound.length === 1, `end-round calls=${calls.endRound.length}`);
		expect(group, `${label} bonus progress events were saved`, calls.event.length >= 1, `event calls=${calls.event.length}`);
		expect(group, `${label} settled wallet balance applied`, finalState.balance === 1002.5, `balance=${finalState.balance}`);
		expect(group, `${label} balance meter shows settled amount`, balanceText === expectedBalance, `${balanceText} === ${expectedBalance}`);
		expect(group, `${label} game returns to idle base mode`, finalState.mode === 'base' && finalState.spinning === false && finalState.walletBusy === false, JSON.stringify(finalState));
		const cleanedUp = await page.evaluate(() => !document.getElementById('modal-interrupted-round')?.classList.contains('open'));
		expect(group, `${label} resume message cleaned up after round end`, cleanedUp === true, `open=${!cleanedUp}`);
		await screenshot(page, `interrupted-round-${label}-settled`);
		await context.close();
	};

	await runCase({ currency: 'EUR', extra: '', expectedBalance: '€1002.50' });
	await runCase({ currency: 'XSC', extra: '&social=true', expectedBalance: '1002.50 SC' });
}

// ---------------------------------------------------------------------------
// 5. Mobile fullscreen: the game fills phone/tablet screens, no letterboxing
// ---------------------------------------------------------------------------
async function testMobile(browser, base) {
	const group = 'mobile-e2e';
	const viewports = [
		{ name: 'phone-360x740', width: 360, height: 740, portrait: true },
		{ name: 'phone-390x844', width: 390, height: 844, portrait: true },
		{ name: 'phone-430x932', width: 430, height: 932, portrait: true },
		{ name: 'phone-450x900', width: 450, height: 900, portrait: true },
		{ name: 'tablet-768x1024', width: 768, height: 1024 },
		{ name: 'landscape-844x390', width: 844, height: 390 },
	];
	for (const viewport of viewports) {
		const context = await browser.newContext({
			viewport: { width: viewport.width, height: viewport.height },
			isMobile: viewport.width < 700,
			hasTouch: viewport.width < 700,
		});
		const page = await openPreview(context, base);
		await page.waitForTimeout(400); // allow the double fitViewport passes to settle
		const layout = await page.evaluate(() => {
			const rect = (el) => {
				if (!el) return null;
				const r = el.getBoundingClientRect();
				return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom };
			};
			const visible = (el) => {
				if (!el) return false;
				const r = el.getBoundingClientRect();
				return r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.x < innerWidth && r.y < innerHeight;
			};
			const spin = document.getElementById('btn-spin');
			const spinRect = spin.getBoundingClientRect();
			const probe = document.elementFromPoint(spinRect.x + spinRect.width / 2, spinRect.y + spinRect.height / 2);
			const touchTargets = {};
			for (const id of ['btn-spin', 'btn-menu', 'btn-bonus', 'btn-auto', 'btn-turbo', 'btn-info', 'btn-settings', 'btn-bet-minus', 'btn-bet-plus']) {
				touchTargets[id] = rect(document.getElementById(id));
			}
			return {
				vw: innerWidth,
				vh: innerHeight,
				portraitMode: document.getElementById('stage').classList.contains('mobile-portrait'),
				stage: rect(document.getElementById('stage')),
				background: rect(document.querySelector('.stage > img.background')),
				board: rect(document.getElementById('board')),
				balanceValue: rect(document.getElementById('meter-balance')),
				touchTargets,
				scrollX: document.documentElement.scrollWidth > innerWidth,
				scrollY: document.documentElement.scrollHeight > innerHeight,
				spinVisible: visible(spin),
				spinHittable: !!probe && (probe === spin || spin.contains(probe)),
				metersVisible: visible(document.querySelector('.meters')),
				boardVisible: visible(document.getElementById('board')),
			};
		});
		const stageCovers = layout.stage
			&& layout.stage.w >= layout.vw * 0.98 && layout.stage.h >= layout.vh * 0.98
			&& layout.stage.x <= 1 && layout.stage.y <= 1;
		const backgroundCovers = layout.background
			&& layout.background.w >= layout.vw * 0.98 && layout.background.h >= layout.vh * 0.98;
		expect(group, `${viewport.name} stage fills >=98% of viewport`, !!stageCovers, JSON.stringify(layout.stage));
		expect(group, `${viewport.name} background art covers viewport (no letterbox)`, !!backgroundCovers, JSON.stringify(layout.background));
		expect(group, `${viewport.name} no scrollbars`, layout.scrollX === false && layout.scrollY === false, `scrollX=${layout.scrollX} scrollY=${layout.scrollY}`);
		expect(group, `${viewport.name} board visible`, layout.boardVisible === true, JSON.stringify(layout.board));
		expect(group, `${viewport.name} HUD meters visible`, layout.metersVisible === true, '');
		expect(group, `${viewport.name} spin button visible and clickable`, layout.spinVisible === true && layout.spinHittable === true, `visible=${layout.spinVisible} hittable=${layout.spinHittable}`);
		if (viewport.portrait) {
			// Portrait phones must be PLAYABLE, not a shrunken desktop stage:
			// big board, readable HUD, thumb-sized touch targets, nothing cut off.
			expect(group, `${viewport.name} portrait board-first mode active`, layout.portraitMode === true, `mobile-portrait=${layout.portraitMode}`);
			expect(group, `${viewport.name} board takes >=88% of viewport width`, !!layout.board && layout.board.w >= layout.vw * 0.88, `board=${layout.board?.w?.toFixed(1)}px of ${layout.vw}px (${((layout.board?.w || 0) / layout.vw * 100).toFixed(1)}vw)`);
			expect(group, `${viewport.name} HUD value text readable (>=10px)`, !!layout.balanceValue && layout.balanceValue.h >= 10, `balance text height=${layout.balanceValue?.h?.toFixed(1)}px`);
			const spinBox = layout.touchTargets['btn-spin'];
			expect(group, `${viewport.name} spin touch target >=56x56`, !!spinBox && spinBox.w >= 56 && spinBox.h >= 56, `spin=${spinBox?.w?.toFixed(0)}x${spinBox?.h?.toFixed(0)}`);
			for (const [id, box] of Object.entries(layout.touchTargets)) {
				if (id === 'btn-spin') continue;
				const bigEnough = !!box && box.w >= 44 && box.h >= 44;
				const inViewport = !!box && box.x >= -0.5 && box.y >= -0.5 && box.right <= layout.vw + 0.5 && box.bottom <= layout.vh + 0.5;
				expect(group, `${viewport.name} ${id} touch target >=44x44 and fully on screen`, bigEnough && inViewport, `${box?.w?.toFixed(0)}x${box?.h?.toFixed(0)} @ (${box?.x?.toFixed(0)},${box?.y?.toFixed(0)})`);
			}
		}
		const shot = await screenshot(page, `mobile-${viewport.name}`);
		pass(group, `${viewport.name} screenshot saved`, shot);
		await context.close();
	}

	const fullscreenContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
	const fullscreenPage = await openPreview(fullscreenContext, base);
	await fullscreenPage.evaluate(() => {
		window.__stakeQaFullscreen = { supported: typeof document.documentElement.requestFullscreen === 'function', attempted: false, entered: false, error: null };
		document.getElementById('btn-menu')?.addEventListener('click', async () => {
			window.__stakeQaFullscreen.attempted = true;
			try {
				if (typeof document.documentElement.requestFullscreen !== 'function') throw new Error('Fullscreen API unavailable');
				await document.documentElement.requestFullscreen();
				window.__stakeQaFullscreen.entered = document.fullscreenElement === document.documentElement;
			} catch (error) {
				window.__stakeQaFullscreen.error = error?.message || String(error);
			}
		}, { once: true, capture: true });
	});
	await fullscreenPage.click('#btn-menu');
	await fullscreenPage.waitForFunction(() => window.__stakeQaFullscreen?.attempted === true && (window.__stakeQaFullscreen.entered || window.__stakeQaFullscreen.error !== null), null, { timeout: 10_000 });
	await fullscreenPage.waitForTimeout(350);
	const fullscreenAudit = await fullscreenPage.evaluate(() => {
		const stage = document.getElementById('stage')?.getBoundingClientRect();
		const result = window.__stakeQaFullscreen || {};
		return {
			...result,
			fullscreenElement: document.fullscreenElement?.tagName || null,
			stage: stage ? { left: stage.left, top: stage.top, right: stage.right, bottom: stage.bottom, width: stage.width, height: stage.height } : null,
			viewport: { width: innerWidth, height: innerHeight },
			scrollX: document.documentElement.scrollWidth > innerWidth || document.body.scrollWidth > innerWidth,
			scrollY: document.documentElement.scrollHeight > innerHeight || document.body.scrollHeight > innerHeight,
		};
	});
	const fullscreenLayoutValid = !!fullscreenAudit.stage
		&& fullscreenAudit.stage.width >= fullscreenAudit.viewport.width * 0.98
		&& fullscreenAudit.stage.height >= fullscreenAudit.viewport.height * 0.98
		&& fullscreenAudit.stage.left <= 1 && fullscreenAudit.stage.top <= 1
		&& !fullscreenAudit.scrollX && !fullscreenAudit.scrollY;
	expect(group, 'real user-activated Fullscreen API enters fullscreen or the no-API fallback remains viewport-safe', fullscreenAudit.entered ? fullscreenAudit.fullscreenElement === 'HTML' && fullscreenLayoutValid : !!fullscreenAudit.error && fullscreenLayoutValid, JSON.stringify(fullscreenAudit));
	responsiveLayoutEvidence.push({ scenario: 'normal-fullscreen', viewport: { width: 390, height: 844 }, lifecycle: fullscreenAudit.entered ? 'fullscreen' : 'fullscreen-fallback', audit: fullscreenAudit });
	await screenshot(fullscreenPage, fullscreenAudit.entered ? 'mobile-fullscreen-390x844' : 'mobile-fullscreen-fallback-390x844');
	if (fullscreenAudit.entered) await fullscreenPage.evaluate(() => document.exitFullscreen()).catch(() => {});
	await fullscreenContext.close();
}

// ---------------------------------------------------------------------------
// 6. Rules → Buttons & Controls: complete, icons load, readable on mobile
// ---------------------------------------------------------------------------
async function testRules(browser, base) {
	const group = 'rules-e2e';
	const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
	const page = await openPreview(context, base);

	// Every visible interactive control must map to a rules entry.
	const controlMap = {
		'btn-spin': 'spin',
		'btn-auto': 'auto-bet',
		'btn-turbo': 'turbo',
		'btn-bonus': 'bonus-buy',
		'btn-bet-minus': 'bet-minus',
		'btn-bet-plus': 'bet-plus',
		'bet-controls': 'bet-selector',
		'btn-info': 'info-rules',
		'btn-settings': 'settings',
		'btn-menu': 'menu',
		'menu-sound': 'sound-music',
	};
	const audit = await page.evaluate((map) => {
		const ruleKeys = new Set([...document.querySelectorAll('[data-control-key]')].map((el) => el.dataset.controlKey));
		const visibleControls = [...document.querySelectorAll('.controls button, .controls .bet-controls, #menu-sound')]
			.filter((el) => {
				const r = el.getBoundingClientRect();
				return el.id && (r.width > 0 || el.id === 'menu-sound');
			})
			.map((el) => el.id);
		const missing = visibleControls.filter((id) => !map[id] || !ruleKeys.has(map[id]));
		const unmapped = visibleControls.filter((id) => !map[id]);
		return { ruleKeys: [...ruleKeys], visibleControls, missing, unmapped };
	}, controlMap);
	expect(group, 'every visible control has a rules entry', audit.missing.length === 0, `missing: ${audit.missing.join(',') || 'none'} (visible: ${audit.visibleControls.join(',')})`);
	expect(group, 'no visible control is unmapped in QA', audit.unmapped.length === 0, `unmapped: ${audit.unmapped.join(',') || 'none'}`);
	for (const key of ['collect', 'free-spins', 'close-modal', 'sound-music']) {
		expect(group, `rules cover "${key}"`, audit.ruleKeys.includes(key), audit.ruleKeys.join(','));
	}

	// Open the rules modal and validate the section content + icons.
	await page.click('#btn-info');
	await page.waitForFunction(() => document.getElementById('modal-rules')?.classList.contains('open'));
	const section = await page.evaluate(() => {
		const heads = [...document.querySelectorAll('#modal-rules .pt-head')].map((el) => el.textContent.trim());
		const rules = [...document.querySelectorAll('#modal-rules .control-rule')].map((el) => {
			const img = el.querySelector('img');
			return {
				key: el.dataset.controlKey,
				name: el.querySelector('b')?.textContent.trim() || '',
				description: (el.querySelector('div')?.textContent || '').replace(el.querySelector('b')?.textContent || '', '').trim(),
				iconLoaded: !!img && img.complete && img.naturalWidth > 0,
				iconSrc: img?.getAttribute('src') || '',
			};
		});
		return { heads, rules };
	});
	expect(group, 'rules modal has Buttons & Controls section', section.heads.includes('Buttons & Controls'), section.heads.join(' | '));
	expect(group, 'rules list all 14 controls', section.rules.length >= 14, `entries=${section.rules.length}`);
	for (const rule of section.rules) {
		expect(group, `rules entry "${rule.key}" icon loads`, rule.iconLoaded === true, rule.iconSrc);
		const meaningful = rule.name.length >= 3 && rule.description.length >= 20 && !/lorem|todo|tbd|placeholder/i.test(rule.description);
		expect(group, `rules entry "${rule.key}" has real name+description`, meaningful, `${rule.name}: ${rule.description.slice(0, 60)}`);
	}
	await screenshot(page, 'rules-buttons-controls-desktop');
	await page.close();

	// Mobile: the rules dialog must be on-screen, readable and scrollable.
	const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
	const mobilePage = await openPreview(mobileContext, base);
	await mobilePage.click('#btn-info');
	await mobilePage.waitForFunction(() => document.getElementById('modal-rules')?.classList.contains('open'));
	const mobileModal = await mobilePage.evaluate(() => {
		const modal = document.querySelector('#modal-rules .modal').getBoundingClientRect();
		const body = document.querySelector('#modal-rules .modal-body');
		const title = document.querySelector('#modal-rules .modal-title').getBoundingClientRect();
		return {
			onScreen: modal.x >= 0 && modal.y >= 0 && modal.right <= innerWidth && modal.bottom <= innerHeight,
			width: modal.width,
			titleHeightPx: title.height,
			scrollable: body.scrollHeight > body.clientHeight,
		};
	});
	expect(group, 'mobile rules dialog fully on screen', mobileModal.onScreen === true, JSON.stringify(mobileModal));
	expect(group, 'mobile rules dialog readable (native-size text)', mobileModal.titleHeightPx >= 14, `title height=${mobileModal.titleHeightPx}px`);
	expect(group, 'mobile rules dialog scrollable', mobileModal.scrollable === true, '');
	await screenshot(mobilePage, 'rules-buttons-controls-mobile');
	await mobileContext.close();
	await context.close();
}

// ---------------------------------------------------------------------------
// 7. Paytable: generated DOM and browser-exposed values match publish/math
// ---------------------------------------------------------------------------
async function testPaytable(browser, base) {
	const group = 'paytable-e2e';
	const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
	const page = await openPreview(context, base);
	const audit = await page.evaluate(() => ({
		contract: window.__ggrPaytable || null,
		rows: [...document.querySelectorAll('#pt-grid .pt-cell')].map((cell) => ({
			symbol: cell.dataset.paytableSymbol || cell.querySelector('img')?.alt || '',
			text: cell.textContent?.replace(/\s+/g, ' ').trim() || '',
		})),
	}));
	expect(group, 'window.__ggrPaytable is exposed by the generated frontend', !!audit.contract, JSON.stringify(audit.contract));
	const thresholds = [
		{ label: '5+', value: 'cluster5', boost: null },
		{ label: '7+', value: 'cluster7', boost: 'cluster7Boost' },
		{ label: '9+', value: 'cluster9', boost: 'cluster9Boost' },
		{ label: '12+', value: 'cluster12', boost: 'cluster12Boost' },
	];
	const format = (value) => Number(value).toFixed(8).replace(/\.0+$/, '').replace(/(\.\d*?[1-9])0+$/, '$1');
	for (const [symbol, source] of Object.entries(productionMathConfig.paytable || {})) {
		const row = audit.rows.find((item) => item.symbol === symbol);
		expect(group, `${symbol} paying symbol is rendered in Paytable DOM`, !!row, JSON.stringify(audit.rows.map((item) => item.symbol)));
		const runtime = audit.contract?.[symbol];
		expect(group, `${symbol} paying symbol exists in browser contract`, !!runtime, JSON.stringify(runtime));
		for (const threshold of thresholds) {
			const expected = threshold.boost ? Number(source.cluster5) * Number(source[threshold.boost]) : Number(source.cluster5);
			const runtimeValue = Number(runtime?.[threshold.value]);
			expect(group, `${symbol} ${threshold.label} browser value matches publish/math`, Math.round(runtimeValue * 1e8) === Math.round(expected * 1e8), `${runtimeValue} === ${expected}`);
			expect(group, `${symbol} ${threshold.label} formatted value is present in DOM`, !!row && row.text.includes(`${threshold.label} ${format(expected)}`), row?.text || 'missing row');
		}
	}
	expect(group, 'K 5+ DOM value is exactly 0.48x', audit.rows.find((row) => row.symbol === 'k')?.text.includes('5+ 0.48') === true, audit.rows.find((row) => row.symbol === 'k')?.text || '');
	expect(group, 'Q 5+ DOM value is exactly 0.36x', audit.rows.find((row) => row.symbol === 'q')?.text.includes('5+ 0.36') === true, audit.rows.find((row) => row.symbol === 'q')?.text || '');
	expect(group, 'J 7+ DOM value is exactly 0.56x', audit.rows.find((row) => row.symbol === 'j')?.text.includes('7+ 0.56') === true, audit.rows.find((row) => row.symbol === 'j')?.text || '');
	await page.click('#btn-menu');
	await page.waitForFunction(() => document.getElementById('modal-menu')?.classList.contains('open'));
	await page.click('[data-open="modal-paytable"]');
	await page.waitForFunction(() => document.getElementById('modal-paytable')?.classList.contains('open'));
	await page.waitForTimeout(350);
	const shot = await screenshot(page, 'paytable-production-contract-1280x720');
	pass(group, 'actual production Paytable screenshot saved', shot);
	await context.close();

	const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
	const mobilePage = await openPreview(mobileContext, base);
	await mobilePage.click('#btn-menu');
	await mobilePage.click('[data-open="modal-paytable"]');
	await mobilePage.waitForFunction(() => document.getElementById('modal-paytable')?.classList.contains('open'));
	await mobilePage.waitForTimeout(350);
	const mobileScroll = await mobilePage.evaluate(() => {
		const body = document.querySelector('#modal-paytable .modal-body');
		if (!body) return null;
		const before = body.scrollTop;
		body.scrollTop = body.scrollHeight;
		return { before, after: body.scrollTop, max: body.scrollHeight - body.clientHeight, note: document.getElementById('paytable-note')?.textContent?.trim() || '' };
	});
	expect(group, 'mobile Paytable scroll reaches all explanatory content', !!mobileScroll && mobileScroll.max > 0 && mobileScroll.after >= mobileScroll.max - 1 && mobileScroll.note.includes('union of all winning positions'), JSON.stringify(mobileScroll));
	const mobileShot = await screenshot(mobilePage, 'paytable-production-contract-390x844-scrolled');
	pass(group, 'actual mobile Paytable screenshot saved', mobileShot);
	await mobileContext.close();
}

// ---------------------------------------------------------------------------
// 8. Replay: strict read-only Stake replay contract in real Chromium
// ---------------------------------------------------------------------------
async function testReplay(browser, base) {
	const group = 'replay-e2e';
	const productionSource = readFileSync(previewFile, 'utf8');
	expect(group, 'production frontend exposes no window.__ggr gameplay API', !/window\.__ggr\s*=/.test(productionSource) && !/\bdemoWin\b|\bdemoFeature\b/.test(productionSource), 'mutable production API markers absent');
	const symbolNames = { L1: 'a', L2: 'k', L3: 'q', L4: 'j', L5: 'ten', H1: 'football', H2: 'trophy', H3: 'jersey', H4: 'whistle', W: 'wild', S: 'scatter' };
	const boardFingerprint = (board) => Array.from({ length: 5 }, (_, row) =>
		Array.from({ length: 6 }, (_, col) => symbolNames[board[col][row]] || board[col][row]).join('|')).join('|');
	const scenarios = [
		{
			name: 'base',
			mode: 'base',
			round: baseReplayRound,
			expectedWin: '$1.25',
			expectedBoard: boardFingerprint(boardWithColumn('L2')),
			expectedFloats: ['+$0.51', '+$0.74'],
		},
		{
			name: 'bonus',
			mode: 'bonus',
			round: () => withoutPayoutMultiplier(bonusReplayRound()),
			expectedWin: '$1.12',
			expectedBoard: boardFingerprint(boardWithColumn('L1')),
			expectedFloats: ['+$0.63', '+$0.49'],
		},
	];

	for (const scenario of scenarios) {
		for (const viewport of REPLAY_VIEWPORTS) {
			const label = `${scenario.name}-${viewport.name}`;
			const context = await browser.newContext({
				viewport: { width: viewport.width, height: viewport.height },
				isMobile: !!viewport.mobile,
				hasTouch: !!viewport.mobile,
			});
			let releasePending = null;
			const pendingGate = new Promise((resolvePending) => { releasePending = resolvePending; });
			const calls = await mockReplayRgs(context, async () => {
				await pendingGate;
				return { round: scenario.round() };
			});
			const normalProbe = await openPreview(context, base);
			const formerPaidControlPoints = await normalProbe.evaluate(() => ['btn-spin', 'btn-auto', 'btn-bonus', 'btn-bet-minus', 'btn-bet-plus'].map((id) => {
				const rect = document.getElementById(id)?.getBoundingClientRect();
				return rect ? { id, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : { id, x: -1, y: -1 };
			}));
			await normalProbe.close();
			const event = `stake-qa-${label}`;
			const page = await openPreview(context, base, replayQuery({ mode: scenario.mode, event }));

			await waitForReplayState(page, 'loading');
			const loading = await page.evaluate(() => {
					const overlay = document.getElementById('replay-overlay');
					const card = overlay?.querySelector('.replay-overlay-card');
					const action = document.getElementById('replay-action');
					const visible = (el) => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
					const rect = card?.getBoundingClientRect();
					return {
						overlay: visible(overlay), action: visible(action), status: document.getElementById('replay-status')?.textContent?.trim(),
						cardInside: !!rect && rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
						scrollX: document.documentElement.scrollWidth > innerWidth || document.body.scrollWidth > innerWidth,
						scrollY: document.documentElement.scrollHeight > innerHeight || document.body.scrollHeight > innerHeight,
					};
				});
			expect(group, `${label} pending replay GET shows a fully visible loading state`, loading.overlay && !loading.action && loading.cardInside && !loading.scrollX && !loading.scrollY && /load|fetch|replay/i.test(loading.status || ''), JSON.stringify(loading));
			responsiveLayoutEvidence.push({ scenario: scenario.name, viewport, lifecycle: 'loading', audit: loading });
			const loadingShot = await screenshot(page, `replay-${label}-loading`);
			pass(group, `${label} replay loading screenshot saved`, loadingShot);
			releasePending();

			await waitForReplayState(page, 'ready');
			const ready = await replayUiAudit(page);
			responsiveLayoutEvidence.push({ scenario: scenario.name, viewport, lifecycle: 'ready', audit: ready });
			expect(group, `${label} enters dedicated replay mode`, ready.replayClass && ready.state === 'ready', JSON.stringify(ready));
			for (const [control, detail] of Object.entries(ready.normal)) {
				expect(group, `${label} normal ${control} is hidden and non-interactive`, !detail.visible && detail.blocked, JSON.stringify(detail));
			}
			expect(group, `${label} WIN is visible`, ready.winVisible, JSON.stringify(ready));
			expect(group, `${label} Replay Bet is visible and display-only`, ready.betVisible && ready.betDisplayOnly && ready.betLabel === 'REPLAY BET', JSON.stringify(ready));
			expect(group, `${label} replay bet/currency format is $1.00`, `${ready.betCurrency} ${ready.betText}`.includes('$') && `${ready.betCurrency} ${ready.betText}`.includes('1.00'), JSON.stringify(ready));
			expect(group, `${label} dedicated Replay Play control is visible, accessible and hittable at center/edges`, ready.actionVisible && ready.actionHittable && !ready.actionDisabled && ready.actionRole === 'button' && ready.actionText === 'Replay Play' && /Replay Play/i.test(ready.actionAccessibleName), JSON.stringify(ready));
			expect(group, `${label} board and every required replay element are inside viewport and unclipped`, ready.boardVisible && ready.allRequiredInsideViewport && ready.allRequiredUnclipped && ready.panelDescendants.every((item) => item.insideViewport && item.visibleFraction >= 0.9999), JSON.stringify(ready));
			expect(group, `${label} replay panel does not overlap WIN or Replay Bet`, ready.panelOverlapWin === 0 && ready.panelOverlapBet === 0, `winOverlap=${ready.panelOverlapWin} betOverlap=${ready.panelOverlapBet}`);
			expect(group, `${label} replay layout has no page scrollbars and required text remains readable`, !ready.scrollX && !ready.scrollY && ready.textSizes.every((item) => item.size >= 10), JSON.stringify(ready.textSizes));
			const forbiddenTabStops = ['btn-spin', 'btn-auto', 'btn-bonus', 'btn-bet-minus', 'btn-bet-plus'];
			expect(group, `${label} normal paid controls are absent from keyboard navigation`, !ready.tabbableIds.some((id) => forbiddenTabStops.includes(id)), ready.tabbableIds.join(','));
			const coordinateAudit = await page.evaluate((points) => {
				const action = document.getElementById('replay-action');
				return points.map((point) => {
					const hit = document.elementFromPoint(point.x, point.y);
					return {
						...point,
						hit: hit?.id || hit?.className || hit?.tagName || null,
						hitsHiddenPaidControl: !!hit?.closest('#btn-spin,#btn-auto,#btn-bonus,#btn-bet-minus,#btn-bet-plus,#bet-controls'),
						hitsReplayAction: !!hit && (hit === action || action?.contains(hit)),
					};
				});
			}, formerPaidControlPoints);
			expect(group, `${label} former paid-control coordinates cannot hit hidden controls`, coordinateAudit.every((item) => !item.hitsHiddenPaidControl), JSON.stringify(coordinateAudit));
			const signatureBeforeCoordinates = await page.evaluate(() => JSON.stringify(window.__stakeQa.Replay.current?.round || null));
			for (const point of coordinateAudit.filter((item) => !item.hitsReplayAction && item.x >= 0 && item.y >= 0)) {
				await page.mouse.click(point.x, point.y);
				await page.keyboard.press('Escape');
			}
			const afterCoordinates = await page.evaluate(() => ({
				state: document.getElementById('stage')?.dataset.replayState,
				round: JSON.stringify(window.__stakeQa.Replay.current?.round || null),
				win: window.__stakeQa.state.win,
			}));
			expect(group, `${label} former paid-control coordinate clicks cannot mutate replay or call a paid endpoint`, afterCoordinates.state === 'ready' && afterCoordinates.round === signatureBeforeCoordinates && calls.forbidden.length === 0, JSON.stringify(afterCoordinates));
			const mutationAudit = await page.evaluate(async () => {
				const snapshot = () => JSON.stringify({
					state: document.getElementById('stage')?.dataset.replayState,
					grid: window.__stakeQa.state.grid,
					win: window.__stakeQa.state.win,
					balance: window.__stakeQa.state.balance,
					bet: window.__stakeQa.state.bet,
					mode: window.__stakeQa.state.mode,
					round: window.__stakeQa.Replay.current?.round || null,
				});
				const before = snapshot();
				const results = {};
				for (const action of ['spin', 'free-spins', 'bonus-buy', 'auto-play', 'change-bet', 'new-grid', 'resolve-cascades', 'open-paid-modal']) {
					try { results[action] = await window.__stakeQa.invokeInternalAction(action); } catch (error) { results[action] = { error: error?.message || String(error) }; }
				}
				return { before, after: snapshot(), results, productionApiType: typeof window.__ggr };
			});
			expect(group, `${label} every instrumented mutation entry point is read-only in replay`, mutationAudit.before === mutationAudit.after && mutationAudit.productionApiType === 'undefined' && calls.forbidden.length === 0, JSON.stringify(mutationAudit));

			const expectedPath = `/bet/replay/golden-goal-rush/1/${scenario.mode}/${event}`;
			expect(group, `${label} sends exactly one replay GET to supplied RGS path`, calls.replay.length === 1 && calls.replay[0].method === 'GET' && calls.replay[0].origin === `https://${RGS_HOST}` && calls.replay[0].path === expectedPath, JSON.stringify(calls.replay));
			expect(group, `${label} replay GET carries language aliases`, calls.replay[0]?.search.language === 'en' && calls.replay[0]?.search.lang === 'en', JSON.stringify(calls.replay));
			expect(group, `${label} has zero forbidden wallet/session/event requests`, calls.forbidden.length === 0, JSON.stringify(calls.forbidden));

			await page.evaluate(() => document.activeElement?.blur());
			await page.keyboard.press('Space');
			await page.keyboard.press('Enter');
			await page.waitForTimeout(150);
			const beforePlay = await page.evaluate(() => ({
				state: document.getElementById('stage')?.dataset.replayState,
				spinning: window.__stakeQa.state.spinning,
				round: JSON.stringify(window.__stakeQa.Replay.current?.round || null),
			}));
			expect(group, `${label} Space/Enter do not start normal or replay play`, beforePlay.state === 'ready' && beforePlay.spinning === false && calls.replay.length === 1 && calls.forbidden.length === 0, JSON.stringify(beforePlay));

			await installReplayObserver(page);
			await page.evaluate(() => { window.__stakeQa.setTurbo(true); });
			const activateReplayAction = async (method) => {
				let focus = null;
				if (method === 'Space' || method === 'Enter') {
					await page.focus('#replay-action');
					focus = await page.evaluate(() => {
						const action = document.getElementById('replay-action');
						const style = getComputedStyle(action);
						return {
							focused: document.activeElement === action,
							role: action?.getAttribute('role') || action?.tagName?.toLowerCase(),
							name: action?.getAttribute('aria-label') || action?.textContent?.trim() || '',
							disabled: !!action?.disabled,
							outlineStyle: style.outlineStyle,
							outlineWidth: Number.parseFloat(style.outlineWidth),
						};
					});
					await page.keyboard.press(method);
				} else if (method === 'touch') {
					await page.tap('#replay-action');
				} else {
					await page.click('#replay-action');
				}
				if (focus) {
					accessibilityEvidence.push({ scenario: scenario.name, viewport, lifecycle: await page.evaluate(() => document.getElementById('stage')?.dataset.replayState), activation: method, ...focus });
					expect(group, `${label} focused ${method} activation has role, name, enabled state and visible focus`, focus.focused && focus.role === 'button' && /Replay|Play Again/i.test(focus.name) && !focus.disabled && focus.outlineStyle !== 'none' && focus.outlineWidth >= 2, JSON.stringify(focus));
				}
			};
			const validateRunningLayout = async (cycle) => {
				const audit = await replayUiAudit(page);
				responsiveLayoutEvidence.push({ scenario: scenario.name, viewport, lifecycle: 'running', cycle, audit });
				expect(group, `${label} running cycle ${cycle} keeps the full replay panel inside, unclipped and non-overlapping`, audit.state === 'running' && audit.allRequiredInsideViewport && audit.allRequiredUnclipped && audit.panelDescendants.every((item) => item.insideViewport && item.visibleFraction >= 0.9999) && audit.panelOverlapWin === 0 && audit.panelOverlapBet === 0 && !audit.scrollX && !audit.scrollY, JSON.stringify(audit));
				return audit;
			};
			const readyShot = await screenshot(page, `replay-${label}-ready`);
			pass(group, `${label} ready screenshot saved`, readyShot);
			await resetReplayEvidence(page);
			const initialActivation = scenario.name === 'base' && viewport.width === 1280
				? 'Space'
				: scenario.name === 'bonus' && viewport.width === 1280 ? 'Enter' : viewport.mobile ? 'touch' : 'pointer';
			await activateReplayAction(initialActivation);
			await waitForReplayState(page, 'running');
			await validateRunningLayout(0);
			const runningShot = await screenshot(page, `replay-${label}-running`);
			pass(group, `${label} running screenshot saved`, runningShot);
			const overlayDriver = scenario.name === 'bonus' ? driveReplayOverlays(page) : Promise.resolve();
			await waitForReplayState(page, 'completed', 60_000);
			await overlayDriver;
			const firstEvidence = await replayEvidence(page);
			const firstComplete = await replayUiAudit(page);
			responsiveLayoutEvidence.push({ scenario: scenario.name, viewport, lifecycle: 'completed', cycle: 0, audit: firstComplete });
			const firstRound = await page.evaluate(() => JSON.stringify(window.__stakeQa.Replay.current?.round || null));
			expect(group, `${label} rendered the saved replay board`, firstEvidence.boards.includes(scenario.expectedBoard), JSON.stringify(firstEvidence.boards));
			expect(group, `${label} ${initialActivation} activates Replay Play exactly once`, firstEvidence.actionClicks === 1, JSON.stringify(firstEvidence));
			expect(group, `${label} highlighted all authoritative winning cells`, columnPositions(0).every(({ col, row }) => firstEvidence.winCells.includes(`${col},${row}`)), JSON.stringify(firstEvidence.winCells));
			for (const amount of scenario.expectedFloats) {
				expect(group, `${label} popup uses authoritative RGS amount ${amount}`, firstEvidence.floats.includes(amount), JSON.stringify(firstEvidence.floats));
			}
			expect(group, `${label} completed with authoritative final WIN`, firstComplete.winText === scenario.expectedWin, JSON.stringify(firstComplete));
			expect(group, `${label} completed state exposes an accessible, fully visible Play Again`, firstComplete.actionVisible && firstComplete.actionText === 'Play Again' && /Play Again/i.test(firstComplete.actionAccessibleName) && firstComplete.actionHittable && firstComplete.allRequiredInsideViewport && firstComplete.allRequiredUnclipped && firstComplete.panelOverlapWin === 0 && firstComplete.panelOverlapBet === 0, JSON.stringify(firstComplete));
			expect(group, `${label} replay remained read-only through completion`, calls.replay.length === 1 && calls.forbidden.length === 0, JSON.stringify(calls));
			const completedShot = await screenshot(page, `replay-${label}-completed`);
			pass(group, `${label} completed screenshot saved`, completedShot);

			const replayAgainActivations = ['Space', 'Enter', viewport.mobile ? 'touch' : 'pointer'];
			for (let cycle = 1; cycle <= replayAgainActivations.length; cycle += 1) {
				await resetReplayEvidence(page);
				await activateReplayAction(replayAgainActivations[cycle - 1]);
				await waitForReplayState(page, 'running');
				await validateRunningLayout(cycle);
				const replayAgainDriver = scenario.name === 'bonus' ? driveReplayOverlays(page) : Promise.resolve();
				await waitForReplayState(page, 'completed', 60_000);
				await replayAgainDriver;
				const cycleEvidence = await replayEvidence(page);
				const cycleComplete = await replayUiAudit(page);
				responsiveLayoutEvidence.push({ scenario: scenario.name, viewport, lifecycle: 'completed', cycle, audit: cycleComplete });
				const cycleRound = await page.evaluate(() => JSON.stringify(window.__stakeQa.Replay.current?.round || null));
				expect(group, `${label} Play Again cycle ${cycle} renders the same saved board`, cycleEvidence.boards.includes(scenario.expectedBoard), JSON.stringify(cycleEvidence.boards));
				expect(group, `${label} ${replayAgainActivations[cycle - 1]} activates Play Again cycle ${cycle} exactly once`, cycleEvidence.actionClicks === 1, JSON.stringify(cycleEvidence));
				expect(group, `${label} Play Again cycle ${cycle} preserves the cached round byte-for-byte`, firstRound === beforePlay.round && cycleRound === beforePlay.round, `before=${beforePlay.round} first=${firstRound} cycle=${cycleRound}`);
				expect(group, `${label} Play Again cycle ${cycle} does not accumulate WIN`, cycleComplete.winText === scenario.expectedWin, JSON.stringify(cycleComplete));
				expect(group, `${label} Play Again cycle ${cycle} uses no refetch or forbidden call`, calls.replay.length === 1 && calls.forbidden.length === 0, JSON.stringify(calls));
				expect(group, `${label} Play Again cycle ${cycle} remains in replay and fully visible`, cycleComplete.replayClass && cycleComplete.state === 'completed' && !cycleComplete.normal.spin.visible && cycleComplete.allRequiredInsideViewport && cycleComplete.allRequiredUnclipped && cycleComplete.panelOverlapWin === 0 && cycleComplete.panelOverlapBet === 0, JSON.stringify(cycleComplete));
			}
			replayNetworkEvidence.push({ scenario: scenario.name, viewport: viewport.name, replayRequests: calls.replay, forbiddenRequests: calls.forbidden });
			await context.close();
		}
	}

	// Stable Stake payout evidence: capture the authoritative float and every
	// highlighted coordinate while the saved win is visibly held on screen.
	const jSeven = [...columnPositions(0), { col: 1, row: 0 }, { col: 1, row: 1 }];
	const jWildSeven = [...columnPositions(0), { col: 1, row: 0 }, { col: 1, row: 1, symbol: 'W' }];
	const stakeCases = [
		{ name: 'k5', symbol: 'L2', positions: columnPositions(0), bookUnits: 48, expected: '$0.48' },
		{ name: 'q5', symbol: 'L3', positions: columnPositions(0), bookUnits: 36, expected: '$0.36' },
		{ name: 'j7', symbol: 'L4', positions: jSeven, bookUnits: 56, expected: '$0.56' },
		{ name: 'j6-wild', symbol: 'L4', positions: jWildSeven, bookUnits: 56, expected: '$0.56' },
	];
	for (const stakeCase of stakeCases) {
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		const calls = await mockReplayRgs(context, () => ({ round: authoritativeClusterReplayRound(stakeCase) }));
		const page = await openPreview(context, base, replayQuery({ event: `stake-qa-${stakeCase.name}` }));
		await waitForReplayState(page, 'ready');
		await page.click('#replay-action');
		await waitForReplayState(page, 'running');
		await page.waitForFunction(({ expectedCount, expectedFloat }) => {
			const float = [...document.querySelectorAll('.cluster-float')].find((item) => item.textContent?.includes(expectedFloat));
			return document.querySelectorAll('#board .cell.win').length === expectedCount && !!float;
		}, { expectedCount: stakeCase.positions.length, expectedFloat: stakeCase.expected }, { timeout: 20_000 });
		const visual = await page.evaluate(() => ({
			winCells: [...document.querySelectorAll('#board .cell.win')].map((cell) => [...cell.parentElement.children].indexOf(cell)),
			float: [...document.querySelectorAll('.cluster-float')].map((item) => item.textContent?.trim() || ''),
			winMeter: document.getElementById('meter-win')?.textContent?.trim(),
			wildCount: [...document.querySelectorAll('#board .cell > img')].filter((img) => img.alt === 'wild').length,
		}));
		expect(group, `${stakeCase.name} stable frame shows every authoritative position and exact float`, visual.winCells.length === stakeCase.positions.length && visual.float.some((item) => item.includes(stakeCase.expected)), JSON.stringify(visual));
		if (stakeCase.name === 'j6-wild') expect(group, 'J6 + connected Wild stable frame visibly contains the Wild', visual.wildCount >= 1, JSON.stringify(visual));
		const frame = await screenshot(page, `stake-case-${stakeCase.name}-highlighted`);
		pass(group, `${stakeCase.name} highlighted screenshot saved`, frame);
		await waitForReplayState(page, 'completed', 30_000);
		const complete = await replayUiAudit(page);
		expect(group, `${stakeCase.name} completed WIN is authoritative`, complete.winText === stakeCase.expected, JSON.stringify(complete));
		expect(group, `${stakeCase.name} makes one replay GET and no forbidden call`, calls.replay.length === 1 && calls.forbidden.length === 0, JSON.stringify(calls));
		const completeFrame = await screenshot(page, `stake-case-${stakeCase.name}-completed`);
		pass(group, `${stakeCase.name} completed screenshot saved`, completeFrame);
		replayNetworkEvidence.push({ scenario: `stake-${stakeCase.name}`, viewport: 'desktop-1280x720', replayRequests: calls.replay, forbiddenRequests: calls.forbidden });
		await context.close();
	}

	// Unit boundaries are interpreted by schema: payout/funding amounts are API
	// micro-units, while book wins and payoutMultiplier are integer hundredths.
	const boundaryBookUnits = [0, 1, 99, 100, 999, 1000, 1001, 125000, Math.round(Number(productionMathConfig.maxWinMultiplier || 10000) * 100)];
	for (const bookUnits of boundaryBookUnits) {
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		const calls = await mockReplayRgs(context, () => ({ round: amountBoundaryReplayRound(bookUnits) }));
		const page = await openPreview(context, base, replayQuery({ event: `stake-qa-unit-${bookUnits}` }));
		await waitForReplayState(page, 'ready');
		const normalized = await page.evaluate(() => ({
			state: document.getElementById('stage')?.dataset.replayState,
			totalWin: window.__stakeQa.Replay.current?.meta?.totalWin,
			payoutMultiplier: window.__stakeQa.Replay.current?.meta?.payoutMultiplier,
			winText: document.getElementById('meter-win')?.textContent?.trim(),
		}));
		const expectedWin = bookUnits / 100;
		expect(group, `book-unit boundary ${bookUnits} normalizes exactly once`, normalized.state === 'ready' && Math.abs(normalized.totalWin - expectedWin) <= 0.000001 && Math.abs(normalized.payoutMultiplier - expectedWin) <= 0.000001 && calls.replay.length === 1 && calls.forbidden.length === 0, JSON.stringify(normalized));
		replayValidationEvidence.push({ case: `unit-${bookUnits}`, expected: 'ready', actual: normalized, replayRequests: calls.replay.length, forbiddenRequests: calls.forbidden.length });
		await context.close();
	}

	const payoutMultiplierVariants = [
		{ name: 'bonus-without-payout-multiplier', mode: 'bonus', round: () => withoutPayoutMultiplier(bonusReplayRound()), expectedWin: '$1.12', expectedMultiplier: 1.12 },
		{ name: 'bonus-tier1-null-payout-multiplier', mode: 'bonus_tier1', round: () => ({ ...bonusTier1ReplayRound(), payoutMultiplier: null }), expectedWin: '$1.12', expectedMultiplier: 1.12 },
		{ name: 'rainbow-with-payout-multiplier', mode: 'rainbow', round: rainbowReplayRound, expectedWin: '$0.48', expectedMultiplier: 0.48 },
	];
	for (const variant of payoutMultiplierVariants) {
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		const calls = await mockReplayRgs(context, () => ({ round: variant.round() }));
		const page = await openPreview(context, base, replayQuery({ mode: variant.mode, event: `stake-qa-${variant.name}` }));
		await waitForReplayState(page, 'ready');
		const ready = await page.evaluate(() => ({
			state: document.getElementById('stage')?.dataset.replayState,
			winText: document.getElementById('meter-win')?.textContent?.trim(),
			totalWin: window.__stakeQa.Replay.current?.meta?.totalWin,
			payoutMultiplier: window.__stakeQa.Replay.current?.meta?.payoutMultiplier,
			actionText: document.getElementById('replay-action')?.textContent?.trim(),
		}));
		expect(group, `${variant.name} reconstructs replay payout multiplier from finalWin when needed`, ready.state === 'ready' && ready.actionText === 'Replay Play' && Math.abs(ready.totalWin - variant.expectedMultiplier) <= 0.000001 && Math.abs(ready.payoutMultiplier - variant.expectedMultiplier) <= 0.000001, JSON.stringify(ready));
		await page.click('#replay-action');
		await waitForReplayState(page, 'completed', 30_000);
		const complete = await replayUiAudit(page);
		expect(group, `${variant.name} completes with authoritative replay win`, complete.winText === variant.expectedWin, JSON.stringify(complete));
		expect(group, `${variant.name} makes one replay GET and no forbidden call`, calls.replay.length === 1 && calls.forbidden.length === 0, JSON.stringify(calls));
		const frame = await screenshot(page, `replay-${variant.name}-completed`);
		pass(group, `${variant.name} completed screenshot saved`, frame);
		replayNetworkEvidence.push({ scenario: variant.name, viewport: 'desktop-1280x720', replayRequests: calls.replay, forbiddenRequests: calls.forbidden });
		replayValidationEvidence.push({ case: variant.name, expected: 'completed', actual: complete, replayRequests: calls.replay.length, forbiddenRequests: calls.forbidden.length });
		await context.close();
	}

	// Stake.us currencies remain formatted via the shared currency metadata.
	const socialContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
	const socialCalls = await mockReplayRgs(socialContext, () => ({ round: { ...baseReplayRound(), currency: 'XSC' } }));
	const socialPage = await openPreview(socialContext, base, replayQuery({ mode: 'base', event: 'stake-qa-social-replay', currency: 'XSC', extra: '&social=true' }));
	await waitForReplayState(socialPage, 'ready');
	const socialReady = await replayUiAudit(socialPage);
	expect(group, 'Stake.us replay displays XSC as SC', `${socialReady.betCurrency} ${socialReady.betText}`.includes('SC') && `${socialReady.betCurrency} ${socialReady.betText}`.includes('1.00'), JSON.stringify(socialReady));
	expect(group, 'Stake.us replay remains read-only', socialCalls.replay.length === 1 && socialCalls.forbidden.length === 0, JSON.stringify(socialCalls));
	replayNetworkEvidence.push({ scenario: 'social-xsc', viewport: 'desktop-1280x720', replayRequests: socialCalls.replay, forbiddenRequests: socialCalls.forbidden });
	const socialShot = await screenshot(socialPage, 'replay-social-xsc-ready-1280x720');
	pass(group, 'Stake.us replay screenshot saved', socialShot);
	await socialContext.close();

	// Error matrix: transport errors, malformed/empty payloads and invalid round
	// contracts must remain replay-specific failures with no local demo fallback.
	const errorCases = [
		...([400, 401, 403, 404, 500].map((status) => ({
			name: `http-${status}`,
			response: () => ({ response: { status, body: { error: { message: `Replay HTTP ${status}` } } } }),
		}))),
		{ name: 'invalid-json', response: () => ({ response: { status: 200, body: '{not-json' } }) },
		{ name: 'empty-replay', response: () => ({}) },
		{
			name: 'unsupported-event',
			response: () => ({ round: { ...baseReplayRound(), state: [{ index: 0, type: 'reveal', board: quietBoard(), gameType: 'basegame' }, { index: 1, type: 'unsupportedStakeEvent' }] } }),
		},
		{
			name: 'missing-reveal-board',
			response: () => ({ round: { ...baseReplayRound(), state: [{ index: 0, type: 'reveal' }, { index: 1, type: 'finalWin', amount: 125 }] } }),
		},
		{
			name: 'mismatched-round',
			response: () => ({ round: { ...baseReplayRound(), game: 'wrong-game', version: '9', mode: 'bonus' } }),
		},
		{
			name: 'negative-event-win',
			response: () => { const round = baseReplayRound(); round.state[1].wins[0].win = -1; round.state[1].totalWin = -1; return { round }; },
		},
		{
			name: 'negative-final-win',
			response: () => { const round = baseReplayRound(); round.state.at(-1).amount = -100; return { round }; },
		},
		{
			name: 'nan-event-win',
			response: () => { const round = baseReplayRound(); round.state[1].wins[0].win = 'NaN'; return { round }; },
		},
		{
			name: 'infinite-final-win',
			response: () => { const round = baseReplayRound(); round.state.at(-1).amount = 'Infinity'; return { round }; },
		},
		{
			name: 'non-number-payout-multiplier',
			response: () => ({ round: { ...baseReplayRound(), payoutMultiplier: '125' } }),
		},
		{
			name: 'negative-payout-multiplier',
			response: () => ({ round: { ...baseReplayRound(), payoutMultiplier: -125 } }),
		},
		{
			name: 'inconsistent-payout-multiplier',
			response: () => ({ round: { ...baseReplayRound(), payoutMultiplier: 124 } }),
		},
		{
			name: 'inconsistent-explicit-payout',
			response: () => ({ round: { ...baseReplayRound(), payout: 124 * API / 100 } }),
		},
		{
			name: 'inconsistent-running-total',
			response: () => { const round = baseReplayRound(); round.state[1].runningTotalWin = 52; return { round }; },
		},
		{
			name: 'inconsistent-final-cumulative',
			response: () => { const round = baseReplayRound(); round.state.at(-1).amount = 124; round.payoutMultiplier = 124; round.payout = 1.24 * API; return { round }; },
		},
		{
			name: 'duplicate-winning-position',
			response: () => { const round = baseReplayRound(); round.state[1].wins[0].positions.push({ ...round.state[1].wins[0].positions[0] }); return { round }; },
		},
		{
			name: 'response-amount-mismatch',
			response: () => ({ round: { ...baseReplayRound(), amount: 2 * API } }),
		},
		{
			name: 'response-currency-mismatch',
			response: () => ({ round: { ...baseReplayRound(), currency: 'EUR' } }),
		},
		{
			name: 'negative-cost-multiplier',
			response: () => ({ round: { ...baseReplayRound(), costMultiplier: -1 } }),
		},
		{
			name: 'above-max-win',
			response: () => ({ round: amountBoundaryReplayRound(Math.round(Number(productionMathConfig.maxWinMultiplier) * 100) + 1) }),
		},
	];
	for (const errorCase of errorCases) {
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		const calls = await mockReplayRgs(context, errorCase.response);
		const page = await openPreview(context, base, replayQuery({ mode: 'base', event: `stake-qa-${errorCase.name}` }));
		await page.waitForFunction(() => ['ready', 'error'].includes(document.getElementById('stage')?.dataset.replayState), null, { timeout: 25_000 });
		if (await page.evaluate(() => document.getElementById('stage')?.dataset.replayState === 'ready')) {
			await page.click('#replay-action');
			await page.waitForFunction(() => ['completed', 'error'].includes(document.getElementById('stage')?.dataset.replayState), null, { timeout: 25_000 });
		}
		const errorAudit = await page.evaluate(() => {
			const action = document.getElementById('replay-action');
			const visible = (el) => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().width > 0;
			return {
				state: document.getElementById('stage')?.dataset.replayState,
				status: document.getElementById('replay-status')?.textContent?.trim(),
				overlay: visible(document.getElementById('replay-overlay')),
				action: visible(action),
				current: window.__stakeQa.Replay.current,
				win: window.__stakeQa.state.win,
				floats: document.querySelectorAll('.cluster-float').length,
			};
		});
		expect(group, `${errorCase.name} shows replay-specific error state`, errorAudit.state === 'error' && errorAudit.overlay && /replay|invalid|missing|unavailable|failed|error/i.test(errorAudit.status || ''), JSON.stringify(errorAudit));
		expect(group, `${errorCase.name} cannot start or fall back to demo output`, !errorAudit.action && !errorAudit.current && Number(errorAudit.win) === 0 && errorAudit.floats === 0, JSON.stringify(errorAudit));
		expect(group, `${errorCase.name} produces zero forbidden calls`, calls.forbidden.length === 0, JSON.stringify(calls));
		replayValidationEvidence.push({ case: errorCase.name, expected: 'error', actual: errorAudit, replayRequests: calls.replay.length, forbiddenRequests: calls.forbidden.length });
		replayNetworkEvidence.push({ scenario: `error-${errorCase.name}`, viewport: 'desktop-1280x720', replayRequests: calls.replay, forbiddenRequests: calls.forbidden });
		if (errorCase.name === 'invalid-json') {
			const errorShot = await screenshot(page, 'replay-error-invalid-json-1280x720');
			pass(group, 'replay-specific error screenshot saved', errorShot);
		}
		await context.close();
	}

	const launchParams = () => new URLSearchParams({
		replay: 'true', rgs_url: `https://${RGS_HOST}`, game: 'golden-goal-rush', version: '1', mode: 'base', event: 'stake-qa-launch',
		amount: String(API), currency: 'USD', lang: 'en', device: 'desktop',
	});
	const launchCases = [
		...['rgs_url', 'game', 'version', 'mode', 'event', 'amount', 'currency', 'lang', 'device'].map((field) => ({ name: `missing-${field}`, mutate: (params) => params.delete(field) })),
		{ name: 'zero-amount', mutate: (params) => params.set('amount', '0') },
		{ name: 'fractional-api-amount', mutate: (params) => params.set('amount', '1.5') },
		{ name: 'invalid-currency', mutate: (params) => params.set('currency', 'US$') },
		{ name: 'invalid-language', mutate: (params) => params.set('lang', 'english') },
		{ name: 'invalid-device', mutate: (params) => params.set('device', 'watch') },
		{ name: 'invalid-mode', mutate: (params) => params.set('mode', 'unknown') },
		{ name: 'credentialed-rgs-url', mutate: (params) => params.set('rgs_url', `https://user:pass@${RGS_HOST}`) },
	];
	for (const launchCase of launchCases) {
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		const calls = await mockReplayRgs(context, () => ({ round: baseReplayRound() }));
		const params = launchParams();
		launchCase.mutate(params);
		const page = await openPreview(context, base, `?${params.toString()}`);
		await page.waitForFunction(() => ['ready', 'error'].includes(document.getElementById('stage')?.dataset.replayState), null, { timeout: 20_000 });
		const audit = await pageSafeReplayError(page);
		expect(group, `${launchCase.name} produces a replay-specific error before network`, audit.state === 'error' && /replay|missing|invalid|malformed/i.test(audit.status || '') && !audit.current && Number(audit.win) === 0 && calls.replay.length === 0 && calls.forbidden.length === 0, JSON.stringify({ audit, calls }));
		replayValidationEvidence.push({ case: launchCase.name, expected: 'error-before-network', actual: audit, replayRequests: calls.replay.length, forbiddenRequests: calls.forbidden.length });
		await context.close();
	}
}

// ---------------------------------------------------------------------------
// 9. Normal RGS round-state matrix: active controls settlement, never win/loss
// ---------------------------------------------------------------------------
async function testRgsRoundStates(browser, base) {
	const group = 'rgs-round-states-e2e';
	const localMathContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
	const localMathPage = await openPreview(localMathContext, base);
	const localWildBoard = Array.from({ length: 6 }, () => Array(5).fill('scatter'));
	localWildBoard[0][0] = 'ten';
	localWildBoard[0][1] = 'wild';
	localWildBoard[1][1] = 'q';
	localWildBoard[1][2] = 'q';
	localWildBoard[2][1] = 'q';
	localWildBoard[2][2] = 'q';
	const localClusters = await localMathPage.evaluate((grid) => window.__stakeQa.auditLocalClusters(grid), localWildBoard);
	const qCluster = localClusters.find((cluster) => cluster.key === 'q');
	expect(group, 'local non-RGS cluster helper matches production Wild semantics', !!qCluster && qCluster.cells.length === 5 && new Set(qCluster.cells.map((cell) => cell.join(','))).size === 5, JSON.stringify(localClusters));
	await localMathContext.close();
	const normalRound = ({ active, bookUnits }) => ({
		active,
		mode: 'base',
		amount: API,
		payout: Math.round(API * bookUnits / 100),
		payoutMultiplier: bookUnits,
		state: bookUnits > 0
			? authoritativeClusterReplayRound({ symbol: 'L2', positions: columnPositions(0), bookUnits }).state
			: amountBoundaryReplayRound(0).state,
	});
	for (const active of [true, false]) {
		for (const bookUnits of [0, 48]) {
			const name = `${active ? 'active' : 'inactive'}-${bookUnits ? 'win' : 'loss'}`;
			const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
			const calls = await mockRgs(context, {
				authenticate: () => ({ balance: balanceOf(1000, 'USD'), round: null }),
				play: () => ({ balance: balanceOf(active ? 999 : 999 + bookUnits / 100, 'USD'), round: normalRound({ active, bookUnits }) }),
				endRound: () => ({ balance: balanceOf(999 + bookUnits / 100, 'USD'), round: { ...normalRound({ active: false, bookUnits }), state: undefined } }),
			});
			const page = await openPreview(context, base, rgsQuery('USD'));
			await page.waitForFunction(() => window.__stakeQa.state.walletBusy === false);
			await page.evaluate(() => window.__stakeQa.setTurbo(true));
			await page.click('#btn-spin');
			await page.waitForFunction(() => window.__stakeQa.state.spinning === false && window.__stakeQa.state.walletBusy === false, null, { timeout: 45_000 });
			const state = await gameState(page);
			const winText = await meterText(page, 'meter-win');
			expect(group, `${name} sends exactly one wallet play`, calls.play.length === 1, JSON.stringify(calls));
			expect(group, `${name} end-round count follows round.active only`, calls.endRound.length === (active ? 1 : 0), JSON.stringify(calls));
			expect(group, `${name} displays only the authoritative payout`, Math.abs(state.win - bookUnits / 100) <= 0.000001 && winText === `$${(bookUnits / 100).toFixed(2)}`, JSON.stringify({ state, winText }));
			expect(group, `${name} applies the authoritative settled balance`, Math.abs(state.balance - (999 + bookUnits / 100)) <= 0.000001, JSON.stringify(state));
			await context.close();
		}
	}

	const spaceContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
	const spaceCalls = await mockRgs(spaceContext, {
		authenticate: () => ({ balance: balanceOf(1000, 'USD'), round: null }),
		play: () => ({ balance: balanceOf(999, 'USD'), round: normalRound({ active: false, bookUnits: 0 }) }),
	});
	const spacePage = await openPreview(spaceContext, base, rgsQuery('USD'));
	await spacePage.waitForFunction(() => window.__stakeQa.state.walletBusy === false);
	await spacePage.evaluate(() => { document.body.tabIndex = -1; document.body.focus(); });
	await spacePage.keyboard.press('Space');
	await spacePage.waitForFunction(() => window.__stakeQa.state.spinning === false && window.__stakeQa.state.walletBusy === false && window.__stakeQa.state.win === 0, null, { timeout: 45_000 });
	expect(group, 'normal non-interactive Space starts exactly one normal wallet spin', spaceCalls.play.length === 1 && spaceCalls.endRound.length === 0, JSON.stringify(spaceCalls));
	await spaceContext.close();

	const spamContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
	const spamCalls = await mockRgs(spamContext, {
		authenticate: () => ({ balance: balanceOf(1000, 'USD'), round: null }),
		play: async () => { await new Promise((resolveDelay) => setTimeout(resolveDelay, 250)); return { balance: balanceOf(999, 'USD'), round: normalRound({ active: false, bookUnits: 0 }) }; },
	});
	const spamPage = await openPreview(spamContext, base, rgsQuery('USD'));
	await spamPage.waitForFunction(() => window.__stakeQa.state.walletBusy === false);
	await spamPage.evaluate(() => { for (let index = 0; index < 12; index += 1) document.getElementById('btn-spin')?.click(); });
	await spamPage.waitForFunction(() => window.__stakeQa.state.spinning === false && window.__stakeQa.state.walletBusy === false, null, { timeout: 45_000 });
	expect(group, 'duplicate/spam clicks produce exactly one wallet play and no duplicate settlement', spamCalls.play.length === 1 && spamCalls.endRound.length === 0, JSON.stringify(spamCalls));
	await spamContext.close();

	const unsupportedContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
	const unsupportedCalls = await mockRgs(unsupportedContext, {
		authenticate: () => ({ balance: balanceOf(1000, 'USD'), round: null }),
		play: () => ({
			balance: balanceOf(999, 'USD'),
			round: { ...normalRound({ active: false, bookUnits: 0 }), state: [{ index: 0, type: 'reveal', board: quietBoard(), gameType: 'basegame' }, { index: 1, type: 'unsupportedStakeEvent' }] },
		}),
	});
	const unsupportedPage = await openPreview(unsupportedContext, base, rgsQuery('USD'));
	await unsupportedPage.waitForFunction(() => window.__stakeQa.state.walletBusy === false);
	await unsupportedPage.click('#btn-spin');
	await unsupportedPage.waitForFunction(() => document.getElementById('fatal-error')?.classList.contains('show'), null, { timeout: 20_000 });
	const unsupported = await unsupportedPage.evaluate(() => ({
		title: document.querySelector('#fatal-error .fatal-error-title')?.textContent?.trim(),
		detail: document.querySelector('#fatal-error .fatal-error-detail')?.textContent?.trim(),
		state: { fatal: window.__stakeQa.state.fatal, spinning: window.__stakeQa.state.spinning, win: window.__stakeQa.state.win },
	}));
	expect(group, 'unsupported normal RGS event state fails visibly with no local/random fallback', unsupported.state.fatal && !unsupported.state.spinning && unsupported.state.win === 0 && /Unsupported Stake Engine round/i.test(unsupported.title || '') && /No local fallback/i.test(unsupported.detail || '') && unsupportedCalls.play.length === 1, JSON.stringify(unsupported));
	await unsupportedContext.close();
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
async function main() {
	if (!existsSync(previewFile)) {
		console.error('preview.html is missing — run: node apps/cluster/scripts/build-preview-html.mjs');
		process.exit(1);
	}
	const playwright = resolvePlaywright();
	if (!playwright) {
		console.error('SKIP stake-qa-e2e: Playwright is not installed (npm i -D playwright, or set STAKE_QA_PLAYWRIGHT_DIR).');
		process.exit(3);
	}
	let browser;
	let browserVersion = '';
	try {
		browser = await launchChromium(playwright);
		browserVersion = browser.version();
	} catch (error) {
		console.error(`SKIP stake-qa-e2e: Chromium could not be launched (${error?.message}). Run: npx playwright install chromium`);
		process.exit(3);
	}
	const { server, base } = await startStaticServer();
	// A crash in one group (e.g. a Playwright timeout) must surface as a FAIL
	// in the report, not abort the whole suite without a report.
	const guarded = async (name, testFn) => {
		if (!wants(name)) return;
		try {
			await testFn(browser, base);
		} catch (error) {
			fail(`${name}-e2e`, 'test group completed', `${error?.name || 'Error'}: ${(error?.message || '').split('\n')[0]}`);
		}
	};
	try {
		await guarded('currency', testCurrency);
		await guarded('bet-config', testBetConfig);
		await guarded('social', testSocialWording);
		await guarded('insufficient-funds', testInsufficientFunds);
		await guarded('major-actions', testMajorActions);
		await guarded('interrupted-round', testInterruptedRound);
		await guarded('mobile', testMobile);
		await guarded('rules', testRules);
		await guarded('paytable', testPaytable);
		await guarded('replay', testReplay);
		await guarded('rgs-round-states', testRgsRoundStates);
	} finally {
		await browser.close().catch(() => {});
		server.close();
	}

	mkdirSync(artifactRoot, { recursive: true });
	const summary = {
		pass: checks.filter((check) => check.status === 'PASS').length,
		fail: checks.filter((check) => check.status === 'FAIL').length,
	};
	writeFileSync(join(artifactRoot, 'e2e-report.json'), JSON.stringify({
		mode,
		target: relative(root, previewFile).replaceAll('\\', '/'),
		frontendRoot: relative(root, frontendRoot).replaceAll('\\', '/'),
		mathConfig: relative(root, publishedMathFile).replaceAll('\\', '/'),
		browser: browserVersion,
		summary,
		checks,
	}, null, 2));
	writeFileSync(join(artifactRoot, 'replay-validation-cases.json'), JSON.stringify({
		target: relative(root, previewFile).replaceAll('\\', '/'),
		mathConfig: relative(root, publishedMathFile).replaceAll('\\', '/'),
		summary: {
			cases: replayValidationEvidence.length,
			failedChecks: checks.filter((check) => check.status === 'FAIL' && /replay|unit|currency|payout|win/i.test(check.name)).length,
		},
		cases: replayValidationEvidence,
	}, null, 2));
	writeFileSync(join(artifactRoot, 'responsive-layout-report.json'), JSON.stringify({
		target: relative(root, previewFile).replaceAll('\\', '/'),
		browser: browserVersion,
		requiredViewports: REPLAY_VIEWPORTS,
		summary: {
			observations: responsiveLayoutEvidence.length,
			clippedObservations: responsiveLayoutEvidence.filter((item) => item.audit?.allRequiredUnclipped === false || item.audit?.cardInside === false).length,
		},
		observations: responsiveLayoutEvidence,
		checks: checks.filter((check) => /viewport|clipp|overlap|scroll|layout|fullscreen|visible|hittable/i.test(check.name)),
	}, null, 2));
	writeFileSync(join(artifactRoot, 'accessibility-report.json'), JSON.stringify({
		target: relative(root, previewFile).replaceAll('\\', '/'),
		browser: browserVersion,
		summary: {
			focusedKeyboardActivations: accessibilityEvidence.length,
			failedChecks: checks.filter((check) => check.status === 'FAIL' && /focused|keyboard|accessible|tab|hittable|focus/i.test(check.name)).length,
		},
		keyboardEvidence: accessibilityEvidence,
		checks: checks.filter((check) => /focused|keyboard|accessible|tab|hittable|focus|Space|Enter|pointer|touch/i.test(check.name)),
	}, null, 2));
	writeFileSync(join(artifactRoot, 'replay-implementation-notes.md'), [
		'# Replay implementation verification',
		'',
		`- Frontend: ${relative(root, previewFile).replaceAll('\\', '/')}`,
		`- Math config: ${relative(root, publishedMathFile).replaceAll('\\', '/')}`,
		`- Browser: ${browserVersion}`,
		'- Production HTML exposes no mutable gameplay API; QA instrumentation is injected in-memory by this harness.',
		'- Replay wallet amounts use integer API micro-units; book wins and payoutMultiplier use integer hundredths of the bet multiplier.',
		'- Responsive evidence audits the complete replay panel, visible descendants, ancestor clipping, overlap, scrollbars, text size, and action hit points.',
	].join('\n'));
	if (replayNetworkEvidence.length) {
		writeFileSync(join(artifactRoot, 'replay-network-proof.json'), JSON.stringify({
			target: relative(root, previewFile).replaceAll('\\', '/'),
			allowedMethod: 'GET',
			allowedPathPrefix: '/bet/replay/',
			forbiddenRequestCount: replayNetworkEvidence.reduce((sum, item) => sum + item.forbiddenRequests.length, 0),
			scenarios: replayNetworkEvidence,
		}, null, 2));
	}
	for (const check of checks) {
		console.log(`${check.status} [${check.group}] ${check.name}${check.detail ? ` - ${check.detail}` : ''}`);
	}
	console.log(`Stake QA e2e report: ${relative(root, join(artifactRoot, 'e2e-report.json'))} (screenshots: ${relative(root, shotDir)})`);
	if (replayNetworkEvidence.length) console.log(`Replay network proof: ${relative(root, join(artifactRoot, 'replay-network-proof.json'))}`);
	if (summary.fail > 0) {
		console.error(`Stake QA e2e failed: ${summary.fail} failing check(s).`);
		process.exit(1);
	}
}

await main();
