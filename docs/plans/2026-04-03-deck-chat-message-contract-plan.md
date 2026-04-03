# Deck Chat Message Contract Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立 Gateway 到 Deck 的 canonical transcript contract，让 `chat.history`、`session.message`、`session.tool`、chat 页和 Sessions 面板共享同一套 ingestion/rendering 链路，并彻底消除已支持 block type 的 JSON 泄漏与静默丢失。

**Architecture:** 分三段推进。第一段在 Gateway 输出边界定义 canonical transcript block、typed session/chat event payload，并让 `chat.history` 与 session 事件走同一规范化出口。第二段扩展 protocol/codegen 与 Deck transcript core，把 history、snapshot、live events、`reloadFullContent`、Sessions detail 全部接到同一个 adapter。第三段建立 renderer registry、structured `tool_result` 渲染和 fallback card，移除分散的 `JSON.stringify` / `normalizeContent()` 主路径逻辑，并用完整验证收口。

**Tech Stack:** TypeScript, TypeBox/AJV, Gateway method registry, Next.js 15 App Router, React 19, Zustand, Vitest

**OpenSpec:** `openspec/changes/deck-chat-message-contract/` — 3 specs, 7 requirements, 13 scenarios

---

## File Structure

### New Files

| File                                                                                        | Responsibility                                                                                              |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `src/gateway/protocol/schema/transcript.ts`                                                 | Canonical transcript block/message schema and shared session-event payload fragments                        |
| `src/gateway/transcript-canonical.ts`                                                       | Gateway-side canonicalization helpers for history messages and session/tool event payloads                  |
| `src/gateway/event-defs.ts`                                                                 | Typed event payload registry for `chat` / `agent` / `session.message` / `session.tool` / `sessions.changed` |
| `src/gateway/server-methods/chat.transcript-contract.test.ts`                               | Gateway contract tests for canonical `chat.history` output                                                  |
| `dashboard/src/lib/transcript-adapter.ts`                                                   | Single Deck adapter that ingests canonical transcript messages/events into local renderable state           |
| `dashboard/src/lib/transcript-adapter.test.ts`                                              | Unit tests for transcript adapter alias handling and tool result preservation                               |
| `dashboard/src/components/panels/chat/TranscriptBlocks.tsx`                                 | Shared transcript block renderer entrypoint used by chat and Sessions detail                                |
| `dashboard/src/components/panels/chat/transcript-render-registry.tsx`                       | Renderer registry and block-to-component mapping                                                            |
| `dashboard/src/components/panels/chat/blocks/UnknownBlockCard.tsx`                          | Explicit fallback renderer for unknown/version-skewed transcript blocks                                     |
| `dashboard/src/components/panels/chat/__tests__/message-list.transcript-rendering.test.tsx` | Chat rendering tests for known blocks, structured tool results, and fallback behavior                       |
| `dashboard/src/components/panels/sessions/__tests__/SessionDetail.test.tsx`                 | Sessions detail tests proving adapter/render parity with chat                                               |

### Modified Files

| File                                                                              | Change                                                                                                                                            |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/gateway/protocol/schema/logs-chat.ts`                                        | Replace `Type.Unknown()` transcript content with canonical transcript schemas; add typed session/chat event payload exports if kept here          |
| `src/gateway/protocol/schema/protocol-schemas.ts`                                 | Register transcript schemas and new event payload schemas for codegen/introspection                                                               |
| `src/gateway/protocol/index.ts`                                                   | Export validators/types for transcript schemas and any new typed event payload validators                                                         |
| `src/gateway/method-registry.ts`                                                  | Carry typed event payload definitions through registry/describe output and keep schema/version drift semantics aligned with event payload changes |
| `src/gateway/method-registry-data.ts`                                             | Export event definitions alongside `allEventNames` for codegen                                                                                    |
| `src/gateway/server-methods.ts`                                                   | Pass event definitions into `buildMethodRegistry()`                                                                                               |
| `src/gateway/server-methods/chat-method-defs.ts`                                  | Point `chat.history` at canonical result schema                                                                                                   |
| `src/gateway/server-methods/chat.ts`                                              | Canonicalize `chat.history` output at the Gateway egress boundary                                                                                 |
| `src/gateway/server-chat.ts`                                                      | Canonicalize `session.tool` payloads before broadcast                                                                                             |
| `src/gateway/server.impl.ts`                                                      | Canonicalize `session.message` / `sessions.changed` payloads before broadcast                                                                     |
| `src/gateway/method-registry.test.ts`                                             | Assert event payload definitions appear in registry/describe output                                                                               |
| `src/gateway/server-methods/describe.test.ts`                                     | Assert `gateway.describe` exposes event payload schemas                                                                                           |
| `src/gateway/session-message-events.test.ts`                                      | Verify `session.message` / `sessions.changed` emit canonical transcript payloads                                                                  |
| `src/gateway/server-chat.agent-events.test.ts`                                    | Verify `session.tool` preserves structured tool results                                                                                           |
| `scripts/protocol-gen-ts.ts`                                                      | Generate typed event payload definitions in addition to method params/results                                                                     |
| `dashboard/src/types/gateway-protocol.generated.ts`                               | Regenerated protocol types including transcript/event payloads                                                                                    |
| `dashboard/src/types/gateway-client.generated.ts`                                 | Regenerated client + event name/types metadata                                                                                                    |
| `dashboard/src/app/api/chat/snapshot/route.ts`                                    | Treat snapshot transcript data as canonical message arrays                                                                                        |
| `dashboard/src/components/panels/chat/history-normalize.ts`                       | Delegate to shared transcript adapter or become temporary compatibility shim                                                                      |
| `dashboard/src/components/panels/chat/useChatSSE.ts`                              | Consume generated event payload types instead of `Record<string, unknown>`                                                                        |
| `dashboard/src/components/panels/chat/MessageList.tsx`                            | Render transcript blocks through registry rather than ad-hoc branching                                                                            |
| `dashboard/src/components/panels/chat/blocks/ToolResultCard.tsx`                  | Accept structured `tool_result.content` and stop forcing string-only content                                                                      |
| `dashboard/src/components/panels/sessions/SessionDetail.tsx`                      | Reuse shared transcript renderer instead of rendering `string` bubbles only                                                                       |
| `dashboard/src/stores/chat-types.ts`                                              | Align local transcript/renderable types with canonical contract and fallback behavior                                                             |
| `dashboard/src/stores/chat-dispatchers.ts`                                        | Route history/live reload/session events through one transcript adapter; preserve authoritative tool blocks                                       |
| `dashboard/src/stores/sessions.ts`                                                | Remove private string-only transcript normalization and reuse shared adapter                                                                      |
| `dashboard/src/components/panels/chat/__tests__/history-normalize.test.ts`        | Repoint tests to shared adapter semantics                                                                                                         |
| `dashboard/src/components/panels/chat/__tests__/dispatcher.test.ts`               | Cover typed `session.message` / `session.tool` ingestion and `reloadFullContent` behavior                                                         |
| `dashboard/src/components/panels/chat/__tests__/tool-progress-dispatcher.test.ts` | Cover structured `session.tool` progress/result ingestion                                                                                         |

### Generated / Verification Outputs

| File                                                | Responsibility                                                   |
| --------------------------------------------------- | ---------------------------------------------------------------- |
| `dashboard/src/types/gateway-protocol.generated.ts` | Regenerated type surface for methods + transcript/event payloads |
| `dashboard/src/types/gateway-client.generated.ts`   | Regenerated client factory metadata                              |

---

## Chunk 1: Gateway Contract

### Task 1: Define canonical transcript schema and egress canonicalization

**Files:**

- Create: `src/gateway/protocol/schema/transcript.ts`
- Create: `src/gateway/transcript-canonical.ts`
- Create: `src/gateway/server-methods/chat.transcript-contract.test.ts`
- Modify: `src/gateway/protocol/schema/logs-chat.ts`
- Modify: `src/gateway/protocol/schema/protocol-schemas.ts`
- Modify: `src/gateway/protocol/index.ts`
- Modify: `src/gateway/server-methods/chat-method-defs.ts`
- Modify: `src/gateway/server-methods/chat.ts`
- Modify: `src/gateway/server-chat.ts`
- Modify: `src/gateway/server.impl.ts`
- Modify: `src/gateway/session-message-events.test.ts`
- Modify: `src/gateway/server-chat.agent-events.test.ts`

**covers:** `chat-message-contract/spec.md > ADDED > Deck-facing transcript surfaces use canonical block arrays > "chat.history canonicalizes plain user text"`
**covers.id:** `chat-message-contract.history-plain-text`
**covers:** `chat-message-contract/spec.md > ADDED > Deck-facing transcript surfaces use canonical block arrays > "session.message matches chat.history message contract"`
**covers:** `chat-message-contract/spec.md > ADDED > Deck-facing transcript surfaces use canonical block arrays > "legacy alias block types are normalized before egress"`
**covers.id:** `chat-message-contract.alias-block-normalization`
**covers:** `chat-message-contract/spec.md > ADDED > Deck-facing transcript surfaces use canonical block arrays > "image and file blocks are preserved before egress"`
**covers.id:** `chat-message-contract.image-file-preserved`
**covers:** `chat-message-contract/spec.md > ADDED > Structured tool results are preserved across transcript surfaces > "session.tool preserves structured result content"`
**covers.id:** `chat-message-contract.session-tool-structured-result`
**covers:** `chat-message-contract/spec.md > ADDED > Structured tool results are preserved across transcript surfaces > "chat history preserves structured tool_result content"`
**covers.id:** `chat-message-contract.history-tool-result-structured`

- [x] **Step 1.1: 先写 Gateway contract 失败测试**
      在 `src/gateway/server-methods/chat.transcript-contract.test.ts` 覆盖 `chat.history` 的 plain string、`toolCall`/`toolResult`、`input_text`/`output_text`、`reasoning`/`analysis`、`image`/`file`、structured `tool_result`。在 `src/gateway/session-message-events.test.ts` 和 `src/gateway/server-chat.agent-events.test.ts` 补 `session.message` / `session.tool` 的 canonical payload 断言。

- [x] **Step 1.2: 定义 canonical transcript schema**
      新建 `src/gateway/protocol/schema/transcript.ts`，定义：
      `TranscriptTextBlock`、`TranscriptThinkingBlock`、`TranscriptToolUseBlock`、`TranscriptToolResultBlock`、`TranscriptImageBlock`、`TranscriptFileBlock`、`TranscriptBlockSchema`、`TranscriptMessageSchema`，并明确 reasoning-family 输出统一为 `thinking`。

- [x] **Step 1.3: 实现 Gateway canonicalization helper**
      在 `src/gateway/transcript-canonical.ts` 实现轻量映射函数，负责把 legacy `string`、单对象 block、alias block、structured tool result 转成 canonical transcript blocks；保持 O(n) 线性遍历，不做不必要深拷贝。

- [x] **Step 1.4: 将所有 Deck-facing transcript 出口接到 canonicalization helper**
      把 `chat.history`、`session.message`、`session.tool` 统一接到 helper。实现顺序先固定为：1. 先让 `chat.history` 通过 contract test，确认 canonical block set 与 helper 设计成立 2. 再把同一个 helper 扩到 `session.message` / `session.tool`，避免三条链路一起调试
      `src/gateway/server-methods/chat.ts` 不能再把 `content` 以 `unknown` 原样吐给 Deck；`src/gateway/server.impl.ts` 和 `src/gateway/server-chat.ts` 不能再把 session-scoped payload 广播为宽松 shape。

- [x] **Step 1.5: 注册 schema 并跑定向验证**
      让 `logs-chat.ts` / `protocol-schemas.ts` / `protocol/index.ts` 输出新的 transcript schema，然后运行：

```bash
pnpm test -- src/gateway/server-methods/chat.transcript-contract.test.ts src/gateway/session-message-events.test.ts src/gateway/server-chat.agent-events.test.ts
```

- [ ] **Step 1.6: Commit**

```bash
scripts/committer "[enhanced] feat(gateway): canonicalize deck-facing transcript payloads" \
  src/gateway/protocol/schema/transcript.ts \
  src/gateway/transcript-canonical.ts \
  src/gateway/server-methods/chat.transcript-contract.test.ts \
  src/gateway/protocol/schema/logs-chat.ts \
  src/gateway/protocol/schema/protocol-schemas.ts \
  src/gateway/protocol/index.ts \
  src/gateway/server-methods/chat-method-defs.ts \
  src/gateway/server-methods/chat.ts \
  src/gateway/server-chat.ts \
  src/gateway/server.impl.ts \
  src/gateway/session-message-events.test.ts \
  src/gateway/server-chat.agent-events.test.ts
```

### Task 2: Extend registry and codegen for typed event payloads

**Files:**

- Create: `src/gateway/event-defs.ts`
- Modify: `src/gateway/method-registry.ts`
- Modify: `src/gateway/method-registry-data.ts`
- Modify: `src/gateway/server-methods.ts`
- Modify: `src/gateway/method-registry.test.ts`
- Modify: `src/gateway/server-methods/describe.test.ts`
- Modify: `scripts/protocol-gen-ts.ts`
- Modify: `dashboard/src/types/gateway-protocol.generated.ts`
- Modify: `dashboard/src/types/gateway-client.generated.ts`

**covers:** `chat-message-contract/spec.md > ADDED > Deck-facing transcript surfaces use canonical block arrays > "session.message matches chat.history message contract"`
**covers.id:** `chat-message-contract.session-message-history-parity`
**covers:** `chat-session-sync/spec.md > MODIFIED > Runtime transcript sync uses a shared transcript adapter > "History and live events share one adapter"`

- [x] **Step 2.1: 先写 registry / describe 失败测试**
      扩展 `src/gateway/method-registry.test.ts` 和 `src/gateway/server-methods/describe.test.ts`，断言 registry/`gateway.describe` 能暴露 `chat`、`agent`、`session.message`、`session.tool`、`sessions.changed` 的 payload schema。

- [x] **Step 2.2: 建 event payload 定义文件**
      在 `src/gateway/event-defs.ts` 导出首批 event definitions。范围固定为 `chat`、`agent`、`session.message`、`session.tool`、`sessions.changed`，不要把 `approval.*`、`canvas` 这种 Deck 内部事件混进 Gateway contract。

- [x] **Step 2.3: 把 event defs 接入 registry 与 describe**
      `buildMethodRegistry()` 已有 `eventDefs` 参数，重点不是改签名，而是：- 在 `src/gateway/server-methods.ts` 传入 event defs - 在 `src/gateway/method-registry-data.ts` 暴露相同集合，避免 codegen 和 runtime 各维护一份事实 - 视需要扩展 `EventDefinition` 或 schema/version 逻辑，确保 event payload 变化也会进入 drift/describe 语义

- [x] **Step 2.4: 扩展 `scripts/protocol-gen-ts.ts`**
      让 codegen 生成 event payload interface/type，而不是只输出事件名集合。浏览器消费端要能直接 import typed payload，而不再落回 `Record<string, unknown>`。

- [x] **Step 2.5: 重新生成并校验 drift**
      运行：

```bash
pnpm protocol:gen:ts
pnpm protocol:gen:check
pnpm test -- src/gateway/method-registry.test.ts src/gateway/server-methods/describe.test.ts
```

- [ ] **Step 2.6: Commit**

```bash
scripts/committer "[enhanced] feat(protocol): generate typed gateway event payloads for deck" \
  src/gateway/event-defs.ts \
  src/gateway/method-registry.ts \
  src/gateway/method-registry-data.ts \
  src/gateway/server-methods.ts \
  src/gateway/method-registry.test.ts \
  src/gateway/server-methods/describe.test.ts \
  scripts/protocol-gen-ts.ts \
  dashboard/src/types/gateway-protocol.generated.ts \
  dashboard/src/types/gateway-client.generated.ts
```

---

## Chunk 2: Deck Transcript Core

### Task 3: Build one shared transcript adapter for history, live events, and reload

**Files:**

- Create: `dashboard/src/lib/transcript-adapter.ts`
- Create: `dashboard/src/lib/transcript-adapter.test.ts`
- Modify: `dashboard/src/app/api/chat/snapshot/route.ts`
- Modify: `dashboard/src/components/panels/chat/history-normalize.ts`
- Modify: `dashboard/src/components/panels/chat/useChatSSE.ts`
- Modify: `dashboard/src/stores/chat-types.ts`
- Modify: `dashboard/src/stores/chat-dispatchers.ts`
- Modify: `dashboard/src/components/panels/chat/__tests__/history-normalize.test.ts`
- Modify: `dashboard/src/components/panels/chat/__tests__/dispatcher.test.ts`
- Modify: `dashboard/src/components/panels/chat/__tests__/tool-progress-dispatcher.test.ts`

**covers:** `chat-session-sync/spec.md > MODIFIED > Runtime transcript sync uses a shared transcript adapter > "History and live events share one adapter"`
**covers.id:** `chat-session-sync.history-live-shared-adapter`
**covers:** `chat-session-sync/spec.md > MODIFIED > Reload preserves server-authoritative transcript structure > "reloadFullContent keeps authoritative tool blocks"`
**covers.id:** `chat-session-sync.reload-authoritative-tool-blocks`
**covers:** `chat-message-contract/spec.md > ADDED > Deck-facing transcript surfaces use canonical block arrays > "session.message matches chat.history message contract"`

- [x] **Step 3.1: 先写 adapter 失败测试**
      在 `dashboard/src/lib/transcript-adapter.test.ts` 覆盖 canonical text/thinking/tool/image/file、reasoning-family alias、structured `tool_result` 和 unknown/version-skew fallback。把 `history-normalize.test.ts` / `dispatcher.test.ts` 更新成“通过 adapter 断言语义”，不要继续依赖分散 helper。

- [x] **Step 3.2: 实现 transcript adapter**
      让 adapter 负责：- 把 canonical `TranscriptMessage` / `session.message` / `session.tool` payload 投成本地 renderable message - 在过渡期兼容少量 legacy shape - 为版本漂移准备 runtime fallback block，而不是在主文本里 `JSON.stringify`

      先锁定 adapter I/O，后续 Task 5 的 renderer registry 只能消费这里定义的输出类型，不能重新解释 raw payload。目标签名至少明确到这个粒度：

```ts
type RenderableBlock =
  | ContentBlock
  | {
      type: "unknown";
      rawType: string;
      summary: Record<string, unknown>;
    };

type RenderableMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: RenderableBlock[];
  timestamp: number;
};
```

- [x] **Step 3.3: 收敛 history/snapshot/live ingress**
      `history-normalize.ts` 在本任务里只保留兼容 shim 或直接委托给 adapter；`useChatSSE.ts` 改用 generated event payload types；`chat-dispatchers.ts` 不再以 `Record<string, unknown>` 为主路径输入类型。
      如果 `dashboard/src/app/api/chat/history/route.ts` 仍然是 lossless passthrough，则不要为了“完成任务”而修改它。

- [x] **Step 3.4: 修 `reloadFullContent` 的历史工具块合并逻辑**
      让 `reloadFullContent()` 先相信服务端返回的 authoritative blocks，再只在必要时做本地补齐，不能继续基于旧 Anthropic 假设主动丢掉历史里的 tool blocks。

- [x] **Step 3.5: 跑定向测试与类型检查**

```bash
cd dashboard && pnpm test src/lib/transcript-adapter.test.ts src/components/panels/chat/__tests__/history-normalize.test.ts src/components/panels/chat/__tests__/dispatcher.test.ts src/components/panels/chat/__tests__/tool-progress-dispatcher.test.ts
cd dashboard && pnpm lint
```

- [ ] **Step 3.6: Commit**

```bash
scripts/committer "[enhanced] refactor(deck-chat): unify transcript ingestion through one adapter" \
  dashboard/src/lib/transcript-adapter.ts \
  dashboard/src/lib/transcript-adapter.test.ts \
  dashboard/src/app/api/chat/snapshot/route.ts \
  dashboard/src/components/panels/chat/history-normalize.ts \
  dashboard/src/components/panels/chat/useChatSSE.ts \
  dashboard/src/stores/chat-types.ts \
  dashboard/src/stores/chat-dispatchers.ts \
  dashboard/src/components/panels/chat/__tests__/history-normalize.test.ts \
  dashboard/src/components/panels/chat/__tests__/dispatcher.test.ts \
  dashboard/src/components/panels/chat/__tests__/tool-progress-dispatcher.test.ts
```

### Task 4: Move Sessions detail onto the same transcript contract

**Files:**

- Modify: `dashboard/src/stores/sessions.ts`
- Modify: `dashboard/src/components/panels/sessions/SessionDetail.tsx`
- Create: `dashboard/src/components/panels/sessions/__tests__/SessionDetail.test.tsx`

**covers:** `chat-session-sync/spec.md > MODIFIED > Runtime transcript sync uses a shared transcript adapter > "Sessions detail uses the same transcript adapter"`
**covers.id:** `chat-session-sync.sessions-detail-shared-adapter`
**covers:** `transcript-rendering-contract/spec.md > ADDED > Transcript surfaces render the same transcript contract consistently > "Chat and Sessions detail agree on transcript meaning"`
**covers.id:** `transcript-rendering.chat-sessions-consistent`

- [x] **Step 4.1: 先写 Sessions detail 失败测试**
      新增 `SessionDetail.test.tsx`，覆盖 text/thinking/tool/image/file/structured tool result 在 Sessions detail 中不会被压成单字符串，也不会与 chat 页表达出不同语义。

- [x] **Step 4.2: 改 Sessions store 的 history model**
      `dashboard/src/stores/sessions.ts` 去掉私有 `normalizeContent(content): string`，history state 改为保存 canonical/renderable transcript messages，直接复用 shared transcript adapter。

- [x] **Step 4.3: 改 Sessions detail 渲染入口**
      `SessionDetail.tsx` 不再自己拼 `HistoryBubble(message.content: string)`，而是改用和 chat 一样的 transcript block primitive。
      `dashboard/src/app/api/sessions/[sessionKey]/route.ts` 当前如果仍是 `chat.history` 的 lossless passthrough，就不要为了“完成任务”而改它；真正要删除的是 `dashboard/src/stores/sessions.ts` 里的 string-only 假设。

- [x] **Step 4.4: 跑 Sessions 定向测试**

```bash
cd dashboard && pnpm test src/components/panels/sessions/__tests__/SessionDetail.test.tsx
cd dashboard && pnpm lint
```

- [ ] **Step 4.5: Commit**

```bash
scripts/committer "[enhanced] refactor(deck-sessions): render session history with shared transcript contract" \
  dashboard/src/stores/sessions.ts \
  dashboard/src/components/panels/sessions/SessionDetail.tsx \
  dashboard/src/components/panels/sessions/__tests__/SessionDetail.test.tsx
```

---

## Chunk 3: Rendering, Cleanup, and Verification

### Task 5: Introduce transcript renderer registry and explicit fallback blocks

**Files:**

- Create: `dashboard/src/components/panels/chat/TranscriptBlocks.tsx`
- Create: `dashboard/src/components/panels/chat/transcript-render-registry.tsx`
- Create: `dashboard/src/components/panels/chat/blocks/UnknownBlockCard.tsx`
- Modify: `dashboard/src/components/panels/chat/MessageList.tsx`
- Modify: `dashboard/src/components/panels/chat/blocks/ToolResultCard.tsx`
- Modify: `dashboard/src/components/panels/chat/blocks/ImageBlock.tsx`
- Modify: `dashboard/src/components/panels/chat/blocks/FileBlock.tsx`
- Create: `dashboard/src/components/panels/chat/__tests__/message-list.transcript-rendering.test.tsx`

**covers:** `transcript-rendering-contract/spec.md > ADDED > Every canonical transcript block type has an explicit renderer > "Canonical blocks render without raw JSON leakage"`
**covers.id:** `transcript-rendering.known-blocks-no-json`
**covers:** `transcript-rendering-contract/spec.md > ADDED > Every canonical transcript block type has an explicit renderer > "Structured tool_result renders as structured content"`
**covers.id:** `transcript-rendering.structured-tool-result`
**covers:** `transcript-rendering-contract/spec.md > ADDED > Unknown transcript blocks degrade through a fallback card > "Unknown block does not corrupt the message bubble"`
**covers.id:** `transcript-rendering.unknown-block-fallback`
**covers:** `chat-message-contract/spec.md > ADDED > Deck-facing transcript surfaces use canonical block arrays > "image and file blocks are preserved before egress"`

- [x] **Step 5.1: 先写渲染失败测试**
      新增 `message-list.transcript-rendering.test.tsx`，覆盖：- `text` / `thinking` / `tool_use` / `tool_result` / `image` / `file` 都有显式 renderer - structured `tool_result.content` 不再直接变成 JSON blob - unknown block 落到 fallback card，而不是污染主 bubble

- [x] **Step 5.2: 建 renderer registry**
      在 `transcript-render-registry.tsx` 建立 block type -> renderer 的显式映射，并通过 `TranscriptBlocks.tsx` 暴露给 chat/Sessions surfaces；对 canonical block type 做穷举处理。
      registry 只能直接消费 Task 3 锁定的 `RenderableBlock` 输出，不能重新解释 raw Gateway payload，也不能回退到各 surface 自己猜 shape。

- [x] **Step 5.3: 重构 `ToolResultCard`**
      `ToolResultCard` 改成接受 `string | TranscriptBlock[]` 或上层 renderable block 内容；复用现有 artifact/diff/code/binary 视图，但只在 raw view 中展示原始 JSON。

- [x] **Step 5.4: 接通 `MessageList` 和 media blocks**
      `MessageList.tsx` 不再只抽 text/thinking/tool；`ImageBlock.tsx`、`FileBlock.tsx` 作为 registry 中的显式 renderer 接入主渲染链。

- [x] **Step 5.5: 跑渲染测试**

```bash
cd dashboard && pnpm test src/components/panels/chat/__tests__/message-list.transcript-rendering.test.tsx src/components/panels/sessions/__tests__/SessionDetail.test.tsx
cd dashboard && pnpm lint
```

- [ ] **Step 5.6: Commit**

```bash
scripts/committer "[enhanced] feat(deck-chat): add transcript renderer registry and fallback blocks" \
  dashboard/src/components/panels/chat/TranscriptBlocks.tsx \
  dashboard/src/components/panels/chat/transcript-render-registry.tsx \
  dashboard/src/components/panels/chat/blocks/UnknownBlockCard.tsx \
  dashboard/src/components/panels/chat/MessageList.tsx \
  dashboard/src/components/panels/chat/blocks/ToolResultCard.tsx \
  dashboard/src/components/panels/chat/blocks/ImageBlock.tsx \
  dashboard/src/components/panels/chat/blocks/FileBlock.tsx \
  dashboard/src/components/panels/chat/__tests__/message-list.transcript-rendering.test.tsx
```

### Task 6: Remove legacy transcript inference and run full verification

**Files:**

- Modify: `dashboard/src/components/panels/chat/history-normalize.ts`
- Modify: `dashboard/src/stores/chat-dispatchers.ts`
- Modify: `dashboard/src/stores/sessions.ts`
- Modify: `dashboard/src/components/panels/chat/useChatSSE.ts`
- Modify: `dashboard/src/lib/transcript-adapter.ts`
- Modify: `dashboard/src/components/panels/chat/__tests__/history-normalize.test.ts`
- Modify: `dashboard/src/components/panels/chat/__tests__/dispatcher.test.ts`
- Modify: `dashboard/src/components/panels/chat/__tests__/message-list.transcript-rendering.test.tsx`
- Modify: `dashboard/src/components/panels/sessions/__tests__/SessionDetail.test.tsx`
- Modify: `dashboard/src/types/gateway-protocol.generated.ts`
- Modify: `dashboard/src/types/gateway-client.generated.ts`

**covers:** All remaining scenarios that require integrated history/live/sessions/render verification and drift protection

- [x] **Step 6.1: 删主路径上的旧 inference**
      删除或下沉这些旧逻辑：- 未知对象直接 `JSON.stringify` 进 text bubble - `session.message` / `session.state` 以 `Record<string, unknown>` 为主类型 - Sessions store 的 string-only transcript normalize - Task 3 过渡期保留的 `history-normalize.ts` 兼容 shim（如果 adapter 已成为唯一路径，就在这里移除）
      保留的 runtime fallback 只能出现在 `UnknownBlockCard` 一类独立 renderer 里。

- [x] **Step 6.2: 收紧类型与 generated imports**
      让 `useChatSSE.ts`、dispatchers、stores 直接消费 generated event payload types；重新生成 `dashboard/src/types/gateway-*.generated.ts` 并消除由此带来的类型漂移。

- [x] **Step 6.3: 运行协议、构建、类型、完整测试**
      按仓库 landing bar 执行：

```bash
pnpm protocol:gen:ts
pnpm protocol:gen:check
pnpm build
cd dashboard && pnpm lint
pnpm test
```

- [ ] **Step 6.4: 做页面级一致性验证**
      手动或用浏览器级 smoke/E2E 验证同一 session 在 chat 页和 Sessions detail 的可见语义一致，至少覆盖 `text`、`thinking`、`tool_use`、`tool_result`、`image`、`file`、structured `tool_result`。

- [ ] **Step 6.5: 如果完整测试或页面验证暴露相关回归，先修复再复跑**
      只修与 transcript contract、renderer registry、event payload types 明显相关的失败；不要顺手扩 scope 到无关模块。

- [ ] **Step 6.6: Commit**

```bash
scripts/committer "[enhanced] refactor(deck): remove legacy transcript inference and verify canonical rendering" \
  dashboard/src/components/panels/chat/history-normalize.ts \
  dashboard/src/stores/chat-dispatchers.ts \
  dashboard/src/stores/sessions.ts \
  dashboard/src/components/panels/chat/useChatSSE.ts \
  dashboard/src/lib/transcript-adapter.ts \
  dashboard/src/components/panels/chat/__tests__/history-normalize.test.ts \
  dashboard/src/components/panels/chat/__tests__/dispatcher.test.ts \
  dashboard/src/components/panels/chat/__tests__/message-list.transcript-rendering.test.tsx \
  dashboard/src/components/panels/sessions/__tests__/SessionDetail.test.tsx \
  dashboard/src/types/gateway-protocol.generated.ts \
  dashboard/src/types/gateway-client.generated.ts
```

---

## Requirement Coverage Matrix

| Spec Requirement                                                                                     | Scenario                                              | Task       |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ---------- |
| chat-message-contract > Deck-facing transcript surfaces use canonical block arrays                   | chat.history canonicalizes plain user text            | T1         |
| chat-message-contract > Deck-facing transcript surfaces use canonical block arrays                   | session.message matches chat.history message contract | T1, T2, T3 |
| chat-message-contract > Deck-facing transcript surfaces use canonical block arrays                   | legacy alias block types are normalized before egress | T1         |
| chat-message-contract > Deck-facing transcript surfaces use canonical block arrays                   | image and file blocks are preserved before egress     | T1, T5     |
| chat-message-contract > Structured tool results are preserved across transcript surfaces             | session.tool preserves structured result content      | T1, T3, T5 |
| chat-message-contract > Structured tool results are preserved across transcript surfaces             | chat history preserves structured tool_result content | T1, T5     |
| transcript-rendering-contract > Every canonical transcript block type has an explicit renderer       | Canonical blocks render without raw JSON leakage      | T5         |
| transcript-rendering-contract > Every canonical transcript block type has an explicit renderer       | Structured tool_result renders as structured content  | T5         |
| transcript-rendering-contract > Unknown transcript blocks degrade through a fallback card            | Unknown block does not corrupt the message bubble     | T5         |
| transcript-rendering-contract > Transcript surfaces render the same transcript contract consistently | Chat and Sessions detail agree on transcript meaning  | T4, T5     |
| chat-session-sync > Runtime transcript sync uses a shared transcript adapter                         | History and live events share one adapter             | T2, T3     |
| chat-session-sync > Runtime transcript sync uses a shared transcript adapter                         | Sessions detail uses the same transcript adapter      | T4         |
| chat-session-sync > Reload preserves server-authoritative transcript structure                       | reloadFullContent keeps authoritative tool blocks     | T3         |
