# Rolling automation metrics

## BS-20260831-10

```yaml
closed_at_utc: 2026-08-30T22:08:00Z
sprint_day: 2
direct_subagents: 0
tool_call_counts: null
file_read_count: null
tokens: { input: null, cached_input: null, output: null, total: null, source: not_exposed }
focused_presentation_tests: 87
focused_presentation_status: PASS
normal_blackout_lifecycle_ms: 3541
local_frozen_install: PASS
local_lint: PASS
local_typecheck_errors: 0
local_typecheck_warnings: 0
local_app_tests: 87
local_app_status: PASS
local_build: PASS
local_full_math_books: 300000
local_full_math_fingerprint: d03fab2727e046eb6a151e579c4852cbb0536415b37028dcb3d2de9c99f278d8
diagnostic_ci_run: 33337302587
diagnostic_browser_failure: scoped_keyframe_names_and_replay_timeout
verified_ci_run: 33337862476
verified_ci_status: PASS
remote_app_tests: 87
remote_full_math_books: 300000
remote_browser_scenarios: 39
remote_browser_checks_pass: 910
remote_browser_checks_fail: 0
remote_diagnostics_artifact: 9739702865
remote_implementation_commit: 90f7c3d48732766e6c3b48e2815282d456bbb250
manual_identical_retries: 0
```

Observed categories: compact memory/animation-contract reads, targeted runtime/UI/test edits, focused and one complete local gate chain, exact Git-data fast-forwards, two Actions runs, job/log/artifact reads, and five final screenshot inspections. The diagnostic browser run exposed Svelte-scoped keyframe names and two legitimately longer Replay presentations against a stale 10s harness limit; suffix matching and a bounded 20s Replay wait fixed the evidence layer without weakening production motion. One unavailable fixture path, one unauthenticated push, one malformed local tree revision, one over-broad Actions listing, one rejected temporary cleanup and one malformed log regex were each replaced with a materially different safe route, never repeated unchanged. No subagents, dependencies, binary assets or token estimates were used.

## BS-20260830-09

```yaml
closed_at_utc: 2026-08-30T21:12:00Z
sprint_day: 1
direct_subagents: 0
tool_call_counts: null
file_read_count: null
tokens: { input: null, cached_input: null, output: null, total: null, source: not_exposed }
focused_motion_mobile_tests: 19
focused_motion_mobile_status: PASS
local_lint: PASS
local_typecheck_errors: 0
local_typecheck_warnings: 0
local_app_tests_before_compact_fix: 85
local_app_status: PASS
local_build: PASS
local_full_math_books: 300000
local_full_math_fingerprint: d03fab2727e046eb6a151e579c4852cbb0536415b37028dcb3d2de9c99f278d8
diagnostic_ci_run: 33334764536
diagnostic_browser_failure: replay_motion_target_32px
verified_ci_run: 33335278205
verified_ci_status: PASS
remote_app_tests: 86
remote_full_math_books: 300000
remote_browser_scenarios: 38
remote_browser_checks_pass: 902
remote_browser_checks_fail: 0
remote_diagnostics_artifact: 9738959370
remote_implementation_commit: e659668256d2367f2aa9e4637d67100968b48848
skip_completion_ms: 110
manual_identical_retries: 0
```

Observed categories: compact memory/animation-contract reads, focused/full local gates, diff review, Git-data fast-forward writes, two exact Actions runs, job/log/artifact reads, and six final screenshot inspections. The first CI correctly exposed a 32px Replay motion control; the narrow layout and regression were corrected before the final exact run. One over-broad formatter created churn and was fully removed; one GitHub branch URL, one initial tree mode, and one attached-branch rebase command required corrected alternatives without unchanged retries. No subagents, dependencies, binary assets or token estimates were used.

## BS-20260830-08

```yaml
closed_at_utc: 2026-08-30T20:03:00Z
sprint_day: 1
direct_subagents: 0
tool_call_counts: null
file_read_count: null
tokens: { input: null, cached_input: null, output: null, total: null, source: not_exposed }
focused_asset_tests: 3
focused_asset_status: PASS
local_lint: PASS
local_typecheck_errors: 0
local_typecheck_warnings: 0
local_app_tests: 83
local_app_status: PASS
local_build: PASS
local_full_math_books: 300000
runtime_environment_bytes: 126620
runtime_environment_dimensions: [1672x941, 941x1672]
verified_ci_run: 33332083126
verified_ci_status: PASS
remote_full_math_books: 300000
remote_full_math_fingerprint: d03fab2727e046eb6a151e579c4852cbb0536415b37028dcb3d2de9c99f278d8
remote_browser_scenarios: 37
remote_browser_checks_pass: 827
remote_browser_checks_fail: 0
remote_diagnostics_artifact: 9738046250
remote_implementation_commit: e30d0c0de02532d6874ca1a51bde2ddbcd70a116
manual_identical_retries: 0
```

Observed categories: compact memory/source reads, asset-pipeline and image-generation guidance, two accepted text-only generations, runtime image inspection/optimization, focused/full local gates, Git/GitHub fast-forward writes, Actions/log/artifact reads, and exact screenshot review. One no-TTY pnpm invocation, one stale manifest-contract assertion, one unauthenticated direct push and one prohibited temporary cleanup command failed; each was corrected with new evidence or a materially different safe route, never repeated unchanged. No subagents or new dependencies. Token and exact aggregate tool/file metrics were not exposed and are not estimated.

## BS-20260830-06

```yaml
closed_at_utc: 2026-08-30T18:11:22Z
sprint_day: 1
direct_subagents: 0
tool_call_counts: null
file_read_count: null
tokens: { input: null, cached_input: null, output: null, total: null, source: not_exposed }
focused_mobile_tests: 3
focused_mobile_status: PASS
local_typecheck_errors: 0
local_typecheck_warnings: 0
local_lint: PASS
local_app_tests: 78
local_app_status: PASS
local_build: PASS
verified_ci_run: 33326796710
verified_ci_status: PASS
remote_full_math_books: 300000
remote_full_math_fingerprint: d03fab2727e046eb6a151e579c4852cbb0536415b37028dcb3d2de9c99f278d8
remote_browser_scenarios: 37
remote_browser_checks_pass: 811
remote_browser_checks_fail: 0
remote_diagnostics_artifact: 9736580209
remote_implementation_commit: fa60a4721f0e898b07f9c1fddac8e9b7c04b244e
manual_identical_retries: 0
```

Observed categories: targeted memory/source reads, focused/full local gates, Git-data fast-forward writes, Actions/job/artifact reads and viewport screenshot inspections. The first remote QA revision exposed an incorrect focus-color comparison and missing Info-button test ID; both harness defects were corrected from computed evidence. Final artifact review then caught a 1.0% Replay aspect drift, leading to a compact-height fix and a stricter 0.2% square guard before closeout. One incorrect agent-document extension, one oversized combined image read and one `pnpm exec` formatter check that attempted an unnecessary install failed without identical retry; the existing pinned formatter binary completed the check. No subagents, dependencies, binary assets or token estimates were used.

## BS-20260830-01

```yaml
closed_at_utc: 2026-08-30T13:23:28Z
sprint_day: 1
direct_subagents: 3
nested_subagents: null
tool_call_counts: null
file_read_count: null
tokens:
  input: null
  cached_input: null
  output: null
  total: null
  source: not_exposed
focused_rgs_test_seconds: 0.274
full_app_test_seconds: 4.723
production_build_seconds: 4.59
full_math_test_seconds: 497.466
full_math_books: 300000
full_math_fingerprint: d03fab2727e046eb6a151e579c4852cbb0536415b37028dcb3d2de9c99f278d8
browser_e2e: BLOCKED
typecheck: BLOCKED
remote_push: PASS
remote_implementation_commit: 2977b4d1ab6ec8250198ce271f0501df509b4bab
remote_memory_commit: 8636652946dfa931cf838ebc9a30c602da6748da
```

Exact aggregate tool/file counts were not exposed after context compaction and are not estimated. Observed inefficiencies: two browser-install command attempts triggered repeated CDN failures; a redundant early math verify/test pair was started before the final gate cycle; root-relative agent document paths caused failed lookups; one targeted ESLint invocation omitted the repository's legacy-config environment; local HTTPS push lacked credentials. Corrections: use only `blacksite:math:test`, route future runs through compact memory, fix agent paths, invoke the package lint gate, stop unchanged browser retries after the documented failure, and use the connected GitHub API for an authorized non-force fast-forward when local credentials are absent.

## BS-20260830-02

```yaml
closed_at_utc: 2026-08-30T14:09:14Z
sprint_day: 1
direct_subagents: 0
tool_call_counts: null
file_read_count: null
tokens:
  input: null
  cached_input: null
  output: null
  total: null
  source: not_exposed
focused_typecheck_baseline_errors: 183
focused_typecheck_final_errors: 0
focused_regression_tests: 61
focused_regression_status: PASS
full_app_tests: 69
full_app_status: PASS
full_math_test_seconds: 496.081
full_math_books: 300000
full_math_fingerprint: d03fab2727e046eb6a151e579c4852cbb0536415b37028dcb3d2de9c99f278d8
local_browser_install: BLOCKED_CDN_TIMEOUT
remote_ci_run: 33315820538
remote_ci_status: in_progress
remote_head: 8feae80f1e31f29aaf81e269dd990902c739e4a4
manual_identical_retries: 0
```

Observed failures: three expected red `svelte-check` baselines (183 → 29 → 1), one local Playwright install command whose five built-in CDN attempts timed out, one credential-blocked HTTPS push, and one corrected connector response-shape parse. The first remote SHA exposed two workflows for one commit; narrowing the PR base produced exactly one workflow for the final SHA. No subagents or token estimates were used. The pnpm-major mismatch caused broad lockfile churn once; it was removed before commit and the repository-declared pnpm 10.5.0 frozen install passed.

## BS-20260830-03

```yaml
closed_at_utc: 2026-08-30T14:52:00Z
sprint_day: 1
direct_subagents: 0
tool_call_counts: null
file_read_count: null
tokens:
  input: null
  cached_input: null
  output: null
  total: null
  source: not_exposed
local_frozen_install: PASS
local_lint: PASS
local_typecheck_errors: 0
local_typecheck_warnings: 0
local_app_tests: 69
local_app_status: PASS
local_build: PASS
local_browser_install: BLOCKED_CDN_TIMEOUT
baseline_ci_run: 33315820538
baseline_browser_checks_pass: 707
baseline_browser_checks_fail: 1
verified_ci_run: 33317660876
verified_ci_status: PASS
verified_ci_seconds: 425
verified_browser_scenarios: 36
verified_browser_checks_pass: 736
verified_browser_checks_fail: 0
replay_board_before_css_px: 263.1875x234.5
replay_board_after_css_px: 231.1875x231.1875
remote_implementation_commit: a2a2e623af01405cda64ad94d350906691e75c39
```

Exact aggregate tool/file counts were not exposed and are not estimated. Observed categories were targeted repository reads/searches, local install/gates/diff review, GitHub Actions/job/log/artifact reads, four screenshot inspections, one source patch, and Git-data fast-forward writes. Failures: one shell command was policy-rejected for destructive temporary cleanup and was replaced with a unique non-destructive directory; one Playwright install command exhausted its five built-in CDN mirrors and was not manually repeated. Repeated Actions status polling while the expected eight-minute math gate ran added avoidable reads; future runs should inspect job steps once, wait until the recorded math-duration window, then fetch final status and artifacts once.

## BS-20260830-05

```yaml
closed_at_utc: 2026-08-30T17:12:00Z
sprint_day: 1
direct_subagents: 0
tool_call_counts: null
file_read_count: null
tokens: { input: null, cached_input: null, output: null, total: null, source: not_exposed }
focused_hud_tests: 3
focused_hud_status: PASS
local_typecheck_errors: 0
local_typecheck_warnings: 0
local_lint: PASS
local_app_tests: 75
local_app_status: PASS
local_build: PASS
verified_ci_run: 33324002432
verified_ci_status: PASS
remote_full_math_books: 300000
remote_full_math_fingerprint: d03fab2727e046eb6a151e579c4852cbb0536415b37028dcb3d2de9c99f278d8
remote_browser_scenarios: 36
remote_browser_checks_pass: 750
remote_browser_checks_fail: 0
remote_diagnostics_artifact: 9735814868
remote_implementation_commit: cde685d09759a05f446004f6ba4dd89fd1cf6c4f
```

Observed categories: targeted memory/source reads, focused/full gates, diff review, Git-data fast-forward writes, Actions/log/artifact reads, and seven before/after screenshot inspections. One over-broad formatter pass created review churn and was reversed before commit. The first exact CI exposed two real contract mismatches (Social terminology and compact-layout status visibility); both were corrected with new regression coverage, then the final exact run passed. No subagents, new dependencies, binary assets or token estimates were used.

## BS-20260830-04

```yaml
closed_at_utc: 2026-08-30T15:51:42Z
sprint_day: 1
direct_subagents: 0
tool_call_counts: null
file_read_count: null
tokens:
  input: null
  cached_input: null
  output: null
  total: null
  source: not_exposed
focused_identity_tests: 3
focused_identity_status: PASS
local_lint: PASS
local_typecheck_errors: 0
local_typecheck_warnings: 0
local_app_tests: 72
local_app_status: PASS
local_build: PASS
remote_ci_run: 33320205882
remote_ci_status: PASS
remote_ci_seconds: 575
remote_full_math_books: 300000
remote_full_math_fingerprint: d03fab2727e046eb6a151e579c4852cbb0536415b37028dcb3d2de9c99f278d8
remote_browser_scenarios: 36
remote_browser_checks_pass: 736
remote_browser_checks_fail: 0
remote_diagnostics_artifact: 9734778601
remote_implementation_commit: e243fe7ad3c0306af5f991366c6fd473e97871de
manual_identical_retries: 0
```

Observed categories: targeted repository searches/reads, three existing concept-image inspections, focused/full gates, diff review, and GitHub tree/Actions reads and fast-forward writes. No subagents, new dependencies, browser-install retries or binary asset writes were used. One tool-registry discovery returned excessive description text after a name-plus-description filter; subsequent discovery was restricted to exact tool names. Exact aggregate tool/file/token counts were not exposed and are not estimated.

## BS-20260830-07

```yaml
closed_at_utc: 2026-08-30T19:12:00Z
sprint_day: 1
direct_subagents: 0
tool_call_counts: null
file_read_count: null
tokens: { input: null, cached_input: null, output: null, total: null, source: not_exposed }
focused_asset_tests: 6
focused_asset_status: PASS
local_lint: PASS
local_typecheck_errors: 0
local_typecheck_warnings: 0
local_app_tests: 81
local_app_status: PASS
local_build: PASS
runtime_asset_bytes: 78732
runtime_asset_dimensions: 702x1080
verified_ci_run: 33329648477
verified_ci_status: PASS
remote_full_math_books: 300000
remote_full_math_fingerprint: d03fab2727e046eb6a151e579c4852cbb0536415b37028dcb3d2de9c99f278d8
remote_browser_scenarios: 37
remote_browser_checks_pass: 819
remote_browser_checks_fail: 0
remote_diagnostics_artifact: 9737374574
remote_implementation_commit: 85eb4f2bd773e44261044edc3f836a429411f389
manual_identical_retries: 0
```

Observed categories: compact memory/source reads, asset-pipeline and image-generation guidance, three generated candidates/edits, image inspection/optimization, focused and full gates, Git-data fast-forward writes, Actions/log/artifact reads, and exact screenshot review. One extraction edit was rejected for a baked checkerboard; the first candidate was rejected for detached light bars. The first green browser run exposed a real 1366x768 invisible-image defect during manual screenshot review; intrinsic image geometry plus a stricter pixel-bounds assertion fixed it before the final exact run. One no-TTY pnpm wrapper and one incorrect local binary path failed without unchanged retry. Broad formatter churn in two files was removed before commit. No subagents or dependency additions; token telemetry was not exposed.
