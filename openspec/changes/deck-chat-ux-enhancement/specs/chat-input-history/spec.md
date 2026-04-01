## ADDED Requirements

### Requirement: Input history supports ArrowUp/Down navigation

MessageInput SHALL 在用户按 ArrowUp/ArrowDown 时导航输入历史（最近 50 条），替换当前输入内容。

#### Scenario: Navigate to previous input

- **WHEN** 输入框为空（或光标在首行），用户按 ArrowUp
- **THEN** SHALL 显示最近一条历史输入；继续按 ArrowUp 显示更早的历史

#### Scenario: Navigate back to current input

- **WHEN** 用户在历史中导航后按 ArrowDown 回到最新
- **THEN** SHALL 恢复用户当前正在编辑的文本（非历史条目）

#### Scenario: Send message adds to history

- **WHEN** 用户发送非空消息
- **THEN** 该消息 SHALL 被添加到历史栈顶（去重：如果与最近一条相同则不添加）

### Requirement: Input history persists across page refresh

输入历史 SHALL 存储在 sessionStorage 中（key: `deck-chat-input-history`），页面刷新后恢复。

#### Scenario: Refresh preserves history

- **WHEN** 用户已发送 5 条消息后刷新页面
- **THEN** ArrowUp 导航 SHALL 恢复之前的 5 条历史

#### Scenario: Tab close clears history

- **WHEN** 用户关闭浏览器 tab
- **THEN** sessionStorage 自动清除，下次打开无历史

### Requirement: Input history has 50 item limit

输入历史 SHALL 最多保留 50 条，超出时移除最老的条目。

#### Scenario: History overflow

- **WHEN** 历史已有 50 条，用户发送第 51 条消息
- **THEN** 最老的一条 SHALL 被移除，新消息添加到栈顶
