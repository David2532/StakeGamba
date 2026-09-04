---
name: aaa-visual-qa
description: Use for deterministic slot visual review, desktop/mobile/popout screenshot matrices, animation completion/failure safety, 3-star art-direction critique and exact extracted-build visual evidence.
---

# AAA Visual QA Skill

## Read first
- `docs/blacksite/ANIMATION_BIBLE.md`
- `docs/blacksite/ASSET_ART_STANDARD.md`
- `docs/blacksite/QUALITY_QA_RELEASE.md`
- current Stake game-quality/front-end requirements.

## Principle
A visual requirement is not proven by source code or a unit test. Open the exact deterministic state at the exact viewport and inspect/assert what a reviewer/player actually sees.

## Fixture matrix
Review at least idle, zero/small/medium/big wins, five representative wins per mode, cascades, feature tease/trigger, bonus, max win, rules, confirmation, replay, restore, social, sub-cent and animation-failure states.

Target desktop, constrained laptop height, portrait mobile, smaller/older-phone target, landscape, tablet, Popout S and Popout L where applicable.

## Automated geometry
Assert:
- no unintended document scrolling;
- board visible/readable and not distorted;
- required controls inside viewport/safe area;
- touch target minimums;
- dialogs readable/scroll internally;
- play control physically hittable;
- character/effects do not cover results/controls.

## Motion review
Check:
- winning positions are visually traceable;
- cascade order is understandable;
- no snapping/illegal character state;
- no animation deadlock;
- skip/turbo end cleanly;
- replay repeat does not accumulate listeners/effects;
- missing assets fall back safely;
- max-win cinematic returns to a legal state.

## 3-star critique
Reject generic AI-looking gradients/emoji/placeholder art, mismatched art styles, shallow feature presentation, unreadable symbols, laggy/heavy scenes, and unpolished audio/animation. Require a cohesive authored composition and intentional device-specific layout.

## Evidence
For release review, capture evidence from the exact extracted frontend package and bind screenshots/manual record to candidate hashes.
