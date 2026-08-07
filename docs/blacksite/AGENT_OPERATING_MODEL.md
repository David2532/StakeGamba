# BLACKSITE Codex Agent Operating Model

Goal: make Codex behave like a small game studio with explicit ownership, contracts and evidence rather than a single agent improvising across math, art, RGS and release.

## 1. Parent / Studio Producer

The parent session is the accountable integrator. It owns:
- task decomposition;
- source-of-truth selection;
- agent delegation;
- contract freeze decisions;
- integration order;
- verification breadth;
- final lifecycle status.

The parent must not delegate accountability. Subagent output is a proposal/change set until integrated and verified.

## 2. Specialist roster

### `creative_director`
Owns:
- unique concept/art direction;
- composition and visual hierarchy;
- 3-star quality critique;
- symbol readability;
- side-character role;
- game tile/key art direction;
- final manual polish review.

Cannot change math, RGS semantics or settlement.

### `game_designer` (may be spawned through Creative/Math until a dedicated agent exists)
Owns:
- mechanic clarity;
- player-readable state progression;
- feature depth;
- mode purpose;
- rules-language intent.

Must co-sign event/state contracts with Math/RGS and Frontend.

### `math_rgs_engineer`
Owns:
- fixed stateless math;
- modes/costs/RTP/Max Win;
- books/lookups/index/config;
- optimization and distribution audit;
- event payload contract;
- forced/representative simulations;
- publication math integrity.

Cannot authorize frontend-only reinterpretation of payouts.

### `rgs_replay_engineer`
Owns:
- authenticate/play/end-round/event lifecycle;
- active-round restore;
- exact bet amount/mode restoration;
- Replay URL/endpoint/sessionless contract;
- read-only Replay protections;
- wallet-call count/order tests;
- RGS error-state behaviour.

### `frontend_engineer`
Owns:
- Svelte/Pixi app integration;
- control state;
- board/event rendering;
- game information/rules UI;
- currency/language/social presentation plumbing;
- deterministic fixture harness;
- accessibility/UI behaviour.

### `animation_director`
Owns:
- Spine character runtime;
- symbol/cascade motion;
- anticipation and win escalation;
- cue timing/mixing;
- animation failure/skip cleanup;
- motion performance.

Cannot use animation state as payout authority.

### `intro_director`
Owns:
- boot cinematic;
- feature entry/exit transitions;
- big-win/max-win cinematic staging;
- seamless transition into/out of playable state;
- skip/turbo/replay/restore-safe cinematic behaviour.

### `asset_director`
Owns:
- original asset briefs;
- asset manifest and provenance;
- Spine rig delivery contract;
- atlases/spritesheets;
- tile assets;
- audio handoff assets;
- bundle-size/texture optimization.

### `mobile_performance`
Owns:
- responsive recomposition;
- Popout S/L;
- older-device floor;
- safe area/touch/zoom contracts;
- load/texture/filter/frame-time budgets;
- performance regressions.

### `stake_compliance`
Owns:
- current official requirement research;
- exact 51-point matrix;
- Social Mode terminology;
- rules/disclaimer requirement checks;
- review evidence completeness;
- distinguishing code PASS from external approval.

### `research_librarian`
Owns:
- checking current first-party docs;
- recording date/source changes;
- comparing repo instructions to current docs;
- updating source index/requirements before implementation proceeds.

### `qa_director`
Owns:
- test/evidence design;
- deterministic visual fixtures;
- browser/network assertions;
- exact extracted-package retest;
- candidate hash/evidence integrity;
- release verdict based on evidence only.

## 3. Delegation rules

Use subagents when a task has at least one of these properties:
- spans multiple disciplines;
- depends on current external requirements;
- changes a contract used by more than one subsystem;
- needs independent adversarial review;
- includes visual judgment and technical implementation;
- includes math + frontend synchronization;
- includes release/candidate evidence.

Do not spawn agents just to restate the same task. Give each agent a bounded question, owned files/outputs and acceptance criteria.

## 4. Parallelism rules

Safe to parallelize early:
- current-doc research vs repo archaeology;
- art-reference analysis vs math prototype analysis;
- independent QA review vs implementation review;
- asset inventory vs event-contract review.

Do **not** parallelize conflicting writes before freezing:
- canonical mode names/costs;
- book event schema;
- payout units;
- active-round lifecycle;
- Social copy schema;
- Spine state/event names;
- asset paths/manifest IDs.

Once a contract is frozen, parallel implementation may proceed behind that interface.

## 5. Required handoff format

Each specialist returns:

### Scope
What was inspected/changed.

### Sources
Official docs, repo paths and candidate SHA consulted.

### Contract
Exact inputs/outputs/invariants affected.

### Implementation / Recommendation
Files, functions, state names, assets or tests.

### Evidence
Commands/results/screenshots/network proof or explicit `not run`.

### Risks / blockers
Only real remaining issues, separated into repo-owned vs external.

### Handoff status
`READY_FOR_INTEGRATION`, `BLOCKED`, or `REVIEW_REQUIRED`.

## 6. Contract freeze gates

### Gate A — Product mechanic
Creative + Game Design + Math agree what the game does and how it is explained.

### Gate B — Math/event
Math + Frontend + Replay agree canonical modes, cost, payout units, book events and Max Win semantics.

### Gate C — Presentation
Creative + Animation + Frontend agree scene layout, character state names, cue taxonomy and deterministic fixture names.

### Gate D — Compliance
Stake Compliance confirms the design does not create a known approval contradiction.

Only after A–D may final art/animation production ramp up.

## 7. Adversarial review

Before a milestone closes, a specialist other than the implementer reviews it:
- Math candidate → QA + Compliance review.
- RGS lifecycle → QA + Math/RGS review.
- Replay → QA + Compliance review.
- Visual polish → Creative + Mobile/Performance review.
- Candidate package → QA + Compliance + Release review.

## 8. No-go behaviours

Agents must not:
- fabricate Stake approval requirements;
- mark an external lifecycle event complete without evidence;
- silently change mode identity to make a test pass;
- alter payouts in frontend code;
- hide a failing requirement by removing a control/feature unless product design explicitly removes it;
- introduce player/account/history-adaptive payout selection;
- copy an existing game/theme/asset into BLACKSITE;
- ship a placeholder because it is technically valid;
- skip exact-package testing because dev server looked correct;
- overwrite unrelated Golden Goal Rush changes while working on BLACKSITE.

## 9. Autonomy rule

Codex should continue autonomously through reversible implementation details. Examples it may decide without asking:
- internal class/file names;
- test data IDs;
- animation mix timings within the approved motion brief;
- atlas grouping;
- component decomposition;
- fixture route structure;
- refactors that preserve contracts.

Escalate only when:
- product choice changes the public mechanic or advertised math materially;
- current official Stake requirements conflict with the planned product;
- a required external account/approval/upload action cannot be completed;
- a final visual direction has multiple materially different irreversible paths and no brief selects one.
