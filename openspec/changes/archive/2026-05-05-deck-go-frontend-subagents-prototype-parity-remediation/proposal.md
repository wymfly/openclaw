## Why

The Subagents module has an active v2 handoff package and an existing
`frontend-new` implementation, but the head remediation matrix still classifies
it as mock-functional with prototype parity unreviewed. Existing evidence covers
basic runs, permissions, steer, kill, route shapes, and BFF-only access, but it
does not meet the strengthened head standard: prototype-current visual parity,
Deck shell navigation from another module, all four theme/locale variants, safe
child surfaces, representative real route evidence, safe mutation circuit
breakers, unexpected-error recording, and structured accepted exceptions.

Subagents is a mixed operational/configuration surface. It must stay grounded in
the current typed contract chain:

- `deck.subagents.list`;
- `deck.subagents.lineage`;
- `deck.subagents.kill`;
- `deck.subagents.steer`;
- `deck.agents.subagents.get`;
- `deck.agents.subagents.set`.

The active prototype includes a denser run inventory, permissions mode, detail
tabs, lineage, raw/outcome views, steer/kill dialogs, and permission editing.
Code truth still wins over prototype-only assumptions such as REST-shaped routes,
`stalled` taxonomy, audit routes, kill cascade, and client-generated steer
dedup keys.

## What Changes

- Reconcile the active Subagents prototype at
  `deck-go/frontend-handoff/modules/subagents/prototype.html` with contract
  truth from:
  - `contracts/source/deck-api.contract.ts`;
  - `contracts/source/deck-ui.contract.json`;
  - `contracts/source/deck-mutations.contract.json`;
  - generated Gateway protocol artifacts;
  - Go BFF routes;
  - `frontend-handoff/modules/subagents/api-usage.md`;
  - `frontend-handoff/modules/subagents/api-discrepancy.md`;
  - frontend API wrappers and production panel code.
- Audit the current `frontend-new` Subagents implementation against the active
  runs/permissions/detail prototype, fixing deterministic visual, interaction,
  i18n, fixture, route-wrapper, mutation-evidence, or documentation drift when
  code truth supports it.
- Preserve supported product capabilities:
  - run list, search, status filters, spawn filters, and selected run detail;
  - lineage lookup and lineage tree;
  - outcome/raw payload inspection;
  - permissions mode and per-agent allow-list editing with `configHash`;
  - steer and kill actions through confirmation/dialog gates;
  - global defaults as read-only context;
  - audit as an honest unsupported/degraded projection.
- Strengthen mock visual evidence with prototype/current screenshots, dense
  runs, permissions mode, detail tabs, lineage, raw/outcome, steer/kill dialogs,
  permission editing, all localized theme variants, and accepted exceptions.
- Strengthen real Gateway E2E with Chat -> Subagents shell navigation, dark/en,
  dark/zh, light/en, light/zh, route-shape checks, safe disposable run or
  skipped-safe mutation outcomes, BFF-only browser transport checks,
  unexpected-error checks, and circuit-break evidence when the real stack has no
  active disposable subagent run.
- Update Subagents implementation notes, the remediation matrix, and head task
  `6.10` after evidence is recorded.

## Capabilities

### New Capabilities

- `frontend-subagents-prototype-parity-remediation`: Defines
  Subagents-specific prototype parity remediation, contract-truth calibration,
  real evidence policy, accepted exceptions, and archive criteria.

### Modified Capabilities

- `frontend-prototype-parity-remediation`: Adds a Subagents row verdict and
  evidence status after this child archives.

## Impact

- Frontend:
  - `deck-go/frontend-new/src/components/panels/subagents/`;
  - `deck-go/frontend-new/src/i18n/en.json`;
  - `deck-go/frontend-new/src/i18n/zh.json`;
  - `deck-go/frontend-new/src/api.ts` only if deterministic wrapper drift is
    found.
- E2E and mocks:
  - `deck-go/frontend-new/src/components/panels/subagents/SubagentsPanel.test.tsx`;
  - `deck-go/test/e2e/subagents-visual.spec.ts`;
  - `deck-go/test/e2e/subagents-real-gateway.spec.ts`;
  - `deck-go/test/fixtures/mock-gateway.mjs`.
- Contracts:
  - no intended DTO expansion;
  - prototype-only audit, stalled/killed taxonomy, kill cascade, and dedup-key
    ergonomics remain follow-up decisions unless Gateway contract truth already
    supports them.
- Documentation and matrix:
  - `deck-go/frontend-handoff/modules/subagents/implementation-notes.md`;
  - `deck-go/docs/project/frontend-prototype-remediation-matrix.md`.
- OpenSpec:
  - this child change;
  - governing head task `6.10`.
