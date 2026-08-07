# BLACKSITE // BREACH greybox

Lifecycle: **M2_STARTED / GREYBOX / NOT A RELEASE CANDIDATE**

This app is an isolated presentation-contract start for the verified M1 math candidate. It contains no final art, no Golden Goal Rush assets, no Stake Engine Loader and no paid local simulation.

## Launch boundaries

- Live launch requires a valid `rgs_url` query parameter. Missing or invalid values produce a visible fatal launch error. The M2 start intentionally exposes no paid-play button or wallet request yet.
- Replay query parsing is isolated and read-only. Replay fetching remains an explicit later M2 task.
- Development fixtures require Vite development mode and the explicit query `?dev_fixture=base_zero`. A production build rejects that query instead of falling back to a simulated game.

## Commands

```text
pnpm --filter blacksite test
pnpm --filter blacksite build
pnpm --filter blacksite dev
```

The `base_zero` fixture mirrors published BLACKSITE book `base/1`, event contract `blacksite-book-events-v1`, from M1 candidate fingerprint `d03fab2727e046eb6a151e579c4852cbb0536415b37028dcb3d2de9c99f278d8` and canonical event-schema SHA-256 `bb4f3ff88200519682a539909b196f1462069b865a48afd04cb3219e7b9efe29`.
