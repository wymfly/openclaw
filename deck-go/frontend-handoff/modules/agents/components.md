# agents — components

> Component tree, props contracts, and where each piece lives. Atoms come from `@/design-system/atoms/*`; **module-private** composites live in `frontend/src/components/panels/agents/`.

## Tree

```
<AgentsPanel>                          ← top-level, route /agents/*
├── <AgentsTopbar>                     ← breadcrumb + List/Detail seg switch
├── <AgentsListView>                   ← when route is /agents
│   ├── <AgentsListToolbar>            ← search · filter · sort · "+ New"
│   │   ├── Input (Search)
│   │   ├── SegmentedControl (Filter: all/busy/default)
│   │   ├── SegmentedControl (Sort: recent/name/sessions)
│   │   └── Button (primary, "+ New agent")
│   ├── <AgentsTable>
│   │   ├── <AgentsTableHead>
│   │   └── <AgentRow>                 ← composite, module-private
│   │       ├── Avatar (emoji)
│   │       ├── Badge ("Default")      ← when isDefault
│   │       ├── StatusDot              ← idle/busy/error
│   │       ├── IconButton (Open / overflow)
│   │       └── Tooltip
│   └── <EmptyState>                   ← when no agents match
└── <AgentDetailView>                  ← when route is /agents/:id
    ├── <DetailNav>                    ← left rail, sticky
    │   ├── <DetailNavHeader>          ← avatar · name · id · live status
    │   └── <NavItem> ×7               ← Overview/Skills/Subagents/...
    └── <DetailMain>                   ← scrollable, route-driven
        ├── <OverviewSection>
        ├── <SkillsSection>
        ├── <SubagentsSection>
        ├── <ToolPolicySection>
        ├── <SystemPromptSection>
        ├── <FilesSection>
        └── <StreamsSection>

<CreateWizard>                         ← portal-mounted overlay
├── <WizardHead>
├── <WizardSteps>                      ← step indicator
├── <WizardBody>                       ← step-keyed content
│   ├── Step 0: Identity (name/emoji/workspace)
│   ├── Step 1: Model
│   ├── Step 2: Skills (mode + per-skill toggles)
│   ├── Step 3: Subagents
│   └── Step 4: Review
└── <WizardFoot>                       ← Cancel · Back · Next/Create

<ConfirmDelete>                        ← Modal portal
```

## Composite props (module-private)

### `<AgentRow>`

```ts
type AgentRowProps = {
  agent: AgentSummary; // from agents store (v2 shape — see api-usage.md)
  active?: boolean; // visual highlight when this is the open detail
  onOpen: (id: string) => void; // navigate to detail
  onOverflow?: (e: MouseEvent) => void; // optional row-overflow menu
};
```

Renders as a row in `<AgentsTable>`. Click anywhere → `onOpen(agent.id)`. Status dot pulses when `agent.status === "busy"`.

### `<DetailNav>`

```ts
type DetailNavProps = {
  agent: AgentSummary;
  sectionId: SectionId;
  onSectionChange: (next: SectionId) => void;
  counts: Partial<Record<SectionId, number>>; // e.g. { skills: 4, files: 12 }
};
type SectionId =
  | "overview"
  | "skills"
  | "subagents"
  | "tool-policy"
  | "system-prompt"
  | "files"
  | "event-streams";
```

Hash-routed via `use-config-section-router`. Counts come from `agents-detail` store keyed by agent id.

### `<OverviewSection>`

```ts
type OverviewSectionProps = {
  agent: AgentDetail; // hydrated detail (full shape)
  dirty: boolean; // any unsaved edits
  onPatch: (patch: AgentPatch) => void; // optimistic local edit
  onSave: () => Promise<void>; // -> PATCH /agents/{id}
  onDelete: () => void; // -> opens ConfirmDelete
};
```

Edits are local until `onSave`. `Save changes` button disabled when `!dirty`.

### `<SkillsSection>`, `<SubagentsSection>`, `<StreamsSection>`

All three follow the same shape:

```ts
type EditableSectionProps<T> = {
  agentId: string;
  data: T;
  hash: string; // optimistic-lock fingerprint (composite hash family)
  dirty: boolean;
  onPatch: (next: T) => void;
  onSave: () => Promise<void>;
};
```

Three writes share one composite hash (`AgentConfigHashes.composite`) so the UI surfaces a single "Unsaved changes" indicator at the top of detail rather than three competing ones.

### `<ToolPolicySection>` & `<SystemPromptSection>` (read-only)

```ts
type ToolPolicyProps = {
  agentId: string;
  preview: ToolPolicyPreview; // resolved rules with provenance
  loading?: boolean;
  error?: string;
};

type SystemPromptProps = {
  agentId: string;
  preview: SystemPromptPreview; // sectioned markdown
  loading?: boolean;
  error?: string;
};
```

No save action. A "Recompute" button refetches when something upstream changed (e.g. user just toggled a skill).

### `<FilesSection>`

```ts
type FilesSectionProps = {
  agentId: string;
  files: AgentFile[];
  onUpload: (file: File) => Promise<void>;
  onOpen: (name: string) => void; // GET /agents/{id}/files/{name}
};
```

### `<CreateWizard>`

```ts
type CreateWizardProps = {
  open: boolean;
  onClose: () => void;
  onCreate: (draft: AgentDraft) => Promise<{ id: string }>; // -> POST /agents, returns new id; caller routes to detail
};
type AgentDraft = {
  name: string;
  emoji: string;
  model: string;
  workspace: string;
  skillMode: "inherit" | "explicit" | "none";
  skills: string[]; // skill ids when skillMode === "explicit"
  allowedAgents: string[]; // subagent permits
};
```

Wizard maintains its own `agents-create` store. On step transition, validates current step before advancing. On final "Create agent" success → `onClose()` and parent routes to `/agents/:newId`.

### `<ConfirmDelete>`

```ts
type ConfirmDeleteProps = {
  agent: AgentSummary; // shows name + sessionCount + bindingCount in body
  onCancel: () => void;
  onConfirm: () => Promise<void>;
};
```

## Atoms used (count: 22 of 36)

`Avatar · Badge · Banner · Button · Card · Chip · Drawer · DropdownMenu · EmptyState · IconButton · Input · KeyHint · Markdown · Modal · SegmentedControl · SidebarRow · Spinner · Switch · Tab · Textarea · Toast · Tooltip`

## What's NOT a component

- **Status dot** is intentionally not an atom — it's a single-rule CSS class (`.dot.dot--busy`) reused across rows + detail header. Keeping it as CSS avoids a 6-line component file.
- **Skill row / file row / policy rule** are CSS layout patterns, not components — they appear once per section and don't need extraction.
- **Section header** (title + subtitle + action) is repeated 7×; if a third module needs it, promote `<ConfigSectionHeader>` to atoms per the promotion rule.
