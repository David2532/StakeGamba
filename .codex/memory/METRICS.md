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
```

Exact aggregate tool/file counts were not exposed after context compaction and are not estimated. Observed inefficiencies: two browser-install command attempts triggered repeated CDN failures; a redundant early math verify/test pair was started before the final gate cycle; root-relative agent document paths caused failed lookups; one targeted ESLint invocation omitted the repository's legacy-config environment. Corrections: use only `blacksite:math:test`, route future runs through compact memory, fix agent paths, invoke the package lint gate, and stop unchanged browser retries after the documented failure.
