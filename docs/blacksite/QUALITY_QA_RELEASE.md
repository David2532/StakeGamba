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
- 3/5 cascade sequences;
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
- cascade-heavy round;
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
- frontend tree/file hash set;
- math tree/file hash set;
- game ID/version;
- math version;
- canonical mode set;
- generation commands;
- tool/runtime versions where material;
- explicit `uploadAuthorized: false` and open production/manual/external boundaries.

After the exact packaged frontend browser run and 51-point resolver finish, the separate release-bundle manifest records:

- expected branch and full Git SHA plus CI run ID/attempt;
- clean tracked/index state, HEAD tree SHA and current-vs-HEAD blob identity for the checklist, evidence map, package verifier and both resolver/bundle generators;
- candidate-manifest, package-verification, checklist, source-map and compliance-evidence byte hashes and identities;
- frontend/math source tree manifests and deterministic transport archive SHA-256 values;
- the complete browser-run tree, every screenshot file and every screenshot reference with byte hashes;
- bundle generator script/version/runtime identity;
- explicit `NOT_CLAIMED` manual evidence, external approval, upload authorization and release readiness;
- separate open project blockers for production-equivalent scale/resilience, final assets/rights/Creative approval, approved Spine clips/real-device pacing and final audio/listening/device QA.

The evidence bundle also contains `blacksite-51-evidence.json`. Its source map must contain the canonical status class for exactly rows 1–51 in order and must bind the exact bytes of `STAKE_REQUIREMENTS_51.md`. CI independently reruns the resolver against the same candidate, package, checklist, map and green packaged-frontend run, then requires byte-for-structure equality apart from the retained generation timestamp. Rows marked manual or external remain explicitly open; matrix completeness is not release approval.

### BLACKSITE isolated technical package command

BLACKSITE must not use the repository `publish/` directory while that path remains the Golden Goal Rush upload target. Generate a new candidate directory outside the repository so the worktree stays clean and the two games cannot be confused:

```sh
pnpm --filter blacksite build
node scripts/blacksite-package-candidate.mjs \
  --output <new-candidate-directory> \
  --expected-branch <branch> \
  --expected-commit <full-git-sha> \
  --expected-frontend-tree <sha256-from-the-fresh-build-evidence>
node scripts/blacksite-package-verify.mjs \
  --candidate <new-candidate-directory> \
  --expected-branch <branch> \
  --write-result
```

The generated `frontend/` folder is the exact copied static build. The generated `math/` folder contains exactly the current official minimal payload: root `index.json`, three referenced lookup CSV files and three referenced zstd JSONL books. `game_config.json`, audits, manifests and browser evidence remain adjacent evidence rather than math-upload bytes.

For exact-folder browser proof, invoke the harness directly without another Vite build:

```sh
BLACKSITE_QA_BUILD_ROOT=<new-candidate-directory>/frontend \
BLACKSITE_QA_EXPECTED_BUILD_TREE_SHA256=<frontend-tree-sha256> \
node scripts/blacksite-qa-e2e.mjs
```

Resolve compliance first, then generate the post-QA bundle from the candidate commit with no tracked or index changes (untracked QA outputs are allowed). Repository-v2, Security-v2, the raw production audit JSON and its stderr diagnostics are mandatory explicit inputs. Both output parents must already be physical, non-symlink directories; both output targets must be new. The bundle command is Linux/GNU-tar only so owner/group, mode, ordering and timestamp metadata are deterministic without modifying the candidate. The following is the source-branch GitHub Actions sequence; the bundle CLI requires exact source-branch repository/workflow/job/ref/SHA/run environment metadata and rejects pull-request or tag metadata. Environment values are not cryptographic attestation: authenticating that the bundle came from the named GitHub run requires external verification of the uploaded artifact and run:

```sh
mkdir -p <compliance-output-parent> <bundle-output-parent>
node scripts/blacksite-compliance-evidence.mjs \
  --candidate <new-candidate-directory> \
  --browser-evidence <browser-run-directory>/blacksite-browser-evidence.json \
  --repository-evidence artifacts/blacksite-ci/repository-gates.json \
  --security-evidence artifacts/blacksite-security/security-evidence.json \
  --output <compliance-output-parent>/blacksite-51-evidence.json
node scripts/blacksite-release-bundle.mjs \
  --candidate <new-candidate-directory> \
  --browser-run <browser-run-directory> \
  --compliance-evidence <compliance-output-parent>/blacksite-51-evidence.json \
  --repository-evidence artifacts/blacksite-ci/repository-gates.json \
  --security-evidence artifacts/blacksite-security/security-evidence.json \
  --audit-report artifacts/blacksite-security/pnpm-audit.json \
  --audit-stderr artifacts/blacksite-security/pnpm-audit.stderr.txt \
  --output <bundle-output-parent>/<new-bundle-directory> \
  --expected-branch <branch> \
  --expected-commit <full-git-sha> \
  --ci-run-id <ci-run-id> \
  --ci-run-attempt <ci-run-attempt>
```

The v2 bundle contains `frontend.tar`, `math.tar`, the candidate/package/checklist/source-map/compliance receipts, the complete Browser-v2 run under its original `artifacts/blacksite-qa/<run>/` path, Repository-v2, Security-v2, the exact raw audit JSON, and audit stderr marked with no PASS semantics. It independently rebuilds Security-v2 from the current package manifests, lockfile, `.npmrc`, audit bytes and recorded exit code; rebuilds Repository-v2 from its exact eight inputs; and rebuilds Compliance-v3 with explicit repository/security paths. Those canonical repository source inputs are copied under `repository-inputs/`, with source-path-to-bundle-path facts; leading-dot paths are mapped to visible names (`.npmrc` → `npmrc`, `.github/` → `github/`) so upload-artifact's hidden-file default cannot silently remove them. It also requires the Browser-v2 build manifest to equal the packaged frontend tree byte for byte. The production path reruns the canonical 300,000-book package verifier while permitting only untracked QA artifacts; tracked or index changes still fail closed. `release-bundle-manifest.json` binds every copied input and archive digest. Repeating the command with identical inputs and CI identity into a different new output directory must produce byte-identical archives and manifest. In CI this finalized directory lives at `release-bundle/`; identity and candidate copies are staged only as siblings and never mutate the finalized bundle.

The resolver CLI reports `STRUCTURALLY_VALID` for exact repository-reference resolution, and the source-branch bundle CLI reports `EVIDENCE_BUNDLE_COMPLETE` for repository candidate/evidence integrity. Neither status is a release decision or an authenticated GitHub provenance claim; `githubActionsRunAuthenticity` remains `NOT_CLAIMED`. Manual evidence, production-equivalent capacity, external lifecycle work, upload authorization and release readiness remain separately `NOT_CLAIMED` or open. Physical-device coverage of all 54 Device-QA results, real Popout execution, assistive-technology review, native controls/console/chrome visibility, and named owner review remain an explicit manual/external project blocker; headless Chromium and proxy viewport evidence cannot close it.

The production frontend uses the exact full Git SHA as its SvelteKit build/recovery version; clean repeated builds of one commit must therefore produce the same byte-for-byte frontend tree. The packager requires a clean worktree, a caller-pinned non-empty branch, a caller-pinned full commit SHA and a caller-pinned frontend tree SHA. Detached CI checkouts retain the caller-pinned source branch in the manifest and verify it against GitHub's branch context. The packager verifies all seven canonical math inputs against the retained M1 `CANDIDATE_MANIFEST.json`, refuses to overwrite an existing target and writes `uploadAuthorized: false`. Producing these folders is package evidence only; BLACKSITE remains non-submission-ready while final asset rights/Creative approval, the penguin Spine rig, authored character/reel polish, the final audio mix, manual device/visual review or external Stake gates are open.

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
- spin/reveal/cascade timing;
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
- the exact candidate has accepted production-equivalent CDN/RGS/provider load, soak, fault, observability and rollback evidence under `BSB-SCALE-001`;
- manual visual review passes;
- real/target old-device review passes or has explicit external plan if Stake permits;
- final production assets, Spine clips and audio masters have rights, Creative and discipline-owner approval; no placeholder/sample assets remain;
- no critical console/network errors;
- no unresolved math/RGS/replay contradiction;
- all external-only items remain accurately marked pending rather than faked green.
