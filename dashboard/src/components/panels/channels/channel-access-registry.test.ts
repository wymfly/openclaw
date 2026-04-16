import { describe, expect, it } from "vitest";
import { getChannelAccessDescriptor, hasDedicatedAccessSurface } from "./channel-access-registry";

describe("channel-access-registry", () => {
  it("declares WeCom as a channel with a dedicated access surface", () => {
    expect(getChannelAccessDescriptor("wecom")).toEqual({
      channelId: "wecom",
      accessKey: "wecom",
    });
    expect(hasDedicatedAccessSurface("wecom")).toBe(true);
  });

  it("returns null for channels without a dedicated access surface", () => {
    expect(getChannelAccessDescriptor("telegram")).toBeNull();
    expect(hasDedicatedAccessSurface("telegram")).toBe(false);
  });
});
