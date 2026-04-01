## Context

当前 Usage 面板数据流：

```
usage.cost RPC → /api/usage/cost route → usage store → SummaryCards + BreakdownTable
usage.status RPC → /api/usage route → (仅 rate limit 信息，未在 UI 展示)
sessions.usage.timeseries → /api/usage/timeseries route → (disabled, 需 session key)
```

后端 `sessions.usage` RPC 返回的完整数据结构：

```typescript
SessionsUsageResult {
  sessions: SessionUsageEntry[];      // 每个 session 的明细
  totals: CostUsageTotals;            // 汇总 token/cost
  aggregates: {
    messages: SessionMessageCounts;    // 消息计数统计
    tools: SessionToolUsage;           // 工具调用统计
    byModel: SessionModelUsage[];      // 按模型分解
    byProvider: SessionModelUsage[];   // 按提供商分解
    byAgent: [{ agentId, totals }][];  // 按 agent 分解
    byChannel: [{ channel, totals }][]; // 按渠道分解
    latency?: SessionLatencyStats;     // p50/p90/p99 延迟
    dailyLatency?: SessionDailyLatency[]; // 每日延迟
    modelDaily?: SessionDailyModelUsage[]; // 每日按模型
    daily: [{ date, tokens, cost, messages, toolCalls, errors }][];
  }
}
```

该 API 一次调用即返回所有维度数据，无需多次请求。

## Goals / Non-Goals

**Goals:**

- 用 `sessions.usage` 替代 `usage.cost` 作为主数据源，一次调用获取完整多维度数据
- 提供 model / provider / agent / channel 四维度 breakdown，支持排序
- 展示延迟统计（p50/p90/p99）和每日延迟趋势
- 利用 `daily` 和 `modelDaily` 数据构建时间序列图表（无需 `sessions.usage.timeseries`）
- 支持灵活的日期范围选择（startDate/endDate）
- 支持 session 级下钻（点击查看明细）

**Non-Goals:**

- 不实现实时流式 usage 更新 — 当前 `sessions.changed` 事件携带的 usage 信息有限，不值得构建实时管道
- 不实现 usage 导出 — 非核心需求
- 不实现自定义 dashboard/图表配置 — 过度设计
- 不废弃 `usage.cost` API — 保留作为轻量级快速查询的 fallback

## Decisions

### D1: sessions.usage 作为主数据源

**选择**: 使用 `sessions.usage` RPC 作为面板主数据源，一次调用获取 totals + aggregates + daily + sessions 列表。

**替代方案**: 保留 `usage.cost` 为主，按需额外调用 `sessions.usage` 获取缺失维度。

**理由**: `sessions.usage` 返回的数据是 `usage.cost` 的超集（totals 完全兼容），且包含 `usage.cost` 无法提供的 byProvider、byChannel、latency、messages、tools 维度。一次调用比多次请求更高效，且避免数据不一致。`usage.cost` 保留作为面板初始加载时的快速 fallback（有 30s 缓存，响应更快）。

### D2: 日期范围选择器替代粗粒度 time window

**选择**: 使用 startDate/endDate 日期范围选择器，配合快捷按钮（今天、7天、30天、自定义范围）。

**替代方案**: 保留当前 "today | 7d | 30d" 三按钮。

**理由**: `sessions.usage` 原生支持 startDate/endDate 参数，日期范围选择器让用户可以查看任意时间段的数据，同时保留快捷按钮确保便利性不降低。

### D3: 利用 daily 数据构建时间序列

**选择**: 从 `sessions.usage` 的 `aggregates.daily` 和 `aggregates.modelDaily` 构建时间序列图表，不使用 `sessions.usage.timeseries`。

**替代方案**: 对每个 session 调用 `sessions.usage.timeseries` 再聚合。

**理由**: `sessions.usage.timeseries` 需要 session key，无法做跨 session 聚合。而 `aggregates.daily` 天然提供按日的 token/cost/messages/toolCalls/errors 汇总，正好是时间序列图表需要的数据。`modelDaily` 还支持按模型分色的堆叠面积图。

### D4: 面板布局重组

**选择**: 采用三行布局：

1. **顶栏**: 日期范围选择器 + 刷新按钮
2. **指标卡片行**: 6 个 SummaryCard（tokens in/out、总 cost、消息数、工具调用数、平均延迟）
3. **主内容区**: 左侧时间序列图表 + 右侧维度切换的 breakdown 表（占比 6:4 或响应式堆叠）
4. **底部**: 延迟分析卡片（可折叠）+ session 列表（可下钻）

### D5: Store 分层策略

**选择**: 重构 `usage store` 为两层：

- **数据层**: 原始 API 响应缓存 + 请求去重（同参数在 30s 内不重复调用）
- **视图层**: 从原始数据派生各维度视图（useMemo 在组件中，而非 store 中）

**理由**: 让 store 职责清晰（获取+缓存），视图计算（如 breakdown 排序、时间序列格式化）留在组件层，避免 store 膨胀。

### D6: Session 下钻的渐进式加载

**选择**: session 列表默认只显示 `sessions.usage` 返回的摘要（key、agent、tokens、cost）。用户点击某 session 后，才调用 `sessions.usage.logs` 获取详细日志。

**理由**: `sessions.usage` 一次返回所有 session 摘要（limit 默认 50），足够列表展示。按需加载日志避免初始加载过慢。

## Risks / Trade-offs

- **[API 响应延迟]** `sessions.usage` 需要遍历所有 session 计算聚合，30 天范围可能耗时数秒 → 显示 loading skeleton，保留 `usage.cost`（有缓存）作为初始快速渲染数据源，`sessions.usage` 加载完成后替换
- **[数据量]** session 列表可能很长 → 使用 PaginatedList（来自 shared-list-infra），默认显示 top 20
- **[日期范围复杂度]** 自定义日期范围选择器增加 UI 复杂度 → 以快捷按钮为主，自定义范围为可选展开
- **[向后兼容]** `sessions.usage` 的 latency/modelDaily 为可选字段（较新版本 Gateway 才返回）→ 组件对这些字段做 optional 处理，不可用时隐藏对应卡片
