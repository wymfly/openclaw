## Context

openclaw-deck 的 Activity 面板是一个扁平事件时间线：Zustand store 缓存 200 条 `ActivityEvent`，SSE 实时推送 `activity.event`，EventBus 维持 100 条 replay buffer。事件结构简单（id, timestamp, type, agentId, description, details），无 runId 关联、无持久化、无聚合统计。

Gateway 面板包含 3 个诊断卡片（ConnectionCard, HealthCard, HeartbeatCard），本质是运行时可观测性信息，与"Gateway 配置"无关。

现有基础设施：

- `dashboard/server/projection-store.ts`：outbox + settings 的 SQLite 持久化，提供 `appendEvent`/`getEventsSince`/`pruneEvents` API
- `dashboard/server/event-bus.ts`：typed pub/sub，100 条 ring buffer，支持 `getEventsSince` replay
- `dashboard/server/db.ts`：WAL-mode better-sqlite3，编号 SQL migration（当前到 006）
- `dashboard/src/stores/activity.ts`：200 条上限，按 timestamp 排序，agent/type 过滤

## Goals / Non-Goals

**Goals:**

- 将事件按 runId 关联持久化到 SQLite，支持跨重启的历史查询
- 提供单次运行的结构化视图：工具调用时间线、文件变更、token 统计
- 统一 Gateway 诊断和 Activity 事件为 "Monitor" 面板
- 保持与上游 zero-diff（所有改动在 `dashboard/` 内）

**Non-Goals:**

- 不修改 Gateway 端的事件产生逻辑（仅消费现有 SSE 事件）
- 不实现分布式 tracing（APM）或 span-level 追踪
- 不实现 Gateway 端的事件持久化（持久化在 Deck Server 端）
- 不修改 Chat 面板（属于 session-scoped-state 提案范畴）
- 不引入新的外部依赖（图表库等）

## Decisions

### D1: 持久化层 — 独立 RunEventStore（而非扩展 ProjectionStore）

**选择：** 新建 `dashboard/server/run-event-store.ts`，独立管理 `run_events` 表。

**备选方案：**

- 扩展 `ProjectionStore` 添加 run_events 逻辑 → 违反 SRP，ProjectionStore 职责是 outbox + settings
- 复用 outbox 表添加 runId 列 → 污染现有 outbox 语义，且 outbox 的 pruneEvents 周期与 run_events 的 7 天保留不同

**理由：** RunEventStore 有独立的表结构、保留策略和查询模式。独立类避免修改现有 ProjectionStore 的接口和行为。共享同一个 `getDb()` 连接，零额外开销。

### D2: 表结构 — 面向查询的反规范化

**选择：** `run_events` 表包含冗余的 `agent_id`、`session_key` 列（虽然 run 内的所有事件共享同一 agent/session）。

```sql
CREATE TABLE IF NOT EXISTS run_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  stream TEXT NOT NULL,          -- 'tool_call' | 'model' | 'file_op' | 'subagent' | 'compaction' | 'system'
  data TEXT NOT NULL,            -- JSON payload
  agent_id TEXT,
  session_key TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(run_id, seq)
);

CREATE INDEX idx_run_events_run_id ON run_events(run_id);
CREATE INDEX idx_run_events_agent_ts ON run_events(agent_id, created_at);
CREATE INDEX idx_run_events_session ON run_events(session_key, created_at);
```

**理由：** 查询场景需要按 agent_id、session_key、时间范围过滤 run 列表，如果这些字段只存在于 run 的第一条事件中，每次列表查询都需要 self-join。反规范化让单表查询即可满足所有过滤需求。

### D3: 写入管线 — EventBus 订阅 + 批量插入

**选择：** 在 Deck Server 启动时订阅 EventBus，将 `chat`（含 runId 的 delta/final/error 事件）和 `agent`（tool 调用、model 调用）事件转换为 `run_events` 行，使用 SQLite transaction 批量插入（每 500ms 或累积 50 条时 flush）。

**备选方案：**

- 同步逐条写入 → 高频事件时 SQLite 写入成为瓶颈
- 异步队列 + Worker → 过度工程，Deck 是单实例

**理由：** 批量插入利用 SQLite transaction 的原子性和 WAL 模式的并发读优势。500ms 窗口在实时性和写入效率之间取得平衡。50 条上限防止高 burst 场景下内存膨胀。

### D4: 事件流分类 — 6 个 stream 类型

**选择：** `stream` 字段使用 6 个固定值：`tool_call`、`model`、`file_op`、`subagent`、`compaction`、`system`。

**理由：** 与现有 `ActivityEventType`（tool_call, chat, status, agent, system）部分重叠但语义不同。Activity 是"发生了什么事"，run_events 是"这次运行中发生了什么"。分类面向 Monitor 的视图需求：timeline 需要 tool_call + model 的时间区间，waterfall 需要 tool_call 的层级，file summary 需要 file_op，subagent tree 需要 subagent，compaction 标记需要 compaction。

### D5: API 路由 — Next.js Route Handler

**选择：** 新增 3 个 API 路由：

- `GET /api/monitor/runs` — 运行列表（分页、过滤）
- `GET /api/monitor/runs/[runId]` — 单次运行的全部事件
- `GET /api/monitor/stats` — 概览统计（总运行数、今日运行数、平均耗时等）

**备选方案：** 走 Gateway RPC（`deck.monitor.*`）→ 需要在 Gateway 端实现逻辑或代理，且 run_events 表在 Deck Server 本地。

**理由：** 持久化层在 Deck Server 端，直接用 Next.js route handler 查询本地 SQLite 最简单高效。无需 Gateway 参与。

### D6: Panel 重命名策略 — 类型替换 + 向后兼容

**选择：** `Panel` 联合类型中 `activity` → `monitor`，`gateway` 从联合类型中移除。URL hash 和 localStorage 中的旧值通过启动时的 migration 函数转换。

**备选方案：** 保留 `activity` 和 `gateway` 作为别名 → 增加长期维护负担

**理由：** Clean break。用户量极小（Deck 是运维工具），不需要长期向后兼容。一次性 migration 足够。

### D7: Timeline 渲染 — 纯 CSS Gantt（而非图表库）

**选择：** Gantt 风格时间线使用 CSS Grid + 相对宽度计算，无外部图表库。

**备选方案：**

- D3.js → 过重，SSR 不友好
- recharts → 不适合 Gantt 场景
- visx → 较轻但仍需额外依赖

**理由：** 典型 run 的事件数 ≤50（工具调用 + 模型推理），不需要虚拟化或复杂渲染。CSS Grid 方案零依赖，与 shadcn/ui 风格一致。每个事件用 `left: ${startPct}%` + `width: ${durationPct}%` 定位。

### D8: Subagent Tree 复用 — 共享 LineageTree

**选择：** Monitor 内的 Subagent Execution Tree 复用 `dashboard/src/components/shared/LineageTree.tsx`（已由 deck-agent-routing-observability 引入）。

**理由：** LineageTree 是纯 CSS flexbox 树组件，接受 `{ id, label, children, status }` 结构，完全满足需求。仅需传入不同的数据源（从 run_events 的 subagent stream 构造树）。

### D9: 7 天自动清理 — migration 级 scheduled pragma

**选择：** `RunEventStore` 在 `appendEvents` 时 lazy 检查：如果距上次 prune > 1 小时，执行 `DELETE FROM run_events WHERE created_at < datetime('now', '-7 days')`。

**备选方案：** 使用 SQLite 的 `AUTOINCREMENT` + row count 限制 → 无法按时间保留

**理由：** 时间基准保留更直观。Lazy check 避免定时器（Deck Server 无 cron 机制）。1 小时间隔防止频繁扫描。

### D10: Gateway 诊断迁移 — 组件搬移 + 原面板移除

**选择：** 将 `ConnectionCard`、`HealthCard`、`HeartbeatCard` 从 `panels/gateway/` 搬移到 `panels/monitor/overview/`，`GatewayPanel` 组件和 `panels/gateway/` 目录删除。NavRail 中移除 Gateway 入口。HeaderBar 的连接状态指示器（dot + tooltip）保留不变。

**理由：** 这 3 个卡片本质是运行时诊断，与 Monitor 的 "Overview" tab 定位一致。Gateway 面板移除后不再有无家可归的组件。

## Risks / Trade-offs

- **[写入性能]** → 高频 burst 场景（如 agent 连续调用 20 个工具）可能在 500ms 内累积大量事件。缓解：50 条 flush 上限 + WAL 模式并发读不阻塞。预估单条写入 ≈0.1ms（SQLite WAL），50 条 batch ≈5ms，可接受。
- **[存储增长]** → 7 天保留，每条事件 ≈1KB（JSON data），日均 1000 条 run × 20 events = 140MB/周。缓解：lazy prune 每小时执行；如需进一步控制，可添加 `DECK_RUN_EVENTS_RETENTION_DAYS` 环境变量。
- **[Activity → Monitor 迁移]** → 现有 Activity 面板的消费者（如果有外部引用）需要更新。缓解：Deck 是内部工具，无外部 API 消费者。i18n key migration 通过全量替换覆盖。
- **[SSE 事件中缺少结构化 runId]** → 部分 Gateway 事件可能没有 runId（如 system 事件）。缓解：无 runId 的事件不写入 run_events 表，继续显示在 Activity 兼容的 "Live Feed" 区域。
- **[Gateway 面板移除的用户感知]** → 习惯了 Gateway 面板入口的用户可能找不到诊断信息。缓解：Monitor Overview tab 包含相同的 3 个卡片；HeaderBar 连接指示器点击跳转到 Monitor。

## Open Questions

- **Q1:** 是否需要支持事件导出（CSV/JSON）？当前 scope 不含，可作为后续迭代。
- **Q2:** Subagent execution tree 数据是从 run_events 的 `subagent` stream 构造还是从 `deck.subagents.lineage` RPC 获取？前者更自洽（持久化数据），但后者更实时。初步选择：实时数据从 RPC，历史数据从 run_events。
