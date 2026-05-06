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

  test("renders plugin list/detail/dialog states against contract-shaped mock data", async ({
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
    await expect(page.getByText("runtime inventory").first()).toBeVisible();
    await expect(page.getByText("Channel-capable").first()).toBeVisible();
    await expect(page.getByText("Exposes").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /GitHub/ }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /WeCom/ }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Slack/ }).first()).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    await page.waitForTimeout(500);

    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("plugins-list-ready.png"),
    });
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("plugins-workbench-ready.png"),
    });

    await Promise.all([
      page.waitForResponse((response) => {
        return response.url().includes("/api/deck/plugins?capability=all") && response.ok();
      }),
      page.getByRole("tab", { name: "scope=all" }).click(),
    ]);
    await expect(page.getByRole("button", { name: /Docs Tools/ }).first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("plugins-list-all-scope.png"),
    });

    await page
      .getByRole("button", { name: /GitHub/ })
      .first()
      .click();
    await expect(
      page.getByTestId("plugins-panel").getByRole("button", { name: "Plugins" }),
    ).toBeVisible();
    await expect(page.getByText("Plugin Config Key").first()).toBeVisible();
    await expect(page.getByText("Not visible in Channels: github, teams").first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("plugins-detail-overview.png"),
    });

    await page.getByRole("tab", { name: "Diagnostics" }).click();
    await expect(page.getByRole("button", { name: /token missing/ })).toBeVisible();
    await page.getByRole("button", { name: /token missing/ }).click();
    await expect(page.getByRole("dialog", { name: "Diagnostic detail" })).toBeVisible();
    await expect(page.getByText("Remediation hint")).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("plugins-diagnostic-dialog.png"),
    });
    await page.getByRole("button", { name: "Close" }).first().click();

    await page.getByRole("button", { name: "Manifest" }).first().click();
    await expect(page.getByRole("dialog", { name: "Manifest preview" })).toBeVisible();
    await expect(page.getByText('"id": "github"').first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("plugins-manifest-dialog.png"),
    });
    await page.getByRole("button", { name: "Close" }).last().click();

    await page.getByTestId("plugins-panel").getByRole("button", { name: "Plugins" }).click();
    await page.getByRole("button", { name: /WeCom/ }).first().click();
    await expect(page.getByRole("button", { name: "Open access for wecom" })).toBeVisible();
    await page.getByRole("tab", { name: "Capabilities" }).click();
    await expect(page.getByText("qrCodeAuth").first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("plugins-wecom-handoff-state.png"),
    });

    await openDeck(page, stack.frontendBase, "plugins", stack.accessToken, {
      locale: "zh",
      nav: "expanded",
      theme: "light",
    });
    await expect(page.getByTestId("plugins-panel")).toBeVisible();
    await expect(page.getByText("清单范围").first()).toBeVisible();
    await expect(page.getByRole("tab", { name: "scope=channel" })).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("plugins-light-zh-list.png"),
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
