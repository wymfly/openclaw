## ADDED Requirements

### Requirement: Search supports tag: prefix syntax

Config Editor 搜索 SHALL 支持 `tag:xxx` 前缀语法，过滤具有指定标签的配置字段。

#### Scenario: Filter by sensitive tag

- **WHEN** 用户输入 `tag:sensitive`
- **THEN** SHALL 仅显示标记为 sensitive 的字段（来自 schema x-tags 或 configUiHints tags）

#### Scenario: Combined tag and text search

- **WHEN** 用户输入 `tag:sensitive token`
- **THEN** SHALL 显示标记为 sensitive 且 label/description/path 包含 "token" 的字段（AND 逻辑）

### Requirement: Search matches multiple field attributes

搜索文本 SHALL 匹配字段的 label、help、description、path、enum 值（任一匹配即命中）。

#### Scenario: Match by path

- **WHEN** 用户输入 `telegram.bot`
- **THEN** SHALL 显示 path 包含 "telegram.bot" 的所有字段

#### Scenario: Match by enum value

- **WHEN** 用户输入 `webhook`
- **THEN** SHALL 显示 enum 值列表中包含 "webhook" 的字段

#### Scenario: Case insensitive match

- **WHEN** 用户输入 `Token`（大写 T）
- **THEN** SHALL 匹配 "token"、"Token"、"TOKEN" 等所有大小写变体

### Requirement: Search results highlight matched text

搜索匹配的文本 SHALL 在字段标签和描述中通过 `<mark>` 标签高亮显示。

#### Scenario: Highlight in label

- **WHEN** 搜索 "bot" 匹配到 label "Bot Token"
- **THEN** "Bot" SHALL 被 `<mark>` 包裹，背景色为 `var(--primary-muted)`

#### Scenario: No highlight when no search

- **WHEN** 搜索框为空
- **THEN** SHALL 不渲染任何 `<mark>` 标签

### Requirement: Search displays syntax hint

搜索框 SHALL 在 placeholder 中提示搜索语法。

#### Scenario: Show syntax hint

- **WHEN** 搜索框为空
- **THEN** placeholder SHALL 显示 "搜索配置... (支持 tag:sensitive 语法)"
