## ADDED Requirements

### Requirement: WeCom doc tool surfaces SHALL expose only supported actions

The WeCom document tool contract SHALL only advertise actions that are official-aligned or live-verified extensions.

#### Scenario: Unsupported direct endpoints are not public

- **WHEN** an action is known not to be a WeCom Wedoc direct endpoint
- **THEN** it SHALL NOT appear in the public `wecom_doc` action schema
- **AND** it SHALL NOT appear as a recommended callable action in WeCom document skills
- **AND** the replacement flow, if any, SHALL be documented separately with a distinct request shape

#### Scenario: Each public action has a support tier

- **WHEN** a direct `wecom_doc` action or `wecom_mcp` doc method is documented for Agent use
- **THEN** the support matrix SHALL classify it as `official-aligned` or `live-verified-extension`
- **AND** the matrix SHALL cite evidence for the classification
- **AND** actions without evidence SHALL be hidden, removed, or marked unsupported

#### Scenario: Existing direct action inventory is exhausted

- **WHEN** this change is implemented
- **THEN** every action currently exposed by `extensions/wecom/src/capability/doc/schema.ts` SHALL appear in the support matrix
- **AND** the matrix SHALL include canonical name, public name, support tier, surface, endpoint authority, request-body authority, response-mapping status, and verification status
- **AND** closure SHALL fail if any current action is missing from the matrix

#### Scenario: Compatibility aliases are hidden from public contract

- **WHEN** runtime code accepts a historical alias or stale-session parameter shape
- **THEN** that alias MAY remain as compatibility handling
- **BUT** it SHALL NOT be described as a supported public schema shape unless it is independently classified and tested

### Requirement: Official WeCom plugin comparison SHALL use the Tencent WeCom source

Convergence decisions SHALL use `vendor/wecom-openclaw-plugin` as the local Tencent official WeCom plugin reference and SHALL NOT use non-WeCom plugin references as official WeCom evidence.

#### Scenario: Official reference is recorded

- **WHEN** the support matrix is created or updated
- **THEN** it SHALL record the official plugin remote and commit used for comparison
- **AND** it SHALL identify any official skill or interceptor file used as evidence

#### Scenario: Official API documentation is recorded for endpoint disputes

- **WHEN** an action remains public because it is `official-aligned`
- **THEN** the support matrix SHALL cite either Tencent official plugin evidence or the current enterprise WeCom official API documentation
- **AND** endpoint/body disputes SHALL record the official API page URL, endpoint path, required fields, enum values, and response fields used for the decision
- **AND** local behavior SHALL NOT override the official API shape unless it is classified as a local extension

#### Scenario: Non-WeCom reference is excluded

- **WHEN** an implementation or review cites an official WeCom behavior
- **THEN** it SHALL NOT cite `vendor/OpenClaw-Wechat` as authority
- **AND** any previous conclusions based on that source SHALL be revalidated against Tencent WeCom sources or live evidence

### Requirement: Local WeCom extensions SHALL preserve official API semantics

Actions not present in the Tencent official plugin skills SHALL be treated as extensions and SHALL still align with enterprise WeCom API protocol when they call official WeCom endpoints.

#### Scenario: Extension request bodies match official protocol

- **WHEN** a local extension calls a WeCom endpoint
- **THEN** its endpoint path, HTTP method, required fields, nested object shapes, array semantics, enum values, and error handling SHALL match the official API documentation or live API evidence
- **AND** any local shorthand SHALL map deterministically to the official request body before dispatch
- **AND** the public schema SHALL document the shorthand as local extension behavior rather than official Tencent plugin behavior

#### Scenario: Extensions do not broaden official claims

- **WHEN** a local extension supports behavior beyond the Tencent official plugin skill wording
- **THEN** the support matrix SHALL classify that behavior as `live-verified-extension`
- **AND** the Agent-facing description SHALL state the exact surface where it is supported
- **AND** the same behavior SHALL NOT be implied for `wecom_mcp` unless the live MCP schema or official plugin supports it

#### Scenario: Risky extensions are hidden by default

- **WHEN** a local extension lacks complete official API evidence, lacks stable live E2E evidence, repeatedly fails real WeCom regression, or requires risky schema overfitting to remain callable
- **THEN** it SHALL be removed from the public Agent-visible schema or classified as `compat-hidden`/`unsupported`
- **AND** runtime compatibility MAY remain only for stale sessions if it does not expand the public contract
- **AND** official Tencent WeCom plugin capabilities with complete evidence SHALL be fixed and kept supported rather than hidden as a shortcut

### Requirement: Default and optional parameters SHALL be evidence-backed

Parameter defaults, omitted parameters, empty arrays, and optional nested structures SHALL be treated as part of the public tool contract.

#### Scenario: Public defaults require evidence

- **WHEN** a public schema or skill describes a default value
- **THEN** that default SHALL be backed by official documentation, live MCP schema, direct unit evidence, or live WeCom evidence
- **AND** the support matrix SHALL identify the evidence when the default affects request semantics

#### Scenario: Empty optional arrays are not sent as filters

- **WHEN** an optional filter/sort/list parameter is empty
- **THEN** the direct client or interceptor SHALL omit it from the outgoing request unless the official API explicitly requires an empty array
- **AND** tests SHALL cover smart-table `field_titles`, `field_ids`, `record_ids`, and `sort`

#### Scenario: Synthetic object-creating defaults are forbidden

- **WHEN** a call can create or modify WeCom objects such as records, fields, collect-form questions, permissions, rules, groups, or views
- **THEN** runtime SHALL NOT synthesize missing required business objects from titles or placeholders
- **AND** the Agent-facing schema SHALL require the real structure needed by the official API

### Requirement: Smart-table record operations SHALL match the current callable surface

Smart-table record add, read, update, and delete operations SHALL use request bodies that match the current callable surface and avoid parameters known to produce misleading empty values.

#### Scenario: Record reads do not request empty field filters

- **WHEN** the Agent or direct tool reads all records from a smart-table sheet
- **THEN** the request SHALL omit `field_titles`, `field_ids`, `record_ids`, and `sort` when they are empty
- **AND** the returned records SHALL preserve `values` when the WeCom API returns them

#### Scenario: Key-type support is surface-specific

- **WHEN** `key_type` is documented for `smartsheet_add_records`, `smartsheet_update_records`, or `smartsheet_get_records`
- **THEN** the documentation SHALL state whether the support applies to direct `wecom_doc`, `wecom_mcp`, or both
- **AND** field-ID writes SHALL only be public for surfaces with live or official schema evidence

#### Scenario: Cell values are normalized by field type

- **WHEN** direct `wecom_doc` writes or updates records
- **THEN** common Agent-style values SHALL be normalized to the WeCom cell-value shape required by the target field type
- **AND** tests SHALL cover text, number, date/time, checkbox, select, user, URL, image, and file values where the action is public

### Requirement: Collect-form creation SHALL require real form structure

`create_collect` SHALL not advertise title-only or `docName`-only creation.

#### Scenario: Public collect-form schema rejects title-only input

- **WHEN** an Agent calls public `create_collect`
- **AND** the input only includes a title, `docName`, `formTitle`, or `form_title`
- **THEN** schema validation or client validation SHALL reject the call before sending it to WeCom

#### Scenario: Shorthand collect-form requests map to official form_info

- **WHEN** an Agent uses an allowed shorthand such as `request.form_title` plus `request.items`
- **THEN** the runtime SHALL map it deterministically to `form_info.form_question.items`
- **AND** each generated question item SHALL include the required WeCom fields

### Requirement: Permission and rule APIs SHALL be constrained as local extensions

Smart-table permission/rule actions SHALL be treated as local extensions unless Tencent official plugin skills or live MCP schema prove otherwise.

#### Scenario: Public privilege values are integer enums

- **WHEN** public schema exposes `priv_list[].priv`
- **THEN** it SHALL accept only the integer enum values supported by the current WeCom API
- **AND** object/string aliases such as `{ "value": "VIEW" }` SHALL NOT be public schema shapes

#### Scenario: Rule APIs require live proof

- **WHEN** `smartsheet_create_rule`, `smartsheet_update_sheet_priv`, `smartsheet_get_sheet_priv`, `smartsheet_mod_rule_member`, or `smartsheet_delete_rule` remains public
- **THEN** the support matrix SHALL include a real WeCom E2E row for the action
- **AND** the action SHALL have unit tests for request body shape and validation failures

### Requirement: WeCom skills SHALL guide the Agent toward callable behavior

Skills under `extensions/wecom/skills` SHALL describe the converged public contract and avoid encouraging unsupported tool calls.

#### Scenario: Tool descriptions are operationally accurate

- **WHEN** a public `wecom_doc` schema description, parameter description, or skill example is shown to the Agent
- **THEN** it SHALL state the correct surface, required preconditions, canonical parameter shape, irreversible side effects, and known unsupported cases
- **AND** it SHALL NOT recommend stale aliases, hidden compatibility shapes, non-public actions, or unverified shortcuts

#### Scenario: Agent-facing descriptions omit internal governance details

- **WHEN** a tool description, parameter description, or skill file is included in prompt/tool context for the Agent
- **THEN** it SHALL NOT expose support-tier labels, evidence status, deployment status, upstream comparison notes, pending-verification markers, or implementation rationale
- **AND** those details SHALL remain in internal artifacts such as the support matrix, OpenSpec design/spec/tasks, deploy notes, tests, and developer documentation
- **AND** the Agent-facing text SHALL keep only information needed to call the tool safely and correctly

#### Scenario: Skills match public support matrix

- **WHEN** a skill lists a WeCom doc or smart-table method
- **THEN** that method SHALL exist in the support matrix as public-supported for the same surface
- **AND** the examples SHALL use the canonical request shape for that surface

#### Scenario: Local deviations from Tencent skills are explained

- **WHEN** local skill guidance differs from `vendor/wecom-openclaw-plugin/skills`
- **THEN** the local file SHALL either cite local live evidence in the support matrix or explain the local interceptor that makes the shorthand valid

#### Scenario: Official skill wording is preferred for official-aligned actions

- **WHEN** an action is classified as `official-aligned`
- **THEN** local skill wording SHOULD use the Tencent official plugin's method names, preflight guidance, and examples unless the local runtime requires a documented adaptation
- **AND** any adaptation SHALL be identified as local behavior

### Requirement: Verification SHALL include local gates and real WeCom evidence

Closure SHALL require deterministic local verification and real deployment evidence for behavior that depends on enterprise WeCom state.

#### Scenario: Local verification covers schema and payloads

- **WHEN** the change is implemented
- **THEN** targeted WeCom doc and MCP tests SHALL pass
- **AND** `pnpm tsgo` SHALL pass
- **AND** the relevant build/dist generation command SHALL pass or record an unrelated blocker with evidence

#### Scenario: Real E2E records live action support

- **WHEN** the converged plugin is deployed to the target server
- **THEN** real WeCom chat E2E SHALL validate every public action classified as live-verified extension
- **AND** the support matrix and `deploy/STATUS.md` SHALL record the live evidence and remaining gaps
