# Reusable lessons

- Exact cross-product equality is wrong when a contract converts centi-x products into whole API micro-units. Use integer half-up rounding at the boundary and test remainders below, at, and above 50.
- Tie money regressions to a real published fixture as well as synthetic boundary cases. `base_small` book 65220 exposed the rounding defect with raw payout 38.
- Test both fresh paid play and active-round restore; both normalize the same RGS round but enter through different session transitions.
- `blacksite:math:test` already performs the full candidate verification. Do not run a redundant full verify beside it.
- Math verification may rewrite environment-bearing publish metadata during a run. Inspect and remove generated churn unless the product artifact intentionally changes.
- In this sandbox, Vite must bind explicitly to `127.0.0.1`; the default `--host` interface lookup fails. The cloud browser cannot reach that sandbox loopback, so this is not visual evidence.
- Root targeted ESLint needs legacy config mode; the production app lint script is the authoritative configured gate. Do not treat pre-existing root Turbo env declarations as a new source failure.
- Read compact memory first and use targeted `rg`/small ranges. Avoid loading lockfiles, generated catalogs, complete logs, or all BLACKSITE docs when the selected slice does not require them.
