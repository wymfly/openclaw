import { expect, test, type Page } from "@playwright/test";
import { openDeck, startBundledStack, waitForGatewayMethod, type E2EStack } from "./helpers";

test.describe("cron mock visual handoff alignment", () => {
  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startBundledStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("renders scheduler workbench and contract-shaped interaction states", async ({
    page,
  }, testInfo) => {
    const unexpected = collectUnexpectedErrors(page);

    await openDeck(page, stack.frontendBase, "cron", stack.accessToken, {
      locale: "en",
      nav: "expanded",
      theme: "dark",
    });

    await expect(page.getByTestId("cron-panel")).toBeVisible();
    await waitForGatewayMethod(stack.requestLog, "cron.list");
    await waitForGatewayMethod(stack.requestLog, "cron.status");
    await waitForGatewayMethod(stack.requestLog, "cron.runs");
    await expect(page.getByRole("heading", { name: "Cron Jobs" }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Selected Job" })).toBeVisible();
    await expect(page.getByText("Cron ready").first()).toBeVisible();
    await expect(page.getByText("running: no").first()).toBeVisible();
    await expect(page.getByText("jobs: 3").first()).toBeVisible();
    await expect(page.getByText("Nightly workspace sync").first()).toBeVisible();
    await expect(page.getByText("Frequent agent heartbeat").first()).toBeVisible();
    await expect(page.getByText("Weekly usage digest").first()).toBeVisible();
    await page.waitForTimeout(500);

    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("cron-workbench-ready.png"),
    });

    await page.getByRole("button", { name: "Run History" }).click();
    await expect(page.getByText("OK").first()).toBeVisible();
    await expect(page.getByText("Skipped").first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("cron-run-history.png"),
    });

    await page.getByRole("button", { name: "Heartbeat", exact: true }).click();
    await expect(page.getByText("Heartbeat configuration is shown as a read-only")).toBeVisible();
    await expect(page.getByText("Read-only", { exact: true })).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("cron-heartbeat.png"),
    });

    await page.getByRole("button", { name: "Hourly" }).click();
    await expect(page.getByLabel("cron schedule value")).toHaveValue("0 * * * *");
    await page.getByRole("button", { name: "Run Now" }).click();
    await waitForGatewayMethod(stack.requestLog, "cron.run");
    await expect(page.getByText("Last cron action").first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("cron-template-and-run-result.png"),
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
