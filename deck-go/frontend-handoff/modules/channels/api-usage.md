# channels — API usage

> Endpoint truth and DTO shapes are tracked in
> `deck-go/contracts/source/deck-api.contract.ts` and
> `deck-go/contracts/source/deck-endpoints.contract.json`. This file
> documents how the prototype consumes them.

## Deck-facing API

### `GET /channels`

Wrapper: `fetchChannels()`. Response shape:
`DeckGoChannelsStatusResponse` (`channelOrder`, `channels`,
`channelAccounts`, `channelDefaultAccountId`, `channelLabels`,
`channelDetailLabels`, `channelSystemImages`, `channelMeta`).

Usage rules:

- Render in `channelOrder` when present; otherwise derive ids from
  `channels`.
- `channelMeta` (`DeckGoChannelUiMeta[]`) gives provider plugin
  metadata — `pluginId`, `pluginOrigin`, `pluginNpmSpec`,
  `pluginConfigPath`, `pluginDefaultInstallChoice`. Display these on
  detail hero.
- Account payloads in `channelAccounts` are provider-shaped (varying
  fields). The prototype does **not** assume uniform fields; it consumes
  the BFF projections (`accountDiagnostics` keyed by account id).
- Inventory KPIs (`enabled count`, `accounts count`, `alerts count`,
  `unhealthy count`) are derived in the panel from the response — the
  server does not pre-aggregate.

### `POST /channels/{channelId}/test`

Wrapper: `testChannel(channelId)`. Response shape:
`DeckGoChannelTestResponse` (`ok`, `channelId`, `check`, `error`,
`latencyMs`, `checkedAt`).

Usage rules:

- Show result only when `result.channelId` matches the selected
  channel — or has been normalized to it.
- Treat timeout / deadline errors as warning, all other errors as
  error.
- Latency rendering uses ms (no decimal).
- Probe is bound to the **channel**, not to a specific account; if the
  channel has multiple accounts the probe path is provider-defined.

### `GET /channels/{channelId}/throughput`

Wrapper: `fetchChannelThroughput(channelId, window)`. Response shape:
`DeckGoChannelThroughputResponse` (`buckets`, `messagesIn`,
`messagesOut`).

Usage rules:

- `window` accepts `1h | 6h | 24h`.
- Empty buckets are valid; render an explicit empty-state, not a fake
  zero chart.
- Bucket time is epoch ms; UI renders `toLocaleTimeString()` for the
  active window.
- Stacked bars are CSS-only in prototype; engineering may upgrade to a
  real chart library when the panel needs hover tooltips, panning, or
  multiple stacked series — flag in stack-decisions when triggered.

### `POST /channels/{channelId}/logout`

Wrapper: `logoutChannel(channelId)`. Response: `{ ok, message? }`.

Usage rules:

- Always behind a confirmation gate (LogoutDialog).
- Refresh `channels.status` after success.
- Clear cached probe locally.

### `PATCH /channels/{channelId}`

Wrapper: `patchChannelConfig(channelId, patch)`. Response shape:
`DeckGoConfigApplyResponse` (`ok`, `baseHash`, `hash`).

Usage rules:

- Single endpoint for channel enable/disable, generic settings (retry,
  jitter, webhook URL, …), DM policy, and free-form JSON patches.
- The server owns config get / patch and base-hash resolution.
- Send `baseHash` from the last `DeckGoConfigSnapshotResponse`; on
  conflict (`409`), reload the snapshot and re-prompt.

### `GET /config` (channel-scoped slice)

Wrapper: `fetchDeckConfig()` → `DeckGoConfigSnapshotResponse`.

Usage rules:

- The settings tab consumes `channelConfig[id].config` (channel-scoped
  projection) plus `baseHash`.
- Production extracts the channel-scoped slice via a selector — the
  raw response is full `openclaw.json`.

### `PATCH /config`

Wrapper: `patchDeckConfig(patch, baseHash)`.

Usage rules:

- Used by the WeCom routing handoff for batch routing changes that
  span more than one channel.
- The channels panel itself does not call this directly except through
  the WeCom-routing flow.

### `GET /routing`

Wrapper: `fetchRoutingBindings({ channel?, accountId? })`. Response
shape: `DeckGoRoutingListResponse` (`bindings`, `defaultAgentId`,
`dmScope`, `configHash`).

Usage rules:

- The routing tab calls with `channel = selectedChannel.id`.
- Empty bindings render an explicit empty-state ("Traffic falls through
  to the default agent.").
- `configHash` is shown in the footer; conflict-on-write returns the
  latest `configHash` to use as the new base.

## BFF projections (not raw Gateway wire frames)

The prototype consumes these BFF-side shapes that aren't part of the
raw `/channels` response. They live in `data.js` for the prototype and
must be sourced from the BFF in production:

### `accountDiagnostics: Record<accountId, BffAccountDiagnostic>`

```ts
interface BffAccountDiagnostic {
  displayName: string;
  health: "ok" | "warn" | "err" | "info" | "muted";
  title: string;
  description: string;
  nextStep: string | null;
  lastConnectedMs: number;
}
```

The BFF computes `health` from the account payload (configured / enabled
/ linked / connected / lastError) and emits a single normalized health.
This is intentional — the UI must not re-derive health from raw provider
fields.

### `dmPolicy: Record<accountId, { policy, scope }>`

DM policy + scope for the account. Editing is via
`PATCH /channels/{id}` with the appropriate sub-path (server-defined).

### `wecomAccess: Record<accountId, WeComAccessState>`

```ts
interface WeComAccessState {
  allowBots: boolean;
  allowFromAgents: string[];
  dynamicAgentsEnabled: boolean;
  failClosedRouting: boolean;
  lastSavedMs: number;
}
```

WeCom-specific. Loaded only when the selected channel is WeCom-like.
Save action submits per-account via `PATCH /channels/{id}` (sub-path
`access.{accountId}`).

## Endpoint summary

| Endpoint                            | Method | When                                     | DTO                               |
| ----------------------------------- | ------ | ---------------------------------------- | --------------------------------- |
| `/channels`                         | GET    | Inventory load + refresh                 | `DeckGoChannelsStatusResponse`    |
| `/channels/{id}/test`               | POST   | Run probe                                | `DeckGoChannelTestResponse`       |
| `/channels/{id}/throughput?window=` | GET    | Throughput tab                           | `DeckGoChannelThroughputResponse` |
| `/channels/{id}/logout`             | POST   | Logout (confirmed)                       | `{ ok, message? }`                |
| `/channels/{id}`                    | PATCH  | Settings + DM policy + WeCom access save | `DeckGoConfigApplyResponse`       |
| `/config`                           | GET    | Snapshot for settings + WeCom routing    | `DeckGoConfigSnapshotResponse`    |
| `/config`                           | PATCH  | WeCom routing batch                      | `DeckGoConfigApplyResponse`       |
| `/routing?channel=`                 | GET    | Routing tab + WeCom routing handoff      | `DeckGoRoutingListResponse`       |

## Backend chain

```
ChannelsPanel / channel helper components
  → frontend-new/src/api/channels.ts
  → deck-go Go BFF routes (cmd/deck-go/...)
  → runtime openclaw managed adapter
  → OpenClaw Gateway (only behind the BFF / runtime boundary)
```

Browser code never reaches the Gateway directly. The BFF is the only
externally-visible API surface.

## Mock requirements

Focused mock visual E2E needs contract-shaped fixture data for:

- 5 channels covering Telegram, Discord, WeCom, Slack (disabled), QQ
  (extension plugin).
- Channel accounts with `ok`, `warn`, `err`, `info`, `muted`
  diagnostic mixes.
- Probe success, probe failure (timeout/error), and probe-disabled
  paths.
- Throughput buckets: rich data, sparse data, zero data.
- Config snapshots with `enabled`, `retry { attempts, jitter }`,
  `webhook { enabled, url? }`, and provider-specific keys
  (`slashCommands`, `access`, …).
- Routing bindings: zero / few / multi-tier mixes.
- WeCom access state: tenant A and tenant B, varying
  `dynamicAgentsEnabled` / `failClosedRouting`.

Evidence collected against this fixture is labelled "mock visual
coverage only" (it does not assert real provider behavior).

## Open contract assumptions

(These are prototype assumptions. If the BFF disagrees, file
`api-discrepancy.md` per `frontend-handoff/CLAUDE.md` increment #5.)

- The `/throughput` `window` parameter accepts the literal strings
  `1h | 6h | 24h`. If the BFF takes ms or ranges, adapt at the wrapper.
- `DeckGoChannelTestResponse.checkedAt` is epoch ms. If it's seconds,
  multiply at the wrapper.
- The `accountDiagnostics` shape above is BFF-defined and may not
  exist server-side yet. If it doesn't, the prototype's mock makes the
  shape explicit so the BFF can land it.
- Routing binding `peer.kind` enum is `direct | group | channel`. If
  the BFF emits more variants, default-render the unknown kind as
  `unknown` rather than dropping the row.
