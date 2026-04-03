## ADDED Requirements

### Requirement: Configuration commands show success toast

所有修改 session 配置的 slash 命令（`/model <name>`、`/think`、`/fast`、`/verbose`、`/compact`）执行成功后 SHALL 弹出 success 类型的 toast 通知。

#### Scenario: /fast on success toast

- **WHEN** 用户执行 `/fast on` 且 API 返回 200
- **THEN** SHALL 弹出 success toast，内容为 "Fast mode: on"，自动 3 秒消失

#### Scenario: /model switch success toast

- **WHEN** 用户执行 `/model gpt-5.4` 且 API 返回 200
- **THEN** SHALL 弹出 success toast，内容为 "Model: gpt-5.4"

#### Scenario: /think level success toast

- **WHEN** 用户执行 `/think high` 且 API 返回 200
- **THEN** SHALL 弹出 success toast，内容为 "Thinking: high"

#### Scenario: /compact success toast

- **WHEN** 用户执行 `/compact` 且 API 返回 200
- **THEN** SHALL 弹出 success toast，内容为 "Session compacted"

### Requirement: Failed commands show error toast

所有 API 调用失败的 slash 命令 SHALL 弹出 error 类型的 toast。

#### Scenario: API returns non-200

- **WHEN** 用户执行 `/model invalid-model` 且 API 返回 400/500
- **THEN** SHALL 弹出 error toast，展示服务端错误消息或 fallback 文本 "Failed to set model"

#### Scenario: Network error

- **WHEN** 用户执行 `/compact` 但网络不可达
- **THEN** SHALL 弹出 error toast，内容为 "Compaction failed"

### Requirement: Action commands show confirmation feedback

非配置类的 action 命令（`/new`、`/reset`、`/clear`、`/stop`、`/kill`、`/export`）执行后 SHALL 有可感知的反馈。

#### Scenario: /new session created

- **WHEN** 用户执行 `/new` 且 session 创建成功
- **THEN** SHALL 切换到新 session（已有行为）并弹出 success toast "New session created"

#### Scenario: /clear messages cleared

- **WHEN** 用户执行 `/clear`
- **THEN** SHALL 清空消息列表（已有行为）并弹出 info toast "Messages cleared"

#### Scenario: /stop abort failed

- **WHEN** 用户执行 `/stop` 但 abort API 返回非 200
- **THEN** SHALL 弹出 error toast 展示错误消息，且 SHALL NOT 将 streaming 标记设为 false

#### Scenario: /export success

- **WHEN** 用户执行 `/export` 且导出成功
- **THEN** SHALL 弹出 success toast "Session exported"
