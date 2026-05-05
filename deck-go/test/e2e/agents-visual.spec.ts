import { expect, test, type Page } from "@playwright/test";
import { openDeck, startBundledStack, type E2EStack } from "./helpers";

test.describe("agents mock visual handoff alignment", () => {
  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startBundledStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("renders agents workbench and create dialog with contract-shaped mock data", async ({
    page,
  }, testInfo) => {
    const unexpected = collectUnexpectedErrors(page);

    await openDeck(page, stack.frontendBase, "agents", stack.accessToken, {
      locale: "en",
      nav: "collapsed",
      theme: "dark",
    });

    await expect(page.locator('[data-agents-workbench="true"]')).toBeVisible();
    await expect(page.getByText("Main").first()).toBeVisible();
    await expect(page.getByText("Ops Runner").first()).toBeVisible();

    await page.waitForTimeout(500);
    await page.locator('[data-agents-workbench="true"]').screenshot({
      path: testInfo.outputPath("agents-workbench-ready.png"),
    });

    await page.getByText("Main").first().click();
    await expect(page.getByLabel("Agent detail for Main")).toBeVisible();
    await expect(page.getByText("Overview").first()).toBeVisible();

    await page.getByRole("button", { name: "New agent" }).click();
    await expect(page.getByRole("dialog", { name: "Create agent" })).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("agents-create-dialog.png"),
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
