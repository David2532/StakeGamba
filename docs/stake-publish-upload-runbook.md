# Stake publish upload runbook

1. Synchronize branch `agent/stake-compliance-final` with the final PR commit.
2. Confirm the tested commit with `git rev-parse HEAD`.
3. Regenerate the standard publish output with `npm run stake:publish`.
4. Run full math publish with `npm run stake:publish:full-math` when math/config/lookup/book/cluster/Wild semantics changed.
5. Verify folders exist: `Test-Path publish/frontend` and `Test-Path publish/math`.
6. Inspect `publish/frontend/index.html` for build ID `74dc84abea7750ed76fc4adc1623125e8773cde2b98fd357f529921d8b4a06e7`.
7. Inspect `publish/math/game_config.json` for math version `0.2.2-cluster`.
8. Verify hashes with `npm run stake:qa:docs`.
9. Upload frontend folder exactly: `publish/frontend`.
10. Upload math folder exactly: `publish/math`.

Do not upload repo source folders, prior artifacts, screenshots, local `node_modules`, git metadata or release ZIPs for the normal Stake frontend/math upload workflow. Preserve `artifacts/stake-qa` evidence after upload.

## Validation context

- Frontend build ID: `74dc84abea7750ed76fc4adc1623125e8773cde2b98fd357f529921d8b4a06e7`
- Math version: `0.2.2-cluster`
- Evidence directory: `artifacts/stake-qa/2026-07-29T15-12-53-801Z`
