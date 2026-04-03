## ADDED Requirements

### Requirement: MCP tool proxy

系统 SHALL 通过 `wecom_mcp` tool 代理调用企微 MCP 能力，将外部 MCP tool 请求转发到企微 Bot WS 通道。

#### Scenario: Proxy MCP tool call

- **WHEN** Agent 调用 `wecom_mcp` tool，提供 tool_name 和 tool_input
- **THEN** 系统通过 MCP transport 将请求转发到企微 Bot WS，返回 tool 执行结果。Evidence: `extensions/wecom/src/capability/mcp/tool.ts:89`, `extensions/wecom/src/capability/mcp/transport.ts:131`

#### Scenario: MCP tool discovery

- **WHEN** Agent 请求可用的 MCP tool 列表
- **THEN** 系统返回当前企微 MCP 实例中注册的所有 tool 名称和 schema。Evidence: `extensions/wecom/src/capability/mcp/tool.ts:54`

### Requirement: Source registry integration

系统 SHALL 集成 source-registry 模块，记录会话来源（calendar/mcp）以支持上下文感知。

#### Scenario: Session source tracking

- **WHEN** 企微 Bot WS 收到入站消息并建立会话上下文
- **THEN** source-registry 记录 `bot-ws` 来源快照，`wecom_mcp` tool 通过 `resolveWecomSourceSnapshot()` 仅在 Bot WS 会话中启用，而 calendar tool 通过 `isWecomAgentSource()` 仅在 agent-callback 会话中启用。Evidence: `extensions/wecom/src/transport/bot-ws/sdk-adapter.ts:197`, `extensions/wecom/src/capability/mcp/tool.ts:109`, `extensions/wecom/src/capability/calendar/tool.ts:59`
