# States

State machines for the memory panel.

## Top-level state

```
┌──────────────────────────────────┐
│  initial-load                    │
│  activeTab from URL hash         │
│  fixtures from data.js (in-mem)  │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│  ready                           │
│  one of: browse / search /       │
│    health / dreams               │
│  topbar tabs + KPIs visible      │
└──────────────────────────────────┘
```

URL hash `#/<tab>` is the single source of truth for `activeTab`. On mount, hash is parsed; switching tabs immediately writes back via `history.replaceState`.

## Tab navigation

```
browse ──click "Search"──▶ search    (state isolated; browse local state preserved)
browse ──click "Health"──▶ health
browse ──click "Dreams"──▶ dreams
search ──click "Browse"──▶ browse
... (any to any)
```

Switching tabs does NOT reset the destination tab's local state. Re-entering Browse later restores `expanded` + `selectedPath`. Re-entering Dreams restores `activeAgent` (but clears `actionResult` because the action result is per-visit, not per-session — debatable; production may keep).

## Browse tab — file tree

```
on mount:
  expanded = { "/", "/global", "/agents" }
  selectedPath = "/MEMORY.md"

click directory chevron / row:
  if path in expanded → remove (collapse)
  else → add (expand) — children resolved from BROWSE_TREE[path]

click file row:
  selectedPath = file.path
  viewer renders FILE_CONTENTS[selectedPath]
  if no content found → memory-browser__empty state
```

The prototype loads all directory entries into `BROWSE_TREE` up front. Production should fetch on first expand:

```
expand("/agents/main"):
  if BROWSE_TREE["/agents/main"] not yet fetched:
    GET /api/memory/browse?path=/agents/main
    → cache response.files into BROWSE_TREE map
  render children
```

## Browse tab — file content

```
selectedPath set → look up FILE_CONTENTS[selectedPath]
  found → MarkdownView renders content (frontmatter shown as boxed pre)
  not found → "Select a file to view its content" muted
```

In production, the file content endpoint (`GET /api/memory/browse?path=/file.md`) returns `DeckGoMemoryBrowseResponse.content`. Skeleton during fetch.

## Browse tab — path copy

```
idle ──click path chip──▶ copying (clipboard.writeText)
copying (instant) ──▶ copied (state)
copied ──1400ms timer──▶ idle
```

Same behavior as docs panel id chip — single-target transient.

## Search tab — query lifecycle

```
on mount:
  query = ""
  scope = "all"
  phase = "idle"
  response = null

user types → query updated; phase = "idle" (results not yet running)
user clicks Search (or Enter):
  phase = "running" → 260ms latency (mock)
  → look up SEARCH_FIXTURES[query.lower().trim()]
  → if found: filter results by scope; set response
  → if not found: response = { results: [], unavailableReason: null, lanceDbEnabled: true }
  → phase = "done"

user clicks Clear (×):
  query = ""
  response = null
  phase = "idle"
  input refocused
```

In production, replace `SEARCH_FIXTURES` lookup with `POST /api/memory/search { query, scope, agentId }`.

## Search tab — scope toggle

```
scope = "all" ──click "Global only"──▶ scope = "global"
scope = "global" ──click "Per-agent"──▶ scope = "agent"
scope = "agent" ──click "All"──▶ scope = "all"
```

Changing scope DOES NOT auto-rerun the query. User must hit Search again. Decision: explicit re-run prevents accidental over-fetching when the user is mid-toggle.

When scope = "global", filter to results where `r.scope === "global" || !r.scope`.
When scope = "agent", filter to results where `r.scope?.startsWith("agent:")`.
When scope = "all", no filter.

## Search tab — LanceDB unavailable

```
response.lanceDbEnabled === false:
  warn pill in results-head:
    "<alert icon> LanceDB unavailable — keyword fallback active"
  results render as before (BFF still returned them via fallback)
```

When the BFF returns `unavailableReason: "<reason>"`, surface the reason verbatim in the results-head warning pill.

## Health tab

The Health tab is fully synchronous in the prototype (reads HEALTH directly from data.js). No state machine — no async, no loading, no error.

In production:

```
on mount:
  GET /api/memory/health
    → loading skeleton (5 KPI cards + table rows as ghosts)
    → success → render
    → error → keep skeleton + error banner with retry

on 30s poll interval:
  refetch silently; only update if response differs
```

## Dreams tab — agent selection

```
on mount:
  activeAgent = AGENTS[0].id  (default: "main")
  pendingAction = null
  actionResult = null
  running = false

click agent row:
  activeAgent = agent.id
  pendingAction = null  (cancel any pending action when switching agents)
  actionResult = null   (clear last result on context switch)
```

## Dreams tab — action lifecycle

Six actions, two danger levels:

```
non-danger actions (read / backfill / dedupe / repair):
  click action button:
    actionResult = null  (clear previous)
    runAction(id):
      running = true → 600ms (mock) → set fakeResults[id] → running = false; pendingAction = null

danger actions (resetShortTerm / reset):
  click action button:
    pendingAction = { id, label, danger: true, hint }  (no run yet)
    confirm row appears in main pane:
      "<alert icon> Confirm <Reset all>? <hint>  [Confirm] [Cancel]"
    click Confirm:
      runAction(id) → same flow as non-danger
    click Cancel:
      pendingAction = null
```

Switching agents during a pending confirm: `pendingAction` is cleared by the agent-row click side-effect.

## Dreams tab — action result rendering

```
actionResult is null → no result block shown

actionResult set → ActionResult block:
  head: "Last action: <action> on <agentId>"
  body: key/value list filtered to keys actually present:
    scannedFiles, written, replaced, removedEntries,
    removedShortTermEntries, dedupedEntries, keptEntries,
    archiveDir, archivedDreamsDiary, archivedSessionCorpus,
    changed (when false), warnings[]
```

Production may want a longer history (last N actions) — defer.

## Dreams tab — diary content

```
diary = DREAMS.diaries[activeAgent]

if diary?.found === true:
  show diary.path + updatedAtMs in head
  render diary.content via MarkdownView in main

if diary?.found === false (or not found):
  show "no diary file at <path>" muted in head
  show empty-state CTA in main: "Run Backfill to seed from session corpus, or Read to verify the file path."
```

After a successful `backfill` action, production should refetch the diary so the diary content updates. Prototype does NOT update the diary after the action (mock).

## Topbar — health badge cascade

```
HEALTH.entries.filter(e => e.embeddingStatus === "error").length > 0
  → memory-topbar__tab-badge appears next to the Health tab label
  → memory-topbar__kpi--err class on the "errors" KPI
```

Real-time: in production, the topbar's KPI count updates whenever the Health response is refetched. Prototype is static.

## Empty / sparse states

| Condition                                     | Surface                                                       |
| --------------------------------------------- | ------------------------------------------------------------- |
| Browse: directory has 0 files                 | Tree shows nothing for that branch (collapsed if no children) |
| Browse: file content missing in FILE_CONTENTS | "Select a file…" empty state                                  |
| Search: query returns 0 results               | "No matches. Try different terms or change scope."            |
| Search: query empty                           | Shows the demo-queries hint card                              |
| Health: 0 agents                              | "Total agents: 0" in KPIs; empty table                        |
| Dreams: agent has no diary                    | Empty-state CTA in main pane; agent row shows "no diary"      |
| Dreams: no action ever run                    | No result block rendered                                      |

## Error states (production)

| Error                           | Surface                                                                |
| ------------------------------- | ---------------------------------------------------------------------- |
| Browse: directory fetch fails   | Tree row shows error icon + retry button on the failed row             |
| Browse: file fetch fails        | Viewer shows error block with path + retry                             |
| Search: 5xx                     | Inline error in results-head; results cleared                          |
| Search: 501 / unavailableReason | Warning pill in results-head; results may still render via fallback    |
| Health: fetch fails             | Banner with retry; KPIs show ghost values                              |
| Dreams: action fails            | Inline error replacing the action result block; running cleared        |
| Dreams: agent has been deleted  | Picker hides the agent; if it was active, fall back to first remaining |

## URL hash sync

```
mount: parse window.location.hash
  if matches "#/<tab>" and tab ∈ TABS → activeTab = tab
  else → activeTab = "browse"

on tab change: window.history.replaceState(null, "", `#/${activeTab}`)
```

One-way (URL ← state). No popstate listener; browser back/forward doesn't change tabs in v2.

## Loading vs. ready

The prototype starts in `ready` (all fixtures in-memory). In production:

- Initial fetch parallel: `GET /api/memory/browse?path=/` + `GET /api/memory/health` to warm the topbar KPIs
- Skeletons during loading: tree placeholder rows, KPI ghost cards, search empty hint stays visible
- Cache the file tree per-path with stale-while-revalidate; cache the health response with a 30s TTL
