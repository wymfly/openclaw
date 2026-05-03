# routing - interactions

## Keyboard

- Binding rows must be reachable by Tab.
- Enter or Space on a binding row selects it.
- Focus rings use design-system accent tokens and never rely on color alone.
- Form controls keep native keyboard behavior.

## Pointer

- Hover on binding rows changes the row surface without layout shift.
- Selected row has a persistent left accent or border state.
- Disabled mutation buttons remain visible but non-interactive.

## Primary flows

### Refresh and filter

1. Operator edits `agentId`, `channel`, or `accountId` filters.
2. Operator clicks refresh.
3. Panel calls `fetchRoutingBindings` with trimmed non-empty filters.
4. Binding queue and selected binding update.

### Validate and add binding

1. Operator enters `agentId` and match dimensions.
2. Validate calls `validateRoutingBinding`.
3. Add calls `addRoutingBinding` with current `configHash`.
4. Successful add refreshes bindings and selects the new binding when returned.

### Reorder

1. Operator selects a binding.
2. Move up/down removes the binding with current `configHash`.
3. Add re-creates it at the target position using the remove result `configHash`.
4. Mutation result remains visible.

### Simulate

1. Operator enters a hypothetical incoming route.
2. Simulate calls `simulateRouting`.
3. Result shows matched agent, matched tier, session key, and tier timeline.
4. Navigation buttons open the relevant agent/session/channel/access panels when data exists.

### DM scope patch

1. Operator chooses a known scope or existing custom scope.
2. Patch uses the existing config patch wrapper with current `configHash`.
3. Success updates local scope copy and refreshes bindings.

## Loading

- Initial loading shows compact skeleton rows or a loading badge.
- Action loading changes the initiating button label.
- Activity refresh loading does not block binding interactions.

## Error handling

- Main routing load/action errors render in the command strip or queue card.
- Activity errors render only inside the activity card.
- Gateway-not-configured errors use `GatewayNotConfiguredEmptyState`.

## Accessibility

- Each input/select must have an accessible label.
- Conflict markers must include text, not color-only icons.
- JSON details are collapsed by default and have a descriptive summary.
- Long identifiers must wrap or truncate without pushing buttons off-screen.
