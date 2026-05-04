# API Explorer

**Status**: ready-for-implementation
**Design completed**: 2026-05-04
**Designer**: design agent (multi-file React rebuild — v2)
**Depends on atoms**: Button, Input, Select, Textarea, Badge, Tag, Code, ScopeBadge, KindBadge, StatusPill, JsonViewer
**New atoms needed**: none (all local molecules — see components.md)
**New tokens needed**: none
**Backend endpoints used**: see `api-usage.md`
**Stack decisions**: code editor library locked to **CodeMirror 6** (see `implementation-notes.md` § Stack decisions)

## What this module does

The API Explorer panel is the deck-go developer surface for **interactively exploring the Gateway method registry**. It mirrors the kind of thing operators do today via `gateway describe` + curl: list namespaces, drill into a method, build a typed request payload, hit Run, inspect the response. Everything in one pane, no terminal context-switch.

The panel must answer four developer questions:

1. **What can the gateway do?** — namespace tree on the left with kind + scope badges per leaf
2. **What does this method want?** — schema-driven form with required/optional + types, plus raw JSON fallback
3. **What did it return?** — status code + body (highlighted) + headers + trace, with copy buttons
4. **What did I do recently?** — collapsible right rail with last 50 requests, click to re-load

Layout is the **3-pane workspace + right rail** (~280px tree / center builder / right response / 320px history rail).

## Contract truth

- BFF endpoints: every Gateway method is reachable through `POST /api/gateway/invoke` with `{ method, params }` envelope
- Description endpoint: `POST /api/gateway/invoke { method: "deck.gateway.describe" }` returns the live method registry
- DTO authority: `DeckGoGatewayDescribeResponse` for the catalog; per-method DTOs are referenced by name in each entry's `result` field (see `data.js`)
- Schema source: each method entry includes a JSON-Schema-shaped `params` object (`{ type, properties, required, enum?, ... }`) — the form generator consumes this directly
- Browser code must call the BFF wrapper only — never reach into the Gateway WS connection directly

## How to implement

1. Open `prototype.html` (Babel-standalone). Try the search box, drill into `deck.agents.detail`, switch to Body tab, edit the raw JSON, click Run, inspect the response (Body / Headers / Trace), open the history rail and re-load a previous request.
2. Read `components.md` — component tree, props contract, local molecules (KindBadge, ScopeBadge, StatusCodeBadge, HighlightedJson, ParamRow)
3. Read `states.md` — running / response / error / unknown method / hash deep link state machines
4. Read `interactions.md` — keyboard, modal-free flow (no modal in this panel), body mode toggle, copy flow, history pick
5. Read `api-usage.md` — `gateway.describe` / `gateway.invoke` envelope contract; how the BFF rewrites paths to RPC method names
6. Read `implementation-notes.md` — stack decisions for production: CodeMirror 6 (locked), JSON tokenizer fallback for prototype, schema-driven form generator
7. Hardcoded literal strings come straight out of the prototype; once translated, lift them into `frontend-new/src/i18n/{en,zh}.json` per the prototype-string convention

## Open questions for implementation

- **Live `gateway.describe` vs static catalog** — production should call describe on mount, then cache. Should we surface "registry version mismatch" UI when the cached catalog has been superseded? Prototype assumes the catalog is fresh on every load.
- **Streaming methods** — `kind: "stream"` is in the schema enum but no method in the catalog uses it yet. The UI doesn't render a streaming response area; that's a follow-up when the first streaming RPC lands.
- **Auth headers** — prototype shows headers as read-only reference. In production, the BFF injects `Authorization` from the session cookie; the Explorer never prompts for tokens.
- **History persistence** — prototype keeps history in memory. Production should persist to `localStorage` (per-environment) and survive reload.
- **Run cancellation** — prototype's "running" state has no cancel button (the `setTimeout` would be discarded by re-clicking Run). Production should cancel via `AbortController`.
- **Diff between two responses** — out of scope this iteration; flagged in `implementation-notes.md` as future enhancement.
