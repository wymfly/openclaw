import { expect, test, type Page } from "@playwright/test";
import { openDeck, startBundledStack, waitForGatewayMethod, type E2EStack } from "./helpers";

test.describe("api explorer mock visual handoff alignment", () => {
  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startBundledStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("renders gateway describe catalog and interaction states from mock data", async ({
    page,
  }, testInfo) => {
    const unexpected = collectUnexpectedErrors(page);

    await openDeck(page, stack.frontendBase, "api-explorer", stack.accessToken, {
      locale: "en",
      nav: "expanded",
      theme: "dark",
    });

    await expect(page.getByTestId("api-explorer-panel")).toBeVisible();
    await waitForGatewayMethod(stack.requestLog, "gateway.describe");
    await expect(page.getByRole("heading", { name: "Gateway API Explorer" }).first()).toBeVisible();
    await expect(page.getByText("Describe ready").first()).toBeVisible();
    await expect(
      page.locator(".api-explorer-panel__metric").filter({ hasText: "methods" }),
    ).toContainText("4");
    await expect(
      page.locator(".api-explorer-panel__metric").filter({ hasText: "events" }),
    ).toContainText("2");
    await expect(
      page.locator(".api-explorer-panel__metric").filter({ hasText: "untyped" }),
    ).toContainText("1");
    await expect(page.getByText("deck.agents.list").first()).toBeVisible();
    await expect(page.getByText("deck.sessions.detail").first()).toBeVisible();
    await expect(page.getByText("gateway.batch").first()).toBeVisible();
    await expect(page.getByText("gateway.describe").first()).toBeVisible();
    await expect(page.getByText("deck (2)").first()).toBeVisible();
    await expect(page.getByText("gateway (2)").first()).toBeVisible();
    await expect(page.getByText("Untyped methods").first()).toBeVisible();
    await page.getByText("Untyped methods").first().click();
    await expect(page.getByText("legacy.raw").first()).toBeVisible();
    await page.waitForTimeout(500);

    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("api-explorer-workspace-ready.png"),
    });

    await page.getByRole("treeitem", { name: /gateway\.describe/ }).click();
    await page.getByRole("button", { name: "Run" }).click();
    await expect(page.locator(".api-explorer-panel__response-card")).toContainText("200");
    await expect(page.locator(".api-explorer-panel__response-card")).toContainText('"methods"');
    await expect(page.locator(".api-explorer-panel__history")).toContainText("gateway.describe");
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("api-explorer-safe-run-response.png"),
    });

    await page.getByPlaceholder("method name or scope").fill("sessions");
    const catalog = page.locator(".api-explorer-panel__catalog");
    await expect(catalog.getByText("deck.sessions.detail")).toBeVisible();
    await expect(catalog.getByText("deck.agents.list")).toHaveCount(0);
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("api-explorer-method-filtered.png"),
    });

    await page.getByRole("button", { name: "Events" }).click();
    await expect(page.getByText("activity.event").first()).toBeVisible();
    await expect(page.getByText("gateway.ready").first()).toBeVisible();
    await expect(page.getByText("Event payload").first()).toBeVisible();
    await expect(page.getByText("id required").first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("api-explorer-events-tab.png"),
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
