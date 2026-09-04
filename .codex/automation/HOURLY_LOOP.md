# BLACKSITE hourly improvement loop

Run exactly one bounded improvement cycle and then stop. Target only `codex/blacksite-aaa-studio`; never merge, deploy, force-push, reset hard, clean, or work on `main`.

1. Confirm repository, branch, HEAD, worktree, recent commits, CI visibility, and absence of an overlapping run. Unknown changes are foreign and remain untouched.
2. Read `AGENTS.md`, then the compact order in `.codex/memory/INDEX.md`. Load only task-relevant BLACKSITE docs, one relevant skill, and one specialist contract.
3. Reproduce the highest-priority open blocker with code, a deterministic fixture, a test, or current-head browser evidence. Choose one coherent vertical slice with an explicit exit condition.
4. Implement the smallest complete fix using existing architecture. Add a regression at the layer that failed. Never change math, RNG, wallet, or provider contracts without deterministic proof.
5. Run focused checks, then one complete relevant gate cycle. UI work requires current-head desktop, portrait, and landscape interaction plus console/network inspection. A blocked browser is `BLOCKED`, never visual PASS.
6. Review `git diff`, run `git diff --check`, remove generated churn, and scan the owned diff for secrets, debug code, dead files, and scope expansion.
7. At minute 35, start no new work item. Update sprint memory and metrics with exact evidence; use `null` when telemetry is unavailable.
8. Stage explicit owned paths only. Commit material verified changes, push the same branch when allowed, report blockers and the next highest focus, then end the run.

If the worktree or active processes show another run working on the same item, close as `SKIPPED_OVERLAP`. If no safe material improvement exists after verification, close as `VERIFIED_NO_OP`. Do not ask routine questions, wait for confirmation, sleep, or schedule another invocation.
