# Material run log

Newest entries first; retain at most 20.

## BS-20260830-02 — SUCCESS (remote CI pending)

- Sprint day: 1
- Base commit: `9952c3b0a5d7d96912b5ae4103585355e88348a9`
- Remote CI implementation commit: `15eab121481f52de37234e1ce4b3217d199808b1`
- End commit: `8feae80f1e31f29aaf81e269dd990902c739e4a4`
- Work item: `BSB-CI-001`
- Selection reason: the target branch had no BlackSite workflow, no typecheck command, and no reproducible path to current-head Chromium evidence.
- Before evidence: typecheck tool absent; initial strict production/source baseline exposed 183 diagnostics; existing Stake CI did not trigger for this branch/app; local Chromium remained unavailable.
- After evidence: pinned `svelte-check` verifies production sources/config with 0 errors and 0 warnings; branch CI records exact SHA, runs frozen install/lint/check/69 tests/build/one 300,000-book math pass/Chromium E2E, and uploads identity plus browser evidence on failure or success. Live Actions observation found and removed a duplicate PR trigger.
- Changed files: `.github/workflows/blacksite-ci.yml`, app package/lock/config/type declarations, seven production JS files with type-only JSDoc, and `.codex/memory/*`.
- Gates: frozen pnpm 10.5.0 install PASS; workflow/changed-file Prettier PASS; app lint PASS; production-source typecheck 0/0 PASS; full app 69/69 PASS; focused final-diff regressions 61/61 PASS; production build PASS; full math 7/7 and 300,000 books PASS with fingerprint `d03fab2727e046eb6a151e579c4852cbb0536415b37028dcb3d2de9c99f278d8`; `git diff --check` PASS. Local browser install BLOCKED by CDN timeout; exact remote run `33315820538` is in progress.
- Visual review: NOT_RUN/BLOCKED locally; no current-head desktop/mobile screenshot claim. The remote harness is configured for 1920x1080, 360x740, 390x844, 768x1024, 844x390, and replay popout 360x640.
- Tool/token metrics: see `METRICS.md`; tokens are `null` / `not_exposed`; direct subagents 0.
- Persistence: local HTTPS push lacked credentials; connected GitHub API created tree-identical commits and fast-forwarded the target branch without force. Final SHA started exactly one workflow.
- Residual risk: CI/Chromium result is not yet evidence until run `33315820538` completes successfully; the greybox/art/identity/motion/audio/mobile release blockers remain.
- Next candidate: close `BSB-CI-001` from exact workflow evidence, then `BSB-ID-001` before further character production.

## BS-20260830-01 — SUCCESS

- Sprint day: 1
- Base commit: `a6282cb1863392ca633c77f3a8e805b104e2b7e8`
- Verified implementation commit: `2977b4d1ab6ec8250198ce271f0501df509b4bab`
- Remote memory baseline commit: `8636652946dfa931cf838ebc9a30c602da6748da`
- Work item: `BSB-RGS-001`
- Selection reason: a real RGS round whose amount × centi-x product had a fractional micro-unit was rejected by exact cross-product equality, blocking paid live play and active-round restore.
- Before evidence: `base_small` book 65220, amount `100001`, terminal raw `38`, valid half-up payout `38000`; old check compared `3800000` with `3800038` and threw `ROUND_PAYOUT_AMOUNT_MISMATCH`.
- After evidence: exact non-negative BigInt half-up conversion; remainder 38/50/75 cases accepted, adjacent payouts rejected; real fixture plus new-play and restore controller paths pass.
- Product files: `apps/blacksite/src/lib/rgs/contracts.js`, `apps/blacksite/tests/blacksite-rgs.test.mjs`.
- Workflow files: `AGENTS.md`, `.codex/automation/HOURLY_LOOP.md`, `.codex/memory/*`, corrected `.codex/agents/*` document paths.
- Gates: focused RGS 32/32 PASS; app lint PASS; full app 69/69 PASS; production build PASS; full math 7/7 and 300,000 books PASS; `git diff --check` PASS. Typecheck BLOCKED because no tool exists. Browser E2E BLOCKED because Chromium is unavailable and both local-install and cloud-localhost paths failed.
- Visual review: NOT_RUN/BLOCKED for current HEAD. Read-only source audit found M2 greybox UI, missing penguin/vault runtime, no production animation/audio, Base Amount centering defect, mobile mode truncation, and weak focus treatment. No screenshot claim.
- Tool/token metrics: see `METRICS.md`; tokens are `null` / `not_exposed`.
- Persistence: local HTTPS push was credential-blocked; connected GitHub API created tree-identical commits and fast-forwarded the target branch without force.
- Residual risk: browser-level fractional network/result proof is still absent; overall slot remains far from release candidate quality.
- Next candidate: `BSB-CI-001`, then `BSB-QA-001` and `BSB-ID-001`.
