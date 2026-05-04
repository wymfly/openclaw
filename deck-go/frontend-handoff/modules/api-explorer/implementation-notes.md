# Implementation notes

Production-side decisions that wouldn't be obvious from reading the prototype, plus stack decisions triggered by this panel.

## Stack decisions

The api-explorer is the **first deck-go panel that requires interactive code editing** (the request body editor + response viewer). Below decisions are LOCKED for production; prototype uses lightweight stubs.

### Code editor library — **CodeMirror 6 (LOCKED)**

**Decision**: production uses CodeMirror 6 for the request body editor, response body viewer, and any future code-editing surfaces (e.g., agent instructions in US-002, plugin manifest editing in US-022).

| Option                                | Pros                                                                                                                                             | Cons                                                                                      | Verdict                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **CodeMirror 6** ✓                    | Modular packages (~120 KB gzipped per language pack), tree-shakeable, mature JSON / JS / TS support, BSD license, used by Sourcegraph / Codeberg | Steeper API than Monaco; need to wire each addon                                          | **Locked**                                     |
| Monaco                                | VS Code's editor, full IDE feel, schema-aware autocomplete via `@monaco-editor/react`                                                            | ~3 MB+ minified even after tree-shake; AMD module loader awkward in Vite; long mount time | Rejected — too heavy for non-IDE panels        |
| Prism (read-only)                     | ~10 KB; perfect for read-only highlighting                                                                                                       | Cannot edit; would still need a different editor for the request body                     | Rejected (alone)                               |
| Plain `<textarea>` + custom highlight | Zero deps; fastest mount                                                                                                                         | No autocomplete, no schema awareness, no folding                                          | Rejected for production; **used in prototype** |

**Rationale**: CodeMirror 6 hits the right point on the bundle / capability curve for a panel-embedded editor. We'll add JSON-schema autocomplete via `@codemirror/lang-json` + a custom completion source that reads from the method's `params` schema.

**Production wiring**:

- Wrap CodeMirror in a `<CodeEditor>` molecule in `frontend-new/src/design-system/patterns/CodeEditor.tsx`
- Take `value`, `onChange`, `language`, `schema?` props
- Lazy-load CodeMirror via dynamic import to keep the api-explorer bundle slim for users who never open the Body tab

**Prototype substitute**: plain `<textarea>` for editing + custom JSON tokenizer in `icons.jsx` (`tokenize()`) producing token spans for read-only highlighting. The tokenizer covers JSON's full grammar (keys, strings, numbers, literals, punctuation) — sufficient for prototype-level fidelity but missing autocomplete, folding, and inline error markers.

### Schema-driven form generator — **build in-house**

The Explorer's Params tab generates a form from each method's `params` JSON Schema. Options considered:

| Option                       | Verdict                                                                                                                |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **In-house generator** ✓     | Keep tight — only ~7 schema variants matter (boolean, string-with-enum, string, integer, array, object, nullable-of-X) |
| `react-jsonschema-form`      | Rejected — too generic, hard to style consistently with deck-go tokens                                                 |
| `@rjsf/core`                 | Same as above                                                                                                          |
| Skip the form, only raw JSON | Rejected — defeats the panel's "developer-friendly" purpose                                                            |

The in-house generator (`<ParamField>` in `request-builder.jsx`) handles the 7 variants directly. New variants (e.g., date pickers when `format: "date-time"` lands) get added inline. No library upgrade thrash.

### JSON viewer — share with response pane

Both the body's "Form-derived" preview and the response pane's body display use the same `<HighlightedJson>` molecule. Production should hoist this to `@/design-system/patterns/JsonViewer` once it's used across ≥3 panels (likely after settings US-020).

## Trace span synthesis (PROTOTYPE-ONLY)

The Trace tab in the response pane uses synthetic spans (`SYNTHETIC_SPANS` in `response-pane.jsx`) — fixed timings for `ws.handshake → auth.verify → scope.check → method.resolve → handler.run → result.encode → ws.respond`. This is **decorative**; production needs real OpenTelemetry spans.

Production wiring:

- Backend exports OT spans via OTLP / Honeycomb / Tempo / similar
- Frontend fetches `/api/traces/{traceId}` to get the actual span tree
- Same horizontal-bar rendering, but `startMs` / `durMs` / `name` come from real data

If OT integration is far off, fallback is to surface only `x-deck-duration-ms` as a single bar with no breakdown.

## Schema autocompletion (PRODUCTION)

CodeMirror's JSON completion can be schema-aware via a custom `CompletionSource` that reads the active method's `params` schema:

```typescript
// In design-system/patterns/CodeEditor.tsx
function makeJsonSchemaCompletion(schema: JSONSchema): CompletionSource {
  return (ctx) => {
    // Walk the cursor path to find which property's schema applies
    // Return matching enum values, key suggestions, type hints
  };
}
```

This is the main reason we chose CodeMirror over plain textarea: schema awareness is the panel's value-add over `curl`.

## URL hash deep links

Selected method is in URL hash: `https://deck.openclaw.io/#/deck.agents.detail`. This survives reload and is shareable. Production should also persist:

- Selected environment (in localStorage, not URL — reloading should respect last env)
- Body mode (in localStorage)
- Open/closed state of history rail (in localStorage)

The URL hash should remain method-only — too much state in the URL turns into noise.

## History persistence

Prototype: in-memory only.
Production: per-env `localStorage` key, capped at 100 entries, with TTL-based GC on mount.

The full draft is included in the entry (not just paramsPreview) — this is the difference between "I can re-open the method" and "I can re-run the exact request I ran 20 minutes ago".

## Run cancellation

Prototype: `setTimeout` is fire-and-forget.
Production: each Run creates an `AbortController`; clicking Run again cancels the in-flight request and starts a new one. The Response pane shows "Cancelled" briefly during the transition.

## Diff between two responses (FUTURE)

Common developer workflow: "did this change?" Capture two history entries → diff their bodies. Out of scope this iteration; sketch:

- History rail entry has a "Pin" button → keeps that entry around even after the 50-cap rolls
- "Diff with previous" button → opens a side-by-side JSON diff (CodeMirror has a diff addon)

## Streaming methods (FUTURE)

When the first `kind: "stream"` RPC lands (likely an event tail like `deck.events.subscribe`):

- Response pane gets a fourth tab "Events" (or replaces Body) with a scrollable list
- Run becomes "Subscribe"; a second click "Stop"
- Each event renders as a collapsible row (timestamp + event type + payload)

This is a meaningful UI change — flag a follow-up OpenSpec when the first streaming method appears in the catalog.

## Performance

- Catalog tree renders ~50-200 leaves; no virtualization needed
- Response body up to 1 MB renders fine with the JSON tokenizer (test fixture has ~500 tokens; production may exceed). For very large responses (e.g., full session transcripts), the response pane should switch to "view first 50 KB + show download link" mode — flag follow-up

## A11y

- Tree uses `role="tree"` + `role="treeitem"` + `aria-expanded` / `aria-selected`
- Body parse error gets a `role="alert"` (TODO — current implementation is a plain span)
- Run button uses `aria-busy={running}` (TODO — same)
- Color-only signal for tone is paired with text + icon: status code chip + "Success/Failed" word + IconCheck/IconAlert for status row

## Promotion candidates (after this iteration)

| Molecule          | Status                                                                               |
| ----------------- | ------------------------------------------------------------------------------------ |
| `KindBadge`       | promote to design-system after gateway US-015 retroactively adopts                   |
| `ScopeBadge`      | promote after settings US-020 adopts                                                 |
| `StatusCodeBadge` | promote — already used by webhooks (US-018), gateway (US-015), api-explorer (US-019) |
| `HighlightedJson` | promote after settings US-020 + agents US-002 adopt                                  |
| `Spinner`         | promote — every async-running button needs it                                        |

## Cross-section notes

- Future: when settings US-020 lands, scope-restricted methods should be visually greyed in the tree
- Future: deep-link from gateway batch console (US-015) → API Explorer pre-loaded with the batch method
- Future: deep-link from webhook test action (US-018) → API Explorer pre-loaded with `deck.webhooks.test` and the webhook id

## What was NOT implemented (out of scope)

- Live streaming response rendering (no streaming method in catalog yet)
- Run cancellation (prototype timeout is fire-and-forget)
- Save preset / Bookmark (UI placeholder only — IconBookmark renders but the action no-ops)
- Diff between two responses
- Catalog version mismatch toast
- Schema-aware autocomplete (covered by CodeMirror lock for production)
- localStorage persistence
- Arrow-key tree navigation
- Cmd+Enter to run
