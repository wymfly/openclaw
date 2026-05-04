# Components

## Tree

```
MemoryApp                                       app.jsx
├── memory-topbar                               app.jsx
│   ├── brand (IconMemory + label)
│   ├── memory-topbar__tabs (4 tabs: Browse / Search / Health / Dreams)
│   │   └── tab badge (when health has errors)
│   └── memory-topbar__actions (3 KPI counts: files / agents / errors)
└── memory-workspace
    ├── MemoryBrowser  (when activeTab === "browse")    memory-browser.jsx
    │   ├── memory-browser__tree (left, 320px)
    │   │   ├── tree-head (title + total file count + total bytes)
    │   │   └── FileTreeNode × N (recursive, depth-aware)
    │   └── memory-browser__viewer (right, fluid)
    │       ├── viewer-head (breadcrumbs + path-copy chip)
    │       └── memory-browser__content (MarkdownView)
    │
    ├── MemorySearch  (when activeTab === "search")     memory-search.jsx
    │   ├── memory-search__form (input + scope toggle + Search btn)
    │   └── memory-search__results
    │       ├── results-head (count + scope + LanceDB warn when applicable)
    │       └── memory-search__list
    │           └── memory-search__row × N
    │               ├── row-head (path + RelevanceBar)
    │               ├── row-content (snippet)
    │               └── row-meta (TierBadge + ScopeBadge + DecayBar)
    │
    ├── MemoryHealth  (when activeTab === "health")     memory-health.jsx
    │   ├── memory-health__summary (5 KPIs: LanceDB / total / ok / err / unknown)
    │   ├── memory-health__table (per-agent rows: agent dot + provider + status)
    │   └── memory-health__hint (production polling note)
    │
    └── MemoryDreams  (when activeTab === "dreams")     memory-dreams.jsx
        ├── memory-dreams__side (left, 280px)
        │   ├── agent picker × N (with last-updated timestamp)
        │   └── action strip (6 actions: read/backfill/dedupe/repair/resetShortTerm/reset)
        └── memory-dreams__main (right, fluid)
            ├── main-head (title + diary-path muted + running indicator)
            ├── ConfirmRow (when pendingAction is danger)
            ├── ActionResult (when actionResult set)
            └── memory-dreams__diary (MarkdownView of diary content)
```

## Component contracts

### `<MemoryApp />`

Root orchestrator. Owns:

- `activeTab: "browse" | "search" | "health" | "dreams"` (persisted to URL hash)

Computes 3 topbar KPIs: total files, total agents (from HEALTH.entries), error count.

### `<MemoryBrowser />`

Self-contained Browse tab. Local state:

- `expanded: Set<string>` — currently-open directory paths (initialized to `["/", "/global", "/agents"]`)
- `selectedPath: string` — currently-selected file path (default `/MEMORY.md`)
- `copied: boolean` — transient flag for the path-copy chip

Recursive `<FileTreeNode>` renders both directory and file entries, with chevron + icon + name + (file-only) size chip. Click on directory toggles `expanded`; click on file sets `selectedPath`.

### `<MemorySearch />`

Self-contained Search tab. Local state:

- `scope: "all" | "global" | "agent"` (defaults to `all`)
- `query: string`
- `phase: "idle" | "running" | "done"`
- `response: DeckGoMemorySearchResponse | null`

Form submit (or Enter in production) triggers `phase = "running"` → 260ms mock latency → reads `SEARCH_FIXTURES[query]` → filters by scope → sets `response`.

### `<MemoryHealth />`

Stateless. Reads `HEALTH` directly from the data fixture. Computes 3 derived counts (ok / error / unknown) for the KPI strip.

### `<MemoryDreams />`

Self-contained Dreams tab. Local state:

- `activeAgent: string` — currently-picked agent (defaults to first agent)
- `pendingAction: { id, label, danger, hint } | null` — set when user clicks a dangerous action; cleared on confirm/cancel
- `actionResult: DeckGoMemoryDreamActionResult | null` — last completed action
- `running: boolean` — gates action buttons during the 600ms mock latency

Action click flow:

- Non-danger: `runAction(id)` immediately → 600ms → action result rendered
- Danger: `setPendingAction(action)` → `<ConfirmRow>` appears → user clicks Confirm → `runAction(id)` → result

Switching agents resets `actionResult` and `pendingAction`.

## Local molecules

| Molecule       | Purpose                                                                                  | Promotion candidate?                                                                    |
| -------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `TierBadge`    | Pill for memory tier (`core` / `working` / `peripheral`) — colored bg + label            | Reusable wherever LanceDB tier metadata appears                                         |
| `ScopeBadge`   | Pill for `global` vs `agent:<id>` scope                                                  | Reusable in any per-agent vs global context                                             |
| `StatusDot`    | Small colored dot for embedding status (ok / error / unknown)                            | Single-use here; could merge with channel status patterns                               |
| `SizeChip`     | Monospace bytes formatter (B / KB / MB)                                                  | Reusable in any file-size display context                                               |
| `AgentDot`     | Bullet (agent's brand color) + agent name lookup against AGENTS registry                 | **Promotion candidate** — reused across docs (provenance), sessions, agents             |
| `RelevanceBar` | Linear gradient bar with percentage label                                                | Reusable in any score-display surface                                                   |
| `DecayBar`     | Small bar with tone gradient (ok < 20% / warn 20-60% / err > 60%)                        | Reusable wherever decay/staleness scores appear                                         |
| `MarkdownView` | In-house markdown renderer (h1-h3 + p + code + bold + lists + links + frontmatter block) | Replace with `react-markdown` + `remark-gfm` for production; same wrapper as docs panel |
| `FileTreeNode` | Recursive tree row (chevron + icon + name + size)                                        | Reusable for any path-based browser                                                     |
| `ActionResult` | Inline action-result row (key/value list of action diff stats)                           | Specific to dreams actions; not promote-candidate                                       |
| `ConfirmRow`   | Inline danger-action confirm row with rationale + Confirm/Cancel                         | Reuse pattern from docs (delete confirm) — same UX language                             |

## Tab semantics

The 4 tabs are first-class views, not subordinate sections. Each tab owns its state machine (browse `expanded`+`selectedPath`, search `scope`+`phase`, dreams `activeAgent`+`pendingAction`+`actionResult`). State does NOT cross tabs in v2 — picking a search result does not jump to Browse with that path opened. Production may add such a deep-link in v3 (Search row → "Open in Browse" button).

## Depends on canonical patterns

When productionized in `frontend-new/src/components/panels/memory/`:

- `PageShell` for the outer page chrome (`@/design-system/patterns`)
- `EmptyState` for "no diary yet" / "no search results" / future "memory store empty"
- Tabs: this is the **first panel where deck-go would benefit from a canonical `<Tabs>` pattern**. Currently inline; promote to design-system once a second panel needs it. (Channels' overview/throughput/probe tabs are panel-internal; memory's are first-class.)

## Depends on canonical icons

| Local                       | Canonical                               | Used by                                                       |
| --------------------------- | --------------------------------------- | ------------------------------------------------------------- |
| IconMemory                  | `IconMemory`                            | brand, browser tree title                                     |
| IconFolder                  | `IconFolder`                            | file-tree directory rows, Browse tab indicator                |
| IconFile                    | `IconFile`                              | file-tree file rows                                           |
| IconChevronR / IconChevronD | tree expand state, breadcrumb separator |
| IconSearch                  | `IconSearch`                            | Search tab indicator + search input                           |
| IconClose                   | `IconClose`                             | search input clear                                            |
| IconRefresh                 | `IconRefresh`                           | reserved (future explicit refresh action)                     |
| IconCheck                   | `IconCheck`                             | health status (ok)                                            |
| IconAlert                   | `IconAlert`                             | health status (error), confirm row, LanceDB warning           |
| IconQuestion                | `IconQuestion`                          | health status (unknown)                                       |
| IconHash                    | `IconHash`                              | path chip                                                     |
| IconCopy                    | `IconCopy`                              | path chip copy affordance                                     |
| IconClock                   | `IconClock`                             | reserved (future timestamps)                                  |
| IconBrain                   | `IconBrain`                             | Dreams tab indicator + non-danger dream actions + diary title |
| IconTrash                   | `IconTrash`                             | reserved (future delete affordances)                          |
| IconShield                  | `IconShield`                            | Health tab indicator + dangerous dream actions                |
| IconArrowRight              | `IconArrowRight`                        | reserved (future row affordances)                             |

## Search algorithm

`memory-search.jsx` looks up `query` against `SEARCH_FIXTURES` (in-memory map keyed by exact lowercase query). Production replaces this with `POST /api/memory/search` returning a `DeckGoMemorySearchResponse`. Score (relevance) is BFF-supplied, normalized to `[0, 1]`. Snippet generation is also BFF-supplied — the panel renders verbatim.
