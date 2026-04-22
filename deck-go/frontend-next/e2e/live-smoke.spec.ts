import { expect, test } from "@playwright/test";
import { gotoDashboard, setActivePanel, setEnglishLocale } from "./helpers";
import {
  gatewayUrl,
  isDashboardServerReachable,
  liveSmokeEnabled,
  resolveGatewayToken,
} from "./live-helpers";

const gatewayToken = resolveGatewayToken();

test.describe("@live Deck live smoke", () => {
  test.skip(
    !liveSmokeEnabled || !gatewayToken,
    "Set PLAYWRIGHT_LIVE_SMOKE=1 and provide a resolvable local gateway auth token before running this spec.",
  );

  test("boots against the local Gateway and loads key Deck panels", async ({ page, request }) => {
    test.skip(
      !(await isDashboardServerReachable(request)),
      "Dashboard server is not reachable at the configured base URL.",
    );

    await setEnglishLocale(page);

    const bootstrap = await request.post("/api/onboarding/save-settings", {
      data: {
        gatewayUrl,
        gatewayToken: gatewayToken,
      },
    });
    expect(bootstrap.ok()).toBeTruthy();

    await gotoDashboard(page);

    await expect(page.locator("nav")).toBeVisible();
    await expect(page.locator("[data-chat-input]")).toBeVisible();

    await setActivePanel(page, "agents");
    await expect(page.getByRole("button", { name: /main/i }).first()).toBeVisible({
      timeout: 15_000,
    });

    await setActivePanel(page, "api-explorer");
    await expect(page.getByPlaceholder("Search methods...")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /agent\.|chat\.|sessions\./ }).first(),
    ).toBeVisible({
      timeout: 15_000,
    });
  });
});
