# BLACKSITE — RGS / Restore / Replay Contract

Owner: `rgs_replay_engineer`  
Co-owners: Frontend, Math/RGS, Stake Compliance, QA

This is a hard contract. Presentation code may not weaken it to make UI work easier.

## 1. Launch modes

The frontend has explicit launch modes:

### Paid live play

Requires valid Stake launch parameters and RGS authentication. No local payout simulation fallback is allowed.

### Replay

Triggered by Replay query parameters. Session authentication is not required and wallet-mutating calls are forbidden.

### Development fixture

Explicit local/dev-only route or flag. Uses deterministic fixture data and cannot be reachable as accidental fallback from a failed paid launch.

These modes must be distinguishable at startup and in tests.

## 2. RGS URL authority

- Read `rgs_url` from the current launch/replay query contract.
- Never hardcode a production RGS host.
- Invalid/missing live-play RGS configuration fails into a bounded visible launch error.
- Failure must not silently enable a local wallet or simulated paid round.

## 3. Money units

RGS API monetary amounts use integer units with six decimal places of precision.

Maintain integer amounts across request/state boundaries as long as possible.

Separate display helpers:

- balance;
- selected base play amount;
- total play amount after mode cost;
- win amount;
- replay amount;
- multiplier.

Never round authoritative values before final display formatting.

For new submissions, support the small bet levels returned by RGS. When the smallest possible win is at least `0.1x`, show exact wins to at least three decimals where needed; when it is below `0.1x`, preserve four-decimal win precision. Balance formatting may remain a separate two-decimal policy. Never reuse balance rounding for WIN, Replay result or total-play display.

## 4. Authenticate

Live paid play starts with exactly the current required authentication request.

Consume authoritative response fields including:

- balance amount/currency;
- `minBet`;
- `maxBet`;
- `stepBet`;
- `defaultBetLevel`;
- `betLevels`;
- jurisdiction flags;
- current/last round.

Do not ship a hardcoded production bet-level list that overrides RGS response values.

Current first-party pages use both `stepBet` and `minStep` for the minimum increment. Normalize this at one typed boundary: prefer the field actually returned by authenticate, accept an explicitly supported alias only when the values agree, and fail closed if both are present and conflict.

Treat the current jurisdiction object as a closed typed boundary. Required booleans include Social Mode, feature/spacebar restrictions and optional net-position/session-time displays; `minimumRoundDuration` is a non-negative integer in milliseconds. A newly initiated round cannot expose its result, settle or re-enable play before that minimum duration. Restore presentation is not artificially delayed.

## 5. Bet selection

A selected base amount must:

- be within min/max;
- satisfy step rules;
- be one of the current recommended/returned levels when the UI is presenting those levels;
- restore to the authoritative amount for an active round.

When `betLevels` is absent or empty, the UI must not collapse to the default alone. Expose the complete legal `minBet`/`maxBet`/`stepBet` interval with a bounded step control.

Total debit shown before a high-cost mode action:

`base play amount × mode cost multiplier`

Confirmation text must show the exact total amount in the current currency/social format.

## 6. Play request

A legal paid action emits at most one `/wallet/play` request.

Request must use:

- current authenticated session;
- current canonical mode;
- current base amount in RGS units.

Before sending:

- no active unresolved round unless the RGS contract explicitly allows a new one;
- no unresolved major-action confirmation;
- no Replay mode;
- no known insufficient balance;
- no duplicate click/spacebar request in flight.

The returned round/book state is authoritative for presentation and payout.

An exact live WIN surface requires authoritative integer `round.payout`. Missing payout fails the result contract; the frontend never substitutes or relabels `payoutMultiplier` as a monetary amount.

## 7. Insufficient balance

If current authoritative balance cannot cover the selected total play amount:

- show the approved insufficient-balance message;
- send zero play requests;
- do not begin local animation as if a round exists;
- keep control state recoverable.

Also handle RGS `ERR_IPB` safely if balance changed between client check and request.

## 8. Active-round restore

On authenticate, `round` can represent an active or completed round.

If active:

- restore canonical mode;
- restore original base amount/total play context;
- restore currency/session context;
- resume from authoritative book/round/event state;
- send **zero** duplicate play requests;
- block new play until the active round is completed/settled;
- settle at most once.

If the game persists presentation progress with `/bet/event`, make it idempotent and ensure resume is valid even if the event marker is missing/stale.

BLACKSITE persists a bounded `blacksite-book-events-v3:<nextEventIndex>` marker after durable full-state checkpoints. On restore it synchronously primes all cues before that next index, then animates from that index exactly once. Missing, v1/v2/foreign, malformed or out-of-range markers conservatively resume from event `0` instead of blocking authentication; a v1 or v2 cursor is never interpreted as v3 state. The `/bet/event` success response may omit its optional `event` echo; if an echo is present it must match the request.

## 9. Settlement / end-round

Do not couple end-round to whether visible payout is zero/non-zero.

Decision inputs are:

- authoritative round active/completed state;
- current mode auto-close contract;
- current RGS requirements;
- whether the frontend is responsible for manual close in that mode.

Rules:

- never call end-round twice;
- never call end-round from Replay;
- never call end-round merely because a count-up animation finished if round state says otherwise;
- if RGS has already auto-closed a round, frontend sends no redundant end-round;
- if an active manually-closed round must settle, completion/skip paths converge on exactly one settlement action.

QA must assert request order and counts, not just final balance.

## 10. Balance authority

Balance shown after play/settlement comes from RGS wallet responses.

Do not:

- calculate wallet balance from `oldBalance - bet + win` as production authority;
- let a local animation amount update the wallet state;
- retain an optimistic balance if an RGS request fails.

Temporary visual debit/count-up can exist only if it reconciles to authoritative wallet state and cannot escape as the final source of truth.

## 11. Replay query contract

Replay must handle the current Stake parameters including:

- `replay=true`;
- `game`;
- `version`;
- `mode`;
- `event`;
- `rgs_url`;
- optional `currency`;
- optional `amount`;
- optional `lang`;
- optional `device`;
- optional `social`.

Canonicalize allowed mode aliases before cost/presentation logic.

Invalid/missing required replay parameters produce a Replay-specific safe error, not a transition into live play.

## 12. Replay fetch

Use the current replay endpoint shape:

`GET {rgs_url}/bet/replay/{game}/{version}/{mode}/{event}`

The optional launch `lang`, `currency`, `amount`, `device` and `social` values configure the replay UI. They are not appended to the RGS endpoint, whose path remains exact.

Validate response structure before playback:

- payout multiplier numeric/non-negative;
- cost multiplier numeric/valid;
- state/event payload usable by the target math version;
- mode identity consistent with the requested replay.

For the current new-game contract, normalize the exact direct response object:

`{ payoutMultiplier: number, costMultiplier: number, state: object }`

Do not inherit older game-specific `round` or `replay.round` wrapper aliases without a real target-RGS payload and a documented compatibility decision.

The public Replay page describes `amount` only as being “in units” and exposes a numeric payout multiplier, while the static math package uses centi-x integers and wallet APIs use six-decimal integer money. Keep Replay query amount, Replay response multiplier, package payout and wallet amount as four explicitly named domains. Never reinterpret Replay query units as wallet micro-units.

Exact arithmetic inside the documented Replay query-unit domain is permitted and required: `total play = raw amount units × canonical costMultiplier`, and `final win = raw amount units × authoritative payoutMultiplier`. Use decimal-string/BigInt arithmetic, retain the explicit `units` label and apply the optional launch currency only as display decoration. This does not authorize conversion into the live wallet domain.

If legacy/alternate numeric representations are intentionally accepted, normalize only when they resolve exactly to the authoritative result. Contradictory values fail closed.

## 13. Replay is read-only

Replay must make zero calls to:

- `/wallet/authenticate`;
- `/wallet/play`;
- `/wallet/end-round`;
- `/bet/event` persistence;
- normal session wallet refresh paths.

Disable/hide normal bet controls and prevent any route from Replay into paid play without a fresh normal game launch.

## 14. Replay UX

Loading:

- automatically fetch requested event;
- show bounded loading/error state;
- present explicit Play when ready.

Playback:

- same authoritative round result and essential animation sequence;
- show play amount/cost context, multiplier and final win;
- respect sound setting;
- support Social Mode and currency display;
- support Popout S and mobile.

Completion:

- final result remains visible;
- Play Again resets presentation only;
- replaying again is deterministic;
- no extra wallet/session calls.

## 15. Fractional Replay

Maintain regression cases where:

- base amount is fractional in display currency;
- mode cost creates non-two-decimal final play amount;
- payout produces sub-cent/four-decimal visible win;
- social currency displays SC/GC correctly.

Do not round final play amount by borrowing the balance formatting policy.

## 16. Social Mode

When `social=true`:

- apply Social Mode phrase vocabulary from boot;
- XGC/XSC/XEC display without `$` prefix;
- Replay uses the same approved social vocabulary;
- restricted phrases are scanned in visible and accessibility text;
- language resolves to the approved Social Mode policy.

## 17. Required deterministic network tests

At minimum:

1. valid auth;
2. invalid `rgs_url`;
3. invalid session;
4. legal base play;
5. legal high-cost mode play after confirmation;
6. insufficient balance with zero play calls;
7. RGS insufficient-balance race/error;
8. zero-win auto-close path;
9. winning/manual-close path where applicable;
10. active-round restore with zero duplicate play calls;
11. restore then exactly-one settlement;
12. Replay base loss;
13. Replay base win;
14. Replay feature mode;
15. Replay max win;
16. Replay fractional amount/win;
17. Replay Social Mode;
18. Replay Play Again;
19. Replay Popout S;
20. network failure/timeouts with recoverable UI.

For each test capture exact request counts and relevant payload fields.

## 18. Error UX

Errors are categorized, not collapsed into a generic fake continuation:

- launch/config error;
- auth/session error;
- insufficient balance;
- play error;
- settlement error;
- replay fetch/validation error;
- asset/presentation failure.

Wallet/RGS errors must stop paid-game progression safely. Presentation-only errors should prefer a deterministic fallback that still permits authoritative result completion/settlement.
