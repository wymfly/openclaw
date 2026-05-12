# Chat Reference Lock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lock the current chat module as the reference convergence module by fixing confirmed active contract drift and verifying the send/stream/readback chain.

**Architecture:** Use Gateway protocol as runtime truth, deck-go contracts as product-facing truth, and frontend/store types as view models only. The implementation is intentionally contract-first: repair product metadata and DTO/schema drift, regenerate generated artifacts from source, then align the specialized chat SSE implementation with the live-projection contract.

**Tech Stack:** deck-go contracts, OpenClaw Gateway TypeBox schemas, Go generated DTOs, React/Vite frontend, Vitest, Playwright real Gateway E2E.

---

## Current Chat Module State

Chat is usable and already has working BFF/frontend/Gateway paths. The current
state is not "chat is broken"; the issue is that chat is not yet locked as a
long-term reference module under the new skill-driven convergence workflow.

Confirmed or near-confirmed active issues:

- **C1: confirmed product contract defect.** `POST /chat/sessions/create` and
  `POST /chat/steer` are active BFF/frontend actions, but the sessions-chat UI
  metadata does not list their endpoints/actions/DTOs.
- **C2: confirmed contract drift if compaction remains active.** The compact
  action is active maintenance surface. UI metadata says compact returns
  `DeckGoSessionMutationResponse`, while mutation evidence and actual Gateway
  behavior are compaction-action shaped.
- **C2a: Gateway schema sub-drift.** `sessions.compact` can return a `result`
  object from the handler, but `SessionsCompactResultSchema` does not declare
  `result`. This is a small runtime-truth alignment item and should be approved
  explicitly because it touches Gateway protocol schema.
- **C3: active stream contract drift / verification gap.** The live-projection
  contract declares a chat-session cursor storage key, but the specialized chat
  SSE hook does not persist or pass `Last-Event-ID` across stream reconnects.

Out of first coding pass unless new active impact appears:

- C4: unregistered `chat.side_result`.
- C5: unregistered/private `chat.inject`.
- C6: frontend compatibility shims.
- C7: loose generated dynamic types.
- C8: `/api` versus BFF-internal path notation.
- C9: stale `migrationStatus: "partial"` marker, except for an end-of-pass
  status review after C1-C3 are resolved.

## File Structure

Primary source files to modify after user approval:

- Modify: `deck-go/contracts/source/deck-ui.contract.json`
  - Add missing create/steer DTOs, endpoints, and actions.
  - Align compact result DTO with compaction action shape.
- Modify: `deck-go/contracts/source/deck-api.contract.ts`
  - Make `DeckGoCompactionActionResponse` explicitly describe compact result
    fields instead of relying only on an open record.
- Modify, if C2a is approved: `src/gateway/protocol/schema/sessions-extensions.ts`
  - Add optional `result` to `SessionsCompactResultSchema` to match existing
    handler behavior.
- Modify: `deck-go/frontend-new/src/components/panels/chat/useChatSSE.ts`
  - Persist and pass the chat-session stream cursor from
    `deck-live-projections.contract.json`.
- Modify: `deck-go/frontend-new/src/components/panels/chat/__tests__/useChatSSE-visibility.test.tsx`
  - Add regression coverage for chat SSE cursor read/write behavior.
- Modify: `docs/realignment/chat-defect-confirmation.md`
  - Record the user-approved decisions for C1-C3 and the final handling of
    C4-C9.

Generated files to update through commands only:

- From `cd deck-go && make ui-metadata-sync`:
  - `deck-go/contracts/generated/ts/deck-ui-metadata.generated.ts`
  - `deck-go/docs/deck-ui-contract-metadata.md`
- From `cd deck-go && make contracts-sync`:
  - `deck-go/contracts/generated/ts/deck-api.generated.ts`
  - `deck-go/backend/internal/deckapi/types.generated.go`
- From `cd deck-go && make protocol-update`, only if C2a is approved:
  - `deck-go/contracts/generated/ts/gateway/protocol.ts`
  - `deck-go/contracts/generated/ts/gateway/client.ts`, if generator changes it
  - `deck-go/backend/internal/gateway/generated/*.go`, if generator changes it

Do not hand-edit generated files.

## Dirty Worktree Guard

The current worktree contains unrelated deck-go changes. Before coding, use an
isolated worktree or prove the implementation workspace is clean enough for
scoped edits.

- [ ] **Step 1: Inspect worktree scope**

Run:

```bash
git status --short
```

Expected: note unrelated files before editing. Do not revert or stage them.

- [ ] **Step 2: Prefer isolated execution**

Use `superpowers:using-git-worktrees` at implementation time. The coding
worktree should start from the current branch and contain only Phase 5 chat
reference-lock edits.

Expected: implementation diffs are not mixed with unrelated deck-go frontend or
generated artifact changes already present in this root worktree.

## Task 1: Repair Chat Create/Steer UI Metadata

**Files:**

- Modify: `deck-go/contracts/source/deck-ui.contract.json`
- Generate: `deck-go/contracts/generated/ts/deck-ui-metadata.generated.ts`
- Generate: `deck-go/docs/deck-ui-contract-metadata.md`

- [ ] **Step 1: Add missing DTOs to the sessions-chat domain**

In the `sessions-chat` domain DTO list, add:

```json
"DeckGoChatSessionCreateRequest",
"DeckGoChatSteerRequest",
"DeckGoChatSteerResponse",
"DeckGoSessionCreateResponse"
```

Expected: `make ui-metadata-check` can resolve all newly referenced DTOs from
`deck-go/contracts/source/deck-api.contract.ts`.

- [ ] **Step 2: Add missing endpoints to the sessions-chat domain**

In the same domain endpoint list, add:

```json
"POST /api/chat/sessions/create",
"POST /api/chat/steer"
```

Expected: the UI metadata validator accepts them because
`deck-go/contracts/source/deck-endpoints.contract.json` already declares the
non-`/api` BFF paths and normalizes endpoint keys.

- [ ] **Step 3: Add missing actions to the sessions-chat domain**

In the same domain action list, add:

```json
"chat.session.create",
"chat.steer"
```

Expected: domain metadata now includes every active core chat action used by the
frontend/BFF send/create/steer surface.

- [ ] **Step 4: Add `chat.session.create` action metadata**

Add this action near the existing chat actions:

```json
{
  "id": "chat.session.create",
  "label": "Create chat session",
  "endpoint": "POST /api/chat/sessions/create",
  "safety": "mutating",
  "requestDto": "DeckGoChatSessionCreateRequest",
  "resultDto": "DeckGoSessionCreateResponse",
  "refresh": ["GET /api/sessions", "GET /api/chat/snapshot"]
}
```

Expected: the action describes the product mutation without inventing a new
Gateway method.

- [ ] **Step 5: Add `chat.steer` action metadata**

Add this action near `chat.send` and `chat.abort`:

```json
{
  "id": "chat.steer",
  "label": "Steer chat run",
  "endpoint": "POST /api/chat/steer",
  "safety": "mutating",
  "requestDto": "DeckGoChatSteerRequest",
  "resultDto": "DeckGoChatSteerResponse",
  "refresh": ["GET /api/chat/snapshot"]
}
```

Expected: steer becomes visible to product metadata as an active chat action.

- [ ] **Step 6: Regenerate UI metadata**

Run:

```bash
cd deck-go && make ui-metadata-sync
```

Expected: generated TS and Markdown metadata update from source.

- [ ] **Step 7: Check UI metadata**

Run:

```bash
cd deck-go && make ui-metadata-check
```

Expected: exits 0.

## Task 2: Align Compact Response Product Contract

**Files:**

- Modify: `deck-go/contracts/source/deck-ui.contract.json`
- Modify: `deck-go/contracts/source/deck-api.contract.ts`
- Generate: `deck-go/contracts/generated/ts/deck-api.generated.ts`
- Generate: `deck-go/backend/internal/deckapi/types.generated.go`
- Generate: UI metadata outputs from Task 1

- [ ] **Step 1: Change compact result DTO in UI metadata**

In `deck-go/contracts/source/deck-ui.contract.json`, change
`sessions.compact`:

```json
"resultDto": "DeckGoCompactionActionResponse"
```

Expected: UI metadata matches mutation evidence and compact action behavior.

- [ ] **Step 2: Make compact response fields explicit in deck API source**

Update `DeckGoCompactionActionResponse` in
`deck-go/contracts/source/deck-api.contract.ts` to:

```ts
export type DeckGoCompactionActionResponse = Record<string, unknown> & {
  ok?: boolean;
  key?: string;
  compacted?: boolean;
  archived?: string[];
  kept?: number;
  reason?: string;
  result?: unknown;
};
```

Expected: deck-go product DTOs preserve known compact response fields while
remaining forward-compatible for compaction branch/restore payloads.

- [ ] **Step 3: Regenerate deck-facing DTOs**

Run:

```bash
cd deck-go && make contracts-sync
```

Expected: `deck-api.generated.ts` and `types.generated.go` update from
`deck-api.contract.ts`.

- [ ] **Step 4: Regenerate UI metadata after DTO change**

Run:

```bash
cd deck-go && make ui-metadata-sync
```

Expected: UI metadata generated outputs reflect the compact DTO change.

- [ ] **Step 5: Check deck-facing contracts**

Run:

```bash
cd deck-go && make contracts-check
```

Expected: exits 0.

## Task 3: Align Gateway Compact Result Schema If Approved

**Files:**

- Modify: `src/gateway/protocol/schema/sessions-extensions.ts`
- Generate: `deck-go/contracts/generated/ts/gateway/protocol.ts`
- Generate: `deck-go/contracts/generated/ts/gateway/client.ts`, if changed
- Generate: `deck-go/backend/internal/gateway/generated/*.go`, if changed

This task should run only if the user approves C2a. It touches Gateway protocol
schema, not just deck-go product contracts.

- [ ] **Step 1: Add optional result to Gateway compact result schema**

Change `SessionsCompactResultSchema` to include:

```ts
result: Type.Optional(Type.Unknown()),
```

Expected full shape:

```ts
export const SessionsCompactResultSchema = Type.Object(
  {
    ok: Type.Boolean(),
    key: NonEmptyString,
    compacted: Type.Boolean(),
    archived: Type.Optional(Type.Array(Type.String())),
    kept: Type.Optional(Type.Integer({ minimum: 0 })),
    reason: Type.Optional(Type.String()),
    result: Type.Optional(Type.Unknown()),
  },
  { additionalProperties: false },
);
```

- [ ] **Step 2: Regenerate Gateway protocol artifacts**

Run:

```bash
cd deck-go && make protocol-update
```

Expected: generated Gateway TS/Go artifacts update from the Gateway schema.

- [ ] **Step 3: Check Gateway protocol drift**

Run:

```bash
cd deck-go && make protocol-check
```

Expected: exits 0.

## Task 4: Persist Chat SSE Cursor From Live Projection Contract

**Files:**

- Modify: `deck-go/frontend-new/src/components/panels/chat/useChatSSE.ts`
- Modify: `deck-go/frontend-new/src/components/panels/chat/__tests__/useChatSSE-visibility.test.tsx`

- [ ] **Step 1: Add cursor helpers**

Near `CHAT_LIVE_PROJECTION_CONTRACT`, add:

```ts
const CHAT_STREAM_CURSOR_KEY = CHAT_LIVE_PROJECTION_CONTRACT.cursorStorageKey;

function readChatStreamCursor(): string {
  if (!CHAT_STREAM_CURSOR_KEY || typeof window === "undefined") {
    return "";
  }
  return window.localStorage.getItem(CHAT_STREAM_CURSOR_KEY)?.trim() || "";
}

function writeChatStreamCursor(value: string | undefined): void {
  const next = value?.trim();
  if (!CHAT_STREAM_CURSOR_KEY || !next || typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(CHAT_STREAM_CURSOR_KEY, next);
}
```

Expected: the specialized chat stream uses the same cursor key declared by the
live-projection contract.

- [ ] **Step 2: Pass initial cursor into `deckStream`**

Change the stream call to include:

```ts
lastEventId: readChatStreamCursor(),
```

Expected surrounding call:

```ts
void deckStream("/api/stream", {
  signal: controller.signal,
  reconnect: true,
  lastEventId: readChatStreamCursor(),
  onOpen() {
    markConnected();
    if (pendingBrowserRecoveryRef.current) {
      pendingBrowserRecoveryRef.current = false;
      void recoverActiveChatAfterReconnect().catch(() => {});
    }
  },
```

- [ ] **Step 3: Persist event IDs before event filtering**

At the start of `onEvent(event)`, before the existing event/data guard, add:

```ts
writeChatStreamCursor(event.id);
```

Expected behavior: `projection.gap` or other event frames also update the
stored cursor when they carry an SSE `id`.

- [ ] **Step 4: Add regression test for initial cursor**

In `useChatSSE-visibility.test.tsx`, add:

```ts
it("starts the chat stream from the stored live projection cursor", async () => {
  window.localStorage.setItem("deckGoLiveProjection:chat-session:lastEventId", "42");

  await act(async () => {
    root = createRoot(container);
    root.render(<HookHost />);
  });

  const streamOptions = vi.mocked(deckStream).mock.calls[0]?.[1];
  expect(streamOptions?.lastEventId).toBe("42");
});
```

- [ ] **Step 5: Add regression test for cursor persistence**

In `useChatSSE-visibility.test.tsx`, add:

```ts
it("persists incoming chat stream event ids to the live projection cursor", async () => {
  await act(async () => {
    root = createRoot(container);
    root.render(<HookHost />);
  });

  const streamOptions = vi.mocked(deckStream).mock.calls[0]?.[1];
  streamOptions?.onEvent?.({
    id: "43",
    event: "chat",
    data: JSON.stringify({
      sessionKey: "sess-1",
      runId: "run-1",
      state: "delta",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "cursor" }],
        timestamp: 123,
      },
    }),
  });

  expect(window.localStorage.getItem("deckGoLiveProjection:chat-session:lastEventId")).toBe("43");
});
```

- [ ] **Step 6: Run focused frontend regression tests**

Run:

```bash
cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/chat/__tests__/useChatSSE-visibility.test.tsx
```

Expected: exits 0.

## Task 5: Update Defect Gate Decisions

**Files:**

- Modify: `docs/realignment/chat-defect-confirmation.md`

- [ ] **Step 1: Replace pending decisions for C1-C3**

After user approval, update C1-C3 `User decision` cells:

```markdown
approved for Phase 5
```

For C2a, add the exact user decision in the C2 row:

```markdown
Gateway schema `result` alignment approved
```

or:

```markdown
Gateway schema change deferred; deck-go product metadata only
```

- [ ] **Step 2: Mark C4-C9 as deferred unless new evidence appears**

Use this wording for unchanged non-scope rows:

```markdown
deferred unless Phase 5 trace proves active impact
```

Expected: the gate document records why the implementation scope is bounded.

## Task 6: Run Contract And Build Verification

**Files:**

- Read verification outputs only.

- [ ] **Step 1: Run narrow contract checks**

Run:

```bash
cd deck-go && make ui-metadata-check
cd deck-go && make contracts-check
```

Expected: both exit 0.

- [ ] **Step 2: Run protocol check if Task 3 ran**

Run:

```bash
cd deck-go && make protocol-check
```

Expected: exits 0.

- [ ] **Step 3: Run live projection contract check**

Run:

```bash
cd deck-go && make live-projection-contract-check
```

Expected: exits 0.

- [ ] **Step 4: Run focused frontend test**

Run:

```bash
cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/chat/__tests__/useChatSSE-visibility.test.tsx
```

Expected: exits 0.

- [ ] **Step 5: Run frontend build**

Run:

```bash
cd deck-go && make frontend-build
```

Expected: exits 0.

- [ ] **Step 6: Run contract gate**

Run:

```bash
cd deck-go && make contract-gate
```

Expected: exits 0. If unrelated dirty generated files block this gate, stop,
identify the unrelated files, and report the blocker instead of broadening the
Phase 5 scope.

## Task 7: Verify Chat Reference Trace

**Files:**

- Read: `.local/chat-*` latest run records, if present.
- Run: real chat module E2E when environment is available.

- [ ] **Step 1: Run chat real Gateway E2E**

Run:

```bash
cd deck-go && make e2e-real-module MODULE=chat
```

Expected: `chat-real-gateway.spec.ts` passes or reports an environment blocker
that is not caused by the Phase 5 changes.

- [ ] **Step 2: Run chat command real Gateway E2E if compaction or command flow changed**

Run:

```bash
cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test --config playwright.config.ts test/e2e/chat-command-real-gateway.spec.ts
```

Expected: passes, or records a bounded environment blocker with evidence.

- [ ] **Step 3: Summarize trace evidence**

The final report must state whether the following chain was verified:

```text
frontend send -> BFF /chat/send -> Gateway sessions.send -> Gateway chat.send -> stream event -> history/snapshot readback -> frontend rendered state
```

Expected: every checked link has either fresh pass evidence or an explicit gap.

## Task 8: Commit Scope

**Files:**

- Commit only files changed by this plan.

- [ ] **Step 1: Review scoped diff**

Run:

```bash
git diff -- deck-go/contracts/source/deck-ui.contract.json deck-go/contracts/source/deck-api.contract.ts src/gateway/protocol/schema/sessions-extensions.ts deck-go/frontend-new/src/components/panels/chat/useChatSSE.ts deck-go/frontend-new/src/components/panels/chat/__tests__/useChatSSE-visibility.test.tsx docs/realignment/chat-defect-confirmation.md
```

Expected: only approved C1-C3/C2a changes appear.

- [ ] **Step 2: Include generated files only if produced by approved commands**

Review generated diffs:

```bash
git diff -- deck-go/contracts/generated/ts/deck-ui-metadata.generated.ts deck-go/docs/deck-ui-contract-metadata.md deck-go/contracts/generated/ts/deck-api.generated.ts deck-go/backend/internal/deckapi/types.generated.go deck-go/contracts/generated/ts/gateway deck-go/backend/internal/gateway/generated
```

Expected: generated diffs correspond to approved source changes only.

- [ ] **Step 3: Commit with scoped files**

Use `scripts/committer` with only approved files. The commit message must record
C1/C2/C3 decisions, verification commands, and any real E2E gap.

Expected: unrelated worktree changes are not staged or committed.

## Approval Required Before Coding

Coding can start only after the user approves this scope:

1. Fix C1.
2. Fix C2 as active compaction contract drift.
3. Decide C2a:
   - approve Gateway schema `result` alignment, or
   - defer Gateway schema and repair only deck-go product metadata.
4. Fix C3 by making specialized chat SSE honor the live-projection cursor.
5. Keep C4-C9 out of the first coding pass unless new active-impact evidence appears.
