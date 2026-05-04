# States

State machines for the docs panel.

## Top-level state

```
┌──────────────────────────────────┐
│  initial-load                    │
│  selectedId from URL hash        │
│  docs from data.js (in-mem)      │
└────────┬─────────────────────────┘
         │ resolve doc from id
         ▼
┌──────────────────────────────────┐
│  ready                           │
│  viewer rendered                 │
│  searchOpen = false              │
│  keywordFilter = null            │
│  extractOpen = false             │
└──────────────────────────────────┘
```

## Search overlay

```
closed ──input focus──▶ open (if query non-empty)
closed ──⌘K pressed──▶ open + input focused
closed ──type in input──▶ open

open ──Esc──▶ closed (query preserved? prototype clears; production: keep)
open ──pick result──▶ closed + selectedId = result.id + query cleared
open ──click X (clear)──▶ closed + query cleared
open ──click X (results close)──▶ closed + query cleared
```

`searchOpen && query` is the gate — empty query never shows results, even if focus returns to the input.

## Keyword filter

```
null ──click TagChip in viewer──▶ filter set to that keyword
null ──click TagChip in outline-cloud──▶ filter set to that keyword
filter set ──click same keyword again──▶ filter cleared
filter set ──click different keyword──▶ filter swapped
```

When keywordFilter is set:

- Tree force-opens all categories (collapsed Set effectively bypassed)
- Tree filters out docs whose keywords don't include the active keyword
- Categories with zero matching docs hide entirely
- A blue-tinted "Keyword filter: <keyword>" banner appears at the top of the tree
- The viewer keeps its current selection regardless of whether the active doc matches the filter (doesn't yank the user's reading)

## Doc selection

```
selectedId ──pick from tree / search / related──▶ same flow
   - state: selectedId = new id
   - URL hash updated
   - search overlay closed if open
   - query cleared
   - viewer scroll resets to top (browser default; production: imperative scrollTo)
   - keywordFilter NOT cleared (user might be browsing within a filter)
   - confirmDelete reset to false (per-doc state, not global)
```

## Id copy

```
idle ──click id chip──▶ copying (clipboard.writeText)
copying (instant) ──▶ copied (state)
copied ──1400ms timer──▶ idle
```

`copiedId` state is a single id (only one doc can be "currently copied"); clicking another id supersedes.

## Extract popover (topbar CTA)

```
closed ──click "Extract from session"──▶ open + phase = "idle"

open + idle ──click Cancel──▶ closed
open + idle ──click X──▶ closed
open + idle ──Esc──▶ closed
open + idle ──click Extract──▶ phase = "running" (button row replaced by "Extracting…")
running ──~700ms (mock)──▶ phase = "done" + new doc prepended + selectedId = new doc id
done ──900ms timer──▶ phase = "idle" + closed
```

In production, "running" duration depends on the BFF's extraction latency (typically <1s for a small session, longer for thousands of messages). Show a spinner during running phase. On error: revert to idle and surface a toast / inline error in the popover footer.

## Delete confirm (per-doc)

```
confirmDelete = false (default; reset on doc change)
   ──click Delete button──▶ confirmDelete = true
                              (Delete button replaced by inline "Delete this doc? Confirm | Cancel")

confirmDelete = true
   ──click Cancel──▶ confirmDelete = false
   ──click Confirm delete──▶ onDelete(doc.id)
                                - removes doc from app's docs[] state
                                - selects next doc in list (or first remaining)
                                - confirmDelete reset implicitly via doc-change effect
   ──navigate to another doc──▶ confirmDelete reset to false
```

Confirm state is **per-doc, transient**. Switching docs cancels any pending confirm.

## Markdown loading

The prototype embeds `content` directly in data.js — synchronous, no loading state. In production:

- List endpoint may return metadata only (no content)
- Detail endpoint fetches `content` on demand → skeleton rendered while loading
- 404: doc tree shows "—" or removes; viewer shows "Doc not found" empty state
- 503/network: viewer shows error block with retry

## Search states

| Condition                                                     | Surface                                                                |
| ------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `query === ""`                                                | No overlay                                                             |
| `query !== "" && searchOpen === false`                        | No overlay (rare; only when overlay was explicitly closed)             |
| `query !== "" && searchOpen === true && results.length > 0`   | Overlay shows N matches grouped by category                            |
| `query !== "" && searchOpen === true && results.length === 0` | Overlay shows "No docs match. Try fewer terms or a different keyword." |

## Outline state

`outline` is computed from H1+H2 lines in `doc.content` via `useMemo` keyed on `doc.content`. Re-computed on doc change. H1 entries are hidden in the rail (the title is already in the hero); only H2s show.

## Related docs

`relatedDocs` = up to 4 docs (excluding the current one) that share at least one keyword. Computed via `useMemo` keyed on the current doc. If no overlap, the section hides entirely.

## Empty / sparse states

| Condition                                                         | Surface                                                                                                            |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `docs.length === 0` (would only happen if catalog returned empty) | Tree shows nothing; viewer shows nothing meaningful — production: empty-state with "Try Extract from session" hint |
| `selectedId` not in docs (stale URL hash)                         | Falls back to `DOCS[0]` per `app.jsx`                                                                              |
| `keywordFilter` filters out all docs                              | Tree empty; viewer keeps last-known doc                                                                            |
| Doc has no keywords                                               | Hero keyword-chip row hides; outline rail's all-keywords cloud is unaffected                                       |
| Doc has only one heading                                          | Outline shows just that heading                                                                                    |
| Doc has no related docs                                           | Related-docs section hides                                                                                         |
| Doc has `sourceSession === null`                                  | Hero provenance row shows "no session" muted                                                                       |
| Doc has `sourceAgent === null`                                    | Hero provenance row shows "no agent" muted                                                                         |
| Doc derived excerpt empty (only headings/code blocks)             | Hero summary line hides                                                                                            |

## URL hash sync

```
mount: if window.location.hash matches "#/<id>"
       → selectedId = id (matched against DOCS list; falls back to DOCS[0] if no match)

onSelect: window.history.replaceState(null, "", `#/${id}`)
```

Hash sync is one-way (URL ← state). Browser back/forward doesn't navigate between previously-viewed docs in this iteration.

## Loading vs. ready

The prototype starts in `ready` (catalog and content are in-memory). In production:

- Initial fetch of catalog → tree shows skeleton categories (3-5 dummy entries)
- On doc click → if content not cached, viewer shows skeleton hero + skeleton body until detail endpoint resolves
- Catalog and detail responses are cached for the panel's lifetime + persisted to localStorage with TTL (1 hour) so reloads are instant

## Error states (production)

| Error                                  | Surface                                                                                                    |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Catalog fetch fails                    | Tree shows error state with retry button                                                                   |
| Detail fetch fails                     | Viewer shows error block with id + retry                                                                   |
| Doc deleted between catalog and detail | Toast: "Doc removed — refreshing list"; auto-refresh catalog                                               |
| Markdown parse error                   | Viewer shows "Couldn't render this doc" + raw `<pre>` body fallback                                        |
| Extract fails (4xx/5xx)                | Popover footer shows inline error with retry; phase reverts to "idle"                                      |
| Extract called with no active session  | Button is disabled (popover doesn't open); production should hide CTA when scope is below `operator.write` |
| Delete fails (network)                 | Toast: "Couldn't delete; the doc is still here. Try again."; doc remains in list                           |
| Delete returns 404                     | Treat as success (already gone); refresh list silently                                                     |
