# channels - states

## Inventory

- `idle`: no data yet; show neutral status.
- `loading`: refresh in progress; keep previous selected channel if present.
- `ready`: channel rows and metrics visible.
- `error`: show error banner/text without clearing operator context if old data
  exists.
- `empty`: no channels loaded; show empty surface and disable selected-channel
  actions.

## Selected channel

- Show unavailable values as `n/a`.
- Preserve selected channel after refresh when still present.
- Navigation params may select `channelId`, `channelSection=access`, and
  `channelAccountId`.
- Non-WeCom selected channels hide WeCom-specific access controls.

## Account diagnostics

- `success`: configured, enabled, linked, and connected.
- `warning`: enabled but disconnected, configured false, or enabled but not
  linked.
- `error`: `lastError` present.
- `neutral`: disabled or unknown.

## Probe result

- `ok=true`: success badge and latency.
- timeout/deadline error: warning badge and error text.
- other error: error badge and error text.
- Stale probe results from another channel must not display for the selected
  channel.

## Throughput

- `loading`: status badge or note.
- `ready`: bucket rows with in/out counts.
- empty buckets: empty note, not a blank chart.

## Mutations

- Logout and enable/disable need confirmation.
- Successful logout/patch/test keeps selected-channel context and refreshes
  inventory.
- JSON patch parse errors stay local to the form.
- WeCom save errors stay local to the WeCom section.

## Responsive

- Desktop: inventory column + selected detail column.
- Medium: preserve two columns as long as possible.
- Mobile/narrow: stack columns; action buttons wrap; long account ids wrap
  or truncate without overflowing.
