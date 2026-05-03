# routing - states

## Panel load state

```txt
idle -> loading -> ready
idle -> loading -> error
ready -> loading -> ready
ready -> loading -> error
```

Rules:

- Initial mount loads bindings and routing-adjacent activity in parallel.
- Binding load failure sets the main panel error.
- Activity failure is scoped to the activity card.
- Gateway-not-configured activity failure renders the shared first-run empty state.

## Selection state

```txt
no bindings -> no selection
bindings loaded -> first binding selected
operator selects row -> selectedBindingId changes
refresh after mutation -> preferred binding selected if present, otherwise first binding
```

Rules:

- Selection must survive refresh when the binding still exists.
- Deleting the selected binding falls back to the first available binding.

## Action state

```txt
idle
  -> simulating -> idle
  -> validating -> idle
  -> adding -> idle
  -> removing -> idle
  -> reordering -> idle
  -> scope -> idle
```

Rules:

- Mutating buttons are disabled while any action is running.
- Simulation reset clears result and restores initial URL-seeded defaults.
- Add and validate require `agentId` and `channel`.
- Add, remove, reorder, and DM scope patch require a current `configHash`.

## Binding draft state

Fields:

- `agentId`
- `channel`
- `accountId`
- `peerKind`
- `peerId`
- `guildId`
- `teamId`
- `roles`
- `comment`
- `position`

Rules:

- Empty optional fields are omitted from `DeckGoRoutingMatch`.
- Roles parse from comma-separated string.
- Position parses only non-negative integers.

## Simulation draft state

Fields:

- `channel`
- `accountId`
- `peerKind`
- `peerId`
- `guildId`
- `teamId`
- `memberRoleIds`

Rules:

- Channel is required.
- URL routing context can seed channel/account filters.
- "Use selected binding" copies selected match fields into the simulator.

## Empty and error states

- No bindings: show an empty queue and keep simulator/draft available.
- No selection: show a neutral selected-detail placeholder.
- Validation conflicts: show contract-backed conflict count and details.
- Local advisory conflicts: show non-blocking warning markers.
- Raw Gateway-not-configured sentinel: never shown directly.
