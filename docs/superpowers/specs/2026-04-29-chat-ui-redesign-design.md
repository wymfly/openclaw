# Deck-go Chat 页面 UI 重设计 Spec

**Status:** Draft (pre-Pencil intake)
**Owner:** wangym
**Scope:** 仅 deck-go/frontend `panels/chat/*`，不含 Settings / GatewayPanel / Models / Channels 等其它面板
**Goal:** 给 Pencil/Claude Design 提供一份"可直接喂"的组件 + 状态 + 流程清单，让设计稿一次性覆盖全部 chat 状态而不是只画"主路径漂亮稿"
**Non-goals:**

- 不重写后端 SSE 协议 / chat-api（视觉重设计阶段保持后端契约不动）
- 不改 a2ui-bridge 协议（canvas 通信层冻结）
- 不动 zustand store 结构（仅可加 UI-only 字段）

---

## 0. 现状抽屉式总览

deck-go chat 页面文件分布在 `deck-go/frontend/src/components/panels/chat/`，约 7900 行 .tsx/.ts（不含 **tests**）。下面是按视觉层级分组的现状索引，**所有重设计输出都必须能在这个清单上一一对位**。

| 区块            | 入口文件                                                                                                      |    行数 | 当前职责                                                                                                                               |
| --------------- | ------------------------------------------------------------------------------------------------------------- | ------: | -------------------------------------------------------------------------------------------------------------------------------------- |
| 页面外壳        | `ChatPanel.tsx`                                                                                               |     415 | 三栏栅格 + 右抽屉模式协调（hidden / canvas / artifact）                                                                                |
| 左侧 sidebar    | `SessionSidebar.tsx`                                                                                          |     313 | session 列表 + 内联重命名 + 搜索 + 删除确认 + AgentTabs                                                                                |
| AgentTabs       | `AgentTabs.tsx`                                                                                               |       — | 多 agent 横向切换                                                                                                                      |
| 顶部状态条      | `SSEStatusBanner.tsx`                                                                                         |      22 | SSE connected / reconnecting / disconnected                                                                                            |
| 上下文条        | `ChatContextBar.tsx`                                                                                          |     106 | 当前 session 元信息条（model、context%、tokens）                                                                                       |
| 转录搜索        | `TranscriptSearch.tsx`                                                                                        |     157 | Cmd-F 全文检索高亮                                                                                                                     |
| Block 过滤      | `BlockFilterBar.tsx`                                                                                          |       — | thinking / tool_use / tool_result 显示开关                                                                                             |
| 转录主体        | `MessageList.tsx`                                                                                             |     187 | 消息流 + 流式 thinking 占位 + scroll-anchor                                                                                            |
| 消息分发        | `TranscriptBlocks.tsx` + `transcript-render-registry.tsx`                                                     | 91 + 64 | 8 类 block 分发渲染，tool_use/tool_result 配对                                                                                         |
| 工具调用        | `blocks/ToolUseCard.tsx`                                                                                      |       — | `<details>` 折叠 + JSON copy                                                                                                           |
| 工具结果        | `blocks/ToolResultCard.tsx`                                                                                   |     279 | 4 viewType（raw/bash/read/diff）+ 嵌套 block + ShowRaw 切换 + Artifact 联动 + 文件下载                                                 |
| 工具子视图      | `blocks/{BashResultView,DiffPreview,HighlightedCodeView,VirtualScrollResult,ToolParamView,ShowRawToggle}.tsx` |       — | bash exit/code/stderr 分区、diff 行内染色、>200 行虚拟滚动                                                                             |
| 思考块          | `blocks/ThinkingBlock.tsx`                                                                                    |       — | 折叠态默认收起的 reasoning                                                                                                             |
| 文件 / 图像     | `blocks/{FileBlock,ImageBlock,UnknownBlockCard}.tsx`                                                          |       — | 模态预览 / 内联缩略图 / 未知类型 fallback                                                                                              |
| 画布嵌入        | `blocks/CanvasEmbed.tsx`                                                                                      |       — | 行内 iframe（区别于右侧大 canvas）                                                                                                     |
| Markdown        | `MarkdownText.tsx` + `shared-renderer/MarkdownViewer.tsx`                                                     |     612 | 流式末尾的光标 + 代码块语法高亮                                                                                                        |
| 子 agent 树     | `SubagentTree.tsx` + `SubagentCard.tsx`                                                                       | 130 + — | 多层 lineage（递归 ul/li）                                                                                                             |
| 工具进度        | `ToolProgressBar.tsx`                                                                                         |      90 | 当前 running 工具的横向进度                                                                                                            |
| 运行元数据      | `RunStatusBar.tsx`                                                                                            |       — | per-message：model + tokens (in/out/cache) + cost + duration                                                                           |
| 紧缩通知        | `CompactionNotice.tsx`                                                                                        |       — | tokensBefore → tokensAfter 的折叠提示                                                                                                  |
| 空态            | `EmptyState.tsx`                                                                                              |       — | 无 session 时的引导 + suggestion prompts                                                                                               |
| 输入区          | `MessageInput.tsx`                                                                                            |     693 | 文本框 + 附件 + slash palette + mention popover + ghost hint + 命令 chip + 模板菜单 + canvas/artifact toggle + send/abort + 上下文告警 |
| 审批            | `ApprovalDialog.tsx`                                                                                          |     139 | 内联在输入区上方的 approval 决策（allow-once / always / deny + 倒计时）                                                                |
| 干预            | `SteerDialog.tsx`                                                                                             |       — | 在流式期间向 agent 注入 steering 提示                                                                                                  |
| 命令面板        | `SlashCommandPalette.tsx`                                                                                     |     225 | 三种模式：filter / argOptions / tag                                                                                                    |
| Mention popover | `MentionPopover.tsx`                                                                                          |       — | @agent 候选                                                                                                                            |
| 模板菜单        | `PromptTemplateMenu.tsx`                                                                                      |       — | 预置 prompt 插入                                                                                                                       |
| Session config  | `SessionConfigBar.tsx`                                                                                        |     156 | model 选择、fastMode、reasoningLevel、sendPolicy                                                                                       |
| Message actions | `MessageActions.tsx`                                                                                          |       — | 复制全文 / 重发 / 反馈                                                                                                                 |
| 右抽屉外壳      | `RightPanel.tsx`                                                                                              |      78 | 可拖拽 resize（min 320 / max 800）                                                                                                     |
| 画布面板        | `CanvasPanel.tsx`                                                                                             |     338 | iframe + a2ui-bridge + 4 状态 + 调试覆盖 + retry                                                                                       |
| 画布调试        | `CanvasDebugPanel.tsx`                                                                                        |     110 | 树检视器 / 事件流调试                                                                                                                  |
| 工件卡          | `artifacts/ArtifactCard.tsx`                                                                                  |      25 | 内联在 transcript 内的"打开"入口                                                                                                       |
| 工件面板        | `artifacts/ArtifactPanel.tsx`                                                                                 |      78 | 头部按钮（下载 / 复制 / 全屏 / 关闭）+ 共享渲染器                                                                                      |
| 工件检测        | `artifacts/detectArtifact.ts`                                                                                 |     217 | 从 tool_result 内容启发式识别 artifact                                                                                                 |
| 共享渲染器      | `shared-renderer/{SharedRenderer,CodeViewer,JsonTree,MarkdownViewer,TableViewer,download,srcdoc}.{ts,tsx}`    |       — | code / json / markdown / table 多媒介统一入口                                                                                          |

---

## 1. 设计目标与约束

### 1.1 核心目标

1. **状态全覆盖**：8 类 block × 4 状态（loading / streaming / done / failed）+ 6 类 session 状态 + 3 类 SSE 状态 + 4 类 canvas 状态 + N 类 popover/dialog 全部有可视交付。
2. **信息密度可调**：保留"工程师模式"的密集态（窄行高、轻边框），同时给"演示模式"留一档舒适密度。
3. **流式视觉稳定**：流式过程中已绘制的内容**字节级**不重排（避免读到一半被推走），新内容只在尾部追加。
4. **暗色优先 + 浅色对等**：deck-go 当前 theme.css 暗色优先；浅色稿不可作为"二等公民"。
5. **可访问性兜底**：键盘可达性（Tab/方向键 / Enter / Esc / Cmd-F）+ 可见焦点环 + 颜色对比度 ≥ 4.5:1。

### 1.2 不变量（硬约束）

| #   | 约束                                                                                                                                                                      | 理由                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| H1  | 不引入新的 npm 依赖（除非为现有未用包替代）                                                                                                                               | 体积 + 安全审计成本             |
| H2  | 不改 SSE 协议字段名（`run_started/text_delta/tool_use_started/...`）                                                                                                      | 兼容 OpenClaw Gateway           |
| H3  | 不改 a2ui-bridge postMessage schema                                                                                                                                       | canvas 由 OpenClaw Gateway 推送 |
| H4  | 不动 store 结构（`useChatStore` 现有 sessions / sessionMetas / sessionPreviewOverlays / activeApproval / a2uiState / canvasCommands / runMetadata / toolProgress 等字段） | 跨面板共享                      |
| H5  | 不改 i18n key 命名（保留 `t("chat.*")` / `t("approvals.*")`）                                                                                                             | 翻译已就位                      |
| H6  | block 类型严格遵循 `ContentBlock` discriminated union（text / thinking / tool_use / tool_result / image / file / canvas / unknown）                                       | TS 类型契约                     |
| H7  | 所有可视化稿必须能由 `?deckVisualState=chat-rich` / `chat-empty` 在 `:4174` 复现                                                                                          | E2E + 视觉回归                  |

### 1.3 可松动项

- CSS class 命名（`deck-ui-*`）可做有限重命名，但同时改 theme.css + tests。
- 现有 layout 用 grid，可以切到 flex/CSS subgrid，但断点策略需重写。
- 图标库（`@/deck-ui/icons`）可整体替换为 lucide-react / radix-icons，但要一次性。

---

## 2. 页面骨架

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [SSE Banner] ← only when status ≠ connected                                  │
├──────────┬───────────────────────────────────────────┬───────────────────────┤
│          │ [ChatContextBar]                          │                       │
│          │ [Steer shortcut button] (if streaming)    │                       │
│          │ [TranscriptSearch] (if Cmd-F pressed)     │                       │
│          │                                           │                       │
│ Session  │ ┌───── Transcript (MessageList) ─────┐   │  RightPanel           │
│ Sidebar  │ │ Compaction notice                  │   │  (mode = canvas |     │
│  ┌────┐  │ │ ┌─ MessageBubble (user) ─┐         │   │   artifact | hidden)  │
│  │Tabs│  │ │ │ avatar + body + time   │         │   │                       │
│  │+New│  │ │ └────────────────────────┘         │   │  resize handle (left) │
│  │Srch│  │ │ ┌─ MessageBubble (assistant) ──┐   │   │                       │
│  │... │  │ │ │ thinking → tool_pair → text  │   │   │                       │
│  │    │  │ │ │ run-status-bar               │   │   │                       │
│  │rows│  │ │ │ message-actions              │   │   │                       │
│  │    │  │ │ └──────────────────────────────┘   │   │                       │
│  │    │  │ │ [Subagent tree] (if any children)  │   │                       │
│  │foot│  │ │ [waiting-thinking] (streaming)     │   │                       │
│  └────┘  │ └────────────────────────────────────┘   │                       │
│          │ [BlockFilterBar] (if any thinking/tool)  │                       │
│          │ [SteerDialog] (if streaming)             │                       │
│          │ [ToolProgressBar] (if running tools)     │                       │
│          │ [SessionConfigBar]                       │                       │
│          │ ┌────── MessageInput (composer) ──────┐  │                       │
│          │ │ [ApprovalDialog] (if active)        │  │                       │
│          │ │ [Context-warning] (if ≥95%)         │  │                       │
│          │ │ [FileAttachmentBar]                 │  │                       │
│          │ │ [+] [textarea + popovers] [...]    │  │                       │
│          │ │ [Template] [Canvas] [Artifact] [Send│Abort] │                  │
│          │ └─────────────────────────────────────┘  │                       │
└──────────┴───────────────────────────────────────────┴───────────────────────┘
```

**栅格规则：**

- Sidebar：固定 `260px`（移动端折叠为抽屉）
- Main：`1fr`，最小 `560px`（小于阈值时右抽屉自动浮窗化覆盖）
- RightPanel：从 localStorage 读取，clamp `[320, 800]`，default `480`
- 顶部 banner / 上下文条 / 搜索条 → 按需占位，不挤压主体高度（用 sticky 而非 push）

**断点（提案）：**

- `≥ 1280px`：三栏并排
- `1024–1279px`：右抽屉变浮层（覆盖 50% main 宽度，关闭即恢复）
- `768–1023px`：sidebar 收起为汉堡图标
- `< 768px`：sidebar 抽屉化，右抽屉占满主区，三态互斥

---

## 3. 左侧 SessionSidebar

### 3.1 结构

```
[AgentTabs]            ← agent ID 横向 tabs（最多 N，溢出滚动）
[+ 新建 Session]
[搜索框]
─────────────────────
[Session row]          ← 当前选中：高亮背景
  title (editable on dblclick)
  preview (overlay > server lastMessagePreview)
  updated time
  [删除按钮]            ← hover 出现
...
─────────────────────
footer: "Default agent: <id>"
```

### 3.2 状态变体（必须设计稿全覆盖）

| 状态                 | 触发                                           | 视觉差异                       |
| -------------------- | ---------------------------------------------- | ------------------------------ |
| empty                | `sessionMetas.length === 0`                    | 显示 EmptyState 引导 + 空 list |
| filtered-empty       | search 过滤后无命中                            | "无结果"占位                   |
| streaming-row        | row 对应 session.isStreaming                   | 标题前 dot + 慢闪动            |
| selected-row         | `activeSessionKey === row.key`                 | 背景高亮                       |
| renaming-row         | `editingKey === row.key`                       | inline `<input>` 替换 title    |
| pending-rename       | rename 中（async）                             | input disabled + spinner       |
| delete-confirm       | `deleteTarget != null`                         | 模态确认（小型 dialog）        |
| long-title           | title 字符数 > 实际宽度                        | ellipsis + tooltip             |
| bilingual-title      | 中英混排（如 visual-seed `visual-long-title`） | 不撞删除按钮                   |
| unread-badge（未来） | 新消息且非选中                                 | preview 后小圆点               |

### 3.3 交互

- 单击 → setActiveSession
- 双击 title → 进入 rename
- Enter / Esc 在 rename 中 → 提交 / 取消
- 右键（未实现） → 上下文菜单（未来扩展）
- Hover row → 显示删除按钮（避免误触）
- 拖拽（未实现） → 重排（未来扩展，建议先不画）

---

## 4. 主区 Top Bands（顶部叠层）

### 4.1 SSEStatusBanner

| status         | 视觉                                |
| -------------- | ----------------------------------- |
| `connected`    | 不渲染（不占空间）                  |
| `reconnecting` | 黄色横条 + Wifi-off 图标 + 慢闪 dot |
| `disconnected` | 红色横条 + Wifi-off 图标 + 静止     |

需要 Pencil 给的：3 个状态 × 2 主题（暗 / 浅）= 6 张稿。

### 4.2 ChatContextBar

| 元素             | 数据                            |
| ---------------- | ------------------------------- |
| Model 名         | `gpt-5.4` / `sonnet-4.6` 等     |
| Context bar      | `tokens / contextWindow` 进度条 |
| Compaction count | 已压缩次数                      |
| Fast mode chip   | `fastMode === true`             |
| Reasoning level  | `low / medium / high / stream`  |
| Send policy      | `allow / confirm / deny`        |

需要：bar 满 30% / 70% / 95% 三档（≥95% 触发 composer 警告）。

### 4.3 TranscriptSearch（Cmd-F 触发）

- 输入框 + 当前/总数计数 + ↑↓ 跳转 + 关闭
- 匹配结果在 transcript 内黄色高亮（保留滚动锚点）
- 状态：collapsed（不显示）/ open-empty / open-typing / open-with-matches / open-no-matches

---

## 5. 转录主体 MessageList

### 5.1 消息容器（MessageBubble）

```
┌─ frame ─────────────────────────────────┐
│ [avatar] body                            │
│          ├─ TranscriptBlocks             │
│          ├─ error chip (if message.error)│
│          ├─ RunStatusBar (assistant)     │
│          ├─ partial-result chip          │
│          ├─ timestamp                    │
│          └─ MessageActions (assistant)   │
└──────────────────────────────────────────┘
```

### 5.2 角色变体

| role                        | 头像     | 边框/底色            | 对齐                                         | actions            |
| --------------------------- | -------- | -------------------- | -------------------------------------------- | ------------------ |
| user                        | UserIcon | accent-tinted        | 右对齐？或左对齐统一？（**待定，见 §13.2**） | 无                 |
| assistant                   | BotIcon  | neutral surface      | 左对齐                                       | 复制 / 重发 / 反馈 |
| system (compaction)         | —        | dashed border banner | 居中                                         | 无                 |
| system (slash command echo) | —        | 同上                 | 居中                                         | 无                 |

### 5.3 消息状态变体

| 状态                  | 触发                                         | 视觉信号                                                               |
| --------------------- | -------------------------------------------- | ---------------------------------------------------------------------- |
| streaming             | `message.streaming === true`                 | MarkdownText 末尾闪烁光标 + thinking-block 默认展开                    |
| done                  | streaming false 且无 error                   | 静态                                                                   |
| failed                | `message.error` 非空                         | error chip + 边框红色                                                  |
| partial-result        | 非 user + streaming + sessionStreaming false | partial-result chip（说明数据源切换了，run 已结束但 message 还在追加） |
| stale-on-load         | 历史会话刚载入                               | 同 done，但 RunStatusBar 不显示流式总计                                |
| compacted-precedessor | 出现在 compaction 之前                       | 视觉密度更紧凑（淡化）                                                 |

### 5.4 流式 waiting placeholder

`isStreaming && !messages.some(m => m.streaming)` → 渲染 `[Bot avatar] thinking...`。
此时 transcript 内所有消息都已 done，正在等下一次 run 的 first-token。

需要：等待态 stub × 2（首次 vs reconnect 后）。

---

## 6. Block 渲染矩阵（核心）

### 6.1 类型清单（来自 `transcript-render-registry.tsx`）

| ContentBlock.type | 渲染器             | 内嵌于 tool_result 时也能渲染 |
| ----------------- | ------------------ | ----------------------------- |
| text              | `MarkdownText`     | 是 → 退化为 `<pre>` 原文      |
| thinking          | `ThinkingBlock`    | 是                            |
| tool_use          | `ToolUseCard`      | 是（嵌套）                    |
| tool_result       | `ToolResultCard`   | 是（嵌套）                    |
| image             | `ImageBlock`       | 是                            |
| file              | `FileBlock`        | 是                            |
| canvas            | `CanvasEmbed`      | 是（行内 iframe）             |
| unknown           | `UnknownBlockCard` | 是                            |

**配对规则**（`TranscriptBlocks.tsx`）：tool_use 紧邻 tool_result 时渲染为 `tool-pair`，结果块从外层消失。

### 6.2 Block 状态变体（每类 ≥4 状态）

#### 6.2.1 text

| 变体                | 触发                                   | 视觉                           |
| ------------------- | -------------------------------------- | ------------------------------ |
| user-plain          | `isUser`                               | `<p>` 纯文本                   |
| assistant-markdown  | `!isUser`，非流式                      | 完整 markdown 渲染             |
| assistant-streaming | `streaming && index === lastTextIndex` | 末尾闪烁光标                   |
| empty-text          | text === ""                            | 不渲染（不留空 div）           |
| oversized           | length > 10000 字符                    | 折叠 + "展开" 按钮（建议新增） |

#### 6.2.2 thinking

| 变体              | 视觉                                                     |
| ----------------- | -------------------------------------------------------- |
| collapsed-default | `<details>` 收起，summary 显示 "Thinking"                |
| expanded          | 展开正文                                                 |
| streaming         | 默认展开 + 末尾光标                                      |
| filtered-out      | `blockPrefs.showThinking === false` → 不渲染（不占空间） |

#### 6.2.3 tool_use

| 变体                                 | 视觉                                 |
| ------------------------------------ | ------------------------------------ |
| running（不在 store 中已 completed） | 顶部小转圈 + summary 显示 input 摘要 |
| completed-default-collapsed          | `<details>` 收起                     |
| completed-expanded                   | 展开 ToolParamView                   |
| no-input                             | input 为空 → 不渲染 ToolParamView    |
| copy-feedback                        | 点 Copy 后 2s 内显示 "Copied"        |

#### 6.2.4 tool_result

最复杂的一类，4 个 viewType × 多状态：

| viewType      | 触发                                       | 子组件                                            |
| ------------- | ------------------------------------------ | ------------------------------------------------- |
| `bash`        | `isBashTool(toolName)`                     | BashResultView（exitCode / stdout / stderr 分栏） |
| `read`        | `isFileOpTool === "read"`                  | HighlightedCodeView（语法高亮）                   |
| `read-image`  | `read` + 文件扩展是 `gif/jpg/png/svg/webp` | `<img>` 缩略图 + lazy-load                        |
| `read-binary` | `read` + `isBinaryContent`                 | "Binary file" 占位                                |
| `diff`        | `isFileOpTool === "write" / "edit"`        | DiffPreview（行内 +/- 染色）                      |
| `raw`         | else / showRaw / 嵌套 block                | `<pre>` 或 VirtualScrollResult（>200 行）         |

每个 viewType 都需要：

- default 态
- isError 态（红色边框 + 默认展开 + "!" 图标）
- ShowRaw 切换态（用户主动切回原文）
- artifact 联动态（detectArtifact 命中 → 下方挂 ArtifactCard）
- file-download 态（read-image / diff 且有 filePath → 下载链接）

#### 6.2.5 image

| 变体                | 视觉                              |
| ------------------- | --------------------------------- |
| inline-thumbnail    | 默认                              |
| modal-preview       | 点击放大（待确认是否实现）        |
| broken-load         | onError fallback "broken image"   |
| transcript-attached | 用户上传作为附件（user 消息一侧） |

#### 6.2.6 file

| 变体                | 视觉                        |
| ------------------- | --------------------------- |
| file-meta-card      | 文件名 + 大小 + 图标 + 下载 |
| inline-text-preview | 小文件直接渲染前 N 行       |
| binary-file         | "Binary file，仅支持下载"   |

#### 6.2.7 canvas（block 内嵌）

| 变体                | 视觉                                           |
| ------------------- | ---------------------------------------------- |
| inline-iframe       | 行内 iframe，固定高度 + sandbox                |
| collapsed-thumbnail | 仅显示标题 + "在右侧打开" 按钮（**新增建议**） |

#### 6.2.8 unknown

| 变体           | 视觉                            |
| -------------- | ------------------------------- |
| default        | "未知类型: <rawType>" + summary |
| dev-only debug | 显示完整 raw（仅 dev mode）     |

---

## 7. Tool ladder 完整流程

工具调用是 chat 页面信息密度最高的区域。下面是一次工具调用从触发到落地的完整 UI 时间线，**Pencil 必须按顺序出 8-10 帧动效**：

```
T0  User 发送消息 → composer 清空
T1  Server: run_started → waiting placeholder 出现（"thinking..."）
T2  Server: text_delta → assistant bubble 出现，text 流式追加（光标闪）
T3  Server: thinking_started → thinking block 默认展开，文本流入
T4  Server: tool_use_started → 在 thinking 之后插入 ToolUseCard（running 态）
                              → 同时 ToolProgressBar 顶部出现该工具
T5  Server: tool_use_completed → ToolUseCard 状态切到 completed
T6  Server: tool_result → 紧接 ToolUseCard 渲染 ToolResultCard
                       → viewType 自动判断（bash/read/diff/raw）
                       → 若命中 artifact → 下方挂 ArtifactCard
                       → ToolProgressBar 该工具消失
T7  Server: text_delta（继续）→ assistant 接着流式
T8  Server: run_completed → message.streaming = false，光标消失
                          → RunStatusBar 显示最终 tokens / cost / duration
T9  （可能）approval_required → ApprovalDialog 出现在 composer 上方（阻断式）
T10 用户决策 → ApprovalDialog 消失 → 流程继续
```

需要 Pencil 设计：每帧的视觉状态都要有独立稿，且 T2/T7 的"光标位置"必须精确到字符尾部。

---

## 8. 输入区 Composer

### 8.1 结构层级

```
┌─ MessageInput container ──────────────────────────┐
│ [ApprovalDialog]    ← if activeApproval           │
│ [Context warning]   ← if usage ≥ 95%             │
│ [FileAttachmentBar] ← if files.length > 0        │
│ [+ attach]                                        │
│ ┌─ composer-field ─────────────────────────────┐ │
│ │ [SlashPalette]        ← popover               │ │
│ │ [MentionPopover]      ← popover               │ │
│ │ [ghost-hint]          ← inline overlay        │ │
│ │ [/cmd chip]           ← if activeTag          │ │
│ │ [textarea]                                    │ │
│ └───────────────────────────────────────────────┘ │
│ [Template] [Canvas] [Artifact] [Send | Abort]    │
└───────────────────────────────────────────────────┘
```

### 8.2 状态矩阵

| 状态                 | 触发                        | 关键视觉                                  |
| -------------------- | --------------------------- | ----------------------------------------- |
| idle-empty           | 无文本 + 无附件 + 非流式    | placeholder + send disabled               |
| typing               | 有文本                      | send enabled                              |
| typing-with-files    | 文本 + 附件                 | 附件 chip 列表可见                        |
| drag-over            | dragOver 中                 | 边框高亮 + drop overlay                   |
| oversize-attachment  | 文件 > MAX_ATTACHMENT_BYTES | toast + setSessionError                   |
| streaming            | `isStreaming === true`      | send 替换为 abort                         |
| sending（in-flight） | `isSending === true`        | 按钮 disabled + spinner                   |
| context-critical     | `contextPct ≥ 95`           | 顶部黄/红 warning                         |
| slash-palette-open   | `slash.showPalette`         | popover 浮于 textarea 上方                |
| slash-arg-options    | 子模式                      | palette 内切换为 arg 选项                 |
| slash-tag-mode       | 选中后保留为 chip           | chip + placeholder 改为 cmdTagPlaceholder |
| ghost-hint           | slash 部分匹配              | textarea 内灰色 hint 文本（不可编辑）     |
| mention-popover      | `@` 触发                    | 候选 agent 列表                           |
| approval-pending     | activeApproval              | dialog 阻断在 composer 上方               |
| approval-resolving   | resolving=true              | 按钮 disabled                             |
| approval-countdown   | expiresAtMs 设置            | 倒计时数字每秒刷新                        |
| approval-multi       | pendingCount > 1            | "X pending" badge                         |
| input-history-up     | ArrowUp 在空文本时          | 调出最近输入                              |
| paste-files          | 粘贴板含 files              | 自动入附件列表                            |

### 8.3 Slash Palette 三模式

| 模式         | 进入                   | UI 差异                                                       |
| ------------ | ---------------------- | ------------------------------------------------------------- |
| `filter`     | 输入 `/` 后追加文字    | 命令列表 + 上下方向键导航                                     |
| `argOptions` | 选中需要参数选择的命令 | 切换为参数候选（如 `/model <name>`）                          |
| `tag`        | 选中 tag-mode 命令     | palette 关闭，命令变为 chip 留在 input 内，textarea 接受 args |
| `immediate`  | 选中无参命令           | 直接执行 + 关闭                                               |

每种模式都需要：

- empty-filter（无匹配）
- many-results（>10 行的滚动样式）
- selected-row（焦点行高亮）
- visibility-context（streaming 时禁用部分命令的灰显）

---

## 9. ApprovalDialog（内联模态）

```
┌─ approval-dialog ─────────────────────────────────┐
│ [shield] Tool approval     [⏰ 1m 23s] [3 pending]│
│                                                    │
│ ╔════ tool name ════╗                              │
│ ║ shell_command    ║                               │
│ ╚══════════════════╝                               │
│ ┌─ command ─────────┐                              │
│ │ pnpm openclaw ... │                              │
│ └───────────────────┘                              │
│                                                    │
│ Agent: main · cwd: /workspace/openclaw              │
│                                                    │
│ [✓ Allow once] [🛡 Allow always] [✗ Deny]         │
└────────────────────────────────────────────────────┘
```

状态：

- default
- countdown < 30s（红色倒计时）
- expired（自动消失，对应 store 清理）
- resolving（按钮 disabled + spinner）
- multi-pending（badge 显示 3 等待）
- description-only（无 command 时显示 description 段）
- no-cwd / no-agent（dl 不渲染）

---

## 10. 右抽屉（CanvasPanel / ArtifactPanel）

### 10.1 共享外壳（RightPanel）

- 左边一根 4px resize handle，cursor: col-resize
- 头部高度固定 40px
- 底部不留 padding（让内容铺满）
- 关闭按钮在 header 右上

### 10.2 CanvasPanel 4 状态

| state     | 视觉                                                                  |
| --------- | --------------------------------------------------------------------- |
| `loading` | iframe 已挂载但 bridge 未 ready，覆盖层 spinner + "Loading canvas..." |
| `ready`   | iframe 可见，无覆盖                                                   |
| `error`   | iframe 隐藏，覆盖层 error 图标 + "Reload" 按钮                        |
| `empty`   | iframe 隐藏，覆盖层 "No canvas yet" placeholder                       |

附加：

- debug-overlay（点 bug 图标） → CanvasDebugPanel 浮在底部
- session-switch-during-load → bridge.reset() + state=loading
- visual-seed mode → 注入 data:URI（只 dev/test/E2E）

### 10.3 ArtifactPanel

| 区域   | 元素                                                      |
| ------ | --------------------------------------------------------- |
| Header | title · language · [download] [copy] [fullscreen] [close] |
| Body   | SharedRenderer（按 detectArtifact 推断的 medium）         |

SharedRenderer 内部分发（`shared-renderer/SharedRenderer.tsx`）：

- code → CodeViewer（行号 + 高亮）
- markdown → MarkdownViewer（与 chat 主区 markdown 同源）
- json → JsonTree（折叠节点）
- table → TableViewer（首行 sticky）
- html / svg → srcdoc iframe
- image / pdf / 其它 → fallback download

每种 medium 需要：default / loading / oversize / parse-error 4 态。

### 10.4 抽屉切换（关键）

- canvas / artifact 互斥（同一时刻最多显示一种）
- 打开 artifact 时若 canvas 处于 visible，自动 setA2UIState({visible:false}) 并 persist
- 关闭 canvas 时也要 persist a2uiState
- session 切换时 → setRightPanelMode("hidden") + activeArtifact=null

---

## 11. 周边小组件状态

| 组件               | 关键状态                                                                        |
| ------------------ | ------------------------------------------------------------------------------- |
| BlockFilterBar     | thinking/tool_use/tool_result 三 toggle，仅当 transcript 含相关 block 时显示    |
| ToolProgressBar    | 0 工具（不显示）/ 1 工具（行内）/ N 工具（滚动）/ 已完成 fadeout                |
| RunStatusBar       | meta-only（model）/ meta+streaming-totals / meta+final-totals / no-meta（隐藏） |
| CompactionNotice   | tokensBefore → tokensAfter，用户可点击展开看历史                                |
| EmptyState         | 无 session 引导（含 4 条 suggestion prompt）                                    |
| SubagentTree       | 无 lineage（隐藏）/ 加载中 / 树结构（含递归层级缩进）                           |
| MessageActions     | 复制 / 重发 / 反馈（thumb up/down）                                             |
| SteerDialog        | hidden / open-streaming / sending / sent feedback                               |
| SessionConfigBar   | model 选择（dropdown）/ fastMode toggle / reasoningLevel 选择 / sendPolicy 选择 |
| AgentTabs          | 单 agent（隐藏 tab）/ 多 agent（横向滚动）                                      |
| PromptTemplateMenu | dropdown，选中插入到 textarea 末尾                                              |

---

## 12. 主题与设计 token

### 12.1 当前 theme.css 已有 token

读取自 `deck-go/frontend/src/theme.css`（**Pencil 应在 get_style_guide 时锁定这套 token**）。建议主题策略：

- **暗色 baseline** → 现有 token 不动（保 E2E 视觉基线稳定）
- **浅色等价** → 仅交付一份变量映射表，不改使用方
- **density 切换** → 通过 `data-density="compact" | "comfortable"` 在 `<body>` 控制行高/边距倍率

### 12.2 颜色语义槽（必须在 Pencil 内固定）

| 语义                                  | 用途                                          |
| ------------------------------------- | --------------------------------------------- |
| `surface-1 / 2 / 3`                   | sidebar / main / right drawer                 |
| `text-primary / secondary / tertiary` | 三级文字                                      |
| `accent`                              | 选中态 / 链接 / send 按钮                     |
| `success`                             | tool ok / approval allow                      |
| `warn`                                | context ≥80% / SSE reconnecting               |
| `error`                               | tool error / SSE disconnected / approval deny |
| `border-subtle / strong`              | 边框分级                                      |
| `code-bg / code-border`               | 代码块                                        |
| `cursor-color`                        | 流式光标                                      |

### 12.3 字体 / 间距

- 正文：14px / 1.5（compact: 13px / 1.45）
- 代码：13px / monospace
- 按钮 hit area：≥ 32×32（移动端 ≥ 44）
- 圆角：`--radius-sm: 4px / md: 6px / lg: 10px`

---

## 13. 待决问题（必须设计稿决前确认）

### 13.1 Layout

- [ ] sidebar 是否支持折叠为图标列（≥1280 时仍可手动折叠）？
- [ ] 右抽屉浮窗化时是否带阴影 / 半透明遮罩？
- [ ] 转录区是否引入"消息分组日期分隔条"？

### 13.2 消息对齐

- [ ] **关键决策**：user 消息靠左还是靠右？
  - 靠右（IM 风格）→ 需要重写 bubble class
  - 靠左（终端风格）→ 与现有 `is-user` 一致
- 推荐 Pencil 出两种方案对比

### 13.3 Tool 卡片视觉

- [ ] tool_use + tool_result 是否合并为一张"配对卡片"（去掉两层 details）？
- [ ] viewType 切换是否需要 segmented control（raw / bash / read / diff）？

### 13.4 Artifact

- [ ] 是否支持 artifact 历史（侧栏列表 → 切换查看）？
- [ ] 全屏态是否覆盖整个 chat 区还是覆盖整个浏览器？

### 13.5 Canvas

- [ ] error 态是否提供"以 raw URL 在新标签打开"逃生口？
- [ ] empty 态文案要不要给"等待 agent 推送内容..."的进度提示？

### 13.6 通用

- [ ] 是否引入 motion 系统（framer-motion）做流式光标 / 抽屉展开 / palette 浮入动效？
- [ ] 是否需要 hover 态预览（如 tool_use summary hover 显示完整 input）？

---

## 14. Pencil 喂稿清单

下面是按 Pencil `batch_design` 分批的"任务包"，每包列出**目标节点 + baseline screenshot + 必须覆盖的状态**。预计总共 6-8 个 batch。

### Batch P0 — 设计系统 + 骨架

- [ ] 锁定 style guide tag（Pencil `get_style_guide_tags` → 选 `developer-tool` 或 `minimal-saas-dashboard`）
- [ ] 三栏主骨架（sidebar / main / right drawer hidden）
- [ ] 三栏 + canvas drawer
- [ ] 三栏 + artifact drawer
- [ ] 浮窗模式（窄屏断点）
- [ ] sidebar 折叠为图标
- baseline：`http://127.0.0.1:4174/?deckVisualState=chat-rich`

### Batch P1 — 消息与 block 矩阵

- [ ] user 消息 4 态（plain / with-files / with-image / oversized-text）
- [ ] assistant 消息 5 态（streaming / done / failed / partial-result / no-meta）
- [ ] thinking block 4 态（collapsed / expanded / streaming / filtered）
- [ ] tool_use card 4 态（running / completed-collapsed / completed-expanded / copied）
- [ ] tool_result × 4 viewType × 2 主题（共 8 张 + 嵌套 block 1 张）
- [ ] image / file / canvas-inline / unknown 各 1 张
- [ ] tool_pair（use+result 配对）2 张：success / error
- [ ] compaction notice
- [ ] subagent tree（深度 1 / 2 / 3）

### Batch P2 — 状态条与流式时间线

- [ ] SSE banner 3 态
- [ ] ChatContextBar 3 档（30% / 70% / 95%）
- [ ] TranscriptSearch 4 态
- [ ] 流式时间线 8 帧（T1–T8 见 §7）
- [ ] waiting placeholder 2 态

### Batch P3 — Composer + Approval

- [ ] composer 12 态（见 §8.2）
- [ ] SlashPalette 4 模式
- [ ] MentionPopover 3 态（empty / with-results / no-match）
- [ ] PromptTemplateMenu open
- [ ] ApprovalDialog 5 态（default / countdown / multi-pending / resolving / expired）
- [ ] FileAttachmentBar（0 / 1 / N 个文件 + oversize）

### Batch P4 — 抽屉

- [ ] CanvasPanel 4 态 + debug overlay
- [ ] ArtifactPanel × 5 medium（code / markdown / json / table / html）
- [ ] ArtifactPanel 全屏态
- [ ] resize handle hover / dragging

### Batch P5 — 边缘 / 错误

- [ ] EmptyState（无 session）
- [ ] sidebar empty / filtered-empty
- [ ] toast 三种（info / success / error）
- [ ] context-critical warning
- [ ] reconnect 后的恢复流程

每个 batch 必须附 baseline 截图（步骤：`scripts/dev/run-stack-real.sh start` → 浏览 `:4174` → Cmd-Shift-4 截图 → 拖入 Pencil `batch_design` 的 reference 字段）。

---

## 15. 验收标准

### 15.1 设计稿层级

- [ ] 每个组件都至少有 4 状态稿（不接受"主路径漂亮稿"占位）
- [ ] 暗色稿和浅色稿一一对应
- [ ] 所有图层带语义命名（`message-bubble/assistant/streaming` 而非 `Group 12`）
- [ ] 颜色全部引用 design system token，无 raw hex
- [ ] 字体全部引用 type token，无 raw px

### 15.2 实施前的过 gate

- [ ] 与 `:4174` baseline 一比一对照，能逐组件指出差异
- [ ] §13 待决问题全部 resolved
- [ ] 不破 §1.2 任何硬约束
- [ ] code-reviewer agent 走过一遍"对齐性 review"

### 15.3 实施后的视觉回归

- [ ] `?deckVisualState=chat-rich` 截图与设计稿误差 < 5%（structural diff）
- [ ] `?deckVisualState=chat-empty` 同上
- [ ] E2E：`scripts/dev/run-stack-real.sh start` 后手动跑一轮（chat → tool → approval → artifact → canvas）
- [ ] Lighthouse a11y ≥ 95

---

## 16. 后续路线图衔接

本 spec 仅覆盖**视觉重设计**。后续需要单独立 spec 的项：

| 后续 spec                   | 触发条件                                                                  |
| --------------------------- | ------------------------------------------------------------------------- |
| chat-go-api-optimization    | 视觉稿落地后，根据新 UI 暴露的数据缺口反推 API 修订                       |
| openclaw-gateway-adaptation | UI 需要的数据 Gateway 不提供时（如 message edit 历史、tool param schema） |
| chat-virtualization         | 历史长 transcript 性能优化（>500 messages）                               |
| chat-mobile                 | 触屏 / < 768px 完整体验（本 spec 仅给布局占位）                           |
| chat-i18n-pass              | 翻译键审计 + RTL 支持                                                     |

---

## 附录 A — 现有 i18n key 索引（部分）

为防止 Pencil 设计稿出现假翻译键，以下是 chat 命名空间已存在的 key（来源 `frontend/src/messages/<locale>.json`）：

`chat.steerQuickAccess`, `chat.toolCall`, `chat.toolResult`, `chat.toolError`, `chat.copyJson`, `chat.copied`, `chat.partialResult`, `chat.thinking`, `chat.noMessages`, `chat.canvasTitle`, `chat.canvasLoading`, `chat.canvasError`, `chat.canvasEmpty`, `chat.canvasRetry`, `chat.canvasCollapse`, `chat.canvasToggle`, `chat.artifactToggle`, `chat.openArtifact`, `chat.artifactCopy`, `chat.artifactDownload`, `chat.artifactFullscreen`, `chat.artifactClose`, `chat.send`, `chat.abort`, `chat.placeholder`, `chat.cmdTagPlaceholder`, `chat.cmdTagRemove`, `chat.contextWarning`, `chat.attachFiles`, `chat.fileAttachments`, `chat.binaryFile`, `chat.error`, `chat.toastCommandFailed`, `chat.toastUnknownCommand`, `chat.toastNewSession`, `chat.toastStopped`, `chat.toastStopFailed`, `chat.newSession`, `chat.searchSessions`, `chat.deleteConfirmTitle`, `chat.deleteConfirmMessage`, `chat.deleteConfirmCancel`, `chat.deleteConfirmOk`, `chat.defaultAgent`, `chat.subagents`, `chat.subagentLoading`, `chat.sseReconnecting`, `chat.sseDisconnected`, `chat.debugTitle`

`approvals.inlineTitle`, `approvals.approve`, `approvals.approveAlways`, `approvals.deny`, `approvals.agent`, `approvals.pendingBadge`

---

## 附录 B — 视觉 seed 一键启动

```bash
# 真 Gateway 全栈（推荐）
cd deck-go && scripts/dev/run-stack-real.sh start

# 直接进入 visual seed
open "http://127.0.0.1:4174/?deckVisualState=chat-rich"
open "http://127.0.0.1:4174/?deckVisualState=chat-empty"
```

`chat-rich` 已经预置了：streaming + approval + canvas + compaction + tool ladder + 多 session 元数据，足以作为 Pencil 设计稿的 baseline。
