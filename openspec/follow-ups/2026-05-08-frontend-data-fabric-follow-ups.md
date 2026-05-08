# Frontend Data Fabric Follow-Ups

This file tracks follow-up candidates from the frontend Data Fabric program.
It is not an active OpenSpec proposal. Promote entries into OpenSpec changes or
small plans only after the next scope is selected.

## FU-001: Commit Data Fabric program safely

- **Status**: candidate
- **Source**: `docs/superpowers/specs/2026-05-08-frontend-data-fabric-implementation-review.md` F-2; `git status --short`
- **Classification**: must-fix-before-commit
- **Fact baseline**: Data Fabric implementation files, OpenSpec archives/specs,
  review records, governance fixes, and workflow-rule files remain uncommitted;
  the same worktree also contains unrelated `extensions/wecom/**`,
  `deploy/STATUS.md`, and other non-Data-Fabric changes.
- **Why not now**: Commit grouping must avoid staging unrelated worktree edits.
- **Suggested next step**: Commit Data Fabric program files and process-rule
  files in explicit groups; keep unrelated extension/deploy changes unstaged.
- **Acceptance hints**: `git status --short` shows no remaining uncommitted Data
  Fabric program files after the commit group; unrelated worktree changes remain
  visible and unstaged.
- **Links**: `docs/superpowers/specs/2026-05-08-frontend-data-fabric-implementation-review.md`

## FU-002: Move default runtime id into the contract chain

- **Status**: resolved
- **Source**: implementation review F-3; current mirror
  `deck-go/frontend-new/src/lib/runtime-id.ts`
- **Classification**: next-openspec
- **Fact baseline**: Frontend now uses `DEFAULT_RUNTIME_ID` from
  `frontend-new/src/lib/runtime-id.ts`, mirroring
  `deck-go/backend/internal/runtime/runtimeid/default.go`. The value is still
  not generated from Deck-facing contract authority.
- **Why not now**: Resolved by
  `deck-go-data-fabric-contract-and-transport-cleanup`.
- **Suggested next step**: Keep future frontend defaults routed through
  `frontend-new/src/lib/runtime-id.ts`; do not add new production `"rt_local"`
  literals.
- **Acceptance hints**: Satisfied by generated `DeckGoDefaultRuntimeId`, the
  frontend bridge import, `go test ./internal/runtime/runtimeid`, focused
  frontend tests, and `make contract-gate`.
- **Links**: `deck-go/frontend-new/src/data/contracts/query-keys.ts`,
  `deck-go/frontend-new/src/lib/gateway-client.ts`,
  `openspec/changes/deck-go-data-fabric-contract-and-transport-cleanup`

## FU-003: Split Gateway RPC client reuse from per-request tracing

- **Status**: resolved
- **Source**: implementation review F-4 and Codex cross-review rejection note
- **Classification**: next-openspec
- **Fact baseline**: `createGatewayRpcTransport()` currently creates a
  `DeckGatewayClient` for each source request. Simple client caching would also
  cache `createDeckGatewayTransport()` state and reuse `X-Request-Id`, which is
  not acceptable for tracing.
- **Why not now**: Resolved by
  `deck-go-data-fabric-contract-and-transport-cleanup`.
- **Suggested next step**: Keep default request id generation inside request
  execution; only cache clients/transports when they do not capture default
  tracing state.
- **Acceptance hints**: Satisfied by `gateway-client.test.ts` fresh default
  request-id coverage, explicit request-id coverage, and
  `gateway-rpc.test.ts` client reuse coverage.
- **Links**: `deck-go/frontend-new/src/data/transport/gateway-rpc.ts`,
  `deck-go/frontend-new/src/lib/gateway-client.ts`,
  `openspec/changes/deck-go-data-fabric-contract-and-transport-cleanup`

## FU-004: Clarify numeric key sorting in stable query keys

- **Status**: resolved
- **Source**: implementation review F-6
- **Classification**: backlog
- **Fact baseline**: `stableValue()` sorts object keys deterministically with
  default string ordering. Current filters mostly use string field names, so no
  unstable cache key is known.
- **Why not now**: Resolved by
  `deck-go-data-fabric-contract-and-transport-cleanup`.
- **Suggested next step**: Keep current deterministic serialization unless a real
  filter needs different numeric semantics.
- **Acceptance hints**: Satisfied by `query-keys.test.ts` coverage for
  numeric-like filter keys and equivalent object filters.
- **Links**: `deck-go/frontend-new/src/data/contracts/query-keys.ts`,
  `openspec/changes/deck-go-data-fabric-contract-and-transport-cleanup`

## FU-005: Improve per-module Data Fabric test granularity

- **Status**: candidate
- **Source**: implementation review F-7
- **Classification**: backlog
- **Fact baseline**: Agents has reference-level unit tests; many other modules
  are covered through cross-module integration tests, which prove behavior but
  can make failures harder to localize.
- **Why not now**: Existing integration tests cover key transport/query/mutation
  paths; broad test splitting is maintainability work.
- **Suggested next step**: Add per-module tests only for high-churn modules such
  as sessions, skills, models, gateway, or modules that fail repeatedly.
- **Acceptance hints**: new tests do not duplicate broad integration coverage
  without adding faster diagnosis value.
- **Links**: `deck-go/frontend-new/src/data/modules/`

## FU-006: Consider renderHook-based Data Fabric integration tests

- **Status**: candidate
- **Source**: implementation review F-8
- **Classification**: backlog
- **Fact baseline**: Current integration tests use raw `createRoot + act`
  probes. They are stable but verbose.
- **Why not now**: Readability-only cleanup; should not be mixed into contract
  or behavior changes.
- **Suggested next step**: If test maintenance becomes costly, migrate one
  representative integration test to `renderHook` and compare readability before
  converting the rest.
- **Acceptance hints**: test assertions and behavior coverage remain unchanged.
- **Links**: `deck-go/frontend-new/src/data/modules/*test.tsx`

## FU-007: Keep advanced Data Fabric hardening explicitly deferred

- **Status**: deferred
- **Source**: `deck-go/frontend-new/CLAUDE.md`; `deck-go/frontend-new/src/data/README.md`
- **Classification**: explicitly-deferred
- **Fact baseline**: Mutation retry, offline mutation queue/replay, IndexedDB
  query persistence, custom oxlint enforcement, generated live projection
  `patchStrategy/patchKeys`, broad prefetch, and DevTools are intentionally not
  part of the current Data Fabric baseline.
- **Why not now**: Each item changes product/runtime semantics or developer
  workflow and needs its own OpenSpec requirements plus acceptance criteria.
- **Suggested next step**: Promote only one item at a time after real E2E and
  module productization expose a concrete need.
- **Acceptance hints**: Any promoted item states exact data classes, safety
  rules, user-visible behavior, and rollback/failure semantics.
- **Links**: `deck-go/frontend-new/CLAUDE.md`,
  `deck-go/frontend-new/src/data/README.md`

## FU-008: Resolve frontend-new protocol debt outside Data Fabric

- **Status**: candidate
- **Source**: `deck-go/frontend-new/CLAUDE.md`
- **Classification**: next-openspec
- **Fact baseline**: frontend-new still documents protocol debt such as the i18n
  compat shim, legacy `frontend/` archival, and module completion manifests /
  reverse sign-off completeness.
- **Why not now**: These are frontend workspace protocol tasks, not Data Fabric
  server-state architecture tasks.
- **Suggested next step**: Create separate frontend protocol proposals when the
  relevant workflow becomes the bottleneck.
- **Acceptance hints**: module handoff README status, reverse sign-off, and
  evidence manifests become canonical without changing Data Fabric behavior.
- **Links**: `deck-go/frontend-new/CLAUDE.md`
