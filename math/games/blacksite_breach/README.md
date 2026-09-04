# BLACKSITE // BREACH — M1 math candidate

Lifecycle: **`M1_INITIAL_CANDIDATE_NOT_RELEASE`**

This package is the verified initial M1 candidate for the frozen
`blacksite-m1-v1` contract. It is not a frontend package, a Stake submission,
an approval, or a release.

## Reproduce and verify

From the repository root:

```sh
pnpm blacksite:math:generate
pnpm blacksite:math:verify
pnpm blacksite:math:test
```

Generation is deterministic and writes the three 100,000-book, equal-weight
mode libraries under `library/`. Verification decompresses every published
book and independently checks the closed event schema, formulas, route
topology, physical tumble/refill behavior, ordering grammar, lookup weights,
distribution/risk gates, and deterministic fixture predicates.

## Verified identity

- Candidate fingerprint: `d03fab2727e046eb6a151e579c4852cbb0536415b37028dcb3d2de9c99f278d8`
- Canonical typed event-schema hash: `bb4f3ff88200519682a539909b196f1462069b865a48afd04cb3219e7b9efe29`
- Result: 300,000 books, 90/90 gates, 48/48 fixtures, 7/7 tests
- Modes: `base`, `deep_access`, `blackout`
- Cost-normalized RTP: `0.962000` in every mode
- Complete-round cap: `1,000,000` centi-x (`10,000.00x`) in every mode

Canonical review artifacts are:

- `library/publish_files/VERIFY_RESULT.json`
- `library/publish_files/CANDIDATE_MANIFEST.json`
- `library/publish_files/MATH_AUDIT.json`
- `library/publish_files/RISK_AUDIT.json`
- `library/publish_files/FIXTURE_INDEX.json`

The source of truth remains the versioned config and event schema under
`config/`. Published copies under `library/configs/` are hash-bound candidate
outputs.
