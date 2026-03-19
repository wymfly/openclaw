# OpenClaw Enhanced Fork — 端到端测试计划

> **目标：** 通过浏览器操作 + CLI 验证，全面确认 enhanced 分支的所有功能可用，发现并修复缺陷。

**测试基线：** enhanced 分支 commit `0661bde6a`，593 unit tests + 35 E2E tests passing。

**测试环境：** macOS, Node 22+, Chrome (Playwright), 本地 Gateway + Dashboard。

---

## 缺陷处理策略

| 类型          | 定义                                             | 处理                       |
| ------------- | ------------------------------------------------ | -------------------------- |
| **阻碍性**    | 服务无法启动、页面崩溃、核心功能不工作、数据丢失 | 立即停下修复，修复后继续   |
| **已记录**    | memory 中记录的 deferred findings、已知 P2       | 顺便修复                   |
| **有争议**    | 不确定是 bug 还是设计意图                        | 询问用户决策               |
| **视觉/体验** | 样式偏差、文案不当、交互可优化                   | 记录到缺陷清单，不阻塞测试 |

---

## Phase 0: 预飞检查（CLI 自动化）

> 确保代码基线健康，所有自动化测试通过。

### T0.1: TypeScript 类型检查

```bash
cd dashboard && npx tsc --noEmit
```

- [ ] 0 errors

### T0.2: Dashboard 单元测试

```bash
cd dashboard && pnpm test
```

- [ ] 368+ tests passing, 0 failed

### T0.3: Memory-lancedb 单元测试

```bash
cd extensions/memory-lancedb && pnpm test
```

- [ ] 225+ tests passing, 0 failed

### T0.4: Lint + Format

```bash
pnpm check
```

- [ ] 0 warnings, 0 errors

### T0.5: WeCom 扩展测试

```bash
cd extensions/wecom && pnpm test
```

- [ ] 120+ tests passing

### T0.6: 核心安全模块测试

```bash
pnpm test -- src/infra/net/ src/security/ src/daemon/
```

- [ ] SSRF (57 tests), Fetch Guard, External Content, Windows ACL, Daemon — 全部 passing

**Phase 0 退出标准：** 全部 6 项绿色。任何失败 → 修复后重跑。

---

## Phase 1: 服务启动验证

> 确保 Gateway 和 Dashboard 两个服务能正常启动并通信。

### T1.1: 启动 OpenClaw Gateway

```bash
export OPENCLAW_GATEWAY_TOKEN="test-token-for-e2e"
pnpm openclaw gateway run --port 18789 --bind loopback --allow-unconfigured --force
```

验证项：

- [ ] 控制台输出 "WebSocket listening on ws://127.0.0.1:18789" 或类似信息
- [ ] `openclaw gateway status --probe` 返回正常
- [ ] `ss -ltnp | grep 18789` 或 `lsof -i :18789` 确认端口占用

### T1.2: 启动 Dashboard Dev Server

```bash
cd dashboard && pnpm dev
```

验证项：

- [ ] 控制台输出 "Next.js 16.x" + "Local: http://localhost:3000"
- [ ] `curl -s http://localhost:3000 | head -5` 返回 HTML

### T1.3: 服务间连通性

```bash
curl -s http://localhost:3000/api/onboarding/status | jq .
```

- [ ] 返回 `{ "needsOnboarding": true }` （首次启动）或 `{ "needsOnboarding": false }`

**Phase 1 退出标准：** Gateway 端口监听 + Dashboard HTTP 可达 + API 通信正常。

---

## Phase 2: Onboarding 流程（浏览器）

> 首次使用体验验证。清除旧数据库强制触发 Onboarding。

### 准备

```bash
rm -f ~/.openclaw/deck.db   # 清除旧数据，强制触发 onboarding
# 重启 Dashboard dev server
```

### T2.1: Onboarding 向导加载

操作：打开 `http://localhost:3000`

验证项：

- [ ] 看到 Onboarding Wizard（3 步向导）
- [ ] Step 指示器显示 "1/3"
- [ ] Gateway URL 输入框可见
- [ ] Gateway Token 输入框可见
- [ ] "Test Connection" 按钮可见且可点击
- [ ] "Next" 按钮 disabled（未测试连接前）

### T2.2: Gateway 连接测试

操作：

1. 输入 Gateway URL: `ws://localhost:18789`
2. 输入 Token: `test-token-for-e2e`
3. 点击 "Test Connection"

验证项：

- [ ] 按钮显示 loading 状态
- [ ] 连接成功 → 显示绿色成功提示
- [ ] "Next" 按钮变为 enabled
- [ ] 输入错误 URL（如 `ws://localhost:99999`）→ 显示错误提示

### T2.3: SSRF 防护验证

操作：输入私有 IP 地址

验证项：

- [ ] 输入 `ws://192.168.1.1:18789` → 连接被拒绝（SSRF 防护）
- [ ] 输入 `ws://10.0.0.1:18789` → 连接被拒绝
- [ ] 输入 `ws://localhost:18789` → 连接成功（localhost 例外）

### T2.4: 模型提供商配置

操作：点击 Next 进入 Step 2

验证项：

- [ ] 看到提供商选择列表（Moonshot / DeepSeek / OpenAI / Anthropic / Custom）
- [ ] 选择提供商后，模型名自动填充
- [ ] API Key 输入框可见
- [ ] 输入 API Key 后 Next 可点击

### T2.5: 首次聊天测试

操作：点击 Next 进入 Step 3

验证项：

- [ ] 看到聊天输入框
- [ ] 输入 "你好" 发送
- [ ] 收到流式回复（文字逐字/逐块出现）
- [ ] 回复完成后自动跳转到 Dashboard 主界面

### T2.6: Onboarding 完成

验证项：

- [ ] 看到 Dashboard Shell（NavRail + HeaderBar + 主内容区）
- [ ] 默认面板为 Chat
- [ ] NavRail 显示 4 个分组（Core / Observe / Automate / Control）
- [ ] 刷新页面 → 不再显示 Onboarding（配置已持久化到 deck.db）

**Phase 2 退出标准：** 3 步向导全部完成，进入 Dashboard。

---

## Phase 3: 核心面板验证（浏览器）

> 逐一操作 Core 和 Observe 组的 9 个面板，验证核心功能。

### T3.1: Chat 面板

前置：Phase 2 完成，已在 Chat 面板

操作 + 验证：

- [ ] 消息输入框可见，placeholder 显示提示文字
- [ ] 输入 "请用 3 句话介绍自己" → 点击发送（或 Ctrl+Enter）
- [ ] 消息列表显示用户消息 + AI 流式回复
- [ ] 回复中 Markdown 正确渲染（加粗、列表等）
- [ ] 流式回复中点击 "Abort" → 回复中止
- [ ] Session Sidebar 可见，显示当前 session
- [ ] Agent Selector 下拉框可用
- [ ] 文件附件拖拽区域存在

### T3.2: Agents 面板

操作：点击 NavRail → Agents

验证项：

- [ ] Agent 列表加载（至少有 default agent）
- [ ] 点击 agent → 右侧显示详情（模型、个性、工作区）
- [ ] "Create Agent" 按钮可点击
- [ ] 创建新 agent → 填写名称/模型 → 保存 → 列表更新
- [ ] 编辑 agent 配置 → 保存 → 配置生效
- [ ] 删除 agent → 确认 → 从列表消失

### T3.3: Gateway Overview 面板

操作：点击 NavRail → Gateway

验证项：

- [ ] Connection Card 显示 "Connected" + 绿色指示灯
- [ ] Health Card 显示健康状态
- [ ] Heartbeat Card 显示心跳监控
- [ ] Gateway 状态显示（active/paused）

### T3.4: Models 面板

操作：点击 NavRail → Models

验证项：

- [ ] 模型目录列表加载（按 provider 分组）
- [ ] 每个模型显示名称和定价信息
- [ ] Provider 配置表单可编辑（API Key, Base URL）
- [ ] 默认模型选择可切换

### T3.5: Usage & Costs 面板

操作：点击 NavRail → Usage

验证项：

- [ ] Summary Cards 显示 tokens in/out/total + cost
- [ ] 时间窗口切换（Today / 7d / 30d）→ 数据更新
- [ ] Chart 区域渲染（Recharts 折线图或柱状图）
- [ ] Model Breakdown 表格可见
- [ ] Context Pressure 指示器可见

### T3.6: Sessions 面板

操作：点击 NavRail → Sessions

验证项：

- [ ] Session 列表加载（含 Phase 2 创建的 session）
- [ ] Kind badges 显示（direct/group/global）
- [ ] 点击 session → 详情页显示 token 统计（inputTokens/outputTokens）
- [ ] 会话历史查看器可用

### T3.7: Memory Browser 面板

操作：点击 NavRail → Memory

验证项：

- [ ] Agent Selector 下拉框可用
- [ ] Tab 栏显示（Files / Search / Graph / Health）
- [ ] **P3 新增：** Scope Filter 下拉框可见（Global / Agent）
- [ ] Files Tab: 文件树加载，可展开/折叠
- [ ] Search Tab: 搜索输入框可用
- [ ] **P3 新增：** Tier badges 显示（如果有 tier metadata）
- [ ] Health Tab: embedding 状态表格（ok/error/unknown）
- [ ] LanceDB 状态提示（enabled/disabled）

### T3.8: Logs 面板

操作：点击 NavRail → Logs

验证项：

- [ ] 日志流实时加载（通过 logs.tail RPC 轮询）
- [ ] Level 过滤按钮可见（debug/info/warn/error）
- [ ] 日志条目显示 timestamp + level + message
- [ ] 自动滚动到最新日志

### T3.9: Activity Feed 面板

操作：点击 NavRail → Activity

验证项：

- [ ] 事件时间线加载
- [ ] Agent 事件显示（tool calls, status changes）
- [ ] 事件按时间倒序排列
- [ ] SSE 实时更新（新事件自动出现）

**Phase 3 退出标准：** 9 个 Core + Observe 面板全部可操作，数据正确加载。

---

## Phase 4: Automate + Control 面板验证（浏览器）

> 验证 P2 + P3 新增的 10 个面板。

### T4.1: Cron 面板

操作：点击 NavRail → Cron

验证项：

- [ ] Job 列表加载（可能为空）
- [ ] 创建新 job → 填写名称 + cron 表达式 + payload → 保存
- [ ] Job 出现在列表中，显示 next-run 时间
- [ ] "Run Now" 按钮 → 手动触发 → Run History 更新
- [ ] 编辑 job → 修改 schedule → 保存
- [ ] 删除 job → 确认 → 从列表消失
- [ ] Schedule 模板选择可用

### T4.2: Webhooks 面板

操作：点击 NavRail → Webhooks

验证项：

- [ ] Webhook 列表加载（可能为空）
- [ ] 创建 webhook → 填写 URL + Events + Secret → 保存
- [ ] "Test Delivery" 按钮 → 发送测试 → Delivery History 更新
- [ ] Delivery History 显示 status_code, duration, success/failure
- [ ] 编辑/删除 webhook 可操作

### T4.3: Approvals & Security 面板

操作：点击 NavRail → Approvals

验证项：

- [ ] Pending Approvals 列表加载
- [ ] Policy Editor 可见（4 维度：security/ask/askFallback/autoAllowSkills）
- [ ] Per-agent 安全策略编辑
- [ ] Path Allowlist 管理（添加/删除路径）
- [ ] Approve/Deny 按钮可操作（如有 pending 项）
- [ ] **P3 修复验证 (F7):** 过期审批不会无限残留（刷新后消失）

### T4.4: Skills 面板

操作：点击 NavRail → Skills

验证项：

- [ ] Skill 列表加载（显示 ready/needs-setup/disabled 状态）
- [ ] 状态筛选器可用
- [ ] 点击 skill → 配置面板（环境变量/API Key）
- [ ] Enable/Disable toggle 可操作
- [ ] Install 按钮可操作（如有可安装的 skill）

### T4.5: Budget 面板

操作：点击 NavRail → Budget

验证项：

- [ ] Budget Rules 列表加载（可能为空）
- [ ] 创建规则 → 填写 name, scope(global/per-agent/per-task), dimension(tokensIn/tokensOut/totalTokens/cost), warn/over threshold → 保存
- [ ] 规则出现在列表中
- [ ] Budget Status 显示当前消耗 vs 阈值
- [ ] 编辑/删除规则可操作
- [ ] **P3 修复验证 (F10):** webhook retry 定时器运行（看 runtime 日志）

### T4.6: Alerts 面板

操作：点击 NavRail → Alerts

验证项：

- [ ] Alert Rules 列表加载
- [ ] 创建规则 → entity_type, condition(>/>=/<等), threshold, action(toast/activity/webhook), cooldown → 保存
- [ ] Fired Alerts 列表可见
- [ ] **P3 修复验证 (F9):** SSE 事件正确路由到 Fired Alerts 列表
- [ ] **P3 修复验证 (F11):** condition 字段参与实际评估（不只是 >=）
- [ ] 编辑/删除规则可操作

### T4.7: Channels 面板

操作：点击 NavRail → Channels

验证项：

- [ ] Channel 列表加载（configured vs available）
- [ ] 每个 channel 状态指示器（connected/disconnected）
- [ ] 配置表单（token/webhook URL）可编辑
- [ ] Enable/Disable/Re-link 操作

### T4.8: Config Editor 面板

操作：点击 NavRail → Config

验证项：

- [ ] Schema 从 Gateway 加载（config.schema RPC）
- [ ] Section 导航可用（gateway/agents/hooks/models 等）
- [ ] 表单自动从 JSON Schema 生成
- [ ] 编辑 → Save → 成功提示
- [ ] Conflict 检测（如果同时有外部修改）
- [ ] Reload 按钮 → 刷新配置

### T4.9: Doc Hub 面板（P3 新增）

操作：点击 NavRail → Docs

验证项：

- [ ] 面板加载，显示 header + Extract 按钮
- [ ] Category Filter（All / Summary / Plan / Spec / Manual / Draft）
- [ ] 点击 "Extract Docs" → 从当前 session 提取文档
- [ ] 提取后文档列表更新
- [ ] 每个文档显示 category badge（彩色）+ title + date
- [ ] 点击文档 → 右侧 DocViewer 显示 Markdown 内容
- [ ] 搜索框输入关键词 → 列表筛选
- [ ] Category Tab 切换 → 列表筛选
- [ ] 删除文档 → 确认弹窗 → 从列表消失

### T4.10: Settings 面板（P3 新增）

操作：点击 NavRail → Settings

验证项：

- [ ] 面板加载，显示 4 个 section
- [ ] **Appearance:** Theme 3 按钮（System/Dark/Light）→ 切换即时生效
- [ ] **Appearance:** Language 2 按钮（中文/English）→ 切换即时生效，全站文案变化
- [ ] **Connection:** Gateway URL + Token 输入框，显示当前值
- [ ] **Connection:** Test Connection 按钮 → 测试连接
- [ ] **Connection:** Save 按钮 → 保存设置
- [ ] **Notifications:** 3 个 checkbox（Approvals/Budget/Alerts）可切换
- [ ] **About:** Version badges（Deck/Gateway/CLI 版本号）
- [ ] **About:** Documentation + GitHub 外部链接

**Phase 4 退出标准：** 10 个 Automate + Control 面板全部可操作，P3 修复项已验证。

---

## Phase 5: 生产就绪验证（浏览器）

> 验证 P3 Production Readiness 功能。

### T5.1: 响应式布局

操作：浏览器 DevTools → 设备模拟

验证项：

- [ ] **Desktop (≥1024px):** NavRail 展开（图标+文字），正常 2 列布局
- [ ] **Tablet (768-1023px):** NavRail 自动折叠为图标模式
- [ ] **Mobile (<768px):** NavRail 隐藏，HeaderBar 出现汉堡菜单按钮
- [ ] Mobile: 点击汉堡菜单 → NavRail overlay 打开
- [ ] Mobile: 选择面板 → overlay 自动关闭
- [ ] Mobile: 点击 overlay 外部（backdrop）→ overlay 关闭
- [ ] 主内容区在 3 个断点下均正常显示，无溢出

### T5.2: Dark/Light 主题

操作：Settings → Theme 切换 或 HeaderBar 主题按钮

验证项：

- [ ] Dark 模式：深色背景，浅色文字，border 可见
- [ ] Light 模式：浅色背景，深色文字，border 可见
- [ ] System 模式：跟随系统偏好
- [ ] 切换后所有 19 面板均正确渲染（无残留硬编码颜色）
- [ ] hover/focus 状态在两个主题下均可见
- [ ] Chart（Recharts）在两个主题下正确显示

### T5.3: 键盘快捷键

操作：Dashboard 主界面

验证项：

- [ ] `Alt+1` → 切换到 Chat 面板
- [ ] `Alt+2` → 切换到 Agents 面板
- [ ] `Alt+3` ~ `Alt+9` → 切换到对应面板
- [ ] `Ctrl+K` (Mac: Cmd+K) → 聚焦当前面板搜索框
- [ ] `Ctrl+Enter` (Mac: Cmd+Enter) → Chat 面板发送消息
- [ ] `Escape` → 关闭移动端 overlay / blur 焦点
- [ ] `Ctrl+,` (Mac: Cmd+,) → 打开 Settings
- [ ] `Ctrl+/` (Mac: Cmd+/) → 切换 NavRail 折叠
- [ ] 在 input/textarea 聚焦时，Alt+N 不触发面板切换

### T5.4: 国际化 (i18n)

操作：Settings → Language 切换

验证项：

- [ ] 中文 → 英文：NavRail 标签、HeaderBar、所有面板标题/按钮均变为英文
- [ ] 英文 → 中文：恢复中文
- [ ] 日期/时间显示格式跟随 locale
- [ ] 无残留硬编码文字（所有 UI text 来自 i18n）
- [ ] Toast 通知文案跟随语言

### T5.5: 性能（Lazy Loading）

操作：DevTools → Network tab

验证项：

- [ ] 首次加载只下载 Chat 面板的 JS chunk
- [ ] 切换到其他面板时，异步加载对应 chunk（Network 中可见新请求）
- [ ] 首次切换时显示 loading spinner（Suspense fallback）
- [ ] 第二次切换同面板 → 无新请求（已缓存）

### T5.6: SSE 实时事件

操作：DevTools → Network tab → 筛选 EventStream

验证项：

- [ ] `/api/stream` 连接存在（SSE 长连接）
- [ ] 每 15s 收到 heartbeat（`: heartbeat\n\n`）
- [ ] Chat 发消息时，SSE 推送 chat 事件
- [ ] 断开网络 → 恢复 → SSE 自动重连

### T5.7: Gateway 断连恢复

操作：

1. 关闭 Gateway 进程（Ctrl+C）
2. 观察 Dashboard 状态
3. 重启 Gateway
4. 观察 Dashboard 恢复

验证项：

- [ ] Gateway 关闭后，Dashboard HeaderBar 显示 "Disconnected"（红色）
- [ ] API 调用返回 503 或错误提示（不崩溃）
- [ ] 重启 Gateway 后，Dashboard 自动重连
- [ ] 重连后 HeaderBar 恢复 "Connected"（绿色）
- [ ] **P3 修复验证 (F12):** 重启不叠加 EventBus 订阅者

**Phase 5 退出标准：** 响应式、主题、快捷键、i18n、性能、SSE、断连恢复全部通过。

---

## Phase 6: 二次开发功能验证

> 验证 enhanced fork 的非 Dashboard 增强功能。

### T6.1: 安全模块（CLI）

```bash
pnpm test -- src/infra/net/ssrf.test.ts --reporter=verbose
pnpm test -- src/infra/net/fetch-guard --reporter=verbose
pnpm test -- src/security/external-content.test.ts --reporter=verbose
```

验证项：

- [ ] SSRF 57 tests 全部 passing
- [ ] Fetch Guard tests 全部 passing
- [ ] External Content Unicode 防护 tests 全部 passing

### T6.2: Retry 框架（CLI）

```bash
pnpm test -- src/infra/retry --reporter=verbose
```

- [ ] 指数退避 + jitter tests 全部 passing

### T6.3: Memory Enhancement（浏览器 + CLI）

CLI 验证：

```bash
cd extensions/memory-lancedb && pnpm test --reporter=verbose
```

- [ ] 225 tests 全部 passing
- [ ] smart-extractor: 6-class extraction tests
- [ ] scopes: 5-mode isolation tests
- [ ] decay-engine: Weibull 3-tier tests
- [ ] llm-client: fetch-based JSON extraction tests

浏览器验证（Memory Browser 面板）：

- [ ] Scope filter 下拉框操作正常
- [ ] Tier badges 颜色正确（core=绿, working=黄/蓝, peripheral=灰/红）
- [ ] Vector search 结果带 decay score 显示

### T6.4: WeCom 扩展（CLI）

```bash
cd extensions/wecom && pnpm test --reporter=verbose
```

- [ ] Transport (WebSocket + HTTP) tests passing
- [ ] Enhanced modules (quota-tracker, reqid-store, reasoning-visibility) tests passing
- [ ] Integration tests passing
- [ ] Crypto tests passing
- [ ] Config routing tests passing

### T6.5: Restart Loop / Crash Recovery

```bash
pnpm test -- src/daemon/ --reporter=verbose
```

- [ ] launchd tests passing (macOS)
- [ ] schtasks parser tests passing (Windows `isRestartLoopLine`)

**Phase 6 退出标准：** 所有二次开发模块的自动化测试通过。

---

## Phase 7: 集成压力验证（浏览器）

> 模拟真实使用场景，验证跨面板数据一致性。

### T7.1: 多轮对话 + Session 追踪

操作：

1. Chat 面板发送 5 条消息
2. 切换到 Sessions 面板

验证项：

- [ ] Sessions 列表包含刚才的 session
- [ ] Token 统计与实际使用量一致
- [ ] 切回 Chat → 消息历史完整

### T7.2: Agent 创建 → Chat 切换

操作：

1. Agents 面板创建新 agent（自定义名称+模型）
2. Chat 面板 Agent Selector 选择新 agent
3. 发送消息

验证项：

- [ ] 新 agent 出现在 Chat 的 Agent Selector 中
- [ ] 切换 agent 后，新 session 创建
- [ ] 回复来自新 agent 配置的模型

### T7.3: Usage 数据一致性

操作：多次 Chat 后查看 Usage 面板

验证项：

- [ ] Token 计数增长与聊天量一致
- [ ] Cost 计算合理
- [ ] 时间窗口切换后数据变化

### T7.4: Config 修改 → 生效

操作：

1. Config Editor 修改某个配置项
2. 保存
3. 验证影响

验证项：

- [ ] Save 成功，无冲突
- [ ] 刷新后配置保持
- [ ] 相关面板反映配置变化

### T7.5: Doc Hub 端到端

操作：

1. Chat 面板发送一段长文本请求（如 "写一份 API 设计规范"）
2. 等待完整回复
3. 切换到 Doc Hub → Extract Docs

验证项：

- [ ] 提取出至少 1 篇文档
- [ ] 文档分类正确（应为 spec 或 plan）
- [ ] 文档内容为 AI 回复的完整内容
- [ ] Markdown 渲染正确

**Phase 7 退出标准：** 跨面板数据一致，核心使用流程无断裂。

---

## Phase 8: 已知缺陷回归验证

> 确认所有已记录的缺陷修复有效。

### P2 Deferred Findings（P3 T6 已修复）

| ID                      | 验证方法                                             | 通过？ |
| ----------------------- | ---------------------------------------------------- | ------ |
| F7: Approval 过期清理   | 创建审批 → 等待过期 → 刷新列表 → 过期项消失          | [ ]    |
| F9: Alerts SSE          | 触发 alert → Fired Alerts 列表实时更新（不需要刷新） | [ ]    |
| F10: Webhook retry      | 创建 webhook 指向不可达 URL → 触发 → 检查 retry 日志 | [ ]    |
| F11: Condition eval     | 创建 condition="<" 的 alert rule → 验证触发逻辑      | [ ]    |
| F12: Subscriber cleanup | 多次 onboarding save（重启 runtime）→ 事件不重复     | [ ]    |

### Codex L2 Findings（已修复）

| Finding                | 验证方法                                             | 通过？ |
| ---------------------- | ---------------------------------------------------- | ------ |
| `contains` 操作符移除  | Alert 创建不提供 `contains` → 默认 >= 生效           | [ ]    |
| Toast 消息格式         | 触发 alert → toast 显示正确的条件运算符              | [ ]    |
| Webhook retry 错误日志 | 制造 retry 失败 → 控制台有错误日志（不静默）         | [ ]    |
| LIKE 元字符转义        | Doc Hub 搜索 `%` → 不匹配所有文档                    | [ ]    |
| Token 掩码对齐         | Settings 保存（不修改 token）→ 实际 token 不被覆写   | [ ]    |
| Content blocks         | Chat 历史包含 tool_use blocks → Doc Hub 提取正确处理 | [ ]    |
| SessionKey 传递        | Doc Hub Extract → 使用当前 Chat session（非空）      | [ ]    |

**Phase 8 退出标准：** 所有已记录缺陷的修复均通过验证。

---

## 缺陷跟踪模板

测试过程中发现的新缺陷记录到此处：

```markdown
### BUG-NNN: [标题]

**严重度：** 阻碍性 / 已记录 / 有争议 / 视觉体验
**发现阶段：** Phase N, T-N.N
**复现步骤：**

1. ...
2. ...
3. ...

**期望行为：** ...
**实际行为：** ...
**文件位置：** `path/to/file:line`
**截图：** （如适用）
**处理决策：** 立即修复 / 延后 / 待讨论
```

---

## 测试完成标准

全部 Phase 通过后，确认以下全局标准：

- [ ] 593+ unit tests passing（dashboard 368 + memory 225）
- [ ] 35 E2E tests passing（Playwright）
- [ ] WeCom 120+ tests passing
- [ ] Security 160+ tests passing
- [ ] 0 TypeScript errors
- [ ] 0 lint errors
- [ ] 19/19 面板可操作
- [ ] 所有已知缺陷已修复或有明确延后理由
- [ ] 缺陷清单中无阻碍性缺陷残留

---

## 前置条件清单

- [ ] Node 22+ 已安装
- [ ] pnpm 已安装
- [ ] `pnpm install` 已执行
- [ ] LLM API Key 已准备（Onboarding Step 2 需要）
- [ ] 两个终端可用（Gateway + Dashboard）
- [ ] Chrome 浏览器可用（Playwright E2E）
