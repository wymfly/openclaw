## Context

`frontend-new` already contains a functional `NodesPanel` under the `nodes` panel id. It calls Deck-facing wrappers for node inventory, pairing, command invocation, rename, verify, and pending work:

- `fetchNodes()` -> `GET /api/nodes`
- `describeNode(nodeId)` / `renameNode(...)` / `invokeNodeCommand(...)` / `enqueueNodePendingWork(...)` -> `POST /api/nodes`
- `fetchNodePairing()` -> `GET /api/nodes/pair`
- `requestNodePairing(...)` / `approveNodePairing(...)` / `rejectNodePairing(...)` / `verifyNodePairing(...)` -> `POST /api/nodes/pair`

Deck-facing DTO authority is `deck-go/contracts/source/deck-api.contract.ts`, generated into `DeckGoNodeSummary`, `DeckGoPairingRequest`, `DeckGoNodesResponse`, `DeckGoNodePairingResponse`, `DeckGoNodePairRequestInput`, `DeckGoNodePairRequestResponse`, `DeckGoNodeInvokeResponse`, and `DeckGoNodePendingEnqueueResponse`.

Gateway-facing typed coverage exists for `node.list`, `node.describe`, `node.rename`, and the `node.pair.*` methods. `node.invoke` and `node.pending.enqueue` remain active contract exceptions because upstream lacks stable schemas for dynamic node action payloads and pending-work results. The UI can expose those workflows, but it must label them as dynamic remote-control surfaces rather than implying fully typed command semantics.

The current UI preserves the important workflows, but it is visually still an old global `deck-ui-nodes*` control shell. The gap is visual and verification convergence: inventory, selected detail, lifecycle, pending pairing, permissions, command invoke, pending queue, and raw evidence need a contract-led workbench layout and focused mock/local visual E2E.

## Goals / Non-Goals

**Goals:**

- Produce a complete Nodes handoff package.
- Rewrite Nodes into a high-fidelity node operations workbench aligned with the current design-system posture.
- Preserve load/error handling, node selection, pending pairing selection, orphan pairing handling, describe-on-select, rename, request/approve/reject/verify pairing, command invoke, pending-work enqueue, permissions/capabilities/commands rendering, payload disclosure, confirmations, and localization.
- Add deterministic mock/local visual coverage for ready workspace, selected node detail, pending pairing/action state, and at least one remote action result.
- Record Nodes-specific design-system feedback without silently promoting atoms or patterns.

**Non-Goals:**

- No new Gateway method, BFF endpoint, event stream, or Deck-facing DTO contract unless implementation proves deterministic mismatch.
- No browser-side direct Gateway call.
- No automatic pairing approval, token generation, command schema authoring, remote shell streaming, file transfer, device health monitoring, location visualization, or production remote-control safety guarantee.
- No attempt to type `node.invoke` or `node.pending.enqueue` beyond the current Deck-facing wrapper/result envelope.
- No new dependencies, table libraries, command-schema form libraries, terminal libraries, map libraries, or date libraries.
- No canonical design-system atom/pattern promotion inside this module change.

## Decisions

1. **Treat Nodes as a trust and remote-control operations workbench.**
   The first viewport should show inventory health, pending trust state, selected node lifecycle, remote identity evidence, and guarded actions rather than presenting a flat device list.

2. **Preserve the Deck BFF contract boundary.**
   Nodes remains Deck BFF traffic. The rewrite keeps wrappers and route paths, and browser code continues to avoid direct Gateway calls.

3. **Keep dynamic remote actions visually guarded.**
   `node.invoke` and `node.pending.enqueue` stay usable because the current BFF exposes them, but the UI should identify command params, timeout, idempotency, queue priority, and wake behavior as dynamic evidence rather than fabricated typed command schemas.

4. **Use module-local node, pairing, lifecycle, action, and permission molecules.**
   Nodes repeats compact workbench patterns from prior modules but adds trust/remote-control semantics. Promotion waits for a separate design-system proposal after another control-heavy module validates the same API shape.

5. **Make mock/local visual seeding deterministic through mock Gateway fixtures.**
   The visual E2E should exercise the real frontend against bundled mock Gateway node methods. No real device, real pairing, real token, real remote shell, or production command execution is needed for visual convergence.

## Risks / Trade-offs

- **Risk: UI implies production-safe remote command execution.** -> Keep copy scoped to current dynamic invocation envelope and confirmation-gated mock/local evidence.
- **Risk: Pairing actions imply trust proofing or identity verification.** -> Treat approval/reject/verify as contract actions only; do not present proofing guarantees.
- **Risk: Dynamic action JSON becomes invalid or misleading.** -> Preserve existing JSON parse validation and raw action result disclosure.
- **Risk: Global CSS cleanup affects old panels.** -> Remove or narrow only Nodes-specific classes; keep new styling in module-local CSS.
- **Risk: Mock Gateway node support diverges from real Gateway.** -> Seed only contract-shaped fields already consumed by the BFF/frontend and label E2E as mock/local visual coverage.
