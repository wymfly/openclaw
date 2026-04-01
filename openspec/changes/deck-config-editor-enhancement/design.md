## Context

Deck Config Editor 当前组件结构：

- **ConfigEditorPanel**: 主面板，搜索栏 + 分区列表
- **字段组件**: PasswordField、RecordField、TypedArrayField、UnionField（已有）
- **辅助**: FieldHelpPopover、FieldValidation、ConflictDialog、DiffPreviewDialog、SectionIntroCard

官方搜索算法 `parseConfigSearchQuery()` 的能力：

- 支持 `tag:sensitive` 语法（任意标签名）
- 匹配字段：label、help、title、description、path、enum 值
- 标签来源：schema 的 `x-tags`/`tags` 属性 + configUiHints 的 tags
- 匹配所有条件后返回过滤后的字段列表

## Goals / Non-Goals

**Goals:**

- 搜索支持 `tag:` 前缀语法和多字段匹配
- 搜索结果中高亮匹配文本
- 提供标签快捷过滤面板
- 冲突检测展示字段级差异并支持逐字段合并

**Non-Goals:**

- 不实现正则搜索 — 复杂度高、用户需求低
- 不实现搜索历史/收藏 — 过度设计
- 不实现配置版本历史 — 超出 Config Editor 范围
- 不实现三方合并（三路 diff）— 两路差异（本地 vs 远端）足够

## Decisions

### D1: 搜索解析器实现

**选择**: 实现 `parseConfigSearch(query: string)` 函数，解析 `tag:xxx` 前缀和普通文本，返回结构化搜索条件 `{ tags: string[], text: string }`。

**匹配逻辑**: 对每个配置字段，检查：

1. 如有 tags 条件 → 字段的 tags（从 schema x-tags + hints tags 合并）须包含所有指定 tag
2. 如有 text 条件 → 字段的 label、help、description、path、enum 值（任一）须包含该文本（不区分大小写）
3. 两者同时存在时取交集（AND 逻辑）

### D2: 高亮使用 mark 标签

**选择**: 搜索匹配的文本使用 `<mark>` 标签包裹，CSS 样式使用 `var(--primary-muted)` 背景色。

**理由**: `<mark>` 是语义化 HTML 标签，原生无障碍支持。通过 CSS 变量与主题系统集成。

### D3: 标签过滤面板位置

**选择**: 在搜索栏下方渲染水平标签列表（chip 样式），点击标签等效于在搜索栏追加 `tag:xxx`。

**理由**: 水平标签列表占用空间小，操作直觉（点击 = 过滤）。与搜索栏联动保持行为一致。

### D4: 冲突解决交互

**选择**: ConflictDialog 增强为字段级差异表格：每行显示字段路径、本地值、远端值、选择按钮（保留本地/采用远端）。全部选择后一键应用。

**替代方案**: 整体二选一（全部保留本地 或 全部采用远端）。

**理由**: 逐字段选择避免丢失用户的部分修改。整体二选一在多字段同时修改时过于粗暴。

## Risks / Trade-offs

- **[标签索引性能]** schema 可能有数百字段，需要建立标签索引 → 初始化时一次遍历建立 `Map<tag, fieldPaths[]>`，后续搜索 O(1) 查找
- **[高亮闪烁]** 每次搜索变化触发全部字段重渲染 → 使用 React.memo + 仅高亮可见字段
- **[冲突检测频率]** 保存时才检测冲突可能来得太晚 → 可选方案：定期静默检查 baseHash，有变化时在 UI 显示警告图标
