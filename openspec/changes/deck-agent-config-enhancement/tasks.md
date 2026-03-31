## 1. API 准备与 Allowlist

- [x] 1.1 验证 `tools.catalog`、`skills.install`、`skills.update`、`agents.files.list`、`agent.identity.get` 在 gateway-allowlist.ts 中的状态，缺失的添加
- [x] 1.2 新增/确认 API 路由：`/api/agents/tools-catalog`、`/api/agents/skills-install`、`/api/agents/skills-update`、`/api/agents/files-list`、`/api/agents/identity`
- [x] 1.3 在 deck-agents store 中添加 toolsCatalog 和 filesList 缓存字段及 fetch 方法

## 2. 工具目录（Config Tab）

- [x] 2.1 实现 ToolsCatalog 组件：Collapsible 面板，调用 tools.catalog 展示分组工具列表（core/plugin），每个工具显示名称、来源、默认 profiles
- [x] 2.2 实现逐工具 allow/deny 覆盖：三态开关（默认/允许/拒绝），修改后调用 agent config 更新 API
- [x] 2.3 集成到 AgentConfigTab：在 ToolProfileSelector 下方添加 ToolsCatalog 折叠区域
- [x] 2.4 实现 API 不可用时的优雅降级（不渲染工具目录区域）

## 3. 技能管理（Skills Tab）

- [x] 3.1 新增 SkillInstallDialog：两个 tab（本地路径 / ClawHub slug），调用 skills.install API，显示安装进度和结果
- [x] 3.2 新增技能配置编辑器：展开式编辑区域，支持 apiKey 输入和 env 键值对编辑，调用 skills.update 保存
- [x] 3.3 新增 ClawHub 技能更新功能：单个更新按钮和 "全部更新" 按钮，调用 skills.update
- [x] 3.4 在 SkillsTab 中集成安装按钮和配置/更新入口

## 4. 文件浏览器（Context Tab）

- [x] 4.1 实现 FilesBrowser 组件：调用 agents.files.list，渲染文件列表（name、size、updatedAt、missing 标签）
- [x] 4.2 实现文件点击编辑：点击文件行展开 BootstrapFileEditor 编辑该文件
- [x] 4.3 实现 missing 文件创建：missing 文件行显示 "创建" 按钮，打开空编辑器
- [x] 4.4 集成到 ContextTab 顶部，替代当前的零散文件名按钮

## 5. Agent 身份与 Model Fallback

- [x] 5.1 在 OverviewTab 中调用 agent.identity.get，展示 avatar 图片、description 文本、alias badges
- [x] 5.2 实现 identity API 不可用时的降级（保持当前 deck.agents.detail 数据展示）
- [x] 5.3 新增 FallbackChainEditor 组件：有序列表编辑器，支持添加/删除/排序 fallback 模型
- [x] 5.4 集成 FallbackChainEditor 到 AgentConfigTab 的 model 选择器下方

## 6. i18n 与验证

- [x] 6.1 在 zh.json/en.json 的 agents 命名空间新增所有 key（工具目录、技能安装、文件浏览、identity、fallback 相关）
- [x] 6.2 验证所有新组件的 dark mode 样式
- [x] 6.3 运行 tsc --noEmit 确保零类型错误
