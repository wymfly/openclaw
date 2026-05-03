# Nodes API Usage

## Inventory

```ts
const inventory = await fetchNodes();
```

Expected shape:

```ts
type DeckGoNodesResponse = {
  nodes?: DeckGoNodeSummary[];
};
```

## Describe

```ts
const detail = await describeNode(nodeId);
```

`DeckGoNodeSummary` contains identity, platform, version, connection, pairing, capabilities, commands, optional `permissions`, and optional path/remote evidence.

## Pairing

```ts
const pairing = await fetchNodePairing();
await requestNodePairing(node);
await approveNodePairing(requestId);
await rejectNodePairing(requestId);
await verifyNodePairing(nodeId, token);
```

Expected list shape:

```ts
type DeckGoNodePairingResponse = {
  pending?: DeckGoPairingRequest[];
};
```

## Dynamic Actions

```ts
await invokeNodeCommand(nodeId, command, params, timeoutMs);
await enqueueNodePendingWork({ nodeId, type, priority, wake });
```

`node.invoke` and `node.pending.enqueue` are active upstream-schema-missing Gateway exceptions. The UI may expose them only as guarded dynamic envelopes and must not invent typed command schemas.

## Error And Drift Rules

- Missing optional node fields render as unavailable evidence.
- Invalid invoke params JSON blocks submit before calling the wrapper.
- Pairing and dynamic actions remain confirmation-gated.
- Orphan pending pairing requests are actionable without `node.describe`.
- Do not add direct Gateway calls from browser code.
