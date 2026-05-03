## Why

The first `frontend-new` agents rebuild established the contract chain and a usable panel, but it predates the stricter chat parity lessons: the module still lacks a Codex-owned high-fidelity handoff, mock-backed visual E2E evidence, and a disciplined design-system feedback record. Agents is the best next module to harden because routing, subagents, sessions, and operational views all depend on its identity and status vocabulary.

## What Changes

- Replace the current agents visual target with a new contract-led, enterprise-density high-fidelity handoff package in `deck-go/frontend-handoff/modules/agents/`.
- Rework `frontend-new` agents UI against that handoff while preserving the existing panel shell, API facade, shared agents store, and backend-supported contract boundaries.
- Add mock-backed agents visual E2E coverage that opens the production `frontend-new` panel with contract-shaped data and captures the primary list/detail/create/error states needed for visual review.
- Record design-system feedback for the module: which molecules remain local, which patterns are candidates for later cross-module promotion, and whether any token/atom changes are actually needed.
- Fix only deterministic contract/API/mock drift discovered during implementation; uncertain Gateway or product-contract gaps remain documented in `api-discrepancy.md`, `implementation-notes.md`, or OpenSpec follow-up tasks.
- No new runtime dependencies and no canonical atom/token additions unless the implementation proves a narrow, cross-module, backwards-compatible need.

## Capabilities

### New Capabilities

- `frontend-agents-hifi-redesign`: Covers the agents module handoff package, production UI convergence, mock visual E2E coverage, and design-system feedback loop.

### Modified Capabilities

- `design-system-cross-module-readiness`: Adds agents-specific readiness and completion evidence to the cross-module rollout record without changing the additive-only atom policy.

## Impact

- **Handoff**: `deck-go/frontend-handoff/modules/agents/{README.md,prototype.html,components.md,states.md,interactions.md,api-usage.md,implementation-notes.md,tokens-proposal.md}`.
- **Frontend**: `deck-go/frontend-new/src/components/panels/agents/**`, focused agents tests, possible local mock/e2e helpers under `deck-go/test/e2e/**`.
- **Contracts/API**: `deck-go/contracts/source/*`, generated DTOs, `frontend-new/src/api.ts`, and `frontend-new/src/api-types.ts` only if deterministic drift is found.
- **Design system docs**: `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md` and module notes for local-vs-shared pattern decisions.
- **Verification**: OpenSpec strict validation, focused frontend tests, agents mock visual E2E, and `cd deck-go && make frontend-build`.
