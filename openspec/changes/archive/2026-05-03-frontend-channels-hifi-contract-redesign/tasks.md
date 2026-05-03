## 1. Contract And Baseline

- [x] 1.1 Record the current channels contract chain from `DeckGoChannelsStatusResponse`, channel test/throughput DTOs, channel config wrappers, WeCom config/routing wrappers, API wrappers, and Go BFF handlers.
- [x] 1.2 Confirm whether there is deterministic channels/status/logout/test/throughput/config/routing mock or forwarding drift; fix only if found.
- [x] 1.3 Identify uncertain provider, WeCom, or Gateway gaps and document them for handoff.

## 2. Handoff Package

- [x] 2.1 Create `frontend-handoff/modules/channels/README.md` with status, contract truth, implementation notes, workflow constraints, and open questions.
- [x] 2.2 Create `prototype.html` as a high-fidelity channels operations workbench aligned with the current design-system posture.
- [x] 2.3 Create `components.md`, `states.md`, `interactions.md`, and `api-usage.md` covering inventory, selected detail, diagnostics, throughput, probe, logout, config patching, account policy, WeCom access, routing handoff, accessibility, and endpoint usage.

## 3. Production Channels UI

- [x] 3.1 Rewrite `ChannelsPanel` around the handoff workbench while preserving inventory load/selection, navigation params, plugin navigation, probe, logout, channel enable/disable, throughput windows, account diagnostics, and action results.
- [x] 3.2 Restyle `ChannelSettingsEditor`, `AccountDmPolicyEditor`, `WecomAccessControls`, and `WecomRoutingSummary` with design-system atoms/local classes without widening their public API unnecessarily.
- [x] 3.3 Replace obsolete channels global styling with module-local or narrowed CSS using `--ds-*` tokens and responsive constraints.
- [x] 3.4 Preserve or update channels unit tests for inventory/detail, localization, navigation params, WeCom access, logout confirmation, probe/toggle, generic channel patch, account policy patch, and routing handoff.

## 4. Mock Visual Verification

- [x] 4.1 Add or update contract-shaped channels/status/logout/test/throughput/config/routing data in the mock stack if visual E2E gaps are found.
- [x] 4.2 Add a focused channels mock visual E2E covering the ready workbench and at least one interaction state such as probe result, throughput window, channel toggle confirmation, JSON patch result, or WeCom access state.

## 5. Design-System Feedback

- [x] 5.1 Update the cross-module readiness record with channels evidence, repeated molecules, diagnostics/settings/access molecules, and promotion candidates.
- [x] 5.2 Update the OpenSpec design-system delta target if implementation changes the readiness requirement details.

## 6. Verification

- [x] 6.1 Run `openspec validate frontend-channels-hifi-contract-redesign --strict`.
- [x] 6.2 Run focused channels unit tests and mock visual E2E.
- [x] 6.3 Run the relevant frontend build/check and confirm the change is archive-ready.
