## ADDED Requirements

### Requirement: Member query

系统 SHALL 支持按 userid 查询企微成员详情，通过 `GET /cgi-bin/user/get` API。

#### Scenario: Get member by userid

- **WHEN** Agent 调用 `wecom_contact` tool，action 为 `get_member`，提供 userid
- **THEN** 系统返回成员信息（name、department、position、status 等可见字段）

#### Scenario: Privacy-limited fields

- **WHEN** 应用非通讯录同步类型，查询成员详情
- **THEN** 系统返回结果中 avatar/mobile/email 等敏感字段为空，tool 响应中 SHALL 包含说明文本提示隐私限制

### Requirement: Department member list

系统 SHALL 支持按部门 ID 获取成员列表，通过 `GET /cgi-bin/user/list` 和 `GET /cgi-bin/user/simplelist` API。

#### Scenario: List department members (detailed)

- **WHEN** Agent 调用 `wecom_contact` tool，action 为 `list_members`，提供 department_id
- **THEN** 系统返回该部门的完整成员列表（含详细信息）

#### Scenario: List department members (simple)

- **WHEN** Agent 调用 `wecom_contact` tool，action 为 `list_members`，提供 department_id 和 `simple: true`
- **THEN** 系统返回该部门的成员 ID 列表（轻量响应）

### Requirement: Department tree

系统 SHALL 支持获取部门列表和部门详情，通过 `GET /cgi-bin/department/list` 和 `GET /cgi-bin/department/get` API。

#### Scenario: List all departments

- **WHEN** Agent 调用 `wecom_contact` tool，action 为 `list_departments`，可选提供 parent_id
- **THEN** 系统返回部门树（id、name、parentid、order）

#### Scenario: Get department detail

- **WHEN** Agent 调用 `wecom_contact` tool，action 为 `get_department`，提供 department_id
- **THEN** 系统返回部门详情（id、name、parentid、leader 列表）

### Requirement: Tag member query

系统 SHALL 支持按标签获取成员列表，通过 `GET /cgi-bin/tag/get` API。

#### Scenario: List tag members

- **WHEN** Agent 调用 `wecom_contact` tool，action 为 `list_tag_members`，提供 tag_id
- **THEN** 系统返回该标签下的成员列表和部门列表

### Requirement: Search

系统 SHALL 支持按姓名模糊搜索企微成员。

#### Scenario: Search members by name

- **WHEN** Agent 调用 `wecom_contact` tool，action 为 `search`，提供 query 关键词
- **THEN** 系统返回匹配的成员列表（基于 `list_members` 结果的本地过滤，或企微搜索 API 如可用）

### Requirement: Retry and infrastructure reuse

所有 contact API 调用 SHALL 实现 3 次重试（网络超时/5xx/errcode -1），复用现有凭证和 HTTP 基础设施。Evidence: `extensions/wecom/src/capability/doc/client.ts:170-189`

#### Scenario: Retry on transient failure

- **WHEN** contact API 调用遇到网络超时或 HTTP 5xx
- **THEN** 系统自动重试最多 3 次，间隔 1 秒，最终失败时抛出错误
