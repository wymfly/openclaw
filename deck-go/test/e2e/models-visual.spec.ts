import { expect, test, type Page } from "@playwright/test";
import { openDeck, startBundledStack, type E2EStack } from "./helpers";

test.describe("models mock visual handoff alignment", () => {
  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startBundledStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("renders models workbench and contract-shaped interaction states", async ({
    page,
  }, testInfo) => {
    const unexpected = collectUnexpectedErrors(page);

    await openDeck(page, stack.frontendBase, "models", stack.accessToken, {
      locale: "en",
      nav: "expanded",
      theme: "dark",
    });

    await expect(page.getByTestId("models-panel")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Model operations workbench" })).toBeVisible();
    await expect(page.getByText("Runtime model catalog").first()).toBeVisible();
    await expect(page.getByText("Provider overview").first()).toBeVisible();
    await expect(
      page.locator("#deck-ui-models-catalog").getByText("GPT-5.4").first(),
    ).toBeVisible();
    await expect(
      page.locator("#deck-ui-models-catalog").getByText("Claude Sonnet 4.6").first(),
    ).toBeVisible();
    await page.waitForTimeout(500);

    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("models-workbench-ready.png"),
    });

    await page.getByRole("tab", { name: "Global Provider Config" }).click();
    await expect(page.getByText("Provider config editor")).toBeVisible();
    await expect(page.getByText("AWS Bedrock Discovery")).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("models-provider-config-state.png"),
    });

    await page.getByRole("tab", { name: "Fallbacks" }).click();
    await expect(page.getByText("Default model chain")).toBeVisible();
    await expect(page.getByText("Model Allowlist")).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("models-fallback-state.png"),
    });

    await page.getByRole("tab", { name: "Usage" }).click();
    await expect(page.getByText("Model usage summary")).toBeVisible();
    await expect(page.getByText("Provider Quota")).toBeVisible();
    await expect(page.getByText("highest pressure")).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("models-usage-state.png"),
    });

    await page.getByRole("tab", { name: "Runtime Inventory" }).click();
    await page
      .getByRole("button", { name: /Open provider config/ })
      .first()
      .click();
    await expect(page.getByText("Provider config editor")).toBeVisible();

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
