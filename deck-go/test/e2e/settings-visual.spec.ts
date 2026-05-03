import { expect, test, type Page } from "@playwright/test";
import { openDeck, startBundledStack, type E2EStack } from "./helpers";

test.describe("settings mock visual handoff alignment", () => {
  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startBundledStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("renders settings workbench and token confirmation state with contract-shaped mock data", async ({
    page,
  }, testInfo) => {
    const unexpected = collectUnexpectedErrors(page);

    await openDeck(page, stack.frontendBase, "settings", stack.accessToken, {
      locale: "en",
      nav: "expanded",
      theme: "dark",
    });

    await expect(page.getByTestId("settings-panel")).toBeVisible();
    await expect(page.getByText("Settings ready").first()).toBeVisible();
    await expect(page.getByText("Devices ready").first()).toBeVisible();
    await expect(page.getByText("Runtime endpoint").first()).toBeVisible();
    await expect(page.getByText("Deck-go local settings")).toBeVisible();
    await expect(page.getByText("Ops laptop")).toBeVisible();
    await expect(page.getByText("Ops tablet")).toBeVisible();
    await page.waitForTimeout(500);

    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("settings-workbench-ready.png"),
    });

    const tabletRow = page.locator(".settings-device-row").filter({ hasText: "Ops tablet" });
    await tabletRow.getByRole("button", { name: "Rotate token" }).click();
    await expect(page.getByText("Rotate viewer token for visual-ops-tablet?")).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("settings-confirm-rotate.png"),
    });
    await page
      .locator(".settings-confirm-dialog")
      .getByRole("button", { name: "Rotate token" })
      .click();
    await expect(page.getByText("New token generated")).toBeVisible();
    await expect(page.locator(".settings-token-dialog code")).toHaveText(
      "visual-rotated-device-token",
    );
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("settings-token-generated.png"),
    });

    expect(unexpected).toEqual([]);
  });
});

function collectUnexpectedErrors(page: Page) {
  const unexpected: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      if (message.text().startsWith("Failed to load resource:")) {
        return;
      }
      unexpected.push(`console: ${message.text()}`);
    }
  });
  page.on("response", (response) => {
    const status = response.status();
    if (status >= 400 && response.url().includes("/api/")) {
      unexpected.push(`response: ${status} ${response.url()}`);
    }
  });
  page.on("pageerror", (error) => {
    unexpected.push(`pageerror: ${error.message}`);
  });
  return unexpected;
}
