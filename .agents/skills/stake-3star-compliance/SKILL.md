---
name: stake-3star-compliance
description: Use for Stake Engine approval, 3-star quality review, frontend/RGS/replay/mobile/social/currency rules, release packaging, and requirement-to-proof audits. Verify current official docs before making approval claims.
---

# Stake Engine 3-Star Compliance Skill

## Sources
Always re-check current official pages before final submission:
- https://stake-engine.com/docs/approval-guidelines
- https://stake-engine.com/docs/approval-guidelines/front-end-communication
- https://stake-engine.com/docs/approval-guidelines/rgs-communication
- https://stake-engine.com/docs/approval-guidelines/game-replay-requirements
- https://stake-engine.com/docs/approval-guidelines/game-quality-rankings
- https://stake-engine.com/docs/approval-guidelines/general-disclaimer
- https://stakeengine.github.io/math-sdk/

## Hard architecture rules
- Stateless bets: no jackpot, gamble continuation, early cashout, or history-dependent odds.
- The RGS/book result is payout authority. Frontend presentation cannot determine settlement.
- Approval is bound to specific frontend and math versions; release evidence must identify exact packages/hashes.
- Bet Replay is mandatory for new games and must be deliberately implemented/tested.
- Built game is static and must not rely on external network resources.

## Frontend requirement families
Maintain automated/manual proof for at least:
- unique/original audio and visual assets; no final reuse of SDK sample assets;
- no broken/missing animations/assets;
- mobile support for common devices;
- Stake popout/mini-player support without board distortion;
- fonts/images/audio/animation assets packaged for Stake CDN delivery;
- rules/game information accessible from UI;
- each mode's cost/action described;
- each mode's RTP clearly communicated;
- each mode's max win clearly communicated;
- symbol payouts and special-symbol values listed;
- feature trigger rules described;
- bet size change and every RGS-supported bet level usable;
- balance visible;
- final non-zero win clearly visible;
- multi-action win amount increments to the final amount;
- sound mute;
- spacebar mapped to bet;
- autoplay, if present, requires confirmation;
- no console/network errors or sensitive/debug leakage;
- currencies/languages/social terminology validated;
- fastplay retains legible wins, combinations, and required popups.

## Replay/restore gates
Replay must reconstruct a completed round from the supplied replay parameters without placing a real wager or mutating wallet state. Alias/canonical mode identity, cost multiplier, play amount, fractional currencies, final payout, event order, and bonus presentation must remain deterministic. Restore of an active round must not double-play or double-settle.

## 3-star quality target
Minimum compliance is not the product goal. Current Stake quality guidance awards the top tier only to studio-quality games with exceptional creativity, uniqueness, attention to detail, clean professional animation/art, and optimized load/bundle behavior. Review BLACKSITE against that bar before submission.

## Proof format
For every requirement record:
- requirement;
- official source/date checked;
- implementation file/symbol;
- automated test name;
- extracted-build evidence artifact;
- manual visual evidence if relevant;
- status: PASS / BLOCKED / NOT_APPLICABLE with reason.

Never mark PASS from source code alone when the requirement is visual/runtime/package-specific.