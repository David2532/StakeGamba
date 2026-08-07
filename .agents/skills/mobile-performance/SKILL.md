---
name: mobile-performance
description: Use for responsive slot composition, Popout S/L, touch/safe-area/double-tap behavior, old mobile device testing, Pixi texture/filter/particle performance and bundle/load optimization.
---

# Mobile + Performance Skill

## Read first
- `docs/blacksite/QUALITY_QA_RELEASE.md`
- `docs/blacksite/ANIMATION_BIBLE.md`
- `docs/blacksite/ASSET_ART_STANDARD.md`
- exact responsive items in `STAKE_REQUIREMENTS_51.md`.

## Layout rules
- recompose portrait rather than uniformly shrinking desktop;
- board and controls outrank side-character visibility;
- Popout S/L are explicit target layouts;
- main frame has no unintended scrollbars;
- safe areas and orientation changes are handled;
- unintended double-tap zoom is disabled without breaking legitimate dialog scrolling/accessibility;
- touch targets meet the project gate and are physically clickable.

## Performance rules
Measure heavy deterministic fixtures. Inspect texture dimensions/memory risk, atlasing, filters, particles, main-thread stalls, audio lag, first-interactive/first-play readiness and orientation resize behavior. Prefer optimizing assets/effects before reducing gameplay readability.

## Old device gate
Define and record the supported older Android/iOS floor. Validate on real hardware or an accepted device-farm/manual setup; desktop browser emulation alone is not sufficient evidence for the final old-device checklist item.

## Evidence
Provide viewport screenshots/geometry assertions and performance observations tied to the exact build/candidate being reviewed.
