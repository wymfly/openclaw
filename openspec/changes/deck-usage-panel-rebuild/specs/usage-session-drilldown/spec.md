## ADDED Requirements

### Requirement: Session list displays usage summary per session

面板底部 SHALL 渲染 session 列表，每行显示 session key、agent 名称、tokens（in/out）、cost、最后更新时间。数据来自 `sessions.usage` 响应的 `sessions` 数组。

#### Scenario: Display session list

- **WHEN** `sessions.usage` 返回 25 个 session
- **THEN** SHALL 渲染 session 列表（使用 PaginatedList，默认每页 20 条），按 cost 降序排列

#### Scenario: Empty sessions

- **WHEN** 选定日期范围内无 session
- **THEN** SHALL 显示空状态提示（i18n key: `usage.noSessions`）

### Requirement: Session drilldown shows detailed usage logs

用户点击 session 行 SHALL 展开或导航到该 session 的详细使用日志（调用 `sessions.usage.logs` API）。

#### Scenario: Expand session detail

- **WHEN** 用户点击某 session 行
- **THEN** SHALL 调用 `sessions.usage.logs` RPC（传入 session key），在展开区域显示日志列表（每条日志包含 timestamp、event type、tokens、cost）

#### Scenario: Loading state during drilldown

- **WHEN** `sessions.usage.logs` 正在加载
- **THEN** 展开区域 SHALL 显示 loading skeleton

#### Scenario: Navigate to session detail panel

- **WHEN** 用户点击 session 行上的 "查看详情" 按钮
- **THEN** SHALL 导航到 Sessions 面板的对应 session 详情页（复用已有路由）

### Requirement: Session list supports search

Session 列表 SHALL 支持通过 ListSearchBar 按 session key 或 agent 名称搜索过滤。

#### Scenario: Search sessions by agent name

- **WHEN** 用户在搜索栏输入 "main"
- **THEN** session 列表 SHALL 仅显示 agent 名称包含 "main" 的 session
