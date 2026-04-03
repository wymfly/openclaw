## ADDED Requirements

### Requirement: Submit approval request

系统 SHALL 支持提交审批申请，通过 `POST /cgi-bin/oa/applyevent` API。

#### Scenario: Submit an approval

- **WHEN** Agent 调用 `wecom_approval` tool，action 为 `submit`，提供 template_id、approver、apply_data
- **THEN** 系统提交审批并返回审批单号 sp_no

#### Scenario: Submit with summary

- **WHEN** Agent 调用 `wecom_approval` tool，action 为 `submit`，附带 summary_list
- **THEN** 系统提交审批并在审批摘要中显示指定内容

### Requirement: Query approval records

系统 SHALL 支持批量查询审批单号，通过 `POST /cgi-bin/oa/getapprovalinfo` API。

#### Scenario: List approval records by time range

- **WHEN** Agent 调用 `wecom_approval` tool，action 为 `list`，提供 start_time、end_time、template_id
- **THEN** 系统返回该时间段内的审批单号列表

### Requirement: Get approval detail

系统 SHALL 支持获取单个审批详情，通过 `POST /cgi-bin/oa/getapprovaldetail` API。

#### Scenario: Get approval detail by sp_no

- **WHEN** Agent 调用 `wecom_approval` tool，action 为 `get_detail`，提供 sp_no
- **THEN** 系统返回审批详情（申请人、审批人、状态、apply_data、审批节点）

### Requirement: Get approval template

系统 SHALL 支持获取审批模板详情，通过 `POST /cgi-bin/oa/gettemplatedetail` API。

#### Scenario: Get template detail

- **WHEN** Agent 调用 `wecom_approval` tool，action 为 `get_template`，提供 template_id
- **THEN** 系统返回模板信息（名称、控件列表、审批流程配置）

### Requirement: Retry and infrastructure reuse

所有 approval API 调用 SHALL 实现 3 次重试模式，复用现有凭证和 HTTP 基础设施。Evidence: `extensions/wecom/src/capability/doc/client.ts:170-189`

#### Scenario: Retry on transient failure

- **WHEN** approval API 调用遇到网络超时或 HTTP 5xx
- **THEN** 系统自动重试最多 3 次，间隔 1 秒
