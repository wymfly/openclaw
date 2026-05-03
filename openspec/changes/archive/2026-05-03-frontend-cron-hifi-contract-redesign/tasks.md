## 1. Contract And Baseline

- [x] 1.1 Record the current Cron contract chain from Deck-facing DTOs, Go BFF handlers, frontend API wrappers, UI metadata, and generated Gateway typed cron methods.
- [x] 1.2 Confirm deterministic drift in mock Gateway cron data or endpoint classification; fix only if found.
- [x] 1.3 Identify unsupported or uncertain real Gateway cron payload behavior and document it for handoff.

## 2. Handoff Package

- [x] 2.1 Create `frontend-handoff/modules/cron/README.md` with status, contract truth, workflow constraints, implementation notes, and open questions.
- [x] 2.2 Create `prototype.html` as a high-fidelity scheduler operations workbench aligned with the current design-system posture.
- [x] 2.3 Create `components.md`, `states.md`, `interactions.md`, and `api-usage.md` covering scheduler status, job catalog, job form, selected job detail, run history, heartbeat, action result, and empty/error/loading states.

## 3. Production Cron UI

- [x] 3.1 Rewrite `CronPanel` and local Cron subcomponents around the handoff workspace while preserving load, selection, tab switching, create/update/run/delete, guarded confirmation, template application, and raw detail behavior.
- [x] 3.2 Restyle scheduler metrics, job rows, form sections, tabs, selected job hero, run history, heartbeat, and action result with design-system tokens/local classes without widening public API unnecessarily.
- [x] 3.3 Replace obsolete Cron global styling with module-local or narrowed CSS using `--ds-*` tokens and responsive constraints.
- [x] 3.4 Preserve or update Cron unit tests for load/select, run/delete confirmation, template application, create/update payloads, run history, heartbeat, and error behavior.

## 4. Mock Visual Verification

- [x] 4.1 Add contract-shaped `cron.*` methods to the mock Gateway if visual E2E gaps are found.
- [x] 4.2 Add a focused Cron mock visual E2E covering the ready workspace and at least one interaction state such as run-history inspection, heartbeat tab, template selection, selected-job switch, or manual run result.
- [x] 4.3 Inspect generated screenshots for text overlap, blank panes, density problems, and incorrect mock-only labeling.

## 5. Design-System Feedback

- [x] 5.1 Update the cross-module readiness record with Cron evidence, repeated scheduler/job/form/history molecules, and promotion candidates.
- [x] 5.2 Update the OpenSpec design-system delta target if implementation changes the readiness requirement details.

## 6. Verification

- [x] 6.1 Run `openspec validate frontend-cron-hifi-contract-redesign --strict`.
- [x] 6.2 Run focused Cron unit tests and mock visual E2E.
- [x] 6.3 Run the relevant frontend build checks and confirm the change is archive-ready.
