## ADDED Requirements

### Requirement: Nodes handoff package defines the visual contract

The nodes module SHALL have a complete handoff package under `deck-go/frontend-handoff/modules/nodes/` before the production UI rewrite is marked complete. The package SHALL use the Deck-facing node wrappers, `/api/nodes*` BFF routes, `DeckGoNode*` DTOs, generated Gateway node methods, and active `node.invoke` / `node.pending.enqueue` exception records as the source truth.

#### Scenario: Handoff package is reviewed

- **WHEN** the nodes handoff package is created
- **THEN** it SHALL include `README.md`, `prototype.html`, `components.md`, `states.md`, `interactions.md`, and `api-usage.md`
- **AND** the package SHALL document node inventory loading, selected node lifecycle, pending pairing, orphan pairing, rename, request/approve/reject/verify pairing, command invocation, pending-work enqueue, permissions, capabilities, commands, raw payload disclosure, loading/error/empty states, and mock visual states
- **AND** unsupported or uncertain automatic pairing approval, trust proofing, command schema authoring, token generation, remote shell streaming, file transfer, location visualization, and production remote-control safety semantics SHALL be documented as follow-up rather than silently fabricated in the UI

### Requirement: Nodes production panel follows Deck BFF node workflows

The production nodes panel SHALL render and operate from contract-backed Deck node data while preserving the existing panel registry and API facade boundaries.

#### Scenario: Node inventory and pairing are loaded

- **WHEN** `fetchNodes`, `fetchNodePairing`, and `describeNode` resolve with contract-shaped data
- **THEN** the panel SHALL show load state, node count, pending count, selected node, connection state, pairing state, lifecycle evidence, platform/version/remote identity evidence, capabilities, commands, permissions, node payload, and pending pairing payload where applicable
- **AND** missing optional fields such as display name, platform, version, remote IP, path env, permissions, capabilities, commands, connected timestamp, or selected detail SHALL render as unavailable evidence or empty states rather than fabricated values

#### Scenario: Pairing actions are used

- **WHEN** an operator requests, approves, rejects, or verifies pairing
- **THEN** the panel SHALL call the existing Deck BFF wrapper for that action after preserving the existing confirmation and input validation behavior
- **AND** listed and orphan pending pairing requests SHALL remain actionable without requiring a `node.describe` success for orphan nodes
- **AND** action results SHALL be disclosed as raw evidence without implying trust proofing or production audit assurance

#### Scenario: Dynamic node command is invoked

- **WHEN** an operator invokes an advertised node command
- **THEN** the panel SHALL require confirmation, parse the params JSON before submission, preserve timeout handling, and call the existing `invokeNodeCommand` wrapper
- **AND** invalid params JSON SHALL block the invocation and show validation copy
- **AND** the UI SHALL label command invocation as a dynamic remote-control envelope because `node.invoke` remains an upstream-schema-missing exception

#### Scenario: Pending node work is queued

- **WHEN** an operator queues pending node work
- **THEN** the panel SHALL require confirmation, preserve type, priority, and wake controls, and call the existing `enqueueNodePendingWork` wrapper
- **AND** the UI SHALL label pending-work enqueue as a dynamic remote-control envelope because `node.pending.enqueue` remains an upstream-schema-missing exception

### Requirement: Nodes UI aligns with the settled frontend design system

The nodes panel SHALL use the current settled frontend design-system posture: Inter/JetBrains Mono typography, `--ds-*` tokens, compact workbench density, low-radius surfaces, clear focus states, and local molecules only when canonical atoms or patterns are not yet justified.

#### Scenario: Nodes UI is rendered

- **WHEN** the nodes panel is rendered with contract-shaped mock/local data
- **THEN** the first viewport SHALL expose node inventory, pending pairing signal, selected node lifecycle, connection/pairing evidence, guarded actions, and raw payload disclosures without overlapping text or nested decorative cards
- **AND** long node IDs, request IDs, command names, path values, remote IPs, permissions, JSON params, and action errors SHALL wrap or truncate in stable constrained regions without shifting the layout

### Requirement: Nodes mock visual verification is available

The nodes rewrite SHALL include focused mock/local visual verification that exercises the real frontend against contract-shaped node data without requiring a real Gateway device, real pairing token, real remote command execution, production trust proofing, or remote-control safety assurance.

#### Scenario: Mock visual E2E runs

- **WHEN** the nodes mock/local visual E2E is executed
- **THEN** it SHALL load node inventory and pairing through the normal frontend API path
- **AND** it SHALL capture or assert the ready workspace state and at least one interaction state such as pending pairing selection, rename result, pairing approval/reject result, command invoke result, pending-work queue result, or orphan pairing detail
- **AND** closeout evidence SHALL label the test as mock/local visual coverage, not real Gateway/LLM, real device pairing, production trust proofing, remote command execution, or remote-control safety assurance
