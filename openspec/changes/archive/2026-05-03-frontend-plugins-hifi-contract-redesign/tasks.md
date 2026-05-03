## 1. Contract And Baseline

- [x] 1.1 Record the current Plugins contract chain from Deck-facing DTOs, Go BFF handlers, Gateway adapter method, frontend API wrappers, channel support query, and UI metadata.
- [x] 1.2 Confirm deterministic drift in mock/local E2E data for plugin inventory, capability scope, channel status context, diagnostics, related channel handoffs, and hidden-channel warnings; fix only if found.
- [x] 1.3 Identify unsupported or uncertain install, uninstall, enable, disable, reload, trust, marketplace, package signature, and production activation assurance semantics and document them for handoff.

## 2. Handoff Package

- [x] 2.1 Create `frontend-handoff/modules/plugins/README.md` with status, contract truth, workflow constraints, implementation notes, and open questions.
- [x] 2.2 Create `prototype.html` as a high-fidelity plugin inventory workbench aligned with the current design-system posture.
- [x] 2.3 Create `components.md`, `states.md`, `interactions.md`, and `api-usage.md` covering plugin inventory, selected plugin detail, capability scope switching, diagnostic evidence, related channel handoffs, hidden-channel warning, raw payload disclosure, empty/error/loading states, and mock/local visual states.

## 3. Production Plugins UI

- [x] 3.1 Rewrite `PluginsPanel` and local Plugins subcomponents around the handoff workspace while preserving load, selection, navigation target selection, capability scope switching, channel handoffs, diagnostics, raw payload disclosure, and i18n behavior.
- [x] 3.2 Restyle plugin metrics, inventory rows, selected plugin hero, capability/action evidence, diagnostics, related-channel handoff strips, lifecycle limitation notice, raw payload seam, and scope controls with design-system tokens/local classes without widening public API unnecessarily.
- [x] 3.3 Replace obsolete Plugins global styling with module-local or narrowed CSS using `--ds-*` tokens and responsive constraints.
- [x] 3.4 Preserve or update Plugins unit tests for load/select, navigation target selection, scope switching, diagnostics, visible/hidden channel handoffs, access handoff, error/empty behavior, and localization.

## 4. Mock Visual Verification

- [x] 4.1 Add deterministic E2E seed support for Plugins mock/local visual coverage if existing mock Gateway setup is insufficient.
- [x] 4.2 Add a focused Plugins mock/local visual E2E covering the ready workspace and at least one interaction state such as scope switch, plugin selection, channel handoff, diagnostic evidence, hidden-channel warning, or raw payload expansion.
- [x] 4.3 Inspect generated screenshots for text overlap, blank panes, density problems, and incorrect mock/local evidence labeling.

## 5. Design-System Feedback

- [x] 5.1 Update the cross-module readiness record with Plugins evidence, repeated inventory/detail/diagnostic/handoff molecules, and promotion candidates.
- [x] 5.2 Update the OpenSpec design-system delta target if implementation changes the readiness requirement details.

## 6. Verification

- [x] 6.1 Run `openspec validate frontend-plugins-hifi-contract-redesign --strict`.
- [x] 6.2 Run focused Plugins unit tests and mock/local visual E2E.
- [x] 6.3 Run the relevant frontend build checks and confirm the change is archive-ready.
