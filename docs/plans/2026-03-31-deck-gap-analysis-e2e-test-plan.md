# Deck Gap Analysis — E2E Functional Test Plan

**Date:** 2026-03-31
**Scope:** 7 OpenSpec proposals (~9,866 LOC, 56 commits on `enhanced` branch)
**Execution Mode:** Mode A (Playwright MCP interactive)
**Total Test Cases:** 136

---

## Prerequisites

- [ ] Gateway running from local source: `scripts/dev/deck-dev.sh` or `NO_PROXY=localhost,127.0.0.1 pnpm openclaw gateway run --bind loopback --port 18789 --force`
- [ ] Dashboard running: `cd dashboard && NO_PROXY=localhost,127.0.0.1 pnpm dev`
- [ ] At least 1 Agent configured (main agent)
- [ ] At least 1 Channel configured (feishu/wecom/telegram)
- [ ] At least 2 chat sessions with history (for sessions/usage tests)
- [ ] Valid config at `~/.openclaw/openclaw.json`
- [ ] Verify API: `curl -s http://localhost:3000/api/deck/agents -X POST -H 'Content-Type: application/json' -d '{"action":"eventStreams.get","agentId":"main"}'` returns JSON

---

## Proposal 1: Shared List Infrastructure

> Infrastructure components consumed by multiple panels. Tested through **consumer panels** rather than in isolation.

### L1: ListSearchBar

Tested via Sessions panel (primary consumer).

| #      | P   | 用例              | 步骤                                             | 预期结果                                                   |
| ------ | --- | ----------------- | ------------------------------------------------ | ---------------------------------------------------------- |
| L1-001 | P0  | 搜索输入 debounce | 导航到 Sessions 面板 → 在搜索框中快速输入 "test" | 停止输入 300ms 后触发搜索；输入过程中不触发                |
| L1-002 | P0  | 回车立即搜索      | 搜索框输入 "direct" → 按 Enter                   | 立即触发搜索，不等 debounce                                |
| L1-003 | P0  | 清除按钮          | 有搜索词时 → 点击搜索框右侧 X 按钮               | 清除搜索词，恢复完整列表                                   |
| L1-004 | P1  | Escape 清除并收起 | 搜索框有值 → 按 Escape                           | 清除搜索词，收起高级筛选（如已展开）                       |
| L1-005 | P1  | 搜索结果计数      | 输入搜索词使部分匹配                             | 搜索框下方显示 "N results" 匹配计数                        |
| L1-006 | P1  | 高级筛选展开/收起 | 点击搜索框旁的筛选图标                           | 展开高级筛选区域（type multiselect, activeMinutes select） |

### L2: PaginatedList

Tested via Sessions panel (button mode, client-side pagination).

| #      | P   | 用例               | 步骤                                    | 预期结果                                            |
| ------ | --- | ------------------ | --------------------------------------- | --------------------------------------------------- |
| L2-001 | P0  | 初始页显示         | Sessions 有 30+ 条 → 打开 Sessions 面板 | 显示前 20 条（pageSize=20），底部显示"加载更多"按钮 |
| L2-002 | P0  | 加载更多           | 点击"加载更多"按钮                      | 追加下一页 20 条，按钮仍在底部（如有更多数据）      |
| L2-003 | P1  | 全部加载后隐藏按钮 | 多次点击直到全部加载                    | "加载更多"按钮消失                                  |
| L2-004 | P1  | 搜索后重置分页     | 已加载第 2 页 → 输入搜索词              | 结果从第 1 页开始显示，分页重置                     |

### L3: InlineEdit

Tested via Session detail (label editing).

| #      | P   | 用例                         | 步骤                                   | 预期结果                                  |
| ------ | --- | ---------------------------- | -------------------------------------- | ----------------------------------------- |
| L3-001 | P0  | 点击进入编辑                 | Session detail 中点击 label 文字       | 文字变为输入框，填入当前值，自动聚焦      |
| L3-002 | P0  | Enter 确认                   | 编辑 label → 输入新值 → 按 Enter       | 调用 patchSession，显示新值，退出编辑模式 |
| L3-003 | P0  | Escape 取消                  | 编辑 label → 修改值 → 按 Escape        | 恢复原值，退出编辑模式，不调用 API        |
| L3-004 | P1  | 失焦取消                     | 编辑中 → 点击编辑框外部                | 恢复原值，退出编辑模式                    |
| L3-005 | P1  | Select 模式（thinkingLevel） | Session detail 中点击 thinkingLevel 值 | 显示 Select 下拉框（Off/Low/Medium/High） |
| L3-006 | P1  | Select 选择确认              | 在 thinkingLevel 下拉中选择 "High"     | 调用 patchSession，显示新值               |

### L4: SortableHeader

Tested via BreakdownTable in Usage panel.

| #      | P   | 用例         | 步骤                                        | 预期结果                                           |
| ------ | --- | ------------ | ------------------------------------------- | -------------------------------------------------- |
| L4-001 | P0  | 点击排序循环 | Usage → BreakdownTable → 点击 "Cost" 列标头 | 第一次：升序（▲）；再点：降序（▼）；再点：取消排序 |
| L4-002 | P1  | 切换排序列   | 排序 Cost 列后 → 点击 Tokens 列标头         | Cost 排序清除，Tokens 进入升序                     |
| L4-003 | P2  | 键盘激活     | Tab 聚焦列标头 → 按 Enter 或 Space          | 与点击效果相同，触发排序循环                       |

### L5: BatchActionBar

Tested via any list with selection support (如 Agents list).

| #      | P   | 用例                   | 步骤                     | 预期结果                                    |
| ------ | --- | ---------------------- | ------------------------ | ------------------------------------------- |
| L5-001 | P1  | 选择显示 action bar    | 在列表中勾选 1 个条目    | 底部出现 BatchActionBar，显示 "1 selected"  |
| L5-002 | P1  | 全选                   | 点击 select all checkbox | 选中所有**当前过滤后的**条目，显示总计      |
| L5-003 | P1  | 清除选择               | 点击 "clear" 按钮        | 取消全部选择，ActionBar 消失                |
| L5-004 | P2  | 部分选择 indeterminate | 全选后取消 1 个          | select all checkbox 显示 indeterminate 状态 |

---

## Proposal 2: Usage Panel Rebuild

### U1: SummaryCards

| #      | P   | 用例           | 步骤                 | 预期结果                                                                                 |
| ------ | --- | -------------- | -------------------- | ---------------------------------------------------------------------------------------- |
| U1-001 | P0  | 6 指标卡片渲染 | 导航到 Usage 面板    | 显示 6 张卡片：Tokens In / Tokens Out / Total Cost / Messages / Tool Calls / Avg Latency |
| U1-002 | P0  | 数值格式化     | 观察卡片数值         | token 数用 K/M 缩写（如 12.3K）；成本显示 $X.XX；延迟显示 ms 或 s                        |
| U1-003 | P1  | 加载状态       | 刷新页面观察加载过程 | 卡片显示 loading skeleton，数据到达后替换为实际值                                        |
| U1-004 | P1  | 无数据状态     | 选择无活动的时间范围 | 卡片显示 "0" 或 "N/A"，不报错                                                            |

### U2: DateRange & Time Window

| #      | P   | 用例           | 步骤                             | 预期结果                         |
| ------ | --- | -------------- | -------------------------------- | -------------------------------- |
| U2-001 | P0  | 快捷时间范围   | 点击 "Today" / "7d" / "30d" 按钮 | 切换时间范围，所有子组件数据刷新 |
| U2-002 | P1  | 自定义日期范围 | 选择自定义 → 选择开始/结束日期   | 按选定范围请求数据               |
| U2-003 | P1  | 刷新按钮       | 点击刷新按钮                     | 使用当前时间范围重新获取数据     |

### U3: UsageChart

| #      | P   | 用例         | 步骤                      | 预期结果                            |
| ------ | --- | ------------ | ------------------------- | ----------------------------------- |
| U3-001 | P0  | 时间序列图表 | 选择 7d 范围              | 显示每日 token/cost 折线图          |
| U3-002 | P1  | 数据点悬停   | 鼠标悬停图表数据点        | 显示 tooltip：日期 + 具体数值       |
| U3-003 | P1  | Y 轴切换     | 点击 Tokens/Cost 切换按钮 | Y 轴在 Token 计数和成本金额之间切换 |
| U3-004 | P2  | 单日范围     | 选择 Today                | 图表正确渲染单日数据（不崩溃）      |

### U4: BreakdownTable

| #      | P   | 用例          | 步骤                                        | 预期结果                                        |
| ------ | --- | ------------- | ------------------------------------------- | ----------------------------------------------- |
| U4-001 | P0  | 维度 Tab 切换 | 点击 Model / Provider / Agent / Channel tab | 表格数据按选定维度分组显示                      |
| U4-002 | P0  | 表格列完整    | 查看表格                                    | 显示：维度名、Tokens In、Tokens Out、Cost、占比 |
| U4-003 | P1  | 排序交互      | 点击 Cost 列标头                            | 按成本排序（集成 SortableHeader）               |
| U4-004 | P2  | 空维度        | 选择 Channel tab 但无 channel 数据          | 显示空状态提示，不报错                          |

### U5: ContextPressure

| #      | P   | 用例            | 步骤                  | 预期结果                                |
| ------ | --- | --------------- | --------------------- | --------------------------------------- |
| U5-001 | P0  | 压力条渲染      | 有活跃 session 时查看 | 显示 context window 使用率进度条        |
| U5-002 | P1  | 颜色阈值        | 观察不同使用率        | <70% 正常色，70-90% 警告色，>90% 危险色 |
| U5-003 | P2  | 无 session 数据 | 无活跃 session        | 不渲染压力组件或显示空状态              |

---

## Proposal 3: Agent Config Enhancement

### A1: Agent Overview Tab

| #      | P   | 用例                | 步骤                        | 预期结果                                       |
| ------ | --- | ------------------- | --------------------------- | ---------------------------------------------- |
| A1-001 | P0  | Agent 列表渲染      | 导航到 Agents 面板          | 左侧显示 agent 列表（main + 其他配置的 agent） |
| A1-002 | P0  | 选择 Agent 显示详情 | 点击 "main" agent           | 右侧显示 agent detail，含 Overview 信息        |
| A1-003 | P0  | 模型信息显示        | 查看 Overview               | 显示 agent 的 model、tools 数量、状态          |
| A1-004 | P1  | Agent Badge         | 查看 agent 条目             | 显示 AgentBadge（颜色区分不同 agent）          |
| A1-005 | P2  | 移动端列表/详情切换 | 窗口缩到 375px → 点击 agent | 列表隐藏，显示详情；返回按钮回到列表           |

### A2: Context Tab

| #      | P   | 用例                 | 步骤                              | 预期结果                                                |
| ------ | --- | -------------------- | --------------------------------- | ------------------------------------------------------- |
| A2-001 | P0  | Context Tab 切换     | Agent detail 中点击 "Context" tab | 切换到 Context tab，显示 bootstrap 文件和 system prompt |
| A2-002 | P0  | Bootstrap 文件编辑器 | 查看 Context tab                  | BootstrapFileEditor 显示文件列表和编辑区域              |
| A2-003 | P1  | 系统提示词显示       | 查看 system prompt 区域           | 显示 agent 的 system prompt（只读或可编辑取决于权限）   |

### A3: Routing Tab

| #      | P   | 用例                 | 步骤                           | 预期结果                                     |
| ------ | --- | -------------------- | ------------------------------ | -------------------------------------------- |
| A3-001 | P0  | Routing Tab 切换     | 点击 "Routing" tab             | 显示 routing 规则列表                        |
| A3-002 | P0  | 路由规则显示         | 查看规则列表                   | 每条规则显示 channel pattern → agent mapping |
| A3-003 | P1  | Channel Event Stream | 查看 ChannelEventStreamSection | 显示 event stream 配置和状态                 |

### A4: Sessions Tab

| #      | P   | 用例              | 步骤                 | 预期结果                              |
| ------ | --- | ----------------- | -------------------- | ------------------------------------- |
| A4-001 | P0  | Sessions Tab 渲染 | 点击 "Sessions" tab  | 显示该 agent 关联的 session 列表      |
| A4-002 | P0  | Session 选择      | 点击列表中的 session | 显示 session 详情（消息历史或元数据） |
| A4-003 | P1  | Session 过滤      | 在搜索框输入关键词   | 过滤显示匹配的 session                |

### A5: Subagent Tab

| #      | P   | 用例              | 步骤                   | 预期结果                       |
| ------ | --- | ----------------- | ---------------------- | ------------------------------ |
| A5-001 | P0  | Subagent Tab 渲染 | 点击 "Subagent" tab    | 显示 subagent 配置和状态       |
| A5-002 | P1  | Subagent 树形关系 | 有 subagent 配置时     | 显示父子关系树（SubagentTree） |
| A5-003 | P2  | 无 Subagent       | agent 无 subagent 配置 | 显示空状态提示                 |

---

## Proposal 4: Chat UX Enhancement

### C1: Slash Commands

| #      | P   | 用例              | 步骤                          | 预期结果                               |
| ------ | --- | ----------------- | ----------------------------- | -------------------------------------- |
| C1-001 | P0  | 唤起命令面板      | Chat 输入框输入 "/"           | 弹出命令面板，显示可用命令列表         |
| C1-002 | P0  | 模糊搜索过滤      | 输入 "/co"                    | 过滤显示匹配命令（如 compact, config） |
| C1-003 | P0  | 键盘选择执行      | 输入 "/" → 箭头键选择 → Enter | 执行选中的命令                         |
| C1-004 | P0  | 鼠标点击执行      | 输入 "/" → 点击命令列表中的项 | 执行选中的命令                         |
| C1-005 | P1  | Escape 关闭面板   | 命令面板打开 → 按 Escape      | 关闭面板，保留输入框内容               |
| C1-006 | P1  | /new 创建新会话   | 执行 /new 命令                | 创建新 session，切换到新 session       |
| C1-007 | P1  | /export 导出      | 执行 /export 命令             | 下载当前 session 的 markdown 文件      |
| C1-008 | P2  | 非 "/" 开头不触发 | 输入 "hello /"                | 不弹出命令面板                         |

### C2: Input History

| #      | P   | 用例               | 步骤                                 | 预期结果                          |
| ------ | --- | ------------------ | ------------------------------------ | --------------------------------- |
| C2-001 | P0  | 上箭头浏览历史     | 发送 3 条消息后 → 空输入框按 ↑       | 显示最后一条发送的消息            |
| C2-002 | P0  | 下箭头返回         | 按 ↑ 浏览到第 2 条 → 按 ↓            | 返回第 3 条消息                   |
| C2-003 | P0  | 下箭头到底恢复草稿 | 在最新历史按 ↓                       | 恢复按 ↑ 之前的输入内容（草稿）   |
| C2-004 | P1  | 去重               | 连续发送相同消息 "hello" 两次 → 按 ↑ | 历史中只出现一次 "hello"          |
| C2-005 | P1  | 刷新后持久化       | 发送 5 条消息 → 刷新页面 → 按 ↑      | 历史恢复（sessionStorage 持久化） |
| C2-006 | P2  | 50 条上限          | 发送 52 条不同消息 → 按 ↑ 到底       | 最多浏览 50 条，最早 2 条被淘汰   |

### C3: Token Display & RunStatusBar

| #      | P   | 用例              | 步骤              | 预期结果                                        |
| ------ | --- | ----------------- | ----------------- | ----------------------------------------------- |
| C3-001 | P0  | 消息 token 显示   | 发送消息等待回复  | 助手消息底部显示 token 统计：↓X ↑Y（输入/输出） |
| C3-002 | P0  | RunStatusBar 渲染 | 查看助手回复下方  | 显示运行时间 + token 总计 + 估算成本            |
| C3-003 | P1  | 流式更新          | 助手正在回复时    | RunStatusBar 实时更新：计时器递增、token 数增长 |
| C3-004 | P1  | 流式结束          | 回复完成          | 计时器停止，显示最终 duration + token 总计      |
| C3-005 | P2  | 无 usage 数据     | 消息无 usage 字段 | 不渲染 token 行，不报错                         |

### C4: Compaction Notice

| #      | P   | 用例           | 步骤                                | 预期结果                                    |
| ------ | --- | -------------- | ----------------------------------- | ------------------------------------------- |
| C4-001 | P0  | 压缩通知显示   | 触发 context compaction（长对话后） | 消息流中插入系统通知卡片 "上下文已压缩"     |
| C4-002 | P1  | Token 增量显示 | 查看压缩通知                        | 显示压缩前后 token 变化量（before → after） |
| C4-003 | P2  | 通知卡片样式   | 查看通知外观                        | 使用 warning 色系背景，与普通消息视觉区分   |

---

## Proposal 5: Channel Config Framework

### CH1: Channel List & Discovery

| #       | P   | 用例             | 步骤                 | 预期结果                                      |
| ------- | --- | ---------------- | -------------------- | --------------------------------------------- |
| CH1-001 | P0  | Channel 列表渲染 | 导航到 Channels 面板 | 显示已配置的 channel 列表（类型、名称、状态） |
| CH1-002 | P0  | Channel 详情     | 点击列表中的 channel | 右侧显示 channel 详情和配置表单               |
| CH1-003 | P1  | 添加 Channel     | 点击添加按钮         | 弹出 ConfigWizard 引导配置                    |
| CH1-004 | P1  | 吞吐量图表       | 查看 channel 详情    | ThroughputChart 显示消息吞吐量                |

### CH2: Schema-Driven Config Form

| #       | P   | 用例                   | 步骤                          | 预期结果                                                           |
| ------- | --- | ---------------------- | ----------------------------- | ------------------------------------------------------------------ |
| CH2-001 | P0  | 表单自动生成           | 选择 channel → 查看配置       | 根据 channel schema 自动生成表单字段                               |
| CH2-002 | P0  | 字段类型正确           | 查看各字段                    | string→text input, boolean→switch, enum→select, sensitive→password |
| CH2-003 | P0  | 表单提交               | 修改字段值 → 保存             | 调用 API 保存配置，显示成功提示                                    |
| CH2-004 | P1  | 字段验证               | 输入非法值（如空的必填项）    | 显示验证错误信息（红色边框 + 错误文字）                            |
| CH2-005 | P1  | Password 字段切换      | 点击 sensitive 字段的眼睛图标 | 切换明文/密文显示                                                  |
| CH2-006 | P1  | configUiHints 排序     | 查看字段顺序                  | 字段按 schema configUiHints 定义的顺序排列                         |
| CH2-007 | P2  | 未知类型 JSON fallback | 有复杂/未知类型字段           | 显示只读 JSON + "在 Config Editor 中编辑" 链接                     |

### CH3: Feishu Wizard

| #       | P   | 用例          | 步骤                              | 预期结果                                     |
| ------- | --- | ------------- | --------------------------------- | -------------------------------------------- |
| CH3-001 | P0  | Wizard 步骤流 | 添加 Feishu channel → 进入 wizard | 显示分步引导（App ID → Secret → Webhook 等） |
| CH3-002 | P0  | 步骤导航      | 完成第一步 → 下一步               | 前进到下一步；可返回上一步                   |
| CH3-003 | P1  | 必填验证      | 跳过必填字段 → 下一步             | 阻止前进，显示验证错误                       |
| CH3-004 | P2  | Wizard 完成   | 完成所有步骤 → 确认               | 创建 channel，返回 channel 列表              |

### CH4: WeCom Wizard

| #       | P   | 用例               | 步骤                             | 预期结果                                              |
| ------- | --- | ------------------ | -------------------------------- | ----------------------------------------------------- |
| CH4-001 | P0  | WeCom wizard 流程  | 添加 WeCom channel → 进入 wizard | 显示 WeCom 特定步骤（Corp ID → Secret → Agent ID 等） |
| CH4-002 | P1  | 与 Feishu 流程独立 | 对比两个 wizard                  | WeCom 字段集和步骤与 Feishu 不同                      |

### CH5: Connection Probe

| #       | P   | 用例             | 步骤                             | 预期结果                                  |
| ------- | --- | ---------------- | -------------------------------- | ----------------------------------------- |
| CH5-001 | P0  | Probe 按钮可点击 | Channel 详情页                   | 显示"测试连接"按钮                        |
| CH5-002 | P0  | Probe 成功       | 点击测试连接（channel 配置正确） | 显示成功：绿色图标 + 延迟时间（如 120ms） |
| CH5-003 | P0  | Probe 失败       | 点击测试连接（配置错误）         | 显示失败：红色图标 + 错误信息             |
| CH5-004 | P1  | Probe 加载态     | 点击后观察                       | 按钮显示 loading spinner，禁止重复点击    |
| CH5-005 | P2  | Probe 超时       | 网络不可达时测试                 | 显示超时警告（黄色）                      |

---

## Proposal 6: Config Editor Enhancement

### CF1: Advanced Search

| #       | P   | 用例          | 步骤                               | 预期结果                                |
| ------- | --- | ------------- | ---------------------------------- | --------------------------------------- |
| CF1-001 | P0  | 普通搜索      | Config Editor → 搜索框输入 "model" | 过滤显示包含 "model" 的字段，匹配项高亮 |
| CF1-002 | P0  | tag: 前缀搜索 | 输入 "tag:security"                | 过滤显示带 security 标签的字段          |
| CF1-003 | P0  | 深度搜索      | 输入嵌套字段名（如 "apiKey"）      | 在所有 section 的嵌套层级中搜索匹配     |
| CF1-004 | P1  | 搜索高亮      | 搜索后查看匹配字段                 | 匹配文字高亮显示（嵌套路径也高亮）      |
| CF1-005 | P1  | 清除搜索      | 点击 X 或按 Escape                 | 清除搜索，恢复完整字段列表              |
| CF1-006 | P2  | 无匹配        | 搜索一个不存在的关键词             | 显示空状态 "无匹配结果"                 |

### CF2: Tag Filter

| #       | P   | 用例            | 步骤                              | 预期结果                                              |
| ------- | --- | --------------- | --------------------------------- | ----------------------------------------------------- |
| CF2-001 | P0  | 标签显示        | 打开 Config Editor                | 显示可用标签列表（如 security, advanced, network 等） |
| CF2-002 | P0  | 单标签过滤      | 点击 "security" 标签              | 只显示带 security 标签的字段                          |
| CF2-003 | P1  | 多标签组合      | 选择 security + advanced          | 显示同时带两个标签的字段（交集）                      |
| CF2-004 | P1  | 取消标签        | 再次点击已选标签                  | 取消过滤，恢复完整列表                                |
| CF2-005 | P1  | 标签 + 搜索组合 | 选择 security 标签后 → 搜索 "key" | 同时应用标签过滤和文本搜索                            |

### CF3: Conflict Resolution

| #       | P   | 用例              | 步骤                                                        | 预期结果                                |
| ------- | --- | ----------------- | ----------------------------------------------------------- | --------------------------------------- |
| CF3-001 | P0  | 冲突检测          | 在 A 标签修改字段 → 在 B 标签修改同一字段 → A 保存 → B 保存 | B 保存时检测到冲突，弹出 ConflictDialog |
| CF3-002 | P0  | 冲突对话框        | 查看 ConflictDialog                                         | 显示字段级 diff：本地值 vs 远程值       |
| CF3-003 | P0  | 选择本地值        | 在冲突对话框选择"使用本地"                                  | 使用本地修改覆盖远程值                  |
| CF3-004 | P0  | 选择远程值        | 在冲突对话框选择"使用远程"                                  | 使用远程值，丢弃本地修改                |
| CF3-005 | P1  | 逐字段合并        | 多个字段冲突                                                | 每个冲突字段可独立选择本地/远程         |
| CF3-006 | P1  | DiffPreviewDialog | 保存前预览变更                                              | 显示完整的变更预览对话框                |
| CF3-007 | P2  | 无冲突正常保存    | 修改字段 → 保存（无并发编辑）                               | 直接保存成功，不弹冲突对话框            |

---

## Proposal 7: Sessions & Logs Hardening

### S1: Sessions Search & Filter

| #      | P   | 用例              | 步骤                                         | 预期结果                                                   |
| ------ | --- | ----------------- | -------------------------------------------- | ---------------------------------------------------------- |
| S1-001 | P0  | 服务端搜索        | Sessions 面板 → 搜索框输入 session key 片段  | 调用 sessions.list search param，返回匹配结果              |
| S1-002 | P0  | Type 过滤         | 展开高级筛选 → 选择 "direct" type            | 只显示 kind=direct 的 session                              |
| S1-003 | P0  | 多 Type 过滤      | 选择 "direct" + "group"                      | 显示 kind=direct 或 kind=group 的 session                  |
| S1-004 | P1  | Active Time 过滤  | 选择 "最近 5 分钟"                           | 调用 sessions.list activeMinutes=5，只显示近期活跃 session |
| S1-005 | P1  | 组合过滤          | 搜索 "test" + type=direct + activeMinutes=60 | 三个条件同时生效                                           |
| S1-006 | P1  | Session 计数      | 查看列表底部                                 | 显示 sessionCount（如 "显示 20 / 共 45 个"）               |
| S1-007 | P2  | Subagent 类型过滤 | 选择 "subagent" type                         | 显示 key 中包含 ":subagent:" 的 session                    |

### S2: Session Patch

| #      | P   | 用例               | 步骤                                             | 预期结果                                            |
| ------ | --- | ------------------ | ------------------------------------------------ | --------------------------------------------------- |
| S2-001 | P0  | 编辑 Label         | Session detail → 点击 label → 输入新名称 → Enter | label 更新为新值（optimistic update）               |
| S2-002 | P0  | 编辑 ThinkingLevel | 点击 thinkingLevel → 选择 "High"                 | thinkingLevel 更新（调用 /api/chat/sessions/patch） |
| S2-003 | P0  | 切换 FastMode      | 点击 fastMode toggle                             | 切换 true/false，optimistic update                  |
| S2-004 | P1  | Patch 失败反馈     | 模拟 API 失败（如断网）                          | 显示错误 banner "操作失败"，3 秒后自动消失          |
| S2-005 | P1  | 清空 Label         | 编辑 label → 清空 → Enter                        | 发送 null 清空 label（显示为默认值或空）            |

### S3: Logs Ring Buffer

| #      | P   | 用例                | 步骤                                | 预期结果                        |
| ------ | --- | ------------------- | ----------------------------------- | ------------------------------- |
| S3-001 | P0  | 日志流显示          | 导航到 Logs 面板 → 启用 streaming   | 日志条目实时显示，2 秒轮询      |
| S3-002 | P0  | Buffer 计数显示     | 查看 Logs 面板底部                  | 显示 "当前 N / 最大 5000 条"    |
| S3-003 | P1  | Ring buffer 淘汰    | 持续产生日志超过 5000 条            | 最早的条目被淘汰，计数保持 5000 |
| S3-004 | P1  | 暂停/恢复 streaming | 点击 streaming toggle 关闭 → 再打开 | 暂停时不更新；恢复后继续轮询    |

### S4: Logs Render-Time Filter

| #      | P   | 用例               | 步骤                      | 预期结果                                           |
| ------ | --- | ------------------ | ------------------------- | -------------------------------------------------- |
| S4-001 | P0  | Level 过滤         | 选择只显示 "error" level  | 只显示 error 级别的日志，其他隐藏                  |
| S4-002 | P0  | Source 过滤        | 选择 source = "gateway"   | 只显示 gateway 来源的日志                          |
| S4-003 | P1  | 组合过滤           | level=warn + source=agent | 同时过滤 level 和 source                           |
| S4-004 | P1  | 过滤不丢数据       | 设置过滤后 → 取消过滤     | 恢复全部日志（render-time 过滤不丢弃 buffer 数据） |
| S4-005 | P2  | Session 关键词过滤 | 输入 session key          | 显示包含该 key 的日志条目                          |

---

## Cross-Cutting: Dark Mode

| #      | P   | 用例                | 步骤                               | 预期结果                                               |
| ------ | --- | ------------------- | ---------------------------------- | ------------------------------------------------------ |
| DM-001 | P0  | 全局暗色切换        | Settings → 切换暗色主题            | 所有面板背景和文字颜色切换到 dark 主题                 |
| DM-002 | P1  | Usage 面板暗色      | 暗色模式下打开 Usage               | 图表、卡片、表格使用 CSS variable，无硬编码白色        |
| DM-003 | P1  | Chat 面板暗色       | 暗色模式下查看 Chat                | 消息气泡、输入框、RunStatusBar、slash 命令面板正确渲染 |
| DM-004 | P1  | Config Editor 暗色  | 暗色模式下编辑 Config              | 搜索框、标签、冲突对话框、diff 预览正确渲染            |
| DM-005 | P1  | Sessions/Logs 暗色  | 暗色模式下查看 Sessions 和 Logs    | 列表、筛选器、InlineEdit、日志条目正确渲染             |
| DM-006 | P2  | Channel Wizard 暗色 | 暗色模式下打开 Feishu/WeCom Wizard | Wizard 步骤、表单、probe 结果正确渲染                  |
| DM-007 | P2  | Agent Detail 暗色   | 暗色模式下查看 Agent 各 Tab        | 所有 Tab 内容正确渲染                                  |

---

## Cross-Cutting: i18n

| #        | P   | 用例                | 步骤                          | 预期结果                                 |
| -------- | --- | ------------------- | ----------------------------- | ---------------------------------------- |
| I18N-001 | P0  | 中英文切换          | Settings → Language → English | 所有面板标题、按钮、标签切换为英文       |
| I18N-002 | P1  | Usage 面板 i18n     | English 模式下打开 Usage      | 所有指标名、tab 名、时间范围按钮为英文   |
| I18N-003 | P1  | Sessions 面板 i18n  | English 模式下查看 Sessions   | 搜索占位符、过滤选项、type 名称为英文    |
| I18N-004 | P1  | Slash Commands i18n | English 模式下输入 "/"        | 命令名和描述为英文                       |
| I18N-005 | P1  | Config Editor i18n  | English 模式下搜索和过滤      | 搜索占位符、标签名、冲突对话框按钮为英文 |
| I18N-006 | P2  | Channel Wizard i18n | English 模式下打开 Wizard     | 步骤标题、表单标签、验证消息为英文       |
| I18N-007 | P2  | Logs 面板 i18n      | English 模式下查看 Logs       | buffer 计数、过滤选项为英文              |

---

## Cross-Cutting: Responsive

| #        | P   | 用例                       | 步骤                        | 预期结果                               |
| -------- | --- | -------------------------- | --------------------------- | -------------------------------------- |
| RESP-001 | P1  | 平板 768px                 | 窗口缩到 768px → 浏览各面板 | 布局自适应，无水平溢出，侧边栏可能折叠 |
| RESP-002 | P1  | 手机 375px — Agents        | 375px → Agents 面板         | 列表和详情非同时显示，点击切换         |
| RESP-003 | P1  | 手机 375px — Chat          | 375px → Chat 面板           | 输入框和消息列表正确堆叠               |
| RESP-004 | P2  | 手机 375px — Usage         | 375px → Usage 面板          | 卡片纵向堆叠，图表可横向滚动或自适应   |
| RESP-005 | P2  | 手机 375px — Sessions      | 375px → Sessions 面板       | 列表和详情非同时显示，搜索框正常可用   |
| RESP-006 | P2  | 手机 375px — Config Editor | 375px → Config Editor       | 搜索框和标签过滤可用，字段表单堆叠     |
| RESP-007 | P2  | 大屏 1920px                | 1920px → 各面板             | 充分利用空间，无过度拉伸               |

---

## Execution Strategy

### Priority Batching

| 批次    | 优先级          | 用例数 | 预估时间              |
| ------- | --------------- | ------ | --------------------- |
| Batch 1 | P0 (Core)       | 52     | 主要功能验证          |
| Batch 2 | P1 (Important)  | 58     | 交互细节验证          |
| Batch 3 | P2 (Edge/Theme) | 27     | 边界+暗色+i18n+响应式 |

### Execution Order

1. **Batch 1 — P0 Core**（按面板依赖顺序）：
   - Sessions (S1, S2) → 验证 ListSearchBar/InlineEdit/PaginatedList infra
   - Chat (C1-C3) → 验证 slash command, history, token display
   - Usage (U1-U4) → 验证 SortableHeader/BreakdownTable infra
   - Agents (A1-A5) → 验证 tab 切换
   - Channels (CH1-CH5) → 验证 schema form, wizard, probe
   - Config Editor (CF1-CF3) → 验证搜索/标签/冲突
   - Logs (S3-S4) → 验证 streaming + filter

2. **Batch 2 — P1 Important**：同序遍历各面板 P1 用例

3. **Batch 3 — P2 Edge**：
   - Dark Mode (DM-001 → DM-007)
   - i18n (I18N-001 → I18N-007)
   - Responsive (RESP-001 → RESP-007)

### Playwright MCP Command Reference

```bash
# 导航到面板
browser_navigate → http://localhost:3000

# 获取页面结构
browser_snapshot → accessibility tree

# 基线截图
browser_take_screenshot → deck-e2e/{panel}-{feature}-{state}.png

# 交互操作
browser_click → 按钮/链接
browser_fill_form → 输入框
browser_select_option → 下拉选择
browser_press_key → Enter/Escape/ArrowUp/ArrowDown

# 响应式测试
browser_resize → { width: 375, height: 812 }  # iPhone
browser_resize → { width: 768, height: 1024 }  # iPad
browser_resize → { width: 1920, height: 1080 } # Desktop
```

### File → Panel Mapping (Incremental Testing)

| 变更文件路径                        | 测试面板                    |
| ----------------------------------- | --------------------------- |
| `components/panels/usage/*`         | U1-U5                       |
| `components/panels/agents/*`        | A1-A5                       |
| `components/panels/chat/*`          | C1-C4                       |
| `components/panels/channels/*`      | CH1-CH5                     |
| `components/panels/config-editor/*` | CF1-CF3                     |
| `components/panels/sessions/*`      | S1-S2                       |
| `components/panels/logs/*`          | S3-S4                       |
| `components/lists/*`                | L1-L4 (via consumer panels) |
| `stores/sessions.ts`                | S1-S2, A4                   |
| `stores/logs.ts`                    | S3-S4                       |
| `stores/chat*.ts`                   | C1-C4                       |
| `stores/channels.ts`                | CH1-CH5                     |
| `i18n/*.json`                       | I18N-\*                     |
| `app/globals.css`                   | DM-\*                       |

---

## Test Case Summary

| 提案                 | 组      |     P0 |     P1 |     P2 |   Total |
| -------------------- | ------- | -----: | -----: | -----: | ------: |
| 1. Shared List Infra | L1-L5   |      7 |     10 |      2 |      19 |
| 2. Usage Panel       | U1-U5   |      5 |      6 |      3 |      14 |
| 3. Agent Config      | A1-A5   |      7 |      4 |      2 |      13 |
| 4. Chat UX           | C1-C4   |      8 |      8 |      4 |      20 |
| 5. Channel Config    | CH1-CH5 |     10 |      7 |      4 |      21 |
| 6. Config Editor     | CF1-CF3 |      5 |      6 |      2 |      13 |
| 7. Sessions & Logs   | S1-S4   |      8 |      6 |      2 |      16 |
| Cross: Dark Mode     | DM      |      1 |      4 |      2 |       7 |
| Cross: i18n          | I18N    |      1 |      4 |      2 |       7 |
| Cross: Responsive    | RESP    |      0 |      3 |      4 |       7 |
| **Total**            |         | **52** | **58** | **27** | **137** |
