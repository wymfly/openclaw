# Identity States

## Loading

- Show existing shell immediately.
- Metrics display zero or retained previous values while the inventory rail shows loading copy.
- Link action remains visible but mutation guard will block until hash exists.

## Ready

- Shows canonical count, peer count, channel mix, hash available state, canonical rail, selected detail, and raw payload access.
- First canonical is selected when no previous/preferred canonical exists.

## Empty

- Shows no identity links configured.
- Keeps link action visible.
- Detail area explains that the current contract can create peer mappings but cannot prove identity ownership.

## Selected Canonical With Peers

- Peer mappings are listed as stable rows.
- Each peer has an unlink action that asks for confirmation before mutation.
- Channel and peer IDs wrap inside row constraints.

## Selected Canonical Without Peers

- Row remains selectable.
- Detail area shows empty peer state and link prompt.

## Missing Hash

- Hash metric and guard strip show blocked state.
- Link submit and unlink attempts are blocked before backend mutation.
- Unlink confirmation is not opened when hash is missing.

## Failed Link Or Unlink

- Error copy is visible.
- A refresh is triggered after failure.
- If the backend returns a new hash, the hash metric and guard strip update.

## Raw Payload Expanded

- Disclosure shows selected canonical payload and current `configHash`.
- This is debugging evidence, not an editing surface.

## Mock/Local Visual

- Visual fixtures must include at least:
  - multiple canonical identities
  - one canonical with multiple peers
  - one canonical with a single peer
  - one empty canonical
  - stable `configHash`
  - deterministic link and unlink results
