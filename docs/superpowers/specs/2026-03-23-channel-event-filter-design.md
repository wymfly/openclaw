# Channel Event Filter — Design Spec

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this spec.

**Goal:** 解耦 Gateway 的渠道事件路由和 WS 载荷丰富度控制，让运维可以按 Agent 配置哪些事件类型到达外部消息渠道（WeCom/Telegram），同时 Deck Dashboard 始终接收全量事件。

**Status:** Design approved, pending implementation.

---

## 问题背景

Gateway 当前用 `verboseLevel`（off/on/full）同时控制两件不该耦合的事：

1. **WS 事件载荷丰富度** — tool result 字段是否包含（带宽优化）
2. **渠道事件类型路由** — 哪些 stream（chat/tool/lifecycle/thinking）到达 WeCom/Telegram

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
    ├── Chat events: always delivered
    ├── Tool events: only when verboseLevel !== "off"
    ├── Lifecycle/Thinking: always delivered (not gated by verbose)
    └── No client-side filtering — channels forward everything they receive
```

### 核心矛盾

1. **verboseLevel 耦合** — 控制 WS 载荷和渠道路由用同一个开关
2. **渠道无过滤** — WeCom/Telegram 收到什么发什么，全链路无过滤层
3. **全局广播 hack** — Enhanced fork 的 Deck 全量广播是临时方案

---

## 设计方案

### 方案选择

**方案 A（选定）: 渠道投递过滤器** — 在 Node/渠道投递路径上插入过滤层，Per-Agent 配置。

不修改 WS 路径和 verboseLevel 逻辑，纯新增过滤层。

### 架构变更

```
WS 路径（不变）:
  Pi Runner → Gateway broadcast → WS 客户端
  Deck: 全量接收 + BlockFilterBar 渲染控制
  macOS/CLI: 按 verboseLevel 过滤载荷

Node/渠道路径（新增过滤层）:
  Pi Runner → Gateway → [Channel Event Filter] → 渠道投递
                              ↑ NEW
                        检查 agent.channels.eventStreams
                        过滤不在白名单中的 stream
```

### 配置 Schema

```yaml
# openclaw.yaml
agents:
  defaults:
    channels:
      eventStreams: ["chat", "lifecycle"] # 全局默认

  main:
    channels:
      eventStreams: ["chat"] # 覆盖: 只收最终文本

  debug-agent:
    channels:
      eventStreams: ["chat", "lifecycle", "tool", "thinking"] # 调试: 全量
```

**字段定义:**

| 字段                    | 类型       | 默认值                  | 说明                             |
| ----------------------- | ---------- | ----------------------- | -------------------------------- |
| `channels.eventStreams` | `string[]` | `["chat", "lifecycle"]` | 允许到达渠道的事件 stream 白名单 |

**可选值:** `"chat"` `"lifecycle"` `"tool"` `"thinking"`

**解析优先级:** agent.channels.eventStreams → agents.defaults.channels.eventStreams → `["chat", "lifecycle"]` 硬编码默认

**与 verboseLevel 的关系:** 完全独立。verboseLevel 继续控制 WS 侧 tool result 载荷丰富度，eventStreams 控制渠道路由。两者不互相影响。

### Gateway 过滤逻辑

在 `server-chat.ts` 的 `nodeSendToSession` 调用前插入检查：

```typescript
// 在 nodeSendToSession 之前
if (sessionKey) {
  const eventStream = evt.stream; // "chat" | "tool" | "lifecycle" | "thinking" | "error"
  const allowedStreams = resolveChannelEventStreams(sessionKey);

  // chat 类型始终通过（SSE type = "chat"，不在 agent stream 分类中）
  const isChatEvent = !eventStream; // chat events don't have stream field

  if (isChatEvent || allowedStreams.includes(eventStream)) {
    nodeSendToSession(sessionKey, ...);
  }
  // else: filtered out, not delivered to channels
}
```

`resolveChannelEventStreams` 解析链：

1. 从 sessionKey 提取 agentId
2. 查 agent config 的 `channels.eventStreams`
3. 回退到 `agents.defaults.channels.eventStreams`
4. 硬编码默认 `["chat", "lifecycle"]`

### Deck Dashboard UI

在 Agent 详情页的 Overview Tab 底部新增「渠道事件分发」区域：

**组件结构:**

```
OverviewTab
└── ChannelEventStreamSection (new)
    ├── 标题: "渠道事件分发" + 说明文字
    ├── EventStreamToggleList
    │   ├── chat     — 始终开启（locked toggle）
    │   ├── lifecycle — 默认开启（可关闭）
    │   ├── tool     — 默认关闭（可开启）
    │   └── thinking — 默认关闭（可开启）
    └── ChannelPreviewPanel
        ├── Deck 预览（全量渲染）
        └── 渠道预览（按当前配置过滤后的渲染）
```

**交互:**

- Toggle 切换后调用 `deck.agents.eventStreams.set` RPC
- 渲染预览实时更新，展示 Deck vs 渠道的对比效果
- chat toggle 不可关闭（锁定状态 + "始终开启" 标签）

### RPC 接口

| 方法                           | 参数                        | 返回                                             | 说明         |
| ------------------------------ | --------------------------- | ------------------------------------------------ | ------------ |
| `deck.agents.eventStreams.get` | `{ agentId }`               | `{ eventStreams: string[], isDefault: boolean }` | 获取当前配置 |
| `deck.agents.eventStreams.set` | `{ agentId, eventStreams }` | `{ ok: true }`                                   | 更新配置     |

---

## 改动清单

| 层              | 文件                      | 改动                                         | 影响      |
| --------------- | ------------------------- | -------------------------------------------- | --------- |
| Config          | `types.agent-defaults.ts` | 新增 `channels.eventStreams` 字段            | 纯新增    |
| Gateway         | `server-chat.ts`          | nodeSendToSession 前检查 eventStreams 白名单 | ~10 行    |
| Gateway RPC     | `deck/agents.ts`          | 新增 `deck.agents.eventStreams.get/set`      | 新方法    |
| Dashboard Store | `deck-agents.ts`          | fetchEventStreams / setEventStreams          | 新 action |
| Dashboard UI    | `OverviewTab.tsx`         | 新增「渠道事件分发」区域 + 预览面板          | 新区域    |
| Dashboard i18n  | `zh.json / en.json`       | 新增 agents.eventStreams.\* keys             | ~15 keys  |
| Allowlist       | `gateway-allowlist.ts`    | 加入 `deck.agents.eventStreams.*`            | 1 行      |

## 自洽闭环验证

| 场景                  | Gateway 发什么        | 客户端收什么                       | 用户看什么                                                  |
| --------------------- | --------------------- | ---------------------------------- | ----------------------------------------------------------- |
| Deck 运维查看工具调用 | 全量（WS 全局广播）   | chat + tool + lifecycle + thinking | ToolUseCard + RunStatusBar 等，可用 BlockFilterBar 控制显示 |
| WeCom 普通用户        | 按 eventStreams 过滤  | chat + lifecycle（默认）           | "正在处理..." → 最终回复 → "处理完成"                       |
| WeCom 调试模式        | eventStreams = 全量   | chat + tool + lifecycle + thinking | 完整工具日志（运维主动开启）                                |
| macOS App / CLI       | WS 定向（按 verbose） | 不受 eventStreams 影响             | 取决于 verboseLevel                                         |

**自洽性:**

- **Gateway 侧**: eventStreams 控制渠道路由，verboseLevel 控制 WS 载荷 — 两个独立维度
- **客户端侧**: Deck 用 BlockFilterBar 选择渲染，渠道无需客户端过滤
- **配置层次**: agent 级配置，Dashboard UI 可视化管理
- **上游解耦**: 不修改 verboseLevel 逻辑，纯新增过滤层

## 不在范围内

- Approval 事件 SSE 广播（仍为 Promise-based）
- Subagent 事件实时推送（仍为 REST 轮询）
- Per-channel eventStreams 配置（当前 per-agent 足够）
- verboseLevel 重构/废弃（保持现状）
