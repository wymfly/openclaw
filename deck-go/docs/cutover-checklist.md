# Cutover Checklist

Do not switch the default Deck implementation until every item below is satisfied.

## Current Stage 3 host prerequisites already satisfied

- [x] `deck-go/frontend` is the active host path
- [x] every panel id in `frontend/src/restoration/panel-registry.tsx` has a concrete `ActivePanelHost` implementation
- [x] `frontend/src/restoration/contract-readiness.ts` contains `0` `frontend-blocked` families
- [x] default frontend build enforces restored-host structural guards
- [x] default repo verify enforces active-host retirement away from `frontend-next`
- [x] local executable host smoke exists at `make smoke-stage3-host`

## Mandatory gates

- [x] Zero unresolved `must-match` parity failures on cutover-critical workflows
- [x] E2E smoke passes on all canonical cutover-critical workflows
- [x] Chat/replay parity is green
- [x] Deployment simplification targets are met on supported environments
- [x] Rollback procedure has been rehearsed successfully
- [ ] Two-week stabilization window passes with no Sev-1/Sev-2 regressions attributable to `deck-go`

## Evidence links

- PRD: `.omx/plans/prd-deck-go-stage3-vite-host-migration.md`
- Test Spec: `.omx/plans/test-spec-deck-go-stage3-vite-host-migration.md`
- Parity Matrix: `deck-go/docs/parity-matrix.md`
- Rollback Runbook: `deck-go/docs/rollback-runbook.md`
- Deployment Baseline: `deck-go/docs/deployment-baseline.md`
- Stabilization Window: `deck-go/docs/stage3-stabilization-window.md`
- Stabilization Ledger: `deck-go/docs/stage3-stabilization-window.json`
- Repo-root local/private wrapper: `make deck-go-stage3-host`
- Repo-root canonical E2E wrapper: `make deck-go-stage3-e2e`
- Repo-root stabilization status wrapper: `make deck-go-stage3-stabilization`
- Repo-root stabilization enforcement wrapper: `make deck-go-stage3-stabilization-enforce`
- Repo-root stabilization incident wrapper: `make deck-go-stage3-record-incident DATE=... SEVERITY=... SUMMARY=...`
- Default repo gate: `cd deck-go && make verify`
- Local host smoke: `cd deck-go && make smoke-stage3-host`
- Canonical host E2E smoke: `cd deck-go && make smoke-stage3-e2e`
- Rollback rehearsal smoke: `cd deck-go && make smoke-stage3-rollback`
- Stabilization status check: `cd deck-go && make check-stage3-stabilization`
- Stabilization enforcement check: `cd deck-go && make enforce-stage3-stabilization`
- Stabilization incident record: `cd deck-go && make record-stage3-stabilization-incident DATE=... SEVERITY=... SUMMARY=...`
