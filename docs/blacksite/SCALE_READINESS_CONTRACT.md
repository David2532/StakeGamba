# BlackSite production-scale evidence contract

Status: **repository gate available; production capacity not proven**

This is a BlackSite release-evidence contract, not a Stake rule and not a substitute for provider, platform, security or operations approval. Passing its CI self-tests proves only that the verifier fails closed. A one-million-user claim requires a separate production-equivalent run and an evidence JSON that passes the real invocation. The exported metadata-only `verifyScaleEvidence()` API returns `STRUCTURALLY_VALID`, never PASS. The exported `verifyScaleEvidenceArtifacts()` API re-runs that validation and returns `STRUCTURALLY_VALID` with an explicit limited scope; because it receives the evidence and trust store as supplied objects, it does not validate their file provenance and never returns PASS. Only the complete CLI, which additionally pins and reads the evidence, external trust-store and release identity inputs, may return PASS, and only with the limited validation scope described below.

## Required boundary

The workload must identify a planning population of exactly 1,000,000 users and separately record the approved peak concurrency and request rate. One million registered or addressable users does not mean one million simultaneous sessions. The workload owner, provider owner and platform owner must approve the actual concurrency/RPS model before execution.

Accepted schema-v7 evidence must bind:

- the exact Git commit plus packaged frontend and math tree SHA-256 values;
- digest-shaped provider, CDN, RGS and environment-configuration release identities rather than mutable labels such as `latest`;
- a non-mocked, production-equivalent environment, unique non-empty regions and an approved non-player-funds data policy;
- a unique run ID, a pre-run approval evidence reference, and ramp, steady-state and soak phases whose sum fits within the measured run window;
- an approved RPS measurement-window duration and per-endpoint minimum sample counts. The measured window must be wholly inside steady state; its exact timestamps must equal the approved duration, every window count must meet its approved floor and remain within the corresponding whole-run count, and achieved RPS is derived from those counts rather than accepted as a free-standing claim;
- achieved concurrency at least equal to the approved target, plus a whole-run measured request total equal to the six endpoint sample counts;
- safe-integer and internally consistent CDN request/cache/origin/egress counters, cache-hit ratio, origin-request ratio and invalidation behavior;
- p50/p95/p99, error rate and timeout rate for frontend, authenticate, play, event, end-round and Replay traffic;
- safe-integer provider-ledger counts reconciled to play and end-round request totals, with zero duplicate accepted paid plays, duplicate settlements, negative balances, payout mismatches and uncertain-recovery duplicate writes;
- the exact unique CDN-origin degradation, RGS 5xx, provider timeout and instance-restart recovery drill set, with every result validated rather than first-name-match selection;
- uniquely named saturation metrics with units and aggregation semantics, correlated logs/metrics/traces, captured dashboards and uniquely named acknowledged alert drills;
- a successful bounded rollback rehearsal;
- an owner-approved evidence-validity period and maximum post-run attestation delay. Expired evidence, late signatures and future-dated runs/reports/signatures fail closed;
- exactly six unique, run-ID-bound artifact roles with portable relative paths, positive byte sizes and SHA-256 digests: load report, CDN report, provider ledger, resilience report, observability export and rollback report;
- an explicit artifacts root from which the verifier reads every regular, non-symlink report and normalized source attachment and independently matches path containment, byte size and SHA-256 digest;
- `blacksiteScaleBinding`, `blacksiteScaleIdentity` and `blacksiteScaleMeasurements` objects inside every JSON report. The binding schema, role, run ID, embedded release identity and role-specific measurement summary must match the top-level evidence, so unrelated, empty or contradictory report bytes cannot substantiate the final claim;
- one signed `blacksiteScaleSourceReport` per role with generator identity and one or more digest-bound `application/json` source attachments. Every attachment must contain the matching `blacksite-scale-normalized-source-v1` role/run/kind/identity/measurement header, source-system/version/export identity, capture time, record-set digest and the complete role-specific normalized source records;
- one `blacksiteScaleAttestation` per report. Its Ed25519 signature covers the complete canonical unsigned report, release binding, role, run ID, signer identity and post-run signing time;
- three distinct accountable approval owners and an out-of-band `blacksite-scale-trusted-signers-v4` trust store bound to the exact release identity and complete pre-run approval plan. The plan binding covers approval status/timestamp/reference/owners, evidence validity/signing delay, environment, population/concurrency/RPS targets, phases, RPS-window duration and endpoint sample floors, endpoint SLO limits, CDN limits, exact resilience scenarios and recovery limits, named/unit-bearing saturation limits, planned alert drills and the rollback limit. These claims cannot be relaxed or substituted after reports are signed. The approved workload owner signs the load report, the provider owner signs provider-ledger and resilience reports, and the platform owner signs CDN, observability and rollback reports. Each owner must use a distinct Ed25519 public key; aliases backed by the same key are rejected. Release control must create and pin the exact trust-store file by SHA-256 after approval and before execution; a digest without a trusted signature proves integrity only, not report provenance or separation of duties.

Performance, cache, saturation and recovery limits are supplied by the approved workload evidence. The verifier compares the supplied observed values with those approved limits; it does not independently observe them or invent universal provider thresholds.

## Signed source-report contract

Each of the six signed JSON reports must include the matching primary normalized-source kind:

| Report role            | Required source kind          | Required normalized records                                                          |
| ---------------------- | ----------------------------- | ------------------------------------------------------------------------------------ |
| `load-report`          | `load-generator-export`       | environment, workload/rate-window summary and all six endpoint latency/count records |
| `cdn-report`           | `cdn-telemetry-export`        | CDN request/cache/origin/egress/invalidation summary                                 |
| `provider-ledger`      | `provider-idempotency-ledger` | provider idempotency and wallet-integrity ledger summary                             |
| `resilience-report`    | `fault-injection-export`      | the exact resilience scenario records plus every named saturation metric             |
| `observability-export` | `observability-export`        | log/metric/trace correlations, dashboard capture and every named alert drill         |
| `rollback-report`      | `rollback-rehearsal-export`   | rollback execution, restored-health and bounded-recovery record                      |

Create the normalized document with `createScaleNormalizedSource(...)`, serialize it as JSON, then record its relative path, media type, exact byte size and SHA-256 in `createScaleSourceReport(...)`. Include that source report with `createScaleArtifactProof(...)` before calling `createScaleArtifactAttestation(...)`. The signed attachment descriptor makes later replacement detectable. The verifier reads every attachment back from the artifact root, rejects traversal, symlinks, duplicate physical files, missing/tampered bytes, wrong role/run/kind/identity/measurement bindings, a mismatched `recordsSha256`, empty records, generic one-record assertion envelopes and any role-specific record set that does not exactly match the validator-derived normalized view of the supplied measurement summary.

This normalized envelope does not make synthetic records true, aggregate independent request samples, recompute vendor percentiles or establish that a generator faithfully transformed the underlying system export. The responsible owners must export and retain the real tool/provider data, substantively review both it and the normalized records before signing and preserve the independent trust/key boundary. The PASS output makes this explicit in `validationScope`: schema/cross-field consistency, release/plan binding, digest readback, signatures and freshness are validated; tool-native semantics, physical execution, production capacity and release approval are not.

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
  --trusted-signers /secure/path/blacksite-scale-trusted-signers.json \
  --expected-trust-store-sha256 <64-character-sha256> \
  --expected-commit <40-character-git-sha> \
  --expected-frontend-tree <64-character-sha256> \
  --expected-math-tree <64-character-sha256> \
  --output /secure/path/blacksite-scale-verification.json
```

The workload approval must exist before the run starts. Its workload, provider and platform owner identities must be distinct. Create the trust store from the exact approved plan and record its file-byte SHA-256 through release control before execution; changing any bound approval, target, sample floor, validity or limit later invalidates `approvedPlanSha256`. The real command must be executed against the exact release candidate after the coordinated test. Schema-only or unsigned consistency inputs are rejected: all six referenced reports and their signed normalized attachments must exist below the supplied artifacts root, while the release-controlled trust-store file must resolve outside that artifact root and match the independently recorded `--expected-trust-store-sha256`. Traversal, duplicate paths, symlinks, missing files, an in-bundle or substituted trust store, approval/target/limit substitution, impossible counters, starved endpoint samples, size/digest drift, missing source records, mismatched embedded proof fields, expired/late/future-dated evidence, untrusted keys, shared owner keys or wrong-role signers fail closed. Passing those checks is owner-attested consistency, not substantive validation of tool-native telemetry.

Private keys remain with the responsible external owners and must never enter the repository or evidence bundle. Construct the separate public-key trust store with `createScaleTrustStore`; preserve it through the release-controlled evidence channel, not from the same untrusted report directory. Record its exact file-byte SHA-256 in that separately controlled channel before verification and pass that value explicitly. The release owner must retain the PASS output, its `evidenceReadback.sha256`, approval reference, pinned trust-store digest, trust store, all six verified reports, every verified normalized attachment and the underlying tool-native exports reviewed by the owners. Do not commit credentials, private keys, session IDs, player data, provider secrets or unrestricted production URLs.

`--output` is optional. When supplied, it must name a new file outside the artifact root; the verifier refuses existing paths and uses exclusive creation, so it cannot overwrite an evidence input, trust store, report, attachment or prior decision record.

## Release decision

Until real evidence passes and the external owners approve it, record:

- client/package readiness: evaluated by the normal BlackSite CI;
- provider/CDN/infrastructure capacity: **NOT_PROVEN**;
- one-million-user claim: **NOT_CLAIMED**;
- `BSB-SCALE-001`: **OPEN**.

A CI self-test, local mock, browser fixture, schema-only file or proposed workload cannot close the blocker.
