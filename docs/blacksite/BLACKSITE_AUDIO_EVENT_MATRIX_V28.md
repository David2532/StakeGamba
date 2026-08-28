# BLACKSITE // BREACH — Audio Event Matrix V28

Status: **DESIGN LOCK — PASS / RUNTIME COVERAGE — FAIL**
Owners: Audio Director, Presentation Director, QA
Locked: 2026-08-20

## 1. Audio identity and authority

V28 audio is dry, heavy, mechanical, and restrained: low industrial pulse, close electromechanical transients, a short cyan-system tritone, and a warm gold fifth reserved for confirmed BLACKOUT/award state. There are no generic casino bells, EDM wall, speech exposition, cloned voices, streaming rips, or rights-unclear files.

Gameplay-linked audio starts only from a validated canonical event or from a deterministic fact derived from the event currently being presented. A pointer/key UI sound may acknowledge that UI event, but it cannot masquerade as an accepted spin, reel result, win, or feature. No cue reads or advances gameplay RNG. Cosmetic variants use:

`variantKey = hash(roundOrReplayId | eventIndex | cueId | ordinal)`

Development fixture identity replaces `roundOrReplayId` only in explicit fixture launch mode. The same identity and event stream must produce the same variant order in Replay. Restore primes consumed event keys without replaying their one-shots.

## 2. Source and runtime contract

- Source master: WAV, 48 kHz, 24 bit.
- True-peak ceiling: ≤ −1 dBTP.
- Runtime format follows the tested local browser pipeline; MP3 is allowed as a runtime derivative, never as the source master.
- No clipping, DC offset, click, hard-cut tail, or audible loop seam.
- Short UI/reel bank is loaded and decoded before first legal play; bonus/vault banks may lazy-load after Base readiness if restore/direct BLACKOUT preloads them before presentation.
- Runtime has no external CDN/audio request.
- Every accepted third-party source records title, author/provider, original URL, exact license and license URL, download date, attribution requirement, commercial-use permission, source hash, edit chain, master hash, runtime hash, and archived license evidence.
- A license ambiguity is `FAIL`; that file is not used.

Current V19 audio consists of three MP3 runtime derivatives. The Wave 0 audit records 29 registered recipe names, 18 emitted names, 11 orphaned names, and missing engine requirements. Those files and synthesized recipes do not satisfy V28 production coverage.

## 3. Bus and mix lock

| Bus | Purpose | Nominal gain | Max concurrent voices | Voice stealing | Notes |
|---|---|---:|---:|---|---|
| `Music` | tonal Base/BLACKOUT bed | −12 dB | 2 | crossfade oldest loop | one Base and one transition/feature stem at most |
| `Ambience` | server room, air, electrical room tone | −14 dB | 3 | oldest lowest-priority | no sub-heavy masking of reels |
| `Reels` | motor, stops, symbol land, vault mechanics | −6 dB | 10 | lowest priority then oldest | reserve two voices for confirmed trigger/door |
| `Wins` | line accents, rollup, big/max | −5 dB | 5 | micro/small before higher tier | Max cannot be stolen by lower tier |
| `UI` | hover, press, modal, error | −10 dB | 4 | repeated hover/press first | UI feedback target p95 ≤50 ms desktop/≤80 ms phone |
| `Voice` | nonverbal operative/gear/cloth accent | −9 dB | 2 | oldest noncritical | no cloned/unclear voice; may remain Foley-only |

Master gain preserves −1 dBTP. Base Music+Ambience targets approximately −24 to −20 LUFS short-term; priority one-shots approximately −20 to −14 LUFS short-term. Low end below 120 Hz is effectively mono.

Ducking:

- vault mechanics/gold: Music −8 dB, Ambience −4 dB, 60 ms attack, 280 ms release;
- Big/Top/Max: Music −6 dB, Ambience −3 dB, 50 ms attack, 320 ms release;
- Voice: Music/Ambience −5 dB and Reels −3 dB during the voice/Foley focus only;
- UI Error/Deny: no music duck; it must remain clear by midrange placement;
- Mute ramps all six game-owned buses to silence within 20 ms and persists across reload.

## 4. Priority and lifecycle

Priority uses 0–100. Higher priority steals lower priority on its bus.

- `95–100`: Max, confirmed BREACH trigger, vault door/gold handoff, error/deny.
- `80–94`: Big/Top win, feature start/end, high symbol/WILD land.
- `60–79`: reel stops, regular wins, vault mechanics, operative reaction.
- `30–59`: normal lands, confirmed spin, modal/confirm/toggle.
- `1–29`: hover, ambience details, cloth micro-Foley.

All one-shots have a bounded duration and release envelope. Interrupts fade short cues 20–60 ms and loops 80–280 ms. Page hidden suspends ambience/music clocks and stops nonessential one-shots; visible resumes exactly one correct loop set without restacking. Destroy closes nodes/listeners and resolves pending cosmetic promises.

## 5. UI matrix

| Cue ID | Trigger authority | Bus / priority | Variants, cooldown, and treatment | Replay / restore | Current V19 |
|---|---|---:|---|---|---|
| `ui.hover` | pointer enters enabled control on fine-pointer device | UI / 15 | 2 variants; 70 ms cooldown per control; no touch synthesis | allowed in replay UI; never restored | missing |
| `ui.press` | pointer/key activation begins on enabled control | UI / 40 | 3 dry mechanical variants; 35 ms cooldown | allowed; never restored | partial synthetic under other names |
| `ui.confirm` | requested UI action is locally accepted, before any gameplay claim | UI / 55 | 2 upward latches; 80 ms cooldown | allowed | synthetic recipe only |
| `ui.cancel` | dialog/action explicitly canceled | UI / 45 | 2 short release variants | allowed | missing |
| `ui.toggle.on` | sound/Turbo/settings toggle becomes on | UI / 50 | one positive two-part latch | allowed; mute-on cue plays before master ramp only | missing |
| `ui.toggle.off` | toggle becomes off | UI / 50 | one descending latch; mute-off state is visually confirmed | allowed | missing |
| `ui.modal.open` | one modal becomes active | UI / 45 | one 120–180 ms pressure slide | allowed | partial `ui-open` synthetic |
| `ui.modal.close` | active modal closes and focus returns | UI / 45 | one short release | allowed | missing |
| `ui.error` | validated runtime/session error surface opens | UI / 100 | 2 midrange variants; never loops | allowed for replay-specific error | missing |
| `ui.deny` | disabled/insufficient/forbidden action is attempted and surfaced | UI / 98 | 2 dry deny clicks; 250 ms cooldown | allowed; no reel/operative result cue | missing |

## 6. Spin and reel matrix

| Cue ID | Trigger authority | Bus / priority | Variants, position, and treatment | Replay / restore | Current V19 |
|---|---|---:|---|---|---|
| `spin.press` | enabled user activates Spin/Replay action | UI / 45 | 2 tactile variants; UI acknowledgment only | Replay allowed; restore never | absent as distinct cue |
| `spin.confirmed` | validated `round_start` after accepted live response or validated replay/fixture event | Reels / 65 | 4 deterministic attacks; no cue on rejected/insufficient action | replay deterministic; consumed restore primes key | current `spin-start` plays too early and also starts ambience |
| `reels.motor.loop` | follows `spin.confirmed`, ends at final authoritative reel settle | Reels / 50 | seamless mono-compatible loop; one instance | restart only if current resume checkpoint still requires it | missing |
| `reels.turbo.attack` | same event with Turbo active | Reels / 65 | 3 short variants, replaces long motor attack | deterministic | missing as real asset |
| `reel.stop.1` | ordered reveal of reel 1 from `spin_set` | Reels / 70 | 4 variants; pan −0.80 | dedupe by event/ordinal | synthetic sequence only |
| `reel.stop.2` | ordered reveal of reel 2 | Reels / 70 | 4 variants; pan −0.40 | same | synthetic sequence only |
| `reel.stop.3` | ordered reveal of reel 3 | Reels / 70 | 4 variants; pan 0.00 | same | synthetic sequence only |
| `reel.stop.4` | ordered reveal of reel 4 | Reels / 70 | 4 variants; pan +0.40 | same | synthetic sequence only |
| `reel.stop.5` | ordered reveal of reel 5 | Reels / 72 | 4 variants; pan +0.80 and slightly heavier final body | same | synthetic sequence only |
| `spin.complete` | final reel settles and motor stops | Reels / 55 | 2 tail variants; no result implication | deterministic; silent when checkpoint already consumed | missing |

Five stops are separate semantic instances, not one pre-rendered five-stop file. Turbo uses the same identities with shorter attacks/tails and 35 ms offsets. The final audible transient must align with visible impact within ±1 frame at 60 FPS.

## 7. Symbol and feature matrix

Land selection is deterministic per settled reel: choose at most one dominant land cue by priority `confirmed BREACH > GHOST WILD > high symbol > regular/card`; this prevents 15 simultaneous impacts. Visual cells may all animate without playing all 15 sounds.

| Cue ID | Trigger authority | Bus / priority | Variants / rule | Replay / restore | Current V19 |
|---|---|---:|---|---|---|
| `symbol.land.regular` | dominant regular/card on authoritative stopped reel | Reels / 35 | 5 restrained material variants, pan by reel, 45 ms cooldown | deterministic | missing |
| `symbol.land.high` | dominant high object on stopped reel | Reels / 62 | 4 denser metal/electronic variants | deterministic | missing |
| `symbol.land.ghost_wild` | `ghost_wild` on authoritative stopped reel | Reels / 86 | 3 spectral-mechanical variants; never claims a win until `line_win` | deterministic | missing |
| `breach.land.1` | first distinct BREACH reel revealed from current authoritative `spin_set` | Reels / 78 | lock hit 1; dry, no rising award chord | deterministic | missing |
| `breach.land.2` | second distinct BREACH reel revealed | Reels / 84 | lock hit 2 plus confirmed tension stem | deterministic | missing |
| `breach.trigger` | canonical `feature_trigger` only | Reels / 100 | hard lock plus tritone/gold transition; one per round | deterministic; no duplicate on restore | partial `vault-tease/notice`, not authority-complete |
| `anticipation.confirmed` | board already proves ≥2 BREACH and ordered reveal has unrevealed confirmed trigger cell(s) | Reels / 75 | bounded 450–1,200 ms loop; not a probability claim | deterministic | partial synthetic `vault-tease` |
| `anticipation.release` | same known board resolves without `feature_trigger` | Reels / 58 | short pressure release; neutral | deterministic | missing |
| `mode.deep_access` | accepted `round_start.mode=deep_access` | UI+Reels / 65 | one secure-access latch; guaranteed positions are not sounded as a feature win | deterministic | missing |
| `blackout.direct.prep` | accepted `round_start.mode=blackout` before `feature_start` | Reels / 62 | bounded preparatory lock, no award chord yet | deterministic | orphan `direct-entry` recipe |
| `blackout.enter` | canonical `feature_start` | Wins / 96 | gold fifth and transition; triggered/direct variants converge | deterministic; consumed restore silent | orphan/partial recipes only |
| `feature.target.confirm` | `feature_start.target_symbol` becomes visible | UI / 72 | 3 material variants keyed by target family, no probability implication | deterministic | missing |
| `feature.spin.count` | each `free_spin_start` | UI / 45 | one concise counter tick; spin 1 has a slightly stronger attack | deterministic | missing |
| `feature.expand.attack` | `expansion_applied` | Reels / 82 | one energy attack | deterministic | missing |
| `feature.expand.reel` | each authoritative expanded reel, ascending reel index | Reels / 74 | 4 variants, spatial pan, max one per reel | deterministic | missing |
| `feature.expand.settle` | evaluated board is visually complete | Reels / 68 | one low mechanical latch | deterministic | missing |
| `feature.retrigger` | **N/A** | — | forbidden: canonical v3 has no retrigger | never | N/A, must not be emitted |
| `feature.summary.open` | canonical `feature_end` | Wins / 88 | warm extraction chord, restrained when cumulative return is low | deterministic | current `extraction` reuses award file |
| `feature.summary.close` | summary returns to completed/Base state | UI / 45 | one mechanical release | deterministic | partial `return-base` synthetic |

## 8. Win matrix

Tier derives only from validated `line_win.step_payout_raw / mode.costMultiplier` as locked in the presentation matrix. `cap_reached` alone selects Max.

| Cue ID | Trigger authority | Bus / priority | Treatment | Replay / restore | Current V19 |
|---|---|---:|---|---|---|
| `win.micro` | confirmed line tier `1–99` centi-x per cost | Wins / 40 | dry single tick, ≤180 ms; no chord/duck/camera | deterministic | generic `win` over-celebrates |
| `win.small` | confirmed `100–499` | Wins / 58 | two-note restrained accent | deterministic | generic `win` only |
| `win.medium` | confirmed `500–999` | Wins / 72 | fuller three-part impact, Music −3 dB optional | deterministic | missing distinct tier |
| `win.big` | confirmed `1,000–4,999` | Wins / 88 | layered hit plus bounded rollup; Music −6 dB | deterministic | missing distinct tier |
| `win.top` | confirmed `≥5,000` below cap | Wins / 94 | strongest non-cap authored sequence, board causal audio retained | deterministic | missing |
| `win.rollup.loop` | exact displayed count-up for Big/Top/Max only | Wins / 68 | seamless loop, pitch curve visual-only, max one | restore primes current total; replay deterministic | missing |
| `win.rollup.end` | count-up reaches authoritative target or Skip resolves | Wins / 86 | one exact landing transient | deduped | missing |
| `win.max` | canonical `cap_reached` | Wins / 100 | authored max identity; no further escalation beyond exact cap | deterministic and once per round | missing |
| `round.loss` | canonical `round_end.payout_multiplier_raw=0` | Reels / 42 | quiet neutral power-down; no sad tune or shame | Replay uses same single loss; restore deduped | synthetic `loss` only |
| `round.complete` | positive canonical `round_end`, when terminal acknowledgment was not already played | UI/Wins / 50 | short settle only; never duplicates line win | deterministic | absent as distinct cue |

## 9. Vault and environment matrix

| Cue ID | Trigger authority / phase | Bus / priority | Variants / treatment | Replay / restore | Current V19 |
|---|---|---:|---|---|---|
| `ambience.base` | audio unlocked and legal Base/replay-ready context | Ambience / 10 | seamless server-air loop plus rare deterministic rack detail | resume one loop; not a one-shot | one CC0 MP3, provenance closure pending |
| `music.base` | same context if music bank exists | Music / 10 | low restrained pulse, no result suggestion | resume one loop | missing; current ambience is misused as Music |
| `ambience.tension` | confirmed two-BREACH reveal or vault focus | Ambience / 45 | bounded layer, ends on release/trigger | deterministic | current anticipation MP3 reused broadly |
| `ambience.blackout` | `feature_start` through `feature_end` summary handoff | Ambience / 35 | materially different secure-interior air/gold electrical bed | restore starts at safe loop boundary once | current anticipation MP3 reused as feature loop |
| `music.blackout` | `feature_start` through feature completion | Music / 35 | warm-gold pulse derived from Base motif, not generic song swap | restore/replay deterministic | missing distinct stem |
| `vault.hold` | phase 1 after confirmed trigger/start | Reels / 75 | 2 low structural grabs | deterministic | partial `vault-notice` recipe |
| `vault.focus` | phase 2 | Reels / 78 | scan/focus transient and tension rise | deterministic | partial recipe |
| `vault.lock.1` … `.6` | six phase-3 lock markers | Reels / 82 | six related but distinct metal bodies; sequential pan/depth | each ordinal deduped | only three synthetic lock hits |
| `vault.wheel` | phase 4 | Reels / 86 | servo, bearing grit, weighted stop; loop/stop pair | resume at safe phase or static fallback | synthetic tonal approximation |
| `vault.pressure` | phase 5 | Reels / 84 | valve crack, vapor release, pressure tail | deterministic | missing |
| `vault.bolts` | phase 6 | Reels / 88 | deep retract mechanics, six micro-impacts embedded or marked | deterministic | orphan/partial synthetic recipe |
| `vault.door` | phase 7 | Reels / 98 | heavy hinge/metal movement, reserve voice | deterministic | synthetic approximation / video audio muted |
| `vault.door.impact` | phase-7 open stop | Reels / 100 | one low mono-compatible impact | deterministic | missing |
| `vault.gold` | phase 8 | Wins / 98 | warm reveal swell and air bloom | deterministic | partial `vault-light-entry` synthetic |
| `vault.camera` | phase 9 | Ambience / 72 | restrained forward air movement, no motion-sickness bass sweep | deterministic | missing |
| `vault.handoff` | phase 10 exact eight-spin award | Wins / 100 | warm fifth, award transient, then BLACKOUT stems | deterministic, protected once | one CC0 award MP3 reused for unrelated wins |

Vault phase sounds are individual synchronizable assets or stems with explicit markers. A single five-second soundtrack baked to an uncontrolled video fails this contract.

## 10. Operative matrix

Operative audio is primarily gear, cloth, terminal contact, and breath-scale nonverbal effort. No spoken taunts, loss blame, cloned voices, or rights-unclear vocal recordings.

| Cue ID | Confirmed visual state | Bus / priority | Variants / cooldown | Replay / restore | Current V19 |
|---|---|---:|---|---|---|
| `operative.gear` | deterministic idle-b/gear check | Voice / 20 | 4 cloth/gear variants; ≥12 s cooldown | replay deterministic; restore starts silent idle | missing |
| `operative.spin` | `spin` transient from accepted `round_start` | Voice / 45 | 3 glove/terminal variants | deterministic | missing |
| `operative.anticipation` | confirmed anticipation state | Voice / 55 | 2 cloth/breath variants, one per round | deterministic | missing |
| `operative.loss` | confirmed neutral loss | Voice / 35 | 3 quiet gear reset variants | replay single; restore deduped | missing |
| `operative.loss_streak` | confirmed session-local state | Voice / 38 | 2 neutral reset variants; no sigh of blame | not in replay/restore | missing |
| `operative.win` | confirmed small/medium reaction | Voice / 55 | 4 gear/hand variants | deterministic | missing |
| `operative.big_win` | confirmed Big/Top/Max | Voice / 78 | 3 stronger gear/impact variants | deterministic | missing |
| `operative.bonus` | confirmed feature entry/bonus stance | Voice / 82 | 3 alert/gear variants | deterministic | missing |
| `operative.rage` | default-off, explicit permitted rage state only | Voice / 60 | Foley only, ≥6-round interval, no speech/player-directed hit | never replayed/restored | missing; production binding subject to human no-shame review |
| `operative.recover` | interrupt/error recovery | Voice / 25 | one soft cloth settle, suppressible | restore may use silent recovery | missing |

## 11. Loading, memory, and latency rules

Critical bank before first legal play:

- UI press/confirm/deny/error;
- confirmed Spin attack;
- reel motor and five stop variant pool;
- regular/high/WILD/BREACH land minimum set;
- micro/small win and neutral loss;
- Base ambience.

Lazy bank, but mandatory before direct/restore feature playback:

- six vault locks, wheel, pressure, bolts, door/impact, gold, camera, handoff;
- BLACKOUT ambience/music;
- expansion and feature summary;
- Big/Top/Max and operative bonus banks.

Targets:

- audible UI p95 ≤50 ms desktop and ≤80 ms representative phone;
- audio/visible impact alignment within ±16.7 ms at 60 FPS;
- audio runtime total ≤8 MiB; critical decoded bank ≤1.5 MiB transfer budget;
- no unbounded decoded buffer, node, or media-element growth over 100 spins;
- old-mobile audio lag/quality is a real-device/manual gate.

## 12. Mute, visibility, replay, and restore acceptance

- One visible accessible mute control affects all six buses immediately and persists after reload.
- Browser audio begins only after a legal user activation. A denied unlock fails silently and retries only on a later legal activation.
- Hidden tab suspends loops and stops expendable one-shots; visible tab restores exactly one correct Base or BLACKOUT loop set.
- Replay respects the persisted sound setting, uses deterministic variants, and Play Again does not accumulate nodes/listeners.
- Restore never replays consumed reel stops, wins, loss, BREACH, vault markers, or award. If the cursor resumes inside a sustained context, start only the correct loop/stable phase.
- Turbo replaces or shortens attacks/tails; it does not machine-gun layer stops or remove result-critical transients.
- Skip fades current vault layers, suppresses skipped phase one-shots, and emits only the exact final door/gold/award handoff needed to reach the shared final state.

## 13. Coverage gaps and gate result

Current audit evidence: `qa/blacksite-breach/2026-08-20-cycle-01/audio-event-map.json` and `audio-license-ledger.csv`.

Open implementation blockers include:

- only three runtime MP3 files for the entire experience;
- no complete six-bus graph or bus-specific mute/ducking;
- no bounded voice stealing or decoded-bank lifecycle;
- no deterministic `roundId/eventIndex/cueId/ordinal` variant key;
- incomplete UI, reel, symbol, win-tier, vault, environment, and operative coverage;
- current confirmed-spin cue is emitted before authoritative confirmation;
- restore/replay can re-emit result one-shots;
- orphaned legacy vault recipes;
- archived source-byte and final-use rights evidence remains incomplete for current CC0 derivatives.

Therefore the **Audio Design Lock is PASS**, but **V28 runtime audio coverage remains FAIL** until all required non-N/A rows have an approved local asset/recipe, event binding, rights row, hash chain, and exact-browser evidence.
