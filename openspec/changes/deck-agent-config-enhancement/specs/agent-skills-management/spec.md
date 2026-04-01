## ADDED Requirements

### Requirement: Skill install dialog supports local and ClawHub installation

SkillsTab SHALL 提供 "安装技能" 按钮，打开 Dialog 支持两种安装方式：本地路径输入和 ClawHub slug 输入。

#### Scenario: Install local skill

- **WHEN** 用户在 Dialog 中选择 "本地" tab，输入路径 "/path/to/skill"，点击安装
- **THEN** SHALL 调用 `skills.install` API（传入 name 和 installId），显示安装进度和结果（stdout/stderr）

#### Scenario: Install ClawHub skill

- **WHEN** 用户在 Dialog 中选择 "ClawHub" tab，输入 slug "web-search"（单段，不含 `/`），点击安装
- **THEN** SHALL 调用 `skills.install` API（传入 `source: "clawhub"` 和 slug），显示安装结果

#### Scenario: Install failure

- **WHEN** 安装失败（API 返回错误）
- **THEN** Dialog SHALL 显示错误信息（stderr 或 error message），保持打开状态供用户重试

### Requirement: Skill config editor supports apiKey and env

SkillsTab 中每个技能条目 SHALL 提供配置编辑入口，支持修改 apiKey 和环境变量。

#### Scenario: Edit skill API key

- **WHEN** 用户点击某技能的配置图标，在展开的编辑区域输入 apiKey
- **THEN** SHALL 调用 `skills.update` API（传入 skillKey 和 apiKey），保存成功后刷新技能状态

#### Scenario: Edit skill env variables

- **WHEN** 用户添加/修改技能的环境变量键值对
- **THEN** SHALL 调用 `skills.update` API（传入 skillKey 和 env Record），保存成功后刷新

### Requirement: Skill update functionality

SkillsTab SHALL 支持 ClawHub 技能的更新操作。

#### Scenario: Update single ClawHub skill

- **WHEN** 用户点击某 ClawHub 技能的 "更新" 按钮
- **THEN** SHALL 调用 `skills.update` API（传入 `source: "clawhub"` 和 slug），显示更新结果

#### Scenario: Update all ClawHub skills

- **WHEN** 用户点击 "全部更新" 按钮
- **THEN** SHALL 调用 `skills.update` API（传入 `source: "clawhub"` 和 `all: true`），显示批量更新结果
