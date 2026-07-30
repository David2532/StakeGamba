# Stake compliance pipeline

Node version: package engine `>=22.16.0`. pnpm version: `10.5.0`. Browser dependency: Playwright Chromium via the repo Playwright install.

| Level | Stage | Purpose | Trigger | Commands | Outputs | Exit 0 | Non-zero causes | Skipping |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A | Static and installation gate | dependency and syntax baseline | PR/push/local | pnpm install; node --check scripts | node_modules and syntax pass | all installs/checks pass | install or syntax failure | not permitted in final |
| B | Lint gate | workspace lint | PR/push/local | npm run lint | lint report | no lint errors | lint error | not permitted |
| C | Build gate | workspace build | PR/push/local | npm run build | built packages | build succeeds | build failure | not permitted |
| D | Standard publish gate | frontend and reused math publish | Stake upload prep | npm run stake:publish | publish/frontend; publish/math | publish succeeds | missing artifacts or QA failure | not permitted |
| E | Full-math publish gate | regenerate books/lookups | math-affecting changes | npm run stake:publish:full-math | publish/math | math regeneration succeeds | generation or QA failure | permitted only for frontend-only changes |
| F | Math integrity gate | math consistency | publish/CI | node scripts/stake-qa.mjs paytable | paytable evidence | math values match | drift | not permitted |
| G | Paytable contract gate | visible paytable check | publish/CI | npm run stake:qa:paytable | screenshots and report | contract matches | visible drift | not permitted |
| H | Replay contract gate | schema and replay lifecycle | publish/CI | node scripts/stake-qa.mjs replay | replay reports | all replay checks pass | schema/UI/network failure | not permitted |
| I | RGS wallet lifecycle gate | auth/play/end-round | CI | npm run stake:qa | QA report | wallet flow passes | RGS lifecycle regression | not permitted |
| J | Interrupted-round gate | resume/settlement | CI | npm run stake:qa:interrupted-round | interrupted evidence | resume rules pass | duplicate charge or bad settlement | not permitted |
| K | Dynamic bet-configuration gate | auth bet settings | CI | npm run stake:qa | QA report | bet config matches RGS | static/local bet config leak | not permitted |
| L | Currency gate | formatting and symbols | CI | npm run stake:qa:currency | currency evidence | formats pass | bad currency display | not permitted |
| M | Social wording gate | Stake.us wording | CI | npm run stake:qa | wording evidence | restricted words absent | restricted wording appears | not permitted |
| N | Game Info gate | rules/icons/copy | CI | npm run stake:qa:rules | rules evidence | all buttons documented | missing icon/explanation | not permitted |
| O | Mobile and responsive gate | viewport fit | CI | npm run stake:qa:mobile | responsive report | viewports fit | clipping/overflow | not permitted |
| P | Browser Replay gate | real Chromium replay | CI | npm run stake:qa:e2e | e2e report/screenshots | browser pass | browser failure | not permitted |
| Q | Forbidden-network gate | replay read-only policy | CI | node scripts/stake-qa.mjs replay | network proof | no forbidden requests | authenticate/play/end/event-save request | not permitted |
| R | Publish frontend integrity gate | upload exactness | publish/docs | npm run stake:qa:docs | frontend manifest | hashes current | stale build ID/hash | not permitted |
| S | Publish math integrity gate | math upload exactness | publish/docs | npm run stake:qa:docs | math manifest | hashes current | stale math version/hash | not permitted |
| T | Artifact packaging gate | evidence preservation | publish/docs | npm run stake:qa:docs | integrity JSON | artifacts exist | missing evidence | not permitted |
| U | Requirement traceability gate | docs and trace | publish/docs | npm run stake:qa:docs | trace JSON and docs | matrix equals trace | missing/duplicate/stale rows | not permitted |
| V | Final enforcement gate | release readiness | final review | npm run stake:qa && npm run stake:qa:docs | final verdict | all required gates pass | any required gate fails | not permitted |

Fast PR/push pipeline runs install, lint, build and standard Stake QA. Full math pipeline adds book/lookup regeneration. Manual workflow_dispatch can run full math even without path triggers. Local developer pipeline uses the package commands above. Final Stake upload pipeline runs publish, browser QA, docs/manifest validation, then uploads exactly `publish/frontend` and `publish/math`.

## Validation context

- Frontend build ID: `74dc84abea7750ed76fc4adc1623125e8773cde2b98fd357f529921d8b4a06e7`
- Math version: `0.2.2-cluster`
- Evidence directory: `artifacts/stake-qa/2026-07-30T08-59-08-860Z`
