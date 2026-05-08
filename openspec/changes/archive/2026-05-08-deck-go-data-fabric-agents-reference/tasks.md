## 1. Contract Truth And Module Baseline

- [x] 1.1 Re-read Agents-related contract sources and generated Gateway/client types, then confirm the implementation uses only the BFF endpoints, Gateway RPC methods, DTOs, mutation metadata, and live projection fields listed in `proposal.md` and `design.md`.
- [x] 1.2 Add `frontend-new/src/data/modules/agents/` with module-local keys, query option factories/hooks, mutation wrappers, projection invalidation policy, and an index barrel following the Data Fabric foundation shape.
- [x] 1.3 Add focused tests proving Agents keys are stable and every Agents query maps to its required freshness tier.

## 2. Read Path Migration

- [x] 2.1 Implement Agents list/detail/health/skills/subagents/event-streams/tool-policy/system-prompt/files/file/identity Data Fabric read hooks that wrap existing `src/api.ts` facades without moving raw BFF paths or action strings into panel code.
- [x] 2.2 Refactor `useAgentsStore` so it keeps UI/local state only and no longer exposes `loadAgents`, `fetchAgents`, or `refreshAgents` server fetch lifecycle methods.
- [x] 2.3 Refactor `AgentsPanel` and child section code to consume Agents Data Fabric reads while preserving selection, filters, tabs/sections, drafts, dirty flags, modals, and current visual layout.
- [x] 2.4 Add or update component/hook tests with `DataFabricTestProvider` for first-load, empty, error, cached return, shared-request, and cached-data-preserved-on-refresh-error states.

## 3. Mutation Safety And Invalidation

- [x] 3.1 Implement Agents mutation wrappers for create, update, delete, skills save, subagent config save, event streams save, and file save with `retry: false`, no offline replay, declared invalidation targets, and no optimistic update unless explicitly tested.
- [x] 3.2 Enforce config-hash/base-hash requirements for skills, subagent config, and event-stream saves before calling the backend; preserve local drafts and surface recoverable conflict/refresh-required UI when the hash is missing.
- [x] 3.3 Preserve protected `main`/default/not-deletable agent delete guards so the delete mutation is not invoked for protected agents.
- [x] 3.4 Add mutation tests for invalidation, missing base-hash blocking, protected delete blocking, and successful draft preservation after conflict-like failures.

## 4. Live Projection Integration

- [x] 4.1 Wire `agent-status` live projection events into Agents Data Fabric invalidation and stale marking without requiring generated `patchStrategy` or `patchKeys`.
- [x] 4.2 Handle `projection.gap` by refreshing the authoritative Agents read-model keys according to the current `gapPolicy: refresh` contract.
- [x] 4.3 Add tests for `agent.status.changed`, `activity.event`, and `projection.gap` invalidation/gap recovery behavior.

## 5. Verification And Archive Readiness

- [x] 5.1 Run `openspec validate deck-go-data-fabric-agents-reference --strict` and fix all proposal/spec/task validation issues.
- [x] 5.2 Run focused frontend tests: `cd deck-go/frontend-new && npm run test:deck-ui -- src/data/modules/agents src/components/panels/agents src/stores/__tests__/agents-store.test.ts`.
- [x] 5.3 Run the full frontend test command `cd deck-go/frontend-new && npm run test:deck-ui`; if unrelated failures remain, record exact failing files/assertions separately from this change.
- [x] 5.4 Run `cd deck-go && make frontend-build`.
- [x] 5.5 Run contract verification for touched surfaces, using `cd deck-go && make contract-gate` unless the implementation proves a narrower check fully covers the touched contract sources.
- [x] 5.6 Run L4 mock-functional Agents browser evidence covering list/detail navigation, fresh-cache return, representative child-section interaction, and a safe mutation or blocked-mutation path.
- [x] 5.7 Run L5 real Gateway Agents evidence against the isolated real stack; after two environment/startup failures without new narrowing evidence, record a circuit-breaker handoff while keeping deterministic code-level checks green.
- [x] 5.8 Update task checkboxes only after each task has fresh implementation and verification evidence, then confirm the change is archive-ready.
