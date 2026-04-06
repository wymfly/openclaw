# Deck Protocol-Driven Architecture Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按 `docs/plans/2026-04-06-deck-protocol-driven-design.md` 把 Deck 从“硬编码理解 Gateway 的客户端”迁到“由 Gateway 协议驱动的控制台”，先完成必要基础切片，再完成 `sessions.*` 主线切换，并为后续收敛工作留下清晰边界。

**Architecture:** 按四阶段推进：Phase B 先收敛 capability ownership、event intake 边界和 config 过渡边界；Phase C 再做 `sessions.*` 主链切换，并保留受限的 transcript read seam；Phase D 最后完成 config server-driven、agent/config 字段补齐与遗留硬编码清理。所有协议契约以 Gateway + codegen 为正式来源，Deck 只保留 view-model 与 UI rendering 组织。

**Tech Stack:** Next.js 15 App Router, React 19, Zustand, sql.js, TypeBox/AJV Gateway protocol, generated Gateway client/types, Vitest

---

## References

- Design baseline: `docs/plans/2026-04-06-deck-protocol-driven-design.md`
- Upstream sync umbrella: `docs/plans/2026-04-04-upstream-sync-plan.md`
- Related prior plans:
  - `docs/plans/2026-04-02-deck-chat-flow-closure-plan.md`
  - `docs/plans/2026-04-03-deck-chat-message-contract-plan.md`

---

## File Structure

| File                                                                                                   | Responsibility                                                 | Action    |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- | --------- |
| `docs/plans/2026-04-06-deck-protocol-driven-design.md`                                                 | 唯一设计基线                                                   | REFERENCE |
| `docs/plans/2026-04-06-deck-protocol-driven-plan.md`                                                   | 本实施计划                                                     | CREATE    |
| `dashboard/server/gateway-allowlist.ts`                                                                | 当前静态 allowlist 权威入口                                    | MODIFY    |
| `dashboard/server/gateway-adapter.ts`                                                                  | Gateway WS 连接、request 门控、session 事件桥接                | MODIFY    |
| `dashboard/server/runtime.ts`                                                                          | Runtime 初始化与 bootstrap 装配点                              | MODIFY    |
| `dashboard/server/event-bus.ts`                                                                        | Deck typed event bus                                           | MODIFY    |
| `dashboard/server/run-event-pipeline.ts`                                                               | EventBus → replay/projection ingest                            | MODIFY    |
| `dashboard/server/__tests__/gateway-adapter.test.ts`                                                   | allowlist / subscription / reconnect 行为验证                  | MODIFY    |
| `dashboard/server/__tests__/runtime.test.ts`                                                           | capability bootstrap / runtime wiring                          | MODIFY    |
| `dashboard/server/__tests__/event-bus.test.ts`                                                         | 事件接入与 replay 语义                                         | MODIFY    |
| `dashboard/src/types/gateway-protocol.generated.ts`                                                    | Gateway protocol codegen types                                 | GENERATED |
| `dashboard/src/types/gateway-client.generated.ts`                                                      | Gateway typed client + generated allowlist metadata            | GENERATED |
| `scripts/protocol-gen-ts.ts`                                                                           | TS codegen pipeline                                            | MODIFY    |
| `dashboard/src/app/api/chat/snapshot/route.ts`                                                         | active session snapshot（当前仍依赖 `chat.history` 读取 seam） | MODIFY    |
| `dashboard/src/app/api/chat/history/route.ts`                                                          | transcript read seam route                                     | MODIFY    |
| `dashboard/src/app/api/chat/sessions/create/route.ts`                                                  | create route                                                   | MODIFY    |
| `dashboard/src/app/api/chat/send/route.ts`                                                             | send route                                                     | MODIFY    |
| `dashboard/src/app/api/chat/abort/route.ts`                                                            | abort route                                                    | MODIFY    |
| `dashboard/src/app/api/chat/session-events/route.ts`                                                   | per-session subscribe/unsubscribe bridge                       | MODIFY    |
| `dashboard/src/components/panels/chat/chat-api.ts`                                                     | 浏览器侧聊天 API 封装                                          | MODIFY    |
| `dashboard/src/components/panels/chat/MessageInput.tsx`                                                | create/send/steer/abort entry UX                               | MODIFY    |
| `dashboard/src/components/panels/chat/ChatPanel.tsx`                                                   | snapshot hydrate + session switch                              | MODIFY    |
| `dashboard/src/stores/chat.ts`                                                                         | session state store                                            | MODIFY    |
| `dashboard/src/stores/chat-types.ts`                                                                   | session metadata / run metadata / projection fields            | MODIFY    |
| `dashboard/src/stores/chat-dispatchers.ts`                                                             | live event → chat state ingestion                              | MODIFY    |
| `dashboard/src/components/panels/chat/useChatSSE.ts`                                                   | chat event subscription consumer                               | MODIFY    |
| `dashboard/src/stores/config.ts`                                                                       | schema/bootstrap/lookup orchestration                          | MODIFY    |
| `dashboard/src/components/panels/config-editor/ConfigPanel.tsx`                                        | Config UI 主入口                                               | MODIFY    |
| `dashboard/src/components/panels/config-editor/SectionNav.tsx`                                         | lookup 驱动 section metadata                                   | MODIFY    |
| `dashboard/src/lib/schema-parser.ts`                                                                   | 当前前端 schema 解释层（需要退出正式权威位置）                 | MODIFY    |
| `dashboard/src/components/panels/config-editor/SchemaForm.tsx`                                         | server-driven field rendering consumer                         | MODIFY    |
| `dashboard/src/components/panels/config-editor/*.test.tsx` / `dashboard/src/lib/schema-parser.test.ts` | Config UI 回归测试                                             | MODIFY    |
| `src/gateway/server-methods/sessions.ts`                                                               | `sessions.*` runtime semantics                                 | REFERENCE |
| `src/gateway/server.chat.gateway-server-chat.test.ts`                                                  | `sessions.send/abort` Gateway tests                            | REFERENCE |
| `src/gateway/server.sessions.gateway-server-sessions-a.test.ts`                                        | `sessions.create/preview/list/...` Gateway tests               | REFERENCE |

---

## Chunk 1: Phase B — Capability Bootstrap & Protocol Ownership

### Task 1: 收敛 allowlist 权威来源到 capability bootstrap

**Files:**

- Modify: `dashboard/server/gateway-allowlist.ts`
- Modify: `dashboard/server/gateway-adapter.ts`
- Modify: `dashboard/server/runtime.ts`
- Modify: `dashboard/src/lib/api-helpers.ts`
- Modify: `dashboard/server/__tests__/gateway-adapter.test.ts`
- Modify: `dashboard/server/__tests__/runtime.test.ts`

- [ ] **Step 1.1: 写失败测试，证明静态 allowlist 不再是唯一运行时权威**

Run:

```bash
pnpm test -- dashboard/server/__tests__/gateway-adapter.test.ts -t "allowlist"
pnpm test -- dashboard/server/__tests__/runtime.test.ts -t "gateway"
```

Expected: 现有测试只能证明静态 allowlist/默认 runtime wiring，缺少 capability bootstrap 断言。

- [ ] **Step 1.2: 定义 capability snapshot 的最小 contract**

在 `dashboard/server/runtime.ts` 附近先明确最小能力面：

- `gateway.describe`
- `sessions.create`
- `sessions.send`
- `sessions.abort`
- `sessions.subscribe`
- `sessions.messages.subscribe`
- `config.schema.lookup`

并决定 runtime 在连接完成后何时拉取、何时报不兼容。

- [ ] **Step 1.3: 改造 `gateway-allowlist.ts` 的角色**

把它从“运行时最终权威”改成“生成契约/静态元数据的消费点”。保留生成物校验价值，但不要继续让它单独决定 Gateway 是否兼容。

- [ ] **Step 1.4: 在 adapter / runtime 中接 capability bootstrap**

要求：

- 连接成功后显式拉取 `gateway.describe`
- capability snapshot 注入 runtime
- 核心能力缺失时 fail-fast
- bootstrap 失败后 runtime 进入显式 `incompatible` 状态，`gwRequest()` / 相关 API 路径返回稳定的兼容性错误，而不是继续表现为普通网关暂时不可用
- 不引入长期 `raw(method, params)` 逃生舱
- 不引入长期静态 runtime fallback 作为正式路径

- [ ] **Step 1.5: 跑测试并记录 capability bootstrap 语义**

Run:

```bash
pnpm test -- dashboard/server/__tests__/gateway-adapter.test.ts
pnpm test -- dashboard/server/__tests__/runtime.test.ts
```

Expected: 通过，并新增“核心 capability 缺失 → 不兼容”断言。

- [ ] **Step 1.6: Commit**

```bash
scripts/committer "Constrain deck capability ownership to gateway bootstrap" \
  dashboard/server/gateway-allowlist.ts \
  dashboard/server/gateway-adapter.ts \
  dashboard/server/runtime.ts \
  dashboard/server/__tests__/gateway-adapter.test.ts \
  dashboard/server/__tests__/runtime.test.ts
```

### Task 2: 固定 protocol codegen 的正式边界

**Files:**

- Modify: `scripts/protocol-gen-ts.ts`
- Modify: `dashboard/src/types/gateway-protocol.generated.ts`
- Modify: `dashboard/src/types/gateway-client.generated.ts`
- Modify: `dashboard/server/gateway-allowlist.ts`
- Test: `dashboard/server/__tests__/gateway-adapter.test.ts`

- [ ] **Step 2.1: 先写失败断言，禁止运行时依赖未生成的新方法**

验证点：新方法只有在 `protocol:gen:ts` 后才进入正式 Deck 调用面。

- [ ] **Step 2.2: 收敛 codegen 产物角色**

明确：

- generated client/types 是正式 RPC contract
- generated method/event metadata 用于 compile-time/runtime bootstrap 辅助
- 不能再把“raw + 任意方法字符串”做成常规调用方式
- `dashboard/server/gateway-allowlist.ts` 里的 `EXTRA_METHODS` 必须被明确标注为**临时 seam**；只有两种允许路径：
  1. 先补 methodDefs / codegen 覆盖，再删除对应 extra entry
  2. 保留为具名临时 seam，并在注释中写清退出条件

- [ ] **Step 2.3: 跑 codegen 检查**

Run:

```bash
pnpm protocol:gen:ts
pnpm protocol:gen:check
```

Expected: 通过，无额外手写镜像类型补丁。

- [ ] **Step 2.4: Commit**

```bash
scripts/committer "Keep deck protocol contracts codegen-owned" \
  scripts/protocol-gen-ts.ts \
  dashboard/src/types/gateway-protocol.generated.ts \
  dashboard/src/types/gateway-client.generated.ts \
  dashboard/server/gateway-allowlist.ts \
  dashboard/server/__tests__/gateway-adapter.test.ts
```

---

## Chunk 2: Phase B — Event Intake Foundation

### Task 3: 建立 Gateway event intake / normalization 边界

**Files:**

- Modify: `dashboard/server/gateway-adapter.ts`
- Modify: `dashboard/server/event-bus.ts`
- Modify: `dashboard/server/run-event-pipeline.ts`
- Modify: `dashboard/server/runtime.ts`
- Modify: `dashboard/src/app/api/stream/route.ts`
- Modify: `dashboard/server/__tests__/event-bus.test.ts`
- Modify: `dashboard/server/__tests__/gateway-adapter.test.ts`
- Modify: `dashboard/server/__tests__/runtime.test.ts`
- Modify: `dashboard/server/run-event-pipeline.test.ts`

- [ ] **Step 3.1: 写失败测试，暴露“session 事件映射表 + typed EventBus”当前耦合**

Run:

```bash
pnpm test -- dashboard/server/__tests__/event-bus.test.ts
pnpm test -- dashboard/server/__tests__/gateway-adapter.test.ts -t "session"
```

Expected: 当前测试只能覆盖 `SESSION_EVENT_MAP` 映射路径，缺少 intake/normalization 边界断言。

- [ ] **Step 3.2: 定义 intake 层 contract**

在实施前先明确：

- Gateway domain events 先进入统一 intake 层
- intake 层负责 capability-aware routing / normalization
- EventBus 继续对 Deck 内部保持 typed contract
- 未消费的 Gateway 事件必须可忽略且不炸链路

- [ ] **Step 3.3: 改 `gateway-adapter.ts`，把“收到 WS event → 直接映射 DeckEventType”收紧成 intake 流程**

注意：

- 这一步不是要求所有事件名原样变成 EventBus 任意字符串
- 只要求把 adapter 的职责从硬编码分发，收敛成 intake 入口

- [ ] **Step 3.4: 更新 EventBus / SSE / replay 语义**

要求：

- 不破坏现有 replay / subscriber 模型
- 明确 Gateway-originated normalized event 与 Deck-owned event 的边界
- 保证 `RunEventPipeline` 继续只消费它真正需要的事件域
- 明确在 `dashboard/server/runtime.ts` 中的真实 wiring 点，避免只改 pipeline/adapter 却没有把 intake 边界接入生产 runtime

- [ ] **Step 3.5: 跑测试**

Run:

```bash
pnpm test -- dashboard/server/__tests__/event-bus.test.ts
pnpm test -- dashboard/server/__tests__/gateway-adapter.test.ts
pnpm test -- dashboard/server/__tests__/runtime.test.ts
pnpm test -- dashboard/server/run-event-pipeline.test.ts
```

- [ ] **Step 3.6: Commit**

```bash
scripts/committer "Stabilize deck gateway event intake boundaries" \
  dashboard/server/gateway-adapter.ts \
  dashboard/server/event-bus.ts \
  dashboard/server/run-event-pipeline.ts \
  dashboard/server/runtime.ts \
  dashboard/src/app/api/stream/route.ts \
  dashboard/server/__tests__/event-bus.test.ts \
  dashboard/server/__tests__/gateway-adapter.test.ts \
  dashboard/server/__tests__/runtime.test.ts \
  dashboard/server/run-event-pipeline.test.ts
```

---

## Chunk 3: Phase C — Session Mainline Cutover

### Task 4: 把 create/send/abort 主链正式切到 `sessions.*`

**Files:**

- Modify: `dashboard/src/app/api/chat/sessions/create/route.ts`
- Modify: `dashboard/src/app/api/chat/send/route.ts`
- Modify: `dashboard/src/app/api/chat/abort/route.ts`
- Modify: `dashboard/src/components/panels/chat/chat-api.ts`
- Modify: `dashboard/src/components/panels/chat/MessageInput.tsx`
- Modify: `dashboard/src/components/panels/chat/ChatPanel.tsx`
- Modify: `dashboard/src/stores/chat.ts`
- Modify: `dashboard/src/stores/chat-types.ts`
- Modify: `dashboard/src/stores/chat-dispatchers.ts`
- Modify: `dashboard/src/components/panels/chat/useChatSSE.ts`
- Test: `dashboard/src/components/panels/chat/__tests__/chat-api.test.ts`
- Test: `dashboard/src/components/panels/chat/__tests__/dispatcher.test.ts`
- Test: `dashboard/src/app/api/chat/send/route.test.ts` (create if absent)
- Test: `dashboard/src/app/api/chat/sessions/create/route.test.ts` (create if absent)
- Test: `dashboard/src/app/api/chat/abort/route.test.ts` (create if absent)
- Test: route-level tests for `dashboard/src/app/api/chat/sessions/create/route.ts`, `dashboard/src/app/api/chat/send/route.ts`, `dashboard/src/app/api/chat/abort/route.ts` (create if absent)

- [ ] **Step 4.1: 先写 failing tests，固定主链契约**

验证点：

- create 走 `sessions.create`
- send 默认走 `sessions.send`
- abort 走 `sessions.abort`
- `sessions.steer` 仅在需要 interrupt/特殊语义时使用
- `send/route.ts` 不能继续把默认聊天发送主路径落到 `sessions.steer`

Run:

```bash
cd dashboard && pnpm test src/components/panels/chat/__tests__/chat-api.test.ts src/components/panels/chat/__tests__/dispatcher.test.ts
```

- [ ] **Step 4.2: 收敛 `chat-api.ts` 调用面**

要求：

- 浏览器聊天调用统一经 `chat-api.ts`
- `create/send/abort` 的主语义与 Gateway 原生会话模型一致
- 不再让面板组件自己决定走 `chat.*` 还是 `sessions.*`

- [ ] **Step 4.3: 更新 `MessageInput.tsx` 与 `ChatPanel.tsx`**

要求：

- 新会话首条消息 flow 与后续消息 flow 在 UX 上清晰分层
- create 后 session key / run metadata / streaming 状态进入统一 store 流程
- 不再保留默认 bridge 逻辑

- [ ] **Step 4.4: 更新 chat store / dispatcher**

要求：

- session state 与 message stream 明确面向 Gateway-native 语义
- `sessions.changed` / `session.message` / `session.tool` 成为 live 更新正式来源

- [ ] **Step 4.5: 跑定向测试与类型检查**

Run:

```bash
cd dashboard && pnpm test src/components/panels/chat/__tests__/chat-api.test.ts src/components/panels/chat/__tests__/dispatcher.test.ts
cd dashboard && pnpm test src/app/api/chat/send/route.test.ts src/app/api/chat/sessions/create/route.test.ts src/app/api/chat/abort/route.test.ts
cd dashboard && pnpm exec tsc --noEmit
```

- [ ] **Step 4.6: Commit**

```bash
scripts/committer "Move deck chat mainline onto native sessions APIs" \
  dashboard/src/app/api/chat/sessions/create/route.ts \
  dashboard/src/app/api/chat/send/route.ts \
  dashboard/src/app/api/chat/abort/route.ts \
  dashboard/src/components/panels/chat/chat-api.ts \
  dashboard/src/components/panels/chat/MessageInput.tsx \
  dashboard/src/components/panels/chat/ChatPanel.tsx \
  dashboard/src/stores/chat.ts \
  dashboard/src/stores/chat-types.ts \
  dashboard/src/stores/chat-dispatchers.ts \
  dashboard/src/components/panels/chat/useChatSSE.ts \
  dashboard/src/components/panels/chat/__tests__/chat-api.test.ts \
  dashboard/src/components/panels/chat/__tests__/dispatcher.test.ts
```

### Task 5: 显式处理 transcript read seam，避免错误迁移到 `sessions.preview`

**Files:**

- Modify: `dashboard/src/app/api/chat/snapshot/route.ts`
- Modify: `dashboard/src/app/api/chat/history/route.ts`
- Modify: `dashboard/src/components/panels/chat/chat-api.ts`
- Modify: `dashboard/src/components/panels/chat/ChatPanel.tsx`
- Modify: `dashboard/src/stores/chat-dispatchers.ts`
- Modify (optional seam helper): `dashboard/src/components/panels/chat/history-normalize.ts`
- Test: `dashboard/src/app/api/chat/snapshot/route.test.ts`
- Test: `dashboard/src/components/panels/chat/__tests__/chat-api.test.ts`
- Test: `dashboard/src/components/panels/chat/__tests__/dispatcher.test.ts`

- [ ] **Step 5.1: 写失败测试，锁定 `sessions.preview` 与 `chat.history` 不是同一语义层**

验证点：snapshot/history 所需的是 full transcript，不是 preview summary。

- [ ] **Step 5.2: 抽出“受限读取兼容 seam”约束**

要求：

- 读取 seam 集中在 snapshot/history route 或专用 helper
- 文档和代码注释都说明这是临时兼容 seam
- 不允许把 `chat.history` 再扩展回发送/生命周期主链

- [ ] **Step 5.3: 跑测试**

Run:

```bash
pnpm test -- dashboard/src/app/api/chat/snapshot/route.test.ts
cd dashboard && pnpm test src/components/panels/chat/__tests__/chat-api.test.ts
```

- [ ] **Step 5.4: Commit**

```bash
scripts/committer "Isolate deck transcript read compatibility seam" \
  dashboard/src/app/api/chat/snapshot/route.ts \
  dashboard/src/app/api/chat/history/route.ts \
  dashboard/src/components/panels/chat/chat-api.ts \
  dashboard/src/components/panels/chat/ChatPanel.tsx \
  dashboard/src/stores/chat-dispatchers.ts \
  dashboard/src/app/api/chat/snapshot/route.test.ts \
  dashboard/src/components/panels/chat/__tests__/chat-api.test.ts \
  dashboard/src/components/panels/chat/__tests__/dispatcher.test.ts
```

---

## Chunk 4: Phase D — Config Server-Driven

### Task 6: 把 `config.schema.lookup` 提升为字段级正式权威来源

**Files:**

- Modify: `dashboard/src/stores/config.ts`
- Modify: `dashboard/src/components/panels/config-editor/ConfigPanel.tsx`
- Modify: `dashboard/src/components/panels/config-editor/SectionNav.tsx`
- Modify: `dashboard/src/components/panels/config-editor/SchemaForm.tsx`
- Modify: `dashboard/src/lib/schema-parser.ts`
- Modify: `dashboard/src/lib/schema-parser.test.ts`
- Create/Modify: `dashboard/src/components/panels/config-editor/ConfigPanel.test.tsx`
- Create/Modify: `dashboard/src/components/panels/config-editor/SectionNav.test.tsx`
- Create/Modify: `dashboard/src/components/panels/config-editor/SchemaForm.test.tsx`

- [ ] **Step 6.1: 写 failing tests，证明当前 lookup 只是 hints/fallback**

Run:

```bash
cd dashboard && pnpm test src/lib/schema-parser.test.ts
```

Expected: 现有测试聚焦本地 parse 逻辑，缺少 lookup 驱动字段级结构断言。

- [ ] **Step 6.2: 重新定义 config store 的 bootstrap/lookup 分工**

要求：

- `config.schema` 继续承担 coarse bootstrap
- `config.schema.lookup` 承担 section/path/field 级正式结构来源
- lookup 失败不能简单把“前端 parse 全权解释”继续当作最终模式
- `dashboard/src/stores/config.ts` 里对 lookup payload 做显式类型/结构收敛，不能长期停留在 `Map<string, unknown>` 的无约束缓存形态

- [ ] **Step 6.3: 修改 ConfigPanel / SectionNav / SchemaForm**

要求：

- 字段级结构与 metadata 逐步以 lookup 结果为准
- schema-parser 退到过渡适配角色，而不是正式权威位置
- 先覆盖活跃 section/visible path，再扩大范围

- [ ] **Step 6.4: 跑测试与类型检查**

Run:

```bash
cd dashboard && pnpm test src/lib/schema-parser.test.ts src/components/panels/config-editor
cd dashboard && pnpm exec tsc --noEmit
```

- [ ] **Step 6.5: Commit**

```bash
scripts/committer "Move deck config editor toward lookup-driven schema ownership" \
  dashboard/src/stores/config.ts \
  dashboard/src/components/panels/config-editor/ConfigPanel.tsx \
  dashboard/src/components/panels/config-editor/SectionNav.tsx \
  dashboard/src/components/panels/config-editor/SchemaForm.tsx \
  dashboard/src/components/panels/config-editor/ConfigPanel.test.tsx \
  dashboard/src/components/panels/config-editor/SectionNav.test.tsx \
  dashboard/src/components/panels/config-editor/SchemaForm.test.tsx \
  dashboard/src/lib/schema-parser.ts \
  dashboard/src/lib/schema-parser.test.ts
```

---

## Chunk 5: Phase D — Convergence & Completion

### Task 7: 补齐 agent/config 字段展示并清理遗留硬编码

**Files:**

- Modify: `dashboard/src/stores/chat-types.ts`
- Modify: `dashboard/src/stores/chat.ts`
- Modify after inventory: `dashboard/src/components/panels/agents/tabs/AgentConfigTab.tsx`
- Modify after inventory: `dashboard/src/components/panels/agents/tabs/ContextTab.tsx`
- Modify after inventory: `dashboard/src/components/panels/agents/tabs/OverviewTab.tsx`
- Modify: `dashboard/server/gateway-allowlist.ts`
- Modify: `dashboard/CLAUDE.md` (only if process rules materially changed)
- Test: relevant panel/store tests

- [ ] **Step 7.1: 盘点仍然由 Deck 私有硬编码维护的协议知识**

至少检查：

- session / run metadata 字段
- agent config fields
- allowlist extra entries
- event type assumptions

- [ ] **Step 7.2: 补齐展示层字段消费**

聚焦：

- `reasoningDefault`
- `fastModeDefault`
- sandbox backend / ssh
- provider transport 相关展示

说明：

- `thinkingDefault` 已有消费入口，先验证是否仍有缺口，不要默认重做
- 只有 inventory 证明缺失的字段才纳入本任务

- [ ] **Step 7.3: 移除已无必要的静态补丁**

只有在 codegen / capability / lookup 已覆盖的前提下，才删除旧的手工补丁逻辑。

- [ ] **Step 7.4: 跑最终验证集**

Run:

```bash
pnpm protocol:gen:check
pnpm check
pnpm build
cd dashboard && pnpm exec tsc --noEmit
pnpm test -- dashboard/server/__tests__/runtime.test.ts
pnpm test -- dashboard/server/run-event-pipeline.test.ts
pnpm test -- dashboard/server/__tests__/gateway-adapter.test.ts
cd dashboard && pnpm test src/components/panels/chat/__tests__/chat-api.test.ts src/components/panels/chat/__tests__/dispatcher.test.ts
cd dashboard && pnpm test src/lib/schema-parser.test.ts
pnpm test -- src/gateway/server.chat.gateway-server-chat.test.ts
pnpm test -- src/gateway/server.sessions.gateway-server-sessions-a.test.ts
```

- [ ] **Step 7.5: Commit**

```bash
scripts/committer "Complete deck protocol-driven convergence" \
  dashboard/src/stores/chat-types.ts \
  dashboard/src/stores/chat.ts \
  dashboard/src/components/panels/agents/tabs/AgentConfigTab.tsx \
  dashboard/src/components/panels/agents/tabs/ContextTab.tsx \
  dashboard/src/components/panels/agents/tabs/OverviewTab.tsx \
  dashboard/server/gateway-allowlist.ts
```

---

## Execution Order

1. Chunk 1 — Capability bootstrap + codegen ownership
2. Chunk 2 — Event intake foundation
3. Chunk 3 — Session mainline cutover
4. Chunk 4 — Config server-driven
5. Chunk 5 — Convergence and cleanup

### Hard Gates

- Do **not** start Chunk 3 before Chunk 1 has established capability/bootstrap authority.
- Do **not** collapse `chat.history` into `sessions.preview`; treat transcript read seam explicitly.
- Do **not** declare Config UI “already server-driven” while `ConfigPanel.tsx` still relies on `parseSchemaSection()` as the main field authority.
- Do **not** add `raw` RPC escape hatches as a convenience workaround.

---

## Notes for Implementers

- Prefer deletion over addition when a hardcoded Deck-side protocol copy becomes unnecessary.
- If a change only exists to preserve stale local authority, remove it instead of wrapping it.
- Keep Gateway-facing compatibility seams narrow, named, and documented with exit conditions.
- If a task reveals a missing Gateway primitive (for example, a real replacement for `chat.history`), stop and write that gap down explicitly rather than papering over it with another Deck-owned protocol rule.

---

Plan complete and saved to `docs/plans/2026-04-06-deck-protocol-driven-plan.md`. Ready to execute?
