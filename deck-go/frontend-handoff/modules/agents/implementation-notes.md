# agents - implementation notes

## Baseline decision

`deck-go-frontend-agents-rebuild` remains the engineering baseline. This change does not repeat the contract migration or recreate the shared agents store. It reuses:

- `frontend-new/src/components/panels/agents/AgentsPanel.tsx`
- `frontend-new/src/components/panels/agents/agents-panel-state.ts`
- `frontend-new/src/stores/agents.ts`
- `frontend-new/src/stores/agents-metrics.ts`
- agents wrappers in `frontend-new/src/api.ts`
- agents DTO aliases in `frontend-new/src/api-types.ts`
- existing focused agents tests

## Current baseline UI record

Before this pass, the production agents panel rendered as a padded list card plus a separate detail grid. It had usable list/detail/create/delete flows, but no mock visual E2E, no fresh Codex-owned high-fidelity target, no metrics/workbench visual treatment, and stale handoff docs that still described unsupported ideal v2 fields.

## Design-system adaptation map

| Handoff concept              | Production mapping                             |
| ---------------------------- | ---------------------------------------------- |
| `Switch`                     | canonical `Toggle`                             |
| avatar / initials            | local molecule                                 |
| metric tile                  | local molecule                                 |
| row summary                  | local molecule                                 |
| detail hero                  | local molecule                                 |
| section header               | local molecule                                 |
| preview/file/permission rows | local molecules                                |
| status dot                   | local CSS element using existing status tokens |

## Deterministic drift to fix

- Handoff docs no longer treat server-side `agents.list` query, composite hashes, and v2 skill mode semantics as available.
- Mock gateway now returns multiple contract-shaped agents with optional counters/status values; missing optional values still render as unavailable.
- Production visual rhythm now uses the revised workbench structure: metrics strip, left list card, right selected-detail card, and compact section rows.

## Mock visual evidence

`pnpm exec playwright test --config deck-go/playwright.config.ts deck-go/test/e2e/agents-visual.spec.ts` passed after rerun outside the macOS sandbox. The first sandboxed run failed before assertions because Chromium could not register its macOS Mach port rendezvous service.

Screenshots:

- `test-results/agents-visual-agents-mock--15cf7-h-contract-shaped-mock-data/agents-workbench-ready.png`
- `test-results/agents-visual-agents-mock--15cf7-h-contract-shaped-mock-data/agents-create-dialog.png`

This is mock visual coverage only. It does not prove real Gateway or real LLM behavior.

## Design-system feedback

No canonical token, atom, or pattern was added in this pass.

Local molecules to watch during routing/subagents:

- `agent-metric`
- selected agent detail/nav card
- section header with helper/action
- preview/file/permission row rhythm
- status dot vocabulary

## Follow-up watch items

- Promote metric tile / section header / preview row only after routing or subagents repeats the pattern.
- Consider real Gateway agents E2E separately after mock visual quality converges.
- Consider server-side `agents.list` query only if scale requires it.
