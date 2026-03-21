## Why

Routing / Sessions / Channels 三个面板已有基础实现（BindingTable + RouteSimulator、SessionList + SessionDetail、ChannelList + ChannelDetail），但深度不足以支撑运维理解消息流全貌。Routing 缺少拖拽排序和冲突检测；Sessions 无法可视化 DM Scope 策略，也缺少上下文健康度指标；Channels 缺少 WeCom/Feishu 等企业渠道的配置向导和多账户管理。这些不足导致运维必须回到 config.yaml 手动操作，Dashboard 沦为只读展示。

## What Changes

- **Routing 增强**：可视化条件编辑器（channel + accountId + peer + role + guildId 组合构建器）、拖拽排序优先级、规则冲突检测（overlapping match 高亮）、路由命中日志（最近 N 条消息的实际路由结果）
- **Sessions 增强**：DM Scope 策略选择器（main / per-peer / per-channel-peer / per-account-channel-peer 四模式图解）、Session Key 解析器（`agent:{id}:{key}` 结构拆解）、上下文健康指标（token 用量百分比、compaction 次数、消息计数）、转录搜索、会话导出
- **Channels 增强**：WeCom 配置向导（4 种传输模式选择 + 分步引导）、Feishu 配置向导（WebSocket vs Webhook 选择）、多账户管理 UI、消息吞吐量监控
- 新增 / 增强共享组件：ConditionBuilder, DragHandle, ConflictBadge, ScopeStrategyDiagram, ContextHealthBar, ConfigWizard

## Capabilities

### New Capabilities

- `routing-condition-editor`: 路由规则可视化条件编辑器，支持 channel/accountId/peer/role/guildId 组合构建、拖拽排序、冲突检测
- `routing-hit-log`: 路由命中日志面板，展示最近消息的实际路由匹配结果
- `session-scope-visualizer`: DM Scope 策略选择器与四模式图解，Session Key 结构解析器
- `session-context-health`: 会话上下文健康度指标（token 用量、compaction、消息计数）及转录搜索/导出
- `channel-config-wizard`: WeCom / Feishu 企业渠道配置向导（传输模式选择 + 分步引导 + 多账户管理）
- `channel-throughput-monitor`: 渠道消息吞吐量监控面板

### Modified Capabilities

（无现有 spec 需要修改——所有改动为既有面板的增量增强，不改变已有 RPC 契约）

## Impact

- **前端**：`dashboard/src/components/panels/routing/` 新增 ConditionBuilder / ConflictDetector / HitLog 组件；`sessions/` 新增 ScopeVisualizer / ContextHealth / TranscriptSearch；`channels/` 新增 ConfigWizard / ThroughputChart
- **Store 层**：扩展现有 `deck-routing` / `sessions` / `channels` store，新增本地推导状态（冲突分析、scope 解析、健康计算）
- **API 契约**：复用现有 `deck.routing.*` / `sessions.*` / `channels.*` RPC，不新增 Gateway 方法——所有新数据通过客户端推导或现有 RPC 字段获取
- **依赖**：拖拽排序引入 `@dnd-kit/core`；图表复用 dashboard 已有 chart 组件；配置向导使用 shadcn/ui Stepper 模式
- **上游兼容**：所有改动在 `dashboard/` 目录内，不修改 `src/gateway/`，rebase 零冲突
