# Config Editor Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the Config Editor panel with advanced search (tag: prefix, multi-field matching, result highlighting), tag filter chips, and field-level conflict resolution with per-field merge.

**Architecture:** Three independent capabilities that compose in ConfigPanel: (1) a search/filter layer sitting between schema-derived fields and SchemaForm, powered by a `parseConfigSearch()` utility + `SearchHighlight` component; (2) a tag index built from schema+uiHints feeding a TagFilterPanel chip bar; (3) an enhanced ConflictDialog that reuses existing `computeConfigDiff()` infrastructure for field-level diff display with per-field merge selection.

**Tech Stack:** React 18, next-intl, Zustand, existing `schema-parser.ts`/`ui-hints.ts`/`config-diff.ts` infrastructure

**Skill dependencies:** `[frontend]` — dashboard CLAUDE.md design system tokens, i18n zero-hardcoded-strings rule

---

## File Structure

| File                                                                | Role                                                                         | Action |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------ |
| `dashboard/src/lib/config-search.ts`                                | Search parser + multi-field matcher + tag index builder                      | Create |
| `dashboard/src/components/panels/config-editor/SearchHighlight.tsx` | `<mark>` text highlight utility component                                    | Create |
| `dashboard/src/components/panels/config-editor/TagFilterPanel.tsx`  | Horizontal tag chip filter bar                                               | Create |
| `dashboard/src/components/panels/config-editor/ConfigPanel.tsx`     | Add search bar, tag filter, field filtering, highlight prop threading        | Modify |
| `dashboard/src/components/panels/config-editor/SchemaForm.tsx`      | Accept + thread `searchQuery` prop for highlight                             | Modify |
| `dashboard/src/components/panels/config-editor/ConflictDialog.tsx`  | Full rewrite: field-level diff table with per-field merge selection          | Modify |
| `dashboard/src/stores/config.ts`                                    | Add `remoteConfig` state for conflict resolution, expose `resolveConflict()` | Modify |
| `dashboard/src/i18n/zh.json`                                        | Add ~20 new keys in `config` namespace                                       | Modify |
| `dashboard/src/i18n/en.json`                                        | Add ~20 new keys in `config` namespace                                       | Modify |

---

### Task 1: Search Parser Utility [frontend]

covers: config-advanced-search/spec.md > ADDED > Search supports tag: prefix syntax > Filter by sensitive tag
covers: config-advanced-search/spec.md > ADDED > Search supports tag: prefix syntax > Combined tag and text search
covers: config-advanced-search/spec.md > ADDED > Search matches multiple field attributes > Match by path
covers: config-advanced-search/spec.md > ADDED > Search matches multiple field attributes > Match by enum value
covers: config-advanced-search/spec.md > ADDED > Search matches multiple field attributes > Case insensitive match

**Files:**

- Create: `dashboard/src/lib/config-search.ts`

- [ ] **Step 1: Create `parseConfigSearch` function**

Create `dashboard/src/lib/config-search.ts`:

```typescript
/**
 * Config search parser and matcher.
 *
 * Supports `tag:xxx` prefix syntax and multi-field text matching
 * against label, help, description, path, and enum values.
 */

import type { FormField } from "./schema-parser";
import type { UiHintsMap } from "./ui-hints";

export interface ParsedSearch {
  tags: string[];
  text: string;
}

/**
 * Parse a search query string into structured parts.
 *
 * Extracts all `tag:xxx` prefixes and combines remaining text.
 * Example: "tag:sensitive token" → { tags: ["sensitive"], text: "token" }
 */
export function parseConfigSearch(query: string): ParsedSearch {
  const tags: string[] = [];
  const textParts: string[] = [];

  for (const token of query.trim().split(/\s+/)) {
    if (!token) continue;
    const tagMatch = /^tag:(.+)$/i.exec(token);
    if (tagMatch) {
      tags.push(tagMatch[1].toLowerCase());
    } else {
      textParts.push(token);
    }
  }

  return { tags, text: textParts.join(" ") };
}

/**
 * Test whether a single FormField matches the parsed search criteria.
 *
 * Matching rules:
 * - tags: field.tags must include ALL specified tags (AND)
 * - text: case-insensitive match against label, key (path), description, help, or enum options (OR)
 * - When both present: tags AND text must match
 *
 * @param field - The form field to test
 * @param search - Parsed search criteria
 * @param prefix - Dotted path prefix for this field (e.g. "agents." for nested fields)
 */
export function matchesSearch(field: FormField, search: ParsedSearch, prefix = ""): boolean {
  // Empty search matches everything
  if (search.tags.length === 0 && !search.text) return true;

  // Tag check: field.tags must include ALL specified tags
  if (search.tags.length > 0) {
    const fieldTags = (field.tags ?? []).map((t) => t.toLowerCase());
    const allTagsMatch = search.tags.every((t) => fieldTags.includes(t));
    if (!allTagsMatch) return false;
  }

  // Text check: case-insensitive match against multiple attributes
  if (search.text) {
    const q = search.text.toLowerCase();
    const fullPath = `${prefix}${field.key}`;

    const haystack = [
      field.label,
      field.key,
      fullPath,
      field.description,
      field.help,
      ...(field.options ?? []),
    ];

    const textMatches = haystack.some((s) => typeof s === "string" && s.toLowerCase().includes(q));
    if (!textMatches) return false;
  }

  return true;
}

/**
 * Filter a FormField[] tree, keeping fields that match search criteria.
 * For object fields with children, recursively filters children and keeps
 * the parent if any child matches.
 */
export function filterFields(fields: FormField[], search: ParsedSearch, prefix = ""): FormField[] {
  if (search.tags.length === 0 && !search.text) return fields;

  const result: FormField[] = [];

  for (const field of fields) {
    // Check if field itself matches
    if (matchesSearch(field, search, prefix)) {
      result.push(field);
      continue;
    }

    // For object fields, check children recursively
    if (field.children && field.children.length > 0) {
      const filteredChildren = filterFields(field.children, search, `${prefix}${field.key}.`);
      if (filteredChildren.length > 0) {
        result.push({ ...field, children: filteredChildren });
      }
    }
  }

  return result;
}

/** Entry in a tag index: tag name → count of fields with that tag */
export interface TagEntry {
  tag: string;
  count: number;
}

/**
 * Build a tag index from all fields across all schema sections.
 * Collects unique tags from FormField.tags (set by schema x-tags and uiHints).
 */
export function buildTagIndex(allFields: FormField[]): TagEntry[] {
  const tagCounts = new Map<string, number>();

  function walk(fields: FormField[]) {
    for (const field of fields) {
      if (field.tags) {
        for (const tag of field.tags) {
          const lower = tag.toLowerCase();
          tagCounts.set(lower, (tagCounts.get(lower) ?? 0) + 1);
        }
      }
      if (field.children) walk(field.children);
    }
  }

  walk(allFields);

  return Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => a.tag.localeCompare(b.tag));
}
```

- [ ] **Step 2: Verify no type errors**

Run: `cd dashboard && pnpm tsc --noEmit 2>&1 | grep config-search || echo "clean"`
Expected: "clean" (no errors referencing the new file)

- [ ] **Step 3: Commit**

```bash
scripts/committer "[enhanced] feat(config): add search parser and multi-field matcher utility" dashboard/src/lib/config-search.ts
```

---

### Task 2: SearchHighlight Component [frontend]

covers: config-advanced-search/spec.md > ADDED > Search results highlight matched text > Highlight in label
covers: config-advanced-search/spec.md > ADDED > Search results highlight matched text > No highlight when no search

**Files:**

- Create: `dashboard/src/components/panels/config-editor/SearchHighlight.tsx`

- [ ] **Step 1: Create SearchHighlight component**

Create `dashboard/src/components/panels/config-editor/SearchHighlight.tsx`:

```tsx
"use client";

import { useMemo } from "react";

interface SearchHighlightProps {
  text: string;
  query: string;
}

/**
 * Highlight search query matches within text using <mark> tags.
 *
 * When query is empty, renders plain text with no <mark> tags.
 * Uses `var(--primary-muted)` background per design spec.
 */
export function SearchHighlight({ text, query }: SearchHighlightProps) {
  const parts = useMemo(() => {
    if (!query) return null;

    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "gi");
    return text.split(regex);
  }, [text, query]);

  if (!parts) return <>{text}</>;

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark
            key={i}
            style={{
              backgroundColor: "var(--primary-muted)",
              color: "inherit",
              borderRadius: "2px",
              padding: "0 1px",
            }}
          >
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
```

- [ ] **Step 2: Verify no type errors**

Run: `cd dashboard && pnpm tsc --noEmit 2>&1 | grep SearchHighlight || echo "clean"`
Expected: "clean"

- [ ] **Step 3: Commit**

```bash
scripts/committer "[enhanced] feat(config): add SearchHighlight component for search result highlighting" dashboard/src/components/panels/config-editor/SearchHighlight.tsx
```

---

### Task 3: TagFilterPanel Component [frontend]

covers: config-tag-filter/spec.md > ADDED > Tag filter panel displays available tags > Display tag chips
covers: config-tag-filter/spec.md > ADDED > Tag filter panel displays available tags > Click tag to filter
covers: config-tag-filter/spec.md > ADDED > Tag filter panel displays available tags > Deselect tag
covers: config-tag-filter/spec.md > ADDED > Tag filter panel displays available tags > No tags available

**Files:**

- Create: `dashboard/src/components/panels/config-editor/TagFilterPanel.tsx`

- [ ] **Step 1: Create TagFilterPanel component**

Create `dashboard/src/components/panels/config-editor/TagFilterPanel.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";
import type { TagEntry } from "@/lib/config-search";

interface TagFilterPanelProps {
  tags: TagEntry[];
  activeTags: string[];
  onToggleTag: (tag: string) => void;
}

/**
 * Horizontal chip bar showing available config field tags.
 *
 * Each chip displays the tag name and count of fields with that tag.
 * Clicking a chip toggles the tag filter (equivalent to adding/removing
 * `tag:xxx` from the search bar).
 *
 * Renders nothing when no tags are available.
 */
export function TagFilterPanel({ tags, activeTags, onToggleTag }: TagFilterPanelProps) {
  const t = useTranslations("config");

  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-4 py-1.5">
      <span className="text-[10px] shrink-0" style={{ color: "var(--muted-foreground)" }}>
        {t("filterByTag")}
      </span>
      {tags.map(({ tag, count }) => {
        const isActive = activeTags.includes(tag);
        return (
          <button
            key={tag}
            onClick={() => onToggleTag(tag)}
            className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full transition-colors"
            style={{
              backgroundColor: isActive ? "var(--primary)" : "var(--muted)",
              color: isActive ? "var(--primary-foreground)" : "var(--muted-foreground)",
              border: isActive ? "1px solid var(--primary)" : "1px solid var(--border)",
            }}
          >
            {tag}
            <span
              className="text-[10px]"
              style={{
                opacity: 0.7,
              }}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify no type errors**

Run: `cd dashboard && pnpm tsc --noEmit 2>&1 | grep TagFilterPanel || echo "clean"`
Expected: "clean"

- [ ] **Step 3: Commit**

```bash
scripts/committer "[enhanced] feat(config): add TagFilterPanel chip bar for tag-based filtering" dashboard/src/components/panels/config-editor/TagFilterPanel.tsx
```

---

### Task 4: Integrate Search + Tags + Highlight into ConfigPanel [frontend]

covers: config-advanced-search/spec.md > ADDED > Search displays syntax hint > Show syntax hint
covers: config-advanced-search/spec.md > ADDED > Search supports tag: prefix syntax > Filter by sensitive tag
covers: config-advanced-search/spec.md > ADDED > Search supports tag: prefix syntax > Combined tag and text search
covers: config-advanced-search/spec.md > ADDED > Search matches multiple field attributes > Match by path
covers: config-advanced-search/spec.md > ADDED > Search matches multiple field attributes > Match by enum value
covers: config-advanced-search/spec.md > ADDED > Search matches multiple field attributes > Case insensitive match
covers: config-advanced-search/spec.md > ADDED > Search results highlight matched text > Highlight in label
covers: config-advanced-search/spec.md > ADDED > Search results highlight matched text > No highlight when no search
covers: config-tag-filter/spec.md > ADDED > Tag filter panel displays available tags > Display tag chips
covers: config-tag-filter/spec.md > ADDED > Tag filter panel displays available tags > Click tag to filter
covers: config-tag-filter/spec.md > ADDED > Tag filter panel displays available tags > Deselect tag
covers: config-tag-filter/spec.md > ADDED > Tag filter panel displays available tags > No tags available

**Files:**

- Modify: `dashboard/src/components/panels/config-editor/ConfigPanel.tsx`
- Modify: `dashboard/src/components/panels/config-editor/SchemaForm.tsx`

- [ ] **Step 1: Add search state and tag index to ConfigPanel**

In `dashboard/src/components/panels/config-editor/ConfigPanel.tsx`:

Add imports at the top:

```tsx
import { Search, X } from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import { parseConfigSearch, filterFields, buildTagIndex } from "@/lib/config-search";
import { parseSchemaSection } from "@/lib/schema-parser";
import { applyUiHints } from "@/lib/ui-hints";
import { TagFilterPanel } from "./TagFilterPanel";
```

Add search state inside ConfigPanel function body (after the existing `const { schema, ... } = useConfigStore()` block):

```tsx
const [searchQuery, setSearchQuery] = useState("");
```

Add the tag index computation — this must build tags from ALL sections' fields:

```tsx
// Build tag index from all fields across all sections
const allSectionFields = useMemo(() => {
  if (!schema) return [];
  const props = schema.properties as Record<string, Record<string, unknown>> | undefined;
  if (!props) return [];

  const all: FormField[] = [];
  for (const sectionKey of Object.keys(props)) {
    const sectionSchema = props[sectionKey];
    if (!sectionSchema || typeof sectionSchema !== "object") continue;
    let fields = parseSchemaSection(sectionSchema);
    if (uiHints) {
      fields = applyUiHints(fields, uiHints, `${sectionKey}.`);
    }
    all.push(...fields);
  }
  return all;
}, [schema, uiHints]);

const tagIndex = useMemo(() => buildTagIndex(allSectionFields), [allSectionFields]);
```

Add parsed search and tag toggle:

```tsx
const parsedSearch = useMemo(() => parseConfigSearch(searchQuery), [searchQuery]);

const handleToggleTag = useCallback((tag: string) => {
  setSearchQuery((prev) => {
    const parsed = parseConfigSearch(prev);
    const tagToken = `tag:${tag}`;
    if (parsed.tags.includes(tag)) {
      // Remove tag from query
      return prev
        .split(/\s+/)
        .filter((t) => t.toLowerCase() !== tagToken.toLowerCase())
        .join(" ")
        .trim();
    }
    // Add tag to query
    return prev ? `${prev} ${tagToken}` : tagToken;
  });
}, []);
```

Add filtered fields computation — replace the existing `currentFields` useMemo with a version that applies search filtering:

```tsx
// Get fields for current section from schema, apply uiHints, then apply search filter
const currentFields = useMemo(() => {
  if (!schema || !activeSection) return [];
  const props = schema.properties as Record<string, Record<string, unknown>> | undefined;
  if (!props) return [];
  const parts = activeSection.split(".");
  let node: Record<string, unknown> | undefined = props[parts[0]];
  for (let i = 1; i < parts.length && node; i++) {
    const nested = node.properties as Record<string, Record<string, unknown>> | undefined;
    node = nested?.[parts[i]];
  }
  if (!node || typeof node !== "object") return [];
  let fields = parseSchemaSection(node);
  if (uiHints) {
    fields = applyUiHints(fields, uiHints, `${activeSection}.`);
  }
  return filterFields(fields, parsedSearch, `${activeSection}.`);
}, [schema, activeSection, uiHints, parsedSearch]);
```

Note: the existing `currentFields` useMemo at line ~87-110 of ConfigPanel.tsx is **replaced** by this new version that adds `parsedSearch` filtering at the end.

- [ ] **Step 2: Add search bar UI to ConfigPanel toolbar**

In the toolbar `<div>` (the one with `className="flex items-center justify-between px-4 py-2 border-b"`), add a search input between the title section and the button section. Replace the entire toolbar block:

```tsx
{
  /* Toolbar */
}
<div
  className="flex items-center justify-between px-4 py-2 border-b"
  style={{ borderColor: "var(--border)", backgroundColor: "var(--card)" }}
>
  <div className="flex items-center gap-2">
    <h2 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
      {t("title")}
    </h2>
    {isDirty && (
      <span
        className="text-[10px] px-1.5 py-0.5 rounded-full"
        style={{
          backgroundColor: "color-mix(in srgb, var(--primary) 15%, transparent)",
          color: "var(--primary)",
        }}
      >
        {t("unsavedChanges")}
      </span>
    )}
    {error && (
      <span
        className="text-[10px] px-1.5 py-0.5 rounded-full"
        style={{
          backgroundColor: "color-mix(in srgb, var(--status-disconnected) 15%, transparent)",
          color: "var(--status-disconnected)",
        }}
      >
        {error}
      </span>
    )}
  </div>

  {/* Search bar */}
  <div className="flex-1 max-w-xs mx-4 relative">
    <Search
      size={13}
      className="absolute left-2 top-1/2 -translate-y-1/2"
      style={{ color: "var(--muted-foreground)" }}
    />
    <input
      type="text"
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      placeholder={t("searchPlaceholder")}
      className="w-full text-xs rounded pl-7 pr-7 py-1.5"
      style={{
        backgroundColor: "var(--background)",
        color: "var(--foreground)",
        border: "1px solid var(--border)",
      }}
    />
    {searchQuery && (
      <button
        onClick={() => setSearchQuery("")}
        className="absolute right-2 top-1/2 -translate-y-1/2"
        style={{ color: "var(--muted-foreground)" }}
      >
        <X size={13} />
      </button>
    )}
  </div>

  <div className="flex items-center gap-2">
    <button
      onClick={handleReload}
      disabled={loading}
      className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:opacity-80 transition-opacity disabled:opacity-40"
      style={{
        border: "1px solid var(--border)",
        color: "var(--foreground)",
        backgroundColor: "var(--background)",
      }}
    >
      <RefreshCw size={12} />
      {t("reload")}
    </button>
    <button
      onClick={handleSave}
      disabled={!isDirty || saving}
      className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:opacity-80 transition-opacity disabled:opacity-40"
      style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
    >
      <Save size={12} />
      {saving ? t("saving") : t("save")}
    </button>
  </div>
</div>;
```

- [ ] **Step 3: Add TagFilterPanel below toolbar**

Between the toolbar and the `<div className="flex flex-1 min-h-0">` content area, insert the TagFilterPanel:

```tsx
{
  /* Tag filter chips */
}
<TagFilterPanel tags={tagIndex} activeTags={parsedSearch.tags} onToggleTag={handleToggleTag} />;
```

- [ ] **Step 4: Thread searchQuery through SchemaForm for highlighting**

Pass `searchQuery={parsedSearch.text}` to the `<SchemaForm>` invocation in the content area:

```tsx
<SchemaForm
  fields={currentFields}
  values={sectionValues}
  onChange={handleFieldChange}
  searchQuery={parsedSearch.text}
/>
```

- [ ] **Step 5: Update SchemaForm to accept and use searchQuery**

In `dashboard/src/components/panels/config-editor/SchemaForm.tsx`:

Add import:

```tsx
import { SearchHighlight } from "./SearchHighlight";
```

Add `searchQuery` to `SchemaFormProps`:

```tsx
interface SchemaFormProps {
  fields: FormField[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  prefix?: string;
  hints?: Record<string, FieldHint>;
  /** Current search text for highlighting. Empty string = no highlight. */
  searchQuery?: string;
}
```

Update `FieldLabel` to accept and use `searchQuery`:

```tsx
function FieldLabel({ field, searchQuery }: { field: FormField; searchQuery?: string }) {
  const displayKey = searchQuery ? (
    <SearchHighlight text={field.key} query={searchQuery} />
  ) : (
    field.key
  );
  const displayDesc =
    field.description && searchQuery ? (
      <SearchHighlight text={field.description} query={searchQuery} />
    ) : (
      field.description
    );

  return (
    <label className="block text-xs font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>
      {displayKey}
      {field.required && <span style={{ color: "var(--status-disconnected)" }}> *</span>}
      {field.description && (
        <span
          className="ml-1 font-normal"
          style={{ color: "var(--muted-foreground)", opacity: 0.7 }}
        >
          — {displayDesc}
        </span>
      )}
      <FieldHelpPopover help={field.help} />
      {field.defaultValue != null && (
        <span className="text-[10px] ml-1" style={{ color: "var(--text-tertiary)" }}>
          (default: {String(field.defaultValue)})
        </span>
      )}
    </label>
  );
}
```

Update `FieldRenderer` to accept and pass through `searchQuery`:

```tsx
function FieldRenderer({
  field,
  values,
  onChange,
  prefix,
  hints,
  searchQuery,
}: {
  field: FormField;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  prefix: string;
  hints?: Record<string, FieldHint>;
  searchQuery?: string;
}) {
```

Inside every field component call in FieldRenderer (StringField, NumberField, BooleanField, EnumField, ArrayField), update the `<FieldLabel>` references. Since field components render `<FieldLabel>` internally, the easiest approach is to add `searchQuery` as a prop on FieldLabel and thread it down. Specifically, each field component that renders `<FieldLabel field={field} />` should become `<FieldLabel field={field} searchQuery={searchQuery} />`.

For StringField, NumberField, BooleanField, EnumField, ArrayField — add `searchQuery?: string` to each component's prop type and pass it through to FieldLabel. For ObjectField, also pass searchQuery to the nested `<SchemaForm>`.

In the `SchemaForm` export function, accept `searchQuery` and thread it to each `FieldRenderer`:

```tsx
export function SchemaForm({ fields, values, onChange, prefix = "", hints, searchQuery }: SchemaFormProps) {
```

And in the render, pass `searchQuery` to each `<FieldRenderer>`:

```tsx
<FieldRenderer
  key={`${prefix}${field.key}`}
  field={field}
  values={values}
  onChange={handleChange}
  prefix={prefix}
  hints={hints}
  searchQuery={searchQuery}
/>
```

- [ ] **Step 6: Verify no type errors**

Run: `cd dashboard && pnpm tsc --noEmit`
Expected: 0 new errors

- [ ] **Step 7: Commit**

```bash
scripts/committer "[enhanced] feat(config): integrate search bar, tag filter, and result highlighting into Config Editor" dashboard/src/components/panels/config-editor/ConfigPanel.tsx dashboard/src/components/panels/config-editor/SchemaForm.tsx
```

---

### Task 5: Enhanced ConflictDialog with Field-Level Diff [frontend]

covers: config-conflict-resolution/spec.md > ADDED > ConflictDialog shows field-level diff > Display field-level conflicts
covers: config-conflict-resolution/spec.md > ADDED > ConflictDialog shows field-level diff > Highlight changed values
covers: config-conflict-resolution/spec.md > ADDED > ConflictDialog supports per-field merge selection > Select local value for a field
covers: config-conflict-resolution/spec.md > ADDED > ConflictDialog supports per-field merge selection > Apply merged result
covers: config-conflict-resolution/spec.md > ADDED > ConflictDialog supports per-field merge selection > Quick resolve all

**Files:**

- Modify: `dashboard/src/stores/config.ts`
- Modify: `dashboard/src/components/panels/config-editor/ConflictDialog.tsx`
- Modify: `dashboard/src/components/panels/config-editor/ConfigPanel.tsx`

- [ ] **Step 1: Add remoteConfig and resolveConflict to config store**

In `dashboard/src/stores/config.ts`, add `remoteConfig` to the state interface:

```typescript
interface ConfigState {
  // ... existing fields ...
  /** Remote config snapshot captured when a conflict is detected */
  remoteConfig: string | null;

  // ... existing methods ...
  /** Resolve conflict by saving a merged config with the latest baseHash */
  resolveConflict: (mergedConfig: Record<string, unknown>) => Promise<boolean>;
}
```

Initialize it:

```typescript
remoteConfig: null,
```

Update the conflict detection in `saveConfig` to fetch remote config when conflict is detected. In the existing conflict detection block (lines ~127-137), replace:

```typescript
// When conflict detected, fetch remote config for field-level diff
if (msg.includes("config changed") || msg.includes("base hash")) {
  // Fetch latest remote config in background
  try {
    const remoteRes = await fetch("/api/config");
    if (remoteRes.ok) {
      const remoteData = await remoteRes.json();
      const remoteRaw =
        typeof remoteData.config === "string"
          ? remoteData.config
          : JSON.stringify(remoteData.config ?? {}, null, 2);
      const remoteHash =
        typeof remoteData.baseHash === "string"
          ? remoteData.baseHash
          : typeof remoteData.hash === "string"
            ? remoteData.hash
            : null;
      set({ conflict: true, remoteConfig: remoteRaw, baseHash: remoteHash });
    } else {
      set({ conflict: true, remoteConfig: null });
    }
  } catch {
    set({ conflict: true, remoteConfig: null });
  }
  return false;
}
```

Note: this replaces the two separate `if` blocks that both set `conflict: true`.

Add `resolveConflict` method:

```typescript
resolveConflict: async (mergedConfig) => {
  const { baseHash } = get();
  const raw = JSON.stringify(mergedConfig, null, 2);
  set({ saving: true, error: null });
  try {
    const res = await fetch("/api/config/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw, baseHash }),
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => ({ error: "Save failed" }))) as {
        error?: string;
        message?: string;
      };
      set({ error: data.error ?? data.message ?? "Merge save failed" });
      return false;
    }

    try {
      const saveData = (await res.json()) as { baseHash?: string };
      if (typeof saveData.baseHash === "string") {
        set({
          rawConfig: raw,
          editedConfig: raw,
          baseHash: saveData.baseHash,
          isDirty: false,
          conflict: false,
          remoteConfig: null,
        });
        return true;
      }
    } catch {
      // Fall through to reload
    }

    await get().fetchConfig();
    set({ conflict: false, remoteConfig: null });
    return true;
  } catch {
    set({ error: "Merge save failed" });
    return false;
  } finally {
    set({ saving: false });
  }
},
```

Also update `reloadConfig` to clear `remoteConfig`:

```typescript
reloadConfig: async () => {
  set({ conflict: false, remoteConfig: null });
  await get().fetchConfig();
},
```

- [ ] **Step 2: Rewrite ConflictDialog with field-level diff and merge selection**

Replace the entire content of `dashboard/src/components/panels/config-editor/ConflictDialog.tsx`:

```tsx
"use client";

import { AlertTriangle, ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useMemo, useCallback } from "react";
import { computeConfigDiff, type DiffEntry } from "@/lib/config-diff";
import { useConfigStore } from "@/stores/config";

interface ConflictDialogProps {
  onReload: () => void;
  onCancel: () => void;
}

/** Format a value for display, truncating long strings */
function formatValue(val: unknown): string {
  if (val === undefined) return "—";
  if (val === null) return "null";
  if (typeof val === "string") {
    return val.length > 40 ? `"${val.slice(0, 40)}…"` : `"${val}"`;
  }
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (Array.isArray(val)) return `[${val.length} items]`;
  if (typeof val === "object") return "{...}";
  return JSON.stringify(val) ?? "?";
}

/** Per-field resolution choice */
type FieldChoice = "local" | "remote";

export function ConflictDialog({ onReload, onCancel }: ConflictDialogProps) {
  const t = useTranslations("config");
  const tc = useTranslations("common");
  const { editedConfig, remoteConfig, resolveConflict, saving } = useConfigStore();

  // Compute field-level diffs between local edits and remote state
  const diffs = useMemo((): DiffEntry[] => {
    if (!remoteConfig) return [];
    try {
      const local = JSON.parse(editedConfig || "{}") as Record<string, unknown>;
      const remote = JSON.parse(remoteConfig) as Record<string, unknown>;
      return computeConfigDiff(remote, local);
    } catch {
      return [];
    }
  }, [editedConfig, remoteConfig]);

  // Track per-field selections
  const [choices, setChoices] = useState<Record<string, FieldChoice>>({});

  const allResolved = diffs.length > 0 && diffs.every((d) => choices[d.path] !== undefined);

  const handleChoose = useCallback((path: string, choice: FieldChoice) => {
    setChoices((prev) => ({ ...prev, [path]: choice }));
  }, []);

  const handleChooseAll = useCallback(
    (choice: FieldChoice) => {
      const all: Record<string, FieldChoice> = {};
      for (const d of diffs) {
        all[d.path] = choice;
      }
      setChoices(all);
    },
    [diffs],
  );

  const handleApply = useCallback(async () => {
    if (!remoteConfig) return;
    try {
      const local = JSON.parse(editedConfig || "{}") as Record<string, unknown>;
      const remote = JSON.parse(remoteConfig) as Record<string, unknown>;

      // Start from remote, then apply local choices
      const merged = structuredClone(remote);

      for (const diff of diffs) {
        const choice = choices[diff.path] ?? "remote";
        if (choice === "local") {
          setDeepValue(merged, diff.path, diff.newValue);
        }
        // "remote" → already in merged base
      }

      await resolveConflict(merged);
    } catch {
      // Error handled by store
    }
  }, [editedConfig, remoteConfig, diffs, choices, resolveConflict]);

  // Fallback: no remote config available, show simple dialog
  if (!remoteConfig || diffs.length === 0) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
      >
        <div
          className="rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl"
          style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle size={20} style={{ color: "var(--status-disconnected)" }} />
            <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              {t("conflict")}
            </h3>
          </div>
          <p className="text-xs mb-4" style={{ color: "var(--muted-foreground)" }}>
            {t("conflictDescription")}
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={onCancel}
              className="text-xs px-3 py-1.5 rounded"
              style={{
                border: "1px solid var(--border)",
                color: "var(--muted-foreground)",
                backgroundColor: "var(--card)",
              }}
            >
              {tc("cancel")}
            </button>
            <button
              onClick={onReload}
              className="text-xs px-3 py-1.5 rounded"
              style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              {t("reload")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
    >
      <div
        className="rounded-lg shadow-xl max-w-2xl w-full mx-4 flex flex-col max-h-[80vh]"
        style={{ backgroundColor: "var(--background)", border: "1px solid var(--border)" }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-5 py-4 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <AlertTriangle size={20} style={{ color: "var(--warning)" }} />
          <div>
            <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              {t("conflictTitle")}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              {t("conflictFieldCount", { count: diffs.length })}
            </p>
          </div>
        </div>

        {/* Quick resolve buttons */}
        <div
          className="flex items-center justify-between px-5 py-2 border-b"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--muted)" }}
        >
          <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
            {t("conflictQuickResolve")}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => handleChooseAll("local")}
              className="text-[11px] px-2 py-0.5 rounded transition-colors"
              style={{
                border: "1px solid var(--border)",
                color: "var(--foreground)",
                backgroundColor: "var(--card)",
              }}
            >
              {t("conflictKeepAllLocal")}
            </button>
            <button
              onClick={() => handleChooseAll("remote")}
              className="text-[11px] px-2 py-0.5 rounded transition-colors"
              style={{
                border: "1px solid var(--border)",
                color: "var(--foreground)",
                backgroundColor: "var(--card)",
              }}
            >
              {t("conflictAcceptAllRemote")}
            </button>
          </div>
        </div>

        {/* Diff table */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          <div className="flex flex-col gap-2">
            {diffs.map((diff) => {
              const choice = choices[diff.path];
              return (
                <div
                  key={diff.path}
                  className="rounded-lg border px-3 py-2"
                  style={{
                    borderColor: choice ? "var(--primary)" : "var(--border)",
                    backgroundColor: "var(--card)",
                  }}
                >
                  {/* Path */}
                  <div className="text-xs font-mono mb-1.5" style={{ color: "var(--foreground)" }}>
                    {diff.path}
                  </div>

                  {/* Values + choice buttons */}
                  <div className="flex items-stretch gap-2">
                    {/* Local value */}
                    <button
                      onClick={() => handleChoose(diff.path, "local")}
                      className="flex-1 rounded px-2 py-1.5 text-left transition-colors"
                      style={{
                        backgroundColor:
                          choice === "local" ? "var(--warning-muted)" : "var(--muted)",
                        border:
                          choice === "local"
                            ? "2px solid var(--warning)"
                            : "1px solid var(--border)",
                      }}
                    >
                      <div className="flex items-center gap-1 mb-0.5">
                        <ArrowLeft size={10} style={{ color: "var(--muted-foreground)" }} />
                        <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                          {t("conflictLocal")}
                        </span>
                        {choice === "local" && (
                          <Check size={10} style={{ color: "var(--warning)" }} />
                        )}
                      </div>
                      <div
                        className="text-xs font-mono break-all"
                        style={{ color: "var(--foreground)" }}
                      >
                        {formatValue(diff.type === "remove" ? diff.oldValue : diff.newValue)}
                      </div>
                    </button>

                    {/* Remote value */}
                    <button
                      onClick={() => handleChoose(diff.path, "remote")}
                      className="flex-1 rounded px-2 py-1.5 text-left transition-colors"
                      style={{
                        backgroundColor:
                          choice === "remote" ? "var(--primary-muted)" : "var(--muted)",
                        border:
                          choice === "remote"
                            ? "2px solid var(--primary)"
                            : "1px solid var(--border)",
                      }}
                    >
                      <div className="flex items-center gap-1 mb-0.5">
                        <ArrowRight size={10} style={{ color: "var(--muted-foreground)" }} />
                        <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                          {t("conflictRemote")}
                        </span>
                        {choice === "remote" && (
                          <Check size={10} style={{ color: "var(--primary)" }} />
                        )}
                      </div>
                      <div
                        className="text-xs font-mono break-all"
                        style={{ color: "var(--foreground)" }}
                      >
                        {formatValue(diff.type === "add" ? diff.newValue : diff.oldValue)}
                      </div>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-5 py-3 border-t"
          style={{ borderColor: "var(--border)" }}
        >
          <button
            onClick={onReload}
            className="text-xs px-3 py-1.5 rounded"
            style={{
              border: "1px solid var(--border)",
              color: "var(--muted-foreground)",
              backgroundColor: "var(--card)",
            }}
          >
            {t("conflictDiscardLocal")}
          </button>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="text-xs px-3 py-1.5 rounded"
              style={{
                border: "1px solid var(--border)",
                color: "var(--muted-foreground)",
                backgroundColor: "var(--card)",
              }}
            >
              {tc("cancel")}
            </button>
            <button
              onClick={() => void handleApply()}
              disabled={!allResolved || saving}
              className="text-xs px-3 py-1.5 rounded transition-opacity disabled:opacity-40"
              style={{
                backgroundColor: "var(--primary)",
                color: "var(--primary-foreground)",
              }}
            >
              {saving ? t("saving") : t("conflictApplyMerge")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Set a value at a dotted path in a nested object, creating intermediate
 * objects as needed. Mutates the target.
 */
function setDeepValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (!current[key] || typeof current[key] !== "object" || Array.isArray(current[key])) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  if (value === undefined) {
    delete current[parts[parts.length - 1]];
  } else {
    current[parts[parts.length - 1]] = value;
  }
}
```

- [ ] **Step 3: Update ConflictDialog usage in ConfigPanel**

In `dashboard/src/components/panels/config-editor/ConfigPanel.tsx`, the ConflictDialog rendering already passes `onReload` and `onCancel`. The enhanced dialog now also reads `editedConfig`, `remoteConfig`, and `resolveConflict` from the config store internally, so no additional props are needed. The existing rendering code is compatible:

```tsx
{
  conflict && (
    <ConflictDialog
      onReload={handleReload}
      onCancel={() => useConfigStore.setState({ conflict: false, remoteConfig: null })}
    />
  );
}
```

Update the `onCancel` handler to also clear `remoteConfig`.

- [ ] **Step 4: Verify no type errors**

Run: `cd dashboard && pnpm tsc --noEmit`
Expected: 0 new errors

- [ ] **Step 5: Commit**

```bash
scripts/committer "[enhanced] feat(config): field-level conflict resolution with per-field merge selection" dashboard/src/stores/config.ts dashboard/src/components/panels/config-editor/ConflictDialog.tsx dashboard/src/components/panels/config-editor/ConfigPanel.tsx
```

---

### Task 6: i18n Keys [frontend]

covers: config-advanced-search/spec.md > ADDED > Search displays syntax hint > Show syntax hint

**Files:**

- Modify: `dashboard/src/i18n/zh.json`
- Modify: `dashboard/src/i18n/en.json`

- [ ] **Step 1: Add Chinese i18n keys**

In `dashboard/src/i18n/zh.json`, inside the `"config"` object (after the last existing key, before the closing `}`), add:

```json
    "searchPlaceholder": "搜索配置... (支持 tag:sensitive 语法)",
    "filterByTag": "标签:",
    "noSearchResults": "未找到匹配的配置项",
    "conflictTitle": "配置冲突",
    "conflictDescription": "配置已被其他操作修改，请选择保留方式。",
    "conflictFieldCount": "{count} 个字段存在冲突",
    "conflictQuickResolve": "快速处理：",
    "conflictKeepAllLocal": "全部保留本地",
    "conflictAcceptAllRemote": "全部采用远端",
    "conflictLocal": "本地",
    "conflictRemote": "远端",
    "conflictApplyMerge": "应用合并",
    "conflictDiscardLocal": "放弃本地更改"
```

- [ ] **Step 2: Add English i18n keys**

In `dashboard/src/i18n/en.json`, inside the `"config"` object (same position), add:

```json
    "searchPlaceholder": "Search config... (supports tag:sensitive syntax)",
    "filterByTag": "Tags:",
    "noSearchResults": "No matching configuration fields",
    "conflictTitle": "Config Conflict",
    "conflictDescription": "Configuration was modified externally. Choose how to resolve.",
    "conflictFieldCount": "{count} fields have conflicts",
    "conflictQuickResolve": "Quick resolve:",
    "conflictKeepAllLocal": "Keep all local",
    "conflictAcceptAllRemote": "Accept all remote",
    "conflictLocal": "Local",
    "conflictRemote": "Remote",
    "conflictApplyMerge": "Apply merge",
    "conflictDiscardLocal": "Discard local changes"
```

- [ ] **Step 3: Commit**

```bash
scripts/committer "[enhanced] feat(config): add i18n keys for search, tag filter, and conflict resolution" dashboard/src/i18n/zh.json dashboard/src/i18n/en.json
```

---

### Task 7: Final Verification [frontend]

**Files:** None (verification only)

- [ ] **Step 1: Run TypeScript check**

Run: `cd dashboard && pnpm tsc --noEmit`
Expected: 0 new errors

- [ ] **Step 2: Run lint**

Run: `cd dashboard && pnpm check 2>&1 | tail -20`
Expected: No new lint errors from changed files

- [ ] **Step 3: Verify i18n consistency**

Check that all new i18n keys used in code exist in both locale files:

- `searchPlaceholder` ✓
- `filterByTag` ✓
- `noSearchResults` ✓
- `conflictTitle` ✓
- `conflictDescription` ✓
- `conflictFieldCount` ✓
- `conflictQuickResolve` ✓
- `conflictKeepAllLocal` ✓
- `conflictAcceptAllRemote` ✓
- `conflictLocal` ✓
- `conflictRemote` ✓
- `conflictApplyMerge` ✓
- `conflictDiscardLocal` ✓

---

## Requirement Coverage Matrix

| Spec Requirement                                                                                   | Task      |
| -------------------------------------------------------------------------------------------------- | --------- |
| config-advanced-search > Search supports tag: prefix > Filter by sensitive tag                     | Task 1, 4 |
| config-advanced-search > Search supports tag: prefix > Combined tag and text search                | Task 1, 4 |
| config-advanced-search > Search matches multiple field attributes > Match by path                  | Task 1, 4 |
| config-advanced-search > Search matches multiple field attributes > Match by enum value            | Task 1, 4 |
| config-advanced-search > Search matches multiple field attributes > Case insensitive match         | Task 1, 4 |
| config-advanced-search > Search results highlight matched text > Highlight in label                | Task 2, 4 |
| config-advanced-search > Search results highlight matched text > No highlight when no search       | Task 2, 4 |
| config-advanced-search > Search displays syntax hint > Show syntax hint                            | Task 4, 6 |
| config-tag-filter > Tag filter panel displays available tags > Display tag chips                   | Task 3, 4 |
| config-tag-filter > Tag filter panel displays available tags > Click tag to filter                 | Task 3, 4 |
| config-tag-filter > Tag filter panel displays available tags > Deselect tag                        | Task 3, 4 |
| config-tag-filter > Tag filter panel displays available tags > No tags available                   | Task 3    |
| config-conflict-resolution > ConflictDialog shows field-level diff > Display field-level conflicts | Task 5    |
| config-conflict-resolution > ConflictDialog shows field-level diff > Highlight changed values      | Task 5    |
| config-conflict-resolution > ConflictDialog supports per-field merge > Select local value          | Task 5    |
| config-conflict-resolution > ConflictDialog supports per-field merge > Apply merged result         | Task 5    |
| config-conflict-resolution > ConflictDialog supports per-field merge > Quick resolve all           | Task 5    |
