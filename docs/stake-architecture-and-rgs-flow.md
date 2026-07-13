# Stake architecture and RGS flow

Authoritative rule: RGS mode never uses local RNG for authoritative results. `round.active`, not win/loss, controls settlement. Replay mode never authenticates and never mutates wallet or session state.

## Lifecycle diagrams

```mermaid
sequenceDiagram
  participant Browser
  participant Frontend
  participant RGS
  Browser->>Frontend: launch with Stake parameters
  Frontend->>RGS: authenticate
  RGS-->>Frontend: balance, bet config, interrupted round
  Frontend-->>Browser: render authorized state
```

```mermaid
sequenceDiagram
  participant Browser
  participant Frontend
  participant RGS
  Browser->>Frontend: paid play
  Frontend->>RGS: play
  RGS-->>Frontend: round events, active flag, payout
  Frontend->>Frontend: render RGS book
  alt inactive round
    Frontend->>RGS: end-round
  else active round
    Frontend->>Frontend: keep resumable state
  end
```

```mermaid
flowchart TD
  A["Replay launch"] --> B["GET /bet/replay/{game}/{version}/{mode}/{event}"]
  B --> C["Validate game, version, mode, event, amount, currency"]
  C --> D["Validate ordered events and cumulative wins"]
  D --> E["Use finalWin as authoritative book units"]
  E --> F["Cross-check optional payoutMultiplier and explicit payout when present"]
  F --> G["Replay Play from immutable data"]
  G --> H["Play Again without refetch or wallet mutation"]
```

```mermaid
flowchart LR
  A["Source math and frontend"] --> B["Build preview HTML"]
  B --> C["publish/frontend"]
  A --> D["Generated books and lookup tables"]
  D --> E["publish/math"]
  C --> F["Browser QA"]
  E --> F
  F --> G["Documentation and manifest gate"]
  G --> H["Stake upload folders"]
```

## Endpoint contract

| Endpoint | Method | Allowed | Forbidden | Authoritative fields | State transition | Failure behavior | Tests |
| --- | --- | --- | --- | --- | --- | --- | --- |
| /authenticate | POST | RGS paid launch | Replay launch | balance, bet levels, active round | unauthenticated to authenticated | fatal launch error | stake:qa, wallet E2E |
| /play | POST | Paid spin, bonus purchase, feature action | Replay Play, Play Again | events, payout, round.active | idle to rendering/resumable | fatal wallet error | stake:qa, major-actions E2E |
| /end-round | POST | inactive completed RGS round requiring settlement | replay and active resumable rounds | balance, round closed state | active/inactive to settled | visible fatal settlement error | stake:qa interrupted-round |
| /event/save | POST | No production replay use | Replay launch and replay playback | none for replay | no mutation | blocked in replay tests | replay forbidden-network E2E |
| /bet/replay/{game}/{version}/{mode}/{event} | GET | Replay launch including Event ID 0 | Paid play mutation | events, finalWin, amount, currency, optional payoutMultiplier | loading to ready | replay error overlay, no fallback | stake:qa replay |

Visible wins come from authoritative RGS events. `finalWin` is authoritative for replay result book units. A present `payoutMultiplier` is a cross-check only; absent or null values are reconstructed from validated `finalWin`; contradictory present values are rejected.

## Validation context

- Frontend build ID: `e5a3eaf118eb4f89aa83c0315cc6adc1acd2d1f7ef479879eb21d0b80f566b8e`
- Math version: `0.2.2-cluster`
- Evidence directory: `artifacts/stake-qa/2026-07-13T11-24-32-904Z`
