import { expect, test, type Page } from "@playwright/test";
import { openDeck, startBundledStack, type E2EStack } from "./helpers";

test.describe("threads mock visual handoff alignment", () => {
  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startBundledStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("renders thread relationship workspace and contract-shaped interaction states", async ({
    page,
  }, testInfo) => {
    const unexpected = collectUnexpectedErrors(page);

    await openDeck(page, stack.frontendBase, "threads", stack.accessToken, {
      locale: "en",
      nav: "expanded",
      theme: "dark",
    });

    await expect(page.getByTestId("threads-panel")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Thread Bindings" })).toBeVisible();
    await expect(page.getByText("Thread inventory")).toBeVisible();
    await expect(page.getByText("Selected relationship")).toBeVisible();
    await expect(page.getByRole("button", { name: /Main support thread/ })).toBeVisible();
    await expect(page.getByText("agent:main:web-main").first()).toBeVisible();
    await page.waitForTimeout(500);

    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("threads-workspace-ready.png"),
    });

    await page.getByRole("button", { name: /Builder escalation/ }).click();
    await expect(page.getByText("agent:builder:web-root").first()).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("threads-selected-builder.png"),
    });

    await page.getByPlaceholder("agent id").fill("security");
    await expect(
      page.getByRole("button", {
        name: /thread-long-enterprise-direct-openclaw-prod-incident-room/,
      }),
    ).toBeVisible();
    await expect(page.getByText("Builder escalation")).toHaveCount(0);
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("threads-filtered-security.png"),
    });

    await page.getByRole("button", { name: "Copy session key" }).click();
    await expect(page.locator(".threads-panel__handoff")).toContainText(
      /session key.*agent:security:web-risk/i,
    );
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("threads-copy-feedback.png"),
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
