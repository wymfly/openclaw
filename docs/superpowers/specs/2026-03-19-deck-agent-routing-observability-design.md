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
- 按匹配优先级排序（Peer → Peer.Parent → Guild+Roles → Guild → Team → Account → Channel → Default）
- 最后固定 Default 行（不可删除）
- 每行：优先级层级标签、匹配条件摘要、目标 Agent（带头像/emoji）、编辑/删除操作
- 筛选：按渠道、按 Agent
- 底部显示 DM 合并策略（`dmScope`），可点击修改

**右栏 — 路由模拟器：**

- 数据来源：`deck.routing.simulate`
- 输入：渠道 → 账户 → 类型 → ID → Guild/角色（可选）
- 输出：命中 Agent、匹配层级、Session Key、8 层逐层检查结果（命中 ✅ / 跳过 —）
- 8 层 = 7 个绑定层级（peer, peer.parent, guild+roles, guild, team, account, channel）+ default
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
- 子 Agent 模型覆盖（可选，留空则继承全局默认）
- 生效参数只读展示：有效深度限制、有效并发限制（来自全局默认，在 Subagents 面板 Config Tab 修改）
- 当前活跃运行列表（摘要，链接到 Subagents 面板）
- 数据来源：`deck.agents.subagents.get/set`（读写 allowAgents + model）+ `deck.subagents.list({ requesterAgentId })`
- Note: `maxSpawnDepth`、`maxChildrenPerAgent`、`thinking` 是全局配置（`agents.defaults.subagents`），不在此处修改，仅显示有效值

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

### Common Conventions

**ChatType values:** `"direct"` | `"group"` | `"channel"` (Discord 中 `"group"` 和 `"channel"` 等价)

**Binding ID:** 上游 `AgentBinding` 无 `id` 字段（config.bindings 是无 ID 数组）。`deck.*` API 使用**内容哈希**作为合成 ID：`sha256(JSON.stringify(match))` 的前 12 位 hex。该 ID 是确定性的（相同 match 产生相同 ID），用于引用和删除。

**Optimistic Locking:** 所有写入 RPC 接受 `baseHash` 参数并返回新的 `configHash`。`baseHash` 是调用前从最近一次读取（`deck.routing.list` / `deck.agents.skills` 等）获取的 hash 值。若 `baseHash` 与当前 config hash 不一致，返回 `CONFLICT` 错误，前端应重新加载后重试。与现有 `config.patch` 的 `baseHash` 机制一致。

**Error Response:** 所有 `deck.*` RPC 遵循 Gateway 现有错误格式：`{ error: { code: string, message: string } }`。常用 code: `INVALID_REQUEST`, `NOT_FOUND`, `CONFLICT` (baseHash 冲突), `FORBIDDEN`。

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
    id: string,                // 内容哈希合成 ID
    agentId: string,
    agentName?: string,
    match: {
      channel: string,
      accountId?: string,
      peer?: { kind: "direct" | "group" | "channel", id: string },
      guildId?: string,
      roles?: string[],
      teamId?: string,
    },
    tier: "peer" | "peer.parent" | "guild+roles" | "guild"
        | "team" | "account" | "channel",
    comment?: string,
  }>,
  defaultAgentId: string,
  dmScope: string,
  configHash: string,          // 用于后续写入操作的 baseHash
}
```

#### deck.routing.add

```typescript
params: {
  agentId: string,
  match: { channel, accountId?, peer?, guildId?, roles?, teamId? },
  comment?: string,
  baseHash: string,            // optimistic lock
}
returns: {
  ok: boolean,
  binding: { id, agentId, match, tier },
  configHash: string,          // 新 hash
  warnings?: Array<{
    type: "overlap" | "shadow",
    existingBinding: { id, agentId, match },
    message: string,
  }>,
}
```

#### deck.routing.remove

```typescript
params: {
  id: string,                  // 内容哈希 ID
  baseHash: string,
}
returns: {
  ok: boolean,
  removed: { id, agentId, match },
  configHash: string,
  impact?: string,             // e.g. "消息将回退到默认 Agent: main"
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
  peer?: { kind: "direct" | "group" | "channel", id: string },
  guildId?: string,
  teamId?: string,
  memberRoleIds?: string[],
}
returns: {
  agentId: string,
  agentName?: string,
  matchedBy: string,           // "binding.peer" | ... | "default"
  matchedBinding?: { id, agentId, match },
  sessionKey: string,
  tiers: Array<{               // 8 entries (7 binding tiers + default)
    name: "peer" | "peer.parent" | "guild+roles" | "guild"
        | "team" | "account" | "channel" | "default",
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
  // skillMode="all" → all registered skill keys; "whitelist" → assigned subset only
  // Includes ineligible skills (marked via available[].eligible in deck.agents.skills)
  effectiveSkills: string[],
  totalAvailableSkills: number,
  subagents: {
    // Per-agent fields (from AgentConfig.subagents)
    allowAgents: string[] | ["*"],
    model?: string,
    // Effective values (per-agent override ?? global default)
    effectiveMaxSpawnDepth: number,
    effectiveMaxChildrenPerAgent: number,
  },
}
```

#### deck.agents.skills.get / deck.agents.skills.set

拆分为两个方法，避免条件必填参数歧义。

```typescript
// deck.agents.skills.get
params: { agentId: string }
returns: {
  agentId: string,
  mode: "all" | "whitelist",
  skills: string[],
  available: Array<{
    key: string,
    name: string,
    eligible: boolean,         // 运行时资格（平台/依赖）
    assigned: boolean,         // 是否在白名单中
  }>,
  configHash: string,
}

// deck.agents.skills.set
params: {
  agentId: string,
  mode: "all" | "whitelist",
  skills: string[],            // mode="whitelist" 时的白名单; mode="all" 时忽略
  baseHash: string,
}
returns: {
  ok: boolean,
  agentId: string,
  mode: "all" | "whitelist",
  skills: string[],
  configHash: string,
}
```

#### deck.agents.subagents.get / deck.agents.subagents.set

Per-agent `subagents` config 仅包含 `allowAgents` 和 `model`（与上游 `AgentConfig.subagents` 类型对齐）。`maxSpawnDepth`、`maxChildrenPerAgent`、`thinking` 仅存在于全局默认级别（`agents.defaults.subagents`），在 Subagents 面板 Config Tab 中管理。

```typescript
// deck.agents.subagents.get
params: { agentId: string }
returns: {
  agentId: string,
  // Per-agent config
  allowAgents: string[],       // 空=不允许, ["*"]=任意
  allowAny: boolean,
  model?: string,              // per-agent 子 Agent 模型覆盖
  // Effective values (per-agent ?? global defaults, read-only)
  effectiveMaxSpawnDepth: number,
  effectiveMaxChildrenPerAgent: number,
  effectiveThinking?: string,
  // Agent lists for UI rendering
  allowedAgents: Array<{ id: string, name?: string }>,
  allAgents: Array<{ id: string, name?: string }>,
  configHash: string,
}

// deck.agents.subagents.set
params: {
  agentId: string,
  allowAgents: string[],       // 空=不允许, ["*"]=任意
  model?: string | null,       // null=清除覆盖,继承默认
  baseHash: string,
}
returns: {
  ok: boolean,
  agentId: string,
  allowAgents: string[],
  model?: string,
  configHash: string,
}
```

### deck.subagents.\* (3 methods)

**History limitation:** Subagent runs are stored in-memory (`subagentRuns` Map) and swept after completion (default `archiveAfterMinutes: 60`). `deck.subagents.list` with `status: "all"` only returns runs still in memory or on-disk (not yet swept). There is no long-term history store. The History tab should display an appropriate empty state: "仅显示最近 N 小时内的运行记录". Long-term history persistence (append-only log) is deferred to a future iteration.

#### deck.subagents.list

```typescript
params: {
  status?: "active" | "completed" | "failed" | "all",
  agentId?: string,            // filter by child agent ID
  requesterAgentId?: string,   // filter by parent agent ID
  limit?: number,              // default 50
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
  }>,
  total: number,
}
```

Note: `tokenUsage` removed from response — `SubagentRunRecord` has no token tracking. Token data per session can be obtained from `sessions.usage` if needed, but is not aggregated here.

#### deck.subagents.kill

```typescript
params: { runId: string }
returns: { ok: boolean, runId: string, childSessionKey: string }
```

#### deck.subagents.lineage

**Traversal algorithm:** Given a `runId` or `sessionKey`, walk **upward** via `requesterSessionKey` chain to find the root (non-subagent session). Then walk **downward** from root, collecting all runs whose `requesterSessionKey` matches any node in the tree. Returns the complete tree.

**`parentRunId` reconstruction:** For each node, find the run whose `childSessionKey` matches this node's `requesterSessionKey`. This is an O(N) scan of the runs Map per node; acceptable for typical tree depths (≤3).

```typescript
params: {
  runId?: string,              // either runId or sessionKey required
  sessionKey?: string,
}
returns: {
  root: {
    sessionKey: string,        // top-level non-subagent session
    agentId: string,
    agentName?: string,
  },
  nodes: Array<{
    runId: string,
    sessionKey: string,
    agentId: string,
    agentName?: string,
    task: string,
    depth: number,
    parentRunId?: string,      // null for direct children of root
    status: "active" | "completed" | "failed" | "timeout",
    durationMs?: number,
  }>,
}
```

### deck.identity.\* (3 methods)

**Data model mapping:** Upstream config stores identity links as `Record<string, string[]>` where keys are canonical names and values are `"channel:peerId"` strings (e.g. `{ alice: ["telegram:123", "discord:456"] }`). The `deck.identity.*` API presents a structured view, splitting `"telegram:123"` into `{ channel: "telegram", peerId: "123" }`. Implementation must join/split the `channel:peerId` format.

#### deck.identity.list

```typescript
params: {}
returns: {
  links: Array<{
    canonical: string,
    peers: Array<{ channel: string, peerId: string }>,
  }>,
  configHash: string,
}
```

#### deck.identity.link

```typescript
params: {
  canonical: string,
  channel: string,
  peerId: string,
  baseHash: string,
}
returns: { ok: boolean, configHash: string }
// Implementation: appends "channel:peerId" to config.session.identityLinks[canonical]
```

#### deck.identity.unlink

```typescript
params: {
  canonical: string,
  channel: string,
  peerId: string,
  baseHash: string,
}
returns: { ok: boolean, configHash: string }
// Implementation: removes "channel:peerId" from config.session.identityLinks[canonical]
```

### deck.threads.list (1 method)

**Scope:** Initially covers Discord thread bindings only (the primary channel with thread binding support). Thread binding persistence is channel-specific (`~/.openclaw/agents/<agentId>/sessions/thread-bindings-<accountId>.json`). Other channels may be added in future iterations.

```typescript
params: {
  agentId?: string,
  channel?: string,            // currently only "discord" has data
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

| Method                      | R/W | Backend Implementation                                |
| --------------------------- | --- | ----------------------------------------------------- |
| `deck.routing.list`         | R   | Read config.bindings + compute tier + content-hash ID |
| `deck.routing.add`          | W   | Atomic config.bindings mutation + baseHash lock       |
| `deck.routing.remove`       | W   | Match by content-hash ID + baseHash lock              |
| `deck.routing.validate`     | R   | Call existing match logic + conflict detection        |
| `deck.routing.simulate`     | R   | Call resolveAgentRoute() + wrap 8-tier details        |
| `deck.agents.detail`        | R   | Aggregate agent config + bindings + sessions + skills |
| `deck.agents.skills.get`    | R   | Read agent.skills + build available list              |
| `deck.agents.skills.set`    | W   | Write agent.skills field + baseHash lock              |
| `deck.agents.subagents.get` | R   | Read agent.subagents + resolve effective defaults     |
| `deck.agents.subagents.set` | W   | Write agent.subagents (allowAgents + model only)      |
| `deck.subagents.list`       | R   | Read subagentRuns Map (in-memory + disk)              |
| `deck.subagents.kill`       | W   | Call existing termination logic                       |
| `deck.subagents.lineage`    | R   | Walk up to root, then collect full tree               |
| `deck.identity.list`        | R   | Read config.identityLinks + split channel:peerId      |
| `deck.identity.link`        | W   | Append to config.identityLinks + baseHash lock        |
| `deck.identity.unlink`      | W   | Remove from config.identityLinks + baseHash lock      |
| `deck.threads.list`         | R   | Read Discord thread-bindings persistence files        |

**Total: 17 RPC methods (9 read, 8 write)** — split `skills` and `subagents` into get/set adds 2

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
| Subagent active runs | Polling (visibility-gated)      | 5s       |
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
- Subagent polling uses `setInterval` with cleanup on panel unmount; must pause when `document.hidden` is true (via `visibilitychange` event) to avoid unnecessary requests when tab is inactive
- Binding content-hash ID: `sha256(JSON.stringify(normalizedMatch)).slice(0, 12)` — deterministic, collision-resistant for typical binding counts
- `deck.agents.subagents.set` only writes `allowAgents` and `model` to per-agent config; global limits (`maxSpawnDepth`, `maxChildrenPerAgent`, `thinking`) are managed via `config.patch` on `agents.defaults.subagents`
- Subagent history is ephemeral (in-memory + disk sweep); History tab must show "仅显示最近记录" empty state; long-term append-only log deferred to future
- `deck.threads.list` initially only returns Discord thread bindings; expandable per-channel as other channels add thread support
