# Nodes Handoff

Status: ready for production rewrite under `frontend-nodes-hifi-contract-redesign`.

## Contract Truth

- Browser entry points:
  - `fetchNodes()` -> `GET /api/nodes`
  - `describeNode(nodeId)` -> `POST /api/nodes` with `action: "describe"`
  - `renameNode(nodeId, displayName)` -> `POST /api/nodes` with `action: "rename"`
  - `invokeNodeCommand(nodeId, command, params, timeoutMs)` -> `POST /api/nodes` with `action: "invoke"`
  - `enqueueNodePendingWork(params)` -> `POST /api/nodes` with `action: "pending.enqueue"`
  - `fetchNodePairing()` -> `GET /api/nodes/pair`
  - `requestNodePairing(params)` / `approveNodePairing(requestId)` / `rejectNodePairing(requestId)` / `verifyNodePairing(nodeId, token)` -> `POST /api/nodes/pair`
- Deck-facing DTO authority:
  - `DeckGoNodeSummary`
  - `DeckGoPairingRequest`
  - `DeckGoNodesResponse`
  - `DeckGoNodePairingResponse`
  - `DeckGoNodePairRequestInput`
  - `DeckGoNodePairRequestResponse`
  - `DeckGoNodeInvokeResponse`
  - `DeckGoNodePendingEnqueueResponse`
- Backend/Gateway chain:
  - Go routes: `deck-go/backend/internal/server/inventory.go`
  - Gateway typed methods: `node.list`, `node.describe`, `node.rename`, `node.pair.list`, `node.pair.request`, `node.pair.approve`, `node.pair.reject`, `node.pair.verify`
  - Active dynamic exceptions: `node.invoke`, `node.pending.enqueue`

## Product Frame

Nodes is a trust and remote-control operations workbench. Operators need to inspect device inventory, pending pairing, lifecycle readiness, permissions, commands, and dynamic actions without confusing mock/local evidence with production trust or remote-control assurance.

## Workflow Constraints

- Keep all browser traffic behind the Go BFF. Do not call Gateway directly.
- Keep `node.invoke` and `node.pending.enqueue` visually guarded as dynamic envelopes because upstream schemas are not available.
- Keep pairing actions confirmation-gated.
- Keep orphan pairing requests actionable without requiring `node.describe`.
- Keep unsupported concepts out of the UI: automatic pairing approval, trust proofing, command schema authoring, token generation, remote shell streaming, file transfer, location visualization, and production remote-control safety guarantees.
- Label mock/local visual tests as mock/local evidence only.

## Implementation Notes

- First viewport should expose:
  - load/connection/pairing status
  - node count and pending count
  - selected node lifecycle
  - pending pairing or repair signal
  - guarded rename/pairing/invoke/queue actions
  - capability, command, permission, and payload evidence
- Dynamic action flow remains confirmation-first: edit params -> confirm -> BFF action -> raw result evidence.
- Pairing flow remains request-aware: pending request -> approve/reject, unpaired node -> request/verify, orphan request -> approve/reject only.

## Open Questions

- Whether future Gateway contracts will expose typed command schemas for advertised commands.
- Whether `node.pending.enqueue` should graduate to a typed Deck-facing pending-work DTO.
- Whether production pairing should surface richer trust proofing or audit events.
