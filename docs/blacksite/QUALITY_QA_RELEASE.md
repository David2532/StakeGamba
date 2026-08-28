# BLACKSITE — Quality, QA & Release Standard

Owners: `qa_director`, Stake Compliance  
Co-owners: every discipline

Goal: create an approval candidate that is not merely plausible from source code but proven from the exact frontend/math packages that would be submitted.

## 1. QA philosophy

Match the test to the claim.

Examples:
- currency claim → assert rendered currency string in browser;
- RGS claim → assert request URL/body/count/order;
- mobile claim → assert geometry + screenshot + clickability at real viewport;
- rules claim → compare visible values to candidate math/config;
- package claim → extract exact archive and test it;
- external approval claim → require Stake/ACP/Slack evidence.

Large test counts do not substitute for requirement-level evidence.

## 2. Test layers

### L0 — static/schema
- lint/type/build;
- forbidden terms;
- external URL scan;
- asset existence;
- manifest/schema validation;
- mode ID equality;
- math package structure.

### L1 — unit/contract
- money formatting;
- mode/cost mapping;
- event schema;
- payout/rules contract;
- math/book/lookup contract;
- confirmation state machines.

### L2 — browser E2E
- RGS flows;
- controls;
- viewport behaviour;
- replay;
- restore;
- Social Mode;
- currency precision;
- animations/fixtures;
- rules and dialogs.

### L3 — exact package
- regenerate frontend/math;
- compute hashes;
- extract/copy into clean test environment;
- rerun required static + browser + math checks against those bytes.

### L4 — manual visual/device
- Creative Director review;
- old mobile devices/device farm;
- sound/music quality;
- game tile preview;
- animation polish;
- Popout S/L usability.

### L5 — external lifecycle
- Stake Front approval;
- Stake Math approval;
- Provably Fair enabled;
- Replay enabled;
- approved Slack channel post;
- live verification;
- close approval request / Slack reaction workflow.

## 3. Deterministic visual fixture matrix

Every fixture runs where applicable across:
- desktop 1920×1080;
- desktop/laptop constrained height;
- 390×844 portrait;
- smaller older-phone portrait target;
- mobile landscape;
- tablet;
- Popout S;
- Popout L.

Required fixtures:
- boot intro full;
- boot intro skip;
- idle;
- zero win;
- small win;
- medium win;
- big win;
- five-win rule cases per mode;
- 3/4/5-symbol line wins and simultaneous winning lines;
- feature tease;
- feature trigger;
- bonus entry;
- bonus representative win;
- max win;
- insufficient balance;
- confirmation modal;
- rules/game info;
- replay loading/ready/playing/completed;
- active-round restore;
- Social Mode;
- fractional/sub-cent currency;
- missing animation asset fallback;
- turbo versions of result-critical states.

## 4. Geometry assertions

At minimum assert:
- document has no unintended scrollbars;
- game stage/background covers expected viewport;
- board rectangle remains on-screen and above minimum readable dimensions;
- required controls are fully inside viewport/safe-area;
- touch controls meet project minimum target size;
- spin/play control can be hit using `elementFromPoint` or equivalent physical-position assertion;
- modals fit/scroll internally without moving main frame;
- Popout does not distort board aspect/layout;
- character/effects do not cover required controls/result information.

## 5. RGS network proof

For each flow capture:
- request endpoint;
- method;
- body fields;
- count;
- order;
- relevant response fixture;
- unexpected network calls.

Release blocker examples:
- play before authenticate;
- duplicate play on restore;
- play on insufficient balance;
- replay making wallet calls;
- external asset/font requests;
- end-round call inconsistent with authoritative round lifecycle.

## 6. Currency matrix

Test at least representative families:
- standard 2-decimal fiat;
- zero-decimal fiat;
- currencies needing non-symbol code fallback;
- very small/sub-cent win values;
- XSC;
- XGC;
- any Stake-specific social token required by current RGS docs.

Separate assertions for:
- balance;
- base play amount;
- total play cost;
- floating win;
- WIN meter;
- confirmation modal;
- Replay play amount;
- Replay final win.

## 7. Language / Social Mode matrix

Normal mode:
- English complete;
- all implemented normal languages complete if project supports them;
- invalid language safe fallback.

Social Mode:
- approved English-only behaviour if required by current checklist;
- restricted-term scan across initial render, controls, rules, paytable, feature panel, confirmations, replay, errors and accessibility strings;
- SC/GC formatting;
- mode names and major-action text use social vocabulary.

## 8. Rules/paytable proof

Automated contract:
- mode names/cost/RTP/max win from exact math candidate;
- symbol payout table numeric equality;
- win mechanic thresholds/combinations;
- feature trigger/retrigger wording;
- disclaimer presence;
- user interaction guide completeness.

Five deterministic win books per mode are played and visually/contract checked against the rules.

## 9. Animation QA

For every semantic cue:
- starts when expected;
- finishes or times out safely;
- cleanup leaves valid next state;
- turbo path finishes;
- skip path finishes;
- asset missing path finishes;
- repeated replay does not accumulate listeners/tracks/particles;
- restore does not replay inappropriate intro/feature blockers;
- character state returns to a legal idle/feature stance.

Use browser timestamps/markers where useful but judge final motion visually too.

## 10. Performance / old mobile

Define a minimum supported real-device floor before M5.

Measure heavy fixtures:
- first interactive load;
- first legal play readiness;
- intro;
- line-heavy round with all eight free spins;
- bonus entry;
- max win;
- rules modal;
- replay.

Look for:
- long main-thread stalls;
- texture memory crashes;
- audio lag;
- filter/particle frame drops;
- viewport resize/orientation bugs;
- touch latency.

Desktop emulation alone cannot close checklist item 49.

## 11. Candidate generation

A candidate build produces:
- frontend upload package;
- math upload package;
- evidence bundle;
- candidate manifest.

Candidate manifest records:
- branch;
- exact git SHA;
- dirty/clean status;
- frontend archive hash;
- frontend tree/file hash set;
- math archive hash;
- math tree/file hash set;
- evidence hash;
- game ID/version;
- math version;
- canonical mode set;
- generation commands;
- tool/runtime versions where material;
- CI run IDs.

### BLACKSITE isolated technical package command

BLACKSITE must not use the repository `publish/` directory while that path remains the Golden Goal Rush upload target. Generate a new candidate directory outside the repository so the worktree stays clean and the two games cannot be confused:

```sh
pnpm --filter blacksite build
node scripts/blacksite-package-candidate.mjs \
  --output <new-candidate-directory> \
  --expected-commit <full-git-sha> \
  --expected-frontend-tree <sha256-from-the-fresh-build-evidence>
node scripts/blacksite-package-verify.mjs \
  --candidate <new-candidate-directory> \
  --write-result
```

The generated `frontend/` folder is the exact copied static build. The generated `math/` folder contains exactly the current official minimal payload: root `index.json`, three referenced lookup CSV files and three referenced zstd JSONL books. `game_config.json`, audits, manifests and browser evidence remain adjacent evidence rather than math-upload bytes.

For exact-folder browser proof, invoke the harness directly without another Vite build:

```sh
BLACKSITE_QA_BUILD_ROOT=<new-candidate-directory>/frontend \
BLACKSITE_QA_EXPECTED_BUILD_TREE_SHA256=<frontend-tree-sha256> \
node scripts/blacksite-qa-e2e.mjs
```

The packager requires a clean worktree, a caller-pinned full commit SHA and a caller-pinned frontend tree SHA. It verifies all seven canonical math inputs against the retained M1 `CANDIDATE_MANIFEST.json`, refuses to overwrite an existing target and writes `uploadAuthorized: false`. Producing these folders is package evidence only; BLACKSITE remains non-submission-ready while production art, Spine, audio, manual device/visual review or external Stake gates are open.

### V19 isolated package contract

V19 uses the stricter versioned contract in `V19_PACKAGING_EVIDENCE.md` and `V19_PACKAGE_CONTRACT.json`. It pins commit `1edbc06c699bd6f1bbbd248cc16ac0c5dbe1ed94` as the V18 source baseline, requires V19 math to remain byte-identical to the V18 math upload tree, leaves the V19 frontend hash unbound until the final fresh build and writes only the exact sibling roots `BLACKSITE_FRONTEND_UPLOAD_V19`, `BLACKSITE_MATH_UPLOAD_V19` and `BLACKSITE_V19_EVIDENCE`.

The V19 package verifier can return only `PASS_PACKAGE_IDENTITY_ONLY`. Manual, extracted-browser and external gates remain explicitly open/pending, and `releaseReady` plus `uploadAuthorized` remain false.

## 12. Clean regeneration gate

To detect stale generated outputs:
1. start from clean checkout of candidate SHA;
2. install frozen dependencies;
3. regenerate required math/frontend artifacts according to candidate policy;
4. compare expected canonical output identity;
5. build upload packages;
6. extract packages;
7. rerun required QA against extracted bytes;
8. verify hashes/manifests/evidence point to those packages.

If clean regeneration cannot complete, candidate cannot advance even if an earlier local run passed.

## 13. Superseded artifact handling

When a candidate changes:
- mark all older hashes/packages superseded;
- exclude/archive them outside the canonical upload selection path;
- documentation and PR body point only to current candidate;
- upload runbook rejects stale candidate identity.

## 14. CI truth rules

Required CI job states:
- success = gate satisfied;
- failure = blocked;
- cancelled/skipped = blocked until rerun, unless job is explicitly non-required and documented;
- provider outage = external infrastructure blocker, not repository PASS.

No “repository assertions did not fail before cancellation” shortcut.

## 15. Manual visual review

Human review of exact extracted frontend covers:
- title/branding originality;
- desktop composition;
- portrait mobile;
- landscape;
- Popout;
- game tile assets;
- rules readability;
- character animation;
- spin/reveal/line-win/free-spin timing;
- feature transition;
- big/max win;
- sound/mute;
- Social Mode visible text;
- Replay.

Review record references exact frontend/math hashes.

## 16. Release lifecycle

### `DESIGNING`
Contracts not frozen.

### `MATH_CONTRACT_PENDING`
Mechanic exists but exact math/event contract is not stable.

### `IMPLEMENTING`
Core implementation in progress.

### `QA_BLOCKED`
At least one required repo-owned gate failing/unproven.

### `CANDIDATE_GENERATED`
Exact packages/hashes exist, but not yet fully reviewed.

### `MANUAL_REVIEW_REQUIRED`
Automated candidate gates pass; exact manual visual/device review still required.

### `STAKE_REVIEW_PENDING`
Internal candidate review complete and exact packages submitted externally.

### `APPROVED`
Only after external Front/Math/required Stake approval evidence exists.

### `RELEASED`
Only after live production availability is verified.

## 17. 51-point matrix integration

`STAKE_REQUIREMENTS_51.md` is the checklist source. QA tooling should eventually emit a machine-readable requirement evidence file keyed `01`–`51` with:
- status;
- evidence paths;
- tests;
- candidate SHA/hashes;
- external/manual flags.

No release summary may claim `51/51` unless every external/manual item is genuinely complete.

## 18. Candidate Definition of Done

Internal candidate can move to Stake review only when:
- all repo-owned checklist items pass;
- exact extracted frontend/math QA passes;
- exact candidate hashes are recorded;
- manual visual review passes;
- real/target old-device review passes or has explicit external plan if Stake permits;
- no placeholder/sample assets;
- no critical console/network errors;
- no unresolved math/RGS/replay contradiction;
- all external-only items remain accurately marked pending rather than faked green.
