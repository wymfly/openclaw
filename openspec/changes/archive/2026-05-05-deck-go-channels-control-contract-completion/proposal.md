## Why

Channels already has real read-path evidence and a production UI, but the
head matrix still marks the module degraded because product-visible actions and
throughput claims are not closed against contract truth. Now that dynamic
surface hardening, config-write safety, and safe mutation evidence exist,
Channels needs a focused closure pass rather than another visual rewrite.

## What Changes

- Re-audit current Channels workflows against Gateway `channels.status` /
  `channels.logout`, Deck BFF routes, generated DTOs, endpoint classification,
  config-write safety, frontend facades, prior L1/L2 evidence, and handoff
  notes.
- Add mutation evidence rows for channel probe/test, logout, and config patch
  actions, while keeping real logout/config mutation skipped-safe or deferred
  unless disposable channel/config state is proven.
- Route representative Channels action facades through shared mutation
  evidence helpers without changing response DTOs or browser-to-BFF boundaries.
- Keep throughput explicitly degraded/unavailable when the BFF returns its
  current empty placeholder; do not promote prototype traffic bars into product
  truth.
- Update Channels implementation notes, the contract-chain audit matrix,
  generated matrix Markdown, and head verification evidence.

## Capabilities

### New Capabilities

- `deck-go-channels-control-contract-completion`: Completes the Channels module
  contract-chain by mapping channel inventory, safe probes, logout, config
  patching, and throughput availability to Gateway-backed or explicitly
  degraded Deck-facing contracts and evidence.

### Modified Capabilities

- None.

## Impact

- Affected contract metadata:
  `deck-go/contracts/source/deck-mutations.contract.json` and generated
  mutation evidence docs/TypeScript metadata.
- Affected frontend: `frontend-new/src/api.ts`, Channels/API focused tests, and
  mutation evidence helper usage where applicable.
- Affected docs/evidence: Channels implementation notes, contract-chain audit
  matrix, generated matrix Markdown, and head proposal verification evidence.
- Backend changes are only in scope if exploration finds deterministic
  Channels route, adapter, or DTO drift. No new Gateway APIs are introduced.
