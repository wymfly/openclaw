## ADDED Requirements

### Requirement: Compaction event renders as system notification card

消息流 SHALL 在检测到 context compaction 事件时插入系统通知卡片。

#### Scenario: Display compaction notification

- **WHEN** 收到 sessions.changed 事件且 `compacted` 标志为 true
- **THEN** 消息流中 SHALL 插入系统通知卡片，显示 "上下文已压缩"（i18n key: `chat.compacted`），样式区别于用户和 assistant 消息（使用 warning 色调背景）

#### Scenario: Show token reduction

- **WHEN** compaction 事件包含压缩前后的 token 数
- **THEN** 通知卡片 SHALL 显示 "从 {before} tokens 压缩到 {after} tokens"

#### Scenario: Compaction during disconnect

- **WHEN** Deck 在 WebSocket 断线期间发生 compaction，重连后收到 session 状态
- **THEN** 如果 session 的 compacted 标志为 true 且之前未插入通知，SHALL 在消息流末尾补插一条 compaction 通知
