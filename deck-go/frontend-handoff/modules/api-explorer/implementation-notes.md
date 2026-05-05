# Implementation notes

Production-side decisions that would not be obvious from reading the prototype, plus implementation evidence from the deck-go pass.

## Codex implementation closeout - 2026-05-04

### Status

Implemented in `frontend-new` and verified against the current deck-go BFF contract chain.

### Contract-chain matrix

| Workflow          | Frontend surface                                  | BFF / runtime contract                                  | Gateway dependency                                  | Classification                          |
| ----------------- | ------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------- | --------------------------------------- |
| Catalog load      | `fetchGatewayDescribe()`                          | `GET /api/gateway/describe`                             | `gateway.describe` projection                       | supported                               |
| Method tree       | `ApiExplorerPanel` groups `methods` map by prefix | `DeckGoGatewayDescribeResponse.methods`                 | live describe method map                            | supported                               |
| Schema inspection | Params/result `SchemaViewer`                      | describe `params` / `result` JSON-schema-shaped entries | Gateway method schema metadata                      | supported                               |
| Raw body edit     | module-local textarea + JSON parse                | wrapper sends parsed `params` only                      | selected typed method params                        | supported                               |
| Safe Run          | `invokeGatewayMethod()`                           | `POST /api/v1/runtimes/rt_local/gateway/rpc`            | generated typed Gateway allowlist + runtime request | supported for read-scoped typed methods |
| Error render      | non-throwing `DeckGoGatewayInvokeResult`          | BFF `{ error: { code, message }, requestId }` envelope  | allowlist/scope/runtime errors                      | supported                               |
| Event inspection  | Events tab                                        | describe `events` map                                   | Gateway event metadata                              | supported/read-only                     |
| Untyped methods   | `JsonDetails` evidence                            | describe `untyped` array                                | generated method coverage                           | supported/read-only                     |
| History           | `HistoryRail` React state                         | frontend-only                                           | none                                                | degraded: in-memory only                |
| BFF-only access   | API wrapper + Playwright direct-Gateway check     | deck-go BFF endpoints only                              | no browser Gateway HTTP/WS                          | supported                               |
| Not configured    | `GatewayNotConfiguredEmptyState`                  | BFF not-configured errors                               | runtime endpoint config                             | supported                               |
| Streaming         | inspect-only badge inference                      | no stream run UI                                        | future Gateway streaming methods                    | unsupported/follow-up                   |
| CodeMirror/editor | textarea fallback                                 | no new dependency                                       | none                                                | dependency-blocked follow-up            |
| Trace spans       | request ID + route only                           | response headers/envelope                               | no trace span endpoint                              | degraded                                |

### Fixes made

- Rebuilt production API Explorer into the v2 workbench: method tree, request builder, response pane, history rail, schema viewer, raw JSON error handling, safe run button, event inspection, and untyped evidence.
- Added `invokeGatewayMethod()` in `frontend-new/src/api.ts` so the panel uses the current typed runtime RPC route instead of a non-existent `/api/gateway/invoke`.
- Preserved boolean enum values in schema-generated params instead of converting them to strings.
- Added focused frontend coverage for v2 layout, safe typed invocation, JSON parse failures, schema collapsing, reload, not-configured, filtering, and events.
- Added mock visual and real Gateway E2E coverage for describe, safe typed invocation, response/history rendering, typed allowlist error shape, and no direct browser Gateway calls.
- Corrected handoff contract docs for route truth, CodeMirror state, typed allowlist, and unsupported prototype features.

### Verification evidence

- Prototype smoke: `prototype.html` loaded with title `api-explorer — high-fidelity v2` and no browser console/page errors.
- Focused frontend: `cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/api-explorer/ApiExplorerPanel.test.tsx src/api.chat-helpers.test.ts` -> 55 tests passed.
- Backend focused: `cd deck-go/backend && go test ./internal/api/http ./internal/controld -run 'TestMountRoutes|TestRemoteModeBadPersistedEndpointBlocksPassthroughUntilRepair'` -> passed.
- L1 mock visual: `cd deck-go && pnpm exec playwright test test/e2e/api-explorer-visual.spec.ts --config playwright.config.ts` -> passed.
- L2 real Gateway: `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test test/e2e/api-explorer-real-gateway.spec.ts --config playwright.config.ts` -> 2 tests passed.
- Build: `cd deck-go && make frontend-build` -> passed.

### Residual risks / follow-up

- Durable history, response diffing, schema autocomplete, CodeMirror 6, run cancellation, and OpenTelemetry-backed trace spans remain out of scope.
- Run is intentionally limited to read-scoped typed methods in the UI; mutating or untyped methods are inspect-only until product safety rules and disposable fixtures exist.
- The catalog shape still depends on live `gateway.describe`; missing methods are environment-dependent and should be treated as contract/runtime evidence rather than static UI truth.

## Prototype parity remediation closeout - 2026-05-05

### Verdict

`pass-with-exceptions`.

The production panel preserves the active v2 handoff's product shape: method
catalog, request builder, response pane, schema/docs tabs, untyped evidence, and
history rail. The remaining differences are intentional contract/product-shell
exceptions rather than deterministic implementation defects.

### Accepted exceptions

| Difference                                                                                                                                                                                           | Classification                      | Decision                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------- |
| The handoff prototype screenshot is a standalone surface with lower luminance; production is captured as the module panel inside the current deck-go shell/tokens.                                   | product shell / design-system truth | Keep production contrast and shell integration.                |
| Prototype method catalog, method count, and history are static sample data. Production follows live `gateway.describe`, generated typed method allowlist, and empty history until a safe run occurs. | contract truth                      | Do not hardcode prototype catalog or history.                  |
| Prototype shows an environment selector and direct Gateway URL details. Production browser code uses only the deck-go BFF route.                                                                     | architecture boundary               | Keep BFF-only browser access and route display.                |
| Prototype includes future affordances such as durable history, CodeMirror-grade editing, streaming response rendering, response diffing, and trace span breakdown.                                   | later enhancement                   | Keep out of this remediation; track as follow-up product work. |

### Evidence

- Active prototype: `deck-go/frontend-handoff/modules/api-explorer/prototype.html`.
- Mock current screenshot:
  `deck-go/.local/api-explorer-prototype-remediation-mock-visual/api-explorer-visual-api-ex-ea81f-ction-states-from-mock-data/api-explorer-workspace-ready.png`.
- Prototype-current contact sheet:
  `deck-go/.local/api-explorer-prototype-remediation-parity-report/sheet-1.png`.
- Structured verdict:
  `deck-go/.local/api-explorer-prototype-remediation-parity-report/verdict.json`.
- Focused frontend:
  `cd deck-go/frontend-new && npm run test:deck-ui -- src/components/panels/api-explorer/ApiExplorerPanel.test.tsx src/api.chat-helpers.test.ts`
  -> 62 tests passed.
- Mock visual:
  `cd deck-go && pnpm exec playwright test test/e2e/api-explorer-visual.spec.ts --config playwright.config.ts --output .local/api-explorer-prototype-remediation-mock-visual --reporter=line`
  -> 1 test passed.
- Real Gateway:
  `cd deck-go && DECK_GO_REAL_GATEWAY_E2E=1 pnpm exec playwright test test/e2e/api-explorer-real-gateway.spec.ts --config playwright.config.ts --output .local/api-explorer-prototype-remediation-real-gateway-2 --reporter=line`
  -> 2 tests passed.
- Frontend build: `cd deck-go && make frontend-build` -> passed.

## Stack decisions

The api-explorer is the first deck-go panel that benefits from interactive code editing (the request body editor + response viewer). Current production code uses the existing dependency set and a module-local textarea/JSON viewer fallback. CodeMirror 6 is a proposed follow-up that requires explicit dependency approval.

### Code editor library — CodeMirror 6 proposed follow-up

**Decision state**: not implemented in current production. CodeMirror 6 remains the preferred future option if the project approves a new editor dependency for request body editing, response viewing, and future code-editing surfaces.

| Option                                | Pros                                                                                                                                             | Cons                                                                                      | Verdict                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **CodeMirror 6**                      | Modular packages (~120 KB gzipped per language pack), tree-shakeable, mature JSON / JS / TS support, BSD license, used by Sourcegraph / Codeberg | Steeper API than Monaco; need to wire each addon                                          | Preferred follow-up, dependency approval needed |
| Monaco                                | VS Code's editor, full IDE feel, schema-aware autocomplete via `@monaco-editor/react`                                                            | ~3 MB+ minified even after tree-shake; AMD module loader awkward in Vite; long mount time | Rejected — too heavy for non-IDE panels         |
| Prism (read-only)                     | ~10 KB; perfect for read-only highlighting                                                                                                       | Cannot edit; would still need a different editor for the request body                     | Rejected (alone)                                |
| Plain `<textarea>` + custom highlight | Zero deps; fastest mount                                                                                                                         | No autocomplete, no schema awareness, no folding                                          | Current production fallback                     |

**Future rationale**: CodeMirror 6 appears to hit the right point on the bundle / capability curve for a panel-embedded editor. If approved, JSON-schema autocomplete can be added via `@codemirror/lang-json` plus a custom completion source that reads from the method's `params` schema.

**Possible future wiring**:

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
