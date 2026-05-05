# API Usage

API Explorer is a meta-panel over the Gateway method registry, but the browser never talks to the OpenClaw Gateway directly. Current code truth is the deck-go BFF contract chain below.

## Endpoint Table

| Verb   | Path                                       | Request                                                  | Response                                                     |
| ------ | ------------------------------------------ | -------------------------------------------------------- | ------------------------------------------------------------ |
| `GET`  | `/api/gateway/describe`                    | optional query handled by BFF/runtime                    | `DeckGoGatewayDescribeResponse`                              |
| `POST` | `/api/v1/runtimes/{runtimeId}/gateway/rpc` | `{ method: string, params: object, timeoutMs?: number }` | `{ runtimeId, requestId, result }` or `{ requestId, error }` |

There is no production `POST /api/gateway/invoke` route. Older prototype text that mentions it was design drift.

## Frontend Wrapper Signatures

```typescript
// frontend-new/src/api.ts
export async function fetchGatewayDescribe(): Promise<DeckGoGatewayDescribeResponse>;

export async function invokeGatewayMethod(
  method: string,
  params: Record<string, unknown>,
  options?: { runtimeId?: string; timeoutMs?: number },
): Promise<DeckGoGatewayInvokeResult>;
```

`invokeGatewayMethod()` normalizes BFF success and error envelopes into:

```typescript
type DeckGoGatewayInvokeResult = {
  body: unknown;
  error?: string;
  headers: Record<string, string>;
  ok: boolean;
  requestId?: string;
  statusCode: number;
};
```

## Catalog Response Shape

The live catalog is a map keyed by method name, not the prototype's namespace array:

```jsonc
{
  "methods": {
    "gateway.describe": {
      "scope": "operator.read",
      "params": { "type": "object", "properties": {} },
      "result": { "type": "object" },
      "since": 1,
    },
  },
  "events": {},
  "untyped": [],
}
```

The production panel groups method names by prefix (`deck`, `gateway`, `agents`, etc.) for the tree UI.

## Typed Invocation

### Request

```jsonc
{
  "method": "gateway.describe",
  "params": {},
  "timeoutMs": 10000,
}
```

### Success

```jsonc
{
  "runtimeId": "rt_local",
  "requestId": "req-...",
  "result": {
    "methods": {},
    "events": {},
    "untyped": [],
  },
}
```

### Typed Allowlist Error

```jsonc
{
  "requestId": "req-...",
  "error": {
    "code": "INVALID_GATEWAY_METHOD",
    "message": "method is not in the generated typed Gateway allowlist",
  },
}
```

The BFF checks the generated typed method allowlist before forwarding to Gateway. API Explorer can inspect untyped or schema-missing methods from describe, but this implementation enables Run only for read-scoped typed methods and renders BFF errors without attempting arbitrary untyped execution.

## Headers

The request builder Headers tab is read-only. The BFF injects authentication, runtime, trace, and content headers. Browser code cannot override Gateway auth, operator scope, or trace headers from API Explorer.

## Current Production Behavior

| Workflow     | Current behavior                                                      |
| ------------ | --------------------------------------------------------------------- |
| Catalog load | `fetchGatewayDescribe()` on mount; refresh button reloads             |
| Method tree  | Grouped from `methods` map by method-name prefix                      |
| Params form  | Module-local schema form for common JSON Schema primitives            |
| Raw body     | Textarea JSON editor with parse errors and Run disabled while invalid |
| Run          | `invokeGatewayMethod()` against `rt_local`, `timeoutMs: 10000`        |
| Response     | Body, headers, and trace/request-id tabs                              |
| History      | React state only, newest first, capped at 50                          |
| Events       | Read-only event payload schema inspection                             |
| Untyped      | Read-only evidence block                                              |

## Out Of Scope / Follow-Up

- CodeMirror 6 editor integration
- Schema-aware autocomplete
- Streaming response rendering
- Durable localStorage history
- Response diffing
- Trace span timeline backed by OpenTelemetry
- Arbitrary untyped invocation

Any future contract change must start from source contracts and generated Gateway protocol artifacts, then rerun the matching deck-go contract/protocol checks.
