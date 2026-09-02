import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
	pruneBlacksiteInlineBuildResidue,
	verifyBlacksiteFrontendHygiene,
} from '../../../scripts/blacksite-frontend-hygiene.mjs';

const runtimePath = 'assets/blacksite/environment/vault.webp';

function sha256(value) {
	return createHash('sha256').update(value).digest('hex');
}

function assetManifest(bytes) {
	return {
		schema: 'blacksite-asset-manifest-v1',
		rightsReview: 'pending-human-review',
		assets: [
			{
				id: 'product.environment.vault.test',
				runtimeEligible: true,
				runtimePath: `apps/blacksite/static/${runtimePath}`,
				sha256: sha256(bytes),
				status: 'production-candidate',
			},
		],
	};
}

async function makeFrontend() {
	const root = await mkdtemp(join(tmpdir(), 'blacksite-hygiene-'));
	const bytes = Buffer.from('original-vault-pixels');
	await mkdir(join(root, '_app'), { recursive: true });
	await mkdir(join(root, 'assets', 'blacksite', 'environment'), { recursive: true });
	await writeFile(
		join(root, 'index.html'),
		`<!doctype html><img src="/${runtimePath}" alt="" />`,
	);
	await writeFile(
		join(root, '_app', 'blacksite-build-identity.json'),
		'{"schema":"blacksite-frontend-build-identity-v1"}\n',
	);
	await writeFile(join(root, runtimePath), bytes);
	return { root, bytes };
}

test('exact inline frontend contains only identity and provenance-bound runtime assets', async (t) => {
	const { root, bytes } = await makeFrontend();
	t.after(() => rm(root, { recursive: true, force: true }));

	const result = verifyBlacksiteFrontendHygiene(root, assetManifest(bytes));
	assert.equal(result.result, 'PASS');
	assert.equal(result.fileCount, 3);
	assert.equal(result.runtimeAssetCount, 1);
	assert.deepEqual(result.runtimeAssetPaths, [runtimePath]);
});

test('inline build pruning removes unrequested adapter residue and keeps inert source URLs', async (t) => {
	const root = await mkdtemp(join(tmpdir(), 'blacksite-prune-'));
	t.after(() => rm(root, { recursive: true, force: true }));
	await mkdir(join(root, '_app', 'immutable'), { recursive: true });
	await writeFile(
		join(root, 'index.html'),
		'<script>new URL("_app/immutable/bundle.js", document.baseURI);</script>',
	);
	await writeFile(join(root, '_app', 'immutable', 'bundle.js'), 'export default 1;\n');
	await writeFile(join(root, '_app', 'env.js'), 'export const env = {};\n');
	await writeFile(join(root, '_app', 'version.json'), '{}\n');

	const result = pruneBlacksiteInlineBuildResidue(root);
	assert.equal(result.removedFiles, 3);
	await assert.rejects(access(join(root, '_app', 'immutable', 'bundle.js')));
	await assert.rejects(access(join(root, '_app', 'env.js')));
	await assert.rejects(access(join(root, '_app', 'version.json')));
});

test('inline build pruning refuses files loaded by static markup', async (t) => {
	const root = await mkdtemp(join(tmpdir(), 'blacksite-prune-ref-'));
	t.after(() => rm(root, { recursive: true, force: true }));
	await mkdir(join(root, '_app', 'immutable'), { recursive: true });
	await writeFile(
		join(root, 'index.html'),
		'<script src="./_app/immutable/bundle.js"></script>',
	);
	await writeFile(join(root, '_app', 'immutable', 'bundle.js'), 'export default 1;\n');

	assert.throws(
		() => pruneBlacksiteInlineBuildResidue(root),
		/Inline build markup still loads generated _app residue/u,
	);
});

test('unreferenced generated bundles fail the exact package allowlist', async (t) => {
	const { root, bytes } = await makeFrontend();
	t.after(() => rm(root, { recursive: true, force: true }));
	await mkdir(join(root, '_app', 'immutable'), { recursive: true });
	await writeFile(join(root, '_app', 'immutable', 'orphan.js'), 'export default 1;\n');

	assert.throws(
		() => verifyBlacksiteFrontendHygiene(root, assetManifest(bytes)),
		/Unexpected or missing frontend package files/u,
	);
});

test('runtime asset bytes must match their canonical provenance hash', async (t) => {
	const { root, bytes } = await makeFrontend();
	t.after(() => rm(root, { recursive: true, force: true }));
	await writeFile(join(root, runtimePath), 'modified-vault-pixels');

	assert.throws(
		() => verifyBlacksiteFrontendHygiene(root, assetManifest(bytes)),
		/Runtime asset hash mismatch/u,
	);
});

test('high-confidence secrets and source-map directives fail closed', async (t) => {
	const { root, bytes } = await makeFrontend();
	t.after(() => rm(root, { recursive: true, force: true }));
	const fakeAwsKey = ['AK', 'IA', 'ABCDEFGHIJKLMNOP'].join('');
	await writeFile(
		join(root, 'index.html'),
		`<!doctype html><img src="/${runtimePath}" alt="" /><script>const key = '${fakeAwsKey}';</script>`,
	);

	assert.throws(
		() => verifyBlacksiteFrontendHygiene(root, assetManifest(bytes)),
		/Forbidden release content AWS access key/u,
	);
});
