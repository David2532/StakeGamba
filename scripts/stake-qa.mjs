import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { STAKE_SOCIAL_RESTRICTED_TERMS, socialRestrictedHits } from '../apps/cluster/scripts/stake-compliance-contract.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const mode = (process.argv[2] || 'all').toLowerCase();
const artifactRoot = process.env.STAKE_QA_ARTIFACT_DIR
	|| join(root, 'artifacts', 'stake-qa', new Date().toISOString().replace(/[:.]/g, '-'));

const targetOverride = (name, fallback) => process.env[name]
	? resolve(root, process.env[name])
	: fallback;

const paths = {
	builder: join(root, 'apps', 'cluster', 'scripts', 'build-preview-html.mjs'),
	preview: join(root, 'apps', 'cluster', 'preview.html'),
	productionMathContract: join(root, 'apps', 'cluster', 'scripts', 'production-math-contract.mjs'),
	e2e: join(root, 'scripts', 'stake-qa-e2e.mjs'),
	generatedMathConfig: join(root, 'math', 'games', 'golden_goal_rush', 'library', 'configs', 'game_config.json'),
	publishedMathConfig: targetOverride('STAKE_QA_MATH_CONFIG', join(root, 'publish', 'math', 'game_config.json')),
	publishedFrontend: targetOverride('STAKE_QA_FRONTEND_HTML', join(root, 'publish', 'frontend', 'index.html')),
	currency: join(root, 'packages', 'utils-shared', 'currency.js'),
	amount: join(root, 'packages', 'utils-shared', 'amount.ts'),
	stateUi: join(root, 'packages', 'state-shared', 'src', 'stateUi.svelte.ts'),
	i18nDerived: join(root, 'packages', 'components-ui-html', 'src', 'i18n', 'i18nDerived.ts'),
	autoStart: join(root, 'packages', 'components-ui-html', 'src', 'components', 'AutoSpinsStartButton.svelte'),
	clusterPreviewSource: join(root, 'apps', 'cluster', 'src', 'components', 'GoldenGoalRushFinalPreview.svelte'),
	linesPreviewSource: join(root, 'apps', 'lines', 'src', 'components', 'GoldenGoalRushSixByFivePreview.svelte'),
};

const checks = [];
let paytableEvidence = null;
const SOCIAL_FORBIDDEN_VALUES = STAKE_SOCIAL_RESTRICTED_TERMS;
const SOCIAL_REQUIRED_VALUES = [
	'Play Replay',
	'Base Play',
	'Feature Multiplier',
	'Play Cost',
	'Final Multiplier',
	'Final Play Amount',
	'Replay Play',
	'BONUS / FEATURE',
	'AUTO-PLAY',
	'PLAY',
];
const PLAYER_MODE_NAMES = [
	'Base Game',
	'Feature Spins',
	'Rainbow Spin',
	'Golden Chance',
	'All That Glitters',
	'End of the Rainbow',
];

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

function extractBalancedObject(content, marker) {
	const start = content.indexOf(marker);
	if (start < 0) return '';
	const brace = content.indexOf('{', start);
	if (brace < 0) return '';
	let depth = 0;
	for (let i = brace; i < content.length; i += 1) {
		const ch = content[i];
		if (ch === '{') depth += 1;
		if (ch === '}') {
			depth -= 1;
			if (depth === 0) return content.slice(brace, i + 1);
		}
	}
	return '';
}

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stringValuesFromObjectLiteral(block) {
	return [...block.matchAll(/:\s*'([^']*)'/g)].map((match) => match[1]).join(' ');
}

function socialForbiddenHits(text) {
	return socialRestrictedHits(text);
}

function runSyntaxCheck() {
	const result = spawnSync(process.execPath, ['--check', paths.builder], {
		cwd: root,
		encoding: 'utf8',
	});
	expect('syntax', 'preview builder passes node --check', result.status === 0, result.stderr || result.stdout);
	const generated = spawnSync(process.execPath, [paths.builder, '--check'], {
		cwd: root,
		encoding: 'utf8',
	});
	expect('generated-artifacts', 'preview.html exactly matches deterministic builder output', generated.status === 0, generated.stderr || generated.stdout);
	if (existsSync(paths.preview)) {
		const preview = read(paths.preview);
		const inlineScripts = [...preview.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1]);
		expect('generated-artifacts', 'generated preview contains inline application JavaScript', inlineScripts.length > 0, `scripts=${inlineScripts.length}`);
		for (const [index, script] of inlineScripts.entries()) {
			const inlineCheck = spawnSync(process.execPath, ['--check', '-'], {
				cwd: root,
				encoding: 'utf8',
				input: script,
			});
			expect('generated-artifacts', `generated inline script ${index + 1} parses`, inlineCheck.status === 0, inlineCheck.stderr || inlineCheck.stdout);
		}
	}
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

const API_AMOUNT_MULTIPLIER = 1_000_000;

function sameNumber(left, right) {
	return Math.round(Number(left) * 100_000_000) === Math.round(Number(right) * 100_000_000);
}

function connectedClusterSize(grid, target, wild = 'wild') {
	const cols = Array.isArray(grid) ? grid.length : 0;
	const rows = cols && Array.isArray(grid[0]) ? grid[0].length : 0;
	const starts = [];
	for (let col = 0; col < cols; col += 1) {
		for (let row = 0; row < rows; row += 1) {
			if (grid[col]?.[row] === target) starts.push([col, row]);
		}
	}
	let largest = 0;
	const globallySeen = new Set();
	for (const start of starts) {
		const startKey = `${start[0]},${start[1]}`;
		if (globallySeen.has(startKey)) continue;
		const stack = [start];
		const seen = new Set([startKey]);
		let count = 0;
		while (stack.length) {
			const [col, row] = stack.pop();
			count += 1;
			if (grid[col]?.[row] === target) globallySeen.add(`${col},${row}`);
			for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
				const nextCol = col + dc;
				const nextRow = row + dr;
				if (nextCol < 0 || nextCol >= cols || nextRow < 0 || nextRow >= rows) continue;
				const key = `${nextCol},${nextRow}`;
				if (seen.has(key)) continue;
				const symbol = grid[nextCol]?.[nextRow];
				if (symbol !== target && symbol !== wild) continue;
				seen.add(key);
				stack.push([nextCol, nextRow]);
			}
		}
		largest = Math.max(largest, count);
	}
	return largest;
}

async function runPaytableChecks() {
	const group = 'paytable-contract';
	for (const [name, path] of [
		['production math contract module', paths.productionMathContract],
		['generated production math config', paths.generatedMathConfig],
		['published production math config', paths.publishedMathConfig],
	]) {
		expect(group, `${name} exists`, existsSync(path), rel(path));
	}
	if (![paths.productionMathContract, paths.generatedMathConfig, paths.publishedMathConfig].every(existsSync)) return;

	let contract;
	try {
		contract = await import(pathToFileURL(paths.productionMathContract).href + `?qa=${Date.now()}`);
		pass(group, 'production math contract imports without drift/schema errors', rel(paths.productionMathContract));
	} catch (error) {
		fail(group, 'production math contract imports without drift/schema errors', error?.stack || error?.message || String(error));
		return;
	}

	let generatedConfig;
	let publishedConfig;
	try {
		generatedConfig = JSON.parse(read(paths.generatedMathConfig));
		publishedConfig = JSON.parse(read(paths.publishedMathConfig));
	} catch (error) {
		fail(group, 'production math configs contain valid JSON', error?.message || String(error));
		return;
	}

	expect(
		group,
		'generated and published Paytable JSON are identical',
		JSON.stringify(generatedConfig.paytable) === JSON.stringify(publishedConfig.paytable),
		`${rel(paths.generatedMathConfig)} === ${rel(paths.publishedMathConfig)}`,
	);
	expect(
		group,
		'generated and published cluster rules are identical',
		JSON.stringify(generatedConfig.cluster) === JSON.stringify(publishedConfig.cluster),
		`${rel(paths.generatedMathConfig)} === ${rel(paths.publishedMathConfig)}`,
	);

	const matrix = [];
	for (const symbol of contract.PAYING_SYMBOLS) {
		const raw = publishedConfig.paytable?.[symbol];
		const ui = contract.PRODUCTION_PAYTABLE?.[symbol];
		expect(group, `${symbol} is present in published math and UI contract`, !!raw && !!ui, symbol);
		if (!raw || !ui) continue;
		for (const threshold of contract.CLUSTER_THRESHOLDS) {
			const productionValue = threshold.boostKey ? Number(raw.cluster5) * Number(raw[threshold.boostKey]) : Number(raw.cluster5);
			const contractValue = Number(ui[threshold.valueKey]);
			const matches = sameNumber(productionValue, contractValue);
			expect(group, `${symbol} ${threshold.label} matches published production math numerically`, matches, `${contractValue} === ${productionValue}`);
			matrix.push({
				symbol,
				threshold: threshold.label,
				production: productionValue,
				frontendContract: contractValue,
				formatted: matches ? contract.formatPaytableMultiplier(contractValue) : null,
				result: matches ? 'PASS' : 'FAIL',
			});
		}
	}

	const apiPayout = (symbol, size, cascade = 1) => Math.round(
		API_AMOUNT_MULTIPLIER * contract.payoutForCluster(symbol, size, cascade),
	);
	expect(group, 'K 5 symbols at $1 and 1x pays $0.48', apiPayout('k', 5) === 480_000, `${apiPayout('k', 5)} API units`);
	expect(group, 'Q 5 symbols at $1 and 1x pays $0.36', apiPayout('q', 5) === 360_000, `${apiPayout('q', 5)} API units`);
	expect(group, 'J 7 symbols at $1 and 1x pays $0.56', apiPayout('j', 7) === 560_000, `${apiPayout('j', 7)} API units`);

	const wildGrid = Array.from({ length: 6 }, () => Array(5).fill('scatter'));
	for (const [col, row] of [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1]]) wildGrid[col][row] = 'j';
	wildGrid[3][1] = 'wild';
	const wildClusterSize = connectedClusterSize(wildGrid, 'j');
	expect(group, 'six J plus one connecting Wild counts as a seven-symbol J cluster', wildClusterSize === 7, `cluster size=${wildClusterSize}`);
	expect(group, 'six J plus one connecting Wild pays $0.56 at $1 and 1x', apiPayout('j', wildClusterSize) === 560_000, `${apiPayout('j', wildClusterSize)} API units`);
	expect(group, 'later 2x cascade applies after base threshold pay', apiPayout('j', 7, 2) === 1_120_000, `${apiPayout('j', 7, 2)} API units`);

	for (const [value, expected] of [[0.48, '0.48'], [2.88, '2.88'], [3.84, '3.84'], [1, '1']]) {
		expect(group, `Paytable formatter preserves ${expected}`, contract.formatPaytableMultiplier(value) === expected, contract.formatPaytableMultiplier(value));
	}

	const builder = read(paths.builder);
	expectContains(group, 'frontend builder consumes production Paytable contract', builder, 'PRODUCTION_PAYTABLE');
	expectContains(group, 'frontend builder consumes shared Paytable formatter', builder, 'formatPaytableMultiplier');
	expectContains(group, 'frontend exposes generated Paytable for numerical DOM audit', builder, '__ggrPaytable');

	if (existsSync(paths.preview)) {
		pass(group, 'generated preview exists for Paytable audit', rel(paths.preview));
	} else {
		fail(group, 'generated preview exists for Paytable audit', rel(paths.preview));
	}
	if (existsSync(paths.preview) && existsSync(paths.publishedFrontend)) {
		expect(group, 'publish/frontend/index.html exactly matches generated preview.html', read(paths.preview) === read(paths.publishedFrontend), `${rel(paths.preview)} === ${rel(paths.publishedFrontend)}`);
	} else {
		fail(group, 'published frontend exists for generated-artifact drift audit', rel(paths.publishedFrontend));
	}

	paytableEvidence = {
		generatedMathConfig: rel(paths.generatedMathConfig),
		publishedMathConfig: rel(paths.publishedMathConfig),
		generatedFrontend: rel(paths.preview),
		publishedFrontend: rel(paths.publishedFrontend),
		apiAmountMultiplier: API_AMOUNT_MULTIPLIER,
		matrix,
		mandatoryExamples: {
			k5ApiAmount: apiPayout('k', 5),
			q5ApiAmount: apiPayout('q', 5),
			j7ApiAmount: apiPayout('j', 7),
			j6PlusWildClusterSize: wildClusterSize,
			j6PlusWildApiAmount: apiPayout('j', wildClusterSize),
		},
	};
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

function runBetConfigChecks() {
	const builder = read(paths.builder);
	const e2e = read(paths.e2e);
	expectContains('bet-config', 'dev fallback bet levels are isolated', builder, 'const DEV_BET_LEVELS = [');
	expectContains('bet-config', 'active bet config source exists', builder, 'let activeBetConfig');
	expectContains('bet-config', 'authenticate bet config normalizer exists', builder, 'function normalizeBetConfig');
	expectContains('bet-config', 'authenticate bet config applier exists', builder, 'function applyBetConfig');
	expectContains('bet-config', 'authenticate bet levels are accepted from response config', builder, "firstArrayConfig(config, ['betLevels', 'availableBetLevels', 'betAmounts', 'bets', 'levels', 'denominations'])");
	expectContains('bet-config', 'authenticate default bet is accepted from response config', builder, "firstMoneyConfig(config, ['defaultBetLevel', 'defaultBet', 'defaultBetAmount', 'betLevel', 'betAmount', 'minBet'])");
	expectContains('bet-config', 'authenticate currency is accepted from config/balance', builder, 'config.currency || config.defaultCurrency || balanceCurrency');
	expectContains('bet-config', 'RGS authenticate without levels uses response default only', builder, "if (source === 'authenticate' && !levels.length && defaultBet !== null)");
	expectContains('bet-config', 'wallet response feeds bet config', builder, "syncBetLevels(data.config, data)");
	expectContains('bet-config', 'wallet play uses active bet api levels', builder, 'activeBetConfig.apiLevels');
	expectContains('bet-config', 'plus/minus controls move through active bet ladder', builder, 'state.bet = BETS[state.betIdx]');
	expectContains('bet-config', 'QA-only runtime exposes cloned active bet config', e2e, 'getBetConfig: () => cloneReplayData(activeBetConfig)');
	expectContains('bet-config', 'production frontend only exposes the QA instrumentation hook marker', builder, '/*__STAKE_QA_RUNTIME_HOOK__*/');
	expectContains('bet-config', 'demo fallback only applies outside RGS/replay', builder, "if (!UrlState.requiresRgs() && !Replay.configured()) applyBetConfig");
}

function runSocialWordingChecks() {
	const builder = read(paths.builder);
	const sweeps = extractBalancedObject(builder, 'sweeps_en:');
	const socialValues = stringValuesFromObjectLiteral(sweeps);
	expect('social-copy', 'sweeps_en language resource is present', sweeps.length > 0, `chars=${sweeps.length}`);
	for (const forbidden of SOCIAL_FORBIDDEN_VALUES) {
		expect('social-copy', `sweeps_en values avoid "${forbidden}"`, !socialForbiddenHits(socialValues).includes(forbidden), forbidden);
	}
	for (const required of SOCIAL_REQUIRED_VALUES) {
		expectContains('social-copy', `sweeps_en value includes "${required}"`, socialValues, required);
	}
	expectContains('social-copy', 'social UI applies language at runtime', builder, 'function applyLanguage()');
	expectContains('social-copy', 'social rules body is generated separately', builder, 'function buildSocialRulesBodyHtml()');
	expectContains('social-copy', 'social rules use Feature panel wording', builder, "socialTrigger: 'Feature panel");
	expectContains('social-copy', 'social rules use play amount wording', builder, 'play amount');
	expectContains('social-copy', 'social replay label mapping includes Play Cost', builder, "replayTotalCost: 'Play Cost'");
	expectContains('social-copy', 'social replay label mapping includes Final Play Amount', builder, "replayTotalWin: 'Final Play Amount'");
}

function runGameInfoChecks() {
	const builder = read(paths.builder);
	const preview = existsSync(paths.preview) ? read(paths.preview) : builder;
	expectContains('game-info', 'player mode metadata source exists', builder, 'const PLAYER_MODE_META = {');
	expectContains('game-info', 'rules render all player modes from metadata', builder, 'Object.values(PLAYER_MODE_META).map');
	for (const name of PLAYER_MODE_NAMES) {
		expectContains('game-info', `Game Info explains mode "${name}"`, preview, name);
	}
	for (const marker of [
		'Main Spin button',
		'Bonus Buy panel',
		'3 Scatter tickets',
		'4 Scatter tickets',
		'5 Scatter tickets only',
		'Feature panel',
	]) {
		expectContains('game-info', `Game Info includes access/trigger "${marker}"`, builder + preview, marker);
	}
	for (const marker of [
		'Cost multiplier:',
		'Feature Multiplier:',
		'Golden Cells persist',
		'guaranteed Golden Arc',
		'boosted Golden Arc chance',
		'not available from the feature panel',
	]) {
		expectContains('game-info', `Game Info includes feature detail "${marker}"`, builder + preview, marker);
	}
	for (const marker of [
		'<div class="pt-head">Retriggers</div>',
		'Base Game and Rainbow Spin can trigger Free Spins',
		'Base Play and Rainbow Spin can trigger Free Spins',
		'No retrigger inside this single-spin mode.',
		'The current math book does not create additional Free Spins inside this tier.',
		'Feature-panel Free Spins do not add additional Free Spins',
	]) {
		expectContains('game-info', `Game Info includes retrigger rule "${marker}"`, builder + preview, marker);
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
	expectNotContains('major-actions', 'production frontend does not expose the mutable preview API', builder, 'window.__ggr =');
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

function runReplayChecks() {
	const builder = read(paths.builder);
	expectContains('replay', 'dedicated replay overlay exists', builder, 'id="replay-overlay"');
	expectContains('replay', 'dedicated replay action exists', builder, 'id="replay-action"');
	expectContains('replay', 'explicit replay lifecycle state exists', builder, 'data-replay-state');
	for (const lifecycle of ['loading', 'ready', 'running', 'completed', 'error']) {
		expectContains('replay', `replay lifecycle includes ${lifecycle}`, builder, `${lifecycle}:`);
	}
	expectContains('replay', 'replay fetch uses Stake replay endpoint', builder, "'/bet/replay/'");
	expectContains('replay', 'replay request includes language parameter', builder, 'language: UrlState.lang()');
	expectContains('replay', 'replay request includes lang parameter', builder, 'lang: UrlState.lang()');
	expectContains('replay', 'replay metadata function exists', builder, 'function replayMetadata(round)');
	expectContains('replay', 'replay mode name comes from player mode metadata', builder, 'playerModeName(rgsRoundMode(round))');
	expectContains('replay', 'Replay Bet label is explicit and display-only', builder, "'REPLAY BET'");
	expectContains('replay', 'Replay Play and Play Again labels are dedicated', builder, "status === 'completed' ? t('replayAgainAction') : t('replayAction')");
	expectContains('replay', 'replay lifecycle uses localized labels', builder, "replayLoadingDetail");
	expectContains('replay', 'replay currency code is hidden and aria-hidden', builder, "currency.setAttribute('aria-hidden', 'true')");
	expectContains('replay', 'replay completion presentation is non-blocking for RGS settlement', builder, "{ blocking: false }");
	expectContains('replay', 'normal replay controls are made inert/disabled', builder, 'function makeUnavailableInReplay(element)');
	expectContains('replay', 'replay response is schema validated', builder, 'function validateReplayEvents(events)');
	expectContains('replay', 'replay request has a timeout controller', builder, 'new AbortController()');
	expectContains('replay', 'replay saved data is frozen', builder, 'deepFreezeReplayData');
	expectContains('replay', 'replay uses RGS book renderer', builder, "playRgsBookRound({ round: playbackRound }");
	expectContains('replay', 'replay playback does not track/save bonus progress', builder, 'trackProgress: false');
	expectContains('replay', 'dedicated replay action starts cached playback', builder, 'action.onclick = () => play();');
	expectNotContains('replay', 'production frontend exposes no mutable gameplay API', builder, 'window.__ggr =');
	expectNotContains('replay', 'production frontend contains no demo win mutator', builder, 'demoWin');
	expectNotContains('replay', 'production frontend contains no demo feature mutator', builder, 'demoFeature');
	expectContains('replay', 'normal spin action is logically guarded in replay', builder, 'if (state.replay');
	expectNotContains('replay', 'replay is no longer blocked as unsupported launch parameter', builder, 'The game URL contains unsupported launch parameters');
	expectNotContains('replay', 'old replay unsupported comment removed', builder, 'This build does not implement replay rendering');
	expectNotContains('replay', 'replay has no local fallback round generator', builder, 'localReplayRound');
	expectNotContains('replay', 'replay has no fallback board generator', builder, 'replayFallbackBoard');
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
	expectContains('mobile', 'portrait phones use board-first fit', builder, 'const isPortraitMobile = vw <= 700 && vh > vw;');
	expectContains('mobile', 'portrait playable layout class exists', builder, '.stage.mobile-portrait');
	expectContains('mobile', 'portrait touch-target sizing variables exist', builder, '--mobile-control-size');
	expectContains('mobile', 'portrait spin size variable exists', builder, '--mobile-spin-size');
	expectContains('mobile', 'bottom controls respect the safe area', builder, 'safe-area-inset-bottom');
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
		timeout: Number(process.env.STAKE_QA_E2E_TIMEOUT_MS) || 30 * 60 * 1000,
	});
	if (result.status === 0) {
		pass('e2e', 'browser end-to-end suite', `mode=${e2eMode}, report: e2e-report.json`);
		return;
	}
	const e2eRequired = mode === 'e2e'
		|| process.env.STAKE_QA_REQUIRE_E2E === '1'
		|| process.env.CI === 'true'
		|| process.env.CI === '1';
	if (result.status === 3 && !e2eRequired) {
		skip('e2e', 'browser end-to-end suite', 'Playwright/Chromium not available. Install with: npm i -D playwright && npx playwright install chromium. Set STAKE_QA_REQUIRE_E2E=1 to make this a hard failure.');
		return;
	}
	fail('e2e', 'browser end-to-end suite', `stake-qa-e2e exited with status ${result.status}`);
}

function runMathIntegrityChecks() {
	const args = [
		'-m', 'unittest', 'discover',
		'-s', join('math', 'games', 'golden_goal_rush', 'tests'),
		'-p', 'test_*.py',
		'-v',
	];
	const result = spawnSync('python', args, {
		cwd: root,
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
		timeout: Number(process.env.STAKE_QA_MATH_TIMEOUT_MS) || 2 * 60 * 1000,
	});
	const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
	if (result.status === 0) {
		pass('math-integrity', 'production Python Wild/cluster regression suite', output.split('\n').slice(-2).join(' | '));
		return;
	}
	fail('math-integrity', 'production Python Wild/cluster regression suite', `status=${result.status}; ${output.slice(-2000)}`);
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

const E2E_MODES = new Set(['all', 'currency', 'insufficient-funds', 'major-actions', 'interrupted-round', 'mobile', 'rules', 'bet-config', 'social', 'replay', 'paytable']);
async function run(selectedMode) {
	runSyntaxCheck();
	if (selectedMode === 'all' || selectedMode === 'math-integrity') runMathIntegrityChecks();
	if (selectedMode === 'all' || selectedMode === 'paytable') await runPaytableChecks();
	if (selectedMode === 'all' || selectedMode === 'currency') {
		await runCurrencyChecks();
		runCurrencySourceChecks();
	}
	if (selectedMode === 'all' || selectedMode === 'i18n') runI18nChecks();
	if (selectedMode === 'all' || selectedMode === 'bet-config') runBetConfigChecks();
	if (selectedMode === 'all' || selectedMode === 'social') runSocialWordingChecks();
	if (selectedMode === 'all' || selectedMode === 'rules' || selectedMode === 'game-info') runGameInfoChecks();
	if (selectedMode === 'all' || selectedMode === 'replay') runReplayChecks();
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
	targets: {
		frontend: paths.publishedFrontend,
		mathConfig: paths.publishedMathConfig,
		canonicalPreview: paths.preview,
		canonicalGeneratedMathConfig: paths.generatedMathConfig,
	},
	checks,
	summary: {
		pass: checks.filter((check) => check.status === 'PASS').length,
		fail: checks.filter((check) => check.status === 'FAIL').length,
		skip: checks.filter((check) => check.status === 'SKIP').length,
	},
};
writeFileSync(join(artifactRoot, 'report.json'), JSON.stringify(report, null, 2));
if (paytableEvidence) writeFileSync(join(artifactRoot, 'paytable-contract.json'), JSON.stringify(paytableEvidence, null, 2));

for (const check of checks) {
	const prefix = check.status === 'PASS' ? 'PASS' : check.status === 'SKIP' ? 'SKIP' : 'FAIL';
	console.log(`${prefix} [${check.group}] ${check.name}${check.detail ? ` - ${check.detail}` : ''}`);
}
console.log(`Stake QA report: ${rel(join(artifactRoot, 'report.json'))}`);
if (paytableEvidence) console.log(`Paytable contract evidence: ${rel(join(artifactRoot, 'paytable-contract.json'))}`);

if (report.summary.fail > 0) {
	console.error(`Stake QA failed: ${report.summary.fail} failing check(s).`);
	process.exit(1);
}
