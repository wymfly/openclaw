## 1. Preflight And Handoff Normalization

- [x] 1.1 Read `proposal.md`, `design.md`, and all specs before editing implementation files.
- [x] 1.2 Normalize the external agents handoff package into repo-tracked context under `deck-go/frontend-handoff/modules/agents/` or write an equivalent implementation handoff note.
- [x] 1.3 Add an agents `api-discrepancy.md` or implementation-notes section listing handoff assumptions that current Gateway/BFF contracts do not support.
- [x] 1.4 Record the design-system adaptation map for non-canonical handoff atoms/tokens (`Switch`→`Toggle`, module-private `Avatar`/`EmptyState`/`KeyHint`, `--ds-space-*`→`--ds-sp-*`).

## 2. Contract Source And Generated DTOs

- [x] 2.1 Update `contracts/source/deck-api.contract.ts` with the minimum stable agents summary/detail/section DTO changes required by the specs.
- [x] 2.2 Keep Gateway-truth DTOs for redundant subagent config fields while adding a named frontend/BFF adapter shape for `allAgents[].allowed`.
- [x] 2.3 Update `contracts/source/deck-streams.contract.json` only if stream metadata needs additional agents notes; do not invent `eventType` payloads unless backend actually emits them.
- [x] 2.4 Update `contracts/source/deck-ui.contract.json` so the agents domain includes the DTOs/endpoints/actions the frontend module consumes.
- [x] 2.5 Run `cd deck-go && make contracts-sync` and inspect generated TS/Go DTO diffs.
- [x] 2.6 Run `cd deck-go && make contract-gate` and fix source/generator issues before touching panel implementation.

## 3. Backend Adapter Support

- [x] 3.1 Update Go BFF/openclaw adapter code to populate any newly required agents summary fields from Gateway truth or mark them unavailable.
- [x] 3.2 Add or update backend tests for agents list/detail normalization, including default marker and optional unavailable counters.
- [x] 3.3 Add stale config/hash conflict coverage for skills, subagents, or event-stream section writes if response handling changes.
- [x] 3.4 Run the narrow relevant Go tests for touched packages, then include `cd deck-go && make backend-test` unless failures are unrelated and documented.

## 4. Frontend Workspace Shell

- [x] 4.1 Add a minimal `frontend-new` panel shell/registry that can render chat and agents without a new routing dependency.
- [x] 4.2 Preserve the existing `?dsGallery=1` lazy gallery behavior.
- [x] 4.3 Add a stable browser-visible selector for agents (query/hash or equivalent) and keep chat as the default route.
- [x] 4.4 Verify that registering agents does not require edits inside chat panel internals.

## 5. Agents API And Stores

- [x] 5.1 Update `frontend-new/src/api-types.ts` exports for new agents DTOs after contract generation.
- [x] 5.2 Update `frontend-new/src/api.ts` agents wrappers so panel code never constructs raw endpoint/action strings.
- [x] 5.3 Replace the placeholder `frontend-new/src/stores/agents.ts` with a shared agents store covering summary rows, selected agent, status updates, load/error state, and explicit refresh/invalidation.
- [x] 5.4 Add module-private hooks/store helpers for detail sections, dirty edits, create wizard state, and section save conflicts.
- [x] 5.5 Port or rewrite the tested `useAgentMetricsSSE` reducer as a typed helper against the current stream contract.

## 6. Agents Panel Implementation

- [x] 6.1 Create `frontend-new/src/components/panels/agents/` with bounded component/CSS files and no wholesale copy of the old agents panel.
- [x] 6.2 Implement the list/workbench view with loading, empty, error, search/filter/sort, row selection, status dot, default marker, and metadata rendering.
- [x] 6.3 Implement the detail shell with section navigation for overview, skills, subagents, tool policy, system prompt, files, and event streams.
- [x] 6.4 Implement overview identity/model/workspace editing using the typed patch API and clear dirty/save/error states.
- [x] 6.5 Implement skills, subagents, and event-streams sections using typed section APIs and config hash/base hash handling.
- [x] 6.6 Implement tool policy and system prompt preview sections as read-only provenance views.
- [x] 6.7 Implement files list/read/save affordances within the backend-supported file contract.
- [x] 6.8 Implement create wizard with initial create request limited to backend-supported fields and follow-up configuration guidance.
- [x] 6.9 Implement delete confirmation and post-delete shared store invalidation/fallback selection.

## 7. Accessibility, Keyboard, And Design-System Fit

- [x] 7.1 Use canonical atoms/hooks/tokens for all production controls and keep non-canonical handoff concepts module-private.
- [x] 7.2 Add keyboard handling for primary list/detail/create/delete interactions that does not conflict with chat shortcuts.
- [x] 7.3 Ensure list rows, section navigation, wizard, dialogs, and inline errors expose appropriate ARIA roles/labels/live regions.
- [x] 7.4 Add responsive/density behavior using stable dimensions and `--ds-*` tokens.

## 8. Frontend Tests

- [x] 8.1 Add focused tests for agents store normalization, selection, refresh, delete fallback, and stream status reduction.
- [x] 8.2 Add panel render tests for list loading/empty/error/ready states.
- [x] 8.3 Add detail section tests for dirty/save/conflict/error flows.
- [x] 8.4 Add create wizard and delete confirmation tests, including a11y checks with vitest-axe where practical.
- [x] 8.5 Run `cd deck-go/frontend-new && npm run test:deck-ui`.
- [x] 8.6 Run `cd deck-go/frontend-new && npm run build`.

## 9. Final Verification And OpenSpec Closure Evidence

- [x] 9.1 Run `openspec validate deck-go-frontend-agents-rebuild`.
- [x] 9.2 Run `cd deck-go && make contract-gate` after all contract/frontend changes settle.
- [x] 9.3 Run `cd deck-go && make frontend-build`.
- [x] 9.4 Run the narrow backend test target touched by adapter changes and record whether full `make backend-test` was run.
- [x] 9.5 Decide local browser smoke scope: not run because this task explicitly makes it optional and automated list/detail/render/a11y/build gates passed; no full real-stack E2E required.
- [x] 9.6 Update tasks as complete only after the relevant implementation and verification evidence exists.
