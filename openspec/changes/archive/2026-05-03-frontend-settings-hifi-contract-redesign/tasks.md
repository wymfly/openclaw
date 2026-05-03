## 1. Contract And Baseline

- [x] 1.1 Record the current settings contract chain from `DeckGoSettings*`, runtime endpoint DTOs, device DTOs, API wrappers, Go BFF handlers, and device SSE behavior.
- [x] 1.2 Confirm whether there is deterministic settings/runtime/devices forwarding drift; fix only if found.
- [x] 1.3 Identify uncertain product/Gateway gaps and document them for handoff.

## 2. Handoff Package

- [x] 2.1 Create `frontend-handoff/modules/settings/README.md` with status, contract truth, implementation notes, security constraints, and open questions.
- [x] 2.2 Create `prototype.html` as a high-fidelity settings operations workbench aligned with the current design-system posture.
- [x] 2.3 Create `components.md`, `states.md`, `interactions.md`, and `api-usage.md` covering settings, runtime endpoint, devices, token flows, notifications, accessibility, and endpoint usage.

## 3. Production Settings UI

- [x] 3.1 Rewrite `SettingsPanel` around the handoff workbench while preserving settings save/refresh, runtime refresh, endpoint save/test, theme/locale, version summary, devices, modals, and stream refresh behavior.
- [x] 3.2 Restyle `EndpointSection` and `ReadOnlyField` with design-system atoms/local classes without widening their public API unnecessarily.
- [x] 3.3 Replace obsolete settings global styling with module-local or narrowed CSS using `--ds-*` tokens and responsive constraints.
- [x] 3.4 Preserve or update settings unit tests for load, save payload safety, endpoint sentinel behavior, i18n, device actions, token modal, and stream refresh.

## 4. Mock Visual Verification

- [x] 4.1 Add or update contract-shaped settings/runtime/devices data in the mock stack if visual E2E gaps are found.
- [x] 4.2 Add a focused settings mock visual E2E covering the ready workbench and at least one interaction state such as endpoint test, device confirmation, or token rotation.

## 5. Design-System Feedback

- [x] 5.1 Update the cross-module readiness record with settings evidence, repeated molecules, security/config molecules, and promotion candidates.
- [x] 5.2 Update the OpenSpec design-system delta target if implementation changes the readiness requirement details.

## 6. Verification

- [x] 6.1 Run `openspec validate frontend-settings-hifi-contract-redesign --strict`.
- [x] 6.2 Run focused settings unit tests and mock visual E2E.
- [x] 6.3 Run the relevant frontend build/check and confirm the change is archive-ready.
