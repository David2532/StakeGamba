# Material run log

Newest entries first; retain at most 20.

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
