import { describe, it, expect } from "vitest";
import { parseSessionKey } from "./session-key-parser";

describe("parseSessionKey", () => {
  it("parses main scope key", () => {
    const result = parseSessionKey("agent:bot-1:main");
    expect(result).toEqual([
      { label: "Agent", value: "bot-1" },
      { label: "Scope", value: "main" },
    ]);
  });

  it("parses per-peer DM key", () => {
    const result = parseSessionKey("agent:bot-1:direct:user123");
    expect(result).toEqual([
      { label: "Agent", value: "bot-1" },
      { label: "Type", value: "direct" },
      { label: "Peer", value: "user123" },
    ]);
  });

  it("parses per-channel-peer key", () => {
    const result = parseSessionKey("agent:bot-1:telegram:direct:user123");
    expect(result).toEqual([
      { label: "Agent", value: "bot-1" },
      { label: "Channel", value: "telegram" },
      { label: "Type", value: "direct" },
      { label: "Peer", value: "user123" },
    ]);
  });

  it("parses per-account-channel-peer key", () => {
    const result = parseSessionKey("agent:bot-1:wecom:acct1:direct:user123");
    expect(result).toEqual([
      { label: "Agent", value: "bot-1" },
      { label: "Channel", value: "wecom" },
      { label: "Account", value: "acct1" },
      { label: "Type", value: "direct" },
      { label: "Peer", value: "user123" },
    ]);
  });

  it("parses channel:peer key (no type segment)", () => {
    const result = parseSessionKey("agent:bot-1:telegram:user123");
    expect(result).toEqual([
      { label: "Agent", value: "bot-1" },
      { label: "Channel", value: "telegram" },
      { label: "Peer", value: "user123" },
    ]);
  });

  it("handles unknown format gracefully", () => {
    const result = parseSessionKey("something:unexpected");
    expect(result).toEqual([{ label: "Key", value: "something:unexpected" }]);
  });
});
