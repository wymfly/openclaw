## ADDED Requirements

### Requirement: Create todo task

系统 SHALL 支持创建待办任务，通过 `POST /cgi-bin/oa/addworkrecord` API。

#### Scenario: Create a work record

- **WHEN** Agent 调用 `wecom_todo` tool，action 为 `create`，提供 title、creator、url（可选）、appname
- **THEN** 系统创建待办并返回任务 ID

#### Scenario: Create todo with assignees

- **WHEN** Agent 调用 `wecom_todo` tool，action 为 `create`，提供 title 和 userid 列表
- **THEN** 系统为每个 userid 创建待办项并返回确认

### Requirement: Update todo status

系统 SHALL 支持更新待办任务状态，通过 `POST /cgi-bin/oa/updateworkrecord` API。

#### Scenario: Mark todo as completed

- **WHEN** Agent 调用 `wecom_todo` tool，action 为 `update_status`，提供任务 ID 和 status（已完成）
- **THEN** 系统更新待办状态并返回确认

### Requirement: Get todo detail

系统 SHALL 支持查询待办详情，通过 `POST /cgi-bin/oa/getworkrecord` API。

#### Scenario: Get work record detail

- **WHEN** Agent 调用 `wecom_todo` tool，action 为 `get`，提供任务 ID
- **THEN** 系统返回待办详情（title、creator、assignees、status、create_time）

### Requirement: Retry and infrastructure reuse

所有 todo API 调用 SHALL 实现 3 次重试模式，复用现有凭证和 HTTP 基础设施。Evidence: `extensions/wecom/src/capability/doc/client.ts:170-189`

#### Scenario: Retry on transient failure

- **WHEN** todo API 调用遇到网络超时或 HTTP 5xx
- **THEN** 系统自动重试最多 3 次，间隔 1 秒
