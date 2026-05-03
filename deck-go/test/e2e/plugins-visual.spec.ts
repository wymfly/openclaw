import { expect, test, type Page } from "@playwright/test";
import { openDeck, startBundledStack, waitForGatewayMethod, type E2EStack } from "./helpers";

test.describe("plugins mock visual handoff alignment", () => {
  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startBundledStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("renders plugin inventory workbench and contract-shaped interaction states", async ({
    page,
  }, testInfo) => {
    const unexpected = collectUnexpectedErrors(page);

    await openDeck(page, stack.frontendBase, "plugins", stack.accessToken, {
      locale: "en",
      nav: "expanded",
      theme: "dark",
    });

    await expect(page.getByTestId("plugins-panel")).toBeVisible();
    await waitForGatewayMethod(stack.requestLog, "deck.plugins.list");
    await waitForGatewayMethod(stack.requestLog, "channels.status");
    await expect(page.getByRole("heading", { name: "Plugins" }).first()).toBeVisible();
    await expect(page.getByText("Inventory ready").first()).toBeVisible();
    await expect(page.getByText("3 plugins").first()).toBeVisible();
    await expect(page.getByText("GitHub").first()).toBeVisible();
    await expect(page.getByText("WeCom").first()).toBeVisible();
    await expect(page.getByText("Slack").first()).toBeVisible();
    await expect(page.getByText("Not visible in Channels: github, teams").first()).toBeVisible();
    await expect(page.getByText("Lifecycle controls deferred").first()).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    await page.waitForTimeout(500);

    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("plugins-workbench-ready.png"),
    });

    await page.getByText("Plugin payload").click();
    await expect(page.getByText('"id": "github"').first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("plugins-raw-payload.png"),
    });

    await Promise.all([
      page.waitForResponse((response) => {
        return response.url().includes("/api/deck/plugins?capability=all") && response.ok();
      }),
      page.getByRole("button", { name: "All plugins" }).click(),
    ]);
    await expect(page.getByText("Docs Tools").first()).toBeVisible();
    await expect(page.getByText("4 plugins").first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("plugins-all-scope.png"),
    });

    await page.getByRole("button", { name: /WeCom/ }).first().click();
    await expect(page.getByText("Open access for wecom").first()).toBeVisible();
    await expect(page.getByText("qrCodeAuth").first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("plugins-wecom-handoff-state.png"),
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
