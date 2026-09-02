# Durable decisions

## D-001 — Product identity authority

The user's explicit BLACKSITE requirement is a penguin character integrated with the physical lock/vault theme. `apps/blacksite/art/asset-manifest.json` is the machine-readable identity authority: the production character is the original mature penguin Vaultkeeper, while retained human-operative concepts are superseded, runtime-ineligible provenance records only. Preserve the cyber-blacksite tone, board readability and original-asset requirement; reject childlike/chibi, franchise-derived or human-in-costume substitutions.

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

## D-006 — Base-win presentation tiers

Base-phase `cluster_win.step_payout_raw` selects the static Vaultkeeper reaction at documented centi-x boundaries: `win_small` below 100, `win_medium` from 100 through 199, and `win_big` from 200. Feature-phase wins remain `bonus_win`, cap events remain `max_win`, and Reduced Motion resolves every tier at 0ms. These are presentation-only constants normalized to the Base wager; they never alter math, event values, final payout or wallet settlement.

## D-007 — Feature idle character ownership

Every authoritative `board_snapshot` owns a phase-specific static Vaultkeeper stance: feature-phase snapshots preserve `bonus_idle`, while Base snapshots use `monitoring`. One-shot feature reactions such as `bonus_win` may temporarily supersede that stance, but no feature board update may fall back to Base monitoring before the authoritative feature exit. This is presentation-only state and never changes event, payout, wallet or provider authority.
