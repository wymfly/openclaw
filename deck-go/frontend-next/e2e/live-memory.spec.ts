import { expect, test } from "@playwright/test";
import { gotoDashboard, setActivePanel, setEnglishLocale } from "./helpers";
import { gatewayUrl, isDashboardServerReachable, liveSmokeEnabled, resolveGatewayToken } from "./live-helpers";

const gatewayToken = resolveGatewayToken();

test.describe("@live Deck memory", () => {
  test.skip(
    !liveSmokeEnabled || !gatewayToken,
    "Set PLAYWRIGHT_LIVE_SMOKE=1 and provide a resolvable local gateway auth token before running this spec.",
  );

  test("shows memory files and health diagnostics for the main agent", async ({ page, request }) => {
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
    await setActivePanel(page, "memory");

    await expect(page.getByRole("heading", { name: "Memory Browser" })).toBeVisible();

    await page.locator("select").first().selectOption("main");
    await expect(page.getByText("AGENTS.md", { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByText("AGENTS.md", { exact: true }).click();
    await expect(page.getByText("AGENTS.md", { exact: true }).nth(1)).toBeVisible();

    await page.getByRole("button", { name: "Health" }).click();
    await expect(page.getByRole("cell", { name: "main", exact: true })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator("tbody").getByText("error", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Vector Search" }).click();
    const searchInput = page.getByPlaceholder("Search memories...");
    await expect(searchInput).toBeVisible();
    await searchInput.fill("test query");
    await searchInput.press("Enter");
    await expect(page.getByText("Not implemented — requires LanceDB extension")).toBeVisible({
      timeout: 15_000,
    });

    await page.reload();
    await setActivePanel(page, "memory");
    await expect(page.getByRole("heading", { name: "Memory Browser" })).toBeVisible({
      timeout: 15_000,
    });

    await page.locator("select").first().selectOption("main");
    await expect(page.getByText("AGENTS.md", { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Health" }).click();
    await expect(page.getByRole("cell", { name: "main", exact: true })).toBeVisible({
      timeout: 15_000,
    });
  });
});
