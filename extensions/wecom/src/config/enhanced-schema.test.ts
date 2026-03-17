import { describe, it, expect } from "vitest";
import { WecomConfigSchema } from "./schema.js";

describe("enhanced config schema", () => {
  it("accepts valid enhanced config with all fields", () => {
    const input = {
      bot: { ws: { botId: "b1", secret: "s1" } },
      enhanced: {
        quotaTracking: true,
        reqIdPersistence: true,
        reasoningMode: "separate",
        pendingReply: {
          enabled: true,
          maxRetries: 5,
          sweepIntervalMs: 30_000,
        },
      },
    };
    const result = WecomConfigSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.enhanced?.quotaTracking).toBe(true);
      expect(result.data.enhanced?.reasoningMode).toBe("separate");
      expect(result.data.enhanced?.pendingReply?.maxRetries).toBe(5);
    }
  });

  it("accepts config without enhanced (defaults to undefined)", () => {
    const input = {
      bot: { ws: { botId: "b1", secret: "s1" } },
    };
    const result = WecomConfigSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.enhanced).toBeUndefined();
    }
  });

  it("accepts partial enhanced config", () => {
    const input = {
      enhanced: {
        quotaTracking: true,
      },
    };
    const result = WecomConfigSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.enhanced?.quotaTracking).toBe(true);
      expect(result.data.enhanced?.reasoningMode).toBeUndefined();
      expect(result.data.enhanced?.pendingReply).toBeUndefined();
    }
  });

  it("rejects invalid reasoningMode value", () => {
    const input = {
      enhanced: {
        reasoningMode: "invalid",
      },
    };
    const result = WecomConfigSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("accepts all valid reasoningMode values", () => {
    for (const mode of ["separate", "append", "hidden"]) {
      const result = WecomConfigSchema.safeParse({
        enhanced: { reasoningMode: mode },
      });
      expect(result.success).toBe(true);
    }
  });

  it("accepts enhanced with empty pendingReply object", () => {
    const input = {
      enhanced: {
        pendingReply: {},
      },
    };
    const result = WecomConfigSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});
