## Why

OpenClaw 的核心运行机制（7 层路由优先级、Subagent spawn/lifecycle、per-agent Skill 白名单）完全隐藏在 `config.yaml` 和运行时内存中。现有 Dashboard 仅有 Agent 基础 CRUD，非专业运维和用户无法配置路由规则、监控子智能体运行、管理 Skill 分配。这导致用户无法理解"消息从哪来，到哪去"，运维无法观测多智能体协作状态。

## What Changes

- 新增 `deck.*` RPC API 命名空间（17 个方法），提供路由管理、Agent 增强、Subagent 监控、身份链接、线程绑定的专用接口
- 新增 **Routing 面板**：路由规则总表（按 8 层优先级排序）+ 路由模拟器（输入渠道/频道参数，可视化匹配过程）
- 新增 **Subagents 面板**：活跃运行监控（实时轮询）+ 调用谱系图 + 历史记录 + 全局配置
- 增强 **Agents 面板**：基础列表 → Master-Detail 详情页（概览/路由/Skills/Subagent/会话 5 个 Tab）
- 增强 **Sessions 面板**：增加 Subagent 类型标识和谱系链接
- 增强 **Skills 面板**：增加 Agent × Skill 分配矩阵
- 增强 **Channels 面板**：增加渠道→Agent 绑定视图
- 新增 6 个共享组件（BindingDialog, AgentBadge, TierBadge, LineageTree, SubagentRunCard, SessionKeyDisplay）
- 新增 3 个 Zustand Store（deck-routing, deck-subagents, deck-agents）

## Capabilities

### New Capabilities

- `deck-routing-api`: `deck.routing.*` RPC 接口（list/add/remove/validate/simulate），提供路由规则 CRUD 和路由模拟能力
- `deck-agents-api`: `deck.agents.*` RPC 接口（detail/skills.get/skills.set/subagents.get/subagents.set），提供 Agent 详情聚合和 per-agent 配置管理
- `deck-subagents-api`: `deck.subagents.*` RPC 接口（list/kill/lineage），提供 Subagent 运行监控和谱系查询
- `deck-auxiliary-api`: `deck.identity.*` + `deck.threads.*` RPC 接口，提供跨渠道身份链接和线程绑定管理
- `routing-panel`: Routing 面板前端（路由规则表 + 模拟器 + BindingDialog）
- `subagents-panel`: Subagents 监控面板前端（活跃运行/历史/配置 3 Tab + LineageTree）
- `agents-panel-enhancement`: Agents 面板增强为 Master-Detail + 5 Tab 详情页
- `panel-enhancements`: Sessions/Skills/Channels 面板增量增强

### Modified Capabilities

（无现有 spec 需要修改）

## Impact

- **后端**：`src/gateway/server-methods/deck/` 新增目录（5 个文件 + index），与上游完全隔离
- **前端**：`dashboard/src/` 新增 2 个面板目录、3 个 store、6 个共享组件；增强 4 个现有面板
- **API 契约**：17 个新 RPC 方法，使用 `deck.*` 前缀与上游解耦
- **依赖**：无新外部依赖，LineageTree 用纯 CSS 实现
- **上游兼容**：所有改动在 `deck/` 命名空间或 `dashboard/` 目录，rebase 零冲突
