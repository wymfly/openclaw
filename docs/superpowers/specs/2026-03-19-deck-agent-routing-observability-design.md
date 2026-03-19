# Deck Agent Routing & Observability Design

**Date:** 2026-03-19
**Status:** Draft
**Scope:** openclaw-deck Web Dashboard — Agent 路由可视化、Subagent 监控、Skill 分配

## Problem

OpenClaw 的核心运行机制（7 层路由优先级、Subagent spawn/lifecycle、per-agent Skill 白名单）完全隐藏在 `config.yaml` 和运行时内存中。非专业运维和用户无法理解消息如何路由到 Agent、子任务如何编排、Skill 如何分配。现有 Dashboard 仅有 Agent 基础 CRUD，无法配置和观测这些关键对象。

## Decisions

| 决策     | 选择                                                | 理由                               |
| -------- | --------------------------------------------------- | ---------------------------------- |
| 目标用户 | 运维 + 管理员兼顾                                   | 配置和监控同等重要                 |
| 页面策略 | 混合（增强现有 + 新增面板）                         | 配置嵌入 Agent 详情，监控独立面板  |
| API 策略 | 新增专用 RPC                                        | 后端负责验证和一致性，前端调用简单 |
| API 命名 | `deck.*` 统一前缀                                   | 与上游解耦，产品辨识度高           |
| UI 实施  | 设计文档定义信息架构和 API，视觉实施时使用 UI skill | 分离关注点                         |

## Navigation Changes

现有 4 组 19 面板，变更如下：

```
CORE
  ├── Chat
  ├── Agents          ← 增强：基础列表 → Master-Detail 详情页（5 Tab）
  ├── Routing         ← 新增：路由规则总表 + 模拟器
  ├── Gateway
  └── Models

OBSERVE
  ├── Subagents       ← 新增：运行监控 + 谱系 + 历史
  ├── Usage
  ├── Sessions        ← 增强：增加 subagent 类型标识和谱系链接
  ├── Memory
  ├── Logs
  └── Activity

AUTOMATE（不变）

CONTROL
  ├── Budget
  ├── Alerts
  ├── Channels        ← 增强：增加 Agent 绑定视图 Tab
  ├── Config
  ├── Docs
  ├── Skills          ← 增强：增加 Agent 分配矩阵 Tab
  └── Settings
```

**变更统计：** +2 新面板，4 面板增强，其余不变。

### Cross-Panel Navigation

面板间关联跳转链路：

- **Routing** → 点击 agentId → Agents 详情；点击 channel → Channels
- **Agents 详情** → 绑定 Tab → Routing（预填 agentId）；Subagent Tab 活跃运行 → Subagents 面板；会话 Tab → Sessions
- **Subagents** → 点击父/子 session → Sessions；点击 agentId → Agents 详情
- **Sessions** → subagent 类型 session → Subagents
- **Channels** → Agent 绑定 → 点击 agentId → Agents 详情；点击规则 → Routing
- **Skills 矩阵** → 点击 Agent 列头 → Agents 详情

---

## Page Designs

### 1. Routing Panel (New)

**位置：** CORE 组，Agents 和 Gateway 之间

**布局：** 左右双栏（桌面），上下堆叠（平板/移动）

**左栏 — 路由规则表：**

- 数据来源：`deck.routing.list`
- 按匹配优先级排序（Peer → Guild+Roles → Guild → Team → Account → Channel → Default）
- 最后固定 Default 行（不可删除）
- 每行：优先级层级标签、匹配条件摘要、目标 Agent（带头像/emoji）、编辑/删除操作
- 筛选：按渠道、按 Agent
- 底部显示 DM 合并策略（`dmScope`），可点击修改

**右栏 — 路由模拟器：**

- 数据来源：`deck.routing.simulate`
- 输入：渠道 → 账户 → 类型 → ID → Guild/角色（可选）
- 输出：命中 Agent、匹配层级、Session Key、7 层逐层检查结果（命中 ✅ / 跳过 —）
- 渠道选择后动态显示该渠道特有字段

**添加/编辑绑定 Dialog：**

- 目标 Agent（Select）
- 匹配条件：渠道（必填）→ 账户 → 对话类型/ID → Discord Guild/Roles → Slack Team
- 渠道选择后动态显示特有字段
- 填写过程实时调用 `deck.routing.validate` 检测冲突
- 验证结果区显示：预测层级、冲突警告、覆盖提示

**响应式：**

- ≥1280px：左右双栏
- <1280px：上下堆叠，模拟器折叠在下方（Collapsible）

---

### 2. Agents Panel (Enhanced)

**布局：** Master-Detail（左列表 + 右详情）

**左侧 Agent 列表：**

- 显示 Agent emoji/名称、默认标识
- 选中态高亮

**右侧 5 个 Tab：**

#### Tab 1: Overview

- 基本信息卡片（ID、名称、工作目录、模型、是否默认）
- 统计卡片横排：路由规则数、Skills 分配数、可召唤 Agent 数、活跃会话数、活跃子任务数
- 卡片可点击跳转对应 Tab 或面板

#### Tab 2: Routing

- 该 Agent 的绑定规则子集（过滤自 `deck.routing.list({ agentId })`）
- 添加/编辑绑定复用共享 BindingDialog（预填 agentId）
- 未绑定时的路由行为说明

#### Tab 3: Skills

- 分配模式切换：全部 Skill（不限制）/ 自定义白名单
- 白名单模式下展示 Skill 列表，支持勾选分配
- 每个 Skill 旁显示运行时资格状态（就绪/依赖缺失/平台不兼容）
- 数据来源：`deck.agents.skills`（读写）+ `skills.status({ agentId })`（运行时状态）

#### Tab 4: Subagent

- 召唤权限三选一：不允许 / 指定 Agent / 任意 Agent (\*)
- 允许的 Agent 勾选列表
- 限制参数：最大嵌套深度、最大并发、子 Agent 模型、思考级别
- 当前活跃运行列表（摘要，链接到 Subagents 面板）
- 数据来源：`deck.agents.subagents`（读写）+ `deck.subagents.list({ requesterAgentId })`

#### Tab 5: Sessions

- 该 Agent 名下会话列表（过滤自 `sessions.list({ agentId })`）
- 类型筛选：DM / 群组 / 频道 / Subagent
- Subagent 类型显示 depth 和父 Agent 链接

**响应式：**

- 桌面：左列表 240px + 右详情自适应
- 平板：列表折叠为图标
- 移动：列表和详情分页

---

### 3. Subagents Panel (New)

**位置：** OBSERVE 组

**3 个 Tab：**

#### Tab 1: Active Runs

- 运行卡片列表：按树形嵌套显示父子关系
- 每张卡片：Agent 标识、任务描述、深度、模型、耗时（实时更新）、Token 用量
- 操作：查看会话（跳转 Sessions）、终止（二次确认）
- 下方谱系图：树状拓扑，状态图标（🔄运行中 ✅完成 ❌失败 ⏱️超时）
- 数据来源：`deck.subagents.list({ status: "active" })`，轮询 5s

#### Tab 2: History

- 表格：状态、子Agent、父Agent、任务、耗时、Token
- 点击行展开详情（完整任务描述、outcome、错误信息）
- 失败行红色高亮
- 筛选：时间范围、Agent、状态
- 分页加载
- 数据来源：`deck.subagents.list({ status: "all" })`

#### Tab 3: Config

- 全局默认限制表单（maxSpawnDepth、maxChildren、maxConcurrent、archiveAfterMinutes、默认模型、默认思考级别）
- 各 Agent 权限矩阵表格（Agent / 可召唤 / 深度 / 并发 / 子模型）
- 行可点击跳转到 Agent 详情的 Subagent Tab

---

### 4. Sessions Panel (Enhanced)

**改动 1：** 列表新增"类型"列

- DM (📱) / 群组 (👥) / 频道 (💬) / Subagent (🔗)
- Subagent 类型额外显示 depth 和父 Agent
- 新增按类型筛选

**改动 2：** Session 详情页增加谱系区块

- Subagent 类型 Session 在消息历史上方显示调用链路
- 链接到 Subagents 面板查看完整谱系
- 数据来源：`deck.subagents.lineage({ sessionKey })`

---

### 5. Skills Panel (Enhanced)

新增 Tab "Agent 分配矩阵"：

- Agent × Skill 交叉表
- 三种状态：🔵 全部（无白名单）/ ✅ 白名单中 / ❌ 不在白名单
- 🔵 状态 Agent 不可在矩阵中点击，需到 Agent 详情切换模式
- ✅/❌ 可直接点击切换并保存
- Agent 列头、Skill 行名可点击跳转

---

### 6. Channels Panel (Enhanced)

新增 Tab "Agent 绑定"：

- 渠道+账户选择器
- 频道/群组 → Agent 映射表（匹配方式标签、解绑操作）
- 绑定新频道复用共享 BindingDialog（预填 channel + accountId）
- DM 策略摘要（安全策略、合并模式、已配对用户数）

---

## API Design: `deck.*` RPC

所有方法注册在 `src/gateway/server-methods/deck/` 目录下。

### deck.routing.\* (5 methods)

#### deck.routing.list

```typescript
params: {
  agentId?: string,
  channel?: string,
  accountId?: string,
}
returns: {
  bindings: Array<{
    id: string,
    agentId: string,
    agentName?: string,
    match: {
      channel: string,
      accountId?: string,
      peer?: { kind: ChatType, id: string },
      guildId?: string,
      roles?: string[],
      teamId?: string,
    },
    tier: "peer" | "guild+roles" | "guild" | "team" | "account" | "channel",
    comment?: string,
  }>,
  defaultAgentId: string,
  dmScope: string,
}
```

#### deck.routing.add

```typescript
params: {
  agentId: string,
  match: { channel, accountId?, peer?, guildId?, roles?, teamId? },
  comment?: string,
}
returns: {
  ok: boolean,
  binding: { id, agentId, match, tier },
  warnings?: Array<{
    type: "overlap" | "shadow",
    existingBinding: { id, agentId, match },
    message: string,
  }>,
}
```

#### deck.routing.remove

```typescript
params: { id: string }
returns: {
  ok: boolean,
  removed: { id, agentId, match },
  impact?: string,
}
```

#### deck.routing.validate

```typescript
params: {
  agentId: string,
  match: { channel, accountId?, peer?, guildId?, roles?, teamId? },
}
returns: {
  ok: boolean,
  tier: string,
  conflicts: Array<{
    type: "duplicate" | "overlap" | "shadow",
    existingBinding: { id, agentId, match },
    message: string,
  }>,
}
```

#### deck.routing.simulate

```typescript
params: {
  channel: string,
  accountId?: string,
  peer?: { kind: ChatType, id: string },
  guildId?: string,
  teamId?: string,
  memberRoleIds?: string[],
}
returns: {
  agentId: string,
  agentName?: string,
  matchedBy: string,
  matchedBinding?: { id, agentId, match },
  sessionKey: string,
  tiers: Array<{
    name: string,
    checked: boolean,
    matched: boolean,
    candidateCount: number,
  }>,
}
```

### deck.agents.\* (3 methods)

#### deck.agents.detail

```typescript
params: { agentId: string }
returns: {
  id: string,
  name?: string,
  workspace: string,
  model?: AgentModelConfig,
  isDefault: boolean,
  bindingCount: number,
  sessionCount: number,
  activeSubagentCount: number,
  skillMode: "all" | "whitelist",
  effectiveSkills: string[],
  totalAvailableSkills: number,
  subagents: {
    allowAgents: string[] | ["*"],
    model?: string,
    thinking?: string,
    maxSpawnDepth?: number,
    maxChildrenPerAgent?: number,
  },
}
```

#### deck.agents.skills

```typescript
params: {
  agentId: string,
  action: "get" | "set",
  mode?: "all" | "whitelist",
  skills?: string[],
}
returns: {
  agentId: string,
  mode: "all" | "whitelist",
  skills: string[],
  available: Array<{
    key: string,
    name: string,
    eligible: boolean,
    assigned: boolean,
  }>,
}
```

#### deck.agents.subagents

```typescript
params: {
  agentId: string,
  action: "get" | "set",
  allowAgents?: string[],
  model?: string | null,
  thinking?: string | null,
  maxSpawnDepth?: number | null,
  maxChildrenPerAgent?: number | null,
}
returns: {
  agentId: string,
  allowAgents: string[],
  allowAny: boolean,
  model?: string,
  thinking?: string,
  maxSpawnDepth: number,
  maxChildrenPerAgent: number,
  allowedAgents: Array<{ id: string, name?: string }>,
  allAgents: Array<{ id: string, name?: string }>,
}
```

### deck.subagents.\* (3 methods)

#### deck.subagents.list

```typescript
params: {
  status?: "active" | "completed" | "failed" | "all",
  agentId?: string,
  requesterAgentId?: string,
  limit?: number,
  offset?: number,
}
returns: {
  runs: Array<{
    runId: string,
    childSessionKey: string,
    childAgentId: string,
    childAgentName?: string,
    requesterSessionKey: string,
    requesterAgentId: string,
    requesterAgentName?: string,
    task: string,
    label?: string,
    model?: string,
    spawnMode: "run" | "session",
    depth: number,
    createdAt: number,
    startedAt?: number,
    endedAt?: number,
    durationMs?: number,
    status: "active" | "completed" | "failed" | "timeout",
    outcome?: { status: string, error?: string },
    tokenUsage?: { input: number, output: number },
  }>,
  total: number,
}
```

#### deck.subagents.kill

```typescript
params: { runId: string }
returns: { ok: boolean, runId: string, childSessionKey: string }
```

#### deck.subagents.lineage

```typescript
params: { runId?: string, sessionKey?: string }
returns: {
  root: { sessionKey: string, agentId: string, agentName?: string },
  nodes: Array<{
    runId: string,
    sessionKey: string,
    agentId: string,
    agentName?: string,
    task: string,
    depth: number,
    parentRunId?: string,
    status: "active" | "completed" | "failed" | "timeout",
    durationMs?: number,
    tokenUsage?: { input: number, output: number },
  }>,
}
```

### deck.identity.\* (3 methods)

#### deck.identity.list

```typescript
params: {}
returns: {
  links: Array<{
    canonical: string,
    peers: Array<{ channel: string, peerId: string }>,
  }>,
}
```

#### deck.identity.link

```typescript
params: { canonical: string, channel: string, peerId: string }
returns: { ok: boolean }
```

#### deck.identity.unlink

```typescript
params: { canonical: string, channel: string, peerId: string }
returns: { ok: boolean }
```

### deck.threads.list (1 method)

```typescript
params: {
  agentId?: string,
  channel?: string,
  status?: "active" | "all",
}
returns: {
  threads: Array<{
    channelId: string,
    threadId: string,
    channel: string,
    accountId: string,
    agentId: string,
    targetSessionKey: string,
    targetKind: "subagent" | "acp",
    boundBy: string,
    boundAt: number,
    lastActivityAt: number,
    idleTimeoutMs?: number,
  }>,
}
```

### API Summary

| Method                   | R/W | Backend Implementation                                |
| ------------------------ | --- | ----------------------------------------------------- |
| `deck.routing.list`      | R   | Read config.bindings + compute tier                   |
| `deck.routing.add`       | W   | Atomic config.bindings mutation + baseHash lock       |
| `deck.routing.remove`    | W   | Same                                                  |
| `deck.routing.validate`  | R   | Call existing match logic + conflict detection        |
| `deck.routing.simulate`  | R   | Call resolveAgentRoute() + wrap tier details          |
| `deck.agents.detail`     | R   | Aggregate agent config + bindings + sessions + skills |
| `deck.agents.skills`     | R/W | Read/write agent.skills field                         |
| `deck.agents.subagents`  | R/W | Read/write agent.subagents field                      |
| `deck.subagents.list`    | R   | Read subagentRuns Map + history                       |
| `deck.subagents.kill`    | W   | Call existing termination logic                       |
| `deck.subagents.lineage` | R   | Recursive spawnedBy chain query                       |
| `deck.identity.list`     | R   | Read config.identityLinks                             |
| `deck.identity.link`     | W   | Modify config.identityLinks                           |
| `deck.identity.unlink`   | W   | Same                                                  |
| `deck.threads.list`      | R   | Read thread-bindings persistence files                |

**Total: 15 RPC methods (9 read, 6 write)**

---

## Frontend Architecture

### New Zustand Stores (3)

```
stores/
  ├── deck-routing.ts      # deck.routing.* — bindings, simulation
  ├── deck-subagents.ts    # deck.subagents.* — active runs, history, lineage, polling
  └── deck-agents.ts       # deck.agents.* — agent detail, skills, subagent config
```

Existing `agents.ts` store remains for upstream CRUD (`agents.list/create/delete`). New `deck-agents.ts` handles enhanced detail. Linked by agentId, not merged.

### Shared Components (6)

```
components/shared/
  ├── BindingDialog.tsx        # Binding add/edit — reused by Routing, Agents, Channels
  ├── AgentBadge.tsx           # Agent identity display — reused everywhere
  ├── TierBadge.tsx            # Priority tier label — reused by Routing, Channels
  ├── LineageTree.tsx           # Lineage tree (pure CSS) — reused by Subagents, Sessions
  ├── SubagentRunCard.tsx      # Run card — reused by Subagents, Agents
  └── SessionKeyDisplay.tsx    # Session key formatter — reused by Routing, Sessions, Subagents
```

### Panel File Organization

```
components/panels/
  ├── routing/                    # New
  │   ├── RoutingPanel.tsx
  │   ├── BindingTable.tsx
  │   └── RouteSimulator.tsx
  ├── subagents/                  # New
  │   ├── SubagentsPanel.tsx
  │   ├── ActiveRunsTab.tsx
  │   ├── HistoryTab.tsx
  │   └── ConfigTab.tsx
  ├── agents/                     # Enhanced
  │   ├── AgentsPanel.tsx         # → Master-Detail
  │   ├── AgentList.tsx
  │   ├── AgentDetail.tsx
  │   └── tabs/
  │       ├── OverviewTab.tsx
  │       ├── RoutingTab.tsx
  │       ├── SkillsTab.tsx
  │       ├── SubagentTab.tsx
  │       └── SessionsTab.tsx
  ├── skills/                     # Enhanced
  │   ├── SkillsPanel.tsx
  │   ├── SkillListTab.tsx
  │   └── SkillMatrixTab.tsx
  ├── channels/                   # Enhanced
  │   ├── ChannelsPanel.tsx
  │   ├── StatusTab.tsx
  │   └── BindingsTab.tsx
  └── sessions/                   # Enhanced
      ├── SessionsPanel.tsx
      └── SessionDetail.tsx
```

### Data Refresh Strategy

| Data                 | Strategy                        | Interval |
| -------------------- | ------------------------------- | -------- |
| Binding rules        | Refresh after mutation          | —        |
| Agent detail         | Load on enter, cache 60s        | —        |
| Subagent active runs | Polling                         | 5s       |
| Subagent history     | Refresh after mutation + manual | —        |
| Skill matrix         | Load on enter Tab               | —        |
| Route simulation     | On user click "Simulate"        | —        |
| Session list         | Existing strategy unchanged     | —        |

### i18n

New keys added to `messages/zh-CN.json` and `messages/en.json` under `routing.*`, `subagents.*`, and enhanced panel namespaces. Follow existing `next-intl` patterns.

---

## Backend File Organization

```
src/gateway/server-methods/deck/
  ├── routing.ts        # deck.routing.* (5 methods)
  ├── agents.ts         # deck.agents.* (3 methods)
  ├── subagents.ts      # deck.subagents.* (3 methods)
  ├── identity.ts       # deck.identity.* (3 methods)
  ├── threads.ts        # deck.threads.* (1 method)
  └── index.ts          # Unified registration
```

Entire `deck/` directory is isolated from upstream — zero rebase conflict.

---

## Implementation Notes

- Visual design and interaction polish to be handled during implementation using UI-specific skills (frontend-design, ui-ux-pro-max)
- `LineageTree` component uses pure CSS flexbox tree rendering — no D3/vis.js dependency
- `BindingDialog` is the most critical shared component; accepts `prefill` prop for context-specific pre-population
- All write RPCs use baseHash optimistic locking (consistent with existing `config.patch` pattern)
- Subagent polling uses `setInterval` with cleanup on panel unmount; consider SSE upgrade in future
