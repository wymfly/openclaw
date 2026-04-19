# Cutover Checklist

Do not switch the default Deck implementation until every item below is satisfied.

## Mandatory gates

- [ ] Zero unresolved `must-match` parity failures on cutover-critical workflows
- [ ] E2E smoke passes on all canonical cutover-critical workflows
- [ ] Chat/replay parity is green
- [ ] Deployment simplification targets are met on supported environments
- [ ] Rollback procedure has been rehearsed successfully
- [ ] Two-week stabilization window passes with no Sev-1/Sev-2 regressions attributable to `deck-go`

## Evidence links

- PRD: `.omx/plans/prd-deck-go-parallel-migration.md`
- Test Spec: `.omx/plans/test-spec-deck-go-parallel-migration.md`
- Parity Matrix: `deck-go/docs/parity-matrix.md`
- Rollback Runbook: `deck-go/docs/rollback-runbook.md`
- Deployment Baseline: `deck-go/docs/deployment-baseline.md`
