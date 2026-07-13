# Stake known risks and non-claims

Verified behavior: RGS paid lifecycle, replay read-only networking, Replay UI visibility, optional replay payoutMultiplier handling, Event ID 0, KRW/XSC display, paytable contract values and publish folder hashing are covered by current evidence.

Inferred behavior: External Stake production routing is expected to call the same documented endpoints and payload contracts. The repository validates the game side and mocked RGS behavior, not Stake infrastructure availability.

Behavior outside repo control: Stake account funding, jurisdictional wallet rules, CDN upload propagation and production RGS uptime.

Unsupported modes: Modes outside base, rainbow, hunt, bonus_tier1 and bonus are rejected by replay mode validation.

Intentionally unavailable retriggers: Retrigger behavior remains limited to production math configuration and documented mode rules.

Optional response fields: replay payoutMultiplier may be absent or null; when present it is a strict cross-check. Known RGS payload variants include round, bet, eventRound and replay.round wrappers.

Current readiness risk: no repo-owned blocker is recorded by this document. If any mandatory gate fails, the final verdict becomes NOT READY until the failing evidence is replaced.

## Validation context

- Frontend build ID: `e5a3eaf118eb4f89aa83c0315cc6adc1acd2d1f7ef479879eb21d0b80f566b8e`
- Math version: `0.2.2-cluster`
- Evidence directory: `artifacts/stake-qa/2026-07-13T11-24-32-904Z`
