import { expect, test, type Page } from "@playwright/test";
import { openDeck, startBundledStack, type E2EStack } from "./helpers";

test.describe("memory mock visual handoff alignment", () => {
  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startBundledStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("renders memory workspace and contract-shaped interaction states", async ({
    page,
  }, testInfo) => {
    const unexpected = collectUnexpectedErrors(page);

    await openDeck(page, stack.frontendBase, "memory", stack.accessToken, {
      locale: "en",
      nav: "expanded",
      theme: "dark",
    });

    await expect(page.getByTestId("memory-panel")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Memory operations workspace" })).toBeVisible();
    await expect(page.getByText("Recall lanes")).toBeVisible();
    await expect(page.getByText("daily.md").first()).toBeVisible();
    await expect(page.getByText("archive").first()).toBeVisible();
    await page.waitForTimeout(500);

    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("memory-workspace-ready.png"),
    });

    await page.getByRole("button", { name: /daily\.md/ }).click();
    await expect(page.getByText("# remembered context")).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("memory-file-read.png"),
    });

    await page.getByRole("button", { name: "Search" }).click();
    await page.getByPlaceholder("search memory").fill("contract-led");
    await page.getByRole("button", { name: "Search memory" }).click();
    await expect(page.getByText(/Not implemented/)).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("memory-search-unavailable.png"),
    });

    await page.getByRole("button", { name: "Health" }).click();
    await expect(page.getByText(/provider: mock-embedding/).first()).toBeVisible();
    await expect(page.getByText("Raw health response")).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("memory-health.png"),
    });

    await page.getByRole("button", { name: "Dreams" }).click();
    await expect(page.getByText("Dream Diary", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: ".openclaw/memory/dream-diary.md" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Dedupe" }).click();
    await expect(page.getByText("Dream diary action result")).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("memory-dreams.png"),
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
    if (status === 501 && response.url().includes("/api/memory/search")) {
      return;
    }
    if (status >= 400 && response.url().includes("/api/")) {
      unexpected.push(`response: ${status} ${response.url()}`);
    }
  });
  page.on("pageerror", (error) => {
    unexpected.push(`pageerror: ${error.message}`);
  });
  return unexpected;
}
