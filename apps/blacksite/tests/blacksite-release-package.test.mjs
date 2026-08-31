import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const packageScriptUrl = new URL(
	'../../../scripts/blacksite-package-candidate.mjs',
	import.meta.url,
);
const workflowUrl = new URL('../../../.github/workflows/blacksite-ci.yml', import.meta.url);

test('CI packages, verifies and browser-tests the exact extracted BlackSite frontend', async () => {
	const [packageScript, workflow] = await Promise.all([
		readFile(packageScriptUrl, 'utf8'),
		readFile(workflowUrl, 'utf8'),
	]);

	assert.match(packageScript, /--print-frontend-tree-sha256/u);
	assert.match(packageScript, /createFileManifest\(frontendSource\)\.treeSha256/u);
	assert.doesNotMatch(
		packageScript,
		/final production assets, animation and audio are not present/u,
	);

	const packageStep = workflow.indexOf('Generate and verify isolated BlackSite package');
	const browserStep = workflow.indexOf('Test exact extracted frontend in Chromium');
	assert(packageStep > 0);
	assert(browserStep > packageStep);
	assert.match(workflow, /--expected-commit "\$EXPECTED_SHA"/u);
	assert.match(workflow, /--expected-frontend-tree "\$frontend_tree"/u);
	assert.match(workflow, /blacksite-package-verify\.mjs[\s\S]*--write-result/u);
	assert.match(workflow, /> "\$\{RUNNER_TEMP\}\/blacksite-ci\/identity\.txt"/u);
	assert.match(
		workflow,
		/cp "\$\{RUNNER_TEMP\}\/blacksite-ci\/identity\.txt" artifacts\/blacksite-ci\//u,
	);
	assert.match(workflow, /BLACKSITE_QA_BUILD_ROOT="\$\{BLACKSITE_CANDIDATE_ROOT\}\/frontend"/u);
	assert.match(
		workflow,
		/BLACKSITE_QA_EXPECTED_BUILD_TREE_SHA256="\$\{BLACKSITE_FRONTEND_TREE_SHA256\}"/u,
	);
	assert.match(workflow, /artifacts\/blacksite-package\/\*\*/u);
});
