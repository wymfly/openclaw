# Identity Components

## Workbench Shell

- Header: eyebrow, title, description, BFF scope evidence, refresh action, link action.
- Metrics: canonical identities, total peers, channel mix, hash state.
- Workspace: left canonical inventory rail, right selected canonical detail.

## Canonical Inventory Rail

- Compact selectable rows.
- Row content:
  - canonical ID
  - peer count
  - channel badges
  - empty-peer marker when no peers are mapped
- Selection state uses left accent inset and subdued background.
- Rows must tolerate long canonical names and peer IDs with wrapping/truncation.

## Selected Canonical Detail

- Hero shows selected canonical, peer count, and config-hash status.
- Peer mapping rows show channel, peer ID, relation label, and unlink action.
- Empty selected canonical shows a quiet state with link prompt.
- Raw payload disclosure shows the selected link and current hash.

## Mutation Guard Strip

- Visible near link/unlink controls.
- Healthy state: hash available and mutations will use current hash as base.
- Blocked state: hash missing, link/unlink disabled by guard.
- Error state: latest failed mutation message plus refreshed hash evidence.

## Link Dialog

- Modal form for canonical, channel, and peer ID.
- Submit disabled until all fields are non-empty.
- Submit trims values before calling `linkIdentityPeer`.
- Dialog error stays inside the dialog; failed mutation refreshes the backing list.

## Local Molecules

Keep these module-local for this proposal:

- canonical metric tile
- identity row
- peer mapping row
- hash guard strip
- mutation feedback strip
- selected raw payload disclosure

Do not promote to design-system atoms in this change.
