# Implementation notes — docs

> Per `frontend-handoff/CLAUDE.md` protocol enhancement #5 (后端契约协商). Records the contract reconciliation made during the v2 multi-file rebuild.

## Stack lock — markdown rendering

**Decision (LOCKED):** production locks `react-markdown` + `remark-gfm` + `rehype-highlight`.

Rationale:

- `react-markdown` is the canonical AST-based renderer in the React ecosystem; pluggable, well-typed, mature
- `remark-gfm` covers GitHub-flavored markdown features the in-house renderer skips (tables with alignment, strikethrough, task lists, autolink, footnotes)
- `rehype-highlight` handles fenced-code-block syntax highlighting via highlight.js — the in-house renderer emits `md-codeblock--{lang}` placeholder classes that go nowhere

The prototype's in-house renderer in `icons.jsx` is a stand-in covering enough grammar for the visual demonstration (h1-h3, p, code, bold, lists, tables, links). Do **not** ship the in-house version — at translation time, replace `<MarkdownView source={content} />` with `<MarkdownViewer source={content} />` (a thin wrapper around `react-markdown` configured with the gfm + highlight plugins).

This has been declared in `docs/project/stack-decisions.md` as part of the v2 rebuild family.

## Contract reconciliation — DTO shape

**Discovered:** v1 prototype design (and the original `prd.json` task description) modeled docs as a static documentation tree with topical categories (`concepts` / `runtime` / `contracts` / `howto`) and per-doc fields like `slug`, `bodyMd`, `summary`, `tags`. None of these match the actual `DeckGoDoc` contract in `contracts/source/deck-api.contract.ts:1459-1481`.

**Real shape (authoritative):**

- `id` (not `slug`)
- `content` (not `bodyMd`; no separate `summary` field)
- `keywords` (not `tags`)
- `category: DeckGoDocCategory` enum: `summary` | `plan` | `spec` | `manual` | `draft` (not topical groupings)
- `sourceSession`, `sourceAgent` (provenance — fundamental to the panel's purpose)
- `extractedAt`, `updatedAt`, `language`

**What this changed in framing:** the docs panel is for **runtime-extracted documentation** harvested from agent sessions, not a static doc site. The whole hero needs a provenance row (agent dot + session id chip), the topbar needs an "Extract from session" CTA, and the panel needs a Delete action (per V1 codex).

**Resolution applied:**

1. Rewrote `data.js` with 16 docs across the 5 actual `DeckGoDocCategory` values
2. Renamed every component-level identifier: `slug→id`, `bodyMd→content`, `tags→keywords`, `tagFilter→keywordFilter`, `onCopySlug→onCopyId`, `selectedSlug→selectedId`, `onSelectSlug→onSelectId`
3. Added `<DocViewer>` provenance row with `AGENTS` registry lookup (agent dot in agent's brand color + session id chip)
4. Added topbar `Extract from session` CTA + popover (idle → running → done flow), seeding extracted docs from the in-memory `ACTIVE_SESSION` stub
5. Added Delete button in `<DocViewer>` hero meta row with two-step confirm (Delete → "Confirm delete" / "Cancel")
6. Replaced "summary" derivation: derive a hero excerpt from `content`'s first non-heading paragraph when needed (hides if empty)
7. Search algorithm now scores `keywords` and `sourceSession` instead of `tags` and `summary`
8. Related-docs computation uses keyword overlap instead of tag overlap

**Implication for translation (`frontend-new/src/components/panels/docs/`):**

- Use `import type { DeckGoDoc, DeckGoDocCategory } from "@/types/deck-api"` directly — no remapping layer
- Wire `fetchDocs()` / `fetchDoc()` / `extractDocs()` / `deleteDoc()` from `frontend-new/src/api/docs.ts`
- The `AGENTS` registry stub in `data.js` should be replaced with a real selector against the agents store (whatever store library wins per stack-decisions)
- The `ACTIVE_SESSION` stub should be replaced with a selector against the sessions store
- Scope-gating: `Extract from session` and `Delete` MUST be hidden (not just disabled) when the operator's scope is below the required level (write / admin respectively)

**No backend change needed.** The contract is correct; the prototype was misaligned and has been fixed in-place. The api-discrepancy.md path was unnecessary because there was no real divergence to negotiate — only a prototype catch-up.

## Outstanding open questions (carried into Reverse sign-off)

See `README.md#open-questions-for-implementation`. Notable items:

- Session picker for Extract (current prototype uses _the_ active session; production may need a picker)
- Soft delete vs. hard delete (V1 codex reads as hard delete)
- Inline editing of `content` (current scope = read-only)
- Frontmatter handling

## Notes on benign Babel-standalone diagnostics

The TS diagnostic `Could not find name 'IconClose'` (and similar) on `search-results.jsx` is the standard Babel-standalone cross-script-tag global resolution noise — these globals are exported via `Object.assign(window, ...)` in `icons.jsx` and resolved at runtime. They do not affect functional behavior of the prototype and are removed by the translation step (real `import` statements in `frontend-new`).
