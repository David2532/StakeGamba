# Current verified state

- Branch: `codex/blacksite-aaa-studio`
- Verified implementation commit: `2977b4d1ab6ec8250198ce271f0501df509b4bab`
- App lifecycle: M2 technical greybox; M3 concept asset pass started; not a release candidate
- App gates: lint PASS, 69/69 tests PASS, production build PASS
- Math gates: 300,000 books and 7/7 candidate/math/risk tests PASS; candidate fingerprint unchanged
- Fixed in the latest implementation: live RGS payout validation now performs documented non-negative BigInt half-up rounding from centi-x to whole API micro-units. The real `base_small` fixture at amount `100001`, raw payout `38`, payout `38000` is covered, including new play and active restore.
- Browser status: current-head E2E and visual review are BLOCKED by missing local Chromium. No visual PASS is claimed.
- CI status: no BlackSite-specific workflow; current Stake workflow does not gate this branch/app.
- Typecheck status: no project command/tool exists.

## Highest release blockers

1. Establish BlackSite CI/typecheck and reproducible Playwright Chromium so every hourly run can produce current-head evidence.
2. Reconcile the explicit penguin + lock/vault product requirement with human-operative concept docs/assets before further character production.
3. Replace the technical greybox with a player-facing slot HUD and production art integration; internal schema/hash copy must not be production UI.
4. Implement real deterministic cascade/reel motion, vault transitions, character reactions, audio, mute/persistence, turbo/autoplay where contractually allowed, and cleanup/performance guards.
5. Close current-head desktop/mobile/landscape visual, network, replay, reconnect, accessibility, package, license, and Stake checklist evidence.

Do not inherit historical screenshots or M2 claims across source/build identity without rerunning the required gate.
