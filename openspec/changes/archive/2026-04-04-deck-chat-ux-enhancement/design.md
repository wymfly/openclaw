## Context

Deck Chat 面板当前能力：

- MessageInput：文本框 + 发送按钮，支持 multimodal 附件（图片/文件）
- MessageList：消息流渲染（user/assistant/tool blocks）
- SessionSidebar：session 列表与切换
- RunStatusBar：agent 运行状态（idle/working/streaming）
- ApprovalDialog：工具审批
- ToolProgressBar：工具调用进度

官方 CLI 的输入增强：

- 16 个 slash 命令：`/new` `/reset` `/compact` `/stop` `/model` `/think` `/export` `/clear` `/help` `/status` `/config` `/doctor` `/login` `/logout` `/bug` `/cost`
- InputHistory：50 条上限、去重、ArrowUp/Down 导航、搜索
- Token 计数在 ChatEvent.usage 字段
- Compaction 通过 sessions.changed 事件的 compacted 标志

## Goals / Non-Goals

**Goals:**

- 在 MessageInput 中实现 slash 命令触发和命令面板
- 实现输入历史的存储、导航和去重
- 在 UI 中展示 token 消耗（消息级 + session 级汇总）
- 可视化 compaction 事件为系统通知

**Non-Goals:**

- 不实现所有 16 个 CLI slash 命令 — 部分命令仅适用于 CLI（/doctor、/login、/logout、/bug）。初期实现 Deck 适用的子集
- 不实现命令的自动补全参数 — 初期仅命令名补全，参数由用户自行输入
- 不实现实时 token 限额/预算警告 — 属于 Budget 面板职责
- 不持久化输入历史到 DB — sessionStorage 足够（tab 关闭清除是可接受行为）

## Decisions

### D1: Deck 适用的 Slash 命令子集

**选择**: 对齐官方 Control UI (`ui/src/ui/chat/slash-commands.ts`)，实现以下 15 个命令：

| 命令       | 分类    | Deck 行为                                  |
| ---------- | ------- | ------------------------------------------ |
| `/new`     | session | 创建新 session                             |
| `/reset`   | session | 重置当前 session（创建新 session）         |
| `/compact` | session | 触发 context compaction                    |
| `/stop`    | session | 中止当前运行                               |
| `/clear`   | session | 清空消息列表（不影响 session）             |
| `/focus`   | session | 切换专注模式                               |
| `/model`   | model   | 查看/切换当前 session 的模型               |
| `/think`   | model   | 设置 thinking level（off/low/medium/high） |
| `/verbose` | model   | 切换详细模式（on/off/full）                |
| `/fast`    | model   | 切换快速模式（status/on/off）              |
| `/help`    | tools   | 显示可用命令列表                           |
| `/export`  | tools   | 导出当前 session 为 markdown               |
| `/usage`   | tools   | 查看当前 session 的 token 用量             |
| `/agents`  | agents  | 列出已配置的 agent                         |
| `/kill`    | agents  | 中止子 agent                               |

**不实现**: `/steer`、`/skill`（需要复杂参数解析，后续补充）、`/config`（有 Config Editor）、`/doctor`/`/login`/`/logout`/`/bug`（CLI only）

### D2: 命令面板使用 Popover 而非全屏 Command Palette

**选择**: 输入 `/` 时在输入框上方弹出 Popover，展示命令列表，支持键盘上下选择和模糊过滤。

**替代方案**: Command Palette 风格全屏覆盖（如 VS Code 的 Ctrl+Shift+P）。

**理由**: Chat 输入框是上下文环境，Popover 保持视觉连续性。全屏覆盖遮挡对话内容，不利于用户参考上文决定命令。

### D3: 输入历史使用 sessionStorage + 内存 ring buffer

**选择**: 50 条上限的 ring buffer 存储在组件 state 中，同步到 sessionStorage（key = `deck-chat-input-history`）。

**理由**: sessionStorage 在 tab 生命周期内持久化（刷新不丢失），tab 关闭自动清除。不用 localStorage 是因为输入历史是临时性的，不需要跨 tab 共享。Ring buffer 保证内存有限。

### D4: Token 计数的展示位置

**选择**:

- **消息级**: 在每条 assistant 消息底部显示 token 使用行（input/output/cache tokens，小字灰色）
- **Session 级**: 在 RunStatusBar 右侧显示当前 session 累计 token 和 cost

**理由**: 双层展示满足不同场景：消息级帮助用户理解单次请求的消耗，session 级帮助监控整体使用。

### D5: Compaction 通知作为系统消息卡片

**选择**: 检测到 compaction 事件时，在消息流中插入系统通知卡片（非用户/非 assistant 消息），显示 "上下文已压缩" 和压缩前后的 token 数。

**理由**: 作为消息流的一部分，用户可以在时间线上看到 compaction 发生的位置，理解上下文断点。独立通知容易被忽略。

## Risks / Trade-offs

- **[Slash 命令的后端执行]** `/compact`、`/reset` 等命令需要后端 RPC 支持 → 复用已有的 `sessions.steer`、`sessions.patch` 等 API
- **[输入历史隐私]** sessionStorage 中的历史可被同 tab 的 JS 代码读取 → 不存储敏感信息（输入文本可能含敏感数据），提供 "清除历史" 选项
- **[Token 计数精度]** ChatEvent.usage 可能不是所有事件都携带 → 仅在有 usage 字段时显示，无数据时不渲染
- **[Compaction 检测]** 依赖 sessions.changed 事件中的 compacted 标志 → 如果事件被错过（重连期间），可能丢失通知
