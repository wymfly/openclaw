## ADDED Requirements

### Requirement: MCP tool proxy

系统 SHALL 通过 `wecom_mcp` tool 代理调用企微 MCP 能力，将外部 MCP tool 请求转发到企微 Bot WS 通道。

#### Scenario: Proxy MCP tool call

- **WHEN** Agent 调用 `wecom_mcp` tool，提供 tool_name 和 tool_input
- **THEN** 系统通过 MCP transport 将请求转发到企微 Bot WS，返回 tool 执行结果

#### Scenario: MCP tool discovery

- **WHEN** Agent 请求可用的 MCP tool 列表
- **THEN** 系统返回当前企微 MCP 实例中注册的所有 tool 名称和 schema

### Requirement: Source registry integration

系统 SHALL 集成 source-registry 模块，记录会话来源（calendar/mcp）以支持上下文感知。

#### Scenario: Session source tracking

- **WHEN** 通过 calendar 或 mcp 模块发起会话
- **THEN** source-registry 记录会话来源类型，session-manager 可查询该信息

### Requirement: Context store for Bot WS

系统 SHALL 集成 context-store 模块，支持 Bot WS 主动推送上下文存储。

#### Scenario: Store push context

- **WHEN** Bot WS 收到主动推送消息
- **THEN** context-store 缓存推送内容，供后续 tool 调用时引用
