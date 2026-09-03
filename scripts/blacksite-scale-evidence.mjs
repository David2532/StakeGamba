import { createHash, createPublicKey, generateKeyPairSync, sign as signPayload, verify as verifySignature } from 'node:crypto';
import { lstatSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCALE_EVIDENCE_SCHEMA = 'blacksite-scale-evidence-v6';
export const SCALE_ARTIFACT_BINDING_SCHEMA = 'blacksite-scale-artifact-binding-v2';
export const SCALE_ARTIFACT_ATTESTATION_SCHEMA = 'blacksite-scale-artifact-attestation-v1';
export const SCALE_TRUST_STORE_SCHEMA = 'blacksite-scale-trusted-signers-v3';
const expectedResilienceScenarios = Object.freeze(['cdn-origin-degradation', 'rgs-http-5xx', 'provider-timeout', 'instance-restart']);
const requiredArtifactRoles = Object.freeze(['load-report', 'cdn-report', 'provider-ledger', 'resilience-report', 'observability-export', 'rollback-report']);
const requiredLatencyEndpoints = Object.freeze(['frontend', 'authenticate', 'play', 'event', 'endRound', 'replay']);

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
  requireValue(typeof value === 'string' && new RegExp(`^[0-9a-f]{${length}}$`, 'u').test(value), `${name} must be ${length} lowercase hexadecimal characters`);
}

function timestamp(value, name) {
  nonEmpty(value, name);
  requireValue(Number.isFinite(Date.parse(value)), `${name} must be an ISO-8601 timestamp`);
}

function containedRelativePath(root, candidate, name) {
  const fromRoot = relative(root, candidate);
  requireValue(fromRoot.length > 0 && fromRoot !== '..' && !fromRoot.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`), `${name} must stay inside the artifacts root`);
}

function requirePathOutsideRoot(root, candidate, name) {
  const fromRoot = relative(root, candidate);
  const parentPrefix = `..${process.platform === 'win32' ? '\\' : '/'}`;
  requireValue(fromRoot === '..' || fromRoot.startsWith(parentPrefix) || isAbsolute(fromRoot), `${name} must be outside artifacts-root`);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function sha256Value(value) {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}

function canonicalBytes(value) {
  return Buffer.from(JSON.stringify(canonicalize(value)), 'utf8');
}

function requiredSignerForRole(evidence, role) {
  const byRole = {
    'load-report': evidence.approval.workloadOwner,
    'cdn-report': evidence.approval.platformOwner,
    'provider-ledger': evidence.approval.providerOwner,
    'resilience-report': evidence.approval.providerOwner,
    'observability-export': evidence.approval.platformOwner,
    'rollback-report': evidence.approval.platformOwner,
  };
  requireValue(Object.hasOwn(byRole, role), `artifact role ${role} has no signer owner`);
  return byRole[role];
}

function measurementsForRole(evidence, role) {
  const byRole = {
    'load-report': {
      environment: evidence.environment,
      latency: evidence.latency,
      run: evidence.run,
      workload: evidence.workload,
    },
    'cdn-report': { cdn: evidence.cdn, run: evidence.run },
    'provider-ledger': { idempotency: evidence.idempotency, run: evidence.run },
    'resilience-report': {
      resilience: evidence.resilience,
      run: evidence.run,
      saturation: evidence.saturation,
    },
    'observability-export': { observability: evidence.observability, run: evidence.run },
    'rollback-report': { rollback: evidence.rollback, run: evidence.run },
  };
  requireValue(Object.hasOwn(byRole, role), `artifact role ${role} cannot be bound`);
  return byRole[role];
}

export function createScaleArtifactBinding(evidence, role) {
  return {
    schema: SCALE_ARTIFACT_BINDING_SCHEMA,
    role,
    runId: evidence.run.id,
    identitySha256: sha256Value(evidence.identity),
    measurementsSha256: sha256Value(measurementsForRole(evidence, role)),
  };
}

export function createScaleArtifactProof(evidence, role) {
  return {
    blacksiteScaleBinding: createScaleArtifactBinding(evidence, role),
    blacksiteScaleIdentity: evidence.identity,
    blacksiteScaleMeasurements: measurementsForRole(evidence, role),
  };
}

function createAttestationPayload(evidence, role, unsignedReport, signerId, signedAt) {
  return {
    schema: SCALE_ARTIFACT_ATTESTATION_SCHEMA,
    role,
    runId: evidence.run.id,
    signerId,
    signedAt,
    bindingSha256: sha256Value(createScaleArtifactBinding(evidence, role)),
    reportSha256: sha256Value(unsignedReport),
  };
}

export function createScaleArtifactAttestation(evidence, role, unsignedReport, { signerId, privateKey, signedAt = evidence.run.completedAt }) {
  const payload = createAttestationPayload(evidence, role, unsignedReport, signerId, signedAt);
  return {
    ...payload,
    signatureBase64: signPayload(null, canonicalBytes(payload), privateKey).toString('base64'),
  };
}

function preRunApprovalPlan(evidence) {
  return {
    approval: evidence.approval,
    environment: evidence.environment,
    workload: {
      populationUsers: evidence.workload?.populationUsers,
      peakConcurrentUsers: evidence.workload?.peakConcurrentUsers,
      targetRps: evidence.workload?.targetRps,
      rampSeconds: evidence.workload?.rampSeconds,
      steadyStateSeconds: evidence.workload?.steadyStateSeconds,
      soakSeconds: evidence.workload?.soakSeconds,
    },
    latencyLimits: Object.fromEntries(requiredLatencyEndpoints.map((name) => [name, evidence.latency?.[name]?.limits])),
    cdnLimits: evidence.cdn?.limits,
    resilienceLimits: evidence.resilience?.scenarios?.map((scenario) => ({ name: scenario?.name, limitSeconds: scenario?.limitSeconds })),
    saturationLimits: evidence.saturation?.map((metric) => ({ name: metric?.name, limit: metric?.limit })),
    alertDrills: evidence.observability?.alertDrills?.map((drill) => drill?.name),
    rollbackLimitSeconds: evidence.rollback?.limitSeconds,
  };
}

export function createScaleTrustStore(evidence, signers) {
  return {
    schema: SCALE_TRUST_STORE_SCHEMA,
    identitySha256: sha256Value(evidence.identity),
    approvedPlanSha256: sha256Value(preRunApprovalPlan(evidence)),
    signers,
  };
}

function verifyTrustedSigners(evidence, trustStore) {
  requireValue(trustStore && typeof trustStore === 'object', 'trusted signer trust store is required');
  requireValue(trustStore.schema === SCALE_TRUST_STORE_SCHEMA, `trust store schema must be ${SCALE_TRUST_STORE_SCHEMA}`);
  requireValue(trustStore.identitySha256 === sha256Value(evidence.identity), 'trust store release identity does not match evidence');
  requireValue(trustStore.approvedPlanSha256 === sha256Value(preRunApprovalPlan(evidence)), 'trust store pre-run approval plan does not match evidence');
  requireValue(Array.isArray(trustStore.signers) && trustStore.signers.length > 0, 'trusted signers are required');
  const ids = trustStore.signers.map((signer) => signer?.id);
  requireValue(new Set(ids).size === ids.length, 'trusted signer ids must be unique');
  const trusted = new Map();
  const publicKeyFingerprints = new Set();
  for (const signer of trustStore.signers) {
    nonEmpty(signer?.id, 'trusted signer id');
    requireValue(Array.isArray(signer.roles) && signer.roles.length > 0, `trusted signer ${signer.id}.roles is required`);
    requireValue(new Set(signer.roles).size === signer.roles.length, `trusted signer ${signer.id}.roles must be unique`);
    for (const role of signer.roles) {
      requireValue(requiredArtifactRoles.includes(role), `trusted signer ${signer.id} has unknown role ${role}`);
    }
    nonEmpty(signer.publicKeyPem, `trusted signer ${signer.id}.publicKeyPem`);
    let publicKey;
    try {
      publicKey = createPublicKey(signer.publicKeyPem);
    } catch {
      fail(`trusted signer ${signer.id} public key is invalid`);
    }
    requireValue(publicKey.asymmetricKeyType === 'ed25519', `trusted signer ${signer.id} key must be Ed25519`);
    const publicKeyFingerprint = createHash('sha256').update(publicKey.export({ type: 'spki', format: 'der' })).digest('hex');
    requireValue(!publicKeyFingerprints.has(publicKeyFingerprint), 'trusted signer public keys must be unique across approval owners');
    publicKeyFingerprints.add(publicKeyFingerprint);
    trusted.set(signer.id, { ...signer, publicKey });
  }
  return trusted;
}

export async function verifyScaleEvidenceArtifacts(evidence, artifactsRoot, trustStore) {
  nonEmpty(artifactsRoot, 'artifacts-root');
  const trustedSigners = verifyTrustedSigners(evidence, trustStore);
  const rootStat = lstatSync(artifactsRoot, { throwIfNoEntry: false });
  requireValue(rootStat?.isDirectory() === true && rootStat.isSymbolicLink() === false, 'artifacts-root must be a real directory');
  const realRoot = realpathSync(artifactsRoot);
  const names = evidence.artifacts.map((artifact) => artifact?.name);
  requireValue(new Set(names).size === names.length, 'artifact names must be unique');

  const realPaths = new Set();
  const verifiedArtifacts = [];
  for (const artifact of evidence.artifacts) {
    nonEmpty(artifact?.name, 'artifact.name');
    requireValue(!isAbsolute(artifact.name), `artifact ${artifact.role}.name must be relative`);
    requireValue(!artifact.name.includes('\\'), `artifact ${artifact.role}.name must use portable separators`);
    requireValue(
      artifact.name.split('/').every((segment) => segment.length > 0 && segment !== '.' && segment !== '..'),
      `artifact ${artifact.role}.name contains an unsafe path segment`,
    );

    const candidate = resolve(realRoot, artifact.name);
    containedRelativePath(realRoot, candidate, `artifact ${artifact.role}.name`);
    const candidateStat = lstatSync(candidate, { throwIfNoEntry: false });
    requireValue(candidateStat, `artifact ${artifact.role} is missing`);
    requireValue(candidateStat.isSymbolicLink() === false, `artifact ${artifact.role} must not be a symbolic link`);
    requireValue(candidateStat.isFile() === true, `artifact ${artifact.role} must be a regular file`);

    const realCandidate = realpathSync(candidate);
    containedRelativePath(realRoot, realCandidate, `artifact ${artifact.role}.realPath`);
    requireValue(!realPaths.has(realCandidate), 'artifact files must be unique');
    realPaths.add(realCandidate);
    requireValue(candidateStat.size === artifact.bytes, `artifact ${artifact.role}.bytes mismatch`);
    const content = readFileSync(realCandidate);
    requireValue(content.byteLength === artifact.bytes, `artifact ${artifact.role}.bytes changed during readback`);
    const digest = createHash('sha256').update(content).digest('hex');
    requireValue(digest === artifact.sha256, `artifact ${artifact.role}.sha256 mismatch`);
    let parsed;
    try {
      parsed = JSON.parse(content.toString('utf8'));
    } catch {
      fail(`artifact ${artifact.role} must be structured JSON with a scale binding`);
    }
    const binding = parsed?.blacksiteScaleBinding;
    requireValue(binding && typeof binding === 'object', `artifact ${artifact.role} structured binding is required`);
    const expectedBinding = createScaleArtifactBinding(evidence, artifact.role);
    for (const key of ['schema', 'role', 'runId', 'identitySha256', 'measurementsSha256']) {
      requireValue(binding[key] === expectedBinding[key], `artifact ${artifact.role} binding.${key} mismatch`);
    }
    requireValue(sha256Value(parsed.blacksiteScaleIdentity) === binding.identitySha256, `artifact ${artifact.role} embedded identity does not match its binding`);
    requireValue(sha256Value(parsed.blacksiteScaleMeasurements) === binding.measurementsSha256, `artifact ${artifact.role} embedded measurements do not match its binding`);
    const attestation = parsed.blacksiteScaleAttestation;
    requireValue(attestation && typeof attestation === 'object', `artifact ${artifact.role} signer attestation is required`);
    const expectedSignerId = requiredSignerForRole(evidence, artifact.role);
    requireValue(attestation.signerId === expectedSignerId, `artifact ${artifact.role} signer does not match its approved owner`);
    const trustedSigner = trustedSigners.get(attestation.signerId);
    requireValue(trustedSigner, `artifact ${artifact.role} signer is not in the trusted signer store`);
    requireValue(trustedSigner.roles.includes(artifact.role), `artifact ${artifact.role} signer is not trusted for this role`);
    timestamp(attestation.signedAt, `artifact ${artifact.role}.attestation.signedAt`);
    requireValue(Date.parse(attestation.signedAt) >= Date.parse(evidence.run.completedAt), `artifact ${artifact.role} was attested before the run completed`);
    nonEmpty(attestation.signatureBase64, `artifact ${artifact.role}.attestation.signatureBase64`);
    let signature;
    try {
      signature = Buffer.from(attestation.signatureBase64, 'base64');
    } catch {
      fail(`artifact ${artifact.role} attestation signature is invalid base64`);
    }
    requireValue(signature.length > 0 && signature.toString('base64') === attestation.signatureBase64, `artifact ${artifact.role} attestation signature is invalid base64`);
    const unsignedReport = { ...parsed };
    delete unsignedReport.blacksiteScaleAttestation;
    const expectedAttestation = createAttestationPayload(evidence, artifact.role, unsignedReport, attestation.signerId, attestation.signedAt);
    for (const key of ['schema', 'role', 'runId', 'signerId', 'signedAt', 'bindingSha256', 'reportSha256']) {
      requireValue(attestation[key] === expectedAttestation[key], `artifact ${artifact.role} attestation.${key} mismatch`);
    }
    requireValue(verifySignature(null, canonicalBytes(expectedAttestation), trustedSigner.publicKey, signature), `artifact ${artifact.role} attestation signature is not valid`);
    verifiedArtifacts.push({
      role: artifact.role,
      name: artifact.name,
      bytes: candidateStat.size,
      sha256: digest,
      signerId: attestation.signerId,
      signedAt: attestation.signedAt,
    });
  }

  return { status: 'PASS', verifiedArtifacts };
}

function verifyLatencyMetric(name, metric) {
  requireValue(metric && typeof metric === 'object', `latency.${name} is required`);
  finitePositive(metric.requests, `latency.${name}.requests`);
  for (const key of ['p50Ms', 'p95Ms', 'p99Ms']) finitePositive(metric[key], `latency.${name}.${key}`);
  requireValue(metric.p50Ms <= metric.p95Ms && metric.p95Ms <= metric.p99Ms, `latency.${name} percentiles must be monotonic`);
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
  requireValue(metric.timeoutRate <= metric.limits.timeoutRate, `latency.${name}.timeoutRate exceeds approved limit`);
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
    requireValue(evidence.identity.frontendTreeSha256 === expected.frontendTreeSha256, 'identity.frontendTreeSha256 mismatch');
  }

  requireValue(evidence.approval?.status === 'approved', 'approval.status must be approved');
  timestamp(evidence.approval?.approvedAt, 'approval.approvedAt');
  nonEmpty(evidence.approval?.evidenceRef, 'approval.evidenceRef');
  nonEmpty(evidence.approval?.workloadOwner, 'approval.workloadOwner');
  nonEmpty(evidence.approval?.providerOwner, 'approval.providerOwner');
  nonEmpty(evidence.approval?.platformOwner, 'approval.platformOwner');
  const approvalOwners = [evidence.approval.workloadOwner, evidence.approval.providerOwner, evidence.approval.platformOwner];
  requireValue(new Set(approvalOwners).size === approvalOwners.length, 'approval owners must be distinct');

  requireValue(evidence.environment?.productionEquivalent === true, 'environment must be production-equivalent');
  requireValue(evidence.environment?.mocked === false, 'mocked environment evidence is not accepted');
  requireValue(Array.isArray(evidence.environment?.regions) && evidence.environment.regions.length > 0, 'environment.regions is required');
  nonEmpty(evidence.environment?.dataPolicy, 'environment.dataPolicy');

  requireValue(evidence.workload?.populationUsers === 1_000_000, 'workload.populationUsers must bind the one-million-user planning population');
  for (const key of ['peakConcurrentUsers', 'targetRps', 'achievedPeakConcurrentUsers', 'achievedRps', 'rampSeconds', 'steadyStateSeconds', 'soakSeconds']) {
    finitePositive(evidence.workload?.[key], `workload.${key}`);
  }
  requireValue(evidence.workload.achievedPeakConcurrentUsers >= evidence.workload.peakConcurrentUsers, 'approved peak concurrency was not achieved');
  requireValue(evidence.workload.achievedRps >= evidence.workload.targetRps, 'approved request rate was not achieved');
  timestamp(evidence.run?.startedAt, 'run.startedAt');
  timestamp(evidence.run?.completedAt, 'run.completedAt');
  nonEmpty(evidence.run?.id, 'run.id');
  requireValue(Date.parse(evidence.approval.approvedAt) <= Date.parse(evidence.run.startedAt), 'workload and limits must be approved before the run starts');
  requireValue(Date.parse(evidence.run.completedAt) > Date.parse(evidence.run.startedAt), 'run duration is invalid');
  const runDurationSeconds = (Date.parse(evidence.run.completedAt) - Date.parse(evidence.run.startedAt)) / 1000;
  const claimedPhaseSeconds = evidence.workload.rampSeconds + evidence.workload.steadyStateSeconds + evidence.workload.soakSeconds;
  requireValue(runDurationSeconds >= claimedPhaseSeconds, 'run duration is shorter than the claimed workload phase duration');

  for (const name of requiredLatencyEndpoints) verifyLatencyMetric(name, evidence.latency?.[name]);
  positiveInteger(evidence.workload?.measuredRequests, 'workload.measuredRequests');
  const measuredEndpointRequests = requiredLatencyEndpoints.reduce((sum, name) => {
    positiveInteger(evidence.latency[name].requests, `latency.${name}.requests`);
    return sum + evidence.latency[name].requests;
  }, 0);
  requireValue(evidence.workload.measuredRequests === measuredEndpointRequests, 'workload.measuredRequests must equal the sum of endpoint request samples');

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
  for (const key of ['duplicateAcceptedPaidPlays', 'duplicateSettlements', 'negativeBalances', 'payoutMismatches', 'uncertainRecoveryDuplicateWrites']) {
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
    claim: 'EXTERNAL_SCALE_METADATA_VALIDATED',
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
    warning: 'Metadata validation is incomplete until the CLI reads back every bound artifact; CI self-tests and mocked traffic never prove capacity.',
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
      limits: {
        minCacheHitRate: 0.9,
        maxOriginRequestRatio: 0.05,
        maxOriginEgressBytes: 2_000_000_000,
      },
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
    rollback: {
      executed: true,
      healthyAfterRollback: true,
      recoverySeconds: 45,
      limitSeconds: 120,
    },
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

function createSelfTestTrust(evidence) {
  const signerRoles = new Map([
    [evidence.approval.workloadOwner, ['load-report']],
    [evidence.approval.providerOwner, ['provider-ledger', 'resilience-report']],
    [evidence.approval.platformOwner, ['cdn-report', 'observability-export', 'rollback-report']],
  ]);
  const privateKeys = new Map();
  const signers = [];
  for (const [id, roles] of signerRoles) {
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    privateKeys.set(id, privateKey);
    signers.push({
      id,
      roles,
      publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }),
    });
  }
  return { privateKeys, trustStore: createScaleTrustStore(evidence, signers) };
}

function materializeSelfTestArtifacts(evidence, directory, privateKeys) {
  for (const artifact of evidence.artifacts) {
    const unsignedReport = {
      ...createScaleArtifactProof(evidence, artifact.role),
      selfTest: true,
    };
    const signerId = requiredSignerForRole(evidence, artifact.role);
    const content = `${JSON.stringify({
      ...unsignedReport,
      blacksiteScaleAttestation: createScaleArtifactAttestation(evidence, artifact.role, unsignedReport, {
        signerId,
        privateKey: privateKeys.get(signerId),
      }),
    })}\n`;
    writeFileSync(join(directory, artifact.name), content, 'utf8');
    artifact.bytes = Buffer.byteLength(content);
    artifact.sha256 = createHash('sha256').update(content).digest('hex');
  }
}

function rewriteSelfTestArtifact(evidence, directory, index, report) {
  const artifact = evidence.artifacts[index];
  const content = `${JSON.stringify(report)}\n`;
  writeFileSync(join(directory, artifact.name), content, 'utf8');
  artifact.bytes = Buffer.byteLength(content);
  artifact.sha256 = createHash('sha256').update(content).digest('hex');
}

async function runSelfTest() {
  const valid = createSelfTestEvidence();
  const cases = [
    ['valid evidence', valid, true],
    ['wrong commit', Object.assign(clone(valid), { identity: { ...valid.identity, gitSha: 'c'.repeat(40) } }), false],
    ['wrong population', Object.assign(clone(valid), { workload: { ...valid.workload, populationUsers: 999_999 } }), false],
    ['mocked environment', Object.assign(clone(valid), { environment: { ...valid.environment, mocked: true } }), false],
    [
      'missed concurrency',
      Object.assign(clone(valid), {
        workload: { ...valid.workload, achievedPeakConcurrentUsers: 99_999 },
      }),
      false,
    ],
    ['missed rps', Object.assign(clone(valid), { workload: { ...valid.workload, achievedRps: 24_999 } }), false],
    [
      'latency breach',
      (() => {
        const value = clone(valid);
        value.latency.play.p99Ms = 151;
        return value;
      })(),
      false,
    ],
    [
      'cache breach',
      (() => {
        const value = clone(valid);
        value.cdn.cacheHits = 700_000;
        return value;
      })(),
      false,
    ],
    [
      'duplicate settlement',
      (() => {
        const value = clone(valid);
        value.idempotency.duplicateSettlements = 1;
        return value;
      })(),
      false,
    ],
    [
      'missing resilience',
      (() => {
        const value = clone(valid);
        value.resilience.scenarios.pop();
        return value;
      })(),
      false,
    ],
    [
      'saturation breach',
      (() => {
        const value = clone(valid);
        value.saturation[0].maxObserved = 81;
        return value;
      })(),
      false,
    ],
    [
      'missing observability',
      (() => {
        const value = clone(valid);
        value.observability.tracesCorrelated = false;
        return value;
      })(),
      false,
    ],
    [
      'rollback breach',
      (() => {
        const value = clone(valid);
        value.rollback.recoverySeconds = 121;
        return value;
      })(),
      false,
    ],
    [
      'invalid artifact digest',
      (() => {
        const value = clone(valid);
        value.artifacts[0].sha256 = 'nope';
        return value;
      })(),
      false,
    ],
    [
      'approval after start',
      (() => {
        const value = clone(valid);
        value.approval.approvedAt = '2026-09-03T00:00:01.000Z';
        return value;
      })(),
      false,
    ],
    [
      'phase duration mismatch',
      (() => {
        const value = clone(valid);
        value.run.completedAt = '2026-09-03T01:00:00.000Z';
        return value;
      })(),
      false,
    ],
    [
      'request total mismatch',
      (() => {
        const value = clone(valid);
        value.workload.measuredRequests -= 1;
        return value;
      })(),
      false,
    ],
    [
      'duplicate artifact role',
      (() => {
        const value = clone(valid);
        value.artifacts[5] = { ...value.artifacts[0] };
        return value;
      })(),
      false,
    ],
    [
      'missing artifact role',
      (() => {
        const value = clone(valid);
        value.artifacts = value.artifacts.filter((artifact) => artifact.role !== 'rollback-report');
        return value;
      })(),
      false,
    ],
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

  const artifactCases = [
    ['valid artifact readback', () => {}, true],
    ['tampered artifact', (evidence, directory) => writeFileSync(join(directory, evidence.artifacts[0].name), 'tampered\n', 'utf8'), false],
    [
      'artifact size mismatch',
      (evidence) => {
        evidence.artifacts[0].bytes += 1;
      },
      false,
    ],
    [
      'artifact measurement contradiction',
      (evidence, directory) => {
        const artifact = evidence.artifacts[0];
        const artifactPath = join(directory, artifact.name);
        const report = JSON.parse(readFileSync(artifactPath, 'utf8'));
        report.blacksiteScaleMeasurements.workload.achievedRps -= 1;
        const content = `${JSON.stringify(report)}\n`;
        writeFileSync(artifactPath, content, 'utf8');
        artifact.bytes = Buffer.byteLength(content);
        artifact.sha256 = createHash('sha256').update(content).digest('hex');
      },
      false,
    ],
    [
      'unstructured artifact',
      (evidence, directory) => {
        const artifact = evidence.artifacts[0];
        const artifactPath = join(directory, artifact.name);
        const content = `${artifact.role}\n`;
        writeFileSync(artifactPath, content, 'utf8');
        artifact.bytes = Buffer.byteLength(content);
        artifact.sha256 = createHash('sha256').update(content).digest('hex');
      },
      false,
    ],
    [
      'missing signer attestation',
      (evidence, directory) => {
        const artifactPath = join(directory, evidence.artifacts[0].name);
        const report = JSON.parse(readFileSync(artifactPath, 'utf8'));
        delete report.blacksiteScaleAttestation;
        rewriteSelfTestArtifact(evidence, directory, 0, report);
      },
      false,
    ],
    [
      'rehashed report with stale signature',
      (evidence, directory) => {
        const artifactPath = join(directory, evidence.artifacts[0].name);
        const report = JSON.parse(readFileSync(artifactPath, 'utf8'));
        report.selfTest = 'forged-after-signing';
        rewriteSelfTestArtifact(evidence, directory, 0, report);
      },
      false,
    ],
    [
      'wrong role signer',
      (evidence, directory, _trustStore, privateKeys) => {
        const artifactPath = join(directory, evidence.artifacts[0].name);
        const report = JSON.parse(readFileSync(artifactPath, 'utf8'));
        delete report.blacksiteScaleAttestation;
        const signerId = evidence.approval.platformOwner;
        report.blacksiteScaleAttestation = createScaleArtifactAttestation(evidence, evidence.artifacts[0].role, report, { signerId, privateKey: privateKeys.get(signerId) });
        rewriteSelfTestArtifact(evidence, directory, 0, report);
      },
      false,
    ],
    [
      'untrusted replacement public key',
      (_evidence, _directory, trustStore) => {
        const { publicKey } = generateKeyPairSync('ed25519');
        trustStore.signers[0].publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
      },
      false,
    ],
    [
      'shared signer key across approval owners',
      (evidence, directory, trustStore, privateKeys) => {
        const workloadOwner = evidence.approval.workloadOwner;
        const providerOwner = evidence.approval.providerOwner;
        const sharedPublicKey = trustStore.signers.find((signer) => signer.id === workloadOwner).publicKeyPem;
        privateKeys.set(providerOwner, privateKeys.get(workloadOwner));
        trustStore.signers.find((signer) => signer.id === providerOwner).publicKeyPem = sharedPublicKey;
        materializeSelfTestArtifacts(evidence, directory, privateKeys);
      },
      false,
    ],
    [
      'substituted pre-run approval metadata',
      (evidence) => {
        evidence.approval.evidenceRef = 'substituted-after-the-run';
      },
      false,
    ],
    ['missing artifact', (evidence, directory) => rmSync(join(directory, evidence.artifacts[0].name)), false],
    [
      'artifact path traversal',
      (evidence) => {
        evidence.artifacts[0].name = '../outside.json';
      },
      false,
    ],
    [
      'artifact symbolic link',
      (evidence, directory) => {
        const artifactPath = join(directory, evidence.artifacts[0].name);
        rmSync(artifactPath);
        symlinkSync(evidence.artifacts[1].name, artifactPath);
      },
      false,
    ],
  ];
  for (const [name, mutate, expectedPass] of artifactCases) {
    const directory = mkdtempSync(join(tmpdir(), 'blacksite-scale-self-test-'));
    let didPass = false;
    try {
      const evidence = createSelfTestEvidence();
      const { privateKeys, trustStore } = createSelfTestTrust(evidence);
      materializeSelfTestArtifacts(evidence, directory, privateKeys);
      mutate(evidence, directory, trustStore, privateKeys);
      await verifyScaleEvidenceArtifacts(evidence, directory, trustStore);
      didPass = true;
    } catch {
      didPass = false;
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
    requireValue(didPass === expectedPass, `self-test failed: ${name}`);
    passed += 1;
  }
  process.stdout.write(`BLACKSITE scale evidence gate self-test: ${passed}/${cases.length + artifactCases.length} PASS\n`);
}

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv.includes('--self-test')) {
    await runSelfTest();
  } else {
    const evidencePath = argument('--evidence');
    const gitSha = argument('--expected-commit');
    const frontendTreeSha256 = argument('--expected-frontend-tree');
    const artifactsRoot = argument('--artifacts-root');
    const trustedSignersPath = argument('--trusted-signers');
    const expectedTrustStoreSha256 = argument('--expected-trust-store-sha256');
    requireValue(
      evidencePath && gitSha && frontendTreeSha256 && artifactsRoot && trustedSignersPath && expectedTrustStoreSha256,
      'Usage: node scripts/blacksite-scale-evidence.mjs --evidence <json> --artifacts-root <directory> --trusted-signers <json> --expected-trust-store-sha256 <sha256> --expected-commit <sha> --expected-frontend-tree <sha256> [--output <json>]',
    );
    exactHex(expectedTrustStoreSha256, 64, 'expected-trust-store-sha256');
    const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'));
    const artifactsRootStat = lstatSync(artifactsRoot, { throwIfNoEntry: false });
    requireValue(artifactsRootStat?.isDirectory() === true && artifactsRootStat.isSymbolicLink() === false, 'artifacts-root must be a real directory');
    const trustedSignersStat = lstatSync(trustedSignersPath, { throwIfNoEntry: false });
    requireValue(trustedSignersStat?.isFile() === true && trustedSignersStat.isSymbolicLink() === false, 'trusted-signers must be a real regular file');
    requirePathOutsideRoot(realpathSync(artifactsRoot), realpathSync(trustedSignersPath), 'trusted-signers');
    const trustStoreBytes = readFileSync(trustedSignersPath);
    const trustStoreSha256 = createHash('sha256').update(trustStoreBytes).digest('hex');
    requireValue(trustStoreSha256 === expectedTrustStoreSha256, 'trusted-signers sha256 mismatch');
    const trustStore = JSON.parse(trustStoreBytes.toString('utf8'));
    const metadata = verifyScaleEvidence(evidence, { gitSha, frontendTreeSha256 });
    const artifactReadback = await verifyScaleEvidenceArtifacts(evidence, artifactsRoot, trustStore);
    const result = {
      ...metadata,
      claim: 'EXTERNAL_SCALE_EVIDENCE_VALIDATED',
      trustStoreReadback: {
        schema: trustStore.schema,
        sha256: trustStoreSha256,
        approvedPlanSha256: trustStore.approvedPlanSha256,
      },
      artifactReadback,
      warning: 'This validates supplied production-equivalent evidence and exact artifact bytes; external owners still decide whether it proves approved capacity.',
    };
    const output = `${JSON.stringify(result, null, 2)}\n`;
    const outputPath = argument('--output');
    if (outputPath) writeFileSync(outputPath, output, 'utf8');
    else process.stdout.write(output);
  }
}
