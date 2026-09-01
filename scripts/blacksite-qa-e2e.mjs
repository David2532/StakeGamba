#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	statSync,
	writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	CLUSTER_BANDS,
	CONTROL_GUIDE,
	RULES_CONTRACT,
	SYMBOL_PAYOUTS,
	getRulesDisclaimer,
} from '../apps/blacksite/src/lib/contracts/rules.js';
import { BASE_ZERO_FIXTURE } from '../apps/blacksite/src/lib/fixtures/base-zero.js';
import { encodePresentationCursor } from '../apps/blacksite/src/lib/rgs/contracts.js';
import { formatExactApi } from '../apps/blacksite/src/lib/runtime/display-money.js';
import { MOTION_STORAGE_KEY } from '../apps/blacksite/src/lib/runtime/motion-preference.js';
import {
	FIXTURE_IDS as GENERATED_FIXTURE_IDS,
	getFixture as getGeneratedFixture,
} from '../apps/blacksite/src/lib/fixtures/catalog.generated.js';
import { playerVisibleRestrictedHits } from '../packages/utils-shared/stake-social.js';
import {
	BLACKSITE_QA_RGS_ORIGIN,
	installMockRgs,
	mockHttpResponse,
} from '../apps/blacksite/tests/browser/mock-rgs.mjs';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDirectory, '..');
const requestedBuildRoot = process.env.BLACKSITE_QA_BUILD_ROOT?.trim();
const buildRoot = requestedBuildRoot
	? resolve(repoRoot, requestedBuildRoot)
	: join(repoRoot, 'apps', 'blacksite', 'build');
const buildEntry = join(buildRoot, 'index.html');
const expectedBuildTreeSha256 = process.env.BLACKSITE_QA_EXPECTED_BUILD_TREE_SHA256?.trim() ?? '';
const startedAt = new Date().toISOString();
const timestamp = startedAt.replace(/[:.]/g, '-');
const artifactRoot = join(repoRoot, 'artifacts', 'blacksite-qa', timestamp);
const screenshotRoot = join(artifactRoot, 'screenshots');
const evidenceFile = join(artifactRoot, 'blacksite-browser-evidence.json');

const SESSION_ID = 'blacksite-qa-session';
const API_UNIT = 1_000_000;
const DEFAULT_BASE_AMOUNT = API_UNIT;
const DEFAULT_BALANCE = 1_000 * API_UNIT;
const REPLAY_VERSION = '0.1.0-m2';
const MODE_COSTS = Object.freeze({ base: 1, deep_access: 4, blackout: 80 });

const SELECTORS = Object.freeze({
	playerHud: '[data-testid="player-hud"]',
	launchStatus: '[data-testid="launch-status"]',
	launchError: '[data-testid="launch-error"]',
	board: '[data-testid="board"]',
	vaultkeeper: '[data-testid="vaultkeeper-presence"]',
	vaultkeeperFallback: '[data-testid="vaultkeeper-safe-fallback"]',
	primaryAction: '[data-testid="primary-action"]',
	motionMode: '[data-testid="motion-mode"]',
	skipPresentation: '[data-testid="skip-presentation"]',
	soundAction: '[data-testid="sound-action"]',
	modeBase: '[data-testid="mode-base"]',
	modeDeepAccess: '[data-testid="mode-deep_access"]',
	modeBlackout: '[data-testid="mode-blackout"]',
	baseAmount: '[data-testid="base-amount"]',
	walletBalance: '[data-testid="wallet-balance"]',
	totalPlay: '[data-testid="total-play"]',
	finalWin: '[data-testid="final-win"]',
	boardStatus: '[data-testid="board-status"]',
	sessionNetPosition: '[data-testid="session-net-position"]',
	sessionTimer: '[data-testid="session-timer"]',
});

const MIME_TYPES = Object.freeze({
	'.css': 'text/css; charset=utf-8',
	'.html': 'text/html; charset=utf-8',
	'.ico': 'image/x-icon',
	'.js': 'text/javascript; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.mp3': 'audio/mpeg',
	'.ogg': 'audio/ogg',
	'.png': 'image/png',
	'.svg': 'image/svg+xml',
	'.webp': 'image/webp',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
});

const viewports = Object.freeze([
	{ name: 'desktop-1920x1080', width: 1920, height: 1080, minBoard: 320 },
	{ name: 'desktop-1366x768', width: 1366, height: 768, minBoard: 300 },
	{
		name: 'phone-360x740',
		width: 360,
		height: 740,
		minBoard: 240,
		isMobile: true,
		hasTouch: true,
	},
	{
		name: 'phone-390x844',
		width: 390,
		height: 844,
		minBoard: 280,
		isMobile: true,
		hasTouch: true,
	},
	{
		name: 'tablet-768x1024',
		width: 768,
		height: 1024,
		minBoard: 340,
		isMobile: true,
		hasTouch: true,
	},
	{
		name: 'landscape-844x390',
		width: 844,
		height: 390,
		minBoard: 180,
		isMobile: true,
		hasTouch: true,
	},
]);

const replayViewports = Object.freeze([
	{
		name: 'replay-popout-s-360x640',
		width: 360,
		height: 640,
		minBoard: 220,
		isMobile: true,
		hasTouch: true,
		assumption:
			'Conservative 360x640 small-popout proxy; no first-party exact Popout-S pixel contract is asserted.',
	},
]);

const sourceIdentityTargets = Object.freeze([
	join(repoRoot, 'apps', 'blacksite', 'package.json'),
	join(repoRoot, 'apps', 'blacksite', 'svelte.config.js'),
	join(repoRoot, 'apps', 'blacksite', 'tsconfig.json'),
	join(repoRoot, 'apps', 'blacksite', 'vite.config.js'),
	join(repoRoot, 'apps', 'blacksite', 'scripts'),
	join(repoRoot, 'apps', 'blacksite', 'src'),
	join(repoRoot, 'apps', 'blacksite', 'static'),
	join(repoRoot, 'apps', 'blacksite', 'tests'),
	join(repoRoot, 'packages', 'utils-shared', 'currency.js'),
	join(repoRoot, 'packages', 'utils-shared', 'stake-social.js'),
	join(repoRoot, 'packages', 'config-svelte', 'index.js'),
	join(repoRoot, 'packages', 'config-svelte', 'package.json'),
	join(repoRoot, 'package.json'),
	join(repoRoot, 'pnpm-lock.yaml'),
	join(repoRoot, 'scripts', 'blacksite-qa-e2e.mjs'),
	join(repoRoot, 'scripts', 'blacksite-package-candidate.mjs'),
	join(repoRoot, 'scripts', 'blacksite-package-verify.mjs'),
]);

const gitSha = spawnSync('git', ['rev-parse', 'HEAD'], {
	cwd: repoRoot,
	encoding: 'utf8',
}).stdout.trim();
const gitStatus = spawnSync('git', ['status', '--porcelain'], {
	cwd: repoRoot,
	encoding: 'utf8',
}).stdout.trim();

const evidence = {
	identity: {
		startedAt,
		completedAt: null,
		testedGitSha: gitSha,
		worktreeDirty: gitStatus !== '',
		testedBuildRoot: buildRoot,
		expectedBuildTreeSha256: expectedBuildTreeSha256 || null,
		buildTreeSha256: null,
		sourceTreeSha256: null,
	},
	target: relative(repoRoot, buildEntry).replaceAll('\\', '/'),
	playwright: {
		version: null,
		browser: null,
		executable: null,
	},
	selectors: SELECTORS,
	viewports: [...viewports, ...replayViewports],
	viewportAssumptions: replayViewports.map(({ name, assumption }) => ({ name, assumption })),
	manifests: {
		build: null,
		sources: null,
	},
	productionBuildScan: null,
	scenarios: [],
	geometry: [],
	checks: [],
	summary: null,
};

class QaAssertionError extends Error {
	constructor(message) {
		super(message);
		this.name = 'QaAssertionError';
	}
}

function serialize(value) {
	try {
		return JSON.stringify(value);
	} catch {
		return String(value);
	}
}

function collectFiles(target, files = []) {
	const targetStats = statSync(target);
	if (targetStats.isFile()) {
		files.push(target);
		return files;
	}
	if (!targetStats.isDirectory()) return files;
	for (const entry of readdirSync(target, { withFileTypes: true }).sort((a, b) =>
		a.name.localeCompare(b.name, 'en'))) {
		const child = join(target, entry.name);
		if (entry.isDirectory()) collectFiles(child, files);
		else if (entry.isFile()) files.push(child);
	}
	return files;
}

function createFileManifest(targets, baseDirectory) {
	const absoluteFiles = [...new Set(targets.flatMap((target) => collectFiles(target)))].sort(
		(left, right) =>
			relative(baseDirectory, left).replaceAll('\\', '/').localeCompare(
				relative(baseDirectory, right).replaceAll('\\', '/'),
				'en',
			),
	);
	const treeHash = createHash('sha256');
	const files = absoluteFiles.map((absolutePath) => {
		const path = relative(baseDirectory, absolutePath).replaceAll('\\', '/');
		const bytes = readFileSync(absolutePath);
		const pathBytes = Buffer.byteLength(path, 'utf8');
		treeHash.update(Buffer.from(`${pathBytes}\0${path}\0${bytes.length}\0`, 'utf8'));
		treeHash.update(bytes);
		return {
			path,
			bytes: bytes.length,
			sha256: createHash('sha256').update(bytes).digest('hex'),
		};
	});
	return {
		algorithm:
			'sha256(path UTF-8 byte length + NUL + sorted relative path + NUL + file byte length + NUL + file bytes)',
		treeSha256: treeHash.digest('hex'),
		fileCount: files.length,
		totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
		files,
	};
}

function scanProductionBuild(buildManifest) {
	const textExtensions = new Set(['.css', '.html', '.js', '.json', '.mjs', '.svg', '.txt']);
	const textFiles = buildManifest.files.filter((file) => textExtensions.has(extname(file.path).toLowerCase()));
	const loaderPatterns = [
		/stake[-_ ]engine[-_ ]loader/iu,
		/stakeEngineLoader/iu,
		/stake-engine-loader\.gif/iu,
	];
	const loaderHits = [];
	const generatedFixtureHits = [];
	let textBytesScanned = 0;
	let concatenatedText = '';
	for (const file of textFiles) {
		const text = readFileSync(join(buildRoot, file.path), 'utf8');
		textBytesScanned += Buffer.byteLength(text, 'utf8');
		concatenatedText += `\n${text}`;
		for (const pattern of loaderPatterns) {
			if (pattern.test(file.path) || pattern.test(text)) {
				loaderHits.push({ path: file.path, pattern: pattern.source });
			}
		}
		if (
			/catalog\.generated/iu.test(file.path) ||
			/catalog\.generated/iu.test(text) ||
			/build-fixture-catalog/iu.test(text)
		) {
			generatedFixtureHits.push({ path: file.path, signature: 'generated-catalog' });
		}
		for (const fixtureId of GENERATED_FIXTURE_IDS) {
			if (text.includes(fixtureId)) {
				generatedFixtureHits.push({ path: file.path, signature: `fixture-id:${fixtureId}` });
			}
		}
	}
	for (const file of buildManifest.files) {
		if (loaderPatterns.some((pattern) => pattern.test(file.path))) {
			loaderHits.push({ path: file.path, pattern: 'filename' });
		}
		if (/catalog\.generated/iu.test(file.path)) {
			generatedFixtureHits.push({ path: file.path, signature: 'generated-catalog-filename' });
		}
	}

	const html = readFileSync(buildEntry, 'utf8');
	const viewportTag = html.match(/<meta\s+[^>]*name=["']viewport["'][^>]*>/iu)?.[0] ?? null;
	const viewportContent = viewportTag?.match(/content=["']([^"']+)["']/iu)?.[1] ?? null;
	return {
		textFilesScanned: textFiles.length,
		textBytesScanned,
		loaderHits,
		generatedFixtureHits,
		viewportMeta: {
			tag: viewportTag,
			content: viewportContent,
		},
		touchActionManipulationPresent: /touch-action\s*:\s*manipulation/iu.test(concatenatedText),
	};
}

function check(group, name, condition, detail = '') {
	const status = condition ? 'PASS' : 'FAIL';
	evidence.checks.push({ group, name, status, detail });
	if (!condition) throw new QaAssertionError(`${group}: ${name}${detail ? ` (${detail})` : ''}`);
}

function recordFailure(group, error) {
	evidence.checks.push({
		group,
		name: 'scenario completed without an uncaught error',
		status: 'FAIL',
		detail: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
	});
}

function successStatus() {
	return { statusCode: 'SUCCESS', statusMessage: 'BLACKSITE QA mock success' };
}

function jurisdiction(overrides = {}) {
	return {
		socialCasino: false,
		disabledFullscreen: false,
		disabledTurbo: false,
		disabledSuperTurbo: false,
		disabledAutoplay: true,
		disabledSlamstop: false,
		disabledSpacebar: false,
		disabledBuyFeature: false,
		displayNetPosition: false,
		displayRTP: true,
		displaySessionTimer: false,
		minimumRoundDuration: 0,
		...overrides,
	};
}

function authenticateResponse({
	balance = DEFAULT_BALANCE,
	currency = 'USD',
	round = null,
	betConfig = {},
	jurisdictionOverrides = {},
} = {}) {
	const defaultBetModes = {
		base: { mode: 'base', costMultiplier: 1, feature: false },
		deep_access: { mode: 'deep_access', costMultiplier: 4, feature: true },
		blackout: { mode: 'blackout', costMultiplier: 80, feature: true },
	};
	return {
		status: successStatus(),
		balance: { amount: balance, currency },
		config: {
			gameID: 'blacksite_breach',
			minBet: 100_000,
			maxBet: 10_000_000,
			stepBet: 100_000,
			defaultBetLevel: DEFAULT_BASE_AMOUNT,
			betLevels: [100_000, 500_000, 1_000_000, 2_000_000, 5_000_000],
			betModes: defaultBetModes,
			...betConfig,
			jurisdiction: jurisdiction(jurisdictionOverrides),
		},
		round,
	};
}

function authoritativeZeroRound({
	active = false,
	id = 'blacksite-qa-zero',
	amount = DEFAULT_BASE_AMOUNT,
	currency = 'USD',
	mode = 'base',
	event = null,
} = {}) {
	const fixture = mode === 'base' ? BASE_ZERO_FIXTURE : getGeneratedFixture(`${mode}_zero`);
	if (!fixture) throw new Error(`Missing authoritative zero fixture for ${mode}`);
	return {
		active,
		amount,
		betID: id,
		currency,
		event,
		mode,
		payout: 0,
		payoutMultiplier: fixture.book.payoutMultiplier,
		state: structuredClone(fixture.book.events),
	};
}

function authoritativeFixtureRound({
	fixture,
	active = true,
	id = 'blacksite-qa-fixture-round',
	amount = DEFAULT_BASE_AMOUNT,
	currency = 'USD',
	event = null,
} = {}) {
	if (!fixture?.mathBacked || !fixture.book || !MODE_COSTS[fixture.mode]) {
		throw new Error(`Missing math-backed fixture round: ${fixture?.id}`);
	}
	const payoutNumerator = amount * fixture.book.payoutMultiplier;
	if (!Number.isSafeInteger(payoutNumerator) || payoutNumerator % 100 !== 0) {
		throw new Error(`Fixture payout is not exactly representable in API units: ${fixture.id}`);
	}
	return {
		active,
		amount,
		betID: id,
		currency,
		event,
		mode: fixture.mode,
		payout: payoutNumerator / 100,
		payoutMultiplier: fixture.book.payoutMultiplier / 100,
		state: structuredClone(fixture.book.events),
	};
}

function playResponse({
	active = false,
	amount = DEFAULT_BASE_AMOUNT,
	mode = 'base',
	currency = 'USD',
	balanceBefore = DEFAULT_BALANCE,
} = {}) {
	const balanceAfter = balanceBefore - amount * MODE_COSTS[mode];
	return {
		status: successStatus(),
		balance: { amount: balanceAfter, currency },
		round: authoritativeZeroRound({
			active,
			amount,
			currency,
			mode,
			id: active ? 'blacksite-qa-active-play' : 'blacksite-qa-inactive-play',
		}),
	};
}

function endRoundResponse({
	balance = DEFAULT_BALANCE - DEFAULT_BASE_AMOUNT,
	currency = 'USD',
} = {}) {
	return {
		status: successStatus(),
		balance: { amount: balance, currency },
	};
}

function replayResponse() {
	return replayResponseFromFixture(BASE_ZERO_FIXTURE);
}

function replayResponseFromFixture(fixture) {
	if (!fixture?.mathBacked || !fixture.book || !MODE_COSTS[fixture.mode]) {
		throw new Error(`Replay QA fixture is not a math-backed canonical mode: ${fixture?.id}`);
	}
	const packagePayoutCentiX = fixture.book.payoutMultiplier;
	const terminalPayoutCentiX = fixture.book.events.at(-1)?.payout_multiplier_raw;
	if (
		!Number.isSafeInteger(packagePayoutCentiX) ||
		packagePayoutCentiX < 0 ||
		terminalPayoutCentiX !== packagePayoutCentiX
	) {
		throw new Error(`Replay QA fixture payout identity is invalid: ${fixture.id}`);
	}
	return {
		// Replay speaks multiplier-x while math books and round_end speak centi-x.
		payoutMultiplier: packagePayoutCentiX / 100,
		costMultiplier: MODE_COSTS[fixture.mode],
		state: { events: structuredClone(fixture.book.events) },
	};
}

function expectedCentiMultiplierText(payoutCentiX) {
	const whole = Math.floor(payoutCentiX / 100);
	const fraction = String(payoutCentiX % 100).padStart(2, '0').replace(/0+$/, '');
	return `${whole}${fraction ? `.${fraction}` : ''}×`;
}

function exactReplayProductUnits(amountUnitsRaw, multiplier, multiplierScale = 0) {
	const match = /^(0|[1-9]\d*)(?:\.(\d+))?$/.exec(amountUnitsRaw);
	if (!match || !Number.isSafeInteger(multiplier) || multiplier < 0) {
		throw new Error(`Invalid exact Replay product inputs: ${serialize({ amountUnitsRaw, multiplier, multiplierScale })}`);
	}
	const fraction = match[2] ?? '';
	const scale = fraction.length + multiplierScale;
	const amountDigits = BigInt(`${match[1]}${fraction}`);
	let text = (amountDigits * BigInt(multiplier)).toString().padStart(scale + 1, '0');
	if (scale > 0) {
		text = `${text.slice(0, -scale)}.${text.slice(-scale)}`;
		while (text.includes('.') && text.endsWith('0')) text = text.slice(0, -1);
		if (text.endsWith('.')) text = text.slice(0, -1);
	}
	return text;
}

function decorateExpectedReplayUnits(units, currency) {
	if (currency === 'USD') return `$${units} units`;
	if (currency === 'EUR') return `€${units} units`;
	if (currency === 'XSC') return `${units} SC units`;
	if (currency === 'XGC') return `${units} GC units`;
	return `${units} ${currency} units`;
}

function expectedReplayTotalPlay(amountUnitsRaw, costMultiplier, currency) {
	return decorateExpectedReplayUnits(
		exactReplayProductUnits(amountUnitsRaw, costMultiplier),
		currency,
	);
}

function expectedReplayFinalWin(amountUnitsRaw, payoutCentiX, currency) {
	return decorateExpectedReplayUnits(
		exactReplayProductUnits(amountUnitsRaw, payoutCentiX, 2),
		currency,
	);
}

function invalidReplayResponse() {
	return {
		payoutMultiplier: 0,
		costMultiplier: 1,
		state: {
			events: [{ index: 0, type: 'not_a_blacksite_event' }],
		},
	};
}

function liveQuery(overrides = {}) {
	const params = new URLSearchParams({
		sessionID: SESSION_ID,
		rgs_url: BLACKSITE_QA_RGS_ORIGIN,
		currency: 'USD',
		lang: 'en',
		device: 'desktop',
		...overrides,
	});
	return `?${params.toString()}`;
}

function replayQuery(overrides = {}) {
	const params = new URLSearchParams({
		replay: 'true',
		game: 'blacksite_breach',
		version: REPLAY_VERSION,
		mode: 'base',
		event: '1',
		rgs_url: BLACKSITE_QA_RGS_ORIGIN,
		currency: 'USD',
		amount: String(DEFAULT_BASE_AMOUNT),
		lang: 'en',
		device: 'desktop',
		...overrides,
	});
	return `?${params.toString()}`;
}

function startStaticServer() {
	const rootPrefix = `${resolve(buildRoot)}${sep}`;
	const server = createServer((request, response) => {
		try {
			if (!['GET', 'HEAD'].includes(request.method ?? '')) {
				response.writeHead(405, { 'cache-control': 'no-store' });
				response.end('method not allowed');
				return;
			}

			const url = new URL(request.url ?? '/', 'http://127.0.0.1');
			const pathname = decodeURIComponent(url.pathname);
			const requested = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
			const file = resolve(buildRoot, requested);
			if (!file.startsWith(rootPrefix) || !existsSync(file) || !statSync(file).isFile()) {
				response.writeHead(404, { 'cache-control': 'no-store' });
				response.end('not found');
				return;
			}

			const body = readFileSync(file);
			response.writeHead(200, {
				'cache-control': 'no-store',
				'content-type': MIME_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
			});
			if (request.method === 'HEAD') response.end();
			else response.end(body);
		} catch (error) {
			response.writeHead(500, { 'cache-control': 'no-store' });
			response.end(error instanceof Error ? error.message : 'server error');
		}
	});

	return new Promise((resolvePromise, rejectPromise) => {
		server.once('error', rejectPromise);
		server.listen(0, '127.0.0.1', () => {
			const address = server.address();
			if (!address || typeof address === 'string') {
				rejectPromise(new Error('BLACKSITE QA static server did not expose a TCP port'));
				return;
			}
			resolvePromise({ server, origin: `http://127.0.0.1:${address.port}` });
		});
	});
}

function resolvePlaywright() {
	const attempts = [];
	const candidates = [process.env.STAKE_QA_PLAYWRIGHT_DIR, repoRoot, scriptDirectory].filter(Boolean);
	for (const base of candidates) {
		try {
			const requireFrom = createRequire(join(base, 'blacksite-qa-loader.cjs'));
			const playwright = requireFrom('playwright');
			const packageJson = requireFrom('playwright/package.json');
			return { playwright, version: packageJson.version };
		} catch (error) {
			attempts.push(`${base}: ${error instanceof Error ? error.message : String(error)}`);
		}
	}
	throw new Error(`Playwright could not be loaded. ${attempts.join(' | ')}`);
}

async function launchBrowser(playwright) {
	const candidates = [
		process.env.STAKE_QA_CHROMIUM,
		'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
		'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
		undefined,
	];
	const attempted = [];
	for (const executablePath of [...new Set(candidates)]) {
		if (executablePath && !existsSync(executablePath)) continue;
		try {
			const browser = await playwright.chromium.launch({
				headless: true,
				...(executablePath ? { executablePath } : {}),
			});
			return { browser, executablePath: executablePath ?? 'playwright-default' };
		} catch (error) {
			attempted.push(
				`${executablePath ?? 'playwright-default'}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}
	throw new Error(`Chromium could not be launched. ${attempted.join(' | ')}`);
}

function pageDiagnostics(page) {
	const diagnostics = { consoleErrors: [], pageErrors: [], failedRequests: [] };
	page.on('console', (message) => {
		if (message.type() === 'error') diagnostics.consoleErrors.push(message.text());
	});
	page.on('pageerror', (error) => diagnostics.pageErrors.push(error.message));
	page.on('requestfailed', (request) => {
		diagnostics.failedRequests.push({
			method: request.method(),
			url: request.url(),
			error: request.failure()?.errorText ?? null,
		});
	});
	return diagnostics;
}

async function waitForEndpoint(network, endpoint, count, timeoutMs = 10_000) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (network.byEndpoint[endpoint].length >= count) return;
		await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
	}
	throw new Error(`Timed out waiting for ${endpoint} request count ${count}`);
}

async function runtimeState(page) {
	return page.evaluate(
		() => document.documentElement.dataset.runtimeState ?? document.body.dataset.runtimeState ?? null,
	);
}

async function waitForRuntimeState(page, expectedState, timeoutMs = 10_000) {
	await page.waitForFunction(
		(expected) =>
			(document.documentElement.dataset.runtimeState ??
				document.body.dataset.runtimeState ??
				null) === expected,
		expectedState,
		{ timeout: timeoutMs },
	);
}

async function waitForStableAction(page, timeoutMs = 10_000) {
	await page.locator(SELECTORS.primaryAction).waitFor({ state: 'visible', timeout: timeoutMs });
	await page.waitForFunction(
		(selector) => {
			const action = document.querySelector(selector);
			const state =
				document.documentElement.dataset.runtimeState ?? document.body.dataset.runtimeState ?? '';
			return (
				action &&
				!action.disabled &&
				!/(?:booting|authenticating|loading|playing|presenting|settling)/i.test(state)
			);
		},
		SELECTORS.primaryAction,
		{ timeout: timeoutMs },
	);
}

async function waitForReplayComplete(page, timeoutMs = 20_000) {
	await page.waitForFunction(
		(selector) => {
			const action = document.querySelector(selector);
			const state =
				document.documentElement.dataset.runtimeState ?? document.body.dataset.runtimeState ?? '';
			return (
				action &&
				!action.disabled &&
				(/replay[-_ ]?completed/i.test(state) || /play\s+again/i.test(action.textContent ?? ''))
			);
		},
		SELECTORS.primaryAction,
		{ timeout: timeoutMs },
	);
}

async function openPage(context, origin, query) {
	const page = await context.newPage();
	const diagnostics = pageDiagnostics(page);
	await page.goto(`${origin}/${query}`, { waitUntil: 'domcontentloaded', timeout: 15_000 });
	await page.locator(SELECTORS.launchStatus).waitFor({ state: 'visible', timeout: 10_000 });
	return { page, diagnostics };
}

async function saveScreenshot(page, name) {
	await waitForAssetPaint(page);
	mkdirSync(screenshotRoot, { recursive: true });
	const path = join(screenshotRoot, `${name}.png`);
	await page.screenshot({ path, fullPage: false });
	return relative(repoRoot, path).replaceAll('\\', '/');
}

async function waitForAssetPaint(page, timeoutMs = 10_000) {
	await page.waitForFunction(
		() => {
			const character = document.querySelector('[data-testid="vaultkeeper-presence"]');
			const environment = document.querySelector('[data-testid="vault-environment"]');
			const characterState = character?.getAttribute('data-asset-paint-state');
			const environmentState = environment?.getAttribute('data-asset-paint-state');
			return (
				['painted', 'fallback'].includes(characterState ?? '') &&
				['painted', 'failed'].includes(environmentState ?? '')
			);
		},
		undefined,
		{ timeout: timeoutMs },
	);
	const states = await page.evaluate(() => ({
		body: document.body.dataset.assetPaintState ?? null,
		character:
			document
				.querySelector('[data-testid="vaultkeeper-presence"]')
				?.getAttribute('data-asset-paint-state') ?? null,
		environment:
			document
				.querySelector('[data-testid="vault-environment"]')
				?.getAttribute('data-asset-paint-state') ?? null,
	}));
	assert.equal(states.body, 'painted', `Asset paint barrier failed: ${serialize(states)}`);
	assert.ok(
		['painted', 'fallback'].includes(states.character),
		`Character paint barrier failed: ${serialize(states)}`,
	);
	assert.equal(
		states.environment,
		'painted',
		`Environment paint barrier failed: ${serialize(states)}`,
	);
	await page.evaluate(
		() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
	);
}

async function startFrameSampler(page, samplerKey) {
	await page.evaluate((key) => {
		const samplers = (window.__blacksiteFrameSamplers ??= {});
		const previous = samplers[key];
		if (previous?.requestId) cancelAnimationFrame(previous.requestId);
		const sampler = { times: [], requestId: 0 };
		const sample = (at) => {
			sampler.times.push(at);
			sampler.requestId = requestAnimationFrame(sample);
		};
		sampler.requestId = requestAnimationFrame(sample);
		samplers[key] = sampler;
	}, samplerKey);
}

async function stopFrameSampler(page, samplerKey) {
	return page.evaluate((key) => {
		const samplers = window.__blacksiteFrameSamplers ?? {};
		const sampler = samplers[key];
		if (!sampler) return { samples: 0, percentile95Ms: null, maxMs: null, over50Ms: 0 };
		cancelAnimationFrame(sampler.requestId);
		delete samplers[key];
		const deltas = sampler.times.slice(1).map((at, index) => at - sampler.times[index]);
		const ordered = [...deltas].sort((left, right) => left - right);
		const percentile95 = ordered.length
			? ordered[Math.min(ordered.length - 1, Math.floor(ordered.length * 0.95))]
			: null;
		return {
			samples: deltas.length,
			percentile95Ms: percentile95,
			maxMs: ordered.at(-1) ?? null,
			over50Ms: deltas.filter((delta) => delta > 50).length,
		};
	}, samplerKey);
}

function assertExactRequest(group, request, { method, path, body }) {
	check(group, `${path} uses ${method}`, request?.method === method, serialize(request));
	check(group, `${path} endpoint is exact`, request?.path === path, serialize(request));
	check(
		group,
		`${path} uses application/json`,
		typeof request?.contentType === 'string' && request.contentType.includes('application/json'),
		serialize(request?.contentType),
	);
	let exact = false;
	try {
		assert.deepEqual(request?.body, body);
		exact = true;
	} catch {
		exact = false;
	}
	check(group, `${path} body is exact`, exact, serialize({ actual: request?.body, expected: body }));
}

function assertCleanNetwork(group, network) {
	check(group, 'no unexpected RGS or external requests', network.unexpected.length === 0, serialize(network.unexpected));
	check(group, 'no forbidden Replay writes', network.forbidden.length === 0, serialize(network.forbidden));
}

function rgsRequestCount(network) {
	return Object.values(network.byEndpoint).reduce((sum, requests) => sum + requests.length, 0);
}

function walletWriteCount(network) {
	return (
		network.byEndpoint.authenticate.length +
		network.byEndpoint.play.length +
		network.byEndpoint.endRound.length +
		network.byEndpoint.event.length
	);
}

function assertCleanDiagnostics(group, diagnostics) {
	check(group, 'browser has no console errors', diagnostics.consoleErrors.length === 0, serialize(diagnostics.consoleErrors));
	check(group, 'browser has no uncaught page errors', diagnostics.pageErrors.length === 0, serialize(diagnostics.pageErrors));
	check(group, 'browser has no failed requests', diagnostics.failedRequests.length === 0, serialize(diagnostics.failedRequests));
}

function assertOnlyExpectedHttpDiagnostic(group, diagnostics, statusCode) {
	const expectedMessage = {
		401: 'Failed to load resource: the server responded with a status of 401 (Unauthorized)',
		503: 'Failed to load resource: the server responded with a status of 503 (Service Unavailable)',
	}[statusCode];
	check(
		group,
		`browser reports exactly one expected HTTP ${statusCode} console diagnostic`,
		diagnostics.consoleErrors.length === 1 && diagnostics.consoleErrors[0] === expectedMessage,
		serialize(diagnostics.consoleErrors),
	);
	check(group, 'browser has no uncaught page errors', diagnostics.pageErrors.length === 0, serialize(diagnostics.pageErrors));
	check(group, 'browser has no failed requests', diagnostics.failedRequests.length === 0, serialize(diagnostics.failedRequests));
}

async function collectPlayerVisibleSurface(page) {
	return page.evaluate(() => {
		const isVisible = (element) => {
			const style = getComputedStyle(element);
			const bounds = element.getBoundingClientRect();
			return (
				style.display !== 'none' &&
				style.visibility !== 'hidden' &&
				Number(style.opacity) !== 0 &&
				bounds.width > 0 &&
				bounds.height > 0
			);
		};
		const attributes = [...document.querySelectorAll('*')]
			.filter(isVisible)
			.flatMap((element) =>
				[...element.attributes].flatMap(({ name: attribute, value: rawValue }) => {
					if (
						!attribute.startsWith('aria-') &&
						!['title', 'placeholder', 'alt'].includes(attribute)
					) {
						return [];
					}
					const value = rawValue.trim();
					return value ? [{ tag: element.tagName.toLowerCase(), attribute, value }] : [];
				}),
			);
		const visibleText = document.body.innerText;
		return {
			visibleText,
			attributes,
			combined: [visibleText, ...attributes.map(({ value }) => value)].join('\n'),
		};
	});
}

async function modalAccessibilitySnapshot(dialog) {
	return dialog.evaluate((dialogElement) => {
		const focusableSelector = [
			'a[href]',
			'button:not([disabled])',
			'input:not([disabled])',
			'select:not([disabled])',
			'textarea:not([disabled])',
			'[tabindex]:not([tabindex="-1"])',
		].join(',');
		const visible = (element) => {
			const style = getComputedStyle(element);
			const bounds = element.getBoundingClientRect();
			return style.display !== 'none' && style.visibility !== 'hidden' && bounds.width > 0 && bounds.height > 0;
		};
		const describe = (element) => ({
			tag: element?.tagName?.toLowerCase() ?? null,
			id: element?.id || null,
			testId: element?.getAttribute?.('data-testid') ?? null,
			ariaLabel: element?.getAttribute?.('aria-label') ?? null,
			text: element?.textContent?.trim().replace(/\s+/g, ' ').slice(0, 80) ?? null,
		});
		let nativeModal = false;
		try {
			nativeModal = dialogElement.matches(':modal');
		} catch {
			nativeModal = false;
		}
		const dialogFocusable = [...dialogElement.querySelectorAll(focusableSelector)].filter(visible);
		const backgroundInteractive = [...document.querySelectorAll(focusableSelector)]
			.filter((element) => !dialogElement.contains(element) && visible(element));
		const backgroundUnisolated = backgroundInteractive.filter(
			(element) => !nativeModal && !element.closest('[inert]'),
		);
		return {
			ariaModal: dialogElement.getAttribute('aria-modal'),
			labelledBy: dialogElement.getAttribute('aria-labelledby'),
			describedBy: dialogElement.getAttribute('aria-describedby'),
			descriptionText: (dialogElement.getAttribute('aria-describedby') ?? '')
				.split(/\s+/u)
				.filter(Boolean)
				.map((id) => document.getElementById(id)?.textContent?.trim().replace(/\s+/gu, ' ') ?? '')
				.filter(Boolean)
				.join(' '),
			nativeModal,
			dialogInsideInertSubtree: Boolean(dialogElement.closest('[inert]')),
			activeInside: dialogElement.contains(document.activeElement),
			active: describe(document.activeElement),
			dialogFocusableCount: dialogFocusable.length,
			backgroundInteractiveCount: backgroundInteractive.length,
			backgroundUnisolated: backgroundUnisolated.map(describe),
		};
	});
}

async function auditModalAccessibility(page, dialog, group) {
	await page.waitForFunction(
		() => [...document.querySelectorAll('[role="dialog"][aria-modal="true"]')]
			.some((element) => element.contains(document.activeElement)),
		undefined,
		{ timeout: 3_000 },
	);
	const initial = await modalAccessibilitySnapshot(dialog);
	check(group, 'modal moves focus inside an aria-modal dialog', initial.ariaModal === 'true' && initial.activeInside, serialize(initial));
	check(group, 'modal has at least one keyboard-focusable control', initial.dialogFocusableCount > 0, serialize(initial));
	check(group, 'modal itself is outside every inert background subtree', !initial.dialogInsideInertSubtree, serialize(initial));
	check(group, 'visible background controls are inert while modal is open', initial.backgroundInteractiveCount > 0 && initial.backgroundUnisolated.length === 0, serialize(initial));

	const steps = Math.min(12, Math.max(3, initial.dialogFocusableCount + 2));
	const forward = [];
	for (let index = 0; index < steps; index += 1) {
		await page.keyboard.press('Tab');
		forward.push(await dialog.evaluate((element) => element.contains(document.activeElement)));
	}
	check(group, 'forward Tab traversal is trapped inside the modal', forward.every(Boolean), serialize(forward));

	const reverse = [];
	for (let index = 0; index < steps; index += 1) {
		await page.keyboard.press('Shift+Tab');
		reverse.push(await dialog.evaluate((element) => element.contains(document.activeElement)));
	}
	check(group, 'reverse Tab traversal is trapped inside the modal', reverse.every(Boolean), serialize(reverse));
	return { initial, forward, reverse };
}

async function replayPresentationSnapshot(page) {
	return {
		runtimeState: await runtimeState(page),
		finalWin: (await page.locator(SELECTORS.finalWin).innerText()).trim(),
		totalPlay: (await page.locator(SELECTORS.totalPlay).innerText()).trim(),
		replayCard: (await page.locator('.replay-card').innerText()).trim(),
		board: await page.locator(`${SELECTORS.board} [role="gridcell"]`).evaluateAll((cells) =>
			cells.map((cell) => ({
				text: cell.innerText,
				ariaLabel: cell.getAttribute('aria-label'),
				className: cell.className,
			}))),
	};
}

async function boardSymbols(page) {
	return page.locator(`${SELECTORS.board} [role="gridcell"]`).evaluateAll((cells) =>
		cells.map((cell) => cell.getAttribute('data-symbol') ?? ''),
	);
}

async function runScenario(name, execute) {
	const record = { name, status: 'RUNNING', screenshot: null, network: null, diagnostics: null };
	evidence.scenarios.push(record);
	try {
		await execute(record);
		record.status = 'PASS';
	} catch (error) {
		record.status = 'FAIL';
		record.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
		if (!(error instanceof QaAssertionError)) recordFailure(name, error);
	}
}

async function runNetworkScenarios(browser, origin) {
	await runScenario('invalid-rgs-url-fails-closed-before-network', async (record) => {
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		try {
			const network = await installMockRgs(context, { pageOrigin: origin });
			const { page, diagnostics } = await openPage(
				context,
				origin,
				liveQuery({ rgs_url: 'not-a-valid-rgs-url' }),
			);
			await page.locator(SELECTORS.launchError).waitFor({ state: 'visible', timeout: 10_000 });
			const state = await runtimeState(page);
			const errorText = await page.locator(SELECTORS.launchError).innerText();
			check('invalid-rgs-url-fails-closed-before-network', 'invalid rgs_url is visibly rejected', /rgs_url/i.test(errorText), errorText);
			check('invalid-rgs-url-fails-closed-before-network', 'invalid rgs_url enters a bounded error state', /error/i.test(state ?? ''), serialize(state));
			check('invalid-rgs-url-fails-closed-before-network', 'invalid rgs_url produces zero RGS requests', rgsRequestCount(network) === 0 && network.preflights.length === 0, serialize(network));
			assertCleanNetwork('invalid-rgs-url-fails-closed-before-network', network);
			assertCleanDiagnostics('invalid-rgs-url-fails-closed-before-network', diagnostics);
			record.screenshot = await saveScreenshot(page, 'invalid-rgs-url');
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('invalid-session-auth-response-fails-closed', async (record) => {
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: {
					authenticate: () =>
						mockHttpResponse(401, {
							status: {
								statusCode: 'INVALID_SESSION',
								statusMessage: 'BLACKSITE QA invalid session',
							},
						}),
				},
			});
			const { page, diagnostics } = await openPage(context, origin, liveQuery());
			await waitForEndpoint(network, 'authenticate', 1);
			await page.locator(SELECTORS.launchError).waitFor({ state: 'visible', timeout: 10_000 });
			const state = await runtimeState(page);
			const errorText = await page.locator(SELECTORS.launchError).innerText();
			check('invalid-session-auth-response-fails-closed', 'invalid session response is visibly reported', errorText.trim().length > 0, errorText);
			check('invalid-session-auth-response-fails-closed', 'invalid session response enters an error state', /error/i.test(state ?? ''), serialize(state));
			check('invalid-session-auth-response-fails-closed', 'invalid session authenticates exactly once', network.byEndpoint.authenticate.length === 1, serialize(network.order));
			check('invalid-session-auth-response-fails-closed', 'invalid session sends zero play or settlement writes', network.byEndpoint.play.length === 0 && network.byEndpoint.endRound.length === 0 && network.byEndpoint.event.length === 0, serialize(network.order));
			assertCleanNetwork('invalid-session-auth-response-fails-closed', network);
			assertOnlyExpectedHttpDiagnostic('invalid-session-auth-response-fails-closed', diagnostics, 401);
			record.screenshot = await saveScreenshot(page, 'invalid-session-auth');
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('conflicting-auth-step-aliases-fail-closed', async (record) => {
		const group = 'conflicting-auth-step-aliases-fail-closed';
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: {
					authenticate: () => authenticateResponse({
						betConfig: { minStep: 200_000 },
					}),
				},
			});
			const { page, diagnostics } = await openPage(context, origin, liveQuery());
			await waitForEndpoint(network, 'authenticate', 1);
			await page.locator(SELECTORS.launchError).waitFor({ state: 'visible', timeout: 10_000 });
			await waitForRuntimeState(page, 'live-error');
			const errorText = (await page.locator(SELECTORS.launchError).innerText()).trim();
			check(group, 'conflicting step aliases expose the exact fail-closed contract error',
				/STEP_BET_CONFLICT/.test(errorText) && /stepBet and minStep disagree/i.test(errorText),
				errorText,
			);
			check(group, 'conflicting step aliases never expose an actionable paid-play control',
				await page.locator(SELECTORS.primaryAction).isDisabled(),
				serialize({ state: await runtimeState(page), action: await page.locator(SELECTORS.primaryAction).innerText() }),
			);
			check(group, 'conflicting step aliases authenticate once and send zero wallet or event writes',
				network.byEndpoint.authenticate.length === 1
					&& network.byEndpoint.play.length === 0
					&& network.byEndpoint.endRound.length === 0
					&& network.byEndpoint.event.length === 0,
				serialize(network.order),
			);
			assertCleanNetwork(group, network);
			assertCleanDiagnostics(group, diagnostics);
			record.screenshot = await saveScreenshot(page, 'conflicting-auth-step-aliases');
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('rgs-err-ipb-after-auth-race-fails-closed', async (record) => {
		const group = 'rgs-err-ipb-after-auth-race-fails-closed';
		const restoredBalance = DEFAULT_BALANCE - DEFAULT_BASE_AMOUNT;
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: {
					authenticate: (_request, networkEvidence) =>
						networkEvidence.byEndpoint.authenticate.length === 1
							? authenticateResponse()
							: authenticateResponse({
									balance: restoredBalance,
									round: authoritativeZeroRound({
										active: true,
										id: 'blacksite-qa-err-ipb-restore',
										event: encodePresentationCursor(2),
									}),
								}),
					play: () => ({
						status: {
							statusCode: 'ERR_IPB',
							statusMessage: 'Authoritative balance changed before play.',
						},
					}),
					endRound: () => endRoundResponse({ balance: restoredBalance }),
				},
			});
			const { page, diagnostics } = await openPage(context, origin, liveQuery());
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForStableAction(page);
			const beforeResultSurface = {
				board: await boardSymbols(page),
				finalWin: (await page.locator(SELECTORS.finalWin).innerText()).trim(),
			};
			await page.locator(SELECTORS.primaryAction).click();
			await waitForEndpoint(network, 'play', 1);
			await page.locator(SELECTORS.launchError).waitFor({ state: 'visible', timeout: 10_000 });
			const state = await runtimeState(page);
			const errorText = await page.locator(SELECTORS.launchError).innerText();
			const board = await boardSymbols(page);
			const finalWin = (await page.locator(SELECTORS.finalWin).innerText()).trim();
			assertExactRequest(group, network.byEndpoint.play[0], {
				method: 'POST',
				path: '/wallet/play',
				body: {
					sessionID: SESSION_ID,
					currency: 'USD',
					amount: DEFAULT_BASE_AMOUNT,
					mode: 'base',
				},
			});
			check(group, 'ERR_IPB race is visibly reported after successful auth', /balance|authoritative|continue/i.test(errorText), errorText);
			check(group, 'ERR_IPB race reaches a fail-closed insufficient/error state', /insufficient|error/i.test(state ?? ''), serialize(state));
			check(group, 'ERR_IPB race sends exactly one play request', network.byEndpoint.play.length === 1, serialize(network.order));
			check(group, 'ERR_IPB race sends no settlement/event request', network.byEndpoint.endRound.length === 0 && network.byEndpoint.event.length === 0, serialize(network.order));
			check(group, 'ERR_IPB race consumes no local result board', board.length === 49 && board.every((symbol) => symbol === ''), serialize(board));
			check(group, 'ERR_IPB race exposes no invented final result', finalWin === '—', finalWin);
			check(group, 'ERR_IPB leaves the result surface byte-for-byte unchanged from pre-play', serialize({ board, finalWin }) === serialize(beforeResultSurface), serialize({ beforeResultSurface, afterResultSurface: { board, finalWin } }));
			check(group, 'ERR_IPB race disables further play until authoritative reauthentication', await page.locator(SELECTORS.primaryAction).isDisabled(), await page.locator(SELECTORS.primaryAction).innerText());
			check(group, 'ERR_IPB network order is authenticate then one play', serialize(network.order) === serialize(['authenticate', 'play']), serialize(network.order));
			const recovery = page.locator('[data-testid="recovery-action"]');
			check(group, 'ERR_IPB race exposes explicit authoritative reload/restore', await recovery.isVisible() && !(await recovery.isDisabled()), await recovery.innerText());
			await page.waitForTimeout(300);
			check(group, 'ERR_IPB recovery never retries the rejected paid play automatically', network.byEndpoint.play.length === 1, serialize(network.order));
			record.errorScreenshot = await saveScreenshot(page, 'rgs-err-ipb-race-error');

			await recovery.click();
			await waitForEndpoint(network, 'authenticate', 2);
			await waitForEndpoint(network, 'endRound', 1);
			await waitForRuntimeState(page, 'live-ready');
			await page.waitForTimeout(300);

			for (const request of network.byEndpoint.authenticate) {
				assertExactRequest(group, request, {
					method: 'POST',
					path: '/wallet/authenticate',
					body: { sessionID: SESSION_ID, language: 'en' },
				});
			}
			assertExactRequest(group, network.byEndpoint.endRound[0], {
				method: 'POST',
				path: '/wallet/end-round',
				body: { sessionID: SESSION_ID },
			});
			check(group, 'explicit ERR_IPB reload restores and completes the authoritative active round',
				network.byEndpoint.authenticate.length === 2 && network.byEndpoint.endRound.length === 1,
				serialize(network.order),
			);
			check(group, 'ERR_IPB recovery never duplicates the rejected play or writes a checkpoint',
				network.byEndpoint.play.length === 1 && network.byEndpoint.event.length === 0,
				serialize(network.order),
			);
			check(group, 'ERR_IPB recovery request order is authoritative and exact',
				serialize(network.order) === serialize(['authenticate', 'play', 'authenticate', 'endRound']),
				serialize(network.order),
			);
			check(group, 'ERR_IPB recovery adopts the exact restored balance and result',
				(await page.locator(SELECTORS.walletBalance).innerText()).trim() === '$999.00' &&
					(await page.locator(SELECTORS.finalWin).innerText()).trim() === '$0.00',
				serialize({
					balance: await page.locator(SELECTORS.walletBalance).innerText(),
					win: await page.locator(SELECTORS.finalWin).innerText(),
				}),
			);
			assertCleanNetwork(group, network);
			assertCleanDiagnostics(group, diagnostics);
			record.screenshot = await saveScreenshot(page, group);
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('recoverable-auth-http-503-reloads-and-recovers', async (record) => {
		const group = 'recoverable-auth-http-503-reloads-and-recovers';
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: {
					authenticate: (_request, networkEvidence) =>
						networkEvidence.byEndpoint.authenticate.length === 1
							? mockHttpResponse(503, {
									error: {
										code: 'SERVICE_UNAVAILABLE',
										message: 'Authoritative service temporarily unavailable.',
									},
								})
							: authenticateResponse(),
				},
			});
			const { page, diagnostics } = await openPage(context, origin, liveQuery());
			await waitForEndpoint(network, 'authenticate', 1);
			await page.locator(SELECTORS.launchError).waitFor({ state: 'visible', timeout: 10_000 });
			const state = await runtimeState(page);
			const errorText = await page.locator(SELECTORS.launchError).innerText();
			check(group, 'authenticate 503 is visible and bounded', errorText.trim().length > 0, errorText);
			check(group, 'authenticate 503 exits boot/auth/loading states', /error/i.test(state ?? '') && !/boot|authenticating|loading/i.test(state ?? ''), serialize(state));
			check(group, 'authenticate 503 performs exactly one auth request', network.byEndpoint.authenticate.length === 1, serialize(network.order));
			check(group, 'authenticate 503 sends no wallet play/settlement writes', network.byEndpoint.play.length === 0 && network.byEndpoint.endRound.length === 0 && network.byEndpoint.event.length === 0, serialize(network.order));
			check(group, 'authenticate 503 leaves primary action fail-closed', await page.locator(SELECTORS.primaryAction).isDisabled(), await page.locator(SELECTORS.primaryAction).innerText());
			const recovery = page.locator('[data-testid="recovery-action"]');
			check(group, 'authenticate 503 exposes an enabled reload/restore control', await recovery.isVisible() && !(await recovery.isDisabled()), await page.locator(SELECTORS.launchError).innerText());
			await recovery.click();
			await waitForEndpoint(network, 'authenticate', 2);
			await waitForStableAction(page);
			for (const request of network.byEndpoint.authenticate) {
				assertExactRequest(group, request, {
					method: 'POST',
					path: '/wallet/authenticate',
					body: { sessionID: SESSION_ID, language: 'en' },
				});
			}
			check(group, 'reload recovers to authoritative ready without local fallback', await runtimeState(page) === 'live-ready' && !(await page.locator(SELECTORS.primaryAction).isDisabled()), serialize({ state: await runtimeState(page), launchKind: await page.locator(SELECTORS.playerHud).getAttribute('data-launch-kind') }));
			check(group, 'recovered session exposes the authenticated wallet balance', (await page.locator(SELECTORS.walletBalance).innerText()).trim() === '$1000.00', await page.locator(SELECTORS.walletBalance).innerText());
			check(group, 'recovery performs exactly one additional authenticate and zero wallet writes', network.byEndpoint.authenticate.length === 2 && network.byEndpoint.play.length === 0 && network.byEndpoint.endRound.length === 0 && network.byEndpoint.event.length === 0, serialize(network.order));
			check(group, 'recovery order is authenticate then authenticate', serialize(network.order) === serialize(['authenticate', 'authenticate']), serialize(network.order));
			assertCleanNetwork(group, network);
			assertOnlyExpectedHttpDiagnostic(group, diagnostics, 503);
			record.screenshot = await saveScreenshot(page, group);
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('uncertain-live-play-reloads-and-restores-without-retry', async (record) => {
		const group = 'uncertain-live-play-reloads-and-restores-without-retry';
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: {
					authenticate: (_request, networkEvidence) =>
						networkEvidence.byEndpoint.authenticate.length === 1
							? authenticateResponse()
							: authenticateResponse({
								round: authoritativeZeroRound({
									active: true,
									id: 'blacksite-qa-uncertain-play-restore',
									event: encodePresentationCursor(2),
								}),
							}),
					play: () =>
						mockHttpResponse(503, {
							error: {
								code: 'PLAY_STATUS_UNCERTAIN',
								message: 'Play status must be restored from the authoritative session.',
							},
						}),
					endRound: () => endRoundResponse(),
				},
			});
			const { page, diagnostics } = await openPage(context, origin, liveQuery());
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForStableAction(page);
			await page.locator(SELECTORS.primaryAction).click();
			await waitForEndpoint(network, 'play', 1);
			await page.locator(SELECTORS.launchError).waitFor({ state: 'visible' });
			const recovery = page.locator('[data-testid="recovery-action"]');
			check(group, 'uncertain Live play exposes explicit reload/restore without enabling Play', await recovery.isVisible() && await page.locator(SELECTORS.primaryAction).isDisabled(), serialize({ state: await runtimeState(page), order: network.order }));
			await recovery.click();
			await waitForEndpoint(network, 'authenticate', 2);
			await waitForEndpoint(network, 'endRound', 1);
			await waitForRuntimeState(page, 'live-ready');
			check(group, 'reload authenticates and restores the authoritative active round', network.byEndpoint.authenticate.length === 2 && network.byEndpoint.endRound.length === 1, serialize(network.order));
			check(group, 'recovery never retries the uncertain paid play', network.byEndpoint.play.length === 1, serialize(network.order));
			check(group, 'recovered round exposes its exact authoritative result', (await page.locator(SELECTORS.finalWin).innerText()).trim() === '$0.00', await page.locator(SELECTORS.finalWin).innerText());
			check(group, 'uncertain play recovery order is authenticate, play, authenticate, end-round', serialize(network.order) === serialize(['authenticate', 'play', 'authenticate', 'endRound']), serialize(network.order));
			assertCleanNetwork(group, network);
			assertOnlyExpectedHttpDiagnostic(group, diagnostics, 503);
			record.screenshot = await saveScreenshot(page, group);
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('expired-session-on-play-reauthenticates-without-automatic-retry', async (record) => {
		const group = 'expired-session-on-play-reauthenticates-without-automatic-retry';
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: {
					authenticate: () => authenticateResponse(),
					play: (_request, networkEvidence) =>
						networkEvidence.byEndpoint.play.length === 1
							? {
									status: {
										statusCode: 'ERR_SESSION',
										statusMessage: 'The paid session expired before the play was accepted.',
									},
								}
							: playResponse(),
				},
			});
			const { page, diagnostics } = await openPage(context, origin, liveQuery());
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForStableAction(page);
			await page.locator(SELECTORS.primaryAction).click();
			await waitForEndpoint(network, 'play', 1);
			await page.locator(SELECTORS.launchError).waitFor({ state: 'visible', timeout: 10_000 });
			await waitForRuntimeState(page, 'live-error');

			assertExactRequest(group, network.byEndpoint.play[0], {
				method: 'POST',
				path: '/wallet/play',
				body: {
					sessionID: SESSION_ID,
					currency: 'USD',
					amount: DEFAULT_BASE_AMOUNT,
					mode: 'base',
				},
			});
			const recovery = page.locator('[data-testid="recovery-action"]');
			check(group, 'expired play session is visible, fail-closed and explicitly recoverable',
				await recovery.isVisible() &&
					!(await recovery.isDisabled()) &&
					await page.locator(SELECTORS.primaryAction).isDisabled(),
				serialize({
					state: await runtimeState(page),
					error: await page.locator(SELECTORS.launchError).innerText(),
				}),
			);
			check(group, 'expired session exposes no invented result',
				(await page.locator(SELECTORS.finalWin).innerText()).trim() === '—' &&
					(await boardSymbols(page)).every((symbol) => symbol === ''),
				serialize({
					win: await page.locator(SELECTORS.finalWin).innerText(),
					board: await boardSymbols(page),
				}),
			);
			await page.waitForTimeout(300);
			check(group, 'expired session never retries the rejected play automatically',
				network.byEndpoint.play.length === 1 &&
					network.byEndpoint.authenticate.length === 1,
				serialize(network.order),
			);
			record.errorScreenshot = await saveScreenshot(page, 'expired-session-on-play-error');

			await recovery.click();
			await waitForEndpoint(network, 'authenticate', 2);
			await waitForStableAction(page);
			check(group, 'explicit reload performs one reauthentication and restores ready controls',
				network.byEndpoint.authenticate.length === 2 &&
					network.byEndpoint.play.length === 1 &&
					await runtimeState(page) === 'live-ready' &&
					!(await page.locator(SELECTORS.primaryAction).isDisabled()),
				serialize({ state: await runtimeState(page), order: network.order }),
			);
			await page.waitForTimeout(300);
			check(group, 'reauthentication alone never resubmits the rejected paid action',
				network.byEndpoint.play.length === 1,
				serialize(network.order),
			);

			await page.locator(SELECTORS.primaryAction).click();
			await waitForEndpoint(network, 'play', 2);
			await waitForStableAction(page);
			await page.waitForTimeout(200);

			for (const request of network.byEndpoint.authenticate) {
				assertExactRequest(group, request, {
					method: 'POST',
					path: '/wallet/authenticate',
					body: { sessionID: SESSION_ID, language: 'en' },
				});
			}
			assertExactRequest(group, network.byEndpoint.play[1], {
				method: 'POST',
				path: '/wallet/play',
				body: {
					sessionID: SESSION_ID,
					currency: 'USD',
					amount: DEFAULT_BASE_AMOUNT,
					mode: 'base',
				},
			});
			check(group, 'a new deliberate action succeeds once after reauthentication',
				network.byEndpoint.play.length === 2 &&
					(await page.locator(SELECTORS.walletBalance).innerText()).trim() === '$999.00' &&
					(await page.locator(SELECTORS.finalWin).innerText()).trim() === '$0.00',
				serialize({
					balance: await page.locator(SELECTORS.walletBalance).innerText(),
					win: await page.locator(SELECTORS.finalWin).innerText(),
					order: network.order,
				}),
			);
			check(group, 'session recovery request order is exact and has no settlement/checkpoint writes',
				serialize(network.order) === serialize(['authenticate', 'play', 'authenticate', 'play']) &&
					network.byEndpoint.endRound.length === 0 &&
					network.byEndpoint.event.length === 0,
				serialize(network.order),
			);
			assertCleanNetwork(group, network);
			assertCleanDiagnostics(group, diagnostics);
			record.screenshot = await saveScreenshot(page, group);
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('recoverable-replay-http-503-visible-read-only', async (record) => {
		const group = 'recoverable-replay-http-503-visible-read-only';
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				replayOnly: true,
				handlers: {
					replay: (_request, networkEvidence) =>
						networkEvidence.byEndpoint.replay.length === 1
							? mockHttpResponse(503, {
								error: {
									code: 'SERVICE_UNAVAILABLE',
									message: 'Replay service temporarily unavailable.',
								},
							})
							: replayResponse(),
				},
			});
			const query = replayQuery({ event: 'recoverable-503' });
			const { page, diagnostics } = await openPage(context, origin, query);
			await waitForEndpoint(network, 'replay', 1);
			await page.locator(SELECTORS.launchError).waitFor({ state: 'visible', timeout: 10_000 });
			const state = await runtimeState(page);
			const errorText = await page.locator(SELECTORS.launchError).innerText();
			const replayRequest = network.byEndpoint.replay[0];
			check(group, 'Replay 503 is visible and bounded', errorText.trim().length > 0, errorText);
			check(group, 'Replay 503 exits loading into an error state', /error/i.test(state ?? '') && !/loading/i.test(state ?? ''), serialize(state));
			check(group, 'Replay 503 GET path is exact', replayRequest.path === `/bet/replay/blacksite_breach/${REPLAY_VERSION}/base/recoverable-503`, replayRequest.path);
			check(group, 'Replay 503 GET remains queryless', Object.keys(replayRequest.search).length === 0, serialize(replayRequest.search));
			check(group, 'Replay 503 sends zero wallet/event writes', walletWriteCount(network) === 0, serialize(network.order));
			check(group, 'Replay 503 performs exactly one Replay request', network.byEndpoint.replay.length === 1, serialize(network.order));
			check(group, 'Replay 503 leaves primary action fail-closed', await page.locator(SELECTORS.primaryAction).isDisabled(), await page.locator(SELECTORS.primaryAction).innerText());
			const recovery = page.locator('[data-testid="recovery-action"]');
			check(group, 'Replay 503 exposes an explicit reload/restore control', await recovery.isVisible() && !(await recovery.isDisabled()), await recovery.innerText());
			await recovery.click();
			await waitForEndpoint(network, 'replay', 2);
			await waitForStableAction(page);
			check(group, 'Replay reload recovers to a playable read-only state', await runtimeState(page) === 'replay-ready' && !(await page.locator(SELECTORS.primaryAction).isDisabled()), await runtimeState(page));
			check(group, 'Replay recovery performs exactly one additional GET and zero writes', network.byEndpoint.replay.length === 2 && walletWriteCount(network) === 0, serialize(network.order));
			assertCleanNetwork(group, network);
			assertOnlyExpectedHttpDiagnostic(group, diagnostics, 503);
			record.screenshot = await saveScreenshot(page, 'recoverable-replay-503');
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('authenticate-drives-levels-default-and-modes', async (record) => {
		const group = 'authenticate-drives-levels-default-and-modes';
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		const returnedLevels = [200_000, 700_000, 3_000_000];
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: {
					authenticate: () =>
						authenticateResponse({
							betConfig: {
								minBet: 200_000,
								maxBet: 3_000_000,
								stepBet: 100_000,
								defaultBetLevel: 700_000,
								betLevels: returnedLevels,
							},
						}),
					play: (request) =>
						playResponse({ amount: request.body.amount, mode: request.body.mode }),
				},
			});
			const { page, diagnostics } = await openPage(context, origin, liveQuery());
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForStableAction(page);
			const selectSnapshot = await page.locator(SELECTORS.baseAmount).evaluate((element) => ({
				value: element.value,
				options: [...element.options].map((option) => option.value),
			}));
			check(group, 'select contains exactly the authenticate betLevels in returned order', serialize(selectSnapshot.options) === serialize(returnedLevels.map(String)), serialize(selectSnapshot));
			check(group, 'select uses authenticate defaultBetLevel', selectSnapshot.value === '700000', serialize(selectSnapshot));
			const modeSurfaces = {
				base: await page.locator(SELECTORS.modeBase).innerText(),
				deep_access: await page.locator(SELECTORS.modeDeepAccess).innerText(),
				blackout: await page.locator(SELECTORS.modeBlackout).innerText(),
			};
			for (const [modeId, cost] of Object.entries(MODE_COSTS)) {
				check(group, `${modeId} authenticate mode is selectable with ${cost}x cost`, modeSurfaces[modeId].includes(`${cost}×`) && !(await page.locator(SELECTORS[`mode${modeId === 'base' ? 'Base' : modeId === 'deep_access' ? 'DeepAccess' : 'Blackout'}`]).isDisabled()), modeSurfaces[modeId]);
			}
			await page.locator(SELECTORS.baseAmount).selectOption('3000000');
			await page.locator(SELECTORS.primaryAction).click();
			await waitForEndpoint(network, 'play', 1);
			await waitForStableAction(page);
			assertExactRequest(group, network.byEndpoint.play[0], {
				method: 'POST',
				path: '/wallet/play',
				body: {
					sessionID: SESSION_ID,
					currency: 'USD',
					amount: 3_000_000,
					mode: 'base',
				},
			});
			check(group, 'changed returned level produces exactly one play', network.byEndpoint.play.length === 1, serialize(network.order));
			assertCleanNetwork(group, network);
			assertCleanDiagnostics(group, diagnostics);
			record.screenshot = await saveScreenshot(page, 'authenticate-dynamic-controls');
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('authenticate-empty-levels-exposes-full-step-range', async (record) => {
		const group = 'authenticate-empty-levels-exposes-full-step-range';
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: {
					authenticate: () =>
						authenticateResponse({
							betConfig: {
								minBet: 200_000,
								maxBet: 1_000_000,
								stepBet: 100_000,
								defaultBetLevel: 700_000,
								betLevels: [],
							},
						}),
					play: (request) =>
						playResponse({ amount: request.body.amount, mode: request.body.mode }),
				},
			});
			const { page, diagnostics } = await openPage(context, origin, liveQuery());
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForStableAction(page);
			const amountControl = page.locator(SELECTORS.baseAmount);
			const rangeSnapshot = await amountControl.evaluate((element) => ({
				type: element.type,
				min: element.min,
				max: element.max,
				step: element.step,
				value: element.value,
				ariaValueText: element.getAttribute('aria-valuetext'),
			}));
			check(
				group,
				'empty betLevels exposes the authoritative min/max/step range and default',
				serialize(rangeSnapshot) ===
					serialize({
						type: 'range',
						min: '200000',
						max: '1000000',
						step: '100000',
						value: '700000',
						ariaValueText: '$0.70',
					}),
				serialize(rangeSnapshot),
			);
			await amountControl.focus();
			await amountControl.press('ArrowLeft');
			await amountControl.press('ArrowLeft');
			const amountOutput = page.locator('.amount-range output');
			check(
				group,
				'keyboard-selected legal intermediate range value is displayed and announced exactly',
				(await amountOutput.innerText()).trim() === '$0.50' && await amountControl.getAttribute('aria-valuetext') === '$0.50',
				serialize({ output: await amountOutput.innerText(), ariaValueText: await amountControl.getAttribute('aria-valuetext') }),
			);
			await page.locator(SELECTORS.primaryAction).click();
			await waitForEndpoint(network, 'play', 1);
			await waitForStableAction(page);
			assertExactRequest(group, network.byEndpoint.play[0], {
				method: 'POST',
				path: '/wallet/play',
				body: {
					sessionID: SESSION_ID,
					currency: 'USD',
					amount: 500_000,
					mode: 'base',
				},
			});
			check(group, 'range value produces exactly one play', network.byEndpoint.play.length === 1, serialize(network.order));
			assertCleanNetwork(group, network);
			assertCleanDiagnostics(group, diagnostics);
			record.screenshot = await saveScreenshot(page, 'authenticate-empty-levels-range');
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('invalid-language-live-falls-back-to-english', async (record) => {
		const group = 'invalid-language-live-falls-back-to-english';
		const viewport = {
			name: 'tablet-768x1024-invalid-language',
			width: 768,
			height: 1024,
			minBoard: 340,
		};
		const context = await browser.newContext({
			viewport: { width: viewport.width, height: viewport.height },
			isMobile: true,
			hasTouch: true,
		});
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: { authenticate: () => authenticateResponse() },
			});
			const { page, diagnostics } = await openPage(
				context,
				origin,
				liveQuery({ lang: '%%%invalid-language%%%', device: 'tablet' }),
			);
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForStableAction(page);
			assertExactRequest(group, network.byEndpoint.authenticate[0], {
				method: 'POST',
				path: '/wallet/authenticate',
				body: { sessionID: SESSION_ID, language: 'en' },
			});
			const bodyText = await page.locator('body').innerText();
			const state = await runtimeState(page);
			check(group, 'invalid language resolves to ready English UI', state === 'live-ready' && /INITIATE BREACH/i.test(bodyText), serialize({ state, bodyText }));
			check(group, 'invalid language input is never reflected into visible UI', !bodyText.includes('invalid-language'), bodyText);
			check(group, 'invalid language fallback sends no play request', network.byEndpoint.play.length === 0, serialize(network.order));
			const audit = await geometryAudit(page);
			audit.name = viewport.name;
			audit.surface = 'live-invalid-language-fallback';
			audit.screenshot = await saveScreenshot(page, group);
			evidence.geometry.push(audit);
			assertGeometryRecord(group, audit, viewport);
			assertCleanNetwork(group, network);
			assertCleanDiagnostics(group, diagnostics);
			record.screenshot = audit.screenshot;
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('jurisdiction-disables-space-and-feature-modes-only', async (record) => {
		const group = 'jurisdiction-disables-space-and-feature-modes-only';
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: {
					authenticate: () =>
						authenticateResponse({
							jurisdictionOverrides: {
								disabledSpacebar: true,
								disabledBuyFeature: true,
							},
						}),
					play: () => playResponse(),
				},
			});
			const { page, diagnostics } = await openPage(context, origin, liveQuery());
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForStableAction(page);
			check(group, 'Base mode remains enabled by jurisdiction', !(await page.locator(SELECTORS.modeBase).isDisabled()), await page.locator(SELECTORS.modeBase).innerText());
			check(group, 'DEEP ACCESS is hidden when feature actions are disabled', await page.locator(SELECTORS.modeDeepAccess).count() === 0, String(await page.locator(SELECTORS.modeDeepAccess).count()));
			check(group, 'BLACKOUT is hidden when feature actions are disabled', await page.locator(SELECTORS.modeBlackout).count() === 0, String(await page.locator(SELECTORS.modeBlackout).count()));
			await page.evaluate(() => document.activeElement?.blur());
			await page.keyboard.press('Space');
			await page.waitForTimeout(200);
			check(group, 'disabledSpacebar produces zero play requests', network.byEndpoint.play.length === 0, serialize(network.order));
			await page.locator(SELECTORS.modeBase).click();
			await page.locator(SELECTORS.primaryAction).click();
			await waitForEndpoint(network, 'play', 1);
			await waitForStableAction(page);
			assertExactRequest(group, network.byEndpoint.play[0], {
				method: 'POST',
				path: '/wallet/play',
				body: {
					sessionID: SESSION_ID,
					currency: 'USD',
					amount: DEFAULT_BASE_AMOUNT,
					mode: 'base',
				},
			});
			check(group, 'explicit Base click remains one legal play', network.byEndpoint.play.length === 1, serialize(network.order));
			assertCleanNetwork(group, network);
			assertCleanDiagnostics(group, diagnostics);
			record.screenshot = await saveScreenshot(page, 'jurisdiction-space-feature-disabled');
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('spacebar-one-base-play-and-blocked-space-zero', async (record) => {
		const group = 'spacebar-one-base-play-and-blocked-space-zero';
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: {
					authenticate: () => authenticateResponse(),
					play: () => playResponse(),
				},
			});
			const { page, diagnostics } = await openPage(context, origin, liveQuery());
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForStableAction(page);
			await page.getByRole('button', { name: /INFO \/ RULES/i }).click();
			await page.getByRole('dialog', { name: /BLACKSITE/i }).waitFor({ state: 'visible' });
			await page.evaluate(() => document.activeElement?.blur());
			await page.keyboard.press('Space');
			await page.waitForTimeout(200);
			check(group, 'Space is blocked while Game Information is open', network.byEndpoint.play.length === 0, serialize(network.order));
			await page.getByRole('button', { name: /CLOSE/i }).click();
			await page.evaluate(() => document.activeElement?.blur());
			await waitForStableAction(page);
			await page.evaluate(() => {
				window.__blacksiteSpaceKeydowns = [];
				window.addEventListener(
					'keydown',
					(event) => {
						if (event.code === 'Space') {
							window.__blacksiteSpaceKeydowns.push({ repeat: event.repeat });
						}
					},
					{ capture: true },
				);
			});
			await page.keyboard.down('Space');
			await waitForEndpoint(network, 'play', 1);
			await waitForStableAction(page);
			await page.keyboard.down('Space');
			await page.waitForTimeout(200);
			await page.keyboard.up('Space');
			const spaceKeydowns = await page.evaluate(() => window.__blacksiteSpaceKeydowns);
			assertExactRequest(group, network.byEndpoint.play[0], {
				method: 'POST',
				path: '/wallet/play',
				body: {
					sessionID: SESSION_ID,
					currency: 'USD',
					amount: DEFAULT_BASE_AMOUNT,
					mode: 'base',
				},
			});
			check(
				group,
				'held Space emits one initial and one repeat keydown',
				spaceKeydowns.length === 2 &&
					spaceKeydowns[0].repeat === false &&
					spaceKeydowns[1].repeat === true,
				serialize(spaceKeydowns),
			);
			check(
				group,
				'held Space cannot spend a second base bet after returning to ready',
				network.byEndpoint.play.length === 1 && (await runtimeState(page)) === 'live-ready',
				serialize({ state: await runtimeState(page), order: network.order }),
			);
			check(group, 'one legal Space press produces exactly one Base play', network.byEndpoint.play.length === 1, serialize(network.order));
			assertCleanNetwork(group, network);
			assertCleanDiagnostics(group, diagnostics);
			record.screenshot = await saveScreenshot(page, 'spacebar-base-play');
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('held-enter-primary-button-does-not-repeat-paid-play', async (record) => {
		const group = 'held-enter-primary-button-does-not-repeat-paid-play';
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: {
					authenticate: () => authenticateResponse(),
					play: () => playResponse(),
				},
			});
			const { page, diagnostics } = await openPage(context, origin, liveQuery());
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForStableAction(page);
			const primaryAction = page.locator(SELECTORS.primaryAction);
			await primaryAction.focus();
			await page.evaluate(() => {
				window.__blacksiteEnterKeydowns = [];
				window.addEventListener('keydown', (event) => {
					if (event.key === 'Enter') {
						window.__blacksiteEnterKeydowns.push({
							repeat: event.repeat,
							defaultPrevented: event.defaultPrevented,
						});
					}
				});
			});
			await page.keyboard.down('Enter');
			await waitForEndpoint(network, 'play', 1);
			await waitForStableAction(page);
			await primaryAction.focus();
			await page.keyboard.down('Enter');
			await page.waitForTimeout(200);
			await page.keyboard.up('Enter');
			const enterKeydowns = await page.evaluate(() => window.__blacksiteEnterKeydowns);
			assertExactRequest(group, network.byEndpoint.play[0], {
				method: 'POST',
				path: '/wallet/play',
				body: {
					sessionID: SESSION_ID,
					currency: 'USD',
					amount: DEFAULT_BASE_AMOUNT,
					mode: 'base',
				},
			});
			check(
				group,
				'held Enter emits one initial and one prevented repeat keydown',
				enterKeydowns.length === 2 &&
					enterKeydowns[0].repeat === false &&
					enterKeydowns[0].defaultPrevented === false &&
					enterKeydowns[1].repeat === true &&
					enterKeydowns[1].defaultPrevented === true,
				serialize(enterKeydowns),
			);
			check(
				group,
				'held Enter cannot spend a second base bet after returning to ready',
				network.byEndpoint.play.length === 1 && (await runtimeState(page)) === 'live-ready',
				serialize({ state: await runtimeState(page), order: network.order }),
			);
			assertCleanNetwork(group, network);
			assertCleanDiagnostics(group, diagnostics);
			record.screenshot = await saveScreenshot(page, 'held-enter-base-play');
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('concurrent-click-spacebar-deduplicates-paid-play', async (record) => {
		const group = 'concurrent-click-spacebar-deduplicates-paid-play';
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: {
					authenticate: () => authenticateResponse(),
					play: async () => {
						await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
						return playResponse();
					},
				},
			});
			const { page, diagnostics } = await openPage(context, origin, liveQuery());
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForStableAction(page);

			const burst = await page.evaluate((primarySelector) => {
				document.activeElement?.blur();
				const primary = document.querySelector(primarySelector);
				if (!(primary instanceof HTMLButtonElement)) {
					throw new Error('Primary action is unavailable for concurrent-input QA.');
				}
				primary.click();
				primary.click();
				window.dispatchEvent(new KeyboardEvent('keydown', {
					key: ' ',
					code: 'Space',
					bubbles: true,
					cancelable: true,
				}));
				return { clickCount: 2, spaceCount: 1 };
			}, SELECTORS.primaryAction);

			await waitForEndpoint(network, 'play', 1);
			await page.waitForTimeout(150);
			check(
				group,
				'button-button-Space burst emits exactly one paid play while RGS is pending',
				network.byEndpoint.play.length === 1,
				serialize({ burst, order: network.order }),
			);
			check(
				group,
				'primary action is disabled while the authoritative play request is pending',
				await page.locator(SELECTORS.primaryAction).isDisabled(),
				serialize({ burst, runtimeState: await runtimeState(page) }),
			);
			check(
				group,
				'base amount is locked while the authoritative play request is pending',
				await page.locator(SELECTORS.baseAmount).isDisabled(),
				serialize({ burst, runtimeState: await runtimeState(page) }),
			);
			assertExactRequest(group, network.byEndpoint.play[0], {
				method: 'POST',
				path: '/wallet/play',
				body: {
					sessionID: SESSION_ID,
					currency: 'USD',
					amount: DEFAULT_BASE_AMOUNT,
					mode: 'base',
				},
			});
			await waitForStableAction(page);
			check(
				group,
				'deduplicated round returns to one ready authoritative state',
				await runtimeState(page) === 'live-ready' && network.byEndpoint.play.length === 1,
				serialize({ state: await runtimeState(page), order: network.order }),
			);
			assertCleanNetwork(group, network);
			assertCleanDiagnostics(group, diagnostics);
			record.screenshot = await saveScreenshot(page, group);
			record.network = network;
			record.diagnostics = diagnostics;
			record.concurrentInput = burst;
		} finally {
			await context.close();
		}
	});

	for (const { modeId, selector, cost } of [
		{ modeId: 'deep_access', selector: SELECTORS.modeDeepAccess, cost: 4 },
		{ modeId: 'blackout', selector: SELECTORS.modeBlackout, cost: 80 },
	]) {
		await runScenario(`high-cost-${modeId}-requires-confirmation`, async (record) => {
			const group = `high-cost-${modeId}-requires-confirmation`;
			const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
			try {
				const network = await installMockRgs(context, {
					pageOrigin: origin,
					handlers: {
						authenticate: () => authenticateResponse(),
						play: (request) =>
							playResponse({ amount: request.body.amount, mode: request.body.mode }),
					},
				});
				const { page, diagnostics } = await openPage(context, origin, liveQuery());
				await waitForEndpoint(network, 'authenticate', 1);
				await waitForStableAction(page);
				await page.locator(selector).click();
				const exactTotal = (await page.locator(SELECTORS.totalPlay).innerText()).trim();

				await page.locator(SELECTORS.primaryAction).click();
				let dialog = page.getByRole('dialog', { name: /Confirm complete play amount/i });
				await dialog.waitFor({ state: 'visible' });
				const modalAccessibility = await auditModalAccessibility(page, dialog, group);
				check(
					group,
					'confirmation accessible description binds the mode factor and exact complete amount',
					modalAccessibility.initial.describedBy === 'confirm-description confirm-total' &&
						modalAccessibility.initial.descriptionText.includes(`${cost}×`) &&
						modalAccessibility.initial.descriptionText.includes(exactTotal),
					serialize(modalAccessibility.initial),
				);
				const firstDialogText = await dialog.innerText();
				check(group, 'first action opens confirmation before any play', network.byEndpoint.play.length === 0, serialize(network.order));
				check(group, 'confirmation shows the exact complete play amount', exactTotal.length > 0 && firstDialogText.includes(exactTotal), serialize({ exactTotal, firstDialogText }));
				check(group, `confirmation shows ${cost}x mode factor`, firstDialogText.includes(`${cost}×`), firstDialogText);
				await page.evaluate(() => document.activeElement?.blur());
				await page.keyboard.press('Space');
				await page.waitForTimeout(150);
				check(group, 'Space is blocked while confirmation is open', network.byEndpoint.play.length === 0, serialize(network.order));
				await dialog.getByRole('button', { name: /^CANCEL$/i }).click();
				await dialog.waitFor({ state: 'detached' });
				check(group, 'Cancel sends zero play requests', network.byEndpoint.play.length === 0, serialize(network.order));
				check(group, 'Cancel restores focus to the confirmation trigger', await page.locator(SELECTORS.primaryAction).evaluate((element) => document.activeElement === element), await page.evaluate(() => document.activeElement?.outerHTML));

				await waitForStableAction(page);
				await page.locator(SELECTORS.primaryAction).click();
				dialog = page.getByRole('dialog', { name: /Confirm complete play amount/i });
				await dialog.waitFor({ state: 'visible' });
				await page.keyboard.press('Escape');
				await dialog.waitFor({ state: 'detached' });
				check(group, 'Escape sends zero play requests', network.byEndpoint.play.length === 0, serialize(network.order));
				check(group, 'Escape restores focus to the confirmation trigger', await page.locator(SELECTORS.primaryAction).evaluate((element) => document.activeElement === element), await page.evaluate(() => document.activeElement?.outerHTML));

				await waitForStableAction(page);
				await page.locator(SELECTORS.primaryAction).click();
				dialog = page.getByRole('dialog', { name: /Confirm complete play amount/i });
				await dialog.waitFor({ state: 'visible' });
				await dialog.getByRole('button', { name: /^CONFIRM$/i }).click();
				await waitForEndpoint(network, 'play', 1);
				await waitForStableAction(page);
				assertExactRequest(group, network.byEndpoint.play[0], {
					method: 'POST',
					path: '/wallet/play',
					body: {
						sessionID: SESSION_ID,
						currency: 'USD',
						amount: DEFAULT_BASE_AMOUNT,
						mode: modeId,
					},
				});
				check(group, 'Confirm sends exactly one correctly-modeled Base-amount play', network.byEndpoint.play.length === 1, serialize(network.order));
				assertCleanNetwork(group, network);
				assertCleanDiagnostics(group, diagnostics);
				record.modalAccessibility = modalAccessibility;
				record.screenshot = await saveScreenshot(page, `high-cost-${modeId}-confirmed`);
				record.network = network;
				record.diagnostics = diagnostics;
			} finally {
				await context.close();
			}
		});
	}

	await runScenario('social-xsc-rules-paytable-and-terminology', async (record) => {
		const group = 'social-xsc-rules-paytable-and-terminology';
		const context = await browser.newContext({
			viewport: { width: 360, height: 740 },
			isMobile: true,
			hasTouch: true,
		});
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: {
					authenticate: () =>
						authenticateResponse({
							currency: 'XSC',
							betConfig: { betLevels: [] },
							jurisdictionOverrides: { socialCasino: true },
						}),
				},
			});
			const { page, diagnostics } = await openPage(
				context,
				origin,
				liveQuery({ currency: 'XSC', social: 'true', lang: 'de', device: 'mobile' }),
			);
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForStableAction(page);
			assertExactRequest(group, network.byEndpoint.authenticate[0], {
				method: 'POST',
				path: '/wallet/authenticate',
				body: { sessionID: SESSION_ID, language: 'en' },
			});
			const balanceText = (await page.locator(SELECTORS.walletBalance).innerText()).trim();
			const totalText = (await page.locator(SELECTORS.totalPlay).innerText()).trim();
			const socialRangeValueText = await page.locator(SELECTORS.baseAmount).getAttribute('aria-valuetext');
			check(group, 'XSC Balance is displayed as SC without a dollar prefix', balanceText.endsWith(' SC') && !balanceText.includes('$'), balanceText);
			check(group, 'XSC complete play amount is displayed as SC without a dollar prefix', totalText.endsWith(' SC') && !totalText.includes('$'), totalText);
			check(group, 'Social XSC range announces the exact SC value without a dollar prefix', socialRangeValueText === '1.00 SC' && !socialRangeValueText.includes('$'), socialRangeValueText);
			check(group, 'Social Base mode uses STANDARD RUN label', /STANDARD RUN/i.test(await page.locator(SELECTORS.modeBase).innerText()), await page.locator(SELECTORS.modeBase).innerText());
			check(group, 'Social Blackout mode uses BLACKOUT ENTRY label', /BLACKOUT ENTRY/i.test(await page.locator(SELECTORS.modeBlackout).innerText()), await page.locator(SELECTORS.modeBlackout).innerText());

			const infoAction = page.getByRole('button', { name: /INFO \/ RULES/i });
			await infoAction.click();
			const dialog = page.getByRole('dialog', { name: /BLACKSITE/i });
			await dialog.waitFor({ state: 'visible' });
			const modalAccessibility = await auditModalAccessibility(page, dialog, group);
			await page.keyboard.press('Escape');
			await dialog.waitFor({ state: 'detached' });
			check(group, 'Rules Escape restores focus to INFO / RULES', await infoAction.evaluate((element) => document.activeElement === element), await page.evaluate(() => document.activeElement?.outerHTML));
			await infoAction.click();
			await dialog.waitFor({ state: 'visible' });
			const rulesText = await dialog.innerText();
			const normalizedRulesText = rulesText.replaceAll(',', '').replaceAll('×', 'x');
			const tables = dialog.locator('table');
			check(group, 'Rules show exact 96.20% RTP', rulesText.includes(`${(RULES_CONTRACT.targetRtp * 100).toFixed(2)}%`), rulesText);
			check(group, 'Rules show the 10,000x-equivalent maximum', normalizedRulesText.includes(`${RULES_CONTRACT.maxWinRaw / 100}x`), normalizedRulesText);
			check(group, 'Rules contain one mode table and one result matrix', (await tables.count()) === 2, String(await tables.count()));
			check(group, 'Result matrix contains exactly six symbol rows', (await tables.nth(1).locator('tbody tr').count()) === Object.keys(SYMBOL_PAYOUTS).length, String(await tables.nth(1).locator('tbody tr').count()));
			check(group, 'Result matrix contains exactly eight cluster bands', (await tables.nth(1).locator('thead th').count()) - 1 === CLUSTER_BANDS.length, String((await tables.nth(1).locator('thead th').count()) - 1));
			for (const band of CLUSTER_BANDS) {
				check(group, `Result matrix exposes cluster band ${band.label}`, rulesText.includes(band.label), rulesText);
			}
			for (const symbol of Object.keys(SYMBOL_PAYOUTS)) {
				check(group, `Result matrix exposes ${symbol}`, new RegExp(`\\b${symbol}\\b`, 'i').test(rulesText), rulesText);
			}
			check(group, 'Social Rules use social mode labels in the table', /STANDARD RUN/i.test(rulesText) && /BLACKOUT ENTRY/i.test(rulesText), rulesText);
			check(group, 'Rules include the complete Social disclaimer', rulesText.includes(getRulesDisclaimer(true)), rulesText);

			const interactionGuide = await page.evaluate(
				({ controlMap, requiredGuideKeys }) => {
					const visible = (element) => {
						const style = getComputedStyle(element);
						const bounds = element.getBoundingClientRect();
						return style.display !== 'none' && style.visibility !== 'hidden' && bounds.width > 0 && bounds.height > 0;
					};
					const guideKeys = [...document.querySelectorAll('[data-control-key]')]
						.map((element) => element.getAttribute('data-control-key'))
						.filter(Boolean);
					const visibleControls = Object.entries(controlMap)
						.filter(([selector]) => [...document.querySelectorAll(selector)].some(visible))
						.map(([selector, key]) => ({ selector, key }));
					return {
						guideKeys,
						visibleControls,
						missingVisibleControls: visibleControls.filter(({ key }) => !guideKeys.includes(key)),
						missingRequiredKeys: requiredGuideKeys.filter((key) => !guideKeys.includes(key)),
					};
				},
				{
					controlMap: {
						'[data-testid="sound-action"]': 'sound',
						'[data-testid^="mode-"]': 'mode-select',
						'[data-testid="base-amount"]': 'play-amount',
						'[data-testid="motion-mode"]': 'presentation-speed',
						'[data-testid="skip-presentation"]': 'skip',
						'[data-testid="primary-action"]': 'primary-action',
						'[data-testid="info-action"]': 'info-rules',
						'button[aria-label="Close game information"]': 'close-rules',
					},
					requiredGuideKeys: CONTROL_GUIDE.map(({ key }) => key),
				},
			);
			check(group, 'every visible game control maps to a Game Information guide entry', interactionGuide.missingVisibleControls.length === 0, serialize(interactionGuide));
			check(group, 'interaction guide contains every versioned control contract entry', interactionGuide.missingRequiredKeys.length === 0 && interactionGuide.guideKeys.length === CONTROL_GUIDE.length, serialize(interactionGuide));
			check(group, 'interaction guide documents touch, keyboard, Space and Escape behaviour', /pointer or touch/i.test(rulesText) && /keyboard focus/i.test(rulesText) && /\bSpace\b/i.test(rulesText) && /\bEscape\b/i.test(rulesText), rulesText);

			const rulesGeometry = await page.evaluate(() => {
				const dialogElement = document.querySelector('[role="dialog"]');
				const close = dialogElement?.querySelector('button[aria-label]');
				const documentElement = document.documentElement;
				const rect = (element) => {
					const bounds = element?.getBoundingClientRect();
					return bounds
						? { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom, width: bounds.width, height: bounds.height }
						: null;
				};
				return {
					dialog: rect(dialogElement),
					close: rect(close),
					documentHasHorizontalScroll: documentElement.scrollWidth > innerWidth + 1,
					documentHasVerticalScroll: documentElement.scrollHeight > innerHeight + 1,
				};
			});
			check(group, 'mobile Rules dialog remains fully inside the viewport', Boolean(rulesGeometry.dialog && rulesGeometry.dialog.left >= -0.5 && rulesGeometry.dialog.top >= -0.5 && rulesGeometry.dialog.right <= 360.5 && rulesGeometry.dialog.bottom <= 740.5), serialize(rulesGeometry));
			check(group, 'mobile Rules close control is at least 44x44 CSS pixels', Boolean(rulesGeometry.close && rulesGeometry.close.width >= 44 && rulesGeometry.close.height >= 44), serialize(rulesGeometry.close));
			check(group, 'mobile Rules do not make the document scroll', !rulesGeometry.documentHasHorizontalScroll && !rulesGeometry.documentHasVerticalScroll, serialize(rulesGeometry));

			const surface = await collectPlayerVisibleSurface(page);
			const restrictedHits = playerVisibleRestrictedHits(surface.combined);
			check(group, 'complete visible DOM and visible ARIA surface has zero official Social restricted hits', restrictedHits.length === 0, serialize({ hits: restrictedHits, attributes: surface.attributes }));
			assertCleanNetwork(group, network);
			assertCleanDiagnostics(group, diagnostics);
			record.surface = surface;
			record.rulesGeometry = rulesGeometry;
			record.modalAccessibility = modalAccessibility;
			record.interactionGuide = interactionGuide;
			record.screenshot = await saveScreenshot(page, 'social-xsc-rules');
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('live-jpy-native-balance-and-exact-win', async (record) => {
		const group = 'live-jpy-native-balance-and-exact-win';
		const currency = 'JPY';
		const openingBalance = 1_500_000;
		const fixture = getGeneratedFixture('base_small');
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: {
					authenticate: () => authenticateResponse({ balance: openingBalance, currency }),
					play: (request) => {
						const round = authoritativeFixtureRound({
							fixture,
							active: false,
							amount: request.body.amount,
							currency,
							id: 'blacksite-qa-jpy-small-win',
						});
						return {
							status: successStatus(),
							balance: {
								amount: openingBalance - request.body.amount + round.payout,
								currency,
							},
							round,
						};
					},
				},
			});
			const { page, diagnostics } = await openPage(context, origin, liveQuery({ currency }));
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForStableAction(page);
			const ready = {
				balance: (await page.locator(SELECTORS.walletBalance).innerText()).trim(),
				totalPlay: (await page.locator(SELECTORS.totalPlay).innerText()).trim(),
				baseAmount: await page.locator(SELECTORS.baseAmount).inputValue(),
			};
			check(group, 'JPY wallet balance uses native zero-decimal rounding', ready.balance === '¥2', serialize(ready));
			check(group, 'JPY complete play decorates the canonical micro-unit Base amount', ready.totalPlay === '¥1' && ready.baseAmount === String(DEFAULT_BASE_AMOUNT), serialize(ready));

			await page.locator(SELECTORS.primaryAction).click();
			await waitForEndpoint(network, 'play', 1);
			await waitForRuntimeState(page, 'live-ready');
			const completed = {
				balance: (await page.locator(SELECTORS.walletBalance).innerText()).trim(),
				finalWin: (await page.locator(SELECTORS.finalWin).innerText()).trim(),
				totalPlay: (await page.locator(SELECTORS.totalPlay).innerText()).trim(),
				actionDisabled: await page.locator(SELECTORS.primaryAction).isDisabled(),
			};
			check(group, 'JPY exact result preserves the authoritative sub-yen payout', completed.finalWin === '¥0.38', serialize(completed));
			check(group, 'JPY wallet returns to native precision and blocks the now-unaffordable play', completed.balance === '¥1' && completed.totalPlay === '¥1' && completed.actionDisabled, serialize(completed));
			assertExactRequest(group, network.byEndpoint.play[0], {
				method: 'POST',
				path: '/wallet/play',
				body: {
					sessionID: SESSION_ID,
					currency,
					amount: DEFAULT_BASE_AMOUNT,
					mode: 'base',
				},
			});
			check(group, 'JPY scenario sends exactly one paid play and no settlement write', network.byEndpoint.play.length === 1 && network.byEndpoint.endRound.length === 0, serialize(network.order));
			assertCleanNetwork(group, network);
			assertCleanDiagnostics(group, diagnostics);
			record.currencyUi = { ready, completed, fixture: fixture.id };
			record.screenshot = await saveScreenshot(page, group);
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('live-unknown-currency-code-fallback', async (record) => {
		const group = 'live-unknown-currency-code-fallback';
		const currency = 'ZZZ';
		const openingBalance = 1_234_567;
		const context = await browser.newContext({
			viewport: { width: 390, height: 844 },
			isMobile: true,
			hasTouch: true,
		});
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: {
					authenticate: () => authenticateResponse({ balance: openingBalance, currency }),
					play: () => playResponse({ balanceBefore: openingBalance, currency }),
				},
			});
			const { page, diagnostics } = await openPage(
				context,
				origin,
				liveQuery({ currency, device: 'mobile' }),
			);
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForStableAction(page);
			const ready = {
				balance: (await page.locator(SELECTORS.walletBalance).innerText()).trim(),
				totalPlay: (await page.locator(SELECTORS.totalPlay).innerText()).trim(),
				baseAmount: await page.locator(SELECTORS.baseAmount).inputValue(),
			};
			check(group, 'unknown currency wallet falls back to the normalized code', ready.balance === '1.23 ZZZ', serialize(ready));
			check(group, 'unknown currency complete play decorates the canonical micro-unit Base amount', ready.totalPlay === '1.00 ZZZ' && ready.baseAmount === String(DEFAULT_BASE_AMOUNT), serialize(ready));

			await page.locator(SELECTORS.primaryAction).click();
			await waitForEndpoint(network, 'play', 1);
			await waitForRuntimeState(page, 'live-ready');
			const completed = {
				balance: (await page.locator(SELECTORS.walletBalance).innerText()).trim(),
				finalWin: (await page.locator(SELECTORS.finalWin).innerText()).trim(),
				actionDisabled: await page.locator(SELECTORS.primaryAction).isDisabled(),
			};
			check(group, 'unknown currency fallback remains stable and blocks the now-unaffordable play', completed.balance === '0.23 ZZZ' && completed.finalWin === '0.00 ZZZ' && completed.actionDisabled, serialize(completed));
			assertExactRequest(group, network.byEndpoint.play[0], {
				method: 'POST',
				path: '/wallet/play',
				body: {
					sessionID: SESSION_ID,
					currency,
					amount: DEFAULT_BASE_AMOUNT,
					mode: 'base',
				},
			});
			check(group, 'unknown currency scenario sends exactly one paid play and no settlement write', network.byEndpoint.play.length === 1 && network.byEndpoint.endRound.length === 0, serialize(network.order));
			assertCleanNetwork(group, network);
			assertCleanDiagnostics(group, diagnostics);
			record.currencyUi = { ready, completed };
			record.screenshot = await saveScreenshot(page, group);
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('live-auth-exact', async (record) => {
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: { authenticate: () => authenticateResponse() },
			});
			const { page, diagnostics } = await openPage(context, origin, liveQuery());
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForStableAction(page);
			const expectedAuth = { sessionID: SESSION_ID, language: 'en' };
			assertExactRequest('live-auth-exact', network.byEndpoint.authenticate[0], {
				method: 'POST',
				path: '/wallet/authenticate',
				body: expectedAuth,
			});
			check('live-auth-exact', 'authenticate happens exactly once', network.byEndpoint.authenticate.length === 1, serialize(network.order));
			check('live-auth-exact', 'no play occurs before user action', network.byEndpoint.play.length === 0, serialize(network.order));
			check('live-auth-exact', 'request order is authenticate only', serialize(network.order) === serialize(['authenticate']), serialize(network.order));
			assertCleanNetwork('live-auth-exact', network);
			record.screenshot = await saveScreenshot(page, 'live-auth-exact');
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('audio-policy-cues-mute-and-persistence', async (record) => {
		const group = 'audio-policy-cues-mute-and-persistence';
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: {
					authenticate: () => authenticateResponse(),
					play: () => playResponse({ active: false }),
				},
			});
			const { page, diagnostics } = await openPage(context, origin, liveQuery());
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForStableAction(page);
			const sound = page.locator(SELECTORS.soundAction);
			const locked = await sound.evaluate((element) => ({
				status: element.getAttribute('data-audio-status'),
				level: element.getAttribute('data-audio-level'),
				cues: Number(element.getAttribute('data-audio-cues')),
				ambience: Number(element.getAttribute('data-ambience-instances')),
			}));
			check(group, 'audio creates no graph or cue before a user gesture',
				locked.status === 'locked' && locked.cues === 0 && locked.ambience === 0,
				serialize(locked),
			);

			await sound.click();
			await page.waitForFunction(
				(selector) => document.querySelector(selector)?.getAttribute('data-audio-status') === 'running',
				SELECTORS.soundAction,
			);
			const enabled = await sound.evaluate((element) => ({
				status: element.getAttribute('data-audio-status'),
				level: element.getAttribute('data-audio-level'),
				cues: Number(element.getAttribute('data-audio-cues')),
				ambience: Number(element.getAttribute('data-ambience-instances')),
			}));
			check(group, 'one gesture unlocks one ambience graph and an audible UI cue',
				enabled.status === 'running' && enabled.level === 'FULL' && enabled.cues === 1 && enabled.ambience === 1,
				serialize(enabled),
			);

			await page.locator(SELECTORS.primaryAction).click();
			await waitForEndpoint(network, 'play', 1);
			await waitForStableAction(page);
			const completed = await sound.evaluate((element) => ({
				cues: Number(element.getAttribute('data-audio-cues')),
				voices: Number(element.getAttribute('data-audio-voices')),
				ambience: Number(element.getAttribute('data-ambience-instances')),
				recipe: element.getAttribute('data-audio-recipe'),
				reelPulses: Number(element.getAttribute('data-audio-reel-pulses')),
				priorityCues: Number(element.getAttribute('data-audio-priority-cues')),
				ducks: Number(element.getAttribute('data-audio-ducks')),
			}));
			check(group, 'authoritative round cues use the same bounded graph',
				completed.cues >= 4 && completed.voices <= 8 && completed.ambience === 1,
				serialize(completed),
			);
			check(group, 'normal board reveal schedules one seven-stop mechanical reel cadence',
				completed.reelPulses === 7,
				serialize(completed),
			);
			check(group, 'foreground cues apply explicit ambience ducking without another graph',
				completed.priorityCues >= 1 && completed.ducks === completed.priorityCues && completed.ambience === 1,
				serialize(completed),
			);

			await sound.click();
			const muted = await sound.evaluate((element) => ({
				status: element.getAttribute('data-audio-status'),
				level: element.getAttribute('data-audio-level'),
				pressed: element.getAttribute('aria-pressed'),
				voices: Number(element.getAttribute('data-audio-voices')),
				ambience: Number(element.getAttribute('data-ambience-instances')),
				stored: localStorage.getItem('blacksite.audio.volume.v1'),
			}));
			check(group, 'mute tears down every active game-owned source and persists exact zero volume',
				muted.status === 'muted' && muted.level === 'MUTED' && muted.pressed === 'true' && muted.voices === 0 && muted.ambience === 0 && muted.stored === '0',
				serialize(muted),
			);

			await sound.click();
			const unmuted = await sound.evaluate((element) => ({
				status: element.getAttribute('data-audio-status'),
				level: element.getAttribute('data-audio-level'),
				pressed: element.getAttribute('aria-pressed'),
				ambience: Number(element.getAttribute('data-ambience-instances')),
				stored: localStorage.getItem('blacksite.audio.volume.v1'),
			}));
			check(group, 'unmute restores exactly one ambience graph at the persisted low level',
				unmuted.status === 'running' && unmuted.level === 'LOW' && unmuted.pressed === 'false' && unmuted.ambience === 1 && unmuted.stored === '0.28',
				serialize(unmuted),
			);
			await page.waitForTimeout(30);
			await sound.click();
			await page.waitForTimeout(30);
			await sound.click();
			const remuted = await sound.evaluate((element) => ({
				status: element.getAttribute('data-audio-status'),
				level: element.getAttribute('data-audio-level'),
				voices: Number(element.getAttribute('data-audio-voices')),
				ambience: Number(element.getAttribute('data-ambience-instances')),
				stored: localStorage.getItem('blacksite.audio.volume.v1'),
			}));
			check(group, 'a second mute cycle remains source-free without stacking ambience',
				remuted.status === 'muted' && remuted.level === 'MUTED' && remuted.voices === 0 && remuted.ambience === 0 && remuted.stored === '0',
				serialize(remuted),
			);

			await page.reload({ waitUntil: 'domcontentloaded' });
			await waitForEndpoint(network, 'authenticate', 2);
			await waitForStableAction(page);
			const restored = await page.locator(SELECTORS.soundAction).evaluate((element) => ({
				status: element.getAttribute('data-audio-status'),
				level: element.getAttribute('data-audio-level'),
				pressed: element.getAttribute('aria-pressed'),
				ambience: Number(element.getAttribute('data-ambience-instances')),
			}));
			check(group, 'reload restores mute without autoplay or a duplicate ambience graph',
				restored.status === 'locked' && restored.level === 'MUTED' && restored.pressed === 'true' && restored.ambience === 0,
				serialize(restored),
			);
			assertCleanNetwork(group, network);
			assertCleanDiagnostics(group, diagnostics);
			record.audio = { locked, enabled, completed, muted, unmuted, remuted, restored };
			record.screenshot = await saveScreenshot(page, group);
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('presentation-speed-persists-with-reduced-motion-override', async (record) => {
		const group = 'presentation-speed-persists-with-reduced-motion-override';
		const context = await browser.newContext({
			viewport: { width: 390, height: 844 },
			isMobile: true,
			hasTouch: true,
			reducedMotion: 'no-preference',
		});
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: { authenticate: () => authenticateResponse() },
			});
			const { page, diagnostics } = await openPage(
				context,
				origin,
				liveQuery({ device: 'mobile' }),
			);
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForStableAction(page);
			const motion = page.locator(SELECTORS.motionMode);
			await motion.click();
			const selected = await motion.evaluate((element, storageKey) => ({
				label: element.textContent?.trim(),
				pressed: element.getAttribute('aria-pressed'),
				disabled: element.matches(':disabled'),
				profile: document.body.dataset.motionProfile,
				stored: localStorage.getItem(storageKey),
			}), MOTION_STORAGE_KEY);
			check(
				group,
				'Turbo selection updates semantics, presentation profile and versioned storage',
				selected.label === 'TURBO' &&
					selected.pressed === 'true' &&
					!selected.disabled &&
					selected.profile === 'turbo' &&
					selected.stored === 'turbo',
				serialize(selected),
			);

			await page.reload({ waitUntil: 'domcontentloaded' });
			await waitForEndpoint(network, 'authenticate', 2);
			await waitForStableAction(page);
			const restored = await motion.evaluate((element, storageKey) => ({
				label: element.textContent?.trim(),
				pressed: element.getAttribute('aria-pressed'),
				profile: document.body.dataset.motionProfile,
				stored: localStorage.getItem(storageKey),
			}), MOTION_STORAGE_KEY);
			check(
				group,
				'reload restores the chosen Turbo presentation profile',
				restored.label === 'TURBO' &&
					restored.pressed === 'true' &&
					restored.profile === 'turbo' &&
					restored.stored === 'turbo',
				serialize(restored),
			);

			await page.emulateMedia({ reducedMotion: 'reduce' });
			await page.waitForFunction(
				(selector) => document.querySelector(selector)?.textContent?.trim() === 'REDUCED',
				SELECTORS.motionMode,
			);
			const reduced = await motion.evaluate((element, storageKey) => ({
				label: element.textContent?.trim(),
				pressed: element.getAttribute('aria-pressed'),
				disabled: element.matches(':disabled'),
				profile: document.body.dataset.motionProfile,
				stored: localStorage.getItem(storageKey),
			}), MOTION_STORAGE_KEY);
			check(
				group,
				'system reduced-motion overrides and disables Turbo without erasing the preference',
				reduced.label === 'REDUCED' &&
					reduced.pressed === 'false' &&
					reduced.disabled &&
					reduced.profile === 'reduced' &&
					reduced.stored === 'turbo',
				serialize(reduced),
			);
			const reducedScreenshot = await saveScreenshot(page, 'presentation-speed-reduced-override');

			await page.reload({ waitUntil: 'domcontentloaded' });
			await waitForEndpoint(network, 'authenticate', 3);
			await waitForStableAction(page);
			check(
				group,
				'reduced-motion override remains active across reload',
				(await motion.innerText()).trim() === 'REDUCED' &&
					(await motion.isDisabled()) &&
					(await page.locator(SELECTORS.board).getAttribute('data-motion-profile')) === 'reduced',
				serialize({
					label: await motion.innerText(),
					disabled: await motion.isDisabled(),
					profile: await page.locator(SELECTORS.board).getAttribute('data-motion-profile'),
				}),
			);

			await page.emulateMedia({ reducedMotion: 'no-preference' });
			await page.waitForFunction(
				(selector) => document.querySelector(selector)?.textContent?.trim() === 'TURBO',
				SELECTORS.motionMode,
			);
			await page.reload({ waitUntil: 'domcontentloaded' });
			await waitForEndpoint(network, 'authenticate', 4);
			await waitForStableAction(page);
			const resumed = await motion.evaluate((element, storageKey) => ({
				label: element.textContent?.trim(),
				pressed: element.getAttribute('aria-pressed'),
				disabled: element.matches(':disabled'),
				profile: document.body.dataset.motionProfile,
				stored: localStorage.getItem(storageKey),
			}), MOTION_STORAGE_KEY);
			check(
				group,
				'removing the system override resumes the persisted Turbo preference',
				resumed.label === 'TURBO' &&
					resumed.pressed === 'true' &&
					!resumed.disabled &&
					resumed.profile === 'turbo' &&
					resumed.stored === 'turbo',
				serialize(resumed),
			);
			check(
				group,
				'presentation preference reloads never write to wallet or event endpoints',
				network.byEndpoint.authenticate.length === 4 &&
					network.byEndpoint.play.length === 0 &&
					network.byEndpoint.endRound.length === 0 &&
					network.byEndpoint.event.length === 0,
				serialize(network.order),
			);
			assertCleanNetwork(group, network);
			assertCleanDiagnostics(group, diagnostics);
			record.motionPreference = { selected, restored, reduced, resumed };
			record.screenshots = [
				reducedScreenshot,
				await saveScreenshot(page, 'presentation-speed-turbo-restored'),
			];
			record.screenshot = record.screenshots.at(-1);
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('minimum-round-duration-hides-result-until-ready', async (record) => {
		const group = 'minimum-round-duration-hides-result-until-ready';
		const minimumRoundDurationMs = 400;
		const lowerBoundToleranceMs = 50;
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: {
					authenticate: () =>
						authenticateResponse({
							jurisdictionOverrides: { minimumRoundDuration: minimumRoundDurationMs },
						}),
					play: async () => {
						await new Promise((resolvePromise) => setTimeout(resolvePromise, 40));
						return playResponse({ active: false });
					},
				},
			});
			const { page, diagnostics } = await openPage(context, origin, liveQuery());
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForStableAction(page);
			const readyBeforePlay = {
				runtimeState: await runtimeState(page),
				finalWin: (await page.locator(SELECTORS.finalWin).innerText()).trim(),
			};
			check(group, 'live ready surface has no result before a completed round', readyBeforePlay.runtimeState === 'live-ready' && readyBeforePlay.finalWin === '—', serialize(readyBeforePlay));

			const startedAtMs = Date.now();
			await page.locator(SELECTORS.primaryAction).click();
			const immediate = {
				elapsedMs: Date.now() - startedAtMs,
				runtimeState: await runtimeState(page),
				finalWin: (await page.locator(SELECTORS.finalWin).innerText()).trim(),
				board: await boardSymbols(page),
				actionDisabled: await page.locator(SELECTORS.primaryAction).isDisabled(),
			};
			check(group, 'immediately after Play the result and outcome board remain hidden', immediate.finalWin === '—' && immediate.board.every((symbol) => symbol === ''), serialize(immediate));
			check(group, 'immediately after Play the round is not ready and cannot be replayed', immediate.runtimeState !== 'live-ready' && immediate.actionDisabled, serialize(immediate));

			await waitForEndpoint(network, 'play', 1);
			await waitForRuntimeState(page, 'live-minimum-duration');
			const held = {
				elapsedMs: Date.now() - startedAtMs,
				runtimeState: await runtimeState(page),
				finalWin: (await page.locator(SELECTORS.finalWin).innerText()).trim(),
				board: await boardSymbols(page),
				actionDisabled: await page.locator(SELECTORS.primaryAction).isDisabled(),
			};
			check(group, 'minimum-duration hold exposes neither result, outcome board, nor a ready action', held.runtimeState === 'live-minimum-duration' && held.finalWin === '—' && held.board.every((symbol) => symbol === '') && held.actionDisabled, serialize(held));

			await waitForStableAction(page);
			const completed = {
				elapsedMs: Date.now() - startedAtMs,
				runtimeState: await runtimeState(page),
				finalWin: (await page.locator(SELECTORS.finalWin).innerText()).trim(),
				board: await boardSymbols(page),
				actionDisabled: await page.locator(SELECTORS.primaryAction).isDisabled(),
			};
			check(group, 'round cannot become ready before the configured minimum duration', completed.elapsedMs >= minimumRoundDurationMs - lowerBoundToleranceMs, serialize({ minimumRoundDurationMs, lowerBoundToleranceMs, completed }));
			check(group, 'completed live round exposes the exact authoritative result, board, and ready action', completed.runtimeState === 'live-ready' && completed.finalWin === '$0.00' && completed.board.some((symbol) => symbol !== '') && !completed.actionDisabled, serialize(completed));
			check(group, 'minimum-duration round sends exactly one play and no end-round write', network.byEndpoint.play.length === 1 && network.byEndpoint.endRound.length === 0, serialize(network.order));
			assertCleanNetwork(group, network);
			assertCleanDiagnostics(group, diagnostics);
			record.timing = { minimumRoundDurationMs, lowerBoundToleranceMs, readyBeforePlay, immediate, held, completed };
			record.screenshot = await saveScreenshot(page, group);
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('authoritative-cascade-motion-turbo-and-skip', async (record) => {
		const group = 'authoritative-cascade-motion-turbo-and-skip';
		const fixture = getGeneratedFixture('base_cascade_3');
		const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: {
					authenticate: () => authenticateResponse(),
					play: () => ({
						status: successStatus(),
						balance: { amount: DEFAULT_BALANCE - DEFAULT_BASE_AMOUNT, currency: 'USD' },
						round: authoritativeFixtureRound({
							fixture,
							active: false,
							id: `blacksite-qa-motion-${network.byEndpoint.play.length + 1}`,
						}),
					}),
				},
			});
			const { page, diagnostics } = await openPage(context, origin, liveQuery());
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForStableAction(page);
			await startFrameSampler(page, 'turbo-cascade');
			await page.evaluate(({ boardSelector, characterSelector }) => {
				const board = document.querySelector(boardSelector);
				const character = document.querySelector(characterSelector);
				window.__blacksiteMotionPhases = [];
				window.__blacksiteCharacterStates = [];
				const captureBoard = () => window.__blacksiteMotionPhases.push({
					phase: board?.getAttribute('data-motion-phase'),
					profile: board?.getAttribute('data-motion-profile'),
					at: performance.now(),
				});
				const captureCharacter = () => {
					const image = character?.querySelector('img');
					window.__blacksiteCharacterStates.push({
						state: character?.getAttribute('data-character-state'),
						profile: character?.getAttribute('data-motion-profile'),
						animation: image ? getComputedStyle(image).animationName : 'none',
						willChange: image ? getComputedStyle(image).willChange : 'auto',
						at: performance.now(),
					});
				};
				captureBoard();
				captureCharacter();
				window.__blacksiteMotionObserver = new MutationObserver(captureBoard);
				window.__blacksiteMotionObserver.observe(board, {
					attributes: true,
					attributeFilter: ['data-motion-phase', 'data-motion-profile'],
				});
				window.__blacksiteCharacterObserver = new MutationObserver(captureCharacter);
				window.__blacksiteCharacterObserver.observe(character, {
					attributes: true,
					attributeFilter: ['data-character-state', 'data-motion-profile'],
				});
			}, { boardSelector: SELECTORS.board, characterSelector: SELECTORS.vaultkeeper });

			await page.locator(SELECTORS.motionMode).click();
			check(group, 'Turbo control selects the bounded turbo presentation profile',
				(await page.locator(SELECTORS.board).getAttribute('data-motion-profile')) === 'turbo' &&
					(await page.locator(SELECTORS.motionMode).getAttribute('aria-pressed')) === 'true',
				serialize({
					profile: await page.locator(SELECTORS.board).getAttribute('data-motion-profile'),
					pressed: await page.locator(SELECTORS.motionMode).getAttribute('aria-pressed'),
				}),
			);
			await page.locator(SELECTORS.primaryAction).click();
			await waitForEndpoint(network, 'play', 1);
			await page.waitForFunction(
				(selector) => document.querySelector(selector)?.getAttribute('data-motion-phase') === 'reveal',
				SELECTORS.board,
			);
			const reelStopCadence = await page.locator(SELECTORS.board).evaluate((board) => {
				const firstRow = [...board.querySelectorAll('.cell[data-row="0"]')];
				return firstRow.map((cell) => ({
					column: Number(cell.getAttribute('data-column')),
					delayMs: Number.parseFloat(getComputedStyle(cell).animationDelay) * 1_000,
					durationMs: Number.parseFloat(getComputedStyle(cell).animationDuration) * 1_000,
					animation: getComputedStyle(cell).animationName,
				}));
			});
			const reelStopScreenshot = await saveScreenshot(page, `${group}-reel-stop-cadence`);
			await waitForStableAction(page);
			const framePacing = await stopFrameSampler(page, 'turbo-cascade');
			const turboPhases = await page.evaluate(() => window.__blacksiteMotionPhases);
			const turboCharacterStates = await page.evaluate(() => window.__blacksiteCharacterStates);
			const turboNames = turboPhases.map(({ phase }) => phase);
			let previousIndex = -1;
			const orderedTurbo = ['hit', 'remove', 'drop', 'settle'].every((phase) => {
				const index = turboNames.indexOf(phase, previousIndex + 1);
				previousIndex = index;
				return index >= 0;
			});
			check(group, 'authoritative turbo cascade visibly traverses hit, remove, drop and settle', orderedTurbo, serialize(turboPhases));
			check(group, 'seven reel columns stop in a strictly staggered turbo cadence',
				reelStopCadence.length === 7 && reelStopCadence.every(({ column, durationMs, animation }, index) =>
					column === index && durationMs === 70 && animation.endsWith('board-reveal')) &&
					reelStopCadence.every(({ delayMs }, index) => index === 0 || delayMs > reelStopCadence[index - 1].delayMs),
				serialize(reelStopCadence),
			);
			check(group, 'turbo cascade has no sustained frame-pacing stalls',
				framePacing.samples >= 20 && framePacing.percentile95Ms <= 50 && framePacing.over50Ms <= Math.max(2, Math.ceil(framePacing.samples * 0.05)),
				serialize(framePacing),
			);
			const characterNames = turboCharacterStates.map(({ state }) => state);
			let previousCharacterIndex = -1;
			const orderedCharacterFallback = ['spin_start', 'monitoring', 'win_acknowledge', 'idle_a'].every((state) => {
				const index = characterNames.indexOf(state, previousCharacterIndex + 1);
				previousCharacterIndex = index;
				return index >= 0;
			});
			check(group, 'static Vaultkeeper fallback follows authoritative spin, board, win and recovery states', orderedCharacterFallback, serialize(turboCharacterStates));
			check(group, 'Vaultkeeper fallback uses bounded CSS motion only while its semantic state is active', turboCharacterStates.some(({ state, animation }) => state === 'win_acknowledge' && animation.endsWith('vaultkeeper-win-acknowledge')), serialize(turboCharacterStates));
			check(group, 'Vaultkeeper promotes transform/filter only for active authored reactions',
				turboCharacterStates.some(({ state, willChange }) => state === 'win_acknowledge' && willChange.includes('transform') && willChange.includes('filter')) &&
					turboCharacterStates.some(({ state, willChange }) => state === 'idle_a' && willChange === 'auto'),
				serialize(turboCharacterStates),
			);

			await page.locator(SELECTORS.motionMode).click();
			await startFrameSampler(page, 'normal-cascade');
			await page.locator(SELECTORS.primaryAction).click();
			await waitForEndpoint(network, 'play', 2);
			await page.waitForFunction(
				(selector) => document.querySelector(selector)?.getAttribute('data-motion-phase') === 'reveal',
				SELECTORS.board,
			);
			const normalReelStopCadence = await page.locator(SELECTORS.board).evaluate((board) => {
				const firstRow = [...board.querySelectorAll('.cell[data-row="0"]')];
				return firstRow.map((cell) => ({
					column: Number(cell.getAttribute('data-column')),
					delayMs: Number.parseFloat(getComputedStyle(cell).animationDelay) * 1_000,
					durationMs: Number.parseFloat(getComputedStyle(cell).animationDuration) * 1_000,
					animation: getComputedStyle(cell).animationName,
				}));
			});
			const normalReelStopScreenshot = await saveScreenshot(page, `${group}-normal-reel-stop-cadence`);
			await waitForStableAction(page);
			const normalFramePacing = await stopFrameSampler(page, 'normal-cascade');
			check(group, 'seven reel columns stop in the authored normal cadence',
				normalReelStopCadence.length === 7 && normalReelStopCadence.every(({ column, delayMs, durationMs, animation }, index) =>
					column === index && delayMs === index * 24 && durationMs === 180 && animation.endsWith('board-reveal')),
				serialize(normalReelStopCadence),
			);
			check(group, 'normal cascade has no sustained frame-pacing stalls',
				normalFramePacing.samples >= 20 && normalFramePacing.percentile95Ms <= 50 && normalFramePacing.over50Ms <= Math.max(2, Math.ceil(normalFramePacing.samples * 0.05)),
				serialize(normalFramePacing),
			);

			await page.locator(SELECTORS.primaryAction).click();
			await waitForEndpoint(network, 'play', 3);
			await page.waitForFunction(
				(selector) => document.querySelector(selector)?.getAttribute('data-motion-phase') === 'hit',
				SELECTORS.board,
			);
			const skippedAt = Date.now();
			check(group, 'Skip becomes available only while authoritative presentation is active',
				!(await page.locator(SELECTORS.skipPresentation).isDisabled()),
				String(await page.locator(SELECTORS.skipPresentation).isDisabled()),
			);
			await page.locator(SELECTORS.skipPresentation).click();
			await waitForStableAction(page);
			const completed = {
				state: await runtimeState(page),
				phase: await page.locator(SELECTORS.board).getAttribute('data-motion-phase'),
				characterState: await page.locator(SELECTORS.vaultkeeper).getAttribute('data-character-state'),
				characterWillChange: await page.locator(`${SELECTORS.vaultkeeper} img`).evaluate((image) => getComputedStyle(image).willChange),
				finalWin: (await page.locator(SELECTORS.finalWin).innerText()).trim(),
				skipElapsedMs: Date.now() - skippedAt,
			};
			check(group, 'Skip drains remaining cues and returns to an idle ready state without deadlock',
				completed.state === 'live-ready' && completed.phase === 'idle' && completed.characterState === 'idle_a' && completed.characterWillChange === 'auto' && completed.skipElapsedMs < 1_000,
				serialize(completed),
			);
			check(group, 'Turbo and skipped plays preserve the exact authoritative final payout',
				completed.finalWin === formatExactApi(DEFAULT_BASE_AMOUNT * fixture.book.payoutMultiplier / 100, 'USD'),
				serialize({ completed, payoutCentiX: fixture.book.payoutMultiplier }),
			);
			check(group, 'motion controls never add settlement or event-write calls for inactive rounds',
				network.byEndpoint.play.length === 3 && network.byEndpoint.endRound.length === 0 && network.byEndpoint.event.length === 0,
				serialize(network.order),
			);
			assertCleanNetwork(group, network);
			assertCleanDiagnostics(group, diagnostics);
			const normalScreenshot = await saveScreenshot(page, group);
			await page.locator(`${SELECTORS.vaultkeeper} img`).evaluate((image) => {
				image.dispatchEvent(new Event('error'));
			});
			await page.waitForFunction(
				(selector) => document.querySelector(selector)?.getAttribute('data-asset-state') === 'fallback',
				SELECTORS.vaultkeeper,
			);
			const assetFallback = await page.evaluate(({ characterSelector, fallbackSelector }) => {
				const character = document.querySelector(characterSelector);
				const image = character?.querySelector('img');
				const fallback = document.querySelector(fallbackSelector);
				return {
					assetState: character?.getAttribute('data-asset-state'),
					imageDisplay: image ? getComputedStyle(image).display : null,
					fallbackDisplay: fallback ? getComputedStyle(fallback).display : null,
				};
			}, { characterSelector: SELECTORS.vaultkeeper, fallbackSelector: SELECTORS.vaultkeeperFallback });
			check(group, 'missing Vaultkeeper image switches to the deterministic mechanical silhouette without blocking play', assetFallback.assetState === 'fallback' && assetFallback.imageDisplay === 'none' && assetFallback.fallbackDisplay === 'block' && (await runtimeState(page)) === 'live-ready', serialize(assetFallback));
			record.motion = { fixture: fixture.id, reelStopCadence, framePacing, normalReelStopCadence, normalFramePacing, turboPhases, turboCharacterStates, completed, assetFallback };
			record.screenshot = normalScreenshot;
			record.reelStopScreenshot = reelStopScreenshot;
			record.normalReelStopScreenshot = normalReelStopScreenshot;
			record.assetFallbackScreenshot = await saveScreenshot(page, `${group}-asset-fallback`);
			record.network = network;
			record.diagnostics = diagnostics;
			await page.evaluate(() => {
				window.__blacksiteMotionObserver?.disconnect();
				window.__blacksiteCharacterObserver?.disconnect();
			});
		} finally {
			await context.close();
		}
	});

	await runScenario('authoritative-blackout-vault-transition', async (record) => {
		const group = 'authoritative-blackout-vault-transition';
		const fixture = getGeneratedFixture('blackout_zero');
		const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: {
					authenticate: () => authenticateResponse(),
					play: () => ({
						status: successStatus(),
						balance: {
							amount: DEFAULT_BALANCE - DEFAULT_BASE_AMOUNT * MODE_COSTS.blackout,
							currency: 'USD',
						},
						round: authoritativeFixtureRound({
							fixture,
							active: false,
							id: 'blacksite-qa-blackout-transition',
						}),
					}),
				},
			});
			const { page, diagnostics } = await openPage(context, origin, liveQuery());
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForStableAction(page);
			await startFrameSampler(page, 'blackout-transition');
			await page.evaluate((selector) => {
				const board = document.querySelector(selector);
				window.__blacksiteFeaturePhases = [];
				const capture = () => window.__blacksiteFeaturePhases.push({
					phase: board?.getAttribute('data-motion-phase'),
					at: performance.now(),
				});
				capture();
				window.__blacksiteFeatureObserver = new MutationObserver(capture);
				window.__blacksiteFeatureObserver.observe(board, {
					attributes: true,
					attributeFilter: ['data-motion-phase'],
				});
			}, SELECTORS.board);

			await page.locator(SELECTORS.modeBlackout).click();
			await page.locator(SELECTORS.primaryAction).click();
			const dialog = page.getByRole('dialog', { name: /Confirm complete play amount/i });
			await dialog.waitFor({ state: 'visible' });
			await dialog.getByRole('button', { name: /^CONFIRM$/i }).click();
			await waitForEndpoint(network, 'play', 1);
			await page.waitForFunction(
				(selector) => document.querySelector(selector)?.getAttribute('data-motion-phase') === 'blackout-enter',
				SELECTORS.board,
			);
			const activeTransition = await page.evaluate(() => {
				const frame = document.querySelector('.board-frame');
				const environment = document.querySelector('.vault-environment');
				const environmentStyle = getComputedStyle(environment);
				return {
					phase: frame?.getAttribute('data-motion-phase'),
					lockAnimation: getComputedStyle(frame, '::before').animationName,
					shutterAnimation: getComputedStyle(frame, '::after').animationName,
					environmentAnimation: environmentStyle.animationName,
					environmentWillChange: environmentStyle.willChange,
				};
			});
			check(group, 'authoritative feature_started visibly engages the mechanical vault transition',
				activeTransition.phase === 'blackout-enter' &&
				activeTransition.lockAnimation.endsWith('lock-engage') &&
				activeTransition.shutterAnimation.endsWith('blackout-shutter') &&
				activeTransition.environmentAnimation.endsWith('environment-lock-pulse') &&
				activeTransition.environmentWillChange.split(',').map((value) => value.trim()).includes('opacity'),
				serialize(activeTransition),
			);
			record.transitionScreenshot = await saveScreenshot(page, group);
			await waitForStableAction(page);
			const framePacing = await stopFrameSampler(page, 'blackout-transition');
			const phases = await page.evaluate(() => window.__blacksiteFeaturePhases);
			const phaseNames = phases.map(({ phase }) => phase);
			check(group, 'the feature lifecycle traverses authoritative entry, reveal and exit phases',
				['blackout-enter', 'reveal', 'blackout-exit'].every((phase) => phaseNames.includes(phase)),
				serialize(phases),
			);
			check(group, 'normal BLACKOUT transition has no sustained frame-pacing stalls',
				framePacing.samples >= 20 && framePacing.percentile95Ms <= 50 && framePacing.over50Ms <= Math.max(2, Math.ceil(framePacing.samples * 0.05)),
				serialize(framePacing),
			);
			check(group, 'vault transition preserves the exact zero payout and one paid request',
				(await page.locator(SELECTORS.finalWin).innerText()).trim() === '$0.00' &&
				network.byEndpoint.play.length === 1 &&
				network.byEndpoint.endRound.length === 0 &&
				network.byEndpoint.event.length === 0,
				serialize({ finalWin: await page.locator(SELECTORS.finalWin).innerText(), order: network.order }),
			);
			assertCleanNetwork(group, network);
			assertCleanDiagnostics(group, diagnostics);
			record.motion = { fixture: fixture.id, activeTransition, phases, framePacing };
			record.network = network;
			record.diagnostics = diagnostics;
			await page.evaluate(() => window.__blacksiteFeatureObserver?.disconnect());
		} finally {
			await context.close();
		}
	});

	for (const featureCase of [
		{
			scenario: 'live-natural-base-blackout-enters-and-returns',
			fixtureId: 'base_natural_blackout',
			mode: 'base',
			modeSelector: SELECTORS.modeBase,
			cost: MODE_COSTS.base,
			expectedTotal: '$1.00',
			confirmation: false,
		},
		{
			scenario: 'live-deep-access-feature-confirms-enters-and-returns',
			fixtureId: 'deep_access_feature',
			mode: 'deep_access',
			modeSelector: SELECTORS.modeDeepAccess,
			cost: MODE_COSTS.deep_access,
			expectedTotal: '$4.00',
			confirmation: true,
		},
	]) {
		await runScenario(featureCase.scenario, async (record) => {
			const group = featureCase.scenario;
			const fixture = getGeneratedFixture(featureCase.fixtureId);
			const expectedPayout = DEFAULT_BASE_AMOUNT * fixture.book.payoutMultiplier / 100;
			const expectedBalance = DEFAULT_BALANCE - DEFAULT_BASE_AMOUNT * featureCase.cost + expectedPayout;
			const expectedEventTypes = ['feature_armed', 'feature_start', 'feature_cycle', 'feature_end', 'round_end'];
			const eventTypes = fixture.book.events.map(({ type }) => type);
			let previousEventIndex = -1;
			const exactFixtureLifecycle = expectedEventTypes.every((type) => {
				const index = eventTypes.indexOf(type, previousEventIndex + 1);
				previousEventIndex = index;
				return index >= 0;
			});
			check(group, 'math-backed fixture contains the ordered feature lifecycle through round_end',
				exactFixtureLifecycle && fixture.mode === featureCase.mode,
				serialize({ fixture: fixture.id, mode: fixture.mode, eventTypes }),
			);

			const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
			try {
				const network = await installMockRgs(context, {
					pageOrigin: origin,
					handlers: {
						authenticate: () => authenticateResponse(),
						play: (request) => {
							const round = authoritativeFixtureRound({
								fixture,
								active: false,
								amount: request.body.amount,
								currency: request.body.currency,
								id: `blacksite-qa-${featureCase.fixtureId}`,
							});
							return {
								status: successStatus(),
								balance: { amount: expectedBalance, currency: 'USD' },
								round,
							};
						},
					},
				});
				const { page, diagnostics } = await openPage(context, origin, liveQuery());
				await waitForEndpoint(network, 'authenticate', 1);
				await waitForStableAction(page);
				await page.locator(SELECTORS.motionMode).click();
				check(group, 'live feature proof uses the bounded turbo presentation profile',
					(await page.locator(SELECTORS.board).getAttribute('data-motion-profile')) === 'turbo' &&
						(await page.locator(SELECTORS.motionMode).getAttribute('aria-pressed')) === 'true',
					serialize({
						profile: await page.locator(SELECTORS.board).getAttribute('data-motion-profile'),
						pressed: await page.locator(SELECTORS.motionMode).getAttribute('aria-pressed'),
					}),
				);
				await page.evaluate(({ boardSelector, characterSelector }) => {
					const board = document.querySelector(boardSelector);
					const character = document.querySelector(characterSelector);
					window.__blacksiteLiveFeaturePhases = [];
					window.__blacksiteLiveFeatureCharacters = [];
					const captureBoard = () => window.__blacksiteLiveFeaturePhases.push({
						phase: board?.getAttribute('data-motion-phase'),
						at: performance.now(),
					});
					const captureCharacter = () => window.__blacksiteLiveFeatureCharacters.push({
						state: character?.getAttribute('data-character-state'),
						at: performance.now(),
					});
					captureBoard();
					captureCharacter();
					window.__blacksiteLiveFeatureBoardObserver = new MutationObserver(captureBoard);
					window.__blacksiteLiveFeatureCharacterObserver = new MutationObserver(captureCharacter);
					window.__blacksiteLiveFeatureBoardObserver.observe(board, {
						attributes: true,
						attributeFilter: ['data-motion-phase'],
					});
					window.__blacksiteLiveFeatureCharacterObserver.observe(character, {
						attributes: true,
						attributeFilter: ['data-character-state'],
					});
				}, { boardSelector: SELECTORS.board, characterSelector: SELECTORS.vaultkeeper });

				await page.locator(featureCase.modeSelector).click();
				check(group, 'selected mode exposes its exact complete-play amount before request',
					(await page.locator(featureCase.modeSelector).getAttribute('aria-pressed')) === 'true' &&
						(await page.locator(SELECTORS.totalPlay).innerText()).trim() === featureCase.expectedTotal,
					serialize({
						pressed: await page.locator(featureCase.modeSelector).getAttribute('aria-pressed'),
						totalPlay: await page.locator(SELECTORS.totalPlay).innerText(),
					}),
				);
				await page.locator(SELECTORS.primaryAction).click();
				if (featureCase.confirmation) {
					const dialog = page.getByRole('dialog', { name: /Confirm complete play amount/i });
					await dialog.waitFor({ state: 'visible' });
					const dialogText = await dialog.innerText();
					check(group, 'Deep Access remains request-free until exact high-cost confirmation',
						network.byEndpoint.play.length === 0 &&
							dialogText.includes(featureCase.expectedTotal) &&
							dialogText.includes(`${featureCase.cost}×`),
						serialize({ dialogText, order: network.order }),
					);
					await dialog.getByRole('button', { name: /^CONFIRM$/i }).click();
				}
				await waitForEndpoint(network, 'play', 1);
				assertExactRequest(group, network.byEndpoint.play[0], {
					method: 'POST',
					path: '/wallet/play',
					body: {
						sessionID: SESSION_ID,
						currency: 'USD',
						amount: DEFAULT_BASE_AMOUNT,
						mode: featureCase.mode,
					},
				});
				await page.waitForFunction(
					(selector) => document.querySelector(selector)?.getAttribute('data-motion-phase') === 'blackout-enter',
					SELECTORS.board,
					{ timeout: 10_000 },
				);
				record.featureEntryScreenshot = await saveScreenshot(page, `${group}-feature-entry`);
				await waitForStableAction(page, 30_000);
				const observed = await page.evaluate(() => ({
					phases: window.__blacksiteLiveFeaturePhases,
					characters: window.__blacksiteLiveFeatureCharacters,
				}));
				const phaseNames = observed.phases.map(({ phase }) => phase);
				const characterNames = observed.characters.map(({ state }) => state);
				let previousPhaseIndex = -1;
				const orderedPhases = ['blackout-enter', 'blackout-exit', 'idle'].every((phase) => {
					const index = phaseNames.indexOf(phase, previousPhaseIndex + 1);
					previousPhaseIndex = index;
					return index >= 0;
				});
				let previousCharacterIndex = -1;
				const orderedCharacters = ['feature_trigger', 'bonus_idle', 'recover', 'idle_a'].every((state) => {
					const index = characterNames.indexOf(state, previousCharacterIndex + 1);
					previousCharacterIndex = index;
					return index >= 0;
				});
				check(group, 'live presentation visibly enters and exits BLACKOUT before returning idle',
					orderedPhases,
					serialize(observed.phases),
				);
				check(group, 'Vaultkeeper follows trigger, feature cycle, recovery and idle states in order',
					orderedCharacters,
					serialize(observed.characters),
				);
				const completed = {
					state: await runtimeState(page),
					phase: await page.locator(SELECTORS.board).getAttribute('data-motion-phase'),
					character: await page.locator(SELECTORS.vaultkeeper).getAttribute('data-character-state'),
					boardStatus: (await page.locator(SELECTORS.boardStatus).innerText()).trim(),
					boardCells: (await boardSymbols(page)).length,
					finalWin: (await page.locator(SELECTORS.finalWin).innerText()).trim(),
					balance: (await page.locator(SELECTORS.walletBalance).innerText()).trim(),
					totalPlay: (await page.locator(SELECTORS.totalPlay).innerText()).trim(),
				};
				check(group, 'authoritative feature completes once and returns to the live ready shell',
					completed.state === 'live-ready' &&
						completed.phase === 'idle' &&
						completed.character === 'idle_a' &&
						completed.boardStatus === 'CHOOSE ACCESS LEVEL AND SPIN' &&
						completed.boardCells === 49,
					serialize(completed),
				);
				check(group, 'terminal payout and authoritative wallet balance remain exact',
					completed.finalWin === formatExactApi(expectedPayout, 'USD') &&
						completed.balance === formatExactApi(expectedBalance, 'USD') &&
						completed.totalPlay === featureCase.expectedTotal,
					serialize({ completed, expectedPayout, expectedBalance }),
				);
				check(group, 'inactive authoritative feature sends one play and no settlement or event writes',
					network.byEndpoint.play.length === 1 &&
						network.byEndpoint.endRound.length === 0 &&
						network.byEndpoint.event.length === 0,
					serialize(network.order),
				);
				assertCleanNetwork(group, network);
				assertCleanDiagnostics(group, diagnostics);
				record.feature = {
					fixture: fixture.id,
					mode: featureCase.mode,
					eventCount: fixture.book.events.length,
					expectedPayout,
					expectedBalance,
					observed,
					completed,
				};
				record.screenshot = await saveScreenshot(page, `${group}-completed`);
				record.network = network;
				record.diagnostics = diagnostics;
				await page.evaluate(() => {
					window.__blacksiteLiveFeatureBoardObserver?.disconnect();
					window.__blacksiteLiveFeatureCharacterObserver?.disconnect();
				});
			} finally {
				await context.close();
			}
		});
	}

	await runScenario('session-position-and-timer-follow-authoritative-balance', async (record) => {
		const group = 'session-position-and-timer-follow-authoritative-balance';
		const authoritativePostPlayBalance = DEFAULT_BALANCE - 7 * API_UNIT;
		const context = await browser.newContext({
			viewport: { width: 390, height: 844 },
			isMobile: true,
			hasTouch: true,
		});
		try {
			await context.addInitScript(() => {
				const nativeSetInterval = window.setInterval.bind(window);
				window.__blacksiteIntervalAudit = [];
				window.setInterval = (handler, delay = 0, ...args) => {
					const record = { delay: Number(delay), calls: 0 };
					window.__blacksiteIntervalAudit.push(record);
					const auditedHandler =
						typeof handler === 'function'
							? (...callbackArgs) => {
								record.calls += 1;
								return handler(...callbackArgs);
							}
							: handler;
					return nativeSetInterval(auditedHandler, delay, ...args);
				};
			});
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: {
					authenticate: () =>
						authenticateResponse({
							jurisdictionOverrides: {
								displayNetPosition: true,
								displaySessionTimer: true,
							},
						}),
					play: () =>
						playResponse({
							active: false,
							balanceBefore: authoritativePostPlayBalance + DEFAULT_BASE_AMOUNT,
						}),
				},
			});
			const { page, diagnostics } = await openPage(context, origin, liveQuery({ device: 'mobile' }));
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForStableAction(page);
			await page.locator(SELECTORS.sessionNetPosition).waitFor({ state: 'visible' });
			await page.locator(SELECTORS.sessionTimer).waitFor({ state: 'visible' });
			const initialUi = {
				netPosition: (await page.locator(SELECTORS.sessionNetPosition).innerText()).trim(),
				sessionTimer: (await page.locator(SELECTORS.sessionTimer).innerText()).trim(),
				walletBalance: (await page.locator(SELECTORS.walletBalance).innerText()).trim(),
				netPositionSemantics: await page.locator(SELECTORS.sessionNetPosition).evaluate((element) => ({
					role: element.getAttribute('role'),
					live: element.getAttribute('aria-live'),
					atomic: element.getAttribute('aria-atomic'),
					labelledBy: element.getAttribute('aria-labelledby'),
				})),
				timerSemantics: await page.locator(SELECTORS.sessionTimer).evaluate((element) => ({
					role: element.getAttribute('role'),
					live: element.getAttribute('aria-live'),
					atomic: element.getAttribute('aria-atomic'),
					labelledBy: element.getAttribute('aria-labelledby'),
				})),
			};
			check(group, 'enabled session position and timer are both visible at 390×844 mobile', await page.locator(SELECTORS.sessionNetPosition).isVisible() && await page.locator(SELECTORS.sessionTimer).isVisible(), serialize(initialUi));
			check(group, 'session position opens at exact zero from authenticated balance', initialUi.netPosition === '$0.00', serialize(initialUi));
			check(group, 'session timer uses a bounded minutes-and-seconds display', /^\d{2}:\d{2}$/.test(initialUi.sessionTimer), serialize(initialUi));
			check(
				group,
				'session position is polite while the ticking timer remains non-live',
				initialUi.netPositionSemantics.role === 'status' &&
					initialUi.netPositionSemantics.live === 'polite' &&
					initialUi.netPositionSemantics.atomic === 'true' &&
					initialUi.netPositionSemantics.labelledBy === 'session-position-label' &&
					initialUi.timerSemantics.role === 'timer' &&
					initialUi.timerSemantics.live === 'off' &&
					initialUi.timerSemantics.atomic === 'true' &&
					initialUi.timerSemantics.labelledBy === 'session-timer-label',
				serialize(initialUi),
			);
			await page.waitForFunction(
				({ selector, initial }) => document.querySelector(selector)?.textContent?.trim() !== initial,
				{ selector: SELECTORS.sessionTimer, initial: initialUi.sessionTimer },
				{ timeout: 2500 },
			);
			const progressedTimer = (await page.locator(SELECTORS.sessionTimer).innerText()).trim();
			check(group, 'non-live session timer still advances visibly once per second', progressedTimer !== initialUi.sessionTimer && /^\d{2}:\d{2}$/.test(progressedTimer), serialize({ initial: initialUi.sessionTimer, progressed: progressedTimer }));
			const cadenceBefore = await page.evaluate(() =>
				window.__blacksiteIntervalAudit.map((record) => ({ ...record })),
			);
			await page.waitForTimeout(1_100);
			const cadenceAfter = await page.evaluate(() =>
				window.__blacksiteIntervalAudit.map((record) => ({ ...record })),
			);
			const timerIntervalBefore = cadenceBefore.find((record) => record.delay === 1_000);
			const timerIntervalAfter = cadenceAfter.find((record) => record.delay === 1_000);
			const timerCallbackDelta =
				timerIntervalBefore && timerIntervalAfter
					? timerIntervalAfter.calls - timerIntervalBefore.calls
					: null;
			check(
				group,
				'session timer owns one one-hertz interval with no sub-second polling',
				cadenceAfter.filter((record) => record.delay === 1_000).length === 1 &&
					cadenceAfter.every((record) => record.delay >= 1_000) &&
					timerCallbackDelta !== null &&
					timerCallbackDelta >= 1 &&
					timerCallbackDelta <= 2,
				serialize({ cadenceBefore, cadenceAfter, timerCallbackDelta }),
			);
			record.timerCadence = { cadenceBefore, cadenceAfter, timerCallbackDelta };

			await page.locator(SELECTORS.primaryAction).click();
			await waitForEndpoint(network, 'play', 1);
			await waitForStableAction(page);
			const updatedUi = {
				netPosition: (await page.locator(SELECTORS.sessionNetPosition).innerText()).trim(),
				sessionTimer: (await page.locator(SELECTORS.sessionTimer).innerText()).trim(),
				walletBalance: (await page.locator(SELECTORS.walletBalance).innerText()).trim(),
			};
			check(group, 'session position reports authoritative total wagered minus total won', updatedUi.netPosition === '+$7.00' && updatedUi.walletBalance === '$993.00', serialize({ authoritativePostPlayBalance, initialUi, updatedUi }));
			check(group, 'session timer remains visible and well-formed after play', await page.locator(SELECTORS.sessionTimer).isVisible() && /^\d{2}:\d{2}$/.test(updatedUi.sessionTimer), serialize(updatedUi));
			assertExactRequest(group, network.byEndpoint.play[0], {
				method: 'POST',
				path: '/wallet/play',
				body: {
					sessionID: SESSION_ID,
					currency: 'USD',
					amount: DEFAULT_BASE_AMOUNT,
					mode: 'base',
				},
			});
			check(group, 'session UI scenario sends exactly one play and no end-round write', network.byEndpoint.play.length === 1 && network.byEndpoint.endRound.length === 0, serialize(network.order));
			assertCleanNetwork(group, network);
			assertCleanDiagnostics(group, diagnostics);
			record.sessionUi = { authoritativePostPlayBalance, initialUi, progressedTimer, updatedUi };
			record.screenshot = await saveScreenshot(page, group);
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('inactive-zero-play', async (record) => {
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: {
					authenticate: () => authenticateResponse(),
					play: () => playResponse({ active: false }),
				},
			});
			const { page, diagnostics } = await openPage(context, origin, liveQuery());
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForStableAction(page);
			await page.locator(SELECTORS.primaryAction).click();
			await waitForEndpoint(network, 'play', 1);
			await waitForStableAction(page);
			await page.waitForTimeout(250);
			assertExactRequest('inactive-zero-play', network.byEndpoint.play[0], {
				method: 'POST',
				path: '/wallet/play',
				body: {
					sessionID: SESSION_ID,
					currency: 'USD',
					amount: DEFAULT_BASE_AMOUNT,
					mode: 'base',
				},
			});
			check('inactive-zero-play', 'one play request is sent', network.byEndpoint.play.length === 1, serialize(network.order));
			check('inactive-zero-play', 'inactive zero round sends no end-round', network.byEndpoint.endRound.length === 0, serialize(network.order));
			check('inactive-zero-play', 'order is authenticate then play', serialize(network.order) === serialize(['authenticate', 'play']), serialize(network.order));
			assertCleanNetwork('inactive-zero-play', network);
			record.screenshot = await saveScreenshot(page, 'inactive-zero-play');
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('active-play-settles-once', async (record) => {
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: {
					authenticate: () => authenticateResponse(),
					play: () => playResponse({ active: true }),
					event: (request) => ({ event: request.body.event }),
					endRound: () => endRoundResponse(),
				},
			});
			const { page, diagnostics } = await openPage(context, origin, liveQuery());
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForStableAction(page);
			await page.locator(SELECTORS.primaryAction).click();
			await waitForEndpoint(network, 'play', 1);
			await waitForEndpoint(network, 'endRound', 1);
			await waitForStableAction(page);
			await page.waitForTimeout(200);
			assertExactRequest('active-play-settles-once', network.byEndpoint.endRound[0], {
				method: 'POST',
				path: '/wallet/end-round',
				body: { sessionID: SESSION_ID },
			});
			assertExactRequest('active-play-settles-once', network.byEndpoint.event[0], {
				method: 'POST',
				path: '/bet/event',
				body: {
					sessionID: SESSION_ID,
					event: encodePresentationCursor(2),
				},
			});
			check('active-play-settles-once', 'play occurs once', network.byEndpoint.play.length === 1, serialize(network.order));
			check('active-play-settles-once', 'durable board checkpoint is persisted exactly once', network.byEndpoint.event.length === 1, serialize(network.order));
			check('active-play-settles-once', 'end-round occurs exactly once', network.byEndpoint.endRound.length === 1, serialize(network.order));
			check('active-play-settles-once', 'order is authenticate, play, checkpoint, end-round', serialize(network.order) === serialize(['authenticate', 'play', 'event', 'endRound']), serialize(network.order));
			assertCleanNetwork('active-play-settles-once', network);
			record.screenshot = await saveScreenshot(page, 'active-play-settles-once');
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('checkpoint-failure-settles-paid-win-exactly', async (record) => {
		const group = 'checkpoint-failure-settles-paid-win-exactly';
		const fixture = getGeneratedFixture('base_big');
		const round = authoritativeFixtureRound({ fixture, id: 'blacksite-qa-event-failure-paid-win' });
		const debitedBalance = DEFAULT_BALANCE - DEFAULT_BASE_AMOUNT;
		const settledBalance = debitedBalance + round.payout;
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: {
					authenticate: () =>
						authenticateResponse({
							jurisdictionOverrides: { displayNetPosition: true },
						}),
					play: () => ({
						status: successStatus(),
						balance: { amount: debitedBalance, currency: 'USD' },
						round,
					}),
					event: () =>
						mockHttpResponse(503, {
							error: {
								code: 'CHECKPOINT_UNAVAILABLE',
								message: 'Presentation checkpoint temporarily unavailable.',
							},
						}),
					endRound: () => endRoundResponse({ balance: settledBalance }),
				},
			});
			const { page, diagnostics } = await openPage(context, origin, liveQuery());
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForStableAction(page);
			await page.locator(SELECTORS.primaryAction).click();
			await waitForEndpoint(network, 'event', 1);
			await waitForEndpoint(network, 'endRound', 1);
			await waitForRuntimeState(page, 'live-ready');
			await page.locator(SELECTORS.launchError).waitFor({ state: 'visible' });
			const result = {
				finalWin: (await page.locator(SELECTORS.finalWin).innerText()).trim(),
				walletBalance: (await page.locator(SELECTORS.walletBalance).innerText()).trim(),
				netPosition: (await page.locator(SELECTORS.sessionNetPosition).innerText()).trim(),
				error: (await page.locator(SELECTORS.launchError).innerText()).trim(),
			};
			check(group, 'checkpoint failure remains visibly reported after fallback settlement', result.error.length > 0, serialize(result));
			check(group, 'fallback settlement exposes the exact already-authoritative paid win', result.finalWin === '$200.00', serialize({ payoutApi: round.payout, result }));
			check(group, 'fallback settlement adopts the exact authoritative settled balance', result.walletBalance === '$1199.00', serialize({ settledBalance, result }));
			check(group, 'settled winning balance reports total wagered minus total won with the correct sign', result.netPosition === '−$199.00', serialize(result));
			check(group, 'checkpoint failure settles exactly once', network.byEndpoint.event.length === 1 && network.byEndpoint.endRound.length === 1, serialize(network.order));
			check(group, 'checkpoint failure order is authenticate, play, event, end-round', serialize(network.order) === serialize(['authenticate', 'play', 'event', 'endRound']), serialize(network.order));
			assertCleanNetwork(group, network);
			assertOnlyExpectedHttpDiagnostic(group, diagnostics, 503);
			record.result = { ...result, payoutApi: round.payout, settledBalance };
			record.screenshot = await saveScreenshot(page, group);
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('settlement-http-503-reloads-and-restores-exactly-once', async (record) => {
		const group = 'settlement-http-503-reloads-and-restores-exactly-once';
		const restoredBalance = DEFAULT_BALANCE - DEFAULT_BASE_AMOUNT;
		const restoredRound = authoritativeZeroRound({
			active: true,
			id: 'blacksite-qa-settlement-recovery',
			event: encodePresentationCursor(2),
		});
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: {
					authenticate: (_request, networkEvidence) =>
						networkEvidence.byEndpoint.authenticate.length === 1
							? authenticateResponse()
							: authenticateResponse({
									balance: restoredBalance,
									round: restoredRound,
								}),
					play: () => playResponse({ active: true }),
					event: (request) => ({ event: request.body.event }),
					endRound: (_request, networkEvidence) =>
						networkEvidence.byEndpoint.endRound.length === 1
							? mockHttpResponse(503, {
									error: {
										code: 'SETTLEMENT_UNAVAILABLE',
										message: 'Settlement status must be restored from the authoritative session.',
									},
								})
							: endRoundResponse({ balance: restoredBalance }),
				},
			});
			const { page, diagnostics } = await openPage(context, origin, liveQuery());
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForStableAction(page);
			await page.locator(SELECTORS.primaryAction).click();
			await waitForEndpoint(network, 'endRound', 1);
			await page.locator(SELECTORS.launchError).waitFor({ state: 'visible', timeout: 10_000 });
			await waitForRuntimeState(page, 'live-error');

			assertExactRequest(group, network.byEndpoint.endRound[0], {
				method: 'POST',
				path: '/wallet/end-round',
				body: { sessionID: SESSION_ID },
			});
			check(group, 'failed settlement keeps Play disabled and exposes explicit restore',
				await page.locator(SELECTORS.primaryAction).isDisabled() &&
					await page.locator('[data-testid="recovery-action"]').isVisible(),
				serialize({ state: await runtimeState(page), order: network.order }),
			);
			check(group, 'failed settlement preserves the exact authoritative zero result',
				(await page.locator(SELECTORS.finalWin).innerText()).trim() === '$0.00',
				await page.locator(SELECTORS.finalWin).innerText(),
			);
			await page.waitForTimeout(300);
			check(group, 'failed settlement is never retried automatically',
				network.byEndpoint.endRound.length === 1,
				serialize(network.order),
			);
			record.errorScreenshot = await saveScreenshot(page, 'settlement-http-503-error');

			await page.locator('[data-testid="recovery-action"]').click();
			await waitForEndpoint(network, 'authenticate', 2);
			await waitForEndpoint(network, 'endRound', 2);
			await waitForRuntimeState(page, 'live-ready');
			await page.waitForTimeout(300);

			for (const request of network.byEndpoint.authenticate) {
				assertExactRequest(group, request, {
					method: 'POST',
					path: '/wallet/authenticate',
					body: { sessionID: SESSION_ID, language: 'en' },
				});
			}
			for (const request of network.byEndpoint.endRound) {
				assertExactRequest(group, request, {
					method: 'POST',
					path: '/wallet/end-round',
					body: { sessionID: SESSION_ID },
				});
			}
			check(group, 'explicit reload restores the active round without duplicate play or checkpoint writes',
				network.byEndpoint.play.length === 1 && network.byEndpoint.event.length === 1,
				serialize(network.order),
			);
			check(group, 'explicit reload performs exactly one new settlement attempt',
				network.byEndpoint.endRound.length === 2,
				serialize(network.order),
			);
			check(group, 'settlement recovery order is authoritative and exact',
				serialize(network.order) === serialize(['authenticate', 'play', 'event', 'endRound', 'authenticate', 'endRound']),
				serialize(network.order),
			);
			check(group, 'recovered settlement adopts the exact authoritative balance and remains stable',
				(await page.locator(SELECTORS.walletBalance).innerText()).trim() === '$999.00' &&
					(await page.locator(SELECTORS.finalWin).innerText()).trim() === '$0.00' &&
					network.byEndpoint.endRound.length === 2,
				serialize({
					balance: await page.locator(SELECTORS.walletBalance).innerText(),
					win: await page.locator(SELECTORS.finalWin).innerText(),
					order: network.order,
				}),
			);
			assertCleanNetwork(group, network);
			assertOnlyExpectedHttpDiagnostic(group, diagnostics, 503);
			record.screenshot = await saveScreenshot(page, group);
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('settlement-session-expiry-reauthenticates-and-settles-once', async (record) => {
		const group = 'settlement-session-expiry-reauthenticates-and-settles-once';
		const restoredBalance = DEFAULT_BALANCE - DEFAULT_BASE_AMOUNT;
		const restoredRound = authoritativeZeroRound({
			active: true,
			id: 'blacksite-qa-expired-settlement-session',
			event: encodePresentationCursor(2),
		});
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: {
					authenticate: (_request, networkEvidence) =>
						networkEvidence.byEndpoint.authenticate.length === 1
							? authenticateResponse()
							: authenticateResponse({
									balance: restoredBalance,
									round: restoredRound,
								}),
					play: () => playResponse({ active: true }),
					event: (request) => ({ event: request.body.event }),
					endRound: (_request, networkEvidence) =>
						networkEvidence.byEndpoint.endRound.length === 1
							? {
									status: {
										statusCode: 'ERR_SESSION',
										statusMessage: 'The session expired before the active round was settled.',
									},
								}
							: endRoundResponse({ balance: restoredBalance }),
				},
			});
			const { page, diagnostics } = await openPage(context, origin, liveQuery());
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForStableAction(page);
			await page.locator(SELECTORS.primaryAction).click();
			await waitForEndpoint(network, 'endRound', 1);
			await page.locator(SELECTORS.launchError).waitFor({ state: 'visible', timeout: 10_000 });
			await waitForRuntimeState(page, 'live-error');

			assertExactRequest(group, network.byEndpoint.endRound[0], {
				method: 'POST',
				path: '/wallet/end-round',
				body: { sessionID: SESSION_ID },
			});
			const recovery = page.locator('[data-testid="recovery-action"]');
			check(group, 'expired settlement session remains fail-closed and explicitly recoverable',
				await page.locator(SELECTORS.primaryAction).isDisabled() &&
					await recovery.isVisible() &&
					!(await recovery.isDisabled()),
				serialize({ state: await runtimeState(page), order: network.order }),
			);
			check(group, 'expired settlement preserves the exact authoritative result',
				(await page.locator(SELECTORS.finalWin).innerText()).trim() === '$0.00',
				await page.locator(SELECTORS.finalWin).innerText(),
			);
			await page.waitForTimeout(300);
			check(group, 'expired settlement session never retries authentication or settlement automatically',
				network.byEndpoint.authenticate.length === 1 &&
					network.byEndpoint.endRound.length === 1,
				serialize(network.order),
			);
			record.errorScreenshot = await saveScreenshot(page, 'settlement-session-expiry-error');

			await recovery.click();
			await waitForEndpoint(network, 'authenticate', 2);
			await waitForEndpoint(network, 'endRound', 2);
			await waitForRuntimeState(page, 'live-ready');
			await page.waitForTimeout(300);

			for (const request of network.byEndpoint.authenticate) {
				assertExactRequest(group, request, {
					method: 'POST',
					path: '/wallet/authenticate',
					body: { sessionID: SESSION_ID, language: 'en' },
				});
			}
			for (const request of network.byEndpoint.endRound) {
				assertExactRequest(group, request, {
					method: 'POST',
					path: '/wallet/end-round',
					body: { sessionID: SESSION_ID },
				});
			}
			check(group, 'explicit settlement recovery reauthenticates once without duplicate play or checkpoint writes',
				network.byEndpoint.authenticate.length === 2 &&
					network.byEndpoint.play.length === 1 &&
					network.byEndpoint.event.length === 1,
				serialize(network.order),
			);
			check(group, 'reauthenticated settlement performs exactly one new completion attempt',
				network.byEndpoint.endRound.length === 2,
				serialize(network.order),
			);
			check(group, 'expired settlement recovery order is authoritative and exact',
				serialize(network.order) === serialize(['authenticate', 'play', 'event', 'endRound', 'authenticate', 'endRound']),
				serialize(network.order),
			);
			check(group, 'reauthenticated settlement adopts the exact authoritative balance and remains stable',
				(await page.locator(SELECTORS.walletBalance).innerText()).trim() === '$999.00' &&
					(await page.locator(SELECTORS.finalWin).innerText()).trim() === '$0.00' &&
					await runtimeState(page) === 'live-ready',
				serialize({
					balance: await page.locator(SELECTORS.walletBalance).innerText(),
					win: await page.locator(SELECTORS.finalWin).innerText(),
					state: await runtimeState(page),
					order: network.order,
				}),
			);
			assertCleanNetwork(group, network);
			assertCleanDiagnostics(group, diagnostics);
			record.screenshot = await saveScreenshot(page, group);
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('active-restore-no-duplicate-play', async (record) => {
		const group = 'active-restore-no-duplicate-play';
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: {
					authenticate: () =>
						authenticateResponse({
							round: authoritativeZeroRound({
								active: true,
								id: 'blacksite-qa-active-restore',
								amount: 500_000,
								mode: 'deep_access',
								event: encodePresentationCursor(4),
								}),
								jurisdictionOverrides: { disabledBuyFeature: true },
						}),
					event: (request) => ({ event: request.body.event }),
					endRound: () => endRoundResponse(),
				},
			});
			const { page, diagnostics } = await openPage(context, origin, liveQuery());
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForEndpoint(network, 'endRound', 1);
			await waitForRuntimeState(page, 'live-ready');
			await page.waitForTimeout(200);
			const restoredBoard = await boardSymbols(page);
			check(group, 'disabled Buy Feature does not block presentation of an already-active feature round', restoredBoard.length === 49 && restoredBoard.some((symbol) => symbol !== ''), serialize(restoredBoard));
			check(group, 'restored feature round exposes its exact result only after completion', (await page.locator(SELECTORS.finalWin).innerText()).trim() === '$0.00', await page.locator(SELECTORS.finalWin).innerText());
			check(group, 'restore sends zero play requests', network.byEndpoint.play.length === 0, serialize(network.order));
			check(group, 'restore does not rewrite already-persisted checkpoints', network.byEndpoint.event.length === 0, serialize(network.order));
			check(group, 'restore settles exactly once', network.byEndpoint.endRound.length === 1, serialize(network.order));
			check(group, 'restore order is authenticate then end-round', serialize(network.order) === serialize(['authenticate', 'endRound']), serialize(network.order));
			check(group, 'restored non-default Base amount remains selected after settlement', await page.locator(SELECTORS.baseAmount).inputValue() === '500000', await page.locator(SELECTORS.baseAmount).inputValue());
			check(group, 'restored DEEP ACCESS identity remains visible in the readout after settlement', /DEEP ACCESS/i.test(await page.locator('.mode-readout').innerText()), await page.locator('.mode-readout').innerText());
			check(group, 'restored mode and Base amount produce exact complete play display', (await page.locator(SELECTORS.totalPlay).innerText()).trim() === '$2.00', await page.locator(SELECTORS.totalPlay).innerText());
			check(group, 'feature modes are hidden for new actions after restored settlement', await page.locator(SELECTORS.modeDeepAccess).count() === 0 && await page.locator(SELECTORS.modeBlackout).count() === 0, serialize({ deepAccessCount: await page.locator(SELECTORS.modeDeepAccess).count(), blackoutCount: await page.locator(SELECTORS.modeBlackout).count() }));
			check(group, 'restored blocked feature selection cannot start a new play', await page.locator(SELECTORS.primaryAction).isDisabled(), await page.locator(SELECTORS.primaryAction).innerText());
			check(group, 'Base mode remains legal after restored feature settlement', !(await page.locator(SELECTORS.modeBase).isDisabled()), await page.locator(SELECTORS.modeBase).innerText());
			await page.locator(SELECTORS.modeBase).click();
			await waitForStableAction(page);
			check(group, 'switching to Base restores a legal ready action without sending play', await page.locator(SELECTORS.modeBase).getAttribute('aria-pressed') === 'true' && network.byEndpoint.play.length === 0, serialize({ basePressed: await page.locator(SELECTORS.modeBase).getAttribute('aria-pressed'), order: network.order }));
			check(group, 'Base keeps the restored amount and exact legal complete-play display', await page.locator(SELECTORS.baseAmount).inputValue() === '500000' && (await page.locator(SELECTORS.totalPlay).innerText()).trim() === '$0.50', serialize({ baseAmount: await page.locator(SELECTORS.baseAmount).inputValue(), totalPlay: await page.locator(SELECTORS.totalPlay).innerText() }));
			assertCleanNetwork(group, network);
			assertCleanDiagnostics(group, diagnostics);
			record.screenshot = await saveScreenshot(page, 'active-restore-no-duplicate-play');
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('known-insufficient-balance-blocks-play', async (record) => {
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: {
					authenticate: () => authenticateResponse({ balance: 50_000 }),
				},
			});
			const { page, diagnostics } = await openPage(context, origin, liveQuery());
			await waitForEndpoint(network, 'authenticate', 1);
			await page.locator(SELECTORS.primaryAction).waitFor({ state: 'visible' });
			const action = page.locator(SELECTORS.primaryAction);
			const disabled = await action.isDisabled();
			if (!disabled) {
				await action.click();
				await page.waitForTimeout(300);
			}
			const state = await runtimeState(page);
			const visibleText = await page.locator('body').innerText();
			check('known-insufficient-balance-blocks-play', 'known insufficient balance sends zero play requests', network.byEndpoint.play.length === 0, serialize(network.order));
			check('known-insufficient-balance-blocks-play', 'insufficient guard is disabled or visibly reported', disabled || /insufficient/i.test(`${state ?? ''} ${visibleText}`), serialize({ disabled, state }));
			assertCleanNetwork('known-insufficient-balance-blocks-play', network);
			record.screenshot = await saveScreenshot(page, 'known-insufficient-balance');
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	const ruleWinCases = ['base', 'deep_access', 'blackout'].flatMap((modeId) =>
		Array.from({ length: 5 }, (_, index) => {
			const ordinal = String(index + 1).padStart(2, '0');
			return {
				caseId: `rules-${modeId}-${ordinal}`,
				fixture: getGeneratedFixture(`${modeId}_win_${ordinal}`),
				amountUnitsRaw: String(DEFAULT_BASE_AMOUNT),
				expectedClass: 'rules-win',
				ruleAudit: true,
			};
		}),
	);

	const replayMatrixCases = [
		{
			caseId: 'base-zero',
			fixture: BASE_ZERO_FIXTURE,
			amountUnitsRaw: String(DEFAULT_BASE_AMOUNT),
			expectedClass: 'zero',
		},
		{
			caseId: 'base-win',
			fixture: getGeneratedFixture('base_small'),
			amountUnitsRaw: String(DEFAULT_BASE_AMOUNT),
			expectedClass: 'win',
		},
		{
			caseId: 'feature-mode-win',
			fixture: getGeneratedFixture('deep_access_small'),
			amountUnitsRaw: String(DEFAULT_BASE_AMOUNT),
			expectedClass: 'feature-mode-win',
		},
		{
			caseId: 'max-win',
			fixture: getGeneratedFixture('base_max_win'),
			amountUnitsRaw: String(DEFAULT_BASE_AMOUNT),
			expectedClass: 'max-win',
		},
		{
			caseId: 'fractional-query-amount',
			fixture: getGeneratedFixture('blackout_small'),
			amountUnitsRaw: '0.0496',
			expectedClass: 'fractional',
		},
		...ruleWinCases,
	];

	for (const matrixCase of replayMatrixCases) {
		await runScenario(`replay-matrix-${matrixCase.caseId}`, async (record) => {
			const group = `replay-matrix-${matrixCase.caseId}`;
			const { fixture, amountUnitsRaw, expectedClass, ruleAudit = false } = matrixCase;
			const currency = 'USD';
			const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
			try {
				const payload = replayResponseFromFixture(fixture);
				const event = String(fixture.bookId);
				const network = await installMockRgs(context, {
					pageOrigin: origin,
					replayOnly: true,
					handlers: { replay: () => payload },
				});
				const { page, diagnostics } = await openPage(
					context,
					origin,
					replayQuery({
						mode: fixture.mode,
						event,
						amount: amountUnitsRaw,
						currency,
					}),
				);
				await waitForEndpoint(network, 'replay', 1);
				await waitForStableAction(page);
				const request = network.byEndpoint.replay[0];
				const expectedPath = `/bet/replay/blacksite_breach/${REPLAY_VERSION}/${fixture.mode}/${event}`;
				check(group, 'fixture is math-backed', fixture.mathBacked === true, serialize({ fixtureId: fixture.id, mathBacked: fixture.mathBacked }));
				check(group, 'Replay payload converts exact book centi-x to multiplier-x', payload.payoutMultiplier === fixture.book.payoutMultiplier / 100, serialize({ responseMultiplierX: payload.payoutMultiplier, bookPayoutCentiX: fixture.book.payoutMultiplier }));
				check(group, 'Replay payload uses canonical mode cost', payload.costMultiplier === MODE_COSTS[fixture.mode], serialize({ actual: payload.costMultiplier, expected: MODE_COSTS[fixture.mode] }));
				check(group, 'Replay matrix uses GET', request.method === 'GET', serialize(request));
				check(group, 'Replay matrix path is exact', request.path === expectedPath, serialize({ actual: request.path, expected: expectedPath }));
				check(group, 'Replay matrix GET is queryless', Object.keys(request.search).length === 0, serialize(request.search));
				check(group, 'Replay matrix GET has no body', request.body === null, serialize(request.body));
				const expectedTotalPlay = expectedReplayTotalPlay(amountUnitsRaw, MODE_COSTS[fixture.mode], currency);
				const expectedFinalWin = expectedReplayFinalWin(amountUnitsRaw, fixture.book.payoutMultiplier, currency);
				const expectedResultMultiplier = expectedCentiMultiplierText(fixture.book.payoutMultiplier);
				const readyPresentation = await replayPresentationSnapshot(page);
				check(group, 'Replay ready state keeps FINAL WIN hidden', readyPresentation.runtimeState === 'replay-ready' && readyPresentation.finalWin === '—', serialize(readyPresentation));
				check(group, 'Replay TOTAL PLAY is exact query amount times canonical cost', readyPresentation.totalPlay === expectedTotalPlay, serialize({ actual: readyPresentation.totalPlay, expected: expectedTotalPlay, amountUnitsRaw, costMultiplier: MODE_COSTS[fixture.mode] }));
				check(group, 'Replay ready card shows canonical cost while keeping result multiplier hidden', readyPresentation.replayCard.includes(`${MODE_COSTS[fixture.mode]}× play factor`) && readyPresentation.replayCard.includes('— result') && !readyPresentation.replayCard.includes(`${expectedResultMultiplier} result`), serialize({ replayCard: readyPresentation.replayCard, expectedResultMultiplier, expectedCostMultiplier: MODE_COSTS[fixture.mode] }));

				if (ruleAudit) {
					await page.locator(SELECTORS.motionMode).click();
					check(
						group,
						'five-win audit uses bounded TURBO presentation',
						(await page.locator(SELECTORS.motionMode).innerText()).includes('TURBO'),
						await page.locator(SELECTORS.motionMode).innerText(),
					);
				}
				await page.locator(SELECTORS.primaryAction).click();
				await waitForReplayComplete(page, ruleAudit ? 60_000 : 20_000);
				const firstPresentation = await replayPresentationSnapshot(page);
				check(group, 'Replay completes rather than remaining loading/playing', firstPresentation.runtimeState === 'replay-completed', serialize(firstPresentation.runtimeState));
				check(group, 'Replay FINAL WIN is exact query amount times authoritative package payout', firstPresentation.finalWin === expectedFinalWin, serialize({ actual: firstPresentation.finalWin, expected: expectedFinalWin, amountUnitsRaw, packagePayoutCentiX: fixture.book.payoutMultiplier }));
				check(group, 'Replay TOTAL PLAY remains exact query amount times canonical cost', firstPresentation.totalPlay === expectedTotalPlay, serialize({ actual: firstPresentation.totalPlay, expected: expectedTotalPlay }));
				check(group, 'completed Replay card shows canonical cost factor and authoritative result multiplier', firstPresentation.replayCard.includes(`${MODE_COSTS[fixture.mode]}× play factor`) && firstPresentation.replayCard.includes(`${expectedResultMultiplier} result`), serialize({ replayCard: firstPresentation.replayCard, expectedResultMultiplier, expectedCostMultiplier: MODE_COSTS[fixture.mode] }));
				check(group, 'Replay presents all 49 authoritative board cells', firstPresentation.board.length === 49, String(firstPresentation.board.length));
				if (expectedClass === 'zero') {
					check(group, 'zero/loss case has exact zero book result', fixture.book.payoutMultiplier === 0, String(fixture.book.payoutMultiplier));
				} else {
					check(group, `${expectedClass} case has a positive book result`, fixture.book.payoutMultiplier > 0, String(fixture.book.payoutMultiplier));
				}
				if (expectedClass === 'feature-mode-win') {
					check(group, 'feature-mode case is a non-base canonical mode', fixture.mode !== 'base' && MODE_COSTS[fixture.mode] > 1, serialize({ mode: fixture.mode, cost: MODE_COSTS[fixture.mode] }));
				}
				if (expectedClass === 'max-win') {
					check(group, 'max-win case applies the exact 10,000x package cap to opaque query units', fixture.book.payoutMultiplier === 1_000_000 && firstPresentation.finalWin === expectedReplayFinalWin(amountUnitsRaw, 1_000_000, currency), serialize(firstPresentation));
				}
				if (expectedClass === 'fractional') {
					check(group, 'fractional BLACKOUT arithmetic remains exact and lossless', fixture.mode === 'blackout' && fixture.book.payoutMultiplier === 1423 && firstPresentation.totalPlay === '$3.968 units' && firstPresentation.finalWin === '$0.705808 units', serialize({ fixture: fixture.id, mode: fixture.mode, payoutCentiX: fixture.book.payoutMultiplier, firstPresentation }));
				}

				let ruleWinAudit = null;
				if (ruleAudit) {
					const winEvents = fixture.book.events.filter(
						(eventValue) => eventValue.type === 'cluster_win',
					);
					const clusters = winEvents.flatMap((eventValue) =>
						eventValue.clusters.map((cluster) => ({
							eventIndex: eventValue.index,
							phase: eventValue.phase,
							...cluster,
						})),
					);
					const clustersMatchRules = clusters.every((cluster) => {
						const bandIndex = CLUSTER_BANDS.findIndex((band) => band.id === cluster.cluster_band);
						const uniquePositions = new Set(
							cluster.positions.map(({ column, row }) => `${column}:${row}`),
						);
						return (
							bandIndex >= 0 &&
							SYMBOL_PAYOUTS[cluster.symbol]?.[bandIndex] === cluster.base_payout_raw &&
							cluster.positions.length === cluster.cluster_size &&
							uniquePositions.size === cluster.cluster_size &&
							cluster.positions.every(
								({ column, row }) =>
									column >= 0 &&
									column < RULES_CONTRACT.board.columns &&
									row >= 0 &&
									row < RULES_CONTRACT.board.rows,
							) &&
							cluster.calculated_award_raw === cluster.base_payout_raw * cluster.access_multiplier
						);
					});
					const stepsMatchAwards = winEvents.every(
						(eventValue) =>
							eventValue.step_payout_raw ===
							eventValue.clusters.reduce((total, cluster) => total + cluster.applied_award_raw, 0),
					);
					check(
						group,
						'five-win case contains at least one authoritative cluster award',
						clusters.length > 0,
						serialize({
							fixture: fixture.id,
							winEvents: winEvents.length,
							clusters: clusters.length,
						}),
					);
					check(
						group,
						'every cluster position, symbol, paytable band and multiplier matches Game Rules',
						clustersMatchRules,
						serialize(clusters),
					);
					check(
						group,
						'every cascade step equals its authoritative applied awards',
						stepsMatchAwards,
						serialize(winEvents),
					);
					ruleWinAudit = {
						winEvents: winEvents.length,
						clusters: clusters.length,
						clustersMatchRules,
						stepsMatchAwards,
					};
				}

				let secondPresentation = null;
				if (!ruleAudit) {
					await page.locator(SELECTORS.primaryAction).click();
					await page.waitForTimeout(50);
					await waitForReplayComplete(page);
					secondPresentation = await replayPresentationSnapshot(page);
					check(group, 'Play Again reproduces the exact result and board presentation', serialize(secondPresentation) === serialize(firstPresentation), serialize({ firstPresentation, secondPresentation }));
					check(group, 'Play Again does not refetch Replay', network.byEndpoint.replay.length === 1, serialize(network.order));
				}
				check(group, 'Replay matrix sends zero wallet/event writes', walletWriteCount(network) === 0, serialize(network.order));
				assertCleanNetwork(group, network);
				assertCleanDiagnostics(group, diagnostics);
				record.fixture = {
					id: fixture.id,
					mode: fixture.mode,
					bookId: fixture.bookId,
					bookPayoutCentiX: fixture.book.payoutMultiplier,
					responsePayoutMultiplierX: payload.payoutMultiplier,
					costMultiplier: payload.costMultiplier,
					amountUnitsRaw,
					currency,
					expectedTotalPlay,
					expectedFinalWin,
				};
				record.readyPresentation = readyPresentation;
				record.firstPresentation = firstPresentation;
				record.secondPresentation = secondPresentation;
				record.ruleWinAudit = ruleWinAudit;
				record.screenshot = await saveScreenshot(page, group);
				record.network = network;
				record.diagnostics = diagnostics;
			} finally {
				await context.close();
			}
		});
	}

	const socialReplayOutcomeCases = [
		{ caseId: 'loss', fixture: BASE_ZERO_FIXTURE, expectedClass: 'loss' },
		{ caseId: 'win', fixture: getGeneratedFixture('base_small'), expectedClass: 'win' },
		{ caseId: 'feature', fixture: getGeneratedFixture('deep_access_small'), expectedClass: 'feature' },
		{ caseId: 'max-win', fixture: getGeneratedFixture('base_max_win'), expectedClass: 'max-win' },
	];

	for (const outcomeCase of socialReplayOutcomeCases) {
		await runScenario(`social-replay-outcome-${outcomeCase.caseId}`, async (record) => {
			const group = `social-replay-outcome-${outcomeCase.caseId}`;
			const { fixture, expectedClass } = outcomeCase;
			const amountUnitsRaw = '0.0496';
			const currency = 'XSC';
			const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
			try {
				const payload = replayResponseFromFixture(fixture);
				const event = String(fixture.bookId);
				const network = await installMockRgs(context, {
					pageOrigin: origin,
					replayOnly: true,
					handlers: { replay: () => payload },
				});
				const { page, diagnostics } = await openPage(
					context,
					origin,
					replayQuery({ mode: fixture.mode, event, amount: amountUnitsRaw, currency, lang: 'de', social: 'true', device: 'mobile' }),
				);
				await waitForEndpoint(network, 'replay', 1);
				await waitForStableAction(page);
				const request = network.byEndpoint.replay[0];
				const expectedPath = `/bet/replay/blacksite_breach/${REPLAY_VERSION}/${fixture.mode}/${event}`;
				const expectedTotalPlay = expectedReplayTotalPlay(amountUnitsRaw, MODE_COSTS[fixture.mode], currency);
				const expectedFinalWin = expectedReplayFinalWin(amountUnitsRaw, fixture.book.payoutMultiplier, currency);
				const readyPresentation = await replayPresentationSnapshot(page);
				const readySurface = await collectPlayerVisibleSurface(page);
				check(group, 'Social Replay outcome fixture is math-backed', fixture.mathBacked === true, serialize({ fixtureId: fixture.id, mathBacked: fixture.mathBacked }));
				check(group, 'Social Replay outcome GET path is exact', request.method === 'GET' && request.path === expectedPath, serialize(request));
				check(group, 'Social Replay outcome GET remains queryless and bodyless', Object.keys(request.search).length === 0 && request.body === null, serialize(request));
				check(group, 'Social Replay outcome ready state hides FINAL WIN', readyPresentation.runtimeState === 'replay-ready' && readyPresentation.finalWin === '—', serialize(readyPresentation));
				check(group, 'Social Replay outcome ready state shows exact SC cost', readyPresentation.totalPlay === expectedTotalPlay && readyPresentation.totalPlay.endsWith(' SC units'), serialize({ actual: readyPresentation.totalPlay, expected: expectedTotalPlay }));
				check(group, 'Social Replay outcome ready surface has zero restricted hits', playerVisibleRestrictedHits(readySurface.combined).length === 0, serialize(readySurface));
				check(group, 'Social Replay outcome ready surface has no dollar-prefixed display', !readySurface.combined.includes('$'), readySurface.combined);

				await page.locator(SELECTORS.primaryAction).click();
				await waitForReplayComplete(page);
				const completedPresentation = await replayPresentationSnapshot(page);
				const completedSurface = await collectPlayerVisibleSurface(page);
				check(group, 'Social Replay outcome completes with exact authoritative result', completedPresentation.runtimeState === 'replay-completed' && completedPresentation.finalWin === expectedFinalWin, serialize({ actual: completedPresentation, expectedFinalWin }));
				check(group, 'Social Replay outcome retains exact SC cost', completedPresentation.totalPlay === expectedTotalPlay, serialize({ actual: completedPresentation.totalPlay, expected: expectedTotalPlay }));
				check(group, 'Social Replay outcome presents all 49 authoritative board cells', completedPresentation.board.length === 49, String(completedPresentation.board.length));
				check(group, 'Social Replay outcome class matches its authoritative fixture', expectedClass === 'loss' ? fixture.book.payoutMultiplier === 0 : fixture.book.payoutMultiplier > 0, serialize({ expectedClass, payoutCentiX: fixture.book.payoutMultiplier }));
				if (expectedClass === 'feature') {
					const eventTypes = fixture.book.events.map((eventValue) => eventValue.type);
					check(group, 'Social Replay feature case uses a complete canonical feature lifecycle', fixture.mode === 'deep_access' && MODE_COSTS[fixture.mode] === 4 && eventTypes.includes('feature_start') && eventTypes.includes('feature_end'), serialize({ mode: fixture.mode, cost: MODE_COSTS[fixture.mode], eventTypes }));
				}
				if (expectedClass === 'max-win') {
					check(group, 'Social Replay max-win case preserves the exact 10,000x package cap', fixture.book.payoutMultiplier === 1_000_000, String(fixture.book.payoutMultiplier));
				}
				check(group, 'Social Replay outcome completed surface has zero restricted hits', playerVisibleRestrictedHits(completedSurface.combined).length === 0, serialize(completedSurface));
				check(group, 'Social Replay outcome completed surface has no dollar-prefixed display', !completedSurface.combined.includes('$'), completedSurface.combined);
				check(group, 'Social Replay outcome sends zero wallet/event writes', walletWriteCount(network) === 0, serialize(network.order));
				check(group, 'Social Replay outcome fetches exactly once', network.byEndpoint.replay.length === 1, serialize(network.order));
				assertCleanNetwork(group, network);
				assertCleanDiagnostics(group, diagnostics);
				record.fixture = { id: fixture.id, mode: fixture.mode, bookId: fixture.bookId, bookPayoutCentiX: fixture.book.payoutMultiplier, expectedClass, expectedTotalPlay, expectedFinalWin };
				record.readySurface = readySurface;
				record.completedSurface = completedSurface;
				record.completedPresentation = completedPresentation;
				record.screenshot = await saveScreenshot(page, group);
				record.network = network;
				record.diagnostics = diagnostics;
			} finally {
				await context.close();
			}
		});
	}

	await runScenario('social-replay-dom-aria-restricted-scan', async (record) => {
		const group = 'social-replay-dom-aria-restricted-scan';
		const fixture = getGeneratedFixture('blackout_small');
		const payload = replayResponseFromFixture(fixture);
		const amountUnitsRaw = '0.0496';
		const currency = 'XSC';
		const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				replayOnly: true,
				handlers: { replay: () => payload },
			});
			const event = 'bet-stake-wager';
			const { page, diagnostics } = await openPage(
				context,
				origin,
				replayQuery({
					mode: fixture.mode,
					event,
					amount: amountUnitsRaw,
					currency,
					lang: 'de',
					social: 'true',
					device: 'mobile',
				}),
			);
			await waitForEndpoint(network, 'replay', 1);
			await waitForStableAction(page);
			const request = network.byEndpoint.replay[0];
			check(group, 'Social Replay GET path is exact', request.path === `/bet/replay/blacksite_breach/${REPLAY_VERSION}/${fixture.mode}/${event}`, request.path);
			check(group, 'Social Replay GET remains queryless', Object.keys(request.search).length === 0, serialize(request.search));
			const expectedTotalPlay = expectedReplayTotalPlay(amountUnitsRaw, MODE_COSTS[fixture.mode], currency);
			const expectedFinalWin = expectedReplayFinalWin(amountUnitsRaw, fixture.book.payoutMultiplier, currency);
			const expectedResultMultiplier = expectedCentiMultiplierText(fixture.book.payoutMultiplier);
			const socialReady = await replayPresentationSnapshot(page);
			check(group, 'Social Replay ready state keeps FINAL WIN hidden', socialReady.finalWin === '—' && socialReady.runtimeState === 'replay-ready', serialize(socialReady));
			check(group, 'Social Replay decorates exact query amount × cost with SC units', expectedTotalPlay === '3.968 SC units' && socialReady.totalPlay === expectedTotalPlay, serialize({ expectedTotalPlay, socialReady }));
			check(group, 'Social Replay ready card shows 80× BLACKOUT cost without leaking result', socialReady.replayCard.includes('80× play factor') && socialReady.replayCard.includes('— result') && !socialReady.replayCard.includes(`${expectedResultMultiplier} result`), socialReady.replayCard);
			await page.locator(SELECTORS.primaryAction).click();
			await waitForReplayComplete(page);
			const socialCompleted = await replayPresentationSnapshot(page);
			check(group, 'Social Replay decorates exact query amount × payout with SC units', expectedFinalWin === '0.705808 SC units' && socialCompleted.finalWin === expectedFinalWin, serialize({ expectedFinalWin, socialCompleted }));
			check(group, 'Social Replay preserves exact decorated TOTAL PLAY after completion', socialCompleted.totalPlay === expectedTotalPlay, serialize(socialCompleted));
			check(group, 'completed Social Replay card shows exact cost and result multipliers', socialCompleted.replayCard.includes('80× play factor') && socialCompleted.replayCard.includes(`${expectedResultMultiplier} result`), socialCompleted.replayCard);
			check(group, 'Social Replay uses Social Base mode label', /STANDARD RUN/i.test(await page.locator(SELECTORS.modeBase).innerText()), await page.locator(SELECTORS.modeBase).innerText());
			check(group, 'Social Replay uses Social BLACKOUT mode label', /BLACKOUT ENTRY/i.test(await page.locator(SELECTORS.modeBlackout).innerText()), await page.locator(SELECTORS.modeBlackout).innerText());
			await page.getByRole('button', { name: /INFO \/ RULES/i }).click();
			await page.getByRole('dialog', { name: /BLACKSITE/i }).waitFor({ state: 'visible' });
			const surface = await collectPlayerVisibleSurface(page);
			const restrictedHits = playerVisibleRestrictedHits(surface.combined);
			check(group, 'Social Replay visible DOM and ARIA surface has zero official restricted hits', restrictedHits.length === 0, serialize({ hits: restrictedHits, attributes: surface.attributes }));
			check(group, 'Social Replay surface contains no dollar-prefixed social display', !surface.combined.includes('$'), surface.combined);
			check(group, 'Social Replay sends zero wallet/event writes', walletWriteCount(network) === 0, serialize(network.order));
			check(group, 'Social Replay fetches exactly once', network.byEndpoint.replay.length === 1, serialize(network.order));
			assertCleanNetwork(group, network);
			assertCleanDiagnostics(group, diagnostics);
			record.surface = surface;
			record.replayUnits = { amountUnitsRaw, currency, expectedTotalPlay, expectedFinalWin };
			record.screenshot = await saveScreenshot(page, 'social-replay-restricted-scan');
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('replay-read-only-play-again', async (record) => {
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				replayOnly: true,
				handlers: { replay: () => replayResponse() },
			});
			const { page, diagnostics } = await openPage(context, origin, replayQuery());
			await waitForEndpoint(network, 'replay', 1);
			await waitForStableAction(page);
			const replayRequest = network.byEndpoint.replay[0];
			check('replay-read-only-play-again', 'Replay uses GET', replayRequest.method === 'GET', serialize(replayRequest));
			check('replay-read-only-play-again', 'Replay path is exact', replayRequest.path === `/bet/replay/blacksite_breach/${REPLAY_VERSION}/base/1`, replayRequest.path);
			check('replay-read-only-play-again', 'Replay GET has an exact empty query string', Object.keys(replayRequest.search).length === 0, serialize(replayRequest.search));
			check('replay-read-only-play-again', 'Replay has no request body', replayRequest.body === null, serialize(replayRequest.body));
			await page.locator(SELECTORS.primaryAction).click();
			await waitForReplayComplete(page);
			await page.locator(SELECTORS.primaryAction).click();
			await waitForReplayComplete(page);
			await page.waitForTimeout(200);
			const walletWrites =
				network.byEndpoint.authenticate.length +
				network.byEndpoint.play.length +
				network.byEndpoint.endRound.length +
				network.byEndpoint.event.length;
			check('replay-read-only-play-again', 'Replay fetch occurs exactly once', network.byEndpoint.replay.length === 1, serialize(network.order));
			check('replay-read-only-play-again', 'Play Again does not refetch Replay', network.byEndpoint.replay.length === 1, serialize(network.order));
			check('replay-read-only-play-again', 'Replay makes zero wallet/event writes', walletWrites === 0, serialize(network.order));
			check('replay-read-only-play-again', 'Replay request order contains only replay', serialize(network.order) === serialize(['replay']), serialize(network.order));
			assertCleanNetwork('replay-read-only-play-again', network);
			record.screenshot = await saveScreenshot(page, 'replay-play-again');
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	await runScenario('invalid-replay-payload-fails-closed', async (record) => {
		const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				replayOnly: true,
				handlers: { replay: () => invalidReplayResponse() },
			});
			const { page, diagnostics } = await openPage(context, origin, replayQuery({ event: 'invalid' }));
			await waitForEndpoint(network, 'replay', 1);
			await page.locator(SELECTORS.launchError).waitFor({ state: 'visible', timeout: 10_000 });
			const state = await runtimeState(page);
			const errorText = await page.locator(SELECTORS.launchError).innerText();
			const walletWrites =
				network.byEndpoint.authenticate.length +
				network.byEndpoint.play.length +
				network.byEndpoint.endRound.length +
				network.byEndpoint.event.length;
			check('invalid-replay-payload-fails-closed', 'invalid Replay exposes a bounded error', errorText.trim().length > 0, errorText);
			check('invalid-replay-payload-fails-closed', 'invalid Replay runtime is an error state', /error/i.test(state ?? ''), serialize(state));
			check('invalid-replay-payload-fails-closed', 'invalid Replay makes zero wallet/event writes', walletWrites === 0, serialize(network.order));
			assertCleanNetwork('invalid-replay-payload-fails-closed', network);
			record.screenshot = await saveScreenshot(page, 'invalid-replay-payload');
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});
}

async function geometryAudit(page) {
	await waitForAssetPaint(page);
	await page.evaluate(() => document.activeElement?.blur());
	await page.keyboard.press('Tab');
	return page.evaluate((selectors) => {
		const rect = (element) => {
			if (!element) return null;
			const value = element.getBoundingClientRect();
			return {
				left: value.left,
				top: value.top,
				right: value.right,
				bottom: value.bottom,
				width: value.width,
				height: value.height,
			};
		};
		const isVisible = (element) => {
			if (!element) return false;
			const style = getComputedStyle(element);
			const bounds = element.getBoundingClientRect();
			return (
				style.display !== 'none' &&
				style.visibility !== 'hidden' &&
				Number(style.opacity) !== 0 &&
				bounds.width > 0 &&
				bounds.height > 0
			);
		};
		const insideViewport = (bounds) =>
			bounds &&
			bounds.left >= -0.5 &&
			bounds.top >= -0.5 &&
			bounds.right <= innerWidth + 0.5 &&
			bounds.bottom <= innerHeight + 0.5;
		const actionSelectors = [
			selectors.primaryAction,
			selectors.motionMode,
			selectors.skipPresentation,
			selectors.soundAction,
			selectors.modeBase,
			selectors.modeDeepAccess,
			selectors.modeBlackout,
			selectors.baseAmount,
		];
		const actions = actionSelectors.map((selector) => {
			const element = document.querySelector(selector);
			const label = element?.querySelector('span') ?? null;
			const bounds = rect(element);
			const hit = bounds
				? document.elementFromPoint(
						bounds.left + bounds.width / 2,
						bounds.top + bounds.height / 2,
					)
				: null;
			return {
				selector,
				exists: Boolean(element),
				visible: isVisible(element),
				bounds,
				insideViewport: insideViewport(bounds),
				centerHit:
					Boolean(element && hit) &&
					(element === hit || element.contains(hit) || hit.contains(element)),
				labelClipped: Boolean(
					label && (label.scrollWidth > label.clientWidth + 1 || label.scrollHeight > label.clientHeight + 1),
				),
				textAlign: element ? getComputedStyle(element).textAlign : null,
			};
		});
		const board = document.querySelector(selectors.board);
		const playerHud = document.querySelector(selectors.playerHud);
		const launchStatus = document.querySelector(selectors.launchStatus);
		const boardStatus = document.querySelector(selectors.boardStatus);
		const vaultkeeper = document.querySelector('[data-testid="vaultkeeper-presence"]');
		const vaultkeeperImage = vaultkeeper?.querySelector('img') ?? null;
		const environment = document.querySelector('[data-testid="vault-environment"]');
		const environmentImage = environment?.querySelector('img') ?? null;
		const boardBounds = rect(board);
		const cells = board ? [...board.querySelectorAll('[role="gridcell"]')] : [];
		const rows = board ? [...board.querySelectorAll(':scope > [role="row"]')] : [];
		const focusedElement = document.activeElement;
		const focusedStyle = focusedElement ? getComputedStyle(focusedElement) : null;
		const meterCells = [...document.querySelectorAll('.meter-row > div')];
		const visibleText = document.body.innerText.toLowerCase();
		const forbiddenVisibleCopy = [
			'blacksite-book-events-v1',
			'column-major',
			'centi-x uint64',
			'authoritative presentation',
			'mode control',
			'runtime status',
		].filter((fragment) => visibleText.includes(fragment));
		return {
			viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
			interaction: {
				viewportMeta: document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? null,
				htmlTouchAction: getComputedStyle(document.documentElement).touchAction,
				bodyTouchAction: getComputedStyle(document.body).touchAction,
			},
			runtimeState:
				document.documentElement.dataset.runtimeState ?? document.body.dataset.runtimeState ?? null,
			scroll: {
				documentWidth: document.documentElement.scrollWidth,
				documentHeight: document.documentElement.scrollHeight,
				bodyWidth: document.body.scrollWidth,
				bodyHeight: document.body.scrollHeight,
				hasHorizontal:
					document.documentElement.scrollWidth > innerWidth + 1 ||
					document.body.scrollWidth > innerWidth + 1,
				hasVertical:
					document.documentElement.scrollHeight > innerHeight + 1 ||
					document.body.scrollHeight > innerHeight + 1,
			},
			board: {
				exists: Boolean(board),
				visible: isVisible(board),
				bounds: boardBounds,
				insideViewport: insideViewport(boardBounds),
				role: board?.getAttribute('role') ?? null,
				label: board?.getAttribute('aria-label') ?? null,
				rowCount: board?.getAttribute('aria-rowcount') ?? null,
				columnCount: board?.getAttribute('aria-colcount') ?? null,
				rows: rows.map((row, rowIndex) => ({
					role: row.getAttribute('role'),
					rowIndex: row.getAttribute('aria-rowindex'),
					cells: [...row.querySelectorAll(':scope > [role="gridcell"]')].map(
						(cell, columnIndex) => ({
							rowIndex: cell.getAttribute('aria-rowindex'),
							columnIndex: cell.getAttribute('aria-colindex'),
							label: cell.getAttribute('aria-label'),
							expectedRowIndex: String(rowIndex + 1),
							expectedColumnIndex: String(columnIndex + 1),
						}),
					),
				})),
				cellCount: cells.length,
				visibleCellCount: cells.filter(isVisible).length,
			},
			playerHud: {
				visible: isVisible(playerHud),
				launchStatusVisible: isVisible(launchStatus),
				boardStatusVisible: isVisible(boardStatus),
				forbiddenVisibleCopy,
			},
			vaultkeeper: {
				exists: Boolean(vaultkeeper),
				visible: isVisible(vaultkeeper),
				bounds: rect(vaultkeeper),
				imageVisible: isVisible(vaultkeeperImage),
				imageBounds: rect(vaultkeeperImage),
				imageComplete: Boolean(vaultkeeperImage?.complete),
				naturalWidth: vaultkeeperImage?.naturalWidth ?? 0,
				paintState: vaultkeeper?.getAttribute('data-asset-paint-state') ?? null,
			},
			environment: {
				exists: Boolean(environment),
				visible: isVisible(environment),
				bounds: rect(environment),
				imageVisible: isVisible(environmentImage),
				imageComplete: Boolean(environmentImage?.complete),
				naturalWidth: environmentImage?.naturalWidth ?? 0,
				currentSrc: environmentImage?.currentSrc ?? '',
				paintState: environment?.getAttribute('data-asset-paint-state') ?? null,
				pointerEvents: environment ? getComputedStyle(environment).pointerEvents : null,
			},
			alignment: {
				baseAmountCentered: getComputedStyle(document.querySelector(selectors.baseAmount)).textAlign === 'center',
				metersCentered: meterCells.length === 3 && meterCells.every((element) => getComputedStyle(element).textAlign === 'center'),
				modeLabelsUnclipped: actions.filter(({ selector }) => selector.startsWith('[data-testid="mode-')).every(({ labelClipped }) => !labelClipped),
			},
			semantics: {
				modeGroup: {
					role: document.querySelector('.mode-list')?.getAttribute('role') ?? null,
					labelledBy: document.querySelector('.mode-list')?.getAttribute('aria-labelledby') ?? null,
					label: document.getElementById('access-level-title')?.textContent?.trim() ?? null,
				},
				motionGroup: {
					role: document.querySelector('.motion-controls')?.getAttribute('role') ?? null,
					label: document.querySelector('.motion-controls')?.getAttribute('aria-label') ?? null,
				},
				launchStatus: {
					role: launchStatus?.getAttribute('role') ?? null,
					live: launchStatus?.getAttribute('aria-live') ?? null,
					atomic: launchStatus?.getAttribute('aria-atomic') ?? null,
				},
				boardStatus: {
					role: boardStatus?.getAttribute('role') ?? null,
					live: boardStatus?.getAttribute('aria-live') ?? null,
					atomic: boardStatus?.getAttribute('aria-atomic') ?? null,
				},
			},
			keyboardFocus: {
				testId: focusedElement?.getAttribute?.('data-testid') ?? null,
				outlineWidth: Number.parseFloat(focusedStyle?.outlineWidth ?? '0'),
				outlineOffset: Number.parseFloat(focusedStyle?.outlineOffset ?? '0'),
				outlineStyle: focusedStyle?.outlineStyle ?? null,
				outlineColor: focusedStyle?.outlineColor ?? null,
				borderColor: focusedStyle?.borderTopColor ?? null,
			},
			actions,
		};
	}, SELECTORS);
}

function assertGeometryRecord(group, audit, viewport) {
	check(group, 'browser viewport meta binds device width', /(?:^|,)\s*width=device-width(?:\s*,|$)/iu.test(audit.interaction.viewportMeta ?? ''), serialize(audit.interaction));
	check(group, 'browser viewport meta preserves user zoom', !/maximum-scale\s*=/iu.test(audit.interaction.viewportMeta ?? '') && !/user-scalable\s*=\s*(?:no|0)/iu.test(audit.interaction.viewportMeta ?? ''), serialize(audit.interaction));
	check(group, 'browser computed body touch-action is manipulation', audit.interaction.bodyTouchAction === 'manipulation', serialize(audit.interaction));
	check(group, 'document has no horizontal scroll', !audit.scroll.hasHorizontal, serialize(audit.scroll));
	check(group, 'document has no vertical scroll', !audit.scroll.hasVertical, serialize(audit.scroll));
	check(group, '7x7 board exists and is visible', audit.board.exists && audit.board.visible, serialize(audit.board));
	check(group, 'board is fully inside viewport', audit.board.insideViewport, serialize(audit.board.bounds));
	check(group, 'board contains 49 visible cells', audit.board.cellCount === 49 && audit.board.visibleCellCount === 49, serialize(audit.board));
	check(
		group,
		'board exposes one named 7x7 ARIA grid with explicit row ownership and positions',
		audit.board.role === 'grid' &&
			audit.board.label === 'Vault symbol grid' &&
			audit.board.rowCount === '7' &&
			audit.board.columnCount === '7' &&
			audit.board.rows.length === 7 &&
			audit.board.rows.every(
				(row, rowIndex) =>
					row.role === 'row' &&
					row.rowIndex === String(rowIndex + 1) &&
					row.cells.length === 7 &&
					row.cells.every(
						(cell) =>
							cell.rowIndex === cell.expectedRowIndex &&
							cell.columnIndex === cell.expectedColumnIndex &&
							cell.label?.includes(
								`Column ${cell.expectedColumnIndex}, row ${cell.expectedRowIndex}`,
							),
					),
			),
		serialize(audit.board.rows),
	);
	check(group, 'player HUD and vault connection status are visible', audit.playerHud.visible && audit.playerHud.launchStatusVisible, serialize(audit.playerHud));
	check(group, 'player HUD exposes no internal schema or greybox diagnostics', audit.playerHud.forbiddenVisibleCopy.length === 0, serialize(audit.playerHud));
	const expectsVaultkeeper = viewport.width > 820 && viewport.height > 560;
	check(
		group,
		`vaultkeeper fallback is ${expectsVaultkeeper ? 'visible' : 'compact-hidden'} and loaded`,
		audit.vaultkeeper.exists &&
			audit.vaultkeeper.visible === expectsVaultkeeper &&
			audit.vaultkeeper.imageVisible === expectsVaultkeeper &&
			(!expectsVaultkeeper ||
				Boolean(
					audit.vaultkeeper.imageBounds?.width > 0 &&
						audit.vaultkeeper.imageBounds?.height > 0,
				)) &&
			audit.vaultkeeper.imageComplete &&
			audit.vaultkeeper.naturalWidth > 0 &&
			audit.vaultkeeper.paintState === 'painted',
		serialize(audit.vaultkeeper),
	);
	const expectedEnvironment = viewport.width <= 820
		? 'mechanical-vault-portrait-v1.webp'
		: 'mechanical-vault-desktop-v1.webp';
	check(
		group,
		`responsive mechanical vault environment selects ${expectedEnvironment}`,
		audit.environment.exists &&
			audit.environment.visible &&
			audit.environment.imageVisible &&
			audit.environment.imageComplete &&
			audit.environment.naturalWidth > 0 &&
			audit.environment.currentSrc.endsWith(expectedEnvironment) &&
			audit.environment.paintState === 'painted' &&
			audit.environment.pointerEvents === 'none',
		serialize(audit.environment),
	);
	check(group, 'mode labels are fully visible without ellipsis or clipping', audit.alignment.modeLabelsUnclipped, serialize(audit.alignment));
	check(group, 'base amount value and all three meters are centered', audit.alignment.baseAmountCentered && audit.alignment.metersCentered, serialize(audit.alignment));
	check(
		group,
		'route and presentation controls expose named accessibility groups',
		audit.semantics.modeGroup.role === 'group' &&
			audit.semantics.modeGroup.labelledBy === 'access-level-title' &&
			audit.semantics.modeGroup.label === 'Choose your route' &&
			audit.semantics.motionGroup.role === 'group' &&
			audit.semantics.motionGroup.label === 'Presentation speed controls',
		serialize(audit.semantics),
	);
	check(
		group,
		'connection and board states expose atomic polite status announcements',
		[audit.semantics.launchStatus, audit.semantics.boardStatus].every(
			(status) => status.role === 'status' && status.live === 'polite' && status.atomic === 'true',
		),
		serialize(audit.semantics),
	);
	check(group, 'keyboard focus exposes a distinct high-contrast action ring', Boolean(audit.keyboardFocus.testId) && audit.keyboardFocus.outlineWidth >= 3 && audit.keyboardFocus.outlineOffset >= 2 && audit.keyboardFocus.outlineStyle === 'solid' && audit.keyboardFocus.outlineColor === 'rgb(239, 192, 106)', serialize(audit.keyboardFocus));
	const boardRatio = audit.board.bounds ? audit.board.bounds.width / audit.board.bounds.height : 0;
	check(group, 'board aspect remains square', Math.abs(boardRatio - 1) <= 0.002, serialize(boardRatio));
	check(group, 'board meets viewport readability floor', Boolean(audit.board.bounds && Math.min(audit.board.bounds.width, audit.board.bounds.height) >= viewport.minBoard), serialize({ bounds: audit.board.bounds, minimum: viewport.minBoard }));
	for (const action of audit.actions) {
		check(group, `${action.selector} exists and is visible`, action.exists && action.visible, serialize(action));
		check(group, `${action.selector} is inside viewport`, action.insideViewport, serialize(action.bounds));
		check(group, `${action.selector} is at least 44x44 CSS pixels`, Boolean(action.bounds && action.bounds.width >= 44 && action.bounds.height >= 44), serialize(action.bounds));
		check(group, `${action.selector} center is physically hittable`, action.centerHit, serialize(action));
	}
}

async function runGeometryScenarios(browser, origin) {
	await runScenario('mobile-double-tap-does-not-zoom-and-rules-still-touch-scroll', async (record) => {
		const group = 'mobile-double-tap-does-not-zoom-and-rules-still-touch-scroll';
		const context = await browser.newContext({
			viewport: { width: 390, height: 844 },
			isMobile: true,
			hasTouch: true,
		});
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: { authenticate: () => authenticateResponse() },
			});
			const { page, diagnostics } = await openPage(
				context,
				origin,
				liveQuery({ device: 'mobile' }),
			);
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForStableAction(page);

			const visualViewportSnapshot = () =>
				page.evaluate(() => ({
					scale: visualViewport?.scale ?? 1,
					offsetLeft: visualViewport?.offsetLeft ?? 0,
					offsetTop: visualViewport?.offsetTop ?? 0,
					pageLeft: visualViewport?.pageLeft ?? scrollX,
					pageTop: visualViewport?.pageTop ?? scrollY,
					scrollX,
					scrollY,
				}));
			const beforeDoubleTap = await visualViewportSnapshot();
			const boardBounds = await page.locator(SELECTORS.board).boundingBox();
			assert.ok(boardBounds, 'Double-tap QA requires a visible board target.');
			const tapX = boardBounds.x + boardBounds.width / 2;
			const tapY = boardBounds.y + boardBounds.height / 2;
			await page.touchscreen.tap(tapX, tapY);
			await page.waitForTimeout(80);
			await page.touchscreen.tap(tapX, tapY);
			await page.waitForTimeout(350);
			const afterDoubleTap = await visualViewportSnapshot();
			check(
				group,
				'mobile double-tap keeps visual viewport at 1x without page displacement',
				Math.abs(beforeDoubleTap.scale - 1) <= 0.001 &&
					Math.abs(afterDoubleTap.scale - 1) <= 0.001 &&
					Math.abs(afterDoubleTap.offsetLeft - beforeDoubleTap.offsetLeft) <= 0.5 &&
					Math.abs(afterDoubleTap.offsetTop - beforeDoubleTap.offsetTop) <= 0.5 &&
					Math.abs(afterDoubleTap.pageLeft - beforeDoubleTap.pageLeft) <= 0.5 &&
					Math.abs(afterDoubleTap.pageTop - beforeDoubleTap.pageTop) <= 0.5,
				serialize({ beforeDoubleTap, afterDoubleTap }),
			);

			const infoAction = page.locator('[data-testid="info-action"]');
			const infoBounds = await infoAction.boundingBox();
			assert.ok(infoBounds, 'Touch-scroll QA requires a visible Game Information action.');
			await page.touchscreen.tap(
				infoBounds.x + infoBounds.width / 2,
				infoBounds.y + infoBounds.height / 2,
			);
			const dialog = page.getByRole('dialog', { name: /BLACKSITE/i });
			await dialog.waitFor({ state: 'visible' });
			const rulesScroll = dialog.locator('.rules-scroll');
			const beforeScroll = await rulesScroll.evaluate((element) => ({
				scrollTop: element.scrollTop,
				scrollHeight: element.scrollHeight,
				clientHeight: element.clientHeight,
				bounds: element.getBoundingClientRect().toJSON(),
			}));
			check(
				group,
				'mobile Game Information has legitimate vertical overflow to scroll',
				beforeScroll.scrollHeight > beforeScroll.clientHeight + 1,
				serialize(beforeScroll),
			);

			const client = await context.newCDPSession(page);
			const dragX = beforeScroll.bounds.left + beforeScroll.bounds.width / 2;
			const dragStartY = beforeScroll.bounds.bottom - 36;
			const dragEndY = beforeScroll.bounds.top + 72;
			await client.send('Input.dispatchTouchEvent', {
				type: 'touchStart',
				touchPoints: [{ x: dragX, y: dragStartY }],
			});
			for (let step = 1; step <= 6; step += 1) {
				const y = dragStartY + ((dragEndY - dragStartY) * step) / 6;
				await client.send('Input.dispatchTouchEvent', {
					type: 'touchMove',
					touchPoints: [{ x: dragX, y }],
				});
				await page.waitForTimeout(16);
			}
			await client.send('Input.dispatchTouchEvent', {
				type: 'touchEnd',
				touchPoints: [],
			});
			await page.waitForTimeout(250);
			const afterScroll = await rulesScroll.evaluate((element) => ({
				scrollTop: element.scrollTop,
				scrollHeight: element.scrollHeight,
				clientHeight: element.clientHeight,
				documentScrollX: scrollX,
				documentScrollY: scrollY,
				visualScale: visualViewport?.scale ?? 1,
			}));
			check(
				group,
				'mobile Rules content moves after a real touch drag while the page and zoom stay fixed',
				afterScroll.scrollTop > beforeScroll.scrollTop + 1 &&
					afterScroll.documentScrollX === 0 &&
					afterScroll.documentScrollY === 0 &&
					Math.abs(afterScroll.visualScale - 1) <= 0.001,
				serialize({ beforeScroll, afterScroll }),
			);
			check(
				group,
				'double-tap and Rules touch-scroll authenticate once and send zero wallet or event writes',
				network.byEndpoint.authenticate.length === 1 &&
					network.byEndpoint.play.length === 0 &&
					network.byEndpoint.endRound.length === 0 &&
					network.byEndpoint.event.length === 0,
				serialize(network.order),
			);
			assertCleanNetwork(group, network);
			assertCleanDiagnostics(group, diagnostics);
			record.beforeDoubleTap = beforeDoubleTap;
			record.afterDoubleTap = afterDoubleTap;
			record.beforeScroll = beforeScroll;
			record.afterScroll = afterScroll;
			record.screenshot = await saveScreenshot(page, 'mobile-double-tap-rules-touch-scroll');
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	for (const viewport of viewports) {
		await runScenario(`geometry-${viewport.name}`, async (record) => {
			const context = await browser.newContext({
				viewport: { width: viewport.width, height: viewport.height },
				isMobile: viewport.isMobile ?? false,
				hasTouch: viewport.hasTouch ?? false,
			});
			try {
				const network = await installMockRgs(context, {
					pageOrigin: origin,
					handlers: { authenticate: () => authenticateResponse() },
				});
				const { page, diagnostics } = await openPage(
					context,
					origin,
					liveQuery({ device: viewport.isMobile ? 'mobile' : 'desktop' }),
				);
				await waitForEndpoint(network, 'authenticate', 1);
				await waitForStableAction(page);
				const audit = await geometryAudit(page);
				audit.name = viewport.name;
				audit.surface = 'live';
				audit.screenshot = await saveScreenshot(page, `geometry-${viewport.name}`);
				evidence.geometry.push(audit);
				assertGeometryRecord(`geometry-${viewport.name}`, audit, viewport);
				assertCleanNetwork(`geometry-${viewport.name}`, network);
				assertCleanDiagnostics(`geometry-${viewport.name}`, diagnostics);
				record.screenshot = audit.screenshot;
				record.network = network;
				record.diagnostics = diagnostics;
			} finally {
				await context.close();
			}
		});
	}

	await runScenario('geometry-mobile-orientation-roundtrip', async (record) => {
		const group = 'geometry-mobile-orientation-roundtrip';
		const portrait = viewports.find(({ name }) => name === 'phone-390x844');
		const landscape = viewports.find(({ name }) => name === 'landscape-844x390');
		assert.ok(portrait && landscape, 'Orientation QA requires canonical portrait and landscape viewports.');
		const context = await browser.newContext({
			viewport: { width: portrait.width, height: portrait.height },
			isMobile: true,
			hasTouch: true,
		});
		try {
			const network = await installMockRgs(context, {
				pageOrigin: origin,
				handlers: { authenticate: () => authenticateResponse() },
			});
			const { page, diagnostics } = await openPage(
				context,
				origin,
				liveQuery({ device: 'mobile' }),
			);
			await waitForEndpoint(network, 'authenticate', 1);
			await waitForStableAction(page);

			const captureOrientation = async (viewport, phase, expectedEnvironment) => {
				await page.setViewportSize({ width: viewport.width, height: viewport.height });
				await page.waitForFunction(
					({ width, height, expectedEnvironment }) =>
						innerWidth === width &&
						innerHeight === height &&
						document
							.querySelector('[data-testid="vault-environment"] img')
							?.currentSrc.endsWith(expectedEnvironment),
					{ width: viewport.width, height: viewport.height, expectedEnvironment },
				);
				const audit = await geometryAudit(page);
				audit.name = `orientation-${phase}`;
				audit.surface = 'live-orientation-roundtrip';
				audit.screenshot = await saveScreenshot(page, `geometry-orientation-${phase}`);
				evidence.geometry.push(audit);
				assertGeometryRecord(group, audit, viewport);
				return audit;
			};

			const portraitBefore = await captureOrientation(
				portrait,
				'portrait-before',
				'mechanical-vault-portrait-v1.webp',
			);
			const landscapeAudit = await captureOrientation(
				landscape,
				'landscape',
				'mechanical-vault-desktop-v1.webp',
			);
			const portraitAfter = await captureOrientation(
				portrait,
				'portrait-after',
				'mechanical-vault-portrait-v1.webp',
			);

			const withinHalfPixel = (left, right) => Math.abs(left - right) <= 0.5;
			const portraitReturned =
				portraitBefore.board.bounds &&
				portraitAfter.board.bounds &&
				['left', 'top', 'width', 'height'].every((key) =>
					withinHalfPixel(portraitBefore.board.bounds[key], portraitAfter.board.bounds[key]),
				) &&
				portraitBefore.actions.every((beforeAction) => {
					const afterAction = portraitAfter.actions.find(
						({ selector }) => selector === beforeAction.selector,
					);
					return (
						beforeAction.bounds &&
						afterAction?.bounds &&
						['left', 'top', 'width', 'height'].every((key) =>
							withinHalfPixel(beforeAction.bounds[key], afterAction.bounds[key]),
						)
					);
				});
			check(
				group,
				'orientation round trip returns to the original portrait composition',
				Boolean(portraitReturned),
				serialize({ before: portraitBefore, after: portraitAfter }),
			);
			check(
				group,
				'orientation round trip preserves one authenticated session and zero wallet writes',
				network.byEndpoint.authenticate.length === 1 &&
					network.byEndpoint.play.length === 0 &&
					network.byEndpoint.endRound.length === 0 &&
					network.byEndpoint.event.length === 0,
				serialize(network.order),
			);
			assertCleanNetwork(group, network);
			assertCleanDiagnostics(group, diagnostics);
			record.orientation = {
				portraitBefore,
				landscape: landscapeAudit,
				portraitAfter,
			};
			record.network = network;
			record.diagnostics = diagnostics;
		} finally {
			await context.close();
		}
	});

	for (const viewport of replayViewports) {
		await runScenario(`geometry-${viewport.name}`, async (record) => {
			const group = `geometry-${viewport.name}`;
			const context = await browser.newContext({
				viewport: { width: viewport.width, height: viewport.height },
				isMobile: viewport.isMobile ?? false,
				hasTouch: viewport.hasTouch ?? false,
			});
			try {
				const network = await installMockRgs(context, {
					pageOrigin: origin,
					replayOnly: true,
					handlers: { replay: () => replayResponse() },
				});
				const { page, diagnostics } = await openPage(
					context,
					origin,
					replayQuery({ device: 'mobile' }),
				);
				await waitForEndpoint(network, 'replay', 1);
				await waitForStableAction(page);
				const replayRequest = network.byEndpoint.replay[0];
				check(group, 'Popout Replay GET has the exact event path', replayRequest.path === `/bet/replay/blacksite_breach/${REPLAY_VERSION}/base/1`, replayRequest.path);
				check(group, 'Popout Replay GET has no query parameters', Object.keys(replayRequest.search).length === 0, serialize(replayRequest.search));
				await page.locator(SELECTORS.primaryAction).click();
				await waitForReplayComplete(page);
				const audit = await geometryAudit(page);
				audit.name = viewport.name;
				audit.surface = 'replay-completed';
				audit.assumption = viewport.assumption;
				audit.screenshot = await saveScreenshot(page, `geometry-${viewport.name}`);
				evidence.geometry.push(audit);
				assertGeometryRecord(group, audit, viewport);
				check(group, 'Popout Replay remains read-only', walletWriteCount(network) === 0, serialize(network.order));
				check(group, 'Popout Replay fetches exactly once', network.byEndpoint.replay.length === 1, serialize(network.order));
				assertCleanNetwork(group, network);
				assertCleanDiagnostics(group, diagnostics);
				record.screenshot = audit.screenshot;
				record.network = network;
				record.diagnostics = diagnostics;
			} finally {
				await context.close();
			}
		});
	}
}

function writeEvidence() {
	mkdirSync(artifactRoot, { recursive: true });
	evidence.identity.completedAt = new Date().toISOString();
	evidence.summary = {
		pass: evidence.checks.filter((item) => item.status === 'PASS').length,
		fail: evidence.checks.filter((item) => item.status === 'FAIL').length,
		scenarios: evidence.scenarios.length,
		passedScenarios: evidence.scenarios.filter((item) => item.status === 'PASS').length,
		failedScenarios: evidence.scenarios.filter((item) => item.status === 'FAIL').length,
	};
	writeFileSync(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`);
}

async function main() {
	mkdirSync(artifactRoot, { recursive: true });
	let browser = null;
	let server = null;
	try {
		check('infrastructure', 'tested identity is a full git SHA', /^[0-9a-f]{40}$/i.test(gitSha), gitSha || '(empty)');
		check('infrastructure', 'tested worktree is clean', !evidence.identity.worktreeDirty, gitStatus || '(clean)');
		check(
			'infrastructure',
			'custom build-root QA is pinned to an expected SHA-256 tree identity',
			!requestedBuildRoot || /^[0-9a-f]{64}$/u.test(expectedBuildTreeSha256),
			serialize({ requestedBuildRoot: requestedBuildRoot || null, expectedBuildTreeSha256: expectedBuildTreeSha256 || null }),
		);
		check('infrastructure', 'static BLACKSITE build exists', existsSync(buildEntry), relative(repoRoot, buildEntry));
		evidence.manifests.build = createFileManifest([buildRoot], buildRoot);
		evidence.manifests.sources = createFileManifest(sourceIdentityTargets, repoRoot);
		evidence.identity.buildTreeSha256 = evidence.manifests.build.treeSha256;
		evidence.identity.sourceTreeSha256 = evidence.manifests.sources.treeSha256;
		check('infrastructure', 'build tree manifest contains files', evidence.manifests.build.fileCount > 0, serialize(evidence.manifests.build));
		check('infrastructure', 'build tree has a deterministic SHA-256 identity', /^[0-9a-f]{64}$/.test(evidence.identity.buildTreeSha256), evidence.identity.buildTreeSha256);
		if (expectedBuildTreeSha256) {
			check(
				'infrastructure',
				'tested build tree matches the caller-pinned package identity',
				/^[0-9a-f]{64}$/u.test(expectedBuildTreeSha256) &&
					evidence.identity.buildTreeSha256 === expectedBuildTreeSha256,
				serialize({
					expectedBuildTreeSha256,
					actualBuildTreeSha256: evidence.identity.buildTreeSha256,
				}),
			);
		}
		check('infrastructure', 'central source and lockfile manifest contains files', evidence.manifests.sources.fileCount > 0, serialize(evidence.manifests.sources));
		check('infrastructure', 'central source and lockfile tree has a deterministic SHA-256 identity', /^[0-9a-f]{64}$/.test(evidence.identity.sourceTreeSha256), evidence.identity.sourceTreeSha256);
		evidence.productionBuildScan = scanProductionBuild(evidence.manifests.build);
		check('infrastructure', 'production build contains no Stake Engine Loader signature', evidence.productionBuildScan.loaderHits.length === 0, serialize(evidence.productionBuildScan.loaderHits));
		check('infrastructure', 'production build excludes generated fixture catalog and fixture IDs', evidence.productionBuildScan.generatedFixtureHits.length === 0, serialize(evidence.productionBuildScan.generatedFixtureHits));
		const viewportContent = evidence.productionBuildScan.viewportMeta.content ?? '';
		check('infrastructure', 'production viewport meta binds device width and initial scale', /(?:^|,)\s*width=device-width(?:\s*,|$)/iu.test(viewportContent) && /(?:^|,)\s*initial-scale=1(?:\s*,|$)/iu.test(viewportContent), viewportContent || '(missing)');
		check('infrastructure', 'production viewport meta preserves user zoom and covers safe areas', !/maximum-scale\s*=/iu.test(viewportContent) && !/user-scalable\s*=\s*(?:no|0)/iu.test(viewportContent) && /(?:^|,)\s*viewport-fit=cover(?:\s*,|$)/iu.test(viewportContent), viewportContent || '(missing)');
		check('infrastructure', 'production CSS contains touch-action manipulation contract', evidence.productionBuildScan.touchActionManipulationPresent, serialize(evidence.productionBuildScan));
		const resolvedPlaywright = resolvePlaywright();
		evidence.playwright.version = resolvedPlaywright.version;
		const launched = await launchBrowser(resolvedPlaywright.playwright);
		browser = launched.browser;
		evidence.playwright.browser = browser.version();
		evidence.playwright.executable = launched.executablePath;
		const staticServer = await startStaticServer();
		server = staticServer.server;
		await runNetworkScenarios(browser, staticServer.origin);
		await runGeometryScenarios(browser, staticServer.origin);
	} catch (error) {
		recordFailure('infrastructure', error);
	} finally {
		if (browser) await browser.close().catch(() => {});
		if (server) await new Promise((resolvePromise) => server.close(resolvePromise));
		writeEvidence();
	}

	for (const item of evidence.checks) {
		console.log(`${item.status} [${item.group}] ${item.name}${item.detail ? ` - ${item.detail}` : ''}`);
	}
	console.log(`BLACKSITE browser evidence: ${relative(repoRoot, evidenceFile).replaceAll('\\', '/')}`);
	if (evidence.summary.fail > 0 || evidence.summary.failedScenarios > 0) process.exitCode = 1;
}

await main();
