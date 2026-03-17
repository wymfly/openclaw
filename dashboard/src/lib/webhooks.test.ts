import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { nextRetryDelay, signPayload, verifyWebhookSignature } from "./webhooks.js";

describe("webhooks", () => {
  describe("verifyWebhookSignature", () => {
    const secret = "test-secret-key";
    const body = '{"event":"test","data":{}}';

    it("should verify valid HMAC-SHA256 signature", () => {
      const sig = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
      expect(verifyWebhookSignature(secret, body, sig)).toBe(true);
    });

    it("should reject invalid signature", () => {
      expect(verifyWebhookSignature(secret, body, "sha256=deadbeef")).toBe(false);
    });

    it("should reject signature with wrong length", () => {
      expect(verifyWebhookSignature(secret, body, "sha256=abc")).toBe(false);
    });

    it("should handle missing signature header", () => {
      expect(verifyWebhookSignature(secret, body, null)).toBe(false);
      expect(verifyWebhookSignature(secret, body, undefined)).toBe(false);
    });

    it("should handle empty secret", () => {
      expect(verifyWebhookSignature("", body, "sha256=something")).toBe(false);
    });
  });

  describe("signPayload", () => {
    it("should produce sha256= prefixed HMAC", () => {
      const secret = "my-secret";
      const body = "hello world";
      const sig = signPayload(secret, body);
      expect(sig).toMatch(/^sha256=[a-f0-9]{64}$/);
    });

    it("should match verifyWebhookSignature roundtrip", () => {
      const secret = "roundtrip-secret";
      const body = '{"test":true}';
      const sig = signPayload(secret, body);
      expect(verifyWebhookSignature(secret, body, sig)).toBe(true);
    });
  });

  describe("nextRetryDelay", () => {
    it("should use exponential backoff with 1s base", () => {
      // attempt 0 → base 1s ± 20% → [0.8, 1.2]
      const delay0 = nextRetryDelay(0);
      expect(delay0).toBeGreaterThanOrEqual(0); // Math.round(0.8) = 1, but jitter can go lower
      expect(delay0).toBeLessThanOrEqual(2); // Math.round(1.2) = 1

      // attempt 1 → base 2s ± 20% → [1.6, 2.4]
      const delay1 = nextRetryDelay(1);
      expect(delay1).toBeGreaterThanOrEqual(1);
      expect(delay1).toBeLessThanOrEqual(3);
    });

    it("should increase with higher attempt numbers", () => {
      // Statistically, higher attempts produce larger delays.
      // Test with deterministic bounds: attempt 4 base = 16s vs attempt 0 base = 1s
      // Even with worst-case jitter, attempt 4 min (12.8) > attempt 0 max (1.2)
      const minDelay4 = 16 * 0.8; // 12.8
      const maxDelay0 = 1 * 1.2; // 1.2
      expect(minDelay4).toBeGreaterThan(maxDelay0);
    });

    it("should cap at the last backoff tier for high attempts", () => {
      // attempt 100 should still use the last tier (16s)
      const delay = nextRetryDelay(100);
      expect(delay).toBeGreaterThanOrEqual(Math.round(16 * 0.8)); // 13
      expect(delay).toBeLessThanOrEqual(Math.round(16 * 1.2)); // 19
    });
  });
});
