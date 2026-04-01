## ADDED Requirements

### Requirement: Auto-discover installed channels from config schema

ChannelsPanel SHALL 从 `config.schema` 响应中自动枚举所有已安装渠道的配置路径，无需硬编码渠道名。

#### Scenario: Discover core channels

- **WHEN** config.schema 返回包含 `telegram`、`discord`、`slack` 路径的 schema
- **THEN** 渠道列表 SHALL 显示这三个渠道，每个渠道显示名称和配置状态（已配置/未配置）

#### Scenario: Discover plugin channels

- **WHEN** config.schema 返回包含 `extensions.matrix.channel` 路径
- **THEN** 渠道列表 SHALL 包含 Matrix 渠道，标记为 plugin 来源

#### Scenario: New channel auto-appear

- **WHEN** 用户安装新渠道插件后刷新面板
- **THEN** 新渠道 SHALL 自动出现在列表中，无需代码修改

### Requirement: Channel list shows configuration status

渠道列表每项 SHALL 显示该渠道的配置状态（已配置/未配置/配置不完整）。

#### Scenario: Configured channel

- **WHEN** 渠道的 required 字段均已填写
- **THEN** SHALL 显示 "已配置" 标签（success 颜色）

#### Scenario: Unconfigured channel

- **WHEN** 渠道无任何配置值
- **THEN** SHALL 显示 "未配置" 标签（muted 颜色）
