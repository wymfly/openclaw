# API Explorer API Usage

## Endpoint Chain

| UI need                       | Frontend wrapper         | BFF endpoint                | Contract source                 |
| ----------------------------- | ------------------------ | --------------------------- | ------------------------------- |
| Live Gateway describe catalog | `fetchGatewayDescribe()` | `GET /api/gateway/describe` | `DeckGoGatewayDescribeResponse` |

The Go BFF calls the managed runtime `Describe(ctx, true)`, which adapts upstream Gateway `gateway.describe`. Browser code must not call Gateway directly.

## Response Shape

```ts
type DeckGoGatewayDescribeResponse = {
  methods?: Record<
    string,
    {
      scope?: string;
      params?: Record<string, unknown>;
      result?: Record<string, unknown>;
      since?: number;
    }
  >;
  events?: Record<
    string,
    {
      payload?: Record<string, unknown>;
      since?: number;
    }
  >;
  untyped?: string[];
};
```

## Fields Used

### Method catalog

- method name from the `methods` record key
- domain from the method name before the first `.`
- `scope`
- `since`
- `params`
- `result`

### Event catalog

- event name from the `events` record key
- `since`
- `payload`

### Untyped methods

- string array from `untyped`
- must remain visible because it is governance evidence, not an error state

## Schema Rendering

Schema rendering reads:

- `type`
- `enum`
- `required`
- `properties`
- `items`

Nested schema rendering must be bounded. Unknown schema keywords are not interpreted by this module pass; no-schema states remain visible.

## Mock Visual Boundary

The bundled mock Gateway needs contract-shaped `gateway.describe` data for visual E2E. Evidence from this package is mock visual coverage, not real Gateway/LLM coverage and not proof of upstream schema completeness.
