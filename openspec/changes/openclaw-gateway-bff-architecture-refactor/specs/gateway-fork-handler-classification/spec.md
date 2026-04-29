## ADDED Requirements

### Requirement: Fork-only handlers are classified into one of five categories

Every fork-only RPC handler SHALL be classified as exactly one of `C1` (composition view), `C2` (mutation), `C3` (light view), `C4` (business rule), or `C5` (infrastructure / introspection). The classification SHALL be recorded in the handler's `*.method-defs.ts` `methodDefs` entry as a `forkClass: "C1" | "C2" | "C3" | "C4" | "C5"` field, and the documentation SHALL include the rationale.

#### Scenario: Every fork-only method has a forkClass annotation

- **WHEN** the gateway registry is enumerated
- **THEN** every method whose name does not appear in upstream `server-methods-list.ts` SHALL have a non-null `methodDef.forkClass` field

#### Scenario: Classification audit succeeds

- **WHEN** `node scripts/audit-fork-classifications.ts` is executed
- **THEN** it MUST report each of the 34 fork-only methods (26 `deck.*` including `deck.plugins.list` after the registry-drift fix in Phase 0 + `gateway.describe` + `models.catalog.providers` + `models.configured` + `sessions.usage` + `sessions.usage.logs` + `sessions.usage.timeseries` + `sessions.clear` + `sessions.steer`) and MUST exit non-zero if any classification is missing or invalid

### Requirement: All five classes stay in the gateway in this proposal

Handlers of every class SHALL remain registered in the gateway in this proposal. C1 (composition), C2 (mutation), and C4 (business rule) MUST stay because each requires either multi-source composition with low round-trip latency, atomic openclaw-side mutation, or replication of openclaw decision logic. C5 (infrastructure / introspection) MUST stay because it is part of the gateway's protocol surface itself. C3 (light view) is annotated as a future BFF-migration candidate and is governed by a separate eligibility requirement below.

#### Scenario: A new mutation method is classified C2

- **WHEN** a new fork-only handler that calls `writeConfigFile` or otherwise mutates openclaw state is introduced
- **THEN** the handler's `forkClass` MUST be `C2`, and the handler MUST be registered in the gateway

#### Scenario: A new business-rule method is classified C4

- **WHEN** a new fork-only handler that replicates upstream decision logic (toolPolicy resolution, system prompt rendering, routing simulation, plugin snapshot) is introduced
- **THEN** the handler's `forkClass` MUST be `C4`, and the handler MUST be registered in the gateway

#### Scenario: A new infrastructure method is classified C5

- **WHEN** a new fork-only handler exposes registry introspection, batch dispatch, capability discovery, or other gateway-protocol-layer functionality whose target is the gateway itself rather than an openclaw domain
- **THEN** the handler's `forkClass` MUST be `C5`, and the handler MUST be registered in the gateway

### Requirement: C3 handlers are annotated as future BFF-migration candidates

Handlers classified as `C3` (light view) SHALL declare `methodDef.bffEligible: true` so that `gateway.describe` can surface this to clients planning a future migration. Actual migration of any C3 handler to deck-go is **out of scope for this proposal** and depends on (a) a `gateway.batch` primitive being available and (b) a separate deck-go-side BFF proposal that identifies the replacing view.

#### Scenario: gateway.describe surfaces BFF-eligible methods

- **WHEN** a client calls `gateway.describe`
- **THEN** the result MUST include for each method whose `forkClass` is `C3` a `bffEligible: true` field

#### Scenario: C3 handler retirement requires explicit replacement

- **WHEN** a future proposal removes a `C3` handler from the gateway
- **THEN** that proposal MUST identify the deck-go BFF view that replaces it, MUST update the deck-go consumers, and MUST NOT remove the gateway handler before the BFF view is in production

### Requirement: Classification is verifiable from handler source

The classification of any handler SHALL be derivable from inspection of its source code by applying the following rules in order. The classifier SHALL count "distinct internal service" as a unique service-interface namespace consumed (e.g., `agentsService`, `configService`, `routingService`); reading multiple methods from the same service counts as one.

1. If the handler exposes gateway-protocol-layer functionality (registry introspection, batch dispatch, capability discovery), classify as `C5`.
2. Else, if the handler invokes `writeConfigFile`, `clearSessionQueues`, `abortEmbeddedPiRun`, `markSubagentRunTerminated`, `markSubagentRunForSteerRestart`, or any other openclaw-state mutation, classify as `C2`.
3. Else, if the handler implements decision logic that exists in openclaw internals (toolPolicy resolution, prompt rendering, routing simulation, plugin snapshot, auth aggregation/probing), classify as `C4`.
4. Else, if the handler reads from three or more distinct internal service namespaces, classify as `C1`.
5. Else, classify as `C3`.

#### Scenario: Classification rules applied to deck.agents.detail

- **WHEN** `deck.agents.detail` is examined
- **THEN** because it reads from `agentsService` (covering `loadConfig`, `listAgentEntries`, `resolveAgentWorkspaceDir`), `skillsService` (covering `resolveAgentSkillsFilter`, `buildWorkspaceSkillStatus`), and `configService` (covering snapshot), the classifier SHALL find ≥ 3 distinct service namespaces and assign `forkClass: "C1"`

#### Scenario: Classification rules applied to deck.routing.list

- **WHEN** `deck.routing.list` is examined
- **THEN** because the handler reads only `configService.loadConfigSnapshot()` and `agentsService.resolveDefaultId()` (and applies local filter / sort), with no third distinct service and no decision logic that exists in openclaw internals, the classifier SHALL assign `forkClass: "C3"`

#### Scenario: Classification rules applied to deck.routing.add

- **WHEN** `deck.routing.add` is examined
- **THEN** because it invokes `writeConfigFile`, the classifier SHALL assign `forkClass: "C2"` regardless of how many services it reads from

#### Scenario: Classification rules applied to gateway.describe

- **WHEN** `gateway.describe` is examined
- **THEN** because it exposes registry introspection (rule 1 above), the classifier SHALL assign `forkClass: "C5"`

### Requirement: Initial classification of all 33 fork-only methods is locked

The initial classification table SHALL be:

- **C1 (composition, ≥3 service namespaces)**: `deck.commands.discover`, `deck.agents.detail`, `deck.agents.skills.get`, `deck.agents.subagents.get`, `models.configured`, `sessions.usage`, `sessions.usage.logs`, `sessions.usage.timeseries`
- **C2 (mutation)**: `deck.routing.add`, `deck.routing.remove`, `deck.agents.skills.set`, `deck.agents.subagents.set`, `deck.agents.eventStreams.set`, `deck.identity.link`, `deck.identity.unlink`, `deck.subagents.kill`, `deck.subagents.steer`, `sessions.clear`, `sessions.steer`
- **C3 (light view, ≤2 service namespaces, no decision logic)**: `deck.routing.list`, `deck.subagents.list`, `deck.subagents.lineage`, `deck.identity.list`, `deck.threads.list`
- **C4 (business rule, replicates openclaw decision logic)**: `deck.auth.overview`, `deck.auth.probe`, `deck.routing.validate`, `deck.routing.simulate`, `deck.agents.toolPolicy.preview`, `deck.agents.systemPrompt.preview`, `deck.agents.eventStreams.get`, `deck.plugins.list`, `models.catalog.providers`
- **C5 (infrastructure / introspection)**: `gateway.describe`

#### Scenario: Initial classification matches handler annotations

- **WHEN** the audit script enumerates classifications recorded in `methodDefs`
- **THEN** the totals MUST be: C1 = 8, C2 = 11, C3 = 5, C4 = 9, C5 = 1 (sum = 34)
- **AND** every method named above MUST have its declared `forkClass` matching the table
