---
name: stake-rgs-replay
description: Use for Stake RGS authentication/play/end-round/event lifecycle, active-round restore, insufficient balance, Replay URLs/sessionless playback, currency precision and Social Mode replay behavior.
---

# Stake RGS + Replay Skill

## Read first
- `AGENTS.md`
- `docs/blacksite/RGS_REPLAY_CONTRACT.md`
- `docs/blacksite/STAKE_REQUIREMENTS_51.md`
- `docs/blacksite/STAKEGAMBA_LESSONS.md`
- current official Stake RGS and Replay pages from `STAKE_ENGINE_SOURCE_INDEX.md`

## Live-play invariants
- authenticate before wallet play operations;
- `rgs_url` comes from launch contract and is not hardcoded;
- use authenticate-provided min/max/step/default/bet levels and jurisdiction flags;
- mode debit uses base amount × canonical cost multiplier;
- active round from authenticate is authoritative and must resume without duplicate play;
- no play request when known balance is insufficient;
- RGS errors do not enable local paid simulation;
- settlement/end-round follows current authoritative round/auto-close contract, never visible win/loss alone;
- wallet balance comes from RGS responses.

## Replay invariants
- detect `replay=true` before normal live-session bootstrap;
- required replay identity: game/version/mode/event/rgs_url;
- support optional currency/amount/lang/device/social;
- fetch the current Replay endpoint;
- Replay uses zero authenticate/play/end-round/event-save calls;
- disable normal bet controls and prevent transition into paid play;
- show loading → Play → playback → final result → Play Again;
- preserve canonical cost multiplier, play amount, payout and fractional values;
- support Social Mode and Popout S;
- deterministic Play Again with no listener/particle/network accumulation.

## Required proof
For each changed flow include browser assertions for:
- request endpoint/method/body;
- call count/order;
- visible currency/play amount/win;
- final round state;
- negative/error path.

Never mark a network requirement PASS from source inspection only.
