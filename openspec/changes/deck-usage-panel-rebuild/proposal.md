## Why

Deck 的 Usage 面板当前仅使用 `usage.cost` API 展示基础的 token/cost 汇总和粗粒度的 model/agent 分解表。而后端 `sessions.usage` RPC 提供了丰富的多维度聚合能力（byModel、byProvider、byAgent、byChannel、latency、daily 明细），完全未被利用。

具体差距：

1. **数据源单一** — 仅用 `usage.cost`（token/cost 汇总），`sessions.usage` 的完整聚合（消息计数、工具使用、延迟统计、按渠道分解）完全未接入
2. **时间序列残缺** — `sessions.usage.timeseries` 需要 session key，面板注释已标注 "disabled"；无跨 session 的时间趋势图
3. **无多维度分析** — 官方 UI 支持按 model/provider/agent/channel 四个维度的 breakdown，Deck 仅有 model/agent 两个 tab
4. **无 session 级明细** — 无法下钻到单个 session 查看 token 消耗明细和日志
5. **无延迟监控** — `sessions.usage` 返回 latency 统计（p50/p90/p99），当前完全未展示

## What Changes

- 接入 `sessions.usage` RPC 作为主数据源，获取完整的多维度聚合数据
- 重建 SummaryCards：展示 token（in/out/cache）、cost、消息数、工具调用数、平均延迟等核心指标
- 新增多维度 Breakdown 视图：model / provider / agent / channel 四个维度切换，每个维度显示 token、cost、占比
- 利用 `sessions.usage` 的 `daily` 和 `modelDaily` 数据重建时间序列图表，替代依赖单 session 的 timeseries API
- 新增 session 级下钻：点击 agent/session 可查看该 session 的 usage 明细（接入 `sessions.usage.logs`）
- 新增延迟分析卡片：展示 p50/p90/p99 延迟、每日延迟趋势
- 支持日期范围选择器（替代当前 today/7d/30d 粗粒度选择），利用 `sessions.usage` 的 startDate/endDate 参数
- 使用 `deck-shared-list-infra` 的 SortableHeader 和 PaginatedList 组件构建 breakdown 表格

## Capabilities

### New Capabilities

- `usage-data-aggregation`: 接入 sessions.usage RPC，构建完整的多维度使用数据管道（store 层）
- `usage-multi-dimension-breakdown`: 四维度 breakdown 视图（model/provider/agent/channel），支持排序和分页
- `usage-latency-analysis`: 延迟分析卡片，展示 p50/p90/p99 和每日延迟趋势图
- `usage-session-drilldown`: session 级下钻视图，展示单 session 的 token 消耗明细和日志

### Modified Capabilities

(none)

## Impact

- **Store 重构**: `dashboard/src/stores/usage.ts` 需重大重构，新增 `sessions.usage` 数据流
- **API 路由**: 需新增 `dashboard/src/app/api/usage/sessions/route.ts` 代理 `sessions.usage` RPC
- **组件重写**: UsagePanel.tsx、SummaryCards.tsx、BreakdownTable.tsx、UsageChart.tsx 大幅重写
- **新组件**: LatencyCard.tsx、SessionDrilldown.tsx、DateRangePicker.tsx（或复用已有日期选择方案）
- **依赖**: 消费 `deck-shared-list-infra` 的 SortableHeader、PaginatedList；Recharts 已有
- **i18n**: `usage` 命名空间需大量新增 key（延迟、渠道、维度名称等）
- **Gateway allowlist**: `sessions.usage` 已在 EXTRA_METHODS 中，无需额外添加
