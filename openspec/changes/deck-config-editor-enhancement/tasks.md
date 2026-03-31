## 1. 搜索增强

- [x] 1.1 实现 `parseConfigSearch(query)` 解析函数：提取 `tag:xxx` 前缀和普通文本，返回 `{ tags: string[], text: string }`
- [x] 1.2 扩展搜索匹配逻辑：匹配 label、help、description、path、enum 值（任一命中），tag 条件与 text 条件取交集
- [x] 1.3 实现 SearchHighlight 组件/utility：将匹配文本用 `<mark>` 包裹，样式 `var(--primary-muted)` 背景
- [x] 1.4 集成到 Config Editor 的字段渲染：label 和 description 在搜索时使用 SearchHighlight

## 2. 标签过滤

- [x] 2.1 实现标签索引构建：初始化时遍历 schema 提取 `x-tags`/`tags` + configUiHints tags，构建 `Map<tag, fieldPaths[]>`
- [x] 2.2 实现 TagFilterPanel 组件：水平 chip 列表，每个 chip 显示标签名和字段数量，点击切换选中态
- [x] 2.3 集成到搜索栏下方：chip 点击等效于追加/移除搜索栏的 `tag:xxx`

## 3. 冲突检测增强

- [x] 3.1 增强 ConflictDialog：字段级差异表格（路径、本地值、远端值），变化值背景色高亮
- [x] 3.2 实现逐字段合并选择：每行 "保留本地"/"采用远端" 按钮，底部 "全部保留"/"全部采用" 快捷操作
- [x] 3.3 实现合并应用：收集所有字段选择，合并为最终配置，使用最新 baseHash 保存

## 4. i18n 与验证

- [x] 4.1 在 zh.json/en.json 的 config 命名空间新增 key（搜索语法提示、标签名称、冲突解决按钮文案）
- [x] 4.2 验证 dark mode 样式（高亮、chip、差异表格）
- [x] 4.3 运行 tsc --noEmit 确保零类型错误
