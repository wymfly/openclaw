# Activity Implementation Notes

## Implemented

- Production `ActivityPanel` now uses a module-local `activity-panel` workbench layout with three regions: grouped activity timeline, monitor run history, and selected evidence inspector.
- Existing contract-backed data flow was preserved:
  - `fetchActivityEvents`
  - `fetchMonitorRuns`
  - `fetchMonitorRunDetail`
  - `fetchMonitorStats`
  - `useActivitySSE`
- Global `deck-ui-activity` styling was removed from `theme.css`; Activity styling now lives in `activity-panel.css`.
- Existing behavior tests were updated to assert the new local class structure while preserving load/sort/select/filter/pagination/navigation/group/SSE behavior.
- Mock visual E2E was added for ready, collapsed-group, and run-filtered states.

## Implementation Differences From Prototype

- The production panel keeps the existing i18n copy and title hierarchy instead of introducing new labels from the prototype.
- Parsed model diagnostics are rendered only when model stream payloads provide enough schema detail. The current mock run has model-call counts but no parsed model-stat row, so the visual E2E asserts the deterministic run summary instead.
- The timeline and run filters use the current plain input/select controls. No new atom or pattern was promoted in this module pass.

## Open Follow-Ups

- Real Gateway/LLM projection completeness still needs L2 validation outside this mock visual pass.
- Event `data` payload inner schemas are stream-specific. A future contract pass could add typed stream payload schemas if frontend diagnostics need stronger guarantees.
- Metric tile, grouped timeline row, run inventory row, and diagnostic stack are repeated local molecules and should be considered in a separate design-system proposal after more Observe panels converge.
