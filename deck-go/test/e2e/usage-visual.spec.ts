import { expect, test, type Page } from "@playwright/test";
import { openDeck, startBundledStack, type E2EStack } from "./helpers";

test.describe("usage mock visual handoff alignment", () => {
  let stack: E2EStack;

  test.beforeAll(async ({ browserName }, testInfo) => {
    void browserName;
    stack = await startBundledStack(testInfo);
  });

  test.afterAll(async () => {
    await stack?.stop();
  });

  test("renders usage cockpit and contract-shaped interaction states", async ({
    page,
  }, testInfo) => {
    const unexpected = collectUnexpectedErrors(page);

    await openDeck(page, stack.frontendBase, "usage", stack.accessToken, {
      locale: "en",
      nav: "expanded",
      theme: "dark",
    });

    await expect(page.getByTestId("usage-panel")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Usage operations cockpit" })).toBeVisible();
    await expect(page.getByText("Spend and token movement")).toBeVisible();
    await expect(page.getByText("Quota pressure")).toBeVisible();
    await expect(page.getByText("Main production review")).toBeVisible();
    await expect(page.getByText("OpenAI").first()).toBeVisible();
    await page.waitForTimeout(500);

    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("usage-cockpit-ready.png"),
    });

    await page.getByRole("button", { name: "By model" }).click();
    await expect(page.getByText("gpt-5.4-mini")).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("usage-trend-by-model.png"),
    });

    await page.getByRole("button", { name: /Anthropic/ }).click();
    await expect(
      page.locator(".usage-panel__provider .deckgo-stat-value").getByText("anthropic"),
    ).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("usage-provider-selected.png"),
    });

    await page.getByPlaceholder("search usage sessions").fill("builder");
    await expect(page.getByText("Builder validation")).toBeVisible();
    await page.getByRole("button", { name: /Builder validation/ }).click();
    await expect(page.getByText("Session logs")).toBeVisible();
    await expect(page.getByText("Usage timeseries")).toBeVisible();
    await expect(page.getByText("Context weight", { exact: true })).toBeVisible();
    await page.screenshot({
      fullPage: false,
      path: testInfo.outputPath("usage-session-drilldown.png"),
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
