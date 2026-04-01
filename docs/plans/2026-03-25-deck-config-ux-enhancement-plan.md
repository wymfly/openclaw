# Deck Config UX Enhancement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Deck dashboard's configuration editing experience from a mechanical schema→form mapper into a guided, understandable interface for all user levels.

**Architecture:** Three layered deliverables — (1) ConfigPanel understanding layer enhances the generic editor with help popovers, grouping, and advanced collapse; (2) Agent Config Editor adds a new tab for editing core agent fields with inherit/override visibility; (3) Channel Settings tab adds post-setup editing for DM policy, retry, and per-channel fields. All read/write via existing `config.get`/`config.patch`/`config.schema` RPC — zero backend changes.

**Tech Stack:** Next.js 15, React 19, Zustand, next-intl, Radix UI (via shadcn/ui), Lucide icons

**Design Spec:** `docs/plans/2026-03-25-deck-config-ux-enhancement-design.md`

---

## File Structure

### New Files (9)

| File                                                                  | Responsibility                                            |
| --------------------------------------------------------------------- | --------------------------------------------------------- |
| `dashboard/src/components/panels/config-editor/SectionIntroCard.tsx`  | Section overview card (title + description + docs link)   |
| `dashboard/src/components/panels/config-editor/FieldHelpPopover.tsx`  | Field-level help `?` icon with popover                    |
| `dashboard/src/lib/section-metadata.ts`                               | Static mapping: section key → i18n keys + docs URL + icon |
| `dashboard/src/components/panels/agents/tabs/AgentConfigTab.tsx`      | Agent Config Editor main component (4-card grid)          |
| `dashboard/src/components/shared/InheritBadge.tsx`                    | Reusable inherit/override badge                           |
| `dashboard/src/components/panels/agents/tabs/ToolProfileSelector.tsx` | Visual profile pill selector                              |
| `dashboard/src/components/panels/channels/ChannelSettingsTab.tsx`     | Channel settings tab main component                       |
| `dashboard/src/components/panels/channels/DmPolicySelector.tsx`       | DM policy radio card selector                             |
| `dashboard/src/components/panels/channels/RetryStrategyEditor.tsx`    | Retry fields + timeline visualization                     |

### Modified Files (14)

| File                                                            | Change                                                                              |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `dashboard/src/lib/ui-hints.ts`                                 | Extend `UiHint` interface + `[]` path normalization                                 |
| `dashboard/src/lib/schema-parser.ts`                            | Add `group`, `tags`, `help` to `FormField` + populate in `parseProperty()`          |
| `dashboard/src/stores/config.ts`                                | Persist `uiHints` from `config.schema` RPC                                          |
| `dashboard/src/components/panels/config-editor/ConfigPanel.tsx` | SectionIntroCard + applyUiHints with section prefix                                 |
| `dashboard/src/components/panels/config-editor/SchemaForm.tsx`  | Wire Password/Record/Union/TypedArray/Validation + group layout + advanced collapse |
| `dashboard/src/components/panels/config-editor/SectionNav.tsx`  | Icons, field counts, advanced hint                                                  |
| `dashboard/src/components/panels/agents/AgentDetail.tsx`        | Register "config" tab                                                               |
| `dashboard/src/lib/panel-navigation.ts`                         | Add `"config"` to `AgentTab` type union                                             |
| `dashboard/src/stores/deck-agents.ts`                           | Add `fetchAgentRawConfig()`, `saveAgentConfig()`                                    |
| `dashboard/src/components/panels/channels/ChannelDetail.tsx`    | Refactor to tabbed layout                                                           |
| `dashboard/src/components/panels/channels/BindingsTab.tsx`      | Add optional `channelId` prop for filtering                                         |
| `dashboard/src/stores/channels.ts`                              | Add `fetchChannelConfig()`, `saveChannelConfig()`                                   |
| `dashboard/src/i18n/zh.json`                                    | ~95 new i18n keys                                                                   |
| `dashboard/src/i18n/en.json`                                    | ~95 new i18n keys                                                                   |

---

## Task 0: uiHints Foundation (prerequisite for all)

**Files:**

- Modify: `dashboard/src/lib/ui-hints.ts`
- Modify: `dashboard/src/lib/schema-parser.ts`
- Modify: `dashboard/src/stores/config.ts`
- Test: `dashboard/src/lib/ui-hints.test.ts`
- Test: `dashboard/src/lib/schema-parser.test.ts`

- [ ] **Step 1: Extend `UiHint` interface in `ui-hints.ts`**

Add `help`, `label`, `tags`, `group`, `order`, `advanced` to `UiHint`. Add `[]` → `*` path normalization in `matchUiHint()`. Extend `applyUiHints()` to copy `help`, `group`, `tags` onto `FormField`.

```typescript
export interface UiHint {
  sensitive?: boolean;
  collapsed?: boolean;
  placeholder?: string;
  // NEW fields from Gateway ConfigUiHint:
  help?: string;
  label?: string;
  tags?: string[];
  group?: string;
  order?: number;
  advanced?: boolean;
}
```

In `matchUiHint()`, before the wildcard loop, normalize `[]` in hint keys to `*`:

```typescript
// Normalize [] to * in hint paths for matching
const normalizedPath = hintPath.replace(/\[\]/g, "*");
```

In `applyUiHints()`, extend the decorated spread to include new fields:

```typescript
...(hint.help !== undefined ? { help: hint.help } : {}),
...(hint.group !== undefined ? { group: hint.group } : {}),
...(hint.tags !== undefined ? { tags: hint.tags } : {}),
```

- [ ] **Step 2: Extend `FormField` in `schema-parser.ts`**

Add to the `FormField` interface:

```typescript
export interface FormField {
  // ... existing fields ...
  help?: string;
  group?: string;
  tags?: string[];
  validation?: ValidationConstraints;
}
```

Also extend `parseProperty()` to populate `validation` from JSON Schema constraints (`minLength`, `maxLength`, `minimum`, `maximum`, `pattern`), and to populate `variants`/`valueSchema`/`itemSchema` from `oneOf`/`additionalProperties`/`items` sub-schemas. Currently these fields exist on the interface but `parseProperty()` never sets them — the existing advanced field components (`UnionField`, `RecordField`, `TypedArrayField`) will remain inert until this parsing is added.

Note: `PasswordField` is **already wired** in `SchemaForm.tsx` (line 280-289). Task 3 should skip re-wiring it and focus on the other 4 components.

- [ ] **Step 3: Extend `config.ts` store to persist uiHints**

In `fetchSchema()`, extract and store `uiHints` alongside `schema`:

```typescript
// In ConfigState interface, add:
uiHints: UiHintsMap | null;

// In fetchSchema(), change:
const data = (await res.json()) as Record<string, unknown>;
set({
  schema: (data.schema as Record<string, unknown>) ?? data,
  uiHints: (data.uiHints as UiHintsMap) ?? null,
});
```

- [ ] **Step 4: Write tests for `[]` path normalization**

In `ui-hints.test.ts`, add test cases for `matchUiHint` with `[]` syntax:

```typescript
it("matches [] wildcard paths", () => {
  const hints = { "agents.list[].model": { help: "test" } };
  expect(matchUiHint("agents.list.0.model", hints)).toEqual({ help: "test" });
});
```

- [ ] **Step 5: Run tests**

Run: `cd dashboard && pnpm vitest run src/lib/ui-hints.test.ts src/lib/schema-parser.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
scripts/committer "[enhanced] feat(deck): extend uiHints foundation — UiHint interface, path normalization, config store persistence" dashboard/src/lib/ui-hints.ts dashboard/src/lib/schema-parser.ts dashboard/src/stores/config.ts dashboard/src/lib/ui-hints.test.ts dashboard/src/lib/schema-parser.test.ts
```

---

## Task 1: SectionIntroCard + section-metadata

**Files:**

- Create: `dashboard/src/lib/section-metadata.ts`
- Create: `dashboard/src/components/panels/config-editor/SectionIntroCard.tsx`

- [ ] **Step 1: Create `section-metadata.ts`**

Static mapping for ~10 known config sections. Each entry has i18n title/description keys, docs URL, and lucide icon name. Unknown sections fall back gracefully (no intro card shown).

```typescript
export const SECTION_META: Record<
  string,
  {
    titleKey: string;
    descriptionKey: string;
    docsUrl: string;
    icon: string;
  }
> = {
  agents: {
    titleKey: "config.sectionIntro.agents.title",
    descriptionKey: "config.sectionIntro.agents.description",
    docsUrl: "https://docs.openclaw.ai/configuration#agents",
    icon: "Bot",
  },
  tools: {
    titleKey: "config.sectionIntro.tools.title",
    descriptionKey: "config.sectionIntro.tools.description",
    docsUrl: "https://docs.openclaw.ai/configuration#tools",
    icon: "Wrench",
  },
  gateway: {
    titleKey: "config.sectionIntro.gateway.title",
    descriptionKey: "config.sectionIntro.gateway.description",
    docsUrl: "https://docs.openclaw.ai/gateway",
    icon: "Server",
  },
  channels: {
    titleKey: "config.sectionIntro.channels.title",
    descriptionKey: "config.sectionIntro.channels.description",
    docsUrl: "https://docs.openclaw.ai/configuration#channels",
    icon: "Share2",
  },
  models: {
    titleKey: "config.sectionIntro.models.title",
    descriptionKey: "config.sectionIntro.models.description",
    docsUrl: "https://docs.openclaw.ai/configuration#models",
    icon: "Brain",
  },
  hooks: {
    titleKey: "config.sectionIntro.hooks.title",
    descriptionKey: "config.sectionIntro.hooks.description",
    docsUrl: "https://docs.openclaw.ai/configuration#hooks",
    icon: "Webhook",
  },
  secrets: {
    titleKey: "config.sectionIntro.secrets.title",
    descriptionKey: "config.sectionIntro.secrets.description",
    docsUrl: "https://docs.openclaw.ai/configuration#secrets",
    icon: "Lock",
  },
  logging: {
    titleKey: "config.sectionIntro.logging.title",
    descriptionKey: "config.sectionIntro.logging.description",
    docsUrl: "https://docs.openclaw.ai/configuration#logging",
    icon: "FileText",
  },
  update: {
    titleKey: "config.sectionIntro.update.title",
    descriptionKey: "config.sectionIntro.update.description",
    docsUrl: "https://docs.openclaw.ai/configuration#update",
    icon: "RefreshCw",
  },
  browser: {
    titleKey: "config.sectionIntro.browser.title",
    descriptionKey: "config.sectionIntro.browser.description",
    docsUrl: "https://docs.openclaw.ai/configuration#browser",
    icon: "Globe",
  },
};
```

- [ ] **Step 2: Create `SectionIntroCard.tsx`**

Component receives `sectionKey: string`, looks up `SECTION_META`, renders intro card with i18n text + docs link. Returns `null` for unknown sections.

- [ ] **Step 3: Add i18n keys to `zh.json` and `en.json`**

Add `config.sectionIntro.{section}.title` and `config.sectionIntro.{section}.description` for each section in both locale files.

- [ ] **Step 4: Commit**

```bash
scripts/committer "[enhanced] feat(deck): add SectionIntroCard and section-metadata" dashboard/src/lib/section-metadata.ts dashboard/src/components/panels/config-editor/SectionIntroCard.tsx dashboard/src/i18n/zh.json dashboard/src/i18n/en.json
```

---

## Task 2: FieldHelpPopover

**Files:**

- Create: `dashboard/src/components/panels/config-editor/FieldHelpPopover.tsx`

- [ ] **Step 1: Create `FieldHelpPopover.tsx`**

Receives `help?: string` and `docsUrl?: string`. Renders a `?` icon (14px circle, `var(--muted-foreground)`) that on hover shows a Radix `Tooltip` with help text and optional docs link. If `help` is undefined, returns `null`.

Use `Tooltip`/`TooltipTrigger`/`TooltipContent` from `@/components/ui/tooltip`. Trigger uses `<span>` (not `<button>`) to avoid nesting issues per `dashboard/CLAUDE.md`. Use `aria-describedby` for accessibility.

- [ ] **Step 2: Commit**

```bash
scripts/committer "[enhanced] feat(deck): add FieldHelpPopover component" dashboard/src/components/panels/config-editor/FieldHelpPopover.tsx
```

---

## Task 3: ConfigPanel + SchemaForm + SectionNav Enhancement

**Files:**

- Modify: `dashboard/src/components/panels/config-editor/ConfigPanel.tsx`
- Modify: `dashboard/src/components/panels/config-editor/SchemaForm.tsx`
- Modify: `dashboard/src/components/panels/config-editor/SectionNav.tsx`

- [ ] **Step 1: Update ConfigPanel to use SectionIntroCard + applyUiHints**

In `ConfigPanel.tsx`:

1. Import `SectionIntroCard`, `useConfigStore` (for `uiHints`)
2. After `parseSchemaSection()`, call `applyUiHints(fields, uiHints, sectionPrefix)` where `sectionPrefix = activeSection + "."` to match Gateway hint paths
3. Render `<SectionIntroCard sectionKey={activeSection} />` above `<SchemaForm />`
4. Pass `uiHints` to SchemaForm (for FieldHelpPopover rendering)

- [ ] **Step 2: Update SchemaForm to wire advanced field components**

In `SchemaForm.tsx`, extend the `switch (field.type)` to check:

- `field.sensitive` → render `<PasswordField />`
- `field.variants?.length > 0` → render `<UnionField />`
- `field.type === "object" && field.valueSchema` → render `<RecordField />`
- `field.type === "array" && field.itemSchema` → render `<TypedArrayField />`

Add `<FieldHelpPopover help={field.help} />` inside `FieldLabel` component after the field name.

Add default value hint: `{field.defaultValue != null && <span className="..." style={{color:"var(--text-tertiary)"}}>default: {String(field.defaultValue)}</span>}`

Add group-based layout: group fields by `field.group`, render group heading.

Add advanced collapse: fields with `field.tags?.includes("advanced")` go into a collapsible section.

- [ ] **Step 3: Update SectionNav**

In `SectionNav.tsx`:

1. Import `SECTION_META` from `section-metadata.ts`
2. For each section, render icon from meta + field count badge
3. Add "N advanced hidden" indicator at bottom

- [ ] **Step 4: Verify `tsc --noEmit`**

Run: `cd dashboard && pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
scripts/committer "[enhanced] feat(deck): ConfigPanel understanding layer — help popovers, grouping, advanced collapse, field component wiring" dashboard/src/components/panels/config-editor/ConfigPanel.tsx dashboard/src/components/panels/config-editor/SchemaForm.tsx dashboard/src/components/panels/config-editor/SectionNav.tsx
```

---

## Task 4: InheritBadge Shared Component

**Files:**

- Create: `dashboard/src/components/shared/InheritBadge.tsx`

- [ ] **Step 1: Create InheritBadge**

Props: `mode: "inherit" | "override"`, `onReset?: () => void`.

- `inherit` → amber badge `↑ default` with `title` explaining inheritance
- `override` → blue badge `✎ override` with optional `✕` reset button (shown when `onReset` provided)

Uses `var(--warning)` / `var(--warning-muted)` for inherit, `var(--primary)` / `var(--primary-muted)` for override. Reset button uses `var(--destructive)` on hover.

- [ ] **Step 2: Commit**

```bash
scripts/committer "[enhanced] feat(deck): add InheritBadge shared component" dashboard/src/components/shared/InheritBadge.tsx
```

---

## Task 5: ToolProfileSelector Component

**Files:**

- Create: `dashboard/src/components/panels/agents/tabs/ToolProfileSelector.tsx`

- [ ] **Step 1: Create ToolProfileSelector**

Props: `value: string`, `onChange: (profile: string) => void`.

Renders 4 pill buttons: `minimal (1)` | `coding (18)` | `messaging (5)` | `full (30)`. Tool counts hardcoded (from `src/agents/tool-catalog.ts` CORE_TOOL_PROFILES). Active pill uses `var(--primary)` styling.

Below pills: effective tools summary (list of tool names as chips). A link "→ View full policy trace" calls `navigateToAgent(agentId, "context")` from `@/lib/panel-navigation` (note: requires `agentId` in scope, passed as prop from `AgentConfigTab`).

Uses `role="radiogroup"` with `role="radio"` + `aria-checked` per spec accessibility section.

- [ ] **Step 2: Add i18n keys**

Add `agentDetail.config.*` keys for profile names, tool names, and "view policy trace" link text.

- [ ] **Step 3: Commit**

```bash
scripts/committer "[enhanced] feat(deck): add ToolProfileSelector component" dashboard/src/components/panels/agents/tabs/ToolProfileSelector.tsx dashboard/src/i18n/zh.json dashboard/src/i18n/en.json
```

---

## Task 6: Agent Config Tab + Store

**Files:**

- Create: `dashboard/src/components/panels/agents/tabs/AgentConfigTab.tsx`
- Modify: `dashboard/src/components/panels/agents/AgentDetail.tsx`
- Modify: `dashboard/src/lib/panel-navigation.ts`
- Modify: `dashboard/src/stores/deck-agents.ts`

- [ ] **Step 1: Extend deck-agents store**

Add to `useDeckAgentsStore`:

```typescript
agentRawConfig: { defaults: Record<string, unknown>; entry: Record<string, unknown> | null; list: Record<string, unknown>[]; baseHash: string | null } | null;
fetchAgentRawConfig: (agentId: string) => Promise<void>;
saveAgentConfig: (agentId: string, updates: Record<string, unknown>) => Promise<boolean>;
```

`fetchAgentRawConfig`: calls `/api/config` (GET), parses JSON, extracts `agents.defaults`, finds `agents.list[].id === agentId`, stores both + full list + baseHash.

`saveAgentConfig`: reads current `agentRawConfig.list`, finds entry by id, merges `updates` (null values delete keys), writes back via the existing config store's save mechanism. Implementation: parse `useConfigStore.rawConfig` as JSON, mutate the `agents.list` entry, call `useConfigStore.setEditedConfig(JSON.stringify(updated))` then `useConfigStore.saveConfig()` — this reuses the existing `/api/config/apply` endpoint with baseHash conflict detection. Alternatively, can call `/api/config/patch` directly (route exists at `dashboard/src/app/api/config/patch/route.ts`).

- [ ] **Step 2: Create AgentConfigTab**

Receives `agentId: string`. Calls `fetchAgentRawConfig(agentId)` on mount. Renders 2×2 card grid (responsive: 1 column on mobile):

Card 1 (Model & Inference): `model`, `thinkingDefault`, `temperature`, `fastModeDefault`, `reasoningDefault` — each with `InheritBadge`.

Card 2 (Tools Profile): `<ToolProfileSelector />`.

Card 3 (Subagents): `allowAgents` mode selector + agent whitelist chips + model override input.

Card 4 (Delivery): `blockStreaming`, `eventStreams` checkboxes, `typingIndicator` select.

Save bar at bottom: override/inherit count summary + Reset All + Save buttons.

Override detection: `isOverride(field)` checks `agentRawConfig.entry[field] !== undefined`.
Effective value: `entry[field] ?? defaults[field] ?? schemaDefault`.

- [ ] **Step 3: Register tab in AgentDetail + update panel-navigation types**

In `AgentDetail.tsx`:

1. Add `"config"` to `TabValue` union
2. Import `AgentConfigTab`
3. Add `<TabsTrigger value="config">{t("tabs.config")}</TabsTrigger>` after "overview"
4. Add `<TabsContent value="config"><AgentConfigTab agentId={agentId} /></TabsContent>`

In `dashboard/src/lib/panel-navigation.ts`: 5. Add `"config"` to the `AgentTab` type union (line 18): `type AgentTab = "overview" | "config" | "routing" | "skills" | "context" | "subagent" | "sessions"`

- [ ] **Step 4: Add i18n keys**

Add `agentDetail.tabs.config`, `agentDetail.config.*` keys for all card titles, field labels, badge labels, save bar text.

- [ ] **Step 5: Verify `tsc --noEmit`**

Run: `cd dashboard && pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
scripts/committer "[enhanced] feat(deck): add Agent Config Editor tab with inherit/override badges" dashboard/src/components/panels/agents/tabs/AgentConfigTab.tsx dashboard/src/components/panels/agents/AgentDetail.tsx dashboard/src/lib/panel-navigation.ts dashboard/src/stores/deck-agents.ts dashboard/src/i18n/zh.json dashboard/src/i18n/en.json
```

---

## Task 7: ChannelDetail Tabbed Refactoring

**Files:**

- Modify: `dashboard/src/components/panels/channels/ChannelDetail.tsx`
- Modify: `dashboard/src/components/panels/channels/BindingsTab.tsx`

- [ ] **Step 1: Refactor ChannelDetail to tabbed layout**

Wrap existing content in `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`:

- Tab "status": current ChannelDetail content (accounts list, enable/disable, logout)
- Tab "bindings": `<BindingsTab channelId={channelId} />`
- Tab "settings": placeholder `<div>Settings coming soon</div>` (filled in Task 8)

Import `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` from `@/components/ui/tabs`.

- [ ] **Step 2: Add `channelId` prop to BindingsTab**

In `BindingsTab.tsx`, add optional `channelId?: string` prop. When provided:

- Pre-set `selectedChannel` filter to this channelId
- Hide the channel filter dropdown (since context is already scoped)

- [ ] **Step 3: Add i18n keys for tab labels**

Add `channels.tabs.status`, `channels.tabs.bindings`, `channels.tabs.settings` to both locale files.

- [ ] **Step 4: Verify `tsc --noEmit`**

Run: `cd dashboard && pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
scripts/committer "[enhanced] feat(deck): refactor ChannelDetail to tabbed layout with BindingsTab channelId filtering" dashboard/src/components/panels/channels/ChannelDetail.tsx dashboard/src/components/panels/channels/BindingsTab.tsx dashboard/src/i18n/zh.json dashboard/src/i18n/en.json
```

---

## Task 8: Channel Settings Tab (DM Policy + Retry + Schema Fields)

**Files:**

- Create: `dashboard/src/components/panels/channels/ChannelSettingsTab.tsx`
- Create: `dashboard/src/components/panels/channels/DmPolicySelector.tsx`
- Create: `dashboard/src/components/panels/channels/RetryStrategyEditor.tsx`
- Modify: `dashboard/src/components/panels/channels/ChannelDetail.tsx`
- Modify: `dashboard/src/stores/channels.ts`

- [ ] **Step 1: Create DmPolicySelector**

Props: `value: string`, `onChange: (policy: string) => void`.

Renders 4 radio cards for `pairing | allowlist | open | disabled`. Each card: radio indicator + title + description + optional `recommended` badge. Uses `role="radiogroup"` + `role="radio"` + `aria-checked`.

- [ ] **Step 2: Create RetryStrategyEditor**

Props: `attempts: number`, `minDelayMs: number`, `maxDelayMs: number`, `jitter: number`, `onChange: (field: string, value: number) => void`.

Renders 4 input fields. Below: retry timeline visualization — a row of circles and arrows showing the exponential backoff pattern. Computed client-side: `delay(n) = min(minDelayMs * 2^n, maxDelayMs)`. Total time shown at end. `aria-label` with text summary.

- [ ] **Step 3: Extend channels store**

Add `fetchChannelConfig(channelId)` → reads from `useConfigStore.rawConfig`, extracts `channels.{channelId}` section.

Add `saveChannelConfig(channelId, patch)` → calls `/api/config/patch` with `{ channels: { [channelId]: patch } }` + baseHash.

- [ ] **Step 4: Create ChannelSettingsTab**

Receives `channelId: string`. Composes:

1. `<DmPolicySelector />` for `dmPolicy` field
2. `<RetryStrategyEditor />` for `retry.*` fields
3. `<SchemaForm />` for remaining channel-specific fields (schema-driven, filtered)

Save/Reset bar at bottom.

- [ ] **Step 5: Wire into ChannelDetail**

Replace the placeholder from Task 7 with `<ChannelSettingsTab channelId={channelId} />`.

- [ ] **Step 6: Add i18n keys**

Add `channels.settings.*` keys for DM policy labels/descriptions, retry field labels, save bar.

- [ ] **Step 7: Verify `tsc --noEmit`**

Run: `cd dashboard && pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 8: Commit**

```bash
scripts/committer "[enhanced] feat(deck): add Channel Settings tab — DM policy, retry editor, schema-driven fields" dashboard/src/components/panels/channels/ChannelSettingsTab.tsx dashboard/src/components/panels/channels/DmPolicySelector.tsx dashboard/src/components/panels/channels/RetryStrategyEditor.tsx dashboard/src/components/panels/channels/ChannelDetail.tsx dashboard/src/stores/channels.ts dashboard/src/i18n/zh.json dashboard/src/i18n/en.json
```

---

## Task 9: Integration Verification

- [ ] **Step 1: Full type check**

Run: `cd dashboard && pnpm tsc --noEmit`
Expected: 0 errors

- [ ] **Step 2: Lint + format**

Run: `pnpm check` (from repo root)
Fix any formatting issues: `pnpm format:fix`

- [ ] **Step 3: Existing tests pass**

Run: `cd dashboard && pnpm vitest run`
Expected: All existing tests pass (no regressions)

- [ ] **Step 4: Commit any fixups**

```bash
scripts/committer "[enhanced] fix(deck): config UX enhancement lint and type fixes" <affected files>
```

---

## Task Dependencies

```
Task 0 (uiHints foundation)
  ├── Task 1 (SectionIntroCard)
  ├── Task 2 (FieldHelpPopover)
  └── Task 3 (ConfigPanel + SchemaForm + SectionNav) ← depends on 0, 1, 2
      │
Task 4 (InheritBadge) ← independent
Task 5 (ToolProfileSelector) ← independent
      │
Task 6 (Agent Config Tab) ← depends on 4, 5
      │
Task 7 (ChannelDetail tabbed refactoring) ← independent
      │
Task 8 (Channel Settings) ← depends on 7
      │
Task 9 (Integration) ← depends on all
```

**Parallelizable groups:**

- Group A: Tasks 0 → 1, 2 → 3 (ConfigPanel layer, sequential)
- Group B: Tasks 4, 5 → 6 (Agent Config, 4+5 parallel then 6)
- Group C: Tasks 7 → 8 (Channel Settings, sequential)
- Groups A, B, C are **independent** and can run in parallel
- Task 9 runs after all groups complete

**i18n serialization constraint:** `zh.json` and `en.json` are touched by all three groups. To avoid merge conflicts when running in parallel:

- Each group commits i18n keys in its own namespace (e.g., `config.sectionIntro.*`, `agentDetail.config.*`, `channels.settings.*`) — these are in different sections of the JSON
- If using Agent Team with worktrees, each group adds keys to its own namespace section only; the final merge resolves positionally (no overlapping keys)
- If merge conflicts still occur, Task 9 (integration) resolves them as a fixup step
