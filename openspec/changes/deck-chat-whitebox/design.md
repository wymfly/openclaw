## Context

Chat panel 当前渲染 6 种 ContentBlock（text/image/file/tool_use/tool_result/thinking），工具调用以 `JSON.stringify` 展示，工具结果以纯文本 + 300px 截断呈现。ToolProgressBar 追踪运行中工具的实时状态，BlockFilterBar 控制块类型可见性。A2UI 支持 canvas 模式。

现有架构：`useChatSSE` → Zustand store（`chat.ts`）→ `MessageList` → 各 block 组件。SSE 事件已区分 chat/agent/approval/a2ui 四种 payload。Agent event 中已包含 `phase: start|result|complete|error` 和 `toolUseId`，但未携带 run-level 元数据（model/token/duration）。

用户群体：开发者和运维人员，需要理解 agent 执行 trace 以调试和优化 prompt/工具配置。

## Goals / Non-Goals

**Goals:**

- 工具调用参数以结构化、可读方式展示（非 raw JSON）
- 工具结果按类型分视图：bash → split view，file op → diff，长内容 → virtual scroll
- 每条 assistant 消息显示 run-level 元数据（model, tokens, duration）
- 子 agent 任务在消息流中以内联卡片展示状态
- 所有增强向后兼容：未知格式 fallback 到现有渲染

**Non-Goals:**

- Execution Monitor 全局面板（P4 范畴）
- 跨 run 统计/分析
- Artifact panel 变更
- SSE 协议变更（仅利用现有 event payload 中未消费的字段）
- 工具调用的编辑/重放功能

## Decisions

### D1: 解析层位置 — ToolResultCard 内部 vs Store 预处理

**选择：ToolResultCard 内部按需解析（lazy parsing）**

在 `ToolResultCard` 渲染时，根据关联的 `tool_use.name` 和内容模式匹配来选择视图。解析结果通过 `useMemo` 缓存。

- 替代方案：在 `mapBlock()` 中预解析写入 store。优点是 store 中有结构化数据可供其他消费者使用；缺点是增加 store 复杂度、SSE 热路径增加 CPU、且 `ContentBlock` 类型膨胀。
- 理由：当前只有 ToolResultCard 消费解析结果，lazy parsing 更简单、不影响流式性能。如果未来 Execution Monitor 需要结构化数据，再提升到 store 层。

### D2: Bash 结果检测策略

**选择：基于 tool name 匹配 + 内容启发式**

优先匹配 `tool_use.name`（`bash`, `execute`, `terminal` 等），然后对内容做 exit code 模式检测（`exit code: N` 或结尾 `\n$?=N`）。

- 理由：Gateway 的 tool_use block 已包含 `name` 字段，这是最可靠的信号。内容启发式作为补充处理未规范化的 tool name。

### D3: Diff 渲染方案

**选择：自研轻量 inline diff 组件（基于 `diff` npm 包）**

使用 `diff` 包（~8KB gzipped）计算行级差异，自研渲染组件（添加/删除行着色 + 行号）。

- 替代方案：`react-diff-viewer`（~45KB gzipped，依赖 `diff` + `emotion`），功能完整但体积大且引入 CSS-in-JS。
- 理由：我们只需 unified diff 渲染，不需要 side-by-side、语法高亮等高级功能。自研组件 < 150 行代码，无额外 CSS-in-JS 依赖。

### D4: 长内容虚拟滚动

**选择：`@tanstack/react-virtual` 行级虚拟化**

对超过阈值（200 行）的工具结果启用虚拟滚动，替代 300px max-height + overflow 截断。

- 替代方案：保持 max-height 截断 + "Show All" 按钮。实现简单但展开后大内容仍会卡顿。
- 理由：虚拟滚动保证任意大小内容的流畅交互，且 `@tanstack/react-virtual` 是 dashboard 已有 TanStack 生态的一部分，集成成本低。

### D5: Run Status 数据来源

**选择：利用现有 SSE agent event 扩展**

Gateway 的 agent event 在 `phase: complete` 时已携带执行统计。在 `dispatchAgentEvent` 中提取 `model`、`usage`（input/output/cache tokens）、`duration` 并写入 session state 的 run-level metadata。

- 替代方案：新增独立 SSE event type `run_status`。更清晰但需 Gateway 侧改动。
- 理由：优先利用现有 event 数据，避免跨层协调。如果现有 payload 不足，后续可增加 Gateway 端字段。

### D6: 子 Agent 卡片的数据流

**选择：复用 agent event 的 subagent spawn/complete phase**

Gateway 已在 agent event 中推送子 agent 的 spawn 和 completion。在 store 中新增 `subagentRuns: Map<string, SubagentRun>` 追踪子 agent 生命周期，`SubagentCard` 组件从 store 读取并渲染在对应消息位置。

- 理由：避免新增 SSE event type，数据已在管道中，只需 store 层消费和 UI 层渲染。

## Risks / Trade-offs

- **[解析误判]** Bash/diff 检测基于启发式，可能误分类非标工具结果 → 所有解析视图均提供 "Show Raw" 切换按钮作为 fallback
- **[Run metadata 不完整]** Gateway 现有 agent event 可能未包含所有期望字段（model/tokens） → 先检查实际 payload，不足时在 RunStatusBar 中优雅降级（显示 "—"）
- **[Virtual scroll 与折叠交互]** 虚拟滚动容器在 `<details>` 折叠展开时需要重新计算高度 → 使用 ResizeObserver 监听容器变化触发 virtualizer 重算
- **[Bundle size]** 新增 `diff` + `@tanstack/react-virtual` 约 15KB gzipped → 可接受，均为按需加载的 ToolResultCard 内部依赖

## Open Questions

1. Gateway agent event `phase: complete` 是否已携带 `model`、`usage` 字段？需验证实际 payload 结构。
2. 子 agent spawn event 是否包含 `taskDescription`？如果不包含，SubagentCard 只能显示 agent ID + 状态。
3. diff 渲染是否需要支持 binary file 检测？初始版本可跳过，显示 "[Binary file]" 占位。
