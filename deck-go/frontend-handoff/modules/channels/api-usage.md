# channels - API usage

## Deck-facing API

### `GET /channels`

Wrapper: `fetchChannels()`.

Usage rules:

- Render `channelOrder` when present; otherwise derive ids from `channels`.
- Render `channelMeta`, labels, default account ids, and account payloads as BFF
  projections.
- Do not assume every account payload has the same provider-specific fields.

### `POST /channels/{channelId}/test`

Wrapper: `testChannel(channelId)`.

Usage rules:

- Show result only when `result.channelId` matches the selected channel or has
  been normalized to the selected channel.
- Treat timeout/deadline errors as warning; other errors as error.

### `GET /channels/{channelId}/throughput`

Wrapper: `fetchChannelThroughput(channelId, window)`.

Usage rules:

- `window` currently uses `1h`, `6h`, or `24h`.
- Empty buckets are valid and should render an empty state.
- Do not fabricate real throughput when the BFF returns zero buckets.

### `POST /channels/{channelId}/logout`

Wrapper: `logoutChannel(channelId)`.

Usage rules:

- Requires confirmation.
- Refresh channel status after success.

### `PATCH /channels/{channelId}`

Wrapper: `patchChannelConfig(channelId, patch)`.

Usage rules:

- Used for enable/disable, generic channel settings, generic JSON patch, and
  account DM policy.
- The server owns config get/patch and base hash resolution.

### WeCom config and routing

Wrappers:

- `fetchDeckConfig()`
- `patchDeckConfig(patch, baseHash)`
- `fetchRoutingBindings({ channel, accountId })`

Usage rules:

- Load only for WeCom-like selected channel.
- Keep account focus from navigation params.
- Route handoff must include selected channel/account context.

## Backend chain

```txt
ChannelsPanel / channel helper components
  -> frontend-new/src/api.ts
  -> deck-go Go BFF routes
  -> runtime openclaw managed adapter
  -> OpenClaw Gateway only behind the BFF/runtime boundary
```

## Current exploration notes

- No deterministic production forwarding drift was found before the proposal.
- The mock Gateway currently lacks `channels.status` and `channels.logout`, so
  focused visual E2E will need contract-shaped fixture support.
- Throughput is a BFF route with generated DTOs; real payload availability may
  vary by runtime.
- WeCom access controls are provider-specific and should not be generalized
  without a separate proposal.

## Mock requirements

Focused mock visual E2E may need contract-shaped fixture data for:

- multiple channels including Telegram, Discord, and WeCom
- channel accounts with success/warning/error diagnostics
- channel metadata and default account ids
- channel test success and timeout/error responses
- throughput buckets
- channel logout response
- config get/patch responses for generic and WeCom controls
- routing bindings for WeCom account context

Evidence should be labeled as mock visual coverage only.
