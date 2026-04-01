## ADDED Requirements

### Requirement: Logs store maintains ring buffer with 5000 entry limit

Logs store SHALL 使用 ring buffer 限制内存中日志条目数量，默认上限 5000 条。

#### Scenario: Buffer overflow

- **WHEN** 日志条目达到 5000 条，新日志到达
- **THEN** SHALL 从 buffer 头部淘汰最老的条目，新日志追加到尾部

#### Scenario: Buffer count display

- **WHEN** buffer 中有日志
- **THEN** LogsPanel SHALL 显示当前缓存条目数和上限（如 "3421 / 5000"）

### Requirement: Logs panel supports level filter

LogsPanel SHALL 支持按日志级别（info/warn/error/debug）过滤显示。

#### Scenario: Filter by error level

- **WHEN** 用户选择 "error" 级别过滤
- **THEN** 日志列表 SHALL 仅显示 level="error" 的条目（客户端过滤）

#### Scenario: Multiple level selection

- **WHEN** 用户同时选中 "warn" 和 "error"
- **THEN** SHALL 显示 level 为 "warn" 或 "error" 的条目

#### Scenario: Level filter does not affect buffer

- **WHEN** level 过滤激活
- **THEN** ring buffer SHALL 继续存储所有级别的日志（不丢弃被过滤的条目）

### Requirement: Logs level badges use semantic colors

每条日志的 level badge SHALL 使用语义色：

#### Scenario: Level color mapping

- **WHEN** 日志条目渲染
- **THEN** level badge 颜色 SHALL 为：error → destructive, warn → warning, info → primary, debug → muted
