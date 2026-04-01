## Why

Deck 的 Sessions 和 Logs 面板在数据获取和内存管理方面存在功能缺失和潜在风险：

### Sessions 面板

1. **搜索参数未传递** — `sessions.list` 支持 search、limit、activeMinutes、includeGlobal 等参数，Deck 调用时全部使用默认值，无法按关键词搜索或过滤活跃 session
2. **Session 属性修改缺失** — `sessions.patch` 支持修改 label、thinkingLevel、fastMode、verboseLevel 等属性，Deck 完全未提供修改入口
3. **批量预览未用** — `sessions.preview` 可批量获取 session 摘要（首条消息、最后活跃时间等），Deck 未调用
4. **无高级过滤** — 缺少按 session 类型（direct/group/global/subagent）、活跃时间、agent 等维度的过滤

### Logs 面板

1. **轮询效率低** — 当前 2s 定时轮询 `logs.tail`，无增量机制；官方用 cursor-based 增量读取（maxBytes 控制内存），Deck 未传 cursor
2. **无内存上限** — logs store 无上限缓存所有日志条目，长时间运行可能导致 OOM
3. **无日志级别过滤** — 缺少按 level（info/warn/error）过滤的 UI

## What Changes

- 增强 **Sessions 搜索**: 传递 search、limit、activeMinutes 参数到 `sessions.list`，在面板中提供搜索栏和过滤器
- 新增 **Session 属性编辑**: 通过 `sessions.patch` 修改 label、thinkingLevel、fastMode 等属性（使用 InlineEdit 组件）
- 新增 **高级过滤**: 按 session 类型、活跃时间范围、agent 等维度过滤
- 重构 **Logs 增量读取**: 使用 `logs.tail` 的 cursor 参数实现增量拉取，避免重复数据
- 新增 **Logs 内存管理**: ring buffer 限制内存中的日志条目上限（默认 5000 条）
- 新增 **日志级别过滤**: 按 level 过滤显示的日志

## Capabilities

### New Capabilities

- `sessions-advanced-search`: Sessions 搜索和高级过滤（search、类型、活跃时间、agent）
- `sessions-patch`: Session 属性编辑（label、thinkingLevel、fastMode、verboseLevel）
- `logs-incremental-fetch`: 基于 cursor 的增量日志读取，替代全量轮询
- `logs-memory-management`: 日志 ring buffer 内存管理 + 日志级别过滤

### Modified Capabilities

(none)

## Impact

- **修改 Store**: sessions store 新增 search/filter 参数传递；logs store 重构为 cursor-based + ring buffer
- **修改组件**: SessionsPanel.tsx（搜索栏+过滤器）、SessionDetail.tsx（属性编辑）、LogsPanel.tsx（级别过滤）、LogStream.tsx（增量渲染）
- **依赖**: 消费 `deck-shared-list-infra` 的 ListSearchBar 和 PaginatedList
- **API**: 更充分使用已有的 `sessions.list`（search/limit 参数）、`sessions.patch`、`logs.tail`（cursor 参数）
- **i18n**: `sessions` 和 `logs` 命名空间新增搜索、过滤、编辑相关 key
