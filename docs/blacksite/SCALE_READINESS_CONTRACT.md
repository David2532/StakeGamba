# BlackSite production-scale evidence contract

Status: **repository gate available; production capacity not proven**

This is a BlackSite release-evidence contract, not a Stake rule and not a substitute for provider, platform, security or operations approval. Passing its CI self-tests proves only that the verifier fails closed. A one-million-user claim requires a separate production-equivalent run and an evidence JSON that passes the real invocation.

## Required boundary

The workload must identify a planning population of exactly 1,000,000 users and separately record the approved peak concurrency and request rate. One million registered or addressable users does not mean one million simultaneous sessions. The workload owner, provider owner and platform owner must approve the actual concurrency/RPS model before execution.

Accepted schema-v4 evidence must bind:

- the exact Git commit and packaged frontend SHA-256;
- the provider and CDN release identities;
- a non-mocked, production-equivalent environment and approved non-player-funds data policy;
- a unique run ID, a pre-run approval evidence reference, and ramp, steady-state and soak phases whose sum fits within the measured run window;
- achieved concurrency and RPS at least equal to the approved targets, plus a measured request total equal to the endpoint samples;
- CDN cache-hit ratio, origin-request ratio, origin egress and invalidation behavior;
- p50/p95/p99, error rate and timeout rate for frontend, authenticate, play, event, end-round and Replay traffic;
- zero duplicate accepted paid plays, duplicate settlements, negative balances, payout mismatches and uncertain-recovery duplicate writes;
- CDN-origin degradation, RGS 5xx, provider timeout and instance-restart recovery drills;
- bounded saturation metrics, correlated logs/metrics/traces, captured dashboards and acknowledged alert drills;
- a successful bounded rollback rehearsal;
- six unique, run-ID-bound artifact roles with portable relative paths, positive byte sizes and SHA-256 digests: load report, CDN report, provider ledger, resilience report, observability export and rollback report;
- an explicit artifacts root from which the verifier reads every regular, non-symlink file and independently matches its path containment, byte size and SHA-256 digest.
- `blacksiteScaleBinding`, `blacksiteScaleIdentity` and `blacksiteScaleMeasurements` objects inside every JSON report. The binding schema, role, run ID, embedded release identity and role-specific measurement summary must match the top-level evidence, so unrelated, empty or contradictory report bytes cannot substantiate the final claim.

Performance, cache, saturation and recovery limits are supplied by the approved workload evidence. The verifier compares observed values with those approved limits; it does not invent universal provider thresholds.

## Commands

Verifier self-test used by CI:

```bash
pnpm blacksite:scale:contract
```

Real evidence verification:

```bash
node scripts/blacksite-scale-evidence.mjs \
  --evidence /secure/path/blacksite-scale-evidence.json \
  --artifacts-root /secure/path/scale-run-artifacts \
  --expected-commit <40-character-git-sha> \
  --expected-frontend-tree <64-character-sha256> \
  --output /secure/path/blacksite-scale-verification.json
```

The workload approval must exist before the run starts. The real command must be executed against the exact release candidate after the coordinated test. Metadata-only evidence is rejected: all six referenced files must exist below the supplied artifacts root as structured JSON reports, and traversal, duplicate paths, symlinks, missing files, size drift, digest drift or mismatched embedded proof fields fail closed. Add the exact result of `createScaleArtifactProof(evidence, role)` to each report before hashing it; the helper includes the binding plus the release identity and role-specific measurement summary that the verifier independently hashes and compares. The release owner must retain the PASS output, approval reference and all six verified reports. Do not commit credentials, session IDs, player data, provider secrets or unrestricted production URLs.

## Release decision

Until real evidence passes and the external owners approve it, record:

- client/package readiness: evaluated by the normal BlackSite CI;
- provider/CDN/infrastructure capacity: **NOT_PROVEN**;
- one-million-user claim: **NOT_CLAIMED**;
- `BSB-SCALE-001`: **OPEN**.

A CI self-test, local mock, browser fixture, schema-only file or proposed workload cannot close the blocker.
