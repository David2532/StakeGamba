import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(appRoot, '../..');
const readme = readFileSync(join(appRoot, 'README.md'), 'utf8');
const appPackage = JSON.parse(readFileSync(join(appRoot, 'package.json'), 'utf8'));
const rootPackage = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));

test('README describes the implemented launch surfaces without obsolete greybox claims', () => {
	assert.match(readme, /M3 integration \/ QA_BLOCKED \/ NOT A RELEASE CANDIDATE/);
	assert.match(readme, /live RGS play/);
	assert.match(readme, /authoritative active-round restore/);
	assert.match(readme, /Replay is sessionless and read-only/);
	assert.match(readme, /Production builds reject fixture queries/);
	assert.doesNotMatch(readme, /M2_STARTED|exposes no paid-play button|Replay fetching remains/);
});

test('README commands remain backed by package scripts', () => {
	for (const script of ['dev', 'lint', 'check', 'test', 'build', 'fixtures:build']) {
		assert(appPackage.scripts[script], `missing blacksite package script ${script}`);
		assert(readme.includes(`pnpm --filter blacksite ${script}`));
	}
	for (const script of ['blacksite:math:test', 'blacksite:qa:e2e']) {
		assert(rootPackage.scripts[script], `missing root package script ${script}`);
		assert(readme.includes(`pnpm ${script}`), `README omits pnpm ${script}`);
	}
});

test('README preserves exact candidate and release-truth boundaries', () => {
	assert.match(readme, /d03fab2727e046eb6a151e579c4852cbb0536415b37028dcb3d2de9c99f278d8/);
	assert.match(readme, /uploadAuthorized: false/);
	assert.match(
		readme,
		/technical evidence, not manual device, listening, Creative or Stake approval/,
	);
	assert.match(readme, /exact-package Chromium QA/);
});
