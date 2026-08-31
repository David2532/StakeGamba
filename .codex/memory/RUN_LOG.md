# Material run log

Newest entries first; retain at most 20.

## BS-20260831-22 — SUCCESS

- Sprint day: 2
- Base commit: `e657dd9b9f43a65d92f9966c3ad953a101881a6e`
- Verified implementation commit: `9f2d8888da7956cf7d847f52ff1a2d1216b9496a`
- Work item: `BSB-EVIDENCE-001` (bounded currency-family/provider-evidence slice; item remains in progress)
- Selection reason: checklist item 11 referenced only Social XSC and authoritative USD; the exact extracted candidate lacked native zero-decimal and unknown-code fallback proof, leaving currency display/request behavior under-evidenced.
- Before/after evidence: exact Chromium now authenticates and plays in JPY and ZZZ. JPY shows `¥2` ready balance, `¥1` play, exact `¥0.38` win and final `¥1`; ZZZ shows `1.23 ZZZ`, `1.00 ZZZ`, final `0.23 ZZZ` and `0.00 ZZZ`. Each request carries its exact currency and emits one `/wallet/play`, no settlement write; both return to `live-ready` with the now-unaffordable action disabled. The fail-closed 51-point map binds Social, USD, JPY and fallback scenarios.
- Changed files: Chromium QA, 51-point evidence map, compliance regression and sprint memory closeout files.
- Gates: syntax PASS; focused currency/evidence tests 11/11 PASS; frozen install PASS; lint PASS; `svelte-check` 0 errors/0 warnings PASS; app tests 103/103 PASS; production build PASS; local and exact remote math 7/7 with 300,000 books PASS and unchanged fingerprint; isolated package and 51-row evidence resolution PASS; exact Chromium 43/43 scenarios and 1015/1015 checks PASS; unexpected network/page/request failures 0; `git diff --check` PASS.
- Visual review: exact 1920x1080, 1366x768, 390x844, 844x390, Replay 360x640, JPY 1280x720 and ZZZ 390x844 screenshots from artifact `9753064218` inspected. Boards remain square and fully visible, values and controls remain readable/reachable, intended penguin/vault pixels render, and no overlap, scrollbar, crop or broken-image regression is visible.
- Tool/token metrics: see `METRICS.md`; tokens are `null` / `not_exposed`; direct subagents 0. Two distinct CI-only harness assumptions were corrected from computed browser evidence; no unchanged semantic retry, dependency or binary product asset was added.
- Persistence: implementation was fast-forwarded without force through the connected GitHub API; exact run `33378233377` and artifact `9753064218` succeeded.
- Residual risk: human rights/Creative approval and cleanup, approved Spine 4.2 rig/authored clips, BLACKOUT/foreground layers, final audio assets and manual listening/device QA, real-device pacing, contractually allowed autoplay, 23 manual checklist gates and 6 external approvals remain open.
- Next candidate: continue `BSB-EVIDENCE-001` with the highest safe automatable gameplay/provider state not yet current-head proven; manual and external approvals remain explicitly unclaimed.

## BS-20260831-21 — SUCCESS

- Sprint day: 2
- Base commit: `fd0efa69a52e4302a6cb009e4dbdb3073f83387e`
- Verified implementation commit: `aa1a4b8b919d1abc5b88db50f450dc2e43508fc7`
- Work item: `BSB-EVIDENCE-001` (bounded competing-input/provider-evidence slice; item remains in progress)
- Selection reason: unit-level controller coverage existed, but the exact extracted browser candidate did not prove that rapid pointer and keyboard paths cannot create duplicate paid plays while the RGS request is in flight.
- Before/after evidence: an exact-package scenario now delays `/wallet/play` by 500ms and issues two primary-button clicks plus Space in one burst. Exactly one POST with session, USD, `1000000` and base mode is admitted; primary action and Base Amount are disabled in `live-requesting`; the round returns once to `live-ready`. The scenario has no unexpected requests, console errors, page errors or failed requests.
- Changed files: Chromium QA, exact-browser contract regression, and sprint memory closeout files.
- Gates: syntax PASS; focused contracts 19/19 PASS; frozen install PASS; lint PASS; `svelte-check` 0 errors/0 warnings PASS; app tests 102/102 PASS; production build PASS; local and exact remote math 7/7 with 300,000 books PASS and unchanged fingerprint; isolated package and 51-row evidence resolution PASS; exact Chromium 41/41 scenarios and 988/988 checks PASS; unexpected network/page/request failures 0; `git diff --check` PASS.
- Visual review: exact 1920x1080, 1366x768, 390x844, 844x390, Replay 360x640 and populated competing-input completion screenshots from artifact `9750141257` inspected. Boards remain square and fully visible, controls remain reachable, intended penguin/vault pixels render, and no overlap, scrollbar, crop or broken-image regression is visible.
- Tool/token metrics: see `METRICS.md`; tokens are `null` / `not_exposed`; direct subagents 0. No semantic failure or unchanged tool call was repeated; no dependencies or binary product assets were added.
- Persistence: implementation was fast-forwarded without force through the connected GitHub API; exact run `33370382251` and artifact `9750141257` succeeded.
- Residual risk: human rights/Creative approval and cleanup, approved Spine 4.2 rig/authored clips, BLACKOUT/foreground layers, final audio assets and manual listening/device QA, real-device pacing, contractually allowed autoplay, 23 manual checklist gates and 6 external approvals remain open.
- Next candidate: continue `BSB-EVIDENCE-001` with the highest safe automatable gameplay/provider state not yet current-head proven; manual and external approvals remain explicitly unclaimed.

## BS-20260831-20 — SUCCESS

- Sprint day: 2
- Base commit: `e1e3ad5c6f8077d12df12f0e63daaae5bbb41729`
- Verified implementation commit: `77faaa5b3204dd34f431913bfdc26093e963d476`
- Work item: `BSB-README-001` (complete)
- Selection reason: the app README still described an M2 greybox with no paid play and no Replay, contradicting the exact M3 runtime, scripts and fail-closed release process.
- Before/after evidence: README now documents live RGS launch, sessionless read-only Replay, fixtures, actual package commands, exact-package candidate verification and the explicit `QA_BLOCKED`/not-release-ready boundary. Three regressions reject stale claims and script drift. The first exact CI run then exposed a transient character `failed` state being asserted before the accepted mechanical fallback; the harness now waits only for terminal `painted` or `fallback`.
- Changed files: app README, README regression, Chromium QA asset wait, runtime-asset regression, and sprint memory closeout files.
- Gates: focused README 3/3 and asset 6/6 PASS; frozen install PASS; lint PASS; `svelte-check` 0 errors/0 warnings PASS; app tests 101/101 PASS; production build PASS; local and exact remote math 7/7 with 300,000 books PASS and unchanged fingerprint; isolated package and 51-row evidence resolution PASS; exact Chromium 40/40 scenarios and 975/975 checks PASS; unexpected network/page/request failures 0; `git diff --check` PASS. Local Chromium was BLOCKED only because its Playwright executable is absent; exact CI supplies the required clean-package browser proof.
- Visual review: exact 1920x1080, 1366x768, 390x844, 844x390 and Replay 360x640 screenshots from artifact `9748384857` inspected. Boards are square and fully visible, controls remain reachable, and no overlap, scrollbar, crop or broken-image regression is visible. Replay copy wraps within its narrow panel without escaping it.
- Tool/token metrics: see `METRICS.md`; tokens are `null` / `not_exposed`; direct subagents 0. One transient exec transport disconnect was retried once; no unchanged semantic failure was repeated.
- Persistence: README implementation `68ddaca` and verification fix `77faaa5` were tree-identical fast-forwards without force through the connected GitHub API; exact run `33365621986` and artifact `9748384857` succeeded.
- Residual risk: human rights/Creative approval and cleanup, approved Spine 4.2 rig/authored clips, BLACKOUT/foreground layers, final audio assets and manual listening/device QA, real-device pacing, 23 manual checklist gates and 6 external approvals remain open.
- Next candidate: continue `BSB-EVIDENCE-001` with the highest safe automatable gameplay/provider evidence slice while external/manual approvals remain explicitly unclaimed.

## BS-20260831-19 — SUCCESS

- Sprint day: 2
- Base commit: `3be001a84adb28400970c422c8e4de08c2c5dc18`
- Verified implementation commit: `fbfe4ed0cabe40d2df7a6c1f7962e3cc3c2f0da5`
- Work item: `BSB-ASSET-002` (complete)
- Selection reason: the previous exact 1920 geometry screenshot omitted character and vault pixels despite loaded/visible/natural-width DOM checks, proving those checks could race browser decode/compositing.
- Before/after evidence: images now follow decode → Svelte reveal → two animation-frame compositor barrier with explicit loading/decoded/painted/failure states. The exact harness blocks every screenshot and geometry audit until the barrier is terminal and fails closed on environment failure. Run `33362124623` records `painted` for both assets on every geometry surface; exact 1920 and 1366 screenshots contain penguin/vault pixels, while portrait, landscape and Replay contain the intended responsive vault plate.
- Changed files: image paint utility, slot asset lifecycle/CSS, runtime-asset regression, Chromium QA, and sprint memory closeout files.
- Gates: focused asset 6/6 PASS; lint PASS; `svelte-check` 0 errors/0 warnings PASS; app tests 98/98 PASS; production build PASS; local and exact remote math 7/7 with 300,000 books PASS and unchanged fingerprint; isolated package/evidence resolution PASS; exact Chromium 40/40 scenarios and 975/975 checks PASS; unexpected console/page/request failures 0; `git diff --check` PASS.
- Visual review: exact 1920x1080, 1366x768, 390x844, 844x390 and Replay 360x640 screenshots inspected. Desktop penguin and vault plate are visibly rastered; compact surfaces select the intended plate and keep the character hidden by design. Boards remain square, controls visible, and no overlap, scroll or crop regression is present.
- Tool/token metrics: see `METRICS.md`; tokens are `null` / `not_exposed`; direct subagents 0. Broad formatter churn was removed before commit; content-addressed Git-data persistence retained the executable QA mode and exact local/remote tree identity.
- Persistence: the implementation tree was fast-forwarded without force through the connected GitHub API; exact run `33362124623` and artifact `9747264261` succeeded.
- Residual risk: human rights/Creative approval and cleanup, approved Spine 4.2 rig/authored clips, BLACKOUT/foreground layers, final audio assets and manual listening/device QA, real-device pacing, 23 manual checklist gates and 6 external approvals remain open.
- Next candidate: `BSB-README-001` lifecycle/runbook freshness, then the highest safe non-external asset/audio evidence slice.

## BS-20260831-18 — SUCCESS

- Sprint day: 2
- Base commit: `43d64d6e5b07adbc11c09510e6dc4abbd0f3131a`
- Verified implementation commit: `f333f220c9299e6f2c44765ff08fad7c93c97591`
- Work item: `BSB-AUDIO-001` (authored procedural reel/character mix slice; item remains in progress)
- Selection reason: the safe master bus existed, but board stops had one generic cue, character/feature semantics lacked distinct recipes, and no bounded ambience duck/restore contract existed.
- Before/after evidence: every authoritative board snapshot now schedules seven bounded reel-stop pulses at exact normal `0/24/48/72/96/120/144ms` or turbo `0/8/16/24/32/40/48ms` offsets. Win, anticipation, BLACKOUT, exfil, cap and settlement map to semantic recipes; priority cues duck then restore the existing ambience bus without duplicating the graph. Exact Chromium records seven pulses, one priority cue/duck, one ambience instance, persisted mute and locked/no-autoplay reload.
- Changed files: audio director, sound-control telemetry, audio regression suite, Chromium QA, and sprint memory closeout files.
- Gates: focused audio 5/5 PASS; frozen install PASS; lint PASS; `svelte-check` 0 errors/0 warnings PASS; app tests 97/97 PASS; production build PASS; local and exact remote math 7/7 with 300,000 books PASS and unchanged fingerprint; package/evidence resolution PASS; exact Chromium 40/40 scenarios and 975/975 checks PASS; unexpected console/network/request failures 0; `git diff --check` PASS.
- Visual review: exact-tree 1920x1080, 1366x768, 390x844, 844x390, Replay 360x640 and audio-state screenshots inspected. Geometry and controls remain square/on-screen without new overlap, scroll or crop regressions. The final 1920 geometry screenshot omitted loaded character/vault pixels while a later exact audio screenshot rendered the vault, exposing an unresolved decode/paint-readiness race. Automated graph/timing proof is not a listening, clipping or real-device approval claim.
- Tool/token metrics: see `METRICS.md`; tokens are `null` / `not_exposed`; direct subagents 0. Broad formatter churn was removed, and a post-push executable-mode mismatch was corrected before binding final CI evidence.
- Persistence: implementation plus the executable-mode correction were fast-forwarded without force through the connected GitHub API; exact run `33359618133` and artifact `9746470203` succeeded.
- Residual risk: deterministic asset decode/paint readiness, final approved audio assets and manual clipping/listening/device QA, approved Spine 4.2 rig/authored clips, asset rights/Creative approval, real-device frame pacing, 23 manual checklist gates and 6 external approvals remain open.
- Next candidate: `BSB-ASSET-002` deterministic asset decode/paint readiness, then `BSB-README-001` lifecycle/runbook freshness.

## BS-20260831-17 — SUCCESS

- Sprint day: 2
- Base commit: `cb8d34915dfe8ce08aa685e72103f340250e4ab6`
- Verified implementation commit: `1da3b6f763d3c263647a152d3d028f8169fc829b`
- Work item: `BSB-MOTION-001` (normal/feature frame-pacing evidence slice; item remains in progress)
- Selection reason: exact turbo cadence was measured, but normal three-cascade presentation and the complete BLACKOUT transition still lacked current-package frame-pacing evidence.
- Before/after evidence: reusable exact-browser sampling now covers the complete normal three-cascade path and full BLACKOUT enter/reveal/exit lifecycle. Normal records 181 samples at 16.7ms p95, 16.8ms maximum and zero >50ms stalls with exact first-row offsets `0/24/48/72/96/120/144ms`; BLACKOUT records 241 samples at 33.4ms p95, 66.7ms maximum and one >50ms stall. Exact `$2.07`/`$0.00`, expected request counts and ready/idle cleanup remain intact.
- Changed files: Chromium QA, motion-contract regression, and sprint memory closeout files.
- Gates: focused syntax/regression PASS; frozen install PASS; lint PASS; `svelte-check` 0 errors/0 warnings PASS; app tests 96/96 PASS; production build PASS; local and exact remote math 7/7 with 300,000 books PASS and unchanged fingerprint; package/evidence resolution PASS; exact Chromium 40/40 scenarios and 973/973 checks PASS; unexpected console/network/request failures 0; `git diff --check` PASS.
- Visual review: exact 1920x1080, 390x844, 844x390, Replay 360x640, normal reel-stop and BLACKOUT-transition screenshots inspected. Boards and controls remain visible and square without new overlap, scroll or crop regression; populated cadence and BLACKOUT foreground layers remain coherent at the captured authoritative frames.
- Tool/token metrics: see `METRICS.md`; tokens are `null` / `not_exposed`; direct subagents 0. The repository animation/visual-QA rules required authoritative bounded motion, reproducible frames and screenshot review. One oversized image batch was replaced with smaller inspections; no unchanged failure was repeated.
- Persistence: the tree-identical implementation was fast-forwarded without force through the connected GitHub API; exact run `33356700576` and artifact `9745529819` succeeded.
- Residual risk: approved Spine 4.2 rig/authored clips, real-device frame-pacing, rights/Creative approval, manual audio/device QA, 23 manual checklist gates and 6 external approvals remain open.
- Next candidate: move to `BSB-AUDIO-001` authored reel/character detail and listening evidence unless the approved rig becomes available.

## BS-20260831-16 — SUCCESS

- Sprint day: 2
- Base commit: `efb41da1eb5ffb7462c41f68ceedf58816b22c28`
- Verified implementation commit: `2926692756d8f98222ef40b923b083e216f28f07`
- Work item: `BSB-MOTION-001` (reel-stop/frame-pacing slice; item remains in progress)
- Selection reason: authoritative cascade and Vaultkeeper semantics were exact, but all seven columns revealed simultaneously and no measured frame-pacing evidence existed.
- Before/after evidence: the board reveal now uses bounded per-column/per-row custom properties. Exact Chromium records turbo first-row offsets `0/8/16/24/32/40/48ms`, each at 70ms, and 79 rAF deltas at 16.7ms p95, 16.8ms maximum and zero >50ms stalls. The canonical three-cascade round still settles at exact `$2.07` with ready/idle cleanup.
- Changed files: presentation director, slot UI/CSS, contract regression, Chromium QA, and sprint memory closeout files.
- Gates: frozen install PASS; lint PASS; `svelte-check` 0 errors/0 warnings PASS; app tests 95/95 PASS; production build PASS; local and exact remote math 7/7 with 300,000 books PASS and unchanged fingerprint; package/evidence resolution PASS; exact Chromium 40/40 scenarios and 970/970 checks PASS; unexpected console/network/request failures 0; `git diff --check` PASS.
- Visual review: exact 1920x1080, 1366x768, 390x844, 844x390, Replay 360x640 and active reel-stop screenshots inspected. The stagger reads across the populated vault grid; boards/controls remain visible, square and free of new overlap, scroll or crop regressions.
- Tool/token metrics: see `METRICS.md`; tokens are `null` / `not_exposed`; direct subagents 0. One quoting error, one unauthenticated CLI push and one policy-rejected temporary cleanup each used a safer changed alternative; nothing failed twice unchanged.
- Persistence: the tree-identical implementation was fast-forwarded without force through the connected GitHub API; exact run `33355037527` and artifact `9745037349` succeeded.
- Residual risk: approved Spine 4.2 rig/authored clips, broader normal/feature/device frame-pacing evidence, rights/Creative approval, manual audio/device QA, 23 manual checklist gates and 6 external approvals remain open.
- Next candidate: continue `BSB-MOTION-001` with normal/feature pacing and authored-clip integration if the approved rig becomes available; otherwise complete `BSB-AUDIO-001` authored reel/character detail and listening evidence.

## BS-20260831-15 — SUCCESS

- Sprint day: 2
- Base commit: `c4c861217129e8922e25b3d622d0bf5eb6d1a581`
- Verified implementation commit: `176422ee721eb90a4f8507073758bbb2253946f4`
- Work item: `BSB-MOTION-001` (semantic Vaultkeeper fallback slice; item remains in progress)
- Selection reason: board/cascade/vault motion was exact, but the static production-candidate penguin never reacted to authoritative gameplay and a missing image left a broken character well while the external Spine rig remained unavailable.
- Before/after evidence: round, board, win, feature, cap and settlement cues now drive immutable semantic character states with bounded normal/turbo/reduced CSS motion. Exact Chromium records `spin_start → monitoring → win_acknowledge → recover → idle_a`; SKIP reaches ready/idle in 103ms with exact `$2.07`, and an injected image error swaps to a deterministic mechanical penguin silhouette without blocking play.
- Changed files: presentation director, slot UI/CSS, contract/runtime-asset regressions, Chromium QA, and sprint memory closeout files.
- Gates: frozen install PASS; lint PASS; `svelte-check` 0 errors/0 warnings PASS; app tests 95/95 PASS; production build PASS; local and exact remote math 7/7 with 300,000 books PASS and unchanged fingerprint; isolated package/evidence resolution PASS; exact Chromium 40/40 scenarios and 968/968 checks PASS; unexpected console/network/request failures 0; `git diff --check` PASS.
- Visual review: exact 1920x1080, 390x844, 844x390, Replay 360x640, populated character-motion and forced fallback screenshots inspected. Desktop character and mechanical silhouette stay within the dedicated well; compact modes preserve board/control priority; no new overlap, scroll, crop or broken-image UI is visible.
- Tool/token metrics: see `METRICS.md`; tokens are `null` / `not_exposed`; direct subagents 0. Formatter churn was fully removed, one stale markup-order assertion was fixed, and authenticated artifact retrieval replaced one 401 without repeating it unchanged.
- Persistence: the tree-identical implementation was fast-forwarded without force through the connected GitHub API; exact run `33352237842` and artifact `9744182047` succeeded.
- Residual risk: approved Spine 4.2 rig/authored clips, reel-stop and broad frame-pacing polish, asset rights/Creative approval, manual audio/device QA, 23 manual checklist gates and 6 external approvals remain open.
- Next candidate: continue `BSB-MOTION-001` with reel-stop polish and measurable frame-pacing evidence; then return to authored audio detail/manual QA.

## BS-20260831-14 — SUCCESS

- Sprint day: 2
- Base commit: `30c551d985a784bb75b96613fb13ac7256a807d8`
- Verified implementation commit: `bd11699e9b9937c4fba5b1766968467e8c5921dc`
- Work item: `BSB-EVIDENCE-001` (exact 51-point candidate matrix; item remains in progress for real manual/external evidence)
- Selection reason: package/browser gates were exact, but the repository's numbered Stake checklist remained scattered and had no machine-enforced completeness, identity binding or honest separation of automated, manual and external claims.
- Before/after evidence: all IDs 1–51 are now ordered and statused; the resolver verifies package SHA/tree identity plus every referenced current-browser scenario/check, fails closed on omissions, and emits 20 automated PASS, 18 automated-proof/manual-open, 5 manual-only, 6 external-open and 2 N/A rows. Thus 38 automated references are complete, while 23 manual gates and 6 external approvals remain explicitly `NOT_CLAIMED`.
- Changed files: BlackSite workflow, machine-readable evidence map, compliance resolver, two regression suites, release documentation, and sprint memory closeout files.
- Gates: focused compliance/package regressions 3/3 PASS; frozen install PASS; lint PASS; `svelte-check` 0 errors/0 warnings PASS; app tests 94/94 PASS; production build PASS; local and exact remote math 7/7 with 300,000 books PASS; exact package verification PASS; exact packaged Chromium 40/40 scenarios and 965/965 checks PASS; unexpected console/network/request failures 0; compliance matrix/reference resolution PASS; `git diff --check` PASS.
- Visual review: product-identical exact-package screenshots at 1920x1080, 390x844, 844x390 and Replay 360x640 were inspected. Boards remain square/on-screen, controls readable and reachable, and no overlap, scroll or crop regression is visible. This slice did not change runtime UI.
- Tool/token metrics: see `METRICS.md`; tokens are `null` / `not_exposed`; direct subagents 0. Diagnostic run `33347537804` isolated stale tracked evidence selection; current-SHA filtering produced green run `33348321475` without an unchanged retry.
- Persistence: implementation/fix trees were fast-forwarded without force through the connected GitHub API; exact run `33348321475` and artifact `9742920099` succeeded.
- Residual risk: 23 manual checklist gates, 6 external approvals, manual audio/device QA, final reel/character sound and motion, rights/Creative approval, penguin cleanup and Spine rig remain open.
- Next candidate: return to `BSB-MOTION-001` for character/rig fallback, reel-stop polish and frame-pacing evidence while manual/external approvals proceed outside automation.

## BS-20260831-13 — SUCCESS

- Sprint day: 2
- Base commit: `696e0977cf6def96b326596b2b94d4b777cbdd2c`
- Verified implementation commit: `49d113415e2331a1ae0f41bff122a8c9b6870503`
- Work item: `BSB-EVIDENCE-001` (isolated exact-package slice; item remains in progress)
- Selection reason: build/math/browser gates were green but CI did not create, independently read back or browser-test the actual isolated frontend/math candidate required by the repository release contract.
- Before/after evidence: CI now binds the copied package to exact commit and frontend tree, verifies nine frontend files plus exactly seven math upload files and all 300,000 compressed book/lookup pairs, and serves Chromium from the copied package directory. A real first readback exposed the obsolete `_app`/`index.html` allowlist; it now also admits the required package-local `assets/` root while rejecting any other top-level entry.
- Changed files: BlackSite workflow, package generator/verifier, package regression test, release QA wording and sprint memory closeout files.
- Gates: focused package regression 1/1 PASS; frozen install PASS; lint PASS; `svelte-check` 0 errors/0 warnings PASS; app tests 92/92 PASS; production build PASS; local and exact remote math 7/7 with 300,000 books PASS; local and remote isolated-package readback 300,000/300,000 PASS; exact packaged Chromium 40/40 scenarios and 965/965 checks PASS; unexpected console/network/request failures 0; `git diff --check` PASS.
- Package evidence: exact remote frontend tree `fc20dd2a…e303` (9 files/662,453 bytes), math tree `6bd0c4c7…01da` (7 files/48,697,667 bytes), unchanged math fingerprint `d03fab…78d8`; package lifecycle remains explicitly non-submission-ready and upload unauthorized.
- Visual review: exact copied-package screenshots at 1920x1080, 1366x768, 390x844, 844x390 and Replay 360x640 inspected. Penguin/vault assets load from package-local paths; boards and controls remain visible, square, reachable and free of new overlap, scroll or crop regression. No runtime UI changed in this slice.
- Tool/token metrics: see `METRICS.md`; tokens are `null` / `not_exposed`; direct subagents 0. One local package failure and one superseded/cancelled CI run led to the focused allowlist correction; no unchanged failure was repeated.
- Persistence: implementation commits were fast-forwarded without force through the connected GitHub API; exact run `33345753819` and artifact `9742066991` succeeded.
- Residual risk: the complete 51-point automated/manual/external matrix, manual audio/device listening, authored reel/character sound, asset rights/Creative approval, penguin cleanup/Spine and character/reel polish remain open.
- Next candidate: continue `BSB-EVIDENCE-001` with the complete gameplay/provider checklist matrix; manual approvals remain explicitly external.

## BS-20260831-12 — SUCCESS

- Sprint day: 2
- Base commit: `403a98376d8dc49dbee647de8b8ab14b8f405e2d`
- Verified implementation commit: `c38b1262f5ef8fcc1a3047f9c07180a985c722d2`
- Work item: `BSB-EVIDENCE-001` (bounded reconnect/evidence slice; item remains in progress)
- Selection reason: the exact browser matrix showed a recoverable authentication failure but stopped before proving that the player could explicitly reconnect to authoritative ready without a fallback or wallet write; historical M2 wording also overclaimed exhaustive money-domain coverage.
- Before/after evidence: a first exact `POST /wallet/authenticate` now returns 503 and exposes enabled `RELOAD / RESTORE`; the click sends exactly one second identical authenticate, returns `live-ready` with `$1000.00`, leaves launch live and sends zero play/endRound/event writes. M2 documentation now limits its historical verdict to enumerated fixtures and records the later real fractional-product correction.
- Changed files: `scripts/blacksite-qa-e2e.mjs`, `docs/blacksite/M2_COMPLIANCE_REVIEW.md`, and sprint memory closeout files.
- Gates: frozen install PASS; lint PASS; `svelte-check` 0 errors/0 warnings PASS; app tests 91/91 PASS; production build PASS; local and exact remote math 7/7 with 300,000 books PASS and unchanged fingerprint; exact Chromium 40/40 scenarios and 964/964 checks PASS; unexpected console/network/request failures 0; `git diff --check` PASS.
- Visual review: exact final recovery screenshot plus current-head 1920x1080, 390x844, 844x390 and uncertain-paid-play restore screenshots inspected. Recovery returns the normal ready HUD with authoritative balance; boards/controls remain visible, square, reachable and free of new overlap, scroll or crop regressions. No runtime UI changed in this slice.
- Tool/token metrics: see `METRICS.md`; tokens are `null` / `not_exposed`; direct subagents 0. Diagnostic run `33342704030` isolated one test-only thousands-separator assumption; final run `33343244848` is green. A formatter-churn attempt was fully removed before commit and no unchanged failure was repeated.
- Persistence: implementation/evidence commits were fast-forwarded without force through the connected GitHub API; exact run `33343244848` and artifact `9741325685` succeeded.
- Residual risk: complete extracted-package/gameplay/Stake matrix, manual audio/device listening, authored reel/character sound, asset rights/Creative approval, penguin cleanup/Spine and character/reel polish remain open.
- Next candidate: continue `BSB-EVIDENCE-001` with the extracted-package and full gameplay/provider matrix; manual audio approval remains explicitly external.

## BS-20260831-11 — SUCCESS

- Sprint day: 2
- Base commit: `7f14d360af055a0c164f2533a69e504879d36f4c`
- Verified implementation commit: `db848506f17a02ff7d4d7b98ae69902500d57f72`
- Work item: `BSB-AUDIO-001` (policy-safe procedural foundation; item remains in progress)
- Selection reason: exact motion existed but the runtime had no audio graph, user-gesture policy, cues, mute persistence, visibility lifecycle or leak evidence, leaving Audio as the sole blocked DoD area.
- Before/after evidence: before, no production audio path existed. After, one master bus creates one low ambience graph and bounded original procedural cues from the exact authoritative presentation stream; mute/three levels persist, hidden tabs suspend, resume does not duplicate ambience, turbo uses cooldown, voices cap at eight and teardown closes the graph. Exact Chromium proves locked/no graph before gesture, one graph after gesture, four bounded round cues, persisted zero mute, and locked/no-autoplay reload.
- Changed files: new audio director and regression suite, presentation cue bridge, slot UI/CSS and sound control, Chromium QA, and sprint memory closeout files.
- Gates: focused audio/mobile 8/8 PASS; lint PASS; `svelte-check` 0 errors/0 warnings PASS; app tests 91/91 PASS; production build PASS; exact remote math 7/7 with 300,000 books PASS and unchanged fingerprint; exact Chromium 40/40 scenarios and 952/952 checks PASS; console/network/request failures 0; `git diff --check` PASS.
- Visual review: exact 1920x1080, 390x844, 844x390, Replay 360x640 and audio-state screenshots inspected. The sound control is visible, focused/hittable and non-overlapping; all boards remain square/on-screen. Final Replay is 220.3125x220.3125. Headless graph/state proof is not a listening-quality or clipping claim.
- Tool/token metrics: see `METRICS.md`; tokens are `null` / `not_exposed`; direct subagents 0. Two diagnostic CI runs converted measured short-Replay geometry deficits into bounded responsive fixes; no failure was repeated unchanged.
- Persistence: implementation and two responsive-fix commits were fast-forwarded without force through the connected GitHub API; exact run `33341067497` and artifact `9740632934` succeeded.
- Residual risk: authored reel-stop/character/feature sound detail, mix/ducking and manual device listening; asset rights/Creative approval; penguin cleanup/Spine; character/reel polish; complete gameplay/reconnect/Stake evidence.
- Next candidate: continue `BSB-AUDIO-001` with authored cue assets/mix and manual listening evidence, unless `BSB-EVIDENCE-001` exposes a higher gameplay/provider blocker.

## BS-20260831-10 — SUCCESS

- Sprint day: 2
- Base commit: `b8138237589a459c1fa301b54f4a6d1305eba9bd`
- Verified implementation commit: `90f7c3d48732766e6c3b48e2815282d456bbb250`
- Work item: `BSB-MOTION-001` (authoritative spin/BLACKOUT vault slice; item remains in progress)
- Selection reason: exact cascade motion existed, but round entry and BLACKOUT feature entry/exit still cut directly between authoritative states without a mechanical-vault presentation.
- Before/after evidence: `round_started`, initial board reveal, `feature_armed`, `feature_started` and `feature_ended` now drive bounded spin/reveal/anticipation/lock-entry/lock-exit phases. The deterministic direct BLACKOUT lifecycle takes 3,541ms in normal mode; exact Chromium records the active scoped CSS animations, ordered lifecycle, final $0.00, one play request and no event/settlement writes.
- Changed files: presentation director, slot UI/CSS, contract tests, Chromium QA, and sprint memory closeout files.
- Gates: focused/full app tests 87/87 PASS; frozen install PASS; lint PASS; `svelte-check` 0 errors/0 warnings PASS; production build PASS; local and exact remote math 7/7 with 300,000 books PASS; exact Chromium 39/39 scenarios and 910/910 checks PASS; console/network/request failures 0; `git diff --check` PASS.
- Visual review: exact final transition screenshot plus 1920x1080, 1366x768, 390x844, 844x390 and Replay 360x640 screenshots inspected. The lock geometry reads as a bounded mechanical shutter over the unchanged square grid; background, controls and values remain legible with no new overlap, scroll or crop regression. Full frame-by-frame sharpness and character animation remain open.
- Tool/token metrics: see `METRICS.md`; tokens are `null` / `not_exposed`; direct subagents 0. Diagnostic CI correctly exposed scoped keyframe names and a stale Replay timeout; the harness was corrected from exact browser evidence.
- Persistence: implementation and QA-fix trees were fast-forwarded without force through the connected GitHub API; exact run `33337862476` and artifact `9739702865` succeeded.
- Residual risk: asset rights/Creative approval, penguin cleanup/Spine rig and character reactions, foreground layers, audio and complete gameplay/reconnect/Stake evidence remain open.
- Next candidate: `BSB-AUDIO-001`, unless a higher-priority gameplay/reconnect contract defect is evidenced first.

## BS-20260830-09 — SUCCESS

- Sprint day: 1
- Base commit: `3a5eae5c881b982e16434a46f6e9bf47f83bf0ba`
- Verified implementation commit: `e659668256d2367f2aa9e4637d67100968b48848`
- Work item: `BSB-MOTION-001` (bounded authoritative cascade slice; item remains in progress)
- Selection reason: the current slot had no production cascade presentation despite deterministic authority; motion/cinematics was the highest safe release blocker after the asset integration.
- Before/after evidence: authority previously stepped cues without hit/remove/drop/settle presentation. The canonical `base_cascade_3` now records three ordered turbo cascade cycles, exact cell masks, normal/turbo/reduced profiles and cancellable cleanup; skip returns ready/idle in 110ms while preserving the exact $2.07 payout and exactly two play calls.
- Changed files: presentation director, slot UI/CSS, contract and mobile regressions, Chromium QA, and sprint memory closeout files.
- Gates: focused motion/mobile 19/19 PASS; lint PASS; `svelte-check` 0 errors/0 warnings PASS; exact remote app tests 86/86 PASS; production build PASS; math 7/7 with 300,000 books PASS; exact Chromium 38/38 scenarios and 902/902 checks PASS; console/network/request failures 0; `git diff --check` PASS.
- Visual review: exact final screenshots at 1920x1080, 1366x768, 390x844, 844x390, Replay 360x640 and populated cascade completion inspected. Motion controls are legible and hittable, including the corrected compact 360x640 layout; boards remain square and no overlap, scroll or crop regression is visible. Ordered phase timing is browser-recorded; frame-by-frame sharpness remains broader follow-up work.
- Tool/token metrics: see `METRICS.md`; tokens are `null` / `not_exposed`; direct subagents 0. The first exact Chromium run found a real 32px Replay motion target; a three-column compact layout plus regression raised every target to >=44px before the final run.
- Persistence: both implementation commits were tree-identical and fast-forwarded without force through the connected GitHub API; exact run `33335278205` and artifact `9738959370` succeeded.
- Residual risk: asset rights/Creative approval, penguin cleanup/Spine rig, BLACKOUT/foreground layers, reel/vault/character cinematics, audio and complete gameplay/reconnect/Stake evidence remain open.
- Next candidate: continue `BSB-MOTION-001` with deterministic reel anticipation and BLACKOUT/vault transition fallback, then `BSB-AUDIO-001`.

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
