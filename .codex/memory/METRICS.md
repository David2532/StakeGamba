# Rolling automation metrics

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
