/**
 * Ed25519 device identity for Deck ↔ Gateway authentication.
 *
 * Provides keypair generation, deterministic device-ID derivation,
 * v3 signature payload construction, and SQLite persistence.
 * All crypto uses Node.js built-in `crypto` — no external deps.
 */
import crypto from "node:crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DeviceIdentity {
  deviceId: string;
  publicKeyPem: string;
  privateKeyPem: string;
}

/**
 * Minimal DB interface — compatible with better-sqlite3 but keeps the module
 * testable without importing the full driver.
 */
export type DbLike = {
  prepare(sql: string): {
    run(...args: unknown[]): void;
    get(...args: unknown[]): unknown;
  };
};

// ---------------------------------------------------------------------------
// Base64-URL helpers (manual, no Node base64url)
// ---------------------------------------------------------------------------

/** Encode a Buffer to base64url (RFC 7515 §2). */
export function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

/** Decode a base64url string back to a Buffer. */
export function base64UrlDecode(str: string): Buffer {
  // Restore standard base64 characters and padding.
  let b64 = str.replaceAll("-", "+").replaceAll("_", "/");
  const pad = (4 - (b64.length % 4)) % 4;
  b64 += "=".repeat(pad);
  return Buffer.from(b64, "base64");
}

// ---------------------------------------------------------------------------
// Ed25519 key helpers
// ---------------------------------------------------------------------------

/**
 * DER-encoded SPKI prefix for Ed25519 public keys.
 * The raw 32-byte key follows immediately after this prefix.
 */
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

/**
 * Extract the raw 32-byte Ed25519 public key from a PEM-encoded SPKI key.
 */
function extractRawPublicKey(publicKeyPem: string): Buffer {
  const keyObj = crypto.createPublicKey(publicKeyPem);
  const spki = keyObj.export({ type: "spki", format: "der" });

  if (spki.length !== ED25519_SPKI_PREFIX.length + 32) {
    throw new Error("Unexpected SPKI length for Ed25519 key");
  }

  // Validate the prefix matches the expected Ed25519 SPKI header.
  if (!spki.subarray(0, ED25519_SPKI_PREFIX.length).equals(ED25519_SPKI_PREFIX)) {
    throw new Error("SPKI prefix does not match Ed25519");
  }

  return spki.subarray(ED25519_SPKI_PREFIX.length);
}

// ---------------------------------------------------------------------------
// Core identity functions
// ---------------------------------------------------------------------------

/**
 * Derive a deterministic device ID from an Ed25519 public key.
 * Returns the hex-encoded SHA-256 hash of the raw 32-byte public key.
 */
export function deriveDeviceId(publicKeyPem: string): string {
  const raw = extractRawPublicKey(publicKeyPem);
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/** Generate a new Ed25519 keypair and derive the device ID. */
export function generateDeviceIdentity(): DeviceIdentity {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");

  const publicKeyPem = publicKey
    .export({ type: "spki", format: "pem" })
    .toString();
  const privateKeyPem = privateKey
    .export({ type: "pkcs8", format: "pem" })
    .toString();

  return {
    deviceId: deriveDeviceId(publicKeyPem),
    publicKeyPem,
    privateKeyPem,
  };
}

// ---------------------------------------------------------------------------
// Signature payload (v3 format)
// ---------------------------------------------------------------------------

export interface V3SignatureParams {
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
}

/**
 * ASCII-only toLowerCase — maps A-Z → a-z character-by-character,
 * leaving non-ASCII untouched (unlike String.prototype.toLowerCase).
 */
function toLowerAscii(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    // A = 0x41, Z = 0x5A
    out += c >= 0x41 && c <= 0x5A ? String.fromCharCode(c + 0x20) : s[i];
  }
  return out;
}

/**
 * Build the pipe-delimited v3 signature payload.
 *
 * Format: `v3|deviceId|clientId|clientMode|role|scopes_csv|signedAtMs|token|nonce|platform|deviceFamily`
 */
export function buildV3SignaturePayload(params: V3SignatureParams): string {
  const {
    deviceId,
    clientId,
    clientMode,
    role,
    scopes,
    signedAtMs,
    token,
    nonce,
    platform,
    deviceFamily,
  } = params;
  return [
    "v3",
    deviceId,
    clientId,
    clientMode,
    role,
    scopes.join(","),
    String(signedAtMs),
    token,
    nonce,
    toLowerAscii(platform),
    deviceFamily,
  ].join("|");
}

// ---------------------------------------------------------------------------
// Sign / verify
// ---------------------------------------------------------------------------

/** Sign a payload string with an Ed25519 private key, returning base64url. */
export function signPayload(privateKeyPem: string, payload: string): string {
  const sig = crypto.sign(null, Buffer.from(payload, "utf-8"), privateKeyPem);
  return base64UrlEncode(sig);
}

/** Verify an Ed25519 signature (base64url) against a payload. */
export function verifyPayloadSignature(
  publicKeyPem: string,
  payload: string,
  signature: string,
): boolean {
  const sigBuf = base64UrlDecode(signature);
  return crypto.verify(null, Buffer.from(payload, "utf-8"), publicKeyPem, sigBuf);
}

/** Export the raw 32-byte public key as base64url. */
export function publicKeyToBase64Url(publicKeyPem: string): string {
  return base64UrlEncode(extractRawPublicKey(publicKeyPem));
}

// ---------------------------------------------------------------------------
// SQLite persistence
// ---------------------------------------------------------------------------

interface DeviceIdentityRow {
  device_id: string;
  public_key_pem: string;
  private_key_pem: string;
  device_token: string | null;
  created_at_ms: number;
}

/**
 * Load the existing device identity from the database, or generate a new one
 * and persist it. Returns the identity either way.
 */
export function loadOrCreateDeviceIdentity(db: DbLike): DeviceIdentity {
  const row = db
    .prepare("SELECT device_id, public_key_pem, private_key_pem FROM device_identity WHERE id = 1")
    .get() as DeviceIdentityRow | undefined;

  if (row) {
    return {
      deviceId: row.device_id,
      publicKeyPem: row.public_key_pem,
      privateKeyPem: row.private_key_pem,
    };
  }

  const identity = generateDeviceIdentity();

  db.prepare(
    "INSERT INTO device_identity (id, device_id, public_key_pem, private_key_pem, created_at_ms) VALUES (1, ?, ?, ?, ?)",
  ).run(identity.deviceId, identity.publicKeyPem, identity.privateKeyPem, Date.now());

  return identity;
}

/** Load the stored device token (null if not yet registered). */
export function loadDeviceToken(db: DbLike): string | null {
  const row = db
    .prepare("SELECT device_token FROM device_identity WHERE id = 1")
    .get() as Pick<DeviceIdentityRow, "device_token"> | undefined;

  return row?.device_token ?? null;
}

/** Persist a device token received from the Gateway. */
export function storeDeviceToken(db: DbLike, token: string): void {
  db.prepare("UPDATE device_identity SET device_token = ? WHERE id = 1").run(token);
}

/** Clear the stored device token (e.g. on logout / re-registration). */
export function clearDeviceToken(db: DbLike): void {
  db.prepare("UPDATE device_identity SET device_token = NULL WHERE id = 1").run();
}
