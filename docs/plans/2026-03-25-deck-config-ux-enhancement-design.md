# Deck Config UX Enhancement — Design Spec

**Date:** 2026-03-25
**Status:** Approved
**Scope:** ConfigPanel understanding layer + Agent Config Editor + Channel post-setup config

---

## 1. Problem Statement

OpenClaw manages all system behavior through a single JSON5 config file (`~/.openclaw/openclaw.json`) with 1,200+ fields. The Deck Web Dashboard provides a generic schema→form editor (ConfigPanel) and several specialized panels, but:

1. **Understanding gap** — ConfigPanel mechanically maps schema to form controls without context. No section overviews, no field-level guidance, no default value visibility. Even experienced operators struggle to discover and understand all available configurations.
2. **Agent core fields uneditable** — AgentsPanel has 6+ tabs (Routing, Skills, Subagent, EventStreams, ToolPolicy, Bootstrap) but the most fundamental agent fields (model, thinkingDefault, temperature, tools.profile) have no edit UI.
3. **Channel post-setup gap** — ChannelsPanel has setup wizards (Feishu, WeCom) and enable/disable toggles, but no UI for modifying DM policy, retry strategy, or advanced settings after initial setup.

### Target Users

All levels: developers/ops (need discoverability across 1,200+ fields), team admins (need guided editing), non-technical users (need explanation of what configs mean and why to change them).

### Non-Goals

- Runtime state visualization (explicitly excluded per user decision)
- Tool policy interactive editor (ToolPolicyViz read-only is sufficient; editing via ConfigPanel)
- Routing/Scheduler/Budget/Alerts/Approvals enhancement (already adequate)
- Model Provider panel (already has 24 components across 4 tabs)

---

## 2. Data Sources (No Backend Changes)

All data needed is already available via existing Gateway RPC methods:

| RPC Method           | Returns                                                                    | Used For                                        |
| -------------------- | -------------------------------------------------------------------------- | ----------------------------------------------- |
| `config.schema`      | JSON Schema + `uiHints` (label, help, tags, group, placeholder, sensitive) | Field descriptions, grouping, advanced tagging  |
| `config.get`         | Current config + baseHash                                                  | Reading values, detecting overrides vs defaults |
| `config.patch`       | Write result + new baseHash                                                | Saving changes                                  |
| `deck.agents.detail` | Agent effective config (merged defaults + overrides)                       | Agent Config Editor                             |

**uiHints coverage:** 825 field paths with high-quality, action-oriented descriptions (e.g., "Enable image understanding so attached or referenced images can be interpreted into textual context. Disable if you need text-only operation or want to avoid image-processing cost."). 26 predefined groups. Tags include `advanced`, `sensitive`, `access`.

---

## 3. Design: ConfigPanel Understanding Layer (P0)

### 3.1 Section Intro Card

Each top-level config section displays an intro card at the top with:

- **Title** — human-readable section name (e.g., "Agents — Agent Runtime Configuration")
- **Description** — 1-2 sentence overview of what this section controls and why you'd edit it
- **Docs link** — deep link to `docs.openclaw.ai` corresponding page

**Content source:** Dashboard-side static mapping in `section-metadata.ts` (~15 entries). Not schema-driven because section intros need editorial voice that schema descriptions don't provide.

```typescript
// section-metadata.ts
export const SECTION_META: Record<
  string,
  {
    titleKey: string; // i18n key
    descriptionKey: string; // i18n key
    docsUrl: string; // docs.openclaw.ai URL
    icon: string; // lucide icon name
  }
> = {
  agents: {
    titleKey: "config.sectionIntro.agents.title",
    descriptionKey: "config.sectionIntro.agents.description",
    docsUrl: "https://docs.openclaw.ai/configuration#agents",
    icon: "Bot",
  },
  tools: {
    /* ... */
  },
  gateway: {
    /* ... */
  },
  // ~15 sections total
};
```

### 3.2 Field Help Popover

Each field label displays a `?` icon. On hover, a popover shows:

- **Help text** — from `uiHints[path].help` (825 fields already covered)
- **Docs link** — if the section has a docs URL, link to it

**Component:** `FieldHelpPopover.tsx` — receives `help?: string` and `docsUrl?: string`.

**Fallback:** Fields without uiHints.help show no `?` icon (graceful degradation).

### 3.3 Default Value Hint

Below each field label, display `default: {value}` in muted text when `schema.default` is defined. Users immediately know what happens if they leave the field empty.

### 3.4 Group-based Layout

Replace the current flat field list with grouped sections using `uiHints[path].group`:

- Fields with the same group render under a shared heading
- Ungrouped fields render in a "General" catch-all group
- Groups ordered by `uiHints[path].order` when available

### 3.5 Advanced Field Collapse

Fields tagged with `advanced` in `uiHints[path].tags` are collapsed by default:

- A toggle "▸ Advanced settings — N fields" expands/collapses the section
- SectionNav sidebar shows "N advanced hidden" hint
- Users who need advanced settings can opt-in; others aren't overwhelmed

### 3.6 SchemaForm Integration of Existing Field Components

The main `SchemaForm` switch currently handles 6 basic types. Already-built components need integration:

| Component         | Trigger Condition                              | Currently Used? |
| ----------------- | ---------------------------------------------- | --------------- |
| `PasswordField`   | `field.sensitive === true`                     | ❌ Not wired    |
| `RecordField`     | `field.type === "object" && field.valueSchema` | ❌ Not wired    |
| `UnionField`      | `field.variants?.length > 0`                   | ❌ Not wired    |
| `TypedArrayField` | `field.type === "array" && field.itemSchema`   | ❌ Not wired    |
| `FieldValidation` | `field.validation` constraints exist           | ❌ Not wired    |

**Change:** Extend `SchemaForm`'s switch to route to these components when their trigger conditions are met. Also extend `schema-parser.ts` `parseProperty()` to populate `sensitive`, `variants`, `valueSchema`, `itemSchema`, `validation` fields from uiHints and JSON Schema.

### 3.7 SectionNav Enhancement

Current `SectionNav` shows plain key names. Enhanced version:

- Icon per section (from `section-metadata.ts`)
- Field count badge (number of configurable fields in section)
- "N advanced hidden" indicator at bottom

### 3.8 Prerequisite: Config Store uiHints Persistence

The current `config.ts` store discards `uiHints` from the `config.schema` RPC response — it only stores the raw JSON Schema in `schema`. The dashboard-side `UiHint` type in `ui-hints.ts` only defines 3 properties (`sensitive`, `collapsed`, `placeholder`), but the Gateway returns 9 properties including `help`, `label`, `tags`, `group`, `order`, `advanced`.

**Required changes:**
1. Extend `UiHint` interface in `ui-hints.ts` to match Gateway's `ConfigUiHint`: add `help`, `label`, `tags`, `group`, `order`, `advanced`
2. Extend `config.ts` store: persist `uiHints` map alongside `schema` from `fetchSchema()` response
3. Pass `uiHints` from `ConfigPanel` to `SchemaForm` so field decorators (`sensitive`, `group`, `tags`) are available
4. Call `applyUiHints()` after `parseSchemaSection()` in ConfigPanel to decorate parsed fields with uiHints data

### Files Changed

| File                           | Change                                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `config.ts` (store)           | Persist `uiHints` from `config.schema` RPC; expose via `useConfigStore`                               |
| `ui-hints.ts`                  | Extend `UiHint` interface with `help`, `label`, `tags`, `group`, `order`, `advanced`                  |
| `ConfigPanel.tsx`              | Import SectionIntroCard, call `applyUiHints()`, pass uiHints to SchemaForm                            |
| `SchemaForm.tsx`               | Extended switch for Password/Record/Union/TypedArray/Validation; group-based layout; advanced collapse |
| `SectionNav.tsx`               | Icons, field counts, advanced hint                                                                     |
| `schema-parser.ts`             | Parse sensitive/variants/valueSchema/itemSchema/validation/group/tags from schema+uiHints              |
| **New** `SectionIntroCard.tsx` | Section overview card component                                                                        |
| **New** `FieldHelpPopover.tsx` | Help popover component                                                                                 |
| **New** `section-metadata.ts`  | Static section → intro/docs mapping                                                                    |
| `zh.json` / `en.json`          | Section intro i18n keys (~30 new entries)                                                              |

---

## 4. Design: Agent Config Editor (P0)

### 4.1 New "Config" Tab in AgentsPanel

A new tab added to AgentsPanel's tab bar, positioned after "Overview". Displays agent-level configuration in a 2×2 card grid.

### 4.2 Card Layout

| Card                     | Fields                                                                 | Notes                                                 |
| ------------------------ | ---------------------------------------------------------------------- | ----------------------------------------------------- |
| **Model & Inference**    | model, thinkingDefault, temperature, fastModeDefault, reasoningDefault | Core inference parameters                             |
| **Tools Profile**        | tools.profile (pill selector), effective tools summary                 | Shows tool count per profile; links to ToolPolicyViz  |
| **Subagents**            | allowAgents mode, agent whitelist, model override                      | Reuses existing SubagentTab data; presented inline    |
| **Delivery & Streaming** | blockStreaming, eventStreams, typingIndicator                          | eventStreams reuses ChannelEventStreamSection pattern |

### 4.3 Inherit / Override Badge System

Each field displays one of:

- **`↑ default`** (amber badge) — value inherited from `agents.defaults.*`
- **`✎ override`** (blue badge) — value explicitly set in `agents.list[N].*`

**Detection logic (pseudocode):**

```typescript
// 1. Fetch raw config via config.get
const rawConfig = JSON.parse(configStore.rawConfig);
const defaults = rawConfig.agents?.defaults ?? {};

// 2. Find the agent entry by ID (agents.list is an array of objects with `id` field)
const agentEntry = (rawConfig.agents?.list ?? []).find(
  (a: { id: string }) => a.id === agentId
);

// 3. For each editable field, determine inherit vs override
function isOverride(fieldPath: string): boolean {
  // Walk the dot-path into agentEntry
  // e.g., "thinkingDefault" → agentEntry?.thinkingDefault
  // e.g., "tools.profile" → agentEntry?.tools?.profile
  return getNestedValue(agentEntry, fieldPath) !== undefined;
}

// 4. Effective value = agentEntry[field] ?? defaults[field] ?? schema.default
function effectiveValue(fieldPath: string): unknown {
  return getNestedValue(agentEntry, fieldPath)
    ?? getNestedValue(defaults, fieldPath)
    ?? schemaDefault(fieldPath);
}
```

**Reset to default:** Override fields show a `✕` button. Clicking removes the field from `agents.list[N]` via `config.patch` (setting the field to `undefined` / deleting the key), reverting to global default.

### 4.4 Tools Profile Selector

Visual pill buttons instead of a select dropdown:

- `minimal (1)` | `coding (18)` | `messaging (5)` | `full (30)`
- Each pill shows the number of tools in that profile
- Selecting a profile updates the effective tools summary below
- "→ View full policy trace" link navigates to the ToolPolicyViz tab

**Tool counts source:** Static from `tool-catalog.ts` profile definitions (hardcoded in platform, stable).

### 4.5 Save Bar

Bottom bar displays:

- Summary: "N overrides, M inherited from defaults"
- "Reset all" button — removes all agent-level overrides
- "Save" button — writes via `config.patch`

### Data Flow

```
Read:  deck.agents.detail → effective config
       config.get         → raw config (to detect overrides)
Write: config.patch       → agents.list[N].{field}
Reset: config.patch       → delete agents.list[N].{field}
```

### Files Changed

| File                              | Change                                                                |
| --------------------------------- | --------------------------------------------------------------------- |
| `AgentsPanel.tsx`                 | Register new "Config" tab                                             |
| **New** `AgentConfigTab.tsx`      | Main config tab component (4-card grid)                               |
| **New** `InheritBadge.tsx`        | Reusable inherit/override badge                                       |
| **New** `ToolProfileSelector.tsx` | Visual profile pill selector                                          |
| `deck-agents` store               | Add `fetchAgentRawConfig()`, `saveAgentConfig()`, `resetAgentField()` |
| `zh.json` / `en.json`             | ~40 new i18n keys                                                     |

---

## 5. Design: Channel Post-Setup Config (P1)

### 5.1 Prerequisite: ChannelDetail Tabbed Refactoring

The current `ChannelDetail.tsx` is a flat layout (accounts list + logout section) with no tab structure. Before adding a "Settings" tab, ChannelDetail must be refactored into a tabbed layout:

- **Tab 1: "Status"** — current content (accounts list, enable/disable, connection status, logout)
- **Tab 2: "Bindings"** — existing BindingsTab component (already exists separately)
- **Tab 3: "Throughput"** — existing ThroughputChart component
- **Tab 4: "Settings"** — new settings tab (this design)

This refactoring uses the same `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` pattern as AgentsPanel and MonitorPanel. The existing ChannelDetail content moves into the "Status" tab with minimal changes.

### 5.2 Settings Tab Content

Displays per-channel configuration grouped into 3 sections.

### 5.3 DM Policy Selector

Radio card UI (not a select dropdown) with 3 options:

- **pairing** — "Users must pair with a code before chatting." + `recommended` badge
- **open** — "Anyone can DM the bot. Requires allowFrom: ['*']."
- **closed** — "Bot ignores all DMs."

Each card has a title, one-sentence explanation, and optional badge. This directly addresses the understanding gap — users don't need to know what "pairing" means in OpenClaw's context because the card explains it.

### 5.4 Retry Strategy Editor

Form fields for: `maxRetries`, `baseDelayMs`, `jitter`.

Below the fields, a **retry timeline visualization** renders in real-time as values change:

```
[1] → 1.0s → [R1] → 2.0s → [R2] → 4.0s → [R3]  total ≈ 7s
```

Circles represent attempts, arrows show delays (exponential backoff × jitter). Total elapsed time displayed at the end. This gives non-technical users an intuitive sense of what "3 retries with 1s base delay" means.

**Visualization logic:** Pure client-side calculation: `delay(n) = baseDelayMs × 2^n × (1 ± jitter)`. Since jitter is random, the visualization shows the expected (mid-range) case with a parenthetical note "(±jitter)". An `aria-label` on the visualization container provides a text description for screen readers (e.g., "3 retries with exponential backoff, total estimated 7 seconds").

### 5.5 Advanced Fields (Schema-driven)

Beyond DM policy and retry, each channel has unique fields (Telegram: `ipv4First`, Discord: `helloTimeout`, etc.). These render dynamically from the channel's JSON Schema section using SchemaForm, ensuring upstream additions appear automatically.

### 5.6 Per-Channel Schema Adaptation

Different channels have different schemas. The Settings tab:

1. Reads `config.schema` to get the full schema
2. Extracts `schema.properties.channels.properties.{channelId}` sub-schema
3. Filters out fields already handled by dedicated UI (DM policy, retry)
4. Passes remaining fields to SchemaForm for dynamic rendering

### Data Flow

```
Read:  config.get    → channels.{channelId} section
       config.schema → channel-specific schema
Write: config.patch  → channels.{channelId}.{field}
```

### Files Changed

| File                              | Change                                            |
| --------------------------------- | ------------------------------------------------- |
| `ChannelDetail.tsx`               | Refactor to tabbed layout + register "Settings" tab |
| **New** `ChannelSettingsTab.tsx`  | Main settings tab                                 |
| **New** `DmPolicySelector.tsx`    | Radio card policy selector                        |
| **New** `RetryStrategyEditor.tsx` | Retry fields + timeline visualization             |
| `channels` store                  | Add `fetchChannelConfig()`, `saveChannelConfig()` |
| `zh.json` / `en.json`             | ~25 new i18n keys                                 |

---

## 6. Cross-Cutting Concerns

### i18n

All user-visible text through `useTranslations()`. New keys in both `zh.json` and `en.json`:

- Section intros: ~30 keys
- Agent config tab: ~40 keys
- Channel settings tab: ~25 keys
- Shared (badges, buttons): ~10 keys

### Theme Compliance

All components use shadcn standard tokens + extended tokens per `dashboard/CLAUDE.md`. No hardcoded colors.

### Optimistic Concurrency

All write operations carry `baseHash` from the last `config.get` read. On conflict, the existing `ConflictDialog` handles reload.

### Gateway Restart

`config.patch` automatically triggers Gateway SIGUSR1 restart. The existing restart notification flow handles this — no new mechanism needed.

### Accessibility

- `FieldHelpPopover`: uses `aria-describedby` linking popover content to the field input
- `DmPolicySelector`: renders as `role="radiogroup"` with `role="radio"` items and `aria-checked`
- `ToolProfileSelector`: renders as `role="radiogroup"` with keyboard navigation
- `RetryStrategyEditor` visualization: `aria-label` with descriptive text summary
- `InheritBadge`: `title` attribute explains inherit/override semantics on hover

### Upstream Compatibility

- ConfigPanel's schema-driven approach means new upstream config fields appear automatically in the generic editor
- Agent Config Editor's card layout covers the most stable core fields; new agent fields fall through to ConfigPanel
- Channel Settings Tab's schema-driven advanced section auto-renders new channel fields

---

## 7. Summary: Deliverables

| #         | Deliverable                     | Priority | Type    | New Files | Modified Files  |
| --------- | ------------------------------- | -------- | ------- | --------- | --------------- |
| 1         | ConfigPanel understanding layer | P0       | Enhance | 3         | 7               |
| 2         | Agent Config Editor tab         | P0       | New tab | 3         | 3               |
| 3         | Channel Settings tab            | P1       | New tab | 3         | 3               |
| **Total** |                                 |          |         | **9 new** | **13 modified** |

No backend / Gateway changes required. All data available via existing RPC methods.
