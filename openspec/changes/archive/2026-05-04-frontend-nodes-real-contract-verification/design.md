## Context

Nodes already has production code and an archived hifi spec, but the handoff package now contains a newer v2 prototype. The module is operationally sensitive because it controls device pairing and dynamic remote node envelopes. The UI must make it clear which actions are typed, which are dynamic, and which are dangerous.

The current contract chain is:

1. `frontend-new/src/api.ts` wrappers (`fetchNodes`, `describeNode`, `renameNode`, `invokeNodeCommand`, `enqueueNodePendingWork`, `fetchNodePairing`, `requestNodePairing`, `approveNodePairing`, `rejectNodePairing`, `verifyNodePairing`)
2. Go BFF `/api/nodes` and `/api/nodes/pair` active routes and runtime route mirrors
3. `ManagedRuntimeSurface` / runtime adapter
4. generated Gateway methods for node list/describe/rename/pairing plus dynamic exceptions for `node.invoke` and `node.pending.enqueue`
5. `DeckGoNode*` DTOs in `deck-go/contracts/source/deck-api.contract.ts`

## Goals / Non-Goals

**Goals:**

- Align production Nodes with the fresh v2 handoff when the prototype is backed by the true contract.
- Preserve the existing BFF-only browser boundary and wrapper-first frontend architecture.
- Verify inventory, describe, safe dynamic envelope shape, pairing list/actions, production render, and BFF-only browser access with mock and real-stack evidence.
- Fix clear nodes-scoped drift directly, including mismatches in docs, mocks, tests, wrappers, or BFF forwarding.
- Record capability gaps in `frontend-handoff/modules/nodes/implementation-notes.md`.

**Non-Goals:**

- Add typed schemas for advertised commands or pending-work payloads.
- Add QR/camera token verification UX, bulk pairing actions, audit feed integration, polling infrastructure, or richer trust attestation.
- Execute destructive real pairing rejection or remote node commands against user devices unless the E2E uses a disposable fixture and can restore state.
- Add new UI dependencies or promote a shared TwoPaneWorkspace/PlatformPill abstraction inside this change.

## Decisions

1. **Code truth wins over prototype claims.** The v2 handoff is the visual/product target, but actual DTOs, BFF routes, and Gateway generated methods define production behavior.

2. **Dynamic envelopes stay explicit.** `node.invoke` and `node.pending.enqueue` remain freeform JSON/opaque result surfaces until Gateway exposes schemas. The UI must not invent command-specific forms.

3. **Pairing rejection stays confirmation-gated.** Rejecting a pairing request is destructive because the device must restart its flow. Real E2E should avoid executing reject against real user state unless the request is an ephemeral fixture.

4. **Real E2E uses safe shape checks.** L2 verification should cover route availability and UI render; dynamic or destructive actions can use malformed/safe requests to verify shape without changing real devices.

5. **Circuit breaker applies to environment or state blockers.** If real Gateway state, auth, or lack of connected nodes prevents a scenario after at most three fresh attempts, record the failure as empty-valid, degraded, skipped-safe, or handoff-blocked with evidence, then continue after static review and L1 evidence are complete.

## Risks / Trade-offs

- **Dynamic remote action risk** -> Prefer malformed/safe shape checks in real E2E and full behavior in mock/focused tests.
- **Prototype overstates command schema support** -> Keep JSON textarea and raw response rendering; record schema generator as future work.
- **No connected real nodes** -> Treat empty inventory as valid route-shape evidence while still requiring UI render and BFF-only checks.
- **Pairing state is transient** -> Pairing list may be empty; real tests should not require a pending request.
- **OpenSpec archive can overwrite spec detail if delta is partial** -> Copy full modified requirement blocks into the delta spec before archive.
