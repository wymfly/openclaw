## 1. Sessions 搜索与过滤

- [x] 1.1 修改 sessions store 的 fetchSessions：传递 search、limit、activeMinutes 参数到 sessions.list API
- [x] 1.2 在 SessionsPanel 集成 ListSearchBar（来自 shared-list-infra），搜索文本绑定到 store 的 search 参数
- [x] 1.3 实现高级过滤器：session 类型多选（direct/group/global/subagent）、活跃时间选择（5min/1h/24h/全部）
- [x] 1.4 集成 PaginatedList（mode="button"，pageSize=20）替代当前无分页列表

## 2. Session 属性编辑

- [x] 2.1 在 SessionDetail 中集成 InlineEdit 编辑 label（文本模式）
- [x] 2.2 在 SessionDetail 中集成 InlineEdit 编辑 thinkingLevel（select 模式：off/low/medium/high）
- [x] 2.3 添加 fastMode Switch 开关
- [x] 2.4 实现 sessions.patch API 调用逻辑，成功后刷新 session 数据，失败时 toast 通知 + UI 回滚

## 3. Logs 增量读取

- [x] 3.1 重构 logs store：首次 fetch 不传 cursor，存储 nextCursor；后续轮询传入 cursor 增量读取
- [x] 3.2 实现 cursor 过期恢复：检测错误后重置 cursor 重新获取
- [x] 3.3 添加 maxBytes 参数（默认 64KB）到 logs.tail 调用

## 4. Logs 内存管理与过滤

- [x] 4.1 实现 ring buffer 数据结构：5000 条上限，新增时淘汰最老条目
- [x] 4.2 在 LogsPanel 添加缓存计数显示（当前条目数 / 上限）
- [x] 4.3 实现日志级别过滤 UI：多选 chip/checkbox（info/warn/error/debug），客户端 useMemo 过滤
- [x] 4.4 实现 level badge 语义色映射：error→destructive, warn→warning, info→primary, debug→muted

## 5. i18n 与验证

- [x] 5.1 在 zh.json/en.json 的 sessions 和 logs 命名空间新增所有 key（搜索、过滤、编辑、级别名称等）
- [x] 5.2 验证 dark mode 样式
- [x] 5.3 运行 tsc --noEmit 确保零类型错误
