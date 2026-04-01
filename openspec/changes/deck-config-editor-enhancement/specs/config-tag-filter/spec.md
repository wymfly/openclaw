## ADDED Requirements

### Requirement: Tag filter panel displays available tags

Config Editor SHALL 在搜索栏下方渲染标签列表（chip 样式），从 schema 的 `x-tags`/`tags` 和 configUiHints 的 tags 中提取所有唯一标签。

#### Scenario: Display tag chips

- **WHEN** schema 中有 "sensitive"、"advanced"、"network" 三种标签
- **THEN** SHALL 渲染三个 chip，每个显示标签名和该标签下的字段数量

#### Scenario: Click tag to filter

- **WHEN** 用户点击 "sensitive" tag chip
- **THEN** SHALL 等效于在搜索栏输入 `tag:sensitive`，过滤显示对应字段，chip 变为选中态

#### Scenario: Deselect tag

- **WHEN** 用户点击已选中的 tag chip
- **THEN** SHALL 取消该标签过滤，恢复搜索栏

#### Scenario: No tags available

- **WHEN** schema 中无任何标签定义
- **THEN** 标签列表区域 SHALL 不渲染
