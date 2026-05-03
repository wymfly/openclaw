import { expect, test, type Page } from "@playwright/test";
import { openDeck, startBundledStack, type E2EStack } from "./helpers";

test.describe("channels mock visual handoff alignment", () => {
  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startBundledStack(testInfo);
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
    await expect(page.getByRole("heading", { name: "Channel inventory" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Selected channel" })).toBeVisible();
    await expect(page.getByText("Discord").first()).toBeVisible();
    await expect(page.getByText("Enterprise Discord", { exact: true })).toBeVisible();
    await expect(page.getByText("Throughput").first()).toBeVisible();
    await page.waitForTimeout(500);

    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("channels-workbench-ready.png"),
    });

    await page.getByRole("button", { name: "Test channel" }).click();
    await expect(page.getByText("probe success").first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("channels-probe-state.png"),
    });

    await page.getByRole("button", { name: /WeCom/ }).first().click();
    await expect(page.getByText("WeCom access controls")).toBeVisible();
    await expect(page.getByText("Routing bindings")).toBeVisible();
    await expect(page.getByText("1 bindings currently target this WeCom account.")).toBeVisible();
    await page.getByText("WeCom access controls").scrollIntoViewIfNeeded();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("channels-wecom-access-state.png"),
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
