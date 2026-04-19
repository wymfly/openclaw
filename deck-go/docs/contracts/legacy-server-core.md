# Legacy Server Core

This document captures the top-level local control-plane modules currently living in
`dashboard/server/`.

## Core files

- `access-gate.ts`
- `alert-engine.ts`
- `approval-bridge.ts`
- `budget-alert-stores.ts`
- `contracts.ts`
- `deck-settings.ts`
- `device-identity.ts`
- `event-bus.ts`
- `gateway-adapter.ts`
- `gateway-allowlist.ts`
- `gateway-errors.ts`
- `health-poller.ts`
- `index.ts`
- `json-store.ts`
- `node-connection.ts`
- `rate-limit.ts`
- `run-aggregator.ts`
- `runtime.ts`

Top-level core file count: `18`

## Immediate migration implication

Legacy Deck already has a real local control-plane runtime. The Go backend is not inventing a new role; it is extracting and re-owning an existing one.

## Critical subset for backbone-first migration

- `runtime.ts`
- `gateway-adapter.ts`
- `event-bus.ts`
- `access-gate.ts`
- `deck-settings.ts`
- `json-store.ts`
- `contracts.ts`
- `node-connection.ts`

These are the first files to treat as contract/runtime extraction surfaces rather than implementation details.
