## 1. Contract Truth And Scope

- [x] 1.1 Re-read scoped contract sources and generated DTO/Gateway types, then record exact BFF endpoints, Gateway RPC methods, list-query metadata, mutation evidence, route governance, stream metadata, and projection metadata used by this change.
- [x] 1.2 Inventory current Chat surrounding server-state lifecycles in `ChatPanel`, `SessionSidebar`, `use-command-discovery`, and transcript history recovery, separating server state from transcript stream state and local UI state.
- [x] 1.3 Confirm `proposal.md`, `design.md`, and spec deltas match code truth before production edits, especially the transcript-stream exclusion and command discovery/session ownership boundary.

## 2. Data Modules

- [x] 2.1 Add `data/modules/chat` with stable keys, snapshot query options/hooks, session-event subscription mutation wrapper, and chat-session projection invalidation helpers.
- [x] 2.2 Add `data/modules/commands` with stable keys, command discovery query options/hooks, and command-discovery projection invalidation helpers.
- [x] 2.3 Add or adjust `src/api.ts` facades for command discovery and Chat-adjacent reads so migrated code does not use raw `deckFetch` for scoped server-state reads.
- [x] 2.4 Add focused Data Fabric tests for Chat/Commands keys, freshness tiers, cache reuse, mutation invalidation, projection invalidation, and background refresh preservation where applicable.

## 3. Chat Panel And Sidebar Migration

- [x] 3.1 Migrate `ChatPanel` session list loading to `useSessionsListQuery()` while preserving active-agent filtering, initial active session selection, visual-state seed behavior, and local Chat store synchronization.
- [x] 3.2 Migrate `ChatPanel` active snapshot loading to `useChatSnapshotQuery()` while preserving transcript cache behavior, non-streaming guard, active approval sync, A2UI state sync, and snapshot metadata application.
- [x] 3.3 Migrate `ChatPanel` active session subscribe/unsubscribe effect to the Chat Data Fabric session-events mutation wrapper with no retry/offline replay.
- [x] 3.4 Migrate `SessionSidebar` preview loading to `useSessionPreviewsQuery()` and migrate rename/delete actions to sessions Data Fabric mutation wrappers while preserving controlled props, sidebar UI state, local overlay merging, and delete confirmation.
- [x] 3.5 Migrate command discovery to Data Fabric query/projection invalidation while preserving local command registry priority, aliases, visibility, cleanup, and command palette behavior.
- [x] 3.6 Replace raw transcript history recovery fetch construction with the Chat history API facade or query option boundary while preserving full-content merge behavior and existing seam tests.

## 4. Focused Tests

- [x] 4.1 Update focused Chat tests to use `DataFabricTestProvider` or Data Fabric mocks where needed.
- [x] 4.2 Run and fix focused data/module tests for Chat/Commands and existing sessions/approvals boundary interactions touched by this change.
- [x] 4.3 Run and fix focused Chat component/hook/store tests covering active entry, sidebar rename/delete/previews, command discovery/palette, history seam guard, SSE visibility, and transcript rendering assumptions.
- [x] 4.4 Run `openspec validate deck-go-data-fabric-chat-surroundings --type change --strict` and fix proposal/spec/task validation issues.

## 5. Project Verification

- [x] 5.1 Run `cd deck-go/frontend-new && npm run test:deck-ui`; fix failures related to this change and record exact unrelated failures if any remain.
- [x] 5.2 Run `cd deck-go && make frontend-build`.
- [x] 5.3 Run `cd deck-go && make contract-gate`.
- [x] 5.4 Run L4 mock-functional browser evidence for Chat surroundings, including `chat-visual.spec.ts` and any directly affected shared specs.
- [x] 5.5 Run L5 real Gateway evidence for Chat surroundings against the isolated real stack, including `chat-real-gateway.spec.ts` and `chat-command-real-gateway.spec.ts`; after two environment/startup failures without new narrowing evidence, record a circuit-breaker handoff while keeping deterministic checks green.
- [x] 5.6 Create or update `verification.yaml` with command evidence, known unrelated failures, circuit-breaker handoffs if any, and archive readiness.
- [x] 5.7 Sync accepted spec deltas into main specs, rerun change validation, confirm all tasks are checked only after fresh evidence, and archive the change when ready.
