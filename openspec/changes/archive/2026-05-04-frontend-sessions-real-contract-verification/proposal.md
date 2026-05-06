## Why

The Sessions module has a complete high-fidelity handoff package and a rich
production `frontend-new` panel, but it is the last module with
`frontend-sessions-hifi-redesign` and no corresponding real-contract
verification pass. Sessions is contract-sensitive because it combines BFF
session inventory/detail/history, transcript cache behavior, usage/context
aggregates, compaction, subagent lineage, export-only local state, and
destructive session mutations.

## What Changes

- Verify the Sessions contract chain from Deck DTOs and Go BFF/runtime adapter
  routes through frontend wrappers, UI metadata, mock fixtures, visual E2E, and
  bounded real-stack evidence.
- Tighten deterministic Sessions drift where source ownership is clear,
  especially UI metadata coverage for preview/detail/history/usage/compaction,
  mutation, delete/compact confirmation, lineage, and export-only workflows.
- Preserve the existing production Sessions workbench, transcript cache,
  confirmation gates, and BFF-only browser boundary unless contract-backed drift
  requires a scoped fix.
- Treat server-side pagination/cursors, exhaustive schema-driven patch fields,
  real-time Sessions stream refresh in this panel, and destructive real session
  mutations as unsupported, projected, or skipped-safe unless current support is
  verified.
- Add or update L1 mock visual evidence and bounded L2 real-stack evidence for
  safe read paths, empty/degraded route behavior, skipped-safe mutation
  boundaries, and no direct browser Gateway access.
- Update Sessions handoff notes, OpenSpec records, tests, and generated
  artifacts only when source contract drift is confirmed.

## Capabilities

### New Capabilities

- `frontend-sessions-real-contract-verification`: Verifies and completes the
  Sessions module against the real BFF/runtime/DTO/frontend contract chain,
  including bounded real-stack evidence and deterministic drift fixes.

### Modified Capabilities

- `frontend-sessions-hifi-redesign`: Updates the Sessions high-fidelity UI
  contract to distinguish product target from currently verified
  session/history/usage/compaction/lineage behavior and skipped-safe real
  mutation boundaries.

## Impact

- `deck-go/frontend-new/src/components/panels/sessions/**`
- `deck-go/frontend-new/src/api.ts`, transcript cache/export helpers, and
  related tests if deterministic wrapper or cache drift is found
- `deck-go/contracts/source/deck-ui.contract.json`,
  `deck-go/contracts/source/deck-endpoints.contract.json`, generated UI
  metadata/docs, and contract inventories if drift is found
- `deck-go/backend/internal/server/**`, `deck-go/backend/internal/api/http/**`,
  runtime openclaw session/usage/subagent wrappers, and mock Gateway fixtures
  only for deterministic Sessions-scoped drift
- `deck-go/frontend-handoff/modules/sessions/**`
- `deck-go/test/e2e/*sessions*` mock and real-stack coverage
- `openspec/specs/frontend-sessions-hifi-redesign/spec.md` and new
  `openspec/specs/frontend-sessions-real-contract-verification/spec.md`
