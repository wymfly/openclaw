# settings — API usage (v2)

> Endpoint truth and DTO shapes are tracked in
> `deck-go/contracts/source/deck-api.contract.ts` and
> `deck-go/contracts/source/deck-endpoints.contract.json`.

## Source of truth

The settings module reads bindings from the deck-go BFF, which forwards to
upstream OpenClaw `gateway.settings.*` and the runtime supervisor (when
bundled). Browser code never calls Gateway directly.

## Deck-facing API

### `GET /api/settings`

Wrapper:

```ts
fetchSettings(): Promise<DeckGoSettingsResponse>
```

Response:

```ts
type DeckGoSettingsResponse = {
  ok: boolean;
  settings: DeckGoSettings; // accessTokenConfigured, accessTokenSource, appearance, notifications, pairedDevices
  path: string; // file location of deck-go-settings.json
};

type DeckGoSettings = {
  accessTokenConfigured?: boolean;
  accessTokenSource?: string; // "env" | "json" | "missing"
  appearance?: Record<string, unknown>;
  notifications?: Record<string, unknown>;
  pairedDevices?: Array<Record<string, unknown>>;
};
```

The contract is **open** for `appearance` / `notifications` / `pairedDevices`.
The prototype assumes specific keys (theme/density/desktop/quietHours,
etc.); production should align on a typed shape if possible (open question §2).

### `POST /api/settings`

Wrapper:

```ts
saveSettings(draft: DeckGoSettings): Promise<DeckGoSettingsSaveResponse>
```

Body: full or partial settings draft. Server merges shallow keys; deep
keys (appearance._, notifications._) are replaced wholesale per top-level
key.

Response:

```ts
type DeckGoSettingsSaveResponse = {
  ok: boolean;
  settings: DeckGoSettings;
};
```

Errors:

- `4xx` validation — server returns `{ ok: false, errors: [{ path,
message }, …] }` (BFF projection). UI surfaces inline on the offending
  field.
- `5xx` — generic error; dialog stays open with retry CTA.

### `POST /api/settings/test-connection`

Wrapper (settings-flavor — separate from runtime-endpoint test):

```ts
testSettingsConnection(): Promise<DeckGoSettingsConnectionResponse>
```

Response:

```ts
type DeckGoSettingsConnectionResponse = {
  ok?: boolean;
  error?: string;
};
```

Validates that the configured access token + Gateway URL pair successfully
authenticate. Used by the Identity group's "Verify access" CTA (production).
The prototype simulates this in `TestConnectionDialog` but routes via the
runtime endpoint test for visual fidelity.

### `GET /api/settings/version`

Wrapper:

```ts
fetchVersion(): Promise<DeckGoSettingsVersionResponse>
```

Response:

```ts
type DeckGoSettingsVersionResponse = {
  deck?: string;
  gateway?: string;
  cli?: string;
};
```

Deck reports its own build; gateway is the BFF-reported number; CLI is the
locally-installed `openclaw` binary. Drift between Deck and Gateway is a
warning surface in the VersionGroup.

### `GET /api/bootstrap/status`

Wrapper:

```ts
fetchBootstrap(): Promise<DeckGoBootstrapStatusResponse>
```

Response:

```ts
type DeckGoBootstrapStatusResponse = {
  ok: boolean;
  settings: DeckGoBootstrapSettingsStatus;
  runtime: DeckGoRuntimeGatewayStatus; // mode: "bundled" | "remote" + status + health + url + ...
  gateway: DeckGoBootstrapGatewayStatus; // connected + capability snapshot + method/event counts
};
```

This is the **primary source of runtime mode**. The settings panel reads
`bootstrap.runtime.mode` to decide whether to lock or open the Runtime
section's edit lane.

### `GET /api/runtime/endpoint`

Wrapper:

```ts
fetchRuntimeEndpoint(): Promise<DeckGoRuntimeEndpointResponse>
```

Response:

```ts
type DeckGoRuntimeEndpointResponse = {
  url: string;
  tokenConfigured: boolean;
  tlsVerify: boolean;
  source: "env" | "json";
};
```

Used to populate the Runtime section's URL / TLS / token form when in
remote mode.

### `PUT /api/runtime/endpoint`

Wrapper:

```ts
updateRuntimeEndpoint(body: DeckGoRuntimeEndpointPutRequest): Promise<DeckGoRuntimeEndpointResponse>
```

Body:

```ts
{
  url: string;
  token: string;
  tlsVerify: boolean;
}
```

Persists the new endpoint config to `deck-go-settings.json`. **In bundled
mode this endpoint must reject with 4xx** — the supervisor owns the
endpoint, not the operator.

### `POST /api/runtime/endpoint/test`

Wrapper:

```ts
testRuntimeEndpoint(body: DeckGoRuntimeEndpointTestRequest): Promise<DeckGoRuntimeEndpointTestResponse>
```

Body:

```ts
{
  url?: string;
  token?: string;
  tlsVerify?: boolean;   // all optional — server falls back to current config
}
```

Response:

```ts
type DeckGoRuntimeEndpointTestResponse = {
  ok: boolean;
  latencyMs?: number;
  gatewayVersion?: string;
  tlsVerified: boolean;
  error?: string;
};
```

Verifies TCP reachability, TLS handshake, and Gateway version response
against the supplied (or currently-configured) endpoint without mutating
state.

## DTO shapes (canonical)

```ts
type DeckGoSettings = {
  /* see above */
};
type DeckGoSettingsResponse = {
  /* see above */
};
type DeckGoSettingsSaveResponse = {
  /* see above */
};
type DeckGoSettingsConnectionResponse = {
  /* see above */
};
type DeckGoSettingsVersionResponse = {
  /* see above */
};
type DeckGoBootstrapStatusResponse = {
  /* see above */
};
type DeckGoBootstrapSettingsStatus = {
  path: string;
  accessTokenConfigured: boolean;
  managedGatewayConfigured: boolean;
  commandConfigured: boolean;
  gatewayTokenConfigured: boolean;
  autoStart: boolean;
};
type DeckGoBootstrapGatewayStatus = {
  connected: boolean;
  error?: string;
  capabilitySnapshotAvailable?: boolean;
  methodCount?: number;
  eventCount?: number;
  schemaVersion?: string;
};
type DeckGoRuntimeGatewayStatus = {
  /* mode, status, health, url, pid, latency, ... */
};
type DeckGoRuntimeEndpointResponse = {
  /* see above */
};
type DeckGoRuntimeEndpointPutRequest = {
  /* see above */
};
type DeckGoRuntimeEndpointTestRequest = {
  /* see above */
};
type DeckGoRuntimeEndpointTestResponse = {
  /* see above */
};
```

## BFF projections (not part of the contract)

### `recentSaves: SaveEvent[]`

```ts
interface SaveEvent {
  ts: number;
  actor: string; // "operator:user@example.com" | "system" | "automation:..."
  section: string; // joined section ids that were saved together
  paths: string[]; // dotted-path list of changed leaves
  ok: boolean;
  error?: string;
}
```

BFF projection over the BFF mutation log. Not used in the visible UI of
the v2 prototype, but kept in `data.js` to drive the "Last saved … N
minutes ago" footer line.

### Identity reveal masking

The reveal toggle never returns the raw token — it surfaces a stylized
masked form (`"openclaw_at_••••3a91"`). Production should also avoid
returning the raw token from `GET /api/settings`; mask in BFF if possible.

### Token-rotation simulation

The prototype's `RotateTokenDialog` simulates a rotate via a local
`Math.random()` token. Production needs a real endpoint (open question §3
in README) — likely `POST /api/settings/rotate-token` returning the new
token in plaintext (for one-time copy).

## Endpoint summary

| Endpoint                        | Method | When                                       | DTO                                 |
| ------------------------------- | ------ | ------------------------------------------ | ----------------------------------- |
| `/api/settings`                 | GET    | Initial load + Refresh                     | `DeckGoSettingsResponse`            |
| `/api/settings`                 | POST   | Save dialog confirm                        | `DeckGoSettingsSaveResponse`        |
| `/api/settings/test-connection` | POST   | (production) Identity verify-access        | `DeckGoSettingsConnectionResponse`  |
| `/api/settings/version`         | GET    | Version section initial load               | `DeckGoSettingsVersionResponse`     |
| `/api/bootstrap/status`         | GET    | Page load + 30s poll                       | `DeckGoBootstrapStatusResponse`     |
| `/api/runtime/endpoint`         | GET    | Runtime section initial load (remote-mode) | `DeckGoRuntimeEndpointResponse`     |
| `/api/runtime/endpoint`         | PUT    | Save dialog (remote-mode + endpointDirty)  | `DeckGoRuntimeEndpointResponse`     |
| `/api/runtime/endpoint/test`    | POST   | Test connection dialog                     | `DeckGoRuntimeEndpointTestResponse` |

## Backend chain

```
SettingsApp
  → frontend-new/src/api/settings.ts + frontend-new/src/api/runtime.ts
  → deck-go Go BFF routes
    ├── Gateway RPC settings.snapshot / settings.save
    ├── Runtime supervisor (bundled): owns env config + lifecycle
    ├── Runtime client (remote): forwards to remote Gateway
    └── BFF projection: recentSaves (mutation log)
  → Gateway (only via the BFF / runtime boundary)
```

## Mock requirements

- 6 sections (identity / runtime / appearance / notifications / devices /
  version) with unique fixture content per section.
- 3 paired devices: 1 fresh (online), 1 stale (2h ago), 1 very stale
  (26h ago).
- 4 recentSaves: 3 ok across appearance/notifications/runtime + 1 error
  on runtime tlsVerify.
- 2 runtime fixtures: bundled (managed=true, autoStart=true, latency 12ms)
  - remote (managed=false, latency 28ms, tlsVerified=true).
- Token source set to "env" by default; Tweaks toggle to "json" exercises
  the rotate CTA.
- Version fixture with deck/gateway/cli + capability snapshot available +
  schema version.

## Open contract assumptions

- **`pairedDevices`** is `Array<Record<string, unknown>>`. The prototype
  assumes `{ id, name, lastSeen, ip, platform, version }`. Should the
  contract declare a typed `DeckGoPairedDevice`?
- **Quiet hours** schema — the prototype assumes
  `notifications.quietHoursEnabled / quietHoursStart / quietHoursEnd`.
  The contract is open. Should hours be normalized to a
  `{ enabled, range: [start, end] }` object?
- **Token rotation** has no contract endpoint. Production needs
  `POST /api/settings/rotate-token`.
- **Save audit log** is BFF-projected. Should the contract gain
  `GET /api/settings/saves?limit=N`?
- **Bundled-mode supervised restart** — to apply `.env` changes without a
  manual shell session, is there a lighter-touch surface
  (`POST /api/runtime/bundled/restart`)?
- **Identity verify-access** vs **runtime test connection** — these are
  two different test endpoints. Should the contract collapse them, or
  keep them split (settings test = authentication; runtime test = TLS +
  reachability)?
