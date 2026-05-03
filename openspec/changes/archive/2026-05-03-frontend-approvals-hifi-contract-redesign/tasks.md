## 1. Contract And Baseline

- [x] 1.1 Record the current Approvals contract chain from Deck-facing DTOs, Go BFF handlers, managed runtime adapters, Gateway typed/untyped methods, frontend API wrappers, SSE events, and UI metadata.
- [x] 1.2 Confirm deterministic drift in mock/local E2E data seeding or endpoint behavior for exec approvals, plugin approvals, policy get/set, decisions, and stream updates; fix only if found.
- [x] 1.3 Identify unsupported or uncertain real Gateway approval-list, plugin-list, policy, and decision behavior and document it for handoff.

## 2. Handoff Package

- [x] 2.1 Create `frontend-handoff/modules/approvals/README.md` with status, contract truth, workflow constraints, implementation notes, and open questions.
- [x] 2.2 Create `prototype.html` as a high-fidelity approval operations workbench aligned with the current design-system posture.
- [x] 2.3 Create `components.md`, `states.md`, `interactions.md`, and `api-usage.md` covering pending exec approvals, plugin approvals, selected approval detail, policy defaults, agent overrides, allowlist paths, policy JSON editing, decisions, stream updates, action result, and empty/error/loading states.

## 3. Production Approvals UI

- [x] 3.1 Rewrite `ApprovalsPanel` and local Approvals subcomponents around the handoff workspace while preserving load, selection, exec/plugin switching, decisions, policy editing, stream updates, navigation, and raw detail behavior.
- [x] 3.2 Restyle approval metrics, queue rows, selected approval hero, plugin approval rows, policy controls, allowlist rows, decision actions, stream/action evidence, and raw details with design-system tokens/local classes without widening public API unnecessarily.
- [x] 3.3 Replace obsolete Approvals global styling with module-local or narrowed CSS using `--ds-*` tokens and responsive constraints.
- [x] 3.4 Preserve or update Approvals unit tests for load/select, decision payloads, plugin decisions, policy editing/saving, allowlist/agent overrides, stream updates, navigation, and error behavior.

## 4. Mock Visual Verification

- [x] 4.1 Add deterministic E2E seed support for Approvals mock/local visual coverage if existing mock Gateway setup is insufficient.
- [x] 4.2 Add a focused Approvals mock/local visual E2E covering the ready workspace and at least one interaction state such as exec/plugin surface switching, selected approval switch, policy edit, stream update, or decision result.
- [x] 4.3 Inspect generated screenshots for text overlap, blank panes, density problems, and incorrect mock/local evidence labeling.

## 5. Design-System Feedback

- [x] 5.1 Update the cross-module readiness record with Approvals evidence, repeated queue/policy/action molecules, and promotion candidates.
- [x] 5.2 Update the OpenSpec design-system delta target if implementation changes the readiness requirement details.

## 6. Verification

- [x] 6.1 Run `openspec validate frontend-approvals-hifi-contract-redesign --strict`.
- [x] 6.2 Run focused Approvals unit tests and mock/local visual E2E.
- [x] 6.3 Run the relevant frontend build checks and confirm the change is archive-ready.
