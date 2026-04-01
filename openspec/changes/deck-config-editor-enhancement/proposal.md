## Why

Deck 的 Config Editor 面板已有基本的配置浏览和编辑能力（字段渲染、类型化输入、冲突检测基础），但搜索和导航方面与官方 UI 存在差距：

1. **搜索能力弱** — 官方 UI 的 `parseConfigSearchQuery()` 支持高级语法（`tag:sensitive`），匹配字段包括 label、help、title、description、path、enum 值；Deck 搜索仅做简单文本匹配
2. **无匹配高亮** — 搜索结果中匹配的文字未高亮显示，用户需自行定位匹配位置
3. **无标签过滤** — 官方 UI 支持按标签过滤（来自 schema 的 `x-tags`/`tags` 属性 + UI hints），如 `tag:sensitive` 过滤所有敏感字段
4. **冲突检测可完善** — Deck 已有 baseHash 乐观锁的基础实现（ConflictDialog.tsx），但缺少字段级差异展示和自动合并建议

## What Changes

- 增强 **搜索算法**：实现 `tag:` 前缀语法支持，扩展匹配范围到 label、help、description、path、enum 值
- 新增 **搜索结果高亮**：在匹配的字段标签和值中高亮搜索词
- 新增 **标签过滤**：从 schema 的 `x-tags`/`tags` 和 UI hints 的 tags 提取标签，支持标签快捷过滤
- 增强 **冲突检测**：字段级差异对比展示，显示本地值 vs 远端值，提供逐字段合并选择

## Capabilities

### New Capabilities

- `config-advanced-search`: 高级搜索语法（tag: 前缀），扩展匹配范围，结果高亮
- `config-tag-filter`: 从 schema 提取标签，支持标签快捷过滤面板
- `config-conflict-resolution`: 字段级冲突差异展示和逐字段合并选择

### Modified Capabilities

(none)

## Impact

- **修改组件**: Config Editor 的搜索逻辑、字段渲染（高亮）、ConflictDialog.tsx（字段级差异）
- **新组件**: TagFilterPanel.tsx、SearchHighlight.tsx（文本高亮 utility）
- **数据流**: 搜索时需解析 schema tags，可能需缓存标签索引
- **i18n**: `config` 命名空间新增搜索语法提示、标签名称、冲突解决按钮文案
- **无后端变更**: 所有功能基于已有的 config.schema 响应数据
