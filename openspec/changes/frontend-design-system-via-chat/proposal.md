## Why

deck-go 当前没有共享设计系统：每个 panel（chat / settings / models / channels / sessions / gateway-panel）各自用 `deck-ui-*` 命名空间散落 className，单文件经常 > 500 行（`MessageInput.tsx` 693、`SettingsPanel.tsx` 1072），无统一的颜色 token / 密度 / a11y 纪律。这导致：

1. 全模块 UI 重设计无法启动——每个 panel 重做都得自己设计 token + atom，会出 N 套
2. AI 设计工具（Claude Design）输出的代码无法直接落地——在 chat pilot（详见 `docs/superpowers/specs/2026-04-29-claude-design-evaluation.md`）实证为 0% 可用代码比例
3. 类型契约绑定 go 服务当前转发现状，UI 想加新字段（如 `cacheHit/cost`）必须等后端先做

本提案把"全模块 UI 重设计 program"的第一步从"开始重设计"反转为"建立设计系统 + 用 chat 验证"。chat 作为最复杂面板（覆盖 80% 通用 UI 模式）天然适合作为 pilot：通过 chat 重构产出的 design-system 直接可被其它面板复用，避免 N 套。

后端 go 服务的 OpenClaw 协议适配在另一分支独立推进；前端**以 OpenClaw Gateway 协议为 source of truth**，类型扩展时新字段标 optional，UI 在数据缺失时优雅降级，与后端分支异步收敛。

## What Changes

- **新建** `deck-go/frontend/src/design-system/` 目录：tokens（颜色/间距/字号/密度/圆角）+ 18 个原子组件 + 共享 utility hooks，全部满足 a11y / i18n / dual-theme / dual-density 纪律
- **新建** Gateway 真相能力地图研究产物 `docs/superpowers/specs/2026-04-29-chat-gateway-capability-map.md`（4-stream 并行研究：OpenSpec changes / RPC method-registry / SSE event union / 数据契约 schema）
- **重构** `panels/chat/*` 改用 design-system atoms，落实 3 个固化 UX 决定：
  - User 消息右对齐 IM bubble
  - tool_use + tool_result 合并为 paired 单卡
  - tool_result viewType 用 segmented control 替代 ShowRaw 单按钮
- **扩展** `chat-types.ts` 加入 Gateway-truth optional 字段：`RunMetadata.cacheHit`、`RunMetadata.cost`、`SubagentLineageNode.children?`（递归视图层）等——按 P2 组件实施需要逐步加，不预先全扩
- **替换** chat panel 中所有 `deck-ui-*` className 为新设计系统 `ds-*` 前缀（其它 panel 不动，本提案 out of scope）
- **保留** SSE 协议、a2ui-bridge、zustand store 结构、i18n key 命名空间不变（硬约束）
- **out of scope**：settings / models / channels / sessions / gateway-panel 等其它面板的重设计（待 chat 完成后单独提案）；go 服务后端字段补齐（在另一分支独立推进）

## Capabilities

### New Capabilities

- `frontend-design-system`: 共享设计系统目录，规定 tokens 命名空间、原子组件清单与契约（props / a11y / 主题 / 密度）、CSS 命名规则（`ds-*` 前缀 + 不允许内联 hex）、引用纪律（任何 panel 必须只通过 design-system 引用 token 与 atom）

### Modified Capabilities

- `transcript-rendering-contract`: 新增 user 消息支持 right-align IM bubble 渲染、tool_use + tool_result 必须合并为单一 paired 视觉单元（共享外边框，error 整卡红边）、所有 transcript 子组件必须仅使用 `frontend-design-system` 提供的 atom，不允许 panel 私有样式
- `tool-result-views`: 新增 segmented control 选择器替代单一 ShowRaw 按钮，tabs 列表为 `raw / bash / read / diff`（不可用 viewType 的 tab 必须 disabled 而非隐藏，保持位置稳定）；error 态必须默认展开且保留 segmented control 可见
- `run-status-indicator`: 新增 optional `cacheHit`、`cost` 字段渲染；当字段为 undefined 时必须优雅降级（隐藏对应 chip 而非显示 0 或 "—"）；流式期间允许显示部分数据
- `chat-message-contract`: 新增 Gateway-truth optional 字段在前端类型上的可选承载（不强制后端立即提供）；类型扩展后下游消费方必须能处理 undefined

## Impact

- **新增代码**：`deck-go/frontend/src/design-system/`（约 30 个文件：tokens.css / atoms / hooks / index.ts）
- **重写代码**：`deck-go/frontend/src/components/panels/chat/**/*.tsx`（约 30 个文件）
- **类型扩展**：`deck-go/frontend/src/stores/chat-types.ts` 增量加 optional 字段
- **CSS 文件**：theme.css 顶部 `@import` design-system tokens；旧 `deck-ui-*` 选择器在 chat 范围内逐步删除
- **测试**：现有 `panels/chat/__tests__/*.tsx` 需要批量更新匹配新 className 与新结构；新增 design-system atoms 的单元测试与可访问性测试
- **i18n**：保留所有现有 `chat.*` / `approvals.*` key 不变；UI 重写时必须使用 i18n key 而非硬编码英文（即使设计参考稿是英文）
- **视觉回归**：`?deckVisualState=chat-rich` / `chat-empty` 两个 visual seed 必须仍可工作；变更后基线截图重置为新设计
- **Gateway 协议**：不变（视觉层重构与协议无关）
- **go 服务**：不变（后端字段补齐由另一分支独立推进，前端类型 optional 兼容）
- **依赖**：不引入新 npm 依赖（硬约束）；evaluation 文档建议未来引入 framer-motion 用于动画但本提案 out of scope
- **风险**：旧 `deck-ui-*` 在其它 panel 仍在用，删除必须仅限 chat 范围；类型扩展若引入 union 必须通过 generated types 而非手写
- **依赖文档**：
  - `docs/superpowers/specs/2026-04-29-claude-design-evaluation.md`（优先级反转论证）
  - `docs/superpowers/specs/2026-04-29-chat-ui-redesign-design.md`（状态清单与组件矩阵）
  - `/tmp/design-bundle/openclaw-deck/`（Claude Design 视觉参考稿，不直接落地）
