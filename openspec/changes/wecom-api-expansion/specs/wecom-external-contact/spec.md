## ADDED Requirements

### Requirement: Get external contact detail

系统 SHALL 支持获取外部联系人详情，通过 `GET /cgi-bin/externalcontact/get` API。

#### Scenario: Get contact by external_userid

- **WHEN** Agent 调用 `wecom_external_contact` tool，action 为 `get`，提供 external_userid
- **THEN** 系统返回外部联系人详情（name、corp_name、type、follow_user 列表）

### Requirement: List external contacts

系统 SHALL 支持获取指定成员的外部联系人列表，通过 `GET /cgi-bin/externalcontact/list` API。

#### Scenario: List contacts by userid

- **WHEN** Agent 调用 `wecom_external_contact` tool，action 为 `list`，提供 userid（内部成员）
- **THEN** 系统返回该成员的所有外部联系人 external_userid 列表

### Requirement: List customer groups

系统 SHALL 支持获取客户群列表，通过 `POST /cgi-bin/externalcontact/groupchat/list` API。

#### Scenario: List group chats

- **WHEN** Agent 调用 `wecom_external_contact` tool，action 为 `list_groups`，可选提供 status_filter、owner_filter
- **THEN** 系统返回客户群列表（chat_id、name、owner、member_count）

#### Scenario: Paginated group list

- **WHEN** Agent 调用 `wecom_external_contact` tool，action 为 `list_groups`，提供 cursor
- **THEN** 系统返回下一页客户群数据和 next_cursor

### Requirement: Retry and infrastructure reuse

所有 external-contact API 调用 SHALL 实现 3 次重试模式，复用现有凭证和 HTTP 基础设施。Evidence: `extensions/wecom/src/capability/doc/client.ts:170-189`

#### Scenario: Retry on transient failure

- **WHEN** external-contact API 调用遇到网络超时或 HTTP 5xx
- **THEN** 系统自动重试最多 3 次，间隔 1 秒
