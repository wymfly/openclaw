## Why

Nodes is an existing Control panel backed by Deck BFF node inventory, pairing, invoke, and pending-work contracts, but it still uses the old dense `deck-ui-nodes*` shell and has no focused mock/local visual coverage for the real frontend. The module needs to join the high-fidelity rollout so operators can inspect device trust state, pending pairing, lifecycle readiness, permissions, command invocation, and queued work without drifting beyond the current Gateway-backed contract chain.

## What Changes

- Create a complete high-fidelity Nodes handoff package under `deck-go/frontend-handoff/modules/nodes/`.
- Redesign `deck-go/frontend-new/src/components/panels/nodes/` into a compact node operations workbench:
  - node inventory rail with connection, pairing, pending repair, platform, capability, command, and selected-state evidence
  - selected node detail surface with lifecycle guidance, versions, remote identity, path/permission evidence, and raw payload disclosure
  - pairing request surfaces for listed and orphan requests, with approve/reject/verify/request actions kept behind confirmation
  - guarded command invocation and pending-work queue controls with explicit dynamic-contract labeling
  - deterministic loading, empty, error, pending-pairing, connected, offline, unpaired, invoke, queue, rename, and pairing action states
- Preserve current API wrappers for `fetchNodes()`, `fetchNodePairing()`, `describeNode()`, `renameNode()`, `invokeNodeCommand()`, `enqueueNodePendingWork()`, `requestNodePairing()`, `approveNodePairing()`, `rejectNodePairing()`, and `verifyNodePairing()`; browser code continues to call Go BFF routes only.
- Confirm deterministic mock/local visual E2E data for `node.list`, `node.describe`, `node.rename`, `node.invoke`, `node.pending.enqueue`, `node.pair.list`, `node.pair.request`, `node.pair.approve`, `node.pair.reject`, and `node.pair.verify`; fix only deterministic mock/local drift needed for visual coverage.
- Move obsolete global `deck-ui-nodes*` styling into module-local CSS using design-system tokens and stable responsive constraints.
- Add focused mock/local visual E2E covering ready node workspace, selected node detail, pairing/action state, command invoke or pending queue state, and raw payload evidence where feasible.
- Update cross-module readiness evidence with Nodes-specific findings and node/trust/remote-control molecule candidates.

## Capabilities

### New Capabilities

- `frontend-nodes-hifi-redesign`: Covers the Nodes handoff package, production UI rewrite, mock/local visual verification, and contract/drift findings for node inventory, pairing requests, selected node lifecycle, rename, verify, command invoke, pending-work queue, permissions, and raw evidence disclosure.

### Modified Capabilities

- `design-system-cross-module-readiness`: Adds Nodes implementation evidence and classifies whether node metric tiles, inventory rows, lifecycle strips, pairing request rows, remote action forms, permission/capability chips, command/pending-work guards, and raw payload disclosures remain local, need a dedicated atom/pattern proposal, or stay as follow-up.

## Impact

- `deck-go/frontend-handoff/modules/nodes/`
- `deck-go/frontend-new/src/components/panels/nodes/`
- `deck-go/frontend-new/src/theme.css` Nodes global styling removal or narrowing
- `deck-go/test/fixtures/mock-gateway.mjs` deterministic Nodes mock data if needed
- `deck-go/test/e2e/` focused Nodes mock/local visual coverage
- `docs/design-bundles/2026-04-29-claude-design-chat-pilot/cross-module-readiness.md`
- `openspec/specs/frontend-nodes-hifi-redesign/spec.md`
- `openspec/specs/design-system-cross-module-readiness/spec.md`
