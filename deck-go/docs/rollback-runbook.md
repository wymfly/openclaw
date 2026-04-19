# Rollback Runbook

Rollback target: restore legacy `dashboard/` as the default Deck implementation.

## Rollback triggers

- transcript or replay corruption
- send/abort unreliability on critical paths
- config corruption or loss
- repeated reconnect failures that break operator workflow
- install or upgrade path failure on supported environments

## Rehearsal requirements

- rollback must be rehearsed before cutover
- rehearsal must verify that the legacy stack can be restored without losing required operator functionality

## Checklist

- [ ] Legacy `dashboard/` remains runnable throughout stabilization window
- [ ] Legacy launch procedure is documented
- [ ] Traffic/default switchback procedure is documented
- [ ] Config/data compatibility checks are documented
- [ ] Operator-visible validation after rollback is documented
