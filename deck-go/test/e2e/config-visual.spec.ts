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

    const panel = page.getByTestId("config-panel");
    await expect(panel).toBeVisible();
    await waitForGatewayMethod(stack.requestLog, "config.get");
    await waitForGatewayMethod(stack.requestLog, "config.schema.lookup");
    await expect(panel.getByRole("heading", { name: "Configuration" }).first()).toBeVisible();
    await expect(panel.getByText("Snapshot in sync").first()).toBeVisible();
    await expect(panel.getByText("base config-hash-visual-1").first()).toBeVisible();
    await expect(panel.getByText("Draft preview").first()).toBeVisible();
    await expect(page.getByText("Thinking").first()).toBeVisible();
    await expect(panel).toContainText("OpenAI API key env");
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    await page.waitForTimeout(500);

    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("config-workbench-ready.png"),
    });

    await page
      .getByLabel("Toggle visibility models.providers.openai.apiKeyEnv")
      .scrollIntoViewIfNeeded();
    await page.getByLabel("Toggle visibility models.providers.openai.apiKeyEnv").click();
    await expect(page.getByLabel("Edit models.providers.openai.apiKeyEnv")).toHaveAttribute(
      "type",
      "text",
    );
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("config-sensitive-revealed.png"),
    });

    await panel.getByRole("tab", { name: "Raw" }).click();
    await expect(panel.getByTestId("config-raw-editor")).toBeVisible();
    await expect(panel.getByText("JSON valid").first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("config-raw-pane.png"),
    });

    await page.getByLabel("Edit agents.defaults.subagents.model").fill("openai/gpt-5.4-mini");
    await expect(panel.getByText(/unsaved/).first()).toBeVisible();
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
    await expect(panel.getByText("base config-hash-visual-2").first()).toBeVisible();
    await panel.getByRole("tab", { name: "History" }).click();
    await expect(panel.getByText("Last apply result").first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("config-apply-result.png"),
    });

    await openDeck(page, stack.frontendBase, "config", stack.accessToken, {
      locale: "zh",
      nav: "expanded",
      theme: "light",
    });
    await expect(page.getByTestId("config-panel")).toBeVisible();
    await expect(page.getByRole("heading", { name: "配置治理" }).first()).toBeVisible();
    await expect(page.getByText("快照已同步").first()).toBeVisible();
    await page.getByRole("tab", { name: "原始" }).click();
    await expect(page.getByTestId("config-raw-editor")).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("config-light-zh-raw.png"),
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
