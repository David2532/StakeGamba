import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const SCALE_EVIDENCE_SCHEMA = 'blacksite-scale-evidence-v2';
const expectedResilienceScenarios = Object.freeze([
  'cdn-origin-degradation',
  'rgs-http-5xx',
  'provider-timeout',
  'instance-restart',
]);
const requiredArtifactRoles = Object.freeze([
  'load-report',
  'cdn-report',
  'provider-ledger',
  'resilience-report',
  'observability-export',
  'rollback-report',
]);

function fail(message) {
  throw new Error(message);
}

function requireValue(condition, message) {
  if (!condition) fail(message);
}

function finitePositive(value, name) {
  requireValue(Number.isFinite(value) && value > 0, `${name} must be a positive number`);
}

function positiveInteger(value, name) {
  requireValue(Number.isSafeInteger(value) && value > 0, `${name} must be a positive safe integer`);
}

function boundedRatio(value, name) {
  requireValue(Number.isFinite(value) && value >= 0 && value <= 1, `${name} must be within 0..1`);
}

function nonEmpty(value, name) {
  requireValue(typeof value === 'string' && value.trim().length > 0, `${name} is required`);
}

function exactHex(value, length, name) {
  requireValue(
    typeof value === 'string' && new RegExp(`^[0-9a-f]{${length}}$`, 'u').test(value),
    `${name} must be ${length} lowercase hexadecimal characters`,
  );
}

function timestamp(value, name) {
  nonEmpty(value, name);
  requireValue(Number.isFinite(Date.parse(value)), `${name} must be an ISO-8601 timestamp`);
}

function verifyLatencyMetric(name, metric) {
  requireValue(metric && typeof metric === 'object', `latency.${name} is required`);
  finitePositive(metric.requests, `latency.${name}.requests`);
  for (const key of ['p50Ms', 'p95Ms', 'p99Ms']) finitePositive(metric[key], `latency.${name}.${key}`);
  requireValue(
    metric.p50Ms <= metric.p95Ms && metric.p95Ms <= metric.p99Ms,
    `latency.${name} percentiles must be monotonic`,
  );
  boundedRatio(metric.errorRate, `latency.${name}.errorRate`);
  boundedRatio(metric.timeoutRate, `latency.${name}.timeoutRate`);
  requireValue(metric.limits && typeof metric.limits === 'object', `latency.${name}.limits is required`);
  finitePositive(metric.limits.p95Ms, `latency.${name}.limits.p95Ms`);
  finitePositive(metric.limits.p99Ms, `latency.${name}.limits.p99Ms`);
  boundedRatio(metric.limits.errorRate, `latency.${name}.limits.errorRate`);
  boundedRatio(metric.limits.timeoutRate, `latency.${name}.limits.timeoutRate`);
  requireValue(metric.p95Ms <= metric.limits.p95Ms, `latency.${name}.p95Ms exceeds approved limit`);
  requireValue(metric.p99Ms <= metric.limits.p99Ms, `latency.${name}.p99Ms exceeds approved limit`);
  requireValue(metric.errorRate <= metric.limits.errorRate, `latency.${name}.errorRate exceeds approved limit`);
  requireValue(
    metric.timeoutRate <= metric.limits.timeoutRate,
    `latency.${name}.timeoutRate exceeds approved limit`,
  );
}

export function verifyScaleEvidence(evidence, expected = {}) {
  requireValue(evidence && typeof evidence === 'object' && !Array.isArray(evidence), 'evidence must be an object');
  requireValue(evidence.schema === SCALE_EVIDENCE_SCHEMA, `schema must be ${SCALE_EVIDENCE_SCHEMA}`);

  exactHex(evidence.identity?.gitSha, 40, 'identity.gitSha');
  exactHex(evidence.identity?.frontendTreeSha256, 64, 'identity.frontendTreeSha256');
  nonEmpty(evidence.identity?.providerRelease, 'identity.providerRelease');
  nonEmpty(evidence.identity?.cdnRelease, 'identity.cdnRelease');
  if (expected.gitSha) requireValue(evidence.identity.gitSha === expected.gitSha, 'identity.gitSha mismatch');
  if (expected.frontendTreeSha256) {
    requireValue(
      evidence.identity.frontendTreeSha256 === expected.frontendTreeSha256,
      'identity.frontendTreeSha256 mismatch',
    );
  }

  requireValue(evidence.approval?.status === 'approved', 'approval.status must be approved');
  timestamp(evidence.approval?.approvedAt, 'approval.approvedAt');
  nonEmpty(evidence.approval?.evidenceRef, 'approval.evidenceRef');
  nonEmpty(evidence.approval?.workloadOwner, 'approval.workloadOwner');
  nonEmpty(evidence.approval?.providerOwner, 'approval.providerOwner');
  nonEmpty(evidence.approval?.platformOwner, 'approval.platformOwner');

  requireValue(evidence.environment?.productionEquivalent === true, 'environment must be production-equivalent');
  requireValue(evidence.environment?.mocked === false, 'mocked environment evidence is not accepted');
  requireValue(
    Array.isArray(evidence.environment?.regions) && evidence.environment.regions.length > 0,
    'environment.regions is required',
  );
  nonEmpty(evidence.environment?.dataPolicy, 'environment.dataPolicy');

  requireValue(
    evidence.workload?.populationUsers === 1_000_000,
    'workload.populationUsers must bind the one-million-user planning population',
  );
  for (const key of [
    'peakConcurrentUsers',
    'targetRps',
    'achievedPeakConcurrentUsers',
    'achievedRps',
    'rampSeconds',
    'steadyStateSeconds',
    'soakSeconds',
  ]) {
    finitePositive(evidence.workload?.[key], `workload.${key}`);
  }
  requireValue(
    evidence.workload.achievedPeakConcurrentUsers >= evidence.workload.peakConcurrentUsers,
    'approved peak concurrency was not achieved',
  );
  requireValue(evidence.workload.achievedRps >= evidence.workload.targetRps, 'approved request rate was not achieved');
  timestamp(evidence.run?.startedAt, 'run.startedAt');
  timestamp(evidence.run?.completedAt, 'run.completedAt');
  nonEmpty(evidence.run?.id, 'run.id');
  requireValue(
    Date.parse(evidence.approval.approvedAt) <= Date.parse(evidence.run.startedAt),
    'workload and limits must be approved before the run starts',
  );
  requireValue(Date.parse(evidence.run.completedAt) > Date.parse(evidence.run.startedAt), 'run duration is invalid');
  const runDurationSeconds = (Date.parse(evidence.run.completedAt) - Date.parse(evidence.run.startedAt)) / 1000;
  const claimedPhaseSeconds =
    evidence.workload.rampSeconds + evidence.workload.steadyStateSeconds + evidence.workload.soakSeconds;
  requireValue(
    runDurationSeconds >= claimedPhaseSeconds,
    'run duration is shorter than the claimed workload phase duration',
  );

  const requiredEndpoints = ['frontend', 'authenticate', 'play', 'event', 'endRound', 'replay'];
  for (const name of requiredEndpoints) verifyLatencyMetric(name, evidence.latency?.[name]);
  positiveInteger(evidence.workload?.measuredRequests, 'workload.measuredRequests');
  const measuredEndpointRequests = requiredEndpoints.reduce((sum, name) => {
    positiveInteger(evidence.latency[name].requests, `latency.${name}.requests`);
    return sum + evidence.latency[name].requests;
  }, 0);
  requireValue(
    evidence.workload.measuredRequests === measuredEndpointRequests,
    'workload.measuredRequests must equal the sum of endpoint request samples',
  );

  finitePositive(evidence.cdn?.requests, 'cdn.requests');
  finitePositive(evidence.cdn?.cacheableRequests, 'cdn.cacheableRequests');
  requireValue(Number.isFinite(evidence.cdn?.cacheHits) && evidence.cdn.cacheHits >= 0, 'cdn.cacheHits is invalid');
  requireValue(Number.isFinite(evidence.cdn?.originRequests) && evidence.cdn.originRequests >= 0, 'cdn.originRequests is invalid');
  requireValue(Number.isFinite(evidence.cdn?.originEgressBytes) && evidence.cdn.originEgressBytes >= 0, 'cdn.originEgressBytes is invalid');
  requireValue(evidence.cdn.cacheHits <= evidence.cdn.cacheableRequests, 'cdn.cacheHits exceeds cacheableRequests');
  const cacheHitRate = evidence.cdn.cacheHits / evidence.cdn.cacheableRequests;
  const originRequestRatio = evidence.cdn.originRequests / evidence.cdn.requests;
  boundedRatio(evidence.cdn.limits?.minCacheHitRate, 'cdn.limits.minCacheHitRate');
  boundedRatio(evidence.cdn.limits?.maxOriginRequestRatio, 'cdn.limits.maxOriginRequestRatio');
  finitePositive(evidence.cdn.limits?.maxOriginEgressBytes, 'cdn.limits.maxOriginEgressBytes');
  requireValue(cacheHitRate >= evidence.cdn.limits.minCacheHitRate, 'CDN cache hit rate is below approved limit');
  requireValue(originRequestRatio <= evidence.cdn.limits.maxOriginRequestRatio, 'CDN origin ratio exceeds approved limit');
  requireValue(evidence.cdn.originEgressBytes <= evidence.cdn.limits.maxOriginEgressBytes, 'CDN origin egress exceeds approved limit');
  requireValue(evidence.cdn.invalidationValidated === true, 'CDN invalidation was not validated');

  finitePositive(evidence.idempotency?.paidPlayAttempts, 'idempotency.paidPlayAttempts');
  finitePositive(evidence.idempotency?.settlementAttempts, 'idempotency.settlementAttempts');
  finitePositive(evidence.idempotency?.uncertainRecoveryCases, 'idempotency.uncertainRecoveryCases');
  for (const key of [
    'duplicateAcceptedPaidPlays',
    'duplicateSettlements',
    'negativeBalances',
    'payoutMismatches',
    'uncertainRecoveryDuplicateWrites',
  ]) {
    requireValue(evidence.idempotency?.[key] === 0, `idempotency.${key} must be zero`);
  }

  requireValue(Array.isArray(evidence.resilience?.scenarios), 'resilience.scenarios is required');
  for (const name of expectedResilienceScenarios) {
    const scenario = evidence.resilience.scenarios.find((entry) => entry?.name === name);
    requireValue(scenario?.executed === true, `resilience scenario ${name} was not executed`);
    requireValue(scenario?.recovered === true, `resilience scenario ${name} did not recover`);
    requireValue(scenario?.duplicateWrites === 0, `resilience scenario ${name} produced duplicate writes`);
    finitePositive(scenario?.recoverySeconds, `resilience scenario ${name}.recoverySeconds`);
    finitePositive(scenario?.limitSeconds, `resilience scenario ${name}.limitSeconds`);
    requireValue(scenario.recoverySeconds <= scenario.limitSeconds, `resilience scenario ${name} exceeded recovery limit`);
  }

  requireValue(Array.isArray(evidence.saturation) && evidence.saturation.length > 0, 'saturation metrics are required');
  for (const metric of evidence.saturation) {
    nonEmpty(metric?.name, 'saturation metric name');
    requireValue(Number.isFinite(metric?.maxObserved) && metric.maxObserved >= 0, `saturation.${metric?.name}.maxObserved is invalid`);
    finitePositive(metric?.limit, `saturation.${metric?.name}.limit`);
    requireValue(metric.maxObserved <= metric.limit, `saturation.${metric.name} exceeds approved limit`);
  }

  for (const key of ['logsCorrelated', 'metricsCorrelated', 'tracesCorrelated', 'dashboardsCaptured']) {
    requireValue(evidence.observability?.[key] === true, `observability.${key} must be true`);
  }
  requireValue(
    Array.isArray(evidence.observability?.alertDrills) &&
      evidence.observability.alertDrills.length > 0 &&
      evidence.observability.alertDrills.every((drill) => drill?.fired === true && drill?.acknowledged === true),
    'observability alert drills must fire and be acknowledged',
  );

  requireValue(evidence.rollback?.executed === true, 'rollback rehearsal was not executed');
  requireValue(evidence.rollback?.healthyAfterRollback === true, 'rollback did not restore health');
  finitePositive(evidence.rollback?.recoverySeconds, 'rollback.recoverySeconds');
  finitePositive(evidence.rollback?.limitSeconds, 'rollback.limitSeconds');
  requireValue(evidence.rollback.recoverySeconds <= evidence.rollback.limitSeconds, 'rollback exceeded approved limit');

  requireValue(Array.isArray(evidence.artifacts), 'evidence artifacts are required');
  const artifactRoles = evidence.artifacts.map((artifact) => artifact?.role);
  requireValue(new Set(artifactRoles).size === artifactRoles.length, 'artifact roles must be unique');
  for (const role of requiredArtifactRoles) {
    requireValue(artifactRoles.includes(role), `required artifact role ${role} is missing`);
  }
  for (const artifact of evidence.artifacts) {
    nonEmpty(artifact?.role, 'artifact.role');
    nonEmpty(artifact?.name, 'artifact.name');
    requireValue(artifact?.runId === evidence.run.id, `artifact ${artifact?.role}.runId mismatch`);
    positiveInteger(artifact?.bytes, `artifact ${artifact?.role}.bytes`);
    exactHex(artifact?.sha256, 64, `artifact ${artifact?.name}.sha256`);
  }

  return {
    schema: SCALE_EVIDENCE_SCHEMA,
    status: 'PASS',
    claim: 'EXTERNAL_SCALE_EVIDENCE_VALIDATED',
    identity: evidence.identity,
    approvedWorkload: {
      populationUsers: evidence.workload.populationUsers,
      peakConcurrentUsers: evidence.workload.peakConcurrentUsers,
      targetRps: evidence.workload.targetRps,
    },
    achievedWorkload: {
      peakConcurrentUsers: evidence.workload.achievedPeakConcurrentUsers,
      rps: evidence.workload.achievedRps,
    },
    cdn: { cacheHitRate, originRequestRatio },
    warning:
      'This validates supplied production-equivalent evidence; it does not turn CI self-tests or mocked traffic into a capacity claim.',
  };
}

export function createSelfTestEvidence() {
  const latency = Object.fromEntries(
    ['frontend', 'authenticate', 'play', 'event', 'endRound', 'replay'].map((name) => [
      name,
      {
        requests: 10_000,
        p50Ms: 40,
        p95Ms: 90,
        p99Ms: 140,
        errorRate: 0.0005,
        timeoutRate: 0.0001,
        limits: { p95Ms: 100, p99Ms: 150, errorRate: 0.001, timeoutRate: 0.0005 },
      },
    ]),
  );
  return {
    schema: SCALE_EVIDENCE_SCHEMA,
    identity: {
      gitSha: 'a'.repeat(40),
      frontendTreeSha256: 'b'.repeat(64),
      providerRelease: 'provider-release-test',
      cdnRelease: 'cdn-release-test',
    },
    approval: {
      status: 'approved',
      approvedAt: '2026-09-03T00:00:00.000Z',
      evidenceRef: 'change-test-approved-001',
      workloadOwner: 'test-workload-owner',
      providerOwner: 'test-provider-owner',
      platformOwner: 'test-platform-owner',
    },
    environment: {
      productionEquivalent: true,
      mocked: false,
      regions: ['eu-test-1'],
      dataPolicy: 'approved synthetic non-player funds',
    },
    workload: {
      populationUsers: 1_000_000,
      peakConcurrentUsers: 100_000,
      targetRps: 25_000,
      achievedPeakConcurrentUsers: 100_000,
      achievedRps: 25_000,
      measuredRequests: 60_000,
      rampSeconds: 900,
      steadyStateSeconds: 1800,
      soakSeconds: 3600,
    },
    run: {
      id: 'scale-run-test-001',
      startedAt: '2026-09-03T00:00:00.000Z',
      completedAt: '2026-09-03T02:00:00.000Z',
    },
    latency,
    cdn: {
      requests: 1_000_000,
      cacheableRequests: 800_000,
      cacheHits: 760_000,
      originRequests: 40_000,
      originEgressBytes: 1_000_000_000,
      limits: { minCacheHitRate: 0.9, maxOriginRequestRatio: 0.05, maxOriginEgressBytes: 2_000_000_000 },
      invalidationValidated: true,
    },
    idempotency: {
      paidPlayAttempts: 500_000,
      settlementAttempts: 100_000,
      uncertainRecoveryCases: 100,
      duplicateAcceptedPaidPlays: 0,
      duplicateSettlements: 0,
      negativeBalances: 0,
      payoutMismatches: 0,
      uncertainRecoveryDuplicateWrites: 0,
    },
    resilience: {
      scenarios: expectedResilienceScenarios.map((name) => ({
        name,
        executed: true,
        recovered: true,
        duplicateWrites: 0,
        recoverySeconds: 20,
        limitSeconds: 60,
      })),
    },
    saturation: [
      { name: 'rgs-cpu-percent', maxObserved: 70, limit: 80 },
      { name: 'provider-connection-pool-percent', maxObserved: 65, limit: 80 },
    ],
    observability: {
      logsCorrelated: true,
      metricsCorrelated: true,
      tracesCorrelated: true,
      dashboardsCaptured: true,
      alertDrills: [{ name: 'rgs-error-rate', fired: true, acknowledged: true }],
    },
    rollback: { executed: true, healthyAfterRollback: true, recoverySeconds: 45, limitSeconds: 120 },
    artifacts: requiredArtifactRoles.map((role) => ({
      role,
      name: `${role}.json`,
      runId: 'scale-run-test-001',
      bytes: 1_024,
      sha256: createHash('sha256').update(role).digest('hex'),
    })),
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function runSelfTest() {
  const valid = createSelfTestEvidence();
  const cases = [
    ['valid evidence', valid, true],
    ['wrong commit', Object.assign(clone(valid), { identity: { ...valid.identity, gitSha: 'c'.repeat(40) } }), false],
    ['wrong population', Object.assign(clone(valid), { workload: { ...valid.workload, populationUsers: 999_999 } }), false],
    ['mocked environment', Object.assign(clone(valid), { environment: { ...valid.environment, mocked: true } }), false],
    ['missed concurrency', Object.assign(clone(valid), { workload: { ...valid.workload, achievedPeakConcurrentUsers: 99_999 } }), false],
    ['missed rps', Object.assign(clone(valid), { workload: { ...valid.workload, achievedRps: 24_999 } }), false],
    ['latency breach', (() => { const value = clone(valid); value.latency.play.p99Ms = 151; return value; })(), false],
    ['cache breach', (() => { const value = clone(valid); value.cdn.cacheHits = 700_000; return value; })(), false],
    ['duplicate settlement', (() => { const value = clone(valid); value.idempotency.duplicateSettlements = 1; return value; })(), false],
    ['missing resilience', (() => { const value = clone(valid); value.resilience.scenarios.pop(); return value; })(), false],
    ['saturation breach', (() => { const value = clone(valid); value.saturation[0].maxObserved = 81; return value; })(), false],
    ['missing observability', (() => { const value = clone(valid); value.observability.tracesCorrelated = false; return value; })(), false],
    ['rollback breach', (() => { const value = clone(valid); value.rollback.recoverySeconds = 121; return value; })(), false],
    ['invalid artifact digest', (() => { const value = clone(valid); value.artifacts[0].sha256 = 'nope'; return value; })(), false],
    ['approval after start', (() => { const value = clone(valid); value.approval.approvedAt = '2026-09-03T00:00:01.000Z'; return value; })(), false],
    ['phase duration mismatch', (() => { const value = clone(valid); value.run.completedAt = '2026-09-03T01:00:00.000Z'; return value; })(), false],
    ['request total mismatch', (() => { const value = clone(valid); value.workload.measuredRequests -= 1; return value; })(), false],
    ['duplicate artifact role', (() => { const value = clone(valid); value.artifacts[5] = { ...value.artifacts[0] }; return value; })(), false],
    ['missing artifact role', (() => { const value = clone(valid); value.artifacts = value.artifacts.filter((artifact) => artifact.role !== 'rollback-report'); return value; })(), false],
  ];
  let passed = 0;
  for (const [name, evidence, expectedPass] of cases) {
    let didPass = false;
    try {
      verifyScaleEvidence(evidence, {
        gitSha: valid.identity.gitSha,
        frontendTreeSha256: valid.identity.frontendTreeSha256,
      });
      didPass = true;
    } catch {
      didPass = false;
    }
    requireValue(didPass === expectedPass, `self-test failed: ${name}`);
    passed += 1;
  }
  process.stdout.write(`BLACKSITE scale evidence gate self-test: ${passed}/${cases.length} PASS\n`);
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes('--self-test')) {
    runSelfTest();
  } else {
    const evidencePath = argument('--evidence');
    const gitSha = argument('--expected-commit');
    const frontendTreeSha256 = argument('--expected-frontend-tree');
    requireValue(evidencePath && gitSha && frontendTreeSha256, 'Usage: node scripts/blacksite-scale-evidence.mjs --evidence <json> --expected-commit <sha> --expected-frontend-tree <sha256> [--output <json>]');
    const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
    const result = verifyScaleEvidence(evidence, { gitSha, frontendTreeSha256 });
    const output = `${JSON.stringify(result, null, 2)}\n`;
    const outputPath = argument('--output');
    if (outputPath) writeFileSync(outputPath, output, 'utf8');
    else process.stdout.write(output);
  }
}
