## Why

Usage and Logs have production UI, shared list-query/live-projection metadata,
and prior real read-path evidence, but the head matrix still carries stale
observability gaps. Current code truth shows two deterministic issues:

- `logs.tail` now has typed Gateway params/result and Deck-facing tail DTOs, so
  the old upstream-schema-missing wording is stale.
- `sessions.usage.logs` and `sessions.usage.timeseries` handlers validate
  narrow usage-result schemas, but the method metadata used by generated
  Gateway artifacts still references older broad session schemas, leaving
  generated logs/timeseries results as `unknown`.

This child proposal closes those deterministic contract-chain drifts without
adding new Gateway APIs or changing UI product scope.

## What Changes

- Re-audit Usage, Logs, and Activity/Monitor observability workflows against
  current Gateway schemas/method metadata, Deck BFF routes, Deck-facing DTOs,
  list-query/live-projection contracts, frontend facades, and real evidence.
- Align `sessions.usage.logs` and `sessions.usage.timeseries` method metadata
  with the narrow usage-result schemas used by the runtime handlers.
- Regenerate Gateway protocol TS/Go artifacts and add a codegen regression so
  usage logs/timeseries do not silently collapse back to unknown envelopes.
- Reconcile Logs and Usage matrix rows with current list-query,
  live-projection, dynamic-surface, and generated-artifact truth.
- Update Usage/Logs/Activity implementation notes, generated matrix Markdown,
  and head verification evidence.

## Capabilities

### New Capabilities

- `deck-go-usage-logs-observability-contract-completion`: Completes
  Usage/Logs observability contract-chain alignment by narrowing generated
  usage log/timeseries envelopes, recording logs tail typed-envelope truth, and
  keeping intentional dynamic observability leaves documented.

### Modified Capabilities

- None.

## Impact

- Affected Gateway metadata/codegen:
  `src/gateway/server-methods/sessions-method-defs.ts`,
  generated Gateway protocol TS/Go artifacts, and protocol codegen tests.
- Affected contract evidence:
  list-query/live-projection/dynamic-surface references in
  `deck-go/docs/contract-chain-audit.matrix.json` and generated Markdown.
- Affected frontend/tests:
  focused API helper or contract tests only if generated type drift requires
  frontend adaptation.
- No new log server filters, durable export/download, billing-accuracy claims,
  quota-policy semantics, real telemetry seeding, or chart dependency changes
  are introduced.
