## 1. Contract And Baseline

- [x] 1.1 Record the current Budget contract chain from Deck-facing DTOs, Go BFF handlers, local runtime adapters, frontend API wrappers, and UI metadata.
- [x] 1.2 Confirm deterministic drift in mock/local E2E data seeding or endpoint behavior for budget rules, evaluations, create, update, and delete; fix only if found.
- [x] 1.3 Identify unsupported or uncertain real billing, usage aggregation, quota enforcement, and production assurance semantics and document them for handoff.

## 2. Handoff Package

- [x] 2.1 Create `frontend-handoff/modules/budget/README.md` with status, contract truth, workflow constraints, implementation notes, and open questions.
- [x] 2.2 Create `prototype.html` as a high-fidelity budget governance workbench aligned with the current design-system posture.
- [x] 2.3 Create `components.md`, `states.md`, `interactions.md`, and `api-usage.md` covering rule inventory, selected rule detail, threshold progress, scoped rule editing, mutation states, empty/error/loading states, and mock/local visual states.

## 3. Production Budget UI

- [x] 3.1 Rewrite `BudgetPanel` and local Budget subcomponents around the handoff workspace while preserving load, selection, create, edit, delete confirmation, validation, evaluation refresh, and i18n behavior.
- [x] 3.2 Restyle budget metrics, rule rows, selected rule hero, threshold progress, scoped form controls, evaluation evidence, and destructive confirmation with design-system tokens/local classes without widening public API unnecessarily.
- [x] 3.3 Replace obsolete Budget global styling with module-local or narrowed CSS using `--ds-*` tokens and responsive constraints if such global styling exists.
- [x] 3.4 Preserve or update Budget unit tests for load/select, create, edit, delete confirmation, validation, evaluation rendering, error behavior, and localization.

## 4. Mock Visual Verification

- [x] 4.1 Add deterministic E2E seed support for Budget mock/local visual coverage if existing mock setup is insufficient.
- [x] 4.2 Add a focused Budget mock/local visual E2E covering the ready workspace and at least one interaction state such as create, edit, validation, delete confirmation, or selected rule switch.
- [x] 4.3 Inspect generated screenshots for text overlap, blank panes, density problems, and incorrect mock/local evidence labeling.

## 5. Design-System Feedback

- [x] 5.1 Update the cross-module readiness record with Budget evidence, repeated budget/status/form molecules, and promotion candidates.
- [x] 5.2 Update the OpenSpec design-system delta target if implementation changes the readiness requirement details.

## 6. Verification

- [x] 6.1 Run `openspec validate frontend-budget-hifi-contract-redesign --strict`.
- [x] 6.2 Run focused Budget unit tests and mock/local visual E2E.
- [x] 6.3 Run the relevant frontend build checks and confirm the change is archive-ready.
