# Deck Device Identity Authentication

## Problem

After syncing upstream (2026-03-24), the Gateway enforces stricter authentication for operator-scope connections. Device-less connections have their scopes cleared (`message-handler.ts:542-550`), even when shared token auth succeeds. The Dashboard backend connects as `gateway-client` / `backend` mode without device identity, causing `missing scope: operator.read` errors on all RPC calls.

## Solution

Add Ed25519 device identity to the Dashboard backend, matching the pattern used by CLI and native apps. The Gateway already supports auto-pairing for `gateway-client + backend` mode via `shouldSkipBackendSelfPairing()` — only the client-side identity is missing.

## Architecture

```
Dashboard startup
  │
  ├─ loadOrCreateDeckDeviceIdentity()
  │   ├─ Check deck.db for stored keypair
  │   ├─ If missing: generate Ed25519 keypair, store in deck.db
  │   └─ Return { deviceId, publicKeyPem, privateKeyPem }
  │
  ├─ WebSocket connect to Gateway
  │   ├─ Receive connect.challenge (nonce from Gateway)
  │   ├─ Build v3 signature payload:
  │   │   "v3|deviceId|gateway-client|backend|operator|scopes|timestamp|token|nonce|platform|"
  │   ├─ Sign payload with Ed25519 private key
  │   ├─ Send connect request with device identity + auth token
  │   └─ Gateway validates → auto-pairs → returns device token in hello-ok
  │
  └─ Subsequent reconnects
      ├─ Include stored device token in auth.deviceToken
      └─ If token rejected, fall back to full signature flow
```

## Scope

### New file

**`dashboard/server/device-identity.ts`**

Responsibilities:
- Generate Ed25519 keypair using Node.js `crypto.generateKeyPairSync("ed25519")`
- Derive deterministic deviceId: `SHA256(publicKeyRaw)` → 64-char hex
- Persist keypair in deck.db `device_identity` table
- Build v3 device auth payload string
- Sign payload with `crypto.sign(null, buffer, privateKey)` → base64url
- Load/store device token from deck.db

Key functions:
- `loadOrCreateDeckDeviceIdentity(db): DeviceIdentity` — idempotent load/create
- `buildDevicePayload(identity, params): { id, publicKey, signature, signedAt, nonce }` — construct connect device field
- `loadDeviceToken(db): string | null` — retrieve cached device token
- `storeDeviceToken(db, token): void` — persist device token from hello-ok

### Modified file

**`dashboard/server/gateway-adapter.ts`**

Changes:
1. On construction, load/create device identity from db
2. In `sendConnectRequest()`:
   - After receiving `connect.challenge` nonce, call `buildDevicePayload()`
   - Add `device` field to connect params
   - Include `auth.deviceToken` if available (from previous hello-ok)
3. On successful `hello-ok` response:
   - Extract and store `auth.deviceToken` from response
4. Remove legacy Control UI fallback (`switchToLegacyControlUiProfile`) — no longer needed

### Database schema

Add to deck.db initialization (`dashboard/server/db.ts`):

```sql
CREATE TABLE IF NOT EXISTS device_identity (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

Stored keys:
- `publicKeyPem` — PEM-encoded public key
- `privateKeyPem` — PEM-encoded private key
- `deviceId` — derived SHA256 hex
- `deviceToken` — cached token from Gateway (nullable)
- `createdAtMs` — creation timestamp

### Connect parameters

Before (current):
```typescript
{
  client: { id: "gateway-client", mode: "backend", version: "dev", platform: "node" },
  role: "operator",
  scopes: ["operator.admin", "operator.read", "operator.write", ...],
  auth: { token: "<gateway-token>" },
  // no device field
}
```

After:
```typescript
{
  client: { id: "gateway-client", mode: "backend", version: "dev", platform: "node" },
  role: "operator",
  scopes: ["operator.admin", "operator.read", "operator.write", ...],
  auth: { token: "<gateway-token>", deviceToken: "<cached>" },
  device: {
    id: "<sha256-of-pubkey>",
    publicKey: "<base64url-encoded>",
    signature: "<base64url-signed-v3-payload>",
    signedAt: 1711273600000,
    nonce: "<uuid-from-challenge>",
  },
}
```

## Gateway auth flow (no changes needed)

1. Gateway sends `connect.challenge` with nonce
2. Dashboard sends `connect` with device identity + token
3. Gateway validates:
   - Device ID matches derived from public key ✓
   - Signature timestamp within ±2 min ✓
   - Nonce matches challenge ✓
   - Signature verifies against public key ✓
4. `shouldSkipBackendSelfPairing()` returns true (gateway-client + backend + local + token) → auto-paired
5. Scopes preserved (device identity present → no scope clearing)
6. Gateway returns `hello-ok` with device token

## v3 payload format

Pipe-delimited string signed by Ed25519 private key:

```
v3|{deviceId}|gateway-client|backend|operator|{scopes_csv}|{signedAtMs}|{token}|{nonce}|{platform}|
```

- `scopes_csv`: comma-separated scope list (e.g. `operator.admin,operator.read,operator.write`)
- `token`: gateway auth token or empty string
- `platform`: `process.platform` normalized to lowercase ASCII
- Trailing `|` represents empty `deviceFamily` field

## Crypto implementation

All crypto uses Node.js built-in `crypto` module (no external deps):

```typescript
import crypto from "node:crypto";

// Key generation
const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");

// Export PEM
const pubPem = publicKey.export({ type: "spki", format: "pem" });
const privPem = privateKey.export({ type: "pkcs8", format: "pem" });

// Device ID from public key
const pubDer = publicKey.export({ type: "spki", format: "der" });
const rawKey = pubDer.subarray(12); // Strip Ed25519 SPKI prefix (12 bytes)
const deviceId = crypto.createHash("sha256").update(rawKey).digest("hex");

// Sign payload
const sig = crypto.sign(null, Buffer.from(payload, "utf8"), privateKey);
const sigBase64Url = sig.toString("base64url");

// Public key for connect (base64url of raw 32-byte key)
const pubBase64Url = rawKey.toString("base64url");
```

## Error handling

- **Key generation failure**: Fatal — Dashboard cannot start without device identity
- **Signature failure**: Retry with fresh timestamp; if persistent, regenerate keypair
- **Device token rejected**: Clear cached token, retry with full signature flow
- **Nonce timeout**: Existing adapter logic handles reconnection with backoff

## Testing

- Unit test `device-identity.ts`: key generation, deterministic deviceId, payload construction, signature verification round-trip
- Integration test: adapter connects to Gateway with device identity, receives hello-ok, can call `agents.list`

## Migration

- Existing `deck.db` with no `device_identity` table: auto-created on first access
- No data migration needed — identity is generated fresh on first run
- Previous `gateway_url` / `gateway_token` settings in deck.db remain unchanged
