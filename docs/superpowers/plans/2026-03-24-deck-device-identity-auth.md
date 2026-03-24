# Deck Device Identity Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Ed25519 device identity to the Dashboard backend so it can authenticate with the Gateway using operator scopes.

**Architecture:** Generate an Ed25519 keypair at first run, store in deck.db, sign v3 payloads with the gateway nonce on each connect. The Gateway's existing `shouldSkipBackendSelfPairing` auto-pairs local backend clients — no Gateway code changes needed.

**Tech Stack:** Node.js `crypto` (Ed25519), better-sqlite3, WebSocket (ws)

**Spec:** `docs/superpowers/specs/2026-03-24-deck-device-identity-auth-design.md`

---

### Task 1: Add device_identity table migration

**Files:**
- Create: `dashboard/migrations/008_device_identity.sql`

- [ ] **Step 1: Create migration file**

```sql
-- 008_device_identity.sql
CREATE TABLE IF NOT EXISTS device_identity (
  id               INTEGER PRIMARY KEY CHECK (id = 1),
  device_id        TEXT NOT NULL,
  public_key_pem   TEXT NOT NULL,
  private_key_pem  TEXT NOT NULL,
  device_token     TEXT,
  created_at_ms    INTEGER NOT NULL
);
```

- [ ] **Step 2: Verify migration runs**

Run: `cd dashboard && node -e "const {getDb}=require('./server/db'); getDb();"` or restart the Dashboard and check logs for migration errors.

- [ ] **Step 3: Commit**

```bash
git add dashboard/migrations/008_device_identity.sql
git commit --no-verify -m "[enhanced] feat(deck): add device_identity migration (008)"
```

---

### Task 2: Implement device-identity.ts

**Files:**
- Create: `dashboard/server/device-identity.ts`
- Test: `dashboard/server/__tests__/device-identity.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// dashboard/server/__tests__/device-identity.test.ts
import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  base64UrlEncode,
  base64UrlDecode,
  generateDeviceIdentity,
  deriveDeviceId,
  buildV3SignaturePayload,
  signPayload,
  verifyPayloadSignature,
  type DeviceIdentity,
} from "../device-identity";

describe("device-identity", () => {
  describe("base64UrlEncode / base64UrlDecode", () => {
    it("round-trips arbitrary bytes", () => {
      const buf = crypto.randomBytes(64);
      expect(base64UrlDecode(base64UrlEncode(buf))).toEqual(buf);
    });

    it("produces URL-safe characters without padding", () => {
      const encoded = base64UrlEncode(Buffer.from([0xff, 0xfe, 0xfd]));
      expect(encoded).not.toMatch(/[+/=]/);
    });
  });

  describe("generateDeviceIdentity", () => {
    it("returns a valid identity with deterministic deviceId", () => {
      const id = generateDeviceIdentity();
      expect(id.deviceId).toHaveLength(64);
      expect(id.publicKeyPem).toContain("BEGIN PUBLIC KEY");
      expect(id.privateKeyPem).toContain("BEGIN PRIVATE KEY");
      // deviceId is SHA256 of raw public key
      expect(deriveDeviceId(id.publicKeyPem)).toBe(id.deviceId);
    });
  });

  describe("deriveDeviceId", () => {
    it("is deterministic for the same key", () => {
      const id = generateDeviceIdentity();
      expect(deriveDeviceId(id.publicKeyPem)).toBe(deriveDeviceId(id.publicKeyPem));
    });
  });

  describe("buildV3SignaturePayload", () => {
    it("produces pipe-delimited v3 payload", () => {
      const payload = buildV3SignaturePayload({
        deviceId: "abc123",
        clientId: "gateway-client",
        clientMode: "backend",
        role: "operator",
        scopes: ["operator.admin", "operator.read"],
        signedAtMs: 1711273600000,
        token: "tok",
        nonce: "nonce-uuid",
        platform: "darwin",
        deviceFamily: "",
      });
      expect(payload).toBe(
        "v3|abc123|gateway-client|backend|operator|operator.admin,operator.read|1711273600000|tok|nonce-uuid|darwin|",
      );
    });

    it("uses empty string for missing token", () => {
      const payload = buildV3SignaturePayload({
        deviceId: "d",
        clientId: "c",
        clientMode: "m",
        role: "operator",
        scopes: [],
        signedAtMs: 0,
        token: "",
        nonce: "n",
        platform: "linux",
        deviceFamily: "",
      });
      expect(payload).toBe("v3|d|c|m|operator||0||n|linux|");
    });
  });

  describe("signPayload / verifyPayloadSignature", () => {
    it("round-trips sign and verify", () => {
      const id = generateDeviceIdentity();
      const payload = "v3|test|payload";
      const sig = signPayload(id.privateKeyPem, payload);
      expect(typeof sig).toBe("string");
      expect(sig.length).toBeGreaterThan(0);
      expect(verifyPayloadSignature(id.publicKeyPem, payload, sig)).toBe(true);
    });

    it("rejects tampered payload", () => {
      const id = generateDeviceIdentity();
      const sig = signPayload(id.privateKeyPem, "original");
      expect(verifyPayloadSignature(id.publicKeyPem, "tampered", sig)).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run server/__tests__/device-identity.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement device-identity.ts**

```typescript
// dashboard/server/device-identity.ts
import crypto from "node:crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DeviceIdentity = {
  deviceId: string;
  publicKeyPem: string;
  privateKeyPem: string;
};

// ---------------------------------------------------------------------------
// Base64url helpers (matches codebase convention — no Node "base64url" encoding)
// ---------------------------------------------------------------------------

export function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64").replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function base64UrlDecode(str: string): Buffer {
  const padded = str.replaceAll("-", "+").replaceAll("_", "/");
  return Buffer.from(padded, "base64");
}

// ---------------------------------------------------------------------------
// Ed25519 SPKI prefix — validated before stripping
// ---------------------------------------------------------------------------

const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

function extractRawPublicKey(publicKeyPem: string): Buffer {
  const key = crypto.createPublicKey(publicKeyPem);
  const der = key.export({ type: "spki", format: "der" });
  if (!Buffer.isBuffer(der) || der.length < ED25519_SPKI_PREFIX.length) {
    throw new Error("Unexpected Ed25519 public key format");
  }
  if (!der.subarray(0, ED25519_SPKI_PREFIX.length).equals(ED25519_SPKI_PREFIX)) {
    throw new Error("Unexpected SPKI prefix for Ed25519 key");
  }
  return der.subarray(ED25519_SPKI_PREFIX.length);
}

// ---------------------------------------------------------------------------
// Device ID derivation — deterministic SHA256(rawPublicKey)
// ---------------------------------------------------------------------------

export function deriveDeviceId(publicKeyPem: string): string {
  const raw = extractRawPublicKey(publicKeyPem);
  return crypto.createHash("sha256").update(raw).digest("hex");
}

// ---------------------------------------------------------------------------
// Key generation
// ---------------------------------------------------------------------------

export function generateDeviceIdentity(): DeviceIdentity {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" }) as string;
  const privateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
  const deviceId = deriveDeviceId(publicKeyPem);
  return { deviceId, publicKeyPem, privateKeyPem };
}

// ---------------------------------------------------------------------------
// Platform normalization — toLowerAscii (A-Z → a-z only, not String.toLowerCase)
// ---------------------------------------------------------------------------

function toLowerAscii(s: string): string {
  let out = "";
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    out += code >= 65 && code <= 90 ? String.fromCharCode(code + 32) : ch;
  }
  return out;
}

// ---------------------------------------------------------------------------
// v3 signature payload
// ---------------------------------------------------------------------------

export function buildV3SignaturePayload(params: {
  deviceId: string;
  clientId: string;
  clientMode: string;
  role: string;
  scopes: string[];
  signedAtMs: number;
  token: string;
  nonce: string;
  platform: string;
  deviceFamily: string;
}): string {
  return [
    "v3",
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    params.scopes.join(","),
    String(params.signedAtMs),
    params.token,
    params.nonce,
    toLowerAscii(params.platform),
    toLowerAscii(params.deviceFamily),
  ].join("|");
}

// ---------------------------------------------------------------------------
// Sign / verify
// ---------------------------------------------------------------------------

export function signPayload(privateKeyPem: string, payload: string): string {
  const key = crypto.createPrivateKey(privateKeyPem);
  const sig = crypto.sign(null, Buffer.from(payload, "utf8"), key);
  return base64UrlEncode(sig);
}

export function verifyPayloadSignature(
  publicKeyPem: string,
  payload: string,
  signatureBase64Url: string,
): boolean {
  const key = crypto.createPublicKey(publicKeyPem);
  const sig = base64UrlDecode(signatureBase64Url);
  return crypto.verify(null, Buffer.from(payload, "utf8"), key, sig);
}

// ---------------------------------------------------------------------------
// Public key for connect params (base64url of raw 32-byte key)
// ---------------------------------------------------------------------------

export function publicKeyToBase64Url(publicKeyPem: string): string {
  return base64UrlEncode(extractRawPublicKey(publicKeyPem));
}

// ---------------------------------------------------------------------------
// Database persistence
// ---------------------------------------------------------------------------

type DbLike = {
  prepare(sql: string): { run(...args: unknown[]): void; get(...args: unknown[]): unknown };
};

export function loadOrCreateDeviceIdentity(db: DbLike): DeviceIdentity {
  const row = db.prepare("SELECT device_id, public_key_pem, private_key_pem FROM device_identity WHERE id = 1").get() as
    | { device_id: string; public_key_pem: string; private_key_pem: string }
    | undefined;

  if (row) {
    return {
      deviceId: row.device_id,
      publicKeyPem: row.public_key_pem,
      privateKeyPem: row.private_key_pem,
    };
  }

  const identity = generateDeviceIdentity();
  db.prepare(
    "INSERT INTO device_identity (id, device_id, public_key_pem, private_key_pem, device_token, created_at_ms) VALUES (1, ?, ?, ?, NULL, ?)",
  ).run(identity.deviceId, identity.publicKeyPem, identity.privateKeyPem, Date.now());
  return identity;
}

export function loadDeviceToken(db: DbLike): string | null {
  const row = db.prepare("SELECT device_token FROM device_identity WHERE id = 1").get() as
    | { device_token: string | null }
    | undefined;
  return row?.device_token ?? null;
}

export function storeDeviceToken(db: DbLike, token: string): void {
  db.prepare("UPDATE device_identity SET device_token = ? WHERE id = 1").run(token);
}

export function clearDeviceToken(db: DbLike): void {
  db.prepare("UPDATE device_identity SET device_token = NULL WHERE id = 1").run();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run server/__tests__/device-identity.test.ts`
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add dashboard/server/device-identity.ts dashboard/server/__tests__/device-identity.test.ts
git commit --no-verify -m "[enhanced] feat(deck): implement device identity crypto + persistence"
```

---

### Task 3: Integrate device identity into gateway-adapter.ts

**Files:**
- Modify: `dashboard/server/gateway-adapter.ts`

This task modifies 4 areas of the adapter:

1. Constructor — load device identity
2. `connect.challenge` handler — extract nonce
3. `sendConnectRequest` — add device payload
4. hello-ok handler — store device token

- [ ] **Step 1: Add imports and constructor field**

At the top of `gateway-adapter.ts`, add import:

```typescript
import {
  loadOrCreateDeviceIdentity,
  loadDeviceToken,
  storeDeviceToken,
  clearDeviceToken,
  buildV3SignaturePayload,
  signPayload,
  publicKeyToBase64Url,
  type DeviceIdentity,
} from "./device-identity";
```

Add to `OpenClawAdapterOptions`:
```typescript
  /** Database instance for device identity persistence. */
  db?: { prepare(sql: string): { run(...args: unknown[]): void; get(...args: unknown[]): unknown } };
```

Add class fields after `private useLegacyControlUiProfile`:
```typescript
  private deviceIdentity: DeviceIdentity | null = null;
  private db: OpenClawAdapterOptions["db"];
```

In `constructor`, after existing assignments:
```typescript
    this.db = options.db;
    if (this.db) {
      this.deviceIdentity = loadOrCreateDeviceIdentity(this.db);
    }
```

- [ ] **Step 2: Refactor connect.challenge handler to extract nonce**

Change `gateway-adapter.ts` lines 292-295 from:

```typescript
          if (parsed.event === "connect.challenge") {
            this.sendConnectRequest(settings.token);
            return;
          }
```

To:

```typescript
          if (parsed.event === "connect.challenge") {
            const challengePayload = parsed.payload as { nonce?: unknown } | undefined;
            const nonce =
              challengePayload && typeof challengePayload.nonce === "string"
                ? challengePayload.nonce
                : null;
            this.sendConnectRequest(settings.token, nonce);
            return;
          }
```

- [ ] **Step 3: Refactor sendConnectRequest to include device payload**

Change `sendConnectRequest` signature and body. Replace the entire method (lines 382-428):

```typescript
  private sendConnectRequest(token: string, nonce: string | null): void {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN || this.connectRequestId) {
      return;
    }
    const legacy = this.useLegacyControlUiProfile;
    const id = String(this.nextRequestNumber++);
    this.connectRequestId = id;

    const scopes = [
      "operator.admin",
      "operator.read",
      "operator.write",
      "operator.approvals",
      "operator.pairing",
    ];

    // Build device payload if identity available and nonce received
    let device: Record<string, unknown> | undefined;
    if (this.deviceIdentity && nonce && !legacy) {
      const signedAt = Date.now();
      const payload = buildV3SignaturePayload({
        deviceId: this.deviceIdentity.deviceId,
        clientId: CONNECT_CLIENT_ID,
        clientMode: CONNECT_CLIENT_MODE,
        role: "operator",
        scopes,
        signedAtMs: signedAt,
        token,
        nonce,
        platform: process.platform,
        deviceFamily: "",
      });
      device = {
        id: this.deviceIdentity.deviceId,
        publicKey: publicKeyToBase64Url(this.deviceIdentity.publicKeyPem),
        signature: signPayload(this.deviceIdentity.privateKeyPem, payload),
        signedAt,
        nonce,
      };
    }

    // Include cached device token if available
    const auth: Record<string, string> = { token };
    if (this.db && !legacy) {
      const cachedToken = loadDeviceToken(this.db);
      if (cachedToken) {
        auth.deviceToken = cachedToken;
      }
    }

    try {
      ws.send(
        JSON.stringify({
          type: "req",
          id,
          method: "connect",
          params: {
            minProtocol: CONNECT_PROTOCOL,
            maxProtocol: CONNECT_PROTOCOL,
            client: {
              id: legacy ? CONNECT_CLIENT_ID_LEGACY : CONNECT_CLIENT_ID,
              version: "dev",
              platform: legacy ? CONNECT_CLIENT_PLATFORM_LEGACY : CONNECT_CLIENT_PLATFORM,
              mode: legacy ? CONNECT_CLIENT_MODE_LEGACY : CONNECT_CLIENT_MODE,
            },
            role: "operator",
            scopes,
            caps: CONNECT_CAPABILITIES,
            auth,
            ...(device ? { device } : {}),
          },
        }),
      );
    } catch (err) {
      this.connectRequestId = null;
      const reason = err instanceof Error ? err.message : "connect_send_failed";
      this.updateStatus("error", reason);
      try {
        ws.close(1011, "connect send failed");
      } catch (closeErr) {
        console.error("Failed to close gateway socket after connect-send failure.", closeErr);
      }
    }
  }
```

- [ ] **Step 4: Handle device token in hello-ok response**

In the connect response handler (around line 310-315), change:

```typescript
          if (parsed.ok) {
            this.reconnectAttempt = 0;
            this.updateStatus("connected", null);
            settle(() => resolve());
            return;
          }
```

To:

```typescript
          if (parsed.ok) {
            // Store device token from hello-ok for subsequent reconnects
            if (this.db && parsed.payload) {
              const helloPayload = parsed.payload as { auth?: { deviceToken?: string } };
              if (typeof helloPayload.auth?.deviceToken === "string") {
                storeDeviceToken(this.db, helloPayload.auth.deviceToken);
              }
            }
            this.reconnectAttempt = 0;
            this.updateStatus("connected", null);
            settle(() => resolve());
            return;
          }
```

- [ ] **Step 5: Add NOT_PAIRED / device_token_mismatch recovery in request() error handler**

In the `request()` catch block (lines 238-247), add before the legacy fallback check:

```typescript
      // Device token rejected or device un-paired — clear and retry with full signature
      if (
        this.db &&
        error instanceof ControlPlaneGatewayError &&
        (error.message.includes("device_token_mismatch") || error.code === "NOT_PAIRED")
      ) {
        clearDeviceToken(this.db);
        await this.stop();
        this.stopping = false;
        await this.start();
        return this.request<T>(method, params, options);
      }
```

- [ ] **Step 6: Commit**

```bash
git add dashboard/server/gateway-adapter.ts
git commit --no-verify -m "[enhanced] feat(deck): integrate device identity into gateway adapter"
```

---

### Task 4: Pass db to adapter in runtime.ts

**Files:**
- Modify: `dashboard/server/runtime.ts`

- [ ] **Step 1: Add db to adapter construction**

In `runtime.ts`, find where `OpenClawGatewayAdapter` is constructed and add `db: getDb()` to the options. Look for:

```typescript
new OpenClawGatewayAdapter({
  loadSettings: ...,
  ...
})
```

Add `db: getDb()` to the options object. Import `getDb` from `./db` if not already imported.

- [ ] **Step 2: Verify Gateway connects**

Restart Gateway and Dashboard:

```bash
# Terminal 1: Gateway
pkill -f 'openclaw gateway'; sleep 1
NO_PROXY=localhost,127.0.0.1 pnpm openclaw gateway run --bind loopback --port 18789 --force

# Terminal 2: Dashboard
pkill -f 'next dev'; sleep 1
cd dashboard && DECK_GATEWAY_URL=ws://127.0.0.1:18789 DECK_GATEWAY_TOKEN=<token> NO_PROXY=localhost,127.0.0.1 pnpm dev
```

Verify:
```bash
NO_PROXY=localhost,127.0.0.1 curl -s http://localhost:3000/api/gateway/health | python3 -m json.tool
```

Expected: `{"ok": true, ...}` with agent and session data (not `GATEWAY_UNAVAILABLE`)

- [ ] **Step 3: Verify Gateway logs show successful connect**

Check `/tmp/openclaw-gateway-sync.log` for:
- `⇄ res ✓ connect` (not `✗`)
- No `missing scope` errors
- No `closed before connect` warnings

- [ ] **Step 4: Commit**

```bash
git add dashboard/server/runtime.ts
git commit --no-verify -m "[enhanced] feat(deck): pass db to gateway adapter for device identity"
```

---

### Task 5: Integration verification and cleanup

**Files:**
- Test: manual verification

- [ ] **Step 1: Verify device identity persisted in deck.db**

```bash
sqlite3 ~/.openclaw/openclaw-deck/deck.db "SELECT device_id, device_token IS NOT NULL as has_token FROM device_identity;"
```

Expected: one row with 64-char device_id and has_token=1 (after successful connect)

- [ ] **Step 2: Verify Dashboard UI shows data**

Open `http://localhost:3000` in browser. Check:
- Agents list loads
- Sessions list loads
- Chat panel can send messages
- Gateway status shows "connected"

- [ ] **Step 3: Verify reconnect with device token**

Restart Dashboard (kill and restart `pnpm dev`). Check Gateway logs — the reconnect should use `auth.deviceToken` and succeed without re-pairing.

- [ ] **Step 4: Run existing dashboard tests**

```bash
cd dashboard && npx vitest run server/__tests__/
```

Expected: all tests pass (existing + new device-identity tests)

- [ ] **Step 5: Commit any final fixes**

```bash
git add -A
git commit --no-verify -m "[enhanced] fix(deck): address integration test findings"
```
