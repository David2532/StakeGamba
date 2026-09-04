# BLACKSITE // BREACH — Manual Device QA Handoff

- Contract: `blacksite-device-qa-contract-v3`
- Evidence schema: `blacksite-device-qa-evidence-v3`
- Owner-review schema: `blacksite-device-qa-owner-review-v1`
- Proposed floor: `blacksite-old-device-floor-proposed-v1`
- Status: **repository-defined collection protocol; no physical-device result or approval is claimed**

This runbook turns the remaining device, Popout, audio, pacing, memory, thermal, battery, touch and assistive-technology work into a candidate-bound handoff. It does not replace the people, physical hardware, real Stake container, RGS environment or final assets needed to perform that work.

The validator proves only that a record is structurally complete, fresh, independently identity-bound, that the exact input JSON bytes are identified, and that every referenced attachment matches its recorded byte count, SHA-256, minimum size and declared media signature. `STRUCTURALLY_COMPLETE` does not mean the observations passed, that operator/provider assertions are true, that the proposed floor is accepted, that checklist item 49 passed, or that a device/release owner approved the candidate.

## 1. Proposed old-device floor v1

This is the repository's first concrete collection floor. It is defined so testing can be scheduled and compared consistently; it is still a proposal until the Mobile/Performance, QA and release owners accept it. Merely naming these devices is not evidence that BLACKSITE works on them.

| Coverage          | Proposed physical floor                                                                                                                        | Required runtime                                                | Why this floor                                                                            |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| iOS old floor     | Apple iPhone X, A11 Bionic, 3 GB RAM, local hardware or identified remote physical-device-farm session                                         | iOS 16.7.x, exact installed Mobile Safari/WebKit build recorded | Old A11-class hardware plus a real inset display for portrait/landscape safe-area review. |
| Android old floor | Motorola Moto G7 Power (XT1955 family), Snapdragon 632, Adreno 506, 3 GB RAM, local hardware or identified remote physical-device-farm session | Android 10, exact installed Chrome/Blink build recorded         | Representative older mid/low-tier Android CPU, GPU and memory envelope.                   |
| Popout S          | A physical desktop/laptop running the exact candidate in the real Stake Popout S container                                                     | Exact OS, browser and observed Stake container version recorded | Browser viewport emulation is not real Popout evidence.                                   |
| Popout L          | A physical desktop/laptop running the exact candidate in the real Stake Popout L container                                                     | Exact OS, browser and observed Stake container version recorded | S and L are distinct coverage records even when one machine performs both.                |

For `AT_PROPOSED_FLOOR`, the validator requires the canonical model identifier family, chipset, CPU architecture, GPU, RAM, OS family/version and browser engine shown above. This prevents a stronger phone from being labeled as the exact proposed floor, but the entered facts remain operator/provider-supplied metadata rather than hardware attestation. A device-farm run additionally records the provider and session ID and must identify the allocated target as `PROVIDER_ASSERTED_PHYSICAL`; the validator does not independently prove the provider allocated physical rather than virtual hardware.

If an exact floor device is unavailable, the device owner records `BELOW_PROPOSED_FLOOR` or `ABOVE_PROPOSED_FLOOR` and explains the substitution in environment notes. Those relations are explicit operator assertions. “Below” means the owner determined that the substitute is no stronger in the material CPU/GPU/RAM constraints and no newer in the relevant OS/browser compatibility boundary. An above-floor run is useful regression evidence but cannot close the proposed old-device floor. The validator records the relation; it does not determine hardware equivalence.

Changing a device, OS family, required scenario or freshness rule creates a new floor/contract version. Patch-version changes and exact browser builds are recorded in each evidence record rather than silently changing this document.

## 2. Owners and external inputs

| Input or decision                                                          | Required owner                | Repository can prepare it? |             Repository can complete it? |
| -------------------------------------------------------------------------- | ----------------------------- | -------------------------: | --------------------------------------: |
| Exact frontend/math candidate and four identity values                     | Release manager               |                        Yes |                                     Yes |
| Physical iPhone and Android access, local or accepted physical-device farm | Device QA owner               |                         No |                                      No |
| Real Stake Popout S/L launch access                                        | Stake/release owner           |                         No |                                      No |
| Real RGS test session and safe test balance                                | RGS/release owner             |                         No |                                      No |
| Deterministic fixture/replay identifiers for the exact math version        | Math/RGS owner                |                        Yes | Owner must provision usable URLs/events |
| Final audio assets, rights and approved mix                                | Audio/Creative/rights owners  |                     Partly |                                      No |
| VoiceOver/TalkBack operation and judgment                                  | Accessibility/device operator |             Procedure only |                                      No |
| Device evidence review and checklist decision                              | QA/release owner              |                Schema only |                                      No |

Missing external inputs are recorded as `NOT_RUN` with a named blocker owner and concrete next action. Do not invent a PASS from Chromium emulation, source inspection, procedural placeholder audio, a mock RGS, or an unavailable Stake container.

The repository unit-tests the hidden-document intro decision and verifies its production page wiring. A native background/foreground transition is still an observed-browser behavior: record it during `load-and-readiness` on the physical mobile and real Popout environments. Headless focus emulation is supporting automation, not evidence that a real page became hidden.

## 3. Freeze the candidate before testing

1. Generate and verify the isolated candidate using `QUALITY_QA_RELEASE.md`.
2. Read the following values from the retained candidate manifest and exact math evidence:
   - full 40-character Git SHA;
   - frontend tree SHA-256;
   - math tree SHA-256;
   - math candidate fingerprint SHA-256.
3. Copy `DEVICE_QA_EVIDENCE.template.json` outside the source tree into the evidence working directory. The checked-in template is deliberately stale and contains `REPLACE` values; it must not validate unchanged.
4. Create a new, ordinary attachment directory. Do not use symlinks. Store the actual screenshots, videos, traces, logs, audio recordings and device reports referenced by the record beneath that directory.
5. Supply the four expected identity values independently on the validator command line. Copying self-asserted values only from the manual record defeats the identity check.

Any frontend source, math package, runtime asset, final audio, environment configuration that affects behavior, or candidate hash change invalidates the record and requires a new run. A browser/OS update requires a new environment record and rerun of that environment.

## 4. Record the environment before launch

An unavailable environment starts with `provenance.observation: NOT_OBSERVED`, `provenance.verification: UNVERIFIED`, `executionMode: NOT_EXECUTED` and `device.physical: NOT_OBSERVED`. Its mobile floor relation is `NOT_OBSERVED`; an unavailable Popout record uses `stakeContainer.source: NOT_OBSERVED`. These are planning records, not statements that the hardware or Stake container was seen.

After at least one scenario actually executes, change the environment to `provenance.observation: OPERATOR_REPORTED` while leaving `provenance.verification: UNVERIFIED`. Then record all schema fields from the device itself, the identified physical-device-farm session or authoritative system settings:

- manufacturer, commercial model and model identifier;
- chipset, CPU architecture, GPU and physical RAM;
- exact OS version/build and browser version/engine;
- measured CSS viewport and device-pixel ratio;
- connection kind and an identifying description of the network conditions;
- device condition, battery health/power mode and relevant background-process setup in notes;
- exact VoiceOver or TalkBack version/source on mobile;
- exact real Stake Popout size, version/source and launch context for Popout;
- for `DEVICE_FARM`, the named provider, unique session ID and provider assertion that the allocated target was physical hardware.

Use `executionMode: PHYSICAL_DEVICE` plus `device.physical: OPERATOR_ASSERTED_PHYSICAL` for locally operated mobile hardware. Use `executionMode: DEVICE_FARM` plus `device.physical: PROVIDER_ASSERTED_PHYSICAL` for a named remote physical-device session. Use `executionMode: REAL_STAKE_POPOUT`, `device.physical: OPERATOR_ASSERTED_PHYSICAL` and `stakeContainer.source: OPERATOR_ASSERTED_REAL_STAKE` only after using the real Stake container on actual workstation hardware. The validator conditions these assertions on at least one executed `PASS` or `FAIL`, but it cannot detect an emulator, attest the hardware, authenticate Stake provenance or prove who entered them. Owner review must corroborate them against scoped captures, provider exports and external launch records. Disable developer overrides that alter viewport, DPR or CPU speed. Record whether Low Power/Battery Saver, reduced motion, data saver or browser content blockers are enabled; use the agreed normal-user baseline unless a scenario specifically varies it.

## 5. Status and attachment rules

Every required environment/scenario pair has exactly one result:

- `PASS`: the operator executed the procedure and observed every stated acceptance condition.
- `FAIL`: the operator executed it and observed a defect or threshold breach.
- `NOT_RUN`: it was not executed; `observedAt` is exactly `NOT_OBSERVED`, `attachmentIds` is empty, no `measurement` is allowed, and `blocker.reason`, `blocker.owner` and `blocker.nextAction` are mandatory.

Both `PASS` and `FAIL` require `observedAt`, a structured `measurement` interval and scenario-appropriate attachments. A `NOT_RUN` result remains an open gate even though a complete record containing it may validate structurally. It must not point at broad sequence evidence merely because another scenario ran. A record containing `FAIL` likewise remains structurally valid and release-blocking.

Each attachment is declared once at top level and referenced by ID from one or more results. Record:

- the exact `environmentId` and `operatorId` responsible for capture;
- `captureScope: SCENARIO` with one declared scenario, or `ENVIRONMENT_SEQUENCE` with every scenario visible in a continuous environment-specific capture;
- explicit `scenarioIds` that the attachment supports;
- a normalized relative path below the attachment root;
- evidence kind and media type;
- exact non-zero byte count;
- lowercase SHA-256 of the actual bytes;
- capture timestamp inside the run interval.

Every `PASS`/`FAIL` result may reference only attachments whose environment, operator and declared scenario match that result. Cross-environment reuse is forbidden, including copying identical bytes under another ID/path. A declared scenario must reference the attachment back; broad, generic files cannot silently close unrelated rows. The validator also enforces sensible kind/media pairs (for example, screenshots are image media and audio recordings are audio media).

`ENVIRONMENT_SEQUENCE` is reserved for continuous video; a log or one-line text file cannot claim an entire matrix. Each executed scenario must meet the following minimum evidence-kind groups. An “and” means separate referenced evidence kinds are required; one continuous video may cover several declared scenarios, but each scenario must reference it explicitly:

| Scenario family                                                                  | Minimum referenced kinds                  |
| -------------------------------------------------------------------------------- | ----------------------------------------- |
| Load/readiness                                                                   | video **and** trace, log or device report |
| Live play and Replay                                                             | video **and** trace or log                |
| Heavy cascade                                                                    | video **and** trace or device report      |
| Audio/mute/resume                                                                | video **and** audio recording             |
| Memory, thermal and battery                                                      | video **and** trace or device report      |
| BLACKOUT, feature, max win, orientation, touch, dialogs and assistive technology | video                                     |
| Safe areas and Popout layout                                                     | screenshot or video                       |

The validator rejects implausibly tiny files by kind, narrows video/audio types to supported capture formats, checks common image/video/audio magic bytes, and rejects missing files, traversal, symlinks, byte-count differences, digest differences, cross-environment digest reuse, orphan attachments, unresolved references and placeholder hashes. These checks prevent obvious mislabeled text receipts; they still do not judge the visual/audio contents. Preserve original files; transcoding, editing or metadata stripping changes the digest.

## 6. Required scenario matrix

The minimum record contains 54 results: 16 on the iOS floor, 16 on the Android floor, 11 in Popout S and 11 in Popout L. Additional environments are allowed, but each additional environment must complete its full applicable matrix.

| Scenario                 | iOS | Android | Popout S/L | Procedure and minimum observations                                                                                                                                                                                                                                                                             |
| ------------------------ | :-: | :-----: | :--------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `load-and-readiness`     | Yes |   Yes   |    Yes     | Cold-load the exact candidate. Record start, first responsive UI, authenticate completion and first legal play readiness. Include one delayed-auth launch backgrounded before authentication resolves; confirm the intro stays absent while hidden, readiness recovers on foreground, and no seen-version is persisted for an intro that never played. Capture timing source/method, errors, broken assets and whether interaction was possible before final paint. |
| `live-play`              | Yes |   Yes   |    Yes     | Use the real approved RGS test launch. Make a deliberate base play, confirm one request/response and authoritative result, then exercise a second legal play. Mock play is not evidence.                                                                                                                       |
| `heavy-cascade`          | Yes |   Yes   |    Yes     | Run the retained cascade-heavy deterministic case. Observe burst pacing, input lock/recovery, board readability, long stalls, audio sync and final result.                                                                                                                                                     |
| `blackout-mode`          | Yes |   Yes   |    Yes     | Run the retained BLACKOUT case through confirmation, presentation, settlement and return to idle. Observe peak effects and readability.                                                                                                                                                                        |
| `feature-entry-and-play` | Yes |   Yes   |    Yes     | Run feature trigger, entry, feature play/checkpoints, completion and return. Exercise skip/turbo where permitted without changing the authoritative result.                                                                                                                                                    |
| `max-win`                | Yes |   Yes   |    Yes     | Run the exact max-win fixture through the full and skip paths. Confirm controls remain usable, final amount remains visible/exact and no crash or runaway effect persists.                                                                                                                                     |
| `replay`                 | Yes |   Yes   |    Yes     | Open an exact candidate Replay URL for feature/max evidence, complete it, select Play Again and confirm identical read-only presentation with no authentication or wallet mutation.                                                                                                                            |
| `orientation`            | Yes |   Yes   |     No     | Rotate portrait → landscape → portrait during idle and after a heavy presentation. Confirm layout/assets recover, board is square, dialogs remain reachable and state/result are preserved.                                                                                                                    |
| `safe-areas`             | Yes |   Yes   |     No     | Inspect every physical inset/cutout/system-bar edge in portrait and landscape. Confirm board, balances, result and controls do not enter protected areas or become obscured.                                                                                                                                   |
| `touch`                  | Yes |   Yes   |     No     | Physically operate every visible control. Confirm intended target activates once, adjacent targets do not activate, holding/double-tapping does not place unintended bets, and normal response has no material lag.                                                                                            |
| `dialog-zoom-and-scroll` | Yes |   Yes   |    Yes     | Open Game Information, confirmation and error dialogs. Confirm internal scroll reaches all content; unintended double-tap zoom is absent; legitimate platform accessibility zoom/browser zoom remains operable and does not trap the user.                                                                     |
| `mute-resume-and-audio`  | Yes |   Yes   |    Yes     | With final candidate audio, listen across base, cascade, feature and max win. Toggle mute during active voices, background/foreground or visibility-resume the app, and check all cues/music for orphan voices, onset lag, crackle and clipping. Placeholder/procedural audio cannot close final audio review. |
| `memory-pressure`        | Yes |   Yes   |    Yes     | Repeat the load → cascade → BLACKOUT → feature → max → Replay sequence at least three times. Capture available profiler/device reports and note reloads, crashes, warnings, monotonic growth or degraded recovery.                                                                                             |
| `thermal`                | Yes |   Yes   |     No     | From a recorded starting state, run a mixed heavy sequence for at least 20 minutes without external power. Record duration, device-reported/observed thermal state, throttling and pacing change.                                                                                                              |
| `battery`                | Yes |   Yes   |     No     | During the same controlled unplugged run, record start/end percentage, duration, brightness and radios. This is an observation, not a universal battery-life claim.                                                                                                                                            |
| `voiceover`              | Yes |   No    |     No     | Enable VoiceOver. Traverse launch, main controls, Game Information, confirmation, one play/result and Replay. Judge order, roles, labels, announcements, modal isolation and operation without sight.                                                                                                          |
| `talkback`               | No  |   Yes   |     No     | Enable TalkBack and perform the equivalent launch, controls, dialogs, play/result and Replay procedure.                                                                                                                                                                                                        |
| `popout-layout`          | No  |   No    |    Yes     | Use the real Stake S or L container, including its practical resize limits. Confirm no document scrollbars, distortion, crop, overlay collision or unreadable result/control. Capture the container chrome and content together.                                                                               |

“Deterministic case” means the exact retained event/fixture for this candidate. Record the fixture or replay identifier in `result.fixture`. If the candidate cannot expose that case on the physical environment without a mock or source change, record `NOT_RUN` and assign provisioning to the Math/RGS/release owner.

Every executed result records `measurement.startedAt`, `measurement.completedAt`, an exact matching positive `durationSeconds` and the measurement `method`. The measured interval must sit inside the overall run and contain `observedAt`. In addition:

- `memory-pressure` requires `cycles >= 3`;
- `thermal` requires at least 1,200 seconds, `poweredExternally: false`, and starting/ending thermal states;
- `battery` requires at least 1,200 seconds, `poweredExternally: false`, starting/ending battery percentages, brightness percentage and active radio states.

Narrative notes cannot substitute for these fields. The validator checks structure and arithmetic; it does not attest that a timer, battery reading or device status was honestly observed.

## 7. Execute and capture

1. Start screen/video capture early enough to include the candidate identity or launch reference and environment chrome.
2. Run the scenarios in the table. Do not reuse an observation from a different environment or candidate.
3. For performance observations, retain raw trace/device exports when available, not only a screenshot of a summary.
4. For memory, thermal and battery, preserve the starting and ending readings plus elapsed time and test conditions.
5. For audio, capture a recording when policy permits, but keep the named human listening notes; a waveform or automated peak scan is not final listening approval.
6. For accessibility, record the actual assistive technology and navigation observations. A DOM audit or keyboard-only run is supporting evidence, not VoiceOver/TalkBack evidence.
7. Write concise factual notes. Do not use “looks good” without the tested behavior and observed result.
8. Mark defects `FAIL`; do not convert them to `PASS` because an issue is filed. Mark unavailable work `NOT_RUN` and name the owner.

## 8. Validate the handoff

Run the standalone validator from the repository root. It is intentionally not a release-approval command:

```sh
node scripts/blacksite-device-evidence.mjs \
  --evidence /absolute/path/to/device-evidence.json \
  --attachments-root /absolute/path/to/device-attachments \
  --expected-git-sha <full-git-sha> \
  --expected-frontend-tree <frontend-tree-sha256> \
  --expected-math-tree <math-tree-sha256> \
  --expected-math-fingerprint <math-candidate-fingerprint-sha256>
```

The validator rejects evidence completed more than 30 days before validation and timestamps more than five minutes in the future. Run dates must be explicit ISO-8601 timestamps with a UTC offset, and every result/attachment timestamp must fall inside the run interval.

The standalone CLI reads and hashes the exact evidence file bytes, including whitespace and the final newline. Direct module callers that do not provide source bytes receive an explicitly labeled `CANONICAL_JSON_VALUE` digest instead; they must not represent it as exact-file readback.

A successful report has:

- `status: STRUCTURALLY_COMPLETE`;
- `verifiedAt` plus the exact evidence JSON byte count and SHA-256 (`EXACT_SOURCE_BYTES` from the standalone CLI);
- a result outcome that separately counts operator-reported `PASS`, `FAIL` and `NOT_RUN` values; an all-green record says `ALL_RESULTS_REPORTED_PASS_PENDING_OWNER_REVIEW`;
- attachment readback `BYTES_AND_SHA256_VERIFIED`;
- per-attachment readback identities containing environment, operator, declared scenarios, bytes and SHA-256;
- `oldDeviceFloor.proof: NOT_CLAIMED`;
- `deviceApproval: NOT_CLAIMED` and `releaseApproval: NOT_CLAIMED`;
- `manualReviewRequired: true`.

An all-`NOT_RUN` record remains structurally recordable and reports `ALL_RESULTS_NOT_RUN`, `oldDeviceFloor.coverage: NOT_OBSERVED` and `attachments.readback: NO_EXECUTED_RESULTS_NO_ATTACHMENTS`. It must not carry physical, device-farm or real-Stake execution assertions. Do not rename structural success—or the operator-reported all-green outcome—to checklist PASS in another report.

## 9. Separate signed owner decision

After reviewing the exact evidence JSON and all attachments, the authorized QA/release owner may create `DEVICE_QA_OWNER_REVIEW.template.json` against `DEVICE_QA_OWNER_REVIEW.schema.json`. This is a separate record, not a field CI can add to the observation record. It binds:

- the exact evidence JSON byte count and SHA-256;
- the evidence record ID and four candidate identity values;
- the named reviewer, decision, timestamp, scope and notes;
- the reviewer's Ed25519 key ID and SPKI SHA-256;
- `stakeApproval: NOT_CLAIMED` and `releaseApproval: NOT_CLAIMED`.

Sign the UTF-8 canonical JSON value formed by recursively sorting object keys and retaining every owner-review field except `signature.valueBase64`. The private key and authorization decision remain outside the repository. Supply the public key, reviewer ID and key ID independently when validating:

```sh
node scripts/blacksite-device-evidence.mjs \
  --owner-review /absolute/path/to/device-owner-review.json \
  --evidence /absolute/path/to/device-evidence.json \
  --attachments-root /absolute/path/to/device-attachments \
  --reviewer-public-key /absolute/path/to/reviewer-ed25519-public.pem \
  --expected-reviewer-id <trusted-reviewer-id> \
  --expected-reviewer-key-id <trusted-key-id> \
  --expected-git-sha <full-git-sha> \
  --expected-frontend-tree <frontend-tree-sha256> \
  --expected-math-tree <math-tree-sha256> \
  --expected-math-fingerprint <math-candidate-fingerprint-sha256>
```

The owner-review verifier first revalidates the exact device record and attachments. `ACCEPTED` is rejected if any result is `FAIL`/`NOT_RUN` or mobile coverage is incomplete/above the proposed floor. A valid signature reports `SIGNED_OWNER_DECISION_VERIFIED`, but its trust anchor is explicitly caller-supplied: the machine does not establish organizational authority and never emits device, Stake or release approval.

## 10. Handoff contents

Deliver the following together without modifying their bytes:

1. completed evidence JSON;
2. complete attachment directory;
3. validator JSON output and command line used;
4. exact candidate manifest/package verification used for the four expected identity values;
5. open-defect list for every `FAIL`;
6. owner/action list for every `NOT_RUN`;
7. separate, exact-evidence-bound Ed25519 device-review decision and independently trusted public key when an authorized owner eventually makes one.

Repository CI may test the schema and validator. It must not fill observations, sign the manual decision, infer device approval from all-PASS results, or mark physical/external gates complete.
