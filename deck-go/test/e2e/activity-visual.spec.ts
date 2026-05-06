import { expect, test, type Page } from "@playwright/test";
import { authHeaders, openDeck, startBundledStack, type E2EStack } from "./helpers";

test.describe("activity mock visual handoff alignment", () => {
  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startBundledStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("renders unified activity feed and event detail from mock data", async ({
    page,
  }, testInfo) => {
    const unexpected = collectUnexpectedErrors(page);

    const subscribe = await page.request.post(`${stack.backendBase}/api/chat/session-events`, {
      data: { action: "subscribe", sessionKey: "agent:main:visual" },
      headers: authHeaders(stack.accessToken),
    });
    expect(subscribe.ok(), `mock subscription returned ${subscribe.status()}`).toBe(true);

    await openDeck(page, stack.frontendBase, "activity", stack.accessToken, {
      locale: "en",
      nav: "expanded",
      theme: "dark",
    });

    await expect(page.getByTestId("activity-panel")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Activity" }).first()).toBeVisible();
    await expect(page.getByText("Unified timeline across agent runs")).toBeVisible();
    await expect(page.getByText("Events").first()).toBeVisible();
    await expect(page.getByRole("tab", { name: "Messages" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Errors" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Refresh activity/ })).toBeVisible();
    await expect(page.getByText("Chat run completed").first()).toBeVisible();
    await expect(page.getByText("run-visual-1").first()).toBeVisible();
    await page.waitForTimeout(500);

    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("activity-workspace-ready.png"),
    });

    await page
      .getByRole("button", { name: /Chat run completed/ })
      .first()
      .click();
    await expect(page.getByRole("dialog", { name: "Event detail" })).toBeVisible();
    await expect(page.getByText("Raw event")).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("activity-event-detail.png"),
    });
    await page.getByRole("button", { name: "Close" }).last().click();

    await page.getByRole("tab", { name: "Messages" }).click();
    await expect(page.getByText("Chat run completed").first()).toBeVisible();
    await page.getByRole("searchbox", { name: "Search events" }).fill("definitely-no-activity");
    await expect(page.getByText("No activity events match the current filters.")).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.getByText("Chat run completed").first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("activity-filter-recovered.png"),
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
