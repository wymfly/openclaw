# design-system-cross-module-readiness Specification

## Purpose

Defines the cross-module readiness gate for migrating non-chat Deck panels onto the settled frontend design-system posture without breaking existing atoms or silently promoting panel-local molecules.

## Requirements

### Requirement: Cross-module readiness audit gate

Before any non-chat panel migration to the design system begins, the panel SHALL be evaluated against `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` (a panel × atom matrix with `applies` / `extend` / `missing` status per cell), and the panel team SHALL confirm each `extend` and `missing` entry is either resolved or accepted as a follow-up.

#### Scenario: Panel migration is proposed

- **WHEN** a developer proposes migrating a non-chat panel (Settings / Models / Channels / Sessions / Logs / future) to the design system
- **THEN** the readiness matrix SHALL include a row for that panel with explicit status per atom
- **AND** the proposal SHALL link to that row as the readiness gate evidence

#### Scenario: Atom is missing for a panel migration

- **WHEN** the readiness matrix shows `missing` for a panel × atom cell (e.g., "Channels panel needs ChartSparkline atom")
- **THEN** the new atom SHALL be added to the design system in a separate atom-introduction change
- **AND** the panel migration SHALL wait for that atom-introduction change to land
- **AND** existing atoms MUST NOT be re-architected to satisfy the missing entry — only additive new atoms are allowed

### Requirement: No-breaking-change promise for atoms during cross-module rollout

When a panel migration discovers that an existing atom is insufficient (e.g., the Card atom has no `surface=warning` variant needed for the alert panel header), the missing functionality SHALL be added as either a new variant on the existing atom (additive) or as a new atom — never as a backwards-incompatible change to the atom's existing public API.

#### Scenario: Existing atom needs a new variant

- **WHEN** a panel migration requires a Card variant (`surface=warning`) not yet supported
- **THEN** the variant SHALL be added to the Card atom's existing variant union (`flat | elevated | inset | warning`)
- **AND** existing consumers SHALL continue to work unchanged
- **AND** the new variant SHALL ship with its own test coverage in the existing Card test file

#### Scenario: Existing atom's public API would need to change

- **WHEN** a panel migration requires the existing atom's API to change in a backwards-incompatible way
- **THEN** the panel migration SHALL be paused
- **AND** a new atom SHALL be introduced alongside the existing one (e.g., `CardV2`) rather than re-architecting the existing atom
- **AND** the readiness matrix SHALL track the deprecation/migration path between old and new atom

### Requirement: Readiness matrix maintenance

The cross-module readiness matrix at `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` SHALL be updated whenever (a) a new atom is added to the design system, (b) a new target panel is identified, or (c) a panel migration completes and its row should be moved to a "completed migrations" appendix.

#### Scenario: New atom is added to design-system

- **WHEN** a new atom is added under `deck-go/frontend/src/design-system/atoms/`
- **THEN** the readiness matrix SHALL gain a column for the new atom
- **AND** every existing panel row SHALL be updated to indicate whether it would consume the new atom

#### Scenario: Panel migration completes

- **WHEN** a panel migration to the design system completes
- **THEN** the panel's row SHALL move to the "completed migrations" appendix at the bottom of the readiness matrix
- **AND** the appendix entry SHALL link to the migration's archived OpenSpec change

### Requirement: Agents readiness evidence is recorded for rollout

The cross-module readiness record SHALL include agents-specific evidence before this agents high-fidelity redesign is archived. The evidence SHALL identify which existing atoms/tokens were sufficient, which agents molecules remain local, and which candidates should be watched during routing/subagents/modules that follow.

#### Scenario: Agents redesign completes

- **WHEN** the agents high-fidelity redesign is marked complete
- **THEN** `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` SHALL include an agents entry or maintenance log linking this change
- **AND** the entry SHALL state whether canonical design-system atoms/tokens changed
- **AND** unresolved design-system candidates SHALL be listed as follow-up/watch items rather than silently promoted

### Requirement: Routing readiness evidence is recorded for rollout

The cross-module readiness record SHALL include routing-specific evidence before this routing high-fidelity redesign is archived. The evidence SHALL identify which existing atoms/tokens were sufficient, which local molecules repeated from agents, and which candidates remain watch items for subagents and later modules.

#### Scenario: Routing redesign completes

- **WHEN** the routing high-fidelity redesign is marked complete
- **THEN** `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` SHALL include a routing entry or maintenance log linking this change
- **AND** the entry SHALL state whether canonical design-system atoms/tokens changed
- **AND** any repeated agents/routing molecules SHALL be classified as local, promote-later, or follow-up rather than silently becoming canonical design-system behavior

### Requirement: Subagents readiness evidence is recorded for rollout

The cross-module readiness record SHALL include subagents-specific evidence before this subagents high-fidelity redesign is archived. The evidence SHALL identify which existing atoms/tokens were sufficient, which local molecules repeated from agents and routing, and which candidates are now ready for a separate promotion proposal.

#### Scenario: Subagents redesign completes

- **WHEN** the subagents high-fidelity redesign is marked complete
- **THEN** `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` SHALL include a subagents entry or maintenance log linking this change
- **AND** the entry SHALL state whether canonical design-system atoms/tokens changed
- **AND** repeated agents/routing/subagents molecules SHALL be classified as local, promote-in-separate-change, or follow-up rather than silently becoming canonical design-system behavior

### Requirement: Logs readiness evidence is recorded for rollout

The cross-module readiness record SHALL include logs-specific evidence before this logs high-fidelity redesign is archived. The evidence SHALL identify which existing atoms/tokens were sufficient, which local molecules repeated from agents/routing/subagents, and whether logs introduces separate observability molecules that should remain local or be promoted later.

#### Scenario: Logs redesign completes

- **WHEN** the logs high-fidelity redesign is marked complete
- **THEN** `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` SHALL include a logs entry or maintenance log linking this change
- **AND** the entry SHALL state whether canonical design-system atoms/tokens changed
- **AND** repeated molecules SHALL be classified as local, promote-in-separate-change, or follow-up rather than silently becoming canonical design-system behavior

### Requirement: Settings readiness evidence is recorded for rollout

The cross-module readiness record SHALL include settings-specific evidence before this settings high-fidelity redesign is archived. The evidence SHALL identify which existing atoms/tokens were sufficient, which local molecules repeated from agents/routing/subagents/logs, and whether settings introduces separate configuration/security molecules that should remain local or be promoted later.

#### Scenario: Settings redesign completes

- **WHEN** the settings high-fidelity redesign is marked complete
- **THEN** `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` SHALL include a settings entry or maintenance log linking this change
- **AND** the entry SHALL state whether canonical design-system atoms/tokens changed
- **AND** repeated molecules SHALL be classified as local, promote-in-separate-change, or follow-up rather than silently becoming canonical design-system behavior

### Requirement: Sessions readiness evidence is recorded for rollout

The cross-module readiness record SHALL include sessions-specific evidence before this sessions high-fidelity redesign is archived. The evidence SHALL identify which existing atoms/tokens were sufficient, which local molecules repeated from agents/routing/subagents/logs/settings, and whether sessions introduces list/detail/timeline molecules that should remain local or be promoted later.

#### Scenario: Sessions redesign completes

- **WHEN** the sessions high-fidelity redesign is marked complete
- **THEN** `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` SHALL include a sessions entry or maintenance log linking this change
- **AND** the entry SHALL state whether canonical design-system atoms/tokens changed
- **AND** repeated molecules SHALL be classified as local, promote-in-separate-change, or follow-up rather than silently becoming canonical design-system behavior
- **AND** mock visual evidence SHALL be labeled as mock visual coverage rather than real Gateway/LLM evidence

### Requirement: Channels readiness evidence is recorded for rollout

The cross-module readiness record SHALL include channels-specific evidence before this channels high-fidelity redesign is archived. The evidence SHALL identify which existing atoms/tokens were sufficient, which local molecules repeated from agents/routing/subagents/logs/settings/sessions, and whether channels introduces diagnostics/settings/access molecules that should remain local or be promoted later.

#### Scenario: Channels redesign completes

- **WHEN** the channels high-fidelity redesign is marked complete
- **THEN** `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` SHALL include a channels entry or maintenance log linking this change
- **AND** the entry SHALL state whether canonical design-system atoms/tokens changed
- **AND** repeated molecules SHALL be classified as local, promote-in-separate-change, or follow-up rather than silently becoming canonical design-system behavior

### Requirement: Gateway readiness evidence is recorded for rollout

The cross-module readiness record SHALL include gateway-specific evidence before this gateway high-fidelity redesign is archived. The evidence SHALL identify which existing atoms/tokens were sufficient, which local molecules repeated from agents/routing/subagents/logs/settings/sessions/channels, and whether gateway introduces runtime diagnostics, activity-feed, or timeline molecules that should remain local or be promoted later.

#### Scenario: Gateway redesign completes

- **WHEN** the gateway high-fidelity redesign is marked complete
- **THEN** `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` SHALL include a gateway entry or maintenance log linking this change
- **AND** the entry SHALL state whether canonical design-system atoms/tokens changed
- **AND** repeated molecules SHALL be classified as local, promote-in-separate-change, or follow-up rather than silently becoming canonical design-system behavior
- **AND** mock visual evidence SHALL be labeled as mock visual coverage rather than real Gateway/LLM evidence

### Requirement: Models readiness evidence is recorded for rollout

The cross-module readiness record SHALL include Models-specific evidence before this Models high-fidelity redesign is archived. The evidence SHALL identify which existing atoms/tokens were sufficient, which local molecules repeated from agents/routing/subagents/logs/settings/sessions/channels/gateway, and whether model table, provider tree, quota, usage chart, provider config, fallback chain, and allowlist molecules should remain local or be promoted later.

#### Scenario: Models redesign completes

- **WHEN** the Models high-fidelity redesign is marked complete
- **THEN** `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` SHALL include a Models entry or maintenance log linking this change
- **AND** the entry SHALL state whether canonical design-system atoms/tokens changed
- **AND** repeated molecules SHALL be classified as local, promote-in-separate-change, or follow-up rather than silently becoming canonical design-system behavior
- **AND** mock visual evidence SHALL be labeled as mock visual coverage rather than real Gateway/LLM evidence

### Requirement: Usage readiness evidence is recorded for rollout

The cross-module readiness record SHALL include Usage-specific evidence before this Usage high-fidelity redesign is archived. The evidence SHALL identify which existing atoms/tokens were sufficient, which local molecules repeated from agents/routing/subagents/logs/settings/sessions/channels/gateway/models, and whether chart, KPI, quota, table, session-detail, and context-pressure molecules should remain local or be promoted later.

#### Scenario: Usage redesign completes

- **WHEN** the Usage high-fidelity redesign is marked complete
- **THEN** `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` SHALL include a Usage entry or maintenance log linking this change
- **AND** the entry SHALL state whether canonical design-system atoms/tokens changed
- **AND** repeated molecules SHALL be classified as local, promote-in-separate-change, or follow-up rather than silently becoming canonical design-system behavior
- **AND** mock visual evidence SHALL be labeled as mock visual coverage rather than real Gateway/LLM evidence

### Requirement: Memory readiness evidence is recorded for rollout

The cross-module readiness record SHALL include Memory-specific evidence before this Memory high-fidelity redesign is archived. The evidence SHALL identify which existing atoms/tokens were sufficient, which local molecules repeated from agents/routing/subagents/logs/settings/sessions/channels/gateway/models/usage, and whether file-tree, graph, search-result, diagnostics, dream-action, and detail-sidecar molecules should remain local or be promoted later.

#### Scenario: Memory redesign completes

- **WHEN** the Memory high-fidelity redesign is marked complete
- **THEN** `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` SHALL include a Memory entry or maintenance log linking this change
- **AND** the entry SHALL state whether canonical design-system atoms/tokens changed
- **AND** repeated molecules SHALL be classified as local, promote-in-separate-change, or follow-up rather than silently becoming canonical design-system behavior
- **AND** mock visual evidence SHALL be labeled as mock visual coverage rather than real Gateway/LLM evidence

### Requirement: Threads readiness evidence is recorded for rollout

The cross-module readiness record SHALL include Threads-specific evidence before this Threads high-fidelity redesign is archived. The evidence SHALL identify which existing atoms/tokens were sufficient, which local molecules repeated from agents/routing/subagents/logs/settings/sessions/channels/gateway/models/usage/memory, and whether thread list row, relationship map, handoff action, and payload detail molecules should remain local or be promoted later.

#### Scenario: Threads redesign completes

- **WHEN** the Threads high-fidelity redesign is marked complete
- **THEN** `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` SHALL include a Threads entry or maintenance log linking this change
- **AND** the entry SHALL state whether canonical design-system atoms/tokens changed
- **AND** repeated molecules SHALL be classified as local, promote-in-separate-change, or follow-up rather than silently becoming canonical design-system behavior
- **AND** mock visual evidence SHALL be labeled as mock visual coverage rather than real Gateway/LLM evidence

### Requirement: Activity readiness evidence is recorded for rollout

The cross-module readiness record SHALL include Activity-specific evidence before this Activity high-fidelity redesign is archived. The evidence SHALL identify which existing atoms/tokens were sufficient, which local molecules repeated from agents/routing/subagents/logs/settings/sessions/channels/gateway/models/usage/memory/threads, and whether grouped timeline, run inventory, diagnostic stack, top-agent filter, and raw payload detail molecules should remain local or be promoted later.

#### Scenario: Activity redesign completes

- **WHEN** the Activity high-fidelity redesign is marked complete
- **THEN** `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` SHALL include an Activity entry or maintenance log linking this change
- **AND** the entry SHALL state whether canonical design-system atoms/tokens changed
- **AND** repeated molecules SHALL be classified as local, promote-in-separate-change, or follow-up rather than silently becoming canonical design-system behavior
- **AND** mock visual evidence SHALL be labeled as mock visual coverage rather than real Gateway/LLM evidence

### Requirement: API Explorer readiness evidence is recorded for rollout

The cross-module readiness record SHALL include API Explorer-specific evidence before this API Explorer high-fidelity redesign is archived. The evidence SHALL identify which existing atoms/tokens were sufficient, which local molecules repeated from agents/routing/subagents/logs/settings/sessions/channels/gateway/models/usage/memory/threads/activity, and whether contract catalog rows, schema tree rows, tabbed inventory, and untyped/raw payload detail molecules should remain local or be promoted later.

#### Scenario: API Explorer redesign completes

- **WHEN** the API Explorer high-fidelity redesign is marked complete
- **THEN** `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` SHALL include an API Explorer entry or maintenance log linking this change
- **AND** the entry SHALL state whether canonical design-system atoms/tokens changed
- **AND** repeated molecules SHALL be classified as local, promote-in-separate-change, or follow-up rather than silently becoming canonical design-system behavior
- **AND** mock visual evidence SHALL be labeled as mock visual coverage rather than real Gateway/LLM or full upstream schema-completeness evidence

### Requirement: Cron readiness evidence is recorded for rollout

The cross-module readiness record SHALL include Cron-specific evidence before this Cron high-fidelity redesign is archived. The evidence SHALL identify which existing atoms/tokens were sufficient, which local molecules repeated from prior modules, and whether scheduler status tiles, job catalog rows, form sections, run-history rows, heartbeat detail, and raw action detail molecules should remain local or be promoted later.

#### Scenario: Cron redesign completes

- **WHEN** the Cron high-fidelity redesign is marked complete
- **THEN** `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` SHALL include a Cron entry or maintenance log linking this change
- **AND** the entry SHALL state whether canonical design-system atoms/tokens changed
- **AND** repeated molecules SHALL be classified as local, promote-in-separate-change, or follow-up rather than silently becoming canonical design-system behavior
- **AND** mock visual evidence SHALL be labeled as mock visual coverage rather than real Gateway/LLM or full upstream scheduler-completeness evidence

### Requirement: Webhooks readiness evidence is recorded for rollout

The cross-module readiness record SHALL include Webhooks-specific evidence before this Webhooks high-fidelity redesign is archived. The evidence SHALL identify which existing atoms/tokens were sufficient, which local molecules repeated from prior modules, and whether webhook inventory rows, delivery rows, event subscription controls, receiver form sections, test-result seams, and raw payload molecules should remain local or be promoted later.

#### Scenario: Webhooks redesign completes

- **WHEN** the Webhooks high-fidelity redesign is marked complete
- **THEN** `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` SHALL include a Webhooks entry or maintenance log linking this change
- **AND** the entry SHALL state whether canonical design-system atoms/tokens changed
- **AND** repeated molecules SHALL be classified as local, promote-in-separate-change, or follow-up rather than silently becoming canonical design-system behavior
- **AND** mock/local visual evidence SHALL be labeled as mock/local visual coverage rather than real Gateway/LLM or full external receiver delivery evidence

### Requirement: Approvals readiness evidence is recorded for rollout

The cross-module readiness record SHALL include Approvals-specific evidence before this Approvals high-fidelity redesign is archived. The evidence SHALL identify which existing atoms/tokens were sufficient, which local molecules repeated from prior modules, and whether approval queue rows, decision action groups, policy default controls, allowlist rows, plugin approval rows, live stream markers, and raw policy/action evidence should remain local or be promoted later.

#### Scenario: Approvals redesign completes

- **WHEN** the Approvals high-fidelity redesign is marked complete
- **THEN** `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` SHALL include an Approvals entry or maintenance log linking this change
- **AND** the entry SHALL state whether canonical design-system atoms/tokens changed
- **AND** repeated molecules SHALL be classified as local, promote-in-separate-change, or follow-up rather than silently becoming canonical design-system behavior
- **AND** mock/local visual evidence SHALL be labeled as mock/local visual coverage rather than real Gateway/LLM or full approval security assurance

### Requirement: Skills readiness evidence is recorded for rollout

The cross-module readiness record SHALL include Skills-specific evidence before this Skills high-fidelity redesign is archived. The evidence SHALL identify which existing atoms/tokens were sufficient, which local molecules repeated from prior modules, and whether skill inventory rows, requirement evidence rows, config editors, install-option rows, ClawHub catalog rows, agent skill matrix cells, and raw action detail molecules should remain local or be promoted later.

#### Scenario: Skills redesign completes

- **WHEN** the Skills high-fidelity redesign is marked complete
- **THEN** `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` SHALL include a Skills entry or maintenance log linking this change
- **AND** the entry SHALL state whether canonical design-system atoms/tokens changed
- **AND** repeated molecules SHALL be classified as local, promote-in-separate-change, or follow-up rather than silently becoming canonical design-system behavior
- **AND** mock/local visual evidence SHALL be labeled as mock/local visual coverage rather than real Gateway/LLM, real ClawHub marketplace, or production install safety evidence

### Requirement: Budget readiness evidence is recorded for rollout

The cross-module readiness record SHALL include Budget-specific evidence before this Budget high-fidelity redesign is archived. The evidence SHALL identify which existing atoms/tokens were sufficient, which local molecules repeated from prior modules, and whether budget metric tiles, rule inventory rows, threshold progress bars, scoped rule forms, evaluation status evidence, and destructive confirmation controls should remain local or be promoted later.

#### Scenario: Budget redesign completes

- **WHEN** the Budget high-fidelity redesign is marked complete
- **THEN** `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` SHALL include a Budget entry or maintenance log linking this change
- **AND** the entry SHALL state whether canonical design-system atoms/tokens changed
- **AND** repeated molecules SHALL be classified as local, promote-in-separate-change, or follow-up rather than silently becoming canonical design-system behavior
- **AND** mock/local visual evidence SHALL be labeled as mock/local visual coverage rather than real Gateway/LLM, billing accuracy, usage enforcement, or production quota assurance

### Requirement: Alerts readiness evidence is recorded for rollout

The cross-module readiness record SHALL include Alerts-specific evidence before this Alerts high-fidelity redesign is archived. The evidence SHALL identify which existing atoms/tokens were sufficient, which local molecules repeated from prior modules, and whether alert metric tiles, rule inventory rows, trigger expression cards, action/cooldown evidence, fired-history fallback, policy forms, and destructive confirmation controls should remain local or be promoted later.

#### Scenario: Alerts redesign completes

- **WHEN** the Alerts high-fidelity redesign is marked complete
- **THEN** `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` SHALL include an Alerts entry or maintenance log linking this change
- **AND** the entry SHALL state whether canonical design-system atoms/tokens changed
- **AND** repeated molecules SHALL be classified as local, promote-in-separate-change, or follow-up rather than silently becoming canonical design-system behavior
- **AND** mock/local visual evidence SHALL be labeled as mock/local visual coverage rather than real Gateway/LLM, alert delivery, webhook delivery, fired history, or production incident assurance

### Requirement: Plugins readiness evidence is recorded for rollout

The cross-module readiness record SHALL include Plugins-specific evidence before this Plugins high-fidelity redesign is archived. The evidence SHALL identify which existing atoms/tokens were sufficient, which local molecules repeated from prior modules, and whether plugin metric tiles, inventory rows, selected-detail evidence, capability/action evidence, diagnostic surfaces, related-channel handoff strips, lifecycle limitation notices, and raw payload disclosure should remain local or be promoted later.

#### Scenario: Plugins redesign completes

- **WHEN** the Plugins high-fidelity redesign is marked complete
- **THEN** `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` SHALL include a Plugins entry or maintenance log linking this change
- **AND** the entry SHALL state whether canonical design-system atoms/tokens changed
- **AND** repeated molecules SHALL be classified as local, promote-in-separate-change, or follow-up rather than silently becoming canonical design-system behavior
- **AND** mock/local visual evidence SHALL be labeled as mock/local visual coverage rather than real Gateway/LLM, plugin lifecycle control, marketplace trust, package signature, or production activation assurance

### Requirement: Identity readiness evidence is recorded for rollout

The cross-module readiness record SHALL include Identity-specific evidence before this Identity high-fidelity redesign is archived. The evidence SHALL identify which existing atoms/tokens were sufficient, which local molecules repeated from prior modules, and whether canonical rails, peer mapping rows, mutation guard strips, link dialogs, hash evidence chips, raw payload disclosure, and last-action/error surfaces should remain local or be promoted later.

#### Scenario: Identity redesign completes

- **WHEN** the Identity high-fidelity redesign is marked complete
- **THEN** `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` SHALL include an Identity entry or maintenance log linking this change
- **AND** the entry SHALL state whether canonical design-system atoms/tokens changed
- **AND** repeated molecules SHALL be classified as local, promote-in-separate-change, or follow-up rather than silently becoming canonical design-system behavior
- **AND** mock/local visual evidence SHALL be labeled as mock/local visual coverage rather than real Gateway/LLM, identity provider proofing, contact directory sync, or production audit assurance

### Requirement: Config readiness evidence is recorded for rollout

The cross-module readiness record SHALL include Config-specific evidence before this Config high-fidelity redesign is archived. The evidence SHALL identify which existing atoms/tokens were sufficient, which local molecules repeated from prior modules, and whether config metric tiles, schema section chips, structured field cards, diff preview surfaces, conflict recovery strips, sensitive-field controls, raw editor seams, and payload disclosures should remain local or be promoted later.

#### Scenario: Config redesign completes

- **WHEN** the Config high-fidelity redesign is marked complete
- **THEN** `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` SHALL include a Config entry or maintenance log linking this change
- **AND** the entry SHALL state whether canonical design-system atoms/tokens changed
- **AND** repeated molecules SHALL be classified as local, promote-in-separate-change, or follow-up rather than silently becoming canonical design-system behavior
- **AND** mock/local visual evidence SHALL be labeled as mock/local visual coverage rather than real Gateway/LLM, production config mutation, secret vault, schema migration, or rollback assurance

### Requirement: Nodes readiness evidence is recorded for rollout

The cross-module readiness record SHALL include Nodes-specific evidence before this Nodes high-fidelity redesign is archived. The evidence SHALL identify which existing atoms/tokens were sufficient, which local molecules repeated from prior modules, and whether node metric tiles, inventory rows, lifecycle strips, pairing request rows, remote action forms, permission/capability chips, command/pending-work guards, and raw payload disclosures should remain local or be promoted later.

#### Scenario: Nodes redesign completes

- **WHEN** the Nodes high-fidelity redesign is marked complete
- **THEN** `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` SHALL include a Nodes entry or maintenance log linking this change
- **AND** the entry SHALL state whether canonical design-system atoms/tokens changed
- **AND** repeated molecules SHALL be classified as local, promote-in-separate-change, or follow-up rather than silently becoming canonical design-system behavior
- **AND** mock/local visual evidence SHALL be labeled as mock/local visual coverage rather than real Gateway/LLM, real device pairing, production trust proofing, remote command execution, or remote-control safety assurance

### Requirement: Docs readiness evidence is recorded for rollout

The cross-module readiness record SHALL include Docs-specific evidence before this Docs high-fidelity redesign is archived. The evidence SHALL identify which existing atoms/tokens were sufficient, which local molecules repeated from prior modules, and whether document inventory rows, category filters, Markdown reader surfaces, source evidence tiles, extraction/delete action seams, and raw payload disclosures should remain local or be promoted later.

#### Scenario: Docs redesign completes

- **WHEN** the Docs high-fidelity redesign is marked complete
- **THEN** `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` SHALL include a Docs entry or maintenance log linking this change
- **AND** the entry SHALL state whether canonical design-system atoms/tokens changed
- **AND** repeated molecules SHALL be classified as local, promote-in-separate-change, or follow-up rather than silently becoming canonical design-system behavior
- **AND** mock/local visual evidence SHALL be labeled as mock/local visual coverage rather than real Gateway/LLM, production extraction quality, or full knowledge-base assurance

### Requirement: Readiness matrix SHALL include patterns and icons columns

The cross-module readiness matrix at `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` SHALL include columns for `patterns` and `icons` alongside the existing per-atom columns. Each panel row SHALL declare per-pattern and per-icon usage status:

- `applies` — panel will consume the canonical pattern / icon as-is
- `extend` — panel needs an additive variant (must be filed as a follow-up `design-system/proposals/`)
- `missing` — panel needs a new pattern / icon not yet canonical (blocks panel migration until proposal lands)
- `n/a` — pattern / icon not relevant to this panel

The readiness gate SHALL evaluate `patterns` and `icons` cells the same way it evaluates atom cells: every `extend` and `missing` entry SHALL be either resolved or accepted as an explicit follow-up before panel migration begins.

#### Scenario: New panel adds row with patterns/icons cells

- **WHEN** a developer proposes migrating `channels` panel and updates the readiness matrix
- **THEN** the row SHALL contain per-pattern cells (PageShell / NavRail / TopBar / EmptyState / KbdHint / SectionHeader) and per-icon cells for any icons consumed
- **AND** any `extend` or `missing` cell SHALL link to its follow-up proposal or accepted-deferral entry

#### Scenario: A panel migration discovers a missing pattern

- **WHEN** the channels panel migration discovers it needs a `ListShell` pattern not yet canonical
- **THEN** the matrix cell SHALL read `missing`
- **AND** a `frontend-handoff/design-system/proposals/<YYYY-MM-DD>-pattern-list-shell.md` SHALL be filed
- **AND** the panel migration SHALL pause until the proposal is decided (per design-system-patterns reuse-analysis gate)

### Requirement: Agents prototype reflowback candidates SHALL be recorded

The readiness matrix or its appendix SHALL include an `agents-prototype-reflowback-candidates` entry recording panel-local molecules that the agents pilot exposed but did NOT promote to canonical atoms / patterns / molecules. The entry SHALL include:

- Each candidate name (e.g., `Avatar`, `ListRow`, `StatusPill`, `FileRow`)
- One-line description and where it currently lives in `frontend-handoff/modules/agents/`
- Promotion criterion: "wait for second panel exhibiting the same shape, then evaluate at quarterly reflowback day"

These candidates SHALL NOT be promoted to canonical design system surfaces by this change. Promotion happens only after a second panel demonstrates the same shape AND a separate change goes through the reuse-analysis gate.

#### Scenario: Reading the reflowback record after this change archives

- **WHEN** any agent reads the readiness matrix appendix after archive
- **THEN** the agent SHALL find an entry listing `Avatar`, `ListRow`, `StatusPill`, `FileRow` (and any other agents-pilot candidates)
- **AND** each candidate SHALL be marked "panel-local; awaiting second-panel signal"

#### Scenario: A second panel exhibits the same shape as a recorded candidate

- **WHEN** the channels prototype implements an `Avatar`-like surface and lists it in its `components.md`
- **THEN** the readiness matrix entry for `Avatar` SHALL be updated to "two-panel signal; eligible for next reflowback review"
- **AND** a separate OpenSpec change SHALL handle the actual promotion (this change does NOT promote)
