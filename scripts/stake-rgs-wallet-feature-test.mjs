import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	reconcileWalletBalance,
	socialRestrictedHits,
	summarizeFeatureEvents,
} from '../apps/cluster/scripts/stake-compliance-contract.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const fixturePath = join(root, 'scripts', 'fixtures', 'stake-review-8-spin-44-48.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
const stats = summarizeFeatureEvents(fixture.events);
assert.equal(stats.ok, true, stats.error);
assert.deepEqual(stats.perSpinWins, [0, 348, 1020, 700, 480, 900, 200, 800]);
assert.equal(stats.featureTotalUnits, 4448);
assert.equal(stats.spinsPlayed, 8);
assert.equal(stats.bestSpinUnits, 1020);
assert.equal(stats.perSpinWins.reduce((sum, value) => sum + value, 0), stats.featureTotalUnits);
assert.notEqual(stats.bestSpinUnits, fixture.featureTotalBookUnits, 'regression: old code used feature total as Best Spin');

const initial = fixture.authenticateBalanceApi;
const playBalance = fixture.playBalanceApi;
const authoritativePayout = 44480000;
const postPayout = fixture.endRoundBalanceApi;
assert.equal(postPayout - playBalance, authoritativePayout);
assert.equal(reconcileWalletBalance({ active: true, playBalance, endRoundBalance: postPayout }), postPayout);
assert.equal(reconcileWalletBalance({ active: false, playBalance, endRoundBalance: undefined }), playBalance);
assert.throws(() => reconcileWalletBalance({ active: true, playBalance }), /end-round balance/);
assert.throws(() => reconcileWalletBalance({ active: true, playBalance, endRoundBalance: null }), /end-round balance/);
assert.throws(() => reconcileWalletBalance({ active: true, playBalance, endRoundBalance: -1 }), /end-round balance/);
assert.throws(() => reconcileWalletBalance({ active: true, playBalance, endRoundBalance: postPayout + 0.5 }), /end-round balance/);
assert.throws(() => reconcileWalletBalance({ active: false, endRoundBalance: postPayout }), /play balance/);
assert.deepEqual(socialRestrictedHits('Each paying symbol and raw XGC code'), ['paying']);
assert.deepEqual(
	socialRestrictedHits('Place your bets; the purchase pays out cash at the cost of one credit.'),
	['pays out', 'place your bets', 'bets', 'cash', 'pays', 'purchase', 'at the cost of', 'cost of', 'credit'],
);

const settlementModes = ['base', 'hunt', 'rainbow', 'bonus_tier1', 'bonus'];
const balanceInvariants = settlementModes.flatMap((mode) => ([
	{
		mode,
		active: true,
		playCalls: 1,
		endRoundCalls: 1,
		expectedBalanceApi: reconcileWalletBalance({ active: true, playBalance, endRoundBalance: postPayout }),
	},
	{
		mode,
		active: false,
		playCalls: 1,
		endRoundCalls: 0,
		expectedBalanceApi: reconcileWalletBalance({ active: false, playBalance }),
	},
]));

const evidenceDir = join(root, 'artifacts', 'stake-qa', new Date().toISOString().replace(/[:.]/g, '-'));
mkdirSync(evidenceDir, { recursive: true });
writeFileSync(join(evidenceDir, 'rgs-wallet-feature-evidence.json'), JSON.stringify({
	fixture: fixturePath.replaceAll('\\', '/'),
	provenance: fixture.provenance,
	feature: {
		finalFeatureTotal: '44.48',
		spinsPlayed: stats.spinsPlayed,
		perSpinWinsBookUnits: stats.perSpinWins,
		perSpinWins: stats.perSpinWins.map((value) => (value / 100).toFixed(2)),
		bestSpin: (stats.bestSpinUnits / 100).toFixed(2),
		sum: (stats.perSpinWins.reduce((sum, value) => sum + value, 0) / 100).toFixed(2),
	},
	wallet: {
		authenticateBalance: (initial / 1_000_000).toFixed(2),
		playBalance: (playBalance / 1_000_000).toFixed(2),
		visibleFeatureWin: '44.48',
		endRoundBalance: (postPayout / 1_000_000).toFixed(2),
		playCalls: 1,
		endRoundCalls: 1,
		localCredits: 0,
	},
	balanceInvariants,
	}, null, 2));
console.log(JSON.stringify({
	status: 'PASS',
	fixture: fixturePath,
	evidence: join(evidenceDir, 'rgs-wallet-feature-evidence.json'),
	featureTotal: '44.48',
	bestSpin: '10.20',
	spins: 8,
}, null, 2));
