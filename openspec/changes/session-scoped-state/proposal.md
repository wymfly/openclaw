## Why

openclaw-deck 的 chat 状态管理使用扁平 Zustand store（单一 `messages[]`、单一 `isStreaming`），导致会话切换时出现数据竞态、SSE 连接断裂、后台 session 状态丢失。这些是阻碍性问题——多模态对话已上线但 session 渲染不稳定，且后续 Tool Progress、Approval 审批流、A2UI Canvas、多窗格 UI 等功能全部依赖 session 级状态隔离。现在必须在继续叠加功能前修复基础设施。

## What Changes

- 将 `stores/chat.ts` 从扁平 state 重构为 `Map<string, SessionState>` 架构，每个 session 拥有独立的消息、流状态、错误、工具进度、审批、Canvas 状态
- 将 `useChatSSE.ts` 从闭包捕获 + session 过滤重构为「单连接 + dispatcher 路由」，EventSource 不再因 session 切换而重建
- 引入 session 生命周期管理：active/idle 分层 + LRU 淘汰（5 分钟空闲阈值）+ 透明 rehydrate
- AbortController 外置到模块级 Map，解决 Zustand 序列化问题并支持异步操作取消
- 消息 ID 从 `hist-${index}` 迁移为全局唯一的 `${sessionKey}:${timestamp}:${index}` 格式
- 新增细粒度 selector hooks（`useSessionMessages`、`useSessionStreaming` 等），替代直接访问 store 全量状态
- 消费方组件（ChatPanel、MessageList、MessageInput、SessionSidebar、ApprovalDialog）逐个迁移至新 API
- 定义 `SessionMeta` 类型，侧栏列表与完整 SessionState 解耦

## Capabilities

### New Capabilities

- `session-state-isolation`: Session 级状态隔离基础设施 — Map store、SSE dispatcher、生命周期管理、selector hooks、兼容层迁移策略
- `session-lifecycle`: Session 生命周期管理 — active/idle 状态机、LRU 淘汰、透明 rehydrate、内存预算控制

### Modified Capabilities

（无现有 spec 需要修改）

## Impact

- **Dashboard 前端**（`dashboard/src/`）：`stores/chat.ts` 重写，`useChatSSE.ts` 重写，5 个消费方组件迁移
- **Gateway / API routes**：零改动
- **渠道消息流**：零影响 — 改动范围严格限制在 Dashboard 前端
- **依赖**：无新增依赖
- **后续提案**：Tool Progress（提案 2）、Approval（提案 3）、A2UI Canvas（提案 4）、多窗格 UI（提案 5）均依赖本提案的 SessionState 槽位
