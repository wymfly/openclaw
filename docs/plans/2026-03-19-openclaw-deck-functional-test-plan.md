# OpenClaw Deck — 功能测试计划

> **目标：** 逐一在浏览器中操作 Dashboard 所有功能，验证 37 个 Gateway RPC + 5 组 SQLite 本地功能的端到端正确性。
>
> **前置条件：** Gateway 运行中 (port 18789)、Dashboard 运行中 (port 3099)、至少一个 LLM API Key 可用 (Moonshot/DeepSeek)
>
> **预计时长：** 2-3 小时
>
> **上一轮 E2E 已覆盖：** 面板渲染（19/19）、主题/响应式/i18n/快捷键、基础消息收发。本轮聚焦**功能操作**。

---

## 缺陷处理策略

| 类型                                    | 处理                             |
| --------------------------------------- | -------------------------------- |
| **阻碍性** — 功能完全不可用             | 立即修复，修复后继续             |
| **数据异常** — RPC 返回错误或字段不匹配 | 记录 RPC 名称 + 错误码，尝试修复 |
| **体验问题** — 可用但不够好             | 记录到缺陷清单，不阻塞           |

---

## Phase 1: Chat 深度测试

> **覆盖 RPC：** `chat.send`, `chat.abort`, `chat.history`, `sessions.list`, `sessions.delete`
>
> 这是最重要的功能，需要验证完整的对话生命周期。

### T1.1: 多轮对话

操作：

1. 打开 Chat 面板
2. 发送 "你好，请记住我的名字是小明"
3. 等待 AI 回复完成
4. 发送 "我的名字是什么？"
5. 等待回复

验证项：

- [ ] 消息按时间顺序排列（用户→AI→用户→AI）
- [ ] AI 第二条回复中包含"小明"（上下文保持）
- [ ] 每条消息有时间戳
- [ ] 用户消息右对齐（accent bg），AI 消息左对齐（card bg）
- [ ] 头像图标正确（用户 User icon，AI Bot icon）
- [ ] 消息不重复（BUG-006 已修复）

### T1.2: 流式中止

操作：

1. 发送一条需要长回复的消息，如 "详细解释量子计算的基本原理，包括量子比特、叠加态、纠缠"
2. 在 AI 回复过程中，点击"停止"按钮

验证项：

- [ ] 发送后显示"思考中..."或流式文字
- [ ] "发送"按钮变为"停止"按钮
- [ ] 点击停止后，回复中断
- [ ] 已接收的文字保留（不丢失）
- [ ] "停止"按钮恢复为"发送"

### T1.3: Session 管理

操作：

1. 点击"新建会话"
2. 在新会话中发送 "这是新会话的第一条消息"
3. 观察 Session Sidebar

验证项：

- [ ] 新 session 出现在 sidebar
- [ ] 旧 session 仍在列表中
- [ ] 切换回旧 session → 消息历史完整（小明对话）
- [ ] 切换到新 session → 只有一轮对话

### T1.4: Agent 选择器

操作：

1. 如果有多个 agent（在 T2 创建后回来测试），切换 Agent Selector
2. 发送消息

验证项：

- [ ] Agent Selector 下拉框列出所有 agent
- [ ] 切换 agent 后，session 列表可能变化
- [ ] 新 agent 的回复风格可能不同

### T1.5: 文件附件

操作：

1. 点击 Paperclip 图标
2. 选择一个文本文件或图片

验证项：

- [ ] 文件选择对话框弹出
- [ ] 选中后显示 file badge（文件名 + X 移除按钮）
- [ ] 点击 X → file badge 消失
- [ ] （发送带附件的消息 — 如果 Gateway 支持）

---

## Phase 2: Agent CRUD

> **覆盖 RPC：** `agents.list`, `agents.create`, `agents.update`, `agents.delete`, `agents.files.list`, `agents.files.get`, `agents.files.set`

### T2.1: 创建 Agent

操作：

1. 切换到 Agents 面板
2. 点击"新建智能体"
3. 填写名称："test-agent"
4. 选择模型（如 kimi-k2.5）
5. 填写人格描述："你是一个严肃的学术助手，只回答学术问题"
6. 保存

验证项：

- [ ] 创建表单弹出（Dialog 或侧面板）
- [ ] 名称、模型、人格字段可编辑
- [ ] 保存成功 → 列表中出现 "test-agent"
- [ ] 点击 "test-agent" → 详情显示正确的名称、模型、人格

### T2.2: 编辑 Agent

操作：

1. 点击 "test-agent" 查看详情
2. 修改人格为 "你是一个幽默的朋友"
3. 保存

验证项：

- [ ] 编辑后点保存 → 提示成功
- [ ] 刷新页面 → 人格仍为修改后的值

### T2.3: 使用新 Agent 聊天

操作：

1. 切换到 Chat 面板
2. Agent Selector 选择 "test-agent"
3. 发送 "你是谁？"

验证项：

- [ ] AI 回复风格符合设定的人格
- [ ] Sessions 面板显示新 session 关联到 test-agent

### T2.4: 删除 Agent

操作：

1. 回到 Agents 面板
2. 点击 "test-agent" 的删除按钮
3. 确认删除

验证项：

- [ ] 确认弹窗出现
- [ ] 确认后 → "test-agent" 从列表消失
- [ ] Chat 面板 Agent Selector 中不再显示 "test-agent"

---

## Phase 3: Cron Job CRUD

> **覆盖 RPC：** `cron.list`, `cron.add`, `cron.update`, `cron.remove`, `cron.run`, `cron.runs`, `cron.status`

### T3.1: 创建定时任务

操作：

1. 切换到 Cron 面板
2. 点击"新建任务"
3. 填写：
   - 名称：test-heartbeat
   - Schedule：选择 "每小时" 模板（或手动输入 `0 * * * *`）
   - 描述：测试定时任务
4. 保存

验证项：

- [ ] 表单包含名称、schedule、描述、payload 类型等字段
- [ ] Schedule 模板（每5分钟/每小时/每天/每周）可选
- [ ] 保存成功 → 列表中出现 "test-heartbeat"
- [ ] 显示 next-run 时间

### T3.2: 手动运行

操作：

1. 点击 "test-heartbeat" 查看详情
2. 点击 "立即运行" (Run Now)

验证项：

- [ ] 运行触发 → 提示 "任务已触发"
- [ ] 运行历史 (Run History) 中出现一条记录
- [ ] 记录显示状态（成功/失败）+ 耗时

### T3.3: 编辑 + 删除

操作：

1. 修改 schedule 为 `*/30 * * * *`
2. 保存
3. 删除任务

验证项：

- [ ] 编辑保存成功，next-run 时间更新
- [ ] 删除确认 → 任务从列表消失

---

## Phase 4: Webhook CRUD + 投递

> **覆盖：** SQLite CRUD + `webhooks.ts` 投递逻辑

### T4.1: 创建 Webhook

操作：

1. 切换到 Webhooks 面板
2. 点击"创建"
3. 填写：
   - 名称：test-webhook
   - URL：`https://httpbin.org/post`（公开测试端点）
   - Secret：test-secret-123
   - 事件：选择至少一个事件类型
4. 保存

验证项：

- [ ] 创建成功 → 列表中出现
- [ ] 显示 URL、事件列表、启用状态

### T4.2: 测试投递

操作：

1. 点击 "test-webhook"
2. 点击 "测试投递" (Test Delivery)

验证项：

- [ ] 测试发送 → 提示 "测试投递已发送"
- [ ] 投递历史中出现记录
- [ ] 记录显示 status_code (200)、response time、成功状态

### T4.3: 编辑 + 删除

- [ ] 修改 URL → 保存 → 生效
- [ ] 删除 → 确认 → 从列表消失

---

## Phase 5: Budget 规则

> **覆盖：** SQLite CRUD + `budget-governance.ts` 评估逻辑

### T5.1: 创建预算规则

操作：

1. 切换到 Budget 面板
2. 点击"创建"
3. 填写：
   - 名称：daily-token-limit
   - 范围：全局 (Global)
   - 维度：总 Token (totalTokens)
   - 告警阈值：10000
   - 超限阈值：50000
4. 保存

验证项：

- [ ] 规则出现在列表中
- [ ] 显示维度、阈值、当前状态（正常/告警/超限）
- [ ] Budget Status 区域反映当前消耗 vs 阈值

### T5.2: 编辑 + 删除

- [ ] 修改阈值 → 保存 → 状态可能变化
- [ ] 删除 → 确认 → 从列表消失

---

## Phase 6: Alert 规则

> **覆盖：** SQLite CRUD + `alert-engine.ts` 评估 + `commander.ts` 路由

### T6.1: 创建告警规则

操作：

1. 切换到 Alerts 面板
2. 点击"新建规则"
3. 填写：
   - 名称：high-token-alert
   - 实体类型：选一个
   - 条件：>=
   - 阈值：1000
   - 动作：Toast 通知
   - 冷却时间：5 分钟
4. 保存

验证项：

- [ ] 规则出现在列表中
- [ ] 显示条件、阈值、动作、冷却时间
- [ ] 启用/禁用开关可操作

### T6.2: 触发记录

操作：

1. 切换到"触发记录" Tab

验证项：

- [ ] Tab 切换正常
- [ ] 如有触发记录，显示严重度、时间、详情

### T6.3: 删除

- [ ] 删除规则 → 确认 → 从列表消失

---

## Phase 7: Approvals & Security

> **覆盖 RPC：** `exec.approvals.get`, `exec.approvals.set`, `exec.approval.resolve`

### T7.1: 安全策略编辑

操作：

1. 切换到 Approvals 面板
2. 点击"安全策略" Tab
3. 修改全局默认策略的某个维度（如 `ask` 从 off 改为 on-miss）
4. 保存

验证项：

- [ ] 4 维度策略编辑器可见（security/ask/askFallback/autoAllowSkills）
- [ ] 修改后保存 → 提示 "策略已保存"
- [ ] 刷新页面 → 保持修改后的值

### T7.2: 路径白名单

操作：

1. 在路径白名单中添加 `/tmp/test`
2. 保存

验证项：

- [ ] 路径出现在白名单列表中
- [ ] 可删除该路径

### T7.3: 待审批列表

验证项：

- [ ] "待审批" Tab 显示（可能为空列表）
- [ ] 如有 pending 项，Approve/Deny 按钮可点击

---

## Phase 8: Skills 管理

> **覆盖 RPC：** `skills.status`, `skills.update`, `skills.install`

### T8.1: 浏览技能列表

操作：

1. 切换到 Skills 面板
2. 使用状态过滤器切换（全部/就绪/需配置/已禁用）

验证项：

- [ ] 过滤器切换 → 列表实时更新
- [ ] "就绪" 过滤 → 只显示 ready 状态的 skill
- [ ] 每个 skill 显示名称 + 来源（内置/托管/插件）+ 状态

### T8.2: 查看技能配置

操作：

1. 点击一个 "需配置" 状态的 skill（如 1password）

验证项：

- [ ] 右侧显示配置面板
- [ ] 显示该 skill 需要的环境变量 / API Key
- [ ] 显示缺少的依赖项

### T8.3: 启用/禁用技能

操作：

1. 找到一个 "就绪" 状态的 skill（如 weather）
2. 点击 Disable

验证项：

- [ ] 状态变为 "已禁用"
- [ ] 再次 Enable → 状态恢复 "就绪"

---

## Phase 9: Config Editor

> **覆盖 RPC：** `config.get`, `config.schema`, `config.apply`

### T9.1: 浏览配置

操作：

1. 切换到 Config 面板
2. 浏览不同 Section（meta → agents → models → gateway → hooks）

验证项：

- [ ] Section 导航可点击切换
- [ ] 每个 Section 显示 JSON Schema 生成的表单字段
- [ ] 当前值正确加载
- [ ] Nested 对象有缩进或折叠组

### T9.2: 编辑配置

操作：

1. 找到一个安全的字段修改（如 `logging` 下的某个字段）
2. 修改值
3. 点击"保存"

验证项：

- [ ] 修改后 "保存" 按钮从 disabled 变为 enabled
- [ ] 保存成功 → 提示 "已保存"
- [ ] 点击 "重新加载" → 值仍为修改后的
- [ ] （如果可能）修改一个会影响行为的配置，验证 Gateway 生效

### T9.3: 冲突检测

验证项：

- [ ] 如果同时有 CLI 修改了配置，保存时应检测到冲突
- [ ] （可选测试：CLI 端 `openclaw config set` 某个值 → Dashboard 保存 → 冲突提示）

---

## Phase 10: Models & Providers

> **覆盖 RPC：** `models.list`, `config.get`, `config.patch`

### T10.1: 浏览模型目录

操作：

1. 切换到 Models 面板
2. 滚动浏览模型列表

验证项：

- [ ] 模型按 provider 分组（AMAZON-BEDROCK, ANTHROPIC, OPENAI, MOONSHOT, DEEPSEEK 等）
- [ ] 每个模型显示名称 + context window + 定价
- [ ] 列表可滚动，数量 > 700

### T10.2: 供应商配置

操作：

1. 点击一个已配置的 provider（如 Moonshot）
2. 查看配置

验证项：

- [ ] 右侧显示 API Key 输入框（已有值时显示掩码）
- [ ] Base URL 显示
- [ ] "保存" 按钮可用

---

## Phase 11: Sessions & Usage 联动

> **覆盖 RPC：** `sessions.list`, `sessions.delete`, `usage.status`, `usage.cost`, `sessions.usage.timeseries`

### T11.1: Sessions 浏览

操作：

1. 切换到 Sessions 面板（此时应有 Phase 1 创建的多个 session）

验证项：

- [ ] 列表显示所有 session，包括 Phase 1 的对话
- [ ] Kind badge 正确（直接/群组/全局）
- [ ] 每个 session 显示模型、更新时间、上下文用量百分比

### T11.2: Session 详情

操作：

1. 点击一个 session

验证项：

- [ ] Token 统计（输入/输出）与 Phase 1 对话一致
- [ ] 对话历史显示完整消息
- [ ] 上下文用量百分比 > 0%

### T11.3: 删除 Session

操作：

1. 删除一个不需要的 session（如 T1.3 创建的新会话）

验证项：

- [ ] 确认弹窗出现
- [ ] 确认后 session 从列表消失
- [ ] Usage 面板数据可能更新

### T11.4: Usage 数据验证

操作：

1. 切换到 Usage 面板
2. 切换时间窗口（今天 → 近7天 → 近30天）

验证项：

- [ ] Token 统计 > 0（因为 Phase 1 已发消息）
- [ ] 时间窗口切换 → 数据更新
- [ ] "按模型" Tab → 显示 kimi-k2.5 的消耗
- [ ] "按智能体" Tab → 切换正常
- [ ] 上下文压力显示 agent:main:main 的百分比

---

## Phase 12: Doc Hub

> **覆盖：** `chat.history` RPC + SQLite CRUD + `doc-extractor.ts`

### T12.1: 提取文档

操作：

1. 确保 Chat 面板有一些对话（Phase 1）
2. 切换到 Doc Hub 面板
3. 点击 "提取文档" (Extract Docs)

验证项：

- [ ] 提取过程有 loading 状态
- [ ] 提取完成后，文档列表更新
- [ ] 每个文档有 category badge（总结/计划/规范/手册/草稿）
- [ ] 文档有标题和日期

### T12.2: 浏览文档

操作：

1. 点击一个文档

验证项：

- [ ] 右侧 DocViewer 显示 Markdown 内容
- [ ] Markdown 正确渲染（标题、列表、代码块、加粗等）

### T12.3: 分类过滤 + 搜索

操作：

1. 点击不同的分类 Tab（全部/总结/计划/规范/手册/草稿）
2. 在搜索框输入关键词

验证项：

- [ ] 分类切换 → 列表筛选
- [ ] 搜索 → 列表实时过滤
- [ ] 搜索 `%` → 不匹配所有文档（LIKE 转义验证）

### T12.4: 删除文档

操作：

1. 删除一个文档

验证项：

- [ ] 确认弹窗出现
- [ ] 确认后文档从列表消失

---

## Phase 13: Memory Browser

> **覆盖 RPC：** `doctor.memory.status` + 文件系统浏览

### T13.1: 文件树

操作：

1. 切换到 Memory 面板
2. 选择 Agent（\_default 或 main）
3. 查看 "文件树" Tab

验证项：

- [ ] 文件树加载（显示 agent 的 memory 文件）
- [ ] 可展开/折叠目录
- [ ] 文件名可见

### T13.2: 向量搜索

操作：

1. 切换到"向量搜索" Tab
2. 输入搜索词（如 "小明"）

验证项：

- [ ] 搜索框可输入
- [ ] 如果 LanceDB 启用 → 返回搜索结果
- [ ] 如果 LanceDB 未启用 → 显示 "需要 LanceDB 扩展"

### T13.3: 健康诊断

操作：

1. 切换到 "健康诊断" Tab

验证项：

- [ ] embedding 状态显示（ok/error/unknown）
- [ ] LanceDB 状态提示（启用/未启用）

---

## Phase 14: Logs 实时验证

> **覆盖 RPC：** `logs.tail`

### T14.1: 日志过滤

操作：

1. 切换到 Logs 面板
2. 在 Chat 面板发一条消息（另一个 Tab 或快捷键）
3. 回到 Logs 面板

验证项：

- [ ] 新日志条目实时出现（LIVE 标记）
- [ ] 点击 "信息" 过滤 → 只显示 info 级别
- [ ] 点击 "错误" 过滤 → 只显示 error 级别
- [ ] Agent 过滤器切换 → 日志列表变化

---

## Phase 15: Channels

> **覆盖 RPC：** `channels.status`, `config.get`, `config.patch`, `channels.logout`

### T15.1: 渠道列表

操作：

1. 切换到 Channels 面板

验证项：

- [ ] 渠道列表加载（已配置 vs 可用）
- [ ] 每个渠道有状态指示器（linked/error/unconfigured）

### T15.2: 渠道配置（如果有已配置的渠道）

- [ ] 点击已配置渠道 → 配置表单显示（token/webhook URL 等）
- [ ] Enable/Disable 操作可用

---

## Phase 16: Settings 完整验证

> **覆盖：** SQLite settings + Gateway 连接测试

### T16.1: 外观

- [ ] 主题 3 选 1（跟随系统/深色/浅色）→ 即时生效
- [ ] 语言切换 ZH ↔ EN → 全页面标签更新

### T16.2: 连接

操作：

1. 切换到"连接" Tab
2. 查看当前 Gateway URL 和 Token
3. 点击 "测试连接"

验证项：

- [ ] 当前 URL 和 Token 显示（Token 掩码 ••••••）
- [ ] 测试连接 → 显示成功/失败
- [ ] 修改 Token 为错误值 → 保存 → 测试连接 → 失败
- [ ] 恢复正确 Token → 保存 → 测试连接 → 成功

### T16.3: 通知

- [ ] 审批请求开关 → 切换
- [ ] 预算告警开关 → 切换
- [ ] 规则告警开关 → 切换

### T16.4: 关于

- [ ] Deck 版本号显示
- [ ] Gateway 版本号显示
- [ ] 文档链接可点击
- [ ] GitHub 链接可点击

---

## Phase 17: Gateway 连接生命周期

> **覆盖：** WebSocket 断连/重连

### T17.1: Gateway 断连

操作：

1. 终端中 Ctrl+C 停止 Gateway
2. 观察 Dashboard

验证项：

- [ ] HeaderBar 状态变为 "未连接"（红色）或 "重连中"（黄色）
- [ ] API 调用返回错误提示（不崩溃）
- [ ] Chat 发送 → 显示错误提示

### T17.2: Gateway 恢复

操作：

1. 重启 Gateway
2. 观察 Dashboard

验证项：

- [ ] Dashboard 自动重连
- [ ] HeaderBar 恢复 "已连接"（绿色）
- [ ] 功能恢复正常（可发消息）

---

## Phase 18: 跨面板联动

> **综合验证数据一致性**

### T18.1: Agent 创建 → Chat → Sessions → Usage

操作：

1. Agents: 创建新 agent "math-bot"，人格 "你是数学专家"
2. Chat: 切换到 math-bot，发送 "1+1=?"
3. Sessions: 查看 math-bot 的 session
4. Usage: 验证 token 增长

验证项：

- [ ] 全链路数据一致（agent → session → usage 都关联正确）

### T18.2: Config 修改 → Gateway 生效

操作：

1. Config: 修改一个可观察的配置项
2. 验证 Gateway 行为变化

### T18.3: 多轮 Chat → Doc Hub 提取

操作：

1. Chat: 发送 "写一份项目计划书，包括目标、时间表、里程碑"
2. 等待长回复
3. Doc Hub: 提取文档

验证项：

- [ ] 提取出的文档包含 AI 回复的完整内容
- [ ] 分类为 "计划" (plan)

---

## 测试完成标准

全部 Phase 通过后，确认：

- [ ] 37 个 Gateway RPC 全部通过浏览器操作触达
- [ ] 5 组 SQLite 功能（Alerts/Webhooks/Budget/Docs/Settings）CRUD 正常
- [ ] 跨面板数据一致（Agent→Chat→Sessions→Usage）
- [ ] Gateway 断连/恢复行为正确
- [ ] 无阻碍性缺陷残留
- [ ] 缺陷清单中的体验问题已记录

---

## RPC 覆盖矩阵

| RPC                         | Phase       | 操作                |
| --------------------------- | ----------- | ------------------- |
| `agents.list`               | T2          | 列表加载            |
| `agents.create`             | T2.1        | 创建 agent          |
| `agents.update`             | T2.2        | 编辑人格            |
| `agents.delete`             | T2.4        | 删除 agent          |
| `agents.files.list`         | T2.1        | 详情页文件列表      |
| `agents.files.get`          | T2.1        | 文件内容            |
| `agents.files.set`          | T2.2        | 编辑文件            |
| `chat.send`                 | T1.1        | 发送消息            |
| `chat.abort`                | T1.2        | 中止回复            |
| `chat.history`              | T1.3, T12.1 | 会话历史 + 文档提取 |
| `sessions.list`             | T1.3, T11   | Session 列表        |
| `sessions.delete`           | T11.3       | 删除 session        |
| `sessions.usage.timeseries` | T11.4       | 时序数据            |
| `config.get`                | T9.1        | 加载配置            |
| `config.schema`             | T9.1        | 加载 schema         |
| `config.apply`              | T9.2        | 保存配置            |
| `config.patch`              | T15.2       | 渠道配置            |
| `models.list`               | T10.1       | 模型目录            |
| `channels.status`           | T15.1       | 渠道状态            |
| `channels.logout`           | T15.2       | 断开渠道            |
| `cron.list`                 | T3.1        | 任务列表            |
| `cron.add`                  | T3.1        | 创建任务            |
| `cron.update`               | T3.3        | 编辑任务            |
| `cron.remove`               | T3.3        | 删除任务            |
| `cron.run`                  | T3.2        | 手动运行            |
| `cron.runs`                 | T3.2        | 运行历史            |
| `cron.status`               | T3.1        | Cron 状态           |
| `exec.approvals.get`        | T7.1        | 获取策略            |
| `exec.approvals.set`        | T7.1        | 设置策略            |
| `exec.approval.resolve`     | T7.3        | 审批操作            |
| `skills.status`             | T8.1        | 技能列表            |
| `skills.update`             | T8.3        | 启用/禁用           |
| `skills.install`            | T8.2        | 安装技能            |
| `health`                    | 自动        | Gateway 健康        |
| `status`                    | 自动        | Gateway 状态        |
| `usage.status`              | T11.4       | 用量状态            |
| `usage.cost`                | T11.4       | 费用数据            |
| `logs.tail`                 | T14.1       | 日志流              |
| `doctor.memory.status`      | T13.3       | 内存健康            |

---

## 缺陷跟踪模板

```markdown
### BUG-NNN: [标题]

**严重度：** 阻碍性 / 数据异常 / 体验问题
**发现阶段：** Phase N, T-N.N
**涉及 RPC：** xxx.yyy
**复现步骤：**

1. ...
2. ...

**期望行为：** ...
**实际行为：** ...
**Console 错误：** （如有）
**处理决策：** 立即修复 / 延后 / 待讨论
```
