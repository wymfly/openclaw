# Session-Scoped State 全功能测试计划（提案 1-4）

> 覆盖提案 1（Session State Infrastructure）、提案 2（Tool Progress）、提案 3（Approval Enhancement）、提案 4（A2UI Canvas + 右侧面板）全部功能点。

**目标：** 将测试覆盖率从 40% 提升至 90%+，重点补齐 UI 组件层和 API 层。

**现有覆盖：** 逻辑层（stores/dispatchers/hooks）100% | UI 组件 25% | API 路由 0%

---

## 1. 提案 1：Session State Infrastructure

### 1.1 ChatStore（Map-based 多 session 状态管理）

| #      | 测试场景                                       | 预期结果                                            | 状态    |
| ------ | ---------------------------------------------- | --------------------------------------------------- | ------- |
| 1.1.1  | `ensureSession` 创建新 session                 | Map 中新增条目，messages=[]，isStreaming=false      | ✅ 已有 |
| 1.1.2  | `ensureSession` 不覆盖已有 session             | 已有数据保留，lastAccessedAt 更新                   | ✅ 已有 |
| 1.1.3  | `addMessage` 追加消息到指定 session            | 消息出现在正确 session，其他 session 不受影响       | ✅ 已有 |
| 1.1.4  | `addMessage` 去重（相同 id 不重复添加）        | 第二次调用不增加消息数                              | ✅ 已有 |
| 1.1.5  | `setMessages` 历史合并（history + SSE 不丢失） | SSE 消息在 history 之后保留                         | ✅ 已有 |
| 1.1.6  | `setStreaming` 状态转换 + runId 追踪           | isStreaming 和 streamingRunId 正确设置              | ✅ 已有 |
| 1.1.7  | `updateStreamingBlocks` 更新流式内容           | 对应 message 的 content 被替换                      | ✅ 已有 |
| 1.1.8  | `finalizeStreamingMessage` 结束流式            | message.streaming=false                             | ✅ 已有 |
| 1.1.9  | `replaceMessageContent` 替换内容块             | content 替换 + streaming 结束                       | ✅ 已有 |
| 1.1.10 | `setActiveSession` 切换 + lastAccessedAt       | activeSessionKey 更新，时间戳刷新                   | ✅ 已有 |
| 1.1.11 | `evictStale` LRU 驱逐（max 20, 5min idle）     | 超过阈值的 idle session 被移除，active session 保护 | ✅ 已有 |
| 1.1.12 | `removeSession` 清理 + abort signal            | Map 和 sessionMeta 同步删除，abort 信号触发         | ✅ 已有 |
| 1.1.13 | 所有 mutation 返回新 Map 引用                  | `sessions !== prev.sessions`（Zustand 反应性保证）  | ✅ 已有 |

### 1.2 ChatAbort（session 级 abort 控制器）

| #     | 测试场景                          | 预期结果                                 | 状态    |
| ----- | --------------------------------- | ---------------------------------------- | ------- |
| 1.2.1 | 相同 key 返回相同 AbortController | 引用相等                                 | ✅ 已有 |
| 1.2.2 | `abortSession` 触发 signal + 清理 | signal.aborted=true，后续 get 返回新实例 | ✅ 已有 |
| 1.2.3 | abort 未知 key 无副作用           | 不抛异常                                 | ✅ 已有 |

### 1.3 ChatHooks（session-scoped selector hooks）

| #     | 测试场景                                                             | 预期结果                     | 状态    |
| ----- | -------------------------------------------------------------------- | ---------------------------- | ------- |
| 1.3.1 | `useSessionMessages` 返回当前 session 消息                           | 正确消息数组                 | ✅ 已有 |
| 1.3.2 | `useSessionMessages` 无 session 返回 []                              | 空数组 fallback              | ✅ 已有 |
| 1.3.3 | `useSessionStreaming` 返回流式状态                                   | { isStreaming, runId }       | ✅ 已有 |
| 1.3.4 | `useSessionToolProgress` 返回工具进度                                | Record<string, ToolProgress> | ✅ 已有 |
| 1.3.5 | `useSessionApproval` 返回审批请求                                    | ApprovalRequest \| null      | ✅ 已有 |
| 1.3.6 | `useSessionError` 返回错误信息                                       | string \| null               | ✅ 已有 |
| 1.3.7 | `useSessionIndicator` 优先级（approval > streaming > canvas > idle） | 按优先级返回正确状态         | ✅ 已有 |
| 1.3.8 | 跨 session 隔离（A session 变更不触发 B session 订阅）               | subscribe callback 不被调用  | ✅ 已有 |

### 1.4 SSE Dispatchers（事件分发）

| #      | 测试场景                                           | 预期结果                                                  | 状态    |
| ------ | -------------------------------------------------- | --------------------------------------------------------- | ------- |
| 1.4.1  | `dispatchChatEvent` delta → 首次创建流式消息       | addMessage + setStreaming(true, runId)                    | ✅ 已有 |
| 1.4.2  | `dispatchChatEvent` delta → 后续追加文本           | updateStreamingBlocks 更新 content                        | ✅ 已有 |
| 1.4.3  | `dispatchChatEvent` final → 正常结束               | finalizeStreamingMessage + setStreaming(false)            | ✅ 已有 |
| 1.4.4  | `dispatchChatEvent` final without delta → 独立消息 | 直接 addMessage                                           | ✅ 已有 |
| 1.4.5  | `dispatchChatEvent` error → 设置错误 + 结束流式    | setError + setStreaming(false)                            | ✅ 已有 |
| 1.4.6  | `dispatchChatEvent` aborted → 结束流式             | finalizeStreamingMessage + setStreaming(false)            | ✅ 已有 |
| 1.4.7  | 无 sessionKey 的事件被忽略                         | 无 store 变更                                             | ✅ 已有 |
| 1.4.8  | `reloadFullContent` 获取完整内容块                 | replaceMessageContent 包含 tool_use/tool_result/thinking  | ✅ 已有 |
| 1.4.9  | `reloadFullContent` 重试（2次 + 1s 间隔）          | 首次失败后 1s 重试，保留已有文本                          | ✅ 已有 |
| 1.4.10 | `mapBlock` 映射所有 block 类型                     | text/image/tool_use/tool_result/thinking/unknown 正确映射 | ✅ 已有 |

---

## 2. 提案 2：Tool Progress 实时渲染

### 2.1 ToolProgress Dispatcher

| #     | 测试场景                                     | 预期结果                           | 状态    |
| ----- | -------------------------------------------- | ---------------------------------- | ------- |
| 2.1.1 | `phase=start` 创建 toolProgress 条目         | status=running, startedAt 设置     | ✅ 已有 |
| 2.1.2 | `phase=result/complete` 标记完成             | status=completed, completedAt 设置 | ✅ 已有 |
| 2.1.3 | `phase=error` 标记错误                       | status=error                       | ✅ 已有 |
| 2.1.4 | 无 toolCallId 的事件忽略                     | 无 store 变更                      | ✅ 已有 |
| 2.1.5 | `phase=start` 追加 tool_use block 到流式消息 | 消息 content 增加 tool_use 条目    | ✅ 已有 |

### 2.2 ToolProgressBar 组件

| #     | 测试场景                                   | 预期结果                  | 状态    |
| ----- | ------------------------------------------ | ------------------------- | ------- |
| 2.2.1 | 无运行中工具时不渲染                       | 组件返回 null             | ❌ 待补 |
| 2.2.2 | 显示 running 状态工具（名称 + 动画指示器） | 工具名可见，脉冲动画存在  | ❌ 待补 |
| 2.2.3 | completed 工具在 2s 后自动隐藏             | 先显示 ✓，2s 后从列表移除 | ❌ 待补 |
| 2.2.4 | error 状态工具显示错误样式                 | 红色 ✗ 图标 + 错误文字    | ❌ 待补 |
| 2.2.5 | 多工具并行显示                             | 所有 running 工具按序排列 | ❌ 待补 |

---

## 3. 提案 3：Approval 审批流增强

### 3.1 Approval Dispatcher

| #     | 测试场景                                        | 预期结果                                           | 状态    |
| ----- | ----------------------------------------------- | -------------------------------------------------- | ------- |
| 3.1.1 | `dispatchApproval` 设置 activeApproval          | session 的 activeApproval 包含 id/toolName/command | ✅ 已有 |
| 3.1.2 | `dispatchApprovalResolved` 清除 activeApproval  | activeApproval=null                                | ✅ 已有 |
| 3.1.3 | `dispatchApprovalResolved` 不重建已驱逐 session | session 不存在时跳过                               | ✅ 已有 |

### 3.2 ApprovalDialog 组件

| #     | 测试场景                                             | 预期结果     | 状态    |
| ----- | ---------------------------------------------------- | ------------ | ------- |
| 3.2.1 | 渲染审批请求信息（toolName + command + description） | 文本正确显示 | ❌ 待补 |
| 3.2.2 | "允许一次" 按钮触发 onResolve(id, "allow-once")      | 回调参数正确 | ❌ 待补 |
| 3.2.3 | "始终允许" 按钮触发 onResolve(id, "allow-always")    | 回调参数正确 | ❌ 待补 |
| 3.2.4 | "拒绝" 按钮触发 onResolve(id, "deny")                | 回调参数正确 | ❌ 待补 |

### 3.3 SessionSidebar + SessionDot

| #     | 测试场景                                           | 预期结果                                          | 状态    |
| ----- | -------------------------------------------------- | ------------------------------------------------- | ------- |
| 3.3.1 | SessionDot 根据 indicator 显示正确颜色             | approval=黄, streaming=蓝脉冲, canvas=绿, idle=无 | ❌ 待补 |
| 3.3.2 | "新建 session" 生成唯一 key                        | 格式 `agent:{agentId}:web-{timestamp}-{random}`   | ❌ 待补 |
| 3.3.3 | 点击 session 切换 activeSessionKey + activeAgentId | store 状态正确更新                                | ❌ 待补 |
| 3.3.4 | 删除 session 调用 DELETE API + 移除 meta           | fetch 调用正确，列表更新                          | ❌ 待补 |
| 3.3.5 | Agent 切换刷新 session 列表                        | refreshSessionMeta 被调用                         | ❌ 待补 |

---

## 4. 提案 4：A2UI Canvas + 右侧面板

### 4.1 A2UI Bridge

| #     | 测试场景                                      | 预期结果                        | 状态    |
| ----- | --------------------------------------------- | ------------------------------- | ------- |
| 4.1.1 | `attach` 添加 message listener                | window.addEventListener 调用    | ✅ 已有 |
| 4.1.2 | `detach` 移除 listener                        | window.removeEventListener 调用 | ✅ 已有 |
| 4.1.3 | 收到 `a2ui:ready` 触发 onReady 回调           | callback 被调用                 | ✅ 已有 |
| 4.1.4 | origin 验证（拒绝错误来源）                   | 非法 origin 的消息被忽略        | ✅ 已有 |
| 4.1.5 | 收到 `a2ui:action` 触发 onUserAction          | action payload 传递正确         | ✅ 已有 |
| 4.1.6 | `a2ui:surfacesChanged` 触发 onSurfacesChanged | surfaces 数组传递正确           | ✅ 已有 |

### 4.2 A2UI Message Format

| #     | 测试场景                                      | 预期结果                      | 状态    |
| ----- | --------------------------------------------- | ----------------------------- | ------- |
| 4.2.1 | `sanitizeTagValue` 空格→下划线，特殊字符替换  | "hello world" → "hello_world" | ✅ 已有 |
| 4.2.2 | `sanitizeTagValue` 空/纯空白 → "-"            | "" → "-", " " → "-"           | ✅ 已有 |
| 4.2.3 | `extractActionName` 从 name/action 字段提取   | 优先 name，fallback action    | ✅ 已有 |
| 4.2.4 | `formatA2UIAgentMessage` 格式化匹配原生客户端 | 包含 context 和 action 信息   | ✅ 已有 |

### 4.3 A2UI Store Actions

| #     | 测试场景                                 | 预期结果                  | 状态    |
| ----- | ---------------------------------------- | ------------------------- | ------- |
| 4.3.1 | `appendA2UIEvent` 追加事件               | eventLog 长度 +1          | ✅ 已有 |
| 4.3.2 | eventLog 环形缓冲（max 200）             | 超过 200 时最旧事件被移除 | ✅ 已有 |
| 4.3.3 | `updateA2UIBridgeStatus` 设置桥接状态    | bridgeStatus 更新         | ✅ 已有 |
| 4.3.4 | `updateA2UISurfaces` 设置 surfaces 列表  | surfaces 数组更新         | ✅ 已有 |
| 4.3.5 | `setA2UIState` 合并语义（Partial merge） | 只更新传入字段，保留其他  | ✅ 已有 |
| 4.3.6 | `setA2UIState(null)` 清除                | a2uiState=null            | ✅ 已有 |

### 4.4 A2UI Dispatcher

| #     | 测试场景                                      | 预期结果                      | 状态    |
| ----- | --------------------------------------------- | ----------------------------- | ------- |
| 4.4.1 | `dispatchA2UIEvent` 路由到正确 session        | 指定 session 的 eventLog 增长 | ✅ 已有 |
| 4.4.2 | 无 sessionKey 时 fallback 到 activeSessionKey | 使用 store.activeSessionKey   | ✅ 已有 |
| 4.4.3 | 自动显示 Canvas overlay（visible=true）       | a2uiState.visible 设为 true   | ✅ 已有 |

### 4.5 RightPanel 组件

| #     | 测试场景                        | 预期结果                             | 状态    |
| ----- | ------------------------------- | ------------------------------------ | ------- |
| 4.5.1 | mode="hidden" 时不渲染          | children 不可见                      | ❌ 待补 |
| 4.5.2 | mode="canvas" 时显示 + 关闭按钮 | 面板可见，X 按钮触发 onClose         | ❌ 待补 |
| 4.5.3 | 拖拽分割线调整宽度              | mousedown→mousemove→mouseup 改变宽度 | ❌ 待补 |
| 4.5.4 | 宽度限制在 320-800px            | 拖拽到边界时 clamp                   | ❌ 待补 |
| 4.5.5 | 宽度持久化到 localStorage       | 刷新后恢复上次宽度                   | ❌ 待补 |

### 4.6 CanvasPanel 组件

| #     | 测试场景                                     | 预期结果                           | 状态    |
| ----- | -------------------------------------------- | ---------------------------------- | ------- |
| 4.6.1 | 挂载时 iframe src="/api/canvas/"             | iframe 元素存在，src 正确          | ❌ 待补 |
| 4.6.2 | A2UIBridge attach/detach 生命周期            | mount 时 attach，unmount 时 detach | ❌ 待补 |
| 4.6.3 | loading → ready 状态机（收到 a2ui:ready）    | 状态从 "loading" 转为 "ready"      | ❌ 待补 |
| 4.6.4 | 5s 超时 → error 状态                         | 未收到 ready 时显示超时错误        | ❌ 待补 |
| 4.6.5 | surfaces 为空 → 自动隐藏（setState "empty"） | visible 设为 false                 | ❌ 待补 |
| 4.6.6 | session 切换时重置 bridge                    | 旧 bridge detach，新 bridge attach | ❌ 待补 |
| 4.6.7 | Debug 面板切换                               | 按钮点击显示/隐藏 CanvasDebugPanel | ❌ 待补 |

### 4.7 CanvasDebugPanel 组件

| #     | 测试场景                  | 预期结果                                      | 状态    |
| ----- | ------------------------- | --------------------------------------------- | ------- |
| 4.7.1 | Messages tab 显示事件日志 | 事件按时间倒序，显示 direction/action/summary | ❌ 待补 |
| 4.7.2 | 点击事件展开 raw JSON     | 展开后显示完整 JSON                           | ❌ 待补 |
| 4.7.3 | Clear 按钮清空事件日志    | eventLog 清空                                 | ❌ 待补 |
| 4.7.4 | 事件计数显示              | 标题显示 "(N)" 计数                           | ❌ 待补 |

### 4.8 Canvas Proxy API

| #     | 测试场景                        | 预期结果                                 | 状态    |
| ----- | ------------------------------- | ---------------------------------------- | ------- |
| 4.8.1 | GET /api/canvas/ 代理到 Gateway | 请求转发 + 响应透传                      | ❌ 待补 |
| 4.8.2 | Bearer token 注入               | 请求头包含 Authorization: Bearer {token} | ❌ 待补 |
| 4.8.3 | BRIDGE_SCRIPT 注入到 HTML 响应  | `</head>` 前插入 script 标签             | ❌ 待补 |
| 4.8.4 | SSRF 防护（路径遍历拒绝）       | `../` 路径返回 400                       | ❌ 待补 |
| 4.8.5 | Gateway 不可用时返回 502        | 无 DECK_GATEWAY_URL 时错误响应           | ❌ 待补 |
| 4.8.6 | 超时 10s + 大小限制 5MB         | 超限返回错误                             | ❌ 待补 |

### 4.9 Gateway HTTP 工具

| #     | 测试场景                                  | 预期结果                                   | 状态    |
| ----- | ----------------------------------------- | ------------------------------------------ | ------- |
| 4.9.1 | `getGatewayHttpUrl` 优先读环境变量        | env 有值时直接返回                         | ❌ 待补 |
| 4.9.2 | env 无值时 fallback 到 DB settings        | 从 runtime.store.getSetting 读取           | ❌ 待补 |
| 4.9.3 | ws:// → http:// 协议转换                  | ws://host → http://host, wss:// → https:// | ❌ 待补 |
| 4.9.4 | 全部无值时返回 null                       | 无 env 无 DB → null                        | ❌ 待补 |
| 4.9.5 | `getGatewayToken` 优先读 env，fallback DB | 与 URL 同逻辑                              | ❌ 待补 |

### 4.10 Artifact Detection（含 bugfix C2/B7/B2）

| #       | 测试场景                                                     | 预期结果                                    | 状态    |
| ------- | ------------------------------------------------------------ | ------------------------------------------- | ------- |
| 4.10.1  | HTML 检测（doctype/html/body 标签）                          | language="html", title 提取                 | ✅ 已有 |
| 4.10.2  | SVG 检测                                                     | language="svg"                              | ✅ 已有 |
| 4.10.3  | Mermaid 代码块检测                                           | language="mermaid", 提取图表内容            | ✅ 已有 |
| 4.10.4  | JSON 检测（>40 chars）                                       | language="json"                             | ✅ 已有 |
| 4.10.5  | 短 JSON 忽略                                                 | 返回 null                                   | ✅ 已有 |
| 4.10.6  | CSV 检测（一致逗号数）                                       | language="csv"                              | ✅ 已有 |
| 4.10.7  | CSV 引号内逗号正确处理（B7）                                 | 引号内逗号不计入分隔符                      | ✅ 已有 |
| 4.10.8  | 不一致 CSV 拒绝                                              | 返回 null                                   | ✅ 已有 |
| 4.10.9  | Markdown 标题检测                                            | `# Title` → language="markdown"             | ✅ 已有 |
| 4.10.10 | Markdown 多特征检测（≥2 种模式）                             | **bold** + [link]() → markdown              | ✅ 已有 |
| 4.10.11 | 单特征文本不误判为 Markdown（B2）                            | 仅含 **bold** → null                        | ✅ 已有 |
| 4.10.12 | Code 检测（需 tool context）                                 | write_file → language="code", codeLang="ts" | ✅ 已有 |
| 4.10.13 | 无 tool context 时 Code 不检测                               | 返回 null                                   | ✅ 已有 |
| 4.10.14 | Markdown 优先于 CSV（含逗号的散文不误判）                    | Markdown 检测排在 CSV 之前                  | ✅ 已有 |
| 4.10.15 | i18n title keys（artifactJson/artifactCsv/artifactMarkdown） | title 使用 i18n key                         | ✅ 已有 |

### 4.11 Artifact Renderers

| #      | 测试场景                                   | 预期结果                                                                 | 状态    |
| ------ | ------------------------------------------ | ------------------------------------------------------------------------ | ------- |
| 4.11.1 | ArtifactPanel 按 language 路由到正确渲染器 | json→JsonTree, csv→TableViewer, markdown→MarkdownViewer, code→CodeViewer | ❌ 待补 |
| 4.11.2 | ArtifactCard 使用 t.has() 渲染 i18n 标题   | i18n key → 翻译文本，非 key → 原文                                       | ❌ 待补 |
| 4.11.3 | JsonTree 递归渲染嵌套对象                  | 可展开/折叠各层级                                                        | ❌ 待补 |
| 4.11.4 | TableViewer CSV 解析 + 表格渲染            | 表头 + 数据行正确显示                                                    | ❌ 待补 |
| 4.11.5 | CodeViewer 行号 + 代码内容                 | 行号与代码对齐                                                           | ❌ 待补 |
| 4.11.6 | MarkdownViewer Markdown→HTML               | ReactMarkdown 渲染正确                                                   | ❌ 待补 |

### 4.12 Block Filter

| #      | 测试场景                                | 预期结果                                          | 状态    |
| ------ | --------------------------------------- | ------------------------------------------------- | ------- |
| 4.12.1 | 默认加载（全部 true）                   | showThinking/showToolUse/showToolResult 均为 true | ✅ 已有 |
| 4.12.2 | localStorage 往返                       | save → load 数据一致                              | ✅ 已有 |
| 4.12.3 | 非 boolean 值拒绝（C2）                 | "yes"/42/null → 回退默认                          | ✅ 已有 |
| 4.12.4 | 部分有效数据混合处理（C2）              | 有效 boolean 保留，无效回退                       | ✅ 已有 |
| 4.12.5 | 损坏 JSON 容错                          | 返回默认值                                        | ✅ 已有 |
| 4.12.6 | 非对象 JSON 容错（数组）                | 返回默认值                                        | ✅ 已有 |
| 4.12.7 | BlockFilterBar 切换按钮改变 preferences | 点击 thinking 按钮 → showThinking 翻转            | ❌ 待补 |

### 4.13 MessageList 消息渲染

| #       | 测试场景                           | 预期结果                                           | 状态    |
| ------- | ---------------------------------- | -------------------------------------------------- | ------- |
| 4.13.1  | 空消息列表显示 empty state         | MessageSquare 图标 + 提示文字                      | ❌ 待补 |
| 4.13.2  | 用户消息右对齐 + 蓝色气泡          | role=user → flex-row-reverse + bg-accent           | ❌ 待补 |
| 4.13.3  | 助手消息左对齐 + Markdown 渲染     | role=assistant → ReactMarkdown 渲染                | ❌ 待补 |
| 4.13.4  | block filter 隐藏 thinking 块      | showThinking=false → thinking 不渲染               | ❌ 待补 |
| 4.13.5  | block filter 隐藏 tool_use 块      | showToolUse=false → ToolUseCard 不渲染             | ❌ 待补 |
| 4.13.6  | 所有 block 被过滤时消息壳不渲染    | 返回 null（避免空气泡）                            | ❌ 待补 |
| 4.13.7  | toolUseNameMap 从原始 content 构建 | 即使 tool_use 被过滤，ToolResultCard 仍有 toolName | ❌ 待补 |
| 4.13.8  | 流式消息显示光标动画               | message.streaming=true → 脉冲光标                  | ❌ 待补 |
| 4.13.9  | 自动滚动到底部（isNearBottom）     | 新消息到达 + 在底部 → scrollTop=scrollHeight       | ❌ 待补 |
| 4.13.10 | 非底部时不自动滚动                 | 用户滚动到上方 → 不强制回底                        | ❌ 待补 |

### 4.14 Message Block 组件

| #      | 测试场景                                | 预期结果                     | 状态    |
| ------ | --------------------------------------- | ---------------------------- | ------- |
| 4.14.1 | ToolUseCard 显示工具名 + 参数           | name 和 input 正确渲染       | ❌ 待补 |
| 4.14.2 | ToolResultCard 成功状态（折叠，✓ 图标） | `<details>` 默认关闭，绿色勾 | ❌ 待补 |
| 4.14.3 | ToolResultCard 错误状态（展开，✗ 图标） | `<details open>`，红色叉     | ❌ 待补 |
| 4.14.4 | ToolResultCard 触发 artifact 检测       | 内容匹配时显示 ArtifactCard  | ❌ 待补 |
| 4.14.5 | ThinkingBlock 可折叠显示                | 默认折叠，点击展开思考内容   | ❌ 待补 |
| 4.14.6 | ImageBlock 缩略图 + lightbox            | 点击放大查看                 | ❌ 待补 |

---

## 5. 集成测试

### 5.1 ChatPanel 集成

| #     | 测试场景                                                  | 预期结果                                        | 状态    |
| ----- | --------------------------------------------------------- | ----------------------------------------------- | ------- |
| 5.1.1 | 完整聊天流程：发送→流式→完成→历史加载                     | 消息正确显示，历史可回溯                        | ❌ 待补 |
| 5.1.2 | Session 切换：A→B→A 无数据污染                            | 各 session 消息独立                             | ❌ 待补 |
| 5.1.3 | 快速切换 session 时 stale fetch guard 生效                | 旧 session 的 fetch 被 cancel，不写入新 session | ❌ 待补 |
| 5.1.4 | RightPanel mode 切换：hidden → canvas → artifact → hidden | 面板正确显示/隐藏                               | ❌ 待补 |
| 5.1.5 | Approval 中断流式：流式中收到 approval → 显示对话框       | 流式继续 + 审批对话框叠加显示                   | ❌ 待补 |

### 5.2 响应式布局

| #     | 测试场景                                   | 预期结果                                 | 状态    |
| ----- | ------------------------------------------ | ---------------------------------------- | ------- |
| 5.2.1 | Desktop (≥1024px)：SessionSidebar 内联     | 左侧固定 sidebar                         | ❌ 待补 |
| 5.2.2 | Compact (<1024px)：SessionSidebar 为 Sheet | 汉堡按钮触发抽屉                         | ❌ 待补 |
| 5.2.3 | RightPanel 打开时 SessionSidebar 隐藏      | rightPanelMode≠"hidden" → sidebar 不渲染 | ❌ 待补 |

---

## 6. 统计与执行策略

### 6.1 覆盖统计

| 类别                     | 总用例  | ✅ 已有 | ❌ 待补 |
| ------------------------ | ------- | ------- | ------- |
| P1 Session State         | 31      | 31      | 0       |
| P2 Tool Progress         | 10      | 5       | 5       |
| P3 Approval              | 12      | 3       | 9       |
| P4 A2UI/Canvas/Artifacts | 65      | 30      | 35      |
| 集成测试                 | 8       | 0       | 8       |
| **合计**                 | **126** | **69**  | **57**  |

### 6.2 优先级分层

**P0（必须补齐 — 核心逻辑无测试）：**

- 4.8 Canvas Proxy API（SSRF 防护 + 认证，安全关键）
- 4.9 Gateway HTTP 工具（配置解析）
- 3.3 SessionSidebar（session 管理核心 UI）

**P1（应补齐 — 用户交互关键路径）：**

- 4.5 RightPanel（拖拽 + 宽度持久化）
- 4.6 CanvasPanel（iframe 生命周期 + 状态机）
- 4.13 MessageList 消息渲染（block filter 集成）
- 3.2 ApprovalDialog（审批按钮交互）

**P2（建议补齐 — 显示类组件）：**

- 4.11 Artifact Renderers（JsonTree/TableViewer/CodeViewer/MarkdownViewer）
- 4.14 Message Block 组件（ToolUseCard/ToolResultCard/ThinkingBlock）
- 4.7 CanvasDebugPanel
- 2.2 ToolProgressBar
- 4.12.7 BlockFilterBar 按钮交互
- 5.x 集成测试

### 6.3 技术选型

| 测试类型       | 工具                               | 适用范围                   |
| -------------- | ---------------------------------- | -------------------------- |
| 纯逻辑单元测试 | Vitest                             | stores, utils, dispatchers |
| React 组件测试 | Vitest + @testing-library/react    | UI 组件渲染 + 交互         |
| API 路由测试   | Vitest + MSW (mock service worker) | Next.js API routes         |
| E2E 集成测试   | Playwright                         | 全流程端到端               |

### 6.4 预估工作量

| 优先级   | 用例数 | 预估时间     |
| -------- | ------ | ------------ |
| P0       | 14     | 2-3 小时     |
| P1       | 25     | 4-5 小时     |
| P2       | 18     | 3-4 小时     |
| **合计** | **57** | **~10 小时** |
