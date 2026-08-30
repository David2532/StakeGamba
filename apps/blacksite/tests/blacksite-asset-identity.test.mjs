import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const manifestUrl = new URL('../art/asset-manifest.json', import.meta.url);

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
	assert.equal(humanConcept.supersededBy, 'product.character.penguin_vaultkeeper.v1');
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

test('production ledger requires a complete penguin Spine delivery', async () => {
	const manifest = await readManifest();
	const characterGroup = manifest.requiredProductionGroups.find((group) =>
		group.id.startsWith('character-'),
	);

	assert.deepEqual(characterGroup, {
		id: 'character-penguin-vaultkeeper-spine-4.2-rig-atlas-events-fallback',
		status: 'static-fallback-integrated-rig-pending',
	});
	assert.equal(manifest.runtimeIntegration, 'penguin-static-fallback-v1');
	assert.match(characterGroup.status, /rig-pending/u);
});
