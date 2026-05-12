# deck-go-agents-section-ia-convergence Specification

## Purpose

Define the accepted Deck Go Agents section IA, defaults editor, inheritance, impact, unresolved-reference, product-write, and real-E2E contract for the productized agents control plane.

## Requirements

### Requirement: Agents detail SHALL use task-driven 11-section IA

The agents detail page SHALL render exactly `overview`, `model`, `workspace`, `skills`, `subagents`, `tools`, `conversation`, `delivery`, `files`, `routing`, and `danger` in that order, while preserving legacy hash aliases for `runtime`, `tool-policy`, `event-streams`, and `system-prompt`.

#### Scenario: Legacy hashes remain valid

- **WHEN** a URL uses a legacy section hash
- **THEN** the page SHALL redirect it with `replaceState` to the matching new section
- **AND** the target section SHALL become active without a full reload

### Requirement: Agents defaults editor SHALL expose only AgentDefaultsConfig-backed fields

The agents list toolbar SHALL expose `?panel=agents&view=defaults`. The defaults editor SHALL render only the 7 supported sections: `overview`, `model`, `workspace`, `skills`, `subagents`, `conversation`, and `delivery`. It SHALL omit defaults-schema-absent fields rather than rendering disabled fake controls.

#### Scenario: Defaults sections are schema-truth scoped

- **WHEN** the defaults editor renders
- **THEN** `tools`, `files`, `routing`, `danger`, `agentDir`, per-agent `runtime`, top-level `tools`, and `groupChat` SHALL NOT appear as editable defaults fields

### Requirement: Agents model policy SHALL use Gateway target shape

Agents model-policy writes SHALL call `deck.agents.modelPolicy.set` using target objects, not config-path strings. Global defaults SHALL use `{ kind: "global-default", key }` with keys `text`, `image`, `imageGeneration`, `videoGeneration`, `musicGeneration`, `pdf`, `compaction`, `memorySearch`, and `subagents`. Per-agent writes SHALL use `{ kind: "agent-model", key: "agent", agentId }` or `{ kind: "agent-subagents", key: "agentSubagents", agentId }`.

#### Scenario: Config path strings are not sent as target keys

- **WHEN** an agents model policy mutation is submitted
- **THEN** keys such as `memorySearch.model` and `compaction.model` SHALL NOT be used as target keys

### Requirement: Agents inheritance SHALL be Gateway-provided and backward compatible

`DeckGoAgentDetailResponse` SHALL preserve legacy `effectiveSources` and add `inherited?: DeckGoAgentInheritanceMap`. The frontend SHALL render source badges from `inherited` and degrade to source unknown when the map is absent.

#### Scenario: Detail carries new and legacy inheritance data

- **WHEN** `deck.agents.detail` responds
- **THEN** it SHALL retain the legacy fixed `effectiveSources` map
- **AND** it SHALL expose the new inheritance map for supported task-section fields

### Requirement: Agents impact SHALL be split into cached snapshot and fresh preview

Detail SHALL expose cache-friendly nested `impact.bindings`, `impact.sessions`, and `impact.files` while preserving flat legacy counts. High-risk operations SHALL fetch `deck.agents.impactPreview.get` fresh before enabling confirmation.

#### Scenario: High-risk confirmation waits for fresh impact

- **WHEN** an L3 or L4 agents operation opens
- **THEN** the UI SHALL request `impactPreview.get`
- **AND** confirmation SHALL remain disabled until that response arrives

### Requirement: Agents unresolved references SHALL be aggregated by Gateway detail

`deck.agents.detail` SHALL aggregate unresolved references for skills, subagents, event streams, and models, and the UI SHALL expose them through an overview chip and modal without mutating on local acknowledgement.

#### Scenario: Keep is local acknowledgement only

- **WHEN** a user clicks Keep for an unresolved reference
- **THEN** the UI SHALL update local presentation only
- **AND** no Gateway mutation SHALL be sent

### Requirement: Agents product writes SHALL be guarded by per-action path allowlists

Agents BFF product actions backed by `config.patch` or `config.apply` SHALL enforce action-specific config path allowlists before calling Gateway. Out-of-scope writes to `models.providers`, `bindings`, or root-level `tools` SHALL be rejected with a deterministic error code.

#### Scenario: Forged payload is rejected before Gateway mutation

- **WHEN** a forged agents product action attempts to write another module's path
- **THEN** the BFF SHALL reject it before issuing `config.patch` or `config.apply`
- **AND** the isolated real E2E config SHALL remain unchanged

### Requirement: Gateway deck namespace SHALL be additively extended for Agents control

Deck namespace protocol changes SHALL be additive and limited to `deck.ts` plus `src/gateway/server-methods/deck/**`: detail schema extensions, `deck.agents.subagents.set.requireAgentId`, and `deck.agents.impactPreview.get`.

#### Scenario: requireAgentId round-trip is persisted

- **WHEN** `deck.agents.subagents.set` is called with `requireAgentId: true`
- **THEN** the isolated `openclaw.json` SHALL persist `agents.list[<id>].subagents.requireAgentId = true`
- **AND** subsequent reads SHALL return that value

### Requirement: Real and mock evidence SHALL be layered

Mock E2E SHALL prove visual and interaction behavior; real Gateway E2E SHALL prove isolated config writes, Gateway discovery, typed BFF/Gateway action paths, and run-scoped fixture cleanup. Neither evidence layer SHALL replace the other.

#### Scenario: Real Gateway evidence uses isolated config

- **WHEN** agents real E2E mutates config
- **THEN** writes SHALL target `deck-go`'s isolated real-stack `managed-gateway-state/openclaw.json`
- **AND** the operator's global `~/.openclaw/openclaw.json` SHALL NOT be the mutation target
