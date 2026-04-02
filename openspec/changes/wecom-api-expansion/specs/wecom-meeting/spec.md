## ADDED Requirements

### Requirement: Create meeting

系统 SHALL 支持创建预约会议，通过 `POST /cgi-bin/meeting/create` API。

#### Scenario: Create a scheduled meeting

- **WHEN** Agent 调用 `wecom_meeting` tool，action 为 `create`，提供 title、start_time、end_time、userid 列表
- **THEN** 系统创建预约会议并返回 meetingid

#### Scenario: Create meeting with optional settings

- **WHEN** Agent 调用 `wecom_meeting` tool，action 为 `create`，附带 password、settings 等可选参数
- **THEN** 系统创建含指定设置的会议并返回 meetingid

### Requirement: Modify meeting

系统 SHALL 支持修改已有会议的信息，通过 `POST /cgi-bin/meeting/update` API。

#### Scenario: Update meeting details

- **WHEN** Agent 调用 `wecom_meeting` tool，action 为 `update`，提供 meetingid 和待修改字段
- **THEN** 系统更新会议信息并返回确认

### Requirement: Cancel meeting

系统 SHALL 支持取消已有会议，通过 `POST /cgi-bin/meeting/cancel` API。

#### Scenario: Cancel a meeting

- **WHEN** Agent 调用 `wecom_meeting` tool，action 为 `cancel`，提供 meetingid
- **THEN** 系统取消会议并返回确认

### Requirement: Query meeting info

系统 SHALL 支持查询会议详情，通过 `POST /cgi-bin/meeting/get_info` API。

#### Scenario: Get meeting detail

- **WHEN** Agent 调用 `wecom_meeting` tool，action 为 `get_info`，提供 meetingid
- **THEN** 系统返回会议详情（title、时间、参与者、状态、settings）

### Requirement: List user meetings

系统 SHALL 支持查询指定用户的会议列表，通过 `POST /cgi-bin/meeting/get_user_meetinglist` API。

#### Scenario: List meetings for a user

- **WHEN** Agent 调用 `wecom_meeting` tool，action 为 `list_user_meetings`，提供 userid
- **THEN** 系统返回该用户的会议列表（meetingid、title、时间、状态）

### Requirement: Retry and infrastructure reuse

所有 meeting API 调用 SHALL 实现 3 次重试模式，复用现有凭证和 HTTP 基础设施。Evidence: `extensions/wecom/src/capability/doc/client.ts:170-189`

#### Scenario: Retry on transient failure

- **WHEN** meeting API 调用遇到网络超时或 HTTP 5xx
- **THEN** 系统自动重试最多 3 次，间隔 1 秒
