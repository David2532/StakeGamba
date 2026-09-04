# BLACKSITE // BREACH — Release Evidence Index

- Status: **QA_BLOCKED — pending candidate, not production-ready**
- Evidence snapshot: **2026-09-04**
- Repository: `David2532/StakeGamba`
- Branch: `codex/blacksite-aaa-studio`

This document indexes evidence; it does not self-certify the commit that contains it and is not evidence that a pending or newer candidate passed.
Unknown, skipped, cancelled, historical-only, manually unreviewed or externally unapproved work remains
open.

## Candidate identity

| Identity                        | Current truthful value                                                                  | Release meaning                                                                                                                                         |
| ------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Candidate commit                | **PENDING — resolve only from the clean checkout and exact CI**                         | No candidate SHA or candidate result is invented before an immutable commit exists and the complete exact-SHA chain runs.                               |
| Remote memory base              | `717a8a052ece0d2ae0e1869b3fc7b25f8a3d140c`                                              | Retains the iPhone-demo evidence closeout; it is not exact proof for the later pending implementation scope.                                            |
| Last exact-green implementation | `c4eeb96b4a40611e44ff57505377ea4fa7578088`                                              | Historical regression evidence only; it does not promote the pending candidate.                                                                         |
| Last exact CI                   | Run `33818861870`, `SUCCESS` on `c4eeb96b…`                                             | Proves only the bytes and identity tested in that run.                                                                                                  |
| Last exact browser artifact     | Artifact `9917922010` from run `33818861870`                                            | Package/browser/screenshots apply only to `c4eeb96b…`; pending symbol/state/URL/axe/performance/security/dependency changes are outside this artifact.  |
| Pull request                    | Draft PR `#28`, head `codex/blacksite-aaa-studio`, base `codex/stake-review-2026-07-29` | The PR is a review container, not release evidence. Its body, checks and head identity require reconciliation after the candidate commit and exact run. |
| Production deployment           | **Forbidden for this scope** (`production_deploy_allowed=false`)                        | A build, package, push, PR or preview must never be reported as a production release.                                                                   |
| Preview/deployment target       | None configured or verified in this evidence snapshot                                   | Preview smoke testing remains open until an authorized non-production target exists and its exact URL is tested.                                        |

The pending SHA should not be inserted here by editing an already-tested commit, because that edit would
create a different SHA. Record it in the exact CI identity, candidate manifest, PR/release record and
`CURRENT_STATE.md` after the commit exists.

## Exact-SHA evidence boundary

A repository result may be promoted to current-candidate evidence only when all of the following refer to
the same clean commit and package bytes:

1. CI asserts that the checked-out `HEAD` equals the event's expected 40-character SHA and that the
   worktree is clean.
2. Frozen dependency installation, the fail-closed production dependency audit, normalized security
   evidence, lint, typecheck, app tests, production build, scale-contract verifier and math gates complete
   successfully. Failure, cancellation, timeout, missing registry data or skip is not a pass.
3. `candidate-manifest.json` and `package-verification.json` agree on git SHA, frontend tree SHA-256 and
   math tree SHA-256, and package verification reports `PASS`.
4. Chromium tests execute against the extracted candidate frontend. Browser evidence must report the same
   `testedGitSha`, the same actual and caller-pinned frontend tree SHA-256, a clean worktree, zero failed
   checks and zero failed scenarios. Candidate resolution also requires the declared accessibility audits
   and complete raw/recomputed performance records for that same package.
5. `repository-gates.json` reports the complete ten-gate release ledger and SHA-256-binds each required raw
   workflow, `.npmrc`, manifest, lockfile, security, package and browser input. `security-evidence.json`
   reports the complete Security-v2 check set; both records carry the same candidate SHA and only required
   `PASS` gates.
6. The 51-point resolver accepts those exact package, browser, repository and security records and emits
   `blacksite-51-evidence.json`. It must also bind the canonical
   `docs/blacksite/STAKE_REQUIREMENTS_51.md` bytes at SHA-256
   `8e8f3dcc771cfd8668d9fc5bb6e58066df3ead4ea0b2645dd2622b01705fdd04`, execute the source-hashed
   absence proofs declared for N/A rows 23 and 34, and avoid converting manual or external rows into
   automated passes.
7. Human and external evidence identifies the same final frontend/math packages. A later runtime, asset,
   dependency or package change invalidates inherited review evidence and requires the affected reruns.

The implementation commit, checkout, tested source, built package, extracted browser target and evidence
identity must therefore be one immutable chain. Source inspection or a locally green dirty worktree is not
a substitute.

## Historical baseline retained for regression context

The last accepted exact-green implementation is `c4eeb96b4a40611e44ff57505377ea4fa7578088`:

- exact CI run `33818861870` completed successfully;
- frozen install, lint, production `svelte-check` with 0 errors and 0 warnings, 204 app tests and the
  production build passed;
- the scale-verifier self-test passed 35/35 and 7 math gates passed over 300,000 books;
- isolated package generation/readback passed;
- exact-package Chromium completed 93/93 scenarios and 3,035/3,035 checks with zero failed checks,
  unexpected/forbidden requests, page errors or unclassified failed requests;
- the then-current 51-point resolver completed for that exact SHA/package while retaining 23 manual gates
  and 6 external approvals as open;
- frontend tree SHA-256:
  `eb9d20f6487e3f97c2aada04153ed28baa19092a72777ea2af5f35889822348d`, 6 files / 455,088 bytes;
- math tree SHA-256:
  `6bd0c4c7f39f9597ac7944e97446c1d09b9fe69087f21ceffe1077aa86bc01da`, 7 files / 48,697,667 bytes;
- math fingerprint:
  `d03fab2727e046eb6a151e579c4852cbb0536415b37028dcb3d2de9c99f278d8`.

Artifact `9917922010` (`sha256:80da8ad355d1318a654c0402231ae055ddd5e784407f2895df284ae4980cefd7`)
supplied the boot intro plus 1920×1080, 1366×768, 390×844 and 844×390 views that were manually
inspected for that historical baseline. Compact views requested zero Vaultkeeper image resources and the
desktop loaded one. Public-link reachability and physical-iPhone behavior were not independently verified.

That exact evidence predates the pending symbols, explicit player-state/control policy, strict shared URL
policy, BFCache-safe page lifecycle, eight-surface whole-document axe coverage, repeated route/state
performance budgets, exact security evidence and dependency/lockfile remediation. Neither `c4eeb96b…` nor
the later memory-only closeout at `717a8a0…` transfers a pass to the pending candidate.

## Canonical repository evidence

| Evidence                                                                                       | Purpose                                                                                                                                                                                   | Truth boundary                                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`ACCEPTANCE_MATRIX.md`](ACCEPTANCE_MATRIX.md)                                                 | Project-specific requirement → implementation → acceptance test → evidence → status matrix and DoD roll-up.                                                                               | `PASS_EXACT_BASELINE`, `IMPLEMENTED_PENDING_EXACT` and open-state labels distinguish historical proof, pending implementation and unfulfilled gates.                                                      |
| [`DESIGN_RESEARCH.md`](DESIGN_RESEARCH.md)                                                     | Dated competitor, adjacent-product and design-system observations with original BLACKSITE decisions and asset-license status.                                                             | Research supports design decisions; it is not Creative, originality, trademark or asset-rights approval.                                                                                                  |
| [`PERFORMANCE_BUDGETS.md`](PERFORMANCE_BUDGETS.md)                                             | Predeclared route/state budgets, repeat protocol and Core Web Vitals truth boundary.                                                                                                      | Playwright numbers are controlled lab diagnostics, never production field percentiles or old-device capacity proof.                                                                                       |
| [`RELEASE_EVIDENCE_51.json`](RELEASE_EVIDENCE_51.json)                                         | Machine-readable map of exactly rows 01–51 to browser checks, scenarios, repository gates and open manual/external work.                                                                  | The map binds the canonical checklist digest and declares executable absence proofs for N/A rows 23/34. Only the exact-package resolver output proves those and all automated references for a candidate. |
| [`STAKE_REQUIREMENTS_51.md`](STAKE_REQUIREMENTS_51.md)                                         | Canonical project checklist and proof expectations; pending map digest `8e8f3dcc…5fdd04`.                                                                                                 | The resolver rejects a non-canonical path or digest mismatch. Repository CI still cannot self-certify Stake, ACP, Slack, publication or live-operation steps.                                             |
| [`QUALITY_QA_RELEASE.md`](QUALITY_QA_RELEASE.md)                                               | Candidate packaging, test layers, manual review and lifecycle contract.                                                                                                                   | `CANDIDATE_GENERATED`, `MANUAL_REVIEW_REQUIRED`, `APPROVED` and `RELEASED` require their stated evidence.                                                                                                 |
| [`.github/workflows/blacksite-ci.yml`](../../.github/workflows/blacksite-ci.yml)               | Clean-checkout gate, frozen install, repository tests, package/readback, exact extracted-browser QA and resolver orchestration.                                                           | Only the uncancelled run for the candidate SHA counts. Workflow source alone is not a pass.                                                                                                               |
| [`scripts/blacksite-compliance-evidence.mjs`](../../scripts/blacksite-compliance-evidence.mjs) | Fails closed on package/browser/repository/security identity mismatch, incomplete accessibility/performance evidence or unresolved declared references.                                   | Its generated output is valid only with all exact inputs retained together.                                                                                                                               |
| [`scripts/blacksite-repository-evidence.mjs`](../../scripts/blacksite-repository-evidence.mjs) | Emits the exact-SHA Repository-v2 ledger for frozen install, audit, lint, typecheck, tests, build, scale, math, package and browser gates and hashes every required raw input.              | Focused fixture proof does not show that the ten commands ran for a candidate; the exact workflow and bound inputs must exist together.                                                                    |
| [`scripts/blacksite-security-evidence.mjs`](../../scripts/blacksite-security-evidence.mjs)     | Verifies pinned dependency policy and binds the effective allowlisted HTTPS registry plus exact `.npmrc` digest while normalizing the production registry-audit result for the exact SHA. | Source checks or an omitted/offline/malformed/internally inconsistent registry audit never become a vulnerability pass; raw report, stderr and normalized evidence must be retained together.             |

## Exact CI artifact semantics

The workflow publishes one diagnostics artifact named
`blacksite-diagnostics-<run_id>-<run_attempt>`. For a successful candidate it must retain:

| Artifact path                                                        | Required meaning                                                                                                                                                                                                                                              |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `artifacts/blacksite-ci/identity.txt`                                | Checkout git SHA plus material Node/pnpm identity.                                                                                                                                                                                                            |
| `artifacts/blacksite-ci/repository-gates.json`                       | Repository-v2 results for exactly ten named gates, bound to the candidate SHA and SHA-256 of every required raw input.                                                                                                                                       |
| `artifacts/blacksite-security/pnpm-audit.json`                       | Raw machine-readable production dependency audit. A missing, malformed, registry-error, timed-out or high/critical result fails the candidate.                                                                                                                |
| `artifacts/blacksite-security/pnpm-audit.stderr.txt`                 | Raw audit diagnostics retained for investigation; never interpreted alone as a pass.                                                                                                                                                                          |
| `artifacts/blacksite-security/security-evidence.json`                | Normalized schema-v2 dependency-policy and advisory result bound to the candidate SHA, raw audit digest, effective reviewed registry and exact `.npmrc` digest.                                                                                               |
| `artifacts/blacksite-package/candidate-manifest.json`                | Candidate git identity and exact frontend/math package hashes.                                                                                                                                                                                                |
| `artifacts/blacksite-package/package-verification.json`              | Independent package/readback result and matching tree identities.                                                                                                                                                                                             |
| `artifacts/blacksite-qa/<timestamp>/blacksite-browser-evidence.json` | Tested SHA/build identity, environment, manifests, scenarios, checks, network/console diagnostics, accessibility audits, performance observations and geometry records.                                                                                       |
| `artifacts/blacksite-qa/<timestamp>/screenshots/**`                  | Visual evidence for named deterministic states and viewports; still requires applicable human review.                                                                                                                                                         |
| `artifacts/blacksite-compliance/blacksite-51-evidence.json`          | Resolved 51-row map tied to the same package, browser, repository and security evidence, including required accessibility/performance summaries, canonical contract source/digest and source-hashed N/A absence proofs. Manual/external statuses remain open. |

Browser evidence is acceptable only when the machine summary is wholly green and identity matches the
extracted package. Screenshots alone do not prove request counts, settlement, Replay isolation,
accessibility or performance. Conversely, geometry assertions do not replace human art-direction and
readability review.

The upload staging step accepts only one browser-evidence directory whose `testedGitSha` equals the current
event SHA. A stale directory from another run is not uploaded as current evidence; workflow source still
does not prove that this guard ran successfully for the pending candidate.

The accessibility block uses pinned local `axe-core` rules for automated WCAG A/AA findings. Every
violation fails the harness, while every `incomplete` result is retained for human review. A green automated
scan is not a screen-reader, voice-control, 200% zoom/reflow, switch-control or real-device sign-off.

The performance block retains repeated raw lab observations and budget summaries. These are not Chrome UX
Report data, production RUM, a mobile/desktop field 75th percentile or proof of capacity for one million
users.

## Pending-candidate implementation scope

The pending candidate scope includes original symbol marks, explicit player-state/control policy, strict
shared RGS/Replay URL validation, BFCache-safe authoritative teardown/restore, sub-cent and Social currency
coverage, exact repository/security-gate resolution, dependency/lockfile remediation, eight-surface
automated WCAG scans and repeated performance budgets.
These are **implemented but unproven for release** until they are in one clean commit and the exact chain
above passes. One local frozen install, focused evidence suites 57/57, performance contracts 4/4 and
lifecycle/state/intro tests 19/19 are development evidence. The evidence suite covers Browser v2, eight axe
surfaces, nine performance runs, Security v2, the ten-gate Repository-v2 ledger, the canonical checklist
digest, every raw-input digest and N/A absence-proof validation. Pending dirty-worktree app-level
`svelte-check` passes with 0 errors/0 warnings and a direct Vite production build passes, but full
lint/tests/root build, package and browser gates remain open. The new built-app
BFCache/audio/insufficient-funds scenarios are unrun because a local Chromium install timed out. A real
local registry audit reached its hard 180 s limit with exit 124 and 0 JSON bytes; this is a failed attempt,
not zero-vulnerability evidence. This document does not claim candidate full tests, registry audit,
package, browser, accessibility measurements, performance measurements, resolver or exact CI has passed.

## Remaining blockers

### Repository-owned

- Run the remaining complete local candidate gate set; the recorded frozen install, app typecheck/direct
  build and focused suites do not replace full lint/tests/root build, math/package and browser validation.
- Commit the coherent candidate, push only to the authorized branch and obtain one uncancelled exact-SHA CI
  success with retained raw/normalized security, package, browser, accessibility, performance and compliance
  artifacts. The local registry attempt timed out with no JSON report and therefore remains failed until a
  complete parseable candidate audit succeeds, expected in exact CI if local registry access remains unavailable.
- Resolve any current unit, type, lint, build, axe, performance, browser, network, console, package, math or
  51-row failure without weakening the contract.
- Integrate and reverify the still-missing production asset groups once supplied: final title/brand art,
  board art, supporting UI art, gameplay FX, approved Spine 4.2 rig/clips, final BLACKOUT/foreground layers,
  authored audio and game-tile deliverables. Final bytes require new hashes, build/package QA and screenshots.
- Reconcile `CURRENT_STATE.md`, the acceptance matrix, PR evidence and candidate package identity after the
  exact run without writing stale or self-referential SHA claims into the tested commit.

### Manual

The versioned 51-row map retains 23 manual gates: rows 05–08, 17–22, 25–29, 31, 33, 35, 37–39, 44 and 49.
They include final originality/title/rights/appropriateness and tile review; rules, symbol and language
review; desktop/mobile/landscape/Popout visual inspection; five-win presentation checks; Social/Replay
review; and the defined older iOS/Android device floor.

Additional release-relevant manual work includes exact-package Creative review, final Spine/FX timing,
audio listening/mute/clipping checks, keyboard/focus/zoom/reduced-motion review, axe `incomplete` triage and
screen-reader/assistive-technology testing. None is inferred from automation.

### External

- The versioned 51-row map retains six external gates: rows 45–48 and 50–51 for Stake-side templates,
  Provably Fair/Replay enablement, Front/Math approval, approved-channel evidence, post-live closure and
  actual release.
- Production-equivalent CDN/RGS/provider ramp, steady-state, soak and resilience testing remains external.
  Required signed owner reports, concurrency/RPS/SLO acceptance, wallet-integrity evidence, observability
  and rollback drills do not exist in repository CI. Capacity for 1,000,000 users is explicitly
  **NOT_CLAIMED**.
- An authorized preview target and real URL have not been identified or smoke-tested in this snapshot.
- Production deployment and merge are outside the authorized scope and must not be performed or implied.

## Promotion checklist for the pending commit

The release record may cite the pending candidate only after retaining, for the same HEAD:

- exact clean checkout and frozen-install result;
- raw production dependency audit plus normalized exact-SHA security evidence with zero unresolved
  high/critical findings;
- lint, typecheck, app test, production-build, scale-contract and math results;
- frontend/math manifest and successful package readback hashes;
- extracted-package Chromium browser evidence with zero failed checks/scenarios;
- automated accessibility and repeated lab-performance records with their manual/field limits stated;
- resolved 51-point candidate JSON;
- inspected current screenshots for the required desktop, mobile, landscape, tablet and Popout surfaces;
- all remaining manual and external records, if advancing beyond repository QA.

Until that evidence exists, the only truthful lifecycle is `QA_BLOCKED`. No source change, local test,
artifact, PR or historical green run makes BLACKSITE `COMPLETE`, `APPROVED`, `LIVE`, `RELEASED` or
production-ready.
