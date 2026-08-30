# BLACKSITE seven-day sprint

- Sprint window: 2026-08-30 through 2026-09-05 (Europe/Berlin calendar days)
- Current sprint day: 1
- Lifecycle: `QA_BLOCKED`
- Release candidate ready: no

## Definition of Done evidence

| Area | Current evidence |
| --- | --- |
| Production build | PASS — Vite static build, exit 0, run BS-20260830-01 |
| Lint | PASS — app lint, exit 0 |
| Typecheck | BLOCKED — no `typecheck` script or `svelte-check` dependency exists |
| Automated app tests | PASS — 69/69, exit 0 |
| Math/package invariants | PASS — 300,000 books; 7/7 gates; fingerprint `d03fab2727e046eb6a151e579c4852cbb0536415b37028dcb3d2de9c99f278d8` |
| Current-head browser/E2E | BLOCKED — Chromium binary unavailable; CDN install failed; remote browser cannot reach sandbox localhost |
| Desktop/portrait/landscape visual review | BLOCKED — no current-head screenshots; old SHA evidence is not inheritable |
| Live wallet/replay/restore | PARTIAL — unit coverage is strong; fractional new-play and active-restore rounding fixed; browser network proof pending |
| Gameplay state matrix | PARTIAL — M2 deterministic fixtures exist; full requested production interaction matrix is not current-head proven |
| Player HUD/responsiveness/accessibility | BLOCKED — runtime is an M2 greybox with known centering, focus, truncation, and missing-control issues |
| Animation/cinematics | BLOCKED — no production cascade, penguin, or vault cinematic runtime |
| Audio | BLOCKED — production audio, mute, persistence, pause/resume, and leak evidence absent |
| Product identity/assets/licenses | BLOCKED — user-required penguin/vault conflicts with human-operative concept docs; manifest says runtime integration `none` |
| Stake/provider checklist | PARTIAL — historical M2 evidence exists, but current-head browser/package and later milestone evidence remain open |
| Release blockers | OPEN — known critical/high blockers remain; do not claim `RELEASE_CANDIDATE_READY` |

## Day milestones

- Day 1: baseline, memory/runbook, build/test/math status, and top release blockers captured. BlackSite-specific CI and typecheck remain open.
- Day 2: wallet/math/state-machine/replay/restore regression closure.
- Day 3: HUD, centered controls, responsiveness, accessibility, and mobile.
- Day 4: production reels/cascades, penguin, vault/lock cinematics, and frame pacing.
- Day 5: production audio, assets, load time, and memory behavior.
- Day 6: broad current-head E2E, browser/mobile/visual/Stake regression and red-team review.
- Day 7: candidate freeze, complete regression, licenses/docs/release notes, and evidence-backed readiness verdict.

Critical defects override the day theme. Advance early when a milestone is actually evidenced.
