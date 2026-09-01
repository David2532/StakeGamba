# Material run log

Newest entries first; retain at most 20.

## BS-20260901-17 — SUCCESS

- Sprint day: 3
- Base commit: `0db8c3331749fc5faf5c6bdca1f66bff84d758c9`
- Verified implementation commit: `4a811db6c654230a861118525a71af50f5f87e04`
- Work item: `BSB-AUDIO-VISIBILITY-MUTE-001` (DONE; parent `BSB-AUDIO-001` remains in progress)
- Selection reason: mute teardown was proven, but `unlock()` and visibility `resume()` still unconditionally called `ensureAmbience()`, recreating a silent oscillator when persisted/current volume was zero.
- Before/after evidence: the expected-red audio test reproduced one ambience graph after muted visibility resume. Unlock and resume now start ambience only above zero volume. Exact Chromium drives hidden → suspended → visible → resumed while retaining `MUTED`, stored `0`, 0 voices and 0 ambience; explicit LOW unmute creates exactly one graph.
- Changed files: AudioDirector guards, audio unit regression, deterministic exact-browser visibility lifecycle and five sprint-memory files; pixels/layout, math, RGS/wallet schema, assets, lockfile and dependencies unchanged.
- Gates: expected-red audio test 5 PASS / 1 FAIL; syntax PASS; focused audio/contract/mobile 37/37 PASS after correction; frozen install PASS; lint PASS; `svelte-check` 0 errors/0 warnings PASS; app tests 127/127 PASS; production build PASS; local and exact math 7/7 with 300,000 books and unchanged fingerprint; identity-bound isolated package/readback and 51-row resolver PASS; exact Chromium 72/72 scenarios and 1872/1872 checks PASS; unexpected network/page/request failures 0; six expected 401/503 negative-path console messages; `git diff --check` and secret/debug/scope review PASS. Local Chromium was not run because no browser executable is installed; exact isolated CI supplies browser proof.
- Visual review: exact muted visibility-resume, 1920x1080, 390x844, 844x390 and Replay 360x640 captures from artifact `9800291335` were inspected; automated geometry also passed 1366x768, 360x740, 768x1024 and the orientation round trip. Board, controls, values and penguin/vault identity remain complete without overlap, document scroll, crop or broken images. Physical-device/listening sign-off remains open.
- Package evidence: exact remote frontend tree `681990be8d236e27009cc154ddb95862fb7348c78f0d68b0e5d7953986557808`, 10 files and one JS bundle; math fingerprint remains `d03fab…78d8`.
- Tool/token metrics: see `METRICS.md`; tokens `null` / `not_exposed`; direct subagents 0. Exact tree identity caught a tool-output-truncated QA blob before CI, and bounded chunk transfer restored the intended tree via normal fast-forward; no unchanged failure was repeated.
- Persistence: implementation was fast-forwarded without force through connected Git data; exact run `33506751334`, artifact `9800291335` and digest `sha256:1b77f02686fe713a7fed8a9b5d7b51010ef3d625770016f894081786bb5eae01` succeeded.
- Residual risk: final approved audio assets and listening/clipping/device QA, approved Spine rig/clips, BLACKOUT/foreground art layers, real-device pacing/memory/battery, deferred mid-feature restore evidence, 23 manual gates, 6 external approvals and rights/Creative cleanup remain open.
- Next candidate: choose the next distinct safe Day-3/4 provider, accessibility or authored-motion gap; revisit mid-feature restore only with event-triggered instrumentation.

## BS-20260901-16 — SUCCESS

- Sprint day: 3
- Base commit: `4f87a3d8644aaa2380ab52be11b02948e92bcbb9`
- Verified implementation commit: `ecbbfc50a6367efa80d6584223cf45038c105515`
- Work item: `BSB-ENTER-REPEAT-001` (DONE)
- Selection reason: request-layer in-flight deduplication covered only concurrent writes, and the global Space guard covered its shortcut, but the focused primary button had no explicit native Enter/Space repeat guard after a round returned to ready.
- Before/after evidence: the regression was first reproduced as 23 PASS / 1 FAIL against the absent button guard. The primary action now preserves the initial native Enter/Space activation and prevents the default only for repeated Enter/Space keydowns. Exact Chromium holds Enter across one complete Base round, refocuses while still held, records initial Enter unprevented and repeat Enter prevented, returns to `live-ready`, and records exactly `authenticate → play` with no second play, checkpoint or settlement write.
- Changed files: focused primary key handler, contract regression, exact-browser wallet scenario and five sprint-memory files; pixels/layout, math, RGS request schema, assets, lockfile and dependencies unchanged.
- Gates: syntax PASS; focused contract regression 24/24 PASS after the expected-red reproduction; frozen install PASS; lint PASS; `svelte-check` 0 errors/0 warnings PASS; app tests 126/126 PASS; production build PASS; local and exact math 7/7 with 300,000 books and unchanged fingerprint; identity-bound isolated package/readback and 51-row resolver PASS; exact Chromium 72/72 scenarios and 1871/1871 checks PASS; unexpected network/page/request failures 0; six expected 401/503 negative-path console messages; `git diff --check` and secret/debug/scope review PASS. Local Chromium was not run because no browser executable is installed; exact isolated CI supplies browser proof.
- Visual review: exact held-Enter, 1920x1080, 390x844, 844x390 and Replay 360x640 captures from artifact `9799216714` were inspected; automated geometry also passed 1366x768, 360x740, 768x1024 and the orientation round trip. Board, controls, values and penguin/vault identity remain complete without overlap, document scroll, crop or broken images. Physical-device sign-off remains open.
- Package evidence: exact remote frontend tree `284d7939a6929342d9167eddf4d7dbaf2736730608257984b3cbd2c400018331`, 10 files and one JS bundle; math fingerprint remains `d03fab…78d8`.
- Tool/token metrics: see `METRICS.md`; tokens `null` / `not_exposed`; direct subagents 0. Targeted reads, one expected-red reproduction, one full local gate and one exact remote gate were used; no unchanged failure was repeated.
- Persistence: implementation was fast-forwarded without force through connected Git data; exact run `33503792855`, artifact `9799216714` and digest `sha256:4a2899ec4ea06af597fa32138acbd70e74583dba64b8bb2bc6f46b9ccf7eb1bb` succeeded.
- Residual risk: final approved audio assets and listening/clipping/device QA, approved Spine rig/clips, BLACKOUT/foreground art layers, real-device pacing/memory/battery, deferred mid-feature restore evidence, 23 manual gates, 6 external approvals and rights/Creative cleanup remain open.
- Next candidate: choose the next distinct safe Day-3/4 provider, accessibility or authored-motion gap; revisit mid-feature restore only with event-triggered instrumentation.

## BS-20260901-15 — SUCCESS

- Sprint day: 3
- Base commit: `0c25386c2c594f7fd4ab1e1ba7a7f7674276309b`
- Verified implementation commit: `da091a8f2180602203489cf47cc1b85b52afb220`
- Work item: `BSB-SPACE-REPEAT-001` (DONE)
- Selection reason: the global live-play Space handler deduplicated simultaneous input only while a request was busy; it did not reject browser key-repeat events, so holding Space could start another paid round after the first returned to ready.
- Before/after evidence: the regression was first reproduced as 22 PASS / 1 FAIL against the missing repeat guard. The handler now consumes the Space default and returns before activation when `event.repeat` is true. Exact Chromium holds Space across one complete Base round, observes keydowns `[false, true]`, returns to `live-ready`, and records exactly `authenticate → play` with no second play, checkpoint or settlement write.
- Changed files: live Space handler, contract regression, exact-browser wallet scenario and five sprint-memory files; pixels/layout, math, RGS request schema, assets, lockfile and dependencies unchanged.
- Gates: syntax PASS; focused contract regression 23/23 PASS after the expected-red reproduction; frozen install PASS; lint PASS; `svelte-check` 0 errors/0 warnings PASS; app tests 125/125 PASS; production build PASS; local and exact math 7/7 with 300,000 books and unchanged fingerprint; identity-bound isolated package/readback and 51-row resolver PASS; exact Chromium 71/71 scenarios and 1860/1860 checks PASS; unexpected network/page/request failures 0; six expected 401/503 negative-path console messages; `git diff --check` and secret/debug/scope review PASS. Local Chromium was not run because no browser executable is installed; exact isolated CI supplies browser proof.
- Visual review: exact held-Space, 1920x1080, 390x844, 844x390 and Replay 360x640 captures from artifact `9797392950` were inspected; automated geometry also passed 1366x768, 360x740, 768x1024 and the orientation round trip. Board, controls, values and penguin/vault identity remain complete without overlap, document scroll, crop or broken images. Physical-device sign-off remains open.
- Package evidence: exact remote frontend tree `491c9771daa553e521dc227809aaddfccbed8b20d5d8874fc59f7f3e072fa7d0`, 10 files and one JS bundle; math fingerprint remains `d03fab…78d8`.
- Tool/token metrics: see `METRICS.md`; tokens `null` / `not_exposed`; direct subagents 0. Official URL fetches returned 404, the unauthenticated CLI push used connected Git data, and exact tree identity caught/corrected one executable-mode omission before CI. No unchanged semantic failure was repeated.
- Persistence: implementation was fast-forwarded without force through connected Git data; exact run `33499016878`, artifact `9797392950` and digest `sha256:62e347affa51ec8a157d361c7f868be51207306b7e8105408b534cf76fe75988` succeeded.
- Residual risk: final approved audio assets and listening/clipping/device QA, approved Spine rig/clips, BLACKOUT/foreground art layers, real-device pacing/memory/battery, deferred mid-feature restore evidence, 23 manual gates, 6 external approvals and rights/Creative cleanup remain open.
- Next candidate: choose the next distinct safe Day-3/4 provider, accessibility or authored-motion gap; revisit mid-feature restore only with event-triggered instrumentation.

## BS-20260901-14 — SUCCESS

- Sprint day: 3
- Base commit: `da2a95f30643b8476a8572c3e0f511a84ac8834e`
- Verified implementation commit: `16f0f438306947e031bc2a670f30d8217eac92b2`
- Work item: `BSB-AUDIO-MUTE-LIFECYCLE-001` (DONE; parent `BSB-AUDIO-001` remains in progress)
- Selection reason: zero master gain silenced output but left the ambience oscillator and active Web Audio voices alive, contradicting the no-leak mute lifecycle required for release.
- Before/after evidence: mute now stops/disconnects all owned voices, ambience oscillator and ambience gain, clears cooldowns and reports 0 voices/0 ambience. Exact Chromium proves LOW unmute recreates exactly one ambience, a second FULL → MUTE cycle returns to 0/0 without stacking, and muted reload remains locked at 0 ambience.
- Changed files: AudioDirector lifecycle, audio unit regression, exact-browser audio scenario and five sprint-memory files; layout/pixels, math, RGS/wallet authority, assets, lockfile and dependencies unchanged.
- Gates: syntax PASS; focused audio/contract/mobile 39/39 PASS; frozen install PASS; lint PASS; `svelte-check` 0 errors/0 warnings PASS; app tests 124/124 PASS; production build PASS; local and exact math 7/7 with 300,000 books and unchanged fingerprint; identity-bound isolated package/readback and 51-row resolver PASS; exact Chromium 71/71 scenarios and 1858/1858 checks PASS; unexpected network/page/request failures 0; six expected 401/503 negative-path console messages; `git diff --check` and secret/debug/scope review PASS. Local Chromium was not run; exact isolated CI supplies browser proof.
- Visual review: exact muted-audio, 1920x1080, 390x844, 844x390 and Replay 360x640 captures from artifact `9795406701` were inspected; automated geometry also passed 1366x768, 360x740, 768x1024 and the orientation round trip. Board, controls, values and penguin/vault identity remain complete without overlap, document scroll, crop or broken images. Physical-device/listening sign-off remains open.
- Package evidence: exact remote frontend tree `17d4348396c592ddaef1dc15fc0e928cf06745cf02a41ae0c83515f0aaa154e3`, 10 files and one JS bundle; math fingerprint remains `d03fab…78d8`.
- Tool/token metrics: see `METRICS.md`; tokens `null` / `not_exposed`; direct subagents 0. One invalid fake-oscillator metric was replaced with lifecycle ownership/node assertions, and local ref sync used a safe fetch-first correction. No unchanged semantic failure was repeated.
- Persistence: implementation was fast-forwarded without force through connected Git data; exact run `33493907726`, artifact `9795406701` and digest `sha256:27ecbf55db79e64946da1053968c30568a21cbfe5228c99b9d58681517bdf280` succeeded.
- Residual risk: final approved audio assets and listening/clipping/device QA, approved Spine rig/clips, BLACKOUT/foreground art layers, real-device pacing/memory/battery, deferred mid-feature restore evidence, 23 manual gates, 6 external approvals and rights/Creative cleanup remain open.
- Next candidate: choose the next distinct safe Day-3/4 provider, accessibility or authored-motion gap; revisit mid-feature restore only with event-triggered instrumentation.

## BS-20260901-13 — SUCCESS

- Sprint day: 3
- Base commit: `c36117d0185187e0b88ceacb93295c211946929b`
- Verified implementation commit: `9749cfebbcc6ebbea941ced19f0d1b1124d87a55`
- Work item: `BSB-TIMER-CADENCE-001` (DONE)
- Selection reason: the optional Session Time display changed only once per second but used a permanent 250ms interval, producing four configured UI wakeups per second while idle.
- Before/after evidence: the interval is now 1,000ms and elapsed time remains drift-resistant through `Date.now()`. Nominal callbacks fall from 240 to 60 per minute (75%); exact Chromium records one timer callback over 1,100ms while visible time advances `00:00 → 00:01`, Session Position changes `$0.00 → +$7.00`, balance settles at `$993.00`, and network order remains one authenticate plus one play with no settlement/event write. Battery or real-device savings are not claimed.
- Changed files: route timer cadence, Chromium timer instrumentation, accessibility regression and five sprint-memory files; pixels/layout, math, RGS/wallet contract, assets, lockfile and dependencies unchanged.
- Gates: syntax PASS; focused accessibility/mobile 12/12 PASS; frozen install PASS; lint PASS; `svelte-check` 0 errors/0 warnings PASS; app tests 124/124 PASS; production build PASS; local and exact math 7/7 with 300,000 books and unchanged fingerprint; identity-bound isolated package/readback and 51-row resolver PASS; exact Chromium 71/71 scenarios and 1856/1856 checks PASS; unexpected network/page/request failures 0; six expected 401/503 negative-path console messages; `git diff --check` and secret/debug/scope review PASS. Local Chromium was not run; exact isolated CI supplies browser proof.
- Visual review: exact timer state, 1920x1080, 390x844, 844x390 and Replay 360x640 captures from artifact `9793569525` were inspected; automated geometry also passed 1366x768, 360x740, 768x1024 and the orientation round trip. Board, timer, controls and penguin/vault identity remain complete without overlap, document scroll, crop or broken images. Physical-device sign-off remains open.
- Package evidence: exact remote frontend tree `dddf8429c9d796074481c616f0fdf948b926faa65c0ef845781ef4ce4323f9b5`, 10 files and one JS bundle; math fingerprint remains `d03fab…78d8`.
- Tool/token metrics: see `METRICS.md`; tokens `null` / `not_exposed`; direct subagents 0. One regex correction and one harness-placement correction preceded the verified patch; exact tree identity caught and a normal fast-forward restored the QA script executable mode. No unchanged semantic failure was repeated.
- Persistence: implementation was fast-forwarded without force through connected Git data; exact run `33489360248`, artifact `9793569525` and digest `sha256:3d39b93011160658e39d60f2fa197778f9e50a7a298bbbfcf4d4cf6d7f09d28c` succeeded.
- Residual risk: approved Spine rig/clips, BLACKOUT/foreground art layers, real-device pacing/memory/battery, deferred mid-feature restore evidence, 23 manual gates, 6 external approvals, rights/Creative cleanup and final audio/listening/device QA remain open.
- Next candidate: choose the next distinct safe Day-3/4 provider, accessibility or authored-motion gap; revisit mid-feature restore only with event-triggered instrumentation.

## BS-20260901-12 — SUCCESS

- Sprint day: 3
- Base commit: `80884debe87dbc53eb844a9863b4efada7683a26`
- Verified implementation commit: `1ddeb5d3932d64443c5838c4766f541872b5a6ff`
- Work item: `BSB-CHARACTER-LAYER-001` (DONE; parent `BSB-MOTION-001` remains in progress)
- Selection reason: the Vaultkeeper image permanently reserved `transform, filter` compositing in Idle, Monitoring, Bonus Idle and Reduced Motion even though no authored reaction was active.
- Before/after evidence: the persistent idle hint changes from `transform, filter` to `auto`; active `spin_start`, `win_acknowledge` and `recover` retain `transform, filter`, while monitoring, idle and skip completion return to `auto`. This closes a bounded compositor-lifecycle defect without claiming measured device memory savings.
- Changed files: route motion CSS, Chromium character-state audit, contract regression and five sprint-memory files; pixels/layout, math, RGS/wallet behavior, assets, lockfile and dependencies unchanged.
- Gates: syntax PASS; focused contracts/mobile 29/29 PASS; frozen install PASS; lint PASS; `svelte-check` 0 errors/0 warnings PASS; app tests 124/124 PASS; production build PASS; local and exact math 7/7 with 300,000 books and unchanged fingerprint; identity-bound isolated package/readback and 51-row resolver PASS; exact Chromium 71/71 scenarios and 1855/1855 checks PASS; unexpected network/page/request failures 0; six expected 401/503 negative-path console messages; `git diff --check` and secret/debug/scope review PASS. Local Chromium was not run; exact isolated CI supplies browser proof.
- Visual review: exact active cascade, 1920x1080, 390x844, 844x390 and Replay 360x640 captures from artifact `9792318087` were inspected; automated geometry also passed 1366x768, 360x740, 768x1024 and the orientation round trip. Board, controls and penguin/vault identity remain complete without overlap, document scroll, crop or broken images. Physical-device sign-off remains open.
- Package evidence: exact remote frontend tree `5760052f8dbbf842bf1eaadea42faffa720ddcc20077893fe33082d219d9c2ff`, 10 files and one JS bundle; math fingerprint remains `d03fab…78d8`.
- Tool/token metrics: see `METRICS.md`; tokens `null` / `not_exposed`; direct subagents 0. Local browser absence was not retried, and no unchanged semantic failure occurred.
- Persistence: implementation was fast-forwarded without force through connected Git data; exact run `33486188541`, artifact `9792318087` and digest `sha256:64bc591ef7bc85ca53db477c6c614fa65e363bb2353fd2253ffd30be2251323b` succeeded.
- Residual risk: approved Spine rig/clips, BLACKOUT/foreground art layers, real-device pacing/memory, deferred mid-feature restore evidence, 23 manual gates, 6 external approvals, rights/Creative cleanup and final audio/listening/device QA remain open.
- Next candidate: add the next safe authored-motion or foreground-layer evidence slice when approved inputs exist; otherwise continue a distinct automatable Day-3/4 provider or accessibility gap.

## BS-20260901-11 — SUCCESS

- Sprint day: 3
- Base commit: `ebd5f07b78ef3bc71fc33aacf00af4e75f987557`
- Verified implementation commit: `cae8c0b9b506236be248dc03eee01c2c0317dbd7`
- Work item: `BSB-BLACKOUT-PERF-001` (DONE; parent `BSB-MOTION-001` remains in progress)
- Selection reason: exact current-package evidence measured the full-stage BLACKOUT scenario at 50.0ms p95 with four frames over 50ms, while source inspection found a large responsive vault image animating repaint-heavy CSS brightness/saturation filters.
- Before/after evidence: the environment plate now animates phase-scoped compositor opacity and exposes `will-change: opacity`; the same exact Chromium scenario improves from 218 samples / 50.0ms p95 / four >50ms frames to 255 samples / 33.4ms p95 / one >50ms frame. Maximum remains 66.7ms, so real-device pacing is not claimed complete.
- Changed files: route motion CSS, Chromium transition audit, contract regression and five sprint-memory files; math, RGS/wallet behavior, assets, lockfile and dependencies unchanged.
- Gates: syntax PASS; focused contracts/mobile 28/28 PASS; frozen install PASS; lint PASS; `svelte-check` 0 errors/0 warnings PASS; app tests 123/123 PASS; production build PASS; local and exact math 7/7 with 300,000 books and unchanged fingerprint; identity-bound isolated package/readback and 51-row resolver PASS; exact Chromium 71/71 scenarios and 1854/1854 checks PASS; unexpected network/page/request failures 0; six expected 401/503 negative-path console messages; `git diff --check` and secret/debug/scope review PASS. Local Chromium was not run; exact isolated CI supplies browser proof.
- Visual review: exact active BLACKOUT, 1920x1080, 390x844, 844x390 and Replay 360x640 captures from artifact `9791347108` were inspected; automated geometry also passed 1366x768, 360x740, 768x1024 and the orientation round trip. Dimming/lock geometry, board, controls and penguin/vault identity remain complete without overlap, document scroll, crop or broken images. Physical-device sign-off remains open.
- Package evidence: exact remote frontend tree `9d699302e55edd591472b13e7dd992152db25dda74fd25a6c9e70d1914361cd9`, 10 files and one JS bundle; math fingerprint remains `d03fab…78d8`.
- Tool/token metrics: see `METRICS.md`; tokens `null` / `not_exposed`; direct subagents 0. One connector-truncated large blob was caught by exact tree identity and replaced before any ref update; no unchanged semantic failure was repeated.
- Persistence: implementation was fast-forwarded without force through connected Git data; exact run `33483678009`, artifact `9791347108` and digest `sha256:c3f58c5dad7334a4efaf95bb79dca197a359cee590567702c8039bf65148b4ef` succeeded.
- Residual risk: approved Spine rig/clips, BLACKOUT/foreground art layers, real-device pacing, deferred mid-feature restore evidence, 23 manual gates, 6 external approvals, rights/Creative cleanup and final audio/listening/device QA remain open.
- Next candidate: add the next safe authored-motion or foreground-layer evidence slice when approved inputs exist; otherwise continue a distinct automatable Day-3/4 provider or accessibility gap.

## BS-20260901-10 — SUCCESS

- Sprint day: 3
- Base commit: `e9ce382e437951becc6ac690432f2660eef4c8e7`
- Verified implementation commit: `099c9feda5e159bafeae1ba3bae280020c926d43`
- Work item: `BSB-TOUCH-001` (DONE)
- Selection reason: checklist row 28 cited only viewport-meta and computed `touch-action` proxies although its repository proof contract requires actual browser interaction without disabling legitimate accessible scrolling.
- Before/after evidence: exact 390x844 Chromium double-taps the board with visual viewport scale `1 → 1` and zero page displacement, opens Game Information by touch, then a real touch drag moves its internal scrollTop `0 → 1022` across a 1767px surface while document scroll and zoom remain fixed. One authenticate and zero play/settlement/event writes occur.
- Changed files: Chromium QA, mobile regression, checklist evidence and five sprint-memory files; runtime UI/CSS, math, RGS/wallet behavior, assets, lockfile and dependencies unchanged.
- Gates: syntax PASS; focused mobile/compliance 17/17 PASS; frozen install PASS; lint PASS; `svelte-check` 0 errors/0 warnings PASS; app tests 122/122 PASS; production build PASS; local and exact math 7/7 with 300,000 books and unchanged fingerprint; identity-bound isolated package/readback and 51-row resolver PASS; exact Chromium 71/71 scenarios and 1854/1854 checks PASS; unexpected network/page/request failures 0; six expected 401/503 negative-path console messages; `git diff --check` and secret/debug/scope review PASS. Local Chromium was not run; exact isolated CI supplies browser proof.
- Visual review: exact 1920x1080, 390x844, 844x390, Replay 360x640 and touch-scrolled Game Information 390x844 captures from artifact `9789541385` were inspected; 1366x768, 360x740, 768x1024 and orientation geometry also passed. Board, rules content, controls and penguin/vault identity remain complete without overlap, document scroll, crop or broken images. Real iOS/Android and physical-device sign-off remain open.
- Package evidence: exact remote frontend tree `c051cc1a65100b1c9a42ee0c12e359650691934c6265e450d5c635b333c0f2e0`, 10 files and one JS bundle; math fingerprint remains `d03fab…78d8`.
- Tool/token metrics: see `METRICS.md`; tokens `null` / `not_exposed`; direct subagents 0. The unauthenticated HTTPS push used the connected Git-data path; one timed browser wait completed through the same live tab. No unchanged semantic failure was repeated.
- Persistence: implementation was fast-forwarded without force through connected Git data; exact run `33478922886`, artifact `9789541385` and digest `sha256:bf8aecff16ecea50d34a8d9f3fdce16c9bfc6ce4570a5fcf1be6d00a3f03e8e1` succeeded.
- Residual risk: real iOS/Android/device approval, deferred mid-feature restore evidence, 23 total manual gates, 6 external approvals, rights/Creative cleanup, approved Spine rig/clips, BLACKOUT/foreground layers, final audio/listening/device QA and real-device pacing remain open.
- Next candidate: choose the next distinct safe Day-3 HUD/accessibility or provider-evidence gap; revisit mid-feature restore only with event-triggered instrumentation.

## BS-20260901-09 — SUCCESS

- Sprint day: 3
- Base commit: `8497671b1a32d1c76a69356ea9488dfe063d3b44`
- Verified implementation commit: `de327825da4c36c7c351e59497683058c550dc3b`
- Work item: `BSB-TIMER-A11Y-001` (DONE)
- Selection reason: the provider-controlled Session Timer updated every second inside one polite live region, which could force continuous assistive-technology announcements even when the player made no action.
- Before/after evidence: Session Position now owns an atomic polite status; Session Time owns a labelled `timer` with `aria-live=off`. Exact mobile Chromium observes `00:00 → 00:01`, then one authoritative Base play updates position `$0.00 → +$7.00` and balance `$1000.00 → $993.00` without settlement/event writes.
- Changed files: jurisdiction readout semantics, accessibility regression, exact-browser timer audit and five sprint-memory files; pixels/layout, math, RGS/wallet authority, assets, lockfile and dependencies unchanged.
- Gates: syntax PASS; focused accessibility/mobile 11/11 PASS; frozen install PASS; lint PASS; `svelte-check` 0 errors/0 warnings PASS; app tests 121/121 PASS; production build PASS; local and exact math 7/7 with 300,000 books and unchanged fingerprint; identity-bound isolated package/readback and 51-row resolver PASS; exact Chromium 70/70 scenarios and 1845/1845 checks PASS; unexpected network/page/request failures 0; six expected 401/503 negative-path console messages; `git diff --check` and secret/debug/scope review PASS. Local Chromium was not run; exact isolated CI supplies browser proof.
- Visual review: exact 1920x1080, 390x844, 844x390, Replay 360x640 and jurisdiction-timer 390x844 captures from artifact `9788005592` were inspected; 1366x768, 360x740, 768x1024 and orientation geometry also passed. Board, timer, values, controls and penguin/vault identity remain complete without overlap, scroll, crop or broken images. Real screen-reader and physical-device sign-off remain open.
- Package evidence: exact remote frontend tree `7e05b9f89ed9f587bbc726a892c18df77305a3349f178c933774593e2a2a0a8c`, 10 files and one JS bundle; math fingerprint remains `d03fab…78d8`.
- Tool/token metrics: see `METRICS.md`; tokens `null` / `not_exposed`; direct subagents 0. Unavailable `gh`, unauthenticated CLI push and rejected destructive temp cleanup each used a changed safe alternative; no semantic failure was repeated unchanged.
- Persistence: implementation was fast-forwarded without force through connected Git data; exact run `33474573594`, artifact `9788005592` and digest `sha256:7622da346f1d4a0dabc1117f711793ccb649315e68854d1032f04284ece2a6ce` succeeded.
- Residual risk: real screen-reader/device approval, deferred mid-feature restore evidence, 23 total manual gates, 6 external approvals, rights/Creative cleanup, approved Spine rig/clips, BLACKOUT/foreground layers, final audio/listening/device QA and real-device pacing remain open.
- Next candidate: choose the next distinct safe Day-3 HUD/accessibility or provider-evidence gap; revisit mid-feature restore only with event-triggered instrumentation.

## BS-20260901-08 — SUCCESS

- Sprint day: 3
- Base commit: `dfdc5f26d5713fc3a46e2ff765fee75c7fb40eca`
- Verified implementation commit: `5624b8cbc0f942ce12ea8fee4386407ba8205c46`
- Work item: `BSB-GRID-A11Y-001` (DONE)
- Selection reason: the visible board declared 49 `gridcell` nodes but the grid itself had no accessible name, explicit row ownership or programmatic row/column positions, leaving screen-reader topology under-specified despite strong visual geometry evidence.
- Before/after evidence: the board now exposes one named 7x7 grid, seven owned and indexed rows, and 49 cells whose one-based indices agree with their visible coordinate labels. Exact browser geometry verifies this topology on eight surfaces while preserving a square 49-cell board.
- Changed files: page board markup/CSS, accessibility regression, Chromium geometry audit and five sprint-memory files; math, RGS/wallet behavior, assets, lockfile and dependencies unchanged.
- Gates: syntax PASS; focused accessibility/mobile 10/10 PASS; frozen install PASS; lint PASS; `svelte-check` 0 errors/0 warnings PASS; app tests 120/120 PASS; production build PASS; local and exact math 7/7 with 300,000 books and unchanged fingerprint; identity-bound isolated package/readback and 51-row resolver PASS; exact Chromium 70/70 scenarios and 1843/1843 checks PASS; unexpected network/page/request failures 0; six expected 401/503 negative-path console messages; `git diff --check` and secret/debug/scope review PASS. Local Chromium was not run; exact isolated CI supplies browser proof.
- Visual review: exact 1920x1080, 390x844, 844x390 and Replay 360x640 captures from artifact `9786812481` were inspected; 1366x768, 360x740, 768x1024 and orientation geometry also passed. Boards, values, controls and penguin/vault identity remain complete without overlap, scroll, crop or broken images. Real screen-reader and physical-device sign-off remain open.
- Package evidence: exact remote frontend tree `991fe37fe7d6e62c8f18c8d7126b5af546f36cc10b5e6dc7c37f7937b03220bc`, 10 files and one JS bundle; math fingerprint remains `d03fab…78d8`.
- Tool/token metrics: see `METRICS.md`; tokens `null` / `not_exposed`; direct subagents 0. One broad formatting check, one unauthenticated CLI push, one patch context mismatch and one rejected destructive temporary cleanup each used a changed safe path; no semantic failure was repeated unchanged.
- Persistence: implementation was fast-forwarded without force through connected Git data; exact run `33471069057`, artifact `9786812481` and digest `sha256:c711f87cec181dbbb70a45b4caf872fccb1ea81c7cf9ff4f3b0d63ce5e34563b` succeeded.
- Residual risk: real screen-reader/device approval, deferred mid-feature restore evidence, 23 total manual gates, 6 external approvals, rights/Creative cleanup, approved Spine rig/clips, BLACKOUT/foreground layers, final audio/listening/device QA and real-device pacing remain open.
- Next candidate: choose the next distinct safe Day-3 HUD/accessibility or provider-evidence gap; revisit mid-feature restore only with event-triggered instrumentation.

## BS-20260901-07 — SUCCESS

- Sprint day: 3
- Base commit: `d8d118028f7ed11098bc225cedb55e59401dd6c5`
- Verified implementation commit: `1f1c1dc0a6b6dd0f6975945774546fc5510d9622`
- Work item: `BSB-MOTION-PREF-001` (DONE)
- Selection reason: Normal/Turbo was a user-facing Game Information contract, but the selected speed reset on every reload and exact evidence did not prove how it interacts with the system reduced-motion override.
- Before/after evidence: one versioned storage contract now persists only Normal/Turbo, defaults safely on invalid or blocked storage, and never stores REDUCED. Exact mobile Chromium selects Turbo, restores it, applies and reloads REDUCED without erasing Turbo, then resumes Turbo after removing the override. Four authentications occur with zero play, settlement or event writes.
- Changed files: motion-preference runtime helper, page integration, unit/mobile regressions, Chromium QA, checklist evidence and five sprint-memory files; math, RGS/wallet behavior, assets, lockfile and dependencies unchanged.
- Gates: syntax PASS; focused motion/mobile/compliance 19/19 PASS; frozen install PASS; lint PASS; `svelte-check` 0 errors/0 warnings PASS; app tests 119/119 PASS; production build PASS; local and exact math 7/7 with 300,000 books and unchanged fingerprint; identity-bound isolated package/readback and 51-row resolver PASS; exact Chromium 70/70 scenarios and 1832/1832 checks PASS; unexpected network/page/request failures 0; `git diff --check` and secret/debug/scope review PASS. Local Chromium was not run; the exact isolated CI package supplies browser proof.
- Visual review: exact 1920x1080, 390x844, 844x390, Replay 360x640, REDUCED override and restored-Turbo captures from artifact `9785970450` were inspected. Boards, values, controls and penguin/vault identity remain complete without overlap, scroll, crop or broken images; both motion labels remain centered in >=44px controls. Real screen-reader and physical-device sign-off remain open.
- Package evidence: exact remote frontend tree `bd76ca0c9fa880b9367828ce2f46a9f3dd4f5368ead904163d1e168b250e137b`, 10 files and one JS bundle; math fingerprint remains `d03fab…78d8`.
- Tool/token metrics: see `METRICS.md`; tokens `null` / `not_exposed`; direct subagents 0. Initial exact CI `33467496604` failed only because a harness helper classified authenticate as a wallet write after all five new state assertions passed; endpoint-specific checks and a regression produced green run `33468510345`. No failed call was repeated unchanged.
- Persistence: implementation was fast-forwarded without force through connected Git data; exact run `33468510345`, artifact `9785970450` and digest `sha256:359817d2905aa9aef791e911a50363ff31bf635356ad338ea6bea503ec59777d` succeeded.
- Residual risk: checklist row 29 human reconciliation, deferred mid-feature restore evidence, 23 total manual gates, 6 external approvals, rights/Creative cleanup, approved Spine rig/clips, BLACKOUT/foreground layers, final audio/listening/device QA and real-device pacing remain open.
- Next candidate: choose a distinct Day-3 HUD/accessibility or provider evidence gap; revisit mid-feature restore only with event-triggered instrumentation.

## BS-20260901-06 — SUCCESS

- Sprint day: 3
- Base commit: `09d9f1929f70a7628031dc9fffc787b0aea97049`
- Verified implementation commit: `d7ced76e4aa363d4933349f825c71e1c65479874`
- Work item: `BSB-SOCIAL-REPLAY-001` (DONE)
- Selection reason: checklist row 38 referenced one generic Social Replay scan while its explicit human gate named loss, win, feature and max-win surfaces; the exact package did not automate those four representative outcomes independently.
- Before/after evidence: four math-backed XSC Replay scenarios now scan ready and completed DOM/ARIA surfaces. Loss displays `0 SC units`, Base win `0.018848 SC units`, complete Deep Access feature `0.052576 SC units` and exact 10,000x max win `496 SC units`; all retain exact cost, 49 cells, one queryless/bodyless Replay GET, zero wallet/event writes, zero official restricted hits and zero `$` display.
- Changed files: Chromium QA, checklist evidence, compliance regression and five sprint-memory files; runtime UI, math, wallet, assets, lockfile and dependencies unchanged.
- Gates: syntax PASS; focused compliance 10/10 PASS; frozen install PASS; lint PASS; `svelte-check` 0 errors/0 warnings PASS; app tests 115/115 PASS; production build PASS; local and exact math 7/7 with 300,000 books and unchanged fingerprint; identity-bound isolated package/readback and 51-row resolver PASS; exact Chromium 69/69 scenarios and 1821/1821 checks PASS; the four new outcomes contribute 82/82 checks; unexpected network/page/request failures 0; `git diff --check` and secret/debug/scope review PASS. Local Chromium was not run; the exact isolated CI package supplies the required browser proof.
- Visual review: exact 1920x1080, 390x844, 844x390, Replay 360x640 and all four 390x844 Social Replay completions from artifact `9784332622` were inspected. Boards, values, controls and penguin/vault identity remain complete without overlap, scroll, crop, broken image or overflow; human all-surface and physical-device sign-off remain unclaimed.
- Package evidence: exact remote frontend tree `ac80d9dc69847ef9d54d84e46de2ea175c981e49898813c2455a1a993fb4c0a3`, 10 files and one JS bundle; math fingerprint remains `d03fab…78d8`.
- Tool/token metrics: see `METRICS.md`; tokens `null` / `not_exposed`; direct subagents 0. One malformed orchestration string, one formatter-churn attempt and one unauthenticated CLI push each used a changed corrective path; no failed call was repeated unchanged.
- Persistence: implementation was fast-forwarded without force through connected Git data; exact run `33463575542`, artifact `9784332622` and digest `sha256:ba2d0603d372ff1fc749755f41ca78445b2e0ffd2b124ad3a050704ab6a3a901` succeeded.
- Residual risk: row 38 human final-surface sign-off, deferred mid-feature restore evidence, 23 total manual gates, 6 external approvals, rights/Creative cleanup, approved Spine rig/clips, BLACKOUT/foreground layers, final audio/listening/device QA and real-device pacing remain open.
- Next candidate: choose the next distinct safe day-3 HUD/accessibility or provider-evidence gap; retry mid-feature restore only with event-triggered instrumentation.

## BS-20260901-05 — SUCCESS

- Sprint day: 3
- Base commit: `2f75cdb9ed7c836d8db2a3d132dd2c380be2ca51`
- Verified implementation commit: `1fe84e55864c316d594b5c871f3d5982a7ec78a8`
- Work item: `BSB-ORIENTATION-001` (DONE)
- Selection reason: portrait and landscape were independently proven, but no current-package evidence exercised a real orientation transition in one authenticated live session as required by mobile release QA.
- Before/after evidence: one context performs 390x844 → 844x390 → 390x844, swaps portrait/desktop/portrait vault plates, retains one square 49-cell board, centered labels/meters, focus and >=44px controls, sends one authenticate and zero play/checkpoint/settlement writes, then restores board/action geometry within 0.5 CSS px.
- Changed files: Chromium QA, mobile-HUD regression, checklist evidence and five sprint-memory files; runtime UI/CSS, math, wallet, assets, lockfile and dependencies unchanged.
- Gates: syntax PASS; focused mobile 5/5 PASS; frozen install PASS; lint PASS; `svelte-check` 0 errors/0 warnings PASS; app tests 114/114 PASS; production build PASS; local and exact math 7/7 with 300,000 books and unchanged fingerprint; identity-bound isolated package/readback and 51-row resolver PASS; exact Chromium 65/65 scenarios and 1739/1739 checks PASS; unexpected network/page/request failures 0; `git diff --check` and secret/debug/scope review PASS. Local Chromium was BLOCKED by the absent Playwright executable and is superseded by the exact isolated CI package run.
- Visual review: exact 1920x1080, Replay 360x640 and the portrait-before/landscape/portrait-after captures were inspected. Board, values, controls and penguin/vault identity remain complete without overlap, scroll, crop or broken-image regression; physical-device approval remains unclaimed.
- Package evidence: exact remote frontend tree `83d4f7877faf6186721c4573d4c3cc862bd193d2c0220ea2e0c8313233a2561b`; math fingerprint remains `d03fab…78d8`.
- Tool/token metrics: see `METRICS.md`; tokens `null` / `not_exposed`; direct subagents 0. The first exact run `33460055037` exposed a test-only authenticate/write predicate error; explicit endpoint assertions corrected it and exact run `33461309637` passed. No unchanged semantic failure was repeated.
- Persistence: implementation was fast-forwarded without force through connected Git data; exact run `33461309637`, artifact `9783536314` and digest `sha256:8874194d92a8c910d11c3c84215cadd4ae2afd512835642013da512b4b7fcbd8` succeeded.
- Residual risk: deferred mid-feature restore evidence, 23 manual gates, 6 external approvals, rights/Creative cleanup, approved Spine rig/clips, BLACKOUT/foreground layers, final audio/listening/device QA and real-device pacing remain open.
- Next candidate: choose the next distinct safe day-3 HUD/accessibility or provider-evidence gap; retry mid-feature restore only with event-triggered instrumentation.

## BS-20260901-04 — SUCCESS

- Sprint day: 3
- Base commit: `2320f067a70969fa26b7d6a9a87ef0098ff86118`
- Verified implementation commit: `521c4c4bb96c5f8343412b1f85dab62d6b900a7e`
- Work item: `BSB-GUIDE-001` (DONE)
- Selection reason: checklist row 29 claimed an automated Game Information interaction guide, but the versioned contract omitted Sound, Normal/Turbo/Reduced, Skip, close and explicit pointer/touch/keyboard paths, so the browser could not prove every visible control was documented.
- Before/after evidence: one immutable ten-entry guide now drives Game Information. Exact Chromium maps all visible controls to guide entries, finds all required keys and proves pointer/touch, keyboard, Space and Escape wording; missing controls and missing required keys are both zero. Manual final reconciliation remains open.
- Changed files: rules contract, Game Information rendering, Chromium QA, contract/accessibility regressions, checklist evidence and five sprint-memory files; math, wallet, assets, lockfile and dependencies unchanged.
- Gates: syntax PASS; focused contracts/accessibility 23/23 PASS; frozen install PASS; lint PASS; `svelte-check` 0 errors/0 warnings PASS; app tests 113/113 PASS; production build PASS; local and exact math 7/7 with 300,000 books and unchanged fingerprint; identity-bound isolated package/readback and 51-row resolver PASS; exact Chromium 64/64 scenarios and 1579/1579 checks PASS; unexpected network/page/request failures 0; `git diff --check` and secret/debug/scope review PASS. Local Chromium was BLOCKED by the absent Playwright executable and is superseded by the exact isolated CI package run.
- Visual review: exact 1920x1080, 390x844, 844x390, Replay 360x640 and rules-modal 360x740 captures from artifact `9781885504` were inspected. Boards, values, controls and penguin/vault pixels remain complete without overlap, scroll, crop or broken-image regression; the modal top/tables/close are contained, and the full guide is exact-DOM/scroll-geometry proven. Real screen-reader/device approval remains unclaimed.
- Package evidence: exact remote frontend tree `113c7e7d25805d70f9951e5819947713c224d92964d1ea6354b0fdf3b33addff`, 10 files and one JS bundle; math fingerprint remains `d03fab…78d8`.
- Tool/token metrics: see `METRICS.md`; tokens `null` / `not_exposed`; direct subagents 0. Unrelated formatter churn was fully removed; one unauthenticated CLI push used the connected Git-data path instead. No unchanged failure was repeated.
- Persistence: implementation was fast-forwarded without force through connected Git data; exact run `33456368436`, artifact `9781885504` and digest `sha256:07afc832223a1a8f5ca2abfbb92273fcfc27b7c3d8f9472108054bc736dd8002` succeeded.
- Residual risk: deferred mid-feature restore evidence, 23 manual gates, 6 external approvals, rights/Creative cleanup, approved Spine rig/clips, BLACKOUT/foreground layers, final audio/listening/device QA and real-device pacing remain open.
- Next candidate: choose the next distinct safe day-3 HUD/accessibility or provider-evidence gap; retry mid-feature restore only with event-triggered instrumentation.

## BS-20260901-03 — SUCCESS

- Sprint day: 3
- Base commit: `ccf6fbe50abdd704ab6516e78d9a5cd093342908`
- Verified implementation commit: `4bbd22d8cc2ab466a9181ea91f80f036aea660a8`
- Work item: `BSB-PACKAGE-CLEAN-001` (DONE)
- Selection reason: an existing generated frontend was not cryptographically bound to the current checkout, so a clean caller could package stale output under a newer commit even though clean CI itself produced the right tree.
- Before/after evidence: an injected ignored stale bundle is removed by the build wrapper; two repeated builds each contain 10 files and exactly one JS bundle. The emitted identity binds schema, exact commit, exact tree and pre-build cleanliness, and the packager rejects a pre-commit/stale identity before tree hashing or copy.
- Changed files: BlackSite package scripts, new production-build wrapper, package regression and five sprint-memory files; runtime UI/CSS, math, wallet, assets, lockfile and dependencies unchanged.
- Gates: focused release-package regression 1/1 PASS; stale-injection and two-build shape checks PASS; frozen install PASS; lint PASS; `svelte-check` 0 errors/0 warnings PASS; app tests 112/112 PASS; production build PASS; local and exact math 7/7 with 300,000 books and unchanged fingerprint; identity-bound isolated package/readback and 51-row resolver PASS; exact Chromium 64/64 scenarios and 1576/1576 checks PASS; unexpected network/page/request failures 0; `git diff --check` and secret/debug review PASS. Local Chromium was BLOCKED by the absent Playwright executable and is superseded by the exact isolated CI package run.
- Visual review: exact 1920x1080, 390x844, 844x390 and Replay 360x640 captures from artifact `9780778232` were inspected. Boards, values, controls and penguin/vault pixels remain complete without overlap, scroll, crop or broken-image regression. Runtime UI/CSS/assets did not change; real device approval remains unclaimed.
- Package evidence: exact remote frontend tree `337c09fb3199dba23ac3ec0d6248b1459a556f168bf529cc14aea8a274c330bb`, 10 files and one JS bundle; build identity matches implementation `4bbd22d` and tree `71a2d36`; math fingerprint remains `d03fab…78d8`.
- Tool/token metrics: see `METRICS.md`; tokens `null` / `not_exposed`; direct subagents 0. One invalid byte-equality premise was replaced with exact identity plus deterministic shape after Vite's internal version hash changed; no unchanged failure was repeated.
- Persistence: implementation was fast-forwarded without force through connected Git data; exact run `33453194613`, artifact `9780778232` and digest `sha256:8ef5e675ade91acbdfb89448855952e7b4b3a397942a8597f85ba18e9b63d6bb` succeeded.
- Residual risk: deferred mid-feature restore evidence, 23 manual gates, 6 external approvals, rights/Creative cleanup, approved Spine rig/clips, BLACKOUT/foreground layers, final audio/listening/device QA and real-device pacing remain open.
- Next candidate: choose a distinct safe day-3 HUD/accessibility or provider-evidence gap; retry mid-feature restore only with event-triggered instrumentation.

## BS-20260901-02 — SUCCESS

- Sprint day: 3
- Base commit: `16c67bb76f236d12bc4a14c55efc3a3879fb9b3a`
- Verified implementation commit: `9099585503f8a33be06a456ade501bff689f7d21`
- Work item: `BSB-MOBILE-001` (bounded HUD accessibility-semantics continuation; remains DONE)
- Selection reason: geometry, focus and touch targets were exact, but the access-level/motion control collections lacked exposed group semantics, asynchronous launch/board messages were not atomic status regions, and high-cost confirmation did not bind its factor/total explanation to the dialog.
- Before/after evidence: route and presentation controls are named groups; launch/board updates are atomic polite statuses; Deep Access and BLACKOUT dialogs expose descriptions containing exact 4×/$4.00 and 80×/$80.00 values. Exact geometry proves the semantics across invalid-language, desktop, portrait, landscape and Replay surfaces.
- Changed files: `+page.svelte`, Chromium QA, one new three-case accessibility regression and five sprint-memory files; CSS/layout, math, wallet, assets, lockfile and dependencies unchanged.
- Gates: syntax PASS; focused accessibility/HUD tests 10/10 PASS; frozen install PASS; lint PASS; `svelte-check` 0 errors/0 warnings PASS; app tests 112/112 PASS; production build PASS; local and exact math 7/7 with 300,000 books and unchanged fingerprint; isolated package/readback and 51-row resolver PASS; exact Chromium 64/64 scenarios and 1576/1576 checks PASS; unexpected network/page/request failures 0; `git diff --check` and secret/debug review PASS. Local Chromium was BLOCKED by the absent Playwright executable and is superseded by the exact isolated CI package run.
- Visual review: exact 1920x1080, 390x844, 844x390, Replay 360x640 and completed Deep Access/BLACKOUT captures from artifact `9779949482` were inspected. Boards, values, controls and penguin/vault pixels remain complete without overlap, scroll, crop or broken-image regression; confirmed totals are $4.00/$80.00. The semantics do not intentionally change pixels; real screen-reader/device approval remains unclaimed.
- Tool/token metrics: see `METRICS.md`; tokens `null` / `not_exposed`; direct subagents 0. A changed loopback server command recovered from a container interface error; no unchanged semantic failure was repeated. Clean CI's 9-file frontend tree exposed local stale-bundle accumulation as follow-up `BSB-PACKAGE-CLEAN-001`.
- Persistence: implementation was fast-forwarded without force through connected Git data; exact run `33450641637`, artifact `9779949482` and digest `sha256:03395f9741d5cbcd488247f3943cebf1fa4cbfc334ce658db22e9b16a8096c27` succeeded.
- Residual risk: real screen-reader/device approval, deferred mid-feature restore evidence, 23 manual gates, 6 external approvals, rights/Creative cleanup, approved Spine rig/clips, BLACKOUT/foreground layers, final audio/listening/device QA and real-device pacing remain open.
- Next candidate: harden repeated local package/build cleanup so stale hashed bundles cannot enter a candidate; then choose the next distinct safe provider gap.

## BS-20260901-01 — SUCCESS

- Sprint day: 3
- Base commit: `b0a66ddcb6bdb22b246131f864513479f131e1a1`
- Verified implementation commit: `24eb2fe37d227053373a3defb5b793d2424e5f3c`
- Work item: `BSB-EVIDENCE-001` (bounded ambiguous authenticate-step slice; item remains in progress)
- Selection reason: unit contracts rejected conflicting `stepBet` and `minStep`, but the exact extracted package did not prove that this ambiguous provider configuration remains visibly fail-closed without exposing a paid action or sending a wallet write.
- Before/after evidence: exact Chromium receives one successful authenticate response with `stepBet=100000` and `minStep=200000`, displays `STEP_BET_CONFLICT`, leaves the primary action `UNAVAILABLE`, starts no local fallback and sends exactly one authenticate plus zero play, event or settlement writes.
- Changed files: Chromium QA, 51-point evidence map, compliance regression and five sprint-memory files; runtime UI, math, assets, lockfile and dependencies unchanged.
- Gates: focused contracts/compliance 41/41 PASS; frozen install PASS; lint PASS; `svelte-check` 0 errors/0 warnings PASS; app tests 109/109 PASS; production build PASS; local and exact math 7/7 with 300,000 books and unchanged fingerprint; isolated package/readback and 51-row resolver PASS; exact Chromium 64/64 scenarios and 1558/1558 checks PASS; unexpected network/page/request failures 0; `git diff --check` PASS. Local Chromium was BLOCKED only by the missing Playwright executable and is superseded by the exact isolated CI package run.
- Visual review: exact 1280x720 ambiguous-auth failure plus 1920x1080, 390x844, 844x390 and Replay 360x640 captures from artifact `9779098528` inspected. The error/reload card and disabled action are centered and visible; boards, values, controls and penguin/vault pixels remain complete without overlap, scroll, crop or broken-image regression. Prior 1366x768 evidence remains source-identical; manual/device approval is unclaimed.
- Tool/token metrics: see `METRICS.md`; tokens `null` / `not_exposed`; direct subagents 0. One wrong Git base-tree identifier and one unauthenticated CLI push were replaced with exact content-addressed alternatives; no unchanged semantic failure was repeated.
- Persistence: implementation was fast-forwarded without force through connected Git data; exact run `33448128514` and artifact `9779098528` succeeded.
- Residual risk: deferred mid-feature restore evidence, 23 manual gates, 6 external approvals, rights/Creative cleanup, approved Spine rig/clips, BLACKOUT/foreground layers, final audio/listening/device QA and real-device pacing remain open.
- Next candidate: complete the highest-impact day-3 HUD/responsive/accessibility gap still evidenced by current-package geometry; otherwise choose another distinct provider gap and defer mid-feature restore until event-triggered observation exists.

## BS-20260831-30 — SUCCESS

- Sprint day: 2
- Base commit: `342574ba7e86893defaf4d2705fb6b6edec3ae40`
- Verified implementation commit: `50533a5ac45594c67caaee9946c0e3049afec5d3`
- Work item: `BSB-EVIDENCE-001` (bounded expired-settlement-session recovery slice; item remains in progress)
- Selection reason: exact package evidence covered transport-level failed settlement and session expiry before play acceptance, but not a session expiring after one authoritative play/checkpoint and before end-round completion.
- Before/after evidence: one accepted Base play persists one durable checkpoint; the first end-round returns API `ERR_SESSION`, exposes fail-closed `RELOAD / RESTORE`, and two 300ms guards prove no automatic auth/settlement retry. Explicit reload reauthenticates once, restores the active cursor and sends one successful completion. Exact order is `authenticate → play → event → endRound → authenticate → endRound`; no duplicate play/checkpoint occurs.
- Changed files: Chromium QA, 51-point evidence map, compliance regression and sprint memory closeout files; runtime UI, math, assets, lockfile and dependencies unchanged.
- Gates: focused syntax/contracts/compliance 40/40 PASS; frozen install PASS; local and exact lint PASS; local and exact `svelte-check` 0 errors/0 warnings PASS; local and exact app tests 108/108 PASS; production build PASS; full math 7/7 with 300,000 books PASS and unchanged fingerprint; isolated package and 51-row evidence resolution PASS; exact Chromium 63/63 scenarios and 1550/1550 checks PASS; unexpected network/page/request failures 0; `git diff --check` PASS.
- Visual review: exact 1280x720 expired-settlement failure/recovery captures plus 1920x1080, 390x844, 844x390 and Replay 360x640 geometry from artifact `9777256465` were inspected. Error/reload treatment, authoritative board/win, recovered values, controls and penguin/vault identity remain visible and centered without overlap, scroll, crop or broken-image regression. Prior 1366x768 coverage remains source-identical; manual/device approval is not claimed.
- Tool/token metrics: see `METRICS.md`; tokens are `null` / `not_exposed`; direct subagents 0. Exact chunked blob/tree identity guards passed. One destructive temporary-path command was blocked and safely replaced; one log-filter regex was corrected once. No unchanged semantic failure was repeated.
- Persistence: implementation was fast-forwarded without force through connected Git data; exact run `33442885524` and artifact `9777256465` succeeded.
- Residual risk: deferred mid-feature restore evidence, 23 manual checklist gates, 6 external approvals, rights/Creative cleanup, approved Spine rig/clips, BLACKOUT/foreground layers, final audio/listening/device QA and real-device pacing remain open.
- Next candidate: choose the next distinct safe provider/gameplay evidence gap; retry mid-feature restore only with event-triggered instrumentation.

## BS-20260831-29 — SUCCESS

- Sprint day: 2
- Base commit: `bf24cdde2afe9d84435de65409316d4cca2adecb`
- Verified implementation commit: `5767f33f948e1b43552812d806da4e347493db1b`
- Work item: `BSB-EVIDENCE-001` (bounded expired-session recovery slice; item remains in progress)
- Selection reason: the RGS client classified API session failures, but the exact package did not prove that a session expiring during play remains fail-closed, avoids automatic resubmission and recovers only through explicit reauthentication plus a fresh player action.
- Before/after evidence: one legal play receives API `ERR_SESSION`, enters `live-error`, clears balance/result authority and disables Play. Two 300ms guards prove no automatic play or auth retry. `RELOAD / RESTORE` performs exactly one second authentication and returns ready without resubmitting the rejected action. A subsequent deliberate click sends exactly one new successful play. Exact order is `authenticate → play → authenticate → play`; event and settlement writes remain zero.
- Changed files: Chromium QA, 51-point evidence map, compliance regression and sprint memory closeout files; runtime UI, math, assets, lockfile and dependencies unchanged.
- Gates: focused syntax/contracts/compliance 40/40 PASS; frozen install PASS; exact lint PASS; `svelte-check` 0 errors/0 warnings PASS; app tests 108/108 PASS; production build PASS; full math 7/7 with 300,000 books PASS and unchanged fingerprint; isolated package and 51-row evidence resolution PASS; exact Chromium 62/62 scenarios and 1518/1518 checks PASS; unexpected network/page/request failures 0; `git diff --check` PASS.
- Visual review: exact 1280x720 expired-session failure/recovery captures plus 1920x1080, 390x844, 844x390 and Replay 360x640 geometry from artifact `9776234530` were inspected. Error/reload treatment, recovered board, exact values, controls and penguin/vault identity remain visible and centered without overlap, scroll, crop or broken-image regression. Prior 1366x768 coverage remains source-identical; manual/device approval is not claimed.
- Tool/token metrics: see `METRICS.md`; tokens are `null` / `not_exposed`; direct subagents 0. A truncated large-file blob was caught by exact tree comparison and replaced by bounded exact chunks; one log-filter regex was corrected once. No unchanged semantic failure was repeated.
- Persistence: implementation was fast-forwarded without force through connected Git data; exact run `33439810616` and artifact `9776234530` succeeded.
- Residual risk: deferred mid-feature restore evidence, 23 manual checklist gates, 6 external approvals, rights/Creative cleanup, approved Spine rig/clips, BLACKOUT/foreground layers, final audio/listening/device QA and real-device pacing remain open.
- Next candidate: choose the next distinct safe provider/gameplay evidence gap; retry mid-feature restore only with event-triggered instrumentation.

## BS-20260831-28 — SUCCESS

- Sprint day: 2
- Base commit: `d937e7247591fce7a4fbebf695768f9957db0be4`
- Verified implementation commit: `54c3afc29fcdfded09d36082808c6a8df2b347ad`
- Work item: `BSB-EVIDENCE-001` (bounded `ERR_IPB` explicit-recovery slice; item remains in progress)
- Selection reason: exact browser proof stopped at the fail-closed balance-race error and did not prove what an explicit player reload must do when authority exposes an active round after the rejected play.
- Before/after evidence: one legal play receives API `ERR_IPB`, enters `live-insufficient`, clears board/win and disables Play. A 300ms guard proves no automatic retry. Explicit `RELOAD / RESTORE` makes exactly one second authentication, receives the authoritative active zero-win round, sends exactly one `/wallet/end-round`, and returns `live-ready` with `$999.00` / `$0.00`. Exact order is `authenticate → play → authenticate → endRound`; there is no duplicate play, event or checkpoint write.
- Changed files: Chromium QA, compliance evidence regression, and sprint memory closeout files.
- Gates: focused syntax/contracts/compliance 39/39 PASS; frozen install PASS; exact lint PASS; `svelte-check` 0 errors/0 warnings PASS; app tests 107/107 PASS; production build PASS; full math 7/7 with 300,000 books PASS and unchanged fingerprint; isolated package and 51-row evidence resolution PASS; exact Chromium 61/61 scenarios and 1490/1490 checks PASS; unexpected network/page/request failures 0; `git diff --check` PASS.
- Visual review: exact 1280x720 `ERR_IPB` failure/recovery captures plus 1920x1080, 390x844 and 844x390 geometry from artifact `9775142447` were inspected. Error/reload treatment, restored board, balances, controls and penguin/vault identity remain visible and centered without overlap, scroll, crop or broken-image regression. Prior 1366x768 and Replay 360x640 coverage remains source-identical; manual/device approval is not claimed.
- Tool/token metrics: see `METRICS.md`; tokens are `null` / `not_exposed`; direct subagents 0. No failed or unchanged semantic tool call was repeated, and no dependency or binary product asset changed.
- Persistence: implementation was fast-forwarded without force through connected GitHub data; exact run `33436799735` and artifact `9775142447` succeeded.
- Residual risk: deferred mid-feature restore evidence, 23 manual checklist gates, 6 external approvals, rights/Creative cleanup, approved Spine rig/clips, BLACKOUT/foreground layers, final audio/listening/device QA and real-device pacing remain open.
- Next candidate: choose the next distinct safe provider/gameplay evidence gap; retry mid-feature restore only with event-triggered instrumentation.
