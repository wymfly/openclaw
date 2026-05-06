## Why

The Skills panel already has a high-fidelity handoff and production implementation from `frontend-skills-hifi-contract-redesign`, but that archived change primarily proved mock/local visual behavior. This module still needs the agents/channels real-contract standard: verify the Gateway-to-BFF-to-frontend contract chain against a real OpenClaw Gateway, fix deterministic drift, and record which install, ClawHub, config, and agent-matrix actions are truly safe to exercise.

## What Changes

- Treat `deck-go/frontend-handoff/modules/skills/` and the archived `frontend-skills-hifi-contract-redesign` artifacts as the visual/product baseline, not as proof of real functional readiness.
- Audit Skills capability from generated Gateway artifacts, Gateway source/method definitions, `gateway.describe`, Deck endpoint classification, Go BFF routes/adapters, frontend API wrappers, current tests, and the production `frontend-new` Skills panel.
- Build an end-to-end Skills contract-chain matrix covering installed inventory, selection, missing requirements, enable/disable, config save, install options, ClawHub bins/search/detail/install/update, agent skill matrix read/write, and unsupported authoring/trust/credential workflows.
- Fix deterministic Skills-scoped drift in contracts, Go adapters/routes, frontend wrappers, production UI, mocks, or tests when backed by real Gateway/BFF evidence.
- Add L2 real-stack API/UI verification for safe Skills reads and non-destructive interactions.
- Keep real mutations bounded: skill install/update, ClawHub install/update, config writes, and agent skill assignment writes are attempted only with disposable/reversible state; otherwise they are handoff-blocked with evidence.
- Update handoff implementation notes and OpenSpec verification evidence so later modules can reuse the same real-verification standard.

## Capabilities

### New Capabilities

- `frontend-skills-real-contract-verification`: Covers Skills real Gateway/BFF capability calibration, contract-chain mapping, code-level review, L1 mock visual evidence reuse/refresh, L2 real-stack API/UI verification, and bounded handoff for unsafe marketplace/config/assignment mutations.

### Modified Capabilities

- `frontend-skills-hifi-redesign`: Clarifies that Skills high-fidelity/mock visual completion is not real functional completion, and that production behavior must prefer real Gateway, Deck contract, and Go BFF truth over prototype assumptions.

## Impact

- **Handoff**: `deck-go/frontend-handoff/modules/skills/**`, especially `implementation-notes.md`, `api-usage.md`, and the current multi-file prototype package.
- **Contracts**: `deck-go/contracts/source/deck-api.contract.ts`, `deck-go/contracts/source/deck-endpoints.contract.json`, `deck-go/contracts/source/deck-exceptions.contract.json`, generated Deck/Gateway artifacts, and generated docs when deterministic drift is found.
- **Backend**: Go BFF Skills routes/adapters under `deck-go/backend/internal/**`, including `skills.status`, `skills.update`, `skills.install`, `skills.bins`, `skills.search`, `skills.detail`, and `deck.agents.skills.*`.
- **Frontend**: `deck-go/frontend-new/src/api.ts`, `deck-go/frontend-new/src/components/panels/skills/**`, Skills i18n copy, and module-local CSS/tests.
- **Testing**: focused Skills unit/API tests, existing or refreshed Skills mock visual E2E, focused Go route/adapter tests, and bounded real-stack API/UI verification.
- **Out of scope**: Building a full skill authoring IDE, dependency solver, credential vault, marketplace trust model, or real destructive install/config workflow without disposable state.
