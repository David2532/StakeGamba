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
 *   insufficient-funds  play amount > balance blocks Play / Auto-Play /
 *                       Feature with "Insufficient Balance" and fires no
 *                       /wallet/play call.
 *   major-actions       Auto-Play never starts on a single click (amount
 *                       selection 10/25/50/100/200/∞ + Confirm), Feature
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
 *        major-actions|interrupted-round|mobile|rules|bet-config|social|intro|replay|rgs-round-states]
 */
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, normalize, relative, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createZstdDecompress } from 'node:zlib';
import { playerVisibleRestrictedHits } from '../apps/cluster/scripts/stake-compliance-contract.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const startedAt = new Date().toISOString();
const testedCommitSha = spawnSync('git', ['rev-parse', 'HEAD'], {
	cwd: root,
	encoding: 'utf8',
}).stdout.trim();
if (!/^[0-9a-f]{40}$/i.test(testedCommitSha)) {
	throw new Error(`Stake browser QA requires a full immutable Git commit SHA, received: ${testedCommitSha || '(empty)'}`);
}
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
const productionBookRoot = process.env.STAKE_QA_MATH_BOOKS_ROOT
	? resolve(root, process.env.STAKE_QA_MATH_BOOKS_ROOT)
	: dirname(publishedMathFile);

const checks = [];
let loopbackNavigationRetries = 0;
const replayNetworkEvidence = [];
const replayValidationEvidence = [];
const responsiveLayoutEvidence = [];
const accessibilityEvidence = [];
const walletNetworkEvidence = [];
const balanceInvariantEvidence = [];
const record = (group, name, status, detail = '') => checks.push({ group, name, status, detail });
const pass = (group, name, detail = '') => record(group, name, 'PASS', detail);
const fail = (group, name, detail = '') => record(group, name, 'FAIL', detail);
const expect = (group, name, condition, detail = '') => (condition ? pass(group, name, detail) : fail(group, name, detail));
const wants = (name) => mode === 'all' || mode === name;
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
		showFreeSpinCounter: ({ tier = 2, current = 1, total = 12 } = {}) => {
			if (!Number.isInteger(current) || !Number.isInteger(total) || current < 1 || total < 1 || current > total) {
				throw new Error('Invalid QA Free Spin counter state');
			}
			state.mode = 'free';
			state.tier = tier;
			state.fsTotal = total;
			state.fsLeft = total - current;
			updateFsCounter();
		},
		spinRgsMode: async (mode) => {
			const modeBuys = {
				base: null,
				hunt: { id: 'hunt', mult: modeMeta('hunt').costMultiplier },
				rainbow: { id: 'rainbow', mult: modeMeta('rainbow').costMultiplier },
				bonus_tier1: { id: 'tier1', mult: modeMeta('bonus_tier1').costMultiplier },
				bonus: { id: 'tier2', mult: modeMeta('bonus').costMultiplier },
			};
			if (!Object.hasOwn(modeBuys, mode)) throw new Error('Unknown RGS mode: ' + mode);
			return spin(modeBuys[mode]);
		},
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
const playerVisibleForbiddenHits = (text) => playerVisibleRestrictedHits(text);

const productionBookCache = new Map();
async function readProductionBook(filename, expectedId) {
	const cacheKey = `${filename}:${expectedId}`;
	if (productionBookCache.has(cacheKey)) return cloneRound(productionBookCache.get(cacheKey));
	const shippedFilename = filename.endsWith('.zst') ? filename : `${filename}.zst`;
	const file = join(productionBookRoot, shippedFilename);
	if (!existsSync(file)) throw new Error(`Shipped production math book is missing: ${relative(root, file)}`);
	const compressedInput = createReadStream(file);
	const input = compressedInput.pipe(createZstdDecompress());
	input.setEncoding('utf8');
	const lines = createInterface({ input, crlfDelay: Infinity });
	try {
		for await (const line of lines) {
			const idMatch = /^\{"id":(\d+),/.exec(line);
			if (Number(idMatch?.[1]) !== expectedId) continue;
			const book = JSON.parse(line);
			productionBookCache.set(cacheKey, book);
			return cloneRound(book);
		}
	} finally {
		lines.close();
		input.destroy();
		compressedInput.destroy();
	}
	throw new Error(`Production book ${expectedId} was not found in ${relative(root, file)}`);
}

async function visibleSurfaceAudit(page) {
	return page.evaluate(() => {
		const visible = (el) => {
			if (!el) return false;
			const style = getComputedStyle(el);
			const rect = el.getBoundingClientRect();
			return style.display !== 'none'
				&& style.visibility !== 'hidden'
				&& Number(style.opacity) !== 0
				&& rect.width > 0
				&& rect.height > 0;
		};
		const attrs = [...document.querySelectorAll('[aria-label],[title],[alt]')]
			.filter(visible)
			.flatMap((el) => [el.getAttribute('aria-label'), el.getAttribute('title'), el.getAttribute('alt')].filter(Boolean))
			.join(' ');
		const text = document.body.innerText || '';
		return {
			text,
			attrs,
			rawSocialCodes: `${text} ${attrs}`.match(/\bX(?:G|S)C\b/g) || [],
		};
	});
}

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
	const calls = { authenticate: [], play: [], endRound: [], event: [], replay: [], other: [], order: [] };
	await context.route(`**://${RGS_HOST}/**`, async (route) => {
		const request = route.request();
		const path = new URL(request.url()).pathname;
		let body = {};
		try {
			body = JSON.parse(request.postData() || '{}');
		} catch {
			body = {};
		}
		const reply = async (pendingData) => {
			const data = await pendingData;
			if (data?.response) {
				const response = data.response;
				return route.fulfill({
					status: response.status ?? 200,
					contentType: response.contentType ?? 'application/json',
					body: typeof response.body === 'string' ? response.body : JSON.stringify(response.body ?? {}),
				});
			}
			return route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ status: { statusCode: 'SUCCESS' }, ...(data || {}) }),
			});
		};
		if (path === '/wallet/authenticate') {
			calls.authenticate.push(body);
			calls.order.push('authenticate');
			return reply(handlers.authenticate(body));
		}
		if (path === '/wallet/play') {
			calls.play.push(body);
			calls.order.push('play');
			return reply(handlers.play ? handlers.play(body) : {});
		}
		if (path === '/wallet/end-round') {
			calls.endRound.push(body);
			calls.order.push('end-round');
			return reply(handlers.endRound ? handlers.endRound(body) : {});
		}
		if (path === '/bet/event') {
			calls.event.push(body);
			calls.order.push('event-save');
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
		{ index: 2, type: 'reveal', board: boardWithColumn('L2'), gameType: 'freegame' },
		{ index: 3, type: 'winInfo', totalWin: 250, wins: [{ symbol: 'L2', count: 5, win: 250, positions: columnPositions(0) }] },
		{ index: 4, type: 'finalWin', amount: 250 },
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
const withPayoutMultiplier = (round, payoutMultiplier) => ({
	...cloneRound(round),
	payoutMultiplier,
});
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

const authoritativeClusterReplayRound = ({
	symbol,
	positions,
	bookUnits,
	amount = API,
	currency = 'USD',
	mode = 'base',
	payout = Math.round(amount * bookUnits / 100),
}) => {
	const board = quietBoard();
	for (const position of positions) board[position.col][position.row] = position.symbol || symbol;
	return {
		active: false,
		game: 'golden-goal-rush',
		version: '1',
		mode,
		amount,
		currency,
		payout,
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

const replayRoundFromProductionBook = (book, {
	amount = API,
	currency = 'USD',
	eventId = book.id,
} = {}) => ({
	active: false,
	game: 'golden-goal-rush',
	version: '1',
	mode: book.mode,
	amount,
	currency,
	eventId,
	betID: `stake-qa-production-book-${book.id}`,
	payout: Math.round(amount * Number(book.payoutMultiplier) / 100),
	payoutMultiplier: book.payoutMultiplier,
	state: cloneRound(book.events),
});

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

const fractionalBamReplayRound = () => ({
	...authoritativeClusterReplayRound({
		symbol: 'L2',
		positions: columnPositions(0),
		bookUnits: 536,
		amount: 20_000,
		currency: 'BAM',
		mode: 'hunt',
		payout: 107_200,
	}),
	costMultiplier: 4.2,
	betID: 'stake-qa-replay-bam-fractional-amounts',
});

// ---------------------------------------------------------------------------
// Page helpers
// ---------------------------------------------------------------------------
async function openPreview(context, base, query = '') {
	for (let attempt = 0; attempt < 2; attempt += 1) {
		const page = await context.newPage();
		const startupErrors = [];
		page.on('pageerror', (error) => startupErrors.push(`pageerror: ${error?.message || error}`));
		page.on('console', (message) => {
			if (message.type() === 'error') startupErrors.push(`console: ${message.text()}`);
		});
		page.__stakeQaStartupErrors = startupErrors;
		page.setDefaultTimeout(20_000);
		try {
			await page.goto(`${base}/${frontendEntry}${query}`, { waitUntil: 'load' });
			await page.waitForFunction(() => window.__ggrReady === true);
			return page;
		} catch (error) {
			await page.close().catch(() => {});
			const message = `${error?.message || error}${startupErrors.length ? ` | ${startupErrors.join(' | ')}` : ''}`;
			if (attempt === 0 && message.includes('ERR_NO_BUFFER_SPACE')) {
				loopbackNavigationRetries += 1;
				await new Promise((resolveRetry) => setTimeout(resolveRetry, 500));
				continue;
			}
			throw new Error(message);
		}
	}
	throw new Error('Preview navigation retry exhausted without a result');
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
	socialCasino: window.__stakeQa.state.socialCasino,
	localWalletCredits: window.__stakeQa.state.localWalletCredits,
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

const replayQuery = ({
	mode = 'base',
	event = 'stake-qa-event',
	currency = 'USD',
	amount = API,
	language = 'en',
	device = 'desktop',
	extra = '',
} = {}) => {
	const params = new URLSearchParams({
		replay: 'true',
		rgs_url: `https://${RGS_HOST}`,
		game: 'golden-goal-rush',
		version: '1',
		mode,
		event,
		amount: String(amount),
		currency,
		lang: language,
		device,
	});
	return `?${params.toString()}${extra}`;
};

const replayQueryWithout = (omitted, options = {}) => {
	const params = new URLSearchParams(replayQuery(options).slice(1));
	for (const name of omitted) params.delete(name);
	return `?${params.toString()}`;
};

async function waitForReplayState(page, state, timeout = 20_000) {
	await page.waitForFunction(
		(expected) => document.getElementById('stage')?.dataset.replayState === expected,
		state,
		{ timeout },
	);
}

async function activateVisibleReplayAction(page, method = 'click') {
	const selector = '#replay-start';
	if (method === 'touch') await page.tap(selector);
	else if (method === 'Space' || method === 'Enter') {
		await page.focus(selector);
		await page.keyboard.press(method);
	} else await page.click(selector);
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
			const countReplayAction = () => {
				if (window.__stakeQaReplay) window.__stakeQaReplay.actionClicks += 1;
			};
			document.getElementById('replay-action')?.addEventListener('click', countReplayAction);
			document.getElementById('replay-start')?.addEventListener('click', countReplayAction);
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
		const overlayAction = document.getElementById('replay-start');
		const hudAction = document.getElementById('replay-action');
		const action = visible(overlayAction) ? overlayAction : hudAction;
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
		const metadata = document.getElementById('replay-metadata');
		const requiredElements = [win, bet];
		if (visible(panel)) requiredElements.push(panel, document.getElementById('replay-status'), document.getElementById('replay-summary'));
		if (visible(metadata)) requiredElements.push(metadata, ...metadata.querySelectorAll('.replay-row,.replay-row span,.replay-row strong,.replay-start,.replay-note'));
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
			metadataVisible: visible(metadata),
			metadata: {
				modeLabel: document.getElementById('replay-mode-label')?.textContent?.trim(),
				mode: document.getElementById('replay-mode-value')?.textContent?.trim(),
				basePlayLabel: document.getElementById('replay-basebet-label')?.textContent?.trim(),
				basePlay: document.getElementById('replay-basebet-value')?.textContent?.trim(),
				featureMultiplierLabel: document.getElementById('replay-cost-label')?.textContent?.trim(),
				featureMultiplier: document.getElementById('replay-cost-value')?.textContent?.trim(),
				finalPlayAmountLabel: document.getElementById('replay-totalcost-label')?.textContent?.trim(),
				finalPlayAmount: document.getElementById('replay-totalcost-value')?.textContent?.trim(),
				finalMultiplierLabel: document.getElementById('replay-payout-label')?.textContent?.trim(),
				finalMultiplier: document.getElementById('replay-payout-value')?.textContent?.trim(),
				totalWinLabel: document.getElementById('replay-totalwin-label')?.textContent?.trim(),
				totalWin: document.getElementById('replay-totalwin-value')?.textContent?.trim(),
			},
			currentMeta: window.__stakeQa?.Replay?.current?.meta || null,
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
// 2. Insufficient Balance — Play, Auto-Play and Feature
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
// 1c. Globally safe player wording on first render and every live UI mode
// ---------------------------------------------------------------------------
async function testSocialWording(browser, base) {
	const group = 'terminology-e2e';
	const staticContext = await browser.newContext({ viewport: { width: 1280, height: 720 }, javaScriptEnabled: false });
	const staticPage = await staticContext.newPage();
	await staticPage.goto(`${base}/${frontendEntry}`, { waitUntil: 'load' });
	const staticFirstRender = await staticPage.evaluate(() => {
		const roots = [
			document.querySelector('.meters'),
			document.querySelector('.controls'),
			document.getElementById('modal-paytable'),
			document.getElementById('modal-rules'),
			document.getElementById('replay-overlay'),
		].filter(Boolean);
		const text = roots.map((root) => root.textContent || '').join(' ');
		const attrs = roots.flatMap((root) => [root, ...root.querySelectorAll('[aria-label],[alt],[title]')])
			.flatMap((element) => [element.getAttribute('aria-label'), element.getAttribute('alt'), element.getAttribute('title')].filter(Boolean))
			.join(' ');
		return {
			text,
			attrs,
			visibleText: document.body.innerText || '',
			title: document.querySelector('#modal-paytable .modal-title')?.textContent?.trim() || '',
			footer: document.getElementById('paytable-note')?.textContent?.trim() || '',
			replayLabels: [...document.querySelectorAll('#replay-metadata .replay-row span')].map((element) => element.textContent?.trim() || ''),
		};
	});
	const staticHits = playerVisibleForbiddenHits(`${staticFirstRender.text} ${staticFirstRender.attrs}`);
	expect(
		group,
		'true no-JavaScript first render and static player-copy shell contain zero restricted terms',
		staticHits.length === 0
			&& staticFirstRender.title === 'SYMBOL TABLE'
			&& staticFirstRender.footer.includes('Each eligible symbol')
			&& staticFirstRender.replayLabels.join('|') === 'Mode|Base Play|Feature Multiplier|Final Play Amount|Final Multiplier|Total Win',
		JSON.stringify({ hits: staticHits, title: staticFirstRender.title, footer: staticFirstRender.footer, replayLabels: staticFirstRender.replayLabels, visibleText: staticFirstRender.visibleText.slice(0, 240) }),
	);
	const staticShot = await screenshot(staticPage, 'player-wording-static-no-js-first-render');
	pass(group, 'true no-JavaScript first-render screenshot saved', staticShot);
	await staticContext.close();

	const runCase = async ({
		currency,
		screenshotSuffix,
		socialCasino,
		launchCurrency = currency,
		queryExtra = '',
		viewport = { width: 1280, height: 720 },
	}) => {
		const context = await browser.newContext({ viewport });
		const calls = await mockRgs(context, {
			authenticate: () => ({
				balance: balanceOf(1000, currency),
				config: {
					jurisdiction: { socialCasino },
					minBet: API,
					maxBet: 1000 * API,
					stepBet: API,
					defaultBetLevel: API,
					betLevels: [API],
					betModes: { base: {}, hunt: {}, rainbow: {}, bonus_tier1: {}, bonus: {} },
				},
				round: null,
			}),
		});
		const page = await openPreview(context, base, rgsQuery(launchCurrency, queryExtra));
		await page.waitForFunction(
			(expectedSocial) => window.__stakeQa.state.walletBusy === false && window.__stakeQa.state.socialCasino === expectedSocial,
			socialCasino,
		);
		const authority = await page.evaluate(() => ({
			socialCasino: window.__stakeQa.state.socialCasino,
			currency: window.__stakeQa.state.currency,
			urlSocial: new URL(location.href).searchParams.has('social'),
		}));
		expect(group, `${screenshotSuffix} mode comes from Authenticate jurisdiction and balance`, calls.authenticate.length === 1 && authority.socialCasino === socialCasino && authority.currency === currency, JSON.stringify({ authority, calls }));
		const auditVisibleSurface = async (label) => {
			const audit = await visibleSurfaceAudit(page);
			const hits = playerVisibleForbiddenHits(`${audit.text} ${audit.attrs}`);
			const socialCodeSafe = !['XGC', 'XSC'].includes(currency) || audit.rawSocialCodes.length === 0;
			expect(group, `${screenshotSuffix} ${label} has no restricted visible/accessibility copy`, hits.length === 0 && socialCodeSafe, `hits=${hits.join(',') || 'none'} raw=${audit.rawSocialCodes.join(',') || 'none'}`);
			return audit;
		};
		const hud = await page.evaluate(() => ({
			betMeter: document.querySelector('[data-meter="bet"] .meter-label')?.textContent?.trim(),
			betPanel: document.getElementById('bet-display-label')?.textContent?.trim(),
			spin: document.querySelector('#btn-spin span')?.textContent?.trim(),
			bonusAria: document.getElementById('btn-bonus')?.getAttribute('aria-label'),
			autoAria: document.getElementById('btn-auto')?.getAttribute('aria-label'),
		}));
		expect(group, `${screenshotSuffix} HUD labels use PLAY globally`, hud.betMeter === 'PLAY' && hud.betPanel === 'PLAY' && hud.spin === 'PLAY', JSON.stringify(hud));
		expect(group, `${screenshotSuffix} major-action accessibility labels are globally safe`, hud.bonusAria === 'Feature' && hud.autoAria === 'Auto-Play', JSON.stringify(hud));
		await auditVisibleSurface('HUD');

		await page.click('#btn-auto');
		await page.waitForFunction(() => document.getElementById('modal-autospin')?.classList.contains('open'));
		const autoTitle = await meterText(page, 'autospin-title');
		await page.click('[data-auto-count="25"]');
		const autoConfirm = await page.evaluate(() => document.getElementById('auto-confirm')?.textContent || '');
		expect(group, `${screenshotSuffix} auto modal is globally safe`, autoTitle === 'AUTO-PLAY' && autoConfirm.includes('Start Auto-Play for 25') && !autoConfirm.includes('Auto-Bet'), `${autoTitle} ${autoConfirm.trim()}`);
		await auditVisibleSurface('Auto-Play dialog');
		await page.evaluate(() => document.querySelectorAll('[data-modal]').forEach((m) => m.classList.remove('open')));

		await page.click('#btn-bonus');
		await page.waitForFunction(() => document.getElementById('modal-bonusbuy')?.classList.contains('open'));
		const bonus = await page.evaluate(() => ({
			title: document.getElementById('bonusbuy-title')?.textContent?.trim(),
			text: document.getElementById('modal-bonusbuy')?.innerText || '',
		}));
		const bonusHits = playerVisibleForbiddenHits(bonus.text);
		expect(group, `${screenshotSuffix} feature modal avoids restricted copy`, bonus.title === 'BONUS / FEATURE' && bonusHits.length === 0, `hits=${bonusHits.join(',') || 'none'}; ${bonus.text.replace(/\s+/g, ' ').slice(0, 160)}`);
		await auditVisibleSurface('Feature dialog');
		await page.evaluate(() => document.querySelectorAll('[data-modal]').forEach((m) => m.classList.remove('open')));

		await page.click('#btn-menu');
		await page.waitForFunction(() => document.getElementById('modal-menu')?.classList.contains('open'));
		await page.click('[data-open="modal-paytable"]');
		await page.waitForFunction(() => document.getElementById('modal-paytable')?.classList.contains('open'));
		await page.waitForFunction(() => {
			const root = document.getElementById('modal-paytable');
			const panel = root?.querySelector('.modal');
			const body = root?.querySelector('.modal-body');
			return root?.classList.contains('open')
				&& Number(getComputedStyle(panel).opacity) >= 0.99
				&& body?.clientHeight > 0;
		});
		await page.evaluate(() => {
			const body = document.querySelector('#modal-paytable .modal-body');
			body?.scrollTo({ top: body.scrollHeight, behavior: 'instant' });
		});
		await page.waitForFunction(() => {
			const body = document.querySelector('#modal-paytable .modal-body');
			const footer = document.getElementById('paytable-note');
			const footerRect = footer?.getBoundingClientRect();
			const bodyRect = body?.getBoundingClientRect();
			return !!body
				&& Math.abs(body.scrollTop + body.clientHeight - body.scrollHeight) <= 2
				&& !!footerRect
				&& !!bodyRect
				&& footerRect.top >= bodyRect.top
				&& footerRect.bottom <= bodyRect.bottom;
		});
		const paytable = await page.evaluate(() => {
			const body = document.querySelector('#modal-paytable .modal-body');
			const root = document.getElementById('modal-paytable');
			const panel = root?.querySelector('.modal');
			const attrs = [...root.querySelectorAll('[aria-label],[title],[alt],[role],[aria-live]')].map((el) => Object.entries({ aria: el.getAttribute('aria-label'), title: el.getAttribute('title'), alt: el.getAttribute('alt'), role: el.getAttribute('role'), live: el.getAttribute('aria-live') }).filter(([, value]) => value).map(([, value]) => value).join(' ')).join(' ');
			const footer = document.getElementById('paytable-note');
			const footerRect = footer?.getBoundingClientRect();
			const bodyRect = body?.getBoundingClientRect();
			return {
				title: root?.querySelector('.modal-title')?.textContent?.trim() || '',
				text: root.innerText || '',
				attrs,
				footer: footer?.textContent?.trim() || '',
				footerVisible: !!footerRect && !!bodyRect && footerRect.top >= bodyRect.top && footerRect.bottom <= bodyRect.bottom,
				panelOpacity: Number(getComputedStyle(panel).opacity),
				scrollTop: body?.scrollTop || 0,
				scrollHeight: body?.scrollHeight || 0,
				clientHeight: body?.clientHeight || 0,
			};
		});
		const paytableHits = playerVisibleForbiddenHits(`${paytable.text} ${paytable.attrs}`);
		const expectedFooter = '5+ means 5–6 symbols; 7+ means 7–8; 9+ means 9–11; 12+ means 12 or more. Each eligible symbol is evaluated independently with orthogonally connected Wilds. A Wild may support multiple distinct symbol clusters, counts toward each supported cluster, and appears only once within a single award. The tumble removes all awarded positions. The cascade multiplier starts at 1× and increases after each successful cascade. A floating amount shows that award step; the WIN meter is cumulative for the complete round.';
		expect(group, `${screenshotSuffix} fully scrolled Symbol Table title/footer are exact, visible and unrestricted`, paytable.title === 'SYMBOL TABLE' && !paytable.text.includes('PAY TABLE') && paytableHits.length === 0 && paytable.footer === expectedFooter && paytable.footerVisible && paytable.panelOpacity >= 0.99 && Math.abs(paytable.scrollTop + paytable.clientHeight - paytable.scrollHeight) <= 2, `title=${paytable.title} hits=${paytableHits.join(',') || 'none'} scroll=${paytable.scrollTop}/${paytable.scrollHeight} footerVisible=${paytable.footerVisible} panelOpacity=${paytable.panelOpacity}`);
		await auditVisibleSurface('fully scrolled Symbol Table');
		const symbolTableShot = await screenshot(page, `symbol-table-${screenshotSuffix}-scrolled`);
		pass(group, `${screenshotSuffix} exact Symbol Table screenshot saved`, symbolTableShot);
		await page.evaluate(() => document.querySelectorAll('[data-modal]').forEach((m) => m.classList.remove('open')));

		await page.click('#btn-info');
		await page.waitForFunction(() => document.getElementById('modal-rules')?.classList.contains('open'));
		await page.waitForTimeout(350);
		const rulesAudit = await page.evaluate(() => {
			const root = document.getElementById('modal-rules');
			const attrs = [...root.querySelectorAll('[aria-label],[title],[alt]')]
				.flatMap((el) => [el.getAttribute('aria-label'), el.getAttribute('title'), el.getAttribute('alt')].filter(Boolean))
				.join(' ');
			return {
				text: root?.innerText || '',
				attrs,
				heads: [...document.querySelectorAll('#modal-rules .pt-head')].map((el) => el.textContent.trim()),
				controls: [...document.querySelectorAll('#modal-rules .control-rule')].map((el) => el.textContent.trim()),
			};
		});
		const hits = playerVisibleForbiddenHits(`${rulesAudit.text} ${rulesAudit.attrs}`);
		expect(group, `${screenshotSuffix} rules avoid restricted phrases`, hits.length === 0, `hits=${hits.join(',') || 'none'}`);
		expect(group, `${screenshotSuffix} rules include mode and button explanations`, rulesAudit.heads.includes('Game Modes') && rulesAudit.text.includes('Base Game') && rulesAudit.text.includes('Feature Multiplier') && rulesAudit.heads.includes('Buttons & Controls') && rulesAudit.controls.some((row) => row.includes('Auto-Play')), JSON.stringify(rulesAudit.heads));
		expect(group, `${screenshotSuffix} rules explain retrigger conditions`, rulesAudit.heads.includes('Retriggers') && rulesAudit.text.includes('Base Game and Rainbow Spin can trigger Free Spins') && rulesAudit.text.includes('Feature-panel Free Spins do not add additional Free Spins'), rulesAudit.text.replace(/\s+/g, ' ').slice(0, 220));
		await auditVisibleSurface('Rules, Features, modes, symbols and controls');
		await screenshot(page, `player-wording-${screenshotSuffix}`);
		await context.close();
	};
	await runCase({ currency: 'EUR', screenshotSuffix: 'default', socialCasino: false });
	await runCase({ currency: 'MXN', screenshotSuffix: 'social-false-mxn', socialCasino: false, queryExtra: '&social=false' });
	await runCase({ currency: 'XSC', screenshotSuffix: 'xsc', socialCasino: true, launchCurrency: 'USD' });
	await runCase({ currency: 'XGC', screenshotSuffix: 'xgc', socialCasino: true, launchCurrency: 'USD' });
	await runCase({
		currency: 'EUR',
		screenshotSuffix: 'default-mobile-390x844',
		socialCasino: false,
		viewport: { width: 390, height: 844 },
	});

	let releaseDelayedAuth;
	const delayedAuthGate = new Promise((resolveDelayedAuth) => { releaseDelayedAuth = resolveDelayedAuth; });
	const delayedContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
	const delayedCalls = await mockRgs(delayedContext, {
		authenticate: async () => {
			await delayedAuthGate;
			return {
				balance: balanceOf(1000, 'USD'),
				config: {
					jurisdiction: { socialCasino: false },
					defaultBetLevel: API,
					betLevels: [API],
					betModes: { base: {}, hunt: {}, rainbow: {}, bonus_tier1: {}, bonus: {} },
				},
				round: null,
			};
		},
	});
	const delayedPage = await openPreview(delayedContext, base, rgsQuery('USD', '&social=true'));
	const preAuthState = await gameState(delayedPage);
	const preAuthSurface = await visibleSurfaceAudit(delayedPage);
	const preAuthHits = playerVisibleForbiddenHits(`${preAuthSurface.text} ${preAuthSurface.attrs}`);
	expect(group, 'first render before delayed Authenticate has zero restricted visible/accessibility terms', preAuthState.walletBusy && preAuthHits.length === 0, `state=${JSON.stringify(preAuthState)} hits=${preAuthHits.join(',') || 'none'}`);
	await delayedPage.evaluate(() => {
		document.getElementById('modal-paytable')?.classList.add('open');
		const body = document.querySelector('#modal-paytable .modal-body');
		body?.scrollTo({ top: body.scrollHeight, behavior: 'instant' });
	});
	await delayedPage.waitForTimeout(350);
	const preAuthTable = await delayedPage.evaluate(() => {
		const root = document.getElementById('modal-paytable');
		const body = root?.querySelector('.modal-body');
		const footer = document.getElementById('paytable-note');
		return {
			title: root?.querySelector('.modal-title')?.textContent?.trim() || '',
			text: root?.innerText || '',
			footer: footer?.textContent?.trim() || '',
			atBottom: !!body && Math.abs(body.scrollTop + body.clientHeight - body.scrollHeight) <= 2,
		};
	});
	const preAuthTableHits = playerVisibleForbiddenHits(preAuthTable.text);
	expect(group, 'first-render static Symbol Table is safe before language/auth switching completes', preAuthTable.title === 'SYMBOL TABLE' && preAuthTable.footer.includes('Each eligible symbol') && preAuthTable.atBottom && preAuthTableHits.length === 0, JSON.stringify({ preAuthTable, preAuthTableHits }));
	const preAuthShot = await screenshot(delayedPage, 'symbol-table-first-render-delayed-auth-scrolled');
	pass(group, 'first-render delayed-auth Symbol Table screenshot saved', preAuthShot);
	await delayedPage.evaluate(() => document.querySelectorAll('[data-modal]').forEach((modal) => modal.classList.remove('open')));
	releaseDelayedAuth();
	await delayedPage.waitForFunction(() => window.__stakeQa.state.walletBusy === false && window.__stakeQa.state.socialCasino === false);
	const postAuthSurface = await visibleSurfaceAudit(delayedPage);
	const postAuthHits = playerVisibleForbiddenHits(`${postAuthSurface.text} ${postAuthSurface.attrs}`);
	expect(group, 'post-auth social=true URL overridden by normal jurisdiction remains globally safe', delayedCalls.authenticate.length === 1 && postAuthHits.length === 0, `hits=${postAuthHits.join(',') || 'none'}`);
	await delayedContext.close();

	const failedContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
	const failedCalls = await mockRgs(failedContext, {
		authenticate: () => ({
			response: {
				status: 500,
				body: { error: { message: 'Stake payout bet purchase failure must never reach the player' } },
			},
		}),
	});
	const failedPage = await openPreview(failedContext, base, rgsQuery('USD', '&social=false'));
	await failedPage.waitForFunction(() => document.getElementById('fatal-error')?.classList.contains('show'));
	const failedSurface = await visibleSurfaceAudit(failedPage);
	const failedHits = playerVisibleForbiddenHits(`${failedSurface.text} ${failedSurface.attrs}`);
	const failedFatal = await failedPage.evaluate(() => ({
		title: document.querySelector('#fatal-error .fatal-error-title')?.textContent?.trim() || '',
		detail: document.querySelector('#fatal-error .fatal-error-detail')?.textContent?.trim() || '',
	}));
	expect(group, 'failed Authenticate exposes only generic safe player copy', failedCalls.authenticate.length === 1 && failedFatal.title === 'Game service connection error' && failedHits.length === 0, JSON.stringify({ failedFatal, failedHits }));
	await screenshot(failedPage, 'failed-auth-player-safe');
	await failedContext.close();
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

	await runCase({ currency: 'EUR', extra: '', expectedTitle: 'Insufficient Balance' });
	await runCase({ currency: 'XSC', extra: '&social=true', expectedTitle: 'Insufficient Balance' });
}

// ---------------------------------------------------------------------------
// 3. Major actions need selection + confirmation (Auto-Play, Feature, guard)
// ---------------------------------------------------------------------------
async function testMajorActions(browser, base) {
	const group = 'major-actions-e2e';
	const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
	const page = await openPreview(context, base); // demo mode: no RGS, no wallet

	// First click opens the selector — nothing starts.
	await page.click('#btn-auto');
	await page.waitForFunction(() => document.getElementById('modal-autospin')?.classList.contains('open'));
	let state = await gameState(page);
	expect(group, 'Auto-Play click opens selection only', state.auto === false && state.spinning === false, JSON.stringify(state));
	const options = await page.evaluate(() =>
		[...document.querySelectorAll('#auto-options [data-auto-count]')].map((el) => el.textContent.trim()));
	expect(group, 'Auto-Play options are 10/25/50/100/200/∞', JSON.stringify(options) === JSON.stringify(['10', '25', '50', '100', '200', '∞']), options.join(','));
	await screenshot(page, 'auto-play-selection');

	// Selecting an amount only reveals the confirmation step.
	await page.click('[data-auto-count="25"]');
	await page.waitForSelector('#auto-confirm.show');
	const confirmText = await page.evaluate(() => document.getElementById('auto-confirm')?.textContent || '');
	state = await gameState(page);
	expect(group, 'selection shows safe confirm step, auto still off', state.auto === false && confirmText.includes('Start Auto-Play for 25') && playerVisibleForbiddenHits(confirmText).length === 0, confirmText.trim());
	await screenshot(page, 'auto-play-confirm');

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
	pass(group, 'confirm starts Auto-Play', 'state.auto === true after Confirm');
	await page.click('#btn-auto'); // toggle back off (stop is not a major action)
	await page.waitForFunction(() => window.__stakeQa.state.auto === false);
	await page.waitForFunction(() => window.__stakeQa.state.spinning === false, null, { timeout: 90_000 });
	await page.click('#btn-turbo');

	// Feature: first click opens the offer list, choosing an offer opens the
	// confirm step, Cancel returns to the list without buying.
	const balanceBeforeBuy = (await gameState(page)).balance;
	await page.click('#btn-bonus');
	await page.waitForFunction(() => document.getElementById('modal-bonusbuy')?.classList.contains('open'));
	state = await gameState(page);
	expect(group, 'Feature click opens list only', state.spinning === false && state.mode === 'base', JSON.stringify(state));
	await page.click('[data-buy="tier1"]');
	await page.waitForSelector('#bb-confirm');
	const bbQuestion = await page.evaluate(() => document.querySelector('.bb-confirm .c-q')?.textContent || '');
	state = await gameState(page);
	expect(group, 'Feature shows safe confirm with amount', /^Start[\s\S]*for/.test(bbQuestion.trim()) && playerVisibleForbiddenHits(bbQuestion).length === 0 && state.mode === 'base' && state.spinning === false, bbQuestion.replace(/\s+/g, ' ').trim());
	await screenshot(page, 'feature-confirm');
	await page.click('#bb-cancel');
	await page.waitForSelector('[data-buy="tier1"]');
	state = await gameState(page);
	expect(group, 'Feature cancel starts nothing', state.mode === 'base' && state.spinning === false && state.balance === balanceBeforeBuy, `balance ${state.balance} === ${balanceBeforeBuy}, ${JSON.stringify(state)}`);
	await page.click('.modal-close', { timeout: 5000 }).catch(() => {});
	await page.evaluate(() => document.querySelectorAll('[data-modal]').forEach((m) => m.classList.remove('open')));

	// confirmMajorAction(): the generic gate every future major action
	// (e.g. Double Chance) must use — Confirm resolves true, everything else false.
	const gate = await page.evaluate(async () => {
		const results = {};
		let pending = window.__stakeQa.confirmMajorAction({ title: 'DOUBLE CHANCE', body: 'Enable Double Chance for a higher play amount?' });
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
		for (const current of [1, 12]) {
			await page.evaluate((spin) => window.__stakeQa.showFreeSpinCounter({ tier: 2, current: spin, total: 12 }), current);
			await page.waitForTimeout(100);
			const counter = await page.evaluate(() => {
				const rect = (element) => {
					if (!element) return null;
					const value = element.getBoundingClientRect();
					return { left: value.left, top: value.top, right: value.right, bottom: value.bottom, width: value.width, height: value.height };
				};
				const intersectionArea = (first, second) => {
					if (!first || !second) return 0;
					return Math.max(0, Math.min(first.right, second.right) - Math.max(first.left, second.left))
						* Math.max(0, Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top));
				};
				const element = document.getElementById('fs-counter');
				const counterRect = rect(element);
				const boardRect = rect(document.getElementById('board'));
				const metersRect = rect(document.querySelector('.meters'));
				const controlsRect = rect(document.querySelector('.controls'));
				const logoRect = rect(document.querySelector('.logo-wordmark'));
				return {
					text: element?.textContent?.replace(/\s+/g, ' ').trim() || '',
					visible: !!element && getComputedStyle(element).display !== 'none' && counterRect.width > 0 && counterRect.height > 0,
					insideViewport: !!counterRect && counterRect.left >= -0.5 && counterRect.top >= -0.5 && counterRect.right <= innerWidth + 0.5 && counterRect.bottom <= innerHeight + 0.5,
					rects: { counter: counterRect, board: boardRect, meters: metersRect, controls: controlsRect, logo: logoRect },
					overlaps: {
						board: intersectionArea(counterRect, boardRect),
						meters: intersectionArea(counterRect, metersRect),
						controls: intersectionArea(counterRect, controlsRect),
						logo: intersectionArea(counterRect, logoRect),
					},
				};
			});
			expect(
				group,
				`${viewport.name} Free Spins counter ${current}/12 stays visible and clear of reels/HUD`,
				counter.visible
					&& counter.insideViewport
					&& counter.text.includes(`SPIN ${current} / 12`)
					&& counter.overlaps.board === 0
					&& counter.overlaps.meters === 0
					&& counter.overlaps.controls === 0,
				JSON.stringify(counter),
			);
			responsiveLayoutEvidence.push({ scenario: `free-spin-counter-${current}-of-12`, viewport, lifecycle: 'free-spins', audit: counter });
			const counterShot = await screenshot(page, `free-spin-counter-${current}-of-12-${viewport.name}`);
			pass(group, `${viewport.name} Free Spins counter ${current}/12 screenshot saved`, counterShot);
		}
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
// 7. Cinematic intro: real generated raster art, accessibility and transition
// ---------------------------------------------------------------------------
async function testIntro(browser, base) {
	const group = 'intro-e2e';
	const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
	const desktop = await openPreview(desktopContext, base, '?intro=always');
	await desktop.waitForFunction(() => document.getElementById('cinematic-intro')?.dataset.scene === 'arrival', null, { timeout: 12_000 });
	const arrival = await desktop.evaluate(() => {
		const root = document.getElementById('cinematic-intro');
		const art = document.getElementById('intro-desktop-art');
		return {
			visible: !!root && !root.hidden,
			scene: root?.dataset.scene || '',
			rasterReady: !!art && art.naturalWidth >= 1200 && art.naturalHeight >= 600,
			rasterSource: art?.getAttribute('src') || '',
			canvas: document.getElementById('intro-atmosphere')?.width > 0,
		};
	});
	expect(group, 'desktop arrival uses a loaded original raster stadium scene and atmospheric canvas', arrival.visible && arrival.scene === 'arrival' && arrival.rasterReady && /intro\/stadium-arrival-desktop\.png$/.test(arrival.rasterSource) && arrival.canvas, JSON.stringify(arrival));
	const arrivalShot = await screenshot(desktop, 'intro-desktop-arrival');
	pass(group, 'desktop cinematic arrival screenshot saved', arrivalShot);
	await desktop.waitForFunction(() => document.getElementById('cinematic-intro')?.dataset.scene === 'ready', null, { timeout: 12_000 });
	await desktop.waitForTimeout(650);
	const ready = await desktop.evaluate(() => {
		const root = document.getElementById('cinematic-intro');
		const progress = document.getElementById('intro-progress');
		const sound = document.getElementById('intro-enter-sound');
		const silent = document.getElementById('intro-enter-silent');
		return {
			scene: root?.dataset.scene || '',
			progress: Number(progress?.value),
			gameInert: document.getElementById('stage')?.inert === true && document.getElementById('stage')?.getAttribute('aria-hidden') === 'true',
			soundName: sound?.getAttribute('aria-label') || sound?.textContent?.trim() || '',
			silentName: silent?.getAttribute('aria-label') || silent?.textContent?.trim() || '',
			soundHittable: !!sound && (() => { const box = sound.getBoundingClientRect(); return box.width >= 44 && box.height >= 44; })(),
			soundBox: sound ? (() => { const box = sound.getBoundingClientRect(); return { width: box.width, height: box.height, display: getComputedStyle(sound).display, minHeight: getComputedStyle(sound).minHeight }; })() : null,
			introRuleLoaded: [...document.styleSheets].some((sheet) => { try { return [...sheet.cssRules].some((rule) => rule.cssText.includes('.intro-action')); } catch (error) { return false; } }),
		};
	});
	expect(group, 'ready screen reports genuine completed asset loading and exposes two accessible sound choices', ready.scene === 'ready' && ready.progress === 100 && ready.gameInert && /play with sound/i.test(ready.soundName) && /play silent/i.test(ready.silentName) && ready.soundHittable, JSON.stringify(ready));
	const readyShot = await screenshot(desktop, 'intro-desktop-ready');
	pass(group, 'desktop ready-screen screenshot saved', readyShot);
	await desktop.locator('#intro-enter-silent').focus();
	await desktop.keyboard.press('Enter');
	await desktop.waitForFunction(() => document.getElementById('cinematic-intro')?.hidden === true, null, { timeout: 5_000 });
	const transition = await desktop.evaluate(() => ({
		stageVisible: !!document.getElementById('stage'),
		introHidden: document.getElementById('cinematic-intro')?.hidden === true,
		stageInteractive: document.getElementById('stage')?.inert === false && !document.getElementById('stage')?.hasAttribute('aria-hidden'),
		boardCells: document.querySelectorAll('#board .cell').length,
	}));
	expect(group, 'keyboard Enter completes the cinematic transition to the actual playable board', transition.stageVisible && transition.introHidden && transition.stageInteractive && transition.boardCells > 0, JSON.stringify(transition));
	const transitionShot = await screenshot(desktop, 'intro-desktop-game-transition');
	pass(group, 'desktop post-intro real-game screenshot saved', transitionShot);
	await desktopContext.close();

	const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
	const mobile = await openPreview(mobileContext, base, '?intro=ready');
	await mobile.waitForFunction(() => document.getElementById('cinematic-intro')?.dataset.scene === 'ready', null, { timeout: 8_000 });
	await mobile.waitForTimeout(650);
	const mobileAudit = await mobile.evaluate(() => {
		const art = document.getElementById('intro-mobile-art');
		const button = document.getElementById('intro-enter-silent');
		const root = document.getElementById('cinematic-intro');
		const artStyle = art ? getComputedStyle(art) : null;
		const box = button?.getBoundingClientRect();
		return {
			portraitAssetVisible: !!art && artStyle?.display !== 'none' && art.naturalWidth >= 500,
			portraitArt: art ? { display: artStyle?.display, width: art.naturalWidth, height: art.naturalHeight } : null,
			buttonInsideViewport: !!box && box.top >= 0 && box.bottom <= innerHeight && box.width >= 44 && box.height >= 44,
			buttonBox: box ? { top: box.top, bottom: box.bottom, width: box.width, height: box.height, display: button ? getComputedStyle(button).display : '' } : null,
			introHeight: root?.getBoundingClientRect().height || 0,
			viewportHeight: innerHeight,
		};
	});
	expect(group, 'mobile ready screen selects its raster portrait artwork without clipping the touch control', mobileAudit.portraitAssetVisible && mobileAudit.buttonInsideViewport && mobileAudit.introHeight >= mobileAudit.viewportHeight, JSON.stringify(mobileAudit));
	const mobileShot = await screenshot(mobile, 'intro-mobile-ready-390x844');
	pass(group, 'mobile cinematic ready-screen screenshot saved', mobileShot);
	await mobileContext.close();

	const reducedContext = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
	const reduced = await openPreview(reducedContext, base, '?intro=always');
	await reduced.waitForFunction(() => document.getElementById('cinematic-intro')?.dataset.scene === 'ready', null, { timeout: 5_000 });
	expect(group, 'reduced-motion preference bypasses cinematic motion and keeps the ready screen usable', await reduced.locator('#intro-enter-silent').isVisible(), 'ready interaction visible');
	await reducedContext.close();

	const replayContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
	const replay = await openPreview(replayContext, base, '?replay=true&game=golden-goal-rush');
	const replayAudit = await replay.evaluate(() => ({
		introHidden: document.getElementById('cinematic-intro')?.hidden === true,
		replayState: document.getElementById('stage')?.dataset.replayState || '',
	}));
	expect(group, 'replay routes skip the cinematic layer by default', replayAudit.introHidden, JSON.stringify(replayAudit));
	await replayContext.close();
}

// ---------------------------------------------------------------------------
// 8. Paytable: generated DOM and browser-exposed values match publish/math
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
		expect(group, `${symbol} eligible symbol is rendered in Symbol Table DOM`, !!row, JSON.stringify(audit.rows.map((item) => item.symbol)));
		const runtime = audit.contract?.[symbol];
		expect(group, `${symbol} eligible symbol exists in browser contract`, !!runtime, JSON.stringify(runtime));
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
	expect(group, 'mobile Symbol Table scroll reaches all explanatory content', !!mobileScroll && mobileScroll.max > 0 && mobileScroll.after >= mobileScroll.max - 1 && mobileScroll.note.includes('Each eligible symbol is evaluated independently'), JSON.stringify(mobileScroll));
	const mobileShot = await screenshot(mobilePage, 'paytable-production-contract-390x844-scrolled');
	pass(group, 'actual mobile Paytable screenshot saved', mobileShot);
	await mobileContext.close();
}

// ---------------------------------------------------------------------------
// 9. Replay: strict read-only Stake replay contract in real Chromium
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
					const action = document.getElementById('replay-start');
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
			expect(group, `${label} Replay Play Amount is visible and display-only`, ready.betVisible && ready.betDisplayOnly && ready.betLabel === 'REPLAY PLAY', JSON.stringify(ready));
			expect(group, `${label} replay play-amount format is $1.00`, `${ready.betCurrency} ${ready.betText}`.includes('$') && `${ready.betCurrency} ${ready.betText}`.includes('1.00'), JSON.stringify(ready));
			expect(group, `${label} Start Replay control is visible, accessible and hittable at center/edges`, ready.actionVisible && ready.actionHittable && !ready.actionDisabled && ready.actionRole === 'button' && ready.actionText === 'Start Replay' && /Start Replay/i.test(ready.actionAccessibleName), JSON.stringify(ready));
			expect(group, `${label} ready screen exposes the complete immutable replay metadata card`, ready.metadataVisible
				&& ready.metadata.modeLabel === 'Mode'
				&& ready.metadata.basePlayLabel === 'Base Play'
				&& ready.metadata.featureMultiplierLabel === 'Feature Multiplier'
				&& ready.metadata.finalPlayAmountLabel === 'Final Play Amount'
				&& ready.metadata.finalMultiplierLabel === 'Final Multiplier'
				&& ready.metadata.totalWinLabel === 'Total Win'
				&& ready.metadata.basePlay === ready.betText
				&& ready.metadata.totalWin === ready.winText, JSON.stringify(ready.metadata));
			expect(group, `${label} board and every required replay element are inside viewport and unclipped`, ready.boardVisible && ready.allRequiredInsideViewport && ready.allRequiredUnclipped && ready.panelDescendants.every((item) => item.insideViewport && item.visibleFraction >= 0.9999), JSON.stringify(ready));
			expect(group, `${label} replay panel does not overlap WIN or Replay Play Amount`, ready.panelOverlapWin === 0 && ready.panelOverlapBet === 0, `winOverlap=${ready.panelOverlapWin} playAmountOverlap=${ready.panelOverlapBet}`);
			expect(group, `${label} replay layout has no page scrollbars and required text remains readable`, !ready.scrollX && !ready.scrollY && ready.textSizes.every((item) => item.size >= 10), JSON.stringify(ready.textSizes));
			const forbiddenTabStops = ['btn-spin', 'btn-auto', 'btn-bonus', 'btn-bet-minus', 'btn-bet-plus'];
			expect(group, `${label} normal paid controls are absent from keyboard navigation`, !ready.tabbableIds.some((id) => forbiddenTabStops.includes(id)), ready.tabbableIds.join(','));
			const coordinateAudit = await page.evaluate((points) => {
				const action = document.getElementById('replay-start');
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
					await page.focus('#replay-start');
					focus = await page.evaluate(() => {
						const action = document.getElementById('replay-start');
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
				} else await activateVisibleReplayAction(page, method);
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

	// Stake review reproductions must exercise the immutable production book
	// rows, not hand-authored lookalikes. Event 0 also proves that a valid zero
	// identifier and every optional replay launch parameter survive transport.
	const baseBook55473 = await readProductionBook('base_books.jsonl', 55473);
	const baseFinalWins = baseBook55473.events.filter((event) => event.type === 'finalWin');
	expect(
		group,
		'production base book 55473 is the exact zero-win review fixture',
		baseBook55473.id === 55473
			&& baseBook55473.mode === 'base'
			&& baseBook55473.payoutMultiplier === 0
			&& baseBook55473.events.length === 2
			&& baseBook55473.events[0]?.type === 'reveal'
			&& baseBook55473.events.filter((event) => event.type === 'winInfo').length === 0
			&& baseFinalWins.length === 1
			&& baseFinalWins[0]?.amount === 0,
		JSON.stringify({ id: baseBook55473.id, mode: baseBook55473.mode, payoutMultiplier: baseBook55473.payoutMultiplier, eventTypes: baseBook55473.events.map((event) => event.type) }),
	);

	const bonusBook1488 = await readProductionBook('bonus_books.jsonl', 1488);
	const bonusUpdates = bonusBook1488.events.filter((event) => event.type === 'updateFreeSpin');
	const bonusReveals = bonusBook1488.events.filter((event) => event.type === 'reveal');
	const bonusWins = bonusBook1488.events.filter((event) => event.type === 'winInfo');
	const bonusLastUpdateIndex = bonusBook1488.events.findLastIndex((event) => event.type === 'updateFreeSpin');
	const bonusTail = bonusBook1488.events.slice(bonusLastUpdateIndex + 1);
	const bonusFreeSpinEnd = bonusBook1488.events.filter((event) => event.type === 'freeSpinEnd');
	const bonusFinalWins = bonusBook1488.events.filter((event) => event.type === 'finalWin');
	expect(
		group,
		'production bonus book 1488 contains exactly 12 spins and authoritative 5.48x settlement',
		bonusBook1488.id === 1488
			&& bonusBook1488.mode === 'bonus'
			&& bonusBook1488.payoutMultiplier === 548
			&& JSON.stringify(bonusUpdates.map((event) => event.amount)) === JSON.stringify(Array.from({ length: 12 }, (_, index) => index))
			&& bonusReveals.length === 12
			&& bonusWins.reduce((sum, event) => sum + Number(event.totalWin || 0), 0) === 548
			&& bonusWins.at(-1)?.runningTotalWin === 548
			&& bonusFreeSpinEnd.length === 1
			&& bonusFreeSpinEnd[0]?.amount === 548
			&& bonusFinalWins.length === 1
			&& bonusFinalWins[0]?.amount === 548
			&& !bonusTail.some((event) => event.type === 'updateFreeSpin')
			&& bonusTail.filter((event) => event.type === 'reveal').length === 1,
		JSON.stringify({
			id: bonusBook1488.id,
			payoutMultiplier: bonusBook1488.payoutMultiplier,
			updates: bonusUpdates.map((event) => event.amount),
			reveals: bonusReveals.length,
			winTotal: bonusWins.reduce((sum, event) => sum + Number(event.totalWin || 0), 0),
			tailTypes: bonusTail.map((event) => event.type),
		}),
	);

	const exactBookCases = [
		{
			name: 'production-base-55473-event-zero',
			book: baseBook55473,
			event: 0,
			amount: 10 * API,
			device: 'mobile',
			expectedWin: '$0.00',
		},
		{
			name: 'production-bonus-1488',
			book: bonusBook1488,
			event: 1488,
			amount: API,
			device: 'desktop',
			expectedWin: '$5.48',
		},
	];
	for (const exactCase of exactBookCases) {
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		const round = replayRoundFromProductionBook(exactCase.book, { amount: exactCase.amount, eventId: exactCase.event });
		const calls = await mockReplayRgs(context, () => ({ round }));
		const page = await openPreview(context, base, replayQuery({
			mode: exactCase.book.mode,
			event: exactCase.event,
			amount: exactCase.amount,
			currency: 'USD',
			language: 'en',
			device: exactCase.device,
		}));
		await waitForReplayState(page, 'ready');
		const request = calls.replay[0];
		const ready = await page.evaluate(() => ({
			state: document.getElementById('stage')?.dataset.replayState,
			round: window.__stakeQa.Replay.current?.round,
			meta: window.__stakeQa.Replay.current?.meta,
			launch: Object.fromEntries(new URL(location.href).searchParams.entries()),
		}));
		expect(
			group,
			`${exactCase.name} preserves event, amount, currency, language and device parameters`,
			calls.replay.length === 1
				&& request?.method === 'GET'
				&& request?.path.endsWith(`/${exactCase.event}`)
				&& request?.search.language === 'en'
				&& request?.search.lang === 'en'
				&& ready.launch.amount === String(exactCase.amount)
				&& ready.launch.currency === 'USD'
				&& ready.launch.lang === 'en'
				&& ready.launch.device === exactCase.device
				&& calls.forbidden.length === 0,
			JSON.stringify({ request, forbidden: calls.forbidden }),
		);
		expect(
			group,
			`${exactCase.name} loads the exact immutable production book`,
			ready.state === 'ready'
				&& ready.round?.betID === `stake-qa-production-book-${exactCase.book.id}`
				&& ready.round?.state?.events?.length === exactCase.book.events.length
				&& Number(ready.round?.payoutMultiplier) === exactCase.book.payoutMultiplier,
			JSON.stringify({ state: ready.state, betID: ready.round?.betID, events: ready.round?.state?.events?.length, meta: ready.meta }),
		);
		await page.evaluate(() => window.__stakeQa.setTurbo(true));
		await activateVisibleReplayAction(page);
		const overlayDriver = exactCase.book.mode === 'bonus' ? driveReplayOverlays(page) : Promise.resolve();
		await waitForReplayState(page, 'completed', 120_000);
		await overlayDriver;
		const complete = await replayUiAudit(page);
		expect(group, `${exactCase.name} completes with the authoritative production payout`, complete.state === 'completed' && complete.winText === exactCase.expectedWin && calls.forbidden.length === 0, JSON.stringify(complete));
		replayValidationEvidence.push({
			case: exactCase.name,
			bookId: exactCase.book.id,
			expected: 'completed',
			actual: complete,
			replayRequests: calls.replay,
			forbiddenRequests: calls.forbidden,
		});
		replayNetworkEvidence.push({ scenario: exactCase.name, viewport: 'desktop-1280x720', replayRequests: calls.replay, forbiddenRequests: calls.forbidden });
		await context.close();
	}

	for (const omitted of [
		['amount'],
		['currency'],
		['lang'],
		['device'],
		['amount', 'currency', 'lang', 'device', 'social'],
	]) {
		const label = omitted.join('-');
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		const calls = await mockReplayRgs(context, () => ({ round: baseReplayRound() }));
		const page = await openPreview(context, base, replayQueryWithout(omitted, { mode: 'base', event: `stake-qa-optional-${label}` }));
		await waitForReplayState(page, 'ready');
		const audit = await replayUiAudit(page);
		const launch = await page.evaluate(() => Object.fromEntries(new URL(location.href).searchParams.entries()));
		expect(
			group,
			`Replay accepts omitted optional launch parameter(s): ${label}`,
			omitted.every((name) => !Object.hasOwn(launch, name))
				&& audit.state === 'ready'
				&& audit.metadataVisible
				&& audit.metadata.basePlay === '$1.00'
				&& audit.metadata.totalWin === '$1.25'
				&& calls.replay.length === 1
				&& calls.forbidden.length === 0,
			JSON.stringify({ omitted, launch, audit: audit.metadata, calls }),
		);
		replayValidationEvidence.push({ case: `optional-omitted-${label}`, expected: 'ready', actual: audit, replayRequests: calls.replay, forbiddenRequests: calls.forbidden });
		await context.close();
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
		await activateVisibleReplayAction(page);
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

	// Stake review regression: Replay must not round authoritative API micro-units
	// to conventional two-decimal wallet presentation. 0.02 x 4.2 is 0.084,
	// while the finalWin contract 536 book units is exactly 0.1072 BAM.
	{
		const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
		const calls = await mockReplayRgs(context, () => ({ round: fractionalBamReplayRound() }));
		const page = await openPreview(context, base, replayQuery({ mode: 'hunt', event: 'stake-qa-bam-fractional-amounts', currency: 'BAM', amount: 20_000 }));
		await page.waitForFunction(() => ['ready', 'error'].includes(document.getElementById('stage')?.dataset.replayState));
		const ready = await replayUiAudit(page);
		const exact = await page.evaluate(() => ({
			meta: window.__stakeQa.Replay.current?.meta || null,
			status: document.getElementById('replay-status')?.textContent?.trim(),
			error: document.getElementById('replay-overlay-detail')?.textContent?.trim(),
			basePlay: document.getElementById('replay-basebet-value')?.textContent?.trim(),
			featureMultiplier: document.getElementById('replay-cost-value')?.textContent?.trim(),
			finalPlayAmount: document.getElementById('replay-totalcost-value')?.textContent?.trim(),
			finalMultiplier: document.getElementById('replay-payout-value')?.textContent?.trim(),
			totalWin: document.getElementById('replay-totalwin-value')?.textContent?.trim(),
		}));
		expect(
			group,
			'BAM fractional replay preserves exact final play amount and total win without two-decimal rounding',
			ready.state === 'ready'
				&& exact.basePlay === '0.02 BAM'
				&& exact.featureMultiplier === '4.2x'
				&& exact.finalPlayAmount === '0.084 BAM'
				&& exact.finalMultiplier === '5.36x'
				&& exact.totalWin === '0.1072 BAM'
				&& Math.abs(exact.meta?.totalCost - 0.084) <= 0.000001
				&& Math.abs(exact.meta?.totalWin - 0.1072) <= 0.000001
				&& calls.replay.length === 1
				&& calls.forbidden.length === 0,
			JSON.stringify(exact),
		);
		const frame = await screenshot(page, 'replay-bam-fractional-amounts-ready-1280x800');
		pass(group, 'BAM exact fractional replay modal screenshot saved', frame);
		await page.evaluate(() => window.__stakeQa.setTurbo(true));
		await activateVisibleReplayAction(page);
		await waitForReplayState(page, 'completed', 30_000);
		const completed = await replayUiAudit(page);
		expect(
			group,
			'BAM completed replay retains the exact immutable modal amounts',
			completed.metadata.finalPlayAmount === '0.084 BAM'
				&& completed.metadata.totalWin === '0.1072 BAM'
				&& calls.replay.length === 1
				&& calls.forbidden.length === 0,
			JSON.stringify(completed.metadata),
		);
		replayValidationEvidence.push({ case: 'bam-fractional-amounts', expected: 'completed-exact', actual: completed, replayRequests: calls.replay.length, forbiddenRequests: calls.forbidden.length });
		await context.close();
	}

	const payoutMultiplierVariants = [
		{ name: 'bonus-without-payout-multiplier', mode: 'bonus', round: () => withoutPayoutMultiplier(bonusReplayRound()), expectedWin: '$1.12', expectedMultiplier: 1.12 },
		{ name: 'bonus-tier1-null-payout-multiplier', mode: 'bonus_tier1', round: () => ({ ...bonusTier1ReplayRound(), payoutMultiplier: null }), expectedWin: '$1.12', expectedMultiplier: 1.12 },
		{ name: 'bonus-decimal-payout-multiplier', mode: 'bonus', round: () => withPayoutMultiplier(bonusReplayRound(), 1.12), expectedWin: '$1.12', expectedMultiplier: 1.12 },
		{ name: 'bonus-tier1-string-decimal-payout-multiplier', mode: 'bonus_tier1', round: () => withPayoutMultiplier(bonusTier1ReplayRound(), '1.12'), expectedWin: '$1.12', expectedMultiplier: 1.12 },
		{ name: 'bonus-alias-all-that-glitters-without-payout-multiplier', mode: 'all_that_glitters', expectedMode: 'bonus', round: () => withoutPayoutMultiplier(bonusReplayRound()), expectedWin: '$1.12', expectedMultiplier: 1.12 },
		{ name: 'bonus-tier1-alias-golden-chance-without-payout-multiplier', mode: 'golden_chance', expectedMode: 'bonus_tier1', round: () => withoutPayoutMultiplier(bonusTier1ReplayRound()), expectedWin: '$1.12', expectedMultiplier: 1.12 },
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
			roundMode: window.__stakeQa.Replay.current?.round?.mode,
			actionText: document.getElementById('replay-start')?.textContent?.trim(),
		}));
		expect(group, `${variant.name} reconstructs replay payout multiplier from finalWin when needed`, ready.state === 'ready' && ready.actionText === 'Start Replay' && ready.roundMode === (variant.expectedMode || variant.mode) && Math.abs(ready.totalWin - variant.expectedMultiplier) <= 0.000001 && Math.abs(ready.payoutMultiplier - variant.expectedMultiplier) <= 0.000001, JSON.stringify(ready));
		await activateVisibleReplayAction(page);
		await waitForReplayState(page, 'completed', 30_000);
		const complete = await replayUiAudit(page);
		const overlays = await page.evaluate(() => ({
			intro: document.getElementById('bonus-intro')?.classList.contains('show') || false,
			summary: document.getElementById('bonus-summary')?.classList.contains('show') || false,
		}));
		expect(group, `${variant.name} completes with authoritative replay win`, complete.winText === variant.expectedWin, JSON.stringify(complete));
		expect(group, `${variant.name} has no blocking bonus intro or summary overlay in replay`, !overlays.intro && !overlays.summary, JSON.stringify(overlays));
		expect(group, `${variant.name} makes one replay GET and no forbidden call`, calls.replay.length === 1 && calls.forbidden.length === 0, JSON.stringify(calls));
		const frame = await screenshot(page, `replay-${variant.name}-completed`);
		pass(group, `${variant.name} completed screenshot saved`, frame);
		replayNetworkEvidence.push({ scenario: variant.name, viewport: 'desktop-1280x720', replayRequests: calls.replay, forbiddenRequests: calls.forbidden });
		replayValidationEvidence.push({ case: variant.name, expected: 'completed', actual: complete, replayRequests: calls.replay.length, forbiddenRequests: calls.forbidden.length });
		await context.close();
	}

	// Social Replay derives its presentation from the authoritative XGC/XSC
	// replay currency. No manual social query parameter is used in these cases.
	const socialReplayModes = [
		{ mode: 'base', name: 'Base Game', round: baseReplayRound },
		{ mode: 'hunt', name: 'Feature Spins', round: () => ({ ...baseReplayRound(), mode: 'hunt', costMultiplier: 4.2 }) },
		{ mode: 'rainbow', name: 'Rainbow Spin', round: rainbowReplayRound },
		{ mode: 'bonus_tier1', name: 'Golden Chance', round: bonusTier1ReplayRound },
		{ mode: 'bonus', name: 'All That Glitters', round: () => withoutPayoutMultiplier(bonusReplayRound()) },
	];
	for (const currency of ['XGC', 'XSC']) {
		for (const socialMode of socialReplayModes) {
			const socialContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
			let releaseReplay;
			const replayPending = new Promise((resolvePending) => { releaseReplay = resolvePending; });
			const socialCalls = await mockReplayRgs(socialContext, async () => {
				await replayPending;
				return { round: { ...socialMode.round(), currency } };
			});
			const socialPage = await openPreview(
				socialContext,
				base,
				replayQuery({ mode: socialMode.mode, event: `stake-qa-social-replay-${currency.toLowerCase()}-${socialMode.mode}`, currency }),
			);
			const socialVisibleAudit = async (lifecycle) => {
				const audit = await socialPage.evaluate(() => {
					const visible = (el) => {
						if (!el) return false;
						const style = getComputedStyle(el);
						const rect = el.getBoundingClientRect();
						return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0;
					};
					const root = document.body;
					const visibleAttrs = [...root.querySelectorAll('[aria-label],[title],[alt],[role],[aria-live]')]
						.filter(visible)
						.map((el) => [el.getAttribute('aria-label'), el.getAttribute('title'), el.getAttribute('alt'), el.getAttribute('role'), el.getAttribute('aria-live')].filter(Boolean).join(' ')).join(' ');
					const text = root.innerText || '';
					return {
						text,
						attrs: visibleAttrs,
						rawCodes: `${text} ${visibleAttrs}`.match(/\bX(?:G|S)C\b/g) || [],
						summary: document.getElementById('replay-summary')?.textContent?.trim() || '',
						status: document.getElementById('replay-status')?.textContent?.trim() || '',
						urlSocial: new URL(location.href).searchParams.has('social'),
						currency: window.__stakeQa.Replay.current?.round?.currency || null,
					};
				});
				const hits = playerVisibleForbiddenHits(`${audit.text} ${audit.attrs}`);
				expect(group, `${currency} ${socialMode.mode} replay ${lifecycle} has no restricted visible/accessibility copy or raw code`, hits.length === 0 && audit.rawCodes.length === 0, `hits=${hits.join(',') || 'none'} raw=${audit.rawCodes.join(',') || 'none'}`);
				return audit;
			};
			await waitForReplayState(socialPage, 'loading');
			const socialLoading = await socialVisibleAudit('loading');
			expect(group, `${currency} ${socialMode.mode} loading uses social-safe lifecycle copy without manual social parameter`, socialLoading.status === 'LOADING REPLAY' && !socialLoading.urlSocial, JSON.stringify(socialLoading));
			releaseReplay();
			await waitForReplayState(socialPage, 'ready');
			await socialPage.evaluate(() => window.__stakeQa.setTurbo(true));
			const socialReady = await replayUiAudit(socialPage);
			const socialReadySurface = await socialVisibleAudit('ready');
			const socialCode = currency === 'XSC' ? 'SC' : 'GC';
			const expectedSummary = `${socialMode.name.toUpperCase()} · 1.00 ${socialCode}`;
			expect(group, `${currency} ${socialMode.mode} replay currency is authoritative and formatted once`, socialReadySurface.currency === currency && socialReadySurface.summary === expectedSummary && `${socialReady.betCurrency} ${socialReady.betText}`.includes(socialCode) && !`${socialReady.betCurrency} ${socialReady.betText}`.includes(currency), JSON.stringify({ socialReady, socialReadySurface, expectedSummary }));
			expect(group, `${currency} ${socialMode.mode} ready lifecycle is explicit`, socialReadySurface.status === 'READY TO REPLAY', JSON.stringify(socialReadySurface));
			await activateVisibleReplayAction(socialPage);
			await waitForReplayState(socialPage, 'running');
			const socialRunning = await socialVisibleAudit('running');
			expect(group, `${currency} ${socialMode.mode} running lifecycle is explicit`, socialRunning.status === 'REPLAY RUNNING', JSON.stringify(socialRunning));
			await waitForReplayState(socialPage, 'completed', 30_000);
			const socialComplete = await replayUiAudit(socialPage);
			const socialCompletedSurface = await socialVisibleAudit('completed');
			expect(group, `${currency} ${socialMode.mode} completes with minimal copy and Play Again`, socialCompletedSurface.status === 'REPLAY COMPLETED' && socialComplete.actionText === 'Play Again' && socialComplete.actionAccessibleName === 'Play Again', JSON.stringify({ socialComplete, socialCompletedSurface }));
			if (socialMode.mode === 'bonus') {
				await screenshot(socialPage, `replay-social-${currency.toLowerCase()}-completed-1280x720`);
			}
			await screenshot(socialPage, `replay-social-${currency.toLowerCase()}-${socialMode.mode}-completed-1280x720`);
			await activateVisibleReplayAction(socialPage);
			await waitForReplayState(socialPage, 'running');
			await waitForReplayState(socialPage, 'completed', 30_000);
			const playAgainSurface = await socialVisibleAudit('completed after Play Again');
			expect(group, `${currency} ${socialMode.mode} Play Again reuses immutable replay without another request`, playAgainSurface.status === 'REPLAY COMPLETED' && socialCalls.replay.length === 1 && socialCalls.forbidden.length === 0, JSON.stringify(socialCalls));
			replayNetworkEvidence.push({ scenario: `social-${currency.toLowerCase()}-${socialMode.mode}`, viewport: 'desktop-1280x720', replayRequests: socialCalls.replay, forbiddenRequests: socialCalls.forbidden });
			replayValidationEvidence.push({ case: `social-${currency.toLowerCase()}-${socialMode.mode}`, expected: 'completed', actual: playAgainSurface, replayRequests: socialCalls.replay.length, forbiddenRequests: socialCalls.forbidden.length });
			await socialContext.close();
		}
	}

	const socialErrorContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
	const socialErrorCalls = await mockReplayRgs(socialErrorContext, () => ({ response: { status: 200, body: '{invalid-social-replay' } }));
	const socialErrorPage = await openPreview(socialErrorContext, base, replayQuery({ mode: 'base', event: 'stake-qa-social-xgc-error', currency: 'XGC' }));
	await waitForReplayState(socialErrorPage, 'error');
	const socialError = await socialErrorPage.evaluate(() => {
		const visible = (el) => {
			const style = getComputedStyle(el);
			const rect = el.getBoundingClientRect();
			return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
		};
		const attrs = [...document.querySelectorAll('[aria-label],[title],[alt]')]
			.filter(visible)
			.flatMap((el) => [el.getAttribute('aria-label'), el.getAttribute('title'), el.getAttribute('alt')].filter(Boolean))
			.join(' ');
		const text = document.body.innerText || '';
		return { text, attrs, status: document.getElementById('replay-status')?.textContent?.trim(), rawCodes: `${text} ${attrs}`.match(/\bX(?:G|S)C\b/g) || [] };
	});
	const socialErrorHits = playerVisibleForbiddenHits(`${socialError.text} ${socialError.attrs}`);
	expect(group, 'XGC Social Replay error is fail-closed and social-safe', socialError.status === 'REPLAY ERROR' && socialErrorHits.length === 0 && socialError.rawCodes.length === 0 && socialErrorCalls.replay.length === 1 && socialErrorCalls.forbidden.length === 0, JSON.stringify({ socialError, socialErrorHits, socialErrorCalls }));
	await screenshot(socialErrorPage, 'replay-social-xgc-error-1280x720');
	replayNetworkEvidence.push({ scenario: 'social-xgc-error', viewport: 'desktop-1280x720', replayRequests: socialErrorCalls.replay, forbiddenRequests: socialErrorCalls.forbidden });
	await socialErrorContext.close();

	const mxnContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
	let releaseMxnReplay;
	const mxnReplayGate = new Promise((resolveMxnReplay) => { releaseMxnReplay = resolveMxnReplay; });
	const mxnCalls = await mockReplayRgs(mxnContext, async () => {
		await mxnReplayGate;
		return { round: { ...baseReplayRound(), currency: 'MXN' } };
	});
	const mxnPage = await openPreview(mxnContext, base, replayQuery({ mode: 'base', event: 'stake-qa-normal-mxn-regression', currency: 'MXN' }));
	await waitForReplayState(mxnPage, 'loading');
	const mxnLoadingSurface = await visibleSurfaceAudit(mxnPage);
	const mxnLoadingHits = playerVisibleForbiddenHits(`${mxnLoadingSurface.text} ${mxnLoadingSurface.attrs}`);
	expect(group, 'normal MXN Replay loading state is globally safe', mxnLoadingHits.length === 0, mxnLoadingHits.join(', '));
	releaseMxnReplay();
	await waitForReplayState(mxnPage, 'ready');
	const mxnReady = await replayUiAudit(mxnPage);
	const mxnReadySurface = await visibleSurfaceAudit(mxnPage);
	const mxnReadyHits = playerVisibleForbiddenHits(`${mxnReadySurface.text} ${mxnReadySurface.attrs}`);
	expect(group, 'normal MXN Replay ready state uses Replay Play Amount', mxnReady.betLabel === 'REPLAY PLAY' && mxnReady.actionText === 'Start Replay' && mxnReadyHits.length === 0, JSON.stringify({ mxnReady, mxnReadyHits }));
	await mxnPage.evaluate(() => window.__stakeQa.setTurbo(true));
	await activateVisibleReplayAction(mxnPage);
	await waitForReplayState(mxnPage, 'running');
	const mxnRunningSurface = await visibleSurfaceAudit(mxnPage);
	const mxnRunningHits = playerVisibleForbiddenHits(`${mxnRunningSurface.text} ${mxnRunningSurface.attrs}`);
	expect(group, 'normal MXN Replay running state is globally safe', mxnRunningHits.length === 0, mxnRunningHits.join(', '));
	await waitForReplayState(mxnPage, 'completed', 30_000);
	const mxnReplay = await replayUiAudit(mxnPage);
	const mxnSurface = await visibleSurfaceAudit(mxnPage);
	const mxnRestrictedHits = playerVisibleForbiddenHits(`${mxnSurface.text} ${mxnSurface.attrs}`);
	expect(group, 'normal MXN Replay uses globally safe terminology and retains MX$ formatting', mxnReplay.statusText === 'REPLAY COMPLETED' && mxnReplay.betLabel === 'REPLAY PLAY' && mxnRestrictedHits.length === 0 && `${mxnReplay.betCurrency} ${mxnReplay.betText}`.includes('MX$') && mxnCalls.replay.length === 1 && mxnCalls.forbidden.length === 0, JSON.stringify({ mxnReplay, mxnRestrictedHits, mxnCalls }));
	await screenshot(mxnPage, 'replay-normal-mxn-completed-1280x720');
	await activateVisibleReplayAction(mxnPage);
	await waitForReplayState(mxnPage, 'running');
	await waitForReplayState(mxnPage, 'completed', 30_000);
	const mxnAgainSurface = await visibleSurfaceAudit(mxnPage);
	const mxnAgainHits = playerVisibleForbiddenHits(`${mxnAgainSurface.text} ${mxnAgainSurface.attrs}`);
	expect(group, 'normal MXN Play Again remains safe and reuses one immutable request', mxnAgainHits.length === 0 && mxnCalls.replay.length === 1 && mxnCalls.forbidden.length === 0, JSON.stringify({ mxnAgainHits, mxnCalls }));
	replayNetworkEvidence.push({ scenario: 'normal-mxn-regression', viewport: 'desktop-1280x720', replayRequests: mxnCalls.replay, forbiddenRequests: mxnCalls.forbidden });
	await mxnContext.close();

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
			response: () => ({ round: { ...baseReplayRound(), payoutMultiplier: 'not-a-number' } }),
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
			await activateVisibleReplayAction(page);
			await page.waitForFunction(() => ['completed', 'error'].includes(document.getElementById('stage')?.dataset.replayState), null, { timeout: 25_000 });
		}
		const errorAudit = await page.evaluate(() => {
			const action = document.getElementById('replay-start');
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
		const errorSurface = await visibleSurfaceAudit(page);
		const errorRestrictedHits = playerVisibleForbiddenHits(`${errorSurface.text} ${errorSurface.attrs}`);
		expect(group, `${errorCase.name} shows replay-specific error state`, errorAudit.state === 'error' && errorAudit.overlay && /replay|invalid|missing|unavailable|failed|error/i.test(errorAudit.status || ''), JSON.stringify(errorAudit));
		expect(group, `${errorCase.name} cannot start or fall back to demo output`, !errorAudit.action && !errorAudit.current && Number(errorAudit.win) === 0 && errorAudit.floats === 0, JSON.stringify(errorAudit));
		expect(group, `${errorCase.name} error state exposes zero restricted terms`, errorRestrictedHits.length === 0, errorRestrictedHits.join(', '));
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
		...['rgs_url', 'game', 'version', 'mode', 'event'].map((field) => ({ name: `missing-${field}`, mutate: (params) => params.delete(field) })),
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
		const launchSurface = await visibleSurfaceAudit(page);
		const launchRestrictedHits = playerVisibleForbiddenHits(`${launchSurface.text} ${launchSurface.attrs}`);
		expect(group, `${launchCase.name} produces a safe replay-specific error before network`, audit.state === 'error' && /replay|missing|invalid|malformed/i.test(audit.status || '') && !audit.current && Number(audit.win) === 0 && launchRestrictedHits.length === 0 && calls.replay.length === 0 && calls.forbidden.length === 0, JSON.stringify({ audit, launchRestrictedHits, calls }));
		replayValidationEvidence.push({ case: launchCase.name, expected: 'error-before-network', actual: audit, replayRequests: calls.replay.length, forbiddenRequests: calls.forbidden.length });
		await context.close();
	}
}

// ---------------------------------------------------------------------------
// 9. Normal RGS round-state matrix: active controls settlement, never win/loss
// ---------------------------------------------------------------------------
async function testRgsRoundStates(browser, base) {
	const group = 'rgs-round-states-e2e';
	const baseBook55473 = await readProductionBook('base_books.jsonl', 55473);
	expect(
		group,
		'normal RGS review fixture loads exact production base book 55473',
		baseBook55473.id === 55473
			&& baseBook55473.mode === 'base'
			&& baseBook55473.payoutMultiplier === 0
			&& JSON.stringify(baseBook55473.events.map((event) => event.type)) === JSON.stringify(['reveal', 'finalWin'])
			&& baseBook55473.events.at(-1)?.amount === 0,
		JSON.stringify({ id: baseBook55473.id, mode: baseBook55473.mode, payoutMultiplier: baseBook55473.payoutMultiplier, eventTypes: baseBook55473.events.map((event) => event.type) }),
	);
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
	const normalRound = ({ active, bookUnits, roundMode = 'base' }) => ({
		active,
		mode: roundMode,
		amount: API,
		payout: Math.round(API * bookUnits / 100),
		payoutMultiplier: bookUnits,
		state: bookUnits > 0
			? authoritativeClusterReplayRound({ symbol: 'L2', positions: columnPositions(0), bookUnits }).state
			: amountBoundaryReplayRound(0).state,
	});
	const settlementModes = ['base', 'hunt', 'rainbow', 'bonus_tier1', 'bonus'];
	for (const roundMode of settlementModes) {
		for (const active of [true, false]) {
			const bookUnits = 4448;
			const name = `${roundMode}-${active ? 'active' : 'inactive'}`;
			const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
			const calls = await mockRgs(context, {
				authenticate: () => ({ balance: balanceOf(1021.42, 'USD'), round: null }),
				play: () => ({ balance: balanceOf(1021.42, 'USD'), round: normalRound({ active, bookUnits, roundMode }) }),
				endRound: () => ({ balance: balanceOf(1065.90, 'USD'), round: { ...normalRound({ active: false, bookUnits, roundMode }), state: undefined } }),
			});
			const page = await openPreview(context, base, rgsQuery('USD'));
			await page.waitForFunction(() => window.__stakeQa.state.walletBusy === false);
			await page.evaluate(() => window.__stakeQa.setTurbo(true));
			await page.evaluate((modeName) => window.__stakeQa.spinRgsMode(modeName), roundMode);
			await page.waitForFunction(() => window.__stakeQa.state.spinning === false && window.__stakeQa.state.walletBusy === false, null, { timeout: 45_000 });
			const state = await gameState(page);
			const winText = await meterText(page, 'meter-win');
			const expectedBalance = active ? 1065.90 : 1021.42;
			const expectedOrder = active ? ['authenticate', 'play', 'end-round'] : ['authenticate', 'play'];
			expect(group, `${name} sends exactly one wallet play with the requested mode`, calls.play.length === 1 && calls.play[0]?.mode === roundMode, JSON.stringify(calls));
			expect(group, `${name} end-round count and order follow round.active only`, calls.endRound.length === (active ? 1 : 0) && JSON.stringify(calls.order) === JSON.stringify(expectedOrder), JSON.stringify(calls));
			expect(group, `${name} displays only the authoritative payout`, Math.abs(state.win - bookUnits / 100) <= 0.000001 && winText === `$${(bookUnits / 100).toFixed(2)}`, JSON.stringify({ state, winText }));
			expect(group, `${name} applies only the authoritative ${active ? 'End-Round' : 'Play-response'} balance`, Math.abs(state.balance - expectedBalance) <= 0.000001 && state.localWalletCredits === 0, JSON.stringify(state));
			const invariant = {
				mode: roundMode,
				active,
				playCalls: calls.play.length,
				endRoundCalls: calls.endRound.length,
				requestOrder: calls.order,
				playBalanceApi: balanceOf(1021.42, 'USD').amount,
				endRoundBalanceApi: active ? balanceOf(1065.90, 'USD').amount : null,
				expectedFinalBalance: expectedBalance.toFixed(2),
				actualFinalBalance: state.balance.toFixed(2),
				localWalletCredits: state.localWalletCredits,
				status: calls.play.length === 1 && calls.endRound.length === (active ? 1 : 0) && Math.abs(state.balance - expectedBalance) <= 0.000001 && state.localWalletCredits === 0 ? 'PASS' : 'FAIL',
			};
			balanceInvariantEvidence.push(invariant);
			walletNetworkEvidence.push({ scenario: name, calls, invariant });
			await context.close();
		}
	}

	// Stake review regression: regular gameplay must preserve the authoritative
	// sub-cent win while Balance and Play Amount retain normal USD formatting.
	// Event-style contract: $0.02 x 2.48 = $0.0496, never $0.05.
	const preciseBookUnits = 248;
	const preciseAmount = 20_000;
	const preciseWin = 0.0496;
	const preciseRound = {
		...authoritativeClusterReplayRound({ symbol: 'L2', positions: columnPositions(0), bookUnits: preciseBookUnits, amount: preciseAmount }),
		active: true,
		betID: 'stake-qa-regular-win-precision-26867',
	};
	const preciseContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
	const preciseCalls = await mockRgs(preciseContext, {
		authenticate: () => ({
			balance: balanceOf(1000, 'USD'),
			config: {
				currency: 'USD',
				betLevels: [preciseAmount],
				defaultBetLevel: preciseAmount,
				betModes: { base: {}, hunt: {}, rainbow: {}, bonus_tier1: {}, bonus: {} },
			},
			round: null,
		}),
		play: () => ({ balance: balanceOf(999.98, 'USD'), round: preciseRound }),
		endRound: () => ({
			balance: balanceOf(1000.0296, 'USD'),
			round: { ...cloneRound(preciseRound), active: false, state: undefined },
		}),
	});
	const precisePage = await openPreview(preciseContext, base, rgsQuery('USD'));
	await precisePage.waitForFunction(() => window.__stakeQa.state.walletBusy === false);
	await precisePage.evaluate(() => {
		window.__stakeQa.setTurbo(true);
		window.__stakeQaRegularWinFloats = [];
		window.__stakeQaRegularWinObserver = new MutationObserver(() => {
			for (const element of document.querySelectorAll('.cluster-float')) {
				const text = element.textContent?.trim() || '';
				if (text && !window.__stakeQaRegularWinFloats.includes(text)) window.__stakeQaRegularWinFloats.push(text);
			}
		});
		window.__stakeQaRegularWinObserver.observe(document.getElementById('stage'), { childList: true, subtree: true, characterData: true });
	});
	await precisePage.evaluate(() => window.__stakeQa.spinRgsMode('base'));
	await precisePage.waitForFunction(() => window.__stakeQa.state.spinning === false && window.__stakeQa.state.walletBusy === false, null, { timeout: 45_000 });
	const preciseAudit = await precisePage.evaluate(() => ({
		bet: window.__stakeQa.state.bet,
		win: window.__stakeQa.state.win,
		balance: window.__stakeQa.state.balance,
		winText: document.getElementById('meter-win')?.textContent?.trim(),
		balanceText: document.getElementById('meter-balance')?.textContent?.trim(),
		playText: document.getElementById('meter-bet')?.textContent?.trim(),
		floats: window.__stakeQaRegularWinFloats || [],
		localWalletCredits: window.__stakeQa.state.localWalletCredits,
	}));
	await precisePage.evaluate(() => window.__stakeQaRegularWinObserver?.disconnect());
	const preciseSucceeded = preciseCalls.play.length === 1
		&& preciseCalls.play[0]?.amount === preciseAmount
		&& preciseCalls.endRound.length === 1
		&& JSON.stringify(preciseCalls.order) === JSON.stringify(['authenticate', 'play', 'end-round'])
		&& Math.abs(preciseAudit.bet - 0.02) <= 0.000001
		&& Math.abs(preciseAudit.win - preciseWin) <= 0.000001
		&& preciseAudit.winText === '$0.0496'
		&& preciseAudit.floats.includes('+$0.0496')
		&& preciseAudit.playText === '$0.02'
		&& preciseAudit.balanceText === '$1000.03'
		&& Math.abs(preciseAudit.balance - 1000.0296) <= 0.000001
		&& preciseAudit.localWalletCredits === 0;
	expect(
		group,
		'regular gameplay renders exact $0.0496 win and float for $0.02 x 2.48 without changing Balance or Play precision',
		preciseSucceeded,
		JSON.stringify({ audit: preciseAudit, calls: preciseCalls }),
	);
	const preciseShot = await screenshot(precisePage, 'regular-gameplay-win-precision-0.0496-usd-1280x720');
	pass(group, 'regular gameplay exact $0.0496 WIN screenshot saved', preciseShot);
	const preciseInvariant = {
		case: 'regular-gameplay-0.02-usd-x-2.48',
		bookMultiplier: 2.48,
		playAmountApi: preciseAmount,
		expectedWin: '0.0496',
		actualWin: preciseAudit.win.toFixed(4),
		expectedWinText: '$0.0496',
		actualWinText: preciseAudit.winText,
		expectedBalanceText: '$1000.03',
		actualBalanceText: preciseAudit.balanceText,
		localWalletCredits: preciseAudit.localWalletCredits,
		status: preciseSucceeded ? 'PASS' : 'FAIL',
	};
	balanceInvariantEvidence.push(preciseInvariant);
	walletNetworkEvidence.push({ scenario: 'regular-gameplay-win-precision', calls: preciseCalls, invariant: preciseInvariant });
	await preciseContext.close();

	// Stake screenshot reproduction: a connected ten-symbol win is 0.96x in
	// the shipped paytable. At a $10 play amount the RGS therefore owns both
	// the visible $9.60 win and the $990.00 -> $999.60 settlement delta.
	const tenPositions = [...columnPositions(0), ...columnPositions(1)];
	const tenBookUnits = 96;
	const tenAmount = 10 * API;
	const tenWin = 9.60;
	const tenPaytable = productionMathConfig.paytable?.ten;
	expect(
		group,
		'shipped ten-symbol 9+ value is exactly 0.96x',
		Number(tenPaytable?.cluster5) * Number(tenPaytable?.cluster9Boost) === 0.96,
		JSON.stringify(tenPaytable),
	);
	const tenRound = {
		...authoritativeClusterReplayRound({ symbol: 'ten', positions: tenPositions, bookUnits: tenBookUnits, amount: tenAmount }),
		active: true,
		betID: 'stake-qa-ten-symbol-9-plus',
	};
	const tenContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
	const tenCalls = await mockRgs(tenContext, {
		authenticate: () => ({ balance: balanceOf(1000, 'USD'), round: null }),
		play: () => ({ balance: balanceOf(990, 'USD'), round: tenRound }),
		endRound: () => ({
			balance: balanceOf(999.60, 'USD'),
			round: { ...cloneRound(tenRound), active: false, state: undefined },
		}),
	});
	const tenPage = await openPreview(tenContext, base, rgsQuery('USD'));
	await tenPage.waitForFunction(() => window.__stakeQa.state.walletBusy === false);
	await tenPage.evaluate(() => {
		window.__stakeQa.state.bet = 10;
		window.__stakeQa.setTurbo(true);
	});
	await tenPage.evaluate(() => window.__stakeQa.spinRgsMode('base'));
	await tenPage.waitForFunction(() => window.__stakeQa.state.spinning === false && window.__stakeQa.state.walletBusy === false, null, { timeout: 45_000 });
	const tenState = await gameState(tenPage);
	const tenWinText = await meterText(tenPage, 'meter-win');
	const tenBalanceText = await meterText(tenPage, 'meter-balance');
	const tenSucceeded = tenCalls.play.length === 1
		&& tenCalls.play[0]?.amount === tenAmount
		&& tenCalls.endRound.length === 1
		&& JSON.stringify(tenCalls.order) === JSON.stringify(['authenticate', 'play', 'end-round'])
		&& Math.abs(tenState.win - tenWin) <= 0.000001
		&& tenWinText === '$9.60'
		&& Math.abs(tenState.balance - 999.60) <= 0.000001
		&& tenBalanceText === '$999.60'
		&& tenState.localWalletCredits === 0;
	expect(
		group,
		'$10 x 0.96 renders $9.60 and applies only the authoritative wallet delta',
		tenSucceeded,
		JSON.stringify({ state: tenState, winText: tenWinText, balanceText: tenBalanceText, calls: tenCalls }),
	);
	const tenInvariant = {
		case: 'ten-symbol-9-plus-at-10-usd',
		bookMultiplier: 0.96,
		playAmountApi: tenAmount,
		playBalanceApi: balanceOf(990, 'USD').amount,
		endRoundBalanceApi: balanceOf(999.60, 'USD').amount,
		expectedWin: tenWin.toFixed(2),
		actualWin: tenState.win.toFixed(2),
		expectedFinalBalance: '999.60',
		actualFinalBalance: tenState.balance.toFixed(2),
		localWalletCredits: tenState.localWalletCredits,
		status: tenSucceeded ? 'PASS' : 'FAIL',
	};
	balanceInvariantEvidence.push(tenInvariant);
	walletNetworkEvidence.push({ scenario: 'ten-symbol-9-plus-at-10-usd', calls: tenCalls, invariant: tenInvariant });
	await tenContext.close();

	// A normal wallet round is invalid when payout, payoutMultiplier and the
	// terminal finalWin describe different money. This must become a fatal,
	// non-playable state instead of picking whichever field looks plausible.
	const contradictionRound = {
		...authoritativeClusterReplayRound({ symbol: 'ten', positions: tenPositions, bookUnits: 270, amount: tenAmount }),
		active: false,
		betID: 'stake-qa-normal-rgs-contradiction',
		payout: balanceOf(2.76, 'USD').amount,
		payoutMultiplier: 270,
	};
	const contradictionContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
	const contradictionCalls = await mockRgs(contradictionContext, {
		authenticate: () => ({ balance: balanceOf(1000, 'USD'), round: null }),
		play: () => ({ balance: balanceOf(992.76, 'USD'), round: contradictionRound }),
	});
	const contradictionPage = await openPreview(contradictionContext, base, rgsQuery('USD'));
	await contradictionPage.waitForFunction(() => window.__stakeQa.state.walletBusy === false);
	await contradictionPage.evaluate(() => {
		window.__stakeQa.state.bet = 10;
		window.__stakeQa.setTurbo(true);
	});
	await contradictionPage.evaluate(() => window.__stakeQa.spinRgsMode('base'));
	await contradictionPage.waitForFunction(
		() => window.__stakeQa.state.fatal || (!window.__stakeQa.state.spinning && !window.__stakeQa.state.walletBusy),
		null,
		{ timeout: 45_000 },
	);
	const contradictionAudit = await contradictionPage.evaluate(() => ({
		fatal: window.__stakeQa.state.fatal,
		spinning: window.__stakeQa.state.spinning,
		walletBusy: window.__stakeQa.state.walletBusy,
		win: window.__stakeQa.state.win,
		balance: window.__stakeQa.state.balance,
		localWalletCredits: window.__stakeQa.state.localWalletCredits,
		title: document.querySelector('#fatal-error .fatal-error-title')?.textContent?.trim() || '',
		detail: document.querySelector('#fatal-error .fatal-error-detail')?.textContent?.trim() || '',
	}));
	const contradictionBlocked = contradictionAudit.fatal === true
		&& contradictionAudit.spinning === false
		&& contradictionAudit.walletBusy === false
		&& contradictionCalls.play.length === 1
		&& contradictionCalls.endRound.length === 0
		&& contradictionAudit.localWalletCredits === 0
		&& /inconsistent|invalid|validation|mismatch|unavailable|failed/i.test(`${contradictionAudit.title} ${contradictionAudit.detail}`);
	expect(
		group,
		'normal RGS payout/finalWin/payoutMultiplier contradiction fails closed',
		contradictionBlocked,
		JSON.stringify({ audit: contradictionAudit, calls: contradictionCalls }),
	);
	walletNetworkEvidence.push({
		scenario: 'normal-rgs-payout-contradiction',
		calls: contradictionCalls,
		invariant: {
			playAmountApi: tenAmount,
			payoutApi: contradictionRound.payout,
			payoutMultiplier: contradictionRound.payoutMultiplier,
			finalWinBookUnits: contradictionRound.state.at(-1)?.amount,
			fatal: contradictionAudit.fatal,
			localWalletCredits: contradictionAudit.localWalletCredits,
			status: contradictionBlocked ? 'BLOCKED_AS_REQUIRED' : 'FAIL',
		},
	});
	await contradictionContext.close();

	for (const invalidEndBalance of [
		{ name: 'missing', response: { round: { active: false } } },
		{ name: 'non-integer', response: { balance: { amount: balanceOf(1065.90, 'USD').amount + 0.5, currency: 'USD' }, round: { active: false } } },
	]) {
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		const calls = await mockRgs(context, {
			authenticate: () => ({ balance: balanceOf(1021.42, 'USD'), round: null }),
			play: () => ({ balance: balanceOf(1021.42, 'USD'), round: normalRound({ active: true, bookUnits: 4448 }) }),
			endRound: () => invalidEndBalance.response,
		});
		const page = await openPreview(context, base, rgsQuery('USD'));
		await page.waitForFunction(() => window.__stakeQa.state.walletBusy === false);
		await page.evaluate(() => window.__stakeQa.setTurbo(true));
		await page.click('#btn-spin');
		await page.waitForFunction(() => document.getElementById('fatal-error')?.classList.contains('show'), null, { timeout: 45_000 });
		const audit = await page.evaluate(() => ({
			fatal: window.__stakeQa.state.fatal,
			balance: window.__stakeQa.state.balance,
			localWalletCredits: window.__stakeQa.state.localWalletCredits,
			title: document.querySelector('#fatal-error .fatal-error-title')?.textContent?.trim(),
			detail: document.querySelector('#fatal-error .fatal-error-detail')?.textContent?.trim(),
		}));
		expect(group, `${invalidEndBalance.name} active End-Round balance fails closed without local credit`, audit.fatal && audit.balance === 1021.42 && audit.localWalletCredits === 0 && calls.play.length === 1 && calls.endRound.length === 1 && /settlement failed/i.test(audit.title || '') && /authoritative balance/i.test(audit.detail || ''), JSON.stringify({ audit, calls }));
		const invariant = {
			mode: 'base',
			active: true,
			case: `${invalidEndBalance.name}-end-round-balance`,
			playCalls: calls.play.length,
			endRoundCalls: calls.endRound.length,
			requestOrder: calls.order,
			playBalanceApi: balanceOf(1021.42, 'USD').amount,
			endRoundBalanceApi: invalidEndBalance.response.balance?.amount ?? null,
			actualFinalBalance: audit.balance.toFixed(2),
			localWalletCredits: audit.localWalletCredits,
			status: 'BLOCKED_AS_REQUIRED',
		};
		balanceInvariantEvidence.push(invariant);
		walletNetworkEvidence.push({ scenario: `${invalidEndBalance.name}-end-round-balance`, calls, invariant });
		await context.close();
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
	expect(group, 'unsupported normal RGS event state fails visibly with no local/random fallback', unsupported.state.fatal && !unsupported.state.spinning && unsupported.state.win === 0 && /(?:Unsupported|Inconsistent) game-service round/i.test(unsupported.title || '') && /(?:No local fallback|Nothing was reconstructed locally)/i.test(unsupported.detail || '') && unsupportedCalls.play.length === 1, JSON.stringify(unsupported));
	await unsupportedContext.close();

	// Stake-review regression: settlement must finish before the completion
	// presentation is dismissed, and Best Spin must be an individual spin.
	const featureCumulativeUnits = [0, 348, 1368, 2068, 2548, 3448, 3648, 4448];
	const featureEvents = [
		{ index: 0, type: 'reveal', board: quietBoard(), gameType: 'basegame' },
		{ index: 1, type: 'freeSpinTrigger', totalFs: 8, tier: 1, positions: [] },
	];
	let featureEventIndex = 2;
	let previousFeatureUnits = 0;
	for (let spinIndex = 0; spinIndex < featureCumulativeUnits.length; spinIndex += 1) {
		const cumulativeUnits = featureCumulativeUnits[spinIndex];
		const stepUnits = cumulativeUnits - previousFeatureUnits;
		featureEvents.push({ index: featureEventIndex++, type: 'updateFreeSpin', amount: spinIndex, total: 8, tier: 1 });
		if (stepUnits > 0) {
			featureEvents.push({
				index: featureEventIndex++,
				type: 'winInfo',
				totalWin: stepUnits,
				runningTotalWin: cumulativeUnits,
				wins: [{ symbol: 'L2', win: stepUnits, positions: columnPositions(0), meta: { multiplier: 1 } }],
			});
		}
		featureEvents.push({ index: featureEventIndex++, type: 'setTotalWin', amount: cumulativeUnits });
		previousFeatureUnits = cumulativeUnits;
	}
	featureEvents.push(
		{ index: featureEventIndex++, type: 'freeSpinEnd', amount: 4448 },
		{ index: featureEventIndex++, type: 'finalWin', amount: 4448 },
	);
	const featureContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
	const featureCalls = await mockRgs(featureContext, {
		authenticate: () => ({ balance: balanceOf(1021.42, 'USD'), round: null }),
		play: () => ({ balance: balanceOf(1021.42, 'USD'), round: { active: true, amount: API, mode: 'bonus_tier1', payout: 0, payoutMultiplier: 4448, state: featureEvents } }),
		endRound: () => ({ balance: balanceOf(1065.90, 'USD'), round: { active: false, amount: API, mode: 'bonus_tier1', payout: 44480000, payoutMultiplier: 4448 } }),
	});
	const featurePage = await openPreview(featureContext, base, rgsQuery('USD'));
	await featurePage.waitForFunction(() => window.__stakeQa.state.walletBusy === false);
	await featurePage.evaluate(() => window.__stakeQa.setTurbo(true));
	await featurePage.click('#btn-spin');
	await featurePage.waitForSelector('#bonus-intro.show');
	await featurePage.waitForTimeout(300);
	await featurePage.click('#bonus-intro');
	try {
		await featurePage.waitForFunction(() => window.__stakeQa.state.spinning === false && window.__stakeQa.state.walletBusy === false, null, { timeout: 45_000 });
	} catch (error) {
		const diagnostics = await featurePage.evaluate(() => ({
			state: window.__stakeQa.state,
			stage: document.getElementById('stage')?.dataset.replayState || null,
			fatal: document.getElementById('fatal-error')?.textContent?.trim() || null,
			calls: window.__stakeQa.Rgs?.calls || null,
		})).catch(() => null);
		throw new Error(`${error?.message || error} | feature diagnostics=${JSON.stringify(diagnostics)} | pageErrors=${JSON.stringify(featurePage.__stakeQaStartupErrors || [])}`);
	}
	await featurePage.waitForFunction(() => document.getElementById('bs-total')?.textContent?.includes('$44.48'), null, { timeout: 20_000 });
	const featureAudit = await featurePage.evaluate(() => ({
		balance: window.__stakeQa.state.balance,
		win: window.__stakeQa.state.win,
		localWalletCredits: window.__stakeQa.state.localWalletCredits,
		hudBalance: document.getElementById('meter-balance')?.textContent?.trim(),
		spins: document.getElementById('bs-spins')?.textContent?.trim(),
		best: document.getElementById('bs-best')?.textContent?.trim(),
		total: document.getElementById('bs-total')?.textContent?.trim(),
		summaryVisible: document.getElementById('bonus-summary')?.classList.contains('show'),
	}));
	const featureOrderIsValid = featureCalls.order[0] === 'authenticate'
		&& featureCalls.order[1] === 'play'
		&& featureCalls.order.at(-1) === 'end-round'
		&& featureCalls.order.slice(2, -1).every((entry) => entry === 'event-save');
	expect(group, '8-spin $44.48 feature sends one play and one end-round', featureCalls.play.length === 1 && featureCalls.endRound.length === 1, JSON.stringify(featureCalls));
	expect(group, '8-spin request order is authenticate → play → optional event saves → end-round', featureOrderIsValid, JSON.stringify(featureCalls.order));
	expect(group, 'active feature settlement does not wait for Continue', featureAudit.summaryVisible && featureAudit.balance === 1065.9 && featureAudit.hudBalance === '$1065.90', JSON.stringify(featureAudit));
	expect(group, '8-spin summary total and visible WIN are authoritative', featureAudit.total === '$44.48' && featureAudit.win === 44.48, JSON.stringify(featureAudit));
	expect(group, '8-spin summary shows true best individual spin', featureAudit.spins === '8' && featureAudit.best === '$10.20' && featureAudit.best !== featureAudit.total, JSON.stringify(featureAudit));
	expect(group, '8-spin active settlement applies zero local wallet credits', featureAudit.localWalletCredits === 0, JSON.stringify(featureAudit));
	const featureShot = await screenshot(featurePage, 'feature-summary-44-48-best-spin');
	pass(group, 'feature completion summary screenshot saved', featureShot);
	await featurePage.click('#bs-continue');
	await featurePage.waitForFunction(() => !document.getElementById('bonus-summary')?.classList.contains('show'));
	const afterContinue = await featurePage.evaluate(() => ({
		balance: window.__stakeQa.state.balance,
		win: window.__stakeQa.state.win,
		localWalletCredits: window.__stakeQa.state.localWalletCredits,
		hudBalance: document.getElementById('meter-balance')?.textContent?.trim(),
		summaryTotal: document.getElementById('bs-total')?.textContent?.trim(),
		summaryBest: document.getElementById('bs-best')?.textContent?.trim(),
	}));
	expect(group, 'Continue does not create a second payout or change authoritative results', featureCalls.endRound.length === 1
		&& afterContinue.balance === 1065.9
		&& afterContinue.hudBalance === '$1065.90'
		&& afterContinue.win === 44.48
		&& afterContinue.summaryTotal === '$44.48'
		&& afterContinue.summaryBest === '$10.20'
		&& afterContinue.localWalletCredits === 0, JSON.stringify({ afterContinue, featureCalls }));
	const featureInvariant = {
		scenario: 'stake-review-8-spin-44-48',
		mode: 'bonus_tier1',
		active: true,
		authenticateBalanceApi: balanceOf(1021.42, 'USD').amount,
		playBalanceApi: balanceOf(1021.42, 'USD').amount,
		endRoundBalanceApi: balanceOf(1065.90, 'USD').amount,
		authoritativeFinalWinBookUnits: 4448,
		authoritativeFinalWinApi: 44480000,
		featureSpins: 8,
		bestSpinBookUnits: 1020,
		playCalls: featureCalls.play.length,
		endRoundCallsBeforeContinue: 1,
		endRoundCallsAfterContinue: featureCalls.endRound.length,
		requestOrder: featureCalls.order,
		visibleWin: afterContinue.win.toFixed(2),
		summaryTotal: afterContinue.summaryTotal,
		bestSpin: afterContinue.summaryBest,
		finalHudBalance: afterContinue.hudBalance,
		localWalletCredits: afterContinue.localWalletCredits,
		status: featureCalls.play.length === 1 && featureCalls.endRound.length === 1 && featureOrderIsValid && afterContinue.balance === 1065.9 && afterContinue.win === 44.48 && afterContinue.localWalletCredits === 0 ? 'PASS' : 'FAIL',
	};
	balanceInvariantEvidence.push(featureInvariant);
	walletNetworkEvidence.push({ scenario: 'stake-review-8-spin-44-48', calls: featureCalls, invariant: featureInvariant });
	await featureContext.close();
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
		await guarded('intro', testIntro);
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
		identity: {
			testedCommitSha,
			startedAt,
			completedAt: new Date().toISOString(),
			githubActionsRunId: process.env.GITHUB_RUN_ID || null,
			githubActionsRunAttempt: process.env.GITHUB_RUN_ATTEMPT || null,
		},
		target: relative(root, previewFile).replaceAll('\\', '/'),
		frontendRoot: relative(root, frontendRoot).replaceAll('\\', '/'),
		mathConfig: relative(root, publishedMathFile).replaceAll('\\', '/'),
		mathBooksRoot: relative(root, productionBookRoot).replaceAll('\\', '/'),
		browser: browserVersion,
		infrastructure: {
			loopbackNavigationRetries,
		},
		summary,
		checks,
	}, null, 2));
	writeFileSync(join(artifactRoot, 'replay-validation-cases.json'), JSON.stringify({
		target: relative(root, previewFile).replaceAll('\\', '/'),
		mathConfig: relative(root, publishedMathFile).replaceAll('\\', '/'),
		mathBooksRoot: relative(root, productionBookRoot).replaceAll('\\', '/'),
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
	if (walletNetworkEvidence.length) {
		writeFileSync(join(artifactRoot, 'rgs-wallet-network-proof.json'), JSON.stringify({
			testedCommitSha,
			target: relative(root, previewFile).replaceAll('\\', '/'),
			apiUnitScale: 1_000_000,
			requiredOrder: 'authenticate -> play -> zero or more event-save -> optional end-round only when round.active is true',
			summary: {
				scenarios: walletNetworkEvidence.length,
				playCalls: walletNetworkEvidence.reduce((sum, item) => sum + item.calls.play.length, 0),
				endRoundCalls: walletNetworkEvidence.reduce((sum, item) => sum + item.calls.endRound.length, 0),
			},
			scenarios: walletNetworkEvidence,
		}, null, 2));
	}
	if (balanceInvariantEvidence.length) {
		writeFileSync(join(artifactRoot, 'balance-invariant-report.json'), JSON.stringify({
			testedCommitSha,
			target: relative(root, previewFile).replaceAll('\\', '/'),
			rule: 'Active rounds use only the integer /wallet/end-round balance; inactive rounds use only the integer /wallet/play balance; local wallet credits must remain zero in RGS mode.',
			summary: {
				rows: balanceInvariantEvidence.length,
				pass: balanceInvariantEvidence.filter((item) => item.status === 'PASS').length,
				blockedAsRequired: balanceInvariantEvidence.filter((item) => item.status === 'BLOCKED_AS_REQUIRED').length,
				fail: balanceInvariantEvidence.filter((item) => item.status === 'FAIL').length,
			},
			invariants: balanceInvariantEvidence,
		}, null, 2));
	}
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
			testedCommitSha,
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
	if (walletNetworkEvidence.length) console.log(`RGS wallet network proof: ${relative(root, join(artifactRoot, 'rgs-wallet-network-proof.json'))}`);
	if (balanceInvariantEvidence.length) console.log(`Balance invariant report: ${relative(root, join(artifactRoot, 'balance-invariant-report.json'))}`);
	if (summary.fail > 0) {
		console.error(`Stake QA e2e failed: ${summary.fail} failing check(s).`);
		process.exit(1);
	}
}

await main();
