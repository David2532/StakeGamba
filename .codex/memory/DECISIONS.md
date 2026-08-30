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
