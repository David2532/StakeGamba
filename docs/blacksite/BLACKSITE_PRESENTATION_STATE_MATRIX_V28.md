# BLACKSITE // BREACH — Presentation State Matrix V28

Status: **DESIGN LOCK — PASS**
Contract: `blacksite-book-events-v3`
Candidate reference: `0.3.0-math-v3`
Event-schema SHA-256: `8d68ffcf0d47fdf20648868d975d2cd944dd4892ac5bd9bf411f6d96b8834b75`
Locked: 2026-08-20
Identity amendment: 2026-08-21 — the user's latest direction selects the tactical Penguin operative instead of the adult-male operative. Event authority, priority, timing, cleanup, Math and RGS contracts are unchanged.

## 1. Authority rule

The path is fixed:

`validated RGS/book event -> GameEventAdapter -> PresentationDirector -> board / UI / operative / VFX / AudioDirector`

Only the validated authoritative event stream determines board, phase, win positions, amounts, target symbol, counter, cap, and terminal state. Presentation may order, interpolate, shorten, skip, or replace missing decoration, but may not calculate a result, invent a feature, alter a multiplier, hide a required amount, delay wallet authority, or decide settlement.

The closed canonical event set is:

`round_start`, `spin_set`, `expansion_applied`, `line_win`, `feature_trigger`, `feature_start`, `free_spin_start`, `feature_end`, `cap_reached`, `round_end`.

No V28 code or asset may add an outcome event. Derived presentation facts are allowed only from fields in the event already being consumed and are explicitly identified below.

## 2. Invariants shared by every state

- Five reels, three rows, ten fixed paylines, 13 canonical symbols.
- `breach` is non-paying and never receives a line-win path.
- Feature starts only from `feature_start`; triggered Base/Deep Access has a preceding `feature_trigger`, direct BLACKOUT does not.
- BLACKOUT always has eight `free_spin_start` events unless cap termination ends the round early as defined by the canonical grammar. There is no retrigger.
- `round_end.payout_multiplier_raw` is the only final presentation multiplier; exact monetary WIN remains authoritative RGS `round.payout` in live play.
- Presentation thresholds use `returnPerCostRaw = step_payout_raw / mode.costMultiplier`. This is cosmetic centi-x-per-mode-cost and never written back to game state.
- All cue instances use a dedupe key containing round/replay identity, canonical event index, semantic cue ID, and cue ordinal.
- Restore primes already-durable checkpoints silently, then resumes at exactly the authoritative next event index. It does not re-emit consumed one-shots.
- Replay is read-only and uses the same event order, visual thresholds, and deterministic variants without authentication or wallet calls.
- Every async cue owns cancellation, cleanup, maximum duration, missing-asset fallback, Skip/Turbo path, and component-destroy behavior.

## 3. Canonical event-to-presentation matrix

| Authoritative event | Preconditions / derived facts | Board and UI presentation | Operative / VFX | Audio binding | Completion and cleanup |
|---|---|---|---|---|---|
| `round_start` | Closed record validates mode, cost, phase, board shape, payline count, payout unit, and max win. Live response is accepted before confirmed-spin media begins. | Lock bet/mode controls for the unresolved round. Preserve prior final WIN until confirmed new-round handoff, then reset step WIN. Base/Deep Access shows cold Base shell; direct BLACKOUT shows a bounded `PREPARING BLACKOUT` state without inventing reels. | Idle may transition to short `spin` transient. No result reaction. Direct mode waits for `feature_start` before gold/door state. | `spin.confirmed` for Base/Deep Access; `blackout.direct.prep` for direct mode. Start reel motor only after this event. | Creates presentation generation. A newer generation, teardown, or failed contract cancels all transients and returns controls to an explicit recover/error state. |
| `spin_set` with `phase=base` | Board is fully authoritative. BREACH count and positions may be derived from this board only. | Reveal/settle five reels left-to-right; final symbols are never substituted by anticipation art. After each stop, update visible distinct-BREACH count from already-known cells on stopped reels. Keep ten-line context available. | Bounded seal movement; no whole-stage filter. `anticipation` is allowed only when the authoritative board contains at least two distinct BREACH reels, and only while unrevealed confirmed trigger cells are still being presented. | Five spatial `reel.stop.N`; deterministic land priority per reel. `breach.1`, `breach.2`, and either `anticipation.confirmed` or `anticipation.release` are derived from the same board. | Stop motor and transient anticipation no later than final reel settle. Clear stop particles before `line_win` or `feature_trigger`. |
| `spin_set` with `phase=feature` | Must follow matching `free_spin_start`; board and spin index are authoritative. | Reveal current BLACKOUT board inside unique gold-lit interior. Keep counter and target visible. Reset previous line path and step win, not cumulative feature win. | Operative remains in `bonus` base stance; short spin overlay may layer without replacing bonus context. | `feature.spin.confirmed`, motor, five spatial stops, bounded land cues. | Same deterministic reel cleanup. Never reset feature ambience or selected target between spins. |
| `line_win` | Every winning line, position, WILD position, step award, cumulative award, and cap flag has validated against the board. | Present lines exactly in ascending `line_id`; show only awarded 3/4/5 prefix; WILD substitutions receive cyan spectral accent. Display authoritative step value and cumulative value. Non-winning cells dim to 45–58%, not hidden. | Tier is derived from `returnPerCostRaw`. No celebratory result when below cost. Character may react after the causal line is readable. | `win.micro`, `.small`, `.medium`, `.big`, or `.top`; optional rollup only for tiers that need it. | Minimum readable line hold: 420 ms normal, 160 ms Turbo. Clear line path, dimming, rollup, and particles before the next `free_spin_start` or terminal report. |
| `feature_trigger` | Validated positions contain BREACH on at least three distinct reels and `awarded_free_spins=8`. | Lock the confirmed BREACH cells; show `3/3 BREACH` and `8 FREE SPINS` as live text. Begin vault focus, but do not expose target until `feature_start`. | `bonus`/feature-trigger reaction may preempt ordinary win after the line result remains readable. Red security practicals and bounded breach pulse. | `breach.trigger`; begin `vault.hold` and `vault.focus`. | Trigger lock is idempotent. It may be skipped only after confirmation beat. It remains compatible with an immediately following `feature_start`. |
| `feature_start` | `target_symbol` is one of 11 regular symbols and `total_free_spins=8`; `direct` distinguishes bought/direct BLACKOUT from triggered entry. | Set phase to feature, target carrier, `0/8`, and unique BLACKOUT environment. Triggered entry continues all ten vault phases; direct entry uses compressed lock phases but converges on the same final state. | Operative enters `bonus`; Base ambient attachments clear. Gold interior, door, dust, and camera phases follow the locked timeline. | `blackout.enter`, phased `vault.*`, `feature.target.confirm`, then start `ambience.blackout`. | Full, Turbo, Skip, reduced-motion, replay, and restore converge on identical target/counter/environment. Maximum guard is 7,500 ms including protected award hold. |
| `free_spin_start` | Index is 1–8, total is 8, remaining count reconciles. | Show `FREE SPIN n OF 8`, remaining count, target, and cumulative feature win before starting that spin. Clear prior line path and step win. | Keep `bonus` base; allow one short focus gesture at spin 1 only. | `feature.spin.count`; do not restart BLACKOUT loop. | Counter update is immediate and checkpoint-safe. On restore, earlier indices prime silently. |
| `expansion_applied` | Target matches `feature_start`; `expanded_reels` and evaluated board are authoritative. | Show original board for causal read, then transform only listed reels to three target symbols; label exact reel numbers. Evaluated board becomes line-evaluation surface. | Operative gaze follows first expanded reel; bounded vertical energy rail per expanded reel. | `feature.expand.attack`, per-reel `feature.expand.reel`, `feature.expand.settle`. | Normal 420–650 ms; Turbo 180 ms minimum. Clear energy rails before `line_win`; evaluated symbols remain. Missing FX falls back to instant cell swap plus outline. |
| `feature_end` | `spins_played`, total, cumulative payout, and cap flag validate. No further feature spin can follow. | Freeze final evaluated board long enough to read, show `BLACKOUT COMPLETE`, 8/8 or authoritative completed count, and cumulative feature result. No retrigger affordance. | Bonus reaction settles to extraction pose; gold environment remains through summary. | `feature.summary.open`; fade BLACKOUT loop after summary handoff. | Summary can be skipped to the same cumulative value. Clear target/counter only when returning to Base after terminal state. |
| `cap_reached` | Must immediately follow a capped `line_win`; cap is 1,000,000 centi-x = 10,000x. | Show exact maximum, freeze additional count-up, and retain causal line/board. In feature, preserve completed counter/target. | `bigWin`/max hero state has priority below active bonus handoff but is not duplicated at `round_end`. | `win.max`, stop rollup, apply max-win duck. | Skip resolves instantly to exact cap. The report has a maximum duration and always exits. |
| `round_end` | Last event, canonical mode and phase, exact final payout multiplier and capped flag. Live settlement behavior follows authoritative `round.active`, not presentation. | Set presentation complete and final WIN. For zero payout show neutral `ROUND COMPLETE`; for positive payout show confirmed result without overstating below-cost returns. Re-enable input only when live-session authority also permits it. | Zero payout may select `loss`/bounded session-local `lossStreak`; positive result selects highest not-yet-played valid tier. No shame copy. | `round.loss` or `round.complete`; avoid replaying a win already emitted for the terminal line. | Stop reel/win/vault transient loops, resolve audio ducking, clear particles/listeners, and leave legal Base or completed replay state. End-round is not called because animation ended. |

## 4. Presentation win tiers

These thresholds are fixed for V28 and normalized by current mode cost:

| Tier | `returnPerCostRaw` | Meaning and treatment |
|---|---:|---|
| `micro` | `1–99` | return below 1.00x mode cost; exact amount, dry restrained tick, no celebration, no camera |
| `small` | `100–499` | 1.00x to <5.00x mode cost; short line accent and restrained acknowledgment |
| `medium` | `500–999` | 5.00x to <10.00x mode cost; stronger line read, one bounded operative reaction |
| `big` | `1,000–4,999` | 10.00x to <50.00x mode cost; layered win treatment, ≤2 px camera impulse |
| `top` | `≥5,000` below cap | ≥50.00x mode cost; highest non-cap treatment, board stays visible |
| `max` | `cap_reached` only | authoritative 10,000x complete-round cap; cannot be inferred from threshold |

For a `line_win` with multiple lines, tier uses `step_payout_raw`, not the largest individual line. Terminal presentation uses authoritative final total and dedupes already-played step reactions. A payout below total play cost is never labeled `BIG`, `MEGA`, `EPIC`, or equivalent.

## 5. Operative state matrix

All runtime frames are 1280 × 1024 RGBA PNG with anchor `(310,1000)`. The result priority remains `rage > bonus > bigWin > win > lossStreak > loss > idle`; spin/anticipation are transient idle replacements only.

| State | Trigger | Entry / action / settle / exit | Interrupt and repeat rule | Replay / restore |
|---|---|---|---|---|
| `idle_a` | legal stable Base state | 180 ms mix/hold into 3–5 s low-amplitude breathing loop | interrupted by any confirmed higher state; no more than 3 consecutive loops | stable fallback; restore may show immediately |
| `idle_b` | deterministic cosmetic key after `idle_a`, never random gameplay RNG | glance toward board, equipment check, settle to idle | at most once per 20 s; never while result readable | replay key deterministic; restore starts `idle_a` instead |
| `spin` | validated `round_start` Base/Deep Access | hand/terminal acknowledgment ≤480 ms, then idle/anticipation | cannot preempt result/bonus; one per round | replay allowed; consumed restore event primes silently |
| `anticipation` | authoritative `spin_set` contains ≥2 distinct BREACH reels during ordered reveal | focus/lean toward last reels; hold only until reveal resolves | max 1,200 ms normal/450 ms Turbo; immediately releases or yields to bonus | never inferred before board; restored checkpoint does not replay one-shot |
| `loss` | deduplicated live `round_end` payout 0, streak 1–2 | quiet reset/gear check; neutral face; no blame | ≤800 ms, once per round | replay uses single loss; restore never advances streak |
| `lossStreak` | deduplicated live zero-payout streak ≥3, except Rage interval when enabled | composed fatigue/reset directed at terminal, no shame | ≤1,100 ms; cooldown one round; resets on positive result | not persisted as mechanic; replay uses loss |
| `win` | confirmed `line_win` tier small/medium or positive terminal not already acknowledged | restrained nod/hand cue | ≤1,200 ms; one queued reaction per readable step | deterministic and deduped by event index |
| `bigWin` | confirmed tier big/top or `cap_reached` | stronger board-facing reaction, settle into legal stance | ≤2,200 ms; preempted by bonus only after causal amount is visible | deterministic; no duplicate at terminal event |
| `bonus` | confirmed `feature_trigger`/`feature_start` and throughout feature | entry alert, heightened loop, extraction settle, recover | preempts ordinary win/loss; one entry per round | direct and triggered paths converge; restore enters stable bonus pose |
| `rage` | explicit setting on **and** sixth deduplicated zero-payout live round; default off | anger at hostile terminal/environment only, no player gaze/blame/voice | ≤1,400 ms; one per six zero rounds; any review ambiguity disables binding | never in replay; restore does not increment or replay |
| `recover` | asset error, interrupt, skip, orientation change, teardown-safe handoff | 150–300 ms neutralization or static fallback pose | mandatory fallback; cannot block control recovery | immediate safe pose |

## 6. Vault phase state machine

The normal triggered path is fixed:

`base-readable -> trigger-lock -> focus -> lock-1..6 -> wheel -> pressure -> bolts -> door -> gold -> camera -> award-hold -> blackout-ready`

Direct path:

`feature_start(direct=true) -> compressed-focus/locks -> wheel/door/gold compressed -> award-hold -> blackout-ready`

Skip path:

`any skippable phase -> cancel phase timers/listeners/audio tails -> door-final-pose -> gold-final-pose -> exact award-hold -> blackout-ready`

Reduced-motion path:

`confirmed trigger -> static lock frame -> crossfade to open-door gold state -> exact award-hold -> blackout-ready`

All paths set the same authoritative `featureTarget`, `totalFreeSpins=8`, `freeSpinIndex=0`, `remainingFreeSpins=8`, cumulative win, board checkpoint, audio loop identity, and interaction locks. They do not emit or consume RGS events. Missing door/particle/operator media uses static phase plates and live text; candidate status fails, gameplay does not deadlock.

## 7. Non-book application states

| Application state | Authority | Required presentation | Forbidden behavior | Exit |
|---|---|---|---|---|
| Cold start | launch/query contract | black/system shell, local asset progress, accessible game title; no autoplaying audio before unlock | simulated wallet, hidden auth error, unskippable blocker | resolve launch kind |
| Authenticate loading | live-session state | bounded `CONNECTING`, Spin disabled, current configuration unknown | hardcoded bet levels/modes presented as live authority | validated auth or explicit error |
| Ready | authoritative auth/session | selected legal bet, total cost, mode availability, balance, one dominant Spin | duplicate menus/settings, dead mode selector | confirmed action or modal |
| Bet change | authenticate constraints | exact legal previous/next value and recalculated total; no board motion | float rounding, changing active-round bet | selection accepted or unchanged |
| Mode selection | authenticated available modes/jurisdiction | structured cards with cost/RTP/max/mechanic; show selector only when >1 mode available | text baked in art; selected mode without confirmation for major action | select, cancel, or confirm |
| Major-action confirmation | user request plus mode cost | exact total amount/currency and mode; Confirm/Cancel | starting reels before confirmation and RGS acceptance | accepted play or cancel |
| Insufficient balance | authoritative known balance or RGS `ERR_IPB` | neutral deny/error, zero reel/operative result motion, recovery | play request after known insufficiency, shame animation | bet/mode change or balance refresh |
| UI modal | explicit user action | one modal, focus trap/return, internal scrolling | stacked dialogs, background hit targets, main-frame scroll | Close/Escape/safe action |
| Mute | explicit user setting | immediate state change, persisted; icon and text/aria state | partial buses remaining audible | toggle only |
| Reduced motion | OS preference plus optional project setting if present | same information and order with static/crossfade substitutions | removing line/amount/counter information | live preference change reroutes current cue safely |
| Offline/reconnect | transport/session state | preserve authoritative local snapshot, disable new play, bounded retry/reload option | fixture fallback, duplicate play, optimistic settlement | successful authoritative restore or explicit error |
| Runtime/session error | closed error contract | error code/message, one recovery action, no local outcome | swallowing error behind cinematic | recover/reload/restore |
| Replay loading | replay query and GET state | read-only label, queried mode/cost/currency, no live wallet | authenticate/play/end-round | valid replay or replay error |
| Replay ready/playing/completed | validated replay book | deterministic same sequence; Play Again resets presentation | session streak, wallet/balance mutation, live intro | play again or close |
| Active-round restore | auth `round` plus validated cursor | prime events before cursor synchronously, resume next event, preserve mode/bet/currency/board/counters/win | duplicate play, duplicate one-shots, v1/v2 cursor interpretation | authoritative round complete |
| Visibility hidden | document lifecycle | suspend ambient/idle/tickers; retain exact checkpoint | timers racing ahead, stacked loops on return | resume once and reconcile state |
| Orientation/resize | viewport lifecycle | cancel transient camera/particles, recompute safe layout, continue checkpoint | root-motion jump, board distortion, value loss | layout stable within two animation frames |
| Asset failure | decoder/loader | hide optional art, use static/operator-neutral/DOM board fallback, expose diagnostic only in dev | blocking settlement/replay/restore | continue presentation; candidate gate FAIL |

## 8. Responsive state rules

- Wide desktop: one-row HUD; operative left 18–22%; reel aperture and values remain centered in the machine.
- Constrained height and short landscape: suppress full operative before compressing the board; all required controls remain in safe bounds.
- Portrait phone: feature counter/target directly above board, values in one compact strip, controls in bottom safe dock; operative is optional corner bust.
- Popout S: no full operative and no decorative footer; preserve board, action, mode, bet/total/win, mute/info, feature identity, and replay controls.
- Any responsive state change preserves authoritative board, active lines, counter, target, current/final win, control disabled state, and modal focus context.

## 9. Cleanup and interrupt table

| Interrupt | Immediate cleanup | Preserved | Resume/final state |
|---|---|---|---|
| Turbo enabled mid-cue | shorten remaining nonessential waits; stop long tails with 30–60 ms fade | board, line, amount, feature counter | next semantic checkpoint on Turbo timing |
| Vault Skip | cancel phase timers/listeners/particles; fade loops; suppress already-skipped one-shots | target, 8-spin award, win, round identity | exact `blackout-ready` after protected award hold |
| Replay Play Again | increment presentation generation; remove listeners/timers/audio nodes/particles | replay payload/query identity | initial replay-ready, then same deterministic sequence |
| Restore/reload | destroy current generation; no cosmetic state written as authority | RGS round, cursor, balance/currency/bet/mode | prime durable prefix silently and resume next cue |
| Route/component destroy | abort all pending completions; remove visibility/media listeners; release GPU/audio resources | none in component; authority remains outside | no callback may fire into destroyed state |
| Missing asset | mark source failed once; stop requesting in loop; substitute static/DOM state | all gameplay information | sequence completes normally; QA issue recorded |
| Audio context denied | resolve cue as cosmetic failure; mute indicator remains accurate | all visual and authority state | continue silently, retry unlock only on legal user gesture |
| Network error before accepted play | cancel pending visual press/loading only | selected bet/mode, balance snapshot | explicit error/reconnect; no reel result |

## 10. Current implementation coverage gaps

The following are implementation findings, not changes to the locked design:

- V21/V22/V27 premium presentation is currently coupled to development fixture flags; production does not yet prove this design.
- V28 selects the tactical Penguin operative in modern presentation. The adult-male legacy path must not flash, preload, or become visible; the Penguin still has to meet the same bounded-state, cleanup, reduced-motion, rights, and production-quality gates.
- The V26 vault video has a visible Kling watermark and is an uncontrolled whole-sequence source; it cannot satisfy the phased cinematic.
- Current BLACKOUT reuses too much Base shell/board language and does not prove unique gold-lit secure-interior geometry.
- Current short-landscape and 390 × 844 vault layouts have clipping/letterbox risk.
- Current Spin/Turbo hit boxes have subpixel contact/overlap risk in at least one desktop geometry.
- Current audio maps 29 synthetic/file cues but lacks the complete six-bus, deterministic-variant, restore-dedupe, and production-bank contract.
- Current Rage-out behavior is a review risk; V28 keeps it default-off and requires the non-shaming constraints above.

These gaps keep runtime/polish gates blocked. They do not invalidate the design lock.

## 11. Acceptance criteria

Implementation passes this matrix only when deterministic fixtures prove:

- every canonical event maps once and only once to the locked state;
- no presentation begins a confirmed reel/result sequence before an accepted, validated event;
- all ten paylines and exact winning prefixes remain traceable in normal and Turbo;
- BREACH 1/2 derives only from an authoritative board and trigger/gold only from confirmed feature events;
- all eight BLACKOUT spins preserve target/counter/cumulative win and show materially distinct environment;
- direct, triggered, full, Turbo, Skip, reduced-motion, replay, and restore paths converge on identical authoritative state;
- no one-shot duplicates after restore/replay repeat/visibility changes;
- zero and below-cost outcomes are restrained and never shaming;
- every cancel/failure path releases timers, listeners, audio nodes, loops, particles, filters, and transient GPU resources;
- exact desktop/mobile/landscape/tablet/Popout screenshots, videos, geometry assertions, and runtime traces exist.

Design Lock PASS is limited to the coherence and implementability of this mapping. Actual event/browser/package proof remains required.
