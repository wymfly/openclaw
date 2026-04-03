## ADDED Requirements

### Requirement: Session config bar displays current session settings

Chat 面板 SHALL 在输入框上方常驻显示一个 SessionConfigBar 组件，展示当前 session 的配置状态：model、thinking level、fast mode、verbose level。

#### Scenario: Display all config fields

- **WHEN** 用户打开一个已有 session 的聊天面板
- **THEN** 输入框上方 SHALL 显示配置状态条，包含：model 名称（带 Cpu icon）、thinking level（带 Brain icon）、fast mode 开关状态（带 Zap icon）、verbose level（带 Terminal icon）

#### Scenario: Fields with default/unset values

- **WHEN** session 的 thinkingLevel 未设置（undefined）
- **THEN** 配置状态条 SHALL 不显示 thinking level 项（仅显示已设置的字段），model 未设置时显示 "default"

#### Scenario: Real-time update after slash command

- **WHEN** 用户执行 `/fast on` 且 Gateway 返回成功
- **THEN** 配置状态条 SHALL 在 200ms 内将 fast mode 显示从 "off" 更新为 "on"（通过本地 store 乐观更新，不依赖 SSE）

#### Scenario: Real-time update via SSE

- **WHEN** 其他客户端修改了 session 配置，sessions.changed SSE 事件到达
- **THEN** 配置状态条 SHALL 同步更新显示

### Requirement: SessionMeta includes config fields

`SessionMeta` 类型 SHALL 包含 `thinkingLevel`、`fastMode`、`verboseLevel` 字段，使聊天面板组件可从 store 读取这些值。

#### Scenario: SessionMeta type completeness

- **WHEN** `sessions.changed` SSE 事件包含 `thinkingLevel: "high"` 和 `fastMode: true`
- **THEN** chat store SHALL 将这些值写入对应 session 的 SessionMeta，SessionConfigBar 可直接读取

#### Scenario: sessions.list populates config fields

- **WHEN** Dashboard 启动并通过 `sessions.list` 加载 session 列表
- **THEN** 每个 session 的 `thinkingLevel`、`fastMode`、`verboseLevel` SHALL 从响应中提取并存入 SessionMeta

### Requirement: Config bar respects theme and i18n

SessionConfigBar SHALL 使用 shadcn 设计令牌和 next-intl i18n。

#### Scenario: Dark mode rendering

- **WHEN** Dashboard 处于 dark mode
- **THEN** 配置状态条 SHALL 使用 `var(--muted-foreground)` 作为文本色、`var(--border-subtle)` 作为分隔线，与 RunStatusBar 风格一致

#### Scenario: i18n labels

- **WHEN** Dashboard 语言设为中文
- **THEN** 配置状态条标签 SHALL 使用 `chat` 命名空间的 i18n key（如 `configModel`、`configThinking`、`configFast`、`configVerbose`）
