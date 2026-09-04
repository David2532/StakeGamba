import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
	pruneBlacksiteInlineBuildResidue,
	verifyBlacksiteFrontendHygiene,
} from '../../../scripts/blacksite-frontend-hygiene.mjs';

const runtimePath = 'assets/blacksite/environment/vault.webp';
const buildGitSha = '1'.repeat(40);
const recoveryRuntime = `const Uf="${buildGitSha}",Uo="sveltekit:snapshot";async function check(){const response=await fetch("/_app/version.json");return (await response.json()).version!==Uf;}`;
const inlineRuntime = `${recoveryRuntime}const runtimeAsset="/${runtimePath}";`;

function inlineDocument(
	program = inlineRuntime,
	beforeWrapper = '',
	afterWrapper = '',
	styleSource = '',
) {
	return `<!doctype html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" /><meta name="theme-color" content="#081015" /><style>${styleSource}</style></head><body data-sveltekit-preload-data="hover">${beforeWrapper}<div style="display: contents"><script>${program}</script></div>${afterWrapper}</body></html>`;
}

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
				path: 'art/source-vault.png',
				runtimeEligible: true,
				runtimePath: `apps/blacksite/static/${runtimePath}`,
				sha256: sha256(bytes),
				sourceSha256: sha256('source-vault-pixels'),
				source: 'project-authored fixture',
				originalityProvenance: 'test fixture generated inside this test',
				licenseRights: 'test-only fixture; no production rights claim',
				reviewLimitations: 'fixture only',
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
	await writeFile(join(root, 'index.html'), inlineDocument());
	await writeFile(
		join(root, '_app', 'blacksite-build-identity.json'),
		'{"schema":"blacksite-frontend-build-identity-v1"}\n',
	);
	await writeFile(
		join(root, '_app', 'version.json'),
		`${JSON.stringify({ version: buildGitSha })}\n`,
	);
	await writeFile(join(root, runtimePath), bytes);
	return { root, bytes };
}

test('exact inline frontend contains only identity and provenance-bound runtime assets', async (t) => {
	const { root, bytes } = await makeFrontend();
	t.after(() => rm(root, { recursive: true, force: true }));

	const result = verifyBlacksiteFrontendHygiene(root, assetManifest(bytes));
	assert.equal(result.result, 'PASS');
	assert.equal(result.fileCount, 4);
	assert.equal(result.runtimeAssetCount, 1);
	assert.deepEqual(result.runtimeAssetPaths, [runtimePath]);
	assert.equal(result.claims.generatedRecoveryMetadataAstPatternMatch, 'PASS');
	assert.equal(result.claims.recoveryRuntimeExecution, 'NOT_CLAIMED_BY_HYGIENE_GATE');
	assert.equal(result.claims.sourceAssetDigestBinding, 'NOT_CHECKED');
});

test('frontend package root must be a physical isolated directory', async (t) => {
	const { root, bytes } = await makeFrontend();
	const linkParent = await mkdtemp(join(tmpdir(), 'blacksite-hygiene-link-'));
	const linkedRoot = join(linkParent, 'frontend');
	t.after(() => rm(root, { recursive: true, force: true }));
	t.after(() => rm(linkParent, { recursive: true, force: true }));
	await symlink(root, linkedRoot, 'dir');

	assert.throws(
		() => verifyBlacksiteFrontendHygiene(linkedRoot, assetManifest(bytes)),
		/must be a physical directory/u,
	);
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
	assert.equal(result.removedFiles, 2);
	await assert.rejects(access(join(root, '_app', 'immutable', 'bundle.js')));
	await assert.rejects(access(join(root, '_app', 'env.js')));
	await access(join(root, '_app', 'version.json'));
});

test('inline build pruning refuses files loaded by static markup', async (t) => {
	const root = await mkdtemp(join(tmpdir(), 'blacksite-prune-ref-'));
	t.after(() => rm(root, { recursive: true, force: true }));
	await mkdir(join(root, '_app', 'immutable'), { recursive: true });
	await writeFile(join(root, 'index.html'), '<script src="./_app/immutable/bundle.js"></script>');
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

test('runtime asset manifest paths must already be canonical POSIX paths', async (t) => {
	const { root, bytes } = await makeFrontend();
	t.after(() => rm(root, { recursive: true, force: true }));
	const manifest = assetManifest(bytes);
	manifest.assets[0].runtimePath = 'apps/blacksite/static/assets\\vault.webp';

	assert.throws(() => verifyBlacksiteFrontendHygiene(root, manifest), /canonical POSIX path/u);
	manifest.assets[0].runtimePath = `apps/blacksite/static/${runtimePath}`;
	manifest.assets[0].path = 'C:/outside.png';
	assert.throws(
		() => verifyBlacksiteFrontendHygiene(root, manifest),
		/canonical repo-relative POSIX path/u,
	);
	for (const unsafePath of [
		'assets/blacksite/vault.webp?cache',
		'assets/blacksite/vault.webp#fragment',
		'assets/%2e%2e/vault.webp',
		'assets/blacksite/vault image.webp',
	]) {
		manifest.assets[0].path = 'art/source-vault.png';
		manifest.assets[0].runtimePath = `apps/blacksite/static/${unsafePath}`;
		assert.throws(
			() => verifyBlacksiteFrontendHygiene(root, manifest),
			/runtime asset path must be unique and normalized/u,
		);
	}
});

test('production and approved assets remain release-eligible', async (t) => {
	for (const status of ['production', 'approved']) {
		const { root, bytes } = await makeFrontend();
		t.after(() => rm(root, { recursive: true, force: true }));
		const manifest = assetManifest(bytes);
		manifest.assets[0].status = status;
		assert.equal(verifyBlacksiteFrontendHygiene(root, manifest).result, 'PASS');
	}
});

test('documented source bytes are bound to their canonical manifest digest', async (t) => {
	const { root, bytes } = await makeFrontend();
	const sourceRoot = await mkdtemp(join(tmpdir(), 'blacksite-source-'));
	t.after(() => rm(root, { recursive: true, force: true }));
	t.after(() => rm(sourceRoot, { recursive: true, force: true }));
	await mkdir(join(sourceRoot, 'art'), { recursive: true });
	await writeFile(join(sourceRoot, 'art', 'source-vault.png'), 'source-vault-pixels');
	const manifest = assetManifest(bytes);

	const result = verifyBlacksiteFrontendHygiene(root, manifest, sourceRoot);
	assert.equal(result.claims.sourceAssetDigestBinding, 'PASS');
	await writeFile(join(sourceRoot, 'art', 'source-vault.png'), 'modified-source-pixels');
	assert.throws(
		() => verifyBlacksiteFrontendHygiene(root, manifest, sourceRoot),
		/source asset hash mismatch/u,
	);
});

test('runtime asset references hidden only in HTML comments fail closed', async (t) => {
	const { root, bytes } = await makeFrontend();
	t.after(() => rm(root, { recursive: true, force: true }));
	await writeFile(
		join(root, 'index.html'),
		inlineDocument(recoveryRuntime, '', `<!-- /${runtimePath} -->`),
	);

	assert.throws(
		() => verifyBlacksiteFrontendHygiene(root, assetManifest(bytes)),
		/(?:pinned body shape|no exact executable package literal)/u,
	);
});

test('unclosed and bang-terminated HTML comments cannot fake runtime asset references', async (t) => {
	for (const comment of [`<!-- /${runtimePath}`, `<!-- /${runtimePath} --!>`]) {
		const { root, bytes } = await makeFrontend();
		t.after(() => rm(root, { recursive: true, force: true }));
		await writeFile(join(root, 'index.html'), inlineDocument(recoveryRuntime, '', comment));
		assert.throws(
			() => verifyBlacksiteFrontendHygiene(root, assetManifest(bytes)),
			/(?:Invalid generated inline HTML|no exact executable package literal)/u,
		);
	}
});

test('runtime asset path prefixes cannot fake exact packaged literals', async (t) => {
	const { root, bytes } = await makeFrontend();
	t.after(() => rm(root, { recursive: true, force: true }));
	await writeFile(
		join(root, 'index.html'),
		inlineDocument(`${recoveryRuntime}const runtimeAsset="/${runtimePath}.missing";`),
	);

	assert.throws(
		() => verifyBlacksiteFrontendHygiene(root, assetManifest(bytes)),
		/no exact executable package literal/u,
	);
});

test('unmanifested embedded data assets fail closed', async (t) => {
	const { root, bytes } = await makeFrontend();
	t.after(() => rm(root, { recursive: true, force: true }));
	await writeFile(
		join(root, 'index.html'),
		inlineDocument(inlineRuntime, '', '<img src="data:image/png;base64,AAAA" alt="" />'),
	);

	assert.throws(
		() => verifyBlacksiteFrontendHygiene(root, assetManifest(bytes)),
		/(?:pinned body shape|Forbidden release content embedded data URI)/u,
	);
});

test('empty-media, base64-only and HTML-entity data schemes fail closed', async (t) => {
	for (const uri of ['data:,hello', 'data:;base64,AAAA', 'data&colon;image/png;base64,AAAA']) {
		const { root, bytes } = await makeFrontend();
		t.after(() => rm(root, { recursive: true, force: true }));
		await writeFile(
			join(root, 'index.html'),
			inlineDocument(`${inlineRuntime}const embedded="${uri}";`),
		);
		assert.throws(
			() => verifyBlacksiteFrontendHygiene(root, assetManifest(bytes)),
			/Forbidden release content embedded data URI/u,
		);
	}
});

test('UTF-16 runtime text assets cannot hide embedded data schemes', async (t) => {
	const { root, bytes } = await makeFrontend();
	t.after(() => rm(root, { recursive: true, force: true }));
	const atlasPath = 'assets/blacksite/environment/vault.atlas';
	const atlasBytes = Buffer.concat([
		Buffer.from([0xff, 0xfe]),
		Buffer.from('image: data:image/png;base64,AAAA', 'utf16le'),
	]);
	await rm(join(root, runtimePath));
	await writeFile(join(root, atlasPath), atlasBytes);
	await writeFile(
		join(root, 'index.html'),
		inlineDocument(`${recoveryRuntime}const runtimeAsset="/${atlasPath}";`),
	);
	const manifest = assetManifest(bytes);
	manifest.assets[0].runtimePath = `apps/blacksite/static/${atlasPath}`;
	manifest.assets[0].sha256 = sha256(atlasBytes);

	assert.throws(
		() => verifyBlacksiteFrontendHygiene(root, manifest),
		/Forbidden release content embedded data URI/u,
	);
});

test('self-declared BOM-less UTF-16 XML cannot hide embedded data schemes', async (t) => {
	for (const encoding of ['UTF-16LE', 'UTF-16BE']) {
		const { root, bytes } = await makeFrontend();
		t.after(() => rm(root, { recursive: true, force: true }));
		const xmlPath = `assets/blacksite/environment/vault-${encoding.toLowerCase()}.xml`;
		const xml = `<?xml version="1.0" encoding="${encoding}"?><root href="data:text/plain,hello"/>`;
		const xmlBytes = Buffer.from(xml, 'utf16le');
		if (encoding === 'UTF-16BE') xmlBytes.swap16();
		await rm(join(root, runtimePath));
		await writeFile(join(root, xmlPath), xmlBytes);
		await writeFile(
			join(root, 'index.html'),
			inlineDocument(`${recoveryRuntime}const runtimeAsset="/${xmlPath}";`),
		);
		const manifest = assetManifest(bytes);
		manifest.assets[0].runtimePath = `apps/blacksite/static/${xmlPath}`;
		manifest.assets[0].sha256 = sha256(xmlBytes);

		assert.throws(
			() => verifyBlacksiteFrontendHygiene(root, manifest),
			/Forbidden release content embedded data URI/u,
		);
	}
});

test('glTF runtime assets cannot hide statically embedded data buffers', async (t) => {
	const { root, bytes } = await makeFrontend();
	t.after(() => rm(root, { recursive: true, force: true }));
	const gltfPath = 'assets/blacksite/environment/scene.gltf';
	const gltfBytes = Buffer.from(
		'{"asset":{"version":"2.0"},"buffers":[{"uri":"data:application/octet-stream;base64,AAAA","byteLength":3}]}',
	);
	await rm(join(root, runtimePath));
	await writeFile(join(root, gltfPath), gltfBytes);
	await writeFile(
		join(root, 'index.html'),
		inlineDocument(`${recoveryRuntime}const runtimeAsset="/${gltfPath}";`),
	);
	const manifest = assetManifest(bytes);
	manifest.assets[0].runtimePath = `apps/blacksite/static/${gltfPath}`;
	manifest.assets[0].sha256 = sha256(gltfBytes);

	assert.throws(
		() => verifyBlacksiteFrontendHygiene(root, manifest),
		/Forbidden release content embedded data URI/u,
	);
});

test('binary GLB runtime assets cannot hide statically embedded data buffers', async (t) => {
	const { root, bytes } = await makeFrontend();
	t.after(() => rm(root, { recursive: true, force: true }));
	const glbPath = 'assets/blacksite/environment/scene.glb';
	const json = Buffer.from(
		JSON.stringify({
			asset: { version: '2.0' },
			images: [{ uri: 'data:image/png;base64,AAAA' }],
		}),
	);
	const paddedJsonLength = Math.ceil(json.length / 4) * 4;
	const glbBytes = Buffer.alloc(12 + 8 + paddedJsonLength, 0x20);
	glbBytes.writeUInt32LE(0x46546c67, 0);
	glbBytes.writeUInt32LE(2, 4);
	glbBytes.writeUInt32LE(glbBytes.length, 8);
	glbBytes.writeUInt32LE(paddedJsonLength, 12);
	glbBytes.writeUInt32LE(0x4e4f534a, 16);
	json.copy(glbBytes, 20);
	await rm(join(root, runtimePath));
	await writeFile(join(root, glbPath), glbBytes);
	await writeFile(
		join(root, 'index.html'),
		inlineDocument(`${recoveryRuntime}const runtimeAsset="/${glbPath}";`),
	);
	const manifest = assetManifest(bytes);
	manifest.assets[0].runtimePath = `apps/blacksite/static/${glbPath}`;
	manifest.assets[0].sha256 = sha256(glbBytes);

	assert.throws(
		() => verifyBlacksiteFrontendHygiene(root, manifest),
		/Forbidden release content embedded data URI/u,
	);
});

test('browser-executable runtime asset extensions fail closed', async (t) => {
	for (const extension of ['htm', 'shtml', 'svg', 'wasm', 'xht', 'xhtml']) {
		const { root, bytes } = await makeFrontend();
		t.after(() => rm(root, { recursive: true, force: true }));
		const executablePath = `assets/blacksite/environment/payload.${extension}`;
		const executableBytes = Buffer.from('<script>debugger;console.log("diagnostic")</script>');
		await rm(join(root, runtimePath));
		await writeFile(join(root, executablePath), executableBytes);
		await writeFile(
			join(root, 'index.html'),
			inlineDocument(`${recoveryRuntime}const runtimeAsset="/${executablePath}";`),
		);
		const manifest = assetManifest(bytes);
		manifest.assets[0].runtimePath = `apps/blacksite/static/${executablePath}`;
		manifest.assets[0].sha256 = sha256(executableBytes);

		assert.throws(
			() => verifyBlacksiteFrontendHygiene(root, manifest),
			/cannot manifest external runtime code/u,
		);
	}
});

test('invalid or missing update recovery metadata fails closed', async (t) => {
	const { root, bytes } = await makeFrontend();
	t.after(() => rm(root, { recursive: true, force: true }));
	await writeFile(join(root, '_app', 'version.json'), '{"version":"not-generated"}\n');

	assert.throws(
		() => verifyBlacksiteFrontendHygiene(root, assetManifest(bytes)),
		/exact lowercase Git SHA build version/u,
	);
});

test('update recovery metadata must match the inline runtime version', async (t) => {
	const { root, bytes } = await makeFrontend();
	t.after(() => rm(root, { recursive: true, force: true }));
	await writeFile(
		join(root, '_app', 'version.json'),
		`${JSON.stringify({ version: '2'.repeat(40) })}\n`,
	);
	await writeFile(
		join(root, 'index.html'),
		inlineDocument(`const bait='x="1",y="sveltekit:snapshot";a.version!==x';${inlineRuntime}`),
	);

	assert.throws(
		() => verifyBlacksiteFrontendHygiene(root, assetManifest(bytes)),
		/version is not bound to the inline runtime/u,
	);
});

test('inert script types and template content cannot fake a recovery runtime', async (t) => {
	for (const inert of [
		`<script type="application/json">${inlineRuntime}</script>`,
		`<template><script>${inlineRuntime}</script></template>`,
	]) {
		const { root, bytes } = await makeFrontend();
		t.after(() => rm(root, { recursive: true, force: true }));
		await writeFile(
			join(root, 'index.html'),
			`<!doctype html><html><head></head><body>${inert}</body></html>`,
		);
		assert.throws(
			() => verifyBlacksiteFrontendHygiene(root, assetManifest(bytes)),
			/(?:Invalid generated inline HTML|Generated inline HTML|generated runtime script|attribute-free|pinned html\/body\/div wrapper)/u,
		);
	}
});

test('browser-inert script shapes cannot satisfy the pinned runtime contract', async (t) => {
	for (const inert of [
		`<script data-type="text/javascript" type="application/json">${inlineRuntime}</script>`,
		`<script language="json">${inlineRuntime}</script>`,
		`<textarea><script>${inlineRuntime}</script></textarea>`,
		`<template><template><script>${inlineRuntime}</script></template></template>`,
		`<div style="display: contents"><script src="/index.html">${inlineRuntime}</script></div>`,
	]) {
		const { root, bytes } = await makeFrontend();
		t.after(() => rm(root, { recursive: true, force: true }));
		await writeFile(
			join(root, 'index.html'),
			`<!doctype html><html><head></head><body>${inert}</body></html>`,
		);
		assert.throws(
			() => verifyBlacksiteFrontendHygiene(root, assetManifest(bytes)),
			/(?:Invalid generated inline HTML|Generated inline HTML|generated runtime script|attribute-free|pinned html\/body\/div wrapper)/u,
		);
	}
});

test('CSP and plaintext markup cannot neutralize the pinned runtime shell', async (t) => {
	for (const document of [
		inlineDocument().replace(
			'<style>',
			'<meta http-equiv="Content-Security-Policy" content="script-src &#39;none&#39;" /><style>',
		),
		inlineDocument().replace(
			'<div style="display: contents">',
			'<plaintext></plaintext><div style="display: contents">',
		),
	]) {
		const { root, bytes } = await makeFrontend();
		t.after(() => rm(root, { recursive: true, force: true }));
		await writeFile(join(root, 'index.html'), document);
		assert.throws(
			() => verifyBlacksiteFrontendHygiene(root, assetManifest(bytes)),
			/(?:Invalid generated inline HTML|pinned (?:head|body) shape)/u,
		);
	}
});

test('non-runtime HTML and CSS text cannot fake an exact runtime-script asset literal', async (t) => {
	for (const bait of [
		`<div data-src="/${runtimePath}"></div>`,
		`<p>src="/${runtimePath}"</p>`,
		`<style>/* url(/${runtimePath}) */</style>`,
		`<!-- /${runtimePath} -->`,
	]) {
		const { root, bytes } = await makeFrontend();
		t.after(() => rm(root, { recursive: true, force: true }));
		await writeFile(
			join(root, 'index.html'),
			inlineDocument(`${recoveryRuntime}const missing="/${runtimePath}.missing";`, '', bait),
		);
		assert.throws(
			() => verifyBlacksiteFrontendHygiene(root, assetManifest(bytes)),
			/(?:pinned (?:body|head) shape|no exact executable package literal)/u,
		);
	}
});

test('update recovery fetch target must be the exact generated metadata path', async (t) => {
	const { root, bytes } = await makeFrontend();
	t.after(() => rm(root, { recursive: true, force: true }));
	await writeFile(
		join(root, 'index.html'),
		inlineDocument(inlineRuntime.replace('/_app/version.json', '/_app/version.json.missing')),
	);

	assert.throws(
		() => verifyBlacksiteFrontendHygiene(root, assetManifest(bytes)),
		/exactly one generated SvelteKit recovery binding/u,
	);
});

test('syntactically invalid inline runtime cannot produce package evidence', async (t) => {
	const { root, bytes } = await makeFrontend();
	t.after(() => rm(root, { recursive: true, force: true }));
	await writeFile(join(root, 'index.html'), inlineDocument(`@${inlineRuntime}`));

	assert.throws(
		() => verifyBlacksiteFrontendHygiene(root, assetManifest(bytes)),
		/(?:Invalid generated inline HTML|not syntactically executable)/u,
	);
});

test('module-only syntax cannot pass for the pinned classic runtime script', async (t) => {
	for (const moduleSyntax of ['import "/missing-runtime.js";', 'export {};', 'await 0;']) {
		const { root, bytes } = await makeFrontend();
		t.after(() => rm(root, { recursive: true, force: true }));
		await writeFile(join(root, 'index.html'), inlineDocument(`${moduleSyntax}${inlineRuntime}`));
		assert.throws(
			() => verifyBlacksiteFrontendHygiene(root, assetManifest(bytes)),
			/not syntactically executable/u,
		);
	}
});

test('regular-expression text cannot fake runtime or asset AST literals', async (t) => {
	const { root, bytes } = await makeFrontend();
	t.after(() => rm(root, { recursive: true, force: true }));
	await writeFile(
		join(root, 'index.html'),
		inlineDocument(
			`${recoveryRuntime}const missing="/${runtimePath}.missing";if(true)/"\\x2fassets\\x2fblacksite\\x2fenvironment\\x2fvault.webp"/.test("");`,
		),
	);
	assert.throws(
		() => verifyBlacksiteFrontendHygiene(root, assetManifest(bytes)),
		/no exact executable package literal/u,
	);

	await writeFile(
		join(root, 'index.html'),
		inlineDocument(
			`if(true)/Uf="${buildGitSha}",Uo="sveltekit:snapshot";fetch("\\u002f_app\\u002fversion.json");a.version!==Uf/;const runtimeAsset="/${runtimePath}";`,
		),
	);
	assert.throws(
		() => verifyBlacksiteFrontendHygiene(root, assetManifest(bytes)),
		/exactly one generated SvelteKit recovery binding/u,
	);
});

test('browser-decoded HTML, CSS and JavaScript data URIs fail closed', async (t) => {
	for (const document of [
		inlineDocument(inlineRuntime, '', '<img src="&#100;ata&#58;image/png;base64,AAAA" alt="" />'),
		inlineDocument(
			inlineRuntime,
			'',
			'<div style="background:url(d\\61 ta:image/png;base64,AAAA)"></div>',
		),
		inlineDocument(`${inlineRuntime}const embedded="d\\x61ta:image/png;base64,AAAA";`),
		inlineDocument(`${inlineRuntime}new Image().src="da"+"ta:image/png;base64,AAAA";`),
		inlineDocument(inlineRuntime + 'new Image().src=`data:${"image/png"};base64,AAAA`;'),
		inlineDocument(`${inlineRuntime}new Image().src="da\\nta:image/png;base64,AAAA";`),
		inlineDocument(`${inlineRuntime}new Image().src="da\\tta:image/png;base64,AAAA";`),
		inlineDocument(`${inlineRuntime}new Image().src="data:\\rimage/png;base64,AAAA";`),
		inlineDocument(`${inlineRuntime}fetch("data:foo,bar");`),
		inlineDocument(`${inlineRuntime}fetch("data: text/plain,bar");`),
		inlineDocument(`${inlineRuntime}fetch('data:text/plain;charset="utf-8",hello');`),
		inlineDocument(`${inlineRuntime}fetch('data:text/plain;charset=(utf-8),hello');`),
		inlineDocument(`${inlineRuntime}fetch('data:text/plain; charset=utf-8,hello');`),
		inlineDocument(`${inlineRuntime}fetch('data:text/plain;note=${'x'.repeat(300)},hello');`),
		inlineDocument(inlineRuntime + 'fetch(`data:text/plain,${0}`);'),
		inlineDocument(inlineRuntime + 'fetch(`data:text/plain,${-1}`);'),
		inlineDocument(inlineRuntime + 'fetch(`data:text/plain,${0n}`);'),
		inlineDocument(inlineRuntime + 'fetch(`da${true?"ta":"xx"}:text/plain,hello`);'),
		inlineDocument(inlineRuntime + 'fetch(`da${(1<<1)===2?"ta":"xx"}:text/plain,hello`);'),
		inlineDocument(inlineRuntime + 'fetch(`da${(0,"ta")}:text/plain,hello`);'),
		inlineDocument(inlineRuntime, '', '', 'body{background:url("da\\\nta:image/png;base64,AAAA")}'),
	]) {
		const { root, bytes } = await makeFrontend();
		t.after(() => rm(root, { recursive: true, force: true }));
		await writeFile(join(root, 'index.html'), document);
		assert.throws(
			() => verifyBlacksiteFrontendHygiene(root, assetManifest(bytes)),
			/(?:pinned body shape|Forbidden release content embedded data URI)/u,
		);
	}
});

test('benign data copy and debugger-shaped properties remain valid', async (t) => {
	const { root, bytes } = await makeFrontend();
	t.after(() => rm(root, { recursive: true, force: true }));
	await writeFile(
		join(root, 'index.html'),
		inlineDocument(
			`${inlineRuntime}const message="Data: unavailable; no data: should be provided";const options={debugger:false,debugger(){return false}};options?.debugger;`,
		),
	);

	assert.equal(verifyBlacksiteFrontendHygiene(root, assetManifest(bytes)).result, 'PASS');
});

test('optional, computed and template-interpolated debug calls fail closed', async (t) => {
	for (const debugProgram of [
		'console?.log("diagnostic");',
		'console["trace"]("diagnostic");',
		'console["l"+"og"]("diagnostic");',
		'console[true?"log":"warn"]("diagnostic");',
		'console[true&&"log"]("diagnostic");',
		'console[(1<<1)===2?"log":"warn"]("diagnostic");',
		'console[(0,"log")]("diagnostic");',
		'console.log`diagnostic`;',
		'console[`log`]("diagnostic");',
		'parent.console.log("diagnostic");',
		'top.console.trace("diagnostic");',
		'frames.console.debug("diagnostic");',
		'window.parent.console.log("diagnostic");',
		'document.defaultView.console.trace("diagnostic");',
		'const diagnostic=`${console.debug("diagnostic")}`;',
		'const diagnostic=`${(()=>{debugger})()}`;',
	]) {
		const { root, bytes } = await makeFrontend();
		t.after(() => rm(root, { recursive: true, force: true }));
		await writeFile(join(root, 'index.html'), inlineDocument(`${inlineRuntime}${debugProgram}`));
		assert.throws(
			() => verifyBlacksiteFrontendHygiene(root, assetManifest(bytes)),
			/Forbidden release content (?:console debug|debugger) statement/u,
		);
	}
});

test('high-confidence secrets and source-map directives fail closed', async (t) => {
	const { root, bytes } = await makeFrontend();
	t.after(() => rm(root, { recursive: true, force: true }));
	const fakeAwsKey = ['AK', 'IA', 'ABCDEFGHIJKLMNOP'].join('');
	await writeFile(
		join(root, 'index.html'),
		inlineDocument(`${inlineRuntime}const key='${fakeAwsKey}';`),
	);

	assert.throws(
		() => verifyBlacksiteFrontendHygiene(root, assetManifest(bytes)),
		/Forbidden release content AWS access key/u,
	);
});

test('ASI debugger statements and encrypted private-key headers fail closed', async (t) => {
	const { root, bytes } = await makeFrontend();
	t.after(() => rm(root, { recursive: true, force: true }));
	await writeFile(join(root, 'index.html'), inlineDocument(`${inlineRuntime}debugger\n`));
	assert.throws(
		() => verifyBlacksiteFrontendHygiene(root, assetManifest(bytes)),
		/Forbidden release content debugger statement/u,
	);

	await writeFile(
		join(root, 'index.html'),
		inlineDocument(`${inlineRuntime}/* -----BEGIN ENCRYPTED PRIVATE KEY----- */`),
	);
	assert.throws(
		() => verifyBlacksiteFrontendHygiene(root, assetManifest(bytes)),
		/Forbidden release content private key/u,
	);
});

test('benign debugger text and commented debug calls do not fail the executable scan', async (t) => {
	const { root, bytes } = await makeFrontend();
	t.after(() => rm(root, { recursive: true, force: true }));
	await writeFile(
		join(root, 'index.html'),
		inlineDocument(
			`${inlineRuntime}const help="open debugger"; // debugger\n/* console.log("diagnostic example") */`,
		),
	);

	assert.equal(verifyBlacksiteFrontendHygiene(root, assetManifest(bytes)).result, 'PASS');
});
