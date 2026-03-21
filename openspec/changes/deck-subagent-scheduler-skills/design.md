## Context

OpenClaw Deck Dashboard 已有 Subagents（3 Tab: ActiveRuns/History/Config）、Cron（JobList/JobForm/RunHistory/RunNowButton）和 Skills（SkillList/SkillConfig/SkillMatrixTab）面板。这些面板的基础 CRUD 和监控功能已就绪，但缺少高级自动化能力。

现有代码：

- `dashboard/src/components/panels/subagents/` — SubagentsPanel + 3 个 Tab 组件
- `dashboard/src/components/panels/cron/` — CronPanel + 4 个子组件
- `dashboard/src/components/panels/skills/` — SkillsPanel + 3 个子组件
- `dashboard/src/stores/deck-subagents.ts` — SubagentRun/LineageNode 类型，轮询+kill+lineage
- `dashboard/src/stores/cron.ts` — CronJob CRUD + 运行历史
- `dashboard/src/stores/skills.ts` — SkillEntry + 安装选项

已有 `deck.subagents.lineage` RPC 返回 `LineageNode[]` 树结构，`skills.install` / `skills.update` RPC 已在 Gateway 注册。

## Goals / Non-Goals

**Goals:**

- 将 Subagent 运行从扁平列表升级为 DAG 拓扑可视化，让用户理解 parent-child 协作关系
- 提供 Steer 操作，让运维可以在不中断运行的情况下注入指令到 subagent
- 将 Heartbeat 配置从 config.yaml 提升到 Scheduler UI，统一定时任务管理入口
- 通过 UI 实现技能的完整生命周期管理（安装/更新/卸载）

**Non-Goals:**

- 不实现 Subagent 生成 UI（Agent 生成 Subagent，用户不直接生成）
- 不实现 Skill Marketplace（外部技能发现/评分系统）
- 不实现 Cron 表达式构建器（用户手动输入 cron 表达式）
- 不修改上游 Heartbeat 或 Cron 引擎逻辑
- 不引入重型图表/可视化库
- 视觉设计不在此阶段确定，实施时使用 UI skill

## Decisions

### D1: Steer RPC 幂等设计 — 60 秒去重窗口

**选择：** `deck.subagents.steer({ runId, instruction })` 使用 `(runId, sha256(instruction))` 作为去重 key，60 秒内相同 key 的重复请求返回之前的结果而不重复注入

**备选：**

- 客户端生成 idempotency key → 增加前端复杂度
- 无去重 → 误操作风险（双击、网络重试）

**理由：** Steer 是破坏性操作（注入指令会改变 subagent 行为），60 秒窗口覆盖常见的网络重试和用户双击场景。内容哈希去重无需客户端参与。

### D2: DAG 拓扑渲染 — SVG 连线 + CSS 布局

**选择：** TreeDAG 组件使用 CSS flexbox 布局节点，SVG overlay 画连线

**备选：**

- react-flow / dagre → 重型依赖
- 纯 CSS 伪元素（现有 LineageTree 方案）→ DAG（非树）场景连线受限

**理由：** Subagent 拓扑通常是树但理论上可以是 DAG（一个 agent 被多个 parent 调用）。SVG 连线比 CSS 伪元素更灵活，同时仍然零外部依赖。典型拓扑 ≤10 节点，性能无忧。

### D3: Scheduler 面板 — 合并而非新建

**选择：** 在现有 CronPanel 基础上增加 Heartbeat Tab，重命名为 SchedulerPanel

**备选：**

- 新建独立 Heartbeat 面板 → 分散注意力，两个面板功能重叠
- 在 Settings 面板管理 → 心跳是运行时特性，不属于设置

**理由：** Cron 和 Heartbeat 都是"定时触发"语义，合并为 Scheduler 统一管理入口最符合用户心智模型。现有 CronPanel 结构（左侧列表+右侧详情）天然支持 Tab 扩展。

### D4: Heartbeat 配置数据源 — config.patch

**选择：** Heartbeat 配置通过 `config.patch` 写入 `agents.defaults.heartbeat` 或 per-agent `agent.heartbeat`

**理由：** 复用现有配置机制，无需新 RPC。Heartbeat 是 Gateway 配置的一部分，走 config.patch 保证一致性和乐观锁。

### D5: Skills Install/Update — 复用现有 RPC

**选择：** 直接调用 Gateway 已有的 `skills.install({ name, version? })` 和 `skills.update({ name })` RPC

**备选：** 新增 `deck.skills.*` 包装 RPC

**理由：** 上游已有完整的 skills CRUD RPC，无需重复包装。前端 store 直接调用即可。

### D6: Skill Detail 视图 — 内联展开

**选择：** 在 SkillList 中点击技能 → 右侧展示详情（元数据/依赖/环境变量/版本），替代当前的 SkillConfig

**理由：** 复用现有的左列表+右详情布局。SkillConfig 变为详情视图的一个 Tab，新增 Info Tab 显示元数据。

### D7: 附件传递可视化 — 节点边缘标记

**选择：** 在 DAG 节点之间的连线上标记附件传递信息（文件名/类型/大小），使用 tooltip 展示详情

**理由：** 附件传递是 subagent 协作的关键信息流，但不值得单独面板。在拓扑图中标注既直观又节省空间。

## Risks / Trade-offs

- **[Steer 安全性]** → 注入任意指令到运行中的 subagent 可能导致不可预期行为。缓解：UI 显示确认对话框并记录操作日志；steer 写入 ADMIN scope
- **[DAG 节点过多]** → 深度嵌套 subagent 可能产生大量节点。缓解：复用现有 lineage maxNodes=50 限制；超出显示 "展开更多" 链接
- **[Heartbeat 字段映射]** → per-agent heartbeat 字段可能随上游更新变化。缓解：UI 仅暴露 interval/activeHours/target 三个稳定字段
- **[Skills 安装失败]** → 安装过程可能因网络/权限失败。缓解：异步安装 + 进度 toast + 失败详情展示

## Open Questions

- Steer 指令是否需要长度限制（当前设计无限制，依赖 RPC 层通用限制）
- Heartbeat activeHours 是否支持多时段（如 9:00-12:00 + 14:00-18:00）— 取决于上游类型定义
- Skills 卸载是否需要确认依赖检查（某些技能被 agent 引用时是否阻止卸载）
