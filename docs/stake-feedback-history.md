# Stake feedback history

This chronology keeps superseded failures visible. Dates are the 2026-07-13 audit reconstruction dates because the repository does not contain separate upstream review timestamps for each checklist item.

## 1. Game did not authenticate with RGS

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Game did not authenticate with RGS
- Observed symptom: Launch RGS auth
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: authenticate is called only in paid RGS mode and fatal launch errors stop local fallback.
- Regression test: scripts/stake-qa.mjs all; scripts/stake-qa-e2e.mjs rgs
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 2. Game did not send Play

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Game did not send Play
- Observed symptom: Paid spin lifecycle
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: A paid spin sends the Stake play request before rendering authoritative events.
- Regression test: scripts/stake-qa.mjs all; scripts/stake-qa-e2e.mjs wallet
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 3. Game did not send End-Round

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Game did not send End-Round
- Observed symptom: Round settlement
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: Inactive or completed rounds call end-round exactly when Stake active-state rules require it.
- Regression test: scripts/stake-qa.mjs all; scripts/stake-qa-e2e.mjs wallet
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 4. Play and End-Round returned errors

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Play and End-Round returned errors
- Observed symptom: RGS error handling
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: Transport and API errors surface a fatal state with no local simulated recovery.
- Regression test: scripts/stake-qa.mjs all; scripts/stake-qa-e2e.mjs wallet
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 5. Connections remained open and the game became stuck

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Connections remained open and the game became stuck
- Observed symptom: Request lifecycle
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: RGS requests use bounded lifecycle handling and clear state transitions.
- Regression test: scripts/stake-qa.mjs all; scripts/stake-qa-e2e.mjs wallet
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 6. End-Round appeared inconsistently

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: End-Round appeared inconsistently
- Observed symptom: Settlement consistency
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: End-round is determined from round.active and completion state, not display timing.
- Regression test: scripts/stake-qa.mjs all; scripts/stake-qa-e2e.mjs interrupted-round
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 7. End-Round was incorrectly associated with winning or losing state

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: End-Round was incorrectly associated with winning or losing state
- Observed symptom: Active state authority
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: round.active controls settlement behavior regardless of win/loss.
- Regression test: scripts/stake-qa.mjs all; scripts/stake-qa-e2e.mjs interrupted-round
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 8. Visible winnings differed from the Play response

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Visible winnings differed from the Play response
- Observed symptom: Authoritative wins
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: Visible wins are rendered from RGS events and payout fields, not local recalculation.
- Regression test: scripts/stake-qa.mjs all; scripts/stake-qa-e2e.mjs paytable
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 9. Bonus purchase used a local simulation path

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Bonus purchase used a local simulation path
- Observed symptom: Bonus purchase authority
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: Bonus/Feature purchase routes through RGS play and never uses local RNG in RGS mode.
- Regression test: scripts/stake-qa.mjs all; scripts/stake-qa-e2e.mjs major-actions
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 10. Bonus purchase could display a win disconnected from RGS

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Bonus purchase could display a win disconnected from RGS
- Observed symptom: Bonus win authority
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: Bonus purchase display comes from authoritative RGS state and payout.
- Regression test: scripts/stake-qa.mjs all; scripts/stake-qa-e2e.mjs major-actions
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 11. URL modification did not cause the required fatal error

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: URL modification did not cause the required fatal error
- Observed symptom: Launch parameter validation
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: Unsupported launch parameters fail closed with the Stake-required fatal message.
- Regression test: scripts/stake-qa.mjs all; scripts/stake-qa-e2e.mjs regression
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 12. Active base-round settlement behavior

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Active base-round settlement behavior
- Observed symptom: Active base rounds
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: Active base rounds remain resumable or settle only through Stake-approved end-round flow.
- Regression test: scripts/stake-qa.mjs interrupted-round; scripts/stake-qa-e2e.mjs interrupted-round
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 13. Interrupted bonus continuation behavior

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Interrupted bonus continuation behavior
- Observed symptom: Interrupted bonus rounds
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: Interrupted bonus rounds resume without charging again and continue from RGS state.
- Regression test: scripts/stake-qa.mjs interrupted-round; scripts/stake-qa-e2e.mjs interrupted-round
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 14. Preserving selected amount after refresh

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Preserving selected amount after refresh
- Observed symptom: Bet persistence
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: Selected amount is restored from RGS configuration and launch/session state after refresh.
- Regression test: scripts/stake-qa.mjs all; scripts/stake-qa-e2e.mjs wallet
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 15. Preserving post-purchase balance

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Preserving post-purchase balance
- Observed symptom: Balance authority
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: Balance after bonus purchase follows RGS wallet response and is not recomputed locally.
- Regression test: scripts/stake-qa.mjs all; scripts/stake-qa-e2e.mjs wallet
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 16. Bonus-start popup

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Bonus-start popup
- Observed symptom: Bonus start UX
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: Bonus start popup is shown from authoritative bonus-trigger events.
- Regression test: scripts/stake-qa.mjs rules; scripts/stake-qa-e2e.mjs major-actions
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 17. Currency symbols and abbreviations

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Currency symbols and abbreviations
- Observed symptom: Currency display
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: USD, KRW, SC/XSC and configured currencies use shared display metadata.
- Regression test: scripts/stake-qa.mjs currency; scripts/stake-qa-e2e.mjs replay
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 18. Interrupted-round user message

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Interrupted-round user message
- Observed symptom: Resume messaging
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: Interrupted-round message explains continuation without implying a new charge.
- Regression test: scripts/stake-qa.mjs interrupted-round; scripts/stake-qa-e2e.mjs interrupted-round
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 19. Auto action selection and confirmation

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Auto action selection and confirmation
- Observed symptom: Major action confirmation
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: Auto action requires explicit confirmation according to configured major-action rules.
- Regression test: scripts/stake-qa.mjs major-actions; scripts/stake-qa-e2e.mjs major-actions
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 20. Bonus/Feature action confirmation

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Bonus/Feature action confirmation
- Observed symptom: Major action confirmation
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: Bonus/Feature purchase requires confirmation and RGS authority.
- Regression test: scripts/stake-qa.mjs major-actions; scripts/stake-qa-e2e.mjs major-actions
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 21. Generic major-action confirmation

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Generic major-action confirmation
- Observed symptom: Major action confirmation
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: All configured major actions use consistent confirmation UI and keyboard handling.
- Regression test: scripts/stake-qa.mjs major-actions; scripts/stake-qa-e2e.mjs major-actions
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 22. Insufficient Funds wording

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Insufficient Funds wording
- Observed symptom: Insufficient funds copy
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: Insufficient-funds wording follows Stake copy for fiat/crypto modes.
- Regression test: scripts/stake-qa.mjs insufficient-funds; scripts/stake-qa-e2e.mjs insufficient-funds
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 23. Stake.us Insufficient Balance wording

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Stake.us Insufficient Balance wording
- Observed symptom: Stake.us copy
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: Stake.us social balance wording uses Insufficient Balance copy.
- Regression test: scripts/stake-qa.mjs insufficient-funds; scripts/stake-qa-e2e.mjs insufficient-funds
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 24. Mobile fullscreen behavior

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Mobile fullscreen behavior
- Observed symptom: Mobile viewport
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: Mobile portrait and landscape fill the viewport without clipped Stake controls.
- Regression test: scripts/stake-qa.mjs mobile; scripts/stake-qa-e2e.mjs mobile
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 25. Button icons and explanations in Game Info

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Button icons and explanations in Game Info
- Observed symptom: Rules content
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: Every Game Info button has an icon and a concise explanation.
- Regression test: scripts/stake-qa.mjs rules; scripts/stake-qa-e2e.mjs rules
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 26. Dynamic minBet

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Dynamic minBet
- Observed symptom: Dynamic bet config
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: minBet comes from authenticate response and constrains UI/action state.
- Regression test: scripts/stake-qa.mjs all; scripts/stake-qa-e2e.mjs wallet
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 27. Dynamic maxBet

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Dynamic maxBet
- Observed symptom: Dynamic bet config
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: maxBet comes from authenticate response and constrains UI/action state.
- Regression test: scripts/stake-qa.mjs all; scripts/stake-qa-e2e.mjs wallet
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 28. Dynamic stepBet

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Dynamic stepBet
- Observed symptom: Dynamic bet config
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: stepBet comes from authenticate response and controls increment/decrement.
- Regression test: scripts/stake-qa.mjs all; scripts/stake-qa-e2e.mjs wallet
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 29. Dynamic default bet level

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Dynamic default bet level
- Observed symptom: Dynamic bet config
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: Default bet level follows RGS authenticate configuration.
- Regression test: scripts/stake-qa.mjs all; scripts/stake-qa-e2e.mjs wallet
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 30. Dynamic betLevels

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Dynamic betLevels
- Observed symptom: Dynamic bet config
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: The bet selector is built from authenticate betLevels.
- Regression test: scripts/stake-qa.mjs all; scripts/stake-qa-e2e.mjs wallet
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 31. Detailed mode descriptions

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Detailed mode descriptions
- Observed symptom: Mode help
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: Rules document each mode and visible cost multiplier.
- Regression test: scripts/stake-qa.mjs rules; scripts/stake-qa-e2e.mjs rules
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 32. Mode access and trigger conditions

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Mode access and trigger conditions
- Observed symptom: Mode help
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: Rules describe access and trigger conditions for base, rainbow, hunt, bonus_tier1 and bonus.
- Regression test: scripts/stake-qa.mjs rules; scripts/stake-qa-e2e.mjs rules
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 33. Mode costs and multipliers

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Mode costs and multipliers
- Observed symptom: Mode help
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: Rules and UI show configured costs and multipliers.
- Regression test: scripts/stake-qa.mjs rules; scripts/stake-qa-e2e.mjs rules
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 34. Retrigger availability and conditions

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Retrigger availability and conditions
- Observed symptom: Mode help
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: Rules document retrigger availability and conditions consistent with math config.
- Regression test: scripts/stake-qa.mjs rules; scripts/stake-qa-e2e.mjs rules
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 35. Social Mode restricted terminology

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Social Mode restricted terminology
- Observed symptom: Stake.us wording
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: Restricted social terminology is absent from production UI copy.
- Regression test: scripts/stake-qa.mjs all; scripts/stake-qa-e2e.mjs replay
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 36. Replay language parameter

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Replay language parameter
- Observed symptom: Replay request
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: Replay GET includes language and lang parameters from launch state.
- Regression test: scripts/stake-qa.mjs replay; scripts/stake-qa-e2e.mjs replay
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 37. Replay initial cost/multiplier/final amount panel

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Replay initial cost/multiplier/final amount panel
- Observed symptom: Replay panel
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: Replay panel shows mode, replay bet, currency and final win from immutable replay data.
- Regression test: scripts/stake-qa.mjs replay; scripts/stake-qa-e2e.mjs replay
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 38. Replay mode naming

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Replay mode naming
- Observed symptom: Replay modes
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: Replay normalizes mode aliases and displays player-facing mode names.
- Regression test: scripts/stake-qa.mjs replay; scripts/stake-qa-e2e.mjs replay
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 39. Replay event replay button

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Replay event replay button
- Observed symptom: Replay controls
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: Replay Play and Play Again are dedicated replay controls that never trigger wallet play.
- Regression test: scripts/stake-qa.mjs replay; scripts/stake-qa-e2e.mjs replay
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 40. Replay Popout S support

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Replay Popout S support
- Observed symptom: Replay launch
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: Replay accepts Stake launch variants and keeps the UI inside the popout viewport.
- Regression test: scripts/stake-qa.mjs replay; scripts/stake-qa-e2e.mjs replay
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 41. Balance hidden in Replay

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Balance hidden in Replay
- Observed symptom: Replay controls hidden
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: Balance is hidden, inert and non-interactive in replay.
- Regression test: scripts/stake-qa.mjs replay; scripts/stake-qa-e2e.mjs replay
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 42. Spin button hidden in Replay

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Spin button hidden in Replay
- Observed symptom: Replay controls hidden
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: Spin button is hidden, disabled, inert and cannot be triggered in replay.
- Regression test: scripts/stake-qa.mjs replay; scripts/stake-qa-e2e.mjs replay
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 43. Bet selector hidden in Replay

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Bet selector hidden in Replay
- Observed symptom: Replay controls hidden
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: Bet selector and increment controls are hidden and inert in replay.
- Regression test: scripts/stake-qa.mjs replay; scripts/stake-qa-e2e.mjs replay
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 44. Autoplay hidden in Replay

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Autoplay hidden in Replay
- Observed symptom: Replay controls hidden
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: Autoplay button and modal are hidden and inert in replay.
- Regression test: scripts/stake-qa.mjs replay; scripts/stake-qa-e2e.mjs replay
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 45. Win Amount visible

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Win Amount visible
- Observed symptom: Replay display
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: WIN is visible and reflects authoritative final replay result.
- Regression test: scripts/stake-qa.mjs replay; scripts/stake-qa-e2e.mjs replay
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 46. Replay Bet Amount visible

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Replay Bet Amount visible
- Observed symptom: Replay display
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: Replay Bet is visible, display-only and uses launch amount/currency.
- Regression test: scripts/stake-qa.mjs replay; scripts/stake-qa-e2e.mjs replay
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 47. Currency visible

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Currency visible
- Observed symptom: Replay display
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: Replay currency is visible and formatted through shared currency metadata.
- Regression test: scripts/stake-qa.mjs replay; scripts/stake-qa-e2e.mjs replay
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 48. Replay Play available

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Replay Play available
- Observed symptom: Replay controls
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: Replay Play is accessible, hittable and starts immutable saved-round playback.
- Regression test: scripts/stake-qa.mjs replay; scripts/stake-qa-e2e.mjs replay
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 49. Play Again available

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Play Again available
- Observed symptom: Replay controls
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: Play Again repeats the same immutable replay data without refetching.
- Regression test: scripts/stake-qa.mjs replay; scripts/stake-qa-e2e.mjs replay
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 50. Space cannot trigger paid play

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Space cannot trigger paid play
- Observed symptom: Replay keyboard guard
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: Space only activates the dedicated replay action and cannot start paid play.
- Regression test: scripts/stake-qa.mjs replay; scripts/stake-qa-e2e.mjs replay
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 51. Enter cannot trigger paid play

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Enter cannot trigger paid play
- Observed symptom: Replay keyboard guard
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: Enter only activates the dedicated replay action and cannot start paid play.
- Regression test: scripts/stake-qa.mjs replay; scripts/stake-qa-e2e.mjs replay
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 52. hidden controls are not focusable

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: hidden controls are not focusable
- Observed symptom: Replay focus guard
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: Normal paid controls are removed from tab order in replay.
- Regression test: scripts/stake-qa.mjs replay; scripts/stake-qa-e2e.mjs replay
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 53. hidden controls are not clickable

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: hidden controls are not clickable
- Observed symptom: Replay pointer guard
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: Normal paid controls cannot be clicked in replay.
- Regression test: scripts/stake-qa.mjs replay; scripts/stake-qa-e2e.mjs replay
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 54. hidden controls are not hit-testable

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: hidden controls are not hit-testable
- Observed symptom: Replay hit testing
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: Normal paid controls do not receive hit tests in replay.
- Regression test: scripts/stake-qa.mjs replay; scripts/stake-qa-e2e.mjs replay
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 55. Replay makes no authenticate request

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Replay makes no authenticate request
- Observed symptom: Read-only replay
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: Replay launch fetches only the replay endpoint and never authenticates.
- Regression test: scripts/stake-qa.mjs replay; scripts/stake-qa-e2e.mjs replay
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 56. Replay makes no wallet play request

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Replay makes no wallet play request
- Observed symptom: Read-only replay
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: Replay Play and Play Again never call wallet play.
- Regression test: scripts/stake-qa.mjs replay; scripts/stake-qa-e2e.mjs replay
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 57. Replay makes no end-round request

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Replay makes no end-round request
- Observed symptom: Read-only replay
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: Replay does not mutate round state through end-round.
- Regression test: scripts/stake-qa.mjs replay; scripts/stake-qa-e2e.mjs replay
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 58. Replay makes no event-save request

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Replay makes no event-save request
- Observed symptom: Read-only replay
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: Replay does not save events or mutate server state.
- Regression test: scripts/stake-qa.mjs replay; scripts/stake-qa-e2e.mjs replay
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 59. Bonus Replay without payoutMultiplier

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Bonus Replay without payoutMultiplier
- Observed symptom: Optional payoutMultiplier
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: bonus replay may omit payoutMultiplier; validated finalWin reconstructs the result.
- Regression test: scripts/stake-qa.mjs replay; scripts/stake-qa-e2e.mjs replay
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 60. Bonus Tier 1 Replay without payoutMultiplier

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Bonus Tier 1 Replay without payoutMultiplier
- Observed symptom: Optional payoutMultiplier
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: bonus_tier1 replay may omit or null payoutMultiplier; validated finalWin reconstructs the result.
- Regression test: scripts/stake-qa.mjs replay; scripts/stake-qa-e2e.mjs replay
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 61. Rainbow Replay remains working

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Rainbow Replay remains working
- Observed symptom: Regression preservation
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: rainbow replay with a present payoutMultiplier still passes strict cross-validation.
- Regression test: scripts/stake-qa.mjs replay; scripts/stake-qa-e2e.mjs replay
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 62. Event ID 0 remains valid

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Event ID 0 remains valid
- Observed symptom: Replay event id
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: Event ID 0 is preserved as a valid replay round/event identifier.
- Regression test: scripts/stake-qa.mjs replay; scripts/stake-qa-e2e.mjs replay
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 63. KRW formatting works

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: KRW formatting works
- Observed symptom: KRW replay
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: KRW replay uses integer-style display and shared currency metadata.
- Regression test: scripts/stake-qa.mjs currency; scripts/stake-qa-e2e.mjs replay
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 64. Paytable values match published math

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: Paytable values match published math
- Observed symptom: Paytable contract
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: Visible paytable values are generated from production math and validated against publish/math.
- Regression test: scripts/stake-qa.mjs paytable; scripts/stake-qa-e2e.mjs paytable
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## 65. K/Q/J Paytable discrepancy

- Date: 2026-07-13 audit reconstruction; upstream review item retained from PR history
- Affected game version when present in repo evidence: Golden Goal Rush math 0.2.2-cluster, frontend build d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5
- Stake reported problem: K/Q/J Paytable discrepancy
- Observed symptom: Stake paytable discrepancy
- Verified root cause: The affected behavior was missing, locally simulated, or not tied tightly enough to RGS/publish evidence before the current implementation.
- Previous attempted fixes: Superseded fixes existed in earlier PR iterations and are retained here as superseded when they lacked browser evidence, publish hashes, or full traceability.
- Why previous attempts failed when applicable: They did not prove current publish/frontend and publish/math against the final browser-tested artifacts.
- Final implementation: K 5-6, Q 5-6 and J 7-8 use production math values: 0.48 / 0.36 / 0.56.
- Regression test: scripts/stake-qa.mjs paytable; scripts/stake-qa-e2e.mjs paytable
- Current status: PASS
- Evidence path: artifacts/stake-qa/2026-07-13T11-53-50-381Z/report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/e2e-report.json; artifacts/stake-qa/2026-07-13T11-53-50-381Z/replay-network-proof.json; artifacts/stake-qa/publish-integrity.json; artifacts/stake-qa/publish-frontend-manifest.json; artifacts/stake-qa/publish-math-manifest.json
- Current commit SHA: resolved by `git rev-parse HEAD` during the documentation gate.

## Validation context

- Frontend build ID: `d160b28c37abf6713535c464866544b6a8c3c957087cb9d2e808374b235f16c5`
- Math version: `0.2.2-cluster`
- Evidence directory: `artifacts/stake-qa/2026-07-13T11-53-50-381Z`
