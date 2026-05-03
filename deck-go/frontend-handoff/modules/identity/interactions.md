# Identity Interactions

## Refresh

- Calls `fetchIdentityLinks`.
- Preserves the current selected canonical when it still exists.
- Can prefer the canonical involved in the last mutation.

## Select Canonical

- Clicking or pressing Enter/Space on a canonical row selects it.
- Selection changes only the detail pane and does not mutate data.

## Link Peer

- Opens link dialog.
- Requires canonical, channel, and peer ID.
- Trims all submitted fields.
- Calls `linkIdentityPeer(canonical, channel, peerId, configHash)`.
- On success: closes dialog, records last action, refreshes and selects the canonical.
- On failure: leaves dialog open with error, refreshes and keeps backend truth visible.

## Unlink Peer

- Requires a current `configHash`.
- Opens native confirmation before mutation.
- Calls `unlinkIdentityPeer(canonical, channel, peerId, configHash)` only after confirmation.
- On success: records last action and refreshes selected canonical.
- On failure: shows error, refreshes and keeps backend truth visible.

## Missing Hash Guard

- Link/unlink attempts do not call mutation wrappers.
- Unlink does not show confirmation.
- Error copy uses existing hash-required translation.

## Raw Payload

- Expanding the disclosure does not trigger network calls.
- Payload mirrors selected canonical and current hash exactly.
