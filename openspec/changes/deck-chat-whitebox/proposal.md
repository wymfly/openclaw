## Why

Chat panel 已有 6 种内容块类型、ToolProgressBar、BlockFilterBar 和 A2UI 支持，但工具调用/结果仍以原始 JSON 和未格式化文本呈现。用户无法快速理解 agent 执行了什么操作、花费了多少 token、以及子任务状态——必须人肉阅读 raw data。升级为"会话级解释层"可让每条 assistant 消息可展开查看完整执行 trace，显著提升可观测性。

## What Changes

- **ToolUseCard 增强**：格式化参数显示（键值对表格 / 语法高亮），可折叠分区，不再是 `JSON.stringify` 直出
- **ToolResultCard 增强**：
  - Bash 命令结果 → command + stdout/stderr + exit code 三栏分离视图
  - 文件操作结果 → 内联 diff viewer（检测 read/write 工具的文件路径）
  - 长内容 → 虚拟滚动替代 300px max-height 截断
- **Run Status Indicator**：每条 assistant 消息附带运行元数据条——当前模型、token 用量（input/output/cache）、耗时
- **Subagent Inline Cards**：子 agent 启动时在消息流中内联展示 task/status/duration 状态卡片
- **File Operation Diff Preview**：对 read/write 工具结果检测文件路径并渲染 diff

## Capabilities

### New Capabilities

- `tool-param-formatter`: 工具调用参数的结构化格式化渲染（键值对表格、代码高亮、折叠分区）
- `tool-result-views`: 工具结果的分类型视图（bash split-view、diff viewer、virtual scroll）
- `run-status-indicator`: 单条 assistant 消息的运行元数据展示（模型、token、耗时）
- `subagent-inline-cards`: 子 agent 任务的内联状态卡片

### Modified Capabilities

<!-- 无现有 spec 需要修改 -->

## Impact

- **组件变更**：`ToolUseCard.tsx`（26→~120 行）、`ToolResultCard.tsx`（55→~200 行）扩展；新建 `RunStatusBar.tsx`、`SubagentCard.tsx`、`BashResultView.tsx`、`DiffPreview.tsx`
- **Store 变更**：`chat.ts` 需扩展 `ContentBlock` 联合类型以携带结构化 tool result 元数据；增加 run-level 元数据字段
- **SSE 变更**：`useChatSSE.ts` 需解析 agent event 中的子 agent spawn/complete 事件，以及 run-level token/model 信息
- **类型变更**：`chat-types.ts` 扩展 `tool_result` 块增加 `parsedContent` 可选字段（bash/diff/raw 联合类型）
- **依赖**：可能引入 `react-diff-viewer`（或轻量 diff 渲染）、`@tanstack/react-virtual`（虚拟滚动）
- **无 Breaking Change**：所有增强向后兼容，原始渲染作为 fallback
