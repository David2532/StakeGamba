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
const REPLAY_LIFECYCLE_CYCLES = 6;
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
	check(group, 'modal