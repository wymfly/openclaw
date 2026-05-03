# channels - high-fidelity handoff

**Status:** `implemented (sha pending-final-commit)`
**Protocol version:** `protocol-v1`
**Active visual target:** [`./prototype.html`](./prototype.html)
**OpenSpec change:** `frontend-channels-hifi-contract-redesign`

This package defines the visual and interaction target for the `channels/`
module rewrite in `frontend-new`. The current panel is behavior-rich and uses
the Deck BFF contract chain, but this package is the visual truth for the
high-fidelity pass. Code and contracts remain the final authority when a
handoff note drifts.

## What this module does

`channels/` is the channel operations workbench. Operators use it to inspect
provider/channel status, account diagnostics, selected-channel metadata,
throughput, probe results, plugin handoff, logout/enable controls, generic
channel patching, account DM policy, WeCom access controls, and WeCom routing
handoff.

The design keeps generic channel health first: inventory and metrics on the
left, selected-channel evidence and controls on the right. WeCom-specific
policy controls remain embedded in selected detail only when the selected
channel is WeCom-like.

## Contract truth

Production and mocks must use the current Deck-facing DTOs:

- `DeckGoChannelsStatusResponse`
- `DeckGoChannelUiMeta`
- `DeckGoChannelTestResponse`
- `DeckGoChannelThroughputBucket`
- `DeckGoChannelThroughputResponse`
- `DeckGoConfigSnapshotResponse`
- `DeckGoConfigApplyResponse`
- `DeckGoRoutingListResponse`

Endpoint truth:

- `GET /channels`
- `POST /channels/{channelId}/logout`
- `POST /channels/{channelId}/test`
- `GET /channels/{channelId}/throughput`
- `PATCH /channels/{channelId}`
- `GET /config`
- `PATCH /config`
- `GET /routing`

## Workflow constraints

- Browser code must continue through the Deck BFF/API facade.
- Channel status/account shapes are BFF projections, not direct Gateway wire
  frames.
- Probe result is a BFF health interpretation over `channels.status` with
  `probe=true`.
- Channel patching must continue through the server's config get/patch chain.
- Logout and enable/disable actions must keep a confirmation gate.
- WeCom config and routing behaviors are provider-specific and must stay scoped
  to selected-channel detail.

## Depends on canonical atoms

`Badge`, `Button`, `Card`, `Code`, `Input`, `Select`, `Textarea`, `Toggle`,
`Spinner`, `Modal` only if confirmation moves from native confirm to a dialog,
and existing text/status atoms where production fit is straightforward.

No canonical atom or token is required by this handoff. Local molecules:

- channel metric tile
- channel inventory row
- selected-channel hero
- account diagnostic card
- throughput row/chart strip
- channel settings form section
- account policy row
- WeCom access policy card
- routing handoff strip
- action result seam

## How to implement

1. Open `prototype.html` and inspect ready, selected-discord, selected-wecom,
   probe, throughput, config patch, empty, loading, and error states.
2. Read `api-usage.md` before touching mocks, API wrappers, or backend behavior.
3. Translate the prototype into `frontend-new/src/components/panels/channels/`,
   preserving wrappers, confirmation gates, and selection refresh behavior.
4. Restyle channel-only helper components as part of this module pass.
5. Add mock visual E2E with contract-shaped data and label evidence as mock
   visual coverage.

## Open questions for follow-up

- Whether throughput should become a real Gateway-backed metric instead of the
  current BFF placeholder in some runtimes.
- Whether every provider should expose a schema-guided config form, or generic
  JSON patch stays as the fallback.
- Whether channel account diagnostics should be normalized server-side rather
  than inferred in the UI.
- Whether WeCom access controls should become a dedicated provider detail route
  when more WeCom sections are added.
- Whether native `window.confirm` should be replaced by a shared confirmation
  dialog after enough configuration modules repeat the pattern.
