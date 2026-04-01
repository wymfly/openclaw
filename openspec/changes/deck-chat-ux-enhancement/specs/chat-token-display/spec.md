## ADDED Requirements

### Requirement: Message-level token usage display

每条 assistant 消息底部 SHALL 显示该消息的 token 使用量（当 ChatEvent.usage 字段存在时）。

#### Scenario: Display message tokens

- **WHEN** assistant 消息的 ChatEvent 包含 `usage: { input: 1200, output: 350, cacheRead: 500 }`
- **THEN** 消息底部 SHALL 显示 token 行：`↓1.2K  ↑350  ⚡500` （格式化为 K/M 单位，cache 用闪电图标）

#### Scenario: No usage data

- **WHEN** ChatEvent 不包含 usage 字段
- **THEN** SHALL 不渲染 token 行（无占位空间）

### Requirement: Session-level cumulative token display

RunStatusBar SHALL 在右侧显示当前 session 的累计 token 消耗和估算 cost。

#### Scenario: Display session totals

- **WHEN** 当前 session 累计使用 input 15K + output 8K tokens，估算 cost $0.12
- **THEN** RunStatusBar 右侧 SHALL 显示 `23K tokens · $0.12`

#### Scenario: Update during streaming

- **WHEN** assistant 正在流式响应，新的 usage 事件到达
- **THEN** session 累计显示 SHALL 实时更新（不等待流结束）
