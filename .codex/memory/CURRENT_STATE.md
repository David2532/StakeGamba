# Current verified state

- Branch: `codex/blacksite-aaa-studio`
- Remote HEAD: `8feae80f1e31f29aaf81e269dd990902c739e4a4`
- Verified CI implementation commit: `15eab121481f52de37234e1ce4b3217d199808b1`
- App lifecycle: M2 technical greybox; M3 concept asset pass started; not a release candidate
- App gates: lint PASS, production-source `svelte-check` PASS (0 errors / 0 warnings), 69/69 tests PASS, production build PASS
- Math gates: 300,000 books and 7/7 candidate/math/risk tests PASS; candidate fingerprint unchanged
- Fixed in the latest implementation: live RGS payout validation now performs documented non-negative BigInt half-up rounding from centi-x to whole API micro-units. The real `base_small` fixture at amount `100001`, raw payout `38`, payout `38000` is covered, including new play and active restore.
- Browser status: local current-head E2E and visual review are BLOCKED because the Playwright CDN timed out on every built-in mirror attempt. Remote Chromium evidence is pending in BlackSite CI run `33315820538`; no visual PASS is claimed yet.
- CI status: `.github/workflows/blacksite-ci.yml` gates the target branch with frozen install, lint, production-source typecheck, app tests, build, one full math pass, Chromium E2E, exact identity, screenshots/evidence, and always-on diagnostics. Push/PR triggers are deduplicated for this branch.

## Highest release blockers

1. Obtain a clean exact-HEAD result from BlackSite CI run `33315820538`; until Chromium E2E finishes, `BSB-CI-001` remains in progress.
2. Reconcile the explicit penguin + lock/vault product requirement with human-operative concept docs/assets before further character production.
3. Replace the technical greybox with a player-facing slot HUD and production art integration; internal schema/hash copy must not be production UI.
4. Implement real deterministic cascade/reel motion, vault transitions, character reactions, audio, mute/persistence, turbo/autoplay where contractually allowed, and cleanup/performance guards.
5. Close current-head desktop/mobile/landscape visual, network, replay, reconnect, accessibility, package, license, and Stake checklist evidence.

Do not inherit historical screenshots or M2 claims across source/build identity without rerunning the required gate.
