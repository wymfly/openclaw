## ADDED Requirements

### Requirement: Sessions panel supports server-side search

SessionsPanel SHALL 提供搜索栏（使用 ListSearchBar），将搜索文本传递给 `sessions.list` 的 `search` 参数。

#### Scenario: Search by session key

- **WHEN** 用户输入 "main-2026"
- **THEN** SHALL 调用 `sessions.list` 传入 `search: "main-2026"`，仅显示匹配的 session

#### Scenario: Clear search

- **WHEN** 用户清空搜索栏
- **THEN** SHALL 调用 `sessions.list` 不传 search 参数，恢复显示全部 session

### Requirement: Sessions panel supports type filter

SessionsPanel SHALL 支持按 session 类型（direct/group/global/subagent）过滤。

#### Scenario: Filter by type

- **WHEN** 用户选择 "direct" 类型过滤
- **THEN** 列表 SHALL 仅显示 kind="direct" 的 session（客户端过滤）

#### Scenario: Multiple type selection

- **WHEN** 用户同时选中 "direct" 和 "group"
- **THEN** 列表 SHALL 显示 kind 为 "direct" 或 "group" 的 session

### Requirement: Sessions panel supports active time filter

SessionsPanel SHALL 支持按活跃时间过滤（最近 5分钟/1小时/24小时/全部）。

#### Scenario: Filter recently active

- **WHEN** 用户选择 "最近 1 小时"
- **THEN** SHALL 调用 `sessions.list` 传入 `activeMinutes: 60`，仅返回最近 1 小时活跃的 session

### Requirement: Sessions list uses PaginatedList

Sessions 列表 SHALL 使用 PaginatedList 组件分页显示，通过 `sessions.list` 的 `limit` 参数控制每页数量。

#### Scenario: Paginate sessions

- **WHEN** session 总数超过 20 条
- **THEN** SHALL 使用 PaginatedList（mode="button"，pageSize=20）分页显示
