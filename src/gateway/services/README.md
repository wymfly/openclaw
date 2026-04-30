# Gateway Services

The service layer is the v1 boundary between fork-owned gateway handlers and
OpenClaw internals.

## Contract

- Services are pass-through facades over existing internal modules.
- Every service exposes `version: 1`; breaking changes require a new versioned
  factory instead of changing the v1 contract silently.
- Services do not cache, memoize, start timers, register listeners, or perform
  work at import time.
- Handlers may depend on services, gateway protocol/schema helpers, and
  gateway-local constants.
- `model-provenance.ts` is a gateway-local composition helper shared by
  `deck-auth` and `models.configured`; it is not a tenth versioned service
  interface and does not change the nine-service v1 contract.
- Every internal symbol consumed by `src/gateway/server-methods/deck/**/*.ts`
  `src/gateway/server-methods/deck-auth.ts`, or
  `src/gateway/server-methods/models-configured.ts` must be reachable through
  a service or gateway-local helper, unless it is listed as an escape hatch
  here.

## Escape Hatches

- `DEFAULT_EVENT_STREAMS` is intentionally not wrapped. It is defined in
  `src/gateway/channel-event-filter.ts`, which is gateway-local fork code rather
  than an OpenClaw internal module.
