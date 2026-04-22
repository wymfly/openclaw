import { describe, expect, test, vi } from "vitest";
import { WECOM_ACCESS_EXCLUDE_PATHS, wecomAccessDescriptor } from "./wecom-access-descriptor";

describe("wecom-access-descriptor", () => {
  test("load returns null because WeCom keeps store-driven loading in subtree", async () => {
    await expect(
      wecomAccessDescriptor.load({
        channelId: "wecom",
        channel: null,
        configSnapshot: null,
      }),
    ).resolves.toBeNull();
  });

  test("handleManageAccess delegates account handoff to openAccessTab", () => {
    const openAccessTab = vi.fn();
    wecomAccessDescriptor.handleManageAccess?.("acct-main", {
      save: vi.fn(async () => true),
      refresh: vi.fn(async () => {}),
      openAccessTab,
    });
    expect(openAccessTab).toHaveBeenCalledWith("acct-main");
  });

  test("exports the expected settings exclude paths", () => {
    expect(wecomAccessDescriptor.settingsExcludePaths).toEqual(WECOM_ACCESS_EXCLUDE_PATHS);
    expect(wecomAccessDescriptor.usesAccessTabForAccountConfig).toBe(true);
  });
});
