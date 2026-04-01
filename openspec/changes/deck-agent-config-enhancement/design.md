## Context

Deck Agent 面板当前 7 个 tab 的分工：

- **Overview**: agent 基本信息 + 统计（bindings、skills、subagents、sessions 数量）
- **Config**: model 选择、thinking mode、event streams 配置、tool profile 选择
- **Routing**: binding 列表管理
- **Skills**: 技能列表 + enabled 切换（只读 eligibility）
- **Context**: system prompt 层叠查看 + bootstrap 文件编辑 + tool policy 可视化
- **Subagent**: spawn 权限 + allow-agents 白名单 + model override
- **Sessions**: agent 的 session 列表

后端已有但未接入的 API：

- `tools.catalog` — 返回 `{ groups: [{ id, label, source, tools: [{ id, label, source, defaultProfiles }] }] }`
- `skills.status` — 返回 `{ skills: [{ key, label, enabled, eligibility, metadata, reasons }] }`
- `skills.install` — 支持本地路径和 ClawHub slug 两种安装方式
- `skills.update` — 支持 enabled/apiKey/env 配置修改和 ClawHub 更新
- `agents.files.list` — 返回 `{ files: [{ name, path, missing, size, updatedAtMs }] }`
- `agent.identity.get` — 返回 `{ agentId, name?, avatar?, emoji? }`（注意：无 description/aliases 字段）

## Goals / Non-Goals

**Goals:**

- 提供完整的工具目录浏览和逐工具覆盖（替代当前粗粒度的 profile-only 选择）
- 让用户可以直接在 Deck 中安装和配置技能（无需 CLI）
- 提供统一的文件浏览入口（替代散落在 ContextTab 的零散编辑器）
- 完整展示 agent 身份信息（avatar、description 等当前缺失的字段）
- 支持 model fallback 链配置

**Non-Goals:**

- 不实现工具开发/调试功能 — 属于 CLI 领域
- 不实现 ClawHub 商店浏览 — 仅支持已知 slug 的安装
- 不重构现有 tab 结构 — 在现有 tab 内增强，不新增 tab（工具目录整合到 Config tab）
- 不实现 agent 身份编辑 — 身份信息通过 IDENTITY.md 编辑，不需要独立 UI

## Decisions

### D1: 工具目录整合到 Config tab 而非新建 Tab

**选择**: 在 AgentConfigTab 的 tool profile 选择器下方展开工具目录面板（collapsible），展示 tools.catalog 数据并支持逐工具覆盖。

**替代方案**: 新建独立的 "Tools" tab（与官方 UI 一致）。

**理由**: Deck 已有 7 个 tab，新增会增加导航复杂度。工具配置与 model/thinking 配置紧密相关，放在同一 tab 内减少切换。Collapsible 面板让不需要细粒度控制的用户可以折叠。

### D2: 技能安装使用 Dialog 而非内联表单

**选择**: SkillsTab 添加 "安装技能" 按钮，点击打开 Dialog 输入本地路径或 ClawHub slug。

**替代方案**: 在 SkillsTab 顶部内联安装表单。

**理由**: 安装是低频操作，Dialog 避免占用常态 UI 空间。ClawHub 和本地两种安装路径可以用 Tab 切换在 Dialog 内实现。

### D3: Files Browser 整合到 Context tab

**选择**: 在 ContextTab 顶部添加文件列表视图（调用 `agents.files.list`），替代当前零散的文件名按钮。

**替代方案**: 新建独立 "Files" tab。

**理由**: Context tab 本身就是文件编辑的主要入口（bootstrap files + system prompt），整合文件列表是自然扩展。文件列表显示 name、size、updatedAt、missing 状态，点击直接跳转到编辑。

### D4: Model Fallback 使用有序列表编辑器

**选择**: 在 Config tab 的 model 选择器下方添加 "Fallback Models" 有序列表，支持拖拽排序和添加/删除。

**理由**: Fallback 模型的顺序重要（首选 → 备选1 → 备选2），有序列表直观表达优先级。模型选项复用已有的 model combobox 数据。

### D5: Identity 信息使用 agent.identity.get 补充

**选择**: OverviewTab 在加载 `deck.agents.detail` 后额外调用 `agent.identity.get`，用返回的 avatar/name/emoji 补充 Overview 展示。

**理由**: `deck.agents.detail` 可能不包含完整的 identity 信息（如 avatar 图片 URL），`agent.identity.get` 是专门的 identity 查询端点。两次调用可并行，不增加等待时间。实际返回 `{ agentId, name?, avatar?, emoji? }`，不含 description/aliases。

## Risks / Trade-offs

- **[Config tab 复杂度]** 整合工具目录和 fallback 后 Config tab 内容较多 → 使用 Collapsible 分区，工具目录默认折叠
- **[技能安装安全性]** 本地路径安装可能指向任意目录 → 显示确认对话框，提示用户验证路径合法性
- **[API 兼容]** `tools.catalog` 和 `agent.identity.get` 是较新的 API，旧版 Gateway 可能不支持 → 调用失败时降级为当前行为（不显示工具目录，不显示额外 identity 信息）
- **[allowlist 同步]** 新增的 API 调用需确保在 gateway-allowlist.ts 中 → 作为第一个任务验证并添加
