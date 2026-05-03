## 1. Contract And Baseline

- [x] 1.1 Record the current Alerts contract chain from Deck-facing DTOs, Go BFF handlers, local store adapters, frontend API wrappers, and UI metadata.
- [x] 1.2 Confirm deterministic drift in mock/local E2E data seeding or endpoint behavior for alert rules, create, update, toggle, and delete; fix only if found.
- [x] 1.3 Identify unsupported or uncertain real alert delivery, webhook delivery, escalation, fired-history, and incident assurance semantics and document them for handoff.

## 2. Handoff Package

- [x] 2.1 Create `frontend-handoff/modules/alerts/README.md` with status, contract truth, workflow constraints, implementation notes, and open questions.
- [x] 2.2 Create `prototype.html` as a high-fidelity alert policy workbench aligned with the current design-system posture.
- [x] 2.3 Create `components.md`, `states.md`, `interactions.md`, and `api-usage.md` covering rule inventory, selected rule detail, trigger expression evidence, rule editing, toggle/delete states, fired-history fallback, empty/error/loading states, and mock/local visual states.

## 3. Production Alerts UI

- [x] 3.1 Rewrite `AlertsPanel` and local Alerts subcomponents around the handoff workspace while preserving load, selection, create, edit, toggle, delete confirmation, validation, fired-history fallback, and i18n behavior.
- [x] 3.2 Restyle alert metrics, rule rows, selected rule hero, trigger expression, action/cooldown evidence, rule form controls, fired-history fallback, and destructive confirmation with design-system tokens/local classes without widening public API unnecessarily.
- [x] 3.3 Replace obsolete Alerts global styling with module-local or narrowed CSS using `--ds-*` tokens and responsive constraints.
- [x] 3.4 Preserve or update Alerts unit tests for load/select, create, edit, toggle, delete confirmation, validation, fired-history fallback, error behavior, and localization.

## 4. Mock Visual Verification

- [x] 4.1 Add deterministic E2E seed support for Alerts mock/local visual coverage if existing setup is insufficient.
- [x] 4.2 Add a focused Alerts mock/local visual E2E covering the ready workspace and at least one interaction state such as create, edit, validation, toggle, delete confirmation, selected rule switch, or fired-history fallback.
- [x] 4.3 Inspect generated screenshots for text overlap, blank panes, density problems, and incorrect mock/local evidence labeling.

## 5. Design-System Feedback

- [x] 5.1 Update the cross-module readiness record with Alerts evidence, repeated alert/status/form/fallback molecules, and promotion candidates.
- [x] 5.2 Update the OpenSpec design-system delta target if implementation changes the readiness requirement details.

## 6. Verification

- [x] 6.1 Run `openspec validate frontend-alerts-hifi-contract-redesign --strict`.
- [x] 6.2 Run focused Alerts unit tests and mock/local visual E2E.
- [x] 6.3 Run the relevant frontend build checks and confirm the change is archive-ready.
