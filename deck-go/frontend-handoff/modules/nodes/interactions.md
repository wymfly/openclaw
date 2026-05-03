# Nodes Interactions

## Refresh

1. Call `fetchNodes()` and `fetchNodePairing()` concurrently.
2. Preserve preferred selected node when it still exists.
3. Describe selected node through `describeNode()`.

## Select Node

1. Select row.
2. If detail is not loaded, call `describeNode(nodeId)`.
3. Update rename draft from detail display name or node id.

## Select Pending Pairing

1. Select pending row.
2. If matching node exists, show node detail plus pairing controls.
3. If no matching node exists, show orphan pairing detail and approve/reject controls only.

## Rename

1. Trim display name.
2. Call `renameNode(nodeId, displayName)`.
3. Refresh preferred node and show raw action result.

## Pairing Actions

- Request pairing: confirmation -> `requestNodePairing()`.
- Approve pairing: confirmation -> `approveNodePairing(requestId)`.
- Reject pairing: confirmation -> `rejectNodePairing(requestId)`.
- Verify pairing: non-empty token -> `verifyNodePairing(nodeId, token)`.

## Invoke Command

1. Pick advertised command.
2. Parse JSON params locally.
3. Confirm command and node id.
4. Call `invokeNodeCommand(nodeId, command, params, timeoutMs)`.
5. Show raw result evidence.

## Queue Pending Work

1. Pick type, priority, and wake behavior.
2. Confirm queue action.
3. Call `enqueueNodePendingWork({ nodeId, type, priority, wake })`.
4. Show raw result evidence.

## Accessibility

- Buttons and inputs must retain accessible labels for command, timeout, JSON params, pairing token, pending work type, pending priority, and wake checkbox.
- Long node ids, request ids, commands, path values, and JSON values must wrap or truncate inside constrained regions.
