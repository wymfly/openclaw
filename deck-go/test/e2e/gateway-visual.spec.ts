import { expect, test, type Page } from "@playwright/test";
import { authHeaders, openDeck, startBundledStack, type E2EStack } from "./helpers";

test.describe("gateway mock visual handoff alignment", () => {
  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startBundledStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("renders gateway workbench and monitor timeline with contract-shaped mock data", async ({
    page,
  }, testInfo) => {
    const unexpected = collectUnexpectedErrors(page);

    const subscribe = await page.request.post(`${stack.backendBase}/api/chat/session-events`, {
      data: { action: "subscribe", sessionKey: "agent:main:visual" },
      headers: authHeaders(stack.accessToken),
    });
    expect(subscribe.ok(), `mock subscription returned ${subscribe.status()}`).toBe(true);

    await openDeck(page, stack.frontendBase, "gateway", stack.accessToken, {
      locale: "en",
      nav: "expanded",
      theme: "dark",
    });

    await expect(page.getByTestId("gateway-panel")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Gateway workbench" })).toBeVisible();
    await expect(page.getByText("Gateway health diagnostics")).toBeVisible();
    await expect(page.getByText("Gateway status summary")).toBeVisible();
    await expect(page.getByText("run-visual-1").first()).toBeVisible();
    await expect(page.getByText("Chat run completed").first()).toBeVisible();
    await page.waitForTimeout(500);

    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("gateway-workbench-ready.png"),
    });

    await page.getByRole("tab", { name: "History" }).click();
    await expect(page.getByRole("heading", { name: "History" })).toBeVisible();
    await expect(page.getByRole("button", { name: /run-visual-1/ })).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("gateway-history-state.png"),
    });

    await page.getByRole("button", { name: /run-visual-1/ }).click();
    await expect(page.getByRole("heading", { name: "Run Timeline" })).toBeVisible();
    await expect(
      page.locator("#deck-ui-gateway-timeline").getByText("Tool Waterfall"),
    ).toBeVisible();
    await expect(page.locator("#deck-ui-gateway-timeline").getByText("File Changes")).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("gateway-timeline-state.png"),
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
