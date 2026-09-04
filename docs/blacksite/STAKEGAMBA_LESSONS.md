# StakeGamba Lessons — What BLACKSITE Must Inherit

Purpose: convert the expensive Golden Goal Rush debugging/review history into permanent engineering policy for the next slot.

This is not a copy plan. BLACKSITE reuses **verified infrastructure patterns and failure lessons**, not Golden Goal Rush's theme, assets or math.

## 1. Candidate identity is part of correctness

Golden Goal Rush repeatedly demonstrated that a correct source tree is not enough if the uploaded/tested package came from another commit.

Permanent rule:

`source commit = checkout commit = tested commit = built commit = packaged commit`

Every release candidate records:
- git SHA;
- frontend archive/file/tree digest;
- math archive/file/tree digest;
- evidence digest;
- exact mode/config identity;
- CI run IDs;
- extracted-package retest result;
- manual-review record.

Old candidate hashes become explicitly superseded and must not remain ambiguous upload choices.

## 2. Paid RGS mode may never silently fall back to local simulation

Historical failure pattern: a game can appear playable while no longer representing Stake wallet/RGS authority.

BLACKSITE policy:
- local simulation/fixtures are DEV/Storybook/explicit fixture mode only;
- an auth/play/RGS failure in paid mode becomes a visible bounded error state;
- bonus/feature modes use RGS `/play` exactly like base play with their canonical mode/cost;
- no generated client RNG decides payout-bearing outcomes in production.

## 3. Visible payout must equal authoritative payout

Historical problem: browser win presentation could disagree with the actual play/round contract, or animation could crash while balance still updated.

BLACKSITE policy:
- render winning positions/amounts from book/RGS events;
- final displayed win must reconcile to authoritative `payoutMultiplier`/round state;
- frontend never repairs contradictory math by inventing a different payout;
- contradictory payload/book data fails closed in QA and should fail loudly in development;
- no animation exception may prevent settlement/result UI cleanup.

## 4. End-round is a lifecycle decision, not a win/loss decision

Golden Goal Rush feedback exposed the danger of associating settlement with presentation outcome.

BLACKSITE policy:
- `round.active`, mode auto-close contract and RGS response govern settlement;
- zero-win vs non-zero-win alone is never the decision source;
- active interrupted rounds can resume without another play/debit;
- settlement executes at most once;
- restored rounds retain original amount/mode/currency/event progress;
- event persistence (`/bet/event` where applicable) is idempotent and bounded.

## 5. Replay is a separate read-only product surface

Replay bugs are especially easy when live-play utilities are reused without a strict boundary.

BLACKSITE policy:
- Replay never calls authenticate/play/end-round/event-save;
- canonicalize mode aliases at the boundary;
- `costMultiplier`, query amount, final play amount and final win remain exact;
- support decimal/fractional display cases;
- deterministic playback may skip live-only blocking overlays but must preserve the actual result sequence;
- Play Again resets presentation only;
- Replay gets its own Social Mode, Popout and currency tests.

## 6. Money precision needs two display policies

A key Golden Goal Rush finding was a valid tiny win being rounded from `$0.0496` to `$0.05`, while ordinary balance display did not need the same precision.

BLACKSITE policy:
- maintain integer RGS money units internally at the API boundary;
- define explicit helpers for `displayBalance`, `displayPlayAmount`, `displayWin` and `displayMultiplier`;
- visible win precision must preserve exact sub-cent payouts required by the minimum bet × minimum payout multiplier;
- do not globally increase every number to four decimals just to solve the win meter;
- add fractional replay cases such as non-two-decimal play amounts/final wins.

## 7. Social Mode is not a string-replacement afterthought

Golden Goal Rush needed checks across first render, information, paytable, replay, currencies and accessibility text.

BLACKSITE policy:
- Social terminology is represented in a dedicated phrase layer;
- `social=true` selects the approved social vocabulary from initial boot;
- XGC/XSC/XEC formatting never gains a fiat `$` prefix;
- scan rendered DOM, hidden accessibility strings, modal text, error text and Replay;
- Social Mode language policy is explicitly tested rather than inherited from normal localization.

## 8. Rules must be generated/validated from shipped math

Historical risk: hardcoded max-win/paytable text drifted from actual books/modes.

BLACKSITE policy:
- canonical mode metadata has one source of truth;
- rules/panel values for cost, RTP and Max Win are generated from or strictly cross-checked against shipped config/audit;
- paytable numeric fields are contract-tested;
- each mode's positive-weight maximum in lookup/books must equal the advertised/allowed maximum;
- natural feature rounds are described according to the originating round/mode contract, not invented UI tiers.

## 9. Book/lookup/index integrity is a release blocker

A historical upload error included missing `index.json`; other work hardened book/lookup identity and numeric contracts.

BLACKSITE policy:
- math package root always contains the current required `index.json`;
- exact mode set equality across index/config/audit/books/lookups;
- exact ID set equality;
- strict integer/numeric types where required;
- lookup payout == book payout for every ID;
- no duplicate IDs, empty books, negative weights or zero-weight-only advertised outcomes;
- zstd extraction/readback tested from the actual upload package.

## 10. Max Win must be real, selectable and mode-correct

Do not merely place a 10,000× constant in UI.

BLACKSITE policy:
- generate accepted max-win books for every mode that advertises that max;
- ensure positive lookup probability and reasonable publication/approval achievability constraints;
- derive displayed Max Win per mode from actual published outputs;
- test runtime/replay/restore fail-closed above mode cap;
- maintain complete-round cap logic where a round includes nested feature play.

## 11. Math RTP is not enough; distribution behaviour matters

Golden Goal Rush could hit its target RTP exactly while still showing severe short-run GGR swings.

BLACKSITE policy:
- calculate RTP per mode exactly from published lookup weights;
- report hit rate, no-win rate, payout buckets normalized by **mode cost**, variance/stddev, quantiles, tail contribution and max-win odds;
- simulate short windows and sessions for risk visibility;
- optimize distributions only through published fixed outcome weights/conditions, never player/history-adaptive logic;
- preserve gameplay quality while controlling undesirable tail concentration.

## 12. Do not judge a bonus mode with raw absolute payout buckets

A 95×-cost feature and a 1× base spin cannot share intuitive labels such as `0–1x` unless the statistic is normalized.

Permanent reporting rule:

`normalized return = payout multiplier / mode cost`

Use both raw payout multiplier and cost-normalized return where useful, but label them unambiguously.

## 13. Mobile needs recomposition, not uniform shrinking

Golden Goal Rush eventually required board-first portrait layout, native-size dialogs, touch target gates and landscape corrections.

BLACKSITE policy:
- responsive layouts are authored compositions;
- keep board readable and controls touchable;
- preserve safe areas;
- do not allow desktop side-character art to crush the board on portrait;
- modal/rules text must remain readable rather than inheriting whole-stage scale;
- Popout S/L are explicit viewports, not accidental consequences of CSS scaling.

## 14. Major actions require explicit confirmation

Reuse the proven pattern:
- autoplay requires selection + explicit confirmation;
- high-cost feature modes show exact cost and require explicit confirmation;
- Cancel, Escape and backdrop dismissal mean Cancel;
- confirmation must complete before any play request can leave the browser.

## 15. Deterministic fixtures are a force multiplier

Waiting for RNG made rare-state frontend iteration unnecessarily expensive.

BLACKSITE policy:
- rare states have direct fixture/replay URLs;
- Animation/Creative agents can repeatedly inspect the same state;
- fixture state uses real event shapes and assets but never leaks into production paid-play path;
- review screenshots come from deterministic named states.

## 16. Browser tests must prove what reviewers actually see

A large test count can still miss the exact stakeholder finding.

BLACKSITE QA requires assertions at the layer of the requirement:
- text actually visible/readable;
- control physically clickable at viewport center/target point;
- board not clipped/distorted;
- exact network call count/order;
- actual currency string;
- actual win amount;
- actual Replay content;
- screenshot evidence for visual issues;
- extracted package, not only dev server.

## 17. Release QA must be honest about infrastructure failures

If required CI is cancelled, skipped or externally fails, do not convert local success into `READY`.

Use lifecycle states and distinguish:
- repository failure;
- CI/provider outage;
- manual review missing;
- Stake approval missing;
- publication missing.

Fail closed where an exact required gate did not complete.

## 18. Visual polish needs its own acceptance bar

Golden Goal Rush became technically strong, but BLACKSITE should make art/animation quality a first-class contract from M0.

Permanent rules:
- no placeholder SVG/CSS-box final art;
- no generic AI-gradient/emoji look;
- consistent authored style across symbols, board, UI, character, tile and cinematic;
- production character animation uses a real rig/state plan;
- visual effects support readable gameplay instead of hiding it;
- exact viewports are visually reviewed in addition to automation.

## 19. Asset inventory precedes deep UI work

A prior workflow requirement correctly demanded scanning/inventorying all available assets before wiring UI.

BLACKSITE policy:
- every production asset exists in an asset manifest;
- paths are relative and static-build-safe;
- zero final asset 404s;
- no absolute developer-machine paths;
- no ambiguous duplicate legacy assets in release output;
- asset provenance/originality is documented.

## 20. Keep the new game isolated from the released one

BLACKSITE can reuse framework packages and generalized QA, but it must have:
- separate app/game identity;
- separate math game folder/output;
- separate assets;
- separate rules/copy;
- separate evidence/candidate package;
- separate release lifecycle.

A BLACKSITE change must not silently mutate Golden Goal Rush's already-reviewed math/gameplay.
