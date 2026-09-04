# BLACKSITE — Performance Budgets and Evidence Contract

- Status: **schema-v1 budgets frozen; pending-candidate exact measurements not yet recorded**
- Budget schema: `blacksite-performance-budget-v1`
- Defined: **2026-09-03**

The executable source of truth is
[`scripts/blacksite-performance-budget.mjs`](../../scripts/blacksite-performance-budget.mjs).
The browser harness reads these limits; it does not derive, loosen or rewrite them from measured
results.

This contract describes the pending candidate's measurement method and acceptance limits. The current
focused performance-contract suite passes 4/4 after evidence-integrity hardening. This document contains no
candidate timing result and claims no performance pass. Only generated exact-package evidence from an
uncancelled candidate CI run can satisfy these budgets.

## Measurement scope

Under schema v1, each candidate exact-package CI run measures three independent cold browser contexts for each representative
state. Runs use the same extracted build, Chromium binary, 1366×768 CSS-pixel viewport at DPR 1,
normal motion, deterministic RGS fixture, loopback static server and no artificial CPU/network
throttling. The performance block runs before the broader QA scenarios in the newly launched
Chromium process. The states are:

| State             | Start and terminal condition                                                                               | Ready/run | Complete/run | Decoded bytes/run |
| ----------------- | ---------------------------------------------------------------------------------------------------------- | --------: | -----------: | ----------------: |
| `live-first-play` | Returning player with intro version already seen → ready and first authoritative zero-result play complete | ≤1,500 ms |    ≤3,000 ms |      ≤1,000,000 B |
| `intro-full`      | Fresh live navigation → complete normal intro, then first authoritative zero-result play complete          | ≤4,500 ms |    ≤6,000 ms |      ≤1,000,000 B |
| `replay-complete` | Cold read-only Replay navigation → ready and then deterministic completion                                 | ≤1,500 ms |    ≤3,000 ms |      ≤1,000,000 B |

Every run must also remain within LCP ≤2,500 ms and scripted primary-interaction Event Timing
duration ≤200 ms, CLS ≤0.1, lifecycle long-task blocking ≤200 ms, requestAnimationFrame interval p95 ≤50 ms,
maximum frame interval ≤250 ms and a bounded count of intervals above 50 ms (Live ≤2, Intro ≤12,
Replay ≤4). The evidence retains raw observations plus min, median, max and range. Three lab runs
are not presented as a statistically meaningful field p75; gating every run makes the maximum the
conservative ceiling check.

Live and intro use the primary Play action backed by the same deterministic zero-result RGS fixture;
Replay uses its primary read-only playback action. Each run verifies clean browser diagnostics,
exact request counts and the absence of unexpected checkpoint/settlement writes.

The observer is armed immediately before one trusted `primary-action` click and retains the target and
observed-entry count. Candidate resolution requires the complete performance block, exact package/SHA
identity, all nine numbered runs, finite non-negative values and summaries recomputed from raw observations;
missing, impossible, mismatched or over-budget evidence fails closed.

`readyMs` and `completeMs` are deliberately conservative upper bounds: the harness samples them
only after the applicable DOM state, deterministic network and asset-paint barriers have resolved.
They are not instrumentation timestamps from inside application code.

## Core Web Vitals truth boundary

The current official “good” Core Web Vitals thresholds are LCP ≤2.5 s, INP ≤200 ms and CLS ≤0.1
at the 75th percentile, assessed separately for mobile and desktop. Source:
[web.dev Web Vitals](https://web.dev/articles/vitals), retrieved 2026-09-03.

The Playwright values in `blacksite-browser-evidence.json` are **controlled lab diagnostics**. They
are not Chrome UX Report data, production RUM, a real-user percentile or proof for older mobile
hardware. The scripted-interaction ceiling is aligned with the published INP threshold as a coarse
engineering guard, but one scripted interaction is not page-lifecycle INP. Chromium `first-input`
supplies the same first interaction when it falls below the general event observer threshold. A
missing interaction from both sources invalidates the run;
no value is invented. CLS uses the Core Web Vitals maximum-session-window algorithm. The recorded
lifecycle long-task blocking value is not labeled as Lighthouse Total Blocking Time because its
window is deliberately the complete measured state lifecycle rather than FCP-to-TTI.

The exact evidence also records commit/build-tree identity, Node, Playwright, Chromium, headless
mode, OS/architecture, CPU model/count, viewport/DPR, motion profile, cache semantics and runner
class. A fresh context plus `no-store` makes each route HTTP-cache-cold; it does not reboot Chromium
or provide a cold GitHub-host machine. Absolute timings on shared runners are therefore coarse
regression ceilings, not device-capacity claims.

## Remaining performance gates

These repository measurements do not close:

- repeated testing after final title/brand, board, supporting UI, gameplay FX, approved Spine,
  foreground, BLACKOUT and audio assets land;
- heavy cascade, bonus entry, max-win, rules-modal, cold/warm-load, memory and variance profiling
  against that final asset set;
- the defined older-device floor on real Android/iOS hardware or an accepted device farm;
- texture/GPU memory, audio latency and thermal behavior on those target devices;
- production/staging field percentiles from an authorized deployed URL.

Remote integration commit `66a1930` defines the repository's proposed physical-device floor as Apple
iPhone X hardware (A11 Bionic, 3 GB RAM) on iOS 16.7.x with the exact Mobile Safari/WebKit build recorded,
and Motorola Moto G7 Power XT1955-family hardware (Snapdragon 632, Adreno 506, 3 GB RAM) on Android 10
with the exact Chrome/Blink build recorded. Its Device-QA v3 schema, templates, attachment validator,
independent owner-review record and handoff runbook are implemented repository collection tooling that must
be preserved during pending-candidate integration. They also require real Stake Popout S and L records.
Structural validation does not attest the hardware, prove an operator's assertions, accept the proposed
floor or satisfy checklist row 49. The gate remains open until the full exact-package heavy-fixture, audio,
orientation, memory, thermal and battery checks pass on physical hardware or an accepted physical-device
farm and the required owner review is complete.

Any material asset/runtime change requires the same exact-package lab suite again. A later budget
change must be reviewed as a contract change and cannot be justified solely by a failing result.
