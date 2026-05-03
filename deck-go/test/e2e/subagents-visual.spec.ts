import { expect, test, type Page } from "@playwright/test";
import { openDeck, startBundledStack, type E2EStack } from "./helpers";

test.describe("subagents mock visual handoff alignment", () => {
  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startBundledStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("renders subagents workbench, config, and steer result with contract-shaped mock data", async ({
    page,
  }, testInfo) => {
    const unexpected = collectUnexpectedErrors(page);

    await openDeck(page, stack.frontendBase, "subagents", stack.accessToken, {
      locale: "en",
      nav: "expanded",
      theme: "dark",
    });

    await expect(page.locator('[data-testid="subagents-panel"]')).toBeVisible();
    await expect(page.getByText("Subagents ready")).toBeVisible();
    await expect(
      page.locator(".subagents-run-row").filter({ hasText: "Builder Agent" }),
    ).toBeVisible();
    await expect(page.getByText("Lineage root").first()).toBeVisible();
    await expect(page.locator(".subagents-run-row")).toHaveCount(1);
    await page.waitForTimeout(500);

    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("subagents-workbench-ready.png"),
    });

    await page.getByRole("tab", { name: "Config" }).click();
    await expect(page.getByText("Global spawn defaults")).toBeVisible();
    await expect(page.getByText("Per-agent permissions")).toBeVisible();
    await expect(page.getByText("Gateway-valid agents.defaults.subagents").first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("subagents-config.png"),
    });

    await page.getByLabel("Steer instruction").fill("Keep this mock run focused");
    await page.getByRole("button", { name: "Steer" }).click();
    await expect(page.getByText("Last subagent action")).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("subagents-steer-result.png"),
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
