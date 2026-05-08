## Why

The Data Fabric program left a small set of accepted follow-ups around runtime
identity authority and Gateway RPC transport construction. These are narrow
cleanup items that should be resolved before the server-state layer becomes the
reference pattern for more frontend work.

## What Changes

- Move the frontend default runtime id away from a hand-maintained mirror and
  into the deck-go contract chain, or explicitly document a contract-owned
  generated path if implementation discovers an existing authority.
- Refine Gateway RPC transport construction so reusable client/method state can
  be reused without reusing per-request tracing state such as `X-Request-Id`.
- Add a small query-key stability test documenting numeric-like object key
  ordering, without changing key semantics unless the test exposes a real
  instability.
- Update Data Fabric follow-up status once the promoted follow-ups are resolved.
- Keep advanced Data Fabric hardening deferred: no mutation retry, offline
  queue, IndexedDB persistence, DevTools, custom lint, prefetch expansion, or
  generated live projection patch fields in this change.

## Capabilities

### New Capabilities

- `deck-go-data-fabric-contract-and-transport-cleanup`: Follow-up cleanup for
  default runtime id authority, Gateway RPC tracing/client construction, and
  query-key ordering documentation.

### Modified Capabilities

- `deck-go-data-fabric-foundation`: Clarifies that Data Fabric runtime keys and
  Gateway RPC transport behavior must use contract-owned runtime identity and
  preserve per-request tracing semantics.

## Impact

- Contract source and generated artifacts if a default runtime id constant is
  added to the contract chain.
- Frontend Data Fabric query key and Gateway client/transport helpers:
  `deck-go/frontend-new/src/data/contracts/query-keys.ts`,
  `deck-go/frontend-new/src/data/transport/gateway-rpc.ts`,
  `deck-go/frontend-new/src/lib/gateway-client.ts`.
- Focused tests for query keys, Gateway client/transport behavior, TypeScript
  build, and contract gates touched by any generated artifact update.
- Follow-up tracking in
  `openspec/follow-ups/2026-05-08-frontend-data-fabric-follow-ups.md`.
