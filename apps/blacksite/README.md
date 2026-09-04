# BLACKSITE // BREACH

Lifecycle: **M3 integration / QA_BLOCKED / NOT A RELEASE CANDIDATE**

This package is the static SvelteKit frontend for the frozen BLACKSITE math candidate. It now includes live RGS play, authoritative active-round restore, read-only Replay, deterministic development fixtures, responsive vault presentation, bounded motion and a policy-safe procedural audio foundation. It does not include an approved Spine rig, final audio assets, complete manual device evidence or external Stake approval.

The RGS/book result is always payout authority. The frontend does not simulate paid outcomes, invent settlement or fall back to local play in production.

## Launch contracts

### Live play

A live launch requires a valid HTTP(S) `rgs_url`, non-empty `sessionID`, supported `lang` and supported `device`. The runtime authenticates before enabling play and uses the authenticate response for wallet state, available levels, limits and active-round restore.

```text
?sessionID=<session>&rgs_url=https%3A%2F%2F<rgs-host>&currency=USD&lang=en&device=desktop
```

Missing, malformed, credential-bearing or query/hash-bearing `rgs_url` values fail closed before a wallet request. Paid play never switches to a fixture or local result.

### Replay

Replay is sessionless and read-only. Required identity parameters are `replay=true`, `game`, `version`, `mode`, `event` and a valid HTTP(S) `rgs_url`; `currency`, `amount`, `lang`, `device` and `social` are optional launch context.

```text
?replay=true&game=blacksite_breach&version=0.1.0-m1&mode=base&event=1&rgs_url=https%3A%2F%2F<rgs-host>&currency=USD&amount=1.00
```

Replay performs one GET for the authoritative book. `PLAY AGAIN` replays the already-fetched result without authentication, wallet mutation or a second Replay request.

### Deterministic development fixtures

Fixtures are available only through the Vite development server and an explicit `dev_fixture` query. Production builds reject fixture queries.

```text
http://localhost:3002/?dev_fixture=base_zero
```

The generated catalog contains M1-backed deterministic states used for gameplay, motion and visual review. Rebuild it only when the frozen fixture index intentionally changes:

```sh
pnpm --filter blacksite fixtures:build
```

## Local commands

Run from the repository root:

```sh
pnpm --filter blacksite dev       # Vite development server on :3002
pnpm --filter blacksite lint      # production-source ESLint
pnpm --filter blacksite check     # Svelte production-source typecheck
pnpm --filter blacksite test      # app contracts and regressions
pnpm --filter blacksite build     # static production frontend
pnpm blacksite:math:test          # frozen math/package invariants
pnpm blacksite:qa:e2e             # fresh build plus Chromium QA
```

Chromium QA exercises live RGS flows, Replay, restore/reconnect, Social Mode, fractional currency, deterministic motion/audio, missing-asset fallback and required desktop/mobile geometry. A green local run is technical evidence, not manual device, listening, Creative or Stake approval.

## Exact candidate evidence

The branch workflow performs frozen install, lint, typecheck, app tests, build, full math verification, isolated-package generation/readback, exact-package Chromium QA and current-SHA resolution of the 51-point evidence matrix.

Generate technical candidate folders outside the repository; the packager refuses a dirty worktree, an unpinned branch/commit, a mismatched frontend tree or an existing output directory. The production build uses the exact full Git SHA as its SvelteKit recovery version, so two builds from the same clean checkout produce the same frontend bytes:

```sh
pnpm --filter blacksite build
node scripts/blacksite-package-candidate.mjs \
  --output <new-candidate-directory> \
  --expected-branch <branch> \
  --expected-commit <full-git-sha> \
  --expected-frontend-tree <fresh-frontend-tree-sha256>
node scripts/blacksite-package-verify.mjs \
  --candidate <new-candidate-directory> \
  --expected-branch <branch> \
  --write-result
```

The generated manifest deliberately keeps `uploadAuthorized: false`. Exact automated evidence does not close rights/Creative review, authored Spine/audio work, real-device visual/listening gates or external Stake lifecycle actions.

## Sources of truth

- `docs/blacksite/INDEX.md` — project documentation map
- `docs/blacksite/RGS_REPLAY_CONTRACT.md` — live, restore and Replay invariants
- `docs/blacksite/QUALITY_QA_RELEASE.md` — exact-package and release-evidence rules
- `docs/blacksite/RELEASE_EVIDENCE_51.json` — machine-resolved checklist mapping
- `.codex/memory/CURRENT_STATE.md` — latest verified branch evidence and blockers

The frozen math candidate fingerprint is `d03fab2727e046eb6a151e579c4852cbb0536415b37028dcb3d2de9c99f278d8`. Any intentional math or gameplay change requires deterministic regeneration, regression evidence and Stake-controlled review handling.
