# openclaw-deck P3 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete all 19 panels (Doc Hub + Settings), transplant Memory Enhancement Phase 2, fix 5 deferred P2 findings, and deliver production readiness (responsive, theme, keyboard shortcuts, E2E, performance, i18n, API docs).

**Architecture:** P3 extends the existing P0–P2 architecture. Doc Hub and Settings are new full-stack panels following established patterns (Zustand store → API routes → panel components). Memory Enhancement Phase 2 adds smart-extractor, scopes, and decay-engine to `extensions/memory-lancedb/src/`. Production Readiness polishes all 19 panels for release.

**Tech Stack:** Next.js 16+ / React 19 / Tailwind / Zustand / SQLite / next-intl / Recharts / Playwright (new for E2E)

**Baseline:** 289 tests passing, 18 panels implemented (P2 panels not yet wired in page.tsx), 0 TS errors.

---

## Pre-G2 Parallel Awareness

### Task Summary

| Phase   | Tasks   | Mode            | Agent                              |
| ------- | ------- | --------------- | ---------------------------------- |
| Phase 0 | T1      | Serial          | Team Lead                          |
| Phase 1 | T2–T3   | Parallel        | Agent A: Doc Hub                   |
| Phase 1 | T4–T6   | Parallel        | Agent B: Settings + Deferred Fixes |
| Phase 1 | T7–T10  | Parallel        | Agent C: Memory Enhancement        |
| Phase 2 | T11     | Serial          | Team Lead                          |
| Phase 3 | T12–T17 | Serial/Subagent | Subagent-driven                    |
| Phase 4 | —       | Serial          | L2 Codex Review                    |

### File Ownership Matrix (Phase 1)

| File/Directory                                           | Agent A   | Agent B             | Agent C         |
| -------------------------------------------------------- | --------- | ------------------- | --------------- |
| `dashboard/src/components/panels/docs/`                  | ✅ CREATE |                     |                 |
| `dashboard/src/stores/docs.ts`                           | ✅ CREATE |                     |                 |
| `dashboard/src/app/api/docs/`                            | ✅ CREATE |                     |                 |
| `dashboard/src/components/panels/settings/`              |           | ✅ CREATE           |                 |
| `dashboard/src/stores/settings.ts`                       |           | ✅ CREATE           |                 |
| `dashboard/src/app/api/settings/`                        |           | ✅ CREATE           |                 |
| `dashboard/server/approval-bridge.ts`                    |           | ✅ MODIFY (F7)      |                 |
| `dashboard/server/alert-engine.ts`                       |           | ✅ MODIFY (F11,F12) |                 |
| `dashboard/server/runtime.ts`                            |           | ✅ MODIFY (F10,F12) |                 |
| `dashboard/src/stores/alerts.ts`                         |           | ✅ MODIFY (F9)      |                 |
| `dashboard/src/components/panels/alerts/AlertsPanel.tsx` |           | ✅ MODIFY (F9)      |                 |
| `extensions/memory-lancedb/src/memory-categories.ts`     |           |                     | ✅ CREATE       |
| `extensions/memory-lancedb/src/smart-extractor.ts`       |           |                     | ✅ CREATE       |
| `extensions/memory-lancedb/src/scopes.ts`                |           |                     | ✅ CREATE       |
| `extensions/memory-lancedb/src/decay-engine.ts`          |           |                     | ✅ CREATE       |
| `extensions/memory-lancedb/src/llm-client.ts`            |           |                     | ✅ CREATE       |
| `extensions/memory-lancedb/src/extraction-prompts.ts`    |           |                     | ✅ CREATE       |
| `extensions/memory-lancedb/src/smart-metadata.ts`        |           |                     | ✅ CREATE       |
| `extensions/memory-lancedb/src/workspace-boundary.ts`    |           |                     | ✅ CREATE       |
| `dashboard/src/components/panels/memory/`                |           |                     | ✅ MODIFY (T10) |
| `dashboard/src/stores/memory.ts`                         |           |                     | ✅ MODIFY (T10) |

**Shared files resolved in Phase 0:** `page.tsx` (panel routing), `i18n/*.json` (namespaces), `migrations/` (new schema).

### Deferred P2 Findings (from memory: `project_deck_p2_deferred.md`)

| ID  | Issue                                 | Fix Location                                          | Assigned   |
| --- | ------------------------------------- | ----------------------------------------------------- | ---------- |
| F7  | Pending approval expiry not cleaned   | `approval-bridge.ts`                                  | Agent B T6 |
| F9  | Alerts Fired list no SSE subscription | `alerts.ts`, `AlertsPanel.tsx`                        | Agent B T6 |
| F10 | Webhook retry processor not scheduled | `runtime.ts`                                          | Agent B T6 |
| F11 | alert_rules.condition not evaluated   | `alert-engine.ts`                                     | Agent B T6 |
| F12 | Runtime restart stacks subscribers    | `runtime.ts`, `approval-bridge.ts`, `alert-engine.ts` | Agent B T6 |

---

## Phase 0: Infrastructure & P2 Integration Fix (Serial)

### Task 1: Wire P2 Panels + Pre-allocate P3 Infrastructure

**covers:** tasks.md § 9–11 infrastructure prerequisites

**Files:**

- Modify: `dashboard/src/app/page.tsx` — wire P2 panels + add docs/settings routing
- Modify: `dashboard/src/i18n/zh.json` — add docs + settings sections
- Modify: `dashboard/src/i18n/en.json` — add docs + settings sections
- Create: `dashboard/migrations/005_docs.sql` — Doc Hub schema
- Create: `dashboard/src/stores/docs.ts` — stub with types only
- Create: `dashboard/src/stores/settings.ts` — stub with types only

**Steps:**

- [ ] **Step 1: Wire all P2 panels into page.tsx routing**

Add imports and routing for the 6 P2 panels that are currently showing PanelPlaceholder:

```typescript
// Add to imports in page.tsx
import { CronPanel } from "@/components/panels/cron/CronPanel";
import { WebhooksPanel } from "@/components/panels/webhooks/WebhooksPanel";
import { ApprovalsPanel } from "@/components/panels/approvals/ApprovalsPanel";
import { SkillsPanel } from "@/components/panels/skills/SkillsPanel";
import { BudgetPanel } from "@/components/panels/budget/BudgetPanel";
import { AlertsPanel } from "@/components/panels/alerts/AlertsPanel";

// Add to ActivePanel switch (before the final PanelPlaceholder return):
if (panel === "cron") return <CronPanel />;
if (panel === "webhooks") return <WebhooksPanel />;
if (panel === "approvals") return <ApprovalsPanel />;
if (panel === "skills") return <SkillsPanel />;
if (panel === "budget") return <BudgetPanel />;
if (panel === "alerts") return <AlertsPanel />;
```

- [ ] **Step 2: Create SQLite migration 005_docs.sql**

```sql
-- 005_docs.sql: Doc Hub document storage
CREATE TABLE IF NOT EXISTS docs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('summary','plan','spec','manual','draft')),
  content TEXT NOT NULL,
  source_session TEXT,
  source_agent TEXT,
  keywords TEXT NOT NULL DEFAULT '[]',
  language TEXT NOT NULL DEFAULT 'zh',
  extracted_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_docs_category ON docs(category);
CREATE INDEX IF NOT EXISTS idx_docs_extracted_at ON docs(extracted_at DESC);
```

- [ ] **Step 3: Pre-allocate i18n namespaces for docs and settings**

Add to both `zh.json` and `en.json`:

```json
{
  "docs": {
    "title": "文档中心" / "Doc Hub",
    "search": "搜索文档..." / "Search docs...",
    "category": {
      "all": "全部" / "All",
      "summary": "总结" / "Summary",
      "plan": "计划" / "Plan",
      "spec": "规范" / "Spec",
      "manual": "手册" / "Manual",
      "draft": "草稿" / "Draft"
    },
    "extract": "提取文档" / "Extract Docs",
    "noResults": "暂无文档" / "No documents yet",
    "source": "来源" / "Source",
    "extractedAt": "提取时间" / "Extracted at",
    "delete": "删除文档" / "Delete document",
    "confirmDelete": "确认删除此文档？" / "Delete this document?"
  },
  "settings": {
    "title": "设置" / "Settings",
    "appearance": "外观" / "Appearance",
    "theme": "主题" / "Theme",
    "themeSystem": "跟随系统" / "System",
    "themeDark": "深色" / "Dark",
    "themeLight": "浅色" / "Light",
    "language": "语言" / "Language",
    "connection": "连接" / "Connection",
    "gatewayUrl": "Gateway 地址" / "Gateway URL",
    "gatewayToken": "Gateway Token" / "Gateway Token",
    "testConnection": "测试连接" / "Test Connection",
    "notifications": "通知" / "Notifications",
    "notifyApprovals": "审批请求通知" / "Approval request notifications",
    "notifyBudget": "预算告警通知" / "Budget alert notifications",
    "notifyAlerts": "规则告警通知" / "Rule alert notifications",
    "about": "关于" / "About",
    "deckVersion": "Deck 版本" / "Deck Version",
    "gatewayVersion": "Gateway 版本" / "Gateway Version",
    "cliVersion": "CLI 版本" / "CLI Version",
    "docs": "文档" / "Documentation",
    "github": "GitHub",
    "saved": "设置已保存" / "Settings saved"
  },
  "memory": {
    "scope": "作用域" / "Scope",
    "scopeGlobal": "全局" / "Global",
    "scopeAgent": "智能体" / "Agent",
    "tierCore": "核心" / "Core",
    "tierWorking": "工作" / "Working",
    "tierPeripheral": "外围" / "Peripheral",
    "decayScore": "衰减分数" / "Decay Score"
  }
}
```

> **Codex Review Fix (R1-F1):** Memory scope/tier i18n keys pre-allocated here (Phase 0) to prevent Agent C from modifying i18n files during Phase 1 parallel execution.

- [ ] **Step 4: Create docs store stub (types only)**

```typescript
// dashboard/src/stores/docs.ts
import { create } from "zustand";

export type DocCategory = "summary" | "plan" | "spec" | "manual" | "draft";

export interface Doc {
  id: string;
  title: string;
  category: DocCategory;
  content: string;
  sourceSession?: string;
  sourceAgent?: string;
  keywords: string[];
  language: string;
  extractedAt: string;
  updatedAt: string;
}

interface DocsState {
  docs: Doc[];
  selectedDoc: Doc | null;
  filterCategory: DocCategory | "all";
  searchQuery: string;
  loading: boolean;
  error: string | null;
  // Methods implemented in T2
  setFilterCategory: (cat: DocCategory | "all") => void;
  setSearchQuery: (q: string) => void;
  setSelectedDoc: (doc: Doc | null) => void;
  fetchDocs: () => Promise<void>;
  extractDocs: (sessionKey?: string) => Promise<void>;
  deleteDoc: (id: string) => Promise<void>;
}

export const useDocsStore = create<DocsState>((set) => ({
  docs: [],
  selectedDoc: null,
  filterCategory: "all",
  searchQuery: "",
  loading: false,
  error: null,
  setFilterCategory: (filterCategory) => set({ filterCategory }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSelectedDoc: (selectedDoc) => set({ selectedDoc }),
  fetchDocs: async () => {
    /* T2 */
  },
  extractDocs: async () => {
    /* T2 */
  },
  deleteDoc: async () => {
    /* T2 */
  },
}));
```

- [ ] **Step 5: Create settings store stub (types only)**

```typescript
// dashboard/src/stores/settings.ts
import { create } from "zustand";

export interface NotificationPrefs {
  approvals: boolean;
  budget: boolean;
  alerts: boolean;
}

export interface VersionInfo {
  deck: string;
  gateway: string;
  cli: string;
}

interface SettingsState {
  gatewayUrl: string;
  gatewayToken: string;
  notificationPrefs: NotificationPrefs;
  versionInfo: VersionInfo | null;
  loading: boolean;
  error: string | null;
  // Methods implemented in T4
  fetchSettings: () => Promise<void>;
  saveSettings: (
    patch: Partial<{
      gatewayUrl: string;
      gatewayToken: string;
      notificationPrefs: NotificationPrefs;
    }>,
  ) => Promise<void>;
  fetchVersionInfo: () => Promise<void>;
  testConnection: () => Promise<boolean>;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  gatewayUrl: "",
  gatewayToken: "",
  notificationPrefs: { approvals: true, budget: true, alerts: true },
  versionInfo: null,
  loading: false,
  error: null,
  fetchSettings: async () => {
    /* T4 */
  },
  saveSettings: async () => {
    /* T4 */
  },
  fetchVersionInfo: async () => {
    /* T4 */
  },
  testConnection: async () => false,
}));
```

- [ ] **Step 6: Verify — tsc --noEmit + pnpm test**

Run: `cd dashboard && npx tsc --noEmit && pnpm test`
Expected: 0 TS errors, 289+ tests passing.

- [ ] **Step 7: Commit Phase 0**

```bash
git add dashboard/src/app/page.tsx dashboard/src/i18n/ dashboard/migrations/005_docs.sql \
  dashboard/src/stores/docs.ts dashboard/src/stores/settings.ts
git commit -m "[enhanced] [impl] feat(deck): P3 Phase 0 — wire P2 panels + docs/settings infrastructure"
```

---

## Phase 1: Core Features (Parallel — 3 Agents)

---

### Agent A: Doc Hub

---

### Task 2: Doc Hub Backend — Store + API Routes + Extraction Logic

**covers:** tasks.md 9.1 (auto-extract), 9.2 (categorization), 9.4 (API routes)

**Skills:** `superpowers:test-driven-development`

**Files:**

- Modify: `dashboard/src/stores/docs.ts` — implement fetch/extract/delete methods
- Create: `dashboard/src/app/api/docs/route.ts` — GET (list+search) / POST (extract) / DELETE
- Create: `dashboard/src/app/api/docs/[docId]/route.ts` — GET (single) / DELETE
- Create: `dashboard/src/lib/doc-extractor.ts` — extraction + categorization engine
- Create: `dashboard/src/lib/__tests__/doc-extractor.test.ts`
- Create: `dashboard/src/stores/__tests__/docs.test.ts`

**Doc Extractor Design:**

The extraction engine uses keyword + heuristic-based categorization (no LLM dependency):

```typescript
// dashboard/src/lib/doc-extractor.ts

export type DocCategory = "summary" | "plan" | "spec" | "manual" | "draft";

interface ExtractionResult {
  title: string;
  category: DocCategory;
  content: string;
  keywords: string[];
  language: "zh" | "en";
}

// Category detection keywords (zh + en)
const CATEGORY_KEYWORDS: Record<DocCategory, string[]> = {
  summary: ["总结", "摘要", "概要", "小结", "summary", "recap", "overview", "conclusion"],
  plan: [
    "计划",
    "方案",
    "路线图",
    "里程碑",
    "plan",
    "roadmap",
    "milestone",
    "timeline",
    "schedule",
  ],
  spec: [
    "规范",
    "规格",
    "接口",
    "协议",
    "API",
    "spec",
    "specification",
    "protocol",
    "schema",
    "contract",
  ],
  manual: ["手册", "教程", "指南", "步骤", "manual", "guide", "tutorial", "how-to", "instructions"],
  draft: ["草稿", "初稿", "想法", "draft", "idea", "brainstorm", "notes"],
};

export function categorizeContent(text: string): DocCategory;
export function extractTitle(text: string): string;
export function detectLanguage(text: string): "zh" | "en";
export function extractKeywords(text: string, category: DocCategory): string[];
export function extractDocsFromMessages(
  messages: Array<{ role: string; content: string }>,
): ExtractionResult[];
```

**Categorization algorithm:**

1. Split conversation into message blocks
2. For each assistant message with substantive content (> 200 chars):
   - Count keyword matches per category
   - Check structural patterns (markdown headings, code blocks, lists)
   - Assign highest-scoring category; default to "draft"
3. Extract title from first heading or first sentence
4. Detect language by Unicode range ratio (CJK vs Latin)
5. Extract keywords using category-specific term frequency

**API Routes:**

```
GET  /api/docs?category=plan&q=search-term  → { docs: Doc[] }
POST /api/docs/extract  { sessionKey?: string }  → { extracted: number, docs: Doc[] }
GET  /api/docs/[docId]  → Doc
DELETE /api/docs/[docId]  → { ok: true }
```

**Steps:**

- [ ] **Step 1: Write doc-extractor tests**

Test categorization for each of the 5 categories (zh + en keywords), title extraction, language detection, keyword extraction. ~10 test cases.

- [ ] **Step 2: Run tests — verify they fail**

- [ ] **Step 3: Implement doc-extractor.ts**

~150 LOC. Pure functions, no side effects.

- [ ] **Step 4: Run tests — verify they pass**

- [ ] **Step 5: Write docs store tests**

Test fetchDocs, extractDocs, deleteDoc, filtering by category and search query.

- [ ] **Step 6: Implement docs store methods**

```typescript
fetchDocs: async () => {
  set({ loading: true, error: null });
  const { filterCategory, searchQuery } = get();
  const params = new URLSearchParams();
  if (filterCategory !== "all") params.set("category", filterCategory);
  if (searchQuery) params.set("q", searchQuery);
  const res = await fetch(`/api/docs?${params}`);
  if (!res.ok) { /* error handling */ }
  const data = await res.json();
  set({ docs: data.docs, loading: false });
},

extractDocs: async (sessionKey) => {
  set({ loading: true, error: null });
  const res = await fetch("/api/docs/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionKey }),
  });
  if (!res.ok) { /* error handling */ }
  const data = await res.json();
  // Refresh list after extraction
  await get().fetchDocs();
},
```

- [ ] **Step 7: Implement API routes**

`GET /api/docs/route.ts`: Query SQLite `docs` table with optional `category` and `q` (LIKE on title+content+keywords).

`POST /api/docs/extract/route.ts`: Read conversation history (via `chat.history` Gateway RPC or local sessions), run `extractDocsFromMessages()`, insert results into SQLite.

`GET /api/docs/[docId]/route.ts`: Fetch single doc by ID.

`DELETE /api/docs/[docId]/route.ts`: Delete doc by ID.

Platform contract: Accept `X-Tenant-Id` / `X-User-Id` headers.

- [ ] **Step 8: Run all tests — verify passing**

- [ ] **Step 9: Commit**

```bash
git commit -m "[enhanced] [impl] feat(deck): add Doc Hub backend — extraction engine + store + API routes"
```

---

### Task 3: Doc Hub Frontend — Panel Components

**covers:** tasks.md 9.3 (search and browse interface)

**Skills:** `frontend-design`, `superpowers:test-driven-development`

**Files:**

- Create: `dashboard/src/components/panels/docs/DocHubPanel.tsx` — main container
- Create: `dashboard/src/components/panels/docs/DocList.tsx` — filterable document list
- Create: `dashboard/src/components/panels/docs/DocViewer.tsx` — document content viewer
- Create: `dashboard/src/components/panels/docs/CategoryFilter.tsx` — category tab bar

**Design:**

```
┌─────────────────────────────────────────────────┐
│ Doc Hub                          [Extract Docs ▶]│
├─────────────────────────────────────────────────┤
│ [All] [Summary] [Plan] [Spec] [Manual] [Draft]  │
├──────────────────┬──────────────────────────────┤
│ 🔍 Search docs...│                              │
│                  │                              │
│ ┌──────────────┐ │  Document Title              │
│ │ ● Plan       │ │  ─────────────               │
│ │ Title...     │ │                              │
│ │ 2026-03-17   │ │  Full markdown content       │
│ └──────────────┘ │  rendered with react-markdown │
│ ┌──────────────┐ │                              │
│ │ ○ Summary    │ │  Keywords: [tag1] [tag2]     │
│ │ Title...     │ │  Source: session-abc          │
│ │ 2026-03-16   │ │  Extracted: 2026-03-17       │
│ └──────────────┘ │                              │
│                  │  [Delete]                     │
└──────────────────┴──────────────────────────────┘
```

**CategoryFilter:** Horizontal tab bar with count badges per category.

**DocList:** Left pane — filtered+searched list, sorted by extractedAt DESC. Each card shows category badge (colored), title, date.

**DocViewer:** Right pane — full markdown rendering (reuse react-markdown from Chat), metadata footer, delete button.

**DocHubPanel:** 2-column layout (list + viewer), extract button in header, empty state.

**Steps:**

- [ ] **Step 1: Implement CategoryFilter.tsx**

Horizontal tabs: All / Summary / Plan / Spec / Manual / Draft. Uses `useDocsStore.filterCategory` and `setFilterCategory`. Count badges from `docs` array.

- [ ] **Step 2: Implement DocList.tsx**

Card list with category badge (colored dot), title, date. Click sets `selectedDoc`. Uses `useDocsStore.docs`, applies `filterCategory` and `searchQuery` client-side filtering.

- [ ] **Step 3: Implement DocViewer.tsx**

Markdown rendering with `react-markdown` + `remark-gfm`. Shows title, category badge, keywords as tags, source session link, extracted date. Delete button with confirmation.

- [ ] **Step 4: Implement DocHubPanel.tsx**

Container layout: header with title + extract button, category filter, 2-column body (list + viewer). Calls `fetchDocs()` on mount. Empty state when no docs.

- [ ] **Step 5: Verify — all Doc Hub components render correctly**

- [ ] **Step 6: Commit**

```bash
git commit -m "[enhanced] [impl] feat(deck): add Doc Hub frontend — panel + list + viewer + category filter"
```

---

### Agent B: Settings + Deferred P2 Fixes

---

### Task 4: Settings Backend — Store + API Routes

**covers:** tasks.md 9.5 (preferences), 9.7 (API routes)

**Skills:** `superpowers:test-driven-development`

**Files:**

- Modify: `dashboard/src/stores/settings.ts` — implement all methods
- Create: `dashboard/src/app/api/settings/route.ts` — GET / PATCH
- Create: `dashboard/src/app/api/settings/version/route.ts` — GET version info
- Create: `dashboard/src/app/api/settings/test-connection/route.ts` — POST test
- Create: `dashboard/src/stores/__tests__/settings.test.ts`

**Data sources:**

| Setting            | Storage                          | Read                    | Write           |
| ------------------ | -------------------------------- | ----------------------- | --------------- |
| Theme              | Zustand (`ui.ts`) + localStorage | Client-side             | Client-side     |
| Language           | Zustand (`ui.ts`) + localStorage | Client-side             | Client-side     |
| Gateway URL        | SQLite `settings` table          | `/api/settings`         | `/api/settings` |
| Gateway Token      | SQLite `settings` table          | `/api/settings`         | `/api/settings` |
| Notification prefs | SQLite `settings` table          | `/api/settings`         | `/api/settings` |
| Deck version       | `package.json`                   | `/api/settings/version` | Read-only       |
| Gateway version    | Gateway adapter status           | `/api/settings/version` | Read-only       |
| CLI version        | Gateway adapter status           | `/api/settings/version` | Read-only       |

**API Routes:**

```
GET   /api/settings           → { gatewayUrl, notificationPrefs }
PATCH /api/settings           { gatewayUrl?, gatewayToken?, notificationPrefs? } → { ok: true }
GET   /api/settings/version   → { deck: string, gateway: string, cli: string }
POST  /api/settings/test-connection  { url, token } → { ok: boolean, error?: string }
```

**Version info resolution:**

- `deck`: Read from `package.json` version field (static import or fs.readFileSync)
- `gateway`: From `getRuntime().adapter` status response (if connected; else "unknown")
- `cli`: From Gateway status metadata (the Gateway knows the CLI version that launched it; if unavailable, "unknown")

**Steps:**

- [ ] **Step 1: Write settings store tests**

Test fetchSettings, saveSettings, fetchVersionInfo, testConnection.

- [ ] **Step 2: Implement settings store**

```typescript
fetchSettings: async () => {
  set({ loading: true, error: null });
  const res = await fetch("/api/settings");
  if (!res.ok) { set({ error: "Failed", loading: false }); return; }
  const data = await res.json();
  set({
    gatewayUrl: data.gatewayUrl ?? "",
    gatewayToken: data.gatewayToken ? "••••••" : "",
    notificationPrefs: data.notificationPrefs ?? { approvals: true, budget: true, alerts: true },
    loading: false,
  });
},

saveSettings: async (patch) => {
  const res = await fetch("/api/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) { /* error */ }
  // Re-fetch to confirm
  await get().fetchSettings();
},

fetchVersionInfo: async () => {
  const res = await fetch("/api/settings/version");
  if (!res.ok) { set({ versionInfo: null }); return; }
  const data = await res.json();
  set({ versionInfo: data });
},

testConnection: async () => {
  const { gatewayUrl, gatewayToken } = get();
  const res = await fetch("/api/settings/test-connection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: gatewayUrl, token: gatewayToken }),
  });
  const data = await res.json();
  return data.ok === true;
},
```

- [ ] **Step 3: Implement API routes**

`GET /api/settings`: Read `gatewayUrl`, `notificationPrefs` from SQLite settings table (`db.prepare("SELECT key, value FROM settings WHERE key IN (...)").all()`).

`PATCH /api/settings`: Update settings in SQLite. If `gatewayUrl` or `gatewayToken` changed, trigger runtime reconnection.

`GET /api/settings/version`: Read deck version from package.json, gateway/cli from adapter.

`POST /api/settings/test-connection`: Create temporary WS connection to provided URL+token, return success/failure.

- [ ] **Step 4: Run tests — verify passing**

- [ ] **Step 5: Commit**

```bash
git commit -m "[enhanced] [impl] feat(deck): add Settings backend — store + API routes + version info"
```

---

### Task 5: Settings Frontend — Panel Components

**covers:** tasks.md 9.5 (preferences), 9.6 (version info + links)

**Skills:** `frontend-design`, `superpowers:test-driven-development`

**Files:**

- Create: `dashboard/src/components/panels/settings/SettingsPanel.tsx` — main container
- Create: `dashboard/src/components/panels/settings/AppearanceSection.tsx` — theme + language
- Create: `dashboard/src/components/panels/settings/ConnectionSection.tsx` — gateway config
- Create: `dashboard/src/components/panels/settings/NotificationSection.tsx` — notification prefs
- Create: `dashboard/src/components/panels/settings/AboutSection.tsx` — version + links

**Design:**

```
┌────────────────────────────────────────────────┐
│ Settings                                        │
├────────────────────────────────────────────────┤
│                                                 │
│  Appearance                                     │
│  ┌─────────────────────────────────────┐       │
│  │ Theme:  [System ▼] [Dark] [Light]   │       │
│  │ Language: [中文 ▼] / [English]       │       │
│  └─────────────────────────────────────┘       │
│                                                 │
│  Connection                                     │
│  ┌─────────────────────────────────────┐       │
│  │ Gateway URL: [ws://localhost:18789] │       │
│  │ Token:       [••••••]              │       │
│  │              [Test Connection] [Save]│       │
│  └─────────────────────────────────────┘       │
│                                                 │
│  Notifications                                  │
│  ┌─────────────────────────────────────┐       │
│  │ ☑ Approval request notifications    │       │
│  │ ☑ Budget alert notifications        │       │
│  │ ☑ Rule alert notifications          │       │
│  └─────────────────────────────────────┘       │
│                                                 │
│  About                                          │
│  ┌─────────────────────────────────────┐       │
│  │ Deck: 0.1.0  Gateway: 2026.3.10    │       │
│  │ CLI: 2026.3.10                      │       │
│  │ [Documentation] [GitHub]            │       │
│  └─────────────────────────────────────┘       │
│                                                 │
└────────────────────────────────────────────────┘
```

**AppearanceSection:** Theme toggle (3 buttons: System/Dark/Light) — reads/writes `useUIStore.theme` + `setTheme`. Language toggle — reads/writes `useUIStore.locale` + `setLocale`. These are client-side only (no API call).

**ConnectionSection:** Gateway URL + Token inputs, Test Connection button (calls `testConnection()`), Save button (calls `saveSettings()`). Shows connection status indicator.

**NotificationSection:** 3 checkboxes for approval/budget/alert notifications. Saves to `useSettingsStore.saveSettings({ notificationPrefs })`.

**AboutSection:** Version badges (deck/gateway/cli). External links: Documentation (https://docs.openclaw.ai), GitHub (https://github.com/openclaw/openclaw).

**Steps:**

- [ ] **Step 1: Implement AppearanceSection.tsx**

Theme: 3-button group reading `useUIStore().theme`, calling `setTheme()`.
Language: 2-button group reading `useUIStore().locale`, calling `setLocale()`.

- [ ] **Step 2: Implement ConnectionSection.tsx**

Controlled inputs for URL + token. Test Connection calls `useSettingsStore().testConnection()`, shows success/failure toast. Save calls `saveSettings()`.

- [ ] **Step 3: Implement NotificationSection.tsx**

3 checkbox inputs bound to `useSettingsStore().notificationPrefs`.

- [ ] **Step 4: Implement AboutSection.tsx**

Calls `fetchVersionInfo()` on mount, displays badges. External links as `<a target="_blank">`.

- [ ] **Step 5: Implement SettingsPanel.tsx**

Vertical stack of 4 sections. Calls `fetchSettings()` + `fetchVersionInfo()` on mount. Uses i18n `settings.*` keys.

- [ ] **Step 6: Verify visual correctness**

- [ ] **Step 7: Commit**

```bash
git commit -m "[enhanced] [impl] feat(deck): add Settings frontend — appearance, connection, notifications, about"
```

---

### Task 6: Fix Deferred P2 Findings (F7, F9, F10, F11, F12)

**covers:** project_deck_p2_deferred.md — all 5 findings

**Skills:** `superpowers:test-driven-development`

**Files:**

- Modify: `dashboard/server/approval-bridge.ts` — F7 (expiry cleanup) + F12 (cleanup function)
- Modify: `dashboard/server/alert-engine.ts` — F11 (condition eval) + F12 (cleanup function)
- Modify: `dashboard/server/runtime.ts` — F10 (webhook retry) + F12 (call cleanup on shutdown)
- Modify: `dashboard/src/stores/alerts.ts` — F9 (addFiredAlert integration)
- Modify: `dashboard/src/components/panels/alerts/AlertsPanel.tsx` — F9 (SSE subscription)
- Create: `dashboard/server/__tests__/approval-bridge.test.ts`
- Create: `dashboard/server/__tests__/alert-engine.test.ts`

**F7 Fix: Pending approval expiry cleanup**

Add a timer in `initApprovalBridge` that scans the pending Map every 30 seconds and removes entries where `expiresAtMs < Date.now()`:

```typescript
// In initApprovalBridge():
const expiryTimer = setInterval(() => {
  const now = Date.now();
  for (const [id, approval] of pendingMap) {
    if (approval.expiresAtMs && approval.expiresAtMs < now) {
      pendingMap.delete(id);
    }
  }
}, 30_000);

// Return cleanup:
return () => {
  clearInterval(expiryTimer);
  // ... unsubscribe EventBus
};
```

**F9 Fix: Alerts SSE subscription**

Extend the existing global `useNotificationSSE` hook to listen for `alert.fired` events and route them to the alerts store. Do NOT create a new EventSource in AlertsPanel (would duplicate the global SSE connection — Codex Review Fix R1-F4).

```typescript
// In useNotificationSSE.ts — add alongside existing event listeners:
es.addEventListener("alert.fired", (e) => {
  const data = JSON.parse(e.data);
  // Dynamic import to avoid circular deps
  import("@/stores/alerts").then(({ useAlertsStore }) => {
    useAlertsStore.getState().addFiredAlert(data);
  });
});
```

This reuses the single global SSE connection established in `page.tsx` line 77.

**F10 Fix: Webhook retry processor scheduling**

In `runtime.ts` `initRuntime()`, add:

```typescript
// Use dynamic import for consistency with alert-engine.ts pattern (Codex Review Fix R1-F2)
const retryTimer = setInterval(async () => {
  const { processWebhookRetries } = await import("../src/lib/webhooks.js");
  processWebhookRetries(runtime.db).catch(() => {});
}, 60_000);

// Store for cleanup in shutdownRuntime
```

**F11 Fix: alert_rules.condition evaluation**

In `alert-engine.ts`, replace `value >= threshold` with proper condition parsing:

```typescript
function evaluateCondition(value: number, condition: string, threshold: number): boolean {
  switch (condition) {
    case ">":
      return value > threshold;
    case ">=":
      return value >= threshold;
    case "<":
      return value < threshold;
    case "<=":
      return value <= threshold;
    case "==":
      return value === threshold;
    case "!=":
      return value !== threshold;
    case "contains":
      return String(value).includes(String(threshold));
    default:
      return value >= threshold; // backward compat
  }
}
```

**F12 Fix: Subscriber cleanup on restart**

Make `initApprovalBridge` and `initAlertEngine` return cleanup functions. Store them in runtime. Call in `shutdownRuntime`:

```typescript
// runtime.ts changes (Codex Review Fix R1-F3: use globalThis for HMR safety):
// Store cleanup refs alongside the runtime singleton on globalThis
const g = globalThis as Record<string, unknown>;

// In initRuntime():
g.__deckCleanupApproval = initApprovalBridge(runtime);
g.__deckCleanupAlerts = initAlertEngine(runtime);

// In shutdownRuntime():
(g.__deckCleanupApproval as (() => void) | undefined)?.();
(g.__deckCleanupAlerts as (() => void) | undefined)?.();
clearInterval(retryTimer);
g.__deckCleanupApproval = undefined;
g.__deckCleanupAlerts = undefined;
```

**Steps:**

- [ ] **Step 1: Write tests for approval-bridge expiry cleanup (F7)**
- [ ] **Step 2: Implement F7 — add expiry timer + cleanup return**
- [ ] **Step 3: Write tests for condition evaluation (F11)**
- [ ] **Step 4: Implement F11 — evaluateCondition with condition parsing**
- [ ] **Step 5: Implement F12 — make init functions return cleanup, wire into shutdown**
- [ ] **Step 6: Implement F10 — add webhook retry setInterval in runtime**
- [ ] **Step 7: Implement F9 — add SSE subscription in AlertsPanel**
- [ ] **Step 8: Run all tests — verify passing**
- [ ] **Step 9: Commit**

```bash
git commit -m "[enhanced] [impl] fix(deck): address 5 deferred P2 findings — expiry, SSE, retry, condition, cleanup"
```

---

### Agent C: Memory Enhancement Phase 2

---

### Task 7: Foundation Transplants — Categories, Metadata, Prompts, Boundary

**covers:** tasks.md 10.1 (smart-extractor dependencies)

**Skills:** `superpowers:test-driven-development`

**Source → Target mapping:**

| Source (vendor/memory-lancedb-pro/src/) | Target (extensions/memory-lancedb/src/) | LOC  | Adaptation                                              |
| --------------------------------------- | --------------------------------------- | ---- | ------------------------------------------------------- |
| `memory-categories.ts`                  | `memory-categories.ts`                  | 86   | Direct port                                             |
| `extraction-prompts.ts`                 | `extraction-prompts.ts`                 | ~215 | Direct port                                             |
| `smart-metadata.ts`                     | `smart-metadata.ts`                     | ~542 | Direct port, extends existing `smart-metadata-types.ts` |
| `workspace-boundary.ts`                 | `workspace-boundary.ts`                 | ~150 | Direct port                                             |

**Files:**

- Create: `extensions/memory-lancedb/src/memory-categories.ts`
- Create: `extensions/memory-lancedb/src/extraction-prompts.ts`
- Create: `extensions/memory-lancedb/src/smart-metadata.ts`
- Create: `extensions/memory-lancedb/src/workspace-boundary.ts`
- Create: `extensions/memory-lancedb/src/__tests__/memory-categories.test.ts`
- Create: `extensions/memory-lancedb/src/__tests__/smart-metadata.test.ts`

**Steps:**

- [ ] **Step 1: Write tests for memory-categories**

Test normalizeCategory, MEMORY_CATEGORIES array, category set membership.

- [ ] **Step 2: Transplant memory-categories.ts**

Direct port from vendor. 86 LOC. Exports: `MEMORY_CATEGORIES`, `MemoryCategory`, `MemoryTier`, `CandidateMemory`, `DedupDecision`, `DedupResult`, `ExtractionStats`, `normalizeCategory`, and the category set constants.

- [ ] **Step 3: Write tests for smart-metadata**

Test parseSmartMetadata, stringifySmartMetadata, buildSmartMetadata, deriveFactKey, appendRelation, updateSupportStats.

- [ ] **Step 4: Transplant smart-metadata.ts**

Direct port. ~542 LOC. Import types from existing `smart-metadata-types.ts`.

- [ ] **Step 5: Transplant extraction-prompts.ts**

Direct port. ~215 LOC. Pure string template functions: `buildExtractionPrompt`, `buildDedupPrompt`, `buildMergePrompt`.

- [ ] **Step 6: Transplant workspace-boundary.ts**

Direct port. ~150 LOC. `isUserMdExclusiveMemory`, `WorkspaceBoundaryConfig`.

- [ ] **Step 7: Run tests — verify passing**

- [ ] **Step 8: Commit**

```bash
git commit -m "[enhanced] feat(memory-lancedb): transplant foundation modules — categories, metadata, prompts, boundary"
```

---

### Task 8: Core Transplants — LLM Client + Smart Extractor

**covers:** tasks.md 10.1 (smart-extractor: LLM-driven 6-class extraction + 7-type dedup)

**Skills:** `superpowers:test-driven-development`

**Source → Target:**

| Source               | Target               | LOC   | Adaptation                                                                                        |
| -------------------- | -------------------- | ----- | ------------------------------------------------------------------------------------------------- |
| `llm-client.ts`      | `llm-client.ts`      | ~180  | Replace `openai` import with OpenAI-compatible fetch (avoid adding `openai` npm dep to extension) |
| `smart-extractor.ts` | `smart-extractor.ts` | ~1041 | Update imports to local modules                                                                   |

**LLM Client adaptation:**

The vendor version imports `openai` npm package. The extension should use a lightweight fetch-based client to avoid adding a heavy dependency:

```typescript
// Replacement: use fetch against OpenAI-compatible API
export function createLlmClient(config: LlmClientConfig): LlmClient {
  return {
    async completeJson<T>(prompt: string, label?: string): Promise<T | null> {
      const res = await fetch(`${config.baseURL ?? "https://api.openai.com"}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(config.timeoutMs ?? 30_000),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content ?? "";
      return JSON.parse(extractJsonFromResponse(text) ?? "null");
    },
    getLastError: () => null,
  };
}
```

**Files:**

- Create: `extensions/memory-lancedb/src/llm-client.ts`
- Create: `extensions/memory-lancedb/src/smart-extractor.ts`
- Create: `extensions/memory-lancedb/src/__tests__/llm-client.test.ts`
- Create: `extensions/memory-lancedb/src/__tests__/smart-extractor.test.ts`

**Steps:**

- [ ] **Step 1: Write tests for llm-client**

Test JSON extraction from markdown fences, balanced brace extraction, error handling.

- [ ] **Step 2: Implement llm-client.ts**

Fetch-based OpenAI-compatible client. ~100 LOC. No `openai` npm dependency.

- [ ] **Step 3: Write tests for smart-extractor**

Test extraction pipeline end-to-end with mocked LLM client and embedder. Test dedup decisions for all 7 types.

- [ ] **Step 4: Transplant smart-extractor.ts**

Update imports: `./store.js` → `./store-types.js`, `./embedder.js` → `./embedder.js` (already present), `./llm-client.js` → `./llm-client.js` (just created), etc.

Key constants preserved:

- `SIMILARITY_THRESHOLD = 0.7`
- `MAX_SIMILAR_FOR_PROMPT = 3`
- `MAX_MEMORIES_PER_EXTRACTION = 5`

- [ ] **Step 5: Run tests — verify passing**

- [ ] **Step 6: Commit**

```bash
git commit -m "[enhanced] feat(memory-lancedb): transplant smart-extractor + llm-client — 6-class extraction, 7-type dedup"
```

---

### Task 9: Utility Transplants — Scopes + Decay Engine

**covers:** tasks.md 10.2 (scopes: 5 scope modes), 10.3 (decay-engine: Weibull, 3-tier)

**Skills:** `superpowers:test-driven-development`

**Source → Target:**

| Source            | Target            | LOC | Adaptation                                                         |
| ----------------- | ----------------- | --- | ------------------------------------------------------------------ |
| `scopes.ts`       | `scopes.ts`       | 373 | Direct port (zero deps)                                            |
| `decay-engine.ts` | `decay-engine.ts` | 228 | Direct port, import `MemoryTier` from local `memory-categories.ts` |

**Files:**

- Create: `extensions/memory-lancedb/src/scopes.ts`
- Create: `extensions/memory-lancedb/src/decay-engine.ts`
- Create: `extensions/memory-lancedb/src/__tests__/scopes.test.ts`
- Create: `extensions/memory-lancedb/src/__tests__/decay-engine.test.ts`

**Scopes — 5 modes:**

1. `global` — shared across all agents (always exists, immutable)
2. `agent:{agentId}` — private per agent
3. `custom:{name}` — user-defined
4. `project:{projectId}` — project isolation
5. `user:{userId}` — user isolation

**Decay Engine — Weibull decay with 3 tiers:**

- Core (β=0.8): slow decay, floor=0.9
- Working (β=1.0): standard decay, floor=0.7
- Peripheral (β=1.3): fast decay, floor=0.5
- Composite = 0.4×recency + 0.3×frequency + 0.3×intrinsic
- Stale threshold: composite < 0.3

**Steps:**

- [ ] **Step 1: Write tests for scopes**

Test all 5 scope modes, access control, format validation, export/import, stats.

- [ ] **Step 2: Transplant scopes.ts**

Direct port. 373 LOC. Zero dependencies.

- [ ] **Step 3: Write tests for decay-engine**

Test score computation for each tier, frequency saturation, stale detection, search boost.

- [ ] **Step 4: Transplant decay-engine.ts**

Direct port. 228 LOC. Change import `./memory-categories.js` to local `./memory-categories.js`.

Wire into existing `decay-engine-types.ts`: the stub types file already exists. The full implementation replaces/extends it. Ensure the `retriever.ts` import path resolves correctly.

> **Codex Review Fix (R1-F5):** Unify `MemoryTier` type: `memory-categories.ts` is the canonical source; update `decay-engine-types.ts` to re-export from `memory-categories.ts` instead of defining its own copy. `retriever.ts` imports should continue to work without path changes since `decay-engine-types.ts` re-exports.

> **Codex Review Fix (R1-F7):** Implementation is the full Weibull decay (with tier-specific beta), not the simplified exponential described in tasks.md 10.3. This is intentional — direct port from vendor is more robust than reimplementation. The simplified description in tasks.md was a planning estimate.

- [ ] **Step 5: Run all memory-lancedb tests**

Run: `cd extensions/memory-lancedb && pnpm test`
Expected: All existing 94+ tests pass + new tests pass.

- [ ] **Step 6: Commit**

```bash
git commit -m "[enhanced] feat(memory-lancedb): transplant scopes (5-mode isolation) + decay-engine (Weibull 3-tier)"
```

---

### Task 10: Memory Browser UI Update — Scope Filters + Tier Indicators

**covers:** tasks.md 10.4

**Skills:** `frontend-design`, `superpowers:test-driven-development`

**Files:**

- Modify: `dashboard/src/stores/memory.ts` — add scope/tier state
- Modify: `dashboard/src/components/panels/memory/MemoryPanel.tsx` — add scope filter dropdown
- Modify: `dashboard/src/components/panels/memory/FileTree.tsx` — add tier badge to files
- Modify: `dashboard/src/components/panels/memory/SearchPanel.tsx` — add scope filter to search
- Read (pre-allocated in Phase 0 T1): `dashboard/src/i18n/zh.json` — memory scope/tier keys already present
- Read (pre-allocated in Phase 0 T1): `dashboard/src/i18n/en.json` — memory scope/tier keys already present

**Scope filter:** Dropdown in MemoryPanel header showing available scopes (global, agent-specific). Filters file tree and search results.

**Tier indicators:** Color-coded badges on memory entries:

- 🟢 Core — green badge
- 🟡 Working — yellow badge
- 🔴 Peripheral — red badge

**i18n additions:**

```json
{
  "memory": {
    "scope": "作用域" / "Scope",
    "scopeGlobal": "全局" / "Global",
    "scopeAgent": "智能体" / "Agent",
    "tierCore": "核心" / "Core",
    "tierWorking": "工作" / "Working",
    "tierPeripheral": "外围" / "Peripheral",
    "decayScore": "衰减分数" / "Decay Score"
  }
}
```

**Steps:**

- [ ] **Step 1: Add scope/tier state to memory store**

```typescript
// Add to MemoryState:
selectedScope: string; // "global" | "agent:{id}" | etc.
availableScopes: string[];
setSelectedScope: (scope: string) => void;
fetchScopes: () => Promise<void>;
```

- [ ] **Step 2: Add scope filter dropdown to MemoryPanel**

Dropdown before the tab bar. Calls `fetchScopes()` on mount.

- [ ] **Step 3: Add tier badges to FileTree entries**

Color-coded dot next to file names when tier metadata is available.

- [ ] **Step 4: Add scope filter to SearchPanel**

Pass `selectedScope` as query param to `/api/memory/search`.

- [ ] **Step 5: Add i18n keys**

- [ ] **Step 6: Commit**

```bash
git commit -m "[enhanced] feat(deck): update Memory Browser — scope filters + tier indicators"
```

---

## Phase 2: Integration & Merge (Serial)

### Task 11: Wire New Panels + Integration Verification

**Files:**

- Modify: `dashboard/src/app/page.tsx` — wire DocHubPanel + SettingsPanel
- Run full test suite

**Steps:**

- [ ] **Step 1: Wire DocHubPanel and SettingsPanel into page.tsx**

```typescript
import { DocHubPanel } from "@/components/panels/docs/DocHubPanel";
import { SettingsPanel } from "@/components/panels/settings/SettingsPanel";

// In ActivePanel:
if (panel === "docs") return <DocHubPanel />;
if (panel === "settings") return <SettingsPanel />;
```

- [ ] **Step 2: Run full dashboard test suite**

Run: `cd dashboard && npx tsc --noEmit && pnpm test`
Expected: 289+ existing tests + new tests all pass.

- [ ] **Step 3: Run memory-lancedb test suite**

Run: `cd extensions/memory-lancedb && pnpm test`
Expected: 94+ existing tests + new transplant tests all pass.

- [ ] **Step 4: Cross-check i18n completeness**

Verify all new panel keys exist in both zh.json and en.json.

- [ ] **Step 5: Commit**

```bash
git commit -m "[enhanced] [impl] feat(deck): P3 Phase 2 integration — wire docs + settings panels"
```

---

## Phase 3: Production Readiness (Serial/Subagent)

---

### Task 12: Responsive Layout

**covers:** tasks.md 11.1

**Skills:** `frontend-design`, `ui-ux-pro-max`

**Files:**

- Modify: `dashboard/src/components/layout/Shell.tsx` — responsive container
- Modify: `dashboard/src/components/layout/NavRail.tsx` — auto-collapse on mobile
- Modify: `dashboard/src/components/layout/HeaderBar.tsx` — hamburger menu on mobile
- Create: `dashboard/src/hooks/useMediaQuery.ts` — responsive breakpoint hook

**Breakpoints:**

- Desktop (≥1024px): NavRail expanded + main content
- Tablet (768–1023px): NavRail collapsed (icon-only) + main content
- Mobile (<768px): NavRail hidden, hamburger menu in HeaderBar opens overlay

**Steps:**

- [ ] **Step 1: Create useMediaQuery hook**

```typescript
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);
  return matches;
}
```

- [ ] **Step 2: Update NavRail for responsive behavior**

Auto-collapse on tablet. Hidden on mobile with overlay mode.

- [ ] **Step 3: Update HeaderBar with hamburger menu**

On mobile: hamburger icon toggles NavRail overlay.

- [ ] **Step 4: Update Shell for responsive layout**

Flex direction changes, NavRail overlay vs sidebar.

- [ ] **Step 5: Test at all 3 breakpoints**

- [ ] **Step 6: Commit**

```bash
git commit -m "[enhanced] feat(deck): responsive layout — tablet/mobile breakpoints, NavRail auto-collapse"
```

---

### Task 13: Dark/Light Theme Polish + i18n Verification

**covers:** tasks.md 11.2, 11.7

**Skills:** `frontend-design`

**Files:**

- Modify: Various panel components (CSS variable usage audit)
- Modify: `dashboard/src/i18n/zh.json` — fix missing/incorrect translations
- Modify: `dashboard/src/i18n/en.json` — fix missing/incorrect translations

**Theme audit checklist:**

- [ ] All panels use CSS variables (not hardcoded colors)
- [ ] Borders visible in both themes (`var(--border)`)
- [ ] Text contrast meets WCAG AA in both themes
- [ ] Cards/panels have proper background differentiation
- [ ] Hover states visible in both themes
- [ ] Focus rings visible in both themes

**i18n audit:**

- [ ] Every UI string uses `useTranslations()` (no hardcoded text)
- [ ] All keys present in both zh.json and en.json
- [ ] Date/number formatting uses locale-aware formatters
- [ ] Placeholder text translated

**Steps:**

- [ ] **Step 1: Audit all 19 panels in dark mode, note issues**
- [ ] **Step 2: Audit all 19 panels in light mode, note issues**
- [ ] **Step 3: Fix identified theme issues**
- [ ] **Step 4: Run i18n audit script (grep for hardcoded strings)**
- [ ] **Step 5: Fix missing translations**
- [ ] **Step 6: Commit**

```bash
git commit -m "[enhanced] fix(deck): dark/light theme polish + complete i18n verification"
```

---

### Task 14: Keyboard Shortcuts

**covers:** tasks.md 11.3

**Files:**

- Create: `dashboard/src/hooks/useKeyboardShortcuts.ts` — global shortcut handler
- Modify: `dashboard/src/app/page.tsx` — register shortcuts
- Modify: `dashboard/src/i18n/zh.json` — shortcut labels
- Modify: `dashboard/src/i18n/en.json` — shortcut labels

**Shortcut map:**

| Key                | Action                                             |
| ------------------ | -------------------------------------------------- |
| `1`–`9`            | Switch to panel by nav order (Alt+1 through Alt+9) |
| `Ctrl/Cmd + K`     | Focus search (in current panel's search input)     |
| `Ctrl/Cmd + Enter` | Send message (in Chat panel)                       |
| `Escape`           | Close modal / deselect                             |
| `Ctrl/Cmd + ,`     | Open Settings                                      |
| `Ctrl/Cmd + /`     | Toggle NavRail collapse                            |

**Steps:**

- [ ] **Step 1: Implement useKeyboardShortcuts hook**

Global `keydown` listener with modifier detection. Action dispatch via `useUIStore.setActivePanel()`.

- [ ] **Step 2: Register in page.tsx**
- [ ] **Step 3: Add shortcut hints to NavRail items**
- [ ] **Step 4: Add i18n keys for shortcut labels**
- [ ] **Step 5: Commit**

```bash
git commit -m "[enhanced] feat(deck): keyboard shortcuts — panel navigation, chat send, common actions"
```

---

### Task 15: Performance Optimization

**covers:** tasks.md 11.6

**Files:**

- Modify: `dashboard/src/app/page.tsx` — lazy panel loading with `React.lazy()`
- Modify: `dashboard/src/app/api/stream/route.ts` — SSE reconnection improvements
- Modify: `dashboard/server/runtime.ts` — SQLite query optimization (indexes, prepared statements)

**Lazy loading:** Use `React.lazy()` + `Suspense` for non-default panels. Chat panel loads eagerly (default), others load on first navigation.

```typescript
const LazyUsagePanel = lazy(() =>
  import("@/components/panels/usage/UsagePanel").then((m) => ({ default: m.UsagePanel })),
);
// ... etc for all non-Chat panels
```

**SSE reconnection:** Add exponential backoff to EventSource reconnection. Track connection health with retry counter.

**SQLite:** Ensure all frequently-queried columns have indexes. Use prepared statements for hot paths.

**Steps:**

- [ ] **Step 1: Implement lazy panel loading**
- [ ] **Step 2: Add SSE reconnection with backoff**
- [ ] **Step 3: Audit SQLite indexes, add missing ones**
- [ ] **Step 4: Measure before/after load time**
- [ ] **Step 5: Commit**

```bash
git commit -m "[enhanced] feat(deck): performance optimization — lazy loading, SSE backoff, SQLite indexes"
```

---

### Task 16: E2E Test Suite (Playwright)

**covers:** tasks.md 11.5

**Skills:** `superpowers:test-driven-development`

**Files:**

- Create: `dashboard/e2e/setup.ts` — Playwright config + test fixtures
- Create: `dashboard/e2e/onboarding.spec.ts` — onboarding wizard flow
- Create: `dashboard/e2e/navigation.spec.ts` — panel navigation + keyboard shortcuts
- Create: `dashboard/e2e/settings.spec.ts` — settings panel CRUD
- Create: `dashboard/e2e/doc-hub.spec.ts` — doc list + category filter (Codex Review Fix R1-F6)
- Modify: `dashboard/package.json` — add Playwright dev dependency + test:e2e script

**Test scenarios:**

1. **Onboarding:** Visit app → wizard shown → enter gateway URL → test connection → save → main app loads
2. **Navigation:** NavRail click switches panels → keyboard shortcuts work → responsive collapse
3. **Settings:** Open settings → change theme → change language → save → verify persistence

Note: E2E tests requiring a live Gateway are marked as `test.skip` with comments explaining the dependency. Tests that can run against mocked API responses run normally.

**Steps:**

- [ ] **Step 1: Install Playwright**

```bash
cd dashboard && pnpm add -D @playwright/test
npx playwright install chromium
```

- [ ] **Step 2: Create Playwright config**

```typescript
// dashboard/playwright.config.ts
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  webServer: { command: "pnpm dev", port: 3000, reuseExistingServer: true },
  use: { baseURL: "http://localhost:3000" },
});
```

- [ ] **Step 3: Write onboarding E2E test**
- [ ] **Step 4: Write navigation E2E test**
- [ ] **Step 5: Write settings E2E test**
- [ ] **Step 6: Add test:e2e script to package.json**
- [ ] **Step 7: Commit**

```bash
git commit -m "[enhanced] feat(deck): E2E test suite — Playwright tests for onboarding, navigation, settings"
```

---

### Task 17: API Documentation

**covers:** tasks.md 11.4

**Files:**

- Create: `dashboard/docs/api-reference.md` — all ~45 endpoints documented

**Format per endpoint:**

```markdown
### GET /api/usage/cost

**Description:** Fetch token cost breakdown for the specified time window.
**Query params:** `days` (number, default 1)
**Response:** `{ updatedAt, days, daily, totals: { input, output, totalTokens, totalCost } }`
**Platform headers:** `X-Tenant-Id` (optional), `X-User-Id` (optional)
```

Group by domain: Gateway, Chat, Agents, Models, Sessions, Usage, Memory, Logs, Activity, Channels, Config, Cron, Webhooks, Approvals, Skills, Budget, Alerts, Docs, Settings, Stream, Onboarding.

**Steps:**

- [ ] **Step 1: Document all API routes by reading route files**
- [ ] **Step 2: Add platform integration section**

Describe the 3 integration patterns (reverse proxy, module import, middleware injection) and required headers.

- [ ] **Step 3: Commit**

```bash
git commit -m "[enhanced] docs(deck): add API reference — 45 endpoints documented for platform integration"
```

---

## Phase 4: L2 Codex Review

After all Phase 3 tasks complete:

1. Run `codex-review` skill (code review, competitive mode)
2. Review scope: all P3 changes (`git diff` from P2 L2 review commit to HEAD)
3. Focus areas: cross-panel consistency, security (Doc Hub content injection), performance (lazy loading correctness), i18n completeness
4. Fix findings → re-run tests → commit

---

## Verification Checklist (Pre-Completion)

- [ ] `tsc --noEmit` — 0 errors
- [ ] `pnpm test` (dashboard) — all tests pass (target: 310+)
- [ ] `pnpm test` (memory-lancedb) — all tests pass (target: 120+)
- [ ] All 19 panels accessible via NavRail (no PanelPlaceholder remaining)
- [ ] Dark and light themes verified on all panels
- [ ] i18n: all keys present in both zh.json and en.json
- [ ] Keyboard shortcuts functional
- [ ] Responsive layout tested at 3 breakpoints
- [ ] API documentation covers all endpoints
- [ ] E2E tests pass (Playwright)

---

## Requirement Coverage Matrix

| tasks.md Requirement             | Plan Task                                                        |
| -------------------------------- | ---------------------------------------------------------------- |
| 9.1 Doc Hub: auto-extract        | T2 (doc-extractor.ts)                                            |
| 9.2 Doc Hub: categorization      | T2 (CATEGORY_KEYWORDS, categorizeContent)                        |
| 9.3 Doc Hub: search + browse     | T3 (DocList, DocViewer, CategoryFilter)                          |
| 9.4 Doc Hub: API routes          | T2 (api/docs/)                                                   |
| 9.5 Settings: preferences        | T4 (settings store), T5 (AppearanceSection, NotificationSection) |
| 9.6 Settings: version + links    | T4 (version API), T5 (AboutSection)                              |
| 9.7 Settings: API routes         | T4 (api/settings/)                                               |
| 10.1 smart-extractor             | T7 (foundation) + T8 (core transplant)                           |
| 10.2 scopes                      | T9 (scopes.ts)                                                   |
| 10.3 decay-engine                | T9 (decay-engine.ts)                                             |
| 10.4 Memory Browser update       | T10 (scope filters + tier indicators)                            |
| 11.1 Responsive layout           | T12                                                              |
| 11.2 Theme polish                | T13                                                              |
| 11.3 Keyboard shortcuts          | T14                                                              |
| 11.4 API documentation           | T17                                                              |
| 11.5 E2E tests                   | T16                                                              |
| 11.6 Performance optimization    | T15                                                              |
| 11.7 Complete i18n               | T13                                                              |
| Deferred F7: approval expiry     | T6                                                               |
| Deferred F9: alerts SSE          | T6                                                               |
| Deferred F10: webhook retry      | T6                                                               |
| Deferred F11: condition eval     | T6                                                               |
| Deferred F12: subscriber cleanup | T6                                                               |
