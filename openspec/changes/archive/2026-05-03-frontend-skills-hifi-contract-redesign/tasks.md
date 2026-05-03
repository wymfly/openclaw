## 1. Contract And Baseline

- [x] 1.1 Record the current Skills contract chain from Deck-facing DTOs, Go BFF handlers, managed runtime adapters, Gateway typed methods, frontend API wrappers, agent skill matrix actions, and UI metadata.
- [x] 1.2 Confirm deterministic drift in mock/local E2E data seeding or endpoint behavior for skill inventory, skill update/install, ClawHub bins/search/detail/install/update, and agent skill matrix calls; fix only if found.
- [x] 1.3 Identify unsupported or uncertain real Gateway/ClawHub install, network, credential, and marketplace behavior and document it for handoff.

## 2. Handoff Package

- [x] 2.1 Create `frontend-handoff/modules/skills/README.md` with status, contract truth, workflow constraints, implementation notes, and open questions.
- [x] 2.2 Create `prototype.html` as a high-fidelity skill operations workbench aligned with the current design-system posture.
- [x] 2.3 Create `components.md`, `states.md`, `interactions.md`, and `api-usage.md` covering installed inventory, selected skill detail, missing requirements, config editing, install options, ClawHub discovery/detail/actions, agent skill matrix, action results, and empty/error/loading states.

## 3. Production Skills UI

- [x] 3.1 Rewrite `SkillsPanel` and local Skills subcomponents around the handoff workspace while preserving load, selection, enable/disable, config save, install option, ClawHub actions, agent matrix refresh/toggle, navigation, and raw detail behavior.
- [x] 3.2 Restyle skill metrics, inventory rows, selected skill hero, requirement evidence, config controls, install options, ClawHub catalog/detail, matrix cells, action evidence, and raw details with design-system tokens/local classes without widening public API unnecessarily.
- [x] 3.3 Replace obsolete Skills global styling with module-local or narrowed CSS using `--ds-*` tokens and responsive constraints.
- [x] 3.4 Preserve or update Skills unit tests for normalization, load/select, filters, enable/disable, config save, install option, ClawHub actions, matrix refresh/toggle, navigation, and error behavior.

## 4. Mock Visual Verification

- [x] 4.1 Add deterministic E2E seed support for Skills mock/local visual coverage if existing mock Gateway setup is insufficient.
- [x] 4.2 Add a focused Skills mock/local visual E2E covering the ready workspace and at least one interaction state such as selected skill switch, config save, install option, ClawHub detail/install/update, or agent matrix toggle.
- [x] 4.3 Inspect generated screenshots for text overlap, blank panes, density problems, and incorrect mock/local evidence labeling.

## 5. Design-System Feedback

- [x] 5.1 Update the cross-module readiness record with Skills evidence, repeated skill/catalog/config/matrix molecules, and promotion candidates.
- [x] 5.2 Update the OpenSpec design-system delta target if implementation changes the readiness requirement details.

## 6. Verification

- [x] 6.1 Run `openspec validate frontend-skills-hifi-contract-redesign --strict`.
- [x] 6.2 Run focused Skills unit tests and mock/local visual E2E.
- [x] 6.3 Run the relevant frontend build checks and confirm the change is archive-ready.
