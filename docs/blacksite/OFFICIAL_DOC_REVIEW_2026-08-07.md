# Official Stake Engine Documentation Review — 2026-08-07

Purpose: snapshot the first-party documentation areas reviewed while building the BLACKSITE repository operating system. This is a navigation/reconciliation record, not a permanent substitute for re-checking current docs at submission time.

## Approval documentation reviewed

- General Approval Guidelines
  - approval tied to specific frontend + math versions;
  - stateless bets;
  - originality/IP/content restrictions;
  - Stake.US automatic consideration/social testing;
  - post-release restriction on underlying math/new modes/gameplay changes.
- Front End Communication
  - original audio/visual assets;
  - no broken assets/animations;
  - mobile and Popout/mini-player;
  - static/CDN asset behaviour;
  - rules/game information;
  - mode description/cost;
  - RTP and Max Win;
  - payouts/special symbols/feature triggers;
  - all RGS bet levels;
  - visible balance/final win;
  - mute, spacebar and autoplay confirmation;
  - fast/turbo readability;
  - currency/language playtesting.
  - new-submission small-bet support and exact three-/four-decimal WIN precision according to the minimum possible multiplier;
  - no production-console leakage of errors or game information.
- RGS Communication
  - authenticate values must govern bet levels/limits/increments;
  - static frontend/no external runtime resources.
- Bet Replay Requirements
  - mandatory for new approvals;
  - public/sessionless replay;
  - replay query parameters and endpoint;
  - current new-game response envelope is the direct object `{ payoutMultiplier, costMultiplier, state }`;
  - optional launch values configure the Replay UI and are not appended to the exact Replay GET path;
  - Play/Play Again lifecycle;
  - no normal betting/session calls;
  - reviewer scenario IDs per mode.
- Jurisdiction / Stake.US
  - `social=true/false`;
  - restricted gambling vocabulary and replacements;
  - social-language handling.
- Game Tile Requirements
  - environmental BG;
  - transparent foreground/key art;
  - provider logo;
  - high-resolution source naming/format;
  - current combined BG+FG size budget.
- General Game Disclaimer
  - pre-calculated RGS payout authority;
  - internet/disconnection/resume concept;
  - expected return over many plays;
  - browser visuals do not determine settlement.
- Game Quality Rankings
  - 0–3 star system;
  - 3-star = studio-quality creativity, uniqueness and detail;
  - device testing, optimized bundle/load, clean art/animation and deeper concepts;
  - generic AI-looking assets, shallow gameplay and inconsistent polish are explicit quality risks.
- Submission Checklist
  - exact authenticated criteria are login-gated publicly;
  - current public page states the review uses independent reviewers and quality ranking;
  - this project therefore treats the supplied 51 checklist items as the explicit working checklist and reconciles them with the authenticated checklist before submission.
- Math Verification
  - canonical `base` mode must cost `1.0x` and be the cheapest mode;
  - base standard deviation, per-mode RTP, cross-mode RTP spread, Max Win, mode-cost and non-zero-hit-rate hard gates;
  - operator bet-template viability and static file/event-count limits;
  - CVaR, tail probability and ETL/exposure diagnostics for quality-tier review;
  - practical Max Win attainability and 100k-1M recommended simulation scale;
  - this live first-party page was omitted from the original review and is now explicitly indexed.

## RGS documentation reviewed

Technical areas:
- launch URL/query parameters;
- ISO language parameter and supported-language list;
- integer six-decimal money units;
- currency being display-only for game logic;
- mode cost multiplier × base amount debit model;
- authenticate request/response;
- minBet/maxBet/stepBet/defaultBetLevel/betLevels/jurisdiction;
- active/last round returned by authenticate;
- balance endpoint;
- play endpoint;
- end-round endpoint;
- `/bet/event` persistence for resumable in-progress rounds;
- RGS error codes including insufficient balance/invalid session/location/limits/maintenance;
- static math publication format.

Important reconciliation: the exact need for a frontend end-round call depends on the authoritative round and BetMode auto-close contract. BLACKSITE therefore tests request behaviour per mode instead of encoding “win means end-round” or “loss means no end-round” as a universal UI rule.

Additional reconciliation:
- approval material says `minStep`, while the technical authenticate schema says `stepBet`; accept a documented alias only when both values agree;
- BLACKSITE normalizes the current direct Replay envelope instead of inheriting GGR's older permissive `round`/`replay.round` wrapper handling;
- Replay query `amount`, Replay response multiplier, static-package centi-x payout and wallet micro-units remain separate types until a target-RGS payload proves conversion;
- `pl` is the internal ISO language code; any documented `po` launch alias is normalized only at the boundary;
- Social Mode remains English-only under project checklist item 39 until Stake resolves the public `sweeps_<lang>` ambiguity.
- Public currency lists differ across current first-party pages; BLACKSITE keeps code fallback and explicitly supports XGC, XSC and XEC without a dollar prefix.

## Math SDK documentation tree reviewed

The current official SDK navigation covers all of these areas, and BLACKSITE source-indexes them rather than only reading the quickstart:

### Setup / format
- Engine Setup
- Quickstart Guide
- Required Math File Format
- SDK Directory

### High-level structure
- State Machine
- Game Structure
- Game Format

### Gamestate / acceptance / setup
- Simulation Acceptance
- Configs
- BetMode
- Distribution

### Symbols / board / wins / events
- Symbols
- Board
- Wins
- Events
- Force Files

### Calculations
- Board
- Tumble
- Lines
- Ways
- Scatter
- Cluster

### Source/output utilities
- Config
- Events
- Executables
- State
- Win Manager
- Outputs
- Utilities
- Example Games
- Uploads
- Optimization Algorithm

### Frontend SDK technical areas
- Dependencies
- Getting Started
- Storybook
- Flowchart
- Task Breakdown
- Adding New Events
- File Structure
- Context
- UI

### RGS
- RGS Technical Details
- RGS Connection Example

## Key Math SDK conclusions encoded into BLACKSITE

- A book contains the payout multiplier and the event sequence required by the frontend.
- Lookup selection weights are the fixed production probability lever.
- Lookup payout and book payout must match.
- Book/lookup payout integers use centi-x units (`100 = 1.00x`); cost-normalized return is `rawPayout / (100 * modeCost)`, independently of six-decimal RGS wallet units.
- `index.json` plus mode lookup CSV and compressed JSONL books are release-critical static math files.
- `BetMode` defines RTP, cost, max win, distributions and auto-close/feature behaviour.
- Distribution criteria/quotas can intentionally create simulation classes such as freegame/max-win candidates for a diverse optimization pool.
- Production simulation pools should be large/diverse; current quickstart guidance typically recommends 100k+ simulations per mode.
- Optimization can shape fixed published win distributions; BLACKSITE adds cost-normalized volatility/risk reporting so high-cost feature modes are compared correctly.
- Math events are the frontend state snapshots; new mechanics require explicit event contract + frontend handler + deterministic fixture.

## Frontend SDK conclusions encoded into BLACKSITE

- Existing Stake SDK architecture is PixiJS/Svelte and designed to be customized with game-specific events.
- Storybook/fixture-style states are appropriate for direct frontend scenario testing.
- Book events are played sequentially into presentation handlers; BLACKSITE adds a semantic PresentationDirector layer so payout authority remains outside animation.
- Existing StakeGamba packages can be generalized, but BLACKSITE final UI/art must be visually original rather than shipping the sample look.

## Codex workflow review

Current OpenAI guidance supports repository `AGENTS.md` instructions, and OpenAI's more recent harness-engineering guidance recommends giving the coding agent a concise map to a structured docs system rather than one enormous instruction file. BLACKSITE therefore uses:
- short root `AGENTS.md` router;
- `docs/blacksite/INDEX.md`;
- focused durable Markdown standards;
- repo-scoped skills;
- specialist `.codex/agents/*.toml` roles;
- deterministic tests/evidence as executable knowledge.

## Re-check triggers

Re-run current first-party research when:
- beginning M1 math/mechanic freeze;
- implementing live RGS/Replay;
- preparing game tile assets;
- changing Social Mode text;
- freezing production math;
- generating an approval candidate;
- Stake reviewer feedback contradicts current repo instructions;
- a candidate sits long enough that docs may have changed.
