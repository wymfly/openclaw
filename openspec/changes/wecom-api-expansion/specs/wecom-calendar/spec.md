## ADDED Requirements

### Requirement: Calendar CRUD operations

系统 SHALL 提供日程的创建、查询、更新、删除操作，通过 `wecom_calendar` tool 的 action 字段分发。

#### Scenario: Create a calendar event

- **WHEN** Agent 调用 `wecom_calendar` tool，action 为 `create`，提供 title、start_time、end_time、attendees
- **THEN** 系统通过企微日历 API 创建日程，返回 cal_id 和创建确认

#### Scenario: Get calendar event detail

- **WHEN** Agent 调用 `wecom_calendar` tool，action 为 `get`，提供 cal_id
- **THEN** 系统返回日程详情（标题、时间、参与者、描述）

#### Scenario: Update a calendar event

- **WHEN** Agent 调用 `wecom_calendar` tool，action 为 `update`，提供 cal_id 和待修改字段
- **THEN** 系统更新日程并返回更新确认

#### Scenario: Delete a calendar event

- **WHEN** Agent 调用 `wecom_calendar` tool，action 为 `delete`，提供 cal_id
- **THEN** 系统删除日程并返回删除确认

### Requirement: Free/busy query

系统 SHALL 支持查询指定用户在指定时间范围内的空闲/忙碌状态。

#### Scenario: Query free/busy status

- **WHEN** Agent 调用 `wecom_calendar` tool，action 为 `get_free_busy`，提供 userid 列表和时间范围
- **THEN** 系统返回每个用户的空闲/忙碌时段列表

### Requirement: Attendee management

系统 SHALL 支持对已有日程的参与者进行增删操作。

#### Scenario: Add attendees to event

- **WHEN** Agent 调用 `wecom_calendar` tool，action 为 `add_attendees`，提供 cal_id 和 userid 列表
- **THEN** 系统向日程添加参与者并返回确认

#### Scenario: Remove attendee from event

- **WHEN** Agent 调用 `wecom_calendar` tool，action 为 `remove_attendees`，提供 cal_id 和 userid 列表
- **THEN** 系统从日程移除指定参与者并返回确认

### Requirement: Reuse existing infrastructure

所有 API 调用 SHALL 复用现有 `getAccessToken(agent)` 获取凭证和 `wecomFetch()` 发送请求。Evidence: `extensions/wecom/src/transport/agent-api/core.ts:87`, `extensions/wecom/src/http.ts:63`

#### Scenario: Token and proxy reuse

- **WHEN** calendar 模块发起任意 API 请求
- **THEN** 系统通过 `getAccessToken(agent)` 获取 token，通过 `resolveWecomEgressProxyUrlFromNetwork()` 获取代理 URL。Evidence: `extensions/wecom/src/transport/agent-api/core.ts:87`, `extensions/wecom/src/config/network.ts:4`
