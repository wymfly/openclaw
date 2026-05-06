## MODIFIED Requirements

### Requirement: Nodes production panel follows Deck BFF node workflows

The production nodes panel SHALL render and operate from contract-backed Deck node data while preserving the existing panel registry and API facade boundaries. The refreshed v2 handoff SHALL be used as the visual/product target only where it is consistent with those contracts.

#### Scenario: Node inventory and pairing are loaded

- **WHEN** `fetchNodes`, `fetchNodePairing`, and `describeNode` resolve with contract-shaped data
- **THEN** the panel SHALL show load state, node count, pending count, selected node, connection state, pairing state, lifecycle evidence, platform/version/remote identity evidence, capabilities, commands, permissions, node payload, and pending pairing payload where applicable
- **AND** missing optional fields such as display name, platform, version, remote IP, path env, permissions, capabilities, commands, connected timestamp, or selected detail SHALL render as unavailable evidence or empty states rather than fabricated values
- **AND** the inventory rail and selected-detail workspace SHALL follow the refreshed v2 handoff unless doing so would hide contract-backed state

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
- **AND** v2 local molecules such as platform pills, lifecycle rows, confirm rows, action cards, and raw JSON blocks SHALL either map to existing atoms or remain module-local
