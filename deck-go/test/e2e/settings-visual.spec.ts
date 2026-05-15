import { expect, test, type Page } from "@playwright/test";
import { openDeck, startLocalStack, type E2EStack } from "./helpers";

test.describe("settings mock visual handoff alignment", () => {
  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startLocalStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("renders Settings section rail, dialogs, and localized variant with contract-shaped mock data", async ({
    page,
  }, testInfo) => {
    const unexpected = collectUnexpectedErrors(page);

    await openDeck(page, stack.frontendBase, "settings", stack.accessToken, {
      locale: "en",
      nav: "expanded",
      theme: "dark",
    });

    const panel = page.getByTestId("settings-panel");
    await expect(panel).toBeVisible();
    await expect(panel.getByText("Settings ready").first()).toBeVisible();
    await expect(panel.getByText("Devices ready").first()).toBeVisible();
    await expect(panel.getByText("Identity & access").first()).toBeVisible();
    await expect(panel.getByText("Runtime").first()).toBeVisible();
    await expect(panel.getByText("Appearance").first()).toBeVisible();
    await expect(panel.getByText("Paired devices").first()).toBeVisible();
    await page.waitForTimeout(300);
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("settings-workbench-ready.png"),
    });

    await panel.getByRole("tab", { name: /Appearance/ }).click();
    await expect(panel.getByText("Theme, density, motion and language").first()).toBeVisible();
    await panel.getByRole("radio", { name: "Dark" }).click();
    await expect(panel.getByText("1 unsaved").first()).toBeVisible();
    await panel.getByRole("button", { name: "Save (1)" }).click();
    await expect(page.getByRole("dialog", { name: "Save settings" })).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("settings-save-confirm.png"),
    });
    await page
      .getByRole("dialog", { name: "Save settings" })
      .getByRole("button", { name: "Close" })
      .click();

    await panel.getByRole("tab", { name: /Paired devices/ }).click();
    await expect(panel.getByText("Ops tablet").first()).toBeVisible();
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

    await openDeck(page, stack.frontendBase, "settings", stack.accessToken, {
      locale: "zh",
      nav: "expanded",
      theme: "light",
    });
    await expect(page.getByTestId("settings-panel")).toBeVisible();
    await expect(page.getByText("设置就绪").first()).toBeVisible();
    await expect(page.getByRole("tab", { name: /外观/ })).toBeVisible();
    await page.getByRole("tab", { name: /外观/ }).click();
    await expect(page.getByText("语言更改仅作用于当前 Deck UI 外壳").first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("settings-light-zh.png"),
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
