# Deck Device Identity Authentication

## Problem

After syncing upstream (2026-03-24), the Gateway enforces stricter authentication for operator-scope connections. Inside `handleMissingDeviceIdentity` (`message-handler.ts`), device-less connections have their scopes cleared via `clearUnboundScopes()` even when shared token auth succeeds and `evaluateMissingDeviceIdentity` returns `allow`. The Dashboard backend connects as `gateway-client` / `backend` mode without device identity, causing `missing scope: operator.read` errors on all RPC calls.

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
  │   ├─ Receive connect.challenge event → extract nonce from payload
  │   ├─ Build v3 signature payload (nonce passed as parameter)
  │   ├─ Sign payload with Ed25519 private key
  │   ├─ Send connect request with device identity + auth token
  │   └─ Gateway validates → auto-pairs → returns device token in hello-ok
  │
  └─ Subsequent reconnects
      ├─ Include stored device token in auth.deviceToken
      ├─ On hello-ok: always update stored device token (handles rotation)
      └─ On token rejected / NOT_PAIRED: clear cache, retry with full signature
```

## Scope

### New file

**`dashboard/server/device-identity.ts`**

Responsibilities:
- Generate Ed25519 keypair using Node.js `crypto.generateKeyPairSync("ed25519")`
- Derive deterministic deviceId: `SHA256(publicKeyRaw)` → 64-char hex, using validated `ED25519_SPKI_PREFIX` stripping (not hardcoded offset)
- Persist keypair in deck.db `device_identity` table
- Build v3 device auth payload string using `normalizeDeviceMetadataForAuth`-compatible normalization (lowercase ASCII only via character-level A-Z→a-z replacement, not `String.toLowerCase()`)
- Sign payload with `crypto.sign(null, buffer, privateKey)` → base64url (use manual `replaceAll("+","-").replaceAll("/","_").replace(/=+$/,"")` encoding to match codebase convention)
- Load/store device token from deck.db

Key functions:
- `loadOrCreateDeckDeviceIdentity(db): DeviceIdentity` — idempotent load/create
- `buildDevicePayload(identity, params): { id, publicKey, signature, signedAt, nonce }` — construct connect device field. `publicKey` is the base64url of the raw 32-byte Ed25519 key (not PEM, not full SPKI DER)
- `loadDeviceToken(db): string | null` — retrieve cached device token
- `storeDeviceToken(db, token): void` — persist device token from hello-ok

### Modified file

**`dashboard/server/gateway-adapter.ts`**

Changes:

1. On construction, load/create device identity from db

2. Refactor `connect.challenge` handler (currently at line 293-294):
   - **Current**: discards payload, immediately calls `this.sendConnectRequest(settings.token)`
   - **After**: extract nonce from `parsed.payload.nonce`, pass to `sendConnectRequest(token, nonce)`

3. Refactor `sendConnectRequest(token, nonce)`:
   - Call `buildDevicePayload(identity, { nonce, token, scopes, ... })`
   - Add `device` field to connect params
   - Include `auth.deviceToken` if available from db
   - **Token in v3 payload**: use `auth.token` (the gateway shared token), matching the server's `resolveSignatureToken()` priority order (`auth.token ?? auth.deviceToken ?? auth.bootstrapToken`)

4. On successful `hello-ok` response:
   - Extract `auth.deviceToken` from response
   - Always update stored token (handles server-side rotation)

5. Error recovery:
   - On `NOT_PAIRED` error: clear stored device token, retry with full signature flow (re-triggers auto-pairing via `shouldSkipBackendSelfPairing`)
   - On `device_token_mismatch`: clear cached token, retry once with full signature

6. Retain legacy Control UI fallback (`switchToLegacyControlUiProfile`) for backward compatibility with older Gateways during rolling upgrades. Only triggered if the primary `gateway-client` + `backend` connect fails with a protocol-level rejection (not a scope error).

### Database schema

Add to deck.db initialization (`dashboard/server/db.ts`):

```sql
CREATE TABLE IF NOT EXISTS device_identity (
  id               INTEGER PRIMARY KEY CHECK (id = 1),
  device_id        TEXT NOT NULL,
  public_key_pem   TEXT NOT NULL,
  private_key_pem  TEXT NOT NULL,
  device_token     TEXT,
  created_at_ms    INTEGER NOT NULL
);
```

Single-row table (enforced by `CHECK (id = 1)`) with typed columns.

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
  auth: { token: "<gateway-token>", deviceToken: "<cached-or-undefined>" },
  device: {
    id: "<sha256-of-pubkey-hex-64>",
    publicKey: "<base64url-of-raw-32-byte-ed25519-key>",
    signature: "<base64url-of-ed25519-signature>",
    signedAt: 1711273600000,
    nonce: "<uuid-from-connect-challenge>",
  },
}
```

## Gateway auth flow (no changes needed)

1. Gateway sends `connect.challenge` with `{ nonce: "<uuid>" }`
2. Dashboard extracts nonce, builds v3 payload, signs it
3. Dashboard sends `connect` with device identity + auth token
4. Gateway validates:
   - Derives deviceId from publicKey, checks match ✓
   - Signature timestamp within ±2 min ✓
   - Nonce matches challenge ✓
   - Reconstructs v3 payload (using `resolveSignatureToken` for token field), verifies signature ✓
5. `shouldSkipBackendSelfPairing()` returns true (gateway-client + backend + local + no browser origin + token auth) → auto-paired
6. Scopes preserved (device identity present → `clearUnboundScopes` not triggered)
7. Gateway returns `hello-ok` with `auth.deviceToken`
8. Dashboard stores device token for next reconnect

## v3 payload format

Pipe-delimited string signed by Ed25519 private key:

```
v3|{deviceId}|gateway-client|backend|operator|{scopes_csv}|{signedAtMs}|{token}|{nonce}|{platform}|{deviceFamily}
```

- `scopes_csv`: comma-separated scope list (e.g. `operator.admin,operator.read,operator.write`)
- `token`: the value from `auth.token` (gateway shared token). If not provided, empty string. Must match server's `resolveSignatureToken()` resolution order
- `platform`: `process.platform` normalized via `toLowerAscii()` (character-level A-Z → a-z only, not `String.toLowerCase()`)
- `deviceFamily`: empty string for Dashboard backend (no physical device family)
- Fields are joined with `|` via `Array.join("|")` — the last field being empty string produces a trailing pipe

## Crypto implementation

All crypto uses Node.js built-in `crypto` module (no external deps):

```typescript
import crypto from "node:crypto";

// Ed25519 SPKI prefix (12 bytes) — validate before stripping
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

// Base64url encoding (matching codebase convention)
function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64").replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

// Key generation
const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");

// Export PEM for storage
const pubPem = publicKey.export({ type: "spki", format: "pem" }) as string;
const privPem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;

// Device ID from public key (deterministic)
const pubDer = publicKey.export({ type: "spki", format: "der" }) as Buffer;
if (!pubDer.subarray(0, 12).equals(ED25519_SPKI_PREFIX)) {
  throw new Error("Unexpected SPKI prefix for Ed25519 key");
}
const rawKey = pubDer.subarray(12); // 32 bytes raw Ed25519 public key
const deviceId = crypto.createHash("sha256").update(rawKey).digest("hex");

// Sign payload
const sig = crypto.sign(null, Buffer.from(payload, "utf8"), privateKey);
const sigBase64Url = base64UrlEncode(sig);

// Public key for connect params (base64url of raw 32-byte key)
const pubBase64Url = base64UrlEncode(rawKey);
```

## Error handling

- **Key generation failure**: Fatal — Dashboard cannot start without device identity
- **Signature failure**: Retry with fresh timestamp; if persistent, regenerate keypair
- **Device token rejected** (`device_token_mismatch`): Clear cached device token in deck.db, retry with full signature flow (one retry, then fail with error)
- **Device un-paired** (`NOT_PAIRED`): Clear cached device token, retry with full signature — `shouldSkipBackendSelfPairing` will auto-approve re-pairing
- **Nonce timeout**: Existing adapter reconnection with backoff handles this
- **Device token rotation**: On every `hello-ok`, unconditionally update the stored device token in deck.db

## Testing

- Unit test `device-identity.ts`: key generation, deterministic deviceId derivation, v3 payload construction, signature creation + verification round-trip, base64url encoding
- Integration test: adapter connects to Gateway with device identity, receives hello-ok with device token, can successfully call `agents.list` / `sessions.list`

## Migration

- Existing `deck.db` with no `device_identity` table: auto-created on first access
- No data migration needed — identity is generated fresh on first run
- Previous `gateway_url` / `gateway_token` settings in deck.db remain unchanged
