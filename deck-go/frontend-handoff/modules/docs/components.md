# Components

## Tree

```
DocsApp                                       app.jsx
├── docs-topbar                               app.jsx
│   ├── brand (IconBook + label)
│   ├── docs-topbar__search-wrap
│   │   ├── search-input (⌘K-aware)
│   │   └── SearchResults (overlay, conditional)
│   └── docs-topbar__actions
│       ├── docs-topbar__count (X docs)
│       └── docs-extract                     app.jsx
│           ├── btn--primary "Extract from session"
│           └── docs-extract__pop (conditional popover)
│               ├── pop-head (title + close)
│               ├── pop-body (active session preview rows)
│               └── pop-foot (Cancel / Extract / running / done)
└── docs-workspace
    ├── DocsTree                              docs-tree.jsx
    │   ├── keyword filter banner (when active)
    │   └── category × N (DeckGoDocCategory enum: summary/plan/spec/manual/draft)
    │       ├── chevron + name + count
    │       ├── description (muted small)
    │       └── leaf × N (docs in category)
    └── DocViewer                             doc-viewer.jsx
        ├── doc-hero
        │   ├── breadcrumb (category → title)
        │   ├── h1 title
        │   ├── excerpt (derived from content first paragraph)
        │   ├── provenance row (agent dot + name + session id)
        │   ├── meta row (extractedAt + updatedAt + language + id copy chip + Delete button)
        │   └── keyword chips (clickable → keyword filter)
        └── doc-body
            ├── doc-body__main
            │   ├── MarkdownView
            │   └── related-docs (≤ 4 cards by keyword overlap)
            └── doc-body__outline (sticky)
                ├── on-this-page heading list
                └── all-keywords cloud
```

`SearchResults` (search-results.jsx) is rendered conditionally inside the topbar wrap; it overlays the workspace below it. `docs-extract__pop` is rendered conditionally inside the topbar actions; it floats over the workspace top-right.

## Component contracts

### `<DocsApp />`

Root orchestrator. Owns:

- `docs: DeckGoDoc[]` (mutable — delete and extract update it)
- `selectedId: string` (persisted to URL hash)
- `query: string` (search input)
- `keywordFilter: string | null` (active keyword filter)
- `searchOpen: boolean` (overlay visibility)
- `copiedId: string | null` (transient — for the "copied" hint after id copy)
- `extractOpen: boolean` (extract popover visibility)
- `extractPhase: "idle" | "running" | "done"` (extract popover stage)

Wires ⌘K and Esc keyboard shortcuts at window level.

### `<DocsTree categories docs selectedId onSelect keywordFilter />`

Props:

- `categories: Category[]` — `{ id: DeckGoDocCategory, label, description }`
- `docs: DeckGoDoc[]`
- `selectedId: string`
- `onSelect: (id: string) => void`
- `keywordFilter: string | null` — when set, only docs with matching keyword appear; all categories auto-expand

Local state: `collapsed: Set<DeckGoDocCategory>`. Cleared (effectively) when keywordFilter is non-null because the render path force-opens.

### `<DocViewer doc categories agents allKeywords onKeywordFilter keywordFilter onSelectId onCopyId copiedId onDelete />`

Props:

- `doc: DeckGoDoc` — the currently-viewed doc
- `categories: Category[]` — used to resolve breadcrumb label from `doc.category`
- `agents: Record<string, { name, color }>` — agent registry for sourceAgent display
- `allKeywords: string[]` — for the on-this-page rail's all-keywords cloud
- `onKeywordFilter: (keyword | null) => void`
- `keywordFilter: string | null`
- `onSelectId: (id) => void` — navigates to a related doc
- `onCopyId: (id) => void` — copies the doc id to clipboard
- `copiedId: string | null` — transient indicator
- `onDelete: (id) => void` — deletes the doc (parent handles store mutation)

Local state: `confirmDelete: boolean` — gates the Delete button into a two-step confirm.

Computes outline from H1/H2 in `doc.content` (via `useMemo` keyed on content) and related-docs by keyword overlap (via `useMemo` keyed on doc).

### `<SearchResults query results onPick onClose />`

Props:

- `query: string`
- `results: SearchResult[]` — `{ id, category, title, keywords, snippet, matchCount, score }`
- `onPick: (id: string) => void`
- `onClose: () => void`

Renders `<Highlight>` for the title and snippet, marking matched substrings in warn tone.

## Local molecules

| Molecule       | Purpose                                                                                         | Promotion candidate?                                                                                                                                                            |
| -------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TagChip`      | Generic chip with active state; click toggles parent filter (used here for keyword chips)       | **Promotion candidate** — settings (US-020 scope tags), agents (US-002 capability tags), nodes (US-022 type tags). API stays generic — accepts any string label via `tag` prop. |
| `MarkdownView` | In-house markdown renderer covering h1-h3, p, code (block + inline), bold, lists, tables, links | Replace with `react-markdown` + `remark-gfm` + `rehype-highlight` for production; keep a thin `MarkdownViewer` molecule wrapper                                                 |
| `Highlight`    | Highlights query substrings inside text with `<mark>`                                           | Reusable in any search-result UI                                                                                                                                                |

## Markdown coverage (in-house renderer)

The prototype's `renderMarkdown` (in `icons.jsx`) handles:

| Markdown                                        | Renderer output                                 |
| ----------------------------------------------- | ----------------------------------------------- |
| `# Title`                                       | `<h1 class="md-h1">` (with bottom border)       |
| `## Section`                                    | `<h2 class="md-h2">`                            |
| `### Sub`                                       | `<h3 class="md-h3">`                            |
| Paragraphs (joined consecutive non-empty lines) | `<p class="md-p">`                              |
| ` ```lang\ncode\n``` `                          | `<pre><code class="md-codeblock--{lang}">`      |
| `` `inline code` ``                             | `<code class="md-code">`                        |
| `**bold**`                                      | `<strong>`                                      |
| `[text](href)`                                  | `<a target="_blank" rel="noopener noreferrer">` |
| `- item` / `* item`                             | `<ul class="md-ul">`                            |
| `1. item`                                       | `<ol class="md-ol">`                            |
| Pipe tables with `\|---\|` separator            | `<table class="md-table">`                      |

What's NOT covered (production needs react-markdown / remark-gfm):

- Nested lists
- Blockquotes
- Strikethrough
- Task lists `- [ ]` / `- [x]`
- Footnotes
- HTML embedding
- Image syntax (out of scope this iteration)
- Heading anchors (H1/H2 outline-only, no clickable anchors yet)

## Depends on canonical patterns

When productionized in `frontend-new/src/components/panels/docs/`:

- `PageShell` for the outer page chrome (`@/design-system/patterns`)
- `EmptyState` if `docs.length === 0` ("No docs yet — extract one from an active session")
- `KbdHint` molecule on the search input placeholder (currently inline string `(⌘K)`)
- Tabs **not** used (this panel has flat tree + viewer, no tabs)

## Depends on canonical icons

| Local                       | Canonical                                           | Used by                                    |
| --------------------------- | --------------------------------------------------- | ------------------------------------------ |
| IconBook                    | `IconBook`                                          | brand, tree title, breadcrumb              |
| IconSearch                  | `IconSearch`                                        | search input                               |
| IconClose                   | `IconClose`                                         | search clear, results close, popover close |
| IconChevronR / IconChevronD | tree expand state, breadcrumb separator             |
| IconLink                    | (reserved for future external link badge in viewer) |
| IconTag                     | TagChip                                             |
| IconClock                   | hero meta extractedAt + updatedAt                   |
| IconCopy                    | hero id copy                                        |
| IconHash                    | hero id chip                                        |
| IconArrowRight              | related-docs row, Extract CTA                       |

## Search algorithm

`buildSearchResults(docs, query)` (in `search-results.jsx`):

| Match site                                | Score weight          |
| ----------------------------------------- | --------------------- |
| Title contains query                      | 10 (case-insensitive) |
| Keyword contains query                    | 5                     |
| Source session contains query             | 3                     |
| `content` contains query (per occurrence) | 1                     |

Snippet generation: window of ±60 chars / +80 chars around the first content match, with elision marks. If no content match, fall back to the title.

Production: replace the linear scan with a precomputed inverted index served by the BFF (`GET /api/docs/search?q=...`) once doc count exceeds ~50.
