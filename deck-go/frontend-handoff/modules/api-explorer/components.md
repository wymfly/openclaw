# Components

## Tree

```
ApiExplorerApp                              app.jsx
├── api-explorer-topbar                     app.jsx
│   ├── brand (IconCode + label)
│   ├── env selector (IconNetwork + select + base hint)
│   └── btn--ghost (Refresh catalog)
└── api-explorer-workspace
    ├── MethodTree                          method-tree.jsx
    │   ├── search-input
    │   └── ns-row × N
    │       ├── chevron + namespace name + count
    │       └── leaf × N (method name + KindBadge + ScopeBadge)
    ├── RequestBuilder                      request-builder.jsx
    │   ├── hero (KindBadge + ScopeBadge + method name + description + actions)
    │   ├── tabs: Params / Headers / Body / Docs
    │   └── tab content
    │       ├── ParamsTab — schema-driven form (ParamField × N)
    │       ├── HeadersTab — read-only standard headers table
    │       ├── BodyTab — seg-filter (Form-derived | Raw JSON) + HighlightedJson | textarea
    │       └── DocsTab — description + ParamRow × N + result type + scope + sample
    ├── ResponsePane                        response-pane.jsx
    │   ├── status row (StatusCodeBadge + status text + duration + size)
    │   ├── tabs: Body / Headers / Trace
    │   └── tab content
    │       ├── HighlightedJson | ErrorBlock
    │       ├── HeadersBlock (table)
    │       └── TraceBlock (trace id + horizontal span timeline)
    └── HistoryRail                         history-rail.jsx
        ├── handle (collapsed) — vertical icon + count badge
        └── expanded — header + history-row × N (method + status + meta + paramsPreview)
```

## Component contracts

### `<ApiExplorerApp />`

Root orchestrator. Owns:

- `selectedMethodName: string` (persisted to URL hash)
- `environment: "local" | "stage" | "prod"`
- `query: string` (search filter)
- `draft: object` (current params payload — schema-derived defaults seeded on method change)
- `bodyMode: "form" | "raw"`
- `rawBody: string` (mirrors draft when in raw mode)
- `bodyError: string | null` (JSON parse error)
- `running: boolean`
- `response: { statusCode, body, headers, success, error? } | null`
- `lastDurationMs: number | null`
- `history: HistoryEntry[]` (most-recent first; capped at 50)
- `historyOpen: boolean`
- `copiedKey: "body" | "headers" | "trace" | null` (transient)

### `<MethodTree catalog selected onSelect query onQuery />`

Props:

- `catalog: NamespaceEntry[]` — `{ namespace, description, methods: MethodEntry[] }`
- `selected: string` (full method name)
- `onSelect: (name: string) => void`
- `query: string` / `onQuery: (s: string) => void`

Local state: `collapsed: Set<string>` (namespaces). When `query` is non-empty, all namespaces auto-expand to show matching leaves.

### `<RequestBuilder method draft onChange onRun running bodyMode onBodyMode rawBody onRawBody bodyError onUseSample />`

Props:

- `method: MethodEntry | null`
- `draft: Record<string, any>` / `onChange: (next) => void`
- `onRun: () => void`
- `running: boolean`
- `bodyMode: "form" | "raw"` / `onBodyMode`
- `rawBody: string` / `onRawBody`
- `bodyError: string | null`
- `onUseSample: () => void`

Local state: `tab: "params" | "headers" | "body" | "docs"`.

### `<ResponsePane response running lastDurationMs copiedKey onCopy />`

Props:

- `response: ResponseShape | null`
- `running: boolean`
- `lastDurationMs: number | null`
- `copiedKey: string | null` (which tab's copy was last clicked)
- `onCopy: (kind, response) => void`

Local state: `tab: "body" | "headers" | "trace"`.

### `<HistoryRail history onPick open onToggle />`

Props:

- `history: HistoryEntry[]`
- `onPick: (entry) => void` (loads method back into builder)
- `open: boolean` / `onToggle: () => void`

Stateless apart from open/close.

## Local molecules (in `icons.jsx`)

| Molecule          | Purpose                                                                               | Promotion candidate?                                                                                |
| ----------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `KindBadge`       | query / mutation / stream tone (info / warn / accent)                                 | **Promotion candidate** — gateway US-015 has same concept (RPC kind), would consolidate             |
| `ScopeBadge`      | operator.read / write / admin (ok / warn / err) with shield icon                      | **Promotion candidate** — settings, audit, agents all need scope display                            |
| `StatusCodeBadge` | HTTP 5-tone (none / ok 2xx / info 3xx / warn 4xx / err 5xx)                           | **Confirmed reuse** — webhooks (US-018), gateway (US-015) batch results                             |
| `HighlightedJson` | read-only JSON with token-level CSS classes (key / string / number / literal / punct) | **Promotion candidate** — agents config (US-002), webhooks deliveries (US-018), settings JSON dumps |
| `ParamRow`        | name + type + required + description (used in Docs tab)                               | api-explorer-specific                                                                               |
| `Spinner`         | inline spinner (rotating dasharray circle)                                            | **Promotion candidate** — every async-running button needs it                                       |

## Schema-driven form

`ParamField` is the per-property renderer; it dispatches on `schema.type` + `schema.enum`:

| Schema                  | Renderer                                        |
| ----------------------- | ----------------------------------------------- |
| `boolean`               | checkbox + true/false label                     |
| `string` with `enum`    | `<select>`                                      |
| `string` without `enum` | `<input type="text">`                           |
| `integer` / `number`    | `<input type="number">` with min/max if present |
| `array`                 | `ArrayInput` (N rows + `Add item` button)       |
| `object`                | `<textarea>` with JSON parse on blur            |

`schema.nullable` flips the `?` indicator on the type chip and allows `null` input.
`schema.required` (from parent's `required` array) shows a "required" red chip.
`schema.default` is shown as placeholder.

For complex `object` properties or deeply-nested schemas, the form falls back to a JSON textarea — same pattern as VS Code's settings.json fallback for unsupported schemas.

## Depends on canonical patterns

When productionized in `frontend-new/src/components/panels/api-explorer/`:

- `PageShell` for the outer page chrome (`@/design-system/patterns`)
- `EmptyState` for the no-method-selected center pane
- Tabs (`Tabs`, `TabsList`, `TabsContent`) for both request and response — **promotion candidate** (already used by webhooks, cron, gateway)
- Codemirror integration via the design-system `CodeEditor` wrapper (TBD — see `implementation-notes.md`)

## Depends on canonical icons

| Local                       | Canonical              | Used by                           |
| --------------------------- | ---------------------- | --------------------------------- |
| IconCode                    | `IconCode`             | brand, RequestBuilder empty state |
| IconRefresh                 | `IconRefresh`          | refresh catalog                   |
| IconClose                   | `IconClose`            | history rail close                |
| IconCheck                   | `IconCheck`            | success indicators                |
| IconAlert                   | `IconAlert`            | error block, body parse error     |
| IconPlay                    | `IconPlay`             | Run button                        |
| IconShield                  | `IconShield`           | ScopeBadge                        |
| IconClock                   | `IconClock`            | response duration                 |
| IconNetwork                 | `IconNetwork`          | env selector                      |
| IconBookmark                | `IconBookmark`         | save preset (placeholder, future) |
| IconHistory                 | `IconHistory`          | history rail handle               |
| IconCopy                    | `IconCopy`             | copy buttons in response pane     |
| IconChevronR / IconChevronD | tree expand state      |
| IconSearch                  | tree search input      |
| IconPlus / IconMinus        | array input add/remove |
