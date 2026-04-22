import { expect, test } from "@playwright/test";
import { gotoDashboard, setActivePanel, setEnglishLocale } from "./helpers";
import {
  gatewayUrl,
  isDashboardServerReachable,
  liveSmokeEnabled,
  resolveGatewayToken,
} from "./live-helpers";

const gatewayToken = resolveGatewayToken();

test.describe("@live Deck channels smoke", () => {
  test.skip(
    !liveSmokeEnabled || !gatewayToken,
    "Set PLAYWRIGHT_LIVE_SMOKE=1 and provide a resolvable local gateway auth token before running this spec.",
  );

  test("loads Channels and Plugins panels against the local Gateway", async ({ page, request }) => {
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
    await expect(page.getByRole("heading", { name: "Channels" })).toBeVisible();

    const channelButtons = page.locator("main [role='complementary'] button");
    if ((await channelButtons.count()) > 0) {
      await channelButtons.first().click();
      await expect(page.locator("main h2").first()).toBeVisible();
    } else {
      await expect(page.getByText("No channels configured", { exact: true }).last()).toBeVisible();
    }

    await setActivePanel(page, "plugins");
    await expect(page.getByRole("heading", { name: "Plugins" })).toBeVisible();
  });
});
