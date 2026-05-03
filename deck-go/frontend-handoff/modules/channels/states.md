# channels — states

## View routing

| State         | Trigger                                                          | Notes                                                                  |
| ------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `view=list`   | initial mount, `Esc` from detail, "Channels" breadcrumb          | Default.                                                               |
| `view=detail` | row click, Tweaks `Active view = detail`, `Enter` on focused row | Re-mounts DetailView on `selectedChannel` change (`key={channel.id}`). |

## ListView state

| State     | Description                               | UI                                                                                        |
| --------- | ----------------------------------------- | ----------------------------------------------------------------------------------------- |
| `ready`   | Channels loaded, rows rendered.           | Default — KPI strip + toolbar + rows.                                                     |
| `loading` | Refresh in flight before any data exists. | Spinner + "Loading channels…" centered.                                                   |
| `error`   | `GET /channels` failed.                   | Centered error block + Retry button. Existing rows are kept if a previous load succeeded. |
| `empty`   | API returned no channels.                 | EmptyState with `New channel` CTA.                                                        |

The Tweaks `listState` toggles between these for design verification.

## DetailView state

| State     | Description                                                                    |
| --------- | ------------------------------------------------------------------------------ |
| `ready`   | Hero + tabs + selected-tab body all rendered.                                  |
| `loading` | Single spinner across the body; hero stays since it's derived from list cache. |
| `error`   | Single error block in the body; hero stays. Retry button.                      |

Switching channels resets `activeTab` to `overview` (the App reset on
`goToDetail`). Operators can change tab freely; tab state lives in tweaks
for design verification but on prod will live in URL search params or
panel-local state.

## Tab body states

### Overview

- Always-on, derived from list-cache data.
- Alert section appears only when at least one account has `health` ∈
  {warn, err}.

### Throughput

- `ready` → buckets rendered as stacked bars; empty buckets render the
  empty-state copy (no fake bars).
- Window switch (1h/6h/24h) refetches; while in flight the bars dim
  (TODO at engineering: skeleton vs hold-stale).

### Probe

- `success` → ok badge + latency.
- `failed` → err badge + error string from `DeckGoChannelTestResponse.error`.
- `none taken` → "Channel is disabled" banner.

### Settings

- `clean` → save button disabled.
- `dirty` → orange "unsaved changes" hint, save enabled.
- `saving` → save button shows spinner; form locks.
- `saved` → toast banner + clean state (TODO: action result strip in v3).
- `validation error` → inline hint under the offending field.

### Routing

- `ready` → bindings list (or empty banner if zero bindings).
- "Add binding" opens an inline form drawer (deferred from v2 — currently a
  CTA-only stub).

### WeCom access

- Only renders when `channel.id === "wecom"`.
- Per-account card. Each card's toggles are local until a future
  `Save dynamic agents` action submits them in one batch.

## Account diagnostic health levels

| Level   | Color (token) | Meaning                                                               |
| ------- | ------------- | --------------------------------------------------------------------- |
| `ok`    | success       | Configured, enabled, linked, connected.                               |
| `warn`  | warn          | Enabled but disconnected, configured incomplete, or partially linked. |
| `err`   | error         | `lastError` present or probe-blocking config invalid.                 |
| `info`  | accent        | Idle / authorized but no recent traffic.                              |
| `muted` | text-3        | Disabled at the channel level.                                        |

## Probe edge cases

- Stale probe (different `channelId` than the selected one): never
  display for the selected channel — drop or normalize before render.
- Timeout / deadline error: render as warn, not err.
- Other errors: render as err.

## Mutations

- Logout → confirmation gate via `LogoutDialog` → POST → success refreshes
  channel status and clears local probe.
- Test → POST → result populates `MOCK.probe[id]` (in prod: server returns
  fresh `DeckGoChannelTestResponse`; UI keeps `ok` flag and `error` text).
- Settings save → PATCH with `baseHash`; conflict → 409 → reload baseHash
  and re-prompt (v3).
- WeCom access save → batched PATCH per account; per-card error stays
  local.

## Responsive

- ≥1080px: 5-col KPI strip + 6-col row + 4-col tile-row + 2-col form/wecom.
- 720–1080px: 3-col KPI / 5-col row / 2-col tile-row / 1-col form/wecom.
- <720px: 2-col KPI / 4-col row (probe-out hidden) / 1-col tile/form/wecom.

## Density

`data-density="compact"` reduces vertical padding on rows, KPI tiles,
detail tiles, and account rows by ≈30% without changing typography hierarchy.
