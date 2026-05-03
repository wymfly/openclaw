# agents - components

## Tree

```txt
AgentsPanel
├─ AgentsHeader
│  ├─ title / contract-led subtitle
│  ├─ stream status Badge
│  └─ NewAgent Button
├─ AgentsMetrics
│  └─ MetricTile x5
├─ AgentsWorkbench
│  ├─ AgentsListCard
│  │  ├─ search Input
│  │  ├─ filter SegmentedControl
│  │  ├─ sort SegmentedControl
│  │  └─ AgentsTable
│  │     └─ AgentRow x N
│  └─ AgentDetailCard
│     ├─ DetailHero
│     ├─ DetailSectionNav
│     └─ DetailMain
│        ├─ OverviewSection
│        ├─ SkillsSection
│        ├─ SubagentsSection
│        ├─ ToolPolicySection
│        ├─ SystemPromptSection
│        ├─ FilesSection
│        └─ StreamsSection
├─ CreateAgentWizard
└─ ConfirmDeleteModal
```

## Production ownership

The component may remain a single bounded panel file during this pass if tests stay focused, but the visual structure above must be represented in DOM/CSS class boundaries. Split into local files only when it reduces real complexity.

## Local molecules

### AgentRow

Renders identity, default marker, status, session count, and binding count from `DeckGoAgentSummary`.

Rules:

- `id`, `name`, `status`, and `isDefault` are contract-backed.
- `sessionCount`, `bindingCount`, and `lastActiveAtMs` are optional; missing values render as `-`.
- Row click/Enter/Space opens detail.
- Busy status uses an animated local status dot.

### DetailHero

Renders selected `Agent` summary plus detail-backed metadata when available.

Rules:

- Does not invent model/workspace/default state.
- Keeps delete as a destructive action with confirmation.
- Uses compact chips for sessions, bindings, active subagents, and default state.

### ConfigSectionHeader

Renders section title, helper copy, and optional action. This remains module-local until routing/subagents repeat it.

### PreviewRow / FileRow / PermissionRow

Compact rows for read-only provenance, file entries, skills, streams, and subagent permissions. All use the same row rhythm but stay module-local.

## Atom mapping

- `Switch` from old handoff maps to `Toggle`.
- `Avatar`, `EmptyState`, `KeyHint`, `MetricTile`, and `ConfigSectionHeader` are local molecules.
- No canonical atom changes are planned.

## Class-name intent

Production CSS should preserve these semantic regions:

- `.agents-panel`
- `.agents-panel__toolbar`
- `.agents-panel__metrics`
- `.agents-workbench`
- `.agents-list-card`
- `.agents-table`
- `.agents-table__row`
- `.agents-detail-card`
- `.agents-detail__hero`
- `.agents-detail__sections`
- `.agents-detail__main`
- `.agent-section`
- `.agent-option-row`
- `.agent-preview-row`
- `.agent-file-row`
