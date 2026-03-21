## Why

现有 Subagents、Cron 和 Skills 面板已具备基础能力（运行监控、任务管理、技能列表），但缺少关键的自动化工作流功能：

1. **Subagents 面板** — 有 ActiveRuns/History/Config 三 Tab，但运行列表是扁平的，无法看到 parent-child 拓扑关系；用户无法在运行中注入指令（steer）；附件传递过程不可见
2. **Cron 面板** — 有完整的 Cron Job CRUD 和运行历史，但 Heartbeat（心跳检测）配置分散在 config.yaml 中，运维需手动编辑；无下次执行倒计时
3. **Skills 面板** — 有列表+配置+矩阵，但无法通过 UI 安装/卸载/更新技能；技能详情（依赖、环境变量）不可见

## What Changes

- 增强 **Subagents 面板**：在 ActiveRunsTab 增加 DAG 拓扑可视化（TreeDAG 组件）；点击节点 → 查看会话历史；增加 Steer 操作（注入指令到运行中的 subagent）；增加附件传递流可视化
- 新增 RPC：`deck.subagents.steer { runId, instruction }` — 带 60 秒幂等去重
- 增强 **Cron 面板** 为 **Scheduler 面板**：合并 Heartbeat 配置 UI（间隔、活跃时段 time picker、投递目标）；增加下次执行倒计时显示；保留现有 Cron 功能
- 增强 **Skills 面板**：增加 Install/Uninstall/Update 操作（调用 `skills.install` / `skills.update` RPC）；增加技能详情视图（元数据、依赖、必需环境变量）；增强 SkillMatrixTab 为可视化矩阵

## Capabilities

### New Capabilities

- `subagent-topology`: Subagent DAG 拓扑可视化 + click-to-inspect + steer 操作 + 附件传递流
- `scheduler-merge`: Cron → Scheduler 面板升级，合并 Heartbeat 配置 UI + 下次执行倒计时
- `skills-operations`: Skills 安装/卸载/更新操作 + 技能详情视图 + 矩阵增强

### Modified Capabilities

- 修改现有 `subagents-panel` spec 中的 ActiveRunsTab（增加拓扑层）
- 修改现有 `cron-management` spec（扩展为 Scheduler）
- 修改现有 `skill-management` spec（增加安装操作）

## Impact

- **后端**：新增 1 个 RPC（`deck.subagents.steer`）；其他操作复用现有 `skills.install` / `skills.update` / `cron.*` 接口
- **前端**：增强 3 个现有面板；新增 TreeDAG / HeartbeatConfig / SkillDetail 等组件；增强 3 个 Zustand Store
- **NavRail**：Cron → Scheduler 重命名
- **i18n**：新增 scheduler / skill-operations 相关 key
- **依赖**：无新外部依赖，DAG 用纯 CSS + SVG 实现
- **上游兼容**：所有改动在 `dashboard/` 目录，rebase 零冲突
