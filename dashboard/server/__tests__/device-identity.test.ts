import { describe, it, expect } from "vitest";
import {
  base64UrlEncode,
  base64UrlDecode,
  generateDeviceIdentity,
  deriveDeviceId,
  buildV3SignaturePayload,
  signPayload,
  verifyPayloadSignature,
} from "../device-identity.js";

// ---------------------------------------------------------------------------
// base64url round-trip
// ---------------------------------------------------------------------------

describe("base64url", () => {
  it("round-trips arbitrary bytes", () => {
    const original = Buffer.from([0, 1, 2, 255, 254, 253, 128, 64, 32]);
    const encoded = base64UrlEncode(original);
    const decoded = base64UrlDecode(encoded);
    expect(decoded.equals(original)).toBe(true);
  });

  it("produces only URL-safe characters (no +, /, or =)", () => {
    // Use a buffer that would produce +, /, and = in standard base64.
    const buf = Buffer.from([0xfb, 0xef, 0xbe, 0xff, 0xff]);
    const encoded = base64UrlEncode(buf);
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
    expect(encoded).not.toContain("=");
  });

  it("round-trips an empty buffer", () => {
    const empty = Buffer.alloc(0);
    expect(base64UrlDecode(base64UrlEncode(empty)).length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// generateDeviceIdentity
// ---------------------------------------------------------------------------

describe("generateDeviceIdentity", () => {
  it("returns valid identity with PEM keys and hex device ID", () => {
    const id = generateDeviceIdentity();
    expect(id.publicKeyPem).toContain("-----BEGIN PUBLIC KEY-----");
    expect(id.privateKeyPem).toContain("-----BEGIN PRIVATE KEY-----");
    expect(id.deviceId).toMatch(/^[0-9a-f]{64}$/); // SHA-256 hex
  });

  it("derives a deterministic deviceId from the public key", () => {
    const id = generateDeviceIdentity();
    // Re-derive from the same public key — must match.
    expect(deriveDeviceId(id.publicKeyPem)).toBe(id.deviceId);
  });
});

// ---------------------------------------------------------------------------
// deriveDeviceId
// ---------------------------------------------------------------------------

describe("deriveDeviceId", () => {
  it("is deterministic — same key always produces the same ID", () => {
    const { publicKeyPem } = generateDeviceIdentity();
    const a = deriveDeviceId(publicKeyPem);
    const b = deriveDeviceId(publicKeyPem);
    expect(a).toBe(b);
  });

  it("different keys produce different IDs", () => {
    const id1 = generateDeviceIdentity();
    const id2 = generateDeviceIdentity();
    expect(id1.deviceId).not.toBe(id2.deviceId);
  });
});

// ---------------------------------------------------------------------------
// buildV3SignaturePayload
// ---------------------------------------------------------------------------

describe("buildV3SignaturePayload", () => {
  it("produces correct pipe-delimited v3 payload", () => {
    const payload = buildV3SignaturePayload({
      deviceId: "abc123",
      clientId: "deck-01",
      clientMode: "direct",
      role: "admin",
      scopes: ["read", "write"],
      signedAtMs: 1700000000000,
      token: "tok_xyz",
      nonce: "nonce42",
      platform: "Darwin",
      deviceFamily: "macbook",
    });
    expect(payload).toBe(
      "v3|abc123|deck-01|direct|admin|read,write|1700000000000|tok_xyz|nonce42|darwin|macbook",
    );
  });

  it("handles empty scopes array", () => {
    const payload = buildV3SignaturePayload({
      deviceId: "d",
      clientId: "c",
      clientMode: "m",
      role: "r",
      scopes: [],
      signedAtMs: 0,
      token: "",
      nonce: "n",
      platform: "LINUX",
      deviceFamily: "server",
    });
    expect(payload).toBe("v3|d|c|m|r||0||n|linux|server");
  });
});

// ---------------------------------------------------------------------------
// signPayload / verifyPayloadSignature
// ---------------------------------------------------------------------------

describe("sign and verify", () => {
  it("round-trips: sign then verify succeeds", () => {
    const { publicKeyPem, privateKeyPem } = generateDeviceIdentity();
    const payload = "v3|device|client|mode|role|scope|123|tok|nonce|darwin|mac";
    const sig = signPayload(privateKeyPem, payload);
    expect(verifyPayloadSignature(publicKeyPem, payload, sig)).toBe(true);
  });

  it("detects tampered payload", () => {
    const { publicKeyPem, privateKeyPem } = generateDeviceIdentity();
    const payload = "v3|device|client|mode|role|scope|123|tok|nonce|darwin|mac";
    const sig = signPayload(privateKeyPem, payload);
    expect(verifyPayloadSignature(publicKeyPem, payload + "x", sig)).toBe(false);
  });

  it("rejects signature from a different key", () => {
    const id1 = generateDeviceIdentity();
    const id2 = generateDeviceIdentity();
    const payload = "test-payload";
    const sig = signPayload(id1.privateKeyPem, payload);
    expect(verifyPayloadSignature(id2.publicKeyPem, payload, sig)).toBe(false);
  });
});
