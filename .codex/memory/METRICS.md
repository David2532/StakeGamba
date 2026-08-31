# Rolling automation metrics

## BS-20260831-20

```yaml
closed_at_utc: 2026-08-31T07:00:00Z
sprint_day: 2
direct_subagents: 0
tool_call_counts: null
file_read_count: null
tokens: { input: null, cached_input: null, output: null, total: null, source: not_exposed }
focused_readme_tests: 3
focused_readme_status: PASS
focused_asset_tests: 6
focused_asset_status: PASS
local_frozen_install: PASS
local_lint: PASS
local_typecheck_errors: 0
local_typecheck_warnings: 0
local_app_tests: 101
local_app_status: PASS
local_build: PASS
local_full_math_tests: 7
local_full_math_books: 300000
local_full_math_fingerprint: d03fab2727e046eb6a151e579c4852cbb0536415b37028dcb3d2de9c99f278d8
local_browser: BLOCKED
local_browser_blocker: playwright_executable_not_installed
diagnostic_ci_run: 33364517136
diagnostic_ci_failure: transient_character_failed_state_treated_as_terminal_before_fallback
verified_ci_run: 33365621986
verified_ci_status: PASS
remote_browser_scenarios: 40
remote_browser_checks_pass: 975
remote_browser_checks_fail: 0
remote_unexpected_network_page_request_failures: 0
remote_expected_negative_path_console_messages: 5
remote_diagnostics_artifact: 9748384857
remote_implementation_commit: 77faaa5b3204dd34f431913bfdc26093e963d476
manual_identical_retries: 0
```

Observed categories: safe branch/memory/runbook reads, targeted README/package-script and QA-harness inspection, focused README/asset regressions, one complete local code/math gate chain, diff/mode review, Git-data fast-forward writes, two exact Actions runs, structured artifact evidence inspection and five exact screenshot reviews. The diagnostic CI run exposed a real transient paint-state race; the terminal fallback predicate was tightened without weakening runtime acceptance. One exec transport disconnect was retried once unchanged; no semantic failure was repeated unchanged. No subagents, dependencies, binary product assets or token estimates were used.

## BS-20260831-19

```yaml
closed_at_utc: 2026-08-31T06:08:00Z
sprint_day: 2
direct_subagents: 0
tool_call_counts: null
file_read_count: null
tokens: { input: null, cached_input: null, output: null, total: null, source: not_exposed }
focused_asset_tests: 6
focused_asset_status: PASS
local_frozen_install: NOT_RUN
local_lint: PASS
local_typecheck_errors: 0
local_typecheck_warnings: 0
local_app_tests: 98
local_app_status: PASS
local_build: PASS
local_full_math_tests: 7
local_full_math_books: 300000
local_full_math_fingerprint: d03fab2727e046eb6a151e579c4852cbb0536415b37028dcb3d2de9c99f278d8
verified_ci_run: 33362124623
verified_ci_status: PASS
remote_browser_scenarios: 40
remote_browser_checks_pass: 975
remote_browser_checks_fail: 0
remote_geometry_paint_states: painted
remote_unexpected_console_page_request_failures: 0
remote_diagnostics_artifact: 9747264261
remote_implementation_commit: fbfe4ed0cabe40d2df7a6c1f7962e3cc3c2f0da5
manual_identical_retries: 0
```

Observed categories: compact memory/art/visual-QA reads, targeted Svelte/asset/browser inspection, one focused asset regression, one complete local code/math gate chain, diff/mode review, Git-data fast-forward writes, one exact Actions run, structured artifact evidence inspection and five exact screenshot reviews. One broad formatter pass was fully removed before the semantic patch. An initial connector-result parser missed direct blob SHAs; the unchanged branch ref and content-addressed blob checks kept the retry safe. No subagents, dependencies, binary product assets or token estimates were used.

## BS-20260831-18

```yaml
closed_at_utc: 2026-08-31T05:24:00Z
sprint_day: 2
direct_subagents: 0
tool_call_counts: null
file_read_count: null
tokens: { input: null, cached_input: null, output: null, total: null, source: not_exposed }
focused_audio_tests: 5
focused_audio_status: PASS
local_frozen_install: PASS
local_lint: PASS
local_typecheck_errors: 0
local_typecheck_warnings: 0
local_app_tests: 97
local_app_status: PASS
local_build: PASS
local_full_math_tests: 7
local_full_math_books: 300000
local_full_math_fingerprint: d03fab2727e046eb6a151e579c4852cbb0536415b37028dcb3d2de9c99f278d8
verified_ci_run: 33359618133
verified_ci_status: PASS
remote_browser_scenarios: 40
remote_browser_checks_pass: 975
remote_browser_checks_fail: 0
normal_reel_audio_offsets_ms: [0, 24, 48, 72, 96, 120, 144]
turbo_reel_audio_offsets_ms: [0, 8, 16, 24, 32, 40, 48]
audio_reel_pulses: 7
audio_priority_cues: 1
audio_ducks: 1
audio_ambience_instances: 1
remote_diagnostics_artifact: 9746470203
remote_implementation_commit: f333f220c9299e6f2c44765ff08fad7c93c97591
manual_identical_retries: 0
```

Observed categories: compact memory/audio/QA-rule reads, focused audio regression, one complete local gate chain, diff/mode review, Git-data fast-forward writes, exact Actions/job/artifact reads, structured browser evidence inspection and six screenshot reviews. An explicit formatter produced broad baseline churn and was fully reversed before the semantic patch; one guessed source path was corrected once. Post-push tree comparison found and corrected an unintended executable-bit loss before final evidence. Exact screenshot review exposed a loaded-but-unpainted asset race that automated geometry checks miss. No unchanged failure, subagent, dependency, binary asset or token estimate was used.

## BS-20260831-17

```yaml
closed_at_utc: 2026-08-31T04:34:00Z
sprint_day: 2
direct_subagents: 0
tool_call_counts: null
file_read_count: null
tokens: { input: null, cached_input: null, output: null, total: null, source: not_exposed }
local_frozen_install: PASS
local_lint: PASS
local_typecheck_errors: 0
local_typecheck_warnings: 0
local_app_tests: 96
local_app_status: PASS
local_build: PASS
local_full_math_tests: 7
local_full_math_books: 300000
local_full_math_fingerprint: d03fab2727e046eb6a151e579c4852cbb0536415b37028dcb3d2de9c99f278d8
verified_ci_run: 33356700576
verified_ci_status: PASS
remote_browser_scenarios: 40
remote_browser_checks_pass: 973
remote_browser_checks_fail: 0
turbo_frame_samples: 76
turbo_frame_p95_ms: 16.7
turbo_frame_max_ms: 16.8
turbo_frame_over_50_ms: 0
normal_frame_samples: 181
normal_frame_p95_ms: 16.7
normal_frame_max_ms: 16.8
normal_frame_over_50_ms: 0
blackout_frame_samples: 241
blackout_frame_p95_ms: 33.4
blackout_frame_max_ms: 66.7
blackout_frame_over_50_ms: 1
remote_diagnostics_artifact: 9745529819
remote_implementation_commit: 1da3b6f763d3c263647a152d3d028f8169fc829b
manual_identical_retries: 0
```

Observed categories: targeted memory/source/animation/visual-QA reads, reusable browser-sampler and focused regression edits, one focused verification and one complete local gate chain, diff review, Git-data fast-forward writes, one exact Actions run, structured artifact evidence inspection and six exact screenshot reviews. A seven-image batched inspection exceeded the direct output context and was replaced by three smaller inspections; no failed command was repeated unchanged. No subagents, dependencies, binary assets or token estimates were used.

## BS-20260831-16

```yaml
closed_at_utc: 2026-08-31T04:05:00Z
sprint_day: 2
direct_subagents: 0
tool_call_counts: null
file_read_count: null
tokens: { input: null, cached_input: null, output: null, total: null, source: not_exposed }
local_frozen_install: PASS
local_lint: PASS
local_typecheck_errors: 0
local_typecheck_warnings: 0
local_app_tests: 95
local_app_status: PASS
local_build: PASS
local_full_math_tests: 7
local_full_math_books: 300000
local_full_math_fingerprint: d03fab2727e046eb6a151e579c4852cbb0536415b37028dcb3d2de9c99f278d8
verified_ci_run: 33355037527
verified_ci_status: PASS
remote_browser_scenarios: 40
remote_browser_checks_pass: 970
remote_browser_checks_fail: 0
reel_stop_delays_ms: [0, 8, 16, 24, 32, 40, 48]
frame_samples: 79
frame_p95_ms: 16.7
frame_max_ms: 16.8
frame_over_50_ms: 0
remote_diagnostics_artifact: 9745037349
remote_implementation_commit: 2926692756d8f98222ef40b923b083e216f28f07
manual_identical_retries: 0
```

Observed categories: targeted memory/source/animation-skill reads, focused and one complete local gate chain, diff review, Git-data fast-forward writes, one exact Actions run, artifact/evidence inspection and six exact screenshots. One shell search had a quoting error and was replaced with a simpler targeted command; direct HTTPS push lacked credentials and used the established Git-data path. One destructive temporary-cleanup command was policy-rejected and replaced with a unique non-destructive extraction directory. No unchanged failures, subagents, dependencies, binary assets or token estimates were used.

## BS-20260831-15

```yaml
closed_at_utc: 2026-08-31T03:10:00Z
sprint_day: 2
direct_subagents: 0
tool_call_counts: null
file_read_count: null
tokens: { input: null, cached_input: null, output: null, total: null, source: not_exposed }
focused_character_contracts: PASS
local_lint: PASS
local_typecheck_errors: 0
local_typecheck_warnings: 0
local_app_tests: 95
local_app_status: PASS
local_build: PASS
local_full_math_tests: 7
local_full_math_books: 300000
verified_ci_run: 33352237842
verified_ci_status: PASS
remote_browser_scenarios: 40
remote_browser_checks_pass: 968
remote_browser_checks_fail: 0
remote_diagnostics_artifact: 9744182047
remote_implementation_commit: 176422ee721eb90a4f8507073758bbb2253946f4
manual_identical_retries: 0
```

Observed categories: targeted memory/source/skill reads, focused and one corrected full gate, diff review, Git-data fast-forward writes, Actions/artifact reads, structured browser evidence inspection and six exact screenshots. One broad formatter attempt was fully reversed before the material patch; the first fail-fast full gate exposed only a stale markup-order assertion and was corrected semantically. One public artifact download returned 401 before the authenticated connector path succeeded. No subagents, dependencies, binary assets or token estimates were used.

## BS-20260831-14

```yaml
closed_at_utc: 2026-08-31T01:55:00Z
sprint_day: 2
direct_subagents: 0
tool_call_counts: null
file_read_count: null
tokens: { input: null, cached_input: null, output: null, total: null, source: not_exposed }
local_frozen_install: PASS
local_lint: PASS
local_typecheck_errors: 0
local_typecheck_warnings: 0
local_app_tests: 94
local_app_status: PASS
local_build: PASS
local_full_math_books: 300000
local_full_math_fingerprint: d03fab2727e046eb6a151e579c4852cbb0536415b37028dcb3d2de9c99f278d8
focused_compliance_tests: 3
focused_compliance_status: PASS
diagnostic_ci_run: 33347537804
diagnostic_ci_failure: stale_tracked_browser_evidence_selected_with_current_candidate
verified_ci_run: 33348321475
verified_ci_status: PASS
remote_app_tests: 94
remote_full_math_books: 300000
remote_browser_scenarios: 40
remote_browser_checks_pass: 965
remote_browser_checks_fail: 0
remote_compliance_total: 51
remote_automated_proof_complete: 38
remote_manual_gate_open: 23
remote_external_gate_open: 6
remote_not_applicable: 2
remote_diagnostics_artifact: 9742920099
remote_implementation_commit: bd11699e9b9937c4fba5b1766968467e8c5921dc
manual_identical_retries: 0
```

Observed categories: compact memory/checklist/package-contract reads, targeted evidence-map/resolver/workflow/test edits, one focused and one complete local gate chain, two exact Actions runs, logs/artifact reads, and four current package screenshot inspections. The diagnostic run exposed a stale tracked browser-evidence selection; current-SHA filtering fixed the harness without weakening the matrix. One unauthenticated CLI push used the existing safe Git-data fast-forward route; no unchanged failure was repeated. No subagents, dependencies or token estimates were used.

## BS-20260831-13

```yaml
closed_at_utc: 2026-08-31T01:02:00Z
sprint_day: 2
direct_subagents: 0
tool_call_counts: null
file_read_count: null
tokens: { input: null, cached_input: null, output: null, total: null, source: not_exposed }
local_frozen_install: PASS
local_lint: PASS
local_typecheck_errors: 0
local_typecheck_warnings: 0
local_app_tests: 92
local_app_status: PASS
local_build: PASS
local_full_math_books: 300000
local_full_math_fingerprint: d03fab2727e046eb6a151e579c4852cbb0536415b37028dcb3d2de9c99f278d8
local_package_verification: PASS
local_package_books_read_back: 300000
diagnostic_local_package_failure: unexpected_frontend_assets_top_level
cancelled_superseded_ci_run: 33345675851
verified_ci_run: 33345753819
verified_ci_status: PASS
remote_app_tests: 92
remote_full_math_books: 300000
remote_package_books_read_back: 300000
remote_package_frontend_files: 9
remote_package_math_files: 7
remote_frontend_tree_sha256: fc20dd2ac114db3c1c4143e14a32d62447c7037bb443163899274fad09b5e303
remote_math_tree_sha256: 6bd0c4c7f39f9597ac7944e97446c1d09b9fe69087f21ceffe1077aa86bc01da
remote_browser_scenarios: 40
remote_browser_checks_pass: 965
remote_browser_checks_fail: 0
remote_diagnostics_artifact: 9742066991
remote_implementation_commit: 49d113415e2331a1ae0f41bff122a8c9b6870503
manual_identical_retries: 0
```

Observed categories: compact memory/package-contract reads, targeted CI/generator/verifier/test edits, one complete local gate chain, exact local package generation and 300,000-book readback, Git-data fast-forwards, two Actions runs, artifact/package inspection and five exact-package screenshot reviews. The first local readback exposed the stale verifier allowlist before its superseded CI run could claim success; one focused correction produced a green exact run. No unchanged failure was repeated, and no subagents, dependencies or token estimates were used.

## BS-20260831-12

```yaml
closed_at_utc: 2026-08-31T00:10:00Z
sprint_day: 2
direct_subagents: 0
tool_call_counts: null
file_read_count: null
tokens: { input: null, cached_input: null, output: null, total: null, source: not_exposed }
local_frozen_install: PASS
local_lint: PASS
local_typecheck_errors: 0
local_typecheck_warnings: 0
local_app_tests: 91
local_app_status: PASS
local_build: PASS
local_full_math_books: 300000
local_full_math_fingerprint: d03fab2727e046eb6a151e579c4852cbb0536415b37028dcb3d2de9c99f278d8
diagnostic_ci_run: 33342704030
diagnostic_browser_failure: reconnect_balance_thousands_separator_assumption
diagnostic_browser_checks_pass: 956
diagnostic_browser_checks_fail: 1
verified_ci_run: 33343244848
verified_ci_status: PASS
remote_app_tests: 91
remote_full_math_books: 300000
remote_browser_scenarios: 40
remote_browser_checks_pass: 964
remote_browser_checks_fail: 0
remote_diagnostics_artifact: 9741325685
remote_implementation_commit: c38b1262f5ef8fcc1a3047f9c07180a985c722d2
manual_identical_retries: 0
```

Observed categories: compact memory/RGS-contract reads, targeted Chromium evidence edits, one complete local gate chain, exact Git-data fast-forwards, two Actions runs, artifact inspection and five screenshot reviews. An over-broad Prettier write was fully removed before commit. The diagnostic run then separated a test-only `$1,000.00` assumption from the product's unchanged `$1000.00` display; the focused assertion correction produced exact green reconnect evidence without weakening any network invariant. No unchanged failure was repeated, and no subagents, dependencies or token estimates were used.

## BS-20260831-11

```yaml
closed_at_utc: 2026-08-30T23:18:00Z
sprint_day: 2
direct_subagents: 0
tool_call_counts: null
file_read_count: null
tokens: { input: null, cached_input: null, output: null, total: null, source: not_exposed }
focused_audio_mobile_tests: 8
focused_audio_mobile_status: PASS
local_lint: PASS
local_typecheck_errors: 0
local_typecheck_warnings: 0
local_app_tests: 91
local_app_status: PASS
local_build: PASS
diagnostic_ci_runs: [33339904628, 33340501482]
diagnostic_browser_failures: [replay_board_231.1875x208.90625, replay_board_231.1875x216.71875]
verified_ci_run: 33341067497
verified_ci_status: PASS
remote_app_tests: 91
remote_full_math_books: 300000
remote_full_math_fingerprint: d03fab2727e046eb6a151e579c4852cbb0536415b37028dcb3d2de9c99f278d8
remote_browser_scenarios: 40
remote_browser_checks_pass: 952
remote_browser_checks_fail: 0
replay_board_final_css_px: 220.3125x220.3125
remote_diagnostics_artifact: 9740632934
remote_implementation_commit: db848506f17a02ff7d4d7b98ae69902500d57f72
manual_identical_retries: 0
```

Observed categories: compact memory/audio-contract reads, one new runtime module, targeted UI/director/test edits, focused and complete local gates, exact GitHub writes, three Actions runs, job/log/artifact reads and five final screenshot inspections. The first exact browser run exposed a real 360x640 board regression from the 44px sound control; the second quantified the remaining 14.5px deficit, and the final short-portrait constraint restored an exact 220.3125px square without weakening touch targets. No unchanged failure was repeated, and no subagents, dependencies, external audio assets or token estimates were used.

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
