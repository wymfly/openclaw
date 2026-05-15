import { expect, test, type Page } from "@playwright/test";
import { openDeck, startLocalStack, type E2EStack } from "./helpers";

test.describe("channels mock visual handoff alignment", () => {
  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startLocalStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("renders channels workbench and interaction states with contract-shaped mock data", async ({
    page,
  }, testInfo) => {
    const unexpected = collectUnexpectedErrors(page);

    await openDeck(page, stack.frontendBase, "channels", stack.accessToken, {
      locale: "en",
      nav: "expanded",
      theme: "dark",
    });

    await expect(page.getByTestId("channels-panel")).toBeVisible();
    const panel = page.getByTestId("channels-panel");
    await expect(panel.getByRole("heading", { name: "Channels" })).toBeVisible();
    await expect(page.getByRole("button", { name: /New channel/ })).toBeDisabled();
    await expect(page.locator(".row").filter({ hasText: "Discord" })).toBeVisible();
    await expect(page.locator(".row").filter({ hasText: "WeCom" })).toBeVisible();
    await expect(page.locator(".row").filter({ hasText: "Slack" })).toBeVisible();
    await expect(page.locator(".row").filter({ hasText: "QQ" })).toBeVisible();
    await expect(page.getByText("5 of 5 channels")).toBeVisible();
    await page.waitForTimeout(500);

    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("channels-list-ready.png"),
    });

    await page.locator(".row").filter({ hasText: "Discord" }).click();
    await expect(page.getByRole("heading", { name: /Discord/ })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Overview" })).toBeVisible();
    await expect(page.getByText("Inventory snapshot")).toBeVisible();
    await expect(page.getByText("gateway reconnect backoff is active")).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("channels-discord-detail.png"),
    });

    await page.getByRole("button", { name: "Test channel" }).click();
    await expect(page.getByRole("dialog", { name: "Channel probe result" })).toBeVisible();
    await expect(page.getByText("probe success").first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("channels-probe-state.png"),
    });
    await page
      .getByRole("dialog", { name: "Channel probe result" })
      .getByRole("button", { name: "Done" })
      .last()
      .click();

    await page.getByRole("tab", { name: "Settings" }).click();
    await expect(page.getByText("Channel settings").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Save channel settings" })).toBeDisabled();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("channels-settings-state.png"),
    });

    await page.getByRole("tab", { name: "Routing" }).click();
    await expect(page.getByRole("heading", { name: "Routing bindings" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open routing" })).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("channels-routing-state.png"),
    });

    await panel.getByRole("button", { name: "Channels" }).click();
    await page.locator(".row").filter({ hasText: "WeCom" }).click();
    await page.getByRole("tab", { name: "WeCom access" }).click();
    await expect(page.getByText("WeCom access controls")).toBeVisible();
    await page.getByText("WeCom access controls").scrollIntoViewIfNeeded();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("channels-wecom-access-state.png"),
    });

    await openDeck(page, stack.frontendBase, "channels", stack.accessToken, {
      locale: "zh",
      nav: "expanded",
      theme: "light",
    });
    await expect(page.getByTestId("channels-panel")).toBeVisible();
    await expect(page.getByRole("heading", { name: "渠道管理" })).toBeVisible();
    await expect(page.getByText("显示 5 / 5 个渠道")).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("channels-light-zh.png"),
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
