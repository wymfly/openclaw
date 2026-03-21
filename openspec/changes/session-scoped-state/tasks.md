## 1. 类型定义 + Selector Hooks

- [ ] 1.1 新建 `dashboard/src/stores/chat-types.ts`：定义 `SessionState`、`ToolProgress`、`ApprovalRequest`、`A2UIState`、`SessionMeta`、`ChatStore` 接口
- [ ] 1.2 新建 `dashboard/src/stores/chat-hooks.ts`：实现 `useSessionState`、`useSessionMessages`、`useSessionStreaming`、`useSessionToolProgress`、`useSessionApproval`、`useActiveSessionKey`、`useSessionMetaList`、`useSessionIndicator` selector hooks
- [ ] 1.3 新建 `dashboard/src/stores/chat-abort.ts`：实现模块级 `sessionAbortControllers` Map + `getSessionAbort(key)` / `abortSession(key)` 函数

## 2. Store 重写

- [ ] 2.1 重写 `dashboard/src/stores/chat.ts`：将扁平 state 替换为 `Map<string, SessionState>` + `activeSessionKey` + `activeAgentId` + `sessionMeta`
- [ ] 2.2 实现 `ensureSession(key)` — 创建空 SessionState 或刷新 lastAccessedAt
- [ ] 2.3 实现所有 session-scoped actions：`addMessage`（幂等去重）、`updateStreamingBlocks`、`finalizeStreamingMessage`、`replaceMessageContent`、`setMessages`（合并策略）、`setStreaming`、`setError`
- [ ] 2.4 实现 `setActiveSession(key)` — 不 clearMessages，缓存命中直接展示，缓存未命中触发 rehydrate + `loadHistory` 合并策略
- [ ] 2.5 实现实体 actions：`updateToolProgress`、`setActiveApproval`、`setA2UIState`
- [ ] 2.6 实现 `removeSession(key)` — abortSession + 从 Map 和 sessionMeta 中删除
- [ ] 2.7 实现 `setSessionMeta` / `refreshSessionMeta`
- [ ] 2.8 添加兼容层：导出 `getActiveSession()` 桥接函数供未迁移组件使用

## 3. SSE Dispatcher 重写

- [ ] 3.1 重写 `dashboard/src/components/panels/chat/useChatSSE.ts` → `useSSEConnection` hook：空依赖数组 `[]`，生命周期绑定组件挂载/卸载
- [ ] 3.2 实现 `dispatchChatEvent`：first-delta（`streamingRunId !== runId`）创建消息 vs 后续 delta 更新消息，final 触发 `reloadFullContent`
- [ ] 3.3 实现 `dispatchAgentEvent`、`dispatchApproval`、`dispatchA2UIEvent` 路由函数
- [ ] 3.4 实现 `reloadFullContent(sessionKey, runId)` — 使用 `getSessionAbort(key).signal`，2 次重试，二次检查 session 是否仍存在

## 4. 消费方组件迁移

- [ ] 4.1 迁移 `ChatPanel.tsx`：移除 `useEffect([activeSessionId])` 的手动 clearMessages + fetch 逻辑，改用 `setActiveSession` 内部处理
- [ ] 4.2 迁移 `MessageList.tsx`：`useChatStore(s => s.messages)` → `useSessionMessages()`
- [ ] 4.3 迁移 `MessageInput.tsx`：`useChatStore(s => s.isStreaming)` → `useSessionStreaming()`；send action 传入 `activeSessionKey`
- [ ] 4.4 迁移 `SessionSidebar.tsx`：移除 `clearMessages()` 调用，只调 `setActiveSession(key)`；使用 `useSessionMetaList()` + `useSessionIndicator(key)`
- [ ] 4.5 迁移 `ApprovalDialog.tsx`：`useChatStore(s => s.activeApproval)` → `useSessionApproval()`

## 5. 清理 + 兼容层移除

- [ ] 5.1 删除 `getActiveSession()` 兼容桥接及所有调用点
- [ ] 5.2 删除旧的 `clearMessages` action 和 `messages` / `isStreaming` 等旧顶层字段
- [ ] 5.3 更新 `toUiMessage` 函数：消息 ID 从 `hist-${index}` 改为 `${sessionKey}:${timestamp}:${index}`

## 6. 生命周期管理

- [ ] 6.1 实现 `evictStale(maxIdleMs = 300000)`：通过 `setState` + `new Map()` 触发 re-render；active / activeSessionKey 永不淘汰
- [ ] 6.2 在 `setActiveSession` 和 `ensureSession`（Map.size > 阈值）中调用 `evictStale`
- [ ] 6.3 添加 `visibilitychange` 监听器：页面 hidden 时激进清理
- [ ] 6.4 实现 `useSessionIndicator(key)` hook：从 SessionState 字段派生 `'approval' | 'streaming' | 'canvas' | 'idle' | 'none'`

## 7. 验证

- [ ] 7.1 手动验证：正常对话收发（发消息 → 流式回复 → 完整内容块渲染）
- [ ] 7.2 手动验证：Session 切换无闪现（快速切换 3 个 session）
- [ ] 7.3 手动验证：后台 session 流跟踪（session A 发消息 → 切到 B → 切回 A 看到完整回复）
- [ ] 7.4 手动验证：SSE 连接稳定（连续切换 10 次，Network 面板只有 1 个 EventSource）
- [ ] 7.5 手动验证：附件发送 + abort 功能 + 多模态历史渲染
- [ ] 7.6 手动验证：淘汰后恢复（等待 5 分钟 → 切回 → 历史正确加载）
- [ ] 7.7 手动验证：DevTools Memory 面板，20 次切换后无持续增长
