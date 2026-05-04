# Interactions

## Keyboard

| Key             | Where                                   | Action                                                                  |
| --------------- | --------------------------------------- | ----------------------------------------------------------------------- |
| ⌘K / Ctrl+K     | Anywhere on page (window-level)         | Focus search input + open overlay                                       |
| Esc             | Anywhere                                | Close search overlay; close extract popover                             |
| Tab / Shift+Tab | Tree → Search → Viewer → Extract        | Standard focus rotation                                                 |
| Enter           | Search input (focused, query non-empty) | Reserved for "pick first result" (production); prototype requires click |
| Enter           | Tree leaf (focused)                     | Selects doc                                                             |
| Space           | Tree category head (focused)            | Toggle collapse                                                         |

⌘K + Esc are wired at the `window` keydown level (`app.jsx`), so they work regardless of which element holds focus.

## Hover & focus

| Element                         | Idle                        | Hover                                                              | Focus / active                                                                 |
| ------------------------------- | --------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Tree category head              | normal text                 | bg = `--ds-bg-elev2`; chevron rotates if expanded                  | none (button)                                                                  |
| Tree leaf (doc)                 | muted                       | bg = `--ds-bg-elev1`; title = `--ds-text-primary`                  | active gets accent left-border + bg = `accent-soft`; selected color = accent   |
| Search input                    | placeholder visible         | border = `--ds-border-strong`                                      | border = `--ds-accent`; ring = `accent-soft`                                   |
| Search result row               | normal                      | bg = `--ds-bg-elev2`                                               | (click → picks)                                                                |
| TagChip in hero (keyword)       | bg = `--ds-bg-elev1`        | bg = `--ds-bg-elev2`                                               | active (keywordFilter set to this keyword): bg = accent-soft + border = accent |
| TagChip in cloud (outline rail) | small muted                 | bg = `--ds-bg-elev2`                                               | active: same as hero TagChip                                                   |
| Id copy chip                    | muted small + IconCopy      | bg = `--ds-bg-elev2`; cursor = pointer                             | "Copied!" label replaces; chip pulses bg = accent-soft for 1400ms              |
| Delete button (hero)            | muted, no border            | text = danger; bg = `rgba(247,118,142,0.08)`; subtle danger border | (click → flips to confirm row)                                                 |
| Confirm-delete row              | inline, danger-tinted bg    | (none; buttons inside have own hover)                              | confirm → calls onDelete; cancel → reverts                                     |
| Related-doc card                | flat bg                     | bg = `--ds-bg-elev2`; right-arrow icon shifts +2px                 | (click → picks)                                                                |
| Outline rail h2 link            | muted                       | bg = accent-soft (border-radius `--ds-radius-sm`)                  | active (when scrolled to): accent border-left + bold                           |
| Keyword filter banner           | accent-soft bg, accent text | "× clear" button hover bg = accent-soft-hover                      | (click X → clears keywordFilter)                                               |
| Extract CTA (topbar)            | primary tone                | brightness +10%                                                    | (click → toggles popover)                                                      |
| Extract popover row             | flat                        | (no hover — read-only)                                             | (none)                                                                         |

## Animations

| Animation                     | Duration                            | Where                            | Purpose                                         |
| ----------------------------- | ----------------------------------- | -------------------------------- | ----------------------------------------------- |
| Search overlay drop           | 120ms                               | Search results overlay enter     | Eases in from translateY(-6px) opacity 0 → 1    |
| Extract popover drop          | 120ms                               | Extract popover enter            | Same easing as search overlay                   |
| Tree category collapse/expand | 0ms (CSS height auto, no animation) | Categories                       | Snappy — operators value speed over polish here |
| TagChip filter toggle         | 120ms                               | TagChip background swap          | Visual confirmation of filter state             |
| Id "Copied!" pulse            | 1400ms                              | Copy chip after click            | Confirms clipboard write succeeded              |
| Related-doc arrow shift       | 80ms                                | Hover on `.related-docs__row`    | Affordance hint that card is clickable          |
| Doc switch fade               | 0ms (no fade)                       | DocViewer doc swap               | No fade — keeps reading position predictable    |
| Extract done pulse            | 900ms                               | Popover footer "Doc extracted ✓" | Reads, then auto-closes                         |

## Tree interactions

```
click chevron / category head      → toggle category collapsed Set
click leaf (doc row)               → onSelect(id) → DocsApp.handlePick
keyboard: arrow up/down on focused leaf → reserved (production)
keyword filter banner shown when keywordFilter !== null
  → click "× clear" inside banner   → onKeywordFilter(null)
```

When `keywordFilter` is set:

- All categories force-open (collapsed Set bypassed in render)
- Each category filters its docs to those with matching keyword
- Categories with zero docs after filtering are hidden entirely
- Banner reads `Keyword filter: <keyword>` with the active keyword in accent color

## Search overlay interactions

```
1. user clicks search input          → searchOpen = true (overlay shown only if query !== "")
2. user types "webhook"              → query updated; searchOpen stays true; results recompute
3. results show "5 matches" with grouped category headers
4. user clicks a result row          → handlePick:
                                         - selectedId = result.id
                                         - searchOpen = false
                                         - query = ""
                                         - URL hash → "#/<id>"
                                         - keywordFilter NOT cleared (intentional — user might be filtered-browsing)
5. or: user presses Esc              → searchOpen = false (query preserved in input — prototype clears; production keeps)
6. or: user clicks X (clear button)  → query = "", searchOpen = false
7. or: user clicks X on results overlay → query = "", searchOpen = false (same as clear)
8. or: user clicks outside overlay   → reserved; prototype lets overlay sit (only Esc / X close it)
```

`searchOpen && query` is the gate — empty query → no overlay, even if input retains focus.

## Keyword filter interactions

```
state: keywordFilter = null
  → click TagChip "production" in viewer hero       → keywordFilter = "production"
  → click keyword "production" in outline cloud     → keywordFilter = "production"
  → tree force-opens all categories
  → tree filters out docs that don't include this keyword
  → banner appears at top of tree

state: keywordFilter = "production"
  → click TagChip "production" again                → keywordFilter = null (toggle clears)
  → click "× clear" in banner                       → keywordFilter = null
  → click TagChip "ops"                             → keywordFilter = "ops" (swap)
  → pick a doc from filtered tree                   → selection updates; keywordFilter UNCHANGED
```

Keyword filter is **decoupled from doc selection**: changing the active doc never clears the filter. This lets operators read multiple docs within a keyword context.

## Id copy interaction

```
1. user clicks id chip in viewer hero    → onCopyId(id)
2. navigator.clipboard.writeText(id)     → catch silently ignores write failures
3. copiedId = id                         → chip swaps "<icon> doc-summary-2026..." → "Copied!"
4. setTimeout(1400ms) → copiedId = null  → chip restores
5. clicking another id during the 1400ms window → supersedes (only one "currently copied")
```

## Delete interaction

```
1. user clicks Delete button              → confirmDelete = true (per-viewer state)
                                             button row replaced by:
                                             "Delete this doc? [Confirm delete] [Cancel]"
2a. user clicks Cancel                    → confirmDelete = false (button restored)
2b. user clicks Confirm delete            → onDelete(doc.id):
                                             - app removes doc from docs[]
                                             - selects next remaining doc
                                             - URL hash updated
                                             - confirmDelete implicitly reset (doc.id changed)
2c. user navigates to another doc         → confirmDelete reset (doc.id change effect)
```

Confirm state is per-doc, transient. The prototype simulates immediate success; production must:

- Show a `running` state on the Confirm button (disabled + spinner)
- Handle 404 silently (already gone — refresh list)
- Surface 5xx errors as a toast and revert confirmDelete to false

## Extract popover interactions

```
state: closed (default)
  → click "Extract from session" CTA        → open + phase = "idle"
  → popover renders below CTA, right-aligned, with:
      - Active session preview rows (id, agent, message count, started)
      - Footer: [Cancel] [Extract] (primary)

state: open + idle
  → click [Cancel] / [X] / press Esc         → closed
  → click [Extract]                          → phase = "running"
                                                footer replaced by "Extracting…" muted text

state: open + running
  → ~700ms (mock latency)                    → phase = "done":
                                                - new doc prepended to docs[]
                                                - selectedId = new doc.id (jumps to new doc)
                                                - footer shows "Doc extracted ✓" in accent

state: open + done
  → 900ms timer                              → closed + phase reset to idle
```

Production behavior diffs from prototype:

- Extraction latency is real (typically <1s for small sessions, longer for thousands of messages)
- Show a spinner during running
- On extract error: revert to idle + show inline error in popover footer with retry hint
- If the operator's session ends mid-extract, surface "Session no longer active" and reset
- Disable the CTA entirely when there is no active session (prototype assumes one always exists)

## Outline & related-docs interactions

```
on-this-page rail (sticky right, top: 92px)
  → list of <h2> entries from doc.content
  → click entry → window.location.hash = `#${id}-h2-${idx}` (production: imperative scrollIntoView)
                  prototype: relies on browser default which works because each h2 has an id

related-docs row (below body)
  → up to 4 docs sharing ≥ 1 keyword with current doc
  → click card → onSelectId → DocsApp.handlePick (full pick flow)

all-keywords cloud (outline rail, below on-this-page)
  → click any keyword → onKeywordFilter(keyword) (same coupling as hero TagChips)
```

## Cross-section coupling

| Source                         | Affects                                                                   | How                                                |
| ------------------------------ | ------------------------------------------------------------------------- | -------------------------------------------------- |
| Search → pick result           | URL hash + selectedId + tree active row + viewer body                     | Single `handlePick(id)` mutation                   |
| Tree → click leaf              | URL hash + selectedId + viewer body + outline + related-docs              | Same `handlePick(id)`                              |
| Hero TagChip → toggle          | keywordFilter + tree filter + tree force-open + banner                    | One state mutation cascades                        |
| Outline cloud TagChip → toggle | Same as hero TagChip                                                      | Same mutation point                                |
| Related-docs card → pick       | URL hash + selectedId + viewer + outline (recomputed)                     | Same `handlePick(id)`                              |
| ⌘K → focus                     | searchOpen + input focus                                                  | `searchRef.current?.focus()` + setSearchOpen(true) |
| Esc → close                    | searchOpen + extractOpen                                                  | setSearchOpen(false) + setExtractOpen(false)       |
| Extract success                | docs[] (prepend) + selectedId (new doc) + URL hash + tree paint           | Through one extract flow                           |
| Delete success                 | docs[] (filter out) + selectedId (next remaining) + URL hash + tree paint | Through onDelete                                   |

## Cross-module coupling

| With             | What                                              | Why                                                                                                                            |
| ---------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **api-explorer** | TagChip molecule reuse opportunity                | Both modules need toggleable chip pills; api-explorer has scope tags, docs has keywords. Promote TagChip to design-system.     |
| **api-explorer** | StatusCodeBadge alignment                         | Not used in docs (no HTTP status), but operators flipping between docs and api-explorer benefit from consistent meta surfacing |
| **sessions**     | sourceSession id is a deep link target            | Production: clicking the session id chip in the docs hero navigates to Sessions panel filtered to that session                 |
| **agents**       | sourceAgent name + color come from agent registry | Hero provenance shows agent dot in agent's brand color (color comes from AGENTS lookup)                                        |
| **settings**     | TagChip for scope chips                           | Same molecule, different data                                                                                                  |

## Edge cases

| Case                                                       | Behavior                                                                                                     |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| URL hash `#/unknown-id` on mount                           | Falls back to `DOCS[0]` (per `app.jsx`)                                                                      |
| `keywordFilter` filters out all docs in tree               | Tree empty (banner still shows); viewer keeps last-known doc                                                 |
| Doc with no keywords                                       | Hero keyword-chip row hides; all-keywords cloud unaffected                                                   |
| Doc with `sourceAgent` not in AGENTS registry              | Provenance shows "no agent" muted (graceful degrade)                                                         |
| Doc with `sourceSession === null`                          | Provenance shows "no session" muted                                                                          |
| Doc with only one h2                                       | Outline shows just that h2                                                                                   |
| Doc with no related docs (no keyword overlap)              | Related-docs section hides entirely                                                                          |
| Doc derived excerpt empty (only headings)                  | Hero summary line hides                                                                                      |
| Search query of length 1                                   | Still runs; results may be noisy — production should require length ≥ 2                                      |
| Search results score tie                                   | Ordered by category, then alphabetical within category                                                       |
| Id chip clicked rapidly twice                              | Second click resets the 1400ms timer; chip stays "Copied!" longer                                            |
| User pastes a URL with hash on first load                  | Hash is parsed and id resolved — single source of truth on mount                                             |
| User uses browser back after picking 3 docs                | Hash changes but state doesn't — prototype is one-way (state → URL only); production needs popstate listener |
| Doc content empty string                                   | Renderer outputs nothing; outline shows zero entries; related-docs by keyword still works                    |
| Doc content has unsupported markdown (e.g., blockquote)    | In-house renderer skips silently; production with react-markdown + remark-gfm covers this                    |
| User deletes the last remaining doc                        | docs[] empty; viewer shows nothing; production: empty state CTA                                              |
| User opens Extract popover while keyboard focus is in tree | Popover renders; tree retains focus until user Tabs into popover                                             |

## Pointer fluency

- Cursor is `pointer` on: tree leaves, search results, TagChips, id chip, related-docs cards, outline rail h2 entries, extract CTA, popover buttons, delete buttons
- Cursor is `text` on: doc body paragraphs, search input
- Cursor is `default` on: tree category descriptions, doc hero excerpt, provenance row, popover row labels

## Click-anywhere-to-close

The search overlay does NOT close on click-outside in the prototype. Decision: keep behavior conservative — operators sometimes need to copy text out of the overlay. To close: Esc or click clear/X.

The Extract popover follows the same convention — Esc or click X / Cancel. Click-outside is reserved (would conflict with the search overlay).
