import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const mode = (process.argv[2] || 'all').toLowerCase();
const artifactRoot = join(root, 'artifacts', 'stake-qa', new Date().toISOString().replace(/[:.]/g, '-'));

const paths = {
	builder: join(root, 'apps', 'cluster', 'scripts', 'build-preview-html.mjs'),
	preview: join(root, 'apps', 'cluster', 'preview.html'),
	currency: join(root, 'packages', 'utils-shared', 'currency.js'),
	amount: join(root, 'packages', 'utils-shared', 'amount.ts'),
	stateUi: join(root, 'packages', 'state-shared', 'src', 'stateUi.svelte.ts'),
	i18nDerived: join(root, 'packages', 'components-ui-html', 'src', 'i18n', 'i18nDerived.ts'),
	autoStart: join(root, 'packages', 'components-ui-html', 'src', 'components', 'AutoSpinsStartButton.svelte'),
	clusterPreviewSource: join(root, 'apps', 'cluster', 'src', 'components', 'GoldenGoalRushFinalPreview.svelte'),
	linesPreviewSource: join(root, 'apps', 'lines', 'src', 'components', 'GoldenGoalRushSixByFivePreview.svelte'),
};

const checks = [];

function read(path) {
	return readFileSync(path, 'utf8');
}

function rel(path) {
	return relative(root, path).replaceAll('\\', '/');
}

function record(group, name, status, detail = '') {
	checks.push({ group, name, status, detail });
}

function pass(group, name, detail = '') {
	record(group, name, 'PASS', detail);
}

function fail(group, name, detail = '') {
	record(group, name, 'FAIL', detail);
}

function skip(group, name, detail = '') {
	record(group, name, 'SKIP', detail);
}

function expect(group, name, condition, detail = '') {
	if (condition) pass(group, name, detail);
	else fail(group, name, detail);
}

function contains(content, marker) {
	return content.includes(marker);
}

function expectContains(group, name, content, marker) {
	expect(group, name, contains(content, marker), `marker: ${marker}`);
}

function expectNotContains(group, name, content, marker) {
	expect(group, name, !contains(content, marker), `forbidden marker: ${marker}`);
}

function runSyntaxCheck() {
	const result = spawnSync(process.execPath, ['--check', paths.builder], {
		cwd: root,
		encoding: 'utf8',
	});
	expect('syntax', 'preview builder passes node --check', result.status === 0, result.stderr || result.stdout);
}

async function runCurrencyChecks() {
	const { CURRENCY_META, currencyDisplaySymbol, formatCurrencyAmount, insufficientFundsMessage } =
		await import(pathToFileURL(paths.currency).href + `?v=${Date.now()}`);
	const expected = {
		USD: '$10.00',
		CAD: 'CA$10.00',
		JPY: '¥10',
		EUR: '€10.00',
		RUB: '₽10.00',
		CNY: 'CN¥10.00',
		PHP: '₱10.00',
		INR: '₹10.00',
		IDR: 'Rp10',
		KRW: '₩10',
		BRL: 'R$10.00',
		MXN: 'MX$10.00',
		DKK: '10.00 KR',
		PLN: '10.00 zł',
		VND: '10 ₫',
		TRY: '₺10.00',
		CLP: '10 CLP',
		ARS: '10.00 ARS',
		PEN: 'S/10.00',
		NGN: '₦10.00',
		SAR: '10.00 SAR',
		ILS: '10.00 ILS',
		AED: '10.00 AED',
		TWD: 'NT$10.00',
		NOK: 'kr10.00',
		KWD: 'KD10.00',
		JOD: 'JD10.00',
		CRC: '₡10.00',
		TND: '10.00 TND',
		SGD: 'SG$10.00',
		MYR: 'RM10.00',
		OMR: '10.00 OMR',
		QAR: '10.00 QAR',
		BHD: 'BD10.00',
		XGC: '10.00 GC',
		XSC: '10.00 SC',
	};

	for (const [currency, value] of Object.entries(expected)) {
		expect('currency', `${currency} formats like Stake table`, formatCurrencyAmount(10, currency) === value, `${formatCurrencyAmount(10, currency)} === ${value}`);
	}
	expect('currency', 'all required currencies have metadata', Object.keys(expected).every((key) => CURRENCY_META[key]), Object.keys(CURRENCY_META).join(','));
	expect('currency', 'unknown currency falls back to amount plus code', formatCurrencyAmount(10, 'ZZZ') === '10.00 ZZZ', formatCurrencyAmount(10, 'ZZZ'));
	expect('currency', 'XSC display symbol is SC', currencyDisplaySymbol('XSC') === 'SC', currencyDisplaySymbol('XSC'));
	expect('currency', 'XGC display symbol is GC', currencyDisplaySymbol('XGC') === 'GC', currencyDisplaySymbol('XGC'));
	expect('currency', 'social casino insufficient copy uses Balance', insufficientFundsMessage('XSC', false) === 'Insufficient Balance', insufficientFundsMessage('XSC', false));
	expect('currency', 'fiat insufficient copy uses Funds', insufficientFundsMessage('EUR', false) === 'Insufficient Funds', insufficientFundsMessage('EUR', false));
}

function runCurrencySourceChecks() {
	const builder = read(paths.builder);
	const amount = read(paths.amount);
	const clusterSource = read(paths.clusterPreviewSource);
	const linesSource = read(paths.linesPreviewSource);

	expectContains('currency-source', 'builder imports shared currency metadata', builder, 'CURRENCY_META');
	expectContains('currency-source', 'builder HUD uses currency text slot', builder, "'currency'");
	expectContains('currency-source', 'builder WIN meter uses currency formatting', builder, "$('meter-win').textContent = formatCurrency(");
	expectContains('currency-source', 'shared amount formatter delegates to currency adapter', amount, 'formatCurrencyAmount');
	expectNotContains('currency-source', 'builder does not use old euro image asset', builder, 'assets.euro');
	expectNotContains('currency-source', 'cluster preview source does not use old euro image asset', clusterSource, 'assets.euro');
	expectNotContains('currency-source', 'lines preview no longer uses Intl currency hardcode', linesSource, 'Intl.NumberFormat');
	expectNotContains('currency-source', 'lines preview no longer hardcodes currency: USD in Intl', linesSource, "currency: 'USD'");
	runHardcodedSymbolScan();
}

// Repo-wide gate: no UI source may hardcode a currency symbol. All symbols
// must come from packages/utils-shared/currency.js (the single metadata
// source). This is what keeps the original "everything shows €" bug from
// silently coming back in any component.
const CURRENCY_SYMBOL_PATTERN = /[€₽₱₹₩₺₦₡₫₴£¥]|zł(?=["'\s<])/u;
function runHardcodedSymbolScan() {
	const scanRoots = [
		join(root, 'apps', 'cluster', 'src'),
		join(root, 'apps', 'cluster', 'scripts'),
		join(root, 'apps', 'lines', 'src'),
		join(root, 'packages'),
	];
	const allowed = new Set([
		relative(root, paths.currency).replaceAll('\\', '/'), // the metadata itself
	]);
	const scanExtensions = new Set(['.svelte', '.ts', '.js', '.mjs', '.html', '.css']);
	const skipDirs = new Set(['node_modules', 'dist', 'build', '.svelte-kit', 'storybook-static', 'static', 'assets']);
	const offenders = [];
	const walk = (dir) => {
		let entries = [];
		try { entries = readdirSync(dir); } catch { return; }
		for (const entry of entries) {
			const full = join(dir, entry);
			const stats = statSync(full);
			if (stats.isDirectory()) {
				if (!skipDirs.has(entry)) walk(full);
				continue;
			}
			if (!scanExtensions.has(extname(entry))) continue;
			const relPath = relative(root, full).replaceAll('\\', '/');
			if (allowed.has(relPath)) continue;
			const content = readFileSync(full, 'utf8');
			for (const [lineNo, line] of content.split('\n').entries()) {
				if (CURRENCY_SYMBOL_PATTERN.test(line)) {
					offenders.push(`${relPath}:${lineNo + 1}`);
					break;
				}
			}
		}
	};
	for (const scanRoot of scanRoots) walk(scanRoot);
	expect(
		'currency-source',
		'no hardcoded currency symbols outside currency metadata',
		offenders.length === 0,
		offenders.length ? `offenders: ${offenders.slice(0, 8).join(', ')}` : 'scanned apps/*/src, apps/cluster/scripts, packages/**',
	);
}

// Every asset path embedded in the GENERATED preview (icons in Rules, HUD
// art, audio) must exist on disk — a renamed/missing file would ship broken
// images to Stake. The generated file is scanned because the builder
// assembles paths from template variables.
function runIconAssetChecks() {
	if (!existsSync(paths.preview)) {
		fail('rules', 'generated preview exists for asset audit', rel(paths.preview));
		return;
	}
	const preview = read(paths.preview);
	const assetPaths = new Set();
	for (const match of preview.matchAll(/src\/assets\/golden-goal-rush[^'"`\s)\\]*\.(?:webp|png|mp3)/g)) {
		assetPaths.add(match[0]);
	}
	expect('rules', 'preview references asset files', assetPaths.size >= 20, `found ${assetPaths.size} asset paths`);
	const missing = [...assetPaths].filter((assetPath) => !existsSync(join(root, 'apps', 'cluster', assetPath)));
	expect('rules', 'all referenced icon/asset files exist on disk', missing.length === 0, missing.length ? `missing: ${missing.slice(0, 6).join(', ')}` : `${assetPaths.size} files verified`);
}

function runI18nChecks() {
	const builder = read(paths.builder);
	const i18n = read(paths.i18nDerived);
	const stateUi = read(paths.stateUi);
	const autoStart = read(paths.autoStart);

	expectContains('i18n', 'preview has Insufficient Balance title path', builder, "'Insufficient Balance'");
	expectContains('i18n', 'preview has Insufficient Funds title path', builder, "'Insufficient Funds'");
	expectContains('i18n', 'preview social flag is considered', builder, 'UrlState.social()');
	expectContains('i18n', 'preview initializes display currency from URL', builder, 'state.currency = UrlState.currency();');
	expectContains('i18n', 'shared UI derives insufficient copy from currency helper', i18n, 'insufficientFundsMessage(stateBet.currency, stateUrlDerived.social())');
	expectContains('i18n', 'shared auto start reports insufficient funds instead of silent disabled button', autoStart, "message: 'insufficientFunds'");
	expectContains('i18n', 'auto-spin option 200 is available', stateUi, "'200': 200");
	for (const removed of ["'75'", "'250'", "'500'", "'1000'"]) {
		expectNotContains('i18n', `auto-spin option ${removed} is removed`, stateUi, removed);
	}
}

function runMajorActionChecks() {
	const builder = read(paths.builder);
	const autoStart = read(paths.autoStart);

	expectContains('major-actions', 'auto-bet modal exists', builder, 'id="modal-autospin"');
	expectContains('major-actions', 'auto-bet options are restricted', builder, 'const AUTO_SPIN_OPTIONS = [10, 25, 50, 100, 200, Infinity]');
	expectContains('major-actions', 'auto-bet confirmation function exists', builder, 'function confirmAutoSpin(count)');
	expectContains('major-actions', 'auto-bet starts through scheduler after confirmation', builder, 'startAutoSpin(count)');
	expectContains('major-actions', 'auto button opens modal instead of direct spin', builder, 'buildAutoSpinModal();');
	expectNotContains('major-actions', 'old auto toggle direct-spin branch removed', builder, 'state.auto = !state.auto');
	expectContains('major-actions', 'bonus buy confirmation retained', builder, 'function showBuyConfirm(o, price)');
	expectContains('major-actions', 'bonus buy insufficient balance shows modal', builder, 'showInsufficientFunds(price)');
	expectContains('major-actions', 'shared auto start has confirmation state', autoStart, 'awaitingConfirm');
	expectContains('major-actions', 'shared auto start requires second click', autoStart, 'if (!awaitingConfirm)');
	// The generic gate future major actions (e.g. Double Chance) must use.
	expectContains('major-actions', 'confirmMajorAction gate exists', builder, 'function confirmMajorAction(');
	expectContains('major-actions', 'confirmMajorAction modal exists', builder, 'id="modal-major-confirm"');
	expectContains('major-actions', 'confirmMajorAction is part of the public preview API', builder, 'confirmMajorAction, formatCurrency');
	expectContains('major-actions', 'confirmMajorAction treats dismissal as cancel', builder, 'observer = new MutationObserver(');
}

function runInterruptedRoundChecks() {
	const builder = read(paths.builder);
	const resumeStart = builder.indexOf('async function resumeLaunchRound()');
	const messageCall = builder.indexOf('await showInterruptedRoundMessage();', resumeStart);
	const spinningStart = builder.indexOf('state.spinning = true;', resumeStart);

	expectContains('interrupted-round', 'interrupted round modal exists', builder, 'id="modal-interrupted-round"');
	expectContains('interrupted-round', 'interrupted round exact copy exists', builder, 'Your previous round was interrupted. You can continue where you left off.');
	expectContains('interrupted-round', 'interrupted round modal is persistent', builder, 'data-persistent="true"');
	expect('interrupted-round', 'resume message appears before bonus playback starts', messageCall > resumeStart && messageCall < spinningStart, `messageCall=${messageCall}, spinningStart=${spinningStart}`);
	expectContains('interrupted-round', 'persistent modal ignores backdrop close', builder, '!m.dataset.persistent');
}

async function runMobileChecks() {
	const builder = read(paths.builder);
	const preview = existsSync(paths.preview) ? read(paths.preview) : '';

	expectContains('mobile', 'viewport uses dvh', builder, 'height: 100dvh');
	expectContains('mobile', 'viewport is fixed fullscreen', builder, '.viewport { position: fixed; inset: 0;');
	expectContains('mobile', 'stage fit transform uses CSS variable', builder, '--stage-fit-transform');
	expectContains('mobile', 'fitViewport extends stage height for portrait', builder, 'const stageH = viewAspect < aspect');
	expectContains('mobile', 'fitViewport updates stage dimensions', builder, "stageEl.style.height = stageH + 'px'");
	expectContains('mobile', 'portrait play area is re-centered', builder, '--stage-y-shift');
	expectContains('mobile', 'landscape play area is re-centered', builder, '--stage-x-shift');
	expectContains('mobile', 'dialogs counter-scale for phone readability', builder, '--stage-inv-scale');
	expectNotContains('mobile', 'old viewport transform scaling removed', builder, "vp.style.transform = 'translate(-50%, -50%) scale(' + s + ')'");
	if (preview) expectContains('mobile', 'generated preview contains fullscreen CSS', preview, 'height: 100dvh');
}

// Browser end-to-end gates (scripts/stake-qa-e2e.mjs): real Chromium runs of
// currency HUD, insufficient funds, major-action confirmation, interrupted
// bonus resume, mobile fullscreen screenshots and the rules button audit.
function runE2eChecks(selectedMode) {
	const e2eMode = selectedMode === 'all' ? 'all' : selectedMode;
	const result = spawnSync(process.execPath, [join(__dirname, 'stake-qa-e2e.mjs'), e2eMode], {
		cwd: root,
		encoding: 'utf8',
		stdio: ['ignore', 'inherit', 'inherit'],
		env: { ...process.env, STAKE_QA_ARTIFACT_DIR: artifactRoot },
		timeout: 15 * 60 * 1000,
	});
	if (result.status === 0) {
		pass('e2e', 'browser end-to-end suite', `mode=${e2eMode}, report: e2e-report.json`);
		return;
	}
	if (result.status === 3 && process.env.STAKE_QA_REQUIRE_E2E !== '1') {
		skip('e2e', 'browser end-to-end suite', 'Playwright/Chromium not available. Install with: npm i -D playwright && npx playwright install chromium. Set STAKE_QA_REQUIRE_E2E=1 to make this a hard failure.');
		return;
	}
	fail('e2e', 'browser end-to-end suite', `stake-qa-e2e exited with status ${result.status}`);
}

function runRulesChecks() {
	const builder = read(paths.builder);
	const preview = existsSync(paths.preview) ? read(paths.preview) : builder;
	const controls = [
		'spin',
		'auto-bet',
		'turbo',
		'bonus-buy',
		'bet-minus',
		'bet-plus',
		'bet-selector',
		'info-rules',
		'settings',
		'menu',
		'sound-music',
		'collect',
		'free-spins',
		'close-modal',
	];

	expectContains('rules', 'rules modal has Buttons & Controls section', builder, 'Buttons &amp; Controls');
	for (const key of controls) {
		expectContains('rules', `rules describe ${key}`, preview, `data-control-key="${key}"`);
	}
	expectContains('rules', 'rules preserve RTP text', builder, 'RTP 96.45%');
	expectContains('rules', 'rules preserve malfunction text', builder, 'Malfunction voids all pays and plays');
}

function runExistingBehaviorChecks() {
	const builder = read(paths.builder);
	const mathConfig = read(join(root, 'apps', 'cluster', 'scripts', 'ggr-config.mjs'));

	expectContains('regression-markers', 'RGS authenticate function remains', builder, 'const authenticate = async () =>');
	expectContains('regression-markers', 'RGS play endpoint remains', builder, '/wallet/play');
	expectContains('regression-markers', 'RGS end-round endpoint remains', builder, '/wallet/end-round');
	expectContains('regression-markers', 'round active end-round guard remains', builder, 'const roundNeedsEnd = (round) => !!round && round.active === true;');
	expectContains('regression-markers', 'RGS book renderer remains', builder, 'async function playRgsBookRound');
	expectContains('regression-markers', 'bonus buy RGS render guard remains', builder, 'if (!shouldRenderRgsRound(rgsEvents))');
	expectContains('regression-markers', 'local free spins stay demo-only', builder, 'allowLocalFreeSpins = !Rgs.configured()');
	expectContains('regression-markers', 'symbol math import remains in preview builder', builder, 'import { SYMBOL_MATH, CONFIG }');
	expectContains('regression-markers', 'math config still exports symbol weights', mathConfig, 'SYMBOL_MATH');
}

const E2E_MODES = new Set(['all', 'currency', 'insufficient-funds', 'major-actions', 'interrupted-round', 'mobile', 'rules']);
async function run(selectedMode) {
	runSyntaxCheck();
	if (selectedMode === 'all' || selectedMode === 'currency') {
		await runCurrencyChecks();
		runCurrencySourceChecks();
	}
	if (selectedMode === 'all' || selectedMode === 'i18n') runI18nChecks();
	if (selectedMode === 'all' || selectedMode === 'major-actions') runMajorActionChecks();
	if (selectedMode === 'all' || selectedMode === 'interrupted-round') runInterruptedRoundChecks();
	if (selectedMode === 'all' || selectedMode === 'mobile') await runMobileChecks();
	if (selectedMode === 'all' || selectedMode === 'rules') {
		runRulesChecks();
		runIconAssetChecks();
	}
	if (selectedMode === 'all' || selectedMode === 'regression') runExistingBehaviorChecks();
	if (selectedMode === 'e2e') runE2eChecks('all');
	else if (E2E_MODES.has(selectedMode)) runE2eChecks(selectedMode);
}

await run(mode);

mkdirSync(artifactRoot, { recursive: true });
const report = {
	mode,
	root,
	checks,
	summary: {
		pass: checks.filter((check) => check.status === 'PASS').length,
		fail: checks.filter((check) => check.status === 'FAIL').length,
		skip: checks.filter((check) => check.status === 'SKIP').length,
	},
};
writeFileSync(join(artifactRoot, 'report.json'), JSON.stringify(report, null, 2));

for (const check of checks) {
	const prefix = check.status === 'PASS' ? 'PASS' : check.status === 'SKIP' ? 'SKIP' : 'FAIL';
	console.log(`${prefix} [${check.group}] ${check.name}${check.detail ? ` - ${check.detail}` : ''}`);
}
console.log(`Stake QA report: ${rel(join(artifactRoot, 'report.json'))}`);

if (report.summary.fail > 0) {
	console.error(`Stake QA failed: ${report.summary.fail} failing check(s).`);
	process.exit(1);
}
