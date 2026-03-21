## Why

Activity 面板仅是一个扁平的事件时间线（in-memory 200 条 + SSE 100 条 replay buffer），无法按 runId 关联事件、无法观测工具调用瀑布、无法查看 token 消耗统计、事件在内存 sweep 后丢失。对于自动化运维场景，"这次运行发生了什么"是核心可观测性需求。同时，Gateway 面板的 ConnectionCard/HealthCard/HeartbeatCard 本质是运行时诊断信息，归属于 Monitor 更合理，Gateway 面板在 NavRail 中可以移除（状态指示器保留在 HeaderBar）。

## What Changes

- **事件持久化**：扩展 projection-store 模式，新增 `run_events` SQLite 表（runId, seq, stream, data, sessionKey, ts），保留 7 天，支持按 runId/时间窗口/agent/session 查询
- **Panel 重命名**：`activity` → `monitor`（UI store Panel 类型、NavRail 注册、i18n key 全量更新）
- **Run Timeline 视图**：Gantt 风格时间线，展示单次运行内的工具调用时长、模型推理时间、审批等待时间
- **Tool Waterfall 视图**：层级化展示运行内的工具调用链——哪个工具调了什么、结果、耗时
- **File Change Summary**：聚合单次运行的文件读/写/修改操作，展示受影响文件路径
- **Model Statistics**：按 run 聚合模型调用次数、token 消耗（input/output/cache）、fallback 事件
- **Subagent Execution Tree**：在 Monitor 上下文内展示 parent-child 关系可视化
- **Compaction Markers**：标记 context overflow 触发压缩的事件
- **RunId 历史查询**：按 runId、时间窗口、agent、session 查询历史运行
- **Gateway 诊断迁移**：将 ConnectionCard + HealthCard + HeartbeatCard 从 Gateway 面板迁移到 Monitor
- **Gateway 面板移除**：从 NavRail 移除 Gateway 面板入口（HeaderBar 连接状态指示器保留）

## Capabilities

### New Capabilities

- `run-event-persistence`: 运行事件持久化层——`run_events` SQLite 表、写入管线（EventBus → SQLite）、查询 API（按 runId/时间/agent/session）、7 天自动清理
- `run-timeline-view`: 运行时间线视图——Gantt 风格 timeline + tool waterfall + file changes + model stats + subagent tree + compaction markers
- `run-history-query`: 运行历史查询——RunId 列表、过滤、分页、详情导航
- `monitor-panel`: Monitor 面板容器——替代 Activity 面板，整合 Overview（原 Gateway 诊断卡片）+ Timeline + History 三个 Tab

### Modified Capabilities

（无现有 spec 需要修改）

## Impact

- **后端**（`dashboard/server/`）：扩展 `projection-store.ts` 或新增 `run-event-store.ts`，新增 `run_events` 表 migration；新增 `/api/monitor/*` 路由（3-4 个端点）
- **前端**（`dashboard/src/`）：新增 `panels/monitor/` 目录（替代 `panels/activity/`），新增 `stores/monitor.ts`，迁移 `panels/gateway/` 的 3 个诊断卡片
- **UI Store**：`Panel` 类型中 `activity` → `monitor`，移除 `gateway`
- **NavRail**：`OBSERVE` 组中 Activity → Monitor（图标切换），移除 Gateway 入口
- **EventBus**：新增 `run.event` 事件类型用于持久化管线
- **依赖**：无新外部依赖
- **上游兼容**：所有改动在 `dashboard/` 目录内，rebase 零冲突
