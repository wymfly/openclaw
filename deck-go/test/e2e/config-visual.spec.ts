import { expect, test, type Page } from "@playwright/test";
import { openDeck, startBundledStack, waitForGatewayMethod, type E2EStack } from "./helpers";

test.describe("config mock visual handoff alignment", () => {
  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startBundledStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("renders config governance workbench and raw apply states", async ({ page }, testInfo) => {
    const unexpected = collectUnexpectedErrors(page);

    await openDeck(page, stack.frontendBase, "config", stack.accessToken, {
      locale: "en",
      nav: "expanded",
      theme: "dark",
    });

    await expect(page.getByTestId("config-panel")).toBeVisible();
    await waitForGatewayMethod(stack.requestLog, "config.get");
    await waitForGatewayMethod(stack.requestLog, "config.schema.lookup");
    await expect(page.getByRole("heading", { name: "Config" }).first()).toBeVisible();
    await expect(page.getByText("Config ready").first()).toBeVisible();
    await expect(page.getByText("config-hash-visual-1").first()).toBeVisible();
    await expect(page.getByText("Structured section editor").first()).toBeVisible();
    await expect(page.getByText("Thinking").first()).toBeVisible();
    await expect(page.getByText("OpenAI API key env").first()).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    await page.waitForTimeout(500);

    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("config-workbench-ready.png"),
    });

    await page.getByLabel("Toggle visibility models.providers.openai.apiKeyEnv").click();
    await expect(page.getByLabel("Edit models.providers.openai.apiKeyEnv")).toHaveAttribute(
      "type",
      "text",
    );
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("config-sensitive-revealed.png"),
    });

    await page.getByLabel("Edit agents.defaults.subagents.model").fill("openai/gpt-5.4-mini");
    await expect(page.getByText("unsaved yes").first()).toBeVisible();
    await page.getByRole("button", { name: "Apply config" }).click();
    await expect(page.getByRole("dialog", { name: "Config diff preview" })).toBeVisible();
    await expect(page.getByText("pending config changes").first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("config-diff-preview.png"),
    });

    await Promise.all([
      page.waitForResponse((response) => {
        return (
          response.url().includes("/api/config/apply") &&
          response.request().method() === "POST" &&
          response.ok()
        );
      }),
      page.getByRole("button", { name: "Confirm apply config" }).click(),
    ]);
    await waitForGatewayMethod(stack.requestLog, "config.apply");
    await expect(page.getByText("config-hash-visual-2").first()).toBeVisible();
    await expect(page.getByText("Last apply result").first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("config-apply-result.png"),
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
