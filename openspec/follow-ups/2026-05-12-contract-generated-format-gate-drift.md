# Contract generated format gate drift

- **Source**: Phase 5 chat reference lock implementation on 2026-05-12.
- **Status**: deferred
- **Category**: dev-script / verification
- **Needs new OpenSpec**: maybe, if the fix changes generator or pre-commit policy.

## Fact Baseline

During Phase 5 implementation, `cd deck-go && make contract-gate` passed only
after regenerating the contract report family with the deck-go sync scripts.
Committing those generated files through `scripts/committer` triggered the
pre-commit formatter on staged generated artifacts. That rewrote
`deck-go/contracts/generated/ts/deck-ui-metadata.generated.ts` away from the
`make ui-metadata-sync` output, so a post-commit `make contract-gate` failed
with:

```text
UI metadata generated artifacts are stale. Run: node contracts/scripts/sync-ui-contract-metadata.mjs
```

The same hook run also removed the earlier `reduce<number>` verification
unblocker in
`deck-go/frontend-new/src/components/panels/sessions/SessionUsageDetails.tsx`,
which restored the known frontend build failure:

```text
src/components/panels/sessions/SessionUsageDetails.tsx(74,20): error TS18046: 'sum' is of type 'unknown'.
```

Separately, successful `make contract-gate` runs rewrite
`deck-go/docs/contract-inventory.json.generatedAt`, leaving a timestamp-only
dirty worktree even when semantic checks pass.

## Suggested Next Step

Pick one deterministic policy for generated contract artifacts:

- make the generators emit already-formatted output compatible with pre-commit;
- exclude generated contract artifacts from pre-commit `oxfmt --write`; or
- change the generated-artifact checks to run after the same formatter that the
  commit hook applies.

Also make `contract-inventory` check-mode deterministic, or stop rewriting
`generatedAt` during gate runs.

## Acceptance Clues

- `make ui-metadata-sync`
- `scripts/committer` on a staged UI metadata generated diff
- `make contract-gate`

should be repeatable without a follow-up dirty worktree or stale generated-file
failure.
