# plugins - API usage

Source of truth: `deck-go/contracts/source/deck-api.contract.ts`, `deck-go/contracts/source/deck-endpoints.contract.json`, `deck-go/frontend-new/src/api.ts`, `deck-go/backend/internal/server/inventory.go`, and the Gateway typed method `deck.plugins.list`.

Plugins are a read-only Deck BFF/Gateway inventory surface. The browser never calls Gateway directly.

## Endpoint table

| Verb  | Path                               | Request                       | Response                       |
| ----- | ---------------------------------- | ----------------------------- | ------------------------------ |
| `GET` | `/api/deck/plugins`                | none                          | `DeckGoPluginsListResponse`    |
| `GET` | `/api/deck/plugins?capability=all` | none                          | `DeckGoPluginsListResponse`    |
| `GET` | `/api/channels`                    | optional channel query params | `DeckGoChannelsStatusResponse` |

Not implemented in the current contract chain:

- `GET /api/deck/plugins/{id}/manifest`
- `GET /api/deck/plugins/{id}/audit`
- install / uninstall / enable / disable / reload mutations
- marketplace, trust-source, or package-signature endpoints

## Frontend wrappers

The active wrappers live in `frontend-new/src/api.ts`.

```typescript
export async function fetchPluginsWithCapability(
  capability?: "channel" | "all",
): Promise<DeckGoPluginsListResponse>;

export async function fetchChannels(): Promise<DeckGoChannelsStatusResponse>;
```

There are no production wrappers for manifest, audit, install, enable, disable, reload, or signature verification because there are no current BFF routes for them.

## DTO shapes

```typescript
type DeckGoPluginCapability = "channel" | "all";

interface DeckGoPluginInventoryEntry {
  id: string;
  name?: string;
  version?: string;
  status?: string;
  origin?: string;
  enabled?: boolean;
  explicitlyEnabled?: boolean;
  activated?: boolean;
  imported?: boolean;
  activationSource?: string;
  activationReason?: string;
  configPath?: string;
  capabilityKinds?: string[];
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
  level: string;
  message: string;
}

interface DeckGoPluginsListResponse {
  scope?: string;
  plugins?: DeckGoPluginInventoryEntry[];
}
```

`status`, `origin`, `capabilityKinds`, and diagnostic `level` are open strings. Production must render unknown values rather than treating them as parse errors.

## Contract-backed workflows

| Workflow                    | Source                                                  | Status                   |
| --------------------------- | ------------------------------------------------------- | ------------------------ |
| Inventory load              | `GET /api/deck/plugins`                                 | supported                |
| Capability scope            | `?capability=all` or default channel scope              | supported                |
| Search/filter               | browser projection over loaded plugins                  | supported                |
| Selected detail             | `DeckGoPluginInventoryEntry` fields                     | supported                |
| Diagnostics                 | `diagnostics[]`                                         | supported                |
| Channel handoff             | plugin `channelIds` plus `GET /api/channels` visibility | supported                |
| Raw payload                 | selected inventory entry                                | supported                |
| Manifest tab                | synthetic projection from inventory                     | degraded / route-blocked |
| Audit tab                   | activation source/reason fields only                    | degraded / route-blocked |
| Lifecycle controls          | no mutation endpoints                                   | unsupported follow-up    |
| Marketplace/trust/signature | no endpoints                                            | unsupported follow-up    |

## Real-stack verification notes

The bounded L2 test starts a real Gateway stack, calls `/api/deck/plugins` and `/api/deck/plugins?capability=all`, opens the production UI, switches scope, and asserts browser code does not call Gateway HTTP/WebSocket endpoints directly.

The real Gateway may return an empty plugin inventory in an allow-unconfigured test environment. That is an empty-valid state for this module as long as response envelopes are valid and the UI renders without errors.
