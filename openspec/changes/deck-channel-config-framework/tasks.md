## 1. 渠道发现

- [x] 1.1 实现渠道路径枚举逻辑：从 config.schema 响应中提取所有渠道配置路径（channels._ + extensions._.channel），构建渠道元数据列表
- [x] 1.2 实现渠道配置状态检测：对每个发现的渠道检查 required 字段是否已填写，确定 configured/unconfigured/incomplete 状态
- [x] 1.3 重构 ChannelList.tsx：从硬编码列表改为动态发现，每个渠道显示名称、来源标签（core/plugin）、配置状态标签

## 2. Schema-driven 表单

- [x] 2.1 实现 ChannelSchemaForm 核心：JSON Schema type → 组件映射（string→Input, enum→Select, boolean→Switch, number→Input[number], sensitive→PasswordField）
- [x] 2.2 实现 configUiHints 处理：字段排序（order）、分组（sections → Card 区域）、帮助文本（help → FieldHelpPopover）
- [x] 2.3 实现表单验证：required 字段检查、类型验证，验证错误以红色边框+提示文本展示
- [x] 2.4 实现表单保存：收集表单值，调用 config 更新 API，显示保存成功/失败通知
- [x] 2.5 实现未知类型降级：无法映射的 schema 类型渲染为只读 JSON + "在 Config Editor 中编辑" 链接

## 3. 连接探测

- [x] 3.1 实现 ChannelProbeStatus 组件：探测按钮 + 结果展示（success/failure/timeout + 延迟 + 错误信息）
- [x] 3.2 调用 channels.status API 传入 probe: true，处理 10s 超时场景
- [x] 3.3 集成到渠道详情页的状态区域

## 4. 集成与迁移

- [x] 4.1 重构 ConfigWizard.tsx：渠道添加流程改为发现列表选择 → schema 表单填写，保留 Feishu/WeCom 向导作为可选增强入口
- [x] 4.2 在 ChannelsPanel 中集成渠道发现列表和 schema 表单详情页

## 5. i18n 与验证

- [x] 5.1 在 zh.json/en.json 的 channels 命名空间新增所有 key（探测状态文案、表单标签、发现列表文案等）
- [x] 5.2 验证 dark mode 样式
- [x] 5.3 运行 tsc --noEmit 确保零类型错误
