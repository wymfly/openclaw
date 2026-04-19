# Legacy Freeze Policy

`dashboard/` is the legacy reference implementation during migration.

## Allowed changes

- critical production fixes
- security fixes
- upstream syncs required by repo health
- changes required to preserve parity fixture quality

## Disallowed changes

- opportunistic refactors
- net-new feature work unless explicitly approved for both stacks
- transport semantic changes without parity review

## Merge authority on migrated cutover-critical surfaces

Any PR touching a migrated cutover-critical workflow in `dashboard/` requires:

- one linked `deck-go` parity issue or explicit parity note
- review from the migration owner for that surface
- fixture regeneration if user-visible or API-visible behavior changes

Merge is blocked if the change introduces unclassified parity drift.

## Mirroring policy

- If a legacy fix changes user-visible behavior on a migrated surface, evaluate parity impact immediately.
- If a legacy fix touches a migrated surface, create a `deck-go` follow-up before merge.
- If a legacy-only fix is intentionally not copied, mark it explicitly in the parity matrix.
- If a legacy fix changes transport, stream, bootstrap, config load/save, or chat rendering semantics, parity fixtures must be regenerated before merge.
