# Nodes States

## Loading

- Show loading pill in the inventory rail.
- Keep surfaces stable and avoid layout jump when data arrives.

## Ready

- Show node count, pending count, selected node lifecycle, inventory rows, selected detail, and raw payload evidence.
- Default selected node is the first node returned by `fetchNodes`.

## Empty

- If inventory is empty and pairing is empty, show a compact empty state in the inventory rail and no fabricated selected node.
- If pending pairing exists without inventory, show pairing rows and orphan pairing detail.

## Error

- Show BFF or wrapper error text in a bounded error strip.
- Preserve last visible data only if current component state already has it.

## Pending Pairing

- Pending request with matching node shows node detail plus approve/reject controls.
- Orphan pending request shows pairing-only detail and does not call `describeNode`.

## Connected Node

- Positive lifecycle tone.
- Commands and pending-work controls are available if commands are advertised.

## Offline Or Unpaired Node

- Warning/neutral lifecycle tone.
- Request pairing is visible only when no pending request already exists.
- Verify token remains available for explicit operator input.

## Dynamic Action Result

- Invoke and queue actions show raw result evidence.
- Mock/local evidence must not be labeled as production remote execution assurance.
