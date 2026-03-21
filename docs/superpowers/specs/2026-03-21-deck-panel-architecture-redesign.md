# OpenClaw Deck 面板架构重设计

> **Codex 审查状态：** R1 完成，11 findings 全部已修正
> **代码对齐：** 2026-03-22 基于最新代码库校准（67 API routes, 28 stores, 21 面板目录）

## 设计目标

将 Deck Dashboard 从"部分覆盖的管理工具"升级为"完整的白盒化运维 + 用户交互平台"。

### 核心原则

1. **配置即文档** — 通过 UI 就能理解 OpenClaw 的工作原理
2. **产出即反馈** — 能看到 session、agent 做了什么、文件产出在哪里
3. **同一 UI 两层深度** — 表面是产出，往下钻是原理

### 用户角色（当前为虚拟人设，暂不做权限分离）

| 角色         | 关注点                                           | UI 深度  |
| ------------ | ------------------------------------------------ | -------- |
| **运维视角** | 理解配置原理、管理 agent/渠道/策略、观测执行过程 | 完整深度 |
| **用户视角** | 对话、查看产出、了解 agent 做了什么              | 表层     |

> **Future:** 多用户场景时增加 role-based IA。当前面板设计在信息分层上预留角色扩展。

---

## 现状基线（2026-03-22 代码快照）

### 已有面板清单（21 个 + settings）

**NavRail 当前 4 组：**

```
core:     chat, agents, routing, gateway, models
observe:  subagents, usage, sessions, memory, logs, activity
automate: cron, webhooks, approvals, skills
control:  budget, alerts, channels, config, docs
+ settings (独立底部)
```

### 各面板实际能力矩阵

| 面板          | 组件数 | 已有能力                                                                                                                                                                            | 成熟度 |
| ------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **Chat**      | 15+    | 对话流、流式、附件、审批、A2UI Bridge、CanvasPanel、RightPanel、ToolProgressBar、BlockFilterBar、Artifacts(8 类型)、5 种 content block 渲染(Image/File/Thinking/ToolUse/ToolResult) | ★★★★☆  |
| **Agents**    | 5 Tab  | Overview + Routing + Skills + Subagent + Sessions Tab                                                                                                                               | ★★★☆☆  |
| **Models**    | 23     | Catalog(Provider 浏览+详情) + Config(添加 Provider+Auth 探测) + Fallbacks(链编辑器+拖拽) + Usage(费用趋势+配额) — 4 个 Tab                                                          | ★★★★☆  |
| **Routing**   | 3      | BindingTable + RouteSimulator(匹配测试器)                                                                                                                                           | ★★★☆☆  |
| **Subagents** | 4      | ActiveRuns + Config + History — 3 个 Tab                                                                                                                                            | ★★★☆☆  |
| **Approvals** | 5      | PendingList + PolicyEditor + PathAllowlist + SSE 实时                                                                                                                               | ★★★☆☆  |
| **Sessions**  | 3      | SessionList + SessionDetail                                                                                                                                                         | ★★☆☆☆  |
| **Channels**  | 4      | ChannelList + ChannelDetail + BindingsTab                                                                                                                                           | ★★☆☆☆  |
| **Skills**    | 4      | SkillList + SkillConfig + SkillMatrixTab                                                                                                                                            | ★★★☆☆  |
| **Config**    | 4      | SchemaForm + SectionNav + ConflictDialog — 已有 Schema 驱动表单                                                                                                                     | ★★★☆☆  |
| **Gateway**   | 3      | ConnectionCard + HealthCard + HeartbeatCard                                                                                                                                         | ★★★☆☆  |
| **Usage**     | 5      | SummaryCards + UsageChart + BreakdownTable + ContextPressure                                                                                                                        | ★★★☆☆  |
| **Activity**  | 3      | EventTimeline + SSE 实时 — Monitor 雏形                                                                                                                                             | ★★☆☆☆  |
| **Cron**      | 5      | JobList + JobForm + RunHistory + RunNowButton                                                                                                                                       | ★★★☆☆  |
| **Memory**    | 5      | SearchPanel + FileTree + KnowledgeGraph + HealthDiagnostics                                                                                                                         | ★★★☆☆  |
| **Logs**      | 4      | LogStream + LogFilters + Polling                                                                                                                                                    | ★★☆☆☆  |
| **Budget**    | 4      | BudgetStatus + RuleForm + RuleList                                                                                                                                                  | ★★☆☆☆  |
| **Alerts**    | 4      | FiredAlertsList + RuleForm + RuleList                                                                                                                                               | ★★☆☆☆  |
| **Webhooks**  | 3      | WebhookForm + DeliveryHistory                                                                                                                                                       | ★★☆☆☆  |
| **Docs**      | 4      | DocList + DocViewer + CategoryFilter                                                                                                                                                | ★★☆☆☆  |
| **Settings**  | 5      | Connection + Appearance + Notification + About                                                                                                                                      | ★★★☆☆  |

---

## 三层分级框架

### 分级判断标准

1. **需要可视化才能理解吗？** → **Tier 1**
2. **字段间有耦合关系吗？** → **Tier 2**
3. **配错有风险吗？** → **Tier 2**（加校验提示）
4. **以上都不是** → **Tier 3**

---

## 面板升级计划

> 基于代码实际状态重新评估。标注变化：✅ 已具备 / 🔧 需增强 / 🆕 需新增

### Tier 1 — 专用交互 UI（7 个面板）

#### 1.1 Chat Panel — 对话 + 会话内解释层

**动作：** 🔧 增强（已有大量基础，补充白盒深度）

**已具备：**

- ✅ 对话流、流式输出、附件上传（MessageInput）
- ✅ 审批对话框（ApprovalDialog）
- ✅ A2UI Bridge + Canvas 面板（a2ui-bridge.ts, CanvasPanel）
- ✅ 工具进度条（ToolProgressBar）
- ✅ Block 过滤（BlockFilterBar）
- ✅ 5 种 content block 渲染（Image/File/Thinking/ToolUse/ToolResult）
- ✅ Artifact 检测 + 多格式查看器（HTML/SVG/Mermaid/JSON/CSV/Markdown/Code）
- ✅ RightPanel 统一右侧面板

**需增强：**

- 🔧 工具调用详情：ToolUseCard/ToolResultCard → 格式化可交互视图（非原始 JSON 折叠）
- 🔧 文件操作 diff 预览：read/write 工具结果 → 内联 diff viewer
- 🔧 命令执行日志：bash 结果 → 命令 + stdout/stderr + 退出码分离展示
- 🆕 运行状态指示器：当前模型 / token 消耗 / 耗时（消息级别）
- 🆕 子 agent 内联状态卡片

**职责边界：** Chat = 会话内解释层（当前会话）。跨 run 统计/时间线由 Monitor 负责。

#### 1.2 Agent Workspace — Agent 完整工作台

**动作：** 🔧 增强（已有 Tab 框架，补充深度功能）

**已具备：**

- ✅ Agent 列表/CRUD + 详情（AgentList + AgentDetail）
- ✅ 5 个 Tab：Overview / Routing / Skills / Subagent / Sessions

**需增强：**

- 🔧 Overview Tab：增加 Model Fallback 链可视化（Models 面板已有 FallbackChain，复用）
- 🔧 Skills Tab：增加 Tool Policy 可视化（5 层策略叠加 + 最终效果预览）
- 🆕 Context Tab：system prompt 组成预览（bootstrap + identity + skills → 完整 prompt）
- 🆕 Sandbox 模式选择器
- 🆕 Identity 预览（avatar/emoji/theme）
- 🆕 Bootstrap 文件编辑器

**新增 RPC：** `deck.agents.toolPolicy.preview`, `deck.agents.systemPrompt.preview`

#### 1.3 Execution Monitor — 跨 run 运维层

**动作：** ⬆ 升级 Activity → Monitor（已有 EventTimeline 雏形，大幅扩展）

**已具备：**

- ✅ ActivityPanel + EventTimeline + SSE 实时事件流
- ✅ 事件类型分类（tool_call / chat / status / agent / system）
- ✅ 事件过滤和搜索

**需增强/新增：**

- 🔧 从简单事件列表 → 完整执行观测台
- 🆕 执行时间线（甘特图式）
- 🆕 工具调用瀑布图
- 🆕 文件变更汇总
- 🆕 模型调用统计（调用次数/token/fallback）
- 🆕 子 agent 执行树
- 🆕 Compaction 事件标记
- 🆕 按 runId 回溯历史执行
- 🆕 Gateway 诊断视图（从 Gateway Panel 迁入：Connection + Health + Heartbeat）

**数据持久化：** 扩展 projection-store → 新增 `run_events` SQLite 表。

#### 1.4 Routing Rules — 路由规则编辑器

**动作：** 🔧 增强（已有基础组件）

**已具备：**

- ✅ BindingTable（规则列表）
- ✅ RouteSimulator（匹配测试器）

**需增强：**

- 🔧 条件编辑器（channel + accountId + peer + role + guildId 组合编辑）
- 🆕 拖拽排序优先级
- 🆕 规则冲突检测
- 🆕 路由命中记录（最近 N 条消息的实际路由结果）

#### 1.5 Subagent Topology — 子 Agent 拓扑

**动作：** 🔧 增强（已有 3 Tab，补充可视化）

**已具备：**

- ✅ ActiveRunsTab（活跃列表）
- ✅ ConfigTab（配置管理）
- ✅ HistoryTab（历史记录）
- ✅ kill 操作

**需增强：**

- 🆕 父子关系树形图 / DAG 可视化
- 🆕 点击节点查看 session 历史
- 🆕 steer 操作（向运行中子 agent 注入指令）
- 🆕 附件传递可视化

**新增 RPC：** `deck.subagents.steer`

#### 1.6 Channel Manager — 渠道管理

**动作：** 🔧 增强（已有列表+详情，补充配置向导）

**已具备：**

- ✅ ChannelList + ChannelDetail
- ✅ BindingsTab（渠道绑定）

**需增强：**

- 🆕 WeCom 配置向导（4 种传输模式选择 + 引导）
- 🆕 Feishu 配置向导（WebSocket / Webhook）
- 🆕 多账户管理
- 🆕 消息吞吐量监控

#### 1.7 Session Manager — 会话管理

**动作：** 🔧 增强（已有列表+详情，补充健康度）

**已具备：**

- ✅ SessionList + SessionDetail

**需增强：**

- 🆕 DM scope 策略选择器（4 种策略图示）
- 🆕 Session key 解析展示
- 🆕 上下文健康度（token 用量 / compaction 次数）
- 🆕 Transcript 搜索
- 🆕 Session 导出

---

### Tier 2 — 增强表单 + 引导（7 个面板）

#### 2.1 Models Hub

**动作：** ✅ 基本完成（已有 4 Tab + 23 组件，微调即可）

**已具备：** Catalog(Provider 浏览+详情) + Config(添加 Provider+Auth 探测+ProbeButton) + Fallbacks(链编辑器+拖拽+ModelCard) + Usage(费用趋势+配额)

**微调：** 增加每个 agent 使用的模型概览（交叉引用 Agents 面板）

#### 2.2 Scheduler

**动作：** 🔧 增强（合并 Cron + Heartbeat）

**已具备：** JobList + JobForm + RunHistory + RunNowButton（Cron 部分完整）

**需增强：**

- 🆕 合并 heartbeat 配置（interval + activeHours + target）
- 🆕 下次执行倒计时

#### 2.3 Approval Policies

**动作：** ✅ 基本完成（已有策略编辑器 + 白名单 + 待审列表）

**已具备：** PolicyEditor + PathAllowlist + PendingList + SSE 实时

**微调：** 增加审批历史记录（已审批的决策日志）

#### 2.4 Skills Manager

**动作：** 🔧 小增强

**已具备：** SkillList + SkillConfig + SkillMatrixTab

**需增强：** 安装/卸载/更新操作、环境变量配置

#### 2.5 Usage & Cost

**动作：** ✅ 基本完成

**已具备：** SummaryCards + UsageChart + BreakdownTable + ContextPressure

**微调：** 按 agent 分维统计

#### 2.6 Budget & Alerts

**动作：** ✅ 保持现状

**已具备：** Budget(BudgetStatus + RuleForm + RuleList) + Alerts(FiredAlertsList + RuleForm + RuleList)

#### 2.7 Webhooks

**动作：** ✅ 保持现状

**已具备：** WebhookForm + DeliveryHistory

---

### Tier 3 — Schema 自动表单 + 独立面板

#### 3.1 Advanced Config — 全量 Gateway 配置

**动作：** 🔧 增强（**已存在** ConfigPanel + SchemaForm）

**已具备：**

- ✅ SchemaForm 组件（从 schema-parser 渲染表单）
- ✅ SectionNav（按 section 导航）
- ✅ ConflictDialog（baseHash 冲突处理）
- ✅ config.schema RPC 集成
- ✅ config.get / config.apply 读写

**需增强：**

- 🔧 扩展 schema-parser：支持 union/record/complex 类型
- 🔧 uiHints 映射：sensitive → password input、advanced → 折叠、placeholder
- 🆕 变更 diff 预览
- 🆕 写入策略判断：patch（增量）vs set（结构性变更）

#### 3.2 Settings — Deck 本地设置

**动作：** ✅ 保持

**已具备：** Connection + Appearance + Notification + About（4 个 Section）

> **双配置域模型：** Gateway config（Config 面板）和 Deck local settings（Settings 面板）独立管理。

#### 3.3 其他保持现状的面板

| 面板   | 动作    | 说明                                           |
| ------ | ------- | ---------------------------------------------- |
| Memory | ✅ 保持 | SearchPanel + FileTree + KnowledgeGraph 已完善 |
| Logs   | ✅ 保持 | LogStream + Filters 已够用                     |
| Docs   | ✅ 保持 | DocHub + Viewer 已完善                         |

---

## 导航结构调整

### 当前 4 组 → 优化为 4 组（微调）

```
── core (核心) ──
├── 💬 Chat          — 对话 + 会话内解释层          [T1] 🔧增强
├── 🤖 Agents        — Agent 工作台                  [T1] 🔧增强
├── 🔀 Routing       — 路由规则编辑器                [T1] 🔧增强
├── 🧠 Models        — 模型目录                      [T2] ✅基本完成

── observe (观测) ──
├── 🔭 Monitor       — 执行观测台(原Activity升级)     [T1] ⬆大幅升级
├── 👶 Subagents     — 子 Agent 拓扑                 [T1] 🔧增强
├── 📊 Usage         — 用量 + 费用                   [T2] ✅完成
├── 💾 Sessions      — 会话管理                      [T1] 🔧增强
├── 🧠 Memory        — 记忆系统                      ✅保持
├── 📋 Logs          — 日志流                        ✅保持

── automate (自动化) ──
├── ⏰ Scheduler     — Cron + 心跳                   [T2] 🔧增强
├── 🔗 Webhooks      — Webhook 管理                  ✅保持
├── 🛡 Approvals     — 审批策略                      [T2] ✅基本完成
├── 📜 Skills        — 技能管理                      [T2] 🔧小增强

── control (管控) ──
├── 💰 Budget        — 预算控制                      ✅保持
├── 🔔 Alerts        — 告警规则                      ✅保持
├── 📡 Channels      — 渠道管理                      [T1] 🔧增强
├── ⚙️ Config        — 全量 Gateway 配置             [T3] 🔧增强
├── 📖 Docs          — 文档中心                      ✅保持
└── 🔧 Settings      — Deck 本地设置                 ✅保持

顶栏常驻:
└── 🟢 Gateway 连接状态指示器（Gateway 面板诊断迁入 Monitor）
```

**变化说明：**

- `activity` → 重命名为 `monitor`（面板升级为完整执行观测台）
- `gateway` → 降级为顶栏指示器（诊断功能迁入 Monitor）
- 保留 4 组结构（与现有代码一致，减少导航重构）
- 原 `control` 组不变

---

## 白盒观测层设计

两个互补层面，职责不重叠：

| 层面              | 承载面板              | 范围                                               |
| ----------------- | --------------------- | -------------------------------------------------- |
| **会话内解释层**  | Chat Panel            | 当前会话的当次执行 — 工具详情、文件 diff、命令输出 |
| **跨 run 运维层** | Monitor (原 Activity) | 所有 run 的历史 — 时间线、瀑布图、资源消耗         |

### 8 个观测维度

| 维度             | Chat（会话内）                     | Monitor（跨 run）      |
| ---------------- | ---------------------------------- | ---------------------- |
| 💭 思考过程      | ✅ ThinkingBlock 已有              | —                      |
| 🔧 工具调用追踪  | 🔧 ToolUseCard/ToolResultCard 增强 | 🆕 全局事件流 + 瀑布图 |
| 📂 文件操作记录  | 🆕 diff 预览                       | 🆕 文件变更汇总        |
| ⌨️ 命令执行日志  | 🔧 格式化展示                      | 🆕 历史命令查询        |
| 🧠 模型调用详情  | 🆕 状态栏                          | 🆕 统计                |
| 👶 子 Agent 视图 | 🆕 内联卡片                        | 🔧 树形可视化          |
| 📦 Session 状态  | 🆕 底栏                            | 🔧 健康度              |
| 📁 工作区浏览    | —                                  | 🆕 文件树              |

---

## 技术方案

### Schema 自动表单增强 (Tier 3)

```
现有: config.schema RPC → schema-parser.ts → SchemaForm.tsx → config.apply
增强: 扩展 schema-parser (union/record) + uiHints 映射 + diff 预览 + 写入策略判断
```

**写入策略矩阵：**

| 操作类型   | 使用的 RPC                    | 说明                          |
| ---------- | ----------------------------- | ----------------------------- |
| 增量修改   | `config.patch`                | merge-patch，适合单字段更新   |
| 结构性变更 | `config.set` / `config.apply` | 完整覆写，避免数组 merge 问题 |

### 事件持久化（Monitor 数据面）

```
现有: Gateway WS → event-bus → ActivityPanel (内存)
增强: event-bus → run-event-store (SQLite) → Monitor 查询 API
```

- 扩展 `dashboard/server/projection-store.ts`，新增 `run_events` 表
- 按 runId 和时间窗口分页查询
- 保留最近 7 天

### 新增 Gateway RPC

| 需求               | 现有 | 需要                               |
| ------------------ | ---- | ---------------------------------- |
| Tool policy 预览   | 无   | `deck.agents.toolPolicy.preview`   |
| System prompt 预览 | 无   | `deck.agents.systemPrompt.preview` |
| 文件产出列表       | 无   | `deck.agents.workspace.files`      |
| Subagent steer     | 无   | `deck.subagents.steer`             |

> **安全说明（Future）：** 多用户场景需 SSE 事件级授权 + 脱敏分级。

---

## 实施优先级（6 个 OpenSpec 提案）

| 提案                                  | 范围                                                                      | 工作量评估     |
| ------------------------------------- | ------------------------------------------------------------------------- | -------------- |
| **P1: Config 增强**                   | 扩展 schema-parser + uiHints + diff + 写入策略 + Gateway 指示器迁移       | 小（已有框架） |
| **P2: Chat 白盒升级**                 | ToolUseCard/ToolResultCard 增强 + 文件 diff + 命令日志格式化 + 运行指示器 | 中             |
| **P3: Agent Workspace**               | Context Tab + Tool Policy 可视化 + 新 RPC                                 | 中             |
| **P4: Monitor 升级**                  | Activity → Monitor（事件持久化 + 时间线 + 瀑布图 + Gateway 诊断迁入）     | 大             |
| **P5: Routing + Session + Channel**   | 条件编辑器 + DM scope + 渠道向导                                          | 中             |
| **P6: Subagent + Scheduler + Skills** | 树形可视化 + steer + heartbeat 合并 + 安装管理                            | 中             |

---

## 变更统计（校准后）

| 动作        | 数量 | 面板                                                                                       |
| ----------- | ---- | ------------------------------------------------------------------------------------------ |
| ⬆ 大幅升级  | 1    | Activity → Monitor                                                                         |
| 🔧 增强     | 8    | Chat, Agents, Routing, Subagents, Channels, Sessions, Config, Scheduler                    |
| 🔧 小增强   | 2    | Skills, Models                                                                             |
| ✅ 保持     | 10   | Usage, Approvals, Budget, Alerts, Webhooks, Memory, Logs, Docs, Settings, Gateway(→指示器) |
| 🆕 真正新增 | 0    | 无（所有面板已有基础实现）                                                                 |

> **关键认知修正：** 没有真正的"新增"面板。所有 21 个面板已存在代码实现。工作重点是**深度增强**而非从零创建。

---

## Codex 审查修正记录

| Finding               | 处置       | 修正                    |
| --------------------- | ---------- | ----------------------- |
| F1: SSE 无鉴权        | P1→P2 降级 | 增加 Future 说明        |
| F2+F3: 事件持久化     | 采纳       | Deck SQLite run_events  |
| F4: Schema 渲染       | 采纳       | 扩展现有 schema-parser  |
| F5: config.patch 问题 | 采纳       | 写入策略矩阵            |
| F6: Gateway→Config    | 采纳       | 改为迁入 Monitor        |
| F7: Settings 独立     | 采纳       | 双配置域模型            |
| F8: Chat vs Monitor   | 采纳       | 会话内 vs 跨 run        |
| F9: 角色导航          | 采纳       | 保留 4 组 + Future RBAC |
| F10: steer RPC        | 采纳       | 补齐契约                |
| F11: 基线失真         | 采纳       | 全面校准现状            |
