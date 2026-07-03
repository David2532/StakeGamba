import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
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
	expectContains('currency-source', 'shared amount formatter delegates to currency adapter', amount, 'formatCurrencyAmount');
	expectNotContains('currency-source', 'builder does not use old euro image asset', builder, 'assets.euro');
	expectNotContains('currency-source', 'cluster preview source does not use old euro image asset', clusterSource, 'assets.euro');
	expectNotContains('currency-source', 'lines preview no longer uses Intl currency hardcode', linesSource, 'Intl.NumberFormat');
	expectNotContains('currency-source', 'lines preview no longer hardcodes currency: USD in Intl', linesSource, "currency: 'USD'");
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
	expectNotContains('mobile', 'old viewport transform scaling removed', builder, "vp.style.transform = 'translate(-50%, -50%) scale(' + s + ')'");
	if (preview) expectContains('mobile', 'generated preview contains fullscreen CSS', preview, 'height: 100dvh');
	try {
		await import('playwright');
		skip('mobile', 'Playwright screenshot check', 'Playwright package is available but screenshots are intentionally run from the browser QA step.');
	} catch {
		skip('mobile', 'Playwright screenshot check', 'Playwright is not installed in this workspace; static fullscreen gates ran.');
	}
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
	if (selectedMode === 'all' || selectedMode === 'rules') runRulesChecks();
	if (selectedMode === 'all' || selectedMode === 'regression') runExistingBehaviorChecks();
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
