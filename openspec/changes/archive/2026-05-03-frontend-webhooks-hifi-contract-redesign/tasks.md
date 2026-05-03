## 1. Contract And Baseline

- [x] 1.1 Record the current Webhooks contract chain from Deck-facing DTOs, Go admin/BFF handlers, localstore adapter, frontend API wrappers, and UI metadata.
- [x] 1.2 Confirm deterministic drift in mock/local E2E data seeding or endpoint behavior; fix only if found.
- [x] 1.3 Identify unsupported or uncertain real external receiver delivery behavior and document it for handoff.

## 2. Handoff Package

- [x] 2.1 Create `frontend-handoff/modules/webhooks/README.md` with status, contract truth, workflow constraints, implementation notes, and open questions.
- [x] 2.2 Create `prototype.html` as a high-fidelity webhook operations workbench aligned with the current design-system posture.
- [x] 2.3 Create `components.md`, `states.md`, `interactions.md`, and `api-usage.md` covering webhook inventory, receiver detail, event subscriptions, form editing, delivery history, test delivery, delete confirmation, action result, and empty/error/loading states.

## 3. Production Webhooks UI

- [x] 3.1 Rewrite `WebhooksPanel` and local Webhooks subcomponents around the handoff workspace while preserving load, selection, create/update/test/delete, guarded confirmation, delivery loading, and raw detail behavior.
- [x] 3.2 Restyle receiver metrics, webhook rows, selected webhook hero, event subscriptions, form sections, delivery rows, test result, and action result with design-system tokens/local classes without widening public API unnecessarily.
- [x] 3.3 Replace obsolete Webhooks global styling with module-local or narrowed CSS using `--ds-*` tokens and responsive constraints.
- [x] 3.4 Preserve or update Webhooks unit tests for load/select, create/update payloads, test delivery, delete confirmation, delivery history, form event toggles, and error behavior.

## 4. Mock Visual Verification

- [x] 4.1 Add deterministic E2E seed support for Webhooks mock/local visual coverage if existing localstore setup is insufficient.
- [x] 4.2 Add a focused Webhooks mock/local visual E2E covering the ready workspace and at least one interaction state such as delivery-history inspection, form event selection, selected webhook switch, test delivery result, or delete confirmation.
- [x] 4.3 Inspect generated screenshots for text overlap, blank panes, density problems, and incorrect mock/local evidence labeling.

## 5. Design-System Feedback

- [x] 5.1 Update the cross-module readiness record with Webhooks evidence, repeated receiver/delivery/form/action molecules, and promotion candidates.
- [x] 5.2 Update the OpenSpec design-system delta target if implementation changes the readiness requirement details.

## 6. Verification

- [x] 6.1 Run `openspec validate frontend-webhooks-hifi-contract-redesign --strict`.
- [x] 6.2 Run focused Webhooks unit tests and mock/local visual E2E.
- [x] 6.3 Run the relevant frontend build checks and confirm the change is archive-ready.
