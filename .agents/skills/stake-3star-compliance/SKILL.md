---
name: stake-3star-compliance
description: Use for Stake Engine approval, 3-star quality review, the exact 51-point checklist, frontend/RGS/replay/mobile/social/currency rules, release packaging and requirement-to-proof audits. Verify current first-party docs before making approval claims.
---

# Stake Engine 3-Star Compliance Skill

## Mandatory project sources
Read before approval-sensitive work:
- `docs/blacksite/STAKE_REQUIREMENTS_51.md` — exact 51-point project checklist;
- `docs/blacksite/STAKE_ENGINE_SOURCE_INDEX.md` — current first-party source map;
- `docs/blacksite/STAKEGAMBA_LESSONS.md` — previous failure/regression lessons;
- `docs/blacksite/QUALITY_QA_RELEASE.md` — evidence and lifecycle rules.

Then re-check the current official Stake pages relevant to the task. If current official requirements changed, update the repo docs in the same workstream.

## Hard architecture rules
- Stateless paid bets only; no history-dependent outcome selection, jackpot continuation/gamble/early-cashout model conflicting with current Stake restrictions.
- RGS/book result is payout authority; frontend presentation cannot determine settlement.
- Approval is bound to exact frontend/math versions; release evidence identifies exact package hashes.
- Bet Replay is mandatory for new approvals and is sessionless/read-only.
- Built game is static and must not rely on unauthorized external runtime resources.
- Final game is original and final art/audio does not reuse Stake sample-game assets.
- Post-release math/mode/gameplay changes are treated as Stake-controlled review work.

## Exact requirement families
Maintain evidence for all 51 project items, including:
- launch authenticate success and invalid-RGS failure;
- one legal play request per bet action and no Stake Engine Loader;
- unique title/original content/game tile;
- authenticate-provided bet levels/constraints and active-round amount restore;
- currency and sub-cent display;
- correct round-close lifecycle and no play on insufficient balance;
- no-scroll main frame and spacebar play;
- rules: RTP, max win, payouts, win combinations, modes/costs, freegame/retrigger, disclaimer;
- autoplay/high-cost confirmation;
- desktop, Popout S/L, mobile, double-tap behavior and interaction guide;
- mute;
- English + invalid-language fallback;
- five wins per mode against rules;
- exact Mystery probability text if such a mode exists;
- Stake.US/Social terminology, SC/GC display and Replay language rules;
- Replay URL/optional params/Play Again/cost+multiplier/Popout S;
- final bet-level template, Provably Fair/Replay enablement, Front+Math approval, approved-channel post, older-device proof, live operational closure and released state.

## End-round nuance
Do not implement or audit settlement using a simplistic `payout > 0` or `payout == 0` heuristic. Current Math SDK `BetMode` auto-close configuration and authoritative RGS round state determine whether the frontend must call end-round. The project checklist's zero-win item is proven by network behavior against the exact selected mode/RGS lifecycle, not by a generic frontend rule.

## Replay/restore gates
Replay reconstructs a completed round from supplied parameters without wallet mutation. Alias/canonical mode identity, cost multiplier, amount, fractional display, payout, event order, Social Mode and Popout remain deterministic. Active-round restore must not double-play or double-settle.

## 3-star quality target
Minimum compliance is not the product goal. Current Stake quality guidance reserves the top tier for studio-quality games with exceptional creativity/uniqueness/detail, clean professional art/animation, device quality and optimized bundle/load behaviour. Review BLACKSITE against that bar before submission.

## Proof format
For every requirement record:
- requirement ID and wording;
- official source/date checked;
- implementation file/symbol;
- automated test/manual procedure;
- extracted-build/package evidence;
- candidate SHA + frontend/math hashes;
- status: TODO / IMPLEMENTED_UNPROVEN / PASS_AUTOMATED / PASS_MANUAL / EXTERNAL_PENDING / N/A / BLOCKED.

Never mark PASS from source code alone when browser, visual, package, math or external evidence is required. Never claim `51/51` while any external/manual item is merely expected rather than completed.
