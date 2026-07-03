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
 *        major-actions|interrupted-round|mobile|rules]
 */
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, normalize, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const clusterRoot = join(root, 'apps', 'cluster');
const previewFile = join(clusterRoot, 'preview.html');
const mode = (process.argv[2] || 'all').toLowerCase();
const artifactRoot = process.env.STAKE_QA_ARTIFACT_DIR
	|| join(root, 'artifacts', 'stake-qa', new Date().toISOString().replace(/[:.]/g, '-'));
const shotDir = join(artifactRoot, 'e2e-screenshots');

const checks = [];
const record = (group, name, status, detail = '') => checks.push({ group, name, status, detail });
const pass = (group, name, detail = '') => record(group, name, 'PASS', detail);
const fail = (group, name, detail = '') => record(group, name, 'FAIL', detail);
const expect = (group, name, condition, detail = '') => (condition ? pass(group, name, detail) : fail(group, name, detail));
const wants = (name) => mode === 'all' || mode === name;

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
// Tiny static file server for apps/cluster so preview.html resolves its
// relative src/assets/** URLs exactly like on a real deployment.
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
			const filePath = normalize(join(clusterRoot, pathname));
			if (!filePath.startsWith(clusterRoot) || !existsSync(filePath) || !statSync(filePath).isFile()) {
				res.writeHead(404);
				res.end('not found');
				return;
			}
			res.writeHead(200, { 'content-type': MIME[extname(filePath)] || 'application/octet-stream' });
			res.end(readFileSync(filePath));
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
	const calls = { authenticate: [], play: [], endRound: [], event: [], other: [] };
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
		calls.other.push(path);
		return reply({});
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

// ---------------------------------------------------------------------------
// Page helpers
// ---------------------------------------------------------------------------
async function openPreview(context, base, query = '') {
	const page = await context.newPage();
	page.setDefaultTimeout(20_000);
	await page.goto(`${base}/preview.html${query}`, { waitUntil: 'load' });
	await page.waitForFunction(() => window.__ggrReady === true);
	return page;
}
const meterText = (page, id) => page.evaluate((elId) => document.getElementById(elId)?.textContent?.trim() ?? null, id);
const modalOpen = (page, id) => page.evaluate((elId) => !!document.getElementById(elId)?.classList.contains('open'), id);
const gameState = (page) => page.evaluate(() => ({
	spinning: window.__ggr.state.spinning,
	walletBusy: window.__ggr.state.walletBusy,
	auto: window.__ggr.state.auto,
	autoRemaining: window.__ggr.state.autoRemaining,
	mode: window.__ggr.state.mode,
	balance: window.__ggr.state.balance,
	bet: window.__ggr.state.bet,
	currency: window.__ggr.state.currency,
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
async function testInsufficientFunds(browser, base) {
	const group = 'insufficient-funds-e2e';
	const runCase = async ({ currency, extra, expectedTitle }) => {
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		const calls = await mockRgs(context, {
			authenticate: () => ({ balance: balanceOf(0.01, currency), round: null }),
		});
		const page = await openPreview(context, base, rgsQuery(currency, extra));
		await page.waitForFunction(() => window.__ggr.state.walletBusy === false);
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
	await page.waitForFunction(() => window.__ggr.state.auto === true);
	pass(group, 'confirm starts auto-bet', 'state.auto === true after Confirm');
	await page.click('#btn-auto'); // toggle back off (stop is not a major action)
	await page.waitForFunction(() => window.__ggr.state.auto === false);
	await page.waitForFunction(() => window.__ggr.state.spinning === false, null, { timeout: 90_000 });
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
		let pending = window.__ggr.confirmMajorAction({ title: 'DOUBLE CHANCE', body: 'Enable Double Chance for a higher bet?' });
		await new Promise((r) => setTimeout(r, 80));
		results.modalOpen = document.getElementById('modal-major-confirm').classList.contains('open');
		results.title = document.getElementById('major-confirm-title').textContent;
		document.getElementById('major-confirm-yes').click();
		results.confirm = await pending;
		pending = window.__ggr.confirmMajorAction({ title: 'DOUBLE CHANCE', body: 'x' });
		await new Promise((r) => setTimeout(r, 80));
		document.getElementById('major-confirm-no').click();
		results.cancel = await pending;
		pending = window.__ggr.confirmMajorAction({ title: 'DOUBLE CHANCE', body: 'x' });
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
			spinning: window.__ggr.state.spinning,
			autoOpen: document.getElementById('modal-autospin').classList.contains('open'),
			buyOpen: document.getElementById('modal-bonusbuy').classList.contains('open'),
			interruptedStillOpen: document.getElementById('modal-interrupted-round').classList.contains('open'),
			walletBusy: window.__ggr.state.walletBusy,
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
		await page.waitForFunction(() => window.__ggr.state.spinning === false && window.__ggr.state.walletBusy === false, null, { timeout: 45_000 });

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
	try {
		browser = await launchChromium(playwright);
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
		await guarded('insufficient-funds', testInsufficientFunds);
		await guarded('major-actions', testMajorActions);
		await guarded('interrupted-round', testInterruptedRound);
		await guarded('mobile', testMobile);
		await guarded('rules', testRules);
	} finally {
		await browser.close().catch(() => {});
		server.close();
	}

	mkdirSync(artifactRoot, { recursive: true });
	const summary = {
		pass: checks.filter((check) => check.status === 'PASS').length,
		fail: checks.filter((check) => check.status === 'FAIL').length,
	};
	writeFileSync(join(artifactRoot, 'e2e-report.json'), JSON.stringify({ mode, summary, checks }, null, 2));
	for (const check of checks) {
		console.log(`${check.status} [${check.group}] ${check.name}${check.detail ? ` - ${check.detail}` : ''}`);
	}
	console.log(`Stake QA e2e report: ${relative(root, join(artifactRoot, 'e2e-report.json'))} (screenshots: ${relative(root, shotDir)})`);
	if (summary.fail > 0) {
		console.error(`Stake QA e2e failed: ${summary.fail} failing check(s).`);
		process.exit(1);
	}
}

await main();
