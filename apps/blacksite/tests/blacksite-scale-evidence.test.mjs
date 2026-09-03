import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  SCALE_EVIDENCE_SCHEMA,
  createSelfTestEvidence,
  verifyScaleEvidence,
  verifyScaleEvidenceArtifacts,
} from '../../../scripts/blacksite-scale-evidence.mjs';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('scale evidence binds exact client and external release identity', () => {
  const evidence = createSelfTestEvidence();
  const result = verifyScaleEvidence(evidence, {
    gitSha: evidence.identity.gitSha,
    frontendTreeSha256: evidence.identity.frontendTreeSha256,
  });
  assert.equal(result.schema, SCALE_EVIDENCE_SCHEMA);
  assert.equal(result.status, 'PASS');
  assert.equal(result.claim, 'EXTERNAL_SCALE_METADATA_VALIDATED');
});

test('scale evidence rejects mocked or non-production-equivalent targets', () => {
  const evidence = createSelfTestEvidence();
  evidence.environment.mocked = true;
  assert.throws(() => verifyScaleEvidence(evidence), /mocked environment/u);
  evidence.environment.mocked = false;
  evidence.environment.productionEquivalent = false;
  assert.throws(() => verifyScaleEvidence(evidence), /production-equivalent/u);
});

test('scale evidence distinguishes planning population from achieved concurrency and rate', () => {
  const evidence = createSelfTestEvidence();
  evidence.workload.achievedPeakConcurrentUsers -= 1;
  assert.throws(() => verifyScaleEvidence(evidence), /peak concurrency/u);
  const rateEvidence = createSelfTestEvidence();
  rateEvidence.workload.achievedRps -= 1;
  assert.throws(() => verifyScaleEvidence(rateEvidence), /request rate/u);
});

test('scale evidence fails on latency, cache and saturation breaches', () => {
  const latency = createSelfTestEvidence();
  latency.latency.play.p99Ms = latency.latency.play.limits.p99Ms + 1;
  assert.throws(() => verifyScaleEvidence(latency), /p99Ms exceeds/u);
  const cache = createSelfTestEvidence();
  cache.cdn.cacheHits = 0;
  assert.throws(() => verifyScaleEvidence(cache), /cache hit rate/u);
  const saturation = createSelfTestEvidence();
  saturation.saturation[0].maxObserved = saturation.saturation[0].limit + 1;
  assert.throws(() => verifyScaleEvidence(saturation), /exceeds approved limit/u);
});

test('scale evidence requires zero wallet and settlement integrity violations', () => {
  for (const key of [
    'duplicateAcceptedPaidPlays',
    'duplicateSettlements',
    'negativeBalances',
    'payoutMismatches',
    'uncertainRecoveryDuplicateWrites',
  ]) {
    const evidence = createSelfTestEvidence();
    evidence.idempotency[key] = 1;
    assert.throws(() => verifyScaleEvidence(evidence), new RegExp(key, 'u'));
  }
});

test('scale evidence requires every resilience drill and bounded recovery', () => {
  const missing = createSelfTestEvidence();
  missing.resilience.scenarios.pop();
  assert.throws(() => verifyScaleEvidence(missing), /was not executed/u);
  const slow = createSelfTestEvidence();
  slow.resilience.scenarios[0].recoverySeconds = slow.resilience.scenarios[0].limitSeconds + 1;
  assert.throws(() => verifyScaleEvidence(slow), /exceeded recovery limit/u);
});

test('scale evidence requires correlated observability and exercised alerts', () => {
  const evidence = createSelfTestEvidence();
  evidence.observability.logsCorrelated = false;
  assert.throws(() => verifyScaleEvidence(evidence), /logsCorrelated/u);
  const alert = createSelfTestEvidence();
  alert.observability.alertDrills[0].acknowledged = false;
  assert.throws(() => verifyScaleEvidence(alert), /alert drills/u);
});

test('scale evidence requires a successful bounded rollback rehearsal', () => {
  const evidence = createSelfTestEvidence();
  evidence.rollback.healthyAfterRollback = false;
  assert.throws(() => verifyScaleEvidence(evidence), /restore health/u);
  const slow = createSelfTestEvidence();
  slow.rollback.recoverySeconds = slow.rollback.limitSeconds + 1;
  assert.throws(() => verifyScaleEvidence(slow), /rollback exceeded/u);
});

test('scale evidence artifact digests fail closed', () => {
  const evidence = createSelfTestEvidence();
  evidence.artifacts[0].sha256 = 'unbound';
  assert.throws(() => verifyScaleEvidence(evidence), /lowercase hexadecimal/u);
  const untouched = createSelfTestEvidence();
  assert.doesNotThrow(() => verifyScaleEvidence(clone(untouched)));
});

test('scale evidence binds approvals, phase duration, request totals and required artifact roles', () => {
  const lateApproval = createSelfTestEvidence();
  lateApproval.approval.approvedAt = '2026-09-03T00:00:01.000Z';
  assert.throws(() => verifyScaleEvidence(lateApproval), /approved before the run/u);

  const shortRun = createSelfTestEvidence();
  shortRun.run.completedAt = '2026-09-03T01:00:00.000Z';
  assert.throws(() => verifyScaleEvidence(shortRun), /phase duration/u);

  const requestMismatch = createSelfTestEvidence();
  requestMismatch.workload.measuredRequests -= 1;
  assert.throws(() => verifyScaleEvidence(requestMismatch), /measuredRequests/u);

  const duplicateArtifact = createSelfTestEvidence();
  duplicateArtifact.artifacts[5] = { ...duplicateArtifact.artifacts[0] };
  assert.throws(() => verifyScaleEvidence(duplicateArtifact), /unique/u);

  const missingArtifactRole = createSelfTestEvidence();
  missingArtifactRole.artifacts = missingArtifactRole.artifacts.filter(
    (artifact) => artifact.role !== 'rollback-report',
  );
  assert.throws(() => verifyScaleEvidence(missingArtifactRole), /rollback-report/u);
});

test('real scale verification refuses metadata-only artifact claims', () => {
  const directory = mkdtempSync(join(tmpdir(), 'blacksite-scale-readback-red-'));
  try {
    const evidence = createSelfTestEvidence();
    const evidencePath = join(directory, 'evidence.json');
    writeFileSync(evidencePath, `${JSON.stringify(evidence)}\n`, 'utf8');
    const result = spawnSync(
      process.execPath,
      [
        fileURLToPath(new URL('../../../scripts/blacksite-scale-evidence.mjs', import.meta.url)),
        '--evidence',
        evidencePath,
        '--expected-commit',
        evidence.identity.gitSha,
        '--expected-frontend-tree',
        evidence.identity.frontendTreeSha256,
      ],
      { encoding: 'utf8' },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /artifacts-root/u);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('scale artifact readback verifies exact files and detects tampering', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'blacksite-scale-readback-'));
  try {
    const evidence = createSelfTestEvidence();
    for (const artifact of evidence.artifacts) {
      const content = `${artifact.role}\n`;
      writeFileSync(join(directory, artifact.name), content, 'utf8');
      artifact.bytes = Buffer.byteLength(content);
      artifact.sha256 = createHash('sha256').update(content).digest('hex');
    }
    const result = await verifyScaleEvidenceArtifacts(evidence, directory);
    assert.equal(result.status, 'PASS');
    assert.equal(result.verifiedArtifacts.length, 6);

    const evidencePath = join(directory, 'evidence.json');
    writeFileSync(evidencePath, `${JSON.stringify(evidence)}\n`, 'utf8');
    const cli = spawnSync(
      process.execPath,
      [
        fileURLToPath(new URL('../../../scripts/blacksite-scale-evidence.mjs', import.meta.url)),
        '--evidence',
        evidencePath,
        '--artifacts-root',
        directory,
        '--expected-commit',
        evidence.identity.gitSha,
        '--expected-frontend-tree',
        evidence.identity.frontendTreeSha256,
      ],
      { encoding: 'utf8' },
    );
    assert.equal(cli.status, 0, cli.stderr);
    const cliResult = JSON.parse(cli.stdout);
    assert.equal(cliResult.claim, 'EXTERNAL_SCALE_EVIDENCE_VALIDATED');
    assert.equal(cliResult.artifactReadback.verifiedArtifacts.length, 6);

    writeFileSync(join(directory, evidence.artifacts[0].name), 'tampered\n', 'utf8');
    await assert.rejects(() => verifyScaleEvidenceArtifacts(evidence, directory), /bytes mismatch|sha256 mismatch/u);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
