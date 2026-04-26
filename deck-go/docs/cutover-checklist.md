# Cutover Checklist

Do not switch the default Deck implementation until every item below is satisfied.

## Current Stage 3 host prerequisites already satisfied

- [x] `deck-go/frontend` is the active host path
- [x] every panel id in `frontend/src/deck-ui/panel-registry.tsx` is routable through `ActivePanelHost` / `panel-component-registry.tsx`
- [x] `frontend/src/deck-ui/panel-readiness.ts` keeps every active panel at `ready`
- [x] default frontend build enforces deck-ui host structural guards
- [x] default repo verify enforces active-host retirement away from `frontend-next`
- [x] Codex Playwright plugin E2E replaces shell-launched host smoke for
      Codex/Ralph validation

## Mandatory gates

- [x] Zero unresolved `must-match` parity failures on cutover-critical workflows
- [x] Codex Playwright plugin E2E passes on canonical cutover-critical workflows
- [x] Chat/replay parity is green
- [x] Deployment simplification targets are met on supported environments
- [x] Rollback procedure has been rehearsed successfully

Stage 3 closure is now earned once the mandatory gates above are green.

## Follow-on validation

- [ ] Optional two-week stabilization window with no Sev-1/Sev-2 regressions attributable to `deck-go`

## Evidence links

- PRD: `.omx/plans/prd-deck-go-stage3-vite-host-migration.md`
- Test Spec: `.omx/plans/test-spec-deck-go-stage3-vite-host-migration.md`
- Parity Matrix: `deck-go/docs/parity-matrix.md`
- Rollback Runbook: `deck-go/docs/rollback-runbook.md`
- Deployment Baseline: `deck-go/docs/deployment-baseline.md`
- Stabilization Window: `deck-go/docs/stage3-stabilization-window.md`
- Stabilization Ledger: `deck-go/docs/stage3-stabilization-window.json`
- Repo-root stabilization status wrapper: `make deck-go-stage3-stabilization`
- Repo-root stabilization enforcement wrapper: `make deck-go-stage3-stabilization-enforce`
- Repo-root stabilization incident wrapper: `make deck-go-stage3-record-incident DATE=... SEVERITY=... SUMMARY=...`
- Default repo gate: `cd deck-go && make verify`
- Canonical Codex/Ralph browser E2E: latest Codex Playwright plugin proof on
  foreground stack `62811/62812/18811`; the run verified high-value panel
  rendering, direct API 200s including `/api/usage/sessions` and
  `/api/deck/commands/discover`, and real Chat send/receive
  `959595 -> 959596` with console 0 errors / 0 warnings. Historical artifacts
  remain: `deck-go-plugin-core-panels-62611-62612-v2.json`,
  `deck-go-plugin-chat-send-62611-62612.json`, and
  `deck-go-plugin-console-62611-62612.log`
- Disabled for Codex/Ralph validation: `cd deck-go && make
smoke-stage3-host`, `cd deck-go && make smoke-stage3-e2e`,
  `make deck-go-stage3-host`, `make deck-go-stage3-e2e`, and `cd deck-go &&
make stack-chat-smoke`
- Rollback rehearsal smoke: `cd deck-go && make smoke-stage3-rollback`
- Stabilization status check: `cd deck-go && make check-stage3-stabilization`
- Stabilization enforcement check: `cd deck-go && make enforce-stage3-stabilization`
- Stabilization incident record: `cd deck-go && make record-stage3-stabilization-incident DATE=... SEVERITY=... SUMMARY=...`
