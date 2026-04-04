## 1. Slash 命令

- [x] 1.1 实现 SlashCommandPalette 组件：Popover UI，命令列表渲染（名称+描述），模糊搜索过滤，键盘导航（ArrowUp/Down/Enter/Escape）
- [x] 1.2 定义 10 个命令的注册表（command name → handler 映射），每个命令的描述和图标
- [x] 1.3 实现各命令 handler：/new（创建 session）、/reset（重置）、/compact（触发压缩）、/stop（中止）、/clear（清空列表）
- [x] 1.4 实现需要交互的命令：/model（弹出选择器）、/think（弹出 level 选择）、/export（触发下载）、/status（显示摘要通知）、/cost（显示 cost 通知）
- [x] 1.5 集成到 MessageInput：检测 `/` 输入触发 Popover，选择命令后执行并清空输入

## 2. 输入历史

- [x] 2.1 实现 useInputHistory hook：50 条 ring buffer、去重、ArrowUp/Down 导航、当前编辑文本保存/恢复
- [x] 2.2 实现 sessionStorage 持久化：hook 初始化时从 sessionStorage 恢复，发送消息后同步写入
- [x] 2.3 集成到 MessageInput：ArrowUp/Down 事件劫持（仅在输入框为空或光标在首/末行时生效）

## 3. Token 计数

- [x] 3.1 实现 TokenUsageDisplay 组件：格式化 token 数量（K/M 单位），展示 input/output/cache 三项
- [x] 3.2 在 MessageList 的 assistant 消息底部集成 TokenUsageDisplay（仅当 usage 字段存在时渲染）
- [x] 3.3 在 RunStatusBar 右侧添加 session 级累计 token 和 cost 显示，支持流式更新

## 4. Compaction 可视化

- [x] 4.1 实现 CompactionNotice 组件：系统通知卡片样式（warning 色调），显示压缩提示和 token 变化
- [x] 4.2 在 MessageList 中监听 sessions.changed 事件的 compacted 标志，检测到时插入 CompactionNotice
- [x] 4.3 处理断线重连场景：重连后检查 session compacted 状态，必要时补插通知

## 5. i18n 与验证

- [x] 5.1 在 zh.json/en.json 的 chat 命名空间新增所有 key（10 个命令名称+描述、token 计数标签、compaction 通知文本等）
- [x] 5.2 验证 dark mode 样式（命令面板、通知卡片、token 显示）
- [x] 5.3 运行 tsc --noEmit 确保零类型错误
