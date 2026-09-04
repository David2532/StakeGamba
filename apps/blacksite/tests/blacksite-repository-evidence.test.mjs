import assert from 'node:assert/strict';
import test from 'node:test';

import {
	BLACKSITE_REPOSITORY_EVIDENCE_SCHEMA,
	BLACKSITE_REPOSITORY_GATES,
	buildRepositoryGateEvidence,
} from '../../../scripts/blacksite-repository-evidence.mjs';

const gitSha = 'a'.repeat(40);
const labels = [
	'workflow',
	'npmrc',
	'package-manifest',
	'lockfile',
	'security-evidence',
	'candidate-manifest',
	'package-verification',
	'browser-evidence',
];

function inputs() {
	return labels.map((label) => ({ label, path: `${label}.txt`, source: `${label}\n` }));
}

test('repository evidence binds every successful release gate and raw input to one SHA', () => {
	const evidence = buildRepositoryGateEvidence({
		expectedGitSha: gitSha,
		actualGitSha: gitSha,
		inputSources: inputs(),
		generatedAt: '2026-09-04T00:00:00.000Z',
	});
	assert.equal(evidence.schema, BLACKSITE_REPOSITORY_EVIDENCE_SCHEMA);
	assert.deepEqual(
		evidence.gates.map(({ name }) => name),
		BLACKSITE_REPOSITORY_GATES,
	);
	assert.deepEqual(evidence.summary, { gates: 10, pass: 10, fail: 0 });
	assert.equal(evidence.inputs.length, labels.length);
	assert(evidence.inputs.every(({ sha256 }) => /^[0-9a-f]{64}$/u.test(sha256)));
});

test('repository evidence rejects wrong identity and incomplete or duplicate inputs', () => {
	assert.throws(
		() =>
			buildRepositoryGateEvidence({
				expectedGitSha: gitSha,
				actualGitSha: 'b'.repeat(40),
				inputSources: inputs(),
			}),
		/exact current git SHA/u,
	);
	assert.throws(
		() =>
			buildRepositoryGateEvidence({
				expectedGitSha: gitSha,
				actualGitSha: gitSha,
				inputSources: inputs().slice(1),
			}),
		/every required input exactly once/u,
	);
	const duplicate = inputs();
	duplicate[0] = { ...duplicate[1] };
	assert.throws(
		() =>
			buildRepositoryGateEvidence({
				expectedGitSha: gitSha,
				actualGitSha: gitSha,
				inputSources: duplicate,
			}),
		/every required input exactly once/u,
	);
});
