## ADDED Requirements

### Requirement: Skills information architecture follows list-workbench-plus-detail-hero

The Skills surface SHALL replace the current three-tab structure with a `list workbench + detail hero + section nav` IA so that operators experience the same rhythm as the codex `deck-go-agents-product-control-plane` Agents surface.

#### Scenario: ready state shows list workbench and detail hero

- **WHEN** the user opens Skills with at least one installed skill
- **THEN** the panel renders a list workbench on the left, a detail hero on the right, and the `SkillHubTab`, `SkillMatrixTab`, and `SkillInfoTab` components are not present in the rendered DOM tree

#### Scenario: detail hero is sectioned

- **WHEN** the user selects an installed skill in the list
- **THEN** the detail surface contains the sections `Identity`, `Source & activation`, `API key`, `env`, `Eligibility health`, `Agent Usage`, `Owning Plugin`, and `Danger zone` in that order

### Requirement: Skills SHALL NOT expose a write path for `agents.list[].skills`

The Skills module SHALL remove the previous two-way agent-matrix edit. Editing of `agents.list[].skills` is owned exclusively by the Agents module per codex `deck-go-agents-product-control-plane` D6.

#### Scenario: no toggle button is rendered in the Agent Usage section

- **WHEN** the user opens any installed skill detail and scrolls to the Agent Usage section
- **THEN** the rendered section contains only read-only labels and per-agent navigation links, and contains no `button` element that toggles assignment

#### Scenario: Skills components do not invoke `updateAgentSkills`

- **WHEN** the rendered Skills surface is exercised through any user interaction available within the Skills module
- **THEN** no network request originates from a Skills component to `deck.agents.skills.set` or to its BFF translation
- **AND** at build time, no module under `frontend-new/src/components/panels/skills/` imports or calls the `updateAgentSkills` wrapper from `frontend-new/src/api.ts`

#### Scenario: `updateAgentSkills` wrapper itself is preserved

- **WHEN** the Agents module loads
- **THEN** the `updateAgentSkills` function in `frontend-new/src/api.ts` continues to be importable and continues to call `deck.agents.skills.set`

### Requirement: Mutation safety follows a four-level model

Every Skills mutation SHALL be classified into one of L0 normal, L1 guarded impact, L2 guarded secret, or L3 setup wizard, with copy and affordance matching the level.

#### Scenario: enable and disable are L0 inline with impact hint

- **WHEN** the user toggles enable or disable on an installed skill whose `agentUsage.count` is greater than zero
- **THEN** the inline toggle shows a hint indicating the number of agents currently using the skill before the mutation is committed
- **AND** the mutation is sent through `updateSkill` with `{enabled}`

#### Scenario: env edits are L1 guarded with diff and impact

- **WHEN** the user edits env values
- **THEN** a guarded drawer renders the current key-value table, dirty-state diff, and affected-agent count before exposing a Save button
- **AND** Save invokes `updateSkill` with `{env}`

#### Scenario: global ClawHub update-all is L1 guarded with broad-scope copy and impact

- **WHEN** the user opens "Update all managed ClawHub skills" and at least one loaded skill has product source `managed`
- **THEN** the drawer shows affected-agent count and copy that explicitly says the action may update all tracked ClawHub skills in the Gateway workspace
- **AND** the drawer copy explicitly states the target is "ClawHub current latest" (not a chosen version)
- **AND** Confirm invokes `updateSkillHub()` with NO slug and NO `version` argument

#### Scenario: per-skill upgrade affordance is suppressed until Gateway exposes tracking status

- **WHEN** the user views any installed/loaded skill detail
- **THEN** the Source & activation section does not render a per-skill Upgrade button
- **AND** the section renders `unsupportedReasons.perSkillUpgrade` copy when the skill is managed and would otherwise look upgradable

#### Scenario: install is L3 multi-step wizard with post-install secret/env chain

- **WHEN** the user clicks the toolbar Install action
- **THEN** the panel renders a five-step wizard with steps `Source`, `Slug & version`, `apiKey optional`, `env optional`, `Review and confirm`
- **AND** Step 2 shows the slug's latest published version as preview-only and the wizard does not expose a manual version picker
- **AND** the Review step shows any captured apiKey value masked as `••••`, lists the predicted openclaw.json mutation, and explicitly discloses the two-step write plan (`installSkillHub` first, then `updateSkill` if apiKey or env was captured)
- **AND** Confirm invokes `installSkillHub(slug)` first
- **AND** when at least one of apiKey or env was captured AND `installSkillHub` succeeds, the wizard resolves the resulting `skillKey` from the install handler result (preferring `result.slug`; falling back to a re-fetch of `fetchSkills` matched on slug) and chains `updateSkill(skillKey, { apiKey?, env? })` with only the captured fields
- **AND** when neither apiKey nor env was captured, no `updateSkill` is invoked

#### Scenario: install chain failure is recoverable, not transactional

- **WHEN** `installSkillHub` succeeds but the chained `updateSkill` fails
- **THEN** the wizard does not roll back the install and does not call any uninstall RPC
- **AND** the user is routed to the new detail with a setup checklist that surfaces "install ok / secret or env failed, retry inline" copy
- **AND** the entry in the response body has `apiKeyConfigured: false` until the user retries the secret/env write

### Requirement: Secret boundary never exposes apiKey plaintext

The Skills surface SHALL never display the saved apiKey value, and apiKey edits SHALL go through `SkillSecretDialog`.

#### Scenario: detail shows only configured state

- **WHEN** the user views an installed skill that has a configured apiKey
- **THEN** the detail API key section shows an "API key configured" badge
- **AND** no element in the rendered DOM contains the saved apiKey value
- **AND** the detail does not show a last-4-character hint because no current Gateway read API exposes a safe secret summary

#### Scenario: BFF response sanitizes config.apiKey on the typed branch

- **WHEN** the underlying `entries[skillKey].apiKey` in `openclaw.json` is configured AND a frontend client fetches `/api/skills` on the typed `SkillsStatusResult` branch
- **THEN** the response payload contains `apiKeyConfigured: true`
- **AND** the response payload's `config` (if present) does not contain the saved apiKey value or any field whose key matches a known-secret list
- **AND** the response payload does not contain a last-4-character hint derived from the saved value

#### Scenario: BFF response sanitizes config.apiKey on the map fallback branch

- **WHEN** the BFF normalizes a `skills.status` response through the map fallback branch (`deckSkillEntryFromMap`) AND `record["config"]["apiKey"]` is populated
- **THEN** the response payload's `config` does not contain the saved apiKey value
- **AND** other `config` fields that are not in the known-secret list are preserved

#### Scenario: secret dialog masks input and clears state on close

- **WHEN** the user opens the apiKey Update dialog and enters a value
- **THEN** the input is type `password`
- **AND** when the dialog is closed without saving, the entered value is cleared from component state

#### Scenario: Rotate is disabled with explicit handoff copy

- **WHEN** the user views the apiKey section
- **THEN** the Rotate button is rendered as disabled with copy that explains the missing Gateway RPC

#### Scenario: Clear writes empty value and updates badge

- **WHEN** the user confirms Clear in the apiKey section
- **THEN** `updateSkill` is invoked with `{apiKey: ''}`
- **AND** after success the badge updates to "API key not configured"

### Requirement: env editor uses a key-value table with regex validation

The env editor SHALL be a key-value table with regex validation and a "Show raw JSON" disclosure.

#### Scenario: invalid key blocks save

- **WHEN** the user enters an env key that does not match `^[A-Z][A-Z0-9_]*$`
- **THEN** the editor shows a precise validation error
- **AND** the Save button is disabled

#### Scenario: empty rows are ignored

- **WHEN** the user adds an empty key-value row and saves
- **THEN** the empty row is omitted from the saved payload

#### Scenario: raw JSON disclosure round-trips with table view

- **WHEN** the user opens "Show raw JSON" and edits the JSON view
- **THEN** the table view, when reopened, reflects the same key-value pairs

### Requirement: Uninstall is unsupported and rendered as a handoff banner

The Skills module SHALL NOT expose any uninstall affordance and SHALL render an explicit handoff banner.

#### Scenario: detail Danger zone shows handoff banner

- **WHEN** the user opens any installed skill detail
- **THEN** the Danger zone section renders a banner with the `gateway-rpc-missing` reason and references the follow-up proposal stub
- **AND** the Danger zone contains no destructive button

#### Scenario: direct uninstall RPC is rejected by the Deck typed BFF allowlist

- **WHEN** a real request is sent for `skills.uninstall` to the Deck typed BFF transport `POST /runtimes/{runtimeId}/gateway/rpc`
- **THEN** the response status is 400 with `error.code === 'INVALID_GATEWAY_METHOD'` because the method is not present in `internal/gateway/generated/allowlist.go`
- **AND** no Skills component issues this RPC under any user flow

#### Scenario: optional raw Gateway probe returns method-not-found

- **WHEN** an optional probe is sent for `skills.uninstall` directly to the raw Gateway transport, bypassing the typed BFF allowlist
- **THEN** the response indicates Gateway's method-not-found error
- **AND** this probe is recorded as a secondary assertion only; the canonical assertion remains `INVALID_GATEWAY_METHOD` at the typed BFF layer

### Requirement: Toolbar shows pending approvals count and links to Approvals

Skills toolbar SHALL surface pending approvals as a navigational badge sourced from `plugin.approval.list`.

#### Scenario: pending count badge displays current count

- **WHEN** `plugin.approval.list` returns a non-zero count of pending approvals
- **THEN** the toolbar displays a badge labelled "Approvals: N pending"

#### Scenario: badge links to Approvals panel without inline editor

- **WHEN** the user clicks the Approvals badge
- **THEN** the user is navigated to the Approvals panel
- **AND** Skills does not render any inline approval editor

### Requirement: Owning plugin is best-effort and explicit when null

The Owning Plugin section SHALL render plugin metadata when the join resolves and "unknown plugin" copy when it does not.

#### Scenario: resolved owning plugin shows link

- **WHEN** the BFF resolves `owningPlugin.id` and `owningPlugin.name` for an installed skill
- **THEN** the section shows the plugin name and a navigation link to the Plugins panel filter for that plugin

#### Scenario: unresolved owning plugin shows explicit copy

- **WHEN** the BFF returns `owningPlugin: null` for an installed skill
- **THEN** the section shows "unknown plugin" copy and the navigation link is disabled or absent

### Requirement: Deck-facing Skills DTO carries derived product fields

`DeckGoSkillEntry` SHALL carry the derived product fields `apiKeyConfigured`, `sourceRaw`, product `source`, `agentUsage`, `availableActions`, `unsupportedReasons`, and `owningPlugin`. No separate `DeckGoSkillDetailResponse` and no `GET /skills/{skillKey}` BFF route are introduced in this pass; detail is rendered from list entries. The DTO SHALL NOT carry `apiKeyHintLast4`, `installedVersion`, `availableVersion`, or per-skill `updateState` in this pass.

#### Scenario: derived fields are present in BFF responses

- **WHEN** a frontend client fetches `/api/skills`
- **THEN** the response entries include the listed derived fields
- **AND** the saved apiKey value is never present in the response, including under `config`

#### Scenario: product source reflects OpenClaw raw source taxonomy

- **WHEN** a frontend client fetches `/api/skills`
- **THEN** every skill entry includes `sourceRaw`
- **AND** product `source` maps `openclaw-bundled` to `bundled`, `openclaw-managed` to `managed`, `openclaw-workspace` to `workspace`, `openclaw-extra` to `extra`, `agents-skills-personal` to `personal`, `agents-skills-project` to `project`, and unrecognized raw values to `unknown`

#### Scenario: per-skill version/update availability is not inferred from search

- **WHEN** `skills.status` does not expose ClawHub origin slug or installedVersion
- **THEN** the BFF does not derive `installedVersion`, `availableVersion`, or `updateState` by joining `skills.search` results
- **AND** managed skills that cannot expose per-skill update capability carry `unsupportedReasons.perSkillUpgrade === 'gateway-tracking-status-missing'`
- **AND** other derived fields are still present and consistent

### Requirement: Real verification follows three-tier fallback

Real verification of Skills mutations SHALL follow L1, L2, or L3 in order and explicitly record the chosen tier.

#### Scenario: L1 fixture verification covers core mutations against a preconfigured staging slug

- **WHEN** the verification environment supports an isolated config root, ClawHub network access, AND a preconfigured ClawHub staging fixture slug documented for the run
- **THEN** install (then chained `updateSkill` for apiKey/env when captured), enable, disable, update env, update apiKey, clear apiKey, and global update-all-to-latest are run against that staging environment
- **AND** local artifacts (apiKey value, env keys) are tagged with the run id (e.g. `__deck_test_apikey_<runId>`)
- **AND** cleanup refuses targets that do not match either the documented staging slug or the run-id-prefixed local artifact pattern

#### Scenario: L1 is downgraded to L2 when no staging slug is available

- **WHEN** the verification environment does not have a preconfigured staging fixture slug, ClawHub network is unreachable, or local disk write is unsafe
- **THEN** all ClawHub-dependent mutations (install, upgrade-to-latest) are recorded as `skipped-safe` with a reason
- **AND** the implementation report records the L-tier choice as L2 explicitly
- **AND** read paths plus UI write protections (DOM never contains saved apiKey; response body never contains saved apiKey; no Skills component invokes `updateAgentSkills`; no Skills component invokes `skills.uninstall`) are verified instead

#### Scenario: L2 skipped-safe degradation is recorded

- **WHEN** any L1 mutation cannot run safely
- **THEN** that mutation evidence is recorded as `skipped-safe` with a reason
- **AND** read paths and UI write protections are verified instead

#### Scenario: L3 mock-only floor still proves the safety model

- **WHEN** both L1 and L2 are unavailable
- **THEN** mock-only mutation evidence and negative invalid-param coverage on real Gateway together cover the four-level safety model
- **AND** the implementation report explicitly records the L3 outcome

### Requirement: Visual authority lock prevents prototype-only field promotion

The implementation SHALL follow OpenSpec product blueprint plus `frontend-new` design system as primary authority. The handoff prototype is density and rhythm reference only.

#### Scenario: prototype-only fields are not promoted

- **WHEN** the implementation considers a field that exists only in `frontend-handoff/modules/skills/prototype.html` (such as Files, Audit, trigger chips, marketplace metadata) without a backing Deck DTO
- **THEN** that field is not introduced in this change and is recorded as a handoff item

#### Scenario: divergences from current production UI are listed

- **WHEN** the implementation report is finalized
- **THEN** it lists every intentional divergence from the current production Skills UI and the handoff prototype, including the breaking removal of the agent-matrix write path
