## ADDED Requirements

### Requirement: Agents product design SHALL be configuration-owned

The Agents module SHALL map every visible create, update, delete, preview, and navigation affordance to a named `openclaw.json` configuration domain or a Gateway runtime read capability. The implementation MUST classify each domain as Agents-owned, related-module-owned, read-only impact, guarded quick edit, or out-of-scope.

#### Scenario: Configuration ownership matrix is present

- **WHEN** the Agents product-control implementation is ready for review
- **THEN** the implementation evidence SHALL include an ownership matrix covering `agents.list[]`, `agents.defaults`, `bindings[]`, model configuration, skills assignment, subagent permissions, tools/sandbox policy, workspace files, event streams, sessions/activity, and channel/routing relationships
- **AND** each row SHALL name whether Agents owns editing, only shows impact, links to another module, or defers the capability

#### Scenario: Unsupported config domain is not implied as editable

- **WHEN** a configuration domain is related to an agent but is owned by another module or lacks deterministic Gateway/BFF write support
- **THEN** the Agents UI SHALL show a read-only summary, explanatory unavailable state, or navigation link
- **AND** it SHALL NOT render a successful-looking editor that cannot persist through the Deck Go contract chain

### Requirement: Agents target information architecture SHALL be explicit

The Agents module SHALL implement a product control-plane information architecture rather than a generic CRUD page. The UI SHALL expose a list workbench, selected-agent detail hero, stable section navigation, section-specific editing states, and a danger zone governed by the design blueprint.

#### Scenario: OpenSpec blueprint is visual authority

- **WHEN** implementation choices differ between this OpenSpec blueprint, the current design system, and the earlier Agents handoff prototype
- **THEN** the implementation SHALL follow this OpenSpec blueprint and `frontend-new` design-system tokens/components first
- **AND** the prototype SHALL be treated as density, rhythm, and local interaction reference rather than a pixel-perfect authority

#### Scenario: List workbench shows operational scan data

- **WHEN** the Agents page is in ready state with one or more agents
- **THEN** the list workbench SHALL support client-side search, filter, and sort
- **AND** each row SHALL show stable identity, id, model or missing-model state, workspace or missing-workspace state, status/degraded status, session count when available, binding count when available, configured-default badge when applicable, and protected-system badge when the id is `main`
- **AND** unavailable optional counts SHALL render as unavailable, not as fabricated zeroes

#### Scenario: Detail surface has bounded product sections

- **WHEN** an agent is selected
- **THEN** the detail surface SHALL expose sections for identity/overview, runtime/model/workspace posture, skills, subagents, tools/sandbox preview, prompt/files, event streams/activity, routing impact, and danger-zone behavior
- **AND** each section SHALL have one clear ownership responsibility rather than mixing unrelated raw config controls

#### Scenario: Product affordances match the design blueprint

- **WHEN** a visible affordance is added to Agents
- **THEN** it SHALL be traceable to the design blueprint's information architecture, field-to-UI matrix, interaction flow, and verification matrix
- **AND** implementation evidence SHALL identify any intentional divergence from the latest handoff prototype or current production UI

### Requirement: Protected and default agent semantics SHALL be distinct

The Agents module SHALL distinguish the protected `main` agent id, the configured default agent returned by OpenClaw resolution, and the session `mainKey`. Product UI and contracts MUST NOT assume these are always the same concept.

#### Scenario: Main agent cannot be deleted through the UI

- **WHEN** the selected agent id is `main`
- **THEN** the delete affordance SHALL be disabled, hidden, or replaced with protected-system-agent copy
- **AND** no frontend click path SHALL call the delete API for `main`

#### Scenario: Main agent high-impact edits are guarded

- **WHEN** the selected agent id is `main`
- **THEN** identity fields MAY be edited through normal identity edit behavior
- **AND** workspace, model, skills, subagents, tools/sandbox, and event stream edits SHALL use protected-system-agent guarded copy before saving

#### Scenario: Gateway main-delete protection remains verified

- **WHEN** a real or focused backend test attempts to delete `main` through the Gateway-backed delete path
- **THEN** the request SHALL be rejected by Gateway or BFF behavior
- **AND** the evidence SHALL distinguish this backend safety net from the frontend pre-submit protection

#### Scenario: Non-main default agent is represented correctly

- **WHEN** OpenClaw configuration resolves a default agent whose id is not `main`
- **THEN** the Agents UI SHALL show the selected agent's configured-default status separately from `main` protected status
- **AND** any copy or badge SHALL avoid implying that `session.mainKey` is the same as the agent id

### Requirement: Agent lifecycle mutations SHALL include impact-aware safeguards

Agents create, update, and delete flows SHALL use Gateway-backed capability while adding Deck product safeguards for dangerous or irreversible effects.

#### Scenario: Create agent includes supported product fields

- **WHEN** the create-agent flow is presented
- **THEN** it SHALL capture required name plus optional emoji, avatar, workspace, and model seed
- **AND** the review step SHALL explain that name/workspace/model map to a new `agents.list[]` entry and workspace/bootstrap creation
- **AND** skills, subagents, event streams, prompt/files, and routing SHALL be configured after create rather than bundled into the initial create payload

#### Scenario: Model selection prefers configured choices

- **WHEN** the create or runtime model edit flow has access to configured model choices
- **THEN** it SHALL present a configured model picker plus an inherit/default state instead of defaulting to arbitrary freeform input
- **AND** freeform model input SHALL appear only as a labeled advanced fallback when catalog data is unavailable

#### Scenario: Create agent uses backend-supported fields

- **WHEN** the user creates an agent
- **THEN** the submitted request SHALL include only fields accepted by the current Deck/Gateway create path
- **AND** because the current Gateway and BFF create path support optional `model`, the Deck-facing request contract and frontend request builder SHALL include optional `model` or the create UI SHALL not expose model until the drift is fixed

#### Scenario: Default-agent mutation remains read-only in this pass

- **WHEN** the selected agent is or is not the configured default
- **THEN** Agents SHALL show configured-default status and impact copy
- **AND** this change SHALL NOT expose a default-switch mutation unless a follow-up Routing/Channels impact design and contract-backed write path are added

#### Scenario: Delete shows impact before committing

- **WHEN** a deletable non-`main` agent is selected for deletion
- **THEN** the confirmation SHALL show known impact such as bindings, workspace/files/session deletion behavior, and whether the target is default or protected
- **AND** the normal delete flow SHALL NOT offer workspace/session file deletion unless a Deck-facing `deleteFiles` contract, BFF support, focused tests, and fixture-safety verification are added
- **AND** destructive real E2E delete coverage SHALL use only isolated run-scoped fixture agents

#### Scenario: Workspace and runtime edits are guarded

- **WHEN** the user edits workspace, agent directory, model, fallbacks, reasoning, fast mode, runtime, or other behavior-changing fields
- **THEN** the UI SHALL require an explicit edit action and show current value, inherited source when available, and save impact before submitting
- **AND** focused tests SHALL prove these fields are not silently saved as casual identity edits

### Requirement: Cross-module relationships SHALL be useful but bounded

Agents SHALL surface relationships to Skills, Models, Subagents, Routing, Tools/Approvals, Channels, Sessions, and Activity where that helps the operator understand impact, but deep management SHALL remain in the owning module unless the field is a per-agent override.

#### Scenario: Related module entry points preserve ownership

- **WHEN** the Agents page shows a related-model, skill, route, subagent run, tool policy, channel, session, or activity item
- **THEN** the UI SHALL either expose only the per-agent override supported by Agents or link/filter into the owning module
- **AND** the same config domain SHALL NOT be edited by two inconsistent product flows

#### Scenario: Routing impact is visible

- **WHEN** an agent has one or more `bindings[]` entries
- **THEN** the Agents detail view SHALL expose binding impact count and a route to inspect relevant Routing rules
- **AND** delete/default-impact copy SHALL account for those bindings before committing a dangerous action

#### Scenario: Neighbor module deep management is not duplicated

- **WHEN** the Agents page shows related Skills, Models, Subagents, Routing, Tools/Approvals, Channels, Chat, Sessions, or Activity data
- **THEN** the Agents page SHALL either edit only the per-agent override documented in the field-to-UI matrix or link into the owning module
- **AND** it SHALL NOT create a second deep editor for provider catalogs, skill installation, route rule editing, subagent run lineage, global tool policy, channel setup, or transcript management

### Requirement: Skills assignment SHALL scale beyond a raw toggle list

Per-agent skills assignment SHALL be designed for large skill inventories while preserving current Gateway semantics.

#### Scenario: Skills list supports scan and reduction

- **WHEN** the Gateway returns many available skills for an agent
- **THEN** the Agents skills section SHALL provide search or filtering that allows the user to find assigned, unassigned, and ineligible skills without scrolling a single undifferentiated list
- **AND** assigned skills SHALL be easy to inspect before saving

#### Scenario: Skill mode uses real Gateway values

- **WHEN** the user changes per-agent skill mode
- **THEN** the frontend SHALL send only current supported values such as `all` or `whitelist`
- **AND** product labels may be friendlier but MUST map exactly to Gateway-supported values

#### Scenario: Ineligible skills are not silently selectable

- **WHEN** an available skill entry is marked ineligible
- **THEN** the UI SHALL render it as disabled or unavailable with explanation
- **AND** the save payload SHALL NOT include a user-added ineligible skill unless Gateway explicitly allows it

### Requirement: Subagent permission UI SHALL preserve wildcard semantics

Per-agent subagent permission configuration SHALL represent `allowAgents: ["*"]` as a distinct allow-any mode rather than only a set of concrete agent-row toggles.

#### Scenario: Allow-any mode is shown distinctly

- **WHEN** `deck.agents.subagents.get` returns `allowAny: true` or `allowAgents` containing `"*"`
- **THEN** the Agents UI SHALL show an allow-any state
- **AND** concrete row toggles SHALL not imply that no agents are allowed merely because the literal `"*"` does not match an agent id

#### Scenario: Switching from wildcard to explicit list is guarded

- **WHEN** the user changes subagent permission from allow-any to an explicit allowlist
- **THEN** the UI SHALL show that this narrows spawn permissions
- **AND** the save payload SHALL send a concrete `allowAgents` list backed by the current base hash

### Requirement: Preview surfaces SHALL not imply unsupported editing

Tool policy, sandbox, system prompt, bootstrap files, and event stream surfaces SHALL distinguish read-only previews from supported edit paths.

#### Scenario: Tool and sandbox policy preview is read-only unless backed by a write contract

- **WHEN** the Agents page displays tool policy or sandbox policy information
- **THEN** it SHALL indicate whether the view is a resolved preview, a global policy reference, or an editable per-agent override
- **AND** edit controls SHALL appear only when the Deck-facing contract and BFF route for that specific write are implemented

#### Scenario: Workspace file editor is constrained to supported files

- **WHEN** the user edits an agent workspace file through Agents
- **THEN** the UI SHALL use the Gateway-supported agent file list/get/set contract
- **AND** unsupported arbitrary paths SHALL not be offered as normal file targets

#### Scenario: Event stream edits preserve Gateway names

- **WHEN** existing Gateway event stream names are not in the frontend's declared option list
- **THEN** the UI SHALL preserve and display those real names
- **AND** saving SHALL not drop unknown-but-existing stream names unless the user explicitly removes them

### Requirement: Verification SHALL prove product safeguards, not just rendering

The change SHALL include verification for protected-agent behavior, configuration ownership boundaries, high-impact edit guards, scalable skills UI, wildcard subagents, mock visual states, and real Gateway safety paths.

#### Scenario: Mock visual coverage includes productized states

- **WHEN** mock visual E2E is run
- **THEN** it SHALL cover at least ready state, protected `main`, non-main agent detail, many skills, wildcard subagent permission, delete confirmation for a fixture agent, empty/error state, dark/light theme, and English/Chinese navigation where practical
- **AND** the evidence SHALL remain labeled as mock visual coverage only

#### Scenario: Focused tests cover protection and payloads

- **WHEN** frontend focused tests run
- **THEN** they SHALL assert that `main` delete is not submitted, create payload matches the Deck-facing contract, high-impact fields use guarded flows, ineligible skills are not selected, wildcard subagent state is represented, and existing event stream names are preserved

#### Scenario: Real Gateway coverage uses isolated fixtures

- **WHEN** real Gateway E2E runs for Agents
- **THEN** create/delete mutation coverage SHALL use isolated run-scoped fixture agents
- **AND** negative `main` deletion verification SHALL prove safety without modifying user-owned agent state
