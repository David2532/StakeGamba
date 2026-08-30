# Current verified state

- Branch: `codex/blacksite-aaa-studio`
- Verified implementation commit: `e243fe7ad3c0306af5f991366c6fd473e97871de`
- Verified CI run: `33320205882` — SUCCESS against the clean exact implementation commit
- App lifecycle: M2 technical greybox; M3 concept asset pass started; not a release candidate
- App gates: local lint PASS, production-source `svelte-check` PASS (0 errors / 0 warnings), 72/72 tests PASS, production build PASS
- Math gates: 300,000 books and 7/7 candidate/math/risk tests PASS on exact run `33320205882`; candidate fingerprint unchanged
- Fixed in the latest implementation: live RGS payout validation now performs documented non-negative BigInt half-up rounding from centi-x to whole API micro-units. The real `base_small` fixture at amount `100001`, raw payout `38`, payout `38000` is covered, including new play and active restore.
- Browser status: exact built frontend PASS — 36/36 scenarios and 736/736 checks in run `33320205882`; clean console/network, desktop, portrait, landscape, tablet and Replay Popout S evidence is SHA-bound to `e243fe7`. Local Chromium download remains sandbox-blocked by CDN timeouts, but the pinned GitHub runner installs it reproducibly.
- CI status: `.github/workflows/blacksite-ci.yml` gates the target branch with frozen install, lint, production-source typecheck, app tests, build, one full math pass, Chromium E2E, exact identity, screenshots/evidence, and always-on diagnostics. Push/PR triggers are deduplicated for this branch.
- Latest visual fix: the completed 360x640 Replay board is square at 231.1875x231.1875 CSS pixels (previously distorted at 263.1875x234.5), remains above its 220-pixel floor, and has no viewport scroll or obscured controls.
- Product identity: `asset-manifest.json`, the active art/animation plans, and Codex art-director instructions now lock an original mature penguin Vaultkeeper plus physical lock/vault language. The retained human-operative concept is `superseded`, runtime-ineligible, and covered by 3 regression tests. Production penguin/vault assets, rights approval, and runtime integration remain absent.

## Highest release blockers

1. Replace the technical greybox with a player-facing slot HUD and production art integration; internal schema/hash copy must not be production UI.
2. Author, rights-review and integrate the original production penguin rig and responsive mechanical-vault environment; retained human concepts are not eligible inputs.
3. Implement real deterministic cascade/reel motion, vault transitions, character reactions, audio, mute/persistence, turbo/autoplay where contractually allowed, and cleanup/performance guards.
4. Close reconnect, complete gameplay-state, accessibility, package, license, device and Stake checklist evidence beyond the now-clean branch browser baseline.

Do not inherit historical screenshots or M2 claims across source/build identity without rerunning the required gate.
