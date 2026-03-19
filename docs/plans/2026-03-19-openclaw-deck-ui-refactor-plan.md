# openclaw-deck UI Refactor: shadcn/ui Integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **⚠️ MANDATORY SKILL INVOCATION:** Every `[frontend]` task MUST invoke the specified Skills via `Skill` tool BEFORE writing any code. This is not optional — see dev-workflow Skill routing enforcement rules.

**Goal:** Replace all raw Tailwind + inline styles with shadcn/ui component library, producing a production-grade Dashboard UI.

**Architecture:** Install shadcn/ui on Tailwind 4.x, create `components/ui/` primitives layer, refactor layout shell first (shared dependency), then refactor 19 panels in parallel groups. Preserve existing CSS variable theme system (light/dark) and i18n infrastructure.

**Tech Stack:** Next.js 16 + React 19 + Tailwind CSS 4.2 + shadcn/ui (v2, Tailwind 4 compatible) + Radix UI + class-variance-authority + tailwind-merge

---

## File Structure

### New Files (shadcn/ui infrastructure)

```
dashboard/
├── src/
│   ├── lib/
│   │   └── utils.ts                    # cn() utility (tailwind-merge + clsx)
│   └── components/
│       └── ui/                         # shadcn/ui primitives (auto-generated + customized)
│           ├── button.tsx
│           ├── card.tsx
│           ├── input.tsx
│           ├── label.tsx
│           ├── tabs.tsx
│           ├── badge.tsx
│           ├── dialog.tsx
│           ├── dropdown-menu.tsx
│           ├── scroll-area.tsx
│           ├── separator.tsx
│           ├── tooltip.tsx
│           ├── sheet.tsx
│           ├── toast.tsx
│           ├── toaster.tsx
│           ├── collapsible.tsx
│           └── select.tsx
├── components.json                     # shadcn/ui config
```

### Modified Files (refactoring)

```
dashboard/src/components/
├── layout/
│   ├── Shell.tsx                       # Minor: wrap with TooltipProvider
│   ├── NavRail.tsx                     # Major: Button + Tooltip + Sheet + Collapsible
│   └── HeaderBar.tsx                   # Major: Button + Badge + DropdownMenu
├── panels/
│   ├── chat/*                          # Card + Button + Input + ScrollArea
│   ├── agents/*                        # Card + Button + Input + Dialog + Badge
│   ├── gateway/*                       # Card + Badge
│   ├── models/*                        # Card + Button + Badge + Tabs
│   ├── usage/*                         # Card + Tabs + Badge
│   ├── sessions/*                      # Card + Badge + ScrollArea
│   ├── memory/*                        # Card + Tabs + Input + Badge + Select
│   ├── logs/*                          # Card + Badge + ScrollArea + Button
│   ├── activity/*                      # Card + Badge + Input + Select
│   ├── cron/*                          # Card + Button + Input + Dialog + Badge + Label
│   ├── webhooks/*                      # Card + Button + Input + Dialog + Badge + Label
│   ├── approvals/*                     # Card + Button + Tabs + Badge
│   ├── skills/*                        # Card + Button + Badge + Tabs + Dialog
│   ├── budget/*                        # Card + Button + Input + Dialog + Badge + Label
│   ├── alerts/*                        # Card + Button + Input + Dialog + Badge + Tabs + Label
│   ├── channels/*                      # Card + Button + Badge + Input
│   ├── config-editor/*                 # Card + Button + Input + Label + Tabs + Dialog + ScrollArea
│   ├── docs/*                          # Card + Button + Input + Badge + Tabs + Dialog
│   └── settings/*                      # Card + Button + Input + Label + Tabs + Badge
├── onboarding/*                        # Card + Button + Input + Label + Select
└── notifications/
    └── ToastContainer.tsx              # Replace with shadcn Toaster
```

---

## File Cross-Reference Matrix (Parallel Awareness)

Each parallel task group only modifies files within its own `panels/<name>/` directory. The only shared dependency is `components/ui/*` (created in Task 0) and `components/layout/*` (refactored in Task 1).

| Task                             | Files Modified                                                                                       | Shared with                               |
| -------------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Task 0: Infrastructure           | `components/ui/*`, `lib/utils.ts`, `package.json`, `components.json`                                 | All tasks depend on this                  |
| Task 1: Layout Shell             | `components/layout/*`                                                                                | All tasks use layout, but don't modify it |
| Task 2: Core Panels              | `panels/chat/*`, `panels/agents/*`, `panels/gateway/*`, `panels/models/*`                            | None                                      |
| Task 3: Observe Panels           | `panels/usage/*`, `panels/sessions/*`, `panels/memory/*`, `panels/logs/*`, `panels/activity/*`       | None                                      |
| Task 4: Automate Panels          | `panels/cron/*`, `panels/webhooks/*`, `panels/approvals/*`, `panels/skills/*`                        | None                                      |
| Task 5: Control Panels           | `panels/budget/*`, `panels/alerts/*`, `panels/channels/*`, `panels/config-editor/*`, `panels/docs/*` | None                                      |
| Task 6: Settings + Onboarding    | `panels/settings/*`, `onboarding/*`, `notifications/*`                                               | None                                      |
| Task 7: Integration Verification | None (read-only)                                                                                     | N/A                                       |

**Conclusion:** Tasks 2-6 are fully parallelizable after Tasks 0+1 complete serially.

---

## Task 0: shadcn/ui Infrastructure Setup [infra]

**Skills:** (none — infrastructure task, no UI design needed)

**Files:**

- Create: `dashboard/src/lib/utils.ts`
- Create: `dashboard/components.json`
- Create: `dashboard/src/components/ui/*.tsx` (15 component files)
- Modify: `dashboard/package.json` (add dependencies)
- Modify: `dashboard/src/app/globals.css` (add shadcn CSS layer)

- [ ] **Step 1: Install shadcn/ui dependencies**

```bash
cd dashboard
pnpm add class-variance-authority clsx tailwind-merge
pnpm add @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-label @radix-ui/react-scroll-area @radix-ui/react-select @radix-ui/react-separator @radix-ui/react-tabs @radix-ui/react-tooltip @radix-ui/react-collapsible @radix-ui/react-slot
```

- [ ] **Step 2: Create cn() utility**

Create `dashboard/src/lib/utils.ts`:

```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 3: Initialize shadcn/ui**

```bash
cd dashboard
npx shadcn@latest init
```

Configure: TypeScript, Tailwind CSS 4, `src/components/ui`, `src/lib/utils`, CSS variables enabled, base color: slate.

- [ ] **Step 4: Add shadcn/ui components**

```bash
npx shadcn@latest add button card input label tabs scroll-area separator badge tooltip dialog dropdown-menu collapsible sheet select
```

- [ ] **Step 5: Resolve CSS variable conflict (CRITICAL)**

shadcn/ui uses different CSS variable names (HSL format) than our existing system (hex/rgba). `npx shadcn@latest init` will inject new variables into `globals.css` that conflict with our existing `:root` and `.dark` blocks.

**Strategy: Keep our existing variable names, add shadcn bridge variables.**

After shadcn init, add the following mapping layer to `globals.css` that bridges shadcn's expected names to our existing values:

```css
/* === shadcn/ui bridge — maps shadcn variable names to our existing theme === */
:root {
  --background: var(--bg-primary);
  --foreground: var(--text-primary);
  --card: var(--bg-secondary);
  --card-foreground: var(--text-primary);
  --popover: var(--bg-primary);
  --popover-foreground: var(--text-primary);
  --primary: var(--accent);
  --primary-foreground: var(--accent-fg);
  --secondary: var(--bg-tertiary);
  --secondary-foreground: var(--text-primary);
  --muted: var(--bg-tertiary);
  --muted-foreground: var(--text-secondary);
  --accent: var(--accent); /* name collision — our --accent is already defined */
  --accent-foreground: var(--accent-fg);
  --destructive: var(--danger);
  --destructive-foreground: var(--danger-fg);
  --border: var(--border); /* same name, keep as-is */
  --input: var(--border);
  --ring: var(--accent);
  --radius: 0.5rem;
}
```

**Important:** Remove any shadcn-generated `:root` / `.dark` CSS variable blocks that conflict with our existing definitions. Our existing light/dark theme blocks remain authoritative. The bridge variables above use `var()` references so they automatically follow our theme switching.

Verify: `--accent` is used by both systems — ensure no circular reference. Our existing `--accent: #3b82f6` is the source of truth; shadcn's `--accent` should resolve to it.

- [ ] **Step 6: Verify build**

```bash
cd dashboard && npx tsc --noEmit && pnpm dev
```

Expected: No TS errors, dev server starts.

- [ ] **Step 7: Commit**

```bash
git add dashboard/src/lib/utils.ts dashboard/components.json dashboard/src/components/ui/ dashboard/package.json dashboard/pnpm-lock.yaml dashboard/src/app/globals.css
git commit -m "[enhanced] feat(deck): install shadcn/ui component library and base primitives"
```

---

## Task 1: Layout Shell Refactor [frontend]

**Skills:** `frontend-design`, `ui-ux-pro-max`

depends: Task 0

**Files:**

- Modify: `dashboard/src/components/layout/NavRail.tsx`
- Modify: `dashboard/src/components/layout/HeaderBar.tsx`
- Modify: `dashboard/src/components/layout/Shell.tsx`

- [ ] **Step 1: Invoke required Skills**

```
Skill(skill='frontend-design')
Skill(skill='ui-ux-pro-max')
```

Read the skill output. Follow its design guidelines for the layout refactoring.

- [ ] **Step 2: Refactor NavRail.tsx**

Replace raw `<button>` elements with shadcn `<Button>` (variant="ghost"), add `<Tooltip>` to collapsed icons, replace mobile overlay with `<Sheet>`, replace expand/collapse with `<Collapsible>`.

Key changes:

- Navigation buttons → `<Button variant="ghost" size="sm">`
- Active state → `<Button variant="ghost" className="bg-accent/10 text-accent">`
- Mobile drawer → `<Sheet>` with `<SheetContent side="left">`
- Section headers → `<Separator>` + styled group labels
- Collapse toggle → `<Collapsible>` or `<Button variant="ghost" size="icon">`

- [ ] **Step 3: Refactor HeaderBar.tsx**

Replace raw elements with shadcn components:

- Status indicator → `<Badge variant="outline">` with colored dot
- Language toggle → `<Button variant="ghost" size="sm">`
- Theme toggle → `<Button variant="ghost" size="icon">`
- Panel title → keep as `<h1>` but style consistently

- [ ] **Step 4: Update Shell.tsx + verify theme compatibility**

Wrap children with `<TooltipProvider>` (required by shadcn Tooltip).

Verify `ThemeScript.tsx` and `ThemeSync.tsx` are compatible with shadcn's `dark` class approach. Our theme system uses CSS class `.dark` on `<html>` — confirm shadcn components respond to it correctly. If shadcn expects `class="dark"` on a different element, adjust `ThemeSync.tsx`.

- [ ] **Step 5: Visual verification**

```bash
cd dashboard && pnpm dev
```

Open http://localhost:3000, verify:

- NavRail renders correctly (expanded + collapsed)
- HeaderBar buttons styled
- Mobile responsive (Sheet opens on small viewport)
- Dark/light theme works

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/components/layout/
git commit -m "[enhanced] feat(deck): refactor layout shell to shadcn/ui components"
```

---

## Task 2: Core Panels Refactor (Chat, Agents, Gateway, Models) [frontend]

**Skills:** `frontend-design`, `ui-ux-pro-max`, `superpowers:test-driven-development`

depends: Task 1

**Files:**

- Modify: `dashboard/src/components/panels/chat/*.tsx` (5 files, 536 LOC)
- Modify: `dashboard/src/components/panels/agents/*.tsx` (3 files, 388 LOC)
- Modify: `dashboard/src/components/panels/gateway/*.tsx` (4 files, 248 LOC)
- Modify: `dashboard/src/components/panels/models/*.tsx` (3 files, 312 LOC)
- Test: `dashboard/src/components/panels/chat/*.test.tsx` (if exists)

**Refactoring pattern (apply to each panel):**

1. Replace `<div className="rounded-lg border p-4" style={{borderColor: "var(--border)", backgroundColor: "var(--bg-secondary)"}}>` → `<Card><CardHeader><CardContent>`
2. Replace `<button style={{backgroundColor: "var(--accent)"}} className="px-2 py-1 rounded-md">` → `<Button variant="default">`
3. Replace `<input style={{...}} className="border rounded px-2">` → `<Input>`
4. Replace raw status spans → `<Badge variant="outline">`
5. Replace `<select>` → `<Select>`
6. Remove all inline `style={{}}` that set colors — use Tailwind classes mapped to CSS variables via shadcn theme

- [ ] **Step 1: Invoke required Skills**

```
Skill(skill='frontend-design')
Skill(skill='ui-ux-pro-max')
```

- [ ] **Step 2: Refactor ChatPanel + subcomponents**

Key components: `MessageInput` (Button + Input), `MessageList` (ScrollArea + Card), `SessionSidebar` (Button + ScrollArea), `ChatPanel` (Card container).

- [ ] **Step 3: Refactor AgentsPanel + subcomponents**

Key: `AgentList` (Button + Badge), `AgentDetail` (Card + Input + Button + Dialog for create/delete).

- [ ] **Step 4: Refactor GatewayPanel + subcomponents**

All 4 files: `GatewayPanel.tsx`, `ConnectionCard.tsx`, `HealthCard.tsx`, `HeartbeatCard.tsx` → all use `<Card>` + `<Badge>`.

- [ ] **Step 5: Refactor ModelsPanel + subcomponents**

Key: `ModelCatalog` (Card + Badge for pricing), `ProviderConfig` (Card + Input + Label + Button).

- [ ] **Step 6: Visual verification**

Navigate to each of the 4 panels, verify rendering in dark + light theme.

- [ ] **Step 7: Run tests**

```bash
cd dashboard && pnpm test
```

- [ ] **Step 8: Commit**

```bash
git add dashboard/src/components/panels/chat/ dashboard/src/components/panels/agents/ dashboard/src/components/panels/gateway/ dashboard/src/components/panels/models/
git commit -m "[enhanced] feat(deck): refactor Core panels to shadcn/ui (Chat, Agents, Gateway, Models)"
```

---

## Task 3: Observe Panels Refactor (Usage, Sessions, Memory, Logs, Activity) [frontend]

**Skills:** `frontend-design`, `ui-ux-pro-max`, `superpowers:test-driven-development`

depends: Task 1

**Files:**

- Modify: `dashboard/src/components/panels/usage/*.tsx` (5 files, 564 LOC)
- Modify: `dashboard/src/components/panels/sessions/*.tsx` (3 files, 446 LOC)
- Modify: `dashboard/src/components/panels/memory/*.tsx` (5 files, 587 LOC)
- Modify: `dashboard/src/components/panels/logs/*.tsx` (4 files incl. `useLogPolling.ts`, 463 LOC)
- Modify: `dashboard/src/components/panels/activity/*.tsx` (3 files incl. `useActivitySSE.ts`, 317 LOC)

- [ ] **Step 1: Invoke required Skills**

```
Skill(skill='frontend-design')
Skill(skill='ui-ux-pro-max')
```

- [ ] **Step 2: Refactor UsagePanel + subcomponents**

`SummaryCards` → `<Card>`, time window buttons → `<Tabs>`, `BreakdownTable` → `<Card>` + `<Tabs>` for model/agent toggle, `ContextPressure` → `<Card>` + `<Badge>`.

- [ ] **Step 3: Refactor SessionsPanel + subcomponents**

`SessionList` → `<ScrollArea>` + `<Button variant="ghost">` + `<Badge>`, `SessionDetail` → `<Card>` with stat grid.

- [ ] **Step 4: Refactor MemoryPanel + subcomponents**

Agent/Scope selectors → `<Select>`, tab navigation → `<Tabs>`, `FileTree` → `<ScrollArea>` + `<Collapsible>`, `SearchPanel` → `<Input>` + `<Card>`.

- [ ] **Step 5: Refactor LogsPanel + subcomponents**

Level filter buttons → `<Tabs>` or `<Button variant="outline">`, log entries → `<ScrollArea>`, log entry rows → `<Badge>` for level.

- [ ] **Step 6: Refactor ActivityPanel + subcomponents**

Agent filter → `<Input>` + `<Select>`, event cards → `<Card>` + `<Badge>`.

- [ ] **Step 7: Visual verification + tests**

```bash
cd dashboard && pnpm test && pnpm dev
```

- [ ] **Step 8: Commit**

```bash
git add dashboard/src/components/panels/usage/ dashboard/src/components/panels/sessions/ dashboard/src/components/panels/memory/ dashboard/src/components/panels/logs/ dashboard/src/components/panels/activity/
git commit -m "[enhanced] feat(deck): refactor Observe panels to shadcn/ui (Usage, Sessions, Memory, Logs, Activity)"
```

---

## Task 4: Automate Panels Refactor (Cron, Webhooks, Approvals, Skills) [frontend]

**Skills:** `frontend-design`, `ui-ux-pro-max`, `superpowers:test-driven-development`

depends: Task 1

**Files:**

- Modify: `dashboard/src/components/panels/cron/*.tsx` (5 files, 549 LOC)
- Modify: `dashboard/src/components/panels/webhooks/*.tsx` (3 files, 567 LOC)
- Modify: `dashboard/src/components/panels/approvals/*.tsx` (5 files incl. `useApprovalsSSE.ts`, 662 LOC)
- Modify: `dashboard/src/components/panels/skills/*.tsx` (3 files, 373 LOC)

- [ ] **Step 1: Invoke required Skills**

```
Skill(skill='frontend-design')
Skill(skill='ui-ux-pro-max')
```

- [ ] **Step 2: Refactor CronPanel + subcomponents**

`JobForm` (286 LOC) → `<Dialog>` + `<Input>` + `<Label>` + `<Select>` + `<Button>`. `JobList` → `<Card>` + `<Badge>`. `RunHistory` → `<ScrollArea>` + `<Badge>`.

- [ ] **Step 3: Refactor WebhooksPanel + subcomponents**

`WebhookForm` → `<Dialog>` + `<Input>` + `<Label>`. `DeliveryHistory` → `<Card>` + `<Badge>`.

- [ ] **Step 4: Refactor ApprovalsPanel + subcomponents**

Tab switching → `<Tabs>`, `PendingList` → `<Card>` + `<Button>`, `PolicyEditor` (311 LOC) → `<Card>` + `<Input>` + `<Label>` + `<Select>`.

- [ ] **Step 5: Refactor SkillsPanel + subcomponents**

Filter buttons → `<Tabs>`, `SkillList` → `<Button variant="ghost">` + `<Badge>`, `SkillConfig` → `<Card>` + `<Input>` + `<Label>` + `<Dialog>`.

- [ ] **Step 6: Visual verification + tests**

```bash
cd dashboard && pnpm test && pnpm dev
```

- [ ] **Step 7: Commit**

```bash
git add dashboard/src/components/panels/cron/ dashboard/src/components/panels/webhooks/ dashboard/src/components/panels/approvals/ dashboard/src/components/panels/skills/
git commit -m "[enhanced] feat(deck): refactor Automate panels to shadcn/ui (Cron, Webhooks, Approvals, Skills)"
```

---

## Task 5: Control Panels Refactor (Budget, Alerts, Channels, Config, Docs) [frontend]

**Skills:** `frontend-design`, `ui-ux-pro-max`, `superpowers:test-driven-development`

depends: Task 1

**Files:**

- Modify: `dashboard/src/components/panels/budget/*.tsx` (4 files, 675 LOC)
- Modify: `dashboard/src/components/panels/alerts/*.tsx` (4 files, 603 LOC)
- Modify: `dashboard/src/components/panels/channels/*.tsx` (3 files, 437 LOC)
- Modify: `dashboard/src/components/panels/config-editor/*.tsx` (4 files, 702 LOC)
- Modify: `dashboard/src/components/panels/docs/*.tsx` (4 files, 402 LOC)

- [ ] **Step 1: Invoke required Skills**

```
Skill(skill='frontend-design')
Skill(skill='ui-ux-pro-max')
```

- [ ] **Step 2: Refactor BudgetPanel + subcomponents**

`RuleForm` (282 LOC) → `<Dialog>` + `<Input>` + `<Label>` + `<Select>`. `RuleList` → `<Card>` + `<Badge>`. `BudgetStatus` → `<Card>`.

- [ ] **Step 3: Refactor AlertsPanel + subcomponents**

Tab switching → `<Tabs>`, `RuleForm` (231 LOC) → `<Dialog>` + `<Input>` + `<Label>` + `<Select>`. `FiredAlertsList` → `<ScrollArea>` + `<Badge>`.

- [ ] **Step 4: Refactor ChannelsPanel + subcomponents**

`ChannelList` → `<Card>` + `<Badge>`, `ChannelDetail` (269 LOC) → `<Card>` + `<Input>` + `<Label>` + `<Button>`.

- [ ] **Step 5: Refactor ConfigPanel + subcomponents**

`SectionNav` → `<ScrollArea>` + `<Button variant="ghost">`. `SchemaForm` (329 LOC, largest component) → `<Card>` + `<Input>` + `<Label>` + `<Select>`. `ConflictDialog` → `<Dialog>`.

- [ ] **Step 6: Refactor DocHubPanel + subcomponents**

`CategoryFilter` → `<Tabs>`, `DocList` → `<Card>` + `<Badge>`, `DocViewer` → `<Card>` + `<ScrollArea>`.

- [ ] **Step 7: Visual verification + tests**

```bash
cd dashboard && pnpm test && pnpm dev
```

- [ ] **Step 8: Commit**

```bash
git add dashboard/src/components/panels/budget/ dashboard/src/components/panels/alerts/ dashboard/src/components/panels/channels/ dashboard/src/components/panels/config-editor/ dashboard/src/components/panels/docs/
git commit -m "[enhanced] feat(deck): refactor Control panels to shadcn/ui (Budget, Alerts, Channels, Config, Docs)"
```

---

## Task 6: Settings + Onboarding + Notifications Refactor [frontend]

**Skills:** `frontend-design`, `ui-ux-pro-max`

depends: Task 1

**Files:**

- Modify: `dashboard/src/components/panels/settings/*.tsx` (5 files, 403 LOC)
- Modify: `dashboard/src/components/onboarding/*.tsx` (4 files, 538 LOC)
- Modify: `dashboard/src/components/notifications/ToastContainer.tsx` (101 LOC)

- [ ] **Step 1: Invoke required Skills**

```
Skill(skill='frontend-design')
Skill(skill='ui-ux-pro-max')
```

- [ ] **Step 2: Refactor SettingsPanel + subcomponents**

`AppearanceSection` → `<Card>` + `<Button>` for theme/language toggles. `ConnectionSection` → `<Card>` + `<Input>` + `<Label>` + `<Button>`. `NotificationSection` → `<Card>` + checkbox (can use native or add shadcn checkbox). `AboutSection` → `<Card>` + `<Badge>` for versions.

- [ ] **Step 3: Refactor OnboardingWizard + steps**

Wizard container → `<Card>` with step indicator. `StepConnection` → `<Input>` + `<Label>` + `<Button>`. `StepProvider` → `<Select>` + `<Input>` + `<Label>`. `StepFirstChat` → `<Input>` + `<Button>`.

- [ ] **Step 4: Replace ToastContainer with shadcn Toaster**

**Migration strategy:** Keep existing Zustand `useNotificationsStore` as the state source, replace only the rendering layer.

1. Replace `ToastContainer.tsx` rendering with shadcn `<Toaster>` component
2. Create a bridge: `useNotificationsStore` → shadcn `toast()` API
3. Existing `addToast(type, message, duration)` calls in panel code remain unchanged — the bridge handles the translation
4. If API is too different, create a thin `useToast()` wrapper that maps `addToast` semantics to shadcn's `toast()` function

Search for all `addToast` call sites to verify none break:

```bash
grep -rn 'addToast\|useNotifications' dashboard/src/ --include='*.tsx' --include='*.ts' | grep -v node_modules
```

- [ ] **Step 5: Visual verification + tests**

```bash
cd dashboard && pnpm test && pnpm dev
```

Verify: Onboarding wizard flow, Settings panel, toast notifications.

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/components/panels/settings/ dashboard/src/components/onboarding/ dashboard/src/components/notifications/
git commit -m "[enhanced] feat(deck): refactor Settings, Onboarding, and Notifications to shadcn/ui"
```

---

## Task 7: Integration Verification [test]

**Skills:** `superpowers:verification-before-completion`, `validate`

depends: Tasks 2-6

**Files:** None (read-only verification)

- [ ] **Step 1: TypeScript check**

```bash
cd dashboard && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Run all tests**

```bash
cd dashboard && pnpm test
```

Expected: 368+ tests passing.

- [ ] **Step 3: Run E2E tests**

```bash
cd dashboard && npx playwright test
```

Expected: 35 E2E tests passing.

- [ ] **Step 4: Visual smoke test — all 19 panels**

Start dev server, navigate to each of the 19 panels + Settings in both dark and light themes. Verify no broken layouts, missing components, or style regressions.

- [ ] **Step 5: Check for remaining inline styles**

```bash
grep -r 'style={{' dashboard/src/components/ --include='*.tsx' | grep -v 'ui/' | wc -l
```

Expected: 0 or near-zero remaining inline style objects (some may be acceptable for dynamic values like Recharts).

- [ ] **Step 6: Check no raw HTML buttons remain**

```bash
grep -rn '<button' dashboard/src/components/ --include='*.tsx' | grep -v 'ui/' | grep -v 'test' | wc -l
```

Expected: 0 (all replaced with shadcn `<Button>`).

- [ ] **Step 7: Commit (if any fixes needed)**

```bash
git add -A
git commit -m "[enhanced] fix(deck): integration fixes for shadcn/ui refactor"
```

---

## Execution Summary

| Phase        | Tasks                   | Mode         | LOC Affected             |
| ------------ | ----------------------- | ------------ | ------------------------ |
| Serial       | Task 0 (Infrastructure) | Single agent | ~50 LOC + auto-generated |
| Serial       | Task 1 (Layout Shell)   | Single agent | 375 LOC                  |
| **Parallel** | **Tasks 2-6 (Panels)**  | **5 agents** | **~9,800 LOC**           |
| Serial       | Task 7 (Integration)    | Single agent | Read-only                |

**Total estimated scope:** ~10,200 LOC modified across 70+ files.

**Parallel execution plan:**

- Phase 0 (Serial): Task 0 → Task 1
- Phase 1 (Parallel): Tasks 2, 3, 4, 5, 6 simultaneously
- Phase 2 (Serial): Task 7 integration verification
