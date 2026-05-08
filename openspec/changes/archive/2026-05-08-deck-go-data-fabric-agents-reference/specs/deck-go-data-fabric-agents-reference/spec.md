## ADDED Requirements

### Requirement: Agents Data Fabric module SHALL encode contract-sourced reads

`frontend-new` SHALL provide an Agents Data Fabric module that wraps existing
frontend API facades for all Agents server-state reads and records whether each
read is backed by generated Gateway RPC or Deck BFF.

#### Scenario: Agents list uses generated Gateway RPC facade

- **WHEN** the Agents list query runs
- **THEN** it SHALL call the existing `fetchAgentsList()` facade
- **AND** the facade SHALL continue to use generated Gateway RPC
  `agents.list({})` through the deck-go backend Gateway RPC adapter
- **AND** the browser SHALL NOT call OpenClaw Gateway directly

#### Scenario: Agents child reads use BFF facades

- **WHEN** detail, health, skills, subagent config, event streams, tool policy,
  system prompt, files, file content, or identity is loaded
- **THEN** the Data Fabric module SHALL call the existing BFF facade for that
  read
- **AND** raw BFF paths and `POST /deck/agents` action strings SHALL NOT be
  assembled inside production panel components

### Requirement: Agents query keys and freshness tiers SHALL be explicit

Agents Data Fabric queries SHALL expose stable serializable query keys and SHALL
map each query to the freshness tier matching its contract role.

#### Scenario: Query keys are stable

- **WHEN** tests inspect Agents query keys
- **THEN** the module SHALL expose stable keys for list, detail, health, skills,
  subagents, event streams, tool policy, system prompt, files, file content, and
  identity
- **AND** those keys SHALL be safe targets for mutation invalidation and live
  projection invalidation

#### Scenario: Freshness follows source semantics

- **WHEN** query option factories are inspected
- **THEN** agents list and configured-model reads SHALL use `inventory`
- **AND** skills, subagent config, and event streams SHALL use
  `config-authority`
- **AND** health/status SHALL use `live-workbench`
- **AND** detail, files, file content, identity, tool-policy preview, and
  system-prompt preview SHALL use `lazy-detail`

### Requirement: Agents panel SHALL consume Data Fabric for server state

The Agents panel SHALL use Agents Data Fabric hooks or query option factories
for server-state reads instead of store-owned fetch lifecycle methods or
component-local `useEffect(fetch*)` lifecycles.

#### Scenario: Agents list renders from Data Fabric

- **WHEN** the Agents panel mounts
- **THEN** list loading, empty, ready, refresh, and error states SHALL be derived
  from the Agents list query
- **AND** fresh navigation back to Agents SHALL render cached list data without
  issuing another identical list request

#### Scenario: Agents store keeps only UI state

- **WHEN** the Agents store is inspected after migration
- **THEN** it SHALL preserve UI state such as selected agent and live display
  overlay helpers
- **AND** it SHALL NOT expose `loadAgents`, `fetchAgents`, or `refreshAgents`
  server fetch lifecycle methods

#### Scenario: Detail sections preserve cached data during refresh

- **WHEN** an Agents detail section has cached data and a background refresh
  fails
- **THEN** the panel SHALL keep rendering the cached section data
- **AND** it SHALL surface a non-blocking error or stale state instead of
  replacing the section with a first-load skeleton

### Requirement: Agents mutations SHALL use contract-derived safety behavior

Agents Data Fabric mutations SHALL declare invalidation targets and SHALL follow
the mutation safety and conflict behavior recorded in the source contracts.

#### Scenario: Base-hash mutation blocks without hash

- **WHEN** skills, subagent config, or event stream save is requested without the
  required config hash/base hash
- **THEN** the mutation SHALL NOT call the backend
- **AND** the UI SHALL preserve the local draft and show a recoverable conflict
  or refresh-required state

#### Scenario: Mutation defaults remain conservative

- **WHEN** Agents mutations are created
- **THEN** they SHALL use no automatic mutation retry
- **AND** they SHALL NOT queue offline replay
- **AND** they SHALL invalidate declared query keys on success instead of
  relying on full-page reloads

#### Scenario: Protected main delete remains unavailable

- **WHEN** the selected agent is protected as `main`, default, or otherwise not
  deletable by contract metadata
- **THEN** the delete action SHALL remain disabled in the UI
- **AND** the mutation SHALL NOT be invoked for that protected agent

### Requirement: Agent-status live projection SHALL invalidate authoritative queries

Agents Data Fabric SHALL consume the existing `agent-status` live projection as
an invalidation and gap-recovery source without requiring generated patch fields.

#### Scenario: Agent status event invalidates Agents read models

- **WHEN** `agent.status.changed` or `activity.event` is received for the
  `agent-status` projection
- **THEN** Agents Data Fabric SHALL invalidate or mark stale the relevant agents
  list/detail/status query keys
- **AND** cached data SHALL remain visible while authoritative data refreshes

#### Scenario: Projection gap refreshes authoritative data

- **WHEN** a `projection.gap` event is received for `agent-status`
- **THEN** Agents Data Fabric SHALL mark the projection stale
- **AND** because the contract gap policy is `refresh`, it SHALL refresh the
  configured authoritative Agents read model keys

### Requirement: Agents reference verification SHALL include mock and real evidence

The Agents Data Fabric migration SHALL be verified with unit/hook/component
tests, mock-functional browser evidence, and real Gateway browser evidence or a
documented circuit-breaker handoff.

#### Scenario: Mock-functional evidence covers reference behavior

- **WHEN** the L4 mock-functional Agents evidence runs
- **THEN** it SHALL cover list/detail navigation, cache reuse on panel return,
  representative child section interaction, and at least one safe mutation or
  blocked-mutation safety path
- **AND** unexpected browser console, page, or BFF API errors SHALL fail the
  evidence

#### Scenario: Real-gateway evidence is bounded

- **WHEN** the L5 real Gateway Agents evidence runs
- **THEN** it SHALL navigate through the Deck shell into Agents
- **AND** it SHALL validate theme and locale variants
- **AND** it SHALL cover at least one real read path against the isolated real
  stack
- **AND** real writes SHALL run only for run-scoped fixture data with guarded
  cleanup

#### Scenario: Real-gateway environment fails repeatedly

- **WHEN** real Gateway startup or environment setup fails twice without new
  narrowing evidence
- **THEN** the change SHALL record the command, failure evidence, and affected
  requirement as a circuit-breaker handoff
- **AND** implementation SHALL continue only after all deterministic code-level
  Agents checks have passed
