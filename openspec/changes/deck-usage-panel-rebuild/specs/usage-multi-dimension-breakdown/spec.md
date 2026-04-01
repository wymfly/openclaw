## ADDED Requirements

### Requirement: Breakdown view supports four dimension tabs

Breakdown 组件 SHALL 渲染四个维度 tab（Model、Provider、Agent、Channel），每个 tab 显示该维度下各项的 token（in/out）、cost、占比。

#### Scenario: Switch dimension tab

- **WHEN** 用户点击 "Provider" tab
- **THEN** SHALL 显示 `aggregates.byProvider` 数据，表格列为：名称、Tokens In、Tokens Out、Cost、占比（百分比条）

#### Scenario: Model dimension with daily breakdown

- **WHEN** Model tab 被选中且 `aggregates.modelDaily` 数据可用
- **THEN** SHALL 在表格上方可选显示按模型分色的堆叠面积图（来自 modelDaily 数据）

### Requirement: Breakdown table supports sorting

Breakdown 表格 SHALL 使用 SortableHeader 组件支持按 Tokens In、Tokens Out、Cost 列排序。

#### Scenario: Sort by cost descending

- **WHEN** 用户点击 Cost 列头
- **THEN** 表格 SHALL 按 cost 降序排列，列头显示降序指示器

### Requirement: Breakdown table supports pagination for large datasets

Breakdown 表格 SHALL 在维度项超过 20 条时使用 PaginatedList 分页显示。

#### Scenario: Paginate model breakdown

- **WHEN** byModel 有 35 个不同模型
- **THEN** 表格 SHALL 分 2 页显示（每页 20 条），底部渲染分页控件

### Requirement: Summary cards display six core metrics

SummaryCards SHALL 展示 6 个核心指标卡片：Tokens In、Tokens Out、Total Cost、Messages、Tool Calls、Avg Latency。

#### Scenario: Full metrics display

- **WHEN** `sessions.usage` 数据加载完成
- **THEN** SHALL 显示 totals.input（Tokens In）、totals.output（Tokens Out）、totals.totalCost（Total Cost）、aggregates.messages.total（Messages）、aggregates.tools.totalCalls（Tool Calls）、aggregates.latency.p50（Avg Latency，格式为 ms）

#### Scenario: Latency metric unavailable

- **WHEN** `aggregates.latency` 为 undefined（旧版 Gateway 不返回）
- **THEN** Avg Latency 卡片 SHALL 显示 "N/A" 或隐藏

### Requirement: Time series chart uses daily aggregation data

时间序列图表 SHALL 使用 `aggregates.daily` 数据渲染面积图，X 轴为日期，Y 轴为 tokens 或 cost（可切换）。

#### Scenario: Daily token trend

- **WHEN** 选择 30 天范围且 aggregates.daily 有 30 个数据点
- **THEN** SHALL 渲染面积图，每个数据点对应一天的 tokens（in + out 堆叠）

#### Scenario: Switch to cost view

- **WHEN** 用户在图表上方切换 Y 轴为 "Cost"
- **THEN** SHALL 重新渲染图表，Y 轴显示每日 cost（USD），保持相同的日期范围
