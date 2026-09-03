# Current verified state

- Branch: `codex/blacksite-aaa-studio`
- Last fully verified implementation commit: `386166d1c4e536b1fc91c9dff2507f38663b14f4`; exact CI `33786591571` completed `SUCCESS`.
- Latest run: `BS-20260903-15` closes `BSB-SCALE-SIGNER-SEPARATION-001`. Schema v6 / trust schema v2 require distinct workload, provider and platform approval-owner identities and distinct normalized Ed25519 public keys. Aliasing one private key behind multiple signer IDs or reusing one approval owner now fails closed instead of satisfying nominal multi-owner approval.
- Current gates: expected-red shared-key attack 0/1, focused regression 1/1, local frozen install, lint, production `svelte-check` (0 errors / 0 warnings), 193/193 app tests, production build, scale verifier 32/32 and 7/7 math over 300,000 books PASS. Exact CI `33786591571` passes the same gates, isolated package/readback, 89/89 Chromium scenarios with 2878/2878 checks and current-SHA 51-point resolution.
- Package identity: exact CI frontend tree `b2476910abb70a92dffccbf67448594b6216718fa788ff14ca6e0da5de05d16d`, 6 files / 439,752 bytes; math tree `6bd0c4c7f39f9597ac7944e97446c1d09b9fe69087f21ceffe1077aa86bc01da`, 7 files / 48,697,667 bytes; math fingerprint `d03fab2727e046eb6a151e579c4852cbb0536415b37028dcb3d2de9c99f278d8`.
- Scale evidence boundary: SHA-256 readback proves artifact integrity; schema v6 adds post-run Ed25519 authenticity and cryptographic separation of the three accountable approval domains. The release-bound trust store rejects duplicate normalized public-key fingerprints, and approval metadata rejects duplicate owner identities. A synthetic 32/32 self-test proves validator behavior only, not infrastructure capacity.
- Badge geometry remains closed: active Deep Access has 12px measured desktop separation and no facility-kicker/heading-copy collision; compact layouts deliberately hide the redundant chip. No product runtime, layout, math, wallet/provider schema, product asset, dependency or lockfile changed in this evidence slice.
- Visual/browser evidence: artifact `9906288764` from exact green run `33786591571` supplied 1920x1080, 1366x768, 390x844 and 844x390 geometry views. Manual inspection found no overlap, crop, scrollbar or broken-image regression; board, HUD, controls, vault and responsive identity remain intact. No product visual source changed.
- Stake evidence: all 51 rows are mapped; 20 automated PASS, 18 automated-proof/manual-open, 5 manual-only open, 6 external approval and 2 not applicable. All 38 automated references resolve on exact commit/package/browser identity; manual and external approval remain `NOT_CLAIMED`.

## Highest release blockers

1. Execute parent `BSB-SCALE-001`: coordinated production-equivalent CDN/RGS/provider load and resilience testing with owner-approved concurrency/RPS and limits; retain six signed role-owned reports plus the release-controlled trust store and validate them against the exact commit/package.
2. Complete manual cleanup and rights/Creative approval, approved Spine 4.2 rig/clips, BLACKOUT and separable foreground layers, final approved audio/listening/clipping/device QA, real-device pacing/memory/battery review, 23 manual checklist records and 6 external approvals.

Do not claim capacity for 1,000,000 users, inherit screenshots/infrastructure results, or close external approvals across source/build identity without the required rerun and owner acceptance.
