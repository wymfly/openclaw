## Why

The Data Fabric foundation is in place, but `frontend-new` still has no migrated business module proving how a real control-plane surface should use query keys, freshness, mutation safety, live invalidation, mock evidence, and real Gateway evidence together. Agents is the right reference because it spans Gateway RPC reads, Deck BFF reads/writes, OpenClaw config-derived writes, related Skills/Subagents sections, protected `main` behavior, files, and live status updates.

## What Changes

- Add `frontend-new/src/data/modules/agents/**` as the first Data Fabric reference module.
- Move Agents server-state reads out of `useAgentsStore` and component-local `useEffect(fetch*)` lifecycles into Data Fabric query option factories/hooks.
- Preserve the current Agents UI/product surface while changing the data architecture underneath; UI state such as selection, search, filters, tabs, draft forms, dirty flags, modals, and keyboard interaction remains outside TanStack Query.
- Keep the existing frontend API facades in `frontend-new/src/api.ts` as the transport boundary; Data Fabric hooks wrap those facades instead of scattering BFF paths or action strings into panel code.
- Use the current contract truth:
  - Agents list: generated Gateway RPC via `fetchAgentsList()` / `createDeckGatewayClient().agents.list({})`.
  - Detail/config-derived reads: BFF `/deck/agents?agentId=...` and `POST /deck/agents` actions (`health`, `skills.get`, `subagents.get`, `eventStreams.get`, `toolPolicy.preview`, `systemPrompt.preview`).
  - Files/identity: BFF `/agents/{agentId}/files`, `/agents/{agentId}/files/{name}`, `/agents/{agentId}/identity`.
  - Model selector support: existing configured-model wrapper.
  - Writes: `createAgent`, `updateAgent`, `deleteAgent`, `updateAgentSkills`, `updateAgentSubagentConfig`, `updateAgentEventStreams`, and `saveAgentFile`.
- Encode Agents query keys and freshness tiers:
  - inventory: agents list, configured models;
  - lazy-detail: detail, files, file content, identity, previews;
  - live-workbench: health/status;
  - config-authority: skills, subagent config, event streams.
- Add mutation wrappers with safe defaults:
  - no mutation retry;
  - no offline replay;
  - baseHash-required mutations block when config hash is missing;
  - protected `main` delete remains disabled;
  - run-scoped real E2E writes only execute when fixture cleanup can prove safety.
- Wire `agent-status` live projection events and gaps into Data Fabric invalidation for agents list/detail/status without requiring generated `patchStrategy` or `patchKeys`.
- Update tests and E2E:
  - unit/hook tests for query keys, cache reuse, mutations/invalidation, conflict behavior, and live invalidation;
  - Agents focused panel tests with `DataFabricTestProvider`;
  - L4 mock-functional browser evidence for list/detail/cache/navigation and representative safe mutations;
  - L5 real-gateway evidence with isolated run-scoped agent fixture and circuit breaker for environment startup.

## Capabilities

### New Capabilities

- `deck-go-data-fabric-agents-reference`: Agents module server-state migration to Data Fabric, including query hooks, mutation safety, live invalidation mapping, UI-store boundary cleanup, and mock/real reference evidence for later modules.

### Modified Capabilities

- `deck-go-data-fabric-foundation`: Add the first reference-module usage requirements that later module migrations can copy: module hook directory shape, mutation invalidation pattern, and live projection mapping policy.
- `frontend-new-workspace`: Clarify that the Agents panel is the first migrated panel and its store must keep only UI/local interaction state after migration.
- `deck-go-live-projection-subscription-contract`: Add an explicit `agent-status` Data Fabric invalidation mapping based on current projection metadata.

## Impact

- Affected frontend files:
  - `deck-go/frontend-new/src/data/modules/agents/**`
  - `deck-go/frontend-new/src/components/panels/agents/AgentsPanel.tsx`
  - `deck-go/frontend-new/src/components/panels/agents/__tests__/**`
  - `deck-go/frontend-new/src/stores/agents.ts`
  - `deck-go/frontend-new/src/stores/__tests__/agents-store.test.ts`
  - focused `frontend-new/src/data/**` helpers if the reference module exposes a reusable pattern missing from foundation.
- Contract sources to re-read before implementation:
  - `deck-go/contracts/source/deck-api.contract.ts`
  - `deck-go/contracts/source/deck-endpoints.contract.json`
  - `deck-go/contracts/source/deck-live-projections.contract.json`
  - `deck-go/contracts/source/deck-list-queries.contract.json`
  - `deck-go/contracts/source/deck-mutations.contract.json`
  - `deck-go/contracts/source/deck-config-write-safety.contract.json`
  - `deck-go/contracts/source/deck-route-governance.contract.json`
  - `deck-go/contracts/source/deck-ui.contract.json`
  - generated Gateway protocol/client types for `agents.*` and `deck.agents.*`.
- Verification impact:
  - `cd deck-go/frontend-new && npm run test:deck-ui -- src/data src/components/panels/agents src/stores/__tests__/agents-store.test.ts`
  - `cd deck-go/frontend-new && npm run test:deck-ui` with unrelated failures recorded separately if the current dirty worktree still has non-Agents failures
  - `cd deck-go && make frontend-build`
  - `cd deck-go && make contract-gate`
  - L4: `cd deck-go && pnpm exec playwright test --config playwright.config.ts test/e2e/agents-visual.spec.ts` plus any new Agents Data Fabric mock-functional spec needed for cache/mutation assertions
  - L5: `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test --config playwright.config.ts test/e2e/agents-real-gateway.spec.ts`
