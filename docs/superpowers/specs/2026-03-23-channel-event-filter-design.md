# Channel Event Filter — Design Spec

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this spec.

**Goal:** 解耦 Gateway 的渠道事件路由和 WS 载荷丰富度控制，让运维可以按 Agent 配置哪些事件类型到达外部消息渠道（WeCom/Telegram），同时 Deck Dashboard 始终接收全量事件。

**Status:** Design approved, Codex R1 reviewed, all findings fixed.

---

## 问题背景

Gateway 当前用 `verboseLevel`（off/on/full）同时控制两件不该耦合的事：

1. **WS 事件载荷丰富度** — tool result 字段是否包含（带宽优化）
2. **渠道事件类型路由** — 哪些 stream 到达 WeCom/Telegram

Deck Dashboard 需要 tool result 来渲染 BashResultView/DiffPreview，但 WeCom 用户只想看最终回答。两者共用同一个 session 级 verboseLevel，无法同时满足。

### 当前架构

```
Agent Event (from Pi Runner)
├── WS Path (always): broadcast() / broadcastToConnIds()
│   ├── Tool events: filtered by verboseLevel (strip result unless "full")
│   ├── Deck: receives full payload via enhanced global broadcast
│   └── macOS/CLI: receives filtered payload via targeted broadcast
│
└── Node/Channel Path (conditional): nodeSendToSession()
    ├── Chat events (SSE type "chat"): always delivered
    ├── Agent events (SSE type "agent"):
    │   ├── stream: "tool" → only when verboseLevel !== "off"
    │   ├── stream: "lifecycle" → always delivered
    │   ├── stream: "assistant" → always delivered
    │   ├── stream: "error" → always delivered
    │   └── other streams (e.g. "thinking") → always delivered
    └── No client-side filtering — channels forward everything they receive
```

**nodeSendToSession 调用点（多处）:**

- `server-chat.ts:515-520` — agent 事件（tool/lifecycle/assistant 等）
- `server-chat.ts:327-339, 398-425` — chat 事件（delta/final）
- `server-methods/chat.ts:551-589` — chat.inject 注入
- `server-methods/chat.ts:1179-1190` — 其他 chat 方法
- `chat-abort.ts:45-70` — abort 事件

### 核心矛盾

1. **verboseLevel 耦合** — 控制 WS 载荷和渠道路由用同一个开关
2. **渠道无过滤** — WeCom/Telegram 收到什么发什么，全链路无过滤层
3. **全局广播 hack** — Enhanced fork 的 Deck 全量广播是临时方案

---

## 设计方案

### 方案选择

**方案 A（选定）: 渠道投递过滤器** — 在 `nodeSendToSession` 函数内部插入过滤层，Per-Agent 配置。

不修改 WS 路径和 verboseLevel 逻辑，纯新增过滤层。

### 架构变更

```
WS 路径（不变）:
  Pi Runner → Gateway broadcast → WS 客户端
  Deck: 全量接收 + BlockFilterBar 渲染控制
  macOS/CLI: 按 verboseLevel 过滤载荷

Node/渠道路径（过滤层在共享出口）:
  所有调用者 → nodeSendToSession() → [Channel Event Filter] → nodeRegistry.sendEvent()
                                          ↑ NEW (函数内部)
                                    检查 agent.channels.eventStreams
                                    过滤不在白名单中的 stream
```

**关键设计决策：过滤层在 `nodeSendToSession` 函数内部**，而非某个调用者前面。这样无论事件从 server-chat.ts、chat.inject、还是 chat-abort 进入，都经过同一个过滤点。

### 事件分类模型

对齐到 Gateway 真实协议类型：

| SSE 事件类型 | Agent Stream                             | eventStreams 白名单值 | 说明                                         |
| ------------ | ---------------------------------------- | --------------------- | -------------------------------------------- |
| `"chat"`     | —                                        | `"chat"`              | 最终文本（delta/final），独立于 agent stream |
| `"agent"`    | `"lifecycle"`                            | `"lifecycle"`         | 运行开始/结束/错误                           |
| `"agent"`    | `"tool"`                                 | `"tool"`              | 工具调用（start/update/result）              |
| `"agent"`    | `"assistant"`                            | `"assistant"`         | LLM 文本输出（agent stream 通道）            |
| `"agent"`    | `"error"`                                | —                     | seq gap 等系统错误，始终通过                 |
| `"agent"`    | 其他（如 enhanced fork 的 `"thinking"`） | `"thinking"`          | 推理过程                                     |

**过滤规则：**

- `"chat"` SSE 事件 → 始终通过（不受 eventStreams 控制）
- `"agent"` SSE 事件 → 检查 `evt.stream` 是否在 eventStreams 白名单中
- `stream: "error"` → 始终通过（系统错误不可过滤）

### 配置 Schema

```yaml
# openclaw.yaml — 使用 agents.list[] 结构（对齐现有配置模式）
agents:
  defaults:
    channels:
      eventStreams: ["lifecycle", "assistant"] # 全局默认

  list:
    - id: main
      channels:
        eventStreams: ["lifecycle"] # 覆盖: 只收生命周期状态

    - id: debug-agent
      channels:
        eventStreams: ["lifecycle", "tool", "assistant", "thinking"] # 调试: 全量
```

**字段定义:**

| 字段                    | 类型       | 默认值                       | 说明                                                                                  |
| ----------------------- | ---------- | ---------------------------- | ------------------------------------------------------------------------------------- |
| `channels.eventStreams` | `string[]` | `["lifecycle", "assistant"]` | 允许到达渠道的 agent event stream 白名单。`"chat"` SSE 事件始终通过，不在此列表中配置 |

**可选值:** `"lifecycle"` `"tool"` `"assistant"` `"thinking"`

> **注意:** `"chat"` 不出现在配置中 — chat SSE 事件（最终文本回复）始终投递到渠道，不可关闭。

**解析优先级:** agent.channels.eventStreams → agents.defaults.channels.eventStreams → `["lifecycle", "assistant"]` 硬编码默认

**默认行为对比（向后兼容性分析）:**

| 事件        | 当前行为（verbose=off） | 新默认行为          | 变化                                |
| ----------- | ----------------------- | ------------------- | ----------------------------------- |
| chat (text) | ✅ 始终通过             | ✅ 始终通过         | 无变化                              |
| lifecycle   | ✅ 始终通过             | ✅ 在白名单中       | 无变化                              |
| assistant   | ✅ 始终通过             | ✅ 在白名单中       | 无变化                              |
| tool        | ❌ verbose=off 时不通过 | ❌ 不在默认白名单   | 无变化                              |
| thinking    | ✅ 始终通过             | ❌ 不在默认白名单   | **Breaking: thinking 不再到达渠道** |
| error       | ✅ 始终通过             | ✅ 系统错误始终通过 | 无变化                              |

**Breaking change:** thinking 事件在新默认值下不再到达渠道。这是有意设计 — 渠道用户通常不需要看推理过程。如需恢复，运维可在 UI 中开启。

**与 verboseLevel 的关系:** 完全独立。verboseLevel 继续控制 WS 侧 tool result 载荷丰富度，eventStreams 控制渠道路由。两者不互相影响。

### Gateway 过滤逻辑

在 `nodeSendToSession` 函数内部插入过滤（`server-node-subscriptions.ts`）：

```typescript
// nodeSendToSession 函数内部 — 共享出口，所有调用者都经过此处
export function nodeSendToSession(sessionKey: string, eventType: string, payload: unknown) {
  // [enhanced] Channel event filter — check agent's eventStreams whitelist
  if (eventType === "agent") {
    const stream = (payload as { stream?: string })?.stream;
    // System errors always pass through
    if (stream && stream !== "error") {
      const allowedStreams = resolveChannelEventStreams(sessionKey);
      if (!allowedStreams.includes(stream)) {
        return; // filtered out
      }
    }
  }
  // "chat" SSE events always pass through — no filtering

  // ... existing delivery logic ...
}
```

`resolveChannelEventStreams` 解析链：

1. 使用 `loadSessionEntry(sessionKey)` 获取 canonicalized session + agentId（避免原始 key 解析不可靠）
2. 查 agent config 的 `channels.eventStreams`
3. 回退到 `agents.defaults.channels.eventStreams`
4. 硬编码默认 `["lifecycle", "assistant"]`

> **重要:** 使用 `loadSessionEntry` 而非直接 parse sessionKey，因为 `parseAgentSessionKey` 在解析失败时静默回落到 `"main"`，会导致 session alias 和 legacy key 被错误归属。

### Deck Dashboard UI

在 Agent 详情页的 Overview Tab 底部新增「渠道事件分发」区域：

**组件结构:**

```
OverviewTab
└── ChannelEventStreamSection (new)
    ├── 标题: "渠道事件分发" + 说明文字
    │   └── "Deck Dashboard 始终接收全量事件。此配置仅影响外部消息渠道。"
    ├── EventStreamToggleList
    │   ├── 最终回复 (chat)  — 始终开启（locked, 不可关闭）
    │   ├── 运行状态 (lifecycle) — 默认开启
    │   ├── 文本输出 (assistant) — 默认开启
    │   ├── 工具调用 (tool) — 默认关闭
    │   └── 推理过程 (thinking) — 默认关闭
    └── ChannelPreviewPanel
        ├── Deck 预览（全量渲染）
        └── 渠道预览（按当前配置过滤后的渲染）
```

**交互:**

- Toggle 切换后调用 `deck.agents.eventStreams.set` RPC
- 渲染预览实时更新，展示 Deck vs 渠道的对比效果
- "最终回复" toggle 不可关闭（锁定状态 + "始终开启" 标签）

### RPC 接口

| 方法                           | 参数                                  | 返回                                             | 说明                       |
| ------------------------------ | ------------------------------------- | ------------------------------------------------ | -------------------------- |
| `deck.agents.eventStreams.get` | `{ agentId }`                         | `{ eventStreams: string[], isDefault: boolean }` | 获取当前配置               |
| `deck.agents.eventStreams.set` | `{ agentId, eventStreams, baseHash }` | `{ ok: true, newHash: string }`                  | 更新配置（带乐观并发控制） |

> `baseHash` 遵循现有 Deck RPC set 方法的 optimistic concurrency 模式（参考 `deck.agents.skills.set` 等）。

---

## 改动清单

| 层                      | 文件                                                          | 改动                                         | 影响            |
| ----------------------- | ------------------------------------------------------------- | -------------------------------------------- | --------------- |
| **Config 类型**         | `src/config/types.agent-defaults.ts`                          | 新增 `channels.eventStreams` 字段            | 纯新增          |
| **Config 类型**         | `src/config/types.agents.ts`                                  | AgentConfig 新增 `channels` 可选字段         | 纯新增          |
| **Zod Schema**          | `src/config/zod-schema.agent-defaults.ts`                     | 新增 channels.eventStreams schema            | strict() 需同步 |
| **Zod Schema**          | `src/config/zod-schema.agent-runtime.ts`                      | 新增 channels.eventStreams schema            | strict() 需同步 |
| **Gateway 过滤**        | `src/gateway/server-node-subscriptions.ts`                    | nodeSendToSession 内部插入 eventStreams 过滤 | 共享出口        |
| **Protocol Schema**     | `src/gateway/protocol/schema/deck.ts`                         | 新增 eventStreams.get/set 参数/响应 schema   | TypeBox         |
| **Protocol Validator**  | `src/gateway/protocol/index.ts`                               | 编译新 schema                                | 1 行            |
| **Method Registration** | `src/gateway/server-methods-list.ts`                          | 注册新方法                                   | 1 行            |
| **Method Scopes**       | `src/gateway/method-scopes.ts`                                | 新增 scope 授权                              | 1 行            |
| **Handler**             | `src/gateway/server-methods/deck/agents.ts`                   | 实现 get/set handler（含 baseHash）          | 新方法          |
| **Dashboard Store**     | `dashboard/src/stores/deck-agents.ts`                         | fetchEventStreams / setEventStreams          | 新 action       |
| **Dashboard API**       | `dashboard/src/app/api/deck/agents/eventStreams/route.ts`     | Deck Server API route                        | 新文件          |
| **Dashboard UI**        | `dashboard/src/components/panels/agents/tabs/OverviewTab.tsx` | 新增「渠道事件分发」区域 + 预览面板          | 新区域          |
| **Dashboard i18n**      | `dashboard/src/i18n/zh.json` + `en.json`                      | 新增 agents.eventStreams.\* keys             | ~15 keys        |
| **Allowlist**           | `dashboard/server/gateway-allowlist.ts`                       | 加入 `deck.agents.eventStreams.*`            | 1 行            |

---

## 自洽闭环验证

| 场景                  | Gateway 发什么        | 客户端收什么                         | 用户看什么                                                  |
| --------------------- | --------------------- | ------------------------------------ | ----------------------------------------------------------- |
| Deck 运维查看工具调用 | 全量（WS 全局广播）   | chat + tool + lifecycle + thinking   | ToolUseCard + RunStatusBar 等，可用 BlockFilterBar 控制显示 |
| WeCom 普通用户        | 按 eventStreams 过滤  | chat + lifecycle + assistant（默认） | "正在处理..." → 最终回复 → "处理完成"                       |
| WeCom 调试模式        | eventStreams = 全量   | chat + 全部 agent streams            | 完整工具日志（运维在 UI 中主动开启）                        |
| macOS App / CLI       | WS 定向（按 verbose） | 不受 eventStreams 影响               | 取决于 verboseLevel                                         |

**自洽性:**

- **Gateway 侧**: eventStreams 控制渠道路由（哪些 agent stream 到达渠道），verboseLevel 控制 WS 载荷（result 字段丰富度）— 两个独立维度
- **客户端侧**: Deck 用 BlockFilterBar 选择渲染，渠道无需客户端过滤（Gateway 已处理）
- **配置层次**: agent 级配置，Dashboard UI 可视化管理，运维一目了然
- **上游解耦**: 不修改 verboseLevel 逻辑，过滤层在 nodeSendToSession 内部纯新增

---

## Codex R1 Review — Findings & Resolutions

| #   | Severity | Finding                                                                          | Resolution                                                                            |
| --- | -------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| F1  | P2       | 过滤插入点错误 — 只在 server-chat.ts 前拦会漏掉 chat.inject/abort 等路径         | **Fixed**: 过滤层下沉到 `nodeSendToSession` 函数内部（共享出口）                      |
| F2  | P2       | 默认值 ["chat","lifecycle"] 与当前行为不一致 — thinking/assistant 当前也到达渠道 | **Fixed**: 默认值改为 ["lifecycle","assistant"]，明确标注 thinking 的 breaking change |
| F3  | P2       | eventStreams 枚举与真实协议不一致 — 实际是 lifecycle/tool/assistant/error        | **Fixed**: 对齐到 AgentEventStream 真实类型，chat 作为独立 SSE 类型始终通过           |
| F4  | P2       | 配置 YAML 形状错误 — 应该是 agents.list[] 而非 agents.\<id\>                     | **Fixed**: YAML 示例改用 agents.list[] 结构，补全 zod schema 文件                     |
| F5  | P2       | sessionKey→agentId 解析不可靠 — 需走 canonicalization                            | **Fixed**: 使用 loadSessionEntry 而非直接 parse                                       |
| F6  | P2       | RPC 接入面不完整 — 缺 protocol schema/validator/scopes/baseHash                  | **Fixed**: 改动清单扩展为 15 项，RPC 补 baseHash 乐观并发                             |

---

## 不在范围内

- Approval 事件 SSE 广播（仍为 Promise-based）
- Subagent 事件实时推送（仍为 REST 轮询）
- Per-channel eventStreams 配置（当前 per-agent 足够）
- verboseLevel 重构/废弃（保持现状）
