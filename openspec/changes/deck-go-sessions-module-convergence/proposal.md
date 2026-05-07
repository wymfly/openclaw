## Why

The Sessions module is contract-rich but not yet product-converged. It has
useful BFF/Gateway coverage and real-stack history, but the product surface
still feels like a dense translation of available endpoints: inventory,
selected-session evidence, usage/context, compaction, lineage, transcript
search/export, mutations, and action results are all expanded in one viewport.

Sessions is a core OpenClaw control-plane workflow. It needs one pass that
starts from Gateway and Deck contract truth, confirms which session operations
are genuinely supported, resolves deterministic contract/code drift, and then
expresses those capabilities through a clearer information hierarchy.

## What Changes

- Re-audit the Sessions module against OpenClaw Gateway session APIs,
  generated Gateway artifacts, Deck BFF routes, Deck-facing DTOs, frontend API
  wrappers, production code, mock fixtures, and existing real E2E evidence.
- Update the Sessions product capability matrix so supported, degraded,
  projected, skipped-safe, adjacent-owned, and unsupported behaviors are
  explicit before UI implementation proceeds.
- Define Sessions as a session operations workbench with three product
  responsibilities:
  1. browse and locate sessions,
  2. inspect selected-session evidence,
  3. perform guarded selected-session maintenance.
- Keep live chat composition/run-control workflows (`sessions.create`,
  `sessions.send`, `sessions.abort`, `sessions.steer`) owned by Chat/runtime
  surfaces. Sessions may show selected-session context and relation navigation,
  but it must not become a second chat composer or active-run controller in
  this change.
- Classify Gateway-supported but currently BFF/product-unsurfaced knobs instead
  of silently exposing them: extra `sessions.list` filters, `sessions.preview`
  `limit/maxChars`, `sessions.compact.maxLines`, `sessions.delete`
  transcript/hook flags, and advanced `sessions.patch` execution/subagent
  fields.
- Fix deterministic Sessions-scoped contract, backend, frontend, mock, i18n,
  handoff, or test drift discovered during implementation when the correct fix
  is evidence-backed and low-risk.
- Redesign the active Sessions handoff prototype around a "list + selected
  session workbench + default-open Inspector" structure only after the
  capability matrix is aligned.
- Preserve the current `frontend-handoff/modules/sessions/prototype.html` as a
  versioned backup before replacing `prototype.html` with the new active visual
  target.
- Keep the existing Deck BFF/Gateway session contract chain and current
  request timing: usage, compaction, and lineage data still load for the
  selected session rather than becoming tab-triggered lazy requests.
- Move lower-frequency details into right-side Inspector tabs:
  `Overview`, `Usage`, `Compaction`, `Lineage`, and `Actions`.
- Keep the center workbench focused on selected-session identity, core runtime
  summary, transcript search/export, and transcript reading.
- Keep destructive or administrative actions guarded and visually isolated
  inside the `Actions` tab. Confirmation requirements must follow the current
  Deck UI metadata: reset, clear, compact, delete, and compaction restore need
  confirmation before executing.
- Treat the current reset/clear immediate execution behavior as suspected
  deterministic safety drift to confirm and fix during implementation.
- Update Sessions handoff documents, production `frontend-new` code, i18n,
  focused tests, mock visual E2E, prototype parity evidence, real Gateway
  product-surface evidence, and handoff residual-risk notes.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `deck-go-sessions-chat-contract-completion`: Sessions module convergence must
  preserve the existing Deck/Gateway contract chain, define Sessions-owned vs
  adjacent-owned workflows, and update the workflow classification if
  implementation finds deterministic drift.
- `frontend-sessions-hifi-redesign`: Sessions visual contract changes from a
  dense all-expanded three-column workbench to a contract-backed
  list/workbench/default-open Inspector tab layout with explicit browse,
  inspect, and guarded-maintenance responsibilities.
- `frontend-sessions-prototype-parity-remediation`: Sessions parity evidence
  must compare against the new active prototype while preserving the previous
  prototype as a versioned backup.
- `frontend-sessions-real-contract-verification`: Real Sessions evidence must
  continue proving the existing BFF/Gateway contract chain after the UI
  information-architecture change, including navigation, theme/locale variants,
  safe run-scoped data, guarded actions, and BFF-only browser transport.

## Impact

- **Handoff**: `deck-go/frontend-handoff/modules/sessions/**`, including a
  backup of the previous prototype and updated 6-piece handoff documentation.
- **Frontend**: `deck-go/frontend-new/src/components/panels/sessions/**`,
  Sessions i18n keys, and any local Sessions molecules needed to keep the
  panel maintainable.
- **Contracts/backend**: Sessions source contracts, generated artifacts, Go BFF
  routes, runtime OpenClaw adapter/projection code, and Gateway generated
  clients are in review scope. They are not planned edit surfaces unless
  evidence proves drift.
- **Tests/E2E**: `SessionsPanel.test.tsx`,
  `deck-go/test/e2e/sessions-visual.spec.ts`, and
  `deck-go/test/e2e/sessions-real-gateway.spec.ts` as needed for the new
  visible hierarchy.
- **Dependencies/tokens**: no new frontend dependencies, canonical atoms, or
  design tokens are planned. Reuse existing design-system atoms, tokens,
  icons, and `SegmentedControl`.
