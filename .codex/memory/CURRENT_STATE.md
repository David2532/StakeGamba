# Current verified state

- Branch: `codex/blacksite-aaa-studio`
- Verified implementation commit: `fa60a4721f0e898b07f9c1fddac8e9b7c04b244e`
- Verified CI run: `33326796710` — SUCCESS against the clean exact implementation commit
- App lifecycle: player-facing, responsive vault HUD implemented; production character/environment art still absent; not a release candidate
- App gates: lint PASS, production-source `svelte-check` PASS (0 errors / 0 warnings), 78/78 tests PASS, production build PASS
- Math gates: 300,000 books and 7/7 candidate/math/risk tests PASS on exact run `33326796710`; candidate fingerprint unchanged
- Fixed in the latest implementation: live RGS payout validation now performs documented non-negative BigInt half-up rounding from centi-x to whole API micro-units. The real `base_small` fixture at amount `100001`, raw payout `38`, payout `38000` is covered, including new play and active restore.
- Browser status: exact built frontend PASS — 37/37 scenarios and 811/811 checks in run `33326796710`; clean console/network, desktop, portrait, landscape, tablet and Replay Popout S evidence is SHA-bound to `fa60a47`. Local Chromium download remains sandbox-blocked by CDN timeouts, but the pinned GitHub runner installs it reproducibly.
- CI status: `.github/workflows/blacksite-ci.yml` gates the target branch with frozen install, lint, production-source typecheck, app tests, build, one full math pass, Chromium E2E, exact identity, screenshots/evidence, and always-on diagnostics. Push/PR triggers are deduplicated for this branch.
- Latest visual fix: mode labels wrap without truncation, Base Amount and all meters are computed-centered, every primary keyboard action exposes a 3px amber focus ring with 2px separation, and the completed 360x640 Replay board remains square under a tightened 0.2% aspect guard. Exact geometry now also covers 1366x768.
- Product identity: `asset-manifest.json`, the active art/animation plans, and Codex art-director instructions now lock an original mature penguin Vaultkeeper plus physical lock/vault language. The retained human-operative concept is `superseded`, runtime-ineligible, and covered by 3 regression tests. Production penguin/vault assets, rights approval, and runtime integration remain absent.
- Player HUD: production-facing coordinates, `--` placeholders, three-letter symbol codes, schema/hash diagnostics and technical panel headings are removed. Semantic full-name symbols, concealed-cell treatment, vault status/copy, stronger material/focus treatment and Social-safe terminology are covered by 3 regressions plus exact desktop/mobile Chromium evidence.

## Highest release blockers

1. Author, rights-review and integrate the original production penguin rig and responsive mechanical-vault environment; retained human concepts are not eligible inputs.
2. Implement real deterministic cascade/reel motion, vault transitions, character reactions, audio, mute/persistence, turbo/autoplay where contractually allowed, and cleanup/performance guards.
3. Close reconnect, complete gameplay-state, package, license, device and Stake checklist evidence beyond the now-clean branch browser baseline.

Do not inherit historical screenshots or M2 claims across source/build identity without rerunning the required gate.
