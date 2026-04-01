## ADDED Requirements

### Requirement: Overview tab displays full agent identity

OverviewTab SHALL 调用 `agent.identity.get` API 并展示 agent 身份信息：agentId、name、emoji、avatar。（注意：后端 AgentIdentityResultSchema 不包含 description 和 aliases 字段。）

#### Scenario: Display identity with avatar

- **WHEN** `agent.identity.get` 返回 avatar URL
- **THEN** OverviewTab 头部 SHALL 显示 avatar 图片、agent 名称、emoji

#### Scenario: Identity API unavailable

- **WHEN** `agent.identity.get` 调用失败
- **THEN** SHALL 降级为当前行为（仅显示 `deck.agents.detail` 返回的 name 和 emoji）
