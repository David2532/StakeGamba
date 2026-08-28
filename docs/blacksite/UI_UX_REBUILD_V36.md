# BLACKSITE // BREACH — UI/UX Rebuild V36

Status: implementation baseline
Scope: presentation and interaction only; Math, RGS events, settlement, replay normalization and mode costs remain authoritative and unchanged.

## Design intent

The game keeps its BLACKSITE identity: black bunker metal, warm brass, red alert accents, the SWAT Penguin, the vault film and every canonical reel symbol. V36 changes hierarchy and composition instead of replacing the art direction.

The persistent information order is:

1. Reels, Spin and the current feature state.
2. Balance, total bet and win.
3. Current mode and short-lived event feedback.
4. Rules, paytable, legal copy and development diagnostics on demand.

One fact has one visible owner. The base screen no longer needs simultaneous `PREVIEW`, `PRESS SPIN` and `READY`; the feature screen no longer needs a base-game win value that disagrees with its running feature win.

## Player-flow coverage

| Path | Visible states that must remain covered |
| --- | --- |
| Normal launch | preload, intro video, rules/start card, transition, ready base game |
| Base game | ready, bet change, spin, reel stop, no win, one line, multiple lines, natural VAULT trigger |
| Deep Access | mode selection, high-cost confirmation, guaranteed two-VAULT setup, natural trigger |
| Direct BLACKOUT | high-cost confirmation, direct award handoff, eight free spins |
| Natural BLACKOUT | trigger lock, wheel, locks, door, light, award, chosen target, eight free spins |
| Feature | spins remaining, expanding target, running feature win, expansion, line result, feature end |
| Win cap | base/feature context, capped total, return to base |
| Autoplay | explicit count confirmation, running count, stop, low funds/error/mode lock stop |
| Replay | loading, ready, playing, completed, play again; no ordinary wagering controls |
| Restore | authentication, active-round restore, remaining presentation, one settlement |
| Errors | startup asset/auth error, runtime/play/replay/presentation/settlement error, recovery |
| Jurisdiction/social | play terminology, hidden restricted controls, exact currency domains |

The development catalog currently supplies 41 math-backed fixtures across Base, Deep Access and BLACKOUT. A follow-up fixture-quality task is required for deterministic micro/small/medium/big/top presentation tiers; existing fixture names do not reliably map to those normalized visual tiers.

## Responsive compositions

### Desktop / large landscape

- Reels remain dominant and the Penguin remains a secondary character anchor.
- Header owns identity, current mode and connection/lifecycle.
- The two-cell base mechanic rail owns fixed lines and VAULT trigger progress.
- The bottom deck owns controls and money values; utility icons receive visible labels.
- The event ticker is silent when nothing happened and appears only for spin, warning or result feedback.

### Portrait phone

- Header text uses a hard readable minimum instead of proportional desktop scaling.
- Money row: Balance / Total Bet / Win.
- Bet adjustment is a distinct row, central Spin is the primary action, utilities share one compact row.
- At most one payline raster is drawn at a time; the text badge reports the complete line count and win.
- Startup video and start art fill the portrait canvas with safe cropping. Live HTML supplies the readable feature summary and CTA above the preserved start asset.

### Short landscape / popout proxy

- Reels remain central; nonessential footer diagnostics disappear.
- Header and HUD labels retain minimum readable sizes.
- One payline raster is visible at a time.
- Dialog bodies scroll internally and never exceed the safe viewport.

## Feature HUD

During free spins the ordinary identity header yields to exactly three cards:

1. Free-spin progress and spins left.
2. The chosen expanding symbol using the canonical reel asset.
3. Running BLACKOUT win.

The normal bet controls are de-emphasized because the feature advances automatically. The in-game guide explains the Book-style mechanic in four steps: three VAULTs trigger, one of eleven regular symbols is chosen, eight free spins run with expansion, total win returns to base.

## Reusable visual rules

- Spacing follows an 8 px rhythm; content padding is 16 px mobile and 24 px desktop where geometry permits.
- Interactive targets remain at least 44 by 44 CSS px; Spin remains larger.
- UI metadata starts at 9–10 px only in constrained authored shells, control labels at 10–11 px, dialog/body copy at 13 px, primary numeric values at 15–16 px or larger.
- Controls expose hover, press, focus, disabled and busy states.
- Text, icon and shape communicate status; color is supplementary.
- Dialogs are content-sized, capped by `100dvh`, internally scrollable and retain focus trapping/return.
- Motion is event-driven; reduced-motion removes nonessential transitions.

## Asset ownership

| Surface | Production owner |
| --- | --- |
| Responsive cabinet/environment | V22 desktop, portrait, phone, compact-phone and short-landscape shells |
| Penguin | V20 Penguin state pack |
| Reel symbols | canonical 13-symbol master/state registry; V22 Operative and V19 VAULT remain canonical owners |
| Semantic UI surfaces | V27 feature/content/header/award/chip/progress assets with V22/V21 fallbacks |
| Feature cinematic | V26 vault MP4/poster plus V19 VAULT states/scenes |
| Startup | V33 MP4, end frame and rules/start image; V28 only as fallback/candidate |
| Audio | curated V29 runtime pack and event-driven audio director |

V28 environment candidates are not visible runtime owners and therefore must not block first interaction.

## Verification gates

- Unit/contract tests and lint.
- Production build and frozen build inventory.
- Browser matrix: 320×568, 360×640, 390×844, 640×480, 844×390, 1280×720, 1366×768, 1920×1080.
- Base zero, line win, natural BLACKOUT, direct BLACKOUT, expansion, feature end, max win, replay and error surfaces.
- No document overflow, overlapping hit targets, clipped live values, missing asset decode or console/page/network errors.
- Final production closure and Stake package-size headroom.

## Source standards used

- Stake Engine approval, frontend communication, replay and quality-ranking guidance.
- WCAG 2.2 target size, non-text contrast, focus, status message and motion guidance.
- WAI-ARIA modal dialog pattern.
- Apple, Android and Microsoft interaction-target/layout guidance.
