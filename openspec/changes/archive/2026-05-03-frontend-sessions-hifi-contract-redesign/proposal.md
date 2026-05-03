## Why

Sessions is the next non-chat module after agents, routing, subagents, logs, and settings. It is a dense operational surface that already exercises the contract chain for session inventory, previews, detail, transcript history, usage/context, compaction checkpoints, subagent lineage, and session mutations, but it still renders through the old `deck-ui-sessions` global shell.

This change applies the contract-led high-fidelity workflow to the sessions module so the module converges visually with the settled design system while preserving the existing BFF and transcript-cache behavior.

## What Changes

- Create a complete high-fidelity sessions handoff package under `deck-go/frontend-handoff/modules/sessions/`.
- Redesign `deck-go/frontend-new/src/components/panels/sessions/` into a compact session operations workbench:
  - session inventory/search/filter/pagination
  - selected session runtime metadata and transcript preview
  - usage/context-weight timeline
  - compaction checkpoint actions
  - subagent lineage and parent/child navigation
  - transcript search/export
  - session reset/clear/patch/compact/delete actions
- Preserve current behavior for:
  - `GET /sessions`
  - `POST /chat/sessions/preview`
  - `GET /sessions/{sessionKey}`
  - `GET /chat/history`
  - `GET /usage/sessions`
  - `GET /usage/sessions/logs`
  - `POST /deck/subagents` lineage
  - `POST /chat/sessions/reset`
  - `POST /chat/sessions/clear`
  - `DELETE /chat/sessions`
  - `POST /chat/sessions/patch`
  - `POST /chat/compact`
  - compaction checkpoint list/branch/restore routes
  - transcript cache invalidation and selected-session preservation
- Add contract-shaped mock session/usage/compaction/lineage data if visual E2E gaps are found.
- Add focused mock visual E2E for the ready workbench and at least one interaction state such as transcript export, patch confirmation, compaction confirmation, or delete confirmation.
- Update cross-module readiness evidence with sessions-specific local molecules and promotion candidates.

## Capabilities

### New Capabilities

- `frontend-sessions-hifi-redesign`: Covers the sessions handoff package, production UI rewrite, contract-shaped mocks, mock visual evidence, and local design-system feedback.

### Modified Capabilities

- `design-system-cross-module-readiness`: Adds sessions evidence after agents/routing/subagents/logs/settings and records whether session-specific list/detail/timeline molecules remain local or need a later pattern proposal.

## Impact

- `deck-go/frontend-handoff/modules/sessions/`
- `deck-go/frontend-new/src/components/panels/sessions/`
- `deck-go/frontend-new/src/theme.css` sessions global styling removal or narrowing
- `deck-go/test/fixtures/mock-gateway.mjs` and focused Playwright visual coverage if fixture gaps are found
- `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md`
- `openspec/specs/frontend-sessions-hifi-redesign/spec.md`
- `openspec/specs/design-system-cross-module-readiness/spec.md`
