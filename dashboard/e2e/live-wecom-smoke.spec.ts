import { expect, test } from "@playwright/test";
import { gotoDashboard, setActivePanel, setEnglishLocale } from "./helpers";
import {
  gatewayUrl,
  isDashboardServerReachable,
  liveSmokeEnabled,
  liveWecomEnabled,
  resolveGatewayToken,
} from "./live-helpers";

const gatewayToken = resolveGatewayToken();

test.describe("@live-wecom Deck WeCom smoke", () => {
  test.skip(
    !liveSmokeEnabled || !liveWecomEnabled || !gatewayToken,
    "Set PLAYWRIGHT_LIVE_SMOKE=1, PLAYWRIGHT_LIVE_WECOM=1, and provide a resolvable local gateway auth token before running this spec.",
  );

  test("opens a live WeCom channel when present", async ({ page, request }) => {
    test.skip(
      !(await isDashboardServerReachable(request)),
      "Dashboard server is not reachable at the configured base URL.",
    );

    await setEnglishLocale(page);

    const bootstrap = await request.post("/api/onboarding/save-settings", {
      data: {
        gatewayUrl,
        gatewayToken,
      },
    });
    expect(bootstrap.ok()).toBeTruthy();

    await gotoDashboard(page);
    await setActivePanel(page, "channels");

    const wecomChannel = page.getByRole("button", { name: /wecom/i }).first();
    test.skip((await wecomChannel.count()) === 0, "No WeCom channel is currently available.");

    await wecomChannel.click();
    await expect(page.locator("main h2").first()).toContainText(/wecom/i);
    await expect(page.getByTestId("wecom-shell-nav")).toBeVisible();
    await expect(page.getByRole("button", { name: "Access" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open Plugin" })).toBeVisible();
  });
});
