## ADDED Requirements

### Requirement: Per-agent detail page MUST organize fields into 11 task-driven sections with legacy URL hash compatibility

The deck-go agents per-agent detail page SHALL render section nav + scroll content with exactly these 11 sections in order: `overview`, `model`, `workspace`, `skills`, `subagents`, `tools`, `conversation`, `delivery`, `files`, `routing`, `danger`. The page MUST NOT introduce drawers, dashboard hero card grids, or horizontal tabs that change the visual style. The system MUST treat legacy hash IDs (`runtime`, `tool-policy`, `event-streams`, `system-prompt`) as deprecated aliases that auto-redirect to their new IDs (`workspace`, `tools`, `delivery`, `conversation` respectively) via `replaceState`.

#### Scenario: Detail page renders all 11 sections in order

- **WHEN** a user opens an existing agent detail page
- **THEN** the section nav lists the 11 sections in the order `overview / model / workspace / skills / subagents / tools / conversation / delivery / files / routing / danger`
- **AND** clicking each entry scrolls to the matching section without page reload

#### Scenario: Legacy hash auto-redirects without breaking deep links

- **WHEN** a user navigates to a URL whose hash is `#runtime`, `#tool-policy`, `#event-streams`, or `#system-prompt`
- **THEN** the page transparently rewrites the hash to `#workspace`, `#tools`, `#delivery`, or `#conversation` respectively using `replaceState`
- **AND** the corresponding new section becomes the active scroll target
- **AND** the original deep link still lands on a valid section without an error

---

### Requirement: Defaults editor MUST be an in-list toolbar entry that renders only 7 sections from `AgentDefaultsConfig` schema truth

The deck-go agents module SHALL expose a top-level Defaults editor via a toolbar button on the agents list page, routed at `?panel=agents&view=defaults`. The editor MUST reuse the same section nav + scroll skeleton as per-agent detail but only render these 7 sections: `overview` (read-only summary), `model`, `workspace`, `skills`, `subagents`, `conversation`, `delivery`. The system MUST NOT render fields not present in `AgentDefaultsConfig` (no `agentDir`, no top-level `runtime`, no top-level `tools`, no `groupChat`); such absences MUST appear as "field not rendered" (not "field disabled"). The system MUST NOT render `tools`, `files`, `routing`, or `danger` sections in the defaults editor.

#### Scenario: Defaults editor entry visible on list toolbar

- **WHEN** a user opens the agents list page
- **THEN** the toolbar shows a "Defaults" text button next to search/filter/create controls
- **AND** clicking it navigates to `?panel=agents&view=defaults`
- **AND** no drawer, modal, or separate top-level panel is created

#### Scenario: Defaults editor renders 7 sections only

- **WHEN** the defaults editor is open
- **THEN** the section nav lists exactly `overview / model / workspace / skills / subagents / conversation / delivery` in order
- **AND** the `tools`, `files`, `routing`, `danger` sections are not present

#### Scenario: Schema-absent fields are not rendered in defaults editor

- **WHEN** the defaults editor renders the `workspace` section
- **THEN** the `agentDir` and `runtime` fields are not visible (not disabled, not present in the DOM)
- **AND** when the defaults editor renders the `conversation` section, the `groupChat` field is not visible
- **AND** when the defaults editor renders the `tools` section position, no section is rendered

---

### Requirement: Field decision matrix MUST be grounded in `AgentConfig` and `AgentDefaultsConfig` schema truth

Every editable or read-only field in any agents-module UI surface MUST appear in the authoritative field decision matrix (authoritative design §2.2 and §2.4). The system MUST NOT render a per-agent override control for a field that does not exist on `AgentConfig`, and MUST NOT render a defaults override control for a field that does not exist on `AgentDefaultsConfig`. Fields that are per-agent-only (`runtime`, `agentDir`, `groupChat`, `identity`, `tools`, workspace `files`, `bindings` for routing, `danger`) MUST NOT appear in the defaults editor. Role-based model fields that are defaults-only (`imageModel`, `imageGenerationModel`, `videoGenerationModel`, `musicGenerationModel`, `pdfModel`, `compaction.model`) MUST render read-only inherit state in per-agent detail with a "Manage in defaults →" link.

#### Scenario: Per-agent detail does not expose write controls for defaults-only model roles

- **WHEN** a user opens any non-defaults agent detail and scrolls to the `model` section
- **THEN** the `imageModel`, `imageGenerationModel`, `videoGenerationModel`, `musicGenerationModel`, `pdfModel`, and `compaction.model` rows render as read-only inherit
- **AND** each row shows a "Manage in defaults →" link that navigates to the defaults editor's model section

#### Scenario: Detail page does not expose `summaryModel` write controls

- **WHEN** the model section renders in either per-agent detail or defaults editor
- **THEN** `agents.defaults.summaryModel` is shown read-only with label "Read-only — not in current schema"
- **AND** no edit control is offered

#### Scenario: Role-based model policy writes use Gateway target shape, not config-path strings

- **WHEN** the frontend or BFF writes a global role model default
- **THEN** it calls `deck.agents.modelPolicy.set` with `target = { kind: "global-default", key: <role-key> }`
- **AND** `<role-key>` is one of `text / image / imageGeneration / videoGeneration / musicGeneration / pdf / compaction / memorySearch / subagents`
- **AND** it does not send config-path strings such as `memorySearch.model` or `compaction.model` as the target key
- **AND** per-agent text model writes use `{ kind: "agent-model", key: "agent", agentId }`
- **AND** per-agent subagent model writes use `{ kind: "agent-subagents", key: "agentSubagents", agentId }`

---

### Requirement: Risk level matrix MUST classify every editable field into L0–L4 and enforce guardrails per level

The system SHALL define 5 risk levels and apply them to all editable agents-module fields:

- **L0 read-only**: gray surface + "Managed in `<module>`" link.
- **L1 inline edit**: blur or enter triggers save; failure toast; no impact dialog.
- **L2 guarded edit**: collapsed read-only summary + "Edit" button; expand reveals Save/Cancel + diff summary; base-hash conflict surfaces reload/overwrite without silent retry.
- **L3 high-risk edit**: "Edit" with warning outline; expand reveals red-banner impact preview; **MUST** require a checked "I understand…" checkbox before Save; Save renders destructive color.
- **L4 destructive**: full-section red surface; confirmation modal requires the user to type the agent id exactly; BFF MUST validate the id server-side; impact preview MUST be fresh-fetched.

#### Scenario: L3 Save is blocked until checkbox is checked

- **WHEN** a user opens an L3 editor and a fresh impact preview has loaded
- **THEN** the "I understand…" checkbox is unchecked by default and the Save button is disabled
- **AND** checking the checkbox enables Save
- **AND** unchecking it disables Save again

#### Scenario: L4 destructive delete requires exact agent id

- **WHEN** a user opens the danger section delete dialog for a non-main agent
- **THEN** Proceed is disabled until the typed input exactly matches the agent id (case-sensitive)
- **AND** an incorrect id keeps Proceed disabled and shows an inline mismatch hint
- **AND** the BFF rejects any delete request whose `agentId` does not match the URL-bound agent

#### Scenario: Base-hash conflict on L2 save does not silently retry

- **WHEN** an L2 save returns base-hash conflict
- **THEN** the UI keeps the user's dirty draft
- **AND** offers explicit reload (discard local) or overwrite (force) actions
- **AND** does not silently re-issue the save

---

### Requirement: Detail response MUST expose inheritance via new `DeckGoAgentEffectiveField<T>` and `DeckGoAgentInheritanceMap`, preserving legacy DTO

The system SHALL extend `DeckGoAgentDetailResponse` with an optional `inherited?: DeckGoAgentInheritanceMap` field whose entries use the new `DeckGoAgentEffectiveField<T>` object DTO. The new DTO MUST reuse the existing `DeckGoAgentEffectiveSource` string union as its `source` field type. The existing `DeckGoAgentEffectiveSources` 5-field map MUST be preserved and continue to be populated for backward compatibility. The new inheritance map MUST be populated by the Gateway, not reverse-engineered by the frontend.

#### Scenario: Detail returns both legacy effectiveSources map and new inherited map

- **WHEN** the Gateway responds to `deck.agents.detail`
- **THEN** the response includes the legacy `effectiveSources` 5-field map populated as before
- **AND** the response includes a new `inherited` map covering at least `workspace / sandbox / embeddedHarness / embeddedPi / params / thinkingDefault / verboseDefault / reasoningDefault / fastModeDefault / memorySearch / heartbeat / humanDelay / groupChat / systemPromptOverride`
- **AND** each entry has `{ source, hasOverride, canReset }` plus optional `effective / fallback / fallbackReason`

#### Scenario: Frontend renders source badge using inheritance map only

- **WHEN** the frontend computes source badge for any inheritable field
- **THEN** it reads `DeckGoAgentInheritanceMap[<field>].source` (and `.hasOverride` for reset availability)
- **AND** does not attempt to reverse-engineer inherit chains client-side
- **AND** if `inherited` is absent for that field, the badge degrades to "Source unknown" with reset disabled

---

### Requirement: Impact data MUST be served by two separate layers with explicit consumer read rules

The system SHALL maintain two impact data layers:

- **Layer A (detail snapshot)**: `DeckGoAgentImpactSummary` extended additively with `bindings?: { count, samples, truncated }`, `sessions?: { total, active, truncated }`, `files?: { total, bootstrapPresent, truncated }`, `capturedAt?`, `available?`, `unavailableReason?`. Legacy flat fields (`bindingCount`, `sessionCount`, `activeSubagentCount`, `workspaceFileCount`, `deleteRemovesFiles`) and detail top-level inline counts MUST be preserved and populated consistently with the nested fields; numerical inconsistency between the layers is a bug. This snapshot MAY be cached by Data Fabric.
- **Layer B (fresh impact)**: a new `deck.agents.impactPreview.get` RPC returns the same `DeckGoAgentImpactSummary` plus per-operation `riskSpecifics` and `canProceedWithoutImpact`. This RPC MUST NOT be cached by Data Fabric and MUST NOT participate in detail's invalidate graph.

The frontend MUST consume Layer A for overview hero metric chips and routing section samples, and MUST consume Layer B at the moment any L3/L4 dialog opens.

#### Scenario: Opening an L3/L4 dialog forces fresh impactPreview fetch

- **WHEN** a user clicks an L3 Edit or L4 Delete trigger
- **THEN** the dialog issues `deck.agents.impactPreview.get` immediately and waits for response
- **AND** the dialog's "I understand…" checkbox cannot be checked until the fresh response arrives
- **AND** the request bypasses any Data Fabric cache (different query key than detail)

#### Scenario: Routing section consumes samples and offers Routing-module jump when truncated

- **WHEN** the routing section renders
- **THEN** it lists entries from `impact.bindings.samples` filtered by agentId (showing bindingIndex / type / channel / accountId / peer / summary)
- **AND** if `impact.bindings.truncated` is true, it displays "View all in Routing →" linking to the Routing module with `&fromAgent=<id>`
- **AND** it does not request a full binding list inside the agents module

#### Scenario: Detail legacy flat fields and new nested fields remain consistent

- **WHEN** the Gateway populates `DeckGoAgentImpactSummary` in detail
- **THEN** `impact.bindingCount` equals `impact.bindings.count` (when present)
- **AND** `impact.sessionCount` equals `impact.sessions.total` (when present)
- **AND** `impact.workspaceFileCount` equals `impact.files.total` (when present)
- **AND** the contract gate test for detail handler enforces this consistency

---

### Requirement: Detail response MUST aggregate unresolved references in four categories with explicit reasons

The Gateway detail handler SHALL aggregate unresolved references on each agent and return them as `DeckGoAgentUnresolvedReferences` covering exactly these categories: `skills` (with `reason: 'not-installed' | 'disabled' | 'unknown'`), `subagents` (with `reason: 'agent-not-found' | 'agent-deleted' | 'unknown'`), `eventStreams` (with `reason: 'not-in-declared-options' | 'unknown'`), `models` (with `reason: 'not-in-catalog' | 'provider-disabled' | 'unknown'`). Tool references MUST NOT enter this aggregation. The frontend overview hero MUST surface a single "unresolved refs" chip whose click opens a centralized modal listing all four categories with Install / Remove / Keep / cross-module-jump actions.

#### Scenario: Hero chip and modal surface unresolved references from detail

- **WHEN** an agent has unresolved skills, subagents, eventStreams, or models
- **THEN** the overview hero shows a "⚠ N unresolved refs" chip where N is the total count across the four categories
- **AND** clicking the chip opens a modal that lists each category section with rows showing name and reason
- **AND** each row offers Install / Remove / Keep / cross-module-jump (skills → Skills, subagents → Subagents, eventStreams → Channels, models → Models)

#### Scenario: "Keep" marks acknowledged without mutation

- **WHEN** a user clicks Keep on an unresolved row
- **THEN** the row is marked acknowledged in local state and no Gateway mutation is issued
- **AND** the chip count remains unchanged on next detail load until the underlying config changes

---

### Requirement: BFF product actions MUST enforce a per-action config write path allowlist

Every agents-module BFF product action that ultimately calls Gateway `config.patch` or `config.apply` SHALL declare a config path allowlist scoped to the action's owning subtree, and MUST guard the patch/apply payload to reject writes that fall outside the allowlist. The allowlist MUST be encoded in `deck-go/contracts/source/deck-config-write-safety.contract.json` and verified by the `contract-gate`. Per-agent actions MUST only write under `agents.list[<agentId>]` for the fields the action owns; defaults actions MUST only write under `agents.defaults.*` and only the fields enumerated in authoritative design §2.4. Writes to `models.providers`, `bindings`, top-level `tools`, or any other module's owning paths MUST be rejected with an error mapped to a deterministic error code; rejection MUST be covered by unit tests.

#### Scenario: Per-agent cognition action rejects out-of-scope path

- **WHEN** the BFF receives `agents.cognition.set` and the constructed patch attempts to write `agents.list[<id>].tools` or `models.providers`
- **THEN** the path allowlist guard rejects the request before calling Gateway
- **AND** returns a deterministic error code documented in `deck-config-write-safety.contract.json`
- **AND** the unit test suite includes coverage for at least these three out-of-scope targets: `models.providers`, `bindings`, root-level `tools`

#### Scenario: Workspace path edit goes through `agents.update` not `config.patch`

- **WHEN** the BFF receives a per-agent workspace path change via `agents.workspace.set`
- **THEN** the path-change portion is dispatched to Gateway `agents.update` (preserving workspace bootstrap + identity sync side effects)
- **AND** any non-path workspace fields (`agentDir`, `runtime`, `sandbox`, `embeddedHarness`, `embeddedPi`, `params`) flow through `config.patch` subject to the allowlist guard

#### Scenario: Reset semantics use null delete-key or fallback to `config.apply`

- **WHEN** a user resets an inheritable field to defaults
- **THEN** the BFF emits `config.patch` with the field set to `null` for delete-key semantics where supported
- **AND** when `config.patch` cannot express deletion (e.g., array element removal), the BFF constructs the next config and calls `config.apply` while applying the same allowlist diff guard

---

### Requirement: Gateway deck namespace MUST be additively extended for detail / subagents / impactPreview without touching upstream protocol

The system SHALL extend the deck namespace at `src/gateway/protocol/schema/deck.ts` and `src/gateway/server-methods/deck/` only, leaving all non-`deck/` server methods, non-`deck.ts` protocol schemas, and `src/config/types.agents*.ts` unchanged. Specifically:

- `DeckAgentsDetailResultSchema` MUST be extended to include optional fields for `thinkingDefault`, `verboseDefault`, `memorySearch`, `humanDelay`, `heartbeat`, `groupChat`, `embeddedHarness`, `embeddedPi`, `systemPromptOverride`, `params`, `runtime`, `tools`, plus `inherited` (`DeckGoAgentInheritanceMap`) and `unresolvedReferences` (`DeckGoAgentUnresolvedReferences`); all new fields MUST be optional and additive.
- `deck.agents.subagents.set` schema MUST gain an optional `requireAgentId?: boolean` field, and the corresponding handler MUST persist `cfg.agents.list[i].subagents.requireAgentId`.
- New RPC `deck.agents.impactPreview.get` MUST be registered with `DeckAgentsImpactPreviewParamsSchema` + `DeckAgentsImpactPreviewResultSchema` + a `validateDeckAgentsImpactPreviewParams` export + method-def + scope/discovery inventory; the handler at `src/gateway/server-methods/deck/agents-impact-preview.ts` MUST return a `DeckGoAgentImpactSummary` plus per-operation `riskSpecifics` and `canProceedWithoutImpact`.

Mock fixtures MUST NOT expose fields that are absent from `DeckAgentsDetailResultSchema` or not populated by the detail handler. Missing real fields SHALL render unsupported/degraded states until protocol schema, contract DTOs, handler output, frontend facade, and real evidence have all been updated.

#### Scenario: Existing detail consumers do not break after additive schema extension

- **WHEN** an old client requests `deck.agents.detail` after schema extension
- **THEN** all previously-returned fields are still present with identical types
- **AND** new fields are absent (undefined) for clients that did not opt into them
- **AND** type-check / contract gate stays green

#### Scenario: `requireAgentId` round-trip lands in openclaw.json

- **WHEN** the frontend calls `deck.agents.subagents.set` with `requireAgentId: true` and a valid baseHash
- **THEN** the handler writes `agents.list[<id>].subagents.requireAgentId = true` to openclaw.json
- **AND** a subsequent `deck.agents.detail` reflects this in `subagents.requireAgentId` and in `inherited.subagents` source badge

#### Scenario: New `impactPreview.get` RPC is discoverable and validated

- **WHEN** the Gateway is started after deploying this change
- **THEN** `deck.agents.impactPreview.get` is discoverable via the standard method discovery mechanism
- **AND** invocation with invalid params returns a deterministic validation error
- **AND** invocation with a valid `{ agentId, operation, baseHash? }` returns a typed response containing `impact` + `riskSpecifics` + `canProceedWithoutImpact`

---

### Requirement: `main` agent MUST be protected uniformly across all editable surfaces

The system SHALL protect the reserved agent id `main` in every per-agent detail surface: the `danger` section delete button MUST NOT render for `main`; all L2/L3 editors MUST display a protection banner at the top; L3 editors MUST require an extra "I understand main is fallback" checkbox in addition to the standard "I understand…" checkbox before Save unlocks; cross-module jumps still function but always tag `mainKey` in URL.

#### Scenario: Delete button is absent for main

- **WHEN** a user opens the danger section for the `main` agent
- **THEN** the delete button is not rendered (not disabled, not present in DOM)
- **AND** the section displays a banner explaining main is protected as system fallback

#### Scenario: L3 edits on main require two confirmation checkboxes

- **WHEN** a user expands an L3 editor on `main` (for example workspace path or subagents narrowing)
- **THEN** both "I understand main is fallback" and the standard "I understand…" checkboxes must be checked before Save unlocks
- **AND** unchecking either one re-disables Save

---

### Requirement: Cross-module write authority matrix MUST be enforced uniformly with R-only visual treatment

Each OpenClaw config concept SHALL have exactly one owning module with write authority (W); every other module that displays the same concept MUST be read-only (R) with link-out treatment. Specifically: `agents.list[].*` and `agents.defaults.*` are owned by Agents; `models.providers` and model catalog are owned by Models; skill install/catalog by Skills; global tools/approvals by Tools/Approvals; channel connections and event-stream declared options by Channels; `bindings[]` by Routing; session content by Sessions. Agents-module R-only fields MUST display a link-out icon + "Managed in `<module>`" small text + hover tooltip; clicking SHALL navigate via `?panel=<target>&from=agents&fromAgent=<id>` and not enter an in-place editor. The agents module MUST NOT in-place edit any field whose owning module has not shipped its editor; in that case the R-only link routes to a "This module is under construction" placeholder.

#### Scenario: Models picker in agents detail jumps to Models module

- **WHEN** a user clicks the "Manage providers → Models" affordance under a model picker
- **THEN** the URL navigates to `?panel=models&from=agents&fromAgent=<id>`
- **AND** the agents module does not open an in-place model provider editor

#### Scenario: Owning module placeholder does not unblock agents in-place editing

- **WHEN** a cross-module link target has not shipped its real panel
- **THEN** the link routes to a placeholder ("This module is under construction")
- **AND** the agents module still does not render an in-place editor for that field

---

### Requirement: Acceptance MUST be layered: mock for UI/visual/interaction; real Gateway for contract chain and openclaw.json side effects

The change SHALL prove correctness through two non-substitutable acceptance layers:

- **Mock E2E**: covers list / detail / 11 sections × A/B/C inheritance states × L1/L2/L3/L4 risk paths, defaults editor 7-section subset, unresolved refs modal, cross-module jump URL protocol, dark/light × zh/en combinations, a11y (keyboard, focus trap, aria labels).
- **Real Gateway E2E** (run under `deck-go/.local/deck-go-real-stack/isolated/data/managed-gateway-state/openclaw.json` isolation): covers BFF product action round-trips actually landing in the isolated openclaw.json, base-hash conflict, reset/delete-key semantics, allowlist guard rejection of out-of-scope paths, `requireAgentId` round-trip, `impactPreview.get` fresh fetch behavior.

Mock MUST NOT replace real-Gateway evidence for contract chain verification; real-Gateway MUST NOT replace mock evidence for visual / a11y / i18n / dark-light. When real-Gateway evidence is impossible to collect, the change MUST record a circuit-breaker handoff per CLAUDE.md OpenSpec closure rules; mock + code-level checks MUST still pass.

#### Scenario: Mock evidence cannot stand in for contract-chain evidence

- **WHEN** the change is reviewed for closure
- **THEN** the implementation report MUST list real-Gateway evidence covering at least: cognition set round-trip, defaults workspace set round-trip, subagents.requireAgentId round-trip, allowlist guard rejection, impactPreview.get fresh fetch, base-hash conflict
- **AND** if any of these is missing, the report explicitly flags a circuit-breaker handoff rather than silently relying on mock results

#### Scenario: Real-Gateway acceptance uses isolated openclaw.json only

- **WHEN** real-Gateway E2E runs
- **THEN** all writes target `deck-go/.local/deck-go-real-stack/isolated/data/managed-gateway-state/openclaw.json`
- **AND** no test touches the user's global `~/.openclaw/openclaw.json` or any non-isolated config file
- **AND** run-scoped fixtures use a `e2e-agents-conv-<runId>-<slot>` naming pattern and cleanup matches that pattern strictly
