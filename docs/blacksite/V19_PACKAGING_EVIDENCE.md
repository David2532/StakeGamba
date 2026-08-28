# BLACKSITE V19 packaging and evidence contract

Status: `IMPLEMENTING` / package release decision `BLOCKED`

This contract creates a new V19 technical candidate without mutating or relabelling the verified V18 outputs. It is intentionally fail-closed: a successful package identity check is not a visual approval, Stake approval, upload authorization or release decision.

## Pinned V18 baseline

The machine-readable source of truth is `V19_PACKAGE_CONTRACT.json`.

| Identity | Pinned value |
| --- | --- |
| V18 commit | `1edbc06c699bd6f1bbbd248cc16ac0c5dbe1ed94` |
| V18 frontend tree | `65c5bd22b41edf9a4ba5332bc8d44c823b9382254fab08b4c95d43a9a480e88f` |
| V18 frontend shape | 360 files / 22,158,429 bytes |
| V18 math tree | `778c128a547adbfdddb038e05957e206ae129dff2941df98a2aca3ee36276297` |
| V18 math shape | 7 files / 4,429,320 bytes |

Run the read-only baseline gate at any time:

```sh
pnpm blacksite:v19:baseline
```

It verifies both retained V18 upload roots and the repository's seven canonical math payload files. Any byte, path, count or tree mismatch fails.

## Exact V19 output roots

The tools derive one fixed output parent: the parent directory of this repository. They accept no alternate output path and refuse to overwrite an existing target.

- `BLACKSITE_FRONTEND_UPLOAD_V19`
- `BLACKSITE_MATH_UPLOAD_V19`
- `BLACKSITE_V19_EVIDENCE`

The V18 roots remain untouched. Staging is limited to a direct sibling with the reserved `.BLACKSITE_V19_STAGE_` prefix and is promoted only after all copy/hash checks pass.

## Final frontend acceptance

The contract deliberately contains no pre-approved V19 frontend hash: `frontendAcceptance.treeSha256` is `null` and its state is `UNBOUND_UNTIL_FINAL_BUILD`.

After the final V19 implementation commit:

1. start from that exact clean commit;
2. run the final frontend build;
3. obtain the build tree SHA-256 with the read-only final-build hash command;
4. pass the full commit and tree hashes explicitly to the packager;
5. include the explicit final-tree acknowledgement flag.

```sh
pnpm --filter blacksite build
pnpm blacksite:v19:frontend-tree
node scripts/blacksite-v19-package-candidate.mjs \
  --expected-commit <full-v19-commit-sha> \
  --expected-frontend-tree <fresh-final-build-tree-sha256> \
  --accept-final-build-tree
```

The packager rejects:

- a dirty checkout;
- a SHA other than the checked-out full commit;
- the unchanged V18 commit;
- a commit that is not descended from the pinned V18 commit;
- a missing or differently hashed frontend build;
- a frontend tree equal to V18;
- any changed V18 or repository math byte;
- an existing V19 output root.

The acknowledgement proves only that the caller intentionally bound the exact build hash. It does not certify the build as visually approved.

## V18-identical math policy

V19 does not regenerate, reinterpret or modify math. The packager copies the verified `BLACKSITE_MATH_UPLOAD_V18` folder only after both it and the repository payload match the pinned seven-file manifest. The staged and final V19 math tree must remain:

`778c128a547adbfdddb038e05957e206ae129dff2941df98a2aca3ee36276297`

Any intended math/gameplay change is outside V19 packaging scope and requires its own Stake-controlled math lifecycle.

## Exact package verification

From the same clean packaged commit, after any extracted-browser/manual evidence files intended for this candidate have been placed in `BLACKSITE_V19_EVIDENCE`:

```sh
node scripts/blacksite-v19-package-verify.mjs --write-result
```

The candidate manifest hashes a four-file bootstrap evidence payload without self-reference. The final verifier additionally hashes the complete evidence bundle before its own result, including the candidate manifest and any QA/manual evidence added for this candidate. It also re-hashes V18, repository math, V19 frontend, V19 math and the package contract, and checks the exact output names plus fail-closed lifecycle fields. Its strongest success state is `PASS_PACKAGE_IDENTITY_ONLY`.

The optional written result is `BLACKSITE_V19_EVIDENCE/V19_PACKAGE_VERIFY_RESULT.json`. It is created once and never overwritten. Adding or changing evidence after that result makes its recorded evidence tree stale; create a new superseding candidate rather than mutating a sealed one.

## Truthful gate state

Package generation always records:

- lifecycle `V19_TECHNICAL_CANDIDATE_NOT_RELEASE`;
- release decision `BLOCKED`;
- `releaseReady: false`;
- `uploadAuthorized: false`;
- extracted-package browser QA `NOT_RUN`;
- manual visual/device/animation/audio/provenance gates `OPEN`;
- Stake/ACP/Slack/live gates `EXTERNAL_PENDING`.

These fields do not turn green automatically when package identity passes. Exact extracted-browser QA, the complete 51-point evidence matrix, human visual/device review and external Stake lifecycle evidence remain separate required gates.

## Supersession and retry policy

The tools never overwrite a V19 output. If a technical candidate is superseded, move all three old V19 roots together to an explicitly labelled archive outside the canonical output names, then rerun from the new clean commit. Do not mix one candidate's frontend with another candidate's evidence or math root.
