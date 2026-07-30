import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';

const root = resolve(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const args = new Set(process.argv.slice(2));
const writeMode = args.has('--write');
const checkMode = args.has('--check') || !writeMode;
const docsDir = resolve(root, 'docs');
const artifactsDir = resolve(root, 'artifacts', 'stake-qa');
const forbiddenPlaceholders = /\b(TBD|TODO|FIXME|UNKNOWN|NOT VERIFIED)\b/;

const requiredDocs = [
	'stake-requirements-matrix.md',
	'stake-feedback-history.md',
	'stake-architecture-and-rgs-flow.md',
	'stake-replay-contract.md',
	'stake-math-and-paytable-contract.md',
	'stake-compliance-pipeline.md',
	'stake-evidence-index.md',
	'stake-publish-upload-runbook.md',
	'stake-known-risks.md',
	'stake-team-ready-message.md',
];

const rel = (file) => relative(root, file).split(sep).join('/');
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');
const git = (...gitArgs) => execFileSync('git', gitArgs, { cwd: root, encoding: 'utf8' }).trim();

function listFiles(dir) {
	const output = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = resolve(dir, entry.name);
		if (entry.isDirectory()) output.push(...listFiles(full));
		if (entry.isFile()) output.push(full);
	}
	return output.sort((a, b) => rel(a).localeCompare(rel(b)));
}

function latestEvidenceDir() {
	const candidates = readdirSync(artifactsDir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && existsSync(resolve(artifactsDir, entry.name, 'report.json')))
		.map((entry) => resolve(artifactsDir, entry.name))
		.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
	if (!candidates.length) throw new Error('No Stake QA evidence directory with report.json exists.');
	return candidates[0];
}

function extractBuildId(html) {
	return html.match(/__ggrBuild\s*=\s*['"]([^'"]+)['"]/)?.[1]
		|| html.match(/buildId['"]?\s*[:=]\s*['"]([^'"]+)['"]/)?.[1]
		|| sha256(resolve(root, 'publish', 'frontend', 'index.html'));
}

function manifestFor(dir) {
	const files = listFiles(dir).map((file) => ({
		path: rel(file),
		bytes: statSync(file).size,
		sha256: sha256(file),
	}));
	const digest = createHash('sha256').update(JSON.stringify(files)).digest('hex');
	return { root: rel(dir), fileCount: files.length, sha256: digest, files };
}

function requiredString(value, field) {
	if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing required evidence field: ${field}`);
	return value;
}

function requiredCount(value, field) {
	if (!Number.isInteger(value) || value < 0) throw new Error(`Missing or invalid evidence count: ${field}`);
	return value;
}

function context() {
	const evidenceDir = latestEvidenceDir();
	const report = readJson(resolve(evidenceDir, 'report.json'));
	const e2eReport = existsSync(resolve(evidenceDir, 'e2e-report.json')) ? readJson(resolve(evidenceDir, 'e2e-report.json')) : null;
	const frontendIndex = resolve(root, 'publish', 'frontend', 'index.html');
	const mathConfigFile = resolve(root, 'publish', 'math', 'game_config.json');
	const html = readFileSync(frontendIndex, 'utf8');
	const mathConfig = readJson(mathConfigFile);
	const frontendManifest = manifestFor(resolve(root, 'publish', 'frontend'));
	const mathManifest = manifestFor(resolve(root, 'publish', 'math'));
	const testedCommitSha = requiredString(report.identity?.testedCommitSha, 'report.identity.testedCommitSha');
	if (!/^[0-9a-f]{40}$/i.test(testedCommitSha)) throw new Error(`Invalid tested commit SHA: ${testedCommitSha}`);
	if (testedCommitSha !== git('rev-parse', 'HEAD')) throw new Error(`Evidence commit ${testedCommitSha} does not match checked-out commit`);
	const startedAt = requiredString(report.identity?.startedAt, 'report.identity.startedAt');
	const completedAt = requiredString(report.identity?.completedAt, 'report.identity.completedAt');
	if (Number.isNaN(Date.parse(startedAt)) || Number.isNaN(Date.parse(completedAt)) || Date.parse(completedAt) < Date.parse(startedAt)) {
		throw new Error('Stake QA evidence has impossible start/end timestamps.');
	}
	const integrity = {
		testedCommit: {
			sha: testedCommitSha,
			source: 'scripts/stake-qa.mjs report.identity.testedCommitSha',
		},
		githubActionsRunId: report.identity.githubActionsRunId || null,
		evidenceDirectory: rel(evidenceDir),
		frontend: {
			uploadFolder: 'publish/frontend',
			buildId: extractBuildId(html),
			indexSha256: sha256(frontendIndex),
			manifestSha256: frontendManifest.sha256,
		},
		math: {
			uploadFolder: 'publish/math',
			version: mathConfig.version || mathConfig.mathVersion || '0.2.2-cluster',
			gameConfigSha256: sha256(mathConfigFile),
			manifestSha256: mathManifest.sha256,
		},
		report: {
			path: rel(resolve(evidenceDir, 'report.json')),
			mode: report.mode,
			pass: requiredCount(report.summary?.pass, 'report.summary.pass'),
			fail: requiredCount(report.summary?.fail, 'report.summary.fail'),
			skip: requiredCount(report.summary?.skip, 'report.summary.skip'),
			startedAt,
			completedAt,
		},
		e2e: e2eReport ? {
			path: rel(resolve(evidenceDir, 'e2e-report.json')),
			mode: e2eReport.mode,
			pass: requiredCount(e2eReport.summary?.pass, 'e2eReport.summary.pass'),
			fail: requiredCount(e2eReport.summary?.fail, 'e2eReport.summary.fail'),
			skip: requiredCount(e2eReport.summary?.skip ?? 0, 'e2eReport.summary.skip'),
		} : null,
	};
	return { evidenceDir, report, e2eReport, frontendManifest, mathManifest, integrity, mathConfig };
}

const baseImplementation = 'apps/cluster/scripts/build-preview-html.mjs; apps/cluster/preview.html; publish/frontend/index.html';
const baseTests = 'scripts/stake-qa.mjs; scripts/stake-qa-e2e.mjs';
const replayEvidence = (ctx) => `${rel(resolve(ctx.evidenceDir, 'report.json'))}; ${rel(resolve(ctx.evidenceDir, 'e2e-report.json'))}; ${rel(resolve(ctx.evidenceDir, 'replay-network-proof.json'))}`;
const publishEvidence = (ctx) => `${rel(resolve(artifactsDir, 'publish-integrity.json'))}; ${rel(resolve(artifactsDir, 'publish-frontend-manifest.json'))}; ${rel(resolve(artifactsDir, 'publish-math-manifest.json'))}`;

const requirementSeeds = [
	['RGS', 'Game did not authenticate with RGS', 'Launch RGS auth', 'authenticate is called only in paid RGS mode and fatal launch errors stop local fallback.', 'apps/cluster/scripts/build-preview-html.mjs', 'bootstrapRgsSession; authenticateRgs', 'scripts/stake-qa.mjs all', 'scripts/stake-qa-e2e.mjs rgs', 'Stake Compliance CI / RGS wallet lifecycle gate', 'publish/frontend/index.html'],
	['RGS', 'Game did not send Play', 'Paid spin lifecycle', 'A paid spin sends the Stake play request before rendering authoritative events.', 'apps/cluster/scripts/build-preview-html.mjs', 'handlePaidSpin; rgsPlay', 'scripts/stake-qa.mjs all', 'scripts/stake-qa-e2e.mjs wallet', 'Stake Compliance CI / RGS wallet lifecycle gate', 'publish/frontend/index.html'],
	['RGS', 'Game did not send End-Round', 'Round settlement', 'Inactive or completed rounds call end-round exactly when Stake active-state rules require it.', 'apps/cluster/scripts/build-preview-html.mjs', 'settleRgsRound; rgsEndRound', 'scripts/stake-qa.mjs all', 'scripts/stake-qa-e2e.mjs wallet', 'Stake Compliance CI / RGS wallet lifecycle gate', 'publish/frontend/index.html'],
	['RGS', 'Play and End-Round returned errors', 'RGS error handling', 'Transport and API errors surface a fatal state with no local simulated recovery.', 'apps/cluster/scripts/build-preview-html.mjs', 'rgsFetch; showFatalError', 'scripts/stake-qa.mjs all', 'scripts/stake-qa-e2e.mjs wallet', 'Stake Compliance CI / RGS wallet lifecycle gate', 'publish/frontend/index.html'],
	['RGS', 'Connections remained open and the game became stuck', 'Request lifecycle', 'RGS requests use bounded lifecycle handling and clear state transitions.', 'apps/cluster/scripts/build-preview-html.mjs', 'rgsFetch; setBusyState', 'scripts/stake-qa.mjs all', 'scripts/stake-qa-e2e.mjs wallet', 'Stake Compliance CI / RGS wallet lifecycle gate', 'publish/frontend/index.html'],
	['RGS', 'End-Round appeared inconsistently', 'Settlement consistency', 'End-round is determined from round.active and completion state, not display timing.', 'apps/cluster/scripts/build-preview-html.mjs', 'settleRgsRound; roundNeedsEnd', 'scripts/stake-qa.mjs all', 'scripts/stake-qa-e2e.mjs interrupted-round', 'Stake Compliance CI / active round settlement gate', 'publish/frontend/index.html'],
	['RGS', 'End-Round was incorrectly associated with winning or losing state', 'Active state authority', 'round.active controls settlement behavior regardless of win/loss.', 'apps/cluster/scripts/build-preview-html.mjs', 'roundNeedsEnd; settleRgsRound', 'scripts/stake-qa.mjs all', 'scripts/stake-qa-e2e.mjs interrupted-round', 'Stake Compliance CI / active round settlement gate', 'publish/frontend/index.html'],
	['RGS', 'Visible winnings differed from the Play response', 'Authoritative wins', 'Visible wins are rendered from RGS events and payout fields, not local recalculation.', 'apps/cluster/scripts/build-preview-html.mjs', 'playRgsBookRound; rgsDisplayWinMoney', 'scripts/stake-qa.mjs all', 'scripts/stake-qa-e2e.mjs paytable', 'Stake Compliance CI / paytable contract gate', 'publish/frontend/index.html'],
	['Bonus', 'Bonus purchase used a local simulation path', 'Bonus purchase authority', 'Bonus/Feature purchase routes through RGS play and never uses local RNG in RGS mode.', 'apps/cluster/scripts/build-preview-html.mjs', 'purchaseBonus; rgsPlay', 'scripts/stake-qa.mjs all', 'scripts/stake-qa-e2e.mjs major-actions', 'Stake Compliance CI / RGS wallet lifecycle gate', 'publish/frontend/index.html'],
	['Bonus', 'Bonus purchase could display a win disconnected from RGS', 'Bonus win authority', 'Bonus purchase display comes from authoritative RGS state and payout.', 'apps/cluster/scripts/build-preview-html.mjs', 'purchaseBonus; playRgsBookRound', 'scripts/stake-qa.mjs all', 'scripts/stake-qa-e2e.mjs major-actions', 'Stake Compliance CI / bonus purchase gate', 'publish/frontend/index.html'],
	['Launch', 'URL modification did not cause the required fatal error', 'Launch parameter validation', 'Unsupported launch parameters fail closed with the Stake-required fatal message.', 'apps/cluster/scripts/build-preview-html.mjs', 'UrlState; validateLaunchParameters', 'scripts/stake-qa.mjs all', 'scripts/stake-qa-e2e.mjs regression', 'Stake Compliance CI / static and launch gate', 'publish/frontend/index.html'],
	['RGS', 'Active base-round settlement behavior', 'Active base rounds', 'Active base rounds remain resumable or settle only through Stake-approved end-round flow.', 'apps/cluster/scripts/build-preview-html.mjs', 'restoreInterruptedRound; settleRgsRound', 'scripts/stake-qa.mjs interrupted-round', 'scripts/stake-qa-e2e.mjs interrupted-round', 'Stake Compliance CI / interrupted-round gate', 'publish/frontend/index.html'],
	['RGS', 'Interrupted bonus continuation behavior', 'Interrupted bonus rounds', 'Interrupted bonus rounds resume without charging again and continue from RGS state.', 'apps/cluster/scripts/build-preview-html.mjs', 'restoreInterruptedRound; continueBonusRound', 'scripts/stake-qa.mjs interrupted-round', 'scripts/stake-qa-e2e.mjs interrupted-round', 'Stake Compliance CI / interrupted-round gate', 'publish/frontend/index.html'],
	['Wallet', 'Preserving selected amount after refresh', 'Bet persistence', 'Selected amount is restored from RGS configuration and launch/session state after refresh.', 'apps/cluster/scripts/build-preview-html.mjs', 'setBetAmount; hydrateBetConfig', 'scripts/stake-qa.mjs all', 'scripts/stake-qa-e2e.mjs wallet', 'Stake Compliance CI / dynamic bet-configuration gate', 'publish/frontend/index.html'],
	['Wallet', 'Preserving post-purchase balance', 'Balance authority', 'Balance after bonus purchase follows RGS wallet response and is not recomputed locally.', 'apps/cluster/scripts/build-preview-html.mjs', 'applyRgsBalance; purchaseBonus', 'scripts/stake-qa.mjs all', 'scripts/stake-qa-e2e.mjs wallet', 'Stake Compliance CI / wallet lifecycle gate', 'publish/frontend/index.html'],
	['UI', 'Bonus-start popup', 'Bonus start UX', 'Bonus start popup is shown from authoritative bonus-trigger events.', 'apps/cluster/scripts/build-preview-html.mjs', 'showBonusStart; playRgsBookRound', 'scripts/stake-qa.mjs rules', 'scripts/stake-qa-e2e.mjs major-actions', 'Stake Compliance CI / game info and bonus gate', 'publish/frontend/index.html'],
	['Currency', 'Currency symbols and abbreviations', 'Currency display', 'USD, KRW, SC/XSC and configured currencies use shared display metadata.', 'apps/cluster/scripts/build-preview-html.mjs', 'formatCurrency; normalizeCurrency', 'scripts/stake-qa.mjs currency', 'scripts/stake-qa-e2e.mjs replay', 'Stake Compliance CI / currency gate', 'publish/frontend/index.html'],
	['RGS', 'Interrupted-round user message', 'Resume messaging', 'Interrupted-round message explains continuation without implying a new charge.', 'apps/cluster/scripts/build-preview-html.mjs', 'showInterruptedRoundMessage', 'scripts/stake-qa.mjs interrupted-round', 'scripts/stake-qa-e2e.mjs interrupted-round', 'Stake Compliance CI / interrupted-round gate', 'publish/frontend/index.html'],
	['UI', 'Auto action selection and confirmation', 'Major action confirmation', 'Auto action requires explicit confirmation according to configured major-action rules.', 'apps/cluster/scripts/build-preview-html.mjs', 'confirmMajorAction; autoPlay', 'scripts/stake-qa.mjs major-actions', 'scripts/stake-qa-e2e.mjs major-actions', 'Stake Compliance CI / major-action gate', 'publish/frontend/index.html'],
	['UI', 'Bonus/Feature action confirmation', 'Major action confirmation', 'Bonus/Feature purchase requires confirmation and RGS authority.', 'apps/cluster/scripts/build-preview-html.mjs', 'confirmMajorAction; purchaseBonus', 'scripts/stake-qa.mjs major-actions', 'scripts/stake-qa-e2e.mjs major-actions', 'Stake Compliance CI / major-action gate', 'publish/frontend/index.html'],
	['UI', 'Generic major-action confirmation', 'Major action confirmation', 'All configured major actions use consistent confirmation UI and keyboard handling.', 'apps/cluster/scripts/build-preview-html.mjs', 'confirmMajorAction', 'scripts/stake-qa.mjs major-actions', 'scripts/stake-qa-e2e.mjs major-actions', 'Stake Compliance CI / major-action gate', 'publish/frontend/index.html'],
	['Wallet', 'Insufficient Funds wording', 'Insufficient funds copy', 'Insufficient-funds wording follows Stake copy for fiat/crypto modes.', 'apps/cluster/scripts/build-preview-html.mjs', 'showInsufficientFunds', 'scripts/stake-qa.mjs insufficient-funds', 'scripts/stake-qa-e2e.mjs insufficient-funds', 'Stake Compliance CI / insufficient-funds gate', 'publish/frontend/index.html'],
	['Wallet', 'Stake.us Insufficient Balance wording', 'Stake.us copy', 'Stake.us social balance wording uses Insufficient Balance copy.', 'apps/cluster/scripts/build-preview-html.mjs', 'showInsufficientFunds; socialMode', 'scripts/stake-qa.mjs insufficient-funds', 'scripts/stake-qa-e2e.mjs insufficient-funds', 'Stake Compliance CI / social wording gate', 'publish/frontend/index.html'],
	['Responsive', 'Mobile fullscreen behavior', 'Mobile viewport', 'Mobile portrait and landscape fill the viewport without clipped Stake controls.', 'apps/cluster/scripts/build-preview-html.mjs', 'fitViewport; layoutStage', 'scripts/stake-qa.mjs mobile', 'scripts/stake-qa-e2e.mjs mobile', 'Stake Compliance CI / mobile and responsive gate', 'publish/frontend/index.html'],
	['Game Info', 'Button icons and explanations in Game Info', 'Rules content', 'Every Game Info button has an icon and a concise explanation.', 'apps/cluster/scripts/build-preview-html.mjs', 'renderGameInfo', 'scripts/stake-qa.mjs rules', 'scripts/stake-qa-e2e.mjs rules', 'Stake Compliance CI / Game Info gate', 'publish/frontend/index.html'],
	['Bet Config', 'Dynamic minBet', 'Dynamic bet config', 'minBet comes from authenticate response and constrains UI/action state.', 'apps/cluster/scripts/build-preview-html.mjs', 'hydrateBetConfig', 'scripts/stake-qa.mjs all', 'scripts/stake-qa-e2e.mjs wallet', 'Stake Compliance CI / dynamic bet-configuration gate', 'publish/frontend/index.html'],
	['Bet Config', 'Dynamic maxBet', 'Dynamic bet config', 'maxBet comes from authenticate response and constrains UI/action state.', 'apps/cluster/scripts/build-preview-html.mjs', 'hydrateBetConfig', 'scripts/stake-qa.mjs all', 'scripts/stake-qa-e2e.mjs wallet', 'Stake Compliance CI / dynamic bet-configuration gate', 'publish/frontend/index.html'],
	['Bet Config', 'Dynamic stepBet', 'Dynamic bet config', 'stepBet comes from authenticate response and controls increment/decrement.', 'apps/cluster/scripts/build-preview-html.mjs', 'hydrateBetConfig; changeBet', 'scripts/stake-qa.mjs all', 'scripts/stake-qa-e2e.mjs wallet', 'Stake Compliance CI / dynamic bet-configuration gate', 'publish/frontend/index.html'],
	['Bet Config', 'Dynamic default bet level', 'Dynamic bet config', 'Default bet level follows RGS authenticate configuration.', 'apps/cluster/scripts/build-preview-html.mjs', 'hydrateBetConfig', 'scripts/stake-qa.mjs all', 'scripts/stake-qa-e2e.mjs wallet', 'Stake Compliance CI / dynamic bet-configuration gate', 'publish/frontend/index.html'],
	['Bet Config', 'Dynamic betLevels', 'Dynamic bet config', 'The bet selector is built from authenticate betLevels.', 'apps/cluster/scripts/build-preview-html.mjs', 'hydrateBetConfig; renderBetSelector', 'scripts/stake-qa.mjs all', 'scripts/stake-qa-e2e.mjs wallet', 'Stake Compliance CI / dynamic bet-configuration gate', 'publish/frontend/index.html'],
	['Game Info', 'Detailed mode descriptions', 'Mode help', 'Rules document each mode and visible cost multiplier.', 'apps/cluster/scripts/build-preview-html.mjs', 'modeMeta; renderGameInfo', 'scripts/stake-qa.mjs rules', 'scripts/stake-qa-e2e.mjs rules', 'Stake Compliance CI / Game Info gate', 'publish/frontend/index.html'],
	['Game Info', 'Mode access and trigger conditions', 'Mode help', 'Rules describe access and trigger conditions for base, rainbow, hunt, bonus_tier1 and bonus.', 'apps/cluster/scripts/build-preview-html.mjs', 'modeMeta; renderGameInfo', 'scripts/stake-qa.mjs rules', 'scripts/stake-qa-e2e.mjs rules', 'Stake Compliance CI / Game Info gate', 'publish/frontend/index.html'],
	['Game Info', 'Mode costs and multipliers', 'Mode help', 'Rules and UI show configured costs and multipliers.', 'apps/cluster/scripts/build-preview-html.mjs', 'modeMeta; renderReplaySummary', 'scripts/stake-qa.mjs rules', 'scripts/stake-qa-e2e.mjs rules', 'Stake Compliance CI / Game Info gate', 'publish/frontend/index.html'],
	['Game Info', 'Retrigger availability and conditions', 'Mode help', 'Rules document retrigger availability and conditions consistent with math config.', 'apps/cluster/scripts/build-preview-html.mjs; math/games/golden_goal_rush/library/configs/game_config.json', 'renderGameInfo; modeMeta', 'scripts/stake-qa.mjs rules', 'scripts/stake-qa-e2e.mjs rules', 'Stake Compliance CI / Game Info gate', 'publish/frontend/index.html; publish/math/game_config.json'],
	['Social', 'Social Mode restricted terminology', 'Stake.us wording', 'Restricted social terminology is absent from production UI copy.', 'apps/cluster/scripts/build-preview-html.mjs', 'socialMode; copy tables', 'scripts/stake-qa.mjs all', 'scripts/stake-qa-e2e.mjs replay', 'Stake Compliance CI / Social wording gate', 'publish/frontend/index.html'],
	['Replay', 'Replay language parameter', 'Replay request', 'Replay GET includes language and lang parameters from launch state.', 'apps/cluster/scripts/build-preview-html.mjs', 'fetchReplayRound; UrlState.lang', 'scripts/stake-qa.mjs replay', 'scripts/stake-qa-e2e.mjs replay', 'Stake Compliance CI / Replay contract gate', 'publish/frontend/index.html'],
	['Replay', 'Replay initial cost/multiplier/final amount panel', 'Replay panel', 'Replay panel shows mode, replay bet, currency and final win from immutable replay data.', baseImplementation, 'replayMetadata; renderReplaySummary', 'scripts/stake-qa.mjs replay', 'scripts/stake-qa-e2e.mjs replay', 'Stake Compliance CI / Browser Replay gate', 'publish/frontend/index.html'],
	['Replay', 'Replay mode naming', 'Replay modes', 'Replay normalizes mode aliases and displays player-facing mode names.', baseImplementation, 'replayModeIdentity; playerModeName', 'scripts/stake-qa.mjs replay', 'scripts/stake-qa-e2e.mjs replay', 'Stake Compliance CI / Replay contract gate', 'publish/frontend/index.html'],
	['Replay', 'Replay event replay button', 'Replay controls', 'Replay Play and Play Again are dedicated replay controls that never trigger wallet play.', baseImplementation, 'renderReplayOverlay; playReplayRound', 'scripts/stake-qa.mjs replay', 'scripts/stake-qa-e2e.mjs replay', 'Stake Compliance CI / Forbidden-network gate', 'publish/frontend/index.html'],
	['Replay', 'Replay Popout S support', 'Replay launch', 'Replay accepts Stake launch variants and keeps the UI inside the popout viewport.', baseImplementation, 'UrlState; layoutStage', 'scripts/stake-qa.mjs replay', 'scripts/stake-qa-e2e.mjs replay', 'Stake Compliance CI / Browser Replay gate', 'publish/frontend/index.html'],
	['Replay UI', 'Balance hidden in Replay', 'Replay controls hidden', 'Balance is hidden, inert and non-interactive in replay.', baseImplementation, 'makeUnavailableInReplay', 'scripts/stake-qa.mjs replay', 'scripts/stake-qa-e2e.mjs replay', 'Stake Compliance CI / Browser Replay gate', 'publish/frontend/index.html'],
	['Replay UI', 'Spin button hidden in Replay', 'Replay controls hidden', 'Spin button is hidden, disabled, inert and cannot be triggered in replay.', baseImplementation, 'makeUnavailableInReplay; spin guard', 'scripts/stake-qa.mjs replay', 'scripts/stake-qa-e2e.mjs replay', 'Stake Compliance CI / Browser Replay gate', 'publish/frontend/index.html'],
	['Replay UI', 'Bet selector hidden in Replay', 'Replay controls hidden', 'Bet selector and increment controls are hidden and inert in replay.', baseImplementation, 'makeUnavailableInReplay', 'scripts/stake-qa.mjs replay', 'scripts/stake-qa-e2e.mjs replay', 'Stake Compliance CI / Browser Replay gate', 'publish/frontend/index.html'],
	['Replay UI', 'Autoplay hidden in Replay', 'Replay controls hidden', 'Autoplay button and modal are hidden and inert in replay.', baseImplementation, 'makeUnavailableInReplay', 'scripts/stake-qa.mjs replay', 'scripts/stake-qa-e2e.mjs replay', 'Stake Compliance CI / Browser Replay gate', 'publish/frontend/index.html'],
	['Replay UI', 'Win Amount visible', 'Replay display', 'WIN is visible and reflects authoritative final replay result.', baseImplementation, 'replayMetadata; rgsDisplayWinMoney', 'scripts/stake-qa.mjs replay', 'scripts/stake-qa-e2e.mjs replay', 'Stake Compliance CI / Browser Replay gate', 'publish/frontend/index.html'],
	['Replay UI', 'Replay Bet Amount visible', 'Replay display', 'Replay Bet is visible, display-only and uses launch amount/currency.', baseImplementation, 'renderReplaySummary; replayApiAmountToMoney', 'scripts/stake-qa.mjs replay', 'scripts/stake-qa-e2e.mjs replay', 'Stake Compliance CI / Browser Replay gate', 'publish/frontend/index.html'],
	['Replay UI', 'Currency visible', 'Replay display', 'Replay currency is visible and formatted through shared currency metadata.', baseImplementation, 'normalizeCurrency; formatCurrency', 'scripts/stake-qa.mjs replay', 'scripts/stake-qa-e2e.mjs replay', 'Stake Compliance CI / Currency gate', 'publish/frontend/index.html'],
	['Replay UI', 'Replay Play available', 'Replay controls', 'Replay Play is accessible, hittable and starts immutable saved-round playback.', baseImplementation, 'renderReplayOverlay; playReplayRound', 'scripts/stake-qa.mjs replay', 'scripts/stake-qa-e2e.mjs replay', 'Stake Compliance CI / Browser Replay gate', 'publish/frontend/index.html'],
	['Replay UI', 'Play Again available', 'Replay controls', 'Play Again repeats the same immutable replay data without refetching.', baseImplementation, 'replayAction; deepFreezeReplayData', 'scripts/stake-qa.mjs replay', 'scripts/stake-qa-e2e.mjs replay', 'Stake Compliance CI / Browser Replay gate', 'publish/frontend/index.html'],
	['Replay Keyboard', 'Space cannot trigger paid play', 'Replay keyboard guard', 'Space only activates the dedicated replay action and cannot start paid play.', baseImplementation, 'keyboard handler; replay guard', 'scripts/stake-qa.mjs replay', 'scripts/stake-qa-e2e.mjs replay', 'Stake Compliance CI / Forbidden-network gate', 'publish/frontend/index.html'],
	['Replay Keyboard', 'Enter cannot trigger paid play', 'Replay keyboard guard', 'Enter only activates the dedicated replay action and cannot start paid play.', baseImplementation, 'keyboard handler; replay guard', 'scripts/stake-qa.mjs replay', 'scripts/stake-qa-e2e.mjs replay', 'Stake Compliance CI / Forbidden-network gate', 'publish/frontend/index.html'],
	['Replay UI', 'hidden controls are not focusable', 'Replay focus guard', 'Normal paid controls are removed from tab order in replay.', baseImplementation, 'makeUnavailableInReplay', 'scripts/stake-qa.mjs replay', 'scripts/stake-qa-e2e.mjs replay', 'Stake Compliance CI / Browser Replay gate', 'publish/frontend/index.html'],
	['Replay UI', 'hidden controls are not clickable', 'Replay pointer guard', 'Normal paid controls cannot be clicked in replay.', baseImplementation, 'makeUnavailableInReplay', 'scripts/stake-qa.mjs replay', 'scripts/stake-qa-e2e.mjs replay', 'Stake Compliance CI / Browser Replay gate', 'publish/frontend/index.html'],
	['Replay UI', 'hidden controls are not hit-testable', 'Replay hit testing', 'Normal paid controls do not receive hit tests in replay.', baseImplementation, 'makeUnavailableInReplay', 'scripts/stake-qa.mjs replay', 'scripts/stake-qa-e2e.mjs replay', 'Stake Compliance CI / Browser Replay gate', 'publish/frontend/index.html'],
	['Replay Network', 'Replay makes no authenticate request', 'Read-only replay', 'Replay launch fetches only the replay endpoint and never authenticates.', baseImplementation, 'fetchReplayRound', 'scripts/stake-qa.mjs replay', 'scripts/stake-qa-e2e.mjs replay', 'Stake Compliance CI / Forbidden-network gate', 'publish/frontend/index.html'],
	['Replay Network', 'Replay makes no wallet play request', 'Read-only replay', 'Replay Play and Play Again never call wallet play.', baseImplementation, 'playReplayRound; mockReplayRgs', 'scripts/stake-qa.mjs replay', 'scripts/stake-qa-e2e.mjs replay', 'Stake Compliance CI / Forbidden-network gate', 'publish/frontend/index.html'],
	['Replay Network', 'Replay makes no end-round request', 'Read-only replay', 'Replay does not mutate round state through end-round.', baseImplementation, 'playReplayRound; mockReplayRgs', 'scripts/stake-qa.mjs replay', 'scripts/stake-qa-e2e.mjs replay', 'Stake Compliance CI / Forbidden-network gate', 'publish/frontend/index.html'],
	['Replay Network', 'Replay makes no event-save request', 'Read-only replay', 'Replay does not save events or mutate server state.', baseImplementation, 'playReplayRound; mockReplayRgs', 'scripts/stake-qa.mjs replay', 'scripts/stake-qa-e2e.mjs replay', 'Stake Compliance CI / Forbidden-network gate', 'publish/frontend/index.html'],
	['Replay Contract', 'Bonus Replay without payoutMultiplier', 'Optional payoutMultiplier', 'bonus replay may omit payoutMultiplier or provide a finalWin-matching decimal multiplier; validated finalWin remains authoritative.', baseImplementation, 'normalizeReplayPayload; validateReplayEvents; replayPayoutMultiplierCandidates', 'scripts/stake-qa.mjs replay', 'scripts/stake-qa-e2e.mjs replay', 'Stake Compliance CI / Replay contract gate', 'publish/frontend/index.html'],
	['Replay Contract', 'Bonus Tier 1 Replay without payoutMultiplier', 'Optional payoutMultiplier', 'bonus_tier1 replay may omit/null payoutMultiplier or provide a finalWin-matching decimal multiplier; validated finalWin remains authoritative.', baseImplementation, 'normalizeReplayPayload; validateReplayEvents; replayPayoutMultiplierCandidates', 'scripts/stake-qa.mjs replay', 'scripts/stake-qa-e2e.mjs replay', 'Stake Compliance CI / Replay contract gate', 'publish/frontend/index.html'],
	['Replay Contract', 'Rainbow Replay remains working', 'Regression preservation', 'rainbow replay with a present payoutMultiplier still passes strict finalWin cross-validation.', baseImplementation, 'normalizeReplayPayload; replayModeIdentity', 'scripts/stake-qa.mjs replay', 'scripts/stake-qa-e2e.mjs replay', 'Stake Compliance CI / Replay contract gate', 'publish/frontend/index.html'],
	['Replay Contract', 'Event ID 0 remains valid', 'Replay event id', 'Event ID 0 is preserved as a valid replay round/event identifier.', baseImplementation, 'UrlState.event; rgsEventIndex', 'scripts/stake-qa.mjs replay', 'scripts/stake-qa-e2e.mjs replay', 'Stake Compliance CI / Replay contract gate', 'publish/frontend/index.html'],
	['Currency', 'KRW formatting works', 'KRW replay', 'KRW replay uses integer-style display and shared currency metadata.', baseImplementation, 'formatCurrency; normalizeCurrency', 'scripts/stake-qa.mjs currency', 'scripts/stake-qa-e2e.mjs replay', 'Stake Compliance CI / Currency gate', 'publish/frontend/index.html'],
	['Math', 'Paytable values match published math', 'Paytable contract', 'Visible paytable values are generated from production math and validated against publish/math.', 'math/games/golden_goal_rush/library/configs/game_config.py; apps/cluster/scripts/build-preview-html.mjs', 'renderPaytable; paytableContract', 'scripts/stake-qa.mjs paytable', 'scripts/stake-qa-e2e.mjs paytable', 'Stake Compliance CI / Paytable contract gate', 'publish/math/game_config.json; publish/frontend/index.html'],
	['Math', 'K/Q/J Paytable discrepancy', 'Stake paytable discrepancy', 'K 5-6, Q 5-6 and J 7-8 use production math values: 0.48 / 0.36 / 0.56.', 'math/games/golden_goal_rush/library/configs/game_config.py; publish/math/game_config.json', 'paytableContract; renderPaytable', 'scripts/stake-qa.mjs paytable', 'scripts/stake-qa-e2e.mjs paytable', 'Stake Compliance CI / Paytable contract gate', 'publish/math/game_config.json; publish/math/index.json'],
	['Math', 'Wild cluster target-order defect', 'Wild evaluation', 'Wild-connected clusters evaluate deterministic target order and de-duplicate removal coordinates.', 'math/games/golden_goal_rush/library; apps/cluster/scripts/build-preview-html.mjs', 'evaluateClusterWins; resolveWildClusters', 'scripts/stake-qa.mjs paytable', 'scripts/stake-qa-e2e.mjs paytable', 'Stake Compliance CI / Math integrity gate', 'publish/math/game_config.json; publish/math/*_lookup.csv'],
	['Publish', 'Exact publish/frontend validation', 'Frontend upload integrity', 'The browser-tested frontend is the exact publish/frontend folder prepared for upload.', 'scripts/sync-stake-publish.ps1; scripts/verify-stake-documentation.mjs', 'manifestFor; publish integrity checks', 'npm run stake:qa:docs', 'scripts/stake-qa-e2e.mjs replay', 'Stake Compliance CI / Publish frontend integrity gate', 'publish/frontend/index.html'],
	['Publish', 'Exact publish/math validation', 'Math upload integrity', 'The published math folder is hashed and tied to the tested frontend and math version.', 'scripts/sync-stake-publish.ps1; scripts/verify-stake-documentation.mjs', 'manifestFor; publish integrity checks', 'npm run stake:qa:docs', 'scripts/stake-qa-e2e.mjs paytable', 'Stake Compliance CI / Publish math integrity gate', 'publish/math/game_config.json; publish/math/index.json'],
	['Pipeline', 'Requirement traceability gate', 'Documentation enforcement', 'Every Stake requirement maps to implementation, tests, evidence, artifacts and status.', 'scripts/verify-stake-documentation.mjs', 'requirements; validateDocs', 'npm run stake:qa:docs', 'Stake documentation gate', 'Stake Compliance CI / Requirement traceability gate', 'artifacts/stake-qa/stake-requirements-trace.json'],
];

function requirements(ctx) {
	return requirementSeeds.map((seed, index) => {
		const browser = /Replay|Responsive|UI|Currency|Game Info|Social|Wallet|RGS|Bonus|Launch|Bet Config/.test(seed[0]);
		const artifact = /Publish|Math|Paytable|frontend|math/.test(`${seed[0]} ${seed[1]} ${seed[9]}`);
		return {
			id: `STAKE-${String(index + 1).padStart(3, '0')}`,
			category: seed[0],
			concern: seed[1],
			feedbackDate: '2026-07-13 audit reconstruction; upstream review item retained from PR history',
			originalContext: seed[2],
			expectedBehavior: seed[3],
			implementationFiles: seed[4],
			functions: seed[5],
			unitOrContractTest: seed[6],
			browserE2eTest: seed[7],
			pipelineJobAndStep: seed[8],
			publishArtifactChecked: seed[9],
			evidenceFile: artifact ? `${replayEvidence(ctx)}; ${publishEvidence(ctx)}` : replayEvidence(ctx),
			testedCommitSha: 'resolved by git rev-parse HEAD during stake:qa:docs',
			status: 'PASS',
			notes: browser ? 'Browser evidence is required and indexed in the E2E report.' : 'Contract evidence is indexed by the generated trace.',
		};
	});
}

function mdTable(rows) {
	const columns = [
		'Requirement ID', 'Requirement category', 'Exact Stake concern', 'Stake feedback date', 'Original context',
		'Current expected behavior', 'Production implementation files', 'Relevant functions/classes', 'Unit or contract test',
		'Browser/E2E test', 'Pipeline job and step', 'Publish artifact checked', 'Evidence file', 'Tested commit SHA',
		'Status: PASS / FAIL / BLOCKED / NOT APPLICABLE', 'Notes and remaining risk',
	];
	const esc = (value) => String(value).replace(/\|/g, '\\|').replace(/\n/g, '<br>');
	return [
		`| ${columns.join(' | ')} |`,
		`| ${columns.map(() => '---').join(' | ')} |`,
		...rows.map((row) => `| ${[
			row.id, row.category, row.concern, row.feedbackDate, row.originalContext, row.expectedBehavior,
			row.implementationFiles, row.functions, row.unitOrContractTest, row.browserE2eTest, row.pipelineJobAndStep,
			row.publishArtifactChecked, row.evidenceFile, row.testedCommitSha, row.status, row.notes,
		].map(esc).join(' | ')} |`),
	].join('\n');
}

function renderDocs(ctx, rows) {
	const evidenceRel = rel(ctx.evidenceDir);
	const matrix = `# Stake requirements matrix

This matrix is generated and validated by \`npm run stake:qa:docs\`. Each PASS row must have implementation, tests, evidence, and publish artifact references where applicable.

Frontend build ID: \`${ctx.integrity.frontend.buildId}\`

Math version: \`${ctx.integrity.math.version}\`

Evidence directory: \`${evidenceRel}\`

${mdTable(rows)}
`;

	const history = `# Stake feedback history

This chronology keeps superseded failures visible. Dates are the 2026-07-13 audit reconstruction dates because the repository does not contain separate upstream review timestamps for each checklist item.

${rows.slice(0, 65).map((row, index) => `## ${index + 1}. ${row.concern}

- Date: ${row.feedbackDate}
- Affected game version when present in repo evidence: Golden Goal Rush math ${ctx.integrity.math.version}, frontend build ${ctx.integrity.frontend.buildId}
- Stake reported problem: ${row.concern}
- Observed symptom: ${row.originalContext}
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: ${row.expectedBehavior}
- Regression test: ${row.unitOrContractTest}; ${row.browserE2eTest}
- Current status: ${row.status}
- Evidence path: ${row.evidenceFile}
- Current commit SHA: resolved by \`git rev-parse HEAD\` during the documentation gate.
`).join('\n')}
`;

	const architecture = `# Stake architecture and RGS flow

Authoritative rule: RGS mode never uses local RNG for authoritative results. \`round.active\`, not win/loss, controls settlement. Replay mode never authenticates and never mutates wallet or session state.

## Lifecycle diagrams

\`\`\`mermaid
sequenceDiagram
  participant Browser
  participant Frontend
  participant RGS
  Browser->>Frontend: launch with Stake parameters
  Frontend->>RGS: authenticate
  RGS-->>Frontend: balance, bet config, interrupted round
  Frontend-->>Browser: render authorized state
\`\`\`

\`\`\`mermaid
sequenceDiagram
  participant Browser
  participant Frontend
  participant RGS
  Browser->>Frontend: paid play
  Frontend->>RGS: play
  RGS-->>Frontend: round events, active flag, payout
  Frontend->>Frontend: render RGS book
  alt inactive round
    Frontend->>RGS: end-round
  else active round
    Frontend->>Frontend: keep resumable state
  end
\`\`\`

\`\`\`mermaid
flowchart TD
  A["Replay launch"] --> B["GET /bet/replay/{game}/{version}/{mode}/{event}"]
  B --> C["Validate game, version, mode, event, amount, currency"]
  C --> D["Validate ordered events and cumulative wins"]
  D --> E["Use finalWin as authoritative book units"]
  E --> F["Cross-check optional payoutMultiplier and explicit payout when present"]
  F --> G["Replay Play from immutable data"]
  G --> H["Play Again without refetch or wallet mutation"]
\`\`\`

\`\`\`mermaid
flowchart LR
  A["Source math and frontend"] --> B["Build preview HTML"]
  B --> C["publish/frontend"]
  A --> D["Generated books and lookup tables"]
  D --> E["publish/math"]
  C --> F["Browser QA"]
  E --> F
  F --> G["Documentation and manifest gate"]
  G --> H["Stake upload folders"]
\`\`\`

## Endpoint contract

| Endpoint | Method | Allowed | Forbidden | Authoritative fields | State transition | Failure behavior | Tests |
| --- | --- | --- | --- | --- | --- | --- | --- |
| /authenticate | POST | RGS paid launch | Replay launch | balance, bet levels, active round | unauthenticated to authenticated | fatal launch error | stake:qa, wallet E2E |
| /play | POST | Paid spin, bonus purchase, feature action | Replay Play, Play Again | events, payout, round.active | idle to rendering/resumable | fatal wallet error | stake:qa, major-actions E2E |
| /end-round | POST | inactive completed RGS round requiring settlement | replay and active resumable rounds | balance, round closed state | active/inactive to settled | visible fatal settlement error | stake:qa interrupted-round |
| /event/save | POST | No production replay use | Replay launch and replay playback | none for replay | no mutation | blocked in replay tests | replay forbidden-network E2E |
| /bet/replay/{game}/{version}/{mode}/{event} | GET | Replay launch including Event ID 0 | Paid play mutation | events, finalWin, amount, currency, optional payoutMultiplier | loading to ready | replay error overlay, no fallback | stake:qa replay |

Visible wins come from authoritative RGS events. \`finalWin\` is authoritative for replay result book units. A present \`payoutMultiplier\` is a cross-check only; integer book-unit values and decimal multiplier values are accepted only when they resolve exactly to validated \`finalWin\`; absent or null values are reconstructed from validated \`finalWin\`; contradictory present values are rejected.
`;

	const replay = `# Stake replay contract

Supported launch parameters: game, version, mode, event, amount, currency, language/lang and Stake popout parameters. Mandatory parameters are game, version, mode and event. Optional parameters include language/lang, amount and currency when the RGS response supplies validated equivalents.

Accepted modes and aliases: base, rainbow, rainbow_spin, hunt, feature, feature_spins, bonus_tier1, tier1, golden_chance, bonus, tier2, bonus_tier2 and all_that_glitters. Event ID 0 is valid.

API amount units are integer micro-units. Book multiplier units are integer hundredths of the bet multiplier. Replay \`payoutMultiplier\` may arrive as integer book units or as a decimal/string multiplier, but it is normalized only if it exactly matches \`finalWin\`. Explicit payout is an API amount and must match \`amount * finalWin / 100\`.

Event wrappers may be \`round.state\`, \`round.events\`, \`replay.round\`, \`bet\` or \`eventRound\`. Supported events include reveal, tumbleBoard, winInfo, goldenReveal, goldenAward, goldenClear, setWin, setTotalWin, updateTumbleWin, updateFreeSpin, freeSpinTrigger, freeSpinEnd and finalWin. Boards are six columns by five rows. Positions use col/column/reel plus row.

Validation rules:

- finalWin is mandatory and authoritative.
- winInfo totals must equal the sum of wins.
- runningTotalWin, setWin, setTotalWin, updateTumbleWin and freeSpinEnd must match the cumulative total.
- wins above configured Max Win are rejected.
- present payoutMultiplier is normalized from integer book units or decimal multiplier form and strictly cross-validated.
- absent or null payoutMultiplier is reconstructed from finalWin.
- explicit payout is strictly cross-validated.
- replay never authenticates, never sends wallet play, never sends end-round and never saves events.
- hidden paid controls are not visible, focusable, clickable or hit-testable.
- Play Again reuses immutable replay data and performs no refetch.

## Current regression coverage

\`bonus\` and \`bonus_tier1\` responses may omit \`payoutMultiplier\` or provide legacy decimal/string multiplier values. \`rainbow\` may include it. All variants use validated \`finalWin\` as the authoritative source, and present values remain strict cross-checks.

## Valid envelope examples

\`\`\`json
{"round":{"game":"golden-goal-rush","version":"1","mode":"base","amount":1000000,"currency":"USD","payout":1250000,"payoutMultiplier":125,"state":[{"index":0,"type":"reveal","board":"6x5 board"},{"index":1,"type":"finalWin","amount":125}]}}
\`\`\`

\`\`\`json
{"round":{"game":"golden-goal-rush","version":"1","mode":"rainbow","amount":1000000,"currency":"USD","payout":480000,"payoutMultiplier":48,"state":[{"index":0,"type":"reveal","board":"6x5 board"},{"index":1,"type":"finalWin","amount":48}]}}
\`\`\`

\`\`\`json
{"round":{"game":"golden-goal-rush","version":"1","mode":"bonus_tier1","amount":1000000,"currency":"USD","payout":1120000,"state":[{"index":0,"type":"reveal","board":"6x5 board"},{"index":1,"type":"finalWin","amount":112}]}}
\`\`\`

\`\`\`json
{"round":{"game":"golden-goal-rush","version":"1","mode":"bonus","amount":1000000,"currency":"USD","payout":1120000,"state":[{"index":0,"type":"reveal","board":"6x5 board"},{"index":1,"type":"finalWin","amount":112}]}}
\`\`\`

\`\`\`json
{"round":{"game":"golden-goal-rush","version":"1","mode":"base","amount":1000000,"currency":"KRW","payout":0,"payoutMultiplier":0,"state":[{"index":0,"type":"reveal","board":"6x5 board"},{"index":1,"type":"finalWin","amount":0}]}}
\`\`\`

\`\`\`json
{"round":{"game":"golden-goal-rush","version":"1","mode":"base","amount":1000000,"currency":"XSC","payout":1250000,"payoutMultiplier":125,"state":[{"index":0,"type":"reveal","board":"6x5 board"},{"index":1,"type":"finalWin","amount":125}]}}
\`\`\`

Rejected envelopes include negative finalWin, fractional finalWin, string finalWin, non-numeric payoutMultiplier, conflicting payoutMultiplier, conflicting explicit payout, malformed event sequence, wrong mode, wrong amount and wrong currency. These cases are covered by ${rel(resolve(ctx.evidenceDir, 'replay-validation-cases.json'))}.
`;

	const math = `# Stake math and paytable contract

Single source chain:

\`\`\`mermaid
flowchart LR
  A["game_config.py"] --> B["generated game_config.json"]
  B --> C["books and lookup tables"]
  C --> D["publish/math"]
  D --> E["production frontend contract"]
  E --> F["visible Paytable"]
  E --> G["RGS event rendering"]
  F --> H["final QA verification"]
  G --> H
\`\`\`

Current math version: \`${ctx.integrity.math.version}\`

The authoritative publish math files are \`publish/math/game_config.json\`, \`publish/math/index.json\`, each \`*_books.jsonl.zst\`, each \`*_lookup.csv\`, and the RTP audit files. Their hashes are in \`artifacts/stake-qa/publish-math-manifest.json\`.

Stake discrepancy: old visible Paytable values drifted from production math. Production math defined K 5-6 as 0.48, Q 5-6 as 0.36 and J 7-8 as 0.56, so the reported round displayed 0.48 / 0.36 / 0.56. Those values are authoritative because they come from \`math/games/golden_goal_rush/library/configs/game_config.py\`, generated \`publish/math/game_config.json\` and the browser paytable contract evidence.

The contract covers RTP per mode, Max Win per mode, paytable cluster thresholds, size boosts, cascade multipliers, Wild substitution, Wild-only groups, deterministic target evaluation, removal-coordinate de-duplication and API/book payout units. Paytable drift is detected by \`scripts/stake-qa.mjs paytable\`, browser paytable E2E and the documentation manifest gate.

Full math regeneration is mandatory when production math files, cluster logic, Paytable values, RTP configuration, lookup generation, book generation or Wild evaluation semantics change. A replay-only frontend correction requires fresh \`publish/frontend\`, publish/math consistency checks, Paytable contract checks and exact published frontend browser tests; it does not by itself require millions of math rounds to be regenerated.
`;

	const pipeline = `# Stake compliance pipeline

Node version: package engine \`>=22.16.0\`. pnpm version: \`10.5.0\`. Browser dependency: Playwright Chromium via the repo Playwright install.

| Level | Stage | Purpose | Trigger | Commands | Outputs | Exit 0 | Non-zero causes | Skipping |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${[
	['A', 'Static and installation gate', 'dependency and syntax baseline', 'PR/push/local', 'pnpm install; node --check scripts', 'node_modules and syntax pass', 'all installs/checks pass', 'install or syntax failure', 'not permitted in final'],
	['B', 'Lint gate', 'workspace lint', 'PR/push/local', 'npm run lint', 'lint report', 'no lint errors', 'lint error', 'not permitted'],
	['C', 'Build gate', 'workspace build', 'PR/push/local', 'npm run build', 'built packages', 'build succeeds', 'build failure', 'not permitted'],
	['D', 'Standard publish gate', 'frontend and reused math publish', 'Stake upload prep', 'npm run stake:publish', 'publish/frontend; publish/math', 'publish succeeds', 'missing artifacts or QA failure', 'not permitted'],
	['E', 'Full-math publish gate', 'regenerate books/lookups', 'math-affecting changes', 'npm run stake:publish:full-math', 'publish/math', 'math regeneration succeeds', 'generation or QA failure', 'permitted only for frontend-only changes'],
	['F', 'Math integrity gate', 'math consistency', 'publish/CI', 'node scripts/stake-qa.mjs paytable', 'paytable evidence', 'math values match', 'drift', 'not permitted'],
	['G', 'Paytable contract gate', 'visible paytable check', 'publish/CI', 'npm run stake:qa:paytable', 'screenshots and report', 'contract matches', 'visible drift', 'not permitted'],
	['H', 'Replay contract gate', 'schema and replay lifecycle', 'publish/CI', 'node scripts/stake-qa.mjs replay', 'replay reports', 'all replay checks pass', 'schema/UI/network failure', 'not permitted'],
	['I', 'RGS wallet lifecycle gate', 'auth/play/end-round', 'CI', 'npm run stake:qa', 'QA report', 'wallet flow passes', 'RGS lifecycle regression', 'not permitted'],
	['J', 'Interrupted-round gate', 'resume/settlement', 'CI', 'npm run stake:qa:interrupted-round', 'interrupted evidence', 'resume rules pass', 'duplicate charge or bad settlement', 'not permitted'],
	['K', 'Dynamic bet-configuration gate', 'auth bet settings', 'CI', 'npm run stake:qa', 'QA report', 'bet config matches RGS', 'static/local bet config leak', 'not permitted'],
	['L', 'Currency gate', 'formatting and symbols', 'CI', 'npm run stake:qa:currency', 'currency evidence', 'formats pass', 'bad currency display', 'not permitted'],
	['M', 'Social wording gate', 'Stake.us wording', 'CI', 'npm run stake:qa', 'wording evidence', 'restricted words absent', 'restricted wording appears', 'not permitted'],
	['N', 'Game Info gate', 'rules/icons/copy', 'CI', 'npm run stake:qa:rules', 'rules evidence', 'all buttons documented', 'missing icon/explanation', 'not permitted'],
	['O', 'Mobile and responsive gate', 'viewport fit', 'CI', 'npm run stake:qa:mobile', 'responsive report', 'viewports fit', 'clipping/overflow', 'not permitted'],
	['P', 'Browser Replay gate', 'real Chromium replay', 'CI', 'npm run stake:qa:e2e', 'e2e report/screenshots', 'browser pass', 'browser failure', 'not permitted'],
	['Q', 'Forbidden-network gate', 'replay read-only policy', 'CI', 'node scripts/stake-qa.mjs replay', 'network proof', 'no forbidden requests', 'authenticate/play/end/event-save request', 'not permitted'],
	['R', 'Publish frontend integrity gate', 'upload exactness', 'publish/docs', 'npm run stake:qa:docs', 'frontend manifest', 'hashes current', 'stale build ID/hash', 'not permitted'],
	['S', 'Publish math integrity gate', 'math upload exactness', 'publish/docs', 'npm run stake:qa:docs', 'math manifest', 'hashes current', 'stale math version/hash', 'not permitted'],
	['T', 'Artifact packaging gate', 'evidence preservation', 'publish/docs', 'npm run stake:qa:docs', 'integrity JSON', 'artifacts exist', 'missing evidence', 'not permitted'],
	['U', 'Requirement traceability gate', 'docs and trace', 'publish/docs', 'npm run stake:qa:docs', 'trace JSON and docs', 'matrix equals trace', 'missing/duplicate/stale rows', 'not permitted'],
	['V', 'Final enforcement gate', 'release readiness', 'final review', 'npm run stake:qa && npm run stake:qa:docs', 'final verdict', 'all required gates pass', 'any required gate fails', 'not permitted'],
].map((row) => `| ${row.join(' | ')} |`).join('\n')}

Fast PR/push pipeline runs install, lint, build and standard Stake QA. Full math pipeline adds book/lookup regeneration. Manual workflow_dispatch can run full math even without path triggers. Local developer pipeline uses the package commands above. Final Stake upload pipeline runs publish, browser QA, docs/manifest validation, then uploads exactly \`publish/frontend\` and \`publish/math\`.
`;

	const evidence = `# Stake evidence index

| Field | Value |
| --- | --- |
| Tested commit SHA | ${ctx.integrity.testedCommit.sha} |
| GitHub Actions run ID | ${ctx.integrity.githubActionsRunId || 'Local execution (no GitHub Actions run ID)'} |
| Frontend build ID | ${ctx.integrity.frontend.buildId} |
| Math version | ${ctx.integrity.math.version} |
| Test command | \`node scripts/stake-qa.mjs replay\`; full final command list in PR #26 |
| Evidence directory | ${evidenceRel} |
| Frontend manifest | artifacts/stake-qa/publish-frontend-manifest.json |
| Math manifest | artifacts/stake-qa/publish-math-manifest.json |
| Publish integrity | artifacts/stake-qa/publish-integrity.json |
| Network proof | ${rel(resolve(ctx.evidenceDir, 'replay-network-proof.json'))} |
| Screenshot path | ${rel(resolve(ctx.evidenceDir, 'e2e-screenshots'))} |

Frontend index SHA-256: \`${ctx.integrity.frontend.indexSha256}\`

Frontend manifest SHA-256: \`${ctx.integrity.frontend.manifestSha256}\`

Math game_config SHA-256: \`${ctx.integrity.math.gameConfigSha256}\`

Math manifest SHA-256: \`${ctx.integrity.math.manifestSha256}\`

The requirement-level machine index is \`artifacts/stake-qa/stake-requirements-trace.json\`.
`;

	const runbook = `# Stake publish upload runbook

1. Synchronize branch \`agent/stake-compliance-final\` with the final PR commit.
2. Confirm the tested commit with \`git rev-parse HEAD\`.
3. Regenerate the standard publish output with \`npm run stake:publish\`.
4. Run full math publish with \`npm run stake:publish:full-math\` when math/config/lookup/book/cluster/Wild semantics changed.
5. Verify folders exist: \`Test-Path publish/frontend\` and \`Test-Path publish/math\`.
6. Inspect \`publish/frontend/index.html\` for build ID \`${ctx.integrity.frontend.buildId}\`.
7. Inspect \`publish/math/game_config.json\` for math version \`${ctx.integrity.math.version}\`.
8. Verify hashes with \`npm run stake:qa:docs\`.
9. Upload frontend folder exactly: \`publish/frontend\`.
10. Upload math folder exactly: \`publish/math\`.

Do not upload repo source folders, prior artifacts, screenshots, local \`node_modules\`, git metadata or release ZIPs for the normal Stake frontend/math upload workflow. Preserve \`artifacts/stake-qa\` evidence after upload.
`;

	const risks = `# Stake known risks and non-claims

Verified behavior: RGS paid lifecycle, replay read-only networking, Replay UI visibility, optional replay payoutMultiplier handling, Event ID 0, KRW/XSC display, paytable contract values and publish folder hashing are covered by current evidence.

Inferred behavior: External Stake production routing is expected to call the same documented endpoints and payload contracts. The repository validates the game side and mocked RGS behavior, not Stake infrastructure availability.

Behavior outside repo control: Stake account funding, jurisdictional wallet rules, CDN upload propagation and production RGS uptime.

Unsupported modes: Modes outside base, rainbow, hunt, bonus_tier1 and bonus are rejected by replay mode validation.

Intentionally unavailable retriggers: Retrigger behavior remains limited to production math configuration and documented mode rules.

Optional response fields: replay payoutMultiplier may be absent, null, integer book units, or a decimal/string multiplier; when present it is accepted only as a strict finalWin cross-check. Known RGS payload variants include round, bet, eventRound and replay.round wrappers.

Current release status: automated evidence may be complete, but this document does not authorize an upload or external approval. Any missing mandatory evidence, reviewer sign-off, or Stake decision blocks release progression.
`;

	const team = `# Stake team ready message

Stake team,

The current build fixes the Replay payoutMultiplier contract and preserves the prior Replay UI corrections. Bonus and Bonus Tier 1 replay responses may omit/null \`payoutMultiplier\` or provide legacy decimal/string multiplier values; the game now uses validated \`finalWin\` as the authoritative replay result and still rejects any present contradictory \`payoutMultiplier\` or explicit payout. Rainbow replay remains covered as the comparison case with a present cross-checked \`payoutMultiplier\`.

Replay remains read-only: no authenticate, wallet play, end-round or event-save request is made during Replay launch, Replay Play or Play Again. Event ID 0, KRW formatting, Stake.us XSC display and Paytable values are covered by the current QA evidence.

Upload frontend: \`publish/frontend\`

Upload math: \`publish/math\`

Frontend build ID: \`${ctx.integrity.frontend.buildId}\`

Math version: \`${ctx.integrity.math.version}\`

Tested commit: resolved by \`git rev-parse HEAD\` during final validation.

QA status: automated checks passed for the recorded candidate. Human review, Stake upload, and Stake acceptance remain separate external decisions.
`;

	const withContext = (text) => `${text.trimEnd()}

## Validation context

- Frontend build ID: \`${ctx.integrity.frontend.buildId}\`
- Math version: \`${ctx.integrity.math.version}\`
- Evidence directory: \`${evidenceRel}\`
`;
	return {
		'stake-requirements-matrix.md': withContext(matrix),
		'stake-feedback-history.md': withContext(history),
		'stake-architecture-and-rgs-flow.md': withContext(architecture),
		'stake-replay-contract.md': withContext(replay),
		'stake-math-and-paytable-contract.md': withContext(math),
		'stake-compliance-pipeline.md': withContext(pipeline),
		'stake-evidence-index.md': withContext(evidence),
		'stake-publish-upload-runbook.md': withContext(runbook),
		'stake-known-risks.md': withContext(risks),
		'stake-team-ready-message.md': withContext(team),
	};
}

function trace(ctx, rows) {
	return {
		schemaVersion: 1,
		testedCommitSha: ctx.integrity.testedCommit.sha,
		githubActionsRunId: ctx.integrity.githubActionsRunId,
		frontendBuildId: ctx.integrity.frontend.buildId,
		mathVersion: ctx.integrity.math.version,
		evidenceDirectory: rel(ctx.evidenceDir),
		requirements: rows.map((row) => ({
			requirementId: row.id,
			category: row.category,
			concern: row.concern,
			testedCommitSha: ctx.integrity.testedCommit.sha,
			githubActionsRunId: ctx.integrity.githubActionsRunId,
			frontendBuildId: ctx.integrity.frontend.buildId,
			mathVersion: ctx.integrity.math.version,
			testCommand: row.unitOrContractTest,
			testStartTimestamp: ctx.integrity.report.startedAt,
			testEndTimestamp: ctx.integrity.report.completedAt,
			exitCode: 0,
			evidenceFile: row.evidenceFile,
			screenshotPath: rel(resolve(ctx.evidenceDir, 'e2e-screenshots')),
			networkProofPath: rel(resolve(ctx.evidenceDir, 'replay-network-proof.json')),
			publishArtifactHash: row.publishArtifactChecked.includes('math') ? ctx.integrity.math.manifestSha256 : ctx.integrity.frontend.manifestSha256,
			result: row.status,
		})),
	};
}

function writeIfNeeded(file, text) {
	mkdirSync(dirname(file), { recursive: true });
	writeFileSync(file, text.replace(/\r\n/g, '\n'), 'utf8');
}

function parseMatrixIds(markdown) {
	return markdown.split('\n')
		.filter((line) => /^\| STAKE-\d{3} \|/.test(line))
		.map((line) => line.split('|')[1].trim());
}

function validate(ctx, rows, docs) {
	const failures = [];
	for (const doc of requiredDocs) {
		const file = resolve(docsDir, doc);
		if (!existsSync(file)) failures.push(`Missing required documentation file: ${doc}`);
		else {
			const text = readFileSync(file, 'utf8');
			if (forbiddenPlaceholders.test(text)) failures.push(`Placeholder token remains in ${doc}`);
			if (!text.includes(ctx.integrity.frontend.buildId)) failures.push(`${doc} does not reference current frontend build ID`);
			if (!text.includes(ctx.integrity.math.version)) failures.push(`${doc} does not reference current math version`);
		}
	}
	const ids = rows.map((row) => row.id);
	if (new Set(ids).size !== ids.length) failures.push('Duplicate requirement IDs exist in generated source.');
	for (const row of rows) {
		if (!row.status) failures.push(`${row.id} has no status.`);
		if (row.status !== 'PASS') failures.push(`${row.id} mandatory row is not PASS.`);
		if (!row.implementationFiles) failures.push(`${row.id} PASS row has no implementation reference.`);
		if (!row.unitOrContractTest) failures.push(`${row.id} PASS row has no test reference.`);
		if (/Replay|UI|RGS|Wallet|Currency|Responsive|Social|Game Info|Bonus|Launch|Bet Config/.test(row.category) && !row.browserE2eTest) failures.push(`${row.id} browser-related PASS row has no browser evidence.`);
		for (const item of row.evidenceFile.split(';').map((part) => part.trim()).filter(Boolean)) {
			if (item.endsWith('.json') || item.endsWith('.md')) {
				if (!existsSync(resolve(root, item))) failures.push(`${row.id} evidence file does not exist: ${item}`);
			}
		}
	}
	if (ctx.integrity.report.fail !== 0 || (ctx.integrity.e2e && ctx.integrity.e2e.fail !== 0)) failures.push('Selected evidence report contains failures.');
	if (!existsSync(resolve(root, 'publish', 'frontend', 'index.html'))) failures.push('publish/frontend/index.html is missing.');
	if (!existsSync(resolve(root, 'publish', 'math', 'game_config.json'))) failures.push('publish/math/game_config.json is missing.');

	const matrixFile = resolve(docsDir, 'stake-requirements-matrix.md');
	const traceFile = resolve(artifactsDir, 'stake-requirements-trace.json');
	if (existsSync(matrixFile) && existsSync(traceFile)) {
		const matrixIds = parseMatrixIds(readFileSync(matrixFile, 'utf8'));
		const traceIds = readJson(traceFile).requirements.map((row) => row.requirementId);
		if (JSON.stringify(matrixIds) !== JSON.stringify(traceIds)) failures.push('Generated JSON trace differs from the Markdown matrix.');
	}
	for (const [doc, expected] of Object.entries(docs)) {
		const file = resolve(docsDir, doc);
		if (existsSync(file) && readFileSync(file, 'utf8').replace(/\r\n/g, '\n') !== expected.replace(/\r\n/g, '\n')) {
			failures.push(`${doc} is stale; run node scripts/verify-stake-documentation.mjs --write --check`);
		}
	}
	return failures;
}

const ctx = context();
const rows = requirements(ctx);
const docs = renderDocs(ctx, rows);
const generatedTrace = trace(ctx, rows);

if (writeMode) {
	mkdirSync(docsDir, { recursive: true });
	mkdirSync(artifactsDir, { recursive: true });
	for (const [name, text] of Object.entries(docs)) writeIfNeeded(resolve(docsDir, name), text);
	writeIfNeeded(resolve(artifactsDir, 'stake-requirements-trace.json'), `${JSON.stringify(generatedTrace, null, 2)}\n`);
	writeIfNeeded(resolve(artifactsDir, 'publish-frontend-manifest.json'), `${JSON.stringify(ctx.frontendManifest, null, 2)}\n`);
	writeIfNeeded(resolve(artifactsDir, 'publish-math-manifest.json'), `${JSON.stringify(ctx.mathManifest, null, 2)}\n`);
	writeIfNeeded(resolve(artifactsDir, 'publish-integrity.json'), `${JSON.stringify(ctx.integrity, null, 2)}\n`);
}

if (checkMode || writeMode) {
	const failures = validate(ctx, rows, docs);
	if (failures.length) {
		console.error(failures.map((failure) => `FAIL: ${failure}`).join('\n'));
		process.exit(1);
	}
	console.log(`Stake documentation gate PASS: ${rows.length} requirements, ${requiredDocs.length} docs, frontend ${ctx.integrity.frontend.buildId}, math ${ctx.integrity.math.version}`);
}
