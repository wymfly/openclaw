## ADDED Requirements

### Requirement: Tools catalog displays grouped tool list

Config tab SHALL 渲染工具目录面板（默认折叠），调用 `tools.catalog` API 展示按 source 分组的工具列表（core/plugin），每个工具显示 id、label、description、默认 profiles。

#### Scenario: Expand tools catalog

- **WHEN** 用户在 Config tab 展开 "工具目录" 折叠区域
- **THEN** SHALL 调用 `tools.catalog` API（传入当前 agentId），渲染分组列表：core 组和各 plugin 组，每组显示工具列表

#### Scenario: Tool entry details

- **WHEN** 工具目录加载完成
- **THEN** 每个工具条目 SHALL 显示：工具名称（label）、来源标签（core/plugin）、默认 profile badges

### Requirement: Per-tool allow/deny override

工具目录 SHALL 支持逐工具的 allow/deny 覆盖开关，覆盖 profile 级别的默认配置。

#### Scenario: Deny a tool

- **WHEN** 用户将某个工具的开关从 "默认" 切换为 "拒绝"
- **THEN** SHALL 调用 agent config 更新 API，将该工具添加到 deny 列表

#### Scenario: Allow a denied tool

- **WHEN** 用户将某个被拒绝的工具切换为 "允许"
- **THEN** SHALL 调用 agent config 更新 API，将该工具从 deny 列表移除并添加到 allow 列表

#### Scenario: Reset to profile default

- **WHEN** 用户将覆盖状态重置为 "默认"
- **THEN** 该工具 SHALL 从 allow 和 deny 列表中移除，恢复 profile 默认行为

### Requirement: Tools catalog graceful degradation

工具目录 SHALL 在 `tools.catalog` API 不可用时（旧版 Gateway）优雅降级。

#### Scenario: API unavailable

- **WHEN** `tools.catalog` 调用失败（method not found 或超时）
- **THEN** 工具目录区域 SHALL 不渲染，保留当前的 ToolProfileSelector 作为唯一工具配置入口
