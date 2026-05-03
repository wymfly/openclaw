import { expect, test, type Page } from "@playwright/test";
import { openDeck, startBundledStack, type E2EStack } from "./helpers";

test.describe("sessions mock visual handoff alignment", () => {
  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startBundledStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("renders sessions workbench and interaction states with contract-shaped mock data", async ({
    page,
  }, testInfo) => {
    const unexpected = collectUnexpectedErrors(page);

    await openDeck(page, stack.frontendBase, "sessions", stack.accessToken, {
      locale: "en",
      nav: "expanded",
      theme: "dark",
    });

    await expect(page.getByTestId("sessions-panel")).toBeVisible();
    await expect(page.getByText("Inventory ready").first()).toBeVisible();
    await expect(page.getByText("Detail ready").first()).toBeVisible();
    await expect(page.getByText("Main Session").first()).toBeVisible();
    await expect(page.getByText("Usage and context")).toBeVisible();
    await expect(page.getByText("Compaction checkpoints")).toBeVisible();
    await expect(page.getByText("Session actions")).toBeVisible();
    await page.waitForTimeout(500);

    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("sessions-workbench-ready.png"),
    });

    await page.getByPlaceholder("search transcript").fill("history");
    await expect(page.getByText("match 1 of 1").first()).toBeVisible();
    await page.getByRole("button", { name: "Export Markdown" }).click();
    await expect(page.getByText("Prepared markdown export")).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("sessions-export-state.png"),
    });

    await page.getByRole("button", { name: "Compact session" }).click();
    await expect(page.getByRole("button", { name: "Confirm compact" })).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("sessions-compact-confirm.png"),
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
