# Material run log

Newest entries first; retain at most 20.

## BS-20260830-08 — SUCCESS

- Sprint day: 1
- Base commit: `6e9bd13e887d6bf879731bedd405ae519352f461`
- Verified implementation commit: `e30d0c0de02532d6874ca1a51bde2ddbcd70a116`
- Work item: `BSB-ASSET-001` (bounded responsive environment slice; item remains in progress)
- Selection reason: exact screenshots already had the locked penguin fallback but the board still floated in a flat technical surface; the missing responsive physical-vault environment was the highest visible critical release blocker.
- Before/after evidence: before, all viewports used the flat board-stage surface. After, desktop/landscape load a 1672x941 mechanical-vault plate while <=820px portrait/tablet/Replay load a separately composed 941x1672 plate. Browser evidence records complete, visible, pointer-inert images and exact `currentSrc` per viewport.
- Changed files: two original PNG sources, two optimized WebP exports, semantic asset map, slot picture/CSS integration, manifest/provenance/asset ledger, two asset tests, Chromium QA, and sprint memory closeout files.
- Gates: focused asset contracts 3/3 PASS; lint PASS; `svelte-check` 0 errors/0 warnings PASS; app tests 83/83 PASS; production build PASS; local and exact remote math 7/7 with 300,000 books PASS; exact Chromium 37/37 scenarios and 827/827 checks PASS; console/network/request failures 0; `git diff --check` PASS.
- Visual review: optimized sources plus exact final screenshots at 1920x1080, 1366x768, 390x844, 844x390 and Replay 360x640 inspected. Vault mechanics frame the square board, correct responsive plates load, controls remain legible and no overlap, scroll, crop-selection or aspect regression is visible.
- Tool/token metrics: see `METRICS.md`; tokens are `null` / `not_exposed`; direct subagents 0. Built-in generation was text-only with no visual reference; provenance and human-review limits are explicit.
- Persistence: implementation tree was fast-forwarded without force through the connected GitHub API; exact run `33332083126` and artifact `9738046250` succeeded.
- Residual risk: human rights/Creative review, penguin alpha cleanup and Spine 4.2 rig, BLACKOUT/foreground environment layers, motion/cinematics, audio and complete gameplay/reconnect/Stake release evidence remain open.
- Next candidate: `BSB-MOTION-001`, while `BSB-ASSET-001` remains open for approval-dependent rig/BLACKOUT work.

## BS-20260830-07 — SUCCESS

- Sprint day: 1
- Base commit: `af752b0640718ffd4a0cb60edb2e8006586f3181`
- Verified implementation commit: `85eb4f2bd773e44261044edc3f836a429411f389`
- Work item: `BSB-ASSET-001` (bounded first character slice; item remains in progress)
- Selection reason: the exact slot had no runtime character despite the locked penguin/Vaultkeeper identity, making product identity the highest visible release blocker.
- Before/after evidence: before, the desktop character well was empty. After, an original mature penguin with physical chest lock is visible at 1920x1080 and 1366x768; its 702x1080 WebP loads at natural width 702 and is intentionally hidden at 390x844, 844x390 and 360x640 Replay. The first 1366 screenshot exposed an invisible-image sizing bug; the final screenshot and pixel-bounds assertion prove the fix.
- Changed files: original/optimized character assets, semantic asset map, slot UI, asset manifest/provenance/ledger, two asset tests, Chromium QA, and sprint memory closeout files.
- Gates: focused asset tests 6/6 PASS; lint PASS; `svelte-check` 0 errors/0 warnings PASS; app tests 81/81 PASS; production build PASS; exact remote math 7/7 with 300,000 books PASS; exact Chromium 37/37 scenarios and 819/819 checks PASS; console/network/request failures 0; `git diff --check` PASS.
- Visual review: exact final screenshots at 1920x1080, 1366x768, 390x844, 844x390 and Replay 360x640 inspected. Desktop character silhouette/lock are legible; compact surfaces preserve board/control priority; no overlap, scroll or board regression observed. Asset is a production candidate, not approved final art.
- Tool/token metrics: see `METRICS.md`; tokens are `null` / `not_exposed`; direct subagents 0. Image generation was built-in text-only with no visual reference; prompt and rejected-attempt limitations are retained in provenance.
- Persistence: both implementation commits were tree-identical and fast-forwarded without force through the connected GitHub API; final exact run `33329648477` and artifact `9737374574` succeeded.
- Residual risk: manual light/alpha cleanup, human rights/Creative review, Spine 4.2 rig, responsive vault environment, motion/cinematics, audio and complete gameplay/reconnect/Stake release evidence remain open.
- Next candidate: continue `BSB-ASSET-001` with the responsive mechanical-vault environment, then `BSB-MOTION-001`.

## BS-20260830-06 — SUCCESS

- Sprint day: 1
- Base commit: `586b5d0fa4eee1c8de57fce9c11641928a828f46`
- Verified implementation commit: `fa60a4721f0e898b07f9c1fddac8e9b7c04b244e`
- Work item: `BSB-MOBILE-001`
- Selection reason: exact portrait evidence truncated `BLACKOUT PROTOCOL`; Base Amount/meters lacked explicit computed centering, focus treatment was inconsistent, 1366x768 was missing, and the 360x640 Replay board could regress within a permissive 2% aspect tolerance.
- Before/after evidence: mobile mode labels now wrap and center; Base Amount and all meters report centered; Tab exposes a solid amber 3px ring with 2px separation on every geometry; 1366x768 is covered; Replay remains square under a tightened 0.2% guard. All actions remain >=44px, inside viewport and center-hittable.
- Changed files: `apps/blacksite/src/routes/+page.svelte`, `apps/blacksite/tests/blacksite-mobile-hud.test.mjs`, `scripts/blacksite-qa-e2e.mjs`, and sprint memory closeout files.
- Gates: focused mobile tests 3/3 PASS; lint PASS; `svelte-check` 0 errors/0 warnings PASS; app tests 78/78 PASS; production build PASS; exact remote math 7/7 with 300,000 books PASS; exact Chromium 37/37 scenarios and 811/811 checks PASS; console/network/request failures 0; `git diff --check` PASS.
- Visual review: exact final screenshots at 1920x1080, 1366x768, 390x844, 844x390 and Replay 360x640 inspected. Labels are complete, values centered, focus visible, boards square/on-screen, and no overlap or scrollbar regression is present. Original penguin/environment art is still absent, so production-art completion is not claimed.
- Tool/token metrics: see `METRICS.md`; tokens are `null` / `not_exposed`; direct subagents 0. Two evidence-driven QA corrections were required; unchanged failed calls were not repeated.
- Persistence: implementation was tree-identical and fast-forwarded without force through the connected GitHub API; exact run `33326796710` and artifact `9736580209` succeeded.
- Residual risk: original rights-cleared penguin/vault assets, production motion/cinematics, audio and complete gameplay/reconnect/Stake release evidence remain open.
- Next candidate: `BSB-ASSET-001`, then `BSB-MOTION-001`.

## BS-20260830-05 — SUCCESS

- Sprint day: 1
- Base commit: `cc2a0a57d2ffb4ecf94646d6e6c13e323579ef3c`
- Verified implementation commit: `cde685d09759a05f446004f6ba4dd89fd1cf6c4f`
- Work item: `BSB-HUD-001`
- Selection reason: exact current-head screenshots exposed a production-facing technical greybox: coordinates, `--` placeholders, three-letter symbol codes, schema/unit/event hashes and internal panel language.
- Before/after evidence: exact 1920x1080, 390x844 and 844x390 screenshots changed from diagnostic cells/panels to a player-facing vault HUD with semantic symbols and concealed states. A populated Replay screenshot proves full symbol names/marks. Geometry remained square/on-screen and all required controls remained hittable.
- Changed files: `apps/blacksite/src/routes/+page.svelte`, `apps/blacksite/tests/blacksite-player-hud.test.mjs`, `scripts/blacksite-qa-e2e.mjs`, and sprint memory closeout files.
- Gates: focused HUD tests 3/3 PASS; lint PASS; `svelte-check` 0 errors/0 warnings PASS; app tests 75/75 PASS; production build PASS; exact remote math 7/7 with 300,000 books PASS; exact Chromium 36/36 scenarios and 750/750 checks PASS; console/network/request failures 0; `git diff --check` PASS.
- Visual review: exact final screenshots at 1920x1080, 390x844, 844x390 and Replay 1280x720 inspected. Internal copy is absent and no overlap/scroll regression was observed. Original penguin/environment assets are still absent, so production-art completion is not claimed.
- Tool/token metrics: see `METRICS.md`; tokens are `null` / `not_exposed`; direct subagents 0. Initial CI correctly caught Social-restricted `BET` copy and an over-strict compact-status assertion; both were fixed before closeout.
- Persistence: implementation was tree-identical and fast-forwarded without force through the connected GitHub API; exact run `33324002432` and artifact `9735814868` succeeded.
- Residual risk: production penguin/vault assets and rights review, mobile truncation/centering/focus polish, motion/cinematics, audio and complete release evidence remain open.
- Next candidate: `BSB-MOBILE-001`, then the first original production penguin/vault asset integration slice.

## BS-20260830-04 — SUCCESS

- Sprint day: 1
- Base commit: `f24e3ae1aa3eeaee453264dbd51926ac7f5f7eb0`
- Verified implementation commit: `e243fe7ad3c0306af5f991366c6fd473e97871de`
- Work item: `BSB-ID-001`
- Selection reason: the user's explicit penguin + lock/vault identity conflicted with active master-plan, animation, agent and manifest direction that still promoted a human operative.
- Before evidence: the retained character PNG is a human operative; the environment concept embeds a human; the manifest marked both concepts active and requested an operative Spine group. The exact running slot remained a technical greybox without production character/vault art.
- After evidence: a machine-readable locked identity names the original mature penguin Vaultkeeper and four physical vault anchors; human concepts are superseded/runtime-ineligible; art/animation/intro plans, durable director prompts, production ledger and original-asset acceptance criteria agree. Three regression tests prevent reactivation.
- Changed files: active asset/animation/master-plan docs, asset manifest/provenance, asset/intro skills, creative/asset director prompts, identity regression test, and sprint memory closeout files.
- Gates: focused identity tests 3/3 PASS exit 0; lint PASS exit 0; `svelte-check` 0 errors/0 warnings PASS exit 0; app tests 72/72 PASS exit 0; production build PASS exit 0; exact remote full math 7/7 with 300,000 books PASS; exact Chromium 36/36 scenarios and 736/736 checks PASS; `git diff --check` PASS exit 0.
- Visual review: exact current-commit screenshots at 1920x1080, 390x844 and 844x390 were inspected from run `33320205882`. Runtime is geometrically clean but visibly remains a greybox with no production penguin/vault asset; no visual-art completion is claimed. No runtime CSS/DOM/math change occurred in this slice.
- Tool/token metrics: see `METRICS.md`; tokens are `null` / `not_exposed`; direct subagents 0.
- Persistence: source tree was GitHub/local tree-identical and fast-forwarded without force through the connected GitHub API; exact run `33320205882` and diagnostics artifact `9734778601` completed successfully.
- Residual risk: original production penguin/vault assets, rights review, runtime integration, HUD, motion, audio and full release evidence remain open.
- Next candidate: `BSB-HUD-001`, then `BSB-MOBILE-001` or the first production penguin/vault integration slice.

## BS-20260830-03 — SUCCESS

- Sprint day: 1
- Base commit: `04a43c395f968cee1a631313816c59df35d94829`
- Verified implementation commit: `a2a2e623af01405cda64ad94d350906691e75c39`
- Work items: `BSB-CI-001`, `BSB-QA-001`
- Selection reason: exact run `33315820538` passed install/lint/typecheck/tests/build/math/Chromium install but failed the built frontend because completed Replay at 360x640 distorted the board to 263.1875x234.5 CSS pixels.
- Before evidence: SHA-bound artifact reported 707 PASS / 1 FAIL across 36 scenarios; only `geometry-replay-popout-s-360x640` failed, at ratio 1.1223. Desktop, phone, tablet and landscape geometry plus console/network were already clean.
- After evidence: portrait board sizing now uses the constrained viewport height. Exact clean run `33317660876` passed 36/36 scenarios and 736/736 checks; Replay board is 231.1875x231.1875, above the 220-pixel floor, all 49 cells visible, no scroll, and every required control visible, inside the viewport, at least 44x44 and center-hittable.
- Changed files: `apps/blacksite/src/routes/+page.svelte` and sprint memory closeout files.
- Gates: frozen install PASS; lint PASS exit 0; `svelte-check` 0 errors/0 warnings PASS exit 0; app tests 69/69 PASS exit 0; production build PASS exit 0; remote full math PASS; remote Chromium E2E 736/736 PASS; `git diff --check` PASS. Local browser install BLOCKED exit 1 by CDN and not repeated.
- Visual review: exact current-commit screenshots inspected at 1920x1080, 390x844, 844x390 and Replay 360x640. No new overlap/cutoff; Replay distortion resolved. Known greybox, truncated mobile Blackout label and missing production art remain release work.
- Tool/token metrics: see `METRICS.md`; tokens are `null` / `not_exposed`; direct subagents 0.
- Persistence: source tree was verified tree-identical and fast-forwarded without force through the connected GitHub API; exact run succeeded and diagnostics artifact `9734033969` was retained for 30 days.
- Residual risk: this closes the technical CI/browser baseline, not the production HUD, product identity, animation, audio, full device or Stake release gates.
- Next candidate: `BSB-ID-001`, then `BSB-HUD-001`.

## BS-20260830-02 — SUCCESS (remote CI pending)

- Sprint day: 1
- Base commit: `9952c3b0a5d7d96912b5ae4103585355e88348a9`
- Remote CI implementation commit: `15eab121481f52de37234e1ce4b3217d199808b1`
- End commit: `8feae80f1e31f29aaf81e269dd990902c739e4a4`
- Work item: `BSB-CI-001`
- Selection reason: the target branch had no BlackSite workflow, no typecheck command, and no reproducible path to current-head Chromium evidence.
- Before evidence: typecheck tool absent; initial strict production/source baseline exposed 183 diagnostics; existing Stake CI did not trigger for this branch/app; local Chromium remained unavailable.
- After evidence: pinned `svelte-check` verifies production sources/config with 0 errors and 0 warnings; branch CI records exact SHA, runs frozen install/lint/check/69 tests/build/one 300,000-book math pass/Chromium E2E, and uploads identity plus browser evidence on failure or success. Live Actions observation found and removed a duplicate PR trigger.
- Changed files: `.github/workflows/blacksite-ci.yml`, app package/lock/config/type declarations, six production JS files with type-only JSDoc, and `.codex/memory/*`.
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
