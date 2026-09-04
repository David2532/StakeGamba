# BLACKSITE memory index

Read in this order for each bounded run:

1. `CURRENT_STATE.md` — compact verified state and blockers.
2. `WEEK_SPRINT.md` — dates, day focus, Definition of Done evidence.
3. The first open items in `BACKLOG.md` — select one vertical slice.
4. At most the newest three entries in `RUN_LOG.md`.
5. Only task-relevant entries in `DECISIONS.md` and `LESSONS.md`.
6. `METRICS.md` only when measuring or improving the automation workflow.

Repository code, reproducible tests, exact build artifacts, and current-head browser evidence override memory. Correct stale memory in the same run. Do not store secrets, prompts, chat logs, generated bundles, or large command output here.
