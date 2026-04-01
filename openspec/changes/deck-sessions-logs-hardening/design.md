## Context

### Sessions 面板现状

Sessions store 调用 `sessions.list` 但不传 search/limit 等参数（使用默认值）。SessionsPanel 展示 session 列表和详情，SessionDetail 展示 session 基本信息。

`sessions.list` 可用参数：

- `search`: 按 session key 或消息内容搜索
- `limit`: 返回数量限制（默认 50）
- `activeMinutes`: 过滤最近 N 分钟活跃的 session
- `includeGlobal`: 是否包含 global session

`sessions.patch` 可修改属性：

- `label`: session 标签/名称
- `thinkingLevel`: off/low/medium/high
- `fastMode`: boolean
- `verboseLevel`: 详细程度

### Logs 面板现状

Logs store 使用 2s setInterval 轮询 `logs.tail`，每次获取全量日志（不传 cursor），所有条目追加到数组，无内存上限。

`logs.tail` 可用参数：

- `cursor`: 上次读取的位置标记，仅返回新增日志
- `maxBytes`: 单次返回的最大字节数（控制内存）
- 返回值包含 `nextCursor` 用于下次增量读取

## Goals / Non-Goals

**Goals:**

- Sessions 面板支持搜索和多维过滤
- Sessions 支持属性编辑（patch）
- Logs 面板改为 cursor-based 增量读取
- Logs 添加内存上限保护
- Logs 支持级别过滤

**Non-Goals:**

- 不实现 session 导出/批量操作 — 低优先级
- 不实现 logs 全文搜索 — 后端不支持，仅前端过滤
- 不实现 logs SSE 流式推送 — 后端无 `logs.stream` 端点，保持轮询但改为增量
- 不实现 session 删除 — 敏感操作，暂不提供 UI

## Decisions

### D1: Sessions 搜索使用 ListSearchBar + 服务端搜索

**选择**: 使用 `deck-shared-list-infra` 的 ListSearchBar 组件，搜索文本传递给 `sessions.list` 的 `search` 参数（服务端搜索），而非客户端过滤。

**理由**: sessions 数量可能很多（数百到数千），客户端过滤需要先加载全部数据。服务端搜索只返回匹配结果，更高效。

### D2: 高级过滤组合策略

**选择**: 过滤器同时支持：

- Session 类型（direct/group/global/subagent）— 客户端过滤（`sessions.list` 不支持类型参数）
- 活跃时间 — 通过 `activeMinutes` 参数（服务端过滤）
- Agent — 客户端过滤（从 session 元数据匹配）

**理由**: 混合使用服务端和客户端过滤，利用各自优势。`sessions.list` 支持的参数走服务端，不支持的走客户端。

### D3: Session 属性编辑使用 InlineEdit 组件

**选择**: 在 SessionDetail 中使用 `deck-shared-list-infra` 的 InlineEdit 组件编辑 label、thinkingLevel、fastMode 等属性。

**理由**: InlineEdit 的 click-to-edit 模式适合属性编辑场景（大部分时间查看，偶尔修改）。thinkingLevel 使用 `type="select"` 渲染选择器。

### D4: Logs cursor-based 增量读取

**选择**: 重构 logs store 的轮询逻辑：

1. 首次加载调用 `logs.tail`（不传 cursor，获取最新日志 + nextCursor）
2. 后续轮询传入 `cursor: nextCursor`，仅获取增量日志
3. 如 cursor 过期（返回错误），重置为无 cursor 重新获取

**理由**: cursor-based 避免每次获取全量数据，减少网络传输和解析开销。

### D5: Logs ring buffer 内存管理

**选择**: logs store 维护最多 5000 条日志的 ring buffer。新日志追加到尾部，超过上限时从头部淘汰。

**理由**: 5000 条日志约占 2-5MB 内存（每条 ~500 bytes），足够查看最近的日志。无上限缓存在长时间运行场景下可能消耗数百 MB。

### D6: 日志级别过滤在客户端执行

**选择**: 所有日志存入 ring buffer，level 过滤在渲染层通过 `useMemo` 过滤。

**理由**: `logs.tail` 不支持 level 参数过滤，客户端过滤是唯一方案。ring buffer 保证内存可控，过滤不增加内存。

## Risks / Trade-offs

- **[搜索延迟]** 服务端搜索可能有延迟 → ListSearchBar 的 debounce（300ms）缓解频繁请求
- **[Cursor 过期]** 长时间不轮询后 cursor 可能过期 → 检测错误后自动重置为无 cursor 模式
- **[Ring buffer 丢失旧日志]** 用户可能想看被淘汰的旧日志 → 提供 "加载更早日志" 按钮（反向 cursor 读取，如 API 支持）
- **[Sessions patch 权限]** 某些属性修改可能需要特定 scope → 修改失败时显示权限不足提示
