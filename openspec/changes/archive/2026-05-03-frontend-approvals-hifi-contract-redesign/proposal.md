## Why

Approvals is an existing Automate panel with real Deck-facing BFF routes for pending exec approvals, plugin approvals, approval policy editing, decisions, and live approval events, but the UI still uses the legacy dense `deck-ui-approvals` global shell. The module needs to join the contract-led high-fidelity rollout so security-sensitive approval queues and policy state can be visually validated before the remaining Automate/Control panels are rebuilt.

## What Changes

- Create a complete high-fidelity Approvals handoff package under `deck-go/frontend-handoff/modules/approvals/`.
- Redesign `deck-go/frontend-new/src/components/panels/approvals/` into a compact approval operations workbench:
  - pending exec approvals with command, cwd, agent, session, run, created/expiry, and raw approval payload evidence
  - plugin approvals with plugin id, command, description, status, decision, expiry, and raw payload evidence
  - policy defaults, agent overrides, allowlist paths, structured policy editor, base hash, and raw policy payload evidence
  - allow-once, allow-always, deny, refresh, open agent/session, policy save, stream update, and last-action evidence
- Preserve the current frontend API wrapper behavior for `fetchApprovalsPolicy`, `fetchPendingApprovals`, `fetchPluginApprovals`, `resolveApproval`, `resolvePluginApproval`, and `updateApprovalsPolicy`; browser code continues to call the Go BFF routes only.
- Confirm deterministic mock/local visual E2E data seeding for approval queues, plugin queues, policy state, and SSE updates; fix only deterministic drift needed for mock visual coverage.
- Move obsolete global `deck-ui-approvals*` styling into module-local CSS using design-system tokens and stable responsive constraints.
- Add focused mock/local visual E2E covering ready queues/detail, exec/plugin surface switching, policy editing, decision result, and stream update state where feasible.
- Update cross-module readiness evidence with Approvals-specific findings and security/policy/queue molecule candidates.

## Capabilities

### New Capabilities

- `frontend-approvals-hifi-redesign`: Covers the Approvals handoff package, production UI rewrite, mock/local visual verification, and local contract/drift findings for exec approval, plugin approval, and policy operations.

### Modified Capabilities

- `design-system-cross-module-readiness`: Adds Approvals implementation evidence and classifies whether approval queue rows, decision action groups, policy default controls, allowlist path rows, plugin approval rows, live stream markers, and raw policy/action evidence remain local, need a dedicated atom/pattern proposal, or stay as follow-up.

## Impact

- `deck-go/frontend-handoff/modules/approvals/`
- `deck-go/frontend-new/src/components/panels/approvals/`
- `deck-go/frontend-new/src/theme.css` Approvals global styling removal or narrowing
- `deck-go/test/fixtures/mock-gateway.mjs` or E2E setup only if deterministic mock visual gaps are found
- `deck-go/test/e2e/` focused Approvals mock/local visual coverage
- `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md`
- `openspec/specs/frontend-approvals-hifi-redesign/spec.md`
- `openspec/specs/design-system-cross-module-readiness/spec.md`
