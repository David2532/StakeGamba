# Current verified state

- Branch: `codex/blacksite-aaa-studio`
- Verified implementation commit: `85eb4f2bd773e44261044edc3f836a429411f389`
- Verified CI run: `33329648477` — SUCCESS against the clean exact implementation commit
- App lifecycle: player-facing responsive vault HUD plus an original penguin Vaultkeeper static fallback implemented; responsive vault environment, approved rig and release evidence remain absent; not a release candidate
- App gates: lint PASS, production-source `svelte-check` PASS (0 errors / 0 warnings), 81/81 tests PASS, production build PASS
- Math gates: 300,000 books and 7/7 candidate/math/risk tests PASS on exact run `33329648477`; candidate fingerprint unchanged
- Fixed in the latest implementation: live RGS payout validation now performs documented non-negative BigInt half-up rounding from centi-x to whole API micro-units. The real `base_small` fixture at amount `100001`, raw payout `38`, payout `38000` is covered, including new play and active restore.
- Browser status: exact built frontend PASS — 37/37 scenarios and 819/819 checks in run `33329648477`; clean console/network, desktop, portrait, landscape, tablet and Replay Popout S evidence is SHA-bound to `85eb4f2`. The fallback loads at natural width 702, is pixel-visible at 1920x1080 and 1366x768, and is compact-hidden on mobile/low-height/Replay surfaces.
- CI status: `.github/workflows/blacksite-ci.yml` gates the target branch with frozen install, lint, production-source typecheck, app tests, build, one full math pass, Chromium E2E, exact identity, screenshots/evidence, and always-on diagnostics. Push/PR triggers are deduplicated for this branch.
- Latest visual fix: mode labels wrap without truncation, Base Amount and all meters are computed-centered, every primary keyboard action exposes a 3px amber focus ring with 2px separation, and the completed 360x640 Replay board remains square under a tightened 0.2% aspect guard. Exact geometry now also covers 1366x768.
- Product identity: the runtime now uses a semantic asset map for an original mature penguin Vaultkeeper with a physical chest lock. Its untouched 1024x1536 RGBA source and 78,732-byte 702x1080 WebP are hash-bound and provenance-documented. It remains a production candidate: manual light/alpha cleanup, human rights/Creative approval, Spine 4.2 rig and responsive vault environment are open.
- Player HUD: production-facing coordinates, `--` placeholders, three-letter symbol codes, schema/hash diagnostics and technical panel headings are removed. Semantic full-name symbols, concealed-cell treatment, vault status/copy, stronger material/focus treatment and Social-safe terminology are covered by 3 regressions plus exact desktop/mobile Chromium evidence.

## Highest release blockers

1. Complete manual cleanup and rights/Creative review of the penguin candidate, author its Spine 4.2 rig, and integrate a responsive original mechanical-vault environment; retained human concepts are not eligible inputs.
2. Implement real deterministic cascade/reel motion, vault transitions, character reactions, audio, mute/persistence, turbo/autoplay where contractually allowed, and cleanup/performance guards.
3. Close reconnect, complete gameplay-state, package, license, device and Stake checklist evidence beyond the now-clean branch browser baseline.

Do not inherit historical screenshots or M2 claims across source/build identity without rerunning the required gate.
