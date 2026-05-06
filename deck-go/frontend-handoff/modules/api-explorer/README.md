# API Explorer

**Status**: implemented (sha d7ab0bb9b612ca120ec1d1e7ced6bef92e8f2508)
**Design completed**: 2026-05-04
**Designer**: design agent (multi-file React rebuild — v2)
**Depends on atoms**: Button, Input, Select, Textarea, Badge, Tag, Code, ScopeBadge, KindBadge, StatusPill, JsonViewer
**New atoms needed**: none (all local molecules — see components.md)
**New tokens needed**: none
**Backend endpoints used**: see `api-usage.md`
**Stack decisions**: production currently uses the existing dependency set with a module-local textarea/JSON viewer fallback. CodeMirror 6 remains a dependency-blocked follow-up, not current code truth.

## What this module does

The API Explorer panel is the deck-go developer surface for **interactively exploring the Gateway method registry**. It mirrors the kind of thing operators do today via `gateway describe` + curl: list namespaces, drill into a method, build a typed request payload, hit Run, inspect the response. Everything in one pane, no terminal context-switch.

The panel must answer four developer questions:

1. **What can the gateway do?** — namespace tree on the left with kind + scope badges per leaf
2. **What does this method want?** — schema-driven form with required/optional + types, plus raw JSON fallback
3. **What did it return?** — status code + body (highlighted) + headers + trace, with copy buttons
4. **What did I do recently?** — collapsible right rail with last 50 requests, click to re-load

Layout is the **3-pane workspace + right rail** (~280px tree / center builder / right response / 320px history rail).

## Contract truth

Code truth wins over this handoff. As of the Codex implementation pass on 2026-05-04:

- Catalog endpoint: `GET /api/gateway/describe` via `frontend-new/src/api.ts::fetchGatewayDescribe()`
- Typed invocation endpoint: `POST /api/v1/runtimes/{runtimeId}/gateway/rpc` via `frontend-new/src/api.ts::invokeGatewayMethod()`
- There is no production `/api/gateway/invoke` route.
- DTO authority: `DeckGoGatewayDescribeResponse` in `deck-go/contracts/source/deck-api.contract.ts`; generated artifacts are derived from source contracts.
- Typed RPC authority: Go BFF route `backend/internal/api/http/runtimes.go` plus generated Gateway method allowlist. Methods outside the allowlist return `INVALID_GATEWAY_METHOD`.
- Browser code must call deck-go BFF endpoints only — never the OpenClaw Gateway HTTP/WS endpoint directly.

## How to implement

1. Open `prototype.html` (Babel-standalone). Try the search box, drill into `deck.agents.detail`, switch to Body tab, edit the raw JSON, click Run, inspect the response (Body / Headers / Trace), open the history rail and re-load a previous request.
2. Read `components.md` — component tree, props contract, local molecules (KindBadge, ScopeBadge, StatusCodeBadge, HighlightedJson, ParamRow)
3. Read `states.md` — running / response / error / unknown method / hash deep link state machines
4. Read `interactions.md` — keyboard, modal-free flow (no modal in this panel), body mode toggle, copy flow, history pick
5. Read `api-usage.md` — current `fetchGatewayDescribe()` / `invokeGatewayMethod()` route truth and allowlist behavior
6. Read `implementation-notes.md` — current implementation evidence, unsupported prototype features, and dependency-blocked CodeMirror follow-up
7. Hardcoded literal strings come straight out of the prototype; once translated, lift them into `frontend-new/src/i18n/{en,zh}.json` per the prototype-string convention

## Open questions for implementation

- **Live `gateway.describe` vs static catalog** — production should call describe on mount, then cache. Should we surface "registry version mismatch" UI when the cached catalog has been superseded? Prototype assumes the catalog is fresh on every load.
- **Streaming methods** — `kind: "stream"` is in the schema enum but no method in the catalog uses it yet. The UI doesn't render a streaming response area; that's a follow-up when the first streaming RPC lands.
- **Auth headers** — prototype shows headers as read-only reference. In production, the BFF injects `Authorization` from the session cookie; the Explorer never prompts for tokens.
- **History persistence** — prototype and current production keep history in memory. Durable `localStorage` history is a follow-up.
- **Run cancellation** — prototype's "running" state has no cancel button (the `setTimeout` would be discarded by re-clicking Run). Production should cancel via `AbortController`.
- **Diff between two responses** — out of scope this iteration; flagged in `implementation-notes.md` as future enhancement.

## Reverse sign-off

| Field                          | Value                                                                                                                               |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Final sign-off status          | `accepted-with-exceptions`                                                                                                          |
| Reviewer                       | Codex                                                                                                                               |
| Date                           | 2026-05-06                                                                                                                          |
| Prototype reference            | `frontend-handoff/modules/api-explorer/prototype.html`                                                                              |
| Production reference           | `frontend-new/src/components/panels/api-explorer/`                                                                                  |
| Mock functional evidence       | `frontend-handoff/audit/module-evidence-manifest.json` (`api-explorer`, `mock-functional`, verdict: `recorded-by-visual-spec`)      |
| Mock prototype parity evidence | `frontend-handoff/audit/module-evidence-manifest.json` (`api-explorer`, `mock-prototype-parity`, verdict: `pass-with-exceptions`)   |
| Real Gateway evidence          | `frontend-handoff/audit/module-evidence-manifest.json` (`api-explorer`, `real-gateway`, status: `recorded-in-implementation-notes`) |
| Accepted exceptions            | See `frontend-handoff/audit/module-evidence-manifest.json` and `frontend-handoff/modules/api-explorer/implementation-notes.md`.     |

This reverse sign-off is a current-code evidence index. It does not upgrade `unreviewed` prototype parity verdicts to visual acceptance; those remain explicit in the manifest.
