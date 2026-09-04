# Current verified state

- Branch: `codex/blacksite-aaa-studio`
- Last fully verified source commit: `021a1d648c741f3bdb44211abe8ed6377b0df088`; exact CI `33824176688` completed `SUCCESS` on pull-request merge result `ea0ecae7`.
- Latest run: `BS-20260904-21` closes `BSB-BROWSER-STORAGE-RESILIENCE-001`. Browser-storage acquisition is now fail-safe, so Safari private mode, disabled cookies or a policy-denied storage getter cannot prevent launch; persistence degrades to in-memory defaults.
- Current gates: local frozen install, lint, production `svelte-check` (0 errors / 0 warnings), 254/254 app tests, production build, scale verifier 46/46 and 7/7 math over 300,000 books PASS. Exact CI `33824176688` passes install through math plus 97/97 Chromium scenarios with 3123/3123 checks; the storage-denied 390x844 scenario reaches `live-ready` with one authentication, zero paid writes and clean console/network diagnostics.
- Package identity: exact CI frontend tree `eb9d20f6487e3f97c2aada04153ed28baa19092a72777ea2af5f35889822348d`, 6 files / 455,088 bytes; math tree `6bd0c4c7f39f9597ac7944e97446c1d09b9fe69087f21ceffe1077aa86bc01da`, 7 files / 48,697,667 bytes; math fingerprint `d03fab2727e046eb6a151e579c4852cbb0536415b37028dcb3d2de9c99f278d8`.
- Scale evidence boundary: SHA-256 readback proves artifact integrity; schema v6 adds post-run Ed25519 authenticity and cryptographic separation of the three approval domains. Trust schema v3 pins the exact release, owners/keys and complete approved pre-run plan; the store remains external and byte-digest-pinned. The verifier clock now bounds run completion and signature creation. A synthetic 46/46 self-test proves validator behavior only, not infrastructure capacity.
- Compact asset behavior is now exact-browser bound: 390x844 and 844x390 omit the hidden Vaultkeeper image with zero resource loads, while 1366x768 renders and decodes it once. This proves request/decode avoidance for the compact character asset, not device-wide latency, memory or frame-rate gains.
- Visual/browser evidence: artifact `9919710838` from exact green run `33824176688` supplied 1920x1080, 390x844, 844x390 and storage-denied 390x844 views. Manual inspection found no overlap, crop, scrollbar or broken-image regression; board, HUD, controls, vault, Penguin and responsive identity remain coherent. Physical iPhone behavior remains an external real-device gate.
- Stake evidence: all 51 rows are mapped; 20 automated PASS, 18 automated-proof/manual-open, 5 manual-only open, 6 external approval and 2 not applicable. The last package-bound resolver proves all 38 automated references; the current pull-request workflow skipped package/resolver generation and therefore does not supersede that package claim. Manual and external approval remain `NOT_CLAIMED`.

## Highest release blockers

1. Execute parent `BSB-SCALE-001`: coordinated production-equivalent CDN/RGS/provider load and resilience testing with owner-approved concurrency/RPS and limits; retain six signed role-owned reports plus the release-controlled trust store and validate them against the exact commit/package.
2. Complete manual cleanup and rights/Creative approval, approved Spine 4.2 rig/clips, BLACKOUT and separable foreground layers, final approved audio/listening/clipping/device QA, real-device pacing/memory/battery review, 23 manual checklist records and 6 external approvals.

Do not claim capacity for 1,000,000 users, inherit screenshots/infrastructure results, or close external approvals across source/build identity without the required rerun and owner acceptance.
