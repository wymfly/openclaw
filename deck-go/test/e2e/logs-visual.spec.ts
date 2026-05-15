import { expect, test, type Page } from "@playwright/test";
import { openDeck, startLocalStack, type E2EStack } from "./helpers";

test.describe("logs mock visual handoff alignment", () => {
  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startLocalStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("renders logs workbench and export state with contract-shaped mock data", async ({
    page,
  }, testInfo) => {
    const unexpected = collectUnexpectedErrors(page);

    await openDeck(page, stack.frontendBase, "logs", stack.accessToken, {
      locale: "en",
      nav: "expanded",
      theme: "dark",
    });

    await expect(page.locator('[data-testid="logs-panel"]')).toBeVisible();
    await expect(page.getByText("Tail ready")).toBeVisible();
    await expect(
      page
        .locator(".logs-panel .ds-panel-section-header")
        .getByText(/Stream (connected|connecting|reconnecting)/),
    ).toBeVisible();
    await expect(page.getByText("gateway ready").first()).toBeVisible();
    await expect(page.getByText("tool retry scheduled").first()).toBeVisible();
    await expect(page.locator(".log-row").filter({ hasText: "gateway ready" })).toBeVisible();
    await expect(page.locator(".details-pane")).toBeVisible();
    await page.waitForTimeout(500);

    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("logs-workbench-ready.png"),
    });

    await page.getByLabel("Log source filter").selectOption("agent");
    await page.getByLabel("Log session filter").selectOption("sess-build");
    await expect(page.getByText("agent handoff failed").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Structured fields" })).toBeVisible();
    await page.getByRole("button", { name: /Filter by correlation/ }).click();
    await expect(page.getByLabel("Correlation id filter")).toHaveValue("trace-build-42");
    await page.getByRole("button", { name: "Prepare export" }).click();
    await expect(page.getByText("Prepared log export")).toBeVisible();
    await expect(page.getByText("[WARN] [agent] sessionKey=sess-build").first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("logs-filter-export.png"),
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
