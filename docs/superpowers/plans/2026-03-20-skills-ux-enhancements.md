# Skills UX Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the Skills panel with content preview, search/grouping, actionable dependency install, and install progress feedback — all using data the Gateway already returns but the frontend currently discards.

**Architecture:** Pure frontend enhancement. The Gateway `skills.status` RPC already returns rich `SkillStatusEntry` fields (`description`, `emoji`, `homepage`, `primaryEnv`, `install[]` with `id/kind/label/bins`). The store's `normalizeSkill()` discards them. We expand the `SkillEntry` type to capture these fields, then build UI to expose them. Toast notifications use the existing `useNotificationsStore`. Collapsible grouping uses the existing `@base-ui/react` Collapsible component.

**Tech Stack:** React 19, Next.js 15, Zustand, next-intl, @base-ui/react (Collapsible), Tailwind CSS, CSS variables for theme compliance.

---

## File Structure

| File                                                     | Responsibility                                   | Action |
| -------------------------------------------------------- | ------------------------------------------------ | ------ |
| `dashboard/src/stores/skills.ts`                         | Zustand store + SkillEntry type + normalizeSkill | Modify |
| `dashboard/src/components/panels/skills/SkillList.tsx`   | Sidebar skill list with filters                  | Modify |
| `dashboard/src/components/panels/skills/SkillConfig.tsx` | Skill detail/config panel                        | Modify |
| `dashboard/src/i18n/zh.json`                             | Chinese translations                             | Modify |
| `dashboard/src/i18n/en.json`                             | English translations                             | Modify |

No new files needed — all changes fit within existing files.

---

### Task 1: Expand SkillEntry type and normalizeSkill

**Context:** Gateway `skills.status` returns `SkillStatusEntry` (defined in `src/agents/skills-status.ts`) with fields: `description`, `emoji`, `homepage`, `primaryEnv`, `install[]` (each has `id/kind/label/bins`). The frontend `normalizeSkill()` in `dashboard/src/stores/skills.ts` currently discards all of them. This task adds them to the store type so subsequent tasks can render them.

**Files:**

- Modify: `dashboard/src/stores/skills.ts`

**Skills:** `superpowers:test-driven-development`

- [ ] **Step 1: Expand the SkillEntry interface**

Add the new fields to `SkillEntry` in `dashboard/src/stores/skills.ts`:

```typescript
export interface SkillInstallOption {
  id: string;
  kind: string;
  label: string;
  bins: string[];
}

export interface SkillEntry {
  key: string;
  name: string;
  description: string; // NEW
  emoji?: string; // NEW
  homepage?: string; // NEW
  primaryEnv?: string; // NEW
  status: SkillStatus;
  source: "bundled" | "managed" | "plugin";
  enabled: boolean;
  missingRequirements?: string[];
  installOptions?: SkillInstallOption[]; // NEW
  config?: Record<string, unknown>;
}
```

- [ ] **Step 2: Update normalizeSkill to extract the new fields**

In `normalizeSkill()`, add extraction logic for the new fields:

```typescript
function normalizeSkill(raw: Record<string, unknown>): SkillEntry {
  // ... existing logic ...

  // NEW: extract description, emoji, homepage, primaryEnv
  const description = typeof raw.description === "string" ? raw.description : "";
  const emoji = typeof raw.emoji === "string" ? raw.emoji : undefined;
  const homepage = typeof raw.homepage === "string" ? raw.homepage : undefined;
  const primaryEnv = typeof raw.primaryEnv === "string" ? raw.primaryEnv : undefined;

  // NEW: extract install options
  let installOptions: SkillInstallOption[] | undefined;
  if (Array.isArray(raw.install) && raw.install.length > 0) {
    installOptions = (raw.install as Record<string, unknown>[])
      .filter((i) => typeof i.id === "string" && typeof i.label === "string")
      .map((i) => ({
        id: i.id as string,
        kind: typeof i.kind === "string" ? i.kind : "unknown",
        label: i.label as string,
        bins: Array.isArray(i.bins) ? (i.bins as string[]) : [],
      }));
    if (installOptions.length === 0) installOptions = undefined;
  }

  return {
    key: ...,
    name: ...,
    description,        // NEW
    emoji,              // NEW
    homepage,           // NEW
    primaryEnv,         // NEW
    status,
    source: ...,
    enabled: ...,
    missingRequirements: ...,
    installOptions,     // NEW
    config: ...,
  };
}
```

- [ ] **Step 3: Refactor installSkill to add auto-refresh + add searchQuery state**

The existing `installSkill` action hits the same endpoint but doesn't refresh the skills list afterward. Modify it in-place to add a refresh call via `get().fetchSkills()`, and rename to clarify its purpose. Also add `searchQuery` state for Task 2.

Update the `SkillsState` interface — replace the old `installSkill` signature and add search state:

```typescript
interface SkillsState {
  skills: SkillEntry[];
  selectedSkillKey: string | null;
  statusFilter: StatusFilter;
  searchQuery: string; // NEW
  loading: boolean;
  error: string | null;

  fetchSkills: (agentId?: string) => Promise<void>;
  updateSkill: (
    skillKey: string,
    patch: { enabled?: boolean; apiKey?: string; env?: Record<string, string> },
  ) => Promise<boolean>;
  installSkill: (name: string, installId: string) => Promise<boolean>; // MODIFIED: now refreshes after install
  setStatusFilter: (filter: StatusFilter) => void;
  setSearchQuery: (query: string) => void; // NEW
  selectSkill: (key: string | null) => void;
}
```

Update the `installSkill` implementation to auto-refresh:

```typescript
installSkill: async (name, installId) => {
  try {
    const res = await fetch("/api/skills/install", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, installId }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { ok?: boolean };
    // Auto-refresh skills list to reflect install result
    await get().fetchSkills();
    return !!data.ok;
  } catch {
    return false;
  }
},
```

Add search state initial values:

```typescript
searchQuery: "",
setSearchQuery: (query) => set({ searchQuery: query }),
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd /Users/wangym/workspace/agents/openclaw/dashboard && npx tsc --noEmit`
Expected: no new errors from the store changes.

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/stores/skills.ts
git commit -m "[enhanced] feat(deck): expand SkillEntry with description/emoji/homepage/install fields"
```

---

### Task 2: Search and source-grouped skill list

**Context:** The `SkillList` component in `dashboard/src/components/panels/skills/SkillList.tsx` currently shows a flat list with 4 status filter buttons. With many installed skills, finding a specific one is tedious. This task adds a text search box at the top and groups the filtered results by `source` (bundled/managed/plugin) using collapsible sections.

**Files:**

- Modify: `dashboard/src/components/panels/skills/SkillList.tsx`
- Modify: `dashboard/src/i18n/zh.json`
- Modify: `dashboard/src/i18n/en.json`

**Skills:** `superpowers:test-driven-development`

- [ ] **Step 1: Add i18n keys**

Add to `skills` namespace in both `zh.json` and `en.json`:

```json
// zh.json — add inside "skills": { ... }
"searchPlaceholder": "搜索技能...",
"groupBundled": "内置技能",
"groupManaged": "托管技能",
"groupPlugin": "插件技能"

// en.json — add inside "skills": { ... }
"searchPlaceholder": "Search skills...",
"groupBundled": "Bundled Skills",
"groupManaged": "Managed Skills",
"groupPlugin": "Plugin Skills"
```

- [ ] **Step 2: Rewrite SkillList with search + grouped view**

Replace the content of `dashboard/src/components/panels/skills/SkillList.tsx`:

The key changes:

1. Add a search input with leading `Search` icon at the top (relative positioning, icon overlay inside input)
2. After applying status filter AND search filter (match against `name`, `key`, `description`), group results by `source`
3. Each source group is a `Collapsible` section (from `@/components/ui/collapsible`) with:
   - A trigger showing the group label + count badge
   - Content showing the skill buttons (same as current, minus source Badge since group header shows it)
4. Groups with 0 items are hidden
5. When search query is active, all groups default open; when no search, groups default open too (simple — always `defaultOpen`)

```tsx
// Full imports for the rewritten file:
import { Search, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useSkillsStore, type SkillEntry, type StatusFilter } from "@/stores/skills";

const STATUS_FILTERS: StatusFilter[] = ["all", "ready", "needs-setup", "disabled"];

const SOURCE_GROUPS: Array<{ source: SkillEntry["source"]; labelKey: string }> = [
  { source: "bundled", labelKey: "groupBundled" },
  { source: "managed", labelKey: "groupManaged" },
  { source: "plugin", labelKey: "groupPlugin" },
];
```

Search input layout — use relative positioning with the icon inside:

```tsx
{
  /* Search input with leading icon */
}
<div className="relative mb-2">
  <Search
    size={14}
    className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]"
  />
  <Input
    type="text"
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    placeholder={t("searchPlaceholder")}
    className="h-7 text-xs pl-7"
  />
</div>;
```

The search input reads/writes `searchQuery` and `setSearchQuery` from `useSkillsStore()`. Filter logic:

```typescript
const {
  skills,
  selectedSkillKey,
  statusFilter,
  searchQuery,
  selectSkill,
  setStatusFilter,
  setSearchQuery,
} = useSkillsStore();

const query = searchQuery.toLowerCase().trim();
const filtered = skills
  .filter((s) => statusFilter === "all" || s.status === statusFilter)
  .filter(
    (s) =>
      !query ||
      s.name.toLowerCase().includes(query) ||
      s.key.toLowerCase().includes(query) ||
      s.description.toLowerCase().includes(query),
  );

// Group by source
const groups = SOURCE_GROUPS.map(({ source, labelKey }) => ({
  source,
  labelKey,
  skills: filtered.filter((s) => s.source === source),
})).filter((g) => g.skills.length > 0);
```

Each group renders as:

```tsx
{
  groups.map((group) => (
    <Collapsible key={group.source} defaultOpen>
      <CollapsibleTrigger className="flex items-center gap-2 w-full px-2 py-1.5 text-[11px] font-medium text-[var(--text-secondary)] uppercase tracking-wider cursor-pointer hover:text-[var(--text-primary)] transition-colors">
        <ChevronRight size={12} className="transition-transform [[data-panel-open]_&]:rotate-90" />
        <span>{t(group.labelKey)}</span>
        <span className="ml-auto tabular-nums">{group.skills.length}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {group.skills.map((skill) => {
          const isActive = selectedSkillKey === skill.key;
          return (
            <button
              key={skill.key}
              type="button"
              className={cn(
                "relative w-full text-left px-3 py-2 rounded-lg transition-colors duration-150 text-xs cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50",
                isActive
                  ? "bg-[var(--accent-muted)] text-[var(--accent)]"
                  : "text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]",
              )}
              onClick={() => selectSkill(skill.key)}
            >
              {isActive && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]"
                  aria-hidden
                />
              )}
              <div className="flex items-center justify-between">
                <span className="font-medium truncate">
                  {skill.emoji && <span className="mr-1">{skill.emoji}</span>}
                  {skill.name}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-[var(--text-secondary)]">
                <span
                  className={cn(
                    "w-1.5 h-1.5 rounded-full inline-block shrink-0",
                    statusDotColor(skill.status),
                  )}
                />
                <span>{skill.status === "needs-setup" ? t("needsSetup") : t(skill.status)}</span>
              </div>
            </button>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  ));
}
```

Keep the `statusDotColor` helper function from the original file (no changes needed).

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/wangym/workspace/agents/openclaw/dashboard && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/components/panels/skills/SkillList.tsx dashboard/src/i18n/zh.json dashboard/src/i18n/en.json
git commit -m "[enhanced] feat(deck): add skill search and source-grouped list"
```

---

### Task 3: Skill content preview in detail panel

**Context:** The `SkillConfig` component in `dashboard/src/components/panels/skills/SkillConfig.tsx` currently only shows the skill name, status, source badge, and config fields (apiKey/env). The `SkillEntry` now carries `description`, `emoji`, `homepage`, and `primaryEnv`. This task adds a content preview section at the top of the detail panel.

**Files:**

- Modify: `dashboard/src/components/panels/skills/SkillConfig.tsx`
- Modify: `dashboard/src/i18n/zh.json`
- Modify: `dashboard/src/i18n/en.json`

**Skills:** `superpowers:test-driven-development`

- [ ] **Step 1: Add i18n keys**

Add to `skills` namespace in both files:

```json
// zh.json
"description": "说明",
"homepage": "主页",
"requiredEnv": "所需环境变量",
"noDescription": "此技能未提供说明"

// en.json
"description": "Description",
"homepage": "Homepage",
"requiredEnv": "Required Env",
"noDescription": "No description available for this skill"
```

- [ ] **Step 2: Add content preview section to SkillConfig**

In `SkillConfig.tsx`, between the header and the "Status + source" section, add a description card:

```tsx
// After the header div, before "Status + source":

{
  /* Description preview */
}
<div className="text-xs space-y-2">
  {/* Emoji + description */}
  <p className="text-[var(--text-primary)] leading-relaxed">
    {skill.emoji && <span className="mr-1.5">{skill.emoji}</span>}
    {skill.description || t("noDescription")}
  </p>

  {/* Homepage link */}
  {skill.homepage && (
    <a
      href={skill.homepage}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[var(--accent)] hover:underline"
    >
      <ExternalLink size={11} />
      {t("homepage")}
    </a>
  )}

  {/* Primary env hint */}
  {skill.primaryEnv && (
    <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
      <span className="font-medium">{t("requiredEnv")}:</span>
      <code className="px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] font-mono text-[11px]">
        {skill.primaryEnv}
      </code>
    </div>
  )}
</div>;
```

Import `ExternalLink` from lucide-react at the top of the file.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/wangym/workspace/agents/openclaw/dashboard && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/components/panels/skills/SkillConfig.tsx dashboard/src/i18n/zh.json dashboard/src/i18n/en.json
git commit -m "[enhanced] feat(deck): add skill description/emoji/homepage preview"
```

---

### Task 4: Actionable dependency install + progress feedback

**Context:** Gateway returns `install[]` options (each with `id/kind/label/bins`). The current `SkillConfig` has a single generic "Install" button that uses `installSkill(skill.name, installId)` with no feedback. This task replaces that with per-dependency install buttons (using the `installOptions` from the expanded `SkillEntry`) and adds toast notifications for install results.

**Files:**

- Modify: `dashboard/src/components/panels/skills/SkillConfig.tsx`
- Modify: `dashboard/src/i18n/zh.json`
- Modify: `dashboard/src/i18n/en.json`

**Skills:** `superpowers:test-driven-development`

- [ ] **Step 1: Add i18n keys**

Add to `skills` namespace in both files:

```json
// zh.json
"installDeps": "安装依赖",
"installing": "安装中...",
"installSuccess": "{name} 安装成功",
"installFailed": "{name} 安装失败",
"requiredBins": "需要"

// en.json
"installDeps": "Install Dependencies",
"installing": "Installing...",
"installSuccess": "{name} installed successfully",
"installFailed": "{name} installation failed",
"requiredBins": "Requires"
```

- [ ] **Step 2: Replace the install section in SkillConfig**

Remove the existing single "Install" button (the `{skill.source !== "bundled" && ...}` block in the header). Replace the `missingRequirements` section with a combined "dependencies + install" card.

After the description preview, before the API Key section:

```tsx
{
  /* Actionable dependencies section */
}
{
  ((skill.missingRequirements && skill.missingRequirements.length > 0) ||
    (skill.installOptions && skill.installOptions.length > 0)) && (
    <div className="space-y-2">
      <Label className="text-xs text-[var(--text-secondary)]">{t("installDeps")}</Label>

      {/* Missing requirements warning */}
      {skill.missingRequirements && skill.missingRequirements.length > 0 && (
        <div className="text-xs px-3 py-2 rounded-lg bg-[var(--skill-warning-bg)] text-[var(--skill-warning-text)] ring-1 ring-[var(--warning)]/20">
          <span className="font-medium">{t("missingRequirements")}:</span>{" "}
          {skill.missingRequirements.join(", ")}
        </div>
      )}

      {/* Install options — one button per option */}
      {skill.installOptions?.map((opt) => (
        <div
          key={opt.id}
          className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] ring-1 ring-[var(--border-subtle)]"
        >
          <div className="text-xs">
            <span className="font-medium text-[var(--text-primary)]">{opt.label}</span>
            {opt.bins.length > 0 && (
              <span className="ml-2 text-[var(--text-secondary)]">
                {t("requiredBins")}: {opt.bins.join(", ")}
              </span>
            )}
          </div>
          <Button
            variant="outline"
            size="xs"
            className="gap-1 shrink-0"
            onClick={() => void handleInstallDep(opt)}
            disabled={!!installingDeps[opt.id]}
          >
            {installingDeps[opt.id] ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                {t("installing")}
              </>
            ) : (
              <>
                <Download size={12} />
                {t("install")}
              </>
            )}
          </Button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Add install handler with toast feedback**

In `SkillConfig`, add:

Update the import line to add `Loader2`:

```tsx
import { Download, ExternalLink, Loader2, Plus, X } from "lucide-react";
```

Add notification store import:

```tsx
import { useNotificationsStore } from "@/stores/notifications";
import { type SkillInstallOption } from "@/stores/skills";
```

Inside the component, replace the old `installing` state and `handleInstall` function with:

```tsx
const { updateSkill, installSkill, fetchSkills } = useSkillsStore();
const addToast = useNotificationsStore((s) => s.addToast);
const [installingDeps, setInstallingDeps] = useState<Record<string, boolean>>({});

const handleInstallDep = async (opt: SkillInstallOption) => {
  setInstallingDeps((prev) => ({ ...prev, [opt.id]: true }));
  try {
    const ok = await installSkill(skill.name, opt.id);
    if (ok) {
      addToast("success", t("installSuccess", { name: opt.label }));
    } else {
      addToast("error", t("installFailed", { name: opt.label }));
    }
  } finally {
    setInstallingDeps((prev) => ({ ...prev, [opt.id]: false }));
  }
};
```

Remove the old `installing` state (`useState(false)`), the old `handleInstall` function, and the old install button from the header section (`{skill.source !== "bundled" && ...}` block).

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd /Users/wangym/workspace/agents/openclaw/dashboard && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/panels/skills/SkillConfig.tsx dashboard/src/i18n/zh.json dashboard/src/i18n/en.json
git commit -m "[enhanced] feat(deck): actionable dependency install with toast feedback"
```

---

## Verification

After all 4 tasks, verify:

1. `cd /Users/wangym/workspace/agents/openclaw/dashboard && npx tsc --noEmit` — zero errors
2. `cd /Users/wangym/workspace/agents/openclaw/dashboard && npx next lint` — no new warnings
3. Browser test: open Skills panel, verify:
   - Search box filters skills by name/description
   - Skills grouped by source with collapsible sections
   - Selecting a skill shows description, emoji, homepage link, primaryEnv
   - Missing requirements show install buttons with progress spinners
   - Install success/failure triggers toast notification
