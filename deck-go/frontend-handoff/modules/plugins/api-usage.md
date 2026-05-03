# plugins — API usage

> Endpoint truth and DTO shapes are tracked in
> `deck-go/contracts/source/deck-api.contract.ts` and
> `deck-go/contracts/source/deck-endpoints.contract.json`.

## Source of truth

The plugins module consumes Deck BFF plugin inventory contracts. The browser
never calls Gateway directly. All data flows through the deck-go Go BFF, which
fans out to Gateway RPC + config history projection internally.

## Deck-facing API

### `GET /api/deck/plugins`

Default capability scope (channel-capable only). Wrapper:
`fetchPluginsWithCapability("channel")`. Response: `DeckGoPluginsListResponse`.

This is the call most Deck screens make today (channel routing, login flows).

### `GET /api/deck/plugins?capability=all`

Full inventory across capability kinds (`channel | tool | agent | provider`).
Wrapper: `fetchPluginsWithCapability("all")`. Response: `DeckGoPluginsListResponse`.

The plugins workbench defaults to this scope; users can flip back to
`scope=channel` via the toolbar segmented control.

### `GET /api/channels`

Used only as a side check to decide whether channel handoff buttons (e.g.,
"Open in Channels") are safe to render — not a primary plugins-module data source.

## DTO shapes (canonical)

```ts
type DeckGoPluginCapability = "channel" | "all";

interface DeckGoPluginInventoryEntry {
  id: string;
  name?: string;
  version?: string;
  status?: string; // ready | degraded | pending | disabled | error | (open)
  origin?: string; // bundled | extension | (open)
  enabled?: boolean;
  explicitlyEnabled?: boolean;
  activated?: boolean;
  imported?: boolean;
  activationSource?: string;
  activationReason?: string;
  configPath?: string;
  capabilityKinds?: string[]; // channel | tool | agent | provider | (open)
  channelIds?: string[];
  providerIds?: string[];
  toolNames?: string[];
  deckActionCapabilities?: DeckGoPluginActionCapabilities;
  diagnostics?: DeckGoPluginDiagnostic[];
}

interface DeckGoPluginActionCapabilities {
  login?: boolean;
  probe?: boolean;
  testMessage?: boolean;
  qrCodeAuth?: boolean;
}

interface DeckGoPluginDiagnostic {
  level: string; // error | warn | info | (open)
  message: string;
}

interface DeckGoPluginsListResponse {
  scope?: string;
  plugins?: DeckGoPluginInventoryEntry[];
}
```

## Frontend wrappers

- `fetchPluginsWithCapability(capability: "channel" | "all"): Promise<DeckGoPluginsListResponse>`
- `fetchChannels(): Promise<DeckGoChannelsStatusResponse>` (cross-link)
- `fetchProjectedManifest(pluginId: string): Promise<ProjectedManifest | null>` _(BFF projection)_
- `fetchActivationTimeline(pluginId: string): Promise<ActivationEvent[]>` _(BFF projection)_

## BFF projections (not part of the contract)

The Deck plugin inventory API does NOT surface raw manifests or activation
history. The workbench leans on two BFF-side projections that we own. They are
flagged here so engineering can wire them with the same caution as any other
BFF-only data:

### `manifest: ProjectedManifest`

```ts
interface ProjectedManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  origin: "bundled" | "extension" | "implicit";
  capabilityKinds: string[];
  channelIds: string[];
  providerIds: string[];
  toolNames: string[];
  configSchema?: { $ref: string; version: string };
  runtime?: { node: string; bin: string };
  deckActions: DeckGoPluginActionCapabilities;
  permissions: string[];
}
```

BFF maintains a curated set (bundled core + selected extensions). Plugins
without a curated entry get a `null` projection and the UI falls back to
inventory fields wrapped as a synthetic manifest. Vendor plugin manifests
remain authoritative when available; the projection is just a UI-friendly
restatement.

### `audit: ActivationEvent[]`

```ts
interface ActivationEvent {
  ts: number;
  actor: "system" | string;
  event: "imported" | "activated" | "deactivated" | "diagnostic" | "config-edit" | "error" | string;
  note?: string;
}
```

BFF projection over config history (`openclaw.json plugins.entries`) +
diagnostics replay from Gateway logs. Window unspecified — see open
assumptions.

## Endpoint summary

| Endpoint                           | Method | When                            | DTO                            |
| ---------------------------------- | ------ | ------------------------------- | ------------------------------ |
| `/api/deck/plugins`                | GET    | Default load when scope=channel | `DeckGoPluginsListResponse`    |
| `/api/deck/plugins?capability=all` | GET    | Workbench load (full inventory) | `DeckGoPluginsListResponse`    |
| `/api/channels`                    | GET    | Cross-link affordance check     | `DeckGoChannelsStatusResponse` |
| `/api/deck/plugins/<id>/manifest`  | GET    | Detail tab `manifest` (BFF)     | `ProjectedManifest \| null`    |
| `/api/deck/plugins/<id>/audit`     | GET    | Detail tab `audit` (BFF)        | `ActivationEvent[]`            |

(The last two are BFF-only — they are not part of the Gateway plugin contract
and may not exist server-side yet; flagged in api-discrepancy.md when wiring.)

## Backend chain

```
PluginsPanel / plugin helper components
  → frontend-new/src/api/plugins.ts
  → deck-go Go BFF routes
    ├── Gateway RPC plugins.list (read-only)
    └── BFF projections (manifest curation + config-history audit)
  → Gateway (only via the BFF / runtime boundary)
```

## Mock requirements

- 12+ plugins covering all 4 capability kinds (`channel`, `tool`, `agent`, `provider`).
- Both origins (`bundled`, `extension`) represented.
- All diagnostic levels (`error`, `warn`, `info`) and the clean state.
- Multiple activation source values (`config`, `extension`, `implicit`).
- Cases for every state-chain combination:
  - `imported=false, enabled=false, activated=false` (untouched)
  - `imported=true, enabled=false, activated=false` (disabled)
  - `imported=true, enabled=true, activated=false` (pending or error)
  - `imported=true, enabled=true, activated=true` (ready)
  - `imported=true, enabled=true, activated=true, explicitlyEnabled=false` (implicit)
- Manifest projection present for at least 2 plugins, absent for the rest.
- Activation timeline present for at least 3 plugins (1 happy, 1 error, 1 long config history).

## Unsupported semantics

- No install / uninstall mutation on the contract today.
- No enable / disable / reload mutation.
- No marketplace or trust source.
- No package signature verification.
- No production activation assurance — `activated` is reported by Gateway, but the panel does not
  drive activation.

If any of the above ships in a future contract, we should:

1. Update the inventory DTO and add proposal entries here.
2. Carve out a new tab / wizard rather than overloading the existing 6-tab read-only design.

## Open contract assumptions

- **`status` enumeration.** Contract uses `string`; prototype assumes the closed set
  `ready | degraded | pending | disabled | error`. If Gateway emits other values they should
  be co-grouped under `unknown` with a `pill--muted` rendering, and we should propose a Gateway
  enum proposal back upstream.
- **`origin` enumeration.** Same shape: prototype assumes `bundled | extension`. Implicit
  plugins (e.g., `anthropic-cache`) currently piggyback on `extension` because they have no
  config path; the prototype displays this with the `meta-pill--implicit` chip. We may want a
  dedicated `origin = "implicit"` once the contract opens up.
- **Capability kinds.** Contract is open; prototype handles `channel | tool | agent | provider`.
  Anything else should fall back to a generic chip and not break filters.
- **Activation timeline retention.** No documented cap; prototype renders unbounded. Production
  should paginate or clamp once we know the BFF cap.
- **Diagnostic level.** Contract uses `level: string`; prototype groups
  `error | warn | info`. New levels go to `info` until a tighter contract lands.
