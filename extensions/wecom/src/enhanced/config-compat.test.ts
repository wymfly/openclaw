import { describe, it, expect, vi } from "vitest";
import { applyFlatKeyCompat } from "./config-compat.js";

describe("applyFlatKeyCompat", () => {
  it("maps flat botId/secret to nested bot.ws", () => {
    const input = { botId: "abc", secret: "xyz" };
    const result = applyFlatKeyCompat(input);
    expect(result.bot?.ws?.botId).toBe("abc");
    expect(result.bot?.ws?.secret).toBe("xyz");
  });

  it("maps flat dmPolicy to nested bot.dm.policy", () => {
    const input = { dmPolicy: "open" };
    const result = applyFlatKeyCompat(input);
    expect(result.bot?.dm?.policy).toBe("open");
  });

  it("maps flat allowFrom to nested bot.dm.allowFrom", () => {
    const input = { allowFrom: ["user1", "user2"] };
    const result = applyFlatKeyCompat(input);
    expect(result.bot?.dm?.allowFrom).toEqual(["user1", "user2"]);
  });

  it("maps groupPolicy 'open' to dynamicAgents.groupEnabled true", () => {
    const input = { groupPolicy: "open" };
    const result = applyFlatKeyCompat(input);
    expect(result.dynamicAgents?.groupEnabled).toBe(true);
  });

  it("maps groupPolicy 'disabled' to dynamicAgents.groupEnabled false", () => {
    const input = { groupPolicy: "disabled" };
    const result = applyFlatKeyCompat(input);
    expect(result.dynamicAgents?.groupEnabled).toBe(false);
  });

  it("maps groupPolicy 'allowlist' to dynamicAgents.groupEnabled true", () => {
    const input = { groupPolicy: "allowlist" };
    const result = applyFlatKeyCompat(input);
    expect(result.dynamicAgents?.groupEnabled).toBe(true);
  });

  it("logs warning for unsupported groupAllowFrom", () => {
    const warn = vi.fn();
    const input = { groupAllowFrom: ["g1"] };
    applyFlatKeyCompat(input, { warn });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("groupAllowFrom"));
  });

  it("logs warning for unsupported websocketUrl", () => {
    const warn = vi.fn();
    const input = { websocketUrl: "wss://custom" };
    applyFlatKeyCompat(input, { warn });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("websocketUrl"));
  });

  it("preserves nested config unchanged", () => {
    const input = { bot: { ws: { botId: "abc", secret: "xyz" } } };
    const result = applyFlatKeyCompat(input);
    expect(result.bot?.ws?.botId).toBe("abc");
    expect(result.bot?.ws?.secret).toBe("xyz");
  });

  it("nested takes precedence over flat", () => {
    const input = {
      botId: "flat",
      secret: "flat-secret",
      bot: { ws: { botId: "nested", secret: "nested-secret" } },
    };
    const result = applyFlatKeyCompat(input);
    expect(result.bot?.ws?.botId).toBe("nested");
    expect(result.bot?.ws?.secret).toBe("nested-secret");
  });

  it("nested dm takes precedence over flat dmPolicy", () => {
    const input = {
      dmPolicy: "open",
      bot: { dm: { policy: "allowlist" } },
    };
    const result = applyFlatKeyCompat(input);
    expect(result.bot?.dm?.policy).toBe("allowlist");
  });

  it("maps welcomeMessage to bot.welcomeText", () => {
    const input = { welcomeMessage: "Hello!" };
    const result = applyFlatKeyCompat(input);
    expect(result.bot?.welcomeText).toBe("Hello!");
  });

  it("returns empty-ish config when no flat keys present", () => {
    const input = { enabled: true };
    const result = applyFlatKeyCompat(input);
    expect(result.enabled).toBe(true);
    expect(result.bot).toBeUndefined();
  });

  it("strips consumed flat keys from output", () => {
    const input = { botId: "abc", secret: "xyz", enabled: true };
    const result = applyFlatKeyCompat(input);
    expect(result).not.toHaveProperty("botId");
    expect(result).not.toHaveProperty("secret");
    expect(result.enabled).toBe(true);
  });

  it("combines multiple flat keys into correct nested structure", () => {
    const input = {
      botId: "bot1",
      secret: "sec1",
      dmPolicy: "allowlist",
      allowFrom: ["uid1"],
      groupPolicy: "open",
    };
    const result = applyFlatKeyCompat(input);
    expect(result.bot?.ws?.botId).toBe("bot1");
    expect(result.bot?.ws?.secret).toBe("sec1");
    expect(result.bot?.dm?.policy).toBe("allowlist");
    expect(result.bot?.dm?.allowFrom).toEqual(["uid1"]);
    expect(result.dynamicAgents?.groupEnabled).toBe(true);
  });
});
