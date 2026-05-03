import { expect, test, type Page } from "@playwright/test";
import { openDeck, startBundledStack, type E2EStack } from "./helpers";

test.describe("routing mock visual handoff alignment", () => {
  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startBundledStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("renders routing workbench and simulation with contract-shaped mock data", async ({
    page,
  }, testInfo) => {
    const unexpected = collectUnexpectedErrors(page);

    await openDeck(page, stack.frontendBase, "routing", stack.accessToken, {
      locale: "en",
      nav: "expanded",
      theme: "dark",
    });

    await expect(page.locator('[data-testid="routing-panel"]')).toBeVisible();
    await expect(page.getByText("Routing ready")).toBeVisible();
    await expect(page.getByText("ops").first()).toBeVisible();
    await expect(page.getByText("finance-lead").first()).toBeVisible();
    await expect(page.locator(".routing-binding-row")).toHaveCount(3);
    await page.waitForTimeout(500);

    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("routing-workbench-ready.png"),
    });

    await page.getByRole("button", { name: "Simulate" }).click();
    await expect(page.getByText("Simulation result")).toBeVisible();
    await expect(
      page.locator(".routing-result").getByText("agent:ops:discord:finance-lead").first(),
    ).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("routing-simulation-result.png"),
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
