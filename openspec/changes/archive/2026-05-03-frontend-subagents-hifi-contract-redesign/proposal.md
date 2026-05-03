## Why

Subagents is the natural third module after agents and routing because it combines agent identity, run/session lineage, steering/kill operations, and global spawn defaults. The current panel has useful behavior but no handoff package, still uses the old global shell styling, and has a deterministic BFF drift where child-agent filtering is sent by the frontend but not forwarded by the backend route.

## What Changes

- Create a complete high-fidelity subagents handoff package under `deck-go/frontend-handoff/modules/subagents/`.
- Redesign `deck-go/frontend-new/src/components/panels/subagents/` into a contract-led subagent operations workbench for active runs, history, lineage, steering/kill, per-agent permissions, and global defaults.
- Fix the deterministic `/deck/subagents` child-agent filter forwarding drift so `agentId` reaches the runtime/Gateway adapter.
- Add contract-shaped mock Gateway data and a focused mock visual E2E for the ready workbench and an interaction state.
- Record subagents design-system evidence after agents and routing, including whether repeated local molecules are ready for promotion or should remain local.

## Capabilities

### New Capabilities

- `frontend-subagents-hifi-redesign`: Covers the subagents handoff package, production UI rewrite, deterministic BFF filter drift fix, contract-shaped mocks, and mock visual evidence.

### Modified Capabilities

- `design-system-cross-module-readiness`: Adds subagents as the third high-fidelity module and records promotion decisions for repeated agents/routing/subagents molecules.

## Impact

- `deck-go/frontend-handoff/modules/subagents/`
- `deck-go/frontend-new/src/components/panels/subagents/`
- `deck-go/backend/internal/server/inventory.go`
- `deck-go/test/fixtures/mock-gateway.mjs` and focused Playwright visual coverage
- `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md`
- `openspec/specs/frontend-subagents-hifi-redesign/spec.md`
- `openspec/specs/design-system-cross-module-readiness/spec.md`
