## ADDED Requirements

### Requirement: Usage store fetches sessions.usage as primary data source

Usage store SHALL 调用 `sessions.usage` RPC 获取完整的多维度聚合数据，包括 totals、aggregates（byModel/byProvider/byAgent/byChannel/daily/latency）和 sessions 列表。

#### Scenario: Fetch usage data for date range

- **WHEN** 面板加载或用户选择日期范围 startDate="2026-03-01" endDate="2026-03-31"
- **THEN** store SHALL 调用 `sessions.usage` RPC 传入 startDate/endDate 参数，将响应存储为原始数据

#### Scenario: Quick time window shortcuts

- **WHEN** 用户点击 "今天"/"7天"/"30天" 快捷按钮
- **THEN** store SHALL 将快捷选择转换为 startDate/endDate 参数并调用 `sessions.usage`

#### Scenario: Request deduplication

- **WHEN** 同参数的请求在 30 秒内重复触发
- **THEN** store SHALL 返回缓存数据，不重复调用 API

### Requirement: Usage store provides fast initial load with usage.cost fallback

Usage store SHALL 在面板首次加载时并行调用 `usage.cost`（有 30s 缓存，响应更快）和 `sessions.usage`，先用 cost 数据渲染基础指标卡片，sessions.usage 加载完成后替换为完整数据。

#### Scenario: Progressive loading

- **WHEN** 面板首次打开
- **THEN** SHALL 先显示 `usage.cost` 的 token/cost 汇总（通常 <500ms），loading 状态覆盖 breakdown 区域；`sessions.usage` 完成后替换所有数据并移除 loading

### Requirement: Usage store exposes date range state

Usage store SHALL 管理当前选中的日期范围（startDate、endDate），支持快捷窗口和自定义范围两种设置方式。

#### Scenario: Custom date range

- **WHEN** 用户在日期范围选择器中选择 2026-03-15 到 2026-03-25
- **THEN** store 的 startDate 和 endDate SHALL 更新，触发重新获取数据
