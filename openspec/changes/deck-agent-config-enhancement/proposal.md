## Why

Deck 的 Agent 配置面板已有 7 个 tab（Overview/Config/Routing/Skills/Context/Subagent/Sessions），但在工具管理、技能安装、文件浏览等方面相比官方 UI 存在显著功能缺失：

1. **工具管理粗粒度** — 仅有 ToolProfileSelector（minimal/coding/messaging/full 四选一），无法像官方 UI 那样逐个工具 allow/deny 覆盖。`tools.catalog` API 提供了完整的工具目录（core + plugin 分组、默认 profile 映射），Deck 未调用
2. **技能管理只读** — SkillsTab 展示技能列表和 eligibility，但无安装/更新 UI。`skills.install`（本地 + ClawHub）和 `skills.update`（配置 + 更新）API 完全未用
3. **文件浏览碎片化** — BootstrapFileEditor 散落在 ContextTab 中，缺少统一的文件列表视图。`agents.files.list` API 可返回完整文件清单（含 missing 状态、size、更新时间）但未调用
4. **Agent 身份信息不完整** — 不调用 `agent.identity.get`，agent emoji/avatar 依赖 `deck.agents.detail` 间接获取，信息不全（identity API 返回 `{ agentId, name?, avatar?, emoji? }`）
5. **模型 fallback 链缺失** — 官方 UI 支持 model fallback 配置（备选模型链），Deck 仅有单模型选择

## What Changes

- 新增 **Tools Catalog** 功能：调用 `tools.catalog` API，展示工具目录树（core/plugin 分组），支持 profile 选择 + 逐工具 allow/deny 覆盖
- 增强 **Skills Management**：新增技能安装 UI（本地路径 + ClawHub slug），技能配置编辑（apiKey、env 变量），技能更新功能
- 新增 **Files Browser**：调用 `agents.files.list` 获取完整文件清单，统一文件浏览/编辑入口
- 接入 `agent.identity.get`：在 Overview tab 展示 agent 身份信息（name、emoji、avatar）
- 新增 **Model Fallback** 配置：在 Config tab 添加 fallback 模型链编辑（有序列表）

## Capabilities

### New Capabilities

- `agent-tools-catalog`: 工具目录浏览与逐工具 allow/deny 覆盖管理，基于 tools.catalog API
- `agent-skills-management`: 技能安装（本地/ClawHub）、配置编辑、更新功能
- `agent-files-browser`: 统一文件浏览器，展示 agent bootstrap 文件清单并提供编辑入口
- `agent-identity-display`: Agent 身份信息展示（name/avatar/emoji），接入 agent.identity.get API
- `agent-model-fallback`: 模型 fallback 链配置，有序备选模型列表

### Modified Capabilities

(none)

## Impact

- **新 API 调用**: `tools.catalog`、`skills.install`、`skills.update`（config 路径）、`agents.files.list`、`agent.identity.get`
- **Gateway allowlist**: `tools.catalog`、`skills.install` 需检查是否已在 allowlist
- **新组件**: ToolsCatalogTab.tsx、SkillInstallDialog.tsx、SkillConfigEditor.tsx、FilesBrowser.tsx、FallbackChainEditor.tsx
- **修改组件**: OverviewTab.tsx（identity 展示）、AgentConfigTab.tsx（fallback 配置）、SkillsTab.tsx（安装/配置入口）
- **Store**: deck-agents store 需新增 tools catalog 和 files list 缓存
- **i18n**: `agents` 命名空间新增工具目录、技能安装、文件浏览相关 key
