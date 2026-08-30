# Durable decisions

## D-001 — Product identity authority

The user's explicit BLACKSITE requirement is a penguin character integrated with the lock/vault theme. Existing human-operative concept language and assets are not authority for further production and must be reconciled before character implementation. Preserve the cyber-blacksite tone, board readability, and original-asset requirement.

## D-002 — Wallet payout conversion

For non-negative values, convert terminal centi-x to whole API micro-units with exact BigInt half-up rounding:

`expectedPayoutApi = (amountApi * terminalRaw + 50) / 100`

Reject every adjacent or contradictory RGS payout. Never use floating point and never recompute the player's payout from frontend gameplay state.

## D-003 — Evidence identity

Browser, package, screenshot, and performance claims bind to the exact source/build identity tested. Historical artifacts may guide investigation but cannot prove a later HEAD.

## D-004 — Memory precedence

Reproducible repository code/tests and exact current evidence override these memory files. Memory records state; it does not define game, math, or provider behavior.

## D-005 — BlackSite CI scope

BlackSite CI runs once for every push to `codex/blacksite-aaa-studio`; pull-request execution is limited to PRs targeting that branch so an existing outbound PR cannot duplicate the full 300,000-book gate. Production `src/**` plus Svelte/Vite config are checked with `svelte-check` and `checkJs: true`; JavaScript test fixtures are executed by Node's test runner instead of being treated as production type declarations. Third-party declaration conflicts are excluded with `skipLibCheck`, not application diagnostics.
