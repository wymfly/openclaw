## ADDED Requirements

### Requirement: Latency card displays percentile statistics

LatencyCard SHALL 展示 p50、p90、p99 延迟值（毫秒），数据来自 `aggregates.latency`。

#### Scenario: Display latency percentiles

- **WHEN** `aggregates.latency` 返回 `{ p50: 850, p90: 2100, p99: 5200 }`
- **THEN** SHALL 显示三个指标：p50 = 850ms、p90 = 2.1s、p99 = 5.2s（自动转换单位）

#### Scenario: Latency data unavailable

- **WHEN** `aggregates.latency` 为 undefined
- **THEN** LatencyCard SHALL 不渲染（条件渲染，非空状态）

### Requirement: Latency card shows daily trend

LatencyCard SHALL 在延迟指标下方渲染每日延迟趋势折线图（数据来自 `aggregates.dailyLatency`）。

#### Scenario: Daily latency trend

- **WHEN** `aggregates.dailyLatency` 有 7 个数据点
- **THEN** SHALL 渲染折线图，X 轴日期，Y 轴 p50 延迟（默认），可切换为 p90/p99

#### Scenario: Single day range

- **WHEN** 日期范围仅一天（今天）
- **THEN** 折线图 SHALL 不渲染（单点无趋势意义），仅显示数值指标
