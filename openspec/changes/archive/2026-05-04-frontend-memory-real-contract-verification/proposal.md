## Why

The `memory` handoff now has a fresh v2 high-fidelity prototype and multi-file React handoff package, but the production panel still reflects an earlier five-lane implementation and has not been calibrated against the real OpenClaw Gateway -> Go BFF -> frontend contract chain. Memory is the operator control plane for agent memory inspection, search, diagnostics, and dream-diary maintenance, so completion needs both visual convergence and bounded real-contract verification.

## What Changes

- Treat `deck-go/frontend-handoff/modules/memory/` as the visual/product target while anchoring production behavior to Deck DTOs, frontend wrappers, Go BFF routes, OpenClaw Gateway `agents.files.*` and `doctor.memory.*` methods, and real-stack behavior.
- Audit the full Memory contract chain for browse/read, semantic-or-degraded search, health diagnostics, dream-diary read, maintenance actions, destructive confirmation, agent selection, Markdown rendering, BFF-only browser access, and empty/error states.
- Fix deterministic Memory-scoped drift directly when backed by evidence, including stale endpoint classification, wrapper route drift, GET-vs-POST search drift, BFF route aliases, mock fixtures, frontend state/rendering gaps, i18n, tests, handoff docs, or generated contract artifacts when the source contract changes.
- Make `POST /api/memory/search` the canonical production search call from the frontend, while preserving the existing `GET /api/memory/search?q=...` route as a compatibility alias for current tests and callers.
- Translate the v2 handoff into `frontend-new` production code without adding new dependencies; Markdown rendering must use existing code or module-local primitives unless a dependency decision is explicitly approved later.
- Add L1 mock visual evidence for the production Memory panel and bounded L2 real-stack API/UI evidence for the Memory BFF contract chain. Real memory/search/dream data may be empty-valid or environment-blocked after the circuit breaker, but static code review and mock visual coverage remain mandatory.
- Record ambiguous or unsupported claims instead of fabricating guarantees: LanceDB availability, semantic ranking quality, dream action progress streaming, audit-feed integration, memory editing, search history persistence, and production ACL/scope enforcement details.

## Capabilities

### New Capabilities

- `frontend-memory-real-contract-verification`: Covers Memory production implementation review, real contract-chain audit, deterministic scoped fixes, mock visual evidence, bounded real-stack evidence, circuit breaker handling, and handoff of unresolved memory/search/dream assumptions.

### Modified Capabilities

- `frontend-memory-hifi-redesign`: Clarifies that the v2 hifi handoff is the visual target, but completion now requires code-truth calibration against real Deck BFF/runtime/Gateway behavior. Unsupported search, LanceDB, dream progress, audit, editing, or ACL assumptions must be recorded unless verified.

## Impact

- **Handoff**: `deck-go/frontend-handoff/modules/memory/**`, especially `README.md`, `api-usage.md`, and `implementation-notes.md`.
- **Contracts**: `deck-go/contracts/source/deck-api.contract.ts`, `deck-go/contracts/source/deck-endpoints.contract.json`, `deck-go/contracts/source/deck-ui.contract.json`, generated Deck DTOs/docs only if deterministic source drift is found.
- **Backend**: Memory BFF routes under `deck-go/backend/internal/server/` and `deck-go/backend/internal/api/http/`, OpenClaw runtime adapters, Gateway method mapping, and focused route tests if drift is found.
- **Frontend**: `deck-go/frontend-new/src/api.ts`, `deck-go/frontend-new/src/components/panels/memory/**`, i18n copy, mock fixtures, and focused tests.
- **Testing**: focused Memory unit tests, mock visual E2E, and bounded real-stack Memory API/UI E2E.
- **Out of scope**: adding new Gateway RPC methods, introducing a Markdown/search/chart dependency without explicit dependency approval, implementing memory editing, implementing dream-action progress streaming, guaranteeing LanceDB semantic quality, adding Activity audit rows, or changing production auth/scope enforcement beyond reflecting existing BFF behavior.
