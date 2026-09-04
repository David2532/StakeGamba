import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const manifestUrl = new URL('../art/asset-manifest.json', import.meta.url);
const m3ManifestUrl = new URL('../../../docs/blacksite/M3_ASSET_MANIFEST.md', import.meta.url);
const animationBibleUrl = new URL('../../../docs/blacksite/ANIMATION_BIBLE.md', import.meta.url);

const PENGUIN_SPINE_STATES = Object.freeze([
	'idle_a',
	'idle_b',
	'spin_start',
	'anticipation',
	'win_small',
	'win_medium',
	'win_big',
	'loss_acknowledge',
	'feature_tease',
	'feature_trigger',
	'bonus_idle',
	'bonus_win',
	'max_win',
	'recover',
]);

async function readManifest() {
	return JSON.parse(await readFile(manifestUrl, 'utf8'));
}

test('production identity locks the penguin and mechanical vault direction', async () => {
	const manifest = await readManifest();
	const identity = manifest.productIdentity;

	assert.equal(identity.status, 'locked');
	assert.equal(identity.characterId, 'penguin_vaultkeeper');
	assert.deepEqual(identity.themeAnchors, [
		'penguin',
		'mechanical-lock',
		'vault-door',
		'armored-security-facility',
	]);
	assert.ok(identity.forbiddenProductionDirections.includes('human-operative-side-character'));
	assert.match(identity.runtimeAuthority, /Presentation only/u);
});

test('superseded human concepts cannot become runtime assets', async () => {
	const manifest = await readManifest();
	const humanConcept = manifest.assets.find(
		(asset) => asset.id === 'concept.character.operative_spine_anchor.v1',
	);

	assert.ok(humanConcept, 'historical human concept remains traceable');
	assert.equal(humanConcept.status, 'superseded');
	assert.equal(humanConcept.supersededBy, 'product.character.penguin_vaultkeeper.fallback.v1');
	assert.equal(humanConcept.runtimeEligible, false);
	assert.equal(humanConcept.runtimePath, null);

	const activeHumanAssets = manifest.assets.filter(
		(asset) =>
			/character/u.test(asset.type) &&
			/human|operative/u.test(`${asset.id} ${asset.purpose}`) &&
			!['superseded', 'rejected'].includes(asset.status),
	);
	assert.deepEqual(activeHumanAssets, []);
});

test('all asset lifecycle records have explicit runtime eligibility and resolvable supersession', async () => {
	const manifest = await readManifest();
	const assetIds = new Set(manifest.assets.map((asset) => asset.id));

	assert.equal(assetIds.size, manifest.assets.length);
	for (const asset of manifest.assets) {
		assert.equal(typeof asset.runtimeEligible, 'boolean', `${asset.id} runtime eligibility`);
		if (asset.supersededBy) {
			assert.ok(assetIds.has(asset.supersededBy), `${asset.id} supersededBy must resolve`);
		}
		if (asset.status === 'superseded') {
			assert.ok(asset.supersededBy);
		}
	}
});

test('machine and human-readable manifests share the canonical 14-state penguin Spine contract', async () => {
	const [manifest, m3Manifest, animationBible] = await Promise.all([
		readManifest(),
		readFile(m3ManifestUrl, 'utf8'),
		readFile(animationBibleUrl, 'utf8'),
	]);

	assert.deepEqual(manifest.spineContract, {
		characterId: manifest.productIdentity.characterId,
		runtimeVersion: '4.2.x',
		semanticStates: PENGUIN_SPINE_STATES,
	});
	assert.equal(new Set(manifest.spineContract.semanticStates).size, 14);
	assert.match(m3Manifest, /all 14 semantic clips\/events/u);
	for (const state of PENGUIN_SPINE_STATES) {
		const stateToken = '`' + state + '`';
		assert.ok(m3Manifest.includes(stateToken), `${state} missing from M3 manifest`);
		assert.ok(animationBible.includes(stateToken), `${state} missing from animation bible`);
	}
});

test('production ledger requires a complete penguin Spine delivery', async () => {
	const manifest = await readManifest();
	const characterGroup = manifest.requiredProductionGroups.find((group) =>
		group.id.startsWith('character-'),
	);

	assert.deepEqual(characterGroup, {
		id: 'character-penguin-vaultkeeper-spine-4.2-rig-atlas-events-fallback',
		status: 'static-fallback-integrated-rig-pending',
	});
	assert.equal(
		manifest.runtimeIntegration,
		'penguin-static-fallback-v1+mechanical-vault-environment-v1',
	);
	assert.match(characterGroup.status, /rig-pending/u);
});
