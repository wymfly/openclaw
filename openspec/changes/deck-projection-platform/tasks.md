## 1. ProjectionStore Generic API

- [ ] 1.1 Add `getProjection<T>(domain, key)`, `setProjection<T>(domain, key, data)`, `clearProjection(domain, key)` to `projection-store.ts` using `projection:{domain}:{key}` storage format
- [ ] 1.2 Refactor `getChatSessionProjection()` and `setChatSessionProjection()` to delegate to the generic API as thin wrappers
- [ ] 1.3 Add unit tests for generic projection CRUD (read/write/clear across multiple domains)

## 2. Approval Projection Extraction

- [ ] 2.1 Refactor `approval-bridge.ts:persistApprovalProjection()` to write `setProjection("approval", sessionKey, approvalData)` instead of embedding in chat blob
- [ ] 2.2 Refactor approval clearing in `approval-bridge.ts` to use `clearProjection("approval", sessionKey)`
- [ ] 2.3 Update `/api/chat/snapshot` route to read `getProjection("approval", sessionKey)` separately and merge into the response (preserve response shape)
- [ ] 2.4 Add unit tests for approval bridge writing to the approval domain

## 3. Legacy Data Migration

- [ ] 3.1 Implement transactional migration fallback in `getProjection("approval", key)`: if null, check chat blob for `activeApproval`, migrate atomically within SQLite transaction
- [ ] 3.2 Add test for migration path: legacy chat blob with `activeApproval` → migrated to approval domain, chat blob retains only `a2uiState`
- [ ] 3.3 Add test for concurrent safety: migration does not overwrite concurrent A2UI update

## 4. Chat Caller Migration

- [ ] 4.1 Migrate all direct callers of `getChatSessionProjection()` / `setChatSessionProjection()` to use `getProjection("chat", ...)` / `setProjection("chat", ...)`
- [ ] 4.2 Remove the chat-specific wrapper methods after all callers are migrated
- [ ] 4.3 Verify `pnpm tsgo` passes with zero errors after removal

## 5. SSE Replay Gap Detection

- [ ] 5.1 Enhance `getEventsSince(lastId)` in `projection-store.ts` to return `{ events, gapDetected }` — detect gap when `lastId > 0 && lastId < min(id)` in outbox
- [ ] 5.2 Update `/api/stream` route to emit `event: projection.gap` SSE event when `gapDetected` is true
- [ ] 5.3 Add unit test for gap detection: pruned outbox with lastId below minimum → `gapDetected: true`
- [ ] 5.4 Add unit test for no gap: lastId within outbox range → `gapDetected: false`

## 6. Verification

- [ ] 6.1 Run `pnpm tsgo` — zero type errors
- [ ] 6.2 Run `pnpm check` — lint and format pass
- [ ] 6.3 Run `pnpm test -- dashboard/server/` — all server-side tests pass
- [ ] 6.4 Run `pnpm build` — build succeeds
- [ ] 6.5 Verify chat snapshot response shape is unchanged (no breaking changes to frontend)
