## ADDED Requirements

### Requirement: Automatic MCP config fetching

The system SHALL fetch MCP Server configuration from the WeCom server after WebSocket authentication, using the `aibot_get_mcp_config` command via WSClient.reply(), and persist the configuration to disk.

#### Scenario: Successful MCP config fetch

- **WHEN** WebSocket authentication succeeds (aibot_subscribe acknowledged)
- **THEN** system sends `aibot_get_mcp_config` command with `biz_type: "doc"`, receives the MCP Server URL and auth status, defaults `type` to `"streamable-http"` if not present in response, and writes to `~/.openclaw/wecomConfig/{accountId}/config.json` (per-account isolation)

#### Scenario: MCP config fetch timeout

- **WHEN** `aibot_get_mcp_config` response does not arrive within 15 seconds
- **THEN** system logs a warning and continues normal message operation (MCP config fetch failure MUST NOT block messaging)

#### Scenario: MCP config not authorized

- **WHEN** response contains `is_authed: false`
- **THEN** system persists the config with auth status, and wecom-doc Skill guides the user through authorization when invoked

### Requirement: wecom-doc Skill registration

The system SHALL register a `wecom-doc` Skill via the `skills/` directory in `openclaw.plugin.json`, enabling AI Agent to create and edit WeCom documents and smart tables through MCP protocol.

#### Scenario: Skill directory declaration

- **WHEN** plugin loads
- **THEN** `openclaw.plugin.json` contains `"skills": ["./skills"]` and `skills/wecom-doc/SKILL.md` exists

#### Scenario: Document creation via Skill

- **WHEN** user says "帮我创建一个文档" and wecom-doc Skill is configured
- **THEN** Agent invokes `mcporter call wecom-doc.create_doc --args '{"doc_type": 3}'` and returns the document URL to the user

#### Scenario: Smart table creation and data entry

- **WHEN** user says "创建一个项目进度表" and wecom-doc Skill is configured
- **THEN** Agent invokes `create_doc` (doc_type=10), then `smartsheet_add_sheet`, then `wedoc_smartsheet_add_fields` with appropriate field types, then `smartsheet_add_records` with data

### Requirement: MCP config auto-detection in Skill

The wecom-doc Skill SHALL auto-detect MCP Server configuration from the persisted config file, falling back to user-guided manual configuration when auto-detection fails.

#### Scenario: Auto-detection from config file

- **WHEN** wecom-doc Skill is invoked and `~/.openclaw/wecomConfig/{accountId}/config.json` contains a valid `mcpConfig.doc` entry
- **THEN** Skill uses the stored MCP Server URL without user interaction

#### Scenario: Manual configuration fallback

- **WHEN** wecom-doc Skill is invoked and config file is missing or lacks `mcpConfig.doc`
- **THEN** Skill prompts user with authorization instructions and accepts a StreamableHttp URL or JSON config for manual setup

#### Scenario: Config persistence via mcporter

- **WHEN** user provides a StreamableHttp URL for manual configuration
- **THEN** Skill executes `mcporter config add wecom-doc --type streamable-http --url "<URL>"` and verifies with `mcporter list wecom-doc --output json`
