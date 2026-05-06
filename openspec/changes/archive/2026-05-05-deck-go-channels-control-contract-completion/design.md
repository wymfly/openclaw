## Context

`channels.status-control` is degraded in the head matrix even though the
Channels panel, Deck BFF routes, generated Gateway bindings, and real read-path
smoke are already in place. The remaining issue is contract-chain closure:
operator-visible channel actions are not recorded in mutation evidence, and
throughput remains a product-visible placeholder with no real Gateway metric
source.

Prior `frontend-channels-real-contract-verification` evidence established:

- `GET /channels` is backed by typed `channels.status`.
- `POST /channels/{channelId}/test` probes by calling `channels.status` with
  `probe: true` and normalizes provider/environment failures.
- `POST /channels/{channelId}/logout` is backed by typed `channels.logout`, but
  real execution requires a configured disposable channel/account.
- `PATCH /channels/{channelId}` uses `config.get` then `config.patch` and is
  already governed by config-write safety metadata.
- `GET /channels/{channelId}/throughput` currently returns an explicit empty
  placeholder because no existing Gateway metric source was found.

## Goals / Non-Goals

**Goals:**

- Reconfirm the Channels contract chain against Gateway methods, Deck DTOs, BFF
  routes, config-write safety, frontend facades, tests, and prior real evidence.
- Add mutation evidence for channel probe/test, logout, and config patch actions.
- Preserve response DTOs and browser-to-BFF boundaries while acknowledging
  mutation evidence in representative frontend facades.
- Keep real logout/config mutation automation skipped-safe or deferred unless
  disposable state is proven.
- Update Channels notes, the head matrix, generated matrix Markdown, and head
  evidence.

**Non-Goals:**

- Do not add Gateway APIs, new channel creation, or real throughput metrics.
- Do not redesign the Channels UI.
- Do not add first-class `accountDiagnostics`, `wecomAccess`, or provider
  onboarding DTOs in this pass.
- Do not mutate the user's real channel config or logout real channel accounts
  without disposable fixture proof.

## Decisions

### Decision: Treat channel probe as evidence-known but safe-read-derived

`POST /channels/{channelId}/test` is user-triggered and provider-environment
dependent, even though it derives from `channels.status` instead of writing
config. It should be recorded in mutation evidence so real E2E and UI claims
can distinguish safe probe execution from normal inventory reads.

Alternative rejected: leave probe as an ordinary read. That hides the
provider-dependent side effect and makes real automation look safer than it is.

### Decision: Use config-write safety as the patch conflict authority

`channels.config.patch` already has base-hash and conflict semantics in the
config-write safety contract. Mutation evidence should reference that authority
instead of redefining patch behavior.

Alternative rejected: introduce a Channels-only patch contract. That would fork
the shared config-write lane used by other configuration modules.

### Decision: Keep throughput degraded until a real metric source exists

The current BFF returns zero totals and empty buckets. The product contract can
claim that the endpoint is present and honestly renders unavailable/empty
state, but it must not claim traffic observability until Gateway or Deck exposes
a real metric source.

Alternative rejected: use prototype fixture bars as production evidence. That
would turn mock visual data into a false contract claim.

## Risks / Trade-offs

- **Risk:** Mutation evidence may be read as permission to run real channel
  logout/config writes.  
  **Mitigation:** Mark logout skipped-safe and config patch deferred unless
  disposable channel/config state is proven.

- **Risk:** Channel probe looks like a pure read in code but can touch provider
  hooks.  
  **Mitigation:** Record fixture safety and external environment dependence in
  mutation evidence and implementation notes.

- **Risk:** Throughput remains useful only as an unavailable-state UI.  
  **Mitigation:** Keep matrix status honest and record real metric collection as
  unsupported/deferred, not product-complete.

## Migration Plan

1. Add Channels action rows to mutation evidence and regenerate metadata/docs.
2. Route `testChannel`, `logoutChannel`, and `patchChannelConfig` through
   mutation evidence helpers without changing response DTOs.
3. Add focused tests for Channels mutation evidence and facade behavior.
4. Update Channels implementation notes, matrix rows, head evidence, and
   generated matrix Markdown.
5. Run focused contract checks, frontend tests, frontend build, contract-gate,
   OpenSpec validation, diff check, then archive.
