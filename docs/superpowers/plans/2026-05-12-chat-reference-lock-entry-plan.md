# Chat Reference Lock Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the Phase 5 chat reference lock entry gate by confirming real active chat defects before any implementation.

**Architecture:** This is a gated documentation and fact-confirmation plan, not a code-fix plan. It updates the realignment tracker, records a defect confirmation table, asks the user to decide which candidates are real Phase 5 defects, and then stops so a second implementation plan can be written from confirmed defects only.

**Tech Stack:** Markdown, Git, ripgrep, deck-go contracts, Go BFF route files, React frontend API/store files, Gateway TypeScript protocol files.

---

## File Structure

- Modify: `REALIGNMENT.md`
  - Responsibility: record Phase 4 approval and Phase 5 entry status.
- Create: `docs/realignment/chat-defect-confirmation.md`
  - Responsibility: classify candidate chat issues into real defects, historical artifacts, design tradeoffs, and verification gaps.
- Do not modify implementation files in this entry plan.

## Task 1: Mark Phase 4 Approved And Phase 5 Started

**Files:**

- Modify: `REALIGNMENT.md`

- [ ] **Step 1: Read the tracker**

Run:

```bash
sed -n '600,612p' REALIGNMENT.md
```

Expected: Phase 4 is not yet marked done, and Phase 5 is pending or not yet at the defect confirmation gate.

- [ ] **Step 2: Update the tracker**

Change the Phase 4 row to:

```markdown
| 4 | **Goal 2**: chat brainstorming | ✅ Done 2026-05-12 | Codex | `docs/superpowers/specs/2026-05-12-chat-control-reference-design.md` approved; chat is reference module, not presumed broken |
```

Change the Phase 5 row to:

```markdown
| 5 | **Goal 2**: chat vertical slice | 🟡 In progress | Codex | Start with Phase 5 defect confirmation gate before implementation |
```

- [ ] **Step 3: Verify only tracker lines changed**

Run:

```bash
git diff -- REALIGNMENT.md
```

Expected: only the Phase 4 and Phase 5 tracker rows change.

## Task 2: Confirm Active Chat Defect Candidates

**Files:**

- Create: `docs/realignment/chat-defect-confirmation.md`

- [ ] **Step 1: Confirm product contract evidence**

Run:

```bash
rg -n "chat/sessions/create|chat/steer|chat/sessions|/sessions|sessions.compact|DeckGoCompactionActionResponse|DeckGoSessionMutationResponse" deck-go/contracts/source/deck-ui.contract.json deck-go/contracts/source/deck-endpoints.contract.json deck-go/contracts/source/deck-mutations.contract.json deck-go/contracts/source/deck-api.contract.ts
```

Expected evidence:

- `deck-go/contracts/source/deck-endpoints.contract.json` lists `POST /chat/sessions/create` and `POST /chat/steer`.
- `deck-go/contracts/source/deck-mutations.contract.json` lists `chat.session.create`, `chat.steer`, and `chat.compact`.
- `deck-go/contracts/source/deck-ui.contract.json` has active sessions-chat metadata but omits create/steer actions.
- `deck-go/contracts/source/deck-ui.contract.json` and `deck-go/contracts/source/deck-mutations.contract.json` disagree on the compact result DTO.

- [ ] **Step 2: Confirm Gateway registry evidence**

Run:

```bash
rg -n "chat\\.side_result|chat\\.inject|ChatInject|chatMethodDefs|ChatEventSchema|event.*chat" src/gateway/server-methods/chat.ts src/gateway/server-methods/chat-method-defs.ts src/gateway/event-defs.ts src/gateway/protocol/schema/logs-chat.ts
```

Expected evidence:

- `chat.side_result` is emitted.
- `chat.side_result` is not registered in `gatewayEventDefs`.
- `chat.inject` exists in handler/schema.
- `chat.inject` is not registered in `chatMethodDefs`.

- [ ] **Step 3: Confirm active BFF/frontend route evidence**

Run:

```bash
rg -n "chat/send|chat/sessions/create|chat/steer|chat/history|chat/snapshot|/sessions|deckStream|/api/stream|DeckGoSessionCreateResponse|SessionCreateResponse|a2uiState" deck-go/backend/internal/server deck-go/backend/internal/api/http deck-go/backend/internal/runtime/openclaw deck-go/frontend-new/src/api.ts deck-go/frontend-new/src/components/panels/chat deck-go/frontend-new/src/data/modules/chat deck-go/frontend-new/src/stores
```

Expected evidence:

- BFF exposes `/chat/sessions/create`, `/chat/send`, `/chat/steer`, `/chat/history`, and `/chat/snapshot`.
- Frontend API calls `/chat/sessions/create`, `/chat/send`, `/chat/steer`, `/chat/history`, and `/chat/snapshot`.
- Specialized chat SSE uses `/api/stream`.
- Frontend chat compatibility code still contains local view-model shims.

- [ ] **Step 4: Write the defect confirmation document**

Create `docs/realignment/chat-defect-confirmation.md` with these sections:

```markdown
# Chat Defect Confirmation Gate

## Inputs

## Decision Rule

## Candidate Defect Table

## Recommended Confirmation Set

## Phase 5 Stop Condition
```

The table must include C1-C9:

- C1: missing create/steer UI metadata.
- C2: compaction response DTO drift.
- C3: chat live projection cursor mismatch.
- C4: unregistered `chat.side_result`.
- C5: unregistered `chat.inject`.
- C6: frontend compatibility shims.
- C7: loose generated dynamic types.
- C8: `/api` versus non-`/api` path convention.
- C9: stale `migrationStatus: "partial"` marker.

- [ ] **Step 5: Verify the document has no placeholders**

Run:

```bash
rg -n "T[O]DO|T[B]D|F[I]XME|P[L]ACEHOLDER|待[定]|暂[定]" docs/realignment/chat-defect-confirmation.md
```

Expected: no matches.

## Task 3: Stop For User Confirmation

**Files:**

- Read: `docs/realignment/chat-defect-confirmation.md`

- [ ] **Step 1: Present the recommended confirmation set**

Tell the user:

```text
推荐确认 C1 为本轮真实缺陷；C2 在 compaction 仍属于 active maintenance surface 的前提下本轮修；C3 先作为验证项确认 contract intent；C4-C9 不进入第一轮实现，除非 trace 发现 active impact。
```

- [ ] **Step 2: Wait for user decision**

Do not edit implementation files. Do not regenerate contracts. Do not run broad format/build commands until the user confirms which candidates enter the implementation plan.

## Task 4: Write The Confirmed Implementation Plan After User Decision

**Files:**

- Create: `docs/superpowers/plans/2026-05-12-chat-reference-lock-implementation-plan.md`

- [ ] **Step 1: Convert only confirmed candidates into implementation tasks**

If the user accepts the recommended set, the implementation plan must include:

```markdown
### Task 1: Repair chat create/steer product metadata

### Task 2: Align compaction response contract if C2 is confirmed

### Task 3: Verify chat stream cursor/gap contract intent

### Task 4: Regenerate and check contract artifacts

### Task 5: Run the chat reference trace verification
```

- [ ] **Step 2: Keep unconfirmed candidates out of implementation**

Do not include C4-C9 in code tasks unless the user explicitly promotes them or Phase 5 trace produces new active-impact evidence.

- [ ] **Step 3: Offer execution mode**

After the confirmed implementation plan exists, offer:

```text
Plan complete and saved to `docs/superpowers/plans/2026-05-12-chat-reference-lock-implementation-plan.md`.

1. Subagent-Driven (recommended)
2. Inline Execution

Which approach?
```
