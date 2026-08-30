# Current verified state

- Branch: `codex/blacksite-aaa-studio`
- Verified implementation commit: `e30d0c0de02532d6874ca1a51bde2ddbcd70a116`
- Verified CI run: `33332083126` — SUCCESS against the clean exact implementation commit
- App lifecycle: responsive vault HUD, original penguin fallback, and independently composed desktop/portrait base-vault environments are integrated; approved rig, BLACKOUT environment state and release evidence remain absent; not a release candidate
- App gates: lint PASS, production-source `svelte-check` PASS (0 errors / 0 warnings), 83/83 tests PASS, production build PASS
- Math gates: 300,000 books and 7/7 candidate/math/risk tests PASS on exact run `33332083126`; candidate fingerprint unchanged
- Fixed in the latest implementation: live RGS payout validation now performs documented non-negative BigInt half-up rounding from centi-x to whole API micro-units. The real `base_small` fixture at amount `100001`, raw payout `38`, payout `38000` is covered, including new play and active restore.
- Browser status: exact built frontend PASS — 37/37 scenarios and 827/827 checks in run `33332083126`; clean console/network, desktop, portrait, landscape, tablet and Replay Popout S evidence is SHA-bound to `e30d0c0`. Wide viewports load the 1672px desktop plate; <=820px viewports load the independent 941px portrait plate; both are visible, complete and pointer-inert.
- CI status: `.github/workflows/blacksite-ci.yml` gates the target branch with frozen install, lint, production-source typecheck, app tests, build, one full math pass, Chromium E2E, exact identity, screenshots/evidence, and always-on diagnostics. Push/PR triggers are deduplicated for this branch.
- Latest visual fix: mode labels wrap without truncation, Base Amount and all meters are computed-centered, every primary keyboard action exposes a 3px amber focus ring with 2px separation, and the completed 360x640 Replay board remains square under a tightened 0.2% aspect guard. Exact geometry now also covers 1366x768.
- Product identity: the semantic asset map now binds the original penguin fallback plus separate opaque base-vault plates: 77,992-byte 1672x941 desktop and 48,628-byte 941x1672 portrait WebPs. Sources/exports are hash/provenance-bound and exact-browser proven. All remain production candidates pending human rights/Creative review; penguin cleanup/Spine 4.2, BLACKOUT and separable foreground environment layers remain open.
- Player HUD: production-facing coordinates, `--` placeholders, three-letter symbol codes, schema/hash diagnostics and technical panel headings are removed. Semantic full-name symbols, concealed-cell treatment, vault status/copy, stronger material/focus treatment and Social-safe terminology are covered by 3 regressions plus exact desktop/mobile Chromium evidence.

## Highest release blockers

1. Complete manual cleanup and rights/Creative review of the integrated candidates, author the penguin Spine 4.2 rig, and add BLACKOUT/foreground vault layers; retained human concepts are not eligible inputs.
2. Implement real deterministic cascade/reel motion, vault transitions, character reactions, audio, mute/persistence, turbo/autoplay where contractually allowed, and cleanup/performance guards.
3. Close reconnect, complete gameplay-state, package, license, device and Stake checklist evidence beyond the now-clean branch browser baseline.

Do not inherit historical screenshots or M2 claims across source/build identity without rerunning the required gate.
